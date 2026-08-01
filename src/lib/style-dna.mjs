/* بصمة الأسلوب — قياسٌ رقميّ لأسلوب الدكتور من أرشيفه، ثم حَكَمٌ يفرضه على كل
   نصٍّ يُكتب باسمه.

   لماذا وُجد هذا الملف: كان المقال يُكتب بتعليماتٍ وصفية («عربية بيضاء فكرية»)
   وهي لا تصف أحداً. القياس على ١٤٣ مقالاً أظهر أن أسلوبه له بصمةٌ رقمية حادّة
   لا تُشبه ما ينتجه أي نموذج بلا توجيه:

     · نقاط الحذف «…» ٧٤ لكل ألف كلمة — أي نحو ٢٨ في المقال الواحد، في ٩٤٪ من مقالاته.
     · وسيط الجملة ٨ كلمات، و٦٢٪ من جمله تسع كلمات فأقل.
     · ٣٣٪ من فقراته جملةٌ واحدة، ووسيط الفقرة ٢١ كلمة.
     · بنية «…بل» الضدّية ٢٩٨ مرة، في ٦٠٪ من المقالات.
     · المقال ٣٥٠-٤٣٥ كلمة، بلا عناوين فرعية ولا تعداد ولا شرطة اعتراضية.
     · صوتٌ جمعي (نحن · دعونا · نعيش) لا صوت أستاذٍ يقول «أرى» أو «في تقديري».

   الوحدة هنا مقصودة: الخادم والواجهة يقيسان بالمسطرة نفسها، فلا يمدح أحدهما
   ما يرفضه الآخر. */

/* ---------- أدوات نصية ---------- */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/gu

export const stripTashkeel = (value = '') => String(value).replace(TASHKEEL, '')

export const bareText = (value = '') => stripTashkeel(value)
  .replace(/[أإآٱ]/gu, 'ا')
  .replace(/ى/gu, 'ي')

export const wordsOf = (value = '') => String(value).trim().split(/\s+/).filter(Boolean)
export const countWords = (value = '') => wordsOf(value).length

/* الجملة عنده تنتهي بنقطة أو تعجّب أو سؤال أو «…» — ونقاط الحذف عنده وقفةٌ
   حقيقية لا زخرفة، فتُعدّ فاصلاً. */
export const sentencesOf = (value = '') => String(value)
  .replace(/\s+/g, ' ')
  .split(/(?<=[.!؟…])\s+/)
  .map((part) => part.trim())
  .filter(Boolean)

/* جُرّب فصل «الجملة البنيوية» (نقطة/تعجّب/سؤال فقط) عن الوقفة، فانهار القياس:
   وسيط «جملته» صار ٧١ كلمة لأن «…» هي فاصله الحقيقي لا زخرفةً فوق النقطة.
   فالقياس يبقى على إيقاعه، ومنعُ حشو الوقفات صار مسؤولية النافذة ذات الطرفين
   في فحص «وقفات …» — وهي تخفض النص المحشو بدل أن ترفعه. */

export const paragraphsOf = (value = '') => String(value)
  .split(/\n\s*\n/)
  .map((part) => part.trim())
  .filter(Boolean)

const percentile = (sorted, ratio) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * ratio)))] : 0
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const round1 = (value) => Math.round(value * 10) / 10
const clampNumber = (value, low, high) => Math.min(high, Math.max(low, value))
const occurrences = (text, pattern) => (String(text).match(pattern) || []).length

/* حدود الكلمة العربية: \b في جافاسكربت لا يرى الحروف العربية، فالمطابقة تتم
   بغياب حرفٍ قبلها وبعدها. */
/* الحركات علاماتٌ تركيبية \p{M} لا حروف \p{L}؛ فبلا استثنائها كان «ثمَّة»
   يُقرأ «ثم» و«بلَغَت» تُقرأ «بل». والمشروع يحفظ نسخةً مشكّلة كاملة. */
const arabicWord = (word) => new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'gu')

/* ---------- عبارات ممنوعة: مقيسةٌ بغيابها عن أرشيفه لا بذوقي ---------- */
/* كل عبارةٍ هنا فُحصت على ١٤٣ مقالاً فلم تَرِد ولا مرة واحدة (أو وردت مرةً
   يتيمة في ٥٣ ألف كلمة). هي لغة النماذج لا لغته. */
export const BANNED_PHRASES = [
  'في الختام', 'في الخاتمة', 'وفي الختام', 'مما لا شك فيه', 'تجدر الإشارة',
  'جدير بالذكر', 'من الجدير بالذكر', 'في عالم اليوم', 'في عصرنا الحالي',
  'في ظل التطور', 'يلعب دوراً', 'يلعب دورا', 'دوراً هاماً', 'دورا هاما',
  'يعد من أهم', 'من أهم العوامل', 'بالإضافة إلى ذلك', 'علاوة على ذلك',
  'من ناحية أخرى', 'في نهاية المطاف', 'وفي نهاية المطاف', 'الأمر الذي يجعل',
  'يمكن القول', 'بناءً على ما سبق', 'وفي هذا السياق', 'تكمن أهمية',
  'لا يمكن إنكار', 'ثورة حقيقية', 'نقلة نوعية', 'حجر الزاوية',
  'بات من الضروري', 'أصبح لزاماً', 'سلاح ذو حدين', 'السيف ذو حدين',
  'خلاصة القول', 'وخلاصة القول', 'في الأخير', 'دعونا نتفق',
  'من المهم أن نشير', 'كما ذكرنا سابقاً', 'كما أسلفنا',
  'صيدة', 'صيد',
]

/* صوتٌ ليس صوته: أستاذٌ يستشهد بنفسه أو يحيل إلى مقالٍ سابق. هذه بالضبط
   الشكوى — «ينقل وينسخ من مقالاتي السابقة». */
export const BANNED_VOICE = [
  'وقد كتبت من قبل', 'كتبت سابقاً', 'كما كتبت في', 'في مقالي السابق',
  'في مقال سابق', 'سبق أن كتبت', 'في تقديري', 'في رأيي الشخصي',
  'من وجهة نظري', 'أرى أن', 'وأرى أن', 'أعتقد أن', 'وأعتقد أن',
]

/* ---------- القياس ---------- */

/* يقبل مصفوفة نصوص أو كائنات {title, body, iso}. */
const bodiesOf = (articles) => (Array.isArray(articles) ? articles : [])
  .map((item) => typeof item === 'string' ? item : String(item?.body || ''))
  .map((body) => body.trim())
  .filter((body) => body.length > 200)

/* ---------- ترجيح الحقبة ----------

   أسلوبه تغيّر، والقياس قاطع. بين ٩٥ مقالاً قبل ٢٠٢٢ و٤٨ مقالاً في ٢٠٢٥-٢٠٢٦:

     وقفات «…» لكل ١٠٠ كلمة   ٩٫٩ ← ٣٫٠   (علامته القديمة، تتراجع)
     «بل» لكل ١٠٠ كلمة        ٠٫١ ← ١٫٤   (علامته اليوم، أربعة عشر ضعفاً)
     الأسئلة في المقال          ١ ← ٤
     وسيط الفقرة              ٦٥ ← ٢٢ كلمة

   البصمة الشاملة كانت تُحاكم مقالاته الحديثة بـ٨٥٪ بينما تستحق ٩٠٪ ببصمة
   حقبتها — أي أن المحرك كان يُملي عليه صوت ٢٠١٧. الترجيح بنصف عمرٍ ثلاث
   سنوات: المقال الأحدث يزن أربعة أضعاف الأقدم، والأرشيف كله يبقى حاضراً. */
const ERA_HALF_LIFE_YEARS = 3
const ERA_MAX_WEIGHT = 4

function eraWeights(articles) {
  const stamps = articles.map((item) => {
    const iso = typeof item === 'string' ? '' : String(item?.iso || item?.date || '')
    const year = Number(String(iso).slice(0, 4))
    return Number.isFinite(year) && year > 1990 && year < 2100 ? year + (Number(String(iso).slice(5, 7)) || 6) / 12 : null
  })
  const newest = stamps.filter((value) => value !== null).sort((a, b) => b - a)[0]
  if (!newest) return stamps.map(() => 1)
  return stamps.map((value) => {
    if (value === null) return 1
    const age = Math.max(0, newest - value)
    return Math.max(1, Math.round(ERA_MAX_WEIGHT * Math.pow(.5, age / ERA_HALF_LIFE_YEARS)))
  })
}

/* التكرار بالوزن: أبسط طريقةٍ صادقة لحساب مئينٍ مرجَّح. */
const weighted = (values, weights) => values.flatMap((value, index) => Array.from({ length: weights[index] || 1 }, () => value))
const wMean = (values, weights) => { const list = weighted(values, weights); return list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0 }
const wPercentile = (values, weights, ratio) => percentile([...weighted(values, weights)].sort((a, b) => a - b), ratio)

