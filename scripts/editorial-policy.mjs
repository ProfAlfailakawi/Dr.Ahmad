import { readFileSync } from 'node:fs'

const POLICY_URL = new URL('../src/data/editorial-policy.json', import.meta.url)

export const POLICY = Object.freeze(JSON.parse(readFileSync(POLICY_URL, 'utf8')))

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu
const HTML_TAG = /<[^>]*>/g

const ENTITY_MAP = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  nbsp: ' ',
  quot: '"',
  raquo: '»',
  rdquo: '”',
  rsquo: '’',
})

function decodeEntities(value = '') {
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x'
      const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
      if (!Number.isSafeInteger(number) || number < 0 || number > 0x10ffff) return ' '
      try { return String.fromCodePoint(number) } catch { return ' ' }
    }
    return ENTITY_MAP[code.toLowerCase()] ?? ' '
  })
}

/**
 * Normalizes Arabic and English for conservative keyword matching. The output
 * deliberately keeps letters and numbers only, so punctuation cannot be used
 * to evade the editorial policy.
 */
export function normalizeText(value = '') {
  return decodeEntities(String(value))
    .replace(HTML_TAG, ' ')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(INVISIBLE, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/ـ/gu, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Returns a URL object for a strict HTTPS URL, otherwise null. */
export function normalizeUrl(value) {
  if (typeof value !== 'string' || value.length > 2_048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    if (url.username || url.password) return null
    if (url.port && url.port !== '443') return null
    if (!url.hostname || url.hostname.endsWith('.')) return null
    url.hostname = url.hostname.toLowerCase()
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function sourceAliases(source) {
  return [source.id, source.name, ...(source.aliases || [])]
    .filter(Boolean)
    .map(normalizeText)
}

function hostAllowed(source, hostname) {
  const host = hostname.toLowerCase()
  return (source.hostnames || []).some((allowed) => host === String(allowed).toLowerCase())
}

export function allowedSourceFor(sourceName, rawUrl) {
  const url = rawUrl instanceof URL ? rawUrl : normalizeUrl(rawUrl)
  if (!url) return null
  const name = normalizeText(sourceName)
  return POLICY.allowedSources.find((source) => (
    hostAllowed(source, url.hostname)
    && sourceAliases(source).includes(name)
  )) || null
}

/** Both the declared publisher and the final article hostname must match. */
export function isAllowedSource(sourceName, rawUrl) {
  return Boolean(allowedSourceFor(sourceName, rawUrl))
}

function tokenMatches(actual, expected) {
  if (actual === expected) return true
  if (!/^\p{Script=Arabic}+$/u.test(expected) || expected.length < 3) return false
  // Arabic conjunctions and prepositions attach to the following word. Match
  // only a small, explicit prefix set to avoid broad stemming false positives.
  return [
    'و', 'ف', 'ب', 'ك', 'ل', 'لل',
    'وب', 'وك', 'ول', 'وف', 'فب', 'فك', 'فل',
    'وال', 'فال', 'بال', 'كال',
  ].some(
    (prefix) => actual === `${prefix}${expected}`,
  )
}

function phraseMatches(haystack, rawPhrase) {
  const phrase = normalizeText(rawPhrase)
  if (!phrase) return false
  const words = haystack.split(' ')
  const phraseWords = phrase.split(' ')
  for (let start = 0; start <= words.length - phraseWords.length; start += 1) {
    if (phraseWords.every((expected, offset) => tokenMatches(words[start + offset], expected))) return true
  }
  return false
}

function matchedPhrases(haystack, phrases = []) {
  return phrases.filter((phrase) => phraseMatches(haystack, phrase))
}

function candidateText(candidate) {
  const categories = Array.isArray(candidate.categories) ? candidate.categories.join(' ') : ''
  return normalizeText([
    candidate.title,
    candidate.summary,
    candidate.content,
    categories,
  ].filter(Boolean).join(' '))
}

/**
 * Evaluates a feed item before it can enter the review queue. Passing this
 * policy never publishes content: it only makes the item eligible for
 * `pending_review`.
 */
export function evaluateCandidate(candidate = {}) {
  const reasons = []
  const rawUrl = typeof candidate.url === 'string' ? candidate.url.trim() : ''
  const url = normalizeUrl(rawUrl)

  if (!rawUrl.toLowerCase().startsWith('https://')) reasons.push('url_not_https')
  else if (!url) reasons.push('url_invalid')

  if (!isAllowedSource(candidate.source, url)) reasons.push('source_not_allowed')

  const text = candidateText(candidate)
  if (!text) reasons.push('content_missing')

  const topicMatches = matchedPhrases(text, POLICY.requiredTopics?.any || [])
  if (topicMatches.length === 0) reasons.push('topic_not_relevant')

  const blockedMatches = {}
  for (const [category, phrases] of Object.entries(POLICY.blockedCategories || {})) {
    const matches = matchedPhrases(text, phrases)
    if (matches.length > 0) {
      blockedMatches[category] = matches
      reasons.push(`blocked:${category}`)
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons: [...new Set(reasons)],
    matchedTopics: topicMatches,
    blockedMatches,
    normalizedUrl: url?.href || null,
  }
}
