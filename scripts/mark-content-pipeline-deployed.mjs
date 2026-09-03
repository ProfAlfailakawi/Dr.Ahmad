#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCanonicalCms } from './canonical-cms.mjs'
import { pipelineFirestore, timeMs } from './content-pipeline-firestore.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const canonical = readCanonicalCms(root)
const cutoff = Date.parse(String(canonical.generatedAt || ''))
if (!Number.isFinite(cutoff)) throw new Error('Canonical CMS snapshot has no valid generatedAt; refusing to mark jobs deployed.')

const { db, FieldValue } = await pipelineFirestore()
const snapshot = await db.collection('admin_content_pipeline').where('state', '==', 'queued').limit(1000).get()
const eligible = snapshot.docs.filter((document) => {
  const data = document.data() || {}
  const requestedAt = timeMs(data.requestedAt)
  return requestedAt > 0 && requestedAt <= cutoff
})
if (!eligible.length) {
  console.log('Canonical pipeline: no queued jobs covered by this deployment.')
  process.exit(0)
}
const batch = db.batch()
for (const document of eligible) {
  batch.set(document.ref, {
    state: 'deployed',
    deployedAt: FieldValue.serverTimestamp(),
    deployedCommit: String(process.env.GITHUB_SHA || ''),
    canonicalGeneratedAt: canonical.generatedAt,
    lastError: '',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}
await batch.commit()
console.log(`Canonical pipeline: ${eligible.length} job(s) marked deployed at ${canonical.generatedAt}.`)
