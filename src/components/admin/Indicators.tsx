import { useEffect, useMemo, useState } from 'react'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { analyticsKindOf, createAnalyticsNamer, decodeAnalyticsPath, parseJourneyPath, type AnalyticsKind } from '../../lib/analytics-labels'
import type { ArticleRecord } from '../../lib/cms'
import { useCmsContent } from '../../lib/content'
import { Pagination, usePagedList } from '../Pagination'

type Kind = 'الكل' | AnalyticsKind

type ViewRow = {
  id: string
  count: number
  title?: string
}

type JourneyRow = {
  id: string
  from?: string
  to?: string
  count: number
}

function journeyFromViewPath(path: string, count: number): JourneyRow | null {
  const parsed = parseJourneyPath(path)
  return parsed ? { id: `views:${path.slice('/_journey/'.length)}`, from: parsed.from, to: parsed.to, count } : null
}

type MonthlyReport = {
  period: string
  notification?: string
  monthlyTotal?: number
  lifetimeTotal?: number
  days?: { date: string; count: number }[]
  topArticles?: { path: string; slug: string; title: string; count: number }[]
  trend?: {
    firstHalf?: number
    secondHalf?: number
    direction?: 'up' | 'down' | 'stable'
    changePercent?: number
  }
}

const card = 'min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-wash p-3.5 sm:p-5 md:p-6'
const ar = (value: number) => String(value)

