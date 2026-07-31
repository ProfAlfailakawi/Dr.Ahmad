import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'

/* ⚠️ محرك «الطبعة الفاخرة» — لا يُستبدل بنسخة مبسّطة.
   استُعيد ٢٠٢٦-٠٧-١٩ بعد أن قلّصته دفعةٌ موازية من 1060 سطراً إلى 572، ففقدت
   القوالبُ فهمَها الموزون للمحتوى (TOPIC_SIGNALS) و550 سطراً من الرسم الفني
   (الحرف الاستهلالي الظلي، الإطار المذهّب، ترويسة الجريدة، قوس المشكاة…).
   أي تبسيط هنا يُفقد الاستوديو هويته البصرية — عدّل بالإضافة لا بالاستبدال. */
export type VisualTopic = 'ai' | 'education' | 'family' | 'research' | 'media' | 'future' | 'human' | 'general'

export type SocialVisualLayout =
  | 'editorial'
  | 'quote'
  | 'split'
  | 'dark'
  | 'event'
  | 'timeline'
  | 'question'
  | 'signature'
  | 'orbit'
  | 'signal'
  | 'window'
  | 'manifesto'
  | 'circuit'
  | 'notebook'
  | 'human'
  | 'research'
  | 'horizon'
  | 'dialogue'
  | 'arch'
  | 'matrix'
  | 'layers'
  | 'focus'
  | 'wave'
  | 'balance'

export type SocialVisualTemplate = {
  id: string
  platform: 'instagram' | 'story' | 'linkedin' | 'x'
  format: string
  layout: SocialVisualLayout
  topic: VisualTopic
  width: number
  height: number
  kicker: string
  title: string
  body: string
  footer?: string
  source?: string
}

export type SocialPackVisualInput = {
  carouselSlides?: { kicker: string; title: string; body: string }[]
  stories?: string[]
  visualDirections?: { layout: string; tone: string; headline: string; subline: string }[]
  event?: { source?: string; title?: string } | null
  generatedAt?: string
  visualSeed?: string
}

const layouts: SocialVisualLayout[] = [
  'editorial', 'orbit', 'quote', 'signal', 'split', 'window', 'dark', 'timeline', 'question',
  'manifesto', 'event', 'signature', 'circuit', 'notebook', 'human', 'research', 'horizon', 'dialogue', 'arch', 'matrix', 'layers', 'focus', 'wave', 'balance',
]

const topicProfiles: Record<VisualTopic, { label: string; kicker: string; closer: string; layouts: SocialVisualLayout[] }> = {
  ai: {
    label: 'ذكاء اصطناعي وتكنولوجيا',
    kicker: 'الإنسان داخل التكنولوجيا',
    closer: 'الأداة تتغير؛ المعيار الإنساني يبقى.',
    layouts: ['circuit', 'signal', 'orbit', 'matrix', 'dark', 'split', 'manifesto', 'question'],
  },
  education: {
    label: 'تعليم وتعلّم',
    kicker: 'من قلب التعلّم',
    closer: 'ما الذي سيتغير داخل الصف؟',
    layouts: ['notebook', 'editorial', 'window', 'arch', 'question', 'timeline', 'human', 'split'],
  },
  family: {
    label: 'أسرة وطفل',
    kicker: 'قربٌ يحمي المعنى',
    closer: 'التربية علاقة قبل أن تكون تعليمات.',
    layouts: ['human', 'window', 'quote', 'signature', 'dialogue', 'layers', 'editorial', 'question'],
  },
  research: {
    label: 'بحث ومعرفة',
    kicker: 'الدليل قبل الانطباع',
    closer: 'السؤال الجيد يسبق النتيجة الجيدة.',
    layouts: ['research', 'timeline', 'matrix', 'split', 'manifesto', 'dark', 'notebook', 'editorial'],
  },
  media: {
    label: 'إعلام ومجتمع رقمي',
    kicker: 'خلف المشهد',
    closer: 'لا يكفي أن يصل الصوت؛ المهم ماذا يصنع.',
    layouts: ['dialogue', 'signal', 'wave', 'event', 'split', 'quote', 'dark', 'window'],
  },
  future: {
    label: 'مستقبل وقيادة',
    kicker: 'أفق القرار',
    closer: 'المستقبل قرار يُصمَّم، لا خبر ننتظره.',
    layouts: ['horizon', 'orbit', 'arch', 'balance', 'manifesto', 'dark', 'circuit', 'timeline', 'signature'],
  },
  human: {
    label: 'الإنسان والمعنى',
    kicker: 'الإنسان أولاً',
    closer: 'كل فكرة تُقاس بما تتركه في الإنسان.',
    layouts: ['human', 'signature', 'focus', 'quote', 'window', 'editorial', 'dialogue', 'horizon'],
  },
  general: {
    label: 'فكرة عامة',
    kicker: 'فكرة تستحق التوقف',
    closer: 'الأثر قبل الانبهار.',
    layouts: ['editorial', 'orbit', 'focus', 'layers', 'quote', 'split', 'question', 'manifesto', 'signature'],
  },
}

const normalizeArabic = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')

/* فهم أعمق لما يكتبه الدكتور: كل موضوع يُوزن بعدد الكلمات الدالة التي يلامسها النص،
   ويُختار الأعلى وزناً — فلا تحسمه كلمة واحدة عابرة، بل مجمل معنى الجملة. القوائم
   موسّعة بمفردات مجاله الفعلي (تعليم إلكتروني، تلعيب، واقع معزز، مواطنة رقمية…). */
const TOPIC_SIGNALS: Record<Exclude<VisualTopic, 'general'>, RegExp[]> = {
  ai: [/ذكاء\s*ا?ل?اصطناع/, /خوارزم/, /تقني/, /تكنولوجيا/, /رقمي/, /روبوت/, /بيانات/, /منصه/, /شاشه/, /اتمته/, /نموذج لغوي/, /تشات|شات جي/, /اداه ذكيه/, /تعلم الي/, /تعلم عميق/],
  family: [/طفل|اطفال/, /ابن|ابناء/, /اسره|اسري/, /والد|والدين/, /اموم/, /ابو/, /تربيه منزليه/, /مراهق/, /بيت/, /عائل/],
  research: [/بحث|ابحاث/, /دراس/, /اكاديمي/, /جامع/, /منهج علمي/, /استبيان/, /مرجع/, /عينه/, /احصائ/, /متغير/, /محكم/, /نتائج/],
  media: [/اعلام/, /ميديا/, /منصات اجتماعي/, /سوشيال/, /خبر|اخبار/, /صحاف/, /تلفزيون/, /بودكاست/, /متابع/, /محتوي/, /انتشار/, /مؤثر/],
  future: [/مستقبل/, /قياد/, /ابتكار/, /تحول/, /استشراف/, /قرار/, /مؤسس/, /رؤيه/, /استراتيج/, /رياده/, /تطوير/],
  education: [/تعليم|تعلم/, /معلم/, /طالب|طلاب|طلبه/, /مدرس/, /صف|صفوف/, /امتحان|اختبار/, /تقييم|تقويم/, /منهج|مناهج/, /تلعيب/, /واقع معزز/, /فصل مقلوب/, /مهار/, /كفاي/, /تحصيل/, /مقرر/, /واجب/, /درج/],
  human: [/انسان/, /معني/, /وعي/, /كرام/, /اخلاق/, /هويه/, /قيم/, /حريه/, /ضمير/, /روح/, /نفس/, /تعاطف/, /حكم/],
}

function visualTopicFromDomainGlossary(value: string): VisualTopic | null {
  const understanding = interpretDrAhmadDomain(value)
  if (!understanding.primary && understanding.confidence < 60) return null
  const corpus = normalizeArabic([
    understanding.primary?.domain,
    understanding.primary?.canonicalAr,
    understanding.primary?.canonicalEn,
    understanding.recognizedFrom,
    understanding.compoundMeaning,
    understanding.moods.join(' '),
  ].filter(Boolean).join(' '))
  if (/(?:اسره|طفل|والد|تربيه منزليه|مراهق)/.test(corpus)) return 'family'
  if (/(?:بحث|اكاديمي|منهج|احصا|بيانات|قياس)/.test(corpus)) return 'research'
  if (/(?:اعلام|ميديا|صحاف|اتصال|مجتمع رقمي)/.test(corpus)) return 'media'
  if (/(?:تعليم|تعلم|تربوي|مدرس|جامع|متعلم|منصات التعلم)/.test(corpus)) return 'education'
  if (/(?:بيئات غامره|واقع افتراضي|واقع معزز|ميتافيرس|مستقبل|ابتكار|تحول|استشراف|قياد)/.test(corpus)) return 'future'
  if (/(?:ذكاء اصطناعي|تقني|تكنولوج|رقمي|روبوت|خوارزم)/.test(corpus)) return 'ai'
  if (/(?:انسان|نفسي|علم النفس|رفاه|قيم|اخلاق|هويه|تعاطف|وعي)/.test(corpus)) return 'human'
  return null
}

export function detectVisualTopic(value: string): VisualTopic {
  const text = normalizeArabic(value)
  let best: VisualTopic = 'general'
  let bestScore = 0
  for (const [topic, signals] of Object.entries(TOPIC_SIGNALS) as [Exclude<VisualTopic, 'general'>, RegExp[]][]) {
    const score = signals.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0)
    if (score > bestScore) { bestScore = score; best = topic }
  }
  if (best !== 'general') return best
  return visualTopicFromDomainGlossary(value) || 'general'
}

export function visualTopicLabel(topic: VisualTopic) {
  return topicProfiles[topic].label
}

export type SocialCopyAnalysis = {
  topic: VisualTopic
  topicLabel: string
  shape: TextShape
  tone: 'رسمي' | 'إنساني' | 'نقدي' | 'مستقبلي'
  recommendedFormat: 'منشور واحد' | 'شرائح'
  recommendedSlides: number
  keyPhrase: string
}

