#!/usr/bin/env node
/**
 * يمنع قِدَم التوثيق.
 *
 * الفكرة: التوثيق الكاذب أسوأ من غيابه — «React 18» في README تُضلّل مطوراً
 * وأداةَ ذكاءٍ اصطناعيّ معاً. فما يمكن توليده لا يُكتب يدوياً، وما يُكتب يُقاس.
 *
 * والتمييز مقصود: البيانات **الثابتة** تُقاس بدقّة، والبيانات **الديناميكية**
 * (مقالات Firestore، الحلقات، الرسائل) لا يُكسر البناء لتغيّر عددها.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const at = (path) => resolve(ROOT, path)
const has = (path) => existsSync(at(path))
const read = (path) => readFileSync(at(path), 'utf8')

const failures = []
const check = (ok, message) => { if (!ok) failures.push(message) }

const pkg = JSON.parse(read('package.json'))
const readme = read('README.md')
const architecture = has('ARCHITECTURE.md') ? read('ARCHITECTURE.md') : ''
const major = (value) => String(value || '').replace(/^[\^~]/, '').split('.')[0]

/* ١) إصدار React المذكور يطابق الحقيقي */
const reactMajor = major(pkg.dependencies?.react)
const reactMentions = [...readme.matchAll(/React\s+(\d+)/g)].map((match) => match[1])
check(reactMentions.length > 0, 'README لا يذكر إصدار React إطلاقاً')
for (const mention of reactMentions) {
  check(mention === reactMajor, `README يذكر React ${mention} والمشروع على React ${reactMajor}`)
}

/* ٢) إصدار Node متّسق بين package.json و.nvmrc وworkflows وREADME */
const engine = String(pkg.engines?.node || '')
const engineMajor = engine.match(/(\d+)/)?.[1] || ''
check(Boolean(engineMajor), 'package.json بلا engines.node')
if (has('.nvmrc')) {
  check(read('.nvmrc').trim().startsWith(engineMajor), `.nvmrc لا يطابق engines.node (${engine})`)
}
if (has('.github/workflows')) {
  for (const file of readdirSync(at('.github/workflows'))) {
    for (const match of read(`.github/workflows/${file}`).matchAll(/node-version:\s*'?"?(\d+)/g)) {
      check(match[1] === engineMajor, `${file} يستخدم Node ${match[1]} وengines.node يطلب ${engine}`)
    }
  }
}
check(readme.includes(engine), `README لا يذكر إصدار Node المطلوب (${engine})`)

/* ٣) كل أمر npm مذكور في README موجود فعلاً */
for (const match of readme.matchAll(/npm run ([a-z0-9:._-]+)/g)) {
  check(Boolean(pkg.scripts?.[match[1]]), `README يذكر أمراً غير موجود: npm run ${match[1]}`)
}

/* ٤) كل ملفٍ يشير إليه README موجود */
for (const doc of [readme, architecture]) {
  for (const match of doc.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
    const target = match[1].split('#')[0].replace(/^\.\//, '')
    if (!target) continue
    const candidates = [target, `docs/${target}`, target.replace(/^\.\.\//, '')]
    check(candidates.some(has), `مرجعٌ إلى ملفٍ غير موجود: ${target}`)
  }
}

/* ٥) لا أعدادٌ ثابتة قديمة حيث يمكن التوليد */
const staleNumbers = [...readme.matchAll(/([٠-٩\d]{2,4})\s*(صفحة|مقالاً|مقالة|رابطاً|فيديو|كتاباً|بحثاً)/g)]
for (const match of staleNumbers) {
  failures.push(`README يثبّت رقماً يمكن توليده: «${match[0].trim()}» — انقله إلى PROJECT-STATUS.md`)
}

/* ٦) الملف المولَّد موجود ومعلَّمٌ بأنه مولَّد */
check(has('PROJECT-STATUS.md'), 'PROJECT-STATUS.md مفقود — شغّل npm run project:status')
if (has('PROJECT-STATUS.md')) {
  const status = read('PROJECT-STATUS.md')
  check(/مولَّد آلياً/.test(status), 'PROJECT-STATUS.md لا يحمل تحذير «مولَّد آلياً»')
  check(new RegExp(`\\| React \\| ${reactMajor}\\.`).test(status), 'PROJECT-STATUS.md قديم — أعد توليده')
  /* البيانات الديناميكية لا تُجمَّد: تغيّر عدد مقالٍ واحد لا يجوز أن يكسر البناء. */
  check(/ديناميكي من Firestore|لا يُجمَّد/.test(status), 'PROJECT-STATUS.md لا يميّز الديناميكي من الثابت')
}

/* ٧) README يشرح ما تطلبه المواصفة */
for (const [label, pattern] of [
  ['التثبيت', /npm install/],
  ['التشغيل المحلي', /npm run dev/],
  ['البناء', /npm run build/],
  ['النشر', /deploy:hosting/],
  ['المتغيرات البيئية', /\.env\.example/],
  ['بنية المجلدات', /src\/\n?|بنية المجلدات/],
  ['الملفات المولَّدة', /لا تُحرَّر يدوياً/],
  ['الموقع العام ولوحة الإدارة', /لوحة الإدارة/],
  ['حالة المشروع', /حالة المشروع/],
]) {
  check(pattern.test(readme), `README ينقصه قسم: ${label}`)
}

/* ٨) لا أسرار في التوثيق */
check(!/AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY/.test(readme + architecture), 'التوثيق يحتوي ما يشبه سرّاً')

if (failures.length) {
  console.error('✗ التوثيق لا يطابق المشروع:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`✓ التوثيق مطابق: React ${reactMajor} · Node ${engine} · الأوامر والمراجع موجودة`)
