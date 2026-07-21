import {
  ACCENT_STRATEGIES,
  FRAMING_MODES,
  PALETTES,
  TYPOGRAPHY_MODES,
  type CompositionPlan,
  type LayoutFamilyId,
} from './social-design-engine'

const esc = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;')

const words = (value: string) => String(value || '').trim().split(/\s+/).filter(Boolean)

function wrap(value: string, maxChars: number, maxLines: number) {
  const source = words(value)
  if (!source.length) return []
  const lines: string[] = []
  let line = ''
  for (const word of source) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= maxChars || !line) line = next
    else {
      lines.push(line)
      line = word
      if (lines.length >= maxLines - 1) break
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length
  if (consumed < source.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/, '')}…`
  return lines
}

function textBlock({
  lines,
  x,
  y,
  size,
  lineHeight = 1.25,
  fill,
  weight = 600,
  anchor = 'end',
  opacity = 1,
  family = 'Tajawal',
  letterSpacing = 0,
}: {
  lines: string[]
  x: number
  y: number
  size: number
  lineHeight?: number
  fill: string
  weight?: number
  anchor?: 'end' | 'middle' | 'start'
  opacity?: number
  family?: string
  letterSpacing?: number
}) {
  if (!lines.length) return ''
  return `<text x="${x}" y="${y}" fill="${fill}" opacity="${opacity}" font-family="${esc(family)}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" direction="rtl" unicode-bidi="plaintext" letter-spacing="${letterSpacing}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? size * lineHeight : 0}">${esc(line)}</tspan>`).join('')}</text>`
}

function commonDecor(plan: CompositionPlan, width: number, height: number) {
  const palette = PALETTES[plan.palette]
  const frame = FRAMING_MODES[plan.framing]
  const inset = Math.round(Math.min(width, height) * frame.inset)
  const radius = Math.round(Math.min(width, height) * frame.radius)
  const parts: string[] = []
  if (frame.stroke) parts.push(`<rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}" rx="${radius}" fill="none" stroke="${palette.rule}" stroke-width="${frame.stroke}" opacity=".72"/>`)
  if (plan.framing === 'corner-marks') {
    const m = Math.round(Math.min(width, height) * .045)
    const l = Math.round(Math.min(width, height) * .07)
    parts.push(`<path d="M ${m + l} ${m} H ${m} V ${m + l} M ${width - m - l} ${height - m} H ${width - m} V ${height - m - l}" fill="none" stroke="${palette.accent}" stroke-width="3" opacity=".8"/>`)
  }
  if (plan.framing === 'floating-sheet') {
    parts.push(`<rect x="${width * .055}" y="${height * .05}" width="${width * .89}" height="${height * .9}" rx="${Math.min(width, height) * .035}" fill="${palette.surface}" filter="url(#shadow)" opacity=".98"/>`)
  }
  return parts.join('')
}

