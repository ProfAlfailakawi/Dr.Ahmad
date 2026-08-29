#!/usr/bin/env node
/**
 * تحديث حضور الملفات الأكاديمية — مجاناً وبلا تدخّل.
 *
 * يقيس عدد الأعمال في كل ملف يملك واجهةً عامّةً مجانية، ثم يكتبه في
 * src/data/academic-presence.json. أيّ ملف عدده أقل من minItems تختفي أيقونته
 * من الموقع تلقائياً، وتعود فور تجاوزه العتبة — دون أن يلمس أحدٌ الكود.
 *
 * القابلة للقياس مجاناً: Google Scholar · ORCID · Semantic Scholar · Wikidata.
 * غير القابلة (لا API مجاني): Web of Science · ResearchGate — يُحفَظ رقمها كما هو.
 *
 * مبدأ الأمان: عند أيّ فشل في الجلب يُحتفَظ بالعدد السابق، فلا تختفي أيقونةٌ بالخطأ.
 *
 * يُشغَّل أسبوعياً عبر .github/workflows/refresh-academic-presence.yml
 * أو يدوياً:  node scripts/refresh-academic-presence.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JSON_PATH = join(__dirname, '..', 'src', 'data', 'academic-presence.json')

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const IDS = {
  scholar: 'WVAtInIAAAAJ',
  orcid: '0000-0002-1767-4963',
  semanticScholar: '101514397',
  wikidata: 'Q141131823',
}

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res
}

// ORCID: عدد put-code في قائمة الأعمال
async function countOrcid() {
  const res = await get(`https://pub.orcid.org/v3.0/${IDS.orcid}/works`, {
    Accept: 'application/json',
  })
  const data = await res.json()
  return (data.group || []).length
}

// Semantic Scholar: paperCount
async function countSemanticScholar() {
  const res = await get(
    `https://api.semanticscholar.org/graph/v1/author/${IDS.semanticScholar}?fields=paperCount`,
  )
  const data = await res.json()
  return Number(data.paperCount)
}

// Google Scholar: عدد صفوف المقالات في الصفحة العامة (خادمياً — لا CORS)
async function countScholar() {
  const res = await get(
    `https://scholar.google.com/citations?user=${IDS.scholar}&hl=en&cstart=0&pagesize=100`,
  )
  const html = await res.text()
  const rows = html.match(/gsc_a_at/g)
  if (!rows) throw new Error('Scholar: no article rows parsed')
  return rows.length
}

// Wikidata: عدد الخصائص (P…) المصرّح بها في العنصر
async function countWikidata() {
  const res = await get(
    `https://www.wikidata.org/wiki/Special:EntityData/${IDS.wikidata}.json`,
  )
  const data = await res.json()
  const entity = data.entities?.[IDS.wikidata]
  return Object.keys(entity?.claims || {}).length
}

const MEASURERS = {
  'google-scholar': countScholar,
  orcid: countOrcid,
  'semantic-scholar': countSemanticScholar,
  wikidata: countWikidata,
}

async function main() {
  const raw = JSON.parse(await readFile(JSON_PATH, 'utf8'))
  const profiles = raw.profiles || {}
  let changed = false

  for (const [id, measure] of Object.entries(MEASURERS)) {
    const prev = profiles[id] || { count: null, measured: false, auto: true }
    try {
      const count = await measure()
      if (!Number.isFinite(count)) throw new Error(`قيمة غير صالحة: ${count}`)
      if (prev.count !== count || prev.measured !== true) changed = true
      profiles[id] = { count, measured: true, auto: true }
      console.log(`✓ ${id}: ${count}`)
    } catch (err) {
      // فشل الجلب → نُبقي العدد السابق كما هو (لا نُخفي بالخطأ)
      console.warn(`⚠ ${id}: تعذّر القياس (${err.message}) — أبقيت ${prev.count}`)
    }
  }

  if (!changed) {
    console.log('لا تغيير — الأعداد كما هي.')
    return
  }
  raw.profiles = profiles
  await writeFile(JSON_PATH, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  console.log('حُدِّث academic-presence.json')
}

main().catch((err) => {
  console.error('فشل التحديث:', err)
  process.exit(1)
})
