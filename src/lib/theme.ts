/* السمة (نهاري/ليلي) — مصدرٌ واحد للحقيقة تشترك فيه الواجهةُ وسكربتُ الإقلاع.
   القاعدة: اختيار الزائر الصريح المحفوظ يتقدّم على تفضيل نظامه؛ فإن لم يختر
   شيئاً اتُّبع `prefers-color-scheme`. التطبيقُ الأوّلي يحدث في `public/boot.js`
   قبل أوّل رسمٍ للصفحة (سياسة CSP تمنع السكربت المضمّن، فالملفُّ الخارجي
   الحاجبُ في <head> بديلُه المكافئ) فلا يومض الوضع الخاطئ عند التحميل.
   هذا الملف يكرّر المنطق نفسه لتستعمله مكوّنات React بعد الإقلاع. */

export type ThemeChoice = 'light' | 'dark'

export const THEME_CHOICE_KEY = 'theme-choice'
export const THEME_LEGACY_KEY = 'theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** اختيار الزائر الصريح، أو null إن لم يختر فيُتبَع النظام. */
export function readThemeChoice(): ThemeChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const choice = window.localStorage.getItem(THEME_CHOICE_KEY)
    if (choice === 'dark' || choice === 'light') return choice
  } catch { /* التخزين المحلي قد يكون محجوباً */ }
  return null
}

/** هل يفضّل نظام الزائر الوضع الليلي؟ */
export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try { return window.matchMedia(DARK_QUERY).matches } catch { return false }
}

/** السمة الفعلية بعد ترجيح الاختيار الصريح على تفضيل النظام. */
export function resolveTheme(): ThemeChoice {
  const choice = readThemeChoice()
  if (choice) return choice
  return systemPrefersDark() ? 'dark' : 'light'
}

/** يحفظ اختياراً صريحاً للزائر (يتقدّم على النظام في كل زيارة لاحقة). */
export function writeThemeChoice(choice: ThemeChoice) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_CHOICE_KEY, choice)
    /* المفتاح القديم يبقى مرآةً للسمة المطبَّقة لأن شيفرةً أقدم ما زالت تقرؤه. */
    window.localStorage.setItem(THEME_LEGACY_KEY, choice)
  } catch { /* noop */ }
}

/** شريط المتصفح على الجوّال يتبع السمة نفسها. */
export function syncThemeColorMeta(dark: boolean) {
  if (typeof document === 'undefined') return
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', dark ? '#111215' : '#FCFCFA')
}

/** يراقب تغيّر تفضيل النظام؛ لا يُنادى المستمع إلا حين لا يوجد اختيار صريح. */
export function watchSystemTheme(onChange: (dark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  let mediaQuery: MediaQueryList
  try { mediaQuery = window.matchMedia(DARK_QUERY) } catch { return () => {} }
  const handler = (event: MediaQueryListEvent) => {
    if (readThemeChoice()) return
    onChange(event.matches)
  }
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }
  /* متصفحات أقدم لا تعرف addEventListener على MediaQueryList */
  const legacy = mediaQuery as MediaQueryList & {
    addListener?: (listener: (event: MediaQueryListEvent) => void) => void
    removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
  }
  legacy.addListener?.(handler)
  return () => legacy.removeListener?.(handler)
}
