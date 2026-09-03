import { useEffect, useMemo, useState } from 'react'

type PageToken = number | 'gap-start' | 'gap-end'

function pageTokens(current: number, total: number): PageToken[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap-end', total]
  if (current >= total - 3) return [1, 'gap-start', total - 4, total - 3, total - 2, total - 1, total]
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', total]
}

function mobilePageNumbers(current: number, total: number) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 2) return [1, 2, 3]
  if (current >= total - 1) return [total - 2, total - 1, total]
  return [current - 1, current, current + 1]
}

export function usePagedList<T>(items: T[], pageSize: number, resetKey = '') {
  const [page, setPage] = useState(1)
  const safePageSize = Math.max(1, Math.floor(pageSize || 1))
  const pageCount = Math.max(1, Math.ceil(items.length / safePageSize))

  useEffect(() => setPage(1), [resetKey])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const start = (page - 1) * safePageSize
  return {
    page,
    setPage,
    pageCount,
    pageItems: items.slice(start, start + safePageSize),
    firstItem: items.length ? start + 1 : 0,
    lastItem: Math.min(items.length, start + safePageSize),
  }
}

export function Pagination({
  page,
  pageCount,
  onChange,
  totalItems,
  firstItem,
  lastItem,
  scrollTargetId,
  className = '',
  label = 'صفحات المحتوى',
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  totalItems?: number
  firstItem?: number
  lastItem?: number
  scrollTargetId?: string
  className?: string
  label?: string
}) {
  const tokens = useMemo(() => pageTokens(page, pageCount), [page, pageCount])
  const mobileNumbers = useMemo(() => mobilePageNumbers(page, pageCount), [page, pageCount])
  if (pageCount <= 1) return null

  const change = (next: number) => {
    if (next === page || next < 1 || next > pageCount) return
    onChange(next)
    if (scrollTargetId) {
      requestAnimationFrame(() => {
        document.getElementById(scrollTargetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const pageButton = (number: number, compact = false) => (
    <button
      key={`${compact ? 'm' : 'd'}-${number}`}
      type="button"
      onClick={() => change(number)}
      aria-current={number === page ? 'page' : undefined}
      aria-label={`الصفحة ${number}`}
      className={`tap-44 flex ${compact ? 'h-9 min-w-9' : 'h-10 min-w-10'} items-center justify-center rounded-full border px-2 text-[.82rem] font-semibold transition-colors ${
        number === page
          ? 'border-accent bg-accent text-white shadow-[0_8px_20px_-12px_rgba(28,69,103,.8)]'
          : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'
      }`}
    >
      {number}
    </button>
  )

  const arrow = (direction: 'prev' | 'next', compact = false) => {
    const previous = direction === 'prev'
    const disabled = previous ? page === 1 : page === pageCount
    return (
      <button
        type="button"
        onClick={() => change(page + (previous ? -1 : 1))}
        disabled={disabled}
        aria-label={previous ? 'الصفحة السابقة' : 'الصفحة التالية'}
        className={`tap-44 flex ${compact ? 'h-9 min-w-9' : 'h-10 min-w-10'} items-center justify-center rounded-full border border-hair px-2 text-[.86rem] text-accent transition-colors hover:border-accent disabled:cursor-default disabled:opacity-25`}
      >
        {previous ? '‹' : '›'}
      </button>
    )
  }

  return (
    <nav aria-label={label} className={`site-pagination border-t border-hair pt-7 ${className}`}>
      {typeof totalItems === 'number' && typeof firstItem === 'number' && typeof lastItem === 'number' && (
        <p className="mb-4 text-center text-[.72rem] font-light text-soft" aria-live="polite">
          عرض {firstItem}–{lastItem} من {totalItems}
        </p>
      )}

      <div className="flex items-center justify-center gap-1.5 sm:hidden" dir="ltr">
        {arrow('prev', true)}
        {mobileNumbers.map((number) => pageButton(number, true))}
        {arrow('next', true)}
      </div>

      <div className="hidden items-center justify-center gap-2 sm:flex" dir="ltr">
        {arrow('prev')}
        {tokens.map((token) =>
          typeof token === 'number' ? pageButton(token) : (
            <span key={token} aria-hidden="true" className="flex h-10 min-w-5 items-center justify-center text-soft/70">
              …
            </span>
          ),
        )}
        {arrow('next')}
      </div>
    </nav>
  )
}
