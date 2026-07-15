import { useState } from 'react'
import { useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { EASE, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'

const bookCount = (count: number) => {
  if (count === 1) return 'كتاب واحد'
  if (count === 2) return 'كتابان'
  return `${count} كتب`
}

export default function Publications() {
  const { books } = useCmsContent()
  const [visibleCount, setVisibleCount] = useState(12)
  const count = bookCount(books.length)
  useSeo({ title: 'الكتب المنشورة', path: '/publications', description: `${count} في التعليم والتكنولوجيا والتغيير المجتمعي.` })
  const reduce = useReducedMotion()
  return (
    <Page className="content-books">
      <PageHead label="المؤلفات" title={`${count}.`} sub="مؤلفاتي العلمية والفكرية في التعليم والتكنولوجيا والتغيير المجتمعي." />
      <section className="overflow-hidden px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:px-11 md:py-24">
        <div className="mx-auto grid w-full max-w-shell min-w-0 grid-cols-2 gap-x-4 gap-y-8 sm:gap-8 lg:grid-cols-3 lg:gap-10">
          {books.slice(0, visibleCount).map((b, i) => (
            <motion.div
              key={b.slug}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
              whileHover={reduce ? {} : { y: -8 }}
              className="group min-w-0"
            >
              <Link to={`/publications/${b.slug}`} data-hover className="block">
                <div className="group overflow-hidden rounded-xl bg-white shadow-[0_22px_44px_-26px_rgba(21,22,26,.4)]" style={{ aspectRatio: '1024 / 700' }}>
                  {b.cover ? (
                    <img src={b.cover} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>
                  )}
                </div>
                <h2 className="mt-3 break-words font-display text-[1rem] font-medium leading-[1.45] text-ink sm:mt-5 sm:text-[1.2rem] md:text-[1.3rem]">{b.title}</h2>
                {b.isbn && <span className="mt-1 block text-[.78rem] text-soft">ردمك {b.isbn}</span>}
                <span className="mt-2 block text-[.72rem] text-accent opacity-100 transition-opacity duration-300 sm:text-[.84rem] md:opacity-0 md:group-hover:opacity-100">المقدّمة والفهرس ←</span>
              </Link>
            </motion.div>
          ))}
        </div>
        {visibleCount < books.length && <div className="mx-auto mt-10 max-w-shell text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 12)} className="rounded-full border border-hair px-6 py-3 text-[.84rem] font-semibold text-accent transition-colors hover:border-accent">عرض ١٢ كتاباً إضافياً</button></div>}
      </section>
    </Page>
  )
}
