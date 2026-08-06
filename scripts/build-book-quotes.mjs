#!/usr/bin/env node
/**
 * مسبك الاقتباسات العامة — «بعض الكلام من المتن» بإذن الدكتور.
 *
 * العقد الذي يحكم هذا الملف:
 *   ١) المتن الكامل (book-evidence.json) لا يغادر جهاز الدكتور ولا يدخل المستودع.
 *   ٢) ما يُنشر هو مقتطفات مقيسة: جملة أو جملتان، بسقف حرفي صارم، منسوبة
 *      إلى كتابها وصفحتها ومحورها — دليلٌ على الكتاب لا بديلٌ عنه.
 *   ٣) لا فصل كامل، ولا تسلسل يعيد بناء صفحة: اقتباسان بحدٍّ أقصى لكل محور،
 *      ولا اقتباسان متجاوران من الصفحة نفسها.
 *   ٤) الجودة قبل الكثرة: ما لا يصلح للعرض باسم الدكتور يُرفض ولا يُرمَّم.
 *
 * التشغيل: node scripts/build-book-quotes.mjs [--report]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { voiceScore } from './book-voice.mjs'
import { buildEncyclopediaBodyIndex, loadEncyclopediaBook } from './encyclopedia-passage-expansion.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* المتن الخام خارج المستودع عمداً. نبحث عنه في مكانه الطبيعي داخل المشروع،
   ثم بجوار ملفات PDF الأصلية حيث حُفظت نسخته الدائمة. */
const EVIDENCE_CANDIDATES = [
  resolve(ROOT, 'src/data/book-evidence.json'),
  resolve(ROOT, '../PrivateBooks/book-evidence.json'),
  resolve(ROOT, '../../PrivateBooks/book-evidence.json'),
  process.env.BOOK_EVIDENCE || '',
].filter(Boolean)
const EVIDENCE = EVIDENCE_CANDIDATES.find((item) => existsSync(item)) || EVIDENCE_CANDIDATES[0]
const KNOWLEDGE = resolve(ROOT, 'src/data/book-knowledge.json')
const OUT = resolve(ROOT, 'src/data/book-quotes.json')
const OUT_PASSAGES = resolve(ROOT, 'src/data/book-passages.json')
const BLOCKLIST = resolve(ROOT, 'src/data/book-passage-blocklist.json')

/* ═══ الحدود المطلقة — يفرضها الحارس أيضاً، فلا تُوسَّع من هنا وحدها ═══
 *
 * المبدأ الحاكم ليس «قلّة الاقتباسات» بل «تباعدها». الكتاب لا يُعاد تركيبه من
 * مقتطفاتٍ متباعدة بثلاث صفحات، مهما بلغ عددها؛ بينما عشرة اقتباسات متلاصقة
 * تُعيد بناء فصلٍ كامل. لذلك الحدّ الحقيقي هو minPageGap، والسقوف العددية
 * تتناسب مع حجم الكتاب: الموسوعة (٦٩٦ صفحة) لا تُساوى بكتابٍ من ٨٤ صفحة.
 */
