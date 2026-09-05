import type { CSSProperties } from 'react'
import { KUFIC_COLS, KUFIC_FRAMED_BOX, KUFIC_RECTS, KUFIC_ROWS } from '../lib/kufic-mark'

/**
 * العلامة الكوفية مرسومةً لا مصوَّرة.
 *
 * `drawMs` يجعلها تُكشف بمسحةٍ من اليمين (اتّجاه الكتابة) خلال المدّة المعطاة،
 * وإلا ظهرت كاملةً. المسحة لا الكشف الخلوي: الأخير كان يُظهر في كلّ لحظةٍ
 * مستطيلاتٍ مبعثرةً تُقرأ كشكلٍ غريب لا كعلامة. تأخذ لون النصّ المحيط
 * بـ`currentColor`، فتعمل في الوضعين بلا `invert()` وبلا أصلٍ ثانٍ.
 *
 * `framed` يوسّع الإطار ليشمل هامش الـPNG الشفاف، فيكون بديلاً مطابقاً له
 * في المواضع القائمة بلا تغيّرٍ في الحجم المرئي.
 */
export default function KuficMark({
  className = '',
  drawMs = 0,
  framed = false,
  title = 'الموقع',
}: { className?: string; drawMs?: number; framed?: boolean; title?: string }) {
  const drawing = drawMs > 0
  // مدّة المسحة تُمرَّر إلى CSS كمتغيّر كي لا يفترق الرقمان.
  return (
    <svg
      className={`kufic-mark ${drawing ? 'is-drawing' : ''} ${className}`.trim()}
      viewBox={framed ? KUFIC_FRAMED_BOX : `0 0 ${KUFIC_COLS} ${KUFIC_ROWS}`}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
      style={drawing ? ({ ['--kufic-draw']: `${drawMs}ms` } as CSSProperties) : undefined}
    >
      <title>{title}</title>
      <g fill="currentColor">
        {KUFIC_RECTS.map(([x, y, w]) => (
          <rect key={`${x}-${y}-${w}`} x={x} y={y} width={w} height={1} />
        ))}
      </g>
    </svg>
  )
}
