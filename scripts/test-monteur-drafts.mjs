#!/usr/bin/env node
/**
 * حماية مشاريع المونتير (src/lib/monteur-drafts.ts):
 *  - التعديلات غير المحفوظة لا تُمحى عند الانتقال بين المشاريع؛
 *  - مسودة الذكاء لا تستبدل النسخة المعتمدة ولا تُعتمد بلا نقرة صريحة؛
 *  - استرجاع نسخة سابقة يمرّ بفرق مرئي قبل الاعتماد؛
 *  - المستندات القديمة بلا status تبقى «معتمدة».
 * المنطق هنا هو الذي تستدعيه المكوّنات (MonteurEmbed + monteur-library)؛ لا Firebase ولا DOM.
 */
import assert from 'node:assert/strict'
import {
  effectiveStatus, planMonteurSave, diffMonteurRevisions, describeRevisionDiff, createDraftStash, decideLeave, MONTEUR_HISTORY_LIMIT,
} from '../src/lib/monteur-drafts.ts'

let checks = 0
const check = (c, m) => { assert.ok(c, m); checks += 1 }
const scene = (src, extra = {}) => ({ src, l1: [src], l2: [], t: 'text', ...extra })
const plan = (...srcs) => ({ theme: 'warm', quote: 'q', scenes: srcs.map((s) => scene(s)) })
const NOW = '2026-11-05T00:00:00.000Z'

// 1) التوافق الخلفي
check(effectiveStatus({}) === 'approved' && effectiveStatus(undefined) === 'approved', 'بلا status → معتمد (لا نغيّر معنى بيانات قائمة)')
check(effectiveStatus({ status: 'draft' }) === 'draft', 'draft يبقى draft')

// 2) مسودة الذكاء فوق نسخة معتمدة: لا مساس بالخطة
const approved = { plan: plan('أ', 'ب', 'ج'), title: 'عنوان', body: 'متن', revision: 4, status: 'approved', history: [{ plan: plan('قديم'), savedAt: 'x' }] }
const ai = { plan: plan('ذكاء ١', 'ذكاء ٢'), title: 'عنوان', body: 'متن', source: 'ai' }
let result = planMonteurSave(approved, ai, 'ai-generated', NOW, 4)
check(result.kind === 'ai-draft-only', 'ناتج الذكاء فوق معتمدة → حقل aiDraft فقط')
check(!('plan' in result.patch) && result.patch.aiDraft.plan.scenes.length === 2, 'الباتش لا يحمل plan ولا revision ولا history')
check(JSON.stringify(approved.plan) === JSON.stringify(plan('أ', 'ب', 'ج')), 'النسخة المعتمدة لم تُلمس')
// لا يتعارض مع مراجعة المحرّر: كتابة المسودة لا تتطلب تطابق المراجعة ولا ترفعها
check(planMonteurSave(approved, ai, 'ai-generated', NOW, 99).kind === 'ai-draft-only', 'مسودة الذكاء لا تُسقط حفظ المستخدم اللاحق بتعارض مراجعة')

// 3) ناتج الذكاء لمشروع جديد: وثيقة بحالة draft
result = planMonteurSave(undefined, { ...ai, plan: { ...ai.plan, generated: true } }, 'ai-generated', NOW, 0)
check(result.kind === 'write' && result.doc.status === 'draft' && result.doc.revision === 1, 'مشروع جديد من الذكاء → draft برقم مراجعة 1')
check(result.doc.history.length === 0, 'لا تاريخ لمشروع جديد')

// 4) الاعتماد صريح: يرفع النسخة، يحفظ القديم في التاريخ، يضع status وapprovedAt، ويسقط aiDraft المعتمَد
const withDraft = { ...approved, aiDraft: { plan: ai.plan, title: 't', body: 'b', createdAt: 'y' } }
result = planMonteurSave(withDraft, ai, 'approve', NOW, 4)
check(result.kind === 'write' && result.doc.status === 'approved' && result.doc.approvedAt === NOW, 'اعتماد → approved + وقت الاعتماد')
check(result.doc.revision === 5 && result.doc.history.at(-1).plan.scenes.length === 3, 'الاعتماد يحفظ النسخة السابقة في التاريخ ويرفع المراجعة')
check(!('aiDraft' in result.doc), 'اعتماد المسودة يمسحها من الوثيقة')

// 5) حفظ عادي لا يُسقط مسودة ذكاء معلّقة بصمت (عيب فقد البيانات)
result = planMonteurSave(withDraft, { ...ai, plan: plan('تعديل يدوي') }, 'working-save', NOW, 4)
check(result.kind === 'write' && result.doc.aiDraft?.createdAt === 'y', 'حفظ يدوي يُبقي مسودة الذكاء المعلّقة')
check(result.doc.status === 'approved', 'حفظ يدوي لمعتمدة يبقيها معتمدة')

