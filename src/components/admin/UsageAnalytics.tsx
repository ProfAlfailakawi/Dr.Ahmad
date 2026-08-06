import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getFirebaseApp } from '../../lib/firebase'
import { ContentSyncHealth } from './ContentSyncHealth'
import {
  ADMIN_USAGE_RETENTION_DAYS, isAdminUsageTrackingEnabled, isTestSession,
  purgeExpiredAdminUsage, setAdminTestSession, setAdminUsageTracking,
} from '../../lib/admin-usage'
import {
  DAY, bucketByPeriod, classifyDormancy, compareValue, excludeTestSessions, extractWorkflows,
  formatDelta, formatDuration, formatPercent, normalizeUsageRow, summarizeRecommendations,
  summarizeTools, withinWindow,
} from '../../lib/admin-usage-insights'
import type { AdminUsageRow, Delta, DormancyBucket, ToolUsage } from '../../lib/admin-usage-insights'
import { adminToolLabel } from './admin-navigation'
/* الامتداد `.ts` مقصود — انظر ملاحظة استيراد المكتبة في arabic-count. */
import { arabicCountPhrase, DAY_AFTER_PREPOSITION_FORMS, DAY_FORMS } from '../../lib/arabic-count.ts'

/**
 * لوحة «الاستخدام الفعلي» — نصفٌ للزوار ونصفٌ لأدوات الأدمن.
 *
 * ثلاث قواعد مرئية في كل بطاقة:
 * ١) الرقم يذكر عيّنته. ٢) بلا عيّنة يُقال «لا عيّنة» لا صفر.
 * ٣) اللوحة تقترح ولا تقرّر: لا حذف ولا إخفاء ولا دمج تلقائي.
 */

type UsageEvent = {
  id: string; name: string; sessionId: string; path: string; referrerPath: string
  device: 'mobile' | 'desktop'; props: Record<string, unknown>; createdAt: string
}
type Window = { days: number; compare: boolean; spanMs: number; since: string; until: string }

const CARD = 'rounded-2xl border border-hair bg-canvas p-5'
const PRESETS = [7, 30, 90] as const
const arabicNumber = (value: number) => new Intl.NumberFormat('ar-KW').format(value)

function p75(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.75) - 1)]
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/* ── لبنات العرض ─────────────────────────────────────────────────── */

function DeltaBadge({ delta }: { delta: Delta }) {
  const tone = delta.direction === 'up' ? 'text-accent' : delta.direction === 'down' ? 'text-soft' : 'text-soft'
  return <span className={`text-[.66rem] font-semibold ${tone}`}>{formatDelta(delta)}</span>
}

function StatCard({ label, value, delta, samples, hint }: { label: string; value: string; delta?: Delta; samples: string; hint?: string }) {
  return (
    <div className={`${CARD} flex flex-col justify-between gap-3`}>
      <span className="text-[.72rem] text-soft">{label}</span>
      <div>
        <strong className="block font-display text-[1.75rem] leading-none text-ink">{value}</strong>
        {delta && <span className="mt-1.5 block"><DeltaBadge delta={delta} /></span>}
      </div>
      <div className="grid gap-0.5 border-t border-hair pt-2.5 text-[.66rem] text-soft">
        <span>{samples}</span>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  )
}

function Pulse({ series, caption }: { series: { index: number; count: number }[]; caption: string }) {
  const peak = Math.max(1, ...series.map((item) => item.count))
  if (!series.length) return <p className="text-[.7rem] text-soft">لا نبض بعد في هذه الفترة.</p>
  return (
    <div>
      {/* أعمدةٌ من الأحدث إلى الأقدم — الفهرس صفر هو الآن. */}
      <div dir="ltr" className="flex h-16 items-end justify-end gap-1">
        {[...series].reverse().map((item) => (
          <span
            key={item.index}
            title={`${arabicNumber(item.count)} حدثاً`}
            style={{ height: `${Math.max(6, (item.count / peak) * 100)}%` }}
            className="w-3 rounded-t-sm bg-accent/[.55]"
          />
        ))}
      </div>
      <p className="mt-2 text-[.64rem] text-soft">{caption}</p>
    </div>
  )
}

function EmptyRow({ children, span }: { children: ReactNode; span: number }) {
  return <tr><td colSpan={span} className="py-6 text-center text-[.74rem] text-soft">{children}</td></tr>
}

