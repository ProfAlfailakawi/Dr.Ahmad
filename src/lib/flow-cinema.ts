/**
 * الطبقة السينمائية لبرومبتات Flow — لغة مدير تصوير، لا وصف مشهد.
 *
 * العلّة (٢٩ أغسطس ٢٠٢٦): «المخرج الحي» بُني أيام Flow المجاني، فكانت لغته
 * محافظةً عمداً — مدةٌ مثبتة بثماني ثوانٍ، وحركةٌ واحدة مكبوحة («دفع بطيء أو
 * ثبات»)، وإضاءةٌ واحدة («نهاري ناعم»)، بلا عدسةٍ ولا فتحةٍ ولا عمق ميدان.
 * وللدكتور اشتراكٌ مدفوع في Flow يستجيب لتفصيلٍ أدق بكثير، فكانت البرومبتات
 * تطلب أقلّ ممّا يدفع ثمنه.
 *
 * القاعدة هنا: **كل سطرٍ يضيف قراراً تصويرياً يفهمه المحرّك**، لا صفةً أدبية.
 * «لقطة متوسطة» قرارُ تأطير؛ و«35mm، f/2.0، عمق ضحل، رافعة صاعدة بطيئة،
 * مفتاحٌ جانبيٌّ ٤٥° مع عاكسٍ خافت» ورقةُ تصوير. والفرق بينهما هو الفرق بين
 * نتيجةٍ عامّة ونتيجةٍ مقصودة.
 *
 * الملف نقيٌّ عمداً (بلا استيراد) فيبقى قابلاً للاختبار تحت node مباشرة.
 */

/** الأنماط البصرية — يختارها الدكتور بنقرة فتتغيّر شخصية الفيديو كله. */
export type FlowLookId =
  | 'editorial-daylight'
  | 'golden-study'
  | 'quiet-architecture'
  | 'documentary-honest'
  | 'night-desk'
  | 'archival-grain'

export type FlowLook = {
  id: FlowLookId
  /** اسمٌ عربيٌّ للوحة الإدارة. */
  labelAr: string
  /** سطرٌ عربيٌّ يشرح متى يُختار. */
  noteAr: string
  /** العدسة المكافئة وفتحتها — أهمّ قرارين في الشكل. */
  lens: string
  aperture: string
  depthOfField: string
  /** مخطط الإضاءة الثلاثي بلغة مدير التصوير. */
  lighting: string
  /** مرجعٌ لونيٌّ قابل للتنفيذ لا وصفٌ شاعري. */
  grade: string
  /** النسيج: حبيبة، تباين، وهج. */
  texture: string
  /** إيقاع الحركة الافتراضي لهذا النمط. */
  motionBias: string
}

