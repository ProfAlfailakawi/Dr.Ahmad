/**
 * فهرس متن موسوعة تكنولوجيا التعليم — من صفحات الكتاب نفسها، ببرهانٍ لا اجتهاد.
 *
 * ما قبل هذا الملف كان «توسعةً»: يعيد تقطيع ٢٨٠ مقطعاً قديماً إلى نوافذ كلمات
 * متداخلة، فيتضخم العدد إلى ٢١٧٧ بينما التغطية الحقيقية ١٧٤ صفحة من ٦٩٦.
 * وهذا الباني يعود إلى المصدر ويقرأ الكتاب كله بمستخرجَين يكمّل أحدهما الآخر،
 * كلٌّ فيما يُتقنه وحده:
 *
 *   • هندسة الصفحة (PyMuPDF): تعطي **الترتيب والبنية**. كل إطار طباعي (block)
 *     يخرج وحدةً مستقلة، وسطوره تُقرأ يميناً فيساراً بإحداثياتها — فينحلّ من
 *     أصله تشابكُ الأعمدة والأشرطة الجانبية وحواشي الصور. لكنها تعكس مكوّنات
 *     لقاء «لام» داخل الكلمة (المستحدثات ← املستحدثات) فلا تصلح نصاً.
 *   • مجرى النص (pypdf): يعطي **الحروف** بصورتها الصحيحة وتشكيلها، لكن ترتيبه
 *     يخلط الأعمدة ويقذف الأرقام في غير مواضعها.
 *
 * فيُبنى النص من الاثنين: ترتيبُ الهندسة، وحروفُ المجرى. والوصل بينهما بمفتاحٍ
 * محايدٍ للانعكاس (حروف الكلمة مفروزة)، عبر قاموسٍ يُبنى لكل صفحة على حدة.
 * وحين يحمل المفتاحُ الواحد هجاءين مختلفين (قلبٌ لفظيّ نادر — ٠٫٣٢٪) تُرفض
 * الجملة كلها ولا يُخمَّن.
 *
 * عقد الأمانة الحرفية — بأسبابٍ مقيسة لا مفترضة:
 *   ١) لا تُقبل جملة فيها رقم أو حرف لاتيني أو نسبة: اتجاه النص يقلب مواضعها
 *      («ويعرفها الكندي (2005: ص6)» تخرج «2005( 6: ص )»)، وإصلاحها تخمين.
 *   ٢) لا يُضَمّ مقطعٌ من إطارين: ما لم يجمعه الطبّاع في إطارٍ واحد لا نجمعه.
 *   ٣) كل كلمة في كل مقطع مُثبَتة في نص صفحتها من المجرى المستقل، وترتيبها
 *      مُثبَت من هندسة الصفحة — ويُعاد التحقق من ذلك عند كل بناء.
 *
 * حدود الكتاب المقيسة من النص (وتُفحص عند كل بناء):
 *   ص1-33 غلاف وبيانات نشر وفهرس · ص34 المقدمة · المتن حتى ص656 ·
 *   ص657 لوحة اقتباس · ص658-684 قوائم المراجع مبوبة · بعدها ملحقات.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const CACHE_VERSION = 5

/* ═══ الكتب التي تُقرأ بهذا المحرك ═══
 *
 * لكل كتابٍ المسارُ الذي يناسب ملفَّه، والبوابات والبرهان واحدة للجميع:
 *   · الموسوعة: هندسةُ صفحاتها وتصادُقُ مستخرجَيها — نصُّها كامل ومرسوم.
 *   · الثمانية الباقية: تعرُّفٌ ضوئيّ محليّ (Vision في macOS، بلا شبكة ولا
 *     خدمة مدفوعة). ثلاثةٌ منها مصوَّرةٌ بلا طبقة نصّ أصلاً (الطفل ١٪،
 *     البيانات الضخمة ٥٪، العالم الافتراضي ٠٪)، وخمسةٌ هجينةٌ طبقةُ نصّها
 *     مبتورة: من كل ثلاث صفحات واحدةٌ لا تُخرج حرفاً، والباقية تُخرج ثلث ما
 *     فيها (٥١١–٧٤٦ حرفاً للصفحة مقابل ٢٬٢٥٤ في الموسوعة). وقياسُ الفرق
 *     حاسم: «التلعيب» ٤١٪ تغطيةً بنصّ مجراه و٦٥٪ بتعرّفه الضوئي.
 *
 * حدود المتن تُشتقّ من محاور الكتاب (المقدمة ← الخاتمة، وقائمة المراجع
 * مستثناة)، إلا الموسوعة فمحاورها تخلط الخاتمة بالمراجع، فحدودُها مقيسةٌ
 * من نصّها ومحروسةٌ بشاهدَين يُفحصان عند كل بناء.
 */
export const ENGINE_BOOKS = {
  encyclopedia: {
    file: /موسوعة.*تكنولوجيا.*التعليم/u,
    body: { start: 34, end: 656 },
    sentinels: { opensWith: 'انتشرت التكنولوجيا', referencesAt: 658, referencesMark: /قائمة مصادر ومراجع/u },
  },
  'digital-education': { ocr: 'digital-education', file: /^01-.*digital/i },
  'kids-tech': { ocr: 'kids' },
  'mega-data': { ocr: 'mega' },
  'virtual-world': { ocr: 'virtual' },
  gamification: { ocr: 'gamification', file: /^02-.*gamification/i },
  'handy-tech': { ocr: 'handy-tech', file: /^03-.*handy/i },
  'smart-school': { ocr: 'smart-school', file: /^06-.*smart/i },
  teaching: { ocr: 'teaching', file: /^07-.*teaching/i },
}

const REFERENCE_SECTION = /قائمة المراجع|قائمة مصادر|المصادر|الفهرس|المحتويات/u

/** حدود المتن من محاور الكتاب: أول محور ← آخر محورٍ ليس قائمة مراجع. */
export function bodyRangeFromConcepts(concepts = []) {
  const usable = concepts.filter((item) => Number(item.pageStart) > 0)
  if (!usable.length) return null
  const body = usable.filter((item) => !REFERENCE_SECTION.test(String(item.title || '')))
  if (!body.length) return null
  return {
    start: Math.min(...body.map((item) => Number(item.pageStart))),
    end: Math.max(...body.map((item) => Number(item.pageEnd || item.pageStart))),
  }
}

/* ═══ حدود المتن — أرقام مثبتة بالفحص، يحرسها تحقق تشغيلي أدناه ═══ */
export const BODY_LIMITS = {
  bodyStart: 34,          // أول صفحة نثر: مقدمة الموسوعة
  bodyEnd: 656,           // آخر صفحة متن قبل لوحة الاقتباس والمراجع
  referencesStart: 658,   // «قائمة مصادر ومراجع الباب الأول»
  minPassageChars: 70,   // معيار البيت نفسه في مسبك الاقتباسات
  maxPassageChars: 420,   // سقف الضم؛ الجملة الواحدة الأطول تُقبل حتى الحد الصلب
  hardMaxChars: 640,
  minPassageWords: 10,
  minSentenceChars: 12,
  minSentenceWords: 3,
}

