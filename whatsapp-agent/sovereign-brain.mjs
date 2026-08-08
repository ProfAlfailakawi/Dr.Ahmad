/**
 * عقل المكتبة السيادي لواتساب.
 *
 * لا يولّد معرفةً ولا يستدعي أي خدمة خارجية. يجمع جواباً واحداً من الشواهد
 * المنشورة نفسها: متن المقال/البحث، صفحة الكتاب، ثانية الفيديو أو الظهور
 * الإعلامي، وسطر الحوار المسموع. وتُحفظ «خريطة دليل» صغيرة في سياق المحادثة
 * حتى تفهم المتابعة الطبيعية: «وين قالها؟» · «الثاني» · «شغّل الفيديو».
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toRoot } from './dialect-lexicon.mjs'
import { conceptQueryFor } from './domain-concepts.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SITE_URL = 'https://dr-alfailakawi.com'
const MAX_TRAIL = 4
const MAX_EXCERPT = 230

const DATA_DIRS = [resolve(HERE, '../src/data'), resolve(process.cwd(), 'src/data')]
const dataCache = new Map()
function data(name, fallback) {
  if (dataCache.has(name)) return dataCache.get(name)
  const file = DATA_DIRS.map((dir) => resolve(dir, name)).find((candidate) => existsSync(candidate))
  let value = fallback
  try { if (file) value = JSON.parse(readFileSync(file, 'utf8')) } catch { /* يبقى الاحتياط الآمن */ }
  dataCache.set(name, value)
  return value
}

const normalize = (value = '') => String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

const STOP = new Set(normalize(`
  ابي ابغي ابغى اريد ودي ممكن تكفى تكفه لو سمحت عطني اعطني ورني جاوبني
  شنو وش ايش ماذا ما من هو هي هل كيف شلون لماذا ليش وين متى كم عن حول في
  على الى مع عند عندك عنده الدكتور د احمد الفيلكاوي موقع الموقع مكتبه المكتبه
  يقول قال كتب راي رأي كلام فكره فكرته موضوع شيء شي كل كامل كامله اجمع اربط
  دليل الدليل شواهد اثبات وضح اشرح لخص ابحث دور فتش ماده مواد منشور منشوراته
`).split(' '))

const distinct = (values) => [...new Set(values.filter(Boolean))]
const words = (value) => normalize(value).split(' ').filter(Boolean)
const literalTokens = (value) => distinct(words(value).filter((word) => word.length >= 2 && !STOP.has(word))).slice(0, 10)
const semanticTokens = (value) => distinct(words(value).flatMap((word) => {
  if (word.length < 2 || STOP.has(word)) return []
  const root = toRoot(word)
  return root && root !== word ? [word, root] : [word]
})).slice(0, 14)

function queryPlan(rawText = '') {
  const topic = extractSovereignTopic(rawText)
  const literal = literalTokens(topic)
  const semantic = semanticTokens(topic)
  const concept = conceptQueryFor(topic)
  const expanded = concept ? semanticTokens(concept.query) : []
  return { topic, literal, tokens: distinct([...semantic, ...expanded]).slice(0, 20), concept }
}

function semanticText(value = '') {
  /* جذور السؤال تُبحث كجزء من الكلمة العربية نفسها (تعليم داخل التعليمية).
     تجذير كل كلمة في ٩٣٦ مقطع فيديو وآلاف أسطر الحوار عند كل رسالة كان
     صحيحاً دلالياً لكنه بطيء جداً. تطبيع النص مرةً يكفي للمطابقة، بينما يبقى
     التجذير على كلمات السؤال القليلة فقط. */
  return normalize(value)
}

