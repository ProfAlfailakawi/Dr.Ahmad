#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const fail = (m) => errors.push(m)
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const expect = (ok, m) => { if (!ok) fail(m) }

for (const asset of ['files/cv.pdf', 'files/cv-en.pdf', 'files/digital-education.pdf']) {
  expect(existsSync(resolve(ROOT, asset)), `الملف المنقول مفقود: ${asset}`)
}

/* النسخة الجذرية القديمة data.ts أُزيلت نهائياً من المستودع — غيابها أقوى
   صور التقاعد، فلا يُدقق إلا الموجود. src/data.ts يبقى إلزامياً. */
expect(existsSync(resolve(ROOT, 'src/data.ts')), 'src/data.ts مفقود — مصدر البيانات الأساسي')
for (const dataFile of ['src/data.ts', 'data.ts'].filter((p) => existsSync(resolve(ROOT, p)))) {
  const text = read(dataFile)
  expect(!/https:\/\/dr-alfailakawi\.com\/(?:signature_articles|scholarly_contributi)\//i.test(text), `${dataFile} ما زال يحتوي رابط محتوى للموقع السابق`)
  expect(/cvEn:\s*'\/files\/cv-en\.pdf'/.test(text), `${dataFile} لا يربط السيرة الإنجليزية الجديدة`)
  const articleUrls = [...text.matchAll(/\{\s*slug:\s*'([^']+)'[\s\S]*?\burl:\s*'([^']*)'/g)]
    .filter((m) => text.indexOf(m[0]) >= text.indexOf('export const articles = ['))
  expect(!articleUrls.some((m) => /signature_articles|scholarly_contributi|wp-content/i.test(m[2])), `${dataFile} يحتوي URL داخلياً قديماً`)
}

const importer = read('scripts/import-articles.mjs')
expect(!/fetch\s*\(|wp-json|rest_route|signature_articles/i.test(importer), 'أداة الاستيراد ما زالت قادرة على الاتصال بالموقع السابق')
expect(importer.includes('process.exit(1)'), 'أداة الاستيراد القديمة ليست مقفلة')

const hosting = JSON.parse(read('firebase.json'))
expect(hosting.hosting?.trailingSlash === false, 'يجب توحيد المسارات دون شرطة نهائية')
const redirects = hosting.hosting?.redirects || []
const pairs = redirects.map((x) => `${x.source || x.regex} -> ${x.destination}`)
for (const required of [
  '/wp-content/uploads/2025/08/Resume-Prof.-Ahmad-Eng-1.pdf -> /files/cv-en.pdf',
  '/wp-content/uploads/2025/08/Resume-Prof.-Ahmad-Arabic-1.pdf -> /files/cv.pdf',
  '/wp-content/uploads/2025/07/01-Digital-education-Inside.pdf -> /files/digital-education.pdf',
  '/signature_articles/:slug -> /articles/:slug',
  '/en/signature_articles/we-prepare-our-children-for-success-and-leave-them-empty-handed -> /articles/we-prepare-our-children-for-success-and-leave-them-empty-handed-2',
  '/signature_articles/عقول-الطلاب-في-إجازةوchatgpt-يشتغل-بدوام-ك -> /articles/students-minds-are-on-vacation-while-chatgpt-works-full-time-2',
  '/books/:slug -> /publications/:slug',
  '/ai_summary_corner{,/**} -> /curated',
  '/events/calendar{,/**} -> /upcoming',
  '/en/category{,/**} -> /articles',
  '/en/tag{,/**} -> /search',
  '/wp-sitemap.xml -> /sitemap.xml',
  '/sitemap_index.xml -> /sitemap.xml',
]) expect(pairs.includes(required), `تحويل 301 مفقود: ${required}`)

const redirectIndex = (source) => redirects.findIndex((x) => x.source === source)
expect(
  redirectIndex('/en/category/tool_of_the_week{,/**}') >= 0
    && redirectIndex('/en/category/tool_of_the_week{,/**}') < redirectIndex('/en/category{,/**}'),
  'تحويل أداة الأسبوع يجب أن يسبق تحويل التصنيفات الإنجليزية العام',
)
expect(
  redirectIndex('/en/signature_articles/we-prepare-our-children-for-success-and-leave-them-empty-handed') >= 0
    && redirectIndex('/en/signature_articles/we-prepare-our-children-for-success-and-leave-them-empty-handed') < redirectIndex('/en/signature_articles/:slug'),
  'تحويل slug المقال الإنجليزي القديم يجب أن يسبق التحويل العام',
)

const regexPairs = redirects.map((x) => `${x.regex || ''} -> ${x.destination}`)
const rewrites = hosting.hosting?.rewrites || []
expect(rewrites.some((x) => x.source === '/scholarly_contributi/**' && x.destination === '/index.html'), 'جسر روابط الأبحاث القديمة إلى محلل المسارات مفقود')
expect(regexPairs.some((x) => x.includes('curated-insights/') && x.endsWith(' -> /inbox')), 'تحويل From My Inbox المتداخل مفقود')
expect(regexPairs.some((x) => x.includes('reading-room|watch-listen') && x.endsWith(' -> /curated')), 'تحويل أقسام WordPress المتداخلة إلى المختارات مفقود')

for (const runtime of ['index.html', 'server.mjs', 'src/data.ts', 'data.ts'].filter((p) => existsSync(resolve(ROOT, p)))) {
  expect(!read(runtime).includes('208.115.236.10'), `${runtime} ما زال يعتمد عنوان الخادم القديم`)
}

function walk(dir) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = resolve(dir, name)
    const st = statSync(p)
    st.isDirectory() ? out.push(...walk(p)) : out.push(p)
  }
  return out
}

const dist = resolve(ROOT, 'dist')
if (existsSync(dist)) {
  for (const p of walk(dist).filter((x) => /\.(?:html?|js|json|xml|txt)$/i.test(x))) {
    const text = readFileSync(p, 'utf8')
    if (/wp-json|wp-admin|wp-login\.php|xmlrpc\.php|208\.115\.236\.10/i.test(text)) {
      fail(`${relative(ROOT, p)} يحتوي اعتماداً منشوراً من النظام السابق`)
    }
  }
  for (const asset of ['files/cv.pdf', 'files/cv-en.pdf', 'files/digital-education.pdf']) {
    expect(existsSync(resolve(dist, asset)), `مخرجات البناء لا تحتوي الملف المنقول: dist/${asset}`)
  }
}

if (errors.length) {
  console.error(`✘ فشل فحص إغلاق الموقع السابق (${errors.length})`)
  for (const e of [...new Set(errors)]) console.error(`  - ${e}`)
  process.exit(1)
}
console.log('✔ لا يوجد اتصال حي أو اعتماد مخفي على الموقع السابق')
console.log('✔ المحتوى المهم والملفات المعروفة مرتبطة بالموقع الجديد')
console.log('✔ مسارات المحتوى القديمة مغطاة بتحويلات 301 وجسر حلّ ذكي للأبحاث القديمة')
