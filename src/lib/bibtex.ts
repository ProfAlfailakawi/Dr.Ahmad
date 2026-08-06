/**
 * مولّد BibTeX واحد للموقع كله.
 *
 * القاعدة الحاكمة: لا يُكتب في السجل ما ليس في البيانات. الحقل الغائب يُحذف
 * ولا يُملأ بالتخمين، والنوع لا يُختار لأنه «يُكمل الحقول» بل لأنه الصادق.
 * والعنوان العربي يبقى كما هو — لا تحويل إلى ASCII ولا تشويه.
 */

export type BibTeXType = 'article' | 'book' | 'incollection' | 'inproceedings' | 'phdthesis' | 'mastersthesis' | 'misc'

export type BibTeXRecord = {
  type: BibTeXType
  /** معرّف السجل في الموقع (slug/مسار) — يُثبّت المفتاح ولا يظهر في المخرجات. */
  id?: string
  authors?: string | string[]
  title: string
  journal?: string
  booktitle?: string
  year?: string | number
  volume?: string | number
  number?: string | number
  pages?: string
  publisher?: string
  address?: string
  doi?: string
  url?: string
  isbn?: string
  issn?: string
  language?: string
  note?: string
}

/** ترتيب الحقول ثابت حتى لا يتغيّر الملف بين نسختين من السجل نفسه. */
const FIELD_ORDER = ['authors', 'title', 'journal', 'booktitle', 'year', 'volume', 'number', 'pages', 'publisher', 'address', 'doi', 'url', 'isbn', 'issn', 'language', 'note'] as const
const FIELD_NAMES: Partial<Record<(typeof FIELD_ORDER)[number], string>> = { authors: 'author' }

/** الحقول المسموحة لكل نوع — ما لا يقبله النوع لا يُكتب فيه. */
const TYPE_FIELDS: Record<BibTeXType, ReadonlySet<string>> = {
  article: new Set(['authors', 'title', 'journal', 'year', 'volume', 'number', 'pages', 'doi', 'url', 'issn', 'language', 'note']),
  book: new Set(['authors', 'title', 'year', 'volume', 'number', 'publisher', 'address', 'doi', 'url', 'isbn', 'language', 'note']),
  incollection: new Set(['authors', 'title', 'booktitle', 'year', 'volume', 'number', 'pages', 'publisher', 'address', 'doi', 'url', 'isbn', 'language', 'note']),
  inproceedings: new Set(['authors', 'title', 'booktitle', 'year', 'volume', 'number', 'pages', 'publisher', 'address', 'doi', 'url', 'isbn', 'language', 'note']),
  phdthesis: new Set(['authors', 'title', 'year', 'publisher', 'address', 'doi', 'url', 'language', 'note']),
  mastersthesis: new Set(['authors', 'title', 'year', 'publisher', 'address', 'doi', 'url', 'language', 'note']),
  misc: new Set(['authors', 'title', 'booktitle', 'year', 'volume', 'number', 'pages', 'publisher', 'address', 'doi', 'url', 'isbn', 'issn', 'language', 'note']),
}

/** في phdthesis/mastersthesis اسم الحقل القياسي هو school لا publisher. */
const THESIS_TYPES = new Set<BibTeXType>(['phdthesis', 'mastersthesis'])

const ARABIC = /[؀-ۿݐ-ݿ]/u

function clean(value: unknown) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/* ── أسماء المؤلفين ───────────────────────────────────────────────── */

const NAME_SEPARATOR = /\s*(?:;|\||\sand\s|\sو\s|،\s*و\s*)\s*/giu
const HONORIFICS = /^(?:د\.|أ\.\s*د\.|الدكتور|الأستاذ|Prof\.?|Dr\.?)\s*/iu

/**
 * يُعيد اسماً واحداً بصيغة BibTeX الصحيحة.
 * - الاسم الذي فيه فاصلة أصلاً («العنزي، عبدالعزيز») يبقى كما هو.
 * - الاسم الإنجليزي يُقلب إلى `Family, Given` لأن البنية تسمح.
 * - الاسم العربي **لا يُقلب**: بنيته (ابن/عبد/آل/أل التعريف) لا تسمح بقلبٍ آمن،
 *   ويُلفّ بأقواس حتى لا يفسّره BibTeX على أنه «given family».
 */
