import { buildAdversarialMisunderstandingSimulation } from './adversarial-misunderstanding.mjs'

const MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g
const STOP = new Set('الى علي على عن من في مع هذا هذه ذلك التي الذي كان كانت يكون تكون كما لكن لان ان او ثم كل بين بعد قبل حول عند عبر قد ما هو هي هم نحن حتى the and for from with that this are was were'.split(' '))
const NEGATIONS = new Set(['لا', 'لن', 'لم', 'ليس', 'ليست', 'ما'])
const EXAGGERATIONS = [
  'نهايه', 'يقضي علي', 'يلغي تماما', 'يستبدل تماما', 'كارثه', 'حتما', 'بلا شك',
  'دون شك', 'لا جدال', 'دائما', 'ابدا', 'يثبت قطعيا', 'الحل الوحيد', 'مستحيل',
  'مضمون', '100 بالمئه', '100%', 'end of', 'always', 'never', 'guaranteed',
]
const EVIDENCE_LANGUAGE = /(?:دراس|بحث|بيانات|احصائ|نسب|وفق|اظهر|اثبت|يؤكد|يكشف|study|research|data|percent)/iu

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))) }
function unique(values, limit = 80) { return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit) }
function words(value) { return clean(value).split(/\s+/).filter(Boolean).length }

