import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Cursor, Footer, Nav } from './components/ui'
import { FloatingActions } from './components/extras'
import { CmsProvider } from './lib/content'
import { useTrackView } from './lib/views'
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
const Now = lazy(() => import('./pages/Now'))
const Admin = lazy(() => import('./pages/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))
const EnglishHome = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishHome })))
const EnglishCV = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishCV })))
const EnglishResearch = lazy(() => import('./pages/English').then((m) => ({ default: m.EnglishResearch })))
const LegacyArticle = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyArticle })))
const LegacyBook = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyBook })))
const LegacyLang = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyLang })))
const LegacyPage = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPage })))
const LegacyPaper = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPaper })))

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

function AnimatedRoutes() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
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
        <Route path="/now" element={<Now />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/curated" element={<Curated />} />
        <Route path="/upcoming" element={<Upcoming />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/about" element={<AboutSite />} />
        <Route path="/cv" element={<CV />} />
        <Route path="/contact" element={<Contact />} />
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
function ConditionalFooter() {
  const location = useLocation()
  return location.pathname === '/' ? null : <Footer />
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
          <RouteViewTracker />
          <a href="#main" className="skip-link">تخطّي إلى المحتوى</a>
          <Cursor />
          <Nav />
          <main id="main">
            <AnimatedRoutes />
          </main>
          <FloatingActions />
          <PersistentAudioDock />
          <ConditionalFooter />
        </PersistentAudioProvider>
      </BrowserRouter>
    </CmsProvider>
  )
}
