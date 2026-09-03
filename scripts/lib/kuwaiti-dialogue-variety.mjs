/**
 * تنويع مجلس الفكرة من غير اختراع نص أو فرض قالب واحد.
 *
 * القاعدة: الكلمات وترتيب المداخلات مقدّسان. التنويع يقع في توزيع مَن يقود
 * الجلسة، وفي ميل الأداء الخفيف، وفي طريقة انتقاء المداخلات عند تكثيف مقال
 * جديد. الخطة حتمية من slug، لذلك لا تتبدل هوية الحلقة عند إعادة التشغيل.
 */
import { createHash } from 'node:crypto'

export const DIALOGUE_VARIETY_VERSION = '2026-08-30-kuwaiti-variety-v3-professional-gold-cast'

/* هذه الثلاث ليست تنويعاً متوقعاً ولا قلباً عاماً للكاست. هي توزيع
   الشخصيتين نفسه الذي سمعه الدكتور واعتمده صراحةً في تشغيلة 33132655399.
   نبقيه فقط للخمس الذهبية، بينما كل حلقة أخرى تُكتب بأدوارها الصحيحة من
   البداية ولا تُقلب آلياً. أخطاء «تدرين/تدري» تُصلح في النص الذهبي نفسه. */
export const DOCTOR_APPROVED_GOLD_CAST_SWAPS = new Set([
  'the-classroom-that-fears-mistakesarabic',
  'when-seriousness-becomes-a-mask-for-escapearabic',
  'how-do-we-assess-without-breaking-the-human-beingarabic',
])

export const CONVERSATION_FAMILIES = [
  {
    id: 'quick-practical',
    note: 'خَلّ الأخذ والرد عملي وخفيف؛ الجمل اليومية تمر بسرعة، والتوضيح يي عقبها من غير محاضرة.',
    questionOrder: 'spread', objectionOrder: 'middle', bridgeRatios: [0.29, 0.64],
  },
  {
    id: 'curious-unfolding',
    note: 'الفكرة تنكشف بالسؤال والجواب؛ السؤال يطلع من الكلام اللي قبله، مو كأنه بند مجهّز.',
    questionOrder: 'early', objectionOrder: 'late', bridgeRatios: [0.34, 0.70],
  },
  {
    id: 'warm-friction',
    note: 'فيه اختلاف بسيط وصادق بين الاثنين؛ الاعتراض خفيف والرد يوضح، من غير مناظرة أو تمثيل.',
    questionOrder: 'alternate', objectionOrder: 'early', bridgeRatios: [0.31, 0.67],
  },
  {
    id: 'lived-scene',
    note: 'تعامل مع البداية كذكرى أو موقف صار جدامهم؛ التفاصيل عادية وقريبة، مو افتتاحية برنامج.',
    questionOrder: 'late', objectionOrder: 'middle', bridgeRatios: [0.37, 0.72],
  },
  {
    id: 'evidence-midstream',
    note: 'المعلومة البحثية تدخل بنص السالفة وتنفتح بسؤال قصير؛ لا أحد يتحول لمقدّم أو خبير ثابت.',
    questionOrder: 'spread', objectionOrder: 'late', bridgeRatios: [0.28, 0.68],
  },
  {
    id: 'quiet-reflection',
    note: 'النبرة أهدأ شوي لكن تظل سوالف؛ خل بعض الأفكار تتكوّن أثناء الكلام ولا تعطِ كل جملة وزن خاتمة.',
    questionOrder: 'alternate', objectionOrder: 'early', bridgeRatios: [0.35, 0.63],
  },
]

export function stableVarietyNumber (slug, salt = '') {
  const hex = createHash('sha256').update(`${salt}:${String(slug || '')}`).digest('hex').slice(0, 12)
  return Number.parseInt(hex, 16)
}

export function conversationFamilyForSlug (slug) {
  return CONVERSATION_FAMILIES[stableVarietyNumber(slug, 'family') % CONVERSATION_FAMILIES.length]
}