export function bibtexAuthorName(value: string) {
  const raw = clean(value).replace(HONORIFICS, '').trim()
  if (!raw) return ''
  if (ARABIC.test(raw)) return `{${raw.replace(/،/g, ',')}}`
  if (raw.includes(',')) {
    const [family, ...rest] = raw.split(',')
    const given = rest.join(',').trim()
    return given ? `${family.trim()}, ${given}` : family.trim()
  }
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return raw
  const particles = new Set(['van', 'von', 'de', 'del', 'della', 'da', 'di', 'du', 'la', 'le', 'bin', 'ibn', 'al', 'el', 'ter', 'ten'])
  let familyStart = parts.length - 1
  while (familyStart > 1 && particles.has(parts[familyStart - 1].toLowerCase().replace(/\./g, ''))) familyStart -= 1
  const family = parts.slice(familyStart).join(' ')
  const given = parts.slice(0, familyStart).join(' ')
  return given ? `${family}, ${given}` : family
}

/** يحوّل مؤلفاً واحداً أو قائمة إلى سلسلة BibTeX موصولة بـ and. */
export function bibtexAuthors(value?: string | string[]) {
  const source = Array.isArray(value) ? value : clean(value).split(NAME_SEPARATOR)
  const names = source.map((item) => bibtexAuthorName(String(item ?? ''))).filter(Boolean)
  return [...new Set(names)].join(' and ')
}

/* ── الهروب والتنظيف ──────────────────────────────────────────────── */

/** يحمي الاختصارات الكبيرة (AI, STEM, ICT) من تصغير BibTeX لها. */
function protectAcronyms(value: string) {
  return value.replace(/\b[A-Z][A-Z0-9]+\b/g, (word) => `{${word}}`)
}

/* مرورٌ واحد: لو هُرِّب الشرطة المائلة أولاً لعادت أقواسُ بديلها فهُرِّبت مرة ثانية. */
const TEX_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}',
  '%': '\\%', '#': '\\#', '&': '\\&', '_': '\\_', '$': '\\$',
  '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
}

export function escapeBibTeX(value: unknown, { protectCase = false } = {}) {
  const escaped = clean(value)
    .replace(/[\\{}%#&_$~^]/g, (char) => TEX_ESCAPES[char])
    .replace(/«/g, '“')
    .replace(/»/g, '”')
  return protectCase ? protectAcronyms(escaped) : escaped
}

/* ── مفتاح الاستشهاد ─────────────────────────────────────────────── */

const TRANSLITERATION: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't',
  'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
  'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'ة': 'a',
  'و': 'w', 'ي': 'y', 'ى': 'a', 'ء': '', 'ئ': 'i', 'ؤ': 'u',
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'من', 'في', 'على', 'عن', 'إلى', 'الى', 'مع'])

/** تحويل ثابت لا يتغيّر أبداً لنفس المدخل — شرط ثبات المفتاح. */
function latinize(value: string) {
  const stripped = clean(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670]/g, '')
  let out = ''
  for (const char of stripped) {
    if (/[A-Za-z0-9]/.test(char)) out += char
    else if (TRANSLITERATION[char] !== undefined) out += TRANSLITERATION[char]
  }
  return out
}

const ARABIC_INDIC = /[\u0660-\u0669\u06f0-\u06f9]/g
/** ٢٠٢٦ ← 2026 — لاستخراج السنة فقط، ولا يمسّ نص العنوان. */
const latinDigits = (value: string) => value.replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) & 0xf))

const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : '')

/**
 * مفتاحٌ ثابتٌ قابل للتوقّع: `Alfailakawi2024EducationalTechnology`.
 * لا يتغيّر بين استدعاءين لنفس السجل، ولا يحتوي فراغاً ولا رمزاً خاصاً.
 * `taken` مجموعةُ المفاتيح المستعملة — عند التكرار يُلحق حرفٌ لاحق (a, b, c…).
 */
