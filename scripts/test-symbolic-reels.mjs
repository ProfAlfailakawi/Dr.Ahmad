import assert from 'node:assert/strict'
import { SYMBOLIC_SCENES, forgeSymbolicReels } from '../src/lib/symbolic-reels.ts'
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
  for (const needle of ['SYMBOLIC REEL', '9:16', 'Cinematography', 'Lighting plan', 'Colour grade', 'VISIBLE-TEXT RULE', 'no recognizable faces', 'Negative constraints']) {
    check(prompt.includes(needle), `${concept.scene.id}: يحمل ${needle}`)
  }
  check(/no presenter, no avatar/.test(prompt), `${concept.scene.id}: بلا أفتار صراحةً`)
  /* حكم الدكتور على أول فيديو (٢٩ أغسطس ٢٠٢٦): «ضيّعني ١٦ ثانية في مشهد بايخ
     جداً… ماله أي معنى». العلّة كانت لغة الهدوء التحريرية مسكوبةً في الريل،
     فصار الحارس معكوساً: الريل يُمنع من السكون ويُلزم بالحدث. */
  check(prompt.includes('OPENING RULE'), `${concept.scene.id}: أول إطار داخل الحدث`)
  check(prompt.includes('SCROLL-STOP RULE'), `${concept.scene.id}: المفاجأة في الثانية الأولى`)
  check(/kinetic and arresting/.test(prompt), `${concept.scene.id}: طاقة حركية`)
  check(!/one restrained motion per shot/.test(prompt), `${concept.scene.id}: بلا لغة الكبح التحريرية`)
  check(!/Never open on a still[\s\S]*held beauty shots/.test(prompt) || /No idling/.test(prompt), `${concept.scene.id}: منع اللقطات الجامدة`)
}

// 5) المدة والعدد والتركيب
const long = forgeSymbolicReels({ idea: 'فكرة', seconds: 16, count: 5 })
check(long.length === 5 && long.every((c) => c.seconds === 16 && c.flowPrompt.includes('exactly 16 seconds')), 'المدة والعدد يُحترمان')
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

console.log(`✓ اجتاز مصنع الريلز الرمزية ${checks} فحصاً`)
