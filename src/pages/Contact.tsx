import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { FadeUp, Label, Page, Reveal, SocialIcon } from '../components/ui'
import { links, place, socials } from '../data'
import { Newsletter } from '../components/extras'
import { ContactForm } from '../components/ContactForm'
import { useSeo } from '../components/seo'

export default function Contact() {
  const location = useLocation()
  useSeo({ title: 'للاستشارة أو التعاون', path: '/contact' })

  useEffect(() => {
    if (location.hash !== '#booking-form') return
    const timer = window.setTimeout(() => {
      const form = document.getElementById('booking-form')
      form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      form?.focus({ preventScroll: true })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  return (
    <Page>
      <section className="flex min-h-[86vh] items-center px-6 py-32 text-center md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label center>للاستشارة أو التعاون</Label>
            <h1 className="font-display text-[clamp(2.6rem,8vw,5.2rem)] font-bold text-ink">
              <Reveal>لنعمل معاً.</Reveal>
            </h1>
            <p className="mx-auto mt-6 max-w-[520px] text-[1.12rem] font-light leading-[1.9] text-ink/80">
              استشارات في تكنولوجيا التعليم، محاضرات وورش عمل، ومشاريع تحوّل رقمي في المؤسسات التعليمية.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <a href="#booking-form" className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                احجز موعداً
              </a>
              <Link to="/cv" className="inline-block rounded-full border-[1.5px] border-hair px-8 py-3.5 font-semibold text-ink transition-colors duration-300 hover:border-accent hover:text-accent">
                السيرة الأكاديمية
              </Link>
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-center gap-6 border-t border-hair pt-10 text-soft">
              {socials.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} className="transition-colors hover:text-accent"><SocialIcon name={s.label} /></a>
              ))}
            </div>

            <p className="mt-8 text-[.85rem] text-soft">{place.label} · {place.city}</p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="mt-14 overflow-hidden rounded-2xl border border-hair" style={{ aspectRatio: '21 / 9' }}>
              <iframe
                src={place.mapEmbed}
                title={place.label}
                loading="lazy"
                className="h-full w-full grayscale-[.9] transition-[filter] duration-500 hover:grayscale-0"
                style={{ border: 0 }}
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </FadeUp>

          <FadeUp delay={0.12}>
            <div id="booking-form" tabIndex={-1} aria-label="نموذج حجز موعد" className="mt-16 scroll-mt-24 outline-none">
              <ContactForm />
            </div>
          </FadeUp>

          <FadeUp delay={0.15}>
            <div className="mt-6 text-right">
              <Newsletter />
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
