/**
 * عقل بطاقة الاقتباس — يقرأ النصّ فيختار القالب الذي يليق به.
 *
 * كانت البطاقة تنتظر أن يختار القارئ القالب، فيُجرّب الستة حتى يوفّق. وأكثر
 * القرّاء لا ذائقةَ بصرية لهم، فيختارون أوّلها ويمضون. فجعلنا النصّ نفسه يقترح:
 * جملةٌ حزينةٌ متأمّلة تليق بها فخامة «الليل»، وبيانٌ قويّ يليق به «اللوح»،
 * وخبرٌ صحفيّ روحه «الجريدة». الاقتراح لا يُلزم — القارئ يبدّل إن شاء.
 *
 * ولا نموذج لغويّ ولا شبكة: قراءةٌ حسابيّة للنبرة عبر معاجم كلماتٍ صغيرة، تعمل
 * في المتصفّح فوراً وبلا كلفة. فالذكاء هنا في حسن التصنيف لا في ضخامة الأداة.
 */

export type Tone = 'reflective' | 'assertive' | 'news' | 'tender' | 'classic'

/* القالب المقترَح لكل نبرة. المفاتيح هي CardTemplateKey نفسها في IdeaFeatures. */
export const TONE_TEMPLATE: Record<Tone, string> = {
  reflective: 'layl',    // تأمّلٌ عميق ← فخامة داكنة
  assertive: 'lawh',     // بيانٌ قاطع ← لوحٌ قويّ
  news: 'jarida',        // خبرٌ ووقائع ← روح الصحافة
  tender: 'midad',       // رقّةٌ إنسانية ← المداد الأنيق
  classic: 'tawqee',     // حكمةٌ مجرّدة ← أقصى البساطة
}

export const TONE_LABEL: Record<Tone, string> = {
  reflective: 'تأمّليّ',
  assertive: 'حازم',
  news: 'خبريّ',
  tender: 'إنسانيّ',
  classic: 'حِكميّ',
}

const strip = (value: string) => value.replace(/[ً-ْٰ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')

/* معاجم النبرة: كلماتٌ تُرجّح كفّةَ نبرةٍ على أخرى. صغيرةٌ عمداً — دلائل لا حصر. */
const SIGNALS: Record<Tone, string[]> = {
  reflective: ['لعل', 'ربما', 'نتامل', 'نتساءل', 'في اعماق', 'الروح', 'الوجود', 'المعني', 'الصمت', 'الوحده', 'الذات', 'الحقيقه', 'سؤال', 'نبحث', 'خفي', 'عميق', 'الغموض', 'حين نعود'],
  assertive: ['يجب', 'لابد', 'لا بد', 'ينبغي', 'لن', 'ابدا', 'قطعا', 'حتما', 'المشكله', 'الخطر', 'نرفض', 'كفي', 'توقفوا', 'ليست', 'الحل', 'واجب', 'مسؤوليه', 'خطا فادح'],
  news: ['دراسه', 'احصائيه', 'تقرير', 'ارتفعت', 'انخفض', 'وفق', 'اظهرت', 'كشفت', 'ارقام', 'نسبه', 'المئه', 'عام', 'سنه', 'وجدت', 'اثبتت', 'بينت'],
  tender: ['الطفل', 'الام', 'الاب', 'ابناءنا', 'ابناؤنا', 'قلب', 'حنان', 'دفء', 'حب', 'براءه', 'دمعه', 'يبتسم', 'انسان', 'رحمه', 'الطفوله', 'يحتاج', 'يشعر'],
  classic: ['الحكمه', 'المرء', 'من زرع', 'كما', 'ان', 'لا يقاس', 'يبقي', 'الحياه', 'الزمن', 'العمر', 'المعرفه', 'العلم', 'الجهل'],
}

/**
 * يقرأ النصّ فيعيد النبرة الغالبة، ومعها القالب المقترَح ودرجة الثقة.
 * الثقة نسبةُ فارق المتصدّر عمّا يليه — فإن تقاربت النبرتان قلّت الثقة.
 */
export function readTone(quote: string): { tone: Tone; template: string; confidence: number; scores: Record<Tone, number> } {
  const text = strip(String(quote || ''))
  const scores = { reflective: 0, assertive: 0, news: 0, tender: 0, classic: 0 } as Record<Tone, number>

  for (const tone of Object.keys(SIGNALS) as Tone[]) {
    for (const signal of SIGNALS[tone]) {
      if (text.includes(strip(signal))) scores[tone] += 1
    }
  }
  /* علامات الترقيم دلائلُ نبرة: السؤال يميل للتأمّل، والتعجّب للحزم */
  const q = (quote.match(/؟/g) || []).length
  const bang = (quote.match(/[!]/g) || []).length
  scores.reflective += q * 1.5
  scores.assertive += bang * 1.5

  const ranked = (Object.entries(scores) as [Tone, number][]).sort((a, b) => b[1] - a[1])
  const [topTone, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1] ?? 0

  /* لا دليلَ كافٍ؟ نعود إلى «الكلاسيكية» — أسلمُ من ترجيحٍ بلا أساس */
  if (topScore === 0) return { tone: 'classic', template: TONE_TEMPLATE.classic, confidence: 0, scores }

  const confidence = topScore === 0 ? 0 : (topScore - secondScore) / topScore
  return { tone: topTone, template: TONE_TEMPLATE[topTone], confidence, scores }
}

/** أطول جملةٍ مكتملة في نصٍّ — للاقتباس التلقائيّ من مقالٍ كامل */
export function pickQuotableSentence(body: string): string {
  const sentences = String(body || '')
    .split(/(?<=[.؟!…])\s+|\n+/)
    .map((line) => line.trim().replace(/^[«"]|[»"]$/g, '').trim())
    .filter((line) => line.length >= 40 && line.length <= 180)
  if (!sentences.length) return ''
  /* الجملة التي فيها فعلٌ ومعنًى مكتمل خيرٌ من الأطول — نُرجّح المتوسطة الغنيّة */
  return sentences.sort((a, b) => scoreQuotable(b) - scoreQuotable(a))[0]
}

function scoreQuotable(sentence: string): number {
  const words = sentence.split(/\s+/).length
  const ideal = Math.max(0, 1 - Math.abs(words - 16) / 16)   // ذروةٌ عند 16 كلمة
  const hasContrast = /\bلا\b|لكن|بل|ليس|رغم|مع ذلك/.test(sentence) ? 0.3 : 0
  return ideal + hasContrast
}
