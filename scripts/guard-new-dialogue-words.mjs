#!/usr/bin/env node
/**
 * حارس الكلمات الجديدة — قفل «الكمال» لمقالات المستقبل.
 *
 * أمر الدكتور (٢١ أغسطس ٢٠٢٦): «راح أنشر مقالات من الأسبوع القادم…
 * فكر بالكلمات المتوقعة وغير المتوقعة بحيث ما يكون في أخطاء إطلاقاً».
 *
 * الفكرة: كل كلمةٍ في المتن الحالي (١٥ ألف مفردة في ١٤٤ حلقة) إما مرت
 * بأذنه أو ستمر قبل الإطلاق. فالخطر الوحيد الباقي هو الكلمة الجديدة
 * التي يجلبها مقالٌ جديد. هذا الحارس يقف بعد جلب الحوار وقبل Gemini:
 * أي كلمة ليست في مفردات المتن المعتمد تُرصد وتُصنف، ويسقط التوليد
 * حتى تُحسم في مختبر الكلمات — لا كلمة تصل المحرك قبل أذن الدكتور.
 *
 * درسا الشهر اللذان صاغا التصميم:
 *  - «بعدين» و«شغل» سقطتا وليستا في أي صنف خطر شكلي — فالوضع الصارم
 *    يرصد كل كلمة جديدة، والأصناف للترتيب لا للتصفية.
 *  - «علق» تسعة مواضع بخمسة معانٍ — فبعض الجذوع يُعلَّم للمراجعة
 *    اليدوية حتى لو كانت الكلمة معروفة (قائمة polysemy في المعجم).
 *
 * التشغيل:
 *   node scripts/guard-new-dialogue-words.mjs --dir=manual-dialogues-kuwaiti
 *   node scripts/guard-new-dialogue-words.mjs --self-test
 * التعطيل الواعي (بقراره وحده): PODCAST_KW_ALLOW_NEW_WORDS=1 يحوّل
 * السقوط إلى تحذير — للطوارئ لا للعادة.
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPronunciationMap, toSpokenKuwaiti, buildForeignRedactions, redactForeignNames, stripTashkeel } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const DIR = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || 'manual-dialogues-kuwaiti'
const LIBRARY = process.argv.find((a) => a.startsWith('--library='))?.slice(10) || ''
const ALLOW = process.env.PODCAST_KW_ALLOW_NEW_WORDS === '1'

const SRC = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-pronunciation.json'), 'utf8'))
const MAP = buildPronunciationMap(SRC)
const RED = buildForeignRedactions(SRC)
const spoken = (t) => toSpokenKuwaiti(redactForeignNames(String(t ?? ''), RED), MAP)
const norm = (w) => stripTashkeel(w).replace(/^[وفبل]?ال/, '').replace(/^[وف]/, '')

/* المفردات المعتمدة: متن الحلقات الـ١٤٤ (المكتوب والمنطوق معاً) + مفاتيح
   المعجم وقيمه + ما أملاه بأذنه. كلمة خارج هذا كله = جديدة لم تمر بأذن. */
