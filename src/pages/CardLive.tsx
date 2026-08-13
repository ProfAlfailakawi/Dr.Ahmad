import { useEffect, useMemo, useRef, useState } from 'react'
import { useSeo } from '../components/seo'
import { profile, socials, books, papers, articles, site } from '../data'

/*
 * البطاقة الحيّة `/cards`: النسخة المسرحية من البطاقة الرقمية.
 *
 * جسيماتٌ تكتب «أُبقي الإنسانَ في قلب الآلة» ثم تتفكّك إلى شبكةٍ آليةٍ باردة —
 * وكلمة «الإنسان» وحدها تقاوم التفكّك نصفَ ثانيةٍ زائدة قبل أن تستسلم. الفكرة
 * تُرى قبل أن تُقرأ.
 *
 * `/card` تبقى كما هي: بطاقةٌ هادئةٌ بهوية الموقع العاجية لمن يريد جهة الاتصال
 * في ثانيتين. هذه أختها للمؤتمرات والشاشات الكبيرة، ولا تلغيها.
 *
 * ما غُيِّر عن الملف المسلَّم، لأسبابٍ تقنيةٍ لا ذوقية:
 *  · الخطوط من خطوط الموقع نفسها (المصيري/تجوّال) بدل ثلاث عائلاتٍ من Google
 *    Fonts: طلباتٌ خارجية أقلّ، وهويةٌ واحدة، ولا وميضَ خطٍّ عند التحميل.
 *  · الأعداد تُقرأ من بيانات الموقع لا مكتوبةً بيدٍ، فلا تتقادم بعد كل نشر.
 *  · حلقة الرسم تتوقّف عند مغادرة الصفحة أو إخفاء التبويب — في تطبيقٍ أحادي
 *    الصفحة تبقى الحلقة تدور بلا هذا فتأكل البطارية بعد أن يغادر الزائر.
 *  · لمسةٌ أو مفتاحٌ يكشف البطاقة فوراً: من لا يريد انتظار ستّ ثوانٍ لا ينتظر.
 */

const THESIS_LINE_ONE = 'أُبقي الإنسان'
const THESIS_LINE_TWO = 'في قلب الآلة'
const CARD_PATH = '/cards'
const REVEAL_MS = 6150

type Particle = {
  x: number; y: number
  hx: number; hy: number
  gx: number; gy: number
  keep: boolean; human: boolean
  seed: number; lastX: number; lastY: number
}

function buildVCard() {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:الفيلكاوي;أحمد حسين;د.;;',
    `FN:${profile.fullName}`,
    `TITLE:${profile.eyebrow}`,
    'ORG:الهيئة العامة للتعليم التطبيقي والتدريب — كلية التربية الأساسية',
    `URL:${site.url}`,
    ...socials.map((item) => `URL:${item.url}`),
    'NOTE:كاتب وباحث ومستشار — أُبقي الإنسان في قلب الآلة.',
    'END:VCARD',
  ].join('\r\n')
}

