import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const safeDestination = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/articles'
  if (['/', '/launch', '/admin'].includes(value) || value.startsWith('/cv-file/')) return '/articles'
  return value
}

export default function PwaLaunch() {
  const navigate = useNavigate()
  const destination = useMemo(() => {
    try { return safeDestination(localStorage.getItem('pwa:last-route')) }
    catch { return '/articles' }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => navigate(destination, { replace: true }), 920)
    return () => window.clearTimeout(timer)
  }, [destination, navigate])

  return (
    <section className="pwa-launch" aria-label="فتح المكتبة">
      <div className="pwa-launch__halo" aria-hidden="true" />
      <div className="pwa-launch__content">
        <img src="/logo.png" alt="د. أحمد حسين الفيلكاوي" className="pwa-launch__logo dark:invert" />
        <p className="pwa-launch__eyebrow">المكتبة الفكرية</p>
        <h1>أهلًا بعودتك.</h1>
        <p>أفتح لك آخر مكان توقفت عنده.</p>
        <div className="pwa-launch__line" aria-hidden="true"><span /></div>
      </div>
    </section>
  )
}
