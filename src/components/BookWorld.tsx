import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'
import { createIdeaDna } from '../lib/idea-dna'
import { ideaWords } from '../lib/idea-life'
import { bookArchiveDate, buildBookWorldTimeline } from '../lib/book-world-timeline'
import { bookQuotes, loadBookPassages, quotesForConcept, searchBookPassages, type BookQuoteMatch } from '../lib/book-quotes'
import { QuoteCite } from './QuoteCite'
import { QuoteImage } from './QuoteImage'
import { RESONANCE_FLOOR, loadPassageResonance, recordPassageHighlight } from '../lib/passage-resonance'
import { bookKnowledgeAnchor, bookKnowledgeText, getBookKnowledge } from '../lib/book-knowledge'
import { buildSmartQueryPlan } from '../lib/smart-search'

function scoreAgainst(source: Set<string>, value: string) {
  return ideaWords(value).reduce((total, word) => total + (source.has(word) ? 1 : 0), 0)
}

function Disclosure({
  eyebrow,
  title,
  meta,
  children,
  lockOpen = false,
}: {
  eyebrow: string
  title: string
  meta?: string
  children: ReactNode
  lockOpen?: boolean
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (lockOpen && detailsRef.current) detailsRef.current.open = true
  }, [lockOpen])
  return (
    <details
      ref={detailsRef}
      className="group min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-canvas"
      data-allow-multiple={lockOpen ? 'true' : undefined}
      onToggle={(event) => {
        if (lockOpen && !event.currentTarget.open) event.currentTarget.open = true
      }}
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <span className="min-w-0 max-w-full">
          {eyebrow && <span className="block text-[.66rem] font-semibold text-accent">{eyebrow}</span>}
          <strong className="mt-1 block break-words text-[.9rem] leading-relaxed text-ink">{title}</strong>
          {meta && <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{meta}</span>}
        </span>
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair text-[.9rem] text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="min-w-0 max-w-full overflow-hidden border-t border-hair px-4 py-4 sm:px-5">{children}</div>
    </details>
  )
}

