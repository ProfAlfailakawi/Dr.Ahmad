import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'
import { arabicCountPhrase, PAGE_FORMS } from '../lib/arabic-count.ts'
import { FadeUp, Reveal } from './ui'
import { SocialIcon } from './icons'
import { OwnerEdit } from './extras'

const CHANNEL_HANDLE = 'موسوعةتكنولوجياالتعليم'
const CHANNEL_URL = `https://www.youtube.com/@${CHANNEL_HANDLE}/videos`
const channelSearch = (query: string) => `https://www.youtube.com/@${CHANNEL_HANDLE}/search?query=${encodeURIComponent(query)}`
/* فيديو ثابت من القناة يُحمّل عند الطلب فقط. بقية المادة تُفتح من بحث القناة
   الموضوعي حتى لا نحمّل عشرات المشغلات ولا نربط الصفحة بقائمة قد يتغير معرّفها. */
const FEATURED_VIDEO_EMBED = 'https://www.youtube-nocookie.com/embed/r6gr8ovn2Lg?rel=0'
const formatArabicNumber = (value: number) => new Intl.NumberFormat('ar-KW-u-nu-arab').format(value)

const normalizeArabic = (value = '') => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tokensOf = (value: string) => normalizeArabic(value).split(' ').filter((token) => token.length > 1)
const scoreText = (tokens: string[], value = '') => {
  const normalized = normalizeArabic(value)
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? (token.length >= 6 ? 3 : 2) : 0), 0)
}

const DOORS = [
  {
    id: 'door-1', number: '٠١', title: 'المفاهيم والأسس',
    summary: 'مفهوم تكنولوجيا التعليم، وتصميم التدريس، والوسائل التعليمية، والمفاهيم المتداخلة معها.',
    topics: ['مفهوم تكنولوجيا التعليم', 'التدريس والتعليم والتعلّم', 'تصميم التدريس', 'تصميم التعليم', 'الاتصال التعليمي', 'الوسائل التعليمية'],
    presentation: '/files/encyclopedia/encyclopedia-door-1.pptx',
    hints: ['مفهوم تكنولوجيا التعليم', 'تصميم التدريس', 'الوسائل التعليمية'],
  },
  {
    id: 'door-2', number: '٠٢', title: 'المستحدثات والإنترنت في التعليم',
    summary: 'خصائص المستحدثات، وتوظيفها وأثرها ومعوقاتها، واستخدام الإنترنت في التعليم.',
    topics: ['المستحدثات التكنولوجية', 'خصائص المستحدثات', 'توظيف المستحدثات', 'معوقات التوظيف', 'الإنترنت في التعليم', 'التعلّم عبر الإنترنت'],
    presentation: '/files/encyclopedia/encyclopedia-door-2.pptx',
    hints: ['المستحدثات', 'الإنترنت في التعليم'],
  },
  {
    id: 'door-3', number: '٠٣', title: 'نماذج التعليم الإلكتروني والتعليم عن بُعد',
    summary: 'الحوسبة السحابية، والفصول المقلوبة، والتعليم المخلوط، وأجيال الويب، والكتاب الإلكتروني.',
    topics: ['الحوسبة السحابية', 'الفصول المقلوبة', 'التعليم المخلوط', 'الويب في التعليم', 'الكتاب الإلكتروني', 'التعليم عن بُعد'],
    presentation: '/files/encyclopedia/encyclopedia-door-3.pptx',
    hints: ['التعليم الإلكتروني', 'التعليم عن بعد', 'الحوسبة السحابية', 'الكتاب الإلكتروني'],
  },
  {
    id: 'door-4', number: '٠٤', title: 'تعليم القرن الحادي والعشرين',
    summary: 'دور المعلم والمتعلم، ومهارات القرن الحادي والعشرين، وتصنيف بلوم، والفجوة الرقمية.',
    topics: ['معلم القرن الحادي والعشرين', 'مهارات المتعلم', 'تصنيف بلوم', 'تصنيف بلوم الرقمي', 'الفجوة الرقمية', 'التربية المستدامة'],
    presentation: '/files/encyclopedia/encyclopedia-door-4.pptx',
    hints: ['القرن الحادي والعشرين', 'بلوم', 'الفجوة الرقمية'],
  },
] as const

type Door = (typeof DOORS)[number]
type AudienceKey = 'student' | 'teacher' | 'faculty' | 'family'

