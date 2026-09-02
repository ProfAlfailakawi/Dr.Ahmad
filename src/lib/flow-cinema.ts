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
    motionBias: 'one decisive push-in that closes distance with intent, or a locked frame the action moves through',
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
    motionBias: 'a steady drift-in that keeps closing, or a stabilised float that follows the moment',
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
    motionBias: 'a locked frame with strong movement inside it, or one committed lateral track along the architecture',
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
    motionBias: 'stabilised handheld that breathes with the subject, or an active reframe that chases the action',
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
    motionBias: 'a locked frame where light and motion carry the change, or a continuous push-in',
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
    motionBias: 'a locked frame with period texture alive in it, or one deliberate tilt that reveals',
  },
]

export const DEFAULT_FLOW_LOOK: FlowLookId = 'editorial-daylight'

export const flowLook = (id?: FlowLookId | null): FlowLook =>
  FLOW_LOOKS.find((look) => look.id === id) || FLOW_LOOKS[0]

/**
 * المدد التي يقبلها Flow للتوليدة الواحدة.
 *
 * كان السقف ثماني ثوانٍ (Veo 3.1)، والأطول يُبنى بـExtend. ثم صارت لوحة Flow
 * تعرض ٤ و٦ و٨ و١٠ و١٥ في التوليدة الواحدة (لقطة شاشة من لوحة الدكتور،
 * ٣٠ أغسطس ٢٠٢٦)، فصارت القائمة هنا مطابقةً لها والخمس عشرة هي الافتراض. والقاعدة الحاكمة لم تتغيّر: **الرقم المكتوب في البرومبت يجب أن
 * يساوي ما تختاره في Flow فعلاً** — رقمٌ فوق ما يقبله النموذج المختار لا يطيل
 * المقطع، وإنما يفسد توقيت اللقطات لأن المحرّك يضغط خطةً لخمس عشرة في ثمانٍ.
 * فإن كان النموذج المختار في لوحتك يقف عند الثماني، اختر الثماني هنا.
 */
export const FLOW_CLIP_SECONDS = [4, 6, 8, 10, 15] as const
export type FlowClipSeconds = (typeof FLOW_CLIP_SECONDS)[number]

/** أطول مقطعٍ في توليدةٍ واحدة؛ هو الافتراض لأنه يقلّل عدد المقاطع ويطيل النَّفَس. */
export const DEFAULT_FLOW_CLIP_SECONDS = 15

/** ملاحظةٌ تحت كل مدة كي لا تُختار بلا علم. */
export const FLOW_SECONDS_NOTE: Record<number, string> = {
  4: 'ومضة واحدة: صورة واحدة وحدث واحد. تصلح للاقتباس لا للشرح.',
  6: 'مدة قصيرة مركّزة؛ حركة واحدة تكتمل بلا حشو.',
  8: 'الحدّ القديم لـVeo 3.1. اخترها إن كان النموذج في لوحتك يقف عندها.',
  10: 'مدة وسطى؛ تصلح حين تريد نَفَساً أطول من الثماني بلا الالتزام بخمس عشرة.',
  15: 'الافتراضي: أطول توليدة في المرة الواحدة. مقاطع أقل لنفس الطول، ونَفَسٌ يكفي لحدثٍ يبدأ ويتطوّر وينتهي داخل المقطع الواحد — لا لقطةٍ ممطوطة.',
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
      ? 'committed dolly push-in on a fixed axis that closes distance decisively, starting a touch wide and landing on the subject; ease in and ease out, no snap'
      : 'committed crane-down that lands on the subject exactly as the event peaks, closing distance with intent'
  }
  if (close && shotIndex === 0) return 'gentle pull-back on a stabilised dolly, opening breathing room around the subject as the moment resolves'
  if (shotIndex === 0) return look.motionBias
  if (shotIndex === 1) {
    return avatar
      ? 'locked frame with the subject re-composed to a tighter angle; let the performance carry the motion'
      : 'lateral track across the same environment, moving with the action and parallel to the main lines'
  }
  return 'settle to a locked frame as the action completes; the motion resolves inside the frame rather than stopping dead'
}

/**
 * كتلة التصوير للريل — لغةٌ حركية لا هادئة.
 *
 * العلّة (٢٩ أغسطس ٢٠٢٦، بحكم عين الدكتور على أول فيديو): الكتلة التحريرية
 * تكرّر «هادئ · مكبوح · بطيء · ناعم» لأنها هوية الموقع، فأنتجت على إنستغرام
 * بطاقةً بريديةً متحركة: أربعةَ عشرَ ثانيةً بلا حدث. والريل قانونه معاكس —
 * الحدث يبدأ قبل أن يقرّر الإبهام التمرير، والسكون موتٌ لا وقار.
 */
