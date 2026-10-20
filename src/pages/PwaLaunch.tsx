import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { READ_LAST_KEY, progressFor } from '../lib/reading-space'

const RESUME_WINDOW = 7 * 24 * 60 * 60 * 1000

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
  const resume = useMemo(lastReading, [])
  const destination = resume ? `/articles/${resume.slug}` : '/'

  // boot.js owns the single opening screen; this route only restores the destination.
  useEffect(() => {
    navigate(destination, { replace: true })
  }, [destination, navigate])

  return null
}
