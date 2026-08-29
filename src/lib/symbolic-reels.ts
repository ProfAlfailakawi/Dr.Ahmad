/**
 * مصنع الريلز الرمزية — مشاهد سينمائية قصيرة لإنستغرام، لا فيديو شرح.
 *
 * الفكرة (٢٩ أغسطس ٢٠٢٦): ما يوقف السكرول ليس أفتاراً يشرح، بل مشهدٌ رمزيٌّ
 * مدهش — ساعة رملية تمتلئ بأحذية ركض، بابٌ يُفتح على مكتبة لا نهائية — وفوقه
 * جملة الدكتور نفسها. الفكرة العميقة × الصورة المدهشة × خمس عشرة ثانية.
 *
 * المصنع حتميٌّ بلا نموذج لغوي: يطابق فكرة الدكتور مع مكتبة مشاهد مكتوبة
 * بعناية، ويخرج ثلاثة إلى خمسة مفاهيم مختلفة جذرياً، لكلٍّ برومبت Flow سينمائي
 * كامل (يرث العدسة والإضاءة من flow-cinema) ونصّ التركيب والكابشن. التوليد
 * يدوي داخل حساب Flow المدفوع؛ لا API ولا كلفة زائر.
 *
 * الملف نقيّ (يستورد flow-cinema وحدها) فيُختبر تحت node مباشرة.
 */
import { flowLook, reelCinematographyBlock, type FlowLookId } from './flow-cinema.ts'

export type SymbolicScene = {
  id: string
  labelAr: string
  /** وصف عربي قصير يقرأه الدكتور في اللوحة. */
  sceneAr: string
  /** المشهد بالإنجليزية — التفصيل الذي يفهمه Flow. */
  sceneEn: string
  /** قوس الحركة: يبدأ… وينتهي… (البنية الدرامية للثواني). */
  arcEn: { start: string; end: string }
  /** الفصل الثاني: ما يحدث في التمديد (+٧ ثوانٍ) — يكمل الاستعارة ولا يعيدها. */
  extendEn: string
  /** الكلمات التي تجذب هذا المشهد إلى فكرةٍ ما. */
  themes: RegExp
  lookId: FlowLookId
  coverIdeaAr: string
}

