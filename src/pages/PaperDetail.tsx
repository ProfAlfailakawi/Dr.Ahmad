import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { FadeUp, Page, Reveal, sharedViewName } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { analyzeResearch, type ResearchEvidence } from '../lib/research-intelligence'
import { useAdminAuth } from '../lib/admin-auth'
import { safeLink } from '../lib/dead-links'
import { ResearchSectionNavigator, type ResearchLayer } from '../components/ResearchSectionNavigator'
import { bookKnowledgeAnchor, relatedBookKnowledge } from '../lib/book-knowledge'
import { SocialIcon } from '../components/icons'
import { NextStep } from '../components/NextStep'
import { arabicCountPhrase, DIMENSION_FORMS, PROOF_FORMS } from '../lib/arabic-count.ts'

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
        <span aria-hidden className="research-accordion-icon"><SocialIcon name="ChevronDown" size={14} /></span>
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

function EvidenceLevelNode() {
  const reduce = useReducedMotion()
  return <motion.span aria-hidden className="research-evidence-thread-node" initial={reduce ? false : { opacity: .3, scale: .68 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .7 }} transition={{ duration: .3 }} />
}

export default function PaperDetail() {
  const { slug } = useParams()
  const location = useLocation()
  const { papers, books, articles, media, loading } = useCmsContent()
  const index = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[index]
  const [openSection, setOpenSection] = useState<ResearchSection | null>(null)
  const [readerKey, setReaderKey] = useState('')
  const evidenceThreadRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress: evidenceThreadProgress } = useScroll({ target: evidenceThreadRef, offset: ['start 78%', 'end 48%'] })
  const evidenceThreadDraw = useMotionValue(0)
  const evidenceThreadMax = useRef(0)
  useMotionValueEvent(evidenceThreadProgress, 'change', (latest) => {
    if (latest <= evidenceThreadMax.current) return
    evidenceThreadMax.current = latest
    evidenceThreadDraw.set(latest)
  })
  const intelligence = useMemo(() => analyzeResearch(p || {}), [p])
  const bookRoots = useMemo(() => {
    if (!p) return []
    const liveBooks = new Set(books.map((book) => book.slug))
    return relatedBookKnowledge(`${p.title} ${p.titleAr || ''} ${p.meta || ''} ${p.abstractAr || ''} ${p.keywords || ''} ${p.keyFinding || ''}`, 3)
      .filter((match) => liveBooks.has(match.book.slug))
  }, [books, p])

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
  const sourceLinks = intelligence.links.flatMap((item) => {
    if (item.id === 'doi') return []
    const url = safeLink(item.url)
    return url ? [{ ...item, url }] : []
  })
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
  const citationUrl = safeLink(doiLink?.url) || safeLink(intelligence.links.find((item) => item.id === 'publisher')?.url) || `${SITE_URL}/research/${p.slug}`
  const metadataCount = [topic, researchers, journal, year, doi, keywords].filter(Boolean).length
  const evidenceCount = Object.keys(intelligence.fieldEvidence).length

  const goToReaderCard = (card: ScientificCard) => {
    setReaderKey(card.key)
    window.requestAnimationFrame(() => document.getElementById(`research-card-${card.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const { isAdmin } = useAdminAuth()
  const [passportLayer, setPassportLayer] = useState<ResearchLayer>('layer1')
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  /* المؤشر يتبع موضع القارئ فعلياً. IntersectionObserver يراقب شريطاً ضيقاً
     في الثلث العلوي من الشاشة؛ لا scroll listener ولا قياسات تتصارع مع sticky،
     ولذلك لا يقفز المؤشر بين ١ و٢ عند الحد الفاصل ولا يسبب رجفة للشريط. */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const candidates: Array<[ResearchLayer, HTMLElement | null]> = [
      ['layer1', document.getElementById('research-passport-layer1')],
      ['layer2', document.getElementById('research-passport-layer2')],
      ['layer3', document.getElementById('research-passport-layer3')],
    ]
    const layers: Array<{ key: ResearchLayer; node: HTMLElement }> = candidates.flatMap(([key, node]) =>
      node instanceof HTMLElement ? [{ key, node }] : [],
    )
    if (!layers.length) return
    const visible = new Map<ResearchLayer, IntersectionObserverEntry>()
    const choose = () => {
      const candidates = [...visible.entries()].filter(([, entry]) => entry.isIntersecting)
      if (!candidates.length) return
      candidates.sort(([, left], [, right]) => {
        const anchor = window.innerHeight * .28
        return Math.abs(left.boundingClientRect.top - anchor) - Math.abs(right.boundingClientRect.top - anchor)
      })
      setPassportLayer(candidates[0][0])
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const layer = (entry.target as HTMLElement).dataset.researchLayer as ResearchLayer | undefined
        if (layer) visible.set(layer, entry)
      }
      choose()
    }, { rootMargin: '-18% 0px -58% 0px', threshold: [0, .15, .35, .6] })
    for (const { key, node } of layers) {
      node.dataset.researchLayer = key
      observer.observe(node)
    }
    return () => observer.disconnect()
  }, [dataCards.length])

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
        sameAs: intelligence.links.map((item) => safeLink(item.url)).filter(Boolean),
        identifier: doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: doi } : undefined,
        keywords: keywords || undefined,
        genre: studyType || undefined,
      }} />

      <article className="px-4 pb-12 pt-32 sm:px-6 md:px-11 md:pb-16 md:pt-40">
        <div className="mx-auto max-w-[960px]">
          <FadeUp>
            <div className="flex items-center justify-between gap-4">
              <Link to="/research" viewTransition className="text-[.85rem] font-medium text-soft transition-colors hover:text-accent">← كل المساهمات العلمية</Link>
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
                    {evidenceCount > 0 && isAdmin && <span className="rounded-full border border-accent/20 bg-accent/[.04] px-3.5 py-1 text-[.72rem] font-bold text-accent">✓ {arabicCountPhrase(evidenceCount, PROOF_FORMS)}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {year && <span className="font-display text-[.9rem] font-bold text-accent">{year}</span>}
                    {doi && <span className="rounded-md border border-hair bg-canvas px-2.5 py-1 text-[.68rem] font-mono text-soft">DOI: {doi}</span>}
                  </div>
                </div>

                <h1 dir="auto" style={{ viewTransitionName: sharedViewName('paper-title', p.slug) }} className="mt-6 font-display text-[clamp(1.75rem,4.5vw,2.85rem)] font-extrabold leading-[1.25] text-ink"><Reveal>{p.title}</Reveal></h1>
                {p.titleAr && p.titleAr !== p.title && <p dir="rtl" className="mt-3 text-[1.05rem] font-light leading-[1.85] text-soft">{p.titleAr}</p>}
                <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />

              </div>
            </header>
          </FadeUp>

          <ResearchSectionNavigator
            active={passportLayer}
            onSelect={(layer) => {
              setPassportLayer(layer)
              const target = layer === 'layer1' ? ['metadata', 'research-passport-layer1'] : layer === 'layer2' ? ['science', 'research-passport-layer2'] : ['sources', 'research-passport-layer3']
              revealSection(target[0] as ResearchSection, target[1])
            }}
          />

          {/* Layer 1: Visual Identity & Passport Stamp */}
          <div ref={evidenceThreadRef} className="research-evidence-thread-wrap mt-7 grid gap-6"><motion.span aria-hidden className="research-evidence-thread-line" style={{ scaleY: reduceMotion ? 1 : evidenceThreadDraw }} />
            <FadeUp delay={0.09}>
              <div id="research-passport-layer1" className={`scroll-mt-28 rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer1' ? 'ring-2 ring-accent/40' : ''}`}>
                <EvidenceLevelNode />
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
                  <div>
                    <span className="text-[.7rem] font-extrabold uppercase tracking-widest text-accent">Academic Level 1</span>
                    <h2 className="mt-1 font-display text-xl font-bold text-ink">المستوى الأول: الهوية والتوثيق الأكاديمي</h2>
                  </div>
                  <EvidenceStamp fallback="ختم الاعتماد الأكاديمي" />
                </div>
                {/* صدق البيانات (أمر الدكتور): الحقل الفارغ يختفي بهدوء — لا يُدّعى
                    DOI «مسجّل» ولا «مجلة محكّمة» بلا اسمها. البيانات من البحث نفسه فقط. */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {topic && <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">الموضوع الأساسي</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{topic}</strong></div>}
                  <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">{p.coAuthors?.trim() ? 'الباحثون' : 'الباحث'}</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{researchers}</strong></div>
                  {journal && <div className="min-w-0 overflow-hidden rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">جهة النشر / وعاء النشر</span><strong dir="auto" className="mt-1 block min-w-0 whitespace-normal text-[.88rem] font-bold leading-[1.85] text-ink [overflow-wrap:anywhere]">{journal}</strong></div>}
                  {year && <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">سنة الصدور</span><strong className="mt-1 block text-[.88rem] font-bold text-ink">{year}</strong></div>}
                  {doi && <div className="min-w-0 overflow-hidden rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">المعرّف المعياري DOI</span><strong dir="ltr" className="mt-1 block min-w-0 font-mono text-[.8rem] text-accent [overflow-wrap:anywhere]">{doi}</strong></div>}
                  {isAdmin && <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="block text-[.68rem] text-soft">حالة التدقيق والموثوقية</span><strong className={`mt-1 block text-[.88rem] font-bold ${p.analysisNeedsReview ? 'text-soft' : 'text-emerald-600'}`}>{p.analysisNeedsReview ? 'قيد التدقيق — يحتاج مراجعتك' : '✓ موثق ومطابق للمصدر'}</strong></div>}
                </div>
              </div>
            </FadeUp>

            {/* Layer 2: Methodological Dimensions */}
            {dataCards.length > 0 && (
              <FadeUp delay={0.11}>
                <div id="research-passport-layer2" className={`scroll-mt-28 rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer2' ? 'ring-2 ring-accent/40' : ''}`}>
                <EvidenceLevelNode />
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
                    <div>
                      <span className="text-[.7rem] font-extrabold uppercase tracking-widest text-accent">Academic Level 2</span>
                      <h2 className="mt-1 font-display text-xl font-bold text-ink">المستوى الثاني: الأبعاد المنهجية والأكاديمية</h2>
                    </div>
                    <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.72rem] font-semibold text-soft">{arabicCountPhrase(dataCards.length, DIMENSION_FORMS)}</span>
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
              <div id="research-passport-layer3" className={`scroll-mt-28 rounded-[28px] border border-hair bg-paper p-6 transition ${passportLayer === 'layer3' ? 'ring-2 ring-accent/40' : ''}`}>
                <EvidenceLevelNode />
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
                      <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-col items-start gap-2 overflow-hidden rounded-2xl border border-hair bg-canvas px-5 py-4 transition hover:border-accent hover:bg-paper sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 text-[.85rem] font-bold text-ink [overflow-wrap:anywhere]">{item.label}</span>
                        <span className="shrink-0 text-[.8rem] font-semibold text-accent">فتح المصدر الأصلي ↗</span>
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

          {bookRoots.length > 0 && <FadeUp>
            <details className="group mt-8 overflow-hidden rounded-[26px] border border-hair bg-wash">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-5 md:px-7">
                <span>
                  <span className="block text-[.72rem] font-extrabold text-accent">داخل المشروع المعرفي</span>
                  <strong className="mt-1 block text-[1rem] text-ink">الجذر النظري والامتداد في المؤلفات</strong>
                  <span className="mt-1 block text-[.72rem] leading-relaxed text-soft">صلة مفهومية محسوبة من متن الكتب وبيانات البحث؛ لا تعني أن البحث اقتبس الكتاب ما لم يذكره مصدره.</span>
                </span>
                <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="grid gap-3 border-t border-hair bg-canvas px-5 py-5 md:grid-cols-3 md:px-7">
                {bookRoots.map(({ book, concept }) => (
                  <Link key={book.slug} to={`/publications/${book.slug}#${bookKnowledgeAnchor(concept)}`} className="rounded-2xl border border-hair p-4 transition-colors hover:border-accent">
                    <span className="text-[.65rem] font-semibold text-accent">{book.slug === 'encyclopedia' ? 'الجذر المرجعي' : 'امتداد في كتاب'} · ص {concept.pageStart}</span>
                    <strong className="mt-1.5 block text-[.82rem] leading-relaxed text-ink">{book.title}</strong>
                    <span className="mt-2 block text-[.72rem] leading-relaxed text-soft">{concept.title}</span>
                  </Link>
                ))}
              </div>
            </details>
          </FadeUp>}

          <FadeUp>
            <nav className="mt-16 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
              {prev ? <Link viewTransition to={`/research/${prev.slug}`} className="group"><span className="text-[.78rem] text-soft">السابق</span><span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{prev.title}</span></Link> : <span />}
              {next && <Link viewTransition to={`/research/${next.slug}`} className="group sm:text-left"><span className="text-[.78rem] text-soft">التالي</span><span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{next.title}</span></Link>}
            </nav>
          </FadeUp>
        </div>
      </article>

      {/* الفصل التالي بعد البحث المحكّم: مقالٌ أو لقاءٌ يخفّف ثقل الأكاديمي. */}
      <NextStep
        seed={`${(p as { titleAr?: string }).titleAr || p.title} ${p.meta || ''}`}
        from="بحث محكّم"
        articles={articles}
        papers={papers}
        media={media}
        excludeKey={`paper:${p.slug}`}
      />
    </Page>
  )
}
