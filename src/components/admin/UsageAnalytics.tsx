import { useEffect, useMemo, useState } from 'react'
import { getFirebaseApp } from '../../lib/firebase'
import { ContentSyncHealth } from './ContentSyncHealth'
import { isAdminUsageTrackingEnabled, setAdminUsageTracking } from '../../lib/admin-usage'

type UsageEvent = { id: string; name: string; sessionId: string; path: string; referrerPath: string; device: 'mobile' | 'desktop'; props: Record<string, unknown>; createdAt: string }
type AdminEvent = { id: string; name?: string; tool?: string; durationMs?: number; finalAction?: string; createdAt?: { seconds?: number }; testSession?: boolean }
const card = 'rounded-2xl border border-hair bg-canvas p-5'

function p75(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * .75) - 1)]
}
const percent = (part: number, total: number) => total ? `${Math.round(part / total * 100)}%` : 'لا بيانات'
const eventCount = (events: UsageEvent[], name: string) => events.filter((item) => item.name === name).length

export function UsageAnalytics() {
  const [days, setDays] = useState(30)
  const [events, setEvents] = useState<UsageEvent[]>([])
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tracking, setTracking] = useState(() => isAdminUsageTrackingEnabled())

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true); setError('')
      try {
        const app = await getFirebaseApp()
        if (!app) throw new Error('Firebase غير متاح')
        const [{ getAuth }, { collection, getDocs, getFirestore, limit, orderBy, query, where, Timestamp }] = await Promise.all([import('firebase/auth'), import('firebase/firestore')])
        const user = getAuth(app).currentUser
        if (!user) throw new Error('انتهت جلسة المشرف')
        const token = await user.getIdToken()
        const [response, adminSnapshot] = await Promise.all([
          fetch(`/api/admin/analytics/events?days=${days}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' }),
          getDocs(query(collection(getFirestore(app), 'admin_tool_events'), where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - days * 86400000))), orderBy('createdAt', 'desc'), limit(5000))).catch(() => null),
        ])
        if (!response.ok) throw new Error('تعذّر جلب أحداث الاستخدام الفعلي')
        const payload = await response.json() as { items?: UsageEvent[] }
        if (!active) return
        setEvents(Array.isArray(payload.items) ? payload.items : [])
        setAdminEvents((adminSnapshot?.docs || []).map((doc) => ({ id: doc.id, ...(doc.data() as Omit<AdminEvent, 'id'>) })).filter((item) => !item.testSession))
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'تعذّر التحميل') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [days])

  const summary = useMemo(() => {
    const atlasImpressions = eventCount(events, 'atlas_impression')
    const atlasDiscoveries = eventCount(events, 'atlas_discovered')
    const atlasOpened = events.filter((item) => item.name === 'atlas_opened')
    const atlasInteractions = eventCount(events, 'atlas_interaction')
    const directAtlas = atlasOpened.filter((item) => item.props.entry === 'direct').length
    const atlasSessions = new Set(atlasOpened.map((item) => item.sessionId))
    const interactedSessions = new Set(events.filter((item) => item.name === 'atlas_interaction').map((item) => item.sessionId))
    const bounced = [...atlasSessions].filter((id) => !interactedSessions.has(id)).length

    const searches = events.filter((item) => item.name === 'search_submitted' || item.name === 'search_refined')
    const zero = events.filter((item) => item.name === 'search_zero_results')
    const opened = events.filter((item) => item.name === 'search_result_opened')
    const queryCounts = new Map<string, number>()
    const zeroCounts = new Map<string, number>()
    for (const item of searches) { const q = String(item.props.query || ''); if (q && q !== '[redacted]') queryCounts.set(q, (queryCounts.get(q) || 0) + 1) }
    for (const item of zero) { const q = String(item.props.query || ''); if (q && q !== '[redacted]') zeroCounts.set(q, (zeroCounts.get(q) || 0) + 1) }
    const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)

    const vitals = ['LCP','INP','CLS','TTFB','FCP'].map((metric) => {
      const rows = events.filter((item) => item.name === 'web_vital' && item.props.metric === metric)
      return { metric, value: p75(rows.map((item) => Number(item.props.value)).filter(Number.isFinite)), samples: rows.length,
        mobile: p75(rows.filter((item) => item.device === 'mobile').map((item) => Number(item.props.value)).filter(Number.isFinite)),
        desktop: p75(rows.filter((item) => item.device === 'desktop').map((item) => Number(item.props.value)).filter(Number.isFinite)) }
    })

    const tools = new Map<string, { opened: number; completed: number; abandoned: number; accepted: number; rejected: number; converted: number; last: number; durations: number[] }>()
    for (const item of adminEvents) {
      const name = String(item.tool || 'غير محدد')
      const row = tools.get(name) || { opened: 0, completed: 0, abandoned: 0, accepted: 0, rejected: 0, converted: 0, last: 0, durations: [] }
      if (item.name === 'admin_tool_opened') row.opened += 1
      if (item.name === 'admin_result_generated') row.completed += 1
      if (item.name === 'admin_task_abandoned') row.abandoned += 1
      if (item.name === 'admin_result_accepted') row.accepted += 1
      if (item.name === 'admin_result_rejected') row.rejected += 1
      if (item.name === 'admin_result_converted') row.converted += 1
      if (Number(item.durationMs) > 0) row.durations.push(Number(item.durationMs))
      row.last = Math.max(row.last, Number(item.createdAt?.seconds || 0) * 1000)
      tools.set(name, row)
    }
    return { atlasImpressions, atlasDiscoveries, atlasOpened: atlasOpened.length, directAtlas, atlasInteractions, bounced,
      searches: searches.length, zero: zero.length, opened: opened.length, topQueries: top(queryCounts), zeroQueries: top(zeroCounts), vitals,
      living: { opened: eventCount(events, 'living_mind_opened'), started: eventCount(events, 'living_mind_started'), completed: eventCount(events, 'living_mind_completed'), failed: eventCount(events, 'living_mind_failed'), used: eventCount(events, 'living_mind_result_used'), abandoned: eventCount(events, 'living_mind_abandoned') },
      tools: [...tools.entries()].sort((a, b) => b[1].opened - a[1].opened) }
  }, [adminEvents, events])

  return <section className="grid gap-4" aria-labelledby="actual-usage-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[.72rem] font-semibold text-accent">التحليلات</p><h2 id="actual-usage-title" className="font-display text-xl font-semibold text-ink">الاستخدام الفعلي</h2></div>
      <div className="flex flex-wrap gap-2">{[7,30,90].map((value) => <button key={value} type="button" onClick={() => setDays(value)} className={`rounded-full px-4 py-2 text-[.75rem] ${days === value ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>{value} يوماً</button>)}</div>
    </div>
    {loading && <div className={card}>أجمع الأحداث والعينات…</div>}
    {error && <div className={`${card} border-accent/[.45] text-soft`}>{error}</div>}
    {!loading && !error && !events.length && !adminEvents.length && <div className={card}>لا توجد بيانات كافية بعد. لا تُعرض أرقام صفرية على أنها حكم نهائي.</div>}
    {!loading && (events.length > 0 || adminEvents.length > 0) && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card}><span className="text-[.72rem] text-soft">اكتشاف الأطلس</span><strong className="mt-2 block text-2xl text-ink">{percent(summary.atlasDiscoveries, summary.atlasImpressions)}</strong><span className="text-[.68rem] text-soft">{summary.atlasDiscoveries} ضغط / {summary.atlasImpressions} ظهور</span></div>
        <div className={card}><span className="text-[.72rem] text-soft">استخدام الأطلس</span><strong className="mt-2 block text-2xl text-ink">{summary.atlasInteractions}</strong><span className="text-[.68rem] text-soft">فتح مباشر {summary.directAtlas} · خروج بلا تفاعل {percent(summary.bounced, summary.atlasOpened)}</span></div>
        <div className={card}><span className="text-[.72rem] text-soft">نجاح البحث</span><strong className="mt-2 block text-2xl text-ink">{percent(summary.opened, summary.searches)}</strong><span className="text-[.68rem] text-soft">بلا نتائج {summary.zero} من {summary.searches}</span></div>
        <div className={card}><span className="text-[.72rem] text-soft">اكتمال العقل الحي</span><strong className="mt-2 block text-2xl text-ink">{percent(summary.living.completed, summary.living.started)}</strong><span className="text-[.68rem] text-soft">استخدام نتيجة {summary.living.used} · ترك {summary.living.abandoned}</span></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className={card}><h3 className="font-semibold text-ink">عمليات البحث</h3><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-[.7rem] text-soft">الأكثر استخداماً</p><ol className="mt-2 grid gap-2 text-[.78rem]">{summary.topQueries.length ? summary.topQueries.map(([q,n]) => <li key={q} className="flex justify-between gap-3"><span className="truncate">{q}</span><b>{n}</b></li>) : <li className="text-soft">لا بيانات</li>}</ol></div><div><p className="text-[.7rem] text-soft">بلا نتائج</p><ol className="mt-2 grid gap-2 text-[.78rem]">{summary.zeroQueries.length ? summary.zeroQueries.map(([q,n]) => <li key={q} className="flex justify-between gap-3"><span className="truncate">{q}</span><b>{n}</b></li>) : <li className="text-soft">لا بيانات</li>}</ol></div></div></div>
        <div className={card}><h3 className="font-semibold text-ink">Core Web Vitals الحقيقية · p75</h3><div className="mt-4 grid gap-2">{summary.vitals.map((item) => <div key={item.metric} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 border-t border-hair py-2 first:border-t-0"><b>{item.metric}</b><span className="text-[.72rem] text-soft">هاتف {item.mobile ?? '—'} · سطح مكتب {item.desktop ?? '—'}</span><span className="text-[.75rem]">{item.value ?? '—'} <small className="text-soft">({item.samples} عينة)</small></span></div>)}</div></div>
      </div>
      <div className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-ink">استخدام أدواتي</h3><p className="mt-1 text-[.7rem] text-soft">قياس دلالي للمالك الواحد؛ جلسات الاختبار مستبعدة.</p></div><button type="button" onClick={() => { const next = !tracking; setTracking(next); setAdminUsageTracking(next) }} className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft">{tracking ? 'تعطيل القياس الإداري' : 'تفعيل القياس الإداري'}</button></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-right text-[.75rem]"><thead className="text-soft"><tr><th className="py-2">الأداة</th><th>فتح</th><th>نتائج</th><th>تحويل فعلي</th><th>متروك</th><th>آخر استخدام</th><th>ملاحظة</th></tr></thead><tbody>{summary.tools.length ? summary.tools.map(([tool,row]) => { const daysSince = row.last ? Math.floor((Date.now()-row.last)/86400000) : null; return <tr key={tool} className="border-t border-hair"><td className="py-3 font-semibold text-ink">{tool}</td><td>{row.opened}</td><td>{row.completed}</td><td>{row.converted}</td><td>{row.abandoned}</td><td>{daysSince === null ? '—' : `${daysSince} يوم`}</td><td className="text-soft">{row.opened >= 3 && row.converted === 0 ? 'تُفتح بلا نتيجة عملية' : daysSince !== null && daysSince >= 90 ? 'لم تُستخدم منذ 90 يوماً' : '—'}</td></tr> }) : <tr><td colSpan={7} className="py-6 text-center text-soft">لا توجد أحداث إدارية بعد.</td></tr>}</tbody></table></div></div>
    </>}
    <ContentSyncHealth />
  </section>
}
