import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { FadeUp, Label, Page, Reveal } from '../components/ui'
import { place } from '../data'
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
      <section className="px-6 pb-20 pt-32 text-center md:px-11 md:pb-24 md:pt-40">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label center>للاستشارة أو التعاون</Label>
            <h1 className="font-display text-[clamp(2.6rem,8vw,5.2rem)] font-bold text-ink">
              <Reveal>لنعمل معاً.</Reveal>
            </h1>
            <p className="mx-auto mt-6 max-w-[520px] text-[1.12rem] font-light leading-[1.9] text-ink/80">
              استشارات في تكنولوجيا التعليم والذكاء الاصطناعي، محاضرات وورش عمل، ومشاريع تحوّل رقمي في المؤسسات التعليمية.
            </p>

            <div className="mt-10">
              <a href="#booking-form" className="inline-flex min-h-11 items-center rounded-full bg-accent px-8 py-3 font-semibold text-white transition-colors hover:bg-accent-deep">
                احجز موعداً
              </a>
            </div>

          </FadeUp>



          <FadeUp delay={0.08}>
            <div id="booking-form" tabIndex={-1} aria-label="نموذج حجز موعد" className="mt-14 scroll-mt-24 border-t border-hair pt-12 outline-none md:mt-16 md:pt-16">
              <ContactForm />
            </div>
          </FadeUp>


        </div>
      </section>
    </Page>
  )
}