export const QUOTE_LIMITS = {
  minChars: 70,
  /* الفهرس يتّسع ليغطي المتن كله؛ والمختارات المعروضة تبقى قصيرة أنيقة. */
  maxChars: 420,
  highlightMaxChars: 240,
  minWords: 9,
  maxDigits: 4,
  /* مختارات صفحة الكتاب: متباعدة عمداً لتبقى «لمحة» تُقرأ في جلسة،
     لا فصلاً متصلاً. أما الفهرس الكامل فلا سقف عليه — أمر الدكتور. */
  highlightPageGap: 3,
  highlightPerIndexedPages: 6,
  minHighlights: 10,
  maxHighlights: 120,
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
export const highlightCap = (indexedPages = 0) =>
  clamp(Math.floor(indexedPages / QUOTE_LIMITS.highlightPerIndexedPages), QUOTE_LIMITS.minHighlights, QUOTE_LIMITS.maxHighlights)

const report = process.argv.includes('--report')

if (!existsSync(EVIDENCE)) {
  console.error('✘ لم أجد متن الكتب. المسارات المجرَّبة:')
  for (const item of EVIDENCE_CANDIDATES) console.error(`   · ${item}`)
  console.error('  عرّفه صراحةً: BOOK_EVIDENCE=/path/to/book-evidence.json node scripts/build-book-quotes.mjs')
  process.exit(1)
}

const evidence = JSON.parse(readFileSync(EVIDENCE, 'utf8'))
const knowledge = existsSync(KNOWLEDGE) ? JSON.parse(readFileSync(KNOWLEDGE, 'utf8')) : { books: [] }
const conceptsBySlug = new Map(knowledge.books.map((book) => [book.slug, book.concepts || []]))

/* قائمة الحجب: ما يستبعده الدكتور بعينه. تُطابق ببصمة النص لا برقم المقطع،
   لأن الأرقام تتغيّر مع كل إعادة توليد بينما النص يبقى. */
const blocklist = existsSync(BLOCKLIST) ? JSON.parse(readFileSync(BLOCKLIST, 'utf8')) : { blocked: [] }
const blockedPrints = new Set((blocklist.blocked || []).map((item) => String(item.fingerprint || '')))
let blockedHits = 0

/* ═══ التنظيف ═══ */
const ARABIC = /[؀-ۿ]/
const LATIN = /[A-Za-z]/

/* ═══ سياسة التنوين ═══
   المتون مستخرَجة من ملفات PDF بتشكيلها المطبوع، وفيها «مشروعً+ا» بينما
   سياسة الموقع «مشروعاً». حارس البناء يرفض غيرها، فنطبّع في المصدر —
   لا نُرخي الحارس. (القاعدة نفسها في scripts/guard-arabic-tanween.mjs) */
const FATHATAN = '\u064B'
const normalizeTanween = (value = '') => String(value)
  .normalize('NFC')
  .replaceAll(`${FATHATAN}ا`, `ا${FATHATAN}`)
  .replace(/([\u0621-\u064A\u0671-\u06D3])[ \t]+([\u064B-\u064D])/g, '$1$2')
  .replace(/([\u064B-\u064D])\1+/g, '$1')

/* رقم الصفحة يلتصق ببداية المقطع عند الاستخراج، وأحياناً يتكرر في نهايته. */
const stripPageNoise = (value) => normalizeTanween(String(value))
  .replace(/^\s*\d{1,4}\s+/, '')
  .replace(/\s+\d{1,4}\s*$/, '')
  .replace(/ /g, ' ')
  .replace(/ـ{2,}/g, '')
  .replace(/\s+/g, ' ')
  .trim()

/* الجملة العربية تنتهي بنقطة أو علامة استفهام أو تعجب. النقطتان والفاصلة
   المنقوطة لا تُنهي جملةً مكتملة المعنى، فلا نقطع عندها. */
const splitSentences = (value) => stripPageNoise(value)
  .split(/(?<=[.؟!])\s+/)
  .map((item) => item.replace(/^[\s.،؛:]+/, '').trim())
  .filter(Boolean)

/* عنوان الفصل أو المحور يسبق أول جملةٍ في المقطع بلا فاصل. نقارن بداية الجملة
   بالعنوان المعروف، فإن طابقته قشرناها — ولا نحذف إلا ما نعرف أنه عنوان. */
function stripLeadingHeading(sentence, headings = []) {
  let text = sentence.trim()
  for (const heading of headings.filter(Boolean)) {
    const clean = String(heading).trim()
    if (!clean || clean.length < 3) continue
    if (text.startsWith(clean) && text.length > clean.length + QUOTE_LIMITS.minChars) {
      text = text.slice(clean.length).replace(/^[\s:،؛.-]+/, '').trim()
    }
  }
  return text
}

/* ═══ بوابات الرفض — كل بوابة تحمي الدكتور من عرضٍ رديء باسمه ═══ */
const BANNED = [
  'ردمك', 'رقم الإيداع', 'مكتبة الكويت الوطنية', 'قائمة المراجع', 'المحتويات',
  'جميع الحقوق', 'الطبعة الأولى', 'دار النشر', 'ص.ب', 'تصميم الغلاف',
]

function rejectionReason(sentence) {
  const text = sentence.trim()
  if (text.length < QUOTE_LIMITS.minChars) return 'قصيرة'
  if (text.length > QUOTE_LIMITS.maxChars) return 'طويلة'

  const words = text.split(/\s+/)
  if (words.length < QUOTE_LIMITS.minWords) return 'كلمات قليلة'

  /* حرفٌ لاتيني واحد يكفي ليكسر اتجاه النص العربي في العرض — نرفض ولا نرمّم. */
  if (LATIN.test(text)) return 'حروف لاتينية'

  /* الأرقام الهندية (٠-٩) أرقامٌ أيضاً — وقد تسللت من قوائم الكتب المطبوعة. */
  const digits = (text.match(/[0-9٠-٩۰-۹]/g) || []).length
  if (digits > QUOTE_LIMITS.maxDigits) return 'أرقام كثيرة'
  if (/^[0-9٠-٩۰-۹]/.test(text)) return 'تبدأ برقم'
  /* رقمٌ ملتحم بحرف («الخبرة 2004إلى») أثرُ حاشيةٍ ابتلعها الاستخراج. */
  if (/[0-9٠-٩۰-۹][؀-ۿ]|[؀-ۿ][0-9٠-٩۰-۹]/.test(text)) return 'رقم ملتحم بالحروف'
  /* رقمٌ وحده بين كلمتين أثرُ ترقيم قائمةٍ أو رقم صفحة تسلّل إلى المتن. */
  if (/\s[0-9٠-٩۰-۹]{1,4}\s/.test(text)) return 'رقم شارد'
  /* النسب المئوية تأتي من جداول ورسوم لا من نثرٍ يُقتبس. */
  if (text.includes('%') || text.includes('٪')) return 'نسبة مئوية'
  /* إحالة مرجعية داخل النص («(عتوم، 2019)») تكسر الاقتباس وتنسبه لغيره.
     وحين يبتلع الاستخراج سنة الإحالة يبقى قوسٌ يضم اسماً وفاصلة ثم نصّاً
     مبتوراً — فنرفض كل قوسٍ يحمل فاصلةً عربية، أو قوسٍ طال حتى صار جملة. */
  for (const group of text.match(/\([^)]*\)/gu) || []) {
    if (group.includes('،') || group.includes(',')) return 'إحالة مرجعية'
    if (group.length > 60) return 'قوس طويل'
  }
  /* نقطة شاردة بين كلمتين («أهمها: . تحديد») أثرُ ترقيم قائمةٍ ضاع رقمه. */
  if (/\s\.\s/.test(text) || text.includes(': .')) return 'نقطة شاردة'

  /* نسبة الحروف العربية: تكشف المقاطع المشوّهة من الجداول والحواشي. */
  const letters = text.replace(/[^\p{L}]/gu, '')
  const arabicLetters = text.replace(/[^؀-ۿ]/g, '')
  if (!letters.length || arabicLetters.length / letters.length < 0.98) return 'نص غير عربي خالص'
  if (!ARABIC.test(text)) return 'بلا عربية'

  /* كلماتٌ مفردة الحرف متتابعة = استخراجٌ متشظٍّ من عمود أو جدول. */
  let singles = 0
  for (const word of words) {
    const bare = word.replace(/[^\p{L}]/gu, '')
    if (bare.length === 1) { singles += 1; if (singles >= 3) return 'نص متشظٍّ' } else singles = 0
  }

  /* الأقواس والاقتباسات غير المتوازنة تعني جملةً مبتورة من سياقها. */
  const pairs = [['(', ')'], ['[', ']'], ['«', '»'], ['“', '”']]
  for (const [open, close] of pairs) {
    const opened = text.split(open).length - 1
    const closed = text.split(close).length - 1
    if (opened !== closed) return 'أقواس غير متوازنة'
  }
  if ((text.split('"').length - 1) % 2 !== 0) return 'اقتباس غير مغلق'

  for (const banned of BANNED) if (text.includes(banned)) return `عبارة ناشر: ${banned}`

  /* ترقيم قوائم («ب- المشاركة… ج- الاستجابة») يعني أننا نقتطع بنداً من قائمة
     لا جملةً قائمة بذاتها. */
  if (/(?:^|\s)[أ-ي]\s*[-–—]\s/u.test(text)) return 'بند قائمة'
  if (/(?:^|\s)[٠-٩0-9]\s*[-–—.)]\s/u.test(text)) return 'بند مرقّم'
  /* نجمة أو شرطة تعداد تسلّلت من قائمة نقطية في الكتاب. */
  if (/[*•▪◦]/.test(text)) return 'رمز تعداد'

  /* سؤالٌ في وسط الاقتباس أثرُ عنوانٍ استفهامي ابتلعه المقطع
     («علم النفس التربوي ما هو علم النفس التربوي؟ يتضمن…»). */
  if (text.slice(0, -1).includes('؟')) return 'استفهام داخلي'

  /* تكرار كلمةٍ داخل نافذة قصيرة أثرُ استخراجٍ مكرّر من عمودٍ أو عنوان. */
  const bare = words.map((word) => word.replace(/[^\p{L}]/gu, ''))
  for (let index = 0; index < bare.length; index += 1) {
    if (bare[index].length < 4) continue
    for (let ahead = 1; ahead <= 3 && index + ahead < bare.length; ahead += 1) {
      if (bare[index] === bare[index + ahead]) return 'تكرار كلمة'
    }
  }

  /* الجملة المكتملة تنتهي بعلامة ختام — وإلا فهي مقطوعة عند حدّ المقطع. */
  if (!/[.؟!]$/.test(text)) return 'بلا نهاية'

  /* لا تبدأ بحرف عطف أو استدراك: الجملة حينها ذيلُ جملةٍ قبلها لا جملةً قائمة.
     («و» و«ف» تلتصقان بما بعدهما فلا ينفع فيهما حدّ الكلمة.) */
  if (/^[وف][؀-ۿ]/u.test(text)) return 'بداية معلّقة'
  if (/^(?:ثم|أو|لكن|كما|أي|إذ|بحيث|حيث|بل|لذلك|ولذلك|كذلك|أيضاً|أما|أمّا|كذا|وعليه)\s/u.test(text)) return 'بداية معلّقة'

  return null
}

