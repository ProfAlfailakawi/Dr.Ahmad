/**
 * عوالم التصميم — دساتير جمالٍ متكاملة على نسق DESIGN.md العالمي.
 *
 * الدرس المأخوذ من مستودع awesome-design-md (73 دستوراً لعلامات مثل Linear
 * وApple وStripe وVercel وWIRED): اللغة البصرية الراقية ليست «لوحة ألوان»
 * تُخلط بمحاور مستقلة، بل عالمٌ واحد كل مفتاحٍ فيه مضبوطٌ مع أخيه — الجوّ
 * والألوان وأدوارها والطباعة والفضاء والعمق واللمسات والمحظورات، دفعةً واحدة.
 *
 * هنا اثنا عشر عالماً مطوّعاً لهوية الدكتور (لا منسوخاً عن أحد): كل عالمٍ يحمل
 * لوحته الكاملة مع غلافها الجوّي (WorldAtmosphere) وتوقيعه على محاور المحرك
 * العوالم ودستورها المصغّر (افعل/لا تفعل). المصيّر يقرأ الغلاف الجوّي في
 * `backdrop()` وحدها فيسري العالم على كل العائلات والشرائح.
 *
 * قاعدة الإسناد: نصوص المعاينة أمثلةٌ محايدة تُعرض بلا توقيع المؤلف —
 * «لا يُنسب إليه ما لم يقله» — والتوقيع يعود حين يصمم الدكتور نصّه الحقيقي.
 */

import {
  type AccentStrategyId,
  type CompositionPlan,
  type ContentKind,
  type ContentTone,
  type FramingModeId,
  type LayoutFamilyId,
  type Palette,
  type SocialDesignRequest,
  type SocialDesignResult,
  type SocialFormatId,
  type SpatialPatternId,
  type TypographyModeId,
  draftWorldPreview,
  generateSocialDesigns,
  reshapePlanSignature,
} from './social-design-engine'

export const DESIGN_WORLDS_VERSION = '1.1.0'

export type DesignWorldId =
  | 'observatory-night'
  | 'magazine-paper'
  | 'aurora-dawn'
  | 'majlis-velvet'
  | 'ink-marble'
  | 'sadu-night'
  | 'lab-notebook'
  | 'dawn-orchard'
  | 'copper-eclipse'
  | 'indigo-archive'
  | 'emerald-atlas'
  | 'coral-future'

export interface DesignWorld {
  id: DesignWorldId
  /** الاسم كما يظهر في المعرض. */
  label: string
  /** سطر الجوّ: ماذا يفعل هذا العالم بالفكرة. */
  tagline: string
  /** وصف الأجواء الكامل — باب «Visual Theme & Atmosphere» من الدستور. */
  essence: string
  /** اللغة العالمية التي استُلهم منها البناء (استلهامٌ لا نسخ). */
  reference: string
  /** اللوحة الكاملة بغلافها الجوّي؛ حقل id يشير لأقرب لوحةٍ قائمة للتوافق. */
  palette: Palette
  layout: LayoutFamilyId
  typography: TypographyModeId
  spatial: SpatialPatternId
  accent: AccentStrategyId
  framing: FramingModeId
  idealKinds: ContentKind[]
  idealTones: ContentTone[]
  /** دستور مصغّر: ما يفعله هذا العالم دائماً. */
  dos: string[]
  /** وما يرفضه دائماً. */
  donts: string[]
  /** نص المعاينة في المعرض — مثالٌ محايد يُعرض بلا توقيع. */
  sampleIdea: string
}

/* ------------------------------------------------------------------ */
/*                         دساتير العوالم                               */
/* ------------------------------------------------------------------ */