function buildVocabulary() {
  const vocab = new Set()
  const add = (text) => {
    for (const w of String(text).split(/[\s،؛:.!؟…«»()"'؟!\-‏]+/)) {
      if (w.length > 1) { vocab.add(stripTashkeel(w)); vocab.add(norm(w)) }
    }
  }
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  for (const ep of Object.values(lib.episodes)) for (const t of Object.values(ep)) { add(t.text); add(spoken(t.text)) }
  for (const [k, v] of Object.entries(SRC.words || {})) { add(k); add(v) }
  /* تصريفات عائلات ألف الوصل أقرّ الدكتور طريقتها؛ تمرّ الحوارات القادمة
     بهذه الصيغ من غير مختبر جديد، بينما تبقى أي عائلة أخرى كلمةً جديدة
     يوقفها الحارس قبل الدفع إلى Gemini. */
  for (const family of Object.values(SRC.waslFamilies || {})) {
    for (const [k, v] of Object.entries(family?.forms || {})) { add(k); add(v) }
  }
  for (const k of Object.keys(SRC.heardByEar || {})) add(k)
  for (const v of Object.values(SRC.foreignNames || {})) add(v)
  return vocab
}

/* جذوع المعاني المتعددة تُقرأ من المعجم (بياناتٌ لا شيفرة — كقاعدة heardByEar). */
const POLYSEMY = Array.isArray(SRC.polysemy) ? SRC.polysemy : []

function classify(word) {
  if (/[A-Za-z]/.test(word)) return 'لاتيني غير محجوب'
  if (/[0-9٠-٩%٪]/.test(word)) return 'أرقام خام'
  if (/.[ءأؤئ]/.test(word)) return 'همزة وسطية'
  if (/ق/.test(word)) return 'قاف — موروثة أم متعلمة؟'
  if (/[صطظضغ]/.test(word)) return 'حرف مفخم'
  return 'كلمة جديدة'
}
const SEVERITY = { 'لاتيني غير محجوب': 0, 'أرقام خام': 0, 'همزة وسطية': 1, 'قاف — موروثة أم متعلمة؟': 2, 'حرف مفخم': 2, 'كلمة جديدة': 3 }

function scanTurns(turns, vocab, { isNewDialogue = true } = {}) {
  const findings = []
  const seen = new Set()
  for (const t of turns) {
    const text = String(t.text ?? t ?? '')
    const spokenText = spoken(text)
    /* الجذر متعدد المعاني يُفحص في **المصدر قبل المعجم**. كان الفحص
       السابق على spokenText وحده، فإذا حوّل المعجم «بان» إلى «بيّن» أو
       «ورقة» إلى «شهاده» اختفى الدليل قبل أن يراه الحارس. */
    if (isNewDialogue) {
      for (const poly of POLYSEMY.filter((root) => text.includes(root))) {
        const key = 'poly|' + poly + '|' + text.slice(0, 30)
        if (!seen.has(key)) {
          seen.add(key)
          findings.push({ word: poly, cls: 'جذر متعدد المعاني (' + poly + ') — مراجعة يدوية', ctx: text.slice(0, 90) })
        }
      }
    }
    /* اللاتيني والأرقام يُفحصان على المداخلة كاملة لا الكلمة وحدها */
    for (const bad of spokenText.match(/\S*[A-Za-z0-9٠-٩%٪]+\S*/g) || []) {
      const key = 'crit|' + bad
      if (!seen.has(key)) { seen.add(key); findings.push({ word: bad, cls: classify(bad), ctx: text.slice(0, 90) }) }
    }
    for (const w of spokenText.split(/[\s،؛:.!؟…«»()"'\-‏]+/)) {
      if (!w || w.length < 2 || /[A-Za-z0-9٠-٩%٪]/.test(w)) continue
      const bare = stripTashkeel(w)
      /* حارس المعاني المتعددة — على الحوارات **الجديدة** وحدها: مواضع
         المتن المعتمد رُوجعت يدوياً في تقرير ما قبل الإطلاق ولها
         مفاتيحها السياقية، ولولا هذا القيد لأوقف الحارسُ حلقةَ التجربة
         نفسها («ما يعود» و«نعلقه» المعالجتان أصلاً). */
      const poly = isNewDialogue && POLYSEMY.find((s) => bare.includes(s))
      if (poly) {
        const key = 'poly|' + poly + '|' + text.slice(0, 30)
        if (!seen.has(key)) { seen.add(key); findings.push({ word: w, cls: 'جذع متعدد المعاني (' + poly + ') — مراجعة يدوية', ctx: text.slice(0, 90) }) }
        continue
      }
      if (vocab.has(bare) || vocab.has(norm(w))) continue
      const key = 'new|' + bare
      if (seen.has(key)) continue
      seen.add(key)
      findings.push({ word: w, cls: classify(bare), ctx: text.slice(0, 90) })
    }
  }
  findings.sort((a, b) => (SEVERITY[a.cls] ?? 9) - (SEVERITY[b.cls] ?? 9))
  return findings
}

function report(findings) {
  if (!findings.length) { console.log('✅ حارس الكلمات الجديدة: كل مفردات الحوار معتمدة — لا جديد يحتاج أذن الدكتور.'); return }
  console.log('⛔ حارس الكلمات الجديدة: ' + findings.length + ' رصداً — الحوار الجديد يحمل ما لم يمر بأذن الدكتور:\n')
  for (const f of findings) console.log('  [' + f.cls + '] ' + f.word + '\n      ⟵ ' + f.ctx)
  console.log('\nالعلاج: تُعرض هذه الكلمات في مختبر الكلمات (scripts/podcast-word-audition.mjs —')
  console.log('مصفوفة WORDS) بجملها أعلاه، يسمعها الدكتور ويختار، ثم تدخل المعجم ويخضر الحارس.')
  console.log('للطوارئ وحدها وبقرار الدكتور: PODCAST_KW_ALLOW_NEW_WORDS=1 يحول السقوط إلى تحذير.')
}

if (SELF_TEST) {
  const vocab = buildVocabulary()
  /* حوار مزروع بكل صنف: لاتيني جديد · رقم خام · همزة وسطية جديدة ·
     قاف جديدة · جذع متعدد المعاني · كلمة جديدة بريئة الشكل (درس بعدين). */
  const planted = [
    { text: 'ذكرت مجلة Nature Kids إن النسبة 36% من العينة.' },
    { text: 'هذي مسؤوليتنا التربوية تجاه المستقبل.' },
    { text: 'المقياس البرقعي يثبت النتيجة.' },
    { text: 'الورقة تعلق على لوحة الشرف.' },
    { text: 'كل ما بان مشغول حسبناه أنجز.' },
    { text: 'شنطرة الأفكار توضح المقصود.' },
  ]
  const f = scanTurns(planted, vocab)
  const has = (frag) => f.some((x) => (x.word + x.cls).includes(frag))
  /* اللاتيني المجهول يبتلعه احتياطُ الحجب العام («Nature Kids» → «مصدر
     علمي») — مُثبت هنا. وشبكة اللاتيني في الحارس تبقى صماماً أخيراً
     لأي تسرب، وتُختبر على مستوى التصنيف مباشرة. */
  assert.ok(!/[A-Za-z]/.test(spoken(planted[0].text).replace(/36%/, '')), 'الحجب العام يبتلع الاسم اللاتيني المجهول')
  assert.equal(classify('AI'), 'لاتيني غير محجوب', 'صمام اللاتيني الأخير يصنف صحيحاً')
  assert.ok(has('36%') || has('أرقام'), 'الأرقام الخام تُرصد — لغم 36% الحقيقي في المتن')
  assert.ok(has('مسؤوليتنا'), 'الهمزة الوسطية الجديدة تُرصد')
  assert.ok(has('البرقعي'), 'القاف الجديدة تُرصد')
  assert.ok(has('علق'), 'جذع علق متعدد المعاني يُعلَّم للمراجعة دائماً')
  assert.ok(has('بان'), 'الجذر الدلالي يُرصد من المصدر قبل أن يخفيه معجم النطق')
  assert.ok(has('شنطرة'), 'الكلمة الجديدة بريئة الشكل تُرصد أيضاً — درس «بعدين» و«شغل»')
  /* والنقيض: مداخلة من المتن المعتمد نفسه تمر بلا رصد */
  const clean = scanTurns([{ text: 'وهني بالضبط السؤال اللي يهم.' }], vocab)
  assert.equal(clean.filter((x) => !x.cls.includes('متعدد المعاني')).length, 0, 'المتن المعتمد لا يُرصد كجديد')
  /* [٢١ أغسطس ٢٠٢٦ متأخراً] عطب «انزياح إذن الاستبدال» وقع مرتين رغم
     التعليق التحذيري: أي خطوةٍ تُحشر بين fetch وكتلة بيئته تسحب
     PODCAST_KW_REGENERATE منها فيسقط التوليد عند «awaiting_approval»
     مهما مرّرتَ regenerate (تشغيلتا العطب: قديمة موثقة + 32521445188).
     التعليق لا يمنع؛ الفاحص يمنع. */
  const wf = readFileSync(resolve(ROOT, '.github/workflows/podcast-kuwaiti-pilot.yml'), 'utf8')
  const fetchBlock = wf.split(/- name: /).find((b) => b.startsWith('Lock the exact Kuwaiti admin dialogue'))
  assert.ok(fetchBlock && fetchBlock.includes('PODCAST_KW_REGENERATE'),
    'إذن الاستبدال يركب خطوة fetch نفسها — انزاح مرتين حين حُشرت خطوة بينها وبين بيئتها')
  console.log('✓ حارس الكلمات الجديدة: الفحص الذاتي 9/9 — كل صنف مزروع يُمسك، والمعتمد يمر، وإذن الاستبدال في موضعه')
  process.exit(0)
}

const vocab = buildVocabulary()
if (LIBRARY) {
  const library = JSON.parse(readFileSync(resolve(ROOT, LIBRARY), 'utf8'))
  let findings = []
  for (const turns of Object.values(library.episodes || {})) {
    findings = findings.concat(scanTurns(Object.values(turns), vocab, { isNewDialogue: true }))
  }
  report(findings)
  process.exit(findings.length && !ALLOW ? 1 : 0)
}

const dir = resolve(ROOT, DIR)
if (!existsSync(dir)) {
  console.log('ℹ لا مجلد حوارات مجلوبة (' + DIR + ') — الحارس يعمل في الورشة بعد خطوة الجلب.')
  process.exit(0)
}
const seedSlugs = new Set(Object.keys(JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8')).episodes))
let all = []
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(resolve(dir, file), 'utf8'))
  const turns = Array.isArray(data) ? data : Object.values(data.turns || data)
  /* حوار من المتن المعتمد: مواضع المعاني المتعددة فيه رُوجعت يدوياً؛
     الحوار الجديد وحده يخضع للفحص الكامل. */
  const isNewDialogue = !seedSlugs.has(file.replace(/\.json$/, ''))
  all = all.concat(scanTurns(turns, vocab, { isNewDialogue }))
}
report(all)
process.exit(all.length && !ALLOW ? 1 : 0)
