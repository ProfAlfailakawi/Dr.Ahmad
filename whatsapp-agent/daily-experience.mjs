import { normalizeArabic } from './content-index.mjs'
import { toRoot } from './dialect-lexicon.mjs'

export function isVerbatimFromItem(item, text) {
  if (!item || !text) return false
  const normText = normalizeArabic(text)
  const normBody = normalizeArabic(item.body || '')
  const normExcerpt = normalizeArabic(item.excerpt || '')
  const normTitle = normalizeArabic(item.title || '')
  return normBody.includes(normText) || normExcerpt.includes(normText) || normTitle.includes(normText)
}

function countWords(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/* حدود الوقف في متون الدكتور: النقطة والسؤال والتعجّب وعلامة الحذف والسطر
   الجديد. الفاصلة المنقوطة تفصل شطري فكرةٍ واحدة فلا نقف عندها. */
const STOP_MARK = /[.؟!…\n]/

/* الاقتباس يبدأ من أول المتن، إلا أن يكون أول سطرٍ هو العنوان نفسه — فاقتباس
   العنوان ليس كلاماً. والبداية تبقى موضعاً حقيقياً في الأصل، فالمقطع يظل
   منسوخاً حرفاً بحرف. */
function bodyStart(item, source) {
  const title = String(item?.title || '').trim()
  if (!title) return 0
  const firstBreak = source.indexOf('\n')
  const firstLine = (firstBreak < 0 ? source : source.slice(0, firstBreak)).trim()
  if (firstBreak < 0 || normalizeArabic(firstLine) !== normalizeArabic(title)) return 0
  const rest = source.slice(firstBreak)
  return firstBreak + (rest.length - rest.replace(/^\s+/, '').length)
}

export function extractVerbatimAtSpeed(item, speed = '30s') {
  if (!item) return null
  const raw = (item.body && item.body.trim()) ? item.body.trim() : (item.excerpt || '').trim()
  if (!raw) return null
  const source = raw.slice(bodyStart(item, raw))
  if (!source.trim()) return null

  const is2min = speed === '2min'
  const minWords = is2min ? 180 : 40
  const maxWords = is2min ? 280 : 85

  const words = source.split(/\s+/).filter(Boolean)
  let targetWordCount = is2min ? 220 : 60
  if (words.length < targetWordCount) {
    targetWordCount = words.length
  }
  if (targetWordCount < minWords && words.length >= minWords) {
    targetWordCount = minWords
  }

  /* الجذر: كان القطع يقع عند الكلمة رقم ٦٠ أينما وقعت، فيصل الاقتباس مبتوراً
     («…يذاكر لا ليفهم، بل») ويبتلع سطوراً فارغة داخل علامتَي التنصيص. الآن
     نمشي على الكلمات فنسجّل كل موضع وقفٍ يقع داخل النافذة المسموحة، ونختار
     آخرها — فينتهي الكلام حيث أنهاه الدكتور، والعدّ يبقى داخل مدى الاختبار. */
  let count = 0
  let fallbackIdx = source.length
  let stopIdx = -1
  let stopWords = 0
  for (let i = 0; i < source.length; i += 1) {
    if (!/\s/.test(source[i])) continue
    if (i > 0 && /\s/.test(source[i - 1])) continue
    count += 1
    if (count === targetWordCount) fallbackIdx = i
    if (count >= minWords && count <= maxWords && STOP_MARK.test(source.slice(0, i).trimEnd().slice(-1))) {
      stopIdx = i
      stopWords = count
    }
    if (count > maxWords) break
  }

  const endIdx = stopIdx > 0 && stopWords >= minWords ? stopIdx : fallbackIdx
  /* المقطع يبقى قطعةً واحدة من الأصل حرفاً بحرف (شرط البوابة)، ولا نُهذّب منه
     إلا علامات الوقف المعلّقة في آخره. */
  const text = source.slice(0, endIdx).trim().replace(/[،,؛…]+$/, '').trim()
  const actualWords = countWords(text)

  return {
    text,
    words: actualWords,
  }
}

/* ═══ التلخيص الحقيقي — نسخةٌ واحدة لتطبيقَي البوت معاً ═══
   «لخّص» كان يُقصّ أوّل الكلمات من رأس المتن، وأوّلُ المتن هو بعينه ما تفتح
   به البطاقةُ الأولى — فيرى القارئ نصّاً يظنّه المادة نفسها معادةً لا ملخّصاً.
   الملخّص هنا اقتطافُ أكثفِ عبارةٍ دلالةً من كلام الدكتور، لا مقدّمته:
   نقطع على الشرطة وعلامات الوقف، ونشترط أن تكون العبارة منسوخةً حرفاً بحرف
   من المتن (isVerbatimFromItem) فلا تحريف ولا اختلاق.
   **قاعدة الدار:** الوكيل المقيم والعقل المركزي تطبيقان لنفس التصريف — فمتى
   أُصلح أحدهما أُصلح الآخر. ولذلك تعيش هذه الدالة هنا ويستوردها الاثنان. */
export function distillItem(item) {
  const source = String(item?.body || item?.excerpt || '').trim()
  if (!source) return null
  const whole = source.replace(/\s+/g, ' ').trim()
  const clauses = source
    .split(/\s*[—–]\s*|[.؟!\n؛…]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 14 && part.length < whole.length && isVerbatimFromItem(item, part))
  if (!clauses.length) return { text: whole, whole: true }
  const dense = (text) => {
    const words = normalizeArabic(text).split(/\s+/).filter((word) => word.length > 2)
    return new Set(words).size / Math.sqrt(Math.max(6, words.length))
  }
  let best = clauses[0]
  let bestScore = -1
  for (const clause of clauses) {
    const score = dense(clause)
    if (score > bestScore) { bestScore = score; best = clause }
  }
  return { text: best, whole: false }
}

export function selectDailyUnsentContent(db, options = {}) {
  const { jid } = options
  if (!jid) return null

  const jidKey = typeof db.jidKey === 'function' ? db.jidKey(jid) : jid

  const sentRows = db.all('SELECT content_id FROM sent_content WHERE jid=?', jidKey) || []
  const sentSet = new Set(sentRows.map(r => r.content_id))

  const reservedRows = db.all('SELECT content_id FROM content_reservations WHERE jid=?', jidKey) || []
  const reservedSet = new Set(reservedRows.map(r => r.content_id))

  const candidates = db.all(
    "SELECT * FROM content_items WHERE kind='article' AND (trim(coalesce(body,''))<>'' OR trim(coalesce(excerpt,''))<>'') ORDER BY date DESC"
  ) || []

  for (const candidate of candidates) {
    if (!sentSet.has(candidate.id) && !reservedSet.has(candidate.id)) {
      return candidate
    }
  }

  return null
}

/* «كمل» بعد قراءة الثلاثين ثانية: المقطع التالي مباشرةً من المتن — لا إعادةَ
   ما قُرئ ولا قفزٌ إلى مقالٍ آخر. يبدأ من حيث انتهى الأول وينتهي عند وقفة. */
export function continueVerbatim(item, speed = '30s') {
  if (!item) return null
  const raw = (item.body && item.body.trim()) ? item.body.trim() : (item.excerpt || '').trim()
  const first = extractVerbatimAtSpeed(item, speed)
  if (!raw || !first) return null
  const at = raw.indexOf(first.text)
  if (at < 0) return null
  const rest = raw.slice(at + first.text.length).replace(/^[\s،؛.…]+/, '')
  if (!rest.trim()) return null
  const next = extractVerbatimAtSpeed({ ...item, body: rest, excerpt: '' }, speed)
  return next && next.text ? next : null
}

/* شبكة الأفكار كانت تُرجع «آخر ثلاث مواد» أياً كان المقال، وبـsharedConcepts
   فارغة — فيقول البوت «امشِ مع الفكرة عبر…» ثم يسوق مقالاتٍ لا تصلها بها فكرة.
   الآن نرجّح بالمشترك الحقيقي: كلمات العنوان والمتن مجذّرة، والعنوان أثقل. */
export function buildQuietIdeaNetwork(db, item, limit = 3) {
  if (!item) return []
  const candidates = db.all(
    "SELECT id, title, url, body, excerpt FROM content_items WHERE id <> ? AND (trim(coalesce(body,''))<>'' OR trim(coalesce(excerpt,''))<>'') ORDER BY date DESC LIMIT 60",
    item.id
  ) || []

  const keyOf = (value) => new Set(
    normalizeArabic(value).split(' ').map(toRoot).filter((word) => word.length >= 3),
  )
  const seedTitle = keyOf(item.title || '')
  const seedBody = keyOf(`${item.title || ''} ${item.body || item.excerpt || ''}`)

  const ranked = []
  for (const candidate of candidates) {
    const titleWords = keyOf(candidate.title || '')
    const bodyWords = keyOf(`${candidate.title || ''} ${candidate.body || candidate.excerpt || ''}`)
    const shared = []
    let score = 0
    for (const word of seedBody) {
      if (titleWords.has(word)) { score += 3; shared.push(word) }
      else if (bodyWords.has(word) && seedTitle.has(word)) { score += 1; shared.push(word) }
    }
    if (score <= 0) continue
    ranked.push({
      contentId: candidate.id,
      title: candidate.title,
      url: candidate.url,
      sharedConcepts: [...new Set(shared)].slice(0, 4),
      score,
    })
  }
  ranked.sort((a, b) => b.score - a.score)

  /* ولو لم تجمعها فكرة، فآخر المواد خيرٌ من لا شيء — لكن بعد المحاولة لا قبلها. */
  const results = ranked.slice(0, limit).map(({ score, ...path }) => path)
  if (results.length) return results
  return candidates.slice(0, limit).map((candidate) => ({
    contentId: candidate.id,
    title: candidate.title,
    url: candidate.url,
    sharedConcepts: [],
  }))
}

export function buildFifteenSecondChallenge(db, options = {}) {
  const { jid } = options
  const jidKey = typeof db.jidKey === 'function' ? db.jidKey(jid) : jid

  const sentRows = db.all('SELECT content_id FROM sent_content WHERE jid=?', jidKey) || []
  const sentSet = new Set(sentRows.map(r => r.content_id))

  const items = db.all(
    "SELECT * FROM content_items WHERE kind='article' AND trim(coalesce(body,''))<>'' ORDER BY date DESC"
  ) || []

  const eligibleTarget = items.find(i => !sentSet.has(i.id)) || items[0]
  if (!eligibleTarget) return null

  const extract = extractVerbatimAtSpeed(eligibleTarget, '30s')
  if (!extract) return null

  /* المُلهيان كانا «آخر مقالين» دائماً — بعيدين عن الموضوع، فيُعرف الجواب من
     العنوان بلا قراءة الاقتباس. نختارهما الآن من جيران الفكرة: قريبَين كفايةً
     ليكون الاختيار اختباراً حقيقياً. */
  const neighbours = buildQuietIdeaNetwork(db, eligibleTarget, 6)
    .map((path) => items.find((item) => item.id === path.contentId))
    .filter(Boolean)
  const pool = [
    ...neighbours.filter((item) => !sentSet.has(item.id)),
    ...neighbours,
    ...items.filter((item) => item.id !== eligibleTarget.id && !sentSet.has(item.id)),
    ...items.filter((item) => item.id !== eligibleTarget.id),
  ]
  const distractors = []
  for (const candidate of pool) {
    if (candidate.id === eligibleTarget.id) continue
    if (distractors.some((chosen) => chosen.id === candidate.id)) continue
    distractors.push(candidate)
    if (distractors.length >= 2) break
  }
  if (distractors.length < 2) return null

  const allOptions = [
    { contentId: eligibleTarget.id, title: eligibleTarget.title },
    ...distractors.map(d => ({ contentId: d.id, title: d.title }))
  ]

  /* الترتيب بـcontentId كان يضع الجواب في الموضع نفسه كل مرة (قِيس: الثاني في
     كل تحدٍّ) فيُحلّ التحدّي بالتخمين. الترتيب الآن بمفتاحٍ مشتقٍّ من السائل
     والمادة: ثابتٌ للجلسة الواحدة (فالرقم يظل يعني ما عُرض)، ومختلفٌ من تحدٍّ
     إلى تحدٍّ ومن سائلٍ إلى سائل. */
  const seed = `${jidKey || ''}|${eligibleTarget.id}`
  const mix = (value) => {
    let hash = 2166136261
    for (const char of `${seed}|${value}`) {
      hash ^= char.codePointAt(0)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash
  }
  allOptions.sort((a, b) => mix(a.contentId) - mix(b.contentId))

  return {
    id: `challenge-${mix(eligibleTarget.id).toString(36)}`,
    /* الاقتباس هنا يُحفظ دليلاً ويُطابَق بالمتن حرفاً بحرف، فلا يُهذَّب. */
    quote: extract.text,
    options: allOptions,
    optionIds: allOptions.map(o => o.contentId),
    answerContentId: eligibleTarget.id,
  }
}
