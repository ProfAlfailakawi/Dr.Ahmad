#!/usr/bin/env node
/** فحص دخان يمنع انهيار البناء الصامت أو سقوط صفحات ديناميكية من التوليد الثابت. */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const fail = (message) => { console.error(`✘ smoke: ${message}`); process.exit(1) }
if (!existsSync(DIST)) fail('dist غير موجود')

const source = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const grab = (name) => (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) || [])[1] || ''
const articles = [...grab('articles').matchAll(/\{ slug: '([^']+)'/g)].map((match) => match[1])
const books = [...grab('books').matchAll(/\{ slug: '([^']+)'/g)].map((match) => match[1])
const researchSource = readFileSync(resolve(ROOT, 'src/data/research-papers.ts'), 'utf8')
const runtime = ts.transpileModule(researchSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/\bexport\s+/g, '')
const papers = new Function(`${runtime}; return researchPapers`)().map((paper) => paper.slug)

const expected = [
  '/', '/articles', '/publications', '/research', '/ask', '/atlas', '/cv', '/upcoming',
  ...articles.map((slug) => `/articles/${slug}`),
  ...books.map((slug) => `/publications/${slug}`),
  ...papers.map((slug) => `/research/${slug}`),
]

for (const route of expected) {
  const file = route === '/' ? resolve(DIST, 'index.html') : resolve(DIST, route.slice(1), 'index.html')
  if (!existsSync(file)) fail(`صفحة مفقودة: ${route}`)
  const html = readFileSync(file, 'utf8')
  if (!/<link[^>]+rel="canonical"/i.test(html)) fail(`canonical مفقود: ${route}`)
  if (!/<script[^>]+type="application\/ld\+json"/i.test(html)) fail(`Schema مفقود: ${route}`)
  if (!html.includes('id="root"')) fail(`جذر React مفقود: ${route}`)
}

const sitemap = readFileSync(resolve(DIST, 'sitemap.xml'), 'utf8')
for (const route of ['/articles', '/publications', '/research', '/ask', '/atlas']) {
  if (!sitemap.includes(`https://dr-alfailakawi.com${route}`)) fail(`sitemap لا يحتوي ${route}`)
}

const minimum = articles.length + books.length + papers.length + 8
if (expected.length < minimum) fail('عدد المسارات المتوقع غير منطقي')
console.log(`✔ smoke: ${expected.length} صفحة أساسية وديناميكية سليمة`)
