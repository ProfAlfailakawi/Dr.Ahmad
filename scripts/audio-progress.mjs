#!/usr/bin/env node
/**
 * تقرير التوليد — «تأكّد من توليد كل شيء بالتفصيل الممل».
 *
 * لا يثق بسجلٍّ ولا بلوحة: يسأل R2 نفسه عن كل ملفٍ متوقَّع. فالملفُّ الموجود
 * على الخادم هو ما يسمعه الناس، وما عداه دعوى. ويقيس ثلاثة مسارات لكل مقال:
 * صوت فهد وصوت نورة وحلقة الحوار — ويقول ما تمّ وما بقي وكم يلزم.
 *
 * الاستعمال:
 *   node scripts/audio-progress.mjs              ملخّصٌ وأرقام
 *   node scripts/audio-progress.mjs --missing    يسرد الناقص باسمه
 *   node scripts/audio-progress.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const SHOW_MISSING = process.argv.includes('--missing')

/** صوت فهد وصوت نورة، ثم الحوار عند طلبه. */
export function expectedFiles(slug, { withDialogue = true } = {}) {
  const files = [`${slug}.mp3`, `${slug}.noura.mp3`]
  if (withDialogue) files.push(`${slug}.dialogue.mp3`)
  return files
}

/** حالةُ مقالٍ واحد من نتائج الفحص */
export function articleState(found) {
  const fahed = Boolean(found[0])
  const noura = Boolean(found[1])
  const dialogue = Boolean(found[2])
  const reading = fahed || noura
  const done = fahed && noura && dialogue
  return {
    reading, dialogue, fahed, noura, done,
    label: done ? 'مكتمل'
      : !fahed && !noura && !dialogue ? 'لم يبدأ'
        : !noura && fahed && dialogue ? 'ينقص صوت نورة'
          : !fahed && noura && dialogue ? 'ينقص صوت فهد'
            : fahed && noura && !dialogue ? 'الصوتان بلا حوار'
              : 'قيد الاكتمال',
  }
}

/** المدّة المتوقّعة بالساعات على إنتاجيةٍ مقيسة */
export function etaHours(remainingFiles, filesPerHour = 10) {
  if (remainingFiles <= 0) return 0
  return Math.ceil(remainingFiles / Math.max(1, filesPerHour))
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }
  let pass = 0
  const t = (m, c) => { assert(c, m); pass++ }

  t('ثلاثة ملفات لكل مقال مع الحوار', expectedFiles('x').length === 3)
  t('وصوتا فهد ونورة بلا حوار', expectedFiles('x', { withDialogue: false }).length === 2)
  t('وأسماؤها بالصيغة التي يرفعها المحرّك', expectedFiles('x').join() === 'x.mp3,x.noura.mp3,x.dialogue.mp3')

  t('★ المكتمل يحتاج فهد ونورة والحوار', articleState([1, 1, 1]).done === true)
  t('★ نورة وحدها تُعد قراءةً منشورة أيضاً', articleState([0, 1, 0]).reading === true)
  t('★ فهد وحده يُعد قراءةً منشورة أيضاً', articleState([1, 0, 0]).reading === true)
  t('غياب نورة يظهر صراحةً في تقرير الإدارة', articleState([1, 0, 1]).label === 'ينقص صوت نورة')
  t('ولم يبدأ يُقال صراحةً', articleState([0, 0, 0]).label === 'لم يبدأ')
  t('والناقص ليس مكتملاً', articleState([1, 0, 1]).done === false)

  t('★ المدّة تُقرَّب لأعلى فلا نَعِد بأقلّ من الواقع', etaHours(261, 10) === 27)
  t('ولا مدّة لما اكتمل', etaHours(0) === 0)

  console.log(`✓ اختبارات تقرير التوليد: ${pass}/${pass}`)
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const BASE = (process.env.AUDIO_PUBLIC_BASE_URL || 'https://pub-e2ce7a54469544ecab38d55cd80787aa.r2.dev').replace(/\/+$/, '')
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const excludedPath = resolve(ROOT, 'podcast-audits/excluded-slugs.json')
const excluded = new Set(existsSync(excludedPath) ? JSON.parse(readFileSync(excludedPath, 'utf8')) : [])
const slugs = Object.keys(bodies).filter((slug) => !excluded.has(slug)).sort()

