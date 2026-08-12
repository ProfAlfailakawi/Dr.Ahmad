#!/usr/bin/env node
/**
 * حارس الهوية البصرية — أربعة مصادر تقول الشيء نفسه أو يسقط البناء.
 *
 * الهوية مكتوبةٌ في أربعة مواضع، لكلٍّ منها سببه:
 *   ١) `src/index.css`            — التطبيق على الموقع (متغيّرات CSS)
 *   ٢) `tailwind.config.js`       — سلّم نصف القطر وعرض القشرة والخطوط
 *   ٣) `src/lib/design-system.ts` — للأدوات التي ترسم خارج DOM (الاستوديو)
 *   ٤) `DESIGN.md`                — للإنسان وللوكيل الذكيّ
 *
 * وحين تُكتب الهوية أربع مرّات فإنها تنحرف — وقد انحرفت فعلاً: لوحتا الهوية
 * في الاستوديو كانتا تقريباً لا مطابقة. هذا الحارس يجعل الانحراف مستحيلاً:
 * يقرأ الأرقام من المصادر الأربعة ويقارنها حرفاً بحرف.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')

const failures = []
const fail = (message) => failures.push(message)

for (const file of ['src/index.css', 'tailwind.config.js', 'src/lib/design-system.ts', 'DESIGN.md']) {
  if (!existsSync(join(ROOT, file))) fail(`مصدر الهوية مفقود: ${file}`)
}
if (failures.length) {
  for (const message of failures) console.error(`✘ ${message}`)
  process.exit(1)
}

const css = read('src/index.css')
const tailwind = read('tailwind.config.js')
const system = read('src/lib/design-system.ts')
const doc = read('DESIGN.md')

/* ── ١) قنوات RGB في CSS ⇄ HEX في design-system.ts ── */
const channelsToHex = (channels) => `#${channels.trim().split(/\s+/)
  .map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

/** يقرأ متغيّراً من كتلةٍ محدّدة (‎:root‎ أو ‎html.dark‎) لا من الملف كلّه. */
function cssBlock(selector) {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = css.indexOf('\n}', start)
  return end < 0 ? '' : css.slice(start, end)
}

function cssVar(block, name) {
  const match = block.match(new RegExp(`--c-${name}:\\s*([^;]+);`))
  return match ? match[1].trim() : ''
}

const TOKENS = ['canvas', 'ink', 'soft', 'accent', 'accent-deep', 'wash']
const SYSTEM_KEYS = { canvas: 'canvas', ink: 'ink', soft: 'soft', accent: 'accent', 'accent-deep': 'accentDeep', wash: 'wash' }

function systemRaw(constName) {
  const match = system.match(new RegExp(`const ${constName} = \\{([^}]+)\\}`))
  return match ? match[1] : ''
}

for (const [selector, constName, label] of [[':root', 'LIGHT_RAW', 'النهار'], ['html.dark', 'DARK_RAW', 'الليل']]) {
  const block = cssBlock(selector)
  const raw = systemRaw(constName)
  if (!block) { fail(`تعذّرت قراءة كتلة ${selector} من index.css`); continue }
  if (!raw) { fail(`تعذّرت قراءة ${constName} من design-system.ts`); continue }
  for (const token of TOKENS) {
    const channels = cssVar(block, token)
    if (!channels) { fail(`المتغيّر --c-${token} مفقود في ${selector}`); continue }
    const fromCss = channelsToHex(channels)
    const key = SYSTEM_KEYS[token]
    const match = raw.match(new RegExp(`${key}:\\s*'(#[0-9A-Fa-f]{6})'`))
    if (!match) { fail(`${constName}.${key} مفقود في design-system.ts`); continue }
    const fromSystem = match[1].toUpperCase()
    if (fromCss !== fromSystem) {
      fail(`انحراف الهوية (${label}) في «${token}»: index.css يقول ${fromCss} و design-system.ts يقول ${fromSystem}`)
    }
    if (!doc.includes(fromCss)) {
      fail(`انحراف الهوية (${label}) في «${token}»: ${fromCss} غير مذكور في DESIGN.md`)
    }
  }
}

/* ── ٢) شفافية الحدّ الشعريّ ── */
for (const [selector, mode] of [[':root', 'light'], ['html.dark', 'dark']]) {
  const block = cssBlock(selector)
  const alpha = block.match(/--c-hair:\s*rgba\([^)]*?,\s*([0-9.]+)\s*\)/)?.[1]
  const declared = system.match(new RegExp(`${mode}:\\s*([0-9.]+)`))?.[1]
  if (!alpha || !declared) { fail(`تعذّرت قراءة شفافية --c-hair (${mode})`); continue }
  if (Number(alpha) !== Number(declared)) {
    fail(`شفافية الحدّ الشعريّ (${mode}): index.css ${alpha} مقابل design-system.ts ${declared}`)
  }
}

/* ── ٣) سلّم نصف القطر وعرض القشرة ── */
const radiusFromTailwind = Object.fromEntries(
  [...(tailwind.match(/borderRadius:\s*\{([^}]+)\}/)?.[1] || '').matchAll(/'?([a-z0-9]+)'?:\s*'(\d+)px'/g)]
    .map((match) => [match[1], Number(match[2])]),
)
const radiusFromSystem = Object.fromEntries(
  [...(system.match(/export const RADIUS = \{([^}]+)\}/)?.[1] || '').matchAll(/([a-z]+):\s*(\d+)/g)]
    .map((match) => [match[1], Number(match[2])]),
)
const RADIUS_PAIRS = [['lg', 'sm'], ['xl', 'md'], ['2xl', 'lg'], ['3xl', 'xl']]
for (const [tailwindKey, systemKey] of RADIUS_PAIRS) {
  if (radiusFromTailwind[tailwindKey] === undefined) { fail(`نصف القطر ${tailwindKey} مفقود في tailwind.config.js`); continue }
  if (radiusFromSystem[systemKey] === undefined) { fail(`RADIUS.${systemKey} مفقود في design-system.ts`); continue }
  if (radiusFromTailwind[tailwindKey] !== radiusFromSystem[systemKey]) {
    fail(`سلّم نصف القطر: tailwind ${tailwindKey}=${radiusFromTailwind[tailwindKey]}px مقابل RADIUS.${systemKey}=${radiusFromSystem[systemKey]}`)
  }
}

const shellFromTailwind = Number(tailwind.match(/shell:\s*'(\d+)px'/)?.[1] || 0)
const shellFromSystem = Number(system.match(/SHELL_MAX_WIDTH = (\d+)/)?.[1] || 0)
if (shellFromTailwind !== shellFromSystem) {
  fail(`عرض القشرة: tailwind ${shellFromTailwind}px مقابل design-system ${shellFromSystem}px`)
}

/* ── ٤) لوحتا الهوية في الاستوديو مشتقّتان لا مكتوبتين ── */
const engine = read('src/lib/social-design-engine.ts')
for (const [id, token] of [['brand-paper', 'LIGHT'], ['brand-night', 'DARK']]) {
  const line = engine.split(/\r?\n/).find((row) => row.includes(`'${id}':`)) || ''
  if (!line) { fail(`لوحة ${id} مفقودة من الاستوديو`); continue }
  if (/#[0-9A-Fa-f]{6}/.test(line)) {
    fail(`لوحة ${id} تكتب ألواناً حرفية — يجب أن تُشتقّ من ${token} في design-system.ts`)
  }
  if (!line.includes(`${token}.canvas`) || !line.includes(`${token}.ink`) || !line.includes(`${token}.accent`)) {
    fail(`لوحة ${id} لا تشتقّ من ${token} في design-system.ts`)
  }
}

/* ── ٥) الخطوط ── */
if (!tailwind.includes('"El Messiri"') || !system.includes("display: 'El Messiri'")) fail('خطّ العناوين غير متطابق بين tailwind و design-system')
if (!tailwind.includes('"Tajawal"') || !system.includes("body: 'Tajawal'")) fail('خطّ المتن غير متطابق بين tailwind و design-system')

if (failures.length) {
  console.error('✘ حارس الهوية البصرية — انحرافٌ بين مصادر الهوية:')
  for (const message of failures) console.error(`   • ${message}`)
  console.error('\n  الهوية تُكتب مرّةً في src/lib/design-system.ts و src/index.css، وتُشرح في DESIGN.md.')
  process.exit(1)
}

console.log('✔ حارس الهوية: index.css و tailwind.config.js و design-system.ts و DESIGN.md متطابقة · لوحتا الاستوديو مشتقّتان')