/* ═══ التطبيع — سياسة الموقع نفسها (التنوين قبل الألف) بلا مساسٍ بالكلمات ═══ */
const FATHATAN = 'ً'
export const normalizeArabic = (value = '') => String(value)
  .normalize('NFKC')
  .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
  .replace(/ـ+/g, '')
  .replace(/ /g, ' ')
  .replaceAll(`${FATHATAN}ا`, `ا${FATHATAN}`)
  /* والشدّة قد تفصل التنوين عن ألفه («صوتيًّا») فتُفلته من التطبيع ومن حارس
     الموقع معاً — والسياسة واحدة: التنوين بعد الألف. */
  .replace(new RegExp(`${FATHATAN}(\u0651)ا`, 'g'), `$1ا${FATHATAN}`)
  .replace(/([ء-يٱ-ۓ])[ \t]+([ً-ٍ])/g, '$1$2')
  .replace(/([ً-ٍ])\1+/g, '$1')
  .replace(/[ \t]+/g, ' ')
  /* علامة الوقف يلتصق بها الحرف التالي أحياناً في التعرّف («المستخدمين.و
     تحتاج») — والمسافة أثرُ قياسٍ لا حرفٌ في الكتاب. */
  .replace(/([.؟!])(?=[؀-ۿ])/gu, '$1 ')
  /* الفاصلة اللاتينية بين حرفين عربيين قراءةٌ خاطئة للفاصلة العربية لا حرفٌ
     في الكتاب — تطبيعٌ من جنس تطبيع التنوين، لا تعديلَ نصّ. */
  .replace(/([؀-ۿ])\s*,\s*(?=[؀-ۿ])/gu, '$1، ')
  .replace(/([؀-ۿ])\s*;\s*(?=[؀-ۿ])/gu, '$1؛ ')
  /* هندسة الصفحة تفصل الترقيم عن كلمته («التعليم .») — المسافة أثر قياسٍ
     لا حرفٌ في الكتاب، فتُزال. والقوس والتنصيص يُلصقان بما يليهما. */
  .replace(/ +([.،؛:!؟»)”\]])/gu, '$1')
  .replace(/([«("\[]) +/gu, '$1')
  .trim()

export const bareArabic = (value = '') => normalizeArabic(value)
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[^؀-ۿ]/g, '')

export const fingerprintOf = (value = '') => bareArabic(value).slice(0, 60)

const ARABIC_RUN = /[؀-ۿ]+/gu
const stripMarks = (word = '') => word.replace(/[ً-ْٰ]/g, '')
/* مفتاح محايد لانعكاس لقاء «لام»: حروف الكلمة مفروزة. */
const canonKey = (word = '') => [...stripMarks(word)].sort().join('')
export const canonWords = (text = '') => (normalizeArabic(text).match(ARABIC_RUN) || []).map(canonKey)

/* ═══ بوابات الجملة — كل بوابة تحمي من عرضٍ مبعثر أو منسوبٍ خطأً ═══ */
const BANNED = [
  'ردمك', 'رقم الإيداع', 'مكتبة الكويت الوطنية', 'قائمة المراجع', 'قائمة مصادر',
  'المحتويات', 'جميع الحقوق', 'الطبعة الأولى', 'دار النشر', 'ص.ب', 'تصميم الغلاف',
]
const REFERENCE_MARKERS = [
  'رسالة ماجستير', 'أطروحة دكتوراه', 'غير منشورة', 'دار النشر', 'رقم الإيداع', 'ردمك',
  'ترجمة أ.', 'ترجمة د.', 'كلية التربية، جامعة', 'الإصدار الأول، مؤسسة', 'مجلة كلية',
]

export function looksLikeReference(text = '') {
  const value = normalizeArabic(text)
  if (REFERENCE_MARKERS.some((marker) => value.includes(marker))) return true
  if ((value.match(/،/g) || []).length >= 4 && /(?:جامعة|كلية|مجلة|مؤتمر|رسالة|أطروحة)\s/u.test(value)) return true
  return false
}

/**
 * بوابة الجملة. الطول شرطُ الاستقلال لا شرطُ النظافة: الجملة القصيرة
 * النظيفة («ولهذا وجب الاهتمام بها.») جزءٌ أصيل من فقرتها، فتُضَمّ ولا
 * تُقصى — وإقصاؤها كان يكسر الفقرة من حولها فيضيع ما حولها معها.
 */
const ARABIC_LETTER = /[ء-يٱ-ۓ]/
const FOREIGN_RUN = /[0-9٠-٩۰-۹A-Za-z][0-9٠-٩۰-۹A-Za-z.&'\-]*/g

/* أشكالُ الإسناد كما يُخرجها المستخرج من هذه الكتب. وقد خرج الرقمُ من قوسه
   وانطبق القوسُ فارغاً («خميس 2003()» أصلها «خميس (2003)») — أثرٌ حتميّ
   لاتجاه النص لا تشويشٌ عشوائي، فيُتعرَّف عليه.

   والعملية هنا **حذفٌ لا نقل**: لا يُعاد بناء رقمٍ ولا يُغيَّر موضعُ كلمة، فترتيبُ
   العربية حول الإسناد يبقى كما استُخرج. ولذلك لا يسري عليها اعتراضُ البيدي —
   فاعتراضُه على استرجاع مواضع الأرقام، ونحن نُلغيها. ويبقى اسمُ العالِم فلا
   يُنسب قولٌ إلى غير قائله، وتسقط السنة وحدها. */
const CITATION_SHAPES = [
  /* «قطامي:2003(282)» — سنةٌ بنقطتين يتلوها قوسٌ برقم الصفحة. مركّبٌ لا يلتبس
     بكمٍّ قط، لأن العددَ لا يجيء بعد سنةٍ مسبوقةٍ بنقطتين. يُحذف بتمامه. */
  /\s*:\s*([0-9٠-٩۰-۹]{4})\s*\(\s*[0-9٠-٩۰-۹]{1,4}\s*\)/g,
  /* الترتيب مقصود: الشكلُ التامّ «(2003)» يُحذف قبل الناقص «2003)»، وإلا التهم
     الناقصُ نصفَه وخلّف قوساً وحيداً يُسقط الجملةَ في حارس التوازن. */
  /\s*\(\s*([0-9٠-٩۰-۹]{1,4})\s*\)/g,
  /\s*([0-9٠-٩۰-۹]{2,4})\s*\(\s*\)/g,
  /\s*:\s*([0-9٠-٩۰-۹]{4})/g,
  /\s*([0-9٠-٩۰-۹]{2,4})\s*\)/g,
]
/* **لا يُحذف إلا ما كان سنة.** والعددُ يبقى فتُرفض جملتُه كما كانت تُرفض.
   وهذا هو الفرق بين الإسناد والكمّ: «خميس (2003)» إسنادٌ يُحذف، و«من (40)
   معلماً» عددٌ لو حُذف لانكسرت الجملة نحواً وخرجت كذباً على الكتاب. والحدّ
   ١٣٠٠–٢١٠٠ يسع الهجريّ والميلاديّ ولا يسع أعداد العيّنات. */
const YEAR_MIN = 1300
const YEAR_MAX = 2100
const arabicDigits = (value = '') => value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
const isYear = (value = '') => {
  const digits = arabicDigits(value)
  if (digits.length !== 4) return false
  const number = Number(digits)
  return number >= YEAR_MIN && number <= YEAR_MAX
}
/* الترقيمُ في أول السطر بنيةٌ لا معنى («-1 التكنولوجيا كعمليات»)، فيُحذف. */
const LEADING_ENUMERATION = /^\s*-?\s*[0-9٠-٩۰-۹]{1,2}\s*[-–.]?\s+/
/* **ولا تُمَسّ اللاتينية.** جُرِّبت فكشفت عيباً جسيماً: الاسمُ اللاتيني في هذه
   الكتب ليس شرحاً لما قبله بل هو المُسنَد إليه نفسه. «ووصف Briggs التصميمَ
   التعليمي» تصير بحذفه «ووصف التصميمَ التعليمي» بلا فاعل، و«إطار عمل TPACK»
   تصير «إطار عمل». والسنةُ وحدها هي التي لا تكون فاعلاً قط، فهي التي تُحذف. */

/**
 * يجرّد الجملةَ من إسنادها ومن شرح الاسم الأجنبي، فتعود نصّاً عربياً خالصاً.
 *
 * يُرجع `null` — فتُرفض الجملة كما كانت تُرفض — في ثلاث حالات:
 *  · بقي رقمٌ أو حرفٌ لاتيني بعد التجريد (رقمٌ في متن الجملة لا في إسنادها).
 *  · كان الدخيلُ **ملتحماً بحرفٍ عربي** («نموذجSAMR») — فحذفُه يشقّ الكلمة
 *    ويولّد لفظاً لم يوجد في الكتاب قط، وذلك نقضٌ لعقد الحرفية.
 *  · لم يتغيّر شيء.
 */
export function stripCitations(text = '') {
  const source = String(text)
  /* الحارس الأول: أيُّ دخيلٍ يلامس حرفاً عربياً يمنع التجريد كلَّه. */
  for (const match of source.matchAll(FOREIGN_RUN)) {
    const before = source[match.index - 1]
    const after = source[match.index + match[0].length]
    if ((before && ARABIC_LETTER.test(before)) || (after && ARABIC_LETTER.test(after))) return null
  }
  let value = source.replace(LEADING_ENUMERATION, '')
  for (const shape of CITATION_SHAPES) value = value.replace(shape, (whole, digits) => (isYear(digits) ? ' ' : whole))
  /* لا يُلصَق شيءٌ بشيء: كلُّ ما يجري هنا حذفٌ وطيُّ فراغ. فلو أُلصقت علامةُ
     ترقيمٍ بكلمةٍ لصارت كلمةً لا يشهدها مجرى النص، فأسقطت برهانَ الحرفية. */
  value = value.replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (!value || value === source.trim()) return null
  if (/[0-9٠-٩۰-۹A-Za-z]/.test(value)) return null
  return value
}

export function sentenceRejection(text = '', { standalone = true } = {}) {
  const value = String(text).trim()
  if (standalone && value.length < BODY_LIMITS.minSentenceChars) return 'قصيرة'
  if (standalone && value.split(/\s+/u).length < BODY_LIMITS.minSentenceWords) return 'كلمات قليلة'
  if (!value) return 'فارغة'
  /* الرقم واللاتينية والنسبة: مواضعها غير مضمونة في الاستخراج — تُرفض الجملة كلها. */
  if (/[0-9٠-٩۰-۹]/.test(value)) return 'فيها أرقام'
  if (/[A-Za-z]/.test(value)) return 'حروف لاتينية'
  if (value.includes('%') || value.includes('٪')) return 'نسبة مئوية'
  if (/[*•▪◦□■]/u.test(value)) return 'رمز تعداد'
  if (/�/.test(value)) return 'حرف تالف'
  if (/\s\.\s/.test(value) || value.includes(': .')) return 'نقطة شاردة'
  /* قوسٌ غير متوازن أو قوسٌ يحوي غير العربية: أثر انعكاس الاتجاه — لا يُقتبس. */
  for (const [open, close] of [['(', ')'], ['[', ']'], ['«', '»'], ['“', '”']]) {
    if (value.split(open).length !== value.split(close).length) return 'أقواس غير متوازنة'
  }
  if ((value.split('"').length - 1) % 2 !== 0) return 'اقتباس غير مغلق'
  for (const group of value.match(/\([^)]*\)/gu) || []) {
    const inner = group.slice(1, -1)
    if (/[^؀-ۿ\s،؛]/u.test(inner)) return 'قوس غير عربي'
    if (inner.includes('،')) return 'إحالة مرجعية'
    if (group.length > 60) return 'قوس طويل'
  }
  const letters = value.replace(/[^\p{L}]/gu, '')
  const arabicLetters = value.replace(/[^؀-ۿ]/g, '')
  if (!letters.length || arabicLetters.length / letters.length < 0.98) return 'نص غير عربي خالص'
  /* حرفٌ عربي مفرد قائمٌ بذاته: لا كلمة عربية بحرفٍ واحد، فهو أثرُ تنوينٍ
     انشقّ عن كلمته عند القياس («أساساً» ← «أساس ا») أو حطامُ عمود. */
  if (/(?:^|\s)[ء-ي](?:\s|$)/u.test(value)) return 'حرف مفرد شارد'
  /* كلمات مفردة الحرف متتابعة = استخراج متشظٍّ من جدول أو عمود. */
  let singles = 0
  for (const word of value.split(/\s+/u)) {
    const bare = word.replace(/[^\p{L}]/gu, '')
    if (bare.length === 1) { singles += 1; if (singles >= 3) return 'نص متشظٍّ' } else singles = 0
  }
  /* الكلمة نفسها مرتين متلاصقتين = تأتأة استخراج. (الأبعد تكرارٌ بلاغيّ مشروع.) */
  const bare = value.split(/\s+/u).map((word) => word.replace(/[^\p{L}]/gu, ''))
  for (let index = 0; index + 1 < bare.length; index += 1) {
    if (bare[index].length >= 4 && bare[index] === bare[index + 1]) return 'تكرار متلاصق'
  }
  /* العبارة المكررة متلاصقةً («ومكبرات الصوت ومكبرات الصوت») تأتأةُ استخراجٍ
     أيضاً، ولا يمسكها فحصُ الكلمة الواحدة. كشفتها مراجعةُ الدكتور بعينه. */
  for (let index = 0; index + 3 < bare.length; index += 1) {
    if (bare[index].length < 3 || bare[index + 1].length < 3) continue
    if (bare[index] === bare[index + 2] && bare[index + 1] === bare[index + 3]) return 'تكرار عبارة'
  }
  /* التعرّف الضوئي يخطئ خطأً خاصاً به: يلصق حرفاً غريباً أو يقرأ الحرف
     الأول من الكلمة فيبتره («ستخدم» بدل «تستخدم»). والحرف المكرر ثلاثاً
     في كلمةٍ واحدة أثرُ تشويش لا لغةٌ عربية. */
  if (/([؀-ۿ])\1\1/u.test(value)) return 'حرف مكرر ثلاثاً'
  if (/(?:^|\s)[ء-ي]\s*[-–—]\s/u.test(value)) return 'بند قائمة'
  /* «أ. كذا» عنوانٌ اندسّ في السطر عند الاستخراج فذيّل الجملة بحرفٍ منقوط. */
  if (/\s[ء-ي]\.$/u.test(value) || /(?:^|\s)[ء-ي]\.\s/u.test(value)) return 'ذيل ترقيم'
  for (const banned of BANNED) if (value.includes(banned)) return `عبارة ناشر: ${banned}`
  if (looksLikeReference(value)) return 'صيغة مرجع'
  if (!/[.؟!][»)”]?$/u.test(value)) return 'بلا نهاية'
  return null
}

/* ═══ العنوان المندسّ وسط الجملة ═══
 * مجرى النص يدمج العنوان الجانبي في سطر النثر، فتخرج «إنهم ليسوا التدريب:
 * مجرد مدربين» و«لا يتعلمون التقييم التكويني: المفاهيم فحسب». وبصمتُه:
 * نقطتان في وسط الجملة، قبلهما كلامٌ لا يُنهي معنى وبعدهما كلامٌ يكمله —
 * لا كلمةَ تعدادٍ («مثل» و«الآتي» و«وهي») ولا موضعَ تعريفٍ في آخر الجملة.
 * (لا تُطبَّق على الموسوعة: هندستُها تفصل العناوين في إطاراتٍ مستقلة.) */
const LIST_LEAD = /(?:مثل|التالي|التالية|الآتي|الآتية|كالتالي|كالآتي|يلي|هي|هو|منها|وهي|وهو|أهمها|أبرزها|التالى)\s*$/u
export function hasSplicedHeading(sentence = '') {
  const match = String(sentence).match(/^(.*?[^\s:])\s*:\s*(\S[\s\S]*)$/u)
  if (!match) return false
  const before = match[1].trim()
  const after = match[2].trim()
  if (LIST_LEAD.test(before)) return false
  return before.split(/\s+/u).length >= 3 && after.split(/\s+/u).length >= 4
}

/* بداية المقطع: تُرفض ذيول التعداد التي لا تقوم جملةً افتتاحية بنفسها.
   («و» و«كما» تفتتحان جملاً تامة في نثر الكتاب فلا تُرفضان.) */
/* ═══ خطأ الرقط في التعرّف الضوئي ═══
 *
 * الحروف العربية تفترق بالنقط وحدها: ب ت ث ن ي — فيخطئ التعرّف بينها فتخرج
 * «بلعبون» و«نعليم» و«بمكن» و«بتضمن». كشفتها المراجعة بالعين: عشرون من
 * سبعةٍ وعشرين مشتبهاً كانت رقطاً مقلوباً.
 *
 * **وهذه عدسةُ مراجعةٍ لا بوابةَ بناء** — وقياسُ ذلك حاسم: قلبُ النقطة في
 * العربية يولّد كلمةً صحيحةً أخرى غالباً («نحقق» و«قيل» و«نوم» و«نتعلم» كلها
 * سليمة)، فلو صارت بوابةً لأسقطت نثراً صحيحاً. لا يفصل بينهما إلا السياق،
 * ولا يقرأ السياقَ إلا إنسان. فتُعرض المرشحات على العين، وما ثبت خطؤه يُحجب
 * ببصمته في book-passage-blocklist.json.
 *
 *   node scripts/review-book-passages.mjs --misread
 */
const DOTTED = 'بتثني'
export function looksMisread(word, frequency) {
  const skeleton = String(word).replace(/[ً-ْٰـ]/g, '')
  if (skeleton.length < 3 || skeleton.length > 9) return false
  if ((frequency.get(skeleton) || 0) > 1) return false
  for (let index = 0; index < Math.min(2, skeleton.length); index += 1) {
    if (!DOTTED.includes(skeleton[index])) continue
    for (const letter of DOTTED) {
      if (letter === skeleton[index]) continue
      const swapped = `${skeleton.slice(0, index)}${letter}${skeleton.slice(index + 1)}`
      if ((frequency.get(swapped) || 0) >= 8) return swapped
    }
  }
  return false
}

const TAIL_STARTERS = /^(?:ثم|أو|بل|أي|كذا|كذلك|وعليه|أمّا بعد)\s/u

/* ═══ بوابة المقطع المجمَّع — يعيد الاختبار تطبيقها على الملف المنشور ═══ */
export function passageRejection(text = '') {
  const value = normalizeArabic(text)
  if (value.length < BODY_LIMITS.minPassageChars) return 'قصير'
  if (value.length > BODY_LIMITS.hardMaxChars) return 'طويل'
  if (value.split(/\s+/u).length < BODY_LIMITS.minPassageWords) return 'كلمات قليلة'
  if (TAIL_STARTERS.test(value)) return 'بداية معلّقة'
  if (/^[\s.،؛:!؟\-–—)»]/u.test(value)) return 'بداية مبتورة'
  for (const sentence of value.split(/(?<=[.؟!])\s+/u)) {
    const reason = sentenceRejection(sentence, { standalone: false })
    if (reason) return reason
  }
  return null
}

