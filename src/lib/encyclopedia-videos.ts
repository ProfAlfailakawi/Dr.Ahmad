import fallbackCatalogData from '../data/encyclopedia-videos-fallback.json'

export type EncyclopediaVideo = {
  id: string
  title: string
  url: string
  embedUrl: string
  thumbnail: string
  durationText: string
  durationSeconds: number
  publishedText: string
  viewCountText: string
  description: string
  position: number
  doorNumber?: number
  chapterNumber?: number
  videoNumber?: number | null
  mappingSource?: string
  mappingConfidence?: string
  playlistId?: string
  playlistTitle?: string
}

export type EncyclopediaVideoCatalog = {
  channel: { handle: string; url: string; id: string }
  count: number
  mappedCount?: number
  fetchedAt: string
  source: string
  stale?: boolean
  transcriptIndex?: EncyclopediaTranscriptProgress
  videos: EncyclopediaVideo[]
}

let catalogPromise: Promise<EncyclopediaVideoCatalog> | null = null

const validVideo = (value: unknown): value is EncyclopediaVideo => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EncyclopediaVideo>
  return typeof item.id === 'string' && /^[\w-]{6,20}$/.test(item.id) && typeof item.title === 'string' && item.title.trim().length > 0
}

function normalizedCatalog(payload: Partial<EncyclopediaVideoCatalog>, source?: string): EncyclopediaVideoCatalog {
  const videos = Array.isArray(payload.videos) ? (payload.videos as EncyclopediaVideo[]).filter(validVideo) : []
  return {
    channel: {
      handle: String(payload.channel?.handle || 'موسوعةتكنولوجياالتعليم'),
      url: String(payload.channel?.url || 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'),
      id: String(payload.channel?.id || ''),
    },
    count: videos.length,
    mappedCount: Number(payload.mappedCount) || videos.filter((video) => Number(video.doorNumber) > 0 && Number(video.chapterNumber) > 0).length,
    fetchedAt: String(payload.fetchedAt || ''),
    source: String(source || payload.source || 'youtube-channel'),
    stale: Boolean(payload.stale),
    transcriptIndex: payload.transcriptIndex && typeof payload.transcriptIndex === 'object'
      ? {
          running: Boolean(payload.transcriptIndex.running),
          total: Number(payload.transcriptIndex.total) || videos.length,
          completed: Number(payload.transcriptIndex.completed) || 0,
          available: Number(payload.transcriptIndex.available) || 0,
          catalogued: Number(payload.transcriptIndex.catalogued) || Number(payload.transcriptIndex.total) || videos.length,
          transcribed: Number(payload.transcriptIndex.transcribed) || Number(payload.transcriptIndex.available) || 0,
          processed: Number(payload.transcriptIndex.processed) || Number(payload.transcriptIndex.completed) || 0,
          noSpeech: Number(payload.transcriptIndex.noSpeech) || 0,
          introductions: Number(payload.transcriptIndex.introductions) || 0,
          autoCorrected: Number(payload.transcriptIndex.autoCorrected) || 0,
          autoTranscribed: Number(payload.transcriptIndex.autoTranscribed) || 0,
          boilerplateOnly: Number(payload.transcriptIndex.boilerplateOnly) || 0,
          processingPercent: Number(payload.transcriptIndex.processingPercent) || 0,
          transcriptionPercent: Number(payload.transcriptIndex.transcriptionPercent) || 0,
          needsReview: Number(payload.transcriptIndex.needsReview) || 0,
          missing: Number(payload.transcriptIndex.missing) || Math.max(0, (Number(payload.transcriptIndex.total) || videos.length) - (Number(payload.transcriptIndex.available) || 0)),
          sources: {
            buzz: Number(payload.transcriptIndex.sources?.buzz) || 0,
            'youtube-captions': Number(payload.transcriptIndex.sources?.['youtube-captions']) || 0,
            'manual-reviewed': Number(payload.transcriptIndex.sources?.['manual-reviewed']) || 0,
          },
        }
      : undefined,
    videos,
  }
}

const fallbackCatalog = normalizedCatalog(fallbackCatalogData as Partial<EncyclopediaVideoCatalog>, 'static-complete-catalog')

function mergeVideo(live: EncyclopediaVideo, archived?: EncyclopediaVideo): EncyclopediaVideo {
  if (!archived) return live
  return {
    ...archived,
    ...live,
    title: live.title?.trim() || archived.title,
    description: live.description?.trim() || archived.description,
    thumbnail: live.thumbnail?.trim() || archived.thumbnail,
    durationText: live.durationText?.trim() || archived.durationText,
    durationSeconds: live.durationSeconds || archived.durationSeconds,
    publishedText: live.publishedText?.trim() || archived.publishedText,
    viewCountText: live.viewCountText?.trim() || archived.viewCountText,
    doorNumber: live.doorNumber || archived.doorNumber,
    chapterNumber: live.chapterNumber || archived.chapterNumber,
    videoNumber: live.videoNumber || archived.videoNumber,
    mappingSource: live.mappingSource || archived.mappingSource,
    mappingConfidence: live.mappingConfidence || archived.mappingConfidence,
    playlistId: live.playlistId || archived.playlistId,
    playlistTitle: live.playlistTitle || archived.playlistTitle,
  }
}

function completeCatalog(livePayload: Partial<EncyclopediaVideoCatalog>): EncyclopediaVideoCatalog {
  const live = normalizedCatalog(livePayload)
  const archivedById = new Map(fallbackCatalog.videos.map((video) => [video.id, video]))
  const merged = new Map<string, EncyclopediaVideo>()

  for (const video of live.videos) merged.set(video.id, mergeVideo(video, archivedById.get(video.id)))
  for (const video of fallbackCatalog.videos) if (!merged.has(video.id)) merged.set(video.id, video)

  const videos = [...merged.values()].map((video, index) => ({ ...video, position: index + 1 }))
  return {
    ...live,
    channel: live.channel.id ? live.channel : fallbackCatalog.channel,
    count: videos.length,
    mappedCount: videos.filter((video) => Number(video.doorNumber) > 0 && Number(video.chapterNumber) > 0).length,
    source: videos.length > live.videos.length ? `${live.source}+static-complete-catalog` : live.source,
    videos,
  }
}

/**
 * فهرس ثابت كامل يظهر فوراً، ثم تُدمج فوقه بيانات YouTube الحية. بهذه الطريقة
 * لا تختفي الفيديوهات إذا تأخرت خدمة القناة أو أعادت YouTube صفحة ناقصة.
 */
export function getEncyclopediaFallbackCatalog(): EncyclopediaVideoCatalog {
  return {
    ...fallbackCatalog,
    channel: { ...fallbackCatalog.channel },
    videos: fallbackCatalog.videos.map((video) => ({ ...video })),
  }
}

export async function getEncyclopediaVideoCatalog(signal?: AbortSignal): Promise<EncyclopediaVideoCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(`/api/encyclopedia/videos?v=20260803-6`, {
      signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Video catalog HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('application/json')) throw new Error('Video catalog returned a non-JSON response')
        return completeCatalog(await response.json() as Partial<EncyclopediaVideoCatalog>)
      })
      .catch((error) => {
        catalogPromise = null
        if (error?.name === 'AbortError') throw error
        return getEncyclopediaFallbackCatalog()
      })
  }
  return catalogPromise
}