function scoreFields({ title = '', locator = '', text = '' }, plan) {
  const titleText = semanticText(title)
  const locatorText = semanticText(locator)
  const bodyText = semanticText(text)
  let score = 0
  let matched = 0
  let literalMatched = 0
  let substantiveLiteralMatched = 0
  for (const token of plan.tokens) {
    const inTitle = titleText.includes(token)
    const inLocator = locatorText.includes(token)
    const inBody = bodyText.includes(token)
    if (inTitle || inLocator || inBody) matched += 1
    if (inTitle) score += 9
    else if (inLocator) score += 6
    else if (inBody) score += 3
  }
  for (const token of plan.literal) {
    const inTitle = titleText.includes(token)
    const inBody = bodyText.includes(token)
    if (inTitle || locatorText.includes(token) || inBody) literalMatched += 1
    if (inTitle || inBody) substantiveLiteralMatched += 1
  }
  const phrase = normalize(plan.topic)
  if (phrase.length >= 6 && `${titleText} ${locatorText} ${bodyText}`.includes(phrase)) score += 18
  const required = Math.min(2, Math.max(1, plan.literal.length))
  /* طلبات الصوت الطبيعية تكون أحياناً كلمةً دلالية واحدة: «حوار عن الخوف».
     التطابق الحرفي الكامل لهذه الكلمة داخل السطر دليل كافٍ للاسترجاع، ثم
     يظل sourceBoost واختيار النوع المطلوب يمنعان خلطه بنتيجة عامة ضعيفة. */
  const exactSingle = plan.literal.length === 1 && substantiveLiteralMatched === 1
  return {
    score, matched, literalMatched, substantiveLiteralMatched,
    acceptable: (exactSingle && score >= 3)
      || (score >= 8 && (substantiveLiteralMatched >= required || (substantiveLiteralMatched >= 1 && matched >= 2))),
  }
}

function trimWords(value = '', maxChars = MAX_EXCERPT) {
  const clean = String(value).replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const cut = clean.slice(0, maxChars + 1)
  const boundary = Math.max(cut.lastIndexOf('،'), cut.lastIndexOf('؛'), cut.lastIndexOf('.'), cut.lastIndexOf(' '))
  return `${cut.slice(0, boundary >= Math.floor(maxChars * .62) ? boundary : maxChars).trim()}…`
}

function focusedExcerpt(value = '', plan, maxChars = MAX_EXCERPT) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const searchable = normalize(clean)
  const needles = distinct([...(plan?.literal || []), ...(plan?.tokens || [])])
    .filter((token) => token.length >= 2)
    .sort((left, right) => right.length - left.length)
  let found = -1
  for (const needle of needles) {
    const at = searchable.indexOf(needle)
    if (at >= 0 && (found < 0 || at < found)) found = at
  }
  if (found < 0) return trimWords(clean, maxChars)

  /* التطبيع يحذف التشكيل لكنه يحافظ غالباً على طول الحروف؛ النسبة تجعل
     القص آمناً حتى عندما يكون تشكيل النص الأصلي كثيفاً. */
  const approximate = Math.round(found * (clean.length / Math.max(1, searchable.length)))
  let start = Math.max(0, approximate - Math.floor(maxChars * .32))
  if (start > 0) {
    const boundary = clean.lastIndexOf(' ', start)
    if (boundary >= Math.max(0, start - 28)) start = boundary + 1
  }
  let excerpt = clean.slice(start, start + maxChars)
  if (start + maxChars < clean.length) {
    const boundary = excerpt.lastIndexOf(' ')
    if (boundary >= Math.floor(maxChars * .72)) excerpt = excerpt.slice(0, boundary)
  }
  return `${start > 0 ? '…' : ''}${excerpt.trim()}${start + excerpt.length < clean.length ? '…' : ''}`
}

function textUnits(value = '') {
  const source = String(value || '').trim()
  if (!source) return []
  const coarse = source.split(/\n\s*\n|(?<=[.!؟؛])\s+/u).map((part) => part.trim()).filter(Boolean)
  const units = []
  for (const part of coarse) {
    if (part.length <= 420) {
      if (part.length >= 28) units.push(part)
      continue
    }
    const tokens = part.split(/\s+/).filter(Boolean)
    for (let start = 0; start < tokens.length; start += 32) {
      const slice = tokens.slice(start, start + 48).join(' ')
      if (slice.length >= 28) units.push(slice)
      if (start + 48 >= tokens.length) break
    }
  }
  return units.slice(0, 180)
}

