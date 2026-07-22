import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { analyzeResearch } from '../lib/research-intelligence'

const cleanText = (value = '') => value.replace(/^ملخص عربي:\s*/, '').replace(/\s+/g, ' ').trim()
const firstSentence = (value = '', fallback = '') => {
  const text = cleanText(value) || fallback
  return text ? (text.split(/(?<=[.!؟…])\s+/)[0] || text) : ''
}

function CopySnippet({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard may be unavailable */ }
  }
  return (
    <div className="research-copy-card min-w-0 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[.8rem] font-semibold text-soft">{label}</p>
        <button onClick={copy} className="rounded-full border border-hair px-3 py-1 text-[.75rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">
          {copied ? 'نُسخ ✓' : 'نسخ'}
        </button>
      </div>
      <p dir="auto" className="mt-3 min-w-0 break-words text-[.86rem] leading-[1.95] text-ink [overflow-wrap:anywhere]">{value}</p>
    </div>
  )
}

export default function PaperDetail() {
  const { slug } = useParams()
  const { papers, loading } = useCmsContent()
  const index = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[index]
  const [guideOpen, setGuideOpen] = useState(false)
  const intelligence = useMemo(() => analyzeResearch(p || {}), [p])

  useSeo({ title: p?.title ?? 'بحث', description: p?.abstractAr || p?.meta, path: `/research/${slug}`, type: 'article' })

  if (!p && loading) return <Page className="content-research"><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!p) return <Page><div className="px-6 pt-44 text-center text-soft">تعذر فتح صفحة البحث.</div></Page>

  const prev = papers[index - 1]
  const next = papers[index + 1]
  const year = intelligence.year
  const journal = p.journal || intelligence.journal
  const researchers = [profile.fullName, p.coAuthors].filter(Boolean).join('، ')
  const doi = p.doi || intelligence.doi
  const keywords = p.keywords || intelligence.keywords
  const dataCards = [
    { label: 'السؤال العلمي', value: p.researchQuestion || intelligence.researchQuestion },
    { label: 'أبرز النتائج', value: p.keyFinding || intelligence.keyFinding },
    { label: 'المنهج', value: p.methodology || intelligence.methodology },
    { label: 'العينة / نطاق الدراسة', value: p.sample || intelligence.sample },
    { label: 'نوع الدراسة', value: p.studyType || intelligence.studyType },
    { label: 'التطبيقات', value: p.applications || intelligence.applications || p.contribution || intelligence.contribution },
    { label: 'القيود', value: p.limitations || intelligence.limitations },
  ].filter((item) => Boolean(item.value?.trim()))
  const summary = firstSentence(p.abstractAr, p.meta || p.title)
  const citationUrl = intelligence.links.find((item) => item.id === 'doi')?.url || intelligence.links[0]?.url || `${SITE_URL}/research/${p.slug}`
  const apa = `الفيلكاوي، أحمد حسين${p.coAuthors ? `، و${p.coAuthors}` : ''}. (${year || 'د.ت.'}). ${p.title}.${journal ? ` ${journal}.` : ''} ${citationUrl}`

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
        genre: p.studyType || intelligence.studyType || undefined,
      }} />

      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[850px]">
          <FadeUp>
            <Link to="/research" className="text-[.85rem] font-medium text-soft transition-colors hover:text-accent">← كل المساهمات العلمية</Link>
          </FadeUp>

          <FadeUp delay={0.05}>
            <div className="mt-8 flex flex-wrap gap-2">
              <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">محكّم</span>
              {(p.studyType || intelligence.studyType) && <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">{p.studyType || intelligence.studyType}</span>}
              {doi && <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">DOI</span>}
              {intelligence.openAccess && <span className="research-badge inline-flex rounded-full px-3 py-1.5 text-[.72rem] font-semibold">نص كامل</span>}
            </div>
            <h1 dir="auto" className="mt-5 font-display text-[clamp(1.7rem,4vw,2.7rem)] font-bold leading-[1.45] text-ink"><Reveal>{p.title}</Reveal></h1>
            {p.titleAr && <p dir="rtl" className="mt-3 text-[1.02rem] font-light leading-[1.9] text-soft">{p.titleAr}</p>}
            <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />
            <div className="mt-7 h-[3px] w-16 rounded-full bg-accent" />
          </FadeUp>

          <FadeUp delay={0.1}>
            <dl className="research-meta-panel mt-10 grid gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2">
              {p.meta && <div className="research-meta-cell"><dt>الموضوع</dt><dd>{p.meta}</dd></div>}
              <div className="research-meta-cell"><dt>الباحثون</dt><dd>{researchers}</dd></div>
              {journal && <div className="research-meta-cell"><dt>المجلة</dt><dd>{journal}</dd></div>}
              {year && <div className="research-meta-cell"><dt>سنة النشر</dt><dd>{year}</dd></div>}
              {doi && <div className="research-meta-cell"><dt>DOI</dt><dd dir="ltr" className="break-all text-left">{doi}</dd></div>}
              {keywords && <div className="research-meta-cell"><dt>الكلمات المفتاحية</dt><dd>{keywords}</dd></div>}
            </dl>
          </FadeUp>

          {dataCards.length > 0 && (
            <FadeUp delay={0.115}>
              <section className="research-passport mt-8 overflow-hidden rounded-[28px] border">
                <div className="research-passport-head px-6 py-5 md:px-7">
                  <p className="text-[.76rem] font-bold text-accent">جواز البحث العلمي</p>
                  <h2 className="mt-1 text-[1.1rem] font-bold text-ink">البيانات العلمية الكاملة</h2>
                  {(p.contribution || intelligence.contribution) && <p className="mt-3 text-[.93rem] leading-[1.95] text-ink">{p.contribution || intelligence.contribution}</p>}
                </div>
                <div className="grid gap-px sm:grid-cols-2">
                  {dataCards.map((card) => (
                    <div key={card.label} className="research-data-card p-5 md:p-6">
                      <h3 className="text-[.75rem] font-bold text-accent">{card.label}</h3>
                      <p className="mt-2 text-[.9rem] leading-[1.9] text-ink">{card.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </FadeUp>
          )}

          {p.abstractAr && (
            <FadeUp delay={0.12}>
              <section className="research-abstract mt-8 rounded-[24px] border px-6 py-6 md:px-7">
                <p className="text-[.76rem] font-bold text-accent">الملخص</p>
                <p className="mt-3 text-[.96rem] font-normal leading-[2] text-ink">{cleanText(p.abstractAr)}</p>
              </section>
            </FadeUp>
          )}

          {intelligence.links.length > 0 && (
            <FadeUp delay={0.14}>
              <section className="mt-9">
                <h2 className="text-[.84rem] font-bold text-ink">جميع روابط البحث</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {intelligence.links.map((item, linkIndex) => (
                    <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className={linkIndex === 0 ? 'research-primary-link' : 'research-secondary-link'}>{item.label} ←</a>
                  ))}
                </div>
              </section>
            </FadeUp>
          )}

          <FadeUp delay={0.15}>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setGuideOpen((value) => !value)} className="research-secondary-link" aria-expanded={guideOpen}>{guideOpen ? 'إخفاء رفيق الباحث' : 'افهم هذا البحث'}</button>
            </div>
            <CiteButton title={p.title} year={year || 'د.ت.'} container={journal || 'بحث محكّم'} url={`${SITE_URL}/research/${p.slug}`} />
          </FadeUp>

          {guideOpen && (
            <FadeUp delay={0.16}>
              <section className="research-guide mt-10 rounded-[28px] border p-6 md:p-7">
                <p className="text-[.76rem] font-bold text-accent">رفيق الباحث</p>
                <h2 className="mt-2 font-display text-[1.4rem] font-semibold text-ink">خلاصة قابلة للاستخدام الأكاديمي</h2>
                {summary && <div className="research-data-card mt-5 rounded-2xl border p-5"><h3 className="text-[.75rem] font-bold text-accent">البحث في جملة واحدة</h3><p className="mt-3 text-[.92rem] leading-[1.95] text-ink">{summary}</p></div>}
                <div className="mt-5"><CopySnippet label="APA" value={apa} /></div>
              </section>
            </FadeUp>
          )}

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
