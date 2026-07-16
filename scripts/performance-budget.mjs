#!/usr/bin/env node
/** حارس خفيف لميزانية الأداء؛ يمنع رجوع الحزمة الرئيسية إلى ملف ضخم واحد. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')
const index = readFileSync(resolve(DIST, 'index.html'), 'utf8')
const source = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(index)?.[1]
if (!source) { console.error('✘ performance: لم أجد حزمة الدخول'); process.exit(1) }
const entry = resolve(DIST, source.replace(/^\//, ''))
if (!existsSync(entry)) { console.error(`✘ performance: حزمة الدخول مفقودة ${source}`); process.exit(1) }
const entryBytes = statSync(entry).size
if (entryBytes > 520_000) { console.error(`✘ performance: حزمة الدخول ${Math.round(entryBytes / 1024)}KB؛ تجاوزت 520KB`); process.exit(1) }

const assets = resolve(DIST, 'assets')
const js = readdirSync(assets).filter((name) => name.endsWith('.js')).map((name) => statSync(resolve(assets, name)).size)
if (js.length < 8) { console.error(`✘ performance: تقسيم الكود غير كافٍ (${js.length} حزم فقط)`); process.exit(1) }
if (!index.includes('/portrait.webp')) { console.error('✘ performance: صورة LCP ليست WebP'); process.exit(1) }
console.log(`✔ performance: دخول ${Math.round(entryBytes / 1024)}KB · ${js.length} حزمة كسولة · LCP WebP`)
