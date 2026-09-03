import { createHash } from 'node:crypto'

export const KUWAITI_CLOSING_VERSION = '2026-08-31-kuwaiti-closing-variety-v3-classroom-qaf-safe'

export const KUWAITI_GOLD_REQUEST_SLUG = 'success-that-does-not-bring-joy-to-its-ownerarabic'
export const KUWAITI_GOLD_REQUEST_CLOSING =
  'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في موقع الدكتور أحمد حسين الفيلچاوي.'

/*
 * الإحالة المنطوقة قصيرة ومتنوعة، واسم العائلة يبقى في البيانات المكتوبة
 * لا في مدخل الصوت. الاختيار حتمي من الـslug: إعادة الحلقة تعطي النص نفسه،
 * بينما الباقة لا تبدو كأنها تنتهي بإعلان محفوظ مكرر ١٤٤ مرة.
 */
export const KUWAITI_CLOSING_VARIANTS = Object.freeze([
  'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في موقع الدكتور أحمد.',
  'والتفاصيل كلها تلقاها بالمقال الأصلي في موقع الدكتور أحمد.',
  'وإذا تبي تكمل السالفة، المقال الأصلي موجود في موقع الدكتور أحمد.',
  'وباقي الفكرة تلقاه بالمقال الأصلي في موقع الدكتور أحمد.',
  'وإذا تبي تقرا أكثر، تلقى المقال الأصلي في موقع الدكتور أحمد.',
  'والفكرة بتفاصيلها موجودة بالمقال الأصلي في موقع الدكتور أحمد.',
  'وإذا تبي المقال الأصلي كامل، تلقاه في موقع الدكتور أحمد.',
  'والشرح الكامل موجود بالمقال الأصلي في موقع الدكتور أحمد.',
])

/* الحلقة 02 وحدها خرجت قافها سيئة بأذن الدكتور، لذلك إحالتها تعطي المعنى
   نفسه من غير «تلقى/موقع». ما نعمّم هالصياغة على بقية الحلقات. */
export const KUWAITI_SPECIAL_CLOSINGS = Object.freeze({
  'the-classroom-that-fears-mistakesarabic':
    'والفكرة كاملة مكتوبة على صفحة الدكتور أحمد.',
})

const norm = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const stableIndex = (slug) => createHash('sha256').update(String(slug || 'episode')).digest().readUInt32BE(0) % KUWAITI_CLOSING_VARIANTS.length

export const closingForSlug = (slug) => KUWAITI_SPECIAL_CLOSINGS[slug]
  || KUWAITI_CLOSING_VARIANTS[stableIndex(slug)]

export const isApprovedSpokenClosing = (text) => KUWAITI_CLOSING_VARIANTS.includes(norm(text))
  || Object.values(KUWAITI_SPECIAL_CLOSINGS).includes(norm(text))

const looksLikeReferral = (text) => /(?:المقال|الموقع|موقع الدكتور|الفكرة كاملة|التفاصيل كلها)/u.test(norm(text))

export function applySpokenClosing (turns, { slug = '' } = {}) {
  const output = (Array.isArray(turns) ? turns : []).map((turn) => ({ ...turn }))
  const lastIndex = output.length - 1
  if (lastIndex < 0) return { turns: output, changes: [] }

  const before = norm(output[lastIndex].text)
  /* الحلقة المرجعية ليست مادةً جديدة: بايتات طلبها الأصلي هي التجربة
     الوحيدة التي اعتمدها الدكتور صراحةً. تغيير آخر جملة إلى صيغة أقصر غيّر
     request hash، فصار Gemini يعيد تفسير الشخصيتين من أول التسجيل. نحفظ
     الطلب المرجعي حرفياً هنا؛ معالجة اسم العائلة، إن لزمت، تكون لاحقاً في
     المونتاج ولا تُغيّر مدخل TTS الذهبي. */
  if (slug === KUWAITI_GOLD_REQUEST_SLUG) {
    output[lastIndex] = {
      ...output[lastIndex],
      text: KUWAITI_GOLD_REQUEST_CLOSING,
      deliveryType: 'conclusion',
      pauseAfterMs: 900,
      overlapMs: 0,
      musicBridgeAfter: false,
    }
    return {
      turns: output,
      changes: before === KUWAITI_GOLD_REQUEST_CLOSING ? [] : [{
        index: lastIndex,
        field: 'text',
        before,
        after: KUWAITI_GOLD_REQUEST_CLOSING,
        reason: `استعادة بايتات طلب المرجع الذهبي (${KUWAITI_CLOSING_VERSION})`,
      }],
    }
  }
  const after = closingForSlug(slug)
  /* حوار الإنتاج 24–32 دوراً. إذا وصل مصدر تاريخي كامل بلا إحالة (حالة
     واحدة في v3)، نضيفها في طبقة المنطوق بدل العبث بمتن Firestore المقفول.
     العينات القصيرة واختبارات الجمل ما تتغير. */
  if (!looksLikeReferral(before)) {
    if (output.length < 20) return { turns: output, changes: [] }
    const previousSpeaker = output[lastIndex]?.speaker
    output.push({
      speaker: previousSpeaker === 'male' ? 'female' : 'male',
      text: after,
      deliveryType: 'statement',
      pauseAfterMs: 260,
      overlapMs: 0,
      musicBridgeAfter: false,
    })
    return {
      turns: output,
      changes: [{
        index: output.length - 1,
        field: 'text',
        before: '',
        after,
        reason: `إضافة الإحالة المفقودة في طبقة الصوت (${KUWAITI_CLOSING_VERSION})`,
      }],
    }
  }
  output[lastIndex] = {
    ...output[lastIndex],
    text: after,
    deliveryType: 'statement',
    pauseAfterMs: 260,
    overlapMs: 0,
    musicBridgeAfter: false,
  }
  return {
    turns: output,
    changes: before === after ? [] : [{
      index: lastIndex,
      field: 'text',
      before,
      after,
      reason: `إحالة ختامية كويتية متنوعة بلا اسم عائلة (${KUWAITI_CLOSING_VERSION})`,
    }],
  }
}
