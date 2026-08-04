import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'

const SUPPORTED_EXTENSIONS = new Set(['.vtt', '.srt', '.json'])
const STATIC_SOURCES = new Set(['buzz', 'youtube-captions', 'manual-reviewed'])
const NOISE_ONLY = /^\s*[[(（]?\s*(?:موسيقى|صمت|تصفيق|ضوضاء|music|silence|applause|noise)\s*[\])）]?\s*[.!،,؟?]*\s*$/iu
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function normalizeTranscriptSearchText(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (character) => String(ARABIC_DIGITS.indexOf(character)))
    .replace(/[۰-۹]/g, (character) => String(PERSIAN_DIGITS.indexOf(character)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanTranscriptText(value = '') {
  const text = String(value || '')
    .normalize('NFKC')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/<\/?(?:c|v|lang)(?:\.[^ >]+|\s+[^>]*)?>/giu, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
  return NOISE_ONLY.test(text) ? '' : text
}

export function parseTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return null
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw)
  const negative = raw.startsWith('-')
  const parts = raw.replace(/^-/, '').split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part)) || parts.length < 2 || parts.length > 3) return null
  const seconds = parts.pop() || 0
  const minutes = parts.pop() || 0
  const hours = parts.pop() || 0
  const result = hours * 3600 + minutes * 60 + seconds
  return negative ? -result : result
}

