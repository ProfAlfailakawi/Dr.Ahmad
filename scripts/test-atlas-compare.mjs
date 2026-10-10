#!/usr/bin/env node
/**
 * رابط المقارنة في سماء المقالات (‎?compare=slugA,slugB): منطقٌ خالص.
 * السلوك الحيّ (الرجوع/التقدّم، الاستعادة) يُفحص في المتصفح.
 */
import assert from 'node:assert/strict'
import { compareSlugsFromSearch, resolveCompare } from '../src/lib/atlas-compare.ts'
import { sampleVisualArchive } from '../src/lib/archive-scale.mjs'

let checks = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks += 1 }

eq(compareSlugsFromSearch(''), [], 'بلا مقارنة')
eq(compareSlugsFromSearch('?cat=x'), [])
eq(compareSlugsFromSearch('?compare=a,b'), ['a', 'b'])
eq(compareSlugsFromSearch('?compare=a'), ['a'])
eq(compareSlugsFromSearch('?compare=a,,b,c'), ['a', 'b'], 'حتى نجمتين وتُتجاهل الفراغات')
eq(compareSlugsFromSearch('?compare=%D8%A3,b'), ['أ', 'b'], 'يُفكّ الترميز')

const known = new Map([['a', 3], ['b', 7]])
const indexOf = (slug) => known.get(slug)
eq(resolveCompare(['a', 'b'], indexOf, false), { picked: [3, 7], done: true }, 'كلها موجودة')
eq(resolveCompare(['a', 'b'], indexOf, true), { picked: [3, 7], done: true }, 'كلها موجودة أثناء التحميل: لا انتظار')
eq(resolveCompare(['a', 'late'], indexOf, true), { picked: [3], done: false }, 'slug لم يصل بعد والمحتوى يُحمَّل: لا اعتماد ولا مسح من الرابط')
eq(resolveCompare(['a', 'late'], indexOf, false), { picked: [3], done: true }, 'انتهى التحميل: يُسقَط ما لا وجود له وحده')
eq(resolveCompare(['nope'], indexOf, false), { picked: [], done: true }, 'slug غير موجود بعد التحميل يُتجاهل')
eq(resolveCompare(['nope'], indexOf, true), { picked: [], done: false }, 'وأثناء التحميل ينتظر')
eq(resolveCompare([], indexOf, true), { picked: [], done: true }, 'بلا مقارنة: يُعتمد فوراً')

/* التثبيت: slug المقارنة يبقى في العيّنة حتى لو تجاوز الأرشيف الميزانية */
const articles = Array.from({ length: 2400 }, (_, i) => ({ slug: `s-${i}`, cat: `c${i % 7}`, iso: `20${10 + (i % 15)}-01-01` }))
const sample = (pins) => sampleVisualArchive(articles, 1600, { keyOf: (a) => a.slug, groupOf: (a) => `${a.cat}|${a.iso.slice(0, 4)}`, pinKeys: pins })
const unpinned = sample([])
const missing = articles.find((a) => !unpinned.some((x) => x.slug === a.slug))
assert.ok(missing, 'الأرشيف أكبر من الميزانية فثمّة مقال خارج العيّنة'); checks += 1
assert.ok(sample([missing.slug, 's-1']).some((a) => a.slug === missing.slug), 'المثبَّت داخل العيّنة'); checks += 1
console.log(`✓ مقارنة سماء المقالات: ${checks} فحصاً`)
