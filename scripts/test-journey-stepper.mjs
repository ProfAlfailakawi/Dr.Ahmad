#!/usr/bin/env node
/**
 * حارس «رحلة المحطّات» — منطقٌ خالص + إخراج الخادم، بلا أي اعتماديةٍ جديدة.
 *
 * ١) src/lib/journey-logic.ts: الهدف الصادق، الحالة المعروضة، بوابة الخيط، العتبة،
 *    وذاكرة «عُرض مرةً» (play once) بتخزينٍ وهمي، بما فيه تخزينٌ يرمي (التصفح الخاص).
 * ٢) JourneyStepper.tsx يُحوَّل بـtypescript ويُعرض بـreact-dom/server: الحالة الأولى هي
 *    النهائية كاملة (لا data-just ولا إخفاء)، والخيط لا يُملأ نحو محطةٍ فارغة، ولقارئ الشاشة
 *    حالةٌ حقيقية حتى في النمط الكامل.
 *
 * سلوك الخطّاف نفسه (تقليل الحركة، StrictMode، إعادة التسلّح عند تغيّر playKey) يحتاج متصفحاً:
 * scripts/test-journey-stepper-browser.mjs (اختياري، لا يدخل في البناء).
 */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as logic from '../src/lib/journey-logic.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let checks = 0
const ok = (cond, msg) => { assert.ok(cond, msg); checks += 1 }
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks += 1 }

/* ── ١) المنطق الخالص ── */
const { journeyStepMs, journeyTarget, shownState, linkFilled, effectiveThreshold, createPlayedStore } = logic
eq([journeyStepMs(1), journeyStepMs(4), journeyStepMs(5), journeyStepMs(20)], [750, 750, 750, 350], 'stepMs محصور بين 350 و750')
ok(journeyStepMs(8) * 8 <= 4100, 'المجموع ≈ 4 ثوانٍ لثماني محطات')
eq(journeyTarget([]), 0)
eq(journeyTarget(['pending', 'pending']), 0, 'لا تقدّم = لا إضاءة')
eq(journeyTarget(['done', 'done', 'current', 'pending', 'pending']), 3, 'حتى الجارية فقط')
eq(journeyTarget(['current', 'pending', 'done', 'pending']), 3, 'غير متصل: حتى آخر منجزة')

const real = ['done', 'done', 'current', 'pending', 'pending']
const view = (lit) => real.map((state, i) => shownState(state, i, lit))
eq(view(null), real, 'null = الحقيقية')
eq(view(0), ['pending', 'pending', 'pending', 'pending', 'pending'], 'بداية المقدّمة بلا وميض')
eq(view(2), ['done', 'done', 'pending', 'pending', 'pending'])
for (let lit = 0; lit <= 5; lit += 1) {
  view(lit).forEach((shown, i) => { if (real[i] === 'pending') ok(shown === 'pending', 'محطة لم تُنجز لا تُملأ أبداً') })
}
eq(real.map((_, i) => linkFilled(view(null), i)), [true, true, false, false, false], 'الخيط حتى الجارية ولا يتعدّاها')
eq(real.map((_, i) => linkFilled(view(1), i)), [false, false, false, false, false], 'لا خيط قبل وصول المحطة التالية')
eq(real.map((_, i) => linkFilled(view(2), i)), [true, false, false, false, false], 'الخيط يصل مع المحطة التي يؤدّي إليها')
const gap = ['current', 'pending', 'done', 'pending']
eq(gap.map((_, i) => linkFilled(gap, i)), [false, false, false, false], 'تقدّمٌ غير متصل: لا خيطٌ ملوّن نحو محطةٍ فارغة')
eq(linkFilled(['done'], 0), false, 'آخر محطة بلا خيط')
eq(effectiveThreshold(0.9, 100, 800), 0.9)
ok(effectiveThreshold(0.9, 4000, 800) < 0.2 && effectiveThreshold(0.9, 1e9, 800) === 0.05, 'العتبة تُنزَّل إلى الممكن')

/* play once: Set في الوحدة + تخزين الجلسة */
const mem = new Map()
const fake = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, v) } }
const a = createPlayedStore(() => fake)
ok(!a.has('k') && !a.has(undefined), 'لم يُعرض بعد')
a.mark('k'); ok(a.has('k'), 'عُرض في هذه الذاكرة')
ok(createPlayedStore(() => fake).has('k'), 'وبعد إعادة تحميل الوحدة يُقرأ من تخزين الجلسة (لا إعادة)')
ok(!a.has('other'), 'مفتاحٌ آخر يُعرض من جديد (إعادة التسلّح عند تغيّر playKey)')
const throwing = () => { throw new Error('denied') }
const b = createPlayedStore(throwing)
ok(!b.has('x'), 'تخزينٌ يرمي: لا يكسر'); b.mark('x'); ok(b.has('x'), 'ويبقى الـSet يكفي داخل الجلسة')

