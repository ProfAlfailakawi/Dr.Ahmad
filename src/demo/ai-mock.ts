/*
 * ردود مولِّدات الذكاء الاصطناعي في وضع العرض فقط: محتوى عربي جاهز وصور SVG تُرسم محلياً.
 * لا شبكة ولا نموذج: النتيجة تعتمد على فكرة المستخدم تعتمد تدويراً بسيطاً حتى تبدو حيّة.
 */

type Body = Record<string, unknown>
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const hash = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

const PALETTES: [string, string, string][] = [
  ['#0f2a43', '#2f6f8f', '#e9c46a'],
  ['#2b1b3d', '#7b4b94', '#f4a261'],
  ['#12372a', '#436850', '#fbfada'],
  ['#3a1d1d', '#a4503a', '#f6e2b3'],
  ['#1b263b', '#415a77', '#e0e1dd'],
]

/** صورة تجريدية SVG بنسبة الطلب: ألوان وأشكال تتغير بحسب الفكرة، بلا أي نص داخل الصورة. */
export function demoSvgImage(seed: string, width: number, height: number): string {
  const h = hash(seed || 'demo')
  const [a, b, c] = PALETTES[h % PALETTES.length]
  const shapes: string[] = []
  for (let i = 0; i < 7; i++) {
    const x = ((h >> (i + 2)) % 100) / 100 * width
    const y = ((h >> (i + 5)) % 100) / 100 * height
    const r = (0.08 + ((h >> i) % 22) / 100) * Math.min(width, height)
    shapes.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="${i % 2 ? c : b}" opacity="${(0.16 + (i % 4) * 0.07).toFixed(2)}"/>`)
  }
  const hx = width * (0.3 + (h % 40) / 100)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${shapes.join('')}<circle cx="${hx.toFixed(0)}" cy="${(height * 0.38).toFixed(0)}" r="${(Math.min(width, height) * 0.2).toFixed(0)}" fill="url(#s)"/><path d="M0 ${(height * 0.78).toFixed(0)} Q ${(width * 0.35).toFixed(0)} ${(height * 0.62).toFixed(0)} ${(width * 0.7).toFixed(0)} ${(height * 0.8).toFixed(0)} T ${width} ${(height * 0.72).toFixed(0)} V ${height} H0Z" fill="#000" opacity=".28"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function studioImage(body: Body) {
  const orientation = text(body.orientation)
  const w = Number(body.targetWidth) || (orientation === 'landscape' ? 1200 : orientation === 'portrait' ? 1080 : 1080)
  const h = Number(body.targetHeight) || (orientation === 'landscape' ? 675 : orientation === 'portrait' ? 1350 : 1080)
  const k = Math.min(1, 1000 / Math.max(w, h))
  const idea = text(body.idea) || text(body.prompt)
  return {
    imageUrl: demoSvgImage(`${idea}|${body.candidateIndex || 0}|${body.regenerationId || ''}`, Math.round(w * k), Math.round(h * k)),
    imageMime: 'image/svg+xml',
    imageWidth: Math.round(w * k), imageHeight: Math.round(h * k), targetWidth: w, targetHeight: h, nativeAspect: true,
    owner: 'توليد تجريبي داخل الاستوديو', license: 'عرض توضيحي — صورة تجريدية مرسومة محلياً', model: 'مولّد العرض التوضيحي',
    description: idea ? `خلفية تجريدية مقترحة لفكرة: ${idea.slice(0, 80)}` : 'خلفية تجريدية مقترحة',
    generatedAt: new Date().toISOString(), requestId: `demo-${Date.now().toString(36)}`,
    relevanceScore: 93, visualScore: 88, semanticVerified: true, criticSource: 'demo', generationAttempts: 1,
    relevanceReason: 'ملاءمة جيدة للفكرة (تقييم تجريبي).', visualReasons: [],
  }
}

const ARC = [
  ['شجرة صغيرة تنمو من شقّ في جدار إسمنتي', 'A small sapling pushes up through a hairline crack in a weathered concrete wall at dawn, soft golden light spreading slowly across the surface while fine dust drifts in the air and the camera glides gently closer to the leaf'],
  ['خيوط ضوء تتشابك فتنسج خريطة مدينة', 'Thin threads of warm light weave across a dark table and slowly knot into the outline of a quiet city map, each junction glowing softly one after another while the camera rises in a slow overhead arc'],
  ['باب خشبي قديم ينفتح على ممر مضيء', 'An old wooden door in a dim stone corridor opens inch by inch toward a bright passage, dust turning gold in the beam, while the camera pushes forward at walking pace without any person visible'],
  ['ساعة رملية تتحول رمالها إلى طيور', 'The sand falling inside a large hourglass gradually becomes a flock of small birds that lift out through the glass and spread into a pale evening sky as the camera tilts upward with a slow steady motion'],
]
export function reelInvention(body: Body) {
  const idea = text(body.idea)
  const n = Math.max(1, Math.min(6, Number(body.count) || 4))
  const offset = hash(idea) % ARC.length
  const labels = ['البذرة في الشقّ', 'خيوط المدينة', 'الباب المواربة', 'رمل يطير']
  const why = [
    'استعارة النموّ الهادئ تطابق فكرتك: التغيير الحقيقي يبدأ صغيراً وفي مكان لا يُتوقَّع.',
    'تُظهر الترابط بين أجزاء متفرقة، وهو جوهر ما تقوله فكرتك عن البناء التدريجي.',
    'الباب يمثّل فرصة التعلّم؛ الانتقال من العتمة إلى الضوء يعطي المشاهد وعداً دون كلام.',
    'الزمن حين يصير حركةً وحرية بدل الضغط؛ صورة مناسبة لفكرة التعامل الهادئ مع الوقت.',
  ]
  const scenes = Array.from({ length: n }, (_, i) => {
    const k = (i + offset) % ARC.length
    return {
      labelAr: labels[k], sceneAr: `${ARC[k][0]}، بإضاءة دافئة وحركة كاميرا بطيئة، دون أشخاص ودون أي نص داخل المشهد.`,
      sceneEn: ARC[k][1], arcStartEn: 'a still, slightly dim composition with a single point of light',
      arcEndEn: 'a wide, open, softly lit composition that feels resolved', whyAr: why[k],
    }
  })
  return { scenes, sources: ['مقال: المعلم في زمن الخوارزميات', 'كتاب: التعلم الذي يبقى', 'لقاء: التقييم بوصفه حواراً', 'بحث: قلق الامتحانات لدى طلبة الجامعة'], demo: true }
}

const PROPS = ['teacherai', 'critical', 'feedback', 'seed', 'compass', 'door', 'chart', 'bulb', 'network', 'hands']
const THEMES = ['ai', 'edtech', 'skills', 'read', 'society']

function cannedBody(topic: string) {
  const t = topic || 'التعلم في زمن الذكاء الاصطناعي'
  return [
    `حين نتحدث عن ${t} ننسى أحياناً أن السؤال الأهم ليس عن الأداة بل عن الإنسان الذي يستخدمها.`,
    'المعلم الذي يفهم ما وراء التقنية يوجّه طلابه أفضل من الذي يطارد كل جديد.',
    'ليس المطلوب أن نرفض الجديد، بل أن نضعه في مكانه الصحيح خادماً للتعلم لا بديلاً عنه.',
    'التقييم الحقيقي يبدأ حين نسأل الطالب كيف فكّر لا ماذا أجاب.',
    'وفي كل مرة نخفف الخوف من الخطأ يتسع المجال للفهم العميق.',
    'العادة الصغيرة المنتظمة تصنع من الطالب قارئاً أكثر مما تصنعه الساعات الطويلة المتقطعة.',
    'هكذا يتحول الصف من قاعة تلقين إلى مساحة حوار يشعر فيها كل طالب بأن صوته مسموع.',
  ].join(' ')
}

const sentencesOf = (s: string) => s.split(/(?<=[.!؟…])\s+|\n+/).map((x) => x.trim()).filter((x) => x.split(/\s+/).length >= 4)
const clean = (w: string) => w.replace(/[.،؛:!؟"«»()\-–—…]/g, '')

export function monteurStoryboard(body: Body) {
  const topicMode = body.mode === 'topic'
  const src = text(body.body)
  const full = topicMode || src.length < 80 ? cannedBody(text(body.topic) || src) : src
  const sentences = sentencesOf(full).slice(0, 8)
  const base = hash(text(body.title) + full.slice(0, 40))
  const mk = (sentence: string, i: number) => {
    const words = sentence.split(/\s+/).map(clean).filter(Boolean)
    const l1 = words.slice(0, Math.min(3, Math.ceil(words.length / 2)))
    const l2 = words.slice(l1.length, l1.length + 3)
    return { t: 'metaphor', src: sentence.split(/\s+/).slice(0, 28).join(' '), prop: PROPS[(base + i * 3) % PROPS.length], l1, l2: l2.length ? l2 : l1.slice(-1), em: Math.min(l1.length, 1), ann: 'under' }
  }
  const scenes = sentences.map(mk)
  // اللوحة المستبدَلة لمشهد واحد: نبدّل الاستعارة فقط.
  if (body.sceneSrc) {
    const s = mk(text(body.sceneSrc) || sentences[0] || 'جملة المشهد', 5 + (Date.now() % 7))
    return { plan: { theme: 'ai', trio: ['يفهم', 'يوجّه', 'يحمي'], quote: '', scenes: [{ ...s, src: text(body.sceneSrc) || s.src }], generated: true }, body: full }
  }
  const first = sentences[0] || full
  return {
    plan: { theme: THEMES[base % THEMES.length], trio: ['يفهم', 'يوجّه', 'يحمي'], narrative: ['question', 'contrast', 'journey'][base % 3], opening: first.split(/\s+/).slice(0, 5).map(clean).join(' '), quote: sentences[2]?.split(/\s+/).slice(0, 9).map(clean).join(' ') || first.split(/\s+/).slice(0, 8).join(' '), scenes, generated: true },
    body: full,
  }
}

export function contentSuggestion(body: Body) {
  const title = text(body.title) || 'عنوان تجريبي'
  const kind = text(body.kind)
  const t = text(body.text)
  const excerpt = (t || 'تأمل في ما يبقى من التعلم بعد أن تنطفئ الشاشات، وكيف تصنع العادة الصغيرة فرقاً كبيراً.').split(/\s+/).slice(0, 34).join(' ')
  if (kind === 'article') return { cat: 'تقنيات التعليم', excerpt, tags: 'تعلم، معلم، ذكاء اصطناعي', readTime: '4 دقائق' }
  return { desc: excerpt, meta: excerpt, title }
}
