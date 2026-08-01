import type { ArticleRecord } from './cms'
import { articleSimilarityReport, ideaTokens } from './intelligence.ts'

type ArticleLike = Pick<ArticleRecord, 'slug' | 'title' | 'excerpt' | 'body' | 'cat' | 'iso' | 'hasAudio'>

export type GenuineAdditionReport = {
  verdict: 'إضافة واضحة' | 'إضافة جزئية' | 'قريب من الأرشيف' | 'لا توجد مادة كافية للحكم'
  explanation: string
  nearest: { slug: string; title: string; score: number; year: string }[]
  newTerms: string[]
  repeatedTerms: string[]
  questions: string[]
  evidenceBasis: string
}

export type AbsentPartyAdvocacy = {
  party: string
  strongestObjection: string
  whyItMatters: string
  fairAnswer: string
  questionsBeforePublish: string[]
  addressed: boolean
  evidenceBasis: string
}

export type TimeTest = {
  afterWeek: string
  afterYear: string
  afterDecade: string
  momentBound: string[]
  durable: string[]
  needsContext: string[]
  verdict: 'صالح للبقاء' | 'متوازن بين اللحظة والبقاء' | 'مرتبط بلحظته ويحتاج تأطيراً' | 'لا يوجد نص كافٍ'
  explanation: string
}

const unique = <T,>(items: T[]) => [...new Set(items)]
const words = (value = '') => value.trim().split(/\s+/).filter(Boolean)

function sentences(value = '') {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟…])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 22)
}

function corpusTerms(articles: ArticleLike[]) {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const token of ideaTokens(`${article.title} ${article.excerpt || ''} ${article.body || ''}`)) {
      counts.set(token, (counts.get(token) || 0) + 1)
    }
  }
  return counts
}

/**
 * يقيس الإضافة مقابل الأرشيف نفسه: التشابه الفكري واللفظي، ثم المفردات التي
 * لا تظهر في corpus الكاتب. لا يدّعي أصالة كونية ولا يقارن بالويب.
 */
export function genuineAdditionMeter(title: string, body: string, articles: ArticleLike[]): GenuineAdditionReport {
  if (`${title} ${body}`.trim().length < 40 || articles.length < 3) {
    return {
      verdict: 'لا توجد مادة كافية للحكم',
      explanation: 'أكمل الأطروحة أو النص أولاً؛ القياس لا يحكم على عنوان منفرد.',
      nearest: [],
      newTerms: [],
      repeatedTerms: [],
      questions: ['ما الادعاء الذي لم يقله الأرشيف بهذه الصورة؟'],
      evidenceBasis: `${articles.length} مادة أرشيفية متاحة للمقارنة.`,
    }
  }

  const report = articleSimilarityReport(title, body, articles, 5)
  const counts = corpusTerms(articles)
  const draftTokens = unique(ideaTokens(`${title} ${body}`))
  const newTerms = draftTokens.filter((token) => !counts.has(token)).slice(0, 10)
  const repeatedTerms = draftTokens
    .filter((token) => (counts.get(token) || 0) >= Math.max(3, Math.round(articles.length * .04)))
    .sort((left, right) => (counts.get(right) || 0) - (counts.get(left) || 0))
    .slice(0, 10)
  const highest = report.highest
  const noveltyBreadth = newTerms.length
  const verdict: GenuineAdditionReport['verdict'] = highest >= .52
    ? 'قريب من الأرشيف'
    : highest >= .34 || noveltyBreadth < 2
      ? 'إضافة جزئية'
      : 'إضافة واضحة'
  const explanation = verdict === 'إضافة واضحة'
    ? 'للمسودة زاوية ومفردات لا تتطابق مع أقرب مادة في الأرشيف، مع بقاء صلتها بهوية المشروع.'
    : verdict === 'إضافة جزئية'
      ? 'الفكرة تمتد من الأرشيف، لكن يلزم تسمية الفرق الجديد في الأطروحة أو المثال أو النتيجة.'
      : 'أقرب مادة أرشيفية تحمل معظم الزاوية نفسها؛ الأفضل تحديثها أو تغيير السؤال المركزي قبل إنشاء مقال جديد.'

  return {
    verdict,
    explanation,
    nearest: report.matches.map((item) => ({
      slug: item.slug,
      title: item.title,
      score: item.score,
      year: articles.find((article) => article.slug === item.slug)?.iso?.slice(0, 4) || '',
    })),
    newTerms,
    repeatedTerms,
    questions: [
      'ما الجملة التي لو حُذفت صار المقال نسخة من مادة سابقة؟',
      'هل الجديد معلومة، أم مثال، أم موقف، أم نتيجة عملية؟',
      highest >= .40 ? 'هل الأفضل تحديث أقرب مقال بدل نشر مادة جديدة؟' : 'هل يمكن صياغة الإضافة في سطر واحد داخل المقدمة؟',
    ],
    evidenceBasis: `قورنت المسودة بـ${articles.length} مادة؛ أعلى تطابق أرشيفي فعلي ${Math.round(highest * 100)}٪.`,
  }
}