export function measureStyleDna(articles) {
  const texts = bodiesOf(articles)
  if (!texts.length) return null
  /* الأوزان تتبع الترتيب نفسه بعد التصفية، فنعيد بناءها على المقبولين. */
  const kept = (Array.isArray(articles) ? articles : []).filter((item) => String(typeof item === 'string' ? item : item?.body || '').trim().length > 200)
  const weights = eraWeights(kept)

  const articleWords = texts.map(countWords).sort((a, b) => a - b)
  const totalWords = articleWords.reduce((sum, value) => sum + value, 0)

  const paragraphs = texts.flatMap(paragraphsOf)
  const paragraphWords = paragraphs.map(countWords).sort((a, b) => a - b)
  const paragraphSentences = paragraphs.map((part) => sentencesOf(part).length)
  const paragraphsPerArticle = texts.map((text) => paragraphsOf(text).length)

  const sentences = texts.flatMap(sentencesOf)
  const sentenceWords = sentences.map(countWords).filter(Boolean).sort((a, b) => a - b)
  const rows = texts.map(articleMetrics)

  const corpus = texts.join('\n\n')
  const bareCorpus = bareText(corpus)
  const per100 = (count) => round1(count / Math.max(1, totalWords) * 100)

  const withAny = (pattern) => Math.round(texts.filter((text) => pattern.test(bareText(text))).length / texts.length * 100)

  const dna = {
    version: 2,
    sampleSize: texts.length,
    totalWords,
    /* كلها مرجَّحةٌ بالحقبة: هذه الأرقام هي ما يُملى على المحرك حرفياً، فلو
       بقيت مجمَّعةً على الأرشيف كله لأملينا عليه صوت ٢٠١٧. */
    article: {
      p10: wPercentile(rows.map((row) => row.words), weights, .1),
      p25: wPercentile(rows.map((row) => row.words), weights, .25),
      median: wPercentile(rows.map((row) => row.words), weights, .5),
      p75: wPercentile(rows.map((row) => row.words), weights, .75),
      p90: wPercentile(rows.map((row) => row.words), weights, .9),
      mean: Math.round(wMean(rows.map((row) => row.words), weights)),
    },
    sentence: {
      mean: round1(mean(sentenceWords)),
      median: wPercentile(rows.map((row) => row.medianSentence), weights, .5),
      p10: percentile(sentenceWords, .1),
      p90: wPercentile(rows.map((row) => row.medianSentence), weights, .9),
      shortRate: Math.round(wMean(rows.map((row) => row.shortRate), weights)),
      longRate: Math.round(wMean(rows.map((row) => row.longSentenceRate), weights)),
    },
    paragraph: {
      mean: Math.round(mean(paragraphWords)),
      median: wPercentile(rows.map((row) => row.medianParagraph), weights, .5),
      p25: percentile(paragraphWords, .25),
      p75: wPercentile(rows.map((row) => row.medianParagraph), weights, .75),
      p90: percentile(paragraphWords, .9),
      singleSentenceRate: Math.round(wMean(rows.map((row) => row.singleRate), weights)),
      twoSentenceRate: Math.round(paragraphSentences.filter((value) => value === 2).length / Math.max(1, paragraphSentences.length) * 100),
      perArticle: Math.round(wMean(paragraphsPerArticle, weights)),
      /* الوسيط لا المتوسط: مقالٌ واحد بتسعٍ وأربعين فقرة يرفع المتوسط إلى
         أحد عشر بينما نصف مقالاته سبع فقرات أو أقل. */
      perArticleMedian: wPercentile(paragraphsPerArticle, weights, .5),
      perArticleP75: wPercentile(paragraphsPerArticle, weights, .75),
    },
    marks: {
      ellipsisPer100: round1(wMean(rows.map((row) => row.ellipsisPer100), weights)),
      ellipsisPerArticle: Math.round(wMean(rows.map((row) => row.ellipsis), weights)),
      questionsPerArticle: round1(wMean(rows.map((row) => row.questions), weights)),
      guillemetsPer100: per100(occurrences(corpus, /«/g)),
      semicolonPer100: per100(occurrences(corpus, /؛/g)),
      emDashPer100: per100(occurrences(corpus, /—/g)),
      shaddaPer100: per100(occurrences(corpus, /ّ/g)),
      commaPer100: per100(occurrences(corpus, /،/g)),
    },
    moves: {
      antithesisPer100: round1(wMean(rows.map((row) => row.antithesisPer100), weights)),
      negationAntithesisPer100: per100(occurrences(bareCorpus, /(?<!\p{L})(?:ليست?|لا)(?!\p{L})[^.!؟…]{0,90}(?<!\p{L})بل(?!\p{L})/gu)),
      collectivePer100: per100(occurrences(bareCorpus, /(?<!\p{L})(?:نحن|نعيش|نحتاج|دعونا|نقول|علينا)(?!\p{L})/gu)),
      articlesWithEllipsis: withAny(/…/u),
      articlesWithAntithesis: withAny(/(?<!\p{L})بل(?!\p{L})/u),
      articlesWithQuestion: withAny(/؟/u),
      articlesWithGuillemets: withAny(/«/u),
    },
    openers: topOpeners(paragraphs),
    closings: closingTaxonomy(texts),
    /* توزيعات المقال الواحد: هذه هي مسطرة الحَكَم. المقياس ليس «هل يطابق
       الوسيط» بل «هل يقع داخل المدى الذي تعيش فيه مقالاته». بلا هذه
       التوزيعات كان الحَكَم يرسب أكثر من ثلثي أرشيفه. */
    perArticle: perArticleBands(rows, weights),
    era: (() => {
      const heavy = weights.filter((w) => w >= ERA_MAX_WEIGHT).length
      return { halfLifeYears: ERA_HALF_LIFE_YEARS, weightedSample: weights.reduce((sum, w) => sum + w, 0), recentArticles: heavy }
    })(),
    banned: BANNED_PHRASES,
    bannedVoice: BANNED_VOICE,
  }
  return dna
}

const bandOf = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p03: percentile(sorted, .03),
    p15: percentile(sorted, .15),
    p35: percentile(sorted, .35),
    p50: percentile(sorted, .5),
    p65: percentile(sorted, .65),
    p85: percentile(sorted, .85),
    p97: percentile(sorted, .97),
  }
}

/* التكرار: مقاييس أضيفت بعد تشغيلٍ حيّ على النموذج المجاني كشف أنه — تحت ضغط
   «زد الوقفات» و«زد الانقلابات» و«أطل النص» — ينحدر إلى لفّ الجمل نفسها، ونال
   ٩٥٪ من الحَكَم قبل هذه الإضافة. والقياس قاطع: الدكتور لا يكرّر إطلاقاً
   (وسيط الجمل المكرّرة ٠٪، وp97 صفر، وأقصى تكرارٍ لجملةٍ عنده مرّتان). */
const repetitionShape = (text) => {
  const normalize = (value) => bareText(value).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim()
  const sentences = sentencesOf(text).map(normalize).filter((item) => countWords(item) >= 5)
  const seenSentences = new Set()
  let duplicateSentences = 0
  let worstRepeat = 0
  const tally = new Map()
  for (const sentence of sentences) {
    if (seenSentences.has(sentence)) duplicateSentences += 1
    seenSentences.add(sentence)
    const count = (tally.get(sentence) || 0) + 1
    tally.set(sentence, count)
    if (count > worstRepeat) worstRepeat = count
  }
  const tokens = normalize(text).split(' ').filter(Boolean)
  const seenGrams = new Set()
  let duplicateGrams = 0
  let totalGrams = 0
  for (let index = 0; index + 8 <= tokens.length; index += 1) {
    const gram = tokens.slice(index, index + 8).join(' ')
    totalGrams += 1
    if (seenGrams.has(gram)) duplicateGrams += 1
    else seenGrams.add(gram)
  }
  return {
    duplicateSentenceRate: sentences.length ? round1(duplicateSentences / sentences.length * 100) : 0,
    duplicateGramRate: totalGrams ? round1(duplicateGrams / totalGrams * 100) : 0,
    lexicalDiversity: tokens.length ? round1(new Set(tokens).size / tokens.length * 100) : 100,
    worstSentenceRepeat: worstRepeat,
  }
}

export function articleMetrics(body) {
  const text = String(body || '')
  const words = countWords(text)
  const sentences = sentencesOf(text)
  const sentenceWords = sentences.map(countWords).filter(Boolean).sort((a, b) => a - b)
  const paragraphs = paragraphsOf(text)
  const paragraphWords = paragraphs.map(countWords).sort((a, b) => a - b)
  const paragraphSentences = paragraphs.map((part) => sentencesOf(part).length)
  const bare = bareText(text)
  return {
    words,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    ellipsis: occurrences(text, /…/g),
    ellipsisPer100: round1(occurrences(text, /…/g) / Math.max(1, words) * 100),
    antithesis: occurrences(bare, arabicWord('بل')),
    antithesisPer100: round1(occurrences(bare, arabicWord('بل')) / Math.max(1, words) * 100),
    questions: occurrences(text, /؟/g),
    collective: occurrences(bare, /(?<!\p{L})(?:نحن|نعيش|نحتاج|دعونا|نقول|علينا|نربي|نصنع|نخاف|نحتفل)(?!\p{L})/gu),
    guillemets: occurrences(text, /«/g),
    medianSentence: percentile(sentenceWords, .5),
    longSentenceRate: Math.round(sentenceWords.filter((value) => value >= 26).length / Math.max(1, sentenceWords.length) * 100),
    shortRate: Math.round(sentenceWords.filter((value) => value <= 9).length / Math.max(1, sentenceWords.length) * 100),
    medianParagraph: percentile(paragraphWords, .5),
    maxParagraph: paragraphWords[paragraphWords.length - 1] || 0,
    singleRate: Math.round(paragraphSentences.filter((value) => value === 1).length / Math.max(1, paragraphSentences.length) * 100),
    firstSentenceWords: countWords(sentences[0] || ''),
    lastSentence: sentences[sentences.length - 1] || '',
    ...repetitionShape(text),
  }
}

