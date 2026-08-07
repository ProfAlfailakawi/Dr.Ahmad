#!/usr/bin/env node
/**
 * مُصرِّف الروح — يحوّل حواراً يدوياً خاماً إلى «روح» يقرأها مصنع الصوت.
 *
 * لماذا يسكن المستودع الآن: الحوارات الـ١٤٤ صُرِّفت مرّةً بأداةٍ خارج المشروع،
 * فبقي المصنع قادراً على توليد ما صُرِّف وعاجزاً عن أي حوارٍ جديد. أي حوارٍ
 * يكتبه الدكتور بعد اليوم كان سيُولَّد بالمحرّك القديم (٢٤ كيلوهرتز، بلا خريطة
 * مشاعر) فيخرج أدنى من الأرشيف كلّه. هذا الملف يسدّ الفجوة: يدخل الخام ويخرج
 * الروح، بالقواعد نفسها التي بنت الـ١٤٣.
 *
 * القواعد التي يفرضها — كلّها مقيسةٌ من الحلقة التي اعتمدها الدكتور بأذنه:
 *  · الأدوار: السؤال والاعتراض لفهد، والبحث لنورة، والحكاية لفهد.
 *  · التناوب: من سأل لا يجيب نفسه (والسؤال البلاغيّ يُستثنى).
 *  · كسر الإيهام: «النصّ» كلمةُ مطبخنا — تصير «المقال» حين تكون فاعلَ قول.
 *  · الإسناد: لا يُسمّى مرجعٌ إلا بمطابقة مفهومٍ صريح من قائمةٍ بيضاء.
 *  · لفظ الاسم: الخاتمة تُشكَّل إلى الصيغة التي اعتمدها بأذنه، لا غيرها.
 *  · الوقفات ⏸ والهمس ~~ والجسور والنَّفَس: بأعدادها المعايرة لا جزافاً.
 *
 * الاستعمال:
 *   node scripts/compile-dialogue-soul.mjs                 # كل ما لم يُصرَّف
 *   node scripts/compile-dialogue-soul.mjs --all           # الجميع من جديد
 *   node scripts/compile-dialogue-soul.mjs <slug> [<slug>] # حلقات بعينها
 *   node scripts/compile-dialogue-soul.mjs --check         # يقارن ولا يكتب
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'manual-dialogues')
const OUT = resolve(ROOT, 'manual-dialogues-soul')

const NAME = 'أَحْمَدْ حُسَيْنْ الفَيْلَكَاوِي'
const CTA_LINE = `ولمن أراد الفكرة كاملة، فليقرأ المقال الأصلي في موقع الدكتور ${NAME}.`

const TASHKEEL = /[ً-ْٰـ]/g
const AR_WORD = /[ء-ي]+/g

/* التجريد: يُسقط التشكيل ويوحّد الهمزات والتاء المربوطة والألف المقصورة،
   فتتطابق «أُمّي» و«امي» و«آمِي». المقارنات كلّها تجري على هذه الصورة. */
