import { normalizeArabic } from './content-index.mjs'

const VALID_KINDS = new Set(['article', 'paper', 'book', 'podcast', 'curated', 'audio', 'report', 'research', 'question', 'dialogue'])

export function isSiteContentId(id) {
  if (typeof id !== 'string' || !id) return false
  if (id.includes('..') || id.includes('//') || id.includes('\\') || id.includes('?') || id.includes('#') || id.includes(' ')) return false
  const parts = id.split(':')
  if (parts.length !== 2) return false
  const [kind, slug] = parts
  if (!VALID_KINDS.has(kind)) return false
  if (!slug || slug.startsWith('/') || slug.startsWith('\\')) return false
  return /^[a-z0-9_.-]+$/i.test(slug)
}

export function sanitizeResultIds(ids) {
  if (!Array.isArray(ids)) return []
  const seen = new Set()
  const clean = []
  for (const item of ids) {
    if (isSiteContentId(item) && !seen.has(item)) {
      seen.add(item)
      clean.push(item)
    }
  }
  return clean
}

export function createConversationContext(overrides = {}) {
  return {
    version: 1,
    resultIds: [],
    currentIndex: 0,
    lastIntent: null,
    lastTopic: null,
    lastKind: null,
    challenge: null,
    ...overrides,
  }
}

export function parseConversationContext(raw) {
  if (!raw) return createConversationContext()
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return createConversationContext()
    }
  }
  if (typeof data !== 'object' || data === null) return createConversationContext()

  const resultIds = sanitizeResultIds(data.resultIds)
  let currentIndex = Number.isInteger(data.currentIndex) ? data.currentIndex : 0
  if (resultIds.length > 0) {
    if (currentIndex < 0 || currentIndex >= resultIds.length) {
      currentIndex = Math.max(0, Math.min(currentIndex, resultIds.length - 1))
    }
  } else {
    currentIndex = 0
  }

  const lastIntent = typeof data.lastIntent === 'string' && !data.lastIntent.includes('<script>') ? data.lastIntent : null
  const lastKind = typeof data.lastKind === 'string' && VALID_KINDS.has(data.lastKind) ? data.lastKind : null
  const lastTopic = typeof data.lastTopic === 'string' ? data.lastTopic : null

  let challenge = null
  if (data.challenge && typeof data.challenge === 'object') {
    const optionIds = sanitizeResultIds(data.challenge.optionIds)
    if (optionIds.length > 0 && isSiteContentId(data.challenge.answerContentId)) {
      challenge = {
        optionIds,
        answerContentId: data.challenge.answerContentId,
      }
    }
  }

  return {
    version: 1,
    resultIds,
    currentIndex,
    lastIntent,
    lastTopic,
    lastKind,
    challenge,
  }
}

export function serializeConversationContext(context) {
  const clean = parseConversationContext(context)
  return JSON.stringify(clean)
}

export function currentResultId(context) {
  const ctx = typeof context === 'string' ? parseConversationContext(context) : context
  if (!ctx || !Array.isArray(ctx.resultIds) || ctx.resultIds.length === 0) return null
  const idx = ctx.currentIndex ?? 0
  return ctx.resultIds[idx] || null
}

export function setContextResults(context, resultIds, options = {}) {
  const ctx = typeof context === 'string' ? parseConversationContext(context) : context || createConversationContext()
  const cleanIds = sanitizeResultIds(resultIds)
  let idx = options.currentIndex ?? 0
  if (cleanIds.length > 0) {
    idx = Math.max(0, Math.min(idx, cleanIds.length - 1))
  } else {
    idx = 0
  }
  return {
    ...ctx,
    resultIds: cleanIds,
    currentIndex: idx,
    lastIntent: options.lastIntent ?? ctx.lastIntent,
    lastTopic: options.lastTopic ?? ctx.lastTopic,
    lastKind: options.lastKind ?? ctx.lastKind,
  }
}

export function normalizeContextText(text) {
  if (!text) return ''
  return normalizeArabic(text)
}

