import type { BibTeXRecord } from './bibtex'

export type ScholarCitation = {
  kind: 'article' | 'inproceedings' | 'book' | 'misc'
  id: string
  title: string
  authors: string[]
  year: string
  date?: string
  journal: string
  conference: string
  publisher: string
  volume: string
  issue: string
  firstPage: string
  lastPage: string
  doi: string
  isbn: string
  pdfUrl: string
  url: string
  language: string
}

export const SCHOLAR_AUTHOR_AR: string
export const SCHOLAR_AUTHOR_EN: string
export function scholarYear(...values: unknown[]): string
export function splitAuthors(value: unknown): string[]
export function parseJournalLine(line: unknown): { name: string; volume?: string; issue?: string; firstPage?: string; lastPage?: string; year?: string }
export function paperCitation(paper: Record<string, any> | null | undefined, options?: { site?: string; pdfExists?: (path: string) => boolean }): ScholarCitation
export function bookCitation(book: Record<string, any> | null | undefined, options?: { site?: string }): ScholarCitation
export function articleCitation(article: Record<string, any> | null | undefined, options?: { site?: string; siteName?: string }): ScholarCitation
export function scholarMetaTags(record: ScholarCitation | null | undefined): Array<[string, string]>
export function citationToBibTeX(record: ScholarCitation): BibTeXRecord
