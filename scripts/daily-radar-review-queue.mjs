#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  POLICY,
  evaluateCandidate,
  isAllowedSource,
  normalizeUrl,
} from './editorial-policy.mjs'

const APP_DIR = path.join(homedir(), 'Library', 'Application Support', 'Alfailakawi Radar')
const CANDIDATES_PATH = path.join(APP_DIR, 'candidates.json')
const STATE_PATH = path.join(APP_DIR, 'state.json')
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const COLLECTION = process.env.RADAR_FIRESTORE_COLLECTION || 'site_radar'
const MAX_FEED_BYTES = 5 * 1024 * 1024
const MAX_ITEMS_PER_FEED = Number.parseInt(process.env.RADAR_MAX_ITEMS_PER_FEED || '30', 10)
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.RADAR_FETCH_TIMEOUT_MS || '30000', 10)

const XML_ENTITIES = Object.freeze({
  amp: '&', apos: "'", gt: '>', hellip: '…', ldquo: '“', lsquo: '‘',
  lt: '<', nbsp: ' ', quot: '"', rdquo: '”', rsquo: '’',
})

function usage() {
  return `Usage: node scripts/daily-radar.mjs [--dry-run] [--force]\n\n` +
    `  --dry-run  Fetch and evaluate feeds without writing Firestore, local files, or run state.\n` +
    `  --force    Bypass the once-per-local-day guard (URL deduplication still applies).\n`
}

function parseArgs(argv) {
  const args = new Set(argv)
  if (args.has('--help') || args.has('-h')) return { help: true, dryRun: false, force: false }
  const unknown = [...args].filter((arg) => !['--dry-run', '--force'].includes(arg))
  if (unknown.length) throw new Error(`Unknown option: ${unknown.join(', ')}`)
  return { help: false, dryRun: args.has('--dry-run'), force: args.has('--force') }
}

function log(message, details) {
  const suffix = details === undefined ? '' : ` ${JSON.stringify(details)}`
  process.stdout.write(`[${new Date().toISOString()}] ${message}${suffix}\n`)
}

function safeError(error) {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/[\r\n\t]+/g, ' ').slice(0, 400)
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw new Error(`Cannot read ${path.basename(filePath)}: ${safeError(error)}`)
  }
}

async function ensurePrivateAppDir() {
  await mkdir(APP_DIR, { recursive: true, mode: 0o700 })
  await chmod(APP_DIR, 0o700).catch(() => {})
}

async function atomicWriteJson(filePath, value) {
  await ensurePrivateAppDir()
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await chmod(tempPath, 0o600).catch(() => {})
    await rename(tempPath, filePath)
  } finally {
    await rm(tempPath, { force: true }).catch(() => {})
  }
}

function decodeEntities(value = '') {
  let output = String(value)
  for (let pass = 0; pass < 2; pass += 1) {
    output = output.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, code) => {
      if (code[0] === '#') {
        const hex = code[1]?.toLowerCase() === 'x'
        const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
        if (!Number.isSafeInteger(number) || number < 0 || number > 0x10ffff) return ' '
        try { return String.fromCodePoint(number) } catch { return ' ' }
      }
      return XML_ENTITIES[code.toLowerCase()] ?? ' '
    })
  }
  return output
}

function stripMarkup(value = '') {
  return decodeEntities(String(value))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapedTag(tag) {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tagValues(block, tag) {
  const safeTag = escapedTag(tag)
  const expression = new RegExp(`<${safeTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${safeTag}>`, 'gi')
  return [...block.matchAll(expression)].map((match) => match[1])
}

function firstTag(block, ...tags) {
  for (const tag of tags) {
    const value = tagValues(block, tag)[0]
    if (value !== undefined) return value
  }
  return ''
}

function parseFeed(xml, source) {
  const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => match[1])
  return items.slice(0, Number.isFinite(MAX_ITEMS_PER_FEED) ? MAX_ITEMS_PER_FEED : 30).map((item) => {
    const title = stripMarkup(firstTag(item, 'title'))
    const url = stripMarkup(firstTag(item, 'link'))
    const description = stripMarkup(firstTag(item, 'description'))
    const content = stripMarkup(firstTag(item, 'content:encoded'))
    const categories = tagValues(item, 'category').map(stripMarkup).filter(Boolean)
    const rawDate = stripMarkup(firstTag(item, 'pubDate', 'dc:date'))
    const parsedDate = rawDate ? new Date(rawDate) : null
    return {
      title,
      summary: description.slice(0, 1_000),
      content: content.slice(0, 80_000),
      categories,
      source: source.name,
      sourceId: source.id,
      url,
      sourcePublishedAt: parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toISOString() : null,
    }
  })
}

function feedUrlAllowed(source, rawUrl) {
  return isAllowedSource(source.name, rawUrl)
}

async function fetchFeed(source) {
  if (!feedUrlAllowed(source, source.feedUrl)) throw new Error(`Policy rejected feed URL for ${source.name}`)

  const response = await fetch(source.feedUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
      'User-Agent': 'Alfailakawi-Radar/1.0 (+https://dr-alfailakawi.com)',
    },
  })

  if (!response.ok) throw new Error(`${source.name} feed returned HTTP ${response.status}`)
  if (!feedUrlAllowed(source, response.url)) throw new Error(`${source.name} redirected outside its allowlist`)

  const declaredLength = Number.parseInt(response.headers.get('content-length') || '0', 10)
  if (declaredLength > MAX_FEED_BYTES) throw new Error(`${source.name} feed is too large`)

  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (contentType && !/(rss|atom|xml)/.test(contentType)) {
    throw new Error(`${source.name} returned non-RSS content type ${contentType}`)
  }

  const xml = await response.text()
  if (Buffer.byteLength(xml, 'utf8') > MAX_FEED_BYTES) throw new Error(`${source.name} feed exceeded size limit`)
  if (!/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new Error(`${source.name} response is not an RSS feed`)

  return parseFeed(xml, source)
}

