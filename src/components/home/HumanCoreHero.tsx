import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { EASE, SocialIcon } from '../ui'
import { profile } from '../../data'

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
  const { scrollY } = useScroll()
  const portraitY = useTransform(scrollY, [0, 800], [0, 34])

  useEffect(() => {
    const hero = heroRef.current
    const canvas = canvasRef.current
    const portrait = portraitRef.current
    if (!hero || !canvas || !portrait || reduce) return

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
  }, [reduce])

  return (
    <header ref={heroRef} className="human-core relative flex min-h-[100svh] items-center overflow-hidden px-6 pb-28 pt-24 md:px-11 md:pb-28 md:pt-28">
      <canvas ref={canvasRef} className="human-core__canvas pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="human-core__wash pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="human-core__words pointer-events-none absolute inset-0" aria-hidden="true">
        <span style={{ insetInlineStart: '8%', top: '24%' }}>وعي</span>
        <span style={{ insetInlineEnd: '9%', top: '19%' }}>تعليم</span>
        <span style={{ insetInlineStart: '15%', bottom: '24%' }}>معنى</span>
        <span style={{ insetInlineEnd: '12%', bottom: '28%' }}>مستقبل</span>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-shell items-center gap-8 md:grid-cols-[1.15fr_.85fr] md:gap-16">
        <div className="order-1 relative">
          <div className="human-core__micro mb-4 flex items-center gap-3 text-[.66rem] font-semibold tracking-[.18em] text-accent" aria-hidden="true">
            <span className="h-px w-8 bg-accent/50" />
            HUMAN / MACHINE / MEANING
          </div>

          <h1 className="human-core__title font-display text-[clamp(2.1rem,5.4vw,4rem)] font-bold leading-[1.28] text-ink">
            <span className="-my-[0.3em] block overflow-hidden py-[0.3em]">
              <motion.span
                className="human-core__title-line block"
                data-echo="أُبقي الإنسانَ"
                initial={reduce ? false : { y: '150%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1, delay: 0.25, ease: EASE }}
              >
                أُبقي <span className="human-core__human">الإنسانَ</span>
              </motion.span>
            </span>
            <span className="-my-[0.3em] block overflow-hidden py-[0.3em]">
              <motion.span
                className="human-core__title-line human-core__machine block"
                data-echo="في قلبِ الآلة."
                initial={reduce ? false : { y: '150%' }}
                animate={{ y: 0 }}
                transition={{ duration: 1, delay: 0.39, ease: EASE }}
              >
                في قلبِ الآلة.
              </motion.span>
            </span>
          </h1>

          <div className="human-core__signal my-7" aria-hidden="true">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.05, delay: 0.68, ease: EASE }} />
            <i />
          </div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.85, ease: EASE }}
          >
            <p className="font-display text-[clamp(1.15rem,2.4vw,1.6rem)] font-semibold text-ink">{profile.name}</p>
            <p className="mt-1.5 text-[.95rem] font-light text-soft">أستاذ تكنولوجيا التعليم والذكاء الاصطناعي · باحث · مستشار</p>
          </motion.div>
        </div>

        <div className="order-2 flex justify-center">
          <motion.div style={{ y: portraitY }} className="human-core__portrait-shell w-full max-w-[260px] md:max-w-[400px]">
            <motion.div
              ref={portraitRef}
              className="human-core__portrait relative"
              initial={reduce ? false : { opacity: 0, y: 26, scale: 1.03 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.1, delay: 0.75, ease: EASE }}
              data-hover
            >
              <div className="human-core__orbit" aria-hidden="true"><span /><span /><span /></div>
              <div className="human-core__portrait-media relative overflow-hidden rounded-2xl shadow-[0_36px_64px_-36px_rgba(21,22,26,.42)]">
                <img src="/portrait.jpg" alt={profile.fullName} width={900} height={1350} decoding="async" className="human-core__portrait-base block h-auto w-full" />
                <div className="human-core__portrait-color absolute inset-0" aria-hidden="true">
                  <img src="/portrait.jpg" alt="" width={900} height={1350} decoding="async" className="block h-auto w-full" />
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
          transition={{ duration: .75, delay: 1.05, ease: EASE }}
        >
          <Link to="/cv" className="human-core__cv group mx-auto flex w-full max-w-[620px] items-center justify-between gap-4 rounded-2xl border border-hair bg-wash/70 px-5 py-4 text-right md:px-6">
            <span className="min-w-0">
              <span className="block text-[.7rem] font-semibold text-accent">المسار الأكاديمي والمهني</span>
              <span className="mt-1 block font-display text-[1rem] font-semibold leading-[1.5] text-ink transition-colors group-hover:text-accent md:text-[1.15rem]">المسيرة التي صنعت الأسئلة.</span>
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-transform duration-300 group-hover:-translate-y-0.5"><SocialIcon name="CV" size={17} /></span>
          </Link>
        </motion.div>
      </div>

      <svg className="human-core__bridge pointer-events-none absolute inset-0 hidden h-full w-full md:block" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 565 415 C 730 335, 775 530, 955 410" />
        <path className="human-core__bridge-pulse" d="M 565 415 C 730 335, 775 530, 955 410" />
      </svg>

      <motion.div
        className="cue absolute bottom-3 left-1/2 z-20 -translate-x-1/2 text-[.74rem] text-soft md:bottom-7"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
      >
        اكتشف
        <span className="relative mx-auto mt-2.5 block h-[30px] w-px overflow-hidden bg-hair" />
      </motion.div>
    </header>
  )
}
