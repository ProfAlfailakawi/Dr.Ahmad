import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FadeUp, Page, Reveal } from '../components/ui'
import { getArticleNeighbors, relatedArticles, type ArticleRecord, type BookRecord, type MediaRecord, type PaperRecord } from '../lib/cms'
import { SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { CiteButton, Listen, OwnerEdit, Share } from '../components/extras'
import { ArticleProgressBar, ReaderControls, ReaderParagraphText, ReadingTimeLabel, usePopularQuotes } from '../components/ArticleReader'
import { SelectionTools } from '../components/IdeaFeatures'
import { openAudioPlayer } from '../components/AudioPlayer'
import { WriterResearcherBridge, markArticleRead } from '../components/ReaderResonance'
import { JsonLd, useSeo } from '../components/seo'
import { fetchOwnerCounts, useTrackView } from '../lib/views'
import { useAdminAuth } from '../lib/admin-auth'
import { articleSystem, ideaTokens } from '../lib/intelligence'
import { getArticleBody } from '../lib/article-bodies'
import { liveLink } from '../lib/dead-links'
import { usePersistentAudio } from '../lib/persistent-audio'
import { staticQuestions } from '../questions-data'
import { rememberIdeaVisit } from '../lib/idea-memory'
import bookTocLinks from '../data/book-toc-links.json'

const canUseDropCap = (paragraph: string) =>
  /^[\s\u061C\u200E\u200F]*[\u0621-\u064A]/.test(paragraph)


function SyncedArticleBody({ slug, body }: { slug: string; body: string }) {
  const audio = usePersistentAudio()
  const popularQuotes = usePopularQuotes(slug, body)
  const refs = useRef<(HTMLParagraphElement | null)[]>([])
  const [followEnabled, setFollowEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('article-audio-follow') !== 'off'
  })
  const paragraphs = useMemo(() => body.split('\n\n').map((text) => ({ text, words: Math.max(1, text.trim().split(/\s+/).length) })), [body])
  const totalWords = paragraphs.reduce((sum, item) => sum + item.words, 0)
  const paragraphStarts = useMemo(() => {
    let words = 0
    return paragraphs.map((paragraph) => {
      const start = words
      words += paragraph.words
      return start
    })
  }, [paragraphs])
  const activeAudio = Boolean(audio.track?.path === `/articles/${slug}` && !audio.track?.label.includes('الحوار') && audio.duration > 0)
  const activeParagraph = useMemo(() => {
    if (!activeAudio || !followEnabled || !audio.duration || !totalWords) return -1
    const currentWords = Math.min(totalWords - 1, Math.max(0, (audio.current / audio.duration) * totalWords))
    let index = 0
    for (let i = 0; i < paragraphStarts.length; i += 1) {
      if (currentWords >= paragraphStarts[i]) index = i
      else break
    }
    return index
  }, [activeAudio, audio.current, audio.duration, followEnabled, paragraphStarts, totalWords])

  const commitFollow = (value: boolean) => {
    setFollowEnabled(value)
    try { localStorage.setItem('article-audio-follow', value ? 'on' : 'off') } catch { /* noop */ }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('article-audio-follow-change', { detail: { enabled: value } }))
    }
  }

  useEffect(() => {
    const syncFollow = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (typeof next === 'boolean') setFollowEnabled(next)
    }
    window.addEventListener('article-audio-follow-change', syncFollow)
    return () => window.removeEventListener('article-audio-follow-change', syncFollow)
  }, [])

  useEffect(() => {
    if (!activeAudio || !followEnabled || activeParagraph < 0) return
    const element = refs.current[activeParagraph]
    if (!element) return
    const rect = element.getBoundingClientRect()
    const topLimit = 116
    const bottomLimit = window.innerHeight * 0.72
    if (rect.top < topLimit || rect.bottom > bottomLimit) {
      element.scrollIntoView({ behavior: audio.playing ? 'smooth' : 'auto', block: 'center' })
    }
  }, [activeAudio, activeParagraph, audio.playing, followEnabled])

  const seekParagraph = (index: number) => {
    if (!activeAudio || !audio.duration) return
    const previousWords = paragraphStarts[index] || 0
    audio.seekTo((previousWords / totalWords) * audio.duration)
    if (!audio.playing) void audio.toggle()
  }

  return (
    <>
      {/* أُزيل شريط «تتبع المقالة» بطلب الدكتور — مكرر: زر «تتبع النص» في مشغل
          الصوت يدير الحالة نفسها (article-audio-follow) والنقر على الفقرات باقٍ. */}
      <div id="article-body" className={`article-body mt-7 ${activeAudio ? 'article-body-synced' : ''}`}>
        {paragraphs.map((paragraph, index) => {
          const paragraphQuotes = popularQuotes.filter((quote) => quote.paragraph === index)
          return (
            <div key={index} className="popular-highlight-paragraph group relative">
              <p
                ref={(element) => { refs.current[index] = element }}
                data-reader-paragraph={index}
                onClick={() => seekParagraph(index)}
                className={`${index === 0 && canUseDropCap(paragraph.text) ? 'dropcap ' : ''}${activeAudio ? 'synced-paragraph' : ''}${index === activeParagraph ? ' is-audio-active' : ''}`.trim() || undefined}
              >
                <ReaderParagraphText text={paragraph.text} popularQuotes={paragraphQuotes} />
              </p>
            </div>
          )
        })}
      </div>
    </>
  )
}


