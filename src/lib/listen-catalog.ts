import listenIndex from '../data/listen-index.json'

/* فهرس «مجلس الفكرة» — يبنيه scripts/build-listen-index.mjs من حوارات الدكتور
   المقفولة وسجلّ R2. مشتركٌ بين الصفحة والقائمة والرئيسية كي لا تُحمَّل بياناته
   مرتين، ولا يُقرَّر «هل يُعرض المجلس؟» في مكانين بقانونين. */

export type ListenEpisode = {
  slug: string
  title: string
  cat: string
  iso: string
  date: string
  question: string
  speaker: string
  turn: number
  startSec?: number
  durationSec: number
}

export const listenEpisodes = ((listenIndex as { episodes?: ListenEpisode[] }).episodes || []) as ListenEpisode[]

/* دون هذا العدد لا مجلس: صفحةٌ بسطرين ليست مجلساً، ورابطٌ إليها يخذل
   الزائر. يفتح وحده حين يمتلئ الأرشيف — كما يظهر «اللقاء القادم» وحده. */
export const LISTEN_MINIMUM = 3
export const listenIsOpen = listenEpisodes.length >= LISTEN_MINIMUM

/* سؤالٌ واحد للرئيسية يتبدّل مع الوقت لا مع كل رسم: ثباتٌ داخل الجلسة،
   وتجدّدٌ كل ربع ساعة — بلا عشوائيةٍ ترتجف تحت عين الزائر. */
export function rotatingQuestion(now = new Date()): ListenEpisode | null {
  if (!listenEpisodes.length) return null
  const block = Math.floor(now.getTime() / (15 * 60 * 1000))
  return listenEpisodes[block % listenEpisodes.length]
}
