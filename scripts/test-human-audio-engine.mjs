#!/usr/bin/env node
import assert from 'node:assert/strict'
import {
  READING_VOICES,
  buildDialogueSsml,
  buildPronunciationText,
  buildReadingSsml,
  humanLikenessGate,
  numberToArabicWords,
  planReadingPerformance,
  segmentArticleForPerformance,
} from './lib/arabic-audio-engine.mjs'

const source = [
  'يبدأ التقييم بسؤال بسيط: ماذا تعلّم الطالب، وما الخطوة التالية؟',
  'لكن المشكلة تظهر حين تتحول الدرجة إلى حكم دائم على الإنسان، لا إلى معلومة تساعده.',
  'في عام 2023 شارك 60% من الطلاب في التجربة؛ وهذه النسبة تحتاج إلى نطق واضح.',
  'لذلك يبقى التقييم الإنساني صادقاً، لكنه لا يكسر كرامة الطالب.',
].join('\n')

const segments = segmentArticleForPerformance(source)
assert.equal(segments.map((unit) => unit.sourceText).join(' ').replace(/\s+/g, ' ').trim(), source.replace(/\s+/g, ' ').trim(),
  'التقسيم يجب ألا يغير حرفاً أو ترتيباً من النص')
assert(segments.every((unit) => unit.sourceText.split(/\s+/).length <= 28), 'لا وحدة تتجاوز 28 كلمة')

const fahed = planReadingPerformance({ title: 'كيف نقيس؟', sourceText: source, voiceKey: 'fahed' })
const noura = planReadingPerformance({ title: 'كيف نقيس؟', sourceText: source, voiceKey: 'noura' })
const vocalizedSource = 'ذَهَبَ الطَّالِبُ إِلَى المَدْرَسَةِ.'
const plainSource = 'ذهب الطالب إلى المدرسة.'
const vocalizedPlan = planReadingPerformance({ sourceText: plainSource, vocalizedText: vocalizedSource, voiceKey: 'fahed' })
assert.equal(vocalizedPlan.displayText, plainSource, 'النص المشكّل يبقى مخفياً عن العرض')
assert(/[َُِّْ]/u.test(vocalizedPlan.units[0].pronunciationText), 'النص المشكّل يصل فعلياً إلى طبقة النطق')
const mismatchedPlan = planReadingPerformance({ sourceText: plainSource, vocalizedText: 'ذَهَبَ المُعَلِّمُ.', voiceKey: 'fahed' })
assert(!/[َُِّْ]/u.test(mismatchedPlan.units[0].pronunciationText), 'النص المشكّل غير المطابق يُرفض بأمان')
assert.equal(fahed.displayText, source, 'displayText يبقى النص الأصلي حرفياً')
assert.equal(noura.displayText, source, 'نورة لا تغير النص الأصلي')
assert(fahed.units.some((unit) => unit.type === 'question' && unit.ending === 'open'), 'السؤال له نهاية مفتوحة')
assert(new Set(fahed.units.map((unit) => unit.ratePct)).size > 1, 'القراءة ليست prosody واحدة')
assert.notDeepEqual(fahed.units.map((unit) => unit.ratePct), noura.units.map((unit) => unit.ratePct),
  'فهد ونورة يملكان معايرة مستقلة')