export const DESIGN_WORLDS: Record<DesignWorldId, DesignWorld> = {
  'observatory-night': {
    id: 'observatory-night',
    label: 'مرصد الليل',
    tagline: 'سماء بحثٍ عميقة: زجاجٌ ونجومٌ وشفقٌ بنفسجي.',
    essence: 'فضاء ليلي دقيق الهندسة: أرضية كحلية عميقة يعبرها شفقان بنفسجي وسماوي، نجومٌ حتمية تولد من بصمة التصميم، وخيط ضوءٍ على الحافة يمنح السطح ملمس الزجاج. عالم الأفكار التي تستحق سماءً كاملة.',
    reference: 'مستلهم من صرامة Linear الليلية وسواد Vercel النبيل',
    palette: {
      id: 'silicon-night',
      label: 'مرصد الليل',
      background: '#0A0F1D',
      surface: '#111A2E',
      ink: '#E9F0FC',
      muted: '#9AA8C4',
      accent: '#86A8F0',
      accentSoft: '#1C2C4F',
      rule: '#263654',
      isDark: true,
      spectrum: ['#86A8F0', '#A78BFA', '#38CFE0', '#22315A'],
      atmo: {
        wash: { angle: 135, stops: [{ offset: 0, color: '#0A0F1D' }, { offset: 0.55, color: '#0D1526' }, { offset: 1, color: '#131F3A' }] },
        glows: [
          { x: 0.82, y: 0.1, r: 0.55, color: '#A78BFA', opacity: 0.16 },
          { x: 0.12, y: 0.86, r: 0.6, color: '#38CFE0', opacity: 0.12 },
          { x: 0.2, y: 0.16, r: 0.5, color: '#86A8F0', opacity: 0.14 },
        ],
        stars: true,
        vignette: 0.4,
        grain: 1.15,
        titleGradient: ['#DCE7FF', '#8FB0F5'],
        edgeLight: true,
      },
    },
    layout: 'quiet-orbit',
    typography: 'display-monumental',
    spatial: 'centered-monument',
    accent: 'soft-orbit',
    framing: 'open-canvas',
    idealKinds: ['core-idea', 'research', 'statistic', 'knowledge-design', 'provocative-question'],
    idealTones: ['deep', 'intellectual', 'bold', 'academic'],
    dos: ['نجومٌ قليلة صادقة لا سماء مزدحمة', 'توهجان متقابلان يصنعان العمق', 'حبر العنوان يتدرج كضوء القمر'],
    donts: ['لا ظلال سوداء ثقيلة — العمق من سلم الأسطح', 'لا أكثر من فكرةٍ واحدة في السماء'],
    sampleIdea: 'نرسم خرائط الفكر كما ترسم المراصد سماءها',
  },

  'magazine-paper': {
    id: 'magazine-paper',
    label: 'ورق المجلة',
    tagline: 'افتتاحية مطبوعة: حبرٌ ثقيل وأحمر محفوظ للحُكم.',
    essence: 'صفحة مجلةٍ فكرية على ورقٍ كريمي حي: مساطر سميكة تسند العناوين، أحمرُ متحفيّ لا يظهر إلا حيث يقع الحكم، وحبيبات ورقٍ تُسمع صوت المطبعة. عالم المقالات التي تُقرأ مرتين.',
    reference: 'مستلهم من جرأة WIRED التحريرية وثقة المجلات العريقة',
    palette: {
      id: 'museum-red',
      label: 'ورق المجلة',
      background: '#F7F2E6',
      surface: '#FDFAF2',
      ink: '#1C1914',
      muted: '#6E6455',
      accent: '#C23B27',
      accentSoft: '#F0D9CB',
      rule: '#DCCFB6',
      isDark: false,
      spectrum: ['#C23B27', '#1C1914', '#8A6F4D', '#DCCFB6'],
      atmo: {
        wash: { angle: 180, stops: [{ offset: 0, color: '#F9F4E9' }, { offset: 1, color: '#F3ECDC' }] },
        grain: 1.35,
        vignette: 0.12,
      },
    },
    layout: 'magazine-columns',
    typography: 'editorial-serif',
    spatial: 'right-rail',
    accent: 'editorial-index',
    framing: 'editorial-folio',
    idealKinds: ['article', 'summary', 'research', 'book', 'core-idea'],
    idealTones: ['intellectual', 'academic', 'formal', 'human'],
    dos: ['الأسود يحمل المتن والأحمر يحمل الحكم وحده', 'هوامش كتابية ورقم صفحةٍ صغير', 'حبيبات ورقٍ ظاهرة بلا ضجيج'],
    donts: ['لا تدرجات لونية — المطبعة لا تعرف الشفق', 'لا أكثر من لمسةٍ حمراء واحدة'],
    sampleIdea: 'المقال الجيد يبدأ حيث ينتهي اليقين السهل. نكتب لنختبر الفكرة لا لنستعرضها، ونقرأ لنفهم لا لننتصر. وبين السطر والسطر مسافة يتنفس فيها العقل قبل أن يحكم.',
  },

  'aurora-dawn': {
    id: 'aurora-dawn',
    label: 'شفق الفجر',
    tagline: 'بشارة ضوء: ثلاث هالات تتنفس خلف كلمةٍ بطلة.',
    essence: 'قماشة بيضاء يقظة تعبرها ثلاث هالاتٍ ناعمة — بنفسج وسماوي وورد — تلتقي خلف الكلمة البطلة فيتدرج حبرها كضوء الصبح. حبيبات دقيقة تمنع البرود الرقمي. عالم الإعلانات المتفائلة والأفكار التي تبشّر.',
    reference: 'مستلهم من أطياف Stripe المضيئة على بياض Framer',
    palette: {
      id: 'electric-cobalt',
      label: 'شفق الفجر',
      background: '#FBFBFF',
      surface: '#FFFFFF',
      ink: '#191A2E',
      muted: '#5D6480',
      accent: '#5B5BD6',
      accentSoft: '#E3E4FB',
      rule: '#D9DBEE',
      isDark: false,
      spectrum: ['#5B5BD6', '#0EA5E9', '#E88FB4', '#14B8A6'],
      atmo: {
        glows: [
          { x: 0.8, y: 0.14, r: 0.5, color: '#8B7CF6', opacity: 0.2 },
          { x: 0.14, y: 0.82, r: 0.55, color: '#38BDF8', opacity: 0.16 },
          { x: 0.9, y: 0.86, r: 0.45, color: '#F0A6C0', opacity: 0.14 },
        ],
        grain: 1,
        vignette: 0.06,
        titleGradient: ['#3F3AB8', '#0873AE'],
        edgeLight: true,
      },
    },
    layout: 'hero-word',
    typography: 'display-monumental',
    spatial: 'asymmetric-air',
    accent: 'hero-keyword',
    framing: 'open-canvas',
    idealKinds: ['announcement', 'invitation', 'core-idea', 'lecture', 'course'],
    idealTones: ['inspiring', 'promotional', 'media', 'bold'],
    dos: ['ثلاث هالات لا رابعة لها', 'الكلمة البطلة تكبر والبقية تتنحى', 'حبر العنوان يتدرج من البنفسج إلى السماوي'],
    donts: ['لا خلفيات داكنة — هذا عالم صباحي', 'لا حدود صلبة حول الهالات'],
    sampleIdea: 'كل فكرة عظيمة كانت يوماً سؤالاً صغيراً',
  },

  'majlis-velvet': {
    id: 'majlis-velvet',
    label: 'مخمل المجلس',
    tagline: 'فخامة هادئة: ذهبٌ معدنيّ على عتمةٍ دافئة.',
    essence: 'عتمة بُنّية دافئة كمجلسٍ مسائي، يعبرها لمعانٌ حريري خافت، وتُكتب لمساتها — المسطرة والشارة والتوقيع — بذهبٍ معدنيّ حقيقي التدرج. الاقتباس يجلس في الصدارة ويأخذ نَفَسه كاملاً. عالم الحكمة التي لا تستعجل.',
    reference: 'مستلهم من ترف Superhuman الليلي وسكينة الضيافة الخليجية',
    palette: {
      id: 'graphite-gold',
      label: 'مخمل المجلس',
      background: '#151011',
      surface: '#201819',
      ink: '#F6EFE3',
      muted: '#C7B9A4',
      accent: '#D8B36A',
      accentSoft: '#3A2E20',
      rule: '#443A2C',
      isDark: true,
      spectrum: ['#D8B36A', '#8C6D3F', '#F3E3C2', '#2A211C'],
      atmo: {
        wash: { angle: 160, stops: [{ offset: 0, color: '#171112' }, { offset: 0.5, color: '#151011' }, { offset: 1, color: '#1D1416' }] },
        glows: [{ x: 0.5, y: 0.04, r: 0.6, color: '#D8B36A', opacity: 0.1 }],
        silk: true,
        vignette: 0.5,
        grain: 1.2,
        titleGradient: ['#F0DDB0', '#C89B52'],
        foil: true,
        edgeLight: true,
      },
    },
    layout: 'quote-stage',
    typography: 'quotation-signature',
    spatial: 'centered-monument',
    accent: 'quiet-seal',
    framing: 'hairline-inset',
    idealKinds: ['quote', 'recommendation', 'impression-card', 'book', 'invitation'],
    idealTones: ['luxury', 'deep', 'calm', 'human'],
    dos: ['الذهب للمسات لا للمتن', 'لمعان حريري واحد يكفي', 'فراغ واسع يليق بالحكمة'],
    donts: ['لا ألوان باردة — الدفء هوية المجلس', 'لا زحام نقاط أو قوائم'],
    sampleIdea: 'المعنى لا يُشترى… يُصاغ على مهل',
  },

  'ink-marble': {
    id: 'ink-marble',
    label: 'حبر ورخام',
    tagline: 'بلاغة الحذف: كلمة منحوتة في بياضٍ مطلق.',
    essence: 'بياض رخامي مطلق وحبر فحمي منحوت — لا زخرفة ولا توهج ولا إطار: الكلمة وحدها، بأحجامٍ متدرجة تملأ اللوحة كما تملأ المنحوتة قاعتها. حبيبات خافتة جداً تمنع البرود. عالم الجمل التي تحتمل أن تقف عارية.',
    reference: 'مستلهم من صمت Apple الواثق وبياض المتاحف',
    palette: {
      id: 'ink-white',
      label: 'حبر ورخام',
      background: '#FFFFFF',
      surface: '#F5F5F7',
      ink: '#0C0D10',
      muted: '#71747B',
      accent: '#101216',
      accentSoft: '#ECEDEF',
      rule: '#E2E3E6',
      isDark: false,
      spectrum: ['#0C0D10', '#71747B', '#E2E3E6', '#3E5C78'],
      atmo: {
        grain: 0.5,
        vignette: 0,
      },
    },
    layout: 'type-poster',
    typography: 'display-monumental',
    spatial: 'centered-monument',
    accent: 'none',
    framing: 'open-canvas',
    idealKinds: ['quote', 'core-idea', 'provocative-question', 'impression-card'],
    idealTones: ['bold', 'deep', 'intellectual', 'formal'],
    dos: ['الحذف قبل الإضافة دائماً', 'الحرف هو الزخرفة الوحيدة', 'فراغ يتنفس من كل جهة'],
    donts: ['لا لون ثالثاً مهما صغر', 'لا توهجات ولا ظلال — الرخام لا يلمع'],
    sampleIdea: 'الوضوح شجاعة',
  },

  'sadu-night': {
    id: 'sadu-night',
    label: 'ليل السدو',
    tagline: 'نولٌ يسهر: خيوط الذاكرة تنسج القادم.',
    essence: 'ليل صحراوي بلون وبر الإبل المحروق، يؤطره حزامان من مثلثات السدو بألوان الجمر — سيينا محروقة وزعفران وفيروز مطفأ — وحبر عنوانٍ يتدرج كضوء نارٍ بعيدة. تراثٌ يُروى بلغة الغد لا بلغة الحنين. عالم الهوية حين تتقدم.',
    reference: 'نسيج كويتي أصيل بمعالجة ليلية معاصرة — لا يشبه أحداً',
    palette: {
      id: 'saffron-shadow',
      label: 'ليل السدو',
      background: '#1E1410',
      surface: '#291B15',
      ink: '#F7EDE0',
      muted: '#C9B59F',
      accent: '#D96A3B',
      accentSoft: '#4A2E1E',
      rule: '#45332A',
      isDark: true,
      spectrum: ['#D96A3B', '#E8B54A', '#3F8E86', '#7A3B2C'],
      atmo: {
        wash: { angle: 170, stops: [{ offset: 0, color: '#201511' }, { offset: 1, color: '#1B120E' }] },
        glows: [
          { x: 0.5, y: 0.92, r: 0.6, color: '#D96A3B', opacity: 0.13 },
          { x: 0.85, y: 0.1, r: 0.45, color: '#E8B54A', opacity: 0.08 },
        ],
        grain: 1.25,
        vignette: 0.35,
        titleGradient: ['#F5C98A', '#DD7A45'],
        edgeLight: true,
      },
    },
    layout: 'sadu-weave',
    typography: 'cinematic-title',
    spatial: 'low-horizon',
    accent: 'contrast-band',
    framing: 'open-canvas',
    idealKinds: ['core-idea', 'quote', 'announcement', 'book', 'impression-card'],
    idealTones: ['luxury', 'deep', 'inspiring', 'formal'],
    dos: ['ألوان الجمر من طيفٍ واحد دافئ', 'الحزامان يؤطران ولا يزاحمان', 'توهج النار من الأسفل كموقدٍ بعيد'],
    donts: ['لا فولكلور مباشراً — الإيحاء أبلغ من التصريح', 'لا برودة رقمية فوق النسيج'],
    sampleIdea: 'ننسج القادم من خيوط الذاكرة',
  },

  'lab-notebook': {
    id: 'lab-notebook',
    label: 'دفتر المختبر',
    tagline: 'أناقة القياس: شبكة مهندسٍ ورقمٌ يتصدر.',
    essence: 'ورقة مهندسين بيضاء دافئة تسندها شبكة دقيقة بخطٍ أثقل كل أربع خلايا، كوبالت واثق يحمل الرقم والدليل، وعلامات زوايا كأدوات المساحة. كل عنصرٍ يجلس على خط الشبكة لا قربه. عالم المعلومة التي تُقاس قبل أن تُقال.',
    reference: 'مستلهم من دفاتر Notion الورقية ودقة المخططات الهندسية',
    palette: {
      id: 'scholar-blue',
      label: 'دفتر المختبر',
      background: '#FAFAF6',
      surface: '#FFFFFF',
      ink: '#191C22',
      muted: '#5F6673',
      accent: '#2458D6',
      accentSoft: '#DDE6FA',
      rule: '#D7DAE0',
      isDark: false,
      spectrum: ['#2458D6', '#191C22', '#9AA7C4', '#E4E9F5'],
      atmo: {
        gridPaper: true,
        grain: 0.7,
        vignette: 0.05,
      },
    },
    layout: 'evidence-ledger',
    typography: 'number-led',
    spatial: 'modular-grid',
    accent: 'data-marker',
    framing: 'corner-marks',
    idealKinds: ['statistic', 'information', 'research', 'summary', 'knowledge-design'],
    idealTones: ['academic', 'institutional', 'formal', 'intellectual'],
    dos: ['الرقم أولاً ثم تفسيره باختصار', 'كل كتلة تبدأ من خط شبكةٍ معلوم', 'الكوبالت للدليل وحده'],
    donts: ['لا زخرفة فوق الشبكة — هي الزخرفة', 'لا أرقام بلا سياقٍ يفسرها'],
    sampleIdea: '60 دقيقة تفكير قد توفر أسبوع عمل. القياس قبل الحكم يحول الانطباع إلى معرفة، والدليل الصغير الصادق أثقل من حماسة كبيرة بلا أثر.',
  },

  'dawn-orchard': {
    id: 'dawn-orchard',
    label: 'بستان الفجر',
    tagline: 'دفء إنساني: مشمشٌ وزيتونٌ وورقة تطفو.',
    essence: 'صباح بستانٍ دافئ: قماشة مشمشية يعبرها ضوءان — خوخيّ من الشرق وزيتونيّ من الغرب — وورقة كتابةٍ تطفو بظلٍ يكاد لا يُرى. تراكوتا الطين للتوقيع، وحبر عنوانٍ يتدرج من الطين إلى الزيتون. عالم الكلام القريب من القلب.',
    reference: 'مستلهم من دفء Claude الورقي وألوان البساتين عند الشروق',
    palette: {
      id: 'warm-parchment',
      label: 'بستان الفجر',
      background: '#FAF3EA',
      surface: '#FFFBF4',
      ink: '#2B211A',
      muted: '#7D6C5C',
      accent: '#B4633A',
      accentSoft: '#F0D9C6',
      rule: '#E2D3C2',
      isDark: false,
      spectrum: ['#B4633A', '#8A9B6E', '#E7B98A', '#556344'],
      atmo: {
        glows: [
          { x: 0.16, y: 0.12, r: 0.5, color: '#E7B98A', opacity: 0.2 },
          { x: 0.86, y: 0.8, r: 0.55, color: '#8A9B6E', opacity: 0.13 },
        ],
        grain: 1.1,
        vignette: 0.08,
        titleGradient: ['#8A4B2A', '#556344'],
      },
    },
    layout: 'human-note',
    typography: 'editorial-serif',
    spatial: 'diagonal-flow',
    accent: 'paper-note',
    framing: 'floating-sheet',
    idealKinds: ['recommendation', 'quote', 'consultation', 'impression-card', 'invitation'],
    idealTones: ['human', 'calm', 'inspiring'],
    dos: ['ضوءان دافئان يتقابلان بهدوء', 'الورقة تطفو ولا تثقل', 'التراكوتا للتوقيع والدعوة'],
    donts: ['لا سواد قاسياً — أدكن درجةٍ هي البُنّي', 'لا حواف حادة في عالم البستان'],
    sampleIdea: 'نكتب لنفهم، ونشارك لنكتمل',
  },

  'copper-eclipse': {
    id: 'copper-eclipse',
    label: 'كسوف النحاس',
    tagline: 'حكمٌ بصري: نصفان يفترقان ثم يكشفان الجوهر.',
    essence: 'مسرح داكن بلون الفحم المحروق، يشقه ضوء نحاسي كحافة كسوف. عالم المفارقات والقرارات والأسئلة الأخلاقية؛ فيه يتحرك النصفان بعيداً ثم يعودان على جواب واحد.',
    reference: 'مستلهم من معدن العمارة الخليجية ومنطق الملصق السينمائي',
    palette: { id: 'graphite-gold', label: 'كسوف النحاس', background: '#100C0A', surface: '#241915', ink: '#F3E8DC', muted: '#A88C7E', accent: '#D98B4C', accentSoft: '#4A2D22', rule: '#5A382A', isDark: true, spectrum: ['#D98B4C', '#7E9BB8', '#6B3527'], atmo: { wash: { angle: 140, stops: [{ offset: 0, color: '#100C0A' }, { offset: .54, color: '#241512' }, { offset: 1, color: '#0C1016' }] }, glows: [{ x: .5, y: .18, r: .56, color: '#D98B4C', opacity: .18 }], vignette: .42, grain: 1.2, edgeLight: true } },
    layout: 'dual-thesis', typography: 'rational-sans', spatial: 'split-balance', accent: 'contrast-band', framing: 'architectural-arch',
    idealKinds: ['provocative-question', 'core-idea', 'consultation', 'statistic'], idealTones: ['deep', 'bold', 'institutional'],
    dos: ['اجعل الانقسام يخدم مفارقة حقيقية', 'النحاس للحكم لا للزينة', 'اترك مركز الكسوف يتنفس'],
    donts: ['لا نصفين يحملان الفكرة نفسها', 'لا توهجات بلا سبب دلالي'],
    sampleIdea: 'ليست التقنية هي السؤال؛ بل الإنسان الذي يقرر بها',
  },

  'indigo-archive': {
    id: 'indigo-archive',
    label: 'أرشيف النيلي',
    tagline: 'ذاكرةٌ مضيئة: هامشٌ حي ومتنٌ يخرج من العتمة.',
    essence: 'نيلي عميق كغلاف مخطوط نادر، بهوامش بنفسجية دقيقة وذهب مطفأ. عالم الكتب والبحث والذاكرة؛ تظهر فيه الملاحظة قبل المتن كأن القارئ اكتشفها بقلمه.',
    reference: 'مستلهم من أرشيفات المخطوطات ومن أناقة الفهارس الأكاديمية',
    palette: { id: 'scholar-blue', label: 'أرشيف النيلي', background: '#0D1028', surface: '#191D3B', ink: '#F0F1FF', muted: '#9B9FC6', accent: '#D4B76A', accentSoft: '#30355C', rule: '#3A406B', isDark: true, spectrum: ['#D4B76A', '#8998FF', '#795A9E'], atmo: { wash: { angle: 160, stops: [{ offset: 0, color: '#0D1028' }, { offset: .7, color: '#171936' }, { offset: 1, color: '#221A39' }] }, glows: [{ x: .82, y: .12, r: .5, color: '#8998FF', opacity: .13 }], vignette: .34, grain: 1.32, edgeLight: true } },
    layout: 'marginalia', typography: 'academic-index', spatial: 'right-rail', accent: 'editorial-index', framing: 'editorial-folio',
    idealKinds: ['book', 'research', 'article', 'quote'], idealTones: ['academic', 'intellectual', 'deep'],
    dos: ['الهامش يسبق المتن كاكتشاف', 'الذهب للمرجع أو الكلمة المفتاح', 'رقم الفهرس جزء من الإيقاع'],
    donts: ['لا زخرفة مكتبية مزيفة', 'لا تجعل الهامش أثقل من الحجة'],
    sampleIdea: 'المعرفة التي لا تعود إلى أصولها تفقد نصف معناها',
  },

  'emerald-atlas': {
    id: 'emerald-atlas',
    label: 'أطلس الزمرد',
    tagline: 'خريطة قرار: نقاط تتصل ومسار يتضح.',
    essence: 'أخضر زمردي عميق فوق شبكة خرائط دقيقة، بعلامات ذهبية صغيرة تتصل لتكوّن مساراً. عالم الأنظمة والقيادة والتخطيط؛ تتحول العلاقة بين العناصر فيه إلى خريطة قابلة للقراءة.',
    reference: 'مستلهم من الأطالس العلمية ولوحات قيادة الأنظمة الحديثة',
    palette: { id: 'emerald-sand', label: 'أطلس الزمرد', background: '#081C19', surface: '#12312B', ink: '#E9F5F0', muted: '#8FAFA6', accent: '#E0B760', accentSoft: '#244E45', rule: '#2D5D52', isDark: true, spectrum: ['#E0B760', '#72C7B3', '#4F8779'], atmo: { wash: { angle: 130, stops: [{ offset: 0, color: '#081C19' }, { offset: .55, color: '#0E2924' }, { offset: 1, color: '#153D34' }] }, glows: [{ x: .18, y: .82, r: .55, color: '#72C7B3', opacity: .15 }], vignette: .3, grain: .82 } },
    layout: 'knowledge-map', typography: 'rational-sans', spatial: 'modular-grid', accent: 'data-marker', framing: 'corner-marks',
    idealKinds: ['knowledge-design', 'research', 'summary', 'information'], idealTones: ['institutional', 'academic', 'intellectual'],
    dos: ['كل نقطة لها علاقة ظاهرة', 'الذهب يحدد القرار النهائي', 'الشبكة تقود العين ولا تسجنها'],
    donts: ['لا عقد بلا روابط', 'لا خريطة مزدحمة على حساب العنوان'],
    sampleIdea: 'حين تتضح العلاقات يصبح القرار أقرب من الحدس',
  },

  'coral-future': {
    id: 'coral-future',
    label: 'مستقبل مرجاني',
    tagline: 'تقنية إنسانية: نبضٌ مرجاني داخل شبكة سماوية.',
    essence: 'بياض دافئ تتنفس فوقه هالات مرجانية وسماوية، وشبكة دقيقة تنحني حول الكلمة لا فوقها. عالم المستقبل حين يُروى من جهة الإنسان لا من جهة الآلة.',
    reference: 'مستلهم من واجهات المستقبل الهادئة ومن دفء الأنسجة الحية',
    palette: { id: 'electric-cobalt', label: 'مستقبل مرجاني', background: '#FFF6F2', surface: '#FFFFFF', ink: '#33242B', muted: '#896E77', accent: '#C85161', accentSoft: '#F6D9DB', rule: '#E7C9CA', isDark: false, spectrum: ['#C85161', '#2E7C88', '#F1A37B', '#8F83D8'], atmo: { glows: [{ x: .18, y: .16, r: .52, color: '#F1A37B', opacity: .2 }, { x: .84, y: .78, r: .58, color: '#56B1BC', opacity: .14 }, { x: .72, y: .12, r: .42, color: '#8F83D8', opacity: .11 }], grain: .72, vignette: .06, titleGradient: ['#B64054', '#24717C'] } },
    layout: 'neural-constellation', typography: 'display-monumental', spatial: 'asymmetric-air', accent: 'soft-orbit', framing: 'open-canvas',
    idealKinds: ['core-idea', 'announcement', 'recommendation', 'provocative-question'], idealTones: ['human', 'inspiring', 'bold'],
    dos: ['الشبكة تنبض حول الإنسان', 'المرجاني للعاطفة والسماوي للنظام', 'مساحة بيضاء واسعة للمستقبل'],
    donts: ['لا أزرق تقني بارد وحده', 'لا عقدة شبكة تمر فوق النص'],
    sampleIdea: 'المستقبل الأجمل لا ينسى من صُمم من أجله',
  },
}

