import fs from 'node:fs'
import path from 'node:path'
import { projectRoot, SITE_URL } from './config.mjs'

/* ═══════════ ما قاله الدكتور بصوته، عند ثانيته ═══════════
   حلقات المجلس نصوصُها موقّتة بالثانية (يبنيها scripts/build-listen-index.mjs).
   فحين يسأل أحدهم عن معنى، لم يعد الردّ «هذي أقرب موادّه» — بل الجملةُ نفسها
   التي قالها، ورابطٌ يفتح الحلقة عند اللحظة التي قيلت فيها.

   لا يُرسل البوت صوتاً (قرار الدكتور: «ما احتاج صوتي نهائياً» في الرسائل) —
   يرسل الجملة والرابط، والسماع قرار السائل في الموقع. */

const INDEX_FILE = path.join(projectRoot, 'src', 'data', 'spoken-index.json')

let cache = null

function load() {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'))
    cache = Array.isArray(raw?.episodes) ? raw.episodes : []
  } catch {
    cache = []
  }
  return cache
}

export function spokenIndexSize() {
  return load().reduce((total, episode) => total + (episode.lines?.length || 0), 0)
}

const fold = (value = '') => String(value)
  .toLowerCase()
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/* جذرٌ خفيف: «الدرجات» و«الدرجة» و«درجات» شيءٌ واحد في أذن السائل. نُسقط
   أدوات التعريف واللواصق الشائعة ونكتفي بالبقية — بلا معجم ولا تصريف، فالمطلوب
   أن يجد السائل جملته لا أن نُحلّل نحواً. */
const stem = (word = '') => {
  let out = String(word)
  out = out.replace(/^(وال|بال|فال|كال|لل|ال)/, '')
  out = out.replace(/(اتها|اتهم|اتنا|ياته|ات|ون|ين|ان|ها|هم|هن|كم|نا|ية|ي|ه)$/, '')
  return out.length >= 3 ? out : String(word)
}

/* الكلمات التي تُسأل بها لا يُبحث عنها. تُطوى بالمطواة نفسها التي تُطوى بها
   كلمات السؤال، وإلا مرّت «رأي» بهيئتها المطوية «راي» فأفسدت العدّ. */
const STOP = new Set(['عن', 'في', 'من', 'الى', 'على', 'مع', 'هل', 'ما', 'ماذا', 'لماذا', 'كيف',
  'شنو', 'وش', 'ايش', 'ليش', 'رايك', 'رأيك', 'رأي', 'راي', 'رايكم', 'شرايك', 'الدكتور', 'دكتور',
  'قال', 'يقول', 'قالها', 'موضوع', 'كلام', 'يعني', 'عندك', 'هذا', 'هذه', 'ذلك', 'تكلم', 'حكى'].map(fold))

/* الجملة المختارة: الحاملة لأكثر كلمات السؤال، ثم الأقصر — فالجملة القصيرة
   الحاملة للمعنى أدلّ من فقرةٍ ضاعت فيها الكلمة. ونطلب كلمتين دالّتين على
   الأقل حتى لا يُفتح صوتٌ على مصادفةٍ لفظية. */
export function findSpokenAnswer(rawText, { minWords = 2 } = {}) {
  const needle = fold(rawText)
  if (needle.length < 4) return null
  const words = [...new Set(needle.split(' ').filter((word) => word.length > 2 && !STOP.has(word)))]
  if (words.length < 1) return null
  let best = null
  for (const episode of load()) {
    for (const [startSec, speaker, text] of episode.lines || []) {
      const hay = fold(text)
      const stems = hay.split(' ').map(stem)
      let matched = 0
      for (const word of words) {
        if (hay.includes(word)) { matched += 1; continue }
        const root = stem(word)
        /* المطابقة باتجاهٍ واحد: جذر السؤال يجب أن يكون بدايةَ كلمةٍ في الجملة.
           والاتجاه العكسي كان يجعل «هوية» تُطابق «هو» فيُفتح صوتٌ على مصادفة. */
        if (root.length >= 3 && stems.some((piece) => piece.length >= 3 && (piece === root || piece.startsWith(root)))) matched += 1
      }
      /* شظيةٌ من كلمتين ليست جواباً وإن حملت الكلمة: «وشهادة معلمة.» تُربك
         السائل ولا تُفيده. نطلب جملةً تقف بنفسها، ونرجّح ما يُقرأ في نفَسٍ
         واحد: أقصر من ذلك مبتور، وأطول منه فقرةٌ ضاعت فيها الكلمة. */
      const length = String(text).length
      if (!matched || length < 18) continue
      const lengthPenalty = length < 34 ? (34 - length) * 1.8 : Math.max(0, Math.min(45, (length - 130) / 3))
      const score = matched * 130 - lengthPenalty
      if (!best || score > best.score) {
        best = {
          score,
          matched,
          slug: episode.slug,
          title: episode.title,
          startSec: Number(startSec) || 0,
          speaker: speaker === 1 ? 'نورة' : 'فهد',
          text: String(text),
        }
      }
    }
  }
  if (!best) return null
  /* كلمةٌ واحدة تكفي إن كان السؤال كلمةً واحدة؛ وإلا نطلب اثنتين. */
  if (best.matched < Math.min(minWords, words.length)) return null
  return best
}

export function spokenMoment(hit) {
  if (!hit?.slug) return ''
  const at = Math.max(0, Math.floor(Number(hit.startSec) || 0))
  return `${SITE_URL}/articles/${hit.slug}?t=${at}`
}

export function spokenReply(rawText) {
  const hit = findSpokenAnswer(rawText)
  if (!hit) return null
  return {
    text: `قالها الدكتور في «${hit.title}»:\n«${hit.text}»\n${spokenMoment(hit)}`,
    hit,
  }
}
