import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { projectRoot, SITE_URL } from './config.mjs'

const SEARCH_CACHE_LIMIT = 128
const searchCacheByDb = new WeakMap()

const stripDiacritics = (value) => String(value || '').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
export const normalizeArabic = (value) => stripDiacritics(value).toLowerCase().replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء').replace(/[ـ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

const unescape = (value) => String(value || '').replace(/\\([\\'"`])/g, '$1').replace(/\\n/g, '\n')
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }

function findArraySection(source, token) {
  const start = source.indexOf(token)
  if (start < 0) return []
  const assignment = source.indexOf('=', start)
  const open = source.indexOf('[', assignment >= 0 ? assignment : start)
  if (open < 0) return []
  let depth = 0; let quote = ''; let escaped = false; const blocks = []
  let blockStart = -1
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    if (quote) { if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === quote) quote = ''; continue }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '[') depth += 1
    if (ch === ']') { depth -= 1; if (depth === 0) break }
    if (ch === '{' && depth === 1) blockStart = i
    if (ch === '}' && depth === 1 && blockStart >= 0) { blocks.push(source.slice(blockStart, i + 1)); blockStart = -1 }
  }
  return blocks
}

function parseObject(block) {
  const out = {}
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|`([\s\S]*?)`|(true|false|null)|(-?\d+(?:\.\d+)?))/g
  let match
  while ((match = pattern.exec(block))) {
    const [, key, single, double, template, boolean, number] = match
    out[key] = single != null ? unescape(single) : double != null ? unescape(double) : template != null ? template : boolean === 'true' ? true : boolean === 'false' ? false : boolean === 'null' ? null : Number(number)
  }
  return out
}

function sourceFiles(root) {
  return {
    data: fs.readFileSync(path.join(root, 'src', 'data.ts'), 'utf8'),
    papers: fs.readFileSync(path.join(root, 'src', 'data', 'research-papers.ts'), 'utf8'),
    curated: fs.readFileSync(path.join(root, 'src', 'data-curated.ts'), 'utf8'),
  }
}

