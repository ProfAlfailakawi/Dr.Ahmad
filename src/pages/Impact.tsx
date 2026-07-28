import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import ImpactMap from '../components/ImpactMap'
import { Pagination, usePagedList } from '../components/Pagination'
import { useSeo } from '../components/seo'
import { useCmsContent, useExtras } from '../lib/content'
import { buildIdeaLife, type IdeaLifeRemoteRecord, type ImpactKind, type ImpactNode } from '../lib/idea-life'
import { liveLink } from '../lib/dead-links'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')
type FilterKey = 'all' | 'paper' | 'media' | 'archive'

type Chain = {
  key: string
  title: string
  year?: string
  originTo?: string
  nodes: ImpactNode[]
}

function nodeMatchesFilter(node: ImpactNode, filter: FilterKey) {
  if (filter === 'all') return true
  if (filter === 'paper') return node.kind === 'paper'
  if (filter === 'media') return node.kind === 'media' || node.kind === 'external'
  if (filter === 'archive') return node.kind === 'article' || node.kind === 'book'
  return node.kind === filter
}

function EvidenceLink({ node }: { node: ImpactNode }) {
  const content = (
    <>
      <span className="block text-[.67rem] font-semibold text-accent">{node.label}{node.year ? ` · ${node.year}` : ''}</span>
      <strong className="mt-1.5 block font-display text-[.98rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{node.title}</strong>
      <span className="mt-1.5 block text-[.76rem] font-light leading-[1.78] text-soft">{node.note}</span>
      {node.source && <span className="mt-2 block text-[.67rem] text-soft/75">المصدر: {node.source}</span>}
    </>
  )
  if (node.to) return <Link to={node.to} className="group block">{content}</Link>
  const url = liveLink(node.url)
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="group block">{content}</a>
  return null
}