const PARTY_RULES: Array<{ pattern: RegExp; party: string; concern: string; answer: string }> = [
  {
    pattern: /ذكاء\s+ال?اصطناعي|خوارزم|ChatGPT|تقني|تكنولوجيا|رقمي/i,
    party: 'المعلم أو المختص الذي يخشى اختزال خبرته في أداة',
    concern: 'قد تُقدَّم التقنية بوصفها حلاً محايداً، بينما تنقل التحيز والمسؤولية من الإنسان إلى نظام لا يفهم السياق التربوي كاملاً.',
    answer: 'الرد المنصف لا يرفض الأداة ولا يفوضها؛ يحدد المهمة التي تجيدها، والقرار الذي يجب أن يبقى بشرياً، ومعيار مراجعة النتيجة.',
  },
  {
    pattern: /طالب|طفل|أبناء|تعلم|تعليم|مدرسة|جامعة/i,
    party: 'الطالب أو الأسرة التي ستتحمل أثر القرار',
    concern: 'قد تبدو الفكرة جيدة من زاوية المؤسسة، لكنها تضيف عبئاً أو تفاوتاً أو قلقاً لا يظهر في لغة التخطيط.',
    answer: 'الرد المنصف يذكر كلفة التطبيق على الطالب والأسرة، ويضع حماية عملية وخياراً بديلاً لمن لا يملك الظروف نفسها.',
  },
  {
    pattern: /قيادة|إدارة|قرار|سياسة|وزارة|مؤسسة/i,
    party: 'صاحب القرار المسؤول عن التطبيق والموارد',
    concern: 'قد تكون الأطروحة صحيحة أخلاقياً، لكنها لا توضّح الموارد والزمن والمفاضلات التي تجعلها قابلة للتطبيق.',
    answer: 'الرد المنصف يحول الموقف إلى خطوة محددة، وكلفة معروفة، ومؤشر نجاح يمكن مراجعته بدل الاكتفاء بالمطالبة العامة.',
  },
]

export function absentPartyAdvocate(title: string, body: string): AbsentPartyAdvocacy {
  const text = `${title} ${body}`.trim()
  const rule = PARTY_RULES.find((item) => item.pattern.test(text)) || {
    party: 'القارئ الذي يخالف النتيجة لكنه يشاركك الحرص على الإنسان',
    concern: 'قد تكون المقدمة مقنعة لمن يوافق أصلاً، لكنها لا تختبر الفرضية البديلة ولا تذكر الحالة التي لا تنطبق عليها النتيجة.',
    answer: 'الرد المنصف يعترف بحدود الفكرة، ويذكر الاستثناء الأقوى، ثم يوضح لماذا يبقى الاتجاه المقترح أرجح في هذه الحالة.',
  }
  const lower = text.toLowerCase()
  const addressed = /مع ذلك|في المقابل|قد يعترض|يصح هذا|لا يعني|حدود|استثناء|لكن هذا لا/.test(lower)
  return {
    party: rule.party,
    strongestObjection: rule.concern,
    whyItMatters: 'لأنه اعتراض يختبر صلاحية الفكرة خارج دائرة الموافقين، لا مجرد اعتراض شكلي يمكن تجاوزه.',
    fairAnswer: rule.answer,
    questionsBeforePublish: [
      'هل عرضنا الاعتراض بصيغة يرضى عنها صاحبه؟',
      'هل اعترفنا بالكلفة أو الاستثناء الحقيقي؟',
      'هل ردنا قائم على معيار أو دليل، لا على النبرة وحدها؟',
    ],
    addressed,
    evidenceBasis: addressed
      ? 'رُصد في المسودة قيد أو استثناء أو انتقال صريح إلى وجهة النظر المقابلة.'
      : 'لم تُرصد في المسودة صيغة واضحة تعرض الاعتراض أو حدود الأطروحة.',
  }
}

