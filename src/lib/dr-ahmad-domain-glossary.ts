import glossaryData from '../data/dr-ahmad-domain-glossary.json'

export type DomainMood = 'bright' | 'human' | 'institutional' | 'playful' | 'energetic' | 'academic' | 'future' | 'clear' | 'optimistic' | 'creative' | 'critical' | 'calm' | 'data' | 'dignified' | 'collaborative' | 'warm' | 'balanced' | 'immersive' | 'curious' | 'dynamic' | 'intellectual' | 'precise' | 'confident' | 'efficient'

export type DrAhmadGlossaryEntry = {
  id: string
  canonicalAr: string
  canonicalEn: string
  domain: string
  aliases: string[]
  meaningAr: string
  visualScenes: string[]
  avoid: string[]
  moods: DomainMood[]
  preferredWorlds: string[]
}

export type DomainFacetKind = 'audience' | 'context' | 'action' | 'outcome' | 'method'

export type DomainFacet = {
  id: string
  kind: DomainFacetKind
  canonicalAr: string
  canonicalEn: string
  aliases: string[]
  meaningAr: string
  visualHint?: string
  moods?: DomainMood[]
  preferredWorlds?: string[]
}

export type RecognizedDomainTerm = {
  id: string
  kind: 'concept' | DomainFacetKind
  canonicalAr: string
  canonicalEn: string
  score: number
  matchedAlias: string
}

export type DrAhmadDomainUnderstanding = {
  primary: DrAhmadGlossaryEntry | null
  matches: DrAhmadGlossaryEntry[]
  confidence: number
  recognizedFrom: string
  expandedContext: string
  compoundMeaning: string
  recognizedTerms: RecognizedDomainTerm[]
  visualScenes: string[]
  avoid: string[]
  moods: DomainMood[]
  preferredWorlds: string[]
  literalAnchors: string[]
  conceptCapacity: number
}

export const DR_AHMAD_DOMAIN_GLOSSARY = glossaryData as DrAhmadGlossaryEntry[]

const ARABIC_DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/gu
const STOP = new Set(['في', 'من', 'على', 'عن', 'مع', 'الى', 'إلى', 'ال', 'هذا', 'هذه', 'هو', 'هي', 'و', 'او', 'أو', 'ثم', 'قد', 'ما', 'هل'])
const POSITIVE_MOODS: DomainMood[] = ['bright', 'playful', 'energetic', 'optimistic', 'creative', 'warm', 'collaborative', 'curious', 'dynamic']

