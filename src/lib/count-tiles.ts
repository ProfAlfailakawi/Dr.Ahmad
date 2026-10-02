/* مساعدات عرض فقط لبلاطات العدّ: تُشتقّ من بيانات موجودة فعلاً، وإن تعذّر
   الاستخراج لأي عنصر تُرجع null فتُحذف البلاطة بدل أن تُظهر رقماً خاطئاً. */

export type YearBar = { year: string; count: number }
export type RankedBar = { label: string; value: number }

const YEAR = /^(?:19|20)\d{2}$/

function yearBars(years: Array<string | null>): YearBar[] | null {
  if (years.length === 0 || years.some((year) => !year)) return null
  const tally = new Map<string, number>()
  for (const year of years as string[]) tally.set(year, (tally.get(year) || 0) + 1)
  const sorted = [...tally.keys()].sort()
  const first = Number(sorted[0])
  const last = Number(sorted[sorted.length - 1])
  const bars: YearBar[] = []
  if (last - first <= 12) for (let y = first; y <= last; y += 1) bars.push({ year: String(y), count: tally.get(String(y)) || 0 })
  else for (const year of sorted) bars.push({ year, count: tally.get(year) || 0 })
  return bars.length >= 2 ? bars : null
}

/** السنة جزء مستقل في نص المجلة (يفصله «·») — لا نلتقط أرقام المجلد أو الصفحات. */
export function paperYear(journal = ''): string | null {
  const part = journal.split('·').map((piece) => piece.trim()).find((piece) => YEAR.test(piece))
  return part || null
}

export function paperLanguage(journal = ''): 'ar' | 'en' | null {
  const name = journal.split('·')[0] || ''
  if (/[ء-ي]/.test(name)) return 'ar'
  if (/[A-Za-z]{3}/.test(name)) return 'en'
  return null
}

export type ResearchTiles = {
  total: number
  verified: number | null
  years: YearBar[] | null
  arabic: { ar: number; en: number } | null
}

export function researchTiles(papers: Array<{ journal?: string; verification?: string; year?: string | number }>): ResearchTiles {
  const total = papers.length
  const verified = papers.filter((paper) => paper.verification === 'verified').length
  const langs = papers.map((paper) => paperLanguage(paper.journal))
  const ar = langs.filter((lang) => lang === 'ar').length
  const en = langs.filter((lang) => lang === 'en').length
  return {
    total,
    verified: verified > 0 ? verified : null,
    years: yearBars(papers.map((paper) => {
      const own = String(paper.year ?? '').trim()
      return YEAR.test(own) ? own : paperYear(paper.journal)
    })),
    arabic: total > 0 && ar + en === total && ar > 0 ? { ar, en } : null,
  }
}

export type BookTiles = {
  total: number
  years: YearBar[] | null
  pages: { top: RankedBar[]; sum: number | null } | null
}

export function bookTiles(books: Array<{ title: string; year?: string; pageCount?: string }>): BookTiles {
  const total = books.length
  const years = yearBars(books.map((book) => (YEAR.test(String(book.year || '').trim()) ? String(book.year).trim() : null)))
  const paged = books
    .map((book) => ({ label: book.title, value: /^\d{1,5}$/.test(String(book.pageCount || '').trim()) ? Number(book.pageCount) : 0 }))
    .filter((row) => row.value > 0)
  const top = [...paged].sort((left, right) => right.value - left.value).slice(0, 5)
  return {
    total,
    years,
    pages: top.length >= 2 ? { top, sum: paged.length === total ? paged.reduce((acc, row) => acc + row.value, 0) : null } : null,
  }
}