function firstFinite(...values) {
  for (const value of values) {
    const parsed = parseTimestamp(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function jsonSegmentText(segment) {
  if (!segment || typeof segment !== 'object') return ''
  if (Array.isArray(segment.words)) return segment.words.map((word) => typeof word === 'string' ? word : word?.word || word?.text || '').join(' ')
  if (Array.isArray(segment.segs)) return segment.segs.map((part) => part?.utf8 || part?.text || '').join(' ')
  return segment.text ?? segment.content ?? segment.transcript ?? segment.caption ?? segment.utf8 ?? ''
}

function jsonSegments(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload.segments,
    payload.transcription,
    payload.transcript,
    payload.events,
    payload.results?.segments,
    payload.result?.segments,
    payload.data?.segments,
  ]
  return candidates.find(Array.isArray) || []
}

function parseJsonSegments(payload) {
  return jsonSegments(payload).map((segment) => {
    const start = firstFinite(segment?.start, segment?.startTime, segment?.start_time, segment?.from, segment?.begin, segment?.offset)
      ?? (Number.isFinite(Number(segment?.start_ms)) ? Number(segment.start_ms) / 1000 : null)
    let end = firstFinite(segment?.end, segment?.endTime, segment?.end_time, segment?.to, segment?.finish)
      ?? (Number.isFinite(Number(segment?.end_ms)) ? Number(segment.end_ms) / 1000 : null)
    const duration = firstFinite(segment?.duration, segment?.durationSeconds, segment?.duration_seconds)
      ?? (Number.isFinite(Number(segment?.duration_ms)) ? Number(segment.duration_ms) / 1000 : null)
    if (!Number.isFinite(end) && Number.isFinite(start) && Number.isFinite(duration)) end = start + duration
    return { start, end, text: jsonSegmentText(segment) }
  })
}

function parseSubtitle(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  const output = []
  const timing = /^\s*([^\s]+)\s*-->\s*([^\s]+)(?:\s+.*)?$/
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(timing)
    if (!match) continue
    const cue = []
    for (let next = index + 1; next < lines.length; next += 1) {
      if (timing.test(lines[next])) break
      if (!lines[next].trim()) {
        if (cue.length) break
        continue
      }
      // معرّف cue رقمي/نصي قبل سطر التوقيت لا يدخل هنا؛ وما بعده كلام فعلي.
      cue.push(lines[next].trimEnd())
      index = next
    }
    output.push({
      start: parseTimestamp(match[1]),
      end: parseTimestamp(match[2]),
      text: cue.join(' '),
    })
  }
  return output
}

function trimRollingCaptionOverlap(previousText, currentText) {
  const previousTokens = String(previousText || '').split(/\s+/).filter(Boolean)
  const currentTokens = String(currentText || '').split(/\s+/).filter(Boolean)
  const previousNormalized = previousTokens.map(normalizeTranscriptSearchText)
  const currentNormalized = currentTokens.map(normalizeTranscriptSearchText)
  const maximum = Math.min(previousNormalized.length, currentNormalized.length)
  for (let size = maximum; size >= 1; size -= 1) {
    const suffix = previousNormalized.slice(-size)
    const prefix = currentNormalized.slice(0, size)
    if (!suffix.every((token, index) => token && token === prefix[index])) continue
    const overlapText = suffix.join(' ')
    // كلمة قصيرة واحدة قد تكون تكراراً طبيعياً؛ لا نحذفها إلا إذا كانت مميزة.
    if (size === 1 && overlapText.length < 6) return currentText
    return currentTokens.slice(size).join(' ')
  }
  return currentText
}

export function normalizeSegments(rawSegments = []) {
  const issues = { invalidTiming: 0, empty: 0, duplicate: 0 }
  const valid = []
  for (const raw of rawSegments) {
    const start = Number(raw?.start)
    const end = Number(raw?.end)
    const text = cleanTranscriptText(raw?.text)
    if (!text) { issues.empty += 1; continue }
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      issues.invalidTiming += 1
      continue
    }
    valid.push({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), text })
  }
  valid.sort((left, right) => left.start - right.start || left.end - right.end)
  const output = []
  for (const segment of valid) {
    const previous = output.at(-1)
    if (previous) {
      const same = normalizeTranscriptSearchText(previous.text) === normalizeTranscriptSearchText(segment.text)
      const overlaps = segment.start <= previous.end + 0.08
      if (same && overlaps) {
        previous.end = Math.max(previous.end, segment.end)
        issues.duplicate += 1
        continue
      }
      const previousNormalized = normalizeTranscriptSearchText(previous.text)
      const currentNormalized = normalizeTranscriptSearchText(segment.text)
      if (overlaps && currentNormalized && previousNormalized.endsWith(currentNormalized) && segment.end <= previous.end + 0.25) {
        issues.duplicate += 1
        continue
      }
      if (overlaps) {
        const trimmed = cleanTranscriptText(trimRollingCaptionOverlap(previous.text, segment.text))
        if (!trimmed) {
          previous.end = Math.max(previous.end, segment.end)
          issues.duplicate += 1
          continue
        }
        if (trimmed !== segment.text) {
          segment.text = trimmed
          issues.duplicate += 1
        }
      }
    }
    output.push(segment)
  }
  return { segments: output, issues }
}

export function parseTranscriptText(text, extension = '.vtt') {
  const ext = extension.toLowerCase()
  let rawSegments = []
  if (ext === '.json') rawSegments = parseJsonSegments(JSON.parse(String(text || '')))
  else rawSegments = parseSubtitle(text)
  return normalizeSegments(rawSegments)
}

export function parseTranscriptFile(filePath) {
  const extension = extname(filePath).toLowerCase()
  if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error(`Unsupported transcript format: ${extension}`)
  const text = readFileSync(filePath, 'utf8')
  return { ...parseTranscriptText(text, extension), extension, bytes: Buffer.byteLength(text), hash: sha256(text) }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function atomicWriteJson(filePath, value) {
  mkdirSync(resolve(filePath, '..'), { recursive: true })
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, filePath)
}

function readJson(filePath, fallback) {
  try { return JSON.parse(readFileSync(filePath, 'utf8')) } catch { return fallback }
}

function validSegments(record) {
  return Array.isArray(record?.segments) && normalizeSegments(record.segments).segments.length > 0
}