function bestUnit(value, title, locator, plan) {
  let best = null
  for (const text of textUnits(value)) {
    const scored = scoreFields({ title, locator, text }, plan)
    if (!scored.acceptable) continue
    if (!best || scored.score > best.score) best = { text: focusedExcerpt(text, plan), ...scored }
  }
  return best
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
const arabicNumber = (value) => String(Math.max(0, Math.round(Number(value) || 0))).replace(/\d/g, (digit) => ARABIC_DIGITS[Number(digit)])
function timeLabel(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${arabicNumber(minutes)}:${arabicNumber(rest).padStart(2, '٠')}`
}

function requestedKinds(rawText = '') {
  const clean = normalize(rawText)
  const kinds = new Set()
  if (/(?:كتاب|كتب|صفحه|باب|فصل)/.test(clean)) kinds.add('book')
  if (/(?:مقال|مقاله)/.test(clean)) kinds.add('article')
  if (/(?:بحث|ابحاث|دراسه|محكم)/.test(clean)) kinds.add('paper')
  if (/(?:فيديو|مقطع|شاهد|مشاهده|ظهور|لقاء|مقابله)/.test(clean)) { kinds.add('video'); kinds.add('media') }
  if (/(?:حوار|مسموع|صوت|اسمع|استمع|راديو|اذاعه)/.test(clean)) { kinds.add('dialogue'); kinds.add('media') }
  return kinds
}

function sourceBoost(kind, requested) {
  if (!requested.size) return 0
  return requested.has(kind) ? 18 : -3
}

function siteCandidates(items, plan, requested) {
  const rows = []
  for (const item of items || []) {
    if (!['article', 'paper', 'curated'].includes(item.kind)) continue
    const locator = item.kind === 'paper' ? 'بحث محكّم' : item.kind === 'article' ? 'مقال' : 'مختارة'
    const unit = bestUnit(item.body || item.excerpt, item.title, `${locator} ${item.keywords || ''}`, plan)
    if (!unit) continue
    rows.push({
      kind: item.kind,
      key: `${item.id}:text`,
      itemId: item.id,
      title: item.title,
      locator,
      excerpt: unit.text,
      url: item.url,
      score: unit.score + sourceBoost(item.kind, requested),
    })
  }
  return rows
}

function bookCandidates(plan, requested, siteUrl) {
  const rows = []
  const corpus = data('book-passages.json', { books: [] })
  for (const book of corpus.books || []) {
    for (const passage of book.passages || []) {
      const locator = `${passage.conceptTitle || passage.section || 'من الكتاب'} · صفحة ${passage.page || ''}`
      const unit = bestUnit(passage.text, book.title, locator, plan)
      if (!unit) continue
      rows.push({
        kind: 'book', key: `book:${book.slug}:${passage.id || passage.page}`,
        itemId: `book:${book.slug}`, title: book.title,
        locator: `ص ${arabicNumber(passage.page || 0)}${passage.conceptTitle ? ` · ${passage.conceptTitle}` : ''}`,
        excerpt: unit.text,
        url: `${siteUrl}/publications/${book.slug}#book-knowledge`,
        score: unit.score + 3 + Math.min(4, Math.round((Number(passage.voice) || 0) / 25)) + sourceBoost('book', requested),
      })
    }
  }
  return rows
}

const mediaLookupCache = new WeakMap()
function mediaLookup(items) {
  if (!Array.isArray(items)) return []
  if (mediaLookupCache.has(items)) return mediaLookupCache.get(items)
  const rows = items.filter((item) => item.kind === 'media').map((item) => ({ item, body: normalize(item.body || '') }))
  mediaLookupCache.set(items, rows)
  return rows
}