/* اثنتا عشرة استعارة، كلٌّ منها فيلمٌ قصيرٌ قائمٌ بذاته لا أيقونة. */
export const SYMBOLIC_SCENES: SymbolicScene[] = [
  {
    id: 'hourglass-shoes',
    labelAr: 'الساعة الرملية',
    sceneAr: 'ساعة رملية ضخمة تمتلئ حباتها بأحذية ركض مصغّرة تتساقط بلا توقف.',
    sceneEn: 'A tall hourglass on dark wet stone floods with miniature running shoes instead of sand; they pour through the narrow neck in a relentless torrent, hammering into a restless heap that keeps climbing',
    arcEn: { start: 'shoes already blasting through the neck in extreme macro, glass ringing', end: 'the camera rips back to reveal the whole hourglass as the heap surges past the frame' },
    extendEn: 'the heap of shoes overflows the lower bulb and buries the base; the glass fractures under the weight and the torrent keeps pouring through the crack',
    themes: /وقت|ركض|انشغال|سرعة|إرهاق|التزام|هروب|عجلة/,
    lookId: 'night-desk',
    coverIdeaAr: 'الساعة الرملية بعالم «مكتب ليلي» وجملة الفكرة تحتها',
  },
  {
    id: 'door-library',
    labelAr: 'باب المكتبة',
    sceneAr: 'باب خشبي قديم يُفتح ببطء على مكتبة لا نهائية تمتد في الضباب.',
    sceneEn: 'An old wooden door bursts open under its own pressure, spilling warm light and a rush of loose pages into a plain corridor; beyond it an impossible infinite library recedes into mist, shelves rushing past as the camera surges through',
    arcEn: { start: 'the door already swinging wide, pages exploding outward past the lens', end: 'the camera racing down the endless shelves as light strobes between them' },
    extendEn: 'the camera bursts out the far end of the library into open sky, shelves peeling away behind it as loose pages spiral upward',
    themes: /معرفة|كتاب|قراءة|تعلم|سؤال|باب|بداية|فضول/,
    lookId: 'golden-study',
    coverIdeaAr: 'الباب المفتوح على الرفوف بعالم «ساعة ذهبية»',
  },
  {
    id: 'ink-question',
    labelAr: 'حبر السؤال',
    sceneAr: 'قطرة حبر تسقط في ماء صافٍ وتتشكّل غيمتها ببطء على هيئة علامة استفهام.',
    sceneEn: 'Deep blue ink detonates through clear water in high-speed macro, tendrils lashing outward and recoiling until the churn resolves into the unmistakable curl of a question mark',
    arcEn: { start: 'the ink already erupting mid-frame, filling the glass in violent plumes', end: 'the churning tendrils snap into the question-mark curl at the last instant' },
    extendEn: 'the question-mark curl unravels into a second violent bloom that resolves, at the last instant, into an exclamation of clear water pushing the ink aside',
    themes: /سؤال|تفكير|فلسفة|عقل|حيرة|تأمل|شك/,
    lookId: 'quiet-architecture',
    coverIdeaAr: 'غيمة الحبر بعالم «معماري هادئ» والسؤال فوقها',
  },
  {
    id: 'mirror-crowd',
    labelAr: 'مرآة الجموع',
    sceneAr: 'شخص واحد يقف أمام مرآة، وانعكاسه جمعٌ كامل يمشي في اتجاه واحد.',
    sceneEn: 'A lone anonymous figure seen from behind faces a tall mirror; the reflection shows not one person but a dense crowd all walking the same direction',
    arcEn: { start: 'the reflected crowd is already surging forward while the lone figure stands frozen', end: 'the camera drives past the shoulder until the marching crowd floods the entire frame' },
    extendEn: 'the mirror cracks under the marching crowd and the lone figure steps through the break, walking against them as they part',
    themes: /مجتمع|قطيع|رأي|تقليد|هوية|ذات|جمهور|ضغط/,
    lookId: 'documentary-honest',
    coverIdeaAr: 'المرآة والجمع بعالم «وثائقي صادق»',
  },
  {
    id: 'seed-concrete',
    labelAr: 'نبتة الإسمنت',
    sceneAr: 'نبتة خضراء صغيرة تشقّ إسمنتاً رمادياً وتنمو في تسريع زمني.',
    sceneEn: 'Concrete splits with a violent crack as a green seedling drives through it in aggressive timelapse; the fracture races outward like lightning while the plant whips upward toward hard light',
    arcEn: { start: 'the concrete already splitting, dust bursting upward in macro', end: 'the fracture tears across the whole frame as the plant snaps open its leaves' },
    extendEn: 'the fracture races beyond the frame and a whole field of seedlings erupts through the shattered slab in accelerating timelapse',
    themes: /أمل|نمو|صبر|تربية|طفل|تغيير|بداية|إصرار/,
    lookId: 'editorial-daylight',
    coverIdeaAr: 'النبتة الشاقة للإسمنت بعالم «نهار تحريري»',
  },
  {
    id: 'chalk-galaxy',
    labelAr: 'مجرّة الطباشير',
    sceneAr: 'سبورة سوداء تتحوّل خربشات الطباشير عليها إلى مجرّة تدور ببطء.',
    sceneEn: 'Chalk dust rips off a blackboard covered in equations and spirals into a turning galaxy of glowing particles that swallows the room',
    arcEn: { start: 'the dust already tearing off the board in a rising vortex', end: 'the galaxy spins wide and one blazing particle rushes straight at the lens' },
    extendEn: 'the galaxy collapses inward and slams back onto the board as a single new equation written in blazing chalk dust',
    themes: /تعليم|مدرسة|معلم|صف|درس|علم|خيال/,
    lookId: 'night-desk',
    coverIdeaAr: 'مجرة الطباشير فوق السبورة بعالم «مكتب ليلي»',
  },
  {
    id: 'paper-boat-storm',
    labelAr: 'قارب الورق',
    sceneAr: 'قارب ورقي صغير يشقّ بحراً حقيقياً هائجاً ولا يغرق.',
    sceneEn: 'A small folded paper boat rides real stormy sea waves at dusk; it tilts, takes spray, and keeps moving forward improbably intact',
    arcEn: { start: 'the boat already launching off a breaking crest, spray exploding around it', end: 'the camera pulls back hard as the tiny boat drives on into a vast black sea' },
    extendEn: 'a wave swallows the paper boat completely, then it surges back up on the far side, soaked but unfolding into a larger sail',
    themes: /شجاعة|أزمة|صمود|خوف|مواجهة|تحدي|ثبات/,
    lookId: 'documentary-honest',
    coverIdeaAr: 'القارب في البحر بعالم «وثائقي صادق»',
  },
  {
    id: 'clock-roots',
    labelAr: 'جذور الساعة',
    sceneAr: 'ساعة جدارية قديمة تنبت من خلفها جذور شجرة تلتفّ على الجدار.',
    sceneEn: 'Living roots burst from behind an old wall clock and race across faded plaster in fast timelapse, cracking the surface as the hands spin faster and faster',
    arcEn: { start: 'roots already bursting out behind the clock, plaster flaking off', end: 'the whole wall overrun and fracturing while the hands spin wildly' },
    extendEn: 'the roots tear the clock off the wall and lift it upward, hands still spinning, as the plaster crumbles into a rising cloud',
    themes: /عادة|زمن|جذور|تراث|ذاكرة|ماضي|أصالة/,
    lookId: 'archival-grain',
    coverIdeaAr: 'الساعة والجذور بعالم «أرشيفي حبيبي»',
  },
  {
    id: 'staircase-books',
    labelAr: 'درج الكتب',
    sceneAr: 'درج حلزوني مبني من كتب متراصّة يصعد نحو ضوء علوي.',
    sceneEn: 'A spiral staircase built of stacked books climbs through darkness while pages tear loose and storm upward around it toward a blazing skylight',
    arcEn: { start: 'pages already streaming upward past the lens from the lowest step', end: 'the camera rockets up the spiral and bursts into the light' },
    extendEn: 'the staircase of books unspools into a rushing river of pages that carries the camera up and out through the skylight',
    themes: /طموح|هدف|تدرج|مسار|نجاح|صعود|اجتهاد/,
    lookId: 'golden-study',
    coverIdeaAr: 'الدرج الحلزوني بعالم «ساعة ذهبية»',
  },
  {
    id: 'compass-hands',
    labelAr: 'بوصلة الحيرة',
    sceneAr: 'بوصلة نحاسية في كفّ مفتوحة، إبرتها تدور بجنون ثم تستقرّ فجأة.',
    sceneEn: 'A brass compass held in an open anonymous palm; the needle spins wildly, blurring, then snaps still, pointing off-frame with total certainty',
    arcEn: { start: 'the needle already whipping around in a blur, reflections strobing', end: 'the needle slams to a stop and the hand snaps shut around the compass' },
    extendEn: 'the hand opens and the compass lifts free, needle locked, dragging the whole frame around to face the direction it points',
    themes: /قرار|اختيار|اتجاه|حيرة|بوصلة|مبدأ|قيم/,
    lookId: 'night-desk',
    coverIdeaAr: 'البوصلة في الكف بعالم «مكتب ليلي»',
  },
  {
    id: 'window-two-weathers',
    labelAr: 'نافذة الحالين',
    sceneAr: 'نافذة واحدة نصفها مطر ونصفها شمس، والخط الفاصل يتحرّك ببطء.',
    sceneEn: 'One window seen from inside: driving rain hammers the left half while hard sunshine burns the right, and the dividing line sweeps across the glass',
    arcEn: { start: 'rain lashing the glass, the light line already tearing across it', end: 'sun floods the frame as the last raindrops blast off the pane' },
    extendEn: 'the dividing line accelerates past the frame and the glass shatters outward into both weathers at once, rain and sunlight colliding mid-air',
    themes: /تفاؤل|نظرة|زاوية|منظور|حكم|تحول|مزاج/,
    lookId: 'editorial-daylight',
    coverIdeaAr: 'النافذة المنقسمة بعالم «نهار تحريري»',
  },
  {
    id: 'origami-flock',
    labelAr: 'سرب الورق',
    sceneAr: 'ورقة على مكتب تطوي نفسها طائراً، ثم تنضمّ لسربٍ يملأ السماء.',
    sceneEn: 'A sheet of paper on a desk snaps itself into an origami bird and launches off the surface; beyond the window a whole flock of paper birds tears across the sky',
    arcEn: { start: 'the paper already folding itself in violent snaps, edges cracking', end: 'the bird bursts through the window into hundreds of white wings against dusk' },
    extendEn: 'the flock wheels as one and dives back through the window, folding the room itself into paper as it passes',
    themes: /فكرة|إبداع|كتابة|نشر|أثر|انتشار|رسالة/,
    lookId: 'golden-study',
    coverIdeaAr: 'سرب الطيور الورقية بعالم «ساعة ذهبية»',
  },
  {
    id: 'lantern-fog',
    labelAr: 'فانوس الضباب',
    sceneAr: 'فانوس واحد مضيء في ضباب كثيف، وحوله تظهر ملامح طريق لم تكن تُرى.',
    sceneEn: 'A lantern flares hard inside dense fog and its light punches outward in expanding waves, tearing a long path and black trees out of the void as the fog recoils',
    arcEn: { start: 'the flame already surging, fog boiling away from it', end: 'the path rips open ahead as the light drives the fog back to the edges' },
    extendEn: 'the lantern flares to a blinding pulse and the fog is blown clear in one shockwave, revealing the full length of the path and everything that was hidden beside it',
    themes: /علم|هداية|وضوح|جهل|ظلام|نور|بحث/,
    lookId: 'night-desk',
    coverIdeaAr: 'الفانوس في الضباب بعالم «مكتب ليلي»',
  },
]

