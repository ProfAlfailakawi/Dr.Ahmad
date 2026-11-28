/**
 * غرفة البثّ — واحدة بدل اثنتين.
 *
 * كان البثّ مشطوراً: القوائم في «استوديو الجمهور»، والإرسال في «غرفة البرودكاست»
 * التي تطلب أرقاماً تُكتب سطراً سطراً. فمن بنى قائمةً من ألفٍ لم يجد سبيلاً
 * لإرسالها، ومن فتح غرفة الإرسال رأى «الجهات الجاهزة: 0» ولم يفهم لماذا.
 *
 * وهنا مسارٌ واحد لا يتشعّب، أربع خطوات ظاهرة معاً لا مخفية خلف اعتماد:
 *   ١) لمن؟  تختار قائمةً فيقول لك فوراً: كم سيصل وكم استُبعد ولماذا.
 *   ٢) ماذا؟ تكتب، أو تُرفق حلقةً فيُركَّب نصّها بعنوانها ورابطها.
 *   ٣) جرّب على نفسك: ترى الرسالة في واتساب قبل أن يراها أحد.
 *   ٤) أرسل: تأكيدان صريحان، ثم إرسالٌ هادئ بفاصلٍ زمني.
 *
 * والبطاقة تظهر من أول لحظة لا بعد «الاعتماد» — فالاعتماد خطوةٌ في الطريق،
 * لا بابٌ يُخفي الطريق كلّه حتى تعبره.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

type List = { id: string; name: string; note?: string; kind?: string; count?: number }
type Preview = { samples: { name: string; body: string }[]; willSend: number; suppressed: number }
type Episode = { slug: string; title: string; url?: string }
type Campaign = {
  id: string
  name: string
  state: string
  total: number
  sent: number
  failed: number
  completed: number
  remaining: number
  cursor: number
  intervalSeconds: number
  nextAt?: string | null
  lastError?: string | null
  messagePreview?: string
  createdAt?: string | null
  startedAt?: string | null
  pausedAt?: string | null
  completedAt?: string | null
  updatedAt?: string | null
}
type CampaignFailure = { index: number; recipient: string; reason: string }
type CampaignDetail = Campaign & { failures?: CampaignFailure[] }

type Props = {
  request: (path: string, init?: RequestInit) => Promise<unknown>
  episodes?: Episode[]
  onNotice?: (message: string) => void
}

const SITE = 'https://dr-alfailakawi.com'

/** نصّ إرفاق الحلقة — قالبٌ ثابت، لا يتغيّر فيه إلا العنوان والرابط */
export function episodeMessage(episode: Episode): string {
  const url = episode.url || `${SITE}/articles/${episode.slug}`
  return `حلقة جديدة من مكتبة د. أحمد الفيلكاوي:\n\n«${episode.title}»\n\nاستمع هنا:\n${url}`
}

/** ما الذي يمنع الإرسال الآن؟ رسالةٌ واحدة صريحة بدل زرٍّ معطّلٍ بلا سبب */
export function blockingReason(listId: string, text: string, willSend: number): string {
  if (!listId) return 'اختر قائمةً أولاً.'
  if (!text.trim()) return 'اكتب نصّ الرسالة أو أرفِق حلقة.'
  if (text.trim().length < 12) return 'النصّ قصير جداً — راجعه كأنه سيُنشر باسمك.'
  if (!willSend) return 'لا جهة ستصلها هذه الرسالة. راجع أعضاء القائمة.'
  return ''
}

const campaignStateLabel: Record<string, string> = {
  draft: 'مسودة', approved: 'معتمدة', sending: 'قيد الإرسال', paused: 'متوقفة مؤقتاً',
  retrying: 'تعيد الفاشل', completed: 'مكتملة', partial: 'اكتملت مع تعثرات', stopped: 'موقوفة',
}

function campaignDate(value?: string | null, withTime = true) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return withTime
    ? date.toLocaleString('ar-KW-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' })
    : date.toLocaleDateString('ar-KW-u-nu-latn')
}

