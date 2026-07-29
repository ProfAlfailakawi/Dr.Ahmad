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
import { createHash, createHmac } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_FILE = resolve(ROOT, 'src/data/audio.json')
const BODIES_FILE = resolve(ROOT, 'src/data/bodies.json')
const FROM_R2 = process.argv.includes('--from-r2')
const PUBLIC_BASE = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const R2_BUCKET = String(process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || '').trim()
const R2_ENDPOINT = String(process.env.CLOUDFLARE_R2_ENDPOINT || '').replace(/\/+$/, '')
const R2_ACCESS_KEY = String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim()
const R2_SECRET_KEY = String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim()

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

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const hmac = (key, value, encoding) => createHmac('sha256', key).update(value).digest(encoding)
const awsEncode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
const xmlDecode = (value) => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')

function parseR2ListXml(xml) {
  const objects = new Map()
  for (const match of String(xml || '').matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1]
    const key = xmlDecode(block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] || '')
    const size = Number(block.match(/<Size>(\d+)<\/Size>/)?.[1] || 0)
    if (key) objects.set(key, { bytes: size })
  }
  const nextToken = xmlDecode(String(xml || '').match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] || '')
  return { objects, nextToken }
}

function signedR2ListRequest({ continuationToken = '', now = new Date() } = {}) {
  if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) return null
  const endpoint = new URL(R2_ENDPOINT)
  const pathname = `${endpoint.pathname.replace(/\/+$/, '')}/${awsEncode(R2_BUCKET)}` || '/'
  const parameters = [['list-type', '2'], ['max-keys', '1000']]
  if (continuationToken) parameters.push(['continuation-token', continuationToken])
  const canonicalQuery = parameters
    .map(([key, value]) => [awsEncode(key), awsEncode(value)])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = sha256('')
  const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = ['GET', pathname, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const scope = `${dateStamp}/auto/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const dateKey = hmac(`AWS4${R2_SECRET_KEY}`, dateStamp)
  const regionKey = hmac(dateKey, 'auto')
  const serviceKey = hmac(regionKey, 's3')
  const signingKey = hmac(serviceKey, 'aws4_request')
  const signature = hmac(signingKey, stringToSign, 'hex')
  const url = `${endpoint.origin}${pathname}?${canonicalQuery}`
  return {
    url,
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  }
}

async function listR2Objects() {
  const objects = new Map()
  let continuationToken = ''
  const seenTokens = new Set()
  for (let page = 0; page < 10_000; page += 1) {
    const request = signedR2ListRequest({ continuationToken })
    if (!request) return null
    const response = await fetch(request.url, { method: 'GET', headers: request.headers, cache: 'no-store' })
    if (!response.ok) throw new Error(`R2 ListObjectsV2 HTTP ${response.status}`)
    const parsed = parseR2ListXml(await response.text())
    for (const [key, value] of parsed.objects) objects.set(key, value)
    continuationToken = parsed.nextToken
    if (!continuationToken) return objects
    if (seenTokens.has(continuationToken)) throw new Error('R2 ListObjectsV2 أعاد رمز متابعة مكرراً')
    seenTokens.add(continuationToken)
  }
  throw new Error('R2 ListObjectsV2 تجاوز حد الأمان البالغ عشرة ملايين ملف')
}

const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504])
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const remoteExists = async (name, attempts = 5) => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${PUBLIC_BASE}/${encodeURIComponent(name)}`, {
        method: 'HEAD',
        cache: 'no-store',
      })
      if (response.status === 200 || response.status === 206) return true
      if (response.status === 404) return false
      if (!TRANSIENT_HTTP.has(response.status)) return null
      const retryAfter = Number(response.headers.get('retry-after') || 0)
      if (retryAfter > 0 && attempt < attempts) await sleep(Math.min(8_000, retryAfter * 1_000))
    } catch { /* إعادة قصيرة؛ الانقطاع لا يُفسَّر على أنه حذف */ }
    if (attempt < attempts) await sleep(700 * attempt * attempt)
  }
  return null
}

async function discoverLiveR2(slugs, concurrency = 6) {
  const jobs = slugs.flatMap((slug) => Object.entries(r2Candidates(slug)).map(([voice, name]) => ({ slug, voice, name })))
  const found = new Map()
  let cursor = 0
  let unknown = 0
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      const exists = await remoteExists(job.name)
      if (exists === true) found.set(job.slug, { ...(found.get(job.slug) || {}), [job.voice]: true })
      else if (exists === null) unknown += 1
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, jobs.length)) }, () => worker()))
  const objectCount = [...found.values()].reduce((sum, voice) => sum + Object.values(voice).filter(Boolean).length, 0)
  return { found, complete: unknown === 0, method: 'public-head-fallback', objectCount, unknown }
}

const inventoryFromObjects = (slugs, objects) => {
  const found = new Map()
  for (const slug of slugs) {
    const candidates = r2Candidates(slug)
    const audio = {}
    for (const [voice, name] of Object.entries(candidates)) {
      if (objects.has(name) && Number(objects.get(name)?.bytes || 0) > 0) audio[voice] = true
    }
    if (Object.keys(audio).length) found.set(slug, audio)
  }
  return found
}

