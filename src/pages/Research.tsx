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
      <PageHead label="المساهمات العلمية" title="الأثر العلمي." sub="أبحاث محكّمة تُعرض ببياناتها العلمية وروابطها الكاملة في تجربة قراءة دقيقة وواضحة." />

      <section className="px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-10 flex flex-wrap items-center justify-between gap-5 border-b border-hair pb-6">
              <div>
                <span className="block text-[.82rem] font-semibold text-ink">الأرشيف العلمي المحكّم</span>
                <span className="mt-1 block text-[.74rem] text-soft">{count} مع وصول مباشر إلى جميع المصادر المتاحة</span>
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

          <ul id="research-list" className="grid scroll-mt-28 gap-5">
            {paged.pageItems.map((p, i) => {
              const intelligence = analyzeResearch(p)
              const type = p.studyType || intelligence.studyType
              const finding = p.keyFinding || intelligence.keyFinding
              const question = p.researchQuestion || intelligence.researchQuestion
              const methodology = p.methodology || intelligence.methodology
              const sample = p.sample || intelligence.sample
              const keywords = p.keywords || intelligence.keywords
              const links = intelligence.links
              return (
                <FadeUp key={p.slug} delay={Math.min(i * 0.03, 0.3)}>
                  <li className="research-list-card overflow-hidden rounded-[26px] border">
                    <Link to={`/research/${p.slug}`} className="group grid gap-4 p-5 sm:grid-cols-[48px_minmax(0,1fr)] md:p-7">
                      <span className="pt-1 font-display text-[.86rem] font-bold text-accent">{ar((paged.page - 1) * 12 + i + 1)}</span>
                      <span className="min-w-0">
                        <span className="mb-3 flex flex-wrap gap-2">
                          <span className={badge}>محكّم</span>
                          {type && <span className={badge}>{type}</span>}
                          {(p.doi || intelligence.doi) && <span className={badge}>DOI</span>}
                          {intelligence.openAccess && <span className={badge}>نص كامل</span>}
                        </span>
                        <span dir="auto" className="block text-[1.16rem] font-bold leading-[1.65] text-ink transition-colors group-hover:text-accent">{p.title}</span>
                        {p.titleAr && <span dir="rtl" className="mt-1 block text-[.94rem] font-light leading-[1.8] text-soft">{p.titleAr}</span>}

                        <span className="mt-5 grid gap-3 md:grid-cols-2">
                          {question && <span className="research-data-line"><b>السؤال العلمي</b>{question}</span>}
                          {finding && <span className="research-data-line"><b>أبرز نتيجة</b>{finding}</span>}
                          {methodology && <span className="research-data-line"><b>المنهج</b>{methodology}</span>}
                          {sample && <span className="research-data-line"><b>العينة</b>{sample}</span>}
                        </span>

                        {(p.journal || intelligence.year || keywords) && (
                          <span className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-hair pt-4 text-[.78rem] text-soft">
                            {p.journal && <span><b className="text-ink">المجلة:</b> {p.journal}</span>}
                            {intelligence.year && <span><b className="text-ink">السنة:</b> {intelligence.year}</span>}
                            {keywords && <span><b className="text-ink">الكلمات المفتاحية:</b> {keywords}</span>}
                          </span>
                        )}
                      </span>
                    </Link>
                    {links.length > 0 && (
                      <div className="research-card-links flex flex-wrap gap-2 border-t border-hair px-5 py-4 sm:pr-[76px] md:px-7 md:pr-[100px]">
                        {links.map((item) => (
                          <a key={`${p.slug}-${item.id}`} href={item.url} target="_blank" rel="noreferrer" className="research-link-chip" onClick={(event) => event.stopPropagation()}>{item.label}</a>
                        ))}
                      </div>
                    )}
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
