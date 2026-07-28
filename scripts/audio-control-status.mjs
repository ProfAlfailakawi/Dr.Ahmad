#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const slug = arg('slug').trim()
const mode = arg('mode').trim()
const status = arg('status').trim()
const disabled = arg('disabled') !== 'false'
const message = arg('message').trim().slice(0, 700)
const clearAudio = process.argv.includes('--clear-audio')

if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug غير صالح')
if (!['fahed', 'noura', 'dialogue', 'reading'].includes(mode)) throw new Error('mode غير صالح')
if (!/^[a-z_]{2,30}$/.test(status)) throw new Error('status غير صالح')

const serviceAccountPath = resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
let credential
if (process.env.GOOGLE_SA_JSON) credential = cert(JSON.parse(process.env.GOOGLE_SA_JSON))
else if (existsSync(serviceAccountPath)) credential = cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')))
else credential = applicationDefault()
const projectId = process.env.FIREBASE_PROJECT_ID || 'drahmad-8e9e2'
const app = getApps()[0] || initializeApp({ credential, projectId })
const db = getFirestore(app)

const objectMap = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const disabledKey = `${mode}Disabled`
const statusKey = `${mode}Status`
const updatedKey = `${mode}UpdatedAt`
const messageKey = `${mode}Message`
const now = new Date().toISOString()

const clearVoiceFromAudio = (audio) => {
  if (mode === 'fahed' || mode === 'reading') delete audio.fahed
  if (mode === 'noura' || mode === 'reading') delete audio.noura
  if (mode === 'dialogue') delete audio.dialogue
}

const siteRef = db.collection('site_articles').doc(slug)
const site = await siteRef.get()
if (site.exists) {
  const current = objectMap(site.data()?.audioControl)
  const next = { ...current, [disabledKey]: disabled, [statusKey]: status, [updatedKey]: now, [messageKey]: message }
  const patch = { audioControl: next, updatedAt: FieldValue.serverTimestamp() }
  if (clearAudio) {
    const audio = { ...objectMap(site.data()?.audio) }
    clearVoiceFromAudio(audio)
    patch.audio = Object.keys(audio).length ? audio : FieldValue.delete()
  }
  await siteRef.set(patch, { merge: true })
  console.log(`✓ حدّثت حالة ${mode} لمقال Firestore: ${slug} → ${status}`)
} else {
  const ref = db.collection('content_overrides').doc(`article:${slug}`)
  const snapshot = await ref.get()
  const existing = snapshot.exists ? snapshot.data() || {} : {}
  const patch = objectMap(existing.patch)
  const current = objectMap(patch.audioControl)
  const next = { ...current, [disabledKey]: disabled, [statusKey]: status, [updatedKey]: now, [messageKey]: message }
  await ref.set({ ...existing, patch: { ...patch, audioControl: next }, updatedAt: FieldValue.serverTimestamp() })
  console.log(`✓ حدّثت حالة ${mode} لمقال أصلي: ${slug} → ${status}`)
}

if (mode === 'dialogue' && status === 'cleared') {
  await db.collection('podcast_production').doc(slug).set({
    status: 'cleared',
    dispatchState: 'cleared',
    note: 'أُلغي الصوت الحواري يدوياً من لوحة التحكم، مع إبقاء مسودة الحوار لإعادة التوليد لاحقاً.',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}
