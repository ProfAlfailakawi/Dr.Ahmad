#!/usr/bin/env node
/**
 * قاعدة السمة: «النهار هو الأصل دائماً، والليل فقط إن بدّله الزائر بنفسه».
 * تفضيل جهاز الزائر (prefers-color-scheme: dark) يجب ألا يتسرّب إلى الموقع بأيّ طريق:
 * لا في boot.js قبل أوّل رسم، ولا في المبدّل، ولا في القارئ، ولا في صور إقلاع iOS، ولا في CSS.
 * (السلوك الحيّ يُفحص في المتصفح: scripts/test-day-default-browser.mjs، اختياري.)
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8')
let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1 }
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const boot = read('public/boot.js')
const html = read('index.html')
const extras = read('src/components/extras.tsx')
const reader = read('src/components/ArticleReader.tsx')
const toggle = extras.slice(extras.indexOf('export function ThemeToggle'), extras.indexOf('export function ThemeToggle') + 3600)

/* boot.js: النهار ما لم يوجد اختيار صريح dark */
ok(/applyTheme\(readThemeChoice\(\) === 'dark'\)/.test(boot), 'boot.js: الليل فقط باختيار صريح')
ok(!/prefers-color-scheme/.test(code(boot)), 'boot.js لا يذكر prefers-color-scheme في الشيفرة')
ok(!/localStorage\.setItem\(THEME_LEGACY_KEY, dark/.test(boot), 'boot.js لا يكتب سمة الجهاز في المفتاح القديم')
ok(!/system-changed/.test(boot), 'لا متابعة حيّة لتغيّر الجهاز')

/* index.html: بلا صور إقلاع «داكنة» تُختار بتفضيل الجهاز، ولا meta لونٍ داكن */
ok(!/prefers-color-scheme/.test(html), 'index.html بلا media بتفضيل الألوان (صور إقلاع iOS نهارية فقط)')
ok(/<meta name="theme-color" content="#FCFCFA"/.test(html), 'theme-color الأصل نهاريّ')

/* المبدّل والقارئ */
ok(toggle.includes("document.documentElement.classList.contains('dark')") && !toggle.includes("localStorage.getItem('theme-choice')"), 'المبدّل يقرأ السمة الفعلية من <html> (boot.js طبّق الاختيار قبل الرسم)')
ok(!/useEffect\(\(\) => \{[\s\S]{0,900}?classList\.toggle\('dark'/.test(toggle.slice(0, toggle.indexOf('const toggle'))), 'التركيب لا يكتب صنف dark على <html> (فلا يهزم الورقي)؛ النقر فقط')
ok(!toggle.includes("localStorage.getItem('theme')"), 'المبدّل لا يقرأ المفتاح القديم')
ok(toggle.includes("localStorage.setItem('theme-choice', on ? 'dark' : 'light')"), 'الضغط على الزر يحفظ اختياراً صريحاً (نهار أو ليل)')
ok(toggle.includes("aria-label={dark ? 'الوضع النهاري' : 'الوضع الليلي'}") && toggle.includes("key={dark ? 'sun' : 'moon'}"), 'الأيقونة (شمس في الليل، قمر في النهار) والوصف يعكسان الحالة')
ok(!reader.includes("localStorage.getItem('theme')") && !reader.includes("localStorage.setItem('theme'"), 'القارئ لا يقرأ ولا يكتب مفتاح السمة')
ok(!/classList\.toggle\('dark'/.test(code(reader)), 'القارئ لا يبدّل dark')
ok(reader.includes("theme: stored.theme === 'paper' ? 'paper' : siteTheme"), 'تفضيل القارئ المحفوظ (dark/light) لا يفرض ليلاً؛ الورقي وحده')

/* لا مصدر آخر للّيل بتفضيل الجهاز في المصدر كله */
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(dir, e.name)) : /\.(css|ts|tsx|js|mjs|html)$/.test(e.name) ? [join(dir, e.name)] : [])
const offenders = [...walk(resolve(ROOT, 'src')), resolve(ROOT, 'public/boot.css')].filter((f) => /prefers-color-scheme\s*:\s*dark|matchMedia\(['"`]\(prefers-color-scheme/.test(readFileSync(f, 'utf8')))
ok(offenders.length === 0, `لا media بتفضيل الألوان في CSS/الشيفرة: ${offenders.join(', ')}`)

console.log(`✓ النهار هو الأصل ولا يتسرّب تفضيل الجهاز: ${checks} فحصاً`)
