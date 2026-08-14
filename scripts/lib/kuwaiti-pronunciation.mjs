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

/* حذف الأسماء اللاتينية من مدخل الصوت.
 *
 * العلّة (رصدها الدكتور بأذنه): الحرف اللاتينيّ وسط الجملة الكويتية يجبر المحرّك
 * على القفز إلى النطق الإنجليزي، فيتبدّل صوت المتحدّث عند اسم المجلة أو المنظمة
 * («Frontiers in Psychology» سمعها الدكتور «فلنتير» وتغيّر الصوت). الحلّ حذفُ
 * الاسم من الصوت واستبداله بعربيةٍ عامّة دالّة — بأمر الدكتور «خله في دراسة بدون
 * ما يقول اسم الدراسة». يقع على الصوت وحده؛ النص المعروض للقارئ يبقى بالأسماء
 * كاملةً. الخريطة المعتمدة أولاً، ثم أيّ بقيّةٍ لاتينية → بديلٌ عامّ آمن (الحرف
 * اللاتينيّ لا يوجد في العربية، فالقاعدة العامّة هنا آمنة ولا تمسخ عربياً). */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9&.'’\-، ]*[A-Za-z0-9]|[A-Za-z]/g

export function buildForeignRedactions(source) {
  const names = source?.foreignNames && typeof source.foreignNames === 'object' ? source.foreignNames : {}
  return Object.entries(names)
    .filter(([from]) => from)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => ({ from, to, pattern: new RegExp(escapeRegExp(from), 'gu') }))
}

export function redactForeignNames(text, redactions = [], fallback = 'مصدر علمي') {
  let out = String(text ?? '')
  for (const r of redactions) { r.pattern.lastIndex = 0; out = out.replace(r.pattern, r.to) }
  out = out.replace(LATIN_RUN, fallback)
  return out.replace(/ {2,}/g, ' ').replace(/ ([،.؟!])/g, '$1').trim()
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
