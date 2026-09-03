#!/usr/bin/env node
/**
 * فاحص DNA الديوانية.
 *
 * مساران:
 *  ١ ــ البروفة الصارمة (الافتراضي): الكناريات الخمس — أي إخفاق يوقف كل شي.
 *  ٢ ــ [٢٧ أغسطس ٢٠٢٦] «سقف لا يتراجع» على متن الإنتاج كله:
 *        node scripts/audit-kuwaiti-diwania-dna.mjs --file=src/data/kuwaiti-diwania-v3.json --summary
 *      كان الفاحص يغطي ٥ حلقات بينما الإنتاج يشحن من ١٤٤ — فالمسار الثاني
 *      يفحص المتن كله بالمعايير نفسها، ويقارن بخط أساسٍ مجمّد
 *      (podcast-audits/diwania-dna-ratchet.json): الإخفاقات القديمة موثقة
 *      بانتظار يد الدكتور ولا توقف البناء، وأي إخفاق **جديد** يوقفه.
 *      تحديث خط الأساس (بعد إصلاح حلقات) بـ--write-baseline.
 *      فحص قلب الضاد الحرفي يبقى في البروفة وحدها: المتن الكامل يحمل
 *      «المفروض» وأخواتها والقاعدة الشاملة تقلبها، وحسم أصواتها لمختبر
 *      المعجم لا لهذا الفاحص.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildForeignRedactions,
  buildPronunciationMap,
  redactForeignNames,
  toSpokenKuwaiti,
} from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = process.argv.find((a) => a.startsWith('--file='))?.slice(7) || 'src/data/kuwaiti-diwania-v2-canaries.json'
const SUMMARY = process.argv.includes('--summary')
const WRITE_BASELINE = process.argv.includes('--write-baseline')
const RATCHET = resolve(ROOT, 'podcast-audits/diwania-dna-ratchet.json')

const data = JSON.parse(readFileSync(resolve(ROOT, FILE), 'utf8'))
const episodes = Object.entries(data.episodes || {})
const pronunciationSource = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-pronunciation.json'), 'utf8'))
const pronunciationMap = buildPronunciationMap(pronunciationSource)
const foreignRedactions = buildForeignRedactions(pronunciationSource)
const spoken = (text) => toSpokenKuwaiti(redactForeignNames(text, foreignRedactions), pronunciationMap)

const ARTICLE_FINGERPRINTS = [
  /وهنا تكمن/u,
  /السؤال الحقيقي إذن/u,
  /الأمر لا يتعلق/u,
  /ولعل هذا يفسر/u,
  /في عالم اليوم/u,
  /وهنا تحديد(?:ا|اً)/u,
  /لكن ماذا لو/u,
]
const HEARD_FAILURES = [
  /اللي يعلى/u,
  /\bيده\b/u,
  /قبل لا يولد/u,
  /يكسب وقت/u,
  /كاد ينسى/u,
  /\bيهرب(?:ون)?\b/u,
  /مراي(?:ة|ا)/u,
  /خبرناه/u,
  /واطي(?:ة|ه)/u,
  /من وين يا هالجواب/u,
  /في شي له قيمة تحرك/u,
  /مو شي هو عليه طول عمره/u,
  /ما ناسبت فهمه/u,
  /\bنقيس\b/u,
  /يناطره/u,
  /يخبي/u,
  /بد(?:ا)?ل لا يقول/u,
  /ننسى ليش نسوي/u,
  /\bيشرد\b/u,
  /فلان ياب/u,
  /الفيل(?:ك|چ)اوي/u,
]
const DIFFICULT_NAMES = /إدمندسون|ريان وديسي|بيليزا|باهاريا|كينان|بيرس ستيل|Frontiers|Moral Education|Microsoft/u
const HUMAN_SIGNALS = /ممم|لحظة|لا عاد|ما فهمت|أوف|أنا…|إي!|صراحة|إي والله|زين هدي/u
const STRUCTURAL_KUWAITI = /مو (?:هذا|هني|كل|ضد|قاعد)|بدال لا|عيل |قاعد [ء-ي]|شكثر |شيسوي|قبل لا|من صوب|عقب ما/u
const OBJECTIONS = new Set(['gentleObjection', 'objection'])
const OBVIOUS_MARKERS = /\b(?:وايد|هني|شلون)\b/gu

/** يقيس الحلقة على المعايير كلها ويرجع أعطالها — البروفة تجزم بها والملخص يحصيها. */
function evaluateEpisode(turnsRaw) {
  const failures = []
  const fail = (id, detail) => failures.push({ id, detail })
  const turns = Object.values(turnsRaw)
  const text = turns.map((turn) => String(turn.text || '')).join('\n')
  const spokenText = spoken(text)
  const stripped = text.replace(OBVIOUS_MARKERS, '')
  const chars = turns.reduce((sum, turn) => sum + String(turn.text || '').length, 0)
  const pauses = turns.reduce((sum, turn) => sum + (Number(turn.pauseAfterMs) || 0) / 1000, 0)
  const projectedSec = chars * 0.099 + pauses + 7.4
  const shortTurns = turns.filter((turn) => String(turn.text || '').length <= 55).length
  const longTurns = turns.filter((turn) => String(turn.text || '').length > 95).length
  const speakers = new Set(turns.map((turn) => turn.speaker))

  if ([...speakers].sort().join() !== 'female,male') fail('صوتان', 'لازم صوتان')
  if (!(turns.length >= 22 && turns.length <= 34)) fail('عدد المداخلات', `${turns.length}`)
  if (turns.filter((turn) => turn.musicBridgeAfter).length !== 2) fail('الجسران', 'الجسران مونتاجيان')
  for (const [index, turn] of turns.entries()) {
    if (!turn.musicBridgeAfter) continue
    if (turn.deliveryType === 'question') fail('جسر بعد سؤال', `المداخلة ${index + 1}`)
    if (index >= turns.length - 1) fail('جسر أخير', 'الجسر لا يقع بعد آخر مداخلة')
  }
  if (turns.filter((turn) => Number(turn.overlapMs) > 0).length < 3) fail('أخذ ورد', 'ماكو أخذ ورد كافي')
  if (!turns.some((turn) => OBJECTIONS.has(turn.deliveryType))) fail('اعتراض', 'ماكو اعتراض حقيقي')
  if ((text.match(/[؟?]/gu) || []).length < 3) fail('أسئلة', 'الحوار ما يكتشف الفكرة بالسؤال')
  if (!HUMAN_SIGNALS.test(text)) fail('إشارة بشرية', 'ماكو عيب بشري أو رد تلقائي')
  if (!STRUCTURAL_KUWAITI.test(stripped)) fail('تركيب كويتي', 'بعد حذف وايد/هني/شلون ما بقى تركيب كويتي كافي')
  if (shortTurns / turns.length < 0.5) fail('سطور قصيرة', `${Math.round(shortTurns / turns.length * 100)}%`)
  if (longTurns > 2) fail('خطب طويلة', `${longTurns}`)
  if (!(projectedSec >= 128 && projectedSec <= 155)) fail('المدة', `${projectedSec.toFixed(0)}ث`)
  if (DIFFICULT_NAMES.test(text)) fail('اسم بحثي صعب', 'اسم بحثي صعب دخل الصوت')
  if (/[A-Za-z]/u.test(spokenText)) fail('لاتيني في الصوت', 'بقي اسم لاتيني في الصوت')
  if (/(?:الفيلكاوي|الفيلچاوي)/u.test(spokenText)) fail('اسم العائلة', 'اسم العائلة لم يمر بطبقة النطق')
  if (/الفيل(?:ك|چ)اوي/u.test(text) && !/الفيلتشاوي/u.test(spokenText)) fail('اسم العائلة', 'نطق اسم العائلة غير المقفول')
  if (/شهاده صغيرة|الشهاده اتصير منظرة/u.test(spokenText)) fail('بديل ورقة', 'بديل «ورقة» العام كسر سياق الحوار')
  for (const pattern of ARTICLE_FINGERPRINTS) if (pattern.test(text)) fail('بصمة مقال ' + String(pattern), String(pattern))
  /* متن الإنتاج يكتب سطر الختام باسمه («الفيلچاوي») ونطقه محروس بفحص
     «اسم العائلة» أعلاه — فنمط الاسم من قائمة الأخطاء المسموعة يخص بروفة
     الكناريات وحدها (ختامها يولّده المحرك لا المتن). */
  const heardPatterns = SUMMARY
    ? HEARD_FAILURES.filter((p) => String(p) !== String(/الفيل(?:ك|چ)اوي/u))
    : HEARD_FAILURES
  for (const pattern of heardPatterns) if (pattern.test(text)) fail('خطأ مسموع ' + String(pattern), String(pattern))

  return { failures, turns, projectedSec, shortTurns }
}

