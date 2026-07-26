import type { ContentTone, LayoutFamilyId, SocialContentAnalysis, SocialPlatform } from './social-design-engine'
import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'

export type VisualNeed = 'human' | 'place' | 'symbol' | 'data' | 'typography'
export type ArtDirectionId = 'documentary' | 'iconic' | 'knowledge'

export type CreativeBrief = {
  issue: string
  tension: string
  hook: string
  evidence: string
  emotion: string
  audience: string
  memory: string
  avoid: string
  visualNeed: VisualNeed
  visualReason: string
  confidence: number
}

export type ArtDirection = {
  id: ArtDirectionId
  title: string
  label: string
  description: string
  feeling: string
  risk: string
  platform: SocialPlatform
  tone: ContentTone
  preferLayout: LayoutFamilyId
  imageNeed: string
  identityFit: number
}

const clean = (value = '') => value.replace(/\s+/g, ' ').trim()
const words = (value = '') => clean(value).split(/\s+/).filter(Boolean)
const firstSentence = (value = '') => clean(value).split(/(?<=[.!؟?])\s+/).find((item) => words(item).length >= 4) || clean(value)
const truncate = (value: string, count: number) => {
  const list = words(value)
  return list.length > count ? `${list.slice(0, count).join(' ')}…` : list.join(' ')
}

const audienceFrom = (context: string, analysis: SocialContentAnalysis) => {
  const source = `${context} ${analysis.normalizedText}`
  if (/ولي|والد|أب|أم|أسرة|طفل/.test(source)) return 'ولي الأمر والأسرة'
  if (/باحث|دراسة|جامعة|أكاديمي/.test(source)) return 'الباحث والمهتم المتخصص'
  if (/طالب|متعلم/.test(source)) return 'الطالب والمتعلم'
  if (/معلم|مدرس|تدريس/.test(source)) return 'المعلم والممارس التربوي'
  if (/قياد|إدار|وزارة|مؤسس/.test(source)) return 'القيادي وصانع القرار'
  return 'القارئ المهتم بالفكرة'
}

const visualNeedFrom = (source: string, analysis: SocialContentAnalysis): { need: VisualNeed; reason: string } => {
  if (analysis.primaryKind === 'statistic' || /(?:%|٪|رقم|نسبة|دراسة|بيانات|نتيجة)/.test(source)) return { need: 'data', reason: 'المحتوى يحمل دليلاً رقمياً؛ البنية البيانية أوضح من صورة زخرفية.' }
  if (/(?:إنسان|معلم|طالب|طفل|أسرة|خوف|قلق|كرامة|هوية)/.test(source)) return { need: 'human', reason: 'جوهر الفكرة إنساني، والصورة الوثائقية أقرب إلى معناها من الرمز التكنولوجي المباشر.' }
  if (/(?:مدرسة|جامعة|فصل|مدينة|مكان|ميدان)/.test(source)) return { need: 'place', reason: 'السياق المكاني جزء من الحجة، ويمكن للمشهد أن يحمل الفكرة قبل قراءة العنوان.' }
  if (words(analysis.structure.title).length <= 7 && analysis.structure.heroWord) return { need: 'typography', reason: 'العنوان قصير وله كلمة بطلة؛ يمكن للتايبوجرافي وحده أن يحمل لحظة التوقف.' }
  return { need: 'symbol', reason: 'المعنى تجريدي؛ يحتاج رمزاً غير مباشر يفتح التأويل من دون كليشيه.' }
}

