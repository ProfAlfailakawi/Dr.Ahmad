/* «سماء المقالات» في العتبة: ثماني عشرة نجمة، وكل خطٍّ بينها حافةٌ حقيقية من
   src/data/knowledge-graph.json (بين مقالتين معروضتين فقط) — لا خطوط عشوائية.
   نختار عنقوداً متصلاً من المقالات الأكثر ترابطاً، ثم نُبقي شجرة الامتداد
   الأقوى (أعلى score) كي تبقى الصورة هادئة، ونكتب ملفاً صغيراً للواجهة. */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const graph = JSON.parse(fs.readFileSync(path.join(root, 'src/data/knowledge-graph.json'), 'utf8'))
const STARS = 18
const articles = new Map(graph.nodes.filter((n) => n.kind === 'article').map((n) => [n.id, n]))
const weight = new Map()
const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)
for (const e of graph.edges) {
  if (!articles.has(e.from) || !articles.has(e.to) || e.from === e.to) continue
  const k = key(e.from, e.to)
  weight.set(k, Math.max(weight.get(k) || 0, Number(e.score) || 0))
}
const adj = new Map()
for (const [k, w] of weight) {
  const [a, b] = k.split('|')
  if (!adj.has(a)) adj.set(a, new Map())
  if (!adj.has(b)) adj.set(b, new Map())
  adj.get(a).set(b, w)
  adj.get(b).set(a, w)
}
const degree = (id) => adj.get(id)?.size || 0
const seed = [...adj.keys()].sort((a, b) => degree(b) - degree(a) || a.localeCompare(b))[0]
const chosen = seed ? [seed] : []
while (chosen.length < STARS) {
  let best = null, bestScore = 0
  for (const id of adj.keys()) {
    if (chosen.includes(id)) continue
    let s = 0
    for (const c of chosen) s += adj.get(id).get(c) || 0
    if (s > bestScore || (s === bestScore && s > 0 && best && id < best)) { best = id; bestScore = s }
  }
  if (!best) break
  chosen.push(best)
}
/* شجرة امتداد عظمى (Prim) داخل النجوم المعروضة. */
const links = []
const inTree = new Set(chosen.slice(0, 1))
while (inTree.size < chosen.length) {
  let edge = null
  for (const a of inTree) for (const b of chosen) {
    if (inTree.has(b)) continue
    const w = adj.get(a)?.get(b) || 0
    if (w > 0 && (!edge || w > edge[2])) edge = [a, b, w]
  }
  if (!edge) break
  inTree.add(edge[1])
  links.push([chosen.indexOf(edge[0]), chosen.indexOf(edge[1])])
}
const out = {
  source: 'knowledge-graph.json',
  stars: chosen.map((id) => ({ slug: articles.get(id).slug, title: articles.get(id).title })),
  links,
}
fs.writeFileSync(path.join(root, 'src/data/threshold-sky.json'), `${JSON.stringify(out)}\n`)
console.log(`✓ سماء العتبة: ${out.stars.length} نجمة · ${links.length} صلة حقيقية`)
