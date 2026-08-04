import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent,
  type MouseEventHandler,
  type ReactElement,
} from 'react'

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
    <span className="relative inline-flex">
      {cloneElement<ClarifiedChildProps>(child, {
        onClick,
        title: child.props.title || label,
        'aria-describedby': open ? tipId : undefined,
      })}
      {open && (
        <span id={tipId} role="status" className="absolute bottom-[calc(100%+.55rem)] end-0 z-50 w-max max-w-[15rem] rounded-xl border border-hair bg-ink px-3 py-2 text-center text-[.68rem] font-semibold leading-relaxed text-white shadow-xl">
          {label}
          <span aria-hidden className="absolute -bottom-1.5 end-4 h-3 w-3 rotate-45 border-b border-r border-hair bg-ink" />
        </span>
      )}
    </span>
  )
}
