/* محاكاة الصوت — المحرك الذي يحوّل مسودةً إلى نصٍّ بإيقاعه، بلا إنترنت وبلا كلفة.

   لماذا كُتب هذا الملف من جديد؟ لأن المحاكاة السابقة (داخل StyleChecker) كانت
   تفعل شيئاً من اثنين، وكلاهما خطأ:

   ١ ــ على نصّه هو: لا شيء إطلاقاً. طبقتاها الحقيقيتان — رفع الوقفات وتصحيح
        الإملاء — كانتا مبنيّتين على `\b`، و`\b` في جافاسكربت لا يرى الحرف
        العربي أصلاً (لا حدَّ بين «ل» ومسافة، فكلاهما ليس \w). فكان
        `/،\s+(?=بل\b)/` لا يطابق ولا مرةً واحدة في اللغة كلها.

   ٢ ــ على مسودةٍ من نموذج: تمسيخ. «يعد التعليم الرقمي من أهم التحولات»
        صارت «ليس الحديث اليوم عن التعليم الرقمي كمجرد ا… بل عن لتحولات»،
        و«مما لا شك فيه أن» صارت «وأن» معلَّقة في أول الجملة — وهي صيغةٌ لا
        ترد في أرشيفه ولا مرة (صفر من ٥٣٨٨ جملة). ومع ذلك نال النصُّ الممسوخ
        ٨٧٪ من الحَكَم، لأن الحَكَم يقيس الإيقاع ولا يسأل: هل الجملة عربية؟

   ٣ ــ والأخطر: البدائل التي كانت تُحقن باسمه لم يكتبها قط. «الواقع أن» صفر
        في ٥٣ ألف كلمة. «الظاهر أن» صفر. «من هنا» صفر. فالمحاكاة كانت تنزع
        صوت النموذج لتضع مكانه صوتاً ثالثاً ليس صوته.

   القواعد الثلاث التي بُني عليها البديل:

   • **لا يُمنع ما يكتبه هو.** كل عبارةٍ في هذا الملف تُوزن على أرشيفه لحظة
     التشغيل: ما ورد عنده ثلاث مراتٍ فأكثر محميٌّ لا يُمسّ («من وجهة نظري» ٥
     مرات، «في عصرنا الحالي» ٣). وما ورد مرةً أو مرتين أو صفراً هو وحده القابل
     للحذف. المسطرة أرشيفه لا ذوقي.

   • **لا يُحقن ما لم يكتبه.** لا بديل إلا إذا كان مقيساً في متنه خمس مراتٍ
     فأكثر. وإلا فالحذف — والحذف وحده — هو العلاج.

   • **كل تعديلٍ يُحاكَم وحده قبل قبوله.** ستّ بواباتٍ نحوية وأمانية على كل
     موضع: أن معلّقة، كلمة مكرّرة، حرف جر مكرّر، رمز يتيم، كلمة دخيلة، رقم
     تغيّر. ما لا يعبر يُترك كما هو ويُكتب سببه للدكتور بالعربية.
     عند العجز يُقال «لم أستطع» — لا يُمسخ النص.                              */

import {
  articleMetrics,
  bareText,
  countWords,
  judgeStyle,
  orthographySlips,
  paragraphsOf,
  refineToStyle,
  resolveStyleDna,
  sentencesOf,
  wellFormedness,
} from './style-dna.mjs'

const AR = '\\p{L}\\p{M}'
const TASHKEEL_CLASS = '[\\u064B-\\u0652\\u0670\\u0640]*'

/* الحروف التي تكتبها النماذج بصورٍ متعددة؛ نطابقها كلها فلا تفلت عبارةٌ
   لأن النموذج كتب «بناء على» بلا همزة أو «الى» بلا كسرة. */
const LETTER_CLASS = new Map([
  ['ا', '[اأإآٱ]'], ['أ', '[اأإآٱ]'], ['إ', '[اأإآٱ]'], ['آ', '[اأإآٱ]'],
  ['ة', '[ةه]'], ['ه', '[ةه]'],
  ['ى', '[ىي]'], ['ي', '[ىي]'],
])

