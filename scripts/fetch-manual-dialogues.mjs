#!/usr/bin/env node
/**
 * جسر الحوار اليدوي: اللوحة تحفظ حوار الدكتور في Firestore (podcast_dialogues/<slug>)،
 * والمحرك يقرأ manual-dialogues/<slug>.json من المستودع. هذا السكربت يصل بينهما قبل
 * التوليد: يسحب حوار كل slug مطلوب ويكتبه ملفاً محلياً.
 *
 * قاعدة الأسبقية: ملف المستودع الموجود يبقى سيد نفسه (حلقات اعتُمد نصها بالدفع المباشر
 * لا تُداس بمسودة قديمة في السحابة)؛ وFirestore يُعتمد حين لا ملف في المستودع — وهو
 * مسار الرفع من غرفة الإنتاج (Word → مداخلات → حفظ → توليد ليلي). مسودة بلا حوار
 * كامل (أقل من مداخلتين أو بمتحدث واحد) تُتجاهل بصوت مسموع.
 *
 * الاستخدام: node scripts/fetch-manual-dialogues.mjs --slugs="a,b"
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = process.argv.find((item) => item.startsWith('--slugs='))
const slugs = String(arg ? arg.slice('--slugs='.length) : process.env.RELEASED_SLUGS || '')
  .split(',').map((item) => item.trim()).filter((item) => /^[a-z0-9-]+$/.test(item))
if (!slugs.length) { console.log('لا slugs — لا شيء يُسحب.'); process.exit(0) }

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.log('لا حساب خدمة — الاعتماد على ملفات المستودع فقط.'); process.exit(0) }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

const validTurns = (turns) => Array.isArray(turns) && turns.length >= 2
  && turns.every((turn) => turn && typeof turn.text === 'string' && turn.text.trim()
    && (turn.speaker === 'male' || turn.speaker === 'female'))
  && new Set(turns.map((turn) => turn.speaker)).size === 2

const dir = resolve(ROOT, 'manual-dialogues')
mkdirSync(dir, { recursive: true })

for (const slug of slugs) {
  const filePath = resolve(dir, `${slug}.json`)
  if (existsSync(filePath)) {
    console.log(`✓ ${slug}: ملف المستودع موجود — يبقى المعتمد (حوار مدفوع بالمراجعة).`)
    continue
  }
  let turns = null
  for (const ref of [db.doc(`podcast_dialogues/${slug}`), db.doc(`social_queue/podcast-dialogue-${slug}`)]) {
    try {
      const snapshot = await ref.get()
      const data = snapshot.exists ? snapshot.data() : null
      if (data && validTurns(data.turns)) { turns = data.turns; break }
    } catch { /* المرجع التالي */ }
  }
  if (!turns) {
    console.log(`ⓘ ${slug}: لا حوار يدوي مكتمل في اللوحة — يمضي التوليد بمساره المعتاد.`)
    continue
  }
  const cleaned = turns.map((turn) => ({
    speaker: turn.speaker,
    text: String(turn.text).trim(),
    deliveryType: String(turn.deliveryType || 'statement'),
    pauseAfterMs: Number.isFinite(Number(turn.pauseAfterMs)) ? Number(turn.pauseAfterMs) : 560,
    overlapMs: Math.max(0, Math.min(150, Number(turn.overlapMs) || 0)),
    musicBridgeAfter: Boolean(turn.musicBridgeAfter),
  }))
  writeFileSync(filePath, `${JSON.stringify(cleaned, null, 2)}\n`)
  console.log(`✍ ${slug}: سُحب حوار اللوحة (${cleaned.length} مداخلة) → manual-dialogues/${slug}.json`)
}
