/**
 * كاشف غلاف التطبيق الأصلي (Capacitor داخل WKWebView) — الكاشف الوحيد المشترك.
 * الشرط نفسه المستعمل في main.tsx وpublic/native-polish.js وnative-push.ts:
 * `Capacitor.isNativePlatform()`. لا يعتمد على نص User-Agent ولا على Safari.
 * في المتصفح العادي يعيد false دائماً فلا يتغيّر شيء هناك.
 */
export function isNativeShell(): boolean {
  try {
    return !!(globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}