export function parseDuration(phrase) {
  if (!phrase || typeof phrase !== 'string') return null
  const raw = phrase.trim()
  const norm = normalizeArabic(phrase)

  if (/نصف دقيقة|نص دقيقه|نص دقيقة/u.test(raw) || /نصف دقيقه|نص دقيقه/u.test(norm)) return { seconds: 30, mode: 'exact' }
  if (/دقيقتين|دقيقتان/u.test(raw) || /دقيقتين|دقيقتان/u.test(norm)) return { seconds: 120, mode: 'exact' }
  if (/(?:ثلاث|3|٣)\s*(?:دقايق|دقائق)/u.test(raw) || /(?:ثلاث|3|٣)\s*دقايق/u.test(norm)) return { seconds: 180, mode: 'exact' }
  if (/(?:5|٥)\s*(?:دقائق|دقايق)/u.test(raw) || /(?:5|٥)\s*دقايق/u.test(norm)) return { seconds: 300, mode: 'exact' }
  if (/(?:15|١٥)\s*(?:دقيقة|دقيقه)/u.test(raw) || /(?:15|١٥)\s*دقيقه/u.test(norm)) return { seconds: 900, mode: 'exact' }
  if (/(?:30|٣٠)\s*(?:ثانية|ثانيه)/u.test(raw) || /(?:30|٣٠)\s*ثانيه/u.test(norm)) return { seconds: 30, mode: 'exact' }
  if (/ساعة|ساعه/u.test(raw) && !/ساعة\s*و|ساعه\s*و/u.test(raw)) return { seconds: 3600, mode: 'exact' }

  if (/شي قصير|قصيرة|قصير|قصيره|ما عندي وقت|على السريع|علي السريع|الزبدة|الزبده/u.test(raw) || /شي قصير|قصيره|قصير|ما عندي وقت|علي السريع|الزبده/u.test(norm)) {
    return { seconds: 120, mode: 'max' }
  }

  return null
}

