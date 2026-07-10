import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { profile } from '../data'
import { useCmsContent } from '../lib/content'

export default function PaperDetail() {
  const { slug } = useParams()
  const { papers, loading } = useCmsContent()
  const i = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[i]
  useSeo({ title: p?.title ?? 'بحث', description: p?.meta, path: `/research/${slug}`, type: 'article' })

  if (!p && loading)
    return (
      <Page>
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
  const paperLink = p.source || p.pdf || p.url

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
            <span className="mt-8 block text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">بحث محكّم</span>
            <h1 className="mt-4 font-display text-[clamp(1.7rem,4vw,2.7rem)] font-bold leading-[1.45] text-ink">
              <Reveal>{p.title}</Reveal>
            </h1>
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
                <dd className="text-[.98rem] text-ink">{profile.fullName}</dd>
              </div>
              {p.journal && (
                <div className="flex flex-wrap gap-4 py-5">
                  <dt className="w-32 shrink-0 text-[.85rem] text-soft">النشر</dt>
                  <dd className="text-[.98rem] text-accent">{p.journal}</dd>
                </div>
              )}
            </dl>
          </FadeUp>

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
