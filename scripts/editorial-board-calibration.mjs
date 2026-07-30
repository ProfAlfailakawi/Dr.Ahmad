#!/usr/bin/env node
/**
 * حلقة معايرة مجلس التحرير — 7 و30 يوماً.
 *
 * لا تنشر ولا تعدّل المقالات. تقرأ فقط سجل مجلس التحرير + site_articles +
 * عدادات views المجمعة، ثم تكتب القياس داخل وثيقة القرار الداخلية نفسها.
 * لا بيانات شخصية ولا ادعاء Machine Learning؛ مجرد calibration تدريجي قابل للتدقيق.
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DAY_MS = 86_400_000
const env = process.env

export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(Number(value) || 0)))

export function decodeFirestoreValue(value) {
  if (!value || typeof value !== 'object') return value
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return Boolean(value.booleanValue)
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(decodeFirestoreValue)
  if ('mapValue' in value) return decodeFirestoreFields(value.mapValue?.fields || {})
  return null
}

export function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)]))
}

export function encodeFirestoreValue(value) {
  if (value == null) return { nullValue: null }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeFirestoreValue) } }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encodeFirestoreValue(item)])) } }
  return { stringValue: String(value) }
}

export function parsePublicationAt(article, now = new Date()) {
  const scheduledAt = String(article?.scheduledAt || '').trim()
  const status = String(article?.status || 'published')
  const scheduledValue = /(?:Z|[+-]\d\d:\d\d)$/i.test(scheduledAt) ? scheduledAt : scheduledAt ? `${scheduledAt}${/T\d{2}:\d{2}:\d{2}$/.test(scheduledAt) ? '+03:00' : ':00+03:00'}` : ''
  const scheduledMs = scheduledValue ? Date.parse(scheduledValue) : NaN
  const isLive = status === 'published' || (!status) || (status === 'scheduled' && Number.isFinite(scheduledMs) && scheduledMs <= now.getTime())
  if (!isLive || status === 'draft') return null

  const candidates = [
    article?.publishedAt,
    Number.isFinite(scheduledMs) ? new Date(scheduledMs).toISOString() : '',
    article?.iso ? `${String(article.iso).slice(0, 10)}T00:00:00+03:00` : '',
    article?.createdAt,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const ms = Date.parse(String(candidate))
    if (Number.isFinite(ms) && ms <= now.getTime() + 60_000) return new Date(ms)
  }
  return null
}

export function kuwaitDay(date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

export function windowDaysFrom(publicationAt, span) {
  const start = new Date(publicationAt)
  return Array.from({ length: span }, (_, index) => kuwaitDay(new Date(start.getTime() + index * DAY_MS)))
}

export function buildViewIndex(documents) {
  const daily = new Map()
  const articlePaths = new Set()
  for (const document of documents) {
    const id = String(document.id || '')
    const data = document.data || document
    const count = Math.max(0, Number(data.count || 0))
    if (id.startsWith('total:')) {
      try {
        const path = decodeURIComponent(id.slice(6))
        if (path.startsWith('/articles/')) articlePaths.add(path)
      } catch { /* ignore malformed analytics ids */ }
      continue
    }
    if (!id.startsWith('day:') || id[14] !== ':') continue
    const day = id.slice(4, 14)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    try {
      const path = decodeURIComponent(id.slice(15))
      if (!path.startsWith('/articles/')) continue
      articlePaths.add(path)
      daily.set(`${day}|${path}`, count)
    } catch { /* ignore malformed analytics ids */ }
  }
  return { daily, articlePaths }
}

export function measureWindow(viewIndex, articlePath, publicationAt, span, measuredAt = new Date()) {
  const days = windowDaysFrom(publicationAt, span)
  const views = days.reduce((sum, day) => sum + Number(viewIndex.daily.get(`${day}|${articlePath}`) || 0), 0)
  const paths = [...viewIndex.articlePaths]
  const siteTotal = paths.reduce((sum, path) => sum + days.reduce((subtotal, day) => subtotal + Number(viewIndex.daily.get(`${day}|${path}`) || 0), 0), 0)
  const siteAverage = paths.length ? siteTotal / paths.length : 0
  const vsSiteAveragePct = siteAverage > 0 ? Math.round(((views - siteAverage) / siteAverage) * 100) : null
  const performanceScore = vsSiteAveragePct == null ? null : clamp(50 + vsSiteAveragePct / 2)
  return {
    windowDays: span,
    views,
    siteAverage: Math.round(siteAverage * 10) / 10,
    vsSiteAveragePct,
    performanceScore,
    source: 'views.daily.aggregate',
    measuredAt: measuredAt.toISOString(),
  }
}

