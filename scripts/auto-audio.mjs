#!/usr/bin/env node
/**
 * يولّد صوتي فهد ونورة لكل مقال ينقصه صوت.
 *
 * الاستراتيجية الهجينة مقصودة:
 * - المقالات الأصلية (مع تعديلات content_overrides) تحفظ في ./audio وpublic/audio
 *   ويُعاد بناء src/data/audio.json ذرياً، لتبقى متوافقة مع build-static/sync-audio.
 * - مقالات site_articles تحفظ حصراً في Firebase Storage تحت site-content/audio،
 *   ثم تُكتب روابطها في document.audio؛ لذلك يصل صوت المقال الجديد فوراً بلا بناء.
 *
 * التشغيل المجدول: npm run audio
 * فحص بلا شبكة ولا Azure ولا كتابة: npm run audio:dry-run
 * توليد الأصل فقط: npm run audio:base
 */
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  READING_VOICES,
} from './lib/arabic-audio-engine.mjs'
import {
  HUMAN_READING_PIPELINE_HASH,
  readingNeedsGeneration,
  renderHumanReading,
} from './lib/human-reading-pipeline.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_DIR = resolve(ROOT, 'audio')
const PUBLIC_AUDIO_DIR = resolve(ROOT, 'public/audio')
const MANIFEST = resolve(ROOT, 'src/data/audio.json')
const AUDIO_META = resolve(ROOT, 'src/data/audio-meta.json')
const SITE_FEED = resolve(ROOT, 'src/data/site-articles-feed.json')
const AUDIO_AUDITS = resolve(ROOT, 'audio-audits')
const AUDIO_WORK = resolve(ROOT, '.audio-human-work')
const AUDIO_LAST_GOOD = resolve(ROOT, '.audio-last-known-good')
const AUDIO_QUARANTINE = resolve(AUDIO_AUDITS, 'quarantine')
const PENDING_SITE_PATCHES = resolve(ROOT, '.audio-site-patches.json')
const DRY_RUN = process.argv.includes('--dry-run')
const BASE_ONLY = DRY_RUN || process.argv.includes('--base-only') || process.argv.includes('--local-only')
const UPGRADE_EXISTING = process.argv.includes('--upgrade-existing')
const FORCE_REGENERATE = process.argv.includes('--force')
const TECHNICAL_ONLY = process.argv.includes('--technical-only')
const slugArg = process.argv.find((arg) => arg.startsWith('--slug='))
const ONLY_SLUG = slugArg ? safeSlug(slugArg.slice('--slug='.length)) : ''
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const JOB_LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : Number.POSITIVE_INFINITY
const voiceArg = process.argv.find((arg) => arg.startsWith('--voice='))
const ONLY_VOICE = voiceArg ? voiceArg.slice('--voice='.length).trim() : ''
const MIN_MP3_BYTES = 5_000
const ALL_VOICES = [
  { key: 'fahed', azure: READING_VOICES.fahed.azure, suffix: '', label: 'فهد' },
  { key: 'noura', azure: READING_VOICES.noura.azure, suffix: '.noura', label: 'نورة' },
]
const VOICES = ONLY_VOICE ? ALL_VOICES.filter((voice) => voice.key === ONLY_VOICE) : ALL_VOICES

if (!(JOB_LIMIT > 0)) throw new Error('--limit يجب أن يكون رقماً موجباً')
if (ONLY_VOICE && !['fahed', 'noura'].includes(ONLY_VOICE)) throw new Error('--voice يجب أن يكون fahed أو noura')
if (FORCE_REGENERATE && !ONLY_SLUG) throw new Error('--force يتطلب --slug حتى لا يعيد توليد الأرشيف كله')

function loadEnvironment() {
  const values = { ...process.env }
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return values
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || values[match[1]]) continue
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return values
}

const env = loadEnvironment()
const AUDIO_PUBLIC_BASE_URL = (env.AUDIO_PUBLIC_BASE_URL || env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const USE_R2 = Boolean(AUDIO_PUBLIC_BASE_URL)
const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))

