import { normalizeArabicTypography } from './arabic-typography'

type BodiesMap = Record<string, string>
type BodyShardKind = 'normal' | 'vocalized'
type BodyShardMeta = { version: number; buckets: number; hash: string; revision?: string; width?: number }

let bodiesPromise: Promise<BodiesMap> | null = null
let vocalizedPromise: Promise<BodiesMap> | null = null
let shardMetaPromise: Promise<BodyShardMeta | null> | null = null
const shardCache = new Map<string, Promise<BodiesMap | null>>()

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

async function bodyShardMeta(): Promise<BodyShardMeta | null> {
  if (typeof window === 'undefined') return null
  if (!shardMetaPromise) {
    shardMetaPromise = fetch('/archive/bodies/v1/meta.json', { cache: 'no-cache' })
      .then(async (response) => response.ok ? await response.json() as BodyShardMeta : null)
      .catch(() => null)
  }
  return shardMetaPromise
}

async function bodyFromShard(kind: BodyShardKind, slug: string) {
  const meta = await bodyShardMeta()
  if (!meta?.buckets || meta.hash !== 'fnv1a32') return undefined
  const bucket = stableHash(slug) % meta.buckets
  const revision = String(meta.revision || '')
  const key = `${revision || 'legacy'}:${kind}:${bucket}`
  let promise = shardCache.get(key)
  if (!promise) {
    const file = String(bucket).padStart(Number(meta.width || String(meta.buckets - 1).length), '0')
    const shardUrl = revision
      ? `/archive/bodies/v1/shards/${encodeURIComponent(revision)}/${kind}/${file}.json`
      : `/archive/bodies/v1/${kind}/${file}.json`
    promise = fetch(shardUrl, { cache: revision ? 'force-cache' : 'no-cache' })
      .then(async (response) => response.ok ? await response.json() as BodiesMap : null)
      .catch(() => null)
    shardCache.set(key, promise)
  }
  const shard = await promise
  const value = shard?.[slug]
  return value ? normalizeArabicTypography(value) : undefined
}

export async function loadArticleBodies(): Promise<BodiesMap> {
  if (!bodiesPromise) {
    /* Legacy/full-map fallback remains for admin tools and development builds.
       Public article reading uses one hash shard and never downloads the whole
       archive merely to open a single article. */
    bodiesPromise = import('../data/bodies.json').then((module) => Object.fromEntries(Object.entries(module.default as BodiesMap).map(([slug, body]) => [slug, normalizeArabicTypography(body)])))
  }
  return bodiesPromise
}

export async function getArticleBody(slug: string): Promise<string | undefined> {
  const sharded = await bodyFromShard('normal', slug)
  if (sharded) return sharded
  const bodies = await loadArticleBodies()
  return bodies[slug] || undefined
}

/* المتون المشكّلة تُجزّأ بالطريقة نفسها. حتى لو صار الأرشيف 100 ألف مادة،
   قارئ التشكيل يحمل شريحةً واحدة فقط لا مكتبةً كاملة. */
async function loadArticleVocalizedBodies(): Promise<BodiesMap> {
  if (!vocalizedPromise) {
    vocalizedPromise = import('../data/bodies-vocalized.json').then((module) => Object.fromEntries(Object.entries(module.default as BodiesMap).map(([slug, body]) => [slug, normalizeArabicTypography(body)])))
  }
  return vocalizedPromise
}

export async function getArticleVocalizedBody(slug: string): Promise<string | undefined> {
  const sharded = await bodyFromShard('vocalized', slug)
  if (sharded) return sharded
  const bodies = await loadArticleVocalizedBodies()
  return bodies[slug] || undefined
}