function mediaItemFor(items, sourceId, segmentText = '') {
  const rows = mediaLookup(items)
  const bySlug = rows.find(({ item }) => String(item.slug || '').includes(sourceId))?.item
  if (bySlug) return bySlug
  const needle = normalize(segmentText).slice(0, 90)
  if (!needle) return null
  return rows.find((row) => row.body.includes(needle))?.item || null
}

function mediaCandidates(items, plan, requested, siteUrl) {
  const rows = []
  const transcripts = data('media-archive-transcripts.json', {})
  for (const [sourceId, record] of Object.entries(transcripts)) {
    if (!record?.available || !Array.isArray(record.segments)) continue
    const item = mediaItemFor(items, sourceId, record.segments[0]?.displayText || record.segments[0]?.text || '')
    for (let index = 0; index < record.segments.length; index += 1) {
      const segment = record.segments[index]
      const text = segment.displayText || segment.text || ''
      const title = item?.title || record.title || 'ظهور إعلامي للدكتور'
      const locator = `ظهور إعلامي عند ${timeLabel(segment.start)}`
      const unit = bestUnit(text, title, locator, plan)
      if (!unit) continue
      const isYouTube = /^[\w-]{6,}$/.test(sourceId)
      rows.push({
        kind: 'media', key: `media:${sourceId}:${index}`,
        itemId: item?.id || '', title, locator,
        excerpt: unit.text,
        url: isYouTube
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(sourceId)}&t=${Math.max(0, Math.floor(Number(segment.start) || 0))}s`
          : (item?.url || `${siteUrl}/media`),
        score: unit.score + 4 + sourceBoost('media', requested),
      })
    }
  }
  return rows
}

function encyclopediaVideoCandidates(plan, requested, siteUrl) {
  const rows = []
  const records = data('encyclopedia-video-transcripts.json', { records: {} }).records || {}
  for (const [videoId, record] of Object.entries(records)) {
    if (!record?.available || !Array.isArray(record.segments)) continue
    for (let index = 0; index < record.segments.length; index += 1) {
      const segment = record.segments[index]
      if (segment.indexable === false) continue
      const title = record.chapterTitle || record.title || 'شرح من موسوعة تكنولوجيا التعليم'
      const map = [record.doorNumber ? `الباب ${record.doorNumber}` : '', record.chapterNumber ? `الفصل ${record.chapterNumber}` : ''].filter(Boolean).join(' · ')
      const locator = `${map ? `${map} · ` : ''}فيديو عند ${timeLabel(segment.start)}`
      const unit = bestUnit(segment.displayText || segment.text, title, locator, plan)
      if (!unit) continue
      rows.push({
        kind: 'video', key: `video:${videoId}:${index}`,
        itemId: 'book:encyclopedia', title, locator,
        excerpt: unit.text,
        url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Math.max(0, Math.floor(Number(segment.start) || 0))}s`,
        siteUrl: `${siteUrl}/publications/encyclopedia?tab=video#encyclopedia-map`,
        score: unit.score + 5 + sourceBoost('video', requested),
      })
    }
  }
  return rows
}

