import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, SocialIcon } from '../ui'
import { profile } from '../../data'
import { currentSeason, seasonStrokePath } from '../../lib/seasons'

/* لمسة الموسم: رسمة خطٍّ واحد (هلال، شراع) تحضر بأدب أيام المناسبة وتغيب
   سائر السنة — تشاركها نواة التقويم نفسها مع استوديو التصاميم. */
function SeasonalGrace() {
  const season = useMemo(() => currentSeason(), [])
  if (!season) return null
  const star = season.id === 'eid-fitr' || season.id === 'eid-adha'
    ? <circle cx="78" cy="26" r="4" fill="currentColor" />
    : null
  return (
    <span className="human-core__season" aria-hidden="true" title={season.greeting}>
      <svg viewBox="0 0 100 100" role="presentation">
        <path d={seasonStrokePath(season.id)} fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        {star}
      </svg>
    </span>
  )
}

type Point = { x: number; y: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function cssRgb(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

export default function HumanCoreHero() {
  const reduce = useReducedMotion()
  const heroRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const portraitRef = useRef<HTMLDivElement>(null)
  const target = useRef<Point>({ x: 0.64, y: 0.42 })
  const current = useRef<Point>({ x: 0.64, y: 0.42 })
  const lastInteraction = useRef(0)
  const [mobileVisual, setMobileVisual] = useState(false)
  const { scrollY } = useScroll()
  const portraitY = useTransform(scrollY, [0, 800], [0, 34])

  useEffect(() => {
    const query = window.matchMedia('(hover: none), (pointer: coarse), (max-width: 767px)')
    const update = () => setMobileVisual(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const hero = heroRef.current
    const canvas = canvasRef.current
    const portrait = portraitRef.current
    if (!hero || !canvas || !portrait || reduce) return

    if (mobileVisual) {
      canvas.width = 1
      canvas.height = 1
      canvas.style.display = 'none'
      portrait.style.setProperty('--human-x', '50%')
      portrait.style.setProperty('--human-y', '50%')
      portrait.style.setProperty('--human-r', '100%')
      portrait.style.setProperty('--human-presence', '1')
      portrait.style.setProperty('--human-opacity', '1')
      portrait.style.setProperty('--human-scan', '0')
      portrait.style.setProperty('--human-glow', '0')
      return
    }
    canvas.style.display = ''

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1
    let visible = true
    let accent = '62 92 120'
    let ink = '21 22 26'
    let coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches
    let themeDark = document.documentElement.classList.contains('dark')
    let lastDraw = 0

    const readTheme = () => {
      accent = cssRgb('--c-accent', '62 92 120')
      ink = cssRgb('--c-ink', '21 22 26')
      themeDark = document.documentElement.classList.contains('dark')
    }

    const resize = () => {
      const rect = hero.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.15 : 1.55)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const updateTarget = (clientX: number, clientY: number) => {
      const rect = hero.getBoundingClientRect()
      target.current.x = clamp((clientX - rect.left) / rect.width, 0.02, 0.98)
      target.current.y = clamp((clientY - rect.top) / rect.height, 0.04, 0.96)
      lastInteraction.current = performance.now()
    }

    const pointerMove = (event: PointerEvent) => updateTarget(event.clientX, event.clientY)
    const pointerDown = (event: PointerEvent) => updateTarget(event.clientX, event.clientY)

    const drawGrid = (px: number, py: number) => {
      const grid = width < 700 ? 56 : 64
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgb(${accent} / ${themeDark ? 0.085 : 0.07})`

      for (let x = -grid; x <= width + grid; x += grid) {
        ctx.beginPath()
        for (let y = -20; y <= height + 20; y += 18) {
          const dx = x - px
          const dy = y - py
          const distance = Math.hypot(dx, dy)
          const influence = Math.max(0, 1 - distance / 250)
          const bend = influence * Math.sin((y - py) / 38) * 18
          const xx = x + bend
          if (y === -20) ctx.moveTo(xx, y)
          else ctx.lineTo(xx, y)
        }
        ctx.stroke()
      }

      for (let y = -grid; y <= height + grid; y += grid) {
        ctx.beginPath()
        for (let x = -20; x <= width + 20; x += 18) {
          const dx = x - px
          const dy = y - py
          const distance = Math.hypot(dx, dy)
          const influence = Math.max(0, 1 - distance / 250)
          const bend = influence * Math.sin((x - px) / 42) * 15
          const yy = y + bend
          if (x === -20) ctx.moveTo(x, yy)
          else ctx.lineTo(x, yy)
        }
        ctx.stroke()
      }
    }

    const drawFingerprint = (px: number, py: number, time: number) => {
      const glow = ctx.createRadialGradient(px, py, 0, px, py, Math.min(300, width * 0.32))
      glow.addColorStop(0, `rgb(${accent} / ${themeDark ? 0.14 : 0.1})`)
      glow.addColorStop(0.42, `rgb(${accent} / ${themeDark ? 0.055 : 0.035})`)
      glow.addColorStop(1, `rgb(${accent} / 0)`)
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-0.12)
      for (let i = 0; i < 13; i += 1) {
        const radiusX = 34 + i * 14
        const radiusY = 46 + i * 18
        const pulse = Math.sin(time * 0.0015 + i * 0.55) * 2.2
        ctx.beginPath()
        ctx.ellipse(0, 5, radiusX + pulse, radiusY + pulse, 0, Math.PI * (0.12 + (i % 3) * 0.04), Math.PI * (1.72 - (i % 2) * 0.08))
        ctx.strokeStyle = `rgb(${accent} / ${themeDark ? 0.18 - i * 0.006 : 0.145 - i * 0.005})`
        ctx.lineWidth = i < 4 ? 1.35 : 1
        ctx.stroke()
      }
      ctx.restore()

      const pulseRadius = 12 + ((time * 0.035) % 76)
      ctx.beginPath()
      ctx.arc(px, py, pulseRadius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgb(${accent} / ${Math.max(0, 0.17 - pulseRadius / 520)})`
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(px, py, 3.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgb(${ink} / ${themeDark ? 0.7 : 0.5})`
      ctx.fill()
    }

    const drawNodes = (px: number, py: number, time: number) => {
      const step = width < 700 ? 112 : 128
      for (let y = step * 0.65; y < height; y += step) {
        for (let x = step * 0.4; x < width; x += step) {
          const distance = Math.hypot(x - px, y - py)
          const influence = Math.max(0, 1 - distance / 310)
          const radius = 1 + influence * 1.8 + Math.sin(time * 0.001 + x) * 0.15
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${accent} / ${0.08 + influence * 0.16})`
          ctx.fill()
        }
      }
    }

    const updatePortrait = (px: number, py: number) => {
      const heroRect = hero.getBoundingClientRect()
      const rect = portrait.getBoundingClientRect()
      const localX = px + heroRect.left - rect.left
      const localY = py + heroRect.top - rect.top
      const xPct = clamp((localX / rect.width) * 100, 0, 100)
      const yPct = clamp((localY / rect.height) * 100, 0, 100)
      const edgeX = Math.max(rect.left - (px + heroRect.left), 0, px + heroRect.left - rect.right)
      const edgeY = Math.max(rect.top - (py + heroRect.top), 0, py + heroRect.top - rect.bottom)
      const outside = Math.hypot(edgeX, edgeY)
      const reveal = clamp(74 - outside * 0.14, 18, 74)
      portrait.style.setProperty('--human-x', `${xPct}%`)
      portrait.style.setProperty('--human-y', `${yPct}%`)
      portrait.style.setProperty('--human-r', `${reveal}%`)
      const presence = clamp(1 - outside / 460, 0.12, 1)
      portrait.style.setProperty('--human-presence', `${presence}`)
      portrait.style.setProperty('--human-opacity', `${0.26 + presence * 0.74}`)
      portrait.style.setProperty('--human-scan', `${themeDark ? 0.16 + (1 - presence) * 0.28 : 0.2 + (1 - presence) * 0.45}`)
      portrait.style.setProperty('--human-glow', `${presence * (themeDark ? 0.2 : 0.16)}`)
    }

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden || !width || !height) return
      const frameInterval = coarse ? 33 : 20
      if (time - lastDraw < frameInterval) return
      lastDraw = time

      if (coarse && time - lastInteraction.current > 2600) {
        target.current.x = 0.56 + Math.sin(time * 0.00034) * 0.17
        target.current.y = 0.43 + Math.cos(time * 0.00029) * 0.13
      }

      current.current.x += (target.current.x - current.current.x) * (coarse ? 0.035 : 0.075)
      current.current.y += (target.current.y - current.current.y) * (coarse ? 0.035 : 0.075)
      const px = current.current.x * width
      const py = current.current.y * height

      ctx.clearRect(0, 0, width, height)
      drawGrid(px, py)
      drawNodes(px, py, time)
      drawFingerprint(px, py, time)
      updatePortrait(px, py)
    }

    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: 0.02 })
    const resizeObserver = new ResizeObserver(resize)
    const themeObserver = new MutationObserver(readTheme)

    readTheme()
    resize()
    intersection.observe(hero)
    resizeObserver.observe(hero)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    hero.addEventListener('pointermove', pointerMove, { passive: true })
    hero.addEventListener('pointerdown', pointerDown, { passive: true })
    window.addEventListener('resize', resize, { passive: true })
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      intersection.disconnect()
      resizeObserver.disconnect()
      themeObserver.disconnect()
      hero.removeEventListener('pointermove', pointerMove)
      hero.removeEventListener('pointerdown', pointerDown)
      window.removeEventListener('resize', resize)
    }
  }, [mobileVisual, reduce])

  return (
    <header ref={heroRef} className="human-core relative flex min-h-[92svh] items-center overflow-hidden px-6 pb-24 pt-24 md:px-11 md:pb-24 md:pt-24">
      <SeasonalGrace />
      <canvas ref={canvasRef} className="human-core__canvas pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="human-core__wash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="human-core__words pointer-events-none absolute inset-0" aria-hidden="true">
        <span style={{ insetInlineStart: '8%', top: '24%' }}>وعي</span>
        <span style={{ insetInlineStart: '15%', bottom: '24%' }}>معنى</span>
        <span style={{ insetInlineEnd: '12%', bottom: '28%' }}>مستقبل</span>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-shell items-center gap-8 md:grid-cols-[1.08fr_.92fr] md:gap-12 lg:gap-16">
        <div className="order-1 relative md:order-2 md:-translate-x-6 lg:-translate-x-10">
          <h1 className="human-core__title font-display text-[clamp(2.1rem,5.4vw,4rem)] font-bold leading-[1.28] text-ink">
            <span className="-my-[0.3em] block overflow-hidden py-[0.3em]">
              <motion.span
                className="human-core__title-line block"
                initial={reduce ? false : { y: '150%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.76, delay: 0.18, ease: EASE }}
              >
                أُبقي <span className="human-core__human">الإنسانَ</span>
              </motion.span>
            </span>
            <span className="-my-[0.3em] block overflow-hidden py-[0.3em]">
              <motion.span
                className="human-core__title-line human-core__machine block"
                initial={reduce ? false : { y: '150%' }}
                animate={{ y: 0 }}
                transition={{ duration: 0.76, delay: 0.28, ease: EASE }}
              >
                في قلبِ الآلة.
              </motion.span>
            </span>
          </h1>

          <div className="human-core__signal my-7" aria-hidden="true">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.72, delay: 0.48, ease: EASE }} />
            <i />
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.52, delay: 0.62, ease: EASE }}
          >
            <p className="font-display text-[clamp(1.15rem,2.4vw,1.6rem)] font-semibold text-ink">{profile.name}</p>
            <p className="human-core__tagline mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[.95rem] font-light"><span className="whitespace-nowrap">أستاذ تكنولوجيا التعليم والذكاء الاصطناعي</span><span className="whitespace-nowrap">· باحث</span><span className="whitespace-nowrap">· مستشار</span></p>
          </motion.div>
        </div>

        <div className="order-2 flex justify-center md:order-1">
          <motion.div style={mobileVisual ? undefined : { y: portraitY }} className="human-core__portrait-shell w-full max-w-[310px] md:max-w-[520px]">
            <motion.div
              ref={portraitRef}
              className="human-core__portrait relative"
              initial={reduce ? false : { opacity: 0, y: 26, scale: 1.03 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.82, delay: 0.58, ease: EASE }}
              data-hover={mobileVisual ? undefined : true}
            >
              <div className="human-core__orbit" aria-hidden="true"><span /><span /><span /></div>
              <div className="human-core__portrait-media relative overflow-hidden rounded-xl border border-hair">
                <img src="/portrait.webp" alt={profile.fullName} width={1345} height={2048} decoding="async" className="human-core__portrait-base block h-full w-full object-cover" />
                <div className="human-core__portrait-color absolute inset-0" aria-hidden="true">
                  <img src="/portrait.webp" alt="" width={1345} height={2048} decoding="async" className="block h-full w-full object-cover" />
                </div>
                <div className="human-core__scan absolute inset-0" aria-hidden="true" />
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          className="order-3 md:col-span-2"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: .5, delay: .76, ease: EASE }}
        >
          <Link to="/cv" className="human-core__cv group mx-auto flex w-full max-w-[620px] items-center justify-between gap-4 rounded-2xl border border-hair bg-wash/70 px-5 py-4 text-right md:px-6">
            <span className="min-w-0">
              <span className="block text-[.7rem] font-semibold text-accent">المسار الأكاديمي والمهني</span>
              <span className="mt-1 block font-display text-[1rem] font-semibold leading-[1.5] text-ink transition-colors group-hover:text-accent md:text-[1.15rem]">المسيرة التي صنعت الأسئلة.</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="CV" size={17} /></span>
          </Link>
        </motion.div>
      </div>

      <svg className="human-core__bridge pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 565 415 C 730 335, 775 530, 955 410" />
        <path className="human-core__bridge-pulse" d="M 565 415 C 730 335, 775 530, 955 410" />
      </svg>


    </header>
  )
}
