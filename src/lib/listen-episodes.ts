import listenIndex from '../data/listen-index.json'
import type { ListenEpisode } from './listen-catalog'

/* الفهرس الكامل — ينفصل عن `listen-catalog` عمداً: القائمة ومشغّل الصوت
   والرئيسية تحتاج «هل يُفتح المجلس؟» وسؤالاً واحداً لا الفهرس كلّه، وهي في
   حزمة الدخول. فلو استوردت الفهرس معها لسافر معها إلى كل زائرٍ ولو لم يفتح
   المجلس قطّ. وهذا الملف لا تستورده إلا صفحة الاستماع، وهي كسولة. */
export const listenEpisodes = ((listenIndex as { episodes?: ListenEpisode[] }).episodes || []) as ListenEpisode[]
