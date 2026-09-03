/*
 * Archive 2036 core.
 * Pure ESM on purpose: the browser, build scripts, CI stress tests and Node tools
 * share the exact same indexing algorithm. No framework and no Node-only API.
 */

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/gu
const DEFAULT_STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل عبر نحو حول داخل خارج كان كانت يكون تكون إلى أو إن أن لا هو هي'.split(' '))

export function normalizeArchiveText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function archiveTokens(value = '', limit = 64) {
  const words = normalizeArchiveText(value).split(' ')
  const output = []
  const seen = new Set()
  for (let word of words) {
    const latinOrNumber = /^[a-z0-9]+$/i.test(word)
    const minimum = latinOrNumber ? 2 : 3
    if (!word || word.length < minimum || DEFAULT_STOP.has(word)) continue
    if (!latinOrNumber) {
      word = word.replace(/^(?:وال|فال|بال|كال|لل|ال)(?=.{3,})/u, '')
      word = word.replace(/^(?:و|ف)(?=.{4,})/u, '')
    }
    if (word.length < minimum || DEFAULT_STOP.has(word) || seen.has(word)) continue
    seen.add(word)
    output.push(word)
    if (output.length >= limit) break
  }
  return output
}

function topInsert(rows, value, limit, compare) {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (compare(value, rows[mid]) < 0) hi = mid
    else lo = mid + 1
  }
  rows.splice(lo, 0, value)
  if (rows.length > limit) rows.pop()
}

export function selectTopK(items, limit, scoreOf, tieOf = () => '') {
  const safeLimit = Math.max(0, Math.floor(limit || 0))
  if (!safeLimit) return []
  const rows = []
  const compare = (a, b) => b.score - a.score || String(a.tie).localeCompare(String(b.tie))
  for (let index = 0; index < items.length; index += 1) {
    const row = { index, item: items[index], score: Number(scoreOf(items[index], index)) || 0, tie: tieOf(items[index], index) }
    if (rows.length < safeLimit || compare(row, rows[rows.length - 1]) < 0) topInsert(rows, row, safeLimit, compare)
  }
  return rows.map((row) => row.item)
}

export function createArchiveIndex(items, options = {}) {
  const getText = options.getText || ((item) => `${item?.title || ''} ${item?.excerpt || ''}`)
  const getYear = options.getYear || ((item) => String(item?.year || item?.iso || '').match(/(?:19|20)\d{2}/)?.[0] || '')
  const getCategory = options.getCategory || ((item) => String(item?.category || item?.cat || item?.kind || ''))
  const getSortKey = options.getSortKey || ((item) => String(item?.iso || item?.date || item?.year || ''))
  const maxTokensPerItem = Math.max(8, Number(options.maxTokensPerItem || 48))
  const tokenPostings = new Map()
  const yearPostings = new Map()
  const categoryPostings = new Map()
  const tokensByIndex = new Array(items.length)
  const order = Array.from({ length: items.length }, (_, index) => index)

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    const year = String(getYear(item, index) || '')
    const category = String(getCategory(item, index) || '')
    if (year) (yearPostings.get(year) || (yearPostings.set(year, []), yearPostings.get(year))).push(index)
    if (category) (categoryPostings.get(category) || (categoryPostings.set(category, []), categoryPostings.get(category))).push(index)
    const tokens = archiveTokens(getText(item, index), maxTokensPerItem)
    tokensByIndex[index] = tokens
    for (const token of tokens) (tokenPostings.get(token) || (tokenPostings.set(token, []), tokenPostings.get(token))).push(index)
  }

  order.sort((left, right) => String(getSortKey(items[right], right) || '').localeCompare(String(getSortKey(items[left], left) || '')) || left - right)
  for (const [key, value] of tokenPostings) tokenPostings.set(key, Uint32Array.from(value))
  for (const [key, value] of yearPostings) yearPostings.set(key, Uint32Array.from(value))
  for (const [key, value] of categoryPostings) categoryPostings.set(key, Uint32Array.from(value))

  return {
    items,
    order: Uint32Array.from(order),
    tokensByIndex,
    tokenPostings,
    yearPostings,
    categoryPostings,
    years: [...yearPostings.keys()].sort((a, b) => b.localeCompare(a)),
    categories: [...categoryPostings.keys()].sort((a, b) => a.localeCompare(b, 'ar')),
  }
}

function postingHas(posting, value) {
  if (!posting) return false
  let left = 0
  let right = posting.length - 1
  while (left <= right) {
    const mid = (left + right) >> 1
    const current = posting[mid]
    if (current === value) return true
    if (current < value) left = mid + 1
    else right = mid - 1
  }
  return false
}

function searchCandidateSet(index, query) {
  const tokens = archiveTokens(query, 8)
  if (!tokens.length) return null
  const postings = tokens.map((token) => index.tokenPostings.get(token)).filter(Boolean).sort((a, b) => a.length - b.length)
  if (!postings.length) return new Set()
  const source = postings[0]
  const other = postings.slice(1, 4)
  const result = new Set()
  for (const candidate of source) {
    if (other.every((posting) => postingHas(posting, candidate))) result.add(candidate)
  }
  /* Exact AND can be too strict for natural-language search. Fall back to the
     rarest-token pool, still bounded by the inverted index rather than 100k scans. */
  if (!result.size) for (const candidate of source) result.add(candidate)
  return result
}

