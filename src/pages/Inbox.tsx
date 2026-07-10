import { motion, useReducedMotion } from 'framer-motion'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { Newsletter } from '../components/extras'
import { useSeo } from '../components/seo'
import { faqs, inboxLinks, testimonials } from '../data'

export default function Inbox() {
  useSeo({ title: 'من بريدي الوارد', path: '/inbox', description: 'مختارات من رسائل وروابط وصلتني، وأسئلة يتكرّر ورودها.' })
  const reduce = useReducedMotion()

  return (
    <Page>
      <PageHead label="رؤى منتقاة" title="من بريدي الوارد." sub="مختارات من رسائل وروابط وصلتني — وأسئلة يتكرّر ورودها." />

      {/* شهادات */}
      <section className="border-b border-hair px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">ماذا قالوا</span>
          </FadeUp>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {testimonials.map((t, i) => (
              <motion.blockquote
                key={i}
                initial={reduce ? false : { opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
                className="relative rounded-2xl border border-hair bg-wash p-8 md:p-9"
              >
                <span className="absolute right-7 top-3 font-display text-[3.5rem] leading-none text-accent/20">”</span>
                <p className="relative font-display text-[1.16rem] font-light leading-[1.95] text-ink/90">{t.quote}</p>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* روابط منتقاة */}
      <section className="border-b border-hair px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">روابط تستحق وقتك</span>
          </FadeUp>
          <ul className="mt-8">
            {inboxLinks.map((l, i) => (
              <FadeUp key={l.url} delay={i * 0.06}>
                <li className={i === 0 ? '' : 'border-t border-hair'}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    data-hover
                    className="group flex items-center gap-6 py-7 transition-[padding] duration-400 hover:pe-3"
                  >
                    <span className="flex-1">
                      <span className="block font-display text-[1.2rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent md:text-[1.35rem]">
                        {l.title}
                      </span>
                      <span className="mt-1.5 block text-[.88rem] font-light text-soft">{l.note}</span>
                    </span>
                    <span className="shrink-0 text-[1.2rem] text-accent opacity-0 transition-all duration-400 group-hover:opacity-100">←</span>
                  </a>
                </li>
              </FadeUp>
            ))}
          </ul>
        </div>
      </section>

      {/* أسئلة تصلني */}
      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <span className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">أسئلة تصلني</span>
          </FadeUp>
          <div className="mt-9 grid gap-10 md:grid-cols-3">
            {faqs.map((f, i) => (
              <FadeUp key={f.q} delay={i * 0.07}>
                <div className="border-t-2 border-accent pt-5">
                  <h3 className="font-display text-[1.18rem] font-medium leading-[1.6] text-ink">{f.q}</h3>
                  <p className="mt-3.5 text-[.98rem] font-light leading-[1.9] text-ink/80">{f.a}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.12}>
            <div className="mt-16">
              <Newsletter />
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
