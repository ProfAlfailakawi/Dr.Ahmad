type BodiesMap = Record<string, string>

let bodiesPromise: Promise<BodiesMap> | null = null

export async function loadArticleBodies(): Promise<BodiesMap> {
  if (!bodiesPromise) {
    bodiesPromise = import('../data/bodies.json').then((module) => module.default as BodiesMap)
  }
  return bodiesPromise
}

export async function getArticleBody(slug: string): Promise<string | undefined> {
  const bodies = await loadArticleBodies()
  return bodies[slug] || undefined
}