export default function Impact() {
  useSeo({
    title: 'سجل الأثر الموثق',
    path: '/impact',
    description: 'مسارات قابلة للتحقق تتبع انتقال الفكرة بين المقال والبحث والكتاب والحوار العام، مع فصل واضح بين القرابة الموضوعية والأثر المثبت.',
  })
  const { articles, books, papers, media, loading } = useCmsContent()
  const remote = useExtras<IdeaLifeRemoteRecord>('site_idea_life')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [yearFilter, setYearFilter] = useState<string | null>(null)

  const chains = useMemo<Chain[]>(() => {
    const articleChains = articles.flatMap((article) => {
      const record = remote.find((item) => item.slug === article.slug && (!item.kind || item.kind === 'article'))
      const model = buildIdeaLife(article, articles, books, papers, media, record)
      const visibleNodes = model.impact.filter((node) => node.kind !== 'application')
      if (visibleNodes.length <= 1) return []
      return [{
        key: `article:${article.slug}`,
        title: article.title,
        year: article.iso.slice(0, 4),
        originTo: `/articles/${article.slug}`,
        nodes: visibleNodes,
      }]
    })

    const paperChains = remote.filter((item) => item.kind === 'paper' && item.signals?.length).flatMap((item) => {
      const paper = papers.find((candidate) => candidate.slug === item.slug)
      if (!paper) return []
      const nodes: ImpactNode[] = [
        {
          kind: 'origin', label: 'العمل العلمي', title: paper.titleAr || paper.title,
          note: paper.meta || 'بحث علمي منشور.', year: paper.iso?.slice(0, 4), to: `/research/${paper.slug}`, confidence: 'موثق',
        },
        ...(item.signals || []).flatMap((signal) => {
          const url = liveLink(signal.url)
          if (!url || (signal.confidence ?? 1) < .82) return []
          return [{
            kind: 'paper' as const,
            label: signal.type === 'academic' ? 'استشهاد علمي' : 'ذكر مباشر',
            title: signal.title,
            note: signal.summary || signal.relation || 'إشارة اجتازت فحص المصدر والتطابق.',
            year: signal.publishedAt?.slice(0, 4), url, source: signal.source, confidence: 'موثق' as const,
          }]
        }),
      ]
      return nodes.length > 1 ? [{ key: `paper:${paper.slug}`, title: paper.titleAr || paper.title, year: paper.iso?.slice(0, 4), originTo: `/research/${paper.slug}`, nodes }] : []
    })

    return [...articleChains, ...paperChains]
      .sort((left, right) => (right.year || '').localeCompare(left.year || '') || left.title.localeCompare(right.title, 'ar'))
  }, [articles, books, media, papers, remote])

  const visible = useMemo(() => chains
    .filter((chain) => filter === 'all' || chain.nodes.some((node) => nodeMatchesFilter(node, filter)))
    .filter((chain) => !yearFilter || chain.year === yearFilter), [chains, filter, yearFilter])
  const visiblePages = usePagedList(visible, 10, `${filter}:${yearFilter || ''}:${visible.map((chain) => chain.key).join('|')}`)

  /* الملخص السنوي (مقترح معتمد): كم رحلة أثر وُثقت في كل سنة، وكل سنة مرشِّح */
  const yearSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const chain of chains) if (chain.year) counts.set(chain.year, (counts.get(chain.year) || 0) + 1)
    return [...counts.entries()].sort((left, right) => right[0].localeCompare(left[0]))
  }, [chains])
  const linkedNodes = chains.flatMap((chain) => chain.nodes).filter((node) => node.kind !== 'origin')
  const verifiedEvidence = linkedNodes.filter((node) => node.confidence === 'موثق')
  const verifiedNodes = verifiedEvidence.length
  const sourceCount = new Set(verifiedEvidence.map((node) => {
    if (node.source) return node.source.trim().toLocaleLowerCase('ar')
    try { return node.url ? new URL(node.url).hostname.replace(/^www\./, '').toLowerCase() : '' } catch { return '' }
  }).filter(Boolean)).size

  const headlineStats = [
    { label: 'مسارات مكتشفة', value: chains.length },
    { label: 'صلات قابلة للتحقق', value: linkedNodes.length },
    { label: 'آثار خارجية مثبتة', value: verifiedNodes },
    { label: 'جهات مستقلة', value: sourceCount },
  ].filter((item) => item.value > 10)

  return (
    <Page className="content-impact page-journey">
      <PageHead
        label="من الفكرة إلى الميدان"
        title="سجل الأثر الموثق."
        sub="خريطةٌ تتبع انتقال الفكرة بين المقال والبحث والكتاب والحوار العام. كل محطة تعود إلى مصدرها، وتبقى القرابة الموضوعية منفصلة بوضوح عن الأثر الذي تثبته جهة مستقلة."
      />

      <section className="border-b border-hair px-6 py-5 md:px-11">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3">
          <p className="text-[.78rem] leading-relaxed text-soft">للقراءة الكلية قبل الدخول في المسارات التفصيلية.</p>
          <Link to="/thought" className="rounded-full border border-hair px-4 py-2 text-[.76rem] font-semibold text-accent transition-colors hover:border-accent">فكر د. أحمد في لقطة واحدة ←</Link>
        </div>
      </section>

      <ImpactMap />

      <section className="border-b border-hair px-6 py-7 md:px-11">
        <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-6">
          {headlineStats.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              {headlineStats.map((item) => (
                <div key={item.label}>
                  <dt className="text-[.67rem] font-semibold text-accent">{item.label}</dt>
                  <dd className="mt-1 font-display text-[1.35rem] font-semibold text-ink">{number.format(item.value)}</dd>
                </div>
              ))}
            </dl>
          )}
          <div role="tablist" aria-label="تصفية سجل الأثر" className="flex max-w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ['all', 'الكل'], ['paper', 'علمي'], ['media', 'إعلامي'], ['archive', 'أرشيفي'],
            ].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key as FilterKey)} className={`shrink-0 rounded-full border px-4 py-1.5 text-[.74rem] font-semibold transition-colors ${filter === key ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}>{label}</button>
            ))}
          </div>
        </div>
        {yearSummary.length > 1 && (
          <div className="impact-no-print mx-auto mt-5 flex max-w-shell flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[.68rem] font-semibold text-soft">حصاد السنوات:</span>
            {yearSummary.map(([year, count]) => (
              <button
                key={year}
                type="button"
                onClick={() => setYearFilter(yearFilter === year ? null : year)}
                className={`border-b pb-0.5 text-[.74rem] transition-colors ${yearFilter === year ? 'border-accent font-semibold text-accent' : 'border-transparent text-soft hover:text-accent'}`}
              >
                {year} · {count === 1 ? 'رحلة واحدة' : count === 2 ? 'رحلتان' : count <= 10 ? `${number.format(count)} رحلات` : `${number.format(count)} رحلة`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => window.print()}
              className="ms-auto rounded-full border border-hair px-4 py-1.5 text-[.72rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent"
            >
              نسخة رسمية للطباعة ⎙
            </button>
          </div>
        )}
      </section>

      <section className="px-6 py-14 md:px-11 md:py-20">
        <div className="mx-auto max-w-4xl">
          {loading && !chains.length ? (
            <p className="py-20 text-center text-soft">تُراجع الأدلة والروابط…</p>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-soft">لا توجد رحلة أثر ضمن هذا النوع حتى الآن.</p>
          ) : (
            <>
            <div className="divide-y divide-hair border-y border-hair">
              {visiblePages.pageItems.map((chain, chainIndex) => {
                const nodes = filter === 'all' ? chain.nodes : chain.nodes.filter((node) => node.kind === 'origin' || nodeMatchesFilter(node, filter))
                return (
                  <FadeUp key={chain.key} delay={Math.min(chainIndex * .035, .2)}>
                    <article className="grid gap-7 py-9 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.35fr)] md:gap-12 md:py-11">
                      <header>
                        <span className="text-[.68rem] font-semibold text-accent">رحلة أثر{chain.year ? ` · ${chain.year}` : ''}</span>
                        {chain.originTo ? (
                          <Link to={chain.originTo} className="group mt-2 block">
                            <h2 className="font-display text-[1.23rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent">{chain.title}</h2>
                          </Link>
                        ) : <h2 className="mt-2 font-display text-[1.23rem] font-semibold leading-[1.65] text-ink">{chain.title}</h2>}
                        <p className="mt-3 text-[.76rem] font-light leading-[1.8] text-soft">الدائرة المجوّفة تعني صلة أرشيفية قوية يمكن فتح مصدرها. الدائرة الممتلئة محفوظة للأثر الخارجي الذي يثبت المصدر علاقته بالعمل صراحةً.</p>
                      </header>
                      <ol className="relative space-y-7 before:absolute before:bottom-3 before:right-[7px] before:top-3 before:w-px before:bg-hair">
                        {nodes.map((node, index) => (
                          <li key={`${node.label}:${node.title}:${index}`} className="relative ps-8">
                            <span className={`absolute right-0 top-[.35rem] flex h-4 w-4 items-center justify-center rounded-full border ${node.confidence === 'موثق' ? 'border-accent bg-accent' : 'border-accent/45 bg-canvas'}`}>
                              {node.confidence === 'موثق' && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
                            </span>
                            <EvidenceLink node={node} />
                            {node.kind !== 'origin' && <span className="mt-2 inline-block rounded-full border border-hair px-2.5 py-1 text-[.64rem] font-semibold text-soft">{node.confidence === 'موثق' ? 'أثر مثبت' : 'صلة أرشيفية'}</span>}
                          </li>
                        ))}
                      </ol>
                    </article>
                  </FadeUp>
                )
              })}
            </div>
            <Pagination page={visiblePages.page} pageCount={visiblePages.pageCount} onChange={visiblePages.setPage} totalItems={visible.length} firstItem={visiblePages.firstItem} lastItem={visiblePages.lastItem} label="صفحات مسارات الأثر" className="mt-8" />
            </>
          )}
        </div>
      </section>
    </Page>
  )
}
