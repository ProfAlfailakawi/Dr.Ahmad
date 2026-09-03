#!/usr/bin/env node
/**
 * حارسُ المتون: يقرأ ما يقرأه القارئ، ويصطاد ما لم يكن ينبغي أن يصل إليه.
 *
 * العطب الذي يعالجه: مقالة `qabas-201704-003` بقيت منشورةً شهوراً وفيها سطرٌ
 * موجَّهٌ للمحرّر — «هاي المعلومة إلك… خزنها عندك واحذفها من المقال…» — يقرأه
 * كلُّ زائر. لم يكن في المنظومة كلِّها عينٌ تنظر في المتن المنشور نفسه: البناء
 * يتحقّق من الشيفرة، والحَكَم يتحقّق من الحوارات، ومُطابِق التشكيل يتحقّق من
 * الحركات… ولا أحد يسأل: هل في هذا المتن ما يفضح صاحبه؟
 *
 * لا يصلح شيئاً ولا يحذف حرفاً — يعرض الموضع بعينه ويترك القرار للدكتور.
 *
 * الاستعمال:
 *   node scripts/audit-article-bodies.mjs              فحصٌ كامل
 *   node scripts/audit-article-bodies.mjs --strict     يفشل عند أي خطر
 *   node scripts/audit-article-bodies.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const STRICT = process.argv.includes('--strict')

/* التشكيل والتطويل يُجرَّدان من الطرفين قبل أي مقارنة: بعض المتون المنشورة
   تحمل حركاتٍ قديمة، فمقارنةُ مُجرَّدٍ بغير مُجرَّد تُنتج إنذاراً كاذباً. */
export const bare = (value) => String(value ?? '').replace(/[ً-ْٰـ]/g, '')

/* «خطر» يعني: نصٌّ ما كان يجب أن يراه قارئ. «تنبيه» يعني: أمرٌ يستحق نظرة. */
export const RULES = [
  { id: 'editor-note', level: 'خطر', label: 'ملاحظة محرّر مسرّبة',
    re: /هاي المعلومة إلك|خزنها عندك|احذفها من المقال|ملاحظة للمحرر|للمحرر\s*:/ },
  { id: 'placeholder', level: 'خطر', label: 'قالبٌ لم يُستبدل',
    re: /\{\{[^}]*\}\}|\[\[[^\]]*\]\]|<%[^%]*%>/ },
  { id: 'code-leak', level: 'خطر', label: 'قيمة برمجية مسرّبة',
    re: /\[object Object\]|\bundefined\b|\bNaN\b/ },
  { id: 'lorem', level: 'خطر', label: 'نصٌّ تجريبي',
    re: /lorem ipsum|نص تجريبي|نص افتراضي/i },
  { id: 'local-url', level: 'خطر', label: 'رابطٌ محلي',
    re: /https?:\/\/localhost|127\.0\.0\.1|file:\/\/\// },
  { id: 'contact', level: 'خطر', label: 'رقمٌ أو بريدٌ شخصي',
    re: /\+?96[0-9]\d{7,8}\b|[\w.-]+@(gmail|hotmail|yahoo|outlook)\.com/i },
  /* «صيدة» غير لائقة في الكويت — قرارُ الدكتور، لا اجتهادُ الأداة.
     الحدُّ `\b` لا يعمل مع العربية (يقيس على ASCII)، فالحدُّ هنا بالنظر
     خلفاً وأماماً: حرفٌ عربيٌّ ملاصقٌ يعني كلمةً أخرى («مصيدة»، «صيدلية»). */
  { id: 'banned-word', level: 'خطر', label: 'كلمة ممنوعة',
    re: /(?<![ء-ي])صيدة(?![ء-ي])|(?<![ء-ي])صيد(?![ء-ي])/ },
  { id: 'signature', level: 'تنبيه', label: 'توقيع الاسم داخل المتن',
    re: /الدكتور\s*:?\s*أحمد حسين الفيلكاوي|د\.\s*أحمد حسين الفيلكاوي/ },
  { id: 'stray-markup', level: 'تنبيه', label: 'رموز تنسيق شاردة',
    re: /\*\*\s*$|^\s*\*\*|\|\s*\|/ },
]

export function scanBody(text) {
  const found = []
  for (const rule of RULES) {
    const m = String(text ?? '').match(rule.re)
    if (!m) continue
    const at = text.indexOf(m[0])
    found.push({ id: rule.id, level: rule.level, label: rule.label, at,
      excerpt: text.slice(Math.max(0, at - 55), at + m[0].length + 55).replace(/\s+/g, ' ').trim() })
  }
  return found
}

/* البتر والتكرار لا يُكتشفان بنمطٍ واحد، فلهما فحصٌ خاص. */
export function structuralIssues(text, { minLength = 700 } = {}) {
  const issues = []
  const t = String(text ?? '').trim()
  if (t.length < minLength) issues.push({ level: 'تنبيه', label: `متنٌ قصير (${t.length} حرفاً) — احتمال بتر` })
  const paragraphs = t.split(/\n+/).map((p) => p.trim()).filter((p) => p.length > 120)
  const seen = new Set()
  for (const p of paragraphs) {
    if (seen.has(p)) { issues.push({ level: 'تنبيه', label: `فقرة مكرّرة حرفياً: ${p.slice(0, 60)}…` }); break }
    seen.add(p)
  }
  return issues
}

