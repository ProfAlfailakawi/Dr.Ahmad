#!/usr/bin/env node
/**
 * درع النسخ الاحتياطي (أمر الدكتور ٢٠٢٦-٠٧-٢٣)
 *
 * ١) يفرّغ كل مجموعات Firestore العليا مستنداً مستنداً إلى ملف JSON مضغوط —
 *    بصيغة Firestore الخام نفسها، فيصلح للاسترجاع الحرفي.
 * ٢) بروفة استرجاع حقيقية في كل تشغيلة: يأخذ عيّنة من النسخة، يكتبها في
 *    مجموعة تجارب معزولة «_restore_drill»، يقرؤها ويقارنها حرفياً، ثم يمحو
 *    آثار البروفة. فالاسترجاع عندنا مُبرهَن أسبوعياً لا مُفترَض.
 *
 * مجاني بالكامل: REST مباشر بحساب الخدمة — لا Google Cloud Storage ولا فوترة.
 * حدود معلومة بصدق: المجموعات الفرعية (عضويات القراء تحت article_highlight_members)
 * خارج النسخة — فقدها يعني فقط أن قارئاً قد يُحسب تظليله مرة ثانية؛ غير حرجة.
 */
import { createSign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const OUT_DIR = resolve(ROOT, 'build')
const DRILL_COLLECTION = '_restore_drill'

function loadServiceAccount() {
  return JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'), 'utf8'))
}

let serviceAccount
let tokenCache = { value: '', expiresAt: 0 }

async function accessToken() {
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 300_000) return tokenCache.value
  serviceAccount ||= loadServiceAccount()
  const now = Math.floor(Date.now() / 1_000)
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${base64({ alg: 'RS256', typ: 'JWT' })}.${base64({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  if (!response.ok) throw new Error(`تعذر توثيق حساب الخدمة (${response.status})`)
  const result = await response.json()
  tokenCache = { value: result.access_token, expiresAt: Date.now() + Math.max(300, Number(result.expires_in) || 3_600) * 1_000 }
  return tokenCache.value
}

const projectId = () => {
  serviceAccount ||= loadServiceAccount()
  return env.FIREBASE_PROJECT_ID || serviceAccount.project_id
}
const basePath = () => `projects/${projectId()}/databases/(default)/documents`
const api = async (path, options = {}) => {
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} → ${response.status}: ${(await response.text()).slice(0, 200)}`)
  return response.json()
}

async function listCollectionIds() {
  const ids = []
  let pageToken = ''
  do {
    const result = await api(`${basePath()}:listCollectionIds`, { method: 'POST', body: JSON.stringify(pageToken ? { pageToken } : {}) })
    ids.push(...(result.collectionIds || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return ids.filter((id) => id !== DRILL_COLLECTION)
}

async function dumpCollection(name) {
  const documents = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '300' })
    if (pageToken) query.set('pageToken', pageToken)
    const result = await api(`${basePath()}/${encodeURIComponent(name)}?${query}`)
    documents.push(...(result.documents || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return documents
}

/* ═══ بروفة الاسترجاع: عيّنة → كتابة معزولة → قراءة → مطابقة حرفية → محو ═══ */
async function restoreDrill(backup) {
  const sample = []
  for (const [collection, documents] of Object.entries(backup.collections)) {
    for (const doc of documents.slice(0, 2)) sample.push({ collection, doc })
    if (sample.length >= 5) break
  }
  if (!sample.length) throw new Error('لا عينة للبروفة — النسخة فارغة؟')

  const written = []
  for (const [index, item] of sample.entries()) {
    const drillId = `drill-${Date.now()}-${index}`
    await api(`${basePath()}/${DRILL_COLLECTION}?documentId=${drillId}`, {
      method: 'POST',
      body: JSON.stringify({ fields: item.doc.fields || {} }),
    })
    written.push({ drillId, item })
  }

  let matched = 0
  for (const { drillId, item } of written) {
    const readBack = await api(`${basePath()}/${DRILL_COLLECTION}/${drillId}`)
    const expected = JSON.stringify(item.doc.fields || {})
    const actual = JSON.stringify(readBack.fields || {})
    if (expected === actual) matched += 1
    else console.error(`  ✘ اختلاف في عينة ${item.collection}/${drillId}`)
  }

  for (const { drillId } of written) {
    await api(`${basePath()}/${DRILL_COLLECTION}/${drillId}`, { method: 'DELETE' })
  }

  if (matched !== written.length) throw new Error(`بروفة الاسترجاع أخفقت: تطابق ${matched}/${written.length}`)
  return { samples: written.length, matched }
}

async function main() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date())
  const collectionIds = await listCollectionIds()
  const backup = { project: projectId(), takenAt: new Date().toISOString(), day, collections: {} }
  let totalDocs = 0
  for (const id of collectionIds) {
    const documents = await dumpCollection(id)
    backup.collections[id] = documents
    totalDocs += documents.length
    console.log(`  · ${id}: ${documents.length} مستنداً`)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const json = JSON.stringify(backup)
  const gzPath = resolve(OUT_DIR, `firestore-backup-${day}.json.gz`)
  writeFileSync(gzPath, gzipSync(Buffer.from(json), { level: 9 }))
  console.log(`✔ النسخة: ${collectionIds.length} مجموعة · ${totalDocs} مستنداً · ${Math.round(json.length / 1024)}KB خاماً`)

  const drill = await restoreDrill(backup)
  console.log(`✔ بروفة الاسترجاع: كُتبت ${drill.samples} عينات في معزل، قُرئت وطُوبقت حرفياً ${drill.matched}/${drill.samples}، ومُحيت آثار البروفة`)
  console.log(gzPath)
}

await main()
