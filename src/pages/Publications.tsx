import { JsonLd, useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { SITE_URL } from '../data'
import { Pagination, usePagedList } from '../components/Pagination'
import { BooksAtlas } from '../components/BooksAtlas'

const bookCount = (count: number) => {
  if (count === 1) return 'كتاب واحد'
  if (count === 2) return 'كتابان'
  return `${count} كتب`
}

export default function Publications() {
  const { books } = useCmsContent()
  const paged = usePagedList(books, 12, String(books.length))
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
          numberOfItems: books.length,
          itemListElement: books.map((book, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/publications/${book.slug}`, name: book.title })),
        },
      }} />
      <PageHead label="المؤلفات العلمية والفكرية" title="كتبٌ تبني مشروعاً واحداً." sub={`${count} ترسم مساراً بدأ عام 2015؛ من التعليم والتكنولوجيا إلى أسئلة التحول المجتمعي ومكان الإنسان في العصر الرقمي.`} />
      <section className="overflow-hidden px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 md:px-11 md:py-24">
        <div id="books-grid" className="mobile-card-rail scroll-mt-28 mx-auto grid w-full max-w-shell min-w-0 grid-cols-2 gap-x-4 gap-y-8 sm:gap-8 lg:grid-cols-3 lg:gap-10">
          {paged.pageItems.map((b, i) => (
            <motion.div
              key={b.slug}
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
              className="group min-w-0"
            >
              <Link to={`/publications/${b.slug}`} viewTransition className="block">
                <div className="group overflow-hidden rounded-xl border border-hair bg-white" style={{ aspectRatio: '1024 / 700' }}>
                  {b.cover ? (
                    <img src={b.cover} alt={b.title} loading="lazy" width="1024" height="700" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>
                  )}
                </div>
                <h2 className="mt-3 break-words font-display text-[1rem] font-medium leading-[1.45] text-ink sm:mt-5 sm:text-[1.2rem] md:text-[1.3rem]">{b.title}</h2>
                {b.isbn && <span className="mt-1 block text-[.78rem] text-soft">ردمك {b.isbn}</span>}
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-shell"><Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={books.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="books-grid" label="صفحات الكتب" /></div>
      </section>

      {/* خريطة المؤلَّفات: تأتي بعد الأغلفة لا قبلها — الكتب أولاً، ثم بنيتها. */}
      <BooksAtlas />
    </Page>
  )
}
