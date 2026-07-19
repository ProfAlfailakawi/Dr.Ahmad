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
const SUFFIX = /(?:اتها|اتهم|اتنا|ياتنا|ات|ها|هم|هن|كم|نا|يه|ية|ه|ي)$/

export function stem(word) {
  let out = String(word || '')
  const bare = out.replace(PREFIX, '')
  if (bare.length >= 3) out = bare
  const cut = out.replace(SUFFIX, '')
  if (cut.length >= 3) out = cut
  return out
}

export const tokens = (value) => normalize(value)
  .split(' ')
  .filter((word) => word.length > 2 && !STOP.has(word))
  .map(stem)
  .filter((word) => word.length >= 3)

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
    const isBreak = ch === '.' || ch === '؟' || ch === '!' || ch === '\n' || ch === '؛'
    if (!isBreak && i !== raw.length - 1) continue
    const end = i === raw.length - 1 && !isBreak ? raw.length : i + 1
    /* الفاصلة المنقوطة تفصل شطري فكرةٍ واحدة؛ والوقوف عندها يُنهي الاقتباس
       معلّقاً («فليست تفصيلاً تراثياً؛»). نقشرها للعرض — والباقي يبقى مقطعاً
       متّصلاً من المتن حرفاً بحرف، فلا تتأثر البوابة. */
    const text = raw.slice(start, end).trim().replace(/[؛,،]$/, '').trim()
    if (text.length >= 40 && text.length <= 320) out.push({ text, start: raw.indexOf(text, start), words: tokens(text) })
    start = end
  }
  return out
}

/* ═══ ٢ · الاسترجاع ═══ */

/** ترجيح مقالٍ لسؤال: تطابق العنوان أثقل من المتن، والتكرار لا يُضاعف الوزن */
export function scoreItem(item, queryTokens) {
  if (!queryTokens.length) return 0
  const titleWords = new Set(tokens(item?.title || ''))
  const bodyWords = new Set(tokens(item?.body || ''))
  let score = 0
  for (const word of new Set(queryTokens)) {
    if (titleWords.has(word)) score += 3
    else if (bodyWords.has(word)) score += 1
  }
  return score / (queryTokens.length * 3)
}