export function queryArchiveIndex(index, options = {}) {
  const query = String(options.query || '').trim()
  const year = String(options.year || '')
  const category = String(options.category || '')
  const page = Math.max(1, Math.floor(Number(options.page || 1)))
  const pageSize = Math.max(1, Math.min(200, Math.floor(Number(options.pageSize || 20))))
  const start = (page - 1) * pageSize
  const searchSet = searchCandidateSet(index, query)
  const yearPosting = year ? index.yearPostings.get(year) : null
  const categoryPosting = category ? index.categoryPostings.get(category) : null
  const pageIndexes = []
  let total = 0

  for (const itemIndex of index.order) {
    if (searchSet && !searchSet.has(itemIndex)) continue
    if (yearPosting && !postingHas(yearPosting, itemIndex)) continue
    if (categoryPosting && !postingHas(categoryPosting, itemIndex)) continue
    if (total >= start && pageIndexes.length < pageSize) pageIndexes.push(itemIndex)
    total += 1
  }

  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    firstItem: total ? start + 1 : 0,
    lastItem: total ? Math.min(total, start + pageIndexes.length) : 0,
    items: pageIndexes.map((itemIndex) => index.items[itemIndex]),
  }
}

/**
 * Stable level-of-detail sampler for visual maps. It keeps explicitly pinned
 * records, then distributes the remaining budget across semantic/time groups
 * so a 5k–100k archive never becomes a 5k–100k DOM tree.
 */
export function sampleVisualArchive(items, limit, options = {}) {
  const budget = Math.max(1, Math.floor(Number(limit || 1)))
  if (items.length <= budget) return items
  const keyOf = options.keyOf || ((item, index) => String(item?.slug || item?.id || index))
  const groupOf = options.groupOf || ((item) => String(item?.category || item?.cat || item?.kind || 'archive'))
  const requestedPins = Array.isArray(options.pinKeys) ? options.pinKeys : []
  const pinOrder = new Map(requestedPins.map((key, index) => [String(key), index]))
  const selected = new Set()

  if (pinOrder.size) {
    const matches = []
    for (let index = 0; index < items.length; index += 1) {
      const order = pinOrder.get(String(keyOf(items[index], index)))
      if (order !== undefined) matches.push({ index, order })
    }
    matches.sort((left, right) => left.order - right.order || left.index - right.index)
    for (const match of matches.slice(0, budget)) selected.add(match.index)
  }

  const remaining = budget - selected.size
  if (remaining <= 0) return [...selected].sort((a, b) => a - b).map((index) => items[index])

  const groups = new Map()
  for (let index = 0; index < items.length; index += 1) {
    if (selected.has(index)) continue
    const key = String(groupOf(items[index], index) || 'archive')
    const bucket = groups.get(key)
    if (bucket) bucket.push(index)
    else groups.set(key, [index])
  }
  if (!groups.size) return [...selected].sort((a, b) => a - b).map((index) => items[index])

  const rows = [...groups.entries()].map(([key, indexes]) => ({ key, indexes, quota: 0, fraction: 0 }))
  let left = remaining

  // Give every group one representative while the visual budget permits it.
  if (left >= rows.length) {
    for (const row of rows) row.quota = 1
    left -= rows.length
  } else {
    rows.sort((a, b) => b.indexes.length - a.indexes.length || a.key.localeCompare(b.key, 'ar'))
    for (const row of rows.slice(0, left)) row.quota = 1
    left = 0
  }

  if (left > 0) {
    const capacity = rows.reduce((sum, row) => sum + Math.max(0, row.indexes.length - row.quota), 0)
    if (capacity > 0) {
      let assigned = 0
      for (const row of rows) {
        const room = Math.max(0, row.indexes.length - row.quota)
        const exact = left * room / capacity
        const extra = Math.min(room, Math.floor(exact))
        row.quota += extra
        row.fraction = exact - extra
        assigned += extra
      }
      let remainder = left - assigned
      if (remainder > 0) {
        const byFraction = [...rows].sort((a, b) => b.fraction - a.fraction || b.indexes.length - a.indexes.length || a.key.localeCompare(b.key, 'ar'))
        for (const row of byFraction) {
          if (!remainder) break
          if (row.quota >= row.indexes.length) continue
          row.quota += 1
          remainder -= 1
        }
      }
    }
  }

  for (const row of rows) {
    const count = Math.min(row.quota, row.indexes.length)
    if (!count) continue
    if (count === 1) {
      selected.add(row.indexes[Math.floor((row.indexes.length - 1) / 2)])
      continue
    }
    for (let slot = 0; slot < count; slot += 1) {
      const position = Math.round(slot * (row.indexes.length - 1) / (count - 1))
      selected.add(row.indexes[position])
    }
  }

  // Rounding/duplicate pins can leave a tiny budget remainder. Fill it in
  // archive order without exceeding the hard visual ceiling.
  if (selected.size < budget) {
    for (let index = 0; index < items.length && selected.size < budget; index += 1) selected.add(index)
  }
  return [...selected].sort((a, b) => a - b).slice(0, budget).map((index) => items[index])
}

