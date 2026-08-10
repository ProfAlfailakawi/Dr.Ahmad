import { useMemo, useState } from 'react'
import { JsonLd, useSeo } from '../components/seo'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { FadeUp, Page, PageHead, SocialIcon, sharedViewName } from '../components/ui'
import { doctorate, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { Pagination, usePagedList } from '../components/Pagination'
import { analyzeResearch, researchArchiveProjection } from '../lib/research-intelligence'
import { arabicCountPhrase, PAPER_FORMS, RESULT_FORMS } from '../lib/arabic-count.ts'

const ar = (n: number) => String(n).padStart(2, '0')
const paperCount = (count: number) => arabicCountPhrase(count, PAPER_FORMS)
const badge = 'research-badge editorial-micro-label inline-flex items-center text-[.72rem] font-semibold'
const arabicOnly = (value = '') => /[\u0600-\u06ff]/.test(value) ? value.trim() : ''
const normalizeSearch = (value = '') => value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export default function Research() {
  const { papers } = useCmsContent()
  const reduce = useReducedMotion()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('الكل')
  const [yearFilter, setYearFilter] = useState('الكل')
  const indexed = useMemo(() => papers.map((paper) => ({ paper, projection: researchArchiveProjection(paper) })), [papers])
  const types = useMemo(() => ['الكل', ...Array.from(new Set(indexed.map(({ projection }) => arabicOnly(projection.studyType)).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ar'))], [indexed])
  const years = useMemo(() => ['الكل', ...Array.from(new Set(indexed.map(({ projection }) => projection.year).filter(Boolean))).sort((left, right) => right.localeCompare(left))], [indexed])
  const term = normalizeSearch(query)
  const filtered = useMemo(() => indexed.filter(({ projection }) => {
    if (typeFilter !== 'الكل' && projection.studyType !== typeFilter) return false
    if (yearFilter !== 'الكل' && projection.year !== yearFilter) return false
    if (!term) return true
    return projection.searchText.includes(term)
  }), [indexed, term, typeFilter, yearFilter])
  const paged = usePagedList(filtered, 12, `${papers.length}|${term}|${typeFilter}|${yearFilter}`)
  const count = paperCount(papers.length)

  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} في تكنولوجيا التعليم والممارسة التربوية.` })
  return (
    <Page className="content-research page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/research#collection`,
        name: 'المساهمات العلمية', url: `${SITE_URL}/research`, inLanguage: 'ar',
        mainEntity: { '@type': 'ItemList', numberOfItems: papers.length, itemListElement: papers.slice(0, 100).map((paper, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/research/${paper.slug}`, name: paper.title })) },
      }} />
      <PageHead label="المساهمات العلمية" title="مسارٌ من السؤال إلى الدليل." sub="الأرشيف العلمي المحكّم يكشف سؤال كل دراسة ومنهجها ونتيجتها وحدودها، مع وصول مباشر إلى بياناتها بمصادر أصلية." />

      <section className="editorial-breath-section px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp delay={0.04}>
            <section className="research-index-panel" aria-label="الفهرسة الداخلية للأبحاث">
              <div className="research-index-search">
                <label htmlFor="research-index-input">فهرسة داخلية قوية</label>
                <div className="research-index-input-wrap">
                  <input id="research-index-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث: عنوان، باحث، كلمة مفتاحية" />
                  <span aria-hidden><SocialIcon name="Search" size={15} /></span>
                </div>
              </div>
              <div className="research-index-filters">
                <label>نوع الدراسة
                  <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    {types.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label>سنة النشر
                  <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                    {years.map((year) => <option key={year}>{year}</option>)}
                  </select>
                </label>
                <span className="research-index-result">{arabicCountPhrase(filtered.length, RESULT_FORMS)}</span>
              </div>
            </section>
          </FadeUp>

          <motion.ul key={`research:${term}:${typeFilter}:${yearFilter}:${paged.page}`} initial={reduce ? false : { opacity: .55 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : .16 }} id="research-list" className="spatial-collection mt-6 grid scroll-mt-28 gap-4">
            {paged.pageItems.map(({ paper: p, projection }, i) => {
              const intelligence = analyzeResearch(p)
              const type = arabicOnly(p.studyType || projection.studyType || intelligence.studyType)
              const year = projection.year || intelligence.year
              const journal = p.journal || intelligence.journal
              return (
                <li key={p.slug} className="research-list-card research-editorial-row spatial-card overflow-hidden border">
                    <div className="grid gap-4 p-5 sm:grid-cols-[48px_minmax(0,1fr)] sm:items-start md:p-7">
                      <span className="pt-1 font-display text-[.86rem] font-bold text-accent sm:self-start">{ar((paged.page - 1) * 12 + i + 1)}</span>
                      <div className="min-w-0">
                        {type && <div className="mb-3 flex flex-wrap gap-2"><span className={badge}>{type}</span></div>}
                        <Link to={`/research/${p.slug}`} viewTransition dir="auto" style={{ viewTransitionName: sharedViewName('paper-title', p.slug) }} className="research-title-link measure block text-[1.12rem] font-bold leading-[1.65] text-ink transition-colors hover:text-accent">{p.title}</Link>
                        {p.titleAr && p.titleAr !== p.title && <p dir="rtl" className="measure mt-1 text-[.92rem] font-light leading-[1.8] text-soft">{p.titleAr}</p>}
                        {(journal || year) && (
                          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[.74rem] text-soft">
                            {journal && <span dir="auto">{journal}</span>}
                            {year && <span className="font-semibold text-accent">{year}</span>}
                          </p>
                        )}
                        <Link to={`/research/${p.slug}#research-passport`} className="research-understand-link mt-4 inline-flex">افهم هذا البحث <span aria-hidden>←</span></Link>
                      </div>
                    </div>
                  </li>
              )
            })}
          </motion.ul>

          {filtered.length === 0 && <div className="py-16 text-center text-[.95rem] text-soft">جرّب كلمة أخرى أو أعد الفلاتر إلى «الكل».</div>}

          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filtered.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="research-list" label="صفحات الأبحاث" className="mt-8" />

          <FadeUp delay={0.15}>
            <div className="mt-16 border-t border-hair pt-9">
              <span className="text-[.76rem] font-semibold text-soft">أطروحة الدكتوراه</span>
              <h2 className="measure mt-4 text-[1.1rem] font-medium leading-[1.75] text-ink">{doctorate.title}</h2>
              <p className="measure mt-4 text-[.92rem] text-soft">{doctorate.university}</p>
              <p className="measure mt-1 text-[.92rem] text-soft">{doctorate.note}</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
