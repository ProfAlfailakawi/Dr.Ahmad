#!/usr/bin/env node
/** يرفع بذرة الـ144 حواراً الكويتيين من الملف الموحّد إلى مجموعة مستقلة. لا يلمس podcast_dialogues. */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dialogueHashes } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEED = resolve(ROOT, 'src/data/kuwaiti-dialogues.json')
const DRY_RUN = process.argv.includes('--dry-run')
if (!existsSync(SEED)) throw new Error('ملف بذرة الحوار الكويتي مفقود: src/data/kuwaiti-dialogues.json')
const seed = JSON.parse(readFileSync(SEED, 'utf8'))
const episodes = seed?.episodes && typeof seed.episodes === 'object' ? seed.episodes : {}
const slugs = Object.keys(episodes).sort()
if (Number(seed?.count) !== 144 || slugs.length !== 144) {
  throw new Error(`رفض الرفع: المتوقع 144 حواراً كويتياً، الموجود ${slugs.length}`)
}
if (DRY_RUN) {
  console.log(`✓ خطة رفع: ${slugs.length} مستنداً إلى podcast_dialogues_kw من الملف الموحّد (لا كتابة)`)
  process.exit(0)
}

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('FIREBASE_SERVICE_ACCOUNT/sa.json مفقود؛ لم تُكتب أي بيانات')
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
let written = 0
for (const slug of slugs) {
  const proof = dialogueHashes(episodes[slug])
  await db.doc(`podcast_dialogues_kw/${slug}`).set({
    schemaVersion: 2,
    source: 'admin-upload-kuwaiti',
    dialect: seed.profile || 'kuwaiti-urban-soft-v1',
    status: 'ready',
    turns: proof.turns,
    contentSha256: proof.contentSha256,
    revisionSha256: proof.revisionSha256,
    revisionId: proof.revisionId,
    turnCount: proof.turnCount,
    seededFrom: 'src/data/kuwaiti-dialogues.json',
    seededAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
  written += 1
  console.log(`✓ ${slug}`)
}
console.log(`تم رفع ${written}/144 إلى podcast_dialogues_kw دون لمس الحوار العربي.`)
