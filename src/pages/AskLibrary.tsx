/**
 * «اسأل مكتبتي» — /ask
 * الزائر يسأل، والمكتبة تُجيب بكلمات الدكتور أنفسِها: فقرات مقتبسة حرفياً من
 * مقالاته المنشورة حصراً، مع استشهادٍ يقود للمقال الكامل. لا اختلاق ولا توليد —
 * وما لم يكتب فيه بعد، تُصارِح به: «لم أكتب في هذا بعد».
 * تجسيدٌ حرفي لأطروحته: أُبقي الإنسانَ في قلبِ الآلة.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { articlesWithBody } from '../data'
import { useSeo } from '../components/seo'

/* تطبيع عربي للمطابقة: إسقاط التشكيل وتوحيد الهمزات */
const norm = (s: string) => s
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\w؀-ۿ ]/g, ' ')
  .toLowerCase()

const STOP = new Set(['على','الى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','بين','بعد','قبل','عند','حتي','كان','كانت','هل','ما','لا','لم','لن','قد','ثم','او','ام','بل','كل','بعض','غير','نحو','لدي','منذ','حين','حول','ان','لان','كيف','اين','ليس','وهو','وهي','راي','رايك','الدكتور','دكتور','احمد','الفيلكاوي','برايك','شنو','ماذا','لماذا'])
const tokenize = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))

type Hit = { slug: string; title: string; iso: string; para: string; score: number }

function answer(question: string): { hits: Hit[]; near: { slug: string; title: string; iso: string }[] } {
  const q = tokenize(question)
  if (!q.length) return { hits: [], near: [] }

  const scored = articlesWithBody.map((a) => {
    const nt = norm(a.title)
    const ne = norm(a.excerpt || '')
    const nb = a.body ? norm(a.body) : ''
    let score = 0
    for (const w of q) {
      if (nt.includes(w)) score += 4
      if (ne.includes(w)) score += 2
      if (nb) {
        let i = 0, c = 0
        while (c < 6 && (i = nb.indexOf(w, i)) !== -1) { c++; i += w.length }
        score += c
      }
    }
    return { a, score }
  }).sort((x, y) => y.score - x.score)

  const top = scored.filter((s) => s.score >= 6).slice(0, 2)
  const near = scored.slice(0, 3).filter((s) => s.score > 0).map((s) => ({ slug: s.a.slug, title: s.a.title, iso: s.a.iso }))
  if (!top.length) return { hits: [], near }

  // أفضل فقرة من كل مقال — بكلماته حرفياً
  const hits: Hit[] = []
  for (const { a } of top) {
    if (!a.body) continue
    const paras = a.body.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 60)
    let best = '', bestScore = -1
    for (const p of paras) {
      const np = norm(p)
      let s = 0
      for (const w of q) if (np.includes(w)) s += 1 + Math.min(2, (np.split(w).length - 1) - 1)
      // فقرة متوسطة الطول أوضح من الطويلة جداً
      if (p.length > 700) s -= 1
      if (s > bestScore) { bestScore = s; best = p }
    }
    if (bestScore <= 0) continue
    // اقتصاص أنيق عند نهاية جملة
    let text = best
    if (text.length > 460) {
      const cut = text.slice(0, 460)
      const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('؟'), cut.lastIndexOf('!'), cut.lastIndexOf('،'))
      text = (end > 200 ? cut.slice(0, end + 1) : cut) + (end > 200 ? '' : '…')
    }
    hits.push({ slug: a.slug, title: a.title, iso: a.iso, para: text, score: bestScore })
  }
  return { hits, near }
}

const SUGGESTIONS = [
  'ما رأيك في الهواتف بيد الأطفال؟',
  'هل الذكاء الاصطناعي يهدد المعلم؟',
  'كيف نحمي أبناءنا من إدمان السوشيال ميديا؟',
]

