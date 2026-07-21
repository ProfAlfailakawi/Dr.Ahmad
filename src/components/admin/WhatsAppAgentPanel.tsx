import { useEffect, useMemo, useState } from 'react'
import AudienceStudio from './AudienceStudio'
import { BroadcastStudio } from './BroadcastStudio'

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
  health?: {
    code: string; label: string; why: string; fix: string
    ready: boolean; needsAuthScan: boolean; pollFailures: number
    quietNow: boolean; silenced: number; connected: boolean
  }
  pairing_code?: string | null
}
type Campaign = { id: string; name: string; state: string; created_at: string; approved_at?: string | null; target_count?: number }
type BroadcastGroup = { id: string; jid: string; name: string; memberCount: number; discoveredAt?: string }
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
type Simulation = { willReply?: boolean; why?: string; quietNow?: boolean; intent?: string; confidence?: number; needsHuman?: boolean; ruleId?: string | null; ruleName?: string | null; preview?: string }

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent'
const secondary = 'rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'

const stateLabel: Record<string, string> = {
  unconfigured: 'غير مرتبط',
  pairing: 'بانتظار الاقتران',
  connected: 'متصل',
  disconnected: 'غير متصل',
  reconnecting: 'يعيد الاتصال',
  restarting: 'جارٍ إعادة التشغيل',
  paused: 'متوقف مؤقتًا',
  sending: 'يرسل بعد الاعتماد',
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

function keywordsText(rule: Partial<ReplyRule>) {
  return Array.isArray(rule.keywords) ? rule.keywords.join('، ') : ''
}

function parseKeywords(value: string) {
  return value.split(/[,،\n]/).map((item) => item.trim()).filter(Boolean)
}

function normalizeTargetLine(value: string) {
  const raw = value.trim()
  if (!raw) return null
  if (raw === 'self') return { id: 'self', kind: 'self' as const }
  if (raw.endsWith('@g.us')) return { jid: raw, kind: 'group' as const, displayName: 'قروب واتساب' }
  if (raw.endsWith('@s.whatsapp.net')) return { jid: raw, kind: 'contact' as const }
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) return { jid: `965${digits}@s.whatsapp.net`, kind: 'contact' as const }
  if (digits.length >= 10 && digits.length <= 15) return { jid: `${digits}@s.whatsapp.net`, kind: 'contact' as const }
  return null
}

