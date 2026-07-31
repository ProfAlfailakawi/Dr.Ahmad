/**
 * «كيف تغيّر رأيي» — يعثر على المواضع التي تطوّر فيها موقف الدكتور بين مقالين
 * من سنتين مختلفتين، ولا يعرض شيئاً بلا دليل.
 *
 * المبدأ الحاكم (أمر الدكتور بالحرف): «المقارنة تُبنى من مقالاتي المنشورة حصراً —
 * لا اختراع ولا استنتاج من خارج الأرشيف. إن لم يجد دليلاً واضحاً فلا يعرض شيئاً.»
 * لذلك كل ما يُعرض هنا مقتطفٌ حرفيّ من متن منشور، ولا تُبنى جملة الوصف إلا من
 * مفهومٍ ظاهرٍ في المقالين معاً. لا نموذج لغوي ولا خدمة خارجية — قراءةٌ محلية.
 *
 * يعيد استعمال `ideaWords` من [[idea-life]] (المصدر الواحد لتطبيع الكلمات) بدل
 * تكرار مطبّعٍ ثانٍ للعربية.
 */
import type { ArticleRecord } from './cms'
import { ideaWords } from './idea-life'

/** ألفاظ التحفّظ والقيد: موقفٌ يقف عند حدّ. */
const RESERVE = [
  'لا يمكن', 'لا يستطيع', 'لا يغني', 'لن يحل', 'لن يستطيع', 'ليس بديلا', 'ليس بديلاً',
  'يصعب', 'مبكر', 'من المبكر', 'أشك', 'اشك', 'مجرد', 'قاصر', 'محدود', 'خطر', 'تهديد',
  'لا أرى', 'لا ارى', 'مستحيل', 'لا يصح', 'أتحفظ', 'اتحفظ',
]

/** ألفاظ التحوّل والإقرار: موقفٌ راجع نفسه. */
const SHIFT = [
  'أصبح', 'اصبح', 'صار', 'صارت', 'بات', 'باتت', 'لم يعد', 'لم تعد', 'تغير', 'تغيّر',
  'أدركت', 'ادركت', 'تبين', 'تبيّن', 'اليوم', 'صرنا', 'أصبحنا', 'اصبحنا', 'نضج',
  'أعدت النظر', 'اعدت النظر', 'راجعت',
]

export type IdeaRevisionSide = {
  slug: string
  title: string
  year: string
  /** مقتطفٌ حرفيّ من المقال المنشور — لا إعادة صياغة. */
  excerpt: string
}

export type IdeaRevision = {
  /** المفهوم المشترك الذي تطوّر الموقف حوله. */
  concept: string
  /** سطرٌ واحد يصف ما تغيّر. */
  line: string
  older: IdeaRevisionSide
  newer: IdeaRevisionSide
}

const clean = (value: string) => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const sentencesOf = (value: string) => clean(value)
  .split(/(?<=[.؟!؛])\s+|\n+/)
  .map((item) => item.trim())
  .filter((item) => item.length >= 25 && item.length <= 260)

const textOf = (article: ArticleRecord) => clean(`${article.body || ''} ${article.excerpt || ''}`)

const hasAny = (sentence: string, markers: readonly string[]) => markers.some((marker) => sentence.includes(marker))

/** أطول كلمة معنى مشتركة بين جملتين — هي «موضع» الرأي لا كلمةٌ عابرة. */
const sharedConcept = (left: string, right: string) => {
  const rightWords = new Set(ideaWords(right))
  return ideaWords(left)
    .filter((word) => word.length >= 4 && rightWords.has(word))
    .sort((a, b) => b.length - a.length)[0] || ''
}

const yearOf = (article: ArticleRecord) => String(article.iso || '').slice(0, 4)

/**
 * يُخرج المواضع المدعومة بدليلٍ فقط. مصفوفةٌ فارغة = لا تُعرض واجهةٌ إطلاقاً.
 */
export function findIdeaRevisions(article: ArticleRecord, articles: readonly ArticleRecord[], limit = 3): IdeaRevision[] {
  const year = yearOf(article)
  if (!year) return []
  const mine = new Set(ideaWords(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`))
  if (mine.size < 3) return []
  const own = sentencesOf(textOf(article))
  if (!own.length) return []

  const found: IdeaRevision[] = []
  const usedConcepts = new Set<string>()

  const related = articles
    .filter((item) => item.slug !== article.slug && !item.missing && yearOf(item) && yearOf(item) !== year)
    .map((item) => ({
      item,
      overlap: ideaWords(`${item.title} ${item.excerpt || ''} ${item.cat || ''}`).filter((word) => mine.has(word)).length,
    }))
    .filter((entry) => entry.overlap >= 2)
    .sort((left, right) => right.overlap - left.overlap)
    .slice(0, 12)

  for (const { item } of related) {
    const olderFirst = yearOf(item) < year
    const olderArticle = olderFirst ? item : article
    const newerArticle = olderFirst ? article : item
    const olderSentences = olderFirst ? sentencesOf(textOf(item)) : own
    const newerSentences = olderFirst ? own : sentencesOf(textOf(item))

    const reserve = olderSentences.find((sentence) => hasAny(sentence, RESERVE))
    if (!reserve) continue
    const shift = newerSentences.find((sentence) => hasAny(sentence, SHIFT) && sharedConcept(reserve, sentence))
    if (!shift) continue
    const concept = sharedConcept(reserve, shift)
    if (!concept || usedConcepts.has(concept)) continue
    usedConcepts.add(concept)

    const span = Number(yearOf(newerArticle)) - Number(yearOf(olderArticle))
    found.push({
      concept,
      line: `كنتُ أقف عند ${concept} بتحفّظٍ، ثم رأيتُ بعد ${span === 1 ? 'سنة' : `${span} سنوات`} أنّ الأمر تغيّر.`,
      older: { slug: olderArticle.slug, title: olderArticle.title, year: yearOf(olderArticle), excerpt: reserve },
      newer: { slug: newerArticle.slug, title: newerArticle.title, year: yearOf(newerArticle), excerpt: shift },
    })
    if (found.length >= limit) break
  }

  return found
}