export function analyzeSocialCopy(value: string): SocialCopyAnalysis {
  const raw = String(value || '').replace(/\s+/g, ' ').trim()
  const topic = detectVisualTopic(raw)
  const shape = detectTextShape(raw)
  const normalized = normalizeArabic(raw)
  const tone: SocialCopyAnalysis['tone'] = /لكن|مشكله|خطر|نقد|يفشل|لا يكفي/.test(normalized)
    ? 'نقدي'
    : /انسان|طفل|اسره|مشاعر|كرامه|وعي/.test(normalized)
      ? 'إنساني'
      : /مستقبل|تحول|ابتكار|ذكاء اصطناعي|تقنيه/.test(normalized)
        ? 'مستقبلي'
        : 'رسمي'
  const words = raw.split(/\s+/).filter(Boolean)
  const recommendedSlides = words.length > 95 ? 7 : words.length > 60 ? 5 : words.length > 34 ? 3 : 1
  const sentences = raw.split(/(?<=[.!؟])/u).map((part) => part.trim()).filter(Boolean)
  const keyPhrase = (sentences.sort((a, b) => b.length - a.length)[0] || raw).slice(0, 150)
  return {
    topic,
    topicLabel: visualTopicLabel(topic),
    shape,
    tone,
    recommendedFormat: recommendedSlides > 1 ? 'شرائح' : 'منشور واحد',
    recommendedSlides,
    keyPhrase,
  }
}

const AUTHOR_NAME = 'د. أحمد حسين الفيلكاوي'
const cleanIdentityFooter = (value = '') => {
  const cleaned = String(value || '')
    .replace(/د\.?\s*أحمد\s+حسين\s+الفيلكاوي/gi, '')
    .replace(/[·|—-]\s*dr-alfailakawi\.com/gi, 'dr-alfailakawi.com')
    .replace(/^\s*[·|—-]\s*|\s*[·|—-]\s*$/g, '')
    .trim()
  return cleaned || 'dr-alfailakawi.com'
}

/* ═══ قراءةُ شكل النصّ — لا موضوعِه وحده ═══
 *
 * كان اختيار التخطيط يعرف «عمّا» تتحدث البطاقة (TOPIC_SIGNALS) ولا يعرف «كيف»
 * تتحدث. فيقع سؤالٌ صريح في تخطيط «مانيفستو»، وتقع مقابلةٌ بين طرفين في تخطيط
 * لا موضع فيه لطرفين — والتصميم صحيحٌ والنصُّ في غير بيته.
 *
 * وشكلُ الجملة يُقرأ من علاماتها لا من معناها: الاستفهام يُعرف بأداته، والمقابلة
 * بـ«لا… بل»، والعدد برقمه. فنقرؤه ونُسكن كل نصٍّ في التخطيط الذي بُني له.
 */
export type TextShape = 'question' | 'contrast' | 'number' | 'sequence' | 'call' | 'definition' | 'statement'

/* ⚠️ لا تُستعمل \b هنا أبداً. حدُّ الكلمة في JavaScript معرَّفٌ على [A-Za-z0-9_]
   وحدها، فلا يرى الحرف العربي كلمةً ولا يضع بينه وبين جاره حدّاً. وكلُّ نمطٍ
   كُتب بـ\b سقط صامتاً وأرجع «statement» لكل نصٍّ في الدنيا. البديل الصحيح
   (?:^|\s) و(?:\s|$). والنصّ يصل مطبَّعاً: أ/إ/آ←ا · ى←ي · ة←ه · بلا تشكيل. */
const SHAPE_SIGNALS: [TextShape, RegExp][] = [
  ['question', /[؟?]\s*$|^(?:هل|لماذا|كيف|متي|اين|ماذا|ما الذي|من الذي|اي|ايهما)(?:\s|$)/],
  /* «لا … بل» قد يفصل بينهما أربع كلمات: «لا يُقاس بما شرحه بل بما لاحظه».
     وحصرُها في كلمةٍ واحدة يُسقط أكثر مقابلات الدكتور — وهي أسلوبه الغالب. */
  ['contrast', /(?:^|\s)لا\s+(?:\S+\s+){0,4}بل(?:\s|$)|(?:^|\s)ليس\s+(?:\S+\s+){0,4}(?:بل|وانما|انما)(?:\s|$)|(?:^|\s)بين\s+\S+\s+و\S+|(?:^|\s)من\s+\S+\s+الي\s+\S+|(?:^|\s)لكن(?:\s|$)|(?:^|\s)بينما(?:\s|$)|في المقابل/],
  ['number', /[0-9٠-٩]|٪|%|(?:^|\s)(?:نسبه|ضعف|اضعاف|ثلث|ربع|نصف|مرات)(?:\s|$)/],
  ['sequence', /(?:^|\s)(?:اولا|ثانيا|ثالثا)(?:\s|$|،)|(?:^|\s)[-•·]\s/],
  ['call', /^(?:علينا|يجب|لنبدا|لنسال|فلنبدا|ابدا|توقف|جرب|اسال)(?:\s|$)|ان الاوان|لا بد ان(?:\s|$)/],
  ['definition', /(?:^|\s)(?:هو|هي)\s+ان(?:\s|$)|(?:^|\s)(?:تعني|يعني)(?:\s|$)|(?:^|\s)المقصود(?:\s|$)|(?:^|\s)تعريف/],
]

export function detectTextShape(value: string): TextShape {
  const text = normalizeArabic(String(value || '')).trim()
  if (!text) return 'statement'
  for (const [shape, pattern] of SHAPE_SIGNALS) if (pattern.test(text)) return shape
  return 'statement'
}

/* لكل شكلٍ بيوتُه، مرتّبةً من الأليق فالأقلّ — ولا يخرج شيءٌ عن التخطيطات
   الأربعة والعشرين القائمة، فلا يُمسّ الرسم الفنّي بحرف. */
const SHAPE_LAYOUTS: Record<TextShape, SocialVisualLayout[]> = {
  question: ['question', 'focus', 'window', 'arch', 'quote'],
  contrast: ['balance', 'split', 'layers', 'matrix', 'dialogue'],
  number: ['matrix', 'research', 'signal', 'timeline', 'circuit'],
  sequence: ['timeline', 'layers', 'notebook', 'matrix', 'research'],
  call: ['manifesto', 'signature', 'horizon', 'dark', 'focus'],
  definition: ['editorial', 'notebook', 'research', 'window', 'split'],
  statement: ['editorial', 'quote', 'orbit', 'human', 'horizon', 'wave'],
}

/**
 * التخطيط المناسب لهذه البطاقة بعينها: شكلُ نصّها أولاً، ثم بابُ موضوعها،
 * ثم الدوران العام. ولا يتكرر تخطيطان متجاوران — فالتنويع شرطُ الجمال لا زينته.
 */
function layoutForSlide(
  text: string,
  topic: VisualTopic,
  fallbacks: SocialVisualLayout[],
  used: SocialVisualLayout[],
  seed: string,
): SocialVisualLayout {
  const shape = detectTextShape(text)
  const previous = used[used.length - 1]
  const ranked = [
    ...SHAPE_LAYOUTS[shape],
    ...topicProfiles[topic].layouts,
    ...fallbacks,
  ].filter((layout, index, all) => all.indexOf(layout) === index)

  const offset = hashText(`${seed}:${shape}`) % Math.max(SHAPE_LAYOUTS[shape].length, 1)
  const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)]
  return rotated.find((layout) => layout !== previous && !used.includes(layout))
    || rotated.find((layout) => layout !== previous)
    || ranked[0]
}

const safeLayout = (value = '', index = 0): SocialVisualLayout =>
  layouts.includes(value as SocialVisualLayout) ? value as SocialVisualLayout : layouts[index % layouts.length]

const hashText = (value: string) => [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261)

const diverseLayouts = (
  seed: string,
  count: number,
  directions: SocialPackVisualInput['visualDirections'],
  topic: VisualTopic,
) => {
  const start = hashText(seed) % layouts.length
  const requested = (directions || [])
    .map((item) => safeLayout(item.layout))
    .filter((layout, index, all) => all.indexOf(layout) === index)
  const topicLayouts = topicProfiles[topic].layouts
  const rotated = [...layouts.slice(start), ...layouts.slice(0, start)]
  return [...requested, ...topicLayouts, ...rotated]
    .filter((layout, index, all) => all.indexOf(layout) === index)
    .slice(0, count)
}

type SlideDraft = { kicker: string; title: string; body: string; layout?: SocialVisualLayout }

const dedupeSlides = (slides: SlideDraft[]) => slides
  .filter((slide) => slide.title.trim())
  .filter((slide, index, all) => all.findIndex((candidate) => candidate.title.trim() === slide.title.trim()) === index)

