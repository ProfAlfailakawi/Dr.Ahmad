import { useMemo } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { editorialForesight, fairObjectionParagraph } from '../../lib/editorial-foresight'

export function EditorialForesightPanel({
  title,
  body,
  articles,
  onInsertFairAnswer,
}: {
  title: string
  body: string
  articles: ArticleRecord[]
  onInsertFairAnswer?: (paragraph: string) => void
}) {
  const report = useMemo(() => editorialForesight(title, body, articles), [articles, body, title])
  const ready = report.words >= 80

  return (
    <section className="min-w-0 rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6" data-editorial-foresight="true">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.72rem] font-semibold text-accent">بصيرة ما قبل النشر</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">هل تضيف، وتنصف، وتبقى؟</h3>
        </div>
        <span className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.68rem] text-soft">{ready ? 'تتحدث مع كل تعديل' : 'تبدأ بعد 80 كلمة'}</span>
      </div>

      {!ready ? (
        <p className="mt-4 rounded-xl border border-dashed border-hair bg-canvas px-4 py-5 text-[.8rem] leading-relaxed text-soft">أكمل الأطروحة أو المسودة؛ لا يصدر النظام حكماً كبيراً من عنوان أو فقرة قصيرة.</p>
      ) : (
        <div className="mt-5 grid gap-3 xl:grid-cols-3">
          <details className="group rounded-2xl border border-hair bg-canvas p-4" open>
            <summary className="cursor-pointer list-none">
              <span className="block text-[.67rem] font-semibold text-accent">مقياس الإضافة الحقيقية</span>
              <strong className="mt-1 block text-[.88rem] text-ink">{report.addition.verdict}</strong>
              <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{report.addition.evidenceBasis}</span>
            </summary>
            <p className="mt-3 border-t border-hair pt-3 text-[.76rem] leading-relaxed text-soft">{report.addition.explanation}</p>
            {report.addition.nearest[0] && (
              <a href={`/articles/${report.addition.nearest[0].slug}`} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl border border-hair px-3 py-2 text-[.72rem] text-ink transition hover:border-accent hover:text-accent">
                الأقرب: {report.addition.nearest[0].title}{report.addition.nearest[0].year ? ` · ${report.addition.nearest[0].year}` : ''}
              </a>
            )}
          </details>

          <details className="group rounded-2xl border border-hair bg-canvas p-4" open>
            <summary className="cursor-pointer list-none">
              <span className="block text-[.67rem] font-semibold text-accent">محامي الطرف الغائب</span>
              <strong className="mt-1 block text-[.88rem] text-ink">{report.advocate.addressed ? 'الاعتراض حاضر في المسودة' : 'صوت مهم لم يُسمع بعد'}</strong>
              <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{report.advocate.party}</span>
            </summary>
            <p className="mt-3 border-t border-hair pt-3 text-[.76rem] leading-relaxed text-soft">{report.advocate.strongestObjection}</p>
            <p className="mt-2 text-[.74rem] leading-relaxed text-ink">الرد المنصف: {report.advocate.fairAnswer}</p>
            {!report.advocate.addressed && onInsertFairAnswer && (
              <button type="button" onClick={() => onInsertFairAnswer(fairObjectionParagraph(report.advocate))} className="mt-3 rounded-full border border-accent/30 bg-accent/[.04] px-3 py-1.5 text-[.7rem] font-semibold text-accent transition hover:bg-accent hover:text-white">
                أدخل فقرة الإنصاف في المسودة
              </button>
            )}
          </details>

          <details className="group rounded-2xl border border-hair bg-canvas p-4" open>
            <summary className="cursor-pointer list-none">
              <span className="block text-[.67rem] font-semibold text-accent">اختبار الزمن</span>
              <strong className="mt-1 block text-[.88rem] text-ink">{report.time.verdict}</strong>
              <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">{report.time.explanation}</span>
            </summary>
            <div className="mt-3 grid gap-2 border-t border-hair pt-3 text-[.72rem] leading-relaxed text-soft">
              <p><strong className="text-ink">بعد أسبوع:</strong> {report.time.afterWeek}</p>
              <p><strong className="text-ink">بعد سنة:</strong> {report.time.afterYear}</p>
              <p><strong className="text-ink">بعد عشر سنوات:</strong> {report.time.afterDecade}</p>
            </div>
          </details>
        </div>
      )}
    </section>
  )
}