/* ═══ قراءة الكتاب — ذاكرة موقّعة ببصمة الملف، أو استخراج مزدوج جديد ═══ */
function locatePrivateDir() {
  return [
    process.env.PRIVATE_BOOKS_DIR,
    resolve(ROOT, '../PrivateBooks'),
    resolve(ROOT, '../../PrivateBooks'),
    '/Users/prof.ahmadalfailakawi/Downloads/Websites/PrivateBooks',
  ].filter(Boolean).find((candidate) => existsSync(candidate)) || null
}

/* يلزم: pip3 install pypdf pymupdf */
const EXTRACT_PY = String.raw`
import json, sys, re, unicodedata
from collections import defaultdict
from pypdf import PdfReader
import fitz

TATWEEL = re.compile('ـ+')
def norm(s):
    return TATWEEL.sub('', unicodedata.normalize('NFKC', s))

DESIGN = ('indd', 'Dr Ahmed Book Design')
path = sys.argv[1]

reader = PdfReader(path)
stream = []
for i, page in enumerate(reader.pages):
    try: text = page.extract_text() or ""
    except Exception: text = ""
    stream.append(norm(text))

doc = fitz.open(path)
pages = []
for i, page in enumerate(doc):
    width = page.rect.width or 1
    lines = defaultdict(list)
    for w in page.get_text('words'):
        lines[(w[5], w[6])].append(w)
    frames = defaultdict(list)
    for (block, line), ws in lines.items():
        # سطر عربي يُقرأ يميناً فيساراً: ترتيب الكلمات بإحداثياتها لا بمجرى الملف
        ws = sorted(ws, key=lambda w: -w[2])
        top = min(w[1] for w in ws)
        right = max(w[2] for w in ws)
        left = min(w[0] for w in ws)
        frames[block].append((top, right, left, ' '.join(w[4] for w in ws)))
    blocks = []
    for block in sorted(frames):
        rows = sorted(frames[block])
        text = norm(' '.join(row[3] for row in rows))
        if not text or any(mark in text for mark in DESIGN): continue
        span = max(row[1] for row in rows) - min(row[2] for row in rows)
        blocks.append({'text': text, 'share': round(span / width, 3)})
    pages.append({'page': i + 1, 'text': stream[i] if i < len(stream) else '', 'blocks': blocks})

print(json.dumps({'pages': pages}, ensure_ascii=False))
`

