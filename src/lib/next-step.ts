import type { ArticleRecord, MediaRecord, PaperRecord } from './cms'
import { matchBookQuotes, searchBookPassages } from './book-quotes'
import { chaptersForVideo, searchMediaChapters, stamp } from './media-chapters'

/**
 * الفصل التالي — خطوةٌ واحدة لا قائمة.
 *
 * القوائم في نهاية الصفحات تُنهي الزيارة: يرى القارئ عشرة خيارات فلا يختار
 * واحداً. وهذه تعطيه **خطوة واحدة** فقط، بشرطين:
 *   1) من **نوعٍ مختلف** عمّا قرأه للتوّ — قرأ مقالاً فيُقترح عليه لقاءٌ أو
 *      مقطعُ كتاب. التنويع هو ما يمنع الملل، لا الكثرة.
 *   2) **لا تتكرّر**: ما رآه القارئ لا يُعرض عليه ثانيةً، ولو زار مئة صفحة.
 *
 * فتصير الزيارة نهراً لا قائمة طعام.
 */

const SEEN_KEY = 'next-step:seen:v1'
const SEEN_LIMIT = 120

export type NextStep = {
  key: string
  kind: 'مقال' | 'لقاء' | 'كتاب' | 'بحث محكّم'
  /* الدعوة تُكتب بلغة ما سيجده، لا بلغة الواجهة. */
  invite: string
  title: string
  to: string
}

const readSeen = (): string[] => {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

export const rememberStep = (key: string) => {
  try {
    const next = [key, ...readSeen().filter((item) => item !== key)].slice(0, SEEN_LIMIT)
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    /* بلا تخزين: تعمل الميزة، وقد تتكرّر خطوةٌ نادراً. لا يستحق إزعاج القارئ. */
  }
}

const STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع كان كانت'.split(' '))
const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word
    .replace(/^(?:[وف])(?=[بكل]ال|ال)/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^[بكل](?=ال.{3,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')
    .replace(/^[وف](?=.{4,})/u, '')
    .replace(/(?:ات|ون|ين|ية|يه)$/u, ''))
  .filter((word) => word.length > 2 && !STOP.has(word)))

const overlap = (left: Set<string>, right: Set<string>) => {
  let score = 0
  for (const word of left) if (right.has(word)) score += 1
  return score
}

export type NextStepInput = {
  /** الفكرة التي يقف عندها القارئ الآن — عنوان المقال ومقتطفه مثلاً. */
  seed: string
  /** نوع ما يقرؤه الآن، فلا نقترح عليه مثله. */
  from: NextStep['kind']
  articles: ArticleRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
  /** استُبعد صراحةً — الصفحة الحالية. */
  excludeKey?: string
  /** هل جهز فهرس المتون؟ إن لا، نكتفي بالمختارات. */
  deepReady?: boolean
}

/**
 * يختار خطوةً واحدة. يعيد null إن لم يجد ما يستحق — والصمت خيرٌ من اقتراحٍ
 * بعيد عن الفكرة.
 */
export function pickNextStep(input: NextStepInput): NextStep | null {
  const seed = roots(input.seed)
  if (seed.size < 1) return null
  const seen = new Set([...readSeen(), input.excludeKey || ''])
  const candidates: (NextStep & { score: number })[] = []

  /* لقاء: أقصر التزامٍ على القارئ، وأقرب إلى صوت الدكتور. */
  for (const hit of searchMediaChapters(input.seed, 3)) {
    const key = `media:${hit.videoId}:${hit.chapter.at}`
    if (seen.has(key)) continue
    candidates.push({
      key,
      kind: 'لقاء',
      invite: `اسمعه يقولها بصوته — نحو ${stamp(hit.chapter.at)}`,
      title: hit.title,
      to: `/media/media-${hit.videoId}`,
      score: hit.score * 3,
    })
  }

  /* كتاب: أعمق طبقة، ومقطعٌ واحد لا يرهق. */
  const passages = input.deepReady ? searchBookPassages(input.seed, 3) : matchBookQuotes(input.seed, 3)
  for (const match of passages) {
    const key = `book:${match.quote.id}`
    if (seen.has(key)) continue
    candidates.push({
      key,
      kind: 'كتاب',
      invite: `يتوسّع الدكتور في هذه الفكرة داخل «${match.bookTitle}» — ص ${match.quote.page}`,
      title: match.quote.conceptTitle || match.bookTitle,
      to: `/publications/${match.bookSlug}#book-knowledge`,
      score: match.score * 2,
    })
  }

  for (const paper of input.papers) {
    const record = paper as typeof paper & { titleAr?: string; abstractAr?: string }
    const key = `paper:${paper.slug}`
    if (seen.has(key)) continue
    const score = overlap(seed, roots(`${record.titleAr || paper.title} ${record.abstractAr || ''} ${paper.meta || ''}`))
    if (score < 2) continue
    candidates.push({
      key,
      kind: 'بحث محكّم',
      invite: 'وهذا ما أثبته في بحثٍ محكّم',
      title: record.titleAr || paper.title,
      to: `/research/${paper.slug}`,
      score: score * 2,
    })
  }

  for (const article of input.articles) {
    const key = `article:${article.slug}`
    if (seen.has(key)) continue
    const score = overlap(seed, roots(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`))
    if (score < 2) continue
    candidates.push({
      key,
      kind: 'مقال',
      invite: 'وله مقالٌ يمضي بالفكرة أبعد',
      title: article.title,
      to: `/articles/${article.slug}`,
      score,
    })
  }

  if (!candidates.length) return null

  /* التنويع أولاً: ما اختلف نوعه عمّا يقرؤه الآن يسبق، مهما بلغت درجة غيره.
     هكذا لا يقع القارئ في سلسلةٍ من المقالات المتشابهة. */
  const fresh = candidates.filter((item) => item.kind !== input.from)
  const pool = fresh.length ? fresh : candidates
  pool.sort((left, right) => right.score - left.score)
  const chosen = pool[0]
  return { key: chosen.key, kind: chosen.kind, invite: chosen.invite, title: chosen.title, to: chosen.to }
}

/** يستعمله اللقاء ليعرف إن كانت له محاور — بلا استيرادٍ ثانٍ في الواجهة. */
export const hasChapters = (videoId: string) => chaptersForVideo(videoId).length > 0
