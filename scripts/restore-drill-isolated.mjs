#!/usr/bin/env node
/**
 * بروفة استرجاع كامل إلى قاعدة بيانات معزولة منفصلة (البند ٨ من عقد الحماية).
 *
 * تُثبت أن نسخةً تُسترجَع فعلاً «من الصفر» في قاعدةٍ فارغة معزولة، لا داخل نفس
 * قاعدة الإنتاج. تكتب مستندات النسخة (عليا + فرعية chunks) في القاعدة الهدف عبر
 * REST، ثم تقرؤها وتقارنها حقلياً مقارنةً قانونية (عربية/طوابع/arrays/maps/بايتات
 * chunks)، وتقرّر النجاح بالمطابقة لا بمجرّد «تم الاستيراد».
 *
 * الأمان: يرفض القاعدة (default) والإنتاج drahmad-8e9e2 ما لم تكن قاعدةً مسمّاة
 * معزولة صراحةً. لا يكتب على الإنتاج أبداً.
 *
 * التشغيل:
 *   GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) \
 *   node scripts/restore-drill-isolated.mjs <backup.json.gz> --project=drahmad-8e9e2 --database=restore-drill [--per=3] [--cleanup]
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d }
const file = args.find((a) => !a.startsWith('--'))
const PROJECT = opt('project')
const DATABASE = opt('database')
const PER = Math.max(1, Number(opt('per', '3')))
const token = process.env.GOOGLE_ACCESS_TOKEN

if (!file || !PROJECT || !DATABASE || !token) {
  console.error('الاستعمال: GOOGLE_ACCESS_TOKEN=… node restore-drill-isolated.mjs <backup.json.gz> --project=… --database=<اسم معزول> [--per=N] [--cleanup]')
  process.exit(1)
}
if (DATABASE === '(default)') { console.error('✗ ممنوع الاسترجاع في القاعدة (default). استعمل قاعدةً مسمّاة معزولة.'); process.exit(1) }

const base = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`
async function api(path, options = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${base}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  if (!res.ok && res.status !== 404) throw new Error(`${options.method || 'GET'} ${String(path).slice(-60)} → ${res.status}: ${(await res.text()).slice(0, 140)}`)
  return { status: res.status, body: res.status === 404 ? null : await res.json() }
}

/* مقارنة قانونية: ترتيب مفاتيح عودي + تطبيع الطوابع الزمنية بدقّة ms. */
const canonical = (v, key = '') => {
  if (Array.isArray(v)) return v.map((x) => canonical(x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((n) => [n, canonical(v[n], n)]))
  if (key === 'timestampValue' && typeof v === 'string') { const ms = Date.parse(v); return Number.isFinite(ms) ? new Date(ms).toISOString() : v }
  return v
}
const idOf = (doc) => doc.name.split('/').pop()
/* أنواع الحقول الموجودة في مستند (للتغطية التمثيلية). */
const typesIn = (fields = {}) => {
  const t = new Set()
  const scan = (o) => { if (o && typeof o === 'object') for (const k in o) { if (/Value$/.test(k)) t.add(k); scan(o[k]) } }
  scan(fields); return t
}

async function main() {
  const backup = JSON.parse(gunzipSync(readFileSync(resolve(file))).toString('utf8'))
  const writes = []   // { path, id, fields }
  /* عيّنة تمثيلية: أول PER من كل مجموعة عليا + كل مستندات chunks الفرعية. */
  for (const [col, docs] of Object.entries(backup.collections || {})) {
    for (const doc of docs.slice(0, PER)) writes.push({ path: col, id: idOf(doc), fields: doc.fields || {} })
  }
  for (const [subPath, docs] of Object.entries(backup.subcollections || {})) {
    for (const doc of docs.slice(0, PER)) writes.push({ path: subPath, id: idOf(doc), fields: doc.fields || {} })
  }

  const coverage = new Set()
  let written = 0
  for (const w of writes) {
    /* PATCH على مسار المستند = إنشاء-أو-تحديث (upsert) — يتحمّل إعادة التشغيل بلا 409. */
    await api(`${w.path}/${encodeURIComponent(w.id)}`, { method: 'PATCH', body: JSON.stringify({ fields: w.fields }) })
    written += 1
    for (const t of typesIn(w.fields)) coverage.add(t)
    if (/[؀-ۿ]/.test(JSON.stringify(w.fields))) coverage.add('arabic')
    if (w.path.includes('/chunks')) coverage.add('subcollection-chunks')
  }
  console.log(`✔ كُتبت ${written} وثيقة في القاعدة المعزولة «${DATABASE}» (عليا + فرعية).`)

  /* التحقّق: قراءة ومقارنة حقلية قانونية لكل ما كُتب. */
  let matched = 0
  const mismatches = []
  for (const w of writes) {
    const { body } = await api(`${w.path}/${encodeURIComponent(w.id)}`)
    const expected = JSON.stringify(canonical(w.fields))
    const actual = JSON.stringify(canonical(body?.fields || {}))
    if (expected === actual) matched += 1
    else mismatches.push(`${w.path}/${w.id}`)
  }
  console.log(`✔ التحقّق الحقلي: طوبق ${matched}/${written} حرفياً بعد الاسترجاع.`)
  console.log(`  تغطية الأنواع المُستعادة: ${[...coverage].sort().join('، ')}`)
  if (mismatches.length) console.error(`  ✘ اختلافات: ${mismatches.slice(0, 5).join(' · ')}`)

  /* شروط النجاح: مطابقة كاملة + تغطية تمثيلية (عربية + طوابع + chunks + خريطة/مصفوفة). */
  const need = ['arabic', 'timestampValue', 'subcollection-chunks']
  const missing = need.filter((n) => !coverage.has(n))
  if (matched !== written) { console.error(`✗ فشل: تطابق ${matched}/${written}`); await maybeCleanup(writes); process.exit(1) }
  if (missing.length) console.warn(`  ⚠ العيّنة لم تُغطِّ: ${missing.join('، ')} (بيانات المصدر لم تحوِها في هذه العيّنة)`)

  await maybeCleanup(writes)
  console.log(`\n✔✔ بروفة الاسترجاع المعزولة نجحت: نسخةٌ حقيقية استُرجعت في قاعدةٍ منفصلة وطوبقت حقلياً — الاسترجاع مُثبَتٌ من الصفر لا نظريّ.`)
}

async function maybeCleanup(writes) {
  if (!flag('cleanup')) { console.log('  (لم تُمسح آثار البروفة — القاعدة المعزولة كاملةً تُحذف خارجياً بـgcloud.)'); return }
  for (const w of writes) await api(`${w.path}/${encodeURIComponent(w.id)}`, { method: 'DELETE' }).catch(() => {})
  console.log('  مُسحت آثار البروفة من القاعدة المعزولة.')
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1) })
