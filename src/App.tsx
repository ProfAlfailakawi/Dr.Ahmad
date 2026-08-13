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
import { MediaSkeletonGuard, StaggerRevealGuard } from './components/InterfacePolish'
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
const CardLive = lazy(() => import('./pages/CardLive'))
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

/* لغة التنقّل الأفقية للموقع:
   - الهاتف: البطاقة كاملة، ونقطتان دقيقتان تظهران فقط في الاتجاه المتاح.
   - الكمبيوتر: السكة نفسها قابلة للسحب بالماوس، لا نعتمد hover ولا أزرار.
   - أول نقطة يراها الزائر فقط تعرّف نفسها بنبضة واحدة وعبارة «اسحب للتنقّل»،
     ثم تُحفظ المعرفة محلياً فلا يتكرر التعليم في بقية الموقع أو الزيارات التالية. */
const SWIPE_DISCOVERY_KEY = 'dr-ahmad:swipe-discovery:v1'

function MobileCardRailGuard() {
  const location = useLocation()

  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 767px)')
    const finePointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)')
    const selector = [
      '.rail', '.edge-fade', '.mobile-card-rail', '.mobile-paired-grid',
      '.article-featured-rail', '.signatures-rail', '.media-related-rail',
      '.ask-book-rail', '.book-spine-rail', '.home-motion-rail', '.idea-trace-rail',
      '[data-horizontal-video-rail="true"]',
    ].join(',')
    const enhancedMobile = new Set<HTMLElement>()
    const enhancedSwipe = new Set<HTMLElement>()
    const dragCleanups = new Map<HTMLElement, () => void>()
    let frame = 0
    let discoverySeen = false
    let discoveryOverlay: HTMLElement | null = null
    let discoveryTimer = 0
    let discoveryPositionFrame = 0
    let discoveryRail: HTMLElement | null = null

    try {
      discoverySeen = window.localStorage.getItem(SWIPE_DISCOVERY_KEY) === 'seen'
    } catch {
      discoverySeen = document.documentElement.dataset.swipeDiscoverySeen === 'true'
    }

    const markDiscoverySeen = () => {
      if (discoverySeen) return
      discoverySeen = true
      document.documentElement.dataset.swipeDiscoverySeen = 'true'
      try { window.localStorage.setItem(SWIPE_DISCOVERY_KEY, 'seen') } catch { /* storage may be blocked */ }
    }

    const childrenOf = (rail: HTMLElement) => Array.from(rail.children).filter((node): node is HTMLElement => (
      node instanceof HTMLElement
      && node.offsetParent !== null
      && node.getAttribute('aria-hidden') !== 'true'
      && !node.classList.contains('rail-swipe-discovery')
    ))

    const isKnownCardRail = (rail: HTMLElement) => rail.matches([
      '.mobile-card-rail', '.mobile-paired-grid', '.article-featured-rail', '.signatures-rail',
      '.media-related-rail', '.ask-book-rail', '.book-spine-rail', '.home-motion-rail',
      '.idea-trace-rail', '[data-horizontal-video-rail="true"]',
    ].join(','))

    const baseEligible = (rail: HTMLElement) => {
      if (rail.closest('.admin-dashboard, [role="dialog"]')) return false
      const signatureRail = rail.matches('.signatures-rail')
      if (!signatureRail && (rail.matches('nav, [role="tablist"], [role="group"], .editorial-tablist') || rail.closest('nav'))) return false
      if (!signatureRail && rail.querySelector(':scope > [role="tablist"], :scope > [role="group"], :scope > nav')) return false
      if (rail.closest('.content-books')) return false
      const children = childrenOf(rail)
      if (children.length < 2) return false
      const style = getComputedStyle(rail)
      const horizontallyScrollable = rail.scrollWidth > rail.clientWidth + 3 && /(auto|scroll)/.test(style.overflowX)
      if (!horizontallyScrollable) return false
      const railWidth = Math.max(rail.clientWidth, 1)
      const widest = Math.max(...children.map((child) => child.getBoundingClientRect().width))
      return isKnownCardRail(rail) || widest >= railWidth * .44
    }

    const setAvailability = (rail: HTMLElement) => {
      const rect = rail.getBoundingClientRect()
      const children = childrenOf(rail)
      const overflow = rail.scrollWidth > rail.clientWidth + 3 && children.length > 1
      if (!overflow) {
        rail.setAttribute('data-can-left', 'false')
        rail.setAttribute('data-can-right', 'false')
        return false
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
      return true
    }

    const removeDesktopDrag = (rail: HTMLElement) => {
      dragCleanups.get(rail)?.()
      dragCleanups.delete(rail)
      rail.removeAttribute('data-swipe-drag')
      rail.removeAttribute('data-swipe-dragging')
    }

    const ensureDesktopDrag = (rail: HTMLElement) => {
      if (!finePointerMedia.matches || dragCleanups.has(rail)) return
      let pointerId: number | null = null
      let startX = 0
      let startScrollLeft = 0
      let moved = false
      let suppressClickUntil = 0

      const endDrag = (event?: PointerEvent) => {
        if (pointerId === null) return
        if (event && rail.hasPointerCapture?.(pointerId)) {
          try { rail.releasePointerCapture(pointerId) } catch { /* already released */ }
        }
        if (moved) suppressClickUntil = performance.now() + 260
        pointerId = null
        moved = false
        rail.removeAttribute('data-swipe-dragging')
      }
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return
        if ((event.target as Element | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
        pointerId = event.pointerId
        startX = event.clientX
        startScrollLeft = rail.scrollLeft
        moved = false
        try { rail.setPointerCapture(event.pointerId) } catch { /* optional */ }
      }
      const onPointerMove = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return
        const delta = event.clientX - startX
        if (!moved && Math.abs(delta) < 6) return
        moved = true
        rail.setAttribute('data-swipe-dragging', 'true')
        event.preventDefault()
        rail.scrollLeft = startScrollLeft - delta
      }
      const onPointerUp = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return
        endDrag(event)
      }
      const onClickCapture = (event: MouseEvent) => {
        if (performance.now() < suppressClickUntil) {
          event.preventDefault()
          event.stopPropagation()
        }
      }
      const onDragStart = (event: DragEvent) => {
        if (pointerId !== null) event.preventDefault()
      }

      rail.addEventListener('pointerdown', onPointerDown)
      rail.addEventListener('pointermove', onPointerMove)
      rail.addEventListener('pointerup', onPointerUp)
      rail.addEventListener('pointercancel', onPointerUp)
      rail.addEventListener('click', onClickCapture, true)
      rail.addEventListener('dragstart', onDragStart)
      rail.setAttribute('data-swipe-drag', 'true')
      dragCleanups.set(rail, () => {
        rail.removeEventListener('pointerdown', onPointerDown)
        rail.removeEventListener('pointermove', onPointerMove)
        rail.removeEventListener('pointerup', onPointerUp)
        rail.removeEventListener('pointercancel', onPointerUp)
        rail.removeEventListener('click', onClickCapture, true)
        rail.removeEventListener('dragstart', onDragStart)
      })
    }

    const updateRail = (rail: HTMLElement) => {
      if (!baseEligible(rail)) {
        rail.removeAttribute('data-mobile-card-rail')
        rail.removeAttribute('data-swipe-rail')
        rail.removeAttribute('data-can-left')
        rail.removeAttribute('data-can-right')
        enhancedMobile.delete(rail)
        enhancedSwipe.delete(rail)
        removeDesktopDrag(rail)
        return
      }

      rail.setAttribute('data-swipe-rail', 'true')
      enhancedSwipe.add(rail)
      const mobile = mobileMedia.matches
      if (mobile) {
        rail.setAttribute('data-mobile-card-rail', 'true')
        enhancedMobile.add(rail)
        removeDesktopDrag(rail)
      } else {
        rail.removeAttribute('data-mobile-card-rail')
        enhancedMobile.delete(rail)
        if (finePointerMedia.matches) ensureDesktopDrag(rail)
        else removeDesktopDrag(rail)
      }
      setAvailability(rail)
    }

    const hideDiscovery = (remember = true) => {
      if (remember) markDiscoverySeen()
      if (discoveryTimer) window.clearTimeout(discoveryTimer)
      discoveryTimer = 0
      if (discoveryPositionFrame) window.cancelAnimationFrame(discoveryPositionFrame)
      discoveryPositionFrame = 0
      discoveryRail = null
      const overlay = discoveryOverlay
      discoveryOverlay = null
      if (!overlay) return
      overlay.classList.add('is-leaving')
      window.setTimeout(() => overlay.remove(), 260)
    }

    const positionDiscovery = () => {
      discoveryPositionFrame = 0
      if (!discoveryOverlay || !discoveryRail?.isConnected) return
      const rect = discoveryRail.getBoundingClientRect()
      const direction = discoveryOverlay.dataset.direction === 'left' ? 'left' : 'right'
      const x = direction === 'left' ? rect.left + 12 : rect.right - 12
      const y = Math.min(window.innerHeight - 22, Math.max(22, rect.bottom - 7))
      discoveryOverlay.style.left = `${Math.round(x)}px`
      discoveryOverlay.style.top = `${Math.round(y)}px`
    }

    const scheduleDiscoveryPosition = () => {
      if (discoveryPositionFrame || !discoveryOverlay) return
      discoveryPositionFrame = window.requestAnimationFrame(positionDiscovery)
    }

    const showDiscovery = (rail: HTMLElement) => {
      if (discoverySeen || discoveryOverlay || !rail.isConnected) return
      const canLeft = rail.dataset.canLeft === 'true'
      const canRight = rail.dataset.canRight === 'true'
      if (!canLeft && !canRight) return
      const direction = canRight && !canLeft ? 'right' : 'left'
      const overlay = document.createElement('div')
      overlay.className = `rail-swipe-discovery rail-swipe-discovery--${direction}`
      overlay.dataset.direction = direction
      overlay.setAttribute('role', 'status')
      overlay.setAttribute('aria-live', 'polite')
      overlay.innerHTML = '<span class="rail-swipe-discovery__dot" aria-hidden="true"></span><span class="rail-swipe-discovery__label">اسحب للتنقّل</span>'
      document.body.appendChild(overlay)
      discoveryOverlay = overlay
      discoveryRail = rail
      positionDiscovery()
      // التعليم يظهر تلقائياً مرة واحدة فقط؛ النقطة ليست زرّاً ولا تستجيب للضغط.
      discoveryTimer = window.setTimeout(() => hideDiscovery(true), 4300)
      const dismissOnSwipe = () => {
        if (discoveryOverlay) hideDiscovery(true)
        rail.removeEventListener('scroll', dismissOnSwipe)
      }
      rail.addEventListener('scroll', dismissOnSwipe, { passive: true })
      window.setTimeout(markDiscoverySeen, 900)
    }

    const discoveryObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
      if (discoverySeen || discoveryOverlay) return
      const visible = entries
        .filter((entry) => entry.isIntersecting && entry.intersectionRatio >= .18)
        .map((entry) => entry.target)
        .filter((target): target is HTMLElement => target instanceof HTMLElement && target.dataset.swipeRail === 'true')
        .filter((rail) => rail.dataset.canLeft === 'true' || rail.dataset.canRight === 'true')
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      if (visible[0]) showDiscovery(visible[0])
    }, { threshold: [.18, .35, .6] }) : null

    const syncDiscoveryTargets = () => {
      if (discoverySeen) return
      if (discoveryObserver) {
        enhancedSwipe.forEach((rail) => discoveryObserver.observe(rail))
        return
      }
      // fallback للمتصفحات القديمة: اختر أول سكة ظاهرة فعلياً فقط.
      const firstVisible = Array.from(enhancedSwipe)
        .filter((rail) => rail.dataset.canLeft === 'true' || rail.dataset.canRight === 'true')
        .filter((rail) => {
          const rect = rail.getBoundingClientRect()
          return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]
      if (firstVisible) showDiscovery(firstVisible)
    }

    const refresh = () => {
      frame = 0
      document.querySelectorAll<HTMLElement>(selector).forEach(updateRail)
      // على الهاتف، إضافة data تجعل البطاقة 100%؛ نعيد القياس بعد الرسم حتى تكون
      // إشارات الاتجاه دقيقة بعد إلغاء الـ peek.
      window.requestAnimationFrame(() => {
        enhancedSwipe.forEach((rail) => {
          setAvailability(rail)
          if (!mobileMedia.matches) ensureDesktopDrag(rail)
        })
        syncDiscoveryTargets()
      })
    }
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(refresh)
    }
    const onScroll = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLElement && target.dataset.swipeRail === 'true') setAvailability(target)
      scheduleDiscoveryPosition()
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('main') || document.body, { childList: true, subtree: true })
    document.addEventListener('scroll', onScroll, true)
    window.addEventListener('scroll', scheduleDiscoveryPosition, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    window.addEventListener('resize', scheduleDiscoveryPosition, { passive: true })
    window.addEventListener('orientationchange', schedule)
    mobileMedia.addEventListener?.('change', schedule)
    finePointerMedia.addEventListener?.('change', schedule)
    schedule()

    return () => {
      observer.disconnect()
      discoveryObserver?.disconnect()
      document.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('scroll', scheduleDiscoveryPosition)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('resize', scheduleDiscoveryPosition)
      window.removeEventListener('orientationchange', schedule)
      mobileMedia.removeEventListener?.('change', schedule)
      finePointerMedia.removeEventListener?.('change', schedule)
      if (frame) window.cancelAnimationFrame(frame)
      hideDiscovery(false)
      dragCleanups.forEach((cleanup, rail) => {
        cleanup()
        rail.removeAttribute('data-swipe-drag')
        rail.removeAttribute('data-swipe-dragging')
      })
      dragCleanups.clear()
      enhancedSwipe.forEach((rail) => {
        rail.removeAttribute('data-mobile-card-rail')
        rail.removeAttribute('data-swipe-rail')
        rail.removeAttribute('data-can-left')
        rail.removeAttribute('data-can-right')
      })
    }
  }, [location.pathname])

  return null
}

