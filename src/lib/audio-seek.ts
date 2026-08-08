/**
 * كل موجات الصوت في الواجهة العربية تبدأ زمنياً من اليمين.
 * إبقاء الحساب هنا يمنع رجوع شريطٍ واحد إلى منطق LTR بالخطأ.
 */
export function rtlSeekFraction(element: HTMLElement, clientX: number) {
  const rect = element.getBoundingClientRect()
  if (!Number.isFinite(rect.width) || rect.width <= 0) return 0
  return Math.min(1, Math.max(0, (rect.right - clientX) / rect.width))
}

export function rtlSeekSeconds(element: HTMLElement, clientX: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  return rtlSeekFraction(element, clientX) * duration
}
