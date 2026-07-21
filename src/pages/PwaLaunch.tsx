import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const safeDestination = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/articles'
  if (['/', '/launch', '/admin'].includes(value) || value.startsWith('/cv-file/')) return '/articles'
  return value
}

export default function PwaLaunch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [visible, setVisible] = useState<boolean | null>(null)
  const destination = useMemo(() => {
    try { return safeDestination(localStorage.getItem('pwa:last-route')) }
    catch { return '/articles' }
  }, [])

  useEffect(() => {
    /* شاشة العودة ليست محطةً إجبارية. تظهر فقط عند فتح الـPWA بعد غيابٍ
       حقيقي، لا عند الضغط على الشعار أو العودة المتكررة خلال الجلسة. */
    const source = params.get('source') || ''
    const now = Date.now()
    const returnSplashInterval = 24 * 60 * 60 * 1000
    let shouldShow = source.startsWith('pwa')
    try {
      const last = Number(localStorage.getItem('pwa:last-splash-at') || 0)
      const shownThisSession = sessionStorage.getItem('pwa:splash-shown') === '1'
      shouldShow = shouldShow && !shownThisSession && (!last || now - last >= returnSplashInterval)
      if (shouldShow) {
        localStorage.setItem('pwa:last-splash-at', String(now))
        sessionStorage.setItem('pwa:splash-shown', '1')
      }
    } catch { /* وضع التصفح الخاص: نعتمد المصدر فقط */ }

    setVisible(shouldShow)
    const timer = window.setTimeout(() => navigate(destination, { replace: true }), shouldShow ? 920 : 0)
    return () => window.clearTimeout(timer)
  }, [destination, navigate, params])

  if (visible !== true) return null

  return (
    <section className="pwa-launch" aria-label="فتح المكتبة">
      <div className="pwa-launch__halo" aria-hidden="true" />
      <div className="pwa-launch__content">
        <img src="/logo.png" alt="د. أحمد حسين الفيلكاوي" className="pwa-launch__logo dark:invert" />
        <p className="pwa-launch__eyebrow">مكتبة د. أحمد الفيلكاوي</p>
        <h1>أهلًا بعودتك.</h1>
        <p>أفتح لك آخر مكان توقفت عنده.</p>
        <div className="pwa-launch__line" aria-hidden="true"><span /></div>
      </div>
    </section>
  )
}
