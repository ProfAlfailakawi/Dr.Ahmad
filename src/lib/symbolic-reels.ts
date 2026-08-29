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
import { cinematographyBlock, flowLook, type FlowLookId } from './flow-cinema.ts'

export type SymbolicScene = {
  id: string
  labelAr: string
  /** وصف عربي قصير يقرأه الدكتور في اللوحة. */
  sceneAr: string
  /** المشهد بالإنجليزية — التفصيل الذي يفهمه Flow. */
  sceneEn: string
  /** قوس الحركة: يبدأ… وينتهي… (البنية الدرامية للثواني). */
  arcEn: { start: string; end: string }
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
    sceneEn: 'A large elegant hourglass on a dark reflective surface; instead of sand, miniature running shoes pour down grain by grain, piling up in the lower bulb',
    arcEn: { start: 'a single tiny shoe falls in extreme close-up macro', end: 'the camera reveals the full hourglass as the pile keeps growing, relentless' },
    themes: /وقت|ركض|انشغال|سرعة|إرهاق|التزام|هروب|عجلة/,
    lookId: 'night-desk',
    coverIdeaAr: 'الساعة الرملية بعالم «مكتب ليلي» وجملة الفكرة تحتها',
  },
  {
    id: 'door-library',
    labelAr: 'باب المكتبة',
    sceneAr: 'باب خشبي قديم يُفتح ببطء على مكتبة لا نهائية تمتد في الضباب.',
    sceneEn: 'An old wooden door in a plain wall opens slowly to reveal an impossible infinite library, shelves receding into soft mist and warm light',
    arcEn: { start: 'closed door, a strip of warm light under it', end: 'the door fully open, the endless shelves breathing with dust motes in light shafts' },
    themes: /معرفة|كتاب|قراءة|تعلم|سؤال|باب|بداية|فضول/,
    lookId: 'golden-study',
    coverIdeaAr: 'الباب المفتوح على الرفوف بعالم «ساعة ذهبية»',
  },
  {
    id: 'ink-question',
    labelAr: 'حبر السؤال',
    sceneAr: 'قطرة حبر تسقط في ماء صافٍ وتتشكّل غيمتها ببطء على هيئة علامة استفهام.',
    sceneEn: 'A single drop of deep blue ink falls into a glass of clear water; the ink blooms in slow motion and its cloud curls into the suggestion of a question mark',
    arcEn: { start: 'the drop hangs, then falls in extreme slow motion', end: 'the ink cloud settles, holding the question shape for a beat before dissolving' },
    themes: /سؤال|تفكير|فلسفة|عقل|حيرة|تأمل|شك/,
    lookId: 'quiet-architecture',
    coverIdeaAr: 'غيمة الحبر بعالم «معماري هادئ» والسؤال فوقها',
  },
  {
    id: 'mirror-crowd',
    labelAr: 'مرآة الجموع',
    sceneAr: 'شخص واحد يقف أمام مرآة، وانعكاسه جمعٌ كامل يمشي في اتجاه واحد.',
    sceneEn: 'A lone anonymous figure seen from behind faces a tall mirror; the reflection shows not one person but a dense crowd all walking the same direction',
    arcEn: { start: 'the figure raises their head toward the mirror', end: 'slow push past the shoulder into the reflected crowd until it fills the frame' },
    themes: /مجتمع|قطيع|رأي|تقليد|هوية|ذات|جمهور|ضغط/,
    lookId: 'documentary-honest',
    coverIdeaAr: 'المرآة والجمع بعالم «وثائقي صادق»',
  },
  {
    id: 'seed-concrete',
    labelAr: 'نبتة الإسمنت',
    sceneAr: 'نبتة خضراء صغيرة تشقّ إسمنتاً رمادياً وتنمو في تسريع زمني.',
    sceneEn: 'A tiny green seedling cracks through grey concrete in a timelapse; the crack spreads like a slow lightning bolt as the plant unfurls toward light',
    arcEn: { start: 'macro on the hairline crack, dust trembling', end: 'the young plant standing in hard light, the crack now a river across the frame' },
    themes: /أمل|نمو|صبر|تربية|طفل|تغيير|بداية|إصرار/,
    lookId: 'editorial-daylight',
    coverIdeaAr: 'النبتة الشاقة للإسمنت بعالم «نهار تحريري»',
  },
  {
    id: 'chalk-galaxy',
    labelAr: 'مجرّة الطباشير',
    sceneAr: 'سبورة سوداء تتحوّل خربشات الطباشير عليها إلى مجرّة تدور ببطء.',
    sceneEn: 'A classroom chalkboard covered in equations; the chalk dust lifts off the board and swirls into a slowly rotating galaxy of glowing particles',
    arcEn: { start: 'a hand wipes the board, dust rises', end: 'the dust galaxy turns above the empty board, one bright particle drifting toward the lens' },
    themes: /تعليم|مدرسة|معلم|صف|درس|علم|خيال/,
    lookId: 'night-desk',
    coverIdeaAr: 'مجرة الطباشير فوق السبورة بعالم «مكتب ليلي»',
  },
  {
    id: 'paper-boat-storm',
    labelAr: 'قارب الورق',
    sceneAr: 'قارب ورقي صغير يشقّ بحراً حقيقياً هائجاً ولا يغرق.',
    sceneEn: 'A small folded paper boat rides real stormy sea waves at dusk; it tilts, takes spray, and keeps moving forward improbably intact',
    arcEn: { start: 'the boat crests a wave in close-up, water beading on paper', end: 'wide shot: the tiny white boat still moving against the vast dark sea' },
    themes: /شجاعة|أزمة|صمود|خوف|مواجهة|تحدي|ثبات/,
    lookId: 'documentary-honest',
    coverIdeaAr: 'القارب في البحر بعالم «وثائقي صادق»',
  },
  {
    id: 'clock-roots',
    labelAr: 'جذور الساعة',
    sceneAr: 'ساعة جدارية قديمة تنبت من خلفها جذور شجرة تلتفّ على الجدار.',
    sceneEn: 'An old wall clock on faded plaster; living tree roots grow out from behind it in timelapse, wrapping the wall as the hands keep turning',
    arcEn: { start: 'tick by tick, a hairline root creeps from behind the clock', end: 'the wall veined with roots, the clock still ticking at the center' },
    themes: /عادة|زمن|جذور|تراث|ذاكرة|ماضي|أصالة/,
    lookId: 'archival-grain',
    coverIdeaAr: 'الساعة والجذور بعالم «أرشيفي حبيبي»',
  },
  {
    id: 'staircase-books',
    labelAr: 'درج الكتب',
    sceneAr: 'درج حلزوني مبني من كتب متراصّة يصعد نحو ضوء علوي.',
    sceneEn: 'A spiral staircase built entirely of stacked books rises through darkness toward a soft skylight; pages flutter gently as if breathing',
    arcEn: { start: 'looking up the spiral from the lowest step', end: 'slow crane up along the spine of the staircase into the light' },
    themes: /طموح|هدف|تدرج|مسار|نجاح|صعود|اجتهاد/,
    lookId: 'golden-study',
    coverIdeaAr: 'الدرج الحلزوني بعالم «ساعة ذهبية»',
  },
  {
    id: 'compass-hands',
    labelAr: 'بوصلة الحيرة',
    sceneAr: 'بوصلة نحاسية في كفّ مفتوحة، إبرتها تدور بجنون ثم تستقرّ فجأة.',
    sceneEn: 'A brass compass held in an open anonymous palm; the needle spins wildly, blurring, then snaps still, pointing off-frame with total certainty',
    arcEn: { start: 'macro on the spinning needle, reflections racing', end: 'the needle locked, the hand slowly closing around the compass' },
    themes: /قرار|اختيار|اتجاه|حيرة|بوصلة|مبدأ|قيم/,
    lookId: 'night-desk',
    coverIdeaAr: 'البوصلة في الكف بعالم «مكتب ليلي»',
  },
  {
    id: 'window-two-weathers',
    labelAr: 'نافذة الحالين',
    sceneAr: 'نافذة واحدة نصفها مطر ونصفها شمس، والخط الفاصل يتحرّك ببطء.',
    sceneEn: 'One window seen from inside: the left half shows rain streaking, the right half warm sunshine; the dividing line drifts slowly across the glass',
    arcEn: { start: 'rain dominates, a sliver of gold at the edge', end: 'the sun side has claimed most of the glass, last raindrops glittering' },
    themes: /تفاؤل|نظرة|زاوية|منظور|حكم|تحول|مزاج/,
    lookId: 'editorial-daylight',
    coverIdeaAr: 'النافذة المنقسمة بعالم «نهار تحريري»',
  },
  {
    id: 'origami-flock',
    labelAr: 'سرب الورق',
    sceneAr: 'ورقة على مكتب تطوي نفسها طائراً، ثم تنضمّ لسربٍ يملأ السماء.',
    sceneEn: 'A single sheet of paper on a desk folds itself into an origami bird and lifts off; through the window a whole flock of paper birds crosses the sky',
    arcEn: { start: 'the first crease forms by itself, paper trembling', end: 'the bird joins the flock, hundreds of white wings against dusk' },
    themes: /فكرة|إبداع|كتابة|نشر|أثر|انتشار|رسالة/,
    lookId: 'golden-study',
    coverIdeaAr: 'سرب الطيور الورقية بعالم «ساعة ذهبية»',
  },
  {
    id: 'lantern-fog',
    labelAr: 'فانوس الضباب',
    sceneAr: 'فانوس واحد مضيء في ضباب كثيف، وحوله تظهر ملامح طريق لم تكن تُرى.',
    sceneEn: 'A single warm lantern glows inside dense fog; as it brightens, the faint outline of a long path and trees emerges from the nothing around it',
    arcEn: { start: 'only the flame exists in a grey void', end: 'the path revealed, fading into the fog where the light ends' },
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
  captionAr: string
  hashtags: string[]
}

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
export function reelPromptFromScene(scene: { sceneEn: string; arcStartEn: string; arcEndEn: string; lookId?: FlowLookId }, seconds: number): string {
  return reelPrompt({
    sceneEn: scene.sceneEn,
    arcEn: { start: scene.arcStartEn, end: scene.arcEndEn },
    lookId: scene.lookId || 'editorial-daylight',
  } as SymbolicScene, seconds)
}