export default function AskLibrary() {
  useSeo({ title: 'اسأل مكتبتي', path: '/ask', description: 'اسأل، وتُجيبك مكتبة د. أحمد حسين الفيلكاوي بكلماته حرفياً — من مقالاته المنشورة حصراً، مع مصدر كل جواب.' })
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const resRef = useRef<HTMLDivElement>(null)

  const result = useMemo(() => (asked ? answer(asked) : null), [asked])

  const ask = (text: string) => {
    const t = text.trim()
    if (t.length < 4) return
    setQ(t); setAsked(t)
    setTimeout(() => resRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  return (
    <Page>
      <PageHead
        label="اسأل مكتبتي"
        title="اسألني عمّا كتبتُ فيه."
        sub="تُجيبك مكتبتي بكلماتي أنا — فقراتٌ حرفية من مقالاتي المنشورة، مع مصدر كل جواب. وما لم أكتب فيه بعد، تُصارِحك."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-3xl">
          {/* السؤال */}
          <FadeUp>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(q)}
                placeholder="اكتب سؤالك…"
                aria-label="سؤالك"
                className="flex-1 rounded-full border border-hair bg-canvas px-6 py-3.5 text-[1rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <button
                onClick={() => ask(q)}
                className="rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
              >
                اسأل
              </button>
            </div>
          </FadeUp>

          {/* أمثلة — تختفي بعد أول سؤال */}
          {!asked && (
            <FadeUp delay={0.08}>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-[.8rem] text-soft">جرّب:</span>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)} className="rounded-full border border-hair px-4 py-1.5 text-[.83rem] text-soft transition-colors hover:border-accent hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            </FadeUp>
          )}

          {/* الجواب */}
          <div ref={resRef} className="scroll-mt-28">
            {result && (
              <div className="mt-12">
                {result.hits.length > 0 ? (
                  <>
                    <p className="text-[.8rem] font-semibold text-accent">من مكتبتي — بكلماتي حرفياً</p>
                    <div className="mt-5 space-y-8">
                      {result.hits.map((h) => (
                        <FadeUp key={h.slug}>
                          <figure className="border-r-2 border-accent pr-5">
                            <blockquote className="font-display text-[1.08rem] font-light leading-[2] text-ink">«{h.para}»</blockquote>
                            <figcaption className="mt-3">
                              <Link to={`/articles/${h.slug}`} className="group inline-flex items-baseline gap-2 text-[.88rem] text-soft transition-colors hover:text-accent">
                                <span>من مقال: <span className="font-medium">{h.title}</span> — {h.iso.slice(0, 4)}</span>
                                <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1">←</span>
                              </Link>
                            </figcaption>
                          </figure>
                        </FadeUp>
                      ))}
                    </div>
                    <p className="mt-10 border-t border-hair pt-5 text-[.8rem] font-light leading-[1.9] text-soft">
                      ✦ كل جوابٍ هنا فقرةٌ حرفية مما كتبتُ — لا تُولِّده آلة ولا تُعيد صياغته. هكذا أُبقي الإنسانَ في قلبِ الآلة.
                    </p>
                  </>
                ) : (
                  <FadeUp>
                    <div className="rounded-2xl border border-hair bg-wash p-8 md:p-10">
                      <p className="font-display text-[clamp(1.2rem,2.6vw,1.6rem)] font-semibold leading-[1.7] text-ink">
                        لم أكتب في هذا بعد — ربما يكون سؤالَ مقالٍ قادم.
                      </p>
                      {result.near.length > 0 && (
                        <div className="mt-6 border-t border-hair pt-5">
                          <p className="text-[.82rem] text-soft">الأقرب إليه في مكتبتي:</p>
                          <ul className="mt-3 space-y-2">
                            {result.near.map((n) => (
                              <li key={n.slug}>
                                <Link to={`/articles/${n.slug}`} className="group text-[.95rem] text-ink transition-colors hover:text-accent">
                                  {n.title} <span className="text-[.8rem] text-soft">({n.iso.slice(0, 4)})</span>
                                  <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1"> ←</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </FadeUp>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </Page>
  )
}
