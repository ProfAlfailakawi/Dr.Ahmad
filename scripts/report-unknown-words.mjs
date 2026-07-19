#!/usr/bin/env node
/**
 * «قل لي ما لم تفهمه» — فكرة الدكتور، وهي أدقّ من الحارس الذي بنيتُه قبلها.
 *
 * الحارس يفحص المكتبة كلها فيُنبّه على ما قد يُنطق يوماً. وهذا يفحص **الحلقة
 * التي وُلِّدت للتوّ**: أيّ لفظٍ نطقه المحرك باجتهاده لأنه ليس في القاموس. فيصل
 * الدكتور تنبيهٌ محدّد — «في حلقتك هذه ثلاثة ألفاظ نطقتُها تخميناً» — بدل أن
 * يكتشفها بأذنه بعد النشر، أو لا يكتشفها أصلاً.
 *
 * ولا يخمّن نطقاً: يُبلّغ فقط. والحكم للدكتور من اللوحة، ثم يسحبه جسر القاموس
 * قبل التوليد التالي. فتُغلق الدائرة: توليد ← تنبيه ← ضبط ← توليدٌ أصحّ.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/* الكشّافات — مرآةٌ لما في audit-pronunciation.mjs واللوحة، والثلاثة متطابقة
   عمداً: لو اختلفت لأبلغ أحدها عن لفظٍ يسكت عنه الآخر، فيحتار الدكتور. */
const FOREIGN = /(?:ستات|يشن|تشن|كشن|نستا|غرام|سوشي|سوشا|ميدي|فاشن|فاشي|بلوك|لايك|فولو|هاشت|ترند|كوتش|ديجيت|تكنولوج|استراتيج|بروتوكول|سيناريو|ديموقراط|ايديولوج|انستغ|انستق|سناب|يوتيوب|واتس|تويت|فيسبوك|بودكاست|اونلاين|اوفلاين)/
const FORM_X = /^(?:[يتنأا]ست|وليست|ليست|لست)/
const strip = (value) => String(value || '').replace(/[ً-ْٰ]/g, '')
const bare = (word) => strip(word).replace(/^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/, '')

/**
 * ما نطقه المحرك تخميناً في نصٍّ بعينه.
 * نُبلّغ عن اللاتيني ولو ورد مرّةً — فاسمُ باحثٍ يُقرأ حرفاً حرفاً فضيحةٌ مسموعة.
 * والدخيل العربي كذلك: ورودُه مرّةً في حلقةٍ يعني أنه سيُسمع مرّة.
 */
