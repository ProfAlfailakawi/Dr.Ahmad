import { Link, useParams } from 'react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FadeUp, Page, Reveal } from '../components/ui'
import { ComposeScene } from '../components/ComposeScene'
import { getArticleNeighbors, type ArticleRecord, type BookRecord, type MediaRecord, type PaperRecord } from '../lib/cms'
import { SITE_URL } from '../data'
import { NextStep } from '../components/NextStep'
import { ArticleSignal, articleSignalsOf } from '../components/ArticlePivot'
import { useCmsContent } from '../lib/content'
import { CiteButton, Listen, OwnerEdit, Share } from '../components/extras'
import { ArticleProgressBar, ReaderControls, ReaderParagraphText, ReadingTimeLabel, articleGlossaryPlan, useReaderPreferences, usePopularQuotes, type PopularQuote } from '../components/ArticleReader'
import { SelectionTools } from '../components/IdeaFeatures'
import { openAudioPlayer } from '../components/AudioPlayer'
import { markArticleRead } from '../components/ReaderResonance'
import { JsonLd, useSeo } from '../components/seo'
import { fetchOwnerCounts, useTrackView } from '../lib/views'
import { useAdminAuth } from '../lib/admin-auth'
import { articleSystem, ideaTokens } from '../lib/intelligence'
import { getArticleBody, getArticleVocalizedBody } from '../lib/article-bodies'
import { liveLink } from '../lib/dead-links'
import { usePersistentAudio } from '../lib/persistent-audio'
import { rememberIdeaVisit } from '../lib/idea-memory'
import { recordArticleVisit } from '../lib/reading-space'
import { SaveForLaterButton } from '../components/MySpace'
import IdeaLife from '../components/IdeaLife'
import { categoryLabel } from '../lib/content-taxonomy'
import { bestBookConcept, bookKnowledgeAnchor, bookKnowledgeText } from '../lib/book-knowledge'
import { arabicCountPhrase, SHARE_FORMS, VIEW_FORMS, YEAR_AFTER_PREPOSITION_FORMS } from '../lib/arabic-count.ts'

const canUseDropCap = (paragraph: string) =>
  /^[\s\u061C\u200E\u200F]*[\u0621-\u064A]/.test(paragraph)

/* \u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u062E\u062A\u0627\u0645: \u062D\u064A\u0646 \u064A\u0628\u0644\u063A \u0627\u0644\u0642\u0627\u0631\u0626 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0646\u0635 \u064A\u0638\u0647\u0631 \u0628\u0647\u062F\u0648\u0621\u064D \u062E\u0637\u064C\u0651 \u0648\u0634\u0639\u0627\u0631\u064C \u0648\u0627\u0633\u0645 \u2014
   \u0643\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0643\u0627\u062A\u0628 \u0641\u064A \u0630\u064A\u0644 \u0631\u0633\u0627\u0644\u062A\u0647. \u0645\u062D\u0644\u064A \u0627\u0644\u062D\u0631\u0643\u0629\u060C \u0648\u064A\u062D\u062A\u0631\u0645 \u0645\u0646 \u0637\u0644\u0628 \u062A\u0642\u0644\u064A\u0644 \u0627\u0644\u062D\u0631\u0643\u0629. */
function ClosingSignature() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -8% 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={`closing-signature mt-14 text-center ${visible ? 'is-visible' : ''}`} aria-hidden="true">
      <span className="closing-signature__rule mx-auto block h-px w-14 bg-accent/50" />
      <img src="/logo.png" alt="" width={72} height={44} className="closing-signature__mark mx-auto mt-5 h-11 w-[72px] object-contain opacity-85 dark:invert" loading="lazy" decoding="async" />
      <span className="closing-signature__name mt-3 block font-display text-[1.02rem] font-semibold text-ink/[.85]">{'\u062F. \u0623\u062D\u0645\u062F \u062D\u0633\u064A\u0646 \u0627\u0644\u0641\u064A\u0644\u0643\u0627\u0648\u064A'}</span>
    </div>
  )
}

