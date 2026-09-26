#!/usr/bin/env node
/**
 * يُعيد تدريب «أثر الآلة» (MACHINE_TRACE في src/lib/style-dna.mjs) ويقيسه بصدق.
 *
 * الاستعمال:
 *   node scripts/train-machine-trace.mjs [--keys=a,b] [--l2=3] [ملف-نصوص-آلية-إضافي.json …]
 *
 * كل ملفٍ إضافي مصفوفة {"set"?: "…", "body": "…"} (أو {texts: […]}) — أفضلها مسودات
 * الاستوديو الحقيقية (Gemini/Qwen) التي رفضها الدكتور أو علّم عليها «ليست أنا».
 *
 * «مقالاته» في التدريب مرجّحةٌ بالحقبة بالأوزان نفسها التي تُقاس بها البصمة (نصف عمرٍ
 * ستة أشهر): المطلوب تمييز الآلة عن صوته **اليوم**. الإصدار ٢ درّب على الأرشيف بلا
 * ترجيح، فتعلّم أن «الفقرة المختومة بـ«…»» علامةُ الإنسان — وهي عادته قبل ٢٠٢٢ —
 * وصار يأمر الكاتب بها ويرتاب في مقالاته الحديثة نفسها.
 *
 * يطبع: AUC بالتحقق المتقاطع ومع كل مجموعةٍ لم يرها التدريب، مقيساً على مقالاته
 * الحديثة (٢٠٢٥ فما بعد)، ونسبة الإنذار الكاذب عليها بكل حقبة، ثم سطر PARAMS.
 */
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
const dna = S.measureStyleDna(archive)
const ownWeights = S.eraWeights(archive)
const fixture = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/style-machine-texts.json'), 'utf8')).texts
const args = process.argv.slice(2)
/* --keys=a,b,c يجرّب مجموعة مقاييس غير المعتمدة دون تعديل المكتبة. */
const keysArg = args.find((arg) => arg.startsWith('--keys='))
const l2Arg = Number((args.find((arg) => arg.startsWith('--l2=')) || '').slice(5)) || 3
const extra = args.filter((arg) => !arg.startsWith('--')).flatMap((file, index) => {
  const raw = JSON.parse(readFileSync(resolve(file), 'utf8'))
  return (Array.isArray(raw) ? raw : raw.texts).map((item) => ({ ...item, set: item.set || `extra-${index + 1}` }))
})
const machine = [...fixture, ...extra].filter((item) => S.countWords(item.body) >= 120)

const KEYS = keysArg ? keysArg.slice(7).split(',') : S.MACHINE_TRACE.features.map((feature) => feature.key)
const vec = (text) => { const metrics = S.articleMetrics(text, { collective: dna.collectiveVerbs }); return KEYS.map((key) => Number(metrics[key]) || 0) }
const X = [...archive.map((item) => vec(item.body)), ...machine.map((item) => vec(item.body))]
const y = [...archive.map(() => 0), ...machine.map(() => 1)]
const w = [...ownWeights, ...machine.map(() => 1)]
const group = [...archive.map(() => 'own'), ...machine.map((item) => item.set)]
const recent = archive.map((item) => item.iso >= '2025-01-01')

