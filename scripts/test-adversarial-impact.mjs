import assert from 'node:assert/strict'
import { buildAdversarialMisunderstandingSimulation } from '../src/lib/adversarial-misunderstanding.mjs'
import { buildImpactMirror } from '../src/lib/impact-mirror.mjs'

const body = `التقنية تساعد الطالب على توسيع خياراته، لكنها لا تستبدل قراره ولا تلغي دور المعلم. في بعض سياقات التعلم قد ترتبط الأدوات بتحسن سرعة الوصول إلى المعرفة، وهذا لا يعني أنها تسبب الفهم وحدها. المعيار هو بقاء القرار للطالب ومراجعة المعلم للسياق. إن قيمة الأداة تظهر حين تخدم الإنسان وتحفظ استقلاليته، لا حين تتحول إلى بديل عن التفكير. لذلك نحتاج إلى استخدام متدرج يختلف بحسب عمر الطالب وحاجته وطبيعة المهمة التعليمية.`
const fingerprint = {
  hash: 'meaning-fixture',
  thesis: 'التقنية تساعد الطالب ولا تستبدل قراره',
  protectedPoints: ['القرار يبقى للطالب', 'المعلم يراجع السياق'],
  caveats: ['هذا لا يعني أنها تسبب الفهم وحدها'],
}
const base = {
  article: { title: 'التقنية تساعد الطالب ولا تستبدل قراره', excerpt: 'الأداة توسع الخيارات مع بقاء القرار للطالب والمعلم.', body },
  fingerprint,
  media: {
    social: [{ channel: 'X', text: 'التقنية تساعد الطالب ولا تستبدل قراره. هذا لا يعني أن الأداة تسبب الفهم وحدها؛ القرار يبقى للطالب والمعلم يراجع السياق.' }],
    designs: [{ channel: 'تصميم', text: 'التقنية تساعد الطالب ولا تستبدل قراره\nالقرار يبقى للطالب\nالأداة لا تسبب الفهم وحدها' }],
  },
}

const faithful = buildAdversarialMisunderstandingSimulation(base)
assert.equal(faithful.status, 'passed')
assert.equal(faithful.releaseReady, true)

const inverted = buildAdversarialMisunderstandingSimulation({ ...base, media: { ...base.media, social: [{ channel: 'X', text: 'التقنية تستبدل قرار الطالب وتلغي دور المعلم.' }] } })
assert.equal(inverted.status, 'blocked')
assert.ok(inverted.scenarios.some((item) => item.id === 'negation-flip'))

const causal = buildAdversarialMisunderstandingSimulation({ ...base, media: { ...base.media, social: [{ channel: 'X', text: 'الدراسة تثبت أن التقنية تؤدي حتما إلى الفهم وتضمن النتيجة.' }] } })
assert.equal(causal.status, 'blocked')
assert.ok(causal.scenarios.some((item) => item.id === 'causality-escalation'))

const scoped = buildAdversarialMisunderstandingSimulation({ ...base, media: { ...base.media, social: [{ channel: 'X', text: 'التقنية تصلح دائما للجميع بلا استثناء.' }] } })
assert.equal(scoped.status, 'blocked')
assert.ok(scoped.scenarios.some((item) => item.id === 'scope-expansion'))

const intent = { title: base.article.title, ...fingerprint, expectedAction: 'يبقى القرار للطالب', audience: 'المعلمون' }
const aligned = buildImpactMirror({
  intent,
  observations: [
    { id: 'a1', source: 'comment', text: 'فهمت أن التقنية تساعد الطالب ولا تستبدل قراره، ولا تعني أنها تسبب الفهم وحدها.' },
    { id: 'a2', source: 'conversation', text: 'الأداة توسع الخيارات لكن القرار يبقى للطالب والمعلم يراجع السياق، ولا يعني هذا أنها تسبب الفهم وحدها.' },
  ],
  metrics: { windowDays: 7, views: 120, shares: 12, listen25: 40, listen75: 30, onwardJourneys: 9, vsSiteAveragePct: 18 },
})
assert.equal(aligned.status, 'aligned')
assert.equal(aligned.counts.aligned, 2)
assert.equal(aligned.resonance.listenCompletion, 75)

const drift = buildImpactMirror({
  intent,
  observations: [
    { id: 'd1', source: 'message', text: 'الكاتب يقول إن التقنية تستبدل قرار الطالب وتلغي دور المعلم.' },
    { id: 'd2', source: 'field', text: 'فهمت أن التقنية تسبب الفهم دائما لكل الطلاب بلا استثناء.' },
  ],
  metrics: { views: 100_000, shares: 40_000, vsSiteAveragePct: 900 },
})
assert.equal(drift.status, 'drift')
assert.equal(drift.reopenRecommended, true)
assert.ok(drift.semanticScore < aligned.semanticScore)
assert.ok(drift.resonance.score >= 80, 'الانتشار قد يكون مرتفعا رغم انزياح المعنى')

const privateData = buildImpactMirror({ intent, observations: [{ source: 'message', text: 'راسلني على test@example.com أو 99999999 وقال إن القرار يبقى للطالب.' }] })
assert.doesNotMatch(privateData.observations[0].text, /test@example|99999999/)

const corrected = buildImpactMirror({
  intent,
  correction: { caseId: 'case-1', status: 'resolved', sourceStatus: 'corrected', correctedFingerprintHash: 'new-fingerprint' },
  observations: aligned.observations.map((item) => ({ source: item.source, text: item.text })),
})
assert.equal(corrected.correction?.caseId, 'case-1')
assert.equal(corrected.correction?.correctedMeaningLanded, true)

console.log('Adversarial misunderstanding + impact mirror: passed')
