import React, { useEffect, useLayoutEffect } from 'react'
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

  useEffect(() => {
    let stopped = false
    let glossaryPromise: Promise<typeof import('./lib/dr-ahmad-domain-glossary')> | null = null
    const loadGlossary = () => {
      glossaryPromise ||= import('./lib/dr-ahmad-domain-glossary')
      return glossaryPromise
    }

    const syncConstellationVocabulary = async () => {
      const selects = [...document.querySelectorAll<HTMLSelectElement>('select')]
        .filter((select) => [...select.options].some((option) => option.textContent?.trim() === 'كل الكوكبات'))
      if (!selects.length || stopped) return

      const { DR_AHMAD_DOMAIN_GLOSSARY, normalizeDomainTerm } = await loadGlossary()
      if (stopped) return

      const canonicalByAlias = new Map<string, string>()
      for (const entry of DR_AHMAD_DOMAIN_GLOSSARY) {
        for (const label of [entry.canonicalAr, ...entry.aliases]) {
          const normalized = normalizeDomainTerm(label)
          if (normalized && !canonicalByAlias.has(normalized)) canonicalByAlias.set(normalized, entry.canonicalAr)
        }
      }

      for (const select of selects) {
        const currentValue = select.value
        let currentStillExists = false
        for (const option of [...select.options]) {
          const label = option.textContent?.trim() || ''
          if (label === 'كل الكوكبات') {
            if (option.value === currentValue) currentStillExists = true
            continue
          }
          const canonical = canonicalByAlias.get(normalizeDomainTerm(label))
          if (!canonical) {
            option.remove()
            continue
          }
          option.textContent = canonical
          if (option.value === currentValue) currentStillExists = true
        }

        if (!currentStillExists && select.options.length) {
          select.value = select.options[0].value
          select.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    }

    let queued = false
    const queueSync = () => {
      if (queued || stopped) return
      queued = true
      window.requestAnimationFrame(() => {
        queued = false
        void syncConstellationVocabulary()
      })
    }

    const observer = new MutationObserver(queueSync)
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true })
    queueSync()
    return () => {
      stopped = true
      observer.disconnect()
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
