export type VisualTopic = 'ai' | 'education' | 'family' | 'research' | 'media' | 'future' | 'human' | 'general'

export type SocialVisualLayout =
  | 'editorial'
  | 'quote'
  | 'split'
  | 'dark'
  | 'event'
  | 'timeline'
  | 'question'
  | 'signature'
  | 'orbit'
  | 'signal'
  | 'window'
  | 'manifesto'
  | 'circuit'
  | 'notebook'
  | 'human'
  | 'research'
  | 'horizon'
  | 'dialogue'
  | 'arch'
  | 'matrix'
  | 'layers'
  | 'focus'
  | 'wave'
  | 'balance'

export type SocialVisualTemplate = {
  id: string
  platform: 'instagram' | 'story' | 'linkedin' | 'x'
  format: string
  layout: SocialVisualLayout
  topic: VisualTopic
  width: number
  height: number
  kicker: string
  title: string
  body: string
  footer?: string
  source?: string
}

export type SocialPackVisualInput = {
  carouselSlides?: { kicker: string; title: string; body: string }[]
  stories?: string[]
  visualDirections?: { layout: string; tone: string; headline: string; subline: string }[]
  event?: { source?: string; title?: string } | null
}

const layouts: SocialVisualLayout[] = [
  'editorial', 'orbit', 'quote', 'signal', 'split', 'window', 'dark', 'timeline', 'question',
  'manifesto', 'event', 'signature', 'circuit', 'notebook', 'human', 'research', 'horizon', 'dialogue', 'arch', 'matrix', 'layers', 'focus', 'wave', 'balance',
]

const topicProfiles: Record<VisualTopic, { label: string; kicker: string; closer: string; layouts: SocialVisualLayout[] }> = {
  ai: {
    label: 'ذكاء اصطناعي وتقنية',
    kicker: 'الإنسان داخل التقنية',
    closer: 'الأداة تتغير؛ المعيار الإنساني يبقى.',
    layouts: ['circuit', 'signal', 'orbit', 'matrix', 'dark', 'split', 'manifesto', 'question'],
  },
  education: {
    label: 'تعليم وتعلّم',
    kicker: 'من قلب التعلّم',
    closer: 'ما الذي سيتغير داخل الصف؟',
    layouts: ['notebook', 'editorial', 'window', 'arch', 'question', 'timeline', 'human', 'split'],
  },
  family: {
    label: 'أسرة وطفل',
    kicker: 'قربٌ يحمي المعنى',
    closer: 'التربية علاقة قبل أن تكون تعليمات.',
    layouts: ['human', 'window', 'quote', 'signature', 'dialogue', 'layers', 'editorial', 'question'],
  },
  research: {
    label: 'بحث ومعرفة',
    kicker: 'الدليل قبل الانطباع',
    closer: 'السؤال الجيد يسبق النتيجة الجيدة.',
    layouts: ['research', 'timeline', 'matrix', 'split', 'manifesto', 'dark', 'notebook', 'editorial'],
  },
  media: {
    label: 'إعلام ومجتمع رقمي',
    kicker: 'خلف المشهد',
    closer: 'لا يكفي أن يصل الصوت؛ المهم ماذا يصنع.',
    layouts: ['dialogue', 'signal', 'wave', 'event', 'split', 'quote', 'dark', 'window'],
  },
  future: {
    label: 'مستقبل وقيادة',
    kicker: 'أفق القرار',
    closer: 'المستقبل قرار يُصمَّم، لا خبر ننتظره.',
    layouts: ['horizon', 'orbit', 'arch', 'balance', 'manifesto', 'dark', 'circuit', 'timeline', 'signature'],
  },
  human: {
    label: 'الإنسان والمعنى',
    kicker: 'الإنسان أولًا',
    closer: 'كل فكرة تُقاس بما تتركه في الإنسان.',
    layouts: ['human', 'signature', 'focus', 'quote', 'window', 'editorial', 'dialogue', 'horizon'],
  },
  general: {
    label: 'فكرة عامة',
    kicker: 'فكرة تستحق التوقف',
    closer: 'الأثر قبل الانبهار.',
    layouts: ['editorial', 'orbit', 'focus', 'layers', 'quote', 'split', 'question', 'manifesto', 'signature'],
  },
}

