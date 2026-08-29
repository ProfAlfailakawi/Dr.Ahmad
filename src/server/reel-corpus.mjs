/**
 * أرشيف الدكتور كاملاً في خدمة ابتكار المشاهد.
 *
 * «كتبي ومقالاتي ولقاءاتي وكل شي» (٢٩ أغسطس ٢٠٢٦): المُبتكِر لا يخترع في
 * الفراغ — يقرأ من متنه هو. هذه الطبقة تجمع المصادر الستة عبر buildContentIndex
 * القائم (مقال · كتاب · إعلام ولقاءات · بحث · مختارات · بودكاست)، وتزيد عليها
 * متون الكتب من book-knowledge (لأن فهرس المحتوى يترك متن الكتاب فارغاً)،
 * ثم تختار ما يلامس الفكرة وحده — فالسياق دليلٌ على نبرته لا حشوٌ للنموذج.
 *
 * تُحمّل مرة وتُخزَّن في الذاكرة: الأرشيف لا يتغيّر بين طلبين.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..')
const KIND_LABEL = {
  article: 'مقال', book: 'كتاب', media: 'لقاء', paper: 'بحث', curated: 'مختارات', podcast: 'حلقة',
}

let cache = null

function readJson(relative) {
  const path = resolve(ROOT, relative)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

/** متون الكتب: فهرس المحتوى يتركها فارغة، ومعرفتها محفوظة في ملف مستقل. */
function bookPassages() {
  const knowledge = readJson('src/data/book-knowledge.json')
  const books = Array.isArray(knowledge?.books) ? knowledge.books : []
  return books.map((book) => ({
    kind: 'book',
    title: String(book.title || book.slug || ''),
    text: [book.role, Array.isArray(book.topTerms) ? book.topTerms.join('، ') : '', book.summary]
      .filter(Boolean).join(' — ').slice(0, 900),
    url: book.slug ? `/publications/${book.slug}` : '',
  })).filter((row) => row.title && row.text)
}

async function loadAll() {
  const rows = []
  try {
    const { buildContentIndex } = await import('../../whatsapp-agent/content-index.mjs')
    const index = await buildContentIndex(ROOT)
    const items = Array.isArray(index) ? index : (index?.items || [])
    for (const item of items) {
      const text = [item.excerpt, item.body].filter(Boolean).join(' ').trim()
      if (!text) continue
      rows.push({ kind: item.kind || 'article', title: String(item.title || ''), text: text.slice(0, 1_200), url: item.url || '' })
    }
  } catch { /* الفهرس غير متاح في بيئة مقيّدة: نكمل بمتون الكتب وحدها */ }
  rows.push(...bookPassages())
  return rows
}

export async function reelCorpus() {
  if (!cache) cache = await loadAll()
  return cache
}

/** لأغراض الاختبار: يعيد التحميل من الصفر. */
export function resetReelCorpus() { cache = null }

const bare = (value = '') => value
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[إأآا]/g, 'ا')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

/**
 * يختار مقاطع تلامس الفكرة، مع ضمان تنوّع المصادر: لا تبتلع المقالات كل
 * المقاعد، فيبقى للكتاب واللقاء والبحث نصيبٌ متى لامست الفكرة.
 */
export function pickCorpusPassages(idea, rows, limit = 6) {
  const keys = bare(idea).split(/\s+/).filter((word) => word.length >= 4)
  if (!keys.length) return rows.slice(0, limit)
  const scored = rows.map((row) => {
    const haystack = bare(`${row.title} ${row.text}`)
    let score = 0
    for (const key of keys) if (haystack.includes(key)) score += 1
    return { row, score }
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)

  const perKind = Math.max(1, Math.ceil(limit / 3))
  const counts = new Map()
  const picked = []
  for (const entry of scored) {
    const kind = entry.row.kind || 'article'
    const used = counts.get(kind) || 0
    if (used >= perKind) continue
    counts.set(kind, used + 1)
    picked.push(entry.row)
    if (picked.length >= limit) break
  }
  // إن بقي مقعد بعد سقف التنوّع، يملؤه الأعلى تطابقاً أياً كان نوعه.
  for (const entry of scored) {
    if (picked.length >= limit) break
    if (!picked.includes(entry.row)) picked.push(entry.row)
  }
  return picked
}

/** يصوغ المقاطع للنموذج مع تسمية نوع المصدر بالعربية. */
export function labelPassages(rows) {
  return rows.map((row) => ({
    title: `${KIND_LABEL[row.kind] || 'مادة'}: ${row.title}`,
    text: row.text,
    url: row.url,
  }))
}
