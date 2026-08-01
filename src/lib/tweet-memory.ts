/**
 * دفتر «ما نُشر» وذوق التغريد
 *
 * علّتان في استوديو التغريدات كما سلّمته أول مرة: لا يعرف ما نشره الدكتور أمس
 * فيعيده عليه بعد أسبوع، ولا يتعلّم من اختياراته كما يتعلّم استوديو التصاميم.
 * هذا الملف يعالج الاثنتين بدفترٍ واحد:
 *
 *  • **بصمة النص لا نصّه.** التكرار يُمنع بمقارنة بصمةٍ مجرّدةٍ من الروابط
 *    والوسوم والتشكيل والترقيم — فتغريدةٌ أُعيدت بوسمٍ مختلفٍ تُكشف تكراراً.
 *  • **الذوق يُقاس بما نشره فعلاً**، لا بما استحسنه بنقرة: كل تغريدةٍ يعلّمها
 *    «نشرتُها» تدفع زاويتها ومصدرها وطولها إلى الأعلى في الجولة القادمة.
 *
 * والخزن يتبع نمط ذوق التصاميم نفسه: localStorage أولاً (فوريّ ويعمل بلا شبكة)
 * ثم مزامنةٌ إلى `site_settings/tweet-memory` — وهي مجموعةٌ تسمح قواعدُها
 * بالكتابة للمشرف أصلاً، فلا حاجة إلى قاعدةٍ جديدة.
 */

import type { TweetAngleId, TweetDraft, TweetSourceKind } from './tweet-forge'

export const TWEET_MEMORY_VERSION = 1

/** أقصى ما يُحفظ في الدفتر — يبقى دون سقف مستند Firestore بمراحل. */
const MAX_RECORDS = 400

export interface TweetPublishRecord {
  /** بصمة النص — هي مفتاح منع التكرار. */
  id: string
  /** مقتطفٌ للعرض في الدفتر، لا النص كاملاً. */
  excerpt: string
  angle: TweetAngleId
  sourceId: string
  sourceKind: TweetSourceKind
  sourceTitle: string
  publishedAt: string
  score: number
  chars: number
  hadHashtags: boolean
}

export interface TweetTasteProfile {
  version: number
  samples: number
  angles: Partial<Record<TweetAngleId, number>>
  sources: Partial<Record<TweetSourceKind, number>>
  /** ميلٌ إلى الطول: متوسط حروف ما نشره. */
  averageChars: number
  /** كم مرةً أبقى الوسوم مقابل كم مرةً نشر بلا وسم. */
  hashtagYes: number
  hashtagNo: number
  updatedAt: number
}

export interface TweetMemory {
  version: number
  records: TweetPublishRecord[]
  taste: TweetTasteProfile
}

export const createEmptyTweetMemory = (): TweetMemory => ({
  version: TWEET_MEMORY_VERSION,
  records: [],
  taste: { version: TWEET_MEMORY_VERSION, samples: 0, angles: {}, sources: {}, averageChars: 0, hashtagYes: 0, hashtagNo: 0, updatedAt: 0 },
})

/* ------------------------------------------------------------------ */
/*                          بصمة منع التكرار                           */
/* ------------------------------------------------------------------ */

