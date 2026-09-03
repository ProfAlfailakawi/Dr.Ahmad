import { useEffect, useSyncExternalStore } from 'react'
import archivePayload from '../data/media-archive.json' with { type: 'json' }
import transcriptIndexPayload from '../data/media-archive-transcript-index.json' with { type: 'json' }
import type { MediaRecord } from './cms'

export type MediaArchiveKind = 'youtube' | 'audio' | 'television' | 'radio' | 'podcast'
/* النص المعروض في displayText والمعياري للبحث في searchText؛ text يبقى اختيارياً لتوافق الفهارس القديمة. */
export type MediaTranscriptSegment = { start: number; end: number; text?: string; displayText?: string; searchText?: string }
export type MediaArchiveTranscript = {
  id: string
  available: boolean
  source: 'buzz' | 'manual' | 'legacy' | 'none'
  language: string
  segments: MediaTranscriptSegment[]
  text?: string
  segmentCount: number
  indexedAt?: string
}
export type MediaArchiveItem = {
  id: string
  slug: string
  kind: MediaArchiveKind
  url: string
  title: string
  outlet: string
  program?: string
  date?: string
  iso?: string
  duration?: string
  topics?: string
  thumbnail?: string
  transcriptStatus?: string
  audioHostingRequired?: boolean
  audioUrl?: string
  audioFile?: string
}

export type MediaArchiveRecord = Omit<MediaRecord, 'transcript'> & MediaArchiveItem & {
  /** النص القديم محفوظ للتوافق، بينما transcript هو الفهرس الزمني الجديد. */
  legacyTranscript?: string
  transcript: MediaArchiveTranscript | null
}

const items = ((archivePayload as { items?: MediaArchiveItem[] }).items || [])

/* التفريغ الكامل (١٫١ ميغابايت) لا يدخل حزمة الصفحة: يبدأ الفهرس ببطاقاتٍ بلا مقاطع
   — وهو كل ما تحتاجه قائمة الأرشيف لتعرض شارة «مفهرس زمنياً» — ثم تُستبدل بالكامل
   حين يطلب الزائر البحثَ داخل الكلام أو يفتح لقاءً بعينه. الشكل نفسه في الحالتين،
   فما يقرأ `transcript.available` لا يشعر بالفرق، ومن يقرأ `segments` ينتظر الوعد. */
type TranscriptCard = Omit<MediaArchiveTranscript, 'segments'> & { segments?: MediaTranscriptSegment[] }
const transcriptIndex = (transcriptIndexPayload as Record<string, TranscriptCard>) || {}
let transcripts: Record<string, MediaArchiveTranscript> = Object.fromEntries(
  Object.entries(transcriptIndex).map(([id, card]) => [id, { ...card, segments: card.segments || [] }]),
)

let fullTranscriptsPromise: Promise<void> | null = null
let transcriptsRevision = 0
const transcriptListeners = new Set<() => void>()

/** يجلب المقاطع الكاملة مرّةً واحدة، ثم يوقظ من ينتظرها. */
export function ensureArchiveTranscripts() {
  if (!fullTranscriptsPromise) {
    fullTranscriptsPromise = import('../data/media-archive-transcripts.json')
      .then((module) => {
        transcripts = (module.default as Record<string, MediaArchiveTranscript>) || transcripts
        transcriptsRevision += 1
        transcriptListeners.forEach((listener) => listener())
      })
      .catch(() => { fullTranscriptsPromise = null })
  }
  return fullTranscriptsPromise
}

const archiveTranscriptsRevision = () => transcriptsRevision
function subscribeArchiveTranscripts(listener: () => void) {
  transcriptListeners.add(listener)
  return () => { transcriptListeners.delete(listener) }
}

/** ترجع رقم الإصدار فتعيد الحساباتُ المحفوظة نفسها حين تصل المقاطع الكاملة. */
export function useArchiveTranscripts(load = false) {
  const revision = useSyncExternalStore(subscribeArchiveTranscripts, archiveTranscriptsRevision, archiveTranscriptsRevision)
  useEffect(() => { if (load) void ensureArchiveTranscripts() }, [load])
  return revision
}

const archiveItemBySlug = new Map(items.map((item) => [item.slug, item]))
const archiveItemById = new Map(items.map((item) => [item.id, item]))