/* ═══ الترجيح — أيّ الجمل تستحق أن تُقتبس ═══
   نفضّل الجملة التي تقرّر معنى أو تعرّف مفهوماً على الجملة السردية العابرة. */
const ASSERTIVE = [
  'يقصد', 'تعني', 'يعني', 'تعرف', 'يعرف', 'يعد', 'تعد', 'إن ', 'إنّ', 'لا بد',
  'ينبغي', 'يجب', 'من أهم', 'الهدف', 'تتمثل', 'يتمثل', 'أي أن', 'بمعنى',
  'ومن ثم', 'لذلك', 'ولهذا', 'تكمن', 'يكمن', 'أهمية', 'دور',
]

function quoteScore(text, concept) {
  let score = 0
  for (const marker of ASSERTIVE) if (text.includes(marker)) score += 4
  for (const keyword of concept?.keywords || []) if (text.includes(keyword)) score += 3
  if (concept?.title && text.includes(concept.title)) score += 5
  /* الطول المعتدل أجمل في البطاقة: نكافئ ما بين ١٢٠ و٢٠٠ حرفاً. */
  if (text.length >= 120 && text.length <= 200) score += 3
  /* الجملة التي تحمل مقابلة أو استدراكاً أقرب إلى صوت الدكتور. */
  if (text.includes('بل ') || text.includes('لا ') || text.includes('ليس')) score += 1
  return score
}

