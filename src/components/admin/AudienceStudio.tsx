/**
 * استوديو الجمهور — دفتر الأسماء وقوائم البث التي يبنيها الدكتور بنفسه.
 *
 * لماذا لا نسحب قوائم البث من واتساب؟ لأن واتساب يحفظها على هاتفك وحده ولا
 * يزامنها مع الأجهزة المرتبطة (فحصنا مكتبة baileys: لا توجد دالة لجلبها).
 * والذي يُزامَن فعلاً دفترُ جهات الاتصال بأسمائها — فمنه تبني قوائمك هنا.
 *
 * والنتيجة أقوى من بثّ واتساب لا أضعف: رسائل فردية تصل لمن لم يحفظ رقمك،
 * وتناديه باسمه، ولا يرى أحدٌ رقم أحد.
 */
import { useEffect, useMemo, useState } from 'react'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent'
const secondary = 'rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'

type Contact = { id: string; name: string; nickname: string; waName: string; tail: string; suppressed: boolean; lists: number }
type BroadcastList = { id: string; name: string; note: string; kind: string; count: number }
type Member = { id: string; name: string; vocative: string; nickname: string; tail: string; suppressed: boolean }
type Sample = { name: string; body: string }

type Request = <T,>(path: string, init?: RequestInit) => Promise<T>