function hashItem(item) { return crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex') }

function audioFor(slug, audio, audioMeta) {
  const entry = audio?.[slug]
  const meta = audioMeta?.[slug]
  if (!entry && !meta) return null
  const voices = typeof entry === 'object' ? entry : entry ? { fahed: true } : {}
  return {
    fahed: Boolean(voices.fahed),
    noura: Boolean(voices.noura),
    dialogue: Boolean(meta?.dialogue || meta?.dialoguePath || meta?.dialogueUrl),
    duration: Number(meta?.duration || meta?.durationSec || 0) || null,
  }
}

export function buildContentIndex(root = projectRoot, siteUrl = SITE_URL) {
  const sources = sourceFiles(root)
  const bodies = readJson(path.join(root, 'src', 'data', 'bodies.json'), {})
  const audio = readJson(path.join(root, 'src', 'data', 'audio.json'), {})
  const audioMeta = readJson(path.join(root, 'src', 'data', 'audio-meta.json'), {})
  const podcast = readJson(path.join(root, 'src', 'data', 'podcast-admin.json'), {})
  const items = []

  for (const row of findArraySection(sources.data, 'export const articles')) {
    const value = parseObject(row); const slug = String(value.slug || '').trim(); if (!slug) continue
    const body = String(bodies[slug] || value.body || value.excerpt || '').trim()
    items.push({ id: `article:${slug}`, kind: 'article', slug, title: String(value.title || slug), excerpt: String(value.excerpt || ''), body, url: `${siteUrl}/articles/${slug}`, image: value.image || null, date: value.iso || value.date || '', words: body.split(/\s+/).filter(Boolean).length, audio: audioFor(slug, audio, audioMeta), keywords: [value.cat, value.category].filter(Boolean).join(' '), hash: '' })
  }

  for (const row of findArraySection(sources.data, 'export const books')) {
    const value = parseObject(row); const slug = String(value.slug || '').trim(); if (!slug) continue
    items.push({ id: `book:${slug}`, kind: 'book', slug, title: String(value.title || slug), excerpt: String(value.desc || ''), body: '', url: `${siteUrl}/publications/${slug}`, image: value.cover || null, date: '', words: 0, audio: null, keywords: 'كتاب مؤلف', hash: '' })
  }

  for (const row of findArraySection(sources.papers, 'export const researchPapers')) {
    const value = parseObject(row); const slug = String(value.slug || '').trim(); if (!slug) continue
    items.push({ id: `paper:${slug}`, kind: 'paper', slug, title: String(value.title || slug), excerpt: String(value.abstractAr || value.meta || ''), body: String(value.abstractAr || ''), url: `${siteUrl}/research/${slug}`, image: null, date: value.iso || value.date || '', words: 0, audio: null, keywords: [value.meta, value.journal].filter(Boolean).join(' '), hash: '' })
  }

  for (const row of findArraySection(sources.curated, 'export const curatedBank')) {
    const value = parseObject(row); const slug = crypto.createHash('sha1').update(String(value.ar || value.en || '')).digest('hex').slice(0, 12); if (!value.ar && !value.en) continue
    items.push({ id: `curated:${slug}`, kind: 'curated', slug, title: String(value.ar || value.en), excerpt: String(value.arNote || value.enNote || ''), body: '', url: `${siteUrl}/curated`, image: null, date: value.added || '', words: 0, audio: null, keywords: String(value.kind || ''), hash: '' })
  }

  for (const episode of Array.isArray(podcast.episodes) ? podcast.episodes : []) {
    const slug = String(episode.slug || episode.id || '').trim(); const status = String(episode.status || '').toLowerCase(); if (!slug || !['approved', 'published'].includes(status)) continue
    items.push({ id: `podcast:${slug}`, kind: 'podcast', slug, title: String(episode.title || slug), excerpt: String(episode.description || episode.excerpt || ''), body: '', url: `${siteUrl}/podcast/${slug}`, image: episode.image || null, date: episode.date || episode.publishedAt || '', words: 0, audio: { dialogue: Boolean(episode.audioUrl || episode.url || episode.status === 'Published'), duration: Number(episode.duration || 0) || null }, keywords: 'بودكاست حواري', hash: '' })
  }

  const unique = new Map()
  for (const item of items) { item.hash = hashItem({ ...item, hash: undefined }); if (!unique.has(item.id)) unique.set(item.id, item) }
  return [...unique.values()]
}

export function syncContentIndex(db, root = projectRoot, siteUrl = SITE_URL) {
  const items = buildContentIndex(root, siteUrl)
  searchCacheByDb.delete(db)
  db.transaction(() => {
    db.run('DELETE FROM content_items')
    db.run('DELETE FROM content_items_fts')
    const insert = db.db.prepare('INSERT INTO content_items(id,kind,slug,title,excerpt,body,url,image,date,words,audio_json,keywords,hash,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    const insertFts = db.db.prepare('INSERT INTO content_items_fts(id,title,excerpt,body,keywords,kind) VALUES(?,?,?,?,?,?)')
    const timestamp = new Date().toISOString()
    for (const item of items) {
      insert.run(item.id, item.kind, item.slug, item.title, item.excerpt, item.body, item.url, item.image, item.date, item.words, item.audio ? JSON.stringify(item.audio) : null, item.keywords, item.hash, timestamp)
      insertFts.run(item.id, item.title, item.excerpt, item.body, item.keywords, item.kind)
    }
  })
  db.addAudit('content-index-sync', '', `${items.length} public items indexed`)
  return { count: items.length, kinds: items.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {}) }
}

function rowToItem(row) {
  if (!row) return null
  return { ...row, words: Number(row.words || 0), audio: row.audio_json ? JSON.parse(row.audio_json) : null }
}

export function findContent(db, id) { return rowToItem(db.get('SELECT * FROM content_items WHERE id=?', id)) }

export function searchContent(db, query, options = {}) {
  const text = normalizeArabic(query)
  if (!text) return []
  const limit = Math.min(Math.max(Number(options.limit || 3), 1), 10)
  const tokens = [...new Set(text.split(/\s+/).filter((token) => token.length > 1))].slice(0, 8)
  const cacheKey = `${limit}:${tokens.join(' ')}`
  let cache = searchCacheByDb.get(db)
  if (!cache) { cache = new Map(); searchCacheByDb.set(db, cache) }
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  let rows = []
  const escaped = tokens.map((token) => token.replace(/"/g, ''))
  try {
    /* البحث الدقيق أولاً؛ فإن كانت العبارة طويلة أو فيها كلمة لا تظهر في
       الأرشيف، نعيدها بصيغة OR بدلاً من مسح أجسام 143 مقالة حرفاً حرفاً. */
    const exact = escaped.slice(0, 5).map((token) => `"${token}"*`).join(' AND ')
    if (exact) {
      rows = db.all(
        'SELECT content_items.*, bm25(content_items_fts) AS rank FROM content_items_fts JOIN content_items ON content_items.id=content_items_fts.id WHERE content_items_fts MATCH ? ORDER BY rank LIMIT ?',
        exact, limit,
      )
    }
    if (!rows.length && escaped.length > 1) {
      const broad = escaped.slice(0, 6).map((token) => `"${token}"*`).join(' OR ')
      rows = db.all(
        'SELECT content_items.*, bm25(content_items_fts) AS rank FROM content_items_fts JOIN content_items ON content_items.id=content_items_fts.id WHERE content_items_fts MATCH ? ORDER BY rank LIMIT ?',
        broad, limit,
      )
    }
  } catch { rows = [] }

  if (!rows.length) {
    /* احتياط خفيف على الحقول القصيرة المفهرسة عملياً؛ لا يدخل body الضخم
       في LIKE، وهو سبب البطء الواضح في كل سؤال لم يطابق FTS من أول مرة. */
    const useful = escaped.sort((a, b) => b.length - a.length).slice(0, 3)
    if (useful.length) {
      const clauses = useful.map(() => "lower(title||' '||excerpt||' '||keywords) LIKE ?").join(' OR ')
      const params = useful.map((token) => `%${token.replace(/[%_]/g, '')}%`)
      rows = db.all(`SELECT * FROM content_items WHERE ${clauses} ORDER BY date DESC LIMIT ?`, ...params, limit)
    }
  }

  const result = rows.map(rowToItem)
  cache.set(cacheKey, result)
  if (cache.size > SEARCH_CACHE_LIMIT) cache.delete(cache.keys().next().value)
  return result
}

export function latestContent(db, kind, limit = 3) {
  const rows = db.all("SELECT * FROM content_items WHERE kind=? ORDER BY CASE WHEN date GLOB '[0-9]*' THEN date ELSE updated_at END DESC LIMIT ?", kind, Math.min(limit, 10))
  return rows.map(rowToItem)
}

export function contentSummary(item, maxSentences = 3) {
  if (!item) return ''
  const source = String(item.excerpt || item.body || '').replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const parts = source.split(/(?<=[.!؟])/u).map((part) => part.trim()).filter(Boolean)
  return parts.slice(0, maxSentences).join(' ')
}
