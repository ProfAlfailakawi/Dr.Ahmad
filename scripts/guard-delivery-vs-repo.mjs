#!/usr/bin/env node
/**
 * حارس الدهس — يمنع تسليم حزمةٍ تمحو عمل جلسةٍ أخرى
 *
 * في ١ أغسطس ٢٠٢٦ سُلّمت حزمةٌ بُنيت من نسخة المجلد على جهاز الدكتور، وكانت
 * أقدم من المستودع بخمسة commits. رفعُها محا منصّة Facebook وتتبّع المراجعات
 * ودالّة `seasonIdentityFor` وتفضيل `familySignature` وتبويب المنشورات
 * المباشرة — خمسة ملفاتٍ نقصت ٥٢ ألف بايت. ولم ينبّه أحد: المجلد ليس مستودع
 * git، فالنقصان صامتٌ تماماً، ولا يظهر إلا في الـgate بعد الرفع.
 *
 * هذا الحارس يجعل ذلك النقصان صاخباً قبل الرفع، بثلاثة فحوص:
 *
 *  ١ ــ **الحجم.** ملفٌ أصغر من نظيره في المستودع = دهسٌ حتى يُثبت العكس.
 *  ٢ ــ **الرموز المصدَّرة.** أقوى من الحجم: `export` موجودٌ في المستودع وغائبٌ
 *      عندك يعني أنك حذفت واجهةً يعتمد عليها ملفٌ آخر — وهذا بالضبط ما كسر
 *      الـgate (`seasonIdentityFor` و`familySignature`).
 *  ٣ ــ **التوقيت.** ملفٌ تغيّر في المستودع بعد آخر تعديلٍ لنسختك = نسختك
 *      أقدم، فراجعها قبل التسليم.
 *
 * التشغيل:
 *   node scripts/guard-delivery-vs-repo.mjs src/lib/a.ts src/components/b.tsx
 *   node scripts/guard-delivery-vs-repo.mjs --list ملفات.txt
 *   node scripts/guard-delivery-vs-repo.mjs --allow-shrink src/lib/a.ts   (حذفٌ مقصود)
 *
 * يخرج بـ1 عند أي شبهة دهس. ولا يحتاج git — يقرأ من GitHub مباشرة.
 */
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const REPO = process.env.DELIVERY_GUARD_REPO || 'ProfAlfailakawi/Dr.Ahmad'
const BRANCH = process.env.DELIVERY_GUARD_BRANCH || 'main'

const args = process.argv.slice(2)
const allowShrink = args.includes('--allow-shrink')
const quiet = args.includes('--quiet')
const listFlag = args.indexOf('--list')
let files = args.filter((item) => !item.startsWith('--'))
if (listFlag >= 0) {
  const listPath = args[listFlag + 1]
  if (!listPath) { console.error('استعمال: --list <ملف يحوي مساراً في كل سطر>'); process.exit(2) }
  files = (await readFile(resolve(listPath), 'utf8')).split('\n').map((line) => line.trim()).filter(Boolean)
  files = files.filter((item) => !item.startsWith('--'))
}
if (!files.length) {
  console.error('استعمال: node scripts/guard-delivery-vs-repo.mjs <ملف> [ملف…]')
  process.exit(2)
}