export function normalizeDomainTerm(value = '') {
  return String(value)
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ة/gu, 'ه')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/گ/gu, 'ك')
    .replace(/چ/gu, 'ج')
    .replace(/[\u200c-\u200f\u202a-\u202e]/gu, ' ')
    .replace(/[^\p{L}\p{N}\s+.#-]+/gu, ' ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const termsOf = (value = '') => normalizeDomainTerm(value).split(/\s+/).filter((token) => token.length > 1 && !STOP.has(token))
const unique = <T,>(items: T[]) => [...new Set(items)]

function arabicVariants(value: string) {
  const normalized = normalizeDomainTerm(value)
  if (!normalized) return []
  const variants = new Set<string>([normalized])
  const withoutArticle = normalized.replace(/(^|\s)ال(?=[\p{L}])/gu, '$1')
  if (withoutArticle !== normalized) variants.add(withoutArticle)
  if (!normalized.startsWith('ال') && /^[\p{Script=Arabic}]/u.test(normalized)) variants.add(`ال${normalized}`)
  variants.add(normalized.replace(/ه\b/gu, 'ة'))
  variants.add(normalized.replace(/ي\b/gu, 'ى'))
  variants.add(normalized.replace(/ا/gu, 'أ'))
  return [...variants].filter(Boolean)
}

function latinVariants(value: string) {
  const normalized = normalizeDomainTerm(value)
  if (!/[a-z]/i.test(normalized)) return []
  return unique([
    normalized,
    normalized.replace(/\s+/g, ''),
    normalized.replace(/\s+/g, '-'),
    normalized.replace(/\./g, ''),
  ])
}

function aliasVariants(value: string) {
  return unique([...arabicVariants(value), ...latinVariants(value)])
}

type AliasRecord = {
  kind: 'concept' | DomainFacetKind
  id: string
  canonicalAr: string
  canonicalEn: string
  alias: string
  normalized: string
  entry?: DrAhmadGlossaryEntry
  facet?: DomainFacet
}

const facet = (kind: DomainFacetKind, id: string, canonicalAr: string, canonicalEn: string, aliases: string[], meaningAr: string, visualHint?: string, moods?: DomainMood[], preferredWorlds?: string[]): DomainFacet => ({ kind, id, canonicalAr, canonicalEn, aliases, meaningAr, visualHint, moods, preferredWorlds })

export const DR_AHMAD_DOMAIN_FACETS: DomainFacet[] = [
  // الجمهور
  facet('audience', 'students', 'الطلبة', 'Students', ['طالب', 'طلاب', 'طالبة', 'متعلمين', 'متعلم', 'student', 'learners'], 'الطلبة بوصفهم متعلمين ذوي فروق واحتياجات وصوت وحقوق.', 'متعلم فاعل داخل موقف حقيقي', ['human', 'bright'], ['optimistic-human', 'daylight-learning']),
  facet('audience', 'faculty', 'أعضاء هيئة التدريس', 'Faculty Members', ['عضو هيئة تدريس', 'استاذ جامعي', 'أستاذ جامعي', 'faculty', 'professor', 'academics'], 'أعضاء هيئة التدريس بوصفهم مصممي تعلم وباحثين وقادة للممارسة الجامعية.', 'أستاذ جامعي يراجع قرارًا أو يصمم تجربة', ['academic', 'human'], ['human-documentary', 'daylight-learning']),
  facet('audience', 'teachers', 'المعلمون', 'Teachers', ['معلم', 'معلمين', 'مدرس', 'teacher', 'teachers'], 'المعلمون بوصفهم ميسرين ومصممين ومقوّمين للعلاقات والخبرات التعليمية.', 'معلم يقود تفاعلًا أصيلًا لا صورة صفية مصطنعة', ['human', 'bright'], ['optimistic-human', 'human-documentary']),
  facet('audience', 'parents', 'أولياء الأمور', 'Parents and Guardians', ['ولي امر', 'والدين', 'والد', 'ام', 'أم', 'اسرة', 'أسرة', 'parents', 'family'], 'الأسرة وولي الأمر في التوجيه والحماية وبناء الاستقلال والوعي.', 'علاقة أسرية واقعية ذات مساحة للحوار', ['warm', 'human'], ['optimistic-human', 'human-documentary']),
  facet('audience', 'children', 'الأطفال', 'Children', ['طفل', 'اطفال', 'أطفال', 'ناشئة', 'child', 'kids'], 'الأطفال وفق مراحلهم النمائية وحقوقهم واحتياجاتهم للحماية واللعب والتعلم.', 'طفل فاعل في بيئة آمنة ومضيئة بلا استغلال عاطفي', ['warm', 'bright'], ['optimistic-human', 'daylight-learning']),
  facet('audience', 'youth', 'الشباب', 'Youth', ['شباب', 'شاب', 'ناشئين', 'youth'], 'الشباب بوصفهم شركاء في المبادرة والإبداع والقيادة والتعلم والعمل.', 'فريق شبابي يبني أو يجرب أو يقود', ['energetic', 'optimistic'], ['living-learning-lab', 'optimistic-human']),
  facet('audience', 'special-needs', 'ذوو الإعاقة والاحتياجات الخاصة', 'People with Disabilities and Special Needs', ['ذوي', 'ذوو الاعاقة', 'إعاقة', 'احتياجات خاصة', 'special needs', 'disability'], 'المتعلمون ذوو الإعاقة مع التركيز على الإتاحة والاستقلال والكرامة لا الشفقة.', 'استخدام أداة مساندة بصورة طبيعية تحفظ الكرامة', ['dignified', 'human'], ['human-documentary', 'daylight-learning']),
  facet('audience', 'researchers', 'الباحثون', 'Researchers', ['باحث', 'باحثين', 'researcher', 'scholars'], 'الباحثون في بناء السؤال والأداة والدليل والتفسير والنزاهة.', 'باحث يتعامل مع أدلة قابلة للفحص', ['academic', 'precise'], ['forensic-still-life', 'archival-future']),
  facet('audience', 'leaders', 'القيادات وصنّاع القرار', 'Leaders and Decision Makers', ['قيادي', 'صانع قرار', 'مسؤول', 'ادارة عليا', 'leadership', 'decision maker'], 'القيادات المسؤولة عن تحويل المعرفة والبيانات إلى قرار مؤسسي قابل للمساءلة.', 'قرار يغيّر بنية منظومة لا مصافحة تجارية', ['institutional', 'confident'], ['architectural-silence', 'kinetic-system']),
  facet('audience', 'institutions', 'المؤسسات التعليمية', 'Educational Institutions', ['مؤسسة', 'وزارة', 'كلية', 'جامعة', 'مدرسة', 'institution', 'organization'], 'المؤسسات بوصفها منظومات من سياسات وأشخاص وعمليات وبيانات وثقافة.', 'منظومة مؤسسية مترابطة يظهر فيها الأثر الإنساني', ['institutional', 'clear'], ['architectural-silence', 'daylight-learning']),

  // السياق
  facet('context', 'higher-education', 'التعليم العالي', 'Higher Education', ['جامعي', 'جامعة', 'كلية', 'higher education', 'university'], 'سياق الجامعات والكليات والتدريس والبحث والخدمة والحوكمة.', 'فضاء جامعي معاصر وحقيقي', ['academic', 'institutional'], ['daylight-learning', 'architectural-silence']),
  facet('context', 'school-education', 'التعليم المدرسي', 'School Education', ['مدرسة', 'مدرسي', 'school', 'k12', 'K-12'], 'سياق المدرسة والصف والمناهج والمعلم والطفل والأسرة.', 'مدرسة مضيئة نشطة لا فصل فارغ كئيب', ['bright', 'human'], ['daylight-learning', 'optimistic-human']),
  facet('context', 'early-childhood', 'الطفولة المبكرة', 'Early Childhood', ['روضة', 'حضانة', 'طفولة مبكرة', 'early childhood', 'kindergarten'], 'مرحلة نمائية تحتاج تعلمًا باللعب وعلاقة آمنة وخبرات حسية مناسبة.', 'مواد تعلم ملموسة وألوان راقية وحركة آمنة', ['playful', 'warm'], ['playful-systems', 'tactile-learning']),
  facet('context', 'special-education', 'التربية الخاصة', 'Special Education', ['تربية خاصة', 'special education'], 'تعليم ودعم يستجيبان للاحتياجات الفردية ويزيلان الحواجز.', 'بيئة مرنة متاحة تحفظ الاستقلال', ['human', 'dignified'], ['human-documentary', 'daylight-learning']),
  facet('context', 'remote-learning', 'التعلّم عن بُعد', 'Remote Learning', ['عن بعد', 'remote', 'distance'], 'تعلم مع انفصال مكاني يحتاج اتصالًا وتصميمًا ودعمًا وتفاعلًا.', 'مساحتان مضيئتان يربطهما مسار تعلم', ['human', 'optimistic'], ['optimistic-human', 'daylight-learning']),
  facet('context', 'hybrid-context', 'البيئة الهجينة', 'Hybrid Environment', ['هجين', 'مدمج', 'hybrid', 'blended'], 'بيئة تمزج الحضور والاتصال الرقمي ضمن تجربة واحدة متكاملة.', 'جسر واضح بين حضور مادي ورقمي', ['balanced', 'bright'], ['kinetic-system', 'daylight-learning']),
  facet('context', 'smart-context', 'البيئة الذكية', 'Smart Environment', ['ذكي', 'smart', 'intelligent environment'], 'بيئة تستخدم الاتصال والبيانات والاستجابة السياقية لخدمة الإنسان.', 'مكان يستجيب بهدوء لاحتياج المتعلم', ['future', 'clear'], ['living-learning-lab', 'kinetic-system']),
  facet('context', 'kuwait', 'السياق الكويتي', 'Kuwaiti Context', ['الكويت', 'كويتي', 'Kuwait'], 'السياق الثقافي والمؤسسي والتعليمي في دولة الكويت.', 'بيئة كويتية معاصرة بلا رموز سياحية مبتذلة', ['dignified', 'institutional'], ['daylight-learning', 'architectural-silence']),
  facet('context', 'arab-world', 'السياق العربي', 'Arab Context', ['عربي', 'العالم العربي', 'Arab'], 'السياق اللغوي والثقافي والمؤسسي العربي مع تنوعه.', 'بيئة عربية معاصرة أصيلة غير نمطية', ['dignified', 'human'], ['human-documentary', 'daylight-learning']),
  facet('context', 'classroom', 'الصف الدراسي', 'Classroom', ['فصل', 'صف', 'classroom'], 'الموقف الصفي بوصفه علاقة ونشاطًا وتفاعلًا وتقويمًا لا مكانًا فارغًا فقط.', 'صف حي ومضيء تظهر فيه مهمة أو علاقة واضحة', ['bright', 'human'], ['daylight-learning', 'optimistic-human']),
  facet('context', 'research-context', 'البحث العلمي', 'Scientific Research Context', ['دراسة', 'بحث', 'رسالة', 'research', 'study'], 'سياق السؤال والمنهج والأداة والبيانات والتفسير والنشر.', 'أدلة وعملية تحقق دقيقة', ['academic', 'precise'], ['forensic-still-life', 'archival-future']),
  facet('context', 'policy-context', 'السياسات والحوكمة', 'Policy and Governance Context', ['سياسة', 'حوكمة', 'تشريع', 'policy', 'governance'], 'سياق القواعد والصلاحيات والحقوق والمساءلة والقرار.', 'بنية قرار شفافة تظهر المسؤولية', ['institutional', 'confident'], ['architectural-silence', 'kinetic-system']),

  // الأفعال والغايات
  facet('action', 'design', 'التصميم', 'Design', ['تصميم', 'صمم', 'design'], 'تحويل الاحتياج إلى بنية وخبرة وحل مقصود قابل للاختبار.', 'مواد ومراحل تتشكل في نظام واضح', ['creative', 'clear'], ['tactile-learning', 'kinetic-system']),
  facet('action', 'develop', 'التطوير', 'Development', ['تطوير', 'تحسين', 'develop', 'improve'], 'بناء الحل وتحسينه تكراريًا اعتمادًا على الأدلة والتغذية الراجعة.', 'تطور مرئي بين نموذج أولي ونسخة ناضجة', ['creative', 'optimistic'], ['living-learning-lab', 'tactile-learning']),
  facet('action', 'integrate', 'الدمج والتوظيف', 'Integration and Use', ['دمج', 'توظيف', 'استخدام', 'integrate', 'use'], 'توظيف الأداة داخل هدف وسياق وممارسة بدل إضافتها شكليًا.', 'أداة تصبح جزءًا طبيعيًا من مسار التعلم', ['balanced', 'human'], ['daylight-learning', 'kinetic-system']),
  facet('action', 'adopt', 'التبنّي والقبول', 'Adoption and Acceptance', ['تبني', 'قبول', 'اعتماد', 'adoption', 'acceptance'], 'انتقال الفرد أو المؤسسة من الوعي إلى النية والاستخدام المستدام.', 'عتبة انتقال واضحة بين التردد والاستخدام', ['institutional', 'curious'], ['kinetic-system', 'visual-paradox']),
  facet('action', 'evaluate', 'التقويم والتقييم', 'Evaluation and Assessment', ['تقويم', 'تقييم', 'evaluate', 'assess'], 'جمع أدلة والحكم وفق معايير بهدف التحسين أو اتخاذ القرار.', 'أدلة ومعايير وقرار واضح', ['academic', 'precise'], ['forensic-still-life', 'archival-future']),
  facet('action', 'measure', 'القياس', 'Measurement', ['قياس', 'مؤشر', 'measure', 'metric'], 'تمثيل خاصية أو أداء بقيمة وفق قواعد وأداة مع فهم حدود الرقم.', 'مؤشر مرتبط بإنسان أو أداء حقيقي', ['data', 'precise'], ['forensic-still-life', 'kinetic-system']),
  facet('action', 'analyze', 'التحليل', 'Analysis', ['تحليل', 'analyze', 'analysis'], 'تفكيك البيانات أو الفكرة واكتشاف العلاقات والأنماط والتفسيرات.', 'عناصر يعاد ترتيبها لتكشف نمطًا', ['academic', 'precise'], ['forensic-still-life', 'paper-sculpture']),
  facet('action', 'predict', 'التنبؤ', 'Prediction', ['تنبؤ', 'استشراف', 'predict', 'forecast'], 'تقدير نتائج مستقبلية اعتمادًا على بيانات وافتراضات مع التعبير عن عدم اليقين.', 'مسارات محتملة لا كرة بلورية', ['future', 'data'], ['kinetic-system', 'visual-paradox']),
  facet('action', 'personalize', 'التخصيص والتكييف', 'Personalization and Adaptation', ['تخصيص', 'تكيف', 'تكييف', 'personalize', 'adaptive'], 'تعديل المسار أو الدعم وفق حاجة المتعلم مع الحفاظ على agency والعدالة.', 'مسارات مختلفة تصل إلى هدف مشترك', ['human', 'bright'], ['playful-systems', 'kinetic-system']),
  facet('action', 'motivate', 'التحفيز والانخراط', 'Motivation and Engagement', ['تحفيز', 'انخراط', 'تفاعل', 'engagement', 'motivation'], 'بناء اهتمام ومثابرة ومشاركة ذات معنى لا نقاط سطحية وحدها.', 'حركة وتقدم واستجابة واضحة', ['energetic', 'bright'], ['playful-systems', 'optimistic-human']),
  facet('action', 'govern', 'الحوكمة والتنظيم', 'Governance', ['حوكمة', 'تنظيم', 'govern'], 'تحديد الأدوار والسياسات والضوابط والشفافية والمساءلة.', 'منظومة قرار متوازنة وشفافة', ['institutional', 'confident'], ['architectural-silence', 'kinetic-system']),
  facet('action', 'transform', 'التحول', 'Transformation', ['تحول', 'تحويل', 'transform'], 'تغيير جوهري في البنية والعملية والثقافة والقيمة لا رقمنة القديم فقط.', 'بنية مألوفة تتحول إلى مسار جديد', ['future', 'optimistic'], ['kinetic-system', 'color-field-editorial']),
  facet('action', 'train', 'التدريب والتطوير المهني', 'Training and Professional Development', ['تدريب', 'تطوير مهني', 'train', 'professional development'], 'بناء كفايات قابلة للممارسة والنقل مع دعم ومتابعة.', 'ممارسة وتغذية راجعة داخل فريق مهني', ['collaborative', 'human'], ['living-learning-lab', 'optimistic-human']),
  facet('action', 'protect', 'الحماية والوقاية', 'Protection and Prevention', ['حماية', 'وقاية', 'سلامة', 'protect', 'safety'], 'خفض المخاطر وحماية الحقوق والخصوصية والرفاه دون إلغاء الاستقلال.', 'حدود آمنة تسمح بالحركة والتعلم', ['human', 'balanced'], ['human-documentary', 'visual-paradox']),
  facet('action', 'innovate', 'الابتكار', 'Innovation', ['ابتكار', 'ابداع', 'إبداع', 'innovate', 'creative'], 'تحويل فكرة جديدة إلى قيمة قابلة للاختبار والتطبيق والتوسع.', 'نموذج أولي حي يغير القاعدة', ['creative', 'optimistic'], ['living-learning-lab', 'tactile-learning']),

  // النواتج
  facet('outcome', 'achievement', 'التحصيل', 'Achievement', ['تحصيل', 'درجات', 'achievement'], 'مدى تحقق المعرفة والمهارات المقاسة، ولا يختزل قيمة المتعلم.', 'دليل تعلم يتجاوز ورقة الدرجة', ['academic', 'balanced'], ['forensic-still-life', 'daylight-learning']),
  facet('outcome', 'learning-quality', 'جودة التعلّم', 'Learning Quality', ['جودة', 'quality'], 'عمق الفهم وملاءمة الخبرة وعدالتها وأثرها واستدامتها.', 'خبرة متماسكة يظهر فيها الدليل والأثر', ['institutional', 'clear'], ['daylight-learning', 'kinetic-system']),
  facet('outcome', 'skills', 'المهارات', 'Skills', ['مهارة', 'مهارات', 'skills', 'competencies'], 'قدرات قابلة للأداء والنقل والتحسين في سياقات مختلفة.', 'أداء حقيقي وأداة ونتيجة', ['confident', 'human'], ['living-learning-lab', 'tactile-learning']),
  facet('outcome', 'critical-thinking', 'التفكير الناقد', 'Critical Thinking', ['تفكير نقدي', 'critical thinking'], 'تحليل الادعاءات والأدلة والافتراضات والبدائل وإصدار حكم مبرر.', 'أدلة متعارضة يعاد فحصها', ['intellectual', 'precise'], ['forensic-still-life', 'visual-paradox']),
  facet('outcome', 'creativity', 'الإبداع', 'Creativity', ['ابداع', 'إبداع', 'creative thinking'], 'إنتاج أفكار أو حلول أصيلة وملائمة عبر الطلاقة والمرونة والتطوير.', 'مواد مألوفة تتحول إلى حل غير متوقع', ['creative', 'bright'], ['paper-sculpture', 'living-learning-lab']),
  facet('outcome', 'decision-making', 'اتخاذ القرار', 'Decision Making', ['قرار', 'اختيار', 'decision'], 'اختيار بديل وفق أهداف وأدلة وقيم ومخاطر ومسؤولية.', 'مفترق واضح مبني على أدلة لا شطرنج', ['confident', 'intellectual'], ['visual-paradox', 'kinetic-system']),
  facet('outcome', 'equity', 'الإنصاف والعدالة', 'Equity and Fairness', ['انصاف', 'إنصاف', 'عدالة', 'equity', 'fairness'], 'إزالة الحواجز وتوفير دعم يناسب الاحتياج للوصول إلى فرصة عادلة.', 'طرق مختلفة نحو فرصة مشتركة', ['human', 'dignified'], ['human-documentary', 'visual-paradox']),
  facet('outcome', 'accessibility', 'الإتاحة', 'Accessibility', ['اتاحة', 'إتاحة', 'وصول', 'accessibility'], 'تصميم يزيل الحواجز الحسية والحركية والمعرفية والتكنولوجية.', 'بيئة يستخدمها أشخاص مختلفون باستقلال', ['human', 'clear'], ['daylight-learning', 'human-documentary']),
  facet('outcome', 'integrity', 'النزاهة', 'Integrity', ['نزاهة', 'امانة', 'أمانة', 'integrity'], 'التزام الصدق والشفافية والمسؤولية واحترام المصادر والمعايير.', 'أثر قابل للتتبع ودليل غير مخفي', ['dignified', 'academic'], ['archival-future', 'forensic-still-life']),
  facet('outcome', 'wellbeing', 'الرفاه', 'Wellbeing', ['رفاه', 'صحة نفسية', 'wellbeing'], 'حالة متوازنة تشمل الصحة والعلاقة والمعنى والقدرة على التعلم والعمل.', 'مساحة بشرية هادئة ومضيئة', ['warm', 'human'], ['optimistic-human', 'daylight-learning']),
  facet('outcome', 'efficiency', 'الكفاءة', 'Efficiency', ['كفاءة', 'فعالية تشغيلية', 'efficiency'], 'تحقيق قيمة أفضل بوقت وموارد وجهد مناسبين دون التضحية بالجودة أو الإنسان.', 'تدفق عمل واضح قليل الهدر', ['efficient', 'clear'], ['kinetic-system', 'architectural-silence']),
  facet('outcome', 'innovation-capacity', 'القدرة الابتكارية', 'Innovation Capacity', ['قدرة ابتكارية', 'innovation capability'], 'قدرة الفرد أو المؤسسة على توليد الأفكار وتجريبها وتعلمها وتوسيعها.', 'مختبر حي يتحول فيه الفشل إلى تحسين', ['creative', 'optimistic'], ['living-learning-lab', 'tactile-learning']),

  // المناهج والنماذج
  facet('method', 'tam', 'نموذج قبول التكنولوجيا TAM', 'Technology Acceptance Model', ['TAM', 'تم', 'technology acceptance model'], 'نموذج يفسر نية الاستخدام عبر المنفعة المدركة وسهولة الاستخدام وعوامل ممتدة.', 'علاقة بين المنفعة والسهولة والنية والاستخدام', ['academic', 'data'], ['forensic-still-life', 'kinetic-system']),
  facet('method', 'utaut', 'النظرية الموحدة لقبول واستخدام التكنولوجيا UTAUT', 'UTAUT', ['UTAUT', 'يوتاوت', 'unified theory'], 'نموذج يفسر النية والاستخدام عبر توقع الأداء والجهد والتأثير الاجتماعي والظروف الميسرة.', 'عوامل متعددة تتقاطع في قرار استخدام', ['academic', 'data'], ['kinetic-system', 'forensic-still-life']),
  facet('method', 'sem', 'نمذجة المعادلات الهيكلية SEM', 'Structural Equation Modeling', ['SEM', 'نمذجة هيكلية'], 'أسرة نماذج تختبر علاقات بين متغيرات ظاهرة وكامنة ونماذج قياس وهيكل.', 'شبكة علاقات سببية مفترضة قابلة للاختبار', ['data', 'precise'], ['kinetic-system', 'forensic-still-life']),
  facet('method', 'pls-sem', 'نمذجة PLS-SEM', 'Partial Least Squares SEM', ['PLS', 'PLS-SEM', 'سمارت بلس'], 'منهج مكونات في النمذجة الهيكلية يركز على التنبؤ وتفسير التباين وفق شروطه.', 'مسارات تنبؤية بين بنى كامنة', ['data', 'precise'], ['kinetic-system', 'forensic-still-life']),
  facet('method', 'spss', 'برنامج SPSS', 'SPSS', ['SPSS', 'اس بي اس اس', 'برنامج التحليل'], 'حزمة لتحليل البيانات الإحصائية وإدارة المتغيرات والاختبارات والنماذج.', 'بيانات منظمة تتحول إلى اختبار وتفسير', ['data', 'academic'], ['forensic-still-life', 'archival-future']),
  facet('method', 'quantitative', 'المنهج الكمي', 'Quantitative Method', ['كمي', 'quantitative'], 'منهج يعتمد القياس والبيانات العددية والتحليل الإحصائي.', 'قياسات وعينات وعلاقات واضحة', ['data', 'academic'], ['forensic-still-life', 'kinetic-system']),
  facet('method', 'qualitative', 'المنهج النوعي', 'Qualitative Method', ['نوعي', 'كيفي', 'qualitative'], 'منهج يفسر المعنى والخبرة والسياق من بيانات غنية.', 'أصوات وتجارب متعددة تظهر أنماطًا', ['human', 'intellectual'], ['human-documentary', 'archival-future']),
  facet('method', 'mixed', 'المنهج المختلط', 'Mixed Methods', ['مختلط', 'mixed methods'], 'دمج متكامل للبيانات الكمية والنوعية وفق منطق واضح.', 'مساران من الأدلة يلتقيان في تفسير واحد', ['academic', 'balanced'], ['kinetic-system', 'paper-sculpture']),
  facet('method', 'experimental', 'المنهج التجريبي', 'Experimental Method', ['تجريبي', 'experiment'], 'اختبار أثر تدخل مع ضبط مناسب للمقارنة والاستدلال.', 'مجموعتان وتجربة ونتيجة قابلة للمقارنة', ['academic', 'precise'], ['forensic-still-life', 'living-learning-lab']),
  facet('method', 'descriptive', 'المنهج الوصفي', 'Descriptive Method', ['وصفي', 'descriptive'], 'وصف منظم لواقع أو اتجاهات أو علاقات دون تدخل تجريبي.', 'خريطة دقيقة للواقع كما هو', ['academic', 'clear'], ['archival-future', 'forensic-still-life']),
]

const CONCEPT_ALIAS_INDEX: AliasRecord[] = DR_AHMAD_DOMAIN_GLOSSARY.flatMap((entry) =>
  unique([entry.canonicalAr, entry.canonicalEn, ...entry.aliases]).flatMap((alias) =>
    aliasVariants(alias).map((normalized) => ({
      kind: 'concept' as const,
      id: entry.id,
      canonicalAr: entry.canonicalAr,
      canonicalEn: entry.canonicalEn,
      alias,
      normalized,
      entry,
    })),
  ),
)

const FACET_ALIAS_INDEX: AliasRecord[] = DR_AHMAD_DOMAIN_FACETS.flatMap((item) =>
  unique([item.canonicalAr, item.canonicalEn, ...item.aliases]).flatMap((alias) =>
    aliasVariants(alias).map((normalized) => ({
      kind: item.kind,
      id: item.id,
      canonicalAr: item.canonicalAr,
      canonicalEn: item.canonicalEn,
      alias,
      normalized,
      facet: item,
    })),
  ),
)

function aliasScore(input: string, alias: string) {
  const normalizedInput = normalizeDomainTerm(input)
  const normalizedAlias = normalizeDomainTerm(alias)
  if (!normalizedInput || !normalizedAlias) return 0
  if (normalizedInput === normalizedAlias) return 148
  const inputCompact = normalizedInput.replace(/\s+/g, '')
  const aliasCompact = normalizedAlias.replace(/\s+/g, '')
  if (inputCompact === aliasCompact) return 144
  const paddedInput = ` ${normalizedInput} `
  const paddedAlias = ` ${normalizedAlias} `
  if (paddedInput.includes(paddedAlias)) return 108
  if (paddedAlias.includes(paddedInput)) return 102
  const inputTokens = termsOf(normalizedInput)
  const aliasTokens = termsOf(normalizedAlias)
  if (!inputTokens.length || !aliasTokens.length) return 0
  if (inputTokens.length === 1 && aliasTokens[0]?.startsWith(inputTokens[0]) && inputTokens[0].length >= 3) return 92
  if (aliasTokens.length === 1 && inputTokens.some((token) => token === aliasTokens[0])) return 106
  const overlap = aliasTokens.filter((token) => inputTokens.some((candidate) => candidate === token || (candidate.length >= 4 && token.startsWith(candidate)) || (token.length >= 4 && candidate.startsWith(token)))).length
  if (!overlap) return 0
  return Math.round(48 + (overlap / aliasTokens.length) * 38 + (overlap / inputTokens.length) * 12)
}

function bestRecordScore(record: AliasRecord, input: string, context: string) {
  const direct = aliasScore(input, record.normalized)
  const contextual = aliasScore(`${input} ${context}`, record.normalized)
  const first = termsOf(input)[0] || ''
  const aliasFirst = termsOf(record.normalized)[0] || ''
  const firstWordBoost = first && aliasFirst && (aliasFirst.startsWith(first) || first.startsWith(aliasFirst)) ? 16 : 0
  const acronymBoost = /^[a-z0-9+#.]{2,10}$/i.test(normalizeDomainTerm(input)) && normalizeDomainTerm(input).replace(/\s/g, '') === record.normalized.replace(/\s/g, '') ? 30 : 0
  return { score: Math.max(direct + firstWordBoost + acronymBoost, contextual * .78), direct }
}

function rankConcepts(input: string, context: string) {
  const byEntry = new Map<string, { entry: DrAhmadGlossaryEntry; score: number; direct: number; alias: string }>()
  for (const record of CONCEPT_ALIAS_INDEX) {
    const result = bestRecordScore(record, input, context)
    if (result.score < 48 || !record.entry) continue
    const current = byEntry.get(record.id)
    if (!current || result.score > current.score) byEntry.set(record.id, { entry: record.entry, score: result.score, direct: result.direct, alias: record.alias })
  }
  return [...byEntry.values()].sort((left, right) => right.score - left.score || right.direct - left.direct || right.entry.aliases.length - left.entry.aliases.length)
}

function rankFacets(input: string, context: string) {
  const source = `${input} ${context}`
  const byFacet = new Map<string, { facet: DomainFacet; score: number; alias: string }>()
  for (const record of FACET_ALIAS_INDEX) {
    const direct = aliasScore(input, record.normalized)
    const contextual = aliasScore(source, record.normalized)
    const score = Math.max(direct, contextual * .9)
    if (score < 76 || !record.facet) continue
    const key = `${record.kind}:${record.id}`
    const current = byFacet.get(key)
    if (!current || score > current.score) byFacet.set(key, { facet: record.facet, score, alias: record.alias })
  }
  const ranked = [...byFacet.values()].sort((left, right) => right.score - left.score)
  const usedKinds = new Map<DomainFacetKind, number>()
  return ranked.filter(({ facet }) => {
    const count = usedKinds.get(facet.kind) || 0
    if (count >= (facet.kind === 'method' ? 2 : 3)) return false
    usedKinds.set(facet.kind, count + 1)
    return true
  }).slice(0, 12)
}

const ANCHOR_STOP = new Set([
  ...STOP,
  'تصميم', 'صوره', 'صورة', 'بوستر', 'منشور', 'فكره', 'فكرة', 'موضوع', 'عنوان', 'شرح', 'مفهوم',
  'اثر', 'أثر', 'تاثير', 'تأثير', 'دور', 'استخدام', 'توظيف', 'تطبيق', 'مشكله', 'مشكلة', 'قضيه', 'قضية',
  'الجديد', 'الجديده', 'الحديث', 'الحديثه', 'عبر', 'نحو', 'حول', 'داخل', 'خارج', 'لدي', 'عند', 'بين',
])

function stripLeadingConjunction(token: string) {
  if (/^و[\p{Script=Arabic}]{2,}$/u.test(token)) return token.slice(1)
  return token
}

function extractLiteralAnchors(input: string, recognizedTerms: RecognizedDomainTerm[]) {
  let residual = ` ${normalizeDomainTerm(input)} `
  const phrases = unique(recognizedTerms.flatMap((item) => [item.matchedAlias, item.canonicalAr, item.canonicalEn]))
    .map((item) => normalizeDomainTerm(item))
    .filter((item) => item.length >= 2)
    .sort((left, right) => right.length - left.length)
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    residual = residual.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'giu'), '  ')
  }
  const chunks = residual.split(/\s{2,}|[،,:;؛|]+/u)
  const anchors: string[] = []
  for (const chunk of chunks) {
    const tokens = normalizeDomainTerm(chunk).split(/\s+/)
      .map(stripLeadingConjunction)
      .filter((token) => token.length > 1 && !ANCHOR_STOP.has(token))
    if (!tokens.length) continue
    const compact = tokens.slice(0, 7).join(' ')
    if (compact.length >= 3 && !anchors.includes(compact)) anchors.push(compact)
  }
  return anchors.slice(0, 5)
}

