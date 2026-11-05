import lexicon from './mihwar-lexicon.json' with { type: 'json' }
// منطق «مِحور» المشترك بين المتصفح وسكربت الجلب الخادمي.
// لا يعتمد على أي مكتبة، ويعمل في Node والمتصفح بالسلوك نفسه.

export const MAX_FUTURE_SKEW_MS = 36 * 3600 * 1000

/** اهتمامات مستخرجة من الموقع (السيرة، الأبحاث، الكتب، المقالات، الخريطة الفكرية). */
export const DEFAULT_INTERESTS = [
  { id: 'edtech', name: 'تكنولوجيا التعليم', source: 'السيرة والأبحاث', active: true,
    phrases: ['educational technology', 'education technology', '!edtech', 'learning technology', 'instructional technology', 'تكنولوجيا التعليم', 'التقنيات التعليمية', 'التقنية التعليمية', 'learning management system', 'نظام إدارة التعلم', '!moodle', 'mobile learning', 'smart device + learning'],
    exclude: ['stock market', 'cryptocurrency'] },
  { id: 'ai-edu', name: 'الذكاء الاصطناعي والتعليم', source: 'المقالات والكتب', active: true,
    phrases: ['artificial intelligence + education', 'generative ai + education', 'ai + classroom', 'ai + students', 'ai + teaching', 'ai + university', 'chatgpt + students', 'chatgpt + education', 'large language model + education', 'ai tutor', 'ai tutoring', 'ai literacy', 'الذكاء الاصطناعي + التعليم', 'الذكاء الاصطناعي + الطلاب', 'الذكاء الاصطناعي + الجامعة', 'الذكاء الاصطناعي التوليدي', 'وكلاء الذكاء الاصطناعي', 'ai agents + education'] },
  { id: 'integrity', name: 'النزاهة الأكاديمية والتقويم', source: 'الخريطة الفكرية', active: true,
    phrases: ['academic integrity', 'plagiarism detection', 'plagiarism + ai', 'automated grading', 'automated essay scoring', 'alternative assessment', 'authentic assessment', 'assessment + generative ai', '!الانتحال', 'النزاهة الأكاديمية', 'التقويم البديل', 'التصحيح الآلي'] },
  { id: 'e-learning', name: 'التعلّم الرقمي والتعلّم عن بُعد', source: 'الأبحاث المنشورة', active: true,
    phrases: ['e-learning', '!elearning', 'digital learning', 'online learning', 'distance learning', 'distance education', 'blended learning', 'remote learning', '!mooc', 'التعلم الرقمي', 'التعلم الإلكتروني', 'التعلم عن بعد', 'التعليم عن بعد', 'التعلم المدمج', '!connectivism', 'self-determined learning', '!heutagogy', '!الاتصالية'] },
  { id: 'xr', name: 'الواقع المعزز والتقنيات الغامرة', source: 'الأبحاث المنشورة', active: true,
    phrases: ['augmented reality + education', 'augmented reality + learning', 'virtual reality + education', 'virtual reality + learning', 'immersive learning', 'الواقع المعزز', 'الواقع الافتراضي + التعليم'] },
  { id: 'gamification', name: 'التلعيب والتعلّم بالألعاب', source: 'الكتب', active: true,
    phrases: ['!gamification', 'game-based learning', 'educational games', 'serious games', '!التلعيب', 'التعلم القائم على الألعاب'] },
  { id: 'access', name: 'الإتاحة والتعليم الدامج', source: 'الأبحاث المنشورة', active: true,
    phrases: ['inclusive education', 'assistive technology', 'universal design for learning', 'digital accessibility', 'accessible learning', 'special needs + technology', 'students with disabilities', 'digital divide', 'الفجوة الرقمية', 'التعليم الدامج', 'ذوي الاحتياجات الخاصة', 'الإتاحة الرقمية'] },
  { id: 'media-culture', name: 'الإعلام والثقافة والمجتمع', source: 'المقالات والإعلام', active: true,
    phrases: ['media literacy', 'digital literacy', 'information literacy', 'misinformation + education', 'media + education', 'children + technology', 'screen time', 'social media + students', 'culture + education', 'الثقافة الإعلامية', 'التربية الإعلامية', 'الأطفال + التكنولوجيا', 'وسائل التواصل + الطلاب', 'الثقافة + التعليم'] },
  { id: 'academia', name: 'البحث الأكاديمي والتعليم العالي', source: 'السيرة الأكاديمية', active: true,
    phrases: ['higher education + technology', 'higher education + digital', 'university teaching', 'academic publishing', 'open access', 'research methods', 'peer review', 'scholarly communication', 'research evaluation', 'faculty development', 'learning analytics', 'التعليم العالي', 'النشر العلمي', 'البحث العلمي', 'أعضاء هيئة التدريس'] },
  { id: 'gulf', name: 'الكويت والخليج والعالم العربي', source: 'الأبحاث والمقالات', active: true,
    phrases: ['kuwait + education', 'kuwait + university', 'gulf + education', 'arab + education', 'arab world + higher education', 'الكويت + التعليم', 'الكويت + الجامعة', 'الخليج + التعليم', 'التعليم في الوطن العربي'] },
]

