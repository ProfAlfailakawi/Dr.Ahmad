import { useEffect, useMemo, useState } from 'react'
import AudienceStudio from './AudienceStudio'
import { BroadcastStudio } from './BroadcastStudio'
import { useAdminAuth } from '../../lib/admin-auth'

type DiagnosticCheck = {
  id: string
  label: string
  state: 'ok' | 'warning' | 'error' | 'info'
  detail: string
}
type WhatsAppDiagnostics = {
  code: string
  level: 'healthy' | 'attention' | 'warning' | 'critical'
  title: string
  summary: string
  action: string
  checkedAt: string
  checks: DiagnosticCheck[]
  queue: { active: number; pending: number; leased: number; held: number; failed: number; staleLeased: number }
  activity: { lastInboundAt: string | null; lastReplyAt: string | null; lastManualAt: string | null }
  privacy: string
}
type AgentStatus = {
  status?: string
  indexed?: number
  last_error?: string | null
  device_name?: string
  updated_at?: string
  flags?: Record<string, boolean>
  runtimePaused?: boolean
  timeZone?: string
  bridgeOnline?: boolean
  lastHeartbeatAt?: string | null
  heartbeatAgeMs?: number | null
  restartRequestedAt?: string | null
  port?: number
  qr?: string | null
  qrImage?: string | null
  qrUpdatedAt?: string | null
  qrAgeMs?: number | null
  qrFingerprint?: string | null
  lastRepairRequestedAt?: string | null
  repairBlockedUntil?: string | null
  repairCooldownMs?: number
  repairAllowed?: boolean
  bridgeVersion?: string | null
  bridgeInstanceId?: string | null
  bridgeStateAt?: string | null
  lastRecoveryRequestedAt?: string | null
  diagnostics?: WhatsAppDiagnostics
  health?: {
    code: string; label: string; why: string; fix: string
    ready: boolean; needsAuthScan: boolean; pollFailures: number
    quietNow: boolean; silenced: number; connected: boolean
  }
  pairing_code?: string | null
}
type ReplyRule = {
  id: string
  name: string
  keywords: string[]
  priority: number
  matchType: 'any' | 'all' | 'exact'
  actionType: 'text' | 'site-content' | 'transfer'
  responseText: string
  contentQuery: string
  enabled: boolean
  updatedAt?: string
}
type RuleVersion = { id: number; createdAt: string }
type Simulation = { willReply?: boolean; why?: string; quietNow?: boolean; intent?: string; mode?: string; confidence?: number; needsHuman?: boolean; ruleId?: string | null; ruleName?: string | null; preview?: string }
type LearningPattern = { id: number; phrase: string; hits: number; intent: string; confirmations: number; evidenceSources?: number; evidenceDays?: number; status: 'learned' | 'observing' | 'ignored'; firstSeenAt?: string; lastSeenAt?: string; learnedAt?: string | null }
type LearningState = { total: number; learned: number; observing: number; ignored: number; policy: string; items: LearningPattern[] }
type AgentScreen = 'live' | 'campaigns' | 'knowledge' | 'conversations' | 'personality' | 'protection'
type KnowledgePersonality = {
  verbosity: 'brief' | 'layered' | 'detailed'
  dialect: 'formal-arabic' | 'kuwaiti-light' | 'neutral-arabic'
  initiative: 'none' | 'one-question' | 'guided'
  signature: 'always'
  memoryConsent: 'explicit'
}
type KnowledgeState = {
  modes: { id: string; label: string; boundary: string }[]
  sourcePolicies: Record<string, string[]>
  evidence: { total: number; enabled: number; lastUpdatedAt: string | null; domains: { domain: string; total: number; enabled: number }[] }
  conversations: {
    active: number; human: number
    intents: { intent: string; total: number; confidence?: number }[]
    gaps: { topic?: string; reason: string; total: number }[]
    answers: { intent: string; total: number }[]
  }
  personality: KnowledgePersonality
  privacy: string
}
type TrustedEvidence = {
  id: string; domain: string; sourceName: string; sourceType: string; title: string
  claim: string; quote: string; url: string; publishedAt: string; retrievedAt: string
  authority: string; enabled: boolean; createdAt?: string; updatedAt?: string
}

const DEFAULT_PERSONALITY: KnowledgePersonality = {
  verbosity: 'layered', dialect: 'kuwaiti-light', initiative: 'one-question', signature: 'always', memoryConsent: 'explicit',
}
const EMPTY_KNOWLEDGE: KnowledgeState = {
  modes: [], sourcePolicies: {}, evidence: { total: 0, enabled: 0, lastUpdatedAt: null, domains: [] },
  conversations: { active: 0, human: 0, intents: [], gaps: [], answers: [] },
  personality: DEFAULT_PERSONALITY,
  privacy: 'تعرض اللوحة أعداداً مجمعة فقط، من دون نصوص الناس أو أرقامهم.',
}
const AGENT_SCREENS: { id: AgentScreen; label: string; hint: string }[] = [
  { id: 'live', label: 'حي الآن', hint: 'الحالة والتشغيل' },
  { id: 'campaigns', label: 'الحملات والجمهور', hint: 'قوائم، بث، واستهداف' },
  { id: 'knowledge', label: 'المعرفة', hint: 'المصادر والفجوات' },
  { id: 'conversations', label: 'المحادثات', hint: 'مؤشرات بلا كشف النصوص' },
  { id: 'personality', label: 'الشخصية', hint: 'النبرة والإيقاع' },
  { id: 'protection', label: 'الحماية', hint: 'السياسات والأدلة' },
]

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent'
const secondary = 'rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'

const stateLabel: Record<string, string> = {
  unconfigured: 'غير مرتبط',
  starting: 'يجري تشغيل الخدمة',
  pairing: 'بانتظار مسح الرمز',
  syncing: 'جاري مزامنة المحادثات',
  authenticated: 'تم المسح — يجري إكمال الاتصال',
  connected: 'متصل',
  disconnected: 'غير متصل',
  reconnecting: 'يعيد الاتصال',
  restarting: 'جارٍ إعادة التشغيل',
  paused: 'متوقف مؤقتاً',
  sending: 'يرسل بعد الاعتماد',
  auth_failure: 'فشل التوثيق — يتطلب مسح الرمز من جديد',
  error: 'يحتاج مراجعة',
}

const emptyRule: Omit<ReplyRule, 'id'> & { id?: string } = {
  name: '',
  keywords: [],
  priority: 0,
  matchType: 'any',
  actionType: 'text',
  responseText: '',
  contentQuery: '',
  enabled: true,
}

