#!/usr/bin/env node
/**
 * يسحب الحوار اليدوي المقفول من Firestore ويجعله المصدر الوحيد للتوليد.
 * لا fallback إلى مقال، لا Gemini، ولا ملف قديم في المستودع.
 * أي اختلاف في البصمة أو المراجعة يوقف التشغيل قبل استدعاء Azure.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceLockPath, validateCloudDialogueLock } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const readArg = (name, fallback = '') => {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))
  return raw ? raw.slice(name.length + 3) : fallback
}
const slugs = readArg('slugs', process.env.RELEASED_SLUGS || '')
  .split(',').map((item) => item.trim()).filter((item) => /^[a-z0-9-]+$/.test(item))
const requeueLocked = ['1', 'true', 'yes'].includes(readArg('requeue', process.env.PODCAST_REQUEUE_LOCKED || '').toLowerCase())
if (!slugs.length) throw new Error('لا توجد slugs صالحة لسحب الحوار اليدوي')

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('حساب خدمة Firebase مفقود — ممنوع التوليد بلا مصدر سحابي مثبت')

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
const manualDir = resolve(ROOT, 'manual-dialogues')
mkdirSync(manualDir, { recursive: true })
mkdirSync(resolve(ROOT, 'podcast-audits', 'source-locks'), { recursive: true })

for (const slug of slugs) {
  const [dialogueSnapshot, productionSnapshot] = await Promise.all([
    db.doc(`podcast_dialogues/${slug}`).get(),
    db.doc(`podcast_production/${slug}`).get(),
  ])
  if (!dialogueSnapshot.exists) throw new Error(`${slug}: لا يوجد حوار مرفوع في podcast_dialogues`)
  if (!productionSnapshot.exists) throw new Error(`${slug}: لا يوجد قرار إرسال للتوليد`)

  const dialogue = dialogueSnapshot.data() || {}
  let production = productionSnapshot.data() || {}
  if (requeueLocked && production.status !== 'queued') {
    /* إعادة التوليد الصريحة تستعيد الصف الفاشل/المعلّق، لكن لا تفعل ذلك
       إلا إذا كانت بصمات النص والنسخة والعدد ما زالت تطابق الحوار السحابي
       حرفياً. بهذا لا يمكن لإعادة المحاولة أن تولّد مسودة قديمة. */
    validateCloudDialogueLock({ slug, dialogue, production, requireQueued: false })
    await productionSnapshot.ref.set({
      status: 'queued',
      dispatchState: 'retrying',
      retryRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      note: 'أعاد أمر إعادة التوليد الحوار المقفول نفسه إلى القائمة بعد مطابقة بصمتيه.',
    }, { merge: true })
    production = { ...production, status: 'queued' }
    console.log(`↻ ${slug}: أُعيد الحوار المقفول نفسه إلى قائمة التوليد`)
  }
  const source = validateCloudDialogueLock({ slug, dialogue, production, requireQueued: true })

  const manualPath = resolve(manualDir, `${slug}.json`)
  writeFileSync(manualPath, `${JSON.stringify(source.turns, null, 2)}\n`)
  const lock = {
    schemaVersion: 1,
    mode: 'manual-upload-locked',
    slug,
    sourceCollection: 'podcast_dialogues',
    sourceDocumentPath: `podcast_dialogues/${slug}`,
    productionDocumentPath: `podcast_production/${slug}`,
    contentSha256: source.contentSha256,
    revisionSha256: source.revisionSha256,
    revisionId: source.revisionId,
    turnCount: source.turnCount,
    fetchedAt: new Date().toISOString(),
    githubRunId: process.env.GITHUB_RUN_ID || '',
    githubSha: process.env.GITHUB_SHA || '',
  }
  writeFileSync(sourceLockPath(ROOT, slug), `${JSON.stringify(lock, null, 2)}\n`)
  await db.doc(`podcast_production/${slug}`).set({
    status: 'generating',
    lockedDialogueContentSha256: source.contentSha256,
    lockedDialogueRevisionSha256: source.revisionSha256,
    lockedDialogueRevisionId: source.revisionId,
    lockedTurnCount: source.turnCount,
    generationStartedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    lastWorkflowRun: process.env.GITHUB_RUN_ID || '',
    note: 'تم قفل الحوار المرفوع ومطابقة بصمته قبل تشغيل Azure.',
  }, { merge: true })
  console.log(`🔒 ${slug}: سُحب الحوار المرفوع فقط (${source.turnCount} مداخلة · ${source.contentSha256.slice(0, 12)})`)
}
