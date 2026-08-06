import archivePayload from '../data/media-archive.json' with { type: 'json' }
import transcriptPayload from '../data/media-archive-transcripts.json' with { type: 'json' }
import type { MediaRecord } from './cms'

export type MediaArchiveKind = 'youtube' | 'audio' | 'television' | 'radio' | 'podcast'
export type MediaTranscriptSegment = { start: number; end: number; text: string; displayText?: string; searchText?: string }
export type MediaArchiveTranscript = {
  id: string
  available: boolean
  source: 'buzz' | 'manual' | 'legacy' | 'none'
  language: string
  segments: MediaTranscriptSegment[]
  text: string
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
const transcripts = (transcriptPayload as Record<string, MediaArchiveTranscript>) || {}

export const extractMediaId = (url = '') => (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''
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

export function mergeMediaArchive(cmsMedia: MediaRecord[]): MediaArchiveRecord[] {
  const existingIds = new Set(cmsMedia.map((item) => extractMediaId(item.url || '')).filter(Boolean))
  const cms: MediaArchiveRecord[] = cmsMedia.map((item) => {
    const videoId = extractMediaId(item.url || '')
    const { transcript: legacyTranscript, ...baseItem } = item
    const transcript = videoId ? archiveTranscript(videoId) : null
    return {
      ...baseItem,
      id: videoId || item.slug,
      kind: (item.platform?.toLowerCase().includes('radio') ? 'radio' : 'youtube') as MediaArchiveKind,
      legacyTranscript,
      transcript,
      transcriptStatus: transcript?.available ? 'transcribed' : legacyTranscript ? 'legacy' : 'missing',
    }
  })
  const additions: MediaArchiveRecord[] = items
    .filter((item) => !existingIds.has(item.id))
    .map((item) => ({
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
    }))
  return [...cms, ...additions]
}

export function searchArchiveMoments(query: string, media: ReturnType<typeof mergeMediaArchive>) {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(' ').filter((word) => word.length > 1)
  const results: Array<{ item: (typeof media)[number]; segment: MediaTranscriptSegment; score: number }> = []
  for (const item of media) {
    const transcript = item.transcript || archiveTranscript(item.id)
    if (!transcript?.available) continue
    for (const segment of transcript.segments || []) {
      const text = normalize(segment.searchText || segment.displayText || segment.text)
      if (!text) continue
      let score = text.includes(q) ? 120 : 0
      score += words.reduce((sum, word) => sum + (text.includes(word) ? 18 : 0), 0)
      if (normalize(item.title).includes(q)) score += 25
      if (score > 0) results.push({ item, segment, score })
    }
  }
  return results.sort((a, b) => b.score - a.score || a.segment.start - b.segment.start).slice(0, 40)
}