/* ═══ البناء ═══ */
const stats = { scanned: 0, accepted: 0, rejected: {} }
const noteRejection = (reason) => { stats.rejected[reason] = (stats.rejected[reason] || 0) + 1 }

const books = []
const passageBooks = []

for (const book of evidence.books || []) {
  const concepts = conceptsBySlug.get(book.slug) || []
  const conceptFor = (page) => concepts.find((item) => page >= item.pageStart && page <= item.pageEnd)
    || concepts.find((item) => Math.abs(item.pageStart - page) <= 2)
    || null

  const candidates = []
  const seen = new Set()

  for (const chunk of book.chunks || []) {
    if (!chunk?.text) continue
    if (chunk.kind === 'references') continue
    if (/قائمة المراجع|المحتويات|الفهرس/u.test(chunk.section || '')) continue

    const concept = conceptFor(chunk.page)
    const sentences = splitSentences(chunk.text)
      /* عنوان القسم أو المحور يلتصق بأول جملة عند الاستخراج، فيقرأ الزائر
         «مقدمة إنَّ الأطفال…». نقشره ولا نرفض الجملة بسببه. */
      .map((sentence, index) => (index === 0 ? stripLeadingHeading(sentence, [chunk.section, concept?.title]) : sentence))

    /* المقاطع مقطوعة عند حدٍّ حرفي، فأول جملة في المقطع ذيلُ جملةٍ سابقة
       غالباً. نتخطاها إلا إذا بدأ المقطع بعنوانٍ صريح — عندئذٍ هي جملة كاملة. */
    const headingStart = stripLeadingHeading(splitSentences(chunk.text)[0] || '', [chunk.section, concept?.title]) !== (splitSentences(chunk.text)[0] || '')
    const startIndex = headingStart ? 0 : 1

    for (let index = startIndex; index < sentences.length; index += 1) {
      /* المرشّح: جملة وحدها، أو جملتان متجاورتان إن كانت الأولى قصيرة. */
      const single = sentences[index]
      const pair = index + 1 < sentences.length ? `${single} ${sentences[index + 1]}` : null
      for (const candidate of [single, pair].filter(Boolean)) {
        stats.scanned += 1
        const reason = rejectionReason(candidate)
        if (reason) { noteRejection(reason); continue }

        /* البصمة تمنع تكرار الجملة نفسها بين المقاطع المتداخلة. */
        /* البصمة بلا تشكيل: حذف المسافات كان يُلصق تنوين آخر كلمة بألف
           الكلمة التالية فيتولّد «ً+ا» الممنوع — عيبٌ في البصمة لا في
           الاقتباس. والتجريد يجعلها أصمد أمام اختلاف التشكيل. */
        const fingerprint = candidate.replace(/[\u064B-\u0652\u0670]/g, '').replace(/[^؀-ۿ]/g, '').slice(0, 60)
        if (seen.has(fingerprint)) { noteRejection('مكرّرة'); continue }

        /* عنوانٌ يظهر في وسط الاقتباس («…لا يتعلمون التقييم التكويني: المفاهيم
           فحسب») يعني أن العنوان اقتحم الجملة عند الاستخراج، فتُقرأ مشوّشة. */
        const bleed = [...(concepts.map((item) => item.title)), chunk.section || '']
          .filter((title) => title && title.length >= 12)
          .some((title) => candidate.indexOf(title) > 0)
        if (bleed) { noteRejection('عنوان داخل الجملة'); continue }

        candidates.push({
          text: candidate,
          page: chunk.page,
          section: chunk.section || '',
          conceptId: concept?.id || '',
          conceptTitle: concept?.title || '',
          score: quoteScore(candidate, concept),
          voice: voiceScore(candidate).score,
          fingerprint,
        })
      }
    }
  }

  /* الاختيار: الأقوى أولاً، بسقف لكل محور، وبلا صفحتين متطابقتين متتاليتين. */
  candidates.sort((left, right) => right.score - left.score || left.page - right.page)

  /* ═══ الطبقة الأولى: الفهرس الكامل — من الجلدة إلى الجلدة ═══
     كل مقطعٍ اجتاز بوابات الجودة يدخل الفهرس، بلا سقفٍ عددي. هذا ما يجعل
     أي سؤالٍ يلمس أي صفحةٍ في أي كتابٍ يجد جوابه. */
  const passages = []
  for (const candidate of candidates.slice().sort((left, right) => left.page - right.page)) {
    if (seen.has(candidate.fingerprint)) continue
    if (blockedPrints.has(candidate.fingerprint)) { blockedHits += 1; noteRejection('محجوب بأمر الدكتور'); continue }

    /* التداخل النصّي يُرفض دائماً: جملتان تشتركان في نصّهما تكرارٌ للقارئ
       وضجيجٌ في البحث، لا فتحُ بابٍ جديد. */
    const bareCandidate = candidate.text.replace(/[\u064B-\u0652\u0670]/g, '').replace(/[^؀-ۿ]/g, '')
    const overlaps = passages.some((item) => {
      if (Math.abs(item.page - candidate.page) > 2) return false
      const bareItem = item.text.replace(/[\u064B-\u0652\u0670]/g, '').replace(/[^؀-ۿ]/g, '')
      const shorter = bareCandidate.length <= bareItem.length ? bareCandidate : bareItem
      const longer = bareCandidate.length <= bareItem.length ? bareItem : bareCandidate
      return longer.includes(shorter) || longer.includes(shorter.slice(0, 40))
    })
    if (overlaps) { noteRejection('تداخل نصّي'); continue }

    seen.add(candidate.fingerprint)
    passages.push(candidate)
    stats.accepted += 1
  }

  /* ═══ الطبقة الثانية: المختارات — واجهة صفحة الكتاب ═══
     أقوى المقاطع، متباعدةً على طول الكتاب، ليأخذ القارئ لمحةً صادقة عن
     الكتاب كله لا عن فصله الأول. */
  const knowledgeRecord = knowledge.books.find((item) => item.slug === book.slug)
  const cap = highlightCap(knowledgeRecord?.indexedPages || book.pageCount || 0)
  const highlightPages = []
  const highlights = []

  /* المختارات تبدأ بما هو أقرب إلى قلمه: الصوت أولاً ثم قوة المقطع. */
  for (const candidate of passages.slice().sort((left, right) => (right.voice - left.voice) * 2 + (right.score - left.score) || left.page - right.page)) {
    if (highlights.length >= cap) break
    if (candidate.text.length > QUOTE_LIMITS.highlightMaxChars) continue
    if (highlightPages.some((page) => Math.abs(page - candidate.page) < QUOTE_LIMITS.highlightPageGap)) continue
    highlightPages.push(candidate.page)
    highlights.push(candidate)
  }
  highlights.sort((left, right) => left.page - right.page)

  const shape = (item, index, prefix) => ({
    id: `${book.slug}-${prefix}${String(index + 1).padStart(3, '0')}`,
    text: item.text,
    page: item.page,
    section: item.section,
    conceptId: item.conceptId,
    conceptTitle: item.conceptTitle,
    voice: item.voice,
    fingerprint: item.fingerprint,
  })

  books.push({
    slug: book.slug,
    title: book.title,
    year: book.year || '',
    pageCount: book.pageCount || 0,
    passageCount: passages.length,
    quotes: highlights.map((item, index) => shape(item, index, 'q')),
  })

  passageBooks.push({
    slug: book.slug,
    title: book.title,
    year: book.year || '',
    passages: passages.map((item, index) => shape(item, index, 'p')),
  })
}

