#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readArg = (name, fallback = '') => {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))
  return raw ? raw.slice(name.length + 3) : fallback
}
const status = readArg('status')
const slugs = readArg('slugs').split(',').map((item) => item.trim()).filter(Boolean)
if (!status || !slugs.length) process.exit(0)
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('حساب خدمة Firebase مفقود عند تحديث حالة الإنتاج')
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
for (const slug of slugs) {
  let note = readArg('note')
  const auditPath = resolve(ROOT, 'podcast-audits', `${slug}.ar.json`)
  if (!note && status === 'needs_review' && existsSync(auditPath)) {
    try {
      const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
      note = String(audit.finalGate?.reasonCodes?.[0] || audit.failure?.reason || 'فشل التوليد قبل النشر').slice(0, 700)
    } catch { note = 'فشل التوليد قبل النشر' }
  }
  await db.doc(`podcast_production/${slug}`).set({
    status,
    note: note || '',
    updatedAt: FieldValue.serverTimestamp(),
    lastWorkflowRun: process.env.GITHUB_RUN_ID || '',
  }, { merge: true })
  console.log(`✓ ${slug}: ${status}`)
}
