#!/usr/bin/env node
/**
 * يُبلّغ لوحة الدكتور بما جرى للحوار فعلاً.
 *
 * العطب الذي يعالجه: الحلقة تُولَّد وتجتاز البوابات وتُرفع إلى R2 وتُسجَّل في
 * المانيفست… ثم تبقى اللوحة تقول «مسودة» و«غير مولَّد» إلى الأبد. لأن
 * fetch-manual-dialogues يكتب «generating» عند البدء، ولا كاتبَ للنتيجة.
 * فيظنّ الدكتور أن التوليد فشل، فيعيد الإرسال، فيتكرّر كل شيء بلا داعٍ.
 *
 * المصدر الوحيد للحقيقة هنا هو سجلّ المحرك (.podcast-state.json): ما قَبِله
 * المحرك يُبلَّغ مقبولاً، وما عزله يُبلَّغ محتاجاً للمراجعة. لا نخترع حالةً
 * ولا نتفاءل: إن لم يكن في السجل خبرٌ عن حوارٍ، لا نلمس حالته.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** حالات القبول في سجلّ المحرك ← حالة اللوحة */
export const ACCEPTED = Object.freeze(['accepted_automated', 'accepted_pilot'])

/**
 * يوازن بين ما أرسله الدكتور وما يقوله السجل.
 * queued/generating فقط هي التي ننتظر لها خبراً — وما عداها قرارٌ سابقٌ لا نمسّه.
 */
export function decideReports({ production = [], state = {} } = {}) {
  const done = state.done || {}
  const reports = []
  for (const item of production) {
    const slug = String(item?.slug || '')
    if (!/^[a-z0-9-]+$/.test(slug)) continue
    if (!['queued', 'generating'].includes(String(item?.status || ''))) continue
    const entry = done[`${slug}:ar`]
    if (!entry) continue                       // لا خبر بعد: لا نلمس الحالة
    reports.push({
      slug,
      status: ACCEPTED.includes(String(entry.status)) ? 'published' : 'needs_review',
      note: ACCEPTED.includes(String(entry.status))
        ? 'وُلِّدت الحلقة واجتازت البوابات ورُفعت — تظهر في صفحة المقال.'
        : `عُزلت الحلقة ولم تُنشر: ${String(entry.reason || entry.status || 'سبب غير مسجَّل').slice(0, 180)}`,
    })
  }
  return reports
}

if (SELF_TEST) {
  const assert = (condition, message) => { if (!condition) throw new Error(`✘ ${message}`) }
  const state = { done: {
    'one:ar': { status: 'accepted_automated' },
    'two:ar': { status: 'quarantined', reason: 'بوابة البشرية أقل من الحد' },
    'four:ar': { status: 'accepted_pilot' },
  } }
  const out = decideReports({ state, production: [
    { slug: 'one', status: 'generating' },
    { slug: 'two', status: 'generating' },
    { slug: 'three', status: 'queued' },      // لا خبر في السجل
    { slug: 'four', status: 'queued' },
    { slug: 'five', status: 'published' },    // قرارٌ سابق لا يُمَسّ
    { slug: 'BAD', status: 'queued' },        // اسمٌ غير آمن
  ] })
  const byId = Object.fromEntries(out.map((item) => [item.slug, item.status]))
  assert(byId.one === 'published', 'المقبول يُبلَّغ منشوراً')
  assert(byId.two === 'needs_review', 'المعزول يُبلَّغ محتاجاً للمراجعة')
  assert(byId.four === 'published', 'المقبول تجريبياً يُبلَّغ منشوراً')
  assert(!('three' in byId), 'ما لا خبر عنه لا تُمَسّ حالته')
  assert(!('five' in byId), 'القرار السابق لا يُنقَض')
  assert(!('BAD' in byId), 'الاسم غير الآمن يُرفض')
  assert(out.find((item) => item.slug === 'two').note.includes('بوابة البشرية'),
    'سبب العزل يصل الدكتور كما هو — لا رسالة عامة')
  console.log('✓ اختبارات مُبلّغ حالة الحوار: 7/7')
  process.exit(0)
}

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.log('ⓘ لا حساب خدمة — لا تحديث لحالة اللوحة.'); process.exit(0) }

const statePath = resolve(ROOT, '.podcast-state.json')
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { done: {} }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

let production = []
try {
  const snapshot = await db.collection('podcast_production').get()
  production = snapshot.docs.map((document) => ({ slug: document.id, ...(document.data() || {}) }))
} catch (error) {
  console.log(`⚠ تعذّرت قراءة حالات الإنتاج (${String(error?.message || error).slice(0, 90)}).`)
  process.exit(0)
}

const reports = decideReports({ production, state })
if (!reports.length) { console.log('ⓘ لا حالة تحتاج تحديثاً.'); process.exit(0) }

for (const report of reports) {
  await db.doc(`podcast_production/${report.slug}`).set({
    status: report.status,
    note: report.note,
    updatedAt: FieldValue.serverTimestamp(),
    lastWorkflowRun: process.env.GITHUB_RUN_ID || '',
  }, { merge: true })
  console.log(`  ${report.status === 'published' ? '✓' : '⚠'} ${report.slug}: ${report.status}`)
}
console.log(`✓ أُبلغت اللوحة عن ${reports.length} حالة.`)