const escapeChar = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* نمطٌ مرنٌ لعبارةٍ عربية: يقبل التشكيل بين الحروف، ويقبل صور الألف والتاء
   والياء، ويقبل أي مقدار مسافةٍ بين الكلمات — وحدوده حروفٌ لا `\b`. */
export function flexBody(phrase) {
  return String(phrase).trim().split(/\s+/).filter(Boolean)
    .map((word) => [...word].map((char) => `${LETTER_CLASS.get(char) || escapeChar(char)}${TASHKEEL_CLASS}`).join(''))
    .join('\\s+')
}

export function flexPattern(phrase) {
  return `(?<![${AR}])${flexBody(phrase)}(?![${AR}])`
}

const countMatches = (text, source, flags = 'gu') => (String(text).match(new RegExp(source, flags)) || []).length

/* ---------- ١) المعجم: أي عبارةٍ يجوز المساس بها، وبأي بديل ---------- */

/* عتبةٌ واحدة لا عتبتان، ومعناها واحد: ما بلغ ثلاث مراتٍ في ٥٣ ألف كلمة
   عادةٌ لا صدفة. فما بلغها من عباراته محميٌّ لا يُمسّ، وما بلغها من البدائل
   مأذونٌ به. أي رقمٍ ثانٍ هنا كان سيكون ذوقي لا قياسه. */
export const OWN_FLOOR = 3

/* المرشحون. `kind` يحدّد كيف يُحذف لا مجرد وسمٍ للعرض:
     matrix    ــ فعل تقريرٍ يجرّ «أنّ»؛ يُحذف الفعلُ و«أنّ» معاً وإلا بقيت
                  «أن» معلّقةً في أول الجملة (وهي صفر في أرشيفه).
     opener    ــ فعل التعريف المدرسي في مطلع الفقرة؛ حذفه يترك جملةً اسمية
                  صحيحة تماماً: «يعد التعليم مهماً» ← «التعليم مهم».
     connector ــ رابطٌ في مطلع الجملة يُحذف مع فاصلته.
     flourish  ــ زخرفةٌ بلا معلومة تُحذف من داخل الجملة.
   و`swap` اقتراحٌ لا أمر: إن لم يبلغ البديل عتبته في متنه سقط إلى الحذف. */
