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
 *    قلب → خاتمة وإحالة. وجسران موسيقيان يقسمانها ثلاثة فصول قصيرة.
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
const MAX_TURNS = 32

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
/* [٢٢ أغسطس] فواتح الاستئناف: مداخلةٌ تبدأ بـ«إن» أو «لأن» ليست جملةً
   قائمة بذاتها بل تكملةُ ما قبلها («عندهم رأي ثاني.» / «إن هالذبذبات…»)
   — فإن حُذف سابقها صار الكلام معلّقاً. رُصدت في موضعين من ١٤٤. */
const CONTINUATION_OPENERS = /^(إن|أن|لأن|لأنه|لأنها)\s/
const BACKREF_OPENERS = /^(و?هذا|و?هذي|و?هالشي|و?هالكلام|و?هو|و?هي|و?هم|و?هني|و?جذي|و?نفسه|و?نفسها)\b/

/** يرصد مواضع التعليق ويعيد اقتراح جرٍّ لكل موضع (دور الأصل المُقدِّم). */
export function danglingRefs (turns, keptIdx) {
  const kept = new Set(keptIdx)
  const issues = []

  for (const i of keptIdx) {
    const prevOriginal = i - 1
    const prevKept = keptIdx.filter((k) => k < i).pop()
    const cutBefore = prevOriginal >= 0 && !kept.has(prevOriginal)

    /* لا تُعامل إعادةُ المصطلح أو الفكرة كمرجعٍ معلّق؛ هذا صنع سلاسل
       إجبارية طويلة في المقالات القديمة. المرجع الحقيقي تمسكه الفواتح
       الصريحة أدناه: جواب بلا سؤال، تكملة، أو «هذا/هذي» بعد قطع. */

    /* ٢) جوابٌ بلا سؤال: مداخلةٌ تبدأ بأداة تصديق وسؤالُها محذوف */
    if (cutBefore && ANSWER_OPENERS.test(String(turns[i].text).trim())) {
      const q = turns.slice(0, i).map((t, k) => ({ t, k })).reverse()
        .find(({ t }) => t.deliveryType === 'question' || /[؟?]\s*$/.test(String(t.text)))
      if (q && !kept.has(q.k)) issues.push({ at: i, kind: 'جواب بلا سؤال', pull: q.k })
    }

    /* ٣ب) فاتحة استئناف بلا ما تستأنفه */
    if (cutBefore && CONTINUATION_OPENERS.test(String(turns[i].text).trim())) {
      issues.push({ at: i, kind: 'تكملة بلا مبتدأ', pull: prevOriginal })
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

/* «الروح» ليست عداد كلمات كويتية. إذا حذفنا رد الطرف الثاني بين
   مداخلتين بقي المتحدث نفسه ثلاث أو خمس مرات ورا بعض، فيطلع الصوت كأن
   اثنين يقرون من ورقة. هذان المقياسان يحميان الأخذ والرد نفسه. */
const contentWords = (text) => String(text || '')
  .replace(/[^ء-يچپڤگ\s]/gu, ' ')
  .split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))

function isSeedEcho (first, second) {
  if (!first || !second || first.speaker !== second.speaker) return false
  const a = contentWords(first.text)
  const b = new Set(contentWords(second.text))
  if (!a.length || a.length > 8) return false
  const shared = a.filter((w) => b.has(w)).length
  return shared / a.length >= 0.72
}

function longestSpeakerRun (turns) {
  let longest = 0; let current = 0; let last = null
  for (const turn of turns) {
    current = turn.speaker === last ? current + 1 : 1
    longest = Math.max(longest, current)
    last = turn.speaker
  }
  return longest
}

export function condenseEpisode(turns) {
  const n = turns.length
  const flags = []
  const notes = []
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

  /* لحظة مقاطعة/رد سريع واحدة على الأقل إن كانت موجودة في الأصل. هذه
     ليست زينة صوتية: هي العلامة التي تمنع الحوار من التحول إلى قراءتين. */
  const lively = turns.map((t, i) => ({ i, t }))
    .filter(({ i, t }) => i > firstQ && i < n - 3 && Number(t.overlapMs) > 0)
    .sort((a, b) => {
      const quality = ({ i, t }) =>
        (!isSeedEcho(t, turns[i + 1]) ? 6 : 0) +
        (turns[i + 1] && t.speaker !== turns[i + 1].speaker ? 3 : 0) +
        (['question', 'gentleObjection', 'objection'].includes(t.deliveryType) ? 2 : 0)
      return quality(b) - quality(a)
    })[0]?.i ?? -1
  const livelyTurns = new Set()
  if (lively > 0) {
    pick(lively); livelyTurns.add(lively)
    pick(lively + 1); livelyTurns.add(lively + 1)
  }

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
      const ordered = [...picked].sort((a, b) => a - b)
      const left = ordered.filter((k) => k < i).pop()
      const right = ordered.find((k) => k > i)
      const near = (picked.has(i - 1) ? 2 : 0) + (picked.has(i + 1) ? 2 : 0)
      const exchange = (left === undefined || turns[left].speaker !== turns[i].speaker ? 2 : -3) +
        (right === undefined || turns[right].speaker !== turns[i].speaker ? 2 : -3)
      const typeBonus = t2s(turns[i].deliveryType)
      const lifeBonus = (turns[i].deliveryType === 'briefReaction' ? 2 : 0) + (Number(turns[i].overlapMs) > 0 ? 2 : 0)
      const score = near + exchange + typeBonus + lifeBonus
      if (score > bestScore) { bestScore = score; best = i }
    }
    if (best < 0) break
    pick(best)
  }
  function t2s (dt) { return { reflection: 2, emphasis: 2, question: 1, statement: 1, briefReaction: 0, conclusion: 0 }[dt] ?? 1 }

  /* ٨) والعكس: إن فاضت الميزانية تُنزع أقل المداخلات مركزيةً (لا افتتاح ولا خاتمة). */
  while ((budget() > TARGET_SEC + 15 || picked.size > MAX_TURNS) && picked.size > MIN_TURNS) {
    const removable = [...picked].filter((i) => i > firstQ && i < n - 3 && i !== pivot && !livelyTurns.has(i))
      .sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
    if (!removable.length) break
    picked.delete(removable[0])
  }

  /* ٨.٥) إصلاح المراجع المعلّقة — بجرّ الدور المُقدِّم من الأصل (مراجعة
     الصديق). دورةٌ متكررة: الدور المجرور قد يحمل تعليقاً بدوره. وحين
     يفيض الوقت نضحّي بمداخلةٍ منخفضة المركزية لا بالسياق — لأن الفهم
     أهم من ثوانٍ معدودة. */
  let repairRounds = 0
  /* الأدوار المجرورة تُحمى من الموازنة اللاحقة — بلا هذا يُدهس جرُّ
     الجولة الأولى في ميزانية الجولة الثانية فيعود التعليق (٣ مواضع). */
  const protectedPulls = new Set()
  for (;;) {
    const idxNow = [...picked].sort((a, b) => a - b)
    const issues = danglingRefs(turns, idxNow).filter((x) => x.pull !== null && !picked.has(x.pull))
    if (!issues.length || repairRounds++ >= 6) break
    for (const x of issues) {
      pick(x.pull)
      protectedPulls.add(x.pull)
      protectedPulls.add(x.at)
      notes.push(`${x.kind} في مداخلة ${x.at}${x.phrase ? ` («${x.phrase}»)` : ''} — جُرّ الدور ${x.pull} من الأصل`)
    }
    /* توازن الميزانية بعد الجرّ: تُنزع الأقل مركزيةً وحدها */
    while (budget() > TARGET_SEC + 18 && picked.size > MIN_TURNS) {
      const removable = [...picked]
        .filter((i) => i > firstQ && i < tailStart && i !== pivot && !protectedPulls.has(i) && !livelyTurns.has(i))
        .sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
      if (!removable.length) break
      picked.delete(removable[0])
    }
  }
  /* ما بقي معلّقاً بلا إصلاح ممكن (تكرار متلاصق مثلاً) يُوسم لعينه. */
  for (const x of danglingRefs(turns, [...picked].sort((a, b) => a - b))) {
    if (x.pull === null || picked.has(x.pull)) {
      if (x.kind === 'تكرار متلاصق') notes.push(`${x.kind} («${x.phrase}») في مداخلة ${x.at} — تكرار أطروحة لا مرجع مفقود`)
    }
  }

  /* ٨.٧) استرجاع روح الأخذ والرد.
     أ) السطر البذرة إذا أعاده المتحدث نفسه موسعا بعده يُحذف من النسخة
        القصيرة وحدها؛ الأصل الكامل يبقى محفوظا.
     ب) إذا صار المتحدث نفسه على جانبي فجوة حذف، نرجع أفضل رد للطرف
        الثاني من داخل الفجوة بدل اختراع «إي» و«صح» آليتين. */
  let soulChanged = true; let soulRounds = 0
  const soulPulls = new Set()
  const overlapTransfers = new Map()
  while (soulChanged && soulRounds++ < n) {
    soulChanged = false
    let selected = [...picked].sort((a, b) => a - b)
    for (let k = 0; k + 1 < selected.length; k += 1) {
      const a = selected[k]; const b = selected[k + 1]
      if (b === a + 1 && isSeedEcho(turns[a], turns[b]) && picked.size > MIN_TURNS) {
        if (livelyTurns.has(a)) {
          overlapTransfers.set(b, Math.max(Number(turns[a].overlapMs) || 0, Number(turns[b].overlapMs) || 0, 80))
          livelyTurns.delete(a); livelyTurns.add(b)
        }
        picked.delete(a)
        notes.push(`روح الحوار: حُذفت بذرة مكررة في مداخلة ${a}`)
        soulChanged = true
        break
      }
    }
    if (soulChanged) continue

    selected = [...picked].sort((a, b) => a - b)
    for (let k = 0; k + 1 < selected.length; k += 1) {
      const a = selected[k]; const b = selected[k + 1]
      if (turns[a].speaker !== turns[b].speaker || b === a + 1) continue
      const counter = []
      for (let i = a + 1; i < b; i += 1) {
        if (picked.has(i) || turns[i].speaker === turns[a].speaker) continue
        const score = (turns[i].deliveryType === 'briefReaction' ? 5 : 0) +
          (['question', 'gentleObjection', 'objection'].includes(turns[i].deliveryType) ? 3 : 0) +
          (Number(turns[i].overlapMs) > 0 ? 3 : 0) - Math.min(i - a, b - i) * 0.05
        counter.push({ i, score })
      }
      counter.sort((x, y) => y.score - x.score)
      if (counter.length) {
        pick(counter[0].i)
        soulPulls.add(counter[0].i)
        notes.push(`روح الحوار: جُرّ رد الطرف الثاني من مداخلة ${counter[0].i}`)
        soulChanged = true
        break
      }
    }
  }

  /* ردود الروح محمية. إن زادت المدة، نحذف مداخلة منخفضة المركزية فقط
     إذا كان حذفها لا يلصق صوتين متشابهين من جديد. */
  let soulBalance = 0
  while (budget() > TARGET_SEC + 20 && picked.size > MIN_TURNS && soulBalance++ < n) {
    const selected = [...picked].sort((a, b) => a - b)
    const removable = selected.filter((i, k) => {
      if (i <= firstQ || i >= tailStart || i === pivot || protectedPulls.has(i) || soulPulls.has(i) || livelyTurns.has(i)) return false
      const left = selected[k - 1]; const right = selected[k + 1]
      return left === undefined || right === undefined || turns[left].speaker !== turns[right].speaker
    }).sort((a, b) => t2s(turns[a].deliveryType) - t2s(turns[b].deliveryType))
    if (!removable.length) break
    picked.delete(removable[0])
  }

  /* موازنة أخيرة بالمعنى لا بعدد الأدوار: بعض المقالات القديمة أدوارها
     قصيرة جداً وبعضها طويلة. نملأ ما دون ~دقيقتين و10، ونقص ما فوق
     ثلاث دقائق، بشرط ألا نصنع ثلاثة أدوار للصوت نفسه أو مرجعاً معلقاً. */
  let finalFill = 0
  while (budget() < 130 && picked.size < 36 && finalFill++ < n) {
    let best = null
    for (let i = 0; i < n; i += 1) {
      if (picked.has(i)) continue
      const trial = [...picked, i].sort((a, b) => a - b)
      if (longestSpeakerRun(trial.map((k) => turns[k])) > 2) continue
      const pos = trial.indexOf(i); const left = trial[pos - 1]; const right = trial[pos + 1]
      const score = (left === i - 1 ? 2 : 0) + (right === i + 1 ? 2 : 0) +
        (turns[i].deliveryType === 'briefReaction' ? 4 : 0) + (Number(turns[i].overlapMs) > 0 ? 3 : 0) + t2s(turns[i].deliveryType)
      if (!best || score > best.score) best = { i, score }
    }
    if (!best) break
    pick(best.i); notes.push(`المدة: أُعيد دور ${best.i} ليبقى المكثف قريباً من دقيقتين ونصف`)
  }

  let finalTrim = 0
  while ((budget() > 180 || picked.size > MAX_TURNS) && picked.size > MIN_TURNS && finalTrim++ < n) {
    const selected = [...picked].sort((a, b) => a - b)
    const removable = selected.map((i) => {
      if (i <= firstQ || i >= tailStart || i === pivot || protectedPulls.has(i) || livelyTurns.has(i)) return null
      const trial = selected.filter((k) => k !== i)
      if (longestSpeakerRun(trial.map((k) => turns[k])) > 2) return null
      const unresolved = danglingRefs(turns, trial).some((x) => x.pull !== null && !trial.includes(x.pull))
      if (unresolved) return null
      return { i, score: t2s(turns[i].deliveryType) * 10 - durOf(turns[i]) }
    }).filter(Boolean).sort((a, b) => a.score - b.score)
    if (!removable.length) break
    picked.delete(removable[0].i); notes.push(`المدة: حُذف دور ${removable[0].i} بلا كسر الأخذ والرد`)
  }

  /* لأن الموازنة نفسها قد تحذف مقدمةَ إشارة، تُعاد بوابة المراجع في آخر
     لحظة. ما يُجر هنا يُحمى ولا تمسه أي موازنة لاحقة. */
  let finalRepair = 0
  while (finalRepair++ < 6) {
    const selected = [...picked].sort((a, b) => a - b)
    const issues = danglingRefs(turns, selected).filter((x) => x.pull !== null && !picked.has(x.pull))
    if (!issues.length) break
    for (const x of issues) {
      pick(x.pull); protectedPulls.add(x.pull); protectedPulls.add(x.at)
      notes.push(`فحص أخير: ${x.kind} في ${x.at} — جُرّ الدور ${x.pull}`)
    }
  }

  /* ٩) التجميع + إصلاح الواو اليتيمة + الجسر الواحد. */
  const idx = [...picked].sort((a, b) => a - b)
  const out = idx.map((i) => ({ ...turns[i] }))
  idx.forEach((orig, k) => {
    if (overlapTransfers.has(orig)) out[k].overlapMs = overlapTransfers.get(orig)
  })
  idx.forEach((orig, k) => {
    if (k > 0 && idx[k - 1] !== orig - 1) {
      const txt = String(out[k].text)
      if (/^و[^ا]/.test(txt)) { out[k].text = txt.slice(1); notes.push(`واو يتيمة نُزعت في مداخلة ${orig}`) }
      else if (/^(بس |يعني |عشان جذي|ولهذا|فهني)/.test(txt)) notes.push(`رابط محكي بعد قطع في مداخلة ${orig} — فُحص سياقه`)
      if (/هالشي|هذا اللي|هاللي/.test(txt.slice(0, 20)) && k > 0) notes.push(`إشارة بعد قطع في مداخلة ${orig} — فُحص مرجعها`)
    }
  })

  /* إذا لم يبقَ تداخلٌ من الأصل، نضيف تداخلاً مونتاجياً خفيفاً (90ms)
     إلى رد/سؤال قائم فعلاً. لا نؤلف ضحكة ولا كلمة؛ نغيّر التوقيت فقط. */
  if (!out.some((t) => Number(t.overlapMs) > 0)) {
    const overlapAt = out.findIndex((t, k) => k > 1 && k < out.length - 3 &&
      ['briefReaction', 'gentleObjection', 'objection', 'question'].includes(t.deliveryType) &&
      t.speaker !== out[k - 1].speaker)
    if (overlapAt > 0) {
      out[overlapAt].overlapMs = 90
      notes.push(`روح الحوار: تداخل مونتاجي خفيف على المداخلة المختارة ${idx[overlapAt]}`)
    }
  }
  let acc = 0
  const total = out.reduce((s, t) => s + durOf(t), 0)
  /* [٢٢ أغسطس] حكم الدكتور: البداية ممتازة ثم يقع الانجراف بعد الجسر أو
     قرب ٨٠ ثانية. الحلقات القصيرة (~دقيقتين ونصف) تُقسم ثلاثة فصول
     متقاربة: نداء مستقل كل 40–60 ثانية، وبطاقة الهوية نفسها في كل نداء.
     نقطتا القطع تختبئان خلف الموسيقى ولا تقعان في أول/آخر ثلاثة أدوار. */
  const cumulative = out.map((t) => (acc += durOf(t)))
  out.forEach((t) => { t.musicBridgeAfter = false })
  const bridgeTargets = total >= 115 ? [total / 3, total * 2 / 3] : [total / 2]
  const bridgeAt = []
  for (const target of bridgeTargets) {
    const candidates = cumulative.map((at, k) => ({
      k,
      distance: Math.abs(at - target),
      score: Math.abs(at - target) +
        (out[k + 1] && out[k].speaker === out[k + 1].speaker ? 12 : 0) +
        (Number(out[k].overlapMs) > 0 ? 8 : 0) +
        (out[k].deliveryType === 'briefReaction' ? 4 : 0) +
        (/[؟?]\s*$/.test(String(out[k].text)) ? 5 : 0),
    }))
      .filter(({ k }) => k >= 2 && k < out.length - 3 && !bridgeAt.some((old) => Math.abs(old - k) < 3))
      .sort((a, b) => a.score - b.score)
    if (candidates.length) bridgeAt.push(candidates[0].k)
  }
  bridgeAt.forEach((k) => { out[k].musicBridgeAfter = true })

  /* ١٠) بوابة اللهجة على المكثف. */
  const text = out.map((t) => t.text).join(' ')
  const hits = KW_MARKERS.reduce((s, m) => s + text.split(m).length - 1, 0)
  if (hits / out.length < 0.22) flags.push('كثافة كويتية دون العتبة — مراجعة يدوية')
  if (out.length < MIN_TURNS) flags.push('أقل من ١٥ مداخلة')
  if (new Set(out.map((t) => t.speaker)).size < 2) flags.push('متحدث واحد!')
  if (longestSpeakerRun(out) > 2) flags.push(`روح الحوار: ${longestSpeakerRun(out)} مداخلات متتالية للمتحدث نفسه — راجع`)
  if (!out.some((t) => Number(t.overlapMs) > 0)) flags.push('روح الحوار: لا مقاطعة أصلية ولا تداخل مونتاجي — راجع')
  if (total < 120 || total > 185) flags.push(`المدة المقدرة ${Math.round(total)}ث خارج هامش الدقيقتين والنصف`)
  if (!/الفيل|موقع الدكتور/.test(String(out[out.length - 1].text))) notes.push('خاتمة فكرية مقصودة بلا إعلان موقع — تُحفظ لجمال القفلة')

  return { turns: out, flags, notes, estSec: Math.round(total), kept: out.length, from: n }
}