export function loadBookPages(slug = 'encyclopedia') {
  const config = ENGINE_BOOKS[slug]
  if (!config) throw new Error(`الكتاب «${slug}» ليس من كتب هذا المحرك.`)
  const privateDir = locatePrivateDir()
  if (!privateDir) throw new Error('لم أجد مجلد PrivateBooks. عرّفه في PRIVATE_BOOKS_DIR ثم أعد البناء.')
  const fileName = readdirSync(privateDir)
    .filter((name) => extname(name).toLowerCase() === '.pdf')
    .find((name) => config.file.test(name.normalize('NFC')))
  if (!fileName) throw new Error(`ملف الكتاب «${slug}» غير موجود في PrivateBooks.`)
  const fullPath = resolve(privateDir, fileName)
  const sourceSha256 = createHash('sha256').update(readFileSync(fullPath)).digest('hex')

  const cacheDir = resolve(ROOT, '.private-memory/extracted-pages')
  const cacheFile = resolve(cacheDir, `${slug}-pages.json`)
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
      if (cached?.version === CACHE_VERSION && cached.sourceSha256 === sourceSha256 && Array.isArray(cached.pages)) {
        return { pages: cached.pages, sourceSha256 }
      }
    } catch { /* ذاكرة معطوبة — يعاد الاستخراج أدناه */ }
  }
  const result = spawnSync('python3', ['-c', EXTRACT_PY, fullPath], { encoding: 'utf8', maxBuffer: 320 * 1024 * 1024, timeout: 900_000 })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().slice(0, 400)
    throw new Error(`تعذّر الاستخراج المزدوج للكتاب «${slug}» (يلزم: pip3 install pypdf pymupdf)\n${detail}`)
  }
  const { pages } = JSON.parse(result.stdout)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, `${JSON.stringify({ version: CACHE_VERSION, sourceSha256, pageCount: pages.length, pages })}\n`)
  return { pages, sourceSha256 }
}

