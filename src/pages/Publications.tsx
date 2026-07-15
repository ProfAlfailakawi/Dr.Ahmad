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
  const count = bookCount(books.length)
  useSeo({ title: 'الكتب المنشورة', path: '/publications', description: `${count} في التعليم والتكنولوجيا والتغيير المجتمعي.` })
  const reduce = useReducedMotion()
  return (
    <Page className="content-books">
      <PageHead label="المؤلفات" title={`${count}.`} sub="مؤلفاتي العلمية والفكرية في التعليم والتكنولوجيا والتغيير المجتمعي." />
      <section className="overflow-hidden px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:px-11 md:py-24">
        <div className="mx-auto grid w-full max-w-shell min-w-0 grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {books.map((b, i) => (
            <motion.div
              key={b.slug}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
              whileHover={reduce ? {} : { y: -8 }}
              className="group"
            >
              <Link to={`/publications/${b.slug}`} data-hover className="block">
                <div className="group overflow-hidden rounded-xl bg-white shadow-[0_22px_44px_-26px_rgba(21,22,26,.4)]" style={{ aspectRatio: '1024 / 700' }}>
                  {b.cover ? (
                    <img src={b.cover} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>
                  )}
                </div>
                <h2 className="mt-5 break-words font-display text-[1.3rem] font-medium leading-[1.4] text-ink">{b.title}</h2>
                {b.isbn && <span className="mt-1 block text-[.78rem] text-soft">ردمك {b.isbn}</span>}
                <span className="mt-2 block text-[.84rem] text-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100">المقدّمة والفهرس ←</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </Page>
  )
}