function dialogueCandidates(items, plan, requested, siteUrl) {
  const rows = []
  const episodes = data('spoken-index.json', { episodes: [] }).episodes || []
  const byId = new Map((items || []).map((item) => [item.id, item]))
  for (const episode of episodes) {
    const item = byId.get(`article:${episode.slug}`)
    for (let index = 0; index < (episode.lines || []).length; index += 1) {
      const line = episode.lines[index]
      const at = Number(line?.[0]) || 0
      const text = String(line?.[2] || '')
      const title = episode.title || item?.title || episode.slug
      const locator = `حوار مسموع عند ${timeLabel(at)}`
      const unit = bestUnit(text, title, locator, plan)
      if (!unit) continue
      rows.push({
        kind: 'dialogue', key: `dialogue:${episode.slug}:${index}`,
        itemId: item?.id || `article:${episode.slug}`, title, locator,
        excerpt: unit.text,
        url: item?.url ? `${item.url}#article-audio` : `${siteUrl}/articles/${episode.slug}#article-audio`,
        score: unit.score + 2 + sourceBoost('dialogue', requested),
      })
    }
  }
  /* قد يكون فهرس الثواني غير مولّد في نسخة Cloud Run بينما ملفات الحوار
     نفسها منشورة في listen-index. لا نخترع توقيتاً: نعيد الحوار الكامل مع
     مقتطف مؤسس من المقال الذي بُني منه، فيبقى طلب «أبي أسمع» صوتياً فعلاً. */
  if (!rows.length) {
    const published = data('listen-index.json', { episodes: [] }).episodes || []
    for (const episode of published) {
      const item = byId.get(`article:${episode.slug}`)
      if (!item?.body) continue
      const unit = bestUnit(item.body, episode.title || item.title, 'حوار مسموع كامل', plan)
      if (!unit) continue
      rows.push({
        kind: 'dialogue', key: `dialogue-full:${episode.slug}`,
        itemId: item.id, title: episode.title || item.title,
        locator: 'حوار مسموع كامل', excerpt: unit.text,
        url: `${item.url || `${siteUrl}/articles/${episode.slug}`}#article-audio`,
        score: unit.score + 1 + sourceBoost('dialogue', requested),
      })
    }
  }
  return rows
}

const SOURCE_LABEL = Object.freeze({
  article: 'مقال', paper: 'بحث محكّم', curated: 'مختارة', book: 'كتاب',
  media: 'ظهور إعلامي', video: 'فيديو داخل الموسوعة', dialogue: 'حوار مسموع',
})

function selectEvidence(candidates, requested) {
  const unique = new Map()
  for (const row of candidates.sort((left, right) => right.score - left.score)) {
    if (!row.excerpt || !row.url || unique.has(row.key)) continue
    unique.set(row.key, row)
  }
  const rows = [...unique.values()]
  if (!rows.length) return []
  const top = rows[0].score
  const eligible = rows.filter((row) => row.score >= Math.max(8, top * .48))
  const selected = []
  const usedKinds = new Set()
  const overlapsExisting = (row) => {
    const current = new Set(words(row.excerpt).filter((word) => word.length >= 3))
    const signature = normalize(row.excerpt)
    return selected.some((item) => {
      const previousSignature = normalize(item.excerpt)
      if (signature === previousSignature || signature.includes(previousSignature) || previousSignature.includes(signature)) return true
      const previous = new Set(words(item.excerpt).filter((word) => word.length >= 3))
      const shared = [...current].filter((word) => previous.has(word)).length
      return shared / Math.max(1, Math.min(current.size, previous.size)) >= .78
    })
  }
  const add = (row) => {
    if (!row || selected.some((item) => item.key === row.key) || overlapsExisting(row)) return
    selected.push(row); usedKinds.add(row.kind)
  }
  if (requested.size) {
    /* الطلب الصريح للمصدر مقدّم على عتبة المزج العام. قد تكون فقرة ظهور
       إعلامي أعلى نقاطاً من حوارٍ مسموع، لكن «أبي أسمع حوار» يجب أن يعيد
       حواراً فعلياً ما دام محرك المطابقة وجد شاهداً صالحاً. */
    for (const kind of requested) add(rows.find((row) => row.kind === kind))
  }
  add(eligible[0])
  for (const row of eligible) {
    if (selected.length >= MAX_TRAIL) break
    if (!usedKinds.has(row.kind)) add(row)
  }
  for (const row of eligible) {
    if (selected.length >= MAX_TRAIL) break
    add(row)
  }
  return selected.slice(0, MAX_TRAIL)
}

function evidenceTrail(rows) {
  return rows.slice(0, MAX_TRAIL).map((row) => ({
    kind: row.kind, key: String(row.key).slice(0, 180), itemId: String(row.itemId || '').slice(0, 180),
    title: String(row.title || '').slice(0, 180), locator: String(row.locator || '').slice(0, 160),
    excerpt: trimWords(row.excerpt, MAX_EXCERPT), url: String(row.url || '').slice(0, 600),
    ...(row.siteUrl ? { siteUrl: String(row.siteUrl).slice(0, 600) } : {}),
  }))
}