const bare = (s) => String(s || '')
  .replace(TASHKEEL, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')

const PREFIX = ['وال', 'بال', 'كال', 'فال', 'ال', 'و', 'ف', 'ب', 'ل', 'ك']
const STOP = new Set((
  'في من على عن إلى أن أنه أنها إن ما لا و هو هي هذا هذه ذلك تلك التي الذي كل بين مع قد لكن بل أو ثم '
  + 'يكون كان كانت هناك حين حيث كما إذا لم لن قبل بعد عند لدى نحو غير سوى إلا أي كي حتى منذ'
).split(/\s+/).map(bare))

function stem(word) {
  let w = bare(word)
  for (const p of PREFIX) {
    if (w.startsWith(p) && w.length - p.length >= 3) { w = w.slice(p.length); break }
  }
  for (const s of ['ات', 'ون', 'ين', 'ها', 'هم', 'نا', 'ه', 'ي']) {
    if (w.endsWith(s) && w.length - s.length >= 3) { w = w.slice(0, -s.length); break }
  }
  return w
}

const contentWords = (text) => new Set(
  (String(text).match(AR_WORD) || []).map(stem).filter((s) => s.length > 2 && !STOP.has(s)))

const isSubset = (a, b) => { for (const x of a) if (!b.has(x)) return false; return true }

/* القائمة البيضاء للإسناد: لا يُسمّى مرجعٌ إلا حين يذكر النصّ مفهومه صراحةً.
   عبارةٌ عائمة («تشير أبحاث حديثة») تُنسب فقط إذا طابق المفهومُ مفتاحاً هنا،
   وإلا تُركت كما هي — فنسبةُ قولٍ إلى باحثٍ لم يقله أسوأ من عبارةٍ عائمة. */
const WHITELIST = [
  [['الهوية السردية', 'سردا متماسكا', 'سرد متماسك', 'قصة متماسكة', 'قصته عن نفسه'],
    'أبحاث الهوية السردية عند دان ماك آدمز ومدرسته'],
  [['الكفاءة الذاتية', 'إيمان الفرد بقدرته', 'الثقة بالقدرة'], 'أبحاث ألبرت باندورا في الكفاءة الذاتية'],
  [['عقلية النمو', 'العقلية الثابتة', 'عقلية ثابتة'], 'أعمال كارول دويك في عقلية النمو'],
  [['التغذية الراجعة'], 'تحليلات جون هاتي الجامعة لأثر الممارسات التعليمية'],
  [['التعلق الآمن', 'نظرية التعلق'], 'أعمال جون بولبي في التعلق'],
  [['منطقة النمو', 'الوساطة الاجتماعية', 'فيغوتسكي'], 'أعمال ليف فيغوتسكي'],
  [['مراحل النمو المعرفي', 'بياجيه'], 'أعمال جان بياجيه في النمو المعرفي'],
  [['بيزا', 'PISA'], 'تقارير بيزا الدولية'],
  [['حالة التدفق', 'الانغماس في العمل'], 'أبحاث ميهاي تشيكسنتميهاي في حالة التدفق'],
  [['الحاجة إلى الانتماء', 'الانتماء حاجة'], 'بحث الحاجة إلى الانتماء لباوميستر وليري'],
  [['بناء الهوية', 'مهام المراهقة', 'تكوين الهوية'], 'ما قرّره إريك إريكسون في نموّ الهوية'],
]
const FLOATING = [
  'تشير أبحاث حديثة إلى أن', 'وتشير دراسات حديثة إلى أن', 'تشير الدراسات إلى أن',
  'أبحاث حديثة', 'دراسة حديثة', 'مراجعة حديثة', 'أبحاث أخرى', 'دراسات حديثة',
  'تحليل حديث', 'بحوث حديثة',
]

/* «النصّ» كلمةُ مطبخنا الداخلي: الحوار يناقش *مقالاً* لا «نصّاً». وتُستبدل حين
   تكون فاعلَ قولٍ أو مفعولَه فقط — فلا تُمسّ «النصوص» ولا «النصف» ولا «النصب». */
const TEXT_WORD = [
  [/(?<![ء-ي])((?:[وفبلك])?ال)نصّ?(?=\s+[يت][ء-ي]{2,}(?![ء-ي]))/g, '$1مقال'],
  [/(?<![ء-ي])((?:[وفبلك])?ال)نصّ?(?=\s+(?:لا|نفسه|أعمق|كذلك)(?![ء-ي]))/g, '$1مقال'],
  [/((?:يطلبه|يطرحه|سؤال|وضع|يقترحه|يذكره|يقوله)\s)((?:[وفبلك])?ال)نصّ?(?![ء-ي])/g, '$1$2مقال'],
  [/((?:أنّ?|لكنّ?|إنّ?|وأنّ?)\s)((?:[وفبلك])?ال)نصّ?(?![ء-ي])/g, '$1$2مقال'],
  [/(?<![ء-ي])((?:[وفبلك])?ال)نصّ?(?=\s+(?:منصف|واضح|أدق|أعمق|أصدق|سبقك|سبق)(?![ء-ي]))/g, '$1مقال'],
  [/((?:و?يقترح|و?يرفض|و?يبدأ|و?ينتهي|و?يقول|و?يسأل)\s)((?:[وفبلك])?ال)نصّ?(?![ء-ي])/g, '$1$2مقال'],
]
const FOURTH_WALL = [
  [/النصّ?\s+يجيب\s*:?/g, 'والجواب عند الباحثين:'],
  [/يقول\s+المقال\s*:?/g, 'وهنا بيت القصيد:'],
  [/النصّ?\s+يقول\s*:?/g, 'وهنا بيت القصيد:'],
  [/المقال\s+يشير\s+إلى/g, 'والإشارة واضحة إلى'],
  [/الكاتب\s+يرى/g, 'والرأي الراجح'],
  [/كما\s+ورد\s+في\s+النصّ?/g, 'كما هو ثابت'],
  [/حسب\s+النصّ?/g, 'وفق ما تقرّر'],
]

/* التشكيل الموجّه: لا يُشكَّل إلا الملتبس، وبشرط سياقٍ يثبت المعنى المقصود. */
const DISAMBIG = [
  [/(?<![ء-ي])الجد(?![ء-ي])/g, 'الجَدّ',
    ['عائل', 'اسرة', 'اسره', 'جده', 'حكاي', 'ابناء', 'ابا', 'ماىد', 'مائد', 'نسب']],
  [/(?<![ء-ي])حكي(?![ء-ي])/g, 'حَكْي', ['حكاي', 'قص', 'روي']],
  [/ليحسن(?=\s+(?:اختيار|الاختيار|صنع))/g, 'ليُحسِنَ', []],
  [/(?<![ء-ي])يدرس(?=\s+(?:التاريخ|المادة|الطلاب|طلابه|أبناءه))/g, 'يُدرِّس', []],
  [/(?<![ء-ي])تدرس(?=\s+(?:التاريخ|المادة|الطلاب|طلابها))/g, 'تُدرِّس', []],
  [/(?<![ء-ي])المعلم(?![ء-ي])/g, 'المُعلِّم', []],
  [/(?<![ء-ي])معلما(?![ء-ي])/g, 'مُعلِّماً', []],
  [/(?<![ء-ي])نعلم(?=\s+(?:أبناءنا|الأبناء|الطلاب|أولادنا))/g, 'نُعلِّم', []],
]

/* المطابقة بحدود الكلمة العربية لا بالحروف: «تحليل» ليست «ليل»، و«كامل» ليست
   «أمّ». المطابقة بالحروف وحدها كانت تُخطئ في ٩٦٪ من المواضع. */
const PRE = '(?:[وفبلك]?ال|[وفبلك])?'
const SUF = '(?:ها|هم|هن|ات|ين|ون|ه|ي|نا|ك)?'
const wordRe = (words) =>
  new RegExp(`(?<![\\u0621-\\u064A])${PRE}(?:${words.join('|')})${SUF}(?![\\u0621-\\u064A])`, 'g')

const RESEARCH_RE = wordRe([
  'دراسة', 'دراسات', 'بحث', 'بحوث', 'أبحاث', 'تحليل', 'تحليلات', 'مراجعة', 'مراجعات',
  'أظهرت', 'تظهر', 'بيّنت', 'بينت', 'نتائج', 'نتيجة', 'إحصاء', 'إحصائية', 'نسبة',
  'مؤشر', 'تقرير', 'تقارير', 'باحث', 'باحثون', 'خبراء', 'بيانات', 'تجربة', 'أدلة',
  'برهن', 'أثبتت', 'أثبت', 'ترتبط', 'يرتبط', 'مقارنة', 'عيّنة', 'عينة', 'استبيان',
])
const NARRATIVE_RE = wordRe([
  'حكاية', 'حكايات', 'قصة', 'قصص', 'جَدّ', 'جد', 'جدة', 'جدته', 'جدتي', 'بيت', 'بيوت',
  'حارة', 'شارع', 'مائدة', 'مدرسة', 'مدارس', 'طفل', 'طفلة', 'أطفال', 'طفولة', 'ابن',
  'أبناء', 'ولد', 'أولاد', 'صديق', 'أصدقاء', 'ذكرى', 'ذكريات', 'مشهد', 'مشاهد',
  'صورة', 'صور', 'يوم', 'أيام', 'ليلة', 'ليال', 'صباح', 'مساء', 'دعاء', 'حضن', 'وجه', 'وجوه',
])
const TENDER_RE = wordRe([
  'جَدّ', 'جد', 'جدة', 'جدته', 'جدتي', 'جدها', 'أمي', 'أمه', 'أمها', 'والدة', 'والدته',
  'أبي', 'أبيه', 'والد', 'والده', 'دعاء', 'طفل', 'طفلة', 'طفولة', 'أطفال', 'حضن',
  'بيتنا', 'بيت', 'حنين', 'ذكرى', 'ذكريات', 'يدها', 'يده', 'يدي', 'رائحة', 'مائدة',
  'حارتنا', 'حارة', 'صوت', 'وجه', 'قلب', 'حضنها', 'صغره', 'صغرها',
])
const cues = (text, pattern) => (String(text).match(pattern) || []).length

const CANON_TYPE = {
  objection: 'gentleObjection', response: 'statement', explanation: 'statement',
  setup: 'statement', example: 'statement', emphasis: 'statement', closing: 'conclusion',
}
const CANON_PAUSE = {
  briefReaction: 480, question: 480, gentleObjection: 480,
  statement: 560, reflection: 760, conclusion: 900,
}

const SELF_Q = ['من أنا', 'أين أنتمي', 'ماذا أؤمن', 'من نحن', 'ما قيمتي']
const TURN_Q = ['فمن أين', 'فماذا', 'فكيف', 'وماذا نفعل', 'ما العمل', 'من أين نبدأ', 'كيف نبدأ',
  'إلى أين', 'فأين', 'وأين نحن', 'ماذا لو', 'كيف نعيد', 'من أين تنبت']

/* يُحذف الدور المحتوى بالكامل داخل جاره — ولا تُحذف فكرة مستقلة أبداً. */
function dedupe(utts) {
  const out = []
  let i = 0
  while (i < utts.length) {
    const cur = utts[i]
    if (i + 1 < utts.length) {
      const nxt = utts[i + 1]
      const a = contentWords(cur.text)
      const b = contentWords(nxt.text)
      if (a.size && b.size) {
        if (isSubset(a, b) && cur.text.length < nxt.text.length) { i += 1; continue }
        if (isSubset(b, a) && nxt.text.length <= cur.text.length) { out.push(cur); i += 2; continue }
      }
    }
    out.push(cur)
    i += 1
  }
  return out
}

function nameAttribution(text) {
  const b = bare(text)
  for (const [keys, named] of WHITELIST) {
    if (!keys.some((k) => b.includes(bare(k)))) continue
    for (const fl of FLOATING) {
      if (text.includes(fl)) return text.replace(fl, named)
    }
    return text
  }
  return text
}

function fixFourthWall(text) {
  let out = text
  for (const [pat, rep] of FOURTH_WALL) out = out.replace(pat, rep)
  for (const [pat, rep] of TEXT_WORD) out = out.replace(pat, rep)
  return out
}

/* التنوين على الظروف والمصادر الشائعة: الآلة الناطقة تقرأ «كثيرا» ساكنةً فتخرج
   مبتورة، و«كثيراً» تخرج كما يُقال. قائمةٌ مغلقة عمداً — لا نُعرب ما لا نجزم
   بإعرابه. وعلامة التنوين تُكتب على الحرف ثم تليها الألف — «كثيراً» — لا أن
   تسبقها: الترتيب المعكوس يخرج حارسُ التنوين عنده بالرمز واحد فيقفل النشر،
   وقد أوقفه مرّةً في ملفٍّ كامل. */
const TANWEEN_WORDS = [
  'كثير', 'قليل', 'أيض', 'تمام', 'دائم', 'أبد', 'جد', 'فعل', 'حق', 'طبع', 'غالب', 'أحيان',
  'مثل', 'خصوص', 'تحديد', 'ضمن', 'سريع', 'بطيئ', 'مباشر', 'واضح', 'تدريج', 'عادة',
  'جميع', 'شخص', 'عموم', 'نسب', 'فور', 'لاحق', 'سابق', 'مؤقت', 'يوم', 'أساس', 'واقع',
]
/* حروف العطف والجرّ تلتصق بالكلمة («وقليلا»، «فتماما»)، فبلا السماح بها في
   المطابقة يبقى نصفُ المواضع بلا تنوين — وهو ما حدث في أول تجربة. */
const TANWEEN_RE = new RegExp(
  `(?<![\\u0621-\\u064A])((?:[وفبلك])?(?:${TANWEEN_WORDS.join('|')})(?:ي)?)ا(?![\\u0621-\\u064A\\u064B-\\u0652])`, 'g')

function vocalize(text) {
  let out = text
  const b = bare(text)
  for (const [pat, rep, ctx] of DISAMBIG) {
    if (ctx.length && !ctx.some((c) => b.includes(c))) continue
    out = out.replace(pat, rep)
  }
  out = out.replace(TANWEEN_RE, '$1اً')
  return out
}

/* يوحّد رسم الاسم إلى الصيغة التي اعتمدها الدكتور بأذنه، مهما كان تشكيل الأصل. */
function fixName(text) {
  const plain = text.replace(TASHKEEL, '')
  if (!plain.includes('الفيلكاوي')) return text
  let cleaned = plain.replace(/(الدكتور\s+)?أحمد\s+حسين\s+الفيلكاوي/g, (_m, p1) => `${p1 || ''}${NAME}`)
  if (!cleaned.includes(NAME)) cleaned = cleaned.replace(/الفيلكاوي/g, 'الفَيْلَكَاوِي')
  return cleaned
}

/* سؤالٌ موجَّهٌ إلى الآخر لا يجيب عنه صاحبه، واعتراضٌ لا يوافق عليه قائله.
   (السؤال البلاغيّ الذي يواصله صاحبه مسموحٌ — «فمن أين تنبت الجذور؟ ربما من…») */
const ADDRESS = new RegExp('(?<![\\u0621-\\u064A])(أ?تعرفين|أ?تعرف|تقصدين|تقصد|ألا ترى|ألا ترين|دعنا|دعيني|دعني|'
  + 'سألتني|أسألك|رأيك|برأيك|ما رأيك|أليس كذلك|أوافقك|قل لي|قولي لي)(?![\\u0621-\\u064A])')
const REPLY = new RegExp('^\\s*(بالتأكيد|نعم|صحيح|بالضبط|طبعا|تماما|أوافقك|فعلا|لا\\.|لا،|بلى|أتفق|هذا صحيح|'
  + 'ربما|بل|أبدا|قطعا)(?![\\u0621-\\u064A])')

function needsTurn(cur, nxt) {
  const asked = cur.deliveryType === 'question' || cur.deliveryType === 'gentleObjection'
    || cur.text.trimEnd().endsWith('؟')
  if (!asked) return false
  if (cur.deliveryType === 'gentleObjection') return true
  if (ADDRESS.test(cur.text)) return true
  return REPLY.test(nxt.text)
}

const flip = (speaker) => (speaker === 'male' ? 'female' : 'male')

function enforceTurnTaking(utts) {
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false
    for (let i = 0; i < utts.length - 1; i += 1) {
      const cur = utts[i]
      const nxt = utts[i + 1]
      if (nxt.speaker !== cur.speaker || !needsTurn(cur, nxt)) continue
      // الخاتمة لنورة دائماً: نقلب السؤال بدلها
      if (i + 1 === utts.length - 1) cur.speaker = flip(cur.speaker)
      else nxt.speaker = flip(nxt.speaker)
      changed = true
    }
    if (!changed) break
  }
  return utts
}

