import { useMemo, type MouseEvent } from 'react'
import rawDensity from '../data/book-page-density.json' with { type: 'json' }

type DensityFile = { books?: Record<string, [number, number][]> }
const DENSITY = (rawDensity as unknown as DensityFile).books || {}

export function BookTerrain({ slug, title, activePages = [], onSelectPage, compact = false }: {
  slug: string
  title: string
  activePages?: number[]
  onSelectPage?: (page: number) => void
  compact?: boolean
}) {
  const pages = DENSITY[slug] || []
  const active = useMemo(() => new Set(activePages.map(Number)), [activePages])
  const geometry = useMemo(() => {
    const pageIndex = new Map(pages.map(([page], index) => [page, index]))
    const line = (rows: [number, number][]) => rows.map(([page, density]) => {
      const x = pages.length - (pageIndex.get(page) || 0) - .5
      const height = 2 + density * .16
      return `M${x} ${20 - height}V20`
    }).join('')
    return { all: line(pages), lit: line(pages.filter(([page]) => active.has(page))) }
  }, [active, pages])
  if (pages.length < 2) return null
  const select = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) {
      onSelectPage?.(activePages[0] || pages[0][0])
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(.9999, Math.max(0, (rect.right - event.clientX) / Math.max(1, rect.width)))
    onSelectPage?.(pages[Math.floor(fraction * pages.length)]?.[0] || pages[0][0])
  }
  return (
    <button type="button" onClick={onSelectPage ? select : undefined} tabIndex={onSelectPage ? 0 : -1} aria-label={onSelectPage ? `تضاريس صفحات ${title}؛ اختر صفحة` : undefined} aria-hidden={onSelectPage ? undefined : true} className={`book-terrain block w-full ${compact ? 'h-5' : 'h-8'} ${onSelectPage ? 'cursor-crosshair' : 'pointer-events-none'}`}>
      <svg viewBox={`0 0 ${pages.length} 20`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <path d={geometry.all} className="book-terrain__base" />
        {geometry.lit && <path d={geometry.lit} className="book-terrain__active" />}
      </svg>
    </button>
  )
}
