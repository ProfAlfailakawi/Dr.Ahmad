import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
} from 'react'
import { IconTooltipPortal } from './IconTooltipPortal'

const STORAGE_PREFIX = 'clarified-icon:'

type ClarifiedChildProps = {
  onClick?: MouseEventHandler<HTMLElement>
  title?: string
  'aria-describedby'?: string
}

function isTouchLike() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(hover: none), (pointer: coarse)').matches ?? false
}

export function ClarifiedIconAction({ id, label, children }: { id: string; label: string; children: ReactElement }) {
  const reactId = useId()
  const tipId = `icon-tip-${reactId.replace(/:/g, '')}`
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const timer = window.setTimeout(close, 4500)
    window.addEventListener('pointerdown', close, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', close)
    }
  }, [open])

  const child = children as ReactElement<ClarifiedChildProps>
  const originalOnClick = child.props.onClick
  const onClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (isTouchLike() && !window.localStorage.getItem(`${STORAGE_PREFIX}${id}`)) {
      event.preventDefault()
      event.stopPropagation()
      window.localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1')
      setOpen(true)
      return
    }
    originalOnClick?.(event)
  }, [id, originalOnClick])

  return (
    <span ref={wrapperRef} className="relative inline-flex" data-clarified-icon="true">
      {cloneElement<ClarifiedChildProps>(child, {
        onClick,
        title: child.props.title || label,
        'aria-describedby': open ? tipId : undefined,
      })}
      {open && (
        <IconTooltipPortal
          targetEl={wrapperRef.current}
          label={label}
          tipId={tipId}
        />
      )}
    </span>
  )
}
