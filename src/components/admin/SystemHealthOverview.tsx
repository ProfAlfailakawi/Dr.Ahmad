import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'

type HealthLevel = 'healthy' | 'attention' | 'warning' | 'critical'
type Service = {
  id: string
  title?: string
  level?: HealthLevel
  metric?: string
  summary?: string
  reason?: string
  lastEventAt?: string | null
}
type Snapshot = { checkedAt?: string; services?: Service[] }

const wanted = [
  { key: 'hosting', source: 'hosting', label: 'Hosting' },
  { key: 'api', source: 'control-plane', label: 'API' },
  { key: 'firestore', source: 'firebase', label: 'Firestore' },
  { key: 'r2', source: 'r2', label: 'R2' },
  { key: 'audio', source: 'audio', label: 'Audio' },
  { key: 'newsletter', source: 'newsletter', label: 'Newsletter' },
] as const

const meta: Record<HealthLevel, { label: string; dot: string; ring: string; text: string }> = {
  healthy: { label: 'سليم', dot: 'bg-emerald-500', ring: 'border-emerald-200/80', text: 'text-emerald-700' },
  attention: { label: 'يعمل ويتابع', dot: 'bg-amber-400', ring: 'border-amber-200/80', text: 'text-amber-800' },
  warning: { label: 'يحتاج انتباه', dot: 'bg-orange-500', ring: 'border-orange-200/80', text: 'text-orange-800' },
  critical: { label: 'متوقف', dot: 'bg-rose-500', ring: 'border-rose-200/80', text: 'text-rose-700' },
}

function safeDate(value?: string | null) {
  if (!value) return 'لا توجد بصمة بعد'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'لا توجد بصمة بعد'
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function SystemHealthOverview() {
  const { user } = useAdminAuth()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async (quiet = false) => {
    if (!user) return
    if (!quiet) setBusy(true)
    setError('')
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/admin/control-center', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({})) as Snapshot & { detail?: string; error?: string }
      if (!response.ok) throw new Error(String(payload.detail || payload.error || 'تعذر قراءة صحة النظام'))
      setSnapshot(payload)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر قراءة صحة النظام')
    } finally {
      if (!quiet) setBusy(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(true), 30_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const rows = useMemo(() => wanted.map((item) => {
    const service = snapshot?.services?.find((candidate) => candidate.id === item.source)
    return { ...item, service }
  }), [snapshot])

  const healthy = rows.filter((row) => row.service?.level === 'healthy').length

  return (
    <section className="rounded-2xl border border-accent/20 bg-accent/[.025] p-4 sm:p-5" data-system-health-overview="true">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.68rem] font-bold uppercase tracking-[.08em] text-accent">System Pulse</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink">ست طبقات حاسمة، في نظرة واحدة.</h2>
          <p className="mt-2 max-w-2xl text-[.76rem] leading-relaxed text-soft">فحص حي من الخادم نفسه؛ لا يعتمد على أن آخر نشر كان ناجحاً فقط.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.68rem] text-soft">{healthy}/6 سليمة</span>
          <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.68rem] font-semibold text-accent transition-colors hover:border-accent disabled:opacity-50">{busy ? 'يفحص…' : 'فحص الآن'}</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {rows.map(({ key, label, service }) => {
          const level: HealthLevel = service?.level || 'warning'
          const style = meta[level]
          return (
            <details key={key} className={`group min-w-0 rounded-xl border bg-canvas ${style.ring}`}>
              <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${service ? style.dot : 'bg-slate-300'}`} aria-hidden="true" />
                  <span className="truncate text-[.62rem] text-soft">{service?.metric || 'بانتظار الفحص'}</span>
                </div>
                <strong dir="ltr" className="mt-3 block truncate text-left text-[.78rem] text-ink">{label}</strong>
                <span className={`mt-1 block text-[.6rem] font-bold ${service ? style.text : 'text-soft'}`}>{service ? style.label : 'غير مقروء'}</span>
              </summary>
              <div className="border-t border-hair px-3 pb-3 pt-2 text-[.61rem] leading-relaxed text-soft">
                <p>{service?.summary || 'لم تصل نتيجة هذه الطبقة بعد.'}</p>
                {service?.reason && <p className="mt-2"><strong className="text-ink">السبب: </strong>{service.reason}</p>}
                <p className="mt-2 text-[.56rem]">آخر بصمة: {safeDate(service?.lastEventAt || snapshot?.checkedAt)}</p>
              </div>
            </details>
          )
        })}
      </div>
      {error && <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[.68rem] text-orange-800">{error}</p>}
    </section>
  )
}
