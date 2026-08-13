import { useCallback, useMemo, useState } from 'react'
import { JsonLd, useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router'
import { EASE, Page, PageHead, sharedViewName } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { SITE_URL } from '../data'
import { Pagination, usePagedList } from '../components/Pagination'
import { BooksAtlas } from '../components/BooksAtlas'
import { SocialIcon } from '../components/icons'
import { ClarifiedIconAction } from '../components/ClarifiedIconAction'
import { arabicCountPhrase, BOOK_PLAIN_FORMS } from '../lib/arabic-count.ts'
import { BookTerrain } from '../components/BookTerrain'
import { coverSrcSet } from '../lib/cover-image'
import { ContextualViewer } from '../components/ContextualViewer'

const bookCount = (count: number) => arabicCountPhrase(count, BOOK_PLAIN_FORMS)

export default function Publications() {
  /* الغلاف يُجلى حين يصل فعلاً — لا قبله، فلا يُرى وميضُ إطارٍ فارغ. */
  const [settled, setSettled] = useState<Set<string>>(new Set())
  const markSettled = useCallback((slug: string) => {
    setSettled((current) => current.has(slug) ? current : new Set(current).add(slug))
  }, [])

  const { books } = useCmsContent()
  const [searchParams, setSearchParams] = useSearchParams()
  const orderedBooks = useMemo(
    () => [...books].sort((left, right) => Number(right.slug === 'encyclopedia') - Number(left.slug === 'encyclopedia')),
    [books],
  )
  const paged = usePagedList(orderedBooks, 12, String(orderedBooks.length))
  const selectedSlug = searchParams.get('book') || ''
  const selectedIndex = orderedBooks.findIndex((book) => book.slug === selectedSlug)
  const selectedBook = selectedIndex >= 0 ? orderedBooks[selectedIndex] : undefined
  const setSelectedBook = (slug: string, replace = true) => {
    const next = new URLSearchParams(searchParams)
    if (slug) next.set('book', slug)
    else next.delete('book')
    setSearchParams(next, { replace })
  }
  const bookPreviewHref = (slug: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('book', slug)
    return `?${next.toString()}`
  }
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
      <section className="overflow-hidden px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-20 sm:px-6 md:px-11 md:py-24">
        <div id="books-grid" className="spatial-collection mobile-card-rail scroll-mt-28 mx-auto grid w-full max-w-shell min-w-0 grid-cols-2 gap-x-4 gap-y-8 sm:gap-8 lg:gap-10">
          {paged.pageItems.map((b, i) => {
            const right = b
            const featured = right.slug === 'encyclopedia'
            return (
              <motion.div
                key={b.slug}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.35), ease: EASE }}
                className={featured ? 'group col-span-2 spatial-card min-w-0 !w-full !max-w-none !flex-auto' : 'group col-span-1 spatial-card min-w-0 !w-full !max-w-none !flex-auto'}
                data-featured-encyclopedia={featured ? 'true' : undefined}
              >
                {featured ? (
                  <div className="group/portal flex w-full flex-col overflow-hidden rounded-[24px] border border-accent/[.15] bg-paper shadow-lg transition-shadow duration-500 hover:shadow-xl md:grid md:grid-cols-[1.1fr_1fr] md:items-center md:gap-8 lg:gap-12 md:p-8">
                    <Link to={bookPreviewHref(b.slug)} className="block w-full overflow-hidden bg-white md:rounded-2xl" aria-label={`معاينة كتاب ${b.title}`} style={{ aspectRatio: '1024 / 700', viewTransitionName: sharedViewName('book-cover', b.slug) }}>
                      {b.cover ? <img decoding="async" src={b.cover} srcSet={coverSrcSet(b.cover)} sizes="(max-width: 640px) 45vw, 420px" alt={b.title} loading="eager" width="1024" height="700" className="h-full w-full object-contain p-2 transition-transform duration-700 group-hover/portal:scale-[1.02]" /> : <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>}
                    </Link>
                    <div className="relative flex flex-col p-5 sm:p-8 md:p-0">
                      <BookTerrain slug={b.slug} title={b.title} compact />
                      <div className="pe-14 sm:pe-16 md:pe-0">
                        <Link to={`/publications/${b.slug}`} viewTransition className="min-w-0 block">
                          <h2 style={{ viewTransitionName: sharedViewName('book-title', b.slug) }} className="font-display text-2xl font-extrabold leading-[1.35] text-ink transition-colors hover:text-accent md:text-3xl lg:text-4xl">{b.title}</h2>
                        </Link>
                      </div>
                      <div className="absolute left-5 top-5 sm:left-8 sm:top-8 md:static md:mt-0">
                        <div className="md:hidden">
                          <ClarifiedIconAction id="book-search-featured" label="ابحث داخل هذا الكتاب">
                            <Link to={`/search?tab=askbook&book=${encodeURIComponent(b.slug)}`} aria-label={`ابحث داخل كتاب ${b.title}`} title="ابحث في هذا الكتاب" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/[.28] bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                              <SocialIcon name="Search" size={16} />
                            </Link>
                          </ClarifiedIconAction>
                        </div>
                      </div>
                      
                      <div className="hidden md:flex md:absolute md:left-0 md:top-0">
                         <ClarifiedIconAction id="book-search-featured-desktop" label="ابحث داخل هذا الكتاب">
                            <Link to={`/search?tab=askbook&book=${encodeURIComponent(b.slug)}`} aria-label={`ابحث داخل كتاب ${b.title}`} title="ابحث في هذا الكتاب" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent/[.28] bg-canvas text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white">
                              <SocialIcon name="Search" size={18} />
                            </Link>
                          </ClarifiedIconAction>
                      </div>
                      
                    </div>
                  </div>
                ) : (
                  <>
                    <Link to={bookPreviewHref(b.slug)} className="block" aria-label={`معاينة كتاب ${b.title}`}>
                      <div className="group spatial-media overflow-hidden rounded-xl border border-hair bg-white" style={{ aspectRatio: '1024 / 700', viewTransitionName: sharedViewName('book-cover', b.slug), ['--spatial-image' as string]: b.cover ? `url(${b.cover})` : 'none' }}>
                        {b.cover ? <img decoding="async" src={b.cover} srcSet={coverSrcSet(b.cover)} sizes="(max-width: 640px) 45vw, 340px" alt={b.title} loading="lazy" width="1024" height="700" className={`plate h-full w-full object-contain p-1${settled.has(b.slug) ? ' plate--settled' : ''}`} style={{ ['--plate-delay' as string]: `${Math.min(i, 6) * 90}ms` }} onLoad={() => markSettled(b.slug)} ref={(node) => { if (node?.complete) markSettled(b.slug) }} /> : <div className="flex h-full items-center justify-center bg-wash px-8 text-center font-display text-[1.1rem] font-semibold text-soft">{b.title}</div>}
                      </div>
                    </Link>
                    <BookTerrain slug={b.slug} title={b.title} compact />
                    <div className="mt-3 flex items-start gap-2 sm:mt-5">
                      <Link to={`/publications/${b.slug}`} viewTransition className="min-w-0 flex-1"><h2 style={{ viewTransitionName: sharedViewName('book-title', b.slug) }} className="break-words font-display text-[1rem] font-medium leading-[1.45] text-ink transition-colors hover:text-accent sm:text-[1.2rem] md:text-[1.3rem]">{b.title}</h2></Link>
                      <ClarifiedIconAction id="book-search-list" label="ابحث داخل هذا الكتاب"><Link to={`/search?tab=askbook&book=${encodeURIComponent(b.slug)}`} aria-label={`ابحث داخل كتاب ${b.title}`} title="ابحث في هذا الكتاب" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/[.35] text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"><SocialIcon name="Search" size={14} /></Link></ClarifiedIconAction>
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

      <ContextualViewer
        open={Boolean(selectedBook)}
        onClose={() => setSelectedBook('')}
        eyebrow={selectedBook?.year ? `كتاب · ${selectedBook.year}` : 'من المؤلفات'}
        title={selectedBook?.title || ''}
        description={selectedBook?.desc || selectedBook?.longDescription}
        visual={selectedBook?.cover ? <div className="book-context-cover"><img src={selectedBook.cover} srcSet={coverSrcSet(selectedBook.cover)} sizes="(max-width: 720px) 92vw, 62vw" alt={`غلاف ${selectedBook.title}`} decoding="async" /></div> : <div className="context-viewer-empty"><span>{selectedBook?.title}</span></div>}
        onPrevious={selectedIndex > 0 ? () => setSelectedBook(orderedBooks[selectedIndex - 1].slug, false) : undefined}
        onNext={selectedIndex >= 0 && selectedIndex < orderedBooks.length - 1 ? () => setSelectedBook(orderedBooks[selectedIndex + 1].slug, false) : undefined}
        position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${orderedBooks.length}` : undefined}
        footer={selectedBook ? <div className="flex flex-wrap gap-3">
          <Link to={`/publications/${selectedBook.slug}`} viewTransition className="context-viewer-primary">افتح صفحة الكتاب ←</Link>
          <Link to={`/search?tab=askbook&book=${encodeURIComponent(selectedBook.slug)}`} className="context-viewer-secondary"><SocialIcon name="Search" size={14} /> ابحث داخله</Link>
        </div> : undefined}
      >
        {selectedBook && <dl className="context-viewer-facts">
          {selectedBook.publisher && <div><dt>الناشر</dt><dd>{selectedBook.publisher}</dd></div>}
          {selectedBook.edition && <div><dt>الطبعة</dt><dd>{selectedBook.edition}</dd></div>}
          {selectedBook.isbn && <div><dt>ISBN</dt><dd dir="ltr">{selectedBook.isbn}</dd></div>}
        </dl>}
      </ContextualViewer>
    </Page>
  )
}