function ageLabel(ms?: number | null) {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} ثانية`
  return `${Math.round(ms / 60_000)} دقيقة`
}

function activityLabel(value?: string | null) {
  if (!value) return 'لا يوجد بعد'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'غير معروف'
  return date.toLocaleString('ar-KW-u-nu-latn', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function keywordsText(rule: Partial<ReplyRule>) {
  return Array.isArray(rule.keywords) ? rule.keywords.join('، ') : ''
}

function parseKeywords(value: string) {
  return value.split(/[,،\n]/).map((item) => item.trim()).filter(Boolean)
}

export function WhatsAppAgentPanel() {
  const { user } = useAdminAuth()
  const [status, setStatus] = useState<AgentStatus>({ status: 'unconfigured' })
  const [busy, setBusy] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [recoveringAll, setRecoveringAll] = useState(false)
  const [notice, setNotice] = useState('')
  const [manualJid, setManualJid] = useState('')
  const [rules, setRules] = useState<ReplyRule[]>([])
  const [ruleForm, setRuleForm] = useState<typeof emptyRule>({ ...emptyRule })
  const [ruleVersions, setRuleVersions] = useState<Record<string, RuleVersion[]>>({})
  const [simulateText, setSimulateText] = useState('')
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const [learning, setLearning] = useState<LearningState>({ total: 0, learned: 0, observing: 0, ignored: 0, policy: '', items: [] })
  const [learningBusy, setLearningBusy] = useState(false)
  const [screen, setScreen] = useState<AgentScreen>('live')
  const [knowledge, setKnowledge] = useState<KnowledgeState>(EMPTY_KNOWLEDGE)
  const [personality, setPersonality] = useState<KnowledgePersonality>(DEFAULT_PERSONALITY)
  const [trustedEvidence, setTrustedEvidence] = useState<TrustedEvidence[]>([])
  const [evidenceBusy, setEvidenceBusy] = useState(false)
  const [evidenceForm, setEvidenceForm] = useState({ domain: 'education', sourceName: '', sourceType: 'جامعة أو دورية محكّمة', title: '', claim: '', quote: '', url: '', publishedAt: '', authority: '' })
  const bridge = '/api/admin/whatsapp'

  const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!user) throw new Error('admin-session-missing')
    const token = await user.getIdToken()
    const mapped = path === '/status'
      ? '/status'
      : path.startsWith('/admin/')
        ? path.slice('/admin'.length)
        : path
    const headers = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    }
    const response = await fetch(`${bridge}${mapped}`, { ...init, headers })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'request-failed')
    }
    return response.json()
  }

  const refresh = async () => {
    if (!user) { setNotice('يجب تسجيل الدخول بحساب المشرف لقراءة جهاز واتساب.'); return }
    setBusy(true)
    try {
      const [nextStatus, nextRules, nextLearning, nextKnowledge, nextEvidence] = await Promise.all([
        request<AgentStatus>('/status', { cache: 'no-store' }),
        request<ReplyRule[]>('/admin/rules'),
        request<LearningState>('/admin/learning').catch(() => ({ total: 0, learned: 0, observing: 0, ignored: 0, policy: '', items: [] })),
        request<KnowledgeState>('/admin/knowledge').catch(() => EMPTY_KNOWLEDGE),
        request<TrustedEvidence[]>('/admin/trusted-evidence?limit=80').catch(() => []),
      ])
      setStatus(nextStatus)
      setRules(nextRules)
      setLearning(nextLearning)
      setKnowledge(nextKnowledge)
      setPersonality(nextKnowledge.personality || DEFAULT_PERSONALITY)
      setTrustedEvidence(nextEvidence)
      setNotice('تحدّثت حالة واتساب.')
    } catch {
      setNotice('تعذّر الوصول إلى خدمة واتساب المركزية. افحص خدمة الجسر على السيرفر وحالة الخادم الرئيسي.')
    } finally {
      setBusy(false)
      setRestarting(false)
    }
  }

  const [bridgeAlive, setBridgeAlive] = useState<boolean | null>(null)
  const pingBridge = async () => {
    try {
      const next = await request<AgentStatus>('/status', { cache: 'no-store' })
      const alive = Boolean(next.bridgeOnline)
      setBridgeAlive(alive)
      return alive
    } catch {
      setBridgeAlive(false)
      return false
    }
  }

  const refreshLiveStatus = async () => {
    try {
      const next = await request<AgentStatus>('/status', { cache: 'no-store' })
      setStatus(next)
      setBridgeAlive(Boolean(next.bridgeOnline))
    } catch {
      setBridgeAlive(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void (async () => {
      await pingBridge()
      void refresh()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  /* أثناء الاقتران يتغير رمز واتساب بسرعة، لذلك نفحص الحالة وحدها كل
     ثانيتين بدل تحديث اللوحة الثقيلة كاملة كل 15 ثانية. خارج الاقتران نعود
     إلى الفحص الهادئ المعتاد. بهذه الطريقة لا يبقى رمز منتهي ظاهراً للهاتف. */
  const fastStatusPolling = Boolean(
    status.health?.needsAuthScan
    || ['pairing', 'authenticated', 'syncing'].includes(String(status.status || '')),
  )
  useEffect(() => {
    if (!user) return
    const intervalMs = fastStatusPolling ? 2_000 : 15_000
    const tick = () => { if (document.visibilityState === 'visible') void refreshLiveStatus() }
    const timer = window.setInterval(tick, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshLiveStatus() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fastStatusPolling])

  /* صمتُ البوت: كم محادثةً يصمت فيها الآن، وزرٌّ يُعيده في كلّها بضغطة.
     كان الدكتور يظنّ البوت معطوباً وهو صامتٌ عمداً، بلا سبيلٍ لمعرفة ذلك ولا
     لإعادته إلا بالانتظار ثلاثين دقيقة. */
  const [silence, setSilence] = useState<{ silenced: number; until: string | null }>({ silenced: 0, until: null })
  const [returning, setReturning] = useState(false)

  const loadSilence = async () => {
    try { setSilence(await request<{ silenced: number; until: string | null }>('/admin/silence')) } catch { /* الجسر مغلق */ }
  }
  useEffect(() => { void loadSilence() }, [status.bridgeOnline])

  const toggleEmergencyPause = async () => {
    try {
      const path = status.runtimePaused ? '/admin/agent/resume' : '/admin/agent/pause'
      await request(path, { method: 'POST' })
      setNotice(status.runtimePaused ? 'عادت الردود الآلية وفق قواعد الأمان.' : 'توقفت كل الردود الآلية فوراً. الاتصال والفهرس مستمران فقط.')
      await refresh()
    } catch {
      setNotice('تعذّر تغيير حالة الإيقاف الفوري.')
    }
  }

  const returnBotNow = async () => {
    setReturning(true)
    try {
      const out = await request<{ returned: number }>('/admin/bot-return-all', { method: 'POST' })
      setNotice(out.returned ? `✓ أصبح الإيقاظ متاحاً في ${out.returned} محادثة. لن يبدأ الرد إلا بعد جملة الإيقاظ.` : 'لا توجد محادثة مستلمة يدوياً الآن.')
      await loadSilence()
    } catch {
      setNotice('تعذّر إتاحة الإيقاظ — تأكّد أن الجسر يعمل على السيرفر المخصص.')
    } finally { setReturning(false) }
  }

  const restartBridge = async () => {
    if (!status.bridgeOnline) return setNotice('خدمة الحراسة لا تصل إلى الجسر الآن. ستعيده تلقائياً عند عودة الخادم أو الإنترنت؛ لا تحذف الجلسة.')
    setRestarting(true)
    try {
      await request('/admin/restart', { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setNotice('أُرسل الإصلاح الآمن. ستعيد خدمة الحراسة تشغيل واتساب مع إبقاء الجلسة المحفوظة.')
      setTimeout(() => void refresh(), 4500)
    } catch {
      setRestarting(false)
      setNotice('تعذّر إرسال طلب إعادة التشغيل للجسر.')
    }
  }

  const recoverBridge = async () => {
    if (status.health?.ready) {
      setNotice('الاتصال سليم الآن والبوت جاهز. لا حاجة إلى إصلاح.')
      return
    }
    if (status.health?.needsAuthScan || status.qrImage) {
      setNotice('الخدمة سليمة وتنتظر مصادقة الهاتف فقط: امسح رمز QR الظاهر أعلاه مرة واحدة، ولا تستخدم إعادة الربط.')
      return
    }
    await restartBridge()
  }

  const recoverEverything = async () => {
    setRecoveringAll(true)
    try {
      const result = await request<{ requeued?: number; message?: string }>('/admin/recover', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      })
      setNotice(`${result.message || 'أُرسل الإحياء الآمن.'}${result.requeued ? ` وأُعيد ${result.requeued} أمر عالق إلى الطابور.` : ''}`)
      window.setTimeout(() => void refresh(), 3500)
    } catch (error) {
      setNotice(error instanceof Error && error.message
        ? `تعذّر الإحياء الآمن: ${error.message}`
        : 'تعذّر الإحياء الآمن. حدّث التشخيص لمعرفة الطبقة المتوقفة.')
    } finally {
      setRecoveringAll(false)
    }
  }

  const repairSession = async () => {
    if (!status.bridgeOnline) {
      setNotice('لا يمكن إعادة الربط والجسر متوقف. انتظر عودة خدمة الحراسة ثم حدّث الحالة.')
      return
    }
    if (!window.confirm('هذا الإجراء يمسح جلسة واتساب المحفوظة ويولّد QR جديداً. استخدمه فقط إذا فشل الإصلاح الآمن أو ظهرت حالة «فشل التوثيق». هل تتابع؟')) return
    setRepairing(true)
    try {
      await request('/admin/repair', { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setNotice('بدأت إعادة الربط من الصفر. سيظهر QR جديد هنا تلقائياً؛ امسحه من الهاتف.')
      window.setTimeout(() => void refresh(), 4500)
    } catch (error) {
      setNotice(error instanceof Error && error.message
        ? error.message
        : 'تعذّر إرسال طلب إعادة الربط. جرّب الإصلاح الآمن أولاً ثم حدّث الحالة.')
    } finally {
      setRepairing(false)
    }
  }

  const manualTakeover = async () => {
    if (!manualJid.trim()) return setNotice('اكتب JID المحادثة من واتساب، مثال: 965XXXXXXXX@s.whatsapp.net')
    try { await request('/admin/manual-takeover', { method: 'POST', body: JSON.stringify({ jid: manualJid }) }); setNotice('تم استلام المحادثة يدوياً. توقف البوت فوراً ولن يعود إلا بجملة الإيقاظ.'); await refresh() } catch { setNotice('تعذّر تفعيل الاستلام اليدوي.') }
  }

  const returnBot = async () => {
    if (!manualJid.trim()) return setNotice('اكتب JID المحادثة أولاً.')
    try { await request('/admin/bot-return', { method: 'POST', body: JSON.stringify({ jid: manualJid }) }); setNotice('أصبح الإيقاظ متاحاً لهذه المحادثة. لن يرد البوت حتى تُكتب جملة الإيقاظ.'); await refresh() } catch { setNotice('تعذّر إتاحة الإيقاظ لهذه المحادثة.') }
  }

  const editRule = (rule: ReplyRule) => setRuleForm({ ...rule })

  const resetRule = () => setRuleForm({ ...emptyRule })

  const saveRule = async () => {
    try {
      const saved = await request<ReplyRule>('/admin/rules', { method: ruleForm.id ? 'PATCH' : 'POST', body: JSON.stringify(ruleForm) })
      setNotice(`حُفظت قاعدة: ${saved.name}`)
      resetRule()
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? `تعذّر حفظ القاعدة: ${error.message}` : 'تعذّر حفظ القاعدة.')
    }
  }

  const deleteRule = async (id: string) => {
    try { await request(`/admin/rules/${encodeURIComponent(id)}`, { method: 'DELETE' }); setNotice('حُذفت القاعدة وحُفظت نسخة رجوع.'); await refresh() } catch { setNotice('تعذّر حذف القاعدة.') }
  }

  const loadVersions = async (id: string) => {
    try {
      const versions = await request<RuleVersion[]>(`/admin/rules/${encodeURIComponent(id)}/versions`)
      setRuleVersions((current) => ({ ...current, [id]: versions }))
    } catch {
      setNotice('تعذّر قراءة سجل النسخ لهذه القاعدة.')
    }
  }

  const rollbackRule = async (id: string, versionId: number) => {
    try { await request(`/admin/rules/${encodeURIComponent(id)}/rollback/${versionId}`, { method: 'POST' }); setNotice('رجعت القاعدة إلى نسخة سابقة.'); await refresh(); await loadVersions(id) } catch { setNotice('تعذّر الرجوع للنسخة السابقة.') }
  }

  const runSimulator = async () => {
    if (!simulateText.trim()) return setNotice('اكتب رسالة افتراضية للمحاكي.')
    try { setSimulation(await request<Simulation>('/admin/simulate', { method: 'POST', body: JSON.stringify({ text: simulateText, jid: manualJid || 'simulator@s.whatsapp.net' }) })) } catch { setNotice('تعذّر تشغيل المحاكي.') }
  }

  const updateLearningPattern = async (id: number, status: 'observing' | 'ignored') => {
    setLearningBusy(true)
    try {
      const next = await request<LearningState>(`/admin/learning/${id}/${status}`, { method: 'POST' })
      setLearning(next)
      setNotice(status === 'ignored' ? 'تجاهل البوت هذه الصياغة ولن يتعلمها.' : 'عادت الصياغة للمراقبة المحافظة.')
    } catch {
      setNotice('تعذّر تحديث ذاكرة اللهجة المحلية.')
    } finally {
      setLearningBusy(false)
    }
  }

  const savePersonality = async () => {
    try {
      const saved = await request<KnowledgePersonality>('/admin/personality', { method: 'POST', body: JSON.stringify(personality) })
      setPersonality(saved)
      setKnowledge((current) => ({ ...current, personality: saved }))
      setNotice('حُفظ إيقاع الحوار وحدوده في الوكيل المحلي.')
    } catch { setNotice('تعذّر حفظ شخصية الحوار.') }
  }

  const saveEvidence = async () => {
    if (!evidenceForm.sourceName.trim() || !evidenceForm.title.trim() || !evidenceForm.claim.trim() || !evidenceForm.url.trim()) {
      setNotice('أكمل المصدر والعنوان والادعاء والرابط قبل اعتماد الدليل.')
      return
    }
    setEvidenceBusy(true)
    try {
      const saved = await request<TrustedEvidence>('/admin/trusted-evidence', { method: 'POST', body: JSON.stringify(evidenceForm) })
      setTrustedEvidence((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setEvidenceForm((current) => ({ ...current, title: '', claim: '', quote: '', url: '', publishedAt: '', authority: '' }))
      setNotice('أُضيف الدليل إلى القاعدة الموثوقة. لن يستخدمه البوت إلا بعد اجتياز حارس الادعاء والرابط.')
      const next = await request<KnowledgeState>('/admin/knowledge').catch(() => null)
      if (next) { setKnowledge(next); setPersonality(next.personality || personality) }
    } catch (error) {
      setNotice(error instanceof Error ? `تعذّر اعتماد الدليل: ${error.message}` : 'تعذّر اعتماد الدليل.')
    } finally { setEvidenceBusy(false) }
  }

  const turnGapIntoCampaign = (gap: { topic?: string; reason: string; total: number }) => {
    const seed = {
      text: `فجوة معرفية متكررة: ${gap.topic || gap.reason}`,
      context: `ظهرت ${gap.total} مرة في مؤشرات البوت المجمعة. صمّم حملة توضيحية موثقة من دون استخدام نصوص أو بيانات شخصية.`,
    }
    localStorage.setItem('studio-campaign-seed', JSON.stringify(seed))
    window.dispatchEvent(new CustomEvent('studio:campaign-seed'))
    setNotice('انتقلت الفجوة المجمعة إلى استوديو التصاميم كبذرة حملة، من دون نقل أي رسالة أو رقم شخصي.')
  }

  const flags = useMemo(() => status.flags || { agent: true, send: false, autoReply: false, privateAutoReply: false, voice: false, reminders: false, quoteCard: true }, [status.flags])
  const phases = [
    ['1', 'الوكيل والربط', flags.agent],
    ['2', 'المعاينة والإرسال إلى الذات', flags.send],
    ['3', 'الردود النصية الموجّهة فقط', flags.autoReply],
    ['4', 'فاجئني وشنو فاتني داخل جلسة', flags.autoReply],
    ['5', 'التذكيرات وبطاقات الاقتباس', flags.reminders || flags.quoteCard],
  ] as const
  const diagnostics = status.diagnostics
  const diagnosticTone = {
    healthy: 'border-emerald-300/70 bg-emerald-50/70 text-emerald-800',
    attention: 'border-sky-300/70 bg-sky-50/70 text-sky-800',
    warning: 'border-amber-300/70 bg-amber-50/70 text-amber-900',
    critical: 'border-red-300/70 bg-red-50/70 text-red-800',
  }[diagnostics?.level || 'warning']
  const diagnosticCheckTone = (state: DiagnosticCheck['state']) => ({
    ok: 'border-emerald-200 bg-emerald-50/45 text-emerald-800',
    info: 'border-sky-200 bg-sky-50/45 text-sky-800',
    warning: 'border-amber-200 bg-amber-50/55 text-amber-900',
    error: 'border-red-200 bg-red-50/55 text-red-800',
  }[state])

  return (
    <div className="admin-dashboard grid min-w-0 gap-4">
      <nav aria-label="أقسام وكيل واتساب" className="mobile-card-rail flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border border-hair bg-wash p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AGENT_SCREENS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScreen(item.id)}
            className={`min-w-[9.5rem] snap-start rounded-xl px-4 py-3 text-right transition-colors ${screen === item.id ? 'bg-accent text-white' : 'bg-canvas text-ink hover:text-accent'}`}
          >
            <span className="block text-[.84rem] font-semibold">{item.label}</span>
            <span className={`mt-1 block text-[.68rem] ${screen === item.id ? 'text-white/75' : 'text-soft'}`}>{item.hint}</span>
          </button>
        ))}
      </nav>

      {screen !== 'live' && notice && <p role="status" className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">{notice}</p>}

      {screen === 'knowledge' && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-bold uppercase tracking-[.14em] text-accent">نظام المعرفة</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">معرفةٌ تعرف حدودها.</h2>
              <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">خمسة أوضاع داخل تجربة واحدة؛ كل وضع يصرّح بما يستطيع فعله، ويفصل أرشيف الدكتور عن البحث الخارجي والتدخل الإنساني.</p>
            </div>
            <button type="button" className={secondary} onClick={() => void refresh()} disabled={busy}>{busy ? 'يحدّث…' : 'تحديث المؤشرات'}</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">الأدلة المعتمدة</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.evidence.enabled}</p><p className="text-[.68rem] text-soft">من أصل {knowledge.evidence.total}</p></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">المحادثات النشطة</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.conversations.active}</p><p className="text-[.68rem] text-soft">مجاميع تشغيل فعلية</p></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">التدخلات البشرية</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.conversations.human}</p><p className="text-[.68rem] text-soft">من دون كشف المحادثة</p></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">النوايا المسجلة</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.conversations.intents.reduce((sum, item) => sum + item.total, 0)}</p><p className="text-[.68rem] text-soft">من آخر قرارات المحرك</p></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">الفجوات المفتوحة</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.conversations.gaps.reduce((sum, item) => sum + item.total, 0)}</p><p className="text-[.68rem] text-soft">حالات Attention الفعلية</p></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.72rem] text-soft">الإجابات المسجلة</p><p className="mt-1 font-display text-3xl text-accent">{knowledge.conversations.answers.reduce((sum, item) => sum + item.total, 0)}</p><p className="text-[.68rem] text-soft">ردود موثقة في التشغيل</p></article>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-5">
            {knowledge.modes.map((mode, index) => (
              <article key={mode.id} className="rounded-2xl border border-hair bg-canvas p-4">
                <p className="text-[.66rem] font-semibold text-accent">0{index + 1}</p>
                <h3 className="mt-2 text-[.88rem] font-semibold text-ink">{mode.label}</h3>
                <p className="mt-2 text-[.72rem] leading-relaxed text-soft">{mode.boundary}</p>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-hair bg-canvas p-4">
              <h3 className="text-[.88rem] font-semibold text-ink">فجوات المعرفة</h3>
              <p className="mt-1 text-[.72rem] leading-relaxed text-soft">بيانات مجمعة فقط. لا تظهر الرسالة الأصلية ولا صاحبها.</p>
              <div className="mt-3 grid gap-2">
                {!knowledge.conversations.gaps.length && <p className="rounded-xl border border-dashed border-hair p-4 text-[.76rem] text-soft">لا توجد فجوات غير محلولة حتى الآن.</p>}
                {knowledge.conversations.gaps.slice(0, 8).map((gap) => (
                  <div key={`${gap.topic || 'unclassified'}-${gap.reason}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair px-3 py-3">
                    <div><p className="text-[.78rem] font-semibold text-ink">{gap.topic || 'موضوع غير مصنّف'}</p><p className="mt-1 text-[.68rem] text-soft">{gap.reason} · تكررت {gap.total} مرة</p></div>
                    <button type="button" className={secondary} onClick={() => turnGapIntoCampaign(gap)}>حوّلها إلى حملة</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-accent/25 bg-accent/[.045] p-4">
              <h3 className="text-[.88rem] font-semibold text-ink">دورة المعرفة الحية</h3>
              <p className="mt-2 text-[.76rem] leading-relaxed text-soft">السؤال المتكرر يتحول إلى فجوة مجهولة الهوية، ثم إلى مادة أو حملة موثقة، ثم يعود إلى الموقع والبوت بعد اعتمادك. لا ينتقل أي نص شخصي إلى الاستوديو.</p>
              <p className="mt-4 text-[.7rem] leading-relaxed text-accent">{knowledge.privacy}</p>
            </div>
          </div>
        </section>
      )}

      {screen === 'conversations' && (
        <section className={card}>
          <p className="text-[.7rem] font-bold uppercase tracking-[.14em] text-accent">مؤشرات آمنة</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">المحادثات بوصفها مؤشرات، لا صندوق تجسس.</h2>
          <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">تعرض اللوحة النية ودرجة الفهم ومكان انقطاع الحوار فقط، من دون الرسائل أو الأرقام أو الأسماء.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] text-soft">النشطة</p><strong className="mt-1 block font-display text-2xl text-accent">{knowledge.conversations.active}</strong></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] text-soft">تدخل بشري</p><strong className="mt-1 block font-display text-2xl text-accent">{knowledge.conversations.human}</strong></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] text-soft">نوايا</p><strong className="mt-1 block font-display text-2xl text-accent">{knowledge.conversations.intents.reduce((sum, item) => sum + item.total, 0)}</strong></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] text-soft">فجوات</p><strong className="mt-1 block font-display text-2xl text-accent">{knowledge.conversations.gaps.reduce((sum, item) => sum + item.total, 0)}</strong></article>
            <article className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] text-soft">إجابات</p><strong className="mt-1 block font-display text-2xl text-accent">{knowledge.conversations.answers.reduce((sum, item) => sum + item.total, 0)}</strong></article>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-hair bg-canvas p-4">
              <h3 className="text-[.86rem] font-semibold text-ink">أكثر النيات وروداً</h3>
              <div className="mt-3 grid gap-2">
                {!knowledge.conversations.intents.length && <p className="text-[.74rem] text-soft">لا توجد بيانات بعد.</p>}
                {knowledge.conversations.intents.slice(0, 12).map((item) => (
                  <div key={item.intent} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-hair px-3 py-2.5">
                    <div><p className="text-[.78rem] font-semibold text-ink">{item.intent}</p><p className="text-[.66rem] text-soft">{item.confidence == null ? 'مجمّع من آخر قرار فعلي للمحرك' : `ثقة وسطية ${Math.round(item.confidence * 100)}٪`}</p></div>
                    <span className="font-display text-xl text-accent">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-hair bg-canvas p-4">
              <h3 className="text-[.86rem] font-semibold text-ink">أين انقطع الحوار؟</h3>
              <div className="mt-3 grid gap-2">
                {!knowledge.conversations.gaps.length && <p className="text-[.74rem] text-soft">لا توجد فجوات غير محلولة.</p>}
                {knowledge.conversations.gaps.slice(0, 12).map((item) => (
                  <div key={`${item.topic || 'unclassified'}-${item.reason}`} className="flex items-center justify-between gap-3 rounded-xl border border-hair px-3 py-2.5">
                    <div><p className="text-[.76rem] font-semibold text-ink">{item.topic || 'موضوع غير مصنّف'}</p><p className="mt-1 text-[.66rem] text-soft">{item.reason}</p></div><span className="font-display text-xl text-accent">{item.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/[.045] p-4 text-[.76rem] leading-relaxed text-soft">التدخل الإنساني النشط الآن: <strong className="text-ink">{knowledge.conversations.human}</strong>. هذه القيمة تعدّ الجلسات المحمية بعد تدخل الدكتور، ولا تكشف محتواها.</div>
        </section>
      )}

      {screen === 'personality' && (
        <section className={card}>
          <p className="text-[.7rem] font-bold uppercase tracking-[.14em] text-accent">شخصية الحوار</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">شخصية دافئة بلا تمثيل.</h2>
          <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">الإعدادات تضبط الإيقاع، ولا تسمح للبوت بادعاء أنه الدكتور أو بتذكر تفضيل من دون موافقة صريحة.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2 text-[.76rem] font-semibold text-ink">طول الإجابة
              <select className={input} value={personality.verbosity} onChange={(event) => setPersonality((current) => ({ ...current, verbosity: event.target.value as KnowledgePersonality['verbosity'] }))}>
                <option value="brief">مختصرة</option><option value="layered">متدرجة</option><option value="detailed">تفصيلية</option>
              </select>
            </label>
            <label className="grid gap-2 text-[.76rem] font-semibold text-ink">نبرة اللغة
              <select className={input} value={personality.dialect} onChange={(event) => setPersonality((current) => ({ ...current, dialect: event.target.value as KnowledgePersonality['dialect'] }))}>
                <option value="formal-arabic">عربية فصيحة</option><option value="kuwaiti-light">كويتية خفيفة</option><option value="neutral-arabic">عربية محايدة</option>
              </select>
            </label>
            <label className="grid gap-2 text-[.76rem] font-semibold text-ink">المبادرة
              <select className={input} value={personality.initiative} onChange={(event) => setPersonality((current) => ({ ...current, initiative: event.target.value as KnowledgePersonality['initiative'] }))}>
                <option value="none">لا يسأل</option><option value="one-question">سؤال واحد له قيمة</option><option value="guided">حوار موجّه</option>
              </select>
            </label>
            <label className="grid gap-2 text-[.76rem] font-semibold text-ink">التوقيع الآلي
              <select className={`${input} cursor-not-allowed opacity-80`} value="always" disabled aria-describedby="bot-signature-safety">
                <option value="always">دائماً — حماية ثابتة</option>
              </select>
              <span id="bot-signature-safety" className="text-[.64rem] font-normal leading-relaxed text-soft">لا يمكن تعطيله حتى لا يُفهم الرد الآلي على أنه صادر من الدكتور.</span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hair bg-canvas p-4">
            <div><p className="text-[.8rem] font-semibold text-ink">الذاكرة: بموافقة صريحة فقط</p><p className="mt-1 text-[.72rem] leading-relaxed text-soft">لا يستنتج الجنس أو اللقب أو التفضيلات من الاسم، ولا يحفظها لمجرد تكرار الحديث.</p></div>
            <button type="button" className={primary} onClick={() => void savePersonality()}>حفظ الشخصية</button>
          </div>
        </section>
      )}

      {screen === 'protection' && (
        <section className={card}>
          <p className="text-[.7rem] font-bold uppercase tracking-[.14em] text-accent">حماية المصادر</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">المصدر قبل الجواب.</h2>
          <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">أي رابط خارجي يظل ممنوعاً حتى يُسجل هنا بدليله، ثم يطابق الحارس المعرّف والرابط والاقتباس والادعاء حرفياً قبل الإرسال.</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            {Object.entries(knowledge.sourcePolicies).map(([domain, policies]) => (
              <article key={domain} className="rounded-2xl border border-hair bg-canvas p-4">
                <h3 className="text-[.82rem] font-semibold text-ink">{domain === 'education' ? 'التعليم' : domain === 'health' ? 'الصحة' : domain === 'law' ? 'القانون' : 'الحديث والمتغير'}</h3>
                <ul className="mt-3 grid gap-1.5 text-[.7rem] leading-relaxed text-soft">{policies.map((policy) => <li key={policy}>— {policy}</li>)}</ul>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
            <div className="rounded-2xl border border-hair bg-canvas p-4">
              <h3 className="text-[.88rem] font-semibold text-ink">اعتماد دليل خارجي</h3>
              <p className="mt-1 text-[.7rem] leading-relaxed text-soft">لا يجلب النظام مصدراً بنفسه ولا يفترض ترخيصه؛ أنت تعتمد السجل، والحارس يقيّد استخدامه بالصياغة المحفوظة.</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className={input} value={evidenceForm.domain} onChange={(event) => setEvidenceForm((current) => ({ ...current, domain: event.target.value }))}><option value="education">التعليم</option><option value="health">الصحة</option><option value="law">القانون</option><option value="current">حديث ومتغير</option></select>
                  <input className={input} value={evidenceForm.sourceType} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceType: event.target.value }))} placeholder="نوع المصدر" />
                </div>
                <input className={input} value={evidenceForm.sourceName} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceName: event.target.value }))} placeholder="الجامعة أو الجهة أو الدورية" />
                <input className={input} value={evidenceForm.title} onChange={(event) => setEvidenceForm((current) => ({ ...current, title: event.target.value }))} placeholder="عنوان المصدر" />
                <textarea className={`${input} min-h-24 resize-y`} value={evidenceForm.claim} onChange={(event) => setEvidenceForm((current) => ({ ...current, claim: event.target.value }))} placeholder="الادعاء المحدد الذي يسمح للبوت باستخدامه" />
                <textarea className={`${input} min-h-20 resize-y`} value={evidenceForm.quote} onChange={(event) => setEvidenceForm((current) => ({ ...current, quote: event.target.value }))} placeholder="اقتباس حرفي اختياري" />
                <input dir="ltr" className={input} value={evidenceForm.url} onChange={(event) => setEvidenceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https:// المصدر الأصلي" />
                <div className="grid gap-3 sm:grid-cols-2"><input className={input} value={evidenceForm.publishedAt} onChange={(event) => setEvidenceForm((current) => ({ ...current, publishedAt: event.target.value }))} placeholder="تاريخ النشر" /><input className={input} value={evidenceForm.authority} onChange={(event) => setEvidenceForm((current) => ({ ...current, authority: event.target.value }))} placeholder="الجهة أو المؤلف" /></div>
                <button type="button" className={primary} disabled={evidenceBusy} onClick={() => void saveEvidence()}>{evidenceBusy ? 'يعتمد…' : 'اعتماد الدليل'}</button>
              </div>
            </div>
            <div className="rounded-2xl border border-hair bg-canvas p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="text-[.88rem] font-semibold text-ink">سجل الأدلة</h3><span className="rounded-full border border-hair px-3 py-1 text-[.68rem] text-soft">{knowledge.evidence.enabled} معتمد</span></div>
              <div className="mt-4 grid max-h-[38rem] gap-2 overflow-y-auto pl-1">
                {!trustedEvidence.length && <p className="rounded-xl border border-dashed border-hair p-5 text-center text-[.74rem] text-soft">لا توجد أدلة خارجية بعد؛ لذلك يرفض وضع البحث الموثق التخمين تلقائياً.</p>}
                {trustedEvidence.map((item) => (
                  <article key={item.id} className="rounded-xl border border-hair p-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-[.78rem] font-semibold text-ink">{item.title}</p><p className="mt-1 text-[.66rem] text-soft">{item.sourceName} · {item.domain}</p></div><span className={`rounded-full px-2 py-1 text-[.62rem] ${item.enabled ? 'bg-accent/10 text-accent' : 'border border-hair text-soft'}`}>{item.enabled ? 'معتمد' : 'موقوف'}</span></div>
                    <p className="mt-2 text-[.7rem] leading-relaxed text-soft">{item.claim}</p>
                    <p dir="ltr" className="mt-2 truncate text-[.62rem] text-accent">{item.url}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {screen === 'campaigns' && (
        <section className="grid gap-4" aria-labelledby="whatsapp-campaigns-title">
          <div className="rounded-2xl border border-hair bg-wash p-5 md:p-6">
            <p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">مسار مستقل عن الردود الآلية</p>
            <h2 id="whatsapp-campaigns-title" className="mt-1 font-display text-2xl font-semibold text-ink">من القائمة إلى الإرسال، من مكان واحد.</h2>
            <p className="mt-2 max-w-2xl text-[.8rem] leading-relaxed text-soft">الحملات لا تتجاوز كلمة الإيقاظ ولا قواعد المحادثة؛ تختار الجمهور، تراجع العدد، تختبر الرسالة على رقمك، ثم تؤكد الإرسال.</p>
          </div>
          <BroadcastStudio request={request} onNotice={setNotice} />
          {bridge && <AudienceStudio request={request} onNotice={setNotice} />}
        </section>
      )}

      {screen === 'live' && (
        <>
      <section data-whatsapp-recovery-center="true" className={`${card} border-accent/25`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">مركز التشخيص والإحياء</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold text-ink">{diagnostics?.title || 'أفحص طبقات واتساب…'}</h2>
              <span className={`rounded-full border px-3 py-1 text-[.68rem] font-semibold ${diagnosticTone}`}>
                {diagnostics?.level === 'healthy' ? 'سليم' : diagnostics?.level === 'critical' ? 'يحتاج تدخلاً' : diagnostics?.level === 'warning' ? 'يحتاج انتباهاً' : 'ملاحظة'}
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-[.8rem] leading-relaxed text-soft">{diagnostics?.summary || 'يجمع حالة الخادم والجسر وجلسة واتساب ومحرك الرد وطابور الأوامر.'}</p>
            {diagnostics?.action && <p className="mt-2 max-w-3xl text-[.76rem] font-medium leading-relaxed text-ink">{diagnostics.action}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primary} disabled={recoveringAll || repairing || diagnostics?.code === 'scan-qr'} onClick={() => void recoverEverything()}>
              {recoveringAll ? 'يُحيي النظام…' : diagnostics?.code === 'scan-qr' ? 'QR ظاهر أدناه' : 'إحياء آمن'}
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void refresh()}>{busy ? 'يفحص…' : 'فحص شامل'}</button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(diagnostics?.checks || []).map((check) => (
            <article key={check.id} className={`rounded-xl border p-3 ${diagnosticCheckTone(check.state)}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[.76rem] font-semibold">{check.label}</h3>
                <span aria-hidden="true" className="text-[.78rem]">{check.state === 'ok' ? '●' : check.state === 'info' ? '◆' : '!'}</span>
              </div>
              <p className="mt-2 text-[.68rem] leading-relaxed opacity-80">{check.detail}</p>
            </article>
          ))}
          {!diagnostics?.checks?.length && <p className="rounded-xl border border-dashed border-hair p-4 text-[.74rem] text-soft">اضغط «فحص شامل» لعرض تشخيص الطبقات الخمس.</p>}
        </div>

        {diagnostics && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1.15fr]">
            <div className="rounded-xl border border-hair bg-canvas px-3 py-3"><p className="text-[.66rem] text-soft">آخر رسالة وصلت</p><p className="mt-1 text-[.72rem] font-semibold text-ink">{activityLabel(diagnostics.activity.lastInboundAt)}</p></div>
            <div className="rounded-xl border border-hair bg-canvas px-3 py-3"><p className="text-[.66rem] text-soft">آخر رد آلي</p><p className="mt-1 text-[.72rem] font-semibold text-ink">{activityLabel(diagnostics.activity.lastReplyAt)}</p></div>
            <div className="rounded-xl border border-hair bg-canvas px-3 py-3"><p className="text-[.66rem] text-soft">آخر تدخل يدوي</p><p className="mt-1 text-[.72rem] font-semibold text-ink">{activityLabel(diagnostics.activity.lastManualAt)}</p></div>
            <div className="rounded-xl border border-hair bg-canvas px-3 py-3"><p className="text-[.66rem] text-soft">طابور الأوامر</p><p className="mt-1 text-[.72rem] font-semibold text-ink">{diagnostics.queue.active} نشط · {diagnostics.queue.failed} فاشل · {diagnostics.queue.staleLeased} عالق</p></div>
          </div>
        )}
        <p className="mt-3 text-[.66rem] leading-relaxed text-soft">{diagnostics?.privacy || 'لا تظهر هذه اللوحة نصوص المحادثات أو أرقام أصحابها.'}</p>
        {notice && <p role="status" className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{notice}</p>}
      </section>

      {/* حتى قسم الحالة يُطوى بأمر الدكتور. لكن الحالة نفسها (متصل/غير متصل)
          تبقى في العنوان — فما فائدة كرتٍ يخفي الخبر الوحيد الذي تريده بنظرة؟ */}
      <details className={`${card} group`}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[.75rem] font-semibold uppercase text-accent">مساعد د. أحمد داخل واتساب</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-3 font-display text-2xl font-semibold text-ink">
              وكيل خاص بموافقة الدكتور.
              <span className={`rounded-full px-3 py-1 text-[.72rem] font-semibold ${status.health?.ready ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>
                {status.health?.label || stateLabel[String(status.status)] || 'غير مرتبط'}
              </span>
            </h2>
            <p className="mt-2 max-w-2xl text-[.82rem] leading-relaxed text-soft">تُدار خدمة الاتصال والجلسة على الخادم المخصص، بعيداً عن المتصفح وGitHub.</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
        </summary>

        <div className="mt-5 border-t border-hair pt-5">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void recoverBridge()} disabled={restarting || repairing} className={primary}>
              {restarting ? 'جارٍ الإصلاح…' : status.health?.needsAuthScan ? 'QR جاهز للمسح' : status.health?.ready ? 'الاتصال سليم' : 'إصلاح الاتصال تلقائياً'}
            </button>
            <button type="button" onClick={() => void refresh()} disabled={busy} className={secondary}>{busy ? '…' : 'تحديث الحالة'}</button>
          </div>

          {status.health && !status.health.ready && (
            <div className="mt-4 rounded-2xl border border-accent/35 bg-canvas p-4">
              <p className="text-[.82rem] font-semibold text-accent">{status.health.label}</p>
              {status.health.why && <p className="mt-1 text-[.78rem] leading-relaxed text-ink">{status.health.why}</p>}
              {status.health.fix && <p className="mt-1 text-[.76rem] leading-relaxed text-soft">{status.health.fix}</p>}
            </div>
          )}
          {status.health?.ready && (
            <p className="mt-4 text-[.78rem] text-soft">متصل وصامت افتراضياً · لا يبدأ إلا بعد كلمة الإيقاظ{status.health.silenced ? ` · أُغلق في ${status.health.silenced} محادثة بعد تدخل يدوي` : ''}</p>
          )}

          {status.qrImage && !status.health?.ready && (
            <div className="mt-4 rounded-2xl border border-accent/35 bg-canvas p-4 sm:p-5">
              <p className="text-[.82rem] font-semibold text-ink">اربط واتساب</p>
              <p className="mt-1 text-[.74rem] leading-relaxed text-soft">من الجوال: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز، ثم اجعل الرمز كاملاً داخل إطار الكاميرا. امسحه مرة واحدة فقط؛ إذا رفض الهاتف الربط فاتركه حتى تنتهي مهلة الحماية ولا تكرر المسح.</p>
              <div className="mx-auto mt-4 flex w-fit max-w-full justify-center overflow-hidden rounded-2xl bg-white p-3 sm:p-4">
                <img
                  key={status.qrFingerprint || status.qrUpdatedAt || 'whatsapp-qr'}
                  src={status.qrImage}
                  alt="رمز اقتران واتساب"
                  width={280}
                  height={280}
                  draggable={false}
                  decoding="sync"
                  className="block h-auto w-[280px] max-w-[70vw] select-none object-contain"
                />
              </div>
              <p className="mt-3 text-center text-[.7rem] leading-relaxed text-soft">
                الرمز يتحدّث تلقائياً كل ثانيتين أثناء الربط{status.qrAgeMs != null ? ` · عمر الرمز ${ageLabel(status.qrAgeMs)}` : ''}.
              </p>
            </div>
          )}
          {status.pairing_code && !status.health?.ready && (
            <div className="mt-4 rounded-2xl border border-accent/35 bg-canvas p-4">
              <p className="text-[.8rem] font-semibold text-ink">رمز الاقتران</p>
              <p className="mt-2 font-mono text-2xl tracking-[.3em] text-accent">{status.pairing_code}</p>
            </div>
          )}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الحالة</p><p className="mt-1 font-semibold text-ink">{status.health?.label || (status.status && status.status !== 'unconfigured'
            ? (stateLabel[status.status] || status.status)
            : bridgeAlive === null ? 'يفحص…' : bridgeAlive ? 'الجسر يعمل' : 'غير مرتبط')}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">خدمة الجسر</p><p className="mt-1 font-semibold text-ink">{status.bridgeOnline ? 'تعمل' : 'متوقفة'}</p><p className="text-[.72rem] text-soft">آخر نبضة: {status.bridgeOnline ? ageLabel(status.heartbeatAgeMs) : '–'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">فهرس الموقع</p><p className="mt-1 font-display text-2xl text-accent">{status.indexed ?? '—'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">المنطقة</p><p className="mt-1 font-semibold text-ink">{status.timeZone || 'Asia/Kuwait'}</p></div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-hair bg-canvas px-4 py-3">
            <p className="text-[.8rem] font-semibold text-ink">اتصال مركزي — لا يعتمد على هذا المتصفح</p>
            <p className="mt-1 text-[.72rem] leading-relaxed text-soft">
              الجسر نسخة مقيمة مستقلة عن مجلد المشروع، والجلسة في مخزن دائم على الماك. تحديث الموقع أو فك ZIP لا يمسحها، وLaunchAgent يعيدها تلقائياً بعد الانهيار أو إعادة التشغيل.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void toggleEmergencyPause()} disabled={!status.bridgeOnline} className={`rounded-full border px-4 py-2 text-[.8rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${status.runtimePaused ? 'border-accent bg-accent text-white' : 'border-red-300/70 bg-red-50 text-red-700 hover:border-red-500'}`}>{status.runtimePaused ? 'تشغيل الردود' : 'إيقاف الردود فوراً'}</button>
            <button type="button" onClick={() => void recoverBridge()} disabled={restarting || repairing} className={status.health?.ready ? secondary : primary}>{restarting ? 'جارٍ الإصلاح' : 'إصلاح الاتصال تلقائياً'}</button>
            <button type="button" onClick={() => void repairSession()} disabled={repairing || restarting || !status.bridgeOnline || status.repairAllowed === false} className={secondary}>
              {repairing
                ? 'يجهّز QR جديداً…'
                : status.repairCooldownMs && status.repairCooldownMs > 0
                  ? `حماية إعادة الربط · ${ageLabel(status.repairCooldownMs)}`
                  : 'إعادة ربط من الصفر'}
            </button>
            <button
              type="button"
              onClick={() => void returnBotNow()}
              disabled={returning || !status.bridgeOnline}
              className={silence.silenced > 0 ? primary : secondary}
              title="ينهي الاستلام اليدوي؛ ولا يبدأ الرد إلا بجملة الإيقاظ"
            >
              {returning ? 'يتيح الإيقاظ…' : silence.silenced > 0 ? `اسمح بالإيقاظ (${silence.silenced})` : 'اسمح بالإيقاظ'}
            </button>
          </div>
          {silence.silenced > 0 && (
            <p className="mt-2 text-[.76rem] leading-relaxed text-accent">
              البوت صامتٌ الآن في {silence.silenced === 1 ? 'محادثة واحدة' : `${silence.silenced} محادثات`}
              لأنك رددتَ فيها بيدك. لن يعود تلقائياً؛ زر «اسمح بالإيقاظ» ينهي الاستلام اليدوي فقط، وبعده يظل صامتاً حتى يكتب الشخص جملة الإيقاظ.
            </p>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">
          البوت صامت افتراضياً حتى يكتب الشخص «موقع د. أحمد» أو «موقع د. الفيلكاوي». بعدها فقط يجيب في تلك المحادثة من فهرس الموقع والقواعد المعتمدة بلا تأليف، وأي رسالة تكتبها أنت بيدك تغلق جلسته فوراً بلا عودة تلقائية.
          القوائم ودفتر الأرقام والبث اليدوي مستقلة تماماً: لا تُرسل شيئاً إلا بأمرك، وبعد معاينة على رقمك وتأكيدين صريحين وفاصل هادئ بين الرسائل.
          لا تحية ولا سؤال ولا قاعدة محفوظة تتجاوز كلمة الإيقاظ، ولا يعمل البوت في مجموعة أو حالة أو قناة.
        </div>
        <details className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="cursor-pointer list-none text-[.82rem] font-semibold text-ink">اشتريت هاتفاً جديداً؟ طريقة النقل الآمنة</summary>
          <ol className="mt-3 grid list-decimal gap-2 pr-5 text-[.76rem] leading-relaxed text-soft">
            <li>انقل حساب واتساب إلى الهاتف الجديد بنفس الرقم، وأكمل استعادة المحادثات داخل تطبيق واتساب أولاً.</li>
            <li>افتح في الهاتف الجديد: الإعدادات ← الأجهزة المرتبطة. إذا بقي «Google Chrome (macOS)» ظاهراً فلا تفعل شيئاً؛ الجسر يستمر تلقائياً.</li>
            <li>إذا اختفى الجهاز فقط، افتح هذه اللوحة واضغط «إصلاح الاتصال تلقائياً». لا تمسح الجلسة ولا تكرر QR.</li>
            <li>إذا ظهر QR في اللوحة، امسحه مرة واحدة من الهاتف الجديد وانتظر حتى تصبح الحالة «جاهز».</li>
            <li>استخدم «إعادة ربط من الصفر» فقط إذا كتبت اللوحة «فشل التوثيق»؛ فهذا الخيار يمسح الجلسة القديمة عمداً.</li>
          </ol>
        </details>
        {status.last_error && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.8rem] text-soft">{status.last_error}</p>}
      </details>

      {/* حُذف «بوابة الإطلاق» بأمر الدكتور — إزعاجٌ بصريّ بلا فائدة. */}

      {/* حُذفت «غرفة البرودكاست الهادئ» القديمة: كانت تطلب أرقاماً تُكتب سطراً
          سطراً ولا تعرف قوائم الدكتور، فتقول «الجهات الجاهزة: 0» وهو يملك ألفين.
          خلفتها BroadcastStudio: قائمةٌ تُختار، ومعاينةٌ تقول كم سيصل، وتجربةٌ على
          النفس قبل الناس. ولا مكانان لوظيفةٍ واحدة. */}

      {/* حُذف «مركز إدارة الردود» بأمر الدكتور — إزعاجٌ بصريّ بلا فائدة. */}

      {/* اختبار الرد: يجرّب البوت بلا أن يرسل شيئاً لأحد. كان يعرض ما سيقوله
          ويتجاهل هل سيتكلم أصلاً — فأوهم أن «دكتور» تجلب مقالات، بينما البوابة
          تُسكته عليها. الآن يقول الحكم أولاً بلا رطانة. */}
      {/* شرط الدكتور في لوحته أيضاً لا في صفحات الموقع وحدها: كل قسمٍ كرتٌ
          مطويّ، وما إن يُفتح واحد حتى ينغلق ما سواه. كانت أقسام اللوحة
          <section> مفتوحةً دائماً فلا شيء فيها يُطوى — وهذا ما فاتني. */}
      {bridge && (
        <details className={card}>
          <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">جرّب البوت قبل أن يتكلم.</h3>
              <p className="mt-1 max-w-xl text-[.78rem] leading-relaxed text-soft">اكتب رسالةً كما يكتبها الناس، فأخبرك: هل يردّ أم يصمت، ولماذا. لا شيء يُرسل لأحد.</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
          </summary>
          <div className="mt-4 flex flex-wrap gap-2">
            <input className={`${input} flex-1`} value={simulateText} placeholder="مثلاً: السلام عليكم · آخر مقال · أبحاث الدكتور" onChange={(event) => setSimulateText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void runSimulator() }} />
            <button type="button" onClick={() => void runSimulator()} className={secondary}>جرّب</button>
          </div>
          {simulation && (
            <div className="mt-3 grid gap-2 rounded-xl border border-hair bg-canvas px-4 py-3">
              <p className="text-[.9rem] font-semibold text-ink">
                {simulation.willReply ? '🗣 يردّ' : '🤐 يصمت'}
                <span className="mr-2 text-[.78rem] font-normal text-soft">· {simulation.why}</span>
              </p>
              {simulation.preview && <p className="whitespace-pre-wrap text-[.82rem] leading-relaxed text-ink">{simulation.preview}</p>}
            </div>
          )}
        </details>
      )}

      {bridge && (
        <details className={card}>
          <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">ذاكرة اللهجة · منضبطة</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">ذاكرة اللهجة الحيّة</h3>
              <p className="mt-1 max-w-2xl text-[.78rem] leading-relaxed text-soft">يتعلم من الصياغات الكويتية والعربية التي لم يفهمها، لكن لا يخترع جواباً: يحفظ النية فقط بعد تكرار مؤكد، ثم يجيب من فهرس الموقع كالمعتاد.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-hair px-3 py-1 text-[.7rem] text-soft">{learning.learned} تعلّمها</span>
              <span className="rounded-full border border-hair px-3 py-1 text-[.7rem] text-soft">{learning.observing} يراقبها</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent">＋</span>
            </div>
          </summary>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-accent/25 bg-accent/[.045] p-4">
              <p className="text-[.8rem] font-semibold text-ink">حماية الفهم قبل الكلام</p>
              <p className="mt-1 text-[.76rem] leading-relaxed text-soft">{learning.policy || 'لا يعتمد صياغة جديدة إلا بعد ثلاث قرائن عالية الثقة من مصدرين مستقلين أو عبر ثلاثة أيام، ولا يتعلم أي معلومة أو جواب من المستخدم.'}</p>
            </div>
            {!learning.items.length ? (
              <p className="rounded-2xl border border-dashed border-hair p-5 text-center text-[.78rem] text-soft">لا توجد صياغات غامضة حتى الآن. ستظهر هنا فقط بعد الإيقاظ وعند عدم الفهم.</p>
            ) : (
              <div className="grid gap-2">
                {learning.items.slice(0, 24).map((item) => (
                  <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hair bg-canvas px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[.84rem] font-semibold text-ink">{item.phrase || 'صياغة مشفّرة'}</p>
                      <p className="mt-1 text-[.7rem] text-soft">{item.status === 'learned'
                        ? `تعلّمها كنية ${item.intent} · ${item.confirmations} قرائن · ${item.evidenceSources || 0} مصادر`
                        : item.status === 'ignored'
                          ? 'متجاهلة'
                          : `تحت المراقبة · ظهرت ${item.hits} مرة · ${item.confirmations}/3 قرائن · ${item.evidenceSources || 0} مصادر · ${item.evidenceDays || 0} أيام`}</p>
                    </div>
                    <button type="button" disabled={learningBusy} className={secondary} onClick={() => void updateLearningPattern(item.id, item.status === 'ignored' ? 'observing' : 'ignored')}>
                      {item.status === 'ignored' ? 'أعد للمراقبة' : 'لا تتعلمها'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {/* حُذفت بطاقة «الحملات المحلية»: كانت تُخفي مسودتك حتى تضغط «اعتماد»، فتظهر
          خطوةٌ ناقصة بلا سياق وتغيب البقية. وغرفة البثّ أعلاه تُري المسار كاملاً
          من أوله — والاعتماد صار داخلها خطوةً لا باباً. */}


      {/* حُذف «التشغيل المحلي» بأمر الدكتور — إزعاجٌ بصريّ بلا فائدة. */}
        </>
      )}
    </div>
  )
}
