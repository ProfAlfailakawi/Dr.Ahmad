#!/usr/bin/env node
/**
 * أداة الاسترجاع — التحقّق والبروفة الآمنة (عقد الحماية ٢٠٢٦-٠٨-١٠)
 *
 * «الاسترجاع أهمّ من النسخ»: نسخةٌ لا تُسترجَع ليست نسخة. هذه الأداة تُثبت أن ملف
 * النسخة سليمٌ وقابلٌ للقراءة والاسترجاع — دون أن تلمس الإنتاج افتراضياً.
 *
 * الأوامر:
 *   verify   <file.json.gz>   تحقّق سلامة: فكّ الضغط، إعادة حساب SHA-256 ومطابقته
 *                             بالـManifest، مطابقة عدد المجموعات/المستندات، فحص
 *                             إصدار المخطط. يكشف الفساد ويخرج برمز ١ عند أي اختلاف.
 *   dry-run  <file.json.gz>   يقرأ النسخة ويطبع ما «سيُسترجَع» (مجموعات، أعداد،
 *                             مجموعات فرعية) — لا يكتب شيئاً. آمنٌ افتراضياً.
 *   restore  <file.json.gz>   استرجاع فعليّ. ممنوعٌ منعاً باتّاً أن يكتب على الإنتاج
 *                             إلا مع علَمين صريحين معاً + هدفٍ معزول:
 *                             --apply  و  --confirm-write-to=<projectId>
 *                             ويُرفض إن كان الهدف مشروع الإنتاج drahmad-8e9e2.
 *   --self-test               اختبار بلا شبكة: يبرهن أن verify يقبل السليم ويرفض التالف.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n, d) => { const h = args.find((a) => a.startsWith(`--${n}=`)); return h ? h.split('=').slice(1).join('=') : d }
const PRODUCTION_PROJECT = 'drahmad-8e9e2'

function countDocs(backup) {
  let n = 0
  for (const docs of Object.values(backup.collections || {})) n += docs.length
  for (const docs of Object.values(backup.subcollections || {})) n += docs.length
  return n
}

function loadManifest(gzPath) {
  const manifestPath = gzPath.replace(/\.json\.gz$/, '.manifest.json')
  try { return { manifest: JSON.parse(readFileSync(manifestPath, 'utf8')), manifestPath } }
  catch { return { manifest: null, manifestPath } }
}

/* يخرج {ok, problems[], stats}. لا يرمي — يجمع كل الأعطاب ليراها المستخدم دفعة. */
function verify(gzPath) {
  const problems = []
  const raw = readFileSync(gzPath)
  const sha = createHash('sha256').update(raw).digest('hex')
  let backup
  try { backup = JSON.parse(gunzipSync(raw).toString('utf8')) }
  catch (e) { return { ok: false, problems: [`فساد: تعذّر فكّ الضغط/التحليل — ${e.message}`], stats: null } }

  const docs = countDocs(backup)
  const cols = Object.keys(backup.collections || {}).length
  const { manifest } = loadManifest(gzPath)

  if (!manifest) problems.push('لا Manifest بجانب الملف — لا يمكن التحقّق من SHA-256/العدّ')
  else {
    if (manifest.sha256 && manifest.sha256 !== sha) problems.push(`فساد: SHA-256 لا يطابق الManifest (ملف=${sha.slice(0, 12)}… ، مانيفست=${manifest.sha256.slice(0, 12)}…)`)
    if (typeof manifest.documentCount === 'number' && manifest.documentCount !== docs) problems.push(`عدد المستندات لا يطابق: الملف ${docs}، المانيفست ${manifest.documentCount}`)
    if (typeof manifest.collectionCount === 'number' && manifest.collectionCount !== cols) problems.push(`عدد المجموعات لا يطابق: الملف ${cols}، المانيفست ${manifest.collectionCount}`)
    if (manifest.schemaVersion && manifest.schemaVersion > 2) problems.push(`إصدار مخطط أحدث (${manifest.schemaVersion}) من قدرة هذه الأداة (٢) — حدّث الأداة قبل الاسترجاع`)
  }
  if (docs === 0) problems.push('النسخة فارغة (٠ مستند) — نسخة بلا قيمة')
  return { ok: problems.length === 0, problems, stats: { sha, docs, cols, subGroups: Object.keys(backup.subcollections || {}).length } }
}

function dryRun(gzPath) {
  const { ok, problems, stats } = verify(gzPath)
  console.log(`— بروفة استرجاع (لا كتابة) —`)
  if (!stats) { console.error('✗ ' + problems.join('\n✗ ')); process.exit(1) }
  const backup = JSON.parse(gunzipSync(readFileSync(gzPath)).toString('utf8'))
  console.log(`المشروع المصدر: ${backup.project || '?'} · التُقطت: ${backup.takenAt || '?'}`)
  console.log(`سيُسترجَع: ${stats.cols} مجموعة عليا · ${stats.docs} مستنداً · ${stats.subGroups} مجموعة فرعية`)
  const sample = Object.entries(backup.collections || {}).slice(0, 5).map(([k, v]) => `${k}(${v.length})`).join('، ')
  console.log(`عيّنة: ${sample}`)
  if (Object.keys(backup.subcollections || {}).length) console.log(`مجموعات فرعية مرصودة: ${Object.keys(backup.subcollections).slice(0, 3).join('، ')}…`)
  console.log(ok ? '✔ الملف سليم وقابل للاسترجاع (لم يُكتب شيء).' : '⚠ الملف قابل للقراءة لكن فيه ملاحظات تحقّق:')
  if (!ok) { for (const p of problems) console.warn('  · ' + p) }
  console.log('\nللاسترجاع الفعلي إلى هدفٍ معزول: node scripts/backup-restore.mjs restore <file> --apply --confirm-write-to=<isolated-project>')
}

