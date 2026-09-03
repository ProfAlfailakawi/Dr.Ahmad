/**
 * Design Worlds 2 — 64 master art-direction constitutions + backward-compatible legacy aliases.
 * Worlds are data consumed by the shared renderer; no renderer fork per world.
 */
import {
  type AccentStrategyId,
  type CompositionPlan,
  type ContentKind,
  type ContentTone,
  type FramingModeId,
  type LayoutFamilyId,
  type Palette,
  type PaletteId,
  type SocialDesignRequest,
  type SocialDesignResult,
  type SocialFormatId,
  type SpatialPatternId,
  type TypographyModeId,
  draftWorldPreview,
  generateSocialDesigns,
  reshapePlanSignature,
} from './social-design-engine'

export const DESIGN_WORLDS_VERSION = '2.0.0'

export type WorldFamilyId =
  | 'cosmic' | 'editorial' | 'organic' | 'architectural'
  | 'kuwait-gulf' | 'technology-data' | 'cinematic' | 'quiet-luxury'
  | 'typographic' | 'surreal' | 'human-emotional' | 'experimental'
  | 'academic-knowledge' | 'media-society' | 'education-childhood' | 'material-environment'
export type WorldEnergy = 'still' | 'balanced' | 'pulsing' | 'rising' | 'controlled-explosive'
export type WorldMaterial = 'paper' | 'glass' | 'metal' | 'stone' | 'ink' | 'light' | 'sand' | 'water' | 'textile' | 'clay'
export type WorldEra = 'heritage' | 'classic' | 'contemporary' | 'future' | 'timeless'
export type WorldDepth = 'flat' | 'layered' | 'perspective' | 'spatial' | 'cinematic'
export type WorldTemperature = 'cold' | 'neutral' | 'warm' | 'fiery'
export type WorldDensity = 'minimal' | 'balanced' | 'rich' | 'controlled-maximal'
export type WorldMotion = 'breathe' | 'grow' | 'connect' | 'split' | 'rise' | 'orbit' | 'weave' | 'reveal' | 'balance' | 'pulse'
export type WorldGeometry = 'circular' | 'axial' | 'grid' | 'organic' | 'architectural' | 'free'
export type WorldLighting = 'soft' | 'radial' | 'backlit' | 'side' | 'eclipse' | 'premium-neon'
export type WorldRhythm = 'contemplative' | 'editorial' | 'dialogic' | 'rising' | 'cinematic'
export type SemanticVerb =
  | 'root' | 'connect' | 'split' | 'rise' | 'weave' | 'orbit' | 'pulse' | 'path' | 'question' | 'balance'
  | 'reveal' | 'dissolve' | 'fracture' | 'gather' | 'protect' | 'liberate' | 'echo' | 'breathe' | 'transform' | 'confront'
export const POST_LAYOUT_ARCHETYPES = [
  'Poster Monument', 'Editorial Stack', 'Modular Brief', 'Infographic Argument', 'Split Contrast', 'Central Emblem',
  'Quote Architecture', 'Timeline Path', 'Data Narrative', 'Cinematic Frame', 'Typographic Field', 'Minimal Thesis',
] as const
export type PostLayoutArchetype = (typeof POST_LAYOUT_ARCHETYPES)[number]

export interface WorldPerformanceBudget { maxPreviewLayers: number; maxAnimatedParticles: number; prefersStaticPreview: boolean; textureBudget: 'low' | 'medium' }

export interface WorldConstitution {
  id: string
  labelAr: string
  labelEn: string
  family: WorldFamilyId
  familyLabel: string
  description: string
  philosophy: string
  emotionalTone: string[]
  semanticAffinity: SemanticVerb[]
  palettes: Palette[]
  typography: TypographyModeId
  layoutGrammar: PostLayoutArchetype[]
  spatialRules: string[]
  framingRules: string[]
  geometry: WorldGeometry[]
  materials: WorldMaterial[]
  textures: string[]
  lighting: WorldLighting[]
  depth: WorldDepth[]
  motifs: string[]
  metaphorBias: string[]
  motionDna: WorldMotion[]
  transitionDna: string[]
  logoBehavior: string
  soundDna: string[]
  densityRange: WorldDensity[]
  contrastRange: [number, number]
  compatibleWorlds: string[]
  incompatibleTraits: string[]
  accessibilityRules: string[]
  reelRules: string[]
  postRules: string[]
  performanceBudget: WorldPerformanceBudget
  signatureTokens: string[]
  /** Existing renderer compatibility surface. */
  label: string
  tagline: string
  essence: string
  reference: string
  palette: Palette
  layout: LayoutFamilyId
  spatial: SpatialPatternId
  accent: AccentStrategyId
  framing: FramingModeId
  idealKinds: ContentKind[]
  idealTones: ContentTone[]
  dos: string[]
  donts: string[]
  sampleIdea: string
  master: boolean
}
export type DesignWorld = WorldConstitution

type WorldSpec = {
  id: string; ar: string; en: string; family: WorldFamilyId; familyLabel: string; tagline: string; description: string
  colors: [string,string,string,string,string,string,string]; paletteId: PaletteId; layout: LayoutFamilyId; typography: TypographyModeId
  spatial: SpatialPatternId; accent: AccentStrategyId; framing: FramingModeId; post: PostLayoutArchetype
  semantic: SemanticVerb[]; material: WorldMaterial[]; motion: WorldMotion[]; geometry: WorldGeometry[]; lighting: WorldLighting[]; depth: WorldDepth[]
  mood: string[]; motifs: string[]; sample: string; era?: WorldEra; energy?: WorldEnergy; rhythm?: WorldRhythm
}

const F = {
  cosmic: '01 · كونية', editorial: '02 · تحريرية', organic: '03 · طبيعية وعضوية', architectural: '04 · معمارية',
  'kuwait-gulf': '05 · كويتية وخليجية معاصرة', 'technology-data': '06 · تقنية وبيانات', cinematic: '07 · سينمائية', 'quiet-luxury': '08 · فخامة هادئة',
  typographic: '09 · طباعية', surreal: '10 · سريالية', 'human-emotional': '11 · إنسانية وعاطفية', experimental: '12 · تجريبية',
  'academic-knowledge': '13 · أكاديمية ومعرفية', 'media-society': '14 · إعلام ومجتمع', 'education-childhood': '15 · تعليم وطفولة', 'material-environment': '16 · مادة وبيئة',
} satisfies Record<WorldFamilyId,string>

