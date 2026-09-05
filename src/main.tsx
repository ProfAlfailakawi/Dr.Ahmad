import React, { useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/alexandria'
import App from './App'
import ErrorBoundary, { healStaleBundles, isStaleBundleError } from './components/ErrorBoundary'
import { hasMissingAppChunk, watchResourceFailures } from './lib/load-failures'
import { startWebVitalsMonitoring } from './lib/web-vitals'
import './index.css'

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

/* التقاط أعطال تحميل الملفات مبكراً: يبدأ قبل العرض ليشمل حزم البداية. */
watchResourceFailures()

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
