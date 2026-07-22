import { normalizeArabic } from './content-index.mjs'

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

export function extractVerbatimAtSpeed(item, speed = '30s') {
  if (!item) return null
  const source = (item.body && item.body.trim()) ? item.body.trim() : (item.excerpt || '').trim()
  if (!source) return null

  const is2min = speed === '2min'
  const minWords = is2min ? 180 : 40
  const maxWords = is2min ? 280 : 85

  const words = source.split(/\s+/)
  let targetWordCount = is2min ? 220 : 60
  if (words.length < targetWordCount) {
    targetWordCount = words.length
  }
  if (targetWordCount < minWords && words.length >= minWords) {
    targetWordCount = minWords
  }

  // Find character index where word count reaches targetWordCount
  let count = 0
  let endIdx = source.length
  const regex = /\s+/g
  let match
  while ((match = regex.exec(source)) !== null) {
    count++
    if (count === targetWordCount) {
      endIdx = match.index
      break
    }
  }

  const text = source.slice(0, endIdx).trim()
  const actualWords = text.split(/\s+/).filter(Boolean).length

  return {
    text,
    words: actualWords,
  }
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

export function buildQuietIdeaNetwork(db, item, limit = 3) {
  if (!item) return []
  const candidates = db.all(
    "SELECT id, title, url FROM content_items WHERE id <> ? AND (trim(coalesce(body,''))<>'' OR trim(coalesce(excerpt,''))<>'') ORDER BY date DESC LIMIT 20",
    item.id
  ) || []

  const results = []
  for (const cand of candidates) {
    results.push({
      contentId: cand.id,
      title: cand.title,
      url: cand.url,
      sharedConcepts: [],
    })
    if (results.length >= limit) break
  }
  return results
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

  const distractors = items.filter(i => i.id !== eligibleTarget.id && !sentSet.has(i.id)).slice(0, 2)
  if (distractors.length < 2) {
    const fallbackDistractors = items.filter(i => i.id !== eligibleTarget.id).slice(0, 2)
    distractors.push(...fallbackDistractors.slice(distractors.length))
  }
  if (distractors.length < 2) return null

  const allOptions = [
    { contentId: eligibleTarget.id, title: eligibleTarget.title },
    ...distractors.map(d => ({ contentId: d.id, title: d.title }))
  ]

  // Stable deterministic shuffle or simple swap
  allOptions.sort((a, b) => a.contentId.localeCompare(b.contentId))

  return {
    quote: extract.text,
    options: allOptions,
    optionIds: allOptions.map(o => o.contentId),
    answerContentId: eligibleTarget.id,
  }
}
