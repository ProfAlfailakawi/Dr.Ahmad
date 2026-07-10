import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../lib/firebase'
import type { ArticleRecord } from '../../lib/cms'
import { books, papers } from '../../data'

/* أسماء الصفحات الثابتة — ليقرأ الدكتور أسماء مفهومة لا مسارات */
const PAGE_NAMES: Record<string, string> = {
  '/': 'الرئيسية', '/articles': 'فهرس المقالات', '/publications': 'فهرس الكتب', '/research': 'فهرس الأبحاث',
  '/media': 'الظهور الإعلامي', '/cv': 'السيرة الأكاديمية', '/contact': 'التواصل', '/about': 'حول الموقع',
  '/curated': 'المختارات', '/questions': 'سؤال يُقلق التعليم', '/radar': 'أرشيف الرادار', '/inbox': 'من بريدي الوارد',
  '/atlas': 'سماء المقالات', '/search': 'البحث العميق', '/ask': 'اسأل مكتبتي', '/upcoming': 'اللقاءات القادمة',
}
type Kind = 'الكل' | 'مقالات' | 'كتب' | 'أبحاث' | 'صفحات'
const kindOf = (path: string): Exclude<Kind, 'الكل'> =>
  path.startsWith('/articles/') ? 'مقالات'
  : path.startsWith('/publications/') ? 'كتب'
  : path.startsWith('/research/') ? 'أبحاث'
  : 'صفحات'

type ViewRow = {
  id: string
  count: number
  title?: string
}

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
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

function decodePath(value: string) {
  try { return decodeURIComponent(value) } catch { return value }
}

