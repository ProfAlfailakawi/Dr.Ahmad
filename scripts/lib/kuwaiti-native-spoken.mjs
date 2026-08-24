/**
 * طبقة النص المنطوق قبل Gemini.
 *
 * هذه ليست لهجةً آليةً ولا قلباً ميكانيكياً للقاف. دورها أضيق:
 *  - إصلاح الصياغات التي سُمعت فعلياً كمقالٍ أو كمذيع.
 *  - تبسيط مداخل البحث من غير تغيير الرقم أو الجهة أو النتيجة.
 *  - إبقاء كل تغيير مسجلاً كي يطابق الـTranscript ما قيل فعلاً.
 *
 * تُطبق بعد إثبات أن المختصر مشتق من متن Firestore المقفول، وقبل أن يصل
 * النص إلى TTS. لذلك لا نطلب من Gemini أن يعيد الكتابة سراً ثم ننشر
 * Transcript مختلفاً؛ النص الذي يراه المحرك هو نفسه النص الذي نسجله.
 */

import { applyConversationVariety } from './kuwaiti-dialogue-variety.mjs'

export const NATIVE_SPOKEN_VERSION = '2026-08-25-native-kuwaiti-v5'
export const PILOT_SLUG = 'success-that-does-not-bring-joy-to-its-ownerarabic'

const cloneTurn = (turn) => ({ ...turn })
const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim()

/* الحكم السمعي الأخير على الحلقة التجريبية سمّى هذه المواضع واحداً واحداً.
   التعديل هنا على الحلقة وحدها؛ لا نعمّم عبارةً سياقيةً على ١٤٤ موضوعاً. */
