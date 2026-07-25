import { useMemo, useState } from 'react'
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
const normalizeSearch = (value = '') => value.toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export default function Research() {
  const { papers } = useCmsContent()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('الكل')
  const [yearFilter, setYearFilter] = useState('الكل')
  const indexed = useMemo(() => papers.map((paper) => ({ paper, intelligence: analyzeResearch(paper) })), [papers])
  const types = useMemo(() => ['الكل', ...Array.from(new Set(indexed.map(({ intelligence }) => arabicOnly(intelligence.studyType)).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ar'))], [indexed])
  const years = useMemo(() => ['الكل', ...Array.from(new Set(indexed.map(({ intelligence }) => intelligence.year).filter(Boolean))).sort((left, right) => right.localeCompare(left))], [indexed])
  const term = normalizeSearch(query)
  const filtered = useMemo(() => indexed.filter(({ intelligence }) => {
    if (typeFilter !== 'الكل' && intelligence.studyType !== typeFilter) return false
    if (yearFilter !== 'الكل' && intelligence.year !== yearFilter) return false
    if (!term) return true
    return intelligence.searchText.includes(term)
  }), [indexed, term, typeFilter, yearFilter])
  const paged = usePagedList(filtered, 12, `${papers.length}|${term}|${typeFilter}|${yearFilter}`)
  const count = paperCount(papers.length)

  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} محكّماً في تكنولوجيا التعليم والممارسة التربوية.` })
  return (
    <Page className="content-research page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${SITE_URL}/research#collection`,
        name: 'المساهمات العلمية', url: `${SITE_URL}/research`, inLanguage: 'ar',
        mainEntity: { '@type': 'ItemList', numberOfItems: papers.length, itemListElement: papers.map((paper, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/research/${paper.slug}`, name: paper.title })) },
      }} />
      <PageHead label="المساهمات العلمية" title="مسارٌ من السؤال إلى الدليل." sub="أبحاثٌ محكّمة تكشف سؤال كل دراسة ومنهجها ونتيجتها وحدودها، مع وصول مباشر إلى بياناتها ومصادرها الأصلية." />

      <section className="px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-5 border-b border-hair pb-6">
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

          <FadeUp delay={0.04}>
            <section className="research-index-panel" aria-label="الفهرسة الداخلية للأبحاث">
              <div className="research-index-search">
                <label htmlFor="research-index-input">فهرسة داخلية قوية</label>
                <div className="research-index-input-wrap">
                  <input id="research-index-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالعنوان، الباحث، الكلمات المفتاحية، المنهج، العينة، المجلة أو DOI…" />
                  <span aria-hidden>⌕</span>
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
                <span className="research-index-result">{filtered.length} نتيجة</span>
              </div>
            </section>
          </FadeUp>

          <ul id="research-list" className="mt-6 grid scroll-mt-28 gap-4">
            {paged.pageItems.map(({ paper: p, intelligence }, i) => {
              const type = arabicOnly(p.studyType || intelligence.studyType)
              const year = intelligence.year
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
                          {intelligence.fieldEvidence.sample && <span className={badge}>مصادر موثقة</span>}
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

          {filtered.length === 0 && <div className="py-16 text-center text-[.95rem] text-soft">جرّب كلمة أخرى أو أعد الفلاتر إلى «الكل».</div>}

          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filtered.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="research-list" label="صفحات الأبحاث" className="mt-8" />

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