/* ═══ الموسوعة: فهرسٌ من صفحات الكتاب لا من مقاطع المتن العامة ═══
 *
 * المتن العام (book-evidence) مستخرَجٌ بمجرى النص وحده، ومجراه يخلط أعمدة
 * الموسوعة المصمَّمة ويُسقط ما بين «» من تعريفات. فلها بانٍ خاص يقرأ صفحاتها
 * بهندستها وحروفها معاً. وإن تعذّر (لا PyMuPDF أو لا ملفّ) بقي فهرسها كما كان
 * ولم يسقط البناء — ويُعلَن السبب صريحاً. */
const encyclopediaBook = passageBooks.find((book) => book.slug === 'encyclopedia')
let encyclopediaReport = null
if (encyclopediaBook) {
  try {
    const { pages } = loadEncyclopediaBook()
    const built = buildEncyclopediaBodyIndex({
      pages,
      concepts: conceptsBySlug.get('encyclopedia') || [],
      blockedFingerprints: blockedPrints,
      voiceOf: (text) => voiceScore(text).score,
    })
    encyclopediaBook.passages = built.passages
    encyclopediaReport = built.report
    const quotesRecord = books.find((item) => item.slug === 'encyclopedia')
    if (quotesRecord) {
      /* المختارات المعروضة تُشتقّ من الفهرس الجديد نفسه: أقربها إلى قلمه،
         متباعدةً على طول الكتاب كما يشترط حزام الكتب. */
      const cap = highlightCap(knowledge.books.find((item) => item.slug === 'encyclopedia')?.indexedPages || 0)
      const chosenPages = []
      const chosen = []
      for (const passage of [...built.passages].sort((left, right) => (right.voice - left.voice) || left.page - right.page)) {
        if (chosen.length >= cap) break
        if (passage.text.length > QUOTE_LIMITS.highlightMaxChars) continue
        if (chosenPages.some((page) => Math.abs(page - passage.page) < QUOTE_LIMITS.highlightPageGap)) continue
        chosenPages.push(passage.page)
        chosen.push(passage)
      }
      chosen.sort((left, right) => left.page - right.page)
      quotesRecord.quotes = chosen.map((item, index) => ({
        id: `encyclopedia-q${String(index + 1).padStart(3, '0')}`,
        text: item.text,
        page: item.page,
        section: item.section,
        conceptId: item.conceptId,
        conceptTitle: item.conceptTitle,
        voice: item.voice,
        fingerprint: item.fingerprint,
      }))
    }
  } catch (error) {
    console.error(`⚠ تعذّر بناء فهرس الموسوعة من صفحاتها: ${error.message}`)
    console.error('  بقي فهرسها السابق كما هو. (يلزم: pip3 install pypdf pymupdf، وملف الكتاب في PrivateBooks)')
  }
}