export function unknownIn(text, known = new Set()) {
  const counts = new Map()
  for (const raw of String(text || '').split(/[\s.,،؛:!؟()«»"'\[\]{}…]+/)) {
    const word = strip(String(raw).trim())
    if (!word) continue
    if (known.has(word) || known.has(bare(word))) continue

    /* السنة تلتصق بها واو العطف كثيراً («…٢٠٢١ و٢٠٢٢»)، فنفحص المجرّدة كذلك
       وإلا مرّت نصف السنوات بلا تنبيه وهي أكثر ما يُخطئ فيه محرك النطق. */
    const naked = bare(word)
    let kind = null
    if (/^[A-Za-z][A-Za-z.&-]{1,}$/.test(word)) kind = 'لفظ لاتيني'
    else if (/^\d{4}$/.test(word) || /^\d{4}$/.test(naked)) kind = 'سنة'
    else if (word.length >= 4 && !FORM_X.test(word) && !FORM_X.test(bare(word)) && FOREIGN.test(bare(word))) kind = 'دخيل معرَّب'
    if (!kind) continue

    /* السنة تُسجَّل مجرّدةً من واو العطف، فلا يظهر «٢٠٢٢» و«و٢٠٢٢» سطرين */
    const key = kind === 'سنة' && /^\d{4}$/.test(naked) ? naked : word
    const entry = counts.get(key) || { word: key, kind, count: 0 }
    entry.count += 1
    counts.set(key, entry)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

/** الرسالة التي يقرؤها الدكتور — صريحةٌ بأن المحرك خمّن، لا أنه أخطأ حتماً */
export function describe(rows = []) {
  if (!rows.length) return ''
  const words = rows.map((row) => `«${row.word}»`).join('، ')
  return rows.length === 1
    ? `لفظٌ واحد نطقتُه باجتهادي لأنه ليس في القاموس: ${words}. اسمعه، فإن أخطأتُ فاضبطه.`
    : `${rows.length} ألفاظٍ نطقتُها باجتهادي لأنها ليست في القاموس: ${words}. اسمعها، فما أخطأتُ فيه اضبطه.`
}

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  const known = new Set(['التكنولوجيا', 'تكنولوجيا', '2023'])

  const rows = unknownIn('حديث الفاشينستات عن التكنولوجيا في Frontiers سنة 2023 و2019.', known)
  const words = rows.map((r) => r.word)
  assert(words.includes('الفاشينستات'), 'الدخيل غير المعروف يُبلَّغ عنه')
  assert(words.includes('Frontiers'), 'اللاتيني يُبلَّغ عنه ولو مرّةً واحدة')
  assert(words.includes('2019'), 'السنة غير المعروفة تُبلَّغ')
  assert(!words.includes('التكنولوجيا'), '★ ما في القاموس لا يُزعج به الدكتور')
  assert(!words.includes('2023'), '★ السنة المعروفة لا تُبلَّغ')

  /* ★ لا ضجيج: العربي الأصيل لا يُبلَّغ عنه أبداً */
  const clean = unknownIn('التعليم يستطيع أن يشير إلى وعي الطالب وليست المدرسة وحدها.', new Set())
  assert(clean.length === 0, '★ نصٌّ عربيٌّ خالص ← لا تنبيه')

  assert(describe([]) === '', 'بلا مجهولٍ ← بلا رسالة')
  assert(describe([{ word: 'س', kind: 'x', count: 1 }]).includes('لفظٌ واحد'), 'المفرد بصيغته')
  assert(describe([{ word: 'س' }, { word: 'ص' }]).includes('2 ألفاظ'), 'الجمع بعدده')
  assert(describe([{ word: 'س' }]).includes('باجتهادي'), 'يُصرّح بأنه اجتهاد لا يقين')

  console.log('✓ اختبارات مُبلّغ الألفاظ المجهولة: 10/10')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const slugs = (process.argv.find((a) => a.startsWith('--slugs='))?.slice(8) || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
if (!slugs.length) { console.log('ⓘ لا حلقات مطلوبة.'); process.exit(0) }

const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const lexPath = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const lexicon = existsSync(lexPath) ? JSON.parse(readFileSync(lexPath, 'utf8')) : { entries: {} }
const known = new Set(Object.keys(lexicon.entries || {}).flatMap((key) => [strip(key), bare(key)]))

const findings = []
for (const slug of slugs) {
  const rows = unknownIn(bodies[slug] || '', known)
  if (rows.length) findings.push({ slug, rows })
  console.log(rows.length ? `⚠ ${slug}: ${describe(rows)}` : `✓ ${slug}: كل ألفاظه في القاموس.`)
}
if (!findings.length) process.exit(0)

const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (!existsSync(saPath)) { console.log('ⓘ لا حساب خدمة — التنبيه في السجل فقط.'); process.exit(0) }

const { initializeApp, cert, getApps } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
const db = getFirestore(app)

for (const finding of findings) {
  await db.collection('pronunciation_pending').doc(finding.slug).set({
    slug: finding.slug,
    words: finding.rows.map((row) => ({ word: row.word, kind: row.kind, count: row.count })),
    message: describe(finding.rows),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
}
console.log(`✓ أُبلغت اللوحة عن ${findings.length} حلقة.`)