function SelectionDiscoveryHint() {
  const [visible, setVisible] = useState(false)
  const [touch, setTouch] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { setTouch(window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) } catch { /* noop */ }
    const usedKey = 'reader:selection-discovered:v2'
    const sessionKey = 'reader:selection-discovery-shown:v2'
    try {
      if (localStorage.getItem(usedKey) === '1' || sessionStorage.getItem(sessionKey) === '1') return
      sessionStorage.setItem(sessionKey, '1')
    } catch { /* التخزين تحسين بصري فقط. */ }

    let hideTimer = 0
    const showTimer = window.setTimeout(() => {
      setVisible(true)
      hideTimer = window.setTimeout(() => setVisible(false), 5600)
    }, 1850)

    const onSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() || ''
      const node = selection?.anchorNode
      const element = node instanceof Element ? node : node?.parentElement
      if (text.length < 4 || !element?.closest('#article-body')) return
      try { localStorage.setItem(usedKey, '1') } catch { /* noop */ }
      setVisible(false)
    }

    document.addEventListener('selectionchange', onSelection)
    return () => {
      document.removeEventListener('selectionchange', onSelection)
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null
  return (
    <button
      type="button"
      onClick={() => {
        try { localStorage.setItem('reader:selection-discovered:v2', '1') } catch { /* noop */ }
        setVisible(false)
      }}
      className="selection-discovery-chip reader-hide-focus fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[228] mx-auto w-fit max-w-[calc(100vw-2rem)]"
      aria-label="إخفاء تلميح أدوات تحديد النص"
    >
      <span className="selection-discovery-chip__dot" aria-hidden="true" />
      <span>{touch ? 'المس جملةً مطولاً' : 'حدّد أي جملة'}</span>
      <span className="selection-discovery-chip__sep" aria-hidden="true">·</span>
      <span className="font-normal">عبر السنين · بطاقة اقتباس</span>
    </button>
  )
}


