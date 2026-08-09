#!/usr/bin/env node
/**
 * كوكبات السماء المولّدة من الأرشيف نفسه.
 *
 * كان مُنتقي الكوكبات في /atlas يعرض كوكبتين محرَّرتين باليد لا غير، فلا يستحقّ
 * أن يُفتح. هنا تُستخرج كوكباتٌ إضافية من خريطة المعرفة المبنيّة أصلاً: كل مفهومٍ
 * من قاموس د. أحمد تربطه الخريطة بثلاثة مقالاتٍ فأكثر يصير مساراً للقراءة،
 * مرتَّباً من الأقدم إلى الأحدث حتى يُقرأ كرحلةٍ لا كقائمة.
 *
 * لا نموذج لغويّ ولا خدمة مدفوعة: العناوين مفاهيمه هو كما كتبها، والروابط
 * من خريطةٍ محسوبةٍ في المستودع.
 *
 *   node scripts/build-atlas-constellations.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

const graph = read('src/data/knowledge-graph.json')
const index = read('src/data/knowledge-graph-index.json')
/* معجم الدكتور هو مرجع الأسماء الوحيد. لا يُعرض للزائر مصطلحٌ إلا إذا كان
   اسماً معتمداً فيه (canonicalAr)، والاسم البديل يُردّ إلى المعتمد. فلا نضع
   على السماء لفظاً استنتاجياً ونقدّمه بوصفه مصطلحاً علمياً. */
const glossary = read('src/data/dr-ahmad-domain-glossary.json')
const canonicalTitles = new Set()
const aliasToCanonical = new Map()
for (const entry of Array.isArray(glossary) ? glossary : []) {
  const canonical = String(entry?.canonicalAr || '').trim()
  if (!canonical) continue
  canonicalTitles.add(canonical)
  aliasToCanonical.set(canonical, canonical)
  for (const alias of [entry?.canonicalEn, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])]) {
    const value = String(alias || '').trim()
    if (value) aliasToCanonical.set(value, canonical)
  }
}

const nodes = Array.isArray(index.nodes) ? index.nodes : Object.values(index.nodes)
const byId = new Map(nodes.map((node) => [node.id, node]))

/* حدّ الصلة: الخريطة تربط بدرجات، وما دون هذا الحدّ صلةٌ عارضة لا تصنع مساراً. */
const MIN_SCORE = 12
/* مسارٌ أقصر من ثلاث محطات ليس رحلة، وأطول من سبعٍ لا يُقرأ في جلسة. */
const MIN_STOPS = 3
const MAX_STOPS = 7
/* سقف المُنتقي: قائمةٌ تُقرأ بنظرة، لا جدولٌ يُتصفّح. */
const MAX_CONSTELLATIONS = 14

const conceptArticles = new Map()
for (const edge of graph.edges || []) {
  const pairs = [[edge.from, edge.to], [edge.to, edge.from]]
  for (const [concept, article] of pairs) {
    if (typeof concept !== 'string' || typeof article !== 'string') continue
    if (!concept.startsWith('concept:') || !article.startsWith('article:')) continue
    if (Number(edge.score) < MIN_SCORE) continue
    if (!conceptArticles.has(concept)) conceptArticles.set(concept, new Map())
    const current = conceptArticles.get(concept).get(article) || 0
    conceptArticles.get(concept).set(article, Math.max(current, Number(edge.score) || 0))
  }
}

const yearOf = (id) => {
  const value = Number((byId.get(id) || {}).year)
  return Number.isFinite(value) && value > 1990 ? value : 0
}

const candidates = []
for (const [conceptId, articles] of conceptArticles) {
  const concept = byId.get(conceptId)
  if (!concept || !concept.title) continue

  const ordered = [...articles.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_STOPS)
    .map(([id]) => id)
    .filter((id) => byId.has(id))
  if (ordered.length < MIN_STOPS) continue

  /* المسار يُقرأ من الأقدم إلى الأحدث: فكرةٌ تكبر، لا قائمةُ نتائج. */
  const path = ordered
    .map((id) => ({ id, year: yearOf(id) }))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id))
    .map((item) => item.id)

  const years = path.map(yearOf).filter(Boolean)
  const span = years.length > 1 ? Math.max(...years) - Math.min(...years) : 0

  const rawTitle = concept.title.trim()
  const canonical = aliasToCanonical.get(rawTitle)
  /* ليس في المعجم؟ لا يُعرض. المصطلح المعتمد وحده يليق بأن يُسمّى كوكبة. */
  if (!canonical || !canonicalTitles.has(canonical)) continue

  candidates.push({
    id: `concept-${concept.slug || conceptId.slice('concept:'.length)}`,
    title: canonical,
    slugs: path.map((id) => (byId.get(id) || {}).slug).filter(Boolean),
    /* الأفضلية لمسارٍ يمتدّ عبر السنين ويكتمل عدده: هو الأدلّ على فكرةٍ رافقته. */
    weight: span * 2 + path.length,
  })
}

const chosen = candidates
  .filter((item) => item.slugs.length >= MIN_STOPS)
  .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'ar'))
  .slice(0, MAX_CONSTELLATIONS)
  .map(({ id, title, slugs }) => ({ id, title, slugs }))

const payload = {
  version: 1,
  builtAt: new Date().toISOString().slice(0, 10),
  note: 'مولّدة من خريطة المعرفة؛ تُدمج بعد الكوكبات المحرَّرة يدوياً في /atlas.',
  constellations: chosen,
}

writeFileSync(resolve(root, 'src/data/atlas-constellations.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
for (const item of chosen) {
  if (!canonicalTitles.has(item.title)) throw new Error(`اسم كوكبة خارج المعجم: ${item.title}`)
}
console.log(`كوكبات مولّدة: ${chosen.length}`)
for (const item of chosen) console.log(` · ${item.title} — ${item.slugs.length} محطات`)
