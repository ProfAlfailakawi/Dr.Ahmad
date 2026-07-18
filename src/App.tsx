import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Footer, Nav } from './components/ui'
import { FloatingActions } from './components/extras'
import { CmsProvider } from './lib/content'
import { useTrackJourney, useTrackView } from './lib/views'
import { PersistentAudioDock, PersistentAudioProvider } from './lib/persistent-audio'
import Home from './pages/Home'

/* تقسيم الكود: الرئيسية فورية، وبقية الصفحات تُحمَّل عند زيارتها فقط —
   فأول تحميل للموقع أخف بكثير (نصوص المقالات الـ٢٧٦ك لا تنزل إلا لقارئها) */
const Publications = lazy(() => import('./pages/Publications'))
const Research = lazy(() => import('./pages/Research'))
const Articles = lazy(() => import('./pages/Articles'))
const Search = lazy(() => import('./pages/Search'))
const AskLibrary = lazy(() => import('./pages/AskLibrary'))
const Decade = lazy(() => import('./pages/Decade'))
const ThoughtPaths = lazy(() => import('./pages/ThoughtPaths'))
const Media = lazy(() => import('./pages/Media'))
const CV = lazy(() => import('./pages/CV'))
const CvFile = lazy(() => import('./pages/CvFile'))
const Contact = lazy(() => import('./pages/Contact'))
const BookDetail = lazy(() => import('./pages/BookDetail'))
const ArticleDetail = lazy(() => import('./pages/ArticleDetail'))
const Curated = lazy(() => import('./pages/Curated'))
const Atlas = lazy(() => import('./pages/Atlas'))
const PaperDetail = lazy(() => import('./pages/PaperDetail'))
const Upcoming = lazy(() => import('./pages/Upcoming'))
const Inbox = lazy(() => import('./pages/Inbox'))
const AboutSite = lazy(() => import('./pages/AboutSite'))
const Questions = lazy(() => import('./pages/Questions'))
const Radar = lazy(() => import('./pages/Radar'))
const Admin = lazy(() => import('./pages/Admin'))
const PrivacyPolicy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.PrivacyPolicy })))
const TermsOfUse = lazy(() => import('./pages/Legal').then((m) => ({ default: m.TermsOfUse })))
const DataDeletion = lazy(() => import('./pages/Legal').then((m) => ({ default: m.DataDeletion })))
const NotFound = lazy(() => import('./pages/NotFound'))
const EnglishHome = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishHome })))
const EnglishCV = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishCV })))
const EnglishResearch = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishResearch })))
const LegacyArticle = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyArticle })))
const LegacyBook = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyBook })))
const LegacyLang = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyLang })))
const LegacyPage = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPage })))
const LegacyPaper = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPaper })))

function RouteLoadingLine() {
  return <div className="route-loading-line" aria-hidden="true" />
}

function WesternDigitsGuard() {
  useEffect(() => {
    const western = (value: string) => value
      .replace(/[٠-٩]/g, (digit) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(digit)] || digit)
      .replace(/[۰-۹]/g, (digit) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)] || digit)

    const skipped = (node: Node) => {
      const element = node.parentElement
      return Boolean(element?.closest('script,style,noscript,code,pre,[data-preserve-digits="true"]'))
    }

    const normalizeText = (node: Node) => {
      if (node.nodeType !== Node.TEXT_NODE || skipped(node)) return
      const current = node.nodeValue || ''
      const next = western(current)
      if (next !== current) node.nodeValue = next
    }

    const normalizeElement = (element: Element) => {
      if (element.matches('script,style,noscript,code,pre,[data-preserve-digits="true"]')) return
      for (const attribute of ['title', 'aria-label', 'placeholder']) {
        const current = element.getAttribute(attribute)
        if (!current) continue
        const next = western(current)
        if (next !== current) element.setAttribute(attribute, next)
      }
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) normalizeText(walker.currentNode)
    }

    normalizeElement(document.body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') normalizeText(mutation.target)
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) normalizeText(node)
          else if (node instanceof Element) normalizeElement(node)
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
  return null
}

/* الصمت التكيفي: بعد تعمّق الزائر في أول مقال تهدأ الحركات المحيطية لبقية
   الجلسة. لا حساب ولا تتبّع؛ علم محلي في sessionStorage فقط. */
function AdaptiveSilence() {
  useEffect(() => {
    const root = document.documentElement
    const apply = () => root.classList.add('site-silent')
    try {
      if (sessionStorage.getItem('site:adaptive-silence') === '1') apply()
    } catch { /* noop */ }
    const deepen = () => {
      try { sessionStorage.setItem('site:adaptive-silence', '1') } catch { /* noop */ }
      apply()
    }
    window.addEventListener('reader:deepened', deepen)
    return () => window.removeEventListener('reader:deepened', deepen)
  }, [])
  return null
}