export function BroadcastStudio({ request, episodes = [], onNotice }: Props) {
  const [lists, setLists] = useState<List[]>([])
  const [listId, setListId] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [interval, setIntervalSeconds] = useState(45)
  const [confirmOnce, setConfirmOnce] = useState(false)
  const [emergencyBusy, setEmergencyBusy] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activeCampaignId, setActiveCampaignId] = useState('')
  const [activeCampaign, setActiveCampaign] = useState<CampaignDetail | null>(null)
  const [campaignActionBusy, setCampaignActionBusy] = useState('')
  const [campaignsBusy, setCampaignsBusy] = useState(false)
  const requestRef = useRef(request)
  useEffect(() => { requestRef.current = request }, [request])

  const say = (message: string) => { setNotice(message); onNotice?.(message) }

  const loadCampaignDetail = async (id: string) => {
    if (!id) { setActiveCampaign(null); return }
    try {
      const detail = await requestRef.current(`/campaigns/${encodeURIComponent(id)}`) as CampaignDetail
      setActiveCampaign(detail)
    } catch {
      setActiveCampaign((current) => current?.id === id ? current : null)
    }
  }

  const refreshCampaigns = async (preferredId = '', silent = true) => {
    if (!silent) setCampaignsBusy(true)
    try {
      const data = await requestRef.current('/campaigns', { cache: 'no-store' }) as { campaigns?: Campaign[] }
      const rows = data?.campaigns || []
      setCampaigns(rows)
      const preferred = preferredId || activeCampaignId
      const exists = preferred && rows.some((item) => item.id === preferred)
      const nextId = exists
        ? preferred
        : rows.find((item) => ['sending', 'retrying', 'paused'].includes(item.state))?.id || rows[0]?.id || ''
      if (nextId !== activeCampaignId) setActiveCampaignId(nextId)
      await loadCampaignDetail(nextId)
    } catch {
      // المتابعة الحية إضافة تشغيلية؛ تعطل القراءة لا يوقف إنشاء الحملات أو إرسالها.
    } finally {
      if (!silent) setCampaignsBusy(false)
    }
  }

  useEffect(() => { void refreshCampaigns('', true) }, [])
  useEffect(() => {
    if (!activeCampaignId) return
    void loadCampaignDetail(activeCampaignId)
    const timer = window.setInterval(() => { void refreshCampaigns(activeCampaignId, true) }, 3_000)
    return () => window.clearInterval(timer)
  }, [activeCampaignId])

  useEffect(() => {
    void (async () => {
      try {
        const data = await request('/admin/audience/lists') as { lists?: List[] }
        setLists(data?.lists || [])
      } catch { /* الجسر مغلق: تبقى القائمة فارغة ويظهر سببها أدناه */ }
    })()
  }, [request])

  /* المعاينة تُطلب عند تبدّل القائمة أو النصّ — وهي التي تقول الحقيقة:
     كم سيصل فعلاً، وكم استُبعد لأنه طلب الإيقاف. */
  useEffect(() => {
    if (!listId) { setPreview(null); return }
    let alive = true
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await request('/admin/audience/preview', {
            method: 'POST',
            body: JSON.stringify({ listId, text: text || 'معاينة' }),
          }) as Preview
          if (alive) setPreview(data)
        } catch { if (alive) setPreview(null) }
      })()
    }, 300)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [listId, text, request])

  const chosen = useMemo(() => lists.find((item) => item.id === listId), [lists, listId])
  const willSend = preview?.willSend ?? 0
  const blocked = blockingReason(listId, text, willSend)

  const previewToSelf = async () => {
    setBusy('self')
    try {
      const result = await request('/admin/send-self-preview', { method: 'POST', body: JSON.stringify({ message: text }) }) as { ok?: boolean; messageId?: string; queued?: boolean }
      if (!result?.ok || !result.messageId) throw new Error('لم يؤكد واتساب إرسال المعاينة')
      let terminal: { status?: string; error?: string | null } | null = null
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1_250))
        terminal = await request(`/admin/commands/${encodeURIComponent(result.messageId)}`) as { status?: string; error?: string | null }
        if (['completed', 'failed', 'cancelled'].includes(String(terminal.status || ''))) break
      }
      if (terminal?.status === 'failed' || terminal?.status === 'cancelled') throw new Error(terminal.error || 'لم يسلّم واتساب المعاينة')
      say(terminal?.status === 'completed'
        ? '✓ سلّم جسر واتساب المعاينة فعلياً إلى محادثتك. اقرأها كما سيقرأها الناس.'
        : 'المعاينة قيد التسليم؛ إذا أعاد واتساب تهيئة جلسته فسيكملها الجسر تلقائياً من دون تكرار الإرسال.')
    } catch (error) {
      say(`تعذّرت المعاينة: ${error instanceof Error ? error.message : 'خطأ'}`)
    } finally { setBusy('') }
  }

  const send = async () => {
    if (!confirmOnce) { setConfirmOnce(true); say(`اضغط مرّةً أخرى لتأكيد الإرسال إلى ${willSend} جهة.`); return }
    setBusy('send')
    try {
      const draft = await request('/admin/audience/draft', {
        method: 'POST',
        body: JSON.stringify({ listId, name: `${chosen?.name || 'بثّ'} · ${new Date().toLocaleDateString('ar-KW')}`, message: text }),
      }) as { id?: string }
      const id = draft?.id
      if (!id) throw new Error('لم تُنشأ المسودة')
      await request(`/campaigns/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ confirm: true }) })
      await request(`/campaigns/${encodeURIComponent(id)}/send-quiet`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true, confirmAgain: true, intervalSeconds: interval }),
      })
      setActiveCampaignId(id)
      await refreshCampaigns(id, true)
      say(`✓ بدأ الإرسال الهادئ إلى ${willSend} جهة، بفاصل ${interval} ثانية. المتابعة الحية ظهرت أسفل الإرسال.`)
      setConfirmOnce(false)
      setText('')
    } catch (error) {
      say(`تعذّر الإرسال: ${error instanceof Error ? error.message : 'خطأ'}`)
      setConfirmOnce(false)
    } finally { setBusy('') }
  }

  const emergencyStop = async () => {
    if (!window.confirm('سيُوقف هذا كل معاينة أو حملة واتساب ما زالت في الطابور. الرسائل التي سُلّمت بالفعل لا يمكن سحبها. هل تتابع؟')) return
    setEmergencyBusy(true)
    try {
      const result = await request('/admin/emergency-stop', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      }) as { commandsStopped?: number; campaignsStopped?: number }
      say(`توقف الإرسال الآن: أُلغيت ${Number(result.commandsStopped || 0)} رسالة معلّقة وأُوقفت ${Number(result.campaignsStopped || 0)} حملة.`)
      setConfirmOnce(false)
      await refreshCampaigns(activeCampaignId, true)
    } catch (error) {
      say(`تعذّر إيقاف الإرسال: ${error instanceof Error ? error.message : 'خطأ'}`)
    } finally {
      setEmergencyBusy(false)
    }
  }

  const campaignAction = async (action: 'pause' | 'resume' | 'retry-failed') => {
    if (!activeCampaignId) return
    if (action === 'retry-failed' && !window.confirm('إعادة محاولة الأرقام التي فشل تسليمها فقط؟ لن تُعاد الرسائل الناجحة.')) return
    setCampaignActionBusy(action)
    try {
      await requestRef.current(`/campaigns/${encodeURIComponent(activeCampaignId)}/${action}`, {
        method: 'POST',
        body: action === 'retry-failed' ? JSON.stringify({ confirm: true, intervalSeconds: interval }) : JSON.stringify({}),
      })
      await refreshCampaigns(activeCampaignId, true)
      say(action === 'pause' ? 'أوقفت الحملة مؤقتاً. الرسائل التي سُلّمت بقيت كما هي.' : action === 'resume' ? 'استؤنفت الحملة من موضعها من دون إعادة ما نجح.' : 'بدأت إعادة محاولة الرسائل الفاشلة فقط.')
    } catch (error) {
      say(`تعذّر تنفيذ الإجراء: ${error instanceof Error ? error.message : 'خطأ'}`)
    } finally {
      setCampaignActionBusy('')
    }
  }

  const field = 'w-full rounded-xl border border-hair bg-canvas px-3 py-2.5 text-[.85rem] text-ink outline-none focus:border-accent'
  const step = 'rounded-2xl border border-hair bg-canvas p-4'

  return (
    <details className="group rounded-2xl border border-hair bg-wash p-5" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block font-display text-xl font-semibold text-ink">غرفة البثّ</span>
          <span className="mt-1 block text-[.8rem] text-soft">قائمة، ثم رسالة، ثم تجربةٌ على نفسك، ثم إرسالٌ هادئ.</span>
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>

      <div className="mt-5 grid gap-4">
        {/* ١ · لمن */}
        <div className={step}>
          <p className="text-[.75rem] font-semibold text-accent">١ · إلى مَن؟</p>
          {lists.length === 0 && <p className="mt-2 text-[.8rem] text-soft">لا قوائم بعد. ابنِ قائمةً من «دفتر الأسماء» أعلاه.</p>}
          {lists.length > 0 && (
            <select value={listId} onChange={(event) => { setListId(event.target.value); setConfirmOnce(false) }} className={`mt-2 ${field}`}>
              <option value="">— اختر قائمة —</option>
              {lists.map((item) => <option key={item.id} value={item.id}>{item.name}{item.count != null ? ` · ${item.count}` : ''}</option>)}
            </select>
          )}

          {preview && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[.8rem]">
              <span className="rounded-full bg-accent px-3 py-1 font-semibold text-white">{preview.willSend} ستصلهم</span>
              {preview.suppressed > 0 && (
                <span className="rounded-full border border-hair px-3 py-1 text-soft">{preview.suppressed} مستبعد — طلبوا الإيقاف</span>
              )}
              {preview.samples?.length > 0 && (
                <span className="text-soft">مثل: {preview.samples.slice(0, 3).map((s) => s.name).join('، ')}</span>
              )}
            </div>
          )}
        </div>

        {/* ٢ · ماذا */}
        <div className={step}>
          <p className="text-[.75rem] font-semibold text-accent">٢ · ماذا تقول؟</p>
          {episodes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {episodes.slice(0, 6).map((episode) => (
                <button
                  key={episode.slug}
                  type="button"
                  onClick={() => setText(episodeMessage(episode))}
                  className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.76rem] text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  🎧 {episode.title.slice(0, 32)}
                </button>
              ))}
            </div>
          )}
          <textarea
            rows={5}
            value={text}
            onChange={(event) => { setText(event.target.value); setConfirmOnce(false) }}
            placeholder="اكتب رسالتك — أو اضغط حلقةً أعلاه فيُركَّب نصّها"
            className={`mt-2 ${field} resize-y`}
          />
          <p className="mt-2 text-[.72rem] leading-relaxed text-soft">
            اكتب <b className="text-ink">{'{الاسم}'}</b> فيصير اسم كل شخص، و<b className="text-ink">{'{تحية}'}</b> فتصير «صباح الخير» أو «مساء الخير» بحسب وقت الإرسال، و<b className="text-ink">{'{الأخ}'}</b> تصير «الأخ خالد» أو «الأخت مريم» أو «السادة في مركز أعيان للتدريب» بحسب المرسل إليه، و<b className="text-ink">{'{عزيزي}'}</b> تتصرف كذلك: «عزيزي/عزيزتي/الأعزاء في…».
            ومن لا نعرف اسمه تصله الجملة سليمةً بلا فراغ.
          </p>
          <p className="mt-1 text-left text-[.72rem] text-soft">{text.trim().length} حرفاً</p>
        </div>

        {/* ٣ · جرّب على نفسك */}
        <div className={step}>
          <p className="text-[.75rem] font-semibold text-accent">٣ · جرّبها على نفسك أولاً</p>
          <p className="mt-1 text-[.78rem] leading-relaxed text-soft">تصلك على واتساب كما ستصل الناس تماماً. لا تُرسل شيئاً لم تقرأه بعينك.</p>
          <button
            type="button"
            onClick={() => void previewToSelf()}
            disabled={!text.trim() || busy === 'self'}
            className="mt-3 rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          >
            {busy === 'self' ? 'أُرسل…' : 'أرسلها لي الآن'}
          </button>
        </div>

        {/* ٤ · أرسل */}
        <div className={step}>
          <p className="text-[.75rem] font-semibold text-accent">٤ · الإرسال الهادئ</p>
          <button
            type="button"
            onClick={() => void emergencyStop()}
            disabled={emergencyBusy}
            className="mt-2 rounded-full border border-red-500/45 px-4 py-2 text-[.76rem] font-semibold text-red-700 transition-colors hover:border-red-600 hover:bg-red-50 disabled:opacity-45 dark:text-red-300 dark:hover:bg-red-950/20"
          >
            {emergencyBusy ? 'يوقف الآن…' : 'إيقاف أي إرسال معلّق الآن'}
          </button>
          <p className="mt-2 max-w-2xl text-[.72rem] leading-relaxed text-soft">مهلة أمان بين كل رسالة والتي تليها؛ تقلل فشل الدفعة واحتمال تقييد الرقم، وتتيح للإيقاف الطارئ أن يعمل قبل الرسالة التالية. القيمة الموصى بها: ٤٥ ثانية.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="text-[.78rem] text-soft">
              مهلة الأمان:
              <select value={interval} onChange={(event) => setIntervalSeconds(Number(event.target.value))} className="ms-2 rounded-lg border border-hair bg-canvas px-2 py-1 text-[.78rem] text-ink">
                <option value={30}>٣٠ ثانية</option>
                <option value={45}>٤٥ ثانية</option>
                <option value={90}>دقيقة ونصف</option>
                <option value={180}>٣ دقائق</option>
              </select>
            </label>
            {willSend > 0 && (
              <span className="text-[.75rem] text-soft">
                المدة المتوقّعة: {Math.max(1, Math.round((willSend * interval) / 60))} دقيقة
              </span>
            )}
          </div>

          {blocked ? (
            <p className="mt-3 rounded-xl border border-hair bg-wash px-4 py-2.5 text-[.78rem] text-soft">{blocked}</p>
          ) : (
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy === 'send'}
              className={`mt-3 rounded-full px-5 py-2.5 text-[.82rem] font-semibold transition-opacity ${confirmOnce ? 'bg-accent text-white' : 'border border-accent text-accent'} hover:opacity-90 disabled:opacity-50`}
            >
              {busy === 'send' ? 'يبدأ الإرسال…' : confirmOnce ? `تأكيد: أرسل إلى ${willSend} جهة` : `إرسال هادئ إلى ${willSend} جهة`}
            </button>
          )}
        </div>

        <section className={`${step} overflow-hidden`} aria-labelledby="campaign-live-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.75rem] font-semibold text-accent">متابعة الحملات</p>
              <h3 id="campaign-live-title" className="mt-1 font-display text-xl font-semibold text-ink">دورة الحياة أمامك، من دون شاشة جديدة.</h3>
              <p className="mt-1 text-[.72rem] leading-relaxed text-soft">تُحدّث الأرقام تلقائياً كل بضع ثوانٍ، ولا يظهر هنا اسم أو رقم أي مستلم.</p>
            </div>
            <button type="button" className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-soft hover:border-accent hover:text-accent disabled:opacity-45" disabled={campaignsBusy} onClick={() => void refreshCampaigns(activeCampaignId, false)}>{campaignsBusy ? 'يحدّث…' : 'تحديث الآن'}</button>
          </div>

          {activeCampaign ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-2xl border border-hair bg-wash p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-[.84rem] font-semibold text-ink">{activeCampaign.name}</p><p className="mt-1 text-[.68rem] text-soft">{campaignStateLabel[activeCampaign.state] || activeCampaign.state} · بدأت {campaignDate(activeCampaign.startedAt)}</p></div>
                  <span className="rounded-full border border-accent/25 bg-accent/[.06] px-3 py-1 text-[.7rem] font-semibold text-accent">{activeCampaign.completed} من {activeCampaign.total}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-hair/55"><div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${activeCampaign.total ? Math.min(100, Math.round((activeCampaign.completed / activeCampaign.total) * 100)) : 0}%` }} /></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-hair bg-canvas px-3 py-2"><span className="block text-[.64rem] text-soft">الناجح</span><strong className="font-display text-xl text-ink">{activeCampaign.sent}</strong></div>
                  <div className="rounded-xl border border-hair bg-canvas px-3 py-2"><span className="block text-[.64rem] text-soft">الفاشل</span><strong className="font-display text-xl text-ink">{activeCampaign.failed}</strong></div>
                  <div className="rounded-xl border border-hair bg-canvas px-3 py-2"><span className="block text-[.64rem] text-soft">المتبقي</span><strong className="font-display text-xl text-ink">{activeCampaign.remaining}</strong></div>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.64rem] text-soft">الرسالة التالية</span><p className="mt-1 line-clamp-3 whitespace-pre-line text-[.75rem] leading-relaxed text-ink">{activeCampaign.messagePreview || '—'}</p><p className="mt-2 text-[.66rem] text-accent">موعدها: {activeCampaign.nextAt ? campaignDate(activeCampaign.nextAt) : activeCampaign.remaining ? 'بانتظار الجدولة' : 'لا توجد رسالة تالية'}</p></div>
                  <div className="flex flex-wrap content-start gap-2 lg:max-w-[240px]">
                    {['sending', 'retrying'].includes(activeCampaign.state) && <button type="button" disabled={Boolean(campaignActionBusy)} onClick={() => void campaignAction('pause')} className="rounded-full border border-hair px-3 py-2 text-[.72rem] font-semibold text-ink hover:border-accent hover:text-accent disabled:opacity-40">{campaignActionBusy === 'pause' ? 'يوقف…' : 'إيقاف مؤقت'}</button>}
                    {activeCampaign.state === 'paused' && <button type="button" disabled={Boolean(campaignActionBusy)} onClick={() => void campaignAction('resume')} className="rounded-full bg-accent px-3 py-2 text-[.72rem] font-semibold text-white disabled:opacity-40">{campaignActionBusy === 'resume' ? 'يستأنف…' : 'استئناف'}</button>}
                    {activeCampaign.failed > 0 && !['sending', 'retrying', 'paused'].includes(activeCampaign.state) && <button type="button" disabled={Boolean(campaignActionBusy)} onClick={() => void campaignAction('retry-failed')} className="rounded-full border border-accent px-3 py-2 text-[.72rem] font-semibold text-accent disabled:opacity-40">{campaignActionBusy === 'retry-failed' ? 'يعيد…' : 'إعادة الفاشل فقط'}</button>}
                  </div>
                </div>
                {activeCampaign.lastError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.7rem] leading-relaxed text-amber-900">آخر تعثر: {activeCampaign.lastError}</p>}
              </div>

              {Boolean(activeCampaign.failures?.length) && (
                <details className="rounded-2xl border border-hair bg-canvas p-3">
                  <summary className="cursor-pointer text-[.76rem] font-semibold text-ink">أسباب الفشل ({activeCampaign.failures?.length || 0}) — بلا أسماء أو أرقام</summary>
                  <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto">{activeCampaign.failures?.map((failure) => <div key={`${failure.index}-${failure.reason}`} className="grid gap-1 rounded-xl border border-hair px-3 py-2 sm:grid-cols-[auto_1fr]"><strong className="text-[.7rem] text-ink">{failure.recipient}</strong><span className="text-[.68rem] leading-relaxed text-soft">{failure.reason}</span></div>)}</div>
                </details>
              )}
            </div>
          ) : <p className="mt-4 rounded-xl border border-dashed border-hair p-4 text-[.76rem] text-soft">لا توجد حملة سابقة بعد. عند أول إرسال ستظهر المتابعة هنا تلقائياً.</p>}

          {campaigns.length > 0 && (
            <details className="mt-4 rounded-2xl border border-hair bg-canvas p-3">
              <summary className="cursor-pointer text-[.76rem] font-semibold text-ink">سجل الحملات السابقة · {campaigns.length}</summary>
              <div className="mt-3 grid max-h-72 gap-2 overflow-y-auto">
                {campaigns.map((campaign) => (
                  <button key={campaign.id} type="button" onClick={() => { setActiveCampaignId(campaign.id); void loadCampaignDetail(campaign.id) }} className={`grid gap-2 rounded-xl border px-3 py-2.5 text-right transition-colors sm:grid-cols-[1fr_auto] ${campaign.id === activeCampaignId ? 'border-accent bg-accent/[.045]' : 'border-hair hover:border-accent/50'}`}>
                    <span className="min-w-0"><strong className="block truncate text-[.74rem] text-ink">{campaign.name}</strong><span className="mt-1 block text-[.64rem] text-soft">{campaignDate(campaign.createdAt, false)} · {campaignStateLabel[campaign.state] || campaign.state}</span></span>
                    <span className="text-[.68rem] font-semibold text-accent">{campaign.sent} ناجح · {campaign.failed} فاشل · {campaign.remaining} متبقٍ</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>

        {notice && <p role="status" className="rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}

        <p className="text-[.72rem] leading-relaxed text-soft">
          ليست أداة إزعاج: أرسل لمن يعرفك، ولمن بينك وبينه سياق. ومن طلب الإيقاف يُستبعد وحده ولا يعود.
        </p>
      </div>
    </details>
  )
}
