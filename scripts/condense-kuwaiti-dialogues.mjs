#!/usr/bin/env node
/**
 * مصنع تكثيف الحوارات الكويتية — من الحلقة الكاملة إلى دقيقتين ونصف.
 *
 * قرار الدكتور (٢٢ أغسطس ٢٠٢٦): «النصوص الآن نبدلها بالكامل وليس توليد» —
 * القالب القصير هو الأجمل للناس (بوابة للمقال لا بديلاً عنه) والأسلم
 * للمحرك (ينتهي قبل أفق الانجراف المقيس ~دقيقتين).
 *
 * العقد الصارم:
 *  - لا سطر يُكتب من عندي: الانتقاء من مداخلات الدكتور المدققة حرفياً.
 *    التدخل الوحيد المسموح: نزع واو عطف يتيمة أول مداخلة سبقها حذف —
 *    ويُسجل في التقرير.
 *  - البنية تُحفظ: مشهد الافتتاح → السؤال المحوري → دليل → اعتراض ورد →
 *    قلب → خاتمة وإحالة. وجسر موسيقي واحد قرب المنتصف.
 *  - كل حلقة مكثفة تعبر بوابة اللهجة نفسها (≥15 مداخلة، كثافة كويتية،
 *    لا فصحى محرمة) وإلا وُسمت للمراجعة اليدوية.
 *  - الناتج ملف موازٍ (kuwaiti-dialogues-short.json) — البذرة الأصلية
 *    لا تُمس حتى يعتمد الدكتور العينات ويقول «بدّل».
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const SEC_PER_CHAR = 0.083           /* مقيسة من الحلقة المعتمدة: ~2900 حرفاً في ~240ث كلام */
const TARGET_SEC = 150               /* دقيقتان ونصف */
const MIN_TURNS = 15                 /* حد بوابة verify-kuwaiti-dialogues */
const MAX_TURNS = 28

const EVIDENCE = /دراسة|بحث|تقرير|بالمئة|بالمية|جامعة|منظمة|مجلة|إحصائ|أرقام|نسبة/
const KW_MARKERS = ['مو','هني','شنو','شلون','الحين','وايد','ماكو','تبي','ترى','إي','بس','قاعد','هال','ليش','وين','إحنا','عشان','جذي','راح','نبي','نقدر','اللي']

const durOf = (t) => String(t.text || '').length * SEC_PER_CHAR + (Number(t.pauseAfterMs) || 560) / 1000

export function condenseEpisode(turns) {
  const n = turns.length
  const flags = []
  const picked = new Set()
  const pick = (i) => { if (i >= 0 && i < n) picked.add(i) }

  /* ١) مشهد الافتتاح: من البداية حتى أول سؤال (بحد ٥ مداخلات) —
     «البداية دايماً روووعة» بشهادة الدكتور، فتُحفظ كاملة. */
  let firstQ = turns.findIndex((t) => t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text)))
  if (firstQ < 0 || firstQ > 5) firstQ = Math.min(5, n - 1)
  for (let i = 0; i <= firstQ; i += 1) pick(i)

  /* ٢) السؤال المحوري: أول سؤالٍ بعد الافتتاح وجوابه المباشر. */
  const pivot = turns.findIndex((t, i) => i > firstQ && (t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text))))
  if (pivot > 0) { pick(pivot); pick(pivot + 1) }

  /* ٣) الدليل: أول مداخلة دليلٍ علمي (وثانية إن اتسع الوقت لاحقاً). */
  const evidence = turns.map((t, i) => ({ i, t })).filter(({ t, i }) => i > firstQ && EVIDENCE.test(String(t.text)))
  if (evidence.length) pick(evidence[0].i)

  /* ٤) الاعتراض ورده — القسم الذي «يعطي الحوار صدقه» بحكم الدكتور. */
  const obj = turns.findIndex((t) => ['gentleObjection', 'objection'].includes(t.deliveryType))
  if (obj > 0) { pick(obj); pick(obj + 1) }

  /* ٥) القلب: تأمل أو تأكيد في الثلث الأخير قبل الخاتمة. */
  const flip = turns.map((t, i) => ({ i, t }))
    .filter(({ i, t }) => i > n * 0.55 && i < n - 3 && ['reflection', 'emphasis'].includes(t.deliveryType))
  if (flip.length) pick(flip[flip.length - 1].i)

  /* ٦) الخاتمة والإحالة: آخر ثلاث مداخلات — وإن كانت مداخلة الإحالة
     (تلقى المقال في موقع الدكتور) أبعد من ذلك تُلتقط هي وما بعدها،
     فلا تفقد أي حلقة إحالتها (وقعت مرة واحدة في 144). */
  let refIdx = -1
  for (let i = n - 1; i >= Math.max(0, n - 6); i -= 1) {
    if (/المقال|موقع الدكتور|الفيل/.test(String(turns[i].text))) { refIdx = i; break }
  }
  const tailStart = refIdx >= 0 ? Math.min(refIdx, n - 3) : n - 3
  for (let i = Math.max(0, tailStart); i < n; i += 1) pick(i)

  /* ٧) ملء الميزانية حتى الهدف: أقرب المداخلات للمنتقى (سياقاً) أولاً. */
  const budget = () => [...picked].reduce((s, i) => s + durOf(turns[i]), 0)
  let guard = 0
  while (budget() < TARGET_SEC - 8 && picked.size < MAX_TURNS && guard++ < n) {
    let best = -1; let bestScore = -1
    for (let i = 0; i < n; i += 1) {
      if (picked.has(i)) continue
      const near = (picked.has(i - 1) ? 2 : 0) + (picked.has(i + 1) ? 2 : 0)
      const typeBonus = t2s(turns[i].deliveryType)
      const score = near + typeBonus - (turns[i].deliveryType === 'briefReaction' ? 1 : 0)
      if (score > bestScore) { bestScore = score; best = i }
    }
    if (best < 0) break
    pick(best)
  }
  function t2s (dt) { return { reflection: 2, emphasis: 2, question: 1, statement: 1, briefReaction: 0, conclusion: 0 }[dt] ?? 1 }

  /* ٨) والعكس: إن فاضت الميزانية تُنزع أقل المداخلات مركزيةً (لا افتتاح ولا خاتمة). */
  while ((budget() > TARGET_SEC + 15 || picked.size > MAX_TURNS) && picked.size > MIN_TURNS) {
    const removable = [...picked].filter((i) => i > firstQ && i < n - 3 && i !== pivot)
      .sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
    if (!removable.length) break
    picked.delete(removable[0])
  }

  /* ٩) التجميع + إصلاح الواو اليتيمة + الجسر الواحد. */
  const idx = [...picked].sort((a, b) => a - b)
  const out = idx.map((i) => ({ ...turns[i] }))
  idx.forEach((orig, k) => {
    if (k > 0 && idx[k - 1] !== orig - 1) {
      const txt = String(out[k].text)
      if (/^و[^ا]/.test(txt)) { out[k].text = txt.slice(1); flags.push(`واو يتيمة نُزعت في مداخلة ${orig}`) }
      else if (/^(بس |يعني |عشان جذي|ولهذا|فهني)/.test(txt)) flags.push(`رابط بعد قطع في مداخلة ${orig} — راجع السياق`)
      if (/هالشي|هذا اللي|هاللي/.test(txt.slice(0, 20)) && k > 0) flags.push(`إشارة بعد قطع في مداخلة ${orig} — راجع المرجع`)
    }
  })
  let acc = 0; let bridgeAt = -1
  const total = out.reduce((s, t) => s + durOf(t), 0)
  out.forEach((t, k) => { t.musicBridgeAfter = false; acc += durOf(t); if (bridgeAt < 0 && acc >= total * 0.48 && k < out.length - 3) bridgeAt = k })
  if (bridgeAt > 0) out[bridgeAt].musicBridgeAfter = true

  /* ١٠) بوابة اللهجة على المكثف. */
  const text = out.map((t) => t.text).join(' ')
  const hits = KW_MARKERS.reduce((s, m) => s + text.split(m).length - 1, 0)
  if (hits / out.length < 0.22) flags.push('كثافة كويتية دون العتبة — مراجعة يدوية')
  if (out.length < MIN_TURNS) flags.push('أقل من ١٥ مداخلة')
  if (new Set(out.map((t) => t.speaker)).size < 2) flags.push('متحدث واحد!')
  if (!/الفيل|موقع الدكتور/.test(String(out[out.length - 1].text))) flags.push('الخاتمة بلا إحالة الموقع — راجع')

  return { turns: out, flags, estSec: Math.round(total), kept: out.length, from: n }
}