function verifyCli(gzPath) {
  const { ok, problems, stats } = verify(gzPath)
  if (stats) console.log(`SHA-256=${stats.sha.slice(0, 16)}… · ${stats.cols} مجموعة · ${stats.docs} مستنداً · ${stats.subGroups} مجموعة فرعية`)
  if (ok) { console.log('✔ تحقّق سليم: الضغط والتحليل وSHA-256 والأعداد كلها متطابقة.'); return }
  console.error('✗ فشل التحقّق:'); for (const p of problems) console.error('  · ' + p); process.exit(1)
}

async function restore(gzPath) {
  const target = opt('confirm-write-to')
  if (!flag('apply') || !target) {
    console.error('✗ الاسترجاع الفعلي يتطلّب: --apply و --confirm-write-to=<projectId>. (بلا ذلك استعمل dry-run.)')
    process.exit(1)
  }
  if (target === PRODUCTION_PROJECT) {
    console.error(`✗ ممنوع الاسترجاع فوق الإنتاج (${PRODUCTION_PROJECT}). استعمل مشروعاً معزولاً. الاسترجاع الكارثي فوق الإنتاج قرارٌ يدويّ بشريّ لا آليّ.`)
    process.exit(1)
  }
  const { ok, problems } = verify(gzPath)
  if (!ok) { console.error('✗ لن أسترجع نسخةً غير سليمة:'); for (const p of problems) console.error('  · ' + p); process.exit(1) }
  console.error('✗ الكتابة الفعلية إلى Firestore غير منفّذة في هذه الأداة عمداً (حاجز أمان). نفّذها بحساب خدمة المشروع المعزول بعد مراجعة بشرية، أو اطلب تفعيل المسار.')
  process.exit(2)
}

/* ═══ اختبار ذاتي بلا شبكة: سليم يمرّ، تالف يُرفض ═══ */
function selfTest() {
  const dir = resolve(ROOT, 'build/_restore_selftest')
  mkdirSync(dir, { recursive: true })
  const backup = { project: 'test', takenAt: new Date().toISOString(), schemaVersion: 2,
    collections: { site_articles: [{ name: 'a', fields: {} }, { name: 'b', fields: {} }] },
    subcollections: { 'site_cv_files/x/chunks': [{ name: 'c', fields: {} }] } }
  const json = JSON.stringify(backup)
  const gz = gzipSync(Buffer.from(json))
  const good = resolve(dir, 'good.json.gz')
  writeFileSync(good, gz)
  writeFileSync(good.replace(/\.json\.gz$/, '.manifest.json'), JSON.stringify({
    schemaVersion: 2, documentCount: 3, collectionCount: 1, sha256: createHash('sha256').update(gz).digest('hex'),
  }))
  const clean = verify(good)
  if (!clean.ok) throw new Error('فشل: النسخة السليمة رُفضت — ' + clean.problems.join('؛'))

  /* فساد ١: بايت مقلوب في الـgzip. */
  const corrupt = Buffer.from(gz); corrupt[corrupt.length - 5] ^= 0xff
  const bad1 = resolve(dir, 'corrupt.json.gz'); writeFileSync(bad1, corrupt)
  writeFileSync(bad1.replace(/\.json\.gz$/, '.manifest.json'), readFileSync(good.replace(/\.json\.gz$/, '.manifest.json')))
  if (verify(bad1).ok) throw new Error('فشل: الملف التالف (gzip مكسور) مرّ كأنه سليم')

  /* فساد ٢: SHA لا يطابق (مانيفست خاطئ). */
  const bad2 = resolve(dir, 'shamix.json.gz'); writeFileSync(bad2, gz)
  writeFileSync(bad2.replace(/\.json\.gz$/, '.manifest.json'), JSON.stringify({ schemaVersion: 2, documentCount: 3, collectionCount: 1, sha256: 'deadbeef'.repeat(8) }))
  const r2 = verify(bad2)
  if (r2.ok || !r2.problems.some((p) => p.includes('SHA-256'))) throw new Error('فشل: عدم تطابق SHA-256 لم يُكتشف')

  /* فساد ٣: عدد مستندات خاطئ. */
  const bad3 = resolve(dir, 'count.json.gz'); writeFileSync(bad3, gz)
  writeFileSync(bad3.replace(/\.json\.gz$/, '.manifest.json'), JSON.stringify({ schemaVersion: 2, documentCount: 999, collectionCount: 1, sha256: createHash('sha256').update(gz).digest('hex') }))
  if (verify(bad3).ok) throw new Error('فشل: عدد مستندات خاطئ لم يُكتشف')

  console.log('✔ الاختبار الذاتي: السليم يمرّ؛ والفساد الثلاثة (gzip مكسور، SHA غير مطابق، عدد خاطئ) كلها مُكتشَفة ومرفوضة. (بلا شبكة)')
}

const [cmd, file] = args.filter((a) => !a.startsWith('--'))
if (flag('self-test')) selfTest()
else if (cmd === 'verify' && file) verifyCli(resolve(ROOT, file))
else if (cmd === 'dry-run' && file) dryRun(resolve(ROOT, file))
else if (cmd === 'restore' && file) await restore(resolve(ROOT, file))
else { console.error('الاستعمال: backup-restore.mjs <verify|dry-run|restore> <file.json.gz> [أعلام] | --self-test'); process.exit(1) }
