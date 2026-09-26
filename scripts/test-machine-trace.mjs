#!/usr/bin/env node
/**
 * «أثر الآلة» يحرس الحَكَم من خدعته الكبرى: المحاكي الجيد كان ينال ٩٢٪ ويعبر
 * ٩٤٪ منه — أعلى من الدكتور نفسه. هذا الاختبار يثبّت ما بلغناه على ٦٤ نصاً آلياً
 * مرجعياً (scripts/fixtures/style-machine-texts.json) فلا يتراجع بصمت.
 *
 * يُقاس كما يقيس الاستوديو: البصمة من الأرشيف **المؤرّخ** مرجّحةً بالحقبة، فالمقصود
 * صوته اليوم. الإصدار ٣ (٢٤ سبتمبر ٢٠٢٦) كفّ عن معاقبة مقالاته الحديثة: كان الإصدار ٢
 * يرتاب في اثنين من مقالاته الأربعة عشر في ٢٠٢٦ ويعطيها وسيط ٨٢.
 *
 * ملاحظة صادقة: النموذج دُرّب على هذه النصوص نفسها، فأرقامها هنا متفائلة؛ الأداء
 * على مجموعةٍ لم يرها يُقاس بـ scripts/train-machine-trace.mjs (AUC ٠٫٩١–١٫٠٠).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const S = await import(resolve(root, 'src/lib/style-dna.mjs'))
const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const dataSource = readFileSync(resolve(root, 'src/data.ts'), 'utf8')
const isoBySlug = new Map([...dataSource.matchAll(/slug:\s*'([^']+)'[^}]*?iso:\s*'([0-9-]+)'/g)].map((match) => [match[1], match[2]]))
const archive = Object.entries(bodies)
  .filter(([, body]) => typeof body === 'string' && body.trim().length > 200)
  .map(([slug, body]) => ({ slug, body, iso: isoBySlug.get(slug) || '' }))
assert.ok(archive.filter((item) => item.iso).length >= 140, 'الأرشيف مؤرّخ كما في الاستوديو')
const dna = S.measureStyleDna(archive)
const orthography = S.buildOrthographyIndex(archive.map((item) => item.body))
const calibration = S.calibrateStyle(archive, dna, { orthography })
const machine = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/style-machine-texts.json'), 'utf8')).texts
assert.equal(machine.length, 64, 'المجموعة المرجعية كاملة')

const judge = (body) => S.judgeStyle(body, dna, { orthography, threshold: calibration.threshold })
const recent = archive.filter((item) => item.iso >= '2025-01-01').map((item) => ({ ...item, verdict: judge(item.body) }))
const latest = recent.filter((item) => item.iso >= '2026-01-01')
const generic = machine.filter((item) => item.mode === 'generic').map((item) => judge(item.body))
const imitate = machine.filter((item) => item.mode === 'imitate').map((item) => judge(item.body))
const studio = machine.filter((item) => item.mode === 'studio').map((item) => judge(item.body))
assert.equal(studio.length, 32, 'ومسودات الاستوديو الاثنتان والثلاثون حاضرة')
const rate = (list) => list.filter((verdict) => verdict.ready).length / list.length
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
const flaggedOf = (list) => list.filter((verdict) => verdict.machineProbability >= S.MACHINE_TRACE.threshold)

/* ١) صوته اليوم لا يُتّهم: لا مقالَ له منذ ٢٠٢٥ فوق العتبة، ووسيط ٢٠٢٦ مرتفع. */
assert.equal(flaggedOf(recent.map((item) => item.verdict)).length, 0, `لا مقالَ له منذ ٢٠٢٥ يُتّهم بأثر الآلة (${flaggedOf(recent.map((item) => item.verdict)).length}/${recent.length})`)
const latestMedian = median(latest.map((item) => item.verdict.score))
assert.ok(latestMedian >= 88, `مقالاته في ٢٠٢٦ تُنصَف (وسيط ${latestMedian}؛ كان ٨٢)`)

/* ٢) والآلة لا تعبر. */
assert.equal(rate(generic), 0, 'لا نص آلي بأسلوب النموذج المعتاد يُعدّ جاهزاً')
assert.ok(rate(studio) <= .15, `ومسودات الاستوديو بتعليماته الفعلية لا تعبر إلا نادراً (${Math.round(rate(studio) * 100)}٪؛ كانت ٤١٪)`)
/* المحاكاة المرجعية كُتبت على أسلوبه قبل ٢٠٢٥ (وقفاتٌ كثيفة)، وهو أسلوبه حقاً في
   حقبته؛ الحَكَم لا يعاقب حقبةً من كتابته. ما يمنع الكاتب منها هو الوصفة (مدى الوقفات
   ٤–٨) والحَكَم الأعمى، لا هذا المقياس. */
assert.ok(rate(imitate) <= .5, `المحاكاة المتعمّدة لأسلوبه القديم لا تعبر إلا دون النصف (${Math.round(rate(imitate) * 100)}٪؛ كانت ٩٤٪)`)

/* ٣) مؤشر الطبيعية يفصل صوته اليوم عن الآلة. */
const auc = (positive, negative) => { let sum = 0; for (const p of positive) for (const n of negative) sum += p > n ? 1 : p === n ? .5 : 0; return sum / (positive.length * negative.length) }
const natural = (verdict) => S.naturalnessScore(verdict)
const recentNatural = recent.map((item) => natural(item.verdict))
assert.ok(auc(recentNatural, generic.map(natural)) >= .95, 'الطبيعية تفصل مقالاته الحديثة عن النص الآلي المعتاد')
assert.ok(auc(recentNatural, studio.map(natural)) >= .9, `وعن مسودات الاستوديو (AUC ${auc(recentNatural, studio.map(natural)).toFixed(3)})`)

/* ٤) كل حكمٍ بأثر آلة يحمل أوامر تصحيح محددة، و«عادته» فيها وسيطه هو لا متوسطٌ مختلط. */
const flagged = flaggedOf([...generic, ...imitate, ...studio])
assert.ok(flagged.length >= 45, `أثر الآلة يرصد معظم النصوص الآلية (${flagged.length}/64)`)
assert.ok(flagged.every((verdict) => verdict.corrections.some((line) => line.includes('يشبه نصّ آلةٍ'))), 'ومعه أمر تصحيح بالعادات الخفية')
assert.ok(!flagged.some((verdict) => verdict.corrections.some((line) => line.includes('اختم نحو نصف فقراتك'))), 'ولا يأمر بعادةٍ تركها (الفقرة المختومة بـ«…»)')

/* ٥) الحدّ يُطبَّق بالدقة التي يُعرض بها: ما يُعرض فوق الحدّ القوي مسقوفٌ وغير جاهز. */
const strong = [...recent.map((item) => item.verdict), ...generic, ...imitate, ...studio].filter((verdict) => verdict.machineProbability >= S.MACHINE_TRACE.strong)
assert.ok(strong.every((verdict) => verdict.score <= 74 && !verdict.ready), 'كل ما يُعرض فوق الحدّ القوي مسقوفٌ وغير جاهز')

console.log(`أثر الآلة ٣: مقالاته منذ ٢٠٢٥ بلا اتهام (0/${recent.length}) ووسيط ٢٠٢٦ ${latestMedian} · مسودات الاستوديو ${Math.round(rate(studio) * 100)}٪ · النص الآلي ${Math.round(rate(generic) * 100)}٪ · المحاكاة القديمة ${Math.round(rate(imitate) * 100)}٪ · رُصد ${flagged.length}/64 ✓`)
