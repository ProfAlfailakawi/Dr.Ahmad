import React, { useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/alexandria'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { startWebVitalsMonitoring } from './lib/web-vitals'
import './index.css'

/* شفاء الحزم اليتيمة: هاتفٌ فتح رابطاً بهيكلٍ قديم أثناء نشرةٍ جديدة يطلب
   حزمةً تغيّر اسمها فتغيب المتون (صفحة «قيد الإضافة» الزائفة). فشلُ التحميل
   الكسول = إعادة تحميلٍ ذاتية مرة واحدة فيأتي الهيكل الجديد بحزمه الصحيحة. */
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  try {
    if (sessionStorage.getItem('chunk-heal') === '1') return
    sessionStorage.setItem('chunk-heal', '1')
  } catch { /* حارس التكرار اختياري */ }
  window.location.reload()
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
  startWebVitalsMonitoring()
}
