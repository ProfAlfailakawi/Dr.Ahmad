/**
 * سجلّ الروابط الميتة — يُخفي أيقونة الرابط فور موته بأمر الدكتور.
 *
 * القاعدة: هذا السجل للمصادر الخارجية فقط. رابط مختارات أو رادار ميت لا
 * يُعرض للزائر؛ يُستخدم البديل المؤكد إن وُجد، وإلا تختفي المادة الخارجية.
 * روابط مكتبة الدكتور لا تدخل هذا السجل ولا تتغير آلياً مطلقاً.
 *
 * يملأه فاحص المصادر اليومي (scripts/check-all-sources.mjs)، ويُقرأ هنا
 * وقت العرض فلا يحتاج بناءً جديداً ليختفي رابطٌ مات أمس.
 */
import deadRegistry from '../data/dead-links.json'

type DeadEntry = { url: string; state: string; since: string; replacement?: string }
const registry = (deadRegistry as { items?: DeadEntry[] }).items || []

const byUrl = new Map(registry.map((item) => [item.url, item]))

/** هل هذا الرابط ميت؟ (يُخفى) */
export function isDeadLink(url?: string | null): boolean {
  if (!url) return false
  const entry = byUrl.get(url)
  return Boolean(entry && !entry.replacement)
}

/**
 * الرابط الصالح للعرض: البديل المؤكد إن وُجد، وإلا الأصل، وإلا لا شيء.
 * تستعمله الصفحات مباشرةً بدل الرابط الخام.
 */
export function liveLink(url?: string | null): string | undefined {
  if (!url) return undefined
  const entry = byUrl.get(url)
  if (!entry) return url
  if (entry.replacement) return entry.replacement
  return undefined
}
