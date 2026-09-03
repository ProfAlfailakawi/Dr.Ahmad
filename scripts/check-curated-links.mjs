/**
 * فاحص روابط المختارات — أمر الدكتور: المختارات تحيل لمواقع خارجية قد تموت.
 * يفحص أسبوعياً روابط مصدرَي المختارات ويزيل الميّت مباشرةً:
 *   ١) site_radar (Firestore، مادة الرادار المُلتقطة آلياً) → يحذف الوثيقة الميتة.
 *   ٢) curatedBank (البنك الثابت في src/data-curated.ts) → يُدرج رابطه في قائمة
 *      src/data/curated-dead-links.json ليُصفّى وقت العرض (لا نعدّل ملف المصدر آلياً).
 *
 * أمان صارم ضد الحذف الخاطئ: لا يُحذف إلا عند 404/410 «قاطع» (المورد زال فعلاً)،
 * بعد محاولتَي HEAD ثم GET. أخطاء الشبكة/المهلة/5xx تُعدّ «غير مؤكدة» فلا تُحذف أبداً.
 */
import { createSign } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const env = process.env
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEAD_STORE = resolve(ROOT, 'src/data/curated-dead-links.json')
const SELF_TEST = process.argv.includes('--self-test')
const DRY_RUN = process.argv.includes('--dry-run')
const UA = 'Mozilla/5.0 (compatible; alfailakawi-link-check/1.0)'

/* تصنيف الرابط: 'dead' فقط عند 404/410 قاطع؛ 'alive' عند ردٍّ سليم؛ 'unknown'
   عند شبكة/مهلة/5xx (لا يُحذف عليها إطلاقاً). محاولتان قبل الحكم بعدم اليقين. */
export async function classifyLink(url, fetchImpl = fetch) {
  if (!/^https?:\/\//i.test(String(url || ''))) return 'unknown'
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
    try {
      let res = await fetchImpl(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': UA } })
      if ([403, 405, 501].includes(res.status)) {
        res = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': UA } })
      }
      clearTimeout(timer)
      if (res.status === 404 || res.status === 410) return 'dead'
      if (res.status < 400) return 'alive'
      return 'unknown' // 401/403/429/5xx — لا نحكم بالموت
    } catch {
      clearTimeout(timer)
      if (attempt === 2) return 'unknown'
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
  return 'unknown'
}

function curatedBankUrls() {
  try {
    const source = readFileSync(resolve(ROOT, 'src/data-curated.ts'), 'utf8')
    return [...new Set([...source.matchAll(/url:\s*'([^']+)'/g)].map((m) => m[1]).filter((u) => /^https?:\/\//i.test(u)))]
  } catch { return [] }
}

function loadDeadStore() {
  try { return existsSync(DEAD_STORE) ? JSON.parse(readFileSync(DEAD_STORE, 'utf8')) : {} } catch { return {} }
}
function saveDeadStore(map) {
  mkdirSync(dirname(DEAD_STORE), { recursive: true })
  writeFileSync(DEAD_STORE, `${JSON.stringify(map, null, 2)}\n`)
}

/* ---------- Firestore (نفس نمط daily-radar) ---------- */
async function firestoreToken() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`)
  const sa = JSON.parse(readFileSync(saPath, 'utf8'))
  const iat = Math.floor(Date.now() / 1000)
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  })
  if (!res.ok) throw new Error(`OAuth ${res.status}`)
  return (await res.json()).access_token
}
const firestoreBase = () => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

async function listRadar(token) {
  const out = []
  let pageToken = ''
  do {
    const url = `${firestoreBase()}/site_radar?pageSize=100${pageToken ? `&pageToken=${pageToken}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) break
    const payload = await res.json()
    for (const doc of payload.documents || []) out.push({ name: doc.name, url: doc.fields?.url?.stringValue || '' })
    pageToken = payload.nextPageToken || ''
  } while (pageToken)
  return out
}
async function deleteRadarDoc(token, name) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`حذف Firestore فشل ${res.status}`)
}

/* ---------- الاختبار الذاتي (بلا شبكة ولا Firestore) ---------- */
async function selfTest() {
  const fake = (map) => async (url) => ({ status: map[url] ?? 200 })
  const dead = await classifyLink('https://x.test/gone', fake({ 'https://x.test/gone': 404 }))
  const alive = await classifyLink('https://x.test/ok', fake({ 'https://x.test/ok': 200 }))
  const unknown = await classifyLink('https://x.test/flaky', fake({ 'https://x.test/flaky': 503 }))
  const bad = await classifyLink('not-a-url')
  if (dead !== 'dead') throw new Error('404 يجب أن يكون dead')
  if (alive !== 'alive') throw new Error('200 يجب أن يكون alive')
  if (unknown !== 'unknown') throw new Error('503 يجب أن يكون unknown (لا يُحذف)')
  if (bad !== 'unknown') throw new Error('رابط غير صالح = unknown')
  if (typeof curatedBankUrls !== 'function') throw new Error('قارئ البنك غير موجود')
  console.log('✓ اختبار فاحص روابط المختارات: 404→حذف · 200→إبقاء · 503/شبكة→لا يُحذف')
}

async function main() {
  if (SELF_TEST) { await selfTest(); return }
  let removedRadar = 0
  let removedBank = 0

  // ١) البنك الثابت → قائمة موتى تُصفّى وقت العرض
  const deadStore = loadDeadStore()
  const bankUrls = curatedBankUrls()
  for (const url of bankUrls) {
    const verdict = await classifyLink(url)
    if (verdict === 'dead') { if (!deadStore[url]) { deadStore[url] = new Date().toISOString(); removedBank += 1 } console.log(`  ✘ بنك ميّت: ${url}`) }
    else if (verdict === 'alive' && deadStore[url]) { delete deadStore[url]; console.log(`  ↺ عاد للحياة: ${url}`) }
  }
  // نُزيل من القائمة أي رابطٍ لم يعد في البنك أصلاً
  for (const url of Object.keys(deadStore)) if (!bankUrls.includes(url)) delete deadStore[url]
  if (!DRY_RUN) saveDeadStore(deadStore)

  // ٢) site_radar (Firestore) → حذف مباشر للميّت
  if (env.FIREBASE_PROJECT_ID && existsSync(resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'))) {
    const token = await firestoreToken()
    const docs = await listRadar(token)
    for (const doc of docs) {
      if (!doc.url) continue
      const verdict = await classifyLink(doc.url)
      if (verdict === 'dead') {
        console.log(`  ✘ رادار ميّت (يُحذف): ${doc.url}`)
        if (!DRY_RUN) await deleteRadarDoc(token, doc.name)
        removedRadar += 1
      }
    }
  } else {
    console.log('  ⓘ لا حساب خدمة/مشروع — تخطّي فحص site_radar (يعمل في التشغيل الآلي).')
  }

  console.log(`✔ اكتمل فحص روابط المختارات · بنك ميّت=${removedBank} · رادار محذوف=${removedRadar}${DRY_RUN ? ' (تجربة فقط)' : ''}`)
}

await main()
