import type { ArticleRecord } from './cms'

/**
 * «ما تغيّر رأيه فيه» — تطوّر الموقف عبر السنوات.
 *
 * الخطر في هذه الميزة أن نضع في فم الدكتور تناقضاً لم يقله. فالقاعدة هنا:
 * **نقيس ولا نفسّر.** نعرض أقدم ما كتبه في الموضوع وأحدث ما كتبه، ونقيس
 * نبرة كلٍّ منهما بمفرداتٍ محدّدة سلفاً (وعدٌ/تحفّظ). ثم نقول للقارئ الرقم
 * ونتركه يحكم — ولا نكتب أبداً «غيّر رأيه» ما لم يتجاوز الفرق عتبةً معتبرة،
 * وحتى حينها نسمّيه «تحوّلاً في النبرة» لا انقلاباً في الرأي.
 *
 * وإذا كانت المسافة الزمنية قصيرة أو المواد قليلة، لا نعرض شيئاً.
 */

/* مفردات الوعد: التقنية بوصفها فتحاً وإتاحةً وتمكيناً. */
const PROMISE = [
  'تتيح', 'يتيح', 'تمكّن', 'تمكن', 'تسهم', 'يسهم', 'فرصة', 'فرص', 'تطوير',
  'تحسين', 'إثراء', 'انفتاح', 'تسهّل', 'تسهل', 'مستقبل واعد', 'قفزة',
  'ثورة', 'إنجاز', 'تمكين', 'ازدهار', 'أفق',
]

/* مفردات التحفّظ: الانتباه إلى الكلفة الإنسانية والحدود. */
const CAUTION = [
  'خطر', 'مخاطر', 'تهديد', 'قلق', 'حذر', 'انتبه', 'ننتبه', 'إدمان', 'عزلة',
  'فقدان', 'يفقد', 'نفقد', 'تراجع', 'ضياع', 'يغيب', 'تغيب', 'وهم', 'زيف',
  'استلاب', 'يقصي', 'تقصي', 'كلفة', 'ثمن', 'لا يكفي', 'ليس بديلاً',
]

const count = (text: string, list: string[]) =>
  list.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0)

/** حرارة نبرة مقال واحد. null تعني أن النص لا يحمل إشارةً كافية، فلا
 * نختلق له درجةً وسطى في السماء. */
export function articleCaution(value = ''): number | null {
  const promise = count(value, PROMISE)
  const caution = count(value, CAUTION)
  const total = promise + caution
  return total ? Math.round((caution / total) * 100) : null
}

export type EvolutionSide = {
  year: string
  articles: number
  /** نسبة نبرة التحفّظ إلى مجموع الإشارتين — 0 إلى 100. */
  caution: number
  title: string
  slug: string
  line: string
}

export type IdeaEvolution = {
  early: EvolutionSide
  late: EvolutionSide
  /** فرق نبرة التحفّظ بالنقاط المئوية؛ الموجب يعني تحفّظاً متزايداً. */
  shift: number
  years: number
  /** هل يستحق أن يُسمّى تحوّلاً؟ دون العتبة نعرضه بوصفه «امتداداً». */
  meaningful: boolean
}

/** أقوى جملة في المقال تلامس الفكرة — لا أول جملة ولا أطولها. */
function bestLine(article: ArticleRecord & { body?: string }, seed: string[]) {
  const source = `${article.excerpt || ''} ${article.body || ''}`
  const sentences = source
    .split(/(?<=[.؟!])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 60 && item.length <= 240)

  let best = ''
  let bestScore = -1
  for (const sentence of sentences) {
    let score = seed.reduce((total, word) => total + (sentence.includes(word) ? 3 : 0), 0)
    score += count(sentence, PROMISE) + count(sentence, CAUTION)
    if (score > bestScore) { bestScore = score; best = sentence }
  }
  return best || article.excerpt?.slice(0, 200) || ''
}

function sideOf(group: (ArticleRecord & { body?: string })[], seed: string[]): EvolutionSide {
  const text = group.map((item) => `${item.excerpt || ''} ${item.body || ''}`).join(' ')
  const promise = count(text, PROMISE)
  const caution = count(text, CAUTION)
  const total = promise + caution
  const anchor = group[group.length - 1] || group[0]
  return {
    year: String(anchor?.iso || '').slice(0, 4),
    articles: group.length,
    caution: total ? Math.round((caution / total) * 100) : 0,
    title: anchor?.title || '',
    slug: anchor?.slug || '',
    line: anchor ? bestLine(anchor, seed) : '',
  }
}

/**
 * يبني المقارنة من المقالات المطابقة للفكرة، بشرط أن تكفي للحكم:
 * أربع مقالات على الأقل، وخمس سنوات على الأقل بين الطرفين.
 */
export function ideaEvolution(
  matched: (ArticleRecord & { body?: string })[],
  seed: string[],
): IdeaEvolution | null {
  const dated = matched
    .filter((item) => Number(String(item.iso || '').slice(0, 4)) > 1990)
    .sort((left, right) => String(left.iso).localeCompare(String(right.iso)))

  if (dated.length < 4) return null

  const size = Math.max(1, Math.floor(dated.length / 3))
  const early = sideOf(dated.slice(0, size), seed)
  const late = sideOf(dated.slice(-size), seed)
  const years = Number(late.year) - Number(early.year)
  if (!years || years < 5) return null

  const shift = late.caution - early.caution
  return { early, late, shift, years, meaningful: Math.abs(shift) >= 20 }
}
