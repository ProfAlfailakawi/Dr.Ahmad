/**
 * نبض القرّاء — ماذا يقرأ الناس الآن، لا ماذا نظنّ أنهم يقرؤون.
 *
 * الأرشيف يقول ما كتبه الدكتور؛ وهذه اللوحة تقول ما وصل منه فعلاً. فيكتب
 * الدكتور ما يحتاجه قرّاؤه لا ما يُخمّنه: أيّ فكرةٍ تُقرأ هذا الأسبوع، وأيّ
 * مقالٍ صعد فجأةً، وأيّ نصٍّ نائمٌ في الأرشيف لم يزره أحد.
 *
 * ولا تتبّعَ لشخص: مجموعة views تحصي المسارات لا الأفراد — لا هويّة ولا موقع
 * ولا جهاز. رقمٌ مجرّد لكل مقال، وهذا كلّ ما يظهر هنا.
 */
import { useEffect, useMemo, useState } from 'react'
import { getFirebaseApp } from '../../lib/firebase'
import { Pagination, usePagedList } from '../Pagination'
import { buildRows, sleeping, windowDays, type ViewDoc } from '../readerPulseLogic'

export function ReaderPulse() {
  const [docs, setDocs] = useState<ViewDoc[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const app = await getFirebaseApp()
        if (!app) { setError('تعذّر الاتصال بقاعدة البيانات.'); return }
        const { getFirestore, collection, getDocs } = await import('firebase/firestore')
        const snapshot = await getDocs(collection(getFirestore(app), 'views'))
        setDocs(snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as Omit<ViewDoc, 'id'>) })))
      } catch {
        setError('تعذّرت قراءة سجلّ الزيارات.')
      }
    })()
  }, [])

  const days = useMemo(() => windowDays(), [])
  const rows = useMemo(() => (docs ? buildRows(docs, days) : []), [docs, days])
  const hot = rows.filter((row) => row.recent > 0).slice(0, 8)
  const quiet = useMemo(() => sleeping(rows), [rows])
  const quietPages = usePagedList(quiet, 10, String(quiet.length))
  const weekTotal = rows.reduce((sum, row) => sum + row.recent, 0)
  const allTime = rows.reduce((sum, row) => sum + row.total, 0)

  const card = 'rounded-2xl border border-hair bg-canvas p-4'

  return (
    <details className="rounded-2xl border border-hair bg-wash p-5">
      <summary className="cursor-pointer text-[.95rem] font-semibold text-ink">نبض القرّاء — ماذا يُقرأ الآن</summary>

      {!docs && !error && <p className="mt-3 text-[.8rem] text-soft">يُقرأ سجلّ الزيارات…</p>}
      {error && <p className="mt-3 text-[.8rem] text-soft">{error}</p>}

      {docs && (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-accent px-4 py-1.5 text-[.8rem] font-semibold text-white">
              {weekTotal} قراءة هذا الأسبوع
            </span>
            <span className="rounded-full border border-hair px-4 py-1.5 text-[.8rem] text-soft">
              {allTime} قراءة منذ البداية
            </span>
            <span className="rounded-full border border-hair px-4 py-1.5 text-[.8rem] text-soft">
              {rows.length} صفحة زارها أحد
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className={card}>
              <p className="text-[.75rem] font-semibold text-accent">يُقرأ هذا الأسبوع</p>
              {!hot.length && <p className="mt-2 text-[.78rem] text-soft">لا قراءات مسجّلة في الأيام السبعة الماضية.</p>}
              <ul className="mt-2 grid gap-2">
                {hot.map((row) => (
                  <li key={row.path} className="flex items-baseline justify-between gap-3">
                    <a href={row.path} className="text-[.82rem] leading-relaxed text-ink hover:text-accent" title={row.path}>
                      {row.title.slice(0, 52)}
                    </a>
                    <span className="shrink-0 text-[.75rem] text-soft">{row.recent} · <span className="text-soft/70">{row.total} إجمالاً</span></span>
                  </li>
                ))}
              </ul>
            </div>

            <div id="reader-pulse-quiet" className={`${card} scroll-mt-28`}>
              <p className="text-[.75rem] font-semibold text-accent">نصوصٌ نائمة — تستحقّ إحياءً</p>
              <p className="mt-1 text-[.72rem] leading-relaxed text-soft">قُرئت من قبل، ولم يزرها أحدٌ هذا الأسبوع. انشرها في البثّ فتعود.</p>
              {!quiet.length && <p className="mt-2 text-[.78rem] text-soft">لا شيء نائم — كل ما قُرئ سابقاً يُقرأ الآن.</p>}
              <ul className="mt-2 grid gap-2">
                {quietPages.pageItems.map((row) => (
                  <li key={row.path} className="flex items-baseline justify-between gap-3">
                    <a href={row.path} className="text-[.82rem] leading-relaxed text-ink hover:text-accent" title={row.path}>
                      {row.title.slice(0, 52)}
                    </a>
                    <span className="shrink-0 text-[.75rem] text-soft">{row.total}</span>
                  </li>
                ))}
              </ul>
              <Pagination page={quietPages.page} pageCount={quietPages.pageCount} onChange={quietPages.setPage} totalItems={quiet.length} firstItem={quietPages.firstItem} lastItem={quietPages.lastItem} scrollTargetId="reader-pulse-quiet" label="صفحات النصوص النائمة" className="mt-4" />
            </div>
          </div>

          <p className="mt-4 text-[.72rem] leading-relaxed text-soft">
            لا يُسجَّل هنا شخصٌ ولا موقعٌ ولا جهاز — عددُ زياراتٍ لكل صفحة فحسب.
          </p>
        </>
      )}
    </details>
  )
}
