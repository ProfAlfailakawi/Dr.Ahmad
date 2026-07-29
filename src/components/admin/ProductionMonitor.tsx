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
  incidents?: ControlIncident[]
  backups?: ControlBackup[]
  weeklyReport?: WeeklyReport
}
type ControlIncident = {
  id: string
  action: string
  status: string
  requestedAt?: string | null
  updatedAt?: string | null
  scoreBefore?: number | null
  scoreAfter?: number | null
  steps?: { id?: string; label?: string; ok?: boolean; durationMs?: number | null; detail?: string }[]
}
type ControlBackup = {
  id: string
  createdAt?: string | null
  lastRestoredAt?: string | null
  ruleCount: number
  hasPersonality?: boolean
  hasBotMessages?: boolean
}
type WeeklyReport = {
  startsAt?: string
  incidents: number
  successful: number
  failed: number
  verifications: number
  availabilityScore?: number | null
  slowestCheck?: { label?: string; durationMs?: number | null } | null
  latestBackupAt?: string | null
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
type RepairStep = { id: string; label: string; ok: boolean; detail: string; durationMs?: number | null }
type RepairProof = { before: number; after: number; checkedAt: string }
type ControlActionResult = {
  ok?: boolean
  message?: string
  incidentId?: string
  backup?: ControlBackup
  restored?: { id?: string; ruleCount?: number }
  steps?: { id?: string; workflow?: string; label?: string; ok?: boolean; error?: string; detail?: string; durationMs?: number | null }[]
}

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

const incidentActionLabel: Record<string, string> = {
  'repair-safe': 'إصلاح آمن شامل',
  'audio-sync': 'مزامنة الصوت',
  'content-guardian': 'حارس المحتوى',
  'deploy-site': 'بوابة النشر',
  'verify-all': 'اختبار اصطناعي',
  'record-proof': 'إثبات واتساب والسرعة',
  'backup-settings': 'نسخة إعدادات',
  'restore-settings': 'استعادة إعدادات',
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

const servicesScore = (services: ControlService[]) => services.length
  ? Math.round(services.reduce((total, service) => total + levelWeight[service.level], 0) / services.length)
  : 0

const durationLabel = (value?: number | null) => {
  if (!Number.isFinite(Number(value))) return ''
  const milliseconds = Math.max(0, Number(value))
  return milliseconds < 1_000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1_000).toFixed(1)} ث`
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
    metric: status.health?.ready ? 'مستمر بلا حد' : status.health?.needsAuthScan ? 'ينتظر المسح' : status.bridgeOnline ? 'الجسر حي' : 'الجسر لا يجيب',
    summary: status.health?.ready
      ? 'متصل ويجيب السؤال الأول وكل متابعة بعده؛ لا يغلق الجلسة إلا ردّ المالك اليدوي.'
      : diagnosis?.summary || status.health?.label || 'حالة واتساب لم تكتمل بعد.',
    reason: firstIssue?.detail || status.health?.why || 'تفحص اللوحة الجسر والنبض والطابور والردود معاً.',
    action: diagnosis?.action || status.health?.fix || (status.health?.ready ? 'لا يحتاج تدخلاً.' : 'استخدم الإحياء الآمن من هذه البطاقة.'),
    lastEventAt: diagnosis?.checkedAt || status.lastHeartbeatAt || status.updated_at || null,
    automation: 'فحص كل 15 ثانية',
  }
}

const previewServices: ControlService[] = [
  { id: 'whatsapp', title: 'مساعد واتساب الحي', eyebrow: 'LIVE WHATSAPP', level: 'healthy', metric: 'مستمر بلا حد', summary: 'يجيب السؤال الأول والثاني وكل متابعة؛ لا يغلق الجلسة إلا ردّ المالك اليدوي.', reason: 'اكتمل فحص الاتصال والجلسة والطابور واختبار 3 رسائل متتالية.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString(), automation: 'فحص كل 15 ثانية' },
  { id: 'audio', title: 'الصوت والعدّاد الحي', eyebrow: 'AUDIO AUTOSYNC', level: 'healthy', metric: '201 ملف', summary: 'فهد 98 · نورة 99 · حوار 4، والرقم من R2 مباشرة.', reason: 'نجح المسح الحي والكتابة والقراءة الراجعة.', action: 'يتجدد تلقائياً كل 15 دقيقة.', lastEventAt: new Date().toISOString(), automation: 'كل 15 دقيقة' },
  { id: 'studio', title: 'استوديو التصاميم والتوليد', eyebrow: 'CREATIVE STUDIO', level: 'healthy', metric: 'المولّد جاهز', summary: 'التوليد والفحص البصري والأرشفة الخاصة تعمل.', reason: 'Cloudflare وFirebase Storage جاهزان.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'firebase', title: 'Firebase والبيانات الحية', eyebrow: 'LIVE DATA', level: 'healthy', metric: 'قراءة ناجحة', summary: 'قاعدة البيانات تقرأ سجلات التشغيل الحية.', reason: 'نجحت القراءة الراجعة من إعدادات النظام.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'content', title: 'المحتوى والمصادر', eyebrow: 'SITE GUARDIAN', level: 'attention', metric: 'يتابع تنبيهين', summary: 'لا توجد مشكلة تمنع النشر؛ الحارس يتابع مصدرين خارجيين.', reason: 'المصدران يحجبان الفحص الآلي لكنهما يعملان للزائر.', action: 'لا يلزم قرار الآن.', lastEventAt: new Date().toISOString() },
  { id: 'publishing', title: 'النشر والاستضافة', eyebrow: 'RELEASE PIPELINE', level: 'healthy', metric: 'آخر نشر ناجح', summary: 'بوابة الاختبارات والاستضافة أنهتا آخر دورة بنجاح.', reason: 'اجتازت النسخة الحراسة قبل وصولها إلى Hosting.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
  { id: 'control-plane', title: 'الخادم وغرفة الأوامر', eyebrow: 'CONTROL PLANE', level: 'healthy', metric: 'متصل', summary: 'واجهة التشخيص والإصلاح تستجيب الآن.', reason: 'تم التحقق من الخادم وجلسة المشرف.', action: 'لا يحتاج تدخلاً.', lastEventAt: new Date().toISOString() },
]
const previewSnapshot: ControlSnapshot = {
  checkedAt: new Date().toISOString(),
  automaticRefreshSeconds: 30,
  safeRepair: { available: true, destructive: false, preservesWhatsAppSession: true },
  services: previewServices,
  incidents: [{
    id: 'preview-proof',
    action: 'verify-all',
    status: 'succeeded',
    requestedAt: new Date().toISOString(),
    scoreBefore: 96,
    scoreAfter: 98,
    steps: [
      { id: 'wa-sequence', label: 'ثلاث رسائل واتساب متتالية', ok: true, durationMs: 41, detail: 'ردّ على 3/3 من دون انقطاع.' },
      { id: 'firebase-probe', label: 'Firebase كتابة وقراءة وحذف', ok: true, durationMs: 88, detail: 'اكتملت القراءة الراجعة.' },
    ],
  }],
  backups: [{ id: 'backup-preview', createdAt: new Date().toISOString(), ruleCount: 12, hasPersonality: true, hasBotMessages: true }],
  weeklyReport: { incidents: 7, successful: 7, failed: 0, verifications: 3, availabilityScore: 100, slowestCheck: { label: 'Firebase', durationMs: 88 }, latestBackupAt: new Date().toISOString() },
}

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
  const [snapshot, setSnapshot] = useState<ControlSnapshot | null>(preview ? previewSnapshot : null)
  const [whatsAppReady, setWhatsAppReady] = useState(preview)
  const [loading, setLoading] = useState(!preview)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [steps, setSteps] = useState<RepairStep[]>([])
  const [proof, setProof] = useState<RepairProof | null>(preview ? { before: 96, after: 98, checkedAt: new Date().toISOString() } : null)
  const [persistentAlert, setPersistentAlert] = useState('')

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
    if (preview) return snapshot
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
      const centerServices = Array.isArray(center.services) ? center.services : []
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
      const nextSnapshot = {
        ...center,
        services: [whatsAppService, ...centerServices.filter((service) => service.id !== 'whatsapp')],
      } as ControlSnapshot
      setSnapshot(nextSnapshot)
      setNotice('')
      return nextSnapshot
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّر فحص المنظومة.')
      return null
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

  const runControlAction = async (action: string, extra: Record<string, unknown> = {}) => authorizedFetch('/api/admin/control-center', {
    method: 'POST',
    body: JSON.stringify({ action, ...extra }),
  }) as Promise<ControlActionResult>

  const verifyEverything = async () => {
    const before = servicesScore(snapshot?.services || [])
    if (preview) {
      const checkedAt = new Date().toISOString()
      setSteps([
        { id: 'wa-sequence', label: 'واتساب · ثلاث رسائل متتالية', ok: true, durationMs: 41, detail: 'ردّ على السؤال الأول والثاني والثالث من نفس السياق بلا انقطاع.' },
        { id: 'firebase-probe', label: 'Firebase · كتابة وقراءة وحذف', ok: true, durationMs: 88, detail: 'نجحت الدورة المؤقتة وحُذف ملف الاختبار.' },
        { id: 'studio-probe', label: 'الاستوديو · ربط التوليد', ok: true, durationMs: 0, detail: 'الإعداد جاهز من دون استهلاك صورة.' },
      ])
      setProof({ before, after: 100, checkedAt })
      setNotice('اكتمل إثبات الاستمرار: واتساب أجاب 3/3، وبقية الطبقات اجتازت القراءة الراجعة.')
      return
    }
    setBusy('verify-all')
    setSteps([])
    setNotice('')
    const whatsappStartedAt = Date.now()
    const [infrastructureResult, whatsappResult] = await Promise.allSettled([
      runControlAction('verify-all', { scoreBefore: before }),
      authorizedFetch('/api/admin/whatsapp/simulate-sequence', {
        method: 'POST',
        body: JSON.stringify({ messages: ['آخر مقالة', 'لخصها', 'عطني غيرها'] }),
      }) as Promise<{ ok?: boolean; continuous?: boolean; sentToWhatsApp?: boolean; turns?: { turn?: number; willReply?: boolean; durationMs?: number; reason?: string }[] }>,
    ])
    const nextSteps: RepairStep[] = []
    if (infrastructureResult.status === 'fulfilled') {
      for (const step of infrastructureResult.value.steps || []) {
        nextSteps.push({
          id: step.id || step.workflow || `probe-${nextSteps.length}`,
          label: step.label || 'اختبار خدمة',
          ok: step.ok !== false,
          durationMs: step.durationMs,
          detail: step.detail || step.error || 'اكتمل الاختبار.',
        })
      }
    } else {
      nextSteps.push({
        id: 'infrastructure',
        label: 'الخدمات السحابية',
        ok: false,
        detail: infrastructureResult.reason instanceof Error ? infrastructureResult.reason.message : 'تعذّر اختبار الخدمات.',
      })
    }
    if (whatsappResult.status === 'fulfilled') {
      const turns = whatsappResult.value.turns || []
      const replied = turns.filter((turn) => turn.willReply).length
      nextSteps.unshift({
        id: 'wa-sequence',
        label: 'واتساب · ثلاث رسائل متتالية',
        ok: whatsappResult.value.continuous === true && replied === 3,
        durationMs: Date.now() - whatsappStartedAt,
        detail: `ردّ المحرك على ${replied}/3 من نفس المحادثة؛ لم تُرسل أي رسالة حقيقية.`,
      })
    } else {
      nextSteps.unshift({
        id: 'wa-sequence',
        label: 'واتساب · ثلاث رسائل متتالية',
        ok: false,
        durationMs: Date.now() - whatsappStartedAt,
        detail: whatsappResult.reason instanceof Error ? whatsappResult.reason.message : 'تعذّرت محاكاة المحادثة.',
      })
    }
    const afterSnapshot = await refresh(true)
    const after = servicesScore(afterSnapshot?.services || snapshot?.services || [])
    const checkedAt = new Date().toISOString()
    setSteps(nextSteps)
    setProof({ before, after, checkedAt })
    const allOk = nextSteps.every((step) => step.ok)
    setNotice(allOk
      ? 'اكتمل الإثبات: واتساب استمر 3/3، ونجحت اختبارات الطبقات الآمنة.'
      : 'اكتمل الفحص؛ السجل يحدد بدقة الاختبار الذي لم يجتز.')
    await runControlAction('record-proof', {
      scoreBefore: before,
      scoreAfter: after,
      steps: nextSteps,
    }).catch(() => undefined)
    setBusy('')
  }

  const backupSettings = async () => {
    if (preview) {
      setSteps([{ id: 'settings-backup', label: 'نسخة إعدادات التشغيل', ok: true, durationMs: 62, detail: 'حُفظت القواعد والشخصية ورسائل البوت.' }])
      setNotice('أُنشئت نسخة احتياطية خاصة قابلة للاستعادة.')
      return
    }
    setBusy('backup-settings')
    try {
      const result = await runControlAction('backup-settings')
      setSteps((result.steps || []).map((step, index) => ({
        id: step.id || `backup-${index}`,
        label: step.label || 'نسخة إعدادات التشغيل',
        ok: step.ok !== false,
        durationMs: step.durationMs,
        detail: step.detail || result.message || 'اكتملت النسخة.',
      })))
      setNotice(result.message || 'أُنشئت النسخة الاحتياطية.')
      await refresh(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّر إنشاء النسخة.')
    } finally {
      setBusy('')
    }
  }

  const restoreBackup = async (backup: ControlBackup) => {
    if (preview) {
      setNotice('وضع المعاينة لا يغيّر الإعدادات.')
      return
    }
    if (!window.confirm(`استعادة نسخة ${safeDate(backup.createdAt)}؟ ستعود قواعد الرد والشخصية ورسائل البوت، ولن تُمس جلسة واتساب أو المحادثات.`)) return
    setBusy(`restore:${backup.id}`)
    try {
      const result = await runControlAction('restore-settings', { backupId: backup.id, confirm: true })
      setSteps((result.steps || []).map((step, index) => ({
        id: step.id || `restore-${index}`,
        label: step.label || 'استعادة الإعدادات',
        ok: step.ok !== false,
        durationMs: step.durationMs,
        detail: step.detail || result.message || 'اكتملت الاستعادة.',
      })))
      setNotice(result.message || 'اكتملت الاستعادة.')
      await refresh(true)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّرت الاستعادة.')
    } finally {
      setBusy('')
    }
  }

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
  const criticalSignature = services.filter((service) => service.level === 'critical').map((service) => service.id).sort().join(',')
  useEffect(() => {
    if (preview) return
    const storageKey = 'control-center:critical-since:v1'
    if (!criticalSignature) {
      try { localStorage.removeItem(storageKey) } catch { /* private mode */ }
      setPersistentAlert('')
      return
    }
    let since = Date.now()
    try {
      const stored = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(stored) && stored > 0) since = stored
      else localStorage.setItem(storageKey, String(since))
    } catch { /* private mode */ }
    const updateAlert = () => {
      if (Date.now() - since < 3 * 60_000) return
      const labels = services.filter((service) => service.level === 'critical').map((service) => service.title).join('، ')
      setPersistentAlert(`استمر العطل الحرج أكثر من 3 دقائق: ${labels}. التشخيص والإصلاح الآمن جاهزان أدناه.`)
    }
    updateAlert()
    const timer = window.setTimeout(updateAlert, Math.max(0, 3 * 60_000 - (Date.now() - since)) + 50)
    return () => window.clearTimeout(timer)
  }, [criticalSignature, preview, services])

  const summary = useMemo(() => {
    const healthy = services.filter((service) => service.level === 'healthy').length
    const attention = services.length - healthy
    const score = servicesScore(services)
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
  const weekly = snapshot?.weeklyReport
  const incidents = snapshot?.incidents || []
  const backups = snapshot?.backups || []

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
              <button type="button" className={darkSecondary} onClick={() => void verifyEverything()} disabled={Boolean(busy)} data-continuous-whatsapp-proof="true">
                {busy === 'verify-all' ? 'يختبر ثلاث رسائل…' : 'أثبت الاستمرار والسرعة'}
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

      {persistentAlert && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-950" role="alert" data-persistent-critical-alert="true">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[.65rem] font-bold">تنبيه ذكي · عطل مستمر</p>
              <p className="mt-1 text-[.74rem] leading-relaxed">{persistentAlert}</p>
            </div>
            <button type="button" className="rounded-full border border-rose-300 px-4 py-2 text-[.7rem] font-bold" onClick={() => void repairAll()} disabled={Boolean(busy)}>ابدأ الإصلاح الآمن</button>
          </div>
        </section>
      )}

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
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="block text-[.7rem] text-ink">{step.label}</strong>
                      {durationLabel(step.durationMs) && <span className="rounded-full bg-wash px-2 py-0.5 text-[.55rem] text-soft" dir="ltr">{durationLabel(step.durationMs)}</span>}
                    </div>
                    <span className="mt-1 block text-[.64rem] leading-relaxed text-soft">{step.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {proof && (
            <div className="mt-4 grid gap-2 rounded-xl border border-accent/15 bg-canvas p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <strong className="block text-[.68rem] text-ink">إثبات قبل / بعد</strong>
                <span className="mt-1 block text-[.62rem] text-soft">قراءة راجعة موثقة في {safeDate(proof.checkedAt)}</span>
              </div>
              <div className="rounded-lg bg-wash px-3 py-2 text-center"><span className="block text-[.55rem] text-soft">قبل</span><strong className="text-sm text-ink">{proof.before}٪</strong></div>
              <div className="rounded-lg bg-accent/[.07] px-3 py-2 text-center"><span className="block text-[.55rem] text-accent">بعد الفحص</span><strong className="text-sm text-accent">{proof.after}٪</strong></div>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-2" data-weekly-operations-report="true">
        <article className="rounded-2xl border border-hair bg-wash p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.65rem] font-bold text-accent">تقرير آخر 7 أيام</p>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">الدليل بدلاً من الانطباع.</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-[.62rem] font-bold ${(weekly?.failed || 0) > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {weekly?.availabilityScore == null ? 'يبدأ التجميع الآن' : `جاهزية ${weekly.availabilityScore}٪`}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['الأحداث', weekly?.incidents ?? 0],
              ['نجحت', weekly?.successful ?? 0],
              ['فشلت', weekly?.failed ?? 0],
              ['إثباتات', weekly?.verifications ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-hair bg-canvas px-3 py-3 text-center">
                <strong className="block text-base text-ink">{value}</strong>
                <span className="mt-0.5 block text-[.57rem] text-soft">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[.63rem] leading-relaxed text-soft">
            {weekly?.slowestCheck?.label
              ? `أبطأ فحص: ${weekly.slowestCheck.label} · ${durationLabel(weekly.slowestCheck.durationMs)}.`
              : 'بعد أول اختبار شامل ستظهر أبطأ طبقة والزمن الفعلي هنا.'}
          </p>
        </article>

        <article className="rounded-2xl border border-hair bg-wash p-4 sm:p-5" data-admin-settings-backup="true">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.65rem] font-bold text-accent">نسخة رجوع خاصة</p>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">قواعد البوت وشخصيته ورسائله.</h3>
            </div>
            <button type="button" className={lightButton} onClick={() => void backupSettings()} disabled={Boolean(busy)}>
              {busy === 'backup-settings' ? 'يحفظ الآن…' : 'أنشئ نسخة الآن'}
            </button>
          </div>
          <p className="mt-3 text-[.67rem] leading-relaxed text-soft">لا تشمل الجلسة أو أرقام الناس أو المحادثات. الاستعادة تعيد إعدادات التشغيل فقط.</p>
          <details className="group mt-3 rounded-xl border border-hair bg-canvas">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-[.68rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <span>{backups.length === 1 ? 'نسخة واحدة محفوظة' : backups.length ? `${backups.length} نسخ محفوظة` : 'لا توجد نسخة بعد'}</span>
              <span className="text-soft transition group-open:rotate-45">＋</span>
            </summary>
            <div className="grid gap-2 border-t border-hair p-3">
              {backups.map((backup) => (
                <div key={backup.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-wash px-3 py-2">
                  <div>
                    <strong className="block text-[.64rem] text-ink">{safeDate(backup.createdAt)}</strong>
                    <span className="text-[.56rem] text-soft">{backup.ruleCount} قاعدة · الشخصية والرسائل</span>
                  </div>
                  <button type="button" className={lightButton} disabled={Boolean(busy)} onClick={() => void restoreBackup(backup)}>
                    {busy === `restore:${backup.id}` ? 'يستعيد…' : 'استعد هذه النسخة'}
                  </button>
                </div>
              ))}
              {!backups.length && <p className="text-[.62rem] text-soft">اضغط «أنشئ نسخة الآن» قبل أي تعديل كبير.</p>}
            </div>
          </details>
        </article>
      </section>

      <section className="rounded-2xl border border-hair bg-wash p-4 sm:p-5" data-incident-history="true">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-[.65rem] font-bold text-accent">سجل الحوادث والإصلاحات</p>
              <h3 className="mt-1 font-display text-lg font-bold text-ink">ماذا حدث ومتى وكيف انتهى؟</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.6rem] text-soft">{incidents.length} سجل</span>
              <span className="text-soft transition group-open:rotate-45">＋</span>
            </div>
          </summary>
          <div className="mt-4 grid gap-2 border-t border-hair pt-4">
            {incidents.map((incident) => {
              const failed = incident.status === 'failed' || incident.steps?.some((step) => step.ok === false)
              return (
                <div key={incident.id} className="grid gap-2 rounded-xl border border-hair bg-canvas p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <span className={`h-2.5 w-2.5 rounded-full ${failed ? 'bg-rose-500' : incident.status === 'accepted' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                  <div>
                    <strong className="block text-[.67rem] text-ink">{incidentActionLabel[incident.action] || incident.action || 'أمر تشغيل'}</strong>
                    <span className="mt-0.5 block text-[.58rem] text-soft">{incident.steps?.[0]?.detail || (failed ? 'يوجد جزء لم يجتز.' : 'اكتمل أو استُلم بنجاح.')}</span>
                  </div>
                  <span className="text-[.58rem] text-soft">{safeDate(incident.requestedAt)}</span>
                </div>
              )
            })}
            {!incidents.length && <p className="text-[.65rem] text-soft">سيبدأ السجل من أول فحص أو إصلاح تنفذه هنا.</p>}
          </div>
        </details>
      </section>

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
