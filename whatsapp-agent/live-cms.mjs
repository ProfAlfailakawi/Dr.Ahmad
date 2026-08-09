/**
 * تحديث الأرشيف الحي لوكيل واتساب من Firestore العام.
 *
 * الهدف: لا ينتظر الوكيل إعادة تشغيل/نشر كي يرى مقالة أو بحثاً أو كتاباً أو
 * لقاءً نُشر من لوحة الموقع. نحفظ نفس لقطة Canonical CMS التي يستهلكها
 * content-index، ثم نعيد الفهرسة فقط إذا تغيّر checksum فعلاً.
 *
 * لا مفاتيح إدارية هنا: مفتاح Firebase Web عام أصلاً وقواعد Firestore تحكم
 * القراءة. أي فشل شبكي يترك آخر لقطة صحيحة كما هي ولا يمحو الأرشيف.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { CANONICAL_CMS_VERSION, CANONICAL_COLLECTIONS, canonicalCmsPath, readCanonicalCms } from '../scripts/canonical-cms.mjs'

const FIRESTORE_PROJECT = process.env.WHATSAPP_FIRESTORE_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'drahmad-8e9e2'
const FIRESTORE_KEY = process.env.WHATSAPP_FIRESTORE_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCoQijLO3VLX5gFLSNjDPulsU98CLoXb2M'
const PAGE_SIZE = 300
const REQUEST_TIMEOUT_MS = 10_000
const LIVE_TTL_MS = Math.max(60_000, Number(process.env.WHATSAPP_CMS_REFRESH_MS || 5 * 60 * 1000))
let inFlight = null
let lastFetch = 0

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return Boolean(value.booleanValue)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return String(value.timestampValue)
  if ('referenceValue' in value) return String(value.referenceValue)
  if ('bytesValue' in value) return String(value.bytesValue)
  if ('geoPointValue' in value) return value.geoPointValue
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue)
  if (value.mapValue) return decodeFields(value.mapValue.fields || {})
  return null
}

function decodeFields(fields) {
  const out = {}
  for (const [key, value] of Object.entries(fields || {})) out[key] = decodeValue(value)
  return out
}

function documentId(name) {
  const parts = String(name || '').split('/')
  return decodeURIComponent(parts[parts.length - 1] || '')
}

async function fetchCollection(collection) {
  const rows = []
  let pageToken = ''
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/${collection}`)
    url.searchParams.set('pageSize', String(PAGE_SIZE))
    url.searchParams.set('key', FIRESTORE_KEY)
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const options = typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
      : undefined
    const response = await fetch(url, options)
    if (!response.ok) throw new Error(`Firestore ${collection}: HTTP ${response.status}`)
    const payload = await response.json()
    for (const document of payload.documents || []) {
      const decoded = decodeFields(document.fields || {})
      rows.push({ id: documentId(document.name), ...decoded })
    }
    pageToken = String(payload.nextPageToken || '')
  } while (pageToken)
  return rows
}

function stablePayload(snapshot) {
  const collections = {}
  for (const key of Object.keys(CANONICAL_COLLECTIONS)) {
    collections[key] = [...(snapshot?.[key] || [])]
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
  }
  return JSON.stringify(collections)
}

function checksum(snapshot) {
  return crypto.createHash('sha256').update(stablePayload(snapshot)).digest('hex')
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, `${JSON.stringify(value)}\n`, 'utf8')
  JSON.parse(fs.readFileSync(temp, 'utf8'))
  fs.renameSync(temp, file)
}

export async function refreshLiveCanonicalCms(root, { force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastFetch < LIVE_TTL_MS) return { changed: false, skipped: true, reason: 'ttl' }
  if (inFlight) return inFlight
  lastFetch = now
  if (typeof fetch !== 'function') return { changed: false, skipped: true, reason: 'fetch-unavailable' }

  inFlight = (async () => {
    const previous = readCanonicalCms(root)
    const content = {}
    const results = await Promise.all(Object.entries(CANONICAL_COLLECTIONS).map(async ([key, name]) => [key, await fetchCollection(name)]))
    for (const [key, rows] of results) content[key] = rows
    const snapshot = {
      version: CANONICAL_CMS_VERSION,
      source: 'firestore-rest-live',
      projectId: FIRESTORE_PROJECT,
      generatedAt: new Date().toISOString(),
      ...content,
    }
    const before = checksum(previous)
    const after = checksum(snapshot)
    if (after === before) return { changed: false, skipped: false, checksum: after, counts: Object.fromEntries(Object.keys(CANONICAL_COLLECTIONS).map((key) => [key, content[key].length])) }
    atomicWrite(canonicalCmsPath(root), snapshot)
    return { changed: true, skipped: false, checksum: after, counts: Object.fromEntries(Object.keys(CANONICAL_COLLECTIONS).map((key) => [key, content[key].length])) }
  })().finally(() => { inFlight = null })
  return inFlight
}

export const LIVE_CMS_REFRESH_MS = LIVE_TTL_MS