/* One compact record per world. The constitution factory supplies the shared rules. */
const WORLD_SPECS: WorldSpec[] = [
  {id:'copper-eclipse',ar:'كسوف نحاسي',en:'Copper Eclipse',family:'cosmic',familyLabel:F.cosmic,tagline:'كسوف نحاسي وهيبة معدنية.',description:'ظلال فحمية وهالات معدنية وحركة مدارية محسوبة.',colors:['#100E0D','#1B1714','#F4EBDD','#B8A99A','#B87333','#3A261B','#45382F'],paletteId:'graphite-gold',layout:'quiet-orbit',typography:'display-monumental',spatial:'centered-monument',accent:'soft-orbit',framing:'open-canvas',post:'Poster Monument',semantic:['orbit','reveal','confront'],material:['metal','light'],motion:['orbit','reveal'],geometry:['circular','axial'],lighting:['eclipse','radial'],depth:['cinematic','spatial'],mood:['مهيب','فاخر'],motifs:['كسوف','حلقة نحاس'],sample:'الفكرة التي تغيّر المدار لا تمر بلا أثر'},
  {id:'obsidian-orbit',ar:'مدار السبج',en:'Obsidian Orbit',family:'cosmic',familyLabel:F.cosmic,tagline:'سواد سبجي وأجسام معلّقة.',description:'مدارات دقيقة ونقاط ضوء بعيدة تعطي عمقاً سينمائياً بلا ضجيج.',colors:['#07090C','#11151B','#EDF2F7','#8E9AAA','#8AB4F8','#17243A','#26303B'],paletteId:'silicon-night',layout:'quiet-orbit',typography:'cinematic-title',spatial:'layered-depth',accent:'soft-orbit',framing:'cinematic-crop',post:'Cinematic Frame',semantic:['orbit','breathe','reveal'],material:['stone','light'],motion:['orbit','breathe'],geometry:['circular','free'],lighting:['backlit','soft'],depth:['cinematic'],mood:['غامض','عميق'],motifs:['مدارات','نقاط بعيدة'],sample:'حين يصبح الصمت أوسع من الإجابة'},
  {id:'nebula-manuscript',ar:'مخطوطة السديم',en:'Nebula Manuscript',family:'cosmic',familyLabel:F.cosmic,tagline:'حبر عربي يولد داخل سديم.',description:'حبر ضوئي وغبار كوني وطبقات زمنية تجعل النص مخطوطة حيّة.',colors:['#100D1D','#1A1430','#F5EEFF','#B4A9C7','#B792FF','#30204B','#43355D'],paletteId:'plum-lime',layout:'ink-veil',typography:'editorial-serif',spatial:'layered-depth',accent:'hero-keyword',framing:'floating-sheet',post:'Quote Architecture',semantic:['weave','echo','transform'],material:['ink','light'],motion:['weave','reveal'],geometry:['organic','free'],lighting:['radial','backlit'],depth:['layered','spatial'],mood:['شاعري','زمني'],motifs:['حبر ضوئي','غبار كوني'],sample:'الذاكرة تكتب نفسها قبل أن نقرأها'},
  {id:'lunar-glass',ar:'زجاج قمري',en:'Lunar Glass',family:'cosmic',familyLabel:F.cosmic,tagline:'شفافية باردة وفراغ شبه عديم الجاذبية.',description:'زجاج قمري وانعكاسات هادئة ومساحات واسعة تطفو داخلها الفكرة.',colors:['#EAF2F7','#F7FBFD','#17212B','#60717E','#A9D7EA','#D7ECF5','#BDD2DC'],paletteId:'scholar-blue',layout:'cinematic-window',typography:'studio-clean',spatial:'asymmetric-air',accent:'single-rule',framing:'hairline-inset',post:'Minimal Thesis',semantic:['breathe','reveal','question'],material:['glass','light'],motion:['breathe','reveal'],geometry:['grid','free'],lighting:['soft','side'],depth:['layered','spatial'],mood:['بارد','تأملي'],motifs:['زجاج','قمر'],sample:'ما الذي يظهر عندما نخفف كل ما لا يلزم؟'},

  {id:'indigo-archive',ar:'أرشيف نيلي',en:'Indigo Archive',family:'editorial',familyLabel:F.editorial,tagline:'بطاقات وهوامش وفهارس نيليّة.',description:'عمق ورقي راقٍ وترقيم تحريري يقود العين إلى الحجة.',colors:['#F3F1E9','#FFFEFA','#171B2A','#676A79','#293A78','#DDE1F1','#C8CAD1'],paletteId:'brand-paper',layout:'magazine-columns',typography:'academic-index',spatial:'right-rail',accent:'editorial-index',framing:'editorial-folio',post:'Editorial Stack',semantic:['gather','reveal','path'],material:['paper','ink'],motion:['reveal','connect'],geometry:['grid','axial'],lighting:['soft'],depth:['layered'],mood:['تحريري','رصين'],motifs:['فهرس','بطاقات'],sample:'كل هامش قد يخفي مفتاح الحجة'},
  {id:'black-margin',ar:'الهامش الأسود',en:'Black Margin',family:'editorial',familyLabel:F.editorial,tagline:'مساحات سلبية حادة وتحرير صارم.',description:'قصاصات نصية وهوامش سوداء تجعل الحذف جزءاً من الحجة.',colors:['#F5F4F0','#FFFFFF','#101010','#6F6D68','#111111','#E7E5DF','#CBC8BF'],paletteId:'ink-white',layout:'marginalia',typography:'editorial-serif',spatial:'right-rail',accent:'single-rule',framing:'editorial-folio',post:'Editorial Stack',semantic:['split','confront','reveal'],material:['paper','ink'],motion:['split','reveal'],geometry:['axial','grid'],lighting:['soft'],depth:['flat','layered'],mood:['صارم','فكري'],motifs:['هامش','قصاصة'],sample:'أحياناً يبدأ الوضوح من الجملة المحذوفة'},
  {id:'ivory-thesis',ar:'أطروحة عاجية',en:'Ivory Thesis',family:'editorial',familyLabel:F.editorial,tagline:'بنية أكاديمية فاخرة وهادئة.',description:'ورق عاجي وحواشٍ واستشهادات وتوازن معرفي بلا جفاف.',colors:['#F6F0E3','#FFFDF8','#27231C','#756C5D','#866A42','#EAE0CB','#D4C6AE'],paletteId:'warm-parchment',layout:'chapter-stack',typography:'academic-index',spatial:'modular-grid',accent:'editorial-index',framing:'editorial-folio',post:'Minimal Thesis',semantic:['gather','balance','reveal'],material:['paper','ink'],motion:['reveal','balance'],geometry:['grid','axial'],lighting:['soft'],depth:['flat','layered'],mood:['أكاديمي','هادئ'],motifs:['حاشية','استشهاد'],sample:'الدليل لا يرفع صوته كي يكون قوياً'},
  {id:'red-footnote',ar:'الحاشية الحمراء',en:'Red Footnote',family:'editorial',familyLabel:F.editorial,tagline:'إشارات حمراء تقود العين للحجة.',description:'أحمر مقتصد يربط الملاحظة بالدليل ويمنع العين من الضياع.',colors:['#F8F5EC','#FFFFFF','#201B18','#766B64','#B8322A','#F1D7D2','#D9CDC6'],paletteId:'museum-red',layout:'editorial-axis',typography:'academic-index',spatial:'right-rail',accent:'editorial-index',framing:'corner-marks',post:'Infographic Argument',semantic:['connect','path','confront'],material:['paper','ink'],motion:['connect','reveal'],geometry:['grid','axial'],lighting:['soft'],depth:['flat'],mood:['حجاجي','دقيق'],motifs:['حاشية حمراء','خط قيادة'],sample:'الملاحظة الصغيرة قد تغيّر قراءة النص كله'},

  {id:'emerald-atlas',ar:'أطلس زمردي',en:'Emerald Atlas',family:'organic',familyLabel:F.organic,tagline:'تضاريس فكرية ومسارات تنمو.',description:'خرائط زمردية وطبقات نباتية راقية تصوغ الفكرة كأرض قابلة للاكتشاف.',colors:['#0C1B17','#132820','#EDF7F1','#91AAA0','#5FC08B','#1E4938','#315A49'],paletteId:'emerald-sand',layout:'knowledge-map',typography:'rational-sans',spatial:'topographic-stack',accent:'data-marker',framing:'open-canvas',post:'Timeline Path',semantic:['root','path','root'],material:['paper','light'],motion:['grow','connect'],geometry:['organic','free'],lighting:['soft','radial'],depth:['layered','spatial'],mood:['عضوي','استكشافي'],motifs:['تضاريس','مسار'],sample:'كل فكرة أرض، والسؤال هو أول طريق'},
  {id:'root-cathedral',ar:'كاتدرائية الجذور',en:'Root Cathedral',family:'organic',familyLabel:F.organic,tagline:'جذور تصير أعمدة ونوراً رأسياً.',description:'النمو العضوي يتحول إلى عمارة مهيبة يمر فيها الضوء من الأعلى.',colors:['#171810','#25261B','#F0EDDA','#AAA78F','#8FA665','#354128','#49553A'],paletteId:'emerald-sand',layout:'type-poster',typography:'display-monumental',spatial:'centered-monument',accent:'hero-keyword',framing:'architectural-arch',post:'Poster Monument',semantic:['root','rise','transform'],material:['stone','light'],motion:['grow','rise'],geometry:['organic','architectural'],lighting:['backlit','side'],depth:['perspective','cinematic'],mood:['مهيب','نامٍ'],motifs:['جذور','أعمدة'],sample:'ما لا يملك جذراً لا يحتمل الارتفاع'},
  {id:'desert-bloom',ar:'إزهار الصحراء',en:'Desert Bloom',family:'organic',familyLabel:F.organic,tagline:'فكرة تنبت من فراغ صحراوي.',description:'رمل متحرك ونقطة ضوء أو زهرة تولد من الصمت من دون فولكلور.',colors:['#E9D9BC','#F5EADB','#2D251D','#83725E','#C77D3B','#E8CDA5','#CBB897'],paletteId:'saffron-shadow',layout:'human-note',typography:'editorial-serif',spatial:'low-horizon',accent:'hero-keyword',framing:'open-canvas',post:'Minimal Thesis',semantic:['root','reveal','breathe'],material:['sand','light'],motion:['grow','breathe'],geometry:['organic','free'],lighting:['side','soft'],depth:['perspective'],mood:['صامت','متفائل'],motifs:['أفق','نبتة'],sample:'من الفراغ تبدأ أحياناً أكثر الأفكار امتلاءً'},
  {id:'tidal-memory',ar:'ذاكرة المد',en:'Tidal Memory',family:'organic',familyLabel:F.organic,tagline:'موجات زمنية وأثر ماء.',description:'النص يظهر ثم ينحسر كذكرى تعود بصيغة مختلفة.',colors:['#081923','#102A36','#EAF6F7','#88A6AF','#4EB7C5','#173F4B','#2B5660'],paletteId:'majlis-teal',layout:'ink-veil',typography:'quotation-signature',spatial:'layered-depth',accent:'soft-orbit',framing:'full-bleed',post:'Quote Architecture',semantic:['echo','dissolve','breathe'],material:['water','ink'],motion:['breathe','reveal'],geometry:['organic','free'],lighting:['backlit','soft'],depth:['layered','cinematic'],mood:['حنين','مائي'],motifs:['موجة','حلقة زمنية'],sample:'الذاكرة لا تعود كما غادرت'},

  {id:'brutalist-minaret',ar:'مئذنة وحشية',en:'Brutalist Minaret',family:'architectural',familyLabel:F.architectural,tagline:'خرسانة وخط عربي رأسي.',description:'كتل قوية وصعود معماري وظلال حادة تعطي الفكرة سلطة بلا زينة.',colors:['#C9C7C1','#E2E0DB','#181817','#66645F','#4A4A47','#B2B0AA','#92908B'],paletteId:'quiet-stone',layout:'type-poster',typography:'display-monumental',spatial:'right-rail',accent:'single-rule',framing:'architectural-arch',post:'Poster Monument',semantic:['rise','confront','protect'],material:['stone'],motion:['rise','reveal'],geometry:['architectural','axial'],lighting:['side'],depth:['perspective','cinematic'],mood:['صلب','مهيب'],motifs:['كتلة','محور رأسي'],sample:'الفكرة التي تصمد لا تحتاج زخرفة'},
  {id:'porcelain-grid',ar:'شبكة خزفية',en:'Porcelain Grid',family:'architectural',familyLabel:F.architectural,tagline:'بياض خزفي ودقة سماوية.',description:'شبكة بيضاء ناعمة بلمسات أزرق سماوي وهندسة دقيقة.',colors:['#F4F8F8','#FFFFFF','#17252A','#667B82','#69B9D0','#DCEFF3','#C9DFE4'],paletteId:'scholar-blue',layout:'swiss-grid',typography:'studio-clean',spatial:'modular-grid',accent:'single-rule',framing:'hairline-inset',post:'Modular Brief',semantic:['balance','connect','reveal'],material:['glass','stone'],motion:['balance','connect'],geometry:['grid','axial'],lighting:['soft','side'],depth:['flat','layered'],mood:['نظيف','دقيق'],motifs:['بلاطة','شبكة'],sample:'الدقة مساحة لا ازدحام'},
  {id:'glass-courtyard',ar:'فناء زجاجي',en:'Glass Courtyard',family:'architectural',familyLabel:F.architectural,tagline:'انعكاسات عربية وطبقات شفافة.',description:'ضوء يتحرك عبر فناء شفاف وتنعكس فيه الكلمات من دون تشويه القراءة.',colors:['#E8F0EE','#F7FBFA','#14201E','#647571','#63AFA2','#D7EBE6','#BDD4CF'],paletteId:'majlis-teal',layout:'cinematic-window',typography:'rational-sans',spatial:'layered-depth',accent:'corner-signal',framing:'architectural-arch',post:'Cinematic Frame',semantic:['reveal','connect','breathe'],material:['glass','light'],motion:['reveal','breathe'],geometry:['architectural','grid'],lighting:['backlit','side'],depth:['spatial','perspective'],mood:['شفاف','معاصر'],motifs:['فناء','انعكاس'],sample:'حين يمر الضوء يصبح الفراغ جزءاً من الجملة'},
  {id:'stone-axis',ar:'المحور الحجري',en:'Stone Axis',family:'architectural',familyLabel:F.architectural,tagline:'نقش ومحور ثقيل وفتح بوابة.',description:'توازن حجري وحركة بطيئة تشبه فتح أثر لا تحريك واجهة.',colors:['#D9D0C2','#ECE5DA','#27231E','#746B61','#806B52','#CFC0AA','#B6A997'],paletteId:'quiet-stone',layout:'chapter-stack',typography:'editorial-serif',spatial:'centered-monument',accent:'quiet-seal',framing:'architectural-arch',post:'Central Emblem',semantic:['reveal','protect','confront'],material:['stone'],motion:['reveal','rise'],geometry:['axial','architectural'],lighting:['side','backlit'],depth:['perspective'],mood:['أثري','ثقيل'],motifs:['بوابة','نقش'],sample:'بعض المعاني لا تفتح إلا ببطء'},

  {id:'diwaniya-night',ar:'ليلة الديوانية',en:'Diwaniya Night',family:'kuwait-gulf',familyLabel:F['kuwait-gulf'],tagline:'حوار ليلي دافئ بلا فولكلور.',description:'ضوء دافئ وظلال بشرية ومسافات حوارية معاصرة تستلهم الديوانية لا تقلدها.',colors:['#15110F','#241B17','#F6EADB','#C7B39E','#D59A5C','#3A291F','#4B372C'],paletteId:'graphite-gold',layout:'human-note',typography:'conversational',spatial:'asymmetric-air',accent:'quiet-seal',framing:'open-canvas',post:'Quote Architecture',semantic:['connect','pulse','gather'],material:['textile','light'],motion:['connect','breathe'],geometry:['free','axial'],lighting:['soft','side'],depth:['layered'],mood:['دافئ','حواري'],motifs:['ظل بشري','مجلس معاصر'],sample:'المسافة القصيرة بين صوتين قد تغيّر فكرة كاملة'},
  {id:'sadu-signal',ar:'إشارة السدو',en:'Sadu Signal',family:'kuwait-gulf',familyLabel:F['kuwait-gulf'],tagline:'هندسة سدو تتحول إلى إشارات معاصرة.',description:'إيقاع نسيجي مُجرّد مستلهم من السدو دون نسخ زخرفي مباشر.',colors:['#160F10','#251718','#F8EFE8','#BDA9A0','#B5483F','#452427','#5F3031'],paletteId:'sadu-loom',layout:'sadu-weave',typography:'rational-sans',spatial:'diagonal-flow',accent:'contrast-band',framing:'corner-marks',post:'Typographic Field',semantic:['weave','connect','transform'],material:['textile'],motion:['weave','connect'],geometry:['grid','axial'],lighting:['soft'],depth:['flat','layered'],mood:['إيقاعي','هوياتي'],motifs:['نسيج مجرد','إشارة'],sample:'الهوية لا تتكرر؛ تعيد نسج نفسها'},
  {id:'pearl-diver',ar:'غواص اللؤلؤ',en:'Pearl Diver',family:'kuwait-gulf',familyLabel:F['kuwait-gulf'],tagline:'عمق بحري واكتشاف المعنى من الداخل.',description:'حبال ومسارات غوص ولؤلؤة ضوء واحدة تقود إلى جوهر الفكرة.',colors:['#061A20','#0E2B33','#EDF8F5','#8EABA9','#E4D7B0','#1E4850','#315D63'],paletteId:'majlis-teal',layout:'knowledge-map',typography:'cinematic-title',spatial:'low-horizon',accent:'hero-keyword',framing:'full-bleed',post:'Cinematic Frame',semantic:['path','reveal','gather'],material:['water','light'],motion:['reveal','rise'],geometry:['organic','free'],lighting:['radial','backlit'],depth:['cinematic','spatial'],mood:['بحري','اكتشافي'],motifs:['لؤلؤة','حبل غوص'],sample:'القيمة الحقيقية لا تطفو دائماً على السطح'},
  {id:'kuwait-modernism',ar:'حداثة الكويت',en:'Kuwait Modernism',family:'kuwait-gulf',familyLabel:F['kuwait-gulf'],tagline:'حداثة الستينيات والسبعينيات بروح اليوم.',description:'عمارة نظيفة وشمس قاسية وTypography معاصر يستلهم الكويت من دون نوستالجيا سطحية.',colors:['#E7DFC9','#F5F0E3','#20211E','#737165','#C5793B','#E1C7A8','#C5BBA4'],paletteId:'saffron-shadow',layout:'swiss-grid',typography:'display-monumental',spatial:'asymmetric-air',accent:'corner-signal',framing:'cinematic-crop',post:'Poster Monument',semantic:['rise','transform','confront'],material:['stone','light'],motion:['rise','reveal'],geometry:['architectural','grid'],lighting:['side'],depth:['perspective'],mood:['شمسي','حداثي'],motifs:['كتلة حديثة','شمس'],sample:'المستقبل يبدأ عندما تصبح المدينة فكرة'},

  {id:'quantum-ledger',ar:'السجل الكمي',en:'Quantum Ledger',family:'technology-data',familyLabel:F['technology-data'],tagline:'أرقام ومسارات تتحول إلى معنى.',description:'دفتر بيانات دقيق لا يشبه واجهات الكريبتو؛ الرقم يخدم الحجة.',colors:['#081118','#0E1D28','#EAF6FF','#8DA5B5','#5CC8E8','#16394A','#275264'],paletteId:'silicon-night',layout:'evidence-ledger',typography:'number-led',spatial:'modular-grid',accent:'data-marker',framing:'hairline-inset',post:'Data Narrative',semantic:['connect','gather','reveal'],material:['glass','light'],motion:['connect','reveal'],geometry:['grid','circular'],lighting:['premium-neon','soft'],depth:['layered'],mood:['تقني','دقيق'],motifs:['سجل','مسار بيانات'],sample:'الرقم يصبح معرفة حين يجد موقعه في القصة'},
  {id:'ethical-circuit',ar:'الدائرة الأخلاقية',en:'Ethical Circuit',family:'technology-data',familyLabel:F['technology-data'],tagline:'تقنية تتوقف عند نقاط أخلاقية.',description:'دوائر تقنية تُبطئ عند الإنسان وتعيد وزن الخوارزمية بالمسؤولية.',colors:['#101415','#192022','#F1F4F1','#9BA8A2','#77B89A','#23382F','#34483F'],paletteId:'emerald-sand',layout:'neural-constellation',typography:'rational-sans',spatial:'split-balance',accent:'data-marker',framing:'open-canvas',post:'Split Contrast',semantic:['balance','connect','protect'],material:['metal','light'],motion:['connect','balance'],geometry:['circular','grid'],lighting:['soft','backlit'],depth:['layered','spatial'],mood:['أخلاقي','متزن'],motifs:['دائرة','نقطة توقف'],sample:'الذكاء بلا ضمير لا يعرف متى يتوقف'},
  {id:'cyan-protocol',ar:'البروتوكول السماوي',en:'Cyan Protocol',family:'technology-data',familyLabel:F['technology-data'],tagline:'Grid ديناميكي يعيد ترتيب المعلومات.',description:'معلومات تتجمع ثم تعيد تنظيم نفسها في بروتوكول بصري واضح.',colors:['#07161B','#0C252D','#EBFAFD','#82ADB8','#38C7E6','#123D49','#225663'],paletteId:'electric-cobalt',layout:'modular-brief',typography:'studio-clean',spatial:'modular-grid',accent:'corner-signal',framing:'corner-marks',post:'Modular Brief',semantic:['gather','connect','transform'],material:['glass','light'],motion:['connect','reveal'],geometry:['grid'],lighting:['premium-neon'],depth:['flat','layered'],mood:['بروتوكولي','سريع'],motifs:['شبكة','وحدة بيانات'],sample:'النظام الجيد يجعل التعقيد قابلاً للرؤية'},
  {id:'neural-mosaic',ar:'الفسيفساء العصبية',en:'Neural Mosaic',family:'technology-data',familyLabel:F['technology-data'],tagline:'شبكة عصبية تتحول إلى فسيفساء إنسانية.',description:'اتصال عضوي بين البيانات والإنسان يبتعد عن أيقونة الدماغ التقليدية.',colors:['#15101D','#251831','#F7EEFA','#B8A0C1','#D27CA8','#3C2544','#51365A'],paletteId:'plum-lime',layout:'neural-constellation',typography:'rational-sans',spatial:'layered-depth',accent:'soft-orbit',framing:'open-canvas',post:'Central Emblem',semantic:['connect','transform','gather'],material:['glass','light'],motion:['connect','weave'],geometry:['organic','grid'],lighting:['radial','soft'],depth:['spatial'],mood:['إنساني','تقني'],motifs:['فسيفساء','عقد اتصال'],sample:'حين تتصل البيانات بالإنسان يصبح النمط قصة'},

  {id:'noir-beacon',ar:'منارة نوار',en:'Noir Beacon',family:'cinematic',familyLabel:F.cinematic,tagline:'شعاع واحد يكشف الفكرة.',description:'ظلام سينمائي وContrast مرتفع وحركة كشف محسوبة.',colors:['#080808','#121212','#F3F1EA','#AAA7A0','#E7D9A8','#28251F','#393630'],paletteId:'brand-night',layout:'cinematic-window',typography:'cinematic-title',spatial:'low-horizon',accent:'single-rule',framing:'cinematic-crop',post:'Cinematic Frame',semantic:['reveal','confront','question'],material:['light','ink'],motion:['reveal','breathe'],geometry:['axial','free'],lighting:['radial','side'],depth:['cinematic'],mood:['درامي','مركز'],motifs:['شعاع','منارة'],sample:'حين ينطفئ كل شيء يظهر ما يستحق أن يُرى'},
  {id:'desert-signal',ar:'إشارة الصحراء',en:'Desert Signal',family:'cinematic',familyLabel:F.cinematic,tagline:'أفق صحراوي وإشارة بعيدة تقترب.',description:'Grain سينمائي وحرارة وضوء متدرج يقتربان من الحجة.',colors:['#25180F','#3A281A','#F6E8D4','#C7A98B','#E3A053','#543623','#69452D'],paletteId:'saffron-shadow',layout:'cinematic-window',typography:'cinematic-title',spatial:'low-horizon',accent:'corner-signal',framing:'full-bleed',post:'Cinematic Frame',semantic:['path','rise','reveal'],material:['sand','light'],motion:['rise','reveal'],geometry:['axial','free'],lighting:['side','backlit'],depth:['cinematic','perspective'],mood:['حار','ترقبي'],motifs:['أفق','إشارة بعيدة'],sample:'كل إشارة بعيدة تبدأ كنقطة لا يراها الجميع'},
  {id:'coral-future',ar:'المستقبل المرجاني',en:'Coral Future',family:'cinematic',familyLabel:F.cinematic,tagline:'طاقة إنسانية لا تقنية باردة.',description:'مرجاني مع أزرق عميق يضع الإنسان في قلب المستقبل.',colors:['#0A1A26','#102A3B','#F6F2ED','#A4AFB8','#EF725D','#3E2B32','#294A5B'],paletteId:'electric-cobalt',layout:'hero-word',typography:'display-monumental',spatial:'asymmetric-air',accent:'hero-keyword',framing:'open-canvas',post:'Poster Monument',semantic:['transform','rise','pulse'],material:['light','water'],motion:['pulse','rise'],geometry:['organic','free'],lighting:['radial','premium-neon'],depth:['layered','cinematic'],mood:['إنساني','مستقبلي'],motifs:['مرجان','موجة ضوء'],sample:'المستقبل الأجمل لا ينسى من صُمم من أجله'},
  {id:'blue-hour',ar:'الساعة الزرقاء',en:'Blue Hour',family:'cinematic',familyLabel:F.cinematic,tagline:'ما قبل الليل: هدوء وشاعرية.',description:'مدينة أو أفق في ضوء أزرق عاطفي بانتقالات بطيئة.',colors:['#111B30','#1C2942','#EFF3FA','#9EABC3','#7198D8','#263A5D','#3D5275'],paletteId:'scholar-blue',layout:'cinematic-window',typography:'quotation-signature',spatial:'low-horizon',accent:'soft-orbit',framing:'cinematic-crop',post:'Quote Architecture',semantic:['breathe','echo','reveal'],material:['light','glass'],motion:['breathe','reveal'],geometry:['free','axial'],lighting:['soft','backlit'],depth:['cinematic'],mood:['شاعري','هادئ'],motifs:['أفق','نافذة ضوء'],sample:'هناك لحظة بين الوضوح والعتمة تولد فيها الأسئلة'},

  {id:'silent-gold',ar:'ذهب صامت',en:'Silent Gold',family:'quiet-luxury',familyLabel:F['quiet-luxury'],tagline:'ذهب مقتصد وأسود مطفأ.',description:'حركة بطيئة جداً ولمعان محسوب؛ الفخامة من الاقتصاد لا من البريق.',colors:['#11100E','#1A1814','#F6F0E5','#B8AD9B','#C9A663','#332A1C','#463B2B'],paletteId:'graphite-gold',layout:'quote-stage',typography:'quotation-signature',spatial:'centered-monument',accent:'quiet-seal',framing:'hairline-inset',post:'Quote Architecture',semantic:['breathe','reveal','protect'],material:['metal','ink'],motion:['breathe','reveal'],geometry:['axial','free'],lighting:['side','soft'],depth:['layered'],mood:['فاخر','صامت'],motifs:['خط ذهب','ختم'],sample:'الفخامة أن يبقى ما يلزم فقط'},
  {id:'ivory-air',ar:'هواء عاجي',en:'Ivory Air',family:'quiet-luxury',familyLabel:F['quiet-luxury'],tagline:'مساحات تنفّس وكلمة مركزية.',description:'عاجي واسع وحركة بالكاد تُرى لكنها محسوسة.',colors:['#F8F4EA','#FFFDF8','#29261F','#7E7566','#9B8258','#EEE5D4','#D8CEBC'],paletteId:'warm-parchment',layout:'hero-word',typography:'display-monumental',spatial:'asymmetric-air',accent:'none',framing:'open-canvas',post:'Minimal Thesis',semantic:['breathe','reveal','question'],material:['paper','light'],motion:['breathe','reveal'],geometry:['free','axial'],lighting:['soft'],depth:['flat','layered'],mood:['هادئ','نقي'],motifs:['فراغ','كلمة واحدة'],sample:'الصمت ليس غياباً؛ أحياناً هو المساحة التي يفهم فيها المعنى'},
  {id:'midnight-ink',ar:'حبر منتصف الليل',en:'Midnight Ink',family:'quiet-luxury',familyLabel:F['quiet-luxury'],tagline:'حبر داكن يتحول إلى بناء بصري.',description:'انتشار الحبر يقود إلى Typography عربي فاخر ومقروء.',colors:['#0D1115','#171D23','#F3F1EA','#A5A8AA','#8FA6B7','#24313B','#35434C'],paletteId:'brand-night',layout:'ink-veil',typography:'editorial-serif',spatial:'layered-depth',accent:'hero-keyword',framing:'floating-sheet',post:'Typographic Field',semantic:['dissolve','transform','reveal'],material:['ink'],motion:['reveal','breathe'],geometry:['organic','free'],lighting:['side'],depth:['layered'],mood:['حبري','فاخر'],motifs:['انتشار حبر','طبقة'],sample:'تتسع الفكرة كما يتسع الحبر في الورق'},
  {id:'platinum-whisper',ar:'همس بلاتيني',en:'Platinum Whisper',family:'quiet-luxury',familyLabel:F['quiet-luxury'],tagline:'فضي خافت ودقة مؤسسية غير نمطية.',description:'طبقات شفافة وفضي منخفض اللمعان تمنح المؤسسة حضوراً لا برودة.',colors:['#ECEFF1','#FAFBFC','#1E2529','#727D82','#99A6AD','#DCE2E5','#C8D0D4'],paletteId:'quiet-stone',layout:'modular-brief',typography:'studio-clean',spatial:'modular-grid',accent:'single-rule',framing:'hairline-inset',post:'Modular Brief',semantic:['balance','reveal','protect'],material:['metal','glass'],motion:['breathe','balance'],geometry:['grid','axial'],lighting:['soft','side'],depth:['layered'],mood:['مؤسسي','فاخر'],motifs:['فضة مطفأة','طبقة شفافة'],sample:'الدقة يمكن أن تكون هادئة ومختلفة في الوقت نفسه'},

  {id:'word-monument',ar:'نُصب الكلمة',en:'Word Monument',family:'typographic',familyLabel:F.typographic,tagline:'الكلمة تصبح عمارة ثلاثية الأبعاد.',description:'Typography هو الجسم الرئيسي؛ الوزن والظل يخلقان النصب دون التضحية بالقراءة.',colors:['#EAE7DF','#F7F5F0','#1B1A18','#6F6C66','#41413D','#D8D3C8','#BCB7AD'],paletteId:'ink-white',layout:'type-poster',typography:'display-monumental',spatial:'centered-monument',accent:'hero-keyword',framing:'open-canvas',post:'Poster Monument',semantic:['rise','confront','transform'],material:['stone','ink'],motion:['rise','reveal'],geometry:['architectural','axial'],lighting:['side'],depth:['perspective','spatial'],mood:['نصّي','مهيب'],motifs:['حرف ككتلة','ظل'],sample:'الكلمة حين تثقل بالمعنى تصبح مكاناً'},
  {id:'kinetic-calligraphy',ar:'الخط الحركي',en:'Kinetic Calligraphy',family:'typographic',familyLabel:F.typographic,tagline:'الحروف تتكوّن بحسب المعنى.',description:'تمدد واتصال عربي يحافظ على القراءة ويمنع اللعب الشكلي.',colors:['#F3EFE6','#FFFDF8','#1E1B18','#776F65','#3C6D73','#D9E4E2','#CFC7BB'],paletteId:'brand-paper',layout:'ink-veil',typography:'quotation-signature',spatial:'diagonal-flow',accent:'hero-keyword',framing:'open-canvas',post:'Typographic Field',semantic:['weave','connect','transform'],material:['ink'],motion:['weave','connect'],geometry:['organic','free'],lighting:['soft'],depth:['flat','layered'],mood:['حركي','خطّي'],motifs:['امتداد حرف','صلة'],sample:'حين تتصل الحروف يتغير إيقاع الفكرة'},
  {id:'split-sentence',ar:'الجملة المنقسمة',en:'Split Sentence',family:'typographic',familyLabel:F.typographic,tagline:'التناقض يقسم الجملة ثم يعيد تركيبها.',description:'التكوين ينفصل عند التضاد ويلتئم عند الخلاصة.',colors:['#F4F3EF','#FFFFFF','#171717','#74716B','#D45A42','#F1DCD6','#D7D3CB'],paletteId:'museum-red',layout:'dual-thesis',typography:'display-monumental',spatial:'split-balance',accent:'contrast-band',framing:'corner-marks',post:'Split Contrast',semantic:['split','confront','transform'],material:['paper','ink'],motion:['split','balance'],geometry:['axial','grid'],lighting:['soft'],depth:['flat'],mood:['جدلي','حاد'],motifs:['شق','نصفان'],sample:'لسنا أمام خيارين؛ أحياناً الخلاصة هي طريقة جمعهما'},
  {id:'echo-type',ar:'صدى الحروف',en:'Echo Type',family:'typographic',familyLabel:F.typographic,tagline:'أصداء طباعية للذاكرة والأثر.',description:'الكلمة تترك نسخاً محسوبة خلفها توحي بالاستمرار دون تشويش.',colors:['#10141C','#1B2230','#F4F6FA','#9BA8BC','#778DCE','#283755','#3B4A67'],paletteId:'silicon-night',layout:'hero-word',typography:'display-monumental',spatial:'layered-depth',accent:'hero-keyword',framing:'open-canvas',post:'Typographic Field',semantic:['echo','pulse','dissolve'],material:['ink','light'],motion:['pulse','reveal'],geometry:['free','axial'],lighting:['backlit','soft'],depth:['layered'],mood:['ذاكري','إيقاعي'],motifs:['صدى نصي','ظل حرف'],sample:'الأثر يواصل الكلام بعد انتهاء الجملة'},

  {id:'floating-door',ar:'الباب العائم',en:'Floating Door',family:'surreal',familyLabel:F.surreal,tagline:'باب يفتح معنى داخل معنى.',description:'انتقال بين طبقتين داخل المشهد من خلال بوابة لا رمز مباشر.',colors:['#111722','#1A2637','#F3F3EE','#A3A9B0','#D0A66B','#32455B','#455A70'],paletteId:'brand-night',layout:'cinematic-window',typography:'cinematic-title',spatial:'layered-depth',accent:'corner-signal',framing:'architectural-arch',post:'Cinematic Frame',semantic:['reveal','question','transform'],material:['paper','light'],motion:['reveal','rise'],geometry:['architectural','free'],lighting:['backlit'],depth:['cinematic','spatial'],mood:['سريالي','اكتشافي'],motifs:['باب','عالم خلفي'],sample:'السؤال الحقيقي لا يعطيك جواباً؛ يفتح باباً آخر'},
  {id:'time-orchard',ar:'بستان الزمن',en:'Time Orchard',family:'surreal',familyLabel:F.surreal,tagline:'أشجار تحمل الوقت والذكريات.',description:'نمو زمني تتحول فيه الثمار إلى كلمات بلا رمز ساعة مبتذل.',colors:['#172116','#273426','#F2F1DF','#ADB099','#C9A467','#41553D','#56694F'],paletteId:'emerald-sand',layout:'knowledge-map',typography:'editorial-serif',spatial:'topographic-stack',accent:'quiet-seal',framing:'open-canvas',post:'Timeline Path',semantic:['root','echo','transform'],material:['paper','light'],motion:['grow','reveal'],geometry:['organic'],lighting:['soft','radial'],depth:['layered','spatial'],mood:['حلمي','زمني'],motifs:['شجرة زمن','ثمرة كلمة'],sample:'الوقت لا يمر فقط؛ يثمر أحياناً'},
  {id:'mirror-desert',ar:'صحراء المرآة',en:'Mirror Desert',family:'surreal',familyLabel:F.surreal,tagline:'مرآة تكشف طبقة غير متوقعة.',description:'فراغ صحراوي وانعكاس واحد يقلب معنى المشهد.',colors:['#D9C7A7','#EDE1CB','#24211D','#776D5E','#8CB8C3','#C9DEE1','#B8A789'],paletteId:'saffron-shadow',layout:'cinematic-window',typography:'quotation-signature',spatial:'low-horizon',accent:'hero-keyword',framing:'full-bleed',post:'Cinematic Frame',semantic:['reveal','confront','question'],material:['sand','glass'],motion:['reveal','balance'],geometry:['free','axial'],lighting:['side','radial'],depth:['cinematic','perspective'],mood:['سريالي','صامت'],motifs:['مرآة','أفق'],sample:'ما تراه في الخارج قد يكون سؤالاً عن الداخل'},
  {id:'gravity-thread',ar:'خيط الجاذبية',en:'Gravity Thread',family:'surreal',familyLabel:F.surreal,tagline:'خيط يربط العناصر ضد الجاذبية.',description:'علاقة مرئية واحدة تجمع عناصر متباعدة حتى تتشكل الحجة.',colors:['#111112','#1E1E20','#F5F2EB','#A9A5A0','#D9746B','#3A2526','#4A3938'],paletteId:'museum-red',layout:'knowledge-map',typography:'rational-sans',spatial:'diagonal-flow',accent:'single-rule',framing:'open-canvas',post:'Timeline Path',semantic:['connect','weave','gather'],material:['textile','light'],motion:['weave','connect'],geometry:['free','organic'],lighting:['soft'],depth:['spatial'],mood:['غرائبي','مترابط'],motifs:['خيط','عقدة'],sample:'الحجة القوية تعرف كيف تربط ما يبدو بعيداً'},

  {id:'pulse-room',ar:'غرفة النبض',en:'Pulse Room',family:'human-emotional',familyLabel:F['human-emotional'],tagline:'غرفة تتنفس مع الإحساس.',description:'حركة تنفّس ونبض هادئة تجعل الفراغ إنسانياً دون قلوب كرتونية.',colors:['#201617','#302123','#F8EEEE','#C4AAAA','#D88482','#4A2D30','#624043'],paletteId:'plum-lime',layout:'human-note',typography:'conversational',spatial:'centered-monument',accent:'soft-orbit',framing:'open-canvas',post:'Quote Architecture',semantic:['pulse','breathe','protect'],material:['textile','light'],motion:['pulse','breathe'],geometry:['organic','free'],lighting:['soft','radial'],depth:['layered'],mood:['حميمي','إنساني'],motifs:['تنفس جدار','نبضة ضوء'],sample:'هناك أشياء نفهمها بإيقاعها قبل كلماتها'},
  {id:'memory-window',ar:'نافذة الذاكرة',en:'Memory Window',family:'human-emotional',familyLabel:F['human-emotional'],tagline:'طبقات ذاكرة وضوء وغبار.',description:'نافذة تفتح زمناً فوق زمن بتلاشي محسوب.',colors:['#2A241D','#3A3329','#F5ECDD','#B9AA98','#D8BC86','#514532','#665742'],paletteId:'warm-parchment',layout:'cinematic-window',typography:'quotation-signature',spatial:'layered-depth',accent:'paper-note',framing:'floating-sheet',post:'Cinematic Frame',semantic:['echo','dissolve','reveal'],material:['paper','light'],motion:['reveal','breathe'],geometry:['architectural','free'],lighting:['backlit','side'],depth:['cinematic','layered'],mood:['حنين','دافئ'],motifs:['نافذة','غبار ضوء'],sample:'الذاكرة نافذة لا تفتح على المشهد نفسه مرتين'},
  {id:'unsaid-letter',ar:'الرسالة المسكوت عنها',en:'Unsaid Letter',family:'human-emotional',familyLabel:F['human-emotional'],tagline:'الفراغات تقول ما لم يُكتب.',description:'رسالة ناقصة تتكون من الصمت والبياض أكثر من الزخرفة.',colors:['#F4EFE7','#FFFDF9','#28231E','#7A7066','#9F725A','#E9DCD2','#D4C7BC'],paletteId:'warm-parchment',layout:'human-note',typography:'editorial-serif',spatial:'asymmetric-air',accent:'paper-note',framing:'floating-sheet',post:'Quote Architecture',semantic:['breathe','dissolve','echo'],material:['paper','ink'],motion:['breathe','reveal'],geometry:['free'],lighting:['soft'],depth:['flat','layered'],mood:['حساس','صامت'],motifs:['رسالة ناقصة','سطر فارغ'],sample:'أحياناً أكثر ما يوجع هو السطر الذي لم يُكتب'},
  {id:'warm-distance',ar:'المسافة الدافئة',en:'Warm Distance',family:'human-emotional',familyLabel:F['human-emotional'],tagline:'المسافة بين شخصين تصبح ضوءاً.',description:'خطوط ضوء أو جسور أو انقطاع بصري تمثل العلاقة من دون صور مباشرة.',colors:['#1B1512','#2A211C','#F6EADF','#BFAE9D','#E09A67','#432C22','#573A2D'],paletteId:'graphite-gold',layout:'dual-thesis',typography:'conversational',spatial:'split-balance',accent:'single-rule',framing:'open-canvas',post:'Split Contrast',semantic:['connect','split','protect'],material:['light'],motion:['connect','balance'],geometry:['axial','free'],lighting:['soft','backlit'],depth:['layered'],mood:['عاطفي','حواري'],motifs:['جسر ضوء','مسافة'],sample:'القرب ليس عدداً من الخطوات بل جودة الجسر بيننا'},

  {id:'chromatic-rift',ar:'الشق اللوني',en:'Chromatic Rift',family:'experimental',familyLabel:F.experimental,tagline:'شق يكشف العلاقة بين فكرتين.',description:'لون يفصل ثم يكشف دون أن يصبح استعراضاً لونيّاً.',colors:['#111018','#1D1B29','#F7F4F4','#AAA3B1','#E15B74','#39294B','#4B3B5E'],paletteId:'plum-lime',layout:'dual-thesis',typography:'display-monumental',spatial:'split-balance',accent:'contrast-band',framing:'full-bleed',post:'Split Contrast',semantic:['split','fracture','reveal'],material:['light','glass'],motion:['split','reveal'],geometry:['free','axial'],lighting:['premium-neon','side'],depth:['layered','spatial'],mood:['تجريبي','حاد'],motifs:['شق','طبقتان'],sample:'أحياناً يظهر الرابط لحظة الانقسام'},
  {id:'liquid-geometry',ar:'الهندسة السائلة',en:'Liquid Geometry',family:'experimental',familyLabel:F.experimental,tagline:'هندسة تتغير بقوة الكلمات.',description:'أشكال سائلة تتبدل مع شدة المعنى من دون تشويه النص.',colors:['#081C1D','#123032','#EFF8F5','#9FB6B0','#5EC9B0','#1F4A45','#315D57'],paletteId:'majlis-teal',layout:'silicon-arabesque',typography:'rational-sans',spatial:'layered-depth',accent:'soft-orbit',framing:'open-canvas',post:'Central Emblem',semantic:['transform','balance','breathe'],material:['water','glass'],motion:['breathe','balance'],geometry:['organic','circular'],lighting:['radial','premium-neon'],depth:['spatial'],mood:['سائل','تجريبي'],motifs:['سائل هندسي','حافة مرنة'],sample:'حين تتغير قوة الكلمة يتغير شكل المساحة حولها'},
  {id:'paper-machine',ar:'آلة الورق',en:'Paper Machine',family:'experimental',familyLabel:F.experimental,tagline:'قصاصات تتحول إلى آلة فكرية.',description:'الورق يتجمع كخريطة أو بنية عملية بدل collage عشوائي.',colors:['#EEE8DB','#FCFAF4','#292520','#766D62','#C66A43','#E7D2C7','#CDC1B1'],paletteId:'brand-paper',layout:'modular-brief',typography:'academic-index',spatial:'modular-grid',accent:'paper-note',framing:'floating-sheet',post:'Modular Brief',semantic:['gather','connect','transform'],material:['paper'],motion:['connect','weave'],geometry:['grid','free'],lighting:['soft'],depth:['layered'],mood:['تركيبي','مادي'],motifs:['قصاصة','مفصل'],sample:'حين تنتظم القصاصات تصبح الفكرة آلة تعمل'},
  {id:'infinite-cut',ar:'القطع اللانهائي',en:'Infinite Cut',family:'experimental',familyLabel:F.experimental,tagline:'مشهد داخل مشهد بZoom متصل.',description:'عمق متكرر ومحسوب لا يستخدم Zoom مبالغاً أو دواراً.',colors:['#10151D','#182331','#F2F5FA','#9EA9B9','#7E9ED7','#263A55','#3B506A'],paletteId:'silicon-night',layout:'cinematic-window',typography:'cinematic-title',spatial:'layered-depth',accent:'corner-signal',framing:'cinematic-crop',post:'Cinematic Frame',semantic:['reveal','path','transform'],material:['glass','light'],motion:['reveal','rise'],geometry:['architectural','free'],lighting:['backlit'],depth:['cinematic','spatial'],mood:['غامر','متصل'],motifs:['إطار داخل إطار','عمق'],sample:'كل إجابة قد تكون إطاراً لسؤال أعمق'},

  {id:'cognitive-atlas',ar:'أطلس معرفي',en:'Cognitive Atlas',family:'academic-knowledge',familyLabel:F['academic-knowledge'],tagline:'خريطة للحجة والمفاهيم لا Brain Icon.',description:'روابط وطبقات معرفية تحول التفكير إلى تضاريس قابلة للقراءة.',colors:['#ECF0EA','#FAFCF8','#17231C','#68766D','#4F8C70','#D8E5DD','#C2D0C7'],paletteId:'emerald-sand',layout:'knowledge-map',typography:'academic-index',spatial:'topographic-stack',accent:'data-marker',framing:'editorial-folio',post:'Infographic Argument',semantic:['connect','path','gather'],material:['paper','ink'],motion:['connect','reveal'],geometry:['organic','grid'],lighting:['soft'],depth:['layered'],mood:['معرفي','تحليلي'],motifs:['مفهوم','مسار حجة'],sample:'الفكرة الواضحة تعرف أين تقف داخل خريطة المفاهيم'},
  {id:'evidence-chamber',ar:'غرفة الأدلة',en:'Evidence Chamber',family:'academic-knowledge',familyLabel:F['academic-knowledge'],tagline:'كل معلومة تضيء جزءاً من الاستنتاج.',description:'الأدلة تظهر بالتتابع حتى يتضح الحكم المركزي.',colors:['#101820','#192630','#EFF5F7','#9AADB5','#69AFC5','#264450','#385866'],paletteId:'scholar-blue',layout:'evidence-ledger',typography:'number-led',spatial:'modular-grid',accent:'data-marker',framing:'hairline-inset',post:'Data Narrative',semantic:['gather','reveal','balance'],material:['glass','paper'],motion:['reveal','connect'],geometry:['grid','axial'],lighting:['radial','soft'],depth:['layered'],mood:['دليلي','دقيق'],motifs:['لوحة دليل','استنتاج'],sample:'الدليل الجيد لا يزين النتيجة؛ يبنيها'},
  {id:'socratic-light',ar:'ضوء سقراطي',en:'Socratic Light',family:'academic-knowledge',familyLabel:F['academic-knowledge'],tagline:'سؤال يولّد سؤالاً ومساحة تفكير.',description:'دوائر ناقصة وفراغات سالبة تفتح التفكير بلا علامة استفهام عملاقة.',colors:['#F5F3EA','#FFFDF7','#26251F','#747167','#9A8B5C','#E8E2CB','#D1CAB6'],paletteId:'warm-parchment',layout:'quiet-orbit',typography:'editorial-serif',spatial:'asymmetric-air',accent:'soft-orbit',framing:'open-canvas',post:'Minimal Thesis',semantic:['question','reveal','breathe'],material:['light','paper'],motion:['breathe','reveal'],geometry:['circular','free'],lighting:['radial','soft'],depth:['layered'],mood:['تأملي','سؤالي'],motifs:['دائرة ناقصة','فراغ'],sample:'السؤال الجيد لا يغلق الدائرة'},
  {id:'footnote-laboratory',ar:'مختبر الحواشي',en:'Footnote Laboratory',family:'academic-knowledge',familyLabel:F['academic-knowledge'],tagline:'ملاحظات ومقارنات تنتهي بنتيجة مركزية.',description:'مختبر تحريري يجمع الهوامش ويختبرها حتى لا تبقى معلومة بلا وظيفة.',colors:['#F2F4F1','#FFFFFF','#1C2320','#6B7770','#4B7E78','#D7E6E2','#C3CFCA'],paletteId:'quiet-stone',layout:'marginalia',typography:'academic-index',spatial:'right-rail',accent:'editorial-index',framing:'editorial-folio',post:'Infographic Argument',semantic:['gather','connect','reveal'],material:['paper','glass'],motion:['connect','reveal'],geometry:['grid'],lighting:['soft'],depth:['flat','layered'],mood:['مختبري','أكاديمي'],motifs:['حاشية','مقارنة'],sample:'الملاحظة لا تستحق مكانها إلا إذا غيرت الاستنتاج'},

  {id:'signal-room',ar:'غرفة الإشارة',en:'Signal Room',family:'media-society',familyLabel:F['media-society'],tagline:'الضجيج يدخل والمعنى يخرج صافياً.',description:'إشارات متنافسة تُصفّى بصرياً حتى تبقى المعلومة التي تستحق الانتباه.',colors:['#111820','#1B2731','#F1F5F7','#9DABB3','#5DA9C9','#274351','#395766'],paletteId:'scholar-blue',layout:'evidence-ledger',typography:'rational-sans',spatial:'modular-grid',accent:'data-marker',framing:'corner-marks',post:'Data Narrative',semantic:['gather','reveal','confront'],material:['glass','light'],motion:['connect','reveal'],geometry:['grid','axial'],lighting:['premium-neon','soft'],depth:['layered'],mood:['إعلامي','تحليلي'],motifs:['إشارة','مرشح'],sample:'ليست كل إشارة خبراً، وليست كل ضوضاء معنى'},
  {id:'siren-map',ar:'خريطة الإنذار',en:'Siren Map',family:'media-society',familyLabel:F['media-society'],tagline:'موجات أزمة حمراء مضبوطة.',description:'نقطة أزمة وموجات انتشار تستخدم الأحمر كإنذار لا كخلفية صاخبة.',colors:['#161414','#241E1E','#F7F2EF','#AEA2A0','#C94B45','#472827','#5C3734'],paletteId:'museum-red',layout:'knowledge-map',typography:'number-led',spatial:'topographic-stack',accent:'data-marker',framing:'full-bleed',post:'Infographic Argument',semantic:['confront','pulse','path'],material:['light','paper'],motion:['pulse','reveal'],geometry:['circular','grid'],lighting:['radial'],depth:['layered'],mood:['إنذاري','مضبوط'],motifs:['موجة إنذار','نقطة أزمة'],sample:'الأزمة لا تبدأ حين نسمع الضجيج؛ تبدأ حين تنتشر الإشارة'},
  {id:'faultline-desk',ar:'مكتب الصدع',en:'Faultline Desk',family:'media-society',familyLabel:F['media-society'],tagline:'تحرير فوق صدع بصري.',description:'سطح تحريري منقسم يعبّر عن الاستقطاب ثم يبحث عن بنية للفهم.',colors:['#EAE8E1','#F8F7F2','#1E1D1A','#716F68','#A75445','#E4D2CD','#C8C4BB'],paletteId:'museum-red',layout:'dual-thesis',typography:'editorial-serif',spatial:'split-balance',accent:'contrast-band',framing:'editorial-folio',post:'Split Contrast',semantic:['split','fracture','confront'],material:['paper','stone'],motion:['split','balance'],geometry:['axial','grid'],lighting:['side'],depth:['layered'],mood:['مجتمعي','جدلي'],motifs:['صدع','مكتب'],sample:'الانقسام يصبح أخطر حين نتوقف عن رؤية المسافة بين الطرفين'},
  {id:'public-square',ar:'الساحة العامة',en:'Public Square',family:'media-society',familyLabel:F['media-society'],tagline:'أصوات متعددة تصنع صورة مشتركة.',description:'كثافات صوتية متباينة تتجمع في جملة واحدة من دون تسطيح الاختلاف.',colors:['#F1EFE8','#FFFFFF','#22211E','#727069','#437E84','#D8E8E7','#C5D1CF'],paletteId:'brand-paper',layout:'modular-brief',typography:'conversational',spatial:'modular-grid',accent:'corner-signal',framing:'open-canvas',post:'Modular Brief',semantic:['gather','connect','balance'],material:['paper','light'],motion:['connect','connect'],geometry:['grid','free'],lighting:['soft'],depth:['layered'],mood:['اجتماعي','حواري'],motifs:['أصوات','ساحة'],sample:'الصورة المشتركة لا تمحو اختلاف الأصوات التي صنعتها'},

  {id:'first-question',ar:'السؤال الأول',en:'First Question',family:'education-childhood',familyLabel:F['education-childhood'],tagline:'الفضول يرسم العالم بلا كرتونية.',description:'فراغات ورسوم خطية راقية تجعل السؤال أداة بناء لا زينة طفولية.',colors:['#F5F1E6','#FFFDF8','#24231F','#777268','#E0A655','#F1E1C8','#D8CDBB'],paletteId:'saffron-shadow',layout:'hero-word',typography:'conversational',spatial:'asymmetric-air',accent:'hero-keyword',framing:'open-canvas',post:'Poster Monument',semantic:['question','reveal','path'],material:['paper','ink'],motion:['reveal','grow'],geometry:['free','organic'],lighting:['soft'],depth:['flat','layered'],mood:['فضولي','راقي'],motifs:['خط أول','دائرة ناقصة'],sample:'أول سؤال قد يرسم طريقاً لم نكن نراه'},
  {id:'chalk-galaxy',ar:'مجرة الطباشير',en:'Chalk Galaxy',family:'education-childhood',familyLabel:F['education-childhood'],tagline:'طباشير يتحول إلى مجرة معرفة.',description:'سبورة داكنة وخطوط حية تتصل كنجوم معرفية من دون مدرسية مملة.',colors:['#10201D','#18302B','#F3F0E5','#A7B5AE','#E1D59D','#294A42','#3B5D54'],paletteId:'emerald-sand',layout:'neural-constellation',typography:'conversational',spatial:'layered-depth',accent:'soft-orbit',framing:'open-canvas',post:'Typographic Field',semantic:['connect','question','reveal'],material:['stone','ink'],motion:['connect','weave'],geometry:['organic','circular'],lighting:['radial','soft'],depth:['layered'],mood:['تعليمي','حي'],motifs:['طباشير','كوكبة'],sample:'المعرفة تبدأ بخط ثم تجد خطاً آخر تتصل به'},
  {id:'growing-desk',ar:'المكتب النامي',en:'Growing Desk',family:'education-childhood',familyLabel:F['education-childhood'],tagline:'مكتب تنمو منه المسارات والمفاهيم.',description:'بيئة تعلم تتفرع منها أغصان معرفية بدلاً من أيقونات الكتب المعتادة.',colors:['#EDE6D4','#FAF6EB','#25251F','#777466','#6E9A68','#DCE6D3','#C8C2AB'],paletteId:'emerald-sand',layout:'knowledge-map',typography:'rational-sans',spatial:'topographic-stack',accent:'paper-note',framing:'floating-sheet',post:'Timeline Path',semantic:['root','connect','rise'],material:['paper','paper'],motion:['grow','connect'],geometry:['organic','grid'],lighting:['side','soft'],depth:['layered','perspective'],mood:['نامٍ','تعليمي'],motifs:['مكتب','غصن مفهوم'],sample:'التعلم الجيد لا يملأ المكتب؛ يفتح منه طرقاً'},
  {id:'safe-error',ar:'الخطأ الآمن',en:'Safe Error',family:'education-childhood',familyLabel:F['education-childhood'],tagline:'الكسر يتحول إلى طريق جديد.',description:'الخطأ يظهر كتحول بنيوي لا كعلامة حمراء للإدانة.',colors:['#F2F2EC','#FFFFFF','#20231F','#727770','#5A8D76','#D9E7DF','#C6D0CA'],paletteId:'quiet-stone',layout:'dual-thesis',typography:'rational-sans',spatial:'split-balance',accent:'corner-signal',framing:'corner-marks',post:'Split Contrast',semantic:['fracture','transform','liberate'],material:['paper','stone'],motion:['split','reveal'],geometry:['free','axial'],lighting:['soft'],depth:['flat','layered'],mood:['آمن','تحويلي'],motifs:['كسر يتحول لمسار','وصلة'],sample:'الخطأ الآمن لا ينتهي عند الكسر؛ يبدأ منه طريق آخر'},

  {id:'mineral-rain',ar:'مطر معدني',en:'Mineral Rain',family:'material-environment',familyLabel:F['material-environment'],tagline:'بلورات تتجمع بحسب ثقل الفكرة.',description:'مطر معدني كثيف أو خفيف يتبع الوزن الدلالي لا الزينة.',colors:['#151819','#222729','#EEF1F0','#9EA7A8','#A8B7BA','#334043','#485456'],paletteId:'quiet-stone',layout:'quiet-orbit',typography:'display-monumental',spatial:'layered-depth',accent:'data-marker',framing:'open-canvas',post:'Central Emblem',semantic:['gather','rise','confront'],material:['metal'],motion:['rise','connect'],geometry:['circular','free'],lighting:['side','radial'],depth:['spatial'],mood:['معدني','ثقيل'],motifs:['بلورة','مطر'],sample:'ثقل الفكرة يغيّر طريقة سقوط الأشياء حولها'},
  {id:'moss-circuit',ar:'دائرة الطحلب',en:'Moss Circuit',family:'material-environment',familyLabel:F['material-environment'],tagline:'تقنية تستعيد الحياة.',description:'دائرة إلكترونية ينمو عليها الطحلب لتوازن النظام والطبيعة.',colors:['#0E1914','#17281F','#EFF5EE','#9DAE9E','#72A36F','#27422F','#3A5740'],paletteId:'emerald-sand',layout:'silicon-arabesque',typography:'rational-sans',spatial:'modular-grid',accent:'data-marker',framing:'open-canvas',post:'Central Emblem',semantic:['connect','root','transform'],material:['metal','light'],motion:['connect','grow'],geometry:['grid','organic'],lighting:['soft','backlit'],depth:['layered'],mood:['حيوي','تقني'],motifs:['طحلب','مسار إلكتروني'],sample:'التقنية الناضجة تعرف كيف تترك مكاناً للحياة'},
  {id:'clay-horizon',ar:'أفق الطين',en:'Clay Horizon',family:'material-environment',familyLabel:F['material-environment'],tagline:'طين يتشكل إلى أفق أو كلمة.',description:'مادة خام تتغير تدريجياً إلى صورة ذات معنى من دون واقعية ثقيلة.',colors:['#B9876B','#D2A98F','#2B211C','#735849','#E1B08A','#D8B69F','#A87860'],paletteId:'saffron-shadow',layout:'hero-word',typography:'display-monumental',spatial:'low-horizon',accent:'hero-keyword',framing:'open-canvas',post:'Poster Monument',semantic:['transform','rise','root'],material:['clay'],motion:['grow','rise'],geometry:['organic','free'],lighting:['side'],depth:['perspective'],mood:['ترابي','تكويني'],motifs:['طين','أفق'],sample:'المعنى لا يصل جاهزاً؛ يتشكل تحت اليد'},
  {id:'ocean-archive',ar:'أرشيف المحيط',en:'Ocean Archive',family:'material-environment',familyLabel:F['material-environment'],tagline:'صفحات وذكريات في تيار عميق.',description:'أرشيف تحت الماء يتحرك ببطء ويعيد ترتيب الذاكرة.',colors:['#071821','#0D2935','#EBF6F6','#90A9AF','#69B6C3','#183E4B','#2C5662'],paletteId:'majlis-teal',layout:'marginalia',typography:'editorial-serif',spatial:'layered-depth',accent:'paper-note',framing:'full-bleed',post:'Editorial Stack',semantic:['echo','dissolve','gather'],material:['water','paper'],motion:['breathe','reveal'],geometry:['organic','free'],lighting:['backlit','soft'],depth:['cinematic','spatial'],mood:['عميق','أرشيفي'],motifs:['صفحة غارقة','تيار'],sample:'ما يغرق في الذاكرة لا يختفي؛ يتغير موقعه فقط'},
]