/* ═══ الكتب المصوَّرة: قراءة ناتج التعرّف الضوئي ═══
 *
 * ثلاثة كتب صُوّرت تصويراً فلا طبقةَ نصّ فيها، وناتجُ التعرّف الضوئي هو نصّها
 * الوحيد. فلا تصادُقَ بين مستخرجَين هنا ولا إعادةَ هجاء — النصّ يمرّ كما هو،
 * وتبقى بوابات الجودة نفسها هي الحارس. وتُبنى «الإطارات» من سطوره: السطرُ
 * القصير غيرُ المختوم عنوانٌ يقطع، وما بينهما فقرة.
 */
export function loadOcrPages(name) {
  const file = resolve(ROOT, `.private-memory/ocr/${name}.jsonl`)
  if (!existsSync(file)) throw new Error(`ناتج التعرّف الضوئي مفقود: ${file}`)
  return readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => {
    const row = JSON.parse(line)
    const text = normalizeArabic(row.text || '')
    const { blocks, headings } = blocksFromLines(row.text || '')
    return { page: Number(row.page), text, blocks, headings }
  })
}

/** يقرأ الكتاب بالمسار الذي يناسبه: هندسةً وتصادُقاً، أو تعرّفاً ضوئياً. */
/** يبني «إطارات» من سطور نصٍّ واحد — يُستعمل لناتج التعرّف الضوئي ولنصّ المجرى. */
function blocksFromLines(text = '') {
  const lines = String(text).split('\n').map((line) => normalizeArabic(line)).filter(Boolean)
  const blocks = []
  const headings = []
  let current = []
  const close = () => { if (current.length) { blocks.push({ text: current.join(' '), share: 1 }); current = [] } }
  for (const line of lines) {
    const heading = line.length < 45 && !/[.؟!][»)”]?$/u.test(line)
    if (heading || /^(?:[ء-ي]|[٠-٩0-9]+)\s*[-–—.)]\s/u.test(line)) {
      close()
      /* العنوان المُهمَل يُحفظ: مجراه قد يدسّه داخل جملةٍ في صفحةٍ أخرى
         («لا يتعلمون التقييم التكويني: المفاهيم فحسب»)، فيصير دليلَ كشف. */
      const bare = line.replace(/^[\s\-–—.)٠-٩0-9ء-ي]{0,4}/u, '').replace(/[:：]\s*$/u, '').trim()
      if (bare.length >= 10 && bare.length <= 60 && /[؀-ۿ]/u.test(bare)) headings.push(bare)
      continue
    }
    current.push(line)
  }
  close()
  return { blocks, headings }
}

export function loadEngineBook(slug, { mode } = {}) {
  const config = ENGINE_BOOKS[slug]
  if (!config) throw new Error(`الكتاب «${slug}» ليس من كتب هذا المحرك.`)
  const source = mode || config.source || (config.ocr ? 'ocr' : 'geometry')
  if (source === 'ocr') return { pages: loadOcrPages(config.ocr || slug), passthrough: true }
  const loaded = loadBookPages(slug)
  /* خطُّ بعض الكتب لا يناسب قراءة الهندسة (يبعثر الحروف ويخلط الكلمات)،
     بينما نصُّ مجراها سليم. فتُقرأ من مجراها بالأنبوب نفسه وبوابته نفسها. */
  if (source === 'stream') {
    return {
      pages: loaded.pages.map((page) => ({ ...page, ...blocksFromLines(page.text) })),
      passthrough: true,
    }
  }
  return { ...loaded, passthrough: false }
}

/** توافقٌ رجعيّ مع النداء القديم. */
export const loadEncyclopediaBook = () => loadBookPages('encyclopedia')

/* ═══ جدول لقاءات الخط — يتعلّمه المحرك من الكتاب نفسه ═══
 *
 * هندسة الصفحة تُخرج مكوّنات اللقاء الطباعي معكوسةً: «لم»←«مل»، «ين»←«ني»،
 * «لمح»←«حمل». وجدول اللقاءات خاصٌّ بخط الكتاب، فلا يُفترض بل يُستخرج: كل
 * كلمةٍ اتفق عليها المستخرجان تُعلّم المحرك انعكاساً، فتتراكم من ٣٠ ألف كلمةٍ
 * موثّقة قاعدةُ الخط كاملة (لم · لا · لأ · لإ · ين · لح · يم · تح · لخ · لج …).
 * وما شذّ عن الجدول (٣٤ كلمة من ٢٩٩٥٣) يبقى شاذاً فتُرفض جملته.
 */
function learnLigatures(pages, bodyStart, bodyEnd) {
  const perPage = new Map()
  for (const page of pages) {
    const forms = new Map()
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) {
      const key = canonKey(word)
      const set = forms.get(key) || new Set()
      set.add(stripMarks(word))
      forms.set(key, set)
    }
    perPage.set(page.page, forms)
  }
  const nearby = (pageNumber, word) => {
    const merged = new Set()
    for (const offset of [0, -1, 1]) {
      for (const form of perPage.get(pageNumber + offset)?.get(canonKey(word)) || []) merged.add(form)
    }
    return [...merged]
  }

  const counts = new Map()
  let explained = 0
  let stubborn = 0
  for (const page of pages) {
    if (page.page < bodyStart || page.page > bodyEnd) continue
    for (const block of page.blocks || []) {
      for (const raw of normalizeArabic(block.text).match(ARABIC_RUN) || []) {
        const shown = stripMarks(raw)
        if (shown.length < 3) continue
        const candidates = nearby(page.page, shown)
        if (candidates.length !== 1) continue
        const truth = candidates[0]
        if (truth === shown || truth.length !== shown.length) continue
        const segments = []
        let cursor = 0
        let ok = true
        while (cursor < truth.length) {
          if (truth[cursor] === shown[cursor]) { cursor += 1; continue }
          let size = 0
          for (const width of [2, 3, 4]) {
            const segment = truth.slice(cursor, cursor + width)
            if (segment.length < width) continue
            if ([...segment].reverse().join('') === shown.slice(cursor, cursor + width)) { size = width; break }
          }
          if (!size) { ok = false; break }
          segments.push(truth.slice(cursor, cursor + size))
          cursor += size
        }
        if (!ok) { stubborn += 1; continue }
        explained += 1
        for (const segment of segments) counts.set(segment, (counts.get(segment) || 0) + 1)
      }
    }
  }
  /* عتبة الشيوع تفصل اللقاء الحقيقي عن مصادفةٍ عابرة في كلمةٍ واحدة. */
  /* عتبة الشيوع تفصل اللقاء الحقيقي عن مصادفةٍ عابرة في كلمةٍ واحدة. وخطوط
     الكتب تختلف: منها ما لا لقاءات فيه أصلاً، فالجدولُ الفارغ حالةٌ صحيحة. */
  const table = new Set([...counts].filter(([, count]) => count >= 20).map(([segment]) => segment))
  return { table, explained, stubborn }
}

