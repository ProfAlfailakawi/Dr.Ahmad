#!/usr/bin/env node
/**
 * الحلقة المفقودة بين «أرفع الحوار» و«يُنشر مباشرة».
 *
 * الدكتور يكتب الحوار في اللوحة فيُحفظ في Firestore (podcast_dialogues)،
 * ويضغط «أرسله للتوليد» فتصير حالته queued في podcast_production. لكن
 * التشغيلة اليومية لم تكن تستدعي الجالب إطلاقاً — والجالب نفسه يتطلب أن
 * يُسمّى له كل slug صراحةً. فيبقى الحوار في السحابة إلى الأبد ولا يبلغ
 * المحرك، مهما أعاد الدكتور المحاولة.
 *
 * هذا الغلاف يكتشف كل حوارٍ في انتظار التوليد ويسلّمه للجالب المقفول كما هو
 * — بلا مساسٍ بقفل المصدر ولا بتحقق البصمات. وإن لم يكن ثمّة شيء ينتظر،
 * ينتهي بهدوء ولا يُسقط التشغيلة (فغياب حوارٍ جديد ليس عطباً).
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** أسماء المستندات المقبولة: نفس قيد الجالب حرفاً بحرف */
export const isSafeSlug = (value) => /^[a-z0-9-]+$/.test(String(value || ''))

/** حالاتٌ تعني «ينتظر التوليد» — والقائمة هنا كي تُختبر بلا سحابة */
export const QUEUED_STATES = Object.freeze(['queued'])
export const selectQueued = (documents = []) => documents
  .filter((item) => QUEUED_STATES.includes(String(item?.status || '')))
  .map((item) => item.slug)
  .filter(isSafeSlug)

if (SELF_TEST) {
  const assert = (condition, message) => { if (!condition) throw new Error(`✘ ${message}`) }
  assert(isSafeSlug('abc-123'), 'slug سليم يُقبل')
  assert(!isSafeSlug('../etc/passwd'), 'مسارٌ متسلّق يُرفض')
  assert(!isSafeSlug('Abc'), 'حرفٌ كبير يُرفض')
  assert(!isSafeSlug(''), 'فارغ يُرفض')
  const picked = selectQueued([
    { slug: 'one', status: 'queued' },
    { slug: 'two', status: 'generating' },
    { slug: 'three', status: 'queued' },
    { slug: 'BAD', status: 'queued' },
    { slug: 'four', status: 'published' },
  ])
  assert(picked.join(',') === 'one,three', `يختار المنتظر وحده — جاء: ${picked.join(',')}`)
  assert(selectQueued([]).length === 0, 'لا شيء ينتظر → قائمة فارغة')
  console.log('✓ اختبارات جالب الحوارات المنتظرة: 6/6')
  process.exit(0)
}

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) {
  console.log('ⓘ لا حساب خدمة Firebase — لا يمكن اكتشاف الحوارات المنتظرة. لا شيء يُولَّد.')
  process.exit(0)
}

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

let waiting = []
try {
  const snapshot = await db.collection('podcast_production').get()
  waiting = selectQueued(snapshot.docs.map((document) => ({ slug: document.id, ...(document.data() || {}) })))
} catch (error) {
  console.log(`⚠ تعذّرت قراءة قائمة الانتظار (${String(error?.message || error).slice(0, 90)}) — لا شيء يُولَّد.`)
  process.exit(0)
}

if (!waiting.length) {
  console.log('ⓘ لا حوار في انتظار التوليد. (اكتب حواراً من اللوحة ثم أرسله للتوليد.)')
  process.exit(0)
}

console.log(`ⓘ ${waiting.length} حوار في انتظار التوليد: ${waiting.join('، ')}`)

/* حوارٌ متعثّر لا يمنع البقية: نسحب كلاً على حدة ونمضي بما نجح. */
const failed = []
for (const slug of waiting) {
  const result = spawnSync(process.execPath, [resolve(ROOT, 'scripts/fetch-manual-dialogues.mjs'), `--slugs=${slug}`],
    { stdio: 'inherit', env: process.env })
  if (result.status !== 0) failed.push(slug)
}

if (failed.length === waiting.length) {
  console.error(`✘ تعذّر سحب أي حوار (${failed.join('، ')}).`)
  process.exit(1)
}
if (failed.length) console.log(`⚠ تعثّر ${failed.length}: ${failed.join('، ')} — ومضينا بالباقي.`)
console.log(`✓ جاهزٌ للتوليد: ${waiting.length - failed.length} حوار.`)