export function youtubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
}

export function resetEncyclopediaVideoCatalog() {
  catalogPromise = null
}

export type EncyclopediaTranscriptProgress = {
  running: boolean
  total: number
  completed: number
  available: number
  transcribed: number
  processed: number
  noSpeech: number
  introductions: number
  autoCorrected: number
  autoTranscribed: number
  boilerplateOnly: number
  processingPercent: number
  transcriptionPercent: number
  needsReview: number
  missing: number
  catalogued?: number
  sources: {
    buzz: number
    'youtube-captions': number
    'manual-reviewed': number
  }
}

export type EncyclopediaVideoMoment = {
  video: EncyclopediaVideo
  videoId: string
  topic: string
  startSeconds: number
  endSeconds: number
  excerpt: string
  confidence: 'exact' | 'strong' | 'inferred'
  source: 'buzz' | 'youtube-captions' | 'manual-reviewed' | 'sequence' | 'title'
  score: number
  hasExactTiming: boolean
  matchReason?: 'exact-phrase' | 'proper-name' | 'canonical-term' | 'synonym' | 'glossary' | 'correction' | 'token-overlap' | 'metadata-fallback'
  matchReasonLabel?: string
  matchedTerms?: string[]
  contentType?: 'encyclopedia-introduction' | 'encyclopedia-chapter-video'
  mappingReviewStatus?: string
  transcriptReviewStatus?: string
  doorId?: string | null
  doorNumber?: number | null
  chapterNumber?: number | null
  chapterTitle?: string | null
  mappingSource?: string
  mappingConfidence?: string
  reviewStatus?: string
  sequence: {
    doorNumber: number | null
    chapterNumber: number | null
    videoNumber: number | null
  }
  embedUrl: string
}

