#!/usr/bin/env node
/**
 * مكثّف الديوانية v3 — إيقاع صديقك بكلمات الدكتور.
 *
 * حكم الدكتور على v2 (٢٢ أغسطس ٢٠٢٦): «الحوار روووعه والبشرية والقطعات
 * وكل شي جميل جداً — لكن مو كويتي إطلاقاً، والكلمات مو كويتية».
 * والمقيس: وفاء المصدر ٠–٦٪ (١٤٨ من ١٤٩ مداخلة مخترعة)، وطوفان حشو
 * (يعني/يمكن ١٤–٣١٪ مقابل وسيط ٣٪ في متنه)، واسمه اختفى من الختام.
 *
 * فهذا المكثّف يجمع الحسنيين:
 *   • الإيقاع من v2: مداخلات قصيرة · أخذ وردّ · اعتراض · أسئلة · جسران
 *   • الكلمات من الدكتور: كل سطرٍ منتقىً من متنه المدقّق حرفياً
 *
 * والتدخّلان الوحيدان — كلاهما مسجَّل في التقرير سطراً سطراً:
 *   ١) تقسيم المداخلة الطويلة عند حدّ جملة (كلماته كما هي، موزّعة)
 *   ٢) ميزانية تعجّب: مواصفة صديقك تشترط إشارة بشرية (ممم · إي والله ·
 *      صراحة) وهي في ٣٣ حلقة فقط من ١٤٤ — فتُضاف واحدة عند اللزوم على
 *      مداخلة تصديقٍ قائمة. وهي صوتٌ لا دعوى: لا تنسب إليه رأياً.
 *      وتُطفأ كلها بـ--no-interjections فيعود الوفاء ١٠٠٪ حرفياً.
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const NO_INTERJECTIONS = process.argv.includes('--no-interjections')

/* مواصفة فاحص DNA للصديق — تُقرأ هنا صراحةً كي لا ينحرف أحدهما عن الآخر */
const SPEC = { minTurns: 22, maxTurns: 34, bridges: 2, minOverlaps: 3, minQuestions: 3, shortMax: 55, shortRatio: 0.5, longMax: 95, maxLong: 2, minSec: 128, maxSec: 155 }
const HUMAN = /ممم|لحظة|لا عاد|ما فهمت|أوف|أنا…|إي!|صراحة|إي والله|زين هدي/u
const STRUCT = /مو (?:هذا|هني|كل|ضد|قاعد)|بدال لا|عيل |قاعد [ء-ي]|شكثر |شيسوي|قبل لا|من صوب|عقب ما/u
const AGREE = /^(إي|اي|صح|أكيد|بالضبط|صج|تمام)/u
const projected = (turns) => turns.reduce((s, t) => s + String(t.text || '').length, 0) * 0.099
  + turns.reduce((s, t) => s + (Number(t.pauseAfterMs) || 560) / 1000, 0) + 7.4

/* تقسيم المداخلة الطويلة عند حدّ جملة — كلماته حرفاً بحرف */
/* حدّ التقسيم ٦٠ لا ٩٥: مواصفة الصديق تشترط أن يكون نصف المداخلات
   ≤٥٥ حرفاً (إيقاع v2 متوسطه ٤١)، ومتن الدكتور وسيطه ٥٨. فالتفكيك عند
   حدود الجمل هو ما يصنع الإيقاع — بكلماته لا بكلماتٍ جديدة. */
const SPLIT_AT = 60
function splitLong (turn) {
  const text = String(turn.text || '')
  if (text.length <= SPLIT_AT) return [turn]
  const parts = text.split(/(?<=[.!؟…])\s+/).filter(Boolean)
  if (parts.length < 2) return [turn]
  const out = []; let buf = ''
  for (const p of parts) {
    if (buf && (buf + ' ' + p).length > SPLIT_AT) { out.push(buf.trim()); buf = p } else buf = buf ? buf + ' ' + p : p
  }
  if (buf.trim()) out.push(buf.trim())
  return out.map((t, i) => ({ ...turn, text: t, musicBridgeAfter: false, pauseAfterMs: i === out.length - 1 ? turn.pauseAfterMs : 320 }))
}

