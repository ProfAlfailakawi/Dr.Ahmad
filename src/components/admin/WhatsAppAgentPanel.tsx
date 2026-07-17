import { useEffect, useMemo, useState } from 'react'

type AgentStatus = {
  status?: string
  indexed?: number
  last_error?: string | null
  device_name?: string
  updated_at?: string
  flags?: Record<string, boolean>
  timeZone?: string
}
type Campaign = { id: string; name: string; state: string; created_at: string; approved_at?: string | null }

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent'
const secondary = 'rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent'

const stateLabel: Record<string, string> = {
  unconfigured: 'غير مرتبط', pairing: 'بانتظار QR أو رمز الاقتران', connected: 'متصل', disconnected: 'غير متصل', reconnecting: 'يعيد الاتصال', paused: 'متوقف مؤقتًا', sending: 'يرسل بعد الاعتماد', 'azure-disabled': 'الصوت معطّل', error: 'يحتاج مراجعة',
}

export function WhatsAppAgentPanel() {
  const [status, setStatus] = useState<AgentStatus>({ status: 'unconfigured' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignText, setCampaignText] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const bridgeCandidate = String(import.meta.env.VITE_WHATSAPP_AGENT_BRIDGE_URL || '').replace(/\/+$/, '')
  const bridge = /^(https?:\/\/)(127\.0\.0\.1|localhost)(:\d+)?$/i.test(bridgeCandidate) ? bridgeCandidate : ''

  const refresh = async () => {
    if (!bridge) { setNotice('الوكيل محلي على الماك؛ لم يُضبط جسر متصفح عام، وهذا مقصود لحماية الجلسة.'); return }
    setBusy(true)
    try {
      const response = await fetch(`${bridge}/status`, { headers: { Accept: 'application/json' } }); if (!response.ok) throw new Error('status'); setStatus(await response.json())
      const campaignsResponse = await fetch(`${bridge}/campaigns`, { headers: { Accept: 'application/json' } }); if (campaignsResponse.ok) setCampaigns(await campaignsResponse.json())
      setNotice('تحدّثت الحالة.')
    } catch { setNotice('تعذّر الوصول إلى الوكيل المحلي. تأكد أنه يعمل على الماك.') } finally { setBusy(false) }
  }

  useEffect(() => { void refresh() }, [])

  const saveDraft = async () => {
    if (!campaignName.trim() || !campaignText.trim()) return setNotice('اكتب اسم المسودة ونصها أولًا.')
    if (bridge) {
      try { const response = await fetch(`${bridge}/campaigns/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: campaignName, message: campaignText }) }); if (!response.ok) throw new Error('draft') } catch { return setNotice('تعذّر حفظ المسودة عبر الوكيل المحلي.') }
    } else {
      try { localStorage.setItem('whatsapp-agent-draft', JSON.stringify({ name: campaignName, message: campaignText, savedAt: new Date().toISOString() })) } catch { /* noop */ }
    }
    setNotice('حُفظت كمسودة فقط؛ لا يوجد إرسال.')
  }

  const approve = async (id: string) => {
    if (!bridge) return setNotice('اعتماد الحملة يتم من الوكيل المحلي بعد تشغيل الجسر.')
    try { const response = await fetch(`${bridge}/campaigns/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }); if (!response.ok) throw new Error('approve'); setNotice('اعتمدت المسودة؛ الإرسال ما زال مغلقًا حتى أمر يدوي ثانٍ.'); await refresh() } catch { setNotice('تعذّر اعتماد المسودة.') }
  }

  const flags = useMemo(() => status.flags || { agent: true, send: false, autoReply: false, voice: false, reminders: false, quoteCard: true }, [status.flags])
  const phases = [
    ['1', 'الوكيل والربط', flags.agent],
    ['2', 'المعاينة والإرسال إلى الذات', flags.send],
    ['3', 'الردود النصية والبحث', flags.autoReply],
    ['4', 'فاجئني وشنو فاتني', flags.autoReply],
    ['5', 'التذكيرات وبطاقات الاقتباس', flags.reminders || flags.quoteCard],
  ] as const

  return (
    <div className="admin-dashboard grid min-w-0 gap-4">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[.75rem] font-semibold uppercase text-accent">مساعد د. أحمد داخل واتساب</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">وكيل محلي بموافقة الدكتور.</h2><p className="mt-2 max-w-2xl text-[.86rem] leading-relaxed text-soft">يبحث في أرشيف الموقع فقط، ولا يرد على المحادثات الشخصية افتراضيًا. الجلسة والأرقام تبقى على الماك.</p></div>
          <button type="button" onClick={() => void refresh()} disabled={busy} className={secondary}>{busy ? '…' : 'تحديث الحالة'}</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">الحالة</p><p className="mt-1 font-semibold text-ink">{stateLabel[status.status || 'unconfigured'] || status.status}</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">فهرس الموقع</p><p className="mt-1 font-display text-2xl text-accent">{status.indexed ?? '—'}</p><p className="text-[.72rem] text-soft">مادة مشتقة</p></div>
          <div className="rounded-xl border border-hair bg-canvas p-4"><p className="text-[.74rem] text-soft">المنطقة</p><p className="mt-1 font-semibold text-ink">{status.timeZone || 'Asia/Kuwait'}</p></div>
        </div>
        {status.last_error && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.8rem] text-soft">{status.last_error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{notice}</p>}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">بوابة الإطلاق</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">المراحل لا تُفتح دفعة واحدة.</h3></div><p className="text-[.78rem] text-soft">الإرسال والرد الآلي مغلقان حتى اعتمادك.</p></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">{phases.map(([number, label, active]) => <div key={number} className={`rounded-xl border p-3 ${active ? 'border-accent/40 bg-canvas' : 'border-hair bg-canvas/60'}`}><p className="text-[.72rem] font-semibold text-accent">{number}</p><p className="mt-1 text-[.78rem] leading-relaxed text-ink">{label}</p><p className="mt-2 text-[.68rem] text-soft">{active ? 'متاح' : 'مغلق'}</p></div>)}</div>
      </section>

      <details className={`${card} group`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="block font-display text-xl font-semibold text-ink">مسودة رسالة</span><span className="mt-1 block text-[.8rem] text-soft">أنشئها وراجعها هنا؛ لا تُرسل من هذه الشاشة.</span></span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span></summary>
        <div className="mt-5 grid gap-3 border-t border-hair pt-5"><input className={input} placeholder="اسم المسودة" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} /><textarea className={`${input} min-h-32 resize-y`} placeholder="نص الرسالة أو الحملة" value={campaignText} onChange={(event) => setCampaignText(event.target.value)} /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[.76rem] text-soft">الخطوة التالية (اختيار القوائم والإرسال إلى الذات) تتم من الوكيل المحلي بعد الربط.</p><button type="button" onClick={() => void saveDraft()} className={secondary}>حفظ مسودة</button></div></div>
      </details>

      {bridge && <section className={card}><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.75rem] font-semibold uppercase text-accent">الحملات المحلية</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">مسوداتك، ثم موافقتك.</h3></div><p className="text-[.78rem] text-soft">لا يظهر هنا أي رقم أو جلسة.</p></div><div className="mt-4 grid gap-2">{campaigns.length ? campaigns.map((campaign) => <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3"><div><p className="font-semibold text-ink">{campaign.name}</p><p className="mt-1 text-[.72rem] text-soft">{campaign.state === 'draft' ? 'مسودة' : campaign.state === 'approved' ? 'معتمدة — غير مرسلة' : campaign.state}</p></div>{campaign.state === 'draft' && <button type="button" onClick={() => void approve(campaign.id)} className={secondary}>اعتماد للمراجعة</button>}</div>) : <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">لا توجد مسودات محلية بعد.</p>}</div></section>}

      <section className="rounded-2xl border border-hair bg-canvas p-5 md:p-6"><p className="text-[.75rem] font-semibold uppercase text-accent">التشغيل المحلي</p><p className="mt-2 text-[.84rem] leading-relaxed text-soft">من داخل مجلد <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">whatsapp-agent</code> شغّل <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">npm run self-test</code> ثم <code dir="ltr" className="rounded bg-wash px-1.5 py-0.5 text-[.75rem] text-ink">npm run start</code>. لن تظهر QR أو حالة الهاتف في الموقع العام، ولن تُحفظ الجلسة داخل Firebase.</p></section>
    </div>
  )
}