function safeSlug(value) {
  const slug = String(value || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(slug)) {
    throw new Error(`slug غير آمن للصوت: ${slug || '(فارغ)'}`)
  }
  return slug
}

function hasMp3Signature(buffer) {
  if (buffer.length < MIN_MP3_BYTES) return false
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return true
  const scan = Math.min(buffer.length - 1, 4_096)
  for (let index = 0; index < scan; index += 1) {
    if (buffer[index] === 0xff && (buffer[index + 1] & 0xe0) === 0xe0) return true
  }
  return false
}

const mp3ValidityCache = new Map()

function validLocalMp3(file) {
  if (!existsSync(file)) return false
  const stats = statSync(file)
  if (stats.size < MIN_MP3_BYTES) return false
  const cacheKey = `${file}:${stats.size}:${stats.mtimeMs}`
  if (mp3ValidityCache.has(cacheKey)) return mp3ValidityCache.get(cacheKey)
  const sample = Buffer.allocUnsafe(4_096)
  const descriptor = openSync(file, 'r')
  let bytesRead = 0
  try {
    bytesRead = readSync(descriptor, sample, 0, sample.length, 0)
  } finally {
    closeSync(descriptor)
  }
  const content = sample.subarray(0, bytesRead)
  let valid = hasMp3Signature(Buffer.concat([content, Buffer.alloc(Math.max(0, MIN_MP3_BYTES - content.length))]))
  if (valid) {
    const probe = spawnSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ], { encoding: 'utf8', timeout: 20_000 })
    if (probe.error?.code !== 'ENOENT') {
      const duration = Number(probe.stdout.trim())
      valid = probe.status === 0 && Number.isFinite(duration) && duration > 0
    }
  }
  mp3ValidityCache.set(cacheKey, valid)
  return valid
}

function validateMp3File(file) {
  if (!validLocalMp3(file)) throw new Error('Azure أعاد ملفاً لا يبدو MP3 صالحاً')
}

function atomicWrite(file, buffer) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(temporary, buffer)
    validateMp3File(temporary)
    renameSync(temporary, file)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function atomicCopy(from, to) {
  const temporary = `${to}.tmp-${process.pid}-${Date.now()}`
  try {
    copyFileSync(from, temporary)
    renameSync(temporary, to)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function atomicJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    renameSync(temporary, file)
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

function loadJson(file, fallback) {
  if (!existsSync(file)) return fallback
  return JSON.parse(readFileSync(file, 'utf8'))
}

function audioMeta() {
  return loadJson(AUDIO_META, {})
}

function writeAudioMeta(next) {
  atomicJson(AUDIO_META, Object.fromEntries(Object.entries(next).sort(([left], [right]) => left.localeCompare(right))))
}

function publicAudioUrl(fileName) {
  return AUDIO_PUBLIC_BASE_URL ? `${AUDIO_PUBLIC_BASE_URL}/${fileName}` : `/audio/${fileName}`
}

async function externalObjectExists(fileName, meta = audioMeta()) {
  if (!USE_R2) return false
  if (!meta[fileName]?.bytes) return false
  try {
    const response = await fetch(publicAudioUrl(fileName), { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

function durationSeconds(file) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8', timeout: 20_000 })
  if (probe.status !== 0) return null
  const seconds = Math.round(Number(probe.stdout.trim()))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

function auditPath(article, voice) {
  return resolve(AUDIO_AUDITS, `${article.slug}.${voice.key}.json`)
}

function generationDecision(article, voice, target, externalExists = false) {
  const auditFile = auditPath(article, voice)
  if (FORCE_REGENERATE) return { needed: true, reason: 'explicit_manual_regeneration', auditFile }
  const decision = readingNeedsGeneration({ article, voiceKey: voice.key, output: target, auditFile, externalExists })
  if (UPGRADE_EXISTING && decision.reason === 'legacy_last_known_good') {
    return { needed: true, reason: 'explicit_legacy_upgrade', auditFile }
  }
  return { ...decision, auditFile }
}

async function synthesizeHumanReading(article, voice, target) {
  const auditFile = auditPath(article, voice)
  return renderHumanReading({
    article,
    voiceKey: voice.key,
    output: target,
    auditFile,
    workRoot: AUDIO_WORK,
    lastKnownGoodDirectory: resolve(AUDIO_LAST_GOOD, article.slug, voice.key),
    quarantineDirectory: AUDIO_QUARANTINE,
    azureKey: env.AZURE_SPEECH_KEY,
    azureRegion: env.AZURE_SPEECH_REGION || 'uaenorth',
    geminiKey: env.GEMINI_API_KEY || env.GOOGLE_API_KEY || '',
    requireAudioJudge: !TECHNICAL_ONLY,
    minimumHumanScore: 95,
  })
}

function firestoreValue(value) {
  if (!value || typeof value !== 'object') return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('nullValue' in value) return null
  if (value.mapValue) return Object.fromEntries(
    Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, firestoreValue(child)]),
  )
  if (value.arrayValue) return (value.arrayValue.values || []).map(firestoreValue)
  return null
}

function firestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]))
}

