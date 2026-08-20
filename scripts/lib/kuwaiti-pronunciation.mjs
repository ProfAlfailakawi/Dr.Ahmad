/**
 * طبقة النطق الكويتي — تخصّ الأذن وحدها.
 *
 * النصّ يصل Gemini بإملائه المكتوب، فيخمّن النموذج حركات كلمةٍ مثل «ورقة»
 * ويقع أحياناً على الإماراتية أو على خليجيٍّ عامٍّ لا ينتمي لبلد. الحلّ ليس
 * تغيير ما يقرأه الزائر — بل أن يُكتب للنموذج ما يُنطق.
 *
 * قواعد صارمة:
 *  ١ ــ الاستبدال يقع على **مدخل الصوت فقط**. متن الحوار المعروض في الموقع
 *       وفي النص المتزامن يبقى كما كتبه الدكتور حرفاً بحرف.
 *  ٢ ــ الكلمة تُستبدل كاملةً لا جزءاً منها. حدّ الكلمة في العربية ليس ‎\b‎
 *       (وهي مبنيّة على ASCII فلا ترى الحرف العربي أصلاً) — ولهذا يُحسب الحدّ
 *       هنا بحروف العربية نفسها. بلا هذا يمسخ الاستبدالُ «ورقة» داخل «الورقة»
 *       فيخرج «الورگة» مرّةً و«الورقة» مرّة، وهي علّة مسخٍ سابقة لا تُعاد.
 *  ٣ ــ **السوابق المتّصلة تُقتنص ولا تُكسر** (إصلاح ١٤ أغسطس ٢٠٢٦). قاعدة الحدّ
 *       في النسخة السابقة كانت تشترط محرفاً غير عربيٍّ قبل الكلمة، فـ«الورقة»
 *       لا تُطابَق أبداً لأن «ل» حرفٌ عربي — فتمرّ بإملائها إلى النموذج فيخمّنها
 *       إماراتية. هذي علّة سمعها الدكتور بأذنه في «الورقة» و«سبق».
 *       العلاج: سابقةٌ من مجموعةٍ مغلقة تُلتقط وتُعاد كما هي أمام النطق المستبدل.
 *       والمجموعة مغلقة عمداً: أداة التعريف وأخواتها آمنة لأن «ال» لا تلتبس،
 *       أمّا «و/ف» المفردتان فتُمنعان عن الجذوع القصيرة لئلا يصير «لجم» → «لچم».
 */

const ARABIC_LETTER = '\\u0621-\\u063A\\u0641-\\u064A\\u0660-\\u0669\\u066E-\\u06D3\\u0671-\\u06D5'
const TASHKEEL = /[ً-ْٰ]/g

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* أداة التعريف وما يسبقها من حروف — لا تلتبس بجذعٍ عربيٍّ آخر، فتُسمح من طول ٣. */
const ARTICLE_PROCLITICS = ['وبال', 'وكال', 'فبال', 'بال', 'كال', 'وال', 'فال', 'ولل', 'فلل', 'لل', 'ال']
/* الحروف المفردة — تلتصق بجذوعٍ حقيقية أخرى، فتُمنع عن القصير.
 * «ب» و«ك» مستبعدتان عمداً: «ب» أداةُ استقبالٍ في الخليجية تسبق الفعل
 * («بيعرف» = سوف يعرف)، فلو سُمحت لأُقحمت ألفُ الوصل داخلها («بايعرف») وهو مسخ.
 * الفوات أهون من المسخ — فلا تُفتحان إلا بسماعٍ يثبتهما. */
