import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'

const MEMORY_KEY = 'dr-ahmad:knowledge-place:v1'
const TRANSITION_KEY = 'dr-ahmad:knowledge-transition:v1'

type PlaceMemory = { path: string; title: string; y: number; at: number }

const pageIdentity = (path: string) => {
  if (path.startsWith('/articles/')) return { kind: 'مقال', ending: 'انتهى المقال، لكن السؤال لم ينتهِ.', next: '/articles', nextLabel: 'استكشف مقالاً آخر' }
  if (path.startsWith('/research/')) return { kind: 'بحث', ending: 'من الدليل إلى تطبيق محتمل.', next: '/research', nextLabel: 'استكشف الأبحاث' }
  if (path.startsWith('/publications/')) return { kind: 'كتاب', ending: 'هذا الكتاب جزء من مسار أوسع.', next: '/publications', nextLabel: 'عد إلى مكتبة الكتب' }
  if (path === '/publications') return { kind: 'مكتبة', ending: 'كل كتاب هنا محطة في مسار معرفي واحد.', next: '/thought-paths', nextLabel: 'شاهد مسارات الأفكار' }
  if (path === '/search') return { kind: 'بحث معرفي', ending: 'كل نتيجة بداية لمسار، لا نهايته.', next: '/thought-paths', nextLabel: 'انتقل إلى خريطة الأفكار' }
  if (path.includes('encyclopedia')) return { kind: 'موسوعة', ending: 'أكملت هذه المحطة — ماذا تغيّر في فهمك؟', next: '/publications', nextLabel: 'عد إلى الموسوعة' }
  return null
}

function readMemory(): PlaceMemory | null {
  try { return JSON.parse(localStorage.getItem(MEMORY_KEY) || 'null') as PlaceMemory | null } catch { return null }
}

function timeClass() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'knowledge-time-morning'
  if (hour >= 18 || hour < 2) return 'knowledge-time-evening'
  return 'knowledge-time-day'
}

export function KnowledgeExperience() {
  const location = useLocation()
  const [progress, setProgress] = useState(0)
  const [memory, setMemory] = useState<PlaceMemory | null>(null)
  const [showMemory, setShowMemory] = useState(false)
  const [bridge, setBridge] = useState('')
  const identity = useMemo(() => pageIdentity(location.pathname), [location.pathname])
  const isPrivate = location.pathname.startsWith('/admin') || location.pathname === '/launch' || location.pathname.startsWith('/cv-file/')

  useEffect(() => {
    document.documentElement.classList.add(timeClass())
    return () => document.documentElement.classList.remove('knowledge-time-morning', 'knowledge-time-day', 'knowledge-time-evening')
  }, [])

  useEffect(() => {
    if (isPrivate) return
    const previous = readMemory()
    if (previous && previous.path === location.pathname && previous.y > 500 && Date.now() - previous.at < 1000 * 60 * 60 * 24 * 45) {
      setMemory(previous)
      setShowMemory(true)
    } else {
      setMemory(null)
      setShowMemory(false)
    }

    const update = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    const save = () => {
      if (window.scrollY < 180) return
      try {
        localStorage.setItem(MEMORY_KEY, JSON.stringify({ path: location.pathname, title: document.title, y: window.scrollY, at: Date.now() }))
      } catch { /* optional enhancement */ }
    }
    window.addEventListener('pagehide', save)
    return () => {
      save()
      window.removeEventListener('scroll', update)
      window.removeEventListener('pagehide', save)
    }
  }, [isPrivate, location.pathname])

  useEffect(() => {
    if (isPrivate) return
    const root = document.getElementById('main')
    if (!root) return
    const classify = () => {
      root.querySelectorAll('blockquote').forEach((node, index) => {
        if (index < 2) node.classList.add('knowledge-breathing-quote')
      })
      root.querySelectorAll('time,[data-year]').forEach((node) => node.classList.add('knowledge-time-stamp'))
      root.querySelectorAll('[data-search-reason],[data-match-reason]').forEach((node) => node.classList.add('knowledge-explainable-result'))
      const firstHeading = root.querySelector('h1')
      if (firstHeading) firstHeading.classList.add('knowledge-page-title')
      root.querySelectorAll('h1,h2,h3').forEach((heading) => {
        const text = heading.textContent?.trim() || ''
        const match = text.match(/الباب\s+(?:ال)?([0-9]+|الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)/u)
        if (match) {
          heading.classList.add('knowledge-door-heading')
          heading.setAttribute('data-door-signature', match[1])
        }
      })
      root.querySelectorAll('[data-stat],.stat-card,.metric-card').forEach((node) => node.classList.add('knowledge-museum-stat'))
    }
    classify()
    const observer = new MutationObserver(classify)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [isPrivate, location.pathname])

  useEffect(() => {
    if (isPrivate) return
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === location.pathname) return
      const label = anchor.textContent?.trim().replace(/\s+/g, ' ')
      if (!label || label.length > 70) return
      try { sessionStorage.setItem(TRANSITION_KEY, label) } catch { /* noop */ }
    }
    document.addEventListener('click', click, true)
    return () => document.removeEventListener('click', click, true)
  }, [isPrivate, location.pathname])

  useEffect(() => {
    try {
      const label = sessionStorage.getItem(TRANSITION_KEY)
      if (!label) return
      sessionStorage.removeItem(TRANSITION_KEY)
      setBridge(label)
      const timer = window.setTimeout(() => setBridge(''), 900)
      return () => window.clearTimeout(timer)
    } catch { return }
  }, [location.pathname])

  if (isPrivate) return null

  return <>
    <div className="knowledge-thread" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
    <div className="knowledge-side-rail" aria-hidden="true"><span style={{ height: `${Math.max(8, progress * 100)}%` }} /></div>
    {bridge && <div className="knowledge-transition" role="status"><small>انتقال معرفي</small><strong>{bridge}</strong></div>}
    {showMemory && memory && <aside className="knowledge-memory" aria-label="متابعة القراءة">
      <div><small>ذاكرة المكان</small><strong>عدت إلى حيث توقفت</strong></div>
      <div className="knowledge-memory-actions">
        <button type="button" onClick={() => { window.scrollTo({ top: memory.y, behavior: 'smooth' }); setShowMemory(false) }}>أكمل من حيث توقفت</button>
        <button type="button" className="quiet" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setShowMemory(false) }}>ابدأ من البداية</button>
      </div>
    </aside>}
    {identity && <section className="knowledge-page-ending" aria-label="الخطوة التالية">
      <span className="knowledge-ending-mark" aria-hidden="true" />
      <small>{identity.kind}</small>
      <h2>{identity.ending}</h2>
      <Link to={identity.next}>{identity.nextLabel}</Link>
      <div className="knowledge-mini-constellation" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </section>}
  </>
}
