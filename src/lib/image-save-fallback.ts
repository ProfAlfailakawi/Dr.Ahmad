import { isNativeShell } from './native-shell.ts'

export const NATIVE_IMAGE_SAVE_FALLBACK = 'تعذّرت المشاركة. استعمل زر المشاركة ثم اختر «حفظ الصورة».'

/**
 * بديل حفظ الصورة حين تفشل ورقة المشاركة. داخل التطبيق الأصلي لا توجد نوافذ ولا تبويبات
 * (window.open لن يعرض الصورة)، فنُرشد إلى زر المشاركة ولا نفتح شيئاً.
 * في المتصفح يبقى السلوك السابق: فتح الصورة في تبويب مع نص الإرشاد نفسه.
 * يعيد نص التنبيه الذي يُعرض للزائر.
 */
export function imageSaveFallbackFeedback(blob: Blob): string {
  if (isNativeShell()) return NATIVE_IMAGE_SAVE_FALLBACK
  const objectUrl = URL.createObjectURL(blob)
  const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer')
  if (!opened) URL.revokeObjectURL(objectUrl)
  else window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return opened ? 'فُتحت الصورة؛ احفظها من قائمة المتصفح.' : 'تعذّر فتح الصورة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
}