/* Families 8–16 above contain all 64 masters; enforce this at module evaluation. */
if (WORLD_SPECS.length !== 64) throw new Error(`Design Worlds invariant failed: expected 64, got ${WORLD_SPECS.length}`)

function luminance(hex: string) {
  const clean = hex.replace('#','')
  const [r,g,b] = [0,2,4].map((i) => Number.parseInt(clean.slice(i,i+2),16) || 0)
  return (r * 299 + g * 587 + b * 114) / 255000
}
function paletteOf(spec: WorldSpec): Palette {
  const [background,surface,ink,muted,accent,accentSoft,rule] = spec.colors
  const isDark = luminance(background) < .47
  return {
    id: spec.paletteId, label: spec.ar, background, surface, ink, muted, accent, accentSoft, rule, isDark,
    spectrum: [accent, ink, muted, rule],
    atmo: {
      wash: { angle: spec.geometry.includes('axial') ? 180 : 145, stops: [{offset:0,color:background},{offset:.58,color:surface},{offset:1,color:background}] },
      glows: spec.lighting.includes('radial') || spec.lighting.includes('eclipse') || spec.lighting.includes('premium-neon')
        ? [{x:.78,y:.14,r:.52,color:accent,opacity: spec.lighting.includes('premium-neon') ? .16 : .11}] : undefined,
      stars: spec.family === 'cosmic', gridPaper: spec.geometry.includes('grid') && !isDark,
      silk: spec.family === 'quiet-luxury' || spec.id === 'diwaniya-night', vignette: isDark ? .38 : .09,
      grain: spec.material.includes('paper') || spec.material.includes('sand') || spec.material.includes('clay') ? 1.25 : .75,
      titleGradient: isDark ? [ink, accent] : undefined,
      foil: spec.id === 'silent-gold' || spec.id === 'copper-eclipse', edgeLight: spec.material.includes('glass'),
    },
  }
}
function makeWorld(spec: WorldSpec): DesignWorld {
  const palette = paletteOf(spec)
  const familyPeers = WORLD_SPECS.filter((x) => x.family === spec.family && x.id !== spec.id).map((x) => x.id)
  return {
    id: spec.id, labelAr: spec.ar, labelEn: spec.en, family: spec.family, familyLabel: spec.familyLabel,
    description: spec.description, philosophy: `يحوّل «${spec.tagline}» إلى قاعدة تكوين لا إلى زينة؛ كل عنصر يجب أن يخدم المعنى والقراءة.`,
    emotionalTone: spec.mood, semanticAffinity: spec.semantic, palettes:[palette], typography: spec.typography, layoutGrammar:[spec.post],
    spatialRules:[`المركز البصري يتبع ${spec.spatial}`, 'اتجاه القراءة RTL محفوظ', 'مساحة الشعار مستقلة عن مركز الفكرة'],
    framingRules:[`الإطار الأساسي ${spec.framing}`, 'لا يلامس النص الحواف الآمنة'], geometry:spec.geometry, materials:spec.material,
    textures: spec.material.map((m) => `${m}-subtle`), lighting:spec.lighting, depth:spec.depth, motifs:spec.motifs,
    metaphorBias:[...spec.motifs, spec.semantic[0]], motionDna:spec.motion,
    transitionDna: spec.motion.map((m) => `${m}-semantic-transition`), logoBehavior:'الختم يظل مقروءاً؛ ويمكنه التحول إلى الاستعارة ثم العودة في نهاية الحلقة.',
    soundDna:[`${spec.motion[0]}-two-note`, `${spec.family}-seeded-mark`], densityRange:['minimal','balanced','rich'], contrastRange:[4.5,12],
    compatibleWorlds:familyPeers, incompatibleTraits:['glow-without-semantic-reason','text-rotation','cheap-stock-ornament','random-bounce'],
    accessibilityRules:['contrast >= 4.5:1 للنص المهم','RTL محفوظ','prefers-reduced-motion يلغي الحركة غير الضرورية','لا دوران للنص المقروء'],
    reelRules:['9:16','5–8 مشاهد','Hook <= 1.5s','18–30s','CTA خاص بالمادة','Safe zone لمنطقة أزرار المنصة'],
    postRules:['1:1 و4:5','نقطة تركيز واحدة','PNG عالي الدقة','تطابق المعاينة والتصدير'],
    performanceBudget:{maxPreviewLayers:6,maxAnimatedParticles:36,prefersStaticPreview:true,textureBudget:'low'},
    signatureTokens:[spec.id,spec.family,spec.post,spec.spatial,spec.material.join('+'),spec.motion.join('+'),spec.lighting.join('+')],
    label:spec.ar, tagline:spec.tagline, essence:spec.description, reference:'دستور أصلي مولّد داخل هوية الاستوديو — لا نسخ حرفي لعلامة أو قالب خارجي.',
    palette, layout:spec.layout, spatial:spec.spatial, accent:spec.accent, framing:spec.framing,
    idealKinds:['core-idea','article','research','quote','provocative-question'], idealTones:['deep','intellectual','human','bold','academic'],
    dos:[`اجعل ${spec.motifs[0]} جزءاً من الحجة`,`الحركة الأساسية ${spec.motion[0]}`,`استخدم المادة ${spec.material[0]} بوصفها معنى`],
    donts:['لا تغيّر اللون فقط وتسمّي النتيجة عالماً جديداً','لا Glow بلا سبب','لا تزاحم النص بزخرفة جاهزة'], sampleIdea:spec.sample, master:true,
  }
}

