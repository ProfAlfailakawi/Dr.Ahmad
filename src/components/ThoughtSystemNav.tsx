import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'

const ITEMS = [
  { to: '/thought', label: 'نظرة عامة' },
  { to: '/thought-paths', label: 'مسارات الفكرة' },
  { to: '/decade', label: 'وثيقة العقد' },
  { to: '/impact', label: 'سجل الأثر' },
] as const

export function ThoughtSystemNav() {
  const { pathname } = useLocation()
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const node = activeRef.current
    if (!node) return
    node.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })
  }, [pathname])

  return (
    <nav className="thought-system-nav border-b border-hair bg-canvas/95 px-6 md:px-11" aria-label="التنقل داخل المنظومة الفكرية">
      <div className="edge-fade mx-auto flex max-w-shell gap-7 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((item) => {
          const active = pathname === item.to || (item.to === '/impact' && pathname.startsWith('/impact/'))
          return (
            <Link
              key={item.to}
              ref={active ? activeRef : undefined}
              to={item.to}
              viewTransition
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-12 shrink-0 items-center py-3 text-[.8rem] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${active ? 'text-ink' : 'text-soft hover:text-accent'}`}
            >
              {item.label}
              {active && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
