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
import { useEffect, useMemo, useState } from 'react'

type List = { id: string; name: string; note?: string; kind?: string; count?: number }
type Preview = { samples: { name: string; body: string }[]; willSend: number; suppressed: number }
type Episode = { slug: string; title: string; url?: string }

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

export function BroadcastStudio({ request, episodes = [], onNotice }: Props) {
  const [lists, setLists] = useState<List[]>([])
  const [listId, setListId] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [interval, setIntervalSeconds] = useState(45)
  const [confirmOnce, setConfirmOnce] = useState(false)

  const say = (message: string) => { setNotice(message); onNotice?.(message) }

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
      const result = await request('/admin/send-self-preview', { method: 'POST', body: JSON.stringify({ message: text }) }) as { ok?: boolean; messageId?: string }
      if (!result?.ok || !result.messageId) throw new Error('لم يؤكد واتساب إرسال المعاينة')
      say('✓ أرسل واتساب المعاينة إلى حسابك المرتبط. اقرأها كما سيقرأها الناس.')
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
      say(`✓ بدأ الإرسال الهادئ إلى ${willSend} جهة، بفاصل ${interval} ثانية.`)
      setConfirmOnce(false)
      setText('')
    } catch (error) {
      say(`تعذّر الإرسال: ${error instanceof Error ? error.message : 'خطأ'}`)
      setConfirmOnce(false)
    } finally { setBusy('') }
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
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="text-[.78rem] text-soft">
              فاصل بين الرسائل:
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

        {notice && <p role="status" className="rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}

        <p className="text-[.72rem] leading-relaxed text-soft">
          ليست أداة إزعاج: أرسل لمن يعرفك، ولمن بينك وبينه سياق. ومن طلب الإيقاف يُستبعد وحده ولا يعود.
        </p>
      </div>
    </details>
  )
}
