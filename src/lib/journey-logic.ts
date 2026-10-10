/**
 * منطق «رحلة المحطّات» الخالص — بلا React ولا DOM، فيُختبر مباشرةً في Node
 * (scripts/test-journey-stepper.mjs). المكوّن src/components/JourneyStepper.tsx يستعمله.
 */

export type JourneyState = 'done' | 'current' | 'pending'

/** مدة المحطّة الواحدة: تُقسَّم ~4 ثوانٍ على العدد وتُحصر بين 350 و750ms. */
export const journeyStepMs = (count: number) => Math.round(Math.min(750, Math.max(350, 4000 / Math.max(1, count))))

/** عدد المحطات الصادقة الإضاءة: فهرس آخر محطة منجزة/جارية + 1 (صفر إن لم يبدأ شيء). */
export const journeyTarget = (states: readonly JourneyState[]) =>
  states.reduce((last, state, index) => (state === 'pending' ? last : index + 1), 0)

/** الحالة المعروضة: `lit === null` = استقرّ فالحقيقية؛ وإلا فما لم يُضأ بعد يُعرض «لم يُنجز». */
export const shownState = (real: JourneyState, index: number, lit: number | null): JourneyState =>
  (lit === null || index < lit ? real : 'pending')

/**
 * هل يُملأ الخيط بعد المحطة `index`؟ فقط حين تكون هي منجزة والتالية (كما تُعرض الآن)
 * غير «لم تُنجز»: فلا يُرسم خطٌّ ملوَّن نحو محطةٍ فارغة، ولا يسبق الخيطُ المحطةَ التي يصل إليها.
 */
export const linkFilled = (shown: readonly JourneyState[], index: number) =>
  shown[index] === 'done' && index + 1 < shown.length && shown[index + 1] !== 'pending'

/** العتبة الفعلية: تُنزَّل إلى ما يمكن بلوغه (عنصرٌ أطول من الشاشة). */
export const effectiveThreshold = (threshold: number, elementHeight: number, viewportHeight: number) => {
  const reachable = (0.85 * viewportHeight) / elementHeight
  return Math.max(0.05, Math.min(threshold, reachable))
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }

const PREFIX = 'journey-played:'

/** ذاكرة «ما عُرض فعلاً»: Set في الوحدة + تخزين الجلسة إن توفّر. التخزين اختياري. */
export function createPlayedStore(getStorage: () => StorageLike | undefined) {
  const played = new Set<string>()
  const storage = () => { try { return getStorage() } catch { return undefined } }
  return {
    has(playKey?: string) {
      if (!playKey) return false
      if (played.has(playKey)) return true
      try { return storage()?.getItem(PREFIX + playKey) === '1' } catch { return false }
    },
    mark(playKey?: string) {
      if (!playKey) return
      played.add(playKey)
      try { storage()?.setItem(PREFIX + playKey, '1') } catch { /* التخزين اختياري */ }
    },
  }
}
