import React, { useLayoutEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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

  return <App />
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
  const s = document.createElement('script')
  s.defer = true
  s.dataset.domain = dom
  s.src = 'https://plausible.io/js/script.js'
  document.head.appendChild(s)
}
