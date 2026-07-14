export type SocialVisualTemplate = {
  id: string
  platform: 'instagram' | 'story' | 'linkedin' | 'x'
  format: string
  layout: 'editorial' | 'quote' | 'split' | 'dark' | 'event' | 'timeline' | 'question' | 'signature' | 'orbit' | 'signal' | 'window' | 'manifesto'
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

const layouts: SocialVisualTemplate['layout'][] = ['editorial', 'orbit', 'quote', 'signal', 'split', 'window', 'dark', 'timeline', 'question', 'manifesto', 'event', 'signature']
const safeLayout = (value = '', index = 0): SocialVisualTemplate['layout'] => layouts.includes(value as SocialVisualTemplate['layout']) ? value as SocialVisualTemplate['layout'] : layouts[index % layouts.length]

const hashText = (value: string) => [...value].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261)
const diverseLayouts = (seed: string, count: number, directions: SocialPackVisualInput['visualDirections']) => {
  const start = hashText(seed) % layouts.length
  const requested = (directions || []).map((item) => safeLayout(item.layout)).filter((layout, index, all) => all.indexOf(layout) === index)
  const rotated = [...layouts.slice(start), ...layouts.slice(0, start)]
  return [...requested, ...rotated.filter((layout) => !requested.includes(layout))].slice(0, count)
}