export function Indicators({ articles }: { articles: ArticleRecord[] }) {
  const [rows, setRows] = useState<ViewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<Kind>('الكل')
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { collection, getDocs } = await import('firebase/firestore')
      const snapshot = await getDocs(collection(db, 'views'))
      setRows(snapshot.docs.map((item) => {
        const data = item.data() as { count?: number; title?: string }
        return { id: item.id, count: Number(data.count || 0), title: data.title }
      }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر جلب المؤشرات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const summary = useMemo(() => {
    const labels = new Map<string, string>(articles.map((article) => [`/articles/${article.slug}`, article.title]))
    for (const b of books) labels.set(`/publications/${b.slug}`, b.title)
    for (const p of papers) labels.set(`/research/${p.slug}`, p.title)
    for (const [path, name] of Object.entries(PAGE_NAMES)) labels.set(path, name)

    const totals = rows
      .filter((row) => row.id.startsWith('total:'))
      .map((row) => {
        const path = decodePath(row.id.slice('total:'.length))
        return { ...row, path, kind: kindOf(path), label: labels.get(path) || row.title || path }
      })
      .sort((a, b) => b.count - a.count)
    const topArticles = totals.filter((row) => row.kind === 'مقالات').slice(0, 10)
    const days = Array.from({ length: 7 }, (_, index) => kuwaitDate(index - 6))
    const trend = days.map((date) => ({
      date,
      count: rows
        .filter((row) => row.id.startsWith(`day:${date}:`))
        .reduce((sum, row) => sum + row.count, 0),
    }))
    // إجمالي كل نوع — نظرة سريعة قبل الجدول المفصّل
    const byKind = { مقالات: 0, كتب: 0, أبحاث: 0, صفحات: 0 } as Record<Exclude<Kind, 'الكل'>, number>
    for (const row of totals) byKind[row.kind] += row.count
    return {
      total: totals.reduce((sum, row) => sum + row.count, 0),
      pages: totals.length,
      topArticles,
      trend,
      totals,
      byKind,
    }
  }, [articles, rows])

  // الجدول المفصّل: فلترة بالنوع + بحث بالاسم
  const detailed = useMemo(() => {
    const term = q.trim()
    return summary.totals
      .filter((row) => (kind === 'الكل' ? true : row.kind === kind))
      .filter((row) => (term ? (row.label + ' ' + row.path).includes(term) : true))
  }, [summary.totals, kind, q])

  const topMax = Math.max(...summary.topArticles.map((row) => row.count), 1)
  const trendMax = Math.max(...summary.trend.map((row) => row.count), 1)

  if (loading) return <div className={card}>لحظة… أجمع المشاهدات.</div>

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[.85rem] text-soft">تُحتسب الصفحة مرة واحدة في الجلسة لكل زائر.</p>
        <button type="button" onClick={() => void load()} className="rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent">
          تحديث المؤشرات
        </button>
      </div>

      {error && <div className={`${card} border-accent/40 text-[.9rem] text-soft`}>{error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className={card}>
          <span className="block font-display text-4xl font-bold text-accent">{ar(summary.total)}</span>
          <span className="mt-2 block text-[.86rem] text-soft">إجمالي المشاهدات</span>
        </div>
        <div className={card}>
          <span className="block font-display text-4xl font-bold text-accent">{ar(summary.pages)}</span>
          <span className="mt-2 block text-[.86rem] text-soft">صفحات شوهدت</span>
        </div>
        {(['مقالات', 'كتب', 'أبحاث', 'صفحات'] as const).map((k) => (
          <div key={k} className={card}>
            <span className="block font-display text-2xl font-bold text-ink">{ar(summary.byKind[k])}</span>
            <span className="mt-2 block text-[.82rem] text-soft">مشاهدات ال{k === 'صفحات' ? 'صفحات' : k}</span>
          </div>
        ))}
      </div>

      <section className={card}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">الأكثر قراءة</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-ink">أعلى 10 مقالات</h2>
          </div>
        </div>
        {summary.topArticles.length ? (
          <ol className="grid gap-4">
            {summary.topArticles.map((row, index) => (
              <li key={row.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(180px,.8fr)_auto] sm:items-center">
                <span className="truncate text-[.88rem] text-ink"><span className="me-2 text-accent">{index + 1}.</span>{row.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-canvas">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max((row.count / topMax) * 100, 3)}%` }} />
                </span>
                <span className="text-[.8rem] text-soft">{ar(row.count)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[.9rem] text-soft">تظهر المقالات هنا بعد أول مشاهدة.</p>
        )}
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">آخر 7 أيام</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">اتجاه المشاهدات</h2>
        <div className="mt-8 grid h-48 grid-cols-7 items-end gap-2 sm:gap-4" aria-label="مشاهدات الأيام السبعة الأخيرة">
          {summary.trend.map((day) => (
            <div key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <span className="text-[.72rem] text-soft">{ar(day.count)}</span>
              <span className="w-full max-w-10 rounded-t-md bg-accent/80 transition-[height]" style={{ height: `${day.count ? Math.max((day.count / trendMax) * 120, 5) : 2}px` }} />
              <time className="text-[.65rem] text-soft" dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time>
            </div>
          ))}
        </div>
      </section>

      {/* ── التفصيل الممل: كل مسارٍ شوهد، بلا استثناء ── */}
      <section className={card}>
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
            className="w-56 rounded-full border border-hair bg-canvas px-4 py-2 text-[.85rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
          />
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {(['الكل', 'مقالات', 'كتب', 'أبحاث', 'صفحات'] as Kind[]).map((k) => (
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
          <ol className="max-h-[520px] divide-y divide-hair overflow-y-auto">
            {detailed.map((row, index) => (
              <li key={row.id} className="flex items-center gap-3 py-2.5">
                <span className="w-7 shrink-0 text-[.78rem] text-soft">{index + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[.88rem] text-ink">{row.label}</span>
                  <span className="block truncate text-[.7rem] text-soft/70" dir="ltr" style={{ textAlign: 'right' }}>{row.path}</span>
                </span>
                <span className="shrink-0 rounded-full border border-hair px-2.5 py-0.5 text-[.72rem] text-soft">{row.kind}</span>
                <span className="w-14 shrink-0 text-left font-display text-[1rem] font-semibold text-accent" dir="ltr">{ar(row.count)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[.9rem] text-soft">لا مشاهدات مطابقة بعد.</p>
        )}
      </section>
    </div>
  )
}