function digestOf(rows) {
  const first = trimWords(rows[0]?.excerpt || '', 250)
  const second = rows.find((row) => row.kind !== rows[0]?.kind)?.excerpt || rows[1]?.excerpt || ''
  return [first ? `«${first}»` : '', second ? `وتكملها زاوية ثانية: «${trimWords(second, 185)}»` : ''].filter(Boolean).join('\n')
}

function evidenceBlock(row, index, { compact = false } = {}) {
  const title = `${arabicNumber(index + 1)}) *${SOURCE_LABEL[row.kind] || 'مصدر'} — ${row.title}*`
  const quote = compact ? '' : `\n«${trimWords(row.excerpt, 180)}»`
  const site = row.siteUrl ? `\nداخل الموقع: ${row.siteUrl}` : ''
  return `${title}\n${row.locator}${quote}\n${row.url}${site}`
}

export function extractSovereignTopic(rawText = '') {
  return normalize(rawText)
    .replace(/^(?:ابي|ابغي|ابغى|اريد|ودي|ممكن)\s+(?:اسمع|استمع)\s+(?:حوار|صوت|تسجيل)?\s*(?:عن|حول|في)\s+/, '')
    .replace(/^(?:ابي|ابغي|ابغى|اريد|ودي|ممكن|عطني|اعطني|ورني|هات)\s+(?:فيديو|مقطع|حوار|صوت|تسجيل)\s+(?:عن|حول|في)\s+/, '')
    .replace(/^(?:ابي|ابغي|ابغى|اريد|ودي|ممكن|لو سمحت|تكفى|تكفه)\s+/, '')
    .replace(/^(?:جاوبني|اعطني جواب|عطني جواب|اجمع لي|اجمعلي|اربط لي|اربطلي|حلل لي|حلللي)\s+/, '')
    .replace(/^(?:من كل الموقع|من الموقع كامل|من كتبه ومقالاته|من منشورات الدكتور)\s*[:،-]?\s*/, '')
    .replace(/^(?:شنو|وش|ايش|ماذا|ما)\s+(?:يقول|قال|كتب|راي|رأي)\s+(?:الدكتور\s+)?(?:عن|في)\s+/, '')
    .replace(/^(?:وين|اين)\s+(?:قال|كتب|تكلم)\s+(?:الدكتور\s+)?(?:عن\s+)?/, '')
    .replace(/^(?:كيف|شلون|ليش|لماذا|هل)\s+/, '')
    .replace(/\b(?:من كل الموقع|من كتبه ومقالاته|مع الدليل|بالدليل|مع الشواهد|بالمصادر)\b/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function isSovereignQuestion(rawText = '') {
  const clean = normalize(rawText)
  if (clean.length < 5) return false
  return /(?:جاوبني|اعطني جواب|عطني جواب|اجمع|اربط|حلل|من كل الموقع|من الموقع كامل|من كتبه ومقالاته|مع الدليل|بالدليل|مع الشواهد|بالمصادر)/.test(clean)
    || /^(?:شنو|وش|ايش|ماذا|ما)\s+(?:يقول|قال|كتب|راي)/.test(clean)
    || /^(?:وين|اين)\s+(?:قال|كتب|تكلم).+/.test(clean)
    || /^(?:كيف|شلون|ليش|لماذا)\s+.{5,}/.test(clean)
    || /^(?:ابي|ابغي|ابغى|اريد|ودي|ممكن|عطني|اعطني|ورني|هات)\s+(?:فيديو|مقطع|حوار|صوت|تسجيل)\s+(?:عن|حول|في)\s+.{3,}/.test(clean)
    || /^(?:ابي|ابغي|ابغى|اريد|ودي|ممكن)\s+(?:اسمع|استمع)\s+(?:حوار|صوت|تسجيل)?\s*(?:عن|حول|في)\s+.{3,}/.test(clean)
}

export function sovereignAnswer({ text = '', items = [], conversation = {}, siteUrl = DEFAULT_SITE_URL } = {}) {
  const contextual = normalize(text).match(/^(?:وش|شنو|ايش|ما)\s+(?:علاقته|علاقتها|علاقه هذا|علاقه هذي)\s+(?:ب|مع)\s*(.+)$/)?.[1]
  const contextualTopic = contextual && conversation.sovereignTopic
    ? `${conversation.sovereignTopic} ${contextual}`
    : ''
  if (!contextualTopic && !isSovereignQuestion(text)) return null
  const query = contextualTopic || text
  const plan = queryPlan(query)
  if (!plan.literal.length) return null
  const requested = requestedKinds(text)
  const candidates = [
    ...siteCandidates(items, plan, requested),
    ...bookCandidates(plan, requested, siteUrl),
    ...mediaCandidates(items, plan, requested, siteUrl),
    ...encyclopediaVideoCandidates(plan, requested, siteUrl),
    ...dialogueCandidates(items, plan, requested, siteUrl),
  ]
  const selected = selectEvidence(candidates, requested)
  const minimum = requested.size ? 1 : 2
  if (selected.length < minimum) return null
  const trail = evidenceTrail(selected)
  const digest = digestOf(trail)
  const rendered = trail.slice(0, 3).map((row, index) => evidenceBlock(row, index)).join('\n\n')
  const kinds = distinct(trail.map((row) => SOURCE_LABEL[row.kind])).join(' و')
  const topic = plan.topic || String(conversation.sovereignTopic || '')
  const opener = contextualTopic
    ? `ربطت سؤالك الجديد بما كنا نتكلم عنه في «${conversation.sovereignTopic}».`
    : `لقيت الجواب ممتداً في ${kinds} — مو في رابط واحد.`
  return {
    reason: contextualTopic ? 'sovereign-context-bridge' : 'sovereign-synthesis',
    reply: `${opener}\n\n*الزبدة من نصوص الدكتور نفسها:*\n${digest}\n\n*الشواهد الدقيقة:*\n${rendered}\n\nقل لي «وين قالها؟» للتوثيق المختصر، أو «الفيديو»/«الكتاب» لأفتح الدليل المطلوب مباشرة.`,
    evidence: distinct(trail.map((row) => row.itemId)),
    contextItemIds: distinct(trail.map((row) => row.itemId)).slice(0, 12),
    contextIndex: 0,
    lastTopic: topic,
    patch: { sovereignTrail: trail, sovereignDigest: digest, sovereignTopic: topic, sovereignIndex: 0 },
  }
}

function cleanTrail(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_TRAIL).filter((row) => row && row.title && row.url).map((row) => ({
    kind: String(row.kind || ''), key: String(row.key || ''), itemId: String(row.itemId || ''),
    title: String(row.title || '').slice(0, 180), locator: String(row.locator || '').slice(0, 160),
    excerpt: trimWords(row.excerpt, MAX_EXCERPT), url: String(row.url || '').slice(0, 600),
    ...(row.siteUrl ? { siteUrl: String(row.siteUrl).slice(0, 600) } : {}),
  }))
}

function requestedTrailIndex(clean, trail, current) {
  const ordinal = [
    [/(?:^|\s)(?:الاول|اولا|1)(?:\s|$)/, 0],
    [/(?:^|\s)(?:الثاني|ثانيا|2)(?:\s|$)/, 1],
    [/(?:^|\s)(?:الثالث|ثالثا|3)(?:\s|$)/, 2],
    [/(?:^|\s)(?:الرابع|رابعا|4)(?:\s|$)/, 3],
  ].find(([pattern]) => pattern.test(clean))?.[1]
  if (Number.isInteger(ordinal)) return Math.min(trail.length - 1, ordinal)
  if (/(?:اللي بعده|التالي|بعده)/.test(clean)) return Math.min(trail.length - 1, current + 1)
  if (/(?:اللي قبله|السابق|قبله)/.test(clean)) return Math.max(0, current - 1)
  const kind = [
    [/(?:فيديو|المقطع|مشاهده)/, ['video', 'media']],
    [/(?:كتاب|الصفحه|الباب|الفصل)/, ['book']],
    [/(?:بحث|الدراسه)/, ['paper']],
    [/(?:مقال|المقاله)/, ['article']],
    [/(?:حوار|الصوت|مسموع|راديو|اذاعه)/, ['dialogue', 'media']],
  ].find(([pattern]) => pattern.test(clean))?.[1]
  if (kind) {
    const index = trail.findIndex((row) => kind.includes(row.kind))
    if (index >= 0) return index
  }
  return current
}

export function sovereignFollowup({ text = '', conversation = {} } = {}) {
  if (!String(conversation.lastDecisionReason || '').startsWith('sovereign-')) return null
  const trail = cleanTrail(conversation.sovereignTrail)
  if (!trail.length) return null
  const clean = normalize(text)
  const current = Math.max(0, Math.min(trail.length - 1, Number(conversation.sovereignIndex || 0)))
  const index = requestedTrailIndex(clean, trail, current)
  const selected = trail[index]
  const isSummary = /^(?:لخص|لخصها|لخصه|اختصر|اختصرها|اختصره|الزبده|زبده|باختصار|الخلاصه)[!.؟]*$/.test(clean)
  if (isSummary) return {
    reason: 'sovereign-summary',
    reply: `الزبدة من الشواهد التي جمعناها:\n\n${String(conversation.sovereignDigest || `«${selected.excerpt}»`).slice(0, 700)}\n\nوإذا تبي التوثيق قل لي «وين قالها؟».`,
    evidence: distinct(trail.map((row) => row.itemId)), contextItemIds: distinct(trail.map((row) => row.itemId)), contextIndex: 0,
    lastTopic: conversation.sovereignTopic, patch: { sovereignIndex: index },
  }
  const isProof = /(?:وين قال|اين قال|المصدر|الدليل|اثبت|التوثيق|الصفحه|الدقيقه|التوقيت)/.test(clean)
  if (isProof) return {
    reason: 'sovereign-proof',
    reply: `هذا التوثيق بلا اختصار:\n\n${trail.map((row, rowIndex) => evidenceBlock(row, rowIndex, { compact: true })).join('\n\n')}`,
    evidence: distinct(trail.map((row) => row.itemId)), contextItemIds: distinct(trail.map((row) => row.itemId)), contextIndex: 0,
    lastTopic: conversation.sovereignTopic, patch: { sovereignIndex: index },
  }
  const isOpen = /(?:افتح|شغل|شغله|شغلها|ودني|الرابط|اشوف|اسمع|استمع)/.test(clean)
  const isSelection = index !== current || /^(?:الفيديو|المقطع|الكتاب|المقال|المقاله|البحث|الحوار|الصوت|الراديو)[!.؟]*$/.test(clean)
  if (isOpen || isSelection) return {
    reason: isOpen ? 'sovereign-open-evidence' : 'sovereign-select-evidence',
    reply: `${isOpen ? 'هذا هو الدليل المطلوب مباشرة:' : 'اخترت لك هذا الشاهد:'}\n\n${evidenceBlock(selected, index)}`,
    evidence: selected.itemId ? [selected.itemId] : [], contextItemIds: selected.itemId ? [selected.itemId] : distinct(trail.map((row) => row.itemId)), contextIndex: 0,
    lastTopic: conversation.sovereignTopic, patch: { sovereignIndex: index },
  }
  return null
}

export const sovereignBrainPolicy = Object.freeze({
  externalAi: false,
  productionWrites: false,
  maxEvidence: MAX_TRAIL,
  sources: ['article', 'paper', 'book', 'media', 'video', 'dialogue'],
  exactLocators: ['page', 'second', 'published-url'],
})
