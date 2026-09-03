import type { IdeaDna } from '../../lib/idea-dna'

const pill = 'rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.68rem] text-soft'

export function IdeaDnaPanel({ dna, defaultOpen = false }: { dna: IdeaDna; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-2xl border border-accent/20 bg-accent/[.025]" open={defaultOpen} data-idea-dna={dna.fingerprint}>
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[.68rem] font-semibold uppercase text-accent">Idea DNA · {dna.fingerprint.replace('idea-', '').toUpperCase()}</span>
            <strong className="mt-1 block font-display text-[1.02rem] text-ink">بصمة الفكرة تقود الإخراج قبل اختيار القالب.</strong>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className={pill}>{dna.topic.label}</span>
            <span className={pill}>عمق {dna.depth.score}٪</span>
            <span className={pill}>جِدة {dna.novelty.score}٪</span>
            <span className={pill}>{dna.evidence.label}</span>
          </div>
        </div>
      </summary>
      <div className="border-t border-hair px-4 py-4 sm:px-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-hair bg-canvas p-3.5">
            <span className="text-[.64rem] text-soft">الصوت والنبرة</span>
            <strong className="mt-1 block text-[.82rem] text-ink">{dna.tone.label} · {dna.direction.audio.label}</strong>
            <span className="mt-1 block text-[.68rem] text-soft">إيقاع {dna.direction.audio.pace}</span>
          </div>
          <div className="rounded-xl border border-hair bg-canvas p-3.5">
            <span className="text-[.64rem] text-soft">الصورة والخط</span>
            <strong className="mt-1 block text-[.82rem] text-ink">{dna.direction.image.label} · {dna.direction.typography.label}</strong>
            <span className="mt-1 line-clamp-2 block text-[.68rem] leading-relaxed text-soft">{dna.direction.image.brief}</span>
          </div>
          <div className="rounded-xl border border-hair bg-canvas p-3.5">
            <span className="text-[.64rem] text-soft">اللون والبنية</span>
            <strong className="mt-1 block text-[.82rem] text-ink">{dna.direction.palette.label}</strong>
            <span className="mt-1 block text-[.68rem] text-soft">{dna.direction.layout.primary} · {dna.direction.density}</span>
          </div>
          <div className="rounded-xl border border-hair bg-canvas p-3.5">
            <span className="text-[.64rem] text-soft">المنصة والجمهور</span>
            <strong className="mt-1 block text-[.82rem] text-ink">{dna.direction.platform.label}</strong>
            <span className="mt-1 line-clamp-2 block text-[.68rem] leading-relaxed text-soft">{dna.audience.primary}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {dna.keywords.slice(0, 7).map((keyword) => <span key={keyword} className={pill}>{keyword}</span>)}
        </div>
        {dna.novelty.nearest && <p className="mt-3 text-[.7rem] leading-relaxed text-soft">أقرب صدى في الأرشيف: <strong className="text-ink">{dna.novelty.nearest.title}</strong> · تشابه {dna.novelty.nearest.similarity}٪. البصمة تستخدم هذا الصدى لتبحث عن زاوية مختلفة، لا لتكررها.</p>}
      </div>
    </details>
  )
}