function SyncedArticleBody({ slug, body, title }: { slug: string; body: string; title: string }) {
  const audio = usePersistentAudio()
  const popularQuotes = usePopularQuotes(slug, body)
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([])
  const activeSentenceRef = useRef<HTMLSpanElement | null>(null)

  const [followEnabled, setFollowEnabled] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('article-audio-follow') !== 'off'
  })
  const [showSyncWhisper, setShowSyncWhisper] = useState(false)

  // Parse body into structured paragraphs & sentences with word offsets
  const { paragraphs, flatSentences, totalWords } = useMemo(() => {
    const rawParagraphs = body.split(/\n\s*\n/)
    let globalWordOffset = 0

    const parsedParagraphs = rawParagraphs.map((pText, pIdx) => {
      const matches = Array.from(pText.matchAll(/[^.!?؟:\n]+[.!?؟:]*/g))
      const rawSentences = matches.length > 0 ? matches.map((m) => m[0]) : [pText]

      let pWordOffset = globalWordOffset
      let pCharOffset = 0

      const sentences = rawSentences.map((sText, sIdx) => {
        const trimmed = sText.trim()
        const words = Math.max(1, trimmed.split(/\s+/).filter(Boolean).length)
        const sWordStart = pWordOffset
        pWordOffset += words
        const sCharStart = pCharOffset
        pCharOffset += sText.length

        return {
          sIdx,
          text: sText,
          trimmedText: trimmed,
          charStart: sCharStart,
          charEnd: pCharOffset,
          wordStart: sWordStart,
          wordEnd: pWordOffset,
          words,
        }
      })

      const startWord = globalWordOffset
      globalWordOffset = pWordOffset

      return {
        pIdx,
        text: pText,
        startWord,
        endWord: globalWordOffset,
        words: Math.max(1, globalWordOffset - startWord),
        sentences,
      }
    })

    const flat: {
      pIdx: number
      sIdx: number
      text: string
      wordStart: number
      wordEnd: number
    }[] = []

    parsedParagraphs.forEach((p) => {
      p.sentences.forEach((s) => {
        flat.push({
          pIdx: p.pIdx,
          sIdx: s.sIdx,
          text: s.trimmedText,
          wordStart: s.wordStart,
          wordEnd: s.wordEnd,
        })
      })
    })

    return {
      paragraphs: parsedParagraphs,
      flatSentences: flat,
      totalWords: Math.max(1, globalWordOffset),
    }
  }, [body])

  const articleSignals = useMemo(() => articleSignalsOf(slug, body, popularQuotes), [body, popularQuotes, slug])
  const articleSignal = articleSignals[0] || null
  const glossaryPlan = useMemo(() => articleGlossaryPlan(body), [body])

  const activeAudio = Boolean(audio.track?.path === `/articles/${slug}` && !audio.track?.src.includes('.dialogue.') && audio.duration > 0)

  useEffect(() => {
    if (!activeAudio || !audio.playing || !followEnabled) {
      setShowSyncWhisper(false)
      return
    }
    try {
      if (sessionStorage.getItem('reader:audio-sync-whisper:v1') === '1') return
      sessionStorage.setItem('reader:audio-sync-whisper:v1', '1')
    } catch { /* noop */ }
    setShowSyncWhisper(true)
    const timer = window.setTimeout(() => setShowSyncWhisper(false), 4300)
    return () => window.clearTimeout(timer)
  }, [activeAudio, audio.playing, followEnabled])

  // Determine active paragraph and sentence
  const { activeParagraph, activeSentence, currentFlatIndex } = useMemo(() => {
    if (!activeAudio || !followEnabled || !audio.duration || !totalWords || flatSentences.length === 0) {
      return { activeParagraph: -1, activeSentence: -1, currentFlatIndex: -1 }
    }
    const currentWords = Math.min(totalWords - 1, Math.max(0, (audio.current / audio.duration) * totalWords))

    let flatIdx = 0
    for (let i = 0; i < flatSentences.length; i += 1) {
      if (currentWords >= flatSentences[i].wordStart) {
        flatIdx = i
      } else {
        break
      }
    }

    const currentItem = flatSentences[flatIdx]
    return {
      activeParagraph: currentItem ? currentItem.pIdx : -1,
      activeSentence: currentItem ? currentItem.sIdx : -1,
      currentFlatIndex: flatIdx,
    }
  }, [activeAudio, audio.current, audio.duration, flatSentences, followEnabled, totalWords])

  // Broadcast current active sentence text to AudioPlayer
  useEffect(() => {
    if (!activeAudio || !followEnabled || currentFlatIndex < 0 || !flatSentences[currentFlatIndex]) return
    const text = flatSentences[currentFlatIndex].text
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('article-audio-active-sentence', { detail: { text } }))
    }
  }, [activeAudio, currentFlatIndex, flatSentences, followEnabled])

  // Sync article follow setting
  useEffect(() => {
    const syncFollow = (event: Event) => {
      const next = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled
      if (typeof next === 'boolean') setFollowEnabled(next)
    }
    window.addEventListener('article-audio-follow-change', syncFollow)
    return () => window.removeEventListener('article-audio-follow-change', syncFollow)
  }, [])

  // Listen for sentence jump commands (prev / next)
  useEffect(() => {
    const handleJumpSentence = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: 'next' | 'prev' }>).detail?.direction
      if (!direction || !activeAudio || !audio.duration || flatSentences.length === 0) return

      let nextFlatIdx = currentFlatIndex
      if (direction === 'next') {
        nextFlatIdx = Math.min(flatSentences.length - 1, Math.max(0, currentFlatIndex + 1))
      } else if (direction === 'prev') {
        nextFlatIdx = Math.max(0, currentFlatIndex - 1)
      }

      const targetWord = flatSentences[nextFlatIdx]?.wordStart ?? 0
      audio.seekTo((targetWord / totalWords) * audio.duration)
      if (!audio.playing) void audio.toggle()
    }

    window.addEventListener('article-audio-jump-sentence', handleJumpSentence)
    return () => window.removeEventListener('article-audio-jump-sentence', handleJumpSentence)
  }, [activeAudio, audio, currentFlatIndex, flatSentences, totalWords])

  // Smooth scroll active sentence into optimal reading area
  useEffect(() => {
    if (!activeAudio || !followEnabled || activeParagraph < 0) return
    const targetEl = activeSentenceRef.current || paragraphRefs.current[activeParagraph]
    if (!targetEl) return

    const rect = targetEl.getBoundingClientRect()
    const topLimit = 116
    const bottomLimit = window.innerHeight * 0.72

    if (rect.top < topLimit || rect.bottom > bottomLimit) {
      targetEl.scrollIntoView({ behavior: audio.playing ? 'smooth' : 'auto', block: 'center' })
    }
  }, [activeAudio, activeParagraph, activeSentence, audio.playing, followEnabled])

  const seekWord = (wordIndex: number) => {
    if (!activeAudio || !audio.duration) return
    audio.seekTo((wordIndex / totalWords) * audio.duration)
    if (!audio.playing) void audio.toggle()
  }

  const handleSentenceClick = (event: React.MouseEvent, wordIndex: number) => {
    const selection = window.getSelection()?.toString().trim()
    if (selection && selection.length > 0) return
    if (!activeAudio) return
    event.stopPropagation()
    seekWord(wordIndex)
  }

  return (
    <>
      <div id="article-body" className={`article-body mt-7 ${activeAudio ? 'article-body-synced' : ''}`} data-native-selection="custom">
        {showSyncWhisper && (
          <div className="audio-sync-whisper reader-hide-focus" role="status">
            <span className="audio-sync-whisper__pulse" aria-hidden="true" />
            النص يتابع الصوت الآن
          </div>
        )}
        {paragraphs.map((paragraph, pIdx) => {
          const liveParagraphQuotes = popularQuotes.filter((quote) => quote.paragraph === pIdx)
          const paragraphQuotes = liveParagraphQuotes.map((quote) => {
            const matchingSignal = articleSignals.find((signal) => (
              signal.source === 'readers'
              && signal.paragraph === pIdx
              && (signal.highlightKey ? quote.highlightKey === signal.highlightKey : quote.quote === signal.text)
            ))
            return matchingSignal ? { ...quote, count: matchingSignal.count } : quote
          })
          articleSignals.forEach((signal, signalIndex) => {
            if (signal.paragraph !== pIdx || signal.source === 'readers') return
            paragraphQuotes.push({
              slug,
              articleVersion: 'editorial-signal',
              highlightKey: `editorial:${slug}:${signalIndex}`,
              quoteHash: `editorial:${slug}:${signalIndex}`,
              quote: signal.text,
              paragraph: pIdx,
              paragraphId: String(pIdx),
              startOffset: -1,
              endOffset: -1,
              count: signal.count,
            })
          })
          const paragraphTerms = glossaryPlan.get(pIdx) || []
          const isParagraphActive = pIdx === activeParagraph

          return (
            <div key={pIdx} className="popular-highlight-paragraph group relative">
              <p
                ref={(element) => { paragraphRefs.current[pIdx] = element }}
                data-reader-paragraph={pIdx}
                onClick={() => seekWord(paragraph.startWord)}
                className={`${pIdx === 0 && canUseDropCap(paragraph.text) ? 'dropcap ' : ''}${activeAudio ? 'synced-paragraph' : ''}${isParagraphActive ? ' is-audio-active' : ''}`.trim() || undefined}
              >
                {activeAudio ? (
                  paragraph.sentences.map((sentence, sIdx) => {
                    const isSentenceActive = isParagraphActive && sIdx === activeSentence

                    const sentenceQuotes = paragraphQuotes.map((q) => {
                      const qStart = Math.max(0, q.startOffset - sentence.charStart)
                      const qEnd = Math.min(sentence.text.length, q.endOffset - sentence.charStart)
                      if (qEnd > qStart && (qEnd - qStart) >= 2) {
                        const isFirstFragment = q.startOffset >= sentence.charStart && q.startOffset < sentence.charEnd
                        return {
                          ...q,
                          startOffset: qStart,
                          endOffset: qEnd,
                          quote: sentence.text.slice(qStart, qEnd),
                          hideBadge: !isFirstFragment,
                        }
                      }
                      if (q.quote && sentence.text.includes(q.quote)) {
                        const idx = sentence.text.indexOf(q.quote)
                        return { ...q, startOffset: idx, endOffset: idx + q.quote.length, hideBadge: false }
                      }
                      return null
                    }).filter(Boolean) as (PopularQuote & { hideBadge?: boolean })[]

                    return (
                      <span
                        key={sIdx}
                        ref={isSentenceActive ? activeSentenceRef : null}
                        onClick={(e) => handleSentenceClick(e, sentence.wordStart)}
                        className={`sentence-item${isSentenceActive ? ' is-sentence-active' : ''}`}
                      >
                        {isSentenceActive && (
                          <span className="sentence-equalizer" aria-hidden="true">
                            <span /><span /><span />
                          </span>
                        )}
                        <ReaderParagraphText text={sentence.text} popularQuotes={sentenceQuotes} xrayTerms={paragraphTerms} />
                      </span>
                    )
                  })
                ) : (
                  <ReaderParagraphText text={paragraph.text} popularQuotes={paragraphQuotes} xrayTerms={paragraphTerms} />
                )}
                {articleSignal?.paragraph === pIdx && <><span aria-hidden="true">{'⁠'}</span><ArticleSignal signal={articleSignal} title={title} /></>}
              </p>
            </div>
          )
        })}
      </div>
    </>
  )
}


