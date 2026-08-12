import { loadBookPassagesFor } from './book-quotes'
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
  matchReason: string
  evidence: string[]
}

export type EncyclopediaSlideMatch = {
  topic: EncyclopediaTeachingTopic
  score: number
  doorNumber: number
  doorTitle: string
  presentation: string
  matchReason: string
  evidence: string[]
}

export type EncyclopediaKnowledgeSearchContext = {
  transcriptExcerpt?: string
  doorNumber?: number | null
  chapterNumber?: number | null
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
/* متن الموسوعة يصل بشريحته وحده (٦٩٢ ك.ب) لا بالكتب التسعة (١٣٣٤ ك.ب).
   كان استيراده هنا ساكناً، فكانت أوّل كتابةٍ في مربّع البحث تجرّ المتون كلها
   وتجمّد الخيط الرئيسي في تحليلها. `primeEncyclopediaPassages` تُستدعى من
   البوّابة قبل أوّل بحث، والشرائح تُخزَّن فلا تُجلب مرّتين. */
let passages: RawPassage[] = []

export async function primeEncyclopediaPassages(): Promise<boolean> {
  if (passages.length) return true
  const file = await loadBookPassagesFor('encyclopedia')
  passages = (file.books || []).find((book) => book.slug === 'encyclopedia')?.passages as RawPassage[] || []
  locationCache = []
  evidenceCache = []
  return passages.length > 0
}

/** هل وصل المتن؟ (الشرائح تصل بعد أوّل نداء؛ قبلها تُردّ الشرائح التعليمية وحدها.) */
export const encyclopediaPassagesReady = () => passages.length > 0

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

function normalizedEvidenceText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ═══ ما يخصّ المقطع يُحسب مرّةً واحدة ═══
   كان كلُّ بحثٍ يعيد — لكلٍّ من المقاطع الـ٩٣٦ — البحثَ الخطّيَّ عن موضع
   المقطع في الأبواب. وهو لا يتعلّق بالسؤال أصلاً، فيُحفظ عند أوّل حساب. */
type PassageLocation = ReturnType<typeof locationForPassage>
let locationCache: (PassageLocation | undefined)[] = []
let evidenceCache: (string | undefined)[] = []

function passageLocation(passage: RawPassage, index: number): PassageLocation {
  const cached = locationCache[index]
  if (cached !== undefined) return cached
  const location = locationForPassage(passage)
  locationCache[index] = location
  return location
}

/* التطبيع الكامل لنصّ المقطع مكلف (سبع مراحل regex، منها اثنتان على خصائص
   يونيكود). ولا يلزم إلا لشهادة «وردت العبارة نصّاً» — وهي تُعرض ولا تُرتّب.
   فلا يُدفع ثمنه إلا للنتائج الظاهرة، ويُحفظ بعدها. */
function passageEvidenceText(passage: RawPassage, index: number): string {
  const cached = evidenceCache[index]
  if (cached !== undefined) return cached
  const text = normalizedEvidenceText(`${passage.text} ${passage.conceptTitle || ''} ${passage.section || ''}`)
  evidenceCache[index] = text
  return text
}

function searchPassages(query: string, limit: number, context: EncyclopediaKnowledgeSearchContext = {}): EncyclopediaPassageMatch[] {
  const plan = buildSmartQueryPlan(query)
  const transcriptPlan = context.transcriptExcerpt ? buildSmartQueryPlan(context.transcriptExcerpt) : null
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []

  /* هذه القيمة لا تتعلّق بالمقطع، وكانت تُحسب داخل الحلقة — ٩٣٦ مرّة لكل بحث. */
  const normalizedQuery = normalizedEvidenceText(query)

  const ranked = passages.map((passage, index) => {
    const location = passageLocation(passage, index)
    let score = scoreSmartFields(plan, [
      { value: passage.text, weight: 5.8, phraseWeight: 1.7, exactWeight: 1.25 },
      { value: passage.conceptTitle, weight: 4.7, phraseWeight: 1.45, exactWeight: 1.45 },
      { value: passage.section, weight: 3.1, phraseWeight: 1.25 },
      { value: location?.unit.title, weight: 4.2, phraseWeight: 1.4, exactWeight: 1.35 },
      { value: (location?.unit.keywords || []).join(' '), weight: 2.7 },
      { value: location?.door.title, weight: 1.25 },
    ])
    if (transcriptPlan) score += scoreSmartFields(transcriptPlan, [
      { value: passage.text, weight: 1.35, phraseWeight: 1.1, exactWeight: 1.05 },
      { value: passage.conceptTitle, weight: 1.05 },
      { value: location?.unit.title, weight: 1.15 },
    ]) * 0.22
    const sameChapter = Boolean(context.chapterNumber && location?.unit.number === context.chapterNumber && (!context.doorNumber || location.door.doorNumber === context.doorNumber))
    const sameDoor = Boolean(context.doorNumber && location?.door.doorNumber === context.doorNumber)
    if (sameChapter) score += 13
    else if (sameDoor) score += 5
    return { passage, index, location, score, sameChapter, sameDoor }
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
    /* «وردت العبارة نصّاً» شهادةٌ تُعرض ولا تدخل في الترتيب. فحسابها هنا —
       على النتائج الظاهرة وحدها (٤٠ على الأكثر) — لا على المقاطع الـ٩٣٦.
       هذا وحده ما كان يجمّد أوّل بحثٍ ثلاثَ ثوانٍ. */
    const exactPhrase = Boolean(normalizedQuery && passageEvidenceText(item.passage, item.index).includes(normalizedQuery))
    const evidence = [
      exactPhrase ? 'وردت العبارة أو صيغتها المباشرة في متن الكتاب.' : '',
      item.sameChapter ? 'المقطع يقع في الباب والفصل نفسيهما للفيديو.' : item.sameDoor ? 'المقطع يقع في الباب نفسه.' : '',
      transcriptPlan ? 'عزز سياق الكلام المفرغ ترتيب هذا المقطع.' : '',
    ].filter(Boolean)
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
      matchReason: exactPhrase
        ? 'أقرب موضع وردت فيه العبارة داخل متن الكتاب.'
        : item.sameChapter
          ? 'أقرب مقطع في الباب والفصل نفسيهما، مدعوم بسياق التفريغ.'
          : 'أقرب مقطع كتاب وفق المصطلحات والسياق العلمي.',
      evidence,
    })
    if (output.length >= limit) break
  }
  return output
}

