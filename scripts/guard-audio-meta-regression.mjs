#!/usr/bin/env node
/**
 * حارسُ سجلّ الصوت من الارتداد — يمنع أن تُخفي دفعةٌ قديمةٌ صوتاً موجوداً.
 *
 * الحال قبله (وقع مرّتين، وضيّع في الثانية أوّل حلقةٍ حوارية): البوت يولّد
 * الصوت ويرفعه إلى R2 ويُثبّت السجلّ. ثم يدفع إنسانٌ من نسخةٍ محليةٍ قديمة،
 * فيدهس `audio-meta.json` بحالته السابقة. الملفُّ باقٍ على R2 سليماً، لكن
 * السجلَّ نسيه ⇐ اختفى من الموقع، ولا أحد يشعر: لا خطأ، ولا تشغيلةٌ فاشلة،
 * فقط حلقةٌ مدفوعُ ثمنُها ولا تُسمَع.
 *
 * والمُصالِح (`reconcile-audio-meta.mjs`) لا يُنقذ هنا لأنه لا يضيف مدخلاً
 * قطّ — يمرّ على ما في السجلّ فقط، ومَن حُذف من السجلّ لا يراه أصلاً.
 *
 * فهذا يسأل التاريخَ لا الحاضر: أيُّ مدخلٍ سبق أن سُجِّل ثم اختفى من السجلّ
 * **وملفُّه ما زال على R2**؟ ذاك ارتدادٌ لا حذفٌ مقصود — لأن التصفير الحقيقي
 * يحذف من R2 كما يحذف من السجلّ. فيُعاد المدخل بحجم R2 الحقيقي.
 *
 * وما اختفى وملفُّه ٤٠٤ فقد حُذف عن قصد ⇐ يُترك. ولا يحكم على حالةٍ عابرة.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const META = resolve(ROOT, 'src/data/audio-meta.json')
const SELF_TEST = process.argv.includes('--self-test')
const APPLY = process.argv.includes('--apply')
/* نحتاج تاريخاً يغطي دورة الإنتاج كاملة، لا آخر بضعة أيام فقط. في أغسطس
 * وحده تجاوزت دفعات الصوت الأربعين؛ نافذة 40 أخفت أقدم الحلقات عند رفع
 * نسخة Google Studio قديمة. 240 تبقى صغيرة على Git، لكنها تغطي كل دفعات
 * الصوت الحالية بهامش آمن. ولا يبعث الحارس شيئاً من التاريخ لمجرد وجوده:
 * لا يقبل إلا شهادة بوت موثوقة، ثم يثبت أن الملف ما زال حياً على R2. */
const LOOKBACK = Number(process.env.AUDIO_META_LOOKBACK || 240)

const TRUSTED_LEDGER_SUBJECTS = new Set([
  'chore: auto-publish verified audio ledger',
  'chore: publish five owner-approved Kuwaiti dialogues',
  'chore: publish locked manual podcast dialogue',
  'chore: publish verified Kuwaiti dialogue',
  'chore: نشر سجلّ حلقات مصنع الروح',
])

export function isTrustedLedgerCommit({ email = '', subject = '' } = {}) {
  return /github-actions\[bot\]@users\.noreply\.github\.com$/u.test(String(email))
    && TRUSTED_LEDGER_SUBJECTS.has(String(subject))
}

/** قرارُ مدخلٍ غاب عن السجلّ الحاليّ، بعد سؤال R2 عنه */
export function decideMissing({ status, remoteBytes }) {
  if (status === 404) return { action: 'ignore', why: 'حُذف من R2 أيضاً — حذفٌ مقصود' }
  if (status !== 200 && status !== 206) return { action: 'ignore', why: `حالة عابرة ${status} — لا نحكم` }
  if (!remoteBytes) return { action: 'ignore', why: 'بلا حجم — لا نحكم' }
  return { action: 'restore', why: `ما زال على R2 بـ${remoteBytes} بايت`, bytes: remoteBytes }
}

