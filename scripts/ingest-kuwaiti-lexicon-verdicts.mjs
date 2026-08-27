#!/usr/bin/env node
/**
 * مستقبِل أحكام مختبر المعجم الصلب — طريق الرجوع الذي كان ناقصاً.
 *
 * قبل هذا السكربت كان الدكتور يسمع حلقة الـ٤٣١ فحصاً ثم تُدوَّن أحكامه
 * في src/data/kuwaiti-pronunciation.json **يدوياً** حكماً حكماً. الآن
 * يرد بسطرٍ واحد، والسكربت ينزّل الأحكام في مواضعها:
 *
 *   node scripts/ingest-kuwaiti-lexicon-verdicts.mjs \
 *     --version=2026-08-27-kuwaiti-lexicon-screening-v2-risk-families \
 *     --options=1:2,2:1,3:1,4:3,5:2,6:1 \
 *     --wrong=12,88,105
 *
 *  · --version  إلزامي ويطابق إصدار الدفتر المجمّد حرفاً بحرف — لو أُعيد
 *               توليد المختبر بترقيمٍ جديد سقط الاستقبال بدل ما يخربط.
 *  · --options  حكم الاختبارات الستة (اختر ١ أو ٢ أو ٣): الخيار ١ أو ٢
 *               تهجئة تدخل المعجم ويُدوَّن سماعها؛ الخيار ٣ استبدال
 *               تحريري بالمعنى ويبقى الجذع محجوباً.
 *  · --wrong    أرقام الفحوص التي نطقها المحرك خطأ (٧–٤٣١)، تدخل طابور
 *               إعادة الاختبار (retestQueue) للجولة القادمة. الباقي كله
 *               يُحسب «نجح بأذنه» ويُدوَّن في دفتر الأحكام.
 *  · فكّ الحجب: جذع earBlockedUntilAudition ينفك وحده إذا كل اختباراته
 *               اختيرت لها تهجئة (١ أو ٢) — والخيار ٣ يبقيه محجوباً.
 *  · --dry-run  معاينة بلا كتابة · --self-test فحص ذاتي بلا كتابة.
 *
 * المخرجات: تحديث src/data/kuwaiti-pronunciation.json + دفتر أحكام
 * podcast-audits/kuwaiti-lexicon-verdicts.json. وبعد الاستقبال يلزم
 * npm run podcast:kw:self-test ليخضرّ كل شي على الأحكام الجديدة.
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTashkeel } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const DRY_RUN = process.argv.includes('--dry-run')
const LEDGER_PATH = resolve(ROOT, 'podcast-audits/kuwaiti-lexicon-screening.json')
const LEX_PATH = resolve(ROOT, 'src/data/kuwaiti-pronunciation.json')
const VERDICTS_PATH = resolve(ROOT, 'podcast-audits/kuwaiti-lexicon-verdicts.json')

const arg = (name) => process.argv.find((a) => a.startsWith('--' + name + '='))?.slice(name.length + 3)

export function parseOptions(raw, testCount) {
  const map = new Map()
  for (const piece of String(raw ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
    const m = piece.match(/^([0-9٠-٩]+)\s*[:=]\s*([1-3١-٣])$/u)
    assert.ok(m, `صيغة خيار غير مفهومة: «${piece}» — المطلوب مثل 1:2`)
    const digits = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    const pos = digits(m[1]); const choice = digits(m[2])
    assert.ok(pos >= 1 && pos <= testCount, `اختبار خيارات خارج المدى: ${pos}`)
    assert.ok(!map.has(pos), `الاختبار ${pos} تكرر في --options`)
    map.set(pos, choice)
  }
  assert.equal(map.size, testCount, `المطلوب حكم الاختبارات الستة كلها (وصل ${map.size} من ${testCount})`)
  return map
}

export function parseWrong(raw, ledger) {
  const valid = new Set(ledger.screening.map((s) => s.number))
  const digits = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const out = new Set()
  for (const piece of String(raw ?? '').split(/[،,\s]+/).map((p) => p.trim()).filter(Boolean)) {
    assert.ok(/^[0-9٠-٩]+$/u.test(piece), `رقم غير مفهوم في --wrong: «${piece}»`)
    const n = digits(piece)
    assert.ok(valid.has(n), `الرقم ${n} ليس من فحوص الدفتر (${ledger.screening[0].number}–${ledger.screening[ledger.screening.length - 1].number})`)
    out.add(n)
  }
  return out
}

/** ينزل الأحكام على نسخة من المعجم ويرجع دفتر الأحكام — نقي بلا كتابة ملفات. */
export function applyVerdicts(lexSource, ledger, { version, options, wrong, date }) {
  assert.equal(version, ledger.version,
    `الإصدار لا يطابق الدفتر المجمّد:\n  المعطى: ${version}\n  الدفتر: ${ledger.version}\nأعد توليد المختبر أو صحح --version — الترقيم لا يُخمَّن.`)
  const lex = JSON.parse(JSON.stringify(lexSource))
  const changes = []

  const optionVerdicts = ledger.optionTests.map((test, index) => {
    const pos = index + 1
    const choice = options.get(pos)
    const chosen = test.options[choice - 1]
    if (choice <= 2) {
      /* الخيار قد يكون عبارة سياق كاملة («يَرْكُظ سنة كاملة») — فالمفتاح
         المكتوب هو العبارة نفسها بكلمة المتن («يركض سنة كاملة»)، على نمط
         مفاتيح البيت المركبة («ما جان» · «منو غلبت»): الصيغة التي سمعها
         الدكتور وحدها تدخل، ولا تعميم على سياقات لم تُسمع. */
      const optionWords = chosen.split(' ')
      const normalizeDaad = (w) => stripTashkeel(w).replace(/ظ/g, 'ض')
      assert.ok(normalizeDaad(optionWords[0]) === normalizeDaad(test.key),
        `الاختبار ${pos}: أول كلمة في الخيار «${chosen}» لا تطابق مفتاحه «${test.key}»`)
      const writtenKey = [test.key, ...optionWords.slice(1)].join(' ')
      if (writtenKey !== chosen) { lex.words[writtenKey] = chosen; changes.push(`words[${writtenKey}] = ${chosen}`) }
      lex.heardByEar[test.key] =
        `اختارها سماعاً ${date} — مختبر «${ledger.version}»، الاختبار ${pos}، الخيار ${choice}: «${chosen}».`
      changes.push(`heardByEar[${test.key}] ✓ تهجئة`)
    } else {
      lex.heardByEar[test.key] =
        `رفض التهجئتين سماعاً ${date} — مختبر «${ledger.version}»، الاختبار ${pos}: تُستبدل تحريرياً بمعناها «${chosen}» ويبقى جذعها محجوباً حتى سماع صيغة جديدة.`
      changes.push(`heardByEar[${test.key}] ✓ استبدال بالمعنى — الجذع باقٍ محجوباً`)
    }
    return { number: pos, key: test.key, choice, chosen }
  })

  /* فك الحجب: الجذع ينفك فقط إذا كل اختباراته نالت تهجئة (١ أو ٢). */
  const blocked = Array.isArray(lex.earBlockedUntilAudition) ? lex.earBlockedUntilAudition : []
  lex.earBlockedUntilAudition = blocked.filter((stem) => {
    const touching = optionVerdicts.filter((v) => stripTashkeel(v.key).includes(stem))
    if (!touching.length) return true
    const allSpelled = touching.every((v) => v.choice <= 2)
    if (allSpelled) changes.push(`فُكّ حجب «${stem}» — كل اختباراته نالت تهجئة مسموعة`)
    return !allSpelled
  })

  const rejected = ledger.screening.filter((s) => wrong.has(s.number))
    .map((s) => ({ number: s.number, key: s.key, category: s.category, source: s.source }))
  if (!Array.isArray(lex.retestQueue)) lex.retestQueue = []
  for (const r of rejected) {
    if (!lex.retestQueue.some((q) => q.key === r.key && q.version === ledger.version)) {
      lex.retestQueue.push({ key: r.key, number: r.number, category: r.category, version: ledger.version })
    }
  }
  if (rejected.length) changes.push(`retestQueue: +${rejected.length} كلمة للجولة القادمة`)

  const passed = ledger.screening.length - rejected.length
  lex.layers = lex.layers || {}
  lex.layers.lexiconScreeningV2Verdicts =
    `أحكام الدكتور على مختبر «${ledger.version}» (${date}): ${passed} فحصاً نجح بأذنه من ${ledger.screening.length}، و${rejected.length} دخل طابور إعادة الاختبار، والاختبارات الستة حُسمت (${optionVerdicts.map((v) => `${v.key}:${v.choice}`).join(' · ')}). التفصيل: podcast-audits/kuwaiti-lexicon-verdicts.json.`

  const verdicts = {
    version: ledger.version,
    decidedAt: date,
    optionVerdicts,
    rejected,
    passedCount: passed,
    passedNumbers: ledger.screening.map((s) => s.number).filter((n) => !wrong.has(n)),
  }
  return { lex, verdicts, changes }
}

