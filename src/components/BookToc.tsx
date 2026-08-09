import { useState } from 'react'
import { Link } from 'react-router'
import { arabicCountPhrase, CHAPTER_FORMS } from '../lib/arabic-count.ts'
import { bookKnowledgeAnchor, getBookKnowledge, type BookKnowledgeConcept } from '../lib/book-knowledge'

type TocEntry = { index: number; label: string; page: string }
type TocGroup = { title: string; entries: TocEntry[] }

function splitTocLabel(value: string) {
  const match = value.match(/^(.*?)(?:\s*[–—-]\s*ص\s*([0-9٠-٩]+))\s*$/u)
  return match ? { label: match[1].trim(), page: match[2] } : { label: value.trim(), page: '' }
}

function groupToc(items: string[]): TocGroup[] {
  const groups: TocGroup[] = []
  let current: TocGroup = { title: 'مدخل الكتاب', entries: [] }
  items.forEach((raw, index) => {
    const value = raw.trim()
    if (!value) return
    if (/^الباب\s/u.test(value)) {
      if (current.entries.length) groups.push(current)
      current = { title: value, entries: [] }
      return
    }
    current.entries.push({ index: index + 1, ...splitTocLabel(value) })
  })
  if (current.entries.length) groups.push(current)
  if (!groups.length && items.length) {
    return [{ title: 'محتويات الكتاب', entries: items.map((item, index) => ({ index: index + 1, ...splitTocLabel(item) })) }]
  }
  return groups
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function pageNumber(value = '') {
  const latin = value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
  const number = Number(latin)
  return Number.isFinite(number) ? number : 0
}

function normalizeTocText(value = '') {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/^(?:الفصل|الباب)\s+(?:الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)\s*[:：-]?\s*/u, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tocConcept(bookSlug: string, entry: TocEntry): BookKnowledgeConcept | null {
  const concepts = (getBookKnowledge(bookSlug)?.concepts || [])
    .filter((concept) => !/^قائمة المراجع/u.test(concept.title))
  if (!concepts.length) return null

  const page = pageNumber(entry.page)
  if (page > 0) {
    const exact = concepts.find((concept) => page >= concept.pageStart && page <= concept.pageEnd)
    if (exact) return exact
  }

  const entryWords = new Set(normalizeTocText(entry.label).split(' ').filter((word) => word.length > 2))
  let best: { concept: BookKnowledgeConcept; score: number } | null = null
  for (const concept of concepts) {
    const conceptWords = new Set(normalizeTocText(concept.title).split(' ').filter((word) => word.length > 2))
    let score = 0
    for (const word of entryWords) if (conceptWords.has(word)) score += word.length >= 7 ? 3 : 2
    if (normalizeTocText(concept.title) === normalizeTocText(entry.label)) score += 20
    if (page > 0) score += Math.max(0, 8 - Math.min(8, Math.abs(concept.pageStart - page)))
    if (!best || score > best.score) best = { concept, score }
  }
  return best?.score ? best.concept : concepts[0]
}

function TocDisclosure({ group, groupIndex, bookSlug }: { group: TocGroup; groupIndex: number; bookSlug: string }) {
  const [open, setOpen] = useState(groupIndex === 0)
  return (
    <details className="group/toc" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-5 py-4 md:px-7">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair font-display text-[.68rem] text-accent">{String(groupIndex + 1).padStart(2, '0')}</span>
        <strong className="min-w-0 flex-1 break-words text-[.9rem] leading-relaxed text-ink">{group.title}</strong>
        <span className="shrink-0 text-[.66rem] text-soft">{arabicCountPhrase(group.entries.length, CHAPTER_FORMS)}</span>
        <span aria-hidden className="text-accent transition-transform group-open/toc:rotate-45">＋</span>
      </summary>
      <ol className="border-t border-hair bg-wash/[.38] px-5 py-2 md:px-7">
        {group.entries.map((entry) => {
          const concept = tocConcept(bookSlug, entry)
          const anchor = concept ? bookKnowledgeAnchor(concept) : 'book-knowledge'
          return (
            <li key={`${entry.index}-${entry.label}`} className="grid min-w-0 grid-cols-[2.2rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-hair py-3.5 last:border-b-0">
              <span className="font-display text-[.68rem] tabular-nums text-accent">{String(entry.index).padStart(2, '0')}</span>
              <Link to={`/publications/${bookSlug}#${anchor}`} aria-label={`انتقل إلى ${entry.label} داخل الكتاب`} className="min-w-0 break-words text-[.82rem] leading-[1.8] text-ink transition-colors hover:text-accent">{entry.label}</Link>
              {entry.page && <span className="shrink-0 text-[.68rem] tabular-nums text-soft">ص {entry.page}</span>}
            </li>
          )
        })}
      </ol>
    </details>
  )
}

export default function BookToc({ toc, bookSlug }: { toc: string[]; bookSlug: string }) {
  const groups = groupToc(toc)
  return (
    <div className="divide-y divide-hair">
      {groups.map((group, groupIndex) => (
        <TocDisclosure key={`${group.title}-${groupIndex}`} group={group} groupIndex={groupIndex} bookSlug={bookSlug} />
      ))}
    </div>
  )
}