export function fairObjectionParagraph(advocacy: AbsentPartyAdvocacy) {
  return `وقد يعترض ${advocacy.party} بأن ${advocacy.strongestObjection} وهذا اعتراضٌ يستحق أن يُؤخذ بجدية؛ لذلك ${advocacy.fairAnswer}`
}

const MOMENT_MARKERS = /اليوم|هذا الأسبوع|هذا الشهر|الآن|حالياً|راهن|الأمس|غداً|عام 20\d{2}|20\d{2}|الترند|الحدث|أخيراً/i
const DURABLE_MARKERS = /الإنسان|المعنى|الكرامة|المسؤولية|التعليم|التعلم|المعلم|الطالب|القيمة|السؤال|الوعي|المبدأ|العدالة/i
const CLAIM_MARKERS = /دراسة|بحث|نسبة|إحصاء|أثبت|أكد|يشير|بحسب|تقرير|رقم/i

export function timeTest(title: string, body: string): TimeTest {
  const rows = sentences(body)
  if (!rows.length) {
    return {
      afterWeek: 'لا يوجد نص كافٍ لمحاكاة القراءة.',
      afterYear: 'لا يوجد نص كافٍ لمحاكاة القراءة.',
      afterDecade: 'لا يوجد نص كافٍ لمحاكاة القراءة.',
      momentBound: [], durable: [], needsContext: [], verdict: 'لا يوجد نص كافٍ',
      explanation: 'اكتب الأطروحة وعدة فقرات أولاً.',
    }
  }
  const momentBound = rows.filter((row) => MOMENT_MARKERS.test(row)).slice(0, 6)
  const durable = rows.filter((row) => DURABLE_MARKERS.test(row) && !MOMENT_MARKERS.test(row)).slice(0, 6)
  const needsContext = rows.filter((row) => CLAIM_MARKERS.test(row) && !/https?:\/\//.test(row)).slice(0, 6)
  const ratio = momentBound.length / Math.max(1, rows.length)
  const verdict: TimeTest['verdict'] = ratio >= .42 && durable.length < 2
    ? 'مرتبط بلحظته ويحتاج تأطيراً'
    : momentBound.length && durable.length
      ? 'متوازن بين اللحظة والبقاء'
      : 'صالح للبقاء'
  return {
    afterWeek: momentBound.length
      ? `سيُفهم «${title}» بوصفه تدخلاً في لحظته؛ أبقِ تاريخ الحدث ومصدره ظاهرين.`
      : `سيبقى السؤال المركزي واضحاً بعد انحسار ضجيج النشر.` ,
    afterYear: needsContext.length
      ? 'ستحتاج الأرقام والدراسات إلى تاريخ ومصدر كي لا تُقرأ كحقائق مطلقة بعد تغيّر السياق.'
      : 'الأطروحة قابلة للقراءة بعد سنة لأنها لا تعتمد على رقم مجهول أو خبر عابر.',
    afterDecade: durable.length
      ? `ستبقى الجمل المرتبطة بـ${unique(durable.flatMap(ideaTokens)).slice(0, 3).join('، ') || 'المعنى الإنساني'} هي قلب المادة؛ التفاصيل الزمنية ستكون هوامشها.`
      : 'بعد عشر سنوات قد يبقى الحدث ويضيع المعيار؛ أضف مبدأً إنسانياً أو تربوياً يفسر لماذا تهم الفكرة.',
    momentBound,
    durable,
    needsContext,
    verdict,
    explanation: `${momentBound.length} جملة مرتبطة باللحظة، و${durable.length} جملة تحمل معياراً أبقى، من أصل ${rows.length} جملة قابلة للفحص.`,
  }
}

export function editorialForesight(title: string, body: string, articles: ArticleLike[]) {
  return {
    addition: genuineAdditionMeter(title, body, articles),
    advocate: absentPartyAdvocate(title, body),
    time: timeTest(title, body),
    words: words(body).length,
  }
}
