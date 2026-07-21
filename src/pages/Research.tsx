import { JsonLd, useSeo } from '../components/seo'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead, SocialIcon } from '../components/ui'
import { academicProfiles, doctorate, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { Pagination, usePagedList } from '../components/Pagination'

const ar = (n: number) => String(n).padStart(2, '0').replace(/[0-9]/g, (d) => '0123456789'[+d])
const paperCount = (count: number) => {
  if (count === 1) return 'بحث واحد'
  if (count === 2) return 'بحثان'
  return `${count} بحثاً`
}

export default function Research() {
  const { papers } = useCmsContent()
  const paged = usePagedList(papers, 12, String(papers.length))
  const count = paperCount(papers.length)
  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} محكّماً في تكنولوجيا التعليم.` })
  return (
    <Page className="content-research page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/research#collection`,
        name: 'المساهمات العلمية',
        url: `${SITE_URL}/research`,
        inLanguage: 'ar',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: papers.length,
          itemListElement: papers.map((paper, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/research/${paper.slug}`, name: paper.title })),
        },
      }} />
      <PageHead label="المساهمات العلمية" title="الأثر العلمي." sub="أبحاث محكّمة تُسهم في تطوير ممارسات التعليم وتوظيف التكنولوجيا." />

      <section className="px-6 py-20 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="mb-5 text-[.8rem] text-soft">{count} في الأرشيف العلمي</p>
          </FadeUp>
          {/* ملفاي العلميان الرسميان — أيقونتان فقط بجوار الأرشيف، بلا سطر نصي طويل */}
          <FadeUp>
            <div className="mb-10 flex items-center justify-between border-b border-hair pb-6">
              <span className="text-[.78rem] text-soft">الملفات الأكاديمية الرسمية</span>
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
            {paged.pageItems.map((p, i) => (
              <FadeUp key={p.slug} delay={Math.min(i * 0.03, 0.3)}>
                <li className={i === 0 ? '' : 'border-t border-hair'}>
                  <Link to={`/research/${p.slug}`} className="group flex gap-6 py-6">
                    <span className="min-w-[40px] pt-1 font-display font-semibold text-soft transition-colors group-hover:text-accent">{ar((paged.page - 1) * 12 + i + 1)}</span>
                    <span>
                      <span dir="auto" className="block text-[1.14rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{p.title}</span>
                      {p.titleAr && <span dir="rtl" className="mt-1 block text-[.92rem] font-extralight leading-[1.8] text-soft/90">{p.titleAr}</span>}
                      {p.meta && <span className="mt-1.5 block text-[.8rem] text-soft">{p.meta}</span>}
                      {p.journal && <span className="mt-1 block text-[.78rem] text-soft transition-colors group-hover:text-accent">{p.journal}</span>}
                    </span>
                  </Link>
                </li>
              </FadeUp>
            ))}
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
