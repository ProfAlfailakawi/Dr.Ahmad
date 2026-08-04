import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router'
import { EASE, SocialIcon } from '../ui'

const STORAGE_KEY = 'visitor:onboarded:archive-guide-v4'

const entrances = [
  {
    id: 'meaning',
    title: 'البحث الدلالي (بالفكرة)',
    desc: 'لا تبحث بالكلمة المطابقة، اكتب الفكرة وسنجلب لك المعنى المقصود.',
    icon: 'Search',
    path: '/search',
  },
  {
    id: 'relations',
    title: 'أطلس المعرفة',
    desc: 'خريطة تفاعلية تظهر لك كيف تترابط المقالات والمؤلفات ببعضها.',
    icon: 'Link',
    path: '/atlas',
  },
  {
    id: 'question',
    title: 'اسأل الأرشيف',
    desc: 'بدلاً من القراءة، اطرح سؤالك وسيجيبك الذكاء الاصطناعي من المصادر.',
    icon: 'Sparkles',
    path: '/ask',
  },
] as const

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const timer = window.setTimeout(() => setVisible(true), 500)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [visible])

  const finish = (path?: string) => {
    localStorage.setItem(STORAGE_KEY, 'seen')
    setVisible(false)
    if (path) navigate(path)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="fixed inset-0 z-[400] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-md sm:p-6"
          onClick={() => finish()}
        >
          <motion.section
            initial={{ y: 20, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-[400px] overflow-hidden rounded-[24px] border border-hair bg-paper shadow-2xl"
            dir="rtl"
            aria-modal="true"
            role="dialog"
          >
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[.65rem] font-bold text-accent">
                    <SocialIcon name="Sparkles" size={12} />
                    أدوات متقدمة
                  </span>
                  <h2 className="font-display text-xl font-bold text-ink">أسرار الأرشيف الذكي</h2>
                  <p className="mt-2 text-[.85rem] leading-[1.6] text-soft">
                    صُمم هذا الموقع ليتجاوز التصفح التقليدي. إليك ٣ أدوات خفية للوصول العميق:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => finish()}
                  aria-label="إغلاق الترحيب"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wash text-soft transition-colors hover:bg-hair hover:text-ink"
                >
                  <SocialIcon name="Close" size={14} />
                </button>
              </div>

              <div className="grid gap-3">
                {entrances.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => finish(item.path)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent/30 hover:bg-accent/[.02]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-accent shadow-sm transition-colors group-hover:bg-accent group-hover:text-white">
                      <SocialIcon name={item.icon} size={16} />
                    </div>
                    <div>
                      <strong className="block text-[.9rem] font-bold text-ink">{item.title}</strong>
                      <span className="mt-0.5 block text-[.75rem] text-soft">{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => finish()}
                className="mt-6 block w-full rounded-xl py-3 text-center text-[.85rem] font-medium text-soft transition-colors hover:bg-wash hover:text-ink"
              >
                تصفح الأرشيف بشكل طبيعي
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