function moodWorlds(moods: DomainMood[]) {
  const worlds: string[] = []
  if (moods.some((mood) => ['bright', 'optimistic'].includes(mood))) worlds.push('daylight-learning', 'sunlit-campus', 'color-field-editorial')
  if (moods.some((mood) => ['playful', 'energetic'].includes(mood))) worlds.push('playful-systems', 'kinetic-collage', 'tactile-learning')
  if (moods.some((mood) => ['human', 'warm', 'collaborative'].includes(mood))) worlds.push('optimistic-human', 'human-documentary', 'living-learning-lab')
  if (moods.some((mood) => ['academic', 'data', 'precise'].includes(mood))) worlds.push('forensic-still-life', 'archival-future', 'kinetic-system')
  if (moods.some((mood) => ['creative', 'curious', 'immersive'].includes(mood))) worlds.push('paper-sculpture', 'tactile-learning', 'spatial-learning')
  if (moods.some((mood) => ['institutional', 'confident', 'efficient'].includes(mood))) worlds.push('architectural-silence', 'daylight-learning', 'kinetic-system')
  return worlds
}

const facetCount = (kind: DomainFacetKind) => DR_AHMAD_DOMAIN_FACETS.filter((item) => item.kind === kind).length
export const DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY = DR_AHMAD_DOMAIN_GLOSSARY.length
  * (facetCount('audience') + 1)
  * (facetCount('context') + 1)
  * (facetCount('action') + 1)
  * (facetCount('outcome') + 1)
  * (facetCount('method') + 1)

