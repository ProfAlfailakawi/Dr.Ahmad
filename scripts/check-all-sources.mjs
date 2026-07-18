#!/usr/bin/env node
/**
 * فاحص المصادر الشامل — كل رابط في الموقع، لا المختارات وحدها.
 *
 * الفاحص السابق كان يرى ٣٧ رابطاً من ٢٣٢: الرادار وبنك المختارات فقط، ويحذف
 * الميّت بصمتٍ بلا تقرير. فكان الدكتور يسأل «أي مصدر تالف ولماذا؟» فلا جواب.
 *
 * هذا يفحص كل مصدرٍ في الموقع (مقالات، أبحاث، كتب، إعلام، مختارات، رادار،
 * لقاءات، ومجموعات Firestore)، ويكتب تقريراً تفصيلياً في `site_health/latest`
 * تقرؤه اللوحة: أين الرابط، ولماذا سقط، ومتى فُحص، وما اقتراح العلاج.
 *
 * لا يحذف شيئاً: القرار للدكتور. الحذف الآلي يبقى في فاحص المختارات القديم
 * وحده (وهو محكوم بقاعدة 404 فقط).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const SELF_TEST = process.argv.includes('--self-test')
const TIMEOUT_MS = Number(env.SOURCE_CHECK_TIMEOUT_MS || 12000)
const CONCURRENCY = Number(env.SOURCE_CHECK_CONCURRENCY || 6)

/* ═══ جمع الروابط من كل مصادر الموقع ═══ */
const linkPattern = /(source|url|link|pdf|cover):\s*'(https?:\/\/[^']+)'/g

function harvestFromFile(file, kind) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  const found = []
  for (const match of text.matchAll(linkPattern)) {
    const url = match[2]
    /* عنوان المادة الحاضنة: نبحث لأعلى عن أقرب title/ar لنسمّي العطب باسمه */
    const before = text.slice(Math.max(0, match.index - 900), match.index)
    const title = [...before.matchAll(/(?:title|ar):\s*'((?:[^'\\]|\\.)*)'/g)].at(-1)?.[1] || ''
    const slug = [...before.matchAll(/slug:\s*'([^']+)'/g)].at(-1)?.[1] || ''
    found.push({ url, kind, title: title.slice(0, 90), slug, where: file })
  }
  return found
}

async function harvestFirestore() {
  if (!env.FIREBASE_SERVICE_ACCOUNT && !env.GOOGLE_APPLICATION_CREDENTIALS) return []
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) return []
  const { initializeApp, cert, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
  const db = getFirestore(app)
  const collections = [
    ['site_radar', 'رادار'], ['site_picks', 'مختارات'], ['site_media', 'إعلام'],
    ['site_papers', 'بحث'], ['site_articles', 'مقال'], ['site_upcoming', 'لقاء'],
  ]
  const found = []
  for (const [name, kind] of collections) {
    const snapshot = await db.collection(name).get().catch(() => null)
    if (!snapshot) continue
    snapshot.forEach((document) => {
      const data = document.data()
      const url = String(data.url || data.source || data.link || '')
      if (/^https?:\/\//.test(url)) {
        found.push({ url, kind, title: String(data.title || data.ar || '').slice(0, 90), slug: document.id, where: name })
      }
    })
  }
  return found
}

/* ═══ فحص رابط واحد: نميّز الميت الحقيقي من العطل العابر ═══ */
async function probe(url) {
  const attempt = async (method) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlfailakawiSourceCheck/1.0)' },
      })
      return { status: response.status, finalUrl: response.url }
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    let result = await attempt('HEAD')
    /* كثير من الخوادم ترفض HEAD (405/403) وهي حيّة — نعيد بـGET قبل الحكم */
    if (result.status === 405 || result.status === 403 || result.status === 501) {
      result = await attempt('GET')
    }
    const { status, finalUrl } = result
    if (status >= 200 && status < 400) {
      const redirected = finalUrl && new URL(finalUrl).host !== new URL(url).host
      return { state: 'ok', status, note: redirected ? `يحوّل إلى ${new URL(finalUrl).host}` : '', finalUrl }
    }
    if (status === 404 || status === 410) return { state: 'dead', status, note: 'الصفحة غير موجودة عند المصدر' }
    if (status === 401 || status === 403) return { state: 'blocked', status, note: 'المصدر يمنع الفحص الآلي — قد يعمل في المتصفح' }
    if (status === 429) return { state: 'throttled', status, note: 'المصدر يحدّ الطلبات — يُعاد فحصه لاحقاً' }
    if (status >= 500) return { state: 'server', status, note: 'عطل مؤقت في خادم المصدر' }
    return { state: 'suspect', status, note: `استجابة غير متوقعة (${status})` }
  } catch (error) {
    const message = String(error?.message || error)
    if (/abort|timeout/i.test(message)) return { state: 'timeout', status: 0, note: `تجاوز ${Math.round(TIMEOUT_MS / 1000)} ثوانٍ بلا رد` }
    return { state: 'unreachable', status: 0, note: `تعذّر الوصول: ${message.slice(0, 80)}` }
  }
}

