#!/usr/bin/env node
/** يسحب النسخة الكويتية المقفولة فقط قبل Gemini. لا fallback إلى الفصحى. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dialogueHashes } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const raw = process.argv.find((item) => item.startsWith('--slugs='))?.slice(8) || process.env.RELEASED_SLUGS || ''
const slugs = raw.split(',').map((item) => item.trim()).filter((item) => /^[a-z0-9-]+$/.test(item))
if (!slugs.length) throw new Error('لا توجد slugs كويتية صالحة')
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('حساب خدمة Firebase مفقود؛ ممنوع Gemini بلا مصدر سحابي مقفول')
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
const outDir = resolve(ROOT, 'manual-dialogues-kuwaiti')
const lockDir = resolve(ROOT, 'podcast-audits', 'source-locks-kuwaiti')
mkdirSync(outDir, { recursive: true }); mkdirSync(lockDir, { recursive: true })

for (const slug of slugs) {
  const [dialogueSnap, productionSnap] = await Promise.all([
    db.doc(`podcast_dialogues_kw/${slug}`).get(),
    db.doc(`podcast_production_kw/${slug}`).get(),
  ])
  if (!dialogueSnap.exists) throw new Error(`${slug}: لا يوجد حوار في podcast_dialogues_kw`)
  if (!productionSnap.exists) throw new Error(`${slug}: لا يوجد قرار إنتاج كويتي`)
  const dialogue = dialogueSnap.data() || {}
  const production = productionSnap.data() || {}
  const proof = dialogueHashes(dialogue.turns)
  const exact = dialogue.source === 'admin-upload-kuwaiti'
    && Number(dialogue.schemaVersion) === 2
    && dialogue.contentSha256 === proof.contentSha256
    && dialogue.revisionSha256 === proof.revisionSha256
    && dialogue.revisionId === proof.revisionId
    && Number(dialogue.turnCount) === proof.turnCount
    && production.status === 'queued'
    && production.sourceCollection === 'podcast_dialogues_kw'
    && production.expectedDialogueContentSha256 === proof.contentSha256
    && production.expectedDialogueRevisionSha256 === proof.revisionSha256
    && production.expectedDialogueRevisionId === proof.revisionId
    && Number(production.expectedTurnCount) === proof.turnCount
  if (!exact) throw new Error(`${slug}: قفل الحوار الكويتي لا يطابق قرار التوليد`)
  writeFileSync(resolve(outDir, `${slug}.json`), `${JSON.stringify(proof.turns, null, 2)}\n`)
  writeFileSync(resolve(lockDir, `${slug}.json`), `${JSON.stringify({
    schemaVersion: 1, mode: 'manual-kuwaiti-upload-locked', slug,
    sourceCollection: 'podcast_dialogues_kw', productionCollection: 'podcast_production_kw',
    contentSha256: proof.contentSha256, revisionSha256: proof.revisionSha256,
    revisionId: proof.revisionId, turnCount: proof.turnCount,
    fetchedAt: new Date().toISOString(), githubRunId: process.env.GITHUB_RUN_ID || '', githubSha: process.env.GITHUB_SHA || '',
  }, null, 2)}\n`)
  await productionSnap.ref.set({
    status: 'generating', stage: 'source_locked', lockedDialogueRevisionId: proof.revisionId,
    generationStartedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    note: 'قُفلت النسخة الكويتية نفسها قبل Gemini؛ الفصحى لم تُقرأ ولم تُمس.',
  }, { merge: true })
  console.log(`🔒 ${slug}: قُفل الحوار الكويتي (${proof.turnCount} مداخلة)`)
}