export default function AudienceStudio({ request, onNotice, campaigns }: { request: Request; onNotice: (text: string) => void; campaigns?: React.ReactNode }) {
  const [lists, setLists] = useState<BroadcastList[]>([])
  const [activeId, setActiveId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [newList, setNewList] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [bulk, setBulk] = useState('')
  const [newcomers, setNewcomers] = useState<{ id: string; name: string; tail: string }[]>([])
  const [draft, setDraft] = useState('{تحية} {الاسم}،\n\nنشرتُ اليوم مقالاً جديداً، أرجو أن ينفعك:\n')
  const [samples, setSamples] = useState<Sample[]>([])
  const [reach, setReach] = useState<{ willSend: number; suppressed: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const active = useMemo(() => lists.find((item) => item.id === activeId) || null, [lists, activeId])

  const loadLists = async () => {
    try {
      const data = await request<{ lists: BroadcastList[] }>('/admin/audience/lists')
      setLists(data.lists || [])
      if (!activeId && data.lists?.length) setActiveId(data.lists[0].id)
    } catch { onNotice('تعذّر جلب القوائم — تأكد أن الجسر متصل.') }
  }

  const loadMembers = async (listId: string) => {
    if (!listId) return setMembers([])
    try {
      const data = await request<{ members: Member[] }>(`/admin/audience/members?list=${encodeURIComponent(listId)}`)
      setMembers(data.members || [])
    } catch { setMembers([]) }
  }

  const loadContacts = async (term: string) => {
    try {
      const data = await request<{ contacts: Contact[] }>(`/admin/audience/contacts?q=${encodeURIComponent(term)}`)
      setContacts(data.contacts || [])
    } catch { setContacts([]) }
  }

  useEffect(() => { void loadLists(); void loadContacts('') }, [])
  useEffect(() => { void loadMembers(activeId) }, [activeId])
  useEffect(() => {
    const timer = setTimeout(() => { void loadContacts(search) }, 220)
    return () => clearTimeout(timer)
  }, [search])

  /* المعاينة الحيّة: ماذا يصل أول ثلاثة بالضبط، وكم شخصاً سيصله؟ */
  useEffect(() => {
    if (!activeId || !draft.trim()) { setSamples([]); setReach(null); return }
    const timer = setTimeout(async () => {
      try {
        const data = await request<{ samples: Sample[]; willSend: number; suppressed: number }>('/admin/audience/preview', {
          method: 'POST',
          body: JSON.stringify({ listId: activeId, text: draft }),
        })
        setSamples(data.samples || [])
        setReach({ willSend: data.willSend, suppressed: data.suppressed })
      } catch { setSamples([]) }
    }, 350)
    return () => clearTimeout(timer)
  }, [activeId, draft, members.length])

  const act = async (label: string, run: () => Promise<unknown>) => {
    setBusy(true)
    try { await run(); onNotice(label) } catch { onNotice('تعذّر تنفيذ الطلب.') } finally { setBusy(false) }
  }

  const createList = () => {
    if (!newList.trim()) return onNotice('اكتب اسم القائمة أولاً.')
    void act(`أُنشئت قائمة: ${newList}`, async () => {
      const created = await request<{ id: string }>('/admin/audience/lists', { method: 'POST', body: JSON.stringify({ name: newList }) })
      setNewList('')
      await loadLists()
      if (created?.id) setActiveId(created.id)
    })
  }

  const removeList = (list: BroadcastList) => {
    if (!window.confirm(`حذف قائمة «${list.name}»؟ الأشخاص يبقون في دفترك، والقائمة وحدها تُحذف.`)) return
    void act('حُذفت القائمة.', async () => {
      await request('/admin/audience/lists', { method: 'POST', body: JSON.stringify({ action: 'delete', id: list.id }) })
      setActiveId('')
      await loadLists()
    })
  }

  const addPicked = () => {
    if (!activeId) return onNotice('اختر قائمةً أولاً.')
    if (!picked.size) return onNotice('لم تختر أحداً.')
    void act(`أُضيف ${picked.size} إلى «${active?.name}».`, async () => {
      await request('/admin/audience/members', { method: 'POST', body: JSON.stringify({ listId: activeId, contactIds: [...picked] }) })
      setPicked(new Set())
      await loadMembers(activeId)
      await loadLists()
    })
  }

  const dropMember = (member: Member) => void act(`أُخرج ${member.name} من القائمة.`, async () => {
    await request('/admin/audience/members', { method: 'POST', body: JSON.stringify({ action: 'remove', listId: activeId, contactId: member.id }) })
    await loadMembers(activeId)
    await loadLists()
  })

  const rename = (id: string, current: string) => {
    const next = window.prompt('بمَ تناديه؟ (اللقب يظهر في الرسالة بدل اسم واتساب)', current)
    if (next === null) return
    void act('حُفظ اللقب.', async () => {
      await request('/admin/audience/nickname', { method: 'POST', body: JSON.stringify({ contactId: id, nickname: next }) })
      await Promise.all([loadContacts(search), loadMembers(activeId)])
    })
  }

  const addManual = () => {
    if (!manualPhone.trim()) return onNotice('اكتب الرقم أولاً.')
    void act('أُضيف إلى دفترك.', async () => {
      await request('/admin/audience/contacts', { method: 'POST', body: JSON.stringify({ phone: manualPhone, nickname: manualName }) })
      setManualPhone(''); setManualName('')
      await loadContacts(search)
    })
  }

  const inList = useMemo(() => new Set(members.map((m) => m.id)), [members])
  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  return (
    /* كرتٌ مطويّ يخضع لشرط الدكتور: ما إن يُفتح حتى ينغلق كل ما سواه في
       اللوحة. كان <section> مفتوحاً دائماً فلا شيء فيه يُطوى. */
    <details className={card}>
      <summary className="flex cursor-pointer list-none flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-ink">قوائمك ودفتر أسمائك</h3>
          <p className="mt-1 max-w-2xl text-[.78rem] leading-relaxed text-soft">
            واتساب لا يسلّم قوائم البث لجهازٍ مرتبط — يحفظها في هاتفك وحده. لكنه يزامن أسماء جهات اتصالك،
            فتبني قوائمك هنا وترسل رسائل فرديةً مخصّصة: تصل لمن لم يحفظ رقمك، وتناديه باسمه، ولا يرى أحدٌ رقم أحد.
          </p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>
      <div className="mt-1 flex justify-end">
        <button type="button" className={secondary} disabled={busy} onClick={() => { void loadLists(); void loadContacts(search) }}>↻ حدّث</button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[16rem_1fr]">
        {/* ═══ القوائم ═══ */}
        <div className="grid content-start gap-2">
          <label className="block font-semibold text-ink">القوائم</label>
          <div className="flex gap-2">
            <input className={input} value={newList} placeholder="قائمة جديدة…" onChange={(e) => setNewList(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createList() }} />
            <button type="button" className={secondary} disabled={busy} onClick={createList}>+</button>
          </div>
          {lists.length === 0 && <p className="mt-1 text-[.75rem] text-soft">لا قوائم بعد. اكتب اسماً واضغط +</p>}
          {lists.map((list) => {
            const isActive = list.id === activeId
            return (
              <div key={list.id} className={`rounded-xl border px-4 py-3 transition-colors ${isActive ? 'border-accent bg-canvas' : 'border-hair bg-canvas/60'}`}>
                <button type="button" className="w-full text-right" onClick={() => setActiveId(list.id)}>
                  <span className="font-semibold text-ink">{list.name}</span>
                  <span className="mt-1 block text-[.72rem] text-soft">{list.count} شخصاً</span>
                </button>
                {isActive && (
                  <button type="button" className="mt-2 text-[.72rem] text-soft hover:text-accent" onClick={() => removeList(list)}>حذف القائمة</button>
                )}
              </div>
            )
          })}
        </div>

        {/* ═══ الأعضاء والدفتر ═══ */}
        <div className="grid content-start gap-4">
          {active ? (
            <>
              <div className="grid gap-3 rounded-xl border border-hair bg-canvas p-4">
                {/* الاسم يُعزل في عنصره: اسمٌ لاتينيّ داخل جملة عربية يقلب
                    ترتيبها فتقرأ «في «.. خاص 0 — «..private .. شخصاً». */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink" dir="auto">{active.name}</span>
                  <span className="text-[.78rem] text-soft">— {members.length} شخصاً</span>
                </div>
                {members.length === 0 && <p className="text-[.78rem] text-soft">القائمة فارغة. اختر من دفترك بالأسفل.</p>}
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => (
                    <span key={member.id} className="flex items-center gap-2 rounded-full border border-hair bg-wash px-3 py-1.5 text-[.78rem] text-ink">
                      {member.suppressed && <span title="طلب إيقاف الرسائل — لن يصله شيء">🔕</span>}
                      <button type="button" className="hover:text-accent" title="اكتب لقباً" onClick={() => rename(member.id, member.nickname)}>{member.name}</button>
                      <button type="button" className="text-soft hover:text-accent" title="أخرجه" onClick={() => dropMember(member)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* ═══ الرسالة والمعاينة ═══ */}
              <div className="grid gap-3 rounded-xl border border-hair bg-canvas p-4">
                <label className="block font-semibold text-ink">الرسالة</label>
                <textarea className={`${input} min-h-[8rem] leading-relaxed`} value={draft} onChange={(e) => setDraft(e.target.value)} />
                <p className="text-[.72rem] leading-relaxed text-soft">
                  اكتب <b className="text-ink">{'{الاسم}'}</b> فيصير اسم كل شخص، و<b className="text-ink">{'{تحية}'}</b> فتصير «صباح الخير» أو «مساء الخير» بحسب وقت الإرسال.
                  ومن لا نعرف اسمه تصله الجملة سليمةً بلا فراغ.
                </p>
                {reach && (
                  <p className="text-[.78rem] text-ink">
                    يصل إلى <b>{reach.willSend}</b> شخصاً
                    {reach.suppressed > 0 && <span className="text-soft"> · {reach.suppressed} طلبوا الإيقاف فلن يصلهم شيء</span>}
                  </p>
                )}
                {samples.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-[.75rem] font-semibold text-soft">هكذا تصلهم بالضبط:</span>
                    {samples.map((sample, index) => (
                      <div key={index} className="rounded-xl border border-hair bg-wash px-4 py-3">
                        <span className="text-[.7rem] text-soft">إلى {sample.name}</span>
                        <p className="mt-1 whitespace-pre-wrap text-[.82rem] leading-relaxed text-ink">{sample.body}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-[.75rem] leading-relaxed text-soft">
                    الإرسال يبقى بيدك: تصنع المسودة هنا، ثم تعتمدها وترسلها من «الحملات المحلية» بالأسفل.
                    لا تخرج رسالةٌ من رقمك بغير أمرك.
                  </p>
                  <button type="button" className={primary} disabled={busy || !draft.trim()}
                    onClick={() => void act('أُنشئت المسودة — اعتمدها من «الحملات المحلية».', async () => {
                      await request('/admin/audience/draft', { method: 'POST', body: JSON.stringify({ listId: activeId, name: `${active.name}`, message: draft }) })
                    })}>
                    اصنع مسوّدة لهذه القائمة
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-hair bg-canvas px-4 py-6 text-center text-[.82rem] text-soft">أنشئ قائمةً أو اخترها لتبدأ.</p>
          )}

          {/* ═══ دفتر الأسماء ═══ */}
          <div className="grid gap-3 rounded-xl border border-hair bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="block font-semibold text-ink">دفتر الأسماء — {contacts.length}</label>
              {picked.size > 0 && <button type="button" className={primary} disabled={busy} onClick={addPicked}>أضف {picked.size} إلى «{active?.name || '…'}»</button>}
            </div>
            <input className={input} value={search} placeholder="ابحث باسمٍ أو بآخر أربعة أرقام…" onChange={(e) => setSearch(e.target.value)} />
            {/* الجدد بعد آخر استيراد — يظلّون بارزين حتى تُدخلهم قائمة، فلا
                يضيع أحدٌ في دفترٍ من مئات الأسماء. */}
            {newcomers.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-accent/40 bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[.82rem] font-semibold text-ink">جديدٌ في هذا الاستيراد — {newcomers.length}</span>
                  <button type="button" className="text-[.75rem] text-soft hover:text-accent" onClick={() => setNewcomers([])}>أخفِ</button>
                </div>
                <p className="text-[.72rem] text-soft">هؤلاء لم يدخلوا أي قائمة بعد. اخترهم من الأسفل وأضفهم.</p>
                <div className="flex flex-wrap gap-2">
                  {newcomers.map((person) => (
                    <span key={person.id} className="rounded-full border border-accent/40 bg-wash px-3 py-1.5 text-[.78rem] text-ink">
                      {person.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {contacts.map((contact) => {
                const already = inList.has(contact.id)
                const isPicked = picked.has(contact.id)
                return (
                  <span key={contact.id}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[.78rem] transition-colors ${already ? 'border-hair bg-wash text-soft' : isPicked ? 'border-accent bg-accent text-white' : 'border-hair bg-wash text-ink'}`}>
                    <button type="button" disabled={already} onClick={() => toggle(contact.id)} title={already ? 'في القائمة أصلاً' : 'اختره'}>
                      {contact.name}{already && ' ✓'}
                      {/* في كم قائمةٍ هو؟ الصفر يعني أنه في دفترك ولم يُضَف بعد. */}
                      <span className={`mr-1.5 text-[.7rem] ${contact.lists ? (isPicked ? 'text-white/80' : 'text-accent') : 'text-soft/70'}`}>
                        {contact.lists || '٠'}
                      </span>
                    </button>
                    <button type="button" className={isPicked ? 'text-white/70' : 'text-soft hover:text-accent'} title="اكتب لقباً" onClick={() => rename(contact.id, contact.nickname)}>✎</button>
                  </span>
                )
              })}
              {contacts.length === 0 && (
                <p className="text-[.78rem] leading-relaxed text-soft">
                  الدفتر فارغ. يمتلئ وحده حين يتصل واتساب ويزامن أسماء جهات اتصالك — أو أضف رقماً يدوياً بالأسفل.
                </p>
              )}
            </div>
            <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className={input} value={manualPhone} placeholder="رقم (٩٩٠٠١١٢٢ أو بمفتاح الدولة)" inputMode="tel" onChange={(e) => setManualPhone(e.target.value)} />
              <input className={input} value={manualName} placeholder="بمَ تناديه؟ «أبا خالد»" onChange={(e) => setManualName(e.target.value)} />
              <button type="button" className={secondary} disabled={busy} onClick={addManual}>أضف للدفتر</button>
            </div>

            {/* الطريق المضمون: واتساب قد يتأخّر في تسليم دفتر الهاتف لجهازٍ
                مرتبط، فبدل الانتظار يلصق الدكتور أسماءه وأرقامه دفعةً واحدة. */}
            <details className="rounded-xl border border-hair bg-wash px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[.8rem] text-soft">
                <span>انقل دفتر أسمائك دفعةً واحدة</span>
                <span className="text-[.75rem] text-accent">لصق جماعي</span>
              </summary>
              <div className="mt-3 grid gap-2">
                {/* الطريق الأسهل: ملف vCard من «جهات الاتصال» في الماك يُسحب
                    هنا مباشرةً — فلا يحتاج الدكتور فتحه ولا نسخ محتواه. */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files?.[0]
                    if (file) void file.text().then((text) => setBulk(text))
                  }}
                  className="rounded-xl border border-dashed border-hair bg-canvas px-4 py-3 text-center text-[.78rem] text-soft"
                >
                  اسحب ملف جهات الاتصال (.vcf) إلى هنا — أو
                  <label className="mr-1 cursor-pointer font-semibold text-accent hover:underline">
                    اخترْه من الماك
                    <input
                      type="file"
                      accept=".vcf,.txt,.csv,text/vcard,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void file.text().then((text) => setBulk(text))
                      }}
                    />
                  </label>
                </div>
                <textarea
                  className={`${input} min-h-[7rem] leading-relaxed`}
                  dir="auto"
                  value={bulk}
                  placeholder={'أو ألصق هنا:\nأبو خالد, 99001122\nد. عبد الرزاق العلي - 99334455\nالأستاذة نورة  +965 9955 6677'}
                  onChange={(e) => setBulk(e.target.value)}
                />
                <p className="text-[.72rem] leading-relaxed text-soft">
                  <b className="text-ink">من الماك:</b> افتح تطبيق «جهات الاتصال» ← اضغط ⌘A لتحديد الجميع ←
                  من قائمة «ملف» اختر «تصدير» ثم «تصدير vCard…» ← احفظ الملف ← ثم اسحبه إلى الأعلى.
                  <br />
                  ويقبل اللصق بكل الصيغ أيضاً: فاصلة أو شرطة أو مسافة، بمفتاح الدولة أو بدونه،
                  وبالأرقام العربية أو الغربية. والسطر بلا رقم يُتخطّى ويُعلَم لك، ولن يُستبدل لقبٌ كتبتَه من قبل.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[.72rem] text-soft">{bulk.split('\n').filter((line) => line.trim()).length} سطراً</span>
                  <button type="button" className={primary} disabled={busy || !bulk.trim()}
                    onClick={() => void act('أُضيفوا إلى دفترك.', async () => {
                      const result = await request<{ added: number; known: number; newcomers: { id: string; name: string; tail: string }[]; skipped: { line: string; why: string }[] }>('/admin/audience/import', {
                        method: 'POST', body: JSON.stringify({ text: bulk }),
                      })
                      setBulk('')
                      setNewcomers(result.newcomers || [])
                      await loadContacts(search)
                      onNotice(`جديد ${result.added} · معروفٌ من قبل ${result.known}`
                        + (result.skipped?.length ? ` · تُخطّي ${result.skipped.length} بلا رقم` : ''))
                    })}>
                    أضفهم كلهم
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* الحملات كانت صندوقاً منفصلاً فبدت بلا معنى: تبني القائمة هنا وترسل
          هناك. أُدخلت ذيلاً للاستوديو فصارت الرحلة واحدة — اكتب، عاين، أرسل. */}
      {campaigns && <div className="mt-5 border-t border-hair pt-5">{campaigns}</div>}
    </details>
  )
}
