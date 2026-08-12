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
  /* شرطُ السلامة الحقيقي هو تطابق البصمات: الصوت يجب أن يُولَّد من النصّ
     المعتمد نفسه حرفاً بحرف. تُفحص كل شرطٍ على حدة ويُسمّى ما سقط منها،
     لأن رسالة «لا يطابق» المجملة كانت تُخفي أيّ الشروط الاثني عشر انكسر. */
  const integrity = [
    ['مصدر الحوار admin-upload-kuwaiti', dialogue.source === 'admin-upload-kuwaiti', dialogue.source],
    ['schemaVersion=2', Number(dialogue.schemaVersion) === 2, dialogue.schemaVersion],
    ['بصمة المتن', dialogue.contentSha256 === proof.contentSha256, `${String(dialogue.contentSha256).slice(0, 12)}≠${proof.contentSha256.slice(0, 12)}`],
    ['بصمة المراجعة', dialogue.revisionSha256 === proof.revisionSha256, `${String(dialogue.revisionSha256).slice(0, 12)}≠${proof.revisionSha256.slice(0, 12)}`],
    ['معرّف المراجعة', dialogue.revisionId === proof.revisionId, `${String(dialogue.revisionId).slice(0, 12)}≠${proof.revisionId.slice(0, 12)}`],
    ['عدد المداخلات', Number(dialogue.turnCount) === proof.turnCount, `${dialogue.turnCount}≠${proof.turnCount}`],
    ['مجموعة المصدر', production.sourceCollection === 'podcast_dialogues_kw', production.sourceCollection],
    ['بصمة المتن في قرار الإنتاج', production.expectedDialogueContentSha256 === proof.contentSha256, String(production.expectedDialogueContentSha256).slice(0, 12)],
    ['بصمة المراجعة في قرار الإنتاج', production.expectedDialogueRevisionSha256 === proof.revisionSha256, String(production.expectedDialogueRevisionSha256).slice(0, 12)],
    ['معرّف المراجعة في قرار الإنتاج', production.expectedDialogueRevisionId === proof.revisionId, String(production.expectedDialogueRevisionId).slice(0, 12)],
    ['عدد المداخلات في قرار الإنتاج', Number(production.expectedTurnCount) === proof.turnCount, production.expectedTurnCount],
  ]
  const brokenIntegrity = integrity.filter(([, ok]) => !ok)
  if (brokenIntegrity.length) {
    throw new Error(`${slug}: قفل الحوار الكويتي لا يطابق قرار التوليد — ${brokenIntegrity.map(([label, , got]) => `${label} (الموجود: ${got})`).join(' · ')}`)
  }
  /* حالة الطابور بكرٌ بحسابها لا بسلامتها: تشغيلةٌ سقطت تترك المستند عند
     generating أو needs_review، فتُرفض كلُّ إعادةِ محاولةٍ بعدها ويُظنّ العطب
     في النص. البصمات أعلاه اجتازت، فالنصّ هو المعتمد نفسه — تُستأنف المحاولة
     ويُعلَن ذلك في السجل. أما status غير معروفة (مثل published) فتبقى مرفوضة. */
  const RESUMABLE = new Set(['queued', 'generating', 'needs_review', 'failed'])
  if (!RESUMABLE.has(String(production.status))) {
    throw new Error(`${slug}: حالة الإنتاج «${production.status}» لا تسمح بالتوليد؛ أعد وضعه في الطابور من اللوحة`)
  }
  if (production.status !== 'queued') {
    console.log(`↻ ${slug}: استئناف بعد محاولةٍ سابقة (الحالة «${production.status}») — البصمات مطابقة والنصّ لم يتغيّر`)
  }
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