function assignRoles(utts) {
  const n = utts.length
  utts.forEach((u, i) => {
    const r = cues(u.text, RESEARCH_RE)
    const nar = cues(u.text, NARRATIVE_RE)
    let want = null
    if (u.deliveryType === 'question' || u.deliveryType === 'gentleObjection') want = 'male'
    else if (r >= 2 && r > nar) want = 'female'
    else if (nar >= 2 && nar > r) want = 'male'
    if (i === 0) want = 'male'
    if (i === n - 1) want = 'female'
    if (want && u.speaker !== want) u.speaker = want
  })
  // لا يزيد صوتٌ واحد على ثلاثة أدوارٍ متتالية (إلا الافتتاح والختام)
  let run = 0
  let last = null
  utts.forEach((u, i) => {
    if (u.speaker === last) run += 1
    else { run = 1; last = u.speaker }
    if (run > 3 && i > 0 && i < n - 1) {
      const r = cues(u.text, RESEARCH_RE)
      const nar = cues(u.text, NARRATIVE_RE)
      if (Math.abs(r - nar) <= 1) { u.speaker = flip(last); run = 1; last = u.speaker }
    }
  })
  return enforceTurnTaking(utts)
}

function feelingOf(u, prev, idx, isCta) {
  const t = u.text
  const d = u.deliveryType
  const b = bare(t)
  if (isCta) return 'cta'
  if (idx === 0) return 'gravitas'
  if (d === 'question') {
    if (SELF_Q.some((q) => b.includes(bare(q)))) return 'intimate'
    if (TURN_Q.some((q) => b.includes(bare(q)))) return 'wonder'
    return 'curious'
  }
  if (d === 'gentleObjection') return 'challenge'
  if (d === 'conclusion') return 'resolve'
  if (d === 'reflection') {
    return (t.length <= 70 && /(?<![ء-ي])(لكن|لكنه|لكنها|بل)(?![ء-ي])/.test(t))
      ? 'aphorism' : 'intimate'
  }
  if (d === 'briefReaction') {
    if (prev && (prev.deliveryType === 'question' || prev.deliveryType === 'gentleObjection')) return 'firm'
    if (cues(t, RESEARCH_RE)) return 'realization'
    return 'lively'
  }
  if (prev && prev.deliveryType === 'gentleObjection') return 'firm'
  if (cues(t, TENDER_RE) >= 1) return 'warm'
  if (cues(t, RESEARCH_RE) >= 2) return 'plain'
  if (cues(t, NARRATIVE_RE) >= 2) return 'lively'
  return 'plain'
}

