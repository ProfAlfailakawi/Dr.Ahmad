#!/usr/bin/env node
/**
 * تقرير الجمعة الأسبوعي (أمر الدكتور ٢٠٢٦-٠٧-٢٣: «نفذهم كلهم»)
 *
 * يقرأ أرقام الأسبوع الحقيقية من Firestore بحساب الخدمة، ويصوغها رسالة
 * واتساب عربية أنيقة، ويكتبها JSON يرفعه سير العمل إلى R2 — ومنه يلتقطها
 * البوت المقيم على جهاز الدكتور فيسلّمها له في محادثته الذاتية.
 *
 * صرامة الخصوصية: أرقام مجمّعة فقط. لا اسم مراسل ولا بريد ولا نص رسالة —
 * عدّادات وعناوين مقالات منشورة أصلاً لا غير.
 */
import { createSign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const OUT_DIR = resolve(ROOT, 'build')
const OUT_FILE = resolve(OUT_DIR, 'weekly-report.json')

function loadServiceAccount() {
  const path = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  return JSON.parse(readFileSync(path, 'utf8'))
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

async function listCollection(name) {
  const documents = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '300' })
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

/* فك قيمة Firestore REST إلى قيمة عادية */
const fsValue = (value) => {
  if (value == null || typeof value !== 'object') return value
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return value.timestampValue
  return value
}
const field = (doc, name) => fsValue(doc?.fields?.[name])
const docId = (doc) => String(doc?.name || '').split('/').pop() || ''

const kuwaitDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(date)
const lastSevenDays = () => {
  const days = new Set()
  for (let back = 0; back < 7; back += 1) days.add(kuwaitDay(new Date(Date.now() - back * 86_400_000)))
  return days
}

async function main() {
  const days = lastSevenDays()
  const cutoffMs = Date.now() - 7 * 86_400_000

  const [views, messages, highlights] = await Promise.all([
    listCollection('views'),
    listCollection('messages').catch(() => []),
    listCollection('article_highlights').catch(() => []),
  ])

  let weekViews = 0
  let weekShares = 0
  let weekListens = 0
  const articleWeek = new Map()
  for (const doc of views) {
    const id = docId(doc)
    if (!id.startsWith('day:')) continue
    const day = id.slice(4, 14)
    if (!days.has(day)) continue
    const path = decodeURIComponent(id.slice(15))
    const count = Number(field(doc, 'count') || 0)
    if (path.startsWith('/_share')) { weekShares += count; continue }
    if (path.startsWith('/_listen')) { weekListens += count; continue }
    if (path.startsWith('/_')) continue
    weekViews += count
    if (path.startsWith('/articles/')) {
      const current = articleWeek.get(path) || { count: 0, title: '' }
      current.count += count
      current.title ||= String(field(doc, 'title') || '')
      articleWeek.set(path, current)
    }
  }
  const topArticles = [...articleWeek.values()].sort((a, b) => b.count - a.count).slice(0, 3)

  const weekMessages = messages.filter((doc) => {
    const created = field(doc, 'createdAt')
    return created && new Date(created).getTime() >= cutoffMs
  })
  const messageTopics = new Map()
  for (const doc of weekMessages) {
    const topic = String(field(doc, 'topic') || 'أخرى')
    messageTopics.set(topic, (messageTopics.get(topic) || 0) + 1)
  }

  const weekHighlights = highlights.filter((doc) => {
    const updated = field(doc, 'updatedAt')
    return updated && new Date(updated).getTime() >= cutoffMs
  })
  const highlightVotes = weekHighlights.reduce((sum, doc) => sum + Number(field(doc, 'count') || 0), 0)

  const western = (value) => Number(value).toLocaleString('en-US')
  const plural = (count, one, two, few, many) =>
    count === 1 ? one : count === 2 ? two : count <= 10 ? `${western(count)} ${few}` : `${western(count)} ${many}`

  const lines = []
  lines.push('*تقرير الجمعة — أسبوع موقعك في سطور*')
  lines.push('')
  lines.push(`القراءة: *${western(weekViews)}* مشاهدة خلال سبعة أيام${weekListens ? `، و${western(weekListens)} استماعاً` : ''}${weekShares ? `، و${western(weekShares)} مشاركة` : ''}.`)
  if (topArticles.length) {
    lines.push('')
    lines.push('*الأكثر قراءة هذا الأسبوع:*')
    topArticles.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || 'مقال'} — ${western(item.count)} مشاهدة`)
    })
  }
  if (weekHighlights.length) {
    lines.push('')
    lines.push(`رنين القراء: ${plural(weekHighlights.length, 'جملة واحدة ظُللت', 'جملتان ظُللتا', 'جمل ظُللت', 'جملة ظُللت')}${highlightVotes ? ` بمجموع ${western(highlightVotes)} تظليلاً` : ''}.`)
  }
  if (weekMessages.length) {
    lines.push('')
    const topicsLine = [...messageTopics.entries()].map(([topic, count]) => `${topic} (${western(count)})`).join(' · ')
    lines.push(`الرسائل الجديدة: *${western(weekMessages.length)}* — ${topicsLine}. تجدها في لوحة التحكم ← الجمهور ← الرسائل.`)
  } else {
    lines.push('')
    lines.push('لا رسائل جديدة هذا الأسبوع.')
  }
  lines.push('')
  lines.push('_تقرير آلي أسبوعي — أرقام حقيقية من موقعك، بلا أسماء ولا نصوص خاصة._')

  const report = {
    id: `weekly-${kuwaitDay(new Date())}`,
    generatedAt: new Date().toISOString(),
    text: lines.join('\n'),
    numbers: { weekViews, weekShares, weekListens, messages: weekMessages.length, highlights: weekHighlights.length, highlightVotes },
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`✔ تقرير الجمعة جاهز (${report.id}): ${western(weekViews)} مشاهدة · ${western(weekMessages.length)} رسالة · ${western(weekHighlights.length)} تظليل`)
  console.log(OUT_FILE)
}

await main()
