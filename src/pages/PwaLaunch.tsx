import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import KuficMark from '../components/KuficMark'
import { READ_LAST_KEY, progressFor } from '../lib/reading-space'

const RESUME_WINDOW = 7 * 24 * 60 * 60 * 1000

/* المسحة تكشف العلامة من اليمين خلال DRAW_MS، ثم تمكث كاملةً HOLD_MS قبل
   الانتقال. المجموع كما كان (1890ms) حين كان الكشف خلوياً، لكن الحساب صار
   صادقاً: لا خلايا تتأخّر بعد نهاية الرسم. */
const DRAW_MS = 1000
const HOLD_MS = 890
const SPLASH_MS = DRAW_MS + HOLD_MS

type Resume = { slug: string; title: string; percent: number }

/** آخر مقالٍ قرأه الزائر — إن كان حديثاً وتُرك في وسطه لا في أوّله ولا عند نهايته. */
function lastReading(): Resume | null {
  try {
    const raw = JSON.parse(localStorage.getItem(READ_LAST_KEY) || 'null') as
      { slug?: string; title?: string; at?: number } | null
    if (!raw?.slug || !raw.title || !raw.at) return null
    if (Date.now() - raw.at > RESUME_WINDOW) return null
    const progress = progressFor(raw.slug)
    /* دون 8% لم يبدأ القراءة حقاً، وفوق 92% أنهاها — وفي الحالتين لا شيء يُستأنف. */
    if (progress < 0.08 || progress > 0.92) return null
    return { slug: raw.slug, title: raw.title, percent: Math.round(progress * 100) }
  } catch { return null }
}

export default function PwaLaunch() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [visible, setVisible] = useState<boolean | null>(null)
  const resume = useMemo(lastReading, [])
  const destination = resume ? `/articles/${resume.slug}` : '/'

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
    const timer = window.setTimeout(() => navigate(destination, { replace: true }), shouldShow ? SPLASH_MS : 0)
    return () => window.clearTimeout(timer)
  }, [destination, navigate, params])

  if (visible !== true) return null

  return (
    <section className="pwa-launch" aria-label="فتح المكتبة">
      {/* الشعار يُخطّ خليةً خليةً من اليمين خلال مدّة الانتظار نفسها: الكوفي
          المربّع خطٌّ على شبكة، فرسمُه هو الانتظار — لا هالةٌ ضبابية فوقه. */}
      <div className="pwa-launch__content">
        <KuficMark className="pwa-launch__mark" drawMs={DRAW_MS} />
        <p className="pwa-launch__eyebrow">مكتبة د. أحمد الفيلكاوي</p>
        <h1>أهلاً بعودتك.</h1>
        {resume
          ? <p>تركتَ «{resume.title}» عند {resume.percent}% — أعيدك إليه.</p>
          : <p>أفتح لك الصفحة الرئيسية.</p>}
      </div>
    </section>
  )
}
