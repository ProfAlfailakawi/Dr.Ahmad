import glossaryData from '../data/dr-ahmad-domain-glossary.json'

export type DomainMood = 'bright' | 'human' | 'institutional' | 'playful' | 'energetic' | 'academic' | 'future' | 'clear' | 'optimistic' | 'creative' | 'critical' | 'calm' | 'data' | 'dignified' | 'collaborative' | 'warm' | 'balanced' | 'immersive' | 'curious' | 'dynamic' | 'intellectual' | 'precise' | 'confident' | 'efficient'

export type DrAhmadGlossaryEntry = {
  id: string
  canonicalAr: string
  canonicalEn: string
  domain: string
  aliases: string[]
  meaningAr: string
  visualScenes: string[]
  avoid: string[]
  moods: DomainMood[]
  preferredWorlds: string[]
}

export type DrAhmadDomainUnderstanding = {
  primary: DrAhmadGlossaryEntry | null
  matches: DrAhmadGlossaryEntry[]
  confidence: number
  recognizedFrom: string
  expandedContext: string
  visualScenes: string[]
  avoid: string[]
  moods: DomainMood[]
  preferredWorlds: string[]
}

export const DR_AHMAD_DOMAIN_GLOSSARY = glossaryData as DrAhmadGlossaryEntry[]

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/gu
const STOP = new Set(['في', 'من', 'على', 'عن', 'مع', 'الى', 'إلى', 'ال', 'هذا', 'هذه', 'هو', 'هي', 'و', 'او', 'أو'])

export function normalizeDomainTerm(value = '') {
  return String(value)
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/[^\p{L}\p{N}\s+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const termsOf = (value = '') => normalizeDomainTerm(value).split(/\s+/).filter((token) => token.length > 1 && !STOP.has(token))
const unique = <T,>(items: T[]) => [...new Set(items)]

function aliasScore(input: string, alias: string) {
  const normalizedInput = normalizeDomainTerm(input)
  const normalizedAlias = normalizeDomainTerm(alias)
  if (!normalizedInput || !normalizedAlias) return 0
  if (normalizedInput === normalizedAlias) return 130
  if (normalizedAlias.startsWith(normalizedInput) && normalizedInput.length >= 3) return 112 - Math.min(24, normalizedAlias.length - normalizedInput.length)
  if (normalizedInput.startsWith(normalizedAlias) && normalizedAlias.length >= 3) return 104
  if (normalizedInput.includes(normalizedAlias) && normalizedAlias.length >= 3) return 92
  const inputTokens = termsOf(normalizedInput)
  const aliasTokens = termsOf(normalizedAlias)
  if (!inputTokens.length || !aliasTokens.length) return 0
  const overlap = aliasTokens.filter((token) => inputTokens.some((candidate) => candidate === token || (candidate.length >= 3 && token.startsWith(candidate)) || (token.length >= 3 && candidate.startsWith(token)))).length
  if (!overlap) return 0
  return Math.round(54 + (overlap / aliasTokens.length) * 34 + (overlap / inputTokens.length) * 10)
}

function entryScore(entry: DrAhmadGlossaryEntry, input: string, context: string) {
  const source = [input, context].filter(Boolean).join(' ')
  const aliases = [entry.canonicalAr, entry.canonicalEn, ...entry.aliases]
  const best = Math.max(...aliases.map((alias) => aliasScore(input, alias)), 0)
  const contextual = Math.max(...aliases.map((alias) => aliasScore(source, alias)), 0)
  const firstToken = termsOf(input)[0] || ''
  const firstWordBoost = firstToken && aliases.some((alias) => termsOf(alias)[0]?.startsWith(firstToken) || firstToken.startsWith(termsOf(alias)[0] || '')) ? 14 : 0
  return Math.max(best + firstWordBoost, contextual * .78)
}

export function interpretDrAhmadDomain(input: string, context = ''): DrAhmadDomainUnderstanding {
  const cleanInput = normalizeDomainTerm(input)
  if (!cleanInput) return { primary: null, matches: [], confidence: 0, recognizedFrom: '', expandedContext: '', visualScenes: [], avoid: [], moods: [], preferredWorlds: [] }

  const ranked = DR_AHMAD_DOMAIN_GLOSSARY
    .map((entry) => ({ entry, score: entryScore(entry, input, context) }))
    .filter((item) => item.score >= 52)
    .sort((left, right) => right.score - left.score || right.entry.aliases.length - left.entry.aliases.length)

  const primary = ranked[0]?.entry || null
  const matches = ranked.slice(0, 4).map((item) => item.entry)
  const confidence = Math.max(0, Math.min(99, Math.round(ranked[0]?.score || 0)))
  if (!primary) return { primary: null, matches: [], confidence: 0, recognizedFrom: '', expandedContext: '', visualScenes: [], avoid: [], moods: [], preferredWorlds: [] }

  const recognizedFrom = [primary.canonicalAr, primary.canonicalEn].filter(Boolean).join(' · ')
  const expandedContext = [
    `المصطلح المعتمد: ${primary.canonicalAr} (${primary.canonicalEn}).`,
    `المجال: ${primary.domain}.`,
    `المعنى المقصود في أعمال د. أحمد: ${primary.meaningAr}`,
    matches.length > 1 ? `مصطلحات قريبة محتملة: ${matches.slice(1).map((entry) => entry.canonicalAr).join('، ')}.` : '',
  ].filter(Boolean).join(' ')

  return {
    primary,
    matches,
    confidence,
    recognizedFrom,
    expandedContext,
    visualScenes: unique(matches.flatMap((entry) => entry.visualScenes)).slice(0, 9),
    avoid: unique(matches.flatMap((entry) => entry.avoid)).slice(0, 18),
    moods: unique(matches.flatMap((entry) => entry.moods)).slice(0, 10),
    preferredWorlds: unique(matches.flatMap((entry) => entry.preferredWorlds)).slice(0, 12),
  }
}

export function domainGlossaryPrompt(understanding: DrAhmadDomainUnderstanding) {
  if (!understanding.primary) return ''
  return [
    `DOMAIN GLOSSARY LOCK: ${understanding.primary.canonicalEn} means ${understanding.primary.meaningAr}.`,
    `Arabic canonical term: ${understanding.primary.canonicalAr}.`,
    understanding.visualScenes.length ? `Valid visual interpretations: ${understanding.visualScenes.join(' | ')}.` : '',
    understanding.avoid.length ? `Forbidden semantic confusions and clichés: ${understanding.avoid.join(', ')}.` : '',
    understanding.moods.length ? `Preferred emotional range: ${understanding.moods.join(', ')}.` : '',
  ].filter(Boolean).join(' ')
}