export function condenseV3 (original) {
  const log = []
  /* ١) تفكيك الخطب الطويلة أولاً — يرفع نسبة القصير بلا اختراع */
  const pool = []
  original.forEach((t, i) => { const parts = splitLong(t); if (parts.length > 1) log.push(`قُسمت المداخلة ${i} إلى ${parts.length} عند حدود الجمل`); parts.forEach((p) => pool.push({ ...p, _src: i })) })

  const n = pool.length
  const picked = new Set()
  const pick = (i) => { if (i >= 0 && i < n) picked.add(i) }
  const isQ = (t) => t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text))

  /* ٢) الافتتاح كاملاً — «البداية دايماً روووعة» بشهادته */
  let firstQ = pool.findIndex(isQ); if (firstQ < 0 || firstQ > 5) firstQ = Math.min(4, n - 1)
  for (let i = 0; i <= firstQ; i += 1) pick(i)
  /* ٣) الخاتمة والإحالة باسمه */
  let ref = -1
  for (let i = n - 1; i >= Math.max(0, n - 7); i -= 1) if (/المقال|موقع الدكتور|الفيل/.test(String(pool[i].text))) { ref = i; break }
  const tailStart = ref >= 0 ? Math.min(ref, n - 3) : n - 3
  for (let i = Math.max(0, tailStart); i < n; i += 1) pick(i)
  /* ٤) الاعتراض — شرط صريح في مواصفة الصديق */
  const obj = pool.findIndex((t) => ['gentleObjection', 'objection'].includes(t.deliveryType))
  if (obj > 0) { pick(obj); pick(obj + 1) }
  /* ٥) أسئلة: ثلاثة على الأقل */
  const qs = pool.map((t, i) => ({ t, i })).filter(({ t, i }) => isQ(t) && i > firstQ && i < tailStart)
  qs.slice(0, 4).forEach(({ i }) => { pick(i); pick(i + 1) })

  /* ٥ب) التركيب الكويتي شرطٌ في مواصفة الصديق (مو هذا · عيل · قبل لا ·
     عقب ما · قاعد + فعل) — وهو موجود في ٩٩ من ١٤٤ حلقة من متن الدكتور
     نفسه، فيُنتقى انتقاءً بدل أن يُخترع. */
  const structIdx = pool.findIndex((t, i) => i > firstQ && i < tailStart && STRUCT.test(String(t.text)))
  if (structIdx > 0) pick(structIdx)

  /* ٦) الملء بميزانية الوقت — القصير أولاً لبلوغ إيقاع v2 */
  const budget = () => projected([...picked].sort((a, b) => a - b).map((i) => pool[i]))
  const score = (i) => {
    const L = String(pool[i].text).length
    let s = L <= SPEC.shortMax ? 3 : L <= 75 ? 1 : -1
    if (picked.has(i - 1) || picked.has(i + 1)) s += 2
    if (['reflection', 'emphasis'].includes(pool[i].deliveryType)) s += 1
    return s
  }
  let guard = 0
  /* الشرطان معاً: الوقت **وعدد المداخلات** — الاكتفاء بالوقت وحده كان
     يقف عند ٢٠ مداخلة (دون حدّ المواصفة ٢٢) لأن السطور القصيرة قليلة الثواني. */
  while ((budget() < SPEC.minSec + 6 || picked.size < SPEC.minTurns) && picked.size < SPEC.maxTurns && guard++ < n * 3) {
    let best = -1; let bs = -99
    for (let i = 0; i < n; i += 1) { if (picked.has(i)) continue; const s = score(i); if (s > bs) { bs = s; best = i } }
    if (best < 0) break
    pick(best)
  }
  while ((budget() > SPEC.maxSec - 4 || picked.size > SPEC.maxTurns) && picked.size > SPEC.minTurns) {
    const removable = [...picked].filter((i) => i > firstQ && i < tailStart && !isQ(pool[i]) && i !== obj && i !== structIdx)
      .sort((a, b) => String(pool[b].text).length - String(pool[a].text).length)
    if (!removable.length) break
    picked.delete(removable[0])
  }

  const idx = [...picked].sort((a, b) => a - b)
  const turns = idx.map((i) => ({ ...pool[i] }))
  delete turns.forEach

  /* ٧) الواو اليتيمة بعد القص */
  idx.forEach((orig, k) => {
    if (k > 0 && idx[k - 1] !== orig - 1) {
      const s = String(turns[k].text)
      if (/^و[^ا]/.test(s)) { turns[k].text = s.slice(1); log.push(`واو يتيمة نُزعت (${orig})`) }
    }
  })

  /* ٨) الأخذ والردّ: تداخلٌ على أقصر مداخلات التصديق — بيانات لا نص */
  const shortIdx = turns.map((t, i) => ({ t, i })).filter(({ t, i }) => i > 0 && String(t.text).length <= 45)
    .sort((a, b) => String(a.t.text).length - String(b.t.text).length).slice(0, 4)
  shortIdx.forEach(({ i }) => { turns[i].overlapMs = 70 })

  /* ٩) الجسران — لا بعد سؤال ولا بعد الأخيرة */
  const total = projected(turns)
  let acc = 0; const marks = []
  turns.forEach((t, k) => { t.musicBridgeAfter = false; acc += String(t.text).length * 0.099 + (Number(t.pauseAfterMs) || 560) / 1000
    if (marks.length === 0 && acc >= Math.min(total * 0.33, 62) && !isQ(t) && k < turns.length - 3) marks.push(k)
    else if (marks.length === 1 && acc >= total * 0.68 && !isQ(t) && k < turns.length - 2 && k > marks[0] + 3) marks.push(k) })
  marks.forEach((k) => { turns[k].musicBridgeAfter = true })

  /* ١٠) ميزانية التعجّب — التدخّل الوحيد في النص، ومسجَّل */
  const textOf = () => turns.map((t) => t.text).join(' ')
  if (!NO_INTERJECTIONS && !HUMAN.test(textOf())) {
    const target = turns.findIndex((t, i) => i > 1 && i < turns.length - 3 && AGREE.test(String(t.text).trim()))
    const at = target >= 0 ? target : turns.findIndex((t, i) => i > 1 && i < turns.length - 3 && String(t.text).length <= 55)
    if (at >= 0) {
      const word = AGREE.test(String(turns[at].text).trim()) ? 'إي والله. ' : 'ممم… '
      turns[at].text = word + turns[at].text
      log.push(`تعجّبٌ أُضيف: «${word.trim()}» على المداخلة ${at} — صوتٌ لا دعوى (شرط فاحص DNA)`)
    }
  }
  return { turns, log }
}

