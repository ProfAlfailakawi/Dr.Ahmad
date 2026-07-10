#!/usr/bin/env node
/**
 * الصوت الليلي — لمقالات لوحة التحكم /admin
 *
 * كل ليلة تلقائياً:
 *   ١) يقرأ مقالات site_articles من Firestore
 *   ٢) أي مقال بلا صوت → يولّد له فهد + نورة عبر Azure
 *      (الملفات في audio/ الجذر — مصدر أصول البناء)
 *   ٣) يعلّم وثيقة المقال audio:{fahed,noura} فيظهر المشغّل
 *
 * ملاحظة صريحة: ملفات MP3 تصل الزوار مع الرفعة/النشرة التالية
 * للموقع (الموقع ثابت الملفات) — العلامة في القاعدة فورية.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'audio')
const OUT_PUBLIC = resolve(ROOT, 'public/audio')

/* .env */
const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/* Azure TTS */
async function azure(text, title, voice) {
  const key = env.AZURE_SPEECH_KEY
  const region = env.AZURE_SPEECH_REGION || 'uaenorth'
  if (!key) throw new Error('AZURE_SPEECH_KEY مفقود')
  const paras = text.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('<break time="700ms"/>')
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-KW">
  <voice name="${voice}"><prosody rate="-4%" pitch="0%">${esc(title)}<break time="900ms"/>${paras}</prosody></voice>
</speak>`
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'alfailakawi-site',
    },
    body: ssml,
  })
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 5000) throw new Error('ملف صغير مريب — رفض')
  return buf
}

/* Firestore عبر حساب الخدمة */
async function token() {
  const sa = JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'), 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}`,
  })
  if (!res.ok) throw new Error(`OAuth ${res.status}`)
  return (await res.json()).access_token
}

const BASE = () => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
const sval = (f) => f?.stringValue || ''

/* التشغيل */
mkdirSync(OUT, { recursive: true }); mkdirSync(OUT_PUBLIC, { recursive: true })
const tok = await token()
const res = await fetch(`${BASE()}/site_articles?pageSize=100`, { headers: { Authorization: `Bearer ${tok}` } })
if (!res.ok) throw new Error(`Firestore ${res.status}`)
const docs = (await res.json()).documents || []
console.log(`الصوت الليلي · مقالات اللوحة: ${docs.length}`)

let made = 0
for (const d of docs) {
  const f = d.fields || {}
  const slug = sval(f.slug), title = sval(f.title), body = sval(f.body)
  if (!slug || !body) continue
  const has = f.audio?.mapValue?.fields || {}
  if (has.fahed?.booleanValue && has.noura?.booleanValue) continue

  console.log(`  ◈ ${title.slice(0, 40)}`)
  const voices = [
    ['fahed', 'ar-KW-FahedNeural', `${slug}.mp3`],
    ['noura', 'ar-KW-NouraNeural', `${slug}.noura.mp3`],
  ]
  const done = {}
  for (const [k, v, file] of voices) {
    const p = resolve(OUT, file)
    if (existsSync(p) && statSync(p).size > 5000) { done[k] = true; continue }
    try {
      const buf = await azure(body, title, v)
      writeFileSync(p, buf)
      copyFileSync(p, resolve(OUT_PUBLIC, file))
      done[k] = true; made++
      console.log(`    ✔ ${k} ${(buf.length / 1024).toFixed(0)}KB`)
      await sleep(600)
    } catch (e) { console.error(`    ✘ ${k}: ${e.message}`) }
  }
  if (done.fahed || done.noura) {
    // علّم الوثيقة — المشغّل يظهر للمقال فوراً بعد الرفعة القادمة
    const patch = await fetch(`${BASE()}/site_articles/${d.name.split('/').pop()}?updateMask.fieldPaths=audio`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { audio: { mapValue: { fields: {
        fahed: { booleanValue: Boolean(done.fahed) },
        noura: { booleanValue: Boolean(done.noura) },
      } } } } }),
    })
    console.log(patch.ok ? '    ✔ عُلّمت الوثيقة' : `    ✘ تعليم الوثيقة: ${patch.status}`)
  }
}
console.log(made ? `\n✔ ولّدت ${made} ملفاً — تصل الزوار مع الرفعة القادمة` : '\n✔ لا مقالات تحتاج صوتاً الليلة')
