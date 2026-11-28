import { assessObservedInterpretation } from './adversarial-misunderstanding.mjs'

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))) }
function unique(values, limit = 80) { return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit) }
function redact(value) {
  return clean(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[بريد محذوف]')
    .replace(/(?:\+?965[\s-]?)?[569]\d{7}/g, '[رقم محذوف]')
    .replace(/https?:\/\/\S+/gi, '[رابط محذوف]')
    .slice(0, 900)
}

function normalizeObservation(value, index) {
  const item = value && typeof value === 'object' ? value : { text: value }
  const text = redact(item.text)
  if (text.length < 12) return null
  const source = ['comment', 'conversation', 'message', 'field', 'other'].includes(String(item.source)) ? String(item.source) : 'other'
  return {
    id: clean(item.id) || `observation-${index + 1}`,
    text,
    source,
    at: clean(item.at) || new Date().toISOString(),
  }
}

function metric(value) { const number = Number(value); return Number.isFinite(number) ? Math.max(0, Math.round(number * 10) / 10) : null }
function signedMetric(value) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * 10) / 10 : null }

/**
 * يفصل بين «الانتشار» و«الفهم»: الأرقام تقيس الوصول والفعل فقط، أما محاذاة
 * المعنى فلا تحسب إلا من صياغات بشرية مجهلة يسجلها المالك بنفسه.
 */
export function buildImpactMirror(input = {}) {
  const intentValue = input.intent && typeof input.intent === 'object' ? input.intent : {}
  const intent = {
    title: clean(intentValue.title),
    thesis: clean(intentValue.thesis),
    protectedPoints: unique(Array.isArray(intentValue.protectedPoints) ? intentValue.protectedPoints : [], 12),
    caveats: unique(Array.isArray(intentValue.caveats) ? intentValue.caveats : [], 12),
    expectedAction: clean(intentValue.expectedAction),
    audience: clean(intentValue.audience),
    fingerprintHash: clean(intentValue.fingerprintHash),
  }
  const observations = (Array.isArray(input.observations) ? input.observations : [])
    .map(normalizeObservation).filter(Boolean).slice(0, 40)
    .map((item) => ({ ...item, assessment: assessObservedInterpretation(intent, item.text) }))
  const aligned = observations.filter((item) => item.assessment.status === 'aligned').length
  const partial = observations.filter((item) => item.assessment.status === 'partial').length
  const drift = observations.filter((item) => item.assessment.status === 'drift').length
  const semanticScore = observations.length ? clamp(observations.reduce((sum, item) => sum + item.assessment.score, 0) / observations.length) : null
  const metricsValue = input.metrics && typeof input.metrics === 'object' ? input.metrics : {}
  const metrics = {
    windowDays: metric(metricsValue.windowDays),
    views: metric(metricsValue.views),
    shares: metric(metricsValue.shares),
    listen25: metric(metricsValue.listen25),
    listen50: metric(metricsValue.listen50),
    listen75: metric(metricsValue.listen75),
    onwardJourneys: metric(metricsValue.onwardJourneys),
    siteAverage: metric(metricsValue.siteAverage),
    vsSiteAveragePct: signedMetric(metricsValue.vsSiteAveragePct),
    measuredAt: clean(metricsValue.measuredAt),
  }
  const hasReach = metrics.views != null
  const shareRate = metrics.views > 0 && metrics.shares != null ? Math.round(metrics.shares / metrics.views * 1_000) / 10 : null
  const listenCompletion = metrics.listen25 > 0 && metrics.listen75 != null ? clamp(metrics.listen75 / metrics.listen25 * 100) : null
  const onwardRate = metrics.views > 0 && metrics.onwardJourneys != null ? Math.round(metrics.onwardJourneys / metrics.views * 1_000) / 10 : null
  const resonanceScore = hasReach ? clamp(
    45
    + Math.max(-25, Math.min(25, Number(metrics.vsSiteAveragePct || 0) / 3))
    + Math.min(15, Number(shareRate || 0) * 1.2)
    + Math.min(10, Number(onwardRate || 0) * .8)
    + Math.min(10, Number(listenCompletion || 0) / 10)
  ) : null
  const status = !observations.length ? 'awaiting-observations'
    : drift >= 2 || drift > aligned ? 'drift'
      : drift || partial > 0 && partial >= aligned ? 'mixed'
        : observations.length >= 2 ? 'aligned' : 'preliminary'
  const reopenRecommended = status === 'drift' || (status === 'mixed' && drift >= 1 && observations.length >= 3)
  const learning = {
    protect: unique(observations.filter((item) => item.assessment.status === 'drift').flatMap((item) => item.assessment.alerts), 8),
    clarify: unique([
      ...(partial ? ['أعد صياغة المعيار المركزي في الحملة التالية بلغة أقصر.'] : []),
      ...(drift ? ['أضف تصحيحا يذكر ما لا يقوله المقال قبل إعادة ترويجه.'] : []),
    ], 8),
    amplify: aligned ? ['التعبير الذي التقطه القراء بأمان يصلح مدخلا لإعادة التقديم.'] : [],
  }
  const correctionValue = input.correction && typeof input.correction === 'object' ? input.correction : {}
  const correctionCaseId = clean(correctionValue.caseId)
  const explicitLanding = correctionValue.correctedMeaningLanded
  const correctedMeaningLanded = explicitLanding === true || explicitLanding === false
    ? explicitLanding
    : !correctionCaseId || !observations.length ? null
      : aligned >= 2 && drift === 0 ? true
        : drift >= 2 || drift > aligned ? false : null
  return {
    schemaVersion: 1,
    kind: 'editorial-impact-mirror',
    status,
    intent,
    observations,
    evidenceQuality: observations.length >= 4 ? 'useful' : observations.length ? 'limited' : 'unmeasured',
    semanticScore,
    resonance: { score: resonanceScore, shareRate, listenCompletion, onwardRate, metrics },
    counts: { total: observations.length, aligned, partial, drift },
    reopenRecommended,
    learning,
    ...(correctionCaseId ? { correction: {
      caseId: correctionCaseId,
      status: clean(correctionValue.status) || 'active',
      sourceStatus: clean(correctionValue.sourceStatus),
      previousFingerprintHash: clean(correctionValue.previousFingerprintHash),
      correctedFingerprintHash: clean(correctionValue.correctedFingerprintHash),
      correctedAt: clean(correctionValue.correctedAt),
      correctedMeaningLanded,
    } } : {}),
    note: 'الأرقام تقيس الوصول والفعل، ولا تعد دليلا على فهم المعنى. درجة الفهم مبنية فقط على ملاحظات مجهلة مسجلة.',
    updatedAt: clean(input.updatedAt) || new Date().toISOString(),
  }
}

export function impactMirrorSummary(mirror = {}) {
  const labels = {
    'awaiting-observations': 'بانتظار شاهد فهم', preliminary: 'قراءة أولية', aligned: 'النية وصلت', mixed: 'أثر مختلط', drift: 'المعنى انزاح',
  }
  const semantic = mirror.semanticScore == null ? '' : ` · ${clamp(mirror.semanticScore)}٪`
  return `مرآة الأثر ${labels[mirror.status] || 'غير مكتملة'}${semantic}`
}
