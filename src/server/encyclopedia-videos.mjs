import { readFileSync } from 'node:fs'

const CHANNEL_HANDLE = 'موسوعةتكنولوجياالتعليم'
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}/videos`
const CHANNEL_PAGE_URLS = [
  CHANNEL_URL,
  `${CHANNEL_URL}?hl=ar&gl=KW&persist_gl=1`,
  `${CHANNEL_URL}?hl=en&gl=US&app=desktop`,
]
const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
const CACHE_TTL = 6 * 60 * 60 * 1000
const MAX_PAGES = 24
const MAX_VIDEOS = 500
const MAX_MAPPED_PLAYLISTS = 36
const PLAYLIST_CONCURRENCY = 12

let memoryCache = { expiresAt: 0, payload: null, promise: null }

let catalogStructure = { doors: [] }
try {
  catalogStructure = JSON.parse(readFileSync(new URL('../data/encyclopedia-structure.json', import.meta.url), 'utf8'))
} catch {
  catalogStructure = { doors: [] }
}

const CATALOG_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const CATALOG_PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const CATALOG_NUMBER_WORDS = {
  اول: 1, الاول: 1, واحد: 1, واحده: 1,
  ثاني: 2, الثاني: 2, اثنان: 2, اثنين: 2,
  ثالث: 3, الثالث: 3, ثلاثه: 3,
  رابع: 4, الرابع: 4, اربعه: 4,
  خامس: 5, الخامس: 5, خمسه: 5,
  سادس: 6, السادس: 6, سته: 6,
  سابع: 7, السابع: 7, سبعه: 7,
  ثامن: 8, الثامن: 8, ثمانيه: 8,
  تاسع: 9, التاسع: 9, تسعه: 9,
  عاشر: 10, العاشر: 10, عشره: 10,
}

function normalizeCatalogText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (character) => String(CATALOG_ARABIC_DIGITS.indexOf(character)))
    .replace(/[۰-۹]/g, (character) => String(CATALOG_PERSIAN_DIGITS.indexOf(character)))
    .replace(/[^\p{L}\p{N}\s._/|:-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function catalogNumericToken(value = '') {
  const normalized = normalizeCatalogText(value).replace(/[^\p{L}\p{N}]/gu, '')
  if (/^\d{1,3}$/.test(normalized)) return Number(normalized)
  return CATALOG_NUMBER_WORDS[normalized] || null
}

function catalogNumberAfterLabel(value, labels) {
  const words = normalizeCatalogText(value).replace(/[._/|:-]/g, ' ').split(' ').filter(Boolean)
  const labelSet = new Set(labels.map(normalizeCatalogText))
  for (let index = 0; index < words.length; index += 1) {
    if (!labelSet.has(words[index])) continue
    for (let next = index + 1; next <= Math.min(words.length - 1, index + 3); next += 1) {
      if (words[next] === 'رقم' || words[next] === 'الرقم' || words[next] === 'no') continue
      const parsed = catalogNumericToken(words[next])
      if (parsed !== null) return parsed
      break
    }
  }
  return null
}

function compactCatalogSequence(value = '') {
  const normalized = normalizeCatalogText(value)
  if (/\b(?:19|20)\d{2}\b/.test(normalized)) return null
  const labeled = normalized.match(/(?:^|\s)(?:ب|باب)\s*(\d{1,2})\s*(?:[-_/|.:]|\s)+(?:ف|فصل)\s*(\d{1,2})(?:\s*(?:[-_/|.:]|\s)+(?:فيديو|مقطع|v)?\s*(\d{1,3}))?/u)
  if (labeled) return { doorNumber: Number(labeled[1]), chapterNumber: Number(labeled[2]), videoNumber: labeled[3] ? Number(labeled[3]) : null }
  const compact = normalized.match(/(?:^|\s|[[(])([1-5])\s*[-_/|.:]\s*(\d{1,2})(?:\s*[-_/|.:]\s*(\d{1,3}))?(?:\s|$|[\])])/u)
  if (!compact) return null
  return { doorNumber: Number(compact[1]), chapterNumber: Number(compact[2]), videoNumber: compact[3] ? Number(compact[3]) : null }
}

function extractCatalogSequence(title = '') {
  const sequence = {
    doorNumber: catalogNumberAfterLabel(title, ['الباب', 'باب', 'door', 'ب']),
    chapterNumber: catalogNumberAfterLabel(title, ['الفصل', 'فصل', 'chapter', 'ف']),
    videoNumber: catalogNumberAfterLabel(title, ['فيديو', 'الفيديو', 'المقطع', 'مقطع', 'video', 'v']),
  }
  const compact = compactCatalogSequence(title)
  return {
    doorNumber: sequence.doorNumber || compact?.doorNumber || null,
    chapterNumber: sequence.chapterNumber || compact?.chapterNumber || null,
    videoNumber: sequence.videoNumber || compact?.videoNumber || null,
  }
}

const CATALOG_GENERIC_TERMS = new Set([
  'التعليم', 'التعلم', 'التدريس', 'التكنولوجيا', 'تقنيه', 'تكنولوجيا التعليم',
  'موسوعه', 'شرح', 'فيديو', 'مقطع', 'الطالب', 'المعلم', 'مفهوم', 'استخدام',
].map(normalizeCatalogText))

function validCatalogLocation(doorNumber, chapterNumber) {
  const door = catalogStructure.doors?.find((item) => Number(item.doorNumber) === Number(doorNumber))
  const unit = door?.units?.find((item) => Number(item.number) === Number(chapterNumber))
  return door && unit ? { door, unit } : null
}

function resolveCatalogLocation(value = '', forcedDoorNumber = 0) {
  const sequence = extractCatalogSequence(value)
  const explicitDoor = forcedDoorNumber || sequence.doorNumber || 0
  if (explicitDoor && sequence.chapterNumber) {
    const valid = validCatalogLocation(explicitDoor, sequence.chapterNumber)
    if (valid) return { doorNumber: Number(valid.door.doorNumber), chapterNumber: Number(valid.unit.number), source: 'sequence', confidence: 'exact', videoNumber: sequence.videoNumber }
  }

  const haystack = normalizeCatalogText(value)
  const candidates = []
  for (const door of catalogStructure.doors || []) {
    if (explicitDoor && Number(door.doorNumber) !== Number(explicitDoor)) continue
    const doorTitle = normalizeCatalogText(door.title)
    for (const unit of door.units || []) {
      const unitTitle = normalizeCatalogText(unit.title)
      const exactTitle = Boolean(unitTitle && haystack.includes(unitTitle))
      const matchedKeywords = (unit.keywords || [])
        .map(normalizeCatalogText)
        .filter((keyword) => keyword.length >= 4 && !CATALOG_GENERIC_TERMS.has(keyword) && haystack.includes(keyword))
      let score = exactTitle ? 100 : 0
      if (doorTitle && haystack.includes(doorTitle)) score += 14
      for (const keyword of matchedKeywords) score += keyword.includes(' ') ? 16 : Math.min(12, 4 + Math.floor(keyword.length / 2))
      if (score > 0) candidates.push({ door, unit, score, exactTitle })
    }
  }
  candidates.sort((left, right) => right.score - left.score || Number(left.door.doorNumber) - Number(right.door.doorNumber) || Number(left.unit.number) - Number(right.unit.number))
  const best = candidates[0]
  const second = candidates[1]
  if (!best) return null
  const strong = best.exactTitle || (best.score >= 20 && (!second || best.score - second.score >= 8))
  if (!strong) return null
  return {
    doorNumber: Number(best.door.doorNumber),
    chapterNumber: Number(best.unit.number),
    source: best.exactTitle ? 'topic-title' : 'topic-keywords',
    confidence: best.exactTitle ? 'exact' : 'strong',
    videoNumber: sequence.videoNumber,
  }
}

const plainText = (node) => {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (typeof node.simpleText === 'string') return node.simpleText
  if (typeof node.content === 'string') return node.content
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

function parseLockupViewModel(vm, position) {
  if (!vm || vm.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null
  const id = bounded(vm.contentId, 24)
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null
  const meta = vm.metadata?.lockupMetadataViewModel
  const title = bounded(meta?.title?.content || plainText(vm.rendererContext?.accessibilityContext?.label), 500)
  const sources = vm.contentImage?.thumbnailViewModel?.image?.sources || []
  const thumbnail = bounded(sources.at(-1)?.url || sources[sources.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 2000)
  const overlay = vm.contentImage?.thumbnailViewModel?.overlays || []
  let durationText = ''
  for (const ov of overlay) {
    const badgeText = bounded(ov?.thumbnailBadgeViewModel?.text, 40)
    if (/^\d+:\d+/.test(badgeText)) durationText = badgeText
  }
  return {
    id,
    title: title || 'موسوعة تكنولوجيا التعليم',
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    thumbnail,
    durationText,
    durationSeconds: durationSeconds(durationText),
    publishedText: '',
    viewCountText: '',
    description: '',
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
    if (value.playlistVideoRenderer) {
      const parsed = parseRenderer(value.playlistVideoRenderer, items.length + 1)
      if (parsed) items.push(parsed)
    }
    if (value.lockupViewModel) {
      const parsed = parseLockupViewModel(value.lockupViewModel, items.length + 1)
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


function decodeXml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

function xmlValue(source, tag) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(source)
  return decodeXml(match?.[1] || '').trim()
}

export function parseYouTubeFeed(xml) {
  const entries = String(xml || '').match(/<entry\b[\s\S]*?<\/entry>/gi) || []
  return entries.map((entry, index) => {
    const id = bounded(xmlValue(entry, 'yt:videoId'), 24)
    const title = bounded(xmlValue(entry, 'title'), 500)
    if (!/^[\w-]{6,20}$/.test(id) || !title) return null
    const thumbnail = bounded(new RegExp('<media:thumbnail[^>]+url="([^"]+)"', 'i').exec(entry)?.[1] || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, 2_000)
    return {
      id,
      title,
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      thumbnail: decodeXml(thumbnail),
      durationText: '',
      durationSeconds: 0,
      publishedText: bounded(xmlValue(entry, 'published'), 100),
      viewCountText: '',
      description: bounded(xmlValue(entry, 'media:description'), 1_500),
      position: index + 1,
    }
  }).filter(Boolean)
}

async function fetchPageBootstrap(fetchImpl, pageUrls) {
  let lastError = null
  for (const pageUrl of pageUrls) {
    try {
      const response = await fetchWithDeadline(fetchImpl, encodeURI(pageUrl), {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ar-KW,ar;q=0.9,en;q=0.7',
          'user-agent': YOUTUBE_USER_AGENT,
          cookie: 'CONSENT=YES+; SOCS=CAI',
        },
      })
      const html = await responseText(response)
      const bootstrap = extractYouTubeBootstrap(html)
      if (bootstrap.initialData || bootstrap.channelId) return { html, bootstrap, pageUrl }
      lastError = new Error('YouTube bootstrap data was not found')
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('YouTube page is unavailable')
}

async function fetchChannelBootstrap(fetchImpl) {
  return fetchPageBootstrap(fetchImpl, CHANNEL_PAGE_URLS)
}

async function fetchYouTubeFeed(fetchImpl, channelId) {
  if (!/^UC[\w-]{8,}$/.test(String(channelId || ''))) return []
  try {
    const response = await fetchWithDeadline(fetchImpl, `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, {
      headers: { accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.5', 'user-agent': YOUTUBE_USER_AGENT },
    }, 12_000)
    return parseYouTubeFeed(await responseText(response))
  } catch {
    return []
  }
}

