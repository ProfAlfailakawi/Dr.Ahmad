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
  mappingConfidence?: 'exact' | 'strong'
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
  transcriptIndex?: { running: boolean; total: number; completed: number; available: number }
  videos: EncyclopediaVideo[]
}

let catalogPromise: Promise<EncyclopediaVideoCatalog> | null = null

const validVideo = (value: unknown): value is EncyclopediaVideo => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<EncyclopediaVideo>
  return typeof item.id === 'string' && /^[\w-]{6,20}$/.test(item.id) && typeof item.title === 'string' && item.title.trim().length > 0
}

export async function getEncyclopediaVideoCatalog(signal?: AbortSignal): Promise<EncyclopediaVideoCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(`/api/encyclopedia/videos?v=20260803-5`, {
      signal,
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Video catalog HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().includes('application/json')) throw new Error('Video catalog returned a non-JSON response')
        const payload = await response.json() as Partial<EncyclopediaVideoCatalog>
        const videos = Array.isArray(payload.videos) ? payload.videos.filter(validVideo) : []
        if (!videos.length) throw new Error('Video catalog is empty')
        return {
          channel: {
            handle: String(payload.channel?.handle || 'موسوعةتكنولوجياالتعليم'),
            url: String(payload.channel?.url || 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos'),
            id: String(payload.channel?.id || ''),
          },
          count: videos.length,
          mappedCount: Number(payload.mappedCount) || videos.filter((video) => Number(video.doorNumber) > 0 && Number(video.chapterNumber) > 0).length,
          fetchedAt: String(payload.fetchedAt || ''),
          source: String(payload.source || 'youtube-channel'),
          stale: Boolean(payload.stale),
          transcriptIndex: payload.transcriptIndex && typeof payload.transcriptIndex === 'object'
            ? {
                running: Boolean(payload.transcriptIndex.running),
                total: Number(payload.transcriptIndex.total) || videos.length,
                completed: Number(payload.transcriptIndex.completed) || 0,
                available: Number(payload.transcriptIndex.available) || 0,
              }
            : undefined,
          videos,
        }
      })
      .catch((error) => {
        catalogPromise = null
        throw error
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
}

export type EncyclopediaVideoMoment = {
  video: EncyclopediaVideo
  videoId: string
  topic: string
  startSeconds: number
  endSeconds: number
  excerpt: string
  confidence: 'exact' | 'strong' | 'inferred'
  source: 'captions' | 'sequence' | 'title'
  score: number
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
      }
    : { running: false, total: 0, completed: 0, available: 0 }
  return {
    query: String(payload.query || query),
    moments: Array.isArray(payload.moments) ? payload.moments.filter(validMoment) : [],
    progress,
  }
}
