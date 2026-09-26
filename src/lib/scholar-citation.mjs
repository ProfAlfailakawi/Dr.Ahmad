/**
 * بيانات الاستشهاد العلمي — مصدرٌ واحد لوسوم Google Scholar (Highwire `citation_*`)
 * ولسجل BibTeX، يستعمله مولّد الصفحات الساكنة (scripts/build-static.mjs) والواجهة معاً.
 *
 * القاعدة: لا يُكتب إلا ما في البيانات. الحقل الغائب يُحذف ولا يُخمَّن،
 * والعنوان العربي يبقى كما هو بترميز UTF-8.
 */

export const SCHOLAR_AUTHOR_AR = 'أحمد حسين الفيلكاوي'
export const SCHOLAR_AUTHOR_EN = 'Ahmad H. Alfailakawi'

const ARABIC = /[؀-ۿ]/u
const ARABIC_INDIC = /[٠-٩۰-۹]/g
const HONORIFIC = /^(?:أ\.\s*د\.|د\.|الدكتور|الأستاذ|Prof\.?|Dr\.?)\s*/iu

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const latinDigits = (value) => String(value ?? '').replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) & 0xf))

/** سنة نشرٍ من أربعة أرقام، أو نصٌّ فارغ. */
export function scholarYear(...values) {
  for (const value of values) {
    const year = latinDigits(value).match(/\b(?:19|20)\d{2}\b/)?.[0]
    if (year) return year
  }
  return ''
}

/** يفكك مؤلفين مشاركين («د. فلان، د. علان» أو «فلان و علان») إلى أسماء نظيفة. */
export function splitAuthors(value) {
  return clean(value)
    .split(/\s*(?:;|\||،|,|\sand\s|\sو\s)\s*/u)
    .map((name) => clean(name).replace(HONORIFIC, '').trim())
    .filter(Boolean)
}

/**
 * يفكك سطر الوعاء كما يُخزَّن في البيانات:
 * «المجلة التربوية، جامعة الكويت · المجلد 31، العدد 123 · 2017 · ص 61–99»
 * «Journal of Education and Practice · Vol. 9, No. 32 · 2018 · pp. 12–26»
 */
export function parseJournalLine(line) {
  const text = latinDigits(clean(line))
  if (!text) return { name: '' }
  const [head, ...rest] = text.split(/\s*·\s*/u)
  const tail = rest.join(' · ')
  const volume = tail.match(/(?:Vol\.?|Volume|المجلد)\s*(\d+)/iu)?.[1] || ''
  const issue = tail.match(/(?:No\.?|Issue|العدد)\s*(\d+)/iu)?.[1] || ''
  const pages = tail.match(/(?:pp?\.|ص)\s*(\d+)\s*[–—-]\s*(\d+)/iu)
  return {
    name: clean(head),
    volume,
    issue,
    firstPage: pages?.[1] || '',
    lastPage: pages?.[2] || '',
    year: scholarYear(tail),
  }
}