export type ReelConcept = {
  scene: SymbolicScene
  seconds: number
  /** برومبت Flow كامل — إنجليزي خالص، بلا أفتار وبلا نص مولّد. */
  flowPrompt: string
  /** نصّ التركيب: جملة الدكتور تُضاف بعد التوليد لا داخله. */
  overlay: { text: string; from: number; to: number; positionAr: string }
  /** برومبت التمديد: يُلصق في Extend داخل Flow فيضيف سبع ثوانٍ متصلة. */
  extendPrompt: string
  captionAr: string
  hashtags: string[]
}

/** كل تمديد في Flow يضيف سبع ثوانٍ — رقمٌ موثّق لا تقدير. */
export const FLOW_EXTEND_SECONDS = 7

const stableHash = (seed: string) => {
  let hash = 2166136261
  for (const character of seed) { hash ^= character.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g

/**
 * برومبت الريل من أي مشهد — مكتبيٍّ كان أو مبتكَراً.
 * مصدرٌ واحد لبناء البرومبت كي لا ينحرف المسارَان.
 */
/**
 * برومبت التمديد — يُلصق في خانة Extend داخل Flow.
 *
 * التمديد ليس توليدةً جديدة: Flow يكمل من الإطار الأخير، فالبرومبت يجب أن
 * يبدأ من حيث انتهى المقطع ويصعد بالاستعارة فصلاً ثانياً — لا أن يعيد وصف
 * المشهد من أوله فيقطع الاستمرارية أو يعيد ما رآه المشاهد.
 */
export function reelExtendPrompt(scene: Pick<SymbolicScene, 'sceneEn' | 'arcEn' | 'extendEn' | 'lookId'>): string {
  const look = flowLook(scene.lookId)
  return [
    `CONTINUATION — continue directly from the final frame of the previous clip. Same world, same subject, same ${look.grade.split(',')[0]} grade, same lens character and light direction. Do not restart, re-establish, or re-introduce the scene.`,
    `Where the previous clip ended: ${scene.arcEn.end}.`,
    `What happens next: ${scene.extendEn}.`,
    `Duration: exactly ${FLOW_EXTEND_SECONDS} seconds — Flow adds seven seconds per extend, not eight.`,
    'ESCALATION RULE — this beat must raise the stakes of the metaphor, never repeat or merely prolong the first beat. Something breaks, spreads, reverses, or is revealed.',
    'Motion: continuous and kinetic from the first frame; no pause, no settling, no re-framing beat between the clips.',
    'VISIBLE-TEXT RULE — generate absolutely no on-screen text of any kind in any language.',
    'Negative constraints: scene reset, new location, different subject, cut to black, cartoon style, visible writing, subtitles, watermarks.',
  ].join('\n').replace(ARABIC, '').replace(/\s{2,}/g, ' ').replace(/ \n/g, '\n')
}

export function reelPromptFromScene(scene: { sceneEn: string; arcStartEn: string; arcEndEn: string; lookId?: FlowLookId }, seconds: number): string {
  return reelPrompt({
    sceneEn: scene.sceneEn,
    arcEn: { start: scene.arcStartEn, end: scene.arcEndEn },
    lookId: scene.lookId || 'editorial-daylight',
  } as SymbolicScene, seconds)
}

/**
 * البرومبت على صيغة Google الرسمية لـVeo:
 * [التصوير] + [الموضوع] + [الفعل] + [السياق] + [الأسلوب والأجواء].
 *
 * العلّة التي صحّحها الدكتور (٢٩ أغسطس ٢٠٢٦): كان البرومبت مقلوب النسبة —
 * عشرةَ أسطرٍ قواعدَ وممنوعات وسطرين وصفاً. والنموذج يرسم ما تصفه لا ما تمنعه،
 * فالكثرة في المنع تُميّع انتباهه وتضيع الصورة. فصار الوصف الحسّي أولاً وأطول،
 * والقيود ذيلاً واحداً مضغوطاً.
 */
function reelPrompt(scene: Pick<SymbolicScene, 'sceneEn' | 'arcEn' | 'lookId'>, seconds: number): string {
  const look = flowLook(scene.lookId)
  const lines = [
    // ١) التصوير أولاً — أقوى أداة في نقل النبرة حسب دليل Veo.
    `Vertical 9:16 cinematic film, ${seconds} seconds, single continuous take. Shot on a ${look.lens} at ${look.aperture}; ${look.depthOfField}. The camera commits to one decisive move — it pushes, tracks, or rips back with the action, never drifting and never idle.`,
    // ٢+٣) الموضوع والفعل — الصورة نفسها، مفصّلة ومتحرّكة.
    `${scene.sceneEn}. The clip opens already inside the event: ${scene.arcEn.start}. It builds without pause until ${scene.arcEn.end}.`,
    // ٤) السياق الحسّي — التفاصيل الصغيرة هي مصدر الجمال.
    'Physics carry the meaning: real weight, real momentum, real consequence. Show the small truths — dust lifting in the light, moisture beading, particles scattering, surfaces catching and losing reflection, edges trembling under force. Every second looks different from the one before it.',
    // ٥) الأسلوب والأجواء.
    `Lighting: ${look.lighting}. Colour: ${look.grade}. Texture: ${look.texture}. Photoreal and tactile throughout, never illustrative or synthetic.`,
    'Composition: the strangest, most impossible-looking instant is visible within the first second, framed off-centre with clean negative space kept clear for a caption added later.',
    'Sound: rich natural environmental sound only — no music, no voice-over, no dialogue.',
    // الذيل: كل الممنوعات في سطرٍ واحد بدل خمسة.
    'Constraints: no on-screen text, letters, numbers, captions, logos or watermarks in any language; no presenter, no talking, no recognizable face — any human presence stays anonymous through hands or silhouette; no cartoon or plastic CGI look, no oversaturated colour, no morphing artifacts, no extra limbs, no unmotivated lens flares.',
  ]
  return lines.join('\n').replace(ARABIC, '').replace(/\s{2,}/g, ' ').replace(/ \n/g, '\n')
}

function hashtagsFor(idea: string): string[] {
  const words = idea.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((word) => word.length >= 4)
  const picked = [...new Set(words)].slice(0, 3).map((word) => `#${word.replace(/\s/g, '_')}`)
  return [...picked, '#تعليم', '#تطوير_الذات', '#فكر']
}

export function forgeSymbolicReels(input: {
  /** الفكرة أو الموضوع بكلمات الدكتور. */
  idea: string
  /** الجملة التي ستُركّب فوق الفيديو؛ إن غابت تُستعمل الفكرة نفسها. */
  sentence?: string
  seconds?: number
  count?: number
}): ReelConcept[] {
  const idea = (input.idea || '').trim()
  const sentence = (input.sentence || '').trim() || idea
  const seconds = input.seconds && input.seconds >= 4 ? Math.round(input.seconds) : 8
  const count = Math.min(5, Math.max(3, input.count || 4))
  const corpus = `${idea} ${sentence}`

  /* الترتيب: المشاهد التي تلامس الفكرة أولاً، ثم كسر التعادل ببصمة ثابتة —
     فنفس الفكرة تعطي نفس المفاهيم دائماً، وفكرة أخرى تعطي طيفاً آخر. */
  const ranked = [...SYMBOLIC_SCENES].sort((a, b) => {
    const scoreA = a.themes.test(corpus) ? 1 : 0
    const scoreB = b.themes.test(corpus) ? 1 : 0
    return scoreB - scoreA || (stableHash(idea + b.id) - stableHash(idea + a.id))
  })

  return ranked.slice(0, count).map((scene) => ({
    scene,
    seconds,
    flowPrompt: reelPrompt(scene, seconds),
    extendPrompt: reelExtendPrompt(scene),
    overlay: {
      text: sentence,
      from: Math.min(1, seconds * 0.12),
      to: Math.max(seconds - 0.6, seconds * 0.85),
      positionAr: 'الثلث السفلي، بخط الهوية',
    },
    captionAr: `${sentence}\n\nما الذي يقوله لك هذا المشهد؟`,
    hashtags: hashtagsFor(idea),
  }))
}
