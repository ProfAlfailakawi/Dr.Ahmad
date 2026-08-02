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
import curatedRevisions from '../data/idea-revisions.json'
import { ideaWords } from './idea-life'
import { arabicCountPhrase, YEAR_AFTER_PREPOSITION_FORMS } from './arabic-count.ts'

/**
 * المواضع التي أقرّها الدكتور بنفسه. الكشف الآلي لا يستطيع الحكم على تغيّر
 * الرأي — جرّبناه على الأرشيف كاملاً فأخرج مطابقاتٍ زائفة (مفاهيم كـ«نفسها»،
 * وجملةٌ واحدة تُطابق ستة مقالات). والحكم هنا حكمُ الدكتور: هو يسمّي المقالين،
 * والنظام يتحقق أن المقتطفين **موجودان حرفياً** في متنيهما فلا ينحرف شيء.
 */
type CuratedRevision = {
  olderSlug: string
  newerSlug: string
  concept: string
  line: string
  olderExcerpt: string
  newerExcerpt: string
}

/** ألفاظ التحفّظ والقيد: موقفٌ يقف عند حدّ. */
const RESERVE = [
  'لا يمكن', 'لا يستطيع', 'لا يغني', 'لن يحل', 'لن يستطيع', 'ليس بديلا', 'ليس بديلاً',
  'يصعب', 'مبكر', 'من المبكر', 'أشك', 'اشك', 'مجرد', 'قاصر', 'محدود', 'خطر', 'تهديد',
  'لا أرى', 'لا ارى', 'مستحيل', 'لا يصح', 'أتحفظ', 'اتحفظ',
]

/** **مراجعةٌ صريحة بضمير المتكلم** — لا وصفٌ لتغيّر العالم.
    هذا هو الدليل الوحيد الذي لا يكذب: أن يقول الدكتور بنفسه إنه كان يرى شيئاً
    ثم صار يرى غيره. الألفاظ العامة («أصبح/صار/اليوم») وُضعت أولاً فأخرجت
    مطابقاتٍ زائفة على الأرشيف الحقيقي (١٩ مقالاً، جملةٌ واحدة تُطابق ستةً منها)
    لأنها تصف تغيّر الواقع لا تغيّر الرأي. */