export default function CardLive() {
  useSeo({
    title: 'البطاقة الحيّة',
    path: CARD_PATH,
    description: 'البطاقة الرقمية للدكتور أحمد حسين الفيلكاوي — احفظ جهة الاتصال والروابط الرسمية بلمسة.',
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [toast, setToast] = useState('')

  /* الأعداد من مصدرها: بعد كل نشرٍ تصدُق البطاقة بلا أن يلمسها أحد. */
  const stats = useMemo(() => [
    { value: books.length, label: 'كتب منشورة' },
    { value: papers.length, label: 'بحثاً محكّماً' },
    { value: articles.length, label: 'مقالاً فكرياً' },
  ], [])
  const [counts, setCounts] = useState(() => stats.map(() => 0))

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  /* كشف البطاقة: بعد المشهد، أو فور أول لمسةٍ من زائرٍ لا يريد الانتظار. */
  useEffect(() => {
    if (reduced) { setRevealed(true); return }
    const timer = window.setTimeout(() => setRevealed(true), REVEAL_MS)
    const skip = () => setRevealed(true)
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [reduced])

  /* العدّادات تتحرّك مع ظهور البطاقة لا قبله، فلا يفوت الزائرَ ارتفاعُها. */
  useEffect(() => {
    if (!revealed) return
    if (reduced) { setCounts(stats.map((item) => item.value)); return }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / 1000)
      const eased = 1 - (1 - progress) ** 3
      setCounts(stats.map((item) => Math.round(item.value * eased)))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [revealed, reduced, stats])

  /* الغلاف الجسيمي كلّه في هذا الأثر، ويُفكَّك بالكامل عند المغادرة. */
  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const GAP = 34
    const STAGE = { enter: 500, rise: 2000, hold: 4400, melt: 6100, spread: 1000 }
    const RADIUS = 190

    let width = 0
    let height = 0
    let grid: { x: number; y: number }[] = []
    let particles: Particle[] = []
    let raf = 0
    let running = true

    const sentencePoints = () => {
      const off = document.createElement('canvas')
      off.width = width; off.height = height
      const pen = off.getContext('2d')
      if (!pen) return [] as { x: number; y: number; human?: boolean }[]

      let size = Math.min(width * 0.115, height * 0.075)
      const widest = (value: number) => {
        pen.font = `${value}px "El Messiri", serif`
        return Math.max(pen.measureText(THESIS_LINE_ONE).width, pen.measureText(THESIS_LINE_TWO).width)
      }
      size *= Math.min(1.9, (width * 0.8) / Math.max(1, widest(size)))
      pen.font = `${size}px "El Messiri", serif`

      const lineHeight = size * 1.28
      const centerX = width / 2
      const topY = height / 2 - lineHeight * 0.52
      const bottomY = height / 2 + lineHeight * 0.52
      pen.fillStyle = '#fff'; pen.textBaseline = 'middle'; pen.textAlign = 'right'

      const leadWidth = pen.measureText('أُبقي ').width
      const humanWidth = pen.measureText('الإنسان').width
      const rightEdge = centerX + (leadWidth + humanWidth) / 2

      const sample = (draw: () => void) => {
        pen.clearRect(0, 0, width, height)
        draw()
        const pixels = pen.getImageData(0, 0, width, height).data
        const points: { x: number; y: number }[] = []
        const step = Math.max(3, Math.round(size / 16))
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            if (pixels[(y * width + x) * 4 + 3] > 120) points.push({ x, y })
          }
        }
        return points
      }

      const human = sample(() => pen.fillText('الإنسان', rightEdge - leadWidth, topY))
      const rest = sample(() => {
        pen.fillText('أُبقي', rightEdge, topY)
        pen.fillText(THESIS_LINE_TWO, centerX + pen.measureText(THESIS_LINE_TWO).width / 2, bottomY)
      })
      return [
        ...human.map((point) => ({ ...point, human: true })),
        ...rest.map((point) => ({ ...point, human: false })),
      ]
    }

    const measure = () => {
      width = window.innerWidth; height = window.innerHeight
      canvas.width = width * dpr; canvas.height = height * dpr
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      grid = []
      for (let x = GAP / 2; x < width; x += GAP) {
        for (let y = GAP / 2; y < height; y += GAP) grid.push({ x, y })
      }
    }

    const seed = () => {
      if (reduced) {
        particles = grid.map((cell) => ({
          x: cell.x, y: cell.y, hx: cell.x, hy: cell.y, gx: cell.x, gy: cell.y,
          keep: true, human: false, seed: 0, lastX: cell.x, lastY: cell.y,
        }))
        return
      }
      const points = sentencePoints()
      for (let i = points.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[points[i], points[j]] = [points[j], points[i]]
      }
      const total = Math.max(grid.length, points.length)
      particles = []
      for (let i = 0; i < total; i += 1) {
        const cell = grid[i % grid.length]
        const target = points.length ? points[i % points.length] : { ...cell, human: false }
        const angle = Math.random() * Math.PI * 2
        const distance = Math.max(width, height) * (0.55 + Math.random() * 0.5)
        particles.push({
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance,
          hx: target.x + (Math.random() - 0.5) * 2.2,
          hy: target.y + (Math.random() - 0.5) * 2.2,
          gx: cell.x, gy: cell.y,
          keep: i < grid.length,
          human: Boolean(target.human),
          seed: Math.random(),
          lastX: cell.x, lastY: cell.y,
        })
      }
    }

    let pointerX = window.innerWidth / 2
    let pointerY = window.innerHeight / 2
    let drifting = true
    let phase = 0
    let started = performance.now()

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX; pointerY = event.clientY; drifting = false
    }
    const onPointerLeave = () => { drifting = true }
    const onResize = () => { measure(); seed() }

    const ease = (value: number) => 1 - (1 - value) ** 3
    const clamp = (value: number) => Math.min(1, Math.max(0, value))

    const frame = (now: number) => {
      if (!running) return
      const elapsed = now - started
      phase += 0.006
      if (drifting) {
        pointerX = width / 2 + Math.cos(phase) * width * 0.22
        pointerY = height / 2 + Math.sin(phase * 1.3) * height * 0.18
      }
      context.clearRect(0, 0, width, height)
      for (const particle of particles) {
        let x: number; let y: number
        let warmth = 0; let radius = 0.7; let alpha = 1

        if (elapsed < STAGE.hold) {
          const k = ease(clamp((elapsed - STAGE.enter - particle.seed * STAGE.spread) / STAGE.rise))
          x = particle.x + (particle.hx - particle.x) * k
          y = particle.y + (particle.hy - particle.y) * k
          particle.lastX = x; particle.lastY = y
          warmth = k * (particle.human ? 1 : 0.72)
          radius = 0.8 + k * (particle.human ? 0.95 : 0.7)
        } else if (elapsed < STAGE.melt + 500) {
          /* «الإنسان» يتأخّر في التفكّك: مقاومةٌ محسوسةٌ لا تُشرح. */
          const k = ease(clamp((elapsed - STAGE.hold - (particle.human ? 460 : 0)) / (STAGE.melt - STAGE.hold)))
          x = particle.lastX + (particle.gx - particle.lastX) * k
          y = particle.lastY + (particle.gy - particle.lastY) * k
          warmth = (particle.human ? 1 : 0.72) * (1 - k)
          radius = (particle.human ? 1.75 : 1.5) - 0.85 * k
          if (!particle.keep) alpha = 1 - k
        } else {
          if (!particle.keep) continue
          x = particle.gx; y = particle.gy
          warmth = Math.max(0, 1 - Math.hypot(x - pointerX, y - pointerY) / RADIUS)
          radius = 0.7 + warmth * 1.9
        }

        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle = warmth > 0.02
          ? `rgba(${176 + 40 * warmth},${141 + 40 * warmth},${87 + 60 * warmth},${(0.14 + 0.62 * warmth) * alpha})`
          : `rgba(252,252,250,${0.07 * alpha})`
        context.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    /* التبويب المخفيّ لا يُرسم له: بطاريةُ الهاتف أهمّ من مشهدٍ لا يراه أحد. */
    const onVisibility = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf) }
      else if (!running) { running = true; raf = requestAnimationFrame(frame) }
    }

    measure(); seed()
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibility)

    if (reduced) {
      for (const particle of particles) {
        context.beginPath()
        context.arc(particle.gx, particle.gy, 0.7, 0, Math.PI * 2)
        context.fillStyle = 'rgba(252,252,250,0.07)'
        context.fill()
      }
    } else {
      const begin = () => { seed(); started = performance.now(); raf = requestAnimationFrame(frame) }
      if (document.fonts?.ready) document.fonts.ready.then(begin).catch(begin)
      else begin()
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reduced])

  const say = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const saveContact = () => {
    const blob = new Blob([buildVCard()], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Dr-Ahmad-Alfailakawi.vcf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    say('تم تنزيل جهة الاتصال')
  }

  const share = async () => {
    const url = `${site.url}${CARD_PATH}`
    try {
      if (navigator.share) await navigator.share({ title: profile.fullName, url })
      else { await navigator.clipboard.writeText(url); say('تم نسخ الرابط') }
    } catch { /* إلغاء المشاركة ليس خطأً يُبلَّغ عنه */ }
  }

  const chips = [
    { label: 'الموقع', href: '/' },
    { label: 'المقالات', href: '/articles' },
    { label: 'الكتب', href: '/publications' },
    { label: 'الأبحاث', href: '/research' },
    { label: 'مجلس الفكرة', href: '/listen' },
  ]

  return (
    <div className="card-live" dir="rtl">
      <canvas ref={canvasRef} className="card-live__field" aria-hidden="true" />
      <div className="card-live__vignette" aria-hidden="true" />

      <main className={`card-live__card${revealed ? ' is-revealed' : ''}`}>
        <h1 className="card-live__name">د. أحمد حسين<br />الفيلكاوي</h1>
        <p className="card-live__role">{profile.eyebrow}<br />كاتب وباحث ومستشار</p>

        <div className="card-live__rule" />
        <p className="card-live__thesis">أُبقي الإنسان في قلب الآلة.</p>

        <div className="card-live__stats">
          {stats.map((item, index) => (
            <div key={item.label} className="card-live__stat">
              <div className="card-live__num">{counts[index]}</div>
              <div className="card-live__lbl">{item.label}</div>
            </div>
          ))}
        </div>

        <nav className="card-live__links" aria-label="روابط رسمية">
          {chips.map((chip) => (
            <a key={chip.href} className="card-live__chip" href={chip.href}>{chip.label}</a>
          ))}
          {/* المعرّف اللاتيني داخل سطرٍ عربي: بلا bdi يقلبه المتصفح إلى
              «drahmadkw@ X». العزل يبقيه كما يُكتب. */}
          <a className="card-live__chip" href="https://x.com/drahmadkw" target="_blank" rel="noopener noreferrer">
            X <bdi dir="ltr">@drahmadkw</bdi>
          </a>
        </nav>

        <div className="card-live__actions">
          <button type="button" className="card-live__primary" onClick={saveContact}>حفظ جهة الاتصال</button>
          <button type="button" className="card-live__ghost" onClick={share}>مشاركة</button>
        </div>
      </main>

      <div className={`card-live__toast${toast ? ' is-on' : ''}`} role="status">{toast}</div>
    </div>
  )
}
