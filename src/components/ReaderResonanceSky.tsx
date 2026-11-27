import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord } from '../lib/cms'
import type { ResonantQuote } from '../lib/resonance-quotes'

export function ReaderResonanceSky({ articles }: { articles: ArticleRecord[] }) {
  const rootRef = useRef<HTMLElement>(null)
  const [quotes, setQuotes] = useState<ResonantQuote[]>([])
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    const root = rootRef.current
    if (!root || attempted) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      setAttempted(true)
      void (async () => {
        try {
          const [{ getDb }, firestore, resonance, { loadArticleBodies }] = await Promise.all([
            import('../lib/firebase'), import('firebase/firestore'), import('../lib/resonance-quotes'), import('../lib/article-bodies'),
          ])
          const db = await getDb()
          if (!db) return
          const [snapshot, bodies] = await Promise.all([
            firestore.getDocs(firestore.collection(db, 'article_highlights')),
            loadArticleBodies(),
          ])
          const rows = snapshot.docs.map((document) => document.data())
          setQuotes(resonance.resolveResonantQuotes(rows, articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })), { minCount: 3, limit: 18 }))
        } catch { /* لا نعرض تخميناً عند تعذّر الدليل. */ }
      })()
    }, { rootMargin: '240px 0px' })
    observer.observe(root)
    return () => observer.disconnect()
  }, [articles, attempted])

  return (
    <section ref={rootRef} className="mt-6 rounded-[1.75rem] border border-hair bg-canvas p-6 md:p-8" aria-labelledby="resonance-sky-title">
      <p className="text-[.7rem] font-semibold text-accent">ما صنعه القرّاء</p>
      <h2 id="resonance-sky-title" className="mt-1 font-display text-2xl font-semibold text-ink">سماء التظليل</h2>
      {quotes.length > 0 ? (
        <ol className="mt-7 grid gap-1.5">
          {quotes.map((quote) => (
            <li key={`${quote.slug}-${quote.text}`}>
              <Link to={`/articles/${quote.slug}`} className="resonance-line group block border-s border-accent/30 py-2 pe-2 text-ink transition-colors hover:border-accent hover:text-accent" style={{ borderInlineStartWidth: `${Math.min(6, 1 + quote.count * .42)}px`, fontWeight: Math.min(650, 320 + quote.count * 28) }}>
                <span className="text-[.78rem] leading-[1.85]">{quote.text}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : attempted ? (
        <p className="mt-5 text-[.76rem] font-light text-soft">لا جملة تجاوزت عتبة العرض المجمّعة في هذه الجلسة.</p>
      ) : (
        <span className="mt-6 block h-px w-full bg-hair" aria-hidden="true" />
      )}
    </section>
  )
}
