import { motion, useReducedMotion } from 'framer-motion'
import { BookCheck, MessageCircleQuestion, Quote, Search } from 'lucide-react'
import { EASE } from './ui'

/**
 * «كيف يُبنى الجواب؟» — أربع محطّات تُضاء واحدةً بعد أخرى حين تدخل الشاشة.
 *
 * الخطوات مطابقة لما تفعله «اسأل المكتبة» فعلاً: السؤال، ثم بحثٌ في المقالات
 * والأبحاث والكتب، ثم مقاطعُ حرفية منها، ثم جوابٌ مرتبط بمصادره. وإن لم
 * يوجد دليلٌ يقول ذلك صراحةً (انظر وعد الصفحة أعلاه).
 *
 * عرض فقط: لا يقرأ بيانات ولا يغيّر حالة. ومن أطفأ الحركة يراه مكتملاً ساكناً.
 */
const STEPS = [
  { Icon: MessageCircleQuestion, title: 'سؤالك', note: 'اكتبه بكلماتك' },
  { Icon: Search, title: 'البحث في الكتب', note: 'والمقالات والأبحاث' },
  { Icon: Quote, title: 'المقاطع', note: 'النص الحرفي الذي استُند إليه' },
  { Icon: BookCheck, title: 'جواب موثّق بمصادره', note: 'أو يقول لك إن لم يجد دليلاً' },
] as const

export function AskHowItWorks() {
  const reduce = useReducedMotion()
  const step = 0.45

  return (
    <section aria-label="كيف يُبنى الجواب" className="mt-12 border-t border-hair pt-8">
      <p className="text-[.75rem] font-medium text-soft">كيف يُبنى الجواب</p>
      <ol className="relative mt-6 grid gap-6 md:grid-cols-4 md:gap-4">
        {/* الخيط: عموديّ على الهاتف، أفقيّ على الشاشات الأوسع، ويُرسم عند الدخول */}
        <motion.span
          aria-hidden="true"
          className="absolute bottom-4 right-[1.2rem] top-4 w-px origin-top bg-accent/30 md:bottom-auto md:left-[12%] md:right-[12%] md:top-[1.2rem] md:h-px md:w-auto md:origin-right"
          initial={reduce ? false : { scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true, margin: '0px 0px -10% 0px' }}
          transition={{ duration: reduce ? 0 : step * 3, ease: EASE }}
        />
        {STEPS.map(({ Icon, title, note }, i) => (
          <motion.li
            key={title}
            className="relative flex items-start gap-4 md:flex-col md:items-center md:gap-3 md:text-center"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: reduce ? 0 : 0.5, ease: EASE, delay: reduce ? 0 : i * step }}
          >
            <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-accent/30 bg-canvas text-accent">
              <Icon aria-hidden size="1.1rem" strokeWidth={1.6} />
            </span>
            <span className="block">
              <span className="block text-[.7rem] font-medium text-soft">{i + 1}</span>
              <span className="block font-display text-[1rem] font-semibold leading-relaxed text-ink">{title}</span>
              <span className="block text-[.8rem] leading-relaxed text-soft">{note}</span>
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}