/** ترتيب العرض في المعرض: تعاقب ليلٍ ونهارٍ يجعل الشريط نفسه لوحة. */
export const WORLD_ORDER: DesignWorldId[] = [
  'observatory-night',
  'magazine-paper',
  'majlis-velvet',
  'aurora-dawn',
  'sadu-night',
  'ink-marble',
  'lab-notebook',
  'dawn-orchard',
  'copper-eclipse',
  'indigo-archive',
  'emerald-atlas',
  'coral-future',
]

/* ------------------------------------------------------------------ */
/*                        تطبيق العالم على الخطط                        */
/* ------------------------------------------------------------------ */

/**
 * كسوة: يلبس التصميمُ جوَّ العالم ولونه — الغلاف الجوّي واللوحة وتدرّج حبر
 * العنوان — مع إبقاء بنيته (العائلة والفضاء والطباعة) كما اختارها المحرك،
 * فتبقى الاتجاهات الأربعة متنوعة البنية موحّدة الروح.
 */
export function dressPlanInWorld(plan: CompositionPlan, world: DesignWorld): CompositionPlan {
  /* كسوةً لا استبدالاً: اللوحة الأم تبقى في بصمة الخطة كما اختارها المحرك،
     فيصدُق زرّ «أزل الكسوة» حرفياً ويعيد الألوان الأصلية نفسها. */
  return reshapePlanSignature(plan, { paletteOverride: world.palette })
}

