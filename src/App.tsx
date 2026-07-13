import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Cursor, EASE, Footer, Nav } from './components/ui'
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

/* ---------- البوابة الصامتة — حركة توقيع قصيرة بلا معلومات أو انتظار ---------- */
function Preloader({ done }: { done: boolean }) {
  return (
    <motion.div
      className="fixed inset-0 z-[300] isolate overflow-hidden bg-canvas"
      initial={{ opacity: 1 }}
      animate={done ? { opacity: 0 } : { opacity: 1 }}
      transition={{ duration: 0.24, ease: EASE }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-[3px] origin-right bg-accent"
        initial={{ scaleX: 0 }}
        animate={done ? { scaleX: 1, opacity: 0 } : { scaleX: 1, opacity: 1 }}
        transition={{ duration: done ? 0.32 : 0.72, ease: EASE }}
      />

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(42%_42%_at_50%_46%,rgba(62,92,120,.08),transparent_72%)]"
        initial={{ opacity: 0.35 }}
        animate={done ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          className="relative flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={done ? { opacity: 0, scale: 1.04 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.34, ease: EASE }}
        >
          <motion.span
            className="absolute inset-[-18px] rounded-[2rem] border border-hair/80"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={done ? { opacity: 0, scale: 1.08 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.34, delay: 0.02, ease: EASE }}
          />
          <motion.span
            className="absolute inset-[-34px] rounded-[2.5rem] border border-hair/40"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={done ? { opacity: 0, scale: 1.12 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, delay: 0.05, ease: EASE }}
          />
          <motion.img
            src="/logo.png"
            alt=""
            className="h-[58px] w-[94px] object-contain opacity-95 dark:invert sm:h-[66px] sm:w-[108px]"
            initial={{ opacity: 0, y: 8 }}
            animate={done ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.08, ease: EASE }}
          />
          <motion.span
            className="absolute -bottom-6 h-px w-20 bg-accent/70"
            initial={{ width: 0, opacity: 0 }}
            animate={done ? { width: 96, opacity: 0 } : { width: 80, opacity: 1 }}
            transition={{ duration: 0.38, delay: 0.14, ease: EASE }}
          />
        </motion.div>
      </div>
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
  // الفخامة سلاسة لا بطء: أول زيارة مشهد قصير، والزيارات اللاحقة بلا شاشة كاملة
  const seenThisSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('seen') === '1'
  const returning = (() => { try { return localStorage.getItem('visited') === '1' } catch { return false } })()
  const reduce = useReducedMotion()
  const showPreloader = !reduce && !seenThisSession && !returning
  const [loaded, setLoaded] = useState(!showPreloader)
  const [gone, setGone] = useState(!showPreloader)

  useEffect(() => {
    if (!showPreloader) { setLoaded(true); setGone(true); return }
    document.body.classList.add('loading')
    const t = setTimeout(() => setLoaded(true), 260)
    try { localStorage.setItem('visited', '1') } catch { /* noop */ }
    return () => clearTimeout(t)
  }, [showPreloader])

  useEffect(() => {
    if (!loaded) return
    document.body.classList.remove('loading')
    try { sessionStorage.setItem('seen', '1') } catch { /* noop */ }
    if (gone) return
    const t = setTimeout(() => setGone(true), 480)
    return () => clearTimeout(t)
  }, [loaded, gone])

  return (
    <CmsProvider>
      <BrowserRouter>
        <PersistentAudioProvider>
          <RouteViewTracker />
          <AnimatePresence>{!gone && <Preloader key="pre" done={loaded} />}</AnimatePresence>
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
