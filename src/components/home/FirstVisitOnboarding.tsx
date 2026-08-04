import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE, SocialIcon } from '../ui'

export interface OnboardingGem {
  id: string
  title: string
  desc: string
  icon: string
  path: string
}

export const ONBOARDING_GEMS: OnboardingGem[] = [
  {
    id: 'articles',
    title: 'المقالات والتأملات الأسبوعية',
    desc: 'أفكار حول التربية، التكنولوجيا، والتحول المجتمعي.',
    icon: 'BookOpen',
    path: '/articles',
  },
  {
    id: 'encyclopedia',
    title: 'المؤلفات والموسوعة المرئية',
    desc: 'تسعة كتب وموسوعة مرئية مع ربط زمني ودقيق.',
    icon: 'GraduationCap',
    path: '/publications',
  },
  {
    id: 'research',
    title: 'الأبحاث والأوراق المحكّمة',
    desc: 'الدراسات الأكاديمية الموثقة بأدلتها ومراجعها.',
    icon: 'Cite',
    path: '/research',
  },
]

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onboarded = localStorage.getItem('visitor:onboarded')
    if (!onboarded) {
      const timer = setTimeout(() => setVisible(true), 450)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleSelect = (path: string) => {
    localStorage.setItem('visitor:onboarded', 'true')
    setVisible(false)
    navigate(path)
  }

  const handleDismiss = () => {
    localStorage.setItem('visitor:onboarded', 'true')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed inset-0 z-[400] flex items-center justify-center bg-ink/[.45] p-4 backdrop-blur-md"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-3xl border border-hair bg-paper p-6 shadow-2xl"
            dir="rtl"
          >
            {/* Top Close Button */}
            <div className="flex items-center justify-between border-b border-hair pb-4">
              <span className="inline-flex items-center gap-1.5 text-[.72rem] font-extrabold text-accent">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                مرحباً بك في الأرشيف
              </span>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="إغلاق التوجيه"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <SocialIcon name="Close" size={12} />
              </button>
            </div>

            {/* Header Content */}
            <div className="mt-4">
              <h2 className="font-display text-xl font-bold text-ink">
                أين تحب أن تبدأ رحلتك؟
              </h2>
              <p className="mt-1 text-[.78rem] leading-relaxed text-soft">
                اختر أحد أقسام المنصة الفكرية أو استكشف الأرشيف كاملاً بحرية.
              </p>
            </div>

            {/* Gem Items */}
            <div className="my-4 grid gap-2.5">
              {ONBOARDING_GEMS.map((gem) => (
                <button
                  key={gem.id}
                  type="button"
                  onClick={() => handleSelect(gem.path)}
                  className="group flex items-center gap-3.5 rounded-2xl border border-hair bg-canvas p-3.5 text-right transition-colors hover:border-accent hover:bg-wash"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hair bg-wash text-accent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-white">
                    <SocialIcon name={gem.icon} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block font-display text-[.88rem] font-bold text-ink group-hover:text-accent">
                      {gem.title}
                    </span>
                    <span className="mt-0.5 block text-[.74rem] leading-snug text-soft">
                      {gem.desc}
                    </span>
                  </div>
                  <span className="text-[.8rem] text-soft transition-transform group-hover:translate-x-[-3px] group-hover:text-accent">
                    ←
                  </span>
                </button>
              ))}
            </div>

            {/* Bottom Footer Action */}
            <div className="border-t border-hair pt-3 text-center">
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full rounded-xl border border-hair bg-wash py-2.5 text-[.8rem] font-bold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                استكشف الأرشيف كاملاً بحرية ←
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
