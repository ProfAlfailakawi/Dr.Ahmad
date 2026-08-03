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
}

export type EncyclopediaVideoCatalog = {
  channel: { handle: string; url: string; id: string }
  count: number
  fetchedAt: string
  source: string
  stale?: boolean
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
    catalogPromise = fetch('/api/encyclopedia/videos', { signal, headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Video catalog HTTP ${response.status}`)
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
          fetchedAt: String(payload.fetchedAt || ''),
          source: String(payload.source || 'youtube-channel'),
          stale: Boolean(payload.stale),
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
