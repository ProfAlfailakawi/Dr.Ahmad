export type PublishingStudioView = 'idea' | 'write' | 'review' | 'distribution' | 'pulse'

export function PublishingStudioNavigation({ view, onSelect }: { view: PublishingStudioView; onSelect: (view: PublishingStudioView) => void }) {
  const articleStages: { key: Exclude<PublishingStudioView, 'pulse'>; label: string; note: string }[] = [
    { key: 'idea', label: 'الفكرة', note: 'البذرة والسياق' },
    { key: 'write', label: 'الكتابة', note: 'النص والتحرير' },
    { key: 'review', label: 'بوابة الجودة', note: 'المراجعة والقرار' },
    { key: 'distribution', label: 'التوزيع', note: 'حزمة النشر' },
  ]
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <section className="rounded-2xl border border-hair bg-canvas p-3" aria-label="مسار المقال">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <span className="text-[.66rem] font-bold text-accent">مسار المقال</span>
          <span className="text-[.6rem] text-soft">فكرة ← كتابة ← جودة ← توزيع</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {articleStages.map((stage, index) => (
            <button key={stage.key} type="button" onClick={() => onSelect(stage.key)} className={`min-h-12 rounded-xl px-3 py-2 text-right transition-colors ${view === stage.key ? 'bg-accent text-white' : 'border border-hair bg-wash text-ink hover:border-accent hover:text-accent'}`}>
              <span className="block text-[.64rem] font-semibold opacity-70">{String(index + 1).padStart(2, '0')}</span>
              <strong className="mt-0.5 block text-[.76rem]">{stage.label}</strong>
            </button>
          ))}
        </div>
      </section>
      <button type="button" onClick={() => onSelect('pulse')} className={`rounded-2xl border p-4 text-right transition-colors ${view === 'pulse' ? 'border-accent bg-accent text-white' : 'border-accent/25 bg-accent/[.035] text-ink hover:border-accent'}`}>
        <span className={`text-[.65rem] font-semibold ${view === 'pulse' ? 'text-white/70' : 'text-accent'}`}>مسار سريع مستقل</span>
        <strong className="mt-1 block font-display text-[1rem]">منشور مستقل</strong>
        <span className={`mt-1 block text-[.66rem] leading-relaxed ${view === 'pulse' ? 'text-white/70' : 'text-soft'}`}>لا ينتظر مقالاً ولا يُعامل كخطوة خامسة.</span>
      </button>
    </div>
  )
}
