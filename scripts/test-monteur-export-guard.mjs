#!/usr/bin/env node
/**
 * حارس تصدير المونتير (public/monteur/export-guard.js): منطق التحقق من منطقة الالتقاط ومن
 * الملف الناتج. اختبار منطق نقيّ على مدخلات مُحاكاة — ليس تسجيلاً حقيقياً في متصفح.
 * القاعدة: «جاهز للنشر» لا تظهر إلا إذا مرّ كل فحص؛ وما تعذّر قياسه لا يُعدّ نجاحاً.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
/* الحزمة "type": "module" فتُعامَل .js كوحدة ESM؛ نُشغّل السكربت الكلاسيكي نفسه كما يفعل المتصفح، بعقدة module مُحاكاة. */
const sandbox = { module: { exports: {} } }
vm.runInNewContext(readFileSync(new URL('../public/monteur/export-guard.js', import.meta.url), 'utf8'), sandbox)
const guard = sandbox.module.exports

let checks = 0
const check = (c, m) => { assert.ok(c, m); checks += 1 }
const lit = { mean: 90, variance: 900 }
const good = () => ({
  expectedSeconds: 40, expectedAspect: 9 / 16, bytes: 4_000_000, completed: true, endedEarly: null,
  measured: { duration: 40.4, width: 1080, height: 1920 },
  sceneCount: 5, scenesSeen: [0, 1, 2, 3, 4], audio: { wanted: true, peak: 0.4 },
  samples: [{ label: 'بداية الفيديو', stats: lit }, { label: 'وسط الفيديو', stats: lit }, { label: 'نهاية الفيديو', stats: lit }],
})

// 1) سطح المشاركة
check(guard.checkSurface({ displaySurface: 'browser' }).status === 'pass', 'تبويب → نجاح')
const win = guard.checkSurface({ displaySurface: 'window' })
check(win.status === 'fail' && win.detail.includes('نافذة') && win.detail.includes('هذا التبويب'), 'نافذة → فشل برسالة تقول ماذا يفعل')
check(guard.checkSurface({ displaySurface: 'monitor' }).detail.includes('الشاشة كلها'), 'شاشة كاملة → فشل')
check(guard.checkSurface({}).status === 'unverified' && guard.checkSurface(null).status === 'unverified', 'سطح غير معلوم → غير متحقَّق لا نجاح')

// 2) القص
check(guard.checkCrop({ width: 540, height: 960 }, { width: 390, height: 693 }, true, false).status === 'pass', 'قص بنسبة مطابقة')
check(guard.checkCrop({ width: 1920, height: 1080 }, { width: 390, height: 693 }, true, false).status === 'fail', 'قص لم يُطبَّق: مسار أفقي كامل')
check(guard.checkCrop(null, { width: 390, height: 693 }, true, false).status === 'unverified', 'قص بلا قياس → غير متحقَّق')
check(guard.checkCrop(null, null, false, true).status === 'pass', 'ملء الشاشة بديلاً ناجحاً')
check(guard.checkCrop(null, null, false, false).status === 'fail', 'لا قص ولا ملء شاشة → فشل')

// 3) ملف سليم تماماً → جاهز
let r = guard.evaluateExport(good())
check(r.ready && r.status === 'verified', 'كل الفحوص ناجحة → جاهز')
check(guard.describe(r).includes('جاهز للنشر'), 'الوصف يقول جاهز للنشر')

// 3b) فحوص ما قبل التسجيل (السطح والقص) تدخل في الحكم النهائي
const withPre = good()
withPre.extraChecks = [guard.checkSurface({ displaySurface: 'browser' }), guard.checkCrop({ width: 540, height: 960 }, { width: 390, height: 693 }, true, false)]
check(guard.evaluateExport(withPre).ready, 'فحوص ما قبل التسجيل الناجحة لا تمنع الجاهزية')
withPre.extraChecks = [guard.checkSurface({}), null]
const preResult = guard.evaluateExport(withPre)
check(preResult.status === 'unverified' && !preResult.ready, 'سطح غير معلوم يمنع «جاهز للنشر» حتى لو نجح كل شيء آخر')

// 3c) التحميل كسكربت كلاسيكي في المتصفح يضع الواجهة على window لا على module
const browserBox = { self: {} }
vm.runInNewContext(readFileSync(new URL('../public/monteur/export-guard.js', import.meta.url), 'utf8'), browserBox)
check(typeof browserBox.self.MonteurExportGuard?.evaluateExport === 'function', 'يُحمَّل في المتصفح كـ window.MonteurExportGuard')