const PILOT_TURN_OVERRIDES = new Map([
  [0, { text: 'تطلع النتيجة، وتبدي التهاني من كل صوب، والطالب يبتسم… مثل ما الناس متوقعة منه.' }],
  [2, { deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [3, { text: 'ما حس بالفرحة اللي كان يبيها.' }],
  [4, { text: 'بس كل اللي حس فيه كان راحة شوي… وبس. مثل واحد كان منحشر بمكان ضيّج… وبعدها طلع منه.' }],
  [5, { text: 'بس مو النجاح بروحه يستاهل الفرحة؟' }],
  [7, { text: 'إي، بس هني الفرق.', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [8, { text: 'الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي.' }],
  [9, { speaker: 'female', text: 'إي، ترى مو كل نجاح يفرّح صاحبه… مرات الواحد بس يرتاح لأنه عدى اللي كان خايف منه.' }],
  [12, { text: 'بس شنو يصير بالاختبار اللي بعده؟', deliveryType: 'question' }],
  [13, { speaker: 'female', text: 'وترى حتى الدراسات تقول إن هالضغط مو بسيط.', deliveryType: 'briefReaction' }],
  [14, { speaker: 'male', text: 'شلون يعني؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [15, { speaker: 'female', text: 'في دراسة كبيرة جمعت أبحاث وايد عن الموضوع.' }],
  [16, { speaker: 'male', text: 'وشنو طلع معاهم؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [17, { speaker: 'female', text: 'كل ما زاد التوتر، نزل مستوى الطالب.', deliveryType: 'statement' }],
  [18, { speaker: 'male', text: 'إي، بس تدري شنو الأسوأ؟', deliveryType: 'briefReaction', pauseAfterMs: 180, overlapMs: 70 }],
  [19, { speaker: 'female', text: 'إنه يدخل بنفس الدوامة كل مرة. ما يرتاح من داخل… بس ينطر الاختبار اللي بعده.' }],
  [20, { speaker: 'male', text: 'بس مو كبرنا الموضوع وايد؟' }],
  [21, { speaker: 'female', text: 'الدرجة بالنهاية تبيّن مستواه… بس مو كل شي فيه.' }],
  [22, { text: 'والأهم بعد… هالتجربة شنو غيّرت فيهم؟ صاروا أحسن؟' }],
  [23, { speaker: 'female', text: 'فهموا نفسهم أكثر؟ صاروا أهدأ؟' }],
  [24, { text: 'ترى في نجاح يطلع شكله وايد حلو… بس صاحبه ما حس بشي.', deliveryType: 'statement', pauseAfterMs: 320 }],
  [25, { text: 'ودورنا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.', deliveryType: 'statement', pauseAfterMs: 320 }],
])

/* النسخة الكاملة تبقى قاعدة التحرير وإعادة التكثيف، لذلك تحمل العلاج نفسه
   حتى لو تبدّل المختصر مستقبلاً أو طُلبت الحلقة الكاملة. */
const PILOT_FULL_OVERRIDES = new Map([
  [0, { text: 'تطلع النتيجة، وتبدي التهاني من كل صوب، والطالب يبتسم… مثل ما الناس متوقعة منه. بس في شي داخله ساكت.' }],
  [1, { text: 'إي، بالضبط. الكل حواليه فرحان ويبارك له، بس هو من داخله؟ ما حس بالفرحة اللي كان يبيها.' }],
  [2, { text: 'مو فرحة من قلب، ولا ذاك الإحساس اللي يي لما تنجز شي يعني لك. بس كل اللي حس فيه كان راحة شوي… وبس. مثل واحد كان منحشر بمكان ضيّج… وبعدها طلع منه.' }],
  [3, { text: 'بس مو النجاح بروحه يستاهل الفرحة؟ إذا الواحد عدى شي كان خايف منه، طبيعي يرتاح.' }],
  [4, { text: 'إي، بس هني الفرق. الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي. وترى مو كل نجاح يفرّح صاحبه؛ مرات الواحد بس يرتاح لأنه عدى اللي كان خايف منه.' }],
  [7, { text: 'إذا الامتحان صار معركة، النجاح بس يوقف التوتر شوي… بس شنو يصير بالاختبار اللي بعده؟' }],
  [8, { speaker: 'female', text: 'وترى حتى الدراسات تقول إن هالضغط مو بسيط.', deliveryType: 'briefReaction' }],
  [9, { speaker: 'male', text: 'شلون يعني؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [10, { speaker: 'female', text: 'في دراسة كبيرة جمعت أبحاث وايد عن الموضوع، وطلع معاهم إن كل ما زاد التوتر، نزل مستوى الطالب.' }],
  [11, { speaker: 'male', text: 'وفي دراسة ثانية؟', deliveryType: 'briefReaction', pauseAfterMs: 160, overlapMs: 70 }],
  [12, { speaker: 'female', text: 'ربطوا ضغط الدراسة بتوتر الامتحان. وقالوا بعد إن نظرة الأهل وحالة الطالب النفسية لهم دور.' }],
  [13, { speaker: 'male', text: 'إي، بس تدري شنو الأسوأ؟', deliveryType: 'briefReaction', pauseAfterMs: 180, overlapMs: 70 }],
  [14, { speaker: 'female', text: 'إن الطالب يصير يشوف الدرجة كأنها كل شي.' }],
  [15, { speaker: 'male', text: 'حتى نجاحه ما يطمنه.' }],
  [16, { speaker: 'female', text: 'إنه يدخل بنفس الدوامة كل مرة. ما يرتاح من داخل… بس ينطر الاختبار اللي بعده.' }],
  [17, { text: 'بس مو كبرنا الموضوع وايد؟ الدرجة بالنهاية تبيّن مستواه… بس مو كل شي فيه.' }],
  [18, { text: 'يدري هالشي بعقله، إي. بس الإحساس مو دايما يسمع كلام العقل. وهني أبحاث الجدارة الذاتية المشروطة فيها شي مهم.' }],
  [19, { text: 'إذا الواحد ربط قيمته بدرجاته، عقب شوي ثقته بروحه تهتز.' }],
  [20, { text: 'ويي معاه ضغط أكثر، وتوتر بالامتحان، وتصير دافعيته كلها خوف مو رغبة.' }],
  [27, { text: 'والأهم بعد… هالتجربة شنو غيرت فيهم؟ صاروا أحسن؟ فهموا نفسهم أكثر؟ صاروا أهدأ؟' }],
  [34, { text: 'ترى في نجاح يطلع شكله وايد حلو… بس صاحبه ما حس بشي.' }],
  [35, { text: 'ودورنا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.', deliveryType: 'statement', pauseAfterMs: 320 }],
])

/* قواعد آمنة قليلة للحلقات الحالية والجديدة. لا تشمل «كل قاف»: الهوية
   الكويتية معجمية، والمعنى أهم من مطاردة حرف. */
const SAFE_TEXT_RULES = [
  [/مثل واحد كان محشور بباب ضيق(?:،|…)?\s*(?:وعقب|وبعدين|وطلع)\s+منه/gu,
    'مثل واحد كان منحشر بمكان ضيّج… وبعدها طلع منه'],
  [/إن النجاح يتحول من فرحة إلى وسيلة تهد[يّي] الخوف/gu,
    'الطالب ما يفرح بالنجاح… بس يحس إن التوتر خف شوي'],
  [/من هني الدراسة تصير محطة بعد محطة/gu, 'وهني يدخل بنفس الدوامة كل مرة'],
  [/أوضح مع نفسهم/gu, 'فهموا نفسهم أكثر'],
  [/دورنا مو بس نلمّع شكل النجاح\. نبي الطالب يحس إن (?:اللي سواه|تعبه) له معنى… مو بس شكل حلو جدام الناس\./gu,
    'ودورنا مو بس نفرح بالنتيجة جدام الناس. الأهم إن الطالب نفسه يحس إن تعبه كان له معنى.'],
  [/^مراجعة بحثية واسعة، لقت إن المستخدمين يقبلون توصيات الذكاء حتى وهي ناقصة\.$/u,
    'وفي مراجعة جمعت أبحاث وايد، طلع إن الناس تمشي ورا توصيات الذكاء حتى لما تكون ناقصة.'],
  [/\bشنو الأخطر من القلق نفسه\b/gu, 'شنو الأسوأ من التوتر نفسه'],
  [/\bكل ما زاد القلق\b/gu, 'كل ما زاد التوتر'],
  [/\bفجأة\b/gu, 'مرة وحدة'],
  [/^وفي دراسة نشرتها ([^،…]+)([،…])/u, 'وأكو دراسة من $1$2'],
  [/^ففي دراسة نشرتها ([^،…]+)([،…])/u, 'وفي دراسة من $1$2'],
  [/^وبدراسة نشرتها ([^،…]+)([،…])/u, 'وفي دراسة من $1$2'],
  [/^وترى في دراسة نشرتها ([^،…]+)([،…])/u, 'وترى أكو دراسة من $1$2'],
  [/^وفي تقرير صدر عن ([^،…]+)([،…])/u, 'وفي تقرير من $1$2'],
  [/^وبتقرير أصدرته ([^،…]+)([،…])/u, 'وفي تقرير من $1$2'],
  [/^وهالشي مبين بتقارير/u, 'وهالشي مبين في تقارير'],
  [/^مثل ما تظهر تقارير ([^.؟…]+)([.؟…])/u, 'وهالشي مبين في تقارير $1$2'],
  [/\bتعزز هالفكرة\b/gu, 'تقول الشي نفسه'],
]

export const RISK_PATTERNS = [
  ['بحث بصوت مذيع', /(?:ميتا.?تحليل منشور|مراجعة بحثية (?:كبيرة|واسعة)|في بحث فعلي قاعد يقول)/u],
  ['جملة مقالية', /(?:المعنى اللي إحنا نحطه على النتيجة|في نجاحات ما تفرح صاحبها|نرجع للنجاح معناه|نرجع له روحه)/u],
  ['اعتراض ثقيل', /بس مو قاعدين نكبر الموضوع/u],
  ['صورة مكتوبة', /(?:وسيلة تهد[يّي] الخوف|الدراسة تصير محطة بعد محطة|أوضح مع نفسهم)/u],
  ['خاتمة شعارية', /(?:التربية الحقيقية مو|الفرح الحقيقي بعد|بالصورة وايد حلوة… بس من داخل فاضية|نلمّع شكل النجاح)/u],
]

const QAF_RISK_WORDS = /(?:^|[\s،؛:.!?؟…])(متوقع\S*|مؤقت\S*|فجأة|القلق|الأخطر|قاعدين|أقوى|أصدق|الحقيقية)(?=$|[\s،؛:.!?؟…])/gu

export function auditNativeSpokenTurns (turns) {
  const hard = []
  const soft = []
  let qafRiskCount = 0
  let researchTurns = 0
  let sloganTurns = 0
  for (const [index, turn] of turns.entries()) {
    const text = norm(turn.text)
    for (const [label, pattern] of RISK_PATTERNS) {
      if (pattern.test(text)) hard.push({ index, label, text })
    }
    qafRiskCount += [...text.matchAll(QAF_RISK_WORDS)].length
    const research = /(?:دراسة|دراسات|بحث|أبحاث|تقرير|تقارير|مجلة|جامعة|منظمة|معهد|باحث|بالمئة|في المئة)/u.test(text)
    if (research) {
      researchTurns += 1
      if (text.length > 115) soft.push({ index, label: 'مداخلة بحثية طويلة', text })
    }
    if (['conclusion', 'closing'].includes(String(turn.deliveryType || '')) && text.length > 118) {
      sloganTurns += 1
      soft.push({ index, label: 'خاتمة طويلة قابلة للإلقاء', text })
    }
  }
  return { hard, soft, qafRiskCount, researchTurns, sloganTurns }
}

export function optimizeNativeSpokenEpisode (turns, { slug = '' } = {}) {
  const output = turns.map(cloneTurn)
  const changes = []

  output.forEach((turn, index) => {
    const before = norm(turn.text)
    let after = before
    for (const [pattern, replacement] of SAFE_TEXT_RULES) after = after.replace(pattern, replacement)
    if (after !== before) {
      turn.text = after
      changes.push({ index, field: 'text', before, after, reason: 'قاعدة منطوقة آمنة' })
    }
  })

  /* الطول + البداية + الـslug قفلٌ كافٍ للحلقة القصيرة. لا نربط الترحيل
     بعبارة «التربية» القديمة؛ وإلا تعجز v2 عن إصلاح ملفٍ صُقل سابقاً بـv1. */
  if (slug === PILOT_SLUG && output.length === 27
    && norm(output[0]?.text).startsWith('تطلع النتيجة')) {
    for (const [index, patch] of PILOT_TURN_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم الأذن على الحلقة التجريبية' })
        turn[field] = value
      }
    }
    /* ثمانية تبديلات سريعة داخل البحث جعلت Gemini Preview يربط «السائل»
       بصوتٍ لا بالاسم، فيبدّل فهد ونورة وسط الـTake. نضغطها إلى سؤال واحد
       وجواب واحد مع حفظ المعلومتين حرفياً؛ السالفة تبقى حواراً والبحث لا
       يصير فقرة مذيع. هذا علاجٌ للحلقة التي سُمعت فقط، لا قاعدة عامة. */
    const beforeResearch = output.slice(14, 18).map((turn) => ({ ...turn }))
    const mergedResearch = [
      {
        ...output[14],
        text: 'شلون يعني؟ وشنو طلع معاهم؟',
        deliveryType: 'question',
        pauseAfterMs: 180,
        overlapMs: 70,
      },
      {
        ...output[15],
        text: 'في دراسة كبيرة جمعت أبحاث وايد عن الموضوع. كل ما زاد التوتر، نزل مستوى الطالب.',
        deliveryType: 'statement',
      },
    ]
    output.splice(14, 4, ...mergedResearch)
    changes.push({
      index: 14,
      field: 'turns',
      before: beforeResearch,
      after: mergedResearch,
      reason: 'ضغط التبديل السريع في البحث لمنع إعادة ربط الصوت بالدور الحواري',
    })
  } else if (slug === PILOT_SLUG && output.length >= 15
    && norm(output[0]?.text).startsWith('تطلع النتيجة')
    && norm(output[0]?.text).includes('بس في شي داخله ساكت')) {
    for (const [index, patch] of PILOT_FULL_OVERRIDES) {
      const turn = output[index]
      if (!turn) continue
      for (const [field, value] of Object.entries(patch)) {
        if (turn[field] === value) continue
        changes.push({ index, field, before: turn[field], after: value, reason: 'حكم الأذن على متن الحلقة الكامل' })
        turn[field] = value
      }
    }
  }

  /* التنويع يأتي بعد العلاج النصي: لا يمس كلمةً ولا ترتيباً، ويجعل نورة
     تقود قسماً من المكتبة بدل أن تبدأ الحلقات الـ144 كلها بفهد. */
  const varied = applyConversationVariety(output, { slug })
  changes.push(...varied.changes)
  const audit = { ...auditNativeSpokenTurns(varied.turns), conversationPlan: varied.plan }
  return { turns: varied.turns, changes, audit, conversationPlan: varied.plan, version: NATIVE_SPOKEN_VERSION }
}