function searchSlides(query: string, limit: number, context: EncyclopediaKnowledgeSearchContext = {}): EncyclopediaSlideMatch[] {
  const plan = buildSmartQueryPlan(query)
  const transcriptPlan = context.transcriptExcerpt ? buildSmartQueryPlan(context.transcriptExcerpt) : null
  if (!plan.directRoots.length && !plan.semanticRoots.length) return []

  return encyclopediaTeachingTopics
    .map((topic) => {
      const door = doorById.get(topic.doorId)
      let score = scoreSmartFields(plan, [
        { value: topic.title, weight: 7.2, phraseWeight: 1.7, exactWeight: 1.7 },
        { value: topic.videoHints.join(' '), weight: 4.8, phraseWeight: 1.35 },
        { value: topic.chapter, weight: 3.4, phraseWeight: 1.25 },
        { value: topic.objective, weight: 2.8 },
        { value: topic.discussion, weight: 2.1 },
        { value: topic.ranges.map((range) => range.label).join(' '), weight: 1.7 },
        { value: door?.title, weight: 1.25 },
      ])
      if (transcriptPlan) score += scoreSmartFields(transcriptPlan, [
        { value: topic.title, weight: 1.4 },
        { value: topic.videoHints.join(' '), weight: 1.1 },
        { value: topic.objective, weight: 0.75 },
      ]) * 0.2
      const sameChapter = Boolean(context.chapterNumber && topic.chapterNumbers.includes(context.chapterNumber) && (!context.doorNumber || door?.doorNumber === context.doorNumber))
      const sameDoor = Boolean(context.doorNumber && door?.doorNumber === context.doorNumber)
      if (sameChapter) score += 12
      else if (sameDoor) score += 4
      const normalizedQuery = normalizedEvidenceText(query)
      const exactPhrase = Boolean(normalizedQuery && normalizedEvidenceText(`${topic.title} ${topic.videoHints.join(' ')} ${topic.objective}`).includes(normalizedQuery))
      const evidence = [
        exactPhrase ? 'تطابق المصطلح مع عنوان المحور أو كلماته المفتاحية.' : '',
        sameChapter ? 'المادة تخص الباب والفصل نفسيهما.' : sameDoor ? 'المادة تخص الباب نفسه.' : '',
        topic.ranges.length ? 'نطاق الشرائح موثق في خريطة التدريس.' : '',
      ].filter(Boolean)
      return {
        topic,
        score,
        doorNumber: door?.doorNumber || 0,
        doorTitle: door?.title || '',
        presentation: door?.presentation || '',
        matchReason: exactPhrase
          ? 'المحور التدريسي يطابق المصطلح مباشرة.'
          : sameChapter
            ? 'المحور التدريسي مرتبط بالفصل نفسه ومدعوم بسياق الفيديو.'
            : 'المحور الأقرب وفق الكلمات المفتاحية والهدف التعليمي.',
        evidence,
      }
    })
    .filter((item) => item.score >= 11)
    .sort((left, right) => right.score - left.score || left.doorNumber - right.doorNumber)
    .slice(0, limit)
}

export function searchEncyclopediaKnowledge(
  query: string,
  { passageLimit = 5, slideLimit = 5, context = {} }: { passageLimit?: number; slideLimit?: number; context?: EncyclopediaKnowledgeSearchContext } = {},
): EncyclopediaKnowledgeSearchResult {
  const cleanQuery = String(query || '').trim().slice(0, 180)
  if (cleanQuery.length < 2) return { query: cleanQuery, passages: [], slides: [] }
  return {
    query: cleanQuery,
    /* السقف رُفع من 10 إلى 60: الواجهة صارت تستعرض كل ما يُحسب، فلا يجوز أن
       يُعلن عددٌ لا يمكن بلوغه. والكشف التدريجي هو من يحمي الأداء لا البتر. */
    passages: searchPassages(cleanQuery, Math.max(1, Math.min(60, passageLimit)), context),
    slides: searchSlides(cleanQuery, Math.max(1, Math.min(60, slideLimit)), context),
  }
}

export function encyclopediaPassageCount() {
  return passages.length
}
