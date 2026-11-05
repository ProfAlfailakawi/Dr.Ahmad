/** The imperative engine owns an empty host; React owns only the admin controls. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { useCmsContent } from '../../lib/content'
import { loadArticleBodies } from '../../lib/article-bodies'
import { watchMonteurProjects, saveMonteurProject, discardMonteurAiDraft, monteurSourceHash, type MonteurPlan, type MonteurProject } from '../../lib/monteur-library'
import { createDraftStash, decideLeave, describeRevisionDiff, diffMonteurRevisions, effectiveStatus, type SaveIntent } from '../../lib/monteur-drafts'
import { arabicCountPhrase, REEL_SCENE_FORMS } from '../../lib/arabic-count.ts'
import { Sparkles } from 'lucide-react'

type Draft = { slug: string; title: string; body: string; plan: MonteurPlan }
type MonteurApi = {
  setText: (text: string, cat?: string) => void
  setArticles: (list: { s: string; t: string; c: string; b: string }[]) => void
  addPlan: (slug: string, plan: MonteurPlan) => void
  open: (slug: string) => void
  play: () => void
  project: () => Draft
  replaceScene: (index: number, scene: MonteurPlan['scenes'][number]) => boolean
  unmount: () => void
}
type MountOptions = { embedded?: boolean; onChange?: (draft: Draft) => void; onProject?: (draft: Draft) => void; onRegenerate?: (index: number) => void }
declare global { interface Window { Monteur?: { mount: (el: HTMLElement, opts: MountOptions) => MonteurApi } } }

const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'
const select = 'max-w-[300px] rounded-full border border-hair bg-canvas px-3 py-2 text-[.76rem] text-ink outline-none focus:border-accent'
let loading: Promise<void> | null = null
function loadEngine(): Promise<void> {
  if (window.Monteur) return Promise.resolve()
  if (loading) return loading
  loading = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[data-monteur]')) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/monteur/monteur.css'; link.dataset.monteur = '1'; document.head.appendChild(link)
    }
    /* حارس التصدير يُحمَّل قبل المحرّك: المحرّك يرفض التصدير إن غاب (لا تسجيل بلا فحص). */
    const load = (src: string) => new Promise<void>((done, fail) => {
      const script = document.createElement('script'); script.src = src; script.async = false
      script.onload = () => done()
      script.onerror = () => { script.remove(); fail(new Error('تعذّر تحميل محرّك المونتير')) }
      document.head.appendChild(script)
    })
    load('/monteur/export-guard.js').then(() => load('/monteur/monteur.js')).then(() => resolve(), (error) => { loading = null; reject(error) })
  })
  return loading
}