/* الأحوال التي تستدعي قرار الدكتور فعلاً (لا العابر منها) */
const NEEDS_ATTENTION = new Set(['dead', 'unreachable', 'suspect'])
const ADVICE = {
  dead: 'الرابط ميت فعلاً — استبدله أو احذف المادة.',
  unreachable: 'النطاق نفسه لا يستجيب — ربما انتهى تسجيله.',
  suspect: 'استجابة غريبة — افتحه بنفسك للتأكد.',
  blocked: 'المصدر يحجب الفاحص الآلي؛ غالباً يعمل عندك في المتصفح.',
  throttled: 'المصدر حدّ الطلبات مؤقتاً — سيُفحص في الجولة القادمة.',
  server: 'عطل مؤقت عند المصدر — لا تتسرع بالحذف.',
  timeout: 'بطء شديد أو حجب — يُعاد فحصه في الجولة القادمة.',
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current], current)
    }
  }))
  return results
}

if (SELF_TEST) {
  const cases = [
    [{ state: 'dead' }, true], [{ state: 'blocked' }, false],
    [{ state: 'throttled' }, false], [{ state: 'server' }, false],
    [{ state: 'unreachable' }, true], [{ state: 'ok' }, false],
  ]
  for (const [probeResult, shouldFlag] of cases) {
    if (NEEDS_ATTENTION.has(probeResult.state) !== shouldFlag) {
      console.error(`✘ تصنيف خاطئ لحالة ${probeResult.state}`)
      process.exit(1)
    }
  }
  console.log('✓ اختبار الفاحص الشامل: 404/نطاق ميت → يُبلَّغ · 403/429/5xx/مهلة → لا يُبلَّغ عنه كعطب')
  process.exit(0)
}

/* ═══ التشغيل ═══ */
const harvested = [
  ...harvestFromFile('src/data.ts', 'محتوى'),
  ...harvestFromFile('src/data-curated.ts', 'مختارات'),
  ...harvestFromFile('src/data-en.ts', 'إنجليزي'),
  ...(await harvestFirestore()),
]

/* رابط واحد قد يتكرر في مواضع — نفحصه مرة ونذكر كل مواضعه */
const byUrl = new Map()
for (const item of harvested) {
  const entry = byUrl.get(item.url) || { url: item.url, places: [] }
  entry.places.push({ kind: item.kind, title: item.title, slug: item.slug, where: item.where })
  byUrl.set(item.url, entry)
}
const unique = [...byUrl.values()]
console.log(`فحص ${unique.length} رابطاً فريداً من ${harvested.length} موضعاً في الموقع…`)

let done = 0
const checked = await mapWithLimit(unique, CONCURRENCY, async (entry) => {
  const result = await probe(entry.url)
  done += 1
  if (done % 25 === 0) console.log(`  … ${done}/${unique.length}`)
  return { ...entry, ...result, advice: ADVICE[result.state] || '' }
})

const problems = checked.filter((item) => NEEDS_ATTENTION.has(item.state))
const warnings = checked.filter((item) => !NEEDS_ATTENTION.has(item.state) && item.state !== 'ok')
const summary = {
  checkedAt: new Date().toISOString(),
  total: unique.length,
  places: harvested.length,
  ok: checked.filter((item) => item.state === 'ok').length,
  problems: problems.length,
  warnings: warnings.length,
  items: [...problems, ...warnings].slice(0, 200).map((item) => ({
    url: item.url,
    state: item.state,
    status: item.status,
    note: item.note,
    advice: item.advice,
    places: item.places.slice(0, 3),
  })),
}

console.log(`\n✔ سليمة: ${summary.ok} · تحتاج قرارك: ${summary.problems} · تنبيهات عابرة: ${summary.warnings}`)
for (const item of problems.slice(0, 20)) {
  const place = item.places[0] || {}
  console.log(`  ✘ [${item.state}] ${place.kind || ''} «${(place.title || place.slug || '').slice(0, 50)}»\n     ${item.url}\n     ${item.note}`)
}

/* التقرير إلى Firestore كي تقرأه اللوحة وتعرضه مفصّلاً */
const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (existsSync(saPath)) {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
  await getFirestore(app).collection('site_health').doc('sources').set(summary)
  console.log('\n✓ كُتب التقرير التفصيلي في site_health/sources — تقرؤه اللوحة.')
}

process.exit(0)
