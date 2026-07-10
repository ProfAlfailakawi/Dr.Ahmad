import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EASE, FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { articlesWithBody as articles } from '../data'

const LINKS = [
  { to: '/articles', label: 'المقالات الفكرية', n: '72' },
  { to: '/publications', label: 'الكتب المنشورة', n: '9' },
  { to: '/research', label: 'المساهمات العلمية', n: '18' },
  { to: '/cv', label: 'السيرة الأكاديمية' },
]

export default function NotFound() {
  useSeo({ title: 'الصفحة غير موجودة', description: 'الصفحة المطلوبة غير موجودة.' })
  const nav = useNavigate()
  const [q, setQ] = useState('')

  const hits = q.trim().length > 1
    ? articles.filter((a) => (a.title + ' ' + (a.excerpt || '')).includes(q.trim())).slice(0, 4)
    : []

  return (
    <Page>
      <section className="px-6 pb-24 pt-36 md:px-11 md:pt-44">
        <div className="mx-auto max-w-[680px] text-center">
          <FadeUp>
            <motion.span
              className="block font-display text-[clamp(5rem,15vw,9rem)] font-bold leading-none text-accent/15"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              404
            </motion.span>

            <h1 className="mt-4 font-display text-[clamp(1.7rem,4.2vw,2.6rem)] font-semibold text-ink">
              <Reveal>لا شيء هنا.</Reveal>
            </h1>

            <p className="mx-auto mt-5 max-w-[460px] text-[1.02rem] font-light leading-[1.9] text-soft">
              الصفحة التي تبحث عنها غير موجودة — أو ربما تغيّر عنوانها بعد تجديد الموقع.
            </p>
          </FadeUp>

          {/* بحث */}
          <FadeUp delay={0.08}>
            <div className="relative mx-auto mt-10 max-w-[440px]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && hits[0] && nav(`/articles/${hits[0].slug}`)}
                placeholder="ابحث في المقالات…"
                aria-label="بحث"
                className="w-full rounded-full border border-hair bg-canvas py-3.5 pe-12 ps-5 text-center text-[.98rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
              />
              <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft">⌕</span>
            </div>

            {hits.length > 0 && (
              <ul className="mx-auto mt-4 max-w-[440px] overflow-hidden rounded-xl border border-hair bg-wash text-right">
                {hits.map((a, i) => (
                  <li key={a.slug} className={i ? 'border-t border-hair' : ''}>
                    <Link to={`/articles/${a.slug}`} className="block px-5 py-3.5 text-[.95rem] text-ink transition-colors hover:bg-canvas hover:text-accent">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </FadeUp>

          {/* وجهات */}
          <FadeUp delay={0.14}>
            <ul className="mx-auto mt-12 max-w-[440px] border-t border-hair text-right">
              {LINKS.map((l) => (
                <li key={l.to} className="border-b border-hair">
                  <Link to={l.to} className="group flex items-center justify-between py-4 transition-[padding] duration-300 hover:pe-2">
                    <span className="font-display text-[1.15rem] font-medium text-ink transition-colors group-hover:text-accent">{l.label}</span>
                    <span className="flex items-center gap-4">
                      {l.n && <span className="text-[.82rem] text-soft">{l.n}</span>}
                      <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">←</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </FadeUp>

          <FadeUp delay={0.2}>
            <Link to="/" className="mt-11 inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep">
              العودة إلى الرئيسية
            </Link>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
