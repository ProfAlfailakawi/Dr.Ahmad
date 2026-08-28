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
 *     --passed=7-17,19-38 \
 *     --wrong=18,39 \
 *     --pending=44-46 \
 *     --rewrite=18,39,56-57
 *
 *  · --version  إلزامي ويطابق إصدار الدفتر المجمّد حرفاً بحرف — لو أُعيد
 *               توليد المختبر بترقيمٍ جديد سقط الاستقبال بدل ما يخربط.
 *  · --options  حكم الاختبارات الستة (اختر ١ أو ٢ أو ٣): الخيار ١ أو ٢
 *               تهجئة تدخل المعجم ويُدوَّن سماعها؛ الخيار ٣ استبدال
 *               تحريري بالمعنى ويبقى الجذع محجوباً.
 *  · --passed   الأرقام التي قال الدكتور إنها صحيحة فقط. لا يوجد نجاح ضمني.
 *  · --wrong    الأرقام التي سمعها خطأ.
 *  · --pending  الأرقام التي لم يحكم عليها بعد؛ تبقى معلقة ولا تدخل المعجم.
 *  · --rewrite  أرقام تُحذف أو يعاد بناء جملتها تحريرياً (قد تتقاطع مع
 *               passed أو wrong؛ فالنطق بُعد، وشفوية النص بُعد آخر).
 *  · الجذع العام في earBlockedUntilAudition لا ينفك من عينة أو عبارتين؛
 *               التهجئة المسموعة تدخل للصيغة/العبارة الدقيقة وحدها.
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