export function buildSimilarityGraph(nodes, options = {}) {
  const getText = options.getText || ((node) => `${node?.title || ''} ${node?.excerpt || ''} ${(node?.tokens || []).join(' ')}`)
  const getTitle = options.getTitle || ((node) => String(node?.title || ''))
  const getKind = options.getKind || ((node) => String(node?.kind || ''))
  const maxNeighbors = Math.max(1, Number(options.maxNeighbors || 18))
  const maxCandidates = Math.max(maxNeighbors * 4, Number(options.maxCandidates || 320))
  const maxCandidateTokens = Math.max(2, Number(options.maxCandidateTokens || 8))
  const minScore = Number(options.minScore || 8)
  const conceptKind = String(options.conceptKind || 'concept')

  const tokenLists = nodes.map((node) => Array.isArray(node?.tokens) && node.tokens.length ? [...new Set(node.tokens)].slice(0, 140) : archiveTokens(getText(node), 140))
  const titleTokens = nodes.map((node) => new Set(archiveTokens(getTitle(node), 24)))
  const postings = new Map()
  for (let index = 0; index < tokenLists.length; index += 1) {
    for (const token of tokenLists[index]) (postings.get(token) || (postings.set(token, []), postings.get(token))).push(index)
  }
  const commonLimit = Math.max(48, Math.min(Number(options.maxPostingAbsolute || 1200), Math.ceil(nodes.length * Number(options.maxPostingRatio || 0.018))))
  const edges = []

  for (let index = 0; index < nodes.length; index += 1) {
    const candidates = new Map()
    const usefulTokens = tokenLists[index]
      .map((token) => ({ token, posting: postings.get(token) || [] }))
      .filter((row) => row.posting.length > 1 && row.posting.length <= commonLimit)
      .sort((a, b) => a.posting.length - b.posting.length)
      .slice(0, maxCandidateTokens)

    for (const { posting } of usefulTokens) {
      for (const candidate of posting) {
        if (candidate === index) continue
        if (!candidates.has(candidate) && candidates.size >= maxCandidates) continue
        candidates.set(candidate, (candidates.get(candidate) || 0) + 1)
      }
    }

    const top = []
    for (const [candidate, rareOverlap] of candidates) {
      const left = nodes[index]
      const right = nodes[candidate]
      const leftTokens = tokenLists[index]
      const rightSet = new Set(tokenLists[candidate])
      let common = 0
      for (const token of leftTokens) if (rightSet.has(token)) common += 1
      let titleCommon = 0
      for (const token of titleTokens[index]) if (titleTokens[candidate].has(token)) titleCommon += 1
      const leftKind = getKind(left)
      const rightKind = getKind(right)
      const conceptBridge = leftKind === conceptKind || rightKind === conceptKind
      const crossKind = leftKind !== rightKind
      const score = common * (conceptBridge ? 3 : 2) + titleCommon * 6 + (crossKind ? 1 : 0) + Math.min(2, rareOverlap - 1)
      const threshold = conceptBridge ? Math.min(minScore, 6) : minScore
      if (score < threshold) continue
      const reasons = [
        titleCommon ? 'تقاطع مباشر في العنوان' : '',
        conceptBridge ? 'صلة بمفهوم من قاموس د. أحمد' : '',
        common >= 4 ? 'محور معرفي مشترك' : '',
        crossKind ? 'امتداد بين نوعين من المحتوى' : '',
      ].filter(Boolean)
      topInsert(top, { candidate, score, reasons }, maxNeighbors, (a, b) => b.score - a.score || a.candidate - b.candidate)
    }

    for (const row of top) edges.push({ from: index, to: row.candidate, score: row.score, reasons: row.reasons })
  }
  return edges
}

export function buildSearchPostings(nodes, options = {}) {
  const getText = options.getText || ((node) => `${node?.title || ''} ${node?.excerpt || ''} ${(node?.tokens || []).join(' ')}`)
  const postings = new Map()
  for (let index = 0; index < nodes.length; index += 1) {
    for (const token of archiveTokens(getText(nodes[index], index), Number(options.maxTokensPerItem || 96))) {
      (postings.get(token) || (postings.set(token, []), postings.get(token))).push(index)
    }
  }
  for (const [key, value] of postings) postings.set(key, Uint32Array.from(value))
  return postings
}

export function searchPostingCandidates(postings, query, limit = 1200) {
  const tokens = archiveTokens(query, 8)
  const lists = tokens.map((token) => postings.get(token)).filter(Boolean).sort((a, b) => a.length - b.length)
  if (!lists.length) return []
  const score = new Map()
  for (const posting of lists.slice(0, 5)) {
    for (const index of posting) {
      if (!score.has(index) && score.size >= limit) continue
      score.set(index, (score.get(index) || 0) + 1)
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, limit).map(([index]) => index)
}
