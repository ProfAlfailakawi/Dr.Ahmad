#!/usr/bin/env node
/**
 * مصنع تكثيف الحوارات الكويتية — من الحلقة الكاملة إلى دقيقتين ونصف.
 *
 * قرار الدكتور (٢٢ أغسطس ٢٠٢٦): «النصوص الآن نبدلها بالكامل وليس توليد» —
 * القالب القصير هو الأجمل للناس (بوابة للمقال لا بديلاً عنه) والأسلم
 * للمحرك (ينتهي قبل أفق الانجراف المقيس ~دقيقتين).
 *
 * العقد الصارم:
 *  - لا سطر يُكتب من عندي: الانتقاء من مداخلات الدكتور المدققة حرفياً.
 *    التدخل الوحيد المسموح: نزع واو عطف يتيمة أول مداخلة سبقها حذف —
 *    ويُسجل في التقرير.
 *  - البنية تُحفظ: مشهد الافتتاح → السؤال المحوري → دليل → اعتراض ورد →
 *    قلب → خاتمة وإحالة. وجسر موسيقي واحد قرب المنتصف.
 *  - كل حلقة مكثفة تعبر بوابة اللهجة نفسها (≥15 مداخلة، كثافة كويتية،
 *    لا فصحى محرمة) وإلا وُسمت للمراجعة اليدوية.
 *  - الناتج ملف موازٍ (kuwaiti-dialogues-short.json) — البذرة الأصلية
 *    لا تُمس حتى يعتمد الدكتور العينات ويقول «بدّل».
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const SEC_PER_CHAR = 0.083           /* مقيسة من الحلقة المعتمدة: ~2900 حرفاً في ~240ث كلام */
const TARGET_SEC = 150               /* دقيقتان ونصف */
const MIN_TURNS = 15                 /* حد بوابة verify-kuwaiti-dialogues */
const MAX_TURNS = 28

const EVIDENCE = /دراسة|بحث|تقرير|بالمئة|بالمية|جامعة|منظمة|مجلة|إحصائ|أرقام|نسبة/
const KW_MARKERS = ['مو','هني','شنو','شلون','الحين','وايد','ماكو','تبي','ترى','إي','بس','قاعد','هال','ليش','وين','إحنا','عشان','جذي','راح','نبي','نقدر','اللي']


/* ═══ كاشف المراجع المعلّقة (مراجعة الصديق الخبير، ٢٢ أغسطس ٢٠٢٦) ═══
   شخّص العيب الحقيقي: «تصريح قبول مؤقت… صج، هذي كلمة تلخص» بقيت،
   والدور الذي قدّم العبارة (٢٣) حُذف — فالمستمع يحس أن مقطعاً طاح.
   الخطر ليس ضياع المعلومة بل بقاء: اقتباسٍ لعبارةٍ محذوفة · جوابٍ بلا
   سؤال · ضميرٍ بلا مرجع · تكرارٍ صار متلاصقاً.
   والعلاج داخل عقد المشروع: **يُجَرّ الدور المُقدِّم من الأصل**، لا
   يُكتب سطرٌ جديد — فتبقى كل كلمة من كلام الدكتور. */
