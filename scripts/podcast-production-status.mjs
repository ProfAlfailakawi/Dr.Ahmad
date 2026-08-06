#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readArg = (name, fallback = '') => {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))
  return raw ? raw.slice(name.length + 3) : fallback
}
const numberArg = (name) => {
  const value = Number(readArg(name, ''))
  return Number.isFinite(value) ? value : null
}
const status = readArg('status')
const stage = readArg('stage', status)
const slugs = readArg('slugs').split(',').map((item) => item.trim()).filter(Boolean)
if (!status || !slugs.length) process.exit(0)
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('حساب خدمة Firebase مفقود عند تحديث حالة الإنتاج')
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
const runId = process.env.GITHUB_RUN_ID || ''
const repository = process.env.GITHUB_REPOSITORY || ''
const runUrl = runId && repository ? `https://github.com/${repository}/actions/runs/${runId}` : ''

for (const slug of slugs) {
  let note = readArg('note')
  const auditPath = resolve(ROOT, 'podcast-audits', `${slug}.ar.json`)
  let audit = null
  if (existsSync(auditPath)) {
    try { audit = JSON.parse(readFileSync(auditPath, 'utf8')) } catch { audit = null }
  }
  if (!note && status === 'needs_review') {
    note = String(audit?.finalGate?.reasonCodes?.[0] || audit?.failure?.reason || 'فشل التوليد قبل النشر').slice(0, 700)
  }
  const current = numberArg('current') ?? Number(audit?.progress?.completed || 0)
  const total = numberArg('total') ?? Number(audit?.progress?.total || audit?.turnCount || 0)
  const patch = {
    status,
    stage,
    note: note || '',
    errorCode: readArg('error-code', String(audit?.failure?.code || '')),
    failedStep: readArg('step', String(audit?.failure?.step || '')),
    failedJob: readArg('job', process.env.GITHUB_JOB || ''),
    currentSegment: Number.isFinite(current) ? current : 0,
    totalSegments: Number.isFinite(total) ? total : 0,
    retryCount: numberArg('retry-count') ?? Number(audit?.failure?.retryCount || 0),
    lastAudioPath: readArg('last-audio', String(audit?.progress?.lastAudioPath || '')),
    mergeStarted: readArg('merge-started') === 'true' || Boolean(audit?.merge?.startedAt),
    uploaded: readArg('uploaded') === 'true' || Boolean(audit?.upload?.completedAt),
    updatedAt: FieldValue.serverTimestamp(),
    lastWorkflowRun: runId,
    workflowRunUrl: runUrl,
  }
  await db.doc(`podcast_production/${slug}`).set({
    ...patch,
    stageHistory: FieldValue.arrayUnion({
      stage,
      status,
      at: new Date().toISOString(),
      runId,
      note: (note || '').slice(0, 220),
      current: patch.currentSegment,
      total: patch.totalSegments,
    }),
  }, { merge: true })
  console.log(`✓ ${slug}: ${status}/${stage}`)
}