export const extractMediaId = (url = '') => (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''

const AUDIO_EXTENSION = /\.(?:mp3|m4a|aac|wav|ogg)(?:$|[?#])/i

export function detectMediaKind(item: Partial<MediaRecord> & Partial<MediaArchiveItem>): MediaArchiveKind {
  const explicit = String(item.kind || '').toLowerCase()
  if (explicit === 'youtube' || explicit === 'audio' || explicit === 'television' || explicit === 'radio' || explicit === 'podcast') {
    return explicit
  }
  const descriptor = `${item.platform || ''} ${item.outlet || ''} ${item.channel || ''} ${item.program || ''}`.toLowerCase()
  const source = `${item.audioUrl || ''} ${item.audioFile || ''} ${item.url || ''}`
  if (/بودكاست|podcast/u.test(descriptor)) return 'podcast'
  if (/إذاعة|اذاعه|radio|audio/u.test(descriptor) || AUDIO_EXTENSION.test(source)) return 'audio'
  if (/تلفزيون|television|(?:^|\s)tv(?:\s|$)|قناة/u.test(descriptor)) return 'television'
  return 'youtube'
}
export const formatMediaTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`
}

const normalize = (value = '') => value
  .toLocaleLowerCase('ar')
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export function archiveTranscript(id: string) {
  return transcripts[id] || null
}

/* السجل لا يحمل نسخةً من التفريغ بل نافذةً عليه: يقرأ من الخريطة الحيّة عند كل وصول،
   فحين تصل المقاطع الكاملة تراها السجلاتُ المحفوظة في useMemo من غير أن تُبنى ثانية. */
function withLiveTranscript<T extends object>(record: T, transcriptId: string, fallbackId?: string): T {
  Object.defineProperty(record, 'transcript', {
    enumerable: true,
    configurable: true,
    get: () => archiveTranscript(transcriptId) || (fallbackId ? archiveTranscript(fallbackId) : null),
  })
  return record
}

export function mergeMediaArchive(cmsMedia: MediaRecord[]): MediaArchiveRecord[] {
  const existingKeys = new Set(cmsMedia.flatMap((item) => [extractMediaId(item.url || ''), item.slug]).filter(Boolean))
  const cms: MediaArchiveRecord[] = cmsMedia.map((item) => {
    const videoId = extractMediaId(item.url || '')
    const archiveId = videoId || item.slug
    const { transcript: legacyTranscript, ...baseItem } = item
    /* سجل اللوحة يعلو، لكنه يرث بيانات الأرشيف الساكن (ملف الصوت مثلاً) إن تركها فارغة،
       فلا تفقد المادة صوتها حين يُحرّر عنوانها أو موضوعها من اللوحة. */
    const archived = archiveItemBySlug.get(item.slug) || archiveItemById.get(archiveId)
    /* المواد الإذاعية لا رابط لها، فيصير archiveId هو الاسم اللطيف (radio-idaa) بينما الفهرس
       الزمني محفوظ بمعرّف الأرشيف (idaa) — فنسقط إليه كي لا تختفي الفهرسة عن مادة مفهرسة. */
    const transcript = archiveTranscript(archiveId) || (archived?.id ? archiveTranscript(archived.id) : null)
    return withLiveTranscript({
      ...(archived || {}),
      ...baseItem,
      audioUrl: item.audioUrl || archived?.audioUrl,
      audioFile: item.audioFile || archived?.audioFile,
      date: item.date || archived?.date,
      iso: item.iso || archived?.iso,
      id: archiveId,
      kind: detectMediaKind({ ...(archived || {}), ...item }),
      legacyTranscript,
      transcript,
      transcriptStatus: transcript?.available ? 'transcribed' : legacyTranscript ? 'legacy' : 'missing',
    }, archiveId, archived?.id)
  })
  const additions: MediaArchiveRecord[] = items
    .filter((item) => !existingKeys.has(item.id) && !existingKeys.has(item.slug))
    .map((item) => withLiveTranscript({
      ...item,
      _cms: {
        kind: 'media',
        origin: 'base',
        modified: false,
        hidden: false,
        deleted: false,
        docId: item.slug,
        baseSlug: item.slug,
      },
      transcript: archiveTranscript(item.id),
    }, item.id))
  return [...cms, ...additions]
}

type MomentIndexRow = { itemIndex: number; segmentIndex: number; text: string }
type MomentIndex = { rows: MomentIndexRow[]; postings: Map<string, Uint32Array>; rowsByItem: number[][] }
/* الفهرس مبنيٌّ على المقاطع، فيُختم برقم إصدار التفريغات كي لا يبقى فهرسٌ بُني قبل وصولها. */
const momentIndexCache = new WeakMap<ReturnType<typeof mergeMediaArchive>, { revision: number; index: MomentIndex }>()

function momentTokens(value: string) {
  return [...new Set(normalize(value).split(' ').filter((word) => word.length > 1))].slice(0, 64)
}

function buildMomentIndex(media: ReturnType<typeof mergeMediaArchive>): MomentIndex {
  const cached = momentIndexCache.get(media)
  if (cached && cached.revision === transcriptsRevision) return cached.index
  const rows: MomentIndexRow[] = []
  const rowsByItem: number[][] = Array.from({ length: media.length }, () => [])
  const postingArrays = new Map<string, number[]>()
  for (let itemIndex = 0; itemIndex < media.length; itemIndex += 1) {
    const item = media[itemIndex]
    const transcript = item.transcript || archiveTranscript(item.id)
    if (!transcript?.available) continue
    for (let segmentIndex = 0; segmentIndex < (transcript.segments || []).length; segmentIndex += 1) {
      const segment = transcript.segments[segmentIndex]
      const text = normalize(segment.searchText || segment.displayText || segment.text)
      if (!text) continue
      const rowIndex = rows.length
      rows.push({ itemIndex, segmentIndex, text })
      rowsByItem[itemIndex].push(rowIndex)
      for (const token of momentTokens(text)) {
        const posting = postingArrays.get(token) || []
        posting.push(rowIndex)
        postingArrays.set(token, posting)
      }
    }
  }
  const postings = new Map<string, Uint32Array>()
  for (const [token, posting] of postingArrays) postings.set(token, Uint32Array.from(posting))
  const index = { rows, postings, rowsByItem }
  momentIndexCache.set(media, { revision: transcriptsRevision, index })
  return index
}

export function searchArchiveMoments(query: string, media: ReturnType<typeof mergeMediaArchive>) {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(' ').filter((word) => word.length > 1)
  const index = buildMomentIndex(media)
  const candidateRows = new Set<number>()
  const postingRows = words
    .map((word) => index.postings.get(word))
    .filter((posting): posting is Uint32Array => Boolean(posting))
    .sort((a, b) => a.length - b.length)
  /* Search only transcript segments containing at least one query token. This
     turns repeated searches over large media archives into posting lookups. */
  for (const posting of postingRows.slice(0, 6)) {
    for (const rowIndex of posting) {
      candidateRows.add(rowIndex)
      if (candidateRows.size >= 12_000) break
    }
    if (candidateRows.size >= 12_000) break
  }
  /* Preserve the old title-search behavior without rescanning transcript text:
     if the material title matches, its already-indexed segments are candidates. */
  if (candidateRows.size < 12_000) {
    for (let itemIndex = 0; itemIndex < media.length; itemIndex += 1) {
      if (!normalize(media[itemIndex].title).includes(q)) continue
      for (const rowIndex of index.rowsByItem[itemIndex]) {
        candidateRows.add(rowIndex)
        if (candidateRows.size >= 12_000) break
      }
      if (candidateRows.size >= 12_000) break
    }
  }
  if (!candidateRows.size) return []

  const results: Array<{ item: (typeof media)[number]; segment: MediaTranscriptSegment; score: number }> = []
  for (const rowIndex of candidateRows) {
    const row = index.rows[rowIndex]
    if (!row) continue
    const item = media[row.itemIndex]
    const transcript = item.transcript || archiveTranscript(item.id)
    const segment = transcript?.segments?.[row.segmentIndex]
    if (!item || !segment) continue
    let score = row.text.includes(q) ? 120 : 0
    score += words.reduce((sum, word) => sum + (row.text.includes(word) ? 18 : 0), 0)
    if (normalize(item.title).includes(q)) score += 25
    if (score <= 0) continue
    results.push({ item, segment, score })
  }
  return results.sort((a, b) => b.score - a.score || a.segment.start - b.segment.start).slice(0, 40)
}

