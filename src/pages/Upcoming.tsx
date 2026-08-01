import { Link } from 'react-router'
import { FadeUp, Label, Magnetic, Page } from '../components/ui'
import { Pagination, usePagedList } from '../components/Pagination'
import { Newsletter } from '../components/extras'
import { useSeo } from '../components/seo'
import { upcoming, type Event as SiteEvent } from '../data'
import { useCmsContent, useExtras } from '../lib/content'
import { normalizeArabic } from '../lib/cms'
import { downloadEventIcs, eventStatus, googleCalendarUrl, sortPastEvents, sortUpcomingEvents } from '../lib/events'

/* ربط اللقاء المنتهي بمادته (مقترح معتمد): إن وُلد من اللقاء مقال أو تسجيل، يظهر أثره */
const eventTokens = (text = '') => new Set(normalizeArabic(text).split(/\s+/).filter((word) => word.length > 3))
function eventOutcome(event: SiteEvent, articles: { slug: string; title: string }[], media: { slug: string; title: string; url?: string }[]) {
  const tokens = eventTokens(`${event.title} ${event.org || ''}`)
  if (tokens.size < 2) return null
  const overlap = (title: string) => {
    const candidate = eventTokens(title)
    let shared = 0
    for (const token of tokens) if (candidate.has(token)) shared += 1
    return shared
  }
  for (const article of articles) if (overlap(article.title) >= 2) return { label: 'قراءة أثره مقالاً', to: `/articles/${article.slug}` }
  for (const item of media) if (overlap(item.title) >= 2) return { label: 'مشاهدة تسجيله', to: `/media`, href: item.url }
  return null
}

const statusTone: Record<string, string> = {
  today: 'bg-accent text-white',
  soon: 'border border-accent/50 text-accent',
  open: 'border border-hair text-soft',
  announced: 'border border-hair text-soft',
}

export default function Upcoming() {
  useSeo({ title: 'اللقاءات القادمة', path: '/upcoming', description: 'محاضرات وورش عمل ومؤتمرات قادمة للدكتور أحمد حسين الفيلكاوي.' })
  const addedEvents = useExtras<SiteEvent & { id: string }>('site_upcoming')
  const { articles, media } = useCmsContent()

  const all = [...addedEvents, ...upcoming]
  const future = sortUpcomingEvents(all)
  const past = sortPastEvents(all).slice(0, 12)
  const paged = usePagedList(future, 12, String(future.length))

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
            <>
            <ul id="upcoming-events-list" className="grid gap-3">
              {paged.pageItems.map((e, i) => (
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
                      <span className="flex flex-wrap items-center gap-2">
                        {e.kind && <span className="text-[.68rem] font-semibold text-accent">{e.kind}</span>}
                        {(() => {
                          const status = eventStatus(e)
                          return status ? <span className={`rounded-full px-2.5 py-0.5 text-[.64rem] font-semibold ${statusTone[status.key]}`}>{status.label}</span> : null
                        })()}
                      </span>
                      <h2 className="mt-0.5 font-display text-[1.08rem] font-medium leading-[1.5] text-ink">{e.title}</h2>
                      <p className="mt-1 text-[.8rem] text-soft">{e.org} · {e.place}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {/^https?:\/\//.test(e.url || '') && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-fit rounded-full border border-accent px-4 py-2 text-[.8rem] font-semibold text-accent transition-colors duration-300 hover:bg-accent hover:text-white"
                        >
                          التسجيل
                        </a>
                      )}
                      {/* «أضف إلى تقويمي» — Google مباشرة وICS لتقويم Apple وOutlook */}
                      <a
                        href={googleCalendarUrl(e)}
                        target="_blank"
                        rel="noreferrer"
                        title="أضف إلى تقويم Google"
                        className="rounded-full border border-hair px-3.5 py-2 text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
                      >
                        + تقويم Google
                      </a>
                      <button
                        type="button"
                        onClick={() => downloadEventIcs(e)}
                        title="ملف تقويم يفتحه Apple وOutlook"
                        className="rounded-full border border-hair px-3.5 py-2 text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
                      >
                        + تقويمي (ICS)
                      </button>
                    </div>
                  </li>
                </FadeUp>
              ))}
            </ul>
            <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={future.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="upcoming-events-list" label="صفحات اللقاءات القادمة" className="mt-8" />
            </>
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

          {/* أرشيف اللقاءات المنقضية (مقترح معتمد): يطوي نفسه ولا يزاحم القادم */}
          {past.length > 0 && (
            <FadeUp delay={0.06}>
              <details className="mt-10 rounded-xl border border-hair bg-wash px-5 py-4">
                <summary className="cursor-pointer text-[.84rem] font-semibold text-ink transition-colors hover:text-accent">
                  لقاءات انقضت — {past.length}
                </summary>
                <ul className="mt-4 divide-y divide-hair">
                  {past.map((e) => {
                    const outcome = eventOutcome(e, articles, media)
                    return (
                      <li key={`past-${e.iso}-${e.title}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                        <time dateTime={e.iso} className="shrink-0 text-[.76rem] font-semibold text-soft">{e.date}</time>
                        <span className="min-w-0 flex-1 text-[.86rem] text-ink">{e.title}<span className="text-soft"> · {e.org}</span></span>
                        {outcome && (
                          outcome.href
                            ? <a href={outcome.href} target="_blank" rel="noreferrer" className="shrink-0 text-[.74rem] font-semibold text-accent transition-colors hover:text-accent-deep">{outcome.label} ←</a>
                            : <Link to={outcome.to} className="shrink-0 text-[.74rem] font-semibold text-accent transition-colors hover:text-accent-deep">{outcome.label} ←</Link>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </details>
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
