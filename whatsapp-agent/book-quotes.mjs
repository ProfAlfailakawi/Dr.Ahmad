/**
 * البوت يقتبس من كتب الدكتور.
 *
 * قبل هذا كان البوت يعرف عناوين الكتب فقط، فيردّ بروابط. والآن يملك متونها
 * التسعة (٨٤٨ مقطعاً) فيردّ **بكلام الدكتور نفسه** منسوباً إلى كتابه وصفحته.
 * جملةٌ من كتابه أصدق من قائمة روابط، وأقرب إلى ما يريده السائل.
 *
 * القيود المتوارثة: لا يُرسل ملف الكتاب، ولا يُرسل أكثر من مقطعٍ واحد في
 * الرسالة، ولا يُقتبس إلا ما تجاوز عتبة تطابقٍ معتبرة — فلا يُنسب إلى
 * الدكتور كلامٌ في موضوعٍ لم يتناوله.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CANDIDATES = [
  resolve(HERE, '../src/data/book-passages.json'),
  resolve(process.cwd(), 'src/data/book-passages.json'),
]

const SITE_URL = (process.env.SITE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')

let corpus = null
function load() {
  if (corpus) return corpus
  const path = CANDIDATES.find((item) => existsSync(item))
  corpus = path ? JSON.parse(readFileSync(path, 'utf8')) : { books: [] }
  return corpus
}

const STOP = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون هل كيف ماذا لماذا شنو وش يعني رايك رايه الدكتور دكتور احمد الفيلكاوي كتاب كتب'.split(' '))

/* الجمع المكسّر لا تصلحه قاعدة: «أطفال» ليست «طفل» + لاحقة. وهذه أكثر
   الكلمات دوراناً في مجال الدكتور، فبلا ردّها إلى مفردها يفشل البحث في
   أشيع ما يكتبه الناس. قائمةٌ صغيرة مقصودة — لا معجم كامل. */
const BROKEN_PLURALS = {
  اطفال: 'طفل', مدارس: 'مدرس', معلمين: 'معلم', معلمون: 'معلم',
  طلاب: 'طالب', طلبه: 'طالب', كتب: 'كتاب', العاب: 'لعب', الالعاب: 'لعب',
  وسايل: 'وسيل', وسائل: 'وسيل', مفاهيم: 'مفهوم', مناهج: 'منهج',
  اجهزه: 'جهاز', اجهزة: 'جهاز', شاشات: 'شاش', مهارات: 'مهار',
  اهداف: 'هدف', ادوات: 'اداه', بيئات: 'بيئه', فصول: 'فصل',
}

const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word
    .replace(/^(?:[وف])(?=[بكل]ال|ال)/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^[بكل](?=ال.{3,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')
    .replace(/^[وف](?=.{4,})/u, '')
    /* «شاشات» و«شاشة» جذرٌ واحد عند المطابقة؛ بلا توحيدهما يفشل أكثر
       ما يكتبه الناس. نطبّق القاعدة على الطرفين فيبقى الميزان عادلاً. */
    .replace(/(?:ات|ون|ين|ية|يه)$/u, '')
    .replace(/ه$/u, (match, offset, full) => (full.length > 4 ? '' : match)))
  .map((word) => BROKEN_PLURALS[word] || word)
  .filter((word) => word.length > 2 && !STOP.has(word)))

/* عتبة الصدق قائمة على **التغطية** لا على رقمٍ ثابت: سؤالٌ من كلمةٍ واحدة
   يكفيه تطابقها، وسؤالٌ من أربع لا يكفيه تطابق واحدة منها. */
const MIN_SCORE = 8

export function findBookQuote(rawText = '') {
  const query = roots(rawText)
  if (query.size < 1) return null

  let best = null
  for (const book of load().books || []) {
    const titleRoots = roots(book.title)
    for (const passage of book.passages || []) {
      const text = roots(passage.text)
      const concept = roots(passage.conceptTitle || '')
      let score = 0
      let matched = 0
      for (const word of query) {
        const hit = text.has(word) || concept.has(word) || titleRoots.has(word)
        if (hit) matched += 1
        if (text.has(word)) score += 3
        if (concept.has(word)) score += 4
        if (titleRoots.has(word)) score += 2
      }
      if (matched < Math.min(2, query.size)) continue
      /* الأقرب إلى قلمه يسبق عند التساوي — لا نقتبس المترجم ما وجدنا صوته. */
      const voice = Number(passage.voice) || 50
      if (!best || score > best.score || (score === best.score && voice > best.voice)) {
        best = { score, voice, passage, bookTitle: book.title, bookSlug: book.slug }
      }
    }
  }

  return best && best.score >= MIN_SCORE ? best : null
}

/** الردّ الجاهز للإرسال — مقطعٌ واحد، منسوبٌ، ورابط صفحة الكتاب لا ملفه. */
export function bookQuoteReply(rawText = '') {
  const found = findBookQuote(rawText)
  if (!found) return null
  return {
    text: `من كتابه «${found.bookTitle}» (ص ${found.passage.page}):\n«${found.passage.text}»\n${SITE_URL}/publications/${found.bookSlug}#book-knowledge`,
    found,
  }
}
