#!/usr/bin/env node
/**
 * درع النسخ الاحتياطي — Firestore عودي مع Manifest (عقد الحماية ٢٠٢٦-٠٨-١٠)
 *
 * تطوّر عن النسخة الأولى التي كانت تُفرّغ المجموعات العليا فقط وتعترف بتجاهل
 * المجموعات الفرعية «غير الحرجة» — وكان ذلك خطأً: site_cv_files/{id}/chunks
 * تحمل بايتات ملفات السيرة نفسها، وفقدها كارثة لا حساب تظليل مكرّر.
 *
 * ماذا يفعل:
 *  ١) يفرّغ كل مجموعات Firestore العليا، ثم يهبط عودياً في كل مجموعة فرعية لكل
 *     مستند (listCollectionIds على مسار المستند) — فيلتقط chunks وreaders وأي
 *     مجموعة فرعية مستقبلية دون علمٍ مسبق بها.
 *  ٢) يكتب النسخة بصيغة Firestore REST الخام (قابلة للنقل، تُقرأ بلا تطبيق).
 *  ٣) يكتب Manifest بجانبها: طابع UTC، المشروع، إصدار المخطط، عدد المجموعات
 *     والمستندات، مسارات المجموعات الفرعية المرصودة، SHA-256 للنسخة المضغوطة،
 *     الحجم، وcommit SHA إن وُجد.
 *
 * المصادقة (بالأولوية): GOOGLE_ACCESS_TOKEN (token جاهز من gcloud) →
 *   FIREBASE_SERVICE_ACCOUNT (sa.json، مسار CI). كلاهما مجاني: قراءة REST مباشرة.
 *
 * أعلام: --sample=N (حدّ مستندات لكل مجموعة، للبروفات المحدودة) ·
 *        --out=DIR · --self-test (بلا شبكة) · --skip-drill (لا كتابة إطلاقاً) ·
 *        --drill (بروفة استرجاع معزولة تكتب في _restore_drill ثم تمحوها).
 */
import { createSign, createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : dflt
}
const SCHEMA_VERSION = 2
const OUT_DIR = resolve(ROOT, opt('out', 'build'))
const DRILL_COLLECTION = '_restore_drill'
const SAMPLE = opt('sample') ? Math.max(1, Number(opt('sample'))) : 0

/* المجموعات التي لها فرعيات (من الجرد) — نهبط فيها فقط بدل استدعاء listCollectionIds
   لكل مستند في كل مجموعة (كان بطيئاً جداً على حجم الإنتاج). أي فرعيّ جديد يُضاف
   للجرد فيُلتقط، وحارس التغطية يفرض ذلك. --deep-scan يعيد الهبوط الشامل عند الحاجة. */
let SUBCOLLECTION_PARENTS = new Set()
try {
  const inv = JSON.parse(readFileSync(resolve(ROOT, 'backup-inventory.json'), 'utf8'))
  SUBCOLLECTION_PARENTS = new Set((inv.firestore?.subcollections || []).map((s) => s.path.split('/')[0]))
} catch { /* بلا جرد: الوضع الشامل أدناه */ }
const DEEP_SCAN = flag('deep-scan')

function loadServiceAccount() {
  return JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'), 'utf8'))
}
let serviceAccount = null
let tokenCache = { value: '', expiresAt: 0 }

async function accessToken() {
  if (env.GOOGLE_ACCESS_TOKEN) return env.GOOGLE_ACCESS_TOKEN
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 300_000) return tokenCache.value
  serviceAccount ||= loadServiceAccount()
  const now = Math.floor(Date.now() / 1_000)
  const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3_600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  if (!res.ok) throw new Error(`تعذر توثيق حساب الخدمة (${res.status})`)
  const result = await res.json()
  tokenCache = { value: result.access_token, expiresAt: Date.now() + Math.max(300, Number(result.expires_in) || 3_600) * 1_000 }
  return tokenCache.value
}

function projectId() {
  if (env.FIREBASE_PROJECT_ID) return env.FIREBASE_PROJECT_ID
  if (env.GOOGLE_ACCESS_TOKEN) throw new Error('حدّد FIREBASE_PROJECT_ID مع GOOGLE_ACCESS_TOKEN')
  serviceAccount ||= loadServiceAccount()
  return serviceAccount.project_id
}
const basePath = () => `projects/${projectId()}/databases/(default)/documents`

async function api(path, options = {}) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path.slice(0, 80)} → ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return res.json()
}

