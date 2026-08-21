/**
 * تجاوزات التصميم لكل بوست — مصدرٌ واحد يقرأه ثلاثةٌ معاً: المنتقي (اختيار الصورة)،
 * والمعاينة (الأيقونة الحيّة)، والتصدير (خبز الأيقونة في PNG المنشور). كلّه في
 * تخزين المتصفح مفتاحه بصمة التصميم، فيتذكّره الدكتور ولا يتسرّب بين تصميمٍ وآخر.
 *
 * لا يستورد أيّ مكوّن React — دوالٌ صرفة كي يستعملها المحرّك والواجهة سواءً.
 */

import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'
import { chooseMetaphors, type MetaphorId } from './reel-metaphors'
import { type CompositionPlan } from './social-design-engine'

export const LIVING_ICON_CHANGE = 'living-icon-change'

const ENABLED_KEY = 'reel:living-icon:v1'
const posKey = (fp: string) => `reel:living-icon-pos:${fp}`
const metaphorKey = (fp: string) => `reel:living-icon-metaphor:${fp}`
const effKey = (fp: string) => `reel:living-icon-eff:${fp}`

const fpOf = (plan: CompositionPlan) => plan.fingerprint || plan.id || 'design'

/** أطلق حدث التغيير كي تتزامن كل المعاينات في الصفحة فوراً. */
export function emitLivingIconChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LIVING_ICON_CHANGE))
}

export function readIconEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(ENABLED_KEY) !== 'off'
}

/* ---------------------------- الموضع اليدوي ---------------------------- */
export interface ManualPos { top: number; left: number; size: number }

export function readManualPos(plan: CompositionPlan): ManualPos | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(posKey(fpOf(plan)))
    if (!raw) return null
    const p = JSON.parse(raw) as ManualPos
    if (typeof p.top === 'number' && typeof p.left === 'number' && typeof p.size === 'number') return p
    return null
  } catch { return null }
}
export function writeManualPos(plan: CompositionPlan, pos: ManualPos) {
  try { localStorage.setItem(posKey(fpOf(plan)), JSON.stringify(pos)) } catch { /* محجوب */ }
}
export function clearManualPos(plan: CompositionPlan) {
  try { localStorage.removeItem(posKey(fpOf(plan))) } catch { /* محجوب */ }
}

/* ------------------- الموضع الفعلي المخزَّن للتصدير -------------------- */
/* المعاينة تكتب هنا موضعَها المعروض (تلقائياً كان أو يدوياً) فيقرأه التصدير،
   إذ لا يستطيع التصدير إعادة حساب التموضع البصري بنفسه بلا لوحة معاينة حيّة. */
export interface EffectivePlacement { top: number; left: number; size: number; hidden: boolean }

export function readEffectivePlacement(plan: CompositionPlan): EffectivePlacement | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(effKey(fpOf(plan)))
    if (!raw) return null
    const p = JSON.parse(raw) as EffectivePlacement
    if (typeof p.top === 'number' && typeof p.left === 'number' && typeof p.size === 'number') return p
    return null
  } catch { return null }
}
export function writeEffectivePlacement(plan: CompositionPlan, place: EffectivePlacement) {
  try { localStorage.setItem(effKey(fpOf(plan)), JSON.stringify(place)) } catch { /* محجوب */ }
}

/* --------------------------- اختيار الصورة ---------------------------- */
export function readMetaphorChoice(plan: CompositionPlan): MetaphorId | null {
  if (typeof localStorage === 'undefined') return null
  try { return (localStorage.getItem(metaphorKey(fpOf(plan))) as MetaphorId) || null } catch { return null }
}
export function writeMetaphorChoice(plan: CompositionPlan, id: MetaphorId | null) {
  try {
    if (id) localStorage.setItem(metaphorKey(fpOf(plan)), id)
    else localStorage.removeItem(metaphorKey(fpOf(plan)))
  } catch { /* محجوب */ }
}

