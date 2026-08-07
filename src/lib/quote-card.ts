/**
 * رسم بطاقة الاقتباس على canvas — بهويّة الموقع.
 *
 * كانت محصورة في تحديد نصّ المقال. أُخرجت هنا لتخدم مقاطع الكتب أيضاً:
 * كل مقطعٍ من كتبه التسعة يصير بطاقةً قابلة للنشر، منسوبةً إلى كتابها
 * وصفحتها. توزيعٌ مجاني لكتبه يقوم به قرّاؤه عنه.
 *
 * السطر المنسوب (مثلاً «الطفل والتكنولوجيا · ص 47») هو الفرق بين بطاقةٍ
 * جميلة وبطاقةٍ **موثّقة**: من يشاركها لا يُسأل «من أين هذا؟».
 */
const W = 1080
const H = 1080

export type QuoteCardOptions = {
  dark?: boolean
  /** سطر النسبة تحت التوقيع — اسم الكتاب والصفحة مثلاً. */
  attribution?: string
}

export function drawQuoteCard(quote: string, options: QuoteCardOptions = {}): string {
  const { dark = false, attribution = '' } = options
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const bg = dark ? '#111215' : '#FCFCFA'
  const ink = dark ? '#EAEAE7' : '#15161A'
  const accent = dark ? '#8AADCC' : '#3E5C78'
  const soft = dark ? '#8A8F98' : '#7C818B'

  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  const grad = g.createRadialGradient(W * 0.82, H * 0.2, 40, W * 0.82, H * 0.2, 620)
  grad.addColorStop(0, `${accent}22`)
  grad.addColorStop(1, `${accent}00`)
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)

  g.strokeStyle = `${accent}30`
  g.lineWidth = 2
  g.strokeRect(56, 56, W - 112, H - 112)

  g.fillStyle = `${accent}2e`
  g.font = '700 220px "El Messiri", serif'
  g.textAlign = 'right'
  g.fillText('”', W - 104, 250)

  const size = quote.length > 260 ? 40 : quote.length > 170 ? 48 : quote.length > 90 ? 56 : 64
  g.font = `300 ${size}px "El Messiri", serif`
  g.fillStyle = ink
  g.textAlign = 'right'
  g.direction = 'rtl'

  const maxW = W - 220
  const words = quote.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (g.measureText(test).width > maxW && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)

  const lh = size * 1.72
  /* النسبة تأخذ سطراً إضافياً أسفل، فنرفع المتن قليلاً كي لا يزدحم القاع. */
  let y = H / 2 - ((lines.length - 1) * lh) / 2 - (attribution ? 46 : 20)
  for (const item of lines) {
    g.fillText(item, W - 110, y)
    y += lh
  }

  g.strokeStyle = accent
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W - 110, H - 214)
  g.lineTo(W - 210, H - 214)
  g.stroke()

  g.font = '600 34px "Tajawal", sans-serif'
  g.fillStyle = ink
  g.fillText('د. أحمد حسين الفيلكاوي', W - 110, H - 152)

  if (attribution) {
    g.font = '400 27px "Tajawal", sans-serif'
    g.fillStyle = accent
    g.fillText(attribution, W - 110, H - 108)
    g.font = '400 24px "Tajawal", sans-serif'
    g.fillStyle = soft
    g.fillText('dr-alfailakawi.com', W - 110, H - 70)
  } else {
    g.font = '400 26px "Tajawal", sans-serif'
    g.fillStyle = soft
    g.fillText('dr-alfailakawi.com', W - 110, H - 106)
  }

  return c.toDataURL('image/png')
}

/** الخطوط لا بد أن تكون جاهزة، وإلا رسم canvas بخطٍّ احتياطي فبانت البطاقة غريبة. */
export async function renderQuoteCard(quote: string, options: QuoteCardOptions = {}) {
  try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready } catch { /* لا شيء */ }
  const dark = options.dark ?? document.documentElement.classList.contains('dark')
  return drawQuoteCard(quote, { ...options, dark })
}
