#!/usr/bin/env node
import fs from 'node:fs'
import { pipelineFirestore, timeMs } from './content-pipeline-firestore.mjs'

const mode = process.argv.includes('--mark-dispatched') ? 'mark' : 'check'
const { db, FieldValue } = await pipelineFirestore()
const now = Date.now()
const retryAfterMs = 90 * 60 * 1000

if (mode === 'mark') {
  const raw = String(process.env.CONTENT_PIPELINE_JOB_IDS || '[]')
  let ids = []
  try { ids = JSON.parse(raw) } catch { ids = [] }
  ids = Array.isArray(ids) ? ids.map(String).filter(Boolean).slice(0, 80) : []
  if (!ids.length) {
    console.log('Canonical pipeline: no jobs to mark.')
    process.exit(0)
  }
  const batch = db.batch()
  for (const id of ids) {
    const ref = db.collection('admin_content_pipeline').doc(id)
    batch.set(ref, {
      state: 'queued',
      dispatchRequestedAt: FieldValue.serverTimestamp(),
      dispatchAttempts: FieldValue.increment(1),
      lastError: '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
  await batch.commit()
  console.log(`Canonical pipeline: marked ${ids.length} jobs as dispatched.`)
  process.exit(0)
}

const [scheduledSnapshot, queuedSnapshot] = await Promise.all([
  db.collection('admin_content_pipeline').where('state', '==', 'scheduled').limit(500).get(),
  db.collection('admin_content_pipeline').where('state', '==', 'queued').limit(500).get(),
])
const due = []
for (const document of scheduledSnapshot.docs) {
  const data = document.data() || {}
  const releaseAt = timeMs(data.releaseAt)
  if (releaseAt > 0 && releaseAt <= now) due.push(document.id)
}
for (const document of queuedSnapshot.docs) {
  const data = document.data() || {}
  if (timeMs(data.deployedAt) > 0) continue
  const lastDispatch = timeMs(data.dispatchRequestedAt)
  if (!lastDispatch || now - lastDispatch >= retryAfterMs) due.push(document.id)
}
const ids = [...new Set(due)].slice(0, 80)
const output = process.env.GITHUB_OUTPUT
if (output) {
  fs.appendFileSync(output, `due=${ids.length ? 'true' : 'false'}\n`)
  fs.appendFileSync(output, `count=${ids.length}\n`)
  fs.appendFileSync(output, `ids=${JSON.stringify(ids)}\n`)
}
console.log(ids.length
  ? `Canonical pipeline: ${ids.length} due/retry job(s) require a guarded deployment.`
  : 'Canonical pipeline: no scheduled or stale queued jobs are due.')
