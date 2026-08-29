import assert from 'node:assert/strict'
import { SYMBOLIC_SCENES, forgeSymbolicReels, reelExtendPrompt, FLOW_EXTEND_SECONDS } from '../src/lib/symbolic-reels.ts'
import { FLOW_LOOKS } from '../src/lib/flow-cinema.ts'

let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }
const arabic = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

// 1) المكتبة: اثنتا عشرة استعارة كاملة البناء
check(SYMBOLIC_SCENES.length >= 12, 'اثنتا عشرة استعارة على الأقل')
const lookIds = new Set(FLOW_LOOKS.map((look) => look.id))
for (const scene of SYMBOLIC_SCENES) {
  check(scene.labelAr.trim().length > 0 && scene.sceneAr.length > 20, `${scene.id}: وصف عربي حقيقي`)
  check(scene.sceneEn.length > 60 && !arabic.test(scene.sceneEn), `${scene.id}: مشهد إنجليزي مفصّل`)
  check(scene.arcEn.start.length > 15 && scene.arcEn.end.length > 15, `${scene.id}: قوس درامي (بداية ونهاية)`)
  check(lookIds.has(scene.lookId), `${scene.id}: النمط البصري موجود في flow-cinema`)
  check(scene.themes instanceof RegExp, `${scene.id}: كلمات الجذب نمط صالح`)
}
check(new Set(SYMBOLIC_SCENES.map((scene) => scene.id)).size === SYMBOLIC_SCENES.length, 'لا تكرار في المعرفات')

// 2) التطابق الموضوعي: فكرة الركض تجذب الساعة الرملية أولاً
const running = forgeSymbolicReels({ idea: 'نركض كثيراً ونسمّي الإرهاق التزاماً', sentence: 'الحركة الدائمة قد تكون هروباً.' })
check(running[0].scene.id === 'hourglass-shoes', 'فكرة الركض ← الساعة الرملية أولاً')
/* «المعلم» تلامس مشهدين (مجرّة الطباشير وفانوس الضباب عبر «علم») والتعادل
   يُكسر بالبصمة — فالشرط الصادق: الصدارة لمشهدٍ يلامس الفكرة فعلاً. */
const teaching = forgeSymbolicReels({ idea: 'المعلم في الصف والدرس الأول' })
check(teaching[0].scene.themes.test('المعلم في الصف والدرس الأول'), 'فكرة التعليم ← مشهد ملامس لها أولاً')

// 3) التنوع والحتمية
check(new Set(running.map((concept) => concept.scene.id)).size === running.length, 'المفاهيم لا تتكرر')
const again = forgeSymbolicReels({ idea: 'نركض كثيراً ونسمّي الإرهاق التزاماً', sentence: 'الحركة الدائمة قد تكون هروباً.' })
check(again.map((c) => c.scene.id).join() === running.map((c) => c.scene.id).join(), 'نفس الفكرة ← نفس المفاهيم دائماً')
const other = forgeSymbolicReels({ idea: 'الشجاعة في مواجهة الأزمة' })
check(other[0].scene.id !== running[0].scene.id, 'فكرة أخرى ← طيف آخر')

