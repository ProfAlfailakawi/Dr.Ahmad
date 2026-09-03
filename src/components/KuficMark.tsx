import type { CSSProperties } from 'react'
import { KUFIC_COLS, KUFIC_RECTS, KUFIC_ROWS, KUFIC_STEPS } from '../lib/kufic-mark'

/**
 * العلامة الكوفية مرسومةً لا مصوَّرة.
 *
 * `drawMs` يجعلها تُخطّ خليةً خليةً من اليمين (اتّجاه القراءة) خلال المدّة
 * المعطاة، وإلا ظهرت كاملةً. تأخذ لون النصّ المحيط بـ`currentColor`، فتعمل
 * في الوضعين بلا `invert()` وبلا أصلٍ ثانٍ.
 */
export default function KuficMark({
  className = '',
  drawMs = 0,
  cellMs = 240,
  title = 'الموقع',
}: { className?: string; drawMs?: number; cellMs?: number; title?: string }) {
  const drawing = drawMs > 0
  // مدّة الخليّة تُمرَّر إلى CSS كمتغيّر كي لا يفترق الرقمان.
  return (
    <svg
      className={`kufic-mark ${drawing ? 'is-drawing' : ''} ${className}`.trim()}
      viewBox={`0 0 ${KUFIC_COLS} ${KUFIC_ROWS}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      style={drawing ? ({ ['--kufic-cell']: `${cellMs}ms` } as CSSProperties) : undefined}
    >
      <title>{title}</title>
      <g fill="currentColor">
        {KUFIC_RECTS.map(([x, y, w, order]) => (
          <rect
            key={`${x}-${y}-${w}`}
            x={x} y={y} width={w} height={1}
            style={drawing ? { animationDelay: `${(order / KUFIC_STEPS) * drawMs}ms` } : undefined}
          />
        ))}
      </g>
    </svg>
  )
}