function ExclusiveDetailsGuard() {
  useEffect(() => {
    /* شرط الدكتور في كل البرنامج: ما إن يُفتح كرت حتى ينغلق كل ما سواه فوراً.
       الحصر في الإخوة المباشرين كان يترك «للطلاب والباحثين» مفتوحاً حين تُفتح
       «استماع» لأنهما ليسا في الحاوية نفسها. نغلق كل مفتوحٍ في الصفحة، إلا ما
       كان جدّاً للمفتوح (فإغلاقه يُخفي ما فتحه الزائر للتوّ). */
    const closeSiblingDetails = (event: Event) => {
      const current = event.target
      if (!(current instanceof HTMLDetailsElement) || !current.open) return
      if (current.hasAttribute('data-allow-multiple')) return
      for (const item of Array.from(document.querySelectorAll('details[open]'))) {
        if (item === current || !(item instanceof HTMLDetailsElement)) continue
        if (item.hasAttribute('data-allow-multiple')) continue
        if (item.contains(current)) continue
        item.open = false
      }
    }
    /* شرط الدكتور لا يقتصر على <details>: «استماع» زرٌّ يفتح مشغّل الصوت، وفتحُه
       لم يكن يغلق «للطلاب والباحثين» لأنه لا يُطلق حدث toggle أصلاً. نصغي هنا
       لكل ما يُعلن فتحه في البرنامج فنغلق ما سواه فوراً. */
    const closeAllOpenPanels = () => {
      for (const item of Array.from(document.querySelectorAll('details[open]'))) {
        if (item instanceof HTMLDetailsElement && !item.hasAttribute('data-allow-multiple')) item.open = false
      }
    }
    document.addEventListener('toggle', closeSiblingDetails, true)
    window.addEventListener('audio-player:open', closeAllOpenPanels)
    window.addEventListener('reader:panel-open', closeAllOpenPanels)
    return () => {
      document.removeEventListener('toggle', closeSiblingDetails, true)
      window.removeEventListener('audio-player:open', closeAllOpenPanels)
      window.removeEventListener('reader:panel-open', closeAllOpenPanels)
    }
  }, [])
  return null
}

function AnimatedRoutes() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="sync">
      <Suspense fallback={<RouteLoadingLine />}>
      <Routes location={loc} key={loc.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/publications" element={<Publications />} />
        <Route path="/publications/:slug" element={<BookDetail />} />
        <Route path="/research" element={<Research />} />
        <Route path="/research/:slug" element={<PaperDetail />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/search" element={<Search />} />
        <Route path="/ask" element={<AskLibrary />} />
        <Route path="/decade" element={<Decade />} />
        <Route path="/thought-paths" element={<ThoughtPaths />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/atlas" element={<Atlas />} />
        <Route path="/media" element={<Media />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/radar" element={<Radar />} />
        <Route path="/now" element={<Navigate to="/" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/curated" element={<Curated />} />
        <Route path="/upcoming" element={<Upcoming />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/about" element={<AboutSite />} />
        <Route path="/cv" element={<CV />} />
        <Route path="/cv-file/:kind" element={<CvFile />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/mylib" element={<NotFound />} />
        <Route path="/mylib/*" element={<NotFound />} />
        {/* المرآة الإنجليزية — الرئيسية والسيرة والأبحاث */}
        <Route path="/en" element={<EnglishHome />} />
        <Route path="/en/cv" element={<EnglishCV />} />
        <Route path="/en/research" element={<EnglishResearch />} />
        {/* جسر الروابط القديمة */}
        <Route path="/ar/*" element={<LegacyLang />} />
        <Route path="/en/*" element={<LegacyLang />} />
        <Route path="/signature_articles/:slug" element={<LegacyArticle />} />
        <Route path="/scholarly_contributi/:slug" element={<LegacyPaper />} />
        <Route path="/books/:slug" element={<LegacyBook />} />
        <Route path="/:slug" element={<LegacyPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

/** ينتظر تحديث وسوم SEO للصفحة، ثم يسجل مشاهدة واحدة للمسار في الجلسة. */
function ConditionalNav() {
  const location = useLocation()
  return location.pathname === '/admin' || location.pathname.startsWith('/cv-file/') ? null : <Nav />
}

function ConditionalActions() {
  const location = useLocation()
  if (location.pathname === '/admin' || location.pathname.startsWith('/cv-file/')) return null
  return (
    <>
      <FloatingActions />
      <PersistentAudioDock />
    </>
  )
}

function ConditionalFooter() {
  const location = useLocation()
  return location.pathname === '/' || location.pathname === '/admin' || location.pathname.startsWith('/cv-file/') ? null : <Footer />
}


function RouteJourneyTracker() {
  const location = useLocation()
  useTrackJourney(location.pathname, location.pathname !== '/admin')
  return null
}

function RouteViewTracker() {
  const location = useLocation()
  const [page, setPage] = useState({ path: '', title: '' })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage({ path: location.pathname, title: document.title })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [location.pathname])

  useTrackView(page.path, page.title, Boolean(page.path && page.path !== '/admin'))
  return null
}

export default function App() {
  return (
    <CmsProvider>
      <BrowserRouter>
        <PersistentAudioProvider>
          <WesternDigitsGuard />
          <AdaptiveSilence />
          <ExclusiveDetailsGuard />
          <RouteJourneyTracker />
          <RouteViewTracker />
          <a href="#main" className="skip-link">تخطّي إلى المحتوى</a>
          <ConditionalNav />
          <main id="main">
            <AnimatedRoutes />
          </main>
          <ConditionalActions />
          <ConditionalFooter />
        </PersistentAudioProvider>
      </BrowserRouter>
    </CmsProvider>
  )
}