export function buildSocialVisuals(pack: SocialPackVisualInput, article: { title: string; excerpt: string }) {
  const directions = pack.visualDirections || []
  const selectedLayouts = diverseLayouts(`${article.title}:${pack.event?.title || ''}`, 12, directions)
  const slides = pack.carouselSlides?.length ? pack.carouselSlides : [
    { kicker: 'فكرة جديدة', title: article.title, body: article.excerpt },
  ]
  const instagram: SocialVisualTemplate[] = slides.map((slide, index) => ({
    id: `instagram-${index + 1}`,
    platform: 'instagram',
    format: index === 0 ? 'غلاف كاروسيل' : `شريحة ${index + 1}`,
    layout: selectedLayouts[index % selectedLayouts.length],
    width: 1080,
    height: 1350,
    kicker: slide.kicker || (index === 0 ? 'من المقال' : `الفكرة ${index}`),
    title: slide.title || article.title,
    body: slide.body || '',
    footer: index === slides.length - 1 ? 'اقرأ المقال الكامل في الموقع' : `${index + 1} / ${slides.length}`,
    source: pack.event?.source || '',
  }))
  const stories: SocialVisualTemplate[] = (pack.stories || []).slice(0, 4).map((text, index) => ({
    id: `story-${index + 1}`,
    platform: 'story',
    format: `Story ${index + 1}`,
    layout: selectedLayouts[(slides.length + index) % selectedLayouts.length],
    width: 1080,
    height: 1920,
    kicker: index === 0 ? 'سؤال يستحق التوقف' : 'من الفكرة',
    title: text,
    body: index === 0 ? article.title : '',
    footer: `${index + 1} / ${Math.min(4, pack.stories?.length || 1)}`,
    source: pack.event?.source || '',
  }))
  const linkedin: SocialVisualTemplate = {
    id: 'linkedin-cover',
    platform: 'linkedin',
    format: 'LinkedIn 1200×627',
    layout: selectedLayouts[(slides.length + Math.min(4, pack.stories?.length || 0)) % selectedLayouts.length],
    width: 1200,
    height: 627,
    kicker: directions[0]?.tone || 'رؤية تربوية',
    title: directions[0]?.headline || article.title,
    body: directions[0]?.subline || article.excerpt,
    footer: 'د. أحمد حسين الفيلكاوي',
    source: pack.event?.source || '',
  }
  return { instagram, stories, linkedin }
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

async function loadLogo() {
  const image = new Image()
  image.decoding = 'async'
  image.src = '/logo.png'
  await image.decode()
  return image
}

export async function renderSocialPng(template: SocialVisualTemplate) {
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = template.width
  canvas.height = template.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('تعذّر إنشاء قالب الصورة.')

  const palette = template.layout === 'dark'
    ? { background: '#15161a', ink: '#ffffff', soft: '#c5cbd1', accent: '#8aa8c2', line: 'rgba(255,255,255,.18)', card: '#20242a' }
    : template.layout === 'event'
      ? { background: '#eef2f5', ink: '#15161a', soft: '#6e7580', accent: '#3e5c78', line: '#ccd4dc', card: '#ffffff' }
      : template.layout === 'question'
        ? { background: '#fbfaf7', ink: '#111318', soft: '#717884', accent: '#2f536f', line: '#d7ddd8', card: '#ffffff' }
        : template.layout === 'timeline'
          ? { background: '#f4f3ef', ink: '#15161a', soft: '#777e87', accent: '#3e5c78', line: '#cfd5db', card: '#ffffff' }
          : template.layout === 'signature'
            ? { background: '#f8f7f3', ink: '#15161a', soft: '#7b8088', accent: '#8a6f3d', line: '#ded8c9', card: '#ffffff' }
            : template.layout === 'orbit'
              ? { background: '#f4f7f8', ink: '#15161a', soft: '#747d86', accent: '#365d76', line: '#cedae0', card: '#ffffff' }
              : template.layout === 'signal'
                ? { background: '#f6f4ef', ink: '#15161a', soft: '#777e87', accent: '#4a6680', line: '#d8d4ca', card: '#ffffff' }
                : template.layout === 'window'
                  ? { background: '#edf2f4', ink: '#15161a', soft: '#737c84', accent: '#375b74', line: '#cbd6dc', card: '#ffffff' }
                  : template.layout === 'manifesto'
                    ? { background: '#f9f6f0', ink: '#15161a', soft: '#77756f', accent: '#2f536f', line: '#ded8cc', card: '#ffffff' }
      : { background: '#f7f6f3', ink: '#15161a', soft: '#7c818a', accent: '#3e5c78', line: '#d9d9d6', card: '#ffffff' }

  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'

  const pad = Math.round(template.width * .085)
  const contentWidth = template.width - pad * 2

  if (template.layout === 'split') {
    ctx.fillStyle = palette.accent
    ctx.fillRect(0, 0, Math.round(template.width * .28), template.height)
  }
  if (template.layout === 'timeline') {
    ctx.globalAlpha = .12
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = Math.max(2, template.width / 420)
    const x = Math.round(template.width * .18)
    ctx.beginPath()
    ctx.moveTo(x, pad + Math.round(template.height * .08))
    ctx.lineTo(x, template.height - pad - Math.round(template.height * .08))
    ctx.stroke()
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath()
      ctx.arc(x, pad + Math.round(template.height * (.18 + i * .18)), Math.round(template.width * .014), 0, Math.PI * 2)
      ctx.fillStyle = palette.accent
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
  if (template.layout === 'question') {
    ctx.globalAlpha = .09
    ctx.fillStyle = palette.accent
    ctx.font = `700 ${Math.round(template.width * .34)}px "El Messiri", serif`
    ctx.fillText('؟', template.width - pad, Math.round(template.height * .42))
    ctx.globalAlpha = 1
  }
  if (template.layout === 'signature') {
    ctx.globalAlpha = .1
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = Math.max(2, template.width / 500)
    ctx.beginPath()
    ctx.ellipse(Math.round(template.width * .42), Math.round(template.height * .34), Math.round(template.width * .28), Math.round(template.height * .18), -.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (template.layout === 'quote') {
    ctx.globalAlpha = .08
    ctx.fillStyle = palette.accent
    ctx.font = `700 ${Math.round(template.width * .42)}px "El Messiri", serif`
    ctx.fillText('”', template.width - pad, Math.round(template.height * .34))
    ctx.globalAlpha = 1
  }

  if (template.layout === 'orbit') {
    ctx.globalAlpha = .14
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = Math.max(2, template.width / 500)
    const cx = Math.round(template.width * .25)
    const cy = Math.round(template.height * .28)
    for (const radius of [.08, .14, .21]) {
      ctx.beginPath(); ctx.arc(cx, cy, Math.round(template.width * radius), 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = palette.accent
    ctx.beginPath(); ctx.arc(cx + Math.round(template.width * .14), cy - Math.round(template.width * .03), Math.round(template.width * .012), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }
  if (template.layout === 'signal') {
    ctx.globalAlpha = .14
    ctx.fillStyle = palette.accent
    const baseX = Math.round(template.width * .12)
    const centerY = Math.round(template.height * .48)
    ;[.07,.15,.24,.12,.31,.18,.09].forEach((height, index) => {
      const barHeight = Math.round(template.height * height)
      roundedRect(ctx, baseX + index * Math.round(template.width * .025), centerY - barHeight / 2, Math.round(template.width * .009), barHeight, Math.round(template.width * .006))
      ctx.fill()
    })
    ctx.globalAlpha = 1
  }
  if (template.layout === 'window') {
    ctx.globalAlpha = .12
    ctx.strokeStyle = palette.accent
    ctx.lineWidth = Math.max(3, template.width / 360)
    roundedRect(ctx, Math.round(template.width * .08), Math.round(template.height * .16), Math.round(template.width * .38), Math.round(template.height * .48), Math.round(template.width * .035))
    ctx.stroke()
    ctx.beginPath(); ctx.moveTo(Math.round(template.width * .27), Math.round(template.height * .16)); ctx.lineTo(Math.round(template.width * .27), Math.round(template.height * .64)); ctx.stroke()
    ctx.globalAlpha = 1
  }
  if (template.layout === 'manifesto') {
    ctx.globalAlpha = .07
    ctx.fillStyle = palette.accent
    ctx.font = `700 ${Math.round(template.width * .38)}px "El Messiri", serif`
    ctx.textAlign = 'left'
    ctx.fillText('01', pad, Math.round(template.height * .46))
    ctx.textAlign = 'right'
    ctx.globalAlpha = 1
  }

  ctx.strokeStyle = palette.line
  ctx.lineWidth = Math.max(2, template.width / 540)
  ctx.beginPath()
  ctx.moveTo(pad, pad)
  ctx.lineTo(template.width - pad, pad)
  ctx.stroke()

  ctx.fillStyle = palette.accent
  ctx.font = `700 ${Math.round(template.width * .034)}px Tajawal, sans-serif`
  ctx.fillText(template.kicker, template.width - pad, pad + Math.round(template.height * .065))

  const titleSize = template.platform === 'story' ? Math.round(template.width * .078) : Math.round(template.width * .064)
  ctx.fillStyle = palette.ink
  ctx.font = `700 ${titleSize}px "El Messiri", serif`
  const titleY = pad + Math.round(template.height * .16)
  const afterTitle = drawWrapped(ctx, template.title, template.width - pad, titleY, contentWidth, Math.round(titleSize * 1.45), template.platform === 'story' ? 6 : 5)

  if (template.body) {
    ctx.fillStyle = palette.soft
    const bodySize = Math.round(template.width * .032)
    ctx.font = `400 ${bodySize}px Tajawal, sans-serif`
    drawWrapped(ctx, template.body, template.width - pad, afterTitle + Math.round(template.height * .045), contentWidth, Math.round(bodySize * 1.75), template.platform === 'story' ? 8 : 6)
  }

  if (template.source) {
    const badgeText = `مرتبط بحدث من ${template.source}`
    ctx.font = `500 ${Math.round(template.width * .023)}px Tajawal, sans-serif`
    const badgeWidth = Math.min(contentWidth, ctx.measureText(badgeText).width + 52)
    const badgeHeight = Math.round(template.height * .052)
    roundedRect(ctx, template.width - pad - badgeWidth, template.height - pad - badgeHeight - 74, badgeWidth, badgeHeight, badgeHeight / 2)
    ctx.fillStyle = template.layout === 'dark' ? 'rgba(255,255,255,.08)' : '#eef1f4'
    ctx.fill()
    ctx.fillStyle = palette.accent
    ctx.fillText(badgeText, template.width - pad - 24, template.height - pad - badgeHeight - 74 + badgeHeight * .68)
  }

  try {
    const logo = await loadLogo()
    const logoWidth = Math.round(template.width * .11)
    const logoHeight = Math.round(logoWidth * .62)
    if (template.layout === 'dark') ctx.filter = 'invert(1)'
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
