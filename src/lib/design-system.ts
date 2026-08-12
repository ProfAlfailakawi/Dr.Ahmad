/**
 * هوية الموقع البصرية — مصدرٌ واحد تقرأه الشيفرة.
 *
 * `DESIGN.md` يشرحها للإنسان وللوكيل الذكيّ، و`src/index.css` يطبّقها على
 * الموقع، وهذا الملف يعطيها للأدوات التي ترسم خارج DOM — وأوّلها استوديو
 * التصاميم (SVG على قماشة، بلا متغيّرات CSS).
 *
 * العطب الذي عالجه هذا الملف: لوحتا «ورق الهوية» و«ليل الهوية» في الاستوديو
 * كانتا **تقريباً** للهوية لا الهوية نفسها — أرضية `#F8F6F0` بدل `#FCFCFA`،
 * وحبر `#17191D` بدل `#15161A`، وليلٌ `#111820` بدل `#0F1115`، وأزرقٌ مسائيّ
 * `#90AEC7` بدل `#84A9CA`. فكان كلّ تصميمٍ «بهوية الموقع» يخرج قريباً منها
 * لا مطابقاً لها. الآن تُشتقّ من هنا، وحارسٌ في البناء يمنع الانحراف
 * (`scripts/guard-design-system.mjs`).
 */

export type ThemeTokens = {
  canvas: string
  ink: string
  soft: string
  accent: string
  accentDeep: string
  wash: string
  /** الحدّ الشعريّ بعد تسطيحه على القماشة — SVG لا يرث الشفافية من الأب. */
  hair: string
  /** تخفيفةُ التمييز: خلفيةُ الشارات واللوحات الهادئة. */
  accentSoft: string
}

/* ── أدوات لونية صغيرة: التخفيفات تُحسب ولا تُخمَّن ── */
const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

const parse = (hex: string) => {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ] as const
}

/** يمزج `top` فوق `base` بنسبة `ratio` — أي تسطيح شفافيةٍ إلى لونٍ صلب. */
export function mix(base: string, top: string, ratio: number): string {
  const [br, bg, bb] = parse(base)
  const [tr, tg, tb] = parse(top)
  return toHex(br + (tr - br) * ratio, bg + (tg - bg) * ratio, bb + (tb - bb) * ratio)
}

/* ── القيم الخام — هي عينها التي في :root و html.dark ── */
const LIGHT_RAW = { canvas: '#FCFCFA', ink: '#15161A', soft: '#5E6570', accent: '#3E5C78', accentDeep: '#33506B', wash: '#F4F5F3' }
const DARK_RAW = { canvas: '#0F1115', ink: '#ECEAE4', soft: '#B5B8BE', accent: '#84A9CA', accentDeep: '#A4C2DC', wash: '#171A1F' }

/** شفافية الحدّ الشعريّ في كلّ وضع (‎--c-hair‎). */
export const HAIR_ALPHA = { light: 0.09, dark: 0.11 } as const

export const LIGHT: ThemeTokens = {
  ...LIGHT_RAW,
  hair: mix(LIGHT_RAW.canvas, LIGHT_RAW.ink, HAIR_ALPHA.light),
  accentSoft: mix(LIGHT_RAW.canvas, LIGHT_RAW.accent, 0.18),
}

export const DARK: ThemeTokens = {
  ...DARK_RAW,
  /* في الليل الحدّ عاجيٌّ لا حبريّ — لهجةٌ تدفأ لا عكسٌ حسابيّ. */
  hair: mix(DARK_RAW.canvas, '#EAEAE7', HAIR_ALPHA.dark),
  accentSoft: mix(DARK_RAW.canvas, DARK_RAW.accent, 0.22),
}

/* ── الطباعة ── */
export const TYPOGRAPHY = {
  display: 'El Messiri',
  body: 'Tajawal',
  displayWeight: 600,
  /** المتاح محلياً من Tajawal ينتهي عند 500؛ ما فوقها تغليظٌ مزيّف يشوّه الحرف. */
  bodyWeightMax: 500,
} as const

/* ── القياسات ── */
export const RADIUS = { sm: 8, md: 12, lg: 14, xl: 16 } as const
export const SHELL_MAX_WIDTH = 1140
export const EASE = 'cubic-bezier(.2,.7,.2,1)'

/** منحنى الحركة كما تفهمه framer-motion. */
export const EASE_POINTS = [0.2, 0.7, 0.2, 1] as const

export const themeFor = (isDark: boolean): ThemeTokens => (isDark ? DARK : LIGHT)
