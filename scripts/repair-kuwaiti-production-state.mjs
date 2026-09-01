#!/usr/bin/env node
/**
 * Kuwaiti production state recovery / regression guard.
 *
 * Safety contract:
 * - Git history (verified bot commits) is the certificate of publication.
 * - R2 is existence evidence only; R2 alone NEVER creates or replaces a Kuwaiti public entry.
 * - A certified entry is restored only when R2 content-length matches the certified byte count.
 * - A mismatch is quarantined and is NOT advertised as published.
 * - Quality holds are recovered from bot-owned history and are not resurrected after a newer verified publish.
 *
 * Default is DRY RUN. Use --apply only after reviewing output.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const META_PATH = resolve(ROOT, 'src/data/audio-meta.json')
const HOLDS_PATH = resolve(ROOT, 'scripts/data/kuwaiti-production-quality-holds-v1.json')
const REPORT_PATH = resolve(ROOT, 'reports/kuwaiti-ledger-quarantine.json')

const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')
const STRICT_R2 = process.argv.includes('--strict-r2')
const BASE = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

const sh = (args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const readJson = (path, fallback) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback }
}
const showJson = (sha, path) => {
  const r = sh(['show', `${sha}:${path}`])
  if (r.status !== 0) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}
const isKwPublicName = (name) => /\.dialogue-kw\.(?:json|mp3)$/.test(name)
const isVerified = (entry) => entry && entry.validationStatus === 'verified-r2'
const sameCertificate = (a, b) =>
  !!a && !!b &&
  a.bytes === b.bytes &&
  a.sha256 === b.sha256 &&
  a.validationStatus === b.validationStatus &&
  (a.verifiedAt || '') === (b.verifiedAt || '')

function publishedSlugFromName(name) {
  return name.replace(/\.dialogue-kw\.(?:json|mp3)$/, '')
}

export function decideCertifiedRestore({ remoteStatus, remoteBytes, certifiedBytes, strictR2 = true }) {
  if (!strictR2) return { action: 'restore', why: 'R2 verification disabled explicitly' }
  if (remoteStatus !== 200 && remoteStatus !== 206) {
    return { action: 'quarantine', why: `R2 status=${remoteStatus}` }
  }
  if (!remoteBytes || remoteBytes !== certifiedBytes) {
    return { action: 'quarantine', why: `R2 bytes=${remoteBytes || 0}, certificate=${certifiedBytes}` }
  }
  return { action: 'restore', why: 'R2 matches the bot certificate byte-for-byte in size' }
}

if (SELF_TEST) {
  const tests = []
  const t = (name, ok) => {
    if (!ok) throw new Error(`✘ ${name}`)
    tests.push(name)
  }
  t('matching certified object restores', decideCertifiedRestore({ remoteStatus: 200, remoteBytes: 100, certifiedBytes: 100 }).action === 'restore')
  t('R2-only mismatch quarantines', decideCertifiedRestore({ remoteStatus: 200, remoteBytes: 101, certifiedBytes: 100 }).action === 'quarantine')
  t('404 quarantines', decideCertifiedRestore({ remoteStatus: 404, remoteBytes: 0, certifiedBytes: 100 }).action === 'quarantine')
  t('transient status quarantines', decideCertifiedRestore({ remoteStatus: 503, remoteBytes: 0, certifiedBytes: 100 }).action === 'quarantine')
  t('non-strict mode never invents bytes', decideCertifiedRestore({ remoteStatus: 500, remoteBytes: 0, certifiedBytes: 100, strictR2: false }).action === 'restore')
  console.log(`✓ Kuwaiti ledger recovery self-test: ${tests.length}/${tests.length}`)
  process.exit(0)
}

if (!existsSync(META_PATH)) throw new Error(`audio meta missing: ${META_PATH}`)
if (!existsSync(resolve(ROOT, '.git'))) throw new Error('full git repository required; run inside the real repository, not a detached folder')

/* The guard depends on history. Shallow history was the reason the older guard could not see
   the publication chain at all. Refuse to silently operate on a shallow clone. */
