import type { SemanticVerb } from './design-worlds'

export type SemanticPlatform = 'post' | 'video' | 'reel' | 'unknown'
export type SemanticDensity = 'minimal' | 'balanced' | 'dense'
export interface WorldSemanticAnalysis {
  topic: string
  centralIdea: string
  emotionalTone: string[]
  tension: number
  hasContrast: boolean
  hasQuestion: boolean
  hasTransformation: boolean
  hasCausality: boolean
  materialWords: string[]
  abstractWords: string[]
  semanticMotionVerb: SemanticVerb
  visualMetaphor: string
  formality: 'informal' | 'balanced' | 'formal' | 'academic'
  audience: 'general' | 'education' | 'professional' | 'academic' | 'youth'
  platform: SemanticPlatform
  density: SemanticDensity
  confidence: number
  reasons: string[]
}

type Rule = { verb: SemanticVerb; pattern: RegExp; metaphor: string; weight?: number }
const RULES: Rule[] = [
  {verb:'balance',pattern:/(عدل|عدالة|توازن|ضمير|أخلاق|اخلاق|إنصاف|انصاف|إنسان.*آلة|آلة.*إنسان)/,metaphor:'إعادة توزيع الكتل والضوء حتى يتحقق اتزان مرئي'},
  {verb:'root',pattern:/(جذر|جذور|أصل|اصول|هوية|غرس|طفل|تربية|ينمو|نمو)/,metaphor:'مسارات جذرية تنمو من الكلمة ثم تكشف ما انقطع وما بقي'},
  {verb:'split',pattern:/(بلا |لكن|بينما|مقابل|انقسام|فجوة|ليس |ليست |تناقض|ضد)/,metaphor:'بنية تنقسم عند التناقض ثم تعيد تركيب الخلاصة'},
  {verb:'question',pattern:/(؟|لماذا|كيف|ماذا|هل |سؤال)/,metaphor:'فراغ أو بوابة ناقصة تفتح طبقة جديدة بدلاً من علامة استفهام مباشرة'},
  {verb:'rise',pattern:/(نهض|نهوض|يصعد|صعود|ارتفع|تقدّم|تقدم|مستقبل|طموح)/,metaphor:'صعود ضوئي أو معماري تدريجي لا تحريك سطحي للأعلى'},
  {verb:'echo',pattern:/(ذاكرة|ذكرى|أثر|اثر|استمرار|يبقى|تاريخ)/,metaphor:'طبقات زمنية وأصداء تتلاشى ثم تستعاد'},
  {verb:'breathe',pattern:/(صمت|هدوء|سكينة|مسافة|تأمل|تامل)/,metaphor:'مساحة سالبة تتنفس وتخفض السرعة والكثافة'},
  {verb:'connect',pattern:/(شبك|اتصال|تواصل|علاقة|مجتمع|فريق|ربط|بيانات|ذكاء)/,metaphor:'عقد ومسارات تتصل فقط حين توجد علاقة ذات معنى'},
  {verb:'weave',pattern:/(نسيج|سدو|خيط|حكاية|سرد|ثقافة|هوية)/,metaphor:'خيوط مستقلة تنسج حجة واحدة من دون زخرفة جاهزة'},
  {verb:'orbit',pattern:/(مدار|كون|كوكب|دورة|منظومة|نظام|حول)/,metaphor:'مدارات تضع الفكرة المركزية كنقطة جاذبية'},
  {verb:'pulse',pattern:/(نبض|قلب|حياة|شعور|إنسان|انسان|عاطف)/,metaphor:'نبض ضوئي هادئ يغيّر المسافة لا حجم النص'},
  {verb:'path',pattern:/(طريق|مسار|رحلة|اتجاه|قرار|خطوة)/,metaphor:'مسار بصري يكشف السبب والنتيجة على مراحل'},
  {verb:'fracture',pattern:/(كسر|صدع|أزمة|ازمة|فشل|خطأ|خطا)/,metaphor:'كسر بصري يتحول إلى ممر جديد بدلاً من علامة فشل'},
  {verb:'protect',pattern:/(أمان|امان|حماية|آمن|امن|خصوصية|ثقة)/,metaphor:'حدود مرنة ومساحة آمنة تتكون حول العنصر الأهم'},
  {verb:'liberate',pattern:/(حرية|تحرر|قيد|يفرض|يكسر القيد)/,metaphor:'عنصر يتحرر من شبكة أو إطار مع بقاء اتجاه القراءة'},
  {verb:'confront',pattern:/(خطر|تحذير|أزمة|ازمة|ضجيج|صراع|مواجهة)/,metaphor:'ضوء أمامي أو كتلتان تتواجهان قبل انكشاف مركز الحجة'},
  {verb:'transform',pattern:/(تحول|يتحول|يصبح|تصبح|تغيير|يتغير)/,metaphor:'المادة نفسها تعيد تشكيل بنيتها لا مجرد انتقال بين لقطتين'},
  {verb:'gather',pattern:/(يجمع|تجتمع|دليل|أدلة|ادلة|برهان|استنتاج|معلومات|أصوات|اصوات)/,metaphor:'عناصر متفرقة تتجمع في استنتاج مركزي'},
  {verb:'dissolve',pattern:/(يختفي|تلاشي|ينحسر|ذوبان|نسيان)/,metaphor:'طبقات تذوب تدريجياً وتترك أثراً مقروءاً'},
  {verb:'reveal',pattern:/(يكشف|يظهر|حقيقة|معنى|نفهم|نرى)/,metaphor:'كشف تدريجي يرفع طبقة واحدة في الوقت المناسب'},
]
const MATERIAL = ['ورق','زجاج','معدن','حجر','حبر','ضوء','رمل','ماء','نسيج','طين','جذر','شجرة','بحر','نافذة','باب','طريق','مكتب','مدينة']
const ABSTRACT = ['عدالة','ذاكرة','صمت','حرية','تعليم','معرفة','أخلاق','ضمير','ثقة','هوية','مستقبل','تقييم','إنسان','تقنية','ذكاء','فكرة','سؤال']
const clean = (v: string) => String(v || '').replace(/\s+/g,' ').trim()

