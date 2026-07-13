#!/usr/bin/env node
/**
 * يبني manifest خفيف للوحة البودكاست من ملفات audio الحوارية.
 * لا يعتمد على المتصفح، ولا يضيف حلقات غير موجودة.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const DATA = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const OUT = resolve(ROOT, 'src/data/podcast-admin.json')
try { process.loadEnvFile(resolve(ROOT, '.env')) } catch { /* .env اختياري */ }
const AUDIO_PUBLIC_BASE_URL = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const USE_EXTERNAL_AUDIO = Boolean(AUDIO_PUBLIC_BASE_URL)
const podcastStatePath = resolve(ROOT, '.podcast-state.json')
const podcastState = existsSync(podcastStatePath) ? JSON.parse(readFileSync(podcastStatePath, 'utf8')) : { done: {} }
const audioMetaPath = resolve(ROOT, 'src/data/audio-meta.json')
const audioMeta = existsSync(audioMetaPath) ? JSON.parse(readFileSync(audioMetaPath, 'utf8')) : {}

const articlesSource = DATA.slice(DATA.indexOf('export const articles = ['), DATA.indexOf('export const articlesWithBody'))
const pick = (block, key) => block.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] || ''
const articles = [...articlesSource.matchAll(/\{\s*slug:\s*'[^']+'[\s\S]*?\},/g)]
  .map((m) => {
    const block = m[0]
    return { slug: pick(block, 'slug'), title: pick(block, 'title'), date: pick(block, 'date'), iso: pick(block, 'iso'), cat: pick(block, 'cat') }
  })
  .filter((article) => article.slug && article.title)

const articleBySlug = new Map(articles.map((article) => [article.slug, article]))
const files = existsSync(AUDIO) ? readdirSync(AUDIO) : []
const localDialogue = files.filter((name) => name.endsWith('.dialogue.mp3'))
const externalDialogue = USE_EXTERNAL_AUDIO
  ? Object.keys(audioMeta).filter((name) => name.endsWith('.dialogue.mp3'))
  : []
const dialogue = [...new Set([...localDialogue, ...externalDialogue])].sort()
const generatedAt = dialogue.length
  ? new Date(Math.max(...dialogue.map((name) => existsSync(resolve(AUDIO, name))
      ? statSync(resolve(AUDIO, name)).mtimeMs
      : Date.now()))).toISOString()
  : null

const episodes = dialogue.map((name) => {
  const slug = name.slice(0, -'.dialogue.mp3'.length)
  const article = articleBySlug.get(slug)
  const file = resolve(AUDIO, name)
  const transcriptFile = resolve(AUDIO, `${slug}.dialogue.json`)
  const localAudio = existsSync(file)
  const bytes = localAudio ? readFileSync(file) : null
  const hasTranscript = existsSync(transcriptFile)
  const hash = bytes ? createHash('sha256').update(bytes).digest('hex') : ''
  const accepted = podcastState?.done?.[`${slug}:ar`]
  const approved = accepted?.status === 'accepted_automated'
    && ((hash && accepted.audioHash === hash) || (!localAudio && USE_EXTERNAL_AUDIO && audioMeta[name]?.bytes))
  let utterances = 0
  if (hasTranscript) {
    try {
      const json = JSON.parse(readFileSync(transcriptFile, 'utf8'))
      utterances = Array.isArray(json.utterances) ? json.utterances.length : 0
    } catch { /* noop */ }
  }
  return {
    slug,
    title: article?.title || slug,
    category: article?.cat || 'بودكاست',
    date: article?.date || '',
    iso: article?.iso || '',
    status: approved ? 'published' : 'under_review',
    audio: USE_EXTERNAL_AUDIO ? `${AUDIO_PUBLIC_BASE_URL}/${name}` : `/audio/${name}`,
    bytes: localAudio ? statSync(file).size : Number(audioMeta[name]?.bytes || 0),
    audioHash: hash ? hash.slice(0, 16) : accepted?.audioHash?.slice(0, 16) || '',
    hasTranscript,
    utterances,
    quality: {
      pronunciation: approved ? 'مقبول' : hasTranscript ? 'ينتظر اعتماد البوابة' : 'يحتاج Transcript',
      pace: approved ? 'مقبول' : 'ينتظر تقرير الجودة',
      pauses: approved ? 'مقبول' : 'ينتظر تقرير الجودة',
      issues: [
        ...(!hasTranscript ? ['لا يوجد Transcript منشور لهذه الحلقة بعد.'] : []),
        ...(!approved ? ['لن تُنشر الحلقة الحوارية في RSS قبل اعتماد بوابة الجودة.'] : []),
      ],
    },
  }
})

const themes = [
  { title: 'الإنسان في قلب الآلة', terms: ['الذكاء', 'الآلة', 'الإنسان', 'التقنية'] },
  { title: 'مستقبل المعلم', terms: ['المعلم', 'التعليم', 'التدريس'] },
  { title: 'الامتحان والخوف', terms: ['الامتحان', 'القياس', 'الخوف', 'الدرجة'] },
  { title: 'الطفل والتكنولوجيا', terms: ['الطفل', 'الأسرة', 'التكنولوجيا'] },
]

const playlists = themes.map((theme) => ({
  title: theme.title,
  episodes: episodes.filter((episode) => {
    const text = `${episode.title} ${episode.category}`
    return theme.terms.some((term) => text.includes(term))
  }).slice(0, 6),
})).filter((playlist) => playlist.episodes.length)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify({ generatedAt, episodes, playlists }, null, 2)}\n`, 'utf8')
console.log(`✔ podcast-admin.json · ${episodes.length} حلقات حوارية · ${playlists.length} قوائم`)
