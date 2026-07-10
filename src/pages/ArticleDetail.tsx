import { Link, useParams } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { FadeUp, Page, Reveal } from '../components/ui'
import { allArticles, getArticleNeighbors, relatedArticles, type ArticleRecord } from '../lib/cms'
import { useExtras, type ExtraArticle } from '../lib/content'
import { Listen, Share } from '../components/extras'
import { QuoteCard } from '../components/QuoteCard'
import { JsonLd, useSeo } from '../components/seo'

/** تقدير زمن القراءة — ٢٠٠ كلمة/دقيقة للعربية */
const readTime = (t?: string) => {
  if (!t) return null
  const words = t.trim().split(/\s+/).length
  const m = Math.max(1, Math.round(words / 200))
  return `${m.toLocaleString('en-US')} دقائق قراءة`.replace('1 دقائق', 'دقيقة واحدة')
}

function ReaderPanel({ slug }: { slug: string }) {
  const [focus, setFocus] = useState(false)
  const [scale, setScale] = useState(1)
  const [saved, setSaved] = useState(0)

  useEffect(() => {
    try {
      setSaved(Number(localStorage.getItem(`reader:${slug}:progress`) || 0))
      setScale(Number(localStorage.getItem('reader:scale') || 1))
    } catch { /* noop */ }
  }, [slug])

  useEffect(() => {
    document.documentElement.classList.toggle('reader-focus', focus)
    return () => document.documentElement.classList.remove('reader-focus')
  }, [focus])

  useEffect(() => {
    document.documentElement.style.setProperty('--article-scale', String(scale))
    try { localStorage.setItem('reader:scale', String(scale)) } catch { /* noop */ }
  }, [scale])

  useEffect(() => {
    const save = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      if (max <= 0) return
      const pct = Math.min(Math.max(window.scrollY / max, 0), 1)
      try { localStorage.setItem(`reader:${slug}:progress`, String(pct)) } catch { /* noop */ }
    }
    window.addEventListener('scroll', save, { passive: true })
    return () => window.removeEventListener('scroll', save)
  }, [slug])

  const restore = () => {
    const doc = document.documentElement
    window.scrollTo({ top: saved * (doc.scrollHeight - window.innerHeight), behavior: 'smooth' })
  }

  return (
    <div className="mt-7 flex flex-wrap items-center gap-2 border-y border-hair py-3">
      {saved > 0.08 && saved < 0.92 && (
        <button onClick={restore} className="rounded-full border border-hair px-4 py-1.5 text-[.8rem] text-soft transition-colors hover:border-accent hover:text-accent">
          متابعة من {Math.round(saved * 100).toLocaleString('en-US')}٪
        </button>
      )}
      <button
        onClick={() => setFocus(!focus)}
        className={`rounded-full border px-4 py-1.5 text-[.8rem] transition-colors ${
          focus ? 'border-accent bg-accent text-canvas' : 'border-hair text-soft hover:border-accent hover:text-accent'
        }`}
      >
        وضع التركيز
      </button>
      <div className="ms-auto flex items-center gap-2 text-[.8rem] text-soft">
        <span>حجم النص</span>
        {[0.94, 1, 1.08].map((value) => (
          <button
            key={value}
            onClick={() => setScale(value)}
            aria-pressed={scale === value}
            className={`h-8 w-8 rounded-full border text-[.78rem] transition-colors ${
              scale === value ? 'border-accent bg-accent text-canvas' : 'border-hair hover:border-accent hover:text-accent'
            }`}
          >
            {value === 0.94 ? 'أ' : value === 1 ? 'أ+' : 'أ++'}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ArticleDetail() {
  const { slug } = useParams()
  // مقالات لوحة التحكم تُدمج مع الثابتة — فتُفتح من نفس الرابط
  const extra = useExtras<ExtraArticle>('site_articles')
  const articles = useMemo(() => [...extra, ...allArticles], [extra])
  const i = articles.findIndex((a) => a.slug === slug)
  const a = articles[i]

  const { scrollYProgress } = useScroll()
  const bar = useSpring(scrollYProgress, { stiffness: 200, damping: 40 })

  useSeo({
    title: a?.title ?? 'مقال',
    description: a?.excerpt,
    path: `/articles/${slug}`,
    type: 'article',
    image: slug ? `/og/articles/${slug}.svg` : undefined,
  })

  if (!a)
    return (
      <Page>
        <div className="px-6 pt-44 text-center text-soft">لم يُعثر على المقال.</div>
      </Page>
    )

  const staticNeighbors = getArticleNeighbors(a.slug)
  const prev = articles[i - 1] || staticNeighbors.prev
  const next = articles[i + 1] || staticNeighbors.next
  const rt = readTime(a.body)
  const related = 'words' in a ? relatedArticles(a as ArticleRecord, 3) : articles.filter((x) => x.cat === a.cat && x.slug !== a.slug).slice(0, 3)

  return (
    <Page>
      {/* شريط تقدّم القراءة */}
      <motion.div className="fixed right-0 top-0 z-[245] h-[3px] w-full origin-right bg-accent" style={{ scaleX: bar }} />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          datePublished: a.iso,
          author: { '@type': 'Person', name: 'أحمد حسين الفيلكاوي' },
          articleSection: a.cat,
          inLanguage: 'ar',
        }}
      />
      <QuoteCard />
      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[720px]">
          <FadeUp>
            <Link to="/articles" className="text-[.85rem] text-soft transition-colors hover:text-accent">
              ← كل المقالات
            </Link>
          </FadeUp>

          <FadeUp delay={0.05}>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-[.8rem]">
              <span className="font-semibold text-accent">{a.cat}</span>
              <span className="h-1 w-1 rounded-full bg-hair" />
              <time className="text-soft">{a.date}</time>
              {rt && (
                <>
                  <span className="h-1 w-1 rounded-full bg-hair" />
                  <span className="text-soft">{rt}</span>
                </>
              )}
            </div>

            <h1 className="mt-5 font-display text-[clamp(2rem,4.6vw,3.1rem)] font-bold leading-[1.3] text-ink">
              <Reveal>{a.title}</Reveal>
            </h1>
            <div className="mt-7 h-[2px] w-16 bg-accent" />
            {a.body && <Listen slug={a.slug} title={a.title} text={a.body} audio={(a as { audio?: { fahed?: boolean; noura?: boolean } }).audio} />}
            {a.body && <ReaderPanel slug={a.slug} />}
          </FadeUp>

          <FadeUp delay={0.12}>
            {a.body ? (
              <div className="article-body mt-11">
                {a.body.split('\n\n').map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
              </div>
            ) : (
              <>
                {a.excerpt && (
                  <p className="mt-11 border-r-2 border-accent ps-6 font-display text-[1.28rem] font-light leading-[1.95] text-ink/90">
                    {a.excerpt}
                  </p>
                )}
                <div className="mt-12 rounded-2xl border border-hair bg-wash p-8 text-center md:p-10">
                  <p className="font-display text-[1.4rem] font-semibold leading-[1.7] text-ink">
                    النص الكامل قيد الإضافة للأرشيف.
                  </p>
                  <p className="mx-auto mt-3 max-w-[420px] text-[.95rem] font-light leading-[1.9] text-soft">
                    أبقيت بيانات المقال ومصدره حتى لا ينقطع أثره، وسيُضاف النص الكامل ضمن دورة تنقية الأرشيف.
                  </p>
                  {a.source && (
                    <a
                      href={a.source}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
                    >
                      اقرأ في مصدره الأصلي ←
                    </a>
                  )}
                </div>
              </>
            )}
          </FadeUp>

          {a.body && a.source && (
            <FadeUp>
              <p className="mt-14 border-t border-hair pt-6 text-[.85rem] text-soft">
                نُشر أولاً في{' '}
                <a href={a.source} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
                  المصدر الأصلي
                </a>
              </p>
            </FadeUp>
          )}

          <Share title={a.title} path={`/articles/${a.slug}`} />

          {related.length > 0 && (
            <FadeUp>
              <section className="mt-16 border-t border-hair pt-9">
                <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">أكمل هذا المسار</span>
                <p className="mt-2 text-[.9rem] font-light text-soft">مقالاتٌ على الخيط الفكري نفسه.</p>
                <ul className="mt-6 grid gap-6 sm:grid-cols-3">
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link to={`/articles/${r.slug}`} className="group block">
                        <time className="text-[.76rem] text-soft">{r.date}</time>
                        <span className="mt-1.5 block font-display text-[1.05rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">
                          {r.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </FadeUp>
          )}

          <FadeUp>
            <nav className="mt-16 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
              {next ? (
                <Link to={`/articles/${next.slug}`} className="group">
                  <span className="text-[.78rem] text-soft">السابق</span>
                  <span className="mt-1 block font-display text-[1.05rem] font-medium leading-[1.5] text-ink transition-colors group-hover:text-accent">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {prev && (
                <Link to={`/articles/${prev.slug}`} className="group sm:text-left">
                  <span className="text-[.78rem] text-soft">التالي</span>
                  <span className="mt-1 block font-display text-[1.05rem] font-medium leading-[1.5] text-ink transition-colors group-hover:text-accent">
                    {prev.title}
                  </span>
                </Link>
              )}
            </nav>
          </FadeUp>
        </div>
      </article>
    </Page>
  )
}