export function parseNumberSet(raw, ledger, label = 'numbers') {
  const valid = new Set(ledger.screening.map((s) => s.number))
  const digits = (s) => Number(String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  const out = new Set()
  const normalized = String(raw ?? '').replace(/[؛;]/g, ',')
  for (const piece of normalized.split(/[،,\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const m = piece.match(/^([0-9٠-٩]+)(?:\s*(?:-|–|—|\.\.|إلى|الى)\s*([0-9٠-٩]+))?$/u)
    assert.ok(m, `رقم أو مدى غير مفهوم في --${label}: «${piece}»`)
    const first = digits(m[1]); const last = m[2] ? digits(m[2]) : first
    assert.ok(last >= first, `مدى معكوس في --${label}: «${piece}»`)
    for (let n = first; n <= last; n += 1) {
      assert.ok(valid.has(n), `الرقم ${n} ليس من فحوص الدفتر (${ledger.screening[0].number}–${ledger.screening[ledger.screening.length - 1].number})`)
      out.add(n)
    }
  }
  return out
}

export const parseWrong = (raw, ledger) => parseNumberSet(raw, ledger, 'wrong')

const overlap = (a, b) => [...a].filter((n) => b.has(n))

function assertAuditoryPartition (ledger, passed, wrong, pending) {
  assert.equal(overlap(passed, wrong).length, 0, 'رقم موجود في passed وwrong معاً')
  assert.equal(overlap(passed, pending).length, 0, 'رقم موجود في passed وpending معاً')
  assert.equal(overlap(wrong, pending).length, 0, 'رقم موجود في wrong وpending معاً')
  const classified = new Set([...passed, ...wrong, ...pending])
  const expected = new Set(ledger.screening.map((s) => s.number))
  const missing = [...expected].filter((n) => !classified.has(n))
  assert.equal(missing.length, 0,
    `فحوص بلا حكم صريح: ${missing.join(', ')} — ضعها في passed أو wrong أو pending؛ لا نجاح بالتخمين`)
}

/** ينزل الأحكام على نسخة من المعجم ويرجع دفتر الأحكام — نقي بلا كتابة ملفات. */
export function applyVerdicts(lexSource, ledger, { version, options, passed, wrong, pending, editorial, date }) {
  assert.equal(version, ledger.version,
    `الإصدار لا يطابق الدفتر المجمّد:\n  المعطى: ${version}\n  الدفتر: ${ledger.version}\nأعد توليد المختبر أو صحح --version — الترقيم لا يُخمَّن.`)
  const lex = JSON.parse(JSON.stringify(lexSource))
  const changes = []
  assertAuditoryPartition(ledger, passed, wrong, pending)
  const validNumbers = new Set(ledger.screening.map((s) => s.number))
  for (const n of editorial) assert.ok(validNumbers.has(n), `رقم rewrite خارج الدفتر: ${n}`)

  /* امسح أثر أي تشغيل قديم كان يدوّن الكلمة أو نصف العبارة. الحكم الجديد
     يملك الجملة الحاملة كاملة؛ فلا تبقى خريطة واسعة من الجولة السابقة. */
  for (const test of ledger.optionTests) {
    const legacyKeys = new Set([test.key])
    for (const choice of test.options) {
      const words = choice.split(' ')
      legacyKeys.add([test.key, ...words.slice(1)].join(' '))
    }
    for (const key of legacyKeys) {
      delete lex.words?.[key]
      if (key !== test.key || test.key !== 'يهرب') delete lex.heardByEar?.[key]
    }
  }

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
      const writtenKey = test.carrier.replace('{W}', test.key)
      const spokenValue = test.carrier.replace('{W}', chosen)
      if (writtenKey !== spokenValue) {
        lex.words[writtenKey] = spokenValue
        changes.push(`words[${writtenKey}] = ${spokenValue}`)
      }
      lex.heardByEar[writtenKey] =
        `اختارها سماعاً ${date} داخل الجملة كاملة — مختبر «${ledger.version}»، الاختبار ${pos}، الخيار ${choice}: «${spokenValue}».`
      changes.push(`heardByEar[${writtenKey}] ✓ تهجئة دقيقة بلا تعميم على الجذع`)
    } else {
      lex.heardByEar[test.key] =
        `رفض التهجئتين سماعاً ${date} — مختبر «${ledger.version}»، الاختبار ${pos}: تُستبدل تحريرياً بمعناها «${chosen}» ويبقى جذعها محجوباً حتى سماع صيغة جديدة.`
      changes.push(`heardByEar[${test.key}] ✓ استبدال بالمعنى — الجذع باقٍ محجوباً`)
    }
    return { number: pos, key: test.key, choice, chosen }
  })

  /* لا نفك جذعاً عاماً من ست جمل. الصيغ المسموعة تعمل لأنها دخلت words
     بمفتاحها الدقيق، وتظل التصريفات غير المسموعة محجوبة للمستقبل. */
  lex.earBlockedUntilAudition = Array.isArray(lex.earBlockedUntilAudition)
    ? [...lex.earBlockedUntilAudition]
    : []

  const rejected = ledger.screening.filter((s) => wrong.has(s.number))
    .map((s) => ({ number: s.number, key: s.key, category: s.category, source: s.source }))
  const unresolvedRejected = rejected.filter((r) => !editorial.has(r.number))
  if (!Array.isArray(lex.retestQueue)) lex.retestQueue = []
  for (const r of unresolvedRejected) {
    if (!lex.retestQueue.some((q) => q.key === r.key && q.version === ledger.version)) {
      lex.retestQueue.push({ key: r.key, number: r.number, category: r.category, version: ledger.version })
    }
  }
  if (unresolvedRejected.length) changes.push(`retestQueue: +${unresolvedRejected.length} كلمة للجولة القادمة`)

  const pendingRows = ledger.screening.filter((s) => pending.has(s.number))
    .map((s) => ({ number: s.number, key: s.key, category: s.category, source: s.source }))
  const editorialRows = ledger.screening.filter((s) => editorial.has(s.number))
    .map((s) => ({ number: s.number, key: s.key, category: s.category, source: s.source, carrier: s.carrier }))
  lex.layers = lex.layers || {}
  lex.layers.lexiconScreeningV2Verdicts =
    `أحكام الدكتور على مختبر «${ledger.version}» (${date}): ${passed.size} صحيح صراحةً، ${rejected.length} مرفوض سمعياً، ${pendingRows.length} غير محسوم، و${editorialRows.length} يعاد تحرير سياقه. لا نجاح ضمنياً ولا فك حجب لجذر كامل من عينة. الاختبارات الستة: ${optionVerdicts.map((v) => `${v.key}:${v.choice}`).join(' · ')}. التفصيل: podcast-audits/kuwaiti-lexicon-verdicts.json.`

  const verdicts = {
    version: ledger.version,
    decidedAt: date,
    optionVerdicts,
    rejected,
    pending: pendingRows,
    editorialRewrites: editorialRows,
    passedCount: passed.size,
    passedNumbers: [...passed].sort((a, b) => a - b),
  }
  return { lex, verdicts, changes }
}

