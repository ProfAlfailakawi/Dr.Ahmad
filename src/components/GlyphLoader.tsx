import type { CSSProperties } from 'react'

/**
 * «شتاتٌ يجتمع» — المحمّل الدقيق للموقع.
 *
 * ليس دوّارةً غريبة عن المكان: رموز الأرشيف نفسها (كتاب، بحث، مقالة، صوت،
 * فكرة) تنجذب مرةً واحدة نحو نقطةٍ مركزية على هيئة العلامة الكوفية المصغّرة،
 * ثم تستقرّ في خفقانٍ هادئ لا يعيد التبعثر — كما تجتمع المادة قبل أن تُعرض.
 *
 * القواعد:
 * - صغيرٌ دائماً (24–48px) ويُوضع في المنطقة المنتظِرة وحدها — لا شاشة كاملة.
 * - يتأخر ظهوره ~250ms عبر CSS، فالعملية القصيرة لا ترى محمّلاً يومض.
 * - التجميع يحدث مرةً واحدة (forwards) ثم نبضة توهجٍ هادئة فقط.
 * - transform وopacity حصراً؛ ومع تفضيل تقليل الحركة: الشكل مكتمِلٌ بنبضةٍ خافتة.
 * - role="status" مع نصٍّ للقارئات؛ اللون من currentColor فيتبع سياق الصفحة.
 */

const GLYPHS = [
  /* كتاب */ 'M12 5c-2-1.4-4.6-1.8-7-1.6v14.2c2.4-.2 5 .2 7 1.6 2-1.4 4.6-1.8 7-1.6V3.4c-2.4-.2-5 .2-7 1.6zM12 5v14.2',
  /* ورقة بحث */ 'M6 3.5h12v17H6zM9 8.5h6M9 12h6M9 15.5h3.6',
  /* مقالة */ 'M4.5 6h15M4.5 10h15M4.5 14h10.5M4.5 18h7',
  /* صوت */ 'M4 10v4M8.5 7v10M13 4.5v15M17.5 8v8M21 10.5v3',
  /* فكرة */ 'M12 5.4a4.6 4.6 0 110 9.2 4.6 4.6 0 010-9.2zM12 2.2v1.6M21.8 10h-1.6M3.8 10H2.2M10.2 17.6h3.6M10.8 20.6h2.4',
]

export default function GlyphLoader({
  size = 32,
  label = 'جارٍ التحميل…',
  delayMs = 250,
  className = '',
  decorative = false,
}: {
  size?: 16 | 18 | 24 | 28 | 32 | 40 | 48
  label?: string
  delayMs?: number
  className?: string
  /** داخل زرٍّ نصُّه يشرح الحالة: الرمز زينةٌ محضة بلا role ولا نصٍّ مكرَّر. */
  decorative?: boolean
}) {
  return (
    <span
      {...(decorative ? { 'aria-hidden': true as const } : { role: 'status' })}
      className={`glyph-loader ${className}`.trim()}
      style={{ ['--gl-size']: `${size}px`, ['--gl-delay']: `${delayMs}ms` } as CSSProperties}
    >
      {!decorative && <span className="sr-only">{label}</span>}
      <svg viewBox="0 0 48 48" aria-hidden="true">
        {GLYPHS.map((d, i) => {
          const angle = (i / GLYPHS.length) * Math.PI * 2 - Math.PI / 2
          return (
            <g
              key={i}
              className="gl-glyph"
              style={{
                ['--gl-x']: `${Math.cos(angle) * 16}px`,
                ['--gl-y']: `${Math.sin(angle) * 16}px`,
                ['--gl-i']: `${i * 90}ms`,
              } as CSSProperties}
            >
              <path
                d={d}
                transform="translate(15 15) scale(0.75)"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        })}
        {/* قلب العلامة: مربّعٌ كوفيّ مصغّر يتوهّج بهدوء بعد اكتمال الجمع. */}
        <rect className="gl-mark" x="20.5" y="20.5" width="7" height="7" fill="currentColor" />
      </svg>
    </span>
  )
}

/**
 * النسخة السطرية: 16–18px بلون السياق (currentColor)، تجلس داخل زرٍّ أو سطرٍ
 * دون أي إزاحة في التخطيط — بديل الحلقة الدوّارة العامة.
 */
export function GlyphLoaderInline({ className = '' }: { className?: string }) {
  return <GlyphLoader size={18} delayMs={0} decorative className={`glyph-loader--inline ${className}`.trim()} />
}
