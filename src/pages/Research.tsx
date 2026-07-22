import { JsonLd, useSeo } from '../components/seo'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead, SocialIcon } from '../components/ui'
import { academicProfiles, doctorate, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { Pagination, usePagedList } from '../components/Pagination'
import { analyzeResearch } from '../lib/research-intelligence'

const ar = (n: number) => String(n).padStart(2, '0')
const paperCount = (count: number) => count === 1 ? 'بحث واحد' : count === 2 ? 'بحثان' : `${count} بحثاً`
const badge = 'inline-flex items-center rounded-full border border-hair bg-canvas/70 px-3 py-1.5 text-[.7rem] font-medium text-soft'

export default function Research() {
  const { papers } = useCmsContent()
  const paged = usePagedList(papers, 12, String(papers.length))
  const count = paperCount(papers.length)
  const fingerprints = papers.map((paper) => ({ paper, intelligence: analyzeResearch(paper) }))
  const reviewed = fingerprints.filter(({ intelligence }) => intelligence.reviewStatus === 'محكّم').length
  const withFindings = fingerprints.filter(({ intelligence }) => Boolean(intelligence.keyFinding)).length
  const methods = new Set(fingerprints.map(({ intelligence }) => intelligence.studyType).filter(Boolean)).size

  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} في تكنولوجيا التعليم والممارسة التربوية.` })
  return (
    <Page className="content-research page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/research#collection`,
        name: 'المساهمات العلمية', url: `${SITE_URL}/research`, inLanguage: 'ar',
        mainEntity: { '@type': 'ItemList', numberOfItems: papers.length, itemListElement: papers.map((paper, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/research/${paper.slug}`, name: paper.title })) },
      }} />
      <PageHead label="المساهمات العلمية" title="الأثر العلمي." sub="أبحاث محكّمة تتحول هنا من قائمة ملفات إلى معرفة قابلة للفهم والاستشهاد والتطبيق." />

      <section className="px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="grid gap-px overflow-hidden rounded-[28px] border border-hair bg-hair sm:grid-cols-3">
              <div className="bg-canvas p-5"><span className="text-[.72rem] text-soft">الأرشيف العلمي</span><strong className="mt-2 block font-display text-2xl text-ink">{count}</strong></div>
              <div className="bg-canvas p-5"><span className="text-[.72rem] text-soft">بطاقات موثقة النتيجة</span><strong className="mt-2 block font-display text-2xl text-ink">{withFindings} / {papers.length}</strong></div>
              <div className="bg-canvas p-5"><span className="text-[.72rem] text-soft">تنوع منهجي</span><strong className="mt-2 block font-display text-2xl text-ink">{methods} مسارات</strong></div>
            </div>
          </FadeUp>

          <FadeUp>
            <div className="mb-10 mt-8 flex items-center justify-between border-b border-hair pb-6">
              <div>
                <span className="text-[.78rem] text-soft">الملفات الأكاديمية الرسمية</span>
                <span className="mr-3 text-[.7rem] text-soft/70">{reviewed ? `${reviewed} بحثاً موثق التحكيم` : 'تُراجع حالة التحكيم من بيانات كل بحث'}</span>
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

          <ul id="research-list" className="scroll-mt-28">
            {paged.pageItems.map((p, i) => {
              const intelligence = analyzeResearch(p)
              const status = p.reviewStatus || intelligence.reviewStatus
              const type = p.studyType || intelligence.studyType
              const finding = p.keyFinding || intelligence.keyFinding
              const question = p.researchQuestion || intelligence.researchQuestion
              const score = p.evidenceScore || intelligence.evidenceScore
              return (
                <FadeUp key={p.slug} delay={Math.min(i * 0.03, 0.3)}>
                  <li className={i === 0 ? '' : 'border-t border-hair'}>
                    <Link to={`/research/${p.slug}`} className="group grid gap-4 py-8 sm:grid-cols-[48px_minmax(0,1fr)]">
                      <span className="pt-1 font-display font-semibold text-soft transition-colors group-hover:text-accent">{ar((paged.page - 1) * 12 + i + 1)}</span>
                      <span className="min-w-0">
                        <span className="mb-3 flex flex-wrap gap-2">
                          <span className={badge}>{status}</span>
                          <span className={badge}>{type}</span>
                          <span className={badge}>وضوح الدليل {score}/100</span>
                          {(p.doi || intelligence.doi) && <span className={badge}>DOI موثّق</span>}
                          {(p.openAccess || intelligence.openAccess) && <span className={badge}>وصول مباشر</span>}
                        </span>
                        <span dir="auto" className="block text-[1.14rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{p.title}</span>
                        {p.titleAr && <span dir="rtl" className="mt-1 block text-[.92rem] font-extralight leading-[1.8] text-soft/90">{p.titleAr}</span>}
                        {question && <span className="mt-4 block border-r-2 border-accent/45 pr-4 text-[.84rem] leading-[1.85] text-soft"><b className="font-semibold text-ink/80">السؤال:</b> {question}</span>}
                        {finding && <span className="mt-2 block pr-4 text-[.84rem] leading-[1.85] text-soft"><b className="font-semibold text-ink/80">أبرز نتيجة:</b> {finding}</span>}
                        <span className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[.76rem] text-soft/85">
                          {p.journal && <span>{p.journal}</span>}
                          {p.keywords && <span>{p.keywords}</span>}
                        </span>
                      </span>
                    </Link>
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
