import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { mergeCanonicalArticleBodies, readCanonicalCms } from './canonical-cms.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'src', 'data')
const outputRoot = path.join(root, 'public', 'archive', 'bodies', 'v1')
const BUCKETS = 2048

function stableHash(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function readJson(file) {
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeKind(kind, source, revision, width) {
  const target = path.join(outputRoot, 'shards', revision, kind)
  fs.rmSync(target, { recursive: true, force: true })
  fs.mkdirSync(target, { recursive: true })
  const buckets = Array.from({ length: BUCKETS }, () => ({}))
  let entries = 0
  for (const [slug, body] of Object.entries(source)) {
    if (!slug || typeof body !== 'string' || !body.trim()) continue
    buckets[stableHash(slug) % BUCKETS][slug] = body
    entries += 1
  }
  let files = 0
  let bytes = 0
  for (let index = 0; index < buckets.length; index += 1) {
    if (!Object.keys(buckets[index]).length) continue
    const payload = `${JSON.stringify(buckets[index])}\n`
    fs.writeFileSync(path.join(target, `${String(index).padStart(width, '0')}.json`), payload)
    files += 1
    bytes += Buffer.byteLength(payload)
  }
  return { count: entries, files, bytes }
}

const normalFile = path.join(dataDir, 'bodies.json')
const vocalizedFile = path.join(dataDir, 'bodies-vocalized.json')
const canonical = readCanonicalCms(root)
const mergedBodies = mergeCanonicalArticleBodies(readJson(normalFile), readJson(vocalizedFile), canonical)
const revision = crypto.createHash('sha256')
  .update(`archive-shard-v1:${BUCKETS}:fnv1a32:`)
  .update(JSON.stringify(mergedBodies.normal))
  .update(JSON.stringify(mergedBodies.vocalized))
  .digest('hex')
  .slice(0, 16)

/* Each deploy gets content-addressed shard URLs. The tiny meta file may change,
   while the revision directory can be cached forever without serving stale bodies. */
fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(outputRoot, { recursive: true })
const width = String(BUCKETS - 1).length
const normal = writeKind('normal', mergedBodies.normal, revision, width)
const vocalized = writeKind('vocalized', mergedBodies.vocalized, revision, width)
const meta = {
  version: 1,
  buckets: BUCKETS,
  hash: 'fnv1a32',
  revision,
  width,
  generatedAt: new Date().toISOString(),
  canonicalCmsGeneratedAt: canonical.generatedAt || '',
  normal,
  vocalized,
}
fs.writeFileSync(path.join(outputRoot, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
console.log(`Archive 2036 body shards: ${normal.count} normal + ${vocalized.count} vocalized across ${BUCKETS} stable buckets.`)