function kuwaitDate(offset = 0) {
  const date = new Date(Date.now() + offset * 86_400_000)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function Indicators({ articles }: { articles: ArticleRecord[] }) {
  const { books, papers } = useCmsContent()
  const [rows, setRows] = useState<ViewRow[]>([])
  const [journeys, setJourneys] = useState<JourneyRow[]>([])
  const [subscribers, setSubscribers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Kind>('الكل')
  const [q, setQ] = useState('')
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [health, setHealth] = useState<{ date: string; status: string; issueCount: number; issues?: string[] } | null>(null)
  const [view, setView] = useState<'overview' | 'content' | 'journey' | 'details'>('overview')

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { collection, getDocs } = await import('firebase/firestore')
      const failures: string[] = []
      const safeDocs = async (name: string, reportFailure = true) => {
        try {
          return await getDocs(collection(db, name))
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : 'تعذّر الجلب'
          if (reportFailure) failures.push(`${name}: ${message}`)
          return null
        }
      }
      const fetchServerJourneys = async (): Promise<JourneyRow[] | null> => {
        try {
          const app = await getFirebaseApp()
          if (!app) return null
          const { getAuth } = await import('firebase/auth')
          const user = getAuth(app).currentUser
          if (!user) return null
          const token = await user.getIdToken()
          const response = await fetch('/api/admin/journeys', {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          if (!response.ok) return null
          const payload = await response.json() as { items?: JourneyRow[] }
          return Array.isArray(payload.items) ? payload.items : []
        } catch { return null }
      }
      const [snapshot, reportsSnapshot, healthSnapshot, journeysSnapshot, subscribersSnapshot, serverJourneys] = await Promise.all([
        safeDocs('views'),
        safeDocs('admin_reports'),
        safeDocs('site_health'),
        safeDocs('journeys', false),
        safeDocs('subscribers'),
        fetchServerJourneys(),
      ])
      if (!snapshot) {
        setRows([])
        throw new Error('تعذّر جلب عدادات المشاهدة. غالباً تحتاج تحديث صلاحية المشرف أو نشر قواعد Firestore الأخيرة.')
      }
      setSubscribers(subscribersSnapshot?.size || 0)
      const directJourneys = journeysSnapshot?.docs.map((item) => {
        const data = item.data() as { from?: string; to?: string; count?: number }
        return { id: item.id, from: data.from, to: data.to, count: Number(data.count || 0) }
      }) || null
      const resolvedJourneys = serverJourneys ?? directJourneys
      setJourneys(resolvedJourneys || [])
      if (!resolvedJourneys) failures.push('journeys: تعذّر جلب رحلة الزائر')
      const latestHealth = (healthSnapshot?.docs || [])
        .map((d) => d.data() as { date: string; status: string; issueCount: number; issues?: string[] })
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]
      setHealth(latestHealth || null)
      setRows(snapshot.docs.map((item) => {
        const data = item.data() as { count?: number; title?: string }
        return { id: item.id, count: Number(data.count || 0), title: data.title }
      }))
      const latest = (reportsSnapshot?.docs || [])
        .map((item) => ({ ...(item.data() as MonthlyReport), period: String((item.data() as MonthlyReport).period || item.id) }))
        .filter((item) => /^\d{4}-\d{2}$/.test(item.period))
        .sort((left, right) => right.period.localeCompare(left.period))[0]
      setReport(latest || null)
      if (failures.length) {
        setError(`تنبيه: ظهرت المؤشرات الأساسية، لكن تعذّر جلب بعض التفاصيل (${failures.map((f) => f.split(':')[0]).join('، ')}).`)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر جلب المؤشرات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load(false) }, 60000)
    const onFocus = () => { void load(false) }
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [])

  const summary = useMemo(() => {
    const namer = createAnalyticsNamer({ articles, books, papers, media: [] })

    const totals = rows
      .filter((row) => row.id.startsWith('total:'))
      .map((row) => {
        const path = decodeAnalyticsPath(row.id.slice('total:'.length))
        return { ...row, path, kind: analyticsKindOf(path), label: namer.label(path, row.title) }
      })
      .filter((row) => !row.path.startsWith('/_journey/'))
      .sort((a, b) => b.count - a.count)
    const topArticles = totals.filter((row) => row.kind === 'مقالات').slice(0, 10)
    const days = Array.from({ length: 7 }, (_, index) => kuwaitDate(index - 6))
    const trend = days.map((date) => ({
      date,
      count: rows
        .filter((row) => row.id.startsWith(`day:${date}:`))
        .reduce((sum, row) => sum + row.count, 0),
    }))
    // دمج رحلات الخادم مع المسار الاحتياطي داخل views من دون مضاعفة العد.
    const journeyMap = new Map<string, JourneyRow>()
    for (const row of journeys) {
      if (!row.from || !row.to) continue
      journeyMap.set(`${row.from}>${row.to}`, row)
    }
    for (const row of rows) {
      if (!row.id.startsWith('total:')) continue
      const parsed = journeyFromViewPath(decodeAnalyticsPath(row.id.slice('total:'.length)), row.count)
      if (!parsed?.from || !parsed.to) continue
      const key = `${parsed.from}>${parsed.to}`
      const current = journeyMap.get(key)
      if (!current || parsed.count > current.count) journeyMap.set(key, parsed)
    }
    const resolvedJourneys = Array.from(journeyMap.values())
      .sort((a, b) => b.count - a.count)
      .map((row) => ({ ...row, human: namer.journey(row.from, row.to) }))

    // إجمالي كل نوع — نظرة سريعة قبل الجدول المفصّل
    const byKind = { مقالات: 0, كتب: 0, أبحاث: 0, صفحات: 0, مشاركات: 0, استماع: 0 } as Record<Exclude<Kind, 'الكل'>, number>
    for (const row of totals) byKind[row.kind] += row.count
    return {
      total: totals.reduce((sum, row) => sum + row.count, 0),
      pages: totals.length,
      topArticles,
      trend,
      totals,
      byKind,
      journeys: resolvedJourneys,
    }
  }, [articles, books, journeys, papers, rows])

  // الجدول المفصّل: فلترة بالنوع + بحث بالاسم
  const detailed = useMemo(() => {
    const term = q.trim()
    return summary.totals
      .filter((row) => (kind === 'الكل' ? true : row.kind === kind))
      .filter((row) => (term ? (row.label + ' ' + row.path).includes(term) : true))
  }, [summary.totals, kind, q])

  const detailedPages = usePagedList(detailed, 20, `${kind}|${q}`)

  const topMax = Math.max(...summary.topArticles.map((row) => row.count), 1)
  const trendMax = Math.max(...summary.trend.map((row) => row.count), 1)

  if (loading) return <div className={card}>لحظة… أجمع المشاهدات.</div>

  return (
    <div className="admin-dashboard grid min-w-0 w-full max-w-full gap-4 overflow-x-hidden sm:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[.85rem] text-soft">تُحتسب الصفحة مرة واحدة في الجلسة لكل زائر.</p>
        <span className="rounded-full border border-hair px-4 py-2 text-[.78rem] text-soft">يتحدّث تلقائياً كل دقيقة</span>
      </div>
      <div className="rail flex gap-2 overflow-x-auto pb-1">
        {([['overview','النظرة العامة'],['content','المحتوى'],['journey','رحلة الزائر'],['details','كل البيانات']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold ${view === key ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft'}`}>{label}</button>)}
      </div>

      {error && <div className={`${card} border-accent/40 text-[.9rem] text-soft`}>{error}</div>}

      {view === 'overview' && health && (
        <section className={`${card} ${health.status === 'سليم' ? '' : 'border-accent/50'}`} aria-label="حارس الجودة">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[1.1rem] ${health.status === 'سليم' ? 'bg-accent/10 text-accent' : 'bg-accent text-white'}`}>
                {health.status === 'سليم' ? '✓' : '!'}
              </span>
              <div>
                <p className="text-[.76rem] font-semibold uppercase text-accent">حارس الجودة · فحص أسبوعي آلي</p>
                <h2 className="font-display text-lg font-semibold text-ink">
                  {health.status === 'سليم' ? 'الموقع سليم بالكامل.' : `${ar(health.issueCount)} تنبيهاً يحتاج انتباهك.`}
                </h2>
              </div>
            </div>
            <span className="text-[.72rem] text-soft">آخر فحص: {health.date}</span>
          </div>
          {health.issueCount > 0 && health.issues && (
            <ul className="mt-4 grid gap-1.5 border-t border-hair pt-4 text-[.85rem] text-soft">
              {health.issues.slice(0, 10).map((i, n) => <li key={n}>⚠ {i}</li>)}
            </ul>
          )}
        </section>
      )}

      {view === 'overview' && report && (
        <section className={`${card} border-accent/30 bg-accent/[.045]`} aria-label={`التقرير الشهري ${report.period}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[.76rem] font-semibold uppercase text-accent">إشعار التقرير الشهري · {report.period}</p>
              <h2 className="mt-1 font-display text-xl font-semibold text-ink">{report.notification || 'أصبح تقرير الشهر جاهزاً.'}</h2>
            </div>
            <div className="flex gap-5 text-center">
              <span>
                <strong className="block font-display text-2xl text-accent">{ar(Number(report.monthlyTotal || 0))}</strong>
                <small className="text-[.7rem] text-soft">مشاهدة الشهر</small>
              </span>
              <span>
                <strong className="block font-display text-2xl text-ink">{ar(Number(report.lifetimeTotal || 0))}</strong>
                <small className="text-[.7rem] text-soft">الإجمالي حتى صدوره</small>
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 border-t border-hair pt-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <ol className="grid gap-2">
              {(report.topArticles || []).slice(0, 3).map((article, index) => (
                <li key={article.path} className="flex items-center justify-between gap-4 text-[.82rem]">
                  <span className="min-w-0 truncate text-ink"><span className="me-2 text-accent">{index + 1}.</span>{article.title}</span>
                  <span className="shrink-0 text-soft">{ar(Number(article.count || 0))}</span>
                </li>
              ))}
              {!report.topArticles?.length && <li className="text-[.82rem] text-soft">لا توجد قراءات مقالات مسجلة في هذا التقرير.</li>}
            </ol>
            {report.trend && (
              <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.78rem] text-soft">
                الاتجاه: <strong className="text-ink">{report.trend.direction === 'up' ? 'صاعد ↑' : report.trend.direction === 'down' ? 'هابط ↓' : 'مستقر'}</strong>
                {' · '}{Math.abs(Number(report.trend.changePercent || 0))}% بين نصفي الشهر
              </p>
            )}
          </div>
        </section>
      )}

      {view === 'overview' && <div className="grid min-w-0 w-full max-w-full grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`${card} min-w-0`}>
          <span className="block truncate font-display text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-accent">{ar(summary.total)}</span>
          <span className="mt-2 block text-[.82rem] text-soft">إجمالي المشاهدات</span>
        </div>
        <div className={`${card} min-w-0`}>
          <span className="block truncate font-display text-[clamp(1.5rem,7vw,2.25rem)] font-bold tabular-nums text-accent">{ar(summary.pages)}</span>
          <span className="mt-2 block text-[.82rem] text-soft">صفحات شوهدت</span>
        </div>
        <div className={`${card} min-w-0`}>
          <span className="block truncate font-display text-[clamp(1.15rem,5.5vw,1.5rem)] font-bold tabular-nums text-ink">{ar(subscribers)}</span>
          <span className="mt-2 block text-[.82rem] text-soft">مشتركو النشرة</span>
        </div>
        <div className={`${card} min-w-0`}>
          <span className="block truncate font-display text-[clamp(1.15rem,5.5vw,1.5rem)] font-bold tabular-nums text-ink">{ar(summary.byKind['مشاركات'])}</span>
          <span className="mt-2 block text-[.82rem] text-soft">مشاركات المحتوى</span>
        </div>
        {(['مقالات', 'كتب', 'أبحاث', 'صفحات'] as const).map((k) => (
          <div key={k} className={`${card} min-w-0`}>
            <span className="block truncate font-display text-[clamp(1.15rem,5.5vw,1.5rem)] font-bold tabular-nums text-ink">{ar(summary.byKind[k])}</span>
            <span className="mt-2 block text-[.82rem] text-soft">مشاهدات ال{k === 'صفحات' ? 'صفحات' : k}</span>
          </div>
        ))}
      </div>}

      {view === 'content' && <section className={card}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">الأكثر قراءة</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">أعلى 10 مقالات</h2>
          </div>
        </div>
        {summary.topArticles.length ? (
          <ol className="grid gap-4">
            {summary.topArticles.map((row, index) => (
              <li key={row.id} className="min-w-0 rounded-xl border border-hair bg-canvas px-4 py-3">
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <span className="min-w-0 flex-1 truncate text-[.88rem] text-ink"><span className="me-2 text-accent">{index + 1}.</span>{row.label}</span>
                  <span className="shrink-0 text-[.8rem] font-semibold text-accent">{ar(row.count)}</span>
                </div>
                <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-wash">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max((row.count / topMax) * 100, 3)}%` }} />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[.9rem] text-soft">تظهر المقالات هنا بعد أول مشاهدة.</p>
        )}
      </section>}

      {view === 'content' && <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">أثر المقال</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">ما الذي يحدث بعد القراءة؟</h2>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-hair bg-canvas p-4">
            <span className="block font-display text-2xl font-semibold text-accent">{ar(summary.byKind['مقالات'])}</span>
            <span className="mt-1 block text-[.78rem] text-soft">مشاهدات المقالات</span>
          </div>
          <div className="rounded-xl border border-hair bg-canvas p-4">
            <span className="block font-display text-2xl font-semibold text-accent">{ar(summary.byKind['مشاركات'])}</span>
            <span className="mt-1 block text-[.78rem] text-soft">مشاركات بعد القراءة</span>
          </div>
          <div className="rounded-xl border border-hair bg-canvas p-4">
            <span className="block font-display text-2xl font-semibold text-accent">{ar(summary.journeys.filter((row) => row.to === '/cv' || row.to === '/contact').reduce((sum, row) => sum + row.count, 0))}</span>
            <span className="mt-1 block text-[.78rem] text-soft">تحولات إلى السيرة/التواصل</span>
          </div>
        </div>
        {summary.journeys.length ? (
          <ol className="mt-5 grid min-w-0 gap-2">
            {summary.journeys.slice(0, 6).map((row) => (
              <li key={row.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-hair bg-canvas px-3 py-3 text-[.78rem] sm:px-4 sm:text-[.82rem]">
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ink" title={`${row.from} ← ${row.to}`}>{row.human.title}</span>
                <span className="shrink-0 text-accent">{ar(row.count)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-[.86rem] leading-relaxed text-soft">ستظهر خريطة الانتقال بعد زيارات جديدة؛ لا توجد بيانات كافية الآن.</p>
        )}
      </section>}

      {view === 'overview' && <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">آخر 7 أيام</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">اتجاه المشاهدات</h2>
        <div className="mt-8 grid h-36 min-w-0 grid-cols-7 items-end gap-1 sm:h-48 sm:gap-3" aria-label="مشاهدات الأيام السبعة الأخيرة">
          {summary.trend.map((day) => (
            <div key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <span className="text-[.72rem] text-soft">{ar(day.count)}</span>
              <span className="w-full max-w-10 rounded-t-md bg-accent/[.08]0 transition-[height]" style={{ height: `${day.count ? Math.max((day.count / trendMax) * 120, 5) : 2}px` }} />
              <time className="text-[.58rem] text-soft sm:text-[.65rem]" dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time>
            </div>
          ))}
        </div>
      </section>}

      {view === 'journey' && <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">رحلة الزائر</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">أكثر الانتقالات تكراراً</h2>
        {summary.journeys.length ? <ol className="mt-5 grid gap-3">{summary.journeys.slice(0, 10).map((row) => <li key={row.id} className="grid gap-2 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)_auto] md:items-center">
          <span className="min-w-0 truncate text-ink" title={row.from}>{row.human.from}</span>
          <span className="hidden h-px bg-accent/[.45] md:block" aria-hidden="true" />
          <span className="min-w-0 truncate text-ink" title={row.to}>{row.human.to}</span>
          <span className="w-fit rounded-full border border-hair px-2.5 py-1 text-accent">{ar(row.count)}</span>
        </li>)}</ol> : <p className="mt-4 text-[.86rem] text-soft">لا توجد بيانات كافية بعد.</p>}
      </section>}

      {/* ── التفصيل الممل: كل مسارٍ شوهد، بلا استثناء ── */}
      {view === 'details' && <section id="admin-indicators-details" className={card}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">بالتفصيل الممل</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">كل الصفحات ({ar(detailed.length)})</h2>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالعنوان…"
            aria-label="بحث في المشاهدات"
            className="w-full rounded-full border border-hair bg-canvas px-4 py-2 text-[.85rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent sm:w-56"
          />
        </div>
        <div className="mb-5 flex max-w-full flex-wrap gap-2">
          {(['الكل', 'مقالات', 'كتب', 'أبحاث', 'صفحات', 'مشاركات', 'استماع'] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-4 py-1.5 text-[.82rem] font-medium transition-colors ${kind === k ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
            >
              {k}
            </button>
          ))}
        </div>
        {detailed.length ? (
          <>
          <ol className="min-w-0 divide-y divide-hair overflow-x-hidden">
            {detailedPages.pageItems.map((row, index) => (
              <li key={row.id} className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto_auto] items-center gap-2 py-2.5 sm:gap-3">
                <span className="w-7 shrink-0 text-[.78rem] text-soft">{(detailedPages.page - 1) * 20 + index + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[.88rem] text-ink">{row.label}</span>
                  <span className="block truncate text-[.7rem] text-soft/80">{row.kind === 'مشاركات' ? 'حدث مشاركة' : row.kind === 'استماع' ? 'حدث استماع' : 'صفحة مقروءة'}</span>
                </span>
                <span className="shrink-0 rounded-full border border-hair px-2.5 py-0.5 text-[.72rem] text-soft">{row.kind}</span>
                <span className="w-14 shrink-0 text-left font-display text-[1rem] font-semibold text-accent" dir="ltr">{ar(row.count)}</span>
              </li>
            ))}
          </ol>
          <Pagination
            page={detailedPages.page}
            pageCount={detailedPages.pageCount}
            onChange={detailedPages.setPage}
            totalItems={detailed.length}
            firstItem={detailedPages.firstItem}
            lastItem={detailedPages.lastItem}
            scrollTargetId="admin-indicators-details"
            label="صفحات بيانات المشاهدة"
          />
          </>
        ) : (
          <p className="text-[.9rem] text-soft">لا مشاهدات مطابقة بعد.</p>
        )}
      </section>}
    </div>
  )
}
