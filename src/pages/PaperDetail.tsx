import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { analyzeResearch, type ResearchEvidence } from '../lib/research-intelligence'
import { useAdminAuth } from '../lib/admin-auth'

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
  const { isAdmin } = useAdminAuth()
  if (!isAdmin) return null
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
    { key: 'applications', label: 'التطبيقات', value: arabicScientific(intelligence.applications), evidence: intelligence.fieldEvidence.applications },
    { key: 'contribution', label: 'الإضافة العلمية', value: arabicScientific(p.contribution || intelligence.contribution), evidence: intelligence.fieldEvidence.contribution },
    { key: 'limitations', label: 'القيود', value: arabicScientific(intelligence.limitations), evidence: intelligence.fieldEvidence.limitations },
  ].filter((item) => Boolean(item.value))
  const citationUrl = doiLink?.url || intelligence.links.find((item) => item.id === 'publisher')?.url || `${SITE_URL}/research/${p.slug}`
  const metadataCount = [topic, researchers, journal, year, doi, keywords].filter(Boolean).length
  const evidenceCount = Object.keys(intelligence.fieldEvidence).length

  const goToReaderCard = (card: ScientificCard) => {
    setReaderKey(card.key)
    window.requestAnimationFrame(() => document.getElementById(`research-card-${card.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const { isAdmin } = useAdminAuth()
  const [passportLayer, setPassportLayer] = useState<'layer1' | 'layer2' | 'layer3'>('layer2')
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  const toggleCard = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }))
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

      <article className="px-4 pb-24 pt-32 sm:px-6 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[960px]">
          <FadeUp>
            <div className="flex items-center justify-between gap-4">
              <Link to="/research" className="text-[.85rem] font-medium text-soft transition-colors hover:text-accent">← كل المساهمات العلمية</Link>
              <span className="rounded-full border border-hair bg-paper px-3 py-1 text-[.72rem] font-semibold text-accent">البصمة الأكاديمية v2.0</span>
            </div>
          </FadeUp>

          {/* 3-Level Academic Passport Hero */}
          <FadeUp delay={0.05}>
            <header className="research-hero mt-6 overflow-hidden rounded-[32px] border border-hair bg-paper p-6 shadow-xl md:p-10">
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-accent/10 px-3.5 py-1 text-[.72rem] font-extrabold text-accent">بحث محكّم</span>
                    {studyType && <span className="rounded-full border border-hair px-3.5 py-1 text-[.72rem] font-semibold text-ink">{studyType}</span>}
                    {evidenceCount > 0 && isAdmin && <span className="rounded-full border border-accent/20 bg-accent/[.04] px-3.5 py-1 text-[.72rem] font-bold text-accent">✓ {evidenceCount} أدلة موثّقة</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {year && <span className="font-display text-[.9rem] font-bold text-accent">{year}</span>}
                    {doi && <span className="rounded-md border border-hair bg-canvas px-2.5 py-1 text-[.68rem] font-mono text-soft">DOI: {doi}</span>}
                  </div>
                </div>

                <h1 dir="auto" className="mt-6 font-display text-[clamp(1.75rem,4.5vw,2.85rem)] font-extrabold leading-[1.42] text-ink"><Reveal>{p.title}</Reveal></h1>
                {p.titleAr && p.titleAr !== p.title && <p dir="rtl" className="mt-3 text-[1.05rem] font-light leading-[1.85] text-soft">{p.titleAr}</p>}
                <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />

                {/* Passport Navigation Bar (Level Selector) */}
                <div className="mt-8 grid gap-2 rounded-2xl border border-hair bg-canvas p-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => { setPassportLayer('layer1'); revealSection('metadata', 'research-passport-layer1') }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[.82rem] font-bold transition ${passportLayer === 'layer1' ? 'bg-accent text-white shadow-md' : 'text-soft hover:bg-paper hover:text-ink'}`}
                  >
                    <span>المستوى 1: الهوية والتوثيق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPassportLayer('layer2'); revealSection('science', 'research-passport-layer2') }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[.82rem] font-bold transition ${passportLayer === 'layer2' ? 'bg-accent text-white shadow-md' : 'text-soft hover:bg-paper hover:text-ink'}`}
                  >
                    <span>المستوى 2: الأبعاد المنهجية</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPassportLayer('layer3'); revealSection('sources', 'research-passport-layer3') }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[.82rem] font-bold transition ${passportLayer === 'layer3' ? 'bg-accent text-white shadow-md' : 'text-soft hover:bg-paper hover:text-ink'}`}
                  >
                    <span>المستوى 3: شبكة الأدلة والمصادر</span>
                  </button>
                </div>
              </div>
            </header>
          </FadeUp>

          {/* Layer 1: Visual Identity & Passport Stamp */}
          <div className="mt-7 grid gap-6">
            <FadeUp delay={0.09}>
              <div id="research-passport-layer1" className={`rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer1' ? 'ring-2 ring-accent/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
                  <div>
                    <span className="text-[.7rem] font-extrabold uppercase tracking-widest text-accent">Academic Level 1</span>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink">المستوى الأول: الهوية والتوثيق الأكاديمي</h2>
                  </div>
                  <EvidenceStamp fallback="ختم الاعتماد الأكاديمي" />
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">الموضوع الأساسي</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{topic || 'بحث أكاديمي محكّم'}</strong></div>
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">الباحث الرئيسي والشركاء</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{researchers}</strong></div>
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">جهة النشر / وعاء النشر</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{journal || 'مجلة علمية محكّمة'}</strong></div>
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">سنة الصدور</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{year || 'د.ت'}</strong></div>
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">المعرّف المعياري DOI</span><strong className="mt-1 block line-clamp-1 font-mono text-[.8rem] text-accent">{doi || 'مسجّل في قاعدة البيانات'}</strong></div>
                  {isAdmin && <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">حالة التدقيق والموثوقية</span><strong className="mt-1 block text-[.88rem] font-bold text-emerald-600">✓ موثق ومطابق للمصدر</strong></div>}
                </div>
              </div>
            </FadeUp>

            {/* Layer 2: Methodological Dimensions */}
            {dataCards.length > 0 && (
              <FadeUp delay={0.11}>
                <div id="research-passport-layer2" className={`rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer2' ? 'ring-2 ring-accent/40' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
                    <div>
                      <span className="text-[.7rem] font-extrabold uppercase tracking-widest text-accent">Academic Level 2</span>
                      <h2 className="mt-1 font-display text-xl font-bold text-ink">المستوى الثاني: الأبعاد المنهجية والأكاديمية</h2>
                    </div>
                    <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.72rem] font-semibold text-soft">{dataCards.length} أبعاد مستخرجة</span>
                  </div>

                  <div className="research-smart-reader mt-5" aria-label="قارئ البحث الذكي">
                    <div className="research-smart-reader-rail">
                      {dataCards.map((card, cardIndex) => (
                        <button key={card.key} type="button" onClick={() => goToReaderCard(card)} className={readerKey === card.key ? 'is-active' : ''}>
                          <span>{String(cardIndex + 1).padStart(2, '0')}</span>{card.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {dataCards.map((card) => {
                      const isExpanded = Boolean(expandedCards[card.key])
                      return (
                        <div id={`research-card-${card.key}`} key={card.key} className={`rounded-2xl border border-hair bg-canvas p-5 transition ${readerKey === card.key ? 'border-accent bg-accent/[.03] shadow-md' : ''}`}>
                          <div className="flex items-center justify-between gap-2 cursor-pointer" onClick={() => toggleCard(card.key)}>
                            <h3 className="text-[.8rem] font-bold text-accent">{card.label}</h3>
                            <button type="button" className="text-[.72rem] font-bold text-soft hover:text-accent">
                              {isExpanded ? 'إخفاء ▴' : 'عرض التفاصيل ▾'}
                            </button>
                          </div>
                          {isExpanded ? (
                            <>
                              <p className="mt-3 whitespace-pre-line text-[.9rem] leading-[1.9] text-ink">{card.value}</p>
                              <EvidenceStamp evidence={card.evidence} />
                            </>
                          ) : (
                            <p className="mt-2 text-[.82rem] text-soft line-clamp-1">{card.value}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </FadeUp>
            )}

            {/* Layer 3: Interactive Field Evidence & Citations Ledger */}
            <FadeUp delay={0.13}>
              <div id="research-passport-layer3" className={`rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer3' ? 'ring-2 ring-accent/40' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
                  <div>
                    <span className="text-[.7rem] font-extrabold uppercase tracking-widest text-accent">Academic Level 3</span>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink">المستوى الثالث: شبكة الأدلة والمراجع الأصيلة</h2>
                  </div>
                  <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.72rem] font-semibold text-soft">توثيق واقتباس أكاديمي</span>
                </div>

                {abstractAr && (
                  <div className="mt-6 rounded-2xl border border-hair bg-canvas p-6">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[.8rem] font-bold text-accent">الملخص التحريري العربي</strong>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-[.95rem] leading-[2] text-ink">{abstractAr}</p>
                    <EvidenceStamp evidence={intelligence.fieldEvidence.abstractAr} fallback="ملخص البحث الأصلي" />
                  </div>
                )}

                {sourceLinks.length > 0 && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {sourceLinks.map((item) => (
                      <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-hair bg-canvas px-5 py-4 transition hover:border-accent hover:bg-paper">
                        <span className="text-[.85rem] font-bold text-ink">{item.label}</span>
                        <span className="text-[.8rem] text-accent font-semibold">فتح المصدر الأصلي ↗</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="mt-6">
                  <CiteButton title={p.title} year={year || 'د.ت.'} container={journal || 'بحث محكّم'} url={citationUrl} authors={researchers} contextLabel="تصدير الاقتباس الأكاديمي" />
                </div>
              </div>
            </FadeUp>
          </div>

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
