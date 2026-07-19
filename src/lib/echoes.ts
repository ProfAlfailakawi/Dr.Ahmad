/**
 * أصداء الأرشيف — «هل قلتُ هذا من قبل؟»
 *
 * «ذاكرة الموضوع» القائمة تقول للدكتور: هذه المقالات تشبه ما تكتب. وهي نافعة،
 * لكنها لا تُجيب السؤال الذي يقلق من كتب ألف مقال: أيُّ جملةٍ بعينها كرّرتُها؟
 * وعنوانٌ مشابهٌ لا يُقلق — الجملة المكرّرة هي التي تُقلق.
 *
 * فهذا الملف يقارن جُملاً بجُمَل، ويُري الدكتور نصّه القديم بحرفه إلى جانب
 * نصّه الجديد. ولا يحكم: لا يقول «كرّرت نفسك» ولا «تناقضت». يعرض ويصمت،
 * فالحكم له وحده — وهو الوحيد الذي يعرف أكان التكرار قصداً أم سهواً.
 */
import { normalizeIdea } from './intelligence'

export type EchoSource = { slug: string; title: string; iso?: string; body?: string }

export type Echo = {
  draft: string      // جملة المسودة، بنصّها
  past: string       // جملته القديمة، بحرفها
  slug: string
  title: string
  year: string
  overlap: number    // ٠–١ · نسبة التقاطع بعد التطبيع
}

/* لواحق وسوابق شائعة — نفس منطق محرك البوت، فالعربية واحدة في الطرفين */
const PREFIX = /^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/
const SUFFIX = /(?:اتها|اتهم|اتنا|ات|ها|هم|هن|كم|نا|يه|ية|ه|ي)$/

const STOP = new Set([
  'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'الذين', 'على', 'الى', 'عن', 'من', 'في', 'مع',
  'كان', 'كانت', 'يكون', 'ليس', 'لكن', 'لان', 'ان', 'كل', 'بعد', 'قبل', 'حين', 'حتى', 'نحن',
  'وهو', 'وهي', 'كما', 'وقد', 'لقد', 'او', 'ثم', 'بل', 'ما', 'لا', 'لم', 'لن', 'قد', 'هو',
  'هي', 'هم', 'بين', 'عند', 'اليوم', 'كذلك', 'ايضا', 'حيث', 'اي', 'شي',
])

export function stem(word: string): string {
  let out = word
  const bare = out.replace(PREFIX, '')
  if (bare.length >= 3) out = bare
  const cut = out.replace(SUFFIX, '')
  if (cut.length >= 3) out = cut
  return out
}

export function keyWords(value: string): Set<string> {
  return new Set(
    normalizeIdea(value)
      .split(' ')
      .filter((word) => word.length > 2 && !STOP.has(word))
      .map(stem)
      .filter((word) => word.length >= 3),
  )
}

/** تقطيعٌ يحفظ النصّ كما هو — نعرض على الدكتور حرفه لا صياغةً عنه */
export function splitSentences(body: string): string[] {
  return String(body || '')
    .split(/(?<=[.؟!])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 45 && line.length <= 400)
}

/** تشابه دايس: يُكافئ التقاطع ويعاقب الطول، فلا تفوز الجملة الطويلة بطولها */
export function similarity(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return (2 * shared) / (left.size + right.size)
}

/**
 * يبني فهرس الجُمَل مرّة واحدة. المقالات لا تتغيّر بين ضغطتَي مفتاح، وإعادة
 * تقطيع مئة وستين متناً مع كل حرفٍ يكتبه الدكتور تُجمّد اللوحة بين يديه.
 */
export function indexPast(sources: EchoSource[]) {
  const rows: { slug: string; title: string; year: string; text: string; words: Set<string> }[] = []
  for (const source of sources) {
    if (!source?.body) continue
    const year = String(source.iso || '').slice(0, 4)
    for (const text of splitSentences(source.body)) {
      const words = keyWords(text)
      if (words.size >= 4) rows.push({ slug: source.slug, title: source.title, year, text, words })
    }
  }
  return rows
}

/**
 * أصداء المسودة. العتبة ٠٫٤٥: دونها تشابهٌ موضوعيّ عاديّ بين كاتبٍ ونفسه —
 * وإغراق الدكتور بعشرين «صدى» في كل مسودة يجعله يُغلق اللوحة ولا ينظر إليها.
 * وفوقها يفوت التكرار الحقيقي. مضبوطةٌ لتُظهر ما يستحقّ وقفةً لا ما يُزعج.
 */
export function findEchoes(
  draftBody: string,
  index: ReturnType<typeof indexPast>,
  { threshold = 0.45, limit = 4 } = {},
): Echo[] {
  const found: Echo[] = []
  for (const sentence of splitSentences(draftBody)) {
    const words = keyWords(sentence)
    if (words.size < 4) continue
    let best: (typeof index)[number] | null = null
    let bestScore = 0
    for (const row of index) {
      const score = similarity(words, row.words)
      if (score > bestScore) { bestScore = score; best = row }
    }
    if (best && bestScore >= threshold) {
      found.push({ draft: sentence, past: best.text, slug: best.slug, title: best.title, year: best.year, overlap: bestScore })
    }
  }
  /* الأقوى أولاً، ولا نُكرّر المقال الواحد مرّتين — يكفي شاهدٌ منه */
  const seen = new Set<string>()
  const unique: Echo[] = []
  for (const echo of found.sort((a, b) => b.overlap - a.overlap)) {
    if (seen.has(echo.slug)) continue
    seen.add(echo.slug)
    unique.push(echo)
    if (unique.length >= limit) break
  }
  return unique
}

/** وصفٌ بلا حكم: نصف القوة ولا نقول «كرّرت» — الحكم للدكتور وحده */
export function describe(overlap: number): string {
  if (overlap >= 0.75) return 'قريبةٌ جداً من نصٍّ سابق'
  if (overlap >= 0.6) return 'تلتقي مع نصٍّ سابق'
  return 'فيها صدى من نصٍّ سابق'
}
