import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { analyzeResearch, type ResearchEvidence } from '../lib/research-intelligence'

const cleanText = (value = '') => value.replace(/^ملخص عربي:\s*/, '').replace(/\s+/g, ' ').trim()
const arabicScientific = (value = '') => {
  const cleaned = cleanText(value)
  return /[\u0600-\u06ff]/.test(cleaned) ? cleaned : ''
}
type ResearchSection = 'metadata' | 'science' | 'sources'

type ScientificCard = {
  key: string
  label: string
  value: string
  evidence?: ResearchEvidence
}

function ResearchAccordion({
  id,
  eyebrow,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section id={id} className={`research-accordion scroll-mt-28 overflow-hidden rounded-[26px] border ${open ? 'is-open' : ''}`}>
      <button type="button" onClick={onToggle} className="research-accordion-trigger" aria-expanded={open} aria-controls={`${id}-panel`}>
        <span className="min-w-0 text-right">
          <span className="block text-[.72rem] font-extrabold text-accent">{eyebrow}</span>
          <span className="mt-1 block text-[1.02rem] font-bold text-ink">{title}</span>
          <span className="mt-1.5 block text-[.78rem] font-normal leading-[1.7] text-soft">{summary}</span>
        </span>
        <span aria-hidden className="research-accordion-icon">⌄</span>
      </button>
      <div id={`${id}-panel`} className="research-accordion-panel" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

function EvidenceStamp({ evidence, fallback = 'المصدر الأصلي' }: { evidence?: ResearchEvidence; fallback?: string }) {
  const label = evidence?.label || `موثّق من ${fallback}`
  return (
    <span className="research-evidence-stamp" title={evidence?.quote || label}>
      <span aria-hidden>✓</span>
      <span>{label}</span>
    </span>
  )
}

export default function PaperDetail() {
  const { slug } = useParams()
  const location = useLocation()
  const { papers, loading } = useCmsContent()
  const index = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[index]
  const [openSection, setOpenSection] = useState<ResearchSection | null>(null)
  const [readerKey, setReaderKey] = useState('')
  const intelligence = useMemo(() => analyzeResearch(p || {}), [p])

  useSeo({ title: p?.title ?? 'بحث', description: p?.abstractAr || p?.meta, path: `/research/${slug}`, type: 'article' })

  const revealSection = (section: ResearchSection, id: string) => {
    setOpenSection(section)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

  useEffect(() => {
    if (!p || location.hash !== '#research-passport') return
    revealSection('science', 'research-passport')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, p?.slug])

  if (!p && loading) return <Page className="content-research"><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!p) return <Page><div className="px-6 pt-44 text-center text-soft">صفحة البحث غير موجودة.</div></Page>

  const prev = papers[index - 1]
  const next = papers[index + 1]
  const year = intelligence.year
  const journal = p.journal || intelligence.journal
  const researchers = [profile.fullName, p.coAuthors].filter(Boolean).join('، ')
  const doi = p.doi || intelligence.doi
  const keywords = arabicScientific(p.keywords || intelligence.keywords)
  const topic = arabicScientific(intelligence.topic)
  const studyType = arabicScientific(p.studyType || intelligence.studyType)
  const abstractAr = arabicScientific(p.abstractAr)
  const doiLink = intelligence.links.find((item) => item.id === 'doi')
  const sourceLinks = intelligence.links.filter((item) => item.id !== 'doi')
  const dataCards: ScientificCard[] = [
    { key: 'researchQuestion', label: 'السؤال العلمي', value: arabicScientific(p.researchQuestion || intelligence.researchQuestion), evidence: intelligence.fieldEvidence.researchQuestion },
    { key: 'sample', label: 'العينة / نطاق الدراسة', value: arabicScientific(p.sample || intelligence.sample), evidence: intelligence.fieldEvidence.sample },
    { key: 'methodology', label: 'المنهج', value: arabicScientific(p.methodology || intelligence.methodology), evidence: intelligence.fieldEvidence.methodology },
    { key: 'studyType', label: 'نوع الدراسة', value: studyType, evidence: intelligence.fieldEvidence.studyType },
    { key: 'keyFinding', label: 'أبرز النتائج', value: arabicScientific(p.keyFinding || intelligence.keyFinding), evidence: intelligence.fieldEvidence.keyFinding },
    { key: 'applications', label: 'التطبيقات', value: arabicScientific(p.applications || intelligence.applications), evidence: intelligence.fieldEvidence.applications },
    { key: 'contribution', label: 'الإضافة العلمية', value: arabicScientific(p.contribution || intelligence.contribution), evidence: intelligence.fieldEvidence.contribution },
    { key: 'limitations', label: 'القيود', value: arabicScientific(p.limitations || intelligence.limitations), evidence: intelligence.fieldEvidence.limitations },
  ].filter((item) => Boolean(item.value))
  const citationUrl = doiLink?.url || intelligence.links.find((item) => item.id === 'publisher')?.url || `${SITE_URL}/research/${p.slug}`
  const metadataCount = [topic, researchers, journal, year, doi, keywords].filter(Boolean).length
  const evidenceCount = Object.keys(intelligence.fieldEvidence).length

  const goToReaderCard = (card: ScientificCard) => {
    setReaderKey(card.key)
    window.requestAnimationFrame(() => document.getElementById(`research-card-${card.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  return (
    <Page className="content-research research-detail-page">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ScholarlyArticle',
        '@id': `${SITE_URL}/research/${p.slug}#article`,
        headline: p.title,
        description: cleanText(p.abstractAr || p.meta || ''),
        datePublished: year ? `${year}-01-01` : undefined,
        inLanguage: 'ar',
        url: `${SITE_URL}/research/${p.slug}`,
        author: [
          { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: profile.fullName },
          ...(p.coAuthors ? [{ '@type': 'Person', name: p.coAuthors }] : []),
        ],
        isPartOf: journal ? { '@type': 'Periodical', name: journal } : undefined,
        sameAs: intelligence.links.map((item) => item.url),
        identifier: doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } : undefined,
        keywords: keywords || undefined,
        genre: studyType || undefined,
      }} />

      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[900px]">
          <FadeUp>
            <Link to="/research" className="text-[.85rem] font-medium text-soft transition-colors hover:text-accent">← كل المساهمات العلمية</Link>
          </FadeUp>

          <FadeUp delay={0.05}>
            <header className="research-hero mt-8 rounded-[30px] border px-6 py-7 md:px-9 md:py-9">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex flex-wrap gap-2">
                  <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">محكّم</span>
                  {studyType && <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">{studyType}</span>}
                  {evidenceCount > 0 && <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">{evidenceCount} أختام مصدر</span>}
                </div>
                {year && <span className="font-display text-[.84rem] font-bold text-accent">{year}</span>}
              </div>
              <h1 dir="auto" className="mt-5 font-display text-[clamp(1.65rem,4vw,2.65rem)] font-bold leading-[1.48] text-ink"><Reveal>{p.title}</Reveal></h1>
              {p.titleAr && p.titleAr !== p.title && <p dir="rtl" className="mt-3 text-[1.02rem] font-light leading-[1.9] text-soft">{p.titleAr}</p>}
              <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />
              <div className="mt-7 flex flex-wrap gap-3">
                {dataCards.length > 0 && <button type="button" onClick={() => revealSection('science', 'research-passport')} className="research-primary-link">افهم هذا البحث ←</button>}
                {(abstractAr || sourceLinks.length > 0) && <button type="button" onClick={() => revealSection('sources', 'research-sources')} className="research-secondary-link">المصادر الأصلية</button>}
              </div>
            </header>
          </FadeUp>

          <div className="mt-7 grid gap-4">
            {metadataCount > 0 && (
              <FadeUp delay={0.09}>
                <ResearchAccordion id="research-metadata" eyebrow="هوية البحث" title="البيانات التوثيقية" summary={`${metadataCount} عناصر موثقة — تُفتح عند الحاجة فقط`} open={openSection === 'metadata'} onToggle={() => setOpenSection((value) => value === 'metadata' ? null : 'metadata')}>
                  <dl className="research-meta-panel grid gap-px sm:grid-cols-2">
                    {topic && <div className="research-meta-cell"><dt>الموضوع</dt><dd>{topic}</dd><EvidenceStamp evidence={intelligence.fieldEvidence.topic} /></div>}
                    <div className="research-meta-cell"><dt>الباحثون</dt><dd>{researchers}</dd><EvidenceStamp fallback="بيانات المؤلف" /></div>
                    {journal && <div className="research-meta-cell"><dt>المجلة</dt><dd dir="auto">{journal}</dd><EvidenceStamp evidence={intelligence.fieldEvidence.journal} fallback="بيانات النشر" /></div>}
                    {year && <div className="research-meta-cell"><dt>سنة النشر</dt><dd>{year}</dd><EvidenceStamp evidence={intelligence.fieldEvidence.year} fallback="بيانات النشر" /></div>}
                    {doi && <div className="research-meta-cell"><dt>المعرّف الرقمي DOI</dt><dd dir="ltr" className="break-all text-left">{doiLink ? <a href={doiLink.url} target="_blank" rel="noreferrer" className="research-inline-source">{doi} ↗</a> : doi}</dd><EvidenceStamp evidence={intelligence.fieldEvidence.doi} fallback="DOI / Crossref" /></div>}
                    {keywords && <div className="research-meta-cell sm:col-span-2"><dt>الكلمات المفتاحية</dt><dd>{keywords}</dd><EvidenceStamp evidence={intelligence.fieldEvidence.keywords} /></div>}
                  </dl>
                </ResearchAccordion>
              </FadeUp>
            )}

            {dataCards.length > 0 && (
              <FadeUp delay={0.11}>
                <ResearchAccordion id="research-passport" eyebrow="القراءة العلمية" title="البيانات العلمية الكاملة" summary={`${dataCards.length} محاور مستخرجة من البحث ومصادره الأصلية`} open={openSection === 'science'} onToggle={() => setOpenSection((value) => value === 'science' ? null : 'science')}>
                  <div className="research-smart-reader" aria-label="قارئ البحث الذكي">
                    <div className="research-smart-reader-head">
                      <span><strong>قارئ البحث الذكي</strong><small>انتقل مباشرة إلى المحور الذي تريده</small></span>
                      <span className="research-smart-reader-count">{dataCards.length} محاور</span>
                    </div>
                    <div className="research-smart-reader-rail">
                      {dataCards.map((card, cardIndex) => (
                        <button key={card.key} type="button" onClick={() => goToReaderCard(card)} className={readerKey === card.key ? 'is-active' : ''}>
                          <span>{String(cardIndex + 1).padStart(2, '0')}</span>{card.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="research-passport-grid grid gap-px sm:grid-cols-2">
                    {dataCards.map((card) => (
                      <div id={`research-card-${card.key}`} key={card.key} className={`research-data-card min-w-0 scroll-mt-32 p-5 md:p-6 ${readerKey === card.key ? 'is-reader-active' : ''}`}>
                        <h3 className="text-[.75rem] font-bold text-accent">{card.label}</h3>
                        <p className="mt-2 whitespace-pre-line break-words text-[.92rem] leading-[1.95] text-ink [overflow-wrap:anywhere]">{card.value}</p>
                        <EvidenceStamp evidence={card.evidence} />
                      </div>
                    ))}
                  </div>
                </ResearchAccordion>
              </FadeUp>
            )}

            {(abstractAr || sourceLinks.length > 0) && (
              <FadeUp delay={0.13}>
                <ResearchAccordion id="research-sources" eyebrow="النص والمصادر" title="الملخص والروابط الأصلية" summary={`${abstractAr ? 'الملخص العربي الكامل' : ''}${abstractAr && sourceLinks.length ? ' · ' : ''}${sourceLinks.length ? `${sourceLinks.length} روابط مباشرة` : ''}`} open={openSection === 'sources'} onToggle={() => setOpenSection((value) => value === 'sources' ? null : 'sources')}>
                  {abstractAr && (
                    <div className="research-abstract px-6 py-6 md:px-7">
                      <p className="text-[.76rem] font-bold text-accent">الملخص</p>
                      <p className="mt-3 whitespace-pre-line text-[.96rem] font-normal leading-[2] text-ink">{abstractAr}</p>
                      <EvidenceStamp evidence={intelligence.fieldEvidence.abstractAr} fallback="ملخص البحث" />
                    </div>
                  )}
                  {sourceLinks.length > 0 && (
                    <nav className="research-source-grid border-t border-hair px-6 py-6 md:px-7" aria-label="روابط البحث">
                      {sourceLinks.map((item) => (
                        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="research-source-card"><span>{item.label}</span><span aria-hidden>↗</span></a>
                      ))}
                    </nav>
                  )}
                </ResearchAccordion>
              </FadeUp>
            )}
          </div>

          <FadeUp delay={0.15}>
            <CiteButton title={p.title} year={year || 'د.ت.'} container={journal || 'بحث محكّم'} url={citationUrl} authors={researchers} contextLabel="فتح مصدر البحث" />
          </FadeUp>

          <FadeUp>
            <nav className="mt-16 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
              {prev ? <Link to={`/research/${prev.slug}`} className="group"><span className="text-[.78rem] text-soft">السابق</span><span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{prev.title}</span></Link> : <span />}
              {next && <Link to={`/research/${next.slug}`} className="group sm:text-left"><span className="text-[.78rem] text-soft">التالي</span><span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{next.title}</span></Link>}
            </nav>
          </FadeUp>
        </div>
      </article>
    </Page>
  )
}