const STOP = new Set(['من','في','على','إلى','عن','مع','بس','مو','هذا','هذي','هالشي','اللي','إن','أن','لا','ما','هو','هي','إي','يعني','ترى','كل','لو','إذا','بعد','قبل','عشان','لأن','صار','صارت','كان','وايد','شي','بين','عند','له','لها','لهم','أو','ثم','حتى','قد','هني','جذي','نحن','إحنا','انت','أنت'])
const words = (t) => String(t || '').replace(/[^\u0621-\u064A\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
/* عبارات مميزة: ثنائيات وثلاثيات من كلمات المعنى — أقوى إشارة للاقتباس */
function phrasesOf (text) {
  const w = words(text); const out = []
  for (let i = 0; i + 1 < w.length; i += 1) out.push(w[i] + ' ' + w[i + 1])
  for (let i = 0; i + 2 < w.length; i += 1) out.push(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2])
  return out
}
const ANSWER_OPENERS = /^(إي|اي|لا|صح|أكيد|أكيد،|بالضبط|صج|تماما|تمام|طبعا)\b/
const BACKREF_OPENERS = /^(و?هذا|و?هذي|و?هالشي|و?هالكلام|و?هو|و?هي|و?هم|و?هني|و?جذي|و?نفسه|و?نفسها)\b/

/** يرصد مواضع التعليق ويعيد اقتراح جرٍّ لكل موضع (دور الأصل المُقدِّم). */
export function danglingRefs (turns, keptIdx) {
  const kept = new Set(keptIdx)
  const issues = []
  /* خريطة: أول ظهورٍ لكل عبارة مميزة في الأصل */
  const firstAt = new Map()
  const firstWordAt = new Map()
  const freq = new Map()
  turns.forEach((t, i) => {
    for (const ph of phrasesOf(t.text)) if (!firstAt.has(ph)) firstAt.set(ph, i)
    for (const w of words(t.text)) { freq.set(w, (freq.get(w) || 0) + 1); if (!firstWordAt.has(w)) firstWordAt.set(w, i) }
  })

  for (const i of keptIdx) {
    const prevOriginal = i - 1
    const prevKept = keptIdx.filter((k) => k < i).pop()
    const cutBefore = prevOriginal >= 0 && !kept.has(prevOriginal)

    /* ١) اقتباسٌ معلّق — بإشارتين، لأن الاقتباس نادراً ما يكون حرفياً:
       (أ) عبارةٌ مميزة أول ظهورها في دورٍ محذوف؛
       (ب) **كلمةٌ نادرة** (≤٣ مرات في الحلقة) أول ظهورها في دورٍ محذوفٍ
           قريب — وهذه هي التي تمسك «تصريح مؤقت ← تصريح قبول مؤقت»،
           والحرفيةُ وحدها كانت تفوتها (شخّصها الصديق بأذنه لا بالآلة). */
    let flagged = false
    for (const ph of phrasesOf(turns[i].text)) {
      const src = firstAt.get(ph)
      if (src === undefined || src >= i || kept.has(src)) continue
      if (keptIdx.some((k) => k < i && phrasesOf(turns[k].text).includes(ph))) continue
      issues.push({ at: i, kind: 'اقتباس معلّق', phrase: ph, pull: src })
      flagged = true
      break
    }
    if (!flagged) {
      for (const w of words(turns[i].text)) {
        if ((freq.get(w) || 0) > 3) continue
        const src = firstWordAt.get(w)
        if (src === undefined || src >= i || kept.has(src) || i - src > 4) continue
        if (keptIdx.some((k) => k < i && words(turns[k].text).includes(w))) continue
        issues.push({ at: i, kind: 'كلمة نادرة بلا تقديم', phrase: w, pull: src })
        break
      }
    }

    /* ٢) جوابٌ بلا سؤال: مداخلةٌ تبدأ بأداة تصديق وسؤالُها محذوف */
    if (cutBefore && ANSWER_OPENERS.test(String(turns[i].text).trim())) {
      const q = turns.slice(0, i).map((t, k) => ({ t, k })).reverse()
        .find(({ t }) => t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text)))
      if (q && !kept.has(q.k)) issues.push({ at: i, kind: 'جواب بلا سؤال', pull: q.k })
    }

    /* ٣) ضميرٌ أو إشارةٌ بلا مرجع: تبدأ بعائدٍ وسابقها الأصلي محذوف */
    if (cutBefore && BACKREF_OPENERS.test(String(turns[i].text).trim())) {
      issues.push({ at: i, kind: 'إشارة بلا مرجع', pull: prevOriginal })
    }

    /* ٤) تكرارٌ متلاصق — **بشرط أن يكون من صنع التكثيف**: إن كان
       الدوران متجاورَين في الأصل فالتكرار أسلوبُ الدكتور نفسه (سطرٌ
       قصيرٌ ثم بسطه: «جيل عدى سنين.» / «جيل عدى سنين دراسية كاملة…»)،
       ولا يُوسم. يُوسم فقط ما قرّب بينهما الحذف. */
    if (prevKept !== undefined && prevKept !== i - 1) {
      const shared = phrasesOf(turns[i].text).filter((ph) => ph.split(' ').length === 3 && phrasesOf(turns[prevKept].text).includes(ph))
      if (shared.length) issues.push({ at: i, kind: 'تكرار متلاصق', phrase: shared[0], pull: null })
    }
  }
  return issues
}