if (SUMMARY) {
  const byPk = {}
  const counts = {}
  for (const [slug, turnsRaw] of episodes) {
    const { failures } = evaluateEpisode(turnsRaw)
    if (!failures.length) continue
    byPk[slug] = [...new Set(failures.map((f) => f.id))].sort()
    for (const id of byPk[slug]) counts[id] = (counts[id] || 0) + 1
  }
  const flaggedCount = Object.keys(byPk).length
  console.log(`فُحص ${episodes.length} حلقة على معايير DNA الديوانية · ${flaggedCount} حلقة عليها ملاحظات قديمة بانتظار يد الدكتور`)
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} × ${k}`))

  if (WRITE_BASELINE) {
    writeFileSync(RATCHET, JSON.stringify({ file: FILE, episodes: byPk }, null, 1) + '\n')
    console.log(`✓ خط الأساس كُتب: ${RATCHET}`)
    process.exit(0)
  }
  if (!existsSync(RATCHET)) {
    console.log('⚠ لا خط أساس — أنشئه أولاً بـ--write-baseline')
    process.exit(1)
  }
  const baseline = JSON.parse(readFileSync(RATCHET, 'utf8'))
  const regressions = []
  for (const [slug, ids] of Object.entries(byPk)) {
    const known = new Set(baseline.episodes?.[slug] || [])
    for (const id of ids) if (!known.has(id)) regressions.push(slug + ' ← ' + id)
  }
  const healed = Object.entries(baseline.episodes || {})
    .filter(([slug, ids]) => ids.some((id) => !(byPk[slug] || []).includes(id))).length
  if (healed) console.log(`ℹ ${healed} حلقة تحسنت عن خط الأساس — حدّثه بـ--write-baseline بعد اعتماد الدكتور`)
  if (regressions.length) {
    console.log('⛔ إخفاقات جديدة لم تكن في خط الأساس:')
    for (const r of regressions) console.log('  · ' + r)
    process.exit(1)
  }
  console.log('✓ السقف محفوظ: لا إخفاق جديد على متن الإنتاج كله')
  process.exit(0)
}

/* ─── البروفة الصارمة (الافتراضي): الكناريات الخمس ─── */
assert.equal(episodes.length, 5, 'بروفة DNA يجب أن تحمل الحلقات الخمس بالضبط')
const summary = []

for (const [slug, turnsRaw] of episodes) {
  const { failures, turns, projectedSec, shortTurns } = evaluateEpisode(turnsRaw)
  assert.equal(failures.length, 0,
    `${slug}: ${failures.map((f) => f.id + ' (' + f.detail + ')').join(' · ')}`)
  const text = turns.map((turn) => String(turn.text || '')).join('\n')
  const spokenText = spoken(text)
  /* فحص قلب الضاد الحرفي — للبروفة وحدها (انظر رأس الملف) */
  assert.doesNotMatch(spokenText, /(?:نركظ|نظج|المفروظ|نحظر|منظبطين|ظمير)/u,
    `${slug}: رجع قلب الضاد الشامل وخرّب كلمة صحيحة`)
  summary.push({ slug, turns: turns.length, projectedSec: Math.round(projectedSec), shortPct: Math.round(shortTurns / turns.length * 100) })
}

console.log('✓ اختبار الديوانية: العين · الأذن · التركيب · المقاطعة · حذف العلامات السطحية')
for (const row of summary) console.log(`  ${row.slug}: ${row.turns} مداخلة · ~${row.projectedSec}ث · ${row.shortPct}% سطور يومية قصيرة`)
