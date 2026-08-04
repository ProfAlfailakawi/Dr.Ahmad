import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE, SocialIcon } from '../ui'

export interface SiteCapabilityHighlight {
  id: string
  title: string
  subtitle: string
  description: string
  icon: string
  badge: string
}

export const SITE_GEM_HIGHLIGHTS: SiteCapabilityHighlight[] = [
  {
    id: 'audio-dialogue',
    title: 'الحوار والتسجيل المسموع',
    subtitle: 'تسجيلات ثنائية حية تنبض بالحياة',
    description: 'استمع إلى المقالات بحوار ممتع بين متحدثين (فهد ونورة)، أو بقراءة متقنة مع تتبع النص سطر بسطر تلقائياً أثناء الاستماع.',
    icon: 'Radio',
    badge: 'استماع تفاعلي',
  },
  {
    id: 'encyclopedia-video',
    title: 'موسوعة تكنولوجيا التعليم المرئية',
    subtitle: 'فهارس الفيديو ومواد التدريس',
    description: 'فهرسة دقيقة للقناة والمواد المرئية مربوطة بالصفحات والأبواب والبحث الزمني بالثانية والدقيقة للوصول المباشر للمفهوم.',
    icon: 'Tv',
    badge: 'ربط زمني دقيق',
  },
  {
    id: 'semantic-search',
    title: 'البحث الدلالي العميق ومتون الكتب',
    subtitle: 'يفهم المعنى والصياغة اليومية',
    description: 'ابحث عن الأفكار والمواقف حتى لو لم تتذكر الكلمات الحرفية، مع إمكانية التفتيش المباشر داخل متون كتب الدكتور التسعة.',
    icon: 'Search',
    badge: 'ذكاء دلالي',
  },
  {
    id: 'idea-life',
    title: 'خيوط وحياة الفكرة',
    subtitle: 'شجرة تطور الفكر عبر السنين',
    description: 'شاهد كيف تتطور الفكرة وتنمو عبر الزمن من مقال قصير أو خاطرة إلى ورقة بحثية محكّمة ثم إلى كتاب كامل أو حلقة إعلامية.',
    icon: 'GitBranch',
    badge: 'تتبّع زمني',
  },
  {
    id: 'serenity-space',
    title: 'وضع السكينة ومساحتك الخاصة',
    subtitle: 'قراءة مريحة للعين وتخزين محلي',
    description: 'بدّل بين ثيم الورق الكريمي أو الداكن للقراءة الممتدة، واحفظ اقتباساتك وموادك المرجعية في مساحتك الخاصة بتشفير محلي آمن.',
    icon: 'Sparkles',
    badge: 'تجربة مخصصة',
  },
]

export default function FirstVisitOnboarding() {
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('audio-dialogue')

  useEffect(() => {
    const onboarded = localStorage.getItem('visitor:onboarded')
    if (!onboarded) {
      // First time visitor - show the onboarding guide smoothly
      const timer = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const closeAndDismiss = () => {
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
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-0 z-[400] flex items-center justify-center bg-ink/50 p-3 backdrop-blur-md sm:p-6"
          onClick={closeAndDismiss}
        >
          <motion.div
            initial={{ y: 28, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-hair bg-canvas p-5 shadow-2xl sm:p-8 md:p-9"
            dir="rtl"
          >
            {/* Header section */}
            <div className="flex items-start justify-between gap-4 border-b border-hair pb-5">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[.06] px-3.5 py-1 text-[.7rem] font-semibold text-accent">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  دليل الأرشيف والمعرفة الرقمية
                </span>
                <h2 className="mt-2.5 font-display text-[clamp(1.25rem,2.8vw,1.85rem)] font-bold leading-snug text-ink">
                  أهلاً بك في المنصة الفكرية للدكتور أحمد حسين الفيلكاوي
                </h2>
                <p className="mt-1 text-[.82rem] font-light leading-relaxed text-soft">
                  تمت هندسة هذا الأرشيف ليكون بيئة معرفية حية تعيد تقديم الفكر والأكاديميا بأحدث تقنيات العرض. إليك أبرز الخفايا والأدوات المتاحة بين يديك:
                </p>
              </div>
              <button
                type="button"
                onClick={closeAndDismiss}
                aria-label="إغلاق التوجيه"
                title="إغلاق التوجيه والبدء"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"
              >
                <SocialIcon name="Close" size={14} />
              </button>
            </div>

            {/* Content Body / Gems List */}
            <div className="my-5 flex-1 overflow-y-auto overscroll-contain pe-1 [scrollbar-width:thin]">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SITE_GEM_HIGHLIGHTS.map((gem) => {
                  const isActive = activeTab === gem.id
                  return (
                    <button
                      key={gem.id}
                      type="button"
                      onClick={() => setActiveTab(gem.id)}
                      className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-right transition-all duration-300 ${
                        isActive
                          ? 'border-accent bg-accent/[.05] shadow-sm'
                          : 'border-hair bg-wash hover:border-accent/40 hover:bg-canvas'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-[.95rem] transition-colors ${
                            isActive
                              ? 'border-accent bg-accent text-white'
                              : 'border-hair bg-canvas text-accent group-hover:border-accent'
                          }`}>
                            <SocialIcon name={gem.icon} size={17} />
                          </span>
                          <span className="rounded-full border border-hair bg-canvas px-2.5 py-0.5 text-[.6rem] font-semibold text-soft">
                            {gem.badge}
                          </span>
                        </div>
                        <strong className="mt-3 block font-display text-[.92rem] font-semibold leading-snug text-ink group-hover:text-accent">
                          {gem.title}
                        </strong>
                        <p className="mt-1 text-[.72rem] font-light leading-relaxed text-soft line-clamp-3">
                          {gem.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Detailed Highlight Banner */}
              {SITE_GEM_HIGHLIGHTS.find((g) => g.id === activeTab) && (
                <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/[.03] p-4 text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-accent">✦</span>
                    <strong className="text-[.82rem] font-semibold text-ink">
                      {SITE_GEM_HIGHLIGHTS.find((g) => g.id === activeTab)?.title} — {SITE_GEM_HIGHLIGHTS.find((g) => g.id === activeTab)?.subtitle}
                    </strong>
                  </div>
                  <p className="mt-1.5 text-[.78rem] leading-relaxed text-soft">
                    {SITE_GEM_HIGHLIGHTS.find((g) => g.id === activeTab)?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
              <p className="text-[.72rem] text-soft">
                تظهر هذه التعريفة مرة واحدة عند زيارتك الأولى ويمكنك استكشاف الموقع بحرية كاملة.
              </p>
              <button
                type="button"
                onClick={closeAndDismiss}
                className="inline-flex items-center gap-2 rounded-xl border border-accent bg-accent px-6 py-2.5 text-[.82rem] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[.98]"
              >
                <span>ابدأ استكشاف الأرشيف</span>
                <span>←</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
