#!/usr/bin/env node
/**
 * يُعيد تدريب «أثر الآلة» (MACHINE_TRACE في src/lib/style-dna.mjs) ويقيسه بصدق.
 *
 * الاستعمال:
 *   node scripts/train-machine-trace.mjs [ملف-نصوص-آلية-إضافي.json …]
 *
 * كل ملفٍ إضافي مصفوفة {"mode": "generic"|"imitate", "body": "…"} — أفضلها مسودات
 * الاستوديو الحقيقية (Gemini/Qwen) التي رفضها الدكتور أو علّم عليها «ليست أنا».
 * يطبع: AUC بالتحقق المتقاطع (٥ طيّات)، وAUC مع مجموعةٍ كاملة لم يرها التدريب،
 * ثم سطر PARAMS بالمعاملات الجديدة لتُنسخ إلى MACHINE_TRACE يدوياً بعد المراجعة.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const S = await import(resolve(root, 'src/lib/style-dna.mjs'))
const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const archive = Object.values(bodies).filter((body) => typeof body === 'string' && body.trim().length > 200)
const dna = S.measureStyleDna(archive)
const fixture = JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/style-machine-texts.json'), 'utf8')).texts
const extra = process.argv.slice(2).flatMap((file, index) => JSON.parse(readFileSync(resolve(file), 'utf8')).map((item) => ({ ...item, set: `extra-${index + 1}` })))
const machine = [...fixture, ...extra].filter((item) => S.countWords(item.body) >= 120)

const KEYS = S.MACHINE_TRACE.features.map((feature) => feature.key)
const vec = (text) => { const metrics = S.articleMetrics(text, { collective: dna.collectiveVerbs }); return KEYS.map((key) => Number(metrics[key]) || 0) }
const X = [...archive.map(vec), ...machine.map((item) => vec(item.body))]
const y = [...archive.map(() => 0), ...machine.map(() => 1)]
const group = [...archive.map(() => 'own'), ...machine.map((item) => item.set)]

function train(rows, labels, l2 = 1) {
  const d = rows[0].length
  const mu = Array(d).fill(0), sd = Array(d).fill(0)
  for (const row of rows) row.forEach((value, i) => { mu[i] += value / rows.length })
  for (const row of rows) row.forEach((value, i) => { sd[i] += (value - mu[i]) ** 2 / rows.length })
  sd.forEach((value, i) => { sd[i] = Math.sqrt(value) || 1 })
  const Z = rows.map((row) => row.map((value, i) => (value - mu[i]) / sd[i]))
  const pos = labels.filter(Boolean).length, neg = labels.length - pos
  const balance = labels.map((label) => (label ? labels.length / (2 * pos) : labels.length / (2 * neg)))
  let w = Array(d).fill(0), b = 0
  for (let iteration = 0; iteration < 3000; iteration += 1) {
    const gw = w.map((wi) => l2 * wi / Z.length)
    let gb = 0
    Z.forEach((z, j) => {
      const p = 1 / (1 + Math.exp(-(b + z.reduce((sum, value, i) => sum + value * w[i], 0))))
      const error = (p - labels[j]) * balance[j] / Z.length
      z.forEach((value, i) => { gw[i] += error * value })
      gb += error
    })
    w = w.map((wi, i) => wi - .5 * gw[i])
    b -= .5 * gb
  }
  return { w, b, mu, sd, score: (row) => 1 / (1 + Math.exp(-(b + row.reduce((sum, value, i) => sum + (value - mu[i]) / sd[i] * w[i], 0)))) }
}
const auc = (positive, negative) => { let sum = 0; for (const p of positive) for (const n of negative) sum += p > n ? 1 : p === n ? .5 : 0; return sum / (positive.length * negative.length) }

const index = X.map((_, i) => i)
const shuffle = (list, seed) => { let state = seed; return list.map((value) => [value, (state = (state * 16807) % 2147483647)]).sort((a, b) => a[1] - b[1]).map(([value]) => value) }
const ownIdx = shuffle(index.filter((i) => !y[i]), 7), macIdx = shuffle(index.filter((i) => y[i]), 11)
const predicted = Array(X.length)
for (let fold = 0; fold < 5; fold += 1) {
  const test = new Set([...ownIdx.filter((_, k) => k % 5 === fold), ...macIdx.filter((_, k) => k % 5 === fold)])
  const model = train(index.filter((i) => !test.has(i)).map((i) => X[i]), index.filter((i) => !test.has(i)).map((i) => y[i]))
  for (const i of test) predicted[i] = model.score(X[i])
}
const ownScores = index.filter((i) => !y[i]).map((i) => predicted[i])
for (const set of [...new Set(group)].filter((name) => name !== 'own')) {
  const cv = auc(index.filter((i) => group[i] === set).map((i) => predicted[i]), ownScores)
  const held = train(index.filter((i) => group[i] !== set).map((i) => X[i]), index.filter((i) => group[i] !== set).map((i) => y[i]))
  const heldOut = auc(index.filter((i) => group[i] === set).map((i) => held.score(X[i])), index.filter((i) => !y[i]).map((i) => held.score(X[i])))
  console.log(`${set}: AUC تحقق متقاطع ${cv.toFixed(3)} · مجموعة لم يرها التدريب ${heldOut.toFixed(3)}`)
}
const full = train(X, y)
const threshold = [...ownScores].sort((a, b) => a - b)[Math.floor(ownScores.length * .95)]
const r4 = (value) => Math.round(value * 10000) / 10000
console.log('PARAMS', JSON.stringify({ keys: KEYS, w: full.w.map(r4), b: r4(full.b), mu: full.mu.map(r4), sd: full.sd.map(r4), threshold: Math.round(threshold * 100) / 100 }))
