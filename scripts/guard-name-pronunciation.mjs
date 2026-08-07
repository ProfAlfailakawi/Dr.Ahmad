/**
 * حارس نطق الاسم.
 *
 * لفظ اسم الدكتور اعتُمد بأذنه من أربعة مرشّحين: «أَحْمَدْ حُسَيْنْ الفَيْلَكَاوِي»
 * بسكونٍ على آخر كل اسم. وقد كان دفتر النطق يحمل صيغةً أخرى شهوراً، فسرى اللفظ
 * الخطأ على كل صوتٍ منشور — قراءاتٍ وحوارات — ولم يكشفه شيء حتى سمعه بأذنه.
 *
 * فهذا الحارس يمنع عودة ذلك: يفحص دفتر النطق ونصوص الحوارات، ويسقط بالرمز ١
 * إن وجد الاسم بغير صيغته المعتمدة. يُشغَّل قبل أي رفعٍ أو توليد.
 *
 *   node scripts/guard-name-pronunciation.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = process.cwd()
const APPROVED = 'أَحْمَدْ حُسَيْنْ الفَيْلَكَاوِي'
const LEXICON = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const SOULS = resolve(ROOT, 'manual-dialogues-soul')

/* الاسم بلا تشكيل — نبحث عنه لنعرف أين ذُكر، ثم نطالب بالصيغة المعتمدة */
const strip = (text) => text.replace(/[ً-ْٰـ]/gu, '')
const problems = []

if (existsSync(LEXICON)) {
  const lexicon = JSON.parse(readFileSync(LEXICON, 'utf8'))
  const entries = lexicon.entries || {}
  const expected = {
    'أحمد حسين الفيلكاوي': APPROVED,
    'د. أحمد حسين الفيلكاوي': `الدُّكْتُور ${APPROVED}`,
    'الفيلكاوي': 'الفَيْلَكَاوِي',
  }
  for (const [key, want] of Object.entries(expected)) {
    const entry = entries[key]
    if (!entry) { problems.push(`دفتر النطق: المدخل «${key}» مفقود`); continue }
    const spoken = entry.sub || entry.diacritics || ''
    if (!spoken.includes(want)) {
      problems.push(`دفتر النطق: «${key}» ينطق «${spoken}» والمعتمد «${want}»`)
    }
  }
} else {
  problems.push('دفتر النطق غير موجود')
}

if (existsSync(SOULS)) {
  for (const file of readdirSync(SOULS).filter((f) => f.endsWith('.soul.json'))) {
    const doc = JSON.parse(readFileSync(join(SOULS, file), 'utf8'))
    const last = doc.utterances?.at(-1)?.text || ''
    if (!strip(last).includes('الفيلكاوي')) continue
    if (!last.includes(APPROVED)) problems.push(`${file}: الخاتمة لا تحمل اللفظ المعتمد`)
  }
}

if (problems.length) {
  console.error('✘ نطق الاسم خالف المعتمد:')
  for (const line of problems.slice(0, 12)) console.error(`  · ${line}`)
  if (problems.length > 12) console.error(`  … و${problems.length - 12} غيرها`)
  process.exit(1)
}
console.log(`✓ نطق الاسم مطابق للمعتمد في دفتر النطق وفي كل الخواتيم`)