export function buildCreativeBrief(text: string, context: string, analysis: SocialContentAnalysis): CreativeBrief {
  const domain = interpretDrAhmadDomain(text, context)
  const source = clean(`${text} ${context} ${domain.expandedContext}`)
  const title = analysis.structure.title || firstSentence(text)
  const key = analysis.structure.keyPoint || analysis.structure.quote || firstSentence(text)
  const hero = analysis.structure.heroWord || words(title)[0] || 'الفكرة'
  const question = source.match(/[^.!؟?]{4,}[؟?]/)?.[0]
  const evidence = source.match(/[^.!؟?]*(?:دراسة|بحث|بيانات|نسبة|٪|%|نتيجة)[^.!؟?]*/)?.[0]
  const emotion = /خوف|قلق|فقد|تهديد/.test(source) ? 'قلقٌ يحتاج طمأنة لا تهويلاً'
    : /أمل|فرصة|إمكان|ابتكار/.test(source) ? 'أملٌ واقعي من دون مبالغة'
      : /ظلم|عدال|كرامة/.test(source) ? 'حسٌّ بالعدالة والكرامة'
        : analysis.primaryTone === 'bold' ? 'توترٌ فكري يدفع إلى التوقف'
          : 'فضولٌ هادئ يدعو إلى إعادة النظر'
  const visual = visualNeedFrom(source, analysis)
  const domainAvoid = domain.avoid.slice(0, 10).join('، ')
  return {
    issue: truncate(title, 18),
    tension: truncate(question || `التوتر بين ${hero} وما يترتب عليه في الواقع`, 22),
    hook: truncate(question || analysis.structure.quote || title, 16),
    evidence: truncate(evidence || key, 24),
    emotion,
    audience: audienceFrom(context, analysis),
    memory: truncate(analysis.structure.keyPoint || title, 18),
    avoid: [visual.need === 'human' ? 'تجنّب الصورة التكنولوجية المباشرة أو الوجه المصطنع الذي يحوّل القضية الإنسانية إلى إعلان.' : 'تجنّب الرمز المستهلك أو الصورة التي تشرح الكلمات حرفياً من دون إضافة معنى.', domainAvoid].filter(Boolean).join(' '),
    visualNeed: visual.need,
    visualReason: domain.recognizedTerms.length ? `${domain.compoundMeaning} لذلك يجب أن يحمل المشهد المعنى المركب الدقيق، لا أن يختزل العنوان في أول كلمة أو في صورة تعليمية عامة.` : visual.reason,
    confidence: Math.max(58, Math.min(99, Math.round(Math.max(analysis.confidence, domain.confidence)))),
  }
}

export function buildArtDirections(brief: CreativeBrief): ArtDirection[] {
  const humanFit = brief.visualNeed === 'human' || brief.visualNeed === 'place' ? 96 : 84
  const iconicFit = brief.visualNeed === 'typography' || brief.visualNeed === 'symbol' ? 96 : 82
  const knowledgeFit = brief.visualNeed === 'data' ? 98 : 86
  return [
    {
      id: 'documentary',
      title: 'رؤية وثائقية إنسانية',
      label: 'الإنسان قبل الزينة',
      description: 'صورة حقيقية بإضاءة طبيعية ومساحة سلبية واضحة، مع عنوان هادئ وإحساس مجلة فكرية عالمية.',
      feeling: 'قرب وثقة وصدق',
      risk: 'قد تصبح مألوفة إذا كانت الصورة مباشرة أو تمثيلية أكثر من اللازم.',
      platform: 'instagram',
      tone: 'human',
      preferLayout: 'cinematic-window',
      imageNeed: brief.visualNeed === 'human' ? 'لحظة إنسانية غير مصطنعة، والوجه خارج مركز النص.' : 'مشهد واقعي يحمل السياق ويترك مساحة للعنوان.',
      identityFit: humanFit,
    },
    {
      id: 'iconic',
      title: 'رؤية أيقونية تجريدية',
      label: 'فكرة واحدة لا تُنسى',
      description: 'كلمة بطلة أو رمز غير مباشر، ومساحة سلبية واسعة، من دون شرح زائد أو صورة متوقعة.',
      feeling: 'توقف وفضول وهيبة',
      risk: 'تحتاج فكرة بصرية دقيقة؛ الرمز الضعيف يجعلها غامضة لا عميقة.',
      platform: 'story',
      tone: 'deep',
      preferLayout: 'hero-word',
      imageNeed: 'رمز واحد غير حرفي، أو تايبوجرافي بطولي قادر على حمل القطعة وحده.',
      identityFit: iconicFit,
    },
    {
      id: 'knowledge',
      title: 'رؤية معرفية بيانية',
      label: 'الدليل يقود العين',
      description: 'رقم أو علاقة أو تسلسل واضح؛ مناسبة للحفظ والمشاركة والرجوع إليها بعد القراءة.',
      feeling: 'وضوح وسلطة معرفية',
      risk: 'كثرة البيانات قد تحول القطعة إلى تقرير؛ يجب إبقاء دليل واحد بطلاً.',
      platform: 'linkedin',
      tone: 'academic',
      preferLayout: 'infographic',
      imageNeed: 'لا صورة إلا إذا كانت دليلاً؛ الأولوية للرقم أو التسلسل أو المقارنة.',
      identityFit: knowledgeFit,
    },
  ]
}