function train(index, l2 = l2Arg) {
  const rows = index.map((i) => X[i])
  const d = rows[0].length
  const mu = Array(d).fill(0), sd = Array(d).fill(0)
  for (const row of rows) row.forEach((value, i) => { mu[i] += value / rows.length })
  for (const row of rows) row.forEach((value, i) => { sd[i] += (value - mu[i]) ** 2 / rows.length })
  sd.forEach((value, i) => { sd[i] = Math.sqrt(value) || 1 })
  const Z = rows.map((row) => row.map((value, i) => (value - mu[i]) / sd[i]))
  /* الصنفان متوازنان بمجموع الأوزان لا بعدد العيّنات. */
  const posWeight = index.filter((i) => y[i]).reduce((sum, i) => sum + w[i], 0)
  const negWeight = index.filter((i) => !y[i]).reduce((sum, i) => sum + w[i], 0)
  const total = posWeight + negWeight
  const balance = index.map((i) => w[i] * (y[i] ? total / (2 * posWeight) : total / (2 * negWeight)))
  const norm = balance.reduce((sum, value) => sum + value, 0)
  let wt = Array(d).fill(0), b = 0
  for (let iteration = 0; iteration < 3000; iteration += 1) {
    const gw = wt.map((wi) => l2 * wi / Z.length)
    let gb = 0
    Z.forEach((z, j) => {
      const p = 1 / (1 + Math.exp(-(b + z.reduce((sum, value, i) => sum + value * wt[i], 0))))
      const error = (p - y[index[j]]) * balance[j] / norm
      z.forEach((value, i) => { gw[i] += error * value })
      gb += error
    })
    wt = wt.map((wi, i) => wi - .5 * gw[i])
    b -= .5 * gb
  }
  return { w: wt, b, mu, sd, score: (row) => 1 / (1 + Math.exp(-(b + row.reduce((sum, value, i) => sum + (value - mu[i]) / sd[i] * wt[i], 0)))) }
}
const auc = (positive, negative) => { let sum = 0; for (const p of positive) for (const n of negative) sum += p > n ? 1 : p === n ? .5 : 0; return sum / (positive.length * negative.length) }

const all = X.map((_, i) => i)
const shuffle = (list, seed) => { let state = seed; return list.map((value) => [value, (state = (state * 16807) % 2147483647)]).sort((a, b) => a[1] - b[1]).map(([value]) => value) }
const ownIdx = shuffle(all.filter((i) => !y[i]), 7), macIdx = shuffle(all.filter((i) => y[i]), 11)
const predicted = Array(X.length)
for (let fold = 0; fold < 5; fold += 1) {
  const test = new Set([...ownIdx.filter((_, k) => k % 5 === fold), ...macIdx.filter((_, k) => k % 5 === fold)])
  const model = train(all.filter((i) => !test.has(i)))
  for (const i of test) predicted[i] = model.score(X[i])
}
const recentOwn = all.filter((i) => !y[i] && recent[i]).map((i) => predicted[i])
const threshold = [...recentOwn].sort((a, b) => a - b)[Math.floor(recentOwn.length * .95)]
for (const set of [...new Set(group)].filter((name) => name !== 'own')) {
  const cv = auc(all.filter((i) => group[i] === set).map((i) => predicted[i]), recentOwn)
  const held = train(all.filter((i) => group[i] !== set))
  const heldOut = auc(all.filter((i) => group[i] === set).map((i) => held.score(X[i])), all.filter((i) => !y[i] && recent[i]).map((i) => held.score(X[i])))
  console.log(`${set}: AUC تحقق متقاطع ${cv.toFixed(3)} · مجموعة لم يرها التدريب ${heldOut.toFixed(3)} (مقابل مقالاته منذ ٢٠٢٥)`)
}
const eraOf = (iso) => iso < '2025' ? 'قبل ٢٠٢٥' : iso < '2025-09' ? '٢٠٢٥ أ' : iso < '2026' ? '٢٠٢٥ ب' : '٢٠٢٦'
const eras = {}
archive.forEach((item, i) => { const era = eraOf(item.iso); (eras[era] ||= []).push(predicted[i] >= threshold) })
console.log('إنذارٌ كاذب على مقالاته (تحقق متقاطع):', Object.entries(eras).map(([era, flags]) => `${era} ${flags.filter(Boolean).length}/${flags.length}`).join(' · '))
const full = train(all)
const r4 = (value) => Math.round(value * 10000) / 10000
console.log('PARAMS', JSON.stringify({ keys: KEYS, w: full.w.map(r4), b: r4(full.b), mu: full.mu.map(r4), sd: full.sd.map(r4), threshold: Math.round(threshold * 100) / 100 }))
