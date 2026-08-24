#!/usr/bin/env node
/** يثبت أن ملف Staging الذي اعتمده المشرف هو نفسه الذي سيترقى إلى الاسم العام. */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
const audio = resolve(ROOT, 'audio', `${slug}.dialogue-kw.mp3`)
const transcript = resolve(ROOT, 'audio', `${slug}.dialogue-kw.json`)
const auditFile = resolve(ROOT, 'podcast-audits', 'kuwaiti', `${slug}.json`)
for (const file of [audio, transcript, auditFile]) if (!existsSync(file)) throw new Error(`ملف الترقية مفقود: ${file}`)
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const audioSha256 = sha(audio)
const transcriptSha256 = sha(transcript)
const audit = JSON.parse(readFileSync(auditFile, 'utf8'))
if (audit.slug !== slug || audit.revisionId !== revisionId || audit.audioSha256 !== audioSha256 || audit.transcriptSha256 !== transcriptSha256) {
  throw new Error('ملفات Staging لا تطابق تقرير Gemini')
}
const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const account = JSON.parse(readFileSync(saPath, 'utf8'))
const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: account.project_id })
const db = getFirestore(app)
const snap = await db.doc(`podcast_production_kw/${slug}`).get()
if (!snap.exists) throw new Error('قرار الاعتماد مفقود')
const p = snap.data() || {}
const exact = p.approvalState === 'accepted'
  && p.candidateRevisionId === revisionId
  && p.candidateAudioSha256 === audioSha256
  && p.candidateTranscriptSha256 === transcriptSha256
if (!exact) throw new Error('المشرف لم يعتمد هذه البصمة نفسها؛ ممنوع الترقية')
const statePath = resolve(ROOT, '.podcast-state.json')
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { done: {} }
state.done ||= {}
state.done[`${slug}:kw`] = {
  status: 'accepted_automated', provider: 'gemini', model: audit.model || 'gemini-2.5-pro-preview-tts',
  profile: audit.profile || 'kuwaiti-urban-soft-v1', audioHash: audioSha256, transcriptHash: transcriptSha256,
  revisionId, acceptedAt: new Date().toISOString(), approval: 'explicit_admin',
}
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
console.log(`✓ اعتماد مطابق حرفياً: ${slug} · ${audioSha256.slice(0, 12)}`)
