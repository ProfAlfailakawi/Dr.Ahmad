import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
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
