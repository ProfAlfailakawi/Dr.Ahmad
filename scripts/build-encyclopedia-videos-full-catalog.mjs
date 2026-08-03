import { writeFileSync, readFileSync } from 'node:fs'
import { extractYouTubeBootstrap } from '../src/server/encyclopedia-videos.mjs'

const CATALOG_ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const CATALOG_PERSIAN_DIGITS = '۰۱۲3456789'
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

function normalizeText(value = '') {
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
  const normalized = normalizeText(value).replace(/[^\p{L}\p{N}]/gu, '')
  if (/^\d{1,3}$/.test(normalized)) return Number(normalized)
  return CATALOG_NUMBER_WORDS[normalized] || null
}

function catalogNumberAfterLabel(value, labels) {
  const words = normalizeText(value).replace(/[._/|:-]/g, ' ').split(' ').filter(Boolean)
  const labelSet = new Set(labels.map(normalizeText))
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
  const normalized = normalizeText(value)
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

function parseLockup(vm, position) {
  if (!vm || vm.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null
  const id = vm.contentId
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null
  const meta = vm.metadata?.lockupMetadataViewModel
  const title = meta?.title?.content || ''
  const sources = vm.contentImage?.thumbnailViewModel?.image?.sources || []
  const thumbnail = sources.at(-1)?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  const overlay = vm.contentImage?.thumbnailViewModel?.overlays || []
  let durationText = ''
  for (const ov of overlay) {
    const badgeText = ov?.thumbnailBadgeViewModel?.text || ''
    if (/^\d+:\d+/.test(badgeText)) durationText = badgeText
  }
  return {
    id,
    title: title || 'موسوعة تكنولوجيا التعليم',
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    thumbnail,
    durationText,
    durationSeconds: 0,
    publishedText: '',
    viewCountText: '',
    description: '',
    position,
  }
}

function findLockups(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results
  if (obj.lockupViewModel) results.push(obj.lockupViewModel)
  for (const val of Object.values(obj)) findLockups(val, results)
  return results
}

function findContinuations(obj, results = []) {
  if (!obj || typeof obj !== 'object') return results
  const c = obj.continuationCommand?.token || obj.nextContinuationData?.continuation || obj.reloadContinuationData?.continuation
  if (c) results.push(c)
  for (const val of Object.values(obj)) findContinuations(val, results)
  return results
}

async function buildCatalog() {
  console.log('Starting full YouTube channel extraction for موسوعة تكنولوجيا التعليم...')
  const channelId = 'UCYzZgiVHx-sC6aB5KhTRrZw'
  const uploadsPlaylistId = 'UUYzZgiVHx-sC6aB5KhTRrZw'
  const url = `https://www.youtube.com/playlist?list=${uploadsPlaylistId}`
  
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'accept-language': 'ar-KW,ar;q=0.9,en;q=0.7',
      cookie: 'CONSENT=YES+; SOCS=CAI',
    },
  })
  const html = await res.text()
  const bs = extractYouTubeBootstrap(html)
  
  const itemsMap = new Map()
  for (const l of findLockups(bs.initialData)) {
    const p = parseLockup(l, itemsMap.size + 1)
    if (p) itemsMap.set(p.id, p)
  }

  let queue = findContinuations(bs.initialData)
  const used = new Set()
  const apiKey = bs.apiKey
  const clientVersion = bs.clientVersion
  const visitorData = bs.visitorData
  const context = { client: { clientName: 'WEB', clientVersion, hl: 'ar', gl: 'KW', ...(visitorData ? { visitorData } : {}) } }

  while (queue.length) {
    const token = queue.shift()
    if (!token || used.has(token)) continue
    used.add(token)
    try {
      const bRes = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: 'https://www.youtube.com',
          referer: url,
          'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': clientVersion,
          ...(visitorData ? { 'x-goog-visitor-id': visitorData } : {}),
        },
        body: JSON.stringify({ context, continuation: token }),
      })
      const payload = await bRes.json()
      for (const l of findLockups(payload)) {
        const p = parseLockup(l, itemsMap.size + 1)
        if (p && !itemsMap.has(p.id)) itemsMap.set(p.id, p)
      }
      for (const nt of findContinuations(payload)) {
        if (!used.has(nt) && !queue.includes(nt)) queue.push(nt)
      }
    } catch (e) {
      console.error('Continuation error:', e.message)
    }
  }

  const allVideos = [...itemsMap.values()]
  console.log(`Successfully extracted ${allVideos.length} videos from Uploads playlist. Fetching descriptions...`)

  const concurrency = 20
  let fetched = 0
  for (let i = 0; i < allVideos.length; i += concurrency) {
    const batch = allVideos.slice(i, i + concurrency)
    await Promise.all(batch.map(async (v) => {
      try {
        const wRes = await fetch(`https://www.youtube.com/watch?v=${v.id}`, {
          headers: {
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
            'accept-language': 'ar-KW,ar;q=0.9,en;q=0.7',
            cookie: 'CONSENT=YES+; SOCS=CAI',
          },
        })
        const wHtml = await wRes.text()
        const m = wHtml.match(/(?:الباب|باب)\s+[^\"]+/) || wHtml.match(/attributedDescription[^\}]+\"content\":\"([^\"]+)\"/)
        if (m) {
          v.description = m[1] || m[0]
        }
      } catch (e) {}
    }))
    fetched += batch.length
    console.log(`Fetched details for ${fetched} / ${allVideos.length} videos`)
  }

  // Now map doorNumber, chapterNumber, videoNumber
  let mappedCount = 0
  const finalVideos = allVideos.map((v, idx) => {
    const seq = extractCatalogSequence(`${v.title} ${v.description}`)
    if (seq.doorNumber && seq.chapterNumber) {
      mappedCount += 1
      return {
        ...v,
        position: idx + 1,
        doorNumber: seq.doorNumber,
        chapterNumber: seq.chapterNumber,
        videoNumber: seq.videoNumber || null,
        mappingSource: 'title-sequence',
        mappingConfidence: 'exact',
      }
    }
    return {
      ...v,
      position: idx + 1,
    }
  })

  const catalog = {
    channel: {
      handle: 'موسوعةتكنولوجياالتعليم',
      url: 'https://www.youtube.com/@موسوعةتكنولوجياالتعليم/videos',
      id: channelId,
    },
    count: finalVideos.length,
    mappedCount,
    fetchedAt: new Date().toISOString(),
    source: 'youtube-uploads-playlist-full',
    videos: finalVideos,
  }

  writeFileSync('src/data/encyclopedia-videos-fallback.json', JSON.stringify(catalog, null, 2), 'utf8')
  console.log(`BUILD SUCCESSFUL! Total videos: ${catalog.count}, Mapped: ${catalog.mappedCount}`)
}

buildCatalog()