/* ---------- «حوار عبر الزمن» — الأرشيف يتحاور مع نفسه ----------
   يربط المقال بأقربه موضوعاً على بُعد ٣ سنوات فأكثر: القديم يشير للعودة،
   والجديد يشير للجذر — فيرى القارئ فكراً يتطوّر عبر عقد، لا أرشيفاً يتكدّس. */
const AR_STOP = new Set(['على','إلى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','بين','بعد','قبل','عند','حتى','كان','كانت','هل','ما','لا','لم','لن','قد','ثم','أو','أم','بل','كل','بعض','غير','نحو','لدى','منذ','حين','حول','أن','إن','لأن','كيف','أين','ليس','وهو','وهي'])
const normAr = (s: string) => s
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^\w\u0600-\u06FF ]/g, ' ')
const tokensOf = (s: string) => new Set(normAr(s).split(/\s+/).filter((w) => w.length > 2 && !AR_STOP.has(w) && !/^ال..$/.test(w)))

type ArticleTimeSeed = { slug: string; title: string; iso: string; cat: string; excerpt?: string }

function ideaTimePair(a: ArticleTimeSeed, articles: ArticleTimeSeed[]) {
    const mine = tokensOf(a.title + ' ' + (a.excerpt || ''))
    const myYear = +a.iso.slice(0, 4)
    let older: { art: ArticleTimeSeed; score: number; fallback?: boolean } | null = null
    let newer: { art: ArticleTimeSeed; score: number; fallback?: boolean } | null = null
    let olderFallback: { art: ArticleTimeSeed; score: number; fallback: true } | null = null
    let newerFallback: { art: ArticleTimeSeed; score: number; fallback: true } | null = null
    for (const o of articles) {
      if (o.slug === a.slug) continue
      const gap = +o.iso.slice(0, 4) - myYear
      if (Math.abs(gap) < 3) continue
      let score = 0
      for (const w of tokensOf(o.title + ' ' + (o.excerpt || ''))) if (mine.has(w)) score++
      if (o.cat === a.cat) score += 1
      const fallbackScore = (o.cat === a.cat ? 2 : 0) + Math.min(Math.abs(gap), 12) / 12
      if (gap < 0 && (!olderFallback || fallbackScore > olderFallback.score)) olderFallback = { art: o, score: fallbackScore, fallback: true }
      if (gap > 0 && (!newerFallback || fallbackScore > newerFallback.score)) newerFallback = { art: o, score: fallbackScore, fallback: true }
      if (score < 2) continue
      if (gap < 0 && (!older || score > older.score)) older = { art: o, score }
      if (gap > 0 && (!newer || score > newer.score)) newer = { art: o, score }
    }
    return { older: older?.art ?? olderFallback?.art ?? null, newer: newer?.art ?? newerFallback?.art ?? null }
}

function IdeaEvolutionCard({ a, articles }: { a: ArticleTimeSeed; articles: ArticleTimeSeed[] }) {
  const pair = useMemo(() => ideaTimePair(a, articles), [a, articles])
  const years = [pair.older?.iso.slice(0, 4), a.iso.slice(0, 4), pair.newer?.iso.slice(0, 4)].filter(Boolean)
  if (!pair.older && !pair.newer) return null
  return (
    <FadeUp>
      <aside className="idea-evolution mt-8 rounded-2xl border border-hair bg-wash/65 px-5 py-4">
        <p className="text-[.72rem] font-semibold text-accent">خريطة تطور الفكرة</p>
        <p className="mt-2 text-[.86rem] leading-[1.9] text-soft">
          هذه الفكرة لا تقف وحدها؛ تظهر ضمن مسار يمتد {years.length > 1 ? `بين ${years[0]} و${years[years.length - 1]}` : `من عام ${a.iso.slice(0, 4)}`}. اقرأها كحلقة في تفكير يتطور، لا كصفحة منفصلة.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pair.older && (
            <Link to={`/articles/${pair.older.slug}`} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent">
              الجذر: {pair.older.iso.slice(0, 4)}
            </Link>
          )}
          {pair.newer && (
            <Link to={`/articles/${pair.newer.slug}`} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent">
              التطور: {pair.newer.iso.slice(0, 4)}
            </Link>
          )}
        </div>
      </aside>
    </FadeUp>
  )
}

