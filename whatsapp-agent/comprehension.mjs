/* ═══ طبقة الفهم ═══
   البوت كان يفهم من يكتب له بالفصحى السليمة. والناس لا يكتبون هكذا في واتساب:
   يمطّون الحروف («شلووووونك»)، ويكتبون بالحروف اللاتينية والأرقام («3ndk maqal
   3an al ta3leem»)، ويخطئون في الهمزة والتاء المربوطة، ويلصقون علاماتٍ غير
   مرئيةٍ تأتي مع النسخ من التطبيقات، ويسقطون حرفاً أو يزيدون حرفاً.
   كل هذا كان يخرج من الفهم إلى «ما لقيت».

   هنا تُعالَج الرسالة قبل أن تُصنَّف: تُنظَّف من غير المرئي، ويُردّ المطّ، وتُوحَّد
   صور الحروف، ثم — إن لزم — تُقرأ اللاتينية عربيةً، ويُصحَّح ما بقي غريباً
   بمقابلته بمفردات الدكتور نفسه. ولا يُقبل تصحيحٌ إلا إذا أدّى إلى كلمةٍ
   يعرفها المعجم؛ فلا نخترع للسائل سؤالاً لم يسأله.

   بلا نموذج لغويّ وبلا خدمة مدفوعة: جداولُ وحسابُ مسافةٍ بين كلمتين. */

/* علامات لا تُرى وتأتي مع اللصق: تُحذف حذفاً لا تُبدّل بفراغ، وإلا شطرت الكلمة. */
const INVISIBLE = /[​-‏‪-‮⁦-⁩﻿­]/g

/* حروفٌ من لوحات فارسية/أردية تصل أحياناً من النسخ. */
const FOREIGN_FORMS = [
  [/[کڪ]/g, 'ك'],
  [/[یىيے]/g, 'ي'],
  [/[ۀە]/g, 'ه'],
  [/ھ/g, 'ه'],
]

export function stripInvisible(value) {
  return String(value || '').replace(INVISIBLE, '')
}

/* المطّ: «مررررحبا» و«شلوووونك». ثلاثةُ أحرفٍ متطابقةٍ فأكثر لا تقع في كلمةٍ
   عربية، والحرفان يقعان («الله»، «مدّ») فلا نمسّهما. */
export function collapseElongation(value) {
  return String(value || '').replace(/(.)\1{2,}/gu, '$1')
}

/* توحيد صور الحروف على ما يكتبه الناس فعلاً:
   الهمزة تُردّ إلى كرسيّها («سؤال» = «سوال»، «مسؤول» = «مسوول») وتُحذف مفردةً،
   لأن أكثر من يكتب بسرعةٍ يكتبها هكذا. وكانت تُردّ إلى «ء» فلا يلتقي الإملاءان. */
export function foldArabicLetters(value) {
  let text = String(value || '')
  for (const [pattern, replacement] of FOREIGN_FORMS) text = text.replace(pattern, replacement)
  return text
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
}

/* ── العربيزي ──
   «3ndk maqal 3an al ta3leem» — أرقامٌ تنوب عن حروفٍ لا مقابل لها في اللاتينية.
   النقل تقريبيّ بطبعه، ولذلك لا يُعتمد وحده: ناتجه يُعرض على مفردات الدكتور،
   فإن لم يطابق شيئاً تُركت الكلمة كما كتبها صاحبها. */
const ARABIZI_DIGRAPHS = [
  ["'3", 'غ'], ["3'", 'غ'], ["7'", 'خ'], ["5'", 'خ'],
  ['kh', 'خ'], ['gh', 'غ'], ['sh', 'ش'], ['th', 'ث'], ['dh', 'ذ'], ['ch', 'تش'],
  ['aa', 'ا'], ['ee', 'ي'], ['oo', 'و'], ['ou', 'و'], ['ii', 'ي'],
]
const ARABIZI_SINGLES = {
  '2': 'ا', '3': 'ع', '5': 'خ', '6': 'ط', '7': 'ح', '8': 'ق', '9': 'ص',
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'ي', f: 'ف', g: 'ق', h: 'ه', i: 'ي',
  j: 'ج', k: 'ك', l: 'ل', m: 'م', n: 'ن', o: 'و', p: 'ب', q: 'ق', r: 'ر',
  s: 'س', t: 'ت', u: 'و', v: 'ف', w: 'و', x: 'كس', y: 'ي', z: 'ز',
}