function perArticleBands(rows, weights = []) {
  const column = (key) => weighted(rows.map((row) => row[key]), weights)
  return {
    words: bandOf(column('words')),
    ellipsisPer100: bandOf(column('ellipsisPer100')),
    antithesis: bandOf(column('antithesis')),
    questions: bandOf(column('questions')),
    collective: bandOf(column('collective')),
    medianSentence: bandOf(column('medianSentence')),
    shortRate: bandOf(column('shortRate')),
    medianParagraph: bandOf(column('medianParagraph')),
    longSentenceRate: bandOf(column('longSentenceRate')),
    firstSentenceWords: bandOf(column('firstSentenceWords')),
    antithesisPer100: bandOf(column('antithesisPer100')),
    duplicateSentenceRate: bandOf(column('duplicateSentenceRate')),
    duplicateGramRate: bandOf(column('duplicateGramRate')),
    lexicalDiversity: bandOf(column('lexicalDiversity')),
  }
}

/* الصورة السطحية لا المعيارية: التجميع يوحّد «إن/ان» لكن المعروض هو ما كتبه
   هو بالهمزة والتشكيل، وإلا علّمنا النموذج أن يكتب «ان» و«اما». */
function topOpeners(paragraphs) {
  const counts = new Map()
  for (const paragraph of paragraphs) {
    const surface = paragraph.split(/\s+/)[0]?.replace(/[«»"…،.؟!:]/g, '') || ''
    if (stripTashkeel(surface).length < 2) continue
    const key = bareText(surface)
    const entry = counts.get(key) || { count: 0, forms: new Map() }
    entry.count += 1
    entry.forms.set(surface, (entry.forms.get(surface) || 0) + 1)
    counts.set(key, entry)
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 18)
    .map((entry) => ({
      word: [...entry.forms.entries()].sort((left, right) => right[1] - left[1])[0][0],
      count: entry.count,
    }))
}

function closingTaxonomy(texts) {
  let question = 0
  let antithesis = 0
  let appeal = 0
  for (const text of texts) {
    const list = sentencesOf(text)
    const last = bareText(list[list.length - 1] || '')
    if (last.includes('؟')) question += 1
    else if (/(?<!\p{L})بل(?!\p{L})/u.test(last)) antithesis += 1
    else if (/(?<!\p{L})(?:ربما|لعل|نحتاج|علينا|دعونا|فلنبدأ)(?!\p{L})/u.test(last)) appeal += 1
  }
  const total = Math.max(1, texts.length)
  return {
    questionRate: Math.round(question / total * 100),
    antithesisRate: Math.round(antithesis / total * 100),
    appealRate: Math.round(appeal / total * 100),
  }
}

/* بصمةٌ احتياطية بالأرقام المقيسة فعلاً على أرشيفه، تُستعمل حين يتعذّر تمرير
   الأرشيف (طلبٌ قديم من واجهةٍ لم تُحدَّث بعد). ليست تخميناً: هذه مخرجات
   measureStyleDna على ١٤٣ مقالاً بتاريخ ١ أغسطس ٢٠٢٦. */
export const FALLBACK_STYLE_DNA = {
  version: 3,
  sampleSize: 143,
  totalWords: 53431,
  article: { p10: 329, p25: 355, median: 385, p75: 406, p90: 442, mean: 380 },
  sentence: { mean: 9.9, median: 9, p10: 3, p90: 18, shortRate: 51, longRate: 11 },
  paragraph: { mean: 33, median: 45, p25: 9, p75: 62, p90: 73, singleSentenceRate: 24, twoSentenceRate: 29, perArticle: 16, perArticleMedian: 8, perArticleP75: 19 },
  marks: { ellipsisPer100: 5.3, ellipsisPerArticle: 20, questionsPerArticle: 4.4, guillemetsPer100: .5, semicolonPer100: .3, emDashPer100: 0, shaddaPer100: 1.7, commaPer100: 3.5 },
  moves: {
    antithesisPer100: .9, negationAntithesisPer100: .2, collectivePer100: .4,
    articlesWithEllipsis: 94, articlesWithAntithesis: 60, articlesWithQuestion: 79, articlesWithGuillemets: 43,
  },
  openers: [
    { word: 'في', count: 120 }, { word: 'إن', count: 61 }, { word: 'هل', count: 53 },
    { word: 'نحن', count: 29 }, { word: 'أما', count: 25 }, { word: 'بل', count: 25 },
    { word: 'نعم', count: 24 }, { word: 'لكن', count: 22 }, { word: 'دعونا', count: 18 },
  ],
  closings: { questionRate: 8, antithesisRate: 8, appealRate: 4 },
  era: { halfLifeYears: 3, weightedSample: 266, recentArticles: 27 },
  /* مسطرة الحَكَم: توزيع كل مقياسٍ على مقالاته الـ١٤٣ منفردة، **مرجَّحةً
     بالحقبة** (نصف عمرٍ ثلاث سنوات) فتكون بصمة أحمد ٢٠٢٦ لا أحمد ٢٠١٧. */
  perArticle: {
    words: { p03: 278, p15: 340, p35: 363, p50: 385, p65: 394, p85: 430, p97: 452 },
    ellipsisPer100: { p03: 0, p15: .8, p35: 1.7, p50: 4.9, p65: 6, p85: 11.7, p97: 14.5 },
    antithesis: { p03: 0, p15: 0, p35: 2, p50: 3, p65: 5, p85: 6, p97: 11 },
    antithesisPer100: { p03: 0, p15: 0, p35: .5, p50: .9, p65: 1.2, p85: 1.7, p97: 2.7 },
    questions: { p03: 0, p15: 0, p35: 2, p50: 3, p65: 4, p85: 10, p97: 13 },
    collective: { p03: 0, p15: 0, p35: 1, p50: 1, p65: 2, p85: 4, p97: 5 },
    medianSentence: { p03: 5, p15: 6, p35: 7, p50: 9, p65: 11, p85: 17, p97: 25 },
    shortRate: { p03: 11, p15: 20, p35: 40, p50: 54, p65: 68, p85: 76, p97: 85 },
    medianParagraph: { p03: 8, p15: 10, p35: 26, p50: 45, p65: 54, p85: 69, p97: 86 },
    longSentenceRate: { p03: 0, p15: 0, p35: 3, p50: 5, p65: 12, p85: 21, p97: 47 },
    firstSentenceWords: { p03: 2, p15: 4, p35: 7, p50: 9, p65: 11, p85: 18, p97: 50 },
    duplicateSentenceRate: { p03: 0, p15: 0, p35: 0, p50: 0, p65: 0, p85: 0, p97: 0 },
    duplicateGramRate: { p03: 0, p15: 0, p35: 0, p50: 0, p65: 0, p85: 0, p97: 0 },
    lexicalDiversity: { p03: 65.9, p15: 69.1, p35: 71, p50: 72.9, p65: 74.5, p85: 76.7, p97: 80.1 },
  },
  banned: BANNED_PHRASES,
  bannedVoice: BANNED_VOICE,
}

/* بصمةٌ واصلةٌ بلا مسطرة (واجهةٌ قديمة أو حمولةٌ مبتورة) تُكمَّل من المقيسة،
   فلا يسقط الحَكَم ولا يمرّ نصٌّ بلا قياس. */
export const resolveStyleDna = (dna) => {
  if (!dna || typeof dna !== 'object' || Array.isArray(dna)) return FALLBACK_STYLE_DNA
  /* الإكمال حقلاً حقلاً: حمولةٌ مبتورة (واجهة قديمة أو JSON مقصوص) كانت تعبر
     الفحص الثلاثي ثم تُسقط styleBrief بخطأ ٥٠٠ عارٍ. */
  const merged = { ...FALLBACK_STYLE_DNA, ...dna }
  for (const key of ['article', 'sentence', 'paragraph', 'marks', 'moves', 'closings']) {
    merged[key] = { ...FALLBACK_STYLE_DNA[key], ...(dna[key] && typeof dna[key] === 'object' ? dna[key] : {}) }
  }
  merged.perArticle = { ...FALLBACK_STYLE_DNA.perArticle }
  if (dna.perArticle && typeof dna.perArticle === 'object') {
    for (const [key, band] of Object.entries(dna.perArticle)) {
      if (band && typeof band === 'object' && typeof band.p50 === 'number') {
        merged.perArticle[key] = { ...FALLBACK_STYLE_DNA.perArticle[key], ...band }
      }
    }
  }
  merged.openers = Array.isArray(dna.openers) && dna.openers.length ? dna.openers : FALLBACK_STYLE_DNA.openers
  merged.banned = Array.isArray(dna.banned) && dna.banned.length ? dna.banned : BANNED_PHRASES
  merged.bannedVoice = Array.isArray(dna.bannedVoice) && dna.bannedVoice.length ? dna.bannedVoice : BANNED_VOICE
  merged.sampleSize = Number(dna.sampleSize) > 0 ? Number(dna.sampleSize) : FALLBACK_STYLE_DNA.sampleSize
  return merged
}

/* ---------- الوصفة التي تُملى على المحرك ---------- */

/* أرقامٌ لا صفات. النموذج لا يعرف «العربية البيضاء»، لكنه يعرف «وسيط الجملة
   ثماني كلمات» و«ثماني وقفات … على الأقل». */
export function styleBrief(rawDna, targetWords = 400) {
  const dna = resolveStyleDna(rawDna)
  const ellipsis = Math.max(6, Math.round(dna.marks.ellipsisPer100 * targetWords / 100 * .55))
  const antithesis = Math.max(2, Math.round(dna.moves.antithesisPer100 * targetWords / 100))
  const questions = Math.max(2, Math.round(dna.marks.questionsPerArticle * .8))
  const scale = targetWords / Math.max(200, dna.article.median || 386)
  const paragraphsLow = Math.max(6, Math.round((dna.paragraph.perArticleMedian || 7) * scale))
  const paragraphsHigh = Math.max(paragraphsLow + 3, Math.round((dna.paragraph.perArticleP75 || 10) * scale))
  const openers = (dna.openers || []).map((item) => item.word).filter((word) => word.length >= 2).slice(0, 10)
  return [
    `بصمة الكاتب مقيسةٌ رقمياً من ${dna.sampleSize} مقالاً منشوراً له. التزمها رقماً رقماً؛ النص الذي يخالف هذه الأرقام ليس نصّه ويُرفض آلياً:`,
    `١) الجملة قصيرة: وسيطها ${dna.sentence.median} كلمات، و${dna.sentence.shortRate}٪ من جمله تسع كلمات فأقل. امنع الجمل الطويلة المركّبة؛ لا تتجاوز جملةٌ ${Math.max(22, dna.sentence.p90 + 3)} كلمة إلا نادراً.`,
    `٢) نقاط الحذف «…» علامته الأولى: استعملها ${ellipsis} مرة على الأقل، وقفةً قبل الانقلاب لا زخرفةً. تلتصق بما قبلها وتليها مسافة: «لأنهم عاجزون… بل لأن أحداً أقنعهم».`,
    `٣) البناء الضدّي «…بل»: ${antithesis} مرات لا أكثر، في مواضع انقلابٍ حقيقي بصيغة «ليس كذا… بل كذا». رشُّها في كل فقرة تقليدٌ ميكانيكي يُرفض؛ أقصى ما بلغه في مقالٍ كامل ${dna.perArticle?.antithesisPer100?.p97 ?? 2.3} لكل مئة كلمة.`,
    `٤) الفقرات ${paragraphsLow}-${paragraphsHigh} فقرة متفاوتة الطول، و${dna.paragraph.singleSentenceRate}٪ من فقراته جملةٌ واحدة: ضع فقرةً من سطرٍ واحد بين الفقرات الأطول.`,
    `٥) الأسئلة البلاغية ${questions} على الأقل، موزّعة لا متراكمة، وواحدٌ منها يصلح خاتمة.`,
    `٦) الصوت جمعيّ: «نحن» و«دعونا» و«علينا» و«نعيش». ممنوع منعاً باتاً: «أرى» و«في تقديري» و«من وجهة نظري» و«كتبتُ سابقاً» وأي إحالةٍ إلى مقالٍ سابق له.`,
    `٧) الاقتباس داخل النص بين «…» لا بعلامات لاتينية. ممنوع: الشرطة الاعتراضية —، والعناوين الفرعية، والتعداد النقطي أو الرقمي، والرموز التعبيرية، وعلامات ماركداون.`,
    `٨) الطول ${targetWords} كلمة تقريباً (مداه الطبيعي ${dna.article.p25}-${dna.article.p90}).`,
    `٩) الخاتمة تنقلب أو تسأل، ولا تلخّص: ${dna.closings.questionRate}٪ من خواتيمه سؤال و${dna.closings.antithesisRate}٪ انقلابٌ بـ«بل». ممنوع «في الختام» و«خلاصة القول» وكل عبارةٍ تعلن أنها خاتمة.`,
    `١٠) الافتتاح مشهدٌ أو نفيٌ أو ضميرٌ جمعي، في جملةٍ لا تتجاوز ${Math.max(16, dna.sentence.p90)} كلمة. ممنوع التعريف المدرسي («يُعدّ… من أهم…»).`,
    `١١) عباراتٌ محظورة لأنها غائبةٌ تماماً عن أرشيفه: ${(dna.banned || BANNED_PHRASES).filter((phrase) => phrase !== 'صيدة' && phrase !== 'صيد').slice(0, 24).join(' · ')}.`,
    '١٢) لا تستخدم كلمة «صيدة» ولا «صيد» بأي صيغة.',
    '١٣) ممنوع منعاً باتاً تكرار جملةٍ أو عبارةٍ أو إعادة صياغة الفكرة نفسها لتطويل النص. لا يكرّر الدكتور جملةً في مقاله قط، والتكرار يُرفض آلياً مهما بلغت بقية الأرقام. كل فقرةٍ تدفع المقال خطوةً جديدة إلى الأمام.',
    '١٤) لا تبلغ الأرقام المطلوبة بالحشو: الوقفات والانقلابات والأسئلة تأتي داخل أفكارٍ جديدة، لا بإلصاقها على جملٍ مُعادة.',
    (dna.voiceMemory || []).length ? `★) عباراتٌ رفضها الدكتور بنفسه وقال «هذه ليست أنا» — ممنوعةٌ منعاً باتاً هي وأشباهها: ${dna.voiceMemory.slice(0, 12).map((item) => `«${item}»`).join(' · ')}.` : '',
    openers.length ? `١٥) يبدأ جمله وفقراته بهذه الكلمات أكثر من غيرها — استعمل بعضها في مواضعها الطبيعية: ${openers.join(' · ')}.` : '',
  ].filter(Boolean).join('\n')
}

/* ---------- الحَكَم ---------- */

/* المطابقة بحدود الكلمة: «صيد» داخل «رصيد» و«قصيدة» ليست الكلمة الممنوعة.
   هذا الخطأ وحده كان يرسّب تسعة عشر مقالاً من مقالاته. */
const bannedPattern = (phrase) => {
  const bare = bareText(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(?<!\\p{L})${bare}(?!\\p{L})`, 'u')
}
const hasBanned = (text, phrases) => {
  const bare = bareText(text)
  return (phrases || []).filter((phrase) => bannedPattern(phrase).test(bare))
}

/* ---------- بوابة الإسناد: أخطر عيبٍ رأيته في تشغيلٍ حيّ ----------

   النموذج المجاني كتب في مقالٍ باسم الدكتور: «دراسة نشرت في علم النفس التربوي
   (2025) أظهرت أن الطلاب… سجلوا تراجعاً بنسبة ٣٨٪». الدراسة مخترعة والرقم
   مخترع — وهذا في مقال أستاذٍ جامعي كارثةٌ لا عيبُ أسلوب.

   والقياس يقول إن الاستشهاد نفسه من أسلوبه: ٤٣ من ١٤٣ مقالاً تستشهد بدراساتٍ
   حقيقية بأسمائها وسنواتها (Deci & Ryan 1999 · Vosoughi 2018 · Al-Enezi 2025).
   فالقاعدة ليست منع الأرقام… بل منع ما لا سند له في المادة المعطاة. */

const DIGIT_MAP = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' }
const normalizeDigits = (value = '') => String(value).replace(/[٠-٩]/g, (digit) => DIGIT_MAP[digit] || digit)

const PERCENT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:%|٪|بالمئة|بالمائة|في المئة|في المائة)/g
const CITATION_WORD = /(?<!\p{L})(?:دراسة|دراسات|بحثٌ|أبحاث|تقرير|استطلاع|إحصائية|إحصاءات)(?!\p{L})/u

/* يعيد الادعاءات التي لا أثر لها في المادة المعطاة. */
export function unsupportedClaims(body, sources = []) {
  const haystack = normalizeDigits((sources || [])
    .map((item) => typeof item === 'string' ? item : `${item?.body || ''} ${item?.title || ''} ${item?.summary || ''} ${item?.excerpt || ''}`)
    .join('\n'))
  const text = normalizeDigits(String(body || ''))
  const claims = []

  /* المطابقة بحدود الرمز لا بالاحتواء: «٣٨» موجودة كجزءٍ من رقمٍ ما في أي
     أرشيفٍ من ٥٣ ألف كلمة، فكان كل رقمٍ مُختلَق يعبر. والنسبة تُطلب بصيغتها
     نسبةً في المصدر لا رقماً عابراً. */
  const numberInSources = (number) => {
    const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?<![\\d.,])${escaped}\\s*(?:%|٪|بالمئة|بالمائة|في المئة|في المائة)`, 'u').test(haystack)
      || new RegExp(`(?<![\\d.,])${escaped}(?![\\d.,])`, 'u').test(haystack.replace(/(?<=\d)[.,](?=\d)/g, '.'))
  }

  for (const match of text.matchAll(PERCENT_PATTERN)) {
    if (!numberInSources(match[1])) claims.push({ kind: 'نسبة', value: match[0].trim() })
    if (claims.length >= 6) break
  }

  /* اسمُ الدراسة أو الدورية أو المؤلف هو السند الحقيقي؛ السنة وحدها دليلٌ
     ضعيف (٢٠٢٥ موجودة في أرشيفه فتُمرِّر أي اختلاقٍ يرافقها). */
  for (const sentence of sentencesOf(text)) {
    if (!CITATION_WORD.test(bareText(sentence))) continue
    const latinNames = (sentence.match(/[A-Z][A-Za-z.'-]{2,}(?:\s+(?:et al\.?|and|&)\s*[A-Za-z.'-]*)?/g) || []).map((name) => name.trim())
    const quoted = (sentence.match(/«([^»]{3,60})»/g) || []).map((item) => item.replace(/[«»]/g, '').trim())
    const named = [...latinNames, ...quoted]
    if (!named.length) continue
    const orphan = named.filter((marker) => !haystack.includes(marker) && !bareText(haystack).includes(bareText(marker)))
    if (orphan.length === named.length) {
      claims.push({ kind: 'استشهاد', value: sentence.slice(0, 90) })
      if (claims.length >= 6) break
    }
  }
  return claims
}