export const MASTER_WORLD_ORDER = WORLD_SPECS.map((spec) => spec.id)
export type MasterWorldId = (typeof MASTER_WORLD_ORDER)[number]

const MASTER_WORLDS = Object.fromEntries(WORLD_SPECS.map((spec) => [spec.id, makeWorld(spec)])) as Record<string,DesignWorld>

/** Old IDs remain valid, but do not count as additional master worlds. */
export const LEGACY_WORLD_ALIASES = {
  'observatory-night':'obsidian-orbit', 'magazine-paper':'black-margin', 'aurora-dawn':'ivory-air', 'majlis-velvet':'diwaniya-night',
  'ink-marble':'word-monument', 'sadu-night':'sadu-signal', 'lab-notebook':'footnote-laboratory', 'dawn-orchard':'desert-bloom',
} as const
export type LegacyWorldId = keyof typeof LEGACY_WORLD_ALIASES
export type DesignWorldId = MasterWorldId | LegacyWorldId

function legacyWorld(id: LegacyWorldId, targetId: string): DesignWorld {
  const target = MASTER_WORLDS[targetId]
  return {...target,id,label:`${target.label} · Legacy`,labelAr:target.labelAr,labelEn:target.labelEn,master:false,signatureTokens:[...target.signatureTokens,`legacy:${id}`]}
}
export const DESIGN_WORLDS: Record<string,DesignWorld> = {
  ...MASTER_WORLDS,
  ...Object.fromEntries(Object.entries(LEGACY_WORLD_ALIASES).map(([legacy,target]) => [legacy,legacyWorld(legacy as LegacyWorldId,target)])),
}
/** Gallery order is masters only; compatibility aliases never inflate the 64. */
export const WORLD_ORDER: DesignWorldId[] = [...MASTER_WORLD_ORDER]
export const WORLD_FAMILY_OPTIONS = Object.entries(F).map(([id,label]) => ({id:id as WorldFamilyId,label}))

