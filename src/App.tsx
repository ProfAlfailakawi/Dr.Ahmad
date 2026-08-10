import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router'
import { Footer, Nav, ThoughtTrace } from './components/ui'
import { FloatingActions } from './components/extras'
import { CmsProvider } from './lib/content'
import { useTrackJourney, useTrackView } from './lib/views'
import { PersistentAudioDock, PersistentAudioProvider } from './lib/persistent-audio'
import { ReadingMemoryGuard } from './components/MySpace'
import { SitewideIconClarifications } from './components/SitewideIconClarifications'
import Home from './pages/Home'

/* تقسيم الكود: الرئيسية فورية، وبقية الصفحات تُحمَّل عند زيارتها فقط —
   فأول تحميل للموقع أخف بكثير (نصوص المقالات الـ٢٧٦ك لا تنزل إلا لقارئها) */
const PwaLaunch = lazy(() => import('./pages/PwaLaunch'))
const Publications = lazy(() => import('./pages/Publications'))
const Research = lazy(() => import('./pages/Research'))
const Articles = lazy(() => import('./pages/Articles'))
const Listen = lazy(() => import('./pages/Listen'))
const Radio = lazy(() => import('./pages/Radio'))
const Search = lazy(() => import('./pages/Search'))
const AskLibrary = lazy(() => import('./pages/AskLibrary'))
const Decade = lazy(() => import('./pages/Decade'))
const ThoughtPaths = lazy(() => import('./pages/ThoughtPaths'))
const ConceptLife = lazy(() => import('./pages/ConceptLife'))
const ThoughtOverview = lazy(() => import('./pages/ThoughtOverview'))
const Media = lazy(() => import('./pages/Media'))
const MediaDetail = lazy(() => import('./pages/MediaDetail'))
const CV = lazy(() => import('./pages/CV'))
const Impact = lazy(() => import('./pages/Impact'))
const CvFile = lazy(() => import('./pages/CvFile'))
const Contact = lazy(() => import('./pages/Contact'))
const Card = lazy(() => import('./pages/Card'))
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
const EnglishContact = lazy(() => import('./pages/EnglishContact'))

function RouteLoadingLine() {
  return <div className="route-loading-line" aria-hidden="true" />
}

/* إدارة موضع التمرير على مستوى المسارات كلّها:
   - الانتقال إلى مادة جديدة يبدأ من الأعلى.
   - روابط # تذهب إلى القسم المقصود بعد ظهوره.
   - زر الرجوع/التقدّم يعيد الموضع السابق قدر الإمكان.
   Page وحده لا يكفي لأن React Router يعيد استعمال المكوّن عند تغيير slug. */
const routeScrollPositions = new Map<string, number>()
function RouteScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    const key = location.pathname
    let cancelled = false
    let attempts = 0

    const settle = () => {
      if (cancelled) return
      if (location.hash) {
        const id = decodeURIComponent(location.hash.slice(1))
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView({ block: 'start' })
          return
        }
        if (attempts < 12) {
          attempts += 1
          window.setTimeout(settle, attempts < 5 ? 40 : 90)
          return
        }
      }
      if (navigationType === 'POP' && routeScrollPositions.has(key)) {
        window.scrollTo({ top: routeScrollPositions.get(key) || 0, left: 0 })
      } else {
        window.scrollTo({ top: 0, left: 0 })
      }
    }

    const frame = window.requestAnimationFrame(settle)
    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      routeScrollPositions.set(key, window.scrollY)
    }
  }, [location.hash, location.pathname, navigationType])

  return null
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

    // كان كل تحديث React يمسح الشجرة فوراً داخل MutationObserver، فيتكدّس
    // العمل على الصفحات الطويلة. نجمع العقد وننظفها دفعة واحدة وقت الخمول.
    const pending = new Set<Node>()
    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    let scheduled = 0
    const flush = () => {
      scheduled = 0
      const nodes = Array.from(pending)
      pending.clear()
      for (const node of nodes) {
        if (node.nodeType === Node.TEXT_NODE) normalizeText(node)
        else if (node instanceof Element) normalizeElement(node)
      }
    }
    const schedule = () => {
      if (scheduled) return
      scheduled = win.requestIdleCallback
        ? win.requestIdleCallback(flush, { timeout: 350 })
        : window.setTimeout(flush, 32)
    }
    const queue = (node: Node) => {
      pending.add(node)
      schedule()
    }

    queue(document.body)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') queue(mutation.target)
        for (const node of mutation.addedNodes) queue(node)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      pending.clear()
      if (scheduled) {
        if (win.cancelIdleCallback) win.cancelIdleCallback(scheduled)
        else window.clearTimeout(scheduled)
      }
    }
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

      // إغلاق بطاقة أعلى الصفحة يغيّر ارتفاع المستند فيقفز الكرت المضغوط إلى
      // موضع آخر. نحفظ موضعه البصري ثم نعوض الفرق بعد الإغلاق في الإطار التالي.
      const beforeTop = current.getBoundingClientRect().top
      let closedAny = false
      for (const item of Array.from(document.querySelectorAll('details[open]'))) {
        if (item === current || !(item instanceof HTMLDetailsElement)) continue
        if (item.hasAttribute('data-allow-multiple')) continue
        if (item.contains(current)) continue
        item.open = false
        closedAny = true
      }
      if (closedAny) {
        window.requestAnimationFrame(() => {
          if (!current.isConnected || !current.open) return
          const delta = current.getBoundingClientRect().top - beforeTop
          if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, left: 0, behavior: 'auto' })
        })
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