function TimeDialogue({ a, articles }: { a: ArticleTimeSeed; articles: ArticleTimeSeed[] }) {
  const pair = useMemo(() => ideaTimePair(a, articles), [a, articles])

  if (!pair.older && !pair.newer) return null
  const yr = (iso: string) => iso.slice(0, 4)
  const diff = (iso: string) => Math.abs(+yr(iso) - +yr(a.iso))
  const yearsWord = (n: number) => (n === 1 ? 'سنة' : n === 2 ? 'سنتين' : n <= 10 ? `${n} سنوات` : `${n} سنة`)

  return (
    <FadeUp>
      <aside id="time-dialogue" className="mt-14 border-t border-hair pt-8">
        <p className="text-[.76rem] font-semibold text-accent">✦ حوار عبر الزمن</p>
        <div className="mt-4 space-y-4">
          {pair.older && (
            <Link to={`/articles/${pair.older.slug}`} className="group block">
              <p className="text-[.95rem] font-light leading-[1.9] text-soft">
                كتبتُ في هذا قبل {yearsWord(diff(pair.older.iso))} —{' '}
                <span className="font-medium text-ink transition-colors group-hover:text-accent">«{pair.older.title}» ({yr(pair.older.iso)})</span>. كيف تغيّر المشهد؟ قارن بنفسك{' '}
                <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </p>
            </Link>
          )}
          {pair.newer && (
            <Link to={`/articles/${pair.newer.slug}`} className="group block">
              <p className="text-[.95rem] font-light leading-[1.9] text-soft">
                ثم عدتُ إلى هذا الموضوع عام {yr(pair.newer.iso)} —{' '}
                <span className="font-medium text-ink transition-colors group-hover:text-accent">«{pair.newer.title}»</span>{' '}
                <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </p>
            </Link>
          )}
        </div>
      </aside>
    </FadeUp>
  )
}


/* «مسار قراءة» لا مجرد مقالات مرتبطة: أفضل بحثٍ وكتابٍ يلامسان فكرة المقال */
function deepDive(a: { title: string; excerpt?: string }, papers: PaperRecord[], books: BookRecord[]) {
  const mine = tokensOf(a.title + ' ' + (a.excerpt || ''))
  const best = <T extends { title: string }>(items: T[], extra: (x: T) => string) => {
    let top: T | null = null, topScore = 1
    for (const it of items) {
      let s = 0
      for (const w of tokensOf(it.title + ' ' + extra(it))) if (mine.has(w)) s++
      if (s > topScore) { topScore = s; top = it }
    }
    return top
  }
  return {
    paper: best(papers, (paper) => paper.meta || ''),
    book: best(books, (book) => book.desc || ''),
  }
}

type BookTocSection = { label: string; pages: string; keywords?: string[] }
type BookTocLink = { title: string; sections?: BookTocSection[] }

function bestBookTocMatch(article: ArticleRecord) {
  const articleText = `${article.title} ${article.excerpt || ''} ${article.cat} ${article.body || ''}`
  const mine = tokensOf(articleText)
  let best: { bookTitle: string; section: BookTocSection; score: number } | null = null
  for (const book of (bookTocLinks as { books?: BookTocLink[] }).books || []) {
    for (const section of book.sections || []) {
      let score = 0
      for (const token of tokensOf(`${book.title} ${section.label}`)) if (mine.has(token)) score += 1
      for (const keyword of section.keywords || []) {
        if ([...tokensOf(keyword)].some((token) => mine.has(token))) score += 2
      }
      if (score > (best?.score || 0)) best = { bookTitle: book.title, section, score }
    }
  }
  return best && best.score >= 3 ? best : null
}