/* استباق المسارات: حزمة كل صفحة تُنزَّل عند النقر عليها أول مرة، فيبقى الزائر
   لحظةً أمام شريط التحميل. هنا نسبق نقرته: نُدفئ أثقل المسارات المشتركة وقت خمول
   المتصفح بعد استقرار الصفحة الأولى، ونجلب مسار الرابط بمجرد أن يلمسه المؤشر.
   الوحدة تُخزَّن في ذاكرة المتصفح فيصير الانتقال فورياً، ولا شيء في السلوك يتغيّر.
   ونمتنع تماماً حين يطلب النظام توفير البيانات أو تكون الشبكة بطيئة. */
const routeChunkLoaders: Array<[RegExp, () => Promise<unknown>]> = [
  [/^\/articles\/[^/]+/, () => import('./pages/ArticleDetail')],
  [/^\/articles\/?$/, () => import('./pages/Articles')],
  [/^\/publications\/[^/]+/, () => import('./pages/BookDetail')],
  [/^\/publications\/?$/, () => import('./pages/Publications')],
  [/^\/research\/[^/]+/, () => import('./pages/PaperDetail')],
  [/^\/research\/?$/, () => import('./pages/Research')],
  [/^\/media\/[^/]+/, () => import('./pages/MediaDetail')],
  [/^\/media\/?$/, () => import('./pages/Media')],
  [/^\/listen\/?$/, () => import('./pages/Listen')],
  [/^\/search\/?$/, () => import('./pages/Search')],
  [/^\/ask\/?$/, () => import('./pages/AskLibrary')],
  [/^\/atlas\/?$/, () => import('./pages/Atlas')],
  [/^\/cv\/?$/, () => import('./pages/CV')],
  [/^\/thought-paths\/?$/, () => import('./pages/ThoughtPaths')],
  [/^\/radar\/?$/, () => import('./pages/Radar')],
  [/^\/questions\/?$/, () => import('./pages/Questions')],
  [/^\/contact\/?$/, () => import('./pages/Contact')],
]

