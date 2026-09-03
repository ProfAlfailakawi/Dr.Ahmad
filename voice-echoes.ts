/**
 * «أصداء من المتون» — صوت الدكتور من كلامه هو.
 *
 * كان قسم «ماذا قالوا» يعرض شهادتين مكتوبتين في الكود، ولا سبيل إلى ملئه
 * تلقائياً إلا باختراع ثناءٍ من قرّاء لا وجود لهم — وذلك يضع في أفواه الناس
 * قولاً لم يقولوه، ويُقدَّم للزائر دليلاً على قيمةٍ يُفترض أن يحكم عليها بنفسه.
 *
 * فبدل الثناء المصنوع: جملةُ الدكتور نفسها، منقولةً حرفاً بحرف من متن مقالها،
 * منسوبةً إليه بعنوانها وتاريخها ورابطها. ومن ١٦٤ متناً × جُملٍ في كل متن
 * يخرج تنويعٌ لا ينفد، ويتجدّد وحده مع كل مقالٍ جديد — بلا نموذج لغويّ.
 *
 * وقاعدة واحدة تحكم هذا الملف: لا يخرج منه حرفٌ ليس في المتن. كل مُرجَعٍ يمرّ
 * على `verifyEcho` قبل العرض، فإن لم يوجد في متنه حرفاً بحرف سقط ولم يُعرض.
 */

export type EchoArticle = { slug: string; title: string; iso?: string; date?: string }

export type VoiceEcho = {
  quote: string
  slug: string
  title: string
  iso: string
}

/* الجملة المعروضة: مكتملة، لا قصيرةً فتفقد المعنى ولا طويلةً فتُثقل البطاقة.
   والحدّان مقيسان على متون الدكتور لا مخمَّنان: أقصر جملةٍ دالّة عنده نحو ٦٠
   حرفاً، وما تجاوز ٢٢٠ يصير فقرةً لا اقتباساً. */
const MIN_LENGTH = 60
const MAX_LENGTH = 220

/* «…» فاصلٌ للجُمَل عند الدكتور كالنقطة تماماً — بعض متونه تستعملها عشرات
   المرات وفيها نقطةٌ واحدة. ولو لم نكسر عندها لصار المتن جملةً واحدة تتجاوز
   الحدّ فتسقط كلّها، فلا يُقتبس من ذلك المقال شيءٌ أبداً. */
export function splitBodySentences(body: string): string[] {
  return String(body || '')
    .split(/(?<=[.!؟…])\s+|\n+/)
    .map((sentence) => sentence.replace(/^[\s«»"'—–-]+/, '').replace(/[\s«»"']+$/, '').trim())
    .filter((sentence) => sentence.length >= MIN_LENGTH && sentence.length <= MAX_LENGTH)
}

/* ما يصلح صدىً: جملةٌ تحمل فكرةً تامّة لا إحالةً ولا سؤالاً معلّقاً على ما قبله.
   نُرجّح بالكثافة: الجملة المتوسطة الطول أوقعُ من الطرفين، ووجودُ فعلٍ حاكمٍ
   («لا يصنع»، «يصبح»، «تتحوّل») علامةُ فكرةٍ لا وصفٍ عابر. */
const JUDGEMENT = /(?:^|\s)(?:لا\s|ليس|إنما|بل\s|حين|حتى|لأن|قبل أن|لكن)/
const REFERENCES_BEFORE = /^(?:و?هذا|و?هذه|و?ذلك|و?تلك|و?هنا|و?هناك|و?لذلك|و?لهذا|و?ثم|أما)\b/

function scoreSentence(sentence: string): number {
  const balance = 1 - Math.abs(sentence.length - 130) / 200
  const judgement = JUDGEMENT.test(sentence) ? 0.35 : 0
  const dangling = REFERENCES_BEFORE.test(sentence) ? -0.6 : 0
  const question = /[؟]/.test(sentence) ? -0.15 : 0
  return balance + judgement + dangling + question
}

/** أقوى جملةٍ في متنٍ واحد — أو لا شيء إن لم يصلح فيه شيء */
export function bestEcho(body: string, title: string): string {
  const titleKey = title.trim()
  let best: { text: string; score: number } | null = null
  for (const sentence of splitBodySentences(body)) {
    if (sentence === titleKey) continue
    const score = scoreSentence(sentence)
    if (!best || score > best.score) best = { text: sentence, score }
  }
  return best?.text || ''
}

/**
 * البوّابة: لا يُنسب إلى الدكتور إلا ما وُجد في متنه حرفاً بحرف.
 * وهي الشرط نفسه الذي يحكم بوت واتساب — فما لا يجتازه لا يُعرض.
 */
export const verifyEcho = (quote: string, body: string) => Boolean(quote) && String(body || '').includes(quote)

/* بأمر الدكتور (٢٠٢٦-٠٧-٢٣): الأصداء تتجدد مع كل تحديث صفحة — قرعةٌ لكل
   زيارة، لا نبضة أيام. الثبات داخل الزيارة الواحدة يبقى (تُحسب مرة عند الفتح). */
export const echoPulse = () => Math.floor(Math.random() * 1_000_003)

/**
 * أصداء مرتّبةً بالأحدث، مصفّاةً بالبوّابة، مدوَّرةً بالنبضة.
 * تُرجع ما وُجد فقط — ولا تُكمل العدد باختراع.
 */
export function pickEchoes(
  articles: EchoArticle[],
  bodies: Record<string, string>,
  count = 2,
  pulse = echoPulse(),
): VoiceEcho[] {
  const pool: VoiceEcho[] = []
  for (const article of articles) {
    const body = bodies[article.slug]
    if (!body) continue
    const quote = bestEcho(body, article.title)
    if (!verifyEcho(quote, body)) continue
    pool.push({ quote, slug: article.slug, title: article.title, iso: article.iso || article.date || '' })
  }
  if (!pool.length) return []
  const start = pulse % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, count)
}