/**
 * تجسيد: التصميم يدخل العالم كاملاً — لوحته وجوّه وطباعته وفضاؤه ولمسته
 * وإطاره. العائلة وحدها تبقى (تغييرها ولادة جديدة عبر generateWorldDesigns).
 */
export function incarnatePlanInWorld(plan: CompositionPlan, world: DesignWorld): CompositionPlan {
  return reshapePlanSignature(plan, {
    typography: world.typography,
    spatial: world.spatial,
    accent: world.accent,
    framing: world.framing,
    paletteOverride: world.palette,
  })
}

/** يمسح كسوة العالم ويعيد التصميم إلى لوحته المختارة. */
export function undressPlanFromWorld(plan: CompositionPlan): CompositionPlan {
  return reshapePlanSignature(plan, { paletteOverride: null })
}

/**
 * ولادة كاملة من داخل العالم: توليدُ دفعةٍ جديدة بلجنة المحرك كاملةً مع
 * انحيازٍ صريح لعائلة العالم وطباعته ولوحته، ثم كسوة كل النتائج بجوّه.
 */
export function generateWorldDesigns(world: DesignWorld, request: SocialDesignRequest): SocialDesignResult {
  const result = generateSocialDesigns({
    ...request,
    preferLayout: request.preferLayout || world.layout,
    preferPalette: world.palette.id,
    preferTypography: world.typography,
  })
  return { ...result, plans: result.plans.map((plan) => dressPlanInWorld(plan, world)) }
}

