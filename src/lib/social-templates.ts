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

type Palette = { background: string; ink: string; soft: string; accent: string; line: string; card: string }

function paletteFor(template: SocialVisualTemplate): Palette {
  if (template.layout === 'dark' || template.layout === 'circuit') {
    return { background: '#15161a', ink: '#ffffff', soft: '#c5cbd1', accent: '#8aa8c2', line: 'rgba(255,255,255,.18)', card: '#20242a' }
  }
  if (template.layout === 'human') return { background: '#f8f4ef', ink: '#171719', soft: '#77736f', accent: '#795f48', line: '#ded5cb', card: '#fffdf9' }
  if (template.layout === 'research') return { background: '#f2f5f7', ink: '#15161a', soft: '#6f7881', accent: '#355f78', line: '#cbd7de', card: '#ffffff' }
  if (template.layout === 'horizon') return { background: '#f4f6f5', ink: '#15161a', soft: '#747b7d', accent: '#486b75', line: '#d2dcda', card: '#ffffff' }
  if (template.layout === 'dialogue') return { background: '#f8f6f2', ink: '#15161a', soft: '#79766f', accent: '#4b647b', line: '#ddd8cf', card: '#ffffff' }
  if (template.layout === 'event') return { background: '#eef2f5', ink: '#15161a', soft: '#6e7580', accent: '#3e5c78', line: '#ccd4dc', card: '#ffffff' }
  if (template.layout === 'question') return { background: '#fbfaf7', ink: '#111318', soft: '#717884', accent: '#2f536f', line: '#d7ddd8', card: '#ffffff' }
  if (template.layout === 'timeline') return { background: '#f4f3ef', ink: '#15161a', soft: '#777e87', accent: '#3e5c78', line: '#cfd5db', card: '#ffffff' }
  if (template.layout === 'signature') return { background: '#f8f7f3', ink: '#15161a', soft: '#7b8088', accent: '#8a6f3d', line: '#ded8c9', card: '#ffffff' }
  if (template.layout === 'orbit') return { background: '#f4f7f8', ink: '#15161a', soft: '#747d86', accent: '#365d76', line: '#cedae0', card: '#ffffff' }
  if (template.layout === 'signal') return { background: '#f6f4ef', ink: '#15161a', soft: '#777e87', accent: '#4a6680', line: '#d8d4ca', card: '#ffffff' }
  if (template.layout === 'window') return { background: '#edf2f4', ink: '#15161a', soft: '#737c84', accent: '#375b74', line: '#cbd6dc', card: '#ffffff' }
  if (template.layout === 'manifesto') return { background: '#f9f6f0', ink: '#15161a', soft: '#77756f', accent: '#2f536f', line: '#ded8cc', card: '#ffffff' }
  if (template.layout === 'notebook') return { background: '#fbfaf6', ink: '#15161a', soft: '#747b84', accent: '#3e5c78', line: '#d8dcd8', card: '#ffffff' }
  if (template.layout === 'arch') return { background: '#f5f4f0', ink: '#15161a', soft: '#777b80', accent: '#47657a', line: '#d5d9d8', card: '#ffffff' }
  if (template.layout === 'matrix') return { background: '#eef3f5', ink: '#15161a', soft: '#727b84', accent: '#365d76', line: '#ccd7dc', card: '#ffffff' }
  if (template.layout === 'layers') return { background: '#faf7f1', ink: '#15161a', soft: '#7a7771', accent: '#756047', line: '#ddd6ca', card: '#ffffff' }
  if (template.layout === 'focus') return { background: '#f7f8f6', ink: '#15161a', soft: '#747b7b', accent: '#3d6471', line: '#d3dcda', card: '#ffffff' }
  if (template.layout === 'wave') return { background: '#f2f5f6', ink: '#15161a', soft: '#707981', accent: '#3c6079', line: '#ced9de', card: '#ffffff' }
  if (template.layout === 'balance') return { background: '#f8f5ef', ink: '#15161a', soft: '#79766f', accent: '#6f5d48', line: '#ded6ca', card: '#ffffff' }
  return { background: '#f7f6f3', ink: '#15161a', soft: '#7c818a', accent: '#3e5c78', line: '#d9d9d6', card: '#ffffff' }
}

