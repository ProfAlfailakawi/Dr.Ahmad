#!/usr/bin/env node
/** ملخّصٌ خفيف لتضاريس الكتب: رقم الصفحة وكثافة متنها فقط. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const passages = JSON.parse(readFileSync(resolve(root, 'src/data/book-passages.json'), 'utf8'))
const blocklist = JSON.parse(readFileSync(resolve(root, 'src/data/book-passage-blocklist.json'), 'utf8'))
const blocked = new Set((blocklist.blocked || []).map((item) => String(item.fingerprint || '')))
const books = {}
for (const book of passages.books || []) {
  const pages = new Map()
  for (const passage of book.passages || []) {
    if (blocked.has(String(passage.fingerprint || ''))) continue
    const page = Math.max(1, Math.round(Number(passage.page) || 0))
    if (!page) continue
    pages.set(page, (pages.get(page) || 0) + String(passage.text || '').length)
  }
  const max = Math.max(1, ...pages.values())
  books[book.slug] = [...pages.entries()].sort((a, b) => a[0] - b[0])
    .map(([page, chars]) => [page, Math.max(4, Math.min(100, Math.round((chars / max) * 100)))])
}
writeFileSync(resolve(root, 'src/data/book-page-density.json'), `${JSON.stringify({ version: 1, books })}\n`, 'utf8')
console.log(`✔ تضاريس الكتب: ${Object.keys(books).length} كتب`)