const durOf = (t) => String(t.text || '').length * SEC_PER_CHAR + (Number(t.pauseAfterMs) || 560) / 1000

export function condenseEpisode(turns) {
  const n = turns.length
  const flags = []
  const picked = new Set()
  const pick = (i) => { if (i >= 0 && i < n) picked.add(i) }

  /* ١) مشهد الافتتاح: من البداية حتى أول سؤال (بحد ٥ مداخلات) —
     «البداية دايماً روووعة» بشهادة الدكتور، فتُحفظ كاملة. */
  let firstQ = turns.findIndex((t) => t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text)))
  if (firstQ < 0 || firstQ > 5) firstQ = Math.min(5, n - 1)
  for (let i = 0; i <= firstQ; i += 1) pick(i)

  /* ٢) السؤال المحوري: أول سؤالٍ بعد الافتتاح وجوابه المباشر. */
  const pivot = turns.findIndex((t, i) => i > firstQ && (t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text))))
  if (pivot > 0) { pick(pivot); pick(pivot + 1) }

  /* ٣) الدليل: أول مداخلة دليلٍ علمي (وثانية إن اتسع الوقت لاحقاً). */
  const evidence = turns.map((t, i) => ({ i, t })).filter(({ t, i }) => i > firstQ && EVIDENCE.test(String(t.text)))
  if (evidence.length) pick(evidence[0].i)

  /* ٤) الاعتراض ورده — القسم الذي «يعطي الحوار صدقه» بحكم الدكتور. */
  const obj = turns.findIndex((t) => ['gentleObjection', 'objection'].includes(t.deliveryType))
  if (obj > 0) { pick(obj); pick(obj + 1) }

  /* ٥) القلب: تأمل أو تأكيد في الثلث الأخير قبل الخاتمة. */
  const flip = turns.map((t, i) => ({ i, t }))
    .filter(({ i, t }) => i > n * 0.55 && i < n - 3 && ['reflection', 'emphasis'].includes(t.deliveryType))
  if (flip.length) pick(flip[flip.length - 1].i)

  /* ٦) الخاتمة والإحالة: آخر ثلاث مداخلات — وإن كانت مداخلة الإحالة
     (تلقى المقال في موقع الدكتور) أبعد من ذلك تُلتقط هي وما بعدها،
     فلا تفقد أي حلقة إحالتها (وقعت مرة واحدة في 144). */
  let refIdx = -1
  for (let i = n - 1; i >= Math.max(0, n - 6); i -= 1) {
    if (/المقال|موقع الدكتور|الفيل/.test(String(turns[i].text))) { refIdx = i; break }
  }
  const tailStart = refIdx >= 0 ? Math.min(refIdx, n - 3) : n - 3
  for (let i = Math.max(0, tailStart); i < n; i += 1) pick(i)

  /* ٧) ملء الميزانية حتى الهدف: أقرب المداخلات للمنتقى (سياقاً) أولاً. */
  const budget = () => [...picked].reduce((s, i) => s + durOf(turns[i]), 0)
  let guard = 0
  while (budget() < TARGET_SEC - 8 && picked.size < MAX_TURNS && guard++ < n) {
    let best = -1; let bestScore = -1
    for (let i = 0; i < n; i += 1) {
      if (picked.has(i)) continue
      const near = (picked.has(i - 1) ? 2 : 0) + (picked.has(i + 1) ? 2 : 0)
      const typeBonus = t2s(turns[i].deliveryType)
      const score = near + typeBonus - (turns[i].deliveryType === 'briefReaction' ? 1 : 0)
      if (score > bestScore) { bestScore = score; best = i }
    }
    if (best < 0) break
    pick(best)
  }
  function t2s (dt) { return { reflection: 2, emphasis: 2, question: 1, statement: 1, briefReaction: 0, conclusion: 0 }[dt] ?? 1 }

  /* ٨) والعكس: إن فاضت الميزانية تُنزع أقل المداخلات مركزيةً (لا افتتاح ولا خاتمة). */
  while ((budget() > TARGET_SEC + 15 || picked.size > MAX_TURNS) && picked.size > MIN_TURNS) {
    const removable = [...picked].filter((i) => i > firstQ && i < n - 3 && i !== pivot)
      .sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
    if (!removable.length) break
    picked.delete(removable[0])
  }

  /* ٨.٥) إصلاح المراجع المعلّقة — بجرّ الدور المُقدِّم من الأصل (مراجعة
     الصديق). دورةٌ متكررة: الدور المجرور قد يحمل تعليقاً بدوره. وحين
     يفيض الوقت نضحّي بمداخلةٍ منخفضة المركزية لا بالسياق — لأن الفهم
     أهم من ثوانٍ معدودة. */
  let repairRounds = 0
  for (;;) {
    const idxNow = [...picked].sort((a, b) => a - b)
    const issues = danglingRefs(turns, idxNow).filter((x) => x.pull !== null && !picked.has(x.pull))
    if (!issues.length || repairRounds++ >= 6) break
    for (const x of issues) {
      pick(x.pull)
      flags.push(`${x.kind} في مداخلة ${x.at}${x.phrase ? ` («${x.phrase}»)` : ''} — جُرّ الدور ${x.pull} من الأصل`)
    }
    /* توازن الميزانية بعد الجرّ: تُنزع الأقل مركزيةً وحدها */
    while (budget() > TARGET_SEC + 18 && picked.size > MIN_TURNS) {
      const removable = [...picked]
        .filter((i) => i > firstQ && i < tailStart && i !== pivot && !issues.some((x) => x.pull === i || x.at === i))
        .sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
      if (!removable.length) break
      picked.delete(removable[0])
    }
  }
  /* ما بقي معلّقاً بلا إصلاح ممكن (تكرار متلاصق مثلاً) يُوسم لعينه. */
  for (const x of danglingRefs(turns, [...picked].sort((a, b) => a - b))) {
    if (x.pull === null || picked.has(x.pull)) {
      if (x.kind === 'تكرار متلاصق') flags.push(`${x.kind} («${x.phrase}») في مداخلة ${x.at} — نظرٌ يدوي`)
    }
  }

  /* ٩) التجميع + إصلاح الواو اليتيمة + الجسر الواحد. */
  const idx = [...picked].sort((a, b) => a - b)
  const out = idx.map((i) => ({ ...turns[i] }))
  idx.forEach((orig, k) => {
    if (k > 0 && idx[k - 1] !== orig - 1) {
      const txt = String(out[k].text)
      if (/^و[^ا]/.test(txt)) { out[k].text = txt.slice(1); flags.push(`واو يتيمة نُزعت في مداخلة ${orig}`) }
      else if (/^(بس |يعني |عشان جذي|ولهذا|فهني)/.test(txt)) flags.push(`رابط بعد قطع في مداخلة ${orig} — راجع السياق`)
      if (/هالشي|هذا اللي|هاللي/.test(txt.slice(0, 20)) && k > 0) flags.push(`إشارة بعد قطع في مداخلة ${orig} — راجع المرجع`)
    }
  })
  let acc = 0; let bridgeAt = -1
  const total = out.reduce((s, t) => s + durOf(t), 0)
  /* [٢٢ أغسطس] حكمه على التسعة: «كلهم بعد دقيقة و٢٠ ثانية — بسبب عدم
     وجود جسر — إماراتي وحساوي». فالجسر يجب أن يسبق الثانية ٨٠ دائماً،
     لا أن يقع عند منتصفٍ نسبيّ قد يتجاوزها في الحلقات الأطول. */
  const BRIDGE_BY = 68
  out.forEach((t, k) => { t.musicBridgeAfter = false; acc += durOf(t); if (bridgeAt < 0 && (acc >= Math.min(total * 0.45, BRIDGE_BY)) && k < out.length - 3) bridgeAt = k })
  if (bridgeAt > 0) out[bridgeAt].musicBridgeAfter = true

  /* ١٠) بوابة اللهجة على المكثف. */
  const text = out.map((t) => t.text).join(' ')
  const hits = KW_MARKERS.reduce((s, m) => s + text.split(m).length - 1, 0)
  if (hits / out.length < 0.22) flags.push('كثافة كويتية دون العتبة — مراجعة يدوية')
  if (out.length < MIN_TURNS) flags.push('أقل من ١٥ مداخلة')
  if (new Set(out.map((t) => t.speaker)).size < 2) flags.push('متحدث واحد!')
  if (!/الفيل|موقع الدكتور/.test(String(out[out.length - 1].text))) flags.push('الخاتمة بلا إحالة الموقع — راجع')

  return { turns: out, flags, estSec: Math.round(total), kept: out.length, from: n }
}

