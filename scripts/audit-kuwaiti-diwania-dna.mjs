#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildForeignRedactions,
  buildPronunciationMap,
  redactForeignNames,
  toSpokenKuwaiti,
} from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'src/data/kuwaiti-diwania-v2-canaries.json')
const data = JSON.parse(readFileSync(FILE, 'utf8'))
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

assert.equal(episodes.length, 5, 'بروفة DNA يجب أن تحمل الحلقات الخمس بالضبط')
const summary = []

for (const [slug, turnsRaw] of episodes) {
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

  assert.deepEqual([...speakers].sort(), ['female', 'male'], `${slug}: لازم صوتان`) 
  assert.ok(turns.length >= 22 && turns.length <= 34, `${slug}: عدد المداخلات ${turns.length}`)
  assert.equal(turns.filter((turn) => turn.musicBridgeAfter).length, 2, `${slug}: الجسران مونتاجيان`)
  for (const [index, turn] of turns.entries()) {
    if (!turn.musicBridgeAfter) continue
    assert.notEqual(turn.deliveryType, 'question', `${slug}: الجسر قطع سؤالاً قبل جوابه عند المداخلة ${index + 1}`)
    assert.ok(index < turns.length - 1, `${slug}: الجسر لا يقع بعد آخر مداخلة`)
  }
  assert.ok(turns.filter((turn) => Number(turn.overlapMs) > 0).length >= 3, `${slug}: ماكو أخذ ورد كافي`)
  assert.ok(turns.some((turn) => OBJECTIONS.has(turn.deliveryType)), `${slug}: ماكو اعتراض حقيقي`)
  assert.ok((text.match(/[؟?]/gu) || []).length >= 3, `${slug}: الحوار ما يكتشف الفكرة بالسؤال`)
  assert.match(text, HUMAN_SIGNALS, `${slug}: ماكو عيب بشري أو رد تلقائي`)
  assert.match(stripped, STRUCTURAL_KUWAITI, `${slug}: بعد حذف وايد/هني/شلون ما بقى تركيب كويتي كافي`)
  assert.ok(shortTurns / turns.length >= 0.5, `${slug}: أقل من نصف المداخلات كلام يومي قصير`)
  assert.ok(longTurns <= 2, `${slug}: خطب طويلة أكثر من اللازم (${longTurns})`)
  assert.ok(projectedSec >= 128 && projectedSec <= 155, `${slug}: المدة المتوقعة ${projectedSec.toFixed(0)}ث`)
  assert.doesNotMatch(text, DIFFICULT_NAMES, `${slug}: اسم بحثي صعب دخل الصوت`)
  assert.doesNotMatch(spokenText, /ض/u, `${slug}: قاعدة الظاد الشاملة لم تصل إلى الصوت`)
  assert.doesNotMatch(spokenText, /[A-Za-z]/u, `${slug}: بقي اسم لاتيني في الصوت`)
  assert.doesNotMatch(spokenText, /(?:الفيلكاوي|الفيلچاوي)/u, `${slug}: اسم العائلة لم يمر بطبقة النطق`)
  if (/الفيل(?:ك|چ)اوي/u.test(text)) assert.match(spokenText, /الفيلتشاوي/u, `${slug}: نطق اسم العائلة غير المقفول`)
  assert.doesNotMatch(spokenText, /شهاده صغيرة|الشهاده اتصير منظرة/u, `${slug}: بديل «ورقة» العام كسر سياق الحوار`)
  for (const pattern of ARTICLE_FINGERPRINTS) assert.doesNotMatch(text, pattern, `${slug}: بصمة مقال ${pattern}`)
  for (const pattern of HEARD_FAILURES) assert.doesNotMatch(text, pattern, `${slug}: رجع خطأ مسموع ${pattern}`)

  summary.push({ slug, turns: turns.length, projectedSec: Math.round(projectedSec), shortPct: Math.round(shortTurns / turns.length * 100) })
}

console.log('✓ اختبار الديوانية: العين · الأذن · التركيب · المقاطعة · حذف العلامات السطحية')
for (const row of summary) console.log(`  ${row.slug}: ${row.turns} مداخلة · ~${row.projectedSec}ث · ${row.shortPct}% سطور يومية قصيرة`)
