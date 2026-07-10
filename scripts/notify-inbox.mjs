#!/usr/bin/env node
/**
 * مُنبّه الوارد — إشعار على جهاز الدكتور فور وصول جديد.
 *
 * كل ساعة (launchd: com.alfailakawi.inbox) + عند فتح الجهاز:
 *   ١) يقرأ رسائل التواصل والمشتركين الجدد منذ آخر فحص (sa.json)
 *   ٢) يعرض إشعار macOS لكل جديد: «رسالة من فلان — استشارة»
 *   ٣) يحفظ آخر طابع زمني في .notify-state.json (غير مُتتبَّع)
 *
 * صريحاً: هذا إشعار جهازٍ محلي — بريد إلكتروني فعلي يحتاج خدمة سحابية لاحقاً.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE = resolve(ROOT, '.notify-state.json')
const SA = resolve(ROOT, 'sa.json')

if (!existsSync(SA)) { console.error('sa.json مفقود'); process.exit(0) }
initializeApp({ credential: cert(JSON.parse(readFileSync(SA, 'utf8'))) })
const db = getFirestore()

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {}
const since = state.last ? Timestamp.fromMillis(state.last) : Timestamp.fromMillis(Date.now() - 86_400_000)

function notify(title, body) {
  try {
    execFileSync('osascript', ['-e',
      `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)} sound name "Glass"`])
  } catch { /* بيئة بلا واجهة — نكتفي بالسجل */ }
  console.log(`🔔 ${title}: ${body}`)
}

let latest = state.last || 0
try {
  const msgs = await db.collection('messages').where('createdAt', '>', since).orderBy('createdAt').get()
  for (const d of msgs.docs) {
    const m = d.data()
    notify('رسالة جديدة في موقعك', `${m.name || 'زائر'} — ${m.topic || ''}`.trim())
    const t = m.createdAt?.toMillis?.() || Date.now()
    if (t > latest) latest = t
  }
  const subs = await db.collection('subscribers').where('createdAt', '>', since).orderBy('createdAt').get()
  if (subs.size > 0) {
    notify('مشترك جديد في النشرة', subs.size === 1 ? subs.docs[0].id : `${subs.size} مشتركين جدد`)
    for (const d of subs.docs) {
      const t = d.data().createdAt?.toMillis?.() || Date.now()
      if (t > latest) latest = t
    }
  }
  if (msgs.empty && subs.empty) console.log('لا جديد.')
} catch (e) {
  console.error('تعذّر الفحص:', String(e).slice(0, 150))
  process.exit(0) // لا نفشل الجدولة
}

writeFileSync(STATE, JSON.stringify({ last: latest || Date.now() }))