const SHIFT = [
  'كنت أظن', 'كنت اظن', 'كنت أعتقد', 'كنت اعتقد', 'كنت أرى', 'كنت ارى',
  'كنت أحسب', 'كنت احسب', 'ظننت أن', 'ظننت ان', 'حسبت أن', 'حسبت ان',
  'أعدت النظر', 'اعدت النظر', 'راجعت رأيي', 'راجعت رايي', 'غيرت رأيي', 'غيرت رايي',
  'تبين لي', 'تبيّن لي', 'أدركت لاحقا', 'ادركت لاحقا', 'اكتشفت أني', 'اكتشفت اني',
  'كنت مخطئا', 'كنت مخطئ', 'لم أعد أرى', 'لم اعد ارى', 'صرت أرى', 'صرت ارى',
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
const sharedConcept = (left: string, right: string, topical: Set<string>) => {
  const rightWords = new Set(ideaWords(right))
  const shared = ideaWords(left)
    .filter((word) => word.length >= 4 && rightWords.has(word) && !CONCEPT_STOPWORDS.has(word))
  /* **شرط الموضوعية**: المفهوم يجب أن يكون من عنوان أحد المقالين — وإلا فهو
     كلمةٌ عابرة في المتن لا «موضعُ رأي». هذا وحده أسقط جملاً مغناطيسية كانت
     تُطابق ستة مقالاتٍ بنصّها. */
  return shared.filter((word) => topical.has(word)).sort((a, b) => b.length - a.length)[0] || ''
}

const yearOf = (article: ArticleRecord) => String(article.iso || '').slice(0, 4)

/* كلماتٌ تعبر كل نصٍّ فلا تصلح «موضعَ رأي»: ضمائر وظروف زمن وكمّيات.
   بلا هذا المنع كان الكاشف يخرج بـ«كنتُ أقف عند **نفسها** بتحفّظٍ» — كلام
   آلةٍ لا كلام الدكتور (فحص الأرشيف الحقيقي ٣١ يوليو: ١٩ مقالاً أغلبها زائف). */
const CONCEPT_STOPWORDS = new Set([
  'نفسها', 'نفسه', 'نفس', 'اليوم', 'امس', 'غدا', 'الان', 'قديما', 'حديثا', 'سابقا', 'لاحقا',
  'عشرات', 'مئات', 'الاف', 'بعض', 'كثير', 'قليل', 'جميع', 'كل', 'مجرد', 'ايضا', 'حينها',
  'هناك', 'هنا', 'ذلك', 'هذا', 'هذه', 'التي', 'الذي', 'الذين', 'حيث', 'عندما', 'حين',
  'شيء', 'امر', 'اشياء', 'امور', 'حال', 'حالة', 'وقت', 'زمن', 'سنة', 'سنوات', 'يوم', 'ايام',
])

/** المسافة بين المفهوم وعلامة الموقف: الجملة يجب أن تكون **عن** المفهوم. */
const markerNearConcept = (sentence: string, concept: string, markers: readonly string[]) => {
  const at = sentence.indexOf(concept)
  if (at < 0) return false
  return markers.some((marker) => {
    const m = sentence.indexOf(marker)
    return m >= 0 && Math.abs(m - at) <= 60
  })
}

/**
 * يُخرج المواضع المدعومة بدليلٍ فقط. مصفوفةٌ فارغة = لا تُعرض واجهةٌ إطلاقاً.
 */
/** المواضع المقرّة التي تخصّ هذا المقال — بعد التحقق من وجود المقتطفين حرفياً. */
const curatedFor = (article: ArticleRecord, articles: readonly ArticleRecord[]): IdeaRevision[] => {
  const rows = curatedRevisions as CuratedRevision[]
  if (!Array.isArray(rows) || !rows.length) return []
  const bySlug = new Map(articles.map((item) => [item.slug, item]))
  const results: IdeaRevision[] = []
  for (const row of rows) {
    if (row.olderSlug !== article.slug && row.newerSlug !== article.slug) continue
    const older = bySlug.get(row.olderSlug)
    const newer = bySlug.get(row.newerSlug)
    if (!older || !newer) continue
    /* صمّام الانحراف: المقتطف يجب أن يكون موجوداً في المتن المنشور اليوم.
       إن حُرّر المقال فتغيّرت الجملة، يسقط الموضع بصمتٍ بدل أن يُنسب للدكتور
       كلامٌ لم يعد في مقاله. */
    const inBody = (item: ArticleRecord, excerpt: string) => clean(`${item.body || ''} ${item.excerpt || ''}`).includes(clean(excerpt))
    if (!inBody(older, row.olderExcerpt) || !inBody(newer, row.newerExcerpt)) continue
    results.push({
      concept: row.concept,
      line: row.line,
      older: { slug: older.slug, title: older.title, year: yearOf(older), excerpt: clean(row.olderExcerpt) },
      newer: { slug: newer.slug, title: newer.title, year: yearOf(newer), excerpt: clean(row.newerExcerpt) },
    })
  }
  return results
}

export function findIdeaRevisions(article: ArticleRecord, articles: readonly ArticleRecord[], limit = 3): IdeaRevision[] {
  /* المقرّ من الدكتور يتقدّم دائماً على الكشف الآلي. */
  const curated = curatedFor(article, articles)
  if (curated.length) return curated.slice(0, limit)
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

    /* المفاهيم الموضوعية = كلمات عنواني المقالين. المفهوم لا يُقبل إلا منها. */
    const topical = new Set([...ideaWords(olderArticle.title), ...ideaWords(newerArticle.title)]
      .filter((word) => word.length >= 4 && !CONCEPT_STOPWORDS.has(word)))
    if (!topical.size) continue

    /* **المرساة هي تصريح الدكتور نفسه**، لا علامةٌ في المقال القديم.
       الاشتراط السابق (تحفّظٌ صريح في القديم أيضاً) كان يُسقط كل شيء: القديم
       شاهدٌ على ما كتبه وقتها فحسب، ومن يشهد على تغيّر الرأي هو الجملة التي
       يقول فيها بنفسه «كنت أظن…». فنبدأ منها ثم نبحث عن شاهدها في الأقدم. */
    let reserve = ''
    let shift = ''
    let concept = ''
    for (const candidate of newerSentences) {
      if (!hasAny(candidate, SHIFT)) continue
      const word = ideaWords(candidate)
        .filter((item) => item.length >= 4 && topical.has(item) && !CONCEPT_STOPWORDS.has(item))
        .sort((a, b) => b.length - a.length)[0]
      /* الجملة يجب أن تكون **عن** المفهوم لا تذكره عرضاً. */
      if (!word || usedConcepts.has(word) || !markerNearConcept(candidate, word, SHIFT)) continue
      /* شاهد الأقدم: أطول جملةٍ تتحدث عن المفهوم نفسه — نصٌّ حقيقي بلا تأويل. */
      const witness = olderSentences
        .filter((sentence) => sentence.includes(word))
        .sort((a, b) => b.length - a.length)[0]
      if (!witness) continue
      reserve = witness
      shift = candidate
      concept = word
      break
    }
    if (!concept) continue
    usedConcepts.add(concept)

    const span = Number(yearOf(newerArticle)) - Number(yearOf(olderArticle))
    found.push({
      concept,
      line: `كتبتُ عن ${concept} سنة ${yearOf(olderArticle)}، ثم راجعتُ رأيي بعد ${arabicCountPhrase(span, YEAR_AFTER_PREPOSITION_FORMS)} وقلتُ ذلك بنفسي.`,
      older: { slug: olderArticle.slug, title: olderArticle.title, year: yearOf(olderArticle), excerpt: reserve },
      newer: { slug: newerArticle.slug, title: newerArticle.title, year: yearOf(newerArticle), excerpt: shift },
    })
    if (found.length >= limit) break
  }

  return found
}