function accentDecor(plan: CompositionPlan, width: number, height: number) {
  const palette = PALETTES[plan.palette]
  const intensity = ACCENT_STRATEGIES[plan.accent].intensity
  if (!intensity || plan.accent === 'none') return ''
  const parts: string[] = []
  switch (plan.accent) {
    case 'single-rule':
      parts.push(`<line x1="${width * .08}" y1="${height * .16}" x2="${width * .92}" y2="${height * .16}" stroke="${palette.accent}" stroke-width="${2 + intensity}"/>`)
      break
    case 'soft-orbit':
      parts.push(`<circle cx="${width * .22}" cy="${height * .22}" r="${Math.min(width, height) * .15}" fill="none" stroke="${palette.accent}" stroke-width="2" opacity=".28"/>`)
      parts.push(`<circle cx="${width * .22}" cy="${height * .22}" r="${Math.min(width, height) * .09}" fill="${palette.accentSoft}" opacity=".65"/>`)
      break
    case 'contrast-band':
      parts.push(`<rect x="0" y="${height * .78}" width="${width}" height="${height * .22}" fill="${palette.accent}" opacity=".95"/>`)
      break
    case 'corner-signal':
      parts.push(`<path d="M0 0 H${width * .19} L0 ${height * .13}Z" fill="${palette.accent}" opacity=".95"/>`)
      break
    case 'quiet-seal':
      parts.push(`<circle cx="${width * .14}" cy="${height * .86}" r="${Math.min(width, height) * .052}" fill="${palette.accentSoft}" stroke="${palette.accent}" stroke-width="2"/>`)
      break
    case 'data-marker':
      parts.push(`<rect x="${width * .075}" y="${height * .12}" width="${width * .02}" height="${height * .18}" rx="6" fill="${palette.accent}"/>`)
      break
    case 'editorial-index':
      parts.push(`<text x="${width * .08}" y="${height * .11}" fill="${palette.accent}" font-size="${Math.min(width, height) * .038}" font-family="Tajawal" font-weight="700">0${Math.min(plan.directionIndex, 9)}</text>`)
      break
    case 'paper-note':
      parts.push(`<path d="M ${width * .06} ${height * .72} Q ${width * .22} ${height * .67}, ${width * .36} ${height * .74}" fill="none" stroke="${palette.accent}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`)
      break
    case 'hero-keyword':
      break
  }
  return parts.join('')
}

function layoutDecor(layout: LayoutFamilyId, plan: CompositionPlan, width: number, height: number) {
  const p = PALETTES[plan.palette]
  switch (layout) {
    case 'editorial-axis':
      return `<line x1="${width * .77}" y1="${height * .09}" x2="${width * .77}" y2="${height * .91}" stroke="${p.rule}" stroke-width="2"/><circle cx="${width * .77}" cy="${height * .19}" r="7" fill="${p.accent}"/>`
    case 'hero-word':
      return textBlock({ lines: [plan.content.heroWord || plan.content.title.split(' ')[0]], x: width * .5, y: height * .57, size: Math.min(width, height) * .2, fill: p.accent, weight: 700, anchor: 'middle', opacity: .1, family: 'El Messiri' })
    case 'quote-stage':
      return `<text x="${width * .1}" y="${height * .24}" fill="${p.accent}" opacity=".23" font-family="El Messiri" font-size="${Math.min(width, height) * .26}">“</text>`
    case 'dual-thesis':
      return `<rect x="${width * .055}" y="${height * .08}" width="${width * .4}" height="${height * .84}" rx="${Math.min(width, height) * .025}" fill="${p.accentSoft}" opacity=".55"/><line x1="${width * .5}" y1="${height * .14}" x2="${width * .5}" y2="${height * .86}" stroke="${p.rule}" stroke-width="2"/>`
    case 'evidence-ledger':
      return [0, 1, 2, 3].map((i) => `<line x1="${width * .08}" y1="${height * (.31 + i * .14)}" x2="${width * .92}" y2="${height * (.31 + i * .14)}" stroke="${p.rule}" stroke-width="1" opacity=".8"/>`).join('')
    case 'event-marquee':
      return `<rect x="0" y="0" width="${width}" height="${height * .14}" fill="${p.accent}"/><circle cx="${width * .17}" cy="${height * .76}" r="${Math.min(width, height) * .1}" fill="none" stroke="${p.accent}" stroke-width="5" opacity=".45"/>`
    case 'knowledge-map':
      return `<g opacity=".5"><line x1="${width * .18}" y1="${height * .2}" x2="${width * .36}" y2="${height * .35}" stroke="${p.accent}" stroke-width="2"/><line x1="${width * .36}" y1="${height * .35}" x2="${width * .16}" y2="${height * .56}" stroke="${p.accent}" stroke-width="2"/><circle cx="${width * .18}" cy="${height * .2}" r="10" fill="${p.accent}"/><circle cx="${width * .36}" cy="${height * .35}" r="16" fill="${p.accentSoft}" stroke="${p.accent}"/><circle cx="${width * .16}" cy="${height * .56}" r="8" fill="${p.accent}"/></g>`
    case 'quiet-orbit':
      return `<circle cx="${width * .5}" cy="${height * .47}" r="${Math.min(width, height) * .31}" fill="none" stroke="${p.rule}" stroke-width="1.5"/><circle cx="${width * .5}" cy="${height * .47}" r="${Math.min(width, height) * .23}" fill="none" stroke="${p.accent}" stroke-width="2" opacity=".28"/>`
    case 'chapter-stack':
      return [0, 1, 2].map((i) => `<rect x="${width * (.075 + i * .035)}" y="${height * (.09 + i * .035)}" width="${width * .55}" height="${height * .72}" rx="${Math.min(width, height) * .018}" fill="${i === 2 ? p.surface : 'none'}" stroke="${p.rule}" stroke-width="${i === 2 ? 0 : 1.5}" opacity="${.35 + i * .2}"/>`).join('')
    case 'cinematic-window':
      return `<rect x="${width * .06}" y="${height * .12}" width="${width * .88}" height="${height * .48}" rx="${Math.min(width, height) * .03}" fill="${p.accentSoft}" opacity=".55"/><path d="M${width * .06} ${height * .6} L${width * .94} ${height * .6}" stroke="${p.accent}" stroke-width="5"/>`
    case 'human-note':
      return `<g transform="rotate(-2 ${width / 2} ${height / 2})"><rect x="${width * .08}" y="${height * .1}" width="${width * .84}" height="${height * .78}" rx="${Math.min(width, height) * .02}" fill="${p.surface}" stroke="${p.rule}"/><path d="M${width * .14} ${height * .24} Q${width * .32} ${height * .2} ${width * .48} ${height * .25}" fill="none" stroke="${p.accent}" stroke-width="3" opacity=".45"/></g>`
    case 'modular-brief':
      return `<g opacity=".72"><rect x="${width * .06}" y="${height * .08}" width="${width * .27}" height="${height * .17}" rx="18" fill="${p.accentSoft}"/><rect x="${width * .35}" y="${height * .08}" width="${width * .59}" height="${height * .17}" rx="18" fill="${p.surface}" stroke="${p.rule}"/><rect x="${width * .06}" y="${height * .69}" width="${width * .4}" height="${height * .22}" rx="18" fill="${p.surface}" stroke="${p.rule}"/></g>`
  }
}