/** يجلب الملف من المستودع: gh أولاً (يعمل مع الخاص)، ثم raw للعام. */
async function fetchRepoFile(path) {
  try {
    const { stdout } = await run('gh', ['api', `repos/${REPO}/contents/${path}?ref=${BRANCH}`, '--jq', '.content'], { maxBuffer: 64 * 1024 * 1024 })
    const content = Buffer.from(stdout.replace(/\s/g, ''), 'base64').toString('utf8')
    return content || null
  } catch { /* لا gh أو الملف جديد — نجرّب raw */ }
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`)
    if (!response.ok) return null
    return await response.text()
  } catch { return null }
}

/** آخر تعديلٍ للملف في المستودع (ISO) — لكشف النسخة الأقدم. */
async function fetchLastCommitDate(path) {
  try {
    const { stdout } = await run('gh', ['api', `repos/${REPO}/commits?path=${encodeURIComponent(path)}&sha=${BRANCH}&per_page=1`, '--jq', '.[0].commit.author.date'])
    return stdout.trim() || null
  } catch { return null }
}

/* أسماءُ ما يُصدَّر: تكفي لكشف حذف واجهةٍ يعتمد عليها ملفٌ آخر، بلا محلّل كامل. */
const EXPORT_PATTERNS = [
  /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  /export\s+(?:interface|type|class|enum)\s+([A-Za-z_$][\w$]*)/g,
]

function exportedSymbols(source) {
  const names = new Set()
  for (const pattern of EXPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) names.add(match[1])
  }
  /* export { a, b as c } — الاسم المعروض هو ما يستورده الآخرون. */
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return names
}

const problems = []
const notes = []
const say = (line) => { if (!quiet) console.log(line) }

say(`حارس الدهس — ${files.length} ملفاً مقابل ${REPO}@${BRANCH}\n`)

for (const file of files) {
  let localSource
  let localMtime
  try {
    localSource = await readFile(resolve(file), 'utf8')
    localMtime = (await stat(resolve(file))).mtime
  } catch {
    problems.push(`${file}: غير موجودٍ محلياً`)
    continue
  }
  const repoSource = await fetchRepoFile(file)
  if (repoSource == null) {
    say(`  ✅ ${file.padEnd(50)} جديدٌ في المستودع (لا مقارنة)`)
    continue
  }

  const localBytes = Buffer.byteLength(localSource, 'utf8')
  const repoBytes = Buffer.byteLength(repoSource, 'utf8')
  const delta = localBytes - repoBytes

  /* المحتوى المتطابق يُنهي الفحص فوراً: رفعُ حزمتك يجعل الـcommit أحدث من
     زمن ملفك المحلي، وذلك إنذارٌ كاذب لا دهس. **القِدَم لا يضرّ إلا مع
     اختلافٍ في المحتوى** — وهذا ما ميّز حالتك عن حالة الدهس الحقيقية. */
  if (localSource === repoSource) {
    say(`  ✅ ${file.padEnd(50)} مطابقٌ للمستودع`)
    continue
  }

  const missing = [...exportedSymbols(repoSource)].filter((name) => !exportedSymbols(localSource).has(name))
  const repoDate = await fetchLastCommitDate(file)
  const staleBy = repoDate && localMtime && Date.parse(repoDate) > localMtime.getTime()
    ? Math.round((Date.parse(repoDate) - localMtime.getTime()) / 60000)
    : 0

  const flags = []
  if (delta < 0 && !allowShrink) flags.push(`نقص ${Math.abs(delta)} بايت`)
  if (missing.length) flags.push(`فُقدت تصديرات: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`)
  if (staleBy > 0) flags.push(`المستودع تغيّر بعد نسختك بـ${staleBy} دقيقة والمحتوى مختلف`)

  if (flags.length) {
    problems.push(`${file}: ${flags.join(' · ')}`)
    say(`  ❌ ${file.padEnd(50)} ${flags.join(' · ')}`)
  } else {
    if (delta < 0) notes.push(`${file}: نقص ${Math.abs(delta)} بايت (مسموحٌ بأمرك)`)
    say(`  ✅ ${file.padEnd(50)} ${repoBytes} → ${localBytes} (${delta >= 0 ? '+' : ''}${delta})`)
  }
}

if (notes.length) { say(''); for (const note of notes) say(`  ⚠️  ${note}`) }

if (problems.length) {
  console.error(`\n✗ أوقفتُ التسليم — ${problems.length} شبهة دهس:`)
  for (const problem of problems) console.error(`   • ${problem}`)
  console.error('\nالعلاج: اجلب الملف من المستودع وطبّق رقعتك فوقه، لا العكس.')
  console.error('وإن كان النقص مقصوداً (حذفٌ متعمَّد) فمرّر ‎--allow-shrink‎.')
  process.exit(1)
}

say(`\n✓ لا دهس — ${files.length} ملفاً آمنة للتسليم.`)