function parseTargets(value: string) {
  const parsed = value.split(/\n|,/).map(normalizeTargetLine).filter(Boolean)
  const seen = new Set<string>()
  return parsed.filter((target) => {
    const key = target?.jid || target?.id || ''
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function WhatsAppAgentPanel() {
  const [status, setStatus] = useState<AgentStatus>({ status: 'unconfigured' })
  const [busy, setBusy] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [notice, setNotice] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignText, setCampaignText] = useState('')
  const [campaignTargetsText, setCampaignTargetsText] = useState('')
  const [groups, setGroups] = useState<BroadcastGroup[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [intervalSeconds, setIntervalSeconds] = useState(45)
  const [sendingCampaignId, setSendingCampaignId] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [secret, setSecret] = useState(() => localStorage.getItem('whatsapp-agent-bridge-secret') || '')
  const [manualJid, setManualJid] = useState('')
  const [rules, setRules] = useState<ReplyRule[]>([])
  const [ruleForm, setRuleForm] = useState<typeof emptyRule>({ ...emptyRule })
  const [ruleVersions, setRuleVersions] = useState<Record<string, RuleVersion[]>>({})
  const [simulateText, setSimulateText] = useState('')
  const [simulation, setSimulation] = useState<Simulation | null>(null)
  const localBridgeDefault = ['http:', '', '127.0.0.1:34321'].join('/')
  const bridgeCandidate = String(import.meta.env.VITE_WHATSAPP_AGENT_BRIDGE_URL || localBridgeDefault).replace(/\/+$/, '')
  const bridge = /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i.test(bridgeCandidate) ? bridgeCandidate : ''
  const personalNumberMode = status.flags?.personalNumberMode !== false

  const authHeaders = useMemo(() => ({
    Accept: 'application/json',
    'X-WhatsApp-Agent-Secret': secret,
  }), [secret])

  const request = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!bridge) throw new Error('bridge-not-configured')
    if (!secret.trim()) throw new Error('secret-missing')
    const headers = { ...authHeaders, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) }
    const response = await fetch(`${bridge}${path}`, { ...init, headers })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error || 'request-failed')
    }
    return response.json()
  }

  const refresh = async () => {
    if (!bridge) { setNotice('لم أجد رابط الجسر المحلي. عرّف VITE_WHATSAPP_AGENT_BRIDGE_URL إلى 127.0.0.1 فقط.'); return }
    if (!secret.trim()) { setNotice('أدخل سر الجسر المحلي أولًا. السر لا يُرفع للموقع؛ يُحفظ في هذا المتصفح فقط.'); return }
    setBusy(true)
    try {
      const [nextStatus, nextCampaigns, nextRules, cachedGroups] = await Promise.all([
        request<AgentStatus>('/status'),
        request<Campaign[]>('/campaigns'),
        request<ReplyRule[]>('/admin/rules'),
        request<{ groups: BroadcastGroup[] }>('/admin/groups/cached').catch(() => ({ groups: [] })),
      ])
      setStatus(nextStatus)
      setCampaigns(nextCampaigns)
      setRules(nextRules)
      setGroups(cachedGroups.groups || [])
      setNotice('تحدّثت حالة واتساب.')
    } catch (error) {
      setNotice(error instanceof Error && error.message === 'secret-missing' ? 'أدخل سر الجسر المحلي أولًا.' : 'تعذّر الوصول إلى جسر واتساب المحلي. تأكد أن الماك شغال والجسر متصل والسر صحيح.')
    } finally {
      setBusy(false)
      setRestarting(false)
    }
  }

  /* الجسر قد يكون حيّاً والسر ناقصاً فحسب — نميّز الحالتين بنبضة عامة، فلا تقول
     اللوحة «غير مرتبط» بينما الوكيل يعمل على الماك فعلاً. */
  const [bridgeAlive, setBridgeAlive] = useState<boolean | null>(null)
  const pingBridge = async () => {
    if (!bridge) { setBridgeAlive(false); return false }
    try {
      const response = await fetch(`${bridge}/ping`, { cache: 'no-store' })
      const alive = response.ok
      setBridgeAlive(alive)
      return alive
    } catch {
      setBridgeAlive(false)
      return false
    }
  }

  useEffect(() => {
    void (async () => {
      const alive = await pingBridge()
      if (alive && secret.trim()) void refresh()
      else if (alive) setNotice('الجسر يعمل على الماك ✓ — ألصق سر الجسر أدناه مرة واحدة لتتصل اللوحة به.')
      else setNotice('لا أصل إلى الجسر المحلي. تأكد أن الماك شغّال وأن وكيل واتساب يعمل عليه.')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* تحديثٌ لحظيّ: نبضة البوت كل ثلاثين ثانية، فنفحص كل خمس عشرة كي لا يعلق
     المؤشر على «متوقف» بعد تعافيه حتى يُعيد الدكتور تحميل الصفحة. ونفحص فوراً
     عند العودة إلى التبويب — فأوّل ما يفعله الدكتور أن ينظر. */
  useEffect(() => {
    if (!secret.trim()) return
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret])

  /* اقتران بضغطة: يجلب السر من الجسر المحلي ويحفظه في هذا المتصفح وحده،
     فلا ينسخ الدكتور أربعاً وستين خانة يدوياً في كل جهاز. */
  const [pairing, setPairing] = useState(false)
  const pairNow = async () => {
    if (!bridge) { setNotice('لم أجد الجسر المحلي.'); return }
    setPairing(true)
    try {
      const response = await fetch(`${bridge}/pair`, { method: 'POST' })
      if (!response.ok) throw new Error('rejected')
      const payload = await response.json()
      const fetched = String(payload.secret || '').trim()
      if (!fetched) throw new Error('empty')
      setSecret(fetched)
      localStorage.setItem('whatsapp-agent-bridge-secret', fetched)
      setNotice('اقترنت اللوحة بالجسر ✓')
      await refresh()
    } catch {
      setNotice('تعذّر الاقتران التلقائي — الصق السر يدوياً من: node whatsapp-agent/cli.mjs bridge-secret')
    } finally {
      setPairing(false)
    }
  }

  const saveSecret = () => {
    localStorage.setItem('whatsapp-agent-bridge-secret', secret.trim())
    setNotice('حُفظ سر الجسر في هذا المتصفح فقط.')
    void refresh()
  }

  const selectedGroupTargets = () => groups
    .filter((group) => selectedGroupIds.includes(group.id))
    .map((group) => ({ jid: group.jid, kind: 'group', displayName: group.name }))

  const draftTargets = () => [...selectedGroupTargets(), ...parseTargets(campaignTargetsText)]

  const loadGroups = async () => {
    setBusy(true)
    try {
      const result = await request<{ groups: BroadcastGroup[]; refreshed?: boolean }>('/admin/groups')
      setGroups(result.groups || [])
      setNotice(result.refreshed ? 'سحبت القروبات من جلسة واتساب الحالية بدون عرض أرقام الأعضاء.' : 'عرضت القروبات المحفوظة محليًا.')
    } catch (error) {
      setNotice(error instanceof Error ? `تعذّر سحب القروبات: ${error.message}` : 'تعذّر سحب القروبات من واتساب.')
    } finally {
      setBusy(false)
    }
  }

  const previewSelf = async () => {
    if (!campaignText.trim()) return setNotice('اكتب نص الرسالة أولًا.')
    try {
      await request('/admin/send-self-preview', { method: 'POST', body: JSON.stringify({ message: campaignText }) })
      setNotice('أُرسلت معاينة إلى نفسك. إذا لم تصل، تأكد أن الإرسال المحلي مفعّل وأن واتساب متصل.')
    } catch (error) {
      setNotice(error instanceof Error ? `تعذّر إرسال المعاينة: ${error.message}` : 'تعذّر إرسال المعاينة.')
    }
  }

  const saveDraft = async () => {
    if (!campaignName.trim() || !campaignText.trim()) return setNotice('اكتب اسم المسودة ونصها أولًا.')
    const targets = draftTargets()
    if (bridge && secret.trim()) {
      try { await request('/campaigns/draft', { method: 'POST', body: JSON.stringify({ name: campaignName, message: campaignText, targets, intervalSeconds }) }) } catch (error) { return setNotice(error instanceof Error ? `تعذّر حفظ المسودة: ${error.message}` : 'تعذّر حفظ المسودة عبر الوكيل المحلي.') }
    } else {
      try { localStorage.setItem('whatsapp-agent-draft', JSON.stringify({ name: campaignName, message: campaignText, targets: targets.length, savedAt: new Date().toISOString() })) } catch { /* noop */ }
    }
    setNotice(targets.length ? `حُفظت كمسودة مع ${targets.length} جهة/قروب. لا يوجد إرسال قبل الاعتماد.` : 'حُفظت كمسودة فقط؛ لا يوجد إرسال.')
    setCampaignName('')
    setCampaignText('')
    setCampaignTargetsText('')
    setSelectedGroupIds([])
    await refresh()
  }

  const approve = async (id: string) => {
    try { await request(`/campaigns/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); setNotice('اعتمدت المسودة؛ الإرسال الفعلي يحتاج أمر إرسال منفصل ومقفول افتراضيًا.'); await refresh() } catch { setNotice('تعذّر اعتماد المسودة.') }
  }

  const sendQuiet = async (campaign: Campaign) => {
    setSendingCampaignId(campaign.id)
    try {
      await request(`/campaigns/${encodeURIComponent(campaign.id)}/send-quiet`, { method: 'POST', body: JSON.stringify({ confirm: true, confirmAgain: true, intervalSeconds }) })
      setNotice(`بدأ الإرسال الهادئ لمسودة «${campaign.name}». الفاصل ${intervalSeconds} ثانية تقريبًا بين كل جهة.`)
      setTimeout(() => void refresh(), 1200)
    } catch (error) {
      setNotice(error instanceof Error ? `لم يبدأ الإرسال: ${error.message}` : 'لم يبدأ الإرسال الهادئ.')
    } finally {
      setSendingCampaignId('')
    }
  }

  const stopQuiet = async (id: string) => {
    try { await request(`/campaigns/${encodeURIComponent(id)}/stop`, { method: 'POST' }); setNotice('أوقفت الحملة الهادئة.'); await refresh() } catch { setNotice('تعذّر إيقاف الحملة.') }
  }

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
      setNotice(status.runtimePaused ? 'عادت الردود الآلية وفق قواعد الأمان.' : 'توقفت كل الردود الآلية فورًا. الاتصال والفهرس مستمران فقط.')
      await refresh()
    } catch {
      setNotice('تعذّر تغيير حالة الإيقاف الفوري.')
    }
  }

  const returnBotNow = async () => {
    setReturning(true)
    try {
      const out = await request<{ returned: number }>('/admin/bot-return-all', { method: 'POST' })
      setNotice(out.returned ? `✓ أصبح الإيقاظ متاحًا في ${out.returned} محادثة. لن يبدأ الرد إلا بعد جملة الإيقاظ.` : 'لا توجد محادثة داخل فترة الحماية الآن.')
      await loadSilence()
    } catch {
      setNotice('تعذّر إرجاع البوت — تأكّد أن الجسر يعمل على الماك.')
    } finally { setReturning(false) }
  }

  /* إعادة ربط: تمسح الجلسة فيظهر QR جديد. تأكيدٌ صريح لأنها تقطع الاتصال
     حتى يمسح الدكتور الرمز بجواله — ولا تُنفَّذ بضغطةٍ ساهية. */
  const [repairing, setRepairing] = useState(false)
  const repairSession = async () => {
    if (!window.confirm('سيُمسح ارتباط واتساب، ويظهر رمز QR جديد تمسحه بجوالك.\nجهاتك وقوائمك تبقى سليمة.\n\nهل تتابع؟')) return
    setRepairing(true)
    try {
      const out = await request<{ message?: string }>('/admin/repair', { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setNotice(out.message || 'مُسحت الجلسة — انتظر ظهور رمز QR أدناه.')
      setTimeout(() => void refresh(), 20_000)
    } catch {
      setNotice('تعذّر إرسال طلب إعادة الربط للجسر.')
    } finally { setRepairing(false) }
  }

  const restartBridge = async () => {
    if (!status.bridgeOnline) return setNotice('زر إعادة التشغيل لا يصل للجسر إذا كان الماك مطفأ أو الإنترنت/الجسر متوقفًا.')
    setRestarting(true)
    try {
      await request('/admin/restart', { method: 'POST', body: JSON.stringify({ confirm: true }) })
      setNotice('أرسلت طلب إعادة التشغيل. launchd سيعيد الوكيل تلقائيًا بلا QR إذا الجلسة محفوظة.')
      setTimeout(() => void refresh(), 4500)
    } catch {
      setRestarting(false)
      setNotice('تعذّر إرسال طلب إعادة التشغيل للجسر.')
    }
  }

  const manualTakeover = async () => {
    if (!manualJid.trim()) return setNotice('اكتب JID المحادثة من واتساب، مثال: 965XXXXXXXX@s.whatsapp.net')
    try { await request('/admin/manual-takeover', { method: 'POST', body: JSON.stringify({ jid: manualJid, minutes: 30 }) }); setNotice('تم استلام المحادثة يدويًا. توقف البوت فورًا، وبعد فترة الحماية لن يعود إلا بجملة الإيقاظ.'); await refresh() } catch { setNotice('تعذّر تفعيل الاستلام اليدوي.') }
  }

  const returnBot = async () => {
    if (!manualJid.trim()) return setNotice('اكتب JID المحادثة أولًا.')
    try { await request('/admin/bot-return', { method: 'POST', body: JSON.stringify({ jid: manualJid }) }); setNotice('أصبح الإيقاظ متاحًا لهذه المحادثة. لن يرد البوت حتى تُكتب جملة الإيقاظ.'); await refresh() } catch { setNotice('تعذّر إتاحة الإيقاظ لهذه المحادثة.') }
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

  const flags = useMemo(() => status.flags || { agent: true, send: false, autoReply: false, privateAutoReply: false, voice: false, reminders: false, quoteCard: true }, [status.flags])
  const phases = [
    ['1', 'الوكيل والربط', flags.agent],
    ['2', 'المعاينة والإرسال إلى الذات', flags.send],
    ['3', 'الردود النصية الموجّهة فقط', flags.autoReply],
    ['4', 'فاجئني وشنو فاتني داخل جلسة', flags.autoReply],
    ['5', 'التذكيرات وبطاقات الاقتباس', flags.reminders || flags.quoteCard],
  ] as const

  return (
    <div className="admin-dashboard grid min-w-0 gap-4">
      {/* حتى قسم الحالة يُطوى بأمر الدكتور. لكن الحالة نفسها (متصل/غير متصل)
          تبقى في العنوان — فما فائدة كرتٍ يخفي الخبر الوحيد الذي تريده بنظرة؟ */}
      <details className={card}>
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.75rem] font-semibold uppercase text-accent">مساعد د. أحمد داخل واتساب</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-3 font-display text-2xl font-semibold text-ink">
              وكيل محلي بموافقة الدكتور.
              <span className={`rounded-full px-3 py-1 text-[.72rem] font-semibold ${status.status === 'connected' ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>
                {status.health?.label || stateLabel[String(status.status)] || 'غير مرتبط'}
              </span>
            </h2>
            <p className="mt-2 max-w-2xl text-[.86rem] leading-relaxed text-soft">الجسر مستقل على الماك، والجلسة لا تدخل GitHub ولا Firebase. يعمل طوال اليوم بلا سقف للردود، لكنه لا يبدأ إلا بجملة الإيقاظ، ويصمت فور تدخلك من الهاتف.</p>

            {/* بطاقة التشخيص: الحالة الحقيقية وسببها وعلاجها. كانت اللوحة تقول
                «متصل ✅» والبوت لا يردّ — لأنها تفحص «هل العملية حيّة» لا «هل
                يعمل فعلاً». هنا يرى الدكتور السبب والحلّ بلا أن يسأل أحداً. */}
            {status.health && status.health.code !== 'working' && (
              <div className="mt-4 rounded-2xl border border-accent/40 bg-canvas p-4">
                <p className="text-[.82rem] font-semibold text-accent">{status.health.label}</p>
                {status.health.why && <p className="mt-1 text-[.8rem] leading-relaxed text-ink">{status.health.why}</p>}
                {status.health.fix && <p className="mt-1 text-[.8rem] leading-relaxed text-soft">الحل: {status.health.fix}</p>}
              </div>
            )}
            {status.health?.code === 'working' && (
              <p className="mt-3 text-[.78rem] text-soft">
                ✓ جاهز ويردّ · الطابور سليم{status.health.silenced ? ` · صامتٌ في ${status.health.silenced} محادثة` : ''}
              </p>
            )}

            {/* رمز الاقتران: كان يُطبع في سجلّ الطرفية وحده، فلا يراه الدكتور
                إلا بفتح السجل أو بالرجوع إليّ. يظهر هنا الآن ويتجدّد وحده. */}
            {status.qrImage && status.status !== 'connected' && (
              <div className="mt-4 rounded-2xl border border-accent/40 bg-canvas p-4">
                <p className="text-[.8rem] font-semibold text-ink">اربط جهازك — امسح هذا الرمز</p>
                <p className="mt-1 text-[.75rem] leading-relaxed text-soft">
                  واتساب في جوالك ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز. الرمز يتجدّد وحده كل عشرين ثانية.
                </p>
                <div className="mt-3 flex justify-center rounded-xl bg-white p-4">
                  {/* الصورة تُرسم على ماك الدكتور ثم تصل كـ data URI. ولا تُرسل
                      إلى خدمةٍ خارجية أبداً: نصّ الرمز اعتمادُ اقترانٍ حيّ، ومن
                      ملكه ربط جهازه بحساب الدكتور. */}
                  <img
                    src={status.qrImage}
                    alt="رمز اقتران واتساب"
                    width={260}
                    height={260}
                    className="h-[260px] w-[260px]"
                  />
                </div>
              </div>
            )}
            {status.pairing_code && status.status !== 'connected' && (
              <div className="mt-4 rounded-2xl border border-accent/40 bg-canvas p-4">
                <p className="text-[.8rem] font-semibold text-ink">رمز الاقتران بالرقم</p>
                <p className="mt-2 font-mono text-2xl tracking-[.3em] text-accent">{status.pairing_code}</p>
              </div>
            )}
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent">＋</span>
        </summary>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => void refresh()} disabled={busy} className={secondary}>{busy ? '…' : 'تحديث الحالة'}</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الحالة</p><p className="mt-1 font-semibold text-ink">{status.status && status.status !== 'unconfigured'
            ? (stateLabel[status.status] || status.status)
            : bridgeAlive === null ? 'يفحص…' : bridgeAlive ? 'الجسر يعمل — ينتظر السر' : 'غير مرتبط'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الجسر</p><p className="mt-1 font-semibold text-ink">{status.bridgeOnline ? 'متصل' : bridgeAlive ? 'يعمل — بانتظار السر' : 'غير متصل'}</p><p className="text-[.72rem] text-soft">آخر نبضة: {status.bridgeOnline ? ageLabel(status.heartbeatAgeMs) : bridgeAlive ? 'يستجيب الآن' : '–'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">فهرس الموقع</p><p className="mt-1 font-display text-2xl text-accent">{status.indexed ?? '—'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">المنطقة</p><p className="mt-1 font-semibold text-ink">{status.timeZone || 'Asia/Kuwait'}</p></div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input dir="ltr" className={input} placeholder="Bridge secret — من npm run agent:bridge-secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void toggleEmergencyPause()} disabled={!status.bridgeOnline} className={`rounded-full border px-4 py-2 text-[.8rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${status.runtimePaused ? 'border-accent bg-accent text-white' : 'border-red-300/70 bg-red-50 text-red-700 hover:border-red-500'}`}>{status.runtimePaused ? 'تشغيل الردود' : 'إيقاف الردود فورًا'}</button>
            <button type="button" onClick={() => void pairNow()} disabled={pairing || !bridgeAlive} className={`${secondary} disabled:opacity-40`}>{pairing ? 'يقترن…' : '⚡ اقتران تلقائي'}</button>
            <button type="button" onClick={saveSecret} className={secondary}>حفظ السر محليًا</button>
            <button type="button" onClick={() => void restartBridge()} disabled={restarting || !status.bridgeOnline} className={secondary}>{restarting ? 'جارٍ إعادة التشغيل' : 'إعادة تشغيل واتساب'}</button>
            {/* يظهر دائماً لا عند الصمت وحده: حين يبدو البوت معطوباً يريد الدكتور
                زراً حاضراً يضغطه، لا زراً يبحث عن شرطٍ لظهوره. */}
            <button
              type="button"
              onClick={() => void repairSession()}
              disabled={repairing || !bridgeAlive}
              className={`${secondary} disabled:opacity-40`}
              title="يمسح الجلسة ويطلب رمز QR جديداً"
            >
              {repairing ? 'يُعيد الربط…' : '🔗 إعادة ربط (QR جديد)'}
            </button>
            <button
              type="button"
              onClick={() => void returnBotNow()}
              disabled={returning || !status.bridgeOnline}
              className={silence.silenced > 0 ? primary : secondary}
              title="ينهي فترة الحماية ويجعل جملة الإيقاظ متاحة فوراً"
            >
              {returning ? 'يتيح الإيقاظ…' : silence.silenced > 0 ? `اسمح بالإيقاظ الآن (${silence.silenced})` : 'اسمح بالإيقاظ الآن'}
            </button>
          </div>
          {silence.silenced > 0 && (
            <p className="mt-2 text-[.76rem] leading-relaxed text-accent">
              البوت صامتٌ الآن في {silence.silenced === 1 ? 'محادثة واحدة' : `${silence.silenced} محادثات`}
              {silence.until ? ` حتى ${new Date(silence.until).toLocaleTimeString('ar-KW', { hour: '2-digit', minute: '2-digit' })}` : ''} —
              لأنك رددتَ فيها بيدك. بعد انتهاء الحماية لن يعود تلقائيًا؛ يلزم أن يكتب المرسل جملة الإيقاظ. ويمكنك إتاحة الإيقاظ الآن من الزر.
            </p>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">
          وضع الرقم الشخصي مفعل: لا مجموعات ولا حالات ولا حملات جماعية. يعمل طوال اليوم بلا حد زمني أو عددي، لكنه صامت قبل جملة الإيقاظ.
          بعد الإيقاظ تبقى الجلسة حيّة ويتفاعل من فهرس الموقع فقط، من دون تأليف أو مصادر خارجية.
          تدخلك اليدوي يوقفه فورًا ويمحو الجلسة؛ وبعد فترة الحماية لا يعود إلا بجملة الإيقاظ من جديد. ويصمت أمام الوسائط والروابط والموعد والاستشارة والإشراف.
        </div>
        {status.last_error && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.8rem] text-soft">{status.last_error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{notice}</p>}
      </details>

      {/* حُذف «بوابة الإطلاق» بأمر الدكتور — إزعاجٌ بصريّ بلا فائدة. */}

      {/* حُذفت «غرفة البرودكاست الهادئ» القديمة: كانت تطلب أرقاماً تُكتب سطراً
          سطراً ولا تعرف قوائم الدكتور، فتقول «الجهات الجاهزة: 0» وهو يملك ألفين.
          خلفتها BroadcastStudio: قائمةٌ تُختار، ومعاينةٌ تقول كم سيصل، وتجربةٌ على
          النفس قبل الناس. ولا مكانان لوظيفةٍ واحدة. */}
      {!personalNumberMode && <BroadcastStudio request={request} onNotice={setNotice} />}

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

      {/* حُذفت بطاقة «الحملات المحلية»: كانت تُخفي مسودتك حتى تضغط «اعتماد»، فتظهر
          خطوةٌ ناقصة بلا سياق وتغيب البقية. وغرفة البثّ أعلاه تُري المسار كاملاً
          من أوله — والاعتماد صار داخلها خطوةً لا باباً. */}
      {bridge && !personalNumberMode && <AudienceStudio request={request} onNotice={setNotice} />}


      {/* حُذف «التشغيل المحلي» بأمر الدكتور — إزعاجٌ بصريّ بلا فائدة. */}
    </div>
  )
}
