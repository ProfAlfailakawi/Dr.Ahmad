import { Link, useLocation } from 'react-router'
import { SocialIcon } from './icons'

export function KnowledgeEntry({ compact = false }: { compact?: boolean }) {
  const location = useLocation()
  const activeTab = new URLSearchParams(location.search).get('tab')
  const options = [
    { to: '/search', label: 'أبحث عن مادة', note: 'عنوان، كلمة، بحث، كتاب أو سؤال منشور', icon: 'Search' as const },
    { to: '/ask', label: 'أسأل الأرشيف', note: 'جواب مركّب من مواد الموقع ومصادره فقط', icon: 'Question' as const },
    { to: '/search?tab=askbook', label: 'ابحث في كتاب', note: 'بحث مباشر داخل متن كتاب من كتب الدكتور', icon: 'Search' as const, special: true },
  ]
  return (
    <nav aria-label="طرق البحث في المعرفة" className={`grid gap-2 rounded-[1.4rem] border border-hair bg-wash p-2 sm:grid-cols-3 ${compact ? '' : 'mb-8'}`}>
      {options.map((option) => {
        const isBookSearch = option.to.includes('tab=askbook')
        const active = isBookSearch
          ? location.pathname === '/search' && activeTab === 'askbook'
          : location.pathname === option.to && activeTab !== 'askbook'
        return (
          <Link
            key={option.to}
            to={option.to}
            aria-current={active ? 'page' : undefined}
            className={`relative rounded-[1.05rem] px-4 py-3 transition-all ${active
              ? 'bg-accent text-white shadow-sm'
              : option.special
                ? 'border border-accent/[.35] bg-accent/[.06] text-ink hover:border-accent hover:bg-accent/[.1]'
                : 'bg-canvas text-ink hover:text-accent'}`}
          >
            {option.special && !active && <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[.56rem] font-bold text-white">ميزة خاصة</span>}
            <span className="flex items-center gap-2">
              <SocialIcon name={option.icon} size={14} />
              <strong className="block text-[.82rem]">{option.label}</strong>
            </span>
            <span className={`mt-1 block text-[.68rem] leading-relaxed ${active ? 'text-white/72' : 'text-soft'}`}>{option.note}</span>
          </Link>
        )
      })}
    </nav>
  )
}
