#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expandEncyclopediaPassages } from './encyclopedia-passage-expansion.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = resolve(ROOT, 'src/data/book-passages.json')
const payload = JSON.parse(readFileSync(FILE, 'utf8'))
const encyclopedia = payload.books.find((book) => book.slug === 'encyclopedia')
if (!encyclopedia) throw new Error('لم أجد سجل موسوعة تكنولوجيا التعليم في book-passages.json')

const before = encyclopedia.passages.length
const target = Math.max(900, Number(process.env.ENCYCLOPEDIA_PASSAGE_TARGET || 0))
encyclopedia.passages = expandEncyclopediaPassages(encyclopedia.passages, { target })
payload.coverage.passages = payload.books.reduce((sum, book) => sum + book.passages.length, 0)
payload.coverage.encyclopediaPassages = encyclopedia.passages.length
payload.coverage.expansionPolicy = 'مقاطع دلالية قصيرة مشتقة حرفياً من المقاطع المنشورة نفسها؛ بلا توليد أو إعادة صياغة أو كشف متصل للكتاب.'
writeFileSync(FILE, `${JSON.stringify(payload)}\n`, 'utf8')
console.log(`✔ موسوعة تكنولوجيا التعليم: ${before} ← ${encyclopedia.passages.length} مقطعاً عالي الدقة`)
console.log(`✔ إجمالي فهرس الكتب: ${payload.coverage.passages} مقطعاً`)
