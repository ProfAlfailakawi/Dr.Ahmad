import { Link, useLocation } from 'react-router-dom'

export function KnowledgeEntry({ compact = false }: { compact?: boolean }) {
  const location = useLocation()
  const options = [
    { to: '/search', label: 'أبحث عن مادة', note: 'عنوان، كلمة، بحث، كتاب أو سؤال منشور' },
    { to: '/ask', label: 'أسأل الأرشيف', note: 'جواب مركّب من مواد الموقع ومصادره فقط' },
  ]
  return (
    <nav aria-label="طرق البحث في المعرفة" className={`grid gap-2 rounded-[1.4rem] border border-hair bg-wash p-2 sm:grid-cols-2 ${compact ? '' : 'mb-8'}`}>
      {options.map((option) => {
        const active = location.pathname === option.to
        return (
          <Link key={option.to} to={option.to} aria-current={active ? 'page' : undefined} className={`rounded-[1.05rem] px-4 py-3 transition-colors ${active ? 'bg-accent text-white shadow-sm' : 'bg-canvas text-ink hover:text-accent'}`}>
            <strong className="block text-[.82rem]">{option.label}</strong>
            <span className={`mt-1 block text-[.68rem] leading-relaxed ${active ? 'text-white/72' : 'text-soft'}`}>{option.note}</span>
          </Link>
        )
      })}
    </nav>
  )
}
