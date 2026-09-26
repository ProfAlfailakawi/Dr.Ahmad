/*
 * التحوّل المشترك (shared-element morph) — عنصر واحد يتحوّل بدل أن يختفي ويُستبدل.
 *
 * الفكرة مأخوذة من حركة شريط الحالة في iOS: الأيقونات لا تختفي ليظهر مؤشر تحميل
 * جديد فوقها، بل الأيقونات نفسها تنقلب إليه. البطارية تصير القوس، وأعمدة الإشارة
 * تصير النقاط. المستخدم يرى من أين جاء الشكل الجديد، فلا يحسّ بقطعٍ بصري.
 *
 * الاستعمال: أعطِ العنصرين (قبل وبعد) نفس `layoutId` عبر MORPH_ID، وسيتكفّل
 * framer-motion بالانتقال. أو استخدم <MorphSurface> حين يكون العنصر واحداً
 * ويتغيّر محتواه وحجمه فقط.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import { EASE_POINTS } from '../lib/design-system'
import { GlyphLoaderInline } from './GlyphLoader'

/** أسماء التحوّلات المستعملة في الموقع — تُجمَع هنا لمنع التصادم. */
export const MORPH_ID = {
  contactSend: 'morph-contact-send',
  studioGenerate: 'morph-studio-generate',
} as const

/** مدة التحوّل: بطيئة بما يكفي لتُقرأ، لا بطيئة بما يُملّ. */
export const MORPH_DURATION = 0.62
/** تبديل المحتوى الداخلي أسرع من تحوّل الشكل، فلا يتزاحمان. */
export const MORPH_FADE = 0.22

/** منحنى التحوّل، مع احترام «تقليل الحركة» في إعدادات النظام. */
export function useMorphTransition() {
  const reduce = useReducedMotion()
  return {
    reduce: Boolean(reduce),
    shell: reduce ? { duration: 0 } : { duration: MORPH_DURATION, ease: EASE_POINTS },
    face: reduce ? { duration: 0 } : { duration: MORPH_FADE, ease: 'easeOut' as const },
  }
}

/**
 * سطح يتحوّل في مكانه: يتغيّر حجمه وشكله بسلاسة كلما تغيّرت `phase`،
 * ويُبدّل محتواه بتلاشٍ قصير داخل الشكل المتحوّل.
 */
export function MorphSurface({
  phase,
  children,
  className = '',
  radius = 16,
  style,
  layoutId,
  ...rest
}: {
  /** مفتاح الحالة — تغيّره يبدأ التحوّل. */
  phase: string
  children: ReactNode
  className?: string
  /** نصف قطر الحواف؛ يُمرَّر inline ليتحرّك مع التحوّل بدل أن يقفز. */
  radius?: number
  style?: CSSProperties
  layoutId?: string
  role?: string
  dir?: 'rtl' | 'ltr'
  'aria-live'?: 'off' | 'polite' | 'assertive'
}) {
  const t = useMorphTransition()
  return (
    <motion.div
      layout
      layoutId={layoutId}
      transition={t.shell}
      style={{ borderRadius: radius, ...style }}
      className={className}
      {...rest}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          layout="position"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={t.face}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

/** مؤشر انتظار صغير يعيش داخل السطح المتحوّل نفسه — «شتاتٌ يجتمع» بنسخته السطرية، لا حلقة دوّارة عامة. */
export function MorphRing({ className = '' }: { className?: string }) {
  return <GlyphLoaderInline className={className} />
}
