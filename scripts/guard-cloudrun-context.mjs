#!/usr/bin/env node
/**
 * حارس سياق بناء Cloud Run.
 *
 * يتحقق من ثلاثة أشياء قبل الوصول إلى Cloud Build:
 * 1) كل مصدر ينسخه Dockerfile موجود في المستودع.
 * 2) كل مصدر COPY مسموح فعلياً في `.gcloudignore` وفق قاعدة «آخر نمط يفوز».
 * 3) كل استيراد محلي ساكن يصل إليه `server.mjs` منسوخ إلى صورة Cloud Run.
 *
 * النقطة الثالثة تمنع عطباً مكلفاً: إضافة import جديد إلى الخادم من دون إضافة
 * COPY مقابلة قد تمر من فحوص الصياغة، ثم تسقط الصورة داخل Cloud Build أو عند
 * إقلاع النسخة. هذا الحارس يجعل الفشل محلياً وواضحاً قبل بدء النشر.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCKERFILE = resolve(ROOT, 'Dockerfile')
const IGNORE = resolve(ROOT, '.gcloudignore')
const SERVER = resolve(ROOT, 'server.mjs')

if (!existsSync(DOCKERFILE) || !existsSync(IGNORE)) {
  console.log('· لا Dockerfile أو .gcloudignore — لا شيء يُفحص.')
  process.exit(0)
}

const patterns = readFileSync(IGNORE, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))

const toRegExp = (pattern) => new RegExp(`^${pattern
  .replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*/g, '\u0000')
  .replace(/\*/g, '[^/]*')
  .replace(/\u0000/g, '.*')}$`)

const matches = (pattern, path) => {
  const bare = pattern.replace(/^!/, '')
  if (bare.endsWith('/')) return path.startsWith(bare)
  return toRegExp(bare).test(path)
}

/** آخر نمطٍ مطابق يفوز — هذه قاعدة gcloud نفسها. */
const included = (path) => {
  let verdict = true
  for (const pattern of patterns) {
    if (matches(pattern, path)) verdict = pattern.startsWith('!')
  }
  return verdict
}

const copySources = readFileSync(DOCKERFILE, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('COPY '))
  .flatMap((line) => {
    const tokens = line.slice(5).trim().split(/\s+/).filter(Boolean)
    const withoutOptions = tokens.filter((token) => !token.startsWith('--'))
    return withoutOptions.slice(0, -1)
  })

const copiedSources = new Set(copySources)
const failures = []

for (const source of copySources) {
  if (!existsSync(resolve(ROOT, source))) {
    failures.push(`${source} — ينسخه Dockerfile ولا وجود له في المستودع`)
    continue
  }
  if (!included(source)) {
    const last = patterns.filter((pattern) => matches(pattern, source)).pop()
    failures.push(`${source} — يستبعده .gcloudignore عند «${last}». انقل سطر السماح إلى ما بعده.`)
  }
}

const visitedImports = new Set()
const walkImports = (absolutePath) => {
  if (visitedImports.has(absolutePath)) return
  visitedImports.add(absolutePath)

  if (!existsSync(absolutePath)) {
    failures.push(`${relative(ROOT, absolutePath)} — استيراد محلي مفقود من المستودع`)
    return
  }
  if (!/\.(?:mjs|js)$/.test(absolutePath)) return

  const source = readFileSync(absolutePath, 'utf8')
  for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    walkImports(resolve(dirname(absolutePath), match[1]))
  }
  // ملفات JSON المقروءة عبر new URL موارد تشغيل محلية مثل الاستيرادات تماماً.
  for (const match of source.matchAll(/new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g)) {
    walkImports(resolve(dirname(absolutePath), match[1]))
  }
}

if (existsSync(SERVER)) {
  walkImports(SERVER)
  for (const absolutePath of visitedImports) {
    const repoPath = relative(ROOT, absolutePath)
    if (!copiedSources.has(repoPath)) {
      failures.push(`${repoPath} — يستورده server.mjs لكنه غير منسوخ في Dockerfile`)
      continue
    }
    if (!included(repoPath)) {
      const last = patterns.filter((pattern) => matches(pattern, repoPath)).pop()
      failures.push(`${repoPath} — استيراد خادم يستبعده .gcloudignore عند «${last}»`)
    }
  }
}

/* المورد المقروء وقت التشغيل — لا استيراداً بل `readFileSync` على مسارٍ مبني.
   هذا هو العطب الصامت: الصورة تُبنى وتُقلع بنجاح، ثم يعود الفهرس فارغاً فيردّ
   البوت «ما لقيت مادة منشورة» على كل سؤال. الاستيراد يسقط بصوت، وهذا يسقط بصمت،
   فوجب أن يمسكه الحارس قبل النشر لا بعده. */
const RUNTIME_RESOURCE = /(?:readFileSync|readJson|resolve|join)\s*\([^)]*?['"]((?:\.\.?\/)*(?:src|scripts)\/[A-Za-z0-9_./-]+\.(?:json|ts))['"]|['"](src|scripts)['"]\s*,\s*(?:['"][A-Za-z0-9_.-]+['"]\s*,\s*)*['"]([A-Za-z0-9_.-]+\.(?:json|ts))['"]/g

const runtimeResources = new Map()
for (const absolutePath of visitedImports) {
  if (!/\.(?:mjs|js)$/.test(absolutePath) || !existsSync(absolutePath)) continue
  const source = readFileSync(absolutePath, 'utf8')
  for (const match of source.matchAll(RUNTIME_RESOURCE)) {
    /* الشكلان اللذان يستعملهما المشروع: مسارٌ واحد ('src/data/x.json')،
       أو مقاطع مفصولة ('src', 'data', 'x.json'). نردّهما إلى مسار مستودعٍ واحد. */
    const repoPath = match[1]
      ? match[1].replace(/^(?:\.\.?\/)+/, '')
      : [match[2], ...(match[0].match(/['"][A-Za-z0-9_.-]+['"]/g) || [])
          .slice(1).map((token) => token.slice(1, -1))].join('/')
    if (!repoPath.startsWith('src/') && !repoPath.startsWith('scripts/')) continue
    if (!existsSync(resolve(ROOT, repoPath))) continue
    if (!runtimeResources.has(repoPath)) runtimeResources.set(repoPath, relative(ROOT, absolutePath))
  }
}

for (const [repoPath, reader] of runtimeResources) {
  if (!copiedSources.has(repoPath)) {
    failures.push(`${repoPath} — يقرأه ${reader} وقت التشغيل ولا COPY له في Dockerfile (فهرسٌ فارغ بلا خطأ)`)
    continue
  }
  if (!included(repoPath)) {
    const last = patterns.filter((pattern) => matches(pattern, repoPath)).pop()
    failures.push(`${repoPath} — مورد تشغيل يستبعده .gcloudignore عند «${last}»`)
  }
}

if (failures.length) {
  console.error('✘ سياق بناء Cloud Run ناقص — سيسقط نشر dr-api:')
  for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`)
  console.error('\n  القاعدة: كل import محلي للخادم يحتاج COPY وسطر سماح بعد نمط الاستبعاد.')
  process.exit(1)
}

console.log(`✓ سياق Cloud Run: ${copySources.length} مصدر COPY، و${visitedImports.size} استيراد خادم، و${runtimeResources.size} مورد تشغيل، كلها موجودة ومسموح بها.`)
