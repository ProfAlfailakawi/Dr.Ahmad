#!/usr/bin/env node
/*
 * إرسال الحوار اليدوي للتوليد آلياً (بأمر الدكتور «اعمل كل شي»): يُنشئ «قرار
 * الإرسال» (podcast_production/{slug} = queued) بنفس بصمة القفل التي تكتبها
 * اللوحة تماماً — مأخوذةً من الحوار المخزّن في podcast_dialogues. لا يلمس نصّاً،
 * ولا يُرسل إلا حواراً مرفوعاً بالمشرف (admin-upload) مطابق البصمة. آمنٌ ومحدود.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dialogueHashes } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const slugs = (process.argv.find((a) => a.startsWith('--slugs=')) || '').split('=')[1]
  ?.split(',').map((s) => s.trim()).filter((s) => /^[a-z0-9-]+$/.test(s)) || []
if (!slugs.length) { console.error('لا توجد slugs صالحة'); process.exit(1) }

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.error('حساب خدمة Firebase مفقود'); process.exit(1) }
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

let queued = 0
for (const slug of slugs) {
  const snap = await db.doc(`podcast_dialogues/${slug}`).get()
  if (!snap.exists) { console.log(`⊘ ${slug}: لا يوجد حوار مرفوع`); continue }
  const dialogue = snap.data() || {}
  if (dialogue.source !== 'admin-upload' || Number(dialogue.schemaVersion) !== 2) {
    console.log(`⊘ ${slug}: ليس حواراً مرفوعاً بالمشرف (source/schema)`); continue
  }
  if (!Array.isArray(dialogue.turns) || dialogue.turns.length < 2) {
    console.log(`⊘ ${slug}: الحوار ناقص (${dialogue.turns?.length || 0} مداخلة)`); continue
  }
  const hash = dialogueHashes(dialogue.turns)
  // لا نُرسل إلا إن طابقت البصمة المخزّنة المحسوبة (القفل نفسه الذي يفحصه الإطلاق)
  if (dialogue.revisionSha256 && dialogue.revisionSha256 !== hash.revisionSha256) {
    console.log(`⊘ ${slug}: بصمة الحوار المخزّنة لا تطابق محتواه`); continue
  }
  await db.doc(`podcast_production/${slug}`).set({
    status: 'queued',
    sourceCollection: 'podcast_dialogues',
    expectedDialogueContentSha256: hash.contentSha256,
    expectedDialogueRevisionSha256: hash.revisionSha256,
    expectedDialogueRevisionId: hash.revisionId,
    expectedTurnCount: hash.turns.length,
    queuedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    note: 'أُرسل للتوليد آلياً بأمر الدكتور.',
  }, { merge: true })
  queued += 1
  console.log(`✓ ${slug}: أُرسل للتوليد · ${hash.turns.length} مداخلة · بصمة ${hash.contentSha256.slice(0, 12)}`)
}
console.log(`\nأُرسل ${queued}/${slugs.length} حواراً للتوليد.`)
if (!queued) process.exit(2)