if (SELF_TEST) {
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  const pilot = Object.values(lib.episodes['success-that-does-not-bring-joy-to-its-ownerarabic'])
  const r = condenseEpisode(pilot)
  assert.ok(r.kept >= MIN_TURNS && r.kept <= MAX_TURNS, `عدد المداخلات ${r.kept} خارج [15,28]`)
  assert.ok(r.estSec >= 120 && r.estSec <= 180, `المدة المقدرة ${r.estSec} خارج [120,180]`)
  assert.equal(r.turns[0].text, pilot[0].text, 'الافتتاح محفوظ حرفياً')
  assert.ok(/الفيل/.test(r.turns[r.kept - 1].text), 'الإحالة الختامية محفوظة')
  assert.equal(r.turns.filter((t) => t.musicBridgeAfter).length, 1, 'جسر واحد بالضبط')
  const src = new Set(pilot.map((t) => t.text))
  assert.ok(r.turns.every((t) => src.has(t.text) || src.has('و' + t.text)), 'كل سطرٍ من متن الدكتور حرفياً (عدا واو منزوعة)')
  console.log(`✓ مصنع التكثيف: التجربة ${r.from}→${r.kept} مداخلة · ~${r.estSec}ث · جسر واحد · كل السطور أصلية`)
  process.exit(0)
}

const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
const short = { schemaVersion: lib.schemaVersion, profile: lib.profile, count: 0, pilotSlug: lib.pilotSlug, note: 'نسخة الدقيقتين والنصف — مكثفة من نصوص الدكتور المدققة حرفياً (٢٢ أغسطس ٢٠٢٦)؛ الأصل الكامل محفوظ في kuwaiti-dialogues.json', episodes: {}, review: lib.review }
const report = []
for (const [slug, ep] of Object.entries(lib.episodes)) {
  const r = condenseEpisode(Object.values(ep))
  short.episodes[slug] = Object.fromEntries(r.turns.map((t, i) => [String(i), t]))
  report.push({ slug, from: r.from, kept: r.kept, estSec: r.estSec, flags: r.flags })
}
short.count = Object.keys(short.episodes).length
writeFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json'), JSON.stringify(short, null, 1) + '\n')
writeFileSync(resolve(ROOT, 'podcast-audits/condense-report.json'), JSON.stringify(report, null, 1) + '\n')
const flagged = report.filter((r) => r.flags.length)
console.log(`✓ كُثفت ${short.count} حلقة → kuwaiti-dialogues-short.json`)
console.log(`  متوسط: ${Math.round(report.reduce((s, r) => s + r.estSec, 0) / report.length)}ث · موسومة للمراجعة: ${flagged.length}`)