const absolute = (site, url) => {
  const value = clean(url)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${site}${value}`
  return ''
}

const isConference = (value) => /مؤتمر|ندوة|conference|proceedings|symposium|workshop/i.test(value)

/**
 * سجل استشهاد موحّد لبحث محكّم.
 * `pdfExists(path)` اختياري: يُمرَّر في البناء للتحقق من وجود الملف المحلي فعلاً.
 */
export function paperCitation(paper, { site, pdfExists } = {}) {
  const title = clean(paper?.title)
  const journal = parseJournalLine(paper?.journal)
  const lang = ARABIC.test(title) ? 'ar' : 'en'
  const lead = lang === 'ar' ? SCHOLAR_AUTHOR_AR : SCHOLAR_AUTHOR_EN
  const authors = [lead, ...splitAuthors(paper?.coAuthors)]
  const localPdf = clean(paper?.pdf).startsWith('/')
  /* Scholar يريد ملف PDF حقيقياً: صفحة «عرض» في منصة المجلة ليست PDF فلا تُعلن. */
  const pdfCandidate = localPdf && pdfExists && !pdfExists(clean(paper.pdf)) ? '' : absolute(site, paper?.pdf)
  const pdf = /\.pdf(?:$|[?#])|\/download\//i.test(pdfCandidate) ? pdfCandidate : ''
  const doi = clean(paper?.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
  const conference = isConference(journal.name)
  return {
    kind: conference ? 'inproceedings' : 'article',
    id: clean(paper?.slug),
    title,
    authors: [...new Set(authors)],
    year: scholarYear(paper?.year, journal.year, paper?.journal),
    journal: conference ? '' : journal.name,
    conference: conference ? journal.name : '',
    publisher: '',
    volume: journal.volume,
    issue: journal.issue,
    firstPage: journal.firstPage,
    lastPage: journal.lastPage,
    doi: /^10\.\d{4,9}\//.test(doi) ? doi : '',
    isbn: '',
    pdfUrl: pdf,
    url: site ? `${site}/research/${clean(paper?.slug)}` : '',
    language: lang,
  }
}

/** سجل استشهاد لكتاب مطبوع. لا يُعلن رابط PDF للكتب (بعضها خاص بالمؤلف). */
export function bookCitation(book, { site } = {}) {
  const title = clean(book?.title)
  return {
    kind: 'book',
    id: clean(book?.slug),
    title,
    authors: [...new Set([SCHOLAR_AUTHOR_AR, ...splitAuthors(book?.coAuthors)])],
    year: scholarYear(book?.year),
    journal: '',
    conference: '',
    publisher: clean(book?.publisher),
    volume: '',
    issue: '',
    firstPage: '',
    lastPage: '',
    doi: '',
    isbn: clean(book?.isbn),
    pdfUrl: '',
    url: site ? `${site}/publications/${clean(book?.slug)}` : '',
    language: ARABIC.test(title) ? 'ar' : 'en',
  }
}

/** سجل استشهاد لمقال منشور على الموقع (@misc). */
export function articleCitation(article, { site, siteName = 'الموقع الرسمي لد. أحمد حسين الفيلكاوي' } = {}) {
  const title = clean(article?.title)
  const iso = clean(article?.iso).slice(0, 10)
  return {
    kind: 'misc',
    id: clean(article?.slug),
    title,
    authors: [SCHOLAR_AUTHOR_AR],
    year: scholarYear(iso),
    date: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.replace(/-/g, '/') : '',
    journal: '',
    conference: '',
    publisher: siteName,
    volume: '',
    issue: '',
    firstPage: '',
    lastPage: '',
    doi: '',
    isbn: '',
    pdfUrl: '',
    url: site ? `${site}/articles/${clean(article?.slug)}` : '',
    language: ARABIC.test(title) ? 'ar' : 'en',
  }
}

/** وسوم Highwire Press بالترتيب الذي توصي به Google Scholar. */
export function scholarMetaTags(record) {
  if (!record?.title || !record.authors?.length) return []
  const tags = [['citation_title', record.title]]
  for (const author of record.authors) tags.push(['citation_author', author])
  const date = record.date || record.year
  if (date) tags.push(['citation_publication_date', date])
  if (record.journal) tags.push(['citation_journal_title', record.journal])
  if (record.conference) tags.push(['citation_conference_title', record.conference])
  if (record.publisher) tags.push(['citation_publisher', record.publisher])
  if (record.volume) tags.push(['citation_volume', record.volume])
  if (record.issue) tags.push(['citation_issue', record.issue])
  if (record.firstPage) tags.push(['citation_firstpage', record.firstPage])
  if (record.lastPage) tags.push(['citation_lastpage', record.lastPage])
  if (record.doi) tags.push(['citation_doi', record.doi])
  if (record.isbn) tags.push(['citation_isbn', record.isbn])
  if (record.pdfUrl) tags.push(['citation_pdf_url', record.pdfUrl])
  if (record.url) tags.push(['citation_abstract_html_url', record.url])
  if (record.language) tags.push(['citation_language', record.language])
  return tags
}

/** حقول BibTeX المقابلة (تُمرَّر إلى buildBibTeX في src/lib/bibtex.ts). */
export function citationToBibTeX(record) {
  const pages = record.firstPage && record.lastPage ? `${record.firstPage}--${record.lastPage}` : record.firstPage || ''
  return {
    type: record.kind,
    id: record.id,
    authors: record.authors,
    title: record.title,
    journal: record.journal || undefined,
    booktitle: record.conference || undefined,
    year: record.year || undefined,
    volume: record.volume || undefined,
    number: record.issue || undefined,
    pages: pages || undefined,
    publisher: record.publisher || undefined,
    doi: record.doi || undefined,
    isbn: record.isbn || undefined,
    url: record.url || undefined,
    language: record.language || undefined,
  }
}