function loadServiceAccount() {
  const path = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(path)) throw new Error('حساب الخدمة مفقود؛ اضبط FIREBASE_SERVICE_ACCOUNT أو استخدم --base-only')
  const account = JSON.parse(readFileSync(path, 'utf8'))
  if (!account.client_email || !account.private_key || !account.project_id) throw new Error('ملف حساب الخدمة غير صالح')
  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== account.project_id) {
    throw new Error('FIREBASE_PROJECT_ID لا يطابق حساب الخدمة')
  }
  return account
}

let serviceAccount
let accessTokenCache = { value: '', expiresAt: 0 }

async function accessToken() {
  if (accessTokenCache.value && accessTokenCache.expiresAt > Date.now() + 300_000) return accessTokenCache.value
  serviceAccount ||= loadServiceAccount()
  const now = Math.floor(Date.now() / 1_000)
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${base64({ alg: 'RS256', typ: 'JWT' })}.${base64({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })
  if (!response.ok) throw new Error(`تعذر توثيق حساب الخدمة (${response.status})`)
  const result = await response.json()
  if (!result.access_token) throw new Error('استجابة OAuth غير صالحة')
  accessTokenCache = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max(300, Number(result.expires_in) || 3_600) * 1_000,
  }
  return accessTokenCache.value
}

function projectId() {
  serviceAccount ||= loadServiceAccount()
  return env.FIREBASE_PROJECT_ID || serviceAccount.project_id
}

async function listCollection(name) {
  const documents = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '100' })
    if (pageToken) query.set('pageToken', pageToken)
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/${name}?${query}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    })
    if (!response.ok) throw new Error(`تعذر قراءة ${name} (${response.status})`)
    const result = await response.json()
    documents.push(...(result.documents || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return documents
}

async function patchSiteArticle(documentName, audio) {
  const response = await fetch(`https://firestore.googleapis.com/v1/${documentName}?updateMask.fieldPaths=audio`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { audio: { mapValue: { fields: Object.fromEntries(
      Object.entries(audio).map(([key, url]) => [key, { stringValue: url }]),
    ) } } } }),
  })
  if (!response.ok) throw new Error(`تعذر تحديث وثيقة المقال (${response.status})`)
}

function storageBucket() {
  const bucket = env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET
  if (!bucket || !/^[A-Za-z0-9._-]+$/.test(bucket)) throw new Error('FIREBASE_STORAGE_BUCKET مفقود أو غير صالح')
  return bucket
}

