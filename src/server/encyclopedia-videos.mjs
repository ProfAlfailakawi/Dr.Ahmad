import { readFileSync } from 'node:fs'
import {
  buildSearchExpansionGroups,
  expandSearchQuery,
  normalizeArabicSearchText,
  reasonLabel,
} from '../lib/encyclopedia-transcript-quality.mjs'

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
 * الفهرس المنطوق الثابت للموسوعة
 *
 * التفريغ يُنتج محلياً بواسطة Buzz ثم يُحفظ في JSON داخل الصورة. لا يوجد
 * تحميل لترجمة YouTube أو إرسال للصوت أثناء زيارة الموقع. ولا يُنسب توقيت
 * دقيق إلا إلى مقطع محفوظ فعلياً بمصدر ثابت معتمد.
 * ----------------------------------------------------------------------- */

const STATIC_TRANSCRIPT_SOURCES = new Set(['buzz', 'youtube-captions', 'manual-reviewed'])
const TRANSCRIPT_SAFETY_SECONDS = 0
const MAX_MOMENTS_PER_VIDEO = 2
const DISTINCT_MOMENT_GAP_SECONDS = 24

let teachingMap = {}
let bundledTranscriptIndex = { version: 3, generatedAt: '', catalogCount: 0, records: {} }
let staticCatalog = { videos: [] }
let searchSynonyms = { groups: [] }
let domainGlossary = []
let transcriptCorrections = {}
try { teachingMap = JSON.parse(readFileSync(new URL('../data/encyclopedia-teaching-map.json', import.meta.url), 'utf8')) } catch { teachingMap = {} }
try { bundledTranscriptIndex = JSON.parse(readFileSync(new URL('../data/encyclopedia-video-transcripts.json', import.meta.url), 'utf8')) } catch { bundledTranscriptIndex = { version: 3, records: {} } }
try { staticCatalog = JSON.parse(readFileSync(new URL('../data/encyclopedia-videos-fallback.json', import.meta.url), 'utf8')) } catch { staticCatalog = { videos: [] } }
try { searchSynonyms = JSON.parse(readFileSync(new URL('../data/encyclopedia-search-synonyms.json', import.meta.url), 'utf8')) } catch { searchSynonyms = { groups: [] } }
try { domainGlossary = JSON.parse(readFileSync(new URL('../data/dr-ahmad-domain-glossary.json', import.meta.url), 'utf8')) } catch { domainGlossary = [] }
try { transcriptCorrections = JSON.parse(readFileSync(new URL('../data/encyclopedia-transcript-corrections.json', import.meta.url), 'utf8')) } catch { transcriptCorrections = {} }
const searchExpansionGroups = buildSearchExpansionGroups({ synonyms: searchSynonyms, glossary: domainGlossary, corrections: transcriptCorrections })

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const MOMENT_STOP_WORDS = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون ثم او أم و لا ما هو هي باب فصل فيديو مقطع شرح الموسوعه التعليم تكنولوجيا'.split(' '))

export function normalizeEncyclopediaMomentText(value = '') {
  return normalizeArabicSearchText(value)
}

function momentTokens(value = '') {
  return normalizeEncyclopediaMomentText(value).split(' ').filter((token) => token.length > 2 && !MOMENT_STOP_WORDS.has(token))
}

function expandedQueries(value = '') {
  return expandSearchQuery(value, searchExpansionGroups)
}

function normalizeStoredSegments(segments = []) {
  const output = []
  for (const segment of Array.isArray(segments) ? segments : []) {
    const start = Number(segment?.start)
    const end = Number(segment?.end)
    const text = bounded(segment?.displayText || segment?.text, 2_000)
    const originalText = bounded(segment?.originalText || segment?.rawText || segment?.text, 2_000)
    const searchText = bounded(segment?.searchText || normalizeEncyclopediaMomentText(text), 3_000)
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !text) continue
    output.push({
      start, end, text, displayText: text, originalText, searchText,
      indexable: segment?.indexable !== false,
      correctionIds: Array.isArray(segment?.correctionIds) ? segment.correctionIds.slice(0, 80).map((item) => bounded(item, 120)).filter(Boolean) : [],
    })
  }
  return output.sort((left, right) => left.start - right.start || left.end - right.end)
}

