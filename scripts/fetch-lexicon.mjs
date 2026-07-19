#!/usr/bin/env node
/**
 * جسر القاموس: ما يُضيفه الدكتور من اللوحة يصل إلى محرك النطق.
 *
 * القاموس الدائم ملفٌّ في المستودع، والدكتور لا يفتح المستودع. فلو تركناه هكذا
 * لظلّ كل تصحيح نطقٍ يمرّ بي — وهذا ما أراد أن يستغني عنه صراحةً.
 *
 * فالقاعدة: اللوحة تكتب في Firestore، وهذا السكربت يسحب ما كتبته قبل كل توليد
 * ويدمجه في الملف. ومدخلُ الدكتور يعلو على مدخلي دائماً — فهو صاحب اللسان
 * وصاحب الاسم، وإن خالف اجتهادي فاجتهادي هو الذي يسقط.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** يقبل مدخلاً واحداً أو يرفضه. لا نُدخل في قاموس النطق ما يفسده. */
export function validate(word, entry) {
  const key = String(word || '').trim()
  if (!key || key.length > 60) return { ok: false, why: 'المفتاح فارغ أو مفرط الطول' }
  const sub = String(entry?.sub || '').trim()
  const diacritics = String(entry?.diacritics || '').trim()
  if (!sub && !diacritics) return { ok: false, why: 'لا بديلَ ولا حركات' }
  if (sub.length > 200 || diacritics.length > 200) return { ok: false, why: 'القيمة مفرطة الطول' }

  /* الحركات يجب أن تكون الكلمةَ نفسها مشكولةً — لا كلمةً أخرى. وإلا انقلب
     «التكنولوجيا» إلى لفظٍ آخر في أذن السامع وهو لا يدري من أين جاء. */
  if (diacritics) {
    const bare = diacritics.replace(/[ً-ْٰ]/g, '')
    const plain = key.replace(/[ً-ْٰ]/g, '')
    if (bare !== plain) return { ok: false, why: `الحركات لكلمةٍ أخرى: «${bare}» ≠ «${plain}»` }
  }
  return { ok: true }
}

/** الدمج: مدخل الدكتور يعلو، والمرفوض يُترك ويُبلَّغ عنه */
export function merge(fileEntries = {}, remoteEntries = {}) {
  const out = { ...fileEntries }
  const applied = []
  const rejected = []
  for (const [word, entry] of Object.entries(remoteEntries)) {
    const verdict = validate(word, entry)
    if (!verdict.ok) { rejected.push({ word, why: verdict.why }); continue }
    out[word] = { ...entry, source: 'اللوحة' }
    applied.push(word)
  }
  return { entries: Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]])), applied, rejected }
}

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  assert(validate('التكنولوجيا', { diacritics: 'التِّكْنُولُوجْيا' }).ok, 'الحركات الصحيحة تُقبل')
  assert(validate('et al.', { sub: 'وآخرون' }).ok, 'البديل يُقبل')
  assert(!validate('', { sub: 'x' }).ok, 'المفتاح الفارغ يُرفض')
  assert(!validate('كلمة', {}).ok, 'بلا بديلٍ ولا حركات يُرفض')

  /* ★ حارس الانقلاب: حركاتٌ لكلمةٍ أخرى تُغيّر المنطوق كلّه */
  const bad = validate('التكنولوجيا', { diacritics: 'الطَّالِب' })
  assert(!bad.ok && bad.why.includes('كلمةٍ أخرى'), '★ حركات كلمةٍ أخرى تُرفض')

  const merged = merge(
    { 'قديم': { type: 'x', sub: 'أ' }, 'التكنولوجيا': { type: 'مني', diacritics: 'التِّكْنُولُوجْيا' } },
    { 'التكنولوجيا': { type: 'من الدكتور', diacritics: 'التِّكنُولُوجيا' }, 'جديد': { sub: 'ب' }, 'فاسد': {} },
  )
  assert(merged.entries['التكنولوجيا'].type === 'من الدكتور', '★ مدخل الدكتور يعلو على مدخلي')
  assert(merged.entries['التكنولوجيا'].source === 'اللوحة', 'ويُوسم بمصدره')
  assert(merged.entries['قديم'], 'ما لم يُمَسّ يبقى')
  assert(merged.applied.includes('جديد') && merged.rejected.some((r) => r.word === 'فاسد'), 'الفاسد يُعزل ويُبلَّغ')
  assert(Object.keys(merged.entries).join() === Object.keys(merged.entries).sort().join(), 'مرتّبٌ أبجدياً')

  console.log('✓ اختبارات جسر القاموس: 10/10')
  process.exit(0)
}

const LEX = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.log('ⓘ لا حساب خدمة — يُستعمل القاموس كما هو.'); process.exit(0) }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

let remote = {}
try {
  const snapshot = await db.collection('pronunciation_lexicon').get()
  for (const document of snapshot.docs) remote[document.data()?.word || document.id] = document.data() || {}
} catch (error) {
  console.log(`⚠ تعذّرت قراءة قاموس اللوحة (${String(error?.message || error).slice(0, 80)}) — نمضي بالملف.`)
  process.exit(0)
}
if (!Object.keys(remote).length) { console.log('ⓘ لا إضافات من اللوحة.'); process.exit(0) }

const file = JSON.parse(readFileSync(LEX, 'utf8'))
const { entries, applied, rejected } = merge(file.entries || {}, remote)
writeFileSync(LEX, JSON.stringify({ ...file, entries }, null, 2) + '\n')

console.log(`✓ دُمج من اللوحة: ${applied.length} مدخلاً · المجموع ${Object.keys(entries).length}`)
for (const item of rejected) console.log(`  ⚠ رُفض «${item.word}»: ${item.why}`)
