import { useSeo } from '../components/seo'
import { Page, PageHead, FadeUp, Reveal } from '../components/ui'
import { Share } from '../components/extras'
import { useExtras } from '../lib/content'
import { Question, LAUNCH_DATE, staticQuestions } from '../questions-data'
export { LAUNCH_DATE, staticQuestions }

const d = (l: number | string) => String(l).replace(/[0-9]/g, (t) => '0123456789'[+t])

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

  const fbQuestions = useExtras<Question>('site_questions', { realtime: true })
  const allQuestions = [...staticQuestions, ...fbQuestions]
  const activeIndex = b(allQuestions.length)
  const currentQuestion = allQuestions[activeIndex]
  const previousQuestions = allQuestions.slice(0, activeIndex).reverse()

  return (
    <Page>
      <PageHead
        label="الزاوية الأسبوعية"
        title="سؤال يُقلق التعليم."
        sub="كل جمعة، سؤال واحد لا يبحث عن إجابة سريعة — بل عن أرقٍ نافع. بالعربية والإنجليزية."
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
