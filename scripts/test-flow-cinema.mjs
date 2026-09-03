import assert from 'node:assert/strict'
import {
  FLOW_LOOKS, FLOW_CLIP_SECONDS, FLOW_SECONDS_NOTE, DEFAULT_FLOW_LOOK,
  flowLook, cameraMove, cinematographyBlock, shotPlanForSeconds,
} from '../src/lib/flow-cinema.ts'
import { createArticleVideoProject, getFlowPrompt } from '../src/lib/live-director.ts'

let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

// 1) كل نمط ورقة تصوير كاملة لا لونٌ وحده
check(FLOW_LOOKS.length >= 6, 'ستة أنماط بصرية على الأقل')
for (const look of FLOW_LOOKS) {
  // الفتحة قيمةٌ قصيرة بطبيعتها («f/2.8»)، فلها حدُّها؛ وبقية الحقول جملٌ تنفيذية.
  check(typeof look.aperture === 'string' && look.aperture.length >= 3, `${look.id}: aperture مكتوبة`)
  for (const key of ['lens', 'depthOfField', 'lighting', 'grade', 'texture', 'motionBias']) {
    check(typeof look[key] === 'string' && look[key].length > 8, `${look.id}: ${key} مفصّل`)
  }
  check(/mm/.test(look.lens), `${look.id}: العدسة بالمليمتر`)
  check(/^f\//.test(look.aperture), `${look.id}: الفتحة بصيغة f/`)
  check(look.labelAr.trim().length > 0 && look.noteAr.trim().length > 0, `${look.id}: اسمٌ وشرحٌ عربيان`)
}
check(new Set(FLOW_LOOKS.map((l) => l.id)).size === FLOW_LOOKS.length, 'لا تكرار في المعرّفات')
check(flowLook(DEFAULT_FLOW_LOOK).id === DEFAULT_FLOW_LOOK, 'النمط الافتراضي يُحلّ')
check(flowLook('لا-وجود-له').id === FLOW_LOOKS[0].id, 'المعرّف المجهول يسقط للأول بأمان')
check(flowLook(null).id === FLOW_LOOKS[0].id, 'null يسقط للأول')

// 2) الحركة تتنوّع بحسب الدور ولا تتكرّر آلياً
const look = flowLook('golden-study')
const hook = cameraMove({ order: 1, shotIndex: 0, shotCount: 3, role: 'الخطاف', look, avatar: true })
const close = cameraMove({ order: 6, shotIndex: 0, shotCount: 1, role: 'الخاتمة', look, avatar: true })
const mid = cameraMove({ order: 3, shotIndex: 1, shotCount: 2, role: 'المشكلة', look, avatar: true })
check(hook !== close && close !== mid && hook !== mid, 'الحركة تختلف باختلاف الدور')
check(/push-in|dolly|crane|rack/.test(hook), 'الخطاف يفتح بحركة جاذبة')
check(/pull-back|open/.test(close), 'الخاتمة تنسحب لتترك مساحة')

/* العلّة التي وقعتُ فيها: فرعا «الخطاف» و«الخاتمة» كانا يتجاهلان ترتيب اللقطة،
   فتتكرّر الحركة نفسها ثلاث مرات داخل المقطع الواحد فيصير المشهد آلياً. */
for (const role of ['الخطاف', 'الخاتمة']) {
  for (const avatarMode of [true, false]) {
    const moves = [0, 1, 2].map((shotIndex) => cameraMove({ order: 1, shotIndex, shotCount: 3, role, look, avatar: avatarMode }))
    check(new Set(moves).size === moves.length, `${role}${avatarMode ? '' : ' (بلا أفتار)'}: لا تتكرّر الحركة داخل المقطع`)
  }
}

// 3) الكتلة السينمائية تحمل كل القرارات — والعبارة الحارسة باقية
const block = cinematographyBlock({ look, seconds: 16, order: 2, shotCount: 2, role: 'المشكلة', avatar: true })
for (const needle of ['lens', 'aperture', 'Depth of field', 'Lighting plan', 'Colour grade', 'Texture', 'Camera movement', 'Composition', '24fps']) {
  check(block.includes(needle), `الكتلة تذكر ${needle}`)
}
check(/one committed motion per shot, executed with intent and carried to completion; never combine competing moves/.test(block), 'العبارة الحارسة محفوظة نصاً')
// قانون الحيوية: نُقل من كتلة الريل بعد حكم الدكتور «غير مشوّق».
check(/OPENING RULE/.test(block) && /already mid-event/.test(block), 'الكتلة تفرض حدثاً قبل الإطار الأول')
check(/measurably different in every single second/.test(block), 'الكتلة تفرض تغيّراً في كل ثانية')
check(block.includes('16 seconds'), 'المدة المختارة تظهر في الكتلة')
check(/Shot 1 camera:/.test(block) && /Shot 2 camera:/.test(block), 'حركة مستقلة لكل لقطة')

// 4) خطة اللقطات تمتد على أي مدة بلا فجوات ولا تداخل
for (const seconds of FLOW_CLIP_SECONDS) {
  for (const count of [1, 2, 3]) {
    const plan = shotPlanForSeconds(count, seconds, true)
    check(plan.length === count, `${seconds}ث/${count}: عدد اللقطات صحيح`)
    check(plan[0].from === 0, `${seconds}ث/${count}: تبدأ من الصفر`)
    check(plan[plan.length - 1].to === seconds, `${seconds}ث/${count}: تنتهي عند المدة`)
    for (let i = 1; i < plan.length; i += 1) check(plan[i].from === plan[i - 1].to, `${seconds}ث/${count}: بلا فجوة`)
    check(plan.every((s) => s.to > s.from && s.framing.trim().length > 0), `${seconds}ث/${count}: مدد موجبة وتأطير مكتوب`)
  }
}

// 5) التكامل الحقيقي: البرومبت الناتج من المحرك يحمل الطبقة السينمائية
const meta = (kind, slug) => ({ kind, origin: 'base', modified: false, hidden: false, deleted: false, docId: slug, baseSlug: slug })
const article = {
  slug: 'run-and-call-it-commitment', title: 'نركض ونسمّيه التزاماً', date: '', iso: '2026-08-01', cat: 'التفكير',
  excerpt: 'عن الحركة التي تخفي الهروب', body: 'نركض كثيراً. ' + 'ثم نسمي هذا الإرهاق التزاماً وهو هروب من السؤال الصعب. '.repeat(30),
  status: 'published', words: 400, year: '2026', hasAudio: false, missing: false, _cms: meta('article', 'run-and-call-it-commitment'),
}
const project = createArticleVideoProject({ article })
const prompt = getFlowPrompt(project.segments[0], 'speech_ar')
for (const needle of ['Cinematography', 'Lighting plan', 'Colour grade', 'Composition']) {
  check(prompt.includes(needle), `برومبت المحرك يحمل ${needle}`)
}
check(/lens: \d+mm equivalent, aperture f\//.test(prompt), 'البرومبت يحدّد عدسةً وفتحة')
check(prompt.includes('Duration: exactly 15 seconds.'), 'المدة الافتراضية خمس عشرة ثانية')
check(!/[؀-ۿ]/.test(prompt), 'البرومبت إنجليزيٌّ خالص بلا تسريب عربي')


/* حدود Flow المعروضة في لوحة الدكتور (لقطة شاشة، ٣٠ أغسطس ٢٠٢٦): ٤ و٦ و٨ و١٠
   و١٥ ثانية في التوليدة الواحدة. والحدّ يبقى محروساً: رقمٌ فوق ما تعرضه اللوحة
   يكتب في البرومبت مدةً يتجاهلها المحرّك فيفسد توقيت اللقطات. */
for (const seconds of FLOW_CLIP_SECONDS) {
  check(seconds <= 15, `المدة ${seconds} داخل حدّ Flow`)
  check(typeof FLOW_SECONDS_NOTE[seconds] === 'string' && FLOW_SECONDS_NOTE[seconds].length > 0, `المدة ${seconds} لها ملاحظة`)
}
check(FLOW_CLIP_SECONDS.includes(8), 'الثماني متاحة — حدّ Veo 3.1')
check(FLOW_SECONDS_NOTE[15].includes('أطول توليدة'), 'الخمس عشرة تُعرَّف بأنها أطول توليدة في المرة الواحدة')
check(FLOW_CLIP_SECONDS.includes(15) && !FLOW_CLIP_SECONDS.some((seconds) => seconds > 15), 'الخمس عشرة متاحة وهي السقف المعروض في Flow')

console.log(`✓ اجتازت الطبقة السينمائية ${checks} فحصاً`)
