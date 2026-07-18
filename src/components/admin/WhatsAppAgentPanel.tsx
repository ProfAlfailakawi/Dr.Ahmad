import { useEffect, useMemo, useState } from 'react'

type AgentStatus = {
  status?: string
  indexed?: number
  last_error?: string | null
  device_name?: string
  updated_at?: string
  flags?: Record<string, boolean>
  timeZone?: string
  bridgeOnline?: boolean
  lastHeartbeatAt?: string | null
  heartbeatAgeMs?: number | null
  restartRequestedAt?: string | null
  port?: number
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
type Simulation = { intent?: string; confidence?: number; needsHuman?: boolean; ruleId?: string | null; ruleName?: string | null; preview?: string }

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

  useEffect(() => { void refresh() }, [])

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
    try { await request('/admin/manual-takeover', { method: 'POST', body: JSON.stringify({ jid: manualJid, minutes: 30 }) }); setNotice('تم استلام المحادثة يدويًا؛ البوت سيصمت 30 دقيقة.'); await refresh() } catch { setNotice('تعذّر تفعيل الاستلام اليدوي.') }
  }

  const returnBot = async () => {
    if (!manualJid.trim()) return setNotice('اكتب JID المحادثة أولًا.')
    try { await request('/admin/bot-return', { method: 'POST', body: JSON.stringify({ jid: manualJid }) }); setNotice('عاد البوت لهذه المحادثة عند رسالة العميل التالية.'); await refresh() } catch { setNotice('تعذّر إرجاع المحادثة للبوت.') }
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
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.75rem] font-semibold uppercase text-accent">مساعد د. أحمد داخل واتساب</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">وكيل محلي بموافقة الدكتور.</h2>
            <p className="mt-2 max-w-2xl text-[.86rem] leading-relaxed text-soft">الجسر مستقل على الماك، والجلسة لا تدخل GitHub ولا Firebase. إذا تدخلت من الهاتف يصمت البوت تلقائيًا، وإذا توقف الماك يتوقف واتساب فقط.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={busy} className={secondary}>{busy ? '…' : 'تحديث الحالة'}</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الحالة</p><p className="mt-1 font-semibold text-ink">{stateLabel[status.status || 'unconfigured'] || status.status}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الجسر</p><p className="mt-1 font-semibold text-ink">{status.bridgeOnline ? 'متصل' : 'غير متصل'}</p><p className="text-[.72rem] text-soft">آخر نبضة: {ageLabel(status.heartbeatAgeMs)}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">فهرس الموقع</p><p className="mt-1 font-display text-2xl text-accent">{status.indexed ?? '—'}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">المنطقة</p><p className="mt-1 font-semibold text-ink">{status.timeZone || 'Asia/Kuwait'}</p></div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input dir="ltr" className={input} placeholder="Bridge secret — من npm run agent:bridge-secret" value={secret} onChange={(event) => setSecret(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={saveSecret} className={secondary}>حفظ السر محليًا</button>
            <button type="button" onClick={() => void restartBridge()} disabled={restarting || !status.bridgeOnline} className={secondary}>{restarting ? 'جارٍ إعادة التشغيل' : 'إعادة تشغيل واتساب'}</button>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">الوضع الآمن مفعل: لا رد تلقائي على الأهل والربع. الرد يكون فقط داخل جلسة محتوى، أو عند صيغة صريحة مثل «سؤال: …» أو «اسأل الدكتور: …».</div>
        {status.last_error && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.8rem] text-soft">{status.last_error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{notice}</p>}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">الوضع اليدوي</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">استلام محادثة أو إرجاعها للبوت.</h3></div><p className="text-[.78rem] text-soft">ردك من الهاتف يفعّل هذا تلقائيًا.</p></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input dir="ltr" className={input} placeholder="965XXXXXXXX@s.whatsapp.net" value={manualJid} onChange={(event) => setManualJid(event.target.value)} />
          <button type="button" onClick={() => void manualTakeover()} className={secondary}>استلام يدوي</button>
          <button type="button" onClick={() => void returnBot()} className={primary}>إرجاع للبوت</button>
        </div>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">بوابة الإطلاق</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">المراحل لا تُفتح دفعة واحدة.</h3></div><p className="text-[.78rem] text-soft">الإرسال والرد الآلي مغلقان حتى اعتمادك.</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">{phases.map(([number, label, active]) => <div key={number} className={`rounded-xl border p-3 ${active ? 'border-accent/40 bg-canvas' : 'border-hair bg-canvas/60'}`}><p className="text-[.72rem] font-semibold text-accent">{number}</p><p className="mt-1 text-[.78rem] leading-relaxed text-ink">{label}</p><p className="mt-2 text-[.68rem] text-soft">{active ? 'متاح' : 'مغلق'}</p></div>)}</div>
      </section>

      <details className={`${card} group`} open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="block font-display text-xl font-semibold text-ink">غرفة البرودكاست الهادئ</span><span className="mt-1 block text-[.8rem] text-soft">اكتب، عاين، اختر القروب، ثم احفظ مسودة. الإرسال الحقيقي يحتاج اعتمادًا وفاصلًا زمنيًا.</span></span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span></summary>
        <div className="mt-5 grid gap-4 border-t border-hair pt-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
            <input className={input} placeholder="اسم البرودكاست الهادئ" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
            <label className="grid gap-1 text-[.72rem] text-soft">
              الفاصل بين الرسائل
              <select className={input} value={intervalSeconds} onChange={(event) => setIntervalSeconds(Number(event.target.value))}>
                <option value={20}>20 ثانية</option>
                <option value={45}>45 ثانية</option>
                <option value={90}>90 ثانية</option>
                <option value={180}>3 دقائق</option>
              </select>
            </label>
          </div>
          <textarea className={`${input} min-h-32 resize-y`} placeholder="نص الرسالة — راجعه كأنه سينشر باسمك" value={campaignText} onChange={(event) => setCampaignText(event.target.value)} />
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-hair bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold text-ink">القروبات من واتساب</p><p className="mt-1 text-[.73rem] text-soft">لا أعرض أرقام الأعضاء ولا أخزنها؛ فقط اسم القروب وعدده.</p></div>
                <button type="button" onClick={() => void loadGroups()} disabled={busy || !status.bridgeOnline} className={secondary}>سحب القروبات</button>
              </div>
              <div className="mt-3 grid gap-2">
                {groups.length ? groups.map((group) => {
                  const active = selectedGroupIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupIds((current) => active ? current.filter((id) => id !== group.id) : [...current, group.id])}
                      className={`rounded-xl border px-4 py-3 text-right text-[.82rem] transition-colors ${active ? 'border-accent bg-accent text-white' : 'border-hair bg-wash text-ink hover:border-accent'}`}
                    >
                      <span className="block font-semibold">{group.name}</span>
                      <span className={`mt-1 block text-[.7rem] ${active ? 'text-white/75' : 'text-soft'}`}>{group.memberCount ? `${group.memberCount} عضو تقريبًا` : 'عدد الأعضاء غير متاح'}</span>
                    </button>
                  )
                }) : <p className="rounded-xl border border-hair bg-wash px-4 py-3 text-[.8rem] text-soft">لم تُسحب القروبات بعد. شغّل الجسر واتصل بواتساب ثم اضغط «سحب القروبات».</p>}
              </div>
            </div>
            <div className="rounded-xl border border-hair bg-canvas p-4">
              <p className="font-semibold text-ink">أرقام أو جهات اختيارية</p>
              <p className="mt-1 text-[.73rem] text-soft">كل سطر رقم كويتي 8 خانات أو JID. لا تُحفظ الأرقام الخام داخل Git.</p>
              <textarea dir="ltr" className={`${input} mt-3 min-h-32 resize-y`} placeholder={'97424400\n965XXXXXXXX@s.whatsapp.net'} value={campaignTargetsText} onChange={(event) => setCampaignTargetsText(event.target.value)} />
              <p className="mt-2 text-[.72rem] text-soft">الجهات الجاهزة الآن: {draftTargets().length}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[.76rem] leading-relaxed text-soft">هذه ليست أداة إزعاج: أرسل فقط لمن وافق أو لمن بينك وبينه سياق واضح. الردود الآلية على رقمك الخاص تبقى مقفلة إلا عند سؤال صريح أو جلسة محتوى.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void previewSelf()} disabled={!status.bridgeOnline || !flags.send} className={secondary}>معاينة على نفسي</button>
              <button type="button" onClick={() => void saveDraft()} className={primary}>حفظ مسودة هادئة</button>
            </div>
          </div>
        </div>
      </details>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">مركز إدارة الردود</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">قواعد قابلة للتعديل بلا كود.</h3></div><button type="button" onClick={resetRule} className={secondary}>قاعدة جديدة</button></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="grid gap-3 rounded-xl border border-hair bg-canvas p-4">
            <input className={input} placeholder="اسم القاعدة" value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} />
            <textarea className={`${input} min-h-20 resize-y`} placeholder="الكلمات المفتاحية — افصل بفواصل أو أسطر" value={keywordsText(ruleForm)} onChange={(event) => setRuleForm((current) => ({ ...current, keywords: parseKeywords(event.target.value) }))} />
            <div className="grid gap-3 sm:grid-cols-3">
              <input className={input} type="number" placeholder="الأولوية" value={ruleForm.priority} onChange={(event) => setRuleForm((current) => ({ ...current, priority: Number(event.target.value || 0) }))} />
              <select className={input} value={ruleForm.matchType} onChange={(event) => setRuleForm((current) => ({ ...current, matchType: event.target.value as ReplyRule['matchType'] }))}><option value="any">أي كلمة</option><option value="all">كل الكلمات</option><option value="exact">مطابقة كاملة</option></select>
              <select className={input} value={ruleForm.actionType} onChange={(event) => setRuleForm((current) => ({ ...current, actionType: event.target.value as ReplyRule['actionType'] }))}><option value="text">رد نصي</option><option value="site-content">من محتوى الموقع</option><option value="transfer">تحويل لموظف</option></select>
            </div>
            <textarea className={`${input} min-h-24 resize-y`} placeholder="نص الرد أو تمهيد الرد" value={ruleForm.responseText} onChange={(event) => setRuleForm((current) => ({ ...current, responseText: event.target.value }))} />
            <input className={input} placeholder="استعلام محتوى الموقع — اختياري" value={ruleForm.contentQuery} onChange={(event) => setRuleForm((current) => ({ ...current, contentQuery: event.target.value }))} />
            <label className="flex items-center gap-2 text-[.8rem] text-soft"><input type="checkbox" checked={ruleForm.enabled} onChange={(event) => setRuleForm((current) => ({ ...current, enabled: event.target.checked }))} /> مفعّلة</label>
            <button type="button" onClick={() => void saveRule()} className={primary}>{ruleForm.id ? 'حفظ التعديل' : 'إضافة القاعدة'}</button>
          </div>
          <div className="grid content-start gap-2">
            {rules.length ? rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-hair bg-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="font-semibold text-ink">{rule.name}</p><p className="mt-1 text-[.72rem] text-soft">{rule.enabled ? 'مفعّلة' : 'معطّلة'} · {rule.actionType} · أولوية {rule.priority}</p><p className="mt-2 text-[.76rem] text-soft">{rule.keywords.join('، ')}</p></div>
                  <div className="flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => editRule(rule)}>تعديل</button><button type="button" className={secondary} onClick={() => void loadVersions(rule.id)}>النسخ</button><button type="button" className={secondary} onClick={() => void deleteRule(rule.id)}>حذف</button></div>
                </div>
                {ruleVersions[rule.id]?.length ? <div className="mt-3 flex flex-wrap gap-2 border-t border-hair pt-3">{ruleVersions[rule.id].map((version) => <button type="button" key={version.id} className={secondary} onClick={() => void rollbackRule(rule.id, version.id)}>رجوع #{version.id}</button>)}</div> : null}
              </div>
            )) : <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">لا توجد قواعد رد مخصصة بعد.</p>}
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-xl border border-hair bg-canvas p-4 lg:grid-cols-[1fr_auto]">
          <input className={input} placeholder="محاكي: اكتب رسالة افتراضية" value={simulateText} onChange={(event) => setSimulateText(event.target.value)} />
          <button type="button" className={secondary} onClick={() => void runSimulator()}>اختبار الرد</button>
          {simulation && <p className="lg:col-span-2 rounded-xl border border-hair bg-wash px-4 py-3 text-[.8rem] leading-relaxed text-soft">القاعدة: {simulation.ruleName || simulation.intent || '—'} · الثقة: {simulation.confidence ?? '—'}{simulation.needsHuman ? ' · يحتاج موظف' : ''}<br />{simulation.preview || 'لا يوجد رد.'}</p>}
        </div>
      </section>

      {bridge && <section className={card}><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">الحملات المحلية</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">مسوداتك، اعتمادك، ثم إرسال هادئ.</h3></div><p className="text-[.78rem] text-soft">لا يظهر هنا أي رقم أو جلسة.</p></div><div className="mt-4 grid gap-2">{campaigns.length ? campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3"><div><p className="font-semibold text-ink">{campaign.name}</p><p className="mt-1 text-[.72rem] text-soft">{campaign.state === 'draft' ? 'مسودة' : campaign.state === 'approved' ? 'معتمدة — غير مرسلة' : campaign.state === 'sending' || campaign.state === 'queued' ? 'قيد الإرسال الهادئ' : campaign.state} · {campaign.target_count || 0} جهة/قروب</p></div><div className="flex flex-wrap gap-2">{campaign.state === 'draft' && <button type="button" onClick={() => void approve(campaign.id)} className={secondary}>اعتماد للمراجعة</button>}{campaign.state === 'approved' && <button type="button" onClick={() => void sendQuiet(campaign)} disabled={sendingCampaignId === campaign.id || !flags.send || !status.bridgeOnline} className={primary}>{sendingCampaignId === campaign.id ? 'يبدأ…' : 'إرسال هادئ'}</button>}{['queued', 'sending'].includes(campaign.state) && <button type="button" onClick={() => void stopQuiet(campaign.id)} className={secondary}>إيقاف</button>}</div></div>) : <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">لا توجد مسودات محلية بعد.</p>}</div></section>}

      <section className="rounded-2xl border border-hair bg-canvas p-5 md:p-6"><p className="text-[.75rem] font-semibold uppercase text-accent">التشغيل المحلي</p><p className="mt-2 text-[.84rem] leading-relaxed text-soft">شغّل <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">npm run agent:self-test</code> ثم أول مرة <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">WHATSAPP_AGENT_BRIDGE=true npm run agent:start -- --phone=96597424400</code>. لمعرفة السر المحلي استخدم <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">npm run agent:bridge-secret</code>. لا تضع السر أو جلسة واتساب في GitHub.</p></section>
    </div>
  )
}
