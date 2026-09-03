import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { CANONICAL_CMS_VERSION, CANONICAL_COLLECTIONS, canonicalCmsPath, emptyCanonicalCms } from './canonical-cms.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = canonicalCmsPath(root)

function serializable(value) {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(serializable)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializable(item)]))
  return String(value)
}

function writeVerified(payload) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  const text = `${JSON.stringify(payload)}\n`
  const temporary = `${target}.${process.pid}.tmp`
  fs.writeFileSync(temporary, text)
  const parsed = JSON.parse(fs.readFileSync(temporary, 'utf8'))
  if (parsed.version !== CANONICAL_CMS_VERSION) throw new Error('فشل التحقق من نسخة Canonical CMS بعد الكتابة.')
  fs.renameSync(temporary, target)
  return crypto.createHash('sha256').update(text).digest('hex')
}

const saFile = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
const inline = String(process.env.GOOGLE_SA_JSON || '').trim()
const required = process.env.REQUIRE_PANEL_DECISIONS === '1' || process.argv.includes('--required')

if (!inline && (!saFile || !fs.existsSync(path.resolve(root, saFile)))) {
  if (required) {
    console.error('✘ Canonical CMS: بناء النشر يحتاج FIREBASE_SERVICE_ACCOUNT أو GOOGLE_SA_JSON.')
    process.exit(1)
  }
  const payload = { ...emptyCanonicalCms(), generatedAt: new Date().toISOString(), source: 'unavailable-local-build' }
  const sha256 = writeVerified(payload)
  console.log(`Canonical CMS: local empty snapshot (${sha256.slice(0, 12)}).`)
  process.exit(0)
}

try {
  const [{ initializeApp, cert, getApps }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const credentials = inline
    ? JSON.parse(inline)
    : JSON.parse(fs.readFileSync(path.resolve(root, saFile), 'utf8'))
  const projectId = String(process.env.FIREBASE_PROJECT_ID || credentials.project_id || '').trim()
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID غير معروف.')
  const app = getApps()[0] || initializeApp({ credential: cert(credentials), projectId })
  const db = getFirestore(app)
  const entries = await Promise.all(Object.entries(CANONICAL_COLLECTIONS).map(async ([key, name]) => {
    const snapshot = await db.collection(name).get()
    const rows = snapshot.docs.map((document) => serializable({ id: document.id, ...document.data() }))
    return [key, rows]
  }))
  const payload = {
    version: CANONICAL_CMS_VERSION,
    generatedAt: new Date().toISOString(),
    projectId,
    source: 'firestore',
    ...Object.fromEntries(entries),
  }
  const sha256 = writeVerified(payload)
  console.log(`Canonical CMS: ${payload.articles.length} articles · ${payload.books.length} books · ${payload.papers.length} papers · ${payload.media.length} media · ${payload.overrides.length} overrides · ${sha256.slice(0, 12)}.`)
} catch (error) {
  console.error(`✘ Canonical CMS sync failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}