const normalizeArabic = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')

export function detectVisualTopic(value: string): VisualTopic {
  const text = normalizeArabic(value)
  if (/ذكاء اصطناعي|خوارزم|تقني|تكنولوجيا|رقمي|روبوت|بيانات|منصه|شاشه/.test(text)) return 'ai'
  if (/طفل|ابن|ابناء|اسره|والد|والدين|اموم|ابو|تربيه منزليه/.test(text)) return 'family'
  if (/بحث|دراسه|اكاديمي|جامع|منهج علمي|استبيان|مرجع|دليل/.test(text)) return 'research'
  if (/اعلام|ميديا|منصات اجتماعي|سوشيال|خبر|صحاف|تلفزيون|بودكاست/.test(text)) return 'media'
  if (/مستقبل|قياد|ابتكار|تحول|استشراف|قرار|مؤسس/.test(text)) return 'future'
  if (/تعليم|تعلم|معلم|طالب|مدرس|صف|امتحان|تقييم|منهج/.test(text)) return 'education'
  if (/انسان|معني|وعي|كرام|اخلاق|هويه|قيم|حريه/.test(text)) return 'human'
  return 'general'
}

export function visualTopicLabel(topic: VisualTopic) {
  return topicProfiles[topic].label
}

const safeLayout = (value = '', index = 0): SocialVisualLayout =>
  layouts.includes(value as SocialVisualLayout) ? value as SocialVisualLayout : layouts[index % layouts.length]

const hashText = (value: string) => [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261)

const diverseLayouts = (
  seed: string,
  count: number,
  directions: SocialPackVisualInput['visualDirections'],
  topic: VisualTopic,
) => {
  const start = hashText(seed) % layouts.length
  const requested = (directions || [])
    .map((item) => safeLayout(item.layout))
    .filter((layout, index, all) => all.indexOf(layout) === index)
  const topicLayouts = topicProfiles[topic].layouts
  const rotated = [...layouts.slice(start), ...layouts.slice(0, start)]
  return [...requested, ...topicLayouts, ...rotated]
    .filter((layout, index, all) => all.indexOf(layout) === index)
    .slice(0, count)
}

const dedupeSlides = (slides: { kicker: string; title: string; body: string }[]) => slides
  .filter((slide) => slide.title.trim())
  .filter((slide, index, all) => all.findIndex((candidate) => candidate.title.trim() === slide.title.trim()) === index)

