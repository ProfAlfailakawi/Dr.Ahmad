#!/usr/bin/env node
/**
 * يربط أصوات site_articles بعد تثبيت معاملة R2 فقط.
 * Idempotent: عند فشل Firestore يبقى الطابور، وتعيد المحاولة التالية ما لم يكتمل.
 */
import { createSign } from 'node:crypto'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PENDING = resolve(ROOT, '.audio-site-patches.json')
const env = { ...process.env }
const serviceAccountPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
const publicBase = (env.AUDIO_PUBLIC_BASE_URL || env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

function atomicJson(file, value) {
  const temporary = `${file}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, file)
}

async function accessToken(account) {
  const now = Math.floor(Date.now() / 1000)
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${base64({ alg: 'RS256', typ: 'JWT' })}.${base64({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // URN الصحيح هو oauth لا oauth2 — الحرف الزائد كان يعيد 400 unsupported_grant_type دائماً
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  if (!response.ok) throw new Error(`تعذر توثيق حساب Firebase (${response.status})`)
  return (await response.json()).access_token
}

async function verifyAudio(url) {
  if (!url.startsWith(`${publicBase}/`)) throw new Error(`رابط خارج AUDIO_PUBLIC_BASE_URL: ${url}`)
  const response = await fetch(url, { headers: { Range: 'bytes=0-0', 'Cache-Control': 'no-cache' } })
  if (![200, 206].includes(response.status)) throw new Error(`الصوت غير جاهز علناً (${response.status}): ${url}`)
  if (!/audio/i.test(response.headers.get('content-type') || '')) throw new Error(`Content-Type غير صوتي: ${url}`)
}

if (!existsSync(PENDING)) {
  console.log('لا توجد روابط site_articles مؤجلة.')
  process.exit(0)
}
if (!publicBase) throw new Error('AUDIO_PUBLIC_BASE_URL مفقود')
if (!existsSync(serviceAccountPath)) throw new Error('حساب خدمة Firebase مفقود')
const account = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
if (!account.project_id || !account.client_email || !account.private_key) throw new Error('حساب خدمة Firebase غير صالح')
if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PROJECT_ID !== account.project_id) throw new Error('FIREBASE_PROJECT_ID لا يطابق حساب الخدمة')

const pending = JSON.parse(readFileSync(PENDING, 'utf8'))
const items = Array.isArray(pending.items) ? pending.items : []
const token = await accessToken(account)
const remaining = []
let completed = 0
for (const item of items) {
  try {
    const urls = Object.values(item.audio || {})
    if (!urls.length) throw new Error('لا توجد روابط صوت')
    await Promise.all(urls.map(verifyAudio))
    const response = await fetch(`https://firestore.googleapis.com/v1/${item.documentName}?updateMask.fieldPaths=audio`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { audio: { mapValue: { fields: Object.fromEntries(
        Object.entries(item.audio).map(([key, url]) => [key, { stringValue: url }]),
      ) } } } }),
    })
    if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 180)}`)
    completed += 1
  } catch (error) {
    remaining.push({ ...item, lastError: error.message, lastAttemptAt: new Date().toISOString() })
  }
}
if (remaining.length) {
  atomicJson(PENDING, { ...pending, items: remaining, updatedAt: new Date().toISOString() })
  throw new Error(`اكتمل ${completed} وبقي ${remaining.length}؛ حُفظ الطابور للمحاولة التالية`)
}
unlinkSync(PENDING)
console.log(`✓ رُبط صوت ${completed} من مقالات Firestore بعد تثبيت R2`)