/* تداخلٌ حرفي مع الأرشيف: ستّ كلماتٍ متتالية متطابقة = نقلٌ لا محاكاة. */
export function verbatimOverlap(body, archiveTexts, size = 6) {
  const target = bareText(String(body)).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean)
  if (target.length < size) return []
  const seen = new Set()
  for (const source of (archiveTexts || [])) {
    const tokens = bareText(String(source?.body ?? source ?? '')).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean)
    for (let index = 0; index + size <= tokens.length; index += 1) seen.add(tokens.slice(index, index + size).join(' '))
  }
  const hits = []
  for (let index = 0; index + size <= target.length; index += 1) {
    const gram = target.slice(index, index + size).join(' ')
    if (seen.has(gram)) hits.push(gram)
    if (hits.length >= 8) break
  }
  return hits
}

const band = (value, low, high) => value >= low && value <= high
/* درجةُ «كم يشبه هذا النص مقالاته» لا «كم يطابق الوسيط».

   لكل مقياسٍ مدىً مأخوذٌ من توزيع مقالاته نفسها: علامةٌ كاملة داخل المدى
   المألوف، ثم انحدارٌ خطّي حتى الصفر عند طرفٍ لا يسكنه أي مقالٍ له. الاتجاه
   مهم: قِصَر الجملة ليس عيباً وإن جاوز عادته، أما طولها فعيب. */