if (SELF_TEST) {
  const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues.json'), 'utf8'))
  const pilot = Object.values(lib.episodes['success-that-does-not-bring-joy-to-its-ownerarabic'])
  const r = condenseEpisode(pilot)
  assert.ok(r.kept >= MIN_TURNS && r.kept <= MAX_TURNS, `عدد المداخلات ${r.kept} خارج [15,28]`)
  assert.ok(r.estSec >= 120 && r.estSec <= 180, `المدة المقدرة ${r.estSec} خارج [120,180]`)
  assert.equal(r.turns[0].text, pilot[0].text, 'الافتتاح محفوظ حرفياً')
  assert.ok(/الفيل/.test(r.turns[r.kept - 1].text), 'الإحالة الختامية محفوظة')
  assert.equal(r.turns.filter((t) => t.musicBridgeAfter).length, 2, 'جسران بالضبط: ثلاثة مقاطع قصيرة ضد الانجراف')
  const src = new Set(pilot.map((t) => t.text))
  assert.ok(r.turns.every((t) => src.has(t.text) || src.has('و' + t.text)), 'كل سطرٍ من متن الدكتور حرفياً (عدا واو منزوعة)')
  console.log(`✓ مصنع التكثيف: التجربة ${r.from}→${r.kept} مداخلة · ~${r.estSec}ث · جسران · كل السطور أصلية`)
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
  report.push({ slug, from: r.from, kept: r.kept, estSec: r.estSec, flags: r.flags, notes: r.notes })
}
short.count = Object.keys(short.episodes).length
writeFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json'), JSON.stringify(short, null, 1) + '\n')
writeFileSync(resolve(ROOT, 'podcast-audits/condense-report.json'), JSON.stringify(report, null, 1) + '\n')
const flagged = report.filter((r) => r.flags.length)
console.log(`✓ كُثفت ${short.count} حلقة → kuwaiti-dialogues-short.json`)
console.log(`  متوسط: ${Math.round(report.reduce((s, r) => s + r.estSec, 0) / report.length)}ث · موسومة للمراجعة: ${flagged.length}`)
}