export function interpretDrAhmadDomain(input: string, context = ''): DrAhmadDomainUnderstanding {
  const cleanInput = normalizeDomainTerm(input)
  const empty: DrAhmadDomainUnderstanding = {
    primary: null,
    matches: [],
    confidence: 0,
    recognizedFrom: '',
    expandedContext: '',
    compoundMeaning: '',
    recognizedTerms: [],
    visualScenes: [],
    avoid: [],
    moods: [],
    preferredWorlds: [],
    literalAnchors: [],
    conceptCapacity: DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY,
  }
  if (!cleanInput) return empty

  const ranked = rankConcepts(input, context)
  const primary = ranked[0]?.entry || null
  const matches = ranked.filter((item, index) => item.direct >= 100 || (index === 0 && item.score >= 66)).slice(0, 8).map((item) => item.entry)
  const facets = rankFacets(input, context)
  const confidence = Math.max(0, Math.min(99, Math.round(ranked[0]?.score || (facets[0]?.score || 0) * .72)))

  const directConcepts = ranked.filter((item, index) => item.direct >= 100 || (index === 0 && item.score >= 72)).slice(0, 8)
  const recognizedTerms: RecognizedDomainTerm[] = [
    ...directConcepts.map((item) => ({ id: item.entry.id, kind: 'concept' as const, canonicalAr: item.entry.canonicalAr, canonicalEn: item.entry.canonicalEn, score: Math.round(item.score), matchedAlias: item.alias })),
    ...facets.map((item) => ({ id: item.facet.id, kind: item.facet.kind, canonicalAr: item.facet.canonicalAr, canonicalEn: item.facet.canonicalEn, score: Math.round(item.score), matchedAlias: item.alias })),
  ]
  const literalAnchors = extractLiteralAnchors(input, recognizedTerms)

  if (!primary && !facets.length) return empty

  const facetByKind = (kind: DomainFacetKind) => facets.filter((item) => item.facet.kind === kind).map((item) => item.facet)
  const audiences = facetByKind('audience')
  const contexts = facetByKind('context')
  const actions = facetByKind('action')
  const outcomes = facetByKind('outcome')
  const methods = facetByKind('method')
  const baseMeaning = primary?.meaningAr || 'مفهوم مركب داخل مجالات د. أحمد في التعليم والتكنولوجيا والبحث والقيادة.'
  const compoundMeaning = [
    baseMeaning,
    audiences.length ? `الفئة المقصودة: ${audiences.map((item) => item.canonicalAr).join('، ')}.` : '',
    contexts.length ? `السياق: ${contexts.map((item) => item.canonicalAr).join('، ')}.` : '',
    actions.length ? `العملية أو الغاية: ${actions.map((item) => item.canonicalAr).join('، ')}.` : '',
    outcomes.length ? `الناتج المراد فهمه أو تحسينه: ${outcomes.map((item) => item.canonicalAr).join('، ')}.` : '',
    methods.length ? `النموذج أو المنهج المرتبط: ${methods.map((item) => item.canonicalAr).join('، ')}.` : '',
    literalAnchors.length ? `الموضوع الحرفي الذي لا يجوز إسقاطه من الصورة: ${literalAnchors.join('، ')}.` : '',
  ].filter(Boolean).join(' ')

  const recognizedFrom = recognizedTerms.slice(0, 8).map((item) => `${item.canonicalAr}${item.canonicalEn ? ` (${item.canonicalEn})` : ''}`).join(' · ')
  const visualScenes = unique([
    ...(primary?.visualScenes || []),
    ...matches.slice(1).flatMap((entry) => entry.visualScenes.slice(0, 1)),
    ...facets.map((item) => item.facet.visualHint || '').filter(Boolean),
    ...(literalAnchors.length ? [`تقاطع بصري واضح بين ${primary?.canonicalAr || recognizedTerms[0]?.canonicalAr || 'المفهوم'} و${literalAnchors.join(' و')}`] : []),
  ]).slice(0, 14)
  const moods = unique([
    ...(primary?.moods || []),
    ...matches.flatMap((entry) => entry.moods),
    ...facets.flatMap((item) => item.facet.moods || []),
  ]).slice(0, 14)
  const positive = moods.some((mood) => POSITIVE_MOODS.includes(mood))
  const avoid = unique([
    ...(primary?.avoid || []),
    ...matches.flatMap((entry) => entry.avoid),
    ...(positive ? ['الجو الحزين الافتراضي', 'الممرات المظلمة', 'الفصول الفارغة الكئيبة', 'العزلة غير المطلوبة', 'تكرار الثيم نفسه'] : []),
    ...(literalAnchors.length ? [`إسقاط الموضوع الحرفي من الصورة: ${literalAnchors.join('، ')}`, 'اختزال العنوان في المصطلح الأساسي وحده'] : []),
    'كليشيه بصري عام لا يشرح المفهوم المتخصص',
    'نصوص أو شعارات مولدة داخل الصورة',
  ]).slice(0, 28)
  const preferredWorlds = unique([
    ...(primary?.preferredWorlds || []),
    ...matches.flatMap((entry) => entry.preferredWorlds),
    ...facets.flatMap((item) => item.facet.preferredWorlds || []),
    ...moodWorlds(moods),
  ]).slice(0, 18)

  const expandedContext = [
    primary ? `المصطلح الأساسي المعتمد: ${primary.canonicalAr} (${primary.canonicalEn}).` : 'تم التعرف على تركيب مفاهيمي متعدد الأبعاد.',
    primary ? `المجال: ${primary.domain}.` : '',
    `الفهم المتخصص: ${compoundMeaning}`,
    matches.length > 1 ? `مفاهيم مرتبطة يجب تمييزها: ${matches.slice(1).map((entry) => entry.canonicalAr).join('، ')}.` : '',
    literalAnchors.length ? `مرساة حرفية إلزامية: ${literalAnchors.join('، ')}.` : '',
  ].filter(Boolean).join(' ')

  return {
    primary,
    matches,
    confidence,
    recognizedFrom,
    expandedContext,
    compoundMeaning,
    recognizedTerms,
    visualScenes,
    avoid,
    moods,
    preferredWorlds,
    literalAnchors,
    conceptCapacity: DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY,
  }
}