/* سكة الهاتف: البطاقة تظهر كاملة، والدائرتان الدقيقتان تقولان فقط إن كان
   هناك محتوى فعلي في اليسار/اليمين. لا peek ولا قصّ لبطاقة أخرى. نكتشف
   السكك بصرياً حتى يشمل القانون الصفحات القديمة والجديدة من دون تحويل
   التبويبات القصيرة أو صفوف الأيقونات إلى بطاقات. */
function MobileCardRailGuard() {
  const location = useLocation()

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const selector = [
      '.rail', '.edge-fade', '.mobile-card-rail', '.mobile-paired-grid',
      '.article-featured-rail', '.signatures-rail', '.media-related-rail',
      '.ask-book-rail', '.book-spine-rail', '.home-motion-rail', '.idea-trace-rail',
      '[data-horizontal-video-rail="true"]',
    ].join(',')
    const enhanced = new Set<HTMLElement>()
    let frame = 0

    const childrenOf = (rail: HTMLElement) => Array.from(rail.children).filter((node): node is HTMLElement => node instanceof HTMLElement && node.offsetParent !== null && node.getAttribute('aria-hidden') !== 'true')

    const eligible = (rail: HTMLElement) => {
      if (!media.matches || rail.closest('.admin-dashboard, [role="dialog"]')) return false
      const signatureRail = rail.matches('.signatures-rail')
      if (!signatureRail && (rail.matches('nav, [role="tablist"], [role="group"], .editorial-tablist') || rail.closest('nav'))) return false
      if (!signatureRail && rail.querySelector(':scope > [role="tablist"], :scope > [role="group"], :scope > nav')) return false
      if (rail.closest('.content-books')) return false
      const children = childrenOf(rail)
      if (!children.length) return false
      const style = getComputedStyle(rail)
      const horizontallyScrollable = rail.scrollWidth > rail.clientWidth + 3 && /(auto|scroll)/.test(style.overflowX)
      const knownCardRail = rail.matches('.mobile-card-rail, .mobile-paired-grid, .article-featured-rail, .signatures-rail, .media-related-rail, .ask-book-rail, .book-spine-rail, .home-motion-rail, .idea-trace-rail, [data-horizontal-video-rail="true"]')
      if (knownCardRail && children.length === 1) return true
      if (!horizontallyScrollable) return false
      const railWidth = Math.max(rail.clientWidth, 1)
      const widest = Math.max(...children.map((child) => child.getBoundingClientRect().width))
      return knownCardRail || widest >= railWidth * .44
    }

    const updateRail = (rail: HTMLElement) => {
      if (!eligible(rail)) {
        rail.removeAttribute('data-mobile-card-rail')
        rail.removeAttribute('data-can-left')
        rail.removeAttribute('data-can-right')
        enhanced.delete(rail)
        return
      }
      rail.setAttribute('data-mobile-card-rail', 'true')
      enhanced.add(rail)
      const rect = rail.getBoundingClientRect()
      const children = childrenOf(rail)
      const overflow = rail.scrollWidth > rail.clientWidth + 3 && children.length > 1
      if (!overflow) {
        rail.setAttribute('data-can-left', 'false')
        rail.setAttribute('data-can-right', 'false')
        return
      }
      let minLeft = Infinity
      let maxRight = -Infinity
      for (const child of children) {
        const childRect = child.getBoundingClientRect()
        minLeft = Math.min(minLeft, childRect.left)
        maxRight = Math.max(maxRight, childRect.right)
      }
      rail.setAttribute('data-can-left', minLeft < rect.left - 2 ? 'true' : 'false')
      rail.setAttribute('data-can-right', maxRight > rect.right + 2 ? 'true' : 'false')
    }

    const refresh = () => {
      frame = 0
      document.querySelectorAll<HTMLElement>(selector).forEach(updateRail)
      // إضافة data تغيّر عرض البطاقة من peek إلى 100%؛ نقيس مرة ثانية بعد الرسم.
      window.requestAnimationFrame(() => enhanced.forEach(updateRail))
    }
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(refresh)
    }
    const onScroll = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLElement && target.dataset.mobileCardRail === 'true') updateRail(target)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('main') || document.body, { childList: true, subtree: true })
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('orientationchange', schedule)
    media.addEventListener?.('change', schedule)
    schedule()
    return () => {
      observer.disconnect()
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      media.removeEventListener?.('change', schedule)
      if (frame) window.cancelAnimationFrame(frame)
      enhanced.forEach((rail) => {
        rail.removeAttribute('data-mobile-card-rail')
        rail.removeAttribute('data-can-left')
        rail.removeAttribute('data-can-right')
      })
    }
  }, [location.pathname])

  return null
}