/* وقفة الصدمة ⏸ قبل الضربة — مرتّبةٌ بالأولوية ومحدودةُ العدد بثلث الأدوار،
   وهي النسبة المقيسة من الحلقة التي اعتمدها الدكتور. */
function placeBeats(utts) {
  const cap = Math.max(3, Math.min(12, Math.round(utts.length * 0.34)))
  const cands = []
  utts.forEach((u, i) => {
    const t = u.text
    if (t.includes('⏸')) return
    const m = /،\s+(لكن|لكنه|لكنها|بل|غير أن|إلا أن|في حين|بينما|أما)(?![ء-ي])/.exec(t)
    if (m) cands.push([5, i, m.index + 1])
    for (const mq of t.matchAll(/؟\s+(?=[^\s])/g)) cands.push([5, i, mq.index + 1])
    const m2 = /،\s+و(?:لا|ما)(?![ء-ي])\s/.exec(t)
    if (m2) cands.push([4, i, m2.index + 1])
    const m3 = /…\s*/.exec(t)
    if (m3) {
      const end = m3.index + m3[0].length
      cands.push([4, i, end - (t.slice(end - 1, end) === ' ' ? 1 : 0)])
    }
    const m4 = /:\s+/.exec(t)
    if (m4 && t.length - (m4.index + m4[0].length) > 12) cands.push([3, i, m4.index + m4[0].length - 1])
    const m5 = /(?<=[ء-ي])\s+(لكن|لكنه|لكنها|بل)(?![ء-ي])/.exec(t)
    if (m5 && !m) cands.push([3, i, m5.index])
    if (u.deliveryType === 'conclusion') {
      const m6 = /،\s+(?:ل|في|من|إلى|حتى)(?=[ء-ي])/.exec(t)
      if (m6) cands.push([3, i, m6.index + 1])
    }
    const m7 = /،\s+(?:فإن|فمن|فكل|فهو|فهي)(?![ء-ي])/.exec(t)
    if (m7) cands.push([2, i, m7.index + 1])
  })
  cands.sort((a, b) => (b[0] - a[0]) || (a[1] - b[1]))
  const edits = new Map()
  let placed = 0
  for (const [pri, i, pos] of cands) {
    if (placed >= cap) break
    const got = edits.get(i) || []
    if (got.length >= (pri >= 5 ? 2 : 1)) continue
    if (got.includes(pos)) continue
    got.push(pos)
    edits.set(i, got)
    placed += 1
  }
  for (const [i, positions] of edits) {
    let t = utts[i].text
    for (const p of [...positions].sort((a, b) => b - a)) t = `${t.slice(0, p)}⏸${t.slice(p)}`
    utts[i].text = t.replace(/⏸\s*/g, '⏸ ').replace(/ ⏸ /g, '⏸ ')
  }
  return placed
}