const question = fahed.units.find((unit) => unit.type === 'question') || fahed.units[0]
const questionSsml = buildReadingSsml(question, READING_VOICES.fahed)
assert(questionSsml.includes('ar-KW-FahedNeural'), 'SSML يستخدم صوت فهد المعتمد')
assert(/pitch="\+[1-9]/.test(questionSsml), 'السؤال يملك ارتفاعاً سمعياً لا metadata فقط')
assert(question.emphasisWords.length === 0 || questionSsml.includes('rate="-3%" pitch="+1%"'),
  'الكلمة المركزية تؤثر فعلياً في SSML')
assert(questionSsml.includes('<break') || question.internalBreaks.length === 0, 'الوقف الداخلي يصل إلى SSML')

const dialogueSsml = buildDialogueSsml({ text: 'لكن، هل تكفي الدرجة؟', delivery: 'question', ending: 'open' },
  'ar-KW-NouraNeural', { voiceKey: 'noura' })
assert(dialogueSsml.includes('ar-KW-NouraNeural') && dialogueSsml.includes('<prosody'), 'الحوار يستخدم المحرك المشترك')

const pronunciation = buildPronunciationText('بلغت النسبة 60% في عام 2023.')
assert(pronunciation.pronunciationText.includes('في المئة'), 'النسبة تتحول إلى نص نطقي')
assert(pronunciation.risks.length >= 2, 'الأرقام تسجل مخاطر نطق قابلة للتدقيق')
assert.equal(numberToArabicWords('2023'), 'ألفان وثلاثة وعشرون', 'تحويل السنة حتمي')

const humanUnits = Array.from({ length: 10 }, (_, index) => ({
  speaker: index % 2 ? 'B' : 'A',
  text: index === 2 ? 'هل تسمع السؤال؟' : `جملة ${index + 1}`,
  sourceText: index === 2 ? 'هل تسمع السؤال؟' : `جملة ${index + 1}`,
  type: index === 2 ? 'question' : ['statement', 'reflection', 'objection', 'clarification'][index % 4],
  delivery: index === 2 ? 'question' : ['statement', 'reflection', 'objection', 'clarification'][index % 4],
  ratePct: [-6, -3, 0, 2, 5][index % 5],
  pauseAfterMs: [180, 240, 520, 660, 310, 410][index % 6],
  ending: index === 2 ? 'open' : ['neutral', 'final', 'open'][index % 3],
  allowOverlap: index === 4 || index === 7,
  overlapMs: index === 4 || index === 7 ? 90 : 0,
}))
const goodTechnical = {
  probe: { sampleRate: 44100, channels: 1 },
  silence: { longestSec: 0.82 },
  loudness: { integratedLufs: -16.1, truePeakDbtp: -1.2 },
}
const goodGate = humanLikenessGate({ plan: { utterances: humanUnits }, technical: goodTechnical,
  sttComparisons: [{ importantRatio: 0.99 }], dialogue: true })
assert.equal(goodGate.pass, true, `بوابة fixture الجيدة يجب أن تنجح: ${goodGate.failed.join(',')}`)
const badGate = humanLikenessGate({ plan: { utterances: humanUnits.map((unit) => ({ ...unit, ratePct: 0, pauseAfterMs: 300 })) },
  technical: { ...goodTechnical, silence: { longestSec: 1.4 } }, sttComparisons: [{ importantRatio: 0.8 }], dialogue: true })
assert.equal(badGate.pass, false, 'الصوت المسطح أو ذو الصمت المتبقي لا يمر')
assert(badGate.criticalFailed.includes('sttFidelity') && badGate.criticalFailed.includes('boundarySilenceRemoved'),
  'فشل البوابة يذكر السبب القابل للإصلاح')

/* تعطّل مُتحقق STT كلياً يجب ألا يجمّد مقالاً صوته سليم: يتنزّل الفحص إلى البوابات
   الحتمية (أمر الدكتور «تجاوزها بذكاء») ويُعلَن التنزّل بصدق في التدقيق. */
const sttDownGate = humanLikenessGate({ plan: { utterances: humanUnits }, technical: goodTechnical,
  sttComparisons: [], sttUnavailable: true, dialogue: true })
assert.equal(sttDownGate.pass, true, 'تعطّل STT كلياً لا يجمّد صوتاً سليماً')
assert.equal(sttDownGate.sttDegraded, true, 'التنزّل يُسجَّل في التدقيق بصدق')
assert(!sttDownGate.criticalFailed.includes('sttFidelity'), 'sttFidelity لا يبقى عائقاً حرجاً عند تعطّل المتحقق')
/* لكن غياب أي تحقق دون إعلان التعطّل يبقى فشلاً حرجاً — لا تنزّل صامت. */
const silentGap = humanLikenessGate({ plan: { utterances: humanUnits }, technical: goodTechnical,
  sttComparisons: [], sttUnavailable: false, dialogue: true })
assert(silentGap.criticalFailed.includes('sttFidelity'), 'غياب التحقق بلا إعلان تعطّل يظل فشلاً حرجاً')

console.log('✔ Human Audio Engine self-tests: source integrity, semantic plan, independent voices, SSML, pronunciation, human gate, STT degradation')
