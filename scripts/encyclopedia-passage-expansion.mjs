const REFERENCE_MARKERS = [
  'رسالة ماجستير', 'أطروحة دكتوراه', 'غير منشورة', 'جامعة ', 'الجامعة ',
  'المؤتمر ', 'مجلة ', 'دار النشر', 'مكتبة ', 'رقم الإيداع', 'ردمك',
  'ترجمة أ.', 'ترجمة د.', 'كلية التربية، جامعة', 'الإصدار الأول، مؤسسة',
]

const normalize = (value = '') => String(value)
  .normalize('NFC')
  .replace(/\s+/g, ' ')
  .trim()

const fingerprint = (value = '') => normalize(value)
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[^؀-ۿ]/g, '')

const looksLikeReference = (text = '') => {
  const value = normalize(text)
  if (REFERENCE_MARKERS.some((marker) => value.includes(marker))) return true
  if ((value.match(/،/g) || []).length >= 4 && /(?:جامعة|كلية|مجلة|مؤتمر|رسالة|أطروحة)/u.test(value)) return true
  return false
}

const validFragment = (text = '') => {
  const value = normalize(text)
  if (value.length < 48 || value.length > 300) return false
  if (looksLikeReference(value)) return false
  if (!/[؀-ۿ]/u.test(value)) return false
  const letters = value.replace(/[^\p{L}]/gu, '')
  const arabic = value.replace(/[^؀-ۿ]/gu, '')
  if (!letters.length || arabic.length / letters.length < .97) return false
  if (/^[،؛:.\-–—]|[،؛:]$/u.test(value)) return false
  if ((value.match(/[0-9٠-٩۰-۹]/g) || []).length > 4) return false
  return true
}

function sentenceParts(text) {
  return normalize(text).split(/(?<=[.؟!])\s+/u).map(normalize).filter(Boolean)
}

function wordWindows(sentence) {
  const words = normalize(sentence).split(' ').filter(Boolean)
  if (words.length < 22) return []
  const windows = []
  const size = 18
  const step = 10
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + size)
    if (slice.length < 10) break
    windows.push(slice.join(' '))
    if (start + size >= words.length) break
  }
  return windows
}

function clauseParts(sentence) {
  return normalize(sentence)
    .split(/(?<=[،؛:])\s+|\s+(?=(?:ولكن|ولذلك|لذلك|ومن ثم|حيث|إذ|كما|بينما|بل|أما|وعليه)\s)/u)
    .map(normalize)
    .filter(Boolean)
}

export function expandEncyclopediaPassages(passages = [], { target = 900 } = {}) {
  const source = passages.filter((item) => item && !looksLikeReference(item.text))
  const candidates = []
  const seen = new Set()

  const add = (parent, text, variant) => {
    const clean = normalize(text)
    if (!validFragment(clean)) return
    const print = fingerprint(clean)
    if (print.length < 38 || seen.has(print)) return
    seen.add(print)
    candidates.push({ parent, text: clean, variant, print })
  }

  for (const passage of source) {
    add(passage, passage.text, 'original')
    for (const sentence of sentenceParts(passage.text)) {
      if (sentence !== normalize(passage.text)) add(passage, sentence, 'sentence')
      const clauses = clauseParts(sentence)
      for (const clause of clauses) add(passage, clause, 'clause')
      for (let index = 0; index < clauses.length - 1; index += 1) {
        add(passage, `${clauses[index]} ${clauses[index + 1]}`, 'clause-pair')
      }
      for (let index = 0; index < clauses.length - 2; index += 1) {
        add(passage, `${clauses[index]} ${clauses[index + 1]} ${clauses[index + 2]}`, 'clause-triple')
      }
      for (const window of wordWindows(sentence)) add(passage, window, 'word-window')
    }
  }

  const priority = { original: 0, sentence: 1, 'clause-pair': 2, clause: 3, 'clause-triple': 4, 'word-window': 5 }
  candidates.sort((left, right) =>
    Number(left.parent.page || 0) - Number(right.parent.page || 0)
    || (priority[left.variant] ?? 9) - (priority[right.variant] ?? 9)
    || left.text.length - right.text.length)

  const selected = candidates.slice(0, Math.max(target, source.length))
  return selected.map((entry, index) => ({
    ...entry.parent,
    id: `encyclopedia-p${String(index + 1).padStart(4, '0')}`,
    text: entry.text,
    fingerprint: entry.print,
    parentPassageId: entry.parent.id,
    segmentKind: entry.variant,
  }))
}

export { looksLikeReference, validFragment }
