import { useEffect } from 'react'
import { Laptop, MessageCircle, Presentation } from 'lucide-react'
import { useLocation } from 'react-router'
import { FadeUp, Label, Page, Reveal } from '../components/ui'
import { place } from '../data'
import { ContactForm } from '../components/ContactForm'
import { useSeo } from '../components/seo'

const SERVICES = [
  { icon: MessageCircle, label: 'استشارات في تكنولوجيا التعليم والذكاء الاصطناعي' },
  { icon: Presentation, label: 'محاضرات وورش عمل' },
  { icon: Laptop, label: 'مشاريع تحوّل رقمي للمؤسسات التعليمية' },
]

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
            <img src="/portrait.webp" alt="" width={1345} height={2048} decoding="async" className="mx-auto mb-6 h-24 w-24 rounded-full border border-hair object-cover object-top" />
            <Label center>للاستشارة أو التعاون</Label>
            <h1 className="font-display text-[clamp(2.6rem,8vw,5.2rem)] font-bold leading-[1.25] text-ink">
              <Reveal>لنعمل معاً.</Reveal>
            </h1>
            {/* ثلاث خدمات كرموز موجزة بدل فقرة — العرض فقط */}
            <ul className="mx-auto mt-8 flex w-fit max-w-full flex-col items-start gap-4 text-start text-ink/80 sm:w-auto sm:max-w-[760px] sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8">
              {SERVICES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-[1rem] font-light">
                  <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full border border-hair bg-wash text-accent"><Icon size={20} strokeWidth={1.6} /></span>
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <a href="#booking-form" className="inline-flex min-h-11 items-center rounded-full bg-accent px-8 py-3 font-semibold text-canvas transition-colors hover:bg-accent-deep">
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
