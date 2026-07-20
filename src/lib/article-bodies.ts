import { normalizeArabicTypography } from './arabic-typography'

type BodiesMap = Record<string, string>

let bodiesPromise: Promise<BodiesMap> | null = null

export async function loadArticleBodies(): Promise<BodiesMap> {
  if (!bodiesPromise) {
    bodiesPromise = import('../data/bodies.json').then((module) => Object.fromEntries(Object.entries(module.default as BodiesMap).map(([slug, body]) => [slug, normalizeArabicTypography(body)])))
  }
  return bodiesPromise
}

export async function getArticleBody(slug: string): Promise<string | undefined> {
  const bodies = await loadArticleBodies()
  return bodies[slug] || undefined
}

/**
 * النصوص المُشكَّلة المحفوظة في الريبو.
 *
 * مربّع «النص المُشكَّل» في اللوحة كان يقرأ من Firestore وحده، فيظهر فارغاً
 * وإن كان النصّ موجوداً في `bodies-vocalized.json` — والدكتور يفتح المقالة
 * فيظنّ العمل ضاع. ومحرّك الصوت يقرأ الملف عند التوليد فيعمل، فيتناقض ما يراه
 * مع ما يسمعه.
 *
 * يُحمَّل كسولاً (نحو ٨٥٠ كيلوبايت) فلا يثقل الموقع على القارئ، ولا يُطلب إلا
 * حين تُفتح لوحة التحرير.
 */
let vocalizedPromise: Promise<BodiesMap> | null = null

export async function loadVocalizedBodies(): Promise<BodiesMap> {
  if (!vocalizedPromise) {
    vocalizedPromise = import('../data/bodies-vocalized.json')
      .then((module) => module.default as BodiesMap)
      .catch(() => ({}))
  }
  return vocalizedPromise
}

export async function getVocalizedBody(slug: string): Promise<string | undefined> {
  const bodies = await loadVocalizedBodies()
  return bodies[slug] || undefined
}
