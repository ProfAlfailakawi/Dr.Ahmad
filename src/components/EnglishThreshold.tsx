import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE } from './motion'
import KuficMark from './KuficMark'

/**
 * The English threshold — shown once, on a first visit to /en.
 *
 * The closing act of the Arabic overture alone: the same night stage, the same
 * mark, three doors. Replay any time with `/en?intro=1`.
 */
const STORAGE_KEY = 'visitor:en-threshold:v1'

const DOORS = [
  { path: '/en/research', title: 'Research', line: 'Peer-reviewed work on educational technology, e-learning and AI in education.' },
  { path: '/en/cv', title: 'Academic record', line: 'Positions, degrees, memberships, and conference contributions.' },
  { path: '/en/contact', title: 'Get in touch', line: 'Speaking, consulting, supervision, and collaboration enquiries.' },
]

export default function EnglishThreshold() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let forced = false
    try {
      forced = new URLSearchParams(window.location.search).get('intro') === '1'
      if (!forced && localStorage.getItem(STORAGE_KEY)) return
    } catch { /* private browsing: show it, store nothing */ }
    const timer = window.setTimeout(() => setOpen(true), forced ? 60 : 240)
    return () => window.clearTimeout(timer)
  }, [])

  const close = useCallback((path?: string) => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())) } catch { /* never blocks closing */ }
    setOpen(false)
    if (path) window.setTimeout(() => navigate(path), 260)
  }, [navigate])

  /* Scroll lock, Escape, and a focus trap — the same contract as the Arabic stage. */
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    skipRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); return }
      if (event.key !== 'Tab') return
      const stops = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
      if (!stops?.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={rootRef}
          className="ent-root"
          dir="ltr"
          role="dialog"
          aria-modal="true"
          aria-label="Introduction"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.26, ease: EASE } }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="ent-sky" aria-hidden="true" />
          <header className="ent-top">
            <button ref={skipRef} type="button" className="ent-skip" onClick={() => close()}>Skip</button>
          </header>

          <motion.div
            className="ent-stage"
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: reduced ? 0 : 0.12 }}
          >
            <KuficMark className="ent-mark" drawMs={reduced ? 0 : 900} title="Site mark" />
            <p className="ent-kicker">The archive, in English</p>
            <h2>Every door is open.</h2>
            <p className="ent-line">
              A decade of writing on education, technology and society — most of it in Arabic.
              These three doors are the English way in.
            </p>

            <div className="ent-doors">
              {DOORS.map((door) => (
                <button key={door.path} type="button" className="ent-door" onClick={() => close(door.path)}>
                  <span className="ent-door-title">{door.title}</span>
                  <span className="ent-door-line">{door.line}</span>
                </button>
              ))}
            </div>

            <button type="button" className="ent-browse" onClick={() => close()}>
              Or just browse
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