/* نبرتان داخل الدور: الشطر الحنون يُهمَس — ثلاثة مواضع كحدٍّ أقصى، وبشرط أن
   يكون الحنوّ في الشطر المهموس نفسه لا في أوّل الجملة. */
function placeHush(utts) {
  let done = 0
  for (const u of utts) {
    if (done >= 3) break
    const t = u.text
    if (t.includes('~~') || t.includes('⏸')) continue
    if (cues(t, TENDER_RE) === 0) continue
    let hit = null
    for (const pat of [/،\s+و(?:لا|ما)(?![ء-ي])\s/, /،\s+(?:بينما|في حين|أما|وأما)(?![ء-ي])\s/, /،\s+(?=[^،]{0,70}$)/]) {
      const cand = pat.exec(t)
      if (!cand) continue
      const tail = t.slice(cand.index)
      if (cues(tail, TENDER_RE) < 1) continue
      if (/[.؟!]\s*\S/.test(tail)) continue
      if (tail.length > 75) continue
      hit = cand
      break
    }
    if (!hit) continue
    const p = hit.index + 1
    u.text = `${t.slice(0, p)} ~~ ${t.slice(p).trimStart()}`
    u.feeling2 = 'hush'
    done += 1
  }
  return done
}

function pickBridges(utts) {
  const n = utts.length
  const want = n >= 24 ? 2 : 1
  let cands = []
  for (let i = 3; i < n - 3; i += 1) {
    const nxt = utts[i + 1]
    let sc = 0
    if (nxt.deliveryType === 'gentleObjection') sc += 3
    if (nxt.deliveryType === 'question') sc += 2
    if (TURN_Q.some((q) => bare(nxt.text).includes(bare(q)))) sc += 3
    if (utts[i].deliveryType === 'reflection' || utts[i].deliveryType === 'conclusion') sc += 1
    if (sc) cands.push([i, sc])
  }
  if (!cands.length) {
    return [...new Set([Math.max(3, Math.floor(n / 3)), Math.max(4, Math.floor((2 * n) / 3))])]
      .sort((a, b) => a - b).slice(0, want)
  }
  const targets = want === 2 ? [n / 3, (2 * n) / 3] : [n / 2]
  const chosen = []
  for (const tg of targets) {
    let best = cands[0]
    let bestKey = null
    for (const c of cands) {
      const key = [-c[1] + (Math.abs(c[0] - tg) / Math.max(n, 1)) * 2, Math.abs(c[0] - tg)]
      if (!bestKey || key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        best = c; bestKey = key
      }
    }
    if (!chosen.includes(best[0])) chosen.push(best[0])
    cands = cands.filter((c) => Math.abs(c[0] - best[0]) > 3)
    if (!cands.length) break
  }
  return chosen.sort((a, b) => a - b)
}