function footer(plan: CompositionPlan, width: number, height: number) {
  const p = PALETTES[plan.palette]
  const inverted = plan.accent === 'contrast-band'
  const fill = inverted ? '#ffffff' : p.muted
  const author = plan.content.author || 'د. أحمد حسين الفيلكاوي'
  return `<g><text x="${width * .91}" y="${height * .93}" fill="${fill}" font-size="${Math.min(width, height) * .025}" font-family="Tajawal" font-weight="600" text-anchor="end" direction="rtl">${esc(author)}</text><text x="${width * .09}" y="${height * .93}" fill="${fill}" font-size="${Math.min(width, height) * .019}" font-family="Tajawal" font-weight="500">dr-alfailakawi.com</text></g>`
}

export function renderCompositionSvg(plan: CompositionPlan, options: { title?: string; ariaLabel?: string } = {}) {
  const width = plan.format.width
  const height = plan.format.height
  const palette = PALETTES[plan.palette]
  const typography = TYPOGRAPHY_MODES[plan.typography]
  const min = Math.min(width, height)
  const titleLines = wrap(plan.content.title, plan.format.width > plan.format.height ? 25 : 19, typography.maxLines)
  const bodySource = plan.content.subtitle || plan.content.body || plan.content.quote
  const bodyLines = wrap(bodySource, plan.format.width > plan.format.height ? 44 : 31, plan.density === 'minimal' ? 2 : plan.density === 'rich' ? 5 : 3)
  const titleSize = min * (.062 * typography.titleScale) * (titleLines.length > 3 ? .86 : 1)
  const bodySize = min * .027
  const tx = plan.geometry.titleZone.x * width + plan.geometry.titleZone.width * width
  const ty = plan.geometry.titleZone.y * height
  const bx = plan.geometry.bodyZone.x * width + plan.geometry.bodyZone.width * width
  const by = plan.geometry.bodyZone.y * height
  const kicker = plan.content.kicker || plan.directionLabel
  const titleFill = palette.ink
  const bodyFill = palette.muted
  const frame = commonDecor(plan, width, height)
  const decor = `${layoutDecor(plan.layout, plan, width, height)}${accentDecor(plan, width, height)}`
  const kickerText = textBlock({ lines: wrap(kicker, 34, 1), x: width * .91, y: height * .105, size: min * .021, fill: plan.layout === 'event-marquee' ? '#ffffff' : palette.accent, weight: 700, family: 'Tajawal', letterSpacing: 1.2 })
  const titleText = textBlock({ lines: titleLines, x: tx, y: ty, size: titleSize, fill: titleFill, weight: typography.titleWeight, family: typography.displayFamily, lineHeight: typography.lineHeight })
  const bodyText = textBlock({ lines: bodyLines, x: bx, y: by, size: bodySize, fill: bodyFill, weight: 500, family: typography.bodyFamily, lineHeight: 1.55 })
  const cta = plan.content.cta && plan.ctaPlacement !== 'none'
    ? `<g><rect x="${width * .64}" y="${height * .82}" width="${width * .27}" height="${height * .055}" rx="${height * .0275}" fill="${palette.accent}"/><text x="${width * .775}" y="${height * .855}" fill="#fff" font-family="Tajawal" font-size="${min * .021}" font-weight="700" text-anchor="middle" direction="rtl">${esc(plan.content.cta)}</text></g>`
    : ''
  const accessible = esc(options.ariaLabel || `${plan.directionLabel}: ${plan.content.title}`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${accessible}" direction="rtl" style="width:100%;height:100%;display:block"><title>${esc(options.title || plan.content.title)}</title><defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#000" flood-opacity=".12"/></filter><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.background}"/><stop offset="1" stop-color="${palette.surface}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#wash)"/>${decor}${frame}${kickerText}${titleText}${bodyText}${cta}${footer(plan, width, height)}</svg>`
}

