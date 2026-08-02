import { arabicCountPhrase, MISSING_CAVEAT_FORMS, PROTECTED_POINT_AFTER_PREPOSITION_FORMS } from './style-dna.mjs'
const MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g
const STOP = new Set('الى علي على عن من في مع هذا هذه ذلك التي الذي كان كانت يكون تكون كما لكن لان ان او ثم كل بين بعد قبل حول عند عبر قد ما هو هي هم نحن حتى the and for from with that this are was were'.split(' '))
const NEGATIONS = new Set(['لا', 'لن', 'لم', 'ليس', 'ليست', 'ما'])
const UNIVERSALS = ['الجميع', 'كل الناس', 'دائما', 'ابدا', 'بلا استثناء', 'في كل حال', 'حتما', 'always', 'never', 'everyone']
const CAUSAL_CERTAINTY = ['يسبب', 'تسبب', 'يؤدي حتما', 'تؤدي حتما', 'يثبت ان', 'تثبت ان', 'يؤكد ان', 'تؤكد ان', 'السبب الوحيد', 'ينتج بالضروره', 'guarantees', 'proves that', 'causes']
const ASSOCIATION_LANGUAGE = ['يرتبط', 'ترتبط', 'ارتباط', 'علاقه', 'قد يؤدي', 'قد تؤدي', 'يمكن ان', 'احتمال', 'يشير', 'تشير', 'يتزامن', 'associated', 'may', 'might', 'correlation']
const SCOPE_WORDS = ['بعض', 'فئه', 'طلاب', 'معلم', 'اطفال', 'مراهق', 'جامع', 'مدرس', 'اسر', 'مؤسس', 'في سياق', 'حين', 'عندما']

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value) || 0))) }
function unique(values, limit = 80) { return [...new Set(values.map(clean).filter(Boolean))].slice(0, limit) }
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
function tokens(value) { return unique(normal(value).split(/\s+/).map(stem).filter((token) => token.length >= 3 && !STOP.has(token)), 1_200) }
function overlap(left, right) {
  const a = tokens(left)
  const b = new Set(tokens(right))
  if (!a.length || !b.size) return 0
  return clamp(a.filter((token) => b.has(token)).length / Math.min(Math.max(3, a.length), Math.max(3, b.size)) * 100)
}
function includesAny(value, phrases) { const target = normal(value); return phrases.some((phrase) => target.includes(normal(phrase))) }
function hasUnqualifiedCertainty(value) {
  const target = normal(value)
  const words = target.split(/\s+/).map((word) => word.startsWith('و') && NEGATIONS.has(word.slice(1)) ? word.slice(1) : word)
  return CAUSAL_CERTAINTY.some((phrase) => {
    const phraseWords = normal(phrase).split(/\s+/)
    for (let index = 0; index <= words.length - phraseWords.length; index += 1) {
      if (!phraseWords.every((word, offset) => words[index + offset] === word)) continue
      if (!words.slice(Math.max(0, index - 5), index).some((word) => NEGATIONS.has(word))) return true
    }
    return false
  })
}
function rows(value) {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => typeof item === 'string'
    ? { id: `derived-${index + 1}`, channel: 'نسخة مشتقة', text: item }
    : { id: clean(item?.id) || `derived-${index + 1}`, channel: clean(item?.channel) || 'نسخة مشتقة', text: clean(item?.text) })
    .filter((item) => item.text)
}
function headlineOf(value) { return clean(value).split(/\n|[.!؟]/u)[0].slice(0, 260) }

function negatedPredicates(value) {
  const output = []
  for (const segment of clean(value).split(/(?:\n+|[.!؟؛:])/u).map(normal).filter(Boolean)) {
    const words = segment.split(/\s+/).map((word) => word.startsWith('و') && NEGATIONS.has(word.slice(1)) ? word.slice(1) : word)
    for (let index = 0; index < words.length; index += 1) {
      if (!NEGATIONS.has(words[index])) continue
      const predicate = words.slice(index + 1, index + 4).map(stem).filter((token) => token.length >= 3 && !STOP.has(token))
      if (predicate.length) output.push(predicate)
    }
  }
  return output.slice(0, 40)
}

function lostNegation(candidate, origin) {
  const candidateWords = normal(candidate).split(/\s+/).map((word) => word.startsWith('و') && NEGATIONS.has(word.slice(1)) ? word.slice(1) : word)
  const candidateTokens = new Set(candidateWords.map(stem))
  return negatedPredicates(origin).filter((predicate) => {
    const anchor = predicate[0]
    if (!candidateTokens.has(anchor)) return false
    return !candidateWords.some((word, index) => stem(word) === anchor
      && candidateWords.slice(Math.max(0, index - 4), index + 1).some((nearby) => NEGATIONS.has(nearby)))
  })
}

