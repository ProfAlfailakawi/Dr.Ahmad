import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Cursor, EASE, Footer, Nav } from './components/ui'
import { FloatingActions } from './components/extras'
import { CmsProvider } from './lib/content'
import { useTrackView } from './lib/views'
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
const Admin = lazy(() => import('./pages/Admin'))
const NotFound = lazy(() => import('./pages/NotFound'))
const LegacyArticle = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyArticle })))
const LegacyBook = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyBook })))
const LegacyLang = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyLang })))
const LegacyPage = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPage })))
const LegacyPaper = lazy(() => import('./pages/Legacy').then((m) => ({ default: m.LegacyPaper })))

/* ---------- Preloader — «الضربة الأولى»: جملة الهوية قبل كل شيء ---------- */
function Preloader({ done }: { done: boolean }) {
  return (
    <motion.div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-canvas"
      initial={{ y: 0 }}
      animate={done ? { y: '-100%' } : { y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      aria-hidden
    >
      <motion.p
        className="px-8 text-center font-display text-[clamp(1.3rem,3.6vw,2.1rem)] font-semibold leading-relaxed text-ink"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
      >
        «أُبقي الإنسانَ في قلبِ الآلة.»
      </motion.p>
      <motion.img
        src="/logo.png"
        alt=""
        className="mt-7 h-12 w-auto dark:invert"
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 0.92, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
      />
      <motion.div className="mt-5 h-[2px] bg-accent" initial={{ width: 0 }} animate={{ width: 120 }} transition={{ duration: 0.7, delay: 0.5, ease: EASE }} />
    </motion.div>
  )
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
        <Route path="/admin" element={<Admin />} />
        <Route path="/curated" element={<Curated />} />
        <Route path="/upcoming" element={<Upcoming />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/about" element={<AboutSite />} />
        <Route path="/cv" element={<CV />} />
        <Route path="/contact" element={<Contact />} />
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
  // الفخامة سلاسة لا بطء: أول زيارة مشهد قصير، وزيارات الجلسة التالية بلا شاشة كاملة
  const seenThisSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('seen') === '1'
  // الزائر العائد (جلسة جديدة): ومضة شعار 400م‌ث فقط — أول زيارة في العمر: 1000م‌ث
  const returning = (() => { try { return localStorage.getItem('visited') === '1' } catch { return false } })()
  const [loaded, setLoaded] = useState(seenThisSession)
  const [gone, setGone] = useState(seenThisSession)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce || seenThisSession) { setLoaded(true); setGone(true); return }
    document.body.classList.add('loading')
    const t = setTimeout(() => setLoaded(true), returning ? 400 : 1000)
    try { localStorage.setItem('visited', '1') } catch { /* noop */ }
    return () => clearTimeout(t)
  }, [reduce, seenThisSession, returning])

  useEffect(() => {
    if (!loaded) return
    document.body.classList.remove('loading')
    try { sessionStorage.setItem('seen', '1') } catch { /* noop */ }
    if (gone) return
    const t = setTimeout(() => setGone(true), 620)
    return () => clearTimeout(t)
  }, [loaded, gone])

  return (
    <CmsProvider>
      <BrowserRouter>
        <RouteViewTracker />
        <AnimatePresence>{!gone && <Preloader key="pre" done={loaded} />}</AnimatePresence>
        <a href="#main" className="skip-link">تخطّي إلى المحتوى</a>
        <Cursor />
        <Nav />
        <main id="main">
          <AnimatedRoutes />
        </main>
        <FloatingActions />
        <Footer />
      </BrowserRouter>
    </CmsProvider>
  )
}
