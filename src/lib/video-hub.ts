/**
 * مدخل الفيديو والموشن — تعريف المسارات الأربعة ومراحل العمل وتسليم المادة بين الأدوات.
 *
 * كان إنتاج الفيديو موزّعاً على أربعة أماكن بأسماء متقاربة (استوديو الريل بوضعين، فيديو المنشور،
 * المخرج الحي، وأطلس القصص الذي يبدو مساراً خامساً). هنا مصدر واحد للحقيقة: ما يفعله كل مسار،
 * وما يفعله الموقع منه وما يتولاه المستخدم يدوياً، وأين يُفتح.
 *
 * الملف نقيّ (بلا React وبلا استيراد) فيُختبر تحت node مباشرة.
 */

export type VideoPathId = 'scenes-reel' | 'drawn-flow-reel' | 'animated-post' | 'director-plan'

/** من يصنع الفيديو نفسه؟ الموقع يرسمه ويصدّره، أم يكتفي بالخطة والبرومبتات ويصنعه المستخدم خارجه. */
export type VideoWho = 'site-renders' | 'user-generates-outside'

export interface VideoPath {
  id: VideoPathId
  title: string
  /** سطر واحد يميّز المسار عن شقيقاته. */
  tagline: string
  input: string
  output: string
  who: VideoWho
  /** نص صريح عمّا يفعله الموقع وما لا يفعله. */
  whoNote: string
  /** تبويب لوحة التحكم الذي يفتحه المسار. */
  tab: 'reel-studio' | 'social-posts' | 'live-director'
  /** وضع استوديو الريل إن كان المسار ريلاً. */
  reelMode?: 'monteur' | 'flow'
  actionLabel: string
  /** مدة تقريبية ليعرف المستخدم ما ينتظره. */
  duration: string
}

export const VIDEO_PATHS: VideoPath[] = [
  {
    id: 'scenes-reel',
    title: 'ريل بمشاهد',
    tagline: 'المونتير: استعارة لكل جملة، إنفوجرافيك، وموسيقى من مكتبتك.',
    input: 'تغريدة أو مقالة أو فكرة قصيرة',
    output: 'فيديو عمودي مسجَّل من مشغّل الموقع (مع حزمة نشر اختيارية)',
    who: 'site-renders',
    whoNote: 'الموقع يبني اللوحة ويشغّلها، وأنت تسجّل تبويب الموقع نفسه عند التصدير ثم يفحص الموقع الملف.',
    tab: 'reel-studio', reelMode: 'monteur',
    actionLabel: 'افتح المونتير',
    duration: '٢٠–٦٠ ثانية',
  },
  {
    id: 'drawn-flow-reel',
    title: 'ريل Flow مرسوم',
    tagline: 'يُرسم كاملاً في متصفحك على لوحة Canvas بصوتٍ مؤلَّف — لا علاقة له بخدمة Flow.',
    input: 'عنوان ومتن، مع اختيار عالم إخراج اختيارياً',
    output: 'MP4/WebM بمقاس 1080×1920 مرسوم ومسجَّل داخل الصفحة',
    who: 'site-renders',
    whoNote: 'الموقع يخطّط المشاهد ويرسمها ويصدّر الملف ويفحصه. بلا خدمة خارجية.',
    tab: 'reel-studio', reelMode: 'flow',
    actionLabel: 'افتح الريل المرسوم',
    duration: '١٨–٣٠ ثانية',
  },
  {
    id: 'animated-post',
    title: 'فيديو منشور متحرك',
    tagline: 'يحرّك تصميم منشورٍ واحد حركةً دلالية قصيرة (حلقة).',
    input: 'فكرة أو جملة تُصمَّم منشوراً',
    output: 'فيديو قصير للمنشور مع بصمة صوتية اختيارية',
    who: 'site-renders',
    whoNote: 'الموقع يصمّم المنشور ويحرّكه ويصدّره ويفحص الملف.',
    tab: 'social-posts',
    actionLabel: 'افتح استوديو المنشور',
    duration: '٥–١٧ ثانية',
  },
  {
    id: 'director-plan',
    title: 'خطة تصوير للمخرج الحي',
    tagline: 'خطة ومقاطع وبرومبتات لتولّدها أنت في Flow؛ الموقع لا يولّد أي مقطع.',
    input: 'مقالة أو موضوع',
    output: 'خطة مقاطع وبرومبتات جاهزة للنسخ، ثم مشروع تُرفع إليه مقاطعك',
    who: 'user-generates-outside',
    whoNote: 'الموقع يكتب الخطة والبرومبتات فقط. توليد المقاطع يتم يدوياً داخل حسابك في Flow خارج الموقع، ثم تعود فترفع الملفات إلى المشروع.',
    tab: 'live-director',
    actionLabel: 'افتح المخرج الحي',
    duration: '٢٤–٦٤ ثانية (مقاطع تولّدها أنت)',
  },
]