const AUDIENCES: Record<AudienceKey, { label: string; title: string; text: string; steps: string[]; action: string; href: string }> = {
  student: { label: 'الطالب', title: 'ادرس بترتيب واضح، ثم ارجع إلى المصدر.', text: 'اختر الباب، اقرأ محاوره، شاهد الشرح، ثم حمّل العرض للمراجعة.', steps: ['اختر الباب', 'اقرأ المفهوم', 'شاهد شرحه', 'راجع العرض'], action: 'ابدأ خريطة الموسوعة', href: '#encyclopedia-map' },
  teacher: { label: 'المعلم', title: 'حوّل المادة إلى درس من غير أن تبدأ من الصفر.', text: 'العروض جاهزة للتدريس، والفيديوهات مرتبطة بموضوعات الأبواب، والنص الأصلي يبقى مرجعك.', steps: ['حدّد الموضوع', 'حمّل العرض', 'اختر الفيديو', 'ارجع إلى الفصل'], action: 'افتح حقيبة التدريس', href: '#encyclopedia-teaching-kit' },
  faculty: { label: 'الأستاذ والمدرب', title: 'مرجع، ومادة محاضرة، ومسار مشاهدة في مكان واحد.', text: 'ابنِ محاضرة أو مقرراً، وشارك روابط موضوعية، وابحث في المتن بدل تصفح مئات الصفحات.', steps: ['ابنِ المسار', 'شارك الباب', 'استخدم الشرائح', 'وسّع بالمراجع'], action: 'ابحث في الموسوعة', href: '#encyclopedia-search' },
  family: { label: 'ولي الأمر والقارئ', title: 'ادخل من السؤال، لا من المصطلح الأكاديمي.', text: 'اكتب ما يشغلك في التعليم والتكنولوجيا؛ وستقودك الصفحة إلى أقرب مفهوم وفيديو وفصل.', steps: ['اكتب سؤالك', 'اقرأ النتيجة', 'شاهد التفسير', 'توسّع عند الحاجة'], action: 'اكتب سؤالك', href: '#encyclopedia-search' },
}

function conceptForDoor(door: Door, concepts: BookKnowledgeConcept[]) {
  const hints = door.hints.map(normalizeArabic)
  return concepts.find((concept) => {
    const haystack = normalizeArabic(`${concept.title} ${concept.keywords.join(' ')}`)
    return hints.some((hint) => haystack.includes(hint) || hint.includes(normalizeArabic(concept.title)))
  }) || null
}

