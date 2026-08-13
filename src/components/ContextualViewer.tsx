import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SocialIcon } from './icons'

type ContextualViewerProps = {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  description?: string
  visual: ReactNode
  children?: ReactNode
  footer?: ReactNode
  onPrevious?: () => void
  onNext?: () => void
  previousLabel?: string
  nextLabel?: string
  position?: string
  textualVisual?: boolean
}

/**
 * قارئ سياقي عام للواجهات العامة: يبقي الزائر داخل مجموعته، ويحافظ على
 * التركيز ولوحة المفاتيح، ولا يشغّل أي وسائط تلقائياً.
 */
export function ContextualViewer({
  open,
  onClose,
  eyebrow,
  title,
  description,
  visual,
  children,
  footer,
  onPrevious,
  onNext,
  previousLabel = 'السابق',
  nextLabel = 'التالي',
  position,
  textualVisual = false,
}: ContextualViewerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.classList.add('context-viewer-open')
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 20)

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowRight' && onPrevious) {
        event.preventDefault()
        onPrevious()
        return
      }
      if (event.key === 'ArrowLeft' && onNext) {
        event.preventDefault()
        onNext()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      document.documentElement.classList.remove('context-viewer-open')
      before?.focus()
    }
  }, [onClose, onNext, onPrevious, open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="context-viewer-layer"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onMouseDown={onClose}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="context-viewer-title"
            className={`context-viewer-panel${textualVisual ? ' context-viewer-panel--textual' : ''}`}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: reduce ? 0 : 0.28 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="context-viewer-visual">{visual}</div>
            <div className="context-viewer-copy">
              <div className="context-viewer-topline">
                <span className="text-[.72rem] font-semibold text-accent">{eyebrow}</span>
                <button ref={closeRef} type="button" onClick={onClose} className="context-viewer-icon" aria-label="إغلاق المعاينة">
                  <SocialIcon name="Close" size={18} />
                </button>
              </div>
              <div className="context-viewer-scroll">
                <h2 id="context-viewer-title" className="font-display text-[clamp(1.65rem,3vw,2.55rem)] font-semibold leading-[1.45] text-ink">{title}</h2>
                {description && <p className="mt-4 text-[.9rem] font-light leading-[1.9] text-soft">{description}</p>}
                {children && <div className="mt-6">{children}</div>}
              </div>
              <div className="context-viewer-actions">
                {(onPrevious || onNext) && (
                  <div className="context-viewer-nav" aria-label="التنقل داخل النتائج">
                    <button type="button" onClick={onPrevious} disabled={!onPrevious} aria-label={previousLabel} className="context-viewer-nav-button">→ <span>{previousLabel}</span></button>
                    {position && <span className="text-[.68rem] text-soft" aria-live="polite">{position}</span>}
                    <button type="button" onClick={onNext} disabled={!onNext} aria-label={nextLabel} className="context-viewer-nav-button"><span>{nextLabel}</span> ←</button>
                  </div>
                )}
                {footer}
              </div>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
