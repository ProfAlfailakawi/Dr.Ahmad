#!/usr/bin/env node
/** تدقيق النص الكامل وما سيصل TTS لكل الحلقات الحالية والجديدة. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATIVE_SPOKEN_VERSION,
  auditNativeSpokenTurns,
  optimizeNativeSpokenEpisode,
} from './lib/kuwaiti-native-spoken.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

if (SELF_TEST) {
  const bad = auditNativeSpokenTurns([
    { text: 'في بحث فعلي قاعد يقول لنا إن هالضغط له ثمن.', deliveryType: 'statement' },
    { text: 'والتربية الحقيقية مو إحنا نلمع شكل النجاح؛ التربية إحنا نرجع له روحه.', deliveryType: 'conclusion' },
  ])
  assert.ok(bad.hard.some((finding) => finding.label === 'بحث بصوت مذيع'), 'يمسك وضع المذيع')
  assert.ok(bad.hard.some((finding) => finding.label === 'خاتمة شعارية'), 'يمسك الخاتمة الشعارية')
  const fixed = optimizeNativeSpokenEpisode([
    { text: 'وفي دراسة نشرتها جهة علمية، طلع فرق واضح.', deliveryType: 'statement' },
  ])
  assert.equal(fixed.turns[0].text, 'وأكو دراسة من جهة علمية، طلع فرق واضح.', 'يحوّل مدخل الدراسة إلى كلام')
  assert.equal(fixed.audit.hard.length, 0, 'النص المصقول يمر')
  console.log('✓ بوابة النص الكويتي الطبيعي: الفحص الذاتي 3/3')
  process.exit(0)
}

const sources = [
  ['الكامل', 'src/data/kuwaiti-dialogues.json'],
  ['المنطوق المختصر', 'src/data/kuwaiti-diwania-v3.json'],
]

let totalHard = 0
for (const [label, relative] of sources) {
  const data = JSON.parse(readFileSync(resolve(ROOT, relative), 'utf8'))
  const episodes = Object.entries(data.episodes || {})
  assert.equal(episodes.length, 144, `${label}: المتوقع 144 حلقة`)
  let turns = 0; let rewrites = 0; let qaf = 0; let research = 0; let soft = 0
  const hard = []
  for (const [slug, episode] of episodes) {
    const prepared = optimizeNativeSpokenEpisode(Object.values(episode), { slug })
    turns += prepared.turns.length
    rewrites += prepared.changes.length
    qaf += prepared.audit.qafRiskCount
    research += prepared.audit.researchTurns
    soft += prepared.audit.soft.length
    for (const finding of prepared.audit.hard) hard.push({ slug, ...finding })
  }
  totalHard += hard.length
  console.log(`✓ ${label}: 144 حلقة · ${turns} مداخلة · ${rewrites} خانة تُصقل قبل الصوت · ${research} مداخلة بحثية · ${qaf} كلمة قاف عالية الخطورة · ${soft} تنبيه يدوي · أخطاء قاطعة ${hard.length}`)
  for (const finding of hard.slice(0, 12)) console.log(`  ⛔ ${finding.slug}#${finding.index + 1} ${finding.label}: ${finding.text}`)
}

assert.equal(totalHard, 0, 'بقيت صياغات تمنع الأداء الكويتي الطبيعي')
console.log(`✓ الإصدار الإلزامي قبل TTS: ${NATIVE_SPOKEN_VERSION}`)

/* كل مسارٍ يستدعي Gemini لازم يمر بالطبقة؛ وإلا يصير البرومت يقول
   «تم الصقل» بينما الملف التجريبي لم يُصقل فعلاً. */
const pilotWorkflow = readFileSync(resolve(ROOT, '.github/workflows/podcast-kuwaiti-pilot.yml'), 'utf8')
assert.match(pilotWorkflow, /select-kuwaiti-short-source\.mjs/, 'مسار الإنتاج يطبق الصقل داخل select')
for (const workflow of ['podcast-kuwaiti-five-canaries.yml', 'podcast-prompt-experiment.yml']) {
  const source = readFileSync(resolve(ROOT, '.github/workflows', workflow), 'utf8')
  assert.match(source, /apply-kuwaiti-native-spoken\.mjs/, `${workflow}: التجربة تمر بالصقل نفسه`)
}
console.log('✓ كل مسارات Gemini الكويتية تمر بطبقة النص المنطوق')
