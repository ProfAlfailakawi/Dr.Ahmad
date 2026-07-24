import type { ArticleRecord, BookRecord, PaperRecord } from './cms'

type DialogueMode = 'خيط خفي' | 'وجه آخر للفكرة' | 'بعد سنوات' | 'سؤال لم يُطرح'
type DialogueLabel = 'خلاصة مركبة' | 'فكرة مستخلصة'

export type ArchiveDialogueSource = {
  kind: 'مقال' | 'كتاب' | 'بحث'
  title: string
  to: string
  year?: string
}

export type ArchiveDialogue = {
  id: string
  mode: DialogueMode
  label: DialogueLabel
  title: string
  body: string
  sources: ArchiveDialogueSource[]
}

type Candidate = ArchiveDialogueSource & {
  text: string
  tokens: Set<string>
  iso?: string
}

const STOP = new Set([
  'الى', 'إلى', 'على', 'عن', 'في', 'من', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي',
  'بين', 'بعد', 'قبل', 'كل', 'غير', 'كيف', 'هل', 'ما', 'لم', 'لن', 'ثم', 'او', 'أو',
  'استخدام', 'دراسة', 'واقع', 'دولة', 'وجهة', 'نظر', 'أعضاء', 'هيئة', 'التدريس',
])

const normalize = (value = '') =>
  value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const tokenSet = (value: string) =>
  new Set(
    normalize(value)
      .split(' ')
      .filter((token) => token.length > 2 && !STOP.has(token)),
  )

const compact = (value = '', limit = 170) => {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  const slice = clean.slice(0, limit)
  const boundary = Math.max(slice.lastIndexOf('،'), slice.lastIndexOf('.'), slice.lastIndexOf('؟'))
  return `${(boundary > 85 ? slice.slice(0, boundary) : slice).trim()}…`
}

const yearFrom = (value?: string) => value?.match(/(?:19|20)\d{2}/)?.[0]

function articleCandidates(articles: ArticleRecord[]): Candidate[] {
  return articles
    .filter((item) => !item._cms.hidden && !item._cms.deleted)
    .map((item) => ({
      kind: 'مقال' as const,
      title: item.title,
      to: `/articles/${item.slug}`,
      year: yearFrom(item.iso) || item.year,
      iso: item.iso,
      text: `${item.title} ${item.cat || ''} ${item.excerpt || ''}`,
      tokens: tokenSet(`${item.title} ${item.cat || ''} ${item.excerpt || ''}`),
    }))
}

function bookCandidates(books: BookRecord[]): Candidate[] {
  return books
    .filter((item) => !item._cms.hidden && !item._cms.deleted)
    .map((item) => ({
      kind: 'كتاب' as const,
      title: item.title,
      to: `/publications/${item.slug}`,
      text: `${item.title} ${item.desc || ''}`,
      tokens: tokenSet(`${item.title} ${item.desc || ''}`),
    }))
}

function paperCandidates(papers: PaperRecord[]): Candidate[] {
  return papers
    .filter((item) => !item._cms.hidden && !item._cms.deleted)
    .map((item) => {
      const title = item.titleAr || item.title
      const text = [title, item.meta, item.abstractAr, item.keyFinding, item.keywords].filter(Boolean).join(' ')
      return {
        kind: 'بحث' as const,
        title,
        to: `/research/${item.slug}`,
        year: item.year || yearFrom(item.iso) || yearFrom(item.date) || yearFrom(item.journal),
        iso: item.iso,
        text,
        tokens: tokenSet(text),
      }
    })
}

const overlap = (a: Candidate, b: Candidate) => {
  let score = 0
  for (const token of a.tokens) if (b.tokens.has(token)) score += token.length >= 7 ? 3 : 2
  if (a.kind !== b.kind) score += 2
  return score
}

function bestPair(left: Candidate[], right: Candidate[], used: Set<string>) {
  let best: { a: Candidate; b: Candidate; score: number } | undefined
  for (const a of left) {
    if (used.has(a.to)) continue
    for (const b of right) {
      if (a.to === b.to || used.has(b.to)) continue
      const score = overlap(a, b)
      if (!best || score > best.score) best = { a, b, score }
    }
  }
  return best && best.score >= 4 ? best : undefined
}

const markUsed = (used: Set<string>, ...items: Candidate[]) => items.forEach((item) => used.add(item.to))
const asSource = ({ kind, title, to, year }: Candidate): ArchiveDialogueSource => ({ kind, title, to, year })

function sharedWords(a: Candidate, b: Candidate) {
  return [...a.tokens]
    .filter((token) => b.tokens.has(token))
    .sort((x, y) => y.length - x.length)
    .slice(0, 3)
}