export function domainGlossaryPrompt(understanding: DrAhmadDomainUnderstanding) {
  if (!understanding.primary && !understanding.recognizedTerms.length) return ''
  const primary = understanding.primary
  return [
    `DR AHMAD KNOWLEDGE GRAPH LOCK: ${primary ? `${primary.canonicalEn} / ${primary.canonicalAr}` : understanding.recognizedFrom}.`,
    `Precise compound meaning: ${understanding.compoundMeaning || primary?.meaningAr || understanding.expandedContext}`,
    understanding.recognizedTerms.length ? `Recognized dimensions: ${understanding.recognizedTerms.slice(0, 10).map((item) => `${item.kind}:${item.canonicalEn || item.canonicalAr}`).join(' | ')}.` : '',
    understanding.literalAnchors.length ? `MANDATORY LITERAL SUBJECTS: ${understanding.literalAnchors.join(' | ')}. They must be visually present and cannot be replaced by a generic metaphor.` : '',
    understanding.visualScenes.length ? `Valid visual interpretations: ${understanding.visualScenes.join(' | ')}.` : '',
    understanding.avoid.length ? `Forbidden semantic confusions and clichés: ${understanding.avoid.join(', ')}.` : '',
    understanding.moods.length ? `Preferred emotional range: ${understanding.moods.join(', ')}.` : '',
    'Do not infer meaning from a superficial keyword when the knowledge graph provides a domain-specific interpretation.',
  ].filter(Boolean).join(' ')
}
