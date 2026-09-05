/*
 * سجلُّ أعطال التحميل: يلتقط أسماء الملفات التي فشل المتصفح في جلبها (نصوص
 * برمجية، أنماط، روابط تحميلٍ مسبق). فائدته أن صفحة العطب تذكر الملف الغائب
 * بالاسم بدل جملةٍ عامّة، فيتحوّل بلاغ الزائر إلى سببٍ دقيق. محلّيٌّ بالكامل:
 * لا يُرسل شيئاً خارج الجهاز، ولا يحتفظ إلا بآخر بضعة أعطال.
 */

const MAX_KEPT = 5
const failed: string[] = []

export function recordFailedResource(url: string) {
  const trimmed = String(url || '').trim()
  if (!trimmed || failed.includes(trimmed)) return
  failed.push(trimmed)
  if (failed.length > MAX_KEPT) failed.shift()
}

export function failedResources() {
  return failed.slice()
}

/** المسار وحده أوضح للقراءة من الرابط الكامل في سطر التشخيص. */
export function shortenResourceUrl(url: string) {
  try {
    return new URL(url, window.location.href).pathname
  } catch {
    return url
  }
}

/**
 * حزمةُ تطبيقٍ مجزّأة غابت عن الخادم: النسخة المفتوحة تطلب ملفاً حُذف بنشرةٍ
 * أحدث. هذه بعينها حالةٌ يعالجها إفراغُ الكاش وإعادة التحميل.
 */
export function hasMissingAppChunk() {
  return failed.some((url) => /\/assets\/[^/?#]+\.(?:js|mjs|css)(?:$|[?#])/i.test(url))
}

/** يبدأ الالتقاط في طور الأسر لأن أخطاء تحميل العناصر لا تتصاعد. */
export function watchResourceFailures() {
  window.addEventListener('error', (event) => {
    const node = event.target as (HTMLScriptElement & HTMLLinkElement & HTMLImageElement) | null
    if (!node || typeof node !== 'object' || !('tagName' in node)) return
    recordFailedResource(node.src || node.href || '')
  }, true)
}