function buildThread(articles: Candidate[], papers: Candidate[], used: Set<string>): ArchiveDialogue | undefined {
  const pair = bestPair(articles, papers, used)
  if (!pair) return undefined
  markUsed(used, pair.a, pair.b)
  const themes = sharedWords(pair.a, pair.b)
  const theme = themes.length ? themes.join('، ') : 'السؤال التربوي نفسه'
  return {
    id: `thread:${pair.a.to}:${pair.b.to}`,
    mode: 'خيط خفي',
    label: 'خلاصة مركبة',
    title: `فكرة واحدة تتحرك بين المقال والبحث: ${theme}`,
    body: `يلتقي «${pair.a.title}» مع «${pair.b.title}» عند مساحة موضوعية مشتركة. البطاقة لا تدّعي تطابق النصين؛ بل تكشف طريقاً قصيراً للقراءة المتقاطعة بين التأمل العام والدليل البحثي المنشور.`,
    sources: [asSource(pair.a), asSource(pair.b)],
  }
}

function buildAcrossYears(articles: Candidate[], used: Set<string>): ArchiveDialogue | undefined {
  const dated = articles
    .filter((item) => item.iso && item.year && !used.has(item.to))
    .sort((a, b) => String(a.iso).localeCompare(String(b.iso)))
  let best: { a: Candidate; b: Candidate; score: number; gap: number } | undefined
  for (let i = 0; i < dated.length; i += 1) {
    for (let j = i + 1; j < dated.length; j += 1) {
      const firstYear = Number(dated[i].year)
      const secondYear = Number(dated[j].year)
      const gap = Number.isFinite(firstYear) && Number.isFinite(secondYear) ? secondYear - firstYear : 0
      const score = overlap(dated[i], dated[j]) + Math.min(Math.max(gap, 0), 8)
      if (gap >= 2 && (!best || score > best.score)) best = { a: dated[i], b: dated[j], score, gap }
    }
  }
  if (!best || overlap(best.a, best.b) < 2) return undefined
  markUsed(used, best.a, best.b)
  return {
    id: `years:${best.a.to}:${best.b.to}`,
    mode: 'بعد سنوات',
    label: 'خلاصة مركبة',
    title: `السؤال بقي حيّاً بين ${best.a.year} و${best.b.year}`,
    body: `يمكن قراءة «${best.a.title}» ثم «${best.b.title}» كمسارين زمنيين لموضوع متقارب. المقارنة هنا لا تزعم ثبات الموقف أو تغيّره؛ إنها تضع النصين جنباً إلى جنب كي يكتشف القارئ ما استمر وما تبدّل.`,
    sources: [asSource(best.a), asSource(best.b)],
  }
}

function buildOtherFace(books: Candidate[], articles: Candidate[], used: Set<string>): ArchiveDialogue | undefined {
  const pair = bestPair(books, articles, used)
  if (!pair) return undefined
  markUsed(used, pair.a, pair.b)
  return {
    id: `other:${pair.a.to}:${pair.b.to}`,
    mode: 'وجه آخر للفكرة',
    label: 'خلاصة مركبة',
    title: `من الفكرة الممتدة في كتاب إلى لحظتها المكثفة في مقال`,
    body: `يعرض الكتاب «${pair.a.title}» المجال الواسع للفكرة، بينما يقدّم المقال «${pair.b.title}» مدخلاً أقصر إليها. هذه ليست إحالة إلى صفحات خاصة من الكتاب، بل بوابة آمنة تبدأ من وصفه العام والمقال المنشور.`,
    sources: [asSource(pair.a), asSource(pair.b)],
  }
}

function buildUnasked(papers: Candidate[], used: Set<string>): ArchiveDialogue | undefined {
  const candidate = papers
    .filter((item) => !used.has(item.to))
    .sort((a, b) => b.tokens.size - a.tokens.size || a.title.localeCompare(b.title, 'ar'))[0]
  if (!candidate) return undefined
  markUsed(used, candidate)
  const seed = compact(candidate.text.replace(candidate.title, '').trim(), 145)
  return {
    id: `question:${candidate.to}`,
    mode: 'سؤال لم يُطرح',
    label: 'فكرة مستخلصة',
    title: `ماذا يتغيّر لو قرأنا نتيجة البحث بوصفها بداية سؤال؟`,
    body: seed
      ? `ينطلق السؤال من المادة العامة المرافقة لبحث «${candidate.title}»: ${seed} لا تقدّم البطاقة جواباً جديداً بالنيابة عن البحث؛ بل تفتح مساراً للقراءة والتحقق من المصدر.`
      : `يقترح بحث «${candidate.title}» سؤالاً تالياً يستحق القراءة من المصدر نفسه. البطاقة لا تختلق نتيجة ولا تنقل اقتباساً؛ إنها دعوة لبدء الاستكشاف من صفحة البحث.`,
    sources: [asSource(candidate)],
  }
}

export function buildArchiveDialogues(
  articles: ArticleRecord[],
  books: BookRecord[],
  papers: PaperRecord[],
): ArchiveDialogue[] {
  const articlePool = articleCandidates(articles)
  const bookPool = bookCandidates(books)
  const paperPool = paperCandidates(papers)
  const used = new Set<string>()

  return [
    buildThread(articlePool, paperPool, used),
    buildAcrossYears(articlePool, used),
    buildOtherFace(bookPool, articlePool, used),
    buildUnasked(paperPool, used),
  ].filter((item): item is ArchiveDialogue => Boolean(item))
}