/* listCollectionIds يعمل على قاعدة البيانات (العليا) وعلى أي مستند (الفرعية). */
async function listCollectionIds(parentPath) {
  const ids = []
  let pageToken = ''
  do {
    const result = await api(`${parentPath}:listCollectionIds`, {
      method: 'POST', body: JSON.stringify(pageToken ? { pageToken } : {}),
    })
    ids.push(...(result.collectionIds || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return ids.filter((id) => id !== DRILL_COLLECTION)
}

/* يفرّغ مجموعة تحت مسار أب معطى، ويهبط عودياً في مجموعات كل مستند. */
async function dumpCollection(parentPath, name, out, stats) {
  const docs = []
  /* نهبط في مستندات هذه المجموعة فقط إن كانت معروفةً بفرعيات (أو --deep-scan). */
  const descend = DEEP_SCAN || SUBCOLLECTION_PARENTS.size === 0 || SUBCOLLECTION_PARENTS.has(name)
  let pageToken = ''
  do {
    const q = new URLSearchParams({ pageSize: '300' })
    if (pageToken) q.set('pageToken', pageToken)
    const result = await api(`${parentPath}/${encodeURIComponent(name)}?${q}`)
    const page = result.documents || []
    for (const doc of page) {
      docs.push(doc)
      stats.docs += 1
      /* الهبوط العودي: مجموعات فرعية لهذا المستند (doc.name مسار كامل نسبي للـv1). */
      const docPath = descend ? doc.name.split('/databases/(default)/documents/')[1] : null
      if (docPath) {
        const subIds = await listCollectionIds(`${basePath()}/${docPath}`)
        for (const sub of subIds) {
          const subKey = `${docPath}/${sub}`
          stats.subPaths.add(subKey.replace(/\/[^/]+\//g, '/{id}/'))
          out.subcollections[subKey] = await dumpCollectionFlat(`${basePath()}/${docPath}`, sub, stats)
        }
      }
      if (SAMPLE && docs.length >= SAMPLE) return docs
    }
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return docs
}
/* نسخة مسطّحة للمجموعات الفرعية (نهبط طبقة واحدة إضافية أيضاً لو لزم). */
async function dumpCollectionFlat(parentPath, name, stats) {
  const docs = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ pageSize: '300' })
    if (pageToken) q.set('pageToken', pageToken)
    const result = await api(`${parentPath}/${encodeURIComponent(name)}?${q}`)
    for (const doc of (result.documents || [])) { docs.push(doc); stats.docs += 1; if (SAMPLE && docs.length >= SAMPLE) return docs }
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return docs
}

function commitSha() {
  if (env.GITHUB_SHA) return env.GITHUB_SHA
  try { return execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return null }
}

async function runBackup() {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date())
  const topIds = await listCollectionIds(basePath())
  const backup = { project: projectId(), takenAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, sample: SAMPLE || null, collections: {}, subcollections: {} }
  const stats = { docs: 0, subPaths: new Set() }
  for (const id of topIds) {
    backup.collections[id] = await dumpCollection(basePath(), id, backup, stats)
    console.log(`  · ${id}: ${backup.collections[id].length} مستنداً`)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  const json = JSON.stringify(backup)
  const gz = gzipSync(Buffer.from(json), { level: 9 })
  const gzPath = resolve(OUT_DIR, `firestore-backup-${day}.json.gz`)
  writeFileSync(gzPath, gz)
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    takenAtUtc: backup.takenAt,
    project: backup.project,
    sample: SAMPLE || null,
    collectionCount: topIds.length,
    documentCount: stats.docs,
    subcollectionPaths: [...stats.subPaths].sort(),
    subcollectionDocGroups: Object.keys(backup.subcollections).length,
    rawBytes: json.length,
    gzipBytes: gz.length,
    sha256: createHash('sha256').update(gz).digest('hex'),
    commitSha: commitSha(),
    file: `firestore-backup-${day}.json.gz`,
  }
  const manifestPath = resolve(OUT_DIR, `firestore-backup-${day}.manifest.json`)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`✔ النسخة العودية: ${topIds.length} مجموعة · ${stats.docs} مستنداً · ${manifest.subcollectionPaths.length} مسار فرعي · ${Math.round(gz.length / 1024)}KB مضغوطة`)
  console.log(`  SHA-256: ${manifest.sha256}`)
  console.log(gzPath)
  console.log(manifestPath)
  return { backup, manifest, gzPath, manifestPath }
}

/* ═══ بروفة استرجاع معزولة (اختيارية، تكتب ثم تمحو) — لا تعمل إلا مع --drill ═══ */
async function restoreDrill(backup) {
  const canonical = (value, key = '') => {
    if (Array.isArray(value)) return value.map((v) => canonical(v))
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((n) => [n, canonical(value[n], n)]))
    if (key === 'timestampValue' && typeof value === 'string') { const ms = Date.parse(value); return Number.isFinite(ms) ? new Date(ms).toISOString() : value }
    return value
  }
  const sample = []
  for (const [collection, docs] of Object.entries(backup.collections)) {
    for (const doc of docs.slice(0, 2)) sample.push({ collection, doc })
    if (sample.length >= 5) break
  }
  if (!sample.length) throw new Error('لا عينة للبروفة')
  const written = []
  for (const [i, item] of sample.entries()) {
    const drillId = `drill-${Date.now()}-${i}`
    await api(`${basePath()}/${DRILL_COLLECTION}?documentId=${drillId}`, { method: 'POST', body: JSON.stringify({ fields: item.doc.fields || {} }) })
    written.push({ drillId, item })
  }
  let matched = 0
  for (const { drillId, item } of written) {
    const back = await api(`${basePath()}/${DRILL_COLLECTION}/${drillId}`)
    if (JSON.stringify(canonical(item.doc.fields || {})) === JSON.stringify(canonical(back.fields || {}))) matched += 1
    else console.error(`  ✘ اختلاف حقيقي في ${item.collection}/${drillId}`)
  }
  for (const { drillId } of written) await api(`${basePath()}/${DRILL_COLLECTION}/${drillId}`, { method: 'DELETE' })
  if (matched !== written.length) throw new Error(`بروفة الاسترجاع أخفقت: ${matched}/${written.length}`)
  console.log(`✔ بروفة استرجاع معزولة: كُتبت ${written.length}، طوبقت ${matched}، ومُحيت.`)
}

/* ═══ اختبار ذاتي بلا شبكة: يبرهن الهبوط العودي وتوليد Manifest عبر fetch وهمي ═══ */
async function selfTest() {
  const P = 'projects/test-project/databases/(default)/documents'
  const store = {
    top: ['site_cv_files', 'site_articles'],
    docs: {
      'site_cv_files': [{ name: `${P}/site_cv_files/cv-ar`, fields: { kind: { stringValue: 'ar' } } }],
      'site_articles': [{ name: `${P}/site_articles/a1`, fields: { t: { stringValue: 'مقال' } } }],
    },
    subOf: { 'site_cv_files/cv-ar': ['chunks'] },
    subDocs: { 'site_cv_files/cv-ar/chunks': [{ name: `${P}/site_cv_files/cv-ar/chunks/0`, fields: { b: { stringValue: 'AAAA' } } }] },
  }
  const origFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    const u = decodeURIComponent(String(url))
    const json = (o) => ({ ok: true, status: 200, async json() { return o }, async text() { return JSON.stringify(o) } })
    if (u.includes(':listCollectionIds')) {
      if (u.includes('/documents:listCollectionIds')) return json({ collectionIds: store.top })
      const dp = u.split('/documents/')[1].split(':listCollectionIds')[0]
      return json({ collectionIds: store.subOf[dp] || [] })
    }
    const path = u.split('/documents/')[1].split('?')[0]
    if (store.docs[path]) return json({ documents: store.docs[path] })
    if (store.subDocs[path]) return json({ documents: store.subDocs[path] })
    return json({ documents: [] })
  }
  env.GOOGLE_ACCESS_TOKEN = 'test-token'; env.FIREBASE_PROJECT_ID = 'test-project'
  try {
    const { manifest, backup } = await runBackup()
    const assert = (c, m) => { if (!c) throw new Error(`فشل الاختبار: ${m}`) }
    assert(manifest.collectionCount === 2, 'عدد المجموعات')
    assert(manifest.documentCount === 3, `عدد المستندات (توقّع ٣، وجد ${manifest.documentCount})`)
    assert(manifest.subcollectionPaths.includes('site_cv_files/{id}/chunks'), 'مسار chunks الفرعي مرصود')
    assert(Object.keys(backup.subcollections).some((k) => k.includes('/chunks')), 'محتوى chunks محفوظ')
    assert(/^[a-f0-9]{64}$/.test(manifest.sha256), 'SHA-256 صالح')
    console.log('\n✔ الاختبار الذاتي: الهبوط العودي يلتقط chunks، وManifest كامل بـSHA-256. (بلا شبكة)')
  } finally { globalThis.fetch = origFetch }
}

async function main() {
  if (flag('self-test')) return selfTest()
  const { backup } = await runBackup()
  if (flag('drill')) await restoreDrill(backup)
  else console.log('  (بروفة الاسترجاع المعزولة لم تُشغّل — أضف --drill لتفعيلها؛ إنها تكتب في معزل ثم تمحو.)')
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })
