/**
 * المكتبة التي تمشي — محرك استشهادٍ لا يستطيع التحريف.
 *
 * الشرط الذي بُني عليه كل سطرٍ هنا: «بدون تحريف وبدون كلام من عنده، التزام
 * قطعي». ولذلك لم نبنِ نموذجاً يُحاول ألا يُحرّف — بنينا محركاً لا يملك القدرة
 * على التحريف أصلاً. كل ما ينطق به البوت شيئان لا ثالث لهما:
 *
 *   ١) كلماتُ ربطٍ ثابتة، مكتوبةٌ في هذا الملف، معدودةٌ ومحصورة (SCAFFOLD).
 *   ٢) مقاطع منسوخة حرفاً بحرف من متون الدكتور.
 *
 * ولا يُرسَل ردٌّ حتى يمرّ ببوابة verify: تنتزع كل مقطعٍ بين «…» وتبحث عنه في
 * متن المقال المنسوب إليه. فإن نقص حرفٌ واحد — سقط الردّ كلّه ولم يُرسل شيء.
 * الصمت أشرف من نسبة كلمةٍ إلى الدكتور لم يقلها.
 *
 * ولا نموذج لغويّ في هذا الطريق البتة: لا Gemini ولا سواه. الاسترجاع حسابيّ
 * بحت، فلا مجال لهلوسةٍ ولا لتكلفةٍ ولا لانقطاع خدمة.
 */
import { arabicCountPhrase, OCCURRENCE_FORMS, OTHER_TEXT_FORMS, toRoot, YEAR_FORMS } from './dialect-lexicon.mjs'

/* ═══ ١ · التطبيع والتقطيع ═══ */

const stripDiacritics = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[ً-ٰٟۖ-ۭ]/g, '')

export const normalize = (value) => stripDiacritics(value)
  .toLowerCase()
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[ؤئ]/g, 'ء')
  .replace(/ـ/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/* كلماتٌ شائعة لا تدلّ على موضوع — تُستبعد من الترجيح وحده، لا من النصّ */
const STOP = new Set(normalize(`
  في من على عن الى إلى مع هذا هذه ذلك تلك التي الذي الذين ما لا لم لن قد كان
  كانت يكون تكون هو هي هم هن انا انت نحن كل بعض غير بين عند لدى او أو ثم حتى
  اذا إذا كما لكن بل اي أي شي شيء يا رأي راي رايك دكتور د الدكتور استاذ الاستاذ
  احمد الفيلكاوي كتب قال يقول عندك عندي ابي أبي وش شنو ايش كيف ليش متى وين هل
`).split(' '))

/**
 * تجذيرٌ خفيف: «الامتحانات» و«الامتحان» و«امتحاناتنا» فكرةٌ واحدة، ولو تركناها
 * كما هي لسأل سائلٌ عن «الامتحانات» فلا يجد مقالاً عنوانه «الامتحان».
 * خفيفٌ عمداً: نقشر السوابق واللواحق الشائعة ولا نمسّ الجذر، فلا نخلط «التعليم»
 * بـ«التعلّم» — وهما عند الدكتور معنيان لا معنى.
 */
const PREFIX = /^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/
/* «ان» و«ون» و«ين» ليست في القائمة عمداً: «امتحان» و«إنسان» و«مكان» تنتهي بها
   وهي من أصل الكلمة لا زائدةٌ عليها — وقشرُها يُحيل «امتحان» إلى «امتح». */
/* مرتّبةٌ من الأطول إلى الأقصر، وتُجرَّب واحدةً واحدة. ولا تكفي صيغةُ بديلٍ
   واحدة (…|يه|ه|…): «رأيه» تلتقط «يه» فتُخلّف «را» القصيرة، فيُلغى القشر كلّه
   وتبقى الكلمة على حالها حشواً لا يطابق شيئاً. وبالتجريب المتدرّج تسقط «يه»
   فتُجرَّب «ه» فتصحّ «راي» — وهي المقصودة. */
const SUFFIXES = ['ياتنا', 'اتها', 'اتهم', 'اتنا', 'ات', 'ها', 'هم', 'هن', 'كم', 'نا', 'ية', 'يه', 'ه', 'ي']

export function stem(word) {
  let out = String(word || '')
  const bare = out.replace(PREFIX, '')
  if (bare.length >= 3) out = bare
  for (const suffix of SUFFIXES) {
    if (!out.endsWith(suffix)) continue
    const cut = out.slice(0, -suffix.length)
    if (cut.length >= 3) return cut
  }
  return out
}

/* الحشو يُنخل مرّتين: قبل التجذير وبعده. فـ«رأيه» تنجو من القائمة (وفيها «رأي»
   و«رأيك» لا «رأيه») ثم تتجذّر إلى «راي» — كلمةٍ لا وجود لها في متونٍ عربية،
   فتُثقل المقام في المعادلة وتهبط بالترجيح تحت العتبة. وكانت النتيجة أن «وش
   رأيه في التلقين؟» تُجاب بـ«لا أعرف» بينما «التلقين والحفظ» تُجاب بثلاثة نصوص
   — والسؤالان واحد. ونخلةٌ واحدة لا تكفي ما دام التجذير يُنشئ حشواً جديداً. */
export const tokens = (value) => normalize(value)
  .split(' ')
  .filter((word) => word.length > 2 && !STOP.has(word))
  .map(stem)
  .filter((word) => word.length >= 3 && !STOP.has(word))

/* توكناتٌ موسَّعة بالقاموس الجبّار: كل كلمةٍ تُردّ إلى جذرها الدلاليّ، فيلتقي
   سؤال البدويّ «شنو رايه بالعيال؟» بمقال الأستاذ عن «الأطفال». والتوسيع في
   الاسترجاع وحده — البوابة تبقى تطابق نصّ الدكتور حرفاً بحرف، فلا يتسلّل معنى
   مقارب إلى ما يُنسب إليه، إنما إلى ما يُوصله إليه. */
export const conceptTokens = (value) => tokens(value).map(toRoot)

/**
 * تقطيع المتن إلى جُمَل مع حفظ الفهرس الأصلي لكل جملة.
 * نحفظ الفهرس لأن الاقتباس يجب أن يعود إلى موضعه بالضبط عند التحقق — لا نعيد
 * تركيب النص من قطعٍ مطبَّعة، بل نقتطع من الأصل كما هو.
 */
export function sentences(body) {
  const raw = String(body || '')
  const out = []
  let start = 0
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    /* «…» فاصلٌ للجُمَل كذلك — وهو أخطر ما فات: مقالاتٌ كاملة (كـ«الثراء الكاذب»)
       تستعمل علامة الحذف ٥١ مرة وصفر نقطة، فكان المتن كلّه جملةً واحدة تتجاوز
       الحدّ الأعلى فتُرفض — صفر اقتباس، والبوت لا ينطق من ذاك المقال أبداً.
       نكسر عند «…» و«..» كما نكسر عند النقطة، ونقشرها من العرض لا من الأصل. */
    const isBreak = ch === '.' || ch === '؟' || ch === '!' || ch === '\n' || ch === '؛' || ch === '…'
    if (!isBreak && i !== raw.length - 1) continue
    const end = i === raw.length - 1 && !isBreak ? raw.length : i + 1
    /* الفاصلة المنقوطة والحذف يفصلان شطري فكرةٍ واحدة، والوقوف عندهما يُنهي
       الاقتباس معلّقاً. نقشرهما للعرض — والباقي يبقى مقطعاً متّصلاً من المتن
       حرفاً بحرف، فلا تتأثر البوابة. */
    const text = raw.slice(start, end).trim().replace(/[؛,،…]+$/, '').replace(/\.+$/, '').trim()
    if (text.length >= 40 && text.length <= 320) out.push({ text, start: raw.indexOf(text, start), words: tokens(text) })
    start = end
  }
  return out
}

/* ═══ ٢ · الاسترجاع ═══ */

/** ترجيح مقالٍ لسؤال: تطابق العنوان أثقل من المتن، والتكرار لا يُضاعف الوزن */
export function scoreItem(item, queryTokens) {
  if (!queryTokens.length) return 0
  /* الطرفان يُردّان إلى الجذور الدلالية: سؤالٌ عن «العيال» يطابق مقالاً عن
     «الأطفال». والقياس على الجذور لا يوسّع بابَ الردّ — يوسّع باب الوصول إليه. */
  const titleWords = new Set(tokens(item?.title || '').map(toRoot))
  const bodyWords = new Set(tokens(item?.body || '').map(toRoot))
  let score = 0
  for (const word of new Set(queryTokens.map(toRoot))) {
    if (titleWords.has(word)) score += 3
    else if (bodyWords.has(word)) score += 1
  }
  return score / (queryTokens.length * 3)
}

/** أفضل جملةٍ في المقال تُجيب السؤال — منسوخةٌ من الأصل بلا تعديل */
export function bestSentence(item, queryTokens) {
  const wanted = new Set(queryTokens.map(toRoot))
  const titleKey = normalize(item?.title || '')
  let best = null
  for (const sentence of sentences(item?.body)) {
    /* أول سطرٍ في بعض المتون هو العنوان نفسه — واقتباسُ العنوان ليس جواباً */
    if (normalize(sentence.text) === titleKey) continue
    let hits = 0
    for (const word of new Set(sentence.words.map(toRoot))) if (wanted.has(word)) hits += 1
    if (!hits) continue
    /* نُفضّل الكثافة لا الطول: جملةٌ قصيرة مركّزة خيرٌ من فقرةٍ فيها الكلمة مرّة */
    const density = hits / Math.sqrt(Math.max(6, sentence.words.length))
    if (!best || density > best.density) best = { ...sentence, hits, density }
  }
  return best
}

/**
 * البحث: يعيد المقالات المرتّبة، ولكلٍّ اقتباسه الحرفيّ.
 * ما لا اقتباسَ فيه يسقط — لا نُحيل الدكتور على مقالٍ لا نملك منه شاهداً.
 */
/* العتبة معايَرةٌ على المكتبة الحقيقية (١٦٤ مقالاً)، لا مُخمَّنة. دونها بقليل
   يردّ البوت على «أسعار النفط» بمقالٍ عن الرأسمالية — طابق «أسعار» وأهمل
   «النفط». وذاك تحريفٌ بالإيهام: يُوهم السائل أن الدكتور كتب فيما لم يكتب.
   وفوقها بقليل يسقط «التلقين والحفظ» وقد كتب فيه ثلاث مرات. */
export function search(items = [], question = '', { limit = 3, floor = 0.25 } = {}) {
  const queryTokens = tokens(question)
  if (!queryTokens.length) return []
  return items
    .filter((item) => item?.kind === 'article' && item?.body)
    .map((item) => ({ item, score: scoreItem(item, queryTokens) }))
    .filter((row) => row.score >= floor)
    .sort((a, b) => b.score - a.score || String(b.item.date).localeCompare(String(a.item.date)))
    .slice(0, limit * 3)
    .map((row) => ({ ...row, quote: bestSentence(row.item, queryTokens) }))
    .filter((row) => row.quote)
    .slice(0, limit)
}

/* ═══ ٣ · تطوّر الرأي عبر السنوات ═══ */

const yearOf = (date) => String(date || '').slice(0, 4)

/**
 * هل عاد الدكتور إلى الفكرة في سنواتٍ مختلفة؟ عندها نعرض الأقدم والأحدث معاً،
 * فيرى السائل المسار لا اللقطة. ولا نقول «تغيّر رأيه» — لا نُفسّر، نعرض فقط.
 */
export function spanYears(rows = []) {
  const years = new Set(rows.map((row) => yearOf(row?.item?.date)).filter(Boolean))
  if (years.size < 2) return null
  const sorted = [...rows].sort((a, b) => String(a.item.date).localeCompare(String(b.item.date)))
  const earliest = sorted[0]
  const latest = sorted[sorted.length - 1]
  /* نعرض السنتين الطرفيتين لا عددَ السنوات المختلفة: مقالان في ٢٠١٧ و٢٠٢٥
     «سنتان مختلفتان» عدداً، لكن قول «عبر سنتين» عنهما كذبٌ صريح — بينهما ثمان.
     والدقة هنا ليست تجميلاً: الرقم الخاطئ من البوت هو التحريف الذي نُحاربه. */
  return { earliest, latest, from: yearOf(earliest.item.date), to: yearOf(latest.item.date) }
}

/* ═══ ٤ · التركيب — كل كلمةٍ خارج «…» مكتوبةٌ هنا ومعدودة ═══ */

const countWord = (count) => arabicCountPhrase(count, OCCURRENCE_FORMS)

export const SCAFFOLD = Object.freeze({
  /* «زدني» كان وعداً لا يُوفى: نقول «وله في هذا نصٌّ آخر» ثم نرمي النصوص
     الباقية، فإذا كتبها السائل بحثنا له من جديد بمحرّكٍ آخر فلا يجد شيئاً
     ويسمع «ما عندي شيءٌ قريبٌ منه». هذه الترويسة تفتح الدفعة التالية من
     البقية المحفوظة نفسها — فما وعدنا به هو ما نُسلّمه. */
  moreHeader: 'وهذا بقيةُ ما كتبه في الفكرة نفسها:',
  exhausted: 'هذا كلُّ ما كتبه في هذه الفكرة. اسأل عن فكرةٍ أخرى وأنقل لك نصّه فيها.',
  onceHeader: 'كتب د. أحمد في هذا — وهذا نصّه حرفياً:',
  /* حين يتجاوز العددُ اثنين لا نعرض إلا الطرفين (الأقدم والأحدث)، فيجب أن
     يقول ذلك صراحةً كي لا يسأل السائل «وين البقية؟» — العددُ صادقٌ والمعروضُ
     مُعرَّفٌ، والوصول إلى الوسط بابُه «زدني» في الذيل. حين يكون العدد اثنين
     فكلاهما معروضٌ فلا نقص. */
  manyHeader: (count, from, to) => {
    const shownNote = count > 2 ? 'وهذان طرفاها: الأقدم والأحدث' : 'وهذا نصّه حرفياً'
    return from === to
      ? `عاد د. أحمد إلى هذه الفكرة ${countWord(count)} في ${from} — ${shownNote}:`
      : `عاد د. أحمد إلى هذه الفكرة ${countWord(count)} بين ${from} و${to} — ${shownNote}:`
  },
  none: 'لم أجد في مكتبة د. أحمد نصّاً يخصّ هذا. لا أُجيب من عندي.',
  welcomeHeader: 'أهلاً بك. هذه مكتبة د. أحمد الفيلكاوي — أنقل لك ما كتبه بنصّه، ولا أقول شيئاً من عندي.\n\nوهذا أحدث ما كتب:',
})

const ARABIC_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const stamp = (date) => {
  const match = /^(\d{4})-(\d{2})/.exec(String(date || ''))
  return match ? `${ARABIC_MONTHS[Number(match[2]) - 1]} ${match[1]}` : ''
}

/**
 * الراسم الوحيد. تُبنى منه كل رسالةٍ تخرج، ومنه وحده تُعاد البناء عند التحقق.
 * فما لم يمرّ من هنا لا يصل الدكتور — ولا سبيل لدسّ سطرٍ بين السطور.
 */
export function render(header, citations = [], footer = '') {
  const lines = [header, '']
  for (const citation of citations) {
    lines.push(`${citation.when ? `${citation.when} · ` : ''}${citation.title}`)
    lines.push(`«${citation.quote}»`)
    lines.push(citation.url)
    lines.push('')
  }
  if (footer) lines.push(footer)
  return lines.join('\n').trim()
}

/* ═══ ٤·ب · المتعة — وهي كلمات ربطٍ لا اجتهادَ فيها ═══
 *
 * الأمانة وحدها تصنع أميناً صارماً لا محدّثاً مؤنساً. فأضفنا ثلاثاً: افتتاحاً
 * يليق بمن يفتح الباب، ودعوةً تُطيل الحديث بدل أن ينقطع، ودهشةً حين يجد المحرك
 * فكرةً لاحقت الدكتور سنينَ طوالاً.
 *
 * وكلها قوالبُ مجمّدة لا يتغيّر فيها إلا عددٌ أو سنة. والبوابة تتحقق من ذلك
 * أدناه بمطابقة الذيل بقوالبه — فلا يتسلّل كلامٌ حرّ من هذا الباب.
 */
