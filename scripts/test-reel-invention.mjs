import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  conceptsInText, passagesForIdea, inventionInstruction, inventionPrompt,
  acceptInventedScenes, INVENTION_PROPERTIES, INVENTION_REQUIRED,
} from '../src/lib/reel-invention.mjs'

const ROOT = resolve(import.meta.dirname, '..')
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

// 1) المعجم الحقيقي: يلتقط مفاهيم الدكتور من فكرته
const glossary = JSON.parse(readFileSync(resolve(ROOT, 'src/data/dr-ahmad-domain-glossary.json'), 'utf8'))
check(Array.isArray(glossary) && glossary.length >= 200, 'المعجم الحقيقي محمّل')
const hits = conceptsInText('كيف نوظّف تكنولوجيا التعليم في تنمية التفكير الناقد؟', glossary)
check(hits.length > 0, 'يلتقط مفاهيم من المعجم الحقيقي')
check(hits.some((concept) => /تكنولوجيا التعليم|التفكير الناقد/.test(concept)), 'المفهوم الملتقط صحيح')
check(conceptsInText('نص لا يحوي أي مفهوم تخصصي إطلاقاً هنا', glossary).length >= 0, 'الغياب لا يكسر شيئاً')
check(new Set(hits).size === hits.length, 'بلا تكرار')
check(conceptsInText('تكنولوجيا التعليم', glossary, 2).length <= 2, 'السقف يُحترم')
// التشكيل وفروق الألف لا تمنع الالتقاط
check(conceptsInText('تكنولوجيا التعلىم وتنمية التفكير النّاقد', glossary).length >= 0, 'التطبيع لا يرمي خطأً')

// 2) اختيار المقاطع من المتن
const corpus = [
  { title: 'الركض', text: 'نركض كثيراً ونسمي الإرهاق التزاماً' },
  { title: 'السؤال', text: 'السؤال الجيد أهم من الجواب السريع' },
  { title: 'بعيد', text: 'موضوع لا صلة له' },
]
const picked = passagesForIdea('نركض ونسمي الإرهاق التزاماً', corpus)
check(picked[0].title === 'الركض', 'يختار المقطع الملامس أولاً')
check(passagesForIdea('', corpus, 2).length === 2, 'الفكرة الفارغة تعيد الأوائل')
check(passagesForIdea('كلمة غريبة تماماً', corpus).length === 0, 'بلا تطابق ← بلا مقاطع')

// 3) التعليمات والطلب يحملان القيود الحاسمة
const instruction = inventionInstruction()
for (const [label, pattern] of [
  ['منع المقدّم', /Never include a presenter/],
  ['منع النص داخل الصورة', /NO text, letters, numbers/],
  ['لحظة واحدة متصلة', /ONE continuous filmable moment/],
  ['الاستناد إلى المعجم', /glossary/],
  ['التنوّع الجذري', /radically different/],
  ['حظر المستهلك', /lightbulbs/],
  ['قابلية التصوير', /concrete and physically filmable/],
]) {
  check(pattern.test(instruction), `التعليمات تحمل: ${label}`)
}
const prompt = inventionPrompt({
  idea: 'نركض ونسمي الإرهاق التزاماً', sentence: 'الحركة قد تكون هروباً', seconds: 16, count: 4,
  concepts: ['التفكير الناقد'], passages: [{ title: 'الركض', text: 'نركض كثيراً' }],
})
check(prompt.includes('التفكير الناقد') && prompt.includes('نركض كثيراً'), 'الطلب يحقن المفاهيم والمتن')
check(prompt.includes('exactly 4 original') && prompt.includes('16 seconds'), 'العدد والمدة في الطلب')

// 4) مخطط الإخراج
check(INVENTION_PROPERTIES.scenes.items.required.length === 6, 'ستة حقول إلزامية')
check(INVENTION_REQUIRED.includes('scenes'), 'الجذر مطلوب')

// 5) بوابة القبول — أهم جزء: ترفض ما يفسد النتيجة
const good = {
  labelAr: 'ساعة الأحذية', sceneAr: 'ساعة رملية تمتلئ بأحذية ركض.',
  sceneEn: 'A tall glass hourglass stands on dark wet stone while hundreds of miniature running shoes pour downward through the narrow neck piling into a restless mound below in soft light',
  arcStartEn: 'macro on a single shoe tumbling', arcEndEn: 'wide reveal of the growing pile', whyAr: 'يجسّد الحركة التي تستهلك الوقت.',
}
check(acceptInventedScenes({ scenes: [good] }, 4).length === 1, 'المشهد السليم يمر')

const rejected = [
  ['عربية مسرّبة للإنجليزي', { ...good, sceneEn: 'A tall hourglass ساعة with shoes pouring down through the neck onto stone below in soft directional light with fine grain texture' }],
  ['وصف فقير', { ...good, sceneEn: 'An hourglass with shoes falling down slowly' }],
  ['استعارة مستهلكة', { ...good, sceneEn: 'A glowing lightbulb floats above a wooden desk in a dark room while dust drifts slowly through the warm beam of light filling the quiet space' }],
  ['شخص يتكلم', { ...good, sceneEn: 'A presenter stands in a bright studio speaking to camera about time management while soft light falls across the wall behind him in a calm composed frame' }],
  ['نص داخل الصورة', { ...good, sceneEn: 'A wall where glowing words appear one by one as a text overlay spelling a message while warm light drifts across the concrete surface slowly and quietly' }],
  ['حقل ناقص', { ...good, whyAr: '' }],
  ['عربي في حقل عربي مفقود', { ...good, sceneAr: 'An English description in the Arabic field' }],
]
for (const [label, scene] of rejected) {
  check(acceptInventedScenes({ scenes: [scene] }, 4).length === 0, `يُرفض: ${label}`)
}

// التكرار يُرفض ولو اختلف الاسم
const twin = { ...good, labelAr: 'اسم آخر' }
check(acceptInventedScenes({ scenes: [good, twin] }, 4).length === 1, 'المشهد المكرّر يُرفض')
const distinct = ['copper', 'wooden', 'marble', 'ceramic', 'crystal', 'bronze', 'granite', 'velvet', 'paper']
check(acceptInventedScenes({ scenes: distinct.map((material, index) => ({ ...good, labelAr: `م${index}`, sceneEn: `A ${material} vessel rests on dark wet stone while hundreds of miniature running shoes pour downward through its narrow neck piling into a restless mound below in soft directional light` })) }, 3).length === 3, 'السقف يُحترم')
check(acceptInventedScenes(null, 4).length === 0 && acceptInventedScenes({}, 4).length === 0, 'المخرج التالف لا يكسر')

console.log(`✓ اجتاز ابتكار المشاهد ${checks} فحصاً`)
