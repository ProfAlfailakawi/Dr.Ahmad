import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { projectRoot, SITE_URL } from './config.mjs'
import { toRoot } from './dialect-lexicon.mjs'
import { collapseElongation, foldArabicLetters, stripInvisible } from './comprehension.mjs'
import { buildSimilarityGraph } from '../src/lib/archive-scale.mjs'
import { mergeCanonicalContentIndex, readCanonicalCms } from '../scripts/canonical-cms.mjs'

const SEARCH_CACHE_LIMIT = 128
const searchCacheByDb = new WeakMap()

const stripDiacritics = (value) => String(value || '').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
/* التطبيع بابُ الفهم كلّه: منه تمرّ نيّة السائل وبحثُه وقواعدُ الردّ والمفاهيم.
   كان يقرأ الفصحى السليمة وحدها، فيُخرج من الفهم المطَّ («شلوووونك») وعلاماتِ
   اللصق غير المرئية وصورَ الهمزة على كرسيّها («سؤال» = «سوال»). */
export const normalizeArabic = (value) => foldArabicLetters(collapseElongation(stripDiacritics(stripInvisible(value)).toLowerCase()))
  .replace(/\u0649/g, '\u064A')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

const mediaIdFromUrl = (value = '') => (String(value).match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''

function mediaTranscriptText(record) {
  if (!record?.available || !Array.isArray(record.segments)) return ''
  return record.segments
    .map((segment) => String(segment?.displayText || segment?.text || '').trim())
    .filter(Boolean)
    .join('\n')
}

function hashItem(item) { return crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex') }

function audioFor(slug, audio, audioMeta) {
  const entry = audio?.[slug]
  const fahedMeta = audioMeta?.[`${slug}.mp3`]
  const nouraMeta = audioMeta?.[`${slug}.noura.mp3`]
  const dialogueMp3Meta = audioMeta?.[`${slug}.dialogue.mp3`]
  const legacyMeta = audioMeta?.[slug]
  /* audio.json هو بيان النشر المعتمد. metadata وحدها لا تعلن ملفاً للزائر؛
     مهمة المصالحة هي التي ترقي الملف الموثق إلى البيان بعد اكتماله. */
  const voices = typeof entry === 'object' && entry ? { ...entry } : entry ? { fahed: true } : {}
  if (!Object.values(voices).some(Boolean)) return null
  const secondsOf = (meta) => Number(meta?.duration || meta?.durationSec || meta?.durationSeconds || 0) || null
  const durations = {
    fahed: voices.fahed ? secondsOf(fahedMeta || legacyMeta) : null,
    noura: voices.noura ? secondsOf(nouraMeta) : null,
    dialogue: voices.dialogue ? secondsOf(dialogueMp3Meta || legacyMeta) : null,
  }
  /* روابط الملفات الصوتية المنشورة (ترقية ٣١ يوليو): يحتاجها البوت ليرسل
     القراءة داخل واتساب لا كرابطٍ يقتضي فتح المتصفح. تُبنى من قاعدة النشر
     نفسها التي يستعملها الموقع، وتغيب بأمان إن لم تُضبط. */
  const base = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
  const fileUrl = (name) => base ? `${base}/${encodeURIComponent(name)}` : ''
  const files = {
    fahed: voices.fahed ? fileUrl(`${slug}.mp3`) : '',
    noura: voices.noura ? fileUrl(`${slug}.noura.mp3`) : '',
    dialogue: voices.dialogue ? fileUrl(`${slug}.dialogue.mp3`) : '',
  }
  return {
    fahed: Boolean(voices.fahed),
    noura: Boolean(voices.noura),
    dialogue: Boolean(voices.dialogue),
    durations,
    files,
    duration: durations.dialogue || durations.fahed || durations.noura || null,
  }
}

function semanticSearchText(value, limit = 160) {
  const normalized = normalizeArabic(value)
  if (!normalized) return ''
  const words = normalized.split(/\s+/).filter((word) => word.length > 1)
  const roots = []
  const seen = new Set()
  for (const word of words) {
    const root = toRoot(word)
    for (const token of [word, root]) {
      if (!token || token.length < 2 || seen.has(token)) continue
      seen.add(token)
      roots.push(token)
      if (roots.length >= limit) return roots.join(' ')
    }
  }
  return roots.join(' ')
}

function searchableField(value, limit) {
  const source = String(value || '')
  const semantic = semanticSearchText(source, limit)
  return semantic ? `${source}\n${semantic}` : source
}

export function buildContentIndex(root = projectRoot, siteUrl = SITE_URL) {
  const sources = sourceFiles(root)
  const bodies = readJson(path.join(root, 'src', 'data', 'bodies.json'), {})
  const audio = readJson(path.join(root, 'src', 'data', 'audio.json'), {})
  const audioMeta = readJson(path.join(root, 'src', 'data', 'audio-meta.json'), {})
  const podcast = readJson(path.join(root, 'src', 'data', 'podcast-admin.json'), {})
  const mediaArchive = readJson(path.join(root, 'src', 'data', 'media-archive.json'), {})
  const mediaTranscripts = readJson(path.join(root, 'src', 'data', 'media-archive-transcripts.json'), {})
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

  /* الظهور الإعلامي كان موجوداً في الموقع ومفهرساً زمنياً، لكنه غائب كلياً عن
     عقل واتساب؛ لذلك كان «لقاءات الدكتور» و«ابحث داخل ما قيل» ينتهيان إلى
     مقالات. نستخدم سجلات الموقع نفسها وروابط صفحات الموقع، لا روابط خارجية. */
  const indexedMediaKeys = new Set()
  let mediaPosition = 0
  for (const row of findArraySection(sources.data, 'export const media')) {
    const value = parseObject(row)
    const sourceId = mediaIdFromUrl(value.url)
    const slug = `media-${sourceId || ++mediaPosition}`
    const title = String(value.title || '').trim()
    if (!title) continue
    const body = mediaTranscriptText(mediaTranscripts[sourceId])
    items.push({
      id: `media:${slug}`, kind: 'media', slug, title,
      excerpt: String(value.topics || ''), body,
      url: `${siteUrl}/media/${slug}`, image: null,
      date: value.iso || value.date || '', words: body.split(/\s+/).filter(Boolean).length,
      audio: null,
      keywords: [value.outlet, value.channel, value.program, value.topics, 'ظهور إعلامي لقاء مقابلة فيديو تلفزيون شاهد'].filter(Boolean).join(' '),
      hash: '',
    })
    indexedMediaKeys.add(sourceId)
    indexedMediaKeys.add(slug)
  }

  for (const value of Array.isArray(mediaArchive.items) ? mediaArchive.items : []) {
    const slug = String(value?.slug || '').trim()
    const sourceId = String(value?.id || '').trim()
    if (!slug || !sourceId || indexedMediaKeys.has(sourceId) || indexedMediaKeys.has(slug)) continue
    const title = String(value.title || '').trim()
    if (!title) continue
    const body = mediaTranscriptText(mediaTranscripts[sourceId])
    const audioKind = ['audio', 'radio', 'podcast'].includes(String(value.kind || '').toLowerCase())
    items.push({
      id: `media:${slug}`, kind: 'media', slug, title,
      excerpt: String(value.topics || ''), body,
      url: `${siteUrl}/media/${slug}`, image: value.thumbnail || null,
      date: value.iso || value.date || '', words: body.split(/\s+/).filter(Boolean).length,
      audio: null,
      keywords: [value.outlet, value.program, value.topics, audioKind ? 'إذاعة راديو تسجيل صوتي استمع' : 'ظهور إعلامي لقاء مقابلة فيديو شاهد'].filter(Boolean).join(' '),
      hash: '',
    })
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

  /* Canonical Publishing Pipeline: during every production build Firestore is
     snapshotted once, then the same snapshot feeds WhatsApp/search/knowledge graph.
     Added CMS material and base overrides therefore enter the deep index in the
     same deploy that publishes the page, instead of waiting for manual source edits. */
  const canonicalItems = mergeCanonicalContentIndex(items, readCanonicalCms(root), siteUrl)
  const unique = new Map()
  for (const item of canonicalItems) { item.hash = hashItem({ ...item, hash: undefined }); if (!unique.has(item.id)) unique.set(item.id, item) }
  // رسم معرفة خفيف داخل الفهرس: يضيف عناوين أقرب الامتدادات إلى حقل البحث.
  // Archive 2036: كانت هذه الخطوة تقارن كل مادة بكل مادة (O(n²)). عند 100k
  // تصبح مليارات المقارنات. الآن نبني جيب مرشحين من posting lists نادرة ثم
  // نحتفظ بأقرب خمسة فقط لكل مادة.
  const indexed = [...unique.values()]
  const similarity = buildSimilarityGraph(indexed, {
    getText: (item) => `${item.title || ''} ${item.excerpt || ''} ${item.keywords || ''}`,
    getTitle: (item) => item.title || '',
    getKind: (item) => item.kind || '',
    maxNeighbors: 5,
    maxCandidates: 240,
    maxCandidateTokens: 7,
    maxPostingRatio: .02,
    maxPostingAbsolute: 1000,
    minScore: 5,
    conceptKind: '__none__',
  })
  const relatedByIndex = new Map()
  for (const edge of similarity) {
    const list = relatedByIndex.get(edge.from) || []
    list.push(edge)
    relatedByIndex.set(edge.from, list)
  }
  for (let index = 0; index < indexed.length; index += 1) {
    const item = indexed[index]
    const related = (relatedByIndex.get(index) || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((edge) => indexed[edge.to])
      .filter(Boolean)
    item.related = related.map((candidate) => candidate.id)
    /* عناوين الامتدادات تُضاف للبحث وحده. وكانت تُلصق بالتصنيف بلا فاصل، فصار
       حقل التصنيف كتلةً من عناوين الأبحاث — و«أكثر موضوع يكتب عنه» يعرضها
       بوصفها «مسارات»، فيقرأ الزائر سطراً بطول فقرة. الفاصل «‖» يفصل تصنيف
       الدكتور عن حصيلة الرسم، فيقرأ العرضُ التصنيفَ ويقرأ البحثُ الاثنين. */
    const graphTitles = related.map((candidate) => candidate.title).join(' ')
    item.keywords = graphTitles ? `${String(item.keywords || '').trim()} ‖ ${graphTitles}`.trim() : String(item.keywords || '').trim()
    item.hash = hashItem({ ...item, hash: undefined })
  }
  return indexed
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
      insertFts.run(
        item.id,
        searchableField(item.title, 48),
        searchableField(item.excerpt, 96),
        searchableField(item.body, 320),
        searchableField(item.keywords, 64),
        item.kind,
      )
    }
  })
  db.setSetting('content.indexVersion', { at: new Date().toISOString(), count: items.length })
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
  /* الطلبات المركبة تضيف قيود النوع/الصوت بعد الاسترجاع؛ قصّ المرشحين عند 10
     كان يخفي تطابقات صحيحة موجودة أبعد في FTS. يبقى الافتراضي 3، والسقف 80. */
  const limit = Math.min(Math.max(Number(options.limit || 3), 1), 80)
  const tokens = [...new Set(text.split(/\s+/).flatMap((token) => {
    if (token.length <= 1) return []
    const root = toRoot(token)
    return root && root !== token ? [token, root] : [token]
  }).filter((token) => token.length > 1))].slice(0, 10)
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

  let result = rows.map(rowToItem)
  /* في سؤال موضوعي قصير، نقدّم المادة التي تحمل كلمات الموضوع نفسها في
     العنوان/الكلمات المفتاحية. يمنع جذر «الذكاء» من تقديم «الذكاء التعليمي»
     لسؤال «الذكاء الاصطناعي» لمجرد ورود العبارة في جسم مقال بعيد. */
  const topicNoise = new Set(['ابي', 'اريد', 'ابغي', 'ابغى', 'عندك', 'شي', 'شيء', 'عن', 'موضوع', 'حول', 'ماده'])
  const literalTopic = text.split(/\s+/).filter((token) => token.length > 1 && !topicNoise.has(token))
  if (literalTopic.length >= 1 && literalTopic.length <= 4) {
    const clauses = literalTopic.map(() => "lower(title||' '||keywords) LIKE ?").join(' AND ')
    const params = literalTopic.map((token) => `%${token.replace(/[%_]/g, '')}%`)
    const strict = db.all(`SELECT * FROM content_items WHERE ${clauses} ORDER BY date DESC LIMIT ?`, ...params, limit).map(rowToItem)
    if (strict.length) result = [...strict, ...result.filter((item) => !strict.some((match) => match.id === item.id))]
  }
  result = result.slice(0, limit)
  cache.set(cacheKey, result)
  if (cache.size > SEARCH_CACHE_LIMIT) cache.delete(cache.keys().next().value)
  return result
}

export function latestContent(db, kind, limit = 3) {
  const rows = db.all("SELECT * FROM content_items WHERE kind=? ORDER BY CASE WHEN date GLOB '[0-9]*' THEN date ELSE updated_at END DESC LIMIT ?", kind, Math.min(limit, 10))
  return rows.map(rowToItem)
}

export function latestAudioContent(db, voice = 'dialogue', limit = 3) {
  const rows = db.all(
    "SELECT * FROM content_items WHERE audio_json IS NOT NULL ORDER BY CASE WHEN date GLOB '[0-9]*' THEN date ELSE updated_at END DESC LIMIT 120",
  ).map(rowToItem)
  return rows
    .filter((item) => item?.audio?.[voice])
    .slice(0, Math.min(Math.max(Number(limit || 1), 1), 10))
}

export function shortReadableContent(db, limit = 3) {
  const rows = db.all(
    `SELECT * FROM content_items
     WHERE kind='article'
     ORDER BY
       CASE WHEN words BETWEEN 80 AND 360 THEN 0 ELSE 1 END,
       CASE WHEN date GLOB '[0-9]*' THEN date ELSE updated_at END DESC
     LIMIT 80`,
  ).map(rowToItem)
  return rows.slice(0, Math.min(Math.max(Number(limit || 1), 1), 10))
}

/**
 * لا ترتيبَ تقديرياً للمشاهدة.
 *
 * كان المحرك يصنع رقماً حتمياً من الـslug والعنوان ثم يسمّيه «مؤشر
 * مشاهدة». الرقم ثابت، لكنه ليس مشاهدةً ولم يأتِ من الموقع؛ وهذا يناقض
 * قاعدة البوت الأهم. المصدر المقبول الوحيد هنا لقطةٌ كتبها تقرير الموقع
 * المحلي بعد أن قرأ عدّاد Firestore الحقيقي. إن غابت اللقطة، نصرّح بغيابها
 * ولا نضع بديلاً متخيلاً.
 */
export function mostPopularContent(db, kind = 'article', limit = 3) {
  if (kind !== 'article') return { verified: false, items: [], reason: 'unsupported-kind' }
  const snapshot = db.getSetting('analytics.articleViews', null)
  const sourceOk = snapshot?.source === 'firestore:views:monthly'
  const periodOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(snapshot?.period || ''))
  const collectedAt = String(snapshot?.collectedAt || '')
  const dateOk = Number.isFinite(Date.parse(collectedAt))
  if (!sourceOk || !periodOk || !dateOk || !Array.isArray(snapshot?.items)) {
    return { verified: false, items: [], reason: 'missing-verified-snapshot' }
  }

  const safeRows = snapshot.items
    .map((entry) => {
      const path = String(entry?.path || '')
      const count = Number(entry?.count)
      if (!path.startsWith('/articles/') || !Number.isInteger(count) || count < 0) return null
      let slug = path.slice('/articles/'.length)
      try { slug = decodeURIComponent(slug) } catch { return null }
      if (!slug || slug.includes('/') || slug.includes('..')) return null
      const item = rowToItem(db.get("SELECT * FROM content_items WHERE kind='article' AND slug=?", slug))
      return item ? { ...item, verifiedViews: count } : null
    })
    .filter(Boolean)
    .sort((left, right) => right.verifiedViews - left.verifiedViews || String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, Math.min(Math.max(Number(limit || 1), 1), 10))

  return {
    verified: safeRows.length > 0,
    items: safeRows,
    source: snapshot.source,
    period: snapshot.period,
    collectedAt,
    reason: safeRows.length ? '' : 'empty-verified-snapshot',
  }
}

