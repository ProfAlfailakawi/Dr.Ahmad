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
import { Pagination, usePagedList } from '../Pagination'
import { arabicCountPhrase, CARD_FORMS, LINE_FORMS, LIST_AFTER_PREPOSITION_FORMS } from '../../lib/arabic-count.ts'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent'
const secondary = 'rounded-full border border-hair px-4 py-2 text-[.8rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'

type Contact = { id: string; name: string; nickname: string; waName: string; tail: string; suppressed: boolean; lists: number }
type BroadcastList = { id: string; name: string; note: string; kind: string; count: number }
type Member = { id: string; name: string; vocative: string; nickname: string; tail: string; suppressed: boolean }
type Sample = { name: string; body: string }

type Request = <T,>(path: string, init?: RequestInit) => Promise<T>

/**
 * بطاقات الماك تحمل صورة كل جهة بترميز base64 — فملفٌ من ٢٨٠٠ جهة يصير
 * تسعة ميغابايت ومئةً وثلاثين ألف سطر، ولا تمرّ دفعةٌ منه عبر الجسر مهما
 * صغّرناها. نطرح الصور هنا قبل أن يغادر شيءٌ المتصفح: نريد الاسم والرقم
 * لا الصورة. (٨.٩ ميغابايت → نحو ربع ميغابايت.)
 */
function stripHeavyFields(text: string) {
  return text
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .replace(/^(PHOTO|LOGO|SOUND|KEY)[^:]*:.*$/gim, '')
    .replace(/\n{2,}/g, '\n')
}