export type EncyclopediaVideoMomentSearch = {
  query: string
  moments: EncyclopediaVideoMoment[]
  progress: EncyclopediaTranscriptProgress
}

const validMoment = (value: unknown): value is EncyclopediaVideoMoment => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EncyclopediaVideoMoment>
  return validVideo(item.video) && typeof item.videoId === 'string' && typeof item.startSeconds === 'number' && Number.isFinite(item.startSeconds)
}

export async function getEncyclopediaVideoMoment({
  topic,
  doorNumber,
  videoId,
  hints = [],
  signal,
}: {
  topic: string
  doorNumber?: number
  videoId?: string
  hints?: readonly string[]
  signal?: AbortSignal
}): Promise<EncyclopediaVideoMoment | null> {
  const params = new URLSearchParams({ topic: String(topic || '').trim() })
  if (doorNumber) params.set('door', String(doorNumber))
  if (videoId) params.set('video', videoId)
  for (const hint of hints.slice(0, 8)) if (String(hint || '').trim()) params.append('hint', String(hint).trim())
  const response = await fetch(`/api/encyclopedia/video-moment?${params}`, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Video moment HTTP ${response.status}`)
  const payload = await response.json() as unknown
  return validMoment(payload) ? payload : null
}

export async function searchEncyclopediaVideoMoments(
  query: string,
  { doorNumber, limit = 6, signal }: { doorNumber?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<EncyclopediaVideoMomentSearch> {
  const params = new URLSearchParams({ q: String(query || '').trim(), limit: String(Math.max(1, Math.min(10, limit))) })
  if (doorNumber) params.set('door', String(doorNumber))
  const response = await fetch(`/api/encyclopedia/video-search?${params}`, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`Video moment search HTTP ${response.status}`)
  const payload = await response.json() as Partial<EncyclopediaVideoMomentSearch>
  const progress = payload.progress && typeof payload.progress === 'object'
    ? {
        running: Boolean(payload.progress.running),
        total: Number(payload.progress.total) || 0,
        completed: Number(payload.progress.completed) || 0,
        available: Number(payload.progress.available) || 0,
        catalogued: Number(payload.progress.catalogued) || Number(payload.progress.total) || 0,
        transcribed: Number(payload.progress.transcribed) || Number(payload.progress.available) || 0,
        processed: Number(payload.progress.processed) || Number(payload.progress.completed) || 0,
        noSpeech: Number(payload.progress.noSpeech) || 0,
        introductions: Number(payload.progress.introductions) || 0,
        autoCorrected: Number(payload.progress.autoCorrected) || 0,
        autoTranscribed: Number(payload.progress.autoTranscribed) || 0,
        boilerplateOnly: Number(payload.progress.boilerplateOnly) || 0,
        processingPercent: Number(payload.progress.processingPercent) || 0,
        transcriptionPercent: Number(payload.progress.transcriptionPercent) || 0,
        needsReview: Number(payload.progress.needsReview) || 0,
        missing: Number(payload.progress.missing) || Math.max(0, (Number(payload.progress.total) || 0) - (Number(payload.progress.available) || 0)),
        sources: {
          buzz: Number(payload.progress.sources?.buzz) || 0,
          'youtube-captions': Number(payload.progress.sources?.['youtube-captions']) || 0,
          'manual-reviewed': Number(payload.progress.sources?.['manual-reviewed']) || 0,
        },
      }
    : { running: false, total: 0, completed: 0, available: 0, transcribed: 0, processed: 0, noSpeech: 0, introductions: 0, autoCorrected: 0, autoTranscribed: 0, boilerplateOnly: 0, processingPercent: 0, transcriptionPercent: 0, needsReview: 0, missing: 0, catalogued: 0, sources: { buzz: 0, 'youtube-captions': 0, 'manual-reviewed': 0 } }
  return {
    query: String(payload.query || query),
    moments: Array.isArray(payload.moments) ? payload.moments.filter(validMoment) : [],
    progress,
  }
}
