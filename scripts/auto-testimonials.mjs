#!/usr/bin/env node
/**
 * مزامنة شهادات «ماذا قالوا» من رسائل حقيقية معتمدة فقط.
 *
 * لا يستخدم AI، ولا ينشر الأسماء أو البريد. يقرأ من messages حيث:
 *   approvedForTestimonial === true
 * ثم ينسخ نصًا مجهول الهوية إلى site_testimonials.
 */
import process from 'node:process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const args = new Set(process.argv.slice(2))
const SELF_TEST = args.has('--self-test')
const MAX = Number(process.env.TESTIMONIAL_SYNC_LIMIT || 50)

const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim()
const hash = (value) => createHash('sha1').update(value).digest('hex').slice(0, 14)

function sanitizeQuote(value = '') {
  const quote = clean(value)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '')
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return quote.length > 420 ? `${quote.slice(0, 417).trim()}…` : quote
}

function sourceQuote(data = {}) {
  return sanitizeQuote(data.testimonialQuote || data.publicQuote || data.message || '')
}

function validPublishedQuote(quote) {
  return quote.length >= 35 && quote.length <= 420
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    || (process.env.FIREBASE_SERVICE_ACCOUNT && existsSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT))
      ? readFileSync(resolve(process.env.FIREBASE_SERVICE_ACCOUNT), 'utf8')
      : '')
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_DRAHMAD_8E9E2 مفقود')
  return JSON.parse(raw)
}

async function firebaseContext() {
  const account = loadServiceAccount()
  const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID || account.project_id })
  return getFirestore(app)
}

async function run() {
  if (SELF_TEST) {
    const quote = sanitizeQuote('أعجبني المقال كثيرًا، وهذا بريدي test@example.com ورقمي +965 5555 5555')
    if (/example|555/.test(quote)) throw new Error('فشل إخفاء بيانات التواصل')
    if (!validPublishedQuote('هذه شهادة طويلة بما يكفي لتظهر للناس بعد اعتمادها، من دون اسم أو بريد أو رقم.')) throw new Error('فشل اختبار طول الشهادة')
    console.log('✓ اختبار مزامنة الشهادات: الخصوصية والطول سليمان')
    return
  }

  const db = await firebaseContext()
  const snap = await db.collection('messages')
    .where('approvedForTestimonial', '==', true)
    .limit(MAX)
    .get()

  let synced = 0
  let skipped = 0
  const docs = [...snap.docs].sort((left, right) => {
    const l = Number(left.data()?.createdAt?.seconds || 0)
    const r = Number(right.data()?.createdAt?.seconds || 0)
    return r - l
  })
  for (const doc of docs) {
    const data = doc.data() || {}
    const quote = sourceQuote(data)
    if (!validPublishedQuote(quote)) { skipped += 1; continue }
    const id = `msg-${hash(doc.id)}`
    await db.collection('site_testimonials').doc(id).set({
      quote,
      source: 'approved_message',
      sourceMessageId: doc.id,
      status: data.testimonialHidden ? 'hidden' : 'published',
      published: data.testimonialHidden ? false : true,
      anonymous: true,
      createdAt: data.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    synced += 1
  }
  console.log(`✔ شهادات معتمدة: ${synced} · متروكة: ${skipped}`)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