export function reelCinematographyBlock(input: { look: FlowLook; seconds: number }): string {
  const { look, seconds } = input
  return [
    `Cinematography — lens: ${look.lens}, aperture ${look.aperture}. Depth of field: ${look.depthOfField}.`,
    `Lighting plan: ${look.lighting}.`,
    `Colour grade: ${look.grade}.`,
    `Texture and finish: ${look.texture}.`,
    // القاعدة الأولى: لا إطارَ ساكنٍ في البداية.
    'OPENING RULE — the very first frame is already mid-event: the transformation is visibly underway before the viewer can scroll. Never open on a still, settled, or establishing frame.',
    `Pacing: the single transformation runs across the whole ${seconds} seconds with visible, continuous change — something is different in every second. No idling, no held beauty shots, no waiting.`,
    'Camera: one committed move that serves the event — push, track, crane, orbit, or rack focus — executed with intent, not drift. Motion may be brisk; it must never be shaky, random, or aimless.',
    'Energy: kinetic and arresting. Physical forces are visible — weight, momentum, collapse, spill, growth, fracture. The frame should feel alive, not composed and still.',
    'Composition: honour the rule of thirds with intentional negative space for the caption; keep verticals true; fill the 9:16 frame edge to edge.',
  ].join('\n')
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
  /* المقطع الطويل (خمس عشرة ثانية) ينهار إلى لقطةٍ ممطوطة إن لم يُعطَ بناءً
     داخلياً. الثلث الأول يفتح الحدث، والأوسط يطوّره، والأخير يحسمه. */
  const beats = seconds >= 12
    ? `Internal structure for a long clip: first third — the event is already underway and the viewer understands the situation. Middle third — the situation visibly develops or complicates; something changes state, not just position. Final third — it resolves into one held, readable image. Each third must look different from the one before it.`
    : `Internal structure: one single development that begins, deepens and lands inside the ${seconds} seconds.`
  return [
    `Cinematography — lens: ${look.lens}, aperture ${look.aperture}. Depth of field: ${look.depthOfField}.`,
    `Lighting plan: ${look.lighting}.`,
    `Colour grade: ${look.grade}.`,
    `Texture and finish: ${look.texture}.`,
    /* العلّة التي حكم عليها الدكتور (٣٠ أغسطس ٢٠٢٦): «ما زال غير جميل وغير
       مشوّق». اللغة هنا كانت «متأنّية، غير متعجّلة» فأنتجت بطاقةً بريديةً
       متحركة. قانون الريل مطبَّقٌ في ملفٍ مجاور منذ يوم، ولم يكن مطبقاً هنا.
       يُنقل الآن: أول إطارٍ داخل الحدث، وتغيُّرٌ مرئيٌّ في كل ثانية. */
    'OPENING RULE — the very first frame is already mid-event. Something is already moving, changing, falling, opening, pouring, igniting, or being decided at frame one. Never open on a still, settled, or establishing frame, and never open on someone about to begin.',
    `Pacing: visible continuous change across the whole ${seconds} seconds — something in the frame is measurably different in every single second. No idling, no held beauty shots, no waiting for the line to finish.`,
    beats,
    avatar
      ? 'Energy: alive but composed — the camera, the travelling light and the responsive environment carry the motion while the speaker stays natural and unhurried; never frozen, never chaotic, never gesturing theatrically.'
      : 'Energy: cinematic and arresting rather than calm and composed. Physical forces must be visible — weight, momentum, light travelling, material yielding, distance closing. Beauty here comes from motion and light, never from stillness.',
    `Camera movement: one committed motion per shot, executed with intent and carried to completion; never combine competing moves and never let the frame drift aimlessly. Motion may be brisk and confident; it must never be shaky, random, or handheld-nervous. ${moves}`,
    `Frame rate and timing: 24fps cinematic cadence across the full ${seconds} seconds. Deliberate, never sluggish.`,
    'Composition: honour the rule of thirds with intentional negative space for the caption added later; keep the horizon level and verticals true; fill the 9:16 frame edge to edge and leave the subject clean headroom.',
    'Production value: this must read as a funded commercial or festival short — depth in the frame with a clear foreground, midground and background, atmosphere in the light path, and materials that respond to it. Never a stock-footage look, never a screensaver, never a moving postcard.',
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
