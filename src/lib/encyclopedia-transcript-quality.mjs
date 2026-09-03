const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function normalizeArabicSearchText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (character) => String(ARABIC_DIGITS.indexOf(character)))
    .replace(/[۰-۹]/g, (character) => String(PERSIAN_DIGITS.indexOf(character)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanDisplayText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\u064b\u0627/g, '\u0627\u064b')
    .replace(/\s+/g, ' ')
    .replace(/\s+([،؛:.!?؟])/g, '$1')
    .trim()
}

function escaped(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function literalPattern(value, global = true) {
  const source = escaped(value).replace(/\s+/g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, global ? 'giu' : 'iu')
}

function phrasePattern(value) {
  const source = escaped(value).replace(/\s+/g, '\\s+')
  // Arabic conjunctions and prepositions are often attached to the first word
  // (for example: «والتغذية»). Preserve at most two such prefixes, while still
  // requiring a real boundary at the end so a rule for «التعليمي» can never
  // corrupt «التعليمية».
  return new RegExp(`(^|[^\\p{L}\\p{N}]|[وفبكلس]{1,2})(${source})(?![\\p{L}\\p{N}])`, 'giu')
}

function normalizedRuleEntries(rules = {}) {
  const entries = []
  let sequence = 0
  for (const item of Array.isArray(rules.properNames) ? rules.properNames : []) {
    const to = cleanDisplayText(item?.to)
    for (const from of Array.isArray(item?.from) ? item.from : []) {
      const cleanFrom = cleanDisplayText(from)
      if (!cleanFrom || !to || cleanFrom === to) continue
      entries.push({
        id: String(item?.id || `name-${sequence += 1}`),
        from: cleanFrom,
        to,
        kind: 'proper-name',
        confidence: String(item?.confidence || 'confirmed'),
        source: String(item?.source || 'manual-confirmed'),
        applyToDisplay: item?.applyToDisplay !== false,
        applyToSearch: item?.applyToSearch !== false,
      })
    }
  }
  for (const item of Array.isArray(rules.phraseCorrections) ? rules.phraseCorrections : []) {
    const from = cleanDisplayText(Array.isArray(item) ? item[0] : item?.from)
    const to = cleanDisplayText(Array.isArray(item) ? item[1] : item?.to)
    if (!from || !to || from === to) continue
    entries.push({
      id: String(!Array.isArray(item) && item?.id || `phrase-${sequence += 1}`),
      from,
      to,
      kind: 'academic-phrase',
      confidence: String(!Array.isArray(item) && item?.confidence || 'high'),
      source: String(!Array.isArray(item) && item?.source || 'project-correction-map'),
      applyToDisplay: Array.isArray(item) ? true : item?.applyToDisplay !== false,
      applyToSearch: Array.isArray(item) ? true : item?.applyToSearch !== false,
      note: String(!Array.isArray(item) && item?.note || ''),
    })
  }
  for (const [fromRaw, toRaw] of Object.entries(rules.wordCorrections || {})) {
    const from = cleanDisplayText(fromRaw)
    const to = cleanDisplayText(toRaw)
    if (!from || !to || from === to) continue
    entries.push({
      id: `word-${sequence += 1}`,
      from,
      to,
      kind: 'word',
      confidence: 'high',
      source: 'project-word-map',
      applyToDisplay: true,
      applyToSearch: true,
    })
  }
  return entries
    .sort((left, right) => right.from.length - left.from.length || left.id.localeCompare(right.id))
}

export function compileTranscriptCorrections(rules = {}) {
  const entries = normalizedRuleEntries(rules).map((entry) => ({
    ...entry,
    pattern: entry.kind === 'word' ? literalPattern(entry.from) : phrasePattern(entry.from),
    preservePrefix: entry.kind !== 'word',
  }))
  const boilerplatePatterns = (Array.isArray(rules.boilerplateOnlyPatterns) ? rules.boilerplateOnlyPatterns : [])
    .map((pattern) => {
      try { return new RegExp(pattern, 'iu') } catch { return null }
    })
    .filter(Boolean)
  const segmentPolicies = (Array.isArray(rules.segmentPolicies) ? rules.segmentPolicies : [])
    .filter((item) => item && item.videoId && Number.isFinite(Number(item.start)) && item.action)
    .map((item) => ({
      id: String(item.id || `${item.videoId}-${item.start}-${item.action}`),
      videoId: String(item.videoId),
      start: Number(item.start),
      action: String(item.action),
      fragment: cleanDisplayText(item.fragment || ''),
      confidence: String(item.confidence || 'confirmed'),
      source: String(item.source || 'manual-text-audit'),
      reason: String(item.reason || ''),
    }))
  return {
    entries,
    introductionVideoIds: new Set(Array.isArray(rules.introductionVideoIds) ? rules.introductionVideoIds : []),
    noSpeechVideoIds: new Set(Array.isArray(rules.noSpeechVideoIds) ? rules.noSpeechVideoIds : []),
    boilerplatePatterns,
    segmentPolicies,
  }
}

export function applyTranscriptCorrections(value, compiledOrRules = {}) {
  const compiled = Array.isArray(compiledOrRules?.entries) ? compiledOrRules : compileTranscriptCorrections(compiledOrRules)
  const original = cleanDisplayText(value)
  let text = original
  const changes = []
  for (const entry of compiled.entries) {
    if (entry.applyToDisplay === false) continue
    let count = 0
    text = text.replace(entry.pattern, (...args) => {
      count += 1
      if (!entry.preservePrefix) return entry.to
      const prefix = String(args[1] || '')
      return `${prefix}${entry.to}`
    })
    if (count) changes.push({ id: entry.id, kind: entry.kind, confidence: entry.confidence, source: entry.source, from: entry.from, to: entry.to, count })
  }
  text = cleanDisplayText(text)
  return { original, text, changed: text !== original, changes }
}

export function applySegmentPolicies({ videoId = '', start = 0, text = '', compiledOrRules = {} } = {}) {
  const compiled = Array.isArray(compiledOrRules?.entries) ? compiledOrRules : compileTranscriptCorrections(compiledOrRules)
  const policies = (compiled.segmentPolicies || []).filter((item) =>
    item.videoId === String(videoId)
    && Math.abs(Number(item.start) - Number(start)) < 0.02
  )
  let displayText = cleanDisplayText(text)
  let indexable = true
  let hiddenFromDisplay = false
  const flags = []
  const omissions = []
  for (const policy of policies) {
    if (policy.action === 'exclude-unintelligible') {
      indexable = false
      hiddenFromDisplay = true
      flags.push('unintelligible')
    } else if (policy.action === 'omit-fragment' && policy.fragment) {
      const pattern = literalPattern(policy.fragment)
      const before = displayText
      displayText = cleanDisplayText(displayText.replace(pattern, ''))
      if (before !== displayText) {
        flags.push('omitted-asr-fragment')
        omissions.push({
          policyId: policy.id,
          fragment: policy.fragment,
          source: policy.source,
          confidence: policy.confidence,
          reason: policy.reason,
        })
      }
    }
  }
  return { displayText, indexable, hiddenFromDisplay, flags, omissions, policies }
}

export function isBoilerplateOnly(value, compiledOrRules = {}) {
  const compiled = Array.isArray(compiledOrRules?.entries) ? compiledOrRules : compileTranscriptCorrections(compiledOrRules)
  const text = cleanDisplayText(value)
  return Boolean(text && compiled.boilerplatePatterns.some((pattern) => pattern.test(text)))
}

export function buildSearchExpansionGroups({ synonyms = [], glossary = [], corrections = {} } = {}) {
  const groups = []
  const seen = new Set()
  const add = (terms, source, canonical = '') => {
    const cleaned = [...new Set((Array.isArray(terms) ? terms : []).map(cleanDisplayText).filter(Boolean))]
    const normalized = [...new Set(cleaned.map(normalizeArabicSearchText).filter(Boolean))]
    if (normalized.length < 2) return
    const signature = [...normalized].sort().join('|')
    if (seen.has(signature)) return
    seen.add(signature)
    groups.push({ terms: cleaned, normalizedTerms: normalized, source, canonical: cleanDisplayText(canonical || cleaned[0]) })
  }
  const synonymGroups = Array.isArray(synonyms) ? synonyms : Array.isArray(synonyms?.groups) ? synonyms.groups : []
  for (const group of synonymGroups) add(Array.isArray(group) ? group : group?.terms, 'synonym', Array.isArray(group) ? group[0] : group?.canonical)
  for (const entry of Array.isArray(glossary) ? glossary : []) {
    add([entry?.canonicalAr, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])], 'glossary', entry?.canonicalAr)
  }
  for (const item of Array.isArray(corrections?.properNames) ? corrections.properNames : []) add([item?.to, ...(item?.from || [])], 'proper-name', item?.to)
  for (const item of Array.isArray(corrections?.phraseCorrections) ? corrections.phraseCorrections : []) {
    if (!Array.isArray(item) && item?.applyToSearch === false) continue
    const from = Array.isArray(item) ? item[0] : item?.from
    const to = Array.isArray(item) ? item[1] : item?.to
    add([to, from], 'correction', to)
  }
  return groups
}