export function arabiziToArabic(token) {
  let text = String(token || '').toLowerCase()
  for (const [from, to] of ARABIZI_DIGRAPHS) text = text.split(from).join(to)
  let out = ''
  for (const ch of text) out += Object.prototype.hasOwnProperty.call(ARABIZI_SINGLES, ch) ? ARABIZI_SINGLES[ch] : ch
  return out.replace(/(.)\1+/gu, '$1')
}

/* كلماتٌ يكتبها الناس بالعربيزي كثيراً، وهي التي تحمل النيّة لا الموضوع:
   «شلونك»، «ابي»، «عندك»، «لخص». النقل الحرفيّ يخرجها مشوّهةً فلا يعرفها
   المعجم — وهي أصلاً ليست من مفرداته بل من كلام الناس، فتُثبَّت هنا. */
const ARABIZI_WORDS = new Map(Object.entries({
  abi: 'ابي', aby: 'ابي', abghi: 'ابغي', abgha: 'ابغى', abi2: 'ابي',
  bghit: 'بغيت', ureed: 'اريد', ured: 'اريد', ana: 'انا', enta: 'انت', inta: 'انت',
  shlon: 'شلون', shlonik: 'شلونك', shlonk: 'شلونك', shlonich: 'شلونج',
  shno: 'شنو', shnu: 'شنو', shino: 'شنو', esh: 'ايش', aish: 'ايش', ash: 'ايش',
  wain: 'وين', wein: 'وين', wen: 'وين', kaif: 'كيف', kef: 'كيف', kaifa: 'كيف',
  mata: 'متى', mta: 'متى', laish: 'ليش', lesh: 'ليش', leah: 'ليش',
  '3ndk': 'عندك', '3endak': 'عندك', '3andak': 'عندك', indak: 'عندك', endk: 'عندك',
  '3an': 'عن', '3ala': 'على', '3la': 'على', min: 'من', fee: 'في', fi: 'في', ila: 'الى',
  maqal: 'مقال', ma8al: 'مقال', maqala: 'مقالة', maqalat: 'مقالات', maqalaat: 'مقالات',
  kitab: 'كتاب', ktab: 'كتاب', kutub: 'كتب', bahth: 'بحث', ab7ath: 'ابحاث', abhath: 'ابحاث',
  ta3leem: 'التعليم', taleem: 'التعليم', ta3lim: 'التعليم', tarbiya: 'التربية', tarbia: 'التربية',
  mujtama3: 'المجتمع', hawiya: 'الهوية', hawiyya: 'الهوية', i3lam: 'الإعلام', e3lam: 'الإعلام',
  technologia: 'تكنولوجيا', teknologia: 'تكنولوجيا', tiknolojia: 'تكنولوجيا',
  thaka2: 'ذكاء', thakaa: 'ذكاء', zaka: 'ذكاء', istinai: 'اصطناعي', istina3i: 'اصطناعي',
  lakhis: 'لخص', lakhes: 'لخص', lakhs: 'لخص', esma3ni: 'اسمعني', sm3ni: 'اسمعني',
  doctor: 'الدكتور', doktor: 'الدكتور', dr: 'الدكتور',
  salam: 'سلام', salaam: 'سلام', marhaba: 'مرحبا', mar7aba: 'مرحبا', hala: 'هلا', halla: 'هلا',
  shukran: 'شكرا', shokran: 'شكرا', na3am: 'نعم', aywa: 'ايوه', ok: 'تمام', tamam: 'تمام',
  zidni: 'زدني', zdni: 'زدني', kammil: 'كمل', kamil: 'كمل',
  akhir: 'اخر', akher: 'اخر', aakher: 'اخر', awal: 'اول', awwal: 'اول',
  jadid: 'جديد', jadeed: 'جديد', li: 'لي', lee: 'لي', elli: 'اللي', illi: 'اللي', ely: 'اللي',
  hatha: 'هذا', hada: 'هذا', sawt: 'صوت', sout: 'صوت', video: 'فيديو', podcast: 'بودكاست',
}))