export function buildSocialVisuals(pack: SocialPackVisualInput, article: { title: string; excerpt: string }) {
  const directions = pack.visualDirections || []
  const topic = detectVisualTopic(`${article.title} ${article.excerpt} ${directions.map((item) => `${item.headline} ${item.subline}`).join(' ')}`)
  const profile = topicProfiles[topic]
  const baseSlides = pack.carouselSlides?.length ? pack.carouselSlides : [
    { kicker: profile.kicker, title: article.title, body: article.excerpt },
  ]
  const directionSlides = directions.map((item) => ({
    kicker: item.tone || profile.kicker,
    title: item.headline || article.title,
    body: item.subline || article.excerpt,
  }))
  const slides = dedupeSlides([
    ...baseSlides,
    ...directionSlides,
    { kicker: 'الخلاصة', title: profile.closer, body: article.excerpt },
  ]).slice(0, 8)

  const selectedLayouts = diverseLayouts(`${article.title}:${pack.event?.title || ''}`, 18, directions, topic)
  const variantLabels = ['معالجة بديلة', 'زاوية إنسانية', 'نسخة مختصرة', 'تكوين بصري آخر', 'وقفة تأمل', 'امتداد الفكرة']
  const visualCount = Math.min(12, Math.max(8, slides.length * 2))
  const visualSlides = Array.from({ length: visualCount }, (_, index) => {
    const slide = slides[index % slides.length]
    if (index < slides.length) return slide
    return {
      ...slide,
      kicker: `${slide.kicker || profile.kicker} · ${variantLabels[(index - slides.length) % variantLabels.length]}`,
    }
  })
  const instagram: SocialVisualTemplate[] = visualSlides.map((slide, index) => ({
    id: `instagram-${topic}-${index + 1}`,
    platform: 'instagram',
    format: index === 0 ? 'غلاف كاروسيل' : index < slides.length ? 'بطاقة كاروسيل' : 'تنويع بصري بديل',
    layout: selectedLayouts[index % selectedLayouts.length],
    topic,
    width: 1080,
    height: 1350,
    kicker: slide.kicker || (index === 0 ? profile.kicker : 'امتداد الفكرة'),
    title: slide.title || article.title,
    body: slide.body || '',
    footer: index === visualSlides.length - 1 ? 'اقرأ الفكرة كاملة في الموقع' : 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }))

  const storyTexts = [...(pack.stories || []), profile.closer]
    .filter(Boolean)
    .filter((text, index, all) => all.indexOf(text) === index)
    .slice(0, 5)
  const stories: SocialVisualTemplate[] = storyTexts.map((text, index) => ({
    id: `story-${topic}-${index + 1}`,
    platform: 'story',
    format: 'قصة عمودية',
    layout: selectedLayouts[(slides.length + index) % selectedLayouts.length],
    topic,
    width: 1080,
    height: 1920,
    kicker: index === 0 ? profile.kicker : 'من الفكرة',
    title: text,
    body: index === 0 ? article.title : '',
    footer: 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }))

  const linkedin: SocialVisualTemplate = {
    id: `linkedin-${topic}-cover`,
    platform: 'linkedin',
    format: 'LinkedIn 1200×627',
    layout: selectedLayouts[(slides.length + stories.length) % selectedLayouts.length],
    topic,
    width: 1200,
    height: 627,
    kicker: directions[0]?.tone || profile.kicker,
    title: directions[0]?.headline || article.title,
    body: directions[0]?.subline || article.excerpt,
    footer: 'د. أحمد حسين الفيلكاوي',
    source: pack.event?.source || '',
  }

  const x: SocialVisualTemplate = {
    id: `x-${topic}-square`,
    platform: 'x',
    format: 'X 1080×1080',
    layout: selectedLayouts[(slides.length + stories.length + 1) % selectedLayouts.length],
    topic,
    width: 1080,
    height: 1080,
    kicker: profile.kicker,
    title: profile.closer,
    body: article.title,
    footer: 'dr-alfailakawi.com',
    source: pack.event?.source || '',
  }

  return { instagram, stories, linkedin, x, topic, topicLabel: profile.label }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maximumLines: number) {
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maximumLines)
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight))
  return y + lines.length * lineHeight
}

function fittedTitleSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maximumLines: number, preferred: number, minimum: number) {
  let size = preferred
  while (size > minimum) {
    ctx.font = `700 ${Math.round(size)}px "El Messiri", serif`
    if (wrapLines(ctx, text, maxWidth).length <= maximumLines) return Math.round(size)
    size -= 2
  }
  return Math.round(minimum)
}

async function loadLogo() {
  const image = new Image()
  image.decoding = 'async'
  image.src = '/logo.png'
  await image.decode()
  return image
}

/* ═══════════ الطبعة الفاخرة: ست تكوينات فنية موقّعة ═══════════
   بدل هيكلٍ واحد يتكرر بخربشة شفافة، كل تكوين هنا بنية بصرية مستقلة بهوية
   الموقع (أحادية اللون + #3E5C78) وذهبٍ مخطوطي هادئ:
   «المداد» مخطوطة بحرف استهلالي ظلي وإطار مذهّب · «الليل» سماء داكنة بهالة
   ذهبية · «الجريدة» صفحة رأي بترويسة صحفية · «الشريط» عارضة سينمائية بلون
   الموقع · «المشكاة» قوس معماري إسلامي · «التوقيع» صفحة بيضاء بخط توقيع حي.
   التخطيطات القديمة كلها تُسنَد إلى أحد التكوينات فلا يتغير أي استدعاء خارجي. */

type Composition = 'midad' | 'layl' | 'jarida' | 'sharit' | 'mishkat' | 'tawqee'