const total = books.reduce((sum, book) => sum + book.quotes.length, 0)
const totalPassages = passageBooks.reduce((sum, book) => sum + book.passages.length, 0)
const longest = Math.max(0, ...books.flatMap((book) => book.quotes.map((quote) => quote.text.length)))

writeFileSync(OUT, `${JSON.stringify({
  version: 2,
  policy: 'مختارات منشورة بإذن المؤلف — أقوى المقاطع موزّعةً على طول الكتاب، منسوبةً إلى صفحتها ومحورها.',
  limits: QUOTE_LIMITS,
  builtFrom: 'src/data/book-evidence.json (محلي — لا يُرفع)',
  coverage: { books: books.length, quotes: total, longest },
  books,
}, null, 2)}\n`, 'utf8')

/* الفهرس الكامل ثقيل، فلا يُحمَّل مع الصفحة: يُجلب عند البحث وحده — كما يفعل
   فهرس المنطوق. لذلك يخرج مضغوط التنسيق بلا مسافاتٍ زائدة. */
writeFileSync(OUT_PASSAGES, `${JSON.stringify({
  version: 1,
  policy: 'فهرس متون الكتب التسعة كاملة — للبحث والاستشهاد بإذن المؤلف. لا يُعرض متصلاً ولا يُنشر ملف الكتاب.',
  coverage: {
    books: passageBooks.length,
    passages: totalPassages,
    encyclopediaPassages: encyclopediaBook?.passages.length || 0,
    encyclopediaPagesIndexed: encyclopediaReport?.coveredPageCount || 0,
    encyclopediaBodyPages: encyclopediaReport?.bodyPageCount || 0,
    expansionPolicy: 'فهرس الموسوعة مبنيّ من صفحات الكتاب نفسها: ترتيبُ الهندسة وحروفُ المجرى، بلا توليد ولا إعادة صياغة ولا نوافذ متداخلة.',
  },
  books: passageBooks,
})}\n`, 'utf8')

