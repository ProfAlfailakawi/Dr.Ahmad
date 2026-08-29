#!/usr/bin/env node
/** تدقيق النص الكامل وما سيصل TTS لكل الحلقات الحالية والجديدة. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CLASSROOM_SLUG,
  INTELLIGENCE_SLUG,
  NATIVE_SPOKEN_VERSION,
  PILOT_SLUG,
  SERIOUSNESS_SLUG,
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
  const register = optimizeNativeSpokenEpisode([
    { text: 'شنو غاية التعليم؟ نطلع واجبات ممتازة… ولا نطلع بشر يفكرون بأنفسهم؟' },
    { text: 'ويحل محله تدريبات عملية يسويها الطلاب بأنفسهم، بمساعدة معلم مدرب.' },
    { text: 'ولا صار الذكاء الاصطناعي أصدق منا إحنا؟' },
  ], { slug: 'register-fixture' })
  assert.deepEqual(register.turns.map((turn) => turn.text), [
    'شنو غاية التعليم؟ نطلع واجبات ممتازة… ولا نطلع بشر يفكرون بروحهم؟',
    'ويحل محله تدريبات عملية يسوونها الطلبة بروحهم، بمساعدة معلم مدرب.',
    'ولا صرنا نصدق الذكاء الاصطناعي أكثر من بعض؟',
  ], 'الفصحى الواضحة والرصد السمعي «بأنفسهم» يعالجان داخل الجملة لا بخريطة كلمة عمياء')
  const friendRegression = optimizeNativeSpokenEpisode([
    { text: 'وشنو اللي أسويه لأني خايف أطلع قدام الناس أقل حضور؟' },
    { text: 'وأهلنا واحد.' },
    { text: 'عيل جان صار منهج مخرجاته ترضي الكل… هذا اللي نبيه.' },
  ], { slug: 'friend-regression-fixture' })
  assert.deepEqual(friendRegression.turns.map((turn) => turn.text), [
    'وشنو اللي أسويه لأني خايف أطلع جدام الناس أقل حضور؟',
    'واللي يجمعنا واحد.',
    'عيل اللي نبيه منهج مخرجاته ترضي الكل… هذا اللي نبيه.',
  ], 'رفع الصديق لا يغيّر معنى الانتماء ولا يعمم جان→كان ولا يعيد قدام')
  const obviousRegister = optimizeNativeSpokenEpisode([
    { text: 'يتدرب القراصنة لين ما يتطورون هاكرز أخلاقيين يوقفون الخطر عن مواقعنا…' },
    { text: 'خلونا نبني قراصنة محترفين، بس بأخلاق.' },
  ], { slug: 'ethical-hacking-culture' })
  assert.deepEqual(obviousRegister.turns.map((turn) => turn.text), [
    'وندربهم عدل، لين يصيرون هاكرز أخلاقيين يحمون مواقعنا من الخطر…',
    'خلونا نطلع هاكرز محترفين، ويكون شغلهم بأخلاق.',
  ], 'الفصحى الواضحة تُعاد صياغة جملتها كاملة ولا تنتج تركيباً مكسوراً')
  const pilotLibrary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json'), 'utf8'))
  const pilot = optimizeNativeSpokenEpisode(Object.values(pilotLibrary.episodes[PILOT_SLUG]), { slug: PILOT_SLUG })
  const pilotText = pilot.turns.map((turn) => turn.text).join('\n')
  assert.doesNotMatch(pilotText, /(?:ناطرها|معطين|ارتاح|شيين|حجمه|تعرّفنا|اهو|أهدى|سواه)/u,
    'تحرير الحلقة لا يعيد الكلمات التسع التي أوقفها حارس الكلمات')
  assert.doesNotMatch(pilotText, /(?:باب ضيق|وعقب|وسيلة تهد[يّي] الخوف|الدراسة تصير محطة بعد محطة|أوضح مع نفسهم|نلمّع شكل النجاح)/u,
    'المواضع الخمسة من الحكم السمعي الأخير لا ترجع إلى النص')
  assert.match(pilot.turns[4].text, /محشور بمكان ضيّج… وبعدها طلع منه/u,
    '«ضيّج» المعتمدة مكتوبة في المصدر نفسه لا متروكة لاحتمال المعجم')
  assert.equal(pilot.turns.length, 25, 'البحث المضغوط يقلل تبديل الصوت من غير حذف معلومة')
  assert.deepEqual(pilot.turns.slice(13, 18).map((turn) => turn.speaker),
    ['female', 'male', 'female', 'male', 'female'], 'البحث أخذ ورد بين صوتين لا فقرة مذيع')
  assert.equal(pilot.turns[14].text, 'شلون يعني؟ وشنو طلع معاهم؟',
    'سؤال البحث واحد طبيعي بدل تبديل صوت كل سطر')
  assert.match(pilot.turns[15].text, /في مراجعة كبيرة.*كل ما زاد التوتر، نزل مستوى الطالب/u,
    'جواب البحث يحتفظ بالمصدر والنتيجة')
  assert.match(pilot.turns[15].text, /خذو فيها أبحاث/u,
    'حكم الأذن «خذو فيها» مثبت في النص الذي يصل المحرك')
  assert.doesNotMatch(pilotText, /(?:أخذوا|اخذوا) فيها أبحاث/u,
    'الصيغة التي سُمعت خطأ لا ترجع إلى الحلقة 01 المرجعية')
  assert.equal(pilot.turns[18].text, 'بس مو كبرنا الموضوع وايد؟', 'الاعتراض كويتي شفهي وخفيف')
  assert.equal(pilot.turns[23].text,
    'واللي علينا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.',
    'الخاتمة كلام بشري لا شعار ولا كلمة جديدة')
  const seriousness = optimizeNativeSpokenEpisode(
    Object.values(pilotLibrary.episodes[SERIOUSNESS_SLUG]), { slug: SERIOUSNESS_SLUG })
  const seriousnessText = seriousness.turns.map((turn) => turn.text).join('\n')
  assert.doesNotMatch(seriousnessText,
    /(?:ماكو شي عميق تحرك|قناع أنيق للهروب|شارة مكانة اجتماعية|بديل عن الجوهر|قلبنا من داخل يأجل الحقيقة|حركة تصنع، وحركة تخبي|ماكو أسوأ من إنسان)/u,
    'الحلقة 04 ما ترجع إلى الجمل المقالية التي دفعت الصوت إلى Presenter Mode')
  assert.deepEqual(seriousness.turns.filter((turn) => turn.musicBridgeAfter).map((turn) => turn.text), [
    'طلع إن الناس تشوف الشخص المشغول أهم وأشطر.',
    'إن الواحد مرات يأجل مو لأنه ما يفهم… لأن المهمة ثقيلة عليه، أو نتيجتها بعيدة.',
  ], 'الجسران بعد اكتمال الفكرة، لا بعد سؤال وقبل جوابه')
  assert.deepEqual(seriousness.turns.slice(8, 11).map((turn) => turn.deliveryType),
    ['briefReaction', 'question', 'statement'], 'الدليل الأول تمهيد ثم سؤال ثم نتيجة')
  assert.deepEqual(seriousness.turns.slice(21, 24).map((turn) => turn.deliveryType),
    ['briefReaction', 'question', 'statement'], 'دليل التسويف تمهيد ثم سؤال ثم نتيجة')
  assert.equal(seriousness.turns[24].text, 'عيل من وين نبدي العلاج؟',
    'أفضل لحظة حوارية في الحلقة باقية بصياغتها الكويتية')
  assert.equal(seriousness.turns[26].text, 'ونحط للمهمة الثقيلة موعد واضح.',
    'موعد المهمة قصير وشفهي فلا يصنع رفض زمن كاذب')
  assert.doesNotMatch(seriousnessText, /ونعطي المهمة الثقيلة موعد واضح باليوم/u,
    'الصياغة الطويلة التي صنعت رفض الزمن الكاذب لا ترجع')
  assert.equal(seriousness.turns[0].text,
    'طول اليوم وإحنا نتحرك… ونسمي هالحركة التزام.',
    'جذر ركض المعيب لا يعود إلى افتتاح الحلقة')
  assert.equal(seriousness.turns[4].text,
    'مرات ما تكون جدية أصلا… تكون طريقة مرتبة نلهي فيها نفسنا.',
    'نتهرّب المعيبة تُزال من السياق نفسه بلا ألف وصل مخترعة')
  assert.equal(seriousness.turns[2].text,
    'وبآخر الليل نرد… ونكتشف إن ما تحرّك فينا شي صج.',
    '«نرجع» لا تعود إلى الموضع الذي ابتلع المحرك عينه الأخيرة')
  assert.equal(seriousness.turns[5].text, 'نلهي نفسنا عن شنو؟',
    'السؤال القصير يظل أخذاً ورداً طبيعياً')
  assert.equal(seriousness.turns[12].text,
    'لأننا نخاف من مهمة وحدة كبيرة تكشف قدرتنا الحقيقية.',
    'الجملة الاحترافية القديمة لا تُستبدل بكتابة جديدة واسعة')
  assert.equal(seriousness.turns[11].text, 'إي، ويمكن نحضر كل اجتماع صغير…',
    'دخول فهد بعد الدليل ردّ مباشر واضح؛ فلا يعيد Gemini إنشاء الدور بصوت نورة')
  assert.equal(seriousness.turns[14].text,
    'عشان ما نقرب من علاقة تبي شجاعة وصراحة.',
    '«صدق» وحدها تُعالج إلى «صراحة» مع بقاء الجملة')
  assert.equal(seriousness.turns[17].text,
    'وجدام الكل شكلنا مرتب…',
    '«نبان» غير المستعملة لا تعود إلى الحلقة')
  assert.match(seriousness.turns[19].text, /قَسوة/u,
    'فتحة قَسوة مثبتة في النص الذي يصل الصوت')
  assert.equal(seriousness.turns[20].text,
    'صحيح. في شغل يطلع منه شي له فايدة… وفي شغل بس يلهينا عن الشي اللي ما نبي نواجهه.',
    'جذر هرب لا يعود وسط الحلقة')
  assert.equal(seriousness.turns[21].text, 'وحتى أبحاث التسويف لاحظت هالشي.',
    '«الفرق» وحدها تُزال من الجملة البحثية')
  assert.equal(seriousness.turns[25].text,
    'نفرق بين شغل يودّينا للشي المهم… وشغل يبعدنا عنه.',
    'يقرّبنا المعيبة لا تصل المحرك')
  assert.equal(seriousness.turns[28].text,
    'وبالأخير يكتشف إن كل هالانشغال كان عشان ما يواجه نفسه.',
    'الخاتمة تحفظ المعنى من غير يهرب المعيبة')
  assert.doesNotMatch(seriousnessText, /(?:ركض|هرب|يقربنا|له قيمة|هالفرق|شجاعة وصدق|\bنبان\b|\bنرجع، ونكتشف\b)/u,
    'الكلمات المختلف عليها وحدها لا ترجع')
  const classroom = optimizeNativeSpokenEpisode(
    Object.values(pilotLibrary.episodes[CLASSROOM_SLUG]), { slug: CLASSROOM_SLUG })
  const classroomText = classroom.turns.map((turn) => turn.text).join('\n')
  assert.equal(classroom.turns[0].text,
    'توقفنا أسبوعين… انشغلنا بالحرب، وبالتوتر اللي يزيد مع كل خبر.',
    'القلق/الخوف الملتبس يُستبدل داخل الجملة نفسها')
  assert.equal(classroom.turns[2].text, 'بس اليوم عندنا موضوع مهم بعد.',
    '«نرجع لجبهة» لا يملك أصلاً كلمةً قريبة يرجع إليها')
  assert.match(classroom.turns[3].text, /يا يتعلم الطالب يتكلم، يا يخاف ويسكت/u,
    'الصف يصير كلاماً يومياً، من غير صورة «يبلع صوته»')
  assert.doesNotMatch(classroomText, /(?:القلق اللي يعلى|نرجع لجبهة|يبلع صوته)/u,
    'الأخطاء الثلاثة التي أسقطت الحلقة 02 لا ترجع')
  const intelligence = optimizeNativeSpokenEpisode(
    Object.values(pilotLibrary.episodes[INTELLIGENCE_SLUG]), { slug: INTELLIGENCE_SLUG })
  const intelligenceText = intelligence.turns.map((turn) => turn.text).join('\n')
  assert.equal(intelligence.turns[4].text, 'لحظة… خلنا ناخذها وحدة وحدة.',
    'لحظة الاعتراض تبقى كويتية مباشرة ولا تحمل «نوقف» التي خرجت عُمانية')
  assert.doesNotMatch(intelligenceText, /خلنا نوقف هني/u,
    'الصياغة المرفوضة في الحلقة 03 لا تصل TTS')
  const genericCorrections = optimizeNativeSpokenEpisode([
    { text: 'أخذوا فيها أبحاث وايد.' },
    { text: 'فيها شي يستاهل نوقف عنده.' },
  ], { slug: 'future-safe-rules' })
  assert.deepEqual(genericCorrections.turns.map((turn) => turn.text), [
    'خذو فيها أبحاث وايد.',
    'فيها شي لازم نفهمه عدل.',
  ], 'نفس الخطأ إذا ظهر في مقالة مستقبلية يتعالج قبل الصوت')
  assert.deepEqual(seriousness.turns.slice(27, 29).map((turn) => turn.deliveryType),
    ['statement', 'statement'], 'الخاتمة الفكرية تمر عادية ولا تُلقى كشعار')
  const pilotWorkflow = readFileSync(resolve(ROOT, '.github/workflows/podcast-kuwaiti-pilot.yml'), 'utf8')
  assert.match(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'0'/,
    'مسار الإنتاج يثبت أن الجسر مونتاج خارجي ولا يقطع طلب TTS')
  assert.doesNotMatch(pilotWorkflow, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'1'/,
    'الإعداد الذي صنع ثلاثة أصوات بعد الجسور لا يرجع')
  assert.match(pilotWorkflow, /PODCAST_KW_PROMPT_MODE:\s*c/,
    'مسار المرشح مقفول على البرومت C المعتمد لا أوضاع التجارب التاريخية')
  assert.match(pilotWorkflow, /PODCAST_KW_TTS_PROVIDER:/,
    'بوابة الصوت تُختار صراحةً ولا تتبدل بصمت')
  assert.match(pilotWorkflow, /gemini-2\.5-pro-tts/,
    'المسار المستقر يحمل نموذج Cloud Pro المخصص للبودكاست')
  assert.match(pilotWorkflow, /gemini-2\.5-pro-preview-tts/,
    'مرجع AI Studio القديم باقٍ للمقارنة السمعية لا يُمحى')
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
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'0'/,
    'قراءة أوكتاف شاذة لدور مفرد لا تحرق Take ثابت المقاطع والرنين')
  assert.match(pilotWorkflow, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
    'بوابة الرنين تمسك نفس preset لما يصير مو نفس الإنسان')
  console.log('✓ بوابة النص الكويتي الطبيعي: الفحص الذاتي 34/34')
  process.exit(0)
}

const sources = [
  ['الكامل', 'src/data/kuwaiti-dialogues.json'],
  ['القصير التاريخي', 'src/data/kuwaiti-dialogues-short.json'],
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
    const optimizedText = prepared.turns.map((turn) => String(turn.text || '')).join('\n')
    assert.ok(prepared.turns.every((turn) => !/^ممم…/u.test(String(turn.text || '').trim())),
      `${label}/${slug}: رجع الحشو الميكانيكي «ممم» إلى النص المنطوق`)
    assert.doesNotMatch(optimizedText, /(?:^|[\s،؛:.!?؟…])(?:تكفي|بدال|ينختبر)(?=$|[\s،؛:.!?؟…])/u,
      `${label}/${slug}: بقيت كلمة صدر فيها حكم تبديل نهائي بعد الصقل`)
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
assert.match(pilotWorkflow, /PODCAST_KW_TTS_PROVIDER:/,
  'المرشح يسجل بوابة الصوت صراحةً')
assert.match(pilotWorkflow, /gemini-2\.5-pro-tts/,
  'Vertex يستعمل اسم Pro المستقر')
assert.match(pilotWorkflow, /gemini-2\.5-pro-preview-tts/,
  'AI Studio Preview يبقى مرجع A/B فقط')
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
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'0'/,
  'الإنذار المفرد للطبقة سمعي؛ الرفض على انزلاق المقطع الكامل')
assert.match(pilotWorkflow, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
  'التغير الطيفي بعد الانتقال ممنوع حتى مع طبقة ثابتة')
for (const workflow of ['podcast-kuwaiti-five-canaries.yml', 'podcast-prompt-experiment.yml']) {
  const source = readFileSync(resolve(ROOT, '.github/workflows', workflow), 'utf8')
  assert.match(source, /apply-kuwaiti-native-spoken\.mjs/, `${workflow}: التجربة تمر بالصقل نفسه`)
  if (workflow === 'podcast-kuwaiti-five-canaries.yml') {
    assert.match(source, /default:\s*vertex/,
      'الكناريات تختبر المسار المستقر أولاً وقت تعطل AI Studio')
    assert.match(source, /gemini-2\.5-pro-tts/,
      'كناري Vertex تستعمل Pro المستقر')
    assert.match(source, /gemini-2\.5-pro-preview-tts/,
      'خيار المرجع Preview باقٍ للمقارنة')
    assert.match(source, /PODCAST_KW_ISOLATE_SPEAKER_STEMS:\s*'0'/,
      'الكناريات الخمس تختبر الحوار المتصل نفسه قبل التعميم')
    assert.match(source, /PODCAST_KW_REJECT_FEMALE_IDENTITY_DRIFT:\s*'1'/,
      'الكناريات لا تتجاوز انزلاق نورة')
    assert.match(source, /PODCAST_KW_REJECT_TIMING_SUSPECTS:\s*'1'/,
      'الكناريات لا تتجاوز دوراً مقصوصاً')
    assert.match(source, /PODCAST_KW_REJECT_SPEAKER_SWAPS:\s*'0'/,
      'الكناريات لا ترفض خطأ أوكتاف مفرداً مع ثبات المقطع')
    assert.match(source, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
      'الكناريات لا تتجاوز إعادة الرنين')
  }
}
const productionBatch = readFileSync(resolve(ROOT, '.github/workflows/podcast-kuwaiti-production-batch.yml'), 'utf8')
assert.match(productionBatch, /run-kuwaiti-generation-queue\.mjs/,
  'إنتاج 143 يمر بطابور قابل للاستئناف لا بحلقة عابرة على runner')
assert.match(productionBatch, /Restore already accepted episodes before spending again/,
  'Rerun يسترجع الناجح قبل أي صرف جديد')
assert.match(productionBatch, /PODCAST_KW_PROMPT_MODE:\s*c/,
  'الدفعة الفولاذية تستعمل البرومت المعتمد نفسه بلا نسخة جديدة')
assert.match(productionBatch, /confirm_vertex_canaries/,
  'ممنوع نقل 143 حلقة إلى بوابة جديدة قبل اعتماد خمس حلقات بالأذن')
assert.match(productionBatch, /PODCAST_KW_SPLIT_AT_BRIDGES:\s*'0'/,
  'الدفعة الفولاذية تحفظ Same-Take والجسر الخارجي')
assert.match(productionBatch, /PODCAST_KW_REJECT_ACOUSTIC_RESET:\s*'1'/,
  'الاستئناف لا يرخي بوابة تبدل الإنسان')
assert.match(productionBatch, /Enforce complete batch after preserving its state/,
  'الحزمة الناقصة لا تظهر خضراء بعد حفظ الناجح')
assert.match(geminiEngine, /geminiFailureExitCode[\s\S]*return 75/,
  'عطل Gemini المؤقت مميز عن رفض الجودة')
assert.match(geminiEngine, /seed:SEED/,
  'كل مرشح يحمل البذرة التي أنشأته للاسترجاع والتدقيق')
console.log('✓ كل مسارات Gemini الكويتية تمر بطبقة النص المنطوق')