export function parseOrdinal(phrase) {
  if (!phrase || typeof phrase !== 'string') return null
  if (parseDuration(phrase)) return null

  const norm = normalizeArabic(phrase)

  if (/رقم 10|رقم ١٠|الخيار 10|الخيار ١٠|العاشر|العاشره/u.test(norm)) return 10
  if (/(?:^|\s)(?:الاول|الاولى|الخيار 1|الخيار ١|المقال 1|المقال ١|الماده 1|الماده ١|المادة 1|المادة ١|رقم 1|رقم ١)(?:$|[^\d١-٩]|\s)/u.test(norm) && !/رقم 1[0-9١-٩]/u.test(norm)) return 1
  if (/(?:^|\s)(?:الثاني|الثانية|الثانيه|الخيار 2|الخيار ٢|الخيار ۲|المقال 2|المقال ٢|الماده 2|الماده ٢|المادة 2|المادة ٢|رقم 2|رقم ۲|رقم ٢)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 2
  if (/(?:^|\s)(?:الثالث|الثالثة|الثالثه|الخيار 3|الخيار ٣|المقال 3|المقال ٣|الماده 3|الماده ٣|المادة 3|المادة ٣|رقم 3|رقم ٣)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 3
  if (/(?:^|\s)(?:الرابع|الرابعة|الرابعه|الخيار 4|الخيار ٤|المقال 4|المقال ٤|الماده 4|الماده ٤|المادة 4|المادة ٤|رقم 4|رقم ٤)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 4
  if (/(?:^|\s)(?:الخامس|الخامسة|الخامسه|الخيار 5|الخيار ٥|المقال 5|المقال ٥|الماده 5|الماده ٥|المادة 5|المادة ٥|رقم 5|رقم ٥)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 5
  if (/(?:^|\s)(?:السادس|السادسة|السادسه|الخيار 6|الخيار ٦|المقال 6|المقال ٦|الماده 6|الماده ٦|المادة 6|المادة ٦|رقم 6|رقم ٦)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 6
  if (/(?:^|\s)(?:السابع|السابعة|السابعه|الخيار 7|الخيار ۷|الخيار ٧|المقال 7|المقال ٧|الماده 7|الماده ٧|المادة 7|المادة ٧|رقم 7|رقم ٧)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 7
  if (/(?:^|\s)(?:الثامن|الثامنة|الثامنه|الخيار 8|الخيار ٨|المقال 8|المقال ٨|الماده 8|الماده ٨|المادة 8|المادة ٨|رقم 8|رقم ٨)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 8
  if (/(?:^|\s)(?:التاسع|التاسعة|التاسعه|الخيار 9|الخيار ٩|المقال 9|المقال ٩|الماده 9|الماده ٩|المادة 9|المادة ٩|رقم 9|رقم ٩)(?:$|[^\d١-٩]|\s)/u.test(norm)) return 9

  const loneMatch = norm.trim().match(/^(?:رقم\s*|الخيار\s*|المقال\s*|الماده\s*|المادة\s*)?([1-9]|10|[١-٩]|١٠|۲|۷|٨)$/u)
  if (loneMatch) {
    const digitMap = { '١': 1, '٢': 2, '۲': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '۷': 7, '٨': 8, '٩': 9, '١٠': 10 }
    const rawDigit = loneMatch[1]
    return digitMap[rawDigit] || parseInt(rawDigit, 10)
  }

  return null
}

export function parseCompoundRequest(phrase) {
  if (!phrase || typeof phrase !== 'string') {
    return { kind: null, latest: false, duration: null, voice: null, ordinal: null, action: null, reference: null, topic: null }
  }
  const raw = phrase.trim()
  const norm = normalizeArabic(phrase)

  let voice = null
  if (/بصوت نورة|بصوت نوره|نورة|نوره/u.test(raw)) voice = 'noura'
  else if (/بصوت فهد|فهد|الرجل/u.test(raw)) voice = 'fahed'
  else if (/بصوت الحوار|حوار/u.test(raw)) voice = 'dialogue'

  // Remove voice phrase to prevent "بصوت" matching kind "podcast"
  const strippedForKind = norm.replace(/بصوت\s*(نوره|فهد|الحوار|حوار|الرجل)?/gu, '')

  let kind = null
  if (/مقالة|مقال/u.test(strippedForKind)) kind = 'article'
  else if (/بحث|ورقة/u.test(strippedForKind)) kind = 'paper'
  else if (/كتاب/u.test(strippedForKind)) kind = 'book'
  else if (/بودكاست|\bصوت\b/u.test(strippedForKind)) kind = 'podcast'
  else if (/مختارة|مختار|مختارات|مختاره/u.test(strippedForKind)) kind = 'curated'

  const latest = /احدث|أحدث|جديد|اخر|آخر/u.test(norm)
  const duration = parseDuration(phrase)
  const ordinal = parseOrdinal(phrase)

  let action = null
  if (voice || /اسمع|شغل|صوت/u.test(norm)) action = 'listen'
  else if (/لخص|ملخص|اختصر|الزبدة|الزبده/u.test(norm)) action = 'summary'
  else if (/افتح|اقرأ|رابط/u.test(norm)) action = 'read'

  let reference = null
  if (ordinal !== null) {
    reference = 'ordinal'
  } else if (/قبله|السابق|ارجع واحد/u.test(norm)) {
    reference = 'previous'
  } else if (/بعده|التالي|زدني/u.test(norm)) {
    reference = 'next'
  } else if (/هذا|المقال|الماده|المادة|نفسه|نفسها|احفظها|احفظه|شيلها|شيله|اختصرها|اختصره|لخصها|لخصه|اسمعه|اسمعها|الحوار/u.test(norm)) {
    reference = 'current'
  }

  let topic = null
  const topicMatch = norm.match(/عن\s+(.+)$/u)
  if (topicMatch) {
    topic = topicMatch[1].replace(/بصوت.*$/u, '').replace(/بصوت/u, '').trim()
  }

  return {
    kind,
    latest,
    duration,
    voice,
    ordinal,
    action,
    reference,
    topic,
  }
}

export function resolveContextReference(context, requestOrPhrase) {
  const ctx = typeof context === 'string' ? parseConversationContext(context) : context
  if (!ctx || !Array.isArray(ctx.resultIds) || ctx.resultIds.length === 0) return null

  const req = typeof requestOrPhrase === 'string' ? parseCompoundRequest(requestOrPhrase) : requestOrPhrase
  if (!req) return null

  let targetIndex = null
  let relation = req.reference || null

  if (req.ordinal !== null) {
    targetIndex = req.ordinal - 1
    relation = 'ordinal'
  } else if (req.reference === 'previous') {
    targetIndex = ctx.currentIndex - 1
  } else if (req.reference === 'next') {
    targetIndex = ctx.currentIndex + 1
  } else if (req.reference === 'current') {
    targetIndex = ctx.currentIndex
  }

  if (targetIndex === null || targetIndex < 0 || targetIndex >= ctx.resultIds.length) {
    return null
  }

  return {
    contentId: ctx.resultIds[targetIndex],
    index: targetIndex,
    action: req.action || null,
    relation,
  }
}

export function applyReferenceResolution(context, resolved) {
  if (!context || !resolved || typeof resolved.index !== 'number') return context
  return {
    ...context,
    currentIndex: resolved.index,
  }
}