export function expandSearchQuery(value, groups = []) {
  const normalized = normalizeArabicSearchText(value)
  if (!normalized) return []
  const output = new Map([[normalized, { term: normalized, kind: 'direct', canonical: cleanDisplayText(value) }]])
  for (const group of Array.isArray(groups) ? groups : []) {
    const terms = Array.isArray(group?.normalizedTerms) ? group.normalizedTerms : []
    if (!terms.some((term) => normalized === term || normalized.includes(term) || (term.length >= 5 && term.includes(normalized)))) continue
    for (const term of terms) if (term && !output.has(term)) output.set(term, { term, kind: String(group.source || 'related'), canonical: String(group.canonical || '') })
  }
  return [...output.values()]
}

export function assessSegmentQuality({ originalText = '', displayText = '', start = 0, end = 0, indexable = true, correctionCount = 0 } = {}) {
  const flags = []
  const originalWords = normalizeArabicSearchText(originalText).split(' ').filter(Boolean)
  const displayWords = normalizeArabicSearchText(displayText).split(' ').filter(Boolean)
  if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end)) || Number(start) < 0 || Number(end) <= Number(start)) flags.push('invalid-timing')
  if (!displayWords.length) flags.push('empty')
  if (displayWords.length > 110) flags.push('long-segment')
  if (/\.\.\.$/u.test(displayText)) flags.push('truncated-text')
  if (!indexable) flags.push('boilerplate-only')
  const ratio = originalWords.length ? correctionCount / originalWords.length : 0
  if (ratio > 0.32 && correctionCount >= 3) flags.push('high-correction-density')
  return { flags, wordCount: displayWords.length, correctionDensity: Number(ratio.toFixed(3)) }
}

export function reasonLabel(reason = '') {
  const labels = {
    'exact-phrase': 'تطابق العبارة نفسها داخل الكلام المفرغ',
    'canonical-term': 'تطابق المصطلح الأكاديمي المعتمد',
    'proper-name': 'تطابق اسم علم موثق في قاموس التصحيح',
    synonym: 'تطابق مرادف موثق في قاموس البحث',
    glossary: 'تطابق مفهوم موثق في قاموس الموقع',
    correction: 'تطابق صيغة مصححة من التفريغ الصوتي',
    'token-overlap': 'تشابه الكلمات الأساسية في السياق',
    'metadata-fallback': 'أقرب فيديو وفق بيانات الباب والفصل والعنوان من دون توقيت دقيق',
  }
  return labels[reason] || labels['token-overlap']
}
