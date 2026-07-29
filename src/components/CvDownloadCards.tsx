import { FadeUp } from './ui'

export function CvDownloadCards({ academicHref }: { academicHref: string }) {
  return (
    <FadeUp>
      <section className="mb-14" aria-labelledby="cv-downloads-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[.72rem] font-semibold text-accent">ملفات جاهزة</p>
            <h2 id="cv-downloads-title" className="mt-1 font-display text-xl font-semibold text-ink">اختر السيرة المناسبة لغرضك.</h2>
          </div>
          <span className="text-[.7rem] text-soft">ثلاثة أبواب، وسجل واحد.</span>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <a href={academicHref} target="_blank" rel="noreferrer" aria-label="السيرة الذاتية الأكاديمية PDF" className="group rounded-2xl border border-accent/30 bg-accent/[.05] p-3 text-center transition-all duration-300 hover:border-accent hover:bg-accent/10 hover:shadow-md sm:p-6">
            <span aria-hidden className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>
            </span>
            <span className="mt-2 block font-display text-[.72rem] font-bold leading-snug text-ink transition-colors group-hover:text-accent sm:mt-4 sm:text-[1.05rem]">السيرة الذاتية الأكاديمية</span>
            <span className="mt-1 block text-[.68rem] font-semibold text-soft sm:text-[.72rem]">PDF</span>
          </a>
          <a href="/files/Dr-Ahmad-Training-Profile.pdf" target="_blank" rel="noreferrer" aria-label="السيرة الذاتية التدريبية PDF" className="group rounded-2xl border border-hair bg-canvas p-3 text-center transition-all duration-300 hover:border-accent hover:shadow-md sm:p-6">
            <span aria-hidden className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 text-accent transition-colors group-hover:bg-accent group-hover:text-white sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </span>
            <span className="mt-2 block font-display text-[.72rem] font-bold leading-snug text-ink transition-colors group-hover:text-accent sm:mt-4 sm:text-[1.05rem]">السيرة الذاتية التدريبية</span>
            <span className="mt-1 block text-[.68rem] font-semibold text-soft sm:text-[.72rem]">PDF</span>
          </a>
          <a href="/files/Dr-Ahmad-Media-Kit.pdf" target="_blank" rel="noreferrer" aria-label="السيرة الذاتية الإعلامية PDF" className="group rounded-2xl border border-hair bg-canvas p-3 text-center transition-all duration-300 hover:border-accent hover:shadow-md sm:p-6">
            <span aria-hidden className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 text-accent transition-colors group-hover:bg-accent group-hover:text-white sm:h-14 sm:w-14">
              <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>
            </span>
            <span className="mt-2 block font-display text-[.72rem] font-bold leading-snug text-ink transition-colors group-hover:text-accent sm:mt-4 sm:text-[1.05rem]">السيرة الذاتية الإعلامية</span>
            <span className="mt-1 block text-[.68rem] font-semibold text-soft sm:text-[.72rem]">PDF</span>
          </a>
        </div>
      </section>
    </FadeUp>
  )
}