const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
const lexRaw = readFileSync(LEX_PATH, 'utf8')
const lexSource = JSON.parse(lexRaw)

if (SELF_TEST) {
  const date = '٢٧ أغسطس ٢٠٢٦'
  /* [٢٨ أغسطس ٢٠٢٦] الفحص يعمل على نسخةٍ مصطنعة لا على المعجم الحيّ. أول جولة
     أحكامٍ حقيقية تغيّر الحيّ — ينفكّ الحجب ويمتلئ طابور الإعادة — فتسقط أيّ
     توقّعاتٍ مبنيّة على لقطته، ويقف البناء يوم يحكم الدكتور لا يوم يخطئ أحد.
     (أُثبت العطب بتشغيل جولةٍ كاملة: انكسر الفحص على العدد المطلق للطابور.)
     فالمقيس هنا هو المنطق: ماذا يفعل الاستقبال بمعجمٍ معلومِ الحالة. */
  const fixture = {
    ...JSON.parse(JSON.stringify(lexSource)),
    words: {},
    heardByEar: {},
    retestQueue: [],
    earBlockedUntilAudition: ['ركض', 'هرب', 'يقربنا'],
  }
  const good = parseOptions('1:2,2:2,3:1,4:2,5:2,6:3', ledger.optionTests.length)
  assert.throws(() => parseOptions('1:1,2:2,3:1,4:3,5:1', ledger.optionTests.length), /الستة/, 'حكم ناقص يسقط')
  assert.throws(() => parseOptions('1:1,1:2,2:2,3:1,4:3,5:1', ledger.optionTests.length), /تكرر/, 'التكرار يسقط')
  assert.throws(() => parseOptions('1:4,2:2,3:1,4:3,5:1,6:2', ledger.optionTests.length), /غير مفهومة/, 'خيار ٤ يسقط')
  assert.throws(() => parseWrong('5', ledger), /ليس من فحوص/, 'رقم خارج الدفتر يسقط')
  assert.deepEqual([...parseNumberSet('٧ إلى ٩، 12-14', ledger, 'passed')], [7, 8, 9, 12, 13, 14],
    'المدى العربي والغربي يُفهمان بلا نسخ كل رقم')
  const all = new Set(ledger.screening.map((s) => s.number))
  const wrong = new Set([7]); const pending = new Set([431])
  const passed = new Set([...all].filter((n) => !wrong.has(n) && !pending.has(n)))
  const editorial = new Set([7])
  assert.throws(
    () => applyVerdicts(fixture, ledger, { version: 'نسخة-قديمة', options: good, passed, wrong, pending, editorial, date }),
    /لا يطابق الدفتر المجمّد/, 'اختلاف الإصدار يسقط قبل أي حكم')

  assert.throws(() => applyVerdicts(fixture, ledger, {
    version: ledger.version, options: good, passed: new Set(), wrong, pending, editorial, date,
  }), /بلا حكم صريح/, 'غير المذكور لا يتحول إلى ناجح')
  const { lex, verdicts } = applyVerdicts(fixture, ledger, {
    version: ledger.version, options: good, passed, wrong, pending, editorial, date,
  })
  assert.equal(lex.words['نركض وايد… ونسمي هالحركة التزام.'],
    'نِرْكُظ وايد… ونسمي هالحركة التزام.', 'الخيار يدخل بجملته الحاملة كاملة')
  assert.equal(lex.words['المشكلة إن الواحد يركض.'],
    'المشكلة إن الواحد يِرْكِظ سنة كاملة.',
    'حتى الخيار ذو الكلمة المفردة لا يُعمم خارج الجملة التي سمعها')
  assert.ok(!('نركض' in lex.words), 'الكلمة المفردة لا تنفك من سماع جملة واحدة')
  assert.ok(!('يركض سنة كاملة' in lex.words), 'نصف العبارة القديم يُمسح')
  assert.ok(!('يهرب' in lex.words), 'الكلمة المفردة لا تدخل من خيار عبارة')
  assert.ok(!('يهرب من نفسه' in lex.words), 'الخيار ٣ للاختبار ٦ يعاد تحريره ولا يخترع تهجئة')
  assert.ok(lex.earBlockedUntilAudition.includes('ركض'), 'جذر ركض يبقى محجوباً عن التصريفات غير المسموعة')
  assert.ok(lex.earBlockedUntilAudition.includes('هرب'), 'جذر هرب يبقى محجوباً عن التصريفات غير المسموعة')
  assert.ok(lex.earBlockedUntilAudition.includes('يقربنا'), 'يقربنا يبقى محجوباً مع أن عبارته الدقيقة سُمعت')
  assert.equal(verdicts.rejected.length, 1, 'المرفوض الصريح مدوَّن')
  assert.equal(verdicts.pending.length, 1, 'غير المحسوم لا يُسمى ناجحاً')
  assert.equal(verdicts.passedCount, ledger.screening.length - 2, 'الناجح فقط ما ورد صراحةً')
  assert.equal(lex.retestQueue.length, 0, 'المرفوض ذو البديل التحريري لا يهدر توليداً جديداً')
  assert.equal(readFileSync(LEX_PATH, 'utf8'), lexRaw, 'الفحص الذاتي لا يكتب حرفاً على القرص')
  console.log('✓ مستقبِل أحكام المختبر: الفحص الذاتي 20/20 — لا نجاح ضمنياً ولا فك حجب لجذر كامل')
  process.exit(0)
}

