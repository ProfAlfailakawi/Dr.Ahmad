#!/usr/bin/env node
/** تدقيق النص الكامل وما سيصل TTS لكل الحلقات الحالية والجديدة. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NATIVE_SPOKEN_VERSION,
  PILOT_SLUG,
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
  const pilotLibrary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json'), 'utf8'))
  const pilot = optimizeNativeSpokenEpisode(Object.values(pilotLibrary.episodes[PILOT_SLUG]), { slug: PILOT_SLUG })
  const pilotText = pilot.turns.map((turn) => turn.text).join('\n')
  assert.doesNotMatch(pilotText, /(?:ناطرها|معطين|ارتاح|شيين|حجمه|تعرّفنا|اهو|أهدى|سواه)/u,
    'تحرير الحلقة لا يعيد الكلمات التسع التي أوقفها حارس الكلمات')
  assert.doesNotMatch(pilotText, /(?:باب ضيق|وعقب|وسيلة تهد[يّي] الخوف|الدراسة تصير محطة بعد محطة|أوضح مع نفسهم|نلمّع شكل النجاح)/u,
    'المواضع الخمسة من الحكم السمعي الأخير لا ترجع إلى النص')
  assert.match(pilot.turns[4].text, /منحشر بمكان ضيّج… وبعدها طلع منه/u,
    '«ضيّج» المعتمدة مكتوبة في المصدر نفسه لا متروكة لاحتمال المعجم')
  assert.equal(pilot.turns.length, 25, 'البحث المضغوط يقلل تبديل الصوت من غير حذف معلومة')
  assert.deepEqual(pilot.turns.slice(13, 18).map((turn) => turn.speaker),
    ['female', 'male', 'female', 'male', 'female'], 'البحث أخذ ورد بين صوتين لا فقرة مذيع')
  assert.equal(pilot.turns[14].text, 'شلون يعني؟ وشنو طلع معاهم؟',
    'سؤال البحث واحد طبيعي بدل تبديل صوت كل سطر')
  assert.match(pilot.turns[15].text, /في دراسة كبيرة.*كل ما زاد التوتر، نزل مستوى الطالب/u,
    'جواب البحث يحتفظ بالمصدر والنتيجة')
  assert.equal(pilot.turns[18].text, 'بس مو كبرنا الموضوع وايد؟', 'الاعتراض كويتي شفهي وخفيف')
  assert.equal(pilot.turns[23].text,
    'ودورنا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.',
    'الخاتمة كلام بشري لا شعار ولا كلمة جديدة')
  const pilotWorkflow = readFileSync(resolve(ROOT, '.github/workflows/podcast-kuwaiti-pilot.yml'), 'utf8')
  assert.match(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'0'/,
    'مسار الإنتاج يثبت أن الجسر مونتاج خارجي ولا يقطع طلب TTS')
  assert.doesNotMatch(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'1'/,
    'الإعداد الذي صنع ثلاثة أصوات بعد الجسور لا يرجع')
  assert.match(pilotWorkflow, /PODCAST_KW_PROMPT_MODE:\s*c/,
    'مسار المرشح مقفول على البرومت C المعتمد لا أوضاع التجارب التاريخية')
  assert.match(pilotWorkflow, /GEMINI_TTS_MODEL:\s*gemini-2\.5-pro-preview-tts/,
    'الإنتاج يستخدم Pro الذي اجتاز ثبات الهوية بدل Flash المتذبذب')
  assert.match(pilotWorkflow, /PODCAST_KW_MIN_GAP:\s*'25'/,
    'الحوار المتعدد لا يقبل فجوة 20Hz التي سُمعت صوتاً واحداً')
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_FEMALE_IDENTITY_DRIFT:\s*'1'/,
    'انزلاق نورة يرمي الـTake كله')
  const engine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
  assert.match(engine, /femaleContinuity\.segmentSuspects\.length/,
    'بوابة نورة تحكم على وسيط مقطع كامل لا قفزة دور مفرد')
  assert.doesNotMatch(engine, /REJECT_FEMALE_IDENTITY_DRIFT && \(femaleSwapSuspects\.length \|\| femaleContinuity\.suspects\.length\)/,
    'القاعدة القديمة ذات الإنذارات الكاذبة لا ترجع')
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_TIMING_SUSPECTS:\s*'1'/,
    'الدور المقصوص أو الممدود يرمي الـTake كله')
  assert.match(pilotWorkflow, /PODCAST_KW_ISOLATE_SPEAKER_STEMS:\s*'0'/,
    'الحوار الحقيقي المتصل هو الإنتاج؛ مسارا الفقرات المرفوضان لا يرجعان')
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'1'/,
    'أي تبديل داخل الحوار المتصل يرمي الـTake كله')
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
    'بوابة الرنين تمسك نفس preset لما يصير مو نفس الإنسان')
  console.log('✓ بوابة النص الكويتي الطبيعي: الفحص الذاتي 15/15')
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
assert.match(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'0'/,
  'مسار الإنتاج يولّد الحوار متصلاً ويضيف الجسر بعد TTS')
assert.doesNotMatch(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'1'/,
  'ممنوع إعادة Voice/Accent Reset عند الجسر')
assert.match(pilotWorkflow, /PODCAST_KW_PROMPT_MODE:\s*c/,
  'الإنتاج مقفول على البرومت C ذي الاستمرارية الصوتية المطلقة')
assert.match(pilotWorkflow, /GEMINI_TTS_MODEL:\s*gemini-2\.5-pro-preview-tts/,
  'المحرك المقفول هو Pro المجتاز لبوابات الهوية والرنين')
assert.match(pilotWorkflow, /PODCAST_KW_MIN_GAP:\s*'25'/,
  'مرشح الحوار الحقيقي يفرض فرقاً مسموعاً بين الشخصين')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_FEMALE_IDENTITY_DRIFT:\s*'1'/,
  'بوابة نورة الصارمة مفعّلة في الإنتاج')
const geminiEngine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
assert.match(geminiEngine, /femaleContinuity\.segmentSuspects\.length/,
  'انزلاق نورة يُقاس على مقطع ثابت لا دور مفرد متقلب')
assert.match(geminiEngine, /const ISOLATE_SPEAKER_STEMS = process\.env\.PODCAST_KW_ISOLATE_SPEAKER_STEMS === '1'/,
  'المساران المنفصلان مختبر صريح فقط، لا fallback إنتاج')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_TIMING_SUSPECTS:\s*'1'/,
  'بوابة القص والتمديد مفعّلة في الإنتاج')
assert.match(pilotWorkflow, /PODCAST_KW_ISOLATE_SPEAKER_STEMS:\s*'0'/,
  'الإنتاج يولّد الأخذ والرد الحقيقي في Take واحد')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_SPEAKER_IDENTITY_DRIFT:\s*'1'/,
  'بوابة الطبقة النسبية تعمل على فهد ونورة معاً')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'1'/,
  'تبديل الصوت داخل الـTake ممنوع')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
  'التغير الطيفي بعد الانتقال ممنوع حتى مع طبقة ثابتة')
for (const workflow of ['podcast-kuwaiti-five-canaries.yml', 'podcast-prompt-experiment.yml']) {
  const source = readFileSync(resolve(ROOT, '.github/workflows', workflow), 'utf8')
  assert.match(source, /apply-kuwaiti-native-spoken\.mjs/, `${workflow}: التجربة تمر بالصقل نفسه`)
  if (workflow === 'podcast-kuwaiti-five-canaries.yml') {
    assert.match(source, /GEMINI_TTS_MODEL:\s*gemini-2\.5-pro-preview-tts/,
      'الكناريات تختبر محرك الإنتاج نفسه')
    assert.match(source, /PODCAST_KW_ISOLATE_SPEAKER_STEMS:\s*'0'/,
      'الكناريات الخمس تختبر الحوار المتصل نفسه قبل التعميم')
    assert.match(source, /PODCAST_KW_REJECT_FEMALE_IDENTITY_DRIFT:\s*'1'/,
      'الكناريات لا تتجاوز انزلاق نورة')
    assert.match(source, /PODCAST_KW_REJECT_TIMING_SUSPECTS:\s*'1'/,
      'الكناريات لا تتجاوز دوراً مقصوصاً')
    assert.match(source, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'1'/,
      'الكناريات لا تتجاوز تبديل صوت')
    assert.match(source, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
      'الكناريات لا تتجاوز إعادة الرنين')
  }
}
console.log('✓ كل مسارات Gemini الكويتية تمر بطبقة النص المنطوق')