const warmedRoutes = new Set<string>()
function warmRoute(pathname: string) {
  const entry = routeChunkLoaders.find(([pattern]) => pattern.test(pathname))
  if (!entry) return
  const key = String(entry[0])
  if (warmedRoutes.has(key)) return
  warmedRoutes.add(key)
  entry[1]().catch(() => { warmedRoutes.delete(key) })
}

function RoutePrefetcher() {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (connection?.saveData) return
    if (connection?.effectiveType && /2g/.test(connection.effectiveType)) return

    const win = window as typeof window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    /* المقال أول ما يقصده الزائر، ثم الكتب والأرشيف والبحث. */
    const queue = ['/articles/x', '/articles', '/publications', '/media', '/search']
    let idle = 0
    let timer = 0
    const step = () => {
      const next = queue.shift()
      if (!next) return
      warmRoute(next)
      if (win.requestIdleCallback) idle = win.requestIdleCallback(step, { timeout: 4000 })
      else timer = window.setTimeout(step, 400)
    }
    timer = window.setTimeout(step, 1500)

    const onHover = (event: Event) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="/"]') as HTMLAnchorElement | null
      if (!link) return
      warmRoute(new URL(link.href, window.location.origin).pathname)
    }
    document.addEventListener('pointerover', onHover, { passive: true })
    document.addEventListener('touchstart', onHover, { passive: true })
    return () => {
      document.removeEventListener('pointerover', onHover)
      document.removeEventListener('touchstart', onHover)
      if (idle && win.cancelIdleCallback) win.cancelIdleCallback(idle)
      window.clearTimeout(timer)
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
        {/* البطاقة الحيّة: مسرحُ الجسيمات للمؤتمرات، و/card تبقى الهادئة. */}
        <Route path="/cards" element={<CardLive />} />
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

/* المسارات المستقلّة: صفحاتٌ تملأ الشاشة بهويّتها الخاصّة ولا تحتمل قشرة
   الموقع فوقها — لوحة التحكم، شاشة الإطلاق، ملفات السيرة، والبطاقة الحيّة
   التي تُعرض على شاشةٍ في قاعة مؤتمر. */
const STANDALONE_ROUTES = new Set(['/admin', '/launch', '/cards'])
const isStandaloneRoute = (pathname: string) => STANDALONE_ROUTES.has(pathname) || pathname.startsWith('/cv-file/')

function ConditionalNav() {
  const location = useLocation()
  return isStandaloneRoute(location.pathname) ? null : <Nav />
}

function ConditionalActions() {
  const location = useLocation()
  if (isStandaloneRoute(location.pathname)) return null
  return (
    <>
      <FloatingActions />
      <PersistentAudioDock />
    </>
  )
}

function ConditionalFooter() {
  const location = useLocation()
  return location.pathname === '/' || isStandaloneRoute(location.pathname) ? null : <Footer />
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
        <MediaSkeletonGuard />
        <StaggerRevealGuard />
        <ReadingMemoryGuard />
        <PwaResumeHome />
        <RouteJourneyTracker />
        <RouteViewTracker />
        <RouteScrollManager />
        <RoutePrefetcher />
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
