import { Link } from 'react-router'
import { FadeUp, Page, PageHead, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { aboutSite } from '../data'

export default function AboutSite() {
  useSeo({ title: 'حول الموقع', path: '/about', description: aboutSite.hero })

  return (
    <Page>
      <PageHead label="حول الموقع" title="فضاءٌ مُنتقى." sub={aboutSite.hero} />

      <div className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          {/* الرؤية + لماذا */}
          <div className="grid gap-12 border-b border-hair pb-16 md:grid-cols-2 md:gap-14">
            {aboutSite.sections.map((s, i) => (
              <FadeUp key={s.title} delay={i * 0.08}>
                <span className="inline-flex items-center gap-2.5 text-[.76rem] font-semibold uppercase text-accent"><span aria-hidden className="visual-dna-node" />{s.title}</span>
                <p className="mt-5 text-[1.12rem] font-light leading-[2] text-ink/80">{s.body}</p>
              </FadeUp>
            ))}
          </div>

          {/* ما يميّزه */}
          <section className="border-b border-hair py-16">
            <FadeUp>
              <span className="inline-flex items-center gap-2.5 text-[.76rem] font-semibold uppercase text-accent"><span aria-hidden className="visual-dna-node" />ما الذي يميّز هذا الموقع؟</span>
            </FadeUp>
            <ul className="mt-8 grid gap-6 md:grid-cols-2 md:gap-x-12">
              {aboutSite.distinct.map((t, i) => (
                <FadeUp key={t} delay={i * 0.05}>
                  <li className="relative ps-7 text-[1rem] font-light leading-[1.95] text-ink">
                    <span className="absolute right-0 top-[.62em] h-2 w-2 rotate-45 bg-accent" />
                    {t}
                  </li>
                </FadeUp>
              ))}
            </ul>
          </section>

          {/* لمن هذا الموقع؟ — بطاقات إنسانية */}
          <section className="border-b border-hair py-16">
            <FadeUp>
              <span className="inline-flex items-center gap-2.5 text-[.76rem] font-semibold uppercase text-accent"><span aria-hidden className="visual-dna-node" />لمن هذا الموقع؟</span>
            </FadeUp>
            <div className="mobile-card-rail mt-8 grid gap-5 sm:grid-cols-2">
              {aboutSite.audience.map((t, i) => (
                <FadeUp key={t} delay={i * 0.06}>
                  <div className="h-full rounded-2xl border border-hair border-r-2 border-r-accent bg-wash p-7 font-display text-[clamp(1.1rem,2.2vw,1.4rem)] font-medium leading-[1.7] text-ink">
                    {t}
                  </div>
                </FadeUp>
              ))}
            </div>
          </section>

          {/* العقيدة */}
          <section className="py-16">
            <div className="rounded-2xl border border-hair bg-wash p-9 md:p-12">
              {aboutSite.creed.map((t, i) => (
                <FadeUp key={t} delay={i * 0.08}>
                  <p className={`font-display text-[1.15rem] font-light leading-[1.9] text-ink/90 md:text-[1.3rem] ${i ? 'mt-5' : ''}`}>
                    <span aria-hidden className="visual-dna-node me-2.5 align-middle" />
                    {t}
                  </p>
                </FadeUp>
              ))}
            </div>
          </section>

          <FadeUp>
            <div className="border-t border-hair pt-14 text-center">
              <h2 className="mx-auto max-w-[640px] font-display text-[clamp(1.5rem,3.6vw,2.4rem)] font-semibold leading-[1.55] text-ink">
                <Reveal>{aboutSite.hero}</Reveal>
              </h2>
              <Link to="/contact" className="mt-9 inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                للاستشارة أو التعاون
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </Page>
  )
}