function mappingFromVideo(video, structure) {
  const doorNumber = Number(video?.doorNumber) || null
  const chapterNumber = Number(video?.chapterNumber) || null
  const door = structure?.doors?.find((item) => Number(item.doorNumber) === doorNumber) || null
  const chapter = door?.units?.find((item) => Number(item.number) === chapterNumber) || null
  const mapped = Boolean(door && chapter)
  return {
    doorId: mapped ? String(door.id || '') : null,
    doorNumber: mapped ? doorNumber : null,
    chapterNumber: mapped ? chapterNumber : null,
    chapterTitle: mapped ? String(chapter.title || '') : null,
    sequenceLabel: mapped ? `الباب ${doorNumber} · الفصل ${chapterNumber}` : '',
    mappingSource: mapped ? String(video.mappingSource || 'catalog') : 'needs-review',
    mappingConfidence: mapped ? String(video.mappingConfidence || 'exact') : 'unresolved',
    reviewStatus: mapped ? 'unreviewed' : 'needs-review',
  }
}

function recordFromCatalog(video, structure, old = {}) {
  const mapping = mappingFromVideo(video, structure)
  const oldHasTranscript = validSegments(old)
  const normalized = oldHasTranscript ? normalizeSegments(old.segments).segments : []
  const source = STATIC_SOURCES.has(old?.source) ? old.source : null
  const available = normalized.length > 0 && Boolean(source)
  return {
    videoId: video.id,
    available,
    checked: Boolean(old.checked || available),
    status: available ? 'transcribed' : 'metadata-only',
    language: String(old.language || 'ar'),
    source,
    title: String(video.title || old.title || ''),
    description: String(video.description || old.description || ''),
    ...mapping,
    ...(oldHasTranscript ? {
      segments: normalized,
      text: normalized.map((segment) => segment.text).join(' '),
      segmentCount: normalized.length,
      sourceFile: String(old.sourceFile || ''),
      sourceHash: String(old.sourceHash || ''),
      sourceBytes: Number(old.sourceBytes) || 0,
      indexedAt: String(old.indexedAt || ''),
      reviewStatus: String(old.reviewStatus || mapping.reviewStatus),
      lastTimestamp: normalized.at(-1)?.end || 0,
    } : {
      segments: [], text: '', segmentCount: 0, sourceFile: '', sourceHash: '', sourceBytes: 0, indexedAt: '', lastTimestamp: 0,
    }),
  }
}

export function buildTranscriptProgress(records, total = 0) {
  const list = Array.isArray(records) ? records : Object.values(records || {})
  const available = list.filter((record) => record?.available && validSegments(record)).length
  const needsReview = list.filter((record) => !record?.doorNumber || !record?.chapterNumber || (record?.available && record?.reviewStatus !== 'reviewed')).length
  const sources = { buzz: 0, 'youtube-captions': 0, 'manual-reviewed': 0 }
  for (const record of list) if (record?.available && Object.hasOwn(sources, record.source)) sources[record.source] += 1
  const catalogued = total || list.length
  return {
    running: false,
    total: catalogued,
    catalogued,
    completed: available,
    available,
    transcribed: available,
    needsReview,
    missing: Math.max(0, catalogued - available),
    sources,
  }
}

export function normalizeTranscriptIndex(payload, catalog, structure) {
  const oldRecords = payload?.records && typeof payload.records === 'object'
    ? payload.records
    : Array.isArray(payload?.videos)
      ? Object.fromEntries(payload.videos.map((record) => [record.videoId || record.id, record]))
      : payload && typeof payload === 'object'
        ? payload
        : {}
  const records = {}
  for (const video of catalog.videos || []) records[video.id] = recordFromCatalog(video, structure, oldRecords[video.id] || {})
  return {
    version: 2,
    generatedAt: String(payload?.generatedAt || new Date().toISOString()),
    catalogCount: (catalog.videos || []).length,
    progress: buildTranscriptProgress(records, (catalog.videos || []).length),
    records,
  }
}