const CLICHE_PATTERNS: { pattern: RegExp; label: string; alternative: string }[] = [
  { pattern: /روبوت.*(?:يد|إنسان)|يد.*روبوت/, label: 'روبوت يلمس يد إنسان', alternative: 'ابحث عن أثر التكنولوجيا على سلوك إنسان حقيقي، لا عن رمز التكنولوجيا نفسها.' },
  { pattern: /دماغ.*(?:مضي|رقمي|شبك)/, label: 'دماغ مضيء', alternative: 'استخدم مساراً بصرياً أو تفصيلاً مادياً يدل على التفكير من دون رسم الدماغ.' },
  { pattern: /طفل.*شاش|شاش.*طفل/, label: 'طفل أمام شاشة زرقاء', alternative: 'التقط نتيجة الاستخدام في العلاقة أو المكان، لا الشاشة بوصفها الموضوع كله.' },
  { pattern: /معلم.*سبور.*مبتسم/, label: 'معلم أمام سبورة مبتسماً', alternative: 'استخدم لحظة قرار أو حوار أو تردد داخل الصف.' },
  { pattern: /مصباح.*فكر|فكر.*مصباح/, label: 'مصباح الفكرة', alternative: 'اجعل الفكرة تظهر في علاقة العناصر أو الفراغ، لا في رمز جاهز.' },
  { pattern: /شطرنج.*استراتيج|استراتيج.*شطرنج/, label: 'الشطرنج للاستراتيجية', alternative: 'استخدم مفترقاً أو ترتيباً أو قراراً له صلة حقيقية بالمحتوى.' },
  { pattern: /كتب.*تطير|كتاب.*طائر/, label: 'كتب تطير', alternative: 'استخدم أثر القراءة أو هامشاً أو ورقة حقيقية تحمل معنى المادة.' },
  { pattern: /شبك.*وجه|وجه.*رقمي/, label: 'شبكة رقمية على وجه', alternative: 'استخدم ضوءاً أو انعكاساً أو حاجزاً مادياً يعبّر عن العلاقة بالتكنولوجيا.' },
]

export function detectVisualCliches(description: string) {
  const normalized = clean(description)
  return CLICHE_PATTERNS.filter((item) => item.pattern.test(normalized)).map((item) => ({ label: item.label, alternative: item.alternative }))
}

export type CreativeIdentity = {
  persona: 'academic' | 'human' | 'media' | 'future' | 'book' | 'research' | 'quote' | 'event'
  imageRealism: 'documentary' | 'editorial' | 'abstract'
  faceDistance: 'close' | 'medium' | 'wide'
  lighting: 'natural' | 'dramatic' | 'soft'
  negativeSpace: 'generous' | 'balanced' | 'compact'
  textDensity: 'minimal' | 'balanced' | 'rich'
  frameStyle: 'none' | 'editorial' | 'architectural'
  sealPolicy: 'quiet' | 'visible' | 'hidden'
}

export const DEFAULT_CREATIVE_IDENTITY: CreativeIdentity = {
  persona: 'academic',
  imageRealism: 'editorial',
  faceDistance: 'medium',
  lighting: 'natural',
  negativeSpace: 'generous',
  textDensity: 'balanced',
  frameStyle: 'editorial',
  sealPolicy: 'quiet',
}

export function identityContext(identity: CreativeIdentity) {
  const persona = {
    academic: 'د. أحمد الأكاديمي', human: 'د. أحمد الإنساني', media: 'د. أحمد الإعلامي', future: 'د. أحمد المستقبلي',
    book: 'إطلاق كتاب', research: 'بحث علمي', quote: 'اقتباس', event: 'حدث',
  }[identity.persona]
  return `${persona} · صورة ${identity.imageRealism} · إضاءة ${identity.lighting} · مساحة ${identity.negativeSpace} · نص ${identity.textDensity} · إطار ${identity.frameStyle}`
}