const hashString = (value: string) => {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * تجريدُ النص إلى جوهره: بلا روابط ولا وسوم ولا تشكيل ولا ترقيم، وبألف
 * موحّدة وتاء مبسوطة. هكذا لا تفلت تغريدةٌ أُعيدت بوسمٍ مختلف أو بنقطةٍ زائدة.
 */
export function tweetFingerprint(text: string): string {
  const core = String(text || '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/[ىي]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase()
  return hashString(core).toString(16).padStart(8, '0')
}

/** هل نُشر هذا النص من قبل — أو نصٌّ يطابقه جوهراً؟ */
export const isPublished = (memory: TweetMemory | undefined, text: string) =>
  Boolean(memory?.records.some((record) => record.id === tweetFingerprint(text)))

/** متى نُشر شيءٌ من هذا المصدر آخر مرة (بالأيام)، أو null إن لم يُنشر قط. */
export function daysSinceSource(memory: TweetMemory | undefined, sourceId: string, now: number): number | null {
  const stamps = (memory?.records || [])
    .filter((record) => record.sourceId === sourceId)
    .map((record) => Date.parse(record.publishedAt))
    .filter((stamp) => Number.isFinite(stamp))
  if (!stamps.length) return null
  return Math.floor((now - Math.max(...stamps)) / 86_400_000)
}

/* ------------------------------------------------------------------ */
/*                        الذوق: يتعلّم من النشر                        */
/* ------------------------------------------------------------------ */

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

/**
 * يسجّل تغريدةً نُشرت: تدخل الدفتر، ويرتفع وزن زاويتها ومصدرها.
 * السقف ‎±12‎ يمنع زاويةً واحدة من ابتلاع كل الترشيح مهما تكررت.
 */
export function recordPublishedTweet(memory: TweetMemory, draft: TweetDraft, at: Date): TweetMemory {
  const id = tweetFingerprint(draft.text)
  if (memory.records.some((record) => record.id === id)) return memory
  const record: TweetPublishRecord = {
    id,
    excerpt: draft.text.replace(/\s+/g, ' ').slice(0, 140),
    angle: draft.angle,
    sourceId: draft.sourceId,
    sourceKind: draft.sourceKind,
    sourceTitle: draft.sourceTitle,
    publishedAt: at.toISOString(),
    score: draft.score,
    chars: draft.chars,
    hadHashtags: draft.hashtags.length > 0,
  }
  const records = [record, ...memory.records].slice(0, MAX_RECORDS)
  const samples = memory.taste.samples + 1
  const taste: TweetTasteProfile = {
    ...memory.taste,
    version: TWEET_MEMORY_VERSION,
    samples,
    angles: { ...memory.taste.angles, [draft.angle]: clamp((memory.taste.angles[draft.angle] || 0) + 1, -12, 12) },
    sources: { ...memory.taste.sources, [draft.sourceKind]: clamp((memory.taste.sources[draft.sourceKind] || 0) + 1, -12, 12) },
    averageChars: Math.round((memory.taste.averageChars * (samples - 1) + draft.chars) / samples),
    hashtagYes: memory.taste.hashtagYes + (record.hadHashtags ? 1 : 0),
    hashtagNo: memory.taste.hashtagNo + (record.hadHashtags ? 0 : 1),
    updatedAt: at.getTime(),
  }
  return { version: TWEET_MEMORY_VERSION, records, taste }
}

/** تراجعٌ عن تعليم: يحذف السجل ويخفض وزنه — الخطأ في النقر وارد. */
export function forgetPublishedTweet(memory: TweetMemory, id: string): TweetMemory {
  const record = memory.records.find((item) => item.id === id)
  if (!record) return memory
  const samples = Math.max(0, memory.taste.samples - 1)
  return {
    version: TWEET_MEMORY_VERSION,
    records: memory.records.filter((item) => item.id !== id),
    taste: {
      ...memory.taste,
      samples,
      angles: { ...memory.taste.angles, [record.angle]: clamp((memory.taste.angles[record.angle] || 0) - 1, -12, 12) },
      sources: { ...memory.taste.sources, [record.sourceKind]: clamp((memory.taste.sources[record.sourceKind] || 0) - 1, -12, 12) },
      hashtagYes: Math.max(0, memory.taste.hashtagYes - (record.hadHashtags ? 1 : 0)),
      hashtagNo: Math.max(0, memory.taste.hashtagNo - (record.hadHashtags ? 0 : 1)),
      updatedAt: Date.now(),
    },
  }
}

/**
 * قربُ التغريدة من ذوق الدكتور: ‎-1..1‎. يبقى صفراً حتى تتجمّع خمس عيّنات،
 * فلا يحكم الذوقُ على الاستوديو من تغريدةٍ واحدة.
 */
export function tweetTasteAffinity(taste: TweetTasteProfile | undefined, draft: { angle: TweetAngleId; sourceKind: TweetSourceKind; chars: number }): number {
  if (!taste || taste.samples < 5) return 0
  const angleWeight = (taste.angles[draft.angle] || 0) / 12
  const sourceWeight = (taste.sources[draft.sourceKind] || 0) / 12
  const lengthFit = taste.averageChars
    ? 1 - clamp(Math.abs(draft.chars - taste.averageChars) / 160, 0, 1)
    : 0
  return clamp(angleWeight * .5 + sourceWeight * .28 + lengthFit * .22, -1, 1)
}

/** أوضح ثلاث حقائق يعرفها الدفتر عن ذوق الدكتور — للعرض في اللوحة. */
export function tasteHighlights(taste: TweetTasteProfile | undefined, labelOf: (angle: TweetAngleId) => string): string[] {
  if (!taste || taste.samples < 5) return []
  const out: string[] = []
  const topAngle = (Object.entries(taste.angles) as [TweetAngleId, number][])
    .sort((left, right) => right[1] - left[1])[0]
  if (topAngle && topAngle[1] > 0) out.push(`أكثر زاويةٍ تنشرها: ${labelOf(topAngle[0])}`)
  if (taste.averageChars) out.push(`متوسط طول ما تنشره: ${taste.averageChars} حرفاً`)
  if (taste.hashtagYes + taste.hashtagNo >= 5) {
    out.push(taste.hashtagNo >= taste.hashtagYes ? 'تميل إلى النشر بلا وسوم' : 'تميل إلى إبقاء الوسوم')
  }
  return out
}

/* ------------------------------------------------------------------ */
/*                            الخزن والمزامنة                          */
/* ------------------------------------------------------------------ */

export const TWEET_MEMORY_KEY = 'dr-ahmad-tweet-memory-v1'

export function loadTweetMemory(): TweetMemory {
  if (typeof window === 'undefined') return createEmptyTweetMemory()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TWEET_MEMORY_KEY) || 'null') as TweetMemory | null
    if (!parsed || parsed.version !== TWEET_MEMORY_VERSION || !Array.isArray(parsed.records)) return createEmptyTweetMemory()
    return { ...createEmptyTweetMemory(), ...parsed, taste: { ...createEmptyTweetMemory().taste, ...parsed.taste } }
  } catch { return createEmptyTweetMemory() }
}