export const MIMIC_CANDIDATES = [
  { id: 'no-doubt', phrase: 'مما لا شك فيه', kind: 'matrix', reason: 'توكيدٌ خطابيّ يفتتح به النموذج ولا يفتتح به هو' },
  { id: 'no-doubt-2', phrase: 'لا شك', kind: 'matrix', reason: 'توكيدٌ خطابيّ لا يرد في أرشيفه' },
  { id: 'no-doubt-3', phrase: 'لا ريب', kind: 'matrix', reason: 'توكيدٌ خطابيّ لا يرد في أرشيفه' },
  { id: 'certain', phrase: 'من المؤكد', kind: 'matrix', reason: 'جزمٌ لفظيّ لا يستعمله' },
  { id: 'known', phrase: 'من المعلوم', kind: 'matrix', reason: 'صيغة تقريرٍ مدرسية' },
  { id: 'hidden', phrase: 'لا يخفى على أحد', kind: 'matrix', reason: 'خطابةٌ لا ترد عنده' },
  { id: 'worth', phrase: 'من الجدير بالذكر', kind: 'matrix', reason: 'حشو تقريرٍ صحفي' },
  { id: 'worth-2', phrase: 'الجدير بالذكر', kind: 'matrix', reason: 'حشو تقريرٍ صحفي' },
  { id: 'point-out', phrase: 'تجدر الإشارة إلى', kind: 'matrix', reason: 'حشو تقريرٍ صحفي' },
  { id: 'noted', phrase: 'من الملاحظ', kind: 'matrix', reason: 'صيغة تقريرٍ باردة' },
  { id: 'can-say', phrase: 'يمكن القول', kind: 'matrix', reason: 'إعلانُ رأيٍ قبل قوله؛ عنده الفكرة تُقال لا تُعلَن' },
  { id: 'can-say-2', phrase: 'يمكننا القول', kind: 'matrix', reason: 'إعلانُ رأيٍ قبل قوله' },
  { id: 'i-see', phrase: 'أرى', kind: 'matrix', reason: 'صوتٌ فرديّ؛ صوته جمعيّ («أرى أنّ» مرتان في ٥٣ ألف كلمة)' },
  { id: 'i-think', phrase: 'أعتقد', kind: 'matrix', reason: 'صوتٌ فرديّ؛ صوته جمعيّ' },
  { id: 'i-think-2', phrase: 'أظن', kind: 'matrix', reason: 'صوتٌ فرديّ؛ صوته جمعيّ' },

  { id: 'copula-1', phrase: 'يعد', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي؛ الحَكَم نفسه يخصم عليه' },
  { id: 'copula-2', phrase: 'تعد', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي' },
  { id: 'copula-3', phrase: 'يعتبر', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي' },
  { id: 'copula-4', phrase: 'تعتبر', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي' },
  { id: 'copula-5', phrase: 'يشكل', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي' },
  { id: 'copula-6', phrase: 'تشكل', kind: 'opener', reason: 'افتتاحٌ تعريفيّ مدرسي' },

  { id: 'in-closing', phrase: 'في الختام', kind: 'connector', reason: 'إعلانُ خاتمة؛ خاتمته تفتح ولا تُعلن عن نفسها' },
  { id: 'in-closing-2', phrase: 'في الخاتمة', kind: 'connector', reason: 'إعلانُ خاتمة' },
  { id: 'in-closing-3', phrase: 'خلاصة القول', kind: 'connector', reason: 'إعلانُ خاتمة' },
  { id: 'in-closing-4', phrase: 'في نهاية المطاف', kind: 'connector', reason: 'إعلانُ خاتمة' },
  { id: 'in-closing-5', phrase: 'في الأخير', kind: 'connector', reason: 'إعلانُ خاتمة' },
  { id: 'moreover', phrase: 'بالإضافة إلى ذلك', kind: 'connector', swap: 'ثم', reason: 'رابطُ قوائم؛ رابطه «ثم» (٦٩ مرة في متنه)' },
  { id: 'moreover-2', phrase: 'علاوة على ذلك', kind: 'connector', swap: 'ثم', reason: 'رابطُ قوائم' },
  { id: 'moreover-3', phrase: 'أضف إلى ذلك', kind: 'connector', swap: 'ثم', reason: 'رابطُ قوائم' },
  { id: 'otherhand', phrase: 'من ناحية أخرى', kind: 'connector', swap: 'في المقابل', reason: 'رابطُ مقابلةٍ إنشائي' },
  { id: 'otherhand-2', phrase: 'على الجانب الآخر', kind: 'connector', swap: 'في المقابل', reason: 'رابطُ مقابلةٍ إنشائي' },
  { id: 'context', phrase: 'في هذا السياق', kind: 'connector', reason: 'رابطٌ إداريّ لا يرد عنده' },
  { id: 'context-2', phrase: 'في هذا الإطار', kind: 'connector', reason: 'رابطٌ إداريّ لا يرد عنده' },
  { id: 'based-on', phrase: 'بناء على ما سبق', kind: 'connector', reason: 'رابطُ تقريرٍ إداري' },
  { id: 'based-on-2', phrase: 'استنادا إلى ما سبق', kind: 'connector', reason: 'رابطُ تقريرٍ إداري' },
  { id: 'based-on-3', phrase: 'ونستنتج من ذلك', kind: 'connector', reason: 'رابطُ تقريرٍ إداري' },
  { id: 'today-1', phrase: 'في وقتنا الحاضر', kind: 'temporal', swap: 'اليوم', reason: 'ظرفٌ منفوخ؛ يقولها «اليوم» (٥٧ مرة)' },
  { id: 'today-2', phrase: 'في عصرنا الراهن', kind: 'temporal', swap: 'اليوم', reason: 'ظرفٌ منفوخ' },
  { id: 'today-3', phrase: 'في العصر الراهن', kind: 'temporal', swap: 'اليوم', reason: 'ظرفٌ منفوخ' },
  { id: 'today-4', phrase: 'في عالم اليوم', kind: 'temporal', swap: 'اليوم', reason: 'ظرفٌ منفوخ' },

  { id: 'optimal', phrase: 'بالشكل الأمثل', kind: 'flourish', reason: 'زخرفةٌ بلا معلومة' },
  { id: 'optimal-2', phrase: 'على أكمل وجه', kind: 'flourish', reason: 'زخرفةٌ بلا معلومة' },
  { id: 'optimal-3', phrase: 'على أتم وجه', kind: 'flourish', reason: 'زخرفةٌ بلا معلومة' },
  { id: 'inevitably', phrase: 'لا محالة', kind: 'flourish', reason: 'زخرفةٌ بلا معلومة' },
  { id: 'greatly', phrase: 'بشكل كبير', kind: 'flourish', reason: 'مبالغةٌ بلا قياس' },
  { id: 'greatly-2', phrase: 'بشكل ملحوظ', kind: 'flourish', reason: 'مبالغةٌ بلا قياس' },
  { id: 'greatly-3', phrase: 'بصورة كبيرة', kind: 'flourish', reason: 'مبالغةٌ بلا قياس' },
  { id: 'greatly-4', phrase: 'إلى حد كبير', kind: 'flourish', reason: 'مبالغةٌ بلا قياس' },
  { id: 'all-of-it', phrase: 'بأكمله', kind: 'flourish', reason: 'توكيدٌ فائض' },

  /* ★ ما يعتبره الحَكَم قاطعاً (BANNED_PHRASES · BANNED_VOICE) ولم يكن للمحاكاة
     علمٌ به: كان الحَكَم يقول «هذه عبارةُ نموذجٍ آلي، الدرجة مسقوفة عند ٥٥»
     والمحاكاة لا تسمع. فما كان منها قابلاً للحذف الآمن أُدرج هنا، وما لم يكن
     (استعارةٌ أو مفعولٌ به لا يُنزع بلا كسر) يُرفع للدكتور باسمه وموضعه. */
  /* «الأمر الذي يجعل» ليست رابط مطلعٍ يُحذف: ما بعدها معمولٌ لها، فحذفها
     يترك «لكل طالب، العملية التعليمية أكثر فعالية» — جملةً معلّقة. جرّبناها
     فكسرت، فرُفعت إلى قائمة «تحتاج يدك». */
  { id: 'cannot-deny', phrase: 'لا يمكن إنكار', kind: 'matrix', reason: 'توكيدٌ خطابيّ يرصده الحَكَم قاطعاً' },
  { id: 'important-note', phrase: 'من المهم أن نشير', kind: 'matrix', reason: 'إعلانُ أهميةٍ قبل قولها' },
  { id: 'as-mentioned', phrase: 'كما ذكرنا سابقا', kind: 'connector', reason: 'إحالةٌ إلى النص نفسه لا يكتبها' },
  { id: 'as-mentioned-2', phrase: 'كما أسلفنا', kind: 'connector', reason: 'إحالةٌ إلى النص نفسه لا يكتبها' },
  { id: 'my-view', phrase: 'في تقديري', kind: 'connector', reason: 'صوتٌ فرديّ يرصده الحَكَم قاطعاً' },
  { id: 'my-view-2', phrase: 'في رأيي الشخصي', kind: 'connector', reason: 'صوتٌ فرديّ يرصده الحَكَم قاطعاً' },
  { id: 'my-view-3', phrase: 'في رأيي', kind: 'connector', reason: 'صوتٌ فرديّ يرصده الحَكَم قاطعاً' },
  { id: 'wrote-before', phrase: 'وقد كتبت من قبل', kind: 'connector', reason: 'قالبُ الإحالة إلى مقالاته — وهو عين ما اشتكى منه' },
  { id: 'wrote-before-2', phrase: 'كتبت سابقا', kind: 'connector', reason: 'قالبُ الإحالة إلى مقالاته' },
  { id: 'wrote-before-3', phrase: 'في مقالي السابق', kind: 'connector', reason: 'قالبُ الإحالة إلى مقالاته' },
  { id: 'wrote-before-4', phrase: 'في مقال سابق', kind: 'connector', reason: 'قالبُ الإحالة إلى مقالاته' },
  { id: 'without-doubt', phrase: 'دون أدنى شك', kind: 'flourish', reason: 'توكيدٌ فائض' },
]

/* المرساة: أين يُقبل هذا النوع من العبارات في النص. */
const ANCHORS = {
  opener: `(?:^|(?<=\\n))[ \\t]*`,
  connector: `(?:^|(?<=\\n)|(?<=[.؟!…]\\s)|(?<=[.؟!…]\\s\\s)|(?<=[،؛]\\s))[ \\t]*`,
}

/* ★ القاعدة التي سقط فيها القياس أول مرة: المرشّح يُقاس **في السياق الذي
   سيُعدَّل فيه**، لا ككلمةٍ مجردة. «يعد» وحدها ترد ٢١ مرة في أرشيفه — لكنها
   في مطلع الفقرة تعريفاً مدرسياً ترد ثلاث مرات فقط. ولو قِسناها مجردةً
   لحَمَينا العيبَ الذي جاء الفاحص لأجله. وكذلك «أرى» سبعُ مراتٍ فعلاً
   للرؤية، و«أرى أنّ» مرتان — والمقصود الثانية. */
export function contextSource(candidate) {
  const body = flexBody(candidate.phrase)
  switch (candidate.kind) {
    case 'matrix':
      return `(?<![${AR}])([وف])?${body}\\s+(?:بأنّ?|أنّ?|إنّ?)\\s+(?=([^\\s]+))`
    case 'opener':
      return `${ANCHORS.opener}${body}(?![${AR}])\\s+(?=[${AR}])`
    case 'connector':
      return `${ANCHORS.connector}([وف])?${body}(?![${AR}])[،؛]?\\s+`
    case 'temporal':
      return `\\s*(?<![${AR}])([وف])?${body}(?![${AR}])`
    default:
      return `\\s*${flexPattern(candidate.phrase)}`
  }
}

/* وزنُ كل مرشحٍ على أرشيفه: هذا هو الفرق بين مسطرةٍ وذوق. */
export function buildMimicLexicon(archive = []) {
  const corpus = bareText((Array.isArray(archive) ? archive : [])
    .map((item) => (typeof item === 'string' ? item : String(item?.body || '')))
    .join('\n\n'))
  const corpusWords = countWords(corpus)
  const measured = corpusWords >= 2000

  const bare = new Map()
  const countBare = (phrase) => {
    if (!phrase) return 0
    if (!bare.has(phrase)) bare.set(phrase, countMatches(corpus, flexPattern(phrase)))
    return bare.get(phrase)
  }

  const rules = []
  const guarded = []
  for (const candidate of MIMIC_CANDIDATES) {
    /* بلا أرشيفٍ حاضر لا نلمس شيئاً: القياس شرط العمل لا زينته. */
    if (!measured) continue
    const source = contextSource(candidate)
    const own = countMatches(corpus, source)
    if (own >= OWN_FLOOR) {
      guarded.push({ ...candidate, own, bare: countBare(candidate.phrase) })
      continue
    }
    const swapCount = candidate.swap ? countBare(candidate.swap) : 0
    rules.push({
      ...candidate,
      own,
      swap: candidate.swap && swapCount >= OWN_FLOOR ? candidate.swap : null,
      swapRejected: candidate.swap && swapCount < OWN_FLOOR ? candidate.swap : null,
      swapCount,
      source,
    })
  }
  return { rules, guarded, corpusWords, measured }
}

/* ---------- ٢) البوابات: هل بقيت الجملة عربية؟ ---------- */

const tokensOf = (text) => bareText(String(text)).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean)

/* بوابةُ التعديل الواحد تحاسب على الأعراض الخمسة كلها: تعديلي أنا لا يجوز أن
   يخلّف «أنّ» معلّقة. أما الحكم على النص كاملاً بعد الصقل فيُسقِط `dangling`،
   لأن كسر الجملة الطويلة عند مفصله يُنشئ جملاً تبدأ بـ«وأن…» — وهي وصلته
   المقصودة نفسها، ٩٦ مرة في أرشيفه. لا نعاقب النص على أنه صار يشبهه. */
const GATE_KEYS = ['dangling', 'doubled', 'doubledPreposition', 'orphans', 'stackedConnectives']
const VETO_KEYS = ['doubled', 'doubledPreposition', 'orphans', 'stackedConnectives']

const BREACH_LABEL = {
  dangling: 'يترك «أنّ» معلّقةً في أول الجملة',
  doubled: 'يكرّر كلمةً مرتين متلاصقتين',
  doubledPreposition: 'يكرّر حرف الجر',
  orphans: 'يُخلّف حرفاً يتيماً من كلمةٍ مقطوعة',
  stackedConnectives: 'يرصّ رابطين متتاليين',
}

const NUMBERS_OF = (text) => (String(text).match(/[\d٠-٩]+(?:[.,][\d٠-٩]+)?/g) || []).join('|')

/* بوابةُ المعنى: لا تدخل النصَّ كلمةٌ ليست فيه أصلاً إلا البديل المأذون به.
   بلا هذه البوابة تصير المحاكاة باباً خلفياً لاختراع المعلومات باسمه. */
const unglue = (token) => (/^[وف][\p{L}]{2,}$/u.test(token) ? token.slice(1) : token)

function contentGuard(before, after, allowed = []) {
  const permitted = new Set(tokensOf(allowed.join(' ')).flatMap((token) => [token, unglue(token)]))
  const source = new Set(tokensOf(before).flatMap((token) => [token, unglue(token)]))
  for (const token of tokensOf(after)) {
    /* «وهذا» بعد حذف «مما لا شك فيه أن» ليست كلمةً جديدة: هي «هذا» نفسها
       وقد لحقتها واوُ العطف التي كانت في النص أصلاً. */
    if (source.has(token) || source.has(unglue(token)) || permitted.has(token) || permitted.has(unglue(token))) continue
    return token
  }
  return ''
}

export function gateEdit(before, after, allowed = []) {
  if (after === before) return { ok: false, reason: 'بلا أثر' }
  if (NUMBERS_OF(before) !== NUMBERS_OF(after)) return { ok: false, reason: 'يمسّ رقماً في النص' }
  const intruder = contentGuard(before, after, allowed)
  if (intruder) return { ok: false, reason: `يُدخل كلمة «${intruder}» ليست في نصك` }
  const shapeBefore = wellFormedness(before)
  const shapeAfter = wellFormedness(after)
  for (const key of GATE_KEYS) {
    if (shapeAfter[key] > shapeBefore[key]) return { ok: false, reason: BREACH_LABEL[key] }
  }
  return { ok: true, reason: '' }
}

/* ---------- ٣) التنظيف بعد الحذف ---------- */

function tidy(text) {
  return String(text)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([،؛.؟!])/g, '$1')
    .replace(/([،؛])\s*\1+/g, '$1')
    .replace(/^[ \t]*[،؛]\s*/gm, '')
    .replace(/([.؟!…])\s*[،؛]\s*/g, '$1 ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()
}

/* ---------- ٤) التحويلات، موضعاً موضعاً ---------- */

const paragraphIndexAt = (text, offset) => text.slice(0, offset).split(/\n{2,}/).length

/* كل موضعٍ يُجرَّب وحده: نبني النص كاملاً بعد التعديل، ونمرّره على البوابات،
   فإن سقط تركنا الموضع كما هو وكتبنا السبب. لا تعديل جماعيّ أعمى. */
function applyRule(text, source, replacer, meta, log) {
  const pattern = new RegExp(source, 'gu')
  let out = text
  let cursor = 0
  let guard = 0
  while (guard++ < 60) {
    pattern.lastIndex = cursor
    const match = pattern.exec(out)
    if (!match) break
    const sentenceEnd = (() => {
      const rest = out.slice(match.index + match[0].length)
      const stop = rest.search(/[.؟!]/u)
      return stop < 0 ? rest : rest.slice(0, stop)
    })()
    const replacement = replacer(match, { tail: sentenceEnd })
    if (replacement === null) { cursor = match.index + match[0].length; continue }
    const candidate = tidy(out.slice(0, match.index) + replacement + out.slice(match.index + match[0].length))
    const verdict = gateEdit(out, candidate, [replacement, meta.swap || ''])
    const entry = {
      kind: meta.kind,
      from: match[0].replace(/\s+/g, ' ').trim(),
      to: replacement.replace(/\s+/g, ' ').trim(),
      reason: meta.reason,
      paragraph: paragraphIndexAt(out, match.index),
    }
    if (verdict.ok) {
      log.changes.push(entry)
      out = candidate
      cursor = Math.max(0, match.index)
    } else {
      log.skipped.push({ ...entry, reason: `تُركت كما هي: التعديل ${verdict.reason}` })
      cursor = match.index + match[0].length
    }
  }
  return out
}

export function mimicVoice(text, rawDna, options = {}) {
  const dna = resolveStyleDna(rawDna)
  const original = String(text || '')
  const log = { changes: [], skipped: [] }
  if (!original.trim()) return { text: '', changes: [], skipped: [], pending: [], applied: false, before: null, after: null, note: '' }

  const lexicon = options.lexicon || buildMimicLexicon(options.archive || [])
  const orthography = options.orthography || null
  const judgeOptions = { orthography, threshold: options.threshold || 80 }
  const before = judgeStyle(original, dna, judgeOptions)

  let working = tidy(original)

  /* ★ النقطة الثابتة: كسرُ الجملة الطويلة يُنشئ حدود جملٍ جديدة، فيصير رابطٌ
     كان في وسط الجملة رابطاً في مطلعها — وهو موضعٌ يخصّه علاجٌ آخر. فبدل أن
     نترك الدكتور يضغط الزر مرتين ليرى نتيجتين، ندور حتى يستقرّ النص (يستقرّ
     في دورتين على أرشيفه كله، والحدّ ثلاث). */
  const transformOnce = (input) => {
    let working = tidy(input)
    const rulesOf = (kind) => lexicon.rules.filter((item) => item.kind === kind)

    /* ١ ــ أفعال التقرير مع «أنّ»: يُحذف الفعلُ و«أنّ» معاً، وتبقى واو العطف
       ملتصقةً بما بعدها. والحارس: اسمٌ منوّنٌ بالنصب بعد «أنّ» يعني أن حذفها
       يكسر إعرابه، فنمتنع ونقول لماذا. */
    for (const rule of rulesOf('matrix')) {
      working = applyRule(working, rule.source, (match, context) => {
        const next = match[2] || ''
        /* اسمٌ منوّنٌ بالنصب بعد «أنّ»: حذفها يكسر إعرابه. */
        /* الرمز هروبياً لا حرفياً: حارس التنوين يفحص هذا الملف نفسه، وكتابة
           التنوين قبل الألف فيه توقف النشر. \u064B تنوين فتح · \u064D كسر. */
        if (/(?:ا\u064B|\u064Bا|\u064D)$/u.test(next)) return null
        /* ★ والأدقّ: «وأنّ» معطوفةٌ بعدها في الجملة نفسها. «يمكن القول إن كذا،
           وأن الأمر يتوقف…» — حذف «إنّ» وحدها يترك المعطوف بلا معطوفٍ عليه،
           والعطبُ لا يظهر إلا بعد كسر الجملة الطويلة، أي بعد فوات البوابة. */
        if (/(?<![\p{L}\p{M}])(?:وأنّ?|وأنه|وأنها)(?![\p{L}\p{M}])/u.test(context.tail)) return null
        return match[1] || ''
      }, rule, log)
    }

    /* ٢ ــ فعل التعريف المدرسي في مطلع الفقرة: حذفه يترك جملةً اسمية سليمة
       («يعد التعليم مهماً» ← «التعليم مهم»)، وهو عين ما يخصم عليه الحَكَم. */
    for (const rule of rulesOf('opener')) {
      working = applyRule(working, rule.source, () => '', rule, log)
    }

    /* ٣ ــ روابط مطلع الجملة (وبعد الفاصلة): البديل المقيس أولاً، فإن ردّته
       البوابة فالحذف — ولا يُترك الحشو لأن البديل تعثّر. */
    for (const rule of rulesOf('connector')) {
      if (rule.swap) working = applyRule(working, rule.source, (match) => `${match[1] || ''}${rule.swap}، `, rule, log)
      working = applyRule(working, rule.source, (match) => match[1] || '', rule, log)
    }

    /* ٤ ــ الظرف المنفوخ داخل الجملة: «في وقتنا الحاضر» ← «اليوم» (٥٧ مرة عنده). */
    for (const rule of rulesOf('temporal')) {
      if (rule.swap) working = applyRule(working, rule.source, (match) => ` ${match[1] || ''}${rule.swap}`, rule, log)
      working = applyRule(working, rule.source, (match) => (match[1] ? ` ${match[1]}` : ''), rule, log)
    }

    /* ٥ ــ الزخرفة داخل الجملة. */
    for (const rule of rulesOf('flourish')) {
      working = applyRule(working, rule.source, () => '', rule, log)
    }

    /* ٦ ــ الإملاء بشهادة أرشيفه — بحدودٍ عربية لا بـ`\b` الميتة. */
    if (orthography && orthography.size) {
      for (const slip of orthographySlips(working, orthography)) {
        const source = flexPattern(slip.word)
        working = applyRule(working, source, () => slip.fixed, {
          kind: 'orthography',
          reason: `أرشيفك يكتبها «${slip.fixed}» (${slip.archiveRight} مرة) لا «${slip.word}»`,
        }, log)
      }
    }

    return working
  }

  /* الوقفة والانقلاب والفقرة تُطبَّق بعد كل دورة: ترقيمٌ حتميّ لا يضيف حرفاً
     ولا يحذفه، وهو ما يفتح للدورة التالية مواضعَ لم تكن ظاهرة. */
  let settled = tidy(original)
  for (let round = 0; round < 3; round += 1) {
    const next = refineToStyle(transformOnce(settled), dna)
    if (next === settled) break
    settled = next
  }
  const polished = settled

  const after = judgeStyle(polished, dna, judgeOptions)

  /* البوابة الأخيرة: محاكاةٌ تخفض الدرجة أو تكسر التركيب تُلغى كلها. لا يُسلَّم
     نصٌّ أسوأ مما دخل. */
  const shapeBefore = wellFormedness(original)
  const shapeAfter = wellFormedness(polished)
  const broke = VETO_KEYS.some((key) => shapeAfter[key] > shapeBefore[key])
  if (broke || after.score < before.score) {
    return {
      text: original,
      changes: [],
      skipped: log.skipped,
      pending: [],
      applied: false,
      before,
      after: before,
      note: broke
        ? 'أُلغيت المحاكاة كاملةً: التعديلات كانت ستكسر تركيب جملةٍ عربية. نصك كما هو.'
        : `أُلغيت المحاكاة: كانت ستنزل بالمطابقة من ${before.score}٪ إلى ${after.score}٪. نصك كما هو.`,
    }
  }

  /* ما بقي من قائمة الحَكَم القاطعة بعد كل ما استطعناه: يُرفع باسمه وموضعه
     ولا يُمسّ. «ثورة حقيقية» و«يلعب دوراً هاماً» مفعولاتٌ ونعوتٌ لا تُنزع من
     الجملة بلا كسرها، ولا بديل لها مقيسٌ في متنه — فالقرار قراره لا قراري. */
  const stillBanned = []
  for (const phrase of [...(dna.banned || []), ...(dna.bannedVoice || [])]) {
    const pattern = new RegExp(flexPattern(phrase), 'gu')
    const match = pattern.exec(polished)
    if (!match) continue
    const sentence = sentencesOf(polished).find((item) => new RegExp(flexPattern(phrase), 'u').test(item)) || ''
    stillBanned.push({
      phrase,
      sentence: sentence.trim().slice(0, 160),
      paragraph: paragraphIndexAt(polished, match.index),
      reason: 'يعتبرها الحَكَم قاطعةً، ولا حذف آمن لها آلياً — أعد صياغة الجملة بيدك.',
    })
  }

  const marks = {
    ellipsis: articleMetrics(polished).ellipsis - articleMetrics(original).ellipsis,
    medianSentence: articleMetrics(polished).medianSentence - articleMetrics(original).medianSentence,
    paragraphs: paragraphsOf(polished).length - paragraphsOf(original).length,
  }

  return {
    text: polished,
    changes: log.changes,
    skipped: log.skipped,
    pending: stillBanned,
    applied: polished !== original,
    before,
    after,
    marks,
    note: log.changes.length
      ? ''
      : 'لم تُوجد عبارةٌ دخيلة تستحق الحذف؛ اقتصر العمل على الوقفات والإيقاع.',
  }
}

export { wellFormedness }

export default mimicVoice
