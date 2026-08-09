import fs from 'node:fs'
import path from 'node:path'

export const CANONICAL_CMS_VERSION = 1
export const CANONICAL_CMS_RELATIVE_PATH = '.cache/canonical-cms.json'
export const CANONICAL_COLLECTIONS = Object.freeze({
  overrides: 'content_overrides',
  articles: 'site_articles',
  books: 'site_books',
  papers: 'site_papers',
  media: 'site_media',
})

export const canonicalCmsPath = (root) => path.join(root, CANONICAL_CMS_RELATIVE_PATH)

const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value) => typeof value === 'string' ? value.trim() : ''
const slugOf = (value) => text(value?.slug || value?.id)

export function scheduledTime(value) {
  if (!value) return 0
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

export function isPublicArticle(value, now = Date.now()) {
  const status = text(value?.status) || 'published'
  const scheduledAt = scheduledTime(value?.scheduledAt)
  if (status === 'draft') return false
  if (status === 'scheduled') return scheduledAt > 0 && scheduledAt <= now
  if (scheduledAt > now) return false
  return status === 'published' || !status
}

export function readCanonicalCms(root) {
  const file = canonicalCmsPath(root)
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (Number(parsed?.version) !== CANONICAL_CMS_VERSION) return emptyCanonicalCms()
    return parsed
  } catch {
    return emptyCanonicalCms()
  }
}

export function emptyCanonicalCms() {
  return {
    version: CANONICAL_CMS_VERSION,
    generatedAt: '',
    projectId: '',
    source: 'none',
    overrides: [],
    articles: [],
    books: [],
    papers: [],
    media: [],
  }
}

function publicDocument(kind, value, now) {
  if (!value || value.hidden === true || value.deleted === true || !slugOf(value)) return false
  return kind !== 'article' || isPublicArticle(value, now)
}

function publicIndexItem(kind, value, siteUrl) {
  const slug = slugOf(value)
  if (!slug) return null
  const base = {
    id: `${kind}:${slug}`,
    kind,
    slug,
    title: text(value.title) || slug,
    excerpt: '',
    body: '',
    url: '',
    image: null,
    date: text(value.iso || value.date || value.year),
    words: 0,
    audio: null,
    keywords: '',
    hash: '',
  }
  if (kind === 'paper') base.title = text(value.titleAr || value.title) || slug
  if (kind === 'article') {
    base.excerpt = text(value.excerpt)
    base.body = text(value.body)
    base.url = `${siteUrl}/articles/${slug}`
    base.image = value.image || null
    base.keywords = text(value.cat || value.category)
    base.audio = value.audio || null
  } else if (kind === 'book') {
    base.excerpt = text(value.desc || value.longDescription)
    base.body = text(value.longDescription || value.toc)
    base.url = `${siteUrl}/publications/${slug}`
    base.image = value.cover || null
    base.keywords = [value.publisher, value.targetAudience, 'كتاب مؤلف'].filter(Boolean).map(String).join(' ')
  } else if (kind === 'paper') {
    base.excerpt = text(value.abstractAr || value.meta || value.keyFinding)
    base.body = [value.abstractAr, value.keyFinding, value.contribution, value.applications, value.analysisText].filter(Boolean).map(String).join('\n')
    base.url = `${siteUrl}/research/${slug}`
    base.keywords = [value.keywords, value.meta, value.journal, value.studyType, value.methodology].filter(Boolean).map(String).join(' ')
  } else if (kind === 'media') {
    base.excerpt = text(value.topics || value.outlet || value.program)
    base.body = text(value.transcript)
    base.url = `${siteUrl}/media/${slug}`
    base.image = value.thumbnail || null
    base.keywords = [value.outlet, value.channel, value.program, value.topics, value.kind, 'ظهور إعلامي لقاء مقابلة'].filter(Boolean).map(String).join(' ')
  }
  base.words = base.body.split(/\s+/).filter(Boolean).length
  return base
}

function patchIndexItem(item, patch, siteUrl) {
  const value = asObject(patch)
  const next = { ...item }
  if (text(value.title) || (item.kind === 'paper' && text(value.titleAr))) next.title = item.kind === 'paper' ? text(value.titleAr || value.title) : text(value.title)
  if (text(value.iso || value.date || value.year)) next.date = text(value.iso || value.date || value.year)
  if (item.kind === 'article') {
    if ('excerpt' in value) next.excerpt = text(value.excerpt)
    if ('body' in value) next.body = text(value.body)
    if ('cat' in value || 'category' in value) next.keywords = text(value.cat || value.category)
    if ('audio' in value) next.audio = value.audio || null
    next.url = `${siteUrl}/articles/${item.slug}`
  } else if (item.kind === 'book') {
    if ('desc' in value || 'longDescription' in value) next.excerpt = text(value.desc || value.longDescription)
    if ('longDescription' in value || 'toc' in value) next.body = [value.longDescription, value.toc].filter(Boolean).map(String).join('\n')
    if ('cover' in value) next.image = value.cover || null
  } else if (item.kind === 'paper') {
    if ('abstractAr' in value || 'meta' in value || 'keyFinding' in value) next.excerpt = text(value.abstractAr || value.meta || value.keyFinding)
    if (['abstractAr', 'keyFinding', 'contribution', 'applications', 'analysisText'].some((key) => key in value)) {
      const current = asObject(value)
      next.body = [current.abstractAr, current.keyFinding, current.contribution, current.applications, current.analysisText].filter(Boolean).map(String).join('\n') || next.body
    }
  } else if (item.kind === 'media') {
    if ('topics' in value || 'outlet' in value || 'program' in value) next.excerpt = text(value.topics || value.outlet || value.program)
    if ('transcript' in value) next.body = text(value.transcript)
    if ('thumbnail' in value) next.image = value.thumbnail || null
  }
  next.words = String(next.body || '').split(/\s+/).filter(Boolean).length
  return next
}

