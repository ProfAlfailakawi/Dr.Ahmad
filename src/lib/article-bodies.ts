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

/* المتون المشكّلة (نفس النصوص بحركاتٍ كاملة، 143/143). تُحمَّل كسولاً عند طلب
   «القراءة المشكّلة» فقط، فلا تُثقل أول تحميلٍ لغير الراغبين. */
let vocalizedPromise: Promise<BodiesMap> | null = null

async function loadArticleVocalizedBodies(): Promise<BodiesMap> {
  if (!vocalizedPromise) {
    vocalizedPromise = import('../data/bodies-vocalized.json').then((module) => Object.fromEntries(Object.entries(module.default as BodiesMap).map(([slug, body]) => [slug, normalizeArabicTypography(body)])))
  }
  return vocalizedPromise
}

export async function getArticleVocalizedBody(slug: string): Promise<string | undefined> {
  const bodies = await loadArticleVocalizedBodies()
  return bodies[slug] || undefined
}
