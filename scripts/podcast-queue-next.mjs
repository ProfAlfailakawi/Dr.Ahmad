#!/usr/bin/env node
/**
 * يقرأ قائمة الانتظار ولا يعيد إلا الحوارات المرفوعة والمقفولة ببصمة مطابقة.
 * أي عنصر قديم أو تغيّر حواره بعد الإرسال ينتقل إلى needs_review قبل Azure.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateCloudDialogueLock } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.error('لا يوجد حساب خدمة — تخطي قراءة القائمة'); process.exit(0) }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
const STALE_GENERATING_MS = 3 * 60 * 60 * 1000
const timestampMs = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}
const queue = db.collection('podcast_production')
const snap = await queue.get()
const candidates = []
for (const productionDoc of snap.docs) {
  const production = productionDoc.data() || {}
  if (production.status === 'queued') {
    candidates.push(productionDoc)
    continue
  }
  if (production.status === 'needs_review' && String(production.note || '').includes('الحالة ليست queued')) {
    await productionDoc.ref.set({
      status: 'queued',
      note: 'صحح حارس الطابور مراجعةً كاذبة نتجت عن لقطة الحالة القديمة.',
      recoveredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    candidates.push(productionDoc)
    console.error(`↻ ${productionDoc.id}: صُححت مراجعة الطابور الكاذبة`)
    continue
  }
  if (production.status !== 'generating') continue
  const startedAt = timestampMs(production.generationStartedAt) || timestampMs(production.updatedAt)
  if (startedAt && Date.now() - startedAt <= STALE_GENERATING_MS) continue
  await productionDoc.ref.set({
    status: 'queued',
    note: 'استعاد حارس الطابور توليداً عالقاً بعد انقضاء مهلة الأمان.',
    recoveredAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  candidates.push(productionDoc)
  console.error(`↻ ${productionDoc.id}: أُعيد التوليد العالق إلى الطابور`)
}
const valid = []
for (const productionDoc of candidates.slice(0, 8)) {
  const slug = productionDoc.id
  if (!/^[a-z0-9-]+$/.test(slug)) continue
  try {
    const storedProduction = productionDoc.data() || {}
    const production = candidates.includes(productionDoc) && storedProduction.status !== 'queued'
      ? { ...storedProduction, status: 'queued' }
      : storedProduction
    const dialogueSnapshot = await db.doc(`podcast_dialogues/${slug}`).get()
    if (!dialogueSnapshot.exists) throw new Error('الحوار المرفوع غير موجود')
    const dialogue = dialogueSnapshot.data() || {}
    validateCloudDialogueLock({ slug, dialogue, production, requireQueued: true })
    valid.push(slug)
    if (valid.length >= 2) break
  } catch (error) {
    await productionDoc.ref.set({
      status: 'needs_review',
      note: `مُنع التوليد قبل Azure: ${error.message}`.slice(0, 700),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    console.error(`⛔ ${slug}: ${error.message}`)
  }
}
if (valid.length) console.log(valid.join(','))