export function storeTweetMemory(memory: TweetMemory) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(TWEET_MEMORY_KEY, JSON.stringify(memory)) } catch { /* منعُ التخزين لا يوقف الاستوديو */ }
}

/** يدمج دفترين (جهازٌ آخر): اتحادُ السجلات بلا تكرار، والذوق يُعاد حسابه منها. */
export function mergeTweetMemories(local: TweetMemory, remote: TweetMemory): TweetMemory {
  const byId = new Map<string, TweetPublishRecord>()
  for (const record of [...remote.records, ...local.records]) if (!byId.has(record.id)) byId.set(record.id, record)
  const records = [...byId.values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, MAX_RECORDS)
  return {
    version: TWEET_MEMORY_VERSION,
    records,
    taste: { ...tasteFromRecords(records), updatedAt: Math.max(local.taste.updatedAt, remote.taste.updatedAt) },
  }
}

/**
 * الذوق يُشتقّ من السجلات لا يُجمع من الطرفين — لو جُمع لضوعف وزنُ كل تغريدةٍ
 * موجودةٍ في الجهازين. وهذا يجعل الدمج عمليةً عديمة الأثر عند تكراره.
 */
export function tasteFromRecords(records: readonly TweetPublishRecord[]): TweetTasteProfile {
  const taste = createEmptyTweetMemory().taste
  if (!records.length) return taste
  const angles: TweetTasteProfile['angles'] = {}
  const sources: TweetTasteProfile['sources'] = {}
  let chars = 0
  let hashtagYes = 0
  for (const record of records) {
    angles[record.angle] = clamp((angles[record.angle] || 0) + 1, -12, 12)
    sources[record.sourceKind] = clamp((sources[record.sourceKind] || 0) + 1, -12, 12)
    chars += record.chars
    if (record.hadHashtags) hashtagYes += 1
  }
  return {
    version: TWEET_MEMORY_VERSION,
    samples: records.length,
    angles,
    sources,
    averageChars: Math.round(chars / records.length),
    hashtagYes,
    hashtagNo: records.length - hashtagYes,
    updatedAt: taste.updatedAt,
  }
}
