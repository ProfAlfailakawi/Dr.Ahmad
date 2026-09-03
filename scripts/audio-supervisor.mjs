#!/usr/bin/env node
/**
 * المشرف الدائم لإنتاج الصوت.
 *
 * لا يولّد صوتاً بنفسه ولا يعيد ما نجح. يقرأ بيان النشر والـmetadata وسجل
 * التعثّر، ويبني لقطة واحدة قابلة للاستئناف تستعملها GitHub Actions واللوحة.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.join(ROOT, 'src/data/audio-supervisor.json')
const MIN_BYTES = 5_000
const argv = new Set(process.argv.slice(2))

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

const atomicJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  fs.renameSync(temporary, file)
}

const validMeta = (entry) => Number(entry?.bytes || 0) >= MIN_BYTES
  && Number(entry?.durationSeconds || entry?.duration || entry?.durationSec || 0) > 0
  && Boolean(entry?.sha256 || entry?.etag || entry?.publishedAt || entry?.acceptedAt
    || (entry?.validationStatus === 'verified-r2' && entry?.verifiedAt))

const titleMap = (root) => {
  const source = fs.readFileSync(path.join(root, 'src/data.ts'), 'utf8')
  const block = (source.match(/export const articles = \[([\s\S]*?)\n\]/) || ['', ''])[1]
  return Object.fromEntries([...block.matchAll(/slug: '([^']+)', title: '((?:\\'|[^'])+)'/g)]
    .map((match) => [match[1], match[2].replace(/\\'/g, "'")]))
}

const snapshotFingerprint = (snapshot) => createHash('sha256')
  .update(JSON.stringify({
    state: snapshot.state,
    articles: snapshot.articles,
    readings: snapshot.readings,
    dialogues: snapshot.dialogues,
    queue: snapshot.queue,
    progressPercent: snapshot.progressPercent,
    items: snapshot.items,
  }))
  .digest('hex')

function buildSnapshot(root = ROOT, now = new Date()) {
  const bodies = readJson(path.join(root, 'src/data/bodies.json'), {})
  const manifest = readJson(path.join(root, 'src/data/audio.json'), {})
  const meta = readJson(path.join(root, 'src/data/audio-meta.json'), {})
  const failuresDoc = readJson(path.join(root, '.audio-failures.json'), { items: [] })
  const titles = titleMap(root)
  const slugs = Object.keys(bodies).sort()
  const items = []
  const queue = []
  const failedByKey = new Map((failuresDoc.items || []).map((item) => [`${item.slug}:${item.voice || item.stage}`, item]))

  for (const slug of slugs) {
    const declaration = manifest[slug] || {}
    const fahedFile = `${slug}.mp3`
    const nouraFile = `${slug}.noura.mp3`
    const fahedReady = Boolean(declaration.fahed) && validMeta(meta[fahedFile])
    const nouraReady = Boolean(declaration.noura) && validMeta(meta[nouraFile])
    const fahedFailure = failedByKey.get(`${slug}:fahed`) || null
    const nouraFailure = failedByKey.get(`${slug}:noura`) || null
    const voices = {
      fahed: { ready: fahedReady, fileName: fahedFile, failure: fahedFailure },
      noura: { ready: nouraReady, fileName: nouraFile, failure: nouraFailure },
    }
    if (!fahedReady) queue.push({ slug, title: titles[slug] || slug, kind: 'reading', voice: 'fahed', stage: fahedFailure?.stage || 'generate', attempts: Number(fahedFailure?.attempts || 0), lastError: fahedFailure?.message || '' })
    if (!nouraReady) queue.push({ slug, title: titles[slug] || slug, kind: 'reading', voice: 'noura', stage: nouraFailure?.stage || 'generate', attempts: Number(nouraFailure?.attempts || 0), lastError: nouraFailure?.message || '' })
    // كل مقال منشور له مسار حوار تلقائي؛ الحوار اليدوي إن وُجد يبقى المصدر الأعلى أولوية.
    const dialogueEligible = true
    const dialogueFile = `${slug}.dialogue.mp3`
    const dialogueReady = Boolean(declaration.dialogue) && validMeta(meta[dialogueFile])
    const dialogueFailure = failedByKey.get(`${slug}:dialogue`) || failedByKey.get(`${slug}:podcast`) || null
    if (!dialogueReady) queue.push({ slug, title: titles[slug] || slug, kind: 'dialogue', voice: 'dialogue', stage: dialogueFailure?.stage || 'generate', attempts: Number(dialogueFailure?.attempts || 0), lastError: dialogueFailure?.message || '' })
    items.push({
      slug,
      title: titles[slug] || slug,
      readings: voices,
      dialogue: { eligible: dialogueEligible, ready: dialogueReady, fileName: dialogueFile, failure: dialogueFailure },
      complete: voices.fahed.ready && voices.noura.ready && dialogueReady,
    })
  }

  /* الجديد والسليم أولاً؛ المتعثر ذو المحاولات الكثيرة لا يأكل كل دفعة. */
  queue.sort((left, right) => (left.attempts - right.attempts) || left.slug.localeCompare(right.slug) || left.voice.localeCompare(right.voice))
  const readingExpected = slugs.length * 2
  const fahedReady = items.filter((item) => item.readings.fahed.ready).length
  const nouraReady = items.filter((item) => item.readings.noura.ready).length
  const readingReady = fahedReady + nouraReady
  const dialogueExpected = slugs.length
  const dialogueReady = items.filter((item) => item.dialogue.ready).length
  const failed = queue.filter((item) => item.lastError)
  const generatedAt = now.toISOString()
  const snapshot = {
    schemaVersion: 1,
    generatedAt,
    state: queue.length ? (failed.length ? 'repairing' : 'producing') : 'complete',
    articles: { total: slugs.length, complete: items.filter((item) => item.complete).length },
    readings: { expected: readingExpected, ready: readingReady, missing: readingExpected - readingReady, fahedReady, nouraReady },
    dialogues: { expected: dialogueExpected, ready: dialogueReady, missing: dialogueExpected - dialogueReady },
    queue: {
      total: queue.length,
      failed: failed.length,
      next: queue[0] || null,
      sample: queue.slice(0, 12),
    },
    progressPercent: Math.round(((readingReady + dialogueReady) / Math.max(1, readingExpected + dialogueExpected)) * 1000) / 10,
    items,
  }
  snapshot.fingerprint = snapshotFingerprint(snapshot)
  return snapshot
}