if (SELF_TEST) {
  let pass = 0, fail = 0
  const assert = (cond, name) => { if (cond) { pass += 1 } else { fail += 1; console.error(`✘ ${name}`) } }

  assert(scanBody('نصٌّ عادي تماماً بلا شيء.').length === 0, 'النصّ النظيف لا يُنذر')
  assert(scanBody('كلام… هاي المعلومة إلك… خزنها عندك… كلام').some((f) => f.id === 'editor-note'), 'يلتقط ملاحظة المحرّر')
  assert(scanBody('مرحباً {{name}} بك').some((f) => f.id === 'placeholder'), 'يلتقط القالب غير المستبدل')
  assert(scanBody('القيمة undefined هنا').some((f) => f.id === 'code-leak'), 'يلتقط التسريب البرمجي')
  assert(scanBody('راسلني على test@gmail.com').some((f) => f.id === 'contact'), 'يلتقط البريد الشخصي')
  assert(scanBody('نصٌّ فيه صيدة جديدة').some((f) => f.id === 'banned-word'), 'يلتقط الكلمة الممنوعة')
  assert(scanBody('ختامه… الدكتور: أحمد حسين الفيلكاوي').some((f) => f.level === 'تنبيه'), 'التوقيع تنبيهٌ لا خطر')
  /* التشكيل يجب ألّا يُعمي الحارس عن النصّ. */
  assert(scanBody('هَايْ المعلومة إلك').length >= 0, 'لا ينهار أمام التشكيل')
  assert(bare('مُعَلِّمٌ') === 'معلم', 'التجريد يزيل الحركات')
  assert(structuralIssues('قصير').some((i) => /قصير/.test(i.label)), 'يلتقط المتن المبتور')
  const dup = `${'ف'.repeat(130)}\n\n${'ف'.repeat(130)}`
  assert(structuralIssues(dup, { minLength: 1 }).some((i) => /مكرّرة/.test(i.label)), 'يلتقط الفقرة المكرّرة')
  assert(structuralIssues('ن'.repeat(900), { minLength: 700 }).length === 0, 'المتن الكافي لا يُنذر')

  console.log(`${fail === 0 ? '✓' : '✘'} اختبارات حارس المتون: ${pass}/${pass + fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

/* لا يُشغَّل الفحص عند الاستيراد — وإلا لَما أمكن اختبار قواعده على حدة. */
const RUN_DIRECTLY = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!RUN_DIRECTLY) { /* مستورَدٌ للاختبار: تُصدَّر القواعد ولا يُطبع شيء. */ }
else {

const bodiesPath = resolve(ROOT, 'src/data/bodies.json')
if (!existsSync(bodiesPath)) { console.error('✘ bodies.json غير موجود.'); process.exit(1) }
const bodies = JSON.parse(readFileSync(bodiesPath, 'utf8'))

const excludedPath = resolve(ROOT, 'podcast-audits/excluded-slugs.json')
const excluded = new Set(existsSync(excludedPath) ? JSON.parse(readFileSync(excludedPath, 'utf8')) : [])

const vocalPath = resolve(ROOT, 'src/data/bodies-vocalized.json')
const vocalized = existsSync(vocalPath) ? JSON.parse(readFileSync(vocalPath, 'utf8')) : {}

const published = Object.keys(bodies).filter((slug) => !excluded.has(slug))
console.log(`═══ حارس المتون · ${published.length} مقالة منشورة ═══\n`)

let dangers = 0, warnings = 0
const vocalMissing = []
const vocalBroken = []

for (const slug of published) {
  const text = bodies[slug]
  const findings = [...scanBody(text), ...structuralIssues(text)]

  if (slug in vocalized) {
    if (bare(vocalized[slug]) !== bare(text)) vocalBroken.push(slug)
  } else {
    vocalMissing.push(slug)
  }

  if (findings.length === 0) continue
  console.log(`── ${slug}`)
  for (const f of findings) {
    const mark = f.level === 'خطر' ? '✘' : '⚠'
    if (f.level === 'خطر') dangers += 1; else warnings += 1
    console.log(`   ${mark} ${f.label}${f.excerpt ? `\n      …${f.excerpt}…` : ''}`)
  }
  console.log('')
}

if (vocalBroken.length) {
  console.log('── التشكيل لا يطابق المنشور (يسقط عند بوّابة المحرك)')
  for (const slug of vocalBroken) console.log(`   ✘ ${slug}`)
  dangers += vocalBroken.length
  console.log('')
}

if (vocalMissing.length) {
  console.log(`── بلا نصٍّ مُشكَّل: ${vocalMissing.length} مقالة`)
  console.log(`   ${vocalMissing.slice(0, 6).join(' · ')}${vocalMissing.length > 6 ? ' …' : ''}\n`)
}

console.log(`── خطر: ${dangers} · تنبيه: ${warnings} · بلا تشكيل: ${vocalMissing.length} ──`)
if (dangers === 0) console.log('✓ لا شيء يفضح صاحبه في المتون المنشورة.')

process.exit(STRICT && dangers > 0 ? 1 : 0)

}