function storageObjectUrl(objectName) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket())}/o/${encodeURIComponent(objectName)}?alt=media`
}

async function storageObjectExists(objectName) {
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket())}/o/${encodeURIComponent(objectName)}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
  })
  if (response.status === 404) return false
  if (!response.ok) throw new Error(`تعذر فحص Storage (${response.status})`)
  return true
}

async function uploadStorageObject(objectName, buffer) {
  const query = new URLSearchParams({ name: objectName, uploadType: 'media' })
  const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket())}/o?${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'audio/mpeg',
    },
    body: buffer,
  })
  if (!response.ok) throw new Error(`تعذر رفع الصوت إلى Storage (${response.status})`)
}

function originalArticles() {
  const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
  /* النص المُشكَّل المخفيّ: ملفٌّ اختياري { slug: "النص المقال نفسه مُشكَّلاً بالكامل" }.
     يُقرأ للنطق وحده ولا يظهر للقارئ أبداً؛ وإن لم يوجد يعمل المقال بالتخمين كالمعتاد. */
  const vocalizedPath = resolve(ROOT, 'src/data/bodies-vocalized.json')
  const vocalized = existsSync(vocalizedPath) ? JSON.parse(readFileSync(vocalizedPath, 'utf8')) : {}
  const source = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const articleBlock = (source.match(/export const articles = \[([\s\S]*?)\n\]/) || ['', ''])[1]
  const titles = Object.fromEntries(
    [...articleBlock.matchAll(/slug: '([^']+)', title: '((?:\\'|[^'])+)'/g)]
      .map((match) => [match[1], match[2].replace(/\\'/g, "'")]),
  )
  return Object.entries(bodies).map(([slug, body]) => ({
    kind: 'original', slug: safeSlug(slug), title: titles[slug] || slug, body: String(body),
    bodyVocalized: typeof vocalized[slug] === 'string' ? vocalized[slug] : '',
  }))
}

async function loadRemoteContent(originals) {
  const [siteDocuments, overrideDocuments] = await Promise.all([
    listCollection('site_articles'),
    listCollection('content_overrides'),
  ])
  const overrideBySlug = new Map()
  for (const document of overrideDocuments) {
    const id = decodeURIComponent(document.name.split('/').pop() || '')
    if (!id.startsWith('article:')) continue
    overrideBySlug.set(id.slice('article:'.length), firestoreFields(document.fields))
  }
  const mergedOriginals = originals.flatMap((article) => {
    const override = overrideBySlug.get(article.slug)
    if (override?.hidden === true) return []
    const patch = override?.patch && typeof override.patch === 'object' ? override.patch : {}
    return [{
      ...article,
      title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : article.title,
      body: typeof patch.body === 'string' && patch.body.trim() ? patch.body.trim() : article.body,
      /* النص المُشكَّل المخفيّ يُقبل أيضاً من اللوحة (content_overrides.patch.bodyVocalized). */
      bodyVocalized: typeof patch.bodyVocalized === 'string' && patch.bodyVocalized.trim()
        ? patch.bodyVocalized.trim() : article.bodyVocalized,
    }]
  })
  const siteArticles = siteDocuments.flatMap((document) => {
    const fields = firestoreFields(document.fields)
    if (fields.hidden === true) return []
    if (['draft', 'generated', 'failed', 'under_review'].includes(String(fields.status || '').toLowerCase())) return []
    const body = fields.body || fields.text || fields.content
    if (typeof body !== 'string' || !body.trim()) return []
    return [{
      kind: 'site',
      documentName: document.name,
      slug: safeSlug(fields.slug || document.name.split('/').pop()),
      title: typeof fields.title === 'string' && fields.title.trim() ? fields.title.trim() : String(fields.slug || ''),
      excerpt: typeof fields.excerpt === 'string' ? fields.excerpt.trim() : '',
      date: typeof fields.date === 'string' ? fields.date : '',
      iso: typeof fields.iso === 'string' ? fields.iso : typeof fields.date === 'string' ? fields.date.slice(0, 10) : '',
      cat: typeof fields.cat === 'string' ? fields.cat : typeof fields.category === 'string' ? fields.category : '',
      body: body.trim(),
      /* النسخة المُشكَّلة القادمة من لوحة التحكم لا تُنشر كنص؛ تذهب للنطق فقط. */
      bodyVocalized: typeof fields.bodyVocalized === 'string' ? fields.bodyVocalized.trim() : '',
      currentAudio: fields.audio && typeof fields.audio === 'object' ? fields.audio : {},
    }]
  })
  return { originals: mergedOriginals, siteArticles }
}

function rebuildOriginalManifest(allOriginals) {
  const manifest = {}
  const meta = audioMeta()
  for (const article of allOriginals) {
    const voices = {}
    for (const voice of ALL_VOICES) {
      const fileName = `${article.slug}${voice.suffix}.mp3`
      const file = resolve(AUDIO_DIR, fileName)
      if ((USE_R2 && meta[fileName]?.bytes) || validLocalMp3(file)) voices[voice.key] = true
    }
    if (Object.keys(voices).length) manifest[article.slug] = voices
  }
  return Object.fromEntries(Object.entries(manifest).sort(([left], [right]) => left.localeCompare(right)))
}

function writeSiteArticlesFeed(articles) {
  const rows = articles
    .filter((article) => article.slug && article.title && article.iso)
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      iso: article.iso,
      date: article.date || article.iso,
      cat: article.cat || 'مقال',
      excerpt: article.excerpt || '',
      audio: article.currentAudio || {},
    }))
    .sort((left, right) => String(right.iso).localeCompare(String(left.iso)))
  atomicJson(SITE_FEED, rows)
}

async function processOriginals(articles, allOriginals, budget) {
  let generated = 0
  let missing = 0
  const missingArticles = new Set()
  if (!DRY_RUN) atomicJson(MANIFEST, rebuildOriginalManifest(allOriginals))
  for (const article of articles) {
    for (const voice of VOICES) {
      const fileName = `${article.slug}${voice.suffix}.mp3`
      const target = resolve(AUDIO_DIR, fileName)
      const publicTarget = resolve(PUBLIC_AUDIO_DIR, fileName)
      const externalExists = USE_R2 && await externalObjectExists(fileName)
      const decision = generationDecision(article, voice, target, externalExists)
      const existingAccepted = externalExists || validLocalMp3(target)
      if (existingAccepted && !decision.needed) {
        if (!DRY_RUN && !USE_R2 && !validLocalMp3(publicTarget)) {
          atomicCopy(target, publicTarget)
        }
        continue
      }
      missing += 1
      missingArticles.add(article.slug)
      console.log(`  ${DRY_RUN ? '○' : '◈'} أصل · ${voice.label} · ${article.title.slice(0, 55)}`)
      if (DRY_RUN || budget.used >= JOB_LIMIT) continue
      /* مقالة تفشل لا توقف القافلة: تُسجل بفشلها وتُتجاوز حتى لا يظل صف التوليد
         معلقاً ساعات على وحدة واحدة عصية (كان r002 يقتل كل التشغيلات المتتالية) */
      let audit
      try {
        audit = await synthesizeHumanReading(article, voice, target)
      } catch (error) {
        budget.used += 1
        console.error(`  ✘ ${article.slug} (${voice.label}): ${String(error.message).slice(0, 320)} — تُتجاوز وتستمر القافلة`)
        continue
      }
      if (!USE_R2) {
        atomicCopy(target, publicTarget)
      }
      atomicJson(MANIFEST, rebuildOriginalManifest(allOriginals))
      budget.used += 1
      generated += 1
      await sleep(600)
    }
  }
  return { generated, missing, missingArticles: missingArticles.size }
}

async function processSiteArticles(articles, budget) {
  let generated = 0
  let missing = 0
  const missingArticles = new Set()
  const pending = loadJson(PENDING_SITE_PATCHES, { schemaVersion: 1, items: [] })
  const pendingByDocument = new Map((pending.items || []).map((item) => [item.documentName, item]))
  for (const article of articles) {
    const audio = { ...(article.currentAudio || {}) }
    for (const voice of VOICES) {
      const fileName = `${article.slug}${voice.suffix}.mp3`
      const objectName = `site-content/audio/${fileName}`
      let exists = USE_R2 ? await externalObjectExists(fileName) : await storageObjectExists(objectName)
      const target = resolve(AUDIO_DIR, fileName)
      const decision = generationDecision(article, voice, target, exists)
      if (!exists || decision.needed) {
        missing += 1
        missingArticles.add(article.slug)
        console.log(`  ${DRY_RUN ? '○' : '◈'} مُضاف · ${voice.label} · ${article.title.slice(0, 55)}`)
        if (!DRY_RUN && budget.used < JOB_LIMIT) {
          const audit = await synthesizeHumanReading(article, voice, target)
          if (USE_R2) {
            // الرفع مسؤولية الناشر الذري وحده. يبقى الملف مرحلياً محلياً حتى تنجح كل البوابات.
          } else {
            await uploadStorageObject(objectName, readFileSync(target))
          }
          exists = true
          budget.used += 1
          generated += 1
          await sleep(600)
        }
      }
      if (exists) audio[voice.key] = USE_R2 ? publicAudioUrl(fileName) : storageObjectUrl(objectName)
    }
    if (!DRY_RUN && Object.keys(audio).length
      && (audio.fahed !== article.currentAudio.fahed || audio.noura !== article.currentAudio.noura)) {
      if (USE_R2) pendingByDocument.set(article.documentName, {
        documentName: article.documentName,
        slug: article.slug,
        audio,
        queuedAt: new Date().toISOString(),
      })
      else await patchSiteArticle(article.documentName, audio)
      article.currentAudio = audio
    }
  }
  if (!DRY_RUN && USE_R2) atomicJson(PENDING_SITE_PATCHES, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    items: [...pendingByDocument.values()],
  })
  if (!DRY_RUN) writeSiteArticlesFeed(articles)
  return { generated, missing, missingArticles: missingArticles.size }
}

if (!DRY_RUN) {
  mkdirSync(AUDIO_DIR, { recursive: true })
  mkdirSync(PUBLIC_AUDIO_DIR, { recursive: true })
}
const allOriginals = originalArticles()
let activeOriginals = allOriginals
let siteArticles = []
if (!BASE_ONLY) ({ originals: activeOriginals, siteArticles } = await loadRemoteContent(allOriginals))
if (ONLY_SLUG) {
  activeOriginals = activeOriginals.filter((article) => article.slug === ONLY_SLUG)
  siteArticles = siteArticles.filter((article) => article.slug === ONLY_SLUG)
  if (!activeOriginals.length && !siteArticles.length) throw new Error(`لم يُعثر على المقال: ${ONLY_SLUG}`)
}

const seen = new Set(activeOriginals.map((article) => article.slug))
for (const article of siteArticles) {
  if (seen.has(article.slug)) throw new Error(`slug مكرر بين الأصل وsite_articles: ${article.slug}`)
  seen.add(article.slug)
}

console.log(`الصوت الإنساني الدلالي ${HUMAN_READING_PIPELINE_HASH.slice(0, 10)}${DRY_RUN ? ' (فحص فقط)' : ''} · أصل ${activeOriginals.length} · مضاف ${siteArticles.length}`)
const budget = { used: 0 }
const originalResult = await processOriginals(activeOriginals, allOriginals, budget)
const siteResult = BASE_ONLY
  ? { generated: 0, missing: 0, missingArticles: 0 }
  : await processSiteArticles(siteArticles, budget)

if (!DRY_RUN) {
  const check = spawnSync(process.execPath, [resolve(ROOT, 'scripts/sync-audio.mjs'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    env: {
      ...process.env,
      AUDIO_PUBLIC_BASE_URL,
      VITE_AUDIO_BASE_URL: AUDIO_PUBLIC_BASE_URL,
    },
  })
  if (check.status !== 0) throw new Error(check.stderr.trim() || 'فشل التحقق من audio.json')
}

console.log(`✔ ناقص عند البدء ${originalResult.missingArticles + siteResult.missingArticles} مقالاً / ${originalResult.missing + siteResult.missing} ملفاً · وُلّد ${originalResult.generated + siteResult.generated}${budget.used >= JOB_LIMIT ? ' · بلغ حد --limit' : ''}`)