export const TAIL = Object.freeze({
  more: (count) => `وله في هذا ${arabicCountPhrase(count, OTHER_TEXT_FORMS)} — اكتب «زدني».`,
  chase: (years) => `فكرةٌ لاحقتْه ${arabicCountPhrase(years, YEAR_FORMS)}.`,
  /* الدهشة والدعوة معاً: حين تلاحقه الفكرة سنينَ وتبقى نصوصٌ لم تُعرض، نقول
     الاثنتين — فلا تبتلع الطرفةُ البابَ الذي يبلغ به السائلُ البقية. */
  chaseMore: (years, count) => `فكرةٌ لاحقتْه ${arabicCountPhrase(years, YEAR_FORMS)}، ولها ${arabicCountPhrase(count, OTHER_TEXT_FORMS)} — اكتب «زدني».`,
  ask: 'اسأل عن أي فكرةٍ شئت، وسأنقل لك نصّه فيها.',
})

const TAIL_SHAPES = [
  /^وله في هذا (?:نص آخر|نصان آخران|\d+ نصوص أخرى|\d+ نصاً آخر) — اكتب «زدني»\.$/,
  /^فكرةٌ لاحقتْه (?:سنة|سنتان|\d+ سنوات|\d+ سنة)\.$/,
  /^فكرةٌ لاحقتْه (?:سنة|سنتان|\d+ سنوات|\d+ سنة)، ولها (?:نص آخر|نصان آخران|\d+ نصوص أخرى|\d+ نصاً آخر) — اكتب «زدني»\.$/,
  /^اسأل عن أي فكرةٍ شئت، وسأنقل لك نصّه فيها\.$/,
]

export const isKnownTail = (footer) => !footer || TAIL_SHAPES.some((shape) => shape.test(footer))

/* الترويسة كانت تمرّ بلا فحص: البوابة تحرس الاقتباس والذيل، وتُسلّم بالترويسة
   لأنها «تأتي من SCAFFOLD». وهذا ائتمانٌ على النيّة لا على البنية — وأيّ خطأٍ
   مستقبليّ في المُنادي يمرّ منها إلى الدكتور. فنُقفلها بقوالبها كما أُقفل الذيل. */
const HEADER_SHAPES = [
  /^كتب د\. أحمد في هذا — وهذا نصّه حرفياً:$/,
  /^عاد د\. أحمد إلى هذه الفكرة (?:مرة|مرتين|\d+ مرات|\d+ مرة) (?:في \d{4}|بين \d{4} و\d{4}) — (?:وهذا نصّه حرفياً|وهذان طرفاها: الأقدم والأحدث):$/,
  /^وهذا بقيةُ ما كتبه في الفكرة نفسها:$/,
  /^أهلاً بك\. هذه مكتبة د\. أحمد الفيلكاوي — أنقل لك ما كتبه بنصّه، ولا أقول شيئاً من عندي\.\n\nوهذا أحدث ما كتب:$/,
]

export const isKnownHeader = (header) => !header || HEADER_SHAPES.some((shape) => shape.test(header))

/** الذيل المناسب: الدهشة تسبق الدعوة، فهي أندر وأطرف */
export function tailFor(rows = [], shown = 2, { sequential = false } = {}) {
  const rest = rows.length - shown
  /* في الدفعات التالية لا مكان للدهشة: السائل يعرف الفكرة وقد رآها، وإنما
     يريد البقية. فالذيل هنا وعدٌ بما بقي، أو إقرارٌ بأن لا بقيّة. */
  if (sequential) return rest > 0 ? TAIL.more(rest) : TAIL.ask
  const span = spanYears(rows)
  const chase = span ? Number(span.to) - Number(span.from) : 0
  /* الأفوردانس لا تُبتلَع: ما دامت نصوصٌ لم تُعرض فدعوة «زدني» واجبةٌ ليبلغها
     السائل. فإن حضرت الدهشة (خمسُ سنين فأكثر) والبقيةُ معاً جمعناهما في ذيلٍ
     واحد؛ وإن لم تبقَ بقيّةٌ فالدهشة وحدها تكفي. */
  if (rest > 0) return chase >= 5 ? TAIL.chaseMore(chase, rest) : TAIL.more(rest)
  return chase >= 5 ? TAIL.chase(chase) : ''
}

/**
 * التركيب. الوضع الأصلي يعرض الطرفين (أقدم وأحدث) ليرى السائل المسار.
 * والوضع المتتابع (sequential) يعرضها بالترتيب دفعةً بعد دفعة — وهو ما تحتاجه
 * «زدني»: من رأى الطرفين لا يُعاد عليه أحدهما، بل يُعطى ما لم يره.
 */
export function compose(rows = [], { sequential = false } = {}) {
  if (!rows.length) return { header: '', text: SCAFFOLD.none, citations: [] }
  const span = spanYears(rows)
  const chosen = sequential ? rows.slice(0, 2) : (span ? [span.earliest, span.latest] : rows.slice(0, 2))
  const header = sequential
    ? SCAFFOLD.moreHeader
    : (span ? SCAFFOLD.manyHeader(rows.length, span.from, span.to) : SCAFFOLD.onceHeader)
  const citations = chosen.map((row) => ({
    slug: row.item.slug,
    title: row.item.title,
    url: row.item.url,
    when: stamp(row.item.date),
    quote: row.quote.text,
  }))
  const footer = tailFor(rows, citations.length, { sequential })
  return { header, citations, footer, text: render(header, citations, footer) }
}

