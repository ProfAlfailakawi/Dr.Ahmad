#!/usr/bin/env node
/**
 * خطة Flow مربوطة ببصمة مصدرها: تعديل العنوان أو المتن أو العالم بعد بناء الخطة يبطلها،
 * فلا معاينة ولا تصدير إلى أن تُبنى خطة جديدة. يحاكي هذا الاختبار تسلسل الاستوديو
 * (بناء ← تعديل ← محاولة تصدير ← إعادة بناء) على الدوال النقية التي تستعملها الواجهة.
 */
import assert from 'node:assert/strict'
import { bindReelSource, gateReelPlan, hasReelSource, normalizeReelSource, reelSourceFingerprint } from '../src/lib/reel-source.ts'

let checks = 0
const check = (c, m) => { assert.ok(c, m); checks += 1 }

const src = { title: 'ذكاءٌ بلا ضمير', body: 'الآلة تجيب سريعاً. لكن من يسأل؟', worldId: null }

// 1) بصمة مستقرة، وتتجاهل المسافات فقط
check(reelSourceFingerprint(src) === reelSourceFingerprint({ ...src }), 'نفس المصدر → نفس البصمة')
check(reelSourceFingerprint(src) === reelSourceFingerprint({ ...src, title: '  ذكاءٌ   بلا ضمير ', body: 'الآلة تجيب سريعاً.\n\nلكن  من يسأل؟ ' }), 'فروق المسافات لا تُبطل الخطة')
check(reelSourceFingerprint(src) !== reelSourceFingerprint({ ...src, title: 'ذكاءٌ بضمير' }), 'تغيير كلمة في العنوان يغيّر البصمة')
check(reelSourceFingerprint(src) !== reelSourceFingerprint({ ...src, body: src.body + ' ثم ماذا؟' }), 'تغيير المتن يغيّر البصمة')
check(reelSourceFingerprint(src) !== reelSourceFingerprint({ ...src, worldId: 'copper-eclipse' }), 'تغيير العالم يغيّر البصمة')
check(reelSourceFingerprint({ ...src, worldId: 'a' }) !== reelSourceFingerprint({ ...src, worldId: 'b' }), 'عالمان مختلفان → بصمتان مختلفتان')

// 2) اشتقاق العنوان من المتن يطابق قاعدة الاستوديو
const derived = normalizeReelSource({ title: '', body: 'سؤال أول. تفصيل ثانٍ', worldId: null })
check(derived.title === 'سؤال أول' && derived.body === 'سؤال أول. تفصيل ثانٍ', 'عنوان فارغ → أول جملة')
check(normalizeReelSource({ title: '', body: '' }).title === 'مادة جديدة', 'لا مصدر → «مادة جديدة»')
check(!hasReelSource({ title: ' ', body: '\n' }) && hasReelSource({ title: 'س', body: '' }), 'hasReelSource')

// 3) تسلسل الاستوديو: لا خطة ← بناء ← تعديل ← حجب ← إعادة بناء
let bound = null
let gate = gateReelPlan(bound, src)
check(gate.state === 'none' && !gate.canPreview && !gate.canExport, 'قبل البناء: لا معاينة ولا تصدير')

bound = bindReelSource(src)
gate = gateReelPlan(bound, src)
check(gate.state === 'fresh' && gate.canPreview && gate.canExport && gate.reason === '', 'بعد البناء مباشرة: مسموح')

let live = { ...src, title: 'ذكاء بلا ضمير — نسخة ٢' }
gate = gateReelPlan(bound, live)
check(gate.state === 'stale' && !gate.canExport && !gate.canPreview, 'تعديل العنوان بعد البناء يحجب التصدير والمعاينة (العيب الأصلي)')
check(gate.changed.join() === 'title' && gate.reason.includes('العنوان'), 'السبب يسمّي العنوان')

live = { ...src, body: 'متن جديد تماماً.' }
gate = gateReelPlan(bound, live)
check(gate.state === 'stale' && gate.changed.join() === 'body', 'تعديل المتن يحجب')

live = { ...src, worldId: 'obsidian-orbit' }
gate = gateReelPlan(bound, live)
check(gate.state === 'stale' && gate.changed.join() === 'world' && gate.reason.includes('العالم'), 'تغيير العالم المختار يحجب')

live = { title: 'عنوان آخر', body: 'متن آخر.', worldId: 'obsidian-orbit' }
check(gateReelPlan(bound, live).changed.join() === 'title,body,world', 'تغيّر الثلاثة يُسمّى كله')

// 4) رجوع المستخدم إلى النص الأصلي يُعيد صلاحية الخطة (لا إبطال دائم بلا سبب)
check(gateReelPlan(bound, { ...src }).state === 'fresh', 'العودة إلى المصدر نفسه تُعيد الخطة صالحة')

// 5) إعادة البناء من المصدر الحالي تربط الخطة الجديدة
bound = bindReelSource(live)
check(gateReelPlan(bound, live).canExport && gateReelPlan(bound, src).state === 'stale', 'الخطة الجديدة صالحة لمصدرها وقديمة للمصدر السابق')

// 6) مسافة زائدة بعد البناء لا تحجب (لا إزعاج)
check(gateReelPlan(bound, { ...live, body: live.body + '   ' }).state === 'fresh', 'مسافة زائدة لا تُبطل')

console.log(`✓ اجتاز ربط خطة الريل بمصدرها ${checks} فحصاً`)
