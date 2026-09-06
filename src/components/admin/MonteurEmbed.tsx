/**
 * المونتير الآلي — مضمَّن داخل استوديو الريل السينمائي (لا تبويب مستقل ولا iframe).
 *
 * المحرّك نفسه ملف خارجي public/monteur/monteur.js (سياسة CSP تمنع السكربت
 * المضمّن)، يُحمَّل مرة واحدة ويُركَّب داخل عنصر. النص يأتي من حقلي الاستوديو
 * نفسيهما (عنوان + متن) فيصير التوليد كله من مكان واحد، وللمقالة الجديدة زر
 * «لوحة بالذكاء» بالعقد نفسه الذي قُرئت به مقالات الدكتور الـ143.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { useCmsContent } from '../../lib/content'
import { loadArticleBodies } from '../../lib/article-bodies'
import { watchMonteurProjects, saveMonteurProject, monteurSourceHash, type MonteurPlan, type MonteurProject } from '../../lib/monteur-library'
import { arabicCountPhrase, REEL_SCENE_FORMS } from '../../lib/arabic-count.ts'

type Plan = MonteurPlan
type MonteurApi = {
  setText: (text: string, cat?: string) => void
  setArticles: (list: { s: string; t: string; c: string; b: string }[]) => void
  addPlan: (slug: string, plan: Plan) => void
  open: (slug: string) => void
  play: () => void
  exportVideo: () => void
  unmount: () => void
}
declare global { interface Window { Monteur?: { mount: (el: HTMLElement, opts: { embedded?: boolean }) => MonteurApi } } }

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
    script.onload = () => resolve(); script.onerror = () => { loading = null; script.remove(); reject(new Error('تعذّر تحميل محرّك المونتير')) }
    document.head.appendChild(script)
  })
  return loading
}

export function MonteurEmbed({ title, body }: { title: string; body: string }) {
  const { user } = useAdminAuth()
  const cms = useCmsContent({ includeHidden: true })
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<MonteurApi | null>(null)
  const [ready, setReady] = useState(false)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [projects, setProjects] = useState<Record<string, MonteurProject>>({})

  useEffect(() => {
    if (!user) { setProjects({}); return }
    return watchMonteurProjects(setProjects, () => setMessage('تعذّر تحميل المكتبة السحابية؛ تحقق من الاتصال والصلاحيات.'))
  }, [user])

  useEffect(() => { void loadArticleBodies().then((map) => setBodies(map as Record<string, string>)).catch(() => undefined) }, [])

  const articles = useMemo(() => cms.articles.map((a) => ({ slug: a.slug, title: a.title, cat: a.cat || '', body: a.body || bodies[a.slug] || '' })), [cms.articles, bodies])

  /* تحميل المحرّك مرة واحدة وتركيبه هنا */
  useEffect(() => {
    let cancelled = false
    void loadEngine().then(() => {
      if (cancelled || !host.current || !window.Monteur || api.current) return
      api.current = window.Monteur.mount(host.current, { embedded: true })
      setReady(true)
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'تعذّر تحميل المحرّك'))
    return () => { cancelled = true; api.current?.unmount(); api.current = null }
  }, [])

  useEffect(() => {
    if (!ready) return
    const saved = Object.entries(projects).filter(([s]) => !articles.some((a) => a.slug === s)).map(([s, p]) => ({ s, t: p.title || 'مشروع محفوظ', c: p.category || '', b: p.body || '' }))
    api.current?.setArticles([...articles.map((a) => ({ s: a.slug, t: a.title, c: a.cat, b: a.body })), ...saved])
    Object.entries(projects).forEach(([s, p]) => api.current?.addPlan(s, p.plan))
  }, [ready, articles, projects])

  const generateFromText = useCallback(() => {
    const text = `${title.trim()}\n\n${body.trim()}`.trim()
    if (!text) { setMessage('اكتب تغريدة أو الصق مقالة في الحقل أعلاه أولاً.'); return }
    setSlug(''); api.current?.setText(text, ''); setMessage('')
  }, [title, body])

  const openArticle = (next: string) => { setSlug(next); if (next) api.current?.open(next) }

  const storyboard = async () => {
    const article = articles.find((a) => a.slug === slug)
    const text = article ? article.body : `${title.trim()}\n\n${body.trim()}`.trim()
    const titleText = article ? article.title : (title.trim() || body.trim().split(/[\n.!؟…]/)[0] || '')
    if (!user) return
    if (text.trim().length < 80) { setMessage('المتن قصير جداً للوحة بالذكاء — الصق المقالة كاملة.'); return }
    setBusy(true); setMessage('يقرأ النص ويبني لوحته…')
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/ai/monteur-storyboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: titleText, category: article?.cat || '', body: text }),
      })
      const data = await response.json().catch(() => null) as { plan?: Plan; error?: string } | null
      if (!response.ok || !data?.plan) throw new Error(data?.error || `تعذّر الاتصال (${response.status})`)
      const key = article ? article.slug : `free-${Date.now()}`
      await saveMonteurProject(key, { plan: data.plan, title: titleText, body: text, category: article?.cat || '', source: 'ai', sourceHash: await monteurSourceHash(text) })
      setSlug(key)
      api.current?.addPlan(key, data.plan)
      if (!article) { api.current?.setArticles([...articles.map((a) => ({ s: a.slug, t: a.title, c: a.cat, b: a.body })), { s: key, t: titleText || 'نص جديد', c: '', b: text }]); api.current?.open(key) }
      setMessage(`جاهزة: ${arabicCountPhrase(data.plan.scenes.length, REEL_SCENE_FORMS)} مطابقة للمعنى — تُعرض الآن.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر بناء اللوحة')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primary} disabled={!ready} onClick={generateFromText}>ولّد الفيديو من النص أعلاه</button>
        <select className={select} value={slug} onChange={(event) => openArticle(event.target.value)} aria-label="أو اختر مقالة من الموقع" disabled={!ready}>
          <option value="">— أو اختر مقالة من الموقع —</option>
          {articles.map((a) => <option key={a.slug} value={a.slug}>{projects[a.slug]?.source === 'ai' ? '★ ' : ''}{a.title}{a.cat ? ` · ${a.cat}` : ''}</option>)}
          {Object.entries(projects).filter(([s]) => !articles.some((a) => a.slug === s)).map(([s, p]) => <option key={s} value={s}>★ {p.title || 'مشروع محفوظ'}</option>)}
        </select>
        <button type="button" className={ghost} disabled={!ready || busy} onClick={() => void storyboard()}>{busy ? 'يبني…' : 'لوحة بالذكاء'}</button>
        <button type="button" className={ghost} disabled={!ready} onClick={() => api.current?.play()}>تشغيل</button>
      </div>
      {message && <p className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.72rem] leading-relaxed text-ink" role="status">{message}</p>}
      {/* الحاوية تبقى فارغةً من جهة React: المحرّك يملؤها بـinnerHTML، فلو وضعنا
          فيها عنصراً من React لمحاه المحرّك ثم فشل React في إزالته لاحقاً. */}
      {!ready && <p className="p-6 text-center text-[.74rem] text-soft">يحمّل محرّك المونتير…</p>}
      <div ref={host} className="min-h-[480px]" />
    </div>
  )
}

export default MonteurEmbed
