/* ═══ متى يكون تحديدان اقتباساً واحداً؟ ═══
 *
 * الرقم على الجملة رقمٌ واحد للعالم كله: من ظلّلها كاملةً ومن ظلّل أكثرها ومن
 * زاد عليها قليلاً — كلّهم يرفعون العدّاد نفسه، ولا يفتح أحدهم عدّاداً موازياً
 * بقيمة ١ يتيمة.
 *
 * كان هذا القرار مكتوباً داخل دالةٍ تقرأ Firestore، فلا يمكن التحقّق منه إلا
 * بتشغيل الموقع. هنا يصير قراراً خالصاً يُختبر بالأرقام: النسبة المسموحة ±٤٠٪
 * من طول التحديد القائم، مع تقاطعٍ حقيقيٍّ أو تشارك كلمات.
 *
 * السلوك نفسه لم يتغيّر — نُقل موضعه ليصير قابلاً للاختبار.
 */

export const MERGE_LENGTH_TOLERANCE = 0.40

export function intervalOverlapRatio(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  const shortest = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart))
  return overlap / shortest
}

export type MergeVerdict = {
  spans: number
  words: number
  lenDiffRatio: number
  withinTolerance: boolean
  merges: boolean
}

/**
 * @param wordsRatio نسبة الكلمات المشتركة بين النصّين (تُحسب في القارئ بتطبيعه)
 */
export function highlightMergeVerdict({
  userStart,
  userEnd,
  existingStart,
  existingEnd,
  wordsRatio = 0,
}: {
  userStart: number
  userEnd: number
  existingStart: number
  existingEnd: number
  wordsRatio?: number
}): MergeVerdict {
  const spans = intervalOverlapRatio(userStart, userEnd, existingStart, existingEnd)
  const lenUser = Math.max(1, userEnd - userStart)
  const lenExisting = Math.max(1, existingEnd - existingStart)
  const lenDiffRatio = Math.abs(lenUser - lenExisting) / lenExisting
  const hasIntersection = Math.max(userStart, existingStart) < Math.min(userEnd, existingEnd)
  const withinTolerance = lenDiffRatio <= MERGE_LENGTH_TOLERANCE
    && (spans > 0.15 || wordsRatio > 0.20 || hasIntersection)
  /* ما تجاوز ±٤٠٪ لا يُجمع تلقائياً إلا إذا أثبت أنه الاقتباس نفسه بتقاطعٍ
     واسعٍ ومفرداتٍ مشتركة — وهذا هو الشرط الاحتياطي القديم كما هو. */
  const merges = withinTolerance || (spans >= 0.35 && wordsRatio >= 0.40)
  return { spans, words: wordsRatio, lenDiffRatio, withinTolerance, merges }
}
