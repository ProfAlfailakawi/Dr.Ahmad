#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
if (!existsSync(DIST)) throw new Error('dist مفقود — شغّل البناء أولاً')

const htmlFiles = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const file = resolve(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (name.endsWith('.html')) htmlFiles.push(file)
  }
}
walk(DIST)

const ignored = /^(?:#|mailto:|tel:|data:|javascript:|https?:\/\/|\/api\/|\/_share\/)/i
const checked = new Set()
const broken = []

function existsFor(pathname) {
  const clean = decodeURIComponent(pathname.split(/[?#]/)[0]).replace(/^\/+/, '')
  if (!clean) return existsSync(resolve(DIST, 'index.html'))
  const direct = resolve(DIST, clean)
  if (existsSync(direct) && statSync(direct).isFile()) return true
  if (existsSync(resolve(direct, 'index.html'))) return true
  if (!extname(clean) && existsSync(resolve(DIST, `${clean}.html`))) return true
  return false
}

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8')
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const value = match[1].trim()
    if (!value || ignored.test(value)) continue
    const pathname = value.startsWith('/') ? value : `/${value}`
    const key = pathname.split(/[?#]/)[0]
    if (checked.has(key)) continue
    checked.add(key)
    if (!existsFor(pathname)) broken.push({ pathname, from: file.replace(`${DIST}/`, '') })
  }
}

if (broken.length) {
  broken.slice(0, 30).forEach((item) => console.error(`✘ ${item.pathname} ← ${item.from}`))
  throw new Error(`${broken.length} رابطاً داخلياً مكسوراً في النسخة المبنية`)
}
console.log(`✓ الروابط الداخلية: ${checked.size} رابطاً في ${htmlFiles.length} صفحة — بلا كسر`)