const AR_DIACRITICS = /[ً-ٰٟـ]/g

export function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/<[^>]*>/g, ' ')
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .toLowerCase()
}

function stem(token) {
  if (/^[a-z]+$/.test(token) && token.length > 4) {
    if (token.endsWith('ies')) return token.slice(0, -3) + 'y'
    if (token.endsWith('es') && /(ss|sh|ch|x)es$/.test(token)) return token.slice(0, -2)
    if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
    return token
  }
  if (/^[؀-ۿ]+$/.test(token) && token.length > 4) {
    let out = token
    if (out.startsWith('وال')) out = out.slice(3)
    else if (out.startsWith('بال') || out.startsWith('لل') || out.startsWith('كال')) out = out.slice(out.startsWith('لل') ? 2 : 3)
    else if (out.startsWith('ال')) out = out.slice(2)
    return out
  }
  return token
}

export function tokenize(value) {
  return (normalizeText(value).match(/[a-z0-9]+(?:[-'][a-z0-9]+)*|[؀-ۿ]+/g) || [])
    .flatMap((t) => (t.includes('-') ? [t, ...t.split('-')] : [t]))
    .map(stem)
}

const PHRASE_CACHE = new Map()
function phraseTokens(phrase) {
  let out = PHRASE_CACHE.get(phrase)
  if (!out) { out = tokenize(phrase).filter(Boolean); if (PHRASE_CACHE.size > 2000) PHRASE_CACHE.clear(); PHRASE_CACHE.set(phrase, out) }
  return out
}
const ITEM_CACHE = new WeakMap()
function itemTokens(item) {
  let hit = ITEM_CACHE.get(item)
  if (!hit || hit.sig !== item.title + '|' + item.description) {
    hit = { sig: item.title + '|' + item.description, title: tokenize(item.title), body: tokenize([item.description, item.keywords, item.venue].filter(Boolean).join(' ')) }
    ITEM_CACHE.set(item, hit)
  }
  return hit
}

function containsSequence(tokens, seq) {
  if (!seq.length || seq.length > tokens.length) return false
  outer: for (let i = 0; i <= tokens.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) if (tokens[i + j] !== seq[j]) continue outer
    return true
  }
  return false
}

/** عبارة واحدة أو «أ + ب» (يجب ظهور الطرفين). تُرجع {hit, weight}. */
function matchPhrase(phrase, titleTokens, bodyTokens) {
  // «!كلمة» تعني كلمة مفردة مميِّزة (مثل gamification) تُعامل كعبارة قوية.
  const distinctive = String(phrase).trim().startsWith('!')
  const parts = String(phrase).replace(/^\s*!/, '').split('+').map((p) => phraseTokens(p)).filter((p) => p.length)
  if (!parts.length) return null
  const strong = distinctive || parts.length > 1 || parts[0].length > 1
  const inTitle = parts.every((seq) => containsSequence(titleTokens, seq))
  const all = bodyTokens.length ? [...titleTokens, ...bodyTokens] : titleTokens
  const inAny = parts.every((seq) => containsSequence(all, seq))
  if (!inAny) return null
  // كلمة مفردة (مثل learning) لا تكفي وحدها أبداً.
  const weight = strong ? (inTitle ? 3 : 2) : (inTitle ? 1 : 0.5)
  return { weight, inTitle, strong }
}

// ---------- قاموس الموقع: المصطلحات ومرادفاتها ----------
// عبارة الاهتمام (كاملة) إذا طابقت مصطلحاً في القاموس صارت مرادفاته بدائل لها.
// المرادف المفرد القصير (مثل AR أو جدول) لا يُستعمل أبداً لأنه ملتبس.
let SYN_INDEX = null
function usableSynonym(term) {
  const toks = tokenize(term)
  if (!toks.length) return false
  if (toks.length > 1) return normalizeText(term).replace(/\s+/g, '').length >= 8
  return toks[0].length >= 7
}
function synonymIndex() {
  if (SYN_INDEX) return SYN_INDEX
  SYN_INDEX = new Map()
  for (const group of lexicon.groups) {
    const targets = group.terms.filter(usableSynonym)
    if (!targets.length) continue
    for (const term of group.terms) {
      const key = tokenize(term).join(' ')
      if (key.replace(/\s+/g, '').length < 4) continue // مفتاح قصير ملتبس (AI، AR…)
      const list = SYN_INDEX.get(key) || []
      for (const other of targets) if (other !== term && !list.includes(other)) list.push(other)
      SYN_INDEX.set(key, list)
    }
  }
  return SYN_INDEX
}

/** بدائل عبارة اهتمام من القاموس (للعبارات البسيطة دون «+»). */
export function expandPhrase(phrase) {
  const raw = String(phrase || '')
  if (raw.includes('+')) return []
  const strong = raw.trim().startsWith('!')
  const key = tokenize(raw.replace(/^\s*!/, '')).join(' ')
  const list = synonymIndex().get(key) || []
  return list.slice(0, 12).map((term) => (strong ? '!' + term : term))
}

/**
 * تقدير الصلة. العتبة 2: عبارة قوية في المتن، أو عبارة قوية في العنوان،
 * أو عدّة إشارات ضعيفة من اهتمامات مختلفة. لا تكفي كلمة مفردة.
 */
export function scoreItem(item, interests, projects = []) {
  const { title: titleTokens, body: bodyTokens } = itemTokens(item)
  const reasons = []
  let total = 0
  for (const interest of interests) {
    if (interest.active === false) continue
    const excluded = (interest.exclude || []).some((p) => matchPhrase(p, titleTokens, []))
    if (excluded) continue
    let best = null
    let sum = 0
    for (const phrase of interest.phrases || interest.terms || []) {
      let m = matchPhrase(phrase, titleTokens, bodyTokens)
      let shown = phrase, via = ''
      if (!m) {
        for (const alt of expandPhrase(phrase)) {
          const a = matchPhrase(alt, titleTokens, bodyTokens)
          if (a && (!m || a.weight > m.weight)) { m = a; shown = alt; via = String(phrase).replace(/^\s*!/, '') }
        }
      }
      if (!m) continue
      sum += m.weight
      if (!best || m.weight > best.m.weight) best = { phrase: shown, via, m }
    }
    if (best && sum >= 2) {
      total += Math.min(sum, 6)
      const where = best.m.inTitle ? 'في العنوان' : 'في الملخص أو الوسوم'
      reasons.push({ interest: interest.name, phrase: String(best.phrase).replace(/^\s*!/, '').replace(/\s*\+\s*/g, ' + '), where, weight: sum, ...(best.via ? { via: best.via } : {}) })
    }
  }
  for (const project of projects) {
    for (const keyword of String(project.keywords || '').split(/[,،]/).map((k) => k.trim()).filter(Boolean)) {
      const m = matchPhrase(keyword, titleTokens, bodyTokens)
      if (m && (m.strong || m.inTitle)) { total += 3; reasons.push({ interest: 'مشروع: ' + project.title, phrase: keyword, where: m.inTitle ? 'في العنوان' : 'في الملخص', weight: 3, project: project.id }); break }
    }
  }
  reasons.sort((a, b) => b.weight - a.weight)
  return { relevant: total >= 2, total, reasons }
}

export function reasonText(reasons) {
  if (!reasons?.length) return ''
  const r = reasons[0]
  const extra = reasons.length > 1 ? ' + ' + (reasons.length - 1) + ' اهتمامات أخرى' : ''
  const syn = r.via ? ` (مرادف «${r.via}» في قاموسك)` : ''
  return `سبب الظهور: ${r.interest} — العبارة «${r.phrase}»${syn} ${r.where}${extra}`
}

// ---------- روابط وتواريخ ومعرّفات ----------

export function safeUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (url.username || url.password) return ''
    if (/^(localhost|127\.|10\.|192\.168\.|0\.0\.0\.0|169\.254\.)/i.test(url.hostname)) return ''
    return url.href
  } catch { return '' }
}

export function canonicalUrl(value) {
  const href = safeUrl(value)
  if (!href) return ''
  const url = new URL(href)
  url.hash = ''
  url.protocol = 'https:'
  url.hostname = url.hostname.replace(/^www\./, '')
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) url.searchParams.delete(key)
  let out = url.toString().replace(/\/$/, '')
  if (/^https:\/\/(dx\.)?doi\.org\//i.test(out)) out = 'https://doi.org/' + decodeURIComponent(out.replace(/^https:\/\/(dx\.)?doi\.org\//i, '')).toLowerCase()
  return out
}

export function hashString(value) {
  let h1 = 0xdeadbeef ^ value.length
  let h2 = 0x41c6ce57 ^ value.length
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export const itemIdFor = (url, title) => 'i_' + hashString(canonicalUrl(url) || normalizeText(title))
export const titleKey = (title) => tokenize(title).slice(0, 14).join(' ')

/** تاريخ ISO صالح غير مستقبلي (مع هامش للمناطق الزمنية)، وإلا null. */
export function validPastDate(value, now = Date.now()) {
  if (!value) return null
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return null
  if (ms > now + MAX_FUTURE_SKEW_MS) return null
  if (ms < Date.UTC(1990, 0, 1)) return null
  return new Date(ms).toISOString()
}

export function validFutureOrRecent(value) {
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) && ms > Date.UTC(2000, 0, 1) && ms < Date.UTC(2100, 0, 1)
}

export const stripHtml = (value, max = 400) =>
  String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)) } catch { return '' } })
    .replace(/\s+/g, ' ').trim().slice(0, max)