const compositionOf = (layout: SocialVisualLayout): Composition => {
  if (layout === 'dark' || layout === 'circuit' || layout === 'matrix') return 'layl'
  if (layout === 'manifesto' || layout === 'notebook' || layout === 'research' || layout === 'timeline' || layout === 'editorial') return 'jarida'
  if (layout === 'split' || layout === 'event' || layout === 'signal' || layout === 'wave') return 'sharit'
  if (layout === 'arch' || layout === 'window' || layout === 'horizon' || layout === 'layers') return 'mishkat'
  if (layout === 'signature' || layout === 'human' || layout === 'balance' || layout === 'quote') return 'tawqee'
  return 'midad'
}

type Ink = { bg: string; ink: string; soft: string; accent: string; gold: string; line: string; card: string }

const INKS: Record<Composition, Ink> = {
  midad: { bg: '#F6F1E6', ink: '#191713', soft: '#6E675C', accent: '#3E5C78', gold: '#A98A52', line: '#D9D0BE', card: '#FFFDF7' },
  layl: { bg: '#0F1216', ink: '#F5F2EA', soft: '#AEB4BD', accent: '#8FB0CC', gold: '#C9A96C', line: 'rgba(255,255,255,.16)', card: '#191E25' },
  jarida: { bg: '#FBFAF6', ink: '#111319', soft: '#666C76', accent: '#3E5C78', gold: '#A98A52', line: '#D8D6CE', card: '#FFFFFF' },
  sharit: { bg: '#F0F2F4', ink: '#14161B', soft: '#6A727C', accent: '#3E5C78', gold: '#C9A96C', line: '#CDD4DA', card: '#FFFFFF' },
  mishkat: { bg: '#F5F2EA', ink: '#181613', soft: '#6F695E', accent: '#3E5C78', gold: '#A98A52', line: '#DBD3C2', card: '#FFFDF7' },
  tawqee: { bg: '#FFFFFF', ink: '#14161B', soft: '#6E747E', accent: '#3E5C78', gold: '#A98A52', line: '#E2E2DE', card: '#FBFAF7' },
}

const hashSeed = (value: string) => { let hash = 0; for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; return hash }

