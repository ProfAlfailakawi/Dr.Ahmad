/** The imperative engine owns an empty host; React owns only the admin controls. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { useCmsContent } from '../../lib/content'
import { loadArticleBodies } from '../../lib/article-bodies'
import { watchMonteurProjects, saveMonteurProject, monteurSourceHash, type MonteurPlan, type MonteurProject } from '../../lib/monteur-library'
import { arabicCountPhrase, REEL_SCENE_FORMS } from '../../lib/arabic-count.ts'

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
    const script = document.createElement('script'); script.src = '/monteur/monteur.js'; script.async = true
    script.onload = () => resolve()
    script.onerror = () => { loading = null; script.remove(); reject(new Error('تعذّر تحميل محرّك المونتير')) }
    document.head.appendChild(script)
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
  projectRef.current = projects
  const markDirty = (value: boolean) => { if (value && !dirtyRef.current) baseRevision.current = projectRef.current[api.current?.project().slug || '']?.revision || 0; if (!value) baseRevision.current = undefined; dirtyRef.current = value; setDirty(value) }

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

  const saveDraft = async (next = api.current?.project()) => {
    if (!next || !user) return
    const key = next.slug || `free-${crypto.randomUUID()}`
    await saveMonteurProject(key, { plan: next.plan, title: next.title, body: next.body, category: current?.cat || '', source: 'ai', sourceHash: await monteurSourceHash(next.body) }, baseRevision.current ?? projects[key]?.revision ?? 0)
    markDirty(false)
    if (!next.slug) showDraft({ ...next, slug: key })
    setMessage('حُفظت في مكتبتك السحابية.')
  }

  const storyboard = async (fromTopic = false) => {
    if (!user) return
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
      const next: Draft = { slug: topicMode ? `free-${crypto.randomUUID()}` : slug || `free-${crypto.randomUUID()}`, title: titleText, body: data.body || text, plan: data.plan }
      showDraft(next); markDirty(true)
      await saveDraft(next)
      setMessage(`${arabicCountPhrase(data.plan.scenes.length, REEL_SCENE_FORMS)} · محفوظة${topicMode ? ' · مسودة بالذكاء للمراجعة' : ''}`)
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
        <button className={primary} disabled={!ready || busy || !user} type="submit">{busy ? 'يبتكر…' : '✦ ابتكر من الفكرة'}</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ghost} disabled={!ready || busy} onClick={() => { markDirty(false); api.current?.setText(`${title}\n\n${body}`.trim()); setMessage('معاينة من النص؛ يمكنك حفظها في المكتبة.') }}>من النص أعلاه</button>
        <select className={select} value={slug} onChange={(event) => { markDirty(false); setSlug(event.target.value); if (event.target.value) api.current?.open(event.target.value) }} aria-label="أو اختر مقالة من الموقع" disabled={!ready || busy}>
          <option value="">— مكتبتك —</option>
          {articles.map((a) => <option key={a.slug} value={a.slug}>{projects[a.slug]?.source === 'ai' ? '★ ' : ''}{a.title}</option>)}
          {Object.entries(projects).filter(([s]) => !articles.some((a) => a.slug === s)).map(([s, p]) => <option key={s} value={s}>★ {p.title || 'مشروع محفوظ'}</option>)}
        </select>
        <button type="button" className={ghost} disabled={!ready || busy || !user} onClick={() => void storyboard()}>لوحة بالذكاء</button>
        <button type="button" className={ghost} disabled={!ready || busy || !user} onClick={async () => { setBusy(true); try { await saveDraft() } catch (e) { setMessage(e instanceof Error ? e.message : 'تعذّر الحفظ') } finally { setBusy(false) } }}>{dirty ? 'حفظ التعديلات' : 'حفظ في المكتبة'}</button>
        <button type="button" className={ghost} disabled={!ready} onClick={() => api.current?.play()}>▶ تشغيل</button>
      </div>
      {(message || stale || draft?.plan.generated) && <p className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.72rem] leading-relaxed text-ink" role="status">{stale ? 'تغيّر متن المقالة منذ حفظ اللوحة؛ راجع المطابقة. ' : ''}{message}{draft?.plan.generated ? ' · نص مقترح بالذكاء، يحتاج مراجعتك.' : ''}</p>}
      {!!projects[slug]?.history?.length && <details className="text-xs text-soft"><summary className="cursor-pointer">النسخ السابقة</summary><div className="mt-2 flex flex-wrap gap-2">{projects[slug].history.map((revision, i) => <button key={revision.savedAt + i} type="button" className={ghost} disabled={busy} onClick={() => { const p = projects[slug]; showDraft({ slug, title: revision.title ?? p.title, body: revision.body ?? p.body, plan: revision.plan }); markDirty(true); setMessage('معاينة نسخة سابقة؛ اضغط حفظ لاعتمادها.') }}>{new Date(revision.savedAt).toLocaleString('ar-KW')}</button>)}</div></details>}
      {!ready && <p className="p-6 text-center text-[.74rem] text-soft">يحمّل محرّك المونتير…</p>}
      <div ref={host} className="min-h-[480px]" />
    </div>
  )
}
export default MonteurEmbed
