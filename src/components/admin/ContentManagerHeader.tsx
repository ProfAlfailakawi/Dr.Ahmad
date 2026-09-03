import type { ManagedKind } from './ContentManager'
import { arabicCountPhrase, ITEM_FORMS } from '../../lib/arabic-count.ts'

const labels: Record<ManagedKind, { singular: string; plural: string }> = {
  article: { singular: 'مقال', plural: 'المقالات' },
  book: { singular: 'كتاب', plural: 'الكتب' },
  paper: { singular: 'بحث', plural: 'الأبحاث' },
  media: { singular: 'ظهور إعلامي', plural: 'الإعلام' },
}

export function ContentManagerHeader({ kind, total, query, descending, onQuery, onSort, onNew, inputClass, primaryClass, secondaryClass }: {
  kind: ManagedKind
  total: number
  query: string
  descending: boolean
  onQuery: (value: string) => void
  onSort: () => void
  onNew: () => void
  inputClass: string
  primaryClass: string
  secondaryClass: string
}) {
  const copy = labels[kind]
  return (
    <>
      <div className="grid min-w-0 gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[.76rem] font-semibold uppercase text-accent">إدارة المحتوى</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">{copy.plural}</h2>
          <p className="mt-1 text-[.82rem] text-soft">{arabicCountPhrase(total, ITEM_FORMS)} — الأصل والإضافات في قائمة واحدة.</p>
        </div>
        <button type="button" onClick={onNew} className={`${primaryClass} w-full sm:w-auto`}>+ إضافة {copy.singular}</button>
      </div>
      <div className="grid gap-3 rounded-2xl border border-hair bg-wash p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={inputClass} type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={`ابحث في ${copy.plural}…`} aria-label={`بحث في ${copy.plural}`} />
        <button type="button" onClick={onSort} className={secondaryClass}>{descending ? 'الأحدث أولاً ↓' : 'الأقدم أولاً ↑'}</button>
      </div>
    </>
  )
}