function scenario(id, actor, attack, vulnerableAsset, risk, evidence, defense) {
  const score = clamp(risk)
  return {
    id, actor, attack, vulnerableAsset, risk: score,
    severity: score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 28 ? 'medium' : 'low',
    likelihood: score >= 70 ? 'مرتفعة' : score >= 42 ? 'متوسطة' : 'محدودة',
    evidence: clean(evidence), defense: clean(defense),
  }
}

/**
 * يحاكم النص كما لو أن قارئا متعجلا أو خصما اقتطع منه أسوأ قصاصة ممكنة.
 * لا يدعي معرفة نوايا الجمهور ولا يستعمل بيانات شخصية؛ كل خطر يعود إلى عبارة
 * موجودة في الأصل أو النسخ المشتقة ويمكن للكاتب تدقيقها حرفيا.
 */
export function buildAdversarialMisunderstandingSimulation(input = {}) {
  const article = input.article || {}
  const fingerprint = input.fingerprint || {}
  const media = input.media || {}
  const origin = `${clean(article.title)}\n${clean(article.excerpt)}\n${clean(article.body)}`
  const derived = [...rows(media.social), ...rows(media.designs)]
  const headlines = [{ id: 'article-title', channel: 'عنوان المقال', text: clean(article.title) }, ...derived.map((item) => ({ ...item, text: headlineOf(item.text) }))].filter((item) => item.text)
  if (tokens(article.body).length < 25) {
    return { schemaVersion: 1, kind: 'adversarial-misunderstanding-simulation', status: 'pending', releaseReady: false, score: 0, highRiskCount: 0, scenarios: [], defenses: [], alerts: ['النص غير مكتمل لمحاكاة اقتطاعه بعدائية.'] }
  }

  const thesis = clean(fingerprint.thesis) || clean(article.excerpt) || clean(article.title)
  const caveats = Array.isArray(fingerprint.caveats) ? fingerprint.caveats.map(clean).filter(Boolean) : []
  const protectedPoints = Array.isArray(fingerprint.protectedPoints) ? fingerprint.protectedPoints.map(clean).filter(Boolean) : []
  const combinedDerived = derived.map((item) => item.text).join('\n')
  const scenarios = []

  const weakestHeadline = headlines.map((item) => ({ ...item, coverage: overlap(thesis, item.text) })).sort((a, b) => a.coverage - b.coverage)[0]
  if (weakestHeadline && weakestHeadline.coverage < 18) {
    const weaponized = includesAny(weakestHeadline.text, [...UNIVERSALS, ...CAUSAL_CERTAINTY])
    const risk = weakestHeadline.coverage < 7 ? (weaponized ? 76 : 54) : 42
    scenarios.push(scenario('context-strip', 'قارئ القصاصة', `يقرأ «${weakestHeadline.text}» منفصلة ويظن أنها تمثل الأطروحة كاملة.`, weakestHeadline.channel, risk,
      `تغطية الأطروحة في القصاصة ${weakestHeadline.coverage}٪.`, 'أدخل كلمة من معيار الأطروحة في العنوان من دون تحويله إلى ملخص طويل.'))
  }

  const negationRows = headlines.map((item) => ({ item, lost: lostNegation(item.text, origin) })).filter((row) => row.lost.length)
  if (negationRows.length) {
    const row = negationRows[0]
    scenarios.push(scenario('negation-flip', 'خصم يعكس الجملة', `يحذف النفي في «${row.item.channel}» فيتحول التحذير إلى تأييد.`, row.item.channel, 94,
      `النفي المحمي قرب: ${row.lost[0].join(' ')}.`, 'أبق أداة النفي ملاصقة للفعل في كل عنوان أو نسخة قصيرة.'))
  }

  if (caveats.length && combinedDerived) {
    const preserved = caveats.filter((item) => overlap(item, combinedDerived) >= 8)
    if (!preserved.length) scenarios.push(scenario('caveat-erasure', 'ناشر ينتقي الجملة الحادة', 'يسقط التحفظات ويعرض الرأي كحكم مطلق.', 'حزمة المنصات', derived.length >= 3 ? 78 : 58,
      `${arabicCountPhrase(caveats.length, MISSING_CAVEAT_FORMS)}.`, 'ثبّت أقصر تحفظ في منشور رئيسي وشريحة التصميم الافتتاحية أو الختامية.'))
  }

  const originAssociative = includesAny(origin, ASSOCIATION_LANGUAGE)
  const causalEscalation = headlines.find((item) => hasUnqualifiedCertainty(item.text) && !hasUnqualifiedCertainty(origin))
  if (originAssociative && causalEscalation) scenarios.push(scenario('causality-escalation', 'مجادل يحول الارتباط إلى سبب', `يستشهد بـ«${causalEscalation.text}» كأن النص أثبت علاقة سببية.`, causalEscalation.channel, 90,
    'الأصل يستخدم لغة ارتباط أو احتمال، بينما القصاصة تستخدم لغة سببية جازمة.', 'استبدل الجزم بلفظ الارتباط أو الاحتمال الموجود في الأصل.'))

  const originScoped = includesAny(origin, SCOPE_WORDS)
  const universal = headlines.find((item) => includesAny(item.text, UNIVERSALS) && !includesAny(origin, UNIVERSALS))
  if (originScoped && universal) scenarios.push(scenario('scope-expansion', 'قارئ يعمم الحالة', `يحوّل «${universal.text}» من حالة محددة إلى حكم على الجميع.`, universal.channel, 86,
    'الأصل يحدد فئة أو سياقا، بينما النسخة المشتقة أدخلت لفظا كليا.', 'أعد الفئة أو السياق إلى الجملة نفسها واحذف لفظ التعميم.'))

  const protectedMissing = protectedPoints.filter((point) => derived.length && overlap(point, combinedDerived) < 7)
  if (protectedPoints.length && protectedMissing.length === protectedPoints.length) scenarios.push(scenario('protected-point-drop', 'محرر يختزل الفكرة', 'يختار أكثر جملة جاذبية ويترك النقاط التي تمنع إساءة الفهم.', 'حزمة المنصات', derived.length >= 4 ? 72 : 44,
    `لم تظهر أي نقطة من ${arabicCountPhrase(protectedPoints.length, PROTECTED_POINT_AFTER_PREPOSITION_FORMS)} في الحزمة.`, 'وزع النقاط المحمية على أيام الحملة ولا تجعل المنشور الأول يحمل الرحلة وحده.'))

  const highRiskCount = scenarios.filter((item) => item.risk >= 70).length
  const critical = scenarios.some((item) => item.severity === 'critical')
  const score = clamp(100 - scenarios.reduce((sum, item) => sum + (item.risk >= 75 ? 24 : item.risk >= 50 ? 15 : 7), 0))
  const status = critical || highRiskCount >= 2 ? 'blocked' : scenarios.some((item) => item.risk >= 45) ? 'review' : 'passed'
  const defenses = unique(scenarios.map((item) => item.defense), 12)
  const alerts = unique(scenarios.filter((item) => item.risk >= 45).map((item) => `${item.actor}: ${item.attack}`), 20)
  return { schemaVersion: 1, kind: 'adversarial-misunderstanding-simulation', status, releaseReady: status === 'passed', score, highRiskCount, scenarios, defenses, alerts }
}