function writeGithubOutput(snapshot) {
  const output = process.env.GITHUB_OUTPUT
  if (!output) return
  const suggested = Math.min(40, Math.max(1, snapshot.queue.total))
  fs.appendFileSync(output, [
    `has_work=${snapshot.queue.total > 0 ? 'true' : 'false'}`,
    `missing_readings=${snapshot.readings.missing}`,
    `missing_dialogues=${snapshot.dialogues.missing}`,
    `total_missing=${snapshot.queue.total}`,
    `suggested_limit=${suggested}`,
  ].join('\n') + '\n')
}

function writeSummary(snapshot) {
  const target = process.env.GITHUB_STEP_SUMMARY
  if (!target) return
  const next = snapshot.queue.next
  fs.appendFileSync(target, `\n## المشرف الحي للصوت\n\n- الإنجاز: **${snapshot.progressPercent}%**\n- صوت فهد: **${snapshot.readings.fahedReady}/${snapshot.articles.total}**\n- صوت نورة: **${snapshot.readings.nouraReady}/${snapshot.articles.total}**\n- حوارات جاهزة: **${snapshot.dialogues.ready}/${snapshot.dialogues.expected}**\n- عناصر باقية: **${snapshot.queue.total}**\n- تعثرات مسجلة: **${snapshot.queue.failed}**\n${next ? `- التالي: **${next.title} — ${next.voice}**\n` : '- لا يوجد عمل متبقٍ.\n'}\n`)
}

function selfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-supervisor-'))
  fs.mkdirSync(path.join(temp, 'src/data'), { recursive: true })
  fs.mkdirSync(path.join(temp, 'podcast-audits/dialogues'), { recursive: true })
  fs.mkdirSync(path.join(temp, 'manual-dialogues'), { recursive: true })
  fs.writeFileSync(path.join(temp, 'src/data.ts'), "export const articles = [\n{ slug: 'a', title: 'أ' },\n{ slug: 'b', title: 'ب' },\n]\n")
  atomicJson(path.join(temp, 'src/data/bodies.json'), { a: 'نص', b: 'نص' })
  atomicJson(path.join(temp, 'src/data/audio.json'), { a: { fahed: true, noura: true, dialogue: true }, b: { fahed: true, noura: true } })
  atomicJson(path.join(temp, 'src/data/audio-meta.json'), {
    'a.mp3': { bytes: 6000, durationSeconds: 10, sha256: 'x' },
    'a.noura.mp3': { bytes: 6000, durationSeconds: 10, sha256: 'x' },
    'a.dialogue.mp3': { bytes: 6000, durationSeconds: 12, sha256: 'x' },
    'b.mp3': { bytes: 6000, durationSeconds: 10, sha256: 'x' },
    'b.noura.mp3': { bytes: 6000, durationSeconds: 10, sha256: 'x' },
  })
  atomicJson(path.join(temp, '.audio-failures.json'), { items: [{ slug: 'b', voice: 'dialogue', stage: 'generate', attempts: 2, message: 'temporary' }] })
  const snapshot = buildSnapshot(temp, new Date('2026-07-22T00:00:00Z'))
  assert.equal(snapshot.readings.expected, 4)
  assert.equal(snapshot.readings.ready, 4)
  assert.equal(snapshot.readings.fahedReady, 2)
  assert.equal(snapshot.readings.nouraReady, 2)
  assert.equal(snapshot.dialogues.expected, 2)
  assert.equal(snapshot.dialogues.ready, 1)
  assert.equal(snapshot.queue.total, 1)
  assert.equal(snapshot.queue.failed, 1)
  assert.equal(snapshot.articles.complete, 1)
  assert.match(snapshot.fingerprint, /^[a-f0-9]{64}$/)
  fs.rmSync(temp, { recursive: true, force: true })
  console.log(JSON.stringify({ ok: true, queue: snapshot.queue.total, progress: snapshot.progressPercent }, null, 2))
}

if (argv.has('--self-test')) selfTest()
else {
  const snapshot = buildSnapshot()
  const shouldWrite = argv.has('--write') || !argv.has('--no-write')
  if (shouldWrite) {
    const previous = readJson(OUTPUT, null)
    if (previous?.fingerprint === snapshot.fingerprint) {
      snapshot.generatedAt = previous.generatedAt || snapshot.generatedAt
    } else {
      atomicJson(OUTPUT, snapshot)
    }
  }
  if (argv.has('--github-output')) writeGithubOutput(snapshot)
  if (argv.has('--summary')) writeSummary(snapshot)
  console.log(JSON.stringify({ state: snapshot.state, progressPercent: snapshot.progressPercent, readings: snapshot.readings, dialogues: snapshot.dialogues, queue: snapshot.queue }, null, 2))
}