export function buildSocialVisuals(pack: SocialPackVisualInput, article: { title: string; excerpt: string }) {
  const directions = pack.visualDirections || []
  const topic = detectVisualTopic(`${article.title} ${article.excerpt} ${directions.map((item) => `${item.headline} ${item.subline}`).join(' ')}`)
  const profile = topicProfiles[topic]
  const baseSlides = pack.carouselSlides?.length ? pack.carouselSlides : [
    { kicker: profile.kicker, title: article.title, body: article.excerpt },
  ]
  /* اختيارُ الدكتور يتقدّم على استنتاجنا. حين يحدّد اللوحُ تخطيطاً لاتجاهٍ بعينه
     (circuit مع «الأداة ذكية…»، orbit مع «ضع الإنسان في المركز») فذلك قرارٌ
     ذوقيّ لا يُنقض بقاعدة. وقراءةُ الشكل تتولّى ما لم يُحدَّد وحده. */
  const directionSlides: SlideDraft[] = directions.map((item) => ({
    kicker: item.tone || profile.kicker,
    title: item.headline || article.title,
    body: item.subline || article.excerpt,
    ...(item.layout && layouts.includes(item.layout as SocialVisualLayout)
      ? { layout: item.layout as SocialVisualLayout }
      : {}),
  }))
  const slides = dedupeSlides([
    ...baseSlides,
    ...directionSlides,
    { kicker: 'الخلاصة', title: profile.closer, body: article.excerpt },
  ]).slice(0, 8)

  const visualSeed = pack.visualSeed || pack.generatedAt || 'first-edition'
  const selectedLayouts = diverseLayouts(`${article.title}:${article.excerpt}:${pack.event?.title || ''}:${visualSeed}`, 18, directions, topic)
  const variantLabels = ['معالجة بديلة', 'زاوية إنسانية', 'نسخة مختصرة', 'تكوين بصري آخر', 'وقفة تأمل', 'امتداد الفكرة']
  const visualCount = Math.min(12, Math.max(8, slides.length * 2))
  const visualSlides = Array.from({ length: visualCount }, (_, index) => {
    const slide = slides[index % slides.length]
    if (index < slides.length) return slide
    return {
      ...slide,
      kicker: `${slide.kicker || profile.kicker} · ${variantLabels[(index - slides.length) % variantLabels.length]}`,
    }
  })
  /* التخطيط يُختار لكل بطاقةٍ من نصّها هي — سؤالٌ يسكن تخطيط السؤال، ومقابلةٌ
     تسكن تخطيط الميزان. والمسار يحفظ ما استُعمل فلا يتجاور تخطيطان. */
  const usedLayouts: SocialVisualLayout[] = []
  const instagramLayouts = visualSlides.map((slide, index) => {
    const chosen = (slide as SlideDraft).layout
    const layout = chosen && chosen !== usedLayouts[usedLayouts.length - 1]
      ? chosen
      : layoutForSlide(
        `${slide.title} ${slide.body}`,
        topic,
        selectedLayouts,
        usedLayouts,
        `${article.title}:${visualSeed}:${index}`,
      )
    usedLayouts.push(layout)
    return layout
  })

  const instagram: SocialVisualTemplate[] = visualSlides.map((slide, index) => ({
    id: `instagram-${topic}-${index + 1}`,
    platform: 'instagram',
    format: index === 0 ? 'غلاف كاروسيل' : index < slides.length ? 'بطاقة كاروسيل' : 'تنويع بصري بديل',
    layout: instagramLayouts[index],
    topic,
    width: 1080,
    height: 1350,
    kicker: slide.kicker || (index === 0 ? profile.kicker : 'امتداد الفكرة'),
    title: slide.title || article.title,
    body: slide.body || '',
    footer: index === visualSlides.length - 1 ? 'اقرأ الفكرة كاملة في الموقع' : 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }))

  const storyTexts = [...(pack.stories || []), profile.closer]
    .filter(Boolean)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 5)
  const stories: SocialVisualTemplate[] = storyTexts.map((text, index) => ({
    id: `story-${topic}-${index + 1}`,
    platform: 'story',
    format: 'قصة عمودية',
    layout: layoutForSlide(text, topic, selectedLayouts, usedLayouts, `${article.title}:${visualSeed}:story:${index}`),
    topic,
    width: 1080,
    height: 1920,
    kicker: index === 0 ? profile.kicker : 'من الفكرة',
    title: text,
    body: index === 0 ? article.title : '',
    footer: 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }))

  const linkedin: SocialVisualTemplate = {
    id: `linkedin-${topic}-cover`,
    platform: 'linkedin',
    format: 'LinkedIn 1200×627',
    layout: layoutForSlide(`${directions[0]?.headline || article.title} ${directions[0]?.subline || article.excerpt}`, topic, selectedLayouts, usedLayouts, `${article.title}:${visualSeed}:in`),
    topic,
    width: 1200,
    height: 627,
    kicker: directions[0]?.tone || profile.kicker,
    title: directions[0]?.headline || article.title,
    body: directions[0]?.subline || article.excerpt,
    footer: 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }

  const x: SocialVisualTemplate = {
    id: `x-${topic}-square`,
    platform: 'x',
    format: 'X 1080×1080',
    layout: layoutForSlide(profile.closer, topic, selectedLayouts, usedLayouts, `${article.title}:${visualSeed}:x`),
    topic,
    width: 1080,
    height: 1080,
    kicker: profile.kicker,
    title: profile.closer,
    body: article.title,
    footer: 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }

  return { instagram, stories, linkedin, x, topic, topicLabel: profile.label }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maximumLines: number) {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maximumLines)
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return y + lines.length * lineHeight
}

function fittedTitleSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maximumLines: number, preferred: number, minimum: number) {
  let size = preferred
  while (size > minimum) {
    ctx.font = `700 ${Math.round(size)}px "El Messiri", "Tajawal", sans-serif`
    if (wrapLines(ctx, text, maxWidth).length <= maximumLines) return Math.round(size)
    size -= 2
  }
  return Math.round(minimum)
}

async function loadLogo() {
  const image = new Image()
  image.decoding = 'async'
  image.src = '/logo.png'
  // مهلة صارمة: الشعار زينة لا يملك سلطة تعليق رسم القالب كله إن تلكأ فك ترميزه
  await Promise.race([
    image.decode(),
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('logo-timeout')), 2500)),
  ])
  return image
}

/* ═══════════ الطبعة الفاخرة: ست تكوينات فنية موقّعة ═══════════
   بدل هيكلٍ واحد يتكرر بخربشة شفافة، كل تكوين هنا بنية بصرية مستقلة بهوية
   الموقع (أحادية اللون + #3E5C78) وذهبٍ مخطوطي هادئ:
   «المداد» مخطوطة بحرف استهلالي ظلي وإطار مذهّب · «الليل» سماء داكنة بهالة
   ذهبية · «الجريدة» صفحة رأي بترويسة صحفية · «الشريط» عارضة سينمائية بلون
   الموقع · «المشكاة» قوس معماري إسلامي · «التوقيع» صفحة بيضاء بخط توقيع حي.
   التخطيطات القديمة كلها تُسنَد إلى أحد التكوينات فلا يتغير أي استدعاء خارجي. */

type Composition = 'midad' | 'layl' | 'jarida' | 'sharit' | 'mishkat' | 'tawqee' | 'mursim' | 'hibr' | 'fajr' | 'sajjada' | 'ruqaa' | 'sada'

const compositionOf = (layout: SocialVisualLayout): Composition => {
  if (layout === 'dark' || layout === 'matrix') return 'layl'
  if (layout === 'manifesto' || layout === 'editorial' || layout === 'notebook') return 'jarida'
  if (layout === 'split' || layout === 'event') return 'sharit'
  if (layout === 'arch' || layout === 'window') return 'mishkat'
  if (layout === 'signature' || layout === 'quote') return 'tawqee'
  if (layout === 'circuit' || layout === 'research') return 'mursim'
  if (layout === 'focus' || layout === 'human') return 'hibr'
  if (layout === 'horizon' || layout === 'orbit') return 'fajr'
  if (layout === 'layers' || layout === 'timeline') return 'sajjada'
  if (layout === 'signal' || layout === 'wave') return 'ruqaa'
  if (layout === 'balance') return 'sada'
  return 'midad'
}

type Ink = { bg: string; ink: string; soft: string; accent: string; gold: string; line: string; card: string }

const INKS: Record<Composition, Ink> = {
  midad: { bg: '#F6F1E6', ink: '#191713', soft: '#6E675C', accent: '#3E5C78', gold: '#A98A52', line: '#D9D0BE', card: '#FFFDF7' },
  layl: { bg: '#0F1216', ink: '#F5F2EA', soft: '#AEB4BD', accent: '#8FB0CC', gold: '#C9A96C', line: 'rgba(255,255,255,.16)', card: '#191E25' },
  jarida: { bg: '#FBFAF6', ink: '#111319', soft: '#666C76', accent: '#3E5C78', gold: '#A98A52', line: '#D8D6CE', card: '#FFFFFF' },
  sharit: { bg: '#F0F2F4', ink: '#14161B', soft: '#6A727C', accent: '#3E5C78', gold: '#C9A96C', line: '#CDD4DA', card: '#FFFFFF' },
  mishkat: { bg: '#F5F2EA', ink: '#181613', soft: '#6F695E', accent: '#3E5C78', gold: '#A98A52', line: '#DBD3C2', card: '#FFFDF7' },
  tawqee: { bg: '#FFFFFF', ink: '#14161B', soft: '#6E747E', accent: '#3E5C78', gold: '#A98A52', line: '#E2E2DE', card: '#FBFAF7' },
  mursim: { bg: '#182B3E', ink: '#EAF1F7', soft: '#9FB4C6', accent: '#8FB0CC', gold: '#C9A96C', line: 'rgba(234,241,247,.22)', card: '#213850' },
  hibr: { bg: '#F8F5EE', ink: '#15161A', soft: '#6F6C64', accent: '#2E4B66', gold: '#A98A52', line: '#DCD5C6', card: '#FFFFFF' },
  fajr: { bg: '#1B2430', ink: '#F7F3EA', soft: '#C4BFB2', accent: '#3E5C78', gold: '#D8B26E', line: 'rgba(247,243,234,.2)', card: '#242F3D' },
  sajjada: { bg: '#F7F2E7', ink: '#191713', soft: '#6E675C', accent: '#3E5C78', gold: '#A98A52', line: '#DAD1BF', card: '#FFFDF7' },
  ruqaa: { bg: '#F4F4F1', ink: '#15161A', soft: '#71767E', accent: '#3E5C78', gold: '#C9A96C', line: '#D9D9D4', card: '#FFFFFF' },
  sada: { bg: '#FBFAF7', ink: '#14161B', soft: '#767B84', accent: '#3E5C78', gold: '#A98A52', line: '#DFDFDA', card: '#FFFFFF' },
}

const hashSeed = (value: string) => { let hash = 0; for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return hash }