const LATIN_TOKEN = /^[a-z0-9''`]+$/i
/* كلمةٌ لاتينيةٌ قد تكون عربيّةَ اللفظ: فيها رقمٌ من أرقام العربيزي، أو هي
   حروفٌ خالصةٌ ليست مصطلحاً إنجليزياً معروفاً. */
export function looksArabizi(token) {
  const value = String(token || '')
  if (!LATIN_TOKEN.test(value)) return false
  if (value.length < 2) return false
  if (/[235679]/.test(value)) return true
  return /^[a-z]+$/i.test(value)
}

/* ── مسافة التصحيح ──
   دامِراو-ليفنشتاين: تحتسب الإبدال والحذف والزيادة و«قلب حرفين» — وهذا الأخير
   أكثر أخطاء الكتابة السريعة على الهاتف. */
export function editDistance(a, b, ceiling = 3) {
  const s = String(a || '')
  const t = String(b || '')
  if (s === t) return 0
  if (Math.abs(s.length - t.length) > ceiling) return ceiling + 1
  const rows = s.length + 1
  const cols = t.length + 1
  let prev2 = null
  let prev = new Array(cols)
  for (let j = 0; j < cols; j += 1) prev[j] = j
  for (let i = 1; i < rows; i += 1) {
    const row = new Array(cols)
    row[0] = i
    let best = row[0]
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      let value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1)
      }
      row[j] = value
      if (value < best) best = value
    }
    if (best > ceiling) return ceiling + 1
    prev2 = prev
    prev = row
  }
  return prev[cols - 1]
}

/* كلمةٌ قصيرةٌ لا تحتمل خطأً: تصحيحها يقلب معناها. */
function toleranceFor(word) {
  const length = word.length
  if (length <= 3) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  return 3
}

/* أقرب كلمةٍ في مفردات الدكتور، بشرط أن تكون قريبةً حقاً وأن تكون أقربَ من
   منافستها بفارقٍ واضح — وإلا فالترجيح تخمين. */
export function nearestVocabularyWord(word, vocabulary) {
  const value = String(word || '')
  const tolerance = toleranceFor(value)
  if (!tolerance || !vocabulary || !vocabulary.size) return null
  if (vocabulary.has(value)) return value
  let best = null
  let bestScore = tolerance + 1
  let runnerUp = tolerance + 1
  for (const candidate of vocabulary) {
    if (Math.abs(candidate.length - value.length) > tolerance) continue
    const distance = editDistance(value, candidate, tolerance)
    if (distance < bestScore) {
      runnerUp = bestScore
      bestScore = distance
      best = candidate
    } else if (distance < runnerUp) {
      runnerUp = distance
    }
  }
  if (best === null || bestScore > tolerance) return null
  if (runnerUp === bestScore) return null
  return best
}

const STOP_TOKENS = new Set(['من', 'عن', 'في', 'على', 'الى', 'ما', 'هل', 'ابي', 'ابغي', 'اريد', 'وش', 'شنو', 'كيف', 'وين', 'متى', 'ليش'])
/* أدوات التعريف اللاتينية في العربيزي («el ta3leem»، «al maqal») ليست كلماتٍ
   تُصحَّح، بل تُطرح فلا تُشوّش المطابقة. */
const LATIN_ARTICLES = new Set(['al', 'el', 'il', 'ul', 'la', 'the'])

/**
 * يعيد كتابة الرسالة بأقرب ما يمكن إلى ما قصده صاحبها.
 * لا يغيّر كلمةً إلا إذا صارت بعد التغيير كلمةً يعرفها المعجم.
 *
 * @param {string} normalized الرسالة بعد التطبيع المعتاد
 * @param {Set<string>} vocabulary مفردات الدكتور المطبَّعة
 * @returns {{ text: string, changed: boolean, repairs: Array<[string,string]> }}
 */
export function repairMessage(normalized, vocabulary) {
  const words = String(normalized || '').split(/\s+/).filter(Boolean)
  if (!words.length) return { text: String(normalized || ''), changed: false, repairs: [] }
  const repairs = []
  const out = words.map((word) => {
    if (STOP_TOKENS.has(word)) return word
    if (LATIN_ARTICLES.has(word)) return ''
    if (vocabulary && vocabulary.has(word)) return word

    if (looksArabizi(word)) {
      const known = ARABIZI_WORDS.get(word)
      if (known) { repairs.push([word, known]); return known }
      const guess = arabiziToArabic(word)
      if (vocabulary && vocabulary.has(guess)) { repairs.push([word, guess]); return guess }
      const near = nearestVocabularyWord(guess, vocabulary)
      if (near) { repairs.push([word, near]); return near }
      return word
    }

    const near = nearestVocabularyWord(word, vocabulary)
    if (near && near !== word) { repairs.push([word, near]); return near }
    return word
  })
  const text = out.filter(Boolean).join(' ')
  return { text, changed: text !== normalized, repairs }
}
