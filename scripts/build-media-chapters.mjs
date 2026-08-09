#!/usr/bin/env node
/**
 * محاور اللقاءات — «دقيقة الفكرة».
 *
 * الغرض: يبحث الزائر عن مصطلح فيفتح اللقاء قريباً من الموضع الذي قيل فيه،
 * بدل أن يشاهد عشرين دقيقة بحثاً عن جملة.
 *
 * صدقٌ واجب: يوتيوب لم يعد يعطي التوقيتات مجاناً (جرّبنا timedtext فعاد فارغاً)،
 * فالموضع هنا **تقديري** يُحسب من موقع النص في التفريغ نسبةً إلى مدة اللقاء.
 * ولذلك:
 *   ١) نطرح هامش أمان (١٢ ثانية) فيبدأ التشغيل قبل الجملة لا بعدها — الزائر
 *      يسمع مقدمةً زائدة، ولا يفوته المقصود أبداً.
 *   ٢) تُعرض الواجهة كلمة «نحو» صراحةً، فلا نوهم أحداً بدقةٍ لا نملكها.
 *
 * التشغيل: node scripts/build-media-chapters.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeCanonicalRecords, readCanonicalCms } from './canonical-cms.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(ROOT, 'src/data.ts')
const TRANSCRIPTS = resolve(ROOT, 'src/data/media-transcripts.json')
const OUT = resolve(ROOT, 'src/data/media-chapters.json')

const SAFETY_SECONDS = 12
/* المحور القصير جداً لا يستحق قفزة، والطويل جداً يصير فصلاً لا محوراً. */
const MIN_WORDS = 45
const TARGET_WORDS = 110

if (!existsSync(TRANSCRIPTS)) {
  console.error('✘ لا يوجد src/data/media-transcripts.json')
  process.exit(1)
}

const transcripts = JSON.parse(readFileSync(TRANSCRIPTS, 'utf8'))
const dataText = readFileSync(DATA, 'utf8')

const mediaBlock = dataText.slice(dataText.indexOf('export const media = ['))
const rawEntries = [...mediaBlock.slice(0, mediaBlock.indexOf('\n]')).matchAll(/\{[^}]*\}/g)].map((match) => match[0])

const field = (entry, key) => typeof entry === 'string'
  ? entry.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] || ''
  : String(entry?.[key] || '')
const staticMedia = rawEntries.map((entry) => ({
  slug: field(entry, 'slug') || field(entry, 'title'),
  title: field(entry, 'title'),
  url: field(entry, 'url'),
  duration: field(entry, 'duration'),
  transcript: field(entry, 'transcript'),
})).filter((item) => item.slug && item.title)
const entries = mergeCanonicalRecords('media', staticMedia, readCanonicalCms(ROOT))

const seconds = (value) => {
  const parts = String(value).split(':').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return 0
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

/* سياسة التنوين نفسها تسري على نصوص اللقاءات المفرّغة. */
const FATHATAN = '\u064B'
const normalizeTanween = (value = '') => String(value)
  .normalize('NFC')
  .replaceAll(`${FATHATAN}ا`, `ا${FATHATAN}`)
  .replace(/([\u0621-\u064A\u0671-\u06D3])[ \t]+([\u064B-\u064D])/g, '$1$2')
  .replace(/([\u064B-\u064D])\1+/g, '$1')

const STOP = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون هو هي انا نحن انت هم كل بعض عند بعد قبل ثم او ام لا ما هل قد يعني يعنى اليوم طبعا اكيد الله حياك شكرا نعم'.split(' '))
const normalize = (value = '') => value
  .normalize('NFKC').replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/* عنوان المحور: أكثر الكلمات دلالةً في مقطعه — لا جملة عشوائية منه. */
function labelFor(text) {
  const counts = new Map()
  for (const word of normalize(text).split(' ')) {
    if (word.length < 4 || STOP.has(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar')).slice(0, 3)
  return top.map(([word]) => word).join(' · ')
}

const items = []

for (const entry of entries) {
  const url = field(entry, 'url')
  const videoId = url.split('v=')[1]?.split('&')[0] || ''
  const transcript = normalizeTanween(String(field(entry, 'transcript') || transcripts[videoId] || '')).trim()
  const duration = seconds(field(entry, 'duration'))
  if (!videoId || !transcript || !duration) continue

  const words = transcript.split(/\s+/).filter(Boolean)
  if (words.length < MIN_WORDS * 2) continue

  const chapters = []
  for (let index = 0; index < words.length; index += TARGET_WORDS) {
    const slice = words.slice(index, index + TARGET_WORDS)
    if (slice.length < MIN_WORDS) break
    const text = slice.join(' ')
    /* الموضع التقديري: نسبة موقع الكلمة الأولى من التفريغ × مدة اللقاء. */
    const estimated = Math.floor((index / words.length) * duration)
    chapters.push({
      at: Math.max(0, estimated - SAFETY_SECONDS),
      label: labelFor(text),
      text,
    })
  }

  if (chapters.length) items.push({ videoId, url, title: field(entry, 'title'), duration, chapters })
}

const total = items.reduce((sum, item) => sum + item.chapters.length, 0)

writeFileSync(OUT, `${JSON.stringify({
  version: 1,
  policy: 'مواضع تقديرية محسوبة من موقع النص في التفريغ نسبةً إلى مدة اللقاء — ليست توقيتات رسمية من يوتيوب. يُطرح هامش أمان فيبدأ التشغيل قبل الجملة.',
  safetySeconds: SAFETY_SECONDS,
  coverage: { videos: items.length, chapters: total },
  items,
})}\n`, 'utf8')

console.log(`✔ محاور اللقاءات: ${total} محوراً في ${items.length} لقاءً (موضع تقديري بهامش ${SAFETY_SECONDS} ثانية)`)
for (const item of items) console.log(`   ${String(item.chapters.length).padStart(3)} محوراً · ${item.title.slice(0, 52)}`)
