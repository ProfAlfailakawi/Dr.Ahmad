import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../lib/cms'
import { useExtras } from '../lib/content'
import { buildIdeaLife, ideaWords, type IdeaLifeRemoteRecord, type IdeaRadarItem, type IdeaUpdateKind, type ImpactNode, type RemoteIdeaUpdate } from '../lib/idea-life'
import { findIdeaRevisions, type IdeaRevision } from '../lib/idea-revision'
import { liveLink } from '../lib/dead-links'
import { staticQuestions } from '../questions-data'
import { arabicCountPhrase, TOPICAL_CONNECTION_FORMS } from '../lib/arabic-count.ts'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')
const updateDate = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' })

const verifiedEvidence = <T extends { url?: string }>(items?: T[]) => (items || [])
  .map((item) => ({ ...item, url: liveLink(item.url) }))
  .filter((item): item is T & { url: string } => Boolean(item.url))

type TabKey = 'test' | 'thread' | 'time' | 'impact' | 'revision'

type Props = {
  article: ArticleRecord
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
}

type ThreadNode = {
  kind: 'كتاب' | 'بحث' | 'لقاء' | 'سؤال'
  title: string
  to?: string
  href?: string
}

function ideaThreadFor(article: ArticleRecord, books: BookRecord[], papers: PaperRecord[], media: MediaRecord[]): ThreadNode[] {
  const mine = new Set(ideaWords(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`))
  const score = (value: string) => ideaWords(value).reduce((total, token) => total + (mine.has(token) ? 1 : 0), 0)
  const best = <T,>(items: T[], text: (item: T) => string, minimum = 1) => {
    const ranked = items
      .map((item, index) => ({ item, index, score: score(text(item)) }))
      .filter((entry) => entry.score >= minimum)
      .sort((left, right) => right.score - left.score || left.index - right.index)
    return ranked[0]?.item
  }

  const book = best(books, (item) => `${item.title} ${item.desc || ''}`)
  const paper = best(papers, (item) => `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`)
  const appearance = best(media, (item) => `${item.title} ${item.outlet}`)
  const appearanceUrl = appearance ? liveLink(appearance.url) : ''
  const question = best(staticQuestions, (item) => `${item.ar} ${item.take}`)

  return [
    book && { kind: 'كتاب' as const, title: book.title, to: `/publications/${book.slug}` },
    paper && { kind: 'بحث' as const, title: paper.titleAr || paper.title, to: `/research/${paper.slug}` },
    appearance && appearanceUrl && { kind: 'لقاء' as const, title: appearance.title, href: appearanceUrl },
    question && { kind: 'سؤال' as const, title: question.ar, to: '/questions' },
  ].filter(Boolean) as ThreadNode[]
}

function ArrowIcon() {
  return <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
}

function OrbitMark() {
  return (
    <span aria-hidden className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/25">
      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
      <span className="absolute inset-[5px] rounded-full border border-hair" />
    </span>
  )
}

type TracePoint = { label: string; title: string; year?: string; to?: string; href?: string; current?: boolean }

function IdeaTrace({ article, model, embedded = false }: { article: ArticleRecord; model: ReturnType<typeof buildIdeaLife>; embedded?: boolean }) {
  const older = model.timeLinks.find((item) => item.role === 'جذر')
  const newer = model.timeLinks.find((item) => item.role === 'تطور')
  const extension = model.impact.find((item) => item.kind === 'paper' || item.kind === 'book')
  const points: TracePoint[] = [
    older && { label: 'بداية سابقة', title: older.article.title, year: older.article.iso.slice(0, 4), to: `/articles/${older.article.slug}` },
    { label: 'المقال الحالي', title: article.title, year: article.iso.slice(0, 4), current: true },
    newer && { label: 'تطور لاحق', title: newer.article.title, year: newer.article.iso.slice(0, 4), to: `/articles/${newer.article.slug}` },
    extension && { label: extension.kind === 'paper' ? 'امتداد بحثي' : 'امتداد في كتاب', title: extension.title, year: extension.year, to: extension.to, href: extension.url },
  ].filter(Boolean) as TracePoint[]

  if (points.length < 2) return null
  return (
    <section className={`${embedded ? 'mb-9' : 'mt-10'} rounded-[1.4rem] border border-hair bg-wash/[.35] px-4 py-5 md:px-6`} aria-labelledby="idea-trace-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.66rem] font-semibold text-accent">أثر الفكرة</p>
          <h2 id="idea-trace-title" className="mt-1 font-display text-[1.05rem] font-semibold text-ink">مسارٌ موجز يفتح أصوله.</h2>
        </div>
        <Link to="/thought" className="text-[.7rem] font-semibold text-accent transition-opacity hover:opacity-70">المشهد الفكري الكامل ←</Link>
      </div>
      <ol className="edge-fade relative mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden before:absolute before:right-4 before:top-[.55rem] before:h-px before:w-[calc(100%-2rem)] before:bg-hair">
        {points.map((point, index) => {
          const body = <>
            <span className={`relative z-10 block h-3 w-3 rounded-full border ${point.current ? 'border-accent bg-accent' : 'border-accent/40 bg-canvas'}`} />
            <span className="mt-3 block text-[.62rem] font-semibold text-accent">{point.label}{point.year ? ` · ${point.year}` : ''}</span>
            <strong className="mt-1.5 block line-clamp-2 font-display text-[.8rem] font-medium leading-[1.6] text-ink">{point.title}</strong>
          </>
          const cls = `group relative w-[72vw] max-w-[17rem] shrink-0 snap-start rounded-xl border px-4 pb-4 pt-3 text-start transition-colors md:w-auto md:flex-1 ${point.current ? 'border-accent/[.35] bg-accent/[.045]' : 'border-hair bg-canvas hover:border-accent/[.35]'}`
          return <li key={`${point.label}-${point.title}-${index}`} className="contents">{point.to ? <Link to={point.to} className={cls}>{body}</Link> : point.href ? <a href={point.href} target="_blank" rel="noreferrer" className={cls}>{body}</a> : <div className={cls}>{body}</div>}</li>
        })}
      </ol>
      <p className="mt-3 text-[.68rem] font-light leading-[1.75] text-soft">يمتد هذا المسار بين محطات الفكرة كما ظهرت في الأرشيف عبر الزمن.</p>
    </section>
  )
}

function SectionTitle({ index, title, sub }: { index: string; title: string; sub?: string }) {
  return (
    <header className="grid grid-cols-[2.2rem_1fr] gap-3 border-b border-hair pb-4">
      <span className="pt-1 font-display text-[.8rem] font-semibold text-accent">{index}</span>
      <div>
        <h3 className="font-display text-[1.16rem] font-semibold leading-[1.55] text-ink md:text-[1.3rem]">{title}</h3>
        {sub && <p className="mt-1 text-[.78rem] leading-[1.75] text-soft">{sub}</p>}
      </div>
    </header>
  )
}

function ThreadPanel({ nodes, close }: { nodes: ThreadNode[]; close: () => void }) {
  return (
    <div>
      <SectionTitle index="01" title="الفكرة لا تعيش في صفحة واحدة." sub="مسار يصل المقال بأقرب كتاب وبحث ولقاء وسؤال من الأرشيف نفسه." />
      <ol className="relative mt-7 grid gap-4 md:grid-cols-4 md:gap-5 before:absolute before:bottom-6 before:right-[.7rem] before:top-6 before:w-px before:bg-hair md:before:bottom-auto md:before:left-4 md:before:right-4 md:before:top-[1.05rem] md:before:h-px md:before:w-auto">
        {nodes.map((node, index) => {
          const content = (
            <>
              <span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-accent/30 bg-canvas shadow-sm"><span className="h-2 w-2 rounded-full bg-accent" /></span>
              <span className="mt-3 block text-[.62rem] font-semibold text-accent">{String(index + 1).padStart(2, '0')} · {node.kind}</span>
              <span dir="auto" className="mt-1.5 block break-words text-start font-display text-[.88rem] font-medium leading-[1.65] text-ink transition-colors [overflow-wrap:anywhere] [text-wrap:balance] group-hover:text-accent md:text-[.94rem]">{node.title}</span>
            </>
          )
          return (
            <li key={`${node.kind}-${node.title}`} className="relative pe-9 md:pe-0">
              {node.to
                ? <Link to={node.to} onClick={close} className="group block h-full rounded-2xl border border-hair bg-wash/[.45] px-4 py-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-accent/[.35] hover:bg-wash">{content}</Link>
                : <a href={node.href} target="_blank" rel="noreferrer" className="group block h-full rounded-2xl border border-hair bg-wash/[.45] px-4 py-4 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-accent/[.35] hover:bg-wash">{content}</a>}
            </li>
          )
        })}
      </ol>
      <p className="mt-6 border-t border-hair pt-4 text-[.72rem] font-light leading-[1.8] text-soft">خيطٌ يقرّب المواد المتجاورة في المعنى، لتستكمل قراءة الفكرة من أكثر من زاوية.</p>
    </div>
  )
}

/* «كيف تغيّر رأيي» — لا يظهر إلا حين يجد النظام موضعاً بدليل (مقتطفان حقيقيان
   من مقالين منشورين في سنتين مختلفتين). لا وعد بلا مضمون. */
function RevisionPanel({ revisions, close }: { revisions: IdeaRevision[]; close: () => void }) {
  return (
    <div>
      <SectionTitle index="01" title="رأيٌ راجع نفسه." sub="موضعان من الأرشيف نفسه: ما كتبتُه أولاً، وما صرتُ إليه بعد سنوات." />
      <ol className="mt-7 grid gap-5">
        {revisions.map((revision) => (
          <li key={`${revision.older.slug}-${revision.newer.slug}-${revision.concept}`} className="rounded-2xl border border-hair bg-wash/40 px-4 py-5 md:px-6">
            <p className="text-[.62rem] font-semibold text-accent">{revision.concept}</p>
            <p dir="auto" className="mt-2 font-display text-[.95rem] font-medium leading-[1.7] text-ink">{revision.line}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[revision.older, revision.newer].map((side, index) => (
                <Link
                  key={side.slug}
                  to={`/articles/${side.slug}`}
                  onClick={close}
                  className={`group block rounded-xl border px-4 py-4 transition-colors ${index ? 'border-accent/30 bg-accent/[.045]' : 'border-hair bg-canvas'} hover:border-accent/[.45]`}
                >
                  <span className="block text-[.62rem] font-semibold text-accent">{index ? 'وصرتُ إليه' : 'كتبتُ أولاً'} · {side.year}</span>
                  <span dir="auto" className="mt-2 block text-[.78rem] font-light leading-[1.9] text-soft [overflow-wrap:anywhere]">«{side.excerpt}»</span>
                  <span dir="auto" className="mt-2.5 block line-clamp-2 font-display text-[.8rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{side.title}</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-hair pt-4 text-[.72rem] font-light leading-[1.8] text-soft">المقتطفان منقولان بحرفهما من المقالين المنشورين؛ لا يُعرض هنا موضعٌ بلا دليل.</p>
    </div>
  )
}

function TestPanel({ model }: { model: ReturnType<typeof buildIdeaLife> }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle index="01" title="ماذا يقول المقال فعلاً؟" sub={`نوع الادعاء: ${model.test.certainty}`} />
        <blockquote className="mt-5 border-r-2 border-accent ps-5 font-display text-[1.08rem] font-medium leading-[2] text-ink md:text-[1.22rem]">
          {model.test.claim}
        </blockquote>
      </section>

      <section>
        <SectionTitle index="02" title="أقوى حجة في الجهة المقابلة" sub="اعتراض جاد، لا خصم ضعيف صُمّم كي يخسر." />
        <p className="mt-5 text-[.94rem] font-light leading-[2.05] text-ink/[.82]">{model.test.counterargument}</p>
      </section>

      <section>
        <SectionTitle index="03" title="اختبار الضغط" sub="ثلاث حالات تكشف حدود التعميم قبل الاطمئنان إليه." />
        <ol className="mt-5 divide-y divide-hair border-y border-hair">
          {model.test.pressureTests.map((question, index) => (
            <li key={question} className="grid grid-cols-[2.3rem_1fr] gap-3 py-4">
              <span className="text-[.72rem] font-semibold text-accent">{number.format(index + 1)}</span>
              <p className="text-[.9rem] leading-[1.9] text-ink/80">{question}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-7 border-t border-hair pt-7 md:grid-cols-2 md:gap-10">
        <div>
          <p className="text-[.72rem] font-semibold text-accent">ما الذي يصمد؟</p>
          <p className="mt-3 text-[.88rem] font-light leading-[1.95] text-soft">{model.test.resilientCore}</p>
        </div>
        <div>
          <p className="text-[.72rem] font-semibold text-accent">ما الذي قد يغيّر الحكم؟</p>
          <p className="mt-3 text-[.88rem] font-light leading-[1.95] text-soft">{model.test.reconsiderWhen}</p>
        </div>
      </section>
    </div>
  )
}

const updateMeta: Record<IdeaUpdateKind, { label: string; index: string }> = {
  study: { label: 'دراسة جديدة', index: 'دليل' },
  official: { label: 'تطور رسمي', index: 'سياق' },
  report: { label: 'تقرير حديث', index: 'قراءة' },
  field: { label: 'حدث في الميدان', index: 'واقع' },
}

function readableUpdateDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : updateDate.format(date)
}

function IdeaUpdatesPanel({ updates }: { updates: RemoteIdeaUpdate[] }) {
  const [lead, ...rest] = updates
  if (!lead) return null
  const leadMeta = updateMeta[lead.kind || 'field']
  return (
    <section aria-labelledby="idea-updates-title" className="relative overflow-hidden rounded-[1.75rem] border border-accent/20 bg-wash/[.45] px-5 py-6 md:px-7 md:py-7">
      <span aria-hidden className="absolute -left-14 -top-16 h-40 w-40 rounded-full border border-accent/10" />
      <span aria-hidden className="absolute -left-7 -top-9 h-24 w-24 rounded-full border border-accent/10" />
      <div className="relative flex items-start justify-between gap-5 border-b border-hair pb-5">
        <div>
          <p className="text-[.66rem] font-semibold tracking-[.08em] text-accent">نبضٌ موثّق بعد النشر</p>
          <h3 id="idea-updates-title" className="mt-1.5 font-display text-[1.18rem] font-semibold leading-[1.55] text-ink md:text-[1.35rem]">مستجدات الفكرة</h3>
          <p className="mt-1 max-w-[36rem] text-[.76rem] font-light leading-[1.8] text-soft">لا يتغير النص الأصلي؛ هنا فقط تظهر دراسة أو وثيقة أو واقعة جديدة تستحق أن تُقرأ بجواره.</p>
        </div>
        <span aria-hidden className="relative mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-canvas">
          <span className="absolute h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="absolute h-6 w-6 rounded-full border border-accent/25" />
        </span>
      </div>

      <a href={lead.url} target="_blank" rel="noreferrer" className="group relative mt-6 block border-r-2 border-accent ps-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[.66rem] font-semibold text-accent">
          <span>{leadMeta.label}</span>
          {readableUpdateDate(lead.publishedAt) && <><span className="text-hair">·</span><time>{readableUpdateDate(lead.publishedAt)}</time></>}
        </div>
        <h4 dir="auto" className="mt-2.5 max-w-[45rem] text-start font-display text-[1.05rem] font-semibold leading-[1.7] text-ink transition-colors group-hover:text-accent md:text-[1.18rem]">{lead.title}</h4>
        <p className="mt-2 max-w-[43rem] text-[.84rem] font-light leading-[1.9] text-soft">{lead.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[.68rem] text-soft">
          <span className="font-semibold text-accent">{lead.relation || leadMeta.index}</span>
          {lead.source && <><span className="text-hair">·</span><span>{lead.source}</span></>}
          <span className="ms-auto shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1">↗</span>
        </div>
      </a>

      {rest.length > 0 && (
        <div className="relative mt-6 divide-y divide-hair border-t border-hair">
          {rest.map((item) => {
            const meta = updateMeta[item.kind || 'field']
            return (
              <a key={`${item.url}-${item.title}`} href={item.url} target="_blank" rel="noreferrer" className="group grid gap-2 py-4 transition-colors sm:grid-cols-[7rem_1fr_auto] sm:items-start sm:gap-4">
                <div className="text-[.65rem] leading-[1.7] text-soft">
                  <span className="block font-semibold text-accent">{meta.label}</span>
                  {readableUpdateDate(item.publishedAt) && <time className="mt-0.5 block">{readableUpdateDate(item.publishedAt)}</time>}
                </div>
                <div>
                  <h4 dir="auto" className="text-start font-display text-[.91rem] font-medium leading-[1.7] text-ink transition-colors group-hover:text-accent">{item.title}</h4>
                  <p className="mt-1 text-[.74rem] font-light leading-[1.75] text-soft">{item.relation || meta.index}{item.source ? ` · ${item.source}` : ''}</p>
                </div>
                <span className="hidden pt-1 text-accent transition-transform duration-300 group-hover:-translate-x-1 sm:block">↗</span>
              </a>
            )
          })}
        </div>
      )}
      <p className="relative mt-4 border-t border-hair pt-4 text-[.68rem] font-light leading-[1.8] text-soft">مستجدات منتقاة توسّع سياق الفكرة وتفتح باباً لقراءتها في الحاضر.</p>
    </section>
  )
}

function TimePanel({ article, model, close }: { article: ArticleRecord; model: ReturnType<typeof buildIdeaLife>; close: () => void }) {
  const predictionIndex = model.updates.length ? '02' : '01'
  const archiveIndex = String(1 + (model.updates.length ? 1 : 0) + (model.predictions.length ? 1 : 0)).padStart(2, '0')
  return (
    <div className="space-y-10">
      {model.updates.length > 0 && <IdeaUpdatesPanel updates={model.updates} />}
      {model.predictions.length > 0 && (
        <section>
          <SectionTitle index={predictionIndex} title="ما الذي وضعه النص أمام الزمن؟" sub="لا نحكم بصح أو خطأ من خبر واحد؛ نراقب الاتجاه والتوقيت والحجم والنطاق." />
          <div className="mt-6 space-y-8">
            {model.predictions.map((prediction, index) => (
              <article key={`${prediction.quote}-${index}`} className="border-b border-hair pb-8 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-accent/25 px-3 py-1 text-[.7rem] font-semibold text-accent">{prediction.status}</span>
                  {prediction.laterArticle && <span className="text-[.7rem] text-soft">إشارة لاحقة: {prediction.laterArticle.iso.slice(0, 4)}</span>}
                </div>
                <blockquote className="mt-4 font-display text-[1.02rem] font-medium leading-[1.9] text-ink">«{prediction.quote}»</blockquote>
                <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-hair pt-5 sm:grid-cols-2">
                  {[
                    ['الاتجاه', prediction.dimensions.direction],
                    ['التوقيت', prediction.dimensions.timing],
                    ['حجم التأثير', prediction.dimensions.scale],
                    ['النطاق', prediction.dimensions.scope],
                  ].map(([term, detail]) => (
                    <div key={term}>
                      <dt className="text-[.68rem] font-semibold text-accent">{term}</dt>
                      <dd className="mt-1.5 text-[.8rem] font-light leading-[1.75] text-soft">{detail}</dd>
                    </div>
                  ))}
                </dl>
                {verifiedEvidence(prediction.evidence).length ? (
                  <div className="mt-5 border-t border-hair pt-4">
                    <p className="text-[.68rem] font-semibold text-accent">أدلة عامة اجتازت الفحص</p>
                    <div className="mt-3 space-y-2">
                      {verifiedEvidence(prediction.evidence).map((evidence) => (
                        <a key={evidence.url} href={evidence.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-4 text-[.8rem] leading-[1.7] text-soft transition-colors hover:text-accent">
                          <span>{evidence.title}</span><span className="shrink-0">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {model.timeLinks.length > 0 && (
        <section>
          <SectionTitle index={archiveIndex} title="الفكرة داخل أرشيفها" sub="من البدايات الأولى للفكرة إلى امتداداتها عبر الزمن." />
          <ol className="relative mt-6 space-y-6 before:absolute before:bottom-2 before:right-[7px] before:top-2 before:w-px before:bg-hair">
            {model.timeLinks.map((link) => (
              <li key={link.article.slug} className="relative ps-7">
                <span className="absolute right-0 top-[.42rem] h-3.5 w-3.5 rounded-full border-2 border-accent bg-canvas" />
                <div className="flex flex-wrap items-center gap-2 text-[.68rem] font-semibold text-accent">
                  <span>{link.role}</span><span className="text-hair">·</span><time>{link.article.iso.slice(0, 4)}</time>
                </div>
                <Link to={`/articles/${link.article.slug}`} onClick={close} className="mt-1.5 block font-display text-[1rem] font-medium leading-[1.65] text-ink transition-colors hover:text-accent">
                  {link.article.title}
                </Link>
                <p className="mt-1 text-[.72rem] text-soft">{arabicCountPhrase(link.overlap, TOPICAL_CONNECTION_FORMS, number.format)}</p>
              </li>
            ))}
          </ol>
          <Link
            to={`/decade?${new URLSearchParams({ عرض: 'تنبؤات', فكرة: article.title, مقال: article.slug }).toString()}`}
            onClick={close}
            className="mt-7 inline-flex items-center gap-2 border-b border-accent/[.35] pb-1 text-[.78rem] font-semibold text-accent"
          >
            سجل التنبؤات والمراجعات الكامل <ArrowIcon />
          </Link>
        </section>
      )}
    </div>
  )
}

function ImpactLink({ node, close }: { node: ImpactNode; close: () => void }) {
  const content = (
    <>
      <span className="block text-[.68rem] font-semibold text-accent">{node.label}{node.year ? ` · ${node.year}` : ''}</span>
      <strong className="mt-1.5 block font-display text-[.98rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{node.title}</strong>
      <span className="mt-1.5 block text-[.76rem] font-light leading-[1.75] text-soft">{node.note}</span>
      {node.source && <span className="mt-2 block text-[.68rem] text-soft/75">المصدر: {node.source}</span>}
    </>
  )
  if (node.to) return <Link to={node.to} onClick={close} className="group block">{content}</Link>
  const url = liveLink(node.url)
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="group block">{content}</a>
  return null
}

function ImpactPanel({ article, model, close }: { article: ArticleRecord; model: ReturnType<typeof buildIdeaLife>; close: () => void }) {
  const detailedImpact = model.impact.length > 1
  return (
    <div>
      {/* نُقل المسار الموجز إلى داخل «حياة الفكرة»: الميزة كاملة، لكن نهاية المقال أنظف. */}
      <IdeaTrace article={article} model={model} embedded />
      {detailedImpact && (
        <>
          <SectionTitle index="01" title="كيف امتدت الفكرة، وما الذي ثبت من أثرها؟" sub="محطات تكشف أين عادت الفكرة للظهور، وأين أصبح لها أثر موثق." />
          <ol className="relative mt-7 space-y-7 before:absolute before:bottom-3 before:right-[7px] before:top-3 before:w-px before:bg-hair">
            {model.impact.map((node, index) => (
              <li key={`${node.label}-${node.title}-${index}`} className="relative ps-8">
                <span className={`absolute right-0 top-[.35rem] flex h-4 w-4 items-center justify-center rounded-full border ${node.confidence === 'موثق' ? 'border-accent bg-accent' : 'border-accent/[.45] bg-canvas'}`}>
                  {node.confidence === 'موثق' && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
                </span>
                <ImpactLink node={node} close={close} />
              </li>
            ))}
          </ol>
        </>
      )}
      <div className={`${detailedImpact ? 'mt-8' : 'mt-2'} flex flex-wrap items-center justify-between gap-4 border-t border-hair pt-5`}>
        <p className="max-w-[34rem] text-[.72rem] font-light leading-[1.8] text-soft">كل محطة تعيدك إلى مادتها أو مصدرها، لتقرأ امتداد الفكرة في سياقه.</p>
        <Link to="/impact" reloadDocument onClick={close} className="inline-flex shrink-0 items-center gap-2 text-[.78rem] font-semibold text-accent">سجل الأثر الكامل <ArrowIcon /></Link>
      </div>
    </div>
  )
}

export default function IdeaLife({ article, articles, books, papers, media }: Props) {
  const remoteRecords = useExtras<IdeaLifeRemoteRecord>('site_idea_life')
  const radar = useExtras<IdeaRadarItem>('site_radar')
  const remote = remoteRecords.find((record) => record.slug === article.slug && (!record.kind || record.kind === 'article'))
  const model = useMemo(() => buildIdeaLife(article, articles, books, papers, media, remote, radar), [article, articles, books, papers, media, remote, radar])
  const threadNodes = useMemo(() => ideaThreadFor(article, books, papers, media), [article, books, papers, media])
  const revisions = useMemo(() => findIdeaRevisions(article, articles), [article, articles])
  const hasImpactExperience = model.impact.length > 1 || model.timeLinks.length > 0
  const experienceSignature = useMemo(() => `${model.signature}:${threadNodes.map((node) => `${node.kind}:${node.title}`).join('|')}`, [model.signature, threadNodes])
  const availableTabs = useMemo(() => [
    { key: 'test' as const, label: 'اختبار الفكرة', visible: true },
    { key: 'thread' as const, label: 'خيط الفكرة', visible: threadNodes.length > 0 },
    { key: 'time' as const, label: 'عبر الزمن', visible: model.updates.length > 0 || model.predictions.length > 0 || model.timeLinks.length > 0 },
    { key: 'impact' as const, label: 'أثر الفكرة', visible: hasImpactExperience },
    { key: 'revision' as const, label: 'كيف تغيّر رأيي', visible: revisions.length > 0 },
  ].filter((tab) => tab.visible), [hasImpactExperience, model, revisions, threadNodes])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('test')
  const [isNew, setIsNew] = useState(false)
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const triggerButton = useRef<HTMLButtonElement | null>(null)
  const dialog = useRef<HTMLElement | null>(null)

  useEffect(() => {
    try {
      const previous = localStorage.getItem(`idea-life:${article.slug}`)
      setIsNew(Boolean(previous && previous !== experienceSignature))
    } catch { setIsNew(false) }
  }, [article.slug, experienceSignature])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.dispatchEvent(new Event('reader:panel-open'))
    window.requestAnimationFrame(() => closeButton.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); return }
      if (event.key !== 'Tab' || !dialog.current) return
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
        .filter((element) => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    try { localStorage.setItem(`idea-life:${article.slug}`, experienceSignature); setIsNew(false) } catch { /* noop */ }
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      window.requestAnimationFrame(() => triggerButton.current?.focus())
    }
  }, [article.slug, experienceSignature, open])

  useEffect(() => {
    if (!availableTabs.some((item) => item.key === tab)) setTab(availableTabs[0]?.key || 'test')
  }, [availableTabs, tab])

  const modal = open ? (
        <motion.div
          className="reader-modal-overlay fixed inset-0 z-[320] flex items-end justify-center bg-ink/[.45] backdrop-blur-sm sm:items-center sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setOpen(false)}
        >
          <motion.section
            ref={dialog}
            role="dialog" aria-modal="true" aria-labelledby="idea-life-title"
            initial={{ opacity: 0, y: 28, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: .3, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="idea-life-dialog flex max-h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-hair bg-canvas shadow-[0_30px_100px_-36px_rgba(0,0,0,.65)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem]"
          >
            <header className="shrink-0 border-b border-hair px-5 pb-0 pt-5 md:px-8 md:pt-7">
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-3.5">
                  <OrbitMark />
                  <div className="min-w-0">
                    <p className="text-[.68rem] font-semibold text-accent">حياة الفكرة</p>
                    <h2 id="idea-life-title" className="mt-1 line-clamp-2 font-display text-[1.12rem] font-semibold leading-[1.5] text-ink md:text-[1.32rem]">{article.title}</h2>
                    <p className="mt-1 text-[.72rem] text-soft">تُختبر، تتصل بأرشيفها، وتلتقط ما يستجد حولها.</p>
                  </div>
                </div>
                <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="إغلاق حياة الفكرة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg>
                </button>
              </div>
              <div role="tablist" aria-label="أقسام حياة الفكرة" className="edge-fade mt-5 flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {availableTabs.map((item) => (
                  <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`relative shrink-0 pb-3 text-[.78rem] font-semibold transition-colors ${tab === item.key ? 'text-ink' : 'text-soft hover:text-accent'}`}>
                    <span className="inline-flex items-center gap-1.5">{item.label}{item.key === 'time' && model.updates.length > 0 && <span aria-label="توجد مستجدات موثقة" className="h-1.5 w-1.5 rounded-full bg-accent" />}</span>
                    {tab === item.key && <motion.span layoutId="idea-life-tab" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-7 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-9 md:py-9">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>
                  {tab === 'test' && <TestPanel model={model} />}
                  {tab === 'thread' && <ThreadPanel nodes={threadNodes} close={() => setOpen(false)} />}
                  {tab === 'time' && <TimePanel article={article} model={model} close={() => setOpen(false)} />}
                  {tab === 'impact' && <ImpactPanel article={article} model={model} close={() => setOpen(false)} />}
                  {tab === 'revision' && <RevisionPanel revisions={revisions} close={() => setOpen(false)} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        </motion.div>
  ) : null

  return (
    <>
      <section className="idea-life-entry mt-5 border-t border-hair pt-4" aria-label="حياة الفكرة">
        <button ref={triggerButton} type="button" onClick={() => { if (isNew && model.updates.length) setTab('time'); setOpen(true) }} className="group flex w-full items-center justify-between gap-5 text-start">
          <span className="flex min-w-0 items-center gap-3.5">
            <OrbitMark />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="font-display text-[1rem] font-semibold text-ink transition-colors group-hover:text-accent">حياة هذه الفكرة</strong>
                {isNew && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[.64rem] font-semibold text-accent">جديد منذ قراءتك</span>}
              </span>
              <span className="mt-0.5 block text-[.74rem] leading-[1.7] text-soft">
                اختبار فكري{threadNodes.length ? ' · خيط معرفي' : ''}{model.updates.length ? ' · مستجدات موثقة' : model.predictions.length ? ' · مراجعة زمنية' : ''}{hasImpactExperience ? ' · أثر الفكرة' : ''}
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-accent transition-colors group-hover:border-accent/40 group-hover:bg-accent/5">
            استكشف <ArrowIcon />
          </span>
        </button>
      </section>
      {typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
    </>
  )
}