console.log(`✔ فهرس المتون: ${totalPassages} مقطعاً من ${passageBooks.length} كتاباً — من الجلدة إلى الجلدة`)
if (encyclopediaReport) {
  const { coveredPageCount, bodyPageCount, totalChars, ligatures, offPageWords } = encyclopediaReport
  console.log(`✔ الموسوعة: ${coveredPageCount} صفحة مفهرسة من ${bodyPageCount} صفحة متن (${Math.round(coveredPageCount / bodyPageCount * 100)}٪) · ${totalChars.toLocaleString('ar-EG')} حرفاً`)
  console.log(`   جدول لقاءات الخط: ${ligatures.learned} لقاءً تعلّمها المحرك من ${ligatures.explainedWords.toLocaleString('ar-EG')} كلمة · ${offPageWords} كلمة أثبتها المجرى من موضع آخر`)
}
console.log(`✔ المختارات المعروضة: ${total} اقتباساً (أطولها ${longest} حرفاً)`)
for (const book of books) {
  const passages = passageBooks.find((item) => item.slug === book.slug)?.passages.length || 0
  console.log(`   ${String(passages).padStart(4)} مقطعاً · ${String(book.quotes.length).padStart(3)} مختاراً · ${book.title}`)
}
if (report) {
  console.log('\nالمرشّحون المفحوصون:', stats.scanned)
  const reasons = Object.entries(stats.rejected).sort((a, b) => b[1] - a[1])
  for (const [reason, count] of reasons) console.log(`   ${String(count).padStart(6)} — ${reason}`)
}