export function MonteurEmbed({ title, body }: { title: string; body: string }) {
  const { user } = useAdminAuth()
  const cms = useCmsContent({ includeHidden: true })
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<MonteurApi | null>(null)
  const regenerateRef = useRef<(index: number) => void>(() => {})
  const baseRevision = useRef<number | undefined>(undefined)
  const projectRef = useRef<Record<string, MonteurProject>>({})
  const sent = useRef<Record<string, string>>({})
  const dirtyRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [slug, setSlug] = useState('')
  const [topic, setTopic] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [projects, setProjects] = useState<Record<string, MonteurProject>>({})
  const [stale, setStale] = useState(false)
  /* تعديلات غير محفوظة أُودعت عند الانتقال عن مشروعها؛ تُستعاد عند العودة إليه ولا تُمحى. */
  const stashRef = useRef(createDraftStash<Draft>())
  const [stashCount, setStashCount] = useState(0)
  /* مراجعة قبل الاعتماد: نسخة سابقة أو مسودة ذكاء تُعرض في المحرّر دون أن تُحفظ، ومعها نسخة احتياطية مما كان. */
  const [review, setReview] = useState<{ kind: 'revision' | 'ai-draft'; label: string; backup: Draft | null; backupDirty: boolean; diff: string } | null>(null)
  projectRef.current = projects
  const markDirty = (value: boolean) => { if (value && !dirtyRef.current) baseRevision.current = projectRef.current[api.current?.project().slug || '']?.revision || 0; if (!value) baseRevision.current = undefined; dirtyRef.current = value; setDirty(value) }

  useEffect(() => {
    if (!dirty && !stashCount && !review) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, stashCount, review])

  useEffect(() => {
    if (!user) { setProjects({}); return }
    return watchMonteurProjects(setProjects, () => setMessage('تعذّر تحميل المكتبة السحابية؛ تحقق من الاتصال والصلاحيات.'))
  }, [user])
  useEffect(() => { void loadArticleBodies().then((map) => setBodies(map as Record<string, string>)).catch(() => undefined) }, [])
  const articles = useMemo(() => cms.articles.map((a) => ({ slug: a.slug, title: a.title, cat: a.cat || '', body: a.body || bodies[a.slug] || '' })), [cms.articles, bodies])
  const current = articles.find((a) => a.slug === slug)

  useEffect(() => {
    let active = true
    setStale(false)
    if (current?.body && projects[slug]?.sourceHash) {
      void monteurSourceHash(current.body).then((hash) => { if (active) setStale(hash !== projects[slug].sourceHash) })
    }
    return () => { active = false }
  }, [current?.body, projects, slug])

  useEffect(() => {
    let cancelled = false
    void loadEngine().then(() => {
      if (cancelled || !host.current || !window.Monteur || api.current) return
      api.current = window.Monteur.mount(host.current, {
        embedded: true,
        onChange: (next) => { setDraft(next); setSlug(next.slug); markDirty(true) },
        onProject: (next) => { setDraft(next); setSlug(next.slug) },
        onRegenerate: (index) => regenerateRef.current(index),
      })
      sent.current = {}; setReady(true)
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'تعذّر تحميل المحرّك'))
    return () => { cancelled = true; api.current?.unmount(); api.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    const saved = Object.entries(projects).filter(([s]) => !articles.some((a) => a.slug === s)).map(([s, p]) => ({ s, t: p.title || 'مشروع محفوظ', c: p.category || '', b: p.body || '' }))
    api.current?.setArticles([...articles.map((a) => ({ s: a.slug, t: a.title, c: a.cat, b: a.body })), ...saved])
    Object.entries(projects).forEach(([s, p]) => {
      const version = JSON.stringify(p.plan)
      if (sent.current[s] === version || (dirtyRef.current && api.current?.project().slug === s)) return
      sent.current[s] = version; api.current?.addPlan(s, p.plan)
    })
  }, [ready, articles, projects])

  const showDraft = (next: Draft) => {
    sent.current[next.slug] = JSON.stringify(next.plan)
    api.current?.setArticles([...articles.map((a) => ({ s: a.slug, t: a.title, c: a.cat, b: a.body })), ...Object.entries(projects).filter(([s]) => s !== next.slug && !articles.some((a) => a.slug === s)).map(([s, p]) => ({ s, t: p.title, c: p.category, b: p.body })), ...(!articles.some((a) => a.slug === next.slug) ? [{ s: next.slug, t: next.title, c: '', b: next.body }] : [])])
    api.current?.addPlan(next.slug, next.plan); api.current?.open(next.slug)
    setDraft(next); setSlug(next.slug)
  }

  const saveDraft = async (next = api.current?.project(), intent: SaveIntent = 'working-save') => {
    if (!next || !user) return
    const key = next.slug || `free-${crypto.randomUUID()}`
    await saveMonteurProject(key, { plan: next.plan, title: next.title, body: next.body, category: current?.cat || '', source: 'ai', sourceHash: await monteurSourceHash(next.body) }, baseRevision.current ?? projects[key]?.revision ?? 0, intent)
    stashRef.current.discard(key); setStashCount(stashRef.current.size)
    markDirty(false)
    if (!next.slug) showDraft({ ...next, slug: key })
    setMessage(intent === 'approve' ? 'اعتُمدت النسخة وحُفظت في مكتبتك السحابية؛ بقيت النسخة السابقة في «النسخ السابقة».' : 'حُفظت في مكتبتك السحابية.')
  }

  /* مغادرة المشروع الحالي دون فقد: التعديلات تُودَع، والنص الحر يُسأل عنه، والمراجعة المعلّقة تُلغى. */
  const leaveCurrent = (): boolean => {
    if (review) {
      if (review.backup && review.backupDirty) { stashRef.current.save(review.backup); setStashCount(stashRef.current.size) }
      setReview(null); markDirty(false)
      return true
    }
    const active = api.current?.project()
    const decision = decideLeave(dirtyRef.current, active?.slug || '')
    if (decision === 'confirm' && !window.confirm('لديك تعديلات غير محفوظة على نصٍّ حرّ لا يمكن استعادتها لاحقاً. تجاهلها والمتابعة؟')) return false
    if (decision === 'stash' && active) {
      stashRef.current.save(active); setStashCount(stashRef.current.size)
      setMessage(`أُودعت تعديلاتك غير المحفوظة على «${active.title || active.slug}»؛ ستُستعاد عند العودة إليه.`)
    }
    markDirty(false)
    return true
  }

  const openProject = (next: string) => {
    if (!leaveCurrent()) return
    setSlug(next)
    if (!next) return
    const saved = stashRef.current.take(next)
    setStashCount(stashRef.current.size)
    if (saved) {
      showDraft(saved); markDirty(true)
      setMessage('استُرجعت تعديلاتك غير المحفوظة على هذا المشروع. احفظها أو افتح الأصل المحفوظ بزر «تجاهل تعديلاتي».')
    } else api.current?.open(next)
  }

  const dropStashedEdits = () => {
    if (!slug) return
    markDirty(false); stashRef.current.discard(slug); setStashCount(stashRef.current.size)
    api.current?.open(slug); setMessage('تُجوهلت التعديلات غير المحفوظة وفُتحت النسخة المحفوظة.')
  }

  const startReview = (kind: 'revision' | 'ai-draft', label: string, candidate: Draft) => {
    const active = api.current?.project() || null
    const diff = active ? diffMonteurRevisions(active, candidate) : null
    if (diff?.identical) { setMessage('هذه النسخة مطابقة لما في المحرّر الآن؛ لا شيء لمراجعته.'); return }
    const backupDirty = dirtyRef.current
    showDraft(candidate); markDirty(true)
    setReview({ kind, label, backup: active, backupDirty, diff: diff ? describeRevisionDiff(diff) : '' })
    setMessage('')
  }

  const cancelReview = () => {
    if (!review) return
    const { backup, backupDirty } = review
    setReview(null)
    if (backup) { showDraft(backup); markDirty(backupDirty) } else markDirty(false)
    setMessage('أُلغيت المراجعة ورجع المحرّر إلى ما كان قبلها.')
  }

  const approveReview = async () => {
    if (!review || !user) return
    setBusy(true)
    try {
      /* نعتمد ما في المحرّر الآن (قد يكون المستخدم عدّل المرشّحة أثناء المراجعة). */
      await saveDraft(api.current?.project(), 'approve')
      setReview(null)
    } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر الاعتماد') } finally { setBusy(false) }
  }

  const approveDraftStatus = async () => {
    setBusy(true)
    try { await saveDraft(api.current?.project(), 'approve') } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر الاعتماد') } finally { setBusy(false) }
  }

  const discardAiDraft = async () => {
    if (!slug) return
    setBusy(true)
    try { await discardMonteurAiDraft(slug); setMessage('تُجوهلت مسودة الذكاء؛ نسختك المعتمدة كما هي.') } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر التجاهل') } finally { setBusy(false) }
  }

  const storyboard = async (fromTopic = false) => {
    if (!user || review) return
    const saved = projects[slug]
    const text = fromTopic ? topic.trim() || title.trim() || body.trim() : current?.body || saved?.body || `${title.trim()}\n\n${body.trim()}`.trim()
    const titleText = fromTopic ? text : current?.title || saved?.title || title.trim() || text.split(/[\n.!؟…]/)[0]
    if (text.length < 3) { setMessage('اكتب موضوعاً من تخصصك أولاً.'); return }
    const topicMode = fromTopic || text.length < 80
    setBusy(true); setMessage(topicMode ? 'يقرأ الفكرة في ضوء مقالاتك وكتبك ولقاءاتك…' : 'يبني حكاية من كلماتك…')
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/ai/monteur-storyboard', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: titleText, category: current?.cat || '', body: text, mode: topicMode ? 'topic' : 'article', topic: text }),
      })
      const data = await response.json().catch(() => null) as { plan?: MonteurPlan; body?: string; error?: string } | null
      if (!response.ok || !data?.plan) throw new Error(data?.error || `تعذّر الاتصال (${response.status})`)
      const previous = !topicMode ? api.current?.project() : null
      if (previous?.slug === slug) previous.plan.scenes.forEach((scene, index) => { if (scene.locked && data.plan && index < data.plan.scenes.length) data.plan.scenes[index] = scene })
      data.plan.visualRevision = (previous?.plan.visualRevision || 0) + 1
      data.plan.generated = true
      const next: Draft = { slug: topicMode ? `free-${crypto.randomUUID()}` : slug || `free-${crypto.randomUUID()}`, title: titleText, body: data.body || text, plan: data.plan }
      const existing = projects[next.slug]
      if (existing && effectiveStatus(existing) === 'approved') {
        /* لوحة معتمدة موجودة: ناتج النموذج يُحفظ مسودةً منفصلة ولا يُستبدل به شيء قبل أن تراجعه وتعتمده. */
        await saveMonteurProject(next.slug, { plan: next.plan, title: next.title, body: next.body, category: current?.cat || '', source: 'ai', sourceHash: await monteurSourceHash(next.body) }, undefined, 'ai-generated')
        setMessage('جاهزت مسودة بالذكاء — لوحتك المعتمدة كما هي لم تُمسّ. راجع المسودة ثم اعتمدها أو تجاهلها.')
        return
      }
      if (!leaveCurrent()) return
      showDraft(next); markDirty(true)
      await saveDraft(next, 'ai-generated')
      setMessage(`${arabicCountPhrase(data.plan.scenes.length, REEL_SCENE_FORMS)} · حُفظت كمسودة بالذكاء — لم تُعتمد بعد، راجعها ثم اضغط «اعتمد المسودة».`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذّر بناء اللوحة') }
    finally { setBusy(false) }
  }

  regenerateRef.current = async (index) => {
    const active = api.current?.project()
    if (!user || busy || !active || active.plan.scenes[index]?.locked) return
    const scene = active.plan.scenes[index]
    if (!scene) return
    setBusy(true); setMessage('يبتكر معالجة جديدة للمشهد المحدد…')
    try {
      const response = await fetch('/api/ai/monteur-storyboard', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ title: active.title, body: active.body, sceneSrc: scene.src }) })
      const data = await response.json() as { plan?: MonteurPlan; error?: string }
      if (!response.ok || !data.plan?.scenes[0]) throw new Error(data.error || 'تعذّر تجديد المشهد')
      // A delayed response must never modify a different project opened meanwhile.
      if (api.current?.project().slug !== active.slug || api.current?.project().plan.scenes[index]?.src !== scene.src) return
      api.current?.replaceScene(index, { ...data.plan.scenes[0], photo: scene.photo, focus: scene.focus, iconVariant: scene.iconVariant })
      setMessage('تجدّد المشهد؛ بقية اللقطات محفوظة في المعاينة.')
    } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر تجديد المشهد') }
    finally { setBusy(false) }
  }

  return (
    <div className="grid gap-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void storyboard(true) }}>
        <input className="min-w-0 flex-1 rounded-full border border-hair bg-canvas px-4 py-3 text-sm text-ink outline-none focus:border-accent" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="فكرة من تخصصك… مثل: المعلم في عصر الذكاء" aria-label="موضوع الفيديو" maxLength={1000} />
        <button className={primary} disabled={!ready || busy || !user || !!review} type="submit">{busy ? 'يبتكر…' : <><Sparkles aria-hidden size="1em" strokeWidth={1.6} className="inline-block align-[-0.125em] me-1" />ابتكر من الفكرة</>}</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ghost} disabled={!ready || busy || !!review} onClick={() => { if (!leaveCurrent()) return; setSlug(''); api.current?.setText(`${title}\n\n${body}`.trim()); setMessage('معاينة من النص؛ يمكنك حفظها في المكتبة.') }}>من النص أعلاه</button>
        <select className={select} value={slug} onChange={(event) => openProject(event.target.value)} aria-label="أو اختر مقالة من الموقع" disabled={!ready || busy}>
          <option value="">— مكتبتك —</option>
          {articles.map((a) => <option key={a.slug} value={a.slug}>{projects[a.slug] ? (effectiveStatus(projects[a.slug]) === 'draft' ? '☆ مسودة · ' : '★ ') : ''}{stashRef.current.has(a.slug) ? '✎ ' : ''}{a.title}</option>)}
          {Object.entries(projects).filter(([s]) => !articles.some((a) => a.slug === s)).map(([s, p]) => <option key={s} value={s}>{effectiveStatus(p) === 'draft' ? '☆ مسودة · ' : '★ '}{stashRef.current.has(s) ? '✎ ' : ''}{p.title || 'مشروع محفوظ'}</option>)}
        </select>
        <button type="button" className={ghost} disabled={!ready || busy || !user || !!review} onClick={() => void storyboard()}>لوحة بالذكاء</button>
        <button type="button" className={ghost} disabled={!ready || busy || !user || !!review} onClick={async () => { setBusy(true); try { await saveDraft() } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر الحفظ') } finally { setBusy(false) } }}>{dirty ? 'حفظ التعديلات' : 'حفظ في المكتبة'}</button>
        <button type="button" className={ghost} disabled={!ready} onClick={() => api.current?.play()}>▶ تشغيل</button>
      </div>
      {(message || stale || draft?.plan.generated) && <p className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.72rem] leading-relaxed text-ink" role="status">{stale ? 'تغيّر متن المقالة منذ حفظ اللوحة؛ راجع المطابقة. ' : ''}{message}{draft?.plan.generated ? ' · نص مقترح بالذكاء، يحتاج مراجعتك.' : ''}</p>}
      {!!stashCount && !review && <p className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.7rem] leading-relaxed text-soft" role="status">لديك تعديلات غير محفوظة في {stashCount} {stashCount === 1 ? 'مشروع' : 'مشاريع'} (علامة ✎ في القائمة) — تُستعاد حين تفتحها، وتُفقد إن أغلقت الصفحة قبل حفظها.</p>}
      {stashRef.current.has(slug) === false && dirty && !review && !!projects[slug] && <div className="flex flex-wrap items-center gap-2 text-[.7rem] text-soft"><span>تعديلاتك على هذه اللوحة غير محفوظة.</span><button type="button" className={ghost} disabled={busy} onClick={dropStashedEdits}>تجاهل تعديلاتي</button></div>}
      {projects[slug] && effectiveStatus(projects[slug]) === 'draft' && !review && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[.72rem] leading-relaxed text-amber-900" data-monteur-status="draft">
          <span><b>مسودة مولّدة بالذكاء — لم تُعتمد.</b> النص والاستعارات مقترحة وتحتاج مراجعتك قبل أن تُعدّ نسخة معتمدة.</span>
          <button type="button" className={primary} disabled={busy || !user} onClick={() => void approveDraftStatus()}>اعتمد المسودة</button>
        </div>
      )}
      {projects[slug]?.aiDraft && !review && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/[.05] px-3 py-2.5 text-[.72rem] leading-relaxed text-ink" data-monteur-ai-draft="pending">
          <span><b>مسودة ذكاء جديدة بانتظار مراجعتك</b> — لوحتك المعتمدة كما هي. {new Date(projects[slug].aiDraft!.createdAt).toLocaleString('ar-KW')}</span>
          <span className="flex gap-2"><button type="button" className={primary} disabled={busy} onClick={() => { const draftDoc = projects[slug].aiDraft!; startReview('ai-draft', 'مسودة الذكاء', { slug, title: draftDoc.title, body: draftDoc.body, plan: draftDoc.plan }) }}>راجع المسودة</button><button type="button" className={ghost} disabled={busy} onClick={() => void discardAiDraft()}>تجاهلها</button></span>
        </div>
      )}
      {review && (
        <div className="grid gap-2 rounded-xl border border-accent bg-accent/[.06] px-3 py-3 text-[.72rem] leading-relaxed text-ink" role="region" aria-label="مراجعة قبل الاعتماد" data-monteur-review={review.kind}>
          <b>مراجعة قبل الاعتماد — {review.label}</b>
          <span>{review.diff || 'قارن المعاينة بما كان عندك.'} المعروض الآن في المحرّر معاينة غير محفوظة؛ لن يتغيّر شيء في مكتبتك قبل أن تعتمد.</span>
          <span className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={busy || !user} onClick={() => void approveReview()}>اعتمد هذه النسخة</button><button type="button" className={ghost} disabled={busy} onClick={cancelReview}>ألغِ المراجعة وارجع لما كان</button></span>
        </div>
      )}
      {!!projects[slug]?.history?.length && !review && <details className="text-xs text-soft"><summary className="cursor-pointer">النسخ السابقة ({projects[slug].history.length}) — تُراجع قبل أن تُعتمد</summary><div className="mt-2 flex flex-wrap gap-2">{projects[slug].history.map((revision, i) => <button key={revision.savedAt + i} type="button" className={ghost} disabled={busy} onClick={() => { const p = projects[slug]; startReview('revision', `نسخة ${new Date(revision.savedAt).toLocaleString('ar-KW')}`, { slug, title: revision.title ?? p.title, body: revision.body ?? p.body, plan: revision.plan }) }}>{new Date(revision.savedAt).toLocaleString('ar-KW')}</button>)}</div></details>}
      {!ready && <p className="p-6 text-center text-[.74rem] text-soft">يحمّل محرّك المونتير…</p>}
      <div ref={host} className="min-h-[480px]" />
    </div>
  )
}
export default MonteurEmbed