if (SELF_TEST) {
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  const pilot = Object.values(lib.episodes['success-that-does-not-bring-joy-to-its-ownerarabic'])
  const r = condenseEpisode(pilot)
  assert.ok(r.kept >= MIN_TURNS && r.kept <= MAX_TURNS, `عدد المداخلات ${r.kept} خارج [15,28]`)
  assert.ok(r.estSec >= 120 && r.estSec <= 180, `المدة المقدرة ${r.estSec} خارج [120,180]`)
  assert.equal(r.turns[0].text, pilot[0].text, 'الافتتاح محفوظ حرفياً')
  assert.ok(/الفيل/.test(r.turns[r.kept - 1].text), 'الإحالة الختامية محفوظة')
  assert.equal(r.turns.filter((t) => t.musicBridgeAfter).length, 1, 'جسر واحد بالضبط')
  const src = new Set(pilot.map((t) => t.text))
  assert.ok(r.turns.every((t) => src.has(t.text) || src.has('و' + t.text)), 'كل سطرٍ من متن الدكتور حرفياً (عدا واو منزوعة)')
  console.log(`✓ مصنع التكثيف: التجربة ${r.from}→${r.kept} مداخلة · ~${r.estSec}ث · جسر واحد · كل السطور أصلية`)
  process.exit(0)
}