function IdeaThread({ article, books, papers, media }: { article: ArticleRecord; books: BookRecord[]; papers: PaperRecord[]; media: MediaRecord[] }) {
  const path = useMemo(() => {
    const mine = tokensOf(`${article.title} ${article.excerpt || ''} ${article.cat}`)
    const score = (value: string) => {
      let total = 0
      for (const token of tokensOf(value)) if (mine.has(token)) total += 1
      return total
    }
    const best = <T,>(items: T[], text: (item: T) => string) => [...items]
      .map((item, index) => ({ item, index, score: score(text(item)) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.item

    const book = best(books, (item) => `${item.title} ${item.desc || ''}`)
    const paper = best(papers, (item) => `${item.title} ${item.meta || ''}`)
    const appearance = best(media, (item) => `${item.title} ${item.outlet}`)
    const question = best(staticQuestions, (item) => `${item.ar} ${item.take}`)
    return [
      book && { kind: 'كتاب', title: book.title, to: `/publications/${book.slug}` },
      paper && { kind: 'بحث', title: paper.title, to: `/research/${paper.slug}` },
      appearance && { kind: 'لقاء', title: appearance.title, href: appearance.url },
      question && { kind: 'سؤال', title: question.ar, to: '/questions' },
    ].filter(Boolean) as { kind: string; title: string; to?: string; href?: string }[]
  }, [article.cat, article.excerpt, article.title, books, media, papers])

  if (!path.length) return null
  return (
    <FadeUp>
      <section id="idea-thread" className="idea-thread mt-14 overflow-hidden rounded-[2rem] border border-hair bg-wash/45 px-5 py-6 shadow-[0_18px_50px_rgba(20,24,32,.04)] md:px-8 md:py-8" aria-label="خيط الفكرة">
        <div className="max-w-[42rem]">
          <p className="text-[.68rem] font-semibold text-accent">خيط الفكرة</p>
          <h2 className="mt-1 font-display text-[1.18rem] font-semibold leading-[1.55] text-ink md:text-[1.35rem]">الفكرة لا تعيش في صفحة واحدة.</h2>
        </div>
        <ol className="mobile-card-rail relative mt-7 grid gap-4 md:grid-cols-4 md:gap-5">
          <span aria-hidden className="absolute bottom-6 right-[.7rem] top-6 w-px bg-hair md:bottom-auto md:left-4 md:right-4 md:top-[1.05rem] md:h-px md:w-auto" />
          {path.map((node, index) => {
            const content = <><span className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-accent/30 bg-canvas shadow-sm"><span className="h-2 w-2 rounded-full bg-accent" /></span><span className="mt-3 block text-[.62rem] font-semibold text-accent">{String(index + 1).padStart(2, '0')} · {node.kind}</span><span dir="auto" className="mt-1.5 block break-words text-start font-display text-[.88rem] font-medium leading-[1.65] text-ink transition-colors [overflow-wrap:anywhere] [text-wrap:balance] group-hover:text-accent md:text-[.94rem]">{node.title}</span></>
            return (
              <li key={`${node.kind}-${node.title}`} className="relative pe-9 md:pe-0">
                {node.to ? <Link to={node.to} className="group block h-full rounded-2xl bg-canvas/70 px-4 py-3 transition-colors hover:bg-canvas">{content}</Link> : <a href={node.href} target="_blank" rel="noreferrer" className="group block h-full rounded-2xl bg-canvas/70 px-4 py-3 transition-colors hover:bg-canvas">{content}</a>}
              </li>
            )
          })}
        </ol>
      </section>
    </FadeUp>
  )
}


/* شارة المالك: تظهر للمشرف وحده بجانب العنوان — مشاهدات ومشاركات المقال */
function OwnerBadge({ path }: { path: string }) {
  const { isAdmin } = useAdminAuth()
  const [c, setC] = useState<{ views: number; shares: number } | null>(null)
  useEffect(() => {
    if (!isAdmin) return
    let on = true
    fetchOwnerCounts(path).then((r) => { if (on) setC(r) })
    return () => { on = false }
  }, [isAdmin, path])
  if (!isAdmin || !c) return null
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-canvas/80 px-3 py-1 align-middle text-[.72rem] font-medium text-soft" title="يظهر لك وحدك — أرقام داخلية موثقة من الموقع">
      <span>{c.views.toLocaleString('en-US')} مشاهدة</span>
      <span className="text-hair">·</span>
      <span>{c.shares.toLocaleString('en-US')} مشاركة</span>
    </span>
  )
}

function ArchiveContext({ a }: { a: ArticleRecord }) {
  const year = Number(a.iso.slice(0, 4))
  if (!year || year > 2019) return null
  const needsTimeContext = /(تقنية|إعلام|بحث|التعليم|التربية)/.test(a.cat)
  return (
    <FadeUp>
      <aside className="mt-8 rounded-2xl border border-hair bg-wash px-5 py-4">
        <p className="text-[.74rem] font-semibold text-accent">مقال من الأرشيف</p>
        <p className="mt-1 text-[.86rem] font-light leading-[1.8] text-soft">
          نُشر عام {year.toLocaleString('en-US')}، ويُقرأ بوصفه جزءاً من سياقه الزمني ومسار تطوّر الفكرة.
          {needsTimeContext ? ' بعض النقاشات التقنية والتربوية تتغير مع الزمن، لذلك يبقى التاريخ هنا جزءاً من معنى النص.' : ''}
        </p>
      </aside>
    </FadeUp>
  )
}

function StudentArchive({ a, articles, books, papers }: { a: ArticleRecord; articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[] }) {
  const pack = useMemo(() => articleSystem(a, articles, books, papers), [a, articles, books, papers])
  const bookPageLink = useMemo(() => bestBookTocMatch(a), [a])
  const terms = Array.from(new Set(ideaTokens(`${a.title} ${a.excerpt || ''} ${a.body || ''}`))).slice(0, 5)
  const relatedArticle = pack.relatedArticles[0]
  const relatedPaper = pack.relatedPapers[0]
  const relatedBook = pack.relatedBooks[0]
  const topic = terms.slice(0, 2).join(' و') || a.cat
  const researchIdea = relatedPaper
    ? `قارن هذا المقال بنتائج بحث «${relatedPaper.title}»: أين يلتقي النص الفكري مع الدليل الأكاديمي، وأين يفتح سؤالاً جديداً؟`
    : relatedBook
      ? `اقرأ الفكرة بجوار كتاب «${relatedBook.title}»: كيف تتحول من تأمل صحفي إلى إطار تعليمي أوسع؟`
      : `اختبر حضور «${topic}» في موقف تعليمي واقعي: ما الذي يتغير في الطالب أو المعلم عندما نأخذ هذه الفكرة بجدية؟`
  const quickPath = relatedArticle
    ? { label: `ابدأ بمقال «${relatedArticle.title}»`, to: `/articles/${relatedArticle.slug}` }
    : relatedPaper
      ? { label: `ابدأ ببحث «${relatedPaper.title}»`, to: `/research/${relatedPaper.slug}` }
      : relatedBook
        ? { label: `ابدأ بكتاب «${relatedBook.title}»`, to: `/publications/${relatedBook.slug}` }
        : null
  return (
    <FadeUp>
      <details id="student-archive" className="mt-14 rounded-2xl border border-hair bg-wash px-6 py-5">
        <summary className="cursor-pointer list-none font-display text-[1.15rem] font-semibold text-ink marker:hidden">
          للطلاب والباحثين <span className="text-accent">＋</span>
        </summary>
        <div className="mobile-card-rail mt-5 grid gap-5 border-t border-hair pt-5 md:grid-cols-2">
          <div>
            <p className="text-[.76rem] font-semibold text-accent">سؤال نقاش</p>
            <p className="mt-2 text-[.9rem] leading-relaxed text-soft">{pack.studentQuestion}</p>
          </div>
          <div>
            <p className="text-[.76rem] font-semibold text-accent">فكرة بحثية</p>
            <p className="mt-2 text-[.9rem] leading-relaxed text-soft">{researchIdea}</p>
          </div>
          <div>
            <p className="text-[.76rem] font-semibold text-accent">مصطلحات مفتاحية</p>
            <p className="mt-2 text-[.9rem] leading-relaxed text-soft">{terms.join(' · ') || a.cat}</p>
          </div>
          <div>
            <p className="text-[.76rem] font-semibold text-accent">للإحالة السريعة</p>
            {quickPath ? (
              <Link to={quickPath.to} className="mt-2 inline-block text-[.9rem] leading-relaxed text-soft transition-colors hover:text-accent">
                {quickPath.label} ←
              </Link>
            ) : (
              <p className="mt-2 text-[.9rem] leading-relaxed text-soft">استخدم زر «انسخ الاستشهاد» أسفل المقال، ثم اربطه بأقرب مصدر من «أكمل هذا المسار».</p>
            )}
            {bookPageLink && (
              <p className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-soft">
                قريب من «{bookPageLink.bookTitle}»<br />
                {bookPageLink.section.label} · الصفحات {bookPageLink.section.pages}
              </p>
            )}
          </div>
        </div>
      </details>
    </FadeUp>
  )
}

/* روابط الامتدادات كانت تقفز فقط: الهيدر الثابت يبتلع أعلى القسم، والبطاقة
   المطوية (details) تبقى مغلقة فيظن الزائر أن شيئاً لم يحدث. نفتح الهدف ونضعه
   تحت الهيدر بهدوء — والحارس العام يغلق ما سواه. */
function goToLayer(href: string) {
  const target = document.querySelector<HTMLElement>(href)
  if (!target) return
  const details = target instanceof HTMLDetailsElement ? target : target.querySelector('details')
  if (details instanceof HTMLDetailsElement && !details.open) {
    details.open = true
    details.dispatchEvent(new Event('toggle', { bubbles: false }))
  }
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function ReadingLayers({ hasAudio, hasEvolution, slug }: { hasAudio: boolean; hasEvolution: boolean; slug: string }) {
  const links = [
    { href: '#article-body', label: 'قراءة سريعة', note: 'النص' },
    hasEvolution ? { href: '#time-dialogue', label: 'قراءة عميقة', note: 'تطور الفكرة' } : null,
    { href: '#student-archive', label: 'للطلاب والباحثين', note: 'سؤال ومراجع' },
    hasAudio ? { action: 'audio' as const, label: 'استماع', note: 'الصوت' } : null,
  ].filter(Boolean) as ({ href: string; action?: never; label: string; note: string } | { action: 'audio'; href?: never; label: string; note: string })[]

  return (
    <FadeUp>
      <nav className="reader-layers mt-7 rounded-2xl border border-hair bg-wash/55 px-4 py-3" aria-label="طبقات قراءة المقال">
        <p className="text-[.72rem] font-semibold text-accent">طبقات القراءة</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            link.action === 'audio' ? (
              <button key="audio" type="button" onClick={() => openAudioPlayer(`article-audio-${slug}`)} className="rounded-full border border-hair bg-canvas px-3.5 py-1.5 text-[.76rem] leading-[1.5] text-soft transition-colors hover:border-accent hover:text-accent">
                <span className="font-semibold text-ink">{link.label}</span>
                <span className="ms-2 text-soft/80">{link.note}</span>
              </button>
            ) : (
              <a key={link.href} href={link.href} onClick={(event) => { event.preventDefault(); goToLayer(link.href as string) }} className="rounded-full border border-hair bg-canvas px-3.5 py-1.5 text-[.76rem] leading-[1.5] text-soft transition-colors hover:border-accent hover:text-accent">
                <span className="font-semibold text-ink">{link.label}</span>
                <span className="ms-2 text-soft/80">{link.note}</span>
              </a>
            )
          ))}
        </div>
      </nav>
    </FadeUp>
  )
}

