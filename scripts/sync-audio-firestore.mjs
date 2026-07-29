#!/usr/bin/env node
/**
 * يجعل سجل الصوت الثابت في src/data/audio.json مرئياً فوراً للواجهة الحية.
 *
 * السبب: ملفات R2 قد تُنشر بنجاح ويُحدَّث audio.json، بينما لوحة التحكم تقرأ
 * CmsProvider الحي من Firestore. هذا الجسر يكتب حالة الصوت في المكان نفسه
 * الذي يراقبه الموقع: site_articles للمقالات الحية، وcontent_overrides
 * للمقالات الأصلية. لا يرفع ملفات صوت ولا يولّد شيئاً.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_FILE = resolve(ROOT, 'src/data/audio.json')
const BODIES_FILE = resolve(ROOT, 'src/data/bodies.json')
const FROM_R2 = process.argv.includes('--from-r2')
const PUBLIC_BASE = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

const objectMap = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const normalizeAudio = (value) => {
  if (value === true) return { fahed: true }
  const source = objectMap(value)
  const next = {}
  for (const key of ['fahed', 'noura', 'dialogue']) {
    if (typeof source[key] === 'boolean' || typeof source[key] === 'string') next[key] = source[key]
  }
  return next
}

const mergePublishedControl = (currentValue, audio, now) => {
  const current = { ...objectMap(currentValue) }
  const next = { ...current }
  if (audio.fahed || audio.noura) {
    Object.assign(next, {
      readingDisabled: false,
      readingStatus: 'published',
      readingUpdatedAt: current.readingStatus === 'published' && current.readingDisabled !== true ? current.readingUpdatedAt || now : now,
      readingMessage: '',
    })
  }
  if (audio.fahed) {
    Object.assign(next, {
      fahedDisabled: false,
      fahedStatus: 'published',
      fahedUpdatedAt: current.fahedStatus === 'published' && current.fahedDisabled !== true ? current.fahedUpdatedAt || now : now,
      fahedMessage: '',
    })
  }
  if (audio.noura) {
    Object.assign(next, {
      nouraDisabled: false,
      nouraStatus: 'published',
      nouraUpdatedAt: current.nouraStatus === 'published' && current.nouraDisabled !== true ? current.nouraUpdatedAt || now : now,
      nouraMessage: '',
    })
  }
  if (audio.dialogue) {
    Object.assign(next, {
      dialogueDisabled: false,
      dialogueStatus: 'published',
      dialogueUpdatedAt: current.dialogueStatus === 'published' && current.dialogueDisabled !== true ? current.dialogueUpdatedAt || now : now,
      dialogueMessage: '',
    })
  }
  return next
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const r2Candidates = (slug) => ({
  fahed: `${slug}.mp3`,
  noura: `${slug}.noura.mp3`,
  dialogue: `${slug}.dialogue.mp3`,
})

const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504])
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const remoteExists = async (name, attempts = 3) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(name)}`, {
        method: 'HEAD',
        cache: 'no-store',
      })
      if (response.status === 200 || response.status === 206) return true
      if (response.status === 404) return false
      if (!TRANSIENT_HTTP.has(response.status)) return null
    } catch { /* إعادة قصيرة؛ الانقطاع لا يُفسَّر على أنه حذف */ }
    if (attempt < attempts) await sleep(250 * attempt * attempt)
  }
  return null
}

async function discoverLiveR2(slugs, concurrency = 18) {
  const jobs = slugs.flatMap((slug) => Object.entries(r2Candidates(slug)).map(([voice, name]) => ({ slug, voice, name })))
  const found = new Map()
  let cursor = 0
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      if (await remoteExists(job.name) !== true) continue
      found.set(job.slug, { ...(found.get(job.slug) || {}), [job.voice]: true })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, jobs.length)) }, () => worker()))
  return found
}

if (process.argv.includes('--self-test')) {
  const audio = normalizeAudio({ fahed: true, dialogue: true, ignored: true })
  if (!audio.fahed || !audio.dialogue || 'ignored' in audio) throw new Error('normalizeAudio self-test failed')
  const control = mergePublishedControl({ dialogueDisabled: true, dialogueStatus: 'cleared' }, audio, '2026-01-01T00:00:00.000Z')
  if (control.dialogueDisabled !== false || control.dialogueStatus !== 'published' || control.fahedStatus !== 'published') throw new Error('control self-test failed')
  const candidates = r2Candidates('article-slug')
  if (candidates.fahed !== 'article-slug.mp3' || candidates.noura !== 'article-slug.noura.mp3' || candidates.dialogue !== 'article-slug.dialogue.mp3') throw new Error('R2 candidates self-test failed')
  console.log('✓ Audio Firestore sync self-test passed')
  process.exit(0)
}