/** الحدّ الأدنى لقبول مادة واردة من مصدر خارجي (تُعامل كبيانات غير موثوقة). */
export function sanitizeItem(raw, now = Date.now()) {
  const url = safeUrl(raw.url)
  const title = stripHtml(raw.title, 300)
  if (!url || !title || title.length < 8) return null
  const published = validPastDate(raw.published, now)
  const item = {
    id: itemIdFor(url, title),
    title,
    url,
    source: stripHtml(raw.source, 120) || 'مصدر غير محدد',
    sourceId: String(raw.sourceId || '').slice(0, 40),
    type: ['بحث', 'مقال', 'خبر', 'مؤتمر', 'فرصة'].includes(raw.type) ? raw.type : 'مقال',
    language: /^(ar|en)/i.test(raw.language || '') ? String(raw.language).slice(0, 2).toLowerCase() : (/[؀-ۿ]/.test(title) ? 'ar' : 'en'),
    published,
    fetched: raw.fetched || new Date(now).toISOString(),
    description: stripHtml(raw.description, 420),
    keywords: stripHtml(raw.keywords, 200),
  }
  if (raw.venue) item.venue = stripHtml(raw.venue, 120)
  const year = Number(raw.year); const month = Number(raw.month)
  if (Number.isInteger(year) && year >= 1990 && year <= new Date(now).getUTCFullYear()) { item.year = year; if (Number.isInteger(month) && month >= 1 && month <= 12 && Date.UTC(year, month - 1, 1) <= now) item.month = month }
  if (raw.type === 'مؤتمر' || raw.type === 'فرصة') {
    item.deadline = raw.deadline && validFutureOrRecent(raw.deadline) ? new Date(raw.deadline).toISOString().slice(0, 10) : null
    item.eventStart = raw.eventStart && validFutureOrRecent(raw.eventStart) ? new Date(raw.eventStart).toISOString().slice(0, 10) : null
    item.eventEnd = raw.eventEnd && validFutureOrRecent(raw.eventEnd) ? new Date(raw.eventEnd).toISOString().slice(0, 10) : null
    item.location = stripHtml(raw.location, 120)
    item.mode = ['حضوري', 'عن بُعد', 'هجين', 'غير محدد'].includes(raw.mode) ? raw.mode : 'غير محدد'
    item.officialUrl = safeUrl(raw.officialUrl) || null
    item.deadlineNote = stripHtml(raw.deadlineNote, 160)
  }
  return item
}

