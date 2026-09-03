#!/usr/bin/env node
/**
 * حارس تغطية النسخ الاحتياطي (البند ١٢ من عقد الحماية)
 *
 * يمنع تسلّل مصدر بيانات Firestore دائم جديد إلى المشروع دون إدراجه في
 * backup-inventory.json. المنطق: كل اسم مجموعة يظهر في firestore.rules أو في
 * الشيفرة (collection('x') / .collection('x') / doc(db,'x',…)) يجب أن يكون
 * مُعلناً في الجرد. الجديد غير المُعلن = فشل صريح (رمز ١) فلا يمرّ نشرٌ يُهمل نسخه.
 *
 * مجاني وبلا شبكة: تحليل ثابت للملفات فقط.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')
const flag = (name) => process.argv.slice(2).includes(`--${name}`)

const inventory = JSON.parse(read('backup-inventory.json'))
const declared = new Set(inventory.firestore.topLevelCollections)

/* أسماء داخلية للأدوات لا تُعدّ بيانات إنتاج (مجموعة البروفة، الطوابير المؤقتة). */
/* databases/documents: غلاف القواعد القياسي (match /databases/{database}/documents). */
const IGNORED = new Set(['_restore_drill', 'databases', 'documents'])

/* ═══ ١) من firestore.rules: كل match /collection/{id} في المستوى الأعلى ═══ */
function collectionsFromRules() {
  const rules = read('firestore.rules')
  const found = new Set()
  /* match /name/{var} — نلتقط الأسماء الحرفية فقط (لا المتغيرات ولا {document=**}) */
  const re = /match\s+\/([a-zA-Z][a-zA-Z0-9_]*)\/\{/g
  let m
  while ((m = re.exec(rules))) found.add(m[1])
  return found
}

/* ═══ ٢) من الشيفرة: أنماط استدعاء Firestore الشائعة ═══ */
const CODE_DIRS = ['src', 'scripts', 'whatsapp-agent']
const CODE_FILES_ROOT = ['server.mjs', 'index.mjs', 'bot-messages.mjs', 'bot-rules.mjs']
const EXT = /\.(mjs|js|ts|tsx)$/
/* ملفات أدوات النسخ نفسها تحوي نصوص أمثلة ومسارات REST — ليست مصادر بيانات. */
const SKIP_FILES = new Set(['guard-backup-inventory.mjs', 'backup-firestore.mjs', 'backup-restore.mjs', 'backup-storage.mjs', 'backup-r2.mjs'])

function walk(dir, acc) {
  let entries
  try { entries = readdirSync(resolve(ROOT, dir)) } catch { return acc }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const rel = join(dir, name)
    const st = statSync(resolve(ROOT, rel))
    if (st.isDirectory()) walk(rel, acc)
    else if (EXT.test(name) && !SKIP_FILES.has(name)) acc.push(rel)
  }
  return acc
}

function collectionsFromCode() {
  const files = [...CODE_FILES_ROOT.filter((f) => { try { statSync(resolve(ROOT, f)); return true } catch { return false } })]
  for (const d of CODE_DIRS) walk(d, files)
  const found = new Set()
  const patterns = [
    /\bcollection\(\s*(?:db|firestore|adminDb|store)?\s*,?\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g,
    /\.collection\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g,
    /\bdoc\(\s*(?:db|firestore|adminDb|store)\s*,\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g,
    /\bcollectionGroup\(\s*(?:db|firestore)?\s*,?\s*['"`]([a-zA-Z][a-zA-Z0-9_]*)['"`]/g,
  ]
  for (const f of files) {
    let text
    try { text = read(f) } catch { continue }
    for (const re of patterns) {
      let m
      while ((m = re.exec(text))) found.add(m[1])
    }
  }
  return found
}

/* ═══ ٣) مصالحة حيّة اختيارية: القائمة الفعلية من Firestore (--live) ═══
 * ضرورية لأن أسماء مجموعات مثل whatsapp_* تُبنى ديناميكياً فتفوت التحليل الثابت.
 * تحتاج GOOGLE_ACCESS_TOKEN (من: gcloud auth print-access-token) + FIREBASE_PROJECT_ID. */
async function collectionsFromLive() {
  const token = process.env.GOOGLE_ACCESS_TOKEN
  const project = process.env.FIREBASE_PROJECT_ID
  if (!token || !project) {
    console.warn('⚠ --live بلا GOOGLE_ACCESS_TOKEN/FIREBASE_PROJECT_ID — تُخطّى المصالحة الحيّة (تحقّق ثابت فقط).')
    return null
  }
  const found = new Set()
  let pageToken = ''
  do {
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:listCollectionIds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(pageToken ? { pageToken } : {}),
    })
    if (!res.ok) throw new Error(`listCollectionIds → ${res.status}`)
    const data = await res.json()
    for (const id of (data.collectionIds || [])) found.add(id)
    pageToken = data.nextPageToken || ''
  } while (pageToken)
  return found
}

const fromRules = collectionsFromRules()
const fromCode = collectionsFromCode()
const fromLive = flag('live') ? await collectionsFromLive() : null
const seen = new Set([...fromRules, ...fromCode, ...(fromLive || [])])

/* المجموعات الفرعية معروفة (chunks/readers) — نستثنيها من فحص العليا. */
const subLeaves = new Set(inventory.firestore.subcollections.map((s) => s.path.split('/').pop()))

const undeclared = [...seen].filter(
  (c) => !declared.has(c) && !IGNORED.has(c) && !subLeaves.has(c),
).sort()

/* تحذير (لا فشل): مُعلن في الجرد لكن لم يعد له أثر — قد يكون حُذف. */
const orphan = [...declared].filter((c) => !seen.has(c)).sort()

for (const c of orphan) console.warn(`⚠ في الجرد بلا أثر في القواعد/الشيفرة (تحقّق أنه لم يُحذف فعلاً): ${c}`)

if (undeclared.length) {
  console.error('\n✗ مصادر Firestore جديدة غير مُدرجة في backup-inventory.json:')
  for (const c of undeclared) console.error(`   • ${c}`)
  console.error('\nالعلاج: أضف كل اسم إلى firestore.topLevelCollections في backup-inventory.json')
  console.error('حتى يدخل سياسة النسخ الاحتياطي. لا نشر بمصدر بيانات بلا نسخ.')
  process.exit(1)
}

console.log(`✔ تغطية النسخ: ${seen.size} مجموعة مرصودة، كلها مُدرجة (${declared.size} مُعلنة، ${orphan.length} بلا أثر).`)
