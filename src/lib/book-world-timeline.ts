export type BookWorldTimelineArticle = {
  slug: string
  title: string
  date?: string
  iso?: string
  year?: string
}

function yearOf(value?: string) {
  return String(value || '').match(/(?:19|20)\d{2}/)?.[0] || ''
}

export function bookArchiveDate(item: BookWorldTimelineArticle) {
  return String(item.date || item.iso || item.year || '').trim()
}

/**
 * يختار أقوى مادة لكل سنة ثم يوزّع العينة على كامل عمر الأرشيف، بدلاً من
 * أخذ آخر ست مواد (الذي كان يجعل السنوات كلها 2026 مع كثافة النشر الحالية).
 */
export function buildBookWorldTimeline(
  rows: Array<{ item: BookWorldTimelineArticle; score: number }>,
  limit = 6,
) {
  const bestByYear = new Map<string, { item: BookWorldTimelineArticle; score: number; year: string; date: string }>()
  for (const row of rows) {
    const date = bookArchiveDate(row.item)
    const year = yearOf(date)
    if (!year) continue
    const candidate = { ...row, year, date }
    const previous = bestByYear.get(year)
    if (!previous || row.score > previous.score || (row.score === previous.score && date > previous.date)) {
      bestByYear.set(year, candidate)
    }
  }

  const years = [...bestByYear.values()].sort((a, b) => a.year.localeCompare(b.year) || a.date.localeCompare(b.date))
  if (years.length <= limit) return years
  if (limit <= 1) return years.length ? [years[years.length - 1]] : []

  const indexes = new Set<number>()
  for (let index = 0; index < limit; index += 1) {
    indexes.add(Math.round((index * (years.length - 1)) / (limit - 1)))
  }
  return [...indexes].sort((a, b) => a - b).map((index) => years[index]).filter(Boolean)
}