function drawArtwork(ctx: CanvasRenderingContext2D, template: SocialVisualTemplate, palette: Palette, pad: number) {
  const width = template.width
  const height = template.height
  ctx.save()
  ctx.strokeStyle = palette.accent
  ctx.fillStyle = palette.accent
  ctx.lineWidth = Math.max(2, width / 500)

  if (template.layout === 'split') ctx.fillRect(0, 0, Math.round(width * .28), height)

  if (template.layout === 'timeline') {
    ctx.globalAlpha = .12
    const x = Math.round(width * .18)
    ctx.beginPath(); ctx.moveTo(x, pad + height * .08); ctx.lineTo(x, height - pad - height * .08); ctx.stroke()
    for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.arc(x, pad + height * (.18 + i * .18), width * .014, 0, Math.PI * 2); ctx.fill() }
  }

  if (template.layout === 'question' || template.layout === 'quote' || template.layout === 'manifesto') {
    ctx.globalAlpha = template.layout === 'manifesto' ? .07 : .08
    ctx.font = `700 ${Math.round(width * (template.layout === 'manifesto' ? .38 : .4))}px "El Messiri", serif`
    ctx.textAlign = template.layout === 'manifesto' ? 'left' : 'right'
    ctx.fillText(template.layout === 'question' ? '؟' : template.layout === 'quote' ? '”' : '01', template.layout === 'manifesto' ? pad : width - pad, Math.round(height * .4))
    ctx.textAlign = 'right'
  }

  if (template.layout === 'signature') {
    ctx.globalAlpha = .1
    ctx.beginPath(); ctx.ellipse(width * .42, height * .34, width * .28, height * .18, -.2, 0, Math.PI * 2); ctx.stroke()
  }

  if (template.layout === 'orbit') {
    ctx.globalAlpha = .14
    const cx = width * .25; const cy = height * .28
    for (const radius of [.08, .14, .21]) { ctx.beginPath(); ctx.arc(cx, cy, width * radius, 0, Math.PI * 2); ctx.stroke() }
    ctx.beginPath(); ctx.arc(cx + width * .14, cy - width * .03, width * .012, 0, Math.PI * 2); ctx.fill()
  }

  if (template.layout === 'signal') {
    ctx.globalAlpha = .14
    const baseX = width * .12; const centerY = height * .48
    ;[.07, .15, .24, .12, .31, .18, .09].forEach((bar, index) => {
      const barHeight = height * bar
      roundedRect(ctx, baseX + index * width * .025, centerY - barHeight / 2, width * .009, barHeight, width * .006); ctx.fill()
    })
  }

  if (template.layout === 'window') {
    ctx.globalAlpha = .12
    ctx.lineWidth = Math.max(3, width / 360)
    roundedRect(ctx, width * .08, height * .16, width * .38, height * .48, width * .035); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(width * .27, height * .16); ctx.lineTo(width * .27, height * .64); ctx.stroke()
  }

  if (template.layout === 'circuit') {
    ctx.globalAlpha = .18
    const points = [[.12,.22],[.27,.16],[.38,.31],[.19,.46],[.35,.58],[.12,.7]]
    ctx.beginPath()
    points.forEach(([x,y], index) => index ? ctx.lineTo(width*x,height*y) : ctx.moveTo(width*x,height*y))
    ctx.stroke()
    points.forEach(([x,y]) => { ctx.beginPath(); ctx.arc(width*x,height*y,width*.011,0,Math.PI*2); ctx.fill() })
  }

  if (template.layout === 'notebook') {
    ctx.globalAlpha = .13
    for (let y = height * .2; y < height * .82; y += height * .075) { ctx.beginPath(); ctx.moveTo(width * .08, y); ctx.lineTo(width * .45, y); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(width * .41, height * .16); ctx.lineTo(width * .41, height * .84); ctx.stroke()
  }

  if (template.layout === 'human') {
    ctx.globalAlpha = .12
    const cx = width * .21; const cy = height * .37
    for (let radius = width * .07; radius <= width * .24; radius += width * .035) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, Math.PI * .2, Math.PI * 1.75); ctx.stroke()
    }
  }

  if (template.layout === 'research') {
    ctx.globalAlpha = .12
    for (let i = 0; i < 5; i += 1) {
      const x = width * (.08 + i * .065); const barHeight = height * (.08 + i * .045)
      ctx.fillRect(x, height * .58 - barHeight, width * .025, barHeight)
    }
    ctx.beginPath(); ctx.moveTo(width*.07,height*.58); ctx.lineTo(width*.41,height*.58); ctx.stroke()
    for (let x = width*.08; x <= width*.42; x += width*.07) { ctx.beginPath(); ctx.moveTo(x,height*.2); ctx.lineTo(x,height*.65); ctx.stroke() }
  }

  if (template.layout === 'horizon') {
    ctx.globalAlpha = .13
    ctx.beginPath(); ctx.moveTo(width*.06,height*.55); ctx.lineTo(width*.48,height*.55); ctx.stroke()
    ctx.beginPath(); ctx.arc(width*.27,height*.55,width*.13,Math.PI,0); ctx.stroke()
    ctx.beginPath(); ctx.arc(width*.27,height*.55,width*.025,0,Math.PI*2); ctx.fill()
  }

  if (template.layout === 'dialogue') {
    ctx.globalAlpha = .12
    roundedRect(ctx, width*.07,height*.18,width*.31,height*.16,width*.035); ctx.stroke()
    roundedRect(ctx, width*.14,height*.39,width*.31,height*.16,width*.035); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(width*.12,height*.34); ctx.lineTo(width*.09,height*.39); ctx.lineTo(width*.17,height*.34); ctx.stroke()
  }

  if (template.layout === 'arch') {
    ctx.globalAlpha = .13
    ctx.beginPath(); ctx.arc(width*.24,height*.48,width*.18,Math.PI,0); ctx.stroke()
    ctx.beginPath(); ctx.arc(width*.24,height*.48,width*.09,Math.PI,0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(width*.06,height*.48); ctx.lineTo(width*.42,height*.48); ctx.stroke()
  }
  if (template.layout === 'matrix') {
    ctx.globalAlpha = .11
    for (let x = .08; x <= .42; x += .085) for (let y = .18; y <= .62; y += .09) { ctx.beginPath(); ctx.arc(width*x,height*y,width*.007,0,Math.PI*2); ctx.fill() }
  }
  if (template.layout === 'layers') {
    ctx.globalAlpha = .11
    for (let i=0;i<4;i+=1) { roundedRect(ctx,width*(.08+i*.035),height*(.18+i*.045),width*.34,height*.28,width*.025); ctx.stroke() }
  }
  if (template.layout === 'focus') {
    ctx.globalAlpha = .13
    const cx=width*.23, cy=height*.37
    for (const radius of [.05,.1,.16]) { ctx.beginPath(); ctx.arc(cx,cy,width*radius,0,Math.PI*2); ctx.stroke() }
    ctx.beginPath(); ctx.arc(cx,cy,width*.018,0,Math.PI*2); ctx.fill()
  }
  if (template.layout === 'wave') {
    ctx.globalAlpha = .12
    for (let row=0;row<3;row+=1) { ctx.beginPath(); for (let x=0;x<=80;x+=1) { const px=width*(.06+x/190); const py=height*(.28+row*.1)+Math.sin(x/8+row)*height*.025; x?ctx.lineTo(px,py):ctx.moveTo(px,py) } ctx.stroke() }
  }
  if (template.layout === 'balance') {
    ctx.globalAlpha = .13
    ctx.beginPath(); ctx.moveTo(width*.1,height*.46); ctx.lineTo(width*.4,height*.46); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(width*.25,height*.28); ctx.lineTo(width*.25,height*.58); ctx.stroke()
    ctx.beginPath(); ctx.arc(width*.14,height*.48,width*.05,0,Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.arc(width*.36,height*.48,width*.05,0,Math.PI*2); ctx.stroke()
  }

  ctx.restore()
}

export async function renderSocialPng(template: SocialVisualTemplate) {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = template.width
  canvas.height = template.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر إنشاء قالب الصورة.')

  const palette = paletteFor(template)
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'

  const pad = Math.round(template.width * .085)
  const contentWidth = template.width - pad * 2
  drawArtwork(ctx, template, palette, pad)

  ctx.strokeStyle = palette.line
  ctx.lineWidth = Math.max(2, template.width / 540)
  ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(template.width - pad, pad); ctx.stroke()

  ctx.fillStyle = palette.accent
  ctx.font = `700 ${Math.round(template.width * .034)}px Tajawal, sans-serif`
  ctx.fillText(template.kicker, template.width - pad, pad + Math.round(template.height * .065))

  const maximumTitleLines = template.platform === 'story' ? 7 : 6
  const baseTitleSize = template.platform === 'story' ? template.width * .078 : template.width * .064
  const titleSize = fittedTitleSize(ctx, template.title, contentWidth, maximumTitleLines, baseTitleSize, template.width * .043)
  ctx.fillStyle = palette.ink
  ctx.font = `700 ${titleSize}px "El Messiri", serif`
  const titleY = pad + Math.round(template.height * .16)
  const afterTitle = drawWrapped(ctx, template.title, template.width - pad, titleY, contentWidth, Math.round(titleSize * 1.42), maximumTitleLines)

  if (template.body) {
    ctx.fillStyle = palette.soft
    const bodySize = Math.round(template.width * .032)
    ctx.font = `400 ${bodySize}px Tajawal, sans-serif`
    drawWrapped(ctx, template.body, template.width - pad, afterTitle + Math.round(template.height * .045), contentWidth, Math.round(bodySize * 1.75), template.platform === 'story' ? 9 : 7)
  }

  if (template.source) {
    const badgeText = `مرتبط بحدث من ${template.source}`
    ctx.font = `500 ${Math.round(template.width * .023)}px Tajawal, sans-serif`
    const badgeWidth = Math.min(contentWidth, ctx.measureText(badgeText).width + 52)
    const badgeHeight = Math.round(template.height * .052)
    roundedRect(ctx, template.width - pad - badgeWidth, template.height - pad - badgeHeight - 74, badgeWidth, badgeHeight, badgeHeight / 2)
    ctx.fillStyle = template.layout === 'dark' || template.layout === 'circuit' ? 'rgba(255,255,255,.08)' : palette.card
    ctx.fill()
    ctx.fillStyle = palette.accent
    ctx.fillText(badgeText, template.width - pad - 24, template.height - pad - badgeHeight - 74 + badgeHeight * .68)
  }

  try {
    const logo = await loadLogo()
    const logoWidth = Math.round(template.width * .11)
    const logoHeight = Math.round(logoWidth * .62)
    if (template.layout === 'dark' || template.layout === 'circuit') ctx.filter = 'invert(1)'
    ctx.drawImage(logo, pad, template.height - pad - logoHeight, logoWidth, logoHeight)
    ctx.filter = 'none'
  } catch { /* يبقى القالب صالحاً حتى لو تعذر تحميل الشعار */ }

  ctx.fillStyle = palette.soft
  ctx.font = `500 ${Math.round(template.width * .024)}px Tajawal, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText(template.footer || 'dr-alfailakawi.com', template.width - pad, template.height - pad)

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