const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
const lexRaw = readFileSync(LEX_PATH, 'utf8')
const lexSource = JSON.parse(lexRaw)

if (SELF_TEST) {
  const date = '٢٧ أغسطس ٢٠٢٦'
  const good = parseOptions('1:1,2:2,3:1,4:3,5:1,6:2', ledger.optionTests.length)
  assert.throws(() => parseOptions('1:1,2:2,3:1,4:3,5:1', ledger.optionTests.length), /الستة/, 'حكم ناقص يسقط')
  assert.throws(() => parseOptions('1:1,1:2,2:2,3:1,4:3,5:1', ledger.optionTests.length), /تكرر/, 'التكرار يسقط')
  assert.throws(() => parseOptions('1:4,2:2,3:1,4:3,5:1,6:2', ledger.optionTests.length), /غير مفهومة/, 'خيار ٤ يسقط')
  assert.throws(() => parseWrong('5', ledger), /ليس من فحوص/, 'رقم خارج الدفتر يسقط')
  assert.throws(
    () => applyVerdicts(lexSource, ledger, { version: 'نسخة-قديمة', options: good, wrong: new Set(), date }),
    /لا يطابق الدفتر المجمّد/, 'اختلاف الإصدار يسقط قبل أي حكم')

  const wrong = parseWrong('7، 431', ledger)
  const { lex, verdicts } = applyVerdicts(lexSource, ledger, { version: ledger.version, options: good, wrong, date })
  assert.equal(lex.words['نركض'], 'نَرْكُظ', 'الخيار ١ للاختبار ١ يدخل المعجم')
  assert.equal(lex.words['يهرب من نفسه'], ledger.optionTests[5].options[1],
    'خيار العبارة يدخل بمفتاح مكتوب مركب — لا تعميم على سياق لم يُسمع')
  assert.ok(!('يهرب' in lex.words), 'الكلمة المفردة لا تدخل من خيار عبارة')
  assert.ok(!('يقرّبنا' in lex.words), 'الخيار ٣ لا يخترع تهجئة')
  assert.match(lex.heardByEar['يقرّبنا'], /محجوباً/, 'الخيار ٣ مدوَّن استبدالاً بالمعنى')
  assert.ok(!lex.earBlockedUntilAudition.includes('ركض'), 'ركض انفك — اختباراه (١ و٥) نالا تهجئة')
  assert.ok(!lex.earBlockedUntilAudition.includes('هرب'), 'هرب انفك — اختباراه (٢ و٦) نالا تهجئة')
  assert.ok(lex.earBlockedUntilAudition.includes('يقربنا'), 'يقربنا باقٍ محجوباً — اختباره خيار ٣')
  assert.equal(verdicts.rejected.length, 2, 'الرقمان المرفوضان مدوَّنان')
  assert.equal(verdicts.passedCount, ledger.screening.length - 2, 'الباقي كله نجح بأذنه')
  assert.equal(lex.retestQueue.length, 2, 'طابور إعادة الاختبار امتلأ')
  assert.equal(readFileSync(LEX_PATH, 'utf8'), lexRaw, 'الفحص الذاتي لا يكتب حرفاً على القرص')
  console.log('✓ مستقبِل أحكام المختبر: الفحص الذاتي 14/14 — الأحكام تنزل في مواضعها ولا تُخمَّن')
  process.exit(0)
}

const version = arg('version')
assert.ok(version, 'مطلوب --version=… (إصدار الدفتر المجمّد كما في podcast-audits/kuwaiti-lexicon-screening.json)')
const options = parseOptions(arg('options'), ledger.optionTests.length)
const wrong = parseWrong(arg('wrong'), ledger)
const today = new Date()
const date = today.toISOString().slice(0, 10)

const { lex, verdicts, changes } = applyVerdicts(lexSource, ledger, { version, options, wrong, date })
console.log('أحكام مختبر «' + ledger.version + '»:')
for (const c of changes) console.log('  · ' + c)
console.log(`  · ${verdicts.passedCount}/${ledger.screening.length} فحصاً نجح بأذنه`)
if (DRY_RUN) { console.log('ℹ معاينة بلا كتابة (--dry-run)'); process.exit(0) }

writeFileSync(LEX_PATH, JSON.stringify(lex, null, 2) + '\n')
writeFileSync(VERDICTS_PATH, JSON.stringify(verdicts, null, 2) + '\n')
console.log('✓ كُتب المعجم ودفتر الأحكام. التالي: npm run podcast:kw:self-test')
