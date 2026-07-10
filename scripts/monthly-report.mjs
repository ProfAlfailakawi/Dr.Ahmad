#!/usr/bin/env node
/**
 * تقرير الموقع الشهري.
 *
 * شغّل هذا الأمر يومياً من Cloud Scheduler/cron/launchd؛ يفحص تقرير الشهر
 * السابق ويصدره مرة واحدة فقط إن لم يكن موجوداً (حتى لو كان الجهاز مطفأ يوم 1):
 *   npm run report:monthly
 *
 * معاينة بلا كتابة ولا webhook (تقرأ Firestore فقط):
 *   npm run report:monthly:dry-run
 *
 * تشغيل يدوي لشهر محدد:
 *   npm run report:monthly -- --month=2026-06 --force
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cert, deleteApp, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRY_RUN = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const monthArgument = process.argv.find((argument) => argument.startsWith('--month='))?.slice(8)
const execFileAsync = promisify(execFile)

function loadEnvironment() {
  const values = { ...process.env }
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return values
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || values[match[1]]) continue
    values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return values
}

const env = loadEnvironment()

function kuwaitParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) }
}

function previousMonth({ year, month }) {
  const date = new Date(Date.UTC(year, month - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function validMonth(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) throw new Error('--month يجب أن يكون بصيغة YYYY-MM')
  return value
}

function parseViewId(id) {
  try {
    if (id.startsWith('total:')) return { kind: 'total', path: decodeURIComponent(id.slice(6)) }
    if (id.startsWith('day:') && /^day:\d{4}-\d{2}-\d{2}:/.test(id)) {
      return { kind: 'day', date: id.slice(4, 14), path: decodeURIComponent(id.slice(15)) }
    }
  } catch {
    return null
  }
  return null
}

function monthDays(period) {
  const [year, month] = period.split('-').map(Number)
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${period}-${String(index + 1).padStart(2, '0')}`)
}

function direction(firstHalf, secondHalf) {
  if (firstHalf === secondHalf) return { direction: 'stable', changePercent: 0 }
  if (firstHalf === 0) return { direction: 'up', changePercent: secondHalf ? 100 : 0 }
  const changePercent = Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
  return { direction: changePercent > 0 ? 'up' : 'down', changePercent }
}

function secureWebhook(value) {
  if (!value) return null
  let parsed
  try { parsed = new URL(value) } catch { throw new Error('REPORT_WEBHOOK_URL غير صالح') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('REPORT_WEBHOOK_URL يجب أن يكون HTTPS ومن دون بيانات دخول في الرابط')
  }
  return parsed.href
}

async function notifyWebhook(url, report) {
  if (!url) return
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'monthly-site-report',
        text: report.notification,
        period: report.period,
        monthlyTotal: report.monthlyTotal,
        lifetimeTotal: report.lifetimeTotal,
        topArticles: report.topArticles.slice(0, 3),
      }),
    })
    if (!response.ok) throw new Error(`webhook رفض الإشعار (${response.status})`)
  } finally {
    clearTimeout(timer)
  }
}

async function notifyMac(report) {
  if (process.platform !== 'darwin' || env.REPORT_LOCAL_NOTIFICATION === 'false') return false
  const escapeAppleScript = (value) => String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
  const script = `display notification "${escapeAppleScript(report.notification)}" with title "تقرير الموقع الشهري"`
  await execFileAsync('/usr/bin/osascript', ['-e', script], { timeout: 10_000 })
  return true
}

async function main() {
  const now = kuwaitParts()
  const period = validMonth(monthArgument || previousMonth(now))
  const accountPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(accountPath)) throw new Error(`ملف حساب الخدمة مفقود: ${accountPath}`)
  const account = JSON.parse(readFileSync(accountPath, 'utf8'))
  const projectId = env.FIREBASE_PROJECT_ID || account.project_id
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID مفقود')

  const app = getApps()[0] || initializeApp({ credential: cert(account), projectId })
  const db = getFirestore(app)
  try {
  const reportRef = db.collection('admin_reports').doc(period)
  if (!DRY_RUN && !FORCE && (await reportRef.get()).exists) {
    console.log(`تقرير ${period} موجود؛ لا تكرار.`)
    return
  }

  const [viewsSnapshot, articlesSnapshot, overridesSnapshot] = await Promise.all([
    db.collection('views').get(),
    db.collection('site_articles').get(),
    db.collection('content_overrides').get(),
  ])

  const cmsTitles = new Map()
  const hiddenPaths = new Set()
  for (const document of articlesSnapshot.docs) {
    const data = document.data()
    const slug = String(data.slug || document.id)
    if (data.title) cmsTitles.set(`/articles/${slug}`, String(data.title))
  }
  for (const document of overridesSnapshot.docs) {
    if (!document.id.startsWith('article:')) continue
    const slug = document.id.slice('article:'.length)
    const data = document.data()
    const path = `/articles/${slug}`
    if (data.hidden === true) hiddenPaths.add(path)
    if (data.patch?.title) cmsTitles.set(path, String(data.patch.title))
  }

  const dailyTotals = new Map(monthDays(period).map((date) => [date, 0]))
  const monthlyByPath = new Map()
  const viewTitles = new Map()
  let lifetimeTotal = 0
  let pageCount = 0

  for (const document of viewsSnapshot.docs) {
    const parsed = parseViewId(document.id)
    if (!parsed) continue
    const data = document.data()
    const count = Number(data.count || 0)
    if (!Number.isFinite(count) || count < 0) continue
    if (typeof data.title === 'string' && data.title.trim()) viewTitles.set(parsed.path, data.title.trim())
    if (parsed.kind === 'total') {
      lifetimeTotal += count
      pageCount += 1
      continue
    }
    if (!dailyTotals.has(parsed.date)) continue
    dailyTotals.set(parsed.date, (dailyTotals.get(parsed.date) || 0) + count)
    monthlyByPath.set(parsed.path, (monthlyByPath.get(parsed.path) || 0) + count)
  }

  const days = [...dailyTotals].map(([date, count]) => ({ date, count }))
  const monthlyTotal = days.reduce((sum, day) => sum + day.count, 0)
  const topArticles = [...monthlyByPath]
    .filter(([path]) => path.startsWith('/articles/') && !hiddenPaths.has(path))
    .map(([path, count]) => ({
      path,
      slug: path.slice('/articles/'.length),
      title: cmsTitles.get(path) || viewTitles.get(path) || path.slice('/articles/'.length),
      count,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)

  const split = Math.ceil(days.length / 2)
  const firstHalf = days.slice(0, split).reduce((sum, day) => sum + day.count, 0)
  const secondHalf = days.slice(split).reduce((sum, day) => sum + day.count, 0)
  const monthLabel = new Intl.DateTimeFormat('ar-KW', { month: 'long', year: 'numeric', timeZone: 'Asia/Kuwait' })
    .format(new Date(`${period}-01T12:00:00+03:00`))
  const lead = topArticles[0]
  const notification = lead
    ? `تقرير ${monthLabel}: ${monthlyTotal} مشاهدة. المقال الأكثر قراءة «${lead.title}» (${lead.count}).`
    : `تقرير ${monthLabel}: ${monthlyTotal} مشاهدة، ولا توجد قراءات مقالات مسجلة لهذا الشهر.`
  const report = {
    schemaVersion: 1,
    period,
    generatedAt: Timestamp.now(),
    generatedAtIso: new Date().toISOString(),
    monthlyTotal,
    lifetimeTotal,
    pageCount,
    days,
    topArticles,
    trend: { firstHalf, secondHalf, ...direction(firstHalf, secondHalf) },
    notification,
  }

  if (DRY_RUN) {
    console.log(JSON.stringify({ ...report, generatedAt: report.generatedAt.toDate().toISOString() }, null, 2))
    console.log('معاينة فقط: لم تُكتب وثيقة ولم يُرسل webhook.')
    return
  }

  if (FORCE) await reportRef.set(report)
  else {
    try {
      await reportRef.create(report)
    } catch (error) {
      if (error?.code === 6 || error?.code === 'already-exists') {
        console.log(`تقرير ${period} أنشأه تشغيل متزامن؛ لا تكرار ولا webhook ثانٍ.`)
        return
      }
      throw error
    }
  }
  console.log(`حُفظ admin_reports/${period}: ${monthlyTotal} مشاهدة.`)
  const webhook = secureWebhook(env.REPORT_WEBHOOK_URL)
  if (webhook) {
    try {
      await notifyWebhook(webhook, report)
      console.log('أُرسل إشعار webhook الاختياري.')
    } catch (error) {
      console.warn(`حُفظ التقرير، لكن تعذّر إرسال webhook: ${error.message}`)
    }
  }
  try {
    if (await notifyMac(report)) console.log('أُرسل إشعار macOS المحلي.')
  } catch (error) {
    console.warn(`حُفظ التقرير، لكن تعذّر إشعار macOS: ${error.message}`)
  }
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(`تعذّر إنشاء التقرير الشهري: ${error.message}`)
  process.exitCode = 1
})
