import { Link, useLocation } from 'react-router'
import { SocialIcon } from './icons'

/**
 * مدخل معرفي واحد، بوظيفتين واضحتين:
 * - البحث يسترجع مادة موجودة.
 * - سؤال الأرشيف يركّب جواباً من مواد الموقع الموثقة.
 * دمج الواجهة يزيل إحساس التكرار من دون خلط الوظيفتين.
 */
export function KnowledgeEntry({ compact = false }: { compact?: boolean }) {
  const location = useLocation()
  const activeTab = new URLSearchParams(location.search).get('tab')
  const bookActive = location.pathname === '/search' && activeTab === 'askbook'
  const askActive = location.pathname === '/ask'
  const searchActive = location.pathname === '/search' && !bookActive

  const primary = [
    {
      to: '/search',
      label: 'بحث',
      title: 'أبحث عن مادة',
      note: 'مقال، بحث، كتاب أو كلمة في الأرشيف',
      icon: 'Search' as const,
      active: searchActive,
    },
    {
      to: '/ask',
      label: 'اسأل',
      title: 'أسأل الأرشيف',
      note: 'جواب مركّب من مواد الموقع ومصادره فقط',
      icon: 'Question' as const,
      active: askActive,
    },
  ]

  return (
    <nav
      aria-label="البحث والسؤال في الأرشيف"
      className={`knowledge-entry ${compact ? '' : 'mb-8'} rounded-[1.45rem] border border-hair bg-wash p-2.5 md:p-3`}
    >
      <div className="flex items-center justify-between gap-3 px-2 pb-2.5">
        <div className="min-w-0">
          <span className="block text-[.64rem] font-semibold text-accent">مدخل المعرفة</span>
          <strong className="mt-0.5 block font-display text-[.92rem] font-semibold text-ink">ابحث أو اسأل الأرشيف</strong>
        </div>
        <Link
          to="/search?tab=askbook"
          aria-label="ابحث في كتاب"
          title="ابحث في كتاب"
          aria-current={bookActive ? 'page' : undefined}
          className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[.66rem] font-semibold transition-colors ${bookActive ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
        >
          <SocialIcon name="Search" size={12} />
          داخل كتاب
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-[1.05rem] border border-hair bg-canvas p-1.5" role="tablist" aria-label="اختر طريقة الوصول إلى المعرفة">
        {primary.map((option) => (
          <Link
            key={option.to}
            to={option.to}
            role="tab"
            aria-selected={option.active}
            aria-current={option.active ? 'page' : undefined}
            className={`group min-w-0 rounded-[.82rem] px-3 py-2.5 transition-[background-color,color,box-shadow] ${option.active ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-wash hover:text-accent'}`}
          >
            <span className="flex items-center gap-2">
              <SocialIcon name={option.icon} size={14} />
              <strong className="text-[.76rem]">{option.title}</strong>
            </span>
            <span className={`mt-1 block truncate text-[.6rem] font-light ${option.active ? 'text-white/72' : 'text-soft'}`}>{option.note}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