/* التنفيذ المباشر وحده يشغّل المصنع — الاستيراد للفحص لا يكتب شيئاً. */
const RUN_MAIN = process.argv[1] && process.argv[1].endsWith('condense-kuwaiti-dialogues.mjs')
if (!RUN_MAIN) { /* مستورد: لا شيء */ } else {
const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
const short = { schemaVersion: lib.schemaVersion, profile: lib.profile, count: 0, pilotSlug: lib.pilotSlug, note: 'نسخة الدقيقتين والنصف — مكثفة من نصوص الدكتور المدققة حرفياً (٢٢ أغسطس ٢٠٢٦)؛ الأصل الكامل محفوظ في kuwaiti-dialogues.json', episodes: {}, review: lib.review }
const report = []
for (const [slug, ep] of Object.entries(lib.episodes)) {
  const r = condenseEpisode(Object.values(ep))
  short.episodes[slug] = Object.fromEntries(r.turns.map((t, i) => [String(i), t]))
  report.push({ slug, from: r.from, kept: r.kept, estSec: r.estSec, flags: r.flags })
}
short.count = Object.keys(short.episodes).length
writeFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json'), JSON.stringify(short, null, 1) + '\n')
writeFileSync(resolve(ROOT, 'podcast-audits/condense-report.json'), JSON.stringify(report, null, 1) + '\n')
const flagged = report.filter((r) => r.flags.length)
console.log(`✓ كُثفت ${short.count} حلقة → kuwaiti-dialogues-short.json`)
console.log(`  متوسط: ${Math.round(report.reduce((s, r) => s + r.estSec, 0) / report.length)}ث · موسومة للمراجعة: ${flagged.length}`)
}
