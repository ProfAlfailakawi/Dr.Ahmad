import { FadeUp, Label, Magnetic, Page } from '../components/ui'
import { Newsletter } from '../components/extras'
import { useSeo } from '../components/seo'
import { upcoming, type Event as SiteEvent } from '../data'
import { useExtras } from '../lib/content'

export default function Upcoming() {
  useSeo({ title: 'اللقاءات القادمة', path: '/upcoming', description: 'محاضرات وورش عمل ومؤتمرات قادمة للدكتور أحمد حسين الفيلكاوي.' })
  const addedEvents = useExtras<SiteEvent & { id: string }>('site_upcoming')

  const today = new Date().toISOString().slice(0, 10)
  const future = [...addedEvents, ...upcoming]
    .filter((event, index, list) => list.findIndex((candidate) => candidate.iso === event.iso && candidate.title === event.title) === index)
    .filter((event) => event.iso >= today)
    .sort((left, right) => left.iso.localeCompare(right.iso))

  return (
    <Page>
      <header className="border-b border-hair px-6 pb-10 pt-28 md:px-11 md:pb-12 md:pt-32">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label>محتواي المعرفي</Label>
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="font-display text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-[1.3] text-ink">اللقاءات القادمة.</h1>
                <p className="mt-3 max-w-2xl text-[.95rem] font-light leading-[1.8] text-soft">محاضرات وورش ومؤتمرات — بموعدها ورابط التسجيل المباشر.</p>
              </div>
              <Magnetic to="/contact#booking-form" className="inline-block rounded-full border border-accent px-5 py-2.5 text-[.84rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">
                ادعُني إلى لقاء
              </Magnetic>
            </div>
          </FadeUp>
        </div>
      </header>

      <section className="px-6 py-10 md:px-11 md:py-14">
        <div className="mx-auto max-w-4xl">
          {future.length > 0 ? (
            <ul className="grid gap-3">
              {future.map((e, i) => (
                <FadeUp
                  key={e.iso + e.title}
                  delay={Math.min(i * 0.05, 0.25)}
                >
                  <li className="group grid gap-3 rounded-xl border border-hair bg-canvas p-4 transition-colors hover:border-accent sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:gap-5 sm:p-5">
                    <div className="border-b border-hair pb-3 sm:border-b-0 sm:border-l sm:pb-0 sm:pl-5">
                      <time dateTime={e.iso} className="block font-display text-[1rem] font-semibold text-accent">{e.date}</time>
                      {e.time && <span className="mt-0.5 block text-[.76rem] text-soft">{e.time}</span>}
                    </div>

                    <div className="min-w-0">
                      {e.kind && <span className="text-[.68rem] font-semibold text-accent">{e.kind}</span>}
                      <h2 className="mt-0.5 font-display text-[1.08rem] font-medium leading-[1.5] text-ink">{e.title}</h2>
                      <p className="mt-1 text-[.8rem] text-soft">{e.org} · {e.place}</p>
                    </div>

                    {e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-fit shrink-0 rounded-full border border-accent px-4 py-2 text-[.8rem] font-semibold text-accent transition-colors duration-300 hover:bg-accent hover:text-white"
                      >
                        التسجيل
                      </a>
                    )}
                  </li>
                </FadeUp>
              ))}
            </ul>
          ) : (
            <FadeUp>
              <div className="rounded-xl border border-hair bg-wash px-6 py-12 text-center md:py-14">
                <span className="inline-flex items-center gap-2.5 text-[.82rem] font-semibold text-accent">
                  <span className="pulse relative h-2 w-2 rounded-full bg-accent" />
                  الجدول قيد التحديث
                </span>
                <h2 className="mx-auto mt-4 max-w-[520px] font-display text-[clamp(1.3rem,3vw,1.75rem)] font-semibold leading-[1.5] text-ink">
                  لا لقاءات معلنة حالياً.
                </h2>
                <p className="mx-auto mt-2 max-w-[460px] text-[.9rem] font-light leading-[1.8] text-soft">
                  اشترك في النشرة ليصلك إعلان اللقاء القادم أولاً — أو احجز موعداً مباشراً.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Magnetic to="/contact#booking-form" className="inline-block rounded-full bg-accent px-6 py-2.5 text-[.88rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                    احجز موعداً
                  </Magnetic>
                </div>
              </div>
            </FadeUp>
          )}

          <FadeUp delay={0.1}>
            <div className="mt-10">
              <Newsletter />
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