const BARE_PROCLITICS = ['و', 'ف']
const ARTICLE_MIN = 3
/* كان ٤ فيفوت «وبان» و«وأخذ» و«وأنت» — كلها ثلاثة أحرف. وشكا الدكتور من
 * «بان» ثلاث مرات وهي في المعجم، لأن موضعها في المتن «وبان» فلم تصلها الطبقة.
 * خُفض إلى ٣ في ٢٠ أغسطس ٢٠٢٦ بعد فحص الأثر على المتون الـ١٤٤ كلها: ستة
 * مواضع تتغيّر لا غير (وأنت · فأنت · وأخذ ×٢ · وبان ×٢)، وكلها صحيحة.
 * **شرطٌ على من يضيف مدخلةً من ثلاثة أحرف بعد اليوم**: افحص «و+الكلمة»
 * و«ف+الكلمة» في المتون أولاً — قد تكون كلمةً أخرى قائمةً بذاتها. */
const BARE_MIN = 3

function procliticsFor(word, allowed) {
  if (allowed === false) return []
  const list = []
  if (word.length >= ARTICLE_MIN) list.push(...ARTICLE_PROCLITICS)
  if (word.length >= BARE_MIN) list.push(...BARE_PROCLITICS)
  /* الأطول أولاً داخل البديل حتى تلتقط «وبال» قبل «و». */
  return list.sort((a, b) => b.length - a.length)
}

/**
 * حرفٌ عربيٌّ ملاصق يعني أننا داخل كلمةٍ أخرى، فلا يقع الاستبدال —
 * إلّا أن يكون الملاصقُ سابقةً معروفة، فتُقتنص في مجموعةٍ مستقلّة وتُعاد كما هي.
 */
const wordPattern = (word, allowProclitics) => {
  const pro = procliticsFor(word, allowProclitics)
  const head = pro.length ? `(?:${pro.map(escapeRegExp).join('|')})?` : ''
  return new RegExp(
    `(^|[^${ARABIC_LETTER}])(${head})(${escapeRegExp(word)})(?![${ARABIC_LETTER}])`,
    'gu',
  )
}

export function buildPronunciationMap(source) {
  const words = source?.words && typeof source.words === 'object' ? source.words : {}
  /* الجذوع الممنوعة من السوابق — تُعلن بالبيانات لا بالكود. */
  const blocked = new Set(Array.isArray(source?.noProclitic) ? source.noProclitic : [])
  /* الأطول أولاً: «الأوراق» قبل «ورق» وإلا التهم القصيرُ جزءاً من الطويل. */
  return Object.entries(words)
    .filter(([from, to]) => from && to && from !== to)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => ({
      from,
      to,
      pattern: wordPattern(from, !blocked.has(from)),
    }))
}

/* ═══ الضاد ظاءٌ في الكويتية ═══
 * قاعدةٌ صوتيةٌ شاملةٌ لا معجميّة، أملاها الدكتور (١٥ أغسطس ٢٠٢٦): «كل ضاد
 * ظاد». وهي حقيقةٌ لهجيةٌ راسخة: الضاد والظاء اندمجتا في الخليجية إلى صوتٍ
 * واحدٍ مُطبَقٍ مجهور، فكتابةُ الضاد تدفع المحرّك إلى ضادٍ فصيحةٍ لا يقولها
 * كويتيٌّ قط — وهي أظهر ما يُضعف اللكنة. المتن كله فيه ١٣٠٢ موضعاً موزّعةً
 * على الحلقات الـ١٤٤ جميعاً، فالمكسب أكبر من أيّ مدخلٍ معجميٍّ مفرد.
 * تقع على مدخل الصوت وحده؛ ما يقرؤه الزائر يبقى بالضاد كما كتبه.
 * تُطبَّق بعد المعجم كي تشمل ما استبدله أيضاً. */
export function daadToDhaa(text) {
  return String(text ?? '').replace(/ض/g, 'ظ')
}

export function toSpokenKuwaiti(text, entries) {
  let spoken = String(text ?? '')
  for (const entry of entries) {
    entry.pattern.lastIndex = 0
    /* السابقة تُعاد حرفياً؛ المستبدَل هو الجذع وحده. */
    spoken = spoken.replace(entry.pattern, (_m, before, proclitic) => `${before}${proclitic}${entry.to}`)
  }
  return daadToDhaa(spoken)
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