function normal(value = '') {
  return clean(value).toLowerCase().replace(MARKS, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[٠-٩]/g, (digit) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(digit)])
    .replace(/[^\p{L}\p{N}%\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function stem(token) {
  let value = normal(token)
  if (/^[\u0600-\u06ff]+$/u.test(value)) {
    if (value.startsWith('ال') && value.length > 5) value = value.slice(2)
    if (value.length > 5) value = value.replace(/(?:يات|ات|ون|ين|يه|ها|هم)$/u, '')
  } else if (value.length > 5) value = value.replace(/(?:ing|ed|es|s)$/u, '')
  return value
}

function tokens(value) {
  return unique(normal(value).split(/\s+/).map(stem).filter((token) => token.length >= 3 && !STOP.has(token)), 800)
}

function overlap(left, right) {
  const a = tokens(left)
  const b = new Set(tokens(right))
  if (!a.length || !b.size) return 0
  return clamp(a.filter((token) => b.has(token)).length / Math.min(Math.max(3, a.length), Math.max(3, b.size)) * 100)
}

function rows(value, channel) {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => typeof item === 'string'
    ? { id: `${channel}-${index + 1}`, channel, text: item }
    : {
        id: clean(item?.id) || `${channel}-${index + 1}`,
        channel: clean(item?.channel) || channel,
        text: clean(item?.text),
        semanticVerified: item?.semanticVerified,
        relevanceScore: Number.isFinite(Number(item?.relevanceScore)) ? Number(item.relevanceScore) : null,
      }).filter((item) => item.text)
}

function proofString(value) {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return `${clean(value.file || value.id)}|sha256:${clean(value.sha256)}|source:${clean(value.sourceHash)}|bytes:${Number(value.bytes || 0)}|seconds:${Number(value.durationSeconds || 0)}`
}

function lockedAudio(value) {
  const proof = proofString(value)
  return /(?:^|\|)sha256:[a-f0-9]{64}(?:\||$)/i.test(proof)
    && /(?:^|\|)source:[a-f0-9]{8,64}(?:\||$)/i.test(proof)
    && /(?:^|\|)bytes:[1-9]\d*(?:\||$)/i.test(proof)
    && /(?:^|\|)seconds:[1-9]\d*(?:\||$)/i.test(proof)
}

function exaggerationAlerts(candidate, origin) {
  const target = normal(candidate)
  const source = normal(origin)
  return unique(EXAGGERATIONS.filter((phrase) => target.includes(normal(phrase)) && !source.includes(normal(phrase)))
    .map((phrase) => `تهويل غير مؤسّس في الأصل: «${phrase}»`), 12)
}

function negatedPredicates(origin) {
  const output = []
  const segments = clean(origin).split(/(?:\n+|[.!؟؛:])/u).map(normal).filter(Boolean)
  for (const segment of segments) {
    const sourceWords = segment.split(/\s+/).map((word) => word.startsWith('و') && NEGATIONS.has(word.slice(1)) ? word.slice(1) : word)
    for (let index = 0; index < sourceWords.length; index += 1) {
      if (!NEGATIONS.has(sourceWords[index])) continue
      const predicate = sourceWords.slice(index + 1, index + 4).map(stem).filter((token) => token.length >= 3 && !STOP.has(token))
      if (predicate.length) output.push(predicate)
    }
  }
  return output.slice(0, 40)
}

function inversionAlerts(candidate, origin) {
  const candidateWords = normal(candidate).split(/\s+/).map((word) => word.startsWith('و') && NEGATIONS.has(word.slice(1)) ? word.slice(1) : word)
  const candidateTokens = new Set(candidateWords.map(stem))
  const alerts = []
  for (const predicate of negatedPredicates(origin)) {
    if (!candidateTokens.has(predicate[0])) continue
    const anchor = predicate[0]
    const preserved = candidateWords.some((word, index) => stem(word) === anchor
      && candidateWords.slice(Math.max(0, index - 4), index + 1).some((nearby) => NEGATIONS.has(nearby)))
    if (!preserved) alerts.push(`احتمال قلب نفيٍ أصلي إلى إثبات: «${predicate.join(' ')}»`)
  }
  return unique(alerts, 8)
}

function lineageAlerts(candidate, origin) {
  const alerts = []
  const source = normal(origin)
  for (const raw of unique(clean(candidate).match(/[٠-٩0-9]+(?:[.,٫]\d+)?\s*(?:%|٪|بالمئة|بالمائه)?/g) || [], 30)) {
    const atom = normal(raw)
    const number = atom.match(/\d+/)?.[0] || ''
    if (!number || Number(number) <= 7 && !/(?:%|٪|بالم)/.test(raw)) continue
    if (!source.includes(atom) && !source.includes(number)) alerts.push(`رقم بلا أصل في النص: ${raw}`)
  }
  const quotes = []
  for (const match of clean(candidate).matchAll(/[«“"]([^»”"]{8,220})[»”"]/g)) quotes.push(match[1])
  for (const quote of unique(quotes, 20)) {
    if (!source.includes(normal(quote))) alerts.push(`اقتباس غير موجود حرفياً في الأصل: «${quote.slice(0, 90)}${quote.length > 90 ? '…' : ''}»`)
  }
  for (const sentence of clean(candidate).split(/(?:\n+|(?<=[.!؟])\s+)/u).map(clean).filter(Boolean)) {
    if (EVIDENCE_LANGUAGE.test(normal(sentence)) && overlap(sentence, origin) < 14) {
      alerts.push(`إسناد مولّد لا يظهر أصله في المقال: ${sentence.slice(0, 110)}${sentence.length > 110 ? '…' : ''}`)
    }
  }
  return unique(alerts, 20)
}

function caveatVerdict(fingerprint, candidate, medium) {
  const caveats = Array.isArray(fingerprint?.caveats) ? fingerprint.caveats.map(clean).filter(Boolean) : []
  if (!caveats.length) return { status: 'passed', score: 100, preserved: 0, total: 0, missing: [] }
  const threshold = medium === 'social' ? 7 : 10
  const preserved = caveats.filter((point) => overlap(point, candidate) >= threshold)
  const longEnough = words(candidate) >= (medium === 'social' ? 120 : 80)
  return {
    status: longEnough && !preserved.length ? 'review' : 'passed',
    score: clamp(preserved.length / caveats.length * 100), preserved: preserved.length, total: caveats.length,
    missing: caveats.filter((point) => !preserved.includes(point)),
  }
}

function judgeUnit(row, origin, fingerprint, medium) {
  const thesisCoverage = overlap(fingerprint?.thesis || origin, row.text)
  const protectedPoints = Array.isArray(fingerprint?.protectedPoints) ? fingerprint.protectedPoints : []
  const protectedCoverage = protectedPoints.length ? Math.max(...protectedPoints.map((point) => overlap(point, row.text))) : thesisCoverage
  const lineage = lineageAlerts(row.text, origin)
  const inversion = inversionAlerts(row.text, origin)
  const exaggeration = exaggerationAlerts(row.text, origin)
  const caveats = caveatVerdict(fingerprint, row.text, medium)
  const visualRejected = row.semanticVerified === false || row.relevanceScore != null && row.relevanceScore < 80
  const weak = Math.max(thesisCoverage, protectedCoverage) < (medium === 'design' ? 10 : 8)
  const alerts = unique([...lineage, ...inversion, ...exaggeration,
    ...(visualRejected ? ['الناقد البصري لم يعتمد مطابقة المشهد للمعنى.'] : []),
    ...(weak ? ['لا تحمل النسخة نقطة محمية واضحة من الأصل.'] : []),
    ...(caveats.status === 'review' ? ['النص طويل لكنه أسقط جميع التحفّظات الأصلية.'] : [])], 30)
  const blocked = visualRejected || inversion.length > 0 || lineage.length > 0 || exaggeration.length >= 2
  const status = blocked ? 'blocked' : weak || exaggeration.length || caveats.status === 'review' ? 'review' : 'passed'
  const score = clamp(Math.max(thesisCoverage, protectedCoverage) * .55 + (row.relevanceScore == null ? 86 : row.relevanceScore) * .2
    + (caveats.total ? caveats.score : 100) * .1 + (alerts.length ? Math.max(0, 100 - alerts.length * 24) : 100) * .15)
  return { id: row.id, channel: row.channel, status, score, thesisCoverage, protectedCoverage, caveats, alerts }
}

function textChamber(label, candidates, origin, fingerprint, medium) {
  if (!candidates.length) return { label, status: 'pending', score: 0, checked: 0, passed: 0, alerts: [`${label}: لا توجد مادة لفحصها.`], units: [] }
  const units = candidates.map((row) => judgeUnit(row, origin, fingerprint, medium))
  const status = units.some((unit) => unit.status === 'blocked') ? 'blocked' : units.some((unit) => unit.status === 'review') ? 'review' : 'passed'
  return { label, status, score: clamp(units.reduce((sum, unit) => sum + unit.score, 0) / units.length), checked: units.length,
    passed: units.filter((unit) => unit.status === 'passed').length,
    alerts: unique(units.flatMap((unit) => unit.alerts.map((alert) => `${unit.channel}: ${alert}`)), 40), units }
}

function sourceChamber(evidence) {
  const ids = unique(Array.isArray(evidence?.sourceIds) ? evidence.sourceIds : [])
  const proofs = unique(Array.isArray(evidence?.proofs) ? evidence.proofs.map((item) => typeof item === 'string' ? item : JSON.stringify(item)) : [])
  const alerts = unique(Array.isArray(evidence?.alerts) ? evidence.alerts : [])
  const claims = Array.isArray(evidence?.claims) ? evidence.claims : []
  const unsupported = claims.filter((claim) => claim?.support === 'unsupported').length
  const status = !ids.length || !proofs.length ? 'pending' : alerts.length || unsupported ? 'review' : 'passed'
  return { label: 'المصادر', status, score: ids.length ? clamp(proofs.length / ids.length * 75 + (unsupported ? 0 : 25) - alerts.length * 15) : 0,
    checked: Math.max(ids.length, claims.length), passed: Math.max(0, claims.length - unsupported),
    alerts: unique([...alerts, ...(unsupported ? [`${unsupported} ادعاءً في الأصل لم يكتمل إسناده.`] : [])], 30), units: [] }
}

/** فحص حتمي لا يدّعي OCR أو تفريغاً لم يُجر: الصوت يمر ببصمة مصدر دقيقة، والتصميم من طبقات النص الأصلية قبل الرسم. */
export function buildMultimodalMeaningCourt(input = {}) {
  const article = input.article || {}
  const fingerprint = input.fingerprint || {}
  const media = input.media || {}
  const origin = `${clean(article.title)}\n${clean(article.excerpt)}\n${clean(article.body)}`
  const social = rows(media.social, 'منصة')
  const designs = rows(media.designs, 'تصميم')
  const articleHeadlineAlerts = unique([...exaggerationAlerts(article.title, article.body), ...inversionAlerts(article.title, article.body)], 12)
  const audio = Array.isArray(media.audio) ? media.audio : []
  const locked = audio.filter(lockedAudio)
  const chambers = {
    text: words(article.body) < 40
      ? { label: 'النص', status: 'pending', score: 0, checked: 0, passed: 0, alerts: ['النص غير مكتمل لبناء أصل دلالي.'], units: [] }
      : { label: 'النص', status: articleHeadlineAlerts.length ? 'blocked' : 'passed', score: articleHeadlineAlerts.length ? 45 : 100, checked: 1, passed: articleHeadlineAlerts.length ? 0 : 1, alerts: articleHeadlineAlerts, units: [] },
    audio: !audio.length
      ? { label: 'الصوت', status: 'pending', score: 0, checked: 0, passed: 0, alerts: ['لا يوجد أصل صوتي مربوط بهذه النسخة.'], units: [], sourceLocked: false }
      : { label: 'الصوت', status: locked.length === audio.length ? 'passed' : locked.length ? 'review' : 'blocked', score: clamp(locked.length / audio.length * 100), checked: audio.length, passed: locked.length,
          alerts: locked.length === audio.length ? [] : ['ملف صوت لا يحمل بصمة الملف والمصدر والمدة والحجم معاً.'], units: [], sourceLocked: locked.length === audio.length, verificationMode: 'source-lock' },
    design: textChamber('التصميم', designs, origin, fingerprint, 'design'),
    social: textChamber('التغريدات', social, origin, fingerprint, 'social'),
    sources: sourceChamber(input.evidence || {}),
  }
  const derived = [...designs, ...social]
  const combined = derived.map((row) => row.text).join('\n')
  const headlineAlerts = unique([article.title, ...derived.map((row) => row.text.split(/\n/)[0])]
    .flatMap((candidate) => [...exaggerationAlerts(candidate, article.body), ...inversionAlerts(candidate, article.body)]), 30)
  const caveats = caveatVerdict(fingerprint, combined, 'social')
  const lineage = unique(derived.flatMap((row) => lineageAlerts(row.text, origin)), 30)
  const safeguards = {
    headlineGuard: { label: 'حارس العنوان السيادي', status: headlineAlerts.length ? 'blocked' : 'passed', score: headlineAlerts.length ? clamp(100 - headlineAlerts.length * 35) : 100, alerts: headlineAlerts },
    caveatCovenant: { label: 'عهد التحفّظات', status: caveats.status, score: caveats.score, preserved: caveats.preserved, total: caveats.total, alerts: caveats.status === 'review' ? ['سقطت جميع التحفّظات من النسخ المشتقة الطويلة.'] : [] },
    claimLineage: { label: 'سلسلة نسب الادعاء', status: lineage.length ? 'blocked' : 'passed', score: lineage.length ? clamp(100 - lineage.length * 30) : 100, alerts: lineage },
  }
  const adversarialSimulation = buildAdversarialMisunderstandingSimulation(input)
  const checks = [...Object.values(chambers), ...Object.values(safeguards), adversarialSimulation]
  const status = checks.some((item) => item.status === 'blocked') ? 'blocked'
    : Object.values(chambers).some((item) => item.status === 'pending') ? 'pending'
      : checks.some((item) => item.status === 'review') ? 'review' : 'passed'
  const scored = checks.filter((item) => item.status !== 'pending')
  return { schemaVersion: 2, kind: 'multimodal-meaning-court', fingerprintHash: clean(fingerprint.hash), status,
    releaseReady: status === 'passed', score: scored.length ? clamp(scored.reduce((sum, item) => sum + item.score, 0) / scored.length) : 0,
    chambers, safeguards, adversarialSimulation, alerts: unique(checks.flatMap((item) => item.alerts || []), 60) }
}

export function semanticCourtSummary(court = {}) {
  const labels = { passed: 'مجتازة', review: 'تحتاج مراجعة', blocked: 'أوقفت النشر', pending: 'بانتظار الطبقات' }
  return `محكمة المعنى ${labels[court.status] || 'غير مكتملة'} · ${clamp(court.score)}٪`
}
