/**
 * حساب نبض القرّاء — منطقٌ نقيّ بلا React ولا شبكة، ليُختبر وحده.
 * الخطأ هنا يُري الدكتور أرقاماً كاذبة عن قرّائه، فوجب أن يُثبَّت باختبار.
 */
/* مُفكِّك معرّفات views — منسوخٌ هنا عمداً ليبقى هذا الملف مستقلاً بلا Firebase،
   فيُختبر منطقُ الأرقام وحده. والصيغتان مثبتتان في lib/views: total:PATH و
   day:YYYY-MM-DD:PATH. */
type ParsedView = { kind: 'total' | 'day'; path: string; day?: string }

export function parseViewDocumentId(id: string): ParsedView | null {
  try {
    if (id.startsWith('total:')) return { kind: 'total', path: decodeURIComponent(id.slice(6)) }
    if (id.startsWith('day:')) {
      const day = id.slice(4, 14)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || id[14] !== ':') return null
      return { kind: 'day', day, path: decodeURIComponent(id.slice(15)) }
    }
    return null
  } catch {
    return null
  }
}

export type ViewDoc = { id: string; count: number; title?: string; updatedAt?: { seconds?: number } }
export type Row = { path: string; title: string; total: number; recent: number }

const DAYS_WINDOW = 7

/** يوم الكويت بصيغة YYYY-MM-DD — نفس ما تكتبه views */
function kuwaitDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** أيام النافذة الأخيرة، لتمييز «يُقرأ الآن» من «قُرئ يوماً ما» */
export function windowDays(now = new Date(), span = DAYS_WINDOW): string[] {
  return Array.from({ length: span }, (_, index) => {
    const day = new Date(now)
    day.setDate(day.getDate() - index)
    return kuwaitDay(day)
  })
}

/**
 * يبني الصفوف من وثائق views: المجموع من `total:`، والحديث من أيام النافذة.
 * نقيّة بلا شبكة ليُختبر القرار — وهو موضع الخطأ لا جلبُ البيانات.
 */
export function buildRows(docs: ViewDoc[], days: string[]): Row[] {
  const recentDays = new Set(days)
  const totals = new Map<string, { total: number; title: string }>()
  const recents = new Map<string, number>()

  for (const document of docs) {
    const parsed = parseViewDocumentId(document.id)
    if (!parsed) continue
    /* أحداث السلوك تُعرض في التحليلات، لكنها ليست صفحة يقرؤها الزائر. */
    if (parsed.path.startsWith('/_share') || parsed.path.startsWith('/_listen') || parsed.path.startsWith('/_journey/')) continue
    const count = Number(document.count || 0)
    if (parsed.kind === 'total') {
      const previous = totals.get(parsed.path)
      totals.set(parsed.path, { total: count, title: document.title || previous?.title || '' })
    } else if (parsed.kind === 'day' && parsed.day && recentDays.has(parsed.day)) {
      recents.set(parsed.path, (recents.get(parsed.path) || 0) + count)
    }
  }

  const rows: Row[] = []
  for (const [path, info] of totals) {
    rows.push({ path, title: info.title || path, total: info.total, recent: recents.get(path) || 0 })
  }
  /* من قُرئ حديثاً يتقدّم، ثم الأكثر قراءةً على الإطلاق */
  return rows.sort((a, b) => b.recent - a.recent || b.total - a.total)
}

/** النصوص النائمة: لها زياراتٌ تاريخية ولا أحد يقرؤها الآن — تستحقّ إحياءً */
export function sleeping(rows: Row[], limit = 5): Row[] {
  return rows.filter((row) => row.recent === 0 && row.total >= 3).sort((a, b) => b.total - a.total).slice(0, limit)
}