function AnimatedRoutes() {
  const loc = useLocation()
  return (
    <AnimatePresence mode="sync">
      <Suspense fallback={<RouteLoadingLine />}>
      <Routes location={loc} key={loc.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/launch" element={<PwaLaunch />} />
        <Route path="/publications" element={<Publications />} />
        <Route path="/publications/:slug" element={<BookDetail />} />
        <Route path="/research" element={<Research />} />
        <Route path="/research/:slug" element={<PaperDetail />} />
        <Route path="/articles" element={<Articles />} />
        <Route path="/listen" element={<Listen />} />
        <Route path="/radio" element={<Radio />} />
        <Route path="/search" element={<Search />} />
        <Route path="/ask" element={<AskLibrary />} />
        <Route path="/decade" element={<Decade />} />
        <Route path="/thought-paths" element={<ThoughtPaths />} />
        {/* سيرة مفهوم: تبدأ من الفكرة لا من المادة، وتعرض رحلتها في الزمن. */}
        <Route path="/concept/:term" element={<ConceptLife />} />
        <Route path="/thought" element={<ThoughtOverview />} />
        <Route path="/articles/:slug" element={<ArticleDetail />} />
        <Route path="/atlas" element={<Atlas />} />
        <Route path="/media" element={<Media />} />
        <Route path="/media/:slug" element={<MediaDetail />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/radar" element={<Radar />} />
        <Route path="/now" element={<Navigate to="/" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/curated" element={<Curated />} />
        <Route path="/upcoming" element={<Upcoming />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/about" element={<AboutSite />} />
        <Route path="/cv" element={<CV />} />
        <Route path="/impact/*" element={<Impact />} />
        <Route path="/cv/impact" element={<Navigate to="/impact" replace />} />
        <Route path="/cv-file/:kind" element={<CvFile />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/card" element={<Card />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/mylib" element={<NotFound />} />
        <Route path="/mylib/*" element={<NotFound />} />
        {/* المرآة الإنجليزية — الرئيسية والسيرة والأبحاث */}
        <Route path="/en" element={<EnglishHome />} />
        <Route path="/en/cv" element={<EnglishCV />} />
        <Route path="/en/research" element={<EnglishResearch />} />
        <Route path="/en/contact" element={<EnglishContact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

function ConditionalNav() {
  const location = useLocation()
  return location.pathname === '/admin' || location.pathname === '/launch' || location.pathname.startsWith('/cv-file/') ? null : <Nav />
}

function ConditionalActions() {
  const location = useLocation()
  if (location.pathname === '/admin' || location.pathname === '/launch' || location.pathname.startsWith('/cv-file/')) return null
  return (
    <>
      <FloatingActions />
      <PersistentAudioDock />
    </>
  )
}

function ConditionalFooter() {
  const location = useLocation()
  return location.pathname === '/' || location.pathname === '/admin' || location.pathname === '/launch' || location.pathname.startsWith('/cv-file/') ? null : <Footer />
}




/** في النسخة المثبّتة، الرجوع إلى البرنامج بعد خروجه يبدأ من الرئيسية بدل
    استعادة صفحة داخلية قديمة. لا يطبّق ذلك على تبويب المتصفح العادي. */
function PwaResumeHome() {
  const location = useLocation()
  const navigate = useNavigate()
  const hiddenAt = useRef(0)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    if (!standalone) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      if (!hiddenAt.current || Date.now() - hiddenAt.current < 1200) return
      hiddenAt.current = 0
      if (location.pathname === '/' || location.pathname === '/admin' || location.pathname.startsWith('/cv-file/')) return
      navigate('/', { replace: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [location.pathname, navigate])

  return null
}

function RouteJourneyTracker() {
  const location = useLocation()
  useTrackJourney(location.pathname, location.pathname !== '/admin' && location.pathname !== '/launch')
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

function RoutedApplication() {
  const location = useLocation()
  const adminRoute = location.pathname.startsWith('/admin')
  return (
    <CmsProvider realtime={adminRoute}>
      <PersistentAudioProvider>
        <WesternDigitsGuard />
      <SitewideIconClarifications />
        <AdaptiveSilence />
        <ExclusiveDetailsGuard />
        <MobileCardRailGuard />
        <ReadingMemoryGuard />
        <PwaResumeHome />
        <RouteJourneyTracker />
        <RouteViewTracker />
        <RouteScrollManager />
        <a href="#main" className="skip-link">تخطّي إلى المحتوى</a>
        <ConditionalNav />
        <ThoughtTrace />
        <main id="main">
          <AnimatedRoutes />
        </main>
        <ConditionalActions />
        <ConditionalFooter />
      </PersistentAudioProvider>
    </CmsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RoutedApplication />
    </BrowserRouter>
  )
}