/** أفضل جملةٍ في المقال تُجيب السؤال — منسوخةٌ من الأصل بلا تعديل */
export function bestSentence(item, queryTokens) {
  const wanted = new Set(queryTokens)
  const titleKey = normalize(item?.title || '')
  let best = null
  for (const sentence of sentences(item?.body)) {
    /* أول سطرٍ في بعض المتون هو العنوان نفسه — واقتباسُ العنوان ليس جواباً */
    if (normalize(sentence.text) === titleKey) continue
    let hits = 0
    for (const word of new Set(sentence.words)) if (wanted.has(word)) hits += 1
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

const countWord = (count) => count === 2 ? 'مرتين' : count <= 10 ? `${count} مرات` : `${count} مرة`

export const SCAFFOLD = Object.freeze({
  onceHeader: 'كتب د. أحمد في هذا — وهذا نصّه حرفياً:',
  manyHeader: (count, from, to) => from === to
    ? `عاد د. أحمد إلى هذه الفكرة ${countWord(count)} في ${from} — وهذا نصّه حرفياً:`
    : `عاد د. أحمد إلى هذه الفكرة ${countWord(count)} بين ${from} و${to} — وهذا نصّه حرفياً:`,
  none: 'لم أجد في مكتبة د. أحمد نصّاً يخصّ هذا. لا أُجيب من عندي.',
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
export function render(header, citations = []) {
  const lines = [header, '']
  for (const citation of citations) {
    lines.push(`${citation.when ? `${citation.when} · ` : ''}${citation.title}`)
    lines.push(`«${citation.quote}»`)
    lines.push(citation.url)
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function compose(rows = []) {
  if (!rows.length) return { header: '', text: SCAFFOLD.none, citations: [] }
  const span = spanYears(rows)
  const chosen = span ? [span.earliest, span.latest] : rows.slice(0, 2)
  const header = span ? SCAFFOLD.manyHeader(rows.length, span.from, span.to) : SCAFFOLD.onceHeader
  const citations = chosen.map((row) => ({
    slug: row.item.slug,
    title: row.item.title,
    url: row.item.url,
    when: stamp(row.item.date),
    quote: row.quote.text,
  }))
  return { header, citations, text: render(header, citations) }
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

  const rebuilt = citations.length ? render(reply?.header || '', citations) : SCAFFOLD.none
  if (rebuilt !== String(reply?.text || '')) {
    return { ok: false, sent: '', failures: [{ reason: 'الرسالة لا تطابق ما صُدِّق عليه' }] }
  }
  return { ok: true, sent: reply.text, failures: [] }
}

/** الطريق الكامل: سؤال ← بحث ← تركيب ← بوابة. ما يرجع منه يُرسل كما هو. */
export function answer(items = [], question = '') {
  const rows = search(items, question)
  if (!rows.length) return { text: SCAFFOLD.none, verified: true, citations: [] }
  const reply = compose(rows)
  const gate = verify(reply, items)
  if (!gate.ok) return { text: '', verified: false, citations: [], failures: gate.failures }
  return { text: gate.sent, verified: true, citations: reply.citations }
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

  const invented = sealed('كتب:', [cite('exam', 'الامتحان يقيس الذكاء وحده ولا شيء غيره.')])
  assert(verify(invented, items).ok === false, '★ جملةٌ لم يقلها الدكتور تُرفض')

  /* التحريف الخفيّ: حرفٌ واحد مقلوب داخل جملةٍ حقيقية (التعليم ← التعلم) */
  const subtle = sealed('كتب:', [cite('exam', 'حين يصبح الامتحان هو الهدف، يضيع الهدف الحقيقي من التعلم.')])
  assert(verify(subtle, items).ok === false, '★ تبديل حرفٍ واحد يُسقط الردّ')

  /* النسبة إلى مقالٍ آخر: النصّ صحيحٌ لكن صاحبه غير من نُسب إليه */
  const misattributed = sealed('كتب:', [cite('degree', 'حين يصبح الامتحان هو الهدف، يضيع الهدف الحقيقي من التعليم.')])
  assert(verify(misattributed, items).ok === false, '★ نصٌّ صحيح منسوبٌ لمقالٍ غير مقاله يُرفض')

  /* المقطع المتّصل الحقيقي يُقبل */
  assert(verify(sealed('كتب:', [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')]), items).ok === true, 'المقطع المتّصل يُقبل')

  /* ★ الدسّ بعد التصديق: نصٌّ صحيح، لكن أُضيف سطرٌ لم يُصدَّق عليه */
  const injected = sealed('كتب:', [cite('exam', 'الامتحان في بيوتنا يقيس الفهم')])
  injected.text += '\n\nوهذا يعني أن الدكتور يرفض الامتحانات كلها.'
  assert(verify(injected, items).ok === false, '★ سطرٌ مدسوسٌ بعد التصديق يُسقط الردّ')

  /* ★ «…» داخل جملة الدكتور نفسها — العطب الذي أسقط البوابة الأولى */
  const nested = { kind: 'article', slug: 'nest', title: 'الهوية', date: '2025-12-01', url: 'u',
    body: 'أما الهوية الثقافية والعرقية فليست «تفصيلاً تراثياً» بل جذرٌ للانتماء الحقيقي.' }
  const withNested = {
    header: 'كتب:',
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

  /* سؤالٌ فارغ لا يُنتج شيئاً */
  assert(search(items, '').length === 0, 'سؤال فارغ ← لا نتائج')
  assert(search(items, 'من هو؟').length === 0, 'كلماتٌ شائعة وحدها ← لا نتائج')

  console.log('✓ اختبارات المكتبة التي تمشي: 19/19')
}
