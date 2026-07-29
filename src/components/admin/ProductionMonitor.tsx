import { useEffect, useMemo, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import type { AdminTab } from './AdminArchitecture'

type HealthLevel = 'healthy' | 'attention' | 'warning' | 'critical'
type WorkflowState = {
  status?: string
  conclusion?: string | null
  updatedAt?: string | null
  url?: string | null
}
type ControlService = {
  id: string
  title: string
  eyebrow: string
  level: HealthLevel
  metric: string
  summary: string
  reason: string
  action: string
  lastEventAt?: string | null
  automation?: string
  workflow?: WorkflowState | null
}
type ControlSnapshot = {
  checkedAt: string
  automaticRefreshSeconds?: number
  safeRepair?: { available?: boolean; destructive?: boolean; preservesWhatsAppSession?: boolean }
  services: ControlService[]
  lastCommand?: { action?: string | null; requestedAt?: string | null }
}
type WhatsAppStatus = {
  status?: string
  bridgeOnline?: boolean
  lastHeartbeatAt?: string | null
  updated_at?: string | null
  diagnostics?: {
    level?: HealthLevel
    title?: string
    summary?: string
    action?: string
    checkedAt?: string
    checks?: { state?: string; detail?: string }[]
    queue?: { pending?: number; leased?: number; failed?: number }
  }
  health?: {
    ready?: boolean
    needsAuthScan?: boolean
    label?: string
    why?: string
    fix?: string
  }
}
type RepairStep = { id: string; label: string; ok: boolean; detail: string }

const levelMeta: Record<HealthLevel, {
  label: string
  dot: string
  pill: string
  border: string
}> = {
  healthy: {
    label: 'سليم',
    dot: 'bg-emerald-500',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    border: 'border-emerald-200/80',
  },
  attention: {
    label: 'يعمل ويتابع',
    dot: 'bg-amber-400',
    pill: 'border-amber-200 bg-amber-50 text-amber-900',
    border: 'border-amber-200/80',
  },
  warning: {
    label: 'يحتاج إصلاحاً',
    dot: 'bg-orange-500',
    pill: 'border-orange-200 bg-orange-50 text-orange-900',
    border: 'border-orange-200/80',
  },
  critical: {
    label: 'متوقف',
    dot: 'bg-rose-500',
    pill: 'border-rose-200 bg-rose-50 text-rose-900',
    border: 'border-rose-200/80',
  },
}

const tabForService: Record<string, AdminTab> = {
  whatsapp: 'whatsapp',
  audio: 'audio-library',
  studio: 'design',
  content: 'content-health',
  publishing: 'dashboard',
  firebase: 'dashboard',
  'control-plane': 'dashboard',
}

const actionForService: Record<string, string> = {
  audio: 'audio-sync',
  content: 'content-guardian',
  publishing: 'deploy-site',
}

const repairLabel: Record<string, string> = {
  whatsapp: 'إحياء واتساب بأمان',
  audio: 'زامن الصوت الآن',
  content: 'شغّل الحارس الآن',
  publishing: 'اختبر وأعد النشر',
}

const levelWeight: Record<HealthLevel, number> = {
  healthy: 100,
  attention: 84,
  warning: 58,
  critical: 18,
}

const safeDate = (value?: string | null) => {
  if (!value) return 'لا توجد بصمة بعد'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'وقت غير معروف'
  return date.toLocaleString('ar-KW-u-nu-latn', {
    timeZone: 'Asia/Kuwait',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const buildWhatsAppService = (status: WhatsAppStatus): ControlService => {
  const diagnosis = status.diagnostics
  const firstIssue = diagnosis?.checks?.find((check) => check.state === 'error' || check.state === 'warning')
  let level: HealthLevel = diagnosis?.level || 'critical'
  if (status.health?.ready) level = 'healthy'
  else if (status.health?.needsAuthScan) level = 'attention'
  else if (status.bridgeOnline === false) level = 'critical'
  return {
    id: 'whatsapp',
    title: 'مساعد واتساب الحي',
    eyebrow: 'LIVE WHATSAPP',
    level,
    metric: status.health?.ready ? 'جاهز للرد' : status.health?.needsAuthScan ? 'ينتظر المسح' : status.bridgeOnline ? 'الجسر حي' : 'الجسر لا يجيب',
    summary: diagnosis?.summary || status.health?.label || 'حالة واتساب لم تكتمل بعد.',
    reason: firstIssue?.detail || status.health?.why || 'تفحص اللوحة الجسر والنبض والطابور والردود معاً.',
    action: diagnosis?.action || status.health?.fix || (status.health?.ready ? 'لا يحتاج تدخلاً.' : 'استخدم الإحياء الآمن من هذه البطاقة.'),
    lastEventAt: diagnosis?.checkedAt || status.lastHeartbeatAt || status.updated_at || null,
    automation: 'فحص كل 15 ثانية',
  }
}

const previewServices: ControlService[] = [
  { id: 'whatsapp', title: 'مساعد واتساب الحي', eyebrow: 'LIVE WHATSAPP', level: 'healthy', metric: 'جاهز للرد', summary: 'الجسر متصل والنبض حديث وطابور الردود خالٍ من التعليق.', reason: 'اكتمل فحص الاتصال والجلسة والطابور وآخر رد.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString(), automation: 'فحص كل 15 ثانية' },
  { id: 'audio', title: 'الصوت والعدّاد الحي', eyebrow: 'AUDIO AUTOSYNC', level: 'healthy', metric: '201 ملف', summary: 'فهد 98 · نورة 99 · حوار 4، والرقم من R2 مباشرة.', reason: 'نجح المسح الحي والكتابة والقراءة الراجعة.', action: 'يتجدد تلقائياً كل 15 دقيقة.', lastEventAt: new Date().toISOString(), automation: 'كل 15 دقيقة' },
  { id: 'studio', title: 'استوديو التصاميم والتوليد', eyebrow: 'CREATIVE STUDIO', level: 'healthy', metric: 'المولّد جاهز', summary: 'التوليد والفحص البصري والأرشفة الخاصة تعمل.', reason: 'Cloudflare وFirebase Storage جاهزان.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'firebase', title: 'Firebase والبيانات الحية', eyebrow: 'LIVE DATA', level: 'healthy', metric: 'قراءة ناجحة', summary: 'قاعدة البيانات تقرأ سجلات التشغيل الحية.', reason: 'نجحت القراءة الراجعة من إعدادات النظام.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'content', title: 'المحتوى والمصادر', eyebrow: 'SITE GUARDIAN', level: 'attention', metric: 'يتابع تنبيهين', summary: 'لا توجد مشكلة تمنع النشر؛ الحارس يتابع مصدرين خارجيين.', reason: 'المصدران يحجبان الفحص الآلي لكنهما يعملان للزائر.', action: 'لا يلزم قرار الآن.', lastEventAt: new Date().toISOString() },
  { id: 'publishing', title: 'النشر والاستضافة', eyebrow: 'RELEASE PIPELINE', level: 'healthy', metric: 'آخر نشر ناجح', summary: 'بوابة الاختبارات والاستضافة أنهتا آخر دورة بنجاح.', reason: 'اجتازت النسخة الحراسة قبل وصولها إلى Hosting.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'control-plane', title: 'الخادم وغرفة الأوامر', eyebrow: 'CONTROL PLANE', level: 'healthy', metric: 'متصل', summary: 'واجهة التشخيص والإصلاح تستجيب الآن.', reason: 'تم التحقق من الخادم وجلسة المشرف.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
]

const primary = 'rounded-full bg-white px-5 py-3 text-[.78rem] font-bold text-[#111821] shadow-sm transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45'
const darkSecondary = 'rounded-full border border-white/20 bg-white/[.055] px-5 py-3 text-[.78rem] font-semibold text-white transition hover:border-white/40 hover:bg-white/[.09] disabled:cursor-not-allowed disabled:opacity-45'
const lightButton = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.72rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'

export function ProductionMonitor({
  articles,
  onOpen,
}: {
  articles: ArticleRecord[]
  onOpen: (tab: AdminTab) => void
}) {
  const { user } = useAdminAuth()
  const preview = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('__ops_preview') === '1'
  const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(preview
    ? { checkedAt: new Date().toISOString(), automaticRefreshSeconds: 30, safeRepair: { available: true, destructive: false, preservesWhatsAppSession: true }, services: previewServices }
    : null)
  const [whatsAppReady, setWhatsAppReady] = useState(preview)
  const [loading, setLoading] = useState(!preview)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [steps, setSteps] = useState<RepairStep[]>([])

  const authorizedFetch = async (path: string, init: RequestInit = {}) => {
    if (!user) throw new Error('انتهت جلسة المشرف؛ سجّل الدخول من جديد.')
    const token = await user.getIdToken()
    const response = await fetch(path, {
      ...init,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(String(payload?.error || 'تعذّر الوصول إلى الخدمة.'))
    return payload
  }

  const refresh = async (quiet = false) => {
    if (preview) return
    if (!quiet) setLoading(true)
    try {
      const [centerResult, whatsAppResult] = await Promise.allSettled([
        authorizedFetch('/api/admin/control-center'),
        authorizedFetch('/api/admin/whatsapp/status'),
      ])
      if (centerResult.status !== 'fulfilled' && whatsAppResult.status !== 'fulfilled') {
        throw new Error(centerResult.reason instanceof Error ? centerResult.reason.message : 'تعذّر فحص المنظومة.')
      }
      const center = centerResult.status === 'fulfilled'
        ? centerResult.value as ControlSnapshot
        : { checkedAt: new Date().toISOString(), services: [] }
      const whatsAppService = whatsAppResult.status === 'fulfilled'
        ? buildWhatsAppService(whatsAppResult.value as WhatsAppStatus)
        : {
            id: 'whatsapp',
            title: 'مساعد واتساب الحي',
            eyebrow: 'LIVE WHATSAPP',
            level: 'critical' as const,
            metric: 'تعذّر الفحص',
            summary: 'خدمة واتساب المركزية لم تجب عن الفحص الآمن.',
            reason: whatsAppResult.reason instanceof Error ? whatsAppResult.reason.message : 'الجسر أو الخادم غير متاح.',
            action: 'اضغط الإحياء الآمن؛ الجلسة المحفوظة لن تُمسح.',
            lastEventAt: null,
          }
      setWhatsAppReady(whatsAppResult.status === 'fulfilled' && Boolean((whatsAppResult.value as WhatsAppStatus).health?.ready))
      setSnapshot({
        ...center,
        services: [whatsAppService, ...center.services.filter((service) => service.id !== 'whatsapp')],
      })
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّر فحص المنظومة.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  useEffect(() => {
    if (!user || preview) return
    void refresh()
    const tick = () => { if (document.visibilityState === 'visible') void refresh(true) }
    const timer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, preview])

  const runControlAction = async (action: string) => authorizedFetch('/api/admin/control-center', {
    method: 'POST',
    body: JSON.stringify({ action }),
  }) as Promise<{ ok?: boolean; message?: string; steps?: { workflow?: string; label?: string; ok?: boolean; error?: string }[] }>

  const repairAll = async () => {
    if (preview) {
      setSteps([
        { id: 'whatsapp', label: 'واتساب', ok: true, detail: 'سليم؛ لم نعد تشغيله بلا حاجة.' },
        { id: 'audio', label: 'الصوت', ok: true, detail: 'بدأ مسح R2 والقراءة الراجعة.' },
        { id: 'content', label: 'المحتوى', ok: true, detail: 'بدأ الحارس فحصه الآمن.' },
      ])
      setNotice('بدأ الإصلاح الآمن؛ لم يُحذف شيء ولم تُمس جلسة واتساب.')
      return
    }
    setBusy('repair-safe')
    setSteps([])
    setNotice('')
    const requests: Promise<RepairStep>[] = [
      runControlAction('repair-safe').then((result) => ({
        id: 'automatic-services',
        label: 'الصوت والمحتوى',
        ok: result.steps?.every((step) => step.ok !== false) !== false,
        detail: result.message || 'بدأت مهام الإصلاح الآمن.',
      })),
      whatsAppReady
        ? Promise.resolve({ id: 'whatsapp', label: 'واتساب', ok: true, detail: 'سليم؛ لم نعد تشغيله بلا حاجة.' })
        : authorizedFetch('/api/admin/whatsapp/recover', {
            method: 'POST',
            body: JSON.stringify({ confirm: true }),
          }).then((result) => ({
            id: 'whatsapp',
            label: 'واتساب',
            ok: true,
            detail: String(result?.message || 'أُرسل الإحياء الآمن مع إبقاء الجلسة.'),
          })),
    ]
    const results = await Promise.allSettled(requests)
    const nextSteps = results.map((result, index): RepairStep => result.status === 'fulfilled'
      ? result.value
      : {
          id: index === 0 ? 'automatic-services' : 'whatsapp',
          label: index === 0 ? 'الصوت والمحتوى' : 'واتساب',
          ok: false,
          detail: result.reason instanceof Error ? result.reason.message : 'تعذّر بدء الإصلاح.',
        })
    setSteps(nextSteps)
    setNotice(nextSteps.every((step) => step.ok)
      ? 'بدأ الإصلاح الآمن بالكامل. ستتحدث الحالة تلقائياً عند وصول النتائج.'
      : 'بدأت الأجزاء المتاحة، ويوضح السجل أدناه الجزء الذي لم يبدأ.')
    setBusy('')
    window.setTimeout(() => void refresh(true), 4_000)
  }

  const repairService = async (service: ControlService) => {
    if (preview) {
      setSteps([{ id: service.id, label: service.title, ok: true, detail: 'بدأ الإصلاح الآمن لهذه الخدمة.' }])
      return
    }
    setBusy(service.id)
    setNotice('')
    try {
      if (service.id === 'whatsapp') {
        const result = await authorizedFetch('/api/admin/whatsapp/recover', {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        })
        setSteps([{ id: service.id, label: service.title, ok: true, detail: String(result?.message || 'بدأ الإحياء الآمن.') }])
      } else {
        const action = actionForService[service.id]
        if (!action) return onOpen(tabForService[service.id] || 'dashboard')
        const result = await runControlAction(action)
        setSteps([{
          id: service.id,
          label: service.title,
          ok: result.steps?.every((step) => step.ok !== false) !== false,
          detail: result.message || 'بدأت المهمة.',
        }])
      }
      setNotice('استلمت المنظومة الأمر. ستتحدث هذه البطاقة تلقائياً.')
      window.setTimeout(() => void refresh(true), 4_000)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'تعذّر بدء الإصلاح.'
      setSteps([{ id: service.id, label: service.title, ok: false, detail }])
      setNotice(detail)
    } finally {
      setBusy('')
    }
  }

  const services = snapshot?.services || []
  const summary = useMemo(() => {
    const healthy = services.filter((service) => service.level === 'healthy').length
    const attention = services.length - healthy
    const score = services.length
      ? Math.round(services.reduce((total, service) => total + levelWeight[service.level], 0) / services.length)
      : 0
    const critical = services.some((service) => service.level === 'critical')
    const warning = services.some((service) => service.level === 'warning')
    return {
      healthy,
      attention,
      score,
      title: critical ? 'هناك خدمة متوقفة، والتشخيص جاهز.' : warning ? 'المنظومة تعمل، ويوجد إصلاح واضح.' : attention ? 'المنظومة تعمل وتتابع نفسها.' : 'المنظومة تعمل باحترافية.',
      subtitle: critical
        ? 'لن نخفي العطل: افتح البطاقة المتوقفة أو استخدم الإصلاح الآمن.'
        : 'الفحص حي، والإصلاحات الدورية تعمل من دون تدخل برمجي.',
    }
  }, [services])
  const publishedArticles = articles.filter((article) => !article._cms.hidden).length

  return (
    <div className="grid min-w-0 gap-5" data-autopilot-control-center="true">
      <section className="relative isolate min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[#111821] px-5 py-6 text-white shadow-[0_32px_90px_-60px_rgba(8,15,25,.9)] sm:px-7 sm:py-8 lg:px-9">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_12%,rgba(93,142,183,.26),transparent_34%),radial-gradient(circle_at_8%_100%,rgba(52,211,153,.09),transparent_30%),linear-gradient(135deg,transparent,rgba(255,255,255,.025))]" />
        <div className="pointer-events-none absolute -left-16 top-8 -z-10 h-56 w-56 rounded-full border border-white/[.055]" />
        <div className="pointer-events-none absolute -left-6 top-18 -z-10 h-36 w-36 rounded-full border border-white/[.07]" />
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.055] px-3 py-1.5 text-[.62rem] font-bold tracking-[.18em] text-white/75">
                <span className={`h-2 w-2 rounded-full ${summary.score >= 80 ? 'bg-emerald-400' : summary.score >= 55 ? 'bg-amber-400' : 'bg-rose-400'} ${loading ? 'animate-pulse' : ''}`} />
                AUTOPILOT CONTROL
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1.5 text-[.63rem] text-white/55">يتحدث تلقائياً كل 30 ثانية</span>
            </div>
            <p className="text-[.68rem] font-semibold text-white/50">مركز التشغيل الذاتي</p>
            <h2 className="mt-2 max-w-3xl font-display text-[clamp(1.7rem,4vw,3.1rem)] font-bold leading-[1.2]">{summary.title}</h2>
            <p className="mt-3 max-w-2xl text-[.82rem] leading-7 text-white/62 sm:text-[.88rem]">{summary.subtitle}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => void repairAll()} disabled={Boolean(busy)} data-safe-repair-all="true">
                {busy === 'repair-safe' ? 'يجري الفحص والإصلاح…' : 'افحص وأصلح الآمن كله'}
              </button>
              <button type="button" className={darkSecondary} onClick={() => void refresh()} disabled={loading || Boolean(busy)}>
                {loading ? 'يفحص الآن…' : 'فحص جديد'}
              </button>
            </div>
            <p className="mt-3 text-[.65rem] leading-relaxed text-white/42">لا يحذف محتوى، ولا يمس جلسة واتساب، ولا يعيد النشر ضمن الإصلاح العام.</p>
          </div>
          <div className="grid min-w-[250px] grid-cols-3 gap-2 lg:w-[330px]">
            {[
              ['سلامة المنظومة', `${summary.score}٪`],
              ['خدمات سليمة', `${summary.healthy}/${services.length || '—'}`],
              ['مادة منشورة', String(publishedArticles)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[.045] px-3 py-4 text-center backdrop-blur">
                <strong className="block font-display text-xl text-white sm:text-2xl">{value}</strong>
                <span className="mt-1 block text-[.58rem] leading-relaxed text-white/45">{label}</span>
              </div>
            ))}
            <div className="col-span-3 flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-[.62rem] text-white/48">
              <span>آخر فحص مؤكد</span>
              <span dir="ltr" className="text-white/70">{safeDate(snapshot?.checkedAt)}</span>
            </div>
          </div>
        </div>
      </section>

      {(notice || steps.length > 0) && (
        <section className="rounded-2xl border border-accent/20 bg-accent/[.035] p-4 sm:p-5" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.68rem] font-bold text-accent">سجل الأمر الأخير</p>
              {notice && <p className="mt-1 text-[.76rem] leading-relaxed text-soft">{notice}</p>}
            </div>
            {steps.length > 0 && <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.62rem] text-soft">{steps.filter((step) => step.ok).length}/{steps.length} بدأ بنجاح</span>}
          </div>
          {steps.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {steps.map((step) => (
                <div key={step.id} className="flex gap-3 rounded-xl border border-hair bg-canvas px-3 py-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${step.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="min-w-0">
                    <strong className="block text-[.7rem] text-ink">{step.label}</strong>
                    <span className="mt-1 block text-[.64rem] leading-relaxed text-soft">{step.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[.67rem] font-bold text-accent">الخدمات الحية</p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink">ماذا يعمل؟ ماذا حدث؟ وكيف يُصلح؟</h3>
          </div>
          <span className="text-[.66rem] text-soft">{summary.attention ? `${summary.attention} تحتاج متابعة واضحة` : 'لا توجد مشكلة تحتاج قرارك'}</span>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {services.map((service) => {
            const meta = levelMeta[service.level]
            const canRepair = service.id === 'whatsapp' || Boolean(actionForService[service.id])
            const healthyRepairHidden = service.level === 'healthy' && service.id !== 'publishing'
            return (
              <article key={service.id} className={`min-w-0 overflow-hidden rounded-2xl border bg-wash ${meta.border}`}>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[.57rem] font-bold tracking-[.16em] text-soft/70">{service.eyebrow}</p>
                      <h4 className="mt-1 font-display text-lg font-bold text-ink">{service.title}</h4>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[.62rem] font-bold ${meta.pill}`}>
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 rounded-xl border border-hair bg-canvas px-3 py-3">
                    <p className="min-w-0 text-[.7rem] leading-relaxed text-soft">{service.summary}</p>
                    <strong className="shrink-0 text-[.72rem] text-ink">{service.metric}</strong>
                  </div>
                  <details className="group mt-3 rounded-xl border border-hair bg-canvas">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-[.7rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                      <span>التشخيص بالتفصيل</span>
                      <span className="text-soft transition group-open:rotate-45">＋</span>
                    </summary>
                    <div className="grid gap-3 border-t border-hair px-3 py-4 sm:grid-cols-2">
                      <div>
                        <span className="text-[.58rem] font-bold text-accent">لماذا هذه الحالة؟</span>
                        <p className="mt-1 text-[.66rem] leading-relaxed text-soft">{service.reason}</p>
                      </div>
                      <div>
                        <span className="text-[.58rem] font-bold text-accent">ماذا أفعل؟</span>
                        <p className="mt-1 text-[.66rem] leading-relaxed text-soft">{service.action}</p>
                      </div>
                      <div>
                        <span className="text-[.58rem] font-bold text-accent">آخر بصمة</span>
                        <p className="mt-1 text-[.66rem] text-soft">{safeDate(service.lastEventAt)}</p>
                      </div>
                      <div>
                        <span className="text-[.58rem] font-bold text-accent">الحماية الآلية</span>
                        <p className="mt-1 text-[.66rem] text-soft">{service.automation || 'فحص عند فتح اللوحة وكل 30 ثانية'}</p>
                      </div>
                      {service.workflow?.url && (
                        <a href={service.workflow.url} target="_blank" rel="noreferrer" className="text-[.65rem] font-semibold text-accent underline decoration-accent/30 underline-offset-4 sm:col-span-2">
                          افتح سجل التنفيذ الموثّق
                        </a>
                      )}
                    </div>
                  </details>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canRepair && !healthyRepairHidden && (
                      <button type="button" className={lightButton} onClick={() => void repairService(service)} disabled={Boolean(busy)}>
                        {busy === service.id ? 'يبدأ الآن…' : repairLabel[service.id] || 'إصلاح هذه الخدمة'}
                      </button>
                    )}
                    <button type="button" className={lightButton} onClick={() => onOpen(tabForService[service.id] || 'dashboard')}>
                      افتح الأداة الكاملة
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
          {!services.length && (
            <div className="rounded-2xl border border-hair bg-wash p-6 text-center text-[.78rem] text-soft xl:col-span-2">
              {loading ? 'يجري جمع حالة الخدمات الحية…' : 'لم تصل حالة الخدمات بعد. اضغط «فحص جديد».'}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-hair bg-wash p-4 sm:p-5">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-[.67rem] font-bold text-accent">حدود الأمان</p>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">ما الذي لا يفعله الإصلاح العام؟</h3>
            </div>
            <span className="text-soft transition group-open:rotate-45">＋</span>
          </summary>
          <div className="mt-4 grid gap-2 border-t border-hair pt-4 sm:grid-cols-3">
            {[
              ['جلسة واتساب', 'لا يمسحها ولا يطلب QR إذا كانت سليمة.'],
              ['المحتوى والملفات', 'لا يحذف مادة أو صورة أو صوتاً بقرار جماعي.'],
              ['النشر العام', 'لا ينشر تلقائياً ضمن زر الإصلاح؛ له زر مستقل وبوابة اختبارات.'],
            ].map(([title, note]) => (
              <div key={title} className="rounded-xl border border-hair bg-canvas p-3">
                <strong className="text-[.68rem] text-ink">{title}</strong>
                <p className="mt-1 text-[.63rem] leading-relaxed text-soft">{note}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  )
}
