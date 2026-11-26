import React, { useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/alexandria'
import App from './App'
import ErrorBoundary, { healStaleBundles, isStaleBundleError } from './components/ErrorBoundary'
import { installAppUpdate } from './lib/app-update'
import { installUpdatingNotice } from './lib/updating-notice'
import { installDomResilience } from './lib/dom-resilience'
import { hasMissingAppChunk, watchResourceFailures } from './lib/load-failures'
import { startWebVitalsMonitoring } from './lib/web-vitals'
import { DEMO_MODE } from './demo/mode'
import { installDemoApi } from './demo/api-mock'
import './index.css'
import './components/dna/dna.css'
import './components/dna/dna-theme.css'
import './components/elevation.css'
import './components/elevation-2.css'
import './polish.css'
import './beauty.css'
import './duo.css'
import { installPolishReveal } from './lib/polish-reveal'

/* شفاء الحزم اليتيمة: هاتفٌ فتح رابطاً بهيكلٍ قديم أثناء نشرةٍ جديدة يطلب
   حزمةً تغيّر اسمها فتغيب المتون (صفحة «قيد الإضافة» الزائفة). فشلُ التحميل
   الكسول = إعادة تحميلٍ ذاتية مرة واحدة فيأتي الهيكل الجديد بحزمه الصحيحة. */
function healOnce() {
  try {
    if (sessionStorage.getItem('chunk-heal') === '1') return
    sessionStorage.setItem('chunk-heal', '1')
  } catch { /* حارس التكرار اختياري */ }
  void healStaleBundles()
}

/* علامات iPhone Duo على <html> (تُقرأ في src/duo.css وحده):
   · data-shell: «app» داخل التطبيق أو تطبيق الشاشة الرئيسية، وإلا «browser».
   · data-device: «duo» لشاشة شبه مربّعة (الخارجية 466×678، الداخلية 669×951).
     فلا تمسّ قواعد الدوو الهاتف العادي ولا iPad.
   · data-widget-side: جهة عمود الساعة كما يبلغها iOS (safe-area)؛ صفرٌ في Safari. */
if (typeof document !== 'undefined') {
  const html = document.documentElement
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
  html.dataset.shell = cap?.isNativePlatform?.() || standalone ? 'app' : 'browser'
  /* الجهاز الحقيقي: نسبة الخارجية ≈1.484، فالقرار من ثلاث قرائن على آيفون/غلاف iOS، وكل iPad ضلعه القصير ≥744 فيبقى «other». */
  const appleHandheld = /iPhone|iPod/.test(navigator.userAgent) || (window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'ios'
  const nearSquare = (a: number, b: number) => { const lo = Math.min(a, b), hi = Math.max(a, b); return lo >= 400 && lo <= 720 && hi / lo <= 1.62 }
  const markDevice = () => {
    const vShort = Math.min(window.innerWidth, window.innerHeight)
    const duo = appleHandheld && Math.min(screen.width, screen.height) <= 720 && (
      nearSquare(screen.width, screen.height) || nearSquare(screen.availWidth, screen.availHeight) || (vShort > 500 && vShort <= 720))
    html.dataset.device = duo ? 'duo' : 'other'
  }
  markDevice()
  window.addEventListener('resize', markDevice)
  window.addEventListener('orientationchange', () => window.setTimeout(markDevice, 300))
  const probe = document.createElement('div')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'
  html.appendChild(probe)
  const markSide = () => {
    const cs = getComputedStyle(probe), l = parseFloat(cs.paddingLeft) || 0, r = parseFloat(cs.paddingRight) || 0
    let side = l > 20 && l > r ? 'left' : r > 20 ? 'right' : 'none'
    /* الداخلية عرضاً داخل التطبيق: قد يبلغ iOS حدوداً صفرية والساعة قائمةٌ في الركن الأعلى الأيمن، فكان الشعار يقع تحتها.
       نحجز الركن دائماً (المرجع ProfAlfailakawi/schedule-kw#654). */
    if (side === 'none' && html.dataset.shell === 'app' && html.dataset.device === 'duo' &&
      window.matchMedia?.('screen and (orientation: landscape) and (min-width: 860px) and (max-width: 1000px) and (min-height: 500px) and (max-height: 760px)').matches) side = 'right'
    html.dataset.widgetSide = side
  }
  markSide()
  /* حدث resize قد يسبق تحديث الحدود، فيُراقَب المسبار نفسه أيضاً. */
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(markSide).observe(probe, { box: 'border-box' })
  for (const ms of [120, 600, 1500, 3000]) window.setTimeout(markSide, ms)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) markSide() })
  window.addEventListener('resize', () => { requestAnimationFrame(markSide); window.setTimeout(markSide, 400) })
  window.addEventListener('orientationchange', () => window.setTimeout(markSide, 400))
}