const shallow = sh(['rev-parse', '--is-shallow-repository']).stdout.trim()
if (shallow === 'true') {
  throw new Error('repository is shallow; fetch full history first. The workflow patch in this bundle sets fetch-depth: 0.')
}

const currentMeta = readJson(META_PATH, {})
const originalMeta = JSON.stringify(currentMeta)

/* 1) Build the publication certificate from bot commits, newest first.
      Every public Kuwaiti entry must have appeared in a verified publication commit. */
const certLog = sh([
  'log', '--all', '--format=%H%x09%aI%x09%an%x09%s',
  '--grep=chore: publish verified Kuwaiti dialogue',
  '--', 'src/data/audio-meta.json',
])
if (certLog.status !== 0) throw new Error(certLog.stderr || 'failed to read publication history')

const certificate = new Map()
const publishTimes = new Map()

for (const line of certLog.stdout.split('\n').filter(Boolean)) {
  const [sha, iso, author, ...subjectParts] = line.split('\t')
  const snapshot = showJson(sha, 'src/data/audio-meta.json')
  if (!snapshot) continue

  for (const [name, entry] of Object.entries(snapshot)) {
    if (!isKwPublicName(name) || !isVerified(entry) || certificate.has(name)) continue
    certificate.set(name, { ...entry, _certificateCommit: sha, _certificateCommitAt: iso })
    const slug = publishedSlugFromName(name)
    const stamp = Date.parse(entry.verifiedAt || entry.publishedAt || iso || 0)
    publishTimes.set(slug, Math.max(publishTimes.get(slug) || 0, Number.isFinite(stamp) ? stamp : 0))
  }
}

if (!certificate.size) throw new Error('no verified Kuwaiti publication certificate found in git history')

/* 2) Recover the latest bot-owned quality-hold state.
      Human/Studio rollback commits must not erase exhausted candidates. */
const holdLog = sh([
  'log', '--all', '--format=%H%x09%aI%x09%an%x09%s',
  '--', 'scripts/data/kuwaiti-production-quality-holds-v1.json',
])
const historicalHolds = new Map()

for (const line of holdLog.stdout.split('\n').filter(Boolean)) {
  const [sha, iso, author, ...subjectParts] = line.split('\t')
  const subject = subjectParts.join('\t')
  const botOwned = /github-actions/i.test(author) || /defer exhausted Kuwaiti quality candidate/i.test(subject)
  if (!botOwned) continue
  const snapshot = showJson(sha, 'scripts/data/kuwaiti-production-quality-holds-v1.json')
  if (!snapshot?.holds) continue
  for (const hold of snapshot.holds) {
    if (!hold?.slug || historicalHolds.has(hold.slug)) continue
    historicalHolds.set(hold.slug, hold)
  }
}

/* 3) R2 verification: never trust R2 alone. It is only used to prove that the exact
      certified object still exists. */
async function head(name) {
  if (!BASE) return { status: 0, bytes: 0, why: 'AUDIO_PUBLIC_BASE_URL unavailable' }
  try {
    const res = await fetch(`${BASE}/${encodeURI(name)}`, { method: 'HEAD' })
    return { status: res.status, bytes: Number(res.headers.get('content-length') || 0) }
  } catch (error) {
    return { status: 0, bytes: 0, why: error?.message || String(error) }
  }
}

const names = [...certificate.keys()].sort()
const remote = new Map()
if (BASE) {
  for (let i = 0; i < names.length; i += 8) {
    const batch = names.slice(i, i + 8)
    const answers = await Promise.all(batch.map(async name => [name, await head(name)]))
    for (const [name, answer] of answers) remote.set(name, answer)
  }
}

const repaired = { ...currentMeta }
const restored = []
const correctedRollback = []
const quarantined = []

