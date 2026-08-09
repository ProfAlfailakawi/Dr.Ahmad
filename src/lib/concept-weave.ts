import type { ArticleRecord, BookRecord, PaperRecord } from './cms'
import { DR_AHMAD_DOMAIN_GLOSSARY, normalizeDomainTerm, type DrAhmadGlossaryEntry } from './dr-ahmad-domain-glossary'
import { bookKnowledgeText } from './book-knowledge'

export type ConceptArchivePreview = {
  entry: DrAhmadGlossaryEntry
  count: number
  firstYear: string
  latestYear: string
  milestones: { key: string; year: string; title: string; kind: 'مقال' | 'بحث'; to: string }[]
}

export type ConceptEchoRelation = 'يؤيدها' | 'يعارضها' | 'يوسّعها' | 'سبقتها' | 'تطورت منها'
export type ConceptEcho = {
  id: string
  paragraph: number
  relation: ConceptEchoRelation
  sourceKind: 'بحث' | 'مقال' | 'كتاب'
  title: string
  note: string
  to: string
  year: string
  concept: string
  score: number
}

const AR_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/gu
const STOP = new Set(['في', 'من', 'على', 'عن', 'مع', 'إلى', 'الى', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان', 'كانت', 'أن', 'إن', 'لا', 'ما', 'هو', 'هي', 'أو', 'او', 'ثم', 'قد', 'كل', 'بعد', 'قبل', 'عند', 'بين', 'حتى', 'لكن', 'بل', 'كما'])

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value = '') {
  return new Set(normalize(value).split(' ').map((word) => word.replace(/^(?:وال|فال|بال|كال|ال|و|ف|ب|ل|ك)(?=.{3,})/u, '')).filter((word) => word.length >= 3 && !STOP.has(word)))
}

function tokenOverlap(left = '', right = '') {
  const a = tokens(left)
  const b = tokens(right)
  let score = 0
  for (const word of a) if (b.has(word)) score += 1
  return score
}

const conceptAliases = (entry: DrAhmadGlossaryEntry) => [entry.canonicalAr, entry.canonicalEn, ...(entry.aliases || [])]
  .map((value) => String(value || '').trim())
  .filter((value) => value.length >= 2)

function containsConcept(text: string, entry: DrAhmadGlossaryEntry) {
  const haystack = normalizeDomainTerm(text)
  if (!haystack) return false
  return conceptAliases(entry).some((alias) => {
    const needle = normalizeDomainTerm(alias)
    return needle.length >= 2 && haystack.includes(needle)
  })
}

export function resolveGlossaryConcept(term = ''): DrAhmadGlossaryEntry | null {
  const needle = normalizeDomainTerm(term)
  if (!needle) return null
  let best: { entry: DrAhmadGlossaryEntry; score: number } | null = null
  for (const entry of DR_AHMAD_DOMAIN_GLOSSARY) {
    for (const alias of conceptAliases(entry)) {
      const normalized = normalizeDomainTerm(alias)
      if (!normalized) continue
      const exact = normalized === needle
      const score = exact ? (alias === entry.canonicalAr ? 120 : 110) : (normalized.includes(needle) || needle.includes(normalized) ? 35 : 0)
      if (score > 0 && (!best || score > best.score)) best = { entry, score }
    }
  }
  return best?.entry || null
}

export function glossaryConceptsInText(text = '', limit = 6) {
  const matches = DR_AHMAD_DOMAIN_GLOSSARY
    .filter((entry) => containsConcept(text, entry))
    .map((entry) => ({
      entry,
      score: conceptAliases(entry).reduce((best, alias) => {
        const needle = normalizeDomainTerm(alias)
        return normalizeDomainTerm(text).includes(needle) ? Math.max(best, needle.length) : best
      }, 0),
    }))
    .sort((a, b) => b.score - a.score || a.entry.canonicalAr.localeCompare(b.entry.canonicalAr, 'ar'))
  const seen = new Set<string>()
  const output: DrAhmadGlossaryEntry[] = []
  for (const match of matches) {
    if (seen.has(match.entry.id)) continue
    seen.add(match.entry.id)
    output.push(match.entry)
    if (output.length >= limit) break
  }
  return output
}

function yearOf(value?: string) {
  return String(value || '').match(/(?:19|20)\d{2}/)?.[0] || ''
}

export function buildConceptArchivePreview(term: string, articles: ArticleRecord[], papers: PaperRecord[]): ConceptArchivePreview | null {
  const entry = resolveGlossaryConcept(term)
  if (!entry) return null
  const rows: ConceptArchivePreview['milestones'] = []

  for (const article of articles) {
    const text = `${article.title} ${article.excerpt || ''} ${article.cat || ''}`
    if (!containsConcept(text, entry)) continue
    rows.push({ key: `a:${article.slug}`, year: yearOf(article.iso || article.year), title: article.title, kind: 'مقال', to: `/articles/${article.slug}` })
  }
  for (const paper of papers) {
    const text = `${paper.titleAr || paper.title} ${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keywords || ''} ${paper.keyFinding || ''}`
    if (!containsConcept(text, entry)) continue
    rows.push({ key: `p:${paper.slug}`, year: yearOf(paper.year || paper.iso || paper.journal), title: paper.titleAr || paper.title, kind: 'بحث', to: `/research/${paper.slug}` })
  }

  const sorted = rows.sort((a, b) => (Number(a.year) || 9999) - (Number(b.year) || 9999) || a.title.localeCompare(b.title, 'ar'))
  const dated = sorted.filter((item) => item.year)
  const firstYear = dated[0]?.year || ''
  const latestYear = dated.at(-1)?.year || firstYear
  const milestones: ConceptArchivePreview['milestones'] = []
  if (sorted.length <= 4) milestones.push(...sorted)
  else {
    const indexes = [0, Math.round((sorted.length - 1) / 3), Math.round(((sorted.length - 1) * 2) / 3), sorted.length - 1]
    for (const index of indexes) {
      const row = sorted[index]
      if (row && !milestones.some((item) => item.key === row.key)) milestones.push(row)
    }
  }
  return { entry, count: sorted.length, firstYear, latestYear, milestones }
}

export function conceptContextShift(term: string, texts: { year?: string; text: string }[]) {
  const focus = resolveGlossaryConcept(term)
  if (!focus) return ''
  const dated = texts.filter((row) => yearOf(row.year)).sort((a, b) => Number(yearOf(a.year)) - Number(yearOf(b.year)))
  if (dated.length < 2) return ''
  const earliestYear = yearOf(dated[0].year)
  const latestYear = yearOf(dated.at(-1)?.year)
  const earlyText = dated.filter((row) => yearOf(row.year) === earliestYear).map((row) => row.text).join(' ')
  const lateText = dated.filter((row) => yearOf(row.year) === latestYear).map((row) => row.text).join(' ')
  const co = (text: string) => glossaryConceptsInText(text, 8).filter((entry) => entry.id !== focus.id)
  const early = co(earlyText)[0]
  const late = co(lateText).find((entry) => entry.id !== early?.id) || co(lateText)[0]
  if (early && late && early.id !== late.id) return `في ${earliestYear} ظهر «${focus.canonicalAr}» أقرب إلى «${early.canonicalAr}»، وفي ${latestYear} اتسع سياقه في الأرشيف نحو «${late.canonicalAr}».`
  if (earliestYear !== latestYear) return `يمتد «${focus.canonicalAr}» في الأرشيف من ${earliestYear} إلى ${latestYear}؛ تغيّر السياق المحيط به بينما بقي المصطلح نفسه خيطاً مشتركاً.`
  return ''
}

function clip(value = '', max = 168) {
  const clean = String(value).replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const boundary = Math.max(slice.lastIndexOf('،'), slice.lastIndexOf('؛'), slice.lastIndexOf('.'), slice.lastIndexOf(' '))
  return `${slice.slice(0, boundary > 80 ? boundary : max).trim()}…`
}

const negativeResearch = /(?:عدم وجود|لا توجد|لم تظهر|لم توجد|لا يدعم|لم يثبت|غير دال|غير دالة|لا فرق|دون فروق)/u
const affirmativeResearch = /(?:أظهرت|توصلت|كشفت|تشير|أثبتت|وجدت|فاعلية|أهمية|إيجابي|إيجابية|مرتفع|مرتفعة|تحسن|تحسين|أثر)/u

function scoreCandidate(seed: string, candidate: string, concepts: DrAhmadGlossaryEntry[]) {
  const exact = concepts.reduce((sum, entry) => sum + (containsConcept(candidate, entry) ? 8 : 0), 0)
  return exact + tokenOverlap(seed, candidate) * 2
}

export function buildConceptEchoes(
  current: Pick<ArticleRecord, 'slug' | 'title' | 'iso' | 'excerpt'>,
  body: string,
  articles: ArticleRecord[],
  papers: PaperRecord[],
  books: BookRecord[],
): ConceptEcho[] {
  const paragraphs = body.split(/\n\s*\n/)
  const all: ConceptEcho[] = []
  const currentYear = Number(yearOf(current.iso)) || 0

  paragraphs.forEach((paragraph, paragraphIndex) => {
    if (paragraph.trim().length < 72) return
    const concepts = glossaryConceptsInText(paragraph, 3)
    if (!concepts.length) return
    const seed = `${paragraph} ${concepts.map((entry) => entry.canonicalAr).join(' ')}`

    for (const paper of papers) {
      const evidence = `${paper.keyFinding || ''} ${paper.abstractAr || ''} ${paper.contribution || ''}`.trim()
      const searchable = `${paper.titleAr || paper.title} ${paper.meta || ''} ${paper.keywords || ''} ${evidence}`
      const score = scoreCandidate(seed, searchable, concepts) + (paper.keyFinding ? 5 : 1)
      if (score < 15) continue
      let relation: ConceptEchoRelation = 'يوسّعها'
      const findingOverlap = paper.keyFinding ? tokenOverlap(paragraph, paper.keyFinding) : 0
      if (paper.keyFinding && concepts.length >= 2 && negativeResearch.test(paper.keyFinding) && findingOverlap >= 4) relation = 'يعارضها'
      else if (paper.keyFinding && affirmativeResearch.test(paper.keyFinding) && findingOverlap >= 4) relation = 'يؤيدها'
      all.push({
        id: `paper:${paper.slug}:${paragraphIndex}`,
        paragraph: paragraphIndex,
        relation,
        sourceKind: 'بحث',
        title: paper.titleAr || paper.title,
        note: clip(paper.keyFinding || paper.abstractAr || paper.meta || ''),
        to: `/research/${paper.slug}`,
        year: yearOf(paper.year || paper.iso || paper.journal),
        concept: concepts.find((entry) => containsConcept(searchable, entry))?.canonicalAr || concepts[0].canonicalAr,
        score: score + (relation === 'يؤيدها' || relation === 'يعارضها' ? 6 : 0),
      })
    }

    for (const article of articles) {
      if (article.slug === current.slug) continue
      const searchable = `${article.title} ${article.excerpt || ''} ${article.cat || ''}`
      const score = scoreCandidate(seed, searchable, concepts)
      if (score < 14) continue
      const candidateYear = Number(yearOf(article.iso || article.year)) || 0
      const relation: ConceptEchoRelation = candidateYear && currentYear
        ? candidateYear < currentYear ? 'سبقتها' : candidateYear > currentYear ? 'تطورت منها' : 'يوسّعها'
        : 'يوسّعها'
      all.push({
        id: `article:${article.slug}:${paragraphIndex}`,
        paragraph: paragraphIndex,
        relation,
        sourceKind: 'مقال',
        title: article.title,
        note: clip(article.excerpt || ''),
        to: `/articles/${article.slug}`,
        year: yearOf(article.iso || article.year),
        concept: concepts.find((entry) => containsConcept(searchable, entry))?.canonicalAr || concepts[0].canonicalAr,
        score: score + (candidateYear && currentYear ? 2 : 0),
      })
    }

    for (const book of books) {
      const searchable = `${book.title} ${book.desc || ''} ${bookKnowledgeText(book.slug)}`
      const score = scoreCandidate(seed, searchable, concepts)
      if (score < 16) continue
      all.push({
        id: `book:${book.slug}:${paragraphIndex}`,
        paragraph: paragraphIndex,
        relation: 'يوسّعها',
        sourceKind: 'كتاب',
        title: book.title,
        note: clip(book.desc || bookKnowledgeText(book.slug)),
        to: `/publications/${book.slug}`,
        year: yearOf(book.year),
        concept: concepts.find((entry) => containsConcept(searchable, entry))?.canonicalAr || concepts[0].canonicalAr,
        score,
      })
    }
  })

  const paragraphCount = paragraphs.filter((paragraph) => paragraph.trim().length >= 72).length
  const limit = paragraphCount >= 14 ? 4 : paragraphCount >= 7 ? 3 : 2
  const sorted = all.sort((a, b) => b.score - a.score || a.paragraph - b.paragraph || a.title.localeCompare(b.title, 'ar'))
  const selected: ConceptEcho[] = []
  const usedParagraphs = new Set<number>()
  const usedTargets = new Set<string>()
  const usedKinds = new Set<string>()

  for (const diversityPass of [true, false]) {
    for (const echo of sorted) {
      if (selected.length >= limit) break
      if (usedParagraphs.has(echo.paragraph) || usedTargets.has(echo.to)) continue
      if (diversityPass && usedKinds.has(echo.sourceKind) && selected.length < 3) continue
      selected.push(echo)
      usedParagraphs.add(echo.paragraph)
      usedTargets.add(echo.to)
      usedKinds.add(echo.sourceKind)
    }
  }

  return selected.sort((a, b) => a.paragraph - b.paragraph)
}