export const pathById = (id: VideoPathId): VideoPath => VIDEO_PATHS.find((p) => p.id === id) || VIDEO_PATHS[0]

/** مراحل العمل المشتركة. الترتيب ثابت. */
export const VIDEO_STAGES = [
  { id: 'source', label: 'المصدر', note: 'اختر المادة: من الأطلس أو اكتبها' },
  { id: 'plan', label: 'الخطة', note: 'تُبنى الخطة من المصدر وتُربط ببصمته' },
  { id: 'preview', label: 'المعاينة', note: 'شاهد ما سيُصدَّر قبل أي تسجيل' },
  { id: 'check', label: 'الفحص', note: 'يُفحص الملف الناتج نفسه' },
  { id: 'export', label: 'التصدير', note: 'يُنزَّل الملف، و«جاهز للنشر» فقط إن اجتاز الفحص' },
] as const

export type VideoStageId = (typeof VIDEO_STAGES)[number]['id']

/* ----------------------------- تسليم المادة بين الأدوات ----------------------------- */

export const VIDEO_SEED_KEY = 'admin:video-seed'
export const REEL_SEED_KEY = 'admin:reel-seed'

export interface VideoSeed {
  /** من أين جاءت المادة: الأطلس أو غيره. */
  origin: 'atlas' | 'manual'
  kind?: 'article' | 'paper' | 'book'
  slug?: string
  title: string
  body: string
  excerpt?: string
  cat?: string
}

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** يحمي من بذرة تالفة أو ناقصة: لا عنوان ولا متن = لا بذرة. */
export function parseVideoSeed(raw: string | null): VideoSeed | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<VideoSeed>
    const title = String(value.title || '').trim()
    const body = String(value.body || '').trim()
    if (!title && !body) return null
    return { origin: value.origin === 'atlas' ? 'atlas' : 'manual', kind: value.kind, slug: value.slug, title, body, excerpt: value.excerpt, cat: value.cat }
  } catch { return null }
}

export function writeVideoSeed(storage: StorageLike, seed: VideoSeed): boolean {
  try { storage.setItem(VIDEO_SEED_KEY, JSON.stringify(seed)); return true } catch { return false }
}
export function readVideoSeed(storage: StorageLike): VideoSeed | null {
  try { return parseVideoSeed(storage.getItem(VIDEO_SEED_KEY)) } catch { return null }
}
export function clearVideoSeed(storage: StorageLike) { try { storage.removeItem(VIDEO_SEED_KEY) } catch { /* لا شيء */ } }

export interface ReelSeed { mode: 'monteur' | 'flow'; title: string; body: string }

/** ما يُسلَّم إلى استوديو الريل عند اختيار مسار ريل. null إن لم يكن المسار ريلاً. */
export function reelSeedFor(path: VideoPath, seed: VideoSeed | null): ReelSeed | null {
  if (path.tab !== 'reel-studio' || !path.reelMode) return null
  return { mode: path.reelMode, title: seed?.title || '', body: seed?.body || '' }
}

export function writeReelSeed(storage: StorageLike, seed: ReelSeed): boolean {
  try { storage.setItem(REEL_SEED_KEY, JSON.stringify(seed)); return true } catch { return false }
}
/** تُقرأ مرة واحدة ثم تُمسح، كي لا تُعاد قراءتها في زيارة لاحقة. */
export function takeReelSeed(storage: StorageLike): ReelSeed | null {
  try {
    const raw = storage.getItem(REEL_SEED_KEY)
    if (!raw) return null
    storage.removeItem(REEL_SEED_KEY)
    const value = JSON.parse(raw) as Partial<ReelSeed>
    if (value.mode !== 'monteur' && value.mode !== 'flow') return null
    return { mode: value.mode, title: String(value.title || ''), body: String(value.body || '') }
  } catch { return null }
}

/** بذرة المخرج الحي: نفس شكل الأطلس القائم (article_video) ليبقى المستقبِل كما هو. */
export function directorSeedFor(seed: VideoSeed | null) {
  if (!seed) return null
  return {
    type: 'article_video' as const,
    source: seed.origin === 'atlas' ? `atlas:${seed.kind || 'article'}` : 'video-hub',
    title: seed.title,
    article: { slug: seed.slug || 'hub-seed', title: seed.title, excerpt: seed.excerpt || '', body: seed.body, cat: seed.cat || 'التعليم' },
  }
}

/** بذرة المنشور المستقل (studio-standalone-seed). */
export function standaloneSeedFor(seed: VideoSeed | null) {
  if (!seed) return null
  return { idea: seed.title || seed.body.slice(0, 160), purpose: seed.excerpt || seed.body.slice(0, 200) }
}
