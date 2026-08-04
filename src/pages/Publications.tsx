import { useMemo } from 'react'
import { JsonLd, useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { SITE_URL } from '../data'
import { Pagination, usePagedList } from '../components/Pagination'
import { BooksAtlas } from '../components/BooksAtlas'
import { SocialIcon } from '../components/icons'
import { arabicCountPhrase, BOOK_PLAIN_FORMS } from '../lib/arabic-count.ts'

const bookCount = (count: number) => arabicCountPhrase(count, BOOK_PLAIN_FORMS)

export default function Publications() {
  const { books } = useCmsContent()
  const orderedBooks = useMemo(
    () => [...books].sort((left, right) => Number(right.slug === 'encyclopedia') - Number(left.slug === 'encyclopedia')),
    [books],
  )
  const paged = usePagedList(orderedBooks, 12, String(orderedBooks.length))
  const count = bookCount(books.length)
  useSeo({ title: 'الكتب المنشورة', path: '/publications', description: `${count} ضمن مشروع علمي وفكري بدأ عام 2015، ويتتبع التعليم والتكنولوجيا والتحول المجتمعي وأثرها في الإنسان.` })
  const reduce = useReducedMotion()
  return (
    <Page className="content-books page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        '@id': `${SITE_URL}/publications#collection`,
        name: 'الكتب المنشورة',
        url: `${SITE_URL}/publications`,
        inLanguage: 'ar',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: orderedBooks.length,
          itemListElement: orderedBooks.map((book, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/publications/${book.slug}`, name: book.title })),
        },
      }} />
      <PageHead label="المؤلفات العلمية والفكرية" title="كتبٌ تبني مشروعاً واحداً." sub={`${count} ترسم مساراً بدأ عام 2015؛ من التعليم والتكنولوجيا إلى أسئلة التحول المجتمعي ومكان الإنسان في العصر الرقمي.`} />
      <section className="overflow-hidden px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:px-11 md:py-24">
        <div id="books-grid" className="mobile-card-rail scroll-mt-28 mx-auto grid w-full max-w-shell min-w-0 grid-cols-2 gap-x-4 gap-y-8 sm:gap-8 lg:gap-10">
          {paged.pageItems.map((b, i) => {
            const featured = b.slug === 'encyclopedia'
            return (
              <motion.div
                key={b.slug}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
                className={featured ? 'group col-span-2 min-w-0' : 'group min-w-0'}
                data-featured-encyclopedia={featured ? 'true' : undefined}
              >
                {featured ? (
                  <div className="overflow-hidden rounded-2xl border border-accent/25 bg-wash/40 p-3 sm:p-5 md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(15rem,.65fr)] md:items-stretch md:gap-6">
                    <Link to={`/publications/${b.slug}`} viewTransition className="block overflow-hidden rounded-xl border border-hair bg-white" style={{ aspectRatio: '1024 / 700' }}>
                      {b.cover ? <img src={b.cover} alt={b.title} loading="eager" width="1024" height="700" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>}
                    </Link>
                    <div className="flex min-w-0 flex-col justify-center px-1 pb-1 pt-5 md:p-2">
                      <span className="w-fit rounded-full border border-accent/25 bg-canvas px-3 py-1 text-[.62rem] font-semibold text-accent">الكتاب المحوري في المشروع</span>
                      <Link to={`/publications/${b.slug}`} viewTransition className="mt-4 block">
                        <h2 className="font-display text-[1.35rem] font-semibold leading-[1.5] text-ink transition-colors hover:text-accent sm:text-[1.7rem]">{b.title}</h2>
                      </Link>
                      <p className="mt-3 max-w-[34rem] text-[.75rem] leading-[1.9] text-soft">الموسوعة المرئية والكتاب ومواد التدريس في بوابة معرفية واحدة، مع بحث يصل إلى الفصل والصفحة واللحظة الزمنية الموثقة.</p>
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <Link to={`/publications/${b.slug}`} viewTransition className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.72rem] font-semibold text-white"><span>ادخل الموسوعة</span><SocialIcon name="ArrowBack" size={14} /></Link>
                        <Link to={`/search?tab=askbook&book=${encodeURIComponent(b.slug)}`} aria-label={`ابحث داخل كتاب ${b.title}`} title="ابحث في هذا الكتاب" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-accent/[.35] text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="Search" size={15} /></Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link to={`/publications/${b.slug}`} viewTransition className="block">
                      <div className="group overflow-hidden rounded-xl border border-hair bg-white" style={{ aspectRatio: '1024 / 700' }}>
                        {b.cover ? <img src={b.cover} alt={b.title} loading="lazy" width="1024" height="700" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>}
                      </div>
                    </Link>
                    <div className="mt-3 flex items-start gap-2 sm:mt-5">
                      <Link to={`/publications/${b.slug}`} viewTransition className="min-w-0 flex-1"><h2 className="break-words font-display text-[1rem] font-medium leading-[1.45] text-ink transition-colors hover:text-accent sm:text-[1.2rem] md:text-[1.3rem]">{b.title}</h2></Link>
                      <Link to={`/search?tab=askbook&book=${encodeURIComponent(b.slug)}`} aria-label={`ابحث داخل كتاب ${b.title}`} title="ابحث في هذا الكتاب" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/[.35] text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="Search" size={14} /></Link>
                    </div>
                  </>
                )}
              </motion.div>
            )
          })}
        </div>
        <div className="mx-auto mt-10 max-w-shell"><Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={books.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="books-grid" label="صفحات الكتب" /></div>
      </section>

      <BooksAtlas />
    </Page>
  )
}