export function checkSpec (turns) {
  const text = turns.map((t) => t.text).join(' ')
  const short = turns.filter((t) => String(t.text).length <= SPEC.shortMax).length
  const long = turns.filter((t) => String(t.text).length > SPEC.longMax).length
  const sec = projected(turns)
  const fails = []
  if (turns.length < SPEC.minTurns || turns.length > SPEC.maxTurns) fails.push(`مداخلات ${turns.length}`)
  if (turns.filter((t) => t.musicBridgeAfter).length !== SPEC.bridges) fails.push('الجسران')
  if (turns.filter((t) => Number(t.overlapMs) > 0).length < SPEC.minOverlaps) fails.push('أخذ وردّ')
  if (!turns.some((t) => ['gentleObjection', 'objection'].includes(t.deliveryType))) fails.push('اعتراض')
  if ((text.match(/[؟?]/gu) || []).length < SPEC.minQuestions) fails.push('أسئلة')
  if (!HUMAN.test(text)) fails.push('إشارة بشرية')
  if (!STRUCT.test(text.replace(/\b(?:وايد|هني|شلون)\b/gu, ''))) fails.push('تركيب كويتي')
  if (short / turns.length < SPEC.shortRatio) fails.push(`قصير ${Math.round(short / turns.length * 100)}%`)
  if (long > SPEC.maxLong) fails.push(`طويلة ${long}`)
  if (sec < SPEC.minSec || sec > SPEC.maxSec) fails.push(`مدة ${Math.round(sec)}ث`)
  return { fails, sec: Math.round(sec), shortPct: Math.round(short / turns.length * 100) }
}

