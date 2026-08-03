import teachingMapData from '../data/encyclopedia-teaching-map.json'
import { normalizeEncyclopediaText } from './encyclopedia-video-index'

export type EncyclopediaSlideRange = {
  from: number
  to: number
  label: string
}

export type EncyclopediaTeachingTopic = {
  title: string
  doorId: string
  chapter: string
  ranges: EncyclopediaSlideRange[]
  videoHints: string[]
  chapterNumbers: number[]
  objective: string
  discussion: string
}

export type EncyclopediaTeachingDoor = {
  doorId: string
  slideCount: number
  topics: EncyclopediaTeachingTopic[]
}

type RawTeachingTopic = Omit<EncyclopediaTeachingTopic, 'title' | 'doorId'>
type RawTeachingDoor = { slideCount: number; topics: Record<string, RawTeachingTopic> }

const rawMap = teachingMapData as Record<string, RawTeachingDoor>

export const encyclopediaTeachingDoors: EncyclopediaTeachingDoor[] = Object.entries(rawMap).map(([doorId, door]) => ({
  doorId,
  slideCount: door.slideCount,
  topics: Object.entries(door.topics).map(([title, topic]) => ({ ...topic, title, doorId })),
}))

export const encyclopediaTeachingTopics = encyclopediaTeachingDoors.flatMap((door) => door.topics)

export function getEncyclopediaTeachingDoor(doorId: string) {
  return encyclopediaTeachingDoors.find((door) => door.doorId === doorId) || null
}

export function getEncyclopediaTeachingTopic(doorId: string, title?: string) {
  const door = getEncyclopediaTeachingDoor(doorId)
  if (!door || !title) return null
  const normalizedTitle = normalizeEncyclopediaText(title)
  return door.topics.find((topic) => normalizeEncyclopediaText(topic.title) === normalizedTitle)
    || door.topics.find((topic) => {
      const normalizedTopic = normalizeEncyclopediaText(topic.title)
      return normalizedTopic.includes(normalizedTitle) || normalizedTitle.includes(normalizedTopic)
    })
    || null
}

export function encyclopediaSlideCount(ranges: readonly EncyclopediaSlideRange[]) {
  return ranges.reduce((total, range) => total + Math.max(0, range.to - range.from + 1), 0)
}

const formatArabicNumber = (value: number) => new Intl.NumberFormat('ar-KW-u-nu-arab').format(value)

export function encyclopediaSlideRangeLabel(ranges: readonly EncyclopediaSlideRange[]) {
  if (!ranges.length) return ''
  const labels = ranges.map((range) => range.from === range.to
    ? `الشريحة ${formatArabicNumber(range.from)}`
    : `الشرائح ${formatArabicNumber(range.from)}–${formatArabicNumber(range.to)}`)
  return labels.join('، ')
}

export function scoreEncyclopediaTeachingTopic(tokens: readonly string[], topic: EncyclopediaTeachingTopic) {
  if (!tokens.length) return 0
  const title = normalizeEncyclopediaText(topic.title)
  const haystack = normalizeEncyclopediaText([
    topic.title,
    topic.chapter,
    topic.videoHints.join(' '),
    topic.objective,
    topic.discussion,
    topic.ranges.map((range) => range.label).join(' '),
  ].join(' '))
  return tokens.reduce((score, token) => {
    if (!haystack.includes(token)) return score
    if (title.includes(token)) return score + (token.length >= 6 ? 8 : 6)
    return score + 3
  }, 0)
}
