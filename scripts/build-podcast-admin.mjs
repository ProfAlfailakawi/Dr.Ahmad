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
const dialogue = files.filter((name) => name.endsWith('.dialogue.mp3')).sort()

const episodes = dialogue.map((name) => {
  const slug = name.slice(0, -'.dialogue.mp3'.length)
  const article = articleBySlug.get(slug)
  const file = resolve(AUDIO, name)
  const transcriptFile = resolve(AUDIO, `${slug}.dialogue.json`)
  const bytes = readFileSync(file)
  const hasTranscript = existsSync(transcriptFile)
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
    status: 'published',
    audio: `/audio/${name}`,
    bytes: statSync(file).size,
    audioHash: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    hasTranscript,
    utterances,
    quality: {
      pronunciation: hasTranscript ? 'مكتمل نصياً' : 'يحتاج Transcript',
      pace: 'يفحص من تقرير الحوار عند توفره',
      pauses: 'يفحص من تقرير الحوار عند توفره',
      issues: hasTranscript ? [] : ['لا يوجد Transcript منشور لهذه الحلقة بعد.'],
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
writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), episodes, playlists }, null, 2)}\n`, 'utf8')
console.log(`✔ podcast-admin.json · ${episodes.length} حلقات حوارية · ${playlists.length} قوائم`)
