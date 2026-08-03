const CHANNEL_HANDLE = 'موسوعةتكنولوجياالتعليم'
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}/videos`
const CACHE_TTL = 6 * 60 * 60 * 1000
const MAX_PAGES = 24
const MAX_VIDEOS = 500

let memoryCache = { expiresAt: 0, payload: null, promise: null }

const plainText = (node) => {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node.simpleText === 'string') return node.simpleText
  if (Array.isArray(node.runs)) return node.runs.map((run) => run?.text || '').join('')
  if (node.accessibility?.accessibilityData?.label) return String(node.accessibility.accessibilityData.label)
  return ''
}

const bounded = (value, limit = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)

function balancedJson(source, objectStart) {
  if (objectStart < 0 || source[objectStart] !== '{') return null
  let depth = 0
  let string = false
  let escaped = false
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index]
    if (string) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') string = false
      continue
    }
    if (char === '"') { string = true; continue }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        try { return JSON.parse(source.slice(objectStart, index + 1)) } catch { return null }
      }
    }
  }
  return null
}

function jsonAfterMarker(source, markers) {
  for (const marker of markers) {
    const markerIndex = source.indexOf(marker)
    if (markerIndex < 0) continue
    const start = source.indexOf('{', markerIndex + marker.length)
    const value = balancedJson(source, start)
    if (value) return value
  }
  return null
}

export function extractYouTubeBootstrap(html) {
  const initialData = jsonAfterMarker(html, ['var ytInitialData =', 'window["ytInitialData"] =', 'ytInitialData ='])
  const context = jsonAfterMarker(html, ['"INNERTUBE_CONTEXT":', 'INNERTUBE_CONTEXT":'])
  const apiKey = bounded(html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1], 160)
  const clientVersion = bounded(
    context?.client?.clientVersion
      || html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]
      || html.match(/"clientVersion":"([^"]+)"/)?.[1],
    80,
  )
  const visitorData = bounded(
    context?.client?.visitorData
      || html.match(/"VISITOR_DATA":"([^"]+)"/)?.[1]
      || html.match(/"visitorData":"([^"]+)"/)?.[1],
    500,
  )
  const channelId = bounded(
    html.match(/"externalId":"(UC[\w-]+)"/)?.[1]
      || html.match(/"channelId":"(UC[\w-]+)"/)?.[1],
    80,
  )
  return { initialData, context, apiKey, clientVersion, visitorData, channelId }
}

function durationSeconds(value) {
  const parts = String(value || '').split(':').map(Number)
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function parseRenderer(renderer, position) {
  if (!renderer || typeof renderer !== 'object') return null
  const id = bounded(renderer.videoId, 24)
  const title = bounded(plainText(renderer.title), 500)
  if (!/^[\w-]{6,20}$/.test(id) || !title) return null
  const navigationUrl = renderer.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || ''
  if (navigationUrl && !String(navigationUrl).startsWith('/watch')) return null
  const thumbnails = renderer.thumbnail?.thumbnails || renderer.richThumbnail?.movingThumbnailRenderer?.movingThumbnailDetails?.thumbnails || []
  const thumbnail = bounded(thumbnails.at?.(-1)?.url || thumbnails[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 2_000)
  const durationText = bounded(plainText(renderer.lengthText), 40)
  const description = bounded(plainText(renderer.descriptionSnippet), 1_500)
  return {
    id,
    title,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    thumbnail,
    durationText,
    durationSeconds: durationSeconds(durationText),
    publishedText: bounded(plainText(renderer.publishedTimeText), 100),
    viewCountText: bounded(plainText(renderer.viewCountText || renderer.shortViewCountText), 100),
    description,
    position,
  }
}

export function parseYouTubeVideos(payload) {
  const items = []
  const seenObjects = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seenObjects.has(value)) return
    seenObjects.add(value)
    if (value.videoRenderer) {
      const parsed = parseRenderer(value.videoRenderer, items.length + 1)
      if (parsed) items.push(parsed)
    }
    if (value.gridVideoRenderer) {
      const parsed = parseRenderer(value.gridVideoRenderer, items.length + 1)
      if (parsed) items.push(parsed)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(payload)
  const unique = new Map()
  for (const item of items) if (!unique.has(item.id)) unique.set(item.id, { ...item, position: unique.size + 1 })
  return [...unique.values()]
}

export function parseYouTubeContinuations(payload) {
  const tokens = []
  const seenObjects = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seenObjects.has(value)) return
    seenObjects.add(value)
    const candidates = [
      value.continuationCommand?.token,
      value.nextContinuationData?.continuation,
      value.reloadContinuationData?.continuation,
    ]
    for (const token of candidates) {
      const normalized = bounded(token, 4_000)
      if (normalized && !tokens.includes(normalized)) tokens.push(normalized)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(payload)
  return tokens
}

async function responseText(response) {
  if (!response?.ok) throw new Error(`YouTube HTTP ${response?.status || 0}`)
  return response.text()
}

async function responseJson(response) {
  if (!response?.ok) throw new Error(`YouTube browse HTTP ${response?.status || 0}`)
  return response.json()
}

async function fetchWithDeadline(fetchImpl, url, options = {}, timeoutMs = 18_000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try { return await fetchImpl(url, { ...options, signal: controller.signal }) }
  finally { clearTimeout(timer) }
}

function mergeItems(target, additions) {
  for (const item of additions) if (!target.has(item.id)) target.set(item.id, { ...item, position: target.size + 1 })
}

export async function fetchEncyclopediaVideoCatalog({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable')
  const pageResponse = await fetchWithDeadline(fetchImpl, encodeURI(CHANNEL_URL), {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ar,en;q=0.7',
      'user-agent': 'Mozilla/5.0 (compatible; DrAlfailakawi-Encyclopedia/1.0)',
    },
  })
  const html = await responseText(pageResponse)
  const bootstrap = extractYouTubeBootstrap(html)
  if (!bootstrap.initialData) throw new Error('YouTube initial data was not found')

  const items = new Map()
  mergeItems(items, parseYouTubeVideos(bootstrap.initialData))
  let queue = parseYouTubeContinuations(bootstrap.initialData)
  const usedTokens = new Set()

  if (bootstrap.apiKey && bootstrap.clientVersion && queue.length) {
    const context = bootstrap.context?.client
      ? bootstrap.context
      : { client: { clientName: 'WEB', clientVersion: bootstrap.clientVersion, hl: 'ar', gl: 'KW', ...(bootstrap.visitorData ? { visitorData: bootstrap.visitorData } : {}) } }

    for (let page = 0; page < MAX_PAGES && queue.length && items.size < MAX_VIDEOS; page += 1) {
      const continuation = queue.shift()
      if (!continuation || usedTokens.has(continuation)) continue
      usedTokens.add(continuation)
      const response = await fetchWithDeadline(fetchImpl, `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(bootstrap.apiKey)}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: 'https://www.youtube.com',
          referer: CHANNEL_URL,
          'user-agent': 'Mozilla/5.0 (compatible; DrAlfailakawi-Encyclopedia/1.0)',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': bootstrap.clientVersion,
          ...(bootstrap.visitorData ? { 'x-goog-visitor-id': bootstrap.visitorData } : {}),
        },
        body: JSON.stringify({ context, continuation }),
      })
      const payload = await responseJson(response)
      mergeItems(items, parseYouTubeVideos(payload))
      for (const token of parseYouTubeContinuations(payload)) if (!usedTokens.has(token) && !queue.includes(token)) queue.push(token)
    }
  }

  const videos = [...items.values()].slice(0, MAX_VIDEOS).map((item, index) => ({ ...item, position: index + 1 }))
  if (!videos.length) throw new Error('No videos were found on the channel')
  return {
    channel: { handle: CHANNEL_HANDLE, url: CHANNEL_URL, id: bootstrap.channelId || '' },
    count: videos.length,
    fetchedAt: new Date().toISOString(),
    source: 'youtube-channel',
    videos,
  }
}

export async function loadEncyclopediaVideoCatalog({ fetchImpl = globalThis.fetch, force = false } = {}) {
  const now = Date.now()
  if (!force && memoryCache.payload && memoryCache.expiresAt > now) return memoryCache.payload
  if (!force && memoryCache.promise) return memoryCache.promise

  memoryCache.promise = fetchEncyclopediaVideoCatalog({ fetchImpl })
    .then((payload) => {
      memoryCache = { payload, expiresAt: Date.now() + CACHE_TTL, promise: null }
      return payload
    })
    .catch((error) => {
      memoryCache.promise = null
      if (memoryCache.payload) return { ...memoryCache.payload, stale: true }
      throw error
    })
  return memoryCache.promise
}

export function resetEncyclopediaVideoCache() {
  memoryCache = { expiresAt: 0, payload: null, promise: null }
}