export function BookWorld({
  book,
  seed,
  articles,
  books,
  papers,
}: {
  book: BookRecord
  seed: string
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
}) {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const [activeIdea, setActiveIdea] = useState('')
  const stagedIdea = (searchParams.get('book_idea') || '').trim()
  const model = useMemo(() => {
    const knowledge = getBookKnowledge(book.slug)
    const sourceText = `${book.title}\n${book.desc || ''}\n${seed || ''}\n${knowledge?.role || ''}\n${knowledge?.topTerms.join(' ') || ''}\n${knowledge?.concepts.flatMap((concept) => [concept.title, concept.keywords.join(' ')]).join(' ') || ''}`
    const source = new Set(ideaWords(sourceText))
    const archive = articles.map((item) => ({
      slug: item.slug,
      title: item.title,
      text: `${item.excerpt || ''} ${item.body || ''}`,
      iso: item.iso,
      year: item.year,
    }))
    const dna = createIdeaDna(sourceText, { context: `عالم كتاب: ${book.title}`, archive })

    const articleMatches = articles
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || bookArchiveDate(b.item).localeCompare(bookArchiveDate(a.item)))

    const paperMatches = papers
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)

    const bookMatches = books
      .filter((item) => item.slug !== book.slug)
      .map((item) => ({ item, score: scoreAgainst(source, `${item.title} ${item.desc || ''} ${item.longDescription || ''} ${bookKnowledgeText(item.slug)}`) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)

    const verifiedConcepts = (knowledge?.concepts || [])
      .filter((concept) => !/^قائمة المراجع/u.test(concept.title))
      .map((concept) => concept.title)
    const fallbackIdeas = [
      dna.topic.label,
      ...dna.keywords,
      ...articleMatches.slice(0, 5).flatMap(({ item }) => ideaWords(`${item.title} ${item.cat || ''}`).slice(0, 2)),
    ]
    const candidateIdeas = Array.from(new Set((verifiedConcepts.length ? verifiedConcepts : fallbackIdeas)
      .map((item) => String(item || '').trim())
      .filter((item) => item.length >= 3 && item !== 'فكرة عامة')))

    const paths = candidateIdeas
      .map((idea) => {
        const words = new Set(ideaWords(idea))
        if (!words.size) return null
        const pathArticles = articles
          .map((item) => ({ item, score: scoreAgainst(words, `${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score || bookArchiveDate(b.item).localeCompare(bookArchiveDate(a.item)))
        const pathPapers = papers
          .map((item) => ({ item, score: scoreAgainst(words, `${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
          .filter((row) => row.score > 0)
          .sort((a, b) => b.score - a.score)
        const isBookConcept = knowledge?.concepts.some((concept) => concept.title === idea)
        if (!pathArticles.length && !pathPapers.length && !isBookConcept) return null
        return { idea, articles: pathArticles, papers: pathPapers }
      })
      .filter((row): row is { idea: string; articles: typeof articleMatches; papers: typeof paperMatches } => Boolean(row))

    /* «ما كُتب بعد الكتاب»: الفكرة لم تتجمّد يوم صدر الكتاب. نعرض المقالات
       المنشورة بعد سنة الصدور وحدها، من الأقدم إلى الأحدث، ليرى القارئ
       امتداد الفكرة في الزمن لا مجرد قربها في المعنى. */
    const publishedYear = Number(String((book as { year?: string }).year || '').slice(0, 4)) || 0
    const afterBook = publishedYear
      ? articleMatches
        .filter(({ item }) => Number(String(item.iso || '').slice(0, 4)) > publishedYear)
        .sort((a, b) => bookArchiveDate(a.item).localeCompare(bookArchiveDate(b.item)))
        .slice(0, 5)
      : []

    /* الشريط: كل محورٍ بموضعه من الكتاب. ما لا صفحة له يذهب إلى الآخر
       بدل أن يتصدّر بلا سبب. */
    const conceptByTitle = new Map((knowledge?.concepts || []).map((concept) => [concept.title, concept]))
    const spine = paths
      .map((path) => ({ idea: path.idea, concept: conceptByTitle.get(path.idea) || null }))
      .sort((left, right) => (left.concept?.pageStart ?? 1e9) - (right.concept?.pageStart ?? 1e9))
    const spinePages = spine.map((item) => item.concept?.pageStart).filter((page): page is number => typeof page === 'number')

    return {
      dna,
      paths,
      spine,
      spineRange: spinePages.length >= 2 ? { from: Math.min(...spinePages), to: Math.max(...spinePages) } : null,
      ideas: paths.map((path) => path.idea),
      relatedBooks: bookMatches.slice(0, 3),
      knowledge,
      afterBook,
      publishedYear,
      allQuotes: bookQuotes(book.slug),
    }
  }, [articles, book, book.desc, book.slug, book.title, books, papers, seed])

  const selectedIdea = activeIdea || model.ideas[0] || ''
  const selectedConcept = model.knowledge?.concepts.find((concept) => concept.title === selectedIdea)
  const conceptQuotes = quotesForConcept(book.slug, selectedConcept?.id || '')

  /* ═══ ما توقّف عنده القرّاء ═══
     تظليل الزائر لمقطعٍ يُحسب، فترتفع المقاطع التي توقّف عندها الناس فوق ما
     رجّحته الخوارزمية. لا قسم جديد ولا لوحة: ترتيبٌ وشارةٌ صغيرة فقط. */
  const [resonance, setResonance] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    let on = true
    void loadPassageResonance().then((map) => { if (on) setResonance(new Map(map)) })
    return () => { on = false }
  }, [])

  const markHighlight = (passageId: string) => {
    const text = window.getSelection()?.toString().trim() || ''
    /* تظليلٌ أقصر من ربع سطر ليس توقّفاً — هو نقرةٌ عابرة. */
    if (text.length < 25) return
    void recordPassageHighlight(passageId)
    setResonance((previous) => new Map(previous).set(passageId, (previous.get(passageId) || 0) + 1))
  }

  /* الترتيب: ما توقّف عنده القرّاء أولاً، ثم ترتيب الكتاب. */
  const byReaders = <T extends { id: string; page: number }>(list: T[]) => list
    .slice()
    .sort((left, right) => (resonance.get(right.id) || 0) - (resonance.get(left.id) || 0) || left.page - right.page)

  /* ═══ «ابحث في هذا الكتاب» ═══
     الزائر يسأل سؤاله بلغته، فيجيبه الكتاب بمقاطعه هو — لا بنموذجٍ يخمّن،
     ولا بملفٍ يُفتح. الكتاب يدلّ على نفسه دون أن يُفتح. */
  const [bookQuestion, setBookQuestion] = useState('')
  const [askReady, setAskReady] = useState(false)
  const [asked, setAsked] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const stagedQuestion = (searchParams.get('book_question') || '').trim()

  const askBook = (question: string) => {
    const cleanQuestion = question.trim()
    if (!cleanQuestion) return
    setAsked(cleanQuestion)
    setAskOpen(true)
    if (askReady) return
    void loadBookPassages().then(() => setAskReady(true))
  }

  const askedPlan = useMemo(() => buildSmartQueryPlan(asked), [asked])
  const questionPlan = useMemo(() => buildSmartQueryPlan(bookQuestion), [bookQuestion])
  const bookAnswer: BookQuoteMatch[] = useMemo(
    () => (asked.trim().length >= 2 && askReady ? searchBookPassages(asked, 6, book.slug) : []),
    [askReady, asked, book.slug],
  )
  const activePath = useMemo(
    () => model.paths.find((path) => path.idea === selectedIdea) || model.paths[0] || null,
    [model.paths, selectedIdea],
  )
  const activeConnections = useMemo(() => ({
    articles: activePath?.articles.slice(0, 3) || [],
    papers: activePath?.papers.slice(0, 2) || [],
    timeline: activePath ? buildBookWorldTimeline(activePath.articles, 6) : [],
  }), [activePath])

  useEffect(() => {
    if (activeIdea && !model.ideas.includes(activeIdea)) setActiveIdea('')
  }, [activeIdea, model.ideas])

  useEffect(() => {
    if (!stagedIdea || !model.paths.length) return
    const query = new Set(ideaWords(stagedIdea))
    const ranked = model.paths
      .map((path) => ({ path, score: ideaWords(path.idea).reduce((total, word) => total + (query.has(word) ? 1 : 0), 0) }))
      .sort((left, right) => right.score - left.score)
    if (ranked[0]?.score > 0) setActiveIdea(ranked[0].path.idea)
  }, [model.paths, stagedIdea])

  useEffect(() => {
    if (!stagedQuestion || asked === stagedQuestion) return
    setBookQuestion(stagedQuestion)
    askBook(stagedQuestion)
    window.requestAnimationFrame(() => {
      document.getElementById('ask-book-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [asked, stagedQuestion])

  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (hash === 'ask-book-section') {
      setAskOpen(true)
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        document.getElementById('ask-book-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }))
      return
    }
    const concept = model.knowledge?.concepts.find((item) => bookKnowledgeAnchor(item) === hash)
    if (!concept) return
    setActiveIdea(concept.title)
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = document.getElementById(hash)
      const disclosure = target?.closest('details')
      if (disclosure instanceof HTMLDetailsElement) disclosure.open = true
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }))
  }, [location.hash, model.knowledge])

  if (!model.paths.length) return null

  return (
    <section id="book-knowledge" className="content-book-world scroll-mt-28 max-w-full overflow-hidden border-t border-hair bg-wash px-4 py-12 sm:px-6 md:px-11 md:py-16" aria-labelledby="book-world-title">
      <div className="mx-auto min-w-0 max-w-shell">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <span className="text-[.7rem] font-semibold uppercase tracking-[.08em] text-accent">عالم الكتاب</span>
            <h2 id="book-world-title" className="mt-2 font-display text-[clamp(1.55rem,3vw,2.2rem)] font-semibold leading-[1.35] text-ink">امتدادات الكتاب داخل الأرشيف</h2>
            <p className="mt-2 text-[.82rem] leading-[1.8] text-soft">خريطة مبنيّة من الكتاب، تصل مفاهيمه بما نُشر في الأرشيف من مقالات وأبحاث ولقاءات.</p>
          </div>
          <Link to={`/thought-paths?idea=${encodeURIComponent(book.title)}`} className="max-w-full rounded-full border border-accent/[.35] px-4 py-2 text-[.74rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">المسار الفكري الكامل ←</Link>
        </div>

        <div className="mt-6 grid min-w-0 max-w-full gap-3">
          {model.ideas.length > 0 && <Disclosure
            /* «Idea DNA · 2E7078EF» بصمةٌ تقنية لا تقول للزائر شيئاً — وأخواتها
               في هذه الصفحة عربياتٌ مفهومة («استمرار الفكرة»، «الزمن داخل
               الأرشيف»). البصمة نفسها تبقى في لوحة التحكم حيث تنفع. */
            eyebrow="بصمة الفكرة"
            title="المفاهيم التي يحملها الكتاب إلى الأرشيف"
            lockOpen={Boolean(activeIdea)}
          >
            {/* ═══ شريط الكتاب ═══
                كان جداراً من أربعة صفوف يعامل 23 محوراً كحبّاتٍ متساوية بلا
                ترتيب. صار شريطاً واحداً مرتّباً بترتيب الكتاب نفسه — من أول
                صفحة إلى آخرها — فيقرأ الزائر بنيةَ الكتاب لا كومة كلمات،
                ويلفّ يميناً ويساراً بدل أن يتمدّد القسم رأسياً. */}
            <div dir="rtl" tabIndex={0} className="book-spine-rail rail -mx-1 flex w-[calc(100%+0.5rem)] max-w-[calc(100%+0.5rem)] snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden" aria-label={`محاور ${book.title} بترتيب الكتاب`}>
              {model.spine.map(({ idea, concept }, index) => {
                const active = selectedIdea === idea
                return (
                  <div key={`${idea}-${index}`} className="flex max-w-[86vw] shrink-0 snap-start flex-col items-center gap-1.5">
                    <span className={`text-[.62rem] tabular-nums transition-colors ${active ? 'font-semibold text-accent' : 'text-soft/70'}`}>
                      {concept ? concept.pageStart : '—'}
                    </span>
                    <button
                      type="button"
                      id={concept ? bookKnowledgeAnchor(concept) : undefined}
                      onClick={() => setActiveIdea(idea)}
                      aria-pressed={active}
                      className={`max-w-[78vw] whitespace-normal break-words rounded-2xl border px-3.5 py-2 text-center text-[.7rem] leading-relaxed transition-colors ${active ? 'border-accent bg-accent/[.07] font-semibold text-accent' : 'border-hair bg-wash text-ink hover:border-accent/40'}`}
                    >
                      {idea}
                    </button>
                  </div>
                )
              })}
            </div>
            {model.spineRange && (
              <p className="mt-2 text-[.64rem] text-soft/80">
                بترتيب الكتاب · من ص {model.spineRange.from} إلى ص {model.spineRange.to}
              </p>
            )}
            <div className="mt-4 border-t border-hair pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[.68rem] text-soft">البوابة النشطة · «{selectedIdea}»{selectedConcept ? ` · ص ${selectedConcept.pageStart}${selectedConcept.pageEnd > selectedConcept.pageStart ? `–${selectedConcept.pageEnd}` : ''}` : ''}</span>
                <span className="text-[.64rem] text-soft">{model.dna.audience.primary}</span>
              </div>
              <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
                {activeConnections.articles.map(({ item }) => (
                  <Link key={`active-a-${item.slug}`} to={`/articles/${item.slug}`} className="min-w-0 break-words rounded-xl border border-hair bg-wash px-3 py-2 text-[.68rem] leading-relaxed text-ink transition-colors hover:border-accent hover:text-accent">مقال · {item.title}</Link>
                ))}
                {activeConnections.papers.map(({ item }) => (
                  <Link key={`active-p-${item.slug}`} to={`/research/${item.slug}`} className="min-w-0 break-words rounded-xl border border-hair bg-wash px-3 py-2 text-[.68rem] leading-relaxed text-ink transition-colors hover:border-accent hover:text-accent">بحث · {item.titleAr || item.title}</Link>
                ))}
              </div>
              {selectedConcept && <div className="mt-3 text-[.76rem] leading-[1.85] text-soft">
                <p>{selectedConcept.summary}</p>
                <p className="mt-2 border-r-2 border-accent/[.35] pr-3 text-ink/80"><span className="font-semibold text-accent">سؤال للقراءة:</span> {selectedConcept.question}</p>
              </div>}
            </div>
          </Disclosure>}

          {/* ═══ اسأل هذا الكتاب ═══
              الكتاب يجيب بمقاطعه هو. لا نموذج يخمّن، ولا ملف يُفتح. */}
          {model.allQuotes.length > 0 && <Disclosure
            eyebrow=""
            title="ابحث في هذا الكتاب"
            lockOpen={Boolean(asked) || askOpen}
          >
            <form
              id="ask-book-section"
              onSubmit={(event) => { event.preventDefault(); askBook(bookQuestion) }}
              className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <input
                value={bookQuestion}
                onChange={(event) => setBookQuestion(event.target.value)}
                placeholder="اكتب فكرة أو سؤالاً أو موقفاً حتى لو لم تعرف كلمات الكتاب"
                aria-label={`ابحث داخل كتاب ${book.title}`}
                className="min-w-0 w-full max-w-full rounded-full border border-hair bg-canvas px-4 py-3 text-[.82rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent"
              />
              <button type="submit" className="min-h-11 w-full rounded-full bg-accent px-5 py-2.5 text-[.75rem] font-semibold text-white transition-colors hover:bg-accent-deep sm:w-auto">ابحث</button>
            </form>
            {bookQuestion.trim().length >= 2 && (questionPlan.interpretation || questionPlan.suggestions.length > 0) && (
              <div className="mt-3 rounded-xl border border-hair bg-wash px-3.5 py-3">
                {questionPlan.interpretation && <p className="text-[.7rem] leading-[1.8] text-soft"><span className="font-semibold text-accent">فهم البحث: </span>{questionPlan.interpretation}</p>}
                {questionPlan.suggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{questionPlan.suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => setBookQuestion(suggestion)} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.66rem] leading-relaxed text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>)}</div>}
              </div>
            )}
            {stagedQuestion && <p className="mt-2 text-[.68rem] leading-relaxed text-soft">جاءك هذا القسم مباشرة من ميزة «ابحث في كتاب» في البحث، ويمكنك تعديل السؤال هنا متى شئت.</p>}

            {asked && (
              <div className="mt-4 border-t border-hair pt-4">
                {!askReady && <p className="text-[.76rem] text-soft">يجري البحث في المتن…</p>}
                {askReady && bookAnswer.length === 0 && (
                  <div className="rounded-xl border border-hair bg-canvas px-4 py-3.5">
                    <p className="text-[.76rem] leading-relaxed text-soft">لم تظهر شواهد كافية داخل هذا الكتاب بعد فحص المعنى والعناوين والمحاور والمقاطع. يمكنك <Link to={`/search?q=${encodeURIComponent(asked)}&tab=all`} className="text-accent">توسيع البحث إلى الأرشيف كله</Link>.</p>
                    {askedPlan.suggestions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{askedPlan.suggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => { setBookQuestion(suggestion); setAsked('') }} className="rounded-full border border-hair px-3 py-1.5 text-[.66rem] text-soft transition-colors hover:border-accent hover:text-accent">{suggestion}</button>)}</div>}
                  </div>
                )}
                <div className="grid gap-3">
                  {bookAnswer.map((match) => (
                    <figure key={`ask-${match.quote.id}`} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-hair bg-canvas px-4 py-3.5">
                      <span className="mb-2 inline-flex rounded-full border border-hair bg-wash px-2.5 py-1 text-[.61rem] font-semibold text-accent">{match.quote.evidenceType === 'concept' ? 'محور مفهرس في الكتاب' : 'مقطع موثق من المتن'}</span>
                      {match.quote.evidenceType === 'concept'
                        ? <p className="break-words border-r-2 border-accent/40 pr-3 text-[.86rem] leading-[1.95] text-ink/[.85]">{match.quote.text}</p>
                        : <blockquote className="break-words border-r-2 border-accent/40 pr-3 text-[.86rem] font-light leading-[1.95] text-ink/[.85]">{match.quote.text}</blockquote>}
                      <figcaption className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 pr-3 text-[.66rem] text-soft">
                        <span>ص {match.quote.page}{match.quote.conceptTitle ? ` · ${match.quote.conceptTitle}` : ''}</span>
                        {match.quote.evidenceType !== 'concept' && <span className="flex flex-wrap items-center gap-3">
                          <QuoteCite book={book} page={match.quote.page} />
                          <QuoteImage text={match.quote.text} attribution={`${book.title} · ص ${match.quote.page}`} />
                        </span>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </Disclosure>}

          {/* ═══ من متن الكتاب ═══
              أذن الدكتور بنشر مقتطفاتٍ من المتن. تُعرض هنا مقاطع المحور النشط
              أولاً، فإن لم يكن له مقاطع عُرضت مختارات الكتاب موزّعة على طوله. */}
          {model.allQuotes.length > 0 && <Disclosure
            eyebrow="من متن الكتاب"
            title={conceptQuotes.length ? `مقاطع من «${selectedIdea}»` : 'مقاطع مختارة من الكتاب'}
          >
            <div className="grid gap-3">
              {byReaders(conceptQuotes.length ? conceptQuotes : model.allQuotes).slice(0, conceptQuotes.length ? conceptQuotes.length : 4).map((quote) => (
                <figure key={quote.id} className="min-w-0 max-w-full overflow-hidden rounded-xl border border-hair bg-canvas px-4 py-3.5">
                  <blockquote
                    onMouseUp={() => markHighlight(quote.id)}
                    onTouchEnd={() => markHighlight(quote.id)}
                    className="break-words border-r-2 border-accent/40 pr-3 text-[.86rem] font-light leading-[1.95] text-ink/[.85]"
                  >{quote.text}</blockquote>
                  <figcaption className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2 pr-3 text-[.66rem] text-soft">
                    <span>
                      {book.title} · ص {quote.page}{quote.conceptTitle ? ` · ${quote.conceptTitle}` : ''}
                      {(resonance.get(quote.id) || 0) >= RESONANCE_FLOOR && (
                        <span className="mr-2 text-accent">· توقّف عندها {resonance.get(quote.id)}</span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-3">
                      <QuoteCite book={book} page={quote.page} />
                      <QuoteImage text={quote.text} attribution={`${book.title} · ص ${quote.page}`} />
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Disclosure>}

          {/* ═══ ما كُتب بعد الكتاب ═══
              الفكرة لم تتجمّد يوم الطبع؛ هذه امتداداتها الصحفية بعد الصدور. */}
          {model.afterBook.length > 0 && <Disclosure
            eyebrow="ما كُتب بعد الكتاب"
            title={`امتداد الفكرة بعد صدوره سنة ${model.publishedYear}`}
            meta="مقالات نُشرت بعد الكتاب وتلامس محاوره — من الأقدم إلى الأحدث."
          >
            <div className="grid gap-1">
              {model.afterBook.map(({ item }) => (
                <Link key={`after-${item.slug}`} to={`/articles/${item.slug}`} className="grid gap-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-canvas sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                  <span className="text-[.68rem] font-semibold text-accent">{bookArchiveDate(item) || item.iso?.slice(0, 4)}</span>
                  <span className="min-w-0 break-words text-[.76rem] leading-relaxed text-ink">{item.title}</span>
                </Link>
              ))}
            </div>
          </Disclosure>}

          {activePath && (activeConnections.articles.length > 0 || activeConnections.papers.length > 0) && <Disclosure eyebrow="استمرار الفكرة" title="مواد قريبة في المقالات والأبحاث" meta="مواد تلامس المحور نفسه في المقالات والأبحاث.">
            <div className="grid gap-2">
              {activeConnections.articles.map(({ item, score }) => (
                <Link key={item.slug} to={`/articles/${item.slug}`} className="group grid min-w-0 max-w-full gap-1 rounded-xl border border-hair px-3.5 py-3 transition-colors hover:border-accent/[.45] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0 max-w-full">
                    <strong className="block text-[.8rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{item.title}</strong>
                    <span className="mt-1 block text-[.66rem] text-soft">{bookArchiveDate(item) || 'مقال من الأرشيف'}</span>
                  </span>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.62rem] text-soft">صلة {score}</span>
                </Link>
              ))}
              {activeConnections.papers.map(({ item, score }) => (
                <Link key={item.slug} to={`/research/${item.slug}`} className="group grid min-w-0 max-w-full gap-1 rounded-xl border border-hair px-3.5 py-3 transition-colors hover:border-accent/[.45] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <strong className="min-w-0 break-words text-[.8rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{item.titleAr || item.title}</strong>
                  <span className="w-fit rounded-full bg-wash px-2.5 py-1 text-[.62rem] text-soft">صلة {score}</span>
                </Link>
              ))}
            </div>
          </Disclosure>}

          {activeConnections.timeline.length > 0 && <Disclosure eyebrow="الزمن داخل الأرشيف" title="امتدادات مؤرخة للفكرة" meta="يختار أقوى محطة من كل سنة ويوزّعها على كامل عمر الأرشيف؛ لا يثبت على أحدث سنة.">
            <div className="grid gap-1">
              {activeConnections.timeline.map(({ item, year, date }) => (
                <Link key={`${item.slug}-${year}`} to={`/articles/${item.slug}`} className="grid min-w-0 max-w-full gap-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-wash sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
                  <span className="text-[.68rem] font-semibold text-accent">{date || year}</span>
                  <span className="min-w-0 break-words text-[.76rem] leading-relaxed text-ink">{item.title}</span>
                </Link>
              ))}
            </div>
          </Disclosure>}

          {model.relatedBooks.length > 0 && <Disclosure eyebrow="كتب مرتبطة" title="مؤلفات تفتح امتداداً آخر للفكرة">
            <div className="grid gap-2 sm:grid-cols-3">
              {model.relatedBooks.map(({ item }) => <Link key={item.slug} to={`/publications/${item.slug}`} className="rounded-xl border border-hair bg-wash px-4 py-3 transition-colors hover:border-accent"><span className="text-[.64rem] font-semibold text-accent">كتاب</span><strong className="mt-1 block text-[.78rem] leading-relaxed text-ink">{item.title}</strong></Link>)}
            </div>
          </Disclosure>}
        </div>
      </div>
    </section>
  )
}
