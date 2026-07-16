#!/usr/bin/env node
/**
 * يقرأ قائمة انتظار التوليد من Firestore (podcast_production حيث status == queued)
 * ويطبع حتى 2 slug مفصولة بفواصل — يستهلكها التشغيل الليلي المجدول.
 * بلا مخرجات = لا شيء في القائمة (خروج 0 بهدوء).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.error('لا يوجد حساب خدمة — تخطي قراءة القائمة'); process.exit(0) }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)
const snap = await db.collection('podcast_production').where('status', '==', 'queued').limit(2).get()
const slugs = snap.docs.map((doc) => doc.id).filter((slug) => /^[a-z0-9-]+$/.test(slug))
if (slugs.length) console.log(slugs.join(','))