/** يبني المدخل المُعاد: حجمُ R2 هو الحقيقة، وبقيّةُ الوصف من آخر تسجيلٍ له */
export function rebuildEntry(historical, bytes) {
  const { bytes: _old, ...rest } = historical || {}
  return { ...rest, bytes }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  let pass = 0
  const t = (m, c) => { assert(c, m); pass++ }

  /* ★ جوهر الحارس: باقٍ على R2 وغائبٌ عن السجلّ ⇐ ارتدادٌ يُصلَح */
  const r = decideMissing({ status: 200, remoteBytes: 3324909 })
  t('★ الموجود على R2 والغائب عن السجلّ يُعاد', r.action === 'restore' && r.bytes === 3324909)
  t('★ المحذوف من R2 لا يُبعث — التصفير المقصود يُحترم', decideMissing({ status: 404 }).action === 'ignore')
  t('الحدّ العابر لا يُغري الحارس', decideMissing({ status: 429 }).action === 'ignore')
  t('ولا عطل الخادم', decideMissing({ status: 503 }).action === 'ignore')
  t('وبلا حجمٍ لا حكم', decideMissing({ status: 200, remoteBytes: 0 }).action === 'ignore')

  /* المدخل المُعاد يأخذ حجم R2 ويحتفظ بالمدّة والبصمة من التاريخ */
  const built = rebuildEntry(
    { bytes: 111, durationSeconds: 208, sha256: 'abc', contentType: 'audio/mpeg' },
    3324909,
  )
  t('★ حجم R2 يغلب المسجَّل', built.bytes === 3324909)
  t('والمدّة تُحفظ من التاريخ', built.durationSeconds === 208)
  t('والبصمة كذلك', built.sha256 === 'abc' && built.contentType === 'audio/mpeg')
  t('ولا يخترع حقولاً', Object.keys(rebuildEntry({ bytes: 1 }, 9)).join() === 'bytes')
  t('ويحتمل تاريخاً فارغاً', rebuildEntry(null, 9).bytes === 9)
  t('★ دفعة النشر الكويتية الموثقة تدخل التاريخ', isTrustedLedgerCommit({
    email: '41898282+github-actions[bot]@users.noreply.github.com',
    subject: 'chore: publish verified Kuwaiti dialogue',
  }))
  t('★ رفع الإنسان لا يصير شهادة جودة ولو حمل نفس الملف', !isTrustedLedgerCommit({
    email: 'owner@example.com',
    subject: 'chore: publish verified Kuwaiti dialogue',
  }))
  t('★ دفعة بشرية عامة لا تُبعث منها أصوات محذوفة', !isTrustedLedgerCommit({
    email: '41898282+github-actions[bot]@users.noreply.github.com',
    subject: 'feat: add StoryboardAtlas to admin panel',
  }))

  console.log(`✓ اختبارات حارس ارتداد سجلّ الصوت: ${pass}/${pass}`)
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const BASE = (process.env.AUDIO_PUBLIC_BASE_URL || '').replace(/\/+$/, '')
if (!BASE) {
  console.log('⚠ AUDIO_PUBLIC_BASE_URL غير مضبوط — تخطّي حارس الارتداد.')
  process.exit(0)
}
if (!existsSync(META)) {
  console.log('⚠ لا سجلَّ صوتٍ بعد — لا شيء يُحرَس.')
  process.exit(0)
}

const meta = JSON.parse(readFileSync(META, 'utf8'))

/**
 * كلُّ مدخلٍ **شهد له البوت** في آخر LOOKBACK دفعةٍ من دفعاته، وأحدثُ وصفٍ له.
 *
 * لماذا دفعات البوت وحدها: لأن وجود ملفٍ على R2 ليس شهادةَ جودة. التشغيلة قد
 * ترفع ثم تتعثّر بعد الرفع، فيبقى ملفٌ لم يُجَز قطّ. والبوت لا يُثبّت السجلّ
 * إلا بعد أن تجتاز كلُّ البوابات — فدفعتُه هي الشهادة الوحيدة المعتبَرة.
 * أما دفعةٌ بشريّة تُسقط ما شهد له البوت، فتلك هي عين الارتداد الذي نحرسه.
 */
function historicalEntries() {
  const log = spawnSync('git', [
    'log', `-n${LOOKBACK}`, '--format=%H%x09%ae%x09%s',
    '--', 'src/data/audio-meta.json',
  ], { cwd: ROOT, encoding: 'utf8' })
  const shas = (log.stdout || '').split('\n').filter(Boolean).map((line) => {
    const [sha, email, ...subjectParts] = line.split('\t')
    return { sha, email, subject: subjectParts.join('\t') }
  }).filter(isTrustedLedgerCommit).map((row) => row.sha)
  const seen = new Map()
  for (const sha of shas) {
    // الأحدث أولاً، فأوّل وصفٍ نصادفه لاسمٍ هو آخر ما سُجِّل عنه.
    const show = spawnSync('git', ['show', `${sha}:src/data/audio-meta.json`], { cwd: ROOT, encoding: 'utf8' })
    if (show.status !== 0) continue
    let parsed
    try { parsed = JSON.parse(show.stdout) } catch { continue }
    for (const [name, entry] of Object.entries(parsed)) if (!seen.has(name)) seen.set(name, entry)
  }
  return seen
}

const history = historicalEntries()
const vanished = [...history.keys()].filter((name) => !(name in meta))

if (!vanished.length) {
  console.log(`✓ حارس الارتداد: لا مدخلَ اختفى من السجلّ (${history.size} مدخلاً في آخر ${LOOKBACK} دفعة).`)
  process.exit(0)
}

console.log(`═══ حارس الارتداد: ${vanished.length} مدخلاً اختفى من السجلّ — نسأل R2 عنه ═══\n`)

/* التصفير الشامل ترك مئاتِ المدخلات الميتة في التاريخ، فكلُّ تشغيلةٍ تسأل R2
 * عنها جميعاً. ثمانيةٌ متوازية تُبقي الحارس ثوانيَ لا دقائق، وهي دون حدّ R2. */
async function ask(name) {
  try {
    const res = await fetch(`${BASE}/${encodeURI(name)}`, { method: 'HEAD' })
    return { name, status: res.status, remoteBytes: Number(res.headers.get('content-length') || 0) }
  } catch (error) {
    return { name, error: error.message }
  }
}

const answers = []
for (let i = 0; i < vanished.length; i += 8) {
  answers.push(...(await Promise.all(vanished.slice(i, i + 8).map(ask))))
}

const restored = []
for (const { name, status, remoteBytes, error } of answers) {
  if (error) {
    console.log(`  ~ ${name} — تعذّر السؤال (${error})`)
    continue
  }
  const decision = decideMissing({ status, remoteBytes })
  if (decision.action !== 'restore') {
    console.log(`  · ${name} — ${decision.why}`)
    continue
  }
  console.log(`  ✚ ${name} — ${decision.why}`)
  meta[name] = rebuildEntry(history.get(name), decision.bytes)
  restored.push(name)
}

console.log(`\n── مُعاد: ${restored.length} · متروك: ${vanished.length - restored.length} ──`)

if (!restored.length) {
  console.log('✓ لا ارتداد — كلُّ ما اختفى من السجلّ اختفى من R2 معه.')
  process.exit(0)
}

if (!APPLY) {
  console.log('\n⚠ تشغيلةٌ جافّة. أضف --apply لكتابة السجلّ.')
  process.exit(0)
}

const ordered = Object.fromEntries(Object.keys(meta).sort().map((k) => [k, meta[k]]))
writeFileSync(META, `${JSON.stringify(ordered, null, 2)}\n`)
console.log(`\n✔ أُعيد ${restored.length} مدخلاً إلى السجلّ. أعد البناء ليظهر في الموقع.`)
