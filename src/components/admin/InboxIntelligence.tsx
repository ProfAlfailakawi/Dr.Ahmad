import { useMemo } from 'react'
import { analyzeInboxMessage, buildAudienceSignals, type InboxMessageInput } from '../../lib/inbox-intelligence'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'

export function InboxIntelligence({ messages }: { messages: InboxMessageInput[] }) {
  const signals = useMemo(() => buildAudienceSignals(messages), [messages])
  const counts = useMemo(() => {
    const rows = messages.map(analyzeInboxMessage)
    return {
      high: rows.filter((row) => row.priority === 'عالية').length,
      strong: rows.filter((row) => row.contentPotential === 'قوي').length,
      collaboration: rows.filter((row) => row.kind === 'تعاون' || row.kind === 'دعوة أو فعالية' || row.kind === 'طلب إعلامي').length,
    }
  }, [messages])

  return (
    <section className={`${card} border-accent/20 bg-accent/[.025]`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">Inbox Intelligence</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink">الجمهور نفسه يرصد لك ما يستحق الانتباه.</h2>
          <p className="mt-2 max-w-3xl text-[.83rem] leading-relaxed text-soft">التصنيف يتم داخل اللوحة من نصوص الرسائل الموجودة أصلاً؛ لا ينشر شيئاً ولا يرسل النص إلى خدمة خارجية.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <span className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-lg text-ink">{counts.high}</strong><span className="text-[.68rem] text-soft">عالية الأولوية</span></span>
          <span className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-lg text-ink">{counts.collaboration}</strong><span className="text-[.68rem] text-soft">فرص</span></span>
          <span className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-lg text-ink">{counts.strong}</strong><span className="text-[.68rem] text-soft">بذور محتوى</span></span>
        </div>
      </div>

      <div className="mt-5 border-t border-hair pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-ink">إشارات تتكرر من الجمهور</p>
          <span className="text-[.72rem] text-soft">لا تظهر الإشارة حتى تتكرر مرتين على الأقل</span>
        </div>
        {signals.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {signals.map((signal) => (
              <article key={signal.theme} className="rounded-xl border border-hair bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-[.9rem] text-ink">{signal.theme}</strong>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-[.7rem] font-semibold text-accent">{signal.strength} · {signal.count}</span>
                </div>
                <p className="mt-2 text-[.81rem] leading-relaxed text-soft">{signal.suggestion}</p>
                <button
                  type="button"
                  onClick={() => {
                    try { sessionStorage.setItem('admin:knowledge-seed', signal.theme); sessionStorage.setItem('admin:lab-view', 'develop') } catch { /* private mode */ }
                    window.location.assign('/admin?tab=lab')
                  }}
                  className="mt-3 rounded-full border border-accent/25 bg-canvas px-3 py-1.5 text-[.7rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                >
                  افتح الإشارة في عقل الأرشيف
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">لا يوجد تكرار معرفي كافٍ حتى الآن. ستبدأ هذه المساحة بإظهار الأنماط تلقائياً عندما يتكرر السؤال أو الموضوع.</p>
        )}
      </div>
    </section>
  )
}

export function InboxInsightBadges({ message }: { message: InboxMessageInput }) {
  const insight = useMemo(() => analyzeInboxMessage(message), [message])
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.7rem] font-semibold text-ink">{insight.kind}</span>
      {insight.priority !== 'عادية' && <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.7rem] text-soft">أولوية {insight.priority}</span>}
      {insight.contentPotential !== 'ضعيف' && <span title={insight.reason} className="rounded-full border border-accent/25 bg-accent/[.05] px-3 py-1 text-[.7rem] font-semibold text-accent">بذرة محتوى: {insight.theme}</span>}
      {insight.concepts.slice(1, 3).map((concept) => <span key={concept} className="rounded-full border border-hair px-3 py-1 text-[.68rem] text-soft">{concept}</span>)}
    </div>
  )
}
