#!/usr/bin/env node
/**
 * «أثر الآلة» يحرس الحَكَم من خدعته الكبرى: المحاكي الجيد كان ينال ٩٢٪ ويعبر
 * ٩٤٪ منه — أعلى من الدكتور نفسه (٧٦٪). هذا الاختبار يثبّت ما بلغناه على ٣٢ نصاً
 * آلياً مرجعياً (scripts/fixtures/style-machine-texts.json) فلا يتراجع بصمت.
 * ملاحظة صادقة: النموذج دُرّب على هذه النصوص نفسها، فأرقامها هنا متفائلة؛ الأداء
 * على نصوصٍ لم يرها يُقاس بـ scripts/train-machine-trace.mjs (٠٫٨٧–٠٫٩٢).
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
assert.equal(machine.length, 32, 'المجموعة المرجعية كاملة')

const judge = (body) => S.judgeStyle(body, dna, { orthography, threshold: calibration.threshold })
const own = archive.map(judge)
const generic = machine.filter((item) => item.mode === 'generic').map((item) => judge(item.body))
const imitate = machine.filter((item) => item.mode === 'imitate').map((item) => judge(item.body))
const rate = (list) => list.filter((verdict) => verdict.ready).length / list.length
const auc = (positive, negative) => { let sum = 0; for (const p of positive) for (const n of negative) sum += p > n ? 1 : p === n ? .5 : 0; return sum / (positive.length * negative.length) }
const natural = (verdict) => S.naturalnessScore(verdict)

assert.equal(rate(generic), 0, 'لا نص آلي بأسلوب النموذج المعتاد يُعدّ جاهزاً')
assert.ok(rate(imitate) <= .35, `المحاكاة المتعمّدة لا تعبر إلا قليلاً (${Math.round(rate(imitate) * 100)}٪؛ كانت ٩٤٪)`)
assert.ok(rate(own) >= .7, `ومقالاته هو تعبر كما كانت (${Math.round(rate(own) * 100)}٪)`)
const naturalImitate = auc(own.map(natural), imitate.map(natural))
assert.ok(naturalImitate >= .9, `مؤشر الطبيعية يفصل مقالاته عن المحاكاة (AUC ${naturalImitate.toFixed(3)}؛ كان ٠٫٣٥)`)
assert.ok(auc(own.map(natural), generic.map(natural)) >= .95, 'ويفصلها عن النص الآلي المعتاد')

/* كل حكمٍ بأثر آلة يحمل أوامر تصحيح محددة يستطيع الكاتب الآلي تنفيذها. */
const flagged = [...generic, ...imitate].filter((verdict) => verdict.machineProbability >= S.MACHINE_TRACE.threshold)
assert.ok(flagged.length >= 20, `أثر الآلة يرصد معظم النصوص الآلية (${flagged.length}/32)`)
assert.ok(flagged.every((verdict) => verdict.corrections.some((line) => line.includes('يشبه نصّ آلةٍ'))), 'ومعه أمر تصحيح بالعادات الخفية')

console.log(`أثر الآلة: المحاكاة الجاهزة ${Math.round(rate(imitate) * 100)}٪ (كانت ٩٤٪) · مقالاته ${Math.round(rate(own) * 100)}٪ · AUC الطبيعية مع المحاكاة ${naturalImitate.toFixed(3)} ✓`)