function reelPrompt(scene: Pick<SymbolicScene, 'sceneEn' | 'arcEn' | 'lookId'>, seconds: number): string {
  const look = flowLook(scene.lookId)
  const lines = [
    'SYMBOLIC REEL — one continuous cinematic metaphor scene. This is a poetic visual film, not an explainer: no presenter, no avatar, no talking, no interface.',
    `Duration: exactly ${seconds} seconds. Aspect ratio: 9:16 vertical for Instagram Reels.`,
    `Scene: ${scene.sceneEn}.`,
    `Dramatic arc: the clip begins as ${scene.arcEn.start}; it ends as ${scene.arcEn.end}. One idea, one transformation, nothing else.`,
    cinematographyBlock({ look, seconds, order: 1, shotCount: 1, role: 'hook', avatar: false }),
    'Sound design: rich natural environmental sound only — no music, no voice-over, no dialogue.',
    'People rule: no recognizable faces; any human presence stays anonymous (hands, silhouettes, figures from behind).',
    'VISIBLE-TEXT RULE — generate absolutely no on-screen text of any kind in any language: no titles, captions, subtitles, letters, numbers, logos, or watermarks. Clean space is reserved for editorial text added later.',
    'Negative constraints: cartoon style, plastic CGI look, oversaturated colors, lens flares without a source, morphing artifacts, extra limbs, visible writing in any language, subtitles, watermarks.',
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
