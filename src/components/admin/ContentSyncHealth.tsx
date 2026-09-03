import { useEffect, useState } from 'react'
import { getFirebaseApp } from '../../lib/firebase'

type HealthItem = {
  collection: string
  id: string
  title: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
  adminHref: string
  publicHref: string
  warning: string
  publicCheck: 'visible' | 'missing' | 'unchecked'
}
const COLLECTIONS = [
  { collection: 'site_articles', label: 'مقال', publicBase: '/articles/' },
  { collection: 'site_books', label: 'كتاب', publicBase: '/books/' },
  { collection: 'site_papers', label: 'بحث', publicBase: '/research/' },
  { collection: 'site_media', label: 'لقاء إعلامي', publicBase: '/media/' },
] as const
const card = 'rounded-2xl border border-hair bg-canvas p-5'
const timestampText = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'seconds' in value) return new Date(Number((value as { seconds?: number }).seconds || 0) * 1000).toISOString()
  return ''
}

export function ContentSyncHealth() {
  const [items, setItems] = useState<HealthItem[]>([])
  const [checkedAt, setCheckedAt] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const app = await getFirebaseApp()
        if (!app) throw new Error('Firebase غير مهيأ')
        const { collection, getDocs, getFirestore, limit, orderBy, query } = await import('firebase/firestore')
        const db = getFirestore(app)
        const snapshots = await Promise.all(COLLECTIONS.map(async (definition) => {
          const attempts = ['updatedAt', 'createdAt'] as const
          for (const field of attempts) {
            try {
              const snapshot = await getDocs(query(collection(db, definition.collection), orderBy(field, 'desc'), limit(2)))
              if (!snapshot.empty) return { definition, docs: snapshot.docs }
            } catch { /* جرّب حقل التاريخ الآخر، من دون اختلاق بيانات. */ }
          }
          return { definition, docs: [] }
        }))
        const candidates = snapshots.flatMap(({ definition, docs }) => docs.map((document) => {
          const data = document.data() as Record<string, unknown>
          const rawSlug = typeof data.slug === 'string' ? data.slug.trim() : ''
          const slug = rawSlug || document.id
          const status = String(data.status || (data.published === true ? 'published' : 'غير محدد'))
          const published = status === 'published' || data.published === true
          const publicHref = published && slug ? `${definition.publicBase}${encodeURIComponent(slug)}` : ''
          const warning = !rawSlug ? 'لا يوجد slug صريح' : !published ? 'غير منشور في الاستعلام العام' : !data.title ? 'العنوان ناقص' : ''
          return {
            collection: `${definition.label} · ${definition.collection}`,
            id: document.id,
            title: String(data.title || data.name || document.id),
            slug,
            status,
            createdAt: timestampText(data.createdAt),
            updatedAt: timestampText(data.updatedAt),
            adminHref: `/admin?tab=${definition.collection === 'site_articles' ? 'articles' : definition.collection === 'site_books' ? 'books' : definition.collection === 'site_papers' ? 'papers' : 'media'}&edit=${encodeURIComponent(document.id)}`,
            publicHref,
            warning,
            publicCheck: 'unchecked' as const,
          }
        }))
        const next = await Promise.all(candidates.map(async (item) => {
          if (!item.publicHref) return item
          try {
            const response = await fetch(item.publicHref, { method: 'GET', cache: 'no-store', headers: { 'x-content-health-check': '1' } })
            if (!response.ok) return { ...item, publicCheck: 'missing' as const, warning: item.warning || `الصفحة العامة أعادت ${response.status}` }
            const body = await response.text()
            const visible = body.includes(item.title) || body.includes(item.slug)
            return visible ? { ...item, publicCheck: 'visible' as const } : { ...item, publicCheck: 'missing' as const, warning: item.warning || 'الوثيقة منشورة لكن لم يظهر عنوانها أو slug في الصفحة العامة' }
          } catch {
            return { ...item, publicCheck: 'unchecked' as const, warning: item.warning || 'تعذّر التحقق الحي من الصفحة العامة' }
          }
        }))
        if (active) { setItems(next); setCheckedAt(new Date().toISOString()); setError('') }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'تعذّر التحقق') }
    }
    void load()
    return () => { active = false }
  }, [])
  return <section className={card} aria-labelledby="content-sync-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.7rem] font-semibold text-accent">الصحة والتزامن</p><h3 id="content-sync-title" className="mt-1 font-semibold text-ink">أحدث محتوى Firestore</h3></div><span className="text-[.65rem] text-soft">آخر تحقق: {checkedAt ? new Date(checkedAt).toLocaleString('ar-KW') : '—'}</span></div>
    {error && <p className="mt-4 text-[.75rem] text-accent">{error}</p>}
    {!error && !items.length && <p className="mt-4 text-[.75rem] text-soft">لا توجد بيانات قابلة للتحقق؛ لا تُعرض حالة نجاح افتراضية.</p>}
    {!!items.length && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-right text-[.72rem]"><thead className="text-soft"><tr><th className="py-2">المصدر</th><th>العنوان</th><th>الحالة</th><th>الإنشاء</th><th>التعديل</th><th>الظهور</th><th>فتح</th></tr></thead><tbody>{items.map((item) => <tr key={`${item.collection}-${item.id}`} className="border-t border-hair"><td className="py-3">{item.collection}</td><td className="max-w-[18rem] truncate font-semibold text-ink">{item.title}</td><td>{item.status}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('ar-KW') : '—'}</td><td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ar-KW') : '—'}</td><td className={item.warning ? 'text-accent' : 'text-soft'}>{item.warning || (item.publicCheck === 'visible' ? 'ظاهر في الصفحة العامة' : 'مؤهل للظهور وفق الحقول الأساسية')}</td><td><div className="flex gap-2"><a href={item.adminHref} className="text-accent">الإدارة</a>{item.publicHref && <a href={item.publicHref} target="_blank" rel="noreferrer" className="text-accent">معاينة</a>}</div></td></tr>)}</tbody></table></div>}
  </section>
}
