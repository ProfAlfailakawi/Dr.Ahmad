#!/usr/bin/env node
/**
 * كوكبات «سماء المقالات» المستخرجة من النص الفعلي للمقالات.
 *
 * العقدة هنا صارمة عمداً: لا نعرض مصطلحاً لمجرد تشابه دلالي في خريطة المعرفة.
 * يجب أن يظهر المصطلح المعتمد — أو أحد أسمائه العربية المعتمدة — حرفياً في نص
 * مقالتين على الأقل. هكذا يبقى اسم الكوكبة وصفاً لما كتبه الدكتور فعلاً، لا
 * تسمية مولّدة قد تبدو أكاديمية وهي لا تمثل المادة.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const index = read('src/data/knowledge-graph-index.json')
const bodies = read('src/data/bodies.json')
const glossary = read('src/data/dr-ahmad-domain-glossary.json')

const MIN_STOPS = 2
const MAX_STOPS = 7
const MAX_CONSTELLATIONS = 14

const normalize = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isArabic = (value) => /[\u0600-\u06FF]/.test(String(value || ''))
const isSpecific = (value) => {
  const normal = normalize(value)
  const words = normal.split(/\s+/).filter(Boolean)
  // العبارة المركبة آمنة. والكلمة المفردة لا تدخل إلا إن كانت طويلة مميزة.
  return normal.length >= 6 && (words.length >= 2 || normal.length >= 10)
}

const articleNodes = (Array.isArray(index.nodes) ? index.nodes : Object.values(index.nodes || {}))
  .filter((node) => node?.kind === 'article' && node?.slug)
const articleMeta = new Map(articleNodes.map((node) => [String(node.slug), node]))
const normalizedBodies = new Map(Object.entries(bodies || {}).map(([slug, body]) => [slug, normalize(body)]))
const yearOf = (slug) => Number(articleMeta.get(slug)?.year || 0)

const candidates = []
for (const entry of Array.isArray(glossary) ? glossary : []) {
  const title = String(entry?.canonicalAr || '').trim()
  if (!title) continue

  const aliases = [title, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]
    .filter((value) => isArabic(value) && isSpecific(value))
    .map((value) => normalize(value))
    .filter(Boolean)
  const uniqueAliases = [...new Set(aliases)]
  if (!uniqueAliases.length) continue

  const matching = []
  for (const [slug, text] of normalizedBodies) {
    if (!articleMeta.has(slug)) continue
    if (uniqueAliases.some((alias) => text.includes(alias))) matching.push(slug)
  }
  if (matching.length < MIN_STOPS) continue

  const path = matching
    .sort((a, b) => yearOf(a) - yearOf(b) || a.localeCompare(b))
    .slice(-MAX_STOPS)

  const years = path.map(yearOf).filter(Boolean)
  const span = years.length > 1 ? Math.max(...years) - Math.min(...years) : 0
  candidates.push({
    id: `concept-${String(entry.id || title).replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '')}`,
    title,
    slugs: path,
    weight: matching.length * 4 + span,
  })
}

/* لا نعرض كوكبتين مختلفتي الاسم إذا كانتا عملياً المجموعة نفسها من المقالات. */
const chosen = []
for (const item of candidates.sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, 'ar'))) {
  const set = new Set(item.slugs)
  const duplicate = chosen.some((previous) => {
    const other = new Set(previous.slugs)
    const overlap = [...set].filter((slug) => other.has(slug)).length
    const union = new Set([...set, ...other]).size
    return union > 0 && overlap / union >= 0.50
  })
  if (duplicate) continue
  chosen.push(item)
  if (chosen.length >= MAX_CONSTELLATIONS) break
}

const payload = {
  version: 2,
  builtAt: new Date().toISOString().slice(0, 10),
  note: 'مبنية من الظهور النصي الفعلي لمصطلحات قاموس الدكتور داخل المقالات؛ لا تعتمد التشابه الدلالي وحده.',
  constellations: chosen.map(({ id, title, slugs }) => ({ id, title, slugs })),
}

writeFileSync(resolve(root, 'src/data/atlas-constellations.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(`كوكبات موثّقة نصياً: ${payload.constellations.length}`)
for (const item of payload.constellations) console.log(` · ${item.title} — ${item.slugs.length} محطات`)
