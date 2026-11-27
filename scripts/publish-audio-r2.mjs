#!/usr/bin/env node
/**
 * نشر صوتي Transactional إلى Cloudflare R2.
 *
 * المسار الآمن:
 *   نسخة احتياطية بعيدة لكل object قائم
 *   ← رفع الملفات الجديدة
 *   ← تحقق عام من Content-Length / Range / JSON
 *   ← تحديث audio-meta.json
 *   ← انتظار نجاح build + podcast RSS
 *   ← --commit-last لحذف النسخ الاحتياطية.
 *
 * عند أي فشل:
 *   --rollback-last يعيد objects السابقة ويسترجع audio-meta.json ذرياً.
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractAudioPeaks } from './lib/audio-peaks.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const META = resolve(ROOT, 'src/data/audio-meta.json')
const PEAKS = resolve(ROOT, 'src/data/audio-peaks.json')
const STATE = resolve(ROOT, '.podcast-state.json')
const TX_FILE = resolve(ROOT, '.audio-r2-transaction.json')
const TX_AUDITS = resolve(ROOT, 'podcast-audits/r2-transactions')
const READING_AUDITS = resolve(ROOT, 'audio-audits')
const args = process.argv.slice(2)
const ROLLBACK = args.includes('--rollback-last')
const COMMIT = args.includes('--commit-last')
const SELF_TEST = args.includes('--self-test')

function loadEnvironment() {
  const values = { ...process.env }
  const file = resolve(ROOT, '.env')
  if (!existsSync(file)) return values
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match && !values[match[1]]) values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return values
}

const env = loadEnvironment()
const base = (env.AUDIO_PUBLIC_BASE_URL || env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const bucket = env.CLOUDFLARE_R2_BUCKET || env.R2_BUCKET || ''
const endpoint = env.CLOUDFLARE_R2_ENDPOINT || ''
const key = env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || ''
const secret = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || ''
const awsEnv = { ...process.env, AWS_ACCESS_KEY_ID: key, AWS_SECRET_ACCESS_KEY: secret, AWS_EC2_METADATA_DISABLED: 'true' }

function atomicWrite(path, value) {
  const tmp = `${path}.tmp-${process.pid}`
  try { writeFileSync(tmp, value, 'utf8'); renameSync(tmp, path) }
  finally { if (existsSync(tmp)) unlinkSync(tmp) }
}
function hashFile(file) { return createHash('sha256').update(readFileSync(file)).digest('hex') }
const podcastState = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { done: {} }
function dialogueIdentity(name) {
  let match = name.match(/^(.*)\.dialogue\.(mp3|json)$/)
  if (match) return { slug: match[1], lang: 'ar', kind: match[2] === 'mp3' ? 'audio' : 'transcript' }
  match = name.match(/^(.*)\.dialogue-en\.mp3$/)
  if (match) return { slug: match[1], lang: 'en', kind: 'audio' }
  return null
}
function acceptedDialogueFile(name) {
  const identity = dialogueIdentity(name)
  if (!identity) return true
  const entry = podcastState?.done?.[`${identity.slug}:${identity.lang}`]
  if (!entry || entry.status !== 'accepted_automated') return false
  const expected = identity.kind === 'audio' ? entry.audioHash : entry.transcriptHash
  const file = resolve(AUDIO, name)
  return typeof expected === 'string' && expected.length === 64 && existsSync(file) && hashFile(file) === expected
}
if (SELF_TEST) {
  assert.deepEqual(dialogueIdentity('article.dialogue.mp3'), { slug: 'article', lang: 'ar', kind: 'audio' })
  assert.deepEqual(dialogueIdentity('article.dialogue.json'), { slug: 'article', lang: 'ar', kind: 'transcript' })
  assert.deepEqual(dialogueIdentity('article.dialogue-en.mp3'), { slug: 'article', lang: 'en', kind: 'audio' })
  assert.equal(dialogueIdentity('article.mp3'), null)
  console.log('✓ اختبارات ناشر R2 الذري: 4/4')
  process.exit(0)
}
function aws(params, { allowFailure = false, timeout = 120_000 } = {}) {
  const result = spawnSync('aws', [...params, '--endpoint-url', endpoint], {
    cwd: ROOT, encoding: 'utf8', env: awsEnv, timeout,
  })
  if (!allowFailure && result.status !== 0)
    throw new Error((result.stderr || result.stdout || '').trim() || `aws ${params.join(' ')} failed`)
  return result
}
function saveTx(tx) { atomicWrite(TX_FILE, `${JSON.stringify(tx, null, 2)}\n`) }
function archiveTx(tx) {
  mkdirSync(TX_AUDITS, { recursive: true })
  atomicWrite(resolve(TX_AUDITS, `${tx.id}.json`), `${JSON.stringify(tx, null, 2)}\n`)
}
function removeRemotePrefix(prefix) {
  aws(['s3', 'rm', `s3://${bucket}/${prefix}`, '--recursive', '--no-progress'], { allowFailure: true })
}
function remoteExists(name) {
  return aws(['s3api', 'head-object', '--bucket', bucket, '--key', name], { allowFailure: true, timeout: 30_000 }).status === 0
}
function remoteCopy(from, to) {
  aws(['s3', 'cp', `s3://${bucket}/${from}`, `s3://${bucket}/${to}`, '--no-progress'])
}
function remoteDelete(name) {
  aws(['s3', 'rm', `s3://${bucket}/${name}`, '--no-progress'], { allowFailure: true })
}
function upload(name, releaseId) {
  const file = resolve(AUDIO, name)
  const isJson = name.endsWith('.json')
  const isDialogue = /\.dialogue(?:-en)?\.mp3$/i.test(name)
  const cacheControl = isJson || isDialogue
    ? 'public, max-age=300, must-revalidate'
    : 'public, max-age=31536000, immutable'
  aws([
    's3', 'cp', file, `s3://${bucket}/${name}`,
    '--cache-control', cacheControl,
    '--content-type', isJson ? 'application/json; charset=utf-8' : 'audio/mpeg',
    '--metadata', `sha256=${hashFile(file)},release=${releaseId}`,
    '--no-progress',
  ])
}
function durationSeconds(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8', timeout: 20_000 })
  if (probe.status !== 0) return null
  const seconds = Math.round(Number(probe.stdout.trim()))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}
function acceptedReadingAudit(name) {
  if (/\.dialogue(?:-en)?\.mp3$/i.test(name) || !name.endsWith('.mp3')) return null
  const voice = name.endsWith('.noura.mp3') ? 'noura' : 'fahed'
  const slug = name.replace(/\.noura\.mp3$/, '').replace(/\.mp3$/, '')
  const file = resolve(READING_AUDITS, `${slug}.${voice}.json`)
  if (!existsSync(file)) return null
  try {
    const audit = JSON.parse(readFileSync(file, 'utf8'))
    return audit.status === 'accepted' && audit.pass === true ? audit : null
  } catch { return null }
}
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
async function verifyPublicObject(entry, txId) {
  const url = `${base}/${encodeURIComponent(entry.name).replace(/%2F/g, '/')}?release=${encodeURIComponent(txId)}`
  let lastError = null
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      if (entry.name.endsWith('.json')) {
        const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow' })
        if (!response.ok) throw new Error(`JSON HTTP ${response.status}`)
        const text = await response.text()
        JSON.parse(text)
        if (Buffer.byteLength(text) !== entry.bytes) throw new Error(`JSON length ${Buffer.byteLength(text)} != ${entry.bytes}`)
      } else {
        const [head, range] = await Promise.all([
          fetch(url, { method: 'HEAD', headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow' }),
          fetch(url, { headers: { Range: 'bytes=0-0', 'Cache-Control': 'no-cache' }, redirect: 'follow' }),
        ])
        if (!((head.ok || head.status === 405) && (range.ok || range.status === 206)))
          throw new Error(`HTTP HEAD ${head.status} / Range ${range.status}`)
        const length = Number(head.headers.get('content-length') || 0)
        if (length && Math.abs(length - entry.bytes) > 16) throw new Error(`Content-Length ${length} != ${entry.bytes}`)
        if (range.status !== 206 && !/bytes/i.test(head.headers.get('accept-ranges') || ''))
          throw new Error('Range Requests غير مدعومة')
      }
      return { pass: true, url, attempt }
    } catch (error) {
      lastError = error
      await sleep(attempt * 1500)
    }
  }
  throw new Error(`${entry.name}: ${lastError?.message || lastError}`)
}

async function rollbackTransaction(tx, reason = 'requested') {
  tx.status = 'rolling_back'; tx.rollbackReason = reason; tx.rollbackStartedAt = new Date().toISOString(); saveTx(tx)
  for (const entry of [...tx.files].reverse()) {
    if (entry.existedBefore && entry.backupKey) remoteCopy(entry.backupKey, entry.name)
    else remoteDelete(entry.name)
  }
  atomicWrite(META, tx.previousMetaText || '{}\n')
  atomicWrite(PEAKS, tx.previousPeaksText || '{"version":1,"samples":180,"peaks":{}}\n')
  removeRemotePrefix(tx.backupPrefix)
  tx.status = 'rolled_back'; tx.rolledBackAt = new Date().toISOString(); archiveTx(tx)
  unlinkSync(TX_FILE)
  console.log(`↶ R2 Rollback مكتمل: ${tx.files.length} ملف · ${reason}`)
}

async function commitTransaction(tx) {
  removeRemotePrefix(tx.backupPrefix)
  tx.status = 'committed'; tx.committedAt = new Date().toISOString(); archiveTx(tx)
  unlinkSync(TX_FILE)
  console.log(`✓ ثُبّت نشر R2 بعد نجاح الموقع وRSS: ${tx.files.length} ملف`)
}

if (ROLLBACK || COMMIT) {
  if (!existsSync(TX_FILE)) {
    console.log('لا توجد معاملة R2 معلقة.')
    process.exit(0)
  }
  if (!bucket || !endpoint || !key || !secret) {
    console.error('✘ إعدادات R2 مطلوبة لإكمال أو إرجاع المعاملة.')
    process.exit(1)
  }
  const tx = JSON.parse(readFileSync(TX_FILE, 'utf8'))
  if (ROLLBACK) await rollbackTransaction(tx, 'workflow_failure')
  else await commitTransaction(tx)
  process.exit(0)
}

if (existsSync(TX_FILE)) {
  if (!bucket || !endpoint || !key || !secret) throw new Error('توجد معاملة معلقة ولا يمكن إرجاعها دون إعدادات R2')
  const stale = JSON.parse(readFileSync(TX_FILE, 'utf8'))
  console.warn(`⚠ عُثر على معاملة غير مثبتة ${stale.id}؛ ستُعاد Last-Known-Good قبل بدء نشر جديد.`)
  await rollbackTransaction(stale, 'stale_transaction_before_new_publish')
}

if (!existsSync(AUDIO)) { console.log('لا يوجد مجلد audio؛ لا شيء للنشر.'); process.exit(0) }
const files = readdirSync(AUDIO).filter((name) => /\.(mp3|json)$/i.test(name)).sort().filter((name) => {
  if (acceptedDialogueFile(name)) return true
  console.warn(`⚠ تخطّي ملف حواري غير معتمد أو تغيّرت بصمته: ${name}`)
  return false
})
if (!files.length) { console.log('لا توجد ملفات صوت/Transcript معتمدة جديدة للنشر إلى R2.'); process.exit(0) }
if (!base || !bucket || !endpoint || !key || !secret) {
  console.error('✘ إعدادات R2 غير مكتملة: AUDIO_PUBLIC_BASE_URL + CLOUDFLARE_R2_BUCKET/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY')
  process.exit(1)
}

const previousMetaText = existsSync(META) ? readFileSync(META, 'utf8') : '{}\n'
const previousPeaksText = existsSync(PEAKS) ? readFileSync(PEAKS, 'utf8') : '{"version":1,"samples":180,"peaks":{}}\n'
const meta = JSON.parse(previousMetaText)
const peakFile = JSON.parse(previousPeaksText)
const id = `audio-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
const tx = { schemaVersion: 1, id, status: 'preparing', createdAt: new Date().toISOString(),
  backupPrefix: `_rollback/${id}`, previousMetaText, previousPeaksText, files: [] }
saveTx(tx)

try {
  for (const name of files) {
    const file = resolve(AUDIO, name)
    const entry = { name, bytes: statSync(file).size, sha256: hashFile(file),
      existedBefore: remoteExists(name), backupKey: '', uploaded: false, verified: false }
    if (entry.existedBefore) {
      entry.backupKey = `${tx.backupPrefix}/${name}`
      remoteCopy(name, entry.backupKey)
    }
    tx.files.push(entry); saveTx(tx)
  }
  tx.status = 'uploading'; saveTx(tx)
  for (const entry of tx.files) {
    upload(entry.name, tx.id); entry.uploaded = true; saveTx(tx)
  }
  tx.status = 'verifying_public_objects'; saveTx(tx)
  for (const entry of tx.files) {
    entry.publicVerification = await verifyPublicObject(entry, tx.id)
    entry.verified = true; saveTx(tx)
  }
  for (const entry of tx.files) {
    const file = resolve(AUDIO, entry.name)
    const isMp3 = entry.name.endsWith('.mp3')
    const readingAudit = acceptedReadingAudit(entry.name)
    meta[entry.name] = {
      ...(meta[entry.name] || {}),
      bytes: entry.bytes,
      sha256: entry.sha256,
      contentType: isMp3 ? 'audio/mpeg' : 'application/json; charset=utf-8',
      publishedAt: new Date().toISOString(),
      ...(isMp3 ? { durationSeconds: durationSeconds(file) || meta[entry.name]?.durationSeconds || null } : {}),
      ...(readingAudit ? {
        sourceHash: readingAudit.sourceHash,
        pipelineHash: readingAudit.pipelineHash,
        humanLikenessScore: readingAudit.humanLikenessProxy?.score ?? null,
        audioJudgeMinimum: readingAudit.audioJudge?.minimumDimension ?? null,
        acceptedAt: readingAudit.finishedAt,
      } : {}),
    }
    if (/\.dialogue\.mp3$/i.test(entry.name)) {
      const values = await extractAudioPeaks(file)
      if (values.length) peakFile.peaks = { ...(peakFile.peaks || {}), [entry.name]: values }
    }
  }
  const rendered = `${JSON.stringify(Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`
  atomicWrite(META, rendered)
  atomicWrite(PEAKS, `${JSON.stringify({ version: 1, samples: 180, peaks: peakFile.peaks || {} })}\n`)
  tx.status = 'pending_site_build'; tx.metaHash = createHash('sha256').update(rendered).digest('hex')
  tx.uploadedAt = new Date().toISOString(); saveTx(tx)
  console.log(`✔ نُشر مبدئياً إلى R2 وفُحص: ${tx.files.length} ملفاً · ينتظر نجاح build وpodcast.xml قبل التثبيت`)
} catch (error) {
  console.error(`✘ فشل النشر الآمن: ${error.message}`)
  await rollbackTransaction(tx, `publish_or_verification_failure: ${error.message}`)
  process.exit(1)
}