/** ستة أنماط، كلٌّ منها ورقة تصوير كاملة لا مجرّد لون. */
export const FLOW_LOOKS: FlowLook[] = [
  {
    id: 'editorial-daylight',
    labelAr: 'نهار تحريري',
    noteAr: 'الافتراضي: نظيف، هادئ، موثوق — يناسب الشرح والحجة.',
    lens: '35mm equivalent',
    aperture: 'f/2.8',
    depthOfField: 'moderately shallow; subject separated from a softly readable background',
    lighting: 'large soft key from a north-facing window at 45°, gentle bounce fill on the shadow side, subtle hair separation; overall ratio about 3:1',
    grade: 'neutral daylight white balance near 5600K, deep slate blue shadows, warm ivory highlights, restrained muted gold accent; no teal-orange push',
    texture: 'clean digital capture, very fine grain, natural highlight roll-off, no bloom',
    motionBias: 'a single restrained move: slow push-in or a locked frame',
  },
  {
    id: 'golden-study',
    labelAr: 'ساعة ذهبية',
    noteAr: 'دفء إنساني ولحظة تأمل — يناسب القصة والخاتمة.',
    lens: '50mm equivalent',
    aperture: 'f/1.8',
    depthOfField: 'shallow; background rendered as soft readable shapes',
    lighting: 'low warm key raking from a side window in late afternoon, long soft shadows, weak negative fill to keep contrast alive, faint warm rim on the shoulder',
    grade: 'warm amber key light against cool slate shadows, ivory midtones, gentle golden accent; keep skin natural and never orange',
    texture: 'soft organic contrast, fine grain, restrained atmospheric haze in the light path',
    motionBias: 'a very slow drift-in or a gentle handheld-stabilised float',
  },
  {
    id: 'quiet-architecture',
    labelAr: 'معماري هادئ',
    noteAr: 'خطوط ومساحات وصمت — يناسب الفكرة المجرّدة والسؤال.',
    lens: '28mm equivalent',
    aperture: 'f/4',
    depthOfField: 'deep; lines and planes stay sharp and legible',
    lighting: 'broad ambient daylight with clear directional intent, controlled falloff across walls, no visible fixtures, quiet luminance gradient',
    grade: 'cool neutral base, deep slate blue structure, warm ivory surfaces, a single muted gold accent used sparingly',
    texture: 'crisp and clean, minimal grain, matte surfaces, no glare',
    motionBias: 'a locked frame, or one slow lateral track parallel to the architecture',
  },
  {
    id: 'documentary-honest',
    labelAr: 'وثائقي صادق',
    noteAr: 'حضور واقعي بلا تجميل — يناسب الشهادة والموقف المباشر.',
    lens: '40mm equivalent',
    aperture: 'f/2.2',
    depthOfField: 'natural; background present but not distracting',
    lighting: 'available light shaped only lightly, honest direction, mild practical sources allowed in frame, ratio about 4:1',
    grade: 'true-to-life colour, slightly desaturated, slate blue shadows, ivory highlights, no stylised push',
    texture: 'authentic sensor texture, visible fine grain, natural imperfection preserved',
    motionBias: 'subtle stabilised handheld breathing, or a slow reframe that follows the subject',
  },
  {
    id: 'night-desk',
    labelAr: 'مكتب ليلي',
    noteAr: 'تركيز وعمق وسكون الليل — يناسب البحث والتأمل الطويل.',
    lens: '50mm equivalent',
    aperture: 'f/1.4',
    depthOfField: 'very shallow; pools of light isolate the subject',
    lighting: 'a single warm practical as key, deep controlled shadows, faint cool ambient fill from an off-frame window, soft rim to lift the silhouette',
    grade: 'deep slate blue night base, warm ivory pool of lamp light, muted gold reflections; protect shadow detail and avoid crushing to pure black',
    texture: 'rich low-light texture, fine luminance grain, soft highlight bloom around the practical only',
    motionBias: 'a locked frame, or an almost imperceptible push-in',
  },
  {
    id: 'archival-grain',
    labelAr: 'أرشيفي حبيبي',
    noteAr: 'ذاكرة وزمن مضى — يناسب التاريخ والاستشهاد بالماضي.',
    lens: '35mm equivalent',
    aperture: 'f/2.8',
    depthOfField: 'moderate; period-honest rendering',
    lighting: 'soft frontal-diagonal key with wide fill, low contrast, no modern specular highlights',
    grade: 'slightly faded contrast, ivory-leaning highlights, desaturated slate blue, aged gold warmth; gentle halation',
    texture: 'organic film grain, mild gate weave, soft edges, subtle vignette',
    motionBias: 'a locked frame, or one slow deliberate tilt',
  },
]

export const DEFAULT_FLOW_LOOK: FlowLookId = 'editorial-daylight'

export const flowLook = (id?: FlowLookId | null): FlowLook =>
  FLOW_LOOKS.find((look) => look.id === id) || FLOW_LOOKS[0]

/**
 * المدد التي يقبلها Flow فعلاً للتوليدة الواحدة (وثائق Google الرسمية،
 * ٢٩ أغسطس ٢٠٢٦): Veo 3.1 بنسخه الثلاث ٤ و٦ و٨ ثوانٍ، وGemini Omni Flash 1.1
 * يزيد العاشرة. وكان هذا الملف يعرض ٨ و١٦ و٢٤ — ورقمٌ فوق الحدّ لا يطيل
 * المقطع، وإنما يكتب في البرومبت مدةً يتجاهلها المحرّك وتفسد توقيت اللقطات.
 * الأطول يكون بخاصية Extend داخل Flow لا برقمٍ في النص.
 */
export const FLOW_CLIP_SECONDS = [4, 6, 8, 10] as const
export type FlowClipSeconds = (typeof FLOW_CLIP_SECONDS)[number]

/** العاشرة متاحة بنموذج واحد؛ تُعرض ملاحظتها في اللوحة كي لا يختارها بلا علم. */
export const FLOW_SECONDS_NOTE: Record<number, string> = {
  4: 'متاحة في كل نماذج Veo 3.1.',
  6: 'متاحة في كل نماذج Veo 3.1.',
  8: 'الحدّ الأقصى لـVeo 3.1 — وكل مقطع بثماني ثوانٍ قابل للتمديد بـExtend.',
  10: 'تحتاج نموذج Gemini Omni Flash 1.1 داخل Flow؛ Veo 3.1 يقف عند الثماني.',
}