function ArticleClosingNote({ next, related }: { next?: ArticleRecord; related: ArticleRecord[] }) {
  const target = next || related[0]
  return (
    <FadeUp>
      <aside className="article-closing-note mt-16 rounded-[2rem] border border-hair bg-wash/45 px-6 py-6 text-center md:px-8">
        <p className="font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">إن بقي السؤال مفتوحًا، فهذا جزء من قيمة الفكرة.</p>
        <p className="mx-auto mt-2 max-w-[520px] text-[.86rem] leading-[1.9] text-soft">
          تستطيع أن تتابع خيطها عبر الزمن، أو تنتقل إلى نص قريب يكمل المعنى من زاوية أخرى.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a href="#time-dialogue" onClick={(event) => { event.preventDefault(); goToLayer('#time-dialogue') }} className="rounded-full border border-hair px-4 py-2 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent">حوار عبر الزمن</a>
          {target && (
            <Link to={`/articles/${target.slug}`} className="rounded-full border border-accent/30 px-4 py-2 text-[.78rem] text-accent transition-colors hover:bg-accent hover:text-white">
              {target === next ? 'المقال التالي' : 'مقال قريب'} ←
            </Link>
          )}
        </div>
      </aside>
    </FadeUp>
  )
}

function ArticleExtensions({
  article,
  articles,
  books,
  papers,
  media,
  hasEvolution,
  paper,
}: {
  article: ArticleRecord
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
  hasEvolution: boolean
  paper: PaperRecord | null
}) {
  const { isAdmin } = useAdminAuth()
  return (
    <div className="article-extensions mt-9 border-t border-hair pt-7">
      <p className="text-[.76rem] font-semibold text-accent">امتدادات المقال</p>
      <div className="pb-2">
        <ArchiveContext a={article} />
        <ReadingLayers hasAudio={Boolean(article.body)} hasEvolution={hasEvolution} slug={article.slug} />
        <StudentArchive a={article} articles={articles} books={books} papers={papers} />
        <WriterResearcherBridge articleTitle={article.title} paper={paper ? { slug: paper.slug, title: paper.title } : null} />
        <TimeDialogue a={article} articles={articles} />
        <IdeaThread article={article} books={books} papers={papers} media={media} />
        {isAdmin && (
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-hair pt-5" aria-label="أدوات المشرف">
            <OwnerEdit tab="articles" slug={article.slug} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ArticleDetail() {
  const { slug } = useParams()
  const { articles, books, papers, media, loading } = useCmsContent()
  const a = articles.find((article) => article.slug === slug)
  const [staticBody, setStaticBody] = useState<string | undefined>()
  const [bodyLoading, setBodyLoading] = useState(false)

  const neighbors = useMemo(() => a ? getArticleNeighbors(a.slug, articles) : { prev: undefined, next: undefined }, [a, articles])
  const related = useMemo(() => a ? relatedArticles(a, 3, articles) : [], [a, articles])
  const dive = useMemo(() => (a ? deepDive(a, papers, books) : { paper: null, book: null }), [a, books, papers])
  const evolution = useMemo(() => (a ? ideaTimePair(a, articles) : { older: null, newer: null }), [a, articles])

  useSeo({
    title: a?.title ?? 'مقال',
    description: a?.excerpt,
    path: `/articles/${slug}`,
    type: 'article',
    image: slug ? `/og/articles/${slug}.png` : undefined,
  })
  useTrackView(`/articles/${slug || ''}`, a?.title || 'مقال', Boolean(a))

  useEffect(() => {
    let active = true
    setStaticBody(undefined)
    if (!a || a.body) {
      setBodyLoading(false)
      return () => { active = false }
    }
    setBodyLoading(true)
    getArticleBody(a.slug)
      .then((body) => {
        if (active) setStaticBody(body)
      })
      .catch(() => {
        if (active) setStaticBody(undefined)
      })
      .finally(() => {
        if (active) setBodyLoading(false)
      })
    return () => { active = false }
  }, [a?.slug, a?.body])

  // يتذكّر جهازُك المقال والفكرة محليًا — بلا حساب ولا ملف شخصي ولا إرسال للخادم.
  useEffect(() => {
    if (!a) return
    try { localStorage.setItem('read:last', JSON.stringify({ slug: a.slug, title: a.title, at: Date.now() })) } catch { /* noop */ }
    markArticleRead(a.slug)
    rememberIdeaVisit({ slug: a.slug, title: a.title, cat: a.cat, excerpt: a.excerpt, body: a.body || staticBody })
  }, [a, staticBody])

  if (!a && loading)
    return (
      <Page className="content-articles article-journey">
        <div className="px-6 pt-44 text-center text-soft">لحظة…</div>
      </Page>
    )

  if (!a)
    return (
      <Page>
        <div className="px-6 pt-44 text-center text-soft">لم يُعثر على المقال.</div>
      </Page>
    )

  const { prev, next } = neighbors
  const article: ArticleRecord = { ...a, body: a.body || staticBody }

  return (
    <Page className="content-articles article-journey">
      <ArticleProgressBar slug={article.slug} />

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: a.title,
          datePublished: a.iso,
          author: { '@type': 'Person', name: 'د. أحمد حسين الفيلكاوي' },
          articleSection: a.cat,
          inLanguage: 'ar',
        }}
      />
      <article
        className="px-6 pb-24 pt-32 md:px-11 md:pt-40"
        data-print-citation={`للاستشهاد: ${a.title}، ${a.date}، الموقع الرسمي للدكتور أحمد حسين الفيلكاوي، ${SITE_URL}/articles/${a.slug}`}
      >
        <div className="mx-auto max-w-[720px]">
          <FadeUp delay={0.05}>
            <div className="flex flex-wrap items-center gap-3 text-[.8rem]">
              <span className="font-semibold text-accent">{a.cat}</span>
              <span className="h-1 w-1 rounded-full bg-hair" />
              <time className="text-soft">{a.date}</time>
              {article.body && (
                <>
                  <span className="h-1 w-1 rounded-full bg-hair" />
                  <ReadingTimeLabel slug={article.slug} text={article.body} />
                </>
              )}
            </div>
            <div className="mt-4 flex justify-start">
              <OwnerBadge path={`/articles/${article.slug}`} />
            </div>

            <h1 style={{ viewTransitionName: `article-${a.slug}` }} className="mt-5 text-wrap-balance font-display text-[clamp(2rem,4.6vw,3.1rem)] font-bold leading-[1.3] text-ink">
              <Reveal>{a.title}</Reveal>
            </h1>
            <div className="mt-6 h-[2px] w-16 bg-accent" />
            {article.body && (
              <div className="article-reading-actions mt-4 flex items-start gap-4 pb-1">
                <div id="article-audio" className="min-w-0 flex-1"><Listen compact slug={article.slug} title={article.title} text={article.body} audio={article.audio} audioControl={article.audioControl} /></div>
                <ReaderControls article={article} />
              </div>
            )}
            {article.body && (
              <p className="mt-1.5 text-[.68rem] leading-relaxed text-soft/75">
                حدّد أي جملة داخل المقال؛ تظهر عندها أداتا «عبر السنوات» و«بطاقة اقتباس».
              </p>
            )}
          </FadeUp>

          <FadeUp delay={0.12}>
            {bodyLoading ? (
              <div className="mt-7 rounded-xl border border-hair bg-wash p-8 text-center text-soft">
                أفتح نص المقال الكامل…
              </div>
            ) : article.body ? (
              <>
                <SyncedArticleBody slug={article.slug} body={article.body} />
                {/* أداة التحديد لا تظهر إلا حين يختار القارئ نصاً؛ لا تزاحم نهاية المقال. */}
                <SelectionTools current={article} articles={articles} body={article.body} excerpt={article.excerpt} />
              </>
            ) : (
              <>
                {a.excerpt && (
                  <p className="mt-11 border-r-2 border-accent ps-6 font-display text-[1.28rem] font-light leading-[1.95] text-ink/90">
                    {a.excerpt}
                  </p>
                )}
                <div className="mt-12 rounded-2xl border border-hair bg-wash p-8 text-center md:p-10">
                  <p className="font-display text-[1.4rem] font-semibold leading-[1.7] text-ink">
                    النص الكامل قيد الإضافة للأرشيف.
                  </p>
                  <p className="mx-auto mt-3 max-w-[420px] text-[.95rem] font-light leading-[1.9] text-soft">
                    أبقيت بيانات المقال ومصدره حتى لا ينقطع أثره، وسيُضاف النص الكامل ضمن دورة تنقية الأرشيف.
                  </p>
                  {liveLink(a.source) && (
                    <a
                      href={liveLink(a.source)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
                    >
                      اقرأ في مصدره الأصلي ←
                    </a>
                  )}
                </div>
              </>
            )}
          </FadeUp>

          <FadeUp>
            <section className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-hair pt-5" aria-label="مشاركة المقال والاستشهاد به">
              <Share compact title={a.title} path={`/articles/${a.slug}`} />
              <div className="flex flex-wrap items-center gap-5">
                {liveLink(article.source) && <a href={liveLink(article.source)} target="_blank" rel="noreferrer" className="text-[.78rem] text-soft transition-colors hover:text-accent">المصدر الأصلي</a>}
                <CiteButton compact title={a.title} year={a.iso.slice(0, 4)} container="الموقع الرسمي للدكتور أحمد حسين الفيلكاوي" url={`${SITE_URL}/articles/${a.slug}`} />
              </div>
            </section>
          </FadeUp>

          {(related.length > 0 || article.body) && (
            <FadeUp>
              <section className="mt-12 border-t border-hair pt-8">
                {related.length > 0 && (
                  <>
                    <span className="text-[.76rem] font-semibold uppercase text-accent">أكمل هذا المسار</span>
                    <p className="mt-2 text-[.9rem] font-light text-soft">مقالاتٌ على الخيط الفكري نفسه.</p>
                    <ul className="related-path-grid mobile-paired-grid mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
                      {related.slice(0, dive.paper || dive.book ? 2 : 3).map((r) => (
                        <li key={r.slug} className="min-w-0">
                          <Link to={`/articles/${r.slug}`} viewTransition className="group block h-full min-w-0 rounded-xl border border-hair bg-canvas p-4 text-start transition-colors hover:border-accent/40 sm:border-0 sm:bg-transparent sm:p-0">
                            <span className="text-[.72rem] font-semibold text-accent">مقال</span>
                            <span className="mt-1.5 block break-words font-display text-[.96rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent sm:text-[1.05rem]">{r.title}</span>
                            <time className="mt-1 block text-[.76rem] text-soft">{r.date}</time>
                          </Link>
                        </li>
                      ))}
                      {dive.paper && (
                        <li key={dive.paper.slug} className="min-w-0">
                          <Link to={`/research/${dive.paper.slug}`} className="group block h-full min-w-0 rounded-xl border border-hair bg-canvas p-4 text-start transition-colors hover:border-accent/40 sm:border-0 sm:bg-transparent sm:p-0">
                            <span className="text-[.72rem] font-semibold text-accent">بحث محكّم</span>
                            <span className="mt-1.5 block break-words font-display text-[.96rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent sm:text-[1.05rem]">{dive.paper.title}</span>
                            <span className="mt-1 block text-[.76rem] text-soft">للتعمّق الأكاديمي</span>
                          </Link>
                        </li>
                      )}
                      {dive.book && !dive.paper && (
                        <li key={dive.book.slug} className="min-w-0">
                          <Link to={`/publications/${dive.book.slug}`} className="group block h-full min-w-0 rounded-xl border border-hair bg-canvas p-4 text-start transition-colors hover:border-accent/40 sm:border-0 sm:bg-transparent sm:p-0">
                            <span className="text-[.72rem] font-semibold text-accent">كتاب</span>
                            <span className="mt-1.5 block break-words font-display text-[.96rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent sm:text-[1.05rem]">{dive.book.title}</span>
                            <span className="mt-1 block text-[.76rem] text-soft">للإحاطة الكاملة</span>
                          </Link>
                        </li>
                      )}
                    </ul>
                  </>
                )}
                {article.body && (
                  <ArticleExtensions article={article} articles={articles} books={books} papers={papers} media={media} hasEvolution={Boolean(evolution.older || evolution.newer)} paper={dive.paper} />
                )}
              </section>
            </FadeUp>
          )}

          <FadeUp>
            <nav className="mt-16 grid items-start gap-6 border-t border-hair pt-8 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              {next ? (
                <Link to={`/articles/${next.slug}`} className="group">
                  <span className="text-[.78rem] text-soft">السابق</span>
                  <span className="mt-1 block font-display text-[1.05rem] font-medium leading-[1.5] text-ink transition-colors group-hover:text-accent">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              <Link to="/articles" className="min-h-11 self-center border-b border-hair px-1 py-2 text-center text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">
                جميع المقالات
              </Link>
              {prev && (
                <Link to={`/articles/${prev.slug}`} className="group sm:text-left">
                  <span className="text-[.78rem] text-soft">التالي</span>
                  <span className="mt-1 block font-display text-[1.05rem] font-medium leading-[1.5] text-ink transition-colors group-hover:text-accent">
                    {prev.title}
                  </span>
                </Link>
              )}
            </nav>
          </FadeUp>
        </div>
      </article>
    </Page>
  )
}
