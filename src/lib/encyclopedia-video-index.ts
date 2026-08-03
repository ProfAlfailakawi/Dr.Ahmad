import type { BookKnowledgeConcept } from './book-knowledge'
import type { EncyclopediaVideo } from './encyclopedia-videos'

export type EncyclopediaDoorDescriptor = {
  id: string
  doorNumber: number
  title: string
  topics: readonly string[]
  hints: readonly string[]
  presentation?: string
  units?: readonly {
    number: number
    title: string
    keywords?: readonly string[]
  }[]
}

export type IndexedEncyclopediaVideo = EncyclopediaVideo & {
  doorId: string | null
  doorNumber: number | null
  chapterNumber: number | null
  chapterTitle: string | null
  videoNumber: number | null
  concept: BookKnowledgeConcept | null
  searchText: string
  sequenceLabel: string
  mappingSource?: string
  mappingConfidence?: 'exact' | 'strong'
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const NUMBER_WORDS: Record<string, number> = {
  اول: 1,
  الاول: 1,
  واحد: 1,
  واحده: 1,
  ثاني: 2,
  الثاني: 2,
  اثنان: 2,
  اثنين: 2,
  ثالث: 3,
  الثالث: 3,
  ثلاثه: 3,
  رابع: 4,
  الرابع: 4,
  اربعه: 4,
  خامس: 5,
  الخامس: 5,
  خمسه: 5,
  سادس: 6,
  السادس: 6,
  سته: 6,
  سابع: 7,
  السابع: 7,
  سبعه: 7,
  ثامن: 8,
  الثامن: 8,
  ثمانيه: 8,
  تاسع: 9,
  التاسع: 9,
  تسعه: 9,
  عاشر: 10,
  العاشر: 10,
  عشره: 10,
}

export function normalizeEncyclopediaText(value = '') {
  return value
    .normalize('NFKC')
    .toLowerCase()
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

export function encyclopediaTokens(value = '') {
  return normalizeEncyclopediaText(value).split(' ').filter((token) => token.length > 1)
}

function numericToken(value = '') {
  const normalized = normalizeEncyclopediaText(value)
  if (/^\d{1,3}$/.test(normalized)) return Number(normalized)
  return NUMBER_WORDS[normalized] || null
}

function numberFollowing(value: string, labels: readonly string[]) {
  const words = normalizeEncyclopediaText(value).split(' ').filter(Boolean)
  const normalizedLabels = new Set(labels.map(normalizeEncyclopediaText))
  for (let index = 0; index < words.length; index += 1) {
    if (!normalizedLabels.has(words[index])) continue
    for (let lookAhead = index + 1; lookAhead <= Math.min(words.length - 1, index + 3); lookAhead += 1) {
      if (words[lookAhead] === 'رقم' || words[lookAhead] === 'الرقم') continue
      const parsed = numericToken(words[lookAhead])
      if (parsed !== null) return parsed
      break
    }
  }
  return null
}

export function extractEncyclopediaSequence(title: string) {
  const labeled = {
    doorNumber: numberFollowing(title, ['الباب', 'باب', 'door', 'ب']),
    chapterNumber: numberFollowing(title, ['الفصل', 'فصل', 'chapter', 'ف']),
    videoNumber: numberFollowing(title, ['فيديو', 'الفيديو', 'المقطع', 'مقطع', 'video', 'v']),
  }
  const compactText = title
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (character) => String(ARABIC_DIGITS.indexOf(character)))
    .replace(/[۰-۹]/g, (character) => String(PERSIAN_DIGITS.indexOf(character)))
  const compact = /\b(?:19|20)\d{2}\b/.test(compactText)
    ? null
    : compactText.match(/(?:^|\s|[[(])([1-5])\s*[-_/|.:]\s*(\d{1,2})(?:\s*[-_/|.:]\s*(\d{1,3}))?(?:\s|$|[\])])/u)
  return {
    doorNumber: labeled.doorNumber || (compact ? Number(compact[1]) : null),
    chapterNumber: labeled.chapterNumber || (compact ? Number(compact[2]) : null),
    videoNumber: labeled.videoNumber || (compact?.[3] ? Number(compact[3]) : null),
  }
}

function phraseScore(haystack: string, phrase: string, exactWeight: number) {
  const normalized = normalizeEncyclopediaText(phrase)
  if (!normalized || !haystack.includes(normalized)) return 0
  return exactWeight + Math.min(4, normalized.split(' ').length)
}

function resolveDoor(video: EncyclopediaVideo, doors: readonly EncyclopediaDoorDescriptor[]) {
  const sequence = extractEncyclopediaSequence(video.title)
  const explicit = sequence.doorNumber ? doors.find((door) => door.doorNumber === sequence.doorNumber) : null
  if (explicit) return { door: explicit, ...sequence }

  const haystack = normalizeEncyclopediaText(`${video.title} ${video.description}`)
  let best: { door: EncyclopediaDoorDescriptor; score: number } | null = null
  for (const door of doors) {
    const score = [door.title, ...door.topics, ...door.hints]
      .reduce((total, phrase, index) => total + phraseScore(haystack, phrase, index === 0 ? 7 : 3), 0)
    if (!best || score > best.score) best = { door, score }
  }
  return { door: best && best.score >= 5 ? best.door : null, ...sequence }
}

function resolveChapter(video: EncyclopediaVideo, door: EncyclopediaDoorDescriptor | null, explicitChapter: number | null) {
  const units = door?.units || []
  if (!units.length) return { chapterNumber: explicitChapter, chapterTitle: null }

  if (explicitChapter) {
    const explicit = units.find((unit) => unit.number === explicitChapter)
    if (explicit) return { chapterNumber: explicit.number, chapterTitle: explicit.title }
  }

  /* بعض فيديوهات القناة تحمل اسم الموضوع بلا رقم فصل. نربطها بفصل PDF من
     عنوان الفصل وكلماته المفتاحية، بدلاً من تركها خارج الخريطة أو إسنادها
     إلى أول فصل اعتباطاً. */
  const haystack = normalizeEncyclopediaText(`${video.title} ${video.description}`)
  let best: { number: number; title: string; score: number } | null = null
  for (const unit of units) {
    const score = phraseScore(haystack, unit.title, 9)
      + (unit.keywords || []).reduce((total, keyword) => total + phraseScore(haystack, keyword, 3), 0)
    if (!best || score > best.score) best = { number: unit.number, title: unit.title, score }
  }
  return best && best.score >= 5
    ? { chapterNumber: best.number, chapterTitle: best.title }
    : { chapterNumber: explicitChapter, chapterTitle: null }
}

function conceptScore(videoText: string, concept: BookKnowledgeConcept) {
  const conceptTitle = normalizeEncyclopediaText(concept.title)
  let score = conceptTitle && videoText.includes(conceptTitle) ? 12 + Math.min(5, conceptTitle.split(' ').length) : 0
  for (const keyword of concept.keywords) score += phraseScore(videoText, keyword, 4)

  const videoTokens = new Set(encyclopediaTokens(videoText))
  const conceptTokens = new Set(encyclopediaTokens(`${concept.title} ${concept.keywords.join(' ')}`))
  for (const token of conceptTokens) if (token.length >= 4 && videoTokens.has(token)) score += 1
  return score
}

function resolveConcept(video: EncyclopediaVideo, concepts: readonly BookKnowledgeConcept[]) {
  const videoText = normalizeEncyclopediaText(`${video.title} ${video.description}`)
  let best: { concept: BookKnowledgeConcept; score: number } | null = null
  for (const concept of concepts) {
    const score = conceptScore(videoText, concept)
    if (!best || score > best.score) best = { concept, score }
  }
  return best && best.score >= 6 ? best.concept : null
}

function sequenceLabel(doorNumber: number | null, chapterNumber: number | null, videoNumber: number | null) {
  const parts: string[] = []
  if (doorNumber) parts.push(`الباب ${doorNumber}`)
  if (chapterNumber) parts.push(`الفصل ${chapterNumber}`)
  if (videoNumber) parts.push(`المقطع ${videoNumber}`)
  return parts.join(' · ')
}

export function indexEncyclopediaVideos(
  videos: readonly EncyclopediaVideo[],
  doors: readonly EncyclopediaDoorDescriptor[],
  concepts: readonly BookKnowledgeConcept[],
): IndexedEncyclopediaVideo[] {
  const indexed = videos.map((video) => {
    const resolved = resolveDoor(video, doors)
    const serverDoorNumber = Number(video.doorNumber) || null
    const serverChapterNumber = Number(video.chapterNumber) || null
    const serverDoor = serverDoorNumber ? doors.find((door) => door.doorNumber === serverDoorNumber) || null : null
    const concept = resolveConcept(video, concepts)
    const door = serverDoor || resolved.door
    const chapter = serverDoor && serverChapterNumber && serverDoor.units?.some((unit) => unit.number === serverChapterNumber)
      ? { chapterNumber: serverChapterNumber, chapterTitle: serverDoor.units?.find((unit) => unit.number === serverChapterNumber)?.title || null }
      : resolveChapter(video, door, resolved.chapterNumber)
    const resolvedVideoNumber = Number(video.videoNumber) || resolved.videoNumber
    const label = sequenceLabel(door?.doorNumber || resolved.doorNumber, chapter.chapterNumber, resolvedVideoNumber)
    const chapterUnit = door?.units?.find((unit) => unit.number === chapter.chapterNumber)
    const searchText = normalizeEncyclopediaText([
      video.title,
      video.description,
      label,
      door?.title,
      door?.topics.join(' '),
      chapter.chapterTitle,
      chapterUnit?.keywords?.join(' '),
      concept?.title,
      concept?.keywords.join(' '),
      concept?.summary,
    ].filter(Boolean).join(' '))

    return {
      ...video,
      doorId: door?.id || null,
      doorNumber: door?.doorNumber || resolved.doorNumber,
      chapterNumber: chapter.chapterNumber,
      chapterTitle: chapter.chapterTitle,
      videoNumber: resolvedVideoNumber,
      mappingSource: video.mappingSource,
      mappingConfidence: video.mappingConfidence,
      concept,
      searchText,
      sequenceLabel: label,
    }
  })

  return indexed.sort((left, right) => {
    const leftDoor = left.doorNumber || 99
    const rightDoor = right.doorNumber || 99
    if (leftDoor !== rightDoor) return leftDoor - rightDoor
    const leftChapter = left.chapterNumber || 999
    const rightChapter = right.chapterNumber || 999
    if (leftChapter !== rightChapter) return leftChapter - rightChapter
    const leftVideo = left.videoNumber || 999
    const rightVideo = right.videoNumber || 999
    if (leftVideo !== rightVideo) return leftVideo - rightVideo
    return left.position - right.position
  })
}

export function scoreIndexedVideo(tokens: readonly string[], video: IndexedEncyclopediaVideo) {
  if (!tokens.length) return 0
  const title = normalizeEncyclopediaText(video.title)
  const concept = normalizeEncyclopediaText(`${video.concept?.title || ''} ${video.concept?.keywords.join(' ') || ''}`)
  return tokens.reduce((score, token) => {
    if (!video.searchText.includes(token)) return score
    if (title.includes(token)) return score + (token.length >= 6 ? 8 : 6)
    if (concept.includes(token)) return score + 4
    return score + 2
  }, 0)
}