/**
 * الافتتاح عند الإيقاظ. لا نستقبل بجملةٍ جوفاء: نُعرّف، ثم نُري السائل جملةً
 * حقيقيةً من أحدث ما كتب الدكتور — طُعمٌ من كلامه هو، لا وعدٌ من عندنا.
 * وهي استشهادٌ كامل يمرّ بالبوابة كسائر الاستشهادات.
 */
export function welcome(items = []) {
  const newest = items
    .filter((item) => item?.kind === 'article' && item?.body && item?.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
  if (!newest) return { header: SCAFFOLD.welcomeHeader, citations: [], footer: TAIL.ask, text: render(SCAFFOLD.welcomeHeader, [], TAIL.ask) }

  /* أطول جملةٍ مكتملة في أحدث مقال: أوقعُ من أولى جمله وأدلُّ على روحه */
  const best = sentences(newest.body)
    .filter((sentence) => sentence.words.length >= 6)
    .sort((a, b) => b.words.length - a.words.length)[0]
  if (!best) return { header: SCAFFOLD.welcomeHeader, citations: [], footer: TAIL.ask, text: render(SCAFFOLD.welcomeHeader, [], TAIL.ask) }

  const citations = [{ slug: newest.slug, title: newest.title, url: newest.url, when: stamp(newest.date), quote: best.text }]
  return { header: SCAFFOLD.welcomeHeader, citations, footer: TAIL.ask, text: render(SCAFFOLD.welcomeHeader, citations, TAIL.ask) }
}

/* ═══ ٥ · البوابة — آخر ما يمرّ عليه الردّ قبل الإرسال ═══ */

/**
 * بوابةٌ من شقّين. ولا تقرأ الرموز: متون الدكتور مليئةٌ بـ«…» داخل جمله نفسها،
 * فأيّ بوابةٍ تلتقط ما بين القوسين تنقطع عند أول قوسٍ داخليّ فتحكم على نصٍّ
 * صحيحٍ بالبطلان — أو أخطر: تُمرّر ما بعده دون فحص.
 *
 *   الشقّ الأول — الأصالة: كل اقتباسٍ منسوبٍ إلى مقال يجب أن يوجد حرفاً بحرف
 *   في متن ذلك المقال بعينه. لا في مقالٍ آخر، ولا مقارباً له.
 *
 *   الشقّ الثاني — عدم الدسّ: نُعيد بناء الرسالة من الاستشهادات المُصدَّقة
 *   بالراسم نفسه، ثم نطابقها بالرسالة المعروضة حرفاً بحرف. فإن زاد فيها سطرٌ
 *   واحد — ولو كلمة ربطٍ بريئة — اختلّت المطابقة وسقط الردّ.
 *
 * وسقوط جزءٍ يُسقط الكل: لا نحذف الفاسد ونُرسل الباقي، لأن الاقتباس المبتور
 * قد يقلب المعنى إلى نقيضه، وقلبُ المعنى تحريفٌ وإن كان كل حرفٍ فيه صحيحاً.
 */
export function verify(reply, items = []) {
  const bySlug = new Map(items.map((item) => [item?.slug, String(item?.body || '')]))
  const citations = reply?.citations || []
  const failures = []

  for (const citation of citations) {
    const body = bySlug.get(citation?.slug)
    if (!body) { failures.push({ reason: 'مقال غير معروف', slug: citation?.slug }); continue }
    if (!body.includes(String(citation?.quote || ''))) {
      failures.push({ reason: 'نصٌّ غير موجود في المتن', slug: citation?.slug, quote: citation?.quote })
    }
  }
  if (failures.length) return { ok: false, sent: '', failures }

  /* الذيل بابٌ جديد للكلام، فيُقفل كما أُقفل ما قبله: لا يُقبل إلا ما طابق
     قوالبه المجمّدة حرفاً بحرف — لا يتغيّر فيها إلا عددٌ أو سنة. ولولا هذا
     الشرط لصار «الذيل» ثغرةً يمرّ منها أيّ نصٍّ منسوبٍ إلى الدكتور. */
  if (!isKnownTail(reply?.footer)) {
    return { ok: false, sent: '', failures: [{ reason: 'ذيلٌ خارج القوالب المعتمدة', footer: reply?.footer }] }
  }
  if (!isKnownHeader(reply?.header)) {
    return { ok: false, sent: '', failures: [{ reason: 'ترويسةٌ خارج القوالب المعتمدة', header: reply?.header }] }
  }

  const rebuilt = citations.length || reply?.footer
    ? render(reply?.header || '', citations, reply?.footer || '')
    : SCAFFOLD.none
  if (rebuilt !== String(reply?.text || '')) {
    return { ok: false, sent: '', failures: [{ reason: 'الرسالة لا تطابق ما صُدِّق عليه' }] }
  }
  return { ok: true, sent: reply.text, failures: [] }
}

/**
 * الطريق الكامل: سؤال ← بحث ← تركيب ← بوابة. ما يرجع منه يُرسل كما هو.
 *
 * ويرجع معه `reserve`: أسماءُ ما وجده ولم يعرضه. كان يُرمى، فيقول الذيل
 * «وله في هذا نصٌّ آخر» ولا يبقى أثرٌ لذلك النصّ؛ فإذا كتب السائل «زدني»
 * بحثنا له بمحرّكٍ آخر فلا يجد. الآن يُحفظ في الجلسة ويُسلَّم عند الطلب.
 *
 * والحدُّ ثمانية لا ثلاثة: الوعد بواحدٍ آخر ثم انقطاعُ الحديث بخلٌ في مكتبةٍ
 * عاد صاحبها إلى بعض أفكاره خمس مرات. والعدد في الترويسة يبقى صادقاً لأنه
 * يُحسب من الصفّ نفسه لا من رقمٍ مكتوب.
 */
export function answer(items = [], question = '', { limit = 8, skip = [], sequential = false } = {}) {
  const skipped = new Set(skip)
  const rows = search(items, question, { limit }).filter((row) => !skipped.has(row.item.slug))
  if (!rows.length) return { text: SCAFFOLD.none, verified: true, citations: [], reserve: [] }
  const reply = compose(rows, { sequential })
  const gate = verify(reply, items)
  if (!gate.ok) return { text: '', verified: false, citations: [], reserve: [], failures: gate.failures }
  const shown = new Set(reply.citations.map((citation) => citation.slug))
  return {
    text: gate.sent,
    verified: true,
    citations: reply.citations,
    reserve: rows.map((row) => row.item.slug).filter((slug) => !shown.has(slug)),
  }
}

/* ═══ ٦ · الاختبارات ═══ */

if (process.argv.includes('--self-test')) {
  const assert = (condition, message) => { if (!condition) throw new Error(`✘ ${message}`) }
  const items = [
    {
      kind: 'article', slug: 'exam', title: 'حين يصبح الامتحان هو الهدف', date: '2019-05-10',
      url: 'https://dr-alfailakawi.com/articles/exam',
      body: 'وهل الامتحان في بيوتنا يقيس الفهم أم يقيس مقدار الخوف؟ حين يصبح الامتحان هو الهدف، يضيع الهدف الحقيقي من التعليم. والتلقين لا يصنع عقلاً ناقداً مهما تكرر.',
    },
    {
      kind: 'article', slug: 'degree', title: 'شهادة بدون عقل', date: '2026-04-17',
      url: 'https://dr-alfailakawi.com/articles/degree',
      body: 'الشهادة التي لا تُصنع بالوعي هي شهادة موضوعة على الرف، لا على العقل. والعقل الذي لا يُختبر بالسؤال هو عقل لا يزال في الطور الأول.',
    },
    {
      kind: 'article', slug: 'roots', title: 'جيل بلا جذور', date: '2021-02-01',
      url: 'https://dr-alfailakawi.com/articles/roots',
      body: 'تدعم ذلك أبحاث الهوية السردية؛ فقد وجدت دراسة أن معرفة الطفل بقصة عائلته ترفع مرونته النفسية.',
    },
  ]

  /* التقطيع لا يخترع نصاً */
  for (const item of items) {
    for (const sentence of sentences(item.body)) {
      assert(item.body.includes(sentence.text), `الجملة المقتطعة موجودة حرفياً في المتن: ${sentence.text.slice(0, 30)}`)
    }
  }

  /* الاسترجاع يجد الموضوع الصحيح */
  const examRows = search(items, 'شنو رأي الدكتور في الامتحانات؟')
  assert(examRows.length >= 1, 'يجد مقالاً عن الامتحان')
  assert(examRows[0].item.slug === 'exam', 'أعلى ترجيحٍ للمقال الذي في عنوانه الكلمة')
  assert(items[0].body.includes(examRows[0].quote.text), 'الاقتباس منسوخٌ من المتن حرفياً')

  /* المسار عبر السنوات */
  const both = search(items, 'الشهادة والامتحان والعقل')
  const span = spanYears(both)
  if (span) {
    assert(span.earliest.item.date <= span.latest.item.date, 'الأقدم قبل الأحدث')
    assert(span.from && span.to && span.from <= span.to, 'السنتان الطرفيتان صحيحتان ومرتّبتان')
  }

  /* الردّ الكامل يمرّ من البوابة */
  const good = answer(items, 'الامتحان والفهم')
  assert(good.verified, 'الردّ السليم يمرّ')
  assert(good.text.includes('«'), 'الردّ يحمل اقتباساً موسوماً')
  for (const citation of good.citations) {
    const body = items.find((item) => item.slug === citation.slug).body
    assert(body.includes(citation.quote), 'كل اقتباسٍ في الردّ موجودٌ في متنه')
  }

  /* ★ البوابة ترفض التحريف — قلب الشرط كله */
  const cite = (slug, quote) => {
    const item = items.find((row) => row.slug === slug)
    return { slug, quote, title: item.title, url: item.url, when: 'مايو 2019' }
  }
  const sealed = (header, citations) => ({ header, citations, text: render(header, citations) })

  const invented = sealed(SCAFFOLD.onceHeader, [cite('exam', 'الامتحان يقيس الذكاء وحده ولا شيء غيره.')])
  assert(verify(invented, items).ok === false, '★ جملةٌ لم يقلها الدكتور تُرفض')

  /* التحريف الخفيّ: حرفٌ واحد مقلوب داخل جملةٍ حقيقية (التعليم ← التعلم) */
  const subtle = sealed(SCAFFOLD.onceHeader, [cite('exam', 'حين يصبح الامتحان هو الهدف، يضيع الهدف الحقيقي من التعلم.')])
  assert(verify(subtle, items).ok === false, '★ تبديل حرفٍ واحد يُسقط الردّ')

  /* النسبة إلى مقالٍ آخر: النصّ صحيحٌ لكن صاحبه غير من نُسب إليه */
  const misattributed = sealed(SCAFFOLD.onceHeader, [cite('degree', 'حين يصبح الامتحان هو الهدف، يضيع الهدف الحقيقي من التعليم.')])
  assert(verify(misattributed, items).ok === false, '★ نصٌّ صحيح منسوبٌ لمقالٍ غير مقاله يُرفض')

  /* المقطع المتّصل الحقيقي يُقبل */
  assert(verify(sealed(SCAFFOLD.onceHeader, [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')]), items).ok === true, 'المقطع المتّصل يُقبل')

  /* ★ الدسّ بعد التصديق: نصٌّ صحيح، لكن أُضيف سطرٌ لم يُصدَّق عليه */
  const injected = sealed(SCAFFOLD.onceHeader, [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')])
  injected.text += '\n\nوهذا يعني أن الدكتور يرفض الامتحانات كلها.'
  assert(verify(injected, items).ok === false, '★ سطرٌ مدسوسٌ بعد التصديق يُسقط الردّ')

  /* ★ «…» داخل جملة الدكتور نفسها — العطب الذي أسقط البوابة الأولى */
  const nested = { kind: 'article', slug: 'nest', title: 'الهوية', date: '2025-12-01', url: 'u',
    body: 'أما الهوية الثقافية والعرقية فليست «تفصيلاً تراثياً» بل جذرٌ للانتماء الحقيقي.' }
  const withNested = {
    header: SCAFFOLD.onceHeader,
    citations: [{ slug: 'nest', title: 'الهوية', url: 'u', when: '', quote: 'أما الهوية الثقافية والعرقية فليست «تفصيلاً تراثياً» بل جذرٌ للانتماء الحقيقي.' }],
  }
  withNested.text = render(withNested.header, withNested.citations)
  assert(verify(withNested, [nested]).ok === true, '★ اقتباسٌ فيه «…» داخلية يُقبل — لا تنقطع البوابة عنده')

  /* لا يعرف؟ يصمت ولا يخترع */
  const unknown = answer(items, 'ما رأيك في أسعار النفط والذهب؟')
  assert(unknown.text === SCAFFOLD.none, 'ما لا نصّ فيه ← اعتذارٌ صريح، لا تأليف')
  assert(!unknown.text.includes('«'), 'الاعتذار بلا اقتباسٍ منسوب')

  /* العنوان من كلامه فيُقبل */
  

  /* ★ نصف السؤال ليس جواباً: كلمةٌ تُطابق وأخرى لا ← لا نُوهمه أن الدكتور كتب */
  const halfMatch = { kind: 'article', slug: 'cap', title: 'الرأسمالية والتقنية', date: '2017-03-01', url: 'u',
    body: 'أسباب أسعار هذه التكنولوجيا الخرافية تأتي من الكسب الرأسمالي أكثر من هدفٍ علميّ حقيقيّ.' }
  assert(search([halfMatch], 'أسعار النفط').length === 0, '★ «أسعار النفط» تُرفض ولو طابقت «أسعار»')

  /* ═══ المتعة — وبابها مُقفلٌ كسائر الأبواب ═══ */

  const hello = welcome(items)
  assert(verify(hello, items).ok, 'الافتتاح يمرّ بالبوابة')
  assert(hello.citations[0].slug === 'degree', 'يفتح بأحدث ما كتب الدكتور (2026)')
  assert(items.find((i) => i.slug === 'degree').body.includes(hello.citations[0].quote),
    'وجملة الافتتاح منسوخةٌ من متنه حرفياً — لا ترحيبٌ مخترع')

  /* ★ الذيل بابٌ للكلام، فلا يُقبل إلا من قوالبه */
  const smuggled = { header: SCAFFOLD.onceHeader, citations: [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')], footer: 'ويرى الدكتور أن الامتحانات كلها فاشلة.' }
  smuggled.text = render(smuggled.header, smuggled.citations, smuggled.footer)
  assert(verify(smuggled, items).ok === false, '★ رأيٌ مدسوسٌ في الذيل يُسقط الردّ')

  assert(isKnownTail(TAIL.more(3)) && isKnownTail(TAIL.chase(8)) && isKnownTail(TAIL.ask), 'القوالب الثلاثة معتمدة')
  assert(isKnownTail('') === true, 'لا ذيل ← مقبول')
  assert(isKnownTail('وله في هذا 3 نصوصٍ أخرى — اكتب «زدني». وأنا أرى أنه محق.') === false,
    '★ قالبٌ صحيح أُلحق به كلام يُرفض')

  /* الدهشة تُقال بعددٍ صحيح لا مجاملة */
  const chaseRows = [
    { item: { slug: 'a', date: '2017-09-01' }, quote: { text: 'x' } },
    { item: { slug: 'b', date: '2025-06-01' }, quote: { text: 'y' } },
  ]
  assert(tailFor(chaseRows, 2) === TAIL.chase(8), 'ثماني سنوات تُقال ثمانياً، لا «سنتين»')

  /* ★ العلّة نفسها التي شكا منها الدكتور: الترويسة تعِد بالعدد، والذيل «فكرةٌ
     لاحقتْه» يبتلع دعوة «زدني» فلا يبلغ السائلُ البقية. الآن يجتمعان. */
  const chaseWithRest = [
    { item: { slug: 'a', date: '2017-09-01' }, quote: { text: 'x' } },
    { item: { slug: 'b', date: '2020-01-01' }, quote: { text: 'z' } },
    { item: { slug: 'c', date: '2025-06-01' }, quote: { text: 'y' } },
  ]
  assert(tailFor(chaseWithRest, 2) === TAIL.chaseMore(8, 1), '★ مع بقيّةٍ ودهشة: يُقال العدد و«زدني» معاً — لا تُبتلع الدعوة')
  assert(isKnownTail(TAIL.chaseMore(8, 1)) && isKnownTail(TAIL.chaseMore(8, 3)), 'قالب الدهشة+البقية معتمد')

  /* الترويسة تُعرّف المعروض حين يتجاوز العددُ اثنين، فلا يُفاجأ السائل بطرفين */
  assert(SCAFFOLD.manyHeader(8, '2020', '2026').includes('وهذان طرفاها'), '★ العدد > 2 ← الترويسة تقول إنها الطرفان لا الكل')
  assert(SCAFFOLD.manyHeader(2, '2020', '2026').includes('وهذا نصّه حرفياً'), 'العدد = 2 ← كلاهما معروضٌ فلا تنبيه')

  /* سؤالٌ فارغ لا يُنتج شيئاً */
  assert(search(items, '').length === 0, 'سؤال فارغ ← لا نتائج')
  assert(search(items, 'من هو؟').length === 0, 'كلماتٌ شائعة وحدها ← لا نتائج')

  /* ═══ «زدني» — الوعد يجب أن يُوفى ═══
   *
   * العلّة التي كانت: الذيل يعد بنصوصٍ أخرى، والمحرك يرميها، فإذا طلبها
   * السائل بحث له محرّكٌ آخر فلم يجد. فنختبر الآن سلسلة الوفاء كاملةً. */
  const many = [
    { kind: 'article', slug: 'm1', title: 'التلقين والعقل', date: '2017-01-01', url: 'u1', body: 'التلقين لا يصنع عقلاً ناقداً مهما تكرر على المتعلم. والحفظ وحده لا يكفي.' },
    { kind: 'article', slug: 'm2', title: 'التلقين في المدارس', date: '2019-01-01', url: 'u2', body: 'حين يسود التلقين في المدارس يغيب السؤال، ويصبح المتعلم متلقياً لا مشاركاً.' },
    { kind: 'article', slug: 'm3', title: 'بديل التلقين', date: '2021-01-01', url: 'u3', body: 'بديل التلقين أن نطلب من المتعلم أن يشرح ويقارن ويدافع عن رأيه بالحجة.' },
    { kind: 'article', slug: 'm4', title: 'التلقين والامتحان', date: '2023-01-01', url: 'u4', body: 'يلتقي التلقين والامتحان حين يصير الحفظ طريقاً للنجاة من الدرجة لا للفهم.' },
  ]
  const first = answer(many, 'التلقين')
  assert(first.verified && first.citations.length === 2, 'الدفعة الأولى تعرض شاهدين')
  assert(first.reserve.length === 2, `البقية تُحفظ لا تُرمى — وجدتُ ${first.reserve.length}`)
  assert(first.reserve.every((slug) => !first.citations.some((citation) => citation.slug === slug)),
    'البقية لا تحوي ما عُرض')

  /* ★ الوعد المكتوب في الذيل = ما يستطيع البوت تسليمه فعلاً */
  const promised = /(\d+) نصوصٍ أخرى/.exec(first.text)
  if (promised) {
    assert(Number(promised[1]) === first.reserve.length,
      `★ وعدَ بـ${promised[1]} ويملك ${first.reserve.length} — هذا الخُلف هو العلّة نفسها`)
  }

  /* «زدني»: تُسلَّم البقية بترتيبها، ولا يُعاد ما رآه */
  const seen = first.citations.map((citation) => citation.slug)
  const second = answer(many, 'التلقين', { skip: seen, sequential: true })
  assert(second.verified && second.citations.length === 2, '«زدني» تُسلّم الدفعة التالية')
  assert(second.citations.every((citation) => !seen.includes(citation.slug)), '★ «زدني» لا تُعيد ما عُرض')
  assert(second.text.startsWith(SCAFFOLD.moreHeader), '«زدني» تفتح بترويسة البقية')
  assert(second.reserve.length === 0, 'نفدت البقية بعد الدفعة الثانية')

  /* وحين تنفد فعلاً: إقرارٌ صريح لا «ما عندي شيءٌ قريب» بعد وعدٍ صريح */
  const exhausted = answer(many, 'التلقين', { skip: many.map((item) => item.slug), sequential: true })
  assert(exhausted.text === SCAFFOLD.none, 'ما بعد النفاد اعتذارٌ صريح لا اختراع')

  /* ═══ الترويسة مُقفلةٌ كالذيل ═══ */
  assert(isKnownHeader(SCAFFOLD.onceHeader) && isKnownHeader(SCAFFOLD.moreHeader), 'الترويسات المعتمدة تُقبل')
  assert(isKnownHeader(SCAFFOLD.manyHeader(3, '2017', '2023')), 'ترويسة التعدّد تُقبل')
  assert(isKnownHeader('كتب د. أحمد أن التلقين خطأ:') === false, '★ ترويسةٌ حرّة تُرفض')
  const foreignHeader = sealed('وهذا رأيي في المسألة:', [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')])
  assert(verify(foreignHeader, items).ok === false, '★ ترويسةٌ خارج القوالب تُسقط الردّ ولو صحّ اقتباسه')

  console.log('✓ اختبارات المكتبة التي تمشي: 43/43')
}