const head = async (name) => {
  try {
    const res = await fetch(`${BASE}/${encodeURI(name)}`, { method: 'HEAD' })
    return res.ok ? Number(res.headers.get('content-length') || 1) : 0
  } catch { return 0 }
}

console.log(`═══ تقرير التوليد · ${slugs.length} مقالاً · ${new Date().toLocaleString('ar-KW')} ═══\n`)

const rows = []
let bytes = 0
for (let i = 0; i < slugs.length; i += 6) {
  const batch = slugs.slice(i, i + 6)
  const results = await Promise.all(batch.map(async (slug) => {
    const found = await Promise.all(expectedFiles(slug).map(head))
    return { slug, found }
  }))
  for (const { slug, found } of results) {
    bytes += found.reduce((sum, n) => sum + n, 0)
    rows.push({ slug, ...articleState(found) })
  }
  process.stdout.write(`\r  فُحص ${Math.min(i + 6, slugs.length)} / ${slugs.length}…`)
}
process.stdout.write('\r' + ' '.repeat(40) + '\r')

const done = rows.filter((r) => r.done)
const bothVoicesNoDialogue = rows.filter((r) => r.fahed && r.noura && !r.dialogue)
const dialogueWithoutBothVoices = rows.filter((r) => r.dialogue && (!r.fahed || !r.noura))
const none = rows.filter((r) => !r.fahed && !r.noura && !r.dialogue)

const missingFahed = rows.filter((r) => !r.fahed).length
const missingNoura = rows.filter((r) => !r.noura).length
const missingDialogues = rows.filter((r) => !r.dialogue).length

const bar = (n) => '█'.repeat(Math.round((n / rows.length) * 28)).padEnd(28, '·')
const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}٪`

console.log(`  القراءات   ${bar(rows.filter((r) => r.reading).length)}  ${rows.filter((r) => r.reading).length}/${rows.length}  ${pct(rows.filter((r) => r.reading).length)}`)
console.log(`  الحوارات   ${bar(rows.filter((r) => r.dialogue).length)}  ${rows.filter((r) => r.dialogue).length}/${rows.length}  ${pct(rows.filter((r) => r.dialogue).length)}`)
console.log(`  المكتمل    ${bar(done.length)}  ${done.length}/${rows.length}  ${pct(done.length)}\n`)

console.log(`  ✔ مكتمل (قراءة وحوار)      ${done.length}`)
console.log(`  ◐ قراءةٌ بلا حوار          ${readingOnly.length}`)
console.log(`  ◑ حوارٌ بلا قراءة          ${dialogueOnly.length}`)
console.log(`  ○ لم يبدأ                  ${none.length}\n`)

console.log(`  الباقي: ${missingReadings} ملفَ قراءة · ${missingDialogues} حلقةَ حوار`)
console.log(`  المرفوع حتى الآن: ${(bytes / 1024 / 1024).toFixed(0)} ميغابايت`)
console.log(`  المدّة المتوقَّعة: ~${etaHours(missingReadings + missingDialogues * 3)} ساعة على إنتاجية ١٠ ملفات/ساعة\n`)

if (SHOW_MISSING) {
  const show = (title, list) => {
    if (!list.length) return
    console.log(`── ${title} (${list.length})`)
    for (const r of list) console.log(`   · ${r.slug}`)
    console.log()
  }
  show('لم يبدأ', none)
  show('الصوتان بلا حوار', bothVoicesNoDialogue)
  show('حوار مع صوت ناقص', dialogueWithoutBothVoices)
  show('ينقص صوت نورة', rows.filter((r) => !r.noura))
  show('ينقص صوت فهد', rows.filter((r) => !r.fahed))
}

console.log(done.length === rows.length ? '✔ اكتمل كل شيء.' : `ⓘ للتفصيل الكامل: node scripts/audio-progress.mjs --missing`)