function walkFiles(directory) {
  if (!existsSync(directory)) return []
  const output = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...walkFiles(path))
    else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) output.push(path)
  }
  return output.sort()
}

function candidatePriority(filePath) {
  const name = basename(filePath).toLowerCase()
  if (name.includes('manual-reviewed')) return 100
  const ext = extname(filePath).toLowerCase()
  return ext === '.json' ? 30 : ext === '.vtt' ? 20 : 10
}


export function inspectBuzzDirectory({ inputDir, catalogFile } = {}) {
  const catalog = readJson(catalogFile, { videos: [] })
  const known = new Set((catalog.videos || []).map((video) => video.id))
  const files = walkFiles(inputDir)
  const grouped = new Map()
  const report = { files: files.length, imported: 0, skipped: 0, unknown: [], duplicates: [], empty: [], invalidTiming: [], failed: [] }
  for (const filePath of files) {
    const videoId = basename(filePath, extname(filePath)).replace(/\.(?:manual-reviewed|buzz)$/i, '').trim()
    if (!known.has(videoId)) { report.unknown.push(relative(inputDir, filePath)); continue }
    const list = grouped.get(videoId) || []
    list.push(filePath)
    grouped.set(videoId, list)
  }
  for (const [videoId, candidates] of grouped) {
    candidates.sort((a, b) => candidatePriority(b) - candidatePriority(a) || a.localeCompare(b))
    if (candidates.length > 1) report.duplicates.push({ videoId, files: candidates.map((filePath) => relative(inputDir, filePath)) })
    let valid = false
    for (const filePath of candidates) {
      try {
        const parsed = parseTranscriptFile(filePath)
        if (parsed.issues.invalidTiming > 0) report.invalidTiming.push({ file: relative(inputDir, filePath), count: parsed.issues.invalidTiming })
        if (!parsed.segments.length) { report.empty.push(relative(inputDir, filePath)); continue }
        valid = true
        break
      } catch (error) {
        report.failed.push({ file: relative(inputDir, filePath), error: String(error?.message || error) })
      }
    }
    if (!valid && !candidates.length) report.empty.push(videoId)
  }
  return report
}