export function createBibTeXKey(record: BibTeXRecord, taken?: Set<string>) {
  const first = bibtexAuthors(record.authors).split(/\s+and\s+/i)[0] || ''
  const bare = first.replace(/[{}]/g, '').trim()
  const family = bare.includes(',') ? bare.split(',')[0].trim() : bare.split(/\s+/).filter(Boolean).at(-1) || bare
  const author = capitalize(latinize(family)) || capitalize(latinize(String(record.id || ''))) || 'Untitled'
  const year = latinDigits(clean(record.year)).match(/(?:19|20)\d{2}/)?.[0] || 'ND'
  const words = clean(record.title)
    .split(/[\s،,.:;()[\]{}"'«»/\\-]+/u)
    .filter((word) => word && !STOP_WORDS.has(word.toLowerCase()))
    .map((word) => capitalize(latinize(word)))
    .filter((word) => word.length >= 3)
    .slice(0, 2)
    .join('')
  const base = `${author}${year}${words || 'Work'}`.replace(/[^A-Za-z0-9]/g, '')
  if (!taken) return base
  if (!taken.has(base)) { taken.add(base); return base }
  for (let index = 0; index < 26 * 26; index += 1) {
    const suffix = index < 26
      ? String.fromCharCode(97 + index)
      : `${String.fromCharCode(97 + Math.floor(index / 26) - 1)}${String.fromCharCode(97 + (index % 26))}`
    const candidate = `${base}${suffix}`
    if (!taken.has(candidate)) { taken.add(candidate); return candidate }
  }
  return base
}

/* ── الاستنتاج والبناء ───────────────────────────────────────────── */

/** يستنتج النوع من بيانات السجل الحقيقية — ولا يخترع نوعاً لإكمال حقول. */
export function inferBibTeXType(meta: { container?: string; kind?: string; hasJournal?: boolean; hasBooktitle?: boolean } = {}): BibTeXType {
  const text = `${meta.kind || ''} ${meta.container || ''}`.trim()
  if (/رسالة\s*دكتوراه|أطروحة\s*دكتوراه|phd\s*thesis|doctoral/i.test(text)) return 'phdthesis'
  if (/رسالة\s*ماجستير|master'?s?\s*thesis|msc\s*thesis/i.test(text)) return 'mastersthesis'
  if (/مؤتمر|ندوة|conference|proceedings|symposium|workshop/i.test(text)) return 'inproceedings'
  if (/فصل\s*في\s*كتاب|chapter\s*in|incollection/i.test(text)) return 'incollection'
  if (/مجلة|دورية|journal|periodical|بحث\s*محكم/i.test(text) || meta.hasJournal) return 'article'
  if (/كتاب|book|موسوعة/i.test(text)) return 'book'
  if (meta.hasBooktitle) return 'incollection'
  return 'misc'
}

/** يبني سجل BibTeX واحداً. الحقول الفارغة أو غير المناسبة للنوع تُحذف تماماً. */
export function buildBibTeX(record: BibTeXRecord, options: { taken?: Set<string>; key?: string } = {}) {
  const type: BibTeXType = TYPE_FIELDS[record.type] ? record.type : 'misc'
  const allowed = TYPE_FIELDS[type]
  const lines: string[] = []
  for (const key of FIELD_ORDER) {
    if (!allowed.has(key)) continue
    const value = key === 'authors' ? bibtexAuthors(record.authors) : clean(record[key])
    if (!value) continue
    const name = key === 'publisher' && THESIS_TYPES.has(type) ? 'school' : FIELD_NAMES[key] || key
    /* أسماء المؤلفين مهرّبة مسبقاً بأقواسها؛ لا تُهرَّب مرتين. */
    const body = key === 'authors'
      ? value.replace(/([%#&_$])/g, '\\$1')
      : escapeBibTeX(value, { protectCase: key === 'title' || key === 'booktitle' || key === 'journal' })
    lines.push(`  ${name} = {${body}},`)
  }
  const citationKey = options.key || createBibTeXKey({ ...record, type }, options.taken)
  return `@${type}{${citationKey},\n${lines.join('\n')}\n}`
}

/** يبني ملفاً كاملاً من عدة سجلات مع ضمان عدم تكرار المفاتيح. */
export function buildBibTeXFile(records: BibTeXRecord[]) {
  const taken = new Set<string>()
  return `${records.map((record) => buildBibTeX(record, { taken })).join('\n\n')}\n`
}

/* ── الملفات ─────────────────────────────────────────────────────── */

/** اسم ملفٍ واضحٌ وآمن: بلا فواصل مسار ولا رموز محجوزة في ويندوز/ماك. */
export function safeCitationFilename(title: string, extension: 'bib' | 'ris') {
  const base = clean(title)
    .replace(/[\\/:*?"<>|#%{}$!'`]+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 72)
    .trim()
  return `${base || 'citation'}.${extension}`
}

export function downloadCitationFile(content: string, filename: string, mime: string) {
  /* BOM حتى تفتح برامج المراجع وويندوز الملفَ العربي بترميزٍ صحيح. */
  const blob = new Blob([`\ufeff${content}`], { type: `${mime};charset=utf-8` })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  /* تأخير التحرير: Safari على الهاتف تلغي التنزيل إن حُرِّر الرابط فوراً. */
  window.setTimeout(() => URL.revokeObjectURL(href), 1800)
}
