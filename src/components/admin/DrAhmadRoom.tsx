import { useEffect, useMemo, useState } from 'react'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import { getDb } from '../../lib/firebase'
import { loadArticleBodies } from '../../lib/article-bodies'
import { buildDrAhmadDecisionPackage, classifyDrAhmadCommand, type CurrentContextItem, type DecisionAction, type DrAhmadDecisionPackage } from '../../lib/dr-ahmad-room'
import { buildAudienceSignals, type InboxMessageInput } from '../../lib/inbox-intelligence'
import { buildRows, windowDays, type ViewDoc } from '../readerPulseLogic'
import type { AdminTab } from './admin-navigation'

type SavedSession = {
  id: string
  request?: string
  status?: string
  taskType?: string
  createdAt?: { seconds?: number }
}

const input = 'w-full rounded-2xl border border-white/15 bg-white/[.06] px-5 py-4 text-[1rem] leading-loose text-white outline-none transition placeholder:text-white/38 focus:border-white/45'
const actionClass = 'min-h-11 rounded-full border border-hair bg-canvas px-4 py-2 text-[.75rem] font-semibold text-ink transition hover:border-accent hover:text-accent disabled:opacity-45'

function shortDate(value?: { seconds?: number }) {
  if (!value?.seconds) return ''
  return new Date(value.seconds * 1000).toLocaleDateString('ar-KW', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sessionPayload(command: string, result: DrAhmadDecisionPackage, status: string, uid: string) {
  return {
    request: command,
    taskType: result.taskType,
    sourceRefs: result.archive.map(({ kind, id, title, url, year }) => ({ kind, id, title, url, year })),
    currentSourceRefs: result.current.sources.map(({ id, title, source, url, publishedAt }) => ({ id, title, source, url, publishedAt })),
    outputs: {
      executiveSummary: result.executiveSummary,
      material: result.material,
      strongestObjection: result.strongestObjection,
      confidence: result.confidence,
    },
    decisions: { nextActions: result.nextActions.map((item) => item.id), currentContextUsed: result.current.available },
    linked: {
      articleIds: result.archive.filter((item) => item.kind === 'مقال').map((item) => item.id),
      bookIds: result.archive.filter((item) => item.kind === 'كتاب').map((item) => item.id),
      paperIds: result.archive.filter((item) => item.kind === 'بحث').map((item) => item.id),
      mediaIds: result.archive.filter((item) => item.kind === 'إعلام').map((item) => item.id),
    },
    conversions: { article: false, social: false, video: false },
    status,
    userId: uid,
    updatedAtClient: new Date().toISOString(),
  }
}

export function DrAhmadRoom({
  articles,
  books,
  papers,
  media,
  onOpen,
}: {
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
  onOpen: (tab: AdminTab) => void
}) {
  const { user } = useAdminAuth()
  const [command, setCommand] = useState('')
  const [result, setResult] = useState<DrAhmadDecisionPackage | null>(null)
  const [richArticles, setRichArticles] = useState(articles)
  const [audienceSignals, setAudienceSignals] = useState<string[]>([])
  const [readerSignals, setReaderSignals] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [history, setHistory] = useState<SavedSession[]>([])

  useEffect(() => {
    let active = true
    setRichArticles(articles)
    void loadArticleBodies().then((bodies) => {
      if (active) setRichArticles(articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })))
    }).catch(() => undefined)
    return () => { active = false }
  }, [articles])

  const loadPrivateSignals = async () => {
    try {
      const db = await getDb()
      if (!db) return
      const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
      const [views, messages, sessions] = await Promise.all([
        getDocs(collection(db, 'views')).catch(() => null),
        getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(80))).catch(() => null),
        getDocs(query(collection(db, 'admin_command_sessions'), orderBy('createdAt', 'desc'), limit(8))).catch(() => null),
      ])
      const rows = buildRows((views?.docs || []).map((item) => ({ id: item.id, ...(item.data() as Omit<ViewDoc, 'id'>) })), windowDays())
      setReaderSignals(rows.filter((item) => item.recent > 0).slice(0, 5).map((item) => `${item.title || item.path}: ${item.recent} قراءة حديثة`))
      const inbox = (messages?.docs || []).map((item) => ({ id: item.id, ...(item.data() as Omit<InboxMessageInput, 'id'>) }))
      setAudienceSignals(buildAudienceSignals(inbox).map((item) => `${item.theme}: ${item.suggestion}`))
      setHistory((sessions?.docs || []).map((item) => ({ id: item.id, ...(item.data() as Omit<SavedSession, 'id'>) })))
    } catch { /* الإشارات تعزّز القرار ولا توقف غرفة د. أحمد */ }
  }

  useEffect(() => { void loadPrivateSignals() }, [])

  const saveSession = async (packageResult: DrAhmadDecisionPackage, status = 'ready', preferredId = '') => {
    if (!user) return ''
    const db = await getDb()
    if (!db) return ''
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
    const id = preferredId || `session-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    await setDoc(doc(db, 'admin_command_sessions', id), {
      ...sessionPayload(command, packageResult, status, user.uid),
      ...(preferredId ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    }, { merge: true })
    setSessionId(id)
    return id
  }

  const run = async () => {
    const clean = command.trim()
    if (clean.length < 4 || busy) return
    setBusy(true); setNotice('أقرأ الطلب وأجمع الأدلة…'); setResult(null)
    const classification = classifyDrAhmadCommand(clean)
    let current: CurrentContextItem[] = []
    let currentError = ''
    if (classification.needsCurrentContext && user) {
      try {
        const token = await user.getIdToken()
        const response = await fetch('/api/ai/current-context', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ idea: clean, selectedEventIds: [] }),
        })
        const payload = await response.json().catch(() => ({})) as { items?: CurrentContextItem[]; error?: string }
        if (!response.ok) throw new Error(payload.error || `current-context:${response.status}`)
        current = Array.isArray(payload.items) ? payload.items : []
      } catch (reason) {
        currentError = reason instanceof Error ? reason.message : 'غير متاح'
      }
    }
    const packageResult = buildDrAhmadDecisionPackage({
      command: clean,
      archive: { articles: richArticles, books, papers, media },
      current,
      currentError,
      audienceSignals,
      readerSignals,
    })
    setResult(packageResult)
    try {
      await saveSession(packageResult)
      setNotice(currentError ? 'اكتملت الحزمة من الأرشيف؛ السياق الراهن لم يوقف المهمة.' : 'اكتملت حزمة القرار والتنفيذ وحُفظت الجلسة.')
      await loadPrivateSignals()
    } catch {
      setNotice('اكتملت الحزمة؛ تعذّر حفظ الجلسة سحابياً في هذه اللحظة.')
    } finally {
      setBusy(false)
    }
  }

  const markConversion = async (kind: 'article' | 'social' | 'video', status = 'converted') => {
    if (!result || !sessionId || !user) return
    try {
      const db = await getDb(); if (!db) return
      const { doc, serverTimestamp, updateDoc } = await import('firebase/firestore')
      await updateDoc(doc(db, 'admin_command_sessions', sessionId), { [`conversions.${kind}`]: true, status, updatedAt: serverTimestamp() })
    } catch { /* الانتقال نفسه لا يتوقف بسبب سجل الذاكرة */ }
  }

  const handleAction = async (action: DecisionAction) => {
    if (!result) return
    const seed = { idea: command.trim(), title: result.material.find((item) => item.id === 'title')?.text || command.trim(), purpose: result.executiveSummary, audience: 'الجمهور العام', at: Date.now(), sourceSessionId: sessionId }
    if (action.id === 'copy') {
      const text = [result.executiveSummary, ...result.material.map((item) => `${item.label}\n${item.text}`)].join('\n\n')
      await navigator.clipboard.writeText(text)
      setNotice('نُسخت الحزمة الأساسية.')
      return
    }
    if (action.id === 'save') {
      await saveSession(result, 'ready', sessionId)
      setNotice('حُفظت الجلسة وتحديثاتها.')
      return
    }
    if (action.id === 'waiting_room') {
      await saveSession(result, 'waiting_room', sessionId)
      setNotice('حُفظت الجلسة في غرفة الانتظار من دون نشر أو تحويل.')
      return
    }
    if (action.id === 'flow_video') {
      try { sessionStorage.setItem('admin:live-director-seed', JSON.stringify({ type: 'public_topic_video', topic: seed.idea, message: seed.purpose, audience: seed.audience, sourceSessionId: sessionId })) } catch { /* noop */ }
      await markConversion('video')
      onOpen('studio')
      return
    }
    if (action.id === 'social_pack') {
      try { localStorage.setItem('studio-standalone-seed', JSON.stringify(seed)) } catch { /* noop */ }
      await markConversion('social')
      onOpen('social-posts')
      window.dispatchEvent(new CustomEvent('studio:standalone-seed', { detail: seed }))
      return
    }
    try { sessionStorage.setItem('admin:publishing-room-seed', JSON.stringify({ ...seed, openBoard: action.id === 'open_board' })) } catch { /* noop */ }
    if (action.id === 'start_article') await markConversion('article')
    onOpen('studio')
  }

  const examples = useMemo(() => [
    'لدي لقاء تلفزيوني عن الذكاء الاصطناعي في التعليم.',
    'حضّر لي محاضرة عن مستقبل المعلم.',
    'هل هذه الفكرة تستحق مقالاً؟',
    'ماذا يسأل جمهوري ولا أملك عنه مادة كافية؟',
  ], [])

  return (
    <section className="overflow-hidden rounded-3xl border border-ink/10 bg-ink text-white" data-dr-ahmad-room="true">
      <div className="relative px-5 py-7 sm:px-7 md:px-10 md:py-10">
        <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-white/[.05] blur-3xl" />
        <div className="relative">
          <p className="text-[.72rem] font-semibold text-white/52">غرفة د. أحمد الذكية</p>
          <h2 className="mt-2 font-display text-[clamp(1.55rem,4vw,2.65rem)] font-bold leading-[1.45]">ماذا تريد أن تنجز اليوم يا د. أحمد؟</h2>
          <p className="mt-2 max-w-3xl text-[.8rem] leading-relaxed text-white/55">اكتب النتيجة التي تريدها. الغرفة تختار الأنظمة داخلياً وتعيد حزمة قرار وتنفيذ، لا محادثة عامة.</p>
          <textarea value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void run() }} className={`${input} mt-6 min-h-32`} placeholder="مثال: لدي لقاء تلفزيوني عن الذكاء الاصطناعي في التعليم…" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void run()} disabled={busy || command.trim().length < 4} className="min-h-11 rounded-full bg-white px-6 py-2 text-[.82rem] font-bold text-ink transition hover:bg-white/90 disabled:opacity-45">{busy ? 'أبني الحزمة…' : 'أنجز الطلب'}</button>
            <details className="group">
              <summary className="cursor-pointer list-none rounded-full border border-white/15 px-4 py-2 text-[.72rem] text-white/58">أمثلة سريعة</summary>
              <div className="mt-2 grid max-w-3xl gap-1.5 rounded-2xl border border-white/10 bg-white/[.05] p-2 sm:grid-cols-2">{examples.map((example) => <button key={example} type="button" onClick={() => setCommand(example)} className="rounded-xl px-3 py-2 text-right text-[.7rem] leading-relaxed text-white/68 hover:bg-white/[.06] hover:text-white">{example}</button>)}</div>
            </details>
            {notice && <span className="text-[.7rem] text-white/55">{notice}</span>}
          </div>
        </div>
      </div>

      {result && (
        <div className="grid gap-4 border-t border-white/10 bg-canvas p-4 text-ink sm:p-6 md:p-8" data-decision-package="true">
          <section className="rounded-2xl border border-hair bg-wash p-5">
            <p className="text-[.68rem] font-semibold text-accent">الخلاصة التنفيذية</p>
            <p className="mt-2 max-w-5xl text-[.9rem] leading-[1.9] text-ink">{result.executiveSummary}</p>
          </section>

          <details className="rounded-2xl border border-hair bg-canvas p-5" open>
            <summary className="cursor-pointer list-none text-[.8rem] font-semibold text-ink">من أرشيف د. أحمد · {result.archive.length} مادة موثقة</summary>
            {result.archive.length ? <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{result.archive.map((source) => <a key={`${source.kind}:${source.id}`} href={source.url} target="_blank" rel="noreferrer" className="rounded-xl border border-hair bg-wash p-3 transition hover:border-accent"><span className="text-[.62rem] font-semibold text-accent">{source.kind}{source.year ? ` · ${source.year}` : ''}</span><strong className="mt-1 line-clamp-2 block text-[.78rem] leading-relaxed text-ink">{source.title}</strong><span className="mt-1 line-clamp-2 block text-[.68rem] leading-relaxed text-soft">{source.note}</span></a>)}</div> : <p className="mt-3 text-[.78rem] text-soft">لم توجد مادة أرشيفية كافية؛ لم تُخترع إحالة بديلة.</p>}
          </details>

          {result.current.needed && <section className="rounded-2xl border border-hair bg-wash p-5"><p className="text-[.68rem] font-semibold text-accent">ما تقوله اللحظة الحالية</p><p className="mt-2 text-[.78rem] leading-relaxed text-soft">{result.current.note}</p>{result.current.sources.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-2">{result.current.sources.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="rounded-xl border border-hair bg-canvas px-4 py-3"><strong className="block text-[.76rem] leading-relaxed text-ink">{source.title}</strong><span className="mt-1 block text-[.65rem] text-soft">مصدر خارجي: {source.source}</span></a>)}</div>}<p className="mt-3 border-t border-hair pt-3 text-[.72rem] leading-relaxed text-ink"><strong>استنتاج تحليلي:</strong> {result.current.inference}</p></section>}

          <section className="rounded-2xl border border-hair bg-canvas p-5"><p className="text-[.68rem] font-semibold text-accent">المادة الجاهزة</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{result.material.map((item) => <article key={item.id} className="rounded-xl border border-hair bg-wash p-4"><strong className="text-[.78rem] text-ink">{item.label}</strong><p className="mt-2 whitespace-pre-line text-[.78rem] leading-[1.9] text-soft">{item.text}</p><button type="button" onClick={() => void navigator.clipboard.writeText(item.text).then(() => setNotice(`نُسخت «${item.label}».`))} className="mt-3 text-[.68rem] font-semibold text-accent">نسخ</button></article>)}</div></section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="rounded-2xl border border-hair bg-wash p-5"><p className="text-[.68rem] font-semibold text-accent">أقوى اعتراض</p><strong className="mt-2 block text-[.82rem] text-ink">{result.strongestObjection.party}</strong><p className="mt-2 text-[.76rem] leading-relaxed text-soft">{result.strongestObjection.objection}</p><p className="mt-3 border-t border-hair pt-3 text-[.76rem] leading-relaxed text-ink"><strong>الرد المنصف:</strong> {result.strongestObjection.response}</p></section>
            <section className="rounded-2xl border border-hair bg-canvas p-5"><p className="text-[.68rem] font-semibold text-accent">مستوى الثقة</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries({ 'أدلة الأرشيف': result.confidence.archiveEvidence, 'حداثة المصادر': result.confidence.sourceFreshness, 'خطر التكرار': result.confidence.repetitionRisk, 'كفاية المادة': result.confidence.sufficiency }).map(([label, value]) => <div key={label} className="rounded-xl border border-hair bg-wash p-3"><strong className="text-[.7rem] text-ink">{label}</strong><p className="mt-1 text-[.68rem] leading-relaxed text-soft">{value}</p></div>)}</div></section>
          </div>

          <section className="rounded-2xl border border-hair bg-wash p-4"><p className="px-1 text-[.67rem] font-semibold text-accent">الخطوة التالية</p><div className="mt-3 flex flex-wrap gap-2">{result.nextActions.map((action) => <button key={action.id} type="button" onClick={() => void handleAction(action)} className={actionClass}>{action.label}</button>)}</div></section>
        </div>
      )}

      {history.length > 0 && <details className="border-t border-white/10 bg-ink px-5 py-4"><summary className="cursor-pointer list-none text-[.68rem] text-white/48">آخر الجلسات المحفوظة · {history.length}</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{history.map((item) => <div key={item.id} className="rounded-xl border border-white/10 px-3 py-2"><strong className="line-clamp-2 block text-[.68rem] text-white/72">{item.request || 'جلسة محفوظة'}</strong><span className="mt-1 block text-[.6rem] text-white/38">{shortDate(item.createdAt)} · {item.status || 'ready'}</span></div>)}</div></details>}
    </section>
  )
}
