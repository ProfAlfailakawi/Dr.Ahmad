#!/usr/bin/env node
/**
 * سقّافة الملفات — لا يزول عضوٌ من أعضاء الخطّ صامتاً.
 *
 * العلّة (٢٩ أغسطس ٢٠٢٦، رآها الدكتور بعينه): عرضت AI Studio ملفَّين
 * على أنهما «Deleted» — أحدهما scripts/guard-ear-rulings-ratchet.mjs،
 * أي السقّافة نفسها التي بنيناها قبل ساعتين لتمنع ضياع أحكام الأذن.
 * والسبب أن نسخة AI Studio أقدم من GitHub، فما ليس عندها تعرضه محذوفاً؛
 * ولو رُفعت كما هي لحُذف فعلاً. هذي آلية a805db6 نفسها التي أضاعت يوم
 * أحكامٍ كامل قبل يومين.
 *
 * والسقّافة السابقة تحرس ما **في** المعجم، ولا تحرس وجود نفسها. فما كان
 * يقف بين المستودع وبين الحذف إلا عين الدكتور — وهذا ليس نظاماً.
 *
 * القاعدة: كل ملفٍ من أعضاء الخطّ مسجَّلٌ في خط الأساس، ومن غاب وقف
 * النشر. والحذف المقصود حكمٌ أيضاً: يُعتمد بـ--write-baseline، والصمت
 * وحده هو الممنوع.
 *
 * النطاق مقصود: أعضاء الخطّ لا المستودع كلّه، كي لا يوقف تنظيفٌ عابر
 * توليدَ حلقة.
 *
 *   node scripts/guard-file-ratchet.mjs
 *   node scripts/guard-file-ratchet.mjs --write-baseline   # بعد حذفٍ مقصود
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WRITE = process.argv.includes('--write-baseline')
const BASE = resolve(ROOT, 'podcast-audits/file-ratchet.json')

/* أعضاء الخطّ: الفواحص والمكتبات · متون الكويتية ومعجمها · مسارات
   التوليد · تدقيقات الصوت وخطوط الأساس. */
export const GUARDED = ['scripts', 'src/data/kuwaiti-*', '.github/workflows/podcast-kuwaiti-*',
  '.github/workflows/kuwaiti-*', 'podcast-audits/*.json']

const tracked = () => execFileSync('git', ['ls-files', '--', ...GUARDED], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').map((line) => line.trim()).filter(Boolean).sort()

const files = tracked()

if (WRITE) {
  writeFileSync(BASE, JSON.stringify({
    note: 'خط أساس أعضاء الخطّ. النقصان فيه يعني أن ملفاً زال — والحذف المقصود '
      + 'يُعتمد هنا صراحةً، فلا يمرّ حذفٌ لم يره أحد.',
    updated: new Date().toISOString().slice(0, 10),
    guarded: GUARDED,
    files,
  }, null, 1) + '\n')
  console.log(`✓ خط أساس الملفات: ${files.length} ملفاً`)
  process.exit(0)
}

if (!existsSync(BASE)) {
  console.log('ℹ لا خط أساس بعد — أنشئه بـ--write-baseline')
  process.exit(0)
}

const base = JSON.parse(readFileSync(BASE, 'utf8'))
const present = new Set(files)
const missing = (base.files || []).filter((path) => !present.has(path))

if (missing.length) {
  console.error(`⛔ ${missing.length} ملفاً من أعضاء الخطّ اختفى بلا اعتماد:\n`)
  for (const path of missing.slice(0, 30)) console.error(`     · ${path}`)
  if (missing.length > 30) console.error(`     … و${missing.length - 30} غيره`)
  console.error('\n  السبب الأرجح: نسخةٌ أقدم كُتبت فوق الأحدث — AI Studio تعرض ما ليس عندها')
  console.error('  «Deleted»، فيُحذف عند الرفع. اسحب من GitHub أولاً (AI-STUDIO-SYNC.md).')
  console.error('  العلاج: استرجع الملفات، لا تحدّث خط الأساس. وإن كان الحذف مقصوداً،')
  console.error('  فاعتمده بـ--write-baseline كي يبقى مرئياً في التاريخ.')
  process.exit(1)
}

const gained = files.length - (base.files || []).length
console.log(`✅ سقّافة الملفات: ${files.length} عضواً محفوظاً`
  + (gained > 0 ? ` (+${gained} جديد — حدّث خط الأساس)` : ''))
