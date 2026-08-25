/* بوابة موحدة للعينة/نطاق الدراسة.
   القيم الإحصائية مثل «بلغ المتوسط (2.96)» ليست عينة، حتى لو بدأت بالفعل
   «بلغ» ورقم. المستخرج القديم كان يلتقطها ثم يقطعها عند النقطة العشرية. */

const clean = (value = '') => String(value ?? '').replace(/\s+/g, ' ').trim()
const hasArabic = (value = '') => /[\u0600-\u06ff]/u.test(value)
const hasNumber = (value = '') => /[0-9٠-٩]/u.test(value)
const hasBalanced = (value, open, close) =>
  [...value].reduce((balance, character) => balance + (character === open ? 1 : character === close ? -1 : 0), 0) === 0

/* يشمل العينات البشرية ونطاقات تحليل الوثائق/المؤسسات، من دون قبول عبارة
   إحصائية قصيرة لمجرد أنها تحتوي رقماً وكلمة عربية. */
const scopeCue = /(?:عينة|المشارك(?:ون|ات|ين)?|أفراد?\s+الدراسة|طالب(?:اً|ا|ة|ات|ين)?|أعضاء?\s+هيئة|أستاذ(?:اً|ا|ة|ات)?|معلّم(?:اً|ا|ة|ات|ين)?|معلم(?:اً|ا|ة|ات|ين)?|مدرسة|جامعة|مؤسسة|دولة|وثيق(?:ة|تان|ات)|مقرر(?:اً|ا|ات)?|حالات?)/u
const explicitSampleCue = /(?:عينة(?:\s+(?:الدراسة|البحث))?|المشارك(?:ون|ات|ين)?|أفراد?\s+(?:العينة|الدراسة))/u
const statisticOnly = /^(?:و?\s*)?(?:إذ\s+)?(?:بلغ|بلغت|تراوح|تراوحت)\s+(?:المتوسط(?:\s+الحسابي)?|النسبة|الدرجة|القيمة)?\s*\(?\s*[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?\s*\)?\s*(?:%|٪)?$/u

export function isPlausibleResearchSample(value, { requireNumber = false } = {}) {
  const candidate = clean(value).replace(/[.؟]+$/, '').trim()
  if (candidate.length < 18 || !hasArabic(candidate) || !scopeCue.test(candidate)) return false
  if (requireNumber && !hasNumber(candidate)) return false
  if (!hasBalanced(candidate, '(', ')') || !hasBalanced(candidate, '[', ']')) return false
  if (statisticOnly.test(candidate)) return false
  if (/^(?:بلغ|بلغت)\s*\(?\s*[0-9٠-٩]+(?:[.,٫][0-9٠-٩]+)?\s*\)?(?:\s*(?:%|٪))?$/u.test(candidate)) return false
  return true
}

export function cleanResearchSample(value, options = {}) {
  const candidate = clean(value).replace(/[.؟]+$/, '').trim()
  return isPlausibleResearchSample(candidate, options) ? candidate : ''
}

export function splitResearchSentences(value = '') {
  /* لا نفصل عند النقطة العشرية: الفصل لا يحدث إلا بعد نقطة يتبعها فراغ،
     ولذلك يبقى 2.96 عدداً واحداً ولا يتحول إلى شظيتين. */
  return clean(value)
    .split(/(?:[؟!]\s*|\.\s+(?=[\p{L}\p{N}]))/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

export function inferResearchSample(value = '') {
  const candidates = splitResearchSentences(value)
    .filter((sentence) => explicitSampleCue.test(sentence) && hasNumber(sentence))
    .map((sentence, index) => ({
      sentence: cleanResearchSample(sentence, { requireNumber: true }),
      index,
      score: /عينة\s+(?:الدراسة|البحث)/u.test(sentence) ? 3 : /عينة/u.test(sentence) ? 2 : 1,
    }))
    .filter((candidate) => candidate.sentence)
    .sort((left, right) => right.score - left.score || left.index - right.index)
  return candidates[0]?.sentence || ''
}
