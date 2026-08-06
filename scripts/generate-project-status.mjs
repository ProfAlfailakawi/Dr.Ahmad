#!/usr/bin/env node
/**
 * يولّد `PROJECT-STATUS.md` من المصدر نفسه، لا من ذاكرةِ كاتبٍ.
 *
 * القاعدة: كل رقمٍ هنا مستخرَجٌ آلياً. وما مصدره Firestore (المقالات المنشورة،
 * الحلقات، الرسائل) لا يُجمَّد في ملفٍ ثابت — يُقال إنه ديناميكيّ ويُترك.
 *
 * لا يمسّ محتوى تحريرياً، ولا يتصل بخدمةٍ مدفوعة، ولا بشبكةٍ أصلاً.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const at = (path) => resolve(ROOT, path)
const has = (path) => existsSync(at(path))
const read = (path) => readFileSync(at(path), 'utf8')
const readJson = (path) => { try { return JSON.parse(read(path)) } catch { return null } }

const pkg = readJson('package.json') || {}

/* ── الإصدارات: من مصدرٍ واحد، والتعارض يُعلَن لا يُخفى ── */

const clean = (value) => String(value || '').replace(/^[\^~]/, '').trim()
const react = clean(pkg.dependencies?.react || pkg.devDependencies?.react) || 'غير معروف'
const reactMajor = react.split('.')[0]
const nodeEngine = String(pkg.engines?.node || '').trim()
const nvmrc = has('.nvmrc') ? read('.nvmrc').trim() : ''
const workflowNode = (() => {
  const dir = '.github/workflows'
  if (!has(dir)) return []
  const versions = new Set()
  for (const file of readdirSync(at(dir))) {
    for (const match of read(`${dir}/${file}`).matchAll(/node-version:\s*'?"?([\d.x]+)/g)) versions.add(match[1])
  }
  return [...versions]
})()
const nodeConflicts = workflowNode.filter((version) => nodeEngine && !nodeEngine.includes(version.split('.')[0]) && !nvmrc.startsWith(version.split('.')[0]))
const packageManager = has('package-lock.json') ? 'npm (package-lock.json)' : has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : 'غير محدّد'

/* ── العدّ الساكن ── */

const countFiles = (dir, pattern) => {
  if (!has(dir)) return 0
  let total = 0
  for (const entry of readdirSync(at(dir), { withFileTypes: true })) {
    if (entry.isDirectory()) { total += countFiles(`${dir}/${entry.name}`, pattern); continue }
    if (pattern.test(entry.name)) total += 1
  }
  return total
}

const appSource = has('src/App.tsx') ? read('src/App.tsx') : ''
const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const publicRoutes = routes.filter((route) => route !== '*' && !route.startsWith('/admin'))

const dataSource = has('src/data.ts') ? read('src/data.ts') : ''
/** يعدّ عناصر مصفوفةٍ مصدَّرة بعدّ `slug:`/`id:` داخل حدودها — لا تنفيذ للملف. */
const countExportedArray = (name, key = 'slug') => {
  const start = dataSource.indexOf(`export const ${name} = [`)
  if (start < 0) return 0
  const rest = dataSource.slice(start)
  const end = rest.search(/\n\]\s*(?:as const)?\s*\n/)
  const body = end > 0 ? rest.slice(0, end) : rest
  return [...body.matchAll(new RegExp(`\\b${key}:\\s*['"\`]`, 'g'))].length
}

/* `media` بلا slug — تُعدّ بـ`title:` كما هي في المصدر. */
const papers = has('src/data/research-papers.ts')
  ? [...read('src/data/research-papers.ts').matchAll(/\bslug:\s*['"`]/g)].length
  : 0
const videos = readJson('src/data/encyclopedia-videos-fallback.json')?.videos?.length || 0
const transcriptRecords = readJson('src/data/encyclopedia-video-transcripts.json')?.records || {}
const transcribed = Object.values(transcriptRecords).filter((record) => record?.available && Array.isArray(record.segments) && record.segments.length > 0).length
const events = readJson('src/data/events.json')
const upcomingEvents = Array.isArray(events) ? events.length : Array.isArray(events?.items) ? events.items.length : null

const scripts = Object.keys(pkg.scripts || {})
const testCommands = scripts.filter((name) => /(?:^|:)(?:test|self-test|guard|check|audit|verify)/.test(name))

let commit = 'غير متاح'
try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { /* خارج مستودع git */ }

/* ── الملف ── */

const line = (label, value) => `| ${label} | ${value} |`
const status = `# حالة المشروع

> ملفٌ **مولَّد آلياً** — لا يُحرَّر يدوياً. أعِد توليده بـ \`npm run project:status\`.

تاريخ التوليد: ${new Date().toISOString()}
Commit: ${commit}

## المنصّة
| البند | القيمة |
| --- | --- |
${line('React', react)}
${line('Node المطلوب (package.json)', nodeEngine || '—')}
${line('Node في .nvmrc', nvmrc || '—')}
${line('Node في workflows', workflowNode.join('، ') || '—')}
${line('تعارض إصدارات Node', nodeConflicts.length ? `⚠︎ ${nodeConflicts.join('، ')}` : 'لا تعارض')}
${line('مدير الحزم', packageManager)}
${line('TypeScript', clean(pkg.devDependencies?.typescript) || '—')}
${line('Vite', clean(pkg.devDependencies?.vite) || '—')}
${line('Tailwind', clean(pkg.devDependencies?.tailwindcss) || '—')}

## الحجم
| البند | العدد |
| --- | --- |
${line('مسارات التطبيق', routes.length)}
${line('مسارات عامة (بلا الإدارة)', publicRoutes.length)}
${line('صفحات src/pages', countFiles('src/pages', /\.tsx$/))}
${line('مكوّنات الإدارة', countFiles('src/components/admin', /\.tsx$/))}
${line('مكوّنات عامة', countFiles('src/components', /\.tsx$/))}
${line('مكتبات src/lib', countFiles('src/lib', /\.(ts|tsx|mjs)$/))}
${line('أوامر npm', scripts.length)}
${line('أوامر اختبار/حراسة', testCommands.length)}

## المحتوى الثابت
| البند | العدد |
| --- | --- |
${line('الكتب', countExportedArray('books'))}
${line('الأبحاث', papers)}
${line('المقالات (بذرة ثابتة)', countExportedArray('articles'))}
${line('الظهور الإعلامي (بذرة ثابتة)', countExportedArray('media', 'title'))}
${line('اللقاءات', upcomingEvents === null ? 'ديناميكي من Firestore' : upcomingEvents)}
${line('فيديوهات الموسوعة', videos)}
${line('تفريغات زمنية محفوظة', transcribed)}

## ما لا يُجمَّد هنا
المقالات المنشورة، الحلقات الصوتية، الرسائل، وأحداث التحليلات — مصدرها Firestore
وتتغيّر بلا نشرٍ جديد. تجميدها في ملفٍ ثابت يجعل التوثيق كاذباً بعد يومٍ واحد،
فتُذكر طبيعتها ولا يُذكر رقمها.
`

writeFileSync(at('PROJECT-STATUS.md'), status)
console.log(`✓ PROJECT-STATUS.md — React ${reactMajor} · ${routes.length} مساراً · ${countFiles('src/components/admin', /\.tsx$/)} مكوّن إدارة · ${testCommands.length} أمر اختبار`)
if (nodeConflicts.length) console.warn(`⚠︎ تعارض إصدار Node بين package.json وworkflows: ${nodeConflicts.join('، ')}`)
