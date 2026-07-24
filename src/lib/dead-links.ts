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


/**
 * ينظّف الرابط قبل عرضه للزائر. يقبل روابط الموقع النسبية وHTTP(S) فقط،
 * ويحوّل DOI الخام إلى رابطه القياسي. أي نص مركّب أو بروتوكول خطِر يختفي.
 */
export function safeLink(url?: string | null): string | undefined {
  const raw = String(url || '').trim()
  if (!raw) return undefined

  // طبّق سجل الروابط قبل التطبيع حتى لا تضيع المطابقة بسبب شرطة أو ترميز.
  const registered = liveLink(raw)
  if (!registered) return undefined
  const candidate = String(registered).trim()
  if (!candidate || /[\u0000-\u001F\u007F<>]/.test(candidate)) return undefined
  if (/^(javascript|data|vbscript|file):/i.test(candidate)) return undefined

  const doi = candidate
    .replace(/^doi:\s*/i, '')
    .replace(/[)\]}>.,;،؛]+$/g, '')
    .trim()
  if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {
    return `https://doi.org/${encodeURI(doi)}`
  }

  if (candidate.startsWith('/') && !candidate.startsWith('//')) {
    return /\s/.test(candidate) ? undefined : candidate
  }

  // المسافات داخل الرابط علامة شائعة على دمج نصين أو عنوانٍ مكسور.
  if (/\s/.test(candidate)) return undefined
  try {
    const parsed = new URL(candidate)
    if (!/^https?:$/.test(parsed.protocol)) return undefined
    if (!parsed.hostname || /\s/.test(parsed.hostname)) return undefined
    return parsed.toString()
  } catch {
    return undefined
  }
}