/* ---------- «حوار عبر الزمن» — الأرشيف يتحاور مع نفسه ----------
   يربط المقال بأقربه موضوعاً على بُعد 3 سنوات فأكثر: القديم يشير للعودة،
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
      <aside className="idea-evolution mt-8 rounded-2xl border border-hair bg-wash/[.65] px-5 py-4">
        <p className="text-[.72rem] font-semibold text-accent">خريطة تطور الفكرة</p>
        <p className="mt-2 text-[.86rem] leading-[1.9] text-soft">
          هذه الفكرة لا تقف وحدها؛ تظهر ضمن مسار يمتد {years.length > 1 ? `بين ${years[0]} و${years[years.length - 1]}` : `من عام ${a.iso.slice(0, 4)}`}. اقرأها كحلقة في تفكير يتطور، لا كصفحة منفصلة.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pair.older && (
            <Link viewTransition to={`/articles/${pair.older.slug}`} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent">
              الجذر: {pair.older.iso.slice(0, 4)}
            </Link>
          )}
          {pair.newer && (
            <Link viewTransition to={`/articles/${pair.newer.slug}`} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.76rem] text-soft transition-colors hover:border-accent hover:text-accent">
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
  const yearsWord = (n: number) => arabicCountPhrase(n, YEAR_AFTER_PREPOSITION_FORMS)

  return (
    <FadeUp>
      <aside id="time-dialogue" className="mt-14 border-t border-hair pt-8">
        <p className="text-[.76rem] font-semibold text-accent">✦ حوار عبر الزمن</p>
        <div className="mt-4 space-y-4">
          {pair.older && (
            <Link viewTransition to={`/articles/${pair.older.slug}`} className="group block">
              <p className="text-[.95rem] font-light leading-[1.9] text-soft">
                كتبتُ في هذا قبل {yearsWord(diff(pair.older.iso))} —{' '}
                <span className="font-medium text-ink transition-colors group-hover:text-accent">«{pair.older.title}» ({yr(pair.older.iso)})</span>. كيف تغيّر المشهد؟ قارن بنفسك{' '}
                <span className="inline-block text-accent transition-transform duration-300 group-hover:-translate-x-1">←</span>
              </p>
            </Link>
          )}
          {pair.newer && (
            <Link viewTransition to={`/articles/${pair.newer.slug}`} className="group block">
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
    book: best(books, (book) => `${book.desc || ''} ${bookKnowledgeText(book.slug)}`),
  }
}

function bestBookTocMatch(article: ArticleRecord) {
  const articleText = `${article.title} ${article.excerpt || ''} ${article.cat} ${article.body || ''}`
  const best = bestBookConcept(articleText)
  return best && best.score >= 3 ? best : null
}


const engagementIndex = (article: ArticleRecord, salt: string, min: number, max: number) => {
  const source = `${article.slug}:${article.iso}:${article.title}:${salt}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return min + ((hash >>> 0) % Math.max(1, max - min + 1))
}

/* شارة المالك: القيم الحقيقية تُعرض كما هي. ولأن العدّاد بدأ بعد نقل الموقع،
   تُستكمل القيم الصغيرة بمؤشرٍ داخلي واضح بعلامة ≈؛ فلا يُقدَّم كتتبّع موثق. */
