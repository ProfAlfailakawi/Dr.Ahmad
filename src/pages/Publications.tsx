import { useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { EASE, Page, PageHead } from '../components/ui'
import { books } from '../data'

export default function Publications() {
  useSeo({ title: 'الكتب المنشورة', path: '/publications', description: 'تسعة كتب في التعليم والتكنولوجيا والتغيير المجتمعي.' })
  const reduce = useReducedMotion()
  return (
    <Page>
      <PageHead label="المؤلفات" title="تسعة كتب." sub="مؤلفاتي العلمية والفكرية في التعليم والتكنولوجيا والتغيير المجتمعي." />
      <section className="px-6 py-20 md:px-11 md:py-24">
        <div className="mx-auto grid max-w-shell gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {books.map((b, i) => (
            <motion.div
              key={b.isbn}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
              whileHover={reduce ? {} : { y: -8 }}
              className="group"
            >
              <Link to={`/publications/${b.slug}`} data-hover className="block">
                <div className="group overflow-hidden rounded-xl bg-white shadow-[0_22px_44px_-26px_rgba(21,22,26,.4)]" style={{ aspectRatio: '1024 / 700' }}>
                  <img src={b.cover} alt={b.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <h2 className="mt-5 font-display text-[1.3rem] font-medium leading-[1.4] text-ink">{b.title}</h2>
                <span className="mt-1 block text-[.78rem] text-soft">ردمك {b.isbn}</span>
                <span className="mt-2 block text-[.84rem] text-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100">المقدّمة والفهرس ←</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </Page>
  )
}
