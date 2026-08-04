import rawPassages from '../data/book-passages.json'
import structureData from '../data/encyclopedia-structure.json'
import {
  encyclopediaTeachingTopics,
  type EncyclopediaTeachingTopic,
} from './encyclopedia-teaching-map'
import { buildSmartQueryPlan, scoreSmartFields } from './smart-search'

export type EncyclopediaPassageMatch = {
  id: string
  text: string
  page: number
  section: string
  conceptId: string
  conceptTitle: string
  score: number
  doorId: string | null
  doorNumber: number | null
  doorTitle: string
  chapterNumber: number | null
  chapterTitle: string
}

export type EncyclopediaSlideMatch = {
  topic: EncyclopediaTeachingTopic
  score: number
  doorNumber: number
  doorTitle: string
  presentation: string
}

export type EncyclopediaKnowledgeSearchResult = {
  query: string
  passages: EncyclopediaPassageMatch[]
  slides: EncyclopediaSlideMatch[]
}

type RawPassage = {
  id: string
  text: string
  page: number
  section?: string
  conceptId?: string
  conceptTitle?: string
}

type RawPassageBook = {
  slug: string
  title: string
  passages: RawPassage[]
}

type RawPassageFile = {
  books: RawPassageBook[]
}

type RawUnit = {
  number: number
  title: string
  pageStart: number
  keywords?: string[]
}

type RawDoor = {
  id: string
  doorNumber: number
  title: string
  presentation?: string
  units: RawUnit[]
}

const doors = (structureData.doors || []) as RawDoor[]
const encyclopediaBook = ((rawPassages as RawPassageFile).books || []).find((book) => book.slug === 'encyclopedia')
const passages = encyclopediaBook?.passages || []

const unitLocations = doors.flatMap((door) => door.units.map((unit, index) => {
  const next = door.units[index + 1]
  const nextDoor = doors.find((candidate) => candidate.doorNumber === door.doorNumber + 1)
  const end = next?.pageStart
    ? next.pageStart - 1
    : nextDoor?.units?.[0]?.pageStart
      ? nextDoor.units[0].pageStart - 1
      : 10_000
  return {
    door,
    unit,
    pageStart: unit.pageStart,
    pageEnd: Math.max(unit.pageStart, end),
  }
}))

const doorById = new Map(doors.map((door) => [door.id, door]))

function locationForPassage(passage: RawPassage) {
  const page = Number(passage.page) || 0
  const direct = unitLocations.find((location) => page >= location.pageStart && page <= location.pageEnd)
  if (direct) return direct

  const title = String(passage.conceptTitle || passage.section || '').trim()
  if (!title) return null
  const plan = buildSmartQueryPlan(title)
  const best = unitLocations
    .map((location) => ({
      location,
      score: scoreSmartFields(plan, [
        { value: location.unit.title, weight: 5.2, phraseWeight: 1.5, exactWeight: 1.5 },
        { value: (location.unit.keywords || []).join(' '), weight: 2.2 },
        { value: location.door.title, weight: 1.1 },
      ]),
    }))
    .sort((left, right) => right.score - left.score)[0]
  return best?.score > 18 ? best.location : null
}

function searchPassages(query: string, limit: number): EncyclopediaPassageMatch[] {
  const plan = buildSmartQueryPlan(query)
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []

  const ranked = passages.map((passage) => {
    const location = locationForPassage(passage)
    const score = scoreSmartFields(plan, [
      { value: passage.text, weight: 5.8, phraseWeight: 1.7, exactWeight: 1.25 },
      { value: passage.conceptTitle, weight: 4.7, phraseWeight: 1.45, exactWeight: 1.45 },
      { value: passage.section, weight: 3.1, phraseWeight: 1.25 },
      { value: location?.unit.title, weight: 4.2, phraseWeight: 1.4, exactWeight: 1.35 },
      { value: (location?.unit.keywords || []).join(' '), weight: 2.7 },
      { value: location?.door.title, weight: 1.25 },
    ])
    return { passage, location, score }
  })
    .filter((item) => item.score >= 12)
    .sort((left, right) => right.score - left.score || Number(left.passage.page) - Number(right.passage.page))

  const pageBuckets = new Map<number, number>()
  const seen = new Set<string>()
  const output: EncyclopediaPassageMatch[] = []
  for (const item of ranked) {
    const page = Number(item.passage.page) || 0
    const pageCount = pageBuckets.get(page) || 0
    if (pageCount >= 2) continue
    const signature = `${page}:${String(item.passage.text || '').normalize('NFKC').replace(/\s+/g, ' ').slice(0, 110)}`
    if (seen.has(signature)) continue
    seen.add(signature)
    pageBuckets.set(page, pageCount + 1)
    output.push({
      id: item.passage.id,
      text: String(item.passage.text || '').trim(),
      page,
      section: String(item.passage.section || '').trim(),
      conceptId: String(item.passage.conceptId || '').trim(),
      conceptTitle: String(item.passage.conceptTitle || '').trim(),
      score: item.score,
      doorId: item.location?.door.id || null,
      doorNumber: item.location?.door.doorNumber || null,
      doorTitle: item.location?.door.title || '',
      chapterNumber: item.location?.unit.number || null,
      chapterTitle: item.location?.unit.title || '',
    })
    if (output.length >= limit) break
  }
  return output
}

function searchSlides(query: string, limit: number): EncyclopediaSlideMatch[] {
  const plan = buildSmartQueryPlan(query)
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []

  return encyclopediaTeachingTopics
    .map((topic) => {
      const door = doorById.get(topic.doorId)
      const score = scoreSmartFields(plan, [
        { value: topic.title, weight: 7.2, phraseWeight: 1.7, exactWeight: 1.7 },
        { value: topic.videoHints.join(' '), weight: 4.8, phraseWeight: 1.35 },
        { value: topic.chapter, weight: 3.4, phraseWeight: 1.25 },
        { value: topic.objective, weight: 2.8 },
        { value: topic.discussion, weight: 2.1 },
        { value: topic.ranges.map((range) => range.label).join(' '), weight: 1.7 },
        { value: door?.title, weight: 1.25 },
      ])
      return {
        topic,
        score,
        doorNumber: door?.doorNumber || 0,
        doorTitle: door?.title || '',
        presentation: door?.presentation || '',
      }
    })
    .filter((item) => item.score >= 11)
    .sort((left, right) => right.score - left.score || left.doorNumber - right.doorNumber)
    .slice(0, limit)
}

export function searchEncyclopediaKnowledge(
  query: string,
  { passageLimit = 5, slideLimit = 5 }: { passageLimit?: number; slideLimit?: number } = {},
): EncyclopediaKnowledgeSearchResult {
  const cleanQuery = String(query || '').trim().slice(0, 180)
  if (cleanQuery.length < 2) return { query: cleanQuery, passages: [], slides: [] }
  return {
    query: cleanQuery,
    passages: searchPassages(cleanQuery, Math.max(1, Math.min(10, passageLimit))),
    slides: searchSlides(cleanQuery, Math.max(1, Math.min(10, slideLimit))),
  }
}

export function encyclopediaPassageCount() {
  return passages.length
}