/* ═══ قاموس الصفحة: مفتاحٌ محايد ← هجاء المجرى الصحيح ═══
 *
 * يُبنى من نص الصفحة ومن جارتيها، لأن الفقرة تعبر الصفحات. وحين يعطي جدولُ
 * اللقاءات أكثرَ من أصلٍ ممكن وكلاهما وارد («العملية» و«العلمية» يخرجان من
 * رسمٍ واحد) تُرفض الجملة كلها — لا يُخمَّن ولا يُرجَّح.
 */
function buildSpellingIndex(pages, ligatures) {
  const perPage = new Map()
  const streams = new Map()
  const corpus = new Map()
  for (const page of pages) {
    const counts = new Map()
    const stream = []
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) {
      const skeleton = stripMarks(word)
      const forms = counts.get(skeleton) || new Map()
      forms.set(word, (forms.get(word) || 0) + 1)
      counts.set(skeleton, forms)
      corpus.set(skeleton, (corpus.get(skeleton) || 0) + 1)
      stream.push({ word, skeleton, key: canonKey(word) })
    }
    perPage.set(page.page, counts)
    streams.set(page.page, stream)
  }

  /* أصولٌ ممكنة لرسمٍ واحد: كل نافذةٍ يعرفها جدولُ اللقاءات قد تكون معكوسة. */
  const cache = new Map()
  const originsOf = (shown) => {
    const hit = cache.get(shown)
    if (hit) return hit
    const spots = []
    for (let index = 0; index < shown.length; index += 1) {
      for (const width of [2, 3, 4]) {
        const start = index
        const segment = shown.slice(start, start + width)
        if (segment.length < width) continue
        if (ligatures.has([...segment].reverse().join(''))) spots.push([start, start + width])
      }
    }
    const origins = new Set([shown])
    const capped = spots.slice(0, 10)
    const walk = (position, chosen, lastEnd) => {
      if (origins.size > 48) return
      if (position >= capped.length) {
        if (!chosen.length) return
        let chars = [...shown]
        for (const [start, end] of [...chosen].sort((left, right) => right[0] - left[0])) {
          chars = [...chars.slice(0, start), ...chars.slice(start, end).reverse(), ...chars.slice(end)]
        }
        origins.add(chars.join(''))
        return
      }
      walk(position + 1, chosen, lastEnd)
      const [start, end] = capped[position]
      if (start >= lastEnd) walk(position + 1, [...chosen, capped[position]], end)
    }
    walk(0, [], 0)
    const list = [...origins]
    cache.set(shown, list)
    return list
  }

  const pick = (forms) => [...forms.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ar'))[0][0]

  return {
    /**
     * الحسم بالموضع — للكلمات التي يتساوى فيها أصلان («العملية» و«العلمية»
     * تُرسمان رسماً واحداً، وهما من أكثر كلمات الكتاب دوراناً). نبحث عن تسلسل
     * كلمات الجملة كاملاً في مجرى الصفحة المستقل؛ فإن وُجد موضعاً واحداً لا
     * ثانيَ له، قرأنا الهجاء من المجرى نفسه في موضعه — شهادةً لا ترجيحاً.
     * يرجع مصفوفة الهجاء بترتيب الجملة، أو null إن لم ينفرد الموضع.
     */
    locate(pageNumber, keys) {
      if (keys.length < 4) return null
      let found = null
      for (const offset of [0, -1, 1]) {
        const stream = streams.get(pageNumber + offset)
        if (!stream || stream.length < keys.length) continue
        for (let start = 0; start + keys.length <= stream.length; start += 1) {
          let match = true
          for (let index = 0; index < keys.length; index += 1) {
            if (stream[start + index].key !== keys[index]) { match = false; break }
          }
          if (!match) continue
          if (found) return null
          found = stream.slice(start, start + keys.length).map((item) => item.word)
        }
      }
      return found
    },
    /** يرجع { status, form }: ok إن انفرد أصلٌ واحد، وإلا ambiguous أو missing. */
    lookup(pageNumber, word) {
      const shown = stripMarks(word)
      const origins = originsOf(shown)
      /* أولاً: ما تشهد به صفحته وجارتاها — أقرب شاهدٍ وأصدقه. */
      const local = new Map()
      for (const origin of origins) {
        const merged = new Map()
        for (const offset of [0, -1, 1]) {
          const forms = perPage.get(pageNumber + offset)?.get(origin)
          if (!forms) continue
          for (const [form, count] of forms) merged.set(form, (merged.get(form) || 0) + count)
        }
        if (merged.size) local.set(origin, merged)
      }
      if (local.size === 1) return { status: 'ok', form: pick([...local.values()][0]) }
      if (local.size > 1) return { status: 'ambiguous' }
      /* ثانياً: ما يشهد به الكتاب كله — لأن المجرى يُسقط النصوص المقتبسة
         داخل «» بتمامها، وهي أثمن ما في الموسوعة. ويُشترط شيوعٌ يمنع
         التعلّق بخطأ مطبعيّ عابر. */
      const wide = origins.filter((origin) => (corpus.get(origin) || 0) >= 3)
      if (wide.length === 1) return { status: 'ok', form: wide[0] }
      if (wide.length > 1) return { status: 'ambiguous' }
      return { status: 'missing' }
    },
  }
}

/**
 * الكلمة المنشقّة: قياسُ الصفحة يفصل حرفاً عن كلمته أحياناً — ألفُ التنوين
 * («أساساً» ← «أساس ا»)، أو واوُ العطف («واكتساب» ← «و اكتساب»)، أو ما بعد
 * الشدّة («توضّح» ← «توضّ ح»). ولا كلمة عربية بحرفٍ واحد. تُلأَم الكلمة
 * بشرطٍ واحد: أن يشهد المجرى المستقل بها ملتئمةً — وإلا تُركت لتُرفض جملتها.
 */
function healSplitWords(text, pageNumber, index) {
  const words = normalizeArabic(text).split(' ')
  const out = []
  for (let position = 0; position < words.length; position += 1) {
    const current = words[position]
    const next = words[position + 1]
    if (next && /^[؀-ۿ]+$/u.test(current)) {
      const parts = next.match(/^([؀-ۿ]+)([\s\S]*)$/u)
      if (parts) {
        const [, core, tail] = parts
        /* لا يُلأَم إلا ما لا يقوم بنفسه: حرفٌ مفرد، أو يسارٌ منتهٍ بتشكيل. */
        const suspect = stripMarks(current).length === 1
          || stripMarks(core).length === 1
          || /[ً-ْٰ]$/u.test(current)
        if (suspect && index.lookup(pageNumber, `${current}${core}`).status === 'ok') {
          out.push(`${current}${core}${tail}`)
          position += 1
          continue
        }
      }
    }
    out.push(current)
  }
  return out.join(' ')
}

/**
 * يعيد بناء نصّ الهندسة بحروف المجرى: كل كلمة عربية تُستبدل بأصلها الموثّق،
 * وما حولها من ترقيمٍ يبقى في موضعه. يرجع null إن نقصت كلمة أو التبست.
 */
function respell(text, pageNumber, index, stats) {
  const clean = normalizeArabic(text)
  let missing = 0
  let ambiguous = 0
  const rebuilt = clean.replace(ARABIC_RUN, (word) => {
    const found = index.lookup(pageNumber, word)
    if (found.status === 'ok') return found.form
    if (found.status === 'ambiguous') ambiguous += 1
    else missing += 1
    return word
  })
  if (!missing && !ambiguous) return rebuilt
  /* الالتباس وحده يُحسم بالموضع: تسلسل الجملة إن انفرد في مجرى الصفحة قرأنا
     هجاءه منه. أما نقصُ كلمةٍ فلا يُحسم بموضع، لأن المجرى نفسه لا يحملها. */
  if (!missing) {
    const keys = (clean.match(ARABIC_RUN) || []).map(canonKey)
    const located = index.locate(pageNumber, keys)
    if (located) {
      let cursor = 0
      stats.locatedByPosition += 1
      return clean.replace(ARABIC_RUN, () => located[cursor++])
    }
  }
  if (missing) stats.missingWords += missing
  else stats.ambiguousWords += ambiguous
  return null
}

