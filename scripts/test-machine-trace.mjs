#!/usr/bin/env node
/**
 * «أثر الآلة» يحرس الحَكَم من خدعته الكبرى: المحاكي الجيد كان ينال ٩٢٪ ويعبر
 * ٩٤٪ منه — أعلى من الدكتور نفسه (٧٦٪). هذا الاختبار يثبّت ما بلغناه على ٦٤ نصاً
 * آلياً مرجعياً (scripts/fixtures/style-machine-texts.json): محاكاة، ونصٌّ آليّ
 * معتاد، ومسودات بتعليمات الاستوديو الفعلية في تخصصه — فلا يتراجع بصمت.
 * ملاحظة صادقة: النموذج دُرّب على هذه النصوص نفسها، فأرقامها هنا متفائلة؛ الأداء
 * على مجموعةٍ لم يرها يُقاس بـ scripts/train-machine-trace.mjs (AUC ٠٫٩٤–١٫٠٠).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const S = await import(resolve(root, 'src/lib/style-dna.mjs'))
const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const archive = Object.values(bodies).filter((body) => typeof body === 'string' && body.trim().length > 200)
const dna = S.measureStyleDna(archive)
const orthography = S.buildOrthographyIndex(archive)
const calibration = S.calibrateStyle(archive, dna, { orthography })
const machine = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/style-machine-texts.json'), 'utf8')).texts
assert.equal(machine.length, 64, 'المجموعة المرجعية كاملة')

const judge = (body) => S.judgeStyle(body, dna, { orthography, threshold: calibration.threshold })
const own = archive.map(judge)
const generic = machine.filter((item) => item.mode === 'generic').map((item) => judge(item.body))
const imitate = machine.filter((item) => item.mode === 'imitate').map((item) => judge(item.body))
const studio = machine.filter((item) => item.mode === 'studio').map((item) => judge(item.body))
assert.equal(studio.length, 32, 'ومسودات الاستوديو الاثنتان والثلاثون حاضرة')
const rate = (list) => list.filter((verdict) => verdict.ready).length / list.length
const auc = (positive, negative) => { let sum = 0; for (const p of positive) for (const n of negative) sum += p > n ? 1 : p === n ? .5 : 0; return sum / (positive.length * negative.length) }
const natural = (verdict) => S.naturalnessScore(verdict)

assert.equal(rate(generic), 0, 'لا نص آلي بأسلوب النموذج المعتاد يُعدّ جاهزاً')
assert.ok(rate(imitate) <= .2, `المحاكاة المتعمّدة لا تعبر إلا قليلاً (${Math.round(rate(imitate) * 100)}٪؛ كانت ٩٤٪)`)
/* الإصدار ١ عبرته ١٣ من هذه الـ٣٢ «جاهزة» لأنه لم يرَ مسودات الاستوديو قط. */
assert.ok(rate(studio) <= .1, `ومسودات الاستوديو بتعليماته الفعلية لا تعبر إلا نادراً (${Math.round(rate(studio) * 100)}٪؛ كانت ٤١٪)`)
assert.ok(rate(own) >= .7, `ومقالاته هو تعبر كما كانت (${Math.round(rate(own) * 100)}٪)`)
const naturalImitate = auc(own.map(natural), imitate.map(natural))
/* ٠٫٩٣١ في الإصدار ١ على ١٦ محاكاة كان يُقاس على ما دُرّب عليه وحده؛ الإصدار ٢ يوزّع
   قدرته على ٦٤ نصاً فيصير ٠٫٨٩٩ هنا و٠٫٩٦١ على مسودات الاستوديو. */
assert.ok(naturalImitate >= .88, `مؤشر الطبيعية يفصل مقالاته عن المحاكاة (AUC ${naturalImitate.toFixed(3)}؛ كان ٠٫٣٥)`)
assert.ok(auc(own.map(natural), generic.map(natural)) >= .95, 'ويفصلها عن النص الآلي المعتاد')
assert.ok(auc(own.map(natural), studio.map(natural)) >= .93, 'وعن مسودات الاستوديو')

/* كل حكمٍ بأثر آلة يحمل أوامر تصحيح محددة يستطيع الكاتب الآلي تنفيذها. */
const flagged = [...generic, ...imitate, ...studio].filter((verdict) => verdict.machineProbability >= S.MACHINE_TRACE.threshold)
assert.ok(flagged.length >= 55, `أثر الآلة يرصد معظم النصوص الآلية (${flagged.length}/64)`)
assert.ok(flagged.every((verdict) => verdict.corrections.some((line) => line.includes('يشبه نصّ آلةٍ'))), 'ومعه أمر تصحيح بالعادات الخفية')
/* الحدّ يُطبَّق بالدقة التي يُعرض بها: ما يُعرض ≥٨٥٪ يُسقف عند ٧٤ فعلاً. */
const strong = [...own, ...generic, ...imitate, ...studio].filter((verdict) => verdict.machineProbability >= S.MACHINE_TRACE.strong)
assert.ok(strong.every((verdict) => verdict.score <= 74 && !verdict.ready), 'كل ما يُعرض فوق الحدّ القوي مسقوفٌ وغير جاهز')

console.log(`أثر الآلة ٢: المحاكاة الجاهزة ${Math.round(rate(imitate) * 100)}٪ (كانت ٩٤٪) · مسودات الاستوديو ${Math.round(rate(studio) * 100)}٪ (كانت ٤١٪) · مقالاته ${Math.round(rate(own) * 100)}٪ · AUC الطبيعية مع المحاكاة ${naturalImitate.toFixed(3)} ✓`)