function pickBreath(utts, bridges) {
  const n = utts.length
  for (let i = n - 2; i > Math.max(n - 6, 0) - 1; i -= 1) {
    if (i < 0) break
    if (utts[i].deliveryType === 'conclusion' && !bridges.includes(i - 1) && i - 1 > 0) return [i - 1]
  }
  return [Math.max(1, n - 3)]
}

export function compileSoul(raw, slug) {
  let utts = raw
    .map((u) => {
      const d = CANON_TYPE[u.deliveryType] || u.deliveryType || 'statement'
      return {
        speaker: u.speaker || 'male',
        text: String(u.text || '').trim(),
        deliveryType: d,
        pauseAfterMs: u.pauseAfterMs || CANON_PAUSE[d] || 560,
      }
    })
    .filter((u) => u.text)
  utts = dedupe(utts)
  for (const u of utts) {
    u.text = fixFourthWall(u.text)
    u.text = nameAttribution(u.text)
    u.text = vocalize(u.text)
  }
  // الخاتمة واسم الدكتور — لا حلقة بلا دعوةٍ لقراءة المقال، ولا اسمٌ بغير لفظه
  const last = utts[utts.length - 1]
  if (last && bare(last.text).includes('الفيلكاوي')) {
    last.text = fixName(last.text)
    last.deliveryType = 'conclusion'
  } else {
    utts.push({ speaker: 'female', text: CTA_LINE, deliveryType: 'conclusion', pauseAfterMs: 560 })
  }
  const tail = utts[utts.length - 1]
  if (!tail.text.includes(NAME)) {
    tail.text = tail.text.replace(TASHKEEL, '').replace(/الفيلكاوي/g, 'الفَيْلَكَاوِي')
    tail.text = tail.text.replace(/أحمد\s+حسين\s+الفَيْلَكَاوِي/g, NAME)
  }
  utts = assignRoles(utts)
  placeBeats(utts)
  placeHush(utts)
  const n = utts.length
  utts.forEach((u, i) => {
    u.feeling = feelingOf(u, i ? utts[i - 1] : null, i, i === n - 1)
    let p = CANON_PAUSE[u.deliveryType] || 560
    if (i + 1 < n && (utts[i + 1].deliveryType === 'question' || utts[i + 1].deliveryType === 'gentleObjection')) p = 480
    u.pauseAfterMs = p
  })
  const bridgeAfter = pickBridges(utts)
  const breathAfter = pickBreath(utts, bridgeAfter)
  const utterances = utts.map((u) => {
    const o = { speaker: u.speaker, text: u.text, feeling: u.feeling }
    if (u.feeling2) o.feeling2 = u.feeling2
    o.deliveryType = u.deliveryType
    o.pauseAfterMs = u.pauseAfterMs
    return o
  })
  return { slug, bridgeAfter, breathAfter, utterances }
}

