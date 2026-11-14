/**
 * منطق واحد لشريط «ثبّت التطبيق» حسب البيئة.
 *  - داخل غلاف iOS الأصلي: لا يظهر أبداً.
 *  - iPhone/iPad في المتصفح: يظهر، وزره الرئيسي يفتح صفحة App Store.
 *  - Android: يبقى تثبيت PWA؛ وإذا مُلئ PLAY_STORE_URL صار الزر يفتح Google Play.
 *  - سطح المكتب: كما كان (تثبيت PWA).
 * لا يوجد حالياً شريط تثبيت في الموقع؛ أي شريط يُضاف لاحقاً يستدعي resolveInstallBanner فقط.
 */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6834582484'
/** فارغ إلى أن يُنشر تطبيق Google Play علناً. */
export const PLAY_STORE_URL = ''

export type InstallBannerEnv = {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  /** نتيجة window.Capacitor?.isNativePlatform?.() */
  capacitorNative?: boolean
  /** نتيجة matchMedia('(display-mode: standalone)') أو navigator.standalone */
  standalone?: boolean
}

export type InstallBannerPlan =
  | { show: false; reason: 'native-shell' | 'already-installed' }
  | { show: true; action: 'open-store'; url: string; store: 'app-store' | 'play-store' }
  | { show: true; action: 'pwa-prompt' }

export function isNativeShell(env: InstallBannerEnv): boolean {
  return env.capacitorNative === true
}

export function isIosDevice(env: InstallBannerEnv): boolean {
  const ua = env.userAgent || ''
  if (/iP(?:hone|ad|od)/.test(ua)) return true
  // iPadOS يتخفى بصيغة Mac
  return env.platform === 'MacIntel' && (env.maxTouchPoints || 0) > 1
}

export function resolveInstallBanner(
  env: InstallBannerEnv,
  urls: { appStore?: string; playStore?: string } = {},
): InstallBannerPlan {
  const appStore = urls.appStore ?? APP_STORE_URL
  const playStore = urls.playStore ?? PLAY_STORE_URL
  if (isNativeShell(env)) return { show: false, reason: 'native-shell' }
  if (env.standalone) return { show: false, reason: 'already-installed' }
  if (isIosDevice(env) && appStore) return { show: true, action: 'open-store', url: appStore, store: 'app-store' }
  if (/Android/i.test(env.userAgent || '') && playStore) return { show: true, action: 'open-store', url: playStore, store: 'play-store' }
  return { show: true, action: 'pwa-prompt' }
}

/** يقرأ البيئة الحية من المتصفح. */
export function readInstallBannerEnv(): InstallBannerEnv {
  if (typeof window === 'undefined') return {}
  const nav = window.navigator as Navigator & { standalone?: boolean }
  let standalone = Boolean(nav.standalone)
  try { standalone = standalone || window.matchMedia('(display-mode: standalone)').matches } catch { /* غير مدعوم */ }
  let capacitorNative = false
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    capacitorNative = Boolean(cap?.isNativePlatform?.())
  } catch { /* غير موجود */ }
  return { userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints, capacitorNative, standalone }
}