export function nextCalibrationState({ calibration = {}, article, decision, viewIndex, now = new Date() }) {
  const publicationAt = parsePublicationAt(article, now)
  if (!publicationAt) return { changed: false, lifecycleStatus: 'draft_started', publishedAt: null, calibration: { ...calibration, status: 'awaiting-publication' } }

  const due7 = new Date(publicationAt.getTime() + 7 * DAY_MS)
  const due30 = new Date(publicationAt.getTime() + 30 * DAY_MS)
  const articlePath = `/articles/${article.slug || article.id || ''}`
  let actual7 = calibration.actual7 || null
  let actual30 = calibration.actual30 || null
  if (!actual7 && now >= due7) actual7 = measureWindow(viewIndex, articlePath, publicationAt, 7, now)
  if (!actual30 && now >= due30) actual30 = measureWindow(viewIndex, articlePath, publicationAt, 30, now)

  const predictedStrength = decision?.scores?.strength ?? null
  const predictedArticlePotential = decision?.scores?.articlePotential ?? null
  const preferredActual = actual30 || actual7
  const error = preferredActual?.performanceScore == null || predictedStrength == null
    ? null
    : Math.round(preferredActual.performanceScore - predictedStrength)
  const status = actual30 ? 'complete' : actual7 ? 'awaiting-30d' : 'awaiting-7d'
  const next = {
    mode: 'feedback-loop',
    status,
    due7At: due7.toISOString(),
    due30At: due30.toISOString(),
    predictedStrength,
    predictedArticlePotential,
    actual7,
    actual30,
    latestCalibrationError: error,
    method: 'مقارنة أداء المقال بمتوسط المقالات في الموقع خلال النافذة نفسها؛ معايرة تدريجية وليست Machine Learning.',
  }
  return {
    changed: JSON.stringify(next) !== JSON.stringify(calibration),
    lifecycleStatus: 'published',
    publishedAt: publicationAt.toISOString(),
    calibration: next,
  }
}

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
  const unsigned = `${base64({ alg: 'RS256', typ: 'JWT' })}.${base64({ iss: serviceAccount.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }) })
  if (!response.ok) throw new Error(`تعذر توثيق حساب الخدمة (${response.status})`)
  const result = await response.json()
  tokenCache = { value: result.access_token, expiresAt: Date.now() + Math.max(300, Number(result.expires_in) || 3600) * 1000 }
  return tokenCache.value
}

const projectId = () => {
  serviceAccount ||= loadServiceAccount()
  return env.FIREBASE_PROJECT_ID || serviceAccount.project_id
}

async function listCollection(name) {
  const rows = []
  let pageToken = ''
  do {
    const params = new URLSearchParams({ pageSize: '300' })
    if (pageToken) params.set('pageToken', pageToken)
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/${name}?${params}`, { headers: { Authorization: `Bearer ${await accessToken()}` } })
    if (!response.ok) throw new Error(`تعذر قراءة ${name} (${response.status})`)
    const result = await response.json()
    for (const document of result.documents || []) rows.push({ id: String(document.name || '').split('/').pop() || '', data: decodeFirestoreFields(document.fields || {}) })
    pageToken = result.nextPageToken || ''
  } while (pageToken)
  return rows
}

async function patchEditorialDecision(id, values) {
  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, encodeFirestoreValue(value)]))
  const masks = Object.keys(values).map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&')
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId())}/databases/(default)/documents/admin_editorial_board/${encodeURIComponent(id)}?${masks}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`تعذر تحديث قرار ${id} (${response.status})`)
}

async function main() {
  const now = new Date()
  const [decisions, articles, views] = await Promise.all([
    listCollection('admin_editorial_board'),
    listCollection('site_articles'),
    listCollection('views'),
  ])
  const articleMap = new Map(articles.map((row) => [row.id, { id: row.id, ...row.data }]))
  const viewIndex = buildViewIndex(views)
  let updated = 0
  for (const row of decisions) {
    const linkedArticleId = String(row.data.linkedArticleId || '').trim()
    if (!linkedArticleId) continue
    const article = articleMap.get(linkedArticleId)
    if (!article) continue
    const result = nextCalibrationState({ calibration: row.data.calibration || {}, article, decision: row.data.decision || {}, viewIndex, now })
    if (!result.changed) continue
    await patchEditorialDecision(row.id, {
      lifecycleStatus: result.lifecycleStatus,
      publishedAt: result.publishedAt,
      calibration: result.calibration,
      updatedAt: now,
    })
    updated += 1
  }
  console.log(`Editorial board calibration: ${updated} decision(s) updated; ${decisions.length} inspected.`)
}

if (process.argv.includes('--self-test')) {
  const now = new Date('2026-07-30T12:00:00.000Z')
  const publication = new Date('2026-06-01T00:00:00+03:00')
  const days = windowDaysFrom(publication, 30)
  const docs = []
  docs.push({ id: 'total:%2Farticles%2Falpha', data: { count: 200 } }, { id: 'total:%2Farticles%2Fbeta', data: { count: 100 } })
  for (const day of days) {
    docs.push({ id: `day:${day}:%2Farticles%2Falpha`, data: { count: 4 } })
    docs.push({ id: `day:${day}:%2Farticles%2Fbeta`, data: { count: 2 } })
  }
  const index = buildViewIndex(docs)
  const result = nextCalibrationState({ calibration: { mode: 'feedback-loop', status: 'awaiting-publication' }, article: { slug: 'alpha', status: 'published', iso: '2026-06-01' }, decision: { scores: { strength: 70, articlePotential: 74 } }, viewIndex: index, now })
  if (!result.calibration.actual7 || !result.calibration.actual30 || result.calibration.actual30.views !== 120) throw new Error('calibration self-test failed')
  if (result.calibration.actual30.vsSiteAveragePct !== 33) throw new Error('site-average comparison self-test failed')
  if (result.calibration.status !== 'complete') throw new Error('30-day lifecycle self-test failed')
  console.log('Editorial board calibration self-test: passed')
} else {
  await main()
}