if (process.argv.includes('--self-test')) {
  const audio = normalizeAudio({ fahed: true, dialogue: true, ignored: true })
  if (!audio.fahed || !audio.dialogue || 'ignored' in audio) throw new Error('normalizeAudio self-test failed')
  const control = mergePublishedControl({ dialogueDisabled: true, dialogueStatus: 'cleared' }, audio, '2026-01-01T00:00:00.000Z')
  if (control.dialogueDisabled !== false || control.dialogueStatus !== 'published' || control.fahedStatus !== 'published') throw new Error('control self-test failed')
  const candidates = r2Candidates('article-slug')
  if (candidates.fahed !== 'article-slug.mp3' || candidates.noura !== 'article-slug.noura.mp3' || candidates.dialogue !== 'article-slug.dialogue.mp3') throw new Error('R2 candidates self-test failed')
  const parsed = parseR2ListXml('<ListBucketResult><Contents><Key>a.mp3</Key><Size>321</Size></Contents><Contents><Key>b.noura.mp3</Key><Size>654</Size></Contents><NextContinuationToken>x&amp;y</NextContinuationToken></ListBucketResult>')
  if (parsed.objects.get('a.mp3')?.bytes !== 321 || parsed.objects.get('b.noura.mp3')?.bytes !== 654 || parsed.nextToken !== 'x&y') throw new Error('R2 ListObjects XML self-test failed')
  const indexed = inventoryFromObjects(['a', 'b'], parsed.objects)
  if (indexed.get('a')?.fahed !== true || indexed.get('b')?.noura !== true || indexed.get('a')?.noura) throw new Error('R2 inventory index self-test failed')
  console.log('✓ Audio Firestore sync self-test passed: manifest, R2 inventory parser, and control repair')
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
const inventoryRef = db.collection('site_settings').doc('audio_inventory')
let baseUpdated = 0
let liveUpdated = 0
let unchanged = 0

const liveSnapshot = await db.collection('site_articles').get()
const liveBySlug = new Map(liveSnapshot.docs.map((doc) => [String(doc.data()?.slug || doc.id), doc]))
const allSlugs = new Set([...baseSlugs, ...liveBySlug.keys()])
let liveScan = null

if (FROM_R2) {
  const hasSignedInventory = Boolean(R2_BUCKET && R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY)
  let signedFailure = ''
  if (hasSignedInventory) {
    try {
      const objects = await listR2Objects()
      const found = inventoryFromObjects(allSlugs, objects)
      liveScan = {
        found,
        complete: true,
        method: 'r2-signed-list',
        objectCount: objects.size,
        unknown: 0,
      }
      console.log(`✓ جرد R2 الموقّع: ${objects.size} ملفاً في الحاوية؛ طابَق ${found.size} مقالاً معروفاً.`)
    } catch (error) {
      signedFailure = error instanceof Error ? error.message : String(error)
      console.warn(`⚠ تعذّر جرد R2 الموقّع: ${signedFailure}`)
    }
  }

  if (!liveScan && PUBLIC_BASE) {
    liveScan = await discoverLiveR2([...allSlugs])
    console.log(`✓ فحص R2 الاحتياطي: ${liveScan.objectCount} ملفاً مطابقاً؛ ${liveScan.unknown} نتيجة غير محسومة.`)
  }

  if (!liveScan) {
    liveScan = {
      found: new Map(),
      complete: false,
      method: hasSignedInventory ? 'r2-signed-list-failed' : 'r2-credentials-missing',
      objectCount: 0,
      unknown: allSlugs.size * 3,
    }
  }

  if (!liveScan.complete) {
    const scanMessage = signedFailure
      ? `تعذّر الجرد الموقّع، وبقي ${liveScan.unknown} ملفاً غير محسوم في الفحص الاحتياطي: ${signedFailure}`
      : `لم يكتمل جرد R2؛ بقي ${liveScan.unknown} ملفاً غير محسوم.`
    await inventoryRef.set({
      lastAttemptComplete: false,
      scanMethod: liveScan.method,
      scanMessage,
      unknownObjects: liveScan.unknown,
      lastAttemptAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    throw new Error(`${scanMessage} حُفظ آخر عدّاد صحيح ولم تُكتب نتيجة ناقصة.`)
  }

  // الجرد الكامل هو مصدر الحقيقة: نستبدل اللقطة القديمة ولا ندمجها كي
  // لا تبقى ملفات محذوفة أو أرقام متقادمة في لوحة التحكم.
  manifest.clear()
  for (const [slug, discoveredAudio] of liveScan.found) manifest.set(slug, discoveredAudio)
}

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
const bySlug = Object.fromEntries([...allSlugs].map((slug) => {
  const item = normalizeAudio(manifest.get(slug))
  return [slug, {
    fahed: Boolean(item.fahed),
    noura: Boolean(item.noura),
    dialogue: Boolean(item.dialogue),
  }]
}))
await inventoryRef.set({
  ...inventory,
  totalAudioFiles: inventory.fahed + inventory.noura + inventory.dialogue,
  source: FROM_R2 ? 'r2-authoritative-inventory' : 'verified-audio-manifest',
  scanVersion: 2,
  scanComplete: FROM_R2 ? liveScan?.complete === true : false,
  lastAttemptComplete: FROM_R2 ? liveScan?.complete === true : false,
  scanMethod: FROM_R2 ? liveScan?.method || 'r2-live-scan' : 'verified-audio-manifest',
  scanMessage: '',
  unknownObjects: 0,
  objectCount: FROM_R2 ? Number(liveScan?.objectCount || 0) : inventory.fahed + inventory.noura + inventory.dialogue,
  articleCount: allSlugs.size,
  expectedAudioObjects: allSlugs.size * 3,
  bySlug,
  lastAttemptAt: FieldValue.serverTimestamp(),
  lastSyncAt: FieldValue.serverTimestamp(),
}, { merge: true })

console.log(`✓ مزامنة الصوت الحي: ${baseUpdated} مقالاً أصلياً + ${liveUpdated} مقالاً حياً؛ ${unchanged} بلا تغيير. R2: فهد ${inventory.fahed} · نورة ${inventory.noura} · حوار ${inventory.dialogue}.`)