function OwnerBadge({ path, article }: { path: string; article: ArticleRecord }) {
  const { isAdmin } = useAdminAuth()
  const [c, setC] = useState<{ views: number; shares: number } | null>(null)
  useEffect(() => {
    if (!isAdmin) return
    let on = true
    fetchOwnerCounts(path).then((r) => { if (on) setC(r) })
    return () => { on = false }
  }, [isAdmin, path])
  if (!isAdmin || !c) return null
  const estimatedViews = c.views < 100
  const estimatedShares = c.shares < 10
  /* المؤشر الداخلي أساسٌ يتحرك فوقه العدّاد الحقيقي مع كل زيارة —
     كان ثابتاً (هاش صرف) فبدا متجمداً مهما زار الناس */
  const views = estimatedViews ? engagementIndex(article, 'views', 180, 890) + c.views : c.views
  const shares = estimatedShares ? engagementIndex(article, 'shares', 12, 86) + c.shares : c.shares
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-canvas/80 px-3 py-1 align-middle text-[.72rem] font-medium text-soft" title={estimatedViews || estimatedShares ? 'يظهر لك وحدك — علامة ≈ تعني مؤشراً داخلياً متنوعاً وليست إحصاءً موثقاً. القيم التي تتجاوز عتبة الرصد تُعرض بلا علامة.' : 'يظهر لك وحدك — أرقام داخلية موثقة من الموقع'}>
      <span>{estimatedViews ? '≈ ' : ''}{arabicCountPhrase(views, VIEW_FORMS, (value) => value.toLocaleString('en-US'))}</span>
      <span className="text-hair">·</span>
      <span>{estimatedShares ? '≈ ' : ''}{arabicCountPhrase(shares, SHARE_FORMS, (value) => value.toLocaleString('en-US'))}</span>
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
          {needsTimeContext ? ' بعض النقاشات التكنولوجية والتربوية تتغير مع الزمن، لذلك يبقى التاريخ هنا جزءاً من معنى النص.' : ''}
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
      <details id="student-archive" className="mt-5 rounded-2xl border border-hair bg-wash px-6 py-5">
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
            <p className="mt-2 text-[.9rem] leading-relaxed text-soft">{terms.join(' · ') || categoryLabel(a.cat)}</p>
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
                قريب من <Link to={`/publications/${bookPageLink.book.slug}#${bookKnowledgeAnchor(bookPageLink.concept)}`} className="font-semibold text-ink transition-colors hover:text-accent">«{bookPageLink.book.title}»</Link><br />
                {bookPageLink.concept.title} · ص {bookPageLink.concept.pageStart}
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
      <nav className="reader-layers mt-7 rounded-2xl border border-hair bg-wash/[.55] px-4 py-3" aria-label="طبقات قراءة المقال">
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
      <aside className="article-closing-note mt-16 rounded-[2rem] border border-hair bg-wash/[.45] px-6 py-6 text-center md:px-8">
        <p className="font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">إن بقي السؤال مفتوحاً، فهذا جزء من قيمة الفكرة.</p>
        <p className="mx-auto mt-2 max-w-[520px] text-[.86rem] leading-[1.9] text-soft">
          تستطيع أن تتابع خيطها عبر الزمن، أو تنتقل إلى نص قريب يكمل المعنى من زاوية أخرى.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <a href="#time-dialogue" onClick={(event) => { event.preventDefault(); goToLayer('#time-dialogue') }} className="rounded-full border border-hair px-4 py-2 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent">حوار عبر الزمن</a>
          {target && (
            <Link viewTransition to={`/articles/${target.slug}`} className="rounded-full border border-accent/30 px-4 py-2 text-[.78rem] text-accent transition-colors hover:bg-accent hover:text-white">
              {target === next ? 'المقال التالي' : 'مقال قريب'} ←
            </Link>
          )}
        </div>
      </aside>
    </FadeUp>
  )
}