/**
 * Merge the build-time Firestore snapshot into the static content index.
 * This is deliberately pure so the same rules are testable without Firebase.
 */

const snapshotKeyByKind = Object.freeze({ article: 'articles', book: 'books', paper: 'papers', media: 'media' })

/**
 * Merges lightweight records (metadata, not the normalized search index) with the
 * exact Canonical CMS snapshot. Build-time side systems such as pivots, caution,
 * listen/podcast manifests must see the same published rows as SEO/graph/shards.
 */
export function mergeCanonicalRecords(kind, staticRecords, snapshot, now = Date.now()) {
  const key = snapshotKeyByKind[kind]
  if (!key) return [...(staticRecords || [])]
  const overrides = new Map((snapshot?.overrides || []).map((row) => [String(row?.id || ''), row]))
  const map = new Map()
  for (const record of staticRecords || []) {
    const slug = slugOf(record)
    if (!slug) continue
    const decision = overrides.get(`${kind}:${slug}`)
    const patch = asObject(decision?.patch)
    const merged = { ...record, ...patch, slug }
    if (decision?.deleted === true || decision?.hidden === true) continue
    if (kind === 'article' && !isPublicArticle(merged, now)) continue
    map.set(slug, merged)
  }
  for (const row of snapshot?.[key] || []) {
    const slug = slugOf(row)
    if (!slug || !publicDocument(kind, row, now)) continue
    map.set(slug, { ...row, slug })
  }
  return [...map.values()]
}

export function mergeCanonicalContentIndex(staticItems, snapshot, siteUrl, now = Date.now()) {
  const map = new Map((staticItems || []).map((item) => [item.id, { ...item }]))
  const overrides = new Map((snapshot?.overrides || []).map((row) => [String(row.id || ''), row]))

  for (const [id, row] of overrides) {
    if (!id || !map.has(id)) continue
    const [kind] = id.split(':')
    const mergedDecision = { ...asObject(row?.patch), status: row?.patch?.status, scheduledAt: row?.patch?.scheduledAt }
    if (row?.deleted === true || row?.hidden === true || (kind === 'article' && !isPublicArticle(mergedDecision, now))) {
      map.delete(id)
      continue
    }
    map.set(id, patchIndexItem(map.get(id), row?.patch, siteUrl))
  }

  for (const [kind, list] of [
    ['article', snapshot?.articles],
    ['book', snapshot?.books],
    ['paper', snapshot?.papers],
    ['media', snapshot?.media],
  ]) {
    for (const row of list || []) {
      if (!publicDocument(kind, row, now)) continue
      const item = publicIndexItem(kind, row, siteUrl)
      if (!item) continue
      // site_* is the canonical value for an added record; it may safely replace an older baked copy.
      map.set(item.id, item)
    }
  }
  return [...map.values()]
}

export function mergeCanonicalArticleBodies(normalBodies, vocalizedBodies, snapshot, now = Date.now()) {
  const normal = { ...(normalBodies || {}) }
  const vocalized = { ...(vocalizedBodies || {}) }

  for (const row of snapshot?.overrides || []) {
    const id = String(row?.id || '')
    if (!id.startsWith('article:')) continue
    const slug = id.slice('article:'.length)
    const patch = asObject(row?.patch)
    if (!slug) continue
    if (row?.deleted === true || row?.hidden === true || !isPublicArticle(patch, now)) {
      delete normal[slug]
      delete vocalized[slug]
      continue
    }
    if ('body' in patch) {
      const body = text(patch.body)
      if (body) normal[slug] = body
      else delete normal[slug]
    }
    if ('bodyVocalized' in patch) {
      const body = text(patch.bodyVocalized)
      if (body) vocalized[slug] = body
      else delete vocalized[slug]
    }
  }

  for (const row of snapshot?.articles || []) {
    const slug = slugOf(row)
    if (!slug || !publicDocument('article', row, now)) continue
    const body = text(row.body)
    const vocalizedBody = text(row.bodyVocalized)
    if (body) normal[slug] = body
    if (vocalizedBody) vocalized[slug] = vocalizedBody
  }
  return { normal, vocalized }
}