/* تشخيص ركن الودجت (iPhone Duo): يُحمَّل فقط عند ‎?duo-debug=1‎. */
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('duo-debug')) {
  void import('./lib/duo-debug').then((m) => { const go = () => m.installDuoDebug(); if (document.body) go(); else addEventListener('DOMContentLoaded', go) })
}

/* وضع العرض التوضيحي: ردود /api/* تجريبية بلا خادم (يُفعَّل بـ VITE_DEMO_MODE=1 فقط). */
if (DEMO_MODE) installDemoApi()

/* أثناء نشر الخادم تجيب المنصّة /api بصفحة HTML (5xx): شريطٌ هادئ «نُحدّث الموقع»
   حتى يعود. مراقبةٌ فقط — لا يتغيّر جوابٌ ولا سلوك شاشة. */
installUpdatingNotice()

/* التقاط أعطال تحميل الملفات مبكراً: يبدأ قبل العرض ليشمل حزم البداية. */
watchResourceFailures()

/* تسامحُ إزالة العقد مع ما يعدّله المتصفح أو إضافاته خارج React. */
installDomResilience()

/* ظهورٌ هادئ للبطاقات (مرةً واحدة، يتعطّل بتقليل الحركة). */
installPolishReveal()

/* التحديث الذاتي الصامت: بصمة الإصدار ومنارتها ثم التحديث والتصعيد عند اللزوم.
   شفاء الحزم اليتيمة له مساره أعلاه، فلا يُركَّب مرتين. */
installAppUpdate({ chunkRecovery: false })

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  healOnce()
})

/* الوعد المرفوض بلا التقاط: سفاري يبلّغ فشل الاستيراد الكسول هكذا أحياناً بدل
   vite:preloadError، فيبقى الزائر أمام صفحة عطبٍ لا تُشفى. نُعالجه بالمسار نفسه. */
window.addEventListener('unhandledrejection', (event) => {
  const message = String((event.reason as { message?: string } | undefined)?.message || event.reason || '')
  if (isStaleBundleError(message) || hasMissingAppChunk()) healOnce()
})

declare global {
  interface Window {
    __appBootFallbackTimer?: number
  }
}

function AppBoot() {
  useLayoutEffect(() => {
    const html = document.documentElement
    html.setAttribute('data-app-ready', 'true')
    if (window.__appBootFallbackTimer) {
      window.clearTimeout(window.__appBootFallbackTimer)
      window.__appBootFallbackTimer = undefined
    }
  }, [])


  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <AppBoot />
  </React.StrictMode>,
)

/* تحليلات اختيارية — بلا كوكيز ولا لافتة موافقة */
const dom = import.meta.env.VITE_PLAUSIBLE_DOMAIN
if (dom) {
  window.plausible = window.plausible || ((...args: unknown[]) => {
    ;(window.plausible!.q ||= []).push(args)
  })
  const s = document.createElement('script')
  s.defer = true
  s.dataset.domain = dom
  s.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(s)
}
startWebVitalsMonitoring()