export default function AudienceStudio({ request, onNotice, campaigns }: { request: Request; onNotice: (text: string) => void; campaigns?: React.ReactNode }) {
  const [lists, setLists] = useState<BroadcastList[]>([])
  const [activeId, setActiveId] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  /* الدفتر فيه آلاف الأسماء: نتصفّحه دفعةً بعد دفعة بدل حصره في أول خمسمئة */
  const [total, setTotal] = useState(0)
  /* صفحاتٌ تُقلَّب بالأرقام: الدكتور لا يريد بحثاً ولا «أظهر المزيد» —
     يريد أن يتنقّل بين صفحات دفتره كما يقلّب دفتراً ورقياً. */
  const PAGE_SIZE = 200
  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [newList, setNewList] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [bulk, setBulk] = useState('')
  const [newcomers, setNewcomers] = useState<{ id: string; name: string; tail: string }[]>([])
  /* المتسللون المعزولون (التقطتهم المزامنة القديمة بلا اسم): عدّهم يصل مع كل
     تحميل، وقائمتهم تُجلب كسولةً عند فتح قسمهم فقط. */
  const [autoHidden, setAutoHidden] = useState(0)
  const [autoRows, setAutoRows] = useState<Contact[]>([])
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [imported, setImported] = useState<{ added: number; known: number; skipped: number } | null>(null)
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

  const loadContacts = async (term: string, which = page) => {
    try {
      const data = await request<{ contacts: Contact[]; total: number; autoHidden?: number }>(
        `/admin/audience/contacts?q=${encodeURIComponent(term)}&limit=${PAGE_SIZE}&offset=${which * PAGE_SIZE}`,
      )
      setContacts(data.contacts || [])
      setTotal(Number(data.total || 0))
      setAutoHidden(Number(data.autoHidden || 0))
    } catch { setContacts([]); setTotal(0) }
  }

  useEffect(() => { void loadLists(); void loadContacts('') }, [])
  useEffect(() => { void loadMembers(activeId) }, [activeId])
  useEffect(() => { void loadContacts(search, page) }, [page])
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); void loadContacts(search, 0) }, 220)
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
    /* نُظهر الاسم الكامل في السؤال ليعرف الدكتور من يلقّب — عنده «أبو خالد»
       أكثر من واحد، والنافذة وحدها لا تكفي للتمييز. */
    const person = [...contacts, ...members].find((item) => item.id === id)
    const next = window.prompt(
      `بمَ تناديه في الرسالة؟\n${person ? `${person.name} · ••${person.tail}` : ''}`,
      current || '',
    )
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

  const listPages = usePagedList(lists, 8, String(lists.length))
  const memberPages = usePagedList(members, 30, `${activeId}|${members.length}`)
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
          {listPages.pageItems.map((list) => {
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
          <Pagination page={listPages.page} pageCount={listPages.pageCount} onChange={listPages.setPage} totalItems={lists.length} firstItem={listPages.firstItem} lastItem={listPages.lastItem} label="صفحات قوائم الجمهور" className="mt-2" />
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
                  {memberPages.pageItems.map((member) => (
                    <span key={member.id} className="flex items-center gap-2 rounded-full border border-hair bg-wash px-3 py-1.5 text-[.78rem] text-ink">
                      {member.suppressed && <span title="طلب إيقاف الرسائل — لن يصله شيء">🔕</span>}
                      <button type="button" className="hover:text-accent" title="اكتب لقباً" onClick={() => rename(member.id, member.nickname)}>
                        {member.name}<span className="mr-1.5 text-[.68rem] text-soft/70">••{member.tail}</span>
                      </button>
                      <button type="button" className="text-soft hover:text-accent" title="أخرجه" onClick={() => dropMember(member)}>×</button>
                    </span>
                  ))}
                </div>
                <Pagination page={memberPages.page} pageCount={memberPages.pageCount} onChange={memberPages.setPage} totalItems={members.length} firstItem={memberPages.firstItem} lastItem={memberPages.lastItem} label="صفحات أعضاء القائمة" className="mt-3" />
              </div>

              {/* حُذفت بطاقة «الرسالة والمعاينة» من هنا: كانت تكرّر ما تفعله
                  «غرفة البثّ» أعلاه — قالبُ التحية والمعاينة وصنعُ المسودة —
                  وتُحيل على «الحملات المحلية» التي أُزيلت. صار لكلٍّ عملُه:
                  هنا تُبنى القوائم ويُملأ الدفتر، وهناك يُكتب البثّ ويُرسَل. */}
              <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.78rem] leading-relaxed text-soft">
                هذه القائمة جاهزةٌ للبثّ. اكتب رسالتها وأرسلها من <b className="text-ink">غرفة البثّ</b> أعلى الصفحة.
              </p>
            </>
          ) : (
            <p className="rounded-xl border border-hair bg-canvas px-4 py-6 text-center text-[.82rem] text-soft">أنشئ قائمةً أو اخترها لتبدأ.</p>
          )}

          {/* ═══ دفتر الأسماء ═══ */}
          <div className="grid gap-3 rounded-xl border border-hair bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="block font-semibold text-ink">
                  دفتر الأسماء — {total}
                  {pageCount > 1 && <span className="mr-2 text-[.78rem] font-normal text-soft">صفحة {page + 1} من {pageCount}</span>}
                </label>
                {contacts.length > 0 && (
                  <button type="button" className="text-[.75rem] text-soft underline-offset-4 hover:text-accent hover:underline"
                    onClick={() => setPicked((prev) => {
                      const next = new Set(prev)
                      const addable = contacts.filter((item) => !inList.has(item.id))
                      const allPicked = addable.every((item) => next.has(item.id))
                      for (const item of addable) { if (allPicked) next.delete(item.id); else next.add(item.id) }
                      return next
                    })}>
                    {contacts.filter((item) => !inList.has(item.id)).every((item) => picked.has(item.id)) && picked.size
                      ? 'ألغِ تحديد هذه الصفحة' : 'حدّد هذه الصفحة كلها'}
                  </button>
                )}
              </div>
              {picked.size > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* الاختيار يبقى وأنت تقلّب الصفحات — فتجمع من عدة صفحات ثم تضيف مرة */}
                  <span className="text-[.75rem] text-soft">محدَّد: {picked.size}</span>
                  <button type="button" className={secondary} disabled={busy} onClick={() => setPicked(new Set())}>ألغِ الكل</button>
                  <button type="button" className={primary} disabled={busy} onClick={addPicked}>أضف {picked.size} إلى «{active?.name || '…'}»</button>
                </div>
              )}
            </div>
            <input className={input} value={search} placeholder="ابحث باسمٍ أو بآخر أربعة أرقام…" onChange={(e) => setSearch(e.target.value)} />
            {/* الجدد بعد آخر استيراد — يظلّون بارزين حتى تُدخلهم قائمة، فلا
                يضيع أحدٌ في دفترٍ من مئات الأسماء. */}
            {newcomers.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-accent/40 bg-canvas px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[.82rem] font-semibold text-ink">
                    جديدٌ في هذا الاستيراد — {imported?.added ?? newcomers.length}
                    {imported && imported.known > 0 && <span className="mr-2 font-normal text-soft">· معروفٌ من قبل {imported.known}</span>}
                  </span>
                  <button type="button" className="text-[.75rem] text-soft hover:text-accent" onClick={() => setNewcomers([])}>أخفِ</button>
                </div>
                <p className="text-[.72rem] text-soft">هؤلاء لم يدخلوا أي قائمة بعد. اخترهم من الأسفل وأضفهم.</p>
                <div className="flex flex-wrap gap-2">
                  {newcomers.map((person) => (
                    <span key={person.id} className="rounded-full border border-accent/40 bg-wash px-3 py-1.5 text-[.78rem] text-ink">
                      {person.name}
                    </span>
                  ))}
                  {/* لا نرسم آلاف البطاقات فيتجمّد المتصفح — عيّنةٌ ثم إحالة للبحث */}
                  {(imported?.added ?? 0) > newcomers.length && (
                    <span className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.78rem] text-soft">
                      و{(imported!.added - newcomers.length)} غيرهم — ابحث عنهم بالأسفل
                    </span>
                  )}
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
                      {/* مجهول الاسم كان يظهر «0007 0 ••0007» — رقمه مرتين وصفرٌ
                          شارد (لقطة ٣١ يوليو). الآن: تسميةٌ صريحة ورقمٌ واحد. */}
                      {contact.name.startsWith('••') ? <span className={isPicked ? 'text-white/85' : 'text-soft'}>بلا اسم</span> : contact.name}
                      {already && ' ✓'}
                      {/* آخر أربعة أرقام بجانب الاسم: الدكتور عنده «أبو خالد»
                          أكثر من واحد، والاسم وحده لا يميّزهم. */}
                      <span className={`mr-1.5 text-[.68rem] ${isPicked ? 'text-white/60' : 'text-soft/70'}`}>••{contact.tail}</span>
                      {/* عدد قوائمه يُذكر حين يكون في قوائم فعلاً؛ الصفر العاري
                          كان يُقرأ رقماً شارداً بجانب الأرقام. */}
                      {contact.lists > 0 && (
                        <span className={`mr-1.5 text-[.66rem] ${isPicked ? 'text-white/80' : 'text-accent'}`}>
                          في {arabicCountPhrase(contact.lists, LIST_AFTER_PREPOSITION_FORMS)}
                        </span>
                      )}
                    </button>
                    <button type="button" className={isPicked ? 'text-white/70' : 'text-soft hover:text-accent'} title="اكتب لقباً" onClick={() => rename(contact.id, contact.nickname)}>✎</button>
                  </span>
                )
              })}
              {pageCount > 1 && (
                <div className="flex w-full flex-wrap items-center justify-center gap-1.5 pt-1">
                  <button type="button" className={secondary} disabled={busy || page === 0}
                    onClick={() => setPage(page - 1)}>السابق</button>
                  {/* أرقام الصفحات: نعرض نافذةً حول الصفحة الحالية مع الأولى
                      والأخيرة دائماً — فثلاث عشرة صفحة لا تحتاج ثلاثة عشر زراً. */}
                  {Array.from({ length: pageCount }, (_, index) => index)
                    .filter((index) => index === 0 || index === pageCount - 1 || Math.abs(index - page) <= 2)
                    .reduce<(number | 'gap')[]>((list, index) => {
                      const last = list[list.length - 1]
                      if (typeof last === 'number' && index - last > 1) list.push('gap')
                      list.push(index)
                      return list
                    }, [])
                    .map((item, index) => item === 'gap'
                      ? <span key={`gap-${index}`} className="px-1 text-soft">…</span>
                      : (
                        <button key={item} type="button" disabled={busy}
                          onClick={() => setPage(item)}
                          className={`min-w-9 rounded-full border px-3 py-1.5 text-[.8rem] font-semibold transition-colors ${
                            item === page ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'
                          }`}>
                          {item + 1}
                        </button>
                      ))}
                  <button type="button" className={secondary} disabled={busy || page >= pageCount - 1}
                    onClick={() => setPage(page + 1)}>التالي</button>
                </div>
              )}
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
                    if (file) void file.text().then((text) => setBulk(stripHeavyFields(text)))
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
                        if (file) void file.text().then((text) => setBulk(stripHeavyFields(text)))
                      }}
                    />
                  </label>
                </div>
                <textarea
                  className={`${input} min-h-[7rem] leading-relaxed`}
                  dir="auto"
                  value={bulk}
                  placeholder={'أو ألصق هنا:\nأبو خالد, 99001122\nد. عبد الرزاق العلي - 99334455\nالأستاذة سارة  +965 9955 6677'}
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
                  <span className="text-[.72rem] text-soft">
                    {/BEGIN:VCARD/i.test(bulk)
                      ? arabicCountPhrase((bulk.match(/BEGIN:VCARD/gi) || []).length, CARD_FORMS)
                      : arabicCountPhrase(bulk.split('\n').filter((line) => line.trim()).length, LINE_FORMS)}
                  </span>
                  <button type="button" className={primary} disabled={busy || !bulk.trim()}
                    onClick={() => void act('انتهى الاستيراد.', async () => {
                      /* دفتر الدكتور فوق ٢٨٠٠ رقم ≈ نصف ميغابايت، والجسر يرفض
                         فوق ١٢٨ كيلوبايت صوناً لنفسه — فكان يسقط الطلب صامتاً
                         ولا يُضاف أحد. نرسلهم على دفعات بدل رفع الحدّ الأمني. */
                      const isCards = /BEGIN:VCARD/i.test(bulk)
                      const units = isCards
                        ? bulk.split(/(?=BEGIN:VCARD)/i).filter((part) => part.trim())
                        : bulk.split('\n').filter((line) => line.trim())
                      const CHUNK = isCards ? 200 : 600
                      let added = 0; let known = 0; let skipped = 0
                      const firstNames: { id: string; name: string; tail: string }[] = []
                      for (let index = 0; index < units.length; index += CHUNK) {
                        setProgress({ done: index, total: units.length })
                        const slice = units.slice(index, index + CHUNK).join(isCards ? '' : '\n')
                        const result = await request<{ added: number; known: number; newcomers: { id: string; name: string; tail: string }[]; skipped: unknown[] }>(
                          '/admin/audience/import', { method: 'POST', body: JSON.stringify({ text: slice }) },
                        )
                        added += result.added || 0
                        known += result.known || 0
                        skipped += result.skipped?.length || 0
                        for (const person of result.newcomers || []) if (firstNames.length < 60) firstNames.push(person)
                      }
                      setProgress(null)
                      setBulk('')
                      setNewcomers(firstNames)
                      setImported({ added, known, skipped })
                      await loadContacts(search)
                      onNotice(`جديد ${added} · معروفٌ من قبل ${known}` + (skipped ? ` · تُخطّي ${skipped} بلا رقم` : ''))
                    })}>
                    {progress ? `يستورد… ${progress.done} من ${progress.total}` : 'أضفهم كلهم'}
                  </button>
                </div>
              </div>
            </details>

            {/* المتسللون: أرقام التقطتها مزامنة واتساب القديمة بلا اسم ولم
                يضفها الدكتور بيده («ضاف من كيفه» — شكوى ٣١ يوليو). لا نحذف
                رقماً أبداً؛ نعزلهم هنا مطويين، ومن أضافه لقائمةٍ رقّى نفسه
                إلى الدفتر. المزامنة الجديدة أقفلت الباب أصلاً. */}
            {autoHidden > 0 && (
              <details className="rounded-xl border border-hair bg-wash px-4 py-3" onToggle={(event) => {
                if ((event.target as HTMLDetailsElement).open && !autoLoaded) {
                  setAutoLoaded(true)
                  void (async () => {
                    try {
                      const data = await request<{ contacts: Contact[] }>('/admin/audience/contacts?bucket=auto&limit=500&q=')
                      setAutoRows(data.contacts || [])
                    } catch { setAutoRows([]) }
                  })()
                }
              }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[.8rem] text-soft">
                  <span>أرقام التقطها واتساب تلقائياً بلا اسم — معزولة عن دفترك</span>
                  <span className="text-[.75rem] text-accent">{autoHidden}</span>
                </summary>
                <p className="mt-2 text-[.72rem] leading-relaxed text-soft">
                  لم يُحذف منها شيء. أهملها كما هي، أو اختر منها وأضفه لقائمةٍ فينضم للدفتر باسمٍ تكتبه له.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {autoRows.map((contact) => {
                    const isPicked = picked.has(contact.id)
                    return (
                      <button key={contact.id} type="button" onClick={() => toggle(contact.id)}
                        className={`rounded-full border px-3 py-1.5 text-[.74rem] transition-colors ${isPicked ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent'}`}>
                        ••{contact.tail}
                      </button>
                    )
                  })}
                  {autoLoaded && !autoRows.length && <span className="text-[.72rem] text-soft">اكتمل تحميلها… لا شيء هنا.</span>}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* الحملات كانت صندوقاً منفصلاً فبدت بلا معنى: تبني القائمة هنا وترسل
          هناك. أُدخلت ذيلاً للاستوديو فصارت الرحلة واحدة — اكتب، عاين، أرسل. */}
      {campaigns && <div className="mt-5 border-t border-hair pt-5">{campaigns}</div>}
    </details>
  )
}