function transcriptRecords() {
  if (bundledTranscriptIndex?.records && typeof bundledTranscriptIndex.records === 'object') return bundledTranscriptIndex.records
  const legacy = bundledTranscriptIndex?.videos
  if (Array.isArray(legacy)) return Object.fromEntries(legacy.map((record) => [record.videoId || record.id, record]))
  return legacy && typeof legacy === 'object' ? legacy : {}
}

function normalizeStoredTranscript(value = {}, video = {}) {
  const videoId = bounded(value.videoId || value.id || video.id, 24)
  if (!/^[\w-]{6,20}$/.test(videoId)) return null
  const segments = normalizeStoredSegments(value.segments)
  const source = STATIC_TRANSCRIPT_SOURCES.has(String(value.source || '')) ? String(value.source) : null
  const noSpeech = value.status === 'no-speech'
  const available = Boolean(!noSpeech && value.available && source && segments.length)
  const contentType = value.contentType === 'encyclopedia-introduction' ? 'encyclopedia-introduction' : 'encyclopedia-chapter-video'
  return {
    videoId,
    available,
    checked: Boolean(value.checked || available || noSpeech),
    status: noSpeech ? 'no-speech' : available ? 'transcribed' : 'metadata-only',
    contentType,
    language: bounded(value.language || 'ar', 40),
    source: available ? source : null,
    title: bounded(value.title || video.title, 500),
    description: bounded(value.description || video.description, 4_000),
    doorId: contentType === 'encyclopedia-introduction' ? null : value.doorId || null,
    doorNumber: contentType === 'encyclopedia-introduction' ? null : Number(value.doorNumber || video.doorNumber) || null,
    chapterNumber: contentType === 'encyclopedia-introduction' ? null : Number(value.chapterNumber || video.chapterNumber) || null,
    chapterTitle: contentType === 'encyclopedia-introduction' ? null : bounded(value.chapterTitle, 500) || null,
    sequenceLabel: bounded(value.sequenceLabel, 300),
    mappingSource: bounded(value.mappingSource || video.mappingSource, 100),
    mappingConfidence: bounded(value.mappingConfidence || video.mappingConfidence, 100),
    mappingReviewStatus: bounded(value.mappingReviewStatus || (contentType === 'encyclopedia-introduction' ? 'reviewed' : 'needs-review'), 100),
    reviewStatus: bounded(value.reviewStatus || 'auto-transcribed', 100),
    transcriptReviewStatus: bounded(value.transcriptReviewStatus || value.reviewStatus || 'auto-transcribed', 100),
    segments,
    text: bounded(value.displayText || value.text || segments.map((segment) => segment.text).join(' '), 500_000),
    searchText: bounded(value.searchText || segments.map((segment) => segment.searchText).join(' '), 500_000),
    segmentCount: segments.length,
    indexableSegmentCount: segments.filter((segment) => segment.indexable !== false).length,
    sourceFile: bounded(value.sourceFile, 500),
    indexedAt: bounded(value.indexedAt, 80),
    quality: value.quality && typeof value.quality === 'object' ? value.quality : null,
  }
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

/* قارئ توافق لاختبارات/ملفات أرشيفية فقط؛ لا يُستخدم لجلب الترجمة وقت الزيارة. */
export function parseYouTubeCaptionJson(payload) {
  const output = []
  for (const event of Array.isArray(payload?.events) ? payload.events : []) {
    const startMs = Number(event?.tStartMs)
    const durationMs = Number(event?.dDurationMs)
    const text = bounded((event?.segs || []).map((segment) => segment?.utf8 || '').join('').replace(/\s+/g, ' '), 2_000)
    if (!Number.isFinite(startMs) || startMs < 0 || !text) continue
    const start = startMs / 1000
    const end = (startMs + (Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1_000)) / 1000
    const previous = output.at(-1)
    if (previous && previous.text === text && start <= previous.end + 0.05) previous.end = Math.max(previous.end, end)
    else output.push({ start, end, text })
  }
  return output
}

function transcriptFor(video) {
  const raw = transcriptRecords()[video?.id]
  return normalizeStoredTranscript(raw || {}, video)
}

export async function loadEncyclopediaVideoTranscript(video) {
  return transcriptFor(video) || normalizeStoredTranscript({ videoId: video?.id }, video)
}

function phraseMatch(text, query) {
  const haystack = normalizeEncyclopediaMomentText(text)
  const expansions = expandedQueries(query)
  const queryTokens = new Set(momentTokens(query))
  if (!haystack || (!expansions.length && !queryTokens.size)) return { score: 0, reason: 'token-overlap', matchedTerms: [] }
  let score = 0
  let reason = 'token-overlap'
  const matchedTerms = new Set()
  const reasonPriority = { 'exact-phrase': 6, 'proper-name': 5, glossary: 4, synonym: 3, correction: 2, 'canonical-term': 2, 'token-overlap': 1 }
  for (const entry of expansions) {
    const phrase = entry.term
    if (!phrase) continue
    let phraseScore = 0
    if (haystack === phrase) phraseScore = 88
    else if (haystack.includes(phrase)) phraseScore = 38 + Math.min(18, phrase.split(' ').length * 3)
    if (!phraseScore) continue
    score = Math.max(score, phraseScore)
    const candidateReason = entry.kind === 'direct' ? 'exact-phrase' : entry.kind === 'proper-name' ? 'proper-name' : entry.kind || 'canonical-term'
    if ((reasonPriority[candidateReason] || 0) > (reasonPriority[reason] || 0)) reason = candidateReason
    matchedTerms.add(entry.canonical || phrase)
  }
  const haystackTokens = new Set(momentTokens(haystack))
  let matches = 0
  for (const token of queryTokens) if (haystackTokens.has(token)) { matches += 1; matchedTerms.add(token) }
  const tokenRatio = queryTokens.size ? matches / queryTokens.size : 0
  // Token overlap is based only on the user's direct wording. Aliases may create
  // an exact synonym/glossary match above, but their generic words (such as
  // «موقع») must never manufacture unrelated results.
  if ((queryTokens.size === 1 && matches === 1) || (queryTokens.size > 1 && matches >= 2 && tokenRatio >= 0.67)) {
    score += matches * 7
    if (matches === queryTokens.size) score += 12
  }
  return { score, reason, matchedTerms: [...matchedTerms].slice(0, 12) }
}

function excerptAround(segments, index, radius = 1) {
  return segments.slice(Math.max(0, index - radius), Math.min(segments.length, index + radius + 1)).map((segment) => segment.text).join(' ').trim()
}

function clipExcerptAroundMatch(value, matchedTerms = [], maxLength = 420) {
  const text = bounded(value, 4_000)
  if (text.length <= maxLength) return text
  const candidates = [...new Set((Array.isArray(matchedTerms) ? matchedTerms : [])
    .map((term) => bounded(term, 180))
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length)
  let matchIndex = -1
  for (const term of candidates) {
    const index = text.indexOf(term)
    if (index >= 0) { matchIndex = index; break }
  }
  if (matchIndex < 0) return `${text.slice(0, maxLength - 1).trimEnd()}…`
  const before = Math.floor(maxLength * 0.36)
  let start = Math.max(0, matchIndex - before)
  let end = Math.min(text.length, start + maxLength)
  start = Math.max(0, end - maxLength)
  if (start > 0) {
    const nextSpace = text.indexOf(' ', start)
    if (nextSpace > start && nextSpace < matchIndex) start = nextSpace + 1
  }
  if (end < text.length) {
    const previousSpace = text.lastIndexOf(' ', end)
    if (previousSpace > matchIndex) end = previousSpace
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function findEncyclopediaTranscriptMoments(segments, topic, hints = [], limit = 6) {
  const queries = [topic, ...(Array.isArray(hints) ? hints : [])].map((value) => bounded(value, 180)).filter(Boolean)
  if (!queries.length) return []
  const normalized = normalizeStoredSegments(segments).filter((segment) => segment.indexable !== false)
  return normalized.map((segment, index) => {
    let best = { score: 0, reason: 'token-overlap', matchedTerms: [] }
    for (const query of queries) {
      const candidate = phraseMatch(`${segment.searchText} ${segment.text}`, query)
      if (candidate.score > best.score) best = candidate
    }
    // A neighbouring segment may enrich the excerpt, but it must never create a
    // second, false timestamp for words that were spoken only in the neighbour.
    const context = excerptAround(normalized, index)
    return {
      startSeconds: Math.max(0, segment.start - TRANSCRIPT_SAFETY_SECONDS),
      endSeconds: segment.end,
      excerpt: clipExcerptAroundMatch(context, best.matchedTerms),
      confidence: best.score >= 55 ? 'exact' : 'strong',
      source: 'transcript',
      score: best.score,
      matchReason: best.reason,
      matchReasonLabel: reasonLabel(best.reason),
      matchedTerms: best.matchedTerms,
    }
  }).filter((moment) => moment.score >= 13)
    .sort((left, right) => right.score - left.score || left.startSeconds - right.startSeconds)
    .filter((moment, index, all) => all.slice(0, index).every((previous) =>
      Math.abs(previous.startSeconds - moment.startSeconds) >= DISTINCT_MOMENT_GAP_SECONDS
      && normalizeEncyclopediaMomentText(previous.excerpt) !== normalizeEncyclopediaMomentText(moment.excerpt)
    ))
    .slice(0, Math.max(1, limit))
}

export function findEncyclopediaTranscriptMoment(segments, topic, hints = []) {
  return findEncyclopediaTranscriptMoments(segments, topic, hints, 1)[0] || null
}

function topicEntries() {
  const byKey = new Map()
  for (const door of catalogStructure?.doors || []) {
    for (const unit of door.units || []) {
      const key = `${door.id}:${normalizeEncyclopediaMomentText(unit.title)}`
      byKey.set(key, {
        doorId: door.id,
        doorNumber: Number(door.doorNumber) || 0,
        title: unit.title,
        hints: [...new Set([...(door.topics || []), ...(door.hints || []), ...(unit.keywords || [])].map((value) => bounded(value, 120)).filter(Boolean))],
        chapterNumbers: [Number(unit.number)].filter(Boolean),
        source: 'pdf',
      })
    }
  }
  for (const [doorId, door] of Object.entries(teachingMap || {})) {
    const doorNumber = Number(String(doorId).match(/\d+/)?.[0]) || 0
    for (const [title, topic] of Object.entries(door?.topics || {})) {
      const key = `${doorId}:${normalizeEncyclopediaMomentText(title)}`
      const previous = byKey.get(key)
      byKey.set(key, {
        doorId,
        doorNumber,
        title,
        hints: [...new Set([...(previous?.hints || []), ...(Array.isArray(topic?.videoHints) ? topic.videoHints : [])].map((value) => bounded(value, 120)).filter(Boolean))],
        chapterNumbers: [...new Set([...(previous?.chapterNumbers || []), ...(Array.isArray(topic?.chapterNumbers) ? topic.chapterNumbers.map(Number).filter(Boolean) : [])])],
        source: previous ? 'pdf+slides' : 'slides',
      })
    }
  }
  return [...byKey.values()]
}

const teachingTopics = topicEntries()

export function getEncyclopediaVideoTopicIndex() {
  return teachingTopics.map((topic) => ({ ...topic, hints: [...topic.hints], chapterNumbers: [...topic.chapterNumbers] }))
}

function fallbackCatalogVideos() {
  return Array.isArray(staticCatalog?.videos) ? staticCatalog.videos : []
}

function withVideoDefaults(video) {
  return {
    ...video,
    url: video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
    embedUrl: video.embedUrl || `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`,
  }
}

function sequenceFor(video, record) {
  const extracted = extractServerVideoSequence(video?.title || '')
  return {
    doorNumber: Number(record?.doorNumber || video?.doorNumber || extracted.doorNumber) || null,
    chapterNumber: Number(record?.chapterNumber || video?.chapterNumber || extracted.chapterNumber) || null,
    videoNumber: Number(video?.videoNumber || extracted.videoNumber) || null,
  }
}

function embedAt(video, startSeconds, exact) {
  const base = video.embedUrl || `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`
  if (!exact || !(startSeconds > 0)) return base
  return `${base}${base.includes('?') ? '&' : '?'}start=${Math.max(0, Math.floor(startSeconds))}`
}

function momentResult(videoInput, moment, topic, transcript, fallbackScore = 0) {
  const video = withVideoDefaults(videoInput)
  const exact = Boolean(moment && transcript?.available && STATIC_TRANSCRIPT_SOURCES.has(transcript.source) && moment.excerpt)
  const startSeconds = exact ? Number(moment.startSeconds) || 0 : 0
  const sequence = sequenceFor(video, transcript)
  return {
    video,
    videoId: video.id,
    topic,
    startSeconds,
    endSeconds: exact ? Number(moment.endSeconds) || 0 : 0,
    excerpt: exact ? moment.excerpt : '',
    confidence: exact ? moment.confidence : fallbackScore >= 24 ? 'strong' : 'inferred',
    source: exact ? transcript.source : 'sequence',
    hasExactTiming: exact,
    score: exact ? moment.score : fallbackScore,
    matchReason: exact ? moment.matchReason : 'metadata-fallback',
    matchReasonLabel: exact ? moment.matchReasonLabel : reasonLabel('metadata-fallback'),
    matchedTerms: exact ? moment.matchedTerms : [],
    contentType: transcript?.contentType || 'encyclopedia-chapter-video',
    sequence,
    doorId: transcript?.doorId || null,
    doorNumber: sequence.doorNumber,
    chapterNumber: sequence.chapterNumber,
    chapterTitle: transcript?.chapterTitle || null,
    mappingSource: transcript?.mappingSource || video.mappingSource || '',
    mappingConfidence: transcript?.mappingConfidence || video.mappingConfidence || '',
    mappingReviewStatus: transcript?.mappingReviewStatus || 'needs-review',
    reviewStatus: transcript?.reviewStatus || 'auto-transcribed',
    transcriptReviewStatus: transcript?.transcriptReviewStatus || 'auto-transcribed',
    embedUrl: embedAt(video, startSeconds, exact),
  }
}

function candidateScore(video, query, doorNumber = 0) {
  const record = transcriptFor(video)
  let score = phraseMatch(`${video.title} ${video.description}`, query).score
  const sequence = sequenceFor(video, record)
  if (doorNumber && sequence.doorNumber === doorNumber) score += 20
  return { video, record, sequence, score }
}

export function getEncyclopediaTranscriptProgress(videos = []) {
  const sourceVideos = Array.isArray(videos) && videos.length ? videos : fallbackCatalogVideos()
  const records = sourceVideos.map((video) => transcriptFor(video)).filter(Boolean)
  const available = records.filter((record) => record.available).length
  const noSpeech = records.filter((record) => record.status === 'no-speech').length
  const processed = available + noSpeech
  const introductions = records.filter((record) => record.contentType === 'encyclopedia-introduction').length
  const needsReview = records.filter((record) => record.mappingReviewStatus === 'needs-review' || (!record.available && record.status !== 'no-speech')).length
  const autoCorrected = records.filter((record) => record.transcriptReviewStatus === 'auto-corrected').length
  const autoTranscribed = records.filter((record) => record.transcriptReviewStatus === 'auto-transcribed').length
  const boilerplateOnly = records.filter((record) => record.quality?.status === 'boilerplate-only').length
  const sources = { buzz: 0, 'youtube-captions': 0, 'manual-reviewed': 0 }
  for (const record of records) if (record.available && Object.hasOwn(sources, record.source)) sources[record.source] += 1
  const total = sourceVideos.length || Number(bundledTranscriptIndex?.catalogCount) || records.length
  return {
    running: false,
    total,
    catalogued: total,
    completed: processed,
    processed,
    available,
    transcribed: available,
    noSpeech,
    introductions,
    needsReview,
    missing: Math.max(0, total - processed),
    autoCorrected,
    autoTranscribed,
    boilerplateOnly,
    processingPercent: total ? Number(((processed / total) * 100).toFixed(2)) : 0,
    transcriptionPercent: total ? Number(((available / total) * 100).toFixed(2)) : 0,
    sources,
  }
}

/* ثابت: لا توجد عملية warm-up أو طلبات شبكة للتفريغ. */
export function scheduleEncyclopediaTranscriptWarmup(videos) {
  return Promise.resolve(getEncyclopediaTranscriptProgress(videos))
}

export function getEncyclopediaTranscriptSnapshot(videos = []) {
  const sourceVideos = Array.isArray(videos) && videos.length ? videos : fallbackCatalogVideos()
  const records = Object.fromEntries(sourceVideos.map((video) => [video.id, transcriptFor(video)]))
  return {
    version: Math.max(3, Number(bundledTranscriptIndex?.version) || 0),
    generatedAt: bundledTranscriptIndex?.generatedAt || '',
    catalogCount: sourceVideos.length,
    progress: getEncyclopediaTranscriptProgress(sourceVideos),
    records,
  }
}

export async function loadEncyclopediaVideoMoment({ topic, doorNumber = 0, videoId = '', hints = [] } = {}) {
  const query = bounded(topic, 180)
  const videos = fallbackCatalogVideos()
  const candidates = videos
    .filter((video) => !videoId || video.id === videoId)
    .map((video) => candidateScore(video, query || video.title, Number(doorNumber) || 0))
    .filter((candidate) => !doorNumber || candidate.sequence.doorNumber === Number(doorNumber))
  let best = null
  for (const candidate of candidates) {
    if (candidate.record?.available) {
      const moment = findEncyclopediaTranscriptMoment(candidate.record.segments, query, hints)
      if (moment) {
        const result = momentResult(candidate.video, moment, query, candidate.record, candidate.score)
        if (!best || result.score > best.score) best = result
      }
    }
  }
  if (best) return best
  const availableFallbacks = candidates.filter((candidate) => candidate.record?.available)
  const spokenFallbacks = candidates.filter((candidate) => candidate.record?.status !== 'no-speech')
  const fallbackPool = availableFallbacks.length ? availableFallbacks : spokenFallbacks.length ? spokenFallbacks : candidates
  const fallback = fallbackPool.sort((left, right) => right.score - left.score || Number(left.video.position) - Number(right.video.position))[0]
  return fallback ? momentResult(fallback.video, null, query, fallback.record, fallback.score) : null
}

export async function searchEncyclopediaVideoMoments({ query, doorNumber = 0, limit = 6 } = {}) {
  const cleanQuery = bounded(query, 180)
  const videos = fallbackCatalogVideos()
  const results = []
  for (const video of videos) {
    const candidate = candidateScore(video, cleanQuery, Number(doorNumber) || 0)
    if (doorNumber && candidate.sequence.doorNumber !== Number(doorNumber)) continue
    if (candidate.record?.available) {
      const moments = findEncyclopediaTranscriptMoments(candidate.record.segments, cleanQuery, [], MAX_MOMENTS_PER_VIDEO)
      for (const moment of moments) results.push(momentResult(video, moment, cleanQuery, candidate.record, candidate.score))
    } else if (candidate.score >= 8) {
      results.push(momentResult(video, null, cleanQuery, candidate.record, candidate.score))
    }
  }
  if (!results.length) {
    const closestCandidates = videos
      .map((video) => candidateScore(video, cleanQuery, Number(doorNumber) || 0))
      .filter((candidate) => !doorNumber || candidate.sequence.doorNumber === Number(doorNumber))
    const availableClosest = closestCandidates.filter((candidate) => candidate.record?.available)
    const spokenClosest = closestCandidates.filter((candidate) => candidate.record?.status !== 'no-speech')
    const closestPool = availableClosest.length ? availableClosest : spokenClosest.length ? spokenClosest : closestCandidates
    const closest = closestPool.sort((left, right) => right.score - left.score || Number(left.video.position) - Number(right.video.position))[0]
    if (closest) results.push(momentResult(closest.video, null, cleanQuery, closest.record, closest.score))
  }
  results.sort((left, right) => Number(right.hasExactTiming) - Number(left.hasExactTiming) || right.score - left.score || Number(left.video.position) - Number(right.video.position))
  const deduped = []
  const seen = new Set()
  for (const result of results) {
    const key = result.hasExactTiming ? `${result.videoId}:${Math.round(result.startSeconds)}` : `${result.videoId}:fallback`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(result)
    if (deduped.length >= Math.max(1, Math.min(10, Number(limit) || 6))) break
  }
  return { query: cleanQuery, moments: deduped, progress: getEncyclopediaTranscriptProgress(videos) }
}

export function resetEncyclopediaTranscriptCache() {
  try { bundledTranscriptIndex = JSON.parse(readFileSync(new URL('../data/encyclopedia-video-transcripts.json', import.meta.url), 'utf8')) } catch { bundledTranscriptIndex = { version: 3, records: {} } }
}
