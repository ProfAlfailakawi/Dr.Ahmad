export type BibTeXType = 'article' | 'book' | 'incollection' | 'inproceedings' | 'phdthesis' | 'mastersthesis' | 'misc'
export type BibTeXRecord = {
  type: BibTeXType
  id?: string
  authors?: string | string[]
  title: string
  journal?: string
  booktitle?: string
  year?: string
  volume?: string
  number?: string
  pages?: string
  publisher?: string
  address?: string
  doi?: string
  url?: string
  isbn?: string
  issn?: string
  language?: string
  note?: string
}

const fieldOrder: (keyof BibTeXRecord)[] = ['authors','title','journal','booktitle','year','volume','number','pages','publisher','address','doi','url','isbn','issn','language','note']
const fieldNames: Partial<Record<keyof BibTeXRecord, string>> = { authors: 'author' }

function clean(value: unknown) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function bibtexAuthors(value?: string | string[]) {
  const source = Array.isArray(value) ? value : clean(value).split(/\s*(?:;|\||،\s*و|\s+and\s+)\s*/iu)
  return source.map(clean).filter(Boolean).join(' and ')
}

export function escapeBibTeX(value: unknown) {
  return clean(value)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/%/g, '\\%')
    .replace(/#/g, '\\#')
    .replace(/&/g, '\\&')
    .replace(/_/g, '\\_')
}

function latinKeyPart(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '')
}

export function createBibTeXKey(record: BibTeXRecord) {
  const authorText = bibtexAuthors(record.authors).split(/\s+and\s+/i)[0] || 'Alfailakawi'
  const authorParts = authorText.replace(/[،,]/g, ' ').split(/\s+/).filter(Boolean)
  const author = latinKeyPart(authorParts.find((part) => /[A-Za-z]/.test(part)) || authorParts.at(-1) || '') || 'Alfailakawi'
  const year = clean(record.year).match(/(?:19|20)\d{2}/)?.[0] || 'ND'
  const titleWord = clean(record.title).split(/\s+/).map(latinKeyPart).find((word) => word.length >= 4) || 'Work'
  const stable = latinKeyPart(record.id || '').slice(0, 8)
  return `${author}${year}${titleWord}${stable}`
}

export function buildBibTeX(record: BibTeXRecord) {
  const lines: string[] = []
  for (const key of fieldOrder) {
    let raw: unknown = record[key]
    if (key === 'authors') raw = bibtexAuthors(record.authors)
    const value = clean(raw)
    if (!value) continue
    lines.push(`  ${fieldNames[key] || key} = {${escapeBibTeX(value)}},`)
  }
  return `@${record.type}{${createBibTeXKey(record)},\n${lines.join('\n')}\n}`
}

export function safeCitationFilename(title: string, extension: 'bib' | 'ris') {
  const base = clean(title).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 72).trim() || 'citation'
  return `${base}.${extension}`
}

export function downloadCitationFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1800)
}
