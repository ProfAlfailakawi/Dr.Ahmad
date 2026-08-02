#!/usr/bin/env node
/**
 * مقياس «هل هذا صوته؟» لمقاطع الكتب.
 *
 * المشكلة: كتب الدكتور تضم نصّه هو، وتضم فقراتٍ مترجمة أو منقولة عن مصادر
 * أجنبية داخل الكتاب. النسبة صحيحة في الحالتين (كلاهما من كتابه)، لكن
 * الصوت ليس واحداً. فإذا عرضنا المنقول باسمه بدا كأنه يكتب كمترجم.
 *
 * الحل: نقيس كل مقطع على بصمته المقيسة فعلاً من ١٤٣ مقالاً
 * (src/lib/style-dna.mjs — FALLBACK_STYLE_DNA، مقيسة ١ أغسطس ٢٠٢٦):
 *   وسيط الجملة ٩ كلمات · نسبة الجمل القصيرة ٥١٪ · «…» ٥٫٣ لكل ١٠٠ كلمة
 *   · «بل» ٠٫٩ · ضمير الجماعة ٠٫٤ · «« »» ٠٫٥
 *
 * ولا نحذف المنقول — نرتّبه بعده فقط. فالمنقول معرفةٌ اختارها الدكتور
 * لكتابه، لكن الواجهة تبدأ بما هو أقرب إلى قلمه.
 */
import { FALLBACK_STYLE_DNA } from '../src/lib/style-dna.mjs'

const DNA = FALLBACK_STYLE_DNA

/* ═══ علامات صوته ═══ */
const HIS_MARKS = [
  { test: /…/, weight: 14, why: 'وقفة «…»' },
  { test: /(?<!\p{L})بل(?!\p{L})/u, weight: 12, why: 'استدراك «بل»' },
  { test: /؟/, weight: 10, why: 'سؤال' },
  { test: /(?<!\p{L})(?:نحن|علينا|نحتاج|دعونا|نعيش|نربّي|نربي|نصنع)(?!\p{L})/u, weight: 10, why: 'ضمير الجماعة' },
  { test: /«[^»]{2,60}»/u, weight: 7, why: 'تنصيص «»' },
  { test: /(?<!\p{L})(?:ليس|لا)(?!\p{L})[^.؟!]{0,40}(?<!\p{L})بل(?!\p{L})/u, weight: 8, why: 'نفيٌ ثم إثبات' },
]

/* ═══ علامات النقل والترجمة ═══
   تراكيب لا تكاد تظهر في مقالاته وتغلب على النثر المترجم: الربط الثقيل،
   والمبني للمجهول بـ«يتم/تم»، والإحالة التقريرية. */
const IMPORTED_MARKS = [
  { test: /بالإضافة إلى ذلك/u, weight: 12, why: 'ربط مترجم' },
  { test: /علاوة على ذلك/u, weight: 12, why: 'ربط مترجم' },
  { test: /من ناحية أخرى/u, weight: 10, why: 'ربط مترجم' },
  { test: /على سبيل المثال/u, weight: 7, why: 'ربط تقريري' },
  { test: /(?<!\p{L})(?:يتم|تتم|تم)(?!\p{L})/u, weight: 11, why: 'مبني للمجهول «يتم»' },
  { test: /(?<!\p{L})(?:وفقاً|طبقاً)(?!\p{L})/u, weight: 8, why: 'إحالة مترجمة' },
  { test: /بشكل (?:متزايد|كبير|أساسي|رئيسي)/u, weight: 9, why: 'تعبير مترجم' },
  { test: /من المهم أن/u, weight: 7, why: 'تقرير مترجم' },
  { test: /(?<!\p{L})(?:الكمبيوتر|الإنترنت|الديناميكية|الاستراتيجية)(?!\p{L})/u, weight: 4, why: 'مصطلح معرَّب' },
]

const words = (value = '') => String(value).trim().split(/\s+/).filter(Boolean)
const sentences = (value = '') => String(value).split(/(?<=[.؟!])\s+/).map((item) => item.trim()).filter(Boolean)
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/**
 * درجة القرب من صوته: ٠ إلى ١٠٠.
 * ٥٠ هي الحياد — لا علامة له ولا عليه.
 */
export function voiceScore(text = '') {
  const list = sentences(text)
  const lengths = list.map((item) => words(item).length).filter(Boolean)
  if (!lengths.length) return { score: 50, reasons: [] }

  let score = 50
  const reasons = []

  for (const mark of HIS_MARKS) {
    if (mark.test.test(text)) { score += mark.weight; reasons.push(`+ ${mark.why}`) }
  }
  for (const mark of IMPORTED_MARKS) {
    if (mark.test.test(text)) { score -= mark.weight; reasons.push(`− ${mark.why}`) }
  }

  /* إيقاع الجملة: وسيط جمله ٩ كلمات. كلما اقترب المقطع منه اقترب من نَفَسه. */
  const sorted = lengths.slice().sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const distance = Math.abs(median - DNA.sentence.median)
  score += clamp(10 - distance * 1.6, -12, 10)
  if (distance <= 3) reasons.push('+ إيقاع جملته')
  else if (distance >= 9) reasons.push('− جملة أطول من نَفَسه')

  /* نصف جمله قصيرة (٥١٪). النثر المترجم يميل إلى الجمل الطويلة المركّبة. */
  const shortRate = Math.round(lengths.filter((value) => value <= 9).length / lengths.length * 100)
  score += clamp((shortRate - 25) / 6, -8, 8)

  /* جملةٌ تتجاوز ٣٠ كلمة نادرة عنده جداً (نسبة الطويلة ١١٪ فقط). */
  if (sorted[sorted.length - 1] >= 30) { score -= 8; reasons.push('− جملة مطوّلة') }

  return { score: Math.round(clamp(score, 0, 100)), reasons }
}

/** تصنيفٌ يُعرض للدكتور في المراجعة — لا للزوار. */
export function voiceBand(score) {
  if (score >= 68) return 'قريب من قلمه'
  if (score >= 46) return 'محايد'
  return 'منقول أو مترجم'
}
