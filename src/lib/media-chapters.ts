import rawChapters from '../data/media-chapters.json' with { type: 'json' }

/**
 * محاور اللقاءات — للقفز إلى موضع الفكرة داخل الفيديو.
 *
 * المواضع تقديرية (يوتيوب لا يعطي التوقيتات مجاناً)، ومطروحٌ منها هامش أمان
 * فيبدأ التشغيل قبل الجملة. لذلك تُعرض دائماً بكلمة «نحو» — لا نوهم بدقةٍ
 * لا نملكها.
 */
export type MediaChapter = { at: number; label: string; text: string }
export type MediaChapters = {
  videoId: string
  url: string
  title: string
  duration: number
  chapters: MediaChapter[]
}

type ChaptersFile = {
  safetySeconds: number
  coverage: { videos: number; chapters: number }
  items: MediaChapters[]
}

const file = rawChapters as ChaptersFile
const byVideo = new Map(file.items.map((item) => [item.videoId, item]))

export const mediaChapterSafety = file.safetySeconds

export function chaptersForVideo(videoId = ''): MediaChapter[] {
  return byVideo.get(videoId)?.chapters || []
}

/** «نحو ٠٣:٤٥» — الصيغة التي تُعرض للزائر، بصدقها لا بادّعائها. */
export function stamp(at: number) {
  const minutes = Math.floor(at / 60)
  const rest = at % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** رابط يوتيوب عند الموضع نفسه. */
export function chapterUrl(url: string, at: number) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}t=${Math.max(0, at)}`
}

const STOP = new Set('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون'.split(' '))
const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word.replace(/^ال(?=.{3,})/, '').replace(/ات$|ون$|ين$/u, ''))
  .filter((word) => word.length > 2 && !STOP.has(word)))

export type MediaChapterHit = {
  videoId: string
  title: string
  url: string
  chapter: MediaChapter
  score: number
}

/**
 * البحث في المنطوق المرئي: يبحث الزائر عن مصطلح فيصل إلى اللحظة التي تحدث
 * فيها الدكتور عنه أمام الكاميرا — لا إلى أول اللقاء.
 */
export function searchMediaChapters(query: string, limit = 6): MediaChapterHit[] {
  const queryRoots = roots(query)
  if (!queryRoots.size) return []
  const hits: MediaChapterHit[] = []

  for (const item of file.items) {
    for (const chapter of item.chapters) {
      const text = roots(chapter.text)
      let score = 0
      for (const word of queryRoots) if (text.has(word)) score += 1
      if (score > 0) hits.push({ videoId: item.videoId, title: item.title, url: item.url, chapter, score })
    }
  }

  /* محوران لكل لقاء على الأكثر: لا يبتلع لقاءٌ واحد النتيجة. */
  const perVideo = new Map<string, number>()
  return hits
    .sort((left, right) => right.score - left.score || left.chapter.at - right.chapter.at)
    .filter((hit) => {
      const used = perVideo.get(hit.videoId) || 0
      if (used >= 2) return false
      perVideo.set(hit.videoId, used + 1)
      return true
    })
    .slice(0, limit)
}
