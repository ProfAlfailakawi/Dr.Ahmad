import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const archiveFile = path.join(root, 'src/data/media-archive.json')
const outputFile = path.join(root, 'src/data/media-archive-transcripts.json')
const legacyTextFile = path.join(root, 'src/data/media-transcripts.json')
const legacyChaptersFile = path.join(root, 'src/data/media-chapters.json')
const defaultInput = path.join(os.homedir(), 'Library/DrAhmad/media-transcription/vtt')
const inputDir = path.resolve(process.argv.find((arg) => arg.startsWith('--input='))?.slice(8) || defaultInput)
const checkOnly = process.argv.includes('--check')

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
/* سياسة التنوين في الموقع: «مشروعاً» — تنوين الفتح على الألف لا قبلها، وبلا
   فصلٍ ولا تكرار. مفرّغات الآلة تكتبها بالصيغة الأخرى فتسقط بوابة النشر على
   ملفٍ مولَّد. والعلامة نفسها تُكتب هنا بالترميز لا حرفياً، وإلا سقط هذا
   السكربت في الفاحص الذي يخدمه. المرجع: scripts/guard-arabic-tanween.mjs. */
const normalizeTanween = (value = '') => String(value)
  .normalize('NFC')
  .replaceAll('\u064B\u0627', '\u0627\u064B')
  .replace(/([ء-يٱ-ۓ])[ \t]+([ً-ٍ])/g, '$1$2')
  .replace(/([ً-ٍ])\1+/g, '$1')
const clean = (value = '') => normalizeTanween(String(value)
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim())
const seconds = (value = '') => {
  const parts = String(value).replace(',', '.').split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}
const correctionRules = [
  [/أحمد\s+(?:الفالد\s*شاوي|الفايله\s*شاوي|الفيلسلكاوي|الفيلكاوي)/g, 'أحمد حسين الفيلكاوي'],
  [/عبد\s*الأزيز\s*(?:ل?عنزي)?/g, 'عبدالعزيز العنزي'],
  [/عبد\s*العزيز\s+العنزي/g, 'عبدالعزيز العنزي'],
  [/تكنوجي(?:ا)?/g, 'تكنولوجيا'],
  [/التغذي(?:ه|ة)?\s+الرجي(?:ه|ّة|ة)/g, 'التغذية الراجعة'],
  [/الحواسي\s+بالمحموله/g, 'الحواسيب المحمولة'],
]
const correct = (text) => correctionRules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), clean(text))
const normalize = (text) => correct(text)
  .normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

function parseVtt(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const blocks = raw.split(/\r?\n\r?\n+/)
  const segments = []
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue
    const [from, to] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const originalText = clean(lines.slice(timingIndex + 1).join(' '))
    if (!originalText) continue
    const start = seconds(from)
    const end = seconds(to)
    if (start < 0 || end <= start) continue
    const displayText = correct(originalText)
    /* نسختان لا أربع: المعروض في displayText والمعياري للبحث في searchText.
       تكرار النص الخام والنص الكامل كان يضاعف حجم الفهرس الذي تحمّله صفحة الأرشيف. */
    segments.push({ start, end, displayText, searchText: normalize(displayText) })
  }
  return segments.sort((a, b) => a.start - b.start)
}

const archive = readJson(archiveFile, { version: 1, items: [] })
const output = readJson(outputFile, {})
const legacyTexts = readJson(legacyTextFile, {})
const legacyChapters = readJson(legacyChaptersFile, { items: [] })

for (const legacy of legacyChapters.items || []) {
  if (!legacy.videoId || output[legacy.videoId]?.available) continue
  const segments = (legacy.chapters || []).map((chapter, index, list) => ({
    start: Number(chapter.at) || 0,
    end: Number(list[index + 1]?.at) || Math.max((Number(chapter.at) || 0) + 30, Number(legacy.duration) || 0),
    displayText: correct(chapter.text || chapter.label),
    searchText: normalize(chapter.text || chapter.label),
  })).filter((segment) => segment.displayText && segment.end > segment.start)
  const legacyText = clean(legacyTexts[legacy.videoId] || segments.map((segment) => segment.displayText).join(' '))
  output[legacy.videoId] = {
    id: legacy.videoId, available: segments.length > 0 || Boolean(legacyText), source: 'legacy', language: 'ar',
    segments, segmentCount: segments.length, indexedAt: new Date().toISOString(),
  }
}

const files = fs.existsSync(inputDir) ? fs.readdirSync(inputDir).filter((name) => name.toLowerCase().endsWith('.vtt')) : []
/* الفهرسة تشمل كل ملف تفريغ موجود، لا مواد media-archive.json وحدها:
   اللقاءات المسجّلة في data.ts (وفي اللوحة) تحمل معرّف يوتيوب نفسه ولا سطر لها في الأرشيف الساكن،
   وكانت تفريغاتها تُهمل بصمت فلا يظهر لها فهرس زمني في الموقع. */
const idFromFile = (name) => name.replace(/\.vtt$/i, '').replace(/\s*\(\d+\)$/, '').trim()
const byId = new Map()
for (const name of files) {
  const id = idFromFile(name)
  if (id && !byId.has(id)) byId.set(id, name)
}
let imported = 0
for (const [id, file] of byId) {
  const segments = parseVtt(path.join(inputDir, file))
  if (!segments.length) continue
  output[id] = {
    id, available: true, source: 'buzz', language: 'ar', segments,
    segmentCount: segments.length, sourceFile: file, indexedAt: new Date().toISOString(),
  }
  const item = (archive.items || []).find((entry) => entry.id === id)
  if (item) item.transcriptStatus = 'transcribed'
  imported += 1
}
archive.generatedAt = new Date().toISOString()

const total = (archive.items || []).length
const available = (archive.items || []).filter((item) => output[item.id]?.available).length
const summary = { total, available, missing: total - available, imported, inputDir }
console.log(JSON.stringify(summary, null, 2))
if (!checkOnly) {
  const atomic = (file, value) => { const temp = `${file}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`); fs.renameSync(temp, file) }
  atomic(outputFile, output)
  atomic(archiveFile, archive)
}
