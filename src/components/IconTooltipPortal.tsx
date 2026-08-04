import { createPortal } from 'react-dom'
import { useLayoutEffect, useRef, useState } from 'react'

export function IconTooltipPortal({
  targetEl,
  label,
  tipId,
}: {
  targetEl: HTMLElement | null
  label: string
  tipId?: string
}) {
  const tipRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    left: number
    top: number
    placement: 'top' | 'bottom'
    arrowLeft: number
    ready: boolean
  }>({ left: 0, top: 0, placement: 'top', arrowLeft: 0, ready: false })

  useLayoutEffect(() => {
    if (!targetEl) return

    const updatePosition = () => {
      const node = tipRef.current
      if (!node || !targetEl) return

      const targetRect = targetEl.getBoundingClientRect()
      const tipRect = node.getBoundingClientRect()

      const vw = Math.min(window.innerWidth, document.documentElement.clientWidth)
      const vh = Math.min(window.innerHeight, document.documentElement.clientHeight)
      const gutter = 12

      const targetCenterX = targetRect.left + targetRect.width / 2
      const tipWidth = tipRect.width || 200
      const tipHeight = tipRect.height || 40

      const placement: 'top' | 'bottom' = targetRect.top < tipHeight + 20 ? 'bottom' : 'top'

      const unclampedLeft = targetCenterX - tipWidth / 2
      const unclampedRight = targetCenterX + tipWidth / 2

      let shift = 0
      if (unclampedLeft < gutter) {
        shift = gutter - unclampedLeft
      } else if (unclampedRight > vw - gutter) {
        shift = (vw - gutter) - unclampedRight
      }

      const boxLeft = unclampedLeft + shift
      const arrowLeft = Math.max(14, Math.min(tipWidth - 14, targetCenterX - boxLeft))

      let top = 0
      if (placement === 'top') {
        top = targetRect.top - 8
      } else {
        top = targetRect.bottom + 8
      }

      setCoords({
        left: boxLeft,
        top,
        placement,
        arrowLeft,
        ready: true,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, { passive: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [targetEl, label])

  if (!targetEl) return null

  return createPortal(
    <div
      ref={tipRef}
      id={tipId}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[600] w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-hair bg-ink px-3.5 py-2.5 text-center text-[.72rem] font-semibold leading-relaxed text-white shadow-2xl transition-opacity duration-150"
      style={{
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        transform: coords.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)',
        opacity: coords.ready ? 1 : 0,
      }}
    >
      {label}
      <span
        aria-hidden
        className={`absolute h-3 w-3 bg-ink ${
          coords.placement === 'top'
            ? '-bottom-1.5 border-b border-r border-hair'
            : '-top-1.5 border-t border-l border-hair'
        }`}
        style={{ left: `${coords.arrowLeft}px`, transform: 'translateX(-50%) rotate(45deg)' }}
      />
    </div>,
    document.body
  )
}
