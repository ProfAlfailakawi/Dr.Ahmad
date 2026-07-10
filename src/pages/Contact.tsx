import { FadeUp, Label, Magnetic, Page, Reveal } from '../components/ui'
import { links, place, socials } from '../data'
import { Newsletter } from '../components/extras'
import { ContactForm } from '../components/ContactForm'
import { useSeo } from '../components/seo'

export default function Contact() {
  useSeo({ title: 'للاستشارة أو التعاون', path: '/contact' })
  return (
    <Page>
      <section className="flex min-h-[86vh] items-center px-6 py-32 text-center md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label center>للاستشارة أو التعاون</Label>
            <h1 className="font-display text-[clamp(2.6rem,8vw,5.2rem)] font-bold text-ink">
              <Reveal>لنعمل معاً.</Reveal>
            </h1>
            <p className="mx-auto mt-6 max-w-[520px] text-[1.12rem] font-light leading-[1.9] text-[#3f454f]">
              استشارات في تكنولوجيا التعليم، محاضرات وورش عمل، ومشاريع تحوّل رقمي في المؤسسات التعليمية.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Magnetic href={links.booking} className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                احجز موعداً
              </Magnetic>
              <a href={links.cv} target="_blank" rel="noreferrer" className="inline-block rounded-full border-[1.5px] border-hair px-8 py-3.5 font-semibold text-ink transition-colors duration-300 hover:border-accent hover:text-accent">
                السيرة الذاتية
              </a>
            </div>

            <div className="mt-16 flex flex-wrap justify-center gap-7 border-t border-hair pt-10 text-[.92rem] text-soft">
              {socials.map((s) => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">{s.label}</a>
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
            <div className="mt-16">
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