/**
 * ملصق المعرض الحي: خطة معاينةٍ خفيفة (مرشح واحد) تُجسَّد في العالم كاملاً.
 * نص المعاينة محايد فيُعرض بلا توقيع المؤلف — الإسناد لا يُخترع.
 */
export function worldPreviewPlan(world: DesignWorld, text?: string, format: SocialFormatId = 'instagram-portrait'): CompositionPlan {
  const idea = (text || '').trim() || world.sampleIdea
  const draft = draftWorldPreview(idea, {
    layout: world.layout,
    typography: world.typography,
    palette: world.palette.id,
    format,
    seed: `world:${world.id}:${idea.slice(0, 24)}`,
  })
  const sampled = !((text || '').trim())
  const incarnated = incarnatePlanInWorld(draft, world)
  return sampled
    ? { ...incarnated, content: { ...incarnated.content, authorHidden: true, cta: '' } }
    : incarnated
}

/** أيّ عالمٍ يكسو هذه الخطة الآن؟ (بمطابقة هوية اللوحة المكسوّة لا بالتخمين). */
export function planWorldId(plan: CompositionPlan): DesignWorldId | null {
  const label = plan.paletteOverride?.label
  if (!label) return null
  const match = WORLD_ORDER.find((id) => DESIGN_WORLDS[id].label === label)
  return match || null
}
