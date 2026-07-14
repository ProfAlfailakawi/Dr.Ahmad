import { useSeo } from '../components/seo'
import { Page, PageHead, FadeUp, Reveal } from '../components/ui'
import { Share } from '../components/extras'
import { useExtras } from '../lib/content'
import { Question, LAUNCH_DATE, staticQuestions } from '../questions-data'
export { LAUNCH_DATE, staticQuestions }

const d = (l: number | string) => String(l).replace(/[0-9]/g, (t) => '0123456789'[+t])
const clean = (value = '') => value.replace(/\s+/g, ' ').trim()
const timestampMs = (value: unknown) => {
  if (!value || typeof value !== 'object') return 0
  const seconds = (value as { seconds?: unknown }).seconds
  return typeof seconds === 'number' ? seconds * 1000 : 0
}
const isPublished = (item: { status?: string; published?: boolean }) =>
  item.published !== false && item.status !== 'draft' && item.status !== 'hidden'

function b(length: number) {
  if (length <= 0) return 0
  const elapsed = Date.now() - new Date(LAUNCH_DATE).getTime()
  const weeks = Math.max(0, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)))
  // دوران دائري: يتبدّل السؤال كل جمعة ولا يتوقف عند آخر سؤال — يعود للبداية
  return weeks % length
}

export default function Questions() {
  useSeo({
    title: 'سؤال يُقلق التعليم',
    path: '/questions',
    description: 'زاوية أسبوعية: كل جمعة سؤال جديد يوقظ التفكير في التعليم — بالعربية والإنجليزية.',
  })

  const fbQuestions = useExtras<(Question & { id?: string; q?: string; a?: string; question?: string; answer?: string; arNote?: string; takeEn?: string; status?: string; published?: boolean; createdAt?: unknown })>('site_questions', { realtime: true })
  const liveQuestions = fbQuestions
    .filter(isPublished)
    .map((item) => ({
      ar: clean(item.ar || item.q || item.question || ''),
      en: clean(item.en || ''),
      take: clean(item.take || item.a || item.answer || item.arNote || ''),
      takeEn: clean(item.takeEn || ''),
      createdAtMs: timestampMs(item.createdAt),
    }))
    .filter((item) => item.ar && item.take)
    .sort((left, right) => right.createdAtMs - left.createdAtMs)
  const weeklyStaticIndex = b(staticQuestions.length)
  const currentQuestion = liveQuestions[0] || staticQuestions[weeklyStaticIndex]
  const previousQuestions = [
    ...liveQuestions.slice(1),
    ...staticQuestions.slice(0, weeklyStaticIndex).reverse(),
    ...staticQuestions.slice(weeklyStaticIndex + 1).reverse(),
  ].slice(0, 18)
  const activeIndex = liveQuestions.length ? liveQuestions.length : weeklyStaticIndex + 1

  return (
    <Page>
      <PageHead
        label="الزاوية المتجددة"
        title="سؤال يُقلق التعليم."
        sub="أسئلة قصيرة من مجال التعليم والتقنية والإنسان؛ تظهر تلقائياً عند اعتمادها، وتبقى الأسئلة الأسبوعية احتياطاً حيّاً."
      />
      <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="mb-6 text-[.82rem] font-semibold uppercase text-accent">
              سؤال الأسبوع {d(activeIndex + 1)}
            </p>
          </FadeUp>
          <Reveal>
            <h2 className="max-w-4xl font-display text-[clamp(1.7rem,4.6vw,3.2rem)] font-bold leading-[1.5] text-ink">
              {currentQuestion.ar}
            </h2>
          </Reveal>
          <FadeUp delay={0.15}>
            <p className="mt-5 max-w-3xl text-[1.05rem] leading-relaxed text-soft" dir="ltr" style={{ textAlign: 'left' }}>
              {currentQuestion.en}
            </p>
          </FadeUp>
          <FadeUp delay={0.25}>
            <div className="mt-12 max-w-3xl rounded-2xl border border-hair bg-wash p-6 md:p-8">
              <p className="mb-3 text-[.8rem] font-semibold text-accent">رأيي — في سطرين</p>
              <p className="text-[1.05rem] leading-[2] text-ink">{currentQuestion.take}</p>
              <p className="mt-4 border-t border-hair pt-4 text-[.92rem] leading-relaxed text-soft" dir="ltr" style={{ textAlign: 'left' }}>
                {currentQuestion.takeEn}
              </p>
            </div>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="mt-10">
              <Share title={`سؤال يُقلق التعليم: ${currentQuestion.ar}`} path="/questions" />
            </div>
          </FadeUp>
        </div>
      </section>
      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <h3 className="mb-10 font-display text-2xl font-bold text-ink">أسئلة الأسابيع الماضية</h3>
          </FadeUp>
          {previousQuestions.length === 0 ? (
            <FadeUp>
              <p className="text-soft">هذا أول أسبوع — الأرشيف يبدأ من الجمعة القادمة، حين يحلّ سؤال جديد مكان هذا تلقائياً.</p>
            </FadeUp>
          ) : (
            <div className="grid gap-5">
              {previousQuestions.map((n, x) => (
                <FadeUp key={n.ar} delay={Math.min(x * 0.04, 0.3)}>
                  <div className="rounded-2xl border border-hair p-6">
                    <p className="mb-1 text-[.75rem] text-soft">الأسبوع {d(activeIndex - x)}</p>
                    <p className="font-display text-xl font-semibold leading-relaxed text-ink">{n.ar}</p>
                    <p className="mt-2 text-[.9rem] text-soft" dir="ltr" style={{ textAlign: 'left' }}>
                      {n.en}
                    </p>
                    <p className="mt-4 text-[.95rem] leading-[1.9] text-soft">{n.take}</p>
                  </div>
                </FadeUp>
              ))}
            </div>
          )}
        </div>
      </section>
    </Page>
  )
}
