import assert from 'node:assert/strict'
import { absentPartyAdvocate, editorialForesight, fairObjectionParagraph, genuineAdditionMeter, timeTest } from '../src/lib/editorial-foresight.ts'

const archive = Array.from({ length: 8 }, (_, index) => ({
  slug: `article-${index + 1}`,
  title: index === 0 ? 'الذكاء الاصطناعي ودور المعلم' : `مقال تربوي ${index + 1}`,
  excerpt: index === 0 ? 'الأداة تساعد المعلم ولا تستبدل مسؤوليته التربوية.' : 'التعليم علاقة إنسانية تبني الفهم والمسؤولية.',
  body: index === 0 ? 'تتقدم الأدوات الرقمية، لكن المعلم يبقى مسؤولاً عن الحكم على الإجابة وعن معرفة سياق الطالب.' : 'حين يبدأ التعليم من الإنسان يصبح السؤال أهم من سرعة الإجراء، ويعرف الطالب معنى ما يتعلمه.',
  cat: 'التعليم', iso: `202${index}-01-01`, hasAudio: false,
}))

const newDraft = 'في المدارس النائية يمكن للذكاء الاصطناعي أن يقترح مسارات تعلم شخصية. لكن هذا لا يعني تفويض القرار له؛ فالأسرة والمعلم يحتاجان معرفة حدود البيانات والتحيز. المعيار هو تحسن فهم الطالب وقدرته على الشرح، لا عدد مرات استخدام الأداة.'
const report = genuineAdditionMeter('من يراجع الخوارزمية داخل الصف؟', newDraft, archive)
assert.notEqual(report.verdict, 'لا توجد مادة كافية للحكم')
assert.equal(report.nearest.length > 0, true)
assert.match(report.evidenceBasis, /8 مواد/)

const advocate = absentPartyAdvocate('الذكاء الاصطناعي في التعليم', newDraft)
assert.match(advocate.party, /المعلم|المختص/)
assert.equal(advocate.addressed, true)
assert.match(fairObjectionParagraph(advocate), /وقد يعترض/)

const temporal = timeTest('قرار اليوم', 'اليوم نناقش تقريراً حديثاً صدر عام 2026. لكن التعليم مسؤولية إنسانية تبقى بعد انتهاء الخبر. وتشير دراسة إلى تغير مهم يحتاج مصدراً واضحاً.')
assert.equal(temporal.momentBound.length > 0, true)
assert.equal(temporal.durable.length > 0, true)
assert.equal(temporal.needsContext.length > 0, true)

const combined = editorialForesight('من يراجع الخوارزمية؟', newDraft.repeat(4), archive)
assert.equal(combined.words >= 80, true)
assert.ok(combined.addition && combined.advocate && combined.time)

console.log('✓ بصيرة ما قبل النشر: 11/11')