const setLetterSpacing = (ctx: CanvasRenderingContext2D, px: number) => {
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px` } catch { /* متصفح أقدم */ }
}

export async function renderSocialPng(template: SocialVisualTemplate) {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = template.width
  canvas.height = template.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر إنشاء قالب الصورة.')

  const W = template.width
  const H = template.height
  const S = W / 1080
  const isStory = template.platform === 'story'
  const comp = compositionOf(template.layout)
  const ink = INKS[comp]
  const pad = Math.round(W * 0.09)
  const display = (weight: number, size: number) => `${weight} ${Math.round(size)}px "El Messiri", serif`
  const sans = (weight: number, size: number) => `${weight} ${Math.round(size)}px Tajawal, sans-serif`
  const hairline = (x1: number, y1: number, x2: number, y2: number, color: string, widthPx: number, alpha = 1) => {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthPx; ctx.globalAlpha = alpha
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore()
  }
  const diamond = (x: number, y: number, radius: number, color: string, alpha = 1) => {
    ctx.save(); ctx.fillStyle = color; ctx.globalAlpha = alpha
    ctx.beginPath(); ctx.moveTo(x, y - radius); ctx.lineTo(x + radius, y); ctx.lineTo(x, y + radius); ctx.lineTo(x - radius, y)
    ctx.closePath(); ctx.fill(); ctx.restore()
  }
  const kickerLine = (text: string, x: number, y: number, color: string, size: number, spacing: number, align: CanvasTextAlign) => {
    ctx.save(); ctx.fillStyle = color; ctx.font = sans(600, size); ctx.textAlign = align
    setLetterSpacing(ctx, spacing); ctx.fillText(text, x, y); setLetterSpacing(ctx, 0); ctx.restore()
  }
  const sourceBadge = (centerMode: boolean, y: number) => {
    if (!template.source) return
    const badgeText = `مرتبط بحدث من ${template.source}`
    ctx.font = sans(500, W * 0.022)
    const badgeWidth = Math.min(W - pad * 2, ctx.measureText(badgeText).width + 56 * S)
    const badgeHeight = Math.round(H * 0.045)
    const badgeX = centerMode ? (W - badgeWidth) / 2 : W - pad - badgeWidth
    roundedRect(ctx, badgeX, y - badgeHeight * 0.72, badgeWidth, badgeHeight, badgeHeight / 2)
    ctx.fillStyle = comp === 'layl' ? 'rgba(255,255,255,.08)' : ink.card
    ctx.fill()
    ctx.strokeStyle = ink.line; ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = ink.gold
    ctx.textAlign = 'center'
    ctx.fillText(badgeText, badgeX + badgeWidth / 2, y)
  }
  const drawLogo = async (x: number, y: number, invert: boolean) => {
    try {
      const logo = await loadLogo()
      const logoWidth = Math.round(W * 0.1)
      const logoHeight = Math.round(logoWidth * 0.62)
      if (invert) ctx.filter = 'invert(1)'
      ctx.drawImage(logo, x === -1 ? Math.round((W - logoWidth) / 2) : x, y - logoHeight, logoWidth, logoHeight)
      ctx.filter = 'none'
      return logoHeight
    } catch { return 0 }
  }

  ctx.fillStyle = ink.bg
  ctx.fillRect(0, 0, W, H)
  ctx.direction = 'rtl'
  ctx.textBaseline = 'alphabetic'

  /* ═══ «المداد» — مخطوطة بإطار مذهّب وحرف استهلالي ظلي ═══ */
  if (comp === 'midad') {
    ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = ink.line; ctx.lineWidth = 1
    for (let y = pad * 1.4; y < H - pad * 1.4; y += 30 * S) { ctx.beginPath(); ctx.moveTo(pad * 1.1, y); ctx.lineTo(W - pad * 1.1, y); ctx.stroke() }
    ctx.restore()
    ctx.strokeStyle = ink.ink; ctx.globalAlpha = 0.75; ctx.lineWidth = 2.4 * S
    ctx.strokeRect(pad * 0.52, pad * 0.52, W - pad * 1.04, H - pad * 1.04)
    ctx.globalAlpha = 1; ctx.strokeStyle = ink.gold; ctx.lineWidth = 1.1 * S
    ctx.strokeRect(pad * 0.72, pad * 0.72, W - pad * 1.44, H - pad * 1.44)
    for (const [cx, cy] of [[pad * 0.72, pad * 0.72], [W - pad * 0.72, pad * 0.72], [pad * 0.72, H - pad * 0.72], [W - pad * 0.72, H - pad * 0.72]] as const)
      diamond(cx, cy, 9 * S, ink.gold)
    kickerLine(`✦  ${template.kicker}  ✦`, W / 2, pad * 1.62, ink.gold, W * 0.026, 5 * S, 'center')
    const initial = (template.title.trim().match(/[ء-ي]/) || ['و'])[0]
    ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = ink.accent; ctx.font = display(700, W * 0.56); ctx.textAlign = 'center'
    ctx.fillText(initial, W / 2, H * (isStory ? 0.5 : 0.58)); ctx.restore()
    const titleMaxW = W - pad * 2.7
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 5, W * (isStory ? 0.082 : 0.07), W * 0.044)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    const afterTitle = drawWrapped(ctx, template.title, W / 2, H * (isStory ? 0.3 : 0.31), titleMaxW, Math.round(titleSize * 1.48), isStory ? 7 : 5)
    hairline(W / 2 - 80 * S, afterTitle + 8 * S, W / 2 - 14 * S, afterTitle + 8 * S, ink.gold, 1.4 * S)
    hairline(W / 2 + 14 * S, afterTitle + 8 * S, W / 2 + 80 * S, afterTitle + 8 * S, ink.gold, 1.4 * S)
    diamond(W / 2, afterTitle + 8 * S, 6 * S, ink.gold)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.03); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, afterTitle + 78 * S, W - pad * 3, Math.round(W * 0.03 * 1.8), isStory ? 8 : 5)
    }
    sourceBadge(true, H - pad * 2.15)
    await drawLogo(-1, H - pad * 1.28, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.95)
  }

  /* ═══ «الليل» — سماء داكنة بهالة ذهبية ونجوم حتمية ═══ */
  if (comp === 'layl') {
    const glow = ctx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, W * 0.78)
    glow.addColorStop(0, '#171C23'); glow.addColorStop(1, '#0C0F13')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    const seed = hashSeed(template.id + template.title)
    ctx.save()
    for (let index = 0; index < 90; index += 1) {
      const sx = ((seed * (index + 13)) % 997) / 997 * W
      const sy = ((seed * (index + 71)) % 883) / 883 * H
      ctx.globalAlpha = 0.05 + ((seed * (index + 7)) % 23) / 100
      ctx.fillStyle = index % 5 === 0 ? ink.gold : '#DCE2E8'
      ctx.beginPath(); ctx.arc(sx, sy, (index % 3 === 0 ? 2 : 1.2) * S, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    ctx.save(); ctx.strokeStyle = ink.gold; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.6 * S
    ctx.beginPath(); ctx.arc(W / 2, H * 0.44, W * 0.335, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = 0.16
    ctx.beginPath(); ctx.arc(W / 2, H * 0.44, W * 0.405, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    diamond(W / 2, H * 0.44 - W * 0.335, 7 * S, ink.gold)
    kickerLine(template.kicker, W / 2, H * (isStory ? 0.14 : 0.155), ink.gold, W * 0.025, 6 * S, 'center')
    const titleMaxW = W * 0.62
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 6, W * (isStory ? 0.075 : 0.064), W * 0.04)
    ctx.font = display(700, titleSize)
    const titleLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 7 : 6).length
    const lineHeight = Math.round(titleSize * 1.5)
    ctx.fillStyle = ink.ink; ctx.textAlign = 'center'
    const titleStart = H * 0.44 - ((titleLines - 1) * lineHeight) / 2 + titleSize * 0.35
    const afterTitle = drawWrapped(ctx, template.title, W / 2, titleStart, titleMaxW, lineHeight, isStory ? 7 : 6)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(300, W * 0.028); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, Math.max(afterTitle + 60 * S, H * 0.44 + W * 0.405 + 54 * S), W - pad * 3, Math.round(W * 0.028 * 1.85), isStory ? 7 : 4)
    }
    sourceBadge(true, H - pad * 2.05)
    hairline(W / 2 - 60 * S, H - pad * 1.62, W / 2 + 60 * S, H - pad * 1.62, ink.gold, 1.2 * S, 0.8)
    await drawLogo(-1, H - pad * 1.62 - 14 * S, true)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.95)
  }

  /* ═══ «الجريدة» — صفحة رأي بترويسة صحفية وعمود جانبي ═══ */
  if (comp === 'jarida') {
    ctx.fillStyle = ink.ink
    ctx.fillRect(pad, pad, W - pad * 2, 6 * S)
    kickerLine(template.kicker, W / 2, pad + 52 * S, ink.ink, W * 0.026, 6 * S, 'center')
    hairline(pad, pad + 74 * S, W - pad, pad + 74 * S, ink.ink, 1.6 * S)
    ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.019); ctx.textAlign = 'right'
    ctx.fillText('رأي · تربية وتقنية', W - pad, pad + 108 * S)
    ctx.textAlign = 'left'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', pad, pad + 108 * S)
    ctx.textAlign = 'right'
    const columnX = pad + W * 0.14
    const bodyMaxW = W - pad * 2 - W * 0.18
    const titleSize = fittedTitleSize(ctx, template.title, W - pad * 2, isStory ? 7 : 5, W * (isStory ? 0.088 : 0.08), W * 0.048)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize)
    const afterTitle = drawWrapped(ctx, template.title, W - pad, pad + H * (isStory ? 0.135 : 0.17) + titleSize * 0.4, W - pad * 2, Math.round(titleSize * 1.44), isStory ? 7 : 5)
    ctx.fillStyle = ink.accent
    ctx.fillRect(W - pad - 150 * S, afterTitle + 6 * S, 150 * S, 9 * S)
    if (template.body) {
      ctx.fillStyle = ink.gold; ctx.font = display(700, W * 0.05)
      ctx.fillText('«', W - pad, afterTitle + 92 * S)
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.03)
      drawWrapped(ctx, template.body, W - pad - 52 * S, afterTitle + 92 * S, bodyMaxW - 52 * S, Math.round(W * 0.03 * 1.85), isStory ? 9 : 6)
    }
    hairline(columnX, afterTitle + 60 * S, columnX, H - pad * 1.7, ink.line, 1.4 * S)
    sourceBadge(false, H - pad * 2)
    hairline(pad, H - pad * 1.45, W - pad, H - pad * 1.45, ink.ink, 1.6 * S)
    await drawLogo(pad, H - pad * 0.62, false)
    ctx.fillStyle = ink.ink; ctx.font = display(600, W * 0.026); ctx.textAlign = 'right'
    ctx.fillText('د. أحمد حسين الفيلكاوي', W - pad, H - pad * 0.95)
  }

  /* ═══ «الشريط» — عارضة سينمائية بلون الموقع ═══ */
  if (comp === 'sharit') {
    const bandHeight = H * (isStory ? 0.3 : 0.42)
    const bandY = (H - bandHeight) / 2
    kickerLine(template.kicker, W - pad, bandY - 44 * S, ink.accent, W * 0.026, 4 * S, 'right')
    hairline(pad, bandY - 30 * S, W - pad - ctx.measureText(template.kicker).width - 260 * S, bandY - 30 * S, ink.line, 1.4 * S)
    ctx.fillStyle = ink.accent
    ctx.fillRect(0, bandY, W, bandHeight)
    ctx.save(); ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.3
    for (let x = 22 * S; x < W; x += 42 * S) {
      ctx.beginPath(); ctx.arc(x, bandY + 20 * S, 4.5 * S, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(x, bandY + bandHeight - 20 * S, 4.5 * S, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    const titleMaxW = W - pad * 2
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 5 : 4, W * (isStory ? 0.075 : 0.068), W * 0.042)
    ctx.font = display(700, titleSize)
    const titleLines = wrapLines(ctx, template.title, titleMaxW).slice(0, isStory ? 5 : 4).length
    const lineHeight = Math.round(titleSize * 1.46)
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'
    const titleStart = bandY + bandHeight / 2 - ((titleLines - 1) * lineHeight) / 2 + titleSize * 0.34
    drawWrapped(ctx, template.title, W - pad, titleStart, titleMaxW, lineHeight, isStory ? 5 : 4)
    ctx.fillStyle = ink.gold
    ctx.fillRect(W - pad - 110 * S, bandY + 44 * S, 110 * S, 5 * S)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.029); ctx.textAlign = 'right'
      drawWrapped(ctx, template.body, W - pad, bandY + bandHeight + 76 * S, W - pad * 2.4, Math.round(W * 0.029 * 1.8), isStory ? 6 : 4)
    }
    sourceBadge(false, H - pad * 1.75)
    await drawLogo(pad, H - pad * 0.72, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'right'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W - pad, H - pad * 0.95)
  }

  /* ═══ «المشكاة» — قوس معماري إسلامي يحتضن الفكرة ═══ */
  if (comp === 'mishkat') {
    const baseY = H * (isStory ? 0.6 : 0.66)
    const apexY = H * (isStory ? 0.17 : 0.15)
    const halfW = W * 0.3
    const shoulderY = apexY + (baseY - apexY) * 0.44
    const arch = (half: number, color: string, widthPx: number, alpha: number) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = widthPx; ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(W / 2 - half, baseY)
      ctx.lineTo(W / 2 - half, shoulderY)
      ctx.bezierCurveTo(W / 2 - half, apexY + (shoulderY - apexY) * 0.25, W / 2 - half * 0.42, apexY, W / 2, apexY)
      ctx.bezierCurveTo(W / 2 + half * 0.42, apexY, W / 2 + half, apexY + (shoulderY - apexY) * 0.25, W / 2 + half, shoulderY)
      ctx.lineTo(W / 2 + half, baseY)
      ctx.stroke(); ctx.restore()
    }
    arch(halfW, ink.accent, 3 * S, 0.9)
    arch(halfW * 0.9, ink.gold, 1.2 * S, 0.85)
    hairline(W * 0.1, baseY, W * 0.9, baseY, ink.accent, 2.2 * S, 0.9)
    hairline(W * 0.13, baseY + 14 * S, W * 0.87, baseY + 14 * S, ink.gold, 1 * S, 0.7)
    diamond(W / 2, apexY - 18 * S, 8 * S, ink.gold)
    hairline(W / 2, apexY - 10 * S, W / 2, apexY + 26 * S, ink.gold, 1.2 * S, 0.8)
    ctx.save(); ctx.fillStyle = ink.gold; ctx.globalAlpha = 0.9
    ctx.beginPath(); ctx.arc(W / 2, apexY + 40 * S, 7 * S, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    kickerLine(template.kicker, W / 2, pad * 0.92, ink.gold, W * 0.024, 5 * S, 'center')
    const titleMaxW = halfW * 1.62
    const titleSize = fittedTitleSize(ctx, template.title, titleMaxW, isStory ? 7 : 6, W * 0.058, W * 0.038)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'center'
    drawWrapped(ctx, template.title, W / 2, apexY + (baseY - apexY) * 0.34, titleMaxW, Math.round(titleSize * 1.5), isStory ? 7 : 6)
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.028); ctx.textAlign = 'center'
      drawWrapped(ctx, template.body, W / 2, baseY + 78 * S, W - pad * 2.8, Math.round(W * 0.028 * 1.85), isStory ? 7 : 4)
    }
    sourceBadge(true, H - pad * 1.95)
    await drawLogo(-1, H - pad * 1.22, false)
    ctx.fillStyle = ink.accent; ctx.font = sans(600, W * 0.022); ctx.textAlign = 'center'
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W / 2, H - pad * 0.9)
  }

  /* ═══ «التوقيع» — صفحة بيضاء بخط توقيع حي ═══ */
  if (comp === 'tawqee') {
    ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = ink.accent
    ctx.font = display(700, W * 0.6); ctx.textAlign = 'left'
    ctx.fillText('”', pad * 0.4, H * 0.42); ctx.restore()
    kickerLine(template.kicker, W - pad, pad * 1.35, ink.accent, W * 0.026, 4 * S, 'right')
    hairline(W - pad, pad * 1.6, W - pad - 120 * S, pad * 1.6, ink.gold, 2 * S)
    const titleSize = fittedTitleSize(ctx, template.title, W - pad * 2.2, isStory ? 7 : 5, W * (isStory ? 0.082 : 0.072), W * 0.046)
    ctx.fillStyle = ink.ink; ctx.font = display(700, titleSize); ctx.textAlign = 'right'
    const afterTitle = drawWrapped(ctx, template.title, W - pad, pad + H * (isStory ? 0.12 : 0.16) + titleSize * 0.4, W - pad * 2.2, Math.round(titleSize * 1.46), isStory ? 7 : 5)
    ctx.save(); ctx.strokeStyle = ink.accent; ctx.lineWidth = 3 * S; ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(W - pad - 10 * S, afterTitle + 34 * S)
    ctx.bezierCurveTo(W - pad - 150 * S, afterTitle + 74 * S, W - pad - 240 * S, afterTitle - 6 * S, W - pad - 330 * S, afterTitle + 40 * S)
    ctx.bezierCurveTo(W - pad - 390 * S, afterTitle + 70 * S, W - pad - 430 * S, afterTitle + 24 * S, W - pad - 470 * S, afterTitle + 38 * S)
    ctx.stroke()
    ctx.fillStyle = ink.gold
    ctx.beginPath(); ctx.arc(W - pad - 484 * S, afterTitle + 38 * S, 5 * S, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    if (template.body) {
      ctx.fillStyle = ink.soft; ctx.font = sans(400, W * 0.03); ctx.textAlign = 'right'
      drawWrapped(ctx, template.body, W - pad, afterTitle + 118 * S, W - pad * 2.6, Math.round(W * 0.03 * 1.85), isStory ? 8 : 5)
    }
    sourceBadge(false, H - pad * 2.2)
    ctx.fillStyle = ink.ink; ctx.font = display(600, W * 0.03); ctx.textAlign = 'right'
    ctx.fillText('د. أحمد حسين الفيلكاوي', W - pad, H - pad * 1.32)
    ctx.fillStyle = ink.soft; ctx.font = sans(500, W * 0.021)
    ctx.fillText(template.footer || 'dr-alfailakawi.com', W - pad, H - pad * 0.95)
    await drawLogo(pad, H - pad * 0.85, false)
  }

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذّر تصدير الصورة.')), 'image/png', 1))
}

export async function downloadSocialPng(template: SocialVisualTemplate) {
  const blob = await renderSocialPng(template)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${template.id}-${template.width}x${template.height}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_500)
}