/* ممنوع قلب الكاست بعد كتابة الحوار. وسمُ المتحدث ليس لوناً: «تدرين»
   و«تدري» و«تخيلي» و«تخيل» جزءٌ من النص نفسه. قلب الوسم وحده أخرج نورة
   تخاطب فهد بصيغة المؤنث، والعكس أصعب أن يمسكه حارس بلا فهم السياق.
   تنويع مَن يبدأ يجب أن يحدث وقت **كتابة** الحوار القادم، بصرفٍ صحيح، لا
   كتحويل آلي بعد اعتماد الكلمات. الـ144 الحالية تبقى على كاست مؤلفها. */
export function shouldSwapConversationCast (slug) {
  return false
}

export function applyConversationVariety (turns, { slug = '', preserveDoctorApprovedGoldCast = false } = {}) {
  const family = conversationFamilyForSlug(slug)
  const output = turns.map((turn) => ({ ...turn }))
  const changes = []
  const castSwapBlocked = false
  const swapCast = preserveDoctorApprovedGoldCast && DOCTOR_APPROVED_GOLD_CAST_SWAPS.has(slug)
  const desiredFirstSpeaker = 'female'
  const castNeedsChange = swapCast && ['male', 'female'].includes(output[0]?.speaker)
    && output[0].speaker !== desiredFirstSpeaker

  /* الحكم على أول متحدث يجعل العملية idempotent: تشغيل طبقة الصقل مرتين لا
     يقلب الأدوار ذهاباً وإياباً. */
  if (castNeedsChange) {
    for (const [index, turn] of output.entries()) {
      const before = turn.speaker
      const after = before === 'male' ? 'female' : before === 'female' ? 'male' : before
      if (after !== before) {
        turn.speaker = after
        changes.push({ index, field: 'speaker', before, after, reason: 'استعادة توزيع فهد ونورة في المرجع الاحترافي المعتمد' })
      }
    }
  }

  /* الإحالة ليست asset منفصلاً بعد الآن. تبقى مع المتحدث الذي أسندها له
     الحوار الحالي، فيقول فهد أو نورة الاسم داخل الـTake نفسه. المقفول هو
     النطق في طبقة الصوت، لا جنس المتحدث ولا مقطعٌ قديم ملصوق. */

  const firstSpeaker = output[0]?.speaker || ''
  const wordCounts = output.reduce((counts, turn) => {
    counts[turn.speaker] = (counts[turn.speaker] || 0) + String(turn.text || '').trim().split(/\s+/).filter(Boolean).length
    return counts
  }, {})
  const leadSpeaker = (wordCounts.female || 0) > (wordCounts.male || 0) ? 'female'
    : (wordCounts.male || 0) > (wordCounts.female || 0) ? 'male' : 'balanced'

  return {
    turns: output,
    changes,
    plan: {
      version: DIALOGUE_VARIETY_VERSION,
      family: family.id,
      performanceNote: family.note,
      questionOrder: family.questionOrder,
      objectionOrder: family.objectionOrder,
      bridgeRatios: family.bridgeRatios,
      castSwapped: swapCast,
      castApplied: castNeedsChange,
      castSwapBlockedByGenderedAddress: castSwapBlocked,
      firstSpeaker,
      leadSpeaker,
    },
  }
}

export function orderedQuestionIndexes (indexes, mode = 'spread') {
  if (indexes.length <= 2) return [...indexes]
  if (mode === 'early') return [...indexes]
  if (mode === 'late') return [...indexes].reverse()
  if (mode === 'alternate') {
    const result = []
    let left = 0; let right = indexes.length - 1
    while (left <= right) {
      result.push(indexes[left++])
      if (left <= right) result.push(indexes[right--])
    }
    return result
  }
  /* موزع على أول/وسط/آخر بدل أخذ أول أربعة دائماً. */
  const last = indexes.length - 1
  const positions = [0, last, Math.floor(last / 2), Math.floor(last / 4), Math.floor(last * 3 / 4)]
  for (let position = 0; position <= last; position += 1) positions.push(position)
  const used = new Set()
  return positions.filter((position) => {
    if (used.has(position)) return false
    used.add(position)
    return true
  }).map((position) => indexes[position])
}