/** يصنف فهما مسجلا بعد النشر مقابل النية الأصلية، بلا مساواة بين الشهرة والفهم. */
export function assessObservedInterpretation(intent = {}, observedText = '') {
  const text = clean(observedText)
  const thesis = clean(intent.thesis) || clean(intent.title)
  const protectedPoints = Array.isArray(intent.protectedPoints) ? intent.protectedPoints.map(clean).filter(Boolean) : []
  const caveats = Array.isArray(intent.caveats) ? intent.caveats.map(clean).filter(Boolean) : []
  if (!text || !thesis) return { status: 'unmeasured', score: 0, thesisCoverage: 0, protectedCoverage: 0, caveatCoverage: 0, alerts: ['لا توجد صياغة كافية للمقارنة.'] }
  const thesisCoverage = overlap(thesis, text)
  const protectedCoverage = protectedPoints.length ? Math.max(...protectedPoints.map((point) => overlap(point, text))) : thesisCoverage
  const caveatCoverage = caveats.length ? Math.max(...caveats.map((point) => overlap(point, text))) : 100
  const inversion = lostNegation(text, `${thesis}\n${protectedPoints.join('\n')}\n${caveats.join('\n')}`)
  const falseUniversal = includesAny(text, UNIVERSALS) && !includesAny(`${thesis} ${protectedPoints.join(' ')}`, UNIVERSALS)
  const score = clamp(thesisCoverage * .55 + protectedCoverage * .3 + caveatCoverage * .15 - inversion.length * 45 - (falseUniversal ? 24 : 0))
  const status = inversion.length || falseUniversal || score < 24 ? 'drift' : score < 52 ? 'partial' : 'aligned'
  const alerts = unique([
    ...(inversion.length ? ['الفهم المسجل قلب نفيا أو تحفظا أصليا.'] : []),
    ...(falseUniversal ? ['الفهم المسجل عمم ما لم يعممه النص.'] : []),
    ...(score < 52 && !inversion.length && !falseUniversal ? ['الفهم التقط جزءا من الفكرة ولم يحمل معيارها المركزي.'] : []),
  ])
  return { status, score, thesisCoverage, protectedCoverage, caveatCoverage, alerts }
}

export function adversarialSimulationSummary(simulation = {}) {
  const labels = { passed: 'محصنة', review: 'تحتاج تحصين', blocked: 'أوقفت النشر', pending: 'بانتظار النص' }
  return `محاكاة سوء الفهم ${labels[simulation.status] || 'غير مكتملة'} · ${clamp(simulation.score)}٪`
}