const gradeAtLeast = (value, band, floorKey = 'p35') => {
  const full = band?.[floorKey] ?? 0
  const zero = band?.p03 ?? 0
  if (value >= full) return 1
  if (value <= zero) return .05
  return clampNumber(.05 + (value - zero) / Math.max(.001, full - zero) * .95, 0, 1)
}
const gradeAtMost = (value, band, ceilingKey = 'p65') => {
  const full = band?.[ceilingKey] ?? 0
  const zero = band?.p97 ?? full
  if (value <= full) return 1
  if (value >= zero + (zero - full)) return .05
  const span = Math.max(.001, (zero - full) * 2)
  return clampNumber(1 - (value - full) / span * .95, 0, 1)
}
/* نافذةٌ من الطرفين. الحاجة إليها ظهرت في تشغيلٍ حيّ: النموذج تعلّم أن «كل
   زيادةٍ في العلامة زيادةٌ في الدرجة»، فرشّ «…بل» ثماني مرات في ١٦٧ كلمة —
   أي ٤٫٨ لكل مئة، بينما أقصى ما بلغه الدكتور في أي مقالٍ له ٤٫٥ ووسيطه ٠٫٣.
   العلامة التي تتجاوز سقفه ليست أسلوبه… بل تقليدٌ ميكانيكي له. */
const gradeWindow = (value, band, lowKey = 'p35', highKey = 'p85') => {
  const low = band?.[lowKey] ?? 0
  const high = band?.[highKey] ?? Infinity
  if (value >= low && value <= high) return 1
  if (value < low) {
    const zero = band?.p03 ?? 0
    if (value <= zero) return .05
    return clampNumber(.05 + (value - zero) / Math.max(.001, low - zero) * .95, 0, 1)
  }
  const ceiling = band?.p97 ?? high
  const runway = Math.max(.001, (ceiling - high) * 2)
  return clampNumber(1 - (value - high) / runway * .95, .05, 1)
}

const gradeInside = (value, band) => {
  if (value >= (band?.p15 ?? 0) && value <= (band?.p85 ?? Infinity)) return 1
  const low = band?.p03 ?? 0
  const high = band?.p97 ?? Infinity
  if (value < low || value > high) return .1
  return .6
}