// 4) إيقاف المشاركة مبكراً (المستخدم ضغط «إيقاف المشاركة»): ملف مقطوع لا يُعلَن جاهزاً
let bad = good(); bad.endedEarly = 'أُوقفت مشاركة التبويب قبل نهاية الفيديو.'; bad.completed = false; bad.measured.duration = 12
r = guard.evaluateExport(bad)
check(!r.ready && r.status === 'failed' && r.checks.some((c) => c.id === 'complete' && c.status === 'fail') && r.checks.some((c) => c.id === 'duration' && c.status === 'fail'), 'تسجيل مقطوع → failed بفحصَي الاكتمال والمدة')
check(!guard.describe(r).includes('جاهز للنشر') && guard.describe(r).includes('لا تنشر'), 'لا يُكتب «جاهز» لملف مقطوع')

// 5) مشهد لم يُعرض
bad = good(); bad.scenesSeen = [0, 1, 3, 4]
r = guard.evaluateExport(bad)
check(r.status === 'failed' && r.checks.find((c) => c.id === 'scenes').detail.includes('المشهد 3'), 'المشهد الناقص يُسمّى')

// 6) صوت مفعّل لكنه صامت؛ وصوت غير مطلوب لا يُفحص
bad = good(); bad.audio = { wanted: true, peak: 0 }
check(guard.evaluateExport(bad).checks.find((c) => c.id === 'audio').status === 'fail', 'صوت صامت → فشل')
bad = good(); bad.audio = { wanted: false, peak: 0 }
check(!guard.evaluateExport(bad).checks.some((c) => c.id === 'audio') && guard.evaluateExport(bad).ready, 'الصوت مُعطَّل عمداً → لا فحص ولا إنذار')
bad = good(); bad.audio = { wanted: true, peak: null }
check(guard.evaluateExport(bad).status === 'unverified', 'صوت مطلوب بلا قياس → غير متحقَّق')

// 7) عيّنات الإطارات: بداية/وسط/نهاية
bad = good(); bad.samples[1] = { label: 'وسط الفيديو', stats: { mean: 0.5, variance: 0.1 } }
r = guard.evaluateExport(bad)
check(r.status === 'failed' && r.checks.find((c) => c.id === 'sample-1').detail.includes('فارغ'), 'وسط أسود → فشل')
bad = good(); bad.samples[2] = { label: 'نهاية الفيديو', stats: null }
r = guard.evaluateExport(bad)
check(r.status === 'unverified' && !r.ready && guard.describe(r).includes('نهاية الفيديو') && !guard.describe(r).includes('جاهز للنشر'), 'عيّنة نهاية مفقودة → لا «جاهز للنشر» وتُسمّى')
bad = good(); bad.samples = []
check(guard.evaluateExport(bad).status === 'unverified', 'لا عيّنات إطلاقاً → غير متحقَّق')

// 8) المقاس والمدة غير المقروءة
bad = good(); bad.measured = { duration: null, width: 0, height: 0 }
r = guard.evaluateExport(bad)
check(r.status === 'unverified' && r.checks.find((c) => c.id === 'duration').status === 'unverified' && r.checks.find((c) => c.id === 'size').status === 'unverified', 'مدة ومقاس غير مقروءين → غير متحقَّق')
bad = good(); bad.measured = { duration: 40, width: 1920, height: 1080 }
check(guard.evaluateExport(bad).checks.find((c) => c.id === 'size').status === 'fail', 'مقاس أفقي بدل العمودي → فشل')

// 9) تسجيل فارغ وخطأ مسجِّل
bad = good(); bad.bytes = 0
check(guard.evaluateExport(bad).checks.find((c) => c.id === 'bytes').detail.includes('لم يُنتج'), 'صفر بايت')
bad = good(); bad.recorderError = 'MediaRecorder أبلغ عن خطأ'
r = guard.evaluateExport(bad)
check(r.status === 'failed' && guard.describe(r).includes('MediaRecorder'), 'خطأ المسجِّل يصل للرسالة')

// 10) رسائل الأخطاء العربية
check(guard.explainCaptureError({ name: 'NotAllowedError' }) === '', 'إلغاء المستخدم صامت')
check(guard.explainCaptureError({ name: 'NotFoundError' }).includes('هذا التبويب'), 'NotFoundError')
check(guard.explainCaptureError({ name: 'NotReadableError' }).includes('أعد المحاولة'), 'NotReadableError')
check(guard.explainCaptureError({ name: 'Weird', message: 'x' }).includes('x'), 'خطأ مجهول يحمل رسالته')

console.log(`✓ اجتاز حارس تصدير المونتير ${checks} فحصاً`)