/* الاقتباس المنقول قد يمتدّ جملتين («…فلان. وقال…»)، فقطعُه عندها يترك
   تنصيصاً مفتوحاً في شطرٍ ومغلقاً في آخر فيُرفض الاثنان. فلا يُقطع إلا
   خارج التنصيص. */
function splitSentences(text = '') {
  const value = normalizeArabic(text)
  const out = []
  let start = 0
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '«') depth += 1
    else if (char === '»') depth = Math.max(0, depth - 1)
    else if (depth === 0 && /[.؟!]/u.test(char)) {
      let end = index + 1
      if (/[»)”]/u.test(value[end] || '')) end += 1
      if (/\s/u.test(value[end] || '') || end >= value.length) {
        const piece = value.slice(start, end).trim()
        if (piece) out.push(piece)
        start = end
      }
    }
  }
  const tail = value.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/* ═══ الباني الرئيس ═══ */
export function buildBookBodyIndex({
  slug = 'encyclopedia',
  pages,
  concepts = [],
  passthrough = false,
  blockedFingerprints = new Set(),
  voiceOf = () => 0,
} = {}) {
  const config = ENGINE_BOOKS[slug] || {}
  const range = config.body || bodyRangeFromConcepts(concepts)
  if (!range) throw new Error(`تعذّر تحديد حدود متن الكتاب «${slug}» — لا محاور ولا حدود معلنة.`)
  const bodyStart = range.start
  const bodyEnd = range.end
  const byPage = new Map(pages.map((page) => [page.page, page]))

  /* شواهد الحدود: تُفحص في النص نفسه عند كل بناء، فإن تبدّل ملف الكتاب يوماً
     انكشف الأمر هنا لا في مقاطع فاسدة. (الموسوعة وحدها لها شاهدان معلنان،
     لأن محاورها تخلط الخاتمة بالمراجع فلا تصلح لاشتقاق الحدود.) */
  const textOf = (pageNumber) => normalizeArabic(byPage.get(pageNumber)?.text || '')
  const sentinels = config.sentinels
  if (sentinels?.opensWith && !textOf(bodyStart).includes(sentinels.opensWith)) {
    throw new Error(`حدود متن «${slug}» تزحزحت: ص${bodyStart} لا تفتتح المقدمة المعروفة`)
  }
  if (sentinels?.referencesAt && !sentinels.referencesMark.test(textOf(sentinels.referencesAt))) {
    throw new Error(`حدود متن «${slug}» تزحزحت: ص${sentinels.referencesAt} ليست بداية المراجع`)
  }
  if (!pages.some((page) => Array.isArray(page.blocks) && page.blocks.length)) {
    throw new Error(`بنية الإطارات مفقودة في «${slug}» — أعد الاستخراج.`)
  }

  /* الكتاب المصوَّر مصدرُه واحد، فلا جدولَ لقاءات ولا إعادةَ هجاء. */
  const ligatures = passthrough
    ? { table: new Set(), explained: 0, stubborn: 0 }
    : learnLigatures(pages, bodyStart, bodyEnd)
  const index = buildSpellingIndex(pages, ligatures.table)
  const conceptFor = (pageNumber) => concepts.find((item) => pageNumber >= item.pageStart && pageNumber <= Math.min(item.pageEnd, bodyEnd)) || null
  /* حارس الاندساس على طبقتين:
     · عناوين المحاور طويلةٌ ولا ترد داخل النثر، فظهورُها وسط جملةٍ اقتحام.
     · عناوين الصفحات قد ترد في النثر مشروعةً، فلا يُدينها إلا أثرُ الاقتحام
       نفسه: العنوان ثم نقطتان وسط الجملة («…لا يتعلمون التقييم التكويني:
       المفاهيم فحسب»). وتضييقُها ضروري: بلا ذلك تُقصي نثراً سليماً. */
  const titleBleeds = concepts.map((item) => String(item.title || '')).filter((title) => title.length >= 12)
  const headingBleeds = new Set()
  for (const page of pages) for (const heading of page.headings || []) if (heading.length >= 12) headingBleeds.add(heading)

  const stats = { sentences: 0, dropped: {}, rejected: {}, blocked: 0, missingWords: 0, ambiguousWords: 0, joinOnlyOrphans: 0, locatedByPosition: 0, dropSamples: {} }
  const note = (bucket, reason, text = '', page = 0) => {
    stats[bucket][reason] = (stats[bucket][reason] || 0) + 1
    if (text) {
      const samples = stats.dropSamples[reason] || (stats.dropSamples[reason] = [])
      if (samples.length < 6) samples.push(`ص${page}: ${text.slice(0, 140)}`)
    }
  }

  const passages = []
  const seen = new Set()

  /* ═══ مجرى الإطارات ═══
     الإطار وحدة الطبّاع، والفقرة تعبر منه إلى تاليه: ٣١٥٦ من ٤٠٢٣ إطاراً في
     المتن تنتهي بلا ختام لأن بقيتها في الإطار التالي. فيُخاط المجرى: ذيلُ
     الإطار غيرُ المختوم يُوصل بأول تاليه، ورقمُ الصفحة يُتجاوز فلا يقطع،
     والعنوانُ القصير يقطع الوصل ويُسقط الذيل المبتور — فلا يُلصق عنوانٌ
     بفقرةٍ ولا تُوهم فقرتان بأنهما واحدة. */
  const isPageNumber = (text = '') => !/[؀-ۿ]/u.test(text)
  /* العنوان: إطارٌ قصير لا يُختم بعلامة نهاية. وشرط «لا نقطة فيه» كان يُفلت
     «ج . النظرية البنائية» فيلتصق العنوان بفقرته — والختامُ هو الفيصل. */
  const isHeading = (text = '') => text.length < 100 && !/[.؟!][»)”]?$/u.test(text)
  const flow = []
  for (const page of pages) {
    if (page.page < bodyStart || page.page > bodyEnd) continue
    for (const block of page.blocks || []) {
      const text = normalizeArabic(block.text)
      if (!text || isPageNumber(text)) continue
      flow.push({ page: page.page, text, heading: isHeading(text) })
    }
  }

  let group = null
  const closeGroup = () => {
    if (!group) return
    const text = normalizeArabic(group.texts.join(' '))
    const page = group.page
    group = null
    const reason = passageRejection(text)
    if (reason) { note('rejected', reason); return }
    const fingerprint = fingerprintOf(text)
    if (blockedFingerprints.has(fingerprint)) { stats.blocked += 1; note('rejected', 'محجوب بأمر الدكتور'); return }
    if (seen.has(fingerprint)) { note('rejected', 'مكرّر'); return }
    seen.add(fingerprint)
    const concept = conceptFor(page)
    passages.push({
      text,
      page,
      section: concept?.title || 'مقدمة الموسوعة',
      conceptId: concept?.id || '',
      conceptTitle: concept?.title || '',
      fingerprint,
    })
  }

  let carry = null
  for (const frame of flow) {
    if (frame.heading) {
      if (carry) { note('dropped', 'ذيل قطعه عنوان', carry.text, carry.page); carry = null }
      closeGroup()
      continue
    }
    let sentences = splitSentences(frame.text)
    if (!sentences.length) continue
    let firstPage = frame.page
    if (carry) {
      sentences[0] = normalizeArabic(`${carry.text} ${sentences[0]}`)
      firstPage = carry.page
      carry = null
    } else closeGroup()

    const last = sentences[sentences.length - 1]
    if (!/[.؟!][»)”]?$/u.test(last)) {
      carry = { text: last, page: sentences.length === 1 ? firstPage : frame.page }
      sentences = sentences.slice(0, -1)
    }

    sentences.forEach((raw, order) => {
      const page = order === 0 ? firstPage : frame.page
      stats.sentences += 1
      /* الرفض المبكر يوفّر بناء الهجاء لما لن يُقبل أصلاً. */
      /* لأم الكلمة المنشقّة يعمل في كل المسارات: شاهدُه معجمُ الكتاب نفسه،
         وهو قائمٌ في المسار الضوئي كما هو في مسار الهندسة. */
      const healed = healSplitWords(raw, page, index)
      let candidate = healed
      let early = sentenceRejection(candidate, { standalone: false })
      /* الإسنادُ وشرحُ الاسم الأجنبي كانا يُسقطان تعريفاتِ العلماء كلَّها — وهي
         أثمنُ ما في المتن. فتُجرَّد الجملةُ منهما ثم تُعرض على البوابة ثانيةً،
         ولا يُقبل إلا ما صار عربياً خالصاً. */
      if (early === 'فيها أرقام') {
        const stripped = stripCitations(candidate)
        if (stripped) {
          const retry = sentenceRejection(stripped, { standalone: false })
          if (!retry) { candidate = stripped; early = ''; stats.citationsStripped = (stats.citationsStripped || 0) + 1 }
        }
      }
      if (early) { note('dropped', early, candidate, page); closeGroup(); return }
      const sentence = passthrough ? candidate : respell(candidate, page, index, stats)
      if (!sentence) { note('dropped', 'كلمة لم يثبتها المجرى', raw, page); closeGroup(); return }
      const reason = sentenceRejection(sentence, { standalone: false })
      if (reason) { note('dropped', reason, sentence, page); closeGroup(); return }
      /* القصيرة تنضمّ إلى فقرتها ولا تفتتح مقطعاً بنفسها. */
      const joinOnly = Boolean(sentenceRejection(sentence))
      const intruded = titleBleeds.some((title) => sentence.indexOf(title) > 0)
        || [...headingBleeds].some((title) => sentence.indexOf(`${title}:`) > 0 || sentence.indexOf(`${title} :`) > 0)
        || (passthrough && hasSplicedHeading(sentence))
      if (intruded) {
        note('dropped', 'عنوان داخل الجملة', sentence, page)
        closeGroup()
        return
      }
      if (group) {
        const joined = group.texts.join(' ').length + sentence.length + 1
        const startsAsTail = joinOnly || TAIL_STARTERS.test(sentence)
        if (joined <= BODY_LIMITS.maxPassageChars || (startsAsTail && joined <= BODY_LIMITS.hardMaxChars)) {
          group.texts.push(sentence)
          return
        }
        closeGroup()
      }
      if (joinOnly) { stats.joinOnlyOrphans += 1; return }
      group = { texts: [sentence], page }
    })
  }
  if (carry) note('dropped', 'ذيل بلا ختام عند نهاية المتن', carry.text, carry.page)
  closeGroup()

  /* ═══ برهان الحرفية ═══
     كل كلمة في كل مقطع مُثبَتة في مجرى نصّ الكتاب — على صفحتها أو على غيرها.
     والثانية ليست تساهلاً بل هي جوهر الكسب: المجرى يُسقط ما بين «» بتمامه
     (تعريفات العلماء المنقولة)، فتأتي من هندسة الصفحة ويُثبتها المجرى من
     موضعٍ آخر. والترتيب مُثبَت من الهندسة. ويُعاد هذا الفحص عند كل بناء. */
  /* الهيكل: حروفٌ فقط. و`ARABIC_RUN` يلتقط كتلة U+0600–U+06FF كلَّها، وفيها
     الفاصلةُ والفاصلةُ المنقوطة وعلامةُ الاستفهام العربية — فكانت «نظارات،»
     تُحسب لفظاً غير «نظارات» فيسقط البرهانُ على فرقٍ في ترقيمٍ لا في لفظ.
     والعقدُ أن كل **كلمة** مُثبَتة، والترقيمُ ليس من الكلمة. */
  const skeletonOf = (word = '') => stripMarks(word).replace(/[^ء-يٱ-ۓ]/gu, '')
  const streamWords = new Set()
  for (const page of pages) {
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) streamWords.add(skeletonOf(word))
  }
  const pageWords = new Map(pages.map((page) => [
    page.page,
    new Set((normalizeArabic(page.text || '').match(ARABIC_RUN) || []).map(skeletonOf)),
  ]))
  let offPageWords = 0
  for (const passage of passages) {
    for (const word of normalizeArabic(passage.text).match(ARABIC_RUN) || []) {
      const skeleton = skeletonOf(word)
      if (skeleton.length < 3) continue
      if (!streamWords.has(skeleton)) {
        throw new Error(`برهان الحرفية سقط في ص${passage.page}: الكلمة «${word}» ليست في مجرى نصّ الكتاب`)
      }
      const near = [passage.page - 1, passage.page, passage.page + 1]
        .some((pageNumber) => pageWords.get(pageNumber)?.has(skeleton))
      if (!near) offPageWords += 1
    }
  }
  stats.offPageWords = offPageWords

  passages.sort((left, right) => left.page - right.page)
  const shaped = passages.map((passage, order) => ({
    /* المعرّف بسلاسة الكتاب: البادئة الثابتة كانت تجعل كل الكتب تبدأ من
       encyclopedia-p00001 فتتصادم ٢٢٢ معرّفاً، فيحجب أمرُ الحجب غيرَ ما قُصد. */
    id: `${slug}-p${String(order + 1).padStart(5, '0')}`,
    text: passage.text,
    page: passage.page,
    section: passage.section,
    conceptId: passage.conceptId,
    conceptTitle: passage.conceptTitle,
    voice: voiceOf(passage.text),
    fingerprint: passage.fingerprint,
  }))

  const coveredPages = new Set(shaped.map((passage) => passage.page))
  const bodyPages = pages.filter((page) => page.page >= bodyStart && page.page <= bodyEnd)
  const uncovered = bodyPages
    .filter((page) => !coveredPages.has(page.page))
    .map((page) => ({
      page: page.page,
      reason: bareArabic(page.text).length < 80
        ? 'صفحة فاصل أو صور بلا نثر'
        : 'رفضتها بوابات الأمانة (أرقام أو لاتينية أو قوائم أو ترقيم متشابك)',
    }))

  return {
    passages: shaped,
    report: {
      slug,
      bodyRange: `${bodyStart}-${bodyEnd}`,
      bodyPageCount: bodyPages.length,
      coveredPageCount: coveredPages.size,
      uncovered,
      totalChars: shaped.reduce((sum, passage) => sum + passage.text.length, 0),
      ligatures: { learned: ligatures.table.size, explainedWords: ligatures.explained, stubbornWords: ligatures.stubborn },
      offPageWords: stats.offPageWords,
      locatedByPosition: stats.locatedByPosition,
      stats,
    },
  }
}

/** توافقٌ رجعيّ مع النداء القديم. */
export const buildEncyclopediaBodyIndex = (options = {}) => buildBookBodyIndex({ slug: 'encyclopedia', ...options })
