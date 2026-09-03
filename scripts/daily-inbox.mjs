#!/usr/bin/env node
/**
 * بريد المساء (أمر الدكتور ٢٠٢٦-٠٧-٢٣): أي يومٍ وصلت فيه رسائل تواصل جديدة،
 * يلخصها سطرٌ واحد يصل الدكتور مساءً عبر بوته — العدد والمواضيع فقط،
 * بلا اسم ولا بريد ولا نص رسالة. اليوم الخالي لا يُرسل عنه شيء.
 */
import { createSign } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const OUT_FILE = resolve(ROOT, 'build/daily-inbox.json')

function loadServiceAccount() {
  return JSON.parse(readFileSync(resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'), 'utf8'))
}

let serviceAccount
async function accessToken() {
  serviceAccount ||= loadServiceAccount()
  const now = Math.floor(Date.now() / 1_000)
  const base64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${base64({ alg: 'RS256', typ: 'JWT' })}.${base64({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  })
  if (!response.ok) throw new Error(`توثيق حساب الخدمة (${response.status})`)
  return (await response.json()).access_token
}

const fsValue = (value) => {
  if (value == null || typeof value !== 'object') return value
  if ('stringValue' in value) return value.stringValue
  if ('timestampValue' in value) return value.timestampValue
  if ('integerValue' in value) return Number(value.integerValue)
  return value
}

async function main() {
  const projectId = env.FIREBASE_PROJECT_ID || (serviceAccount ||= loadServiceAccount()).project_id
  const token = await accessToken()
  const documents = []
  let pageToken = ''
  do {
    const query = new URLSearchParams({ pageSize: '300' })
    if (pageToken) query.set('pageToken', pageToken)
    const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/messages?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error(`قراءة الرسائل (${response.status})`)
    const result = await response.json()
    documents.push(...(result.documents || []))
    pageToken = result.nextPageToken || ''
  } while (pageToken)

  const kuwaitDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date())
  const todayMessages = documents.filter((doc) => {
    const created = fsValue(doc?.fields?.createdAt)
    if (!created) return false
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date(created)) === kuwaitDay
  })
  const topics = new Map()
  for (const doc of todayMessages) {
    const topic = String(fsValue(doc?.fields?.topic) || 'أخرى')
    topics.set(topic, (topics.get(topic) || 0) + 1)
  }
  const count = todayMessages.length
  const western = (value) => Number(value).toLocaleString('en-US')
  const topicsLine = [...topics.entries()].map(([topic, n]) => `${topic} (${western(n)})`).join(' · ')
  const report = {
    id: `daily-${kuwaitDay}`,
    generatedAt: new Date().toISOString(),
    empty: count === 0,
    text: count === 0 ? '' : [
      '*بريد المساء*',
      '',
      `وصلتك اليوم *${western(count)}* ${count === 1 ? 'رسالة' : count === 2 ? 'رسالتان' : count <= 10 ? 'رسائل' : 'رسالة'}: ${topicsLine}.`,
      'تفاصيلها في لوحة التحكم ← الجمهور ← الرسائل.',
      '',
      '_سطر آلي يومي — لا يصلك إلا حين يصل جديد._',
    ].join('\n'),
    numbers: { count },
  }
  mkdirSync(dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(count === 0 ? '✔ لا رسائل اليوم — لن يُرسل شيء.' : `✔ بريد المساء جاهز: ${count} رسالة (${topicsLine})`)
}

await main()
