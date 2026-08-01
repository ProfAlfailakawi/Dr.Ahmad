/**
 * رنينُ القرّاء — الجُمَل التي ظلّلها الناس بأصابعهم
 *
 * الموقع يسجّل منذ مدةٍ ما يظلّله القارئ في المتون (`article_highlights`)، وكان
 * ذلك السجل يخدم استوديو التصاميم وحده. وهذه الجُمَل ليست اختيار الدكتور ولا
 * اختيار المحرك: **الناسُ صوّتوا عليها**. فهي أصدق مرشّحٍ للتغريد يملكه الموقع.
 *
 * هذا الملف يحوّل صفوف Firestore الخام إلى اقتباساتٍ مقروءة، **بلا شبكةٍ ولا
 * Firestore داخله** — يستقبل الصفوف والمتون فيعيد الجُمَل. هكذا يُختبر بالكامل،
 * ويصلح لأي مستهلك: الاستوديو، التغريدات، بطاقات الاقتباس، أو البوت.
 *
 * وقاعدةٌ واحدة تحكمه: الاقتباس يُقتطع من المتن نفسه بالإزاحات المسجّلة، فلا
 * يخرج حرفٌ لم يكتبه الدكتور — وهي بوّابة [[voice-echoes]] نفسها بصيغةٍ أخرى.
 */

export interface ResonanceRow {
  slug?: string
  paragraph?: number
  startOffset?: number
  endOffset?: number
  count?: number
}

export interface ResonantQuote {
  /** نصُّ الجملة كما ظلّلها القرّاء، مقتطعاً من المتن. */
  text: string
  slug: string
  title: string
  /** كم قارئاً ظلّلها. */
  count: number
}

export interface ResonanceArticle {
  slug: string
  title: string
  body?: string
}

/** حدّا الاقتباس: أقصر من ٢٥ حرفاً كلمةٌ لا جملة، وأطول من ٢٤٠ فقرةٌ لا اقتباس. */
const MIN_LENGTH = 25
const MAX_LENGTH = 240

const normalize = (value: string) => String(value || '')
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[إأآا]/g, 'ا')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .toLowerCase()

/**
 * يحوّل صفوف التظليل إلى اقتباساتٍ مقروءة مرتّبةً بعدد من ظلّلها.
 *
 * الصفُّ الذي لا يجد متنه، أو تقع إزاحاته خارج الفقرة، أو يخرج بجملةٍ أقصر من
 * أن تدلّ — يسقط بصمتٍ ولا يُرمَّم بالتخمين.
 */
export function resolveResonantQuotes(
  rows: readonly ResonanceRow[],
  articles: readonly ResonanceArticle[],
  options: { minCount?: number; limit?: number } = {},
): ResonantQuote[] {
  const minCount = Math.max(1, options.minCount ?? 1)
  const limit = Math.max(1, options.limit ?? 40)
  const bySlug = new Map(articles.map((article) => [article.slug, article]))
  const seen = new Set<string>()
  const out: ResonantQuote[] = []

  for (const row of [...rows].sort((left, right) => Number(right.count || 0) - Number(left.count || 0))) {
    const count = Number(row.count || 0)
    if (!row.slug || count < minCount) continue
    const article = bySlug.get(row.slug)
    if (!article?.body) continue
    const paragraph = article.body.split('\n\n')[Number(row.paragraph || 0)]
    if (!paragraph) continue
    const start = Number(row.startOffset || 0)
    const end = Number(row.endOffset || 0)
    if (!(end > start) || end > paragraph.length + 1) continue
    const text = paragraph.slice(start, end).replace(/\s+/g, ' ').trim()
    if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) continue
    const key = normalize(text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ text, slug: row.slug, title: article.title, count })
    if (out.length >= limit) break
  }
  return out
}

/** الجُمَل الرنّانة مجموعةً بمقالها — لتغذية كل مادةٍ بما ظُلّل فيها. */
export function resonanceBySlug(quotes: readonly ResonantQuote[]): Map<string, { text: string; count: number }[]> {
  const map = new Map<string, { text: string; count: number }[]>()
  for (const quote of quotes) {
    const list = map.get(quote.slug) || []
    list.push({ text: quote.text, count: quote.count })
    map.set(quote.slug, list)
  }
  for (const list of map.values()) list.sort((left, right) => right.count - left.count)
  return map
}

/** مطابقةٌ متسامحةٌ مع الترقيم والتشكيل: هل هذه الجملة مما ظلّله القرّاء؟ */
export function resonanceCountOf(line: string, resonant: readonly { text: string; count: number }[]): number {
  const key = normalize(line)
  if (!key) return 0
  for (const item of resonant) {
    const itemKey = normalize(item.text)
    if (!itemKey) continue
    if (key === itemKey || key.includes(itemKey) || itemKey.includes(key)) return item.count
  }
  return 0
}