function fileName(plan: CompositionPlan, extension: string) {
  const safe = (plan.content.heroWord || plan.content.title || 'social-design').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'social-design'
  return `${safe}-${plan.format.id}-${plan.fingerprint.slice(0, 8)}.${extension}`
}

function triggerDownload(url: string, name: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function downloadCompositionSvg(plan: CompositionPlan) {
  const blob = new Blob([renderCompositionSvg(plan)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, fileName(plan, 'svg'))
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function downloadCompositionRaster(plan: CompositionPlan, type: 'png' | 'jpeg' = 'png') {
  await document.fonts?.ready
  const svg = renderCompositionSvg(plan)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = plan.format.width
    canvas.height = plan.format.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('تعذّر فتح لوحة الرسم.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const mime = type === 'jpeg' ? 'image/jpeg' : 'image/png'
    const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('تعذّر تصدير التصميم.')), mime, type === 'jpeg' ? .94 : undefined))
    const outputUrl = URL.createObjectURL(output)
    triggerDownload(outputUrl, fileName(plan, type === 'jpeg' ? 'jpg' : 'png'))
    window.setTimeout(() => URL.revokeObjectURL(outputUrl), 1_000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function printCompositionPdf(plan: CompositionPlan) {
  const popup = window.open('', '_blank', 'width=900,height=900')
  if (!popup) throw new Error('اسمح بفتح نافذة الطباعة لحفظ PDF.')
  try { popup.opener = null } catch { /* بعض المتصفحات تمنع تعديل opener */ }
  const svg = renderCompositionSvg(plan)
  popup.document.write(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(plan.content.title)}</title><style>@page{size:${plan.format.width}px ${plan.format.height}px;margin:0}html,body{margin:0;background:#fff}svg{display:block;width:100vw;height:100vh} @media print{html,body{width:${plan.format.width}px;height:${plan.format.height}px}}</style></head><body>${svg}<script>addEventListener('load',()=>setTimeout(()=>print(),250))<\/script></body></html>`)
  popup.document.close()
}