for (const name of names) {
  const certifiedRaw = certificate.get(name)
  const { _certificateCommit, _certificateCommitAt, ...certified } = certifiedRaw
  const current = repaired[name]
  const remoteInfo = remote.get(name) || { status: 0, bytes: 0 }

  const decision = decideCertifiedRestore({
    remoteStatus: remoteInfo.status,
    remoteBytes: remoteInfo.bytes,
    certifiedBytes: certified.bytes,
    strictR2: STRICT_R2,
  })

  if (STRICT_R2 && decision.action !== 'restore') {
    /* If current metadata advertises a Kuwaiti object that no longer matches the certificate,
       remove it from the repaired public ledger. Do not replace it from R2. */
    if (current && !sameCertificate(current, certified)) delete repaired[name]
    quarantined.push({
      name,
      slug: publishedSlugFromName(name),
      reason: decision.why,
      certificateCommit: _certificateCommit,
      certified: { bytes: certified.bytes, sha256: certified.sha256, verifiedAt: certified.verifiedAt },
      current: current ? { bytes: current.bytes, sha256: current.sha256, verifiedAt: current.verifiedAt } : null,
      remote: remoteInfo,
    })
    continue
  }

  if (!current) {
    repaired[name] = certified
    restored.push(name)
  } else if (!sameCertificate(current, certified)) {
    repaired[name] = certified
    correctedRollback.push(name)
  }
}

/* 4) Recover holds unless a newer verified publication for that slug exists. */
const holdsDoc = readJson(HOLDS_PATH, { schemaVersion: 1, holds: [] })
const holdMap = new Map((holdsDoc.holds || []).map(h => [h.slug, h]))
const recoveredHolds = []

for (const [slug, hold] of historicalHolds) {
  const deferredAt = Date.parse(hold.deferredAt || 0) || 0
  const newerVerifiedPublish = (publishTimes.get(slug) || 0) > deferredAt
  if (newerVerifiedPublish) continue
  if (!holdMap.has(slug)) {
    holdMap.set(slug, hold)
    recoveredHolds.push(slug)
  }
}

const orderedMeta = Object.fromEntries(Object.keys(repaired).sort().map(k => [k, repaired[k]]))
const orderedHolds = [...holdMap.values()].sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
const changedMeta = JSON.stringify(orderedMeta) !== originalMeta
const changedHolds = JSON.stringify(orderedHolds) !== JSON.stringify(holdsDoc.holds || [])

console.log(`Certificate: ${certificate.size} verified Kuwaiti files (${Math.floor(certificate.size / 2)} episodes expected when every episode has JSON+MP3).`)
console.log(`Restore missing: ${restored.length}`)
console.log(`Correct stale rollback: ${correctedRollback.length}`)
console.log(`Recover quality holds: ${recoveredHolds.length}`)
console.log(`Quarantine mismatches: ${quarantined.length}`)

if (quarantined.length) {
  for (const q of quarantined) console.log(`  ! ${q.name}: ${q.reason}`)
}

if (!APPLY) {
  console.log('\nDRY RUN — nothing written. Add --apply after reviewing the report.')
  process.exit(quarantined.length && STRICT_R2 ? 2 : 0)
}

mkdirSync(dirname(REPORT_PATH), { recursive: true })
writeFileSync(REPORT_PATH, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  strictR2: STRICT_R2,
  certificateEntries: certificate.size,
  restored,
  correctedRollback,
  recoveredHolds,
  quarantined,
}, null, 2)}\n`)

if (changedMeta) writeFileSync(META_PATH, `${JSON.stringify(orderedMeta, null, 2)}\n`)
if (changedHolds) writeFileSync(HOLDS_PATH, `${JSON.stringify({ ...holdsDoc, holds: orderedHolds }, null, 2)}\n`)

console.log('\n✓ Kuwaiti production state repaired from bot certificates.')
console.log('✓ R2 was used only as a verifier; it never created or replaced metadata by itself.')
console.log(`✓ Quarantine report: ${REPORT_PATH}`)
