/* ═══════════ البحث في المنطوق ═══════════
   الأرشيف المسموع يصير قابلاً للبحث بالكلمة التي نُطقت لا بالعنوان: تكتب
   «الدرجة» فتظهر الجُمل التي قيلت فيها بصوت فهد أو نورة، والنقر يبدأ الصوت
   عند ثانيتها. فيجيبك الأرشيف بصوت الدكتور عند اللحظة التي قالها فيها.

   الفهرس ثقيلٌ عمداً (كل جملةٍ في كل حلقة)، فلا يُحمَّل مع الصفحة: يُجلب مرّةً
   واحدة لمن فتح التبويب فعلاً، ويبقى في الذاكرة بعدها. من لا يبحث في الصوت
   لا يدفع بايتاً واحداً. */

export type SpokenHit = {
  slug: string
  title: string
  startSec: number
  speaker: string
  text: string
}

type SpokenEpisode = { slug: string; title: string; lines: [number, number, string][] }

let cache: SpokenEpisode[] | null = null
let loading: Promise<SpokenEpisode[]> | null = null

export function spokenIndexReady() {
  return cache !== null
}

export async function loadSpokenIndex(): Promise<SpokenEpisode[]> {
  if (cache) return cache
  if (!loading) {
    loading = import('../data/spoken-index.json')
      .then((module) => {
        const data = (module.default || module) as unknown as { episodes?: SpokenEpisode[] }
        cache = Array.isArray(data.episodes) ? data.episodes : []
        return cache
      })
      .catch(() => {
        cache = []
        return cache
      })
  }
  return loading
}

export const normalizeSpoken = (value = '') => value
  .toLowerCase()
  .replace(/[ً-ٰٟ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

/* الترتيب: الجملة التي تحمل كل كلمات السؤال أولاً، ثم الأقصر — لأن الجملة
   القصيرة الحاملة للمعنى أدلّ من فقرةٍ ضاعت فيها الكلمة. ونحدّ العدد لأن
   قائمةً بلا حدٍّ في البحث زحمةٌ لا نتيجة. */
export function searchSpoken(episodes: SpokenEpisode[], query: string, limit = 60): SpokenHit[] {
  const needle = normalizeSpoken(query)
  if (needle.length < 2) return []
  const words = needle.split(' ').filter((word) => word.length > 1)
  if (!words.length) return []
  const hits: (SpokenHit & { score: number })[] = []
  for (const episode of episodes) {
    for (const [startSec, speaker, text] of episode.lines) {
      const haystack = normalizeSpoken(text)
      if (!haystack.includes(words[0]) && !haystack.includes(needle)) continue
      const matched = words.filter((word) => haystack.includes(word)).length
      if (!matched) continue
      hits.push({
        slug: episode.slug,
        title: episode.title,
        startSec,
        speaker: speaker === 1 ? 'نورة' : 'فهد',
        text,
        score: matched * 100 + (haystack.includes(needle) ? 60 : 0) - Math.min(40, text.length / 6),
      })
    }
  }
  return hits
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ score, ...hit }) => hit)
}