// 6) حفظ عمل جارٍ على مسودة يبقيها مسودة (لا اعتماد ضمني)
const draftDoc = { plan: plan('م'), title: 't', body: 'b', revision: 1, status: 'draft' }
result = planMonteurSave(draftDoc, { ...ai, plan: plan('م٢') }, 'working-save', NOW, 1)
check(result.doc.status === 'draft', 'حفظ التعديلات على مسودة لا يعتمدها')

// 7) وثيقة يدوية جديدة (ليست ناتج ذكاء) → معتمدة؛ والمولَّدة → مسودة
check(planMonteurSave(undefined, { ...ai, plan: plan('يدوي') }, 'working-save', NOW, 0).doc.status === 'approved', 'مشروع يدوي جديد → معتمد')
check(planMonteurSave(undefined, { ...ai, plan: { ...plan('مولّد'), generated: true } }, 'working-save', NOW, 0).doc.status === 'draft', 'مشروع نصه مولَّد → مسودة')

// 8) تعارض المراجعات يُكتشف
result = planMonteurSave(approved, ai, 'working-save', NOW, 3)
check(result.kind === 'conflict' && result.message.includes('جلسة أخرى'), 'مراجعة قديمة → تعارض لا كتابة')

// 9) حد التاريخ
let doc = { ...approved, history: Array.from({ length: MONTEUR_HISTORY_LIMIT }, (_, i) => ({ plan: plan(`h${i}`), savedAt: String(i) })) }
result = planMonteurSave(doc, ai, 'working-save', NOW, 4)
check(result.doc.history.length === MONTEUR_HISTORY_LIMIT && result.doc.history.at(-1).plan.scenes.length === 3, 'التاريخ محدود بثمانٍ ويحتفظ بالأحدث')

// 10) فرق النسخ قبل الاستعادة
const cur = { plan: plan('أ', 'ب', 'ج'), title: 'ع', body: 'متن' }
const same = diffMonteurRevisions(cur, JSON.parse(JSON.stringify(cur)))
check(same.identical && describeRevisionDiff(same).includes('مطابقة'), 'نسختان متطابقتان → identical')
const other = diffMonteurRevisions(cur, { plan: { ...plan('أ', 'مختلف', 'ج', 'د'), theme: 'cold' }, title: 'ع٢', body: 'متن آخر' })
check(!other.identical && other.changedScenes.join() === '1' && other.addedScenes === 1 && other.titleChanged && other.bodyChanged && other.themeChanged, 'فرق مفصّل: مشهد معدّل، مشهد مضاف، عنوان، متن، ثيمة')
const line = describeRevisionDiff(other)
check(line.includes('3 ← 4') && line.includes('تغيّر 1 مشهد') && line.includes('العنوان') && line.includes('نص المصدر'), 'الوصف العربي يذكر كل فرق')
check(diffMonteurRevisions(cur, { plan: plan('أ', 'ب'), title: 'ع', body: 'متن' }).removedScenes === 1, 'حذف مشهد يُرصد')
check(diffMonteurRevisions(cur, { ...cur, body: 'متن   ' }).bodyChanged === false, 'مسافة زائدة في المتن ليست فرقاً')

// 11) مخزن التعديلات: لا فقد عند الانتقال
const stash = createDraftStash()
const editsOnA = { slug: 'a', title: 'أ', body: 'م', plan: plan('تعديلي ١', 'تعديلي ٢') }
stash.save(editsOnA)
editsOnA.plan.scenes[0].src = 'غُيّر بعد الإيداع' // تعديل لاحق على الكائن الأصلي لا يلوّث المخزَّن
check(stash.has('a') && stash.size === 1, 'التعديلات أُودعت')
check(stash.peek('a').plan.scenes[0].src === 'تعديلي ١', 'المخزَّن نسخة معزولة')
check(stash.take('b') === undefined, 'مشروع آخر بلا تعديلات')
const back = stash.take('a')
check(back.plan.scenes.length === 2 && !stash.has('a'), 'العودة إلى المشروع تعيد تعديلاته ثم تُفرغ مكانها')
stash.save({ slug: '', title: 'x', body: 'y', plan: plan('z') })
check(stash.size === 0, 'نصٌّ حرّ بلا معرّف لا يُودَع (يُسأل المستخدم بدلاً)')
stash.save(editsOnA); stash.discard('a'); check(stash.size === 0, 'تجاهل التعديلات صريح')

// 12) قرار المغادرة
check(decideLeave(false, 'a') === 'proceed', 'بلا تعديلات: امضِ')
check(decideLeave(true, 'a') === 'stash', 'تعديلات على مشروع معروف: أودعها ثم امضِ')
check(decideLeave(true, '') === 'confirm', 'تعديلات على نص حرّ: اسأل قبل التجاهل')

console.log(`✓ اجتاز حماية مشاريع المونتير ${checks} فحصاً`)