function canonicalizeArticleUrl(rawUrl) {
  const url = normalizeUrl(rawUrl)
  if (!url) return null
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')
  return url.href
}

function candidateId(url) {
  return `radar-${createHash('sha256').update(url).digest('hex').slice(0, 28)}`
}

function prepareCandidate(raw, decision, fetchedAt) {
  const url = canonicalizeArticleUrl(raw.url)
  return {
    id: candidateId(url),
    status: 'pending_review',
    title: raw.title.slice(0, 500),
    summary: raw.summary.slice(0, 1_000),
    source: raw.source,
    sourceId: raw.sourceId,
    url,
    sourcePublishedAt: raw.sourcePublishedAt,
    fetchedAt,
    policyVersion: POLICY.version,
    matchedTopics: decision.matchedTopics.slice(0, 12),
  }
}

function dedupeCandidates(candidates) {
  const seen = new Set()
  return candidates.filter((candidate) => {
    if (!candidate?.id || !candidate?.url || seen.has(candidate.id) || seen.has(candidate.url)) return false
    seen.add(candidate.id)
    seen.add(candidate.url)
    return true
  })
}

function parseEnvFile(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z\d_]*)\s*=\s*(.*?)\s*$/i)
    if (!match) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values[match[1]] = value
  }
  return values
}

async function projectConfig() {
  let envFile = {}
  let applet = {}
  try { envFile = parseEnvFile(await readFile(path.join(PROJECT_ROOT, '.env'), 'utf8')) } catch {}
  try { applet = JSON.parse(await readFile(path.join(PROJECT_ROOT, 'firebase-applet-config.json'), 'utf8')) } catch {}

  let firebaseConfig = {}
  try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}') } catch {}

  return {
    projectId: process.env.RADAR_FIREBASE_PROJECT_ID
      || process.env.GOOGLE_CLOUD_PROJECT
      || process.env.GCLOUD_PROJECT
      || firebaseConfig.projectId
      || envFile.VITE_FIREBASE_PROJECT_ID
      || applet.projectId
      || undefined,
    databaseId: process.env.RADAR_FIRESTORE_DATABASE_ID
      || firebaseConfig.databaseId
      || applet.firestoreDatabaseId
      || '(default)',
  }
}

async function verifiedFirestore() {
  try {
    const [{ applicationDefault, getApps, initializeApp }, firestoreModule] = await Promise.all([
      import('firebase-admin/app'),
      import('firebase-admin/firestore'),
    ])
    const credential = applicationDefault()
    await credential.getAccessToken()
    const config = await projectConfig()
    const app = getApps()[0] || initializeApp({ credential, ...(config.projectId ? { projectId: config.projectId } : {}) })
    const db = config.databaseId && config.databaseId !== '(default)'
      ? firestoreModule.getFirestore(app, config.databaseId)
      : firestoreModule.getFirestore(app)
    return { db, FieldValue: firestoreModule.FieldValue, config }
  } catch (error) {
    log('Application Default Credentials unavailable; using private local queue', { reason: safeError(error) })
    return null
  }
}

function isExistingDocError(error) {
  return error?.code === 6 || error?.code === 'already-exists' || /already exists/i.test(error?.message || '')
}