/** تاريخ تقريبي للترتيب والحداثة فقط (لا يُعرض كتاريخ دقيق): الدقيق، وإلا منتصف الشهر المعلن. */
export function approxDate(item) {
  if (item.published) return item.published
  if (item.year && item.month) return new Date(Date.UTC(item.year, item.month - 1, 15)).toISOString()
  return null
}

export function dedupe(items) {
  const byId = new Map()
  const byTitle = new Map()
  for (const item of items) {
    const key = titleKey(item.title)
    const existing = byId.get(item.id) || (key.length > 24 ? byTitle.get(key) : null)
    if (existing) {
      if (!existing.published && item.published) existing.published = item.published
      if (!existing.description && item.description) existing.description = item.description
      if (item.type === 'بحث' && existing.type !== 'بحث') existing.type = item.type
      existing.alsoIn = [...new Set([...(existing.alsoIn || []), item.source])].filter((s) => s !== existing.source).slice(0, 4)
      continue
    }
    byId.set(item.id, item)
    if (key.length > 24) byTitle.set(key, item)
  }
  return [...byId.values()]
}

// ---------- مواعيد المؤتمرات ----------

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

/** «Dec 26, 2026» → 2026-12-26 */
export function parseEnglishDate(text) {
  const m = String(text || '').match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})\b/i)
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase().slice(0, 3)]
  return new Date(Date.UTC(Number(m[3]), month, Number(m[2]))).toISOString().slice(0, 10)
}

export const daysUntil = (isoDate, now = Date.now()) => {
  const ms = new Date(isoDate + (isoDate.length === 10 ? 'T23:59:59Z' : '')).getTime()
  return Number.isFinite(ms) ? Math.ceil((ms - now) / 86400000) : null
}

export function deadlineStatus(item, now = Date.now()) {
  if (!item.deadline) return { code: 'unknown', label: 'الموعد غير مؤكد', tone: 'warn' }
  const d = daysUntil(item.deadline, now)
  if (d === null) return { code: 'unknown', label: 'الموعد غير مؤكد', tone: 'warn' }
  if (d < 0) return { code: 'expired', label: 'انتهى الموعد', tone: 'muted' }
  if (d <= 7) return { code: 'urgent', label: d === 0 ? 'ينتهي اليوم' : `باقي ${d} ${d === 1 ? 'يوم' : 'أيام'}`, tone: 'danger' }
  if (d <= 30) return { code: 'soon', label: `باقي ${d} يوماً`, tone: 'warn' }
  return { code: 'open', label: `باقي ${d} يوماً`, tone: 'ok' }
}
