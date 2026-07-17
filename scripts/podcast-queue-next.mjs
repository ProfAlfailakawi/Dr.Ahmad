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
const snap = await db.collection('podcast_production').where('status', '==', 'queued').limit(8).get()
const valid = []
for (const productionDoc of snap.docs) {
  const slug = productionDoc.id
  if (!/^[a-z0-9-]+$/.test(slug)) continue
  try {
    const production = productionDoc.data() || {}
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
