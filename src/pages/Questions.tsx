import { useSeo } from '../components/seo'
import { Page, PageHead, FadeUp, Reveal } from '../components/ui'
import { Share } from '../components/extras'
import { useState, useEffect } from 'react'
import { firebaseEnabled, fetchExtras } from '../lib/firebase'

interface Question {
  ar: string
  en: string
  take: string
  takeEn: string
}

export const LAUNCH_DATE = '2026-07-10'

export const staticQuestions: Question[] = [
  {
    ar: 'إذا كان الامتحان يقيس التذكّر… فمن يقيس الفهم؟',
    en: 'If exams measure recall… who measures understanding?',
    take: 'نحتفل بالدرجة لأنها سهلة العدّ، ونتجاهل الفهم لأنه عصيّ على الجداول. لكن ما لا يُقاس لا يعني أنه غير موجود — بل يعني أننا نقيس الأسهل، لا الأهم.',
    takeEn: 'We celebrate grades because they are easy to count, and neglect understanding because it resists tables. What goes unmeasured is not absent — we simply measure what is easiest, not what matters most.',
  },
  {
    ar: 'لماذا يدخل الطفل المدرسة وكله أسئلة… ويتخرج منها بلا سؤال؟',
    en: 'Why does a child enter school full of questions… and graduate without any?',
    take: 'الفضول لا يموت فجأة؛ يُطفأ درجةً بعد درجة، وحصةً بعد حصة، حين تصبح الإجابة الصحيحة أهم من السؤال الجيد.',
    takeEn: 'Curiosity does not die suddenly; it is extinguished grade by grade, lesson by lesson, once the right answer becomes more important than a good question.',
  },
  {
    ar: 'حين يجيب الذكاء الاصطناعي عن كل شيء… ما الذي يبقى للمعلم؟',
    en: 'When AI answers everything… what remains for the teacher?',
    take: 'يبقى له ما لا تملكه الآلة: أن يرى في الطالب ما لا يراه الطالب في نفسه. المعلومة صارت رخيصة، والمعنى صار أغلى من أي وقت مضى.',
    takeEn: 'What remains is what no machine possesses: seeing in a student what the student cannot yet see in himself. Information became cheap; meaning became more precious than ever.',
  },
  {
    ar: 'هل نعلّم أبناءنا لمستقبلهم… أم لماضينا؟',
    en: 'Do we teach our children for their future… or for our past?',
    take: 'أغلب مناهجنا إجابات ممتازة عن أسئلة القرن الماضي. المستقبل لا يحتاج طلاباً يشبهوننا، بل طلاباً يتجاوزوننا.',
    takeEn: "Most curricula are excellent answers to last century's questions. The future does not need students who resemble us — it needs students who surpass us.",
  },
  {
    ar: 'الدرجة الكاملة: علامةُ فهمٍ كامل… أم حفظٍ كامل؟',
    en: 'A perfect score: a sign of perfect understanding… or perfect memorization?',
    take: 'من السهل أن تملأ ورقة، ومن الصعب أن تملأ عقلاً. بعض التفوق مجرد ذاكرة ممتازة في نظام لا يطلب أكثر.',
    takeEn: 'Filling a paper is easy; filling a mind is hard. Some excellence is merely a fine memory in a system that asks for nothing more.',
  },
  {
    ar: 'من يعلّم المعلمَ… بعد تخرجه؟',
    en: 'Who teaches the teacher… after graduation?',
    take: 'نطالب المعلم بتخريج جيل رقمي، وهو نفسه غادر مقاعد التطوير منذ سنوات. التعليم مهنة من لا يتوقف عن التعلم — أو هكذا يجب أن يكون.',
    takeEn: 'We ask teachers to raise a digital generation while their own development stopped years ago. Teaching is the profession of those who never stop learning — or so it should be.',
  },
  {
    ar: 'هل المدرسة مكانٌ للتعلم… أم مبنى للاختبار؟',
    en: 'Is school a place for learning… or a building for testing?',
    take: 'حين يصبح الامتحان هو الهدف، تتحول المدرسة من مختبر للعقل إلى قاعة انتظار للنتائج.',
    takeEn: 'When the exam becomes the goal, school turns from a laboratory of the mind into a waiting room for results.',
  },
  {
    ar: 'التكنولوجيا وسيلة… فمتى صارت غاية؟',
    en: 'Technology is a means… when did it become the end?',
    take: 'شاشة ذكية في فصل تقليدي لا تصنع تعليماً ذكياً. الأداة لا تُصلح سؤالاً لم يُطرح أصلاً: ماذا نريد من التعلم؟',
    takeEn: 'A smart screen in a traditional classroom does not make education smart. No tool can fix a question that was never asked: what do we want from learning?',
  },
  {
    ar: 'كم فكرةً عظيمة… قتلها جدول الحصص؟',
    en: 'How many great ideas… were killed by the timetable?',
    take: 'الإبداع لا يعرف أن الحصة 45 دقيقة. نصمم اليوم الدراسي للإدارة لا للدهشة، ثم نسأل: أين المبدعون؟',
    takeEn: 'Creativity does not know the lesson lasts 45 minutes. We design the school day for administration, not wonder — then wonder where the innovators went.',
  },
  {
    ar: 'حين يخاف الطالب من الخطأ… ماذا تعلّم فعلاً؟',
    en: 'When a student fears mistakes… what has he actually learned?',
    take: 'تعلّم أن يخفي جهله بدل أن يعالجه. الفصل الذي يعاقب الخطأ يخرّج ممثلين بارعين، لا متعلمين شجعاناً.',
    takeEn: 'He learned to hide his ignorance rather than treat it. A classroom that punishes error graduates skilled actors, not brave learners.',
  },
  {
    ar: 'نقيس ما يعرفه الطالب… فمن يقيس ما يستطيع فعله بما يعرف؟',
    en: 'We measure what students know… who measures what they can do with it?',
    take: 'المعرفة بلا استعمال عبء على الذاكرة. الفارق بين المتعلم والحافظ أن الأول يحوّل ما يعرفه إلى أثر.',
    takeEn: 'Knowledge without use is a burden on memory. The difference between a learner and a memorizer: the first turns knowledge into impact.',
  },
  {
    ar: 'التعليم عن بعد: قرّبنا من المعرفة… أم باعد بيننا وبين المدرسة؟',
    en: 'Distance learning: did it bring knowledge closer… or push school further away?',
    take: 'اكتشفنا في الجائحة أن المدرسة أكثر من محتوى: إنها علاقة. المنصات نقلت الدروس بنجاح، وعجزت عن نقل العيون التي تلاحظ أن طالباً ما لم يعد بخير.',
    takeEn: 'The pandemic taught us that school is more than content: it is a relationship. Platforms delivered lessons well — but failed to deliver the eyes that notice a student is no longer okay.',
  },
]

const d = (l: number | string) => String(l).replace(/[0-9]/g, (t) => '0123456789'[+t])

function b(length: number) {
  const elapsed = Date.now() - new Date(LAUNCH_DATE).getTime()
  const weeks = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000))
  return Math.max(0, Math.min(length - 1, weeks))
}

function useCollectionData<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([])

  useEffect(() => {
    let active = true
    if (firebaseEnabled) {
      fetchExtras<T>(collectionName).then((items) => {
        if (active) setData(items as any)
      })
    }
    return () => {
      active = false
    }
  }, [collectionName])

  return data
}

export default function Questions() {
  useSeo({
    title: 'سؤال يُقلق التعليم',
    path: '/questions',
    description: 'زاوية أسبوعية: كل جمعة سؤال جديد يوقظ التفكير في التعليم — بالعربية والإنجليزية.',
  })

  const fbQuestions = useCollectionData<Question>('site_questions')
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
            <p className="mb-6 text-[.82rem] font-semibold uppercase tracking-widest text-accent">
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