/** الاستعارة التلقائية من معنى النص عبر معجم الدكتور (حين لا اختيار يدوي). */
export function autoMetaphorFor(plan: CompositionPlan): MetaphorId {
  const c = plan.content
  const text = [c.title, c.heroWord, c.quote, c.kicker, c.subtitle, c.body].filter(Boolean).join(' ')
  const domain = interpretDrAhmadDomain(text.slice(0, 1200))
  const chosen = chooseMetaphors([domain.primary?.canonicalAr || '', domain.visualScenes.join(' · '), text.slice(0, 600)], 1)
  return chosen[0] || 'figure-contemplate'
}

/** الاستعارة المعتمدة: اختيار الدكتور إن وُجد، وإلا التلقائية. */
export function resolveMetaphor(plan: CompositionPlan): MetaphorId {
  return readMetaphorChoice(plan) || autoMetaphorFor(plan)
}

/** أسماءٌ عربية لكل رموز المكتبة — تُعرض في المنتقي. */
export const METAPHOR_LABELS_AR: Record<MetaphorId, string> = {
  bridge: 'جسر', roots: 'جذور', 'orbit-loop': 'مدار', weave: 'نسيج', scale: 'ميزان',
  seed: 'بذرة', 'dissolving-grid': 'شبكة متحلّلة', compass: 'بوصلة', stairs: 'درج', lens: 'عدسة',
  hourglass: 'ساعة رملية', 'branching-path': 'مسار متفرّع', 'signal-bars': 'إشارة', 'lock-key': 'قفل ومفتاح',
  constellation: 'كوكبة', ripple: 'تموّج', 'figure-contemplate': 'تأمّل', 'group-idea': 'فكرة جماعية',
  'teacher-students': 'معلّم وطلاب', 'child-screen': 'طفل وشاشة', 'hand-write': 'يدٌ تكتب', 'figure-climb': 'تسلّق',
  'two-facing': 'وجهان متقابلان', 'crowd-scatter': 'تفرّق حشد', 'figure-crossroads': 'مفترق طرق',
  'open-door': 'باب مفتوح', mirror: 'مرآة', 'mask-face': 'قناع', 'mountain-peak': 'قمة جبل',
  'horizon-sun': 'أفقٌ وشمس', 'open-book': 'كتاب مفتوح', spotlight: 'ضوء مسلّط', anchor: 'مرساة',
  'thread-cut': 'خيطٌ مقطوع', 'wave-break': 'موجةٌ تنكسر', maze: 'متاهة', 'network-grow': 'شبكةٌ تنمو',
  'brain-circuit': 'دماغٌ ودائرة', 'data-flow': 'تدفّق بيانات', 'vr-portal': 'بوابة افتراضية', megaphone: 'مكبّر صوت',
  'shield-check': 'درعُ تحقّق', 'puzzle-fit': 'قطعة أحجية', 'target-hit': 'إصابة هدف', 'gears-turn': 'تروسٌ تدور',
  'heart-pulse': 'نبض قلب', 'chart-rise': 'منحنى صاعد', 'quote-marks': 'علامات اقتباس', 'globe-connect': 'كرةٌ موصولة',
  'flame-torch': 'شعلة', 'balance-human-machine': 'توازن إنسان وآلة', 'sprout-hand': 'برعمٌ في يد', 'clock-gears': 'ساعةٌ وتروس',
  lightbulb: 'مصباح فكرة', magnet: 'مغناطيس', funnel: 'قمع تصفية', telescope: 'تلسكوب', fingerprint: 'بصمة',
  handshake: 'مصافحة', 'book-stack': 'كومة كتب', 'graduation-cap': 'قبعة تخرّج', 'speech-bubbles': 'فقاعتا حوار', 'tree-grow': 'شجرةٌ تنمو',
  'river-flow': 'نهر', 'infinity-loop': 'لا نهاية', rocket: 'صاروخ', pyramid: 'هرم', spiral: 'حلزون',
  atom: 'ذرّة', microscope: 'مجهر', 'dna-helix': 'حلزونٌ وراثي', lantern: 'فانوس', signpost: 'لافتة اتجاه',
}
