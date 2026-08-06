#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { expandEncyclopediaPassages, looksLikeReference, validFragment } from './encyclopedia-passage-expansion.mjs'

const payload = JSON.parse(readFileSync(new URL('../src/data/book-passages.json', import.meta.url), 'utf8'))
const book = payload.books.find((item) => item.slug === 'encyclopedia')
assert.ok(book, 'encyclopedia book exists')
assert.ok(book.passages.length >= 900, `expected at least 900 passages, got ${book.passages.length}`)
assert.equal(new Set(book.passages.map((item) => item.fingerprint)).size, book.passages.length, 'fingerprints are unique')
assert.ok(book.passages.every((item) => validFragment(item.text)), 'all passages pass the public-quality gate')
assert.ok(book.passages.every((item) => !looksLikeReference(item.text)), 'bibliographic/reference-like rows are excluded')
assert.ok(book.passages.every((item) => item.parentPassageId && item.segmentKind), 'every derived passage keeps auditable provenance')

const sample = [{ id: 'x', text: 'تسهم تكنولوجيا التعليم في تنظيم الخبرات التعليمية، وتساعد المعلم على اختيار الوسيلة المناسبة للموقف التعليمي وتحقيق أهدافه بوضوح.', page: 10 }]
const expanded = expandEncyclopediaPassages(sample, { target: 20 })
assert.ok(expanded.length >= 1)
assert.ok(expanded.every((item) => sample[0].text.includes(item.text) || item.text === sample[0].text), 'no generated or rewritten prose is introduced')
console.log(`✓ توسعة متن الموسوعة سليمة: ${book.passages.length} مقطعاً`)
