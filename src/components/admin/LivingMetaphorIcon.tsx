/**
 * الأيقونة الحيّة — استعارةٌ من مكتبة الريل (٥٣ صورة) تُختار بحسب معنى التصميم
 * من معجم الدكتور، وتتحرّك بألوان التصميم نفسه في زاويته: كخاتمٍ لا كلصقة.
 *
 * تُستعمل في استوديو التصاميم والمنشور المستقل معاً عبر مكوّنٍ واحد، ولها
 * مفتاح تشغيل/إيقاف يحفظه المتصفح فيتذكّره الدكتور. تظهر في المعاينة فقط ولا
 * تدخل SVG المُصدَّر، فتبقى تصاميم العارض سليمة. وتُحترم رغبة تقليل الحركة.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { interpretDrAhmadDomain } from '../../lib/dr-ahmad-domain-glossary'
import { paintMetaphor, chooseMetaphors, type MetaphorId } from '../../lib/reel-metaphors'
import { resolvePalette, type CompositionPlan } from '../../lib/social-design-engine'

const STORAGE_KEY = 'reel:living-icon:v1'
const CHANGE_EVENT = 'living-icon-change'

function readEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

/** مفتاحٌ مشترك: يُبقي كل الأماكن متزامنةً في الصفحة نفسها وعبر التبويبات. */
export function useLivingIconEnabled(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readEnabled)
  useEffect(() => {
    const sync = () => setEnabled(readEnabled())
    window.addEventListener(CHANGE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(CHANGE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = (next: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off') } catch { /* تخزينٌ محجوب */ }
    setEnabled(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return [enabled, update]
}

/** زرّ صغير أنيق للاختيار — أبيه أو لا. */
export function LivingIconToggle({ className = '' }: { className?: string }) {
  const [enabled, setEnabled] = useLivingIconEnabled()
  return (
    <button
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[.68rem] font-semibold transition-colors ${enabled ? 'border-accent bg-accent/[.08] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'} ${className}`}
      title="أيقونة حيّة تُختار من المكتبة بحسب معنى التصميم وتتحرّك بألوانه — في المعاينة فقط"
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${enabled ? 'bg-accent' : 'bg-soft/40'}`} />
      الأيقونة الحيّة {enabled ? 'مفعّلة' : 'متوقفة'}
    </button>
  )
}

function metaphorFor(plan: CompositionPlan): MetaphorId {
  const c = plan.content
  const text = [c.title, c.heroWord, c.quote, c.kicker, c.subtitle, c.body].filter(Boolean).join(' ')
  const domain = interpretDrAhmadDomain(text.slice(0, 1200))
  const chosen = chooseMetaphors([domain.primary?.canonicalAr || '', domain.visualScenes.join(' · '), text.slice(0, 600)], 1)
  return chosen[0] || 'figure-contemplate'
}

/** مواضع الأيقونة داخل التصميم — تسع نقاط، تتنوّع بحسب التصميم بلا مساسٍ بالنص. */
export type LivingIconCorner =
  | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  | 'bottom-center' | 'top-center' | 'mid-start' | 'mid-end' | 'center'

const CORNER_CLASS: Record<LivingIconCorner, string> = {
  'bottom-start': 'bottom-[4%] left-[4%]',
  'bottom-end': 'bottom-[4%] right-[4%]',
  'top-start': 'top-[4%] left-[4%]',
  'top-end': 'top-[4%] right-[4%]',
  'bottom-center': 'bottom-[4%] left-1/2 -translate-x-1/2',
  'top-center': 'top-[5%] left-1/2 -translate-x-1/2',
  'mid-start': 'top-1/2 left-[4%] -translate-y-1/2',
  'mid-end': 'top-1/2 right-[4%] -translate-y-1/2',
  'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
}

/**
 * اختيار الموضع بإبداعٍ لا عشوائية: التكوين يحكم أولاً (أين الفراغ الأرجح في
 * هذا التخطيط)، وبصمةُ التصميم ترجّح بين المواضع المسموحة فيتنوّع المكان بين
 * تصميمٍ وآخر ويبقى ثابتاً للتصميم نفسه. والحجم يتنفّس قليلاً مع البصمة.
 */
const LAYOUT_ANCHORS: Record<string, LivingIconCorner[]> = {
  // العنوان أعلى غالباً → الفراغ أسفل
  default: ['bottom-start', 'bottom-end', 'bottom-center', 'mid-end'],
  // تخطيطات يتصدّرها النص في الوسط → الزوايا آمنة
  centered: ['top-start', 'top-end', 'bottom-start', 'bottom-end'],
  // تخطيطات الشريط الجانبي → الجهة المقابلة
  rail: ['mid-end', 'bottom-end', 'top-end'],
}

function hashString(value: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 0x01000193) }
  return hash >>> 0
}

function choosePlacement(plan: CompositionPlan): { corner: LivingIconCorner; size: number } {
  const layout = String(plan.layout || '')
  const family = /center|axis|stage|hero/i.test(layout) ? 'centered' : /rail|side|column|split/i.test(layout) ? 'rail' : 'default'
  const anchors = LAYOUT_ANCHORS[family] || LAYOUT_ANCHORS.default
  const seed = hashString(`${plan.fingerprint || plan.id}:${layout}`)
  const corner = anchors[seed % anchors.length]
  /* الحجم يتنوّع بين ١٦٪ و٢٤٪ — الأصغر للزوايا الحسّاسة، والأكبر حين يتّسع الفراغ. */
  const sizeBase = corner === 'center' ? 26 : corner.includes('center') ? 22 : 18
  const size = sizeBase + ((seed >> 8) % 3) * 2
  return { corner, size }
}

export function LivingMetaphorIcon({ plan, corner, size }: { plan: CompositionPlan; corner?: LivingIconCorner; size?: number }) {
  const placement = useMemo(() => choosePlacement(plan), [plan])
  const resolvedCorner = corner ?? placement.corner
  const resolvedSize = size ?? placement.size
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const metaphor = useMemo(() => metaphorFor(plan), [plan])
  const colors = useMemo(() => {
    const pal = resolvePalette(plan)
    return { ink: pal.ink, dim: pal.muted, accent: pal.accent, accent2: pal.accentSoft || pal.accent, danger: pal.accent, surface: pal.surface, isDark: pal.isDark }
  }, [plan])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const S = 260
    canvas.width = S
    canvas.height = S
    let raf = 0
    const started = performance.now()
    const paint = { ink: colors.ink, dim: colors.dim, accent: colors.accent, accent2: colors.accent2, danger: colors.danger }
    const frame = () => {
      const t = (performance.now() - started) / 1000
      ctx.clearRect(0, 0, S, S)
      ctx.save()
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2)
      ctx.fillStyle = colors.surface
      ctx.globalAlpha = colors.isDark ? 0.42 : 0.66
      ctx.fill()
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 2
      ctx.strokeStyle = colors.accent
      ctx.stroke()
      ctx.restore()
      const prog = reduce ? 1 : Math.min(1, (t % 6) / 2.4)
      paintMetaphor(ctx, metaphor, S / 2, S / 2, S * 0.6, t, prog, paint)
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    if (reduce) frame()
    else raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [metaphor, colors])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute z-10 aspect-square max-w-[128px] min-w-14 drop-shadow ${CORNER_CLASS[resolvedCorner]}`}
      style={{ width: `${resolvedSize}%` }}
      aria-hidden="true"
    />
  )
}
