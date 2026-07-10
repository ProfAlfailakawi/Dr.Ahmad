import { motion, useReducedMotion } from 'framer-motion'
import { EASE, FadeUp, Magnetic, Page, PageHead } from '../components/ui'
import { Newsletter } from '../components/extras'
import { useSeo } from '../components/seo'
import { links, upcoming } from '../data'

export default function Upcoming() {
  useSeo({ title: 'اللقاءات القادمة', path: '/upcoming', description: 'محاضرات وورش عمل ومؤتمرات قادمة للدكتور أحمد حسين الفيلكاوي.' })
  const reduce = useReducedMotion()

  const today = new Date().toISOString().slice(0, 10)
  const future = upcoming.filter((e) => e.iso >= today).sort((a, b) => a.iso.localeCompare(b.iso))

  return (
    <Page>
      <PageHead
        label="محتواي المعرفي"
        title="اللقاءات القادمة."
        sub="محاضرات وورش ومؤتمرات — إن أردت دعوتي، فباب التواصل مفتوح."
      />

      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          {future.length > 0 ? (
            <ul>
              {future.map((e, i) => (
                <motion.li
                  key={e.iso + e.title}
                  initial={reduce ? false : { opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: Math.min(i * 0.06, 0.3), ease: EASE }}
                  className={i === 0 ? '' : 'border-t border-hair'}
                >
                  <div className="group flex flex-col gap-5 py-8 md:flex-row md:items-center">
                    {/* التاريخ */}
                    <div className="shrink-0 md:w-40">
                      <span className="block font-display text-[1.4rem] font-semibold text-accent">{e.date}</span>
                      {e.time && <span className="mt-0.5 block text-[.85rem] text-soft">{e.time}</span>}
                    </div>

                    <div className="flex-1">
                      {e.kind && <span className="text-[.74rem] font-semibold uppercase tracking-[.1em] text-accent">{e.kind}</span>}
                      <h2 className="mt-1.5 font-display text-[1.4rem] font-medium leading-[1.5] text-ink md:text-[1.6rem]">{e.title}</h2>
                      <p className="mt-1.5 text-[.9rem] text-soft">{e.org} · {e.place}</p>
                    </div>

                    {e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full border-[1.5px] border-accent px-6 py-2.5 text-[.88rem] font-semibold text-accent transition-colors duration-300 hover:bg-accent hover:text-white"
                      >
                        التسجيل
                      </a>
                    )}
                  </div>
                </motion.li>
              ))}
            </ul>
          ) : (
            <FadeUp>
              <div className="rounded-2xl border border-hair bg-wash px-6 py-24 text-center">
                <span className="inline-flex items-center gap-2.5 text-[.82rem] font-semibold text-accent">
                  <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
                  الجدول قيد التحديث
                </span>
                <h2 className="mx-auto mt-6 max-w-[520px] font-display text-[clamp(1.5rem,3.4vw,2.2rem)] font-semibold leading-[1.5] text-ink">
                  لا لقاءات معلنة حالياً.
                </h2>
                <p className="mx-auto mt-4 max-w-[460px] text-[1rem] font-light leading-[1.9] text-soft">
                  اشترك في النشرة ليصلك إعلان اللقاء القادم أولاً — أو احجز موعداً مباشراً.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Magnetic to="/contact" className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                    احجز موعداً
                  </Magnetic>
                </div>
              </div>
            </FadeUp>
          )}

          <FadeUp delay={0.1}>
            <div className="mt-16">
              <Newsletter />
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