async function storeInFirestore(candidates, firestore) {
  if (candidates.length === 0) return { inserted: 0, duplicates: 0, destination: 'firestore' }
  const refs = candidates.map((candidate) => firestore.db.collection(COLLECTION).doc(candidate.id))
  const snapshots = await firestore.db.getAll(...refs)
  const fresh = candidates.filter((candidate, index) => !snapshots[index].exists)
  if (fresh.length === 0) return { inserted: 0, duplicates: candidates.length, destination: 'firestore' }

  const batch = firestore.db.batch()
  for (const candidate of fresh) {
    const { id, ...document } = candidate
    batch.create(firestore.db.collection(COLLECTION).doc(id), {
      ...document,
      createdAt: firestore.FieldValue.serverTimestamp(),
    })
  }

  try {
    await batch.commit()
  } catch (error) {
    if (isExistingDocError(error)) {
      return storeInFirestore(candidates, firestore)
    }
    throw error
  }
  return { inserted: fresh.length, duplicates: candidates.length - fresh.length, destination: 'firestore' }
}

async function storeLocally(candidates, reason = 'adc_unavailable') {
  const current = await readJson(CANDIDATES_PATH, { schemaVersion: 1, candidates: [] })
  const existing = Array.isArray(current) ? current : (Array.isArray(current.candidates) ? current.candidates : [])
  const seen = new Set(existing.flatMap((candidate) => [candidate.id, candidate.url]).filter(Boolean))
  const fresh = candidates.filter((candidate) => !seen.has(candidate.id) && !seen.has(candidate.url))
  const merged = [...existing, ...fresh].slice(-1_000)
  await atomicWriteJson(CANDIDATES_PATH, {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    storageReason: reason,
    candidates: merged,
  })
  return { inserted: fresh.length, duplicates: candidates.length - fresh.length, destination: CANDIDATES_PATH }
}

async function persistCandidates(candidates) {
  const firestore = await verifiedFirestore()
  if (!firestore) return storeLocally(candidates)
  try {
    const result = await storeInFirestore(candidates, firestore)
    return { ...result, projectId: firestore.config.projectId, databaseId: firestore.config.databaseId }
  } catch (error) {
    log('Firestore write failed; preserving candidates in private local queue', { reason: safeError(error) })
    return storeLocally(candidates, 'firestore_write_failed')
  }
}

function rejectionSummary(rejected) {
  const counts = {}
  for (const item of rejected) {
    for (const reason of item.reasons) counts[reason] = (counts[reason] || 0) + 1
  }
  return counts
}

async function run({ dryRun, force }) {
  const today = localDateKey()
  const state = await readJson(STATE_PATH, {})
  if (!dryRun && !force && state.lastCompletedLocalDate === today) {
    log('Daily radar already completed today; use --force to fetch again', { date: today })
    return
  }

  const fetchedAt = new Date().toISOString()
  const accepted = []
  const rejected = []
  const sourceResults = []

  const feedResults = await Promise.all(POLICY.allowedSources.map(async (source) => {
    try {
      return { source, items: await fetchFeed(source), error: null }
    } catch (error) {
      return { source, items: [], error }
    }
  }))

  for (const { source, items, error } of feedResults) {
    if (!error) {
      sourceResults.push({ source: source.name, fetched: items.length, ok: true })
      for (const item of items) {
        const decision = evaluateCandidate(item)
        const canonicalUrl = canonicalizeArticleUrl(item.url)
        if (decision.allowed && canonicalUrl) accepted.push(prepareCandidate(item, decision, fetchedAt))
        else rejected.push({ source: source.name, title: item.title, reasons: decision.reasons })
      }
    } else {
      sourceResults.push({ source: source.name, fetched: 0, ok: false, error: safeError(error) })
      log('Feed failed', { source: source.name, error: safeError(error) })
    }
  }

  if (!sourceResults.some((result) => result.ok)) throw new Error('All approved RSS feeds failed; run state was not advanced')

  const candidates = dedupeCandidates(accepted)
  const summary = {
    mode: dryRun ? 'dry-run' : 'write',
    forced: force,
    sources: sourceResults,
    accepted: candidates.length,
    rejected: rejected.length,
    rejectedByReason: rejectionSummary(rejected),
  }

  if (dryRun) {
    summary.candidates = candidates.map(({ id, title, source, url, matchedTopics }) => ({ id, title, source, url, matchedTopics }))
    log('Dry run complete; no state or candidate data was written', summary)
    return
  }

  const storage = await persistCandidates(candidates)
  summary.storage = storage
  await atomicWriteJson(STATE_PATH, {
    schemaVersion: 1,
    lastCompletedLocalDate: today,
    lastCompletedAt: new Date().toISOString(),
    summary,
  })
  log('Daily radar complete; all accepted items remain pending_review', summary)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    process.stdout.write(usage())
    return
  }
  await run(options)
}

main().catch((error) => {
  process.stderr.write(`[${new Date().toISOString()}] Radar failed: ${safeError(error)}\n`)
  process.exitCode = 1
})