/* يعيد درجةً من ١٠٠ ولائحة إصلاحاتٍ بالأرقام تُعاد إلى النموذج حرفياً. */
export function judgeStyle(body, rawDna, options = {}) {
  const dna = resolveStyleDna(rawDna)
  const bands = dna.perArticle || FALLBACK_STYLE_DNA.perArticle
  const text = String(body || '')
  const metrics = articleMetrics(text)
  /* لا درجةَ لنصٍّ لا وجود له: بلا هذا الحارس كان الفراغ يُمنح ٥٥٪ لأن نصف
     المقاييس «لا تُخالَف» حين لا يوجد ما يُقاس. */
  if (metrics.words < 40) {
    return { score: 0, ready: false, checks: [], corrections: [], fatal: text.trim() ? ['النص أقصر من أن يُقاس'] : [], metrics }
  }

  const checks = []
  const fixes = []
  const fatal = []
  const add = (key, label, grade, weight, actual, wanted, fix) => {
    const ok = grade >= .999
    checks.push({ key, label, ok, grade: Math.round(grade * 100) / 100, weight, actual, wanted })
    if (grade < .8 && fix) fixes.push(fix)
  }

  /* ١ — نقاط الحذف: أثقل علامةٍ في بصمته (٩٤٪ من مقالاته، وسيط ٢٨ وقفة). */
  const ellipsisWanted = Math.max(4, Math.round((bands.ellipsisPer100?.p35 ?? 4) * metrics.words / 100))
  const ellipsisCeiling = Math.round((bands.ellipsisPer100?.p85 ?? 13) * metrics.words / 100)
  add('ellipsis', 'وقفات «…»', gradeWindow(metrics.ellipsisPer100, bands.ellipsisPer100), 18,
    `${metrics.ellipsis} وقفة`, `${ellipsisWanted}-${ellipsisCeiling}`,
    metrics.ellipsisPer100 > (bands.ellipsisPer100?.p85 ?? 13)
      ? `الوقفات «…» أكثر من عادته (${metrics.ellipsis} في ${metrics.words} كلمة): أبقِ منها ${ellipsisCeiling} تقريباً في مواضع الانقلاب، واحذف البقية. الوقفة التي لا تسبق انقلاباً زخرفة.`
      : `زد وقفات «…» إلى ${ellipsisWanted} على الأقل (الموجود ${metrics.ellipsis}): وقفةً قبل الانقلاب، تلتصق بما قبلها وتليها مسافة هكذا «عاجزون… بل».`)

  /* ٢ — طول الجملة: الطول عيب، القِصَر ليس. */
  add('sentenceLength', 'وسيط الجملة', gradeAtMost(metrics.medianSentence, bands.medianSentence), 15,
    `${metrics.medianSentence} كلمة`, `≤ ${bands.medianSentence?.p65 ?? 12} كلمة`,
    `جملك أطول من عادته: وسيطها ${metrics.medianSentence} كلمة وعادته ${dna.sentence.median}. اكسر أطول ${Math.max(3, Math.round(metrics.sentences * .3))} جملة إلى جملتين حاسمتين.`)

  /* ٣ — نسبة الجمل القصيرة. */
  add('shortSentences', 'الجمل القصيرة', gradeAtLeast(metrics.shortRate, bands.shortRate), 12,
    `${metrics.shortRate}٪`, `≥ ${bands.shortRate?.p35 ?? 40}٪`,
    `${metrics.shortRate}٪ فقط من جملك تسع كلماتٍ فأقل، وعادته ${dna.sentence.shortRate}٪. اقطع الجمل المركّبة.`)

  /* ٤ — الجمل الطويلة جداً: نادرةٌ عنده (٥٪). */
  add('longSentences', 'الجمل الطويلة', gradeAtMost(metrics.longSentenceRate, bands.longSentenceRate), 6,
    `${metrics.longSentenceRate}٪`, `≤ ${bands.longSentenceRate?.p65 ?? 8}٪`,
    'جملٌ طويلة أكثر من عادته؛ لا يكتب جملاً تتجاوز خمساً وعشرين كلمة إلا نادراً.')

  /* ٥ — البناء الضدّي: العتبة عند وسيطه لا عند ربعه، لأن ربعه صفر — وصفرُ
     «بل» في نصٍّ باسمه علامةٌ فارقة لا تُغتفر. */
  const antithesisCeiling = Math.max(2, Math.round((bands.antithesisPer100?.p85 ?? 1.3) * metrics.words / 100))
  add('antithesis', 'الانقلاب «…بل»', gradeWindow(metrics.antithesisPer100, bands.antithesisPer100, 'p50', 'p85'), 11,
    `${metrics.antithesis} (${metrics.antithesisPer100}/١٠٠)`, `≤ ${antithesisCeiling} في هذا الطول`,
    metrics.antithesisPer100 > (bands.antithesisPer100?.p85 ?? 1.3)
      ? `«بل» مرشوشة لا مقصودة (${metrics.antithesis} مرة في ${metrics.words} كلمة، وأقصى ما بلغه في مقالٍ كامل ${bands.antithesisPer100?.p97 ?? 2.3} لكل مئة). أبقِ منها ${antithesisCeiling} في مواضع الانقلاب الحقيقي واحذف الباقي؛ الانقلاب الذي لا يقلب شيئاً ركاكة.`
      : `استعمل «…بل» مرةً أو مرتين (الموجود ${metrics.antithesis}) بصيغة «ليس كذا… بل كذا» في موضع انقلابٍ حقيقي.`)

  /* ٦ — الأسئلة البلاغية. */
  add('questions', 'الأسئلة البلاغية', gradeInside(metrics.questions, bands.questions), 8,
    `${metrics.questions}`, `${bands.questions?.p15 ?? 1}-${bands.questions?.p85 ?? 6}`,
    metrics.questions < (bands.questions?.p15 ?? 1)
      ? 'أضف سؤالاً بلاغياً أو سؤالين، وليكن أحدهما في الخاتمة.'
      : 'قلّل الأسئلة؛ النص صار سلسلة أسئلة لا مقالاً.')

  /* ٧ — الصوت الجمعي. */
  add('collectiveVoice', 'الصوت الجمعي', gradeAtLeast(metrics.collective, bands.collective), 6,
    `${metrics.collective}`, `≥ ${bands.collective?.p35 ?? 1}`,
    'أدخل الضمير الجمعي (نحن · دعونا · علينا · نعيش)؛ لا يكتب بصوت المحاضر المنفصل.')

  /* ٨ — إيقاع الفقرة: الفقرة المتضخّمة عيب. */
  add('paragraphRhythm', 'إيقاع الفقرات', gradeAtMost(metrics.medianParagraph, bands.medianParagraph), 8,
    `وسيط ${metrics.medianParagraph} كلمة`, `≤ ${bands.medianParagraph?.p65 ?? 60} كلمة`,
    `فقراتك كتلٌ متضخّمة (وسيط ${metrics.medianParagraph} كلمة). اجعل الفقرات قصيرة متفاوتة، وبينها فقرةٌ من جملةٍ واحدة.`)

  /* ٩ — الافتتاح. */
  const openingClean = !/(?<!\p{L})(?:يعد|يعتبر|تعتبر|يشكل|تشكل)(?!\p{L})/u.test(bareText(text).slice(0, 90))
  add('opening', 'الافتتاح', Math.min(gradeAtMost(metrics.firstSentenceWords, bands.firstSentenceWords), openingClean ? 1 : .3), 8,
    `${metrics.firstSentenceWords} كلمة`, `≤ ${bands.firstSentenceWords?.p65 ?? 18} كلمة وبلا تعريف مدرسي`,
    'الجملة الأولى طويلة أو تعريفية. ابدأ بمشهدٍ أو نفيٍ أو ضميرٍ جمعي في جملةٍ قصيرة.')

  /* ١٠ — الخاتمة تنقلب أو تسأل ولا تلخّص. */
  const last = bareText(metrics.lastSentence)
  const closingOpen = metrics.lastSentence.includes('؟')
    || /(?<!\p{L})بل(?!\p{L})/u.test(last)
    || /…/.test(metrics.lastSentence)
    || /(?<!\p{L})(?:ربما|لعل|نحتاج|علينا|دعونا|فلنبدأ|يبدأ)(?!\p{L})/u.test(last)
  add('closing', 'الخاتمة', closingOpen ? (countWords(metrics.lastSentence) <= 32 ? 1 : .6) : .25, 8,
    closingOpen ? 'تفتح' : 'تلخّص', 'سؤال أو انقلاب «بل» أو وقفة «…»',
    'الخاتمة تلخّص بدل أن تفتح. اجعل الجملة الأخيرة سؤالاً أو انقلاباً بـ«بل»، ولا تتجاوز ثلاثين كلمة.')

  /* ١١ — التكرار: أثقل عيبٍ ينحدر إليه النموذج المجاني تحت ضغط الأرقام.
     توزيعه كله أصفار، فالعتبات هنا مطلقة لا نسبية. */
  const repetitionGrade = (() => {
    if (metrics.duplicateSentenceRate <= 0 && metrics.duplicateGramRate < 1) return 1
    const sentencePenalty = Math.min(1, metrics.duplicateSentenceRate / 8)
    const gramPenalty = Math.min(1, metrics.duplicateGramRate / 5)
    return clampNumber(1 - Math.max(sentencePenalty, gramPenalty), 0, 1)
  })()
  add('repetition', 'التكرار', repetitionGrade, 16,
    `جمل مكرّرة ${metrics.duplicateSentenceRate}٪ · مقاطع مكرّرة ${metrics.duplicateGramRate}٪`, 'صفر',
    `النص يعيد نفسه (${metrics.duplicateSentenceRate}٪ من جمله مكرّرة، وأكثر جملةٍ تتكرر ${metrics.worstSentenceRepeat} مرات). الدكتور لا يكرّر جملةً قط. احذف كل جملةٍ أو عبارةٍ مكرّرة واستبدلها بفكرةٍ جديدة تدفع المقال للأمام؛ ولا تُطِل النص بإعادة الصياغة.`)
  if (metrics.duplicateSentenceRate >= 6 || metrics.duplicateGramRate >= 4 || metrics.worstSentenceRepeat >= 3) {
    const cause = metrics.duplicateSentenceRate >= 6
      ? `${metrics.duplicateSentenceRate}٪ من جمله مكرّرة`
      : metrics.worstSentenceRepeat >= 3
        ? `جملةٌ واحدة تتكرر ${metrics.worstSentenceRepeat} مرات`
        : `${metrics.duplicateGramRate}٪ من مقاطعه مكرّرة`
    fatal.push(`النص يلفّ على نفسه: ${cause}`)
  }

  /* ١٢ — تنوّع المفردات: قاعُ توزيعه ٦٦٪، وما دونه لفٌّ لا كتابة. */
  add('lexicalDiversity', 'تنوّع المفردات', gradeAtLeast(metrics.lexicalDiversity, bands.lexicalDiversity, 'p15'), 8,
    `${metrics.lexicalDiversity}٪`, `≥ ${bands.lexicalDiversity?.p15 ?? 69}٪`,
    'مفرداتك تدور في حلقة ضيقة؛ وسّع المعجم ولا تُعد الجملة نفسها بصيغةٍ أخرى.')
  if (metrics.lexicalDiversity < (bands.lexicalDiversity?.p03 ?? 60) - 6) {
    fatal.push(`تنوّع المفردات ${metrics.lexicalDiversity}٪ — دون أي مقالٍ له`)
  }

  /* ١٣ — النظافة الطباعية (قاطع). */
  const artifacts = []
  if (/—/.test(text)) artifacts.push('الشرطة الاعتراضية —')
  if (/^\s*#{1,6}\s/m.test(text)) artifacts.push('عناوين ماركداون')
  if (/^\s*[-*•]\s/m.test(text)) artifacts.push('تعداد نقطي')
  if (/^\s*\d+[.)]\s/m.test(text)) artifacts.push('تعداد رقمي')
  if (/\*\*|__/.test(text)) artifacts.push('تشديد ماركداون')
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) artifacts.push('رموز تعبيرية')
  add('typography', 'النظافة الطباعية', artifacts.length ? 0 : 1, 5,
    artifacts.join(' · ') || 'نظيف', 'بلا شرطة ولا تعداد ولا ماركداون',
    artifacts.length ? `احذف: ${artifacts.join(' · ')}؛ لا تظهر في أي مقالٍ له.` : '')
  if (artifacts.length) fatal.push(`آثار قوالب آلية: ${artifacts.join(' · ')}`)

  /* ١٤ — عباراتٌ ليست منه (قاطع). */
  const bannedHits = hasBanned(text, dna.banned || BANNED_PHRASES)
  const voiceHits = hasBanned(text, dna.bannedVoice || BANNED_VOICE)
  const allBanned = [...bannedHits, ...voiceHits]
  add('banned', 'عبارات ليست منه', allBanned.length ? 0 : 1, 8,
    allBanned.join(' · ') || 'نظيف', 'صفر',
    allBanned.length ? `احذف هذه العبارات وأعد صياغة مواضعها: ${allBanned.join(' · ')}.` : '')
  if (bannedHits.length) fatal.push(`عبارات نموذجٍ آليّ: ${bannedHits.join(' · ')}`)
  if (voiceHits.length) fatal.push(`صوتٌ ليس صوته: ${voiceHits.join(' · ')}`)

  /* ١٥ — بوابة الإسناد: رقمٌ أو دراسةٌ بلا سندٍ في المادة المعطاة (قاطع). */
  const sources = options.sources || options.archive
  const orphanClaims = sources ? unsupportedClaims(text, sources) : []
  add('evidence', 'إسناد الأرقام', orphanClaims.length ? 0 : 1, 12,
    orphanClaims.length ? orphanClaims.map((claim) => `${claim.kind}: ${claim.value}`).join(' · ') : 'كل رقمٍ مُسنَد', 'صفر بلا سند',
    orphanClaims.length
      ? `احذف كل رقمٍ أو دراسةٍ لا سند لها في المادة المرفقة، أو أعد صياغة الفكرة بلا رقم: ${orphanClaims.map((claim) => claim.value).slice(0, 3).join(' · ')}. الدكتور يستشهد بدراساتٍ حقيقية بأسمائها؛ اختراعُ دراسةٍ باسمه لا يُغتفر.`
      : '')
  if (orphanClaims.length) fatal.push(`رقمٌ أو دراسةٌ بلا سند: ${orphanClaims[0].value}`)

  /* ١٦ — منع النقل الحرفي من أرشيفه (قاطع). */
  const overlap = options.archive ? verbatimOverlap(text, options.archive) : []
  if (overlap.length) {
    fatal.push(`نقلٌ حرفي من الأرشيف: «${overlap[0]}»`)
    fixes.push(`أعد صياغة ما نُقل حرفياً من مقالاتك القديمة: «${overlap.slice(0, 3).join('» · «')}». المطلوب محاكاة الإيقاع لا نسخ العبارات.`)
  }

  const weightTotal = checks.reduce((sum, check) => sum + check.weight, 0)
  const earned = checks.reduce((sum, check) => sum + check.grade * check.weight, 0)
  const raw = Math.round(earned / Math.max(1, weightTotal) * 100)
  /* التحفّظ القاطع يسقف الدرجة مهما أحسن النص في بقية المقاييس. بلا هذا السقف
     كان نصٌّ يلفّ على نفسه ينال ٦٩٪ لأنه أتقن الوقفات والانقلابات والأسئلة —
     وهي عين طريقة النموذج في «تحقيق الأرقام» بلا كتابة. */
  const capped = overlap.length ? Math.min(raw, 45) : (fatal.length ? Math.min(raw, 55) : raw)
  const score = clampNumber(capped, 0, 100)

  return {
    score,
    ready: score >= (options.threshold || 80) && !fatal.length,
    checks,
    corrections: fixes.filter(Boolean),
    fatal,
    metrics,
  }
}


