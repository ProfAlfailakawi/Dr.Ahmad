import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import {CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'

export default function PaperDetail() {
  const { slug } = useParams()
  const { papers, loading } = useCmsContent()
  const i = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[i]
  useSeo({ title: p?.title ?? 'بحث', description: p?.abstractAr || p?.meta, path: `/research/${slug}`, type: 'article' })

  if (!p && loading)
    return (
      <Page className="content-research article-journey">
        <div className="px-6 pt-44 text-center text-soft">لحظة…</div>
      </Page>
    )

  if (!p)
    return (
      <Page>
        <div className="px-6 pt-44 text-center text-soft">لم يُعثر على البحث.</div>
      </Page>
    )

  const prev = papers[i - 1]
  const next = papers[i + 1]
  const paperLink = p.source || p.pdf

  return (
    <Page>
      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[760px]">
          <FadeUp>
            <Link to="/research" className="text-[.85rem] text-soft transition-colors hover:text-accent">
              ← كل المساهمات العلمية
            </Link>
          </FadeUp>

          <FadeUp delay={0.05}>
            <span className="mt-8 block text-[.76rem] font-semibold uppercase text-accent">بحث محكّم</span>
            <h1 dir="auto" className="mt-4 font-display text-[clamp(1.7rem,4vw,2.7rem)] font-bold leading-[1.45] text-ink">
              <Reveal>{p.title}</Reveal>
            </h1>
            <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />
            <div className="mt-7 h-[2px] w-16 bg-accent" />
          </FadeUp>

          <FadeUp delay={0.1}>
            <dl className="mt-10 divide-y divide-hair border-y border-hair">
              {p.meta && (
                <div className="flex flex-wrap gap-4 py-5">
                  <dt className="w-32 shrink-0 text-[.85rem] text-soft">الموضوع</dt>
                  <dd className="text-[.98rem] text-ink">{p.meta}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-4 py-5">
                <dt className="w-32 shrink-0 text-[.85rem] text-soft">الباحث</dt>
                <dd className="text-[.98rem] text-ink">
                  {profile.fullName}
                  {(p as { coAuthors?: string }).coAuthors?.trim() && (
                    <span className="text-soft"> — بالاشتراك مع {(p as { coAuthors?: string }).coAuthors}</span>
                  )}
                </dd>
              </div>
              {p.journal && (
                <div className="flex flex-wrap gap-4 py-5">
                  <dt className="w-32 shrink-0 text-[.85rem] text-soft">النشر</dt>
                  <dd className="text-[.98rem] text-accent">{p.journal}</dd>
                </div>
              )}
            </dl>
          </FadeUp>

          {p.abstractAr && (
            <FadeUp delay={0.12}>
              <section className="mt-8 rounded-2xl border border-hair bg-wash px-6 py-5">
                <p className="text-[.76rem] font-semibold text-accent">الملخص</p>
                <p className="mt-3 text-[.95rem] font-light leading-[1.95] text-ink/80 dark:text-soft">{p.abstractAr.replace(/^ملخص عربي:\s*/, '')}</p>
              </section>
            </FadeUp>
          )}

          <FadeUp delay={0.14}>
            {paperLink ? (
              <a
                href={paperLink}
                target="_blank"
                rel="noreferrer"
                className="mt-10 inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep"
              >
                اقرأ البحث في مصدره المنشور ←
              </a>
            ) : (
              <div className="mt-10 rounded-2xl border border-hair bg-wash p-8 text-center">
                <p className="text-[1rem] font-light leading-[1.9] text-ink/80 dark:text-soft">
                  ملخّص هذا البحث لم يُضَف بعد.
                </p>
                <p className="mt-2 text-[.85rem] text-soft">للحصول على نسخة، تواصل معي مباشرة.</p>
                <Link to="/contact" className="mt-6 inline-block rounded-full border-[1.5px] border-accent px-7 py-3 font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas">
                  اطلب نسخة
                </Link>
              </div>
            )}
            {/* الفهرسة الأكاديمية — أيقونتان أنيقتان: رابط البحث نفسه إن وُجد، وإلا ملفّا الدكتور */}
            {(() => {
              const links = p as { scholar?: string; researchgate?: string }
              const scholar = links.scholar || profile.scholar
              const researchgate = links.researchgate || profile.researchgate
              if (!scholar && !researchgate) return null
              const btn = 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent'
              return (
                <div className="mt-7 flex items-center gap-3">
                  <span className="text-[.82rem] text-soft">اطّلع أيضاً في</span>
                  {scholar && (
                    <a href={scholar} target="_blank" rel="noreferrer" aria-label="Google Scholar" title="Google Scholar" className={btn}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5s-5.548 1.749-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" /></svg>
                    </a>
                  )}
                  {researchgate && (
                    <a href={researchgate} target="_blank" rel="noreferrer" aria-label="ResearchGate" title="ResearchGate" className={btn}>
                      <span className="text-[.72rem] font-bold leading-none tracking-tight">R<span className="text-accent">G</span></span>
                    </a>
                  )}
                </div>
              )
            })()}
            <CiteButton title={p.title} year={(p.journal?.match(/20[0-2][0-9]/) || ['2022'])[0]} container={p.journal || 'بحث محكّم'} url={`${SITE_URL}/research/${p.slug}`} />
          </FadeUp>

          <FadeUp>
            <nav className="mt-16 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
              {prev ? (
                <Link to={`/research/${prev.slug}`} className="group">
                  <span className="text-[.78rem] text-soft">السابق</span>
                  <span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{prev.title}</span>
                </Link>
              ) : <span />}
              {next && (
                <Link to={`/research/${next.slug}`} className="group sm:text-left">
                  <span className="text-[.78rem] text-soft">التالي</span>
                  <span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{next.title}</span>
                </Link>
              )}
            </nav>
          </FadeUp>
        </div>
      </article>
    </Page>
  )
}
