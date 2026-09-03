/**
 * نسخٌ إلى الحافظة يعمل في كل المتصفحات.
 *
 * بعض المتصفحات تعرّف Clipboard API ثم تمنعها (سياق غير آمن، أو إذن مرفوض)،
 * فنسقط إلى الطريقة التقليدية بدل أن يفشل النسخ صامتاً في وجه الزائر.
 */
function writeWithFallback(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('copy failed')
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // المتصفح عرّف الواجهة ومنعها — ننتقل للنسخ التقليدي.
    }
  }
  writeWithFallback(value)
}