/* ---------- الصقل الحتمي ---------- */

/* طباعةٌ فقط: لا تُضاف كلمةٌ ولا تُحذف. ما يفعله هنا هو ما يفعله هو بيده. */
export function polishTypography(value = '') {
  if (value === null || value === undefined) return ''
  let text = String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[‎‏‪-‮]/g, '')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^[ \t]*[-*•][ \t]+/gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\.{3,}/g, '…')
    .replace(/\s*—\s*/g, '، ')
    .replace(/\s*–\s*/g, '، ')
    /* الاقتران بالتناوب: القاعدة القديمة تتخطى أي مقطعٍ خارج المدى فتزاوج
       علامة إغلاقه مع افتتاح المقطع التالي، فتحيط الأقواس بالسرد لا بالاقتباس. */
    .replace(/"/g, (() => { let open = true; return () => (open = !open) ? '»' : '«' })())
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([،؛؟!.])/g, '$1')
    .replace(/…{2,}/g, '…')
    .replace(/\n{3,}/g, '\n\n')
  /* تباعد «…» مقيسٌ على ٣٩٦٣ موضعاً في أرشيفه: ٩٦٪ منها بلا مسافةٍ قبلها،
     و٨٢٪ بمسافةٍ بعدها. أي «الواقع… بل» لا «الواقع …بل» ولا «الواقع…بل». */
  text = text
    .replace(/[ \t]+…/g, '…')
    .replace(/…[ \t]*(?=[^\s،.؛؟!»\n])/g, '… ')
  return text.split('\n').map((line) => line.trim()).join('\n').trim()
}

/* تحويلٌ أسلوبيّ بعلامات الترقيم وحدها: الفاصلة قبل روابط الانقلاب تصير وقفة
   «…» — وهي عادته المقيسة. النسب ليست ذوقاً؛ هذه أرقامه الحقيقية:

     «…ولكن» ٧١ مقابل «، ولكن» ٧      → ٩١٪
     «…أم»   ٤٠ مقابل «، أم»   ٤      → ٩١٪
     «…لكن»  ٣٧ مقابل «، لكن»  ٢٠     → ٦٥٪
     «…لا»   ٩٠ مقابل «، لا»   ٧٩     → ٥٣٪
     «…ثم»   ١٨ مقابل «، ثم»   ٢١     → ٤٦٪
     «…بل»  ١٠٧ مقابل «، بل»  ١٤٩     → ٤٢٪

   التطبيق حتميّ (كل موضعٍ وفق دوره) لا عشوائي، فالنتيجة قابلة للإعادة. ولا
   تُضاف كلمةٌ ولا تُحذف — ترقيمٌ فقط. */
const PAUSE_JUNCTURES = [
  { word: 'ولكن', share: .91 },
  { word: 'أم', share: .91 },
  { word: 'لكن', share: .65 },
  { word: 'بل', share: .42 },
  { word: 'لا', share: .53 },
  { word: 'ثم', share: .46 },
  { word: 'إلا', share: .35 },
  { word: 'ولا', share: .35 },
]

export function liftPauses(value = '', rawDna) {
  const dna = resolveStyleDna(rawDna)
  const words = countWords(value)
  const target = Math.round((dna.perArticle?.ellipsisPer100?.p50 ?? dna.marks.ellipsisPer100) * words / 100)
  let current = occurrences(value, /…/g)
  if (current >= target) return String(value)
  let text = String(value)
  for (const juncture of PAUSE_JUNCTURES) {
    if (current >= target) break
    /* المفاصل المحوَّلة سابقاً تُحسب ضمن الكل، وإلا حوّل كل تمريرٍ نصيباً
       جديداً من الباقين حتى تبلغ النسبة ١٠٠٪ — والدالة تُستدعى مرتين في
       المسار الحقيقي (خادمٌ ثم واجهة). */
    const already = occurrences(text, new RegExp(`…[ \\t]*${juncture.word}(?![\\p{L}\\p{M}])`, 'gu'))
    let seen = already
    let lifted = already
    text = text.replace(new RegExp(`،[ \\t]+(?=${juncture.word}(?![\\p{L}\\p{M}]))`, 'gu'), () => {
      seen += 1
      if (current >= target || lifted >= Math.ceil(seen * juncture.share)) return '، '
      current += 1
      lifted += 1
      return '… '
    })
  }
  return text
}

/* الجملة الطويلة أكبر عيبٍ يفصل نصّ النموذج عن نصّه: وسيطه ثماني كلمات
   و٦٢٪ من جمله تسعٌ فأقل. هذا التحويل يكسر الجمل المتضخّمة عند مفصلٍ يبدأ به
   جملَه فعلاً (يبدأ ٩٥ جملة بـ«بل» و٦٥ بـ«ولكن» و٨٣ بـ«وقد») — بعلامة ترقيم
   واحدة، بلا كلمةٍ تُضاف أو تُحذف، وبلا مساسٍ بالتركيب النحوي. */
const SENTENCE_STARTERS = ['بل', 'ولكن', 'لكن', 'ولا', 'لا', 'وقد', 'قد', 'إن', 'أما', 'ثم', 'وهذا', 'هذا', 'نحن', 'دعونا', 'وفي', 'ومن', 'حتى', 'أم']

export function breakLongSentences(value = '', rawDna) {
  const dna = resolveStyleDna(rawDna)
  const ceiling = Math.max(16, (dna.perArticle?.medianSentence?.p85 ?? 15) + 4)
  const pattern = new RegExp(`،[ \\t]+(?=(?:${SENTENCE_STARTERS.join('|')})(?![\\p{L}\\p{M}]))`, 'u')
  const rebuild = (sentence) => {
    if (countWords(sentence) <= ceiling) return sentence
    /* نختار المفصل الأقرب إلى المنتصف كي لا نُخلّف جملةً يتيمة. */
    let best = -1
    let bestDistance = Infinity
    const middle = Math.floor(sentence.length / 2)
    for (let index = 0; index < sentence.length; index += 1) {
      if (sentence[index] !== '،') continue
      if (!pattern.test(sentence.slice(index))) continue
      const distance = Math.abs(index - middle)
      if (distance < bestDistance) { bestDistance = distance; best = index }
    }
    if (best < 0) return sentence
    const head = sentence.slice(0, best).trim()
    const tail = sentence.slice(best + 1).trim()
    if (countWords(head) < 4 || countWords(tail) < 4) return sentence
    return `${head}… ${rebuild(tail)}`
  }
  return paragraphsOf(String(value))
    .map((paragraph) => sentencesOf(paragraph).map(rebuild).join(' '))
    .join('\n\n') || String(value)
}

/* تقطيعُ الفقرات بإيقاعه لا بالعدّاد.

   العلّة القديمة: humanParagraphs كان يبني فقراتٍ متساوية بنحو ٧٠ كلمة وحدٍّ
   أدنى ٢٨ كلمة — بينما وسيط فقرته ٢١ كلمة و٣٣٪ من فقراته جملةٌ واحدة. النتيجة
   كتلٌ متراصّة لا تشبه صفحته إطلاقاً.

   الجديد: نحترم فواصل الكاتب إن كانت معقولة، ولا نقسّم إلا الفقرات المتضخّمة،
   ونستعمل نمطاً متفاوتاً (١·٢·٣ جمل) مأخوذاً من توزيعه الحقيقي. */