const setLetterSpacing = (ctx: CanvasRenderingContext2D, px: number) => {
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px` } catch { /* متصفح أقدم */ }
}

/* أدوات الزخرفة الإجرائية — كلها حتمية (بذرة نصية) فتبدو كل بطاقة مصنوعة يدوياً */

const paperGrain = (ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, color: string) => {
  ctx.save(); ctx.fillStyle = color
  for (let index = 0; index < 420; index += 1) {
    const gx = ((seed * (index + 17)) % 1009) / 1009 * W
    const gy = ((seed * (index + 53)) % 907) / 907 * H
    ctx.globalAlpha = 0.02 + ((seed * (index + 5)) % 17) / 400
    ctx.fillRect(gx, gy, 1.4, 1.4)
  }
  ctx.restore()
}

const girihStar = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, widthPx: number, alpha: number) => {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthPx; ctx.globalAlpha = alpha
  for (const rot of [0, Math.PI / 4]) {
    ctx.beginPath()
    for (let corner = 0; corner < 4; corner += 1) {
      const angle = rot + corner * Math.PI / 2
      const px = cx + Math.cos(angle) * radius
      const py = cy + Math.sin(angle) * radius
      corner ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    }
    ctx.closePath(); ctx.stroke()
  }
  ctx.restore()
}

const latticeDots = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number, color: string, alpha: number) => {
  ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha
  for (let row = 0; row * step < h; row += 1)
    for (let col = 0; col * step < w; col += 1) {
      const offset = row % 2 ? step / 2 : 0
      const dx = x + col * step + offset
      if (dx > x + w) continue
      ctx.beginPath(); ctx.arc(dx, y + row * step, step * 0.14, 0, Math.PI * 2); ctx.fill()
    }
  ctx.restore()
}

const astrolabeRing = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, S: number) => {
  ctx.save(); ctx.strokeStyle = color
  ctx.globalAlpha = 0.6; ctx.lineWidth = 1.6 * S
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.25; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(cx, cy, radius * 0.88, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.5
  for (let tick = 0; tick < 72; tick += 1) {
    const angle = tick * Math.PI / 36
    const long = tick % 6 === 0
    const r1 = radius - (long ? 14 : 7) * S
    ctx.lineWidth = (long ? 1.6 : 0.9) * S
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1)
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
    ctx.stroke()
  }
  ctx.restore()
}

const glowingLamp = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, gold: string) => {
  ctx.save()
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 3.2)
  halo.addColorStop(0, 'rgba(201,169,108,.30)'); halo.addColorStop(1, 'rgba(201,169,108,0)')
  ctx.fillStyle = halo
  ctx.beginPath(); ctx.arc(cx, cy, size * 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = gold
  ctx.beginPath(); ctx.moveTo(cx, cy - size * 1.5); ctx.lineTo(cx + size * 0.8, cy - size * 0.3)
  ctx.quadraticCurveTo(cx + size, cy + size * 0.9, cx, cy + size * 1.4)
  ctx.quadraticCurveTo(cx - size, cy + size * 0.9, cx - size * 0.8, cy - size * 0.3)
  ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.arc(cx, cy + size * 1.75, size * 0.22, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

const sealStamp = (ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, color: string, S: number, monogram = 'أ') => {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.globalAlpha = 0.9; ctx.lineWidth = 1.6 * S
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()
  ctx.globalAlpha = 0.55; ctx.lineWidth = 0.9 * S
  ctx.beginPath(); ctx.arc(cx, cy, radius * 0.78, 0, Math.PI * 2); ctx.stroke()
  for (let point = 0; point < 8; point += 1) {
    const angle = point * Math.PI / 4
    const px = cx + Math.cos(angle) * radius * 0.89
    const py = cy + Math.sin(angle) * radius * 0.89
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle)
    ctx.globalAlpha = 0.8
    ctx.fillRect(-radius * 0.045, -radius * 0.045, radius * 0.09, radius * 0.09)
    ctx.restore()
  }
  ctx.globalAlpha = 0.95
  ctx.font = `700 ${Math.round(radius * 0.95)}px "El Messiri", "Tajawal", sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(monogram, cx, cy + radius * 0.34)
  ctx.restore()
}