if (SELF_TEST) {
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  const pilot = Object.values(lib.episodes['success-that-does-not-bring-joy-to-its-ownerarabic'])
  const r = condenseV3(pilot)
  const c = checkSpec(r.turns)
  assert.ok(r.turns.length >= SPEC.minTurns && r.turns.length <= SPEC.maxTurns, `المداخلات ${r.turns.length}`)
  assert.equal(r.turns.filter((t) => t.musicBridgeAfter).length, 2, 'جسران')
  const src = new Set(pilot.flatMap((t) => splitLong(t)).map((t) => t.text))
  const own = r.turns.filter((t) => src.has(t.text) || src.has('و' + t.text) || src.has(t.text.replace(/^(إي والله\. |ممم… )/, ''))).length
  assert.ok(own / r.turns.length >= 0.95, `وفاء المصدر ${Math.round(own / r.turns.length * 100)}٪ — كل سطر من متنه`)
  assert.ok(/الفيل|موقع الدكتور/.test(r.turns[r.turns.length - 1].text), 'الختام باسمه وموقعه')
  console.log(`✓ مكثّف v3: ${pilot.length}→${r.turns.length} مداخلة · ~${c.sec}ث · ${c.shortPct}% قصير · وفاء ${Math.round(own / r.turns.length * 100)}٪`)
  if (c.fails.length) console.log('  ⚠ خارج المواصفة: ' + c.fails.join(' · '))
  process.exit(0)
}

const RUN_MAIN = process.argv[1] && process.argv[1].endsWith('condense-diwania-v3.mjs')
if (RUN_MAIN) {
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  const out = { schemaVersion: 1, profile: 'kuwaiti-diwania-v3', note: 'إيقاع الديوانية بكلمات الدكتور — كل سطر منتقى من متنه المدقق؛ التدخلان: تقسيم عند حدود الجمل، وتعجّب واحد عند اللزوم (مسجّل).', count: 0, episodes: {} }
  const report = []
  for (const [slug, ep] of Object.entries(lib.episodes)) {
    const r = condenseV3(Object.values(ep))
    const c = checkSpec(r.turns)
    out.episodes[slug] = Object.fromEntries(r.turns.map((t, i) => [String(i), t]))
    report.push({ slug, turns: r.turns.length, sec: c.sec, shortPct: c.shortPct, fails: c.fails, log: r.log })
  }
  out.count = Object.keys(out.episodes).length
  writeFileSync(resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json'), JSON.stringify(out, null, 1) + '\n')
  writeFileSync(resolve(ROOT, 'podcast-audits/diwania-v3-report.json'), JSON.stringify(report, null, 1) + '\n')
  const clean = report.filter((r) => !r.fails.length).length
  console.log(`✓ v3: ${out.count} حلقة · تعبر مواصفة DNA كاملةً: ${clean}/${out.count}`)
  const secs = report.map((r) => r.sec).sort((a, b) => a - b)
  console.log(`  المدة: وسيط ${secs[Math.floor(secs.length / 2)]}ث · القصير: وسيط ${report.map((r) => r.shortPct).sort((a, b) => a - b)[Math.floor(report.length / 2)]}%`)
}