const version = arg('version')
assert.ok(version, 'مطلوب --version=… (إصدار الدفتر المجمّد كما في podcast-audits/kuwaiti-lexicon-screening.json)')
const options = parseOptions(arg('options'), ledger.optionTests.length)
const passed = parseNumberSet(arg('passed'), ledger, 'passed')
const wrong = parseNumberSet(arg('wrong'), ledger, 'wrong')
const pending = parseNumberSet(arg('pending'), ledger, 'pending')
const editorial = parseNumberSet(arg('rewrite'), ledger, 'rewrite')
const today = new Date()
const date = today.toISOString().slice(0, 10)

const { lex, verdicts, changes } = applyVerdicts(lexSource, ledger, {
  version, options, passed, wrong, pending, editorial, date,
})
console.log('أحكام مختبر «' + ledger.version + '»:')
for (const c of changes) console.log('  · ' + c)
console.log(`  · ${verdicts.passedCount}/${ledger.screening.length} فحصاً نجح صراحةً · ${verdicts.pending.length} غير محسوم · ${verdicts.editorialRewrites.length} يعاد تحريره`)
if (DRY_RUN) { console.log('ℹ معاينة بلا كتابة (--dry-run)'); process.exit(0) }

writeFileSync(LEX_PATH, JSON.stringify(lex, null, 2) + '\n')
writeFileSync(VERDICTS_PATH, JSON.stringify(verdicts, null, 2) + '\n')
console.log('✓ كُتب المعجم ودفتر الأحكام. التالي: npm run podcast:kw:self-test')