const penFlourish = (ctx: CanvasRenderingContext2D, xRight: number, y: number, width: number, seed: number, color: string, S: number) => {
  const sway = (index: number) => (((seed * (index + 3)) % 41) - 20) / 20
  ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round'
  for (const [lw, alpha, dy] of [[3.6, 0.95, 0], [6.2, 0.16, 1.5], [9.5, 0.07, 3]] as const) {
    ctx.lineWidth = lw * S; ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(xRight, y + dy * S)
    ctx.bezierCurveTo(
      xRight - width * 0.3, y + (26 + sway(1) * 12) * S + dy * S,
      xRight - width * 0.48, y - (22 + sway(2) * 10) * S + dy * S,
      xRight - width * 0.68, y + (14 + sway(3) * 8) * S + dy * S)
    ctx.bezierCurveTo(
      xRight - width * 0.82, y + (30 + sway(4) * 8) * S + dy * S,
      xRight - width * 0.9, y - (6 + sway(5) * 6) * S + dy * S,
      xRight - width, y + 10 * S + dy * S)
    ctx.stroke()
  }
  ctx.globalAlpha = 1; ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(xRight - width - 8 * S, y + 10 * S, 4.5 * S, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

export const compositionLabel: Record<Composition, string> = {
  midad: 'المداد · مخطوطة مذهّبة',
  layl: 'الليل · أسطرلاب',
  jarida: 'الجريدة · صفحة رأي',
  sharit: 'الشريط · سينمائي',
  mishkat: 'المشكاة · قوس ومصباح',
  tawqee: 'التوقيع · أتيلييه',
  mursim: 'المرسم · مخطط هندسي',
  hibr: 'الحبر · لطخة حية',
  fajr: 'الفجر · أفق يبزغ',
  sajjada: 'السجادة · نسيج مذهّب',
  ruqaa: 'الرقعة · حداثة هادئة',
  sada: 'الصدى · تردد العنوان',
}

export const compositionNameOf = (layout: SocialVisualLayout) => compositionLabel[compositionOf(layout)]

export async function renderSocialPng(inputTemplate: SocialVisualTemplate) {
  const template: SocialVisualTemplate = { ...inputTemplate, footer: cleanIdentityFooter(inputTemplate.footer) }
  /* جذر «الخطوط غير جيدة» (ملاحظة الدكتور ٣١ يوليو): الكانفس يطلب
     «El Messiri» بوزن ٧٠٠ — لكن المتصفح **لا يُنزّل خطاً لمجرد ذكره في
     ctx.font**؛ يُنزّله فقط حين يستعمله عنصرٌ في الصفحة. فإن لم يكن الوزن
     مستعملاً في تلك اللحظة سقط الرسم صامتاً إلى خطّ نظامٍ عام، فتخرج البطاقة
     بخطٍّ رديء بلا أي خطأ. الحل: نطلب تحميل الأوزان المستعملة صراحةً قبل
     الرسم، ثم ننتظر fonts.ready — وكلاهما بمهلة كي لا يعلّق متصفحٌ الرسم. */
  const requiredFonts = [
    '700 64px "El Messiri"', '600 64px "El Messiri"', '400 32px "El Messiri"',
    '700 40px Tajawal', '500 32px Tajawal', '400 28px Tajawal',
  ]
  await Promise.race([
    Promise.allSettled(requiredFonts.map((font) => document.fonts?.load(font, 'أ') ?? Promise.resolve())),
    new Promise((resolve) => window.setTimeout(resolve, 3500)),
  ])
  await Promise.race([document.fonts?.ready, new Promise((resolve) => window.setTimeout(resolve, 3000))])
  const canvas = document.createElement('canvas')
  canvas.width = template.width
  canvas.height = template.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر إنشاء قالب الصورة.')

  const W = template.width
  const H = template.height
  const S = W / 1080
  const isStory = template.platform === 'story'
  const comp = compositionOf(template.layout)
  const ink = INKS[comp]
  const seed = hashSeed(template.id + template.title)
  const pad = Math.round(W * 0.09)
  const display = (weight: number, size: number) => `${weight} ${Math.round(size)}px "El Messiri", "Tajawal", sans-serif`
  const sans = (weight: number, size: number) => `${weight} ${Math.round(size)}px Tajawal, sans-serif`
  const hairline = (x1: number, y1: number, x2: number, y2: number, color: string, widthPx: number, alpha = 1) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthPx; ctx.globalAlpha = alpha
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore()
  }
  const diamond = (x: number, y: number, radius: number, color: string, alpha = 1) => {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha
    ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y)
    ctx.closePath(); ctx.fill(); ctx.restore()
  }
  const kickerLine = (text: string, x: number, y: number, color: string, size: number, spacing: number, align: CanvasTextAlign) => {
    ctx.save(); ctx.fillStyle = color; ctx.font = sans(600, size); ctx.textAlign = align
    setLetterSpacing(ctx, spacing); ctx.fillText(text, x, y); setLetterSpacing(ctx, 0); ctx.restore()
  }
  const sourceBadge = (centerMode: boolean, y: number) => {
    if (!template.source) return
    const badgeText = `مرتبط بحدث من ${template.source}`
    ctx.font = sans(500, W * 0.022)
    const badgeWidth = Math.min(W - pad * 2, ctx.measureText(badgeText).width + 56 * S)
    const badgeHeight = Math.round(H * 0.045)
    const badgeX = centerMode ? (W - badgeWidth) / 2 : W - pad - badgeWidth
    roundedRect(ctx, badgeX, y - badgeHeight * 0.72, badgeWidth, badgeHeight, badgeHeight / 2)
    ctx.fillStyle = comp === 'layl' ? 'rgba(255,255,255,.08)' : ink.card
    ctx.fill()
    ctx.strokeStyle = ink.line; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = ink.gold
    ctx.textAlign = 'center'
    ctx.fillText(badgeText, badgeX + badgeWidth / 2, y)
  }
  const drawLogo = async (x: number, y: number, invert: boolean) => {
    try {
      const logo = await loadLogo()
      const logoWidth = Math.round(W * 0.1)
      const logoHeight = Math.round(logoWidth * 0.62)
      const filterSupported = typeof ctx.filter === 'string'
      if (invert && filterSupported) ctx.filter = 'invert(1)'
      if (invert && !filterSupported) return 0 // سفاري: شعار داكن على ليل داكن أسوأ من غيابه
      ctx.drawImage(logo, x === -1 ? Math.round((W - logoWidth) / 2) : x, y - logoHeight, logoWidth, logoHeight)
      ctx.filter = 'none'
      return logoHeight
    } catch { return 0 }
  }

  /* بصمةٌ دلالية هادئة يولّدها معنى النص نفسه، لا زخرفةٌ ثابتة فوق كل منشور.
     الموضوع يختار الرمز، وشكل الجملة يختار التكوين؛ لذلك يصبح التصميم متصلاً
     بما كتبه الدكتور من دون إدخال صور جاهزة أو كسر الهوية البصرية. */
  const drawTopicMotif = () => {
    const x = W * 0.16
    const y = H * 0.17
    const r = W * 0.075
    ctx.save()
    ctx.globalAlpha = comp === 'layl' ? 0.13 : 0.075
    ctx.strokeStyle = ink.line
    ctx.fillStyle = ink.accent
    ctx.lineWidth = Math.max(1, 1.3 * S)
    const circle = (cx: number, cy: number, radius: number, fill = false) => {
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); fill ? ctx.fill() : ctx.stroke()
    }
    if (template.topic === 'ai') {
      const points = [[x-r*.65,y-r*.25],[x,y-r*.72],[x+r*.7,y-r*.12],[x-r*.4,y+r*.58],[x+r*.5,y+r*.62],[x,y]]
      for (const [from, to] of [[0,1],[1,2],[0,5],[2,5],[3,5],[4,5],[3,4]] as const) {
        ctx.beginPath(); ctx.moveTo(points[from][0], points[from][1]); ctx.lineTo(points[to][0], points[to][1]); ctx.stroke()
      }
      for (const [px, py] of points) circle(px, py, 4.2*S, true)
    } else if (template.topic === 'education') {
      ctx.beginPath(); ctx.moveTo(x-r*.85,y-r*.75); ctx.lineTo(x-r*.85,y+r*.72); ctx.stroke()
      for (let index=0; index<5; index++) {
        const yy = y-r*.66 + index*r*.33
        ctx.beginPath(); ctx.moveTo(x-r*.66,yy); ctx.lineTo(x+r*(index===4?.4:.78),yy); ctx.stroke()
      }
    } else if (template.topic === 'family') {
      circle(x-r*.34,y,r*.52); circle(x+r*.34,y,r*.52); circle(x,y+r*.34,r*.52)
      circle(x,y+r*.12,3.8*S,true)
    } else if (template.topic === 'research') {
      ctx.beginPath(); ctx.moveTo(x-r*.82,y+r*.72); ctx.lineTo(x-r*.82,y-r*.68); ctx.moveTo(x-r*.82,y+r*.72); ctx.lineTo(x+r*.82,y+r*.72); ctx.stroke()
      const values=[.48,.2,.65,.38]
      values.forEach((value,index)=>{ const bx=x-r*.55+index*r*.35; const top=y+r*.6-r*1.15*value; ctx.globalAlpha*=.92; ctx.fillRect(bx,top,r*.18,y+r*.6-top) })
    } else if (template.topic === 'media') {
      for (let index=1; index<=3; index++) { ctx.beginPath(); ctx.arc(x-r*.55,y,r*.38*index,-Math.PI*.42,Math.PI*.42); ctx.stroke() }
      circle(x-r*.55,y,4*S,true)
    } else if (template.topic === 'future') {
      ctx.beginPath(); ctx.moveTo(x-r,y+r*.45); ctx.lineTo(x+r,y+r*.45); ctx.stroke()
      for (let index=-2; index<=2; index++) { ctx.beginPath(); ctx.moveTo(x,y+r*.38); ctx.lineTo(x+index*r*.38,y-r*(.55-Math.abs(index)*.08)); ctx.stroke() }
      circle(x,y+r*.38,4*S,true)
    } else if (template.topic === 'human') {
      circle(x,y,r*.25); circle(x,y,r*.52); circle(x,y,r*.8); circle(x,y,4*S,true)
    } else {
      diamond(x,y-r*.35,8*S,ink.accent,.9); diamond(x-r*.38,y+r*.28,5*S,ink.gold,.9); diamond(x+r*.38,y+r*.28,5*S,ink.gold,.9)
    }
    ctx.restore()
  }

  ctx.fillStyle = ink.bg
  ctx.fillRect(0, 0, W, H)
  drawTopicMotif()
  ctx.direction = 'rtl'
  ctx.textBaseline = 'alphabetic'

  /* ═══ «المداد» — مخطوطة منوّرة: إطاران، نجوم غرزية، حرف استهلالي مزدوج الظل، ختم ═══ */
  if (comp === 'midad') {
    paperGrain(ctx, W, H, seed, ink.ink)
    ctx.save(); ctx.globalAlpha = 0.13; ctx.strokeStyle = ink.line; ctx.lineWidth = 1
    for (let y = pad * 1.5; y < H - pad * 1.5; y += 30 * S) { ctx.beginPath(); ctx.moveTo(pad * 1.15, y); ctx.lineTo(W - pad * 1.15, y); ctx.stroke() }
    ctx.restore()
    ctx.strokeStyle = ink.ink; ctx.globalAlpha = 0.8; ctx.lineWidth = 2.6 * S
    ctx.strokeRect(pad * 0.5, pad * 0.5, W - pad, H - pad)
    ctx.globalAlpha = 1; ctx.strokeStyle = ink.gold; ctx.lineWidth = 1.1 * S
    ctx.strokeRect(pad * 0.72, pad * 0.72, W - pad * 1.44, H - pad * 1.44)
    for (const [cx, cy] of [[pad * 0.72, pad * 0.72], [W - pad * 0.72, pad * 0.72], [pad * 0.72, H - pad * 0.72], [W - pad * 0.72, H - pad * 0.72]] as const) {
      girihStar(ctx, cx, cy, 13 * S, ink.gold, 1.1 * S, 0.9)
      diamond(cx, cy, 4 * S, ink.gold)
    }
    girihStar(ctx, W / 2, pad * 1.28, 15 * S, ink.gold, 1.2 * S, 0.95)
    diamond(W / 2, pad * 1.28, 5 * S, ink.gold)
    kickerLine(`✦  ${template.kicker}  ✦`, W / 2, pad * 1.98, ink.gold, W * 0.025, 5 * S, 'center')
    const initial = (template.title.trim().match(/[ء-ي]/) || ['و'])[0]
    ctx.save(); ctx.textAlign = 'center'; ctx.font = display(700, W * 0.6)
    ctx.globalAlpha = 0.045; ctx.fillStyle = ink.gold
    ctx.fillText(initial, W / 2 + 8 * S, H * (isStory ? 0.52 : 0.6) + 8 * S)
    ctx.globalAlpha = 0.065; ctx.fillStyle = ink.accent
    ctx.fillText(initial, W / 2, H * (isStory ? 0.52 : 0.6))
    ctx.restore()
    const titleMaxW = W - pad * 2.7
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 5, W * (isStory ? 0.082 : 0.07), W * 0.044)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    const afterTitle = drawWrapped(ctx, template.title, W / 2, H * (isStory ? 0.3 : 0.32), titleMaxW, Math.round(titleSize * 1.48), isStory ? 7 : 5)
    hairline(W / 2 - 110 * S, afterTitle + 10 * S, W / 2 - 20 * S, afterTitle + 10 * S, ink.gold, 1.3 * S)
    hairline(W / 2 + 20 * S, afterTitle + 10 * S, W / 2 + 110 * S, afterTitle + 10 * S, ink.gold, 1.3 * S)
    girihStar(ctx, W / 2, afterTitle + 10 * S, 9 * S, ink.gold, 1 * S, 0.95)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, afterTitle + 84 * S, W - pad * 3.1, Math.round(W * 0.029 * 1.85), isStory ? 8 : 5)
    }
    sourceBadge(true, H - pad * 2.3)
    sealStamp(ctx, W / 2, H - pad * 1.62, 34 * S, ink.gold, S)
    await drawLogo(pad * 1.05, H - pad * 0.92, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.021); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.98)
  }

  /* ═══ «الليل» — أسطرلاب: حلقة مدرّجة، نجوم متوهجة، هلال ذهبي ═══ */
  if (comp === 'layl') {
    const glow = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, W * 0.85)
    glow.addColorStop(0, '#182029'); glow.addColorStop(1, '#0A0D11')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    ctx.save()
    for (let index = 0; index < 110; index += 1) {
      const sx = ((seed * (index + 13)) % 997) / 997 * W
      const sy = ((seed * (index + 71)) % 883) / 883 * H
      ctx.globalAlpha = 0.05 + ((seed * (index + 7)) % 23) / 110
      ctx.fillStyle = index % 5 === 0 ? ink.gold : '#DCE2E8'
      ctx.beginPath(); ctx.arc(sx, sy, (index % 7 === 0 ? 2.1 : 1.2) * S, 0, Math.PI * 2); ctx.fill()
    }
    for (let bright = 0; bright < 4; bright += 1) {
      const bx = ((seed * (bright + 29)) % 887) / 887 * W
      const by = ((seed * (bright + 101)) % 641) / 641 * H * 0.55
      const starGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 26 * S)
      starGlow.addColorStop(0, 'rgba(220,226,232,.5)'); starGlow.addColorStop(1, 'rgba(220,226,232,0)')
      ctx.globalAlpha = 0.8; ctx.fillStyle = starGlow
      ctx.beginPath(); ctx.arc(bx, by, 26 * S, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    const ringY = H * 0.43
    astrolabeRing(ctx, W / 2, ringY, W * 0.36, ink.gold, S)
    ctx.save(); ctx.fillStyle = ink.gold
    ctx.globalAlpha = 0.95
    ctx.beginPath(); ctx.arc(W / 2 + W * 0.255, ringY - W * 0.255, 17 * S, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(W / 2 + W * 0.255 + 7 * S, ringY - W * 0.255 - 5 * S, 15 * S, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    diamond(W / 2, ringY - W * 0.36, 7 * S, ink.gold)
    kickerLine(template.kicker, W / 2, ringY - W * 0.36 - 34 * S, ink.gold, W * 0.025, 6 * S, 'center')
    const titleMaxW = W * 0.58
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 6, W * (isStory ? 0.073 : 0.062), W * 0.038)
    ctx.font = display(700, titleSize)
    const titleLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 7 : 6).length
    const lineHeight = Math.round(titleSize * 1.5)
    ctx.fillStyle = ink.ink; ctx.textAlign = 'center'
    const titleStart = ringY - ((titleLines - 1) * lineHeight) / 2 + titleSize * 0.35
    drawWrapped(ctx, template.title, W / 2, titleStart, titleMaxW, lineHeight, isStory ? 7 : 6)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(300, W * 0.027); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, ringY + W * 0.36 + 64 * S, W - pad * 3, Math.round(W * 0.027 * 1.9), isStory ? 7 : 3)
    }
    sourceBadge(true, H - pad * 2.1)
    hairline(W / 2 - 70 * S, H - pad * 1.66, W / 2 + 70 * S, H - pad * 1.66, ink.gold, 1.1 * S, 0.7)
    await drawLogo(-1, H - pad * 1.66 - 12 * S, true)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.95)
  }

  /* ═══ «الجريدة» — صفحة رأي: ترويسة كاملة، حرف بارز، عمود جانبي ═══ */
  if (comp === 'jarida') {
    paperGrain(ctx, W, H, seed, ink.ink)
    ctx.fillStyle = ink.ink
    ctx.fillRect(pad, pad * 0.82, W - pad * 2, 7 * S)
    hairline(pad, pad * 0.82 + 13 * S, W - pad, pad * 0.82 + 13 * S, ink.ink, 1.6 * S)
    ctx.font = display(700, W * 0.038); ctx.textAlign = 'center'; ctx.fillStyle = ink.ink
    ctx.fillText(template.kicker, W / 2, pad * 0.82 + 72 * S)
    diamond(W / 2 - Math.min(W * 0.34, ctx.measureText(template.kicker).width / 2 + 46 * S), pad * 0.82 + 58 * S, 5 * S, ink.gold)
    diamond(W / 2 + Math.min(W * 0.34, ctx.measureText(template.kicker).width / 2 + 46 * S), pad * 0.82 + 58 * S, 5 * S, ink.gold)
    hairline(pad, pad * 0.82 + 96 * S, W - pad, pad * 0.82 + 96 * S, ink.ink, 1.6 * S)
    ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.019); ctx.textAlign = 'right'
    ctx.fillText('رأي · تربية وتكنولوجيا', W - pad, pad * 0.82 + 128 * S)
    ctx.textAlign = 'left'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', pad, pad * 0.82 + 128 * S)
    hairline(pad, pad * 0.82 + 146 * S, W - pad, pad * 0.82 + 146 * S, ink.line, 1.1 * S)
    ctx.textAlign = 'right'
    const titleSize = fittedTitleSize(ctx, template.title, W - pad * 2, isStory ? 7 : 5, W * (isStory ? 0.088 : 0.08), W * 0.048)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize)
    const afterTitle = drawWrapped(ctx, template.title, W - pad, pad * 0.82 + 190 * S + titleSize, W - pad * 2, Math.round(titleSize * 1.44), isStory ? 7 : 5)
    ctx.fillStyle = ink.accent
    ctx.fillRect(W - pad - 150 * S, afterTitle + 8 * S, 150 * S, 9 * S)
    ctx.fillStyle = ink.gold
    ctx.fillRect(W - pad - 176 * S, afterTitle + 8 * S, 16 * S, 9 * S)
    if (template.body) {
      const bodyWords = template.body.trim().split(/\s+/)
      const firstWord = bodyWords.shift() || ''
      const bodyRest = bodyWords.join(' ')
      const bodySize = W * 0.03
      const dropSize = bodySize * 2.7
      ctx.fillStyle = ink.accent; ctx.font = display(700, dropSize); ctx.textAlign = 'right'
      const bodyTop = afterTitle + 96 * S
      ctx.fillText(firstWord, W - pad, bodyTop + dropSize * 0.28)
      const firstWidth = ctx.measureText(firstWord).width + 22 * S
      ctx.fillStyle = ink.soft; ctx.font = sans(400, bodySize)
      const columnReserve = W * 0.17
      const lineH = Math.round(bodySize * 1.85)
      const firstLines = wrapLines(ctx, bodyRest, W - pad * 2 - columnReserve - firstWidth).slice(0, 2)
      firstLines.forEach((line, index) => ctx.fillText(line, W - pad - firstWidth, bodyTop + index * lineH))
      const remaining = wrapLines(ctx, bodyRest, W - pad * 2 - columnReserve - firstWidth).slice(2).join(' ')
      if (remaining) drawWrapped(ctx, remaining, W - pad, bodyTop + 2 * lineH, W - pad * 2 - columnReserve, lineH, isStory ? 7 : 4)
    }
    const columnX = pad + W * 0.12
    hairline(columnX, afterTitle + 70 * S, columnX, H - pad * 1.75, ink.line, 1.3 * S)
    sourceBadge(false, H - pad * 2.05)
    hairline(pad, H - pad * 1.48, W - pad, H - pad * 1.48, ink.ink, 1.8 * S)
    hairline(pad, H - pad * 1.48 + 7 * S, W - pad, H - pad * 1.48 + 7 * S, ink.ink, 0.8 * S)
    await drawLogo(pad, H - pad * 0.62, false)
    ctx.fillStyle = ink.ink; ctx.font = display(600, W * 0.027); ctx.textAlign = 'right'
    ctx.fillText('د. أحمد حسين الفيلكاوي', W - pad, H - pad * 0.95)
  }

  /* ═══ «الشريط» — سينمائي: شريط متدرج بخيوط ذهبية وثقوب فيلمية ═══ */
  if (comp === 'sharit') {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.strokeStyle = ink.accent; ctx.lineWidth = 1
    for (let d = -H; d < W; d += 46 * S) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H * 0.4, H * 0.4); ctx.stroke() }
    ctx.restore()
    const bandHeight = H * (isStory ? 0.3 : 0.42)
    const bandY = (H - bandHeight) / 2
    ctx.save(); ctx.fillStyle = ink.gold; ctx.textAlign = 'right'
    diamond(W - pad + 14 * S, bandY - 52 * S, 6 * S, ink.gold)
    ctx.restore()
    kickerLine(template.kicker, W - pad, bandY - 44 * S, ink.accent, W * 0.026, 4 * S, 'right')
    hairline(pad, bandY - 52 * S, W - pad - 380 * S, bandY - 52 * S, ink.line, 1.3 * S)
    const bandGradient = ctx.createLinearGradient(0, bandY, 0, bandY + bandHeight)
    bandGradient.addColorStop(0, '#41617F'); bandGradient.addColorStop(1, '#2C4763')
    ctx.fillStyle = bandGradient
    ctx.fillRect(0, bandY, W, bandHeight)
    hairline(0, bandY + 8 * S, W, bandY + 8 * S, ink.gold, 1.4 * S, 0.65)
    hairline(0, bandY + bandHeight - 8 * S, W, bandY + bandHeight - 8 * S, ink.gold, 1.4 * S, 0.65)
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.26
    for (let x = 26 * S; x < W; x += 46 * S) {
      roundedRect(ctx, x - 5 * S, bandY + 18 * S, 10 * S, 13 * S, 3 * S); ctx.fill()
      roundedRect(ctx, x - 5 * S, bandY + bandHeight - 31 * S, 10 * S, 13 * S, 3 * S); ctx.fill()
    }
    ctx.restore()
    const titleMaxW = W - pad * 2
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 5 : 4, W * (isStory ? 0.075 : 0.068), W * 0.042)
    ctx.font = display(700, titleSize)
    const titleLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 5 : 4).length
    const lineHeight = Math.round(titleSize * 1.46)
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14 * S; ctx.shadowOffsetY = 3 * S
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'
    const titleStart = bandY + bandHeight / 2 - ((titleLines - 1) * lineHeight) / 2 + titleSize * 0.34
    drawWrapped(ctx, template.title, W - pad, titleStart, titleMaxW, lineHeight, isStory ? 5 : 4)
    ctx.restore()
    ctx.fillStyle = ink.gold
    ctx.fillRect(W - pad - 110 * S, bandY + 46 * S, 110 * S, 4.5 * S)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'right'
      drawWrapped(ctx, template.body, W - pad, bandY + bandHeight + 78 * S, W - pad * 2.4, Math.round(W * 0.029 * 1.8), isStory ? 6 : 4)
    }
    sourceBadge(false, H - pad * 1.78)
    await drawLogo(pad, H - pad * 0.72, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'right'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W - pad, H - pad * 0.95)
  }

  /* ═══ «المشكاة» — محراب بمصباح متوهج ومشربيات ═══ */
  if (comp === 'mishkat') {
    paperGrain(ctx, W, H, seed, ink.ink)
    const baseY = H * (isStory ? 0.62 : 0.68)
    const apexY = H * (isStory ? 0.16 : 0.14)
    const halfW = W * 0.31
    const shoulderY = apexY + (baseY - apexY) * 0.44
    const arch = (half: number, color: string, widthPx: number, alpha: number) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthPx; ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(W / 2 - half, baseY)
      ctx.lineTo(W / 2 - half, shoulderY)
      ctx.bezierCurveTo(W / 2 - half, apexY + (shoulderY - apexY) * 0.25, W / 2 - half * 0.42, apexY, W / 2, apexY)
      ctx.bezierCurveTo(W / 2 + half * 0.42, apexY, W / 2 + half, apexY + (shoulderY - apexY) * 0.25, W / 2 + half, shoulderY)
      ctx.lineTo(W / 2 + half, baseY)
      ctx.stroke(); ctx.restore()
    }
    arch(halfW, ink.accent, 3.2 * S, 0.92)
    arch(halfW * 0.91, ink.gold, 1.2 * S, 0.85)
    latticeDots(ctx, W * 0.06, apexY + 20 * S, W * 0.14, (shoulderY - apexY) * 0.9, 17 * S, ink.accent, 0.16)
    latticeDots(ctx, W * 0.8, apexY + 20 * S, W * 0.14, (shoulderY - apexY) * 0.9, 17 * S, ink.accent, 0.16)
    hairline(W * 0.09, baseY, W * 0.91, baseY, ink.accent, 2.4 * S, 0.92)
    hairline(W * 0.12, baseY + 15 * S, W * 0.88, baseY + 15 * S, ink.gold, 1 * S, 0.75)
    diamond(W / 2, baseY + 15 * S, 6 * S, ink.gold)
    hairline(W / 2, apexY, W / 2, apexY + 52 * S, ink.gold, 1.3 * S, 0.85)
    glowingLamp(ctx, W / 2, apexY + 74 * S, 15 * S, ink.gold)
    kickerLine(template.kicker, W / 2, pad * 0.88, ink.gold, W * 0.024, 5 * S, 'center')
    const titleMaxW = halfW * 1.58
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 6, W * 0.057, W * 0.037)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    drawWrapped(ctx, template.title, W / 2, apexY + (baseY - apexY) * 0.4, titleMaxW, Math.round(titleSize * 1.5), isStory ? 7 : 6)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.028); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, baseY + 82 * S, W - pad * 2.9, Math.round(W * 0.028 * 1.85), isStory ? 7 : 4)
    }
    sourceBadge(true, H - pad * 2)
    await drawLogo(-1, H - pad * 1.25, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.021); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.9)
  }

  /* ═══ «التوقيع» — أتيلييه: ريشة بضغط حبر، ختم مذهّب ═══ */
  if (comp === 'tawqee') {
    ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = ink.accent
    ctx.font = display(700, W * 0.62); ctx.textAlign = 'left'
    ctx.fillText('”', pad * 0.35, H * 0.4); ctx.restore()
    kickerLine(template.kicker, W - pad, pad * 1.32, ink.accent, W * 0.026, 4 * S, 'right')
    hairline(W - pad, pad * 1.58, W - pad - 130 * S, pad * 1.58, ink.gold, 2.2 * S)
    const titleSize = fittedTitleSize(ctx, template.title, W - pad * 2.2, isStory ? 7 : 5, W * (isStory ? 0.082 : 0.072), W * 0.046)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'right'
    const afterTitle = drawWrapped(ctx, template.title, W - pad, pad + H * (isStory ? 0.12 : 0.16) + titleSize * 0.4, W - pad * 2.2, Math.round(titleSize * 1.46), isStory ? 7 : 5)
    penFlourish(ctx, W - pad - 6 * S, afterTitle + 40 * S, W * 0.46, seed, ink.accent, S)
    if (template.body) {
      ctx.fillStyle = ink.gold; ctx.font = display(700, W * 0.048); ctx.textAlign = 'right'
      ctx.fillText('«', W - pad, afterTitle + 132 * S)
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.03)
      drawWrapped(ctx, template.body, W - pad - 50 * S, afterTitle + 132 * S, W - pad * 2.6 - 50 * S, Math.round(W * 0.03 * 1.85), isStory ? 8 : 5)
    }
    sourceBadge(false, H - pad * 2.25)
    sealStamp(ctx, pad * 1.55, H - pad * 1.35, 32 * S, ink.gold, S)
    ctx.fillStyle = ink.ink; ctx.font = display(600, W * 0.031); ctx.textAlign = 'right'
    ctx.fillText('د. أحمد حسين الفيلكاوي', W - pad, H - pad * 1.32)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.021)
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W - pad, H - pad * 0.95)
    await drawLogo(pad * 2.35, H - pad * 0.85, false)
  }


  /* ═══ «المرسم» — مخطط هندسي: شبكة زرقاء، إطار متقطع، بوصلة، ختم مواصفات ═══ */
  if (comp === 'mursim') {
    ctx.save(); ctx.strokeStyle = ink.line; ctx.lineWidth = 0.7 * S; ctx.globalAlpha = 0.5
    for (let x = 0; x <= W; x += 54 * S) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += 54 * S) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    ctx.globalAlpha = 0.9; ctx.lineWidth = 1.4 * S
    for (let x = 0; x <= W; x += 270 * S) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += 270 * S) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    ctx.restore()
    ctx.save(); ctx.strokeStyle = ink.ink; ctx.globalAlpha = 0.85; ctx.lineWidth = 2 * S
    ctx.setLineDash([14 * S, 9 * S])
    ctx.strokeRect(pad * 0.6, pad * 0.6, W - pad * 1.2, H - pad * 1.2)
    ctx.setLineDash([]); ctx.restore()
    ctx.save(); ctx.strokeStyle = ink.gold; ctx.lineWidth = 1.4 * S; ctx.globalAlpha = 0.95
    const compassX = W - pad * 1.5, compassY = pad * 1.7, compassR = 34 * S
    ctx.beginPath(); ctx.arc(compassX, compassY, compassR, 0, Math.PI * 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(compassX, compassY + compassR * 0.8); ctx.lineTo(compassX, compassY - compassR * 0.8)
    ctx.moveTo(compassX - compassR * 0.55, compassY); ctx.lineTo(compassX + compassR * 0.55, compassY); ctx.stroke()
    ctx.fillStyle = ink.gold
    ctx.beginPath(); ctx.moveTo(compassX, compassY - compassR * 0.8); ctx.lineTo(compassX - 6 * S, compassY - compassR * 0.35)
    ctx.lineTo(compassX + 6 * S, compassY - compassR * 0.35); ctx.closePath(); ctx.fill()
    ctx.restore()
    kickerLine(template.kicker, pad * 1.1, pad * 1.55, ink.gold, W * 0.025, 5 * S, 'left')
    hairline(pad * 1.1, pad * 1.78, pad * 1.1 + 150 * S, pad * 1.78, ink.gold, 1.2 * S, 0.9)
    const titleMaxW = W - pad * 2.6
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 5, W * (isStory ? 0.08 : 0.07), W * 0.044)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'right'
    const afterTitle = drawWrapped(ctx, template.title, W - pad * 1.3, H * (isStory ? 0.3 : 0.32), titleMaxW, Math.round(titleSize * 1.5), isStory ? 7 : 5)
    ctx.save(); ctx.strokeStyle = ink.gold; ctx.lineWidth = 1.6 * S
    const tickY = afterTitle + 16 * S
    ctx.beginPath(); ctx.moveTo(W - pad * 1.3, tickY); ctx.lineTo(W - pad * 1.3 - 190 * S, tickY); ctx.stroke()
    for (const tx of [0, 95, 190]) {
      ctx.beginPath(); ctx.moveTo(W - pad * 1.3 - tx * S, tickY - 6 * S); ctx.lineTo(W - pad * 1.3 - tx * S, tickY + 6 * S); ctx.stroke()
    }
    ctx.restore()
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(300, W * 0.029); ctx.textAlign = 'right'
      drawWrapped(ctx, template.body, W - pad * 1.3, afterTitle + 80 * S, W - pad * 2.8, Math.round(W * 0.029 * 1.85), isStory ? 8 : 5)
    }
    ctx.save(); ctx.strokeStyle = ink.line; ctx.lineWidth = 1.2 * S; ctx.globalAlpha = 1
    const boxW = 300 * S, boxH = 74 * S
    ctx.strokeRect(pad * 1.05, H - pad * 1.05 - boxH, boxW, boxH)
    ctx.beginPath(); ctx.moveTo(pad * 1.05, H - pad * 1.05 - boxH / 2); ctx.lineTo(pad * 1.05 + boxW, H - pad * 1.05 - boxH / 2); ctx.stroke()
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.018); ctx.textAlign = 'left'
    ctx.fillText('مخطط فكرة · د. أحمد حسين الفيلكاوي', pad * 1.05 + 14 * S, H - pad * 1.05 - boxH / 2 - 12 * S)
    ctx.fillStyle = ink.gold
    ctx.fillText(template.footer || 'dr-alfailakawi.com', pad * 1.05 + 14 * S, H - pad * 1.05 - 12 * S)
    ctx.restore()
    sourceBadge(false, H - pad * 2.2)
    await drawLogo(W - pad * 1.4, H - pad * 0.7, true)
  }

  /* ═══ «الحبر» — لطخة حبر عضوية يسكنها العنوان أبيض، ورذاذ حي ═══ */
  if (comp === 'hibr') {
    paperGrain(ctx, W, H, seed, ink.ink)
    const blobX = W / 2, blobY = H * (isStory ? 0.4 : 0.42)
    const blobR = W * 0.42
    ctx.save(); ctx.fillStyle = ink.accent
    ctx.beginPath()
    const lobes = 6
    for (let i = 0; i <= lobes * 12; i++) {
      const angle = (i / (lobes * 12)) * Math.PI * 2
      const wobble = 1 + 0.11 * Math.sin(lobes * angle + seed % 7) + 0.05 * Math.sin(3 * angle + seed % 13)
      const px = blobX + Math.cos(angle) * blobR * wobble
      const py = blobY + Math.sin(angle) * blobR * wobble * (isStory ? 0.75 : 0.86)
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
    }
    ctx.closePath(); ctx.fill()
    for (let d = 0; d < 16; d++) {
      const angle = ((seed * (d + 11)) % 360) * Math.PI / 180
      const dist = blobR * (1.08 + ((seed * (d + 3)) % 40) / 100)
      const dropR = (1.6 + ((seed * (d + 7)) % 10) / 2.4) * S
      ctx.beginPath(); ctx.arc(blobX + Math.cos(angle) * dist, blobY + Math.sin(angle) * dist * 0.85, dropR, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    kickerLine(template.kicker, W / 2, pad * 1.1, ink.gold, W * 0.024, 5 * S, 'center')
    const titleMaxW = blobR * 1.5
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 6 : 5, W * 0.062, W * 0.038)
    ctx.font = display(700, titleSize)
    const titleLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 6 : 5).length
    const lineHeight = Math.round(titleSize * 1.48)
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'
    drawWrapped(ctx, template.title, blobX, blobY - ((titleLines - 1) * lineHeight) / 2 + titleSize * 0.34, titleMaxW, lineHeight, isStory ? 6 : 5)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, blobY + blobR * (isStory ? 0.82 : 0.95) + 60 * S, W - pad * 2.8, Math.round(W * 0.029 * 1.85), isStory ? 6 : 4)
    }
    sourceBadge(true, H - pad * 1.95)
    await drawLogo(-1, H - pad * 1.2, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.9)
  }

  /* ═══ «الفجر» — أفق يبزغ منه قرص ذهبي، سماء متدرجة وخط أرض ═══ */
  if (comp === 'fajr') {
    const horizonY = H * (isStory ? 0.68 : 0.72)
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY)
    sky.addColorStop(0, '#161E29'); sky.addColorStop(0.62, '#2A3648'); sky.addColorStop(1, '#7A6547')
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizonY)
    ctx.fillStyle = '#141B24'; ctx.fillRect(0, horizonY, W, H - horizonY)
    const glow = ctx.createRadialGradient(W / 2, horizonY, 0, W / 2, horizonY, W * 0.55)
    glow.addColorStop(0, 'rgba(216,178,110,.5)'); glow.addColorStop(1, 'rgba(216,178,110,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, horizonY)
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 0, W, horizonY); ctx.clip()
    ctx.fillStyle = ink.gold
    ctx.beginPath(); ctx.arc(W / 2, horizonY, W * 0.11, Math.PI, 0); ctx.fill()
    ctx.restore()
    hairline(0, horizonY, W, horizonY, ink.gold, 2 * S, 0.9)
    for (let ray = 0; ray < 7; ray++) {
      const spread = (ray - 3) * 0.22
      ctx.save(); ctx.strokeStyle = ink.gold; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.2 * S
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.sin(spread) * W * 0.13, horizonY - Math.cos(spread) * W * 0.13)
      ctx.lineTo(W / 2 + Math.sin(spread) * W * 0.24, horizonY - Math.cos(spread) * W * 0.24); ctx.stroke(); ctx.restore()
    }
    kickerLine(template.kicker, W / 2, pad * 1.05, ink.gold, W * 0.025, 6 * S, 'center')
    const titleMaxW = W - pad * 2.4
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 6 : 5, W * (isStory ? 0.078 : 0.068), W * 0.042)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    const afterTitle = drawWrapped(ctx, template.title, W / 2, H * (isStory ? 0.22 : 0.24), titleMaxW, Math.round(titleSize * 1.5), isStory ? 6 : 5)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(300, W * 0.028); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, Math.min(afterTitle + 64 * S, horizonY - 170 * S), W - pad * 3, Math.round(W * 0.028 * 1.85), 4)
    }
    sourceBadge(true, horizonY - 40 * S)
    hairline(W / 2 - 60 * S, H - pad * 1.5, W / 2 + 60 * S, H - pad * 1.5, ink.gold, 1.1 * S, 0.8)
    await drawLogo(-1, H - pad * 1.55, true)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.85)
  }

  /* ═══ «السجادة» — شريطا نسيج مذهّبان يحتضنان الفكرة ═══ */
  if (comp === 'sajjada') {
    paperGrain(ctx, W, H, seed, ink.ink)
    const weaveBand = (bandY: number) => {
      hairline(pad * 0.7, bandY - 26 * S, W - pad * 0.7, bandY - 26 * S, ink.accent, 2 * S, 0.85)
      hairline(pad * 0.7, bandY + 26 * S, W - pad * 0.7, bandY + 26 * S, ink.accent, 2 * S, 0.85)
      hairline(pad * 0.7, bandY - 34 * S, W - pad * 0.7, bandY - 34 * S, ink.gold, 1 * S, 0.8)
      hairline(pad * 0.7, bandY + 34 * S, W - pad * 0.7, bandY + 34 * S, ink.gold, 1 * S, 0.8)
      const step = 64 * S
      for (let x = pad * 1.1; x < W - pad * 0.9; x += step) {
        girihStar(ctx, x, bandY, 13 * S, ink.gold, 1 * S, 0.9)
        diamond(x + step / 2, bandY, 5 * S, ink.accent, 0.8)
      }
    }
    weaveBand(pad * 1.35)
    weaveBand(H - pad * 1.35)
    kickerLine(template.kicker, W / 2, pad * 2.15, ink.gold, W * 0.024, 5 * S, 'center')
    const titleMaxW = W - pad * 2.6
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 5, W * (isStory ? 0.08 : 0.07), W * 0.044)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    const afterTitle = drawWrapped(ctx, template.title, W / 2, H * (isStory ? 0.32 : 0.34), titleMaxW, Math.round(titleSize * 1.5), isStory ? 7 : 5)
    diamond(W / 2, afterTitle + 14 * S, 7 * S, ink.gold)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, afterTitle + 84 * S, W - pad * 3, Math.round(W * 0.029 * 1.85), isStory ? 7 : 5)
    }
    sourceBadge(true, H - pad * 2.5)
    await drawLogo(-1, H - pad * 1.85, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.021); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 1.95 + 66 * S)
  }

  /* ═══ «الرقعة» — حداثة هادئة: كتل لونية غير متماثلة والعنوان في الصفاء ═══ */
  if (comp === 'ruqaa') {
    ctx.fillStyle = ink.accent
    ctx.fillRect(0, 0, W * 0.34, H * (isStory ? 0.3 : 0.36))
    ctx.fillStyle = ink.ink
    ctx.fillRect(0, H * (isStory ? 0.3 : 0.36), W * 0.2, H * 0.1)
    ctx.fillStyle = ink.gold
    ctx.fillRect(W * 0.2, H * (isStory ? 0.36 : 0.42), W * 0.07, W * 0.07)
    ctx.fillStyle = '#E7E4DC'
    ctx.fillRect(0, H - H * 0.16, W * 0.26, H * 0.16)
    hairline(W * 0.34, 0, W * 0.34, H * (isStory ? 0.3 : 0.36), ink.gold, 2 * S, 0.9)
    kickerLine(template.kicker, W - pad, pad * 1.3, ink.accent, W * 0.026, 4 * S, 'right')
    hairline(W - pad, pad * 1.55, W - pad - 120 * S, pad * 1.55, ink.gold, 2 * S)
    const titleMaxW = W * 0.58
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 5, W * (isStory ? 0.08 : 0.07), W * 0.044)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'right'
    const afterTitle = drawWrapped(ctx, template.title, W - pad, H * (isStory ? 0.2 : 0.24), titleMaxW, Math.round(titleSize * 1.48), isStory ? 7 : 5)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'right'
      drawWrapped(ctx, template.body, W - pad, afterTitle + 76 * S, W * 0.6, Math.round(W * 0.029 * 1.85), isStory ? 8 : 5)
    }
    sourceBadge(false, H - pad * 2)
    ctx.fillStyle = ink.ink; ctx.font = display(600, W * 0.027); ctx.textAlign = 'right'
    ctx.fillText('د. أحمد حسين الفيلكاوي', W - pad, H - pad * 1.25)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.021)
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W - pad, H - pad * 0.9)
    await drawLogo(pad * 0.5, H - pad * 0.55, false)
  }

  /* ═══ «الصدى» — العنوان يتردد خلف نفسه أصداءً محيطية ═══ */
  if (comp === 'sada') {
    paperGrain(ctx, W, H, seed, ink.ink)
    kickerLine(template.kicker, W / 2, pad * 1.2, ink.gold, W * 0.025, 6 * S, 'center')
    const titleMaxW = W - pad * 2.2
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 6 : 4, W * (isStory ? 0.085 : 0.078), W * 0.048)
    ctx.font = display(700, titleSize)
    const echoLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 6 : 4)
    const lineHeight = Math.round(titleSize * 1.5)
    const blockH = echoLines.length * lineHeight
    const centerY = H * (isStory ? 0.4 : 0.44)
    ctx.textAlign = 'center'
    for (const [offset, alpha] of [[3, 0.05], [2, 0.09], [1, 0.16]] as const) {
      ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = ink.accent
      echoLines.forEach((line, index) => ctx.fillText(line, W / 2 - offset * 14 * S, centerY - blockH / 2 + index * lineHeight - offset * 16 * S))
      ctx.restore()
    }
    ctx.fillStyle = ink.ink
    echoLines.forEach((line, index) => ctx.fillText(line, W / 2, centerY - blockH / 2 + index * lineHeight))
    hairline(W / 2 - 90 * S, centerY + blockH / 2 + 26 * S, W / 2 + 90 * S, centerY + blockH / 2 + 26 * S, ink.gold, 1.4 * S)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(300, W * 0.029); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, centerY + blockH / 2 + 84 * S, W - pad * 3, Math.round(W * 0.029 * 1.9), isStory ? 7 : 4)
    }
    sourceBadge(true, H - pad * 1.95)
    await drawLogo(-1, H - pad * 1.2, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.9)
  }

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذّر تصدير الصورة.')), 'image/png', 1))
}

export async function downloadSocialPng(template: SocialVisualTemplate) {
  const blob = await renderSocialPng(template)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${template.id}-${template.width}x${template.height}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500)
}
