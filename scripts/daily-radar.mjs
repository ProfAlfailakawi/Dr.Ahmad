#!/usr/bin/env node
/**
 * «رادار المختارات» — التقاط يومي آلي من الإنترنت، بلا تدخل بشري.
 *
 * - المصدر مغلق على قائمة المؤسسات والمجلات الموجودة في editorial-policy.json.
 * - التصفية الميكانيكية تمنع الموضوعات غير المناسبة والمصادر غير المعتمدة.
 * - الاختيار لا يعتمد على Gemini؛ لذلك لا تتوقف المختارات عند غياب المفتاح أو ازدحام النموذج.
 * - Gemini يحسّن الصياغة العربية فقط عند توفره، مع بديل آمن لا يختلق أي معلومة.
 * - وثيقة واحدة كحد أقصى يوميًا في site_radar، والرابط الأصلي لا يكتبه النموذج.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { POLICY, evaluateCandidate } from './editorial-policy.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const decodeEntities = (value = '') => String(value)
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')

const strip = (value = '') => decodeEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseDate = (raw = '') => {
  const text = strip(raw)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function firstMatch(block, expressions) {
  for (const expression of expressions) {
    const match = block.match(expression)
    if (match?.[1]) return match[1]
  }
  return ''
}

export function parseFeed(xml, source) {
  const blocks = [...String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)]
    .slice(0, 14)
    .map((match) => match[0])

  return blocks.map((block) => {
    const rawLink = firstMatch(block, [
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i,
      /<link\b[^>]*>([\s\S]*?)<\/link>/i,
      /<guid\b[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i,
    ])
    let link = strip(rawLink)
    try { link = new URL(link, source.feedUrl).href } catch { link = '' }

    const description = firstMatch(block, [
      /<description\b[^>]*>([\s\S]*?)<\/description>/i,
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/i,
      /<content(?::encoded)?\b[^>]*>([\s\S]*?)<\/content(?::encoded)?>/i,
    ])
    const rawDate = firstMatch(block, [
      /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<published\b[^>]*>([\s\S]*?)<\/published>/i,
      /<updated\b[^>]*>([\s\S]*?)<\/updated>/i,
      /<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i,
    ])
    const publishedAt = parseDate(rawDate)

    return {
      source: source.name,
      title: strip(firstMatch(block, [/<title\b[^>]*>([\s\S]*?)<\/title>/i])),
      link,
      desc: strip(description).slice(0, 700),
      publishedAt,
    }
  }).filter((item) => item.title && item.link)
}

async function fetchFeed(source) {
  try {
    const response = await fetch(source.feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (alfailakawi-curated-radar/2.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      console.warn(`  ⚠ ${source.name}: HTTP ${response.status}`)
      return []
    }
    const items = parseFeed(await response.text(), source)
    console.log(`  • ${source.name}: ${items.length} مادة`)
    return items
  } catch (error) {
    console.warn(`  ⚠ ${source.name}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

const topicSignals = [
  'education', 'learning', 'school', 'teacher', 'student', 'university', 'classroom',
  'artificial intelligence', 'generative ai', 'ai ', 'edtech', 'literacy', 'curriculum',
  'تعليم', 'تعلم', 'مدرس', 'معلم', 'طالب', 'جامعة', 'ذكاء اصطناعي', 'تقنية', 'منهج',
]

function candidateScore(item) {
  const text = `${item.title} ${item.desc}`.toLocaleLowerCase('en')
  const signalScore = topicSignals.reduce((score, signal) => score + (text.includes(signal) ? 7 : 0), 0)
  const ageHours = item.publishedAt ? Math.max(0, (Date.now() - item.publishedAt.getTime()) / 3_600_000) : 240
  const freshnessScore = Math.max(0, 36 - Math.min(36, ageHours / 12))
  const detailScore = Math.min(12, item.desc.length / 55)
  return signalScore + freshnessScore + detailScore
}

function pickCandidate(items) {
  return [...items].sort((left, right) => candidateScore(right) - candidateScore(left))[0] || null
}

function safeSummary(item) {
  return {
    ar: `مادة حديثة موثوقة في التعليم والتقنية من ${item.source}`,
    arNote: 'اختارها الرادار لارتباطها المباشر بالتعليم أو التعلم أو الذكاء الاصطناعي. العنوان الأصلي والرابط يظهران كما نشرهما المصدر.',
    en: item.title,
    enNote: item.desc ? item.desc.slice(0, 220) : 'A recent item selected from a trusted education or technology source.',
    source: item.source,
    url: item.link,
    publishedAt: item.publishedAt?.toISOString() || '',
  }
}

async function geminiSummary(item) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
  if (!key) return safeSummary(item)
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest']

  const prompt = `أنت محرر أكاديمي لموقع أستاذ تكنولوجيا التعليم د. أحمد حسين الفيلكاوي.
لخّص المادة التالية من مصدر موثوق، من دون اختراع أي معلومة ومن دون تغيير الرابط أو اسم المصدر.
أعد JSON فقط:
{"ar":"عنوان عربي دقيق","arNote":"سطر عربي واحد يشرح لماذا تهم القارئ التربوي","enNote":"one short English line on why it matters"}

المصدر: ${item.source}
العنوان الأصلي: ${item.title}
الوصف: ${item.desc || 'لا يوجد وصف إضافي؛ التزم بالعنوان فقط.'}`

  let lastError = ''
  for (let round = 0; round < 2; round += 1) {
    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
          }),
          signal: AbortSignal.timeout(35_000),
        })
        if (!response.ok) {
          lastError = `${model} → ${response.status}`
          continue
        }
        const payload = await response.json()
        const output = JSON.parse(payload?.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
        const ar = String(output.ar || '').trim()
        const arNote = String(output.arNote || '').trim()
        const enNote = String(output.enNote || '').trim()
        if (ar.length < 12 || arNote.length < 20) throw new Error('صياغة قصيرة أو فارغة')
        return {
          ar: ar.slice(0, 210),
          arNote: arNote.slice(0, 320),
          en: item.title,
          enNote: (enNote || safeSummary(item).enNote).slice(0, 300),
          source: item.source,
          url: item.link,
          publishedAt: item.publishedAt?.toISOString() || '',
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }
    if (round === 0) await sleep(8_000)
  }
  console.warn(`  ⚠ تعذّر تحسين الصياغة بالذكاء الاصطناعي (${lastError}) — استخدمت البديل الآمن.`)
  return safeSummary(item)
}

async function firestoreToken() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`)
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'))
  const issuedAt = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  })
  if (!response.ok) throw new Error(`OAuth ${response.status}: ${(await response.text()).slice(0, 160)}`)
  return (await response.json()).access_token
}

const firestoreBase = () => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

async function todayAlreadyPublished(token, day) {
  const response = await fetch(`${firestoreBase()}/site_radar/${day}`, { headers: { Authorization: `Bearer ${token}` } })
  return response.ok
}

async function recentRadarUrls(token) {
  try {
    const response = await fetch(`${firestoreBase()}/site_radar?pageSize=60`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return new Set()
    const payload = await response.json()
    return new Set((payload.documents || []).map((document) => document.fields?.url?.stringValue).filter(Boolean))
  } catch { return new Set() }
}

async function publish(item, token, day) {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID مفقود')
  const values = { ...item, status: 'published', day, createdAt: new Date().toISOString() }
  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: String(value || '') }]))
  const response = await fetch(`${firestoreBase()}/site_radar/${day}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 220)}`)
}

function selfTest() {
  const fixture = `<?xml version="1.0"?><rss><channel><item><title>AI literacy for teachers</title><link>https://example.org/story</link><description>New education research for classroom learning.</description><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`
  const items = parseFeed(fixture, { name: 'Fixture', feedUrl: 'https://example.org/feed' })
  if (items.length !== 1 || !items[0].desc || !items[0].publishedAt) throw new Error('فشل اختبار قارئ RSS')
  const selected = pickCandidate(items)
  if (!selected || selected.link !== 'https://example.org/story') throw new Error('فشل اختبار الاختيار')
  console.log(JSON.stringify({ ok: true, sources: POLICY.allowedSources.length, parsed: items.length, selected: selected.title }, null, 2))
}

if (SELF_TEST) {
  selfTest()
  process.exit(0)
}

const day = new Date().toISOString().slice(0, 10)
console.log(`رادار المختارات · ${day} · ${POLICY.allowedSources.length} مصادر موثوقة\n`)

const token = await firestoreToken()
if (await todayAlreadyPublished(token, day)) {
  console.log(`✔ مختارة اليوم (${day}) منشورة أصلًا.`)
  process.exit(0)
}

const raw = (await Promise.all(POLICY.allowedSources.map(fetchFeed))).flat()
console.log(`\nالتقط ${raw.length} مادة خام`)

const recentUrls = await recentRadarUrls(token)
const pool = raw.filter((item) => {
  if (recentUrls.has(item.link)) return false
  if (item.publishedAt && Date.now() - item.publishedAt.getTime() > 21 * 86_400_000) return false
  return evaluateCandidate({
    source: item.source,
    url: item.link,
    title: item.title,
    summary: item.desc,
  }).allowed
})

console.log(`نجا من التحقق: ${pool.length} مادة`)
if (!pool.length) {
  console.log('⊘ لا توجد مادة حديثة وآمنة من القائمة الموثوقة الآن؛ سيعيد المجدول المحاولة لاحقًا اليوم.')
  process.exit(0)
}

const chosen = pickCandidate(pool)
const summary = await geminiSummary(chosen)
console.log(`اختار: ${chosen.title}\nالمصدر: ${chosen.source}\nالرابط: ${chosen.link}`)
await publish(summary, token, day)
console.log('\n✔ نُشرت مختارة الإنترنت في site_radar وتظهر فورًا في /curated')