/**
 * حركة الكاميرا: قرارٌ مركّب (حامل + اتجاه + إيقاع) بدل «دفع بطيء أو ثبات».
 * تُشتقّ من دور اللقطة وترتيبها فتتنوّع بلا عشوائية.
 */
export function cameraMove(input: { order: number; shotIndex: number; shotCount: number; role: string; look: FlowLook; avatar: boolean }): string {
  const { role, shotIndex, avatar, look } = input
  const hook = /hook|الخطاف/i.test(role)
  const close = /ending|closing|الخاتمة|الدعوة/i.test(role)
  /* الخطاف يفتح بحركةٍ جاذبة، لكن اللقطة التالية داخله لا تعيدها: تكرار الدفع
     ثلاث مرات في مقطعٍ واحد يقتل أثره ويجعل المشهد آلياً. */
  if (hook && shotIndex === 0) {
    return avatar
      ? 'slow dolly push-in on a fixed axis, starting a touch wide and settling on the subject; ease in and ease out, no snap'
      : 'slow crane-down onto the subject, or a deliberate rack focus that lands the eye on the key detail'
  }
  if (close && shotIndex === 0) return 'gentle pull-back on a stabilised dolly, opening breathing room around the subject as the moment resolves'
  if (shotIndex === 0) return look.motionBias
  if (shotIndex === 1) {
    return avatar
      ? 'locked frame with the subject re-composed to a tighter angle; let the performance carry the motion'
      : 'slow lateral track across the same environment, parallel to the main lines'
  }
  return 'settle to a locked frame; end on a stable, composed image with no residual movement'
}

/** كتلة التصوير الكاملة للقطة واحدة — تُحقن في البرومبت. */
export function cinematographyBlock(input: {
  look: FlowLook
  seconds: number
  order: number
  shotCount: number
  role: string
  avatar: boolean
}): string {
  const { look, seconds, shotCount, role, order, avatar } = input
  const moves = Array.from({ length: Math.max(1, shotCount) }, (_, index) =>
    `Shot ${index + 1} camera: ${cameraMove({ order, shotIndex: index, shotCount, role, look, avatar })}.`).join(' ')
  return [
    `Cinematography — lens: ${look.lens}, aperture ${look.aperture}. Depth of field: ${look.depthOfField}.`,
    `Lighting plan: ${look.lighting}.`,
    `Colour grade: ${look.grade}.`,
    `Texture and finish: ${look.texture}.`,
    /* تُفتتح بالعبارة الحارسة نفسها التي يفتّش عنها الفاحص: القاعدة (نيّةٌ واحدة
       لكل لقطة) لم تتغيّر، وإنما صار لها تفصيلٌ تنفيذيٌّ بعدها. */
    `Camera movement: one restrained motion per shot; never combine competing moves. ${moves}`,
    `Frame rate and timing: 24fps cinematic cadence across the full ${seconds} seconds; motion must feel deliberate, never rushed.`,
    'Composition: honour the rule of thirds with intentional negative space; keep the horizon level and verticals true; leave the subject clean headroom.',
  ].join('\n')
}

/** يوزّع اللقطات على أي مدة (لا الثماني وحدها) مع إبقاء الإيقاع طبيعياً. */
export function shotPlanForSeconds(count: 1 | 2 | 3, seconds: number, avatar: boolean): { from: number; to: number; framing: string }[] {
  const total = Math.max(4, seconds)
  const framings: Record<number, string[]> = {
    1: [avatar ? 'calm medium close-up, front-facing' : 'single controlled cinematic composition'],
    2: avatar
      ? ['front medium shot', 'gentle cut to a three-quarter close-up']
      : ['close detail of the symbolic object', 'wider reveal in the same environment'],
    3: avatar
      ? ['brief medium opening shot', 'close three-quarter angle, continuous speech', 'return to a slightly wider front shot']
      : ['close visual hook', 'second angle on the same subject', 'clean wider closing shot'],
  }
  // نِسَبٌ محفوظة من الإيقاع الأصلي لثماني ثوانٍ، مُمَدَّدة على المدة المختارة.
  const ratios: Record<number, number[]> = { 1: [1], 2: [0.525, 0.475], 3: [0.3125, 0.375, 0.3125] }
  const picked = framings[count] || framings[1]
  const share = ratios[count] || ratios[1]
  const plan: { from: number; to: number; framing: string }[] = []
  let cursor = 0
  for (let index = 0; index < picked.length; index += 1) {
    const to = index === picked.length - 1 ? total : Math.round((cursor + total * share[index]) * 10) / 10
    plan.push({ from: cursor, to, framing: picked[index] })
    cursor = to
  }
  return plan
}