// 4) البرومبت: إنجليزي خالص، سينمائي، بلا أفتار، بلا نص مولّد
for (const concept of running) {
  const prompt = concept.flowPrompt
  check(!arabic.test(prompt), `${concept.scene.id}: بلا تسريب عربي`)
  /* البرومبت صار على صيغة Veo الرسمية: تصوير + موضوع + فعل + سياق + أجواء.
     فالحارس يفحص المعنى لا الشعارات: نسبة الوصف إلى المنع، وحضور القرارات
     التصويرية، وبقاء القيود الجوهرية في ذيلٍ واحد مضغوط. */
  for (const [label, pattern] of [
    ['نسبة عمودية', /9:16/],
    ['لقطة واحدة متصلة', /single continuous take/],
    ['عدسة وفتحة', /Shot on a .*mm equivalent at f\//],
    ['إضاءة', /Lighting: /],
    ['تدرّج لوني', /Colour: /],
    ['نسيج', /Texture: /],
    ['فيزياء تحمل المعنى', /Physics carry the meaning/],
    ['واقعية ملموسة', /Photoreal and tactile/],
    ['المفاجأة في الثانية الأولى', /within the first second/],
    ['مساحة للكابشن', /negative space kept clear/],
    ['ذيل القيود', /^Constraints: /m],
  ]) {
    check(pattern.test(prompt), `${concept.scene.id}: ${label}`)
  }
  check(/no presenter, no talking, no recognizable face/.test(prompt), `${concept.scene.id}: بلا مقدّم ولا وجه`)
  check(/no on-screen text/.test(prompt), `${concept.scene.id}: بلا نص داخل الصورة`)
  check(!/one restrained motion per shot/.test(prompt), `${concept.scene.id}: بلا لغة الكبح التحريرية`)
  check(/never drifting and never idle/.test(prompt), `${concept.scene.id}: كاميرا حاسمة لا سائبة`)
  /* النسبة المقلوبة كانت العلّة: عشرة أسطر منعٍ وسطران وصفاً. الحارس يثبّتها. */
  const constraintLines = prompt.split('\n').filter((line) => /^Constraints: /.test(line)).length
  check(constraintLines === 1, `${concept.scene.id}: سطر قيودٍ واحد لا خمسة`)
  check(prompt.split('\n').length <= 8, `${concept.scene.id}: البرومبت مركّز لا مترهّل`)
}

// 5) المدة والعدد والتركيب
/* ثمانٍ هي الحدّ الحقيقي لـVeo 3.1، فالاختبار يستعملها بدل ١٦ التي أبطلناها. */
const long = forgeSymbolicReels({ idea: 'فكرة', seconds: 8, count: 5 })
check(long.length === 5 && long.every((c) => c.seconds === 8 && /8 seconds, single continuous take/.test(c.flowPrompt)), 'المدة والعدد يُحترمان')
check(forgeSymbolicReels({ idea: 'فكرة', count: 99 }).length === 5, 'السقف خمسة')
check(forgeSymbolicReels({ idea: 'فكرة', count: 1 }).length === 3, 'الأرضية ثلاثة')
for (const concept of running) {
  check(concept.overlay.text.includes('هروباً'), `${concept.scene.id}: الجملة هي نص التركيب`)
  check(concept.overlay.from < concept.overlay.to && concept.overlay.to <= concept.seconds, `${concept.scene.id}: توقيت تركيب سليم`)
  check(concept.captionAr.includes(concept.overlay.text), `${concept.scene.id}: الكابشن يبدأ بالجملة`)
  check(concept.hashtags.length >= 3 && concept.hashtags.every((tag) => tag.startsWith('#')), `${concept.scene.id}: هاشتاقات`)
}


/* حارس السكون: أول فيديو خرج «بايخاً» لأن المشاهد نفسها كانت تُفتتح بالهدوء
   («يُفتح ببطء»، «حركة بطيئة»). الريل لا يحتمل ذلك — الحارس يمنع عودته. */
const STATIC_WORDS = /\b(slow|slowly|gently|gentle|softly|drifts|waiting|idle)\b/i
for (const scene of SYMBOLIC_SCENES) {
  const text = `${scene.sceneEn} ${scene.arcEn.start} ${scene.arcEn.end}`
  check(!STATIC_WORDS.test(text), `${scene.id}: بلا لغة سكون في المشهد`)
  check(/\balready\b|bursts?|erupt|rips?|races?|surges?|explod|whip|slams?|storm|drives?|tears?|hammers?|launch/i.test(text), `${scene.id}: المشهد يبدأ داخل الحدث`)
}


/* التمديد: «مرات أبي أكثر من ٨ ثواني» (٢٩ أغسطس ٢٠٢٦). Flow يضيف سبعاً لا
   ثماني، والتمديد يكمل من الإطار الأخير — فالبرومبت يجب ألا يعيد المشهد. */
check(FLOW_EXTEND_SECONDS === 7, 'التمديد سبع ثوانٍ موثّقة')
for (const scene of SYMBOLIC_SCENES) {
  check(typeof scene.extendEn === 'string' && scene.extendEn.split(/\s+/).length >= 12, `${scene.id}: فصلٌ ثانٍ مكتوب`)
  const ext = reelExtendPrompt(scene)
  check(!arabic.test(ext), `${scene.id}: التمديد إنجليزي خالص`)
  check(ext.includes('CONTINUATION'), `${scene.id}: التمديد يكمل لا يبدأ`)
  check(ext.includes('ESCALATION RULE'), `${scene.id}: التمديد يصعّد`)
  check(ext.includes('exactly 7 seconds'), `${scene.id}: سبع ثوانٍ في نص التمديد`)
  check(ext.includes(scene.extendEn), `${scene.id}: الفصل الثاني داخل البرومبت`)
  check(/scene reset, new location/.test(ext), `${scene.id}: يمنع إعادة المشهد`)
}
for (const concept of running) {
  check(concept.extendPrompt.includes('CONTINUATION'), `${concept.scene.id}: المفهوم يحمل برومبت تمديد`)
  check(concept.extendPrompt !== concept.flowPrompt, `${concept.scene.id}: التمديد غير الأصل`)
}

console.log(`✓ اجتاز مصنع الريلز الرمزية ${checks} فحصاً`)
