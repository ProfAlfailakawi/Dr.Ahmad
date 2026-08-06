const REFERENCE_MARKERS = [
  'رسالة ماجستير', 'أطروحة دكتوراه', 'غير منشورة', 'جامعة ', 'الجامعة ',
  'المؤتمر ', 'مجلة ', 'دار النشر', 'مكتبة ', 'رقم الإيداع', 'ردمك',
  'ترجمة أ.', 'ترجمة د.', 'كلية التربية، جامعة', 'الإصدار الأول، مؤسسة',
]

const normalize = (value = '') => String(value)
  .normalize('NFC')
  .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const fingerprint = (value = '') => normalize(value)
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[^؀-ۿ]/g, '')

const tokenFingerprint = (value = '') => normalize(value)
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[^؀-ۿ\s]/g, ' ')
  .split(/\s+/u)
  .filter(Boolean)

const looksLikeReference = (text = '') => {
  const value = normalize(text)
  if (REFERENCE_MARKERS.some((marker) => value.includes(marker))) return true
  if ((value.match(/،/g) || []).length >= 4 && /(?:جامعة|كلية|مجلة|مؤتمر|رسالة|أطروحة)/u.test(value)) return true
  return false
}

const validFragment = (text = '') => {
  const value = normalize(text)
  if (value.length < 46 || value.length > 330) return false
  if (looksLikeReference(value)) return false
  if (!/[؀-ۿ]/u.test(value)) return false
  const letters = value.replace(/[^\p{L}]/gu, '')
  const arabic = value.replace(/[^؀-ۿ]/gu, '')
  if (!letters.length || arabic.length / letters.length < .96) return false
  if (/^[،؛:.\-–—]|[،؛:]$/u.test(value)) return false
  if ((value.match(/[0-9٠-٩۰-۹]/g) || []).length > 5) return false
  const words = value.split(/\s+/u)
  if (words.length < 7) return false
  return true
}

function sentenceParts(text) {
  return normalize(text).split(/(?<=[.؟!])\s+/u).map(normalize).filter(Boolean)
}

function clauseParts(sentence) {
  return normalize(sentence)
    .split(/(?<=[،؛:])\s+|\s+(?=(?:ولكن|ولذلك|لذلك|ومن ثم|حيث|إذ|كما|بينما|بل|أما|وعليه|ومن هنا|في حين|إضافة إلى ذلك)\s)/u)
    .map(normalize)
    .filter(Boolean)
}

function wordWindows(sentence) {
  const words = normalize(sentence).split(' ').filter(Boolean)
  if (words.length < 14) return []
  const windows = []
  // Three granularities improve retrieval without inventing or rewriting text.
  for (const [size, step] of [[12, 6], [18, 8], [26, 12]]) {
    if (words.length < size) continue
    for (let start = 0; start < words.length; start += step) {
      const slice = words.slice(start, start + size)
      if (slice.length < Math.max(9, Math.floor(size * .72))) break
      windows.push(slice.join(' '))
      if (start + size >= words.length) break
    }
  }
  return windows
}

function clauseWindows(clauses) {
  const windows = []
  for (const size of [2, 3, 4]) {
    for (let index = 0; index <= clauses.length - size; index += 1) {
      windows.push({ text: clauses.slice(index, index + size).join(' '), kind: `clause-${size}` })
    }
  }
  return windows
}

function similarity(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0
  const left = new Set(leftTokens)
  const right = new Set(rightTokens)
  let overlap = 0
  for (const token of left) if (right.has(token)) overlap += 1
  return overlap / Math.min(left.size, right.size)
}

export function expandEncyclopediaPassages(passages = [], { target = Number.POSITIVE_INFINITY } = {}) {
  // Always expand from the canonical/original records when an already-expanded file is supplied.
  const canonical = passages.filter((item) => !item.segmentKind || item.segmentKind === 'original')
  const sourceBase = canonical.length >= 250 ? canonical : passages.filter((item) => item && !item.segmentKind)
  const source = (sourceBase.length ? sourceBase : passages).filter((item) => item && !looksLikeReference(item.text))
  const candidates = []
  const exact = new Set()
  const byParent = new Map()

  const add = (parent, text, variant) => {
    const clean = normalize(text)
    if (!validFragment(clean)) return
    const print = fingerprint(clean)
    if (print.length < 36 || exact.has(print)) return
    const tokens = tokenFingerprint(clean)
    const parentCandidates = byParent.get(parent.id) || []
    // Prevent almost-identical windows from the same source while preserving distinct granularities.
    if (parentCandidates.some((entry) => similarity(tokens, entry.tokens) > .94 && Math.abs(tokens.length - entry.tokens.length) <= 3)) return
    exact.add(print)
    const candidate = { parent, text: clean, variant, print, tokens }
    parentCandidates.push(candidate)
    byParent.set(parent.id, parentCandidates)
    candidates.push(candidate)
  }

  for (const passage of source) {
    add(passage, passage.text, 'original')
    for (const sentence of sentenceParts(passage.text)) {
      if (sentence !== normalize(passage.text)) add(passage, sentence, 'sentence')
      const clauses = clauseParts(sentence)
      for (const clause of clauses) add(passage, clause, 'clause')
      for (const window of clauseWindows(clauses)) add(passage, window.text, window.kind)
      for (const window of wordWindows(sentence)) add(passage, window, 'search-window')
    }
  }

  const priority = {
    original: 0,
    sentence: 1,
    'clause-2': 2,
    'clause-3': 3,
    clause: 4,
    'clause-4': 5,
    'search-window': 6,
  }
  candidates.sort((left, right) =>
    Number(left.parent.page || 0) - Number(right.parent.page || 0)
    || (priority[left.variant] ?? 9) - (priority[right.variant] ?? 9)
    || left.text.length - right.text.length)

  const maximum = Number.isFinite(target) ? Math.max(target, source.length) : candidates.length
  const selected = candidates.slice(0, maximum)
  return selected.map((entry, index) => ({
    ...entry.parent,
    id: `encyclopedia-p${String(index + 1).padStart(5, '0')}`,
    text: entry.text,
    fingerprint: entry.print,
    parentPassageId: entry.parent.id,
    segmentKind: entry.variant,
  }))
}

export { looksLikeReference, validFragment, fingerprint }