export function resolveWorld(id: string | null | undefined): DesignWorld | null { return id ? DESIGN_WORLDS[id] || null : null }
export function dressPlanInWorld(plan: CompositionPlan, world: DesignWorld): CompositionPlan { return incarnatePlanInWorld(plan,world) }
export function incarnatePlanInWorld(plan: CompositionPlan, world: DesignWorld): CompositionPlan {
  return reshapePlanSignature(plan,{typography:world.typography,spatial:world.spatial,accent:world.accent,framing:world.framing,paletteOverride:world.palette})
}
export function undressPlanFromWorld(plan: CompositionPlan): CompositionPlan { return reshapePlanSignature(plan,{paletteOverride:null}) }
export function generateWorldDesigns(world: DesignWorld, request: SocialDesignRequest): SocialDesignResult {
  const result = generateSocialDesigns({...request,preferLayout:request.preferLayout || world.layout,preferPalette:world.palette.id,preferTypography:world.typography})
  return {...result,plans:result.plans.map((plan) => incarnatePlanInWorld(plan,world))}
}
export function worldPreviewPlan(world: DesignWorld, text?: string, format: SocialFormatId='instagram-portrait'): CompositionPlan {
  const idea=(text||'').trim()||world.sampleIdea
  const draft=draftWorldPreview(idea,{layout:world.layout,typography:world.typography,palette:world.palette.id,format,seed:`world:${world.id}:${idea.slice(0,40)}`})
  const incarnated=incarnatePlanInWorld(draft,world)
  return text?.trim() ? incarnated : {...incarnated,content:{...incarnated.content,authorHidden:true,cta:''}}
}
export function planWorldId(plan: CompositionPlan): DesignWorldId | null {
  const label=plan.paletteOverride?.label
  if (!label) return null
  const master = MASTER_WORLD_ORDER.find((id) => DESIGN_WORLDS[id].palette.label===label)
  return master || null
}
