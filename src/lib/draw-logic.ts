/**
 * منطق «الرسم عند الظهور» الخالص — بلا React ولا DOM، فيُختبر مباشرةً في Node
 * (scripts/test-draw-in.mjs). src/components/DrawIn.tsx يستعمله.
 *
 * القاعدة: القيمة النهائية هي الحقيقة دائماً؛ الحركة زخرفٌ فوقها لا يؤخّر شيئاً.
 */

/** المنحنى الموحّد للموقع cubic-bezier(.2,.7,.2,1) — القيم نفسها في components/motion.ts. */
const [X1, Y1, X2, Y2] = [0.2, 0.7, 0.2, 1] as const

const axis = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3

/** تقدّمٌ مُسهَّل بالمنحنى الموحّد: t في [0,1] → [0,1]. */
export function easeE(t: number) {
  if (!(t > 0)) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2
    if (axis(mid, X1, X2) < t) lo = mid
    else hi = mid
  }
  return axis((lo + hi) / 2, Y1, Y2)
}

/** قيمة العدّاد بعد مرور جزءٍ t من المدة: الأعداد الصحيحة تبقى صحيحة، وt=1 تعطي القيمة النهائية تماماً. */
export function countAt(value: number, t: number) {
  if (!Number.isFinite(value)) return value
  if (t >= 1) return value
  const raw = value * easeE(t)
  return Number.isInteger(value) ? Math.round(raw) : raw
}

/** تأخير العنصر رقم index في تتابعٍ: خطوةٌ ثابتة بسقفٍ كلّي، فلا يطول التتابع بكثرة العناصر. */
export function staggerMs(index: number, stepMs = 60, capMs = 600) {
  return Math.max(0, Math.min(capMs, Math.round(index * stepMs)))
}

/** هل قيمة الدخول تستحق تغييراً مرئياً؟ (لا وميض عند أول عرض ولا عند الترطيب السريع بعد التركيب.) */
export function shouldFlash(previous: number | string | null, next: number | string, sinceMountMs: number, graceMs = 600) {
  if (previous === null || previous === next) return false
  return sinceMountMs > graceMs
}
