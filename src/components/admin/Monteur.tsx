/**
 * المونتير الآلي — مقالةٌ أو تغريدة ← فيديو مشاهد يفهم موضوعها.
 *
 * المحرّك نفسه صفحة مستقلة في public/monteur (لغة الحركة والصوت خالصة، بلا React)،
 * وهذه الطبقة تربطه بلوحة التحكم: تمدّه بمقالات الموقع الحيّة، وتطلب للمقالة
 * الجديدة لوحةً قصصية من الذكاء بالعقد نفسه الذي قُرئت به مقالات الدكتور
 * الـ١٤٣، وتحفظ ما وُلِّد فلا يُطلب مرتين. إضافةٌ مستقلة لا تمسّ أي أداة قائمة.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { loadArticleBodies } from '../../lib/article-bodies'

type ArticleLike = { slug: string; title: string; cat?: string; body?: string }
type Plan = { theme: string; trio: string[]; quote: string; scenes: unknown[] }

const PLANS_KEY = 'monteur:plans:v1'
const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const softButton = 'rounded-full border border-hair px-4 py-2 text-[.82rem] font-semibold text-ink transition-colors hover:border-accent disabled:opacity-50'
const primaryButton = 'rounded-full bg-accent px-5 py-2.5 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'

function readSavedPlans(): Record<string, Plan> {
  try { return JSON.parse(localStorage.getItem(PLANS_KEY) || '{}') as Record<string, Plan> } catch { return {} }
}
function savePlan(slug: string, plan: Plan) {
  try { const all = readSavedPlans(); all[slug] = plan; localStorage.setItem(PLANS_KEY, JSON.stringify(all)) } catch { /* التخزين المحلي اختياري */ }
}

export function Monteur({ articles }: { articles: ArticleLike[] }) {
  const { user } = useAdminAuth()
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [curated, setCurated] = useState(0)

  useEffect(() => { void loadArticleBodies().then((map) => setBodies(map as Record<string, string>)).catch(() => undefined) }, [])

  const payload = useMemo(() => articles.map((a) => ({ s: a.slug, t: a.title, c: a.cat || '', b: a.body || bodies[a.slug] || '' })), [articles, bodies])

  const post = useCallback((msg: unknown) => { frame.current?.contentWindow?.postMessage(msg, '*') }, [])

  /* حين يجهز المحرّك: أعطه مقالات الموقع الحيّة وما حُفظ من لوحات مولَّدة */
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; plans?: number; ext?: string } | null
      if (!data || typeof data !== 'object') return
      if (data.type === 'monteur:ready') {
        setReady(true)
        setCurated(Number(data.plans) || 0)
        post({ type: 'monteur:articles', articles: payload })
        Object.entries(readSavedPlans()).forEach(([s, plan]) => post({ type: 'monteur:plan', slug: s, plan }))
      }
      if (data.type === 'monteur:exported') setMessage(`حُفظ الفيديو (${data.ext}). انشره الآن.`)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [payload, post])

  useEffect(() => { if (ready) post({ type: 'monteur:articles', articles: payload }) }, [ready, payload, post])

  const open = (next: string) => { setSlug(next); if (next) post({ type: 'monteur:open', slug: next }) }

  /* لوحة قصصية بالذكاء للمقالة الجديدة — بالعقد نفسه، ثم تُحفظ فلا تُطلب مرتين */
  const storyboard = async () => {
    const article = articles.find((a) => a.slug === slug)
    if (!article || !user) return
    const body = article.body || bodies[article.slug] || ''
    if (body.trim().length < 80) { setMessage('متن المقالة غير متاح بعد.'); return }
    setBusy(true); setMessage('يقرأ المقالة ويبني لوحتها…')
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/ai/monteur-storyboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: article.title, category: article.cat || '', body }),
      })
      const data = await response.json().catch(() => null) as { plan?: Plan; error?: string } | null
      if (!response.ok || !data?.plan) throw new Error(data?.error || `تعذّر الاتصال (${response.status})`)
      savePlan(article.slug, data.plan)
      post({ type: 'monteur:plan', slug: article.slug, plan: data.plan })
      setMessage(`جاهزة: ${data.plan.scenes.length} مشاهد مطابقة للمعنى — تُعرض الآن.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر بناء اللوحة')
    } finally { setBusy(false) }
  }

  return (
    <div className="admin-dashboard grid min-w-0 gap-4">
      <section className={`${card} flex flex-wrap items-end justify-between gap-4`}>
        <div className="min-w-0">
          <p className="text-[.76rem] font-semibold uppercase text-accent">المونتير الآلي</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">مقالة أو تغريدة ← فيديو مشاهد يفهم موضوعها.</h2>
          <p className="mt-2 max-w-2xl text-[.82rem] leading-relaxed text-soft">
            {curated ? `${curated} مقالة لها لوحة قصصية مقروءة سلفاً (★).` : 'يحمّل المحرّك…'} المقالات الجديدة تُبنى فوراً بالمعجم، وبزر «لوحة بالذكاء» تأخذ لوحةً بالعقد نفسه وتُحفظ.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <select className="max-w-[320px] rounded-xl border border-hair bg-canvas px-3 py-2 text-[.84rem] text-ink outline-none focus:border-accent" value={slug} onChange={(event) => open(event.target.value)} aria-label="اختر مقالة">
            <option value="">— اختر مقالة من الموقع —</option>
            {articles.map((a) => <option key={a.slug} value={a.slug}>{a.title}{a.cat ? ` · ${a.cat}` : ''}</option>)}
          </select>
          <button type="button" className={primaryButton} disabled={!slug || busy || !ready} onClick={() => void storyboard()}>{busy ? 'يبني…' : 'لوحة بالذكاء للمقالة'}</button>
          <button type="button" className={softButton} disabled={!ready} onClick={() => post({ type: 'monteur:play' })}>تشغيل</button>
        </div>
        {message && <p className="w-full text-[.8rem] font-semibold text-accent">{message}</p>}
      </section>
      <section className={`${card} overflow-hidden p-0 sm:p-0 md:p-0`}>
        <iframe
          ref={frame}
          title="المونتير الآلي"
          src="/monteur/index.html"
          className="block h-[min(92vh,1400px)] w-full border-0 bg-canvas"
          allow="autoplay; fullscreen; display-capture"
          allowFullScreen
        />
      </section>
    </div>
  )
}