/* ═══════════ التشغيل ═══════════
   لا يعمل إلا حين يُستدعى الملفُّ أمراً. من يستورد compileSoul لاختبارٍ أو
   لأداةٍ أخرى لا ينبغي أن يجد نفسه وقد صرّف الأرشيف كلَّه. */
const runAsCommand = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!runAsCommand) { /* استيرادٌ للمكتبة فقط */ } else await main()

async function main() {
const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const ALL = args.includes('--all')
const FORCE = args.includes('--force')
const named = args.filter((a) => !a.startsWith('--'))

if (!existsSync(SRC)) {
  console.log('لا مجلد manual-dialogues — لا شيء يُصرَّف.')
  process.exit(0)
}
mkdirSync(OUT, { recursive: true })

const available = readdirSync(SRC).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort()
let slugs = named.length ? named : available
if (!named.length && !ALL && !CHECK) {
  slugs = slugs.filter((s) => !existsSync(resolve(OUT, `${s}.soul.json`)))
}

if (!slugs.length) {
  console.log('✔ كل الحوارات مُصرَّفة — لا جديد.')
  process.exit(0)
}

let written = 0
let skipped = 0
let same = 0
const differ = []
for (const slug of slugs) {
  const file = resolve(SRC, `${slug}.json`)
  if (!existsSync(file)) { console.error(`✘ لا يوجد حوار خام باسم ${slug}`); process.exitCode = 1; continue }
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  const doc = compileSoul(raw, slug)
  const body = `${JSON.stringify(doc, null, 2)}\n`
  const target = resolve(OUT, `${slug}.soul.json`)
  if (CHECK) {
    const before = existsSync(target) ? readFileSync(target, 'utf8') : ''
    if (before === body) same += 1
    else differ.push(slug)
    continue
  }
  /* الأرواح الـ١٤٣ القائمة صُرِّفت من نسخةٍ محلّيةٍ مشكَّلة، وقد وُلِّدت منها
     حلقاتٌ اعتمدها الدكتور بأذنه ورُفعت. فإعادةُ تصريفها من الخام الحالي تُنتج
     نصّاً مختلفاً — ودهسُها يعني حلقاتٍ جديدةً لا تطابق ما سمعه. لا يُكتب فوق
     روحٍ قائمة إلا بأمرٍ صريح. */
  if (existsSync(target) && !FORCE) {
    console.warn(`⚠ ${slug} له روحٌ قائمة — تُركت كما هي (‎--force للكتابة فوقها).`)
    skipped += 1
    continue
  }
  writeFileSync(target, body)
  written += 1
  console.log(`✔ ${slug} · ${doc.utterances.length} مداخلة · جسور ${JSON.stringify(doc.bridgeAfter)} · نفَس ${JSON.stringify(doc.breathAfter)}`)
}

if (CHECK) {
  console.log(`مطابق: ${same}/${slugs.length}`)
  if (differ.length) {
    console.log(`مختلف: ${differ.length}`)
    for (const s of differ.slice(0, 10)) console.log(`  - ${s}`)
    process.exitCode = 1
  }
} else {
  console.log(`\n✔ صُرِّف ${written} حواراً إلى أرواح${skipped ? ` · تُركت ${skipped} روحاً قائمة` : ''}.`)
  if (written) console.log('  شغّل «مصنع الروح» ليُولّدها ويرفعها.')
}
}