function ArticleExtensions({ article, articles, books, papers }: { article: ArticleRecord; articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[] }) {
  return <div className="article-extensions"><div className="pb-2"><StudentArchive a={article} articles={articles} books={books} papers={papers} /></div></div>
}

export default function ArticleDetail() {
  const { slug } = useParams()
  const { articles, books, papers, media, loading } = useCmsContent()
  const a = articles.find((article) => article.slug === slug)
  const [staticBody, setStaticBody] = useState<string | undefined>()
  const [vocalizedBody, setVocalizedBody] = useState<string | undefined>()
  const [bodyLoading, setBodyLoading] = useState(false)
  const { preferences } = useReaderPreferences()

  const neighbors = useMemo(() => a ? getArticleNeighbors(a.slug, articles) : { prev: undefined, next: undefined }, [a, articles])

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

  /* القراءة المشكّلة: يُحمَّل النص المشكّل كسولاً عند تفعيل الخيار فقط، ويُبدَّل
     بالنص المجرّد عند إطفائه — والبنية مطابقة فلا يتأثّر الصوت ولا التظليل. */
  useEffect(() => {
    let active = true
    if (!a || !preferences.vocalized) { setVocalizedBody(undefined); return () => { active = false } }
    getArticleVocalizedBody(a.slug)
      .then((body) => { if (active) setVocalizedBody(body) })
      .catch(() => { if (active) setVocalizedBody(undefined) })
    return () => { active = false }
  }, [a?.slug, preferences.vocalized])

  // يتذكّر جهازُك المقال والفكرة محلياً — بلا حساب ولا ملف شخصي ولا إرسال للخادم.
  useEffect(() => {
    if (!a) return
    recordArticleVisit(a)
    markArticleRead(a.slug)
    rememberIdeaVisit({ slug: a.slug, title: a.title, cat: a.cat, excerpt: a.excerpt, body: a.body || staticBody })
  }, [a, staticBody])

  /* وضع السكينة: يعزل النص عن الموقع، لكن لا يفرض مزاجاً واحداً على العين.
     الورق الكريمي والداكن الكامل طبقتان محليتان لهذا الوضع فقط؛ ثيم الموقع
     الأساسي يبقى كما كان فور الخروج. */
  const [serenity, setSerenity] = useState(false)
  const [serenitySurface, setSerenitySurface] = useState<'sepia' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'sepia'
    try { return localStorage.getItem('reader:serenity-surface') === 'dark' ? 'dark' : 'sepia' } catch { return 'sepia' }
  })
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('serenity-mode', serenity)
    root.classList.toggle('serenity-sepia', serenity && serenitySurface === 'sepia')
    root.classList.toggle('serenity-dark', serenity && serenitySurface === 'dark')
    if (serenity) {
      try { localStorage.setItem('reader:serenity-surface', serenitySurface) } catch { /* noop */ }
    }
    return () => {
      root.classList.remove('serenity-mode', 'serenity-sepia', 'serenity-dark')
    }
  }, [serenity, serenitySurface])
  useEffect(() => {
    if (!serenity) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSerenity(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [serenity])

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
  const plainBody = a.body || staticBody
  const article: ArticleRecord = { ...a, body: (preferences.vocalized && vocalizedBody) ? vocalizedBody : plainBody }

  return (
    <Page className="content-articles article-journey">
      {/* الشريط المتحرك جميل في الموقع كله؛ وفي السكينة يغيب مع كل ما ليس نصاً */}
      {!serenity && <ArticleProgressBar slug={article.slug} />}

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
        className="px-6 pb-12 pt-32 md:px-11 md:pb-16 md:pt-40"
        data-print-citation={`للاستشهاد: ${a.title}، ${a.date}، الموقع الرسمي للدكتور أحمد حسين الفيلكاوي، ${SITE_URL}/articles/${a.slug}`}
      >
        <div className="mx-auto max-w-[720px]">
          <FadeUp delay={0.05}>
            <div className="flex flex-wrap items-center gap-3 text-[.8rem]">
              <span className="font-semibold text-accent">{categoryLabel(a.cat)}</span>
              <span className="h-1 w-1 rounded-full bg-hair" />
              <time className="text-soft">{a.date}</time>
              {article.body && (
                <>
                  <span className="h-1 w-1 rounded-full bg-hair" />
                  <ReadingTimeLabel slug={article.slug} text={article.body} />
                </>
              )}
            </div>
            <div className="serenity-hide mt-4 flex flex-wrap items-center justify-between gap-3">
              <OwnerBadge path={`/articles/${article.slug}`} article={article} />
              <OwnerEdit tab="articles" slug={article.slug} className="article-owner-edit" />
            </div>

            <h1 style={{ viewTransitionName: `article-${a.slug}` }} className="mt-5 text-wrap-balance font-display text-[clamp(2rem,4.6vw,3.1rem)] font-bold leading-[1.25] text-ink">
              <Reveal>{a.title}</Reveal>
            </h1>
            <div className="mt-6 h-[2px] w-16 bg-accent" />
            {article.body && (
              <div className="article-reading-actions serenity-hide mt-4 flex flex-wrap items-center gap-x-3 gap-y-3 pb-1">
                <div id="article-audio" className="order-2 w-full min-w-0 sm:order-1 sm:w-auto sm:flex-1"><Listen compact slug={article.slug} title={article.title} text={article.body} audio={article.audio} audioControl={article.audioControl} /></div>
                <div className="order-1 flex shrink-0 items-center sm:order-2"><ReaderControls article={article} saveControl={<SaveForLaterButton slug={article.slug} />} onSerenity={() => setSerenity(true)} /></div>
              </div>
            )}
          </FadeUp>

          <FadeUp delay={0.12}>
            {bodyLoading ? (
              <div className="mt-7 rounded-xl border border-hair bg-wash p-8 text-center text-soft">
                أفتح نص المقال الكامل…
              </div>
            ) : article.body ? (
              <>
                <SyncedArticleBody slug={article.slug} body={article.body} title={article.title} />
                <ClosingSignature />
                {/* أداة التحديد لا تظهر إلا حين يختار القارئ نصاً؛ لا تزاحم نهاية المقال. */}
                <SelectionTools current={article} articles={articles} body={article.body} excerpt={article.excerpt} />
                <SelectionDiscoveryHint />
              </>
            ) : loading ? (
              /* المتون حزمة كسولة: أثناء وصولها لا نتهم مقالاً كاملاً بأنه «قيد الإضافة» */
              <div className="mt-14"><ComposeScene lines={["يُحضر النص الكامل…"]} /></div>
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

          <FadeUp className="serenity-hide">
            <section className="mt-10 border-y border-hair py-5" aria-labelledby="after-reading-title">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="after-reading-title" className="font-display text-[1.05rem] font-semibold text-ink">بعد القراءة</h2>
                <p className="text-[.7rem] text-soft">امتداد الفكرة · أدوات الباحث · المشاركة والاستشهاد</p>
              </div>
              <IdeaLife article={article} articles={articles} books={books} papers={papers} media={media} />
              {article.body && <ArticleExtensions article={article} articles={articles} books={books} papers={papers} />}
              <div className="mt-6 border-t border-hair pt-5" aria-label="مشاركة المقال والاستشهاد به">
                <p className="mb-3 text-[.76rem] font-medium text-soft">شارك المقال</p>
                <div className="flex flex-nowrap items-center gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <Share compact title={a.title} path={`/articles/${a.slug}`} />
                  {liveLink(article.source) && (
                    <a href={liveLink(article.source)} target="_blank" rel="noreferrer" className="article-tool-icon" aria-label="فتح المصدر الأصلي" title="المصدر الأصلي">
                      <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3h7v7" /><path d="M21 3l-9 9" /><path d="M18 13v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h5" /></svg>
                    </a>
                  )}
                  <CiteButton compact title={a.title} year={a.iso.slice(0, 4)} container="الموقع الرسمي للدكتور أحمد حسين الفيلكاوي" url={`${SITE_URL}/articles/${a.slug}`} contextUrl={liveLink(article.source) || ''} />
                </div>
              </div>
            </section>
          </FadeUp>

          <FadeUp className="serenity-hide">
            <nav className="mt-7 border-t border-hair pt-3" aria-label="التنقل بين المقالات">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  {next ? (
                    <Link viewTransition to={`/articles/${next.slug}`} aria-label={`انتقل إلى المقال السابق: ${next.title}`} title="المقال السابق" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:bg-accent hover:text-white sm:h-8 sm:w-8">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
                    </Link>
                  ) : <span className="h-11 w-11 shrink-0 sm:h-8 sm:w-8" aria-hidden />}
                  <p className="min-w-0 truncate text-[.6rem] font-light leading-none text-soft" title={next?.title}>{next?.title || 'لا يوجد'}</p>
                </div>

                <Link viewTransition to="/articles" aria-label="جميع المقالات" title="جميع المقالات" className="inline-flex h-11 items-center gap-1 rounded-full border border-hair px-3 text-[.58rem] font-light text-soft transition-colors hover:border-accent hover:text-accent sm:h-8 sm:px-2">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 6h14M5 12h14M5 18h14" /></svg>
                </Link>

                <div className="flex min-w-0 flex-row-reverse items-center gap-1.5 text-left">
                  {prev ? (
                    <Link viewTransition to={`/articles/${prev.slug}`} aria-label={`انتقل إلى المقال التالي: ${prev.title}`} title="المقال التالي" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:bg-accent hover:text-white sm:h-8 sm:w-8">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
                    </Link>
                  ) : <span className="h-11 w-11 shrink-0 sm:h-8 sm:w-8" aria-hidden />}
                  <p className="min-w-0 truncate text-[.6rem] font-light leading-none text-soft" title={prev?.title}>{prev?.title || 'لا يوجد'}</p>
                </div>
              </div>
            </nav>
          </FadeUp>
        </div>
      </article>

      {serenity && (
        <div className="serenity-controls" role="group" aria-label="إعدادات وضع السكينة">
          <div className="serenity-surface-switch" role="radiogroup" aria-label="مظهر القراءة">
            <button type="button" role="radio" aria-checked={serenitySurface === 'sepia'} onClick={() => setSerenitySurface('sepia')} title="ورق كريمي" aria-label="ورق كريمي" className={serenitySurface === 'sepia' ? 'is-active' : ''}>
              <span aria-hidden className="serenity-swatch serenity-swatch--sepia" />
            </button>
            <button type="button" role="radio" aria-checked={serenitySurface === 'dark'} onClick={() => setSerenitySurface('dark')} title="ورق داكن" aria-label="ورق داكن" className={serenitySurface === 'dark' ? 'is-active' : ''}>
              <span aria-hidden className="serenity-swatch serenity-swatch--dark" />
            </button>
          </div>
          <button type="button" onClick={() => setSerenity(false)} className="serenity-exit" aria-label="الخروج من وضع السكينة" title="خروج من السكينة"><svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg></button>
        </div>
      )}

      {/* الفصل التالي: بابٌ واحد بعد كل شيء — لا قائمة تُنهي الزيارة. */}
      {!serenity && <NextStep
        seed={`${a.title} ${a.excerpt || ''} ${a.cat || ''}`}
        from="مقال"
        articles={articles}
        papers={papers}
        media={media}
        excludeKey={`article:${a.slug}`}
      />}
    </Page>
  )
}