export function applyRhythm(value = '', rawDna) {
  const dna = resolveStyleDna(rawDna)
  const text = String(value).trim()
  if (!text) return ''
  const existing = paragraphsOf(text)
  const maxParagraphWords = Math.max(55, dna.paragraph.p90 || 73)

  const split = (paragraph) => {
    const list = sentencesOf(paragraph)
    if (list.length <= 1 || countWords(paragraph) <= maxParagraphWords) return [paragraph.trim()]
    /* نمطٌ متفاوت: جملتان ثم واحدة ثم ثلاث… يعيد وسيط فقرته وقصار فقراته معاً. */
    const pattern = [2, 1, 3, 2, 1, 2, 3, 1]
    const out = []
    let index = 0
    let step = 0
    while (index < list.length) {
      const take = Math.max(1, pattern[step % pattern.length])
      const slice = list.slice(index, index + take)
      /* لا نترك جملةً يتيمة في النهاية إن كانت الفقرة السابقة تتسع لها. */
      if (index + take >= list.length - 1 && list.length - index - take === 1 && countWords(slice.join(' ')) < maxParagraphWords - 12) {
        out.push(list.slice(index).join(' ').trim())
        break
      }
      out.push(slice.join(' ').trim())
      index += take
      step += 1
    }
    return out.filter(Boolean)
  }

  /* نصٌّ بلا فواصل أصلاً (النماذج تفعلها كثيراً): نقطّعه كاملاً بالنمط. */
  if (existing.length <= 2 && countWords(text) > 90) return split(text.replace(/\n+/g, ' ')).join('\n\n')
  return existing.flatMap(split).join('\n\n')
}

/* الخط الأخير قبل العرض: طباعةٌ، ثم كسرُ الجمل المتضخّمة، ثم رفعُ الوقفات،
   ثم إيقاعُ الفقرات. أربع خطواتٍ لا تلمس حرفاً واحداً من كلماته. */
export function refineToStyle(value = '', rawDna) {
  return applyRhythm(liftPauses(breakLongSentences(polishTypography(value), rawDna), rawDna), rawDna)
}

/* ---------- ذاكرة الصوت: ما يقوله الدكتور بنفسه «هذه ليست أنا» ----------

   البصمة تُقاس من أرشيفه، وهي ماضيه. وهذه تُبنى من حكمه هو على ما يُكتب له
   الآن. حين يشير إلى فقرةٍ ويقول «ليست أنا»، نستخرج منها العباراتِ التي لا
   أثر لها في أرشيفه — فهي بالضبط ما دخل من عند النموذج لا من عنده — ونمنعها
   في كل مقالٍ قادم. لا نموذج يُدرَّب ولا خدمة تُشترى: قائمةُ منعٍ تكبر بحكمه. */

const VOICE_STOP = new Set(['في','من','على','الى','إلى','عن','مع','هذا','هذه','ذلك','التي','الذي','ان','أن','إن','ما','لا','لم','لن','قد','هو','هي','كل','بين','عند','ثم','او','أو','و','ف','ب','ل','ك'])

/* عباراتٌ من ثلاث كلماتٍ دلالية لا تَرِد في أرشيفه إطلاقاً: هذه بصمة النموذج
   لا بصمته. نأخذ أندرها لا أكثرها كي تبقى القائمة دقيقة. */
export function extractVoiceSignature(rejectedText, corpus = [], limit = 4) {
  const haystack = ` ${bareText((corpus || []).map((item) => typeof item === 'string' ? item : String(item?.body || '')).join(' ')).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ')} `
  const tokens = bareText(String(rejectedText || '')).replace(/[^\p{L}\p{N}\s]+/gu, ' ').split(/\s+/).filter(Boolean)
  const found = []
  for (let index = 0; index + 3 <= tokens.length; index += 1) {
    const gram = tokens.slice(index, index + 3)
    if (gram.filter((word) => !VOICE_STOP.has(word) && word.length > 2).length < 2) continue
    const phrase = gram.join(' ')
    if (haystack.includes(` ${phrase} `)) continue
    if (found.some((item) => item.includes(gram[1]))) continue
    found.push(phrase)
    if (found.length >= limit) break
  }
  return found
}

/* البصمة + ما تعلّمه منه: قائمة المنع الشخصية تدخل الحَكَم والوصفة معاً. */
export function withVoiceMemory(rawDna, exclusions = []) {
  const dna = resolveStyleDna(rawDna)
  const extra = (exclusions || []).map((item) => String(item || '').trim()).filter((item) => item.length > 4).slice(0, 60)
  if (!extra.length) return dna
  return { ...dna, bannedVoice: [...(dna.bannedVoice || BANNED_VOICE), ...extra], voiceMemory: extra }
}

/* ---------- بوابة المصحّح اللغوي ----------

   نموذجٌ ثانٍ يصحّح الإملاء والتطابق فقط. الخطر أن يعيد الكتابة بأسلوبه هو،
   فيضيع كل ما بُني. هذه البوابة تقبل التصحيح أو ترفضه كاملاً:

     · لا يتغيّر عدد الكلمات أكثر من ٣٪.
     · لا تتغيّر الحروف أكثر من ٤٪ (تصحيحٌ لا إعادة كتابة).
     · لا تنخفض درجة المطابقة أكثر من نقطتين.
     · لا تظهر عبارةٌ ممنوعة جديدة، ولا يُمسّ عدد الوقفات والانقلابات.

   وإن سقط أي شرط: يبقى النص الأصلي كما هو. */
export function acceptProofread(original, corrected, rawDna) {
  const dna = resolveStyleDna(rawDna)
  const source = String(original || '')
  const target = String(corrected || '')
  if (!target.trim()) return { accepted: false, reason: 'المصحّح أعاد نصاً فارغاً' }

  const sourceWords = countWords(source)
  const targetWords = countWords(target)
  if (Math.abs(targetWords - sourceWords) > Math.max(6, sourceWords * .03)) {
    return { accepted: false, reason: `المصحّح غيّر الطول (${sourceWords} ← ${targetWords})` }
  }

  /* نسبة الحروف المتغيّرة: تصحيحُ إملاءٍ يمسّ أحرفاً معدودة، لا فقرات. */
  const a = bareText(source).replace(/[^\p{L}\p{N}]+/gu, '')
  const b = bareText(target).replace(/[^\p{L}\p{N}]+/gu, '')
  let common = 0
  for (let index = 0, cursor = 0; index < a.length && cursor < b.length; index += 1) {
    const found = b.indexOf(a[index], cursor)
    if (found >= 0 && found - cursor < 4) { common += 1; cursor = found + 1 }
  }
  const drift = 1 - common / Math.max(1, a.length)
  if (drift > .04) return { accepted: false, reason: `المصحّح أعاد الكتابة لا التصحيح (${Math.round(drift * 100)}٪ من الحروف)` }

  const before = judgeStyle(source, dna)
  const after = judgeStyle(target, dna)
  if (after.score < before.score - 2) return { accepted: false, reason: `المطابقة انخفضت ${before.score}٪ ← ${after.score}٪` }
  if (after.fatal.length > before.fatal.length) return { accepted: false, reason: 'المصحّح أدخل تحفّظاً قاطعاً جديداً' }

  const beforeMarks = articleMetrics(source)
  const afterMarks = articleMetrics(target)
  if (afterMarks.ellipsis < beforeMarks.ellipsis - 1 || afterMarks.antithesis < beforeMarks.antithesis - 1) {
    return { accepted: false, reason: 'المصحّح مسّ وقفاتك أو انقلاباتك' }
  }
  return { accepted: true, reason: `صُحّح بلا مساسٍ بالأسلوب (${before.score}٪ ← ${after.score}٪)`, score: after.score }
}

export const PROOFREAD_INSTRUCTION = [
  'أنت مدقّقٌ لغويّ عربيّ صارم، ولستَ كاتباً ولا محرّراً.',
  'مهمتك الوحيدة: تصحيح الأخطاء الإملائية والنحوية وأخطاء التطابق في النص كما هو.',
  'ممنوع منعاً باتاً: تغيير أسلوب الكاتب، أو إعادة صياغة جملة، أو حذف جملة أو إضافتها،',
  'أو تغيير علامات الترقيم — وبخاصة نقاط الحذف «…» وعلامات الاقتباس «» — أو تغيير',
  'مواضع الفقرات، أو تحويل التنوين إلى صورةٍ أخرى (اكتب «طلاباً» لا «طلابًا»).',
  'أعد النص نفسه حرفاً بحرف مع تصحيح الأخطاء وحدها. أعد JSON بمفتاح body فقط.',
].join('\n')

/* ---------- تقريرٌ عربيّ قصير يُعرض للدكتور ---------- */
export function styleReportLines(verdict) {
  if (!verdict) return []
  const { metrics } = verdict
  return [
    `مطابقة الأسلوب: ${verdict.score}٪${verdict.ready ? ' — مطابق' : ' — دون العتبة'}`,
    `وقفات «…» ${metrics.ellipsis} · انقلابات «بل» ${metrics.antithesis} · أسئلة ${metrics.questions}`,
    `وسيط الجملة ${metrics.medianSentence} كلمة · الجمل القصيرة ${metrics.shortRate}٪ · فقرات من جملة ${metrics.singleRate}٪`,
    `التكرار ${metrics.duplicateSentenceRate}٪ · تنوّع المفردات ${metrics.lexicalDiversity}٪`,
    ...(verdict.fatal.length ? [`تحفّظات قاطعة: ${verdict.fatal.join(' · ')}`] : []),
  ]
}
