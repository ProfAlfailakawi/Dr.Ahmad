import { useEffect } from 'react'
import { ContactForm } from '../components/ContactForm'
import { FadeUp, Page } from '../components/ui'
import { useSeo } from '../components/seo'

export default function EnglishContact() {
  useSeo({ title: 'Book a meeting', path: '/en/contact', description: 'Consulting, keynotes, workshops, media interviews and research collaboration with Dr. Ahmad H. Alfailakawi.' })
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('lang', 'en'); html.setAttribute('dir', 'ltr')
    return () => { html.setAttribute('lang', 'ar'); html.setAttribute('dir', 'rtl') }
  }, [])
  return (
    <Page>
      <header className="border-b border-hair px-6 pb-14 pt-32 md:px-11 md:pb-16 md:pt-40" dir="ltr">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="text-[.76rem] font-semibold uppercase tracking-[.14em] text-accent">Contact</p>
            <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.3rem,6vw,4.6rem)] font-bold leading-[1.1] text-ink">Start with the purpose, not a long form.</h1>
            <p className="mt-6 max-w-2xl text-[1rem] font-light leading-[1.85] text-soft">Choose the kind of conversation you need. The form will show only the information relevant to that request.</p>
          </FadeUp>
        </div>
      </header>
      <section className="px-6 py-14 md:px-11 md:py-16" dir="ltr">
        <div id="booking-form" tabIndex={-1} className="mx-auto max-w-3xl scroll-mt-24 outline-none">
          <ContactForm locale="en" />
        </div>
      </section>
    </Page>
  )
}
