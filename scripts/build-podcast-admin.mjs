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
const AUDITS = resolve(ROOT, 'podcast-audits')
const EXTERNAL_AUDIO_BASE_URL = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const podcastStatePath = resolve(ROOT, '.podcast-state.json')
const podcastState = existsSync(podcastStatePath) ? JSON.parse(readFileSync(podcastStatePath, 'utf8')) : { done: {} }

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
const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
const audioMeta = EXTERNAL_AUDIO_BASE_URL && existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
const externalDialogue = Object.keys(audioMeta).filter((name) => name.endsWith('.dialogue.mp3'))
const dialogue = [...new Set([...files.filter((name) => name.endsWith('.dialogue.mp3')), ...externalDialogue])].sort()
const generatedAt = dialogue.length ? new Date().toISOString() : null

function readAudit(slug) {
  const file = resolve(AUDITS, `${slug}.ar.json`)
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch { return null }
}

function roundedScore(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0
}

function scoreAudioGate({ approved, hasTranscript, byteSize, meta, audit }) {
  const finalGate = audit?.finalGate || {}
  const technical = finalGate.technicalAudit || {}
  const comparison = finalGate.fullComparison || {}
  const judge = finalGate.finalJudge || {}
  const issues = []
  const metrics = {
    durationSeconds: Math.round(Number(meta?.durationSeconds || technical?.dur || 0)),
    bytes: byteSize,
    sttRatio: Number.isFinite(Number(comparison?.ratio)) ? Math.round(Number(comparison.ratio) * 100) : null,
    importantRatio: Number.isFinite(Number(comparison?.importantRatio)) ? Math.round(Number(comparison.importantRatio) * 100) : null,
    longSilences: Array.isArray(technical?.longSilences) ? technical.longSilences.length : null,
    peakDb: Number.isFinite(Number(technical?.peakDb)) ? Number(technical.peakDb) : null,
    judgePass: judge?.pass === true,
  }

  const durationOk = metrics.durationSeconds >= 120 && metrics.durationSeconds <= 360
  const bytesOk = byteSize >= 200_000
  const transcriptOk = Boolean(hasTranscript)
  const auditOk = finalGate.pass === true
  const sttOk = metrics.importantRatio === null ? auditOk : metrics.importantRatio >= 95
  const silenceOk = metrics.longSilences === null ? auditOk : metrics.longSilences === 0
  const permanentUrlOk = Boolean(meta?.url || meta?.r2Key || EXTERNAL_AUDIO_BASE_URL)

  if (!approved) issues.push('الحلقة ليست معتمدة آليًا في حالة البودكاست.')
  if (!transcriptOk) issues.push('لا يوجد Transcript منشور لهذه الحلقة.')
  if (!auditOk) issues.push('لا يوجد تقرير جودة نهائي مجتاز للحلقة.')
  if (!sttOk) issues.push('تطابق STT مع النص المقصود أقل من الحد الصارم.')
  if (!durationOk) issues.push('مدة الحلقة خارج المجال الطبيعي المطلوب.')
  if (!silenceOk) issues.push('توجد وقفات طويلة تتجاوز الحد المقبول.')
  if (!bytesOk) issues.push('حجم الملف مريب أو غير صالح للبودكاست.')
  if (!permanentUrlOk) issues.push('رابط الصوت الدائم غير مثبت.')

  const score = roundedScore(
    (approved ? 18 : 0)
    + (transcriptOk ? 14 : 0)
    + (auditOk ? 24 : 0)
    + (sttOk ? 14 : 0)
    + (durationOk ? 10 : 0)
    + (silenceOk ? 10 : 0)
    + (bytesOk ? 5 : 0)
    + (permanentUrlOk ? 5 : 0)
  )

  return {
    score,
    pass: score >= 92 && issues.length === 0,
    metrics,
    pronunciation: auditOk && sttOk ? 'مقبول' : 'ينتظر فحص النطق والمعنى',
    pace: durationOk ? 'مقبول' : 'يحتاج ضبط السرعة/المدة',
    pauses: silenceOk ? 'مقبول' : 'يحتاج تقليل الوقفات',
    issues,
  }
}

const episodes = dialogue.map((name) => {
  const slug = name.slice(0, -'.dialogue.mp3'.length)
  const article = articleBySlug.get(slug)
  const file = resolve(AUDIO, name)
  const localAudio = existsSync(file)
  const transcriptFile = resolve(AUDIO, `${slug}.dialogue.json`)
  const hasTranscript = existsSync(transcriptFile)
  const hash = localAudio ? createHash('sha256').update(readFileSync(file)).digest('hex') : ''
  const accepted = podcastState?.done?.[`${slug}:ar`]
  const approved = accepted?.status === 'accepted_automated' && (!localAudio || accepted.audioHash === hash)
  const meta = audioMeta?.[name] || {}
  const byteSize = localAudio ? statSync(file).size : Number(meta.bytes || 0)
  const audit = readAudit(slug)
  let utterances = 0
  if (hasTranscript) {
    try {
      const json = JSON.parse(readFileSync(transcriptFile, 'utf8'))
      utterances = Array.isArray(json.utterances) ? json.utterances.length : 0
    } catch { /* noop */ }
  }
  const gate = scoreAudioGate({ approved, hasTranscript, byteSize, meta, audit })
  return {
    slug,
    title: article?.title || slug,
    category: article?.cat || 'بودكاست',
    date: article?.date || '',
    iso: article?.iso || '',
    status: gate.pass ? 'published' : 'under_review',
    audio: `/audio/${name}`,
    bytes: byteSize,
    audioHash: hash ? hash.slice(0, 16) : '',
    hasTranscript,
    utterances,
    quality: {
      score: gate.score,
      pass: gate.pass,
      metrics: gate.metrics,
      pronunciation: gate.pronunciation,
      pace: gate.pace,
      pauses: gate.pauses,
      issues: gate.issues,
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
