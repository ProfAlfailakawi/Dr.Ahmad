/**
 * طبقة النطق الكويتي — تخصّ الأذن وحدها.
 *
 * النصّ يصل Gemini بإملائه المكتوب، فيخمّن النموذج حركات كلمةٍ مثل «ورقة»
 * ويقع أحياناً على الإماراتية أو على خليجيٍّ عامٍّ لا ينتمي لبلد. الحلّ ليس
 * تغيير ما يقرأه الزائر — بل أن يُكتب للنموذج ما يُنطق: «ورگة».
 *
 * قاعدتان صارمتان:
 *  ١ ــ الاستبدال يقع على **مدخل الصوت فقط**. متن الحوار المعروض في الموقع
 *       وفي النص المتزامن يبقى كما كتبه الدكتور حرفاً بحرف.
 *  ٢ ــ الكلمة تُستبدل كاملةً لا جزءاً منها. حدّ الكلمة في العربية ليس ‎\b‎
 *       (وهي مبنيّة على ASCII فلا ترى الحرف العربي أصلاً) — ولهذا يُحسب الحدّ
 *       هنا بحروف العربية نفسها. بلا هذا يمسخ الاستبدالُ «ورقة» داخل «الورقة»
 *       فيخرج «الورگة» مرّةً و«الورقة» مرّة، وهي علّة مسخٍ سابقة لا تُعاد.
 */

const ARABIC_LETTER = '\\u0621-\\u063A\\u0641-\\u064A\\u0660-\\u0669\\u066E-\\u06D3\\u0671-\\u06D5'
const TASHKEEL = /[ً-ْٰ]/g

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** حرفٌ عربيٌّ ملاصق يعني أننا داخل كلمةٍ أخرى، فلا يقع الاستبدال. */
const wordPattern = (word) => new RegExp(
  `(^|[^${ARABIC_LETTER}])(${escapeRegExp(word)})(?![${ARABIC_LETTER}])`,
  'gu',
)

export function buildPronunciationMap(source) {
  const words = source?.words && typeof source.words === 'object' ? source.words : {}
  /* الأطول أولاً: «الأوراق» قبل «ورق» وإلا التهم القصيرُ جزءاً من الطويل. */
  return Object.entries(words)
    .filter(([from, to]) => from && to && from !== to)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => ({ from, to, pattern: wordPattern(from) }))
}

export function toSpokenKuwaiti(text, entries) {
  let spoken = String(text ?? '')
  for (const entry of entries) {
    entry.pattern.lastIndex = 0
    spoken = spoken.replace(entry.pattern, (_match, before, word) => `${before}${entry.to}${word.slice(word.length)}`)
  }
  return spoken
}

/** يُستعمل في الفحص: أي كلمةٍ في المعجم ما زالت في النصّ المنطوق؟ */
export function remainingWrittenForms(text, entries) {
  return entries
    .filter((entry) => { entry.pattern.lastIndex = 0; return entry.pattern.test(String(text ?? '')) })
    .map((entry) => entry.from)
}

export function stripTashkeel(text) {
  return String(text ?? '').replace(TASHKEEL, '')
}
