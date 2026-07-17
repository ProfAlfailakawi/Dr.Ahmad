import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { SITE_URL, profile } from '../data'
import { categoryLabel } from '../lib/content-taxonomy'

const arDigits = (value: number | string) => String(value).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

/* رقم الأسبوع منذ أول مقال — يمنح كل رسالة ترتيبًا ثابتًا («الرسالة رقم ٨٤») */
function weekOrdinal(iso: string, earliestIso: string) {
  const ms = new Date(iso).getTime() - new Date(earliestIso).getTime()
  return Math.max(1, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1)
}

/* أول جملة تأملية من المقال — تصلح كاقتباس افتتاحي للرسالة */
function openingLine(body = '', excerpt = '') {
  const clean = (body || excerpt).replace(/\s+/g, ' ').trim()
  const first = clean.split(/(?<=[.!؟…])\s+/)[0] || excerpt
  return first.length > 180 ? `${first.slice(0, 177).trim()}…` : first
}

export default function WeeklyLetter() {
  const { articles } = useCmsContent()
  const ordered = useMemo(() => [...articles].filter((a) => a.title && a.iso).sort((a, b) => b.iso.localeCompare(a.iso)), [articles])
  const earliestIso = useMemo(() => ordered.length ? ordered[ordered.length - 1].iso : '2016-01-01', [ordered])
  const latest = ordered[0]

  useSeo({
    title: 'رسالة الأسبوع',
    path: '/weekly',
    description: latest ? `رسالة هذا الأسبوع: ${latest.title} — مقالٌ جديد كل أسبوع من د. أحمد حسين الفيلكاوي.` : 'مقالٌ جديد كل أسبوع.',
  })

  if (!latest) {
    return (
      <Page>
        <PageHead label="رسالة الأسبوع" title="قريبًا." sub="مقالٌ جديد كل أسبوع." />
      </Page>
    )
  }

  const opening = openingLine(latest.body, latest.excerpt)
  const rest = ordered.slice(1, 25)

  return (
    <Page className="content-articles page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/weekly#collection`,
        name: 'رسالة الأسبوع',
        url: `${SITE_URL}/weekly`,
        inLanguage: 'ar',
        mainEntity: { '@type': 'Article', headline: latest.title, url: `${SITE_URL}/articles/${latest.slug}` },
      }} />

      <PageHead
        label="رسالة الأسبوع"
        title="رسالةُ هذا الأسبوع."
        sub="كل أسبوع، فكرةٌ واحدة تستحق التوقّف — تصلك كرسالةٍ مصمّمة، لا مجرد مقال."
      />

      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          {/* ═══ الرسالة الحالية — بطاقة الغلاف ═══ */}
          <FadeUp>
            <article className="relative overflow-hidden rounded-[2rem] border border-hair bg-wash">
              <div className="pointer-events-none absolute inset-0 opacity-[.5]"
                style={{ background: 'radial-gradient(60% 80% at 82% 12%, rgb(var(--c-accent) / .07), transparent 70%)' }} />
              <div className="relative px-6 py-10 md:px-12 md:py-14">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[.8rem] text-soft">
                  <span className="font-semibold text-accent">الرسالة رقم {arDigits(weekOrdinal(latest.iso, earliestIso))}</span>
                  <span aria-hidden>·</span>
                  <time>{latest.date}</time>
                  <span aria-hidden>·</span>
                  <span>{categoryLabel(latest.cat)}</span>
                  {latest.hasAudio && (<><span aria-hidden>·</span><span className="inline-flex items-center gap-1.5 text-accent">
                    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 12h2.2M8.4 8.5v7M12 5.5v13M15.6 8.5v7M19.8 11v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    مسموعة
                  </span></>)}
                </div>

                <h2 className="mt-6 font-display text-[clamp(1.9rem,4.4vw,3.1rem)] font-bold leading-[1.35] text-ink">
                  <Reveal><Link to={`/articles/${latest.slug}`} className="transition-colors hover:text-accent">{latest.title}</Link></Reveal>
                </h2>

                {opening && (
                  <p className="mt-7 max-w-[680px] border-r-2 border-accent/35 pe-1 ps-5 text-[1.06rem] font-light leading-[1.95] text-ink/85">
                    {opening}
                  </p>
                )}

                <div className="mt-9 flex flex-wrap gap-3">
                  <Link to={`/articles/${latest.slug}`} className="inline-flex items-center rounded-full bg-accent px-7 py-3.5 font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep">
                    اقرأ الرسالة كاملة ←
                  </Link>
                  {latest.hasAudio && (
                    <Link to={`/articles/${latest.slug}#article-audio`} className="inline-flex items-center rounded-full border-[1.5px] border-accent px-7 py-3.5 font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas">
                      استمع إليها
                    </Link>
                  )}
                </div>
              </div>
            </article>
          </FadeUp>

          {/* ═══ أرشيف الرسائل — عمود فقري ═══ */}
          {rest.length > 0 && (
            <FadeUp delay={0.1}>
              <div className="mt-16">
                <div className="mb-8 flex items-center gap-3">
                  <span className="h-[1.5px] w-7 bg-accent" />
                  <h3 className="text-[.8rem] font-semibold uppercase text-accent">الرسائل السابقة</h3>
                </div>
                <ol className="relative ms-3 border-s border-hair">
                  {rest.map((a, i) => (
                    <FadeUp key={a.slug} delay={Math.min(i * 0.02, 0.25)}>
                      <li className="relative ps-7 pb-9 last:pb-0">
                        <span className="absolute -start-[5px] top-2 h-2.5 w-2.5 rounded-full bg-accent/45" />
                        <Link to={`/articles/${a.slug}`} className="group block">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[.74rem] text-soft">
                            <span className="font-semibold text-accent/80">الرسالة {arDigits(weekOrdinal(a.iso, earliestIso))}</span>
                            <time>{a.date}</time>
                            <span>{categoryLabel(a.cat)}</span>
                          </div>
                          <p className="mt-1.5 font-display text-[1.12rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{a.title}</p>
                        </Link>
                      </li>
                    </FadeUp>
                  ))}
                </ol>
                <div className="mt-6 ps-7">
                  <Link to="/articles" className="text-[.85rem] font-semibold text-accent transition-colors hover:text-accent-deep">
                    كل المقالات ({arDigits(ordered.length)}) ←
                  </Link>
                </div>
              </div>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}