export async function importBuzzDirectory({
  inputDir,
  outputFile,
  catalogFile,
  structureFile,
  force = false,
  now = () => new Date().toISOString(),
} = {}) {
  const catalog = readJson(catalogFile, { videos: [] })
  const structure = readJson(structureFile, { doors: [] })
  const previous = readJson(outputFile, {})
  const index = normalizeTranscriptIndex(previous, catalog, structure)
  const known = new Set((catalog.videos || []).map((video) => video.id))
  const files = walkFiles(inputDir)
  const grouped = new Map()
  const report = { files: files.length, imported: 0, skipped: 0, unknown: [], duplicates: [], empty: [], invalidTiming: [], failed: [] }

  for (const filePath of files) {
    const videoId = basename(filePath, extname(filePath))
      .replace(/\.(?:manual-reviewed|buzz)$/i, '')
      .trim()
    if (!known.has(videoId)) { report.unknown.push(relative(inputDir, filePath)); continue }
    const list = grouped.get(videoId) || []
    list.push(filePath)
    grouped.set(videoId, list)
  }

  for (const [videoId, candidates] of grouped) {
    candidates.sort((a, b) => candidatePriority(b) - candidatePriority(a) || a.localeCompare(b))
    if (candidates.length > 1) report.duplicates.push({ videoId, files: candidates.map((filePath) => relative(inputDir, filePath)) })
    const old = index.records[videoId]
    let accepted = null
    for (const filePath of candidates) {
      try {
        const parsed = parseTranscriptFile(filePath)
        if (parsed.issues.invalidTiming > 0) report.invalidTiming.push({ file: relative(inputDir, filePath), count: parsed.issues.invalidTiming })
        if (!parsed.segments.length) { report.empty.push(relative(inputDir, filePath)); continue }
        accepted = { filePath, parsed }
        break
      } catch (error) {
        report.failed.push({ file: relative(inputDir, filePath), error: String(error?.message || error) })
      }
    }
    if (!accepted) continue
    if (!force && old?.sourceHash === accepted.parsed.hash && old?.available && validSegments(old)) { report.skipped += 1; continue }
    const sourceFile = relative(inputDir, accepted.filePath).replaceAll('\\', '/')
    const source = basename(accepted.filePath).toLowerCase().includes('manual-reviewed') ? 'manual-reviewed' : 'buzz'
    const mapping = mappingFromVideo((catalog.videos || []).find((video) => video.id === videoId), structure)
    const segments = accepted.parsed.segments
    index.records[videoId] = {
      ...old,
      ...mapping,
      videoId,
      available: true,
      checked: true,
      status: 'transcribed',
      language: 'ar',
      source,
      segments,
      text: segments.map((segment) => segment.text).join(' '),
      segmentCount: segments.length,
      sourceFile,
      sourceHash: accepted.parsed.hash,
      sourceBytes: accepted.parsed.bytes,
      indexedAt: now(),
      lastTimestamp: segments.at(-1)?.end || 0,
      reviewStatus: old?.reviewStatus === 'reviewed' || source === 'manual-reviewed' ? 'reviewed' : mapping.reviewStatus,
    }
    index.generatedAt = now()
    index.progress = buildTranscriptProgress(index.records, index.catalogCount)
    atomicWriteJson(outputFile, index)
    report.imported += 1
  }
  index.generatedAt = now()
  index.progress = buildTranscriptProgress(index.records, index.catalogCount)
  atomicWriteJson(outputFile, index)
  return { index, report }
}

export function buildTranscriptReport({ index, importReport = {} } = {}) {
  const records = Object.values(index?.records || {})
  const progress = buildTranscriptProgress(records, Number(index?.catalogCount) || records.length)
  const unmapped = records.filter((record) => !record.doorNumber || !record.chapterNumber).map((record) => record.videoId)
  return {
    ...progress,
    importedBuzzFiles: Number(importReport.imported) || progress.sources.buzz || 0,
    unknownFiles: importReport.unknown || [],
    duplicateFiles: importReport.duplicates || [],
    emptyFiles: importReport.empty || [],
    invalidTiming: importReport.invalidTiming || [],
    failedFiles: importReport.failed || [],
    unmapped,
    completionPercent: progress.total ? Number(((progress.available / progress.total) * 100).toFixed(2)) : 0,
  }
}

export function formatTranscriptReport(report) {
  return [
    `إجمالي الفيديوهات: ${report.total}`,
    `مفرغ فعلياً: ${report.available}`,
    `من Buzz: ${report.sources?.buzz || 0}`,
    `من YouTube Captions: ${report.sources?.['youtube-captions'] || 0}`,
    `مراجع يدوياً: ${report.sources?.['manual-reviewed'] || 0}`,
    `يحتاج مراجعة: ${report.needsReview}`,
    `بلا تفريغ: ${report.missing}`,
    `ملفات Buzz المستوردة: ${report.importedBuzzFiles || 0}`,
    `ملفات غير معروفة: ${report.unknownFiles?.length || 0}`,
    `ملفات مكررة: ${report.duplicateFiles?.length || 0}`,
    `ملفات فارغة: ${report.emptyFiles?.length || 0}`,
    `أخطاء توقيت: ${report.invalidTiming?.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 0}`,
    `فشل الاستيراد: ${report.failedFiles?.length || 0}`,
    `فيديوهات غير مرتبطة بباب وفصل: ${report.unmapped?.length || 0}`,
    `نسبة الإنجاز: ${report.completionPercent}%`,
  ].join('\n')
}
