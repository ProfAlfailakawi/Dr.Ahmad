import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from '../lib/cms'
import { useExtras } from '../lib/content'
import { buildIdeaLife, type IdeaLifeRemoteRecord, type ImpactNode } from '../lib/idea-life'

const number = new Intl.NumberFormat('ar-KW-u-nu-latn')

type TabKey = 'test' | 'time' | 'impact'

type Props = {
  article: ArticleRecord
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
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
        <p className="mt-5 text-[.94rem] font-light leading-[2.05] text-ink/82">{model.test.counterargument}</p>
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

function TimePanel({ article, model, close }: { article: ArticleRecord; model: ReturnType<typeof buildIdeaLife>; close: () => void }) {
  return (
    <div className="space-y-10">
      {model.predictions.length > 0 && (
        <section>
          <SectionTitle index="01" title="ما الذي وضعه النص أمام الزمن؟" sub="لا نحكم بصح أو خطأ من خبر واحد؛ نراقب الاتجاه والتوقيت والحجم والنطاق." />
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
                {prediction.evidence?.length ? (
                  <div className="mt-5 border-t border-hair pt-4">
                    <p className="text-[.68rem] font-semibold text-accent">أدلة عامة اجتازت الفحص</p>
                    <div className="mt-3 space-y-2">
                      {prediction.evidence.map((evidence) => (
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
          <SectionTitle index={model.predictions.length ? '02' : '01'} title="الفكرة داخل أرشيفها" sub="الجذر والتطور يُستخرجان تلقائياً من تشابه المعنى والفاصل الزمني." />
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
                <p className="mt-1 text-[.72rem] text-soft">{number.format(link.overlap)} صلات موضوعية مشتركة</p>
              </li>
            ))}
          </ol>
          <Link
            to={`/decade?${new URLSearchParams({ عرض: 'تنبؤات', فكرة: article.title, مقال: article.slug }).toString()}`}
            onClick={close}
            className="mt-7 inline-flex items-center gap-2 border-b border-accent/35 pb-1 text-[.78rem] font-semibold text-accent"
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
  if (node.url) return <a href={node.url} target="_blank" rel="noreferrer" className="group block">{content}</a>
  return <div>{content}</div>
}

function ImpactPanel({ model, close }: { model: ReturnType<typeof buildIdeaLife>; close: () => void }) {
  return (
    <div>
      <SectionTitle index="01" title="كيف امتدت الفكرة، وما الذي ثبت من أثرها؟" sub="امتدادات الأرشيف تُسمّى صلة قوية؛ والأثر لا يُسمّى موثقاً إلا عندما يثبت المصدر العلاقة صراحةً." />
      <ol className="relative mt-7 space-y-7 before:absolute before:bottom-3 before:right-[7px] before:top-3 before:w-px before:bg-hair">
        {model.impact.map((node, index) => (
          <li key={`${node.label}-${node.title}-${index}`} className="relative ps-8">
            <span className={`absolute right-0 top-[.35rem] flex h-4 w-4 items-center justify-center rounded-full border ${node.confidence === 'موثق' ? 'border-accent bg-accent' : 'border-accent/45 bg-canvas'}`}>
              {node.confidence === 'موثق' && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
            </span>
            <ImpactLink node={node} close={close} />
          </li>
        ))}
      </ol>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-hair pt-5">
        <p className="max-w-[34rem] text-[.72rem] font-light leading-[1.8] text-soft">«صلة قوية» تعني امتداداً موضوعياً موثق الرابط، لا ادعاء استشهاد أو تطبيق. الأثر المباشر لا يُسمّى كذلك إلا عندما يثبت المصدر العلاقة صراحةً.</p>
        <Link to="/impact" onClick={close} className="inline-flex shrink-0 items-center gap-2 text-[.78rem] font-semibold text-accent">سجل الأثر الكامل <ArrowIcon /></Link>
      </div>
    </div>
  )
}

export default function IdeaLife({ article, articles, books, papers, media }: Props) {
  const remoteRecords = useExtras<IdeaLifeRemoteRecord>('site_idea_life')
  const remote = remoteRecords.find((record) => record.slug === article.slug && (!record.kind || record.kind === 'article'))
  const model = useMemo(() => buildIdeaLife(article, articles, books, papers, media, remote), [article, articles, books, papers, media, remote])
  const availableTabs = useMemo(() => [
    { key: 'test' as const, label: 'اختبار الفكرة', visible: true },
    { key: 'time' as const, label: 'عبر الزمن', visible: model.predictions.length > 0 || model.timeLinks.length > 0 },
    { key: 'impact' as const, label: 'امتدادها وأثرها', visible: model.impact.length > 1 },
  ].filter((tab) => tab.visible), [model])
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('test')
  const [isNew, setIsNew] = useState(false)
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const triggerButton = useRef<HTMLButtonElement | null>(null)
  const dialog = useRef<HTMLElement | null>(null)

  useEffect(() => {
    try {
      const previous = localStorage.getItem(`idea-life:${article.slug}`)
      setIsNew(Boolean(previous && previous !== model.signature))
    } catch { setIsNew(false) }
  }, [article.slug, model.signature])

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
    try { localStorage.setItem(`idea-life:${article.slug}`, model.signature); setIsNew(false) } catch { /* noop */ }
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
      window.requestAnimationFrame(() => triggerButton.current?.focus())
    }
  }, [article.slug, model.signature, open])

  useEffect(() => {
    if (!availableTabs.some((item) => item.key === tab)) setTab(availableTabs[0]?.key || 'test')
  }, [availableTabs, tab])

  const modal = open ? (
        <motion.div
          className="reader-modal-overlay fixed inset-0 z-[320] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          onClick={() => setOpen(false)}
        >
          <motion.section
            ref={dialog}
            role="dialog" aria-modal="true" aria-labelledby="idea-life-title"
            initial={{ opacity: 0, y: 28, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: .3, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[calc(100dvh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] border border-hair bg-canvas shadow-[0_30px_100px_-36px_rgba(0,0,0,.65)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem]"
          >
            <header className="shrink-0 border-b border-hair px-5 pb-0 pt-5 md:px-8 md:pt-7">
              <div className="flex items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-3.5">
                  <OrbitMark />
                  <div className="min-w-0">
                    <p className="text-[.68rem] font-semibold text-accent">حياة الفكرة</p>
                    <h2 id="idea-life-title" className="mt-1 line-clamp-2 font-display text-[1.12rem] font-semibold leading-[1.5] text-ink md:text-[1.32rem]">{article.title}</h2>
                    <p className="mt-1 text-[.72rem] text-soft">تُختبر، يراقبها الزمن، ويُوثَّق ما يثبت من أثرها.</p>
                  </div>
                </div>
                <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="إغلاق حياة الفكرة" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12" /><path d="M18 6 6 18" /></svg>
                </button>
              </div>
              <div role="tablist" aria-label="أقسام حياة الفكرة" className="mt-5 flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {availableTabs.map((item) => (
                  <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`relative shrink-0 pb-3 text-[.78rem] font-semibold transition-colors ${tab === item.key ? 'text-ink' : 'text-soft hover:text-accent'}`}>
                    {item.label}
                    {tab === item.key && <motion.span layoutId="idea-life-tab" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-7 pb-[calc(2rem+env(safe-area-inset-bottom))] md:px-9 md:py-9">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .2 }}>
                  {tab === 'test' && <TestPanel model={model} />}
                  {tab === 'time' && <TimePanel article={article} model={model} close={() => setOpen(false)} />}
                  {tab === 'impact' && <ImpactPanel model={model} close={() => setOpen(false)} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>
        </motion.div>
  ) : null

  return (
    <>
      <section className="idea-life-entry mt-11 border-y border-hair py-4" aria-label="حياة الفكرة">
        <button ref={triggerButton} type="button" onClick={() => setOpen(true)} className="group flex w-full items-center justify-between gap-5 text-start">
          <span className="flex min-w-0 items-center gap-3.5">
            <OrbitMark />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="font-display text-[1rem] font-semibold text-ink transition-colors group-hover:text-accent">حياة هذه الفكرة</strong>
                {isNew && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[.64rem] font-semibold text-accent">جديد منذ قراءتك</span>}
              </span>
              <span className="mt-0.5 block text-[.74rem] leading-[1.7] text-soft">
                اختبار فكري{model.predictions.length ? ' · مراجعة زمنية' : ''}{model.impact.length > 1 ? ' · امتداد وأثر' : ''}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1"><ArrowIcon /></span>
        </button>
      </section>
      {typeof document !== 'undefined' ? createPortal(modal, document.body) : null}
    </>
  )
}