/* ── ٢) إخراج الخادم ── */
const dir = resolve(ROOT, 'node_modules/.cache/journey-test')
mkdirSync(dir, { recursive: true })
try {
  const src = readFileSync(resolve(ROOT, 'src/components/JourneyStepper.tsx'), 'utf8')
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    .replace("'../lib/journey-logic.ts'", JSON.stringify(pathToFileURL(resolve(ROOT, 'src/lib/journey-logic.ts')).href))
  const file = resolve(dir, 'JourneyStepper.mjs')
  writeFileSync(file, out)
  const { JourneyStepper } = await import(pathToFileURL(file).href)

  const steps = [
    { key: 'a', label: 'أولى', state: 'done' },
    { key: 'b', label: 'ثانية', state: 'done' },
    { key: 'c', label: 'ثالثة', state: 'current' },
    { key: 'd', label: 'رابعة', state: 'pending' },
  ]
  const html = renderToStaticMarkup(h(JourneyStepper, { steps, variant: 'strip', label: 'تقدّمك', playKey: 't' }))
  ok(html.includes('data-reveal="done"'), 'الإخراج الأول نهائيّ لا مخفيّ')
  ok(!html.includes('data-just') && !html.includes('data-last'), 'لا هالة في الإخراج الأول')
  ok((html.match(/data-link="on"/g) || []).length === 2, 'خيطان فقط: نحو المنجزة والجارية')
  ok(html.includes('aria-current="step"') && html.includes('aria-label="تقدّمك"'), 'aria-current وaria-label حقيقيّان')
  ok(html.includes('3. ثالثة — الحالية') && html.includes('4. رابعة — لم تُنجز بعد'), 'نصّ حالةٍ حقيقيّ لقارئ الشاشة')

  const gapHtml = renderToStaticMarkup(h(JourneyStepper, { steps: [
    { key: 'a', label: 'أ', state: 'current' }, { key: 'b', label: 'ب', state: 'pending' }, { key: 'c', label: 'ج', state: 'done' }, { key: 'd', label: 'د', state: 'pending' },
  ], variant: 'dots', decorative: true }))
  ok(!gapHtml.includes('data-link') && gapHtml.includes('aria-hidden="true"') && !gapHtml.includes('sr-only'), 'غير متصل: بلا خيط، وزخرفيّ مخفيّ عن القارئ')

  const full = renderToStaticMarkup(h(JourneyStepper, { steps: steps.map((s) => ({ ...s, state: 'done' })), variant: 'full', label: 'مراحل', stateText: { done: 'مرحلة' } }))
  ok(full.includes('aria-label="مراحل"') && (full.match(/ — مرحلة/g) || []).length === 4, 'النمط الكامل: aria-label ونصّ حالةٍ لكل محطة')
  const plain = renderToStaticMarkup(h(JourneyStepper, { steps, variant: 'full', label: 'م' }))
  ok(plain.includes(' — أُنجزت') && plain.includes(' — الحالية') && plain.includes(' — لم تُنجز بعد'), 'النصوص الافتراضية للحالات الثلاث')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

/* ── ٣) CSS: اتجاه الامتلاء بمتغيّرٍ موروث لا بـ:dir() (المُصغِّر يخفضه إلى :lang() خاطئة) ── */
const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8')
const block = css.slice(css.indexOf('/* ── رحلة المحطّات'), css.indexOf('/* ── لحظة الجلاء')).replace(/\/\*[\s\S]*?\*\//g, '')
ok(block.length > 1000, 'كتلة .journey موجودة في index.css')
ok(!/:dir\(/.test(block), 'لا :dir() داخل كتلة الرحلة')
ok(/\[dir="ltr"\]\s*\{\s*--journey-origin-x:\s*left/.test(block) && /\[dir="rtl"\]\s*\{\s*--journey-origin-x:\s*right/.test(block), 'dir=ltr/rtl يضبطان أصل التحويل')
ok(!/rgba?\(\s*\d|#[0-9a-f]{3,8}\b/i.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), 'لا ألوان حرفية داخل الكتلة')

console.log(`✓ رحلة المحطّات: ${checks} فحصاً (منطق خالص + إخراج الخادم)`)
