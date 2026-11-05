/**
 * بصمة مصدر الريل — تربط خطة Flow بالنص الذي بُنيت منه.
 *
 * العيب الذي تعالجه: الخطة (القالب والمشاهد والعالم) تُبنى مرة عند الضغط على «جهّز الريل»
 * وتبقى في الحالة. لو عدّل المستخدم العنوان أو المتن أو العالم بعدها، بقيت المعاينة والتصدير
 * تعملان على الخطة القديمة فيُنزَّل فيديو لا يطابق النص الظاهر في الحقول.
 *
 * الملف نقيّ بلا استيراد (يُختبر تحت node مباشرة). البصمة تتجاهل فروق المسافات فقط؛ أي تغيير
 * في الكلمات أو العالم يُبطل الخطة.
 */

export interface ReelSourceInput {
  title: string
  body: string
  /** معرّف العالم المثبَّت يدوياً، أو null/undefined إن ترك المخرج الاختيار. */
  worldId?: string | null
}

export interface ReelSourceNormalized { title: string; body: string; worldId: string }

const FIRST_SENTENCE = /[\n.!؟…]/

/** نفس قاعدة الاشتقاق التي يبني بها الاستوديو الخطة: عنوان فارغ → أول جملة من المتن → «مادة جديدة». */
export function normalizeReelSource(input: ReelSourceInput): ReelSourceNormalized {
  const rawBody = (input.body || '').trim()
  const title = (input.title || '').trim() || rawBody.split(FIRST_SENTENCE)[0]?.trim() || 'مادة جديدة'
  return { title, body: rawBody || title, worldId: input.worldId || '' }
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim()

/** هل في المصدر مادة تصلح للبناء؟ (عنوان أو متن غير فارغ). */
export function hasReelSource(input: ReelSourceInput): boolean {
  return Boolean((input.title || '').trim() || (input.body || '').trim())
}

/** FNV-1a ثنائي (٢×٣٢ بت) → ١٦ خانة ست عشرية؛ حتمي وكافٍ لكشف التغيير لا للتشفير. */
export function reelSourceFingerprint(input: ReelSourceInput): string {
  const n = normalizeReelSource(input)
  const text = `${collapse(n.title)}\u0001${collapse(n.body)}\u0001${n.worldId}`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193 ^ text.length
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

export type ReelPlanState = 'none' | 'fresh' | 'stale'

export interface ReelPlanGate {
  state: ReelPlanState
  /** المعاينة والتصدير مسموحان فقط حين تطابق الخطةُ المصدرَ الحالي. */
  canPreview: boolean
  canExport: boolean
  /** رسالة عربية تُعرض للمستخدم حين تُحجب العمليتان. */
  reason: string
  /** ماذا تغيّر بالتحديد — لتوضيح سبب إبطال الخطة. */
  changed: Array<'title' | 'body' | 'world'>
}

export interface BoundReelSource extends ReelSourceNormalized { fingerprint: string }

export function bindReelSource(input: ReelSourceInput): BoundReelSource {
  return { ...normalizeReelSource(input), fingerprint: reelSourceFingerprint(input) }
}

/** يقارن مصدر الخطة المبنية بالمصدر الظاهر الآن. bound=null تعني لا خطة بعد. */
export function gateReelPlan(bound: BoundReelSource | null, current: ReelSourceInput): ReelPlanGate {
  if (!bound) return { state: 'none', canPreview: false, canExport: false, reason: 'لم تُبنَ خطة بعد.', changed: [] }
  if (bound.fingerprint === reelSourceFingerprint(current)) return { state: 'fresh', canPreview: true, canExport: true, reason: '', changed: [] }
  const now = normalizeReelSource(current)
  const changed: ReelPlanGate['changed'] = []
  if (collapse(now.title) !== collapse(bound.title)) changed.push('title')
  if (collapse(now.body) !== collapse(bound.body)) changed.push('body')
  if (now.worldId !== bound.worldId) changed.push('world')
  const names = { title: 'العنوان', body: 'المتن', world: 'العالم المختار' }
  return {
    state: 'stale', canPreview: false, canExport: false, changed,
    reason: `تغيّر ${changed.map((k) => names[k]).join(' و') || 'المصدر'} منذ بناء الخطة؛ المعاينة والتصدير موقوفان حتى تبني خطة جديدة من المصدر الحالي.`,
  }
}
