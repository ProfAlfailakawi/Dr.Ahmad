import { JsonLd, useSeo } from '../components/seo'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead, SocialIcon } from '../components/ui'
import { academicProfiles, doctorate, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { Pagination, usePagedList } from '../components/Pagination'
import { analyzeResearch } from '../lib/research-intelligence'

const ar = (n: number) => String(n).padStart(2, '0')
const paperCount = (count: number) => count === 1 ? 'بحث واحد' : count === 2 ? 'بحثان' : `${count} بحثاً`
const badge = 'research-badge inline-flex items-center rounded-full px-3 py-1.5 text-[.72rem] font-semibold'
const arabicOnly = (value = '') => /[\u0600-\u06ff]/.test(value) ? value.trim() : ''

export default function Research() {
  const { papers } = useCmsContent()
  const paged = usePagedList(papers, 12, String(papers.length))
  const count = paperCount(papers.length)

  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} محكّماً في تكنولوجيا التعليم والممارسة التربوية.` })
  return (
    <Page className="content-research page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/research#collection`,
        name: 'المساهمات العلمية', url: `${SITE_URL}/research`, inLanguage: 'ar',
        mainEntity: { '@type': 'ItemList', numberOfItems: papers.length, itemListElement: papers.map((paper, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/research/${paper.slug}`, name: paper.title })) },
      }} />
      <PageHead label="المساهمات العلمية" title="الأثر العلمي." sub="أبحاث محكّمة تُعرض بهدوء، وتفتح تفاصيلها العلمية ومصادرها الأصلية عند الطلب." />

      <section className="px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-10 flex flex-wrap items-center justify-between gap-5 border-b border-hair pb-6">
              <div>
                <span className="block text-[.82rem] font-semibold text-ink">الأرشيف العلمي المحكّم</span>
                <span className="mt-1 block text-[.74rem] text-soft">{count} مع وصول مباشر إلى البيانات والمصادر الأصلية</span>
              </div>
              <span className="flex items-center gap-2.5">
                {academicProfiles.map((profileLink) => (
                  <a key={profileLink.label} href={profileLink.url} target="_blank" rel="noreferrer" aria-label={profileLink.label} title={profileLink.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
                    <SocialIcon name={profileLink.label} size={18} />
                  </a>
                ))}
              </span>
            </div>
          </FadeUp>

          <ul id="research-list" className="grid scroll-mt-28 gap-4">
            {paged.pageItems.map((p, i) => {
              const intelligence = analyzeResearch(p)
              const type = arabicOnly(p.studyType || intelligence.studyType)
              const year = p.year || intelligence.year
              const journal = p.journal || intelligence.journal
              return (
                <FadeUp key={p.slug} delay={Math.min(i * 0.03, 0.3)}>
                  <li className="research-list-card overflow-hidden rounded-[26px] border">
                    <div className="grid gap-4 p-5 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center md:p-7">
                      <span className="pt-1 font-display text-[.86rem] font-bold text-accent sm:self-start">{ar((paged.page - 1) * 12 + i + 1)}</span>
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap gap-2">
                          <span className={badge}>محكّم</span>
                          {type && <span className={badge}>{type}</span>}
                        </div>
                        <Link to={`/research/${p.slug}`} dir="auto" className="research-title-link block text-[1.12rem] font-bold leading-[1.65] text-ink transition-colors hover:text-accent">{p.title}</Link>
                        {p.titleAr && p.titleAr !== p.title && <p dir="rtl" className="mt-1 text-[.92rem] font-light leading-[1.8] text-soft">{p.titleAr}</p>}
                        {(journal || year) && (
                          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[.74rem] text-soft">
                            {journal && <span dir="auto">{journal}</span>}
                            {year && <span className="font-semibold text-accent">{year}</span>}
                          </p>
                        )}
                      </div>
                      <Link to={`/research/${p.slug}#research-passport`} className="research-understand-link sm:self-center">افهم هذا البحث <span aria-hidden>←</span></Link>
                    </div>
                  </li>
                </FadeUp>
              )
            })}
          </ul>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={papers.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="research-list" label="صفحات الأبحاث" className="mt-8" />

          <FadeUp delay={0.15}>
            <div className="mt-16 border-t border-hair pt-9">
              <span className="text-[.76rem] font-semibold text-soft">أطروحة الدكتوراه</span>
              <h2 className="mt-4 text-[1.1rem] font-medium leading-[1.75] text-ink">{doctorate.title}</h2>
              <p className="mt-4 text-[.92rem] text-soft">{doctorate.university}</p>
              <p className="mt-1 text-[.92rem] text-soft">{doctorate.note}</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