function playlistTitle(renderer) {
  return bounded(
    plainText(renderer?.title)
      || plainText(renderer?.metadata?.lockupMetadataViewModel?.title)
      || plainText(renderer?.metadata?.lockupMetadataViewModel?.metadata?.title),
    500,
  )
}

export function parseYouTubePlaylists(payload) {
  const playlists = []
  const seenObjects = new Set()
  const visit = (value) => {
    if (!value || typeof value !== 'object' || seenObjects.has(value)) return
    seenObjects.add(value)
    const renderers = [value.playlistRenderer, value.gridPlaylistRenderer].filter(Boolean)
    for (const renderer of renderers) {
      const id = bounded(renderer.playlistId, 100)
      const title = playlistTitle(renderer)
      if (id && title) playlists.push({ id, title })
    }
    if (value.lockupViewModel) {
      const renderer = value.lockupViewModel
      const id = bounded(renderer.contentId, 100)
      const title = playlistTitle(renderer)
      if (id && title && /^(?:PL|UU|OLAK5uy_)/i.test(id)) playlists.push({ id, title })
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(payload)
  const unique = new Map()
  for (const playlist of playlists) if (!unique.has(playlist.id)) unique.set(playlist.id, playlist)
  return [...unique.values()]
}

async function fetchPlaylistAssignments(fetchImpl) {
  const playlistUrls = [
    `https://www.youtube.com/@${CHANNEL_HANDLE}/playlists`,
    `https://www.youtube.com/@${CHANNEL_HANDLE}/playlists?view=1&sort=dd&shelf_id=0`,
  ]
  let bootstrap
  try {
    bootstrap = (await fetchPageBootstrap(fetchImpl, playlistUrls)).bootstrap
  } catch {
    return { assignments: new Map(), videos: [] }
  }
  const playlists = parseYouTubePlaylists(bootstrap.initialData)
    .map((playlist) => ({ playlist, location: resolveCatalogLocation(playlist.title) }))
    .filter((item) => item.location)
    .slice(0, MAX_MAPPED_PLAYLISTS)
  if (!playlists.length) return { assignments: new Map(), videos: [] }

  const assignments = new Map()
  const videos = new Map()
  const ambiguous = new Set()
  for (let offset = 0; offset < playlists.length; offset += PLAYLIST_CONCURRENCY) {
    const batch = playlists.slice(offset, offset + PLAYLIST_CONCURRENCY)
    const pages = await Promise.all(batch.map(async ({ playlist, location }) => {
      try {
        const page = await fetchPageBootstrap(fetchImpl, [`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}`])
        return { playlist, location, items: parseYouTubeVideos(page.bootstrap.initialData) }
      } catch {
        return { playlist, location, items: [] }
      }
    }))
    for (const { playlist, location, items } of pages) {
      for (const item of items) {
        videos.set(item.id, item)
        const directItemLocation = resolveCatalogLocation(`${item.title} ${item.description}`, location.doorNumber)
        const itemLocation = directItemLocation || location
        if (!itemLocation?.chapterNumber) continue
        const next = {
          doorNumber: itemLocation.doorNumber,
          chapterNumber: itemLocation.chapterNumber,
          videoNumber: itemLocation.videoNumber || null,
          mappingSource: directItemLocation?.source === 'sequence' ? 'playlist+title' : 'playlist',
          mappingConfidence: itemLocation.confidence || 'exact',
          playlistId: playlist.id,
          playlistTitle: playlist.title,
        }
        const previous = assignments.get(item.id)
        if (previous && (previous.doorNumber !== next.doorNumber || previous.chapterNumber !== next.chapterNumber)) {
          ambiguous.add(item.id)
          assignments.delete(item.id)
        } else if (!ambiguous.has(item.id)) {
          assignments.set(item.id, next)
        }
      }
    }
  }
  return { assignments, videos: [...videos.values()] }
}

function applyCatalogAssignments(videos, playlistAssignments = new Map()) {
  let mappedCount = 0
  const mapped = videos.map((video) => {
    const playlist = playlistAssignments.get(video.id)
    const direct = resolveCatalogLocation(`${video.title} ${video.description}`)
    const assignment = playlist || (direct ? {
      doorNumber: direct.doorNumber,
      chapterNumber: direct.chapterNumber,
      videoNumber: direct.videoNumber || null,
      mappingSource: direct.source === 'sequence' ? 'title-sequence' : 'title-topic',
      mappingConfidence: direct.confidence,
    } : null)
    if (!assignment) return video
    mappedCount += 1
    return { ...video, ...assignment }
  })
  return { videos: mapped, mappedCount }
}

export async function fetchEncyclopediaVideoCatalog({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable')
  const { bootstrap } = await fetchChannelBootstrap(fetchImpl)

  const items = new Map()
  if (bootstrap.initialData) mergeItems(items, parseYouTubeVideos(bootstrap.initialData))
  let queue = bootstrap.initialData ? parseYouTubeContinuations(bootstrap.initialData) : []
  const usedTokens = new Set()

  if (bootstrap.apiKey && bootstrap.clientVersion && queue.length) {
    const context = bootstrap.context?.client
      ? bootstrap.context
      : { client: { clientName: 'WEB', clientVersion: bootstrap.clientVersion, hl: 'ar', gl: 'KW', ...(bootstrap.visitorData ? { visitorData: bootstrap.visitorData } : {}) } }

    for (let page = 0; page < MAX_PAGES && queue.length && items.size < MAX_VIDEOS; page += 1) {
      const continuation = queue.shift()
      if (!continuation || usedTokens.has(continuation)) continue
      usedTokens.add(continuation)
      try {
        const response = await fetchWithDeadline(fetchImpl, `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(bootstrap.apiKey)}`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            origin: 'https://www.youtube.com',
            referer: CHANNEL_URL,
            'user-agent': YOUTUBE_USER_AGENT,
            'x-youtube-client-name': '1',
            'x-youtube-client-version': bootstrap.clientVersion,
            ...(bootstrap.visitorData ? { 'x-goog-visitor-id': bootstrap.visitorData } : {}),
          },
          body: JSON.stringify({ context, continuation }),
        })
        const payload = await responseJson(response)
        mergeItems(items, parseYouTubeVideos(payload))
        for (const token of parseYouTubeContinuations(payload)) if (!usedTokens.has(token) && !queue.includes(token)) queue.push(token)
      } catch {
        // لا نسقط الفهرس كله إذا تعطلت صفحة متابعة واحدة؛ نعرض ما وصل فعلاً.
        break
      }
    }
  }

  if (!items.size && bootstrap.channelId) mergeItems(items, await fetchYouTubeFeed(fetchImpl, bootstrap.channelId))

  let baseVideos = [...items.values()].slice(0, MAX_VIDEOS).map((item, index) => ({ ...item, position: index + 1 }))
  if (!baseVideos.length) throw new Error('No videos were found on the channel')
  let assigned = applyCatalogAssignments(baseVideos)
  if (assigned.mappedCount < baseVideos.length) {
    const playlistCatalog = await fetchPlaylistAssignments(fetchImpl).catch(() => ({ assignments: new Map(), videos: [] }))
    mergeItems(items, playlistCatalog.videos)
    baseVideos = [...items.values()].slice(0, MAX_VIDEOS).map((item, index) => ({ ...item, position: index + 1 }))
    assigned = applyCatalogAssignments(baseVideos, playlistCatalog.assignments)
  }
  return {
    channel: { handle: CHANNEL_HANDLE, url: CHANNEL_URL, id: bootstrap.channelId || '' },
    count: assigned.videos.length,
    mappedCount: assigned.mappedCount,
    fetchedAt: new Date().toISOString(),
    source: items.size > 15 ? 'youtube-channel+playlists' : 'youtube-channel-or-feed+playlists',
    videos: assigned.videos,
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


/* --------------------------------------------------------------------------
 * الفهرس المنطوق للموسوعة
 *
 * لا ندّعي توقيتاً دقيقاً من عنوان الفيديو. الموضع لا يُوسم «من النص
 * المنطوق» إلا إذا وجدناه فعلاً في مسار ترجمة YouTube. وإذا لم تتوافر
 * ترجمة، يبقى الفيديو مرتبطاً بالباب وتسلسله فقط ويبدأ من أوله.
 * ----------------------------------------------------------------------- */

const TRANSCRIPT_TTL = 24 * 60 * 60 * 1000
const TRANSCRIPT_FAILURE_TTL = 2 * 60 * 60 * 1000
const MATCH_TTL = 24 * 60 * 60 * 1000
const MAX_TRANSCRIPT_CANDIDATES = 36
const MAX_SEARCH_FETCHES = 16
const TRANSCRIPT_WARMUP_BATCH = 12
const TRANSCRIPT_WARMUP_CONCURRENCY = 2
const TRANSCRIPT_SAFETY_SECONDS = 3

const transcriptCache = new Map()
const momentCache = new Map()
let transcriptWarmup = { running: false, total: 0, completed: 0, available: 0, videoIds: [], promise: null }

let teachingMap = {}
let encyclopediaStructure = catalogStructure
try {
  teachingMap = JSON.parse(readFileSync(new URL('../data/encyclopedia-teaching-map.json', import.meta.url), 'utf8'))
} catch {
  teachingMap = {}
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const VIDEO_NUMBER_WORDS = {
  اول: 1, الاول: 1, واحد: 1, واحده: 1,
  ثاني: 2, الثاني: 2, اثنان: 2, اثنين: 2,
  ثالث: 3, الثالث: 3, ثلاثه: 3,
  رابع: 4, الرابع: 4, اربعه: 4,
  خامس: 5, الخامس: 5, خمسه: 5,
  سادس: 6, السادس: 6, سته: 6,
  سابع: 7, السابع: 7, سبعه: 7,
  ثامن: 8, الثامن: 8, ثمانيه: 8,
  تاسع: 9, التاسع: 9, تسعه: 9,
  عاشر: 10, العاشر: 10, عشره: 10,
}

const MOMENT_STOP_WORDS = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون ثم او أم و لا ما هو هي باب فصل فيديو مقطع شرح الموسوعه التعليم تكنولوجيا'.split(' '))

export function normalizeEncyclopediaMomentText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[٠-٩]/g, (character) => String(ARABIC_DIGITS.indexOf(character)))
    .replace(/[۰-۹]/g, (character) => String(PERSIAN_DIGITS.indexOf(character)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function momentTokens(value = '') {
  return normalizeEncyclopediaMomentText(value)
    .split(' ')
    .filter((token) => token.length > 2 && !MOMENT_STOP_WORDS.has(token))
}

function numericVideoToken(value = '') {
  const normalized = normalizeEncyclopediaMomentText(value)
  if (/^\d{1,3}$/.test(normalized)) return Number(normalized)
  return VIDEO_NUMBER_WORDS[normalized] || null
}

function numberAfterLabel(value, labels) {
  const words = normalizeEncyclopediaMomentText(value).split(' ').filter(Boolean)
  const labelSet = new Set(labels.map(normalizeEncyclopediaMomentText))
  for (let index = 0; index < words.length; index += 1) {
    if (!labelSet.has(words[index])) continue
    for (let next = index + 1; next <= Math.min(words.length - 1, index + 3); next += 1) {
      if (words[next] === 'رقم' || words[next] === 'الرقم') continue
      const parsed = numericVideoToken(words[next])
      if (parsed !== null) return parsed
      break
    }
  }
  return null
}

export function extractServerVideoSequence(title = '') {
  return extractCatalogSequence(title)
}

export function extractYouTubePlayerResponse(html = '') {
  return jsonAfterMarker(String(html || ''), [
    'var ytInitialPlayerResponse =',
    'window["ytInitialPlayerResponse"] =',
    "window['ytInitialPlayerResponse'] =",
    'ytInitialPlayerResponse =',
  ])
}

export function parseYouTubeCaptionJson(payload) {
  const segments = []
  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const text = bounded((event?.segs || []).map((segment) => segment?.utf8 || '').join('').replace(/\n+/g, ' '), 1_000)
    const startMs = Number(event?.tStartMs)
    const durationMs = Number(event?.dDurationMs)
    if (!text || !Number.isFinite(startMs) || startMs < 0) continue
    const start = Math.max(0, Math.floor(startMs / 1000))
    const end = Math.max(start + 1, Math.ceil((startMs + (Number.isFinite(durationMs) ? durationMs : 1_000)) / 1000))
    const previous = segments.at(-1)
    if (previous && start - previous.end <= 1 && previous.text.length + text.length <= 220) {
      previous.text = bounded(`${previous.text} ${text}`, 400)
      previous.end = end
    } else {
      segments.push({ start, end, text })
    }
  }
  return segments
}

function parseCaptionXml(xml = '') {
  const decode = (value) => String(value || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  const segments = []
  for (const match of String(xml || '').matchAll(/<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
    const start = Math.max(0, Math.floor(Number(match[1]) || 0))
    const duration = Math.max(1, Math.ceil(Number(match[2]) || 1))
    const text = bounded(decode(match[3]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), 1_000)
    if (text) segments.push({ start, end: start + duration, text })
  }
  return segments
}

function captionTrack(player) {
  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  if (!Array.isArray(tracks) || !tracks.length) return null
  const sorted = [...tracks].sort((left, right) => {
    const leftArabic = /^ar(?:-|$)/i.test(String(left?.languageCode || '')) ? 1 : 0
    const rightArabic = /^ar(?:-|$)/i.test(String(right?.languageCode || '')) ? 1 : 0
    const leftManual = left?.kind === 'asr' ? 0 : 1
    const rightManual = right?.kind === 'asr' ? 0 : 1
    return rightArabic - leftArabic || rightManual - leftManual
  })
  return sorted[0] || null
}

async function fetchVideoTranscript(video, fetchImpl = globalThis.fetch) {
  const cached = transcriptCache.get(video.id)
  if (cached && cached.expiresAt > Date.now()) return cached.value
  if (cached?.promise) return cached.promise

  const promise = (async () => {
    try {
      const response = await fetchWithDeadline(fetchImpl, `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}&hl=ar`, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ar,en;q=0.7',
          'user-agent': 'Mozilla/5.0 (compatible; DrAlfailakawi-Encyclopedia/2.0)',
        },
      }, 15_000)
      const html = await responseText(response)
      const player = extractYouTubePlayerResponse(html)
      const track = captionTrack(player)
      if (!track?.baseUrl) {
        return {
          videoId: video.id,
          available: false,
          language: '',
          source: 'none',
          title: bounded(player?.videoDetails?.title || video.title, 500),
          description: bounded(player?.videoDetails?.shortDescription || video.description, 2_000),
          segments: [],
          text: '',
        }
      }

      const captionUrl = new URL(track.baseUrl)
      captionUrl.searchParams.set('fmt', 'json3')
      if (!/^ar(?:-|$)/i.test(String(track.languageCode || ''))) captionUrl.searchParams.set('tlang', 'ar')
      const captionResponse = await fetchWithDeadline(fetchImpl, captionUrl.href, {
        headers: {
          accept: 'application/json,text/xml;q=0.8,*/*;q=0.5',
          'accept-language': 'ar,en;q=0.7',
          'user-agent': 'Mozilla/5.0 (compatible; DrAlfailakawi-Encyclopedia/2.0)',
        },
      }, 12_000)
      if (!captionResponse?.ok) throw new Error(`YouTube captions HTTP ${captionResponse?.status || 0}`)
      const raw = await captionResponse.text()
      let segments = []
      try { segments = parseYouTubeCaptionJson(JSON.parse(raw)) } catch { segments = parseCaptionXml(raw) }
      const text = bounded(segments.map((segment) => segment.text).join(' '), 120_000)
      return {
        videoId: video.id,
        available: segments.length > 0,
        language: bounded(track.languageCode || plainText(track.name), 40),
        source: segments.length > 0 ? 'captions' : 'none',
        title: bounded(player?.videoDetails?.title || video.title, 500),
        description: bounded(player?.videoDetails?.shortDescription || video.description, 2_000),
        segments,
        text,
      }
    } catch {
      return {
        videoId: video.id,
        available: false,
        language: '',
        source: 'none',
        title: video.title,
        description: video.description,
        segments: [],
        text: '',
      }
    }
  })()

  transcriptCache.set(video.id, { promise, expiresAt: 0, value: null })
  const value = await promise
  transcriptCache.set(video.id, {
    promise: null,
    value,
    expiresAt: Date.now() + (value.available ? TRANSCRIPT_TTL : TRANSCRIPT_FAILURE_TTL),
  })
  return value
}

function phraseWeight(haystack, phrase, weight) {
  const normalized = normalizeEncyclopediaMomentText(phrase)
  if (!normalized || !haystack.includes(normalized)) return 0
  return weight + Math.min(7, normalized.split(' ').length * 2)
}

function windowMomentScore(text, topic, hints) {
  const normalized = normalizeEncyclopediaMomentText(text)
  const phrases = [topic, ...hints].filter(Boolean)
  let score = 0
  for (let index = 0; index < phrases.length; index += 1) score += phraseWeight(normalized, phrases[index], index === 0 ? 22 : 12)
  const queryTokens = new Set(momentTokens(phrases.join(' ')))
  const textTokens = new Set(momentTokens(normalized))
  let overlap = 0
  for (const token of queryTokens) if (textTokens.has(token)) overlap += token.length >= 6 ? 5 : 3
  return score + overlap
}

export function findEncyclopediaTranscriptMoment(segments, topic, hints = []) {
  if (!Array.isArray(segments) || !segments.length) return null
  let best = null
  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    let text = ''
    let end = segments[startIndex].end
    for (let endIndex = startIndex; endIndex < Math.min(segments.length, startIndex + 9); endIndex += 1) {
      const segment = segments[endIndex]
      if (segment.start - segments[startIndex].start > 48) break
      text = bounded(`${text} ${segment.text}`, 1_800)
      end = segment.end
      const score = windowMomentScore(text, topic, hints)
      if (!best || score > best.score || (score === best.score && segments[startIndex].start < best.start)) {
        best = { score, start: segments[startIndex].start, end, text: bounded(text, 320) }
      }
    }
  }
  if (!best || best.score < 8) return null
  const confidence = best.score >= 34 ? 'exact' : best.score >= 20 ? 'strong' : 'inferred'
  return {
    startSeconds: Math.max(0, best.start - TRANSCRIPT_SAFETY_SECONDS),
    endSeconds: best.end,
    excerpt: best.text,
    score: best.score,
    confidence,
    source: 'captions',
  }
}

function topicEntries() {
  const byKey = new Map()

  /* المصدر الأول هو فهرس الكتاب الموثق من PDF: خمسة أبواب وكل فصولها ومحاور
     الدراسات. عروض PowerPoint الأربعة تضيف تلميحات تدريسية، لكنها لا تحدد
     بنية الكتاب ولا تحذف الباب الخامس من فهرس الفيديو. */
  for (const door of Array.isArray(encyclopediaStructure?.doors) ? encyclopediaStructure.doors : []) {
    const doorId = bounded(door?.id, 40)
    const doorNumber = Number(door?.doorNumber) || Number(doorId.match(/\d+/)?.[0]) || 0
    const doorHints = Array.isArray(door?.hints) ? door.hints : []
    for (const unit of Array.isArray(door?.units) ? door.units : []) {
      const title = bounded(unit?.title, 180)
      const chapterNumber = Number(unit?.number) || 0
      if (!doorId || !doorNumber || !title) continue
      const key = `${doorId}:${normalizeEncyclopediaMomentText(title)}`
      byKey.set(key, {
        doorId,
        doorNumber,
        title,
        hints: [...new Set([...doorHints, ...(Array.isArray(unit?.keywords) ? unit.keywords : [])].map((value) => bounded(value, 120)).filter(Boolean))],
        chapterNumbers: chapterNumber ? [chapterNumber] : [],
        source: 'pdf',
      })
    }
  }

  /* خرائط الشرائح تثري الموضوعات الأربعة الأولى بنطاقات الفيديو المقترحة؛
     ندمجها مع سجل PDF عند التطابق، أو نضيفها كمداخل مساندة من دون تغيير
     عدد أبواب الكتاب. */
  for (const [doorId, door] of Object.entries(teachingMap || {})) {
    const doorNumber = Number(String(doorId).match(/\d+/)?.[0]) || 0
    for (const [title, topic] of Object.entries(door?.topics || {})) {
      const key = `${doorId}:${normalizeEncyclopediaMomentText(title)}`
      const previous = byKey.get(key)
      const hints = Array.isArray(topic?.videoHints) ? topic.videoHints : []
      const chapterNumbers = Array.isArray(topic?.chapterNumbers) ? topic.chapterNumbers.map(Number).filter(Boolean) : []
      byKey.set(key, {
        doorId,
        doorNumber,
        title,
        hints: [...new Set([...(previous?.hints || []), ...hints].map((value) => bounded(value, 120)).filter(Boolean))],
        chapterNumbers: [...new Set([...(previous?.chapterNumbers || []), ...chapterNumbers])],
        source: previous ? 'pdf+slides' : 'slides',
      })
    }
  }
  return [...byKey.values()]
}

const teachingTopics = topicEntries()

export function getEncyclopediaVideoTopicIndex() {
  return teachingTopics.map((topic) => ({
    ...topic,
    hints: [...topic.hints],
    chapterNumbers: [...topic.chapterNumbers],
  }))
}

function teachingTopicFor(title, doorNumber = 0) {
  const normalized = normalizeEncyclopediaMomentText(title)
  const exact = teachingTopics.find((topic) => (!doorNumber || topic.doorNumber === doorNumber) && normalizeEncyclopediaMomentText(topic.title) === normalized)
  if (exact) return exact
  let best = null
  for (const topic of teachingTopics) {
    if (doorNumber && topic.doorNumber !== doorNumber) continue
    const score = windowMomentScore(`${topic.title} ${topic.hints.join(' ')}`, title, [])
    if (!best || score > best.score) best = { topic, score }
  }
  return best && best.score >= 8 ? best.topic : null
}

function titleCandidateScore(video, topic, hints, doorNumber, chapterNumbers) {
  const sequence = extractServerVideoSequence(video.title)
  const haystack = normalizeEncyclopediaMomentText(`${video.title} ${video.description}`)
  let score = windowMomentScore(haystack, topic, hints)
  if (doorNumber && sequence.doorNumber === doorNumber) score += 12
  if (chapterNumbers.length && sequence.chapterNumber && chapterNumbers.includes(sequence.chapterNumber)) score += 10
  if (sequence.videoNumber) score += Math.max(0, 3 - Math.floor(sequence.videoNumber / 40))
  return { score, sequence }
}

function videoCandidates(catalog, topic, hints, doorNumber, chapterNumbers) {
  const ranked = catalog.videos.map((video) => {
    const scored = titleCandidateScore(video, topic, hints, doorNumber, chapterNumbers)
    return { video, ...scored }
  })
  const explicitDoor = ranked.filter((item) => item.sequence.doorNumber === doorNumber)
  let pool = doorNumber && explicitDoor.length ? explicitDoor : ranked
  if (chapterNumbers.length) {
    const chapterPool = pool.filter((item) => item.sequence.chapterNumber && chapterNumbers.includes(item.sequence.chapterNumber))
    if (chapterPool.length) pool = chapterPool
  }
  return pool.sort((left, right) => right.score - left.score || left.video.position - right.video.position)
}

function momentResult(video, moment, topic, sequence, fallbackScore = 0) {
  const startSeconds = moment?.startSeconds || 0
  return {
    video,
    videoId: video.id,
    topic,
    startSeconds,
    endSeconds: moment?.endSeconds || 0,
    excerpt: moment?.excerpt || '',
    confidence: moment?.confidence || (fallbackScore > 10 ? 'strong' : 'inferred'),
    source: moment?.source || 'sequence',
    score: moment?.score || fallbackScore,
    sequence,
    embedUrl: `${video.embedUrl}${video.embedUrl.includes('?') ? '&' : '?'}start=${Math.max(0, startSeconds)}`,
  }
}

export function getEncyclopediaTranscriptProgress(videos = []) {
  const ids = Array.isArray(videos) && videos.length
    ? videos.map((video) => video?.id).filter(Boolean)
    : transcriptWarmup.videoIds
  const completed = ids.reduce((total, id) => total + (transcriptCache.get(id)?.value ? 1 : 0), 0)
  const available = ids.reduce((total, id) => total + (transcriptCache.get(id)?.value?.available ? 1 : 0), 0)
  return {
    running: transcriptWarmup.running,
    total: ids.length || transcriptWarmup.total,
    completed: ids.length ? completed : transcriptWarmup.completed,
    available: ids.length ? available : transcriptWarmup.available,
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

/*
 * الفهرسة الخلفية متدرجة عمداً: نقرأ دفعة صغيرة في كل زيارة بدلاً من إطلاق
 * مئات الطلبات في لحظة واحدة. البحث عن موضوع يظل يفحص أفضل المرشحين فوراً،
 * بينما تتسع الذاكرة المنطوقة بهدوء مع الاستخدام من دون إبطاء الصفحة.
 */
export function scheduleEncyclopediaTranscriptWarmup(videos, { fetchImpl = globalThis.fetch, batchSize = TRANSCRIPT_WARMUP_BATCH } = {}) {
  if (transcriptWarmup.running || !Array.isArray(videos) || !videos.length || typeof fetchImpl !== 'function') return transcriptWarmup.promise
  const videoIds = videos.map((video) => video?.id).filter(Boolean)
  const pending = videos
    .filter((video) => !transcriptCache.get(video.id)?.value && !transcriptCache.get(video.id)?.promise)
    .slice(0, Math.max(1, Math.min(TRANSCRIPT_WARMUP_BATCH, Number(batchSize) || TRANSCRIPT_WARMUP_BATCH)))
  const progress = getEncyclopediaTranscriptProgress(videos)
  transcriptWarmup = {
    running: pending.length > 0,
    total: videos.length,
    completed: progress.completed,
    available: progress.available,
    videoIds,
    promise: null,
  }
  if (!pending.length) return null

  transcriptWarmup.promise = (async () => {
    for (let index = 0; index < pending.length; index += TRANSCRIPT_WARMUP_CONCURRENCY) {
      const batch = pending.slice(index, index + TRANSCRIPT_WARMUP_CONCURRENCY)
      await Promise.all(batch.map((video) => fetchVideoTranscript(video, fetchImpl)))
      const current = getEncyclopediaTranscriptProgress(videos)
      transcriptWarmup.completed = current.completed
      transcriptWarmup.available = current.available
      await delay(140)
    }
    transcriptWarmup.running = false
    return getEncyclopediaTranscriptProgress(videos)
  })().catch(() => {
    transcriptWarmup.running = false
    return getEncyclopediaTranscriptProgress(videos)
  })
  return transcriptWarmup.promise
}

export async function loadEncyclopediaVideoMoment({ topic, doorNumber = 0, videoId = '', hints = [], fetchImpl = globalThis.fetch } = {}) {
  const cleanTopic = bounded(topic, 180)
  const normalizedVideoId = bounded(videoId, 24)
  if (!cleanTopic && !normalizedVideoId) throw new Error('A topic or video id is required')
  const resolvedTopic = teachingTopicFor(cleanTopic, Number(doorNumber) || 0)
  const resolvedDoor = Number(doorNumber) || resolvedTopic?.doorNumber || 0
  const resolvedHints = [...new Set([...(resolvedTopic?.hints || []), ...(Array.isArray(hints) ? hints : [])].map((value) => bounded(value, 120)).filter(Boolean))]
  const chapterNumbers = resolvedTopic?.chapterNumbers || []
  const cacheKey = normalizeEncyclopediaMomentText([cleanTopic, resolvedDoor, normalizedVideoId, ...resolvedHints].join('|'))
  const cached = momentCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const catalog = await loadEncyclopediaVideoCatalog({ fetchImpl })
  scheduleEncyclopediaTranscriptWarmup(catalog.videos, { fetchImpl })
  let candidates = videoCandidates(catalog, cleanTopic, resolvedHints, resolvedDoor, chapterNumbers)
  if (normalizedVideoId) candidates = candidates.filter((item) => item.video.id === normalizedVideoId)
  candidates = candidates.slice(0, MAX_TRANSCRIPT_CANDIDATES)
  if (!candidates.length) return null

  let best = null
  for (let index = 0; index < candidates.length; index += 4) {
    const batch = candidates.slice(index, index + 4)
    const records = await Promise.all(batch.map(({ video }) => fetchVideoTranscript(video, fetchImpl)))
    records.forEach((record, offset) => {
      const candidate = batch[offset]
      const moment = record.available ? findEncyclopediaTranscriptMoment(record.segments, cleanTopic, resolvedHints) : null
      const combinedScore = (moment?.score || 0) + candidate.score
      if (moment && (!best || combinedScore > best.combinedScore)) {
        best = {
          combinedScore,
          value: momentResult(candidate.video, moment, cleanTopic, candidate.sequence, candidate.score),
        }
      }
    })
    if (best?.value?.confidence === 'exact' && best.combinedScore >= 48) break
  }

  const fallback = candidates[0]
  const value = best?.value || momentResult(fallback.video, null, cleanTopic, fallback.sequence, fallback.score)
  momentCache.set(cacheKey, { value, expiresAt: Date.now() + (best?.value ? MATCH_TTL : TRANSCRIPT_FAILURE_TTL) })
  return value
}

function topicQueryScore(query, topic) {
  return windowMomentScore(`${topic.title} ${topic.hints.join(' ')}`, query, [])
}

export async function searchEncyclopediaVideoMoments({ query, doorNumber = 0, limit = 6, fetchImpl = globalThis.fetch } = {}) {
  const cleanQuery = bounded(query, 180)
  if (cleanQuery.length < 2) return { query: cleanQuery, moments: [], progress: getEncyclopediaTranscriptProgress() }
  const catalog = await loadEncyclopediaVideoCatalog({ fetchImpl })
  scheduleEncyclopediaTranscriptWarmup(catalog.videos, { fetchImpl })
  const requestedDoor = Number(doorNumber) || 0

  const relevantTopics = teachingTopics
    .filter((topic) => !requestedDoor || topic.doorNumber === requestedDoor)
    .map((topic) => ({ topic, score: topicQueryScore(cleanQuery, topic) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)

  const candidateMap = new Map()
  const addCandidates = (items) => {
    for (const item of items) {
      const previous = candidateMap.get(item.video.id)
      if (!previous || item.score > previous.score) candidateMap.set(item.video.id, item)
    }
  }

  addCandidates(videoCandidates(catalog, cleanQuery, [], requestedDoor, []).slice(0, 16))
  for (const { topic } of relevantTopics) {
    addCandidates(videoCandidates(catalog, cleanQuery, topic.hints, topic.doorNumber, topic.chapterNumbers).slice(0, 14))
  }

  /* كل ترجمة سبق فهرستها تدخل البحث حتى إن كان عنوان الفيديو رقمياً فقط. */
  for (const video of catalog.videos) {
    const record = transcriptCache.get(video.id)?.value
    if (!record?.available) continue
    const moment = findEncyclopediaTranscriptMoment(record.segments, cleanQuery, [])
    if (moment) candidateMap.set(video.id, { video, score: moment.score, sequence: extractServerVideoSequence(video.title), prefetchedMoment: moment })
  }

  const candidates = [...candidateMap.values()]
    .sort((left, right) => right.score - left.score || left.video.position - right.video.position)
    .slice(0, Math.max(MAX_SEARCH_FETCHES, Number(limit) * 3))

  const results = []
  for (let index = 0; index < candidates.length && index < MAX_SEARCH_FETCHES; index += 4) {
    const batch = candidates.slice(index, index + 4)
    const records = await Promise.all(batch.map(({ video, prefetchedMoment }) => prefetchedMoment ? Promise.resolve(null) : fetchVideoTranscript(video, fetchImpl)))
    batch.forEach((candidate, offset) => {
      const record = records[offset]
      const moment = candidate.prefetchedMoment || (record?.available ? findEncyclopediaTranscriptMoment(record.segments, cleanQuery, []) : null)
      if (moment) results.push(momentResult(candidate.video, moment, cleanQuery, candidate.sequence, candidate.score))
      else if (candidate.score >= 12) results.push(momentResult(candidate.video, null, cleanQuery, candidate.sequence, candidate.score))
    })
  }

  const unique = new Map()
  for (const result of results.sort((left, right) => right.score - left.score || left.video.position - right.video.position)) {
    const key = `${result.videoId}:${result.startSeconds}`
    if (!unique.has(key)) unique.set(key, result)
  }
  return {
    query: cleanQuery,
    moments: [...unique.values()].slice(0, Math.max(1, Math.min(10, Number(limit) || 6))),
    progress: getEncyclopediaTranscriptProgress(catalog.videos),
  }
}

export function resetEncyclopediaTranscriptCache() {
  transcriptCache.clear()
  momentCache.clear()
  transcriptWarmup = { running: false, total: 0, completed: 0, available: 0, videoIds: [], promise: null }
}