export function latestAcrossKinds(db, kinds = ['article', 'paper', 'book', 'podcast'], limit = 5) {
  const wanted = [...new Set(kinds)].filter(Boolean)
  if (!wanted.length) return []
  const placeholders = wanted.map(() => '?').join(',')
  const rows = db.all(
    `SELECT * FROM content_items WHERE kind IN (${placeholders}) ORDER BY CASE WHEN date GLOB '[0-9]*' THEN date ELSE updated_at END DESC LIMIT ?`,
    ...wanted,
    Math.min(Math.max(Number(limit || 1), 1), 12),
  )
  return rows.map(rowToItem)
}

/* المسار هو تصنيف الدكتور وحده — ما قبل الفاصل «‖» — لا حصيلة رسم المعرفة.
   والتجميع كان على النصّ الكامل فيصير لكل مقالٍ «مسارٌ» يخصّه وحده، فيقول
   البوت «أكثر المسارات حضوراً» ثم يعدّ واحداً واحداً. */
export function topArticleTopics(db, limit = 3) {
  const rows = db.all("SELECT keywords FROM content_items WHERE kind='article' AND trim(keywords)<>''") || []
  const counts = new Map()
  for (const row of rows) {
    const topic = String(row.keywords || '').split('‖')[0].trim()
    if (!topic) continue
    counts.set(topic, (counts.get(topic) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, Math.min(Math.max(Number(limit || 1), 1), 8))
}

/* «اكتب اسم أي مسار وأختار لك أفضل نقطة بداية» — وعدٌ كان يُخلَف: اسم المسار
   يذهب إلى البحث العام فيردّ بأبحاثٍ يتصادف ورودُ اللفظ في عناوينها. المسار
   يُقرأ من تصنيف الدكتور نفسه، ولا يُطابَق إلا مطابقةً تامة فلا يخطف كلمةً
   عامّة من سؤالٍ عادي. */
export function articlesByTopic(db, topic, limit = 3) {
  const wanted = normalizeArabic(topic)
  if (!wanted) return []
  const rows = db.all("SELECT * FROM content_items WHERE kind='article' AND trim(keywords)<>'' ORDER BY date DESC") || []
  return rows
    .filter((row) => normalizeArabic(String(row.keywords || '').split('‖')[0]) === wanted)
    .slice(0, Math.min(Math.max(Number(limit || 1), 1), 8))
    /* اسم المسار يُعاد بلفظه كما كتبه الدكتور — لا بصيغته المطبَّعة للمطابقة
       («التربيه» بلا تاء مربوطة كانت تُعرض على الزائر). */
    .map((row) => ({ ...rowToItem(row), topicLabel: String(row.keywords || '').split('‖')[0].trim() }))
}

export function contentSummary(item, maxSentences = 3) {
  if (!item) return ''
  const source = String(item.excerpt || item.body || '').replace(/\s+/g, ' ').trim()
  if (!source) return ''
  const parts = source.split(/(?<=[.!؟])/u).map((part) => part.trim()).filter(Boolean)
  return parts.slice(0, maxSentences).join(' ')
}

/* ── مفردات الدكتور ──
   لتصحيح ما يكتبه السائل نحتاج معجماً نقيس عليه. وهو موجود أصلاً: عناوين
   المواد وكلماتها المفتاحية، ومعجم المفاهيم بأسمائه العربية والإنجليزية.
   يُبنى مرةً لكل قاعدة ويُحفظ، فلا كلفةَ على كل رسالة. */
const vocabularyByDb = new WeakMap()

export function messageVocabulary(db) {
  if (!db) return new Set()
  const cached = vocabularyByDb.get(db)
  if (cached) return cached
  const words = new Set()
  const add = (value) => {
    for (const word of normalizeArabic(value).split(' ')) {
      if (word.length >= 4 && word.length <= 24) words.add(word)
    }
  }
  const rows = db.all('SELECT title, keywords FROM content_items') || []
  for (const row of rows) { add(row.title); add(String(row.keywords || '').split('‖').join(' ')) }
  try {
    const file = path.join(projectRoot, 'src', 'data', 'dr-ahmad-domain-glossary.json')
    const glossary = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Array.isArray(glossary)) {
      for (const entry of glossary) {
        add(entry?.canonicalAr)
        add(entry?.canonicalEn)
        for (const alias of Array.isArray(entry?.aliases) ? entry.aliases : []) add(alias)
      }
    }
  } catch { /* المعجم تحسينٌ للفهم، وغيابه لا يُسكت البوت. */ }
  vocabularyByDb.set(db, words)
  return words
}