if (!existsSync(AUDIO_FILE)) throw new Error('src/data/audio.json مفقود')
if (!existsSync(BODIES_FILE)) throw new Error('src/data/bodies.json مفقود')
const serviceAccountPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(serviceAccountPath)) throw new Error('حساب خدمة Firebase مفقود')

const manifestRaw = JSON.parse(readFileSync(AUDIO_FILE, 'utf8'))
const bodies = JSON.parse(readFileSync(BODIES_FILE, 'utf8'))
const manifest = new Map(Object.entries(objectMap(manifestRaw)).map(([slug, value]) => [slug, normalizeAudio(value)]).filter(([, audio]) => Object.keys(audio).length))
const baseSlugs = new Set(Object.keys(objectMap(bodies)))
if (FROM_R2) {
  if (!PUBLIC_BASE) throw new Error('AUDIO_PUBLIC_BASE_URL مفقود لمسح R2 الحي')
  const discovered = await discoverLiveR2([...baseSlugs])
  for (const [slug, audio] of discovered) manifest.set(slug, { ...objectMap(manifest.get(slug)), ...audio })
  console.log(`✓ مسح R2 الحي: اكتُشف صوتٌ لـ${discovered.size} مقالاً قبل تحديث اللوحة.`)
}
const account = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
if (!account.project_id || !account.client_email || !account.private_key) throw new Error('حساب خدمة Firebase غير صالح')
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID !== account.project_id) throw new Error('FIREBASE_PROJECT_ID لا يطابق حساب الخدمة')

const [{ initializeApp, cert }, { getFirestore, FieldValue }] = await Promise.all([
  import('firebase-admin/app'),
  import('firebase-admin/firestore'),
])
const app = initializeApp({ credential: cert(account), projectId: account.project_id })
const db = getFirestore(app)
const now = new Date().toISOString()
let baseUpdated = 0
let liveUpdated = 0
let unchanged = 0

const liveSnapshot = await db.collection('site_articles').get()
const liveBySlug = new Map(liveSnapshot.docs.map((doc) => [String(doc.data()?.slug || doc.id), doc]))

for (const [slug, manifestAudio] of manifest) {
  const liveDoc = liveBySlug.get(slug)
  if (liveDoc) {
    const current = liveDoc.data() || {}
    const nextAudio = { ...normalizeAudio(current.audio), ...manifestAudio }
    const nextControl = mergePublishedControl(current.audioControl, manifestAudio, now)
    if (same(normalizeAudio(current.audio), nextAudio) && same(objectMap(current.audioControl), nextControl)) {
      unchanged += 1
      continue
    }
    await liveDoc.ref.set({ audio: nextAudio, audioControl: nextControl, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    liveUpdated += 1
    continue
  }

  if (!baseSlugs.has(slug)) continue
  const ref = db.collection('content_overrides').doc(`article:${slug}`)
  const snapshot = await ref.get()
  const existing = snapshot.exists ? snapshot.data() || {} : {}
  const patch = { ...objectMap(existing.patch) }
  const nextAudio = { ...normalizeAudio(patch.audio), ...manifestAudio }
  const nextControl = mergePublishedControl(patch.audioControl, manifestAudio, now)
  if (same(normalizeAudio(patch.audio), nextAudio) && same(objectMap(patch.audioControl), nextControl)) {
    unchanged += 1
    continue
  }
  await ref.set({
    ...existing,
    patch: { ...patch, audio: nextAudio, audioControl: nextControl },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  baseUpdated += 1
}

const inventory = [...manifest.values()].reduce((summary, audio) => ({
  fahed: summary.fahed + Number(Boolean(audio.fahed)),
  noura: summary.noura + Number(Boolean(audio.noura)),
  dialogue: summary.dialogue + Number(Boolean(audio.dialogue)),
  readingArticles: summary.readingArticles + Number(Boolean(audio.fahed || audio.noura)),
}), { fahed: 0, noura: 0, dialogue: 0, readingArticles: 0 })
await db.collection('site_settings').doc('audio_inventory').set({
  ...inventory,
  totalAudioFiles: inventory.fahed + inventory.noura + inventory.dialogue,
  source: FROM_R2 ? 'r2-live-scan' : 'verified-audio-manifest',
  articleCount: manifest.size,
  lastSyncAt: FieldValue.serverTimestamp(),
}, { merge: true })

console.log(`✓ مزامنة الصوت الحي: ${baseUpdated} مقالاً أصلياً + ${liveUpdated} مقالاً حياً؛ ${unchanged} بلا تغيير. R2: فهد ${inventory.fahed} · نورة ${inventory.noura} · حوار ${inventory.dialogue}.`)
