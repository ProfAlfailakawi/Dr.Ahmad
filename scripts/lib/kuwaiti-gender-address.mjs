/**
 * مَن يخاطب مَن — بجنسه الصحيح.
 *
 * فهد رجل ونورة امرأة. حين يخاطب أحدهما الآخر تحمل صيغةُ الفعل جنسَ
 * المخاطَب: فهد يقول لنورة «تدرين»، ونورة تقول لفهد «تدري». والمكتبة
 * مكتوبةٌ صحيحةً بهذا الميزان.
 *
 * لكن طبقة التنويع تقلب كاست 77 حلقة من 144 (نورة تقود مجلساً وفهد
 * مجلساً) وهي تقلب الوسم وحده — والنص يبقى كما كُتب. فصارت نورة تقول
 * لفهد «تدرين شنو»، وهي مخاطبةُ امرأةٍ في فم امرأةٍ تكلّم رجلاً. سمعها
 * الدكتور في الحلقة الخامسة قبل أن يمسكها أي فاحص: «قالت تدرين منو وهو
 * رجل».
 *
 * والتمييز الذي يجعل هذا الفاحص قاطعاً لا ظنياً: الخطاب العام في الكويتي
 * مذكَّرٌ دائماً («يطق عليك فجأة» · «الحاسبة تحسب لك») وكذلك المنقول عن
 * الغير. فصيغةُ المذكر في فم فهد لا تدل على خطأ، وتُعرض للأذن ولا توقف
 * شيئاً. أما صيغة المؤنث في فم نورة فلا قراءة أخرى لها: لا خطاب عام ولا
 * غائب يأخذها، فهي مخاطبةٌ لفهد بجنسٍ ليس جنسه. هذه وحدها تُسقِط.
 */

export const GENDER_ADDRESS_VERSION = '2026-08-29-kuwaiti-gender-address-v1'

/* صيغٌ لا تُقرأ إلا مخاطبةً لمؤنث. */
const FEMALE_ADDRESS_HARD = [
  'تدرين', 'تشوفين', 'تعرفين', 'تقصدين', 'تتذكرين', 'تذكرين', 'تحسين', 'تفهمين',
  'تسمعين', 'تلاحظين', 'تتخيلين', 'تصدقين', 'تقولين', 'تتوقعين', 'تلقين',
  'تعتقدين', 'ترين', 'تبغين', 'تحبين', 'تشوفينه', 'تدرينه', 'تشوفينها',
  'شفتي', 'قلتي', 'سمعتي', 'عرفتي', 'لاحظتي', 'صدقتي', 'تذكرتي', 'درتي',
  'تخيلي', 'شوفي', 'قولي', 'اسمعي', 'لاحظي', 'صدقيني', 'انتبهي', 'تعالي',
  'خذي', 'سمعيني',
  'إنتي', 'انتي', 'عندچ', 'لچ', 'منچ', 'بچ', 'عليچ', 'شلونچ', 'وياچ', 'عنچ',
]

/* صيغُ المذكر: تصلح للمخاطَب وللخطاب العام وللمنقول، فلا تُسقِط. */
const MALE_ADDRESS_SOFT = [
  'إنت', 'انت', 'إنته', 'انته', 'عندك', 'منك', 'عليك', 'وياك', 'شلونك', 'عنك', 'لك',
  'شوف', 'قول', 'اسمع', 'تخيل', 'لاحظ', 'انتبه', 'تعال', 'خذ', 'صدقني',
  'تدري', 'تعرف', 'تقصد', 'تتذكر', 'تحس', 'تفهم', 'تسمع', 'تلاحظ', 'تصدق',
  'تتوقع', 'تشوف', 'تبي', 'تقول', 'تحب', 'تلقى',
]
/* صيغةُ مؤنثٍ تصلح للغائبة أيضاً («ما دامت تبين واثقة»). */
const FEMALE_ADDRESS_SOFT = ['تبين']

const EDGE_BEFORE = '(?:^|[\\s،.؟!…:؛«»"\'\\-])'
const EDGE_AFTER = '(?=$|[\\s،.؟!…:؛«»"\'\\-])'
const compile = (words) => new RegExp(`${EDGE_BEFORE}(${words.join('|')})${EDGE_AFTER}`, 'g')

const PATTERNS = {
  femaleHard: compile(FEMALE_ADDRESS_HARD),
  femaleSoft: compile(FEMALE_ADDRESS_SOFT),
  maleSoft: compile(MALE_ADDRESS_SOFT),
}

function collect (pattern, text) {
  pattern.lastIndex = 0
  const found = []
  let match
  while ((match = pattern.exec(text)) !== null) found.push(match[1])
  return found
}

/* المتحدثة أنثى ⇒ مخاطَبها فهد ⇒ صيغةُ المؤنث القاطعة في كلامها خطأ. */
export function scanTurnGenderAddress (speaker, text) {
  const body = String(text || '')
  if (speaker === 'female') {
    return { violations: collect(PATTERNS.femaleHard, body), suspects: collect(PATTERNS.femaleSoft, body) }
  }
  if (speaker === 'male') {
    return { violations: [], suspects: collect(PATTERNS.maleSoft, body) }
  }
  return { violations: [], suspects: [] }
}

export function scanEpisodeGenderAddress (turns) {
  const violations = []
  const suspects = []
  ;(turns || []).forEach((turn, index) => {
    const result = scanTurnGenderAddress(turn?.speaker, turn?.text)
    for (const word of result.violations) violations.push({ index, speaker: turn.speaker, word, text: turn.text })
    for (const word of result.suspects) suspects.push({ index, speaker: turn.speaker, word, text: turn.text })
  })
  return { violations, suspects }
}

/* هل يُدخِل قلبُ الكاست مخاطبةً بجنسٍ خاطئ لم تكن موجودة؟ نقيس الحلقة
   بوسومها الحالية وبوسومها مقلوبةً، ونقارن. لا تخمين: إما أن القلب يزيد
   الخطأ فيُمنَع، أو لا يزيده فيمضي والتنويع محفوظ. */
export function castSwapIntroducesGenderFault (turns) {
  const flipped = (turns || []).map((turn) => ({
    ...turn,
    speaker: turn?.speaker === 'male' ? 'female' : turn?.speaker === 'female' ? 'male' : turn?.speaker,
  }))
  const before = scanEpisodeGenderAddress(turns).violations.length
  const after = scanEpisodeGenderAddress(flipped).violations.length
  return after > before
}