const DORMANCY_TITLES: Record<DormancyBucket, string> = {
  idle30: 'بلا استخدام منذ ٣٠ يوماً',
  idle60: 'بلا استخدام منذ ٦٠ يوماً',
  idle90: 'بلا استخدام منذ ٩٠ يوماً',
  openedWithoutResult: 'تُفتح ولا تنتج نتيجة',
  mostlyRejected: 'نتائجها تُرفض غالباً',
}

/* ── اللوحة ──────────────────────────────────────────────────────── */

export function UsageAnalytics() {
  const [days, setDays] = useState(30)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [granularity, setGranularity] = useState<'week' | 'month'>('week')
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [adminRows, setAdminRows] = useState<AdminUsageRow[]>([])
  const [meta, setMeta] = useState<{ window: Window | null; truncated: boolean }>({ window: null, truncated: false })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tracking, setTracking] = useState(() => isAdminUsageTrackingEnabled())
  const [testSession, setTestSession] = useState(() => isTestSession())
  const [purged, setPurged] = useState<number | null>(null)

  /* الفترة المخصّصة لا تُطبَّق حتى تكتمل وتصحّ؛ وإلا نبقى على آخر فترة سليمة. */
  const range = useMemo(() => {
    if (customMode && customFrom && customTo) {
      const from = Date.parse(customFrom)
      const to = Date.parse(customTo)
      if (Number.isFinite(from) && Number.isFinite(to) && to > from) {
        return { days: Math.max(1, Math.min(365, Math.round((to - from) / DAY))), until: new Date(to + DAY).toISOString() }
      }
    }
    return { days, until: '' }
  }, [customFrom, customMode, customTo, days])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError('')
      try {
        const app = await getFirebaseApp()
        if (!app) throw new Error('Firebase غير متاح')
        const [{ getAuth }, { collection, getDocs, getFirestore, limit, orderBy, query, where, Timestamp }] =
          await Promise.all([import('firebase/auth'), import('firebase/firestore')])
        const user = getAuth(app).currentUser
        if (!user) throw new Error('انتهت جلسة المشرف')
        const token = await user.getIdToken()
        /* ضِعف النافذة: الفترة الحالية وسابقتها في نداءٍ واحد. */
        const untilMs = range.until ? Date.parse(range.until) : Date.now()
        const query1 = `days=${range.days}&compare=1${range.until ? `&to=${encodeURIComponent(range.until)}` : ''}`
        const [response, adminSnapshot] = await Promise.all([
          fetch(`/api/admin/analytics/events?${query1}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }),
          getDocs(query(
            collection(getFirestore(app), 'admin_tool_events'),
            where('createdAt', '>=', Timestamp.fromDate(new Date(untilMs - range.days * 2 * DAY))),
            orderBy('createdAt', 'desc'), limit(8000),
          )).catch(() => null),
        ])
        if (!response.ok) throw new Error('تعذّر جلب أحداث الاستخدام الفعلي')
        const payload = await response.json() as { items?: UsageEvent[]; window?: Window; truncated?: boolean }
        if (!active) return
        setEvents(Array.isArray(payload.items) ? payload.items : [])
        setMeta({ window: payload.window || null, truncated: Boolean(payload.truncated) })
        setAdminRows(excludeTestSessions(
          (adminSnapshot?.docs || [])
            .map((entry) => normalizeUsageRow({ id: entry.id, ...(entry.data() as Record<string, unknown>) }))
            .filter((row): row is AdminUsageRow => Boolean(row))
            .filter((row) => row.at < untilMs),
        ))
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'تعذّر التحميل')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [range.days, range.until])

  /* ── الزوار: الفترة الحالية مقابل السابقة ── */
  const publicSummary = useMemo(() => {
    const untilMs = range.until ? Date.parse(range.until) : Date.now()
    const span = range.days * DAY
    const inWindow = (from: number, to: number) => events.filter((item) => {
      const at = Date.parse(item.createdAt)
      return Number.isFinite(at) && at >= from && at < to
    })
    const current = inWindow(untilMs - span, untilMs)
    const previous = inWindow(untilMs - span * 2, untilMs - span)
    const count = (rows: UsageEvent[], name: string) => rows.filter((item) => item.name === name).length
    const rate = (rows: UsageEvent[], part: string, whole: string) => {
      const total = count(rows, whole)
      return total ? count(rows, part) / total : null
    }
    const searches = (rows: UsageEvent[]) => rows.filter((item) => item.name === 'search_submitted' || item.name === 'search_refined')

    const queries = new Map<string, number>()
    const zeros = new Map<string, number>()
    for (const item of searches(current)) {
      const value = String(item.props.query || '')
      if (value && value !== '[redacted]') queries.set(value, (queries.get(value) || 0) + 1)
    }
    for (const item of current.filter((row) => row.name === 'search_zero_results')) {
      const value = String(item.props.query || '')
      if (value && value !== '[redacted]') zeros.set(value, (zeros.get(value) || 0) + 1)
    }
    const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

    const vitals = ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'].map((metric) => {
      const rows = current.filter((item) => item.name === 'web_vital' && item.props.metric === metric)
      const values = (subset: UsageEvent[]) => subset.map((item) => Number(item.props.value)).filter(Number.isFinite)
      return {
        metric,
        value: p75(values(rows)),
        samples: rows.length,
        mobile: p75(values(rows.filter((item) => item.device === 'mobile'))),
        desktop: p75(values(rows.filter((item) => item.device === 'desktop'))),
      }
    })

    return {
      currentCount: current.length,
      previousCount: previous.length,
      atlas: {
        discovery: rate(current, 'atlas_discovered', 'atlas_impression'),
        impressions: count(current, 'atlas_impression'),
        interactions: compareValue(count(current, 'atlas_interaction'), count(previous, 'atlas_interaction')),
      },
      search: {
        total: compareValue(searches(current).length, searches(previous).length),
        success: rate(current, 'search_result_opened', 'search_submitted'),
        zero: count(current, 'search_zero_results'),
        queries: top(queries),
        zeros: top(zeros),
      },
      living: {
        started: count(current, 'living_mind_started'),
        completion: rate(current, 'living_mind_completed', 'living_mind_started'),
        used: compareValue(count(current, 'living_mind_result_used'), count(previous, 'living_mind_result_used')),
      },
      vitals,
    }
  }, [events, range.days, range.until])

  /* ── الأدوات: الفترة الحالية مقابل السابقة ── */
  const toolSummary = useMemo(() => {
    const untilMs = range.until ? Date.parse(range.until) : Date.now()
    const span = range.days * DAY
    const current = withinWindow(adminRows, untilMs - span, untilMs)
    const previous = withinWindow(adminRows, untilMs - span * 2, untilMs - span)
    const tools = summarizeTools(current, untilMs)
    const previousTools = new Map(summarizeTools(previous, untilMs - span).map((tool) => [tool.tool, tool]))
    const sum = (rows: ToolUsage[], key: keyof ToolUsage) => rows.reduce((total, row) => total + Number(row[key] || 0), 0)
    return {
      tools,
      previousTools,
      /* الخمول يُقاس على كل ما لدينا لا على الفترة وحدها — أداةٌ صامتة منذ سنة
         لن تظهر أبداً لو حصرنا النظر في آخر ثلاثين يوماً. */
      dormancy: classifyDormancy(summarizeTools(adminRows, untilMs)),
      recommendations: summarizeRecommendations(current),
      workflows: extractWorkflows(current),
      pulse: bucketByPeriod(current, granularity, untilMs),
      totals: {
        opened: compareValue(sum(tools, 'opened'), sum([...previousTools.values()], 'opened')),
        generated: compareValue(sum(tools, 'generated'), sum([...previousTools.values()], 'generated')),
        decisions: compareValue(sum(tools, 'accepted') + sum(tools, 'converted'), sum([...previousTools.values()], 'accepted') + sum([...previousTools.values()], 'converted')),
        abandoned: compareValue(sum(tools, 'abandoned'), sum([...previousTools.values()], 'abandoned')),
      },
      events: current.length,
      previousEvents: previous.length,
    }
  }, [adminRows, granularity, range.days, range.until])

  const periodLabel = customMode && range.until
    ? `${customFrom} ← ${customTo}`
    : `آخر ${arabicCountPhrase(range.days, DAY_FORMS, arabicNumber)}`
  const hasData = events.length > 0 || adminRows.length > 0

  return (
    <section className="grid gap-4" aria-labelledby="actual-usage-title">
      {/* ── الترويسة والفترة ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.72rem] font-semibold text-accent">التحليلات</p>
          <h2 id="actual-usage-title" className="font-display text-xl font-semibold text-ink">الاستخدام الفعلي</h2>
          <p className="mt-1 text-[.7rem] text-soft">{periodLabel} · مقارنةً بالفترة السابقة لها مباشرة</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => { setCustomMode(false); setDays(value) }}
              aria-pressed={!customMode && days === value}
              className={`rounded-full px-4 py-2 text-[.75rem] transition-colors ${!customMode && days === value ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}
            >
              {arabicCountPhrase(value, DAY_FORMS, arabicNumber)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomMode(true)
              if (!customFrom) setCustomFrom(isoDay(Date.now() - 30 * DAY))
              if (!customTo) setCustomTo(isoDay(Date.now()))
            }}
            aria-pressed={customMode}
            className={`rounded-full px-4 py-2 text-[.75rem] transition-colors ${customMode ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}
          >
            فترة مخصّصة
          </button>
        </div>
      </div>

      {customMode && (
        <div className={`${CARD} flex flex-wrap items-center gap-3 text-[.74rem] text-soft`}>
          <label className="flex items-center gap-2">من
            <input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-lg border border-hair bg-wash px-3 py-1.5 text-ink" />
          </label>
          <label className="flex items-center gap-2">إلى
            <input type="date" value={customTo} min={customFrom || undefined} max={isoDay(Date.now())} onChange={(event) => setCustomTo(event.target.value)} className="rounded-lg border border-hair bg-wash px-3 py-1.5 text-ink" />
          </label>
          <span>المدى الأقصى سنة واحدة؛ والمقارنة تُحسب على مدىً مساوٍ يسبقه.</span>
        </div>
      )}

      {loading && <div className={CARD}>أجمع الأحداث والعينات…</div>}
      {error && <div className={`${CARD} border-accent/[.45] text-soft`}>{error}</div>}

      {!loading && !error && !hasData && (
        <div className={`${CARD} grid gap-2`}>
          <strong className="text-ink">لا توجد بيانات في هذه الفترة.</strong>
          <p className="text-[.76rem] leading-relaxed text-soft">
            لن تُعرض أرقامٌ مُختلقة ولا أصفارٌ تُقرأ حكماً. وسّع الفترة، أو تحقّق من تفعيل القياس بالأسفل.
          </p>
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          {meta.truncated && (
            <p className="rounded-2xl border border-hair bg-wash/[.5] px-4 py-3 text-[.72rem] text-soft">
              العيّنة بُترت عند الحد الأعلى للاستعلام؛ الأرقام أدناه لأحدث الأحداث في الفترة لا لكلها.
            </p>
          )}

          {/* ── بطاقات الزوار ── */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="اكتشاف الأطلس"
              value={formatPercent(publicSummary.atlas.discovery)}
              samples={`${arabicNumber(publicSummary.atlas.impressions)} ظهور في الفترة`}
            />
            <StatCard
              label="تفاعل الأطلس"
              value={arabicNumber(publicSummary.atlas.interactions.current)}
              delta={publicSummary.atlas.interactions}
              samples={`السابقة ${arabicNumber(publicSummary.atlas.interactions.previous)}`}
            />
            <StatCard
              label="نجاح البحث"
              value={formatPercent(publicSummary.search.success)}
              delta={publicSummary.search.total}
              samples={`${arabicNumber(publicSummary.search.total.current)} عملية بحث`}
              hint={`بلا نتائج ${arabicNumber(publicSummary.search.zero)}`}
            />
            <StatCard
              label="اكتمال العقل الحي"
              value={formatPercent(publicSummary.living.completion)}
              delta={publicSummary.living.used}
              samples={`${arabicNumber(publicSummary.living.started)} محاولة بدأت`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className={CARD}>
              <h3 className="font-semibold text-ink">عمليات البحث</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[.7rem] text-soft">الأكثر استخداماً</p>
                  <ol className="mt-2 grid gap-2 text-[.78rem]">
                    {publicSummary.search.queries.length
                      ? publicSummary.search.queries.map(([value, count]) => (
                        <li key={value} className="flex justify-between gap-3"><span className="truncate">{value}</span><b>{arabicNumber(count)}</b></li>
                      ))
                      : <li className="text-soft">لا عيّنة</li>}
                  </ol>
                </div>
                <div>
                  <p className="text-[.7rem] text-soft">بلا نتائج</p>
                  <ol className="mt-2 grid gap-2 text-[.78rem]">
                    {publicSummary.search.zeros.length
                      ? publicSummary.search.zeros.map(([value, count]) => (
                        <li key={value} className="flex justify-between gap-3"><span className="truncate">{value}</span><b>{arabicNumber(count)}</b></li>
                      ))
                      : <li className="text-soft">لا عيّنة</li>}
                  </ol>
                </div>
              </div>
            </div>

            <div className={CARD}>
              <h3 className="font-semibold text-ink">Core Web Vitals الحقيقية · p75</h3>
              <div className="mt-4 grid gap-2">
                {publicSummary.vitals.map((item) => (
                  <div key={item.metric} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-t border-hair py-2 first:border-t-0">
                    <b>{item.metric}</b>
                    <span className="text-[.72rem] text-soft">هاتف {item.mobile ?? '—'} · سطح مكتب {item.desktop ?? '—'}</span>
                    <span className="text-[.75rem]">{item.value ?? '—'} <small className="text-soft">({arabicNumber(item.samples)} عينة)</small></span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── استخدام أدواتي ── */}
          <div className="grid gap-4 rounded-2xl border border-hair bg-wash/[.35] p-4 md:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[.7rem] font-semibold text-accent">لوحة المالك الواحد</p>
                <h3 className="font-display text-lg font-semibold text-ink">استخدام أدواتي</h3>
                <p className="mt-1 text-[.7rem] text-soft">
                  {arabicNumber(toolSummary.events)} حدثاً في الفترة · {arabicNumber(toolSummary.previousEvents)} في السابقة · جلسات الاختبار مستبعدة
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[.72rem]">
                {(['week', 'month'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGranularity(value)}
                    aria-pressed={granularity === value}
                    className={`rounded-full px-3 py-1.5 transition-colors ${granularity === value ? 'bg-ink text-canvas' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}
                  >
                    {value === 'week' ? 'أسبوعي' : 'شهري'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="مرات فتح الأدوات" value={arabicNumber(toolSummary.totals.opened.current)} delta={toolSummary.totals.opened} samples={`السابقة ${arabicNumber(toolSummary.totals.opened.previous)}`} />
              <StatCard label="نتائج مُولَّدة" value={arabicNumber(toolSummary.totals.generated.current)} delta={toolSummary.totals.generated} samples={`السابقة ${arabicNumber(toolSummary.totals.generated.previous)}`} />
              <StatCard label="تحوّلت إلى عملٍ حقيقي" value={arabicNumber(toolSummary.totals.decisions.current)} delta={toolSummary.totals.decisions} samples="اعتماد أو تحويل — لا مجرّد ظهور على الشاشة" />
              <StatCard label="مهام متروكة" value={arabicNumber(toolSummary.totals.abandoned.current)} delta={toolSummary.totals.abandoned} samples={`السابقة ${arabicNumber(toolSummary.totals.abandoned.previous)}`} />
            </div>

            <div className={CARD}>
              <h4 className="text-[.8rem] font-semibold text-ink">النبض {granularity === 'week' ? 'الأسبوعي' : 'الشهري'}</h4>
              <div className="mt-3">
                <Pulse
                  series={toolSummary.pulse}
                  caption={`كل عمود ${granularity === 'week' ? 'أسبوع' : 'شهر'} — الأحدث إلى اليمين · ${arabicNumber(toolSummary.events)} حدثاً`}
                />
              </div>
            </div>

            {/* جدول الأدوات */}
            <div className={CARD}>
              <h4 className="text-[.8rem] font-semibold text-ink">لكل أداة: الاستخدام والقيمة الناتجة</h4>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[980px] text-right text-[.74rem]">
                  <thead className="text-[.68rem] text-soft">
                    <tr className="border-b border-hair">
                      <th className="py-2 font-normal">الأداة</th>
                      <th className="font-normal">فتح</th>
                      <th className="font-normal">مكتملة</th>
                      <th className="font-normal">متروكة</th>
                      <th className="font-normal">مقبولة</th>
                      <th className="font-normal">مرفوضة</th>
                      <th className="font-normal">معدّلة</th>
                      <th className="font-normal">تحوّلت</th>
                      <th className="font-normal">فتح ← نتيجة</th>
                      <th className="font-normal">نتيجة ← قرار</th>
                      <th className="font-normal">متوسط الجلسة</th>
                      <th className="font-normal">آخر استخدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toolSummary.tools.length ? toolSummary.tools.map((tool) => (
                      <tr key={tool.tool} className="border-b border-hair last:border-b-0">
                        <td className="py-3 font-semibold text-ink">{adminToolLabel(tool.tool)}</td>
                        <td>{arabicNumber(tool.opened)}</td>
                        <td>{arabicNumber(tool.generated)}</td>
                        <td>{arabicNumber(tool.abandoned)}</td>
                        <td>{arabicNumber(tool.accepted)}</td>
                        <td>{arabicNumber(tool.rejected)}</td>
                        <td>{arabicNumber(tool.edited)}</td>
                        <td>{arabicNumber(tool.converted)}</td>
                        <td>{formatPercent(tool.openToResult)}</td>
                        <td>{formatPercent(tool.resultToAction)}</td>
                        <td className="text-soft">{formatDuration(tool.averageDurationMs)} <small>({arabicNumber(tool.durationSamples)})</small></td>
                        <td className="text-soft">{tool.daysSinceLastUse === null ? 'لا عيّنة' : tool.daysSinceLastUse === 0 ? 'اليوم' : `قبل ${arabicCountPhrase(tool.daysSinceLastUse, DAY_AFTER_PREPOSITION_FORMS, arabicNumber)}`}</td>
                      </tr>
                    )) : <EmptyRow span={12}>لا أحداث أدوات في هذه الفترة.</EmptyRow>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* الأدوات غير المستخدمة */}
            <div className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-[.8rem] font-semibold text-ink">أدوات تستحق نظرة</h4>
                <span className="text-[.66rem] text-soft">تصنيفٌ فقط — لا حذف ولا إخفاء ولا دمج تلقائي</span>
              </div>
              {toolSummary.dormancy.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(Object.keys(DORMANCY_TITLES) as DormancyBucket[]).map((bucket) => {
                    const rows = toolSummary.dormancy.filter((item) => item.bucket === bucket)
                    if (!rows.length) return null
                    return (
                      <div key={bucket} className="rounded-xl border border-hair bg-wash/[.4] p-4">
                        <span className="text-[.68rem] font-semibold text-accent">{DORMANCY_TITLES[bucket]}</span>
                        <ul className="mt-2 grid gap-2 text-[.74rem]">
                          {rows.map((item) => (
                            <li key={`${bucket}-${item.tool}`} className="grid gap-0.5">
                              <b className="text-ink">{adminToolLabel(item.tool)}</b>
                              <span className="text-[.66rem] text-soft">{item.note} · {arabicNumber(item.samples)} عيّنة</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              ) : <p className="mt-3 text-[.74rem] text-soft">لا أداة خاملة ولا مرفوضة النتائج في المدى المتاح.</p>}
            </div>

            {/* التوصيات المتجاهلة */}
            <div className={CARD}>
              <h4 className="text-[.8rem] font-semibold text-ink">التوصيات: ما يُقبل وما يُهمل</h4>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-right text-[.74rem]">
                  <thead className="text-[.68rem] text-soft">
                    <tr className="border-b border-hair">
                      <th className="py-2 font-normal">نوع التوصية</th>
                      <th className="font-normal">ظهرت</th>
                      <th className="font-normal">قُبلت</th>
                      <th className="font-normal">أُهملت</th>
                      <th className="font-normal">معدّل القبول</th>
                      <th className="font-normal">أدوات تقدّمها</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toolSummary.recommendations.length ? toolSummary.recommendations.map((row) => (
                      <tr key={row.type} className="border-b border-hair last:border-b-0">
                        <td className="py-3 font-semibold text-ink">{row.type}</td>
                        <td>{arabicNumber(row.shown)}</td>
                        <td>{arabicNumber(row.used)}</td>
                        <td>{arabicNumber(row.ignored)}</td>
                        <td>{row.acceptanceRate === null ? <span className="text-soft">عيّنة أصغر من الحكم</span> : formatPercent(row.acceptanceRate)}</td>
                        <td className="text-soft">{row.overlappingTools.length ? row.overlappingTools.map(adminToolLabel).join(' · ') : adminToolLabel(row.tools[0] || '')}</td>
                      </tr>
                    )) : <EmptyRow span={6}>لم تُسجَّل توصيةٌ مقبولة أو مهملة في هذه الفترة.</EmptyRow>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* مسارات العمل */}
            <div className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-[.8rem] font-semibold text-ink">مسارات العمل</h4>
                <span className="text-[.66rem] text-soft">{arabicNumber(toolSummary.workflows.sessions)} جلسة عمل في الفترة</span>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="grid gap-3">
                  <div>
                    <p className="text-[.68rem] font-semibold text-accent">مسارات انتهت بقرار</p>
                    <ul className="mt-2 grid gap-2 text-[.74rem]">
                      {toolSummary.workflows.successfulPaths.length ? toolSummary.workflows.successfulPaths.map((item) => (
                        <li key={item.path.join('-')} className="flex flex-wrap items-center gap-1.5">
                          {item.path.map((step, index) => (
                            <span key={`${step}-${index}`} className="flex items-center gap-1.5">
                              {index > 0 && <span aria-hidden className="text-accent">←</span>}
                              <span className="rounded-full border border-hair bg-canvas px-2.5 py-1 text-[.7rem] text-ink">{adminToolLabel(step)}</span>
                            </span>
                          ))}
                          <b className="text-[.68rem] text-soft">×{arabicNumber(item.count)}</b>
                        </li>
                      )) : <li className="text-soft">لا مسار مكتمل بقرار بعد.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[.68rem] font-semibold text-accent">نقاط الانقطاع</p>
                    <ul className="mt-2 grid gap-1.5 text-[.74rem]">
                      {toolSummary.workflows.breakpoints.length ? toolSummary.workflows.breakpoints.map((item) => (
                        <li key={item.tool} className="flex justify-between gap-3">
                          <span>{adminToolLabel(item.tool)} <small className="text-soft">— {item.note}</small></span>
                          <b>{arabicNumber(item.count)}</b>
                        </li>
                      )) : <li className="text-soft">لا انقطاع مسجّل.</li>}
                    </ul>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {([
                    ['أكثر نقاط البداية', toolSummary.workflows.starts.map((item) => [adminToolLabel(item.tool), item.count] as const)],
                    ['أكثر نقاط النهاية', toolSummary.workflows.ends.map((item) => [adminToolLabel(item.tool), item.count] as const)],
                    ['تنقّلات متكرّرة', toolSummary.workflows.transitions.map((item) => [`${adminToolLabel(item.from)} ← ${adminToolLabel(item.to)}`, item.count] as const)],
                  ] as const).map(([title, rows]) => (
                    <div key={title}>
                      <p className="text-[.68rem] font-semibold text-accent">{title}</p>
                      <ul className="mt-2 grid gap-1.5 text-[.72rem]">
                        {rows.length ? rows.map(([label, count]) => (
                          <li key={label} className="flex justify-between gap-2"><span className="truncate">{label}</span><b>{arabicNumber(count)}</b></li>
                        )) : <li className="text-soft">لا عيّنة</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* الخصوصية والتحكّم */}
            <div className={`${CARD} grid gap-3`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-[.8rem] font-semibold text-ink">الخصوصية والتحكّم</h4>
                  <p className="mt-1 text-[.7rem] leading-relaxed text-soft">
                    القياس خاصٌّ بك ولا يظهر في الموقع العام. لا تُسجَّل نصوص المقالات ولا الأفكار — معرّفات العناصر فقط.
                    مدّة الاحتفاظ {arabicCountPhrase(ADMIN_USAGE_RETENTION_DAYS, DAY_FORMS, arabicNumber)} ثم تُمحى.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => { const next = !tracking; setTracking(next); setAdminUsageTracking(next) }}
                    className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent"
                  >
                    {tracking ? 'تعطيل القياس الإداري' : 'تفعيل القياس الإداري'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { const next = !testSession; setTestSession(next); setAdminTestSession(next) }}
                    className={`rounded-full px-4 py-2 text-[.72rem] transition-colors ${testSession ? 'bg-ink text-canvas' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}
                  >
                    {testSession ? 'هذه جلسة اختبار ✓' : 'علّم هذه كجلسة اختبار'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => setPurged(await purgeExpiredAdminUsage())}
                    className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent"
                  >
                    تنظيف ما تجاوز مدّة الاحتفاظ
                  </button>
                </div>
              </div>
              {purged !== null && <p aria-live="polite" className="text-[.7rem] text-soft">حُذف {arabicNumber(purged)} حدثاً منتهي المدّة.</p>}
              <p className="border-t border-hair pt-3 text-[.72rem] font-semibold text-ink">
                هذه توصياتٌ لا قرارات: لا تُحذف أداة ولا تُخفى ولا تُدمج تلقائياً — القرار النهائي لك.
              </p>
            </div>
          </div>
        </>
      )}

      <ContentSyncHealth />
    </section>
  )
}