function DoorRow({ door, concept, defaultOpen }: { door: Door; concept: BookKnowledgeConcept | null; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const bookHref = concept ? `/publications/encyclopedia?book_idea=${encodeURIComponent(concept.title)}#book-knowledge` : '#book-knowledge'
  return (
    <details id={door.id} className="group scroll-mt-28 border-b border-hair last:border-b-0" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-4 py-6 marker:hidden [&::-webkit-details-marker]:hidden md:grid-cols-[3rem_minmax(0,1fr)_auto] md:gap-6 md:py-8">
        <span className="font-display text-[.72rem] font-semibold text-accent">{door.number}</span>
        <span className="min-w-0"><strong className="block font-display text-[1.18rem] font-semibold leading-[1.55] text-ink md:text-[1.35rem]">{door.title}</strong><span className="mt-1.5 block max-w-3xl text-[.78rem] font-light leading-[1.85] text-soft md:text-[.84rem]">{door.summary}</span></span>
        <span aria-hidden className="mt-1 flex h-8 w-8 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">＋</span>
      </summary>
      <div className="grid gap-6 pb-8 ps-[4.1rem] md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:ps-[5.5rem]">
        <div className="border-y border-hair">
          {door.topics.map((topic) => <div key={topic} className="flex min-w-0 items-center justify-between gap-4 border-b border-hair py-3 last:border-b-0"><span className="min-w-0 text-[.78rem] leading-relaxed text-ink">{topic}</span><a href={channelSearch(topic)} target="_blank" rel="noreferrer" className="shrink-0 text-[.66rem] font-semibold text-accent hover:opacity-70">شاهد شرحه ←</a></div>)}
        </div>
        <div className="flex flex-wrap gap-2 md:max-w-[15rem] md:justify-end">
          <Link to={bookHref} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">ابدأ من الكتاب</Link>
          <a href={door.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${door.number}.pptx`} className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.7rem] font-semibold text-white transition-colors hover:bg-accent-deep">تحميل العرض</a>
        </div>
      </div>
    </details>
  )
}

export function EncyclopediaPortal({ book, articles, papers }: { book: BookRecord; articles: ArticleRecord[]; papers: PaperRecord[] }) {
  const navigate = useNavigate()
  const knowledge = getBookKnowledge(book.slug)
  const concepts = knowledge?.concepts.filter((concept) => !/^(?:مقدمة|الخاتمة|قائمة المراجع)/u.test(concept.title)) || []
  const [audience, setAudience] = useState<AudienceKey>('student')
  const [query, setQuery] = useState('')
  const [showVideos, setShowVideos] = useState(false)
  const pageCount = Number(book.pageCount) || 696
  const activeAudience = AUDIENCES[audience]
  const tokens = useMemo(() => tokensOf(query), [query])

  const searchResults = useMemo(() => {
    if (!tokens.length) return { concepts: [], doors: [], articles: [], papers: [] }
    return {
      concepts: concepts.map((concept) => ({ concept, score: scoreText(tokens, `${concept.title} ${concept.keywords.join(' ')} ${concept.summary} ${concept.question}`) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 4),
      doors: DOORS.map((door) => ({ door, score: scoreText(tokens, `${door.title} ${door.summary} ${door.topics.join(' ')}`) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 2),
      articles: articles.map((article) => ({ article, score: scoreText(tokens, `${article.title} ${article.excerpt || ''}`) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3),
      papers: papers.map((paper) => ({ paper, score: scoreText(tokens, `${paper.titleAr || paper.title} ${paper.meta || ''} ${paper.abstractAr || ''}`) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 2),
    }
  }, [articles, concepts, papers, tokens])

  const hasSearchResults = Object.values(searchResults).some((items) => items.length > 0)
  const stagedSearchHref = query.trim().length >= 2 ? `/publications/${book.slug}?book_question=${encodeURIComponent(query.trim())}#ask-book-section` : '#encyclopedia-search'

  return (
    <>
      <section className="encyclopedia-hero relative overflow-hidden border-b border-hair px-6 pb-14 pt-28 md:px-11 md:pb-20 md:pt-40">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-[9rem] h-px bg-gradient-to-l from-transparent via-accent/20 to-transparent md:top-[12rem]" />
        <div className="relative mx-auto max-w-shell">
          <FadeUp><Link to="/publications" className="text-[.8rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link></FadeUp>
          <div className="mt-8 grid items-center gap-10 lg:grid-cols-[minmax(15rem,.58fr)_minmax(0,1.42fr)] lg:gap-16">
            <FadeUp delay={0.05}><div className="mx-auto max-w-[18rem] overflow-hidden rounded-2xl border border-hair bg-white shadow-[0_24px_70px_-48px_rgba(20,31,45,.55)] lg:mx-0"><img src={book.cover} alt={`غلاف كتاب ${book.title}`} width="1024" height="720" fetchPriority="high" decoding="async" className="w-full" /></div></FadeUp>
            <div>
              <FadeUp delay={0.08}>
                <span className="text-[.72rem] font-semibold text-accent">بوابة معرفية مستقلة</span>
                <h1 className="mt-3 max-w-4xl font-display text-[clamp(2.25rem,5vw,4.1rem)] font-bold leading-[1.2] text-ink"><Reveal>{book.title}</Reveal></h1>
                {book.coAuthors && <p className="mt-3 text-[.84rem] text-soft">بالاشتراك مع {book.coAuthors}</p>}
                <OwnerEdit tab="books" slug={book.slug} className="mt-3" />
                <p className="mt-6 max-w-3xl text-[1rem] font-light leading-[2] text-ink/80 md:text-[1.08rem]">ثمرة أكثر من خمس سنوات من العمل؛ جُمعت هنا لتُقرأ وتُشاهد وتُدرّس ويُبحث فيها من مكان واحد.</p>
              </FadeUp>
              <FadeUp delay={0.13}>
                <nav className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hair bg-hair sm:grid-cols-4" aria-label="مداخل الموسوعة">
                  {[['اقرأ', '#encyclopedia-map'], ['شاهد', '#encyclopedia-video'], ['حمّل العروض', '#encyclopedia-teaching-kit'], ['ابحث', '#encyclopedia-search']].map(([label, href]) => <a key={href} href={href} className="flex min-h-14 items-center justify-center bg-canvas px-3 text-center text-[.76rem] font-semibold text-ink transition-colors hover:bg-wash hover:text-accent">{label}</a>)}
                </nav>
              </FadeUp>
              <FadeUp delay={0.18}>
                <dl className="mt-7 flex flex-wrap gap-x-7 gap-y-3 border-t border-hair pt-5 text-[.7rem] text-soft">
                  <div><dt className="sr-only">الأبواب</dt><dd><strong className="font-semibold text-ink">٤</strong> أبواب</dd></div>
                  <div><dt className="sr-only">الصفحات</dt><dd><strong className="font-semibold text-ink">{arabicCountPhrase(pageCount, PAGE_FORMS, formatArabicNumber)}</strong></dd></div>
                  <div><dt className="sr-only">العروض</dt><dd><strong className="font-semibold text-ink">٤</strong> عروض جاهزة</dd></div>
                  <div><dt className="sr-only">الفيديوهات</dt><dd><strong className="font-semibold text-ink">أكثر من ١٦٥</strong> فيديو</dd></div>
                  {book.year && <div><dt className="sr-only">سنة النشر</dt><dd><strong className="font-semibold text-ink">{book.year}</strong> سنة النشر</dd></div>}
                  {book.isbn && <div><dt className="sr-only">الردمك</dt><dd dir="ltr" className="text-left"><strong className="font-semibold text-ink">{book.isbn}</strong> <span dir="rtl">ردمك</span></dd></div>}
                </dl>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-hair px-6 py-12 md:px-11 md:py-16" aria-labelledby="encyclopedia-audience-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="grid gap-8 lg:grid-cols-[minmax(0,.65fr)_minmax(0,1.35fr)] lg:gap-14">
          <div><span className="text-[.7rem] font-semibold text-accent">ابدأ من حاجتك</span><h2 id="encyclopedia-audience-title" className="mt-2 font-display text-[clamp(1.45rem,3vw,2.15rem)] font-semibold leading-[1.45] text-ink">الموسوعة نفسها، لكن الطريق يتغيّر بحسب القارئ.</h2></div>
          <div>
            <div role="tablist" aria-label="اختر طريقة الاستفادة" className="flex max-w-full gap-1 overflow-x-auto border-b border-hair pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(Object.entries(AUDIENCES) as [AudienceKey, (typeof AUDIENCES)[AudienceKey]][]).map(([key, item]) => <button key={key} type="button" role="tab" aria-selected={audience === key} onClick={() => setAudience(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.72rem] font-semibold transition-colors ${audience === key ? 'bg-accent text-white' : 'text-soft hover:bg-wash hover:text-ink'}`}>{item.label}</button>)}
            </div>
            <div className="pt-6" role="tabpanel"><h3 className="font-display text-[1.2rem] font-semibold leading-[1.6] text-ink">{activeAudience.title}</h3><p className="mt-2 max-w-3xl text-[.84rem] font-light leading-[1.9] text-soft">{activeAudience.text}</p><ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3 text-[.7rem] text-soft">{activeAudience.steps.map((step, index) => <li key={step} className="flex items-center gap-2"><span className="font-display text-accent">{['٠١', '٠٢', '٠٣', '٠٤'][index]}</span><span>{step}</span>{index < activeAudience.steps.length - 1 && <span aria-hidden className="text-hair">←</span>}</li>)}</ol><a href={activeAudience.href} className="mt-6 inline-flex min-h-10 items-center rounded-full border border-accent/30 px-4 text-[.72rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">{activeAudience.action} ←</a></div>
          </div>
        </div></FadeUp></div>
      </section>

      <section id="encyclopedia-map" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-map-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="max-w-3xl"><span className="text-[.7rem] font-semibold text-accent">خريطة الموسوعة</span><h2 id="encyclopedia-map-title" className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.45rem)] font-semibold leading-[1.4] text-ink">أربعة أبواب، وكل باب يفتح النص والفيديو والعرض معاً.</h2></div></FadeUp><div className="mt-8 border-y border-hair">{DOORS.map((door, index) => <DoorRow key={door.id} door={door} concept={conceptForDoor(door, concepts)} defaultOpen={index === 0} />)}</div></div>
      </section>

      <section id="encyclopedia-search" className="scroll-mt-24 border-b border-hair bg-wash/40 px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-search-title">
        <div className="mx-auto max-w-4xl">
          <FadeUp>
            <span className="text-[.7rem] font-semibold text-accent">بحث موحّد</span>
            <h2 id="encyclopedia-search-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.3rem)] font-semibold leading-[1.45] text-ink">اكتب سؤالاً أو مفهوماً.</h2>
            <form onSubmit={(event) => { event.preventDefault(); if (query.trim().length >= 2) navigate(stagedSearchHref) }} className="mt-7 flex items-center gap-2 rounded-full border border-hair bg-canvas p-1.5 shadow-[0_18px_55px_-45px_rgba(20,31,45,.5)]">
              <label htmlFor="encyclopedia-query" className="sr-only">ابحث في موسوعة تكنولوجيا التعليم</label>
              <input id="encyclopedia-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: الفصول المقلوبة، دور المعلم، الفجوة الرقمية…" className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[.84rem] text-ink outline-none placeholder:text-soft/60" />
              <button type="submit" disabled={query.trim().length < 2} aria-label="ابحث في متن الموسوعة" title="ابحث في متن الموسوعة" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${query.trim().length >= 2 ? 'bg-accent text-white hover:bg-accent-deep' : 'cursor-not-allowed bg-wash text-soft'}`}><SocialIcon name="Search" size={16} /></button>
            </form>
          </FadeUp>

          {query.trim().length >= 2 && <FadeUp delay={0.06}><div className="mt-6 border-y border-hair bg-canvas px-4 py-1 md:px-6">
            {!hasSearchResults ? <div className="py-6 text-[.78rem] leading-relaxed text-soft">لم يظهر مدخل مختصر بعد. افتح البحث داخل متن الموسوعة لفحص المقاطع والعناوين كاملة.</div> : <div className="divide-y divide-hair">
              {searchResults.concepts.map(({ concept }) => <div key={`concept-${concept.id}`} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div><span className="text-[.64rem] font-semibold text-accent">من الكتاب · ص {concept.pageStart}</span><h3 className="mt-1 text-[.9rem] font-semibold leading-relaxed text-ink">{concept.title}</h3><p className="mt-1 text-[.73rem] leading-[1.8] text-soft">{concept.summary}</p></div><div className="flex flex-wrap gap-3 text-[.68rem] font-semibold"><Link to={`/publications/${book.slug}?book_idea=${encodeURIComponent(concept.title)}#book-knowledge`} className="text-accent hover:underline">افتح في الكتاب</Link><a href={channelSearch(concept.title)} target="_blank" rel="noreferrer" className="text-accent hover:underline">شاهد الشرح</a></div></div>)}
              {searchResults.doors.map(({ door }) => <div key={`door-${door.id}`} className="flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">باب كامل</span><strong className="mt-1 block text-[.84rem] text-ink">{door.title}</strong></span><a href={`#${door.id}`} className="shrink-0 text-[.68rem] font-semibold text-accent">افتح الباب ←</a></div>)}
              {searchResults.articles.map(({ article }) => <Link key={`article-${article.slug}`} to={`/articles/${article.slug}`} className="group flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">مقال مرتبط</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{article.title}</strong></span><span className="text-soft">←</span></Link>)}
              {searchResults.papers.map(({ paper }) => <Link key={`paper-${paper.slug}`} to={`/research/${paper.slug}`} className="group flex items-center justify-between gap-4 py-4"><span><span className="text-[.64rem] font-semibold text-accent">بحث مرتبط</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{paper.titleAr || paper.title}</strong></span><span className="text-soft">←</span></Link>)}
            </div>}
            <div className="border-t border-hair py-4"><Link to={stagedSearchHref} className="text-[.72rem] font-semibold text-accent">ابحث داخل المقاطع الموثقة من متن الموسوعة ←</Link></div>
          </div></FadeUp>}
        </div>
      </section>

      <section id="encyclopedia-video" className="scroll-mt-24 border-b border-hair px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-video-title">
        <div className="mx-auto max-w-shell"><div className="grid gap-9 lg:grid-cols-[minmax(0,.72fr)_minmax(0,1.28fr)] lg:gap-14">
          <FadeUp><span className="text-[.7rem] font-semibold text-accent">الموسوعة المرئية</span><h2 id="encyclopedia-video-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">الفيديو ليس ملحقاً؛ هو طريق ثانٍ إلى المادة نفسها.</h2><p className="mt-4 text-[.82rem] font-light leading-[1.9] text-soft">تُفتح المادة المرئية من القناة الأصلية، وتبقى مرتبطة بأبواب الموسوعة وموضوعاتها بدل عرضها كقائمة عشوائية.</p><div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => setShowVideos((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.72rem] font-semibold text-white transition-colors hover:bg-accent-deep"><SocialIcon name="Play" size={14} />{showVideos ? 'أغلق المشغل' : 'شغّل مدخلاً مرئياً'}</button><a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-hair px-5 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">جميع الفيديوهات</a></div></FadeUp>
          <FadeUp delay={0.08}>{showVideos ? <div className="overflow-hidden rounded-2xl border border-hair bg-ink"><iframe src={FEATURED_VIDEO_EMBED} title="مدخل من موسوعة تكنولوجيا التعليم المرئية" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="aspect-video w-full" /><div className="flex flex-wrap items-center justify-between gap-3 bg-canvas px-4 py-3 text-[.68rem] text-soft"><span>المشغل لا يُحمّل إلا بعد طلبك.</span><a href={CHANNEL_URL} target="_blank" rel="noreferrer" className="font-semibold text-accent">افتح جميع الفيديوهات ←</a></div></div> : <div className="border-y border-hair">{DOORS.map((door) => <a key={`video-${door.id}`} href={channelSearch(door.title)} target="_blank" rel="noreferrer" className="group flex items-center justify-between gap-5 border-b border-hair py-4 last:border-b-0"><span><span className="text-[.64rem] font-semibold text-accent">{door.number}</span><strong className="mt-1 block text-[.86rem] leading-relaxed text-ink transition-colors group-hover:text-accent">فيديوهات {door.title}</strong></span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors group-hover:border-accent"><SocialIcon name="Play" size={13} /></span></a>)}</div>}</FadeUp>
        </div></div>
      </section>

      <section id="encyclopedia-teaching-kit" className="scroll-mt-24 border-b border-hair bg-wash/40 px-6 py-14 md:px-11 md:py-20" aria-labelledby="encyclopedia-kit-title">
        <div className="mx-auto max-w-shell"><FadeUp><div className="grid gap-8 lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] lg:gap-14">
          <div><span className="text-[.7rem] font-semibold text-accent">حقيبة تدريس الموسوعة</span><h2 id="encyclopedia-kit-title" className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold leading-[1.45] text-ink">عروض الأبواب جاهزة للتحميل.</h2><p className="mt-4 text-[.8rem] font-light leading-[1.9] text-soft">للطالب والمعلم والأستاذ والمدرب. الملفات متاحة للاستخدام التعليمي مع حفظ حقوق المؤلفين.</p></div>
          <div className="border-y border-hair bg-canvas px-4 md:px-6">{DOORS.map((door) => <div key={`kit-${door.id}`} className="grid gap-3 border-b border-hair py-5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div><span className="text-[.64rem] font-semibold text-accent">الباب {door.number}</span><strong className="mt-1 block text-[.88rem] leading-relaxed text-ink">{door.title}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">عرض تقديمي قابل للتحميل</span></div><a href={door.presentation} download={`موسوعة تكنولوجيا التعليم - الباب ${door.number}.pptx`} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-accent/30 px-4 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"><SocialIcon name="Download" size={13} />تحميل العرض</a></div>)}</div>
        </div></FadeUp></div>
      </section>

      <section className="px-6 py-11 md:px-11 md:py-14"><div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-5 border-y border-hair py-6"><div><span className="text-[.68rem] font-semibold text-accent">النسخة الأصلية</span><p className="mt-1 text-[.8rem] leading-relaxed text-soft">للقراءة الرسمية والبيانات الببليوغرافية.</p></div><div className="flex flex-wrap gap-2">{book.pdf && <a href={book.pdf} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.7rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">عرض عيّنة الكتاب</a>}<a href="#book-knowledge" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.7rem] font-semibold text-white transition-colors hover:bg-accent-deep">افتح العالم المعرفي</a></div></div></section>
    </>
  )
}