export function analyzeWorldSemantics(text: string, platform: SemanticPlatform = 'unknown'): WorldSemanticAnalysis {
  const normalized=clean(text)
  const words=normalized.split(/\s+/).filter(Boolean)
  const matches=RULES.map((r,index)=>({r,index,score:(normalized.match(r.pattern)?.length || 0)*(r.weight || 1)})).filter((x)=>x.score>0)
  const winner=matches.sort((a,b)=>b.score-a.score || a.index-b.index)[0]?.r || RULES[RULES.length-1]
  const hasContrast=/(بلا |لكن|بينما|مقابل|ليس |ليست |ضد|تناقض)/.test(normalized)
  const hasQuestion=/[؟?]|لماذا|كيف|ماذا|هل /.test(normalized)
  const hasTransformation=/(تحول|يتحول|يصبح|تصبح|تغيير|من .* إلى)/.test(normalized)
  const hasCausality=/(لأن|بسبب|لذلك|نتيجة|يؤدي|يقود إلى|حين|عندما)/.test(normalized)
  const tension=Math.min(1,(hasContrast?.28:0)+(hasQuestion?.12:0)+(/خطر|أزمة|صراع|بلا |فشل|صدع/.test(normalized)?.34:0)+(normalized.length>160?.12:0))
  const emotionalTone=[
    /صمت|هدوء|تأمل/.test(normalized)?'تأملي':'', /خطر|أزمة|صراع/.test(normalized)?'متوتر':'',
    /طفل|إنسان|عاطف|قلب|اشتاق|حنين|حب|قرب|بعد|مسافة|فقد/.test(normalized)?'إنساني':'', /دليل|بحث|تقييم|دراسة/.test(normalized)?'معرفي':'',
    /مستقبل|نهض|فرصة/.test(normalized)?'متطلع':'',
  ].filter(Boolean)
  const materialWords=MATERIAL.filter((w)=>normalized.includes(w))
  const abstractWords=ABSTRACT.filter((w)=>normalized.includes(w))
  const formality = /بحث|دراسة|نتائج|منهج|دليل|أكاديمي/.test(normalized) ? 'academic' : /سياسة|مؤسسة|تقرير|استراتيجية/.test(normalized) ? 'formal' : /شلون|أبي|مو |ليش/.test(normalized) ? 'informal' : 'balanced'
  const audience = /طالب|معلم|تعليم|مدرسة|طفل/.test(normalized) ? 'education' : /بحث|جامعة|دراسة/.test(normalized) ? 'academic' : /شركة|قياد|مؤسسة/.test(normalized) ? 'professional' : /شباب|جيل/.test(normalized) ? 'youth' : 'general'
  const density: SemanticDensity=words.length<=5?'minimal':words.length>=32?'dense':'balanced'
  const centralIdea=normalized.split(/[.!؟?\n]/).map(clean).filter(Boolean)[0] || normalized || 'فكرة بلا نص'
  const topic=(abstractWords[0] || materialWords[0] || words.slice(0,3).join(' ') || 'فكرة').slice(0,72)
  const reasons=[`الفعل «${winner.verb}» حصل على أقوى تطابق دلالي`,hasContrast?'النص يحتوي تضاداً صريحاً':'',hasQuestion?'النص يحتوي سؤالاً':'',hasTransformation?'النص يحتوي تحولاً':'',hasCausality?'النص يحتوي علاقة سببية':''].filter(Boolean)
  return {topic,centralIdea,emotionalTone:emotionalTone.length?emotionalTone:['متزن'],tension,hasContrast,hasQuestion,hasTransformation,hasCausality,materialWords,abstractWords,semanticMotionVerb:winner.verb,visualMetaphor:winner.metaphor,formality,audience,platform,density,confidence:Math.min(.98,.66+matches.length*.045),reasons}
}
