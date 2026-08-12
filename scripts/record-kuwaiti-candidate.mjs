#!/usr/bin/env node
/** يسجل نسخة Gemini التجريبية في Staging داخل Firestore. لا ينشرها للزائر. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const slug = arg('slug')
const revisionId = arg('revision')
if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug غير صالح')
if (!/^[A-Za-z0-9._:-]{8,128}$/.test(revisionId)) throw new Error('revision غير صالح')
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) throw new Error('حساب خدمة Firebase مفقود')
const audioFile = resolve(ROOT, 'audio', `${slug}.dialogue-kw.mp3`)
const transcriptFile = resolve(ROOT, 'audio', `${slug}.dialogue-kw.json`)
const auditFile = resolve(ROOT, 'podcast-audits', 'kuwaiti', `${slug}.json`)
for (const file of [audioFile, transcriptFile, auditFile]) if (!existsSync(file)) throw new Error(`ملف المرشح مفقود: ${file}`)
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const audioSha256 = sha(audioFile)
const transcriptSha256 = sha(transcriptFile)
const audit = JSON.parse(readFileSync(auditFile, 'utf8'))
if (audit.slug !== slug || audit.revisionId !== revisionId || audit.audioSha256 !== audioSha256 || audit.transcriptSha256 !== transcriptSha256) {
  throw new Error('مرشح Gemini لا يطابق قفل المصدر/بصماته')
}
const base = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
if (!/^https:\/\//i.test(base)) throw new Error('AUDIO_PUBLIC_BASE_URL مطلوب لمعاينة المرشح')
const prefix = `staging/kuwaiti/${slug}/${revisionId}`
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const account = JSON.parse(readFileSync(saPath, 'utf8'))
const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: account.project_id })
const db = getFirestore(app)
const ref = db.doc(`podcast_production_kw/${slug}`)
const snap = await ref.get()
if (!snap.exists) throw new Error('قرار الإنتاج الكويتي مفقود')
const production = snap.data() || {}
if (production.expectedDialogueRevisionId !== revisionId || production.lockedDialogueRevisionId !== revisionId) {
  throw new Error('المرشح لا يطابق النسخة التي أُرسلت من لوحة التحكم')
}
await ref.set({
  status: 'awaiting_approval',
  stage: 'awaiting_approval',
  candidateRevisionId: revisionId,
  candidateAudioSha256: audioSha256,
  candidateTranscriptSha256: transcriptSha256,
  candidateAudioUrl: `${base}/${prefix}/${slug}.dialogue-kw.mp3`,
  candidateTranscriptUrl: `${base}/${prefix}/${slug}.dialogue-kw.json`,
  candidateAuditUrl: `${base}/${prefix}/${slug}.audit.json`,
  candidateModel: audit.model || '',
  candidateVoices: audit.voices || {},
  candidateDurationSec: Number(audit.durationSec || 0),
  candidateGeneratedAt: audit.generatedAt || new Date().toISOString(),
  approvalState: 'waiting',
  approvalRequestedAt: FieldValue.delete(),
  approvalError: '',
  updatedAt: FieldValue.serverTimestamp(),
  note: 'تولدت نسخة Gemini الكويتية في Staging. لن تظهر للزائر قبل ضغط «اعتماد ونشر».',
}, { merge: true })
console.log(`✓ سجل المرشح للمراجعة: ${slug} · ${revisionId}`)
