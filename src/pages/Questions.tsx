import { useState } from 'react'
import { Link } from 'react-router'
import { useSeo } from '../components/seo'
import { Page, PageHead, FadeUp, Reveal } from '../components/ui'
import { Share } from '../components/extras'
import { useExtras } from '../lib/content'
import { normalizeArabic } from '../lib/cms'
import { Pagination, usePagedList } from '../components/Pagination'
import { Question, LAUNCH_DATE, staticQuestions } from '../questions-data'
export { LAUNCH_DATE, staticQuestions }

const clean = (value = '') => value.replace(/\s+/g, ' ').trim()

/* تصنيف تلقائي للأسئلة (مقترح معتمد): يُستنتج من نص السؤال نفسه، بلا صيانة يدوية */
const QUESTION_TOPICS: [string, RegExp][] = [
  ['الذكاء الاصطناعي والتكنولوجيا', /ذكاء|خوارزم|تقني|رقمي|الاله|شاشه|هاتف|روبوت|تطبيق|انترنت/],
  ['التقويم والامتحانات', /امتحان|اختبار|درجه|درجات|تقويم|قياس|شهاده|رسوب|نجاح/],
  ['المعلم والمدرسة', /معلم|مدرس|مدرسه|فصل|تدريس|منهج|حصه/],
  ['الطالب والأسرة', /طالب|طفل|ابناء|اسره|بيت|والد|تربيه/],
]
const questionTopic = (text: string) => {
  const folded = normalizeArabic(text)
  for (const [label, pattern] of QUESTION_TOPICS) if (pattern.test(folded)) return label
  return 'فكر تربوي'
}
const isPublished = (item: { status?: string; published?: boolean }) =>
  item.published !== false && item.status !== 'draft' && item.status !== 'hidden'

const timestampMs = (value: unknown) => {
  if (!value) return 0
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime() || 0
  if (typeof value !== 'object') return 0
  const candidate = value as { seconds?: unknown; toMillis?: () => number }
  if (typeof candidate.toMillis === 'function') {
    try { return candidate.toMillis() || 0 } catch { return 0 }
  }
  return typeof candidate.seconds === 'number' ? candidate.seconds * 1000 : 0
}

const formatDate = (milliseconds: number) => {
  if (!milliseconds) return ''
  try {
    return new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(milliseconds))
  } catch {
    return ''
  }
}

function cadenceIndex(length: number) {
  if (length <= 0) return 0
  const elapsed = Date.now() - new Date(LAUNCH_DATE).getTime()
  const periods = Math.max(0, Math.floor(elapsed / (2 * 24 * 60 * 60 * 1000)))
  return periods % length
}

const relativePeriod = (offset: number) => {
  if (offset === 1) return 'السؤال السابق'
  return `قبل ${offset * 2} أيام`
}

type LiveQuestion = Question & {
  id?: string
  q?: string
  a?: string
  question?: string
  answer?: string
  arNote?: string
  takeEn?: string
  status?: string
  published?: boolean
  createdAt?: unknown
}

type ArchiveQuestion = Question & { label: string; key: string }

export default function Questions() {
  useSeo({
    title: 'سؤال يُقلق التعليم',
    path: '/questions',
    description: 'زاوية متجددة بأسئلة قصيرة توقظ التفكير في التعليم والتكنولوجيا والإنسان.',
  })

  const fbQuestions = useExtras<LiveQuestion>('site_questions', { realtime: true })
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
    .filter((item, index, all) => all.findIndex((candidate) => candidate.ar === item.ar) === index)
    .sort((left, right) => right.createdAtMs - left.createdAtMs)

  const currentStaticIndex = cadenceIndex(staticQuestions.length)
  const currentQuestion = liveQuestions[0] || staticQuestions[currentStaticIndex]
  const currentDate = liveQuestions[0]?.createdAtMs ? formatDate(liveQuestions[0].createdAtMs) : ''

  const liveArchive: ArchiveQuestion[] = liveQuestions.slice(1).map((item, index) => ({
    ar: item.ar,
    en: item.en,
    take: item.take,
    takeEn: item.takeEn,
    label: item.createdAtMs ? `أضيف في ${formatDate(item.createdAtMs)}` : relativePeriod(index + 1),
    key: `live-${item.ar}`,
  }))

  const staticArchive: ArchiveQuestion[] = staticQuestions.length > 1
    ? Array.from({ length: staticQuestions.length - 1 }, (_, index) => {
        const offset = index + 1
        const itemIndex = (currentStaticIndex - offset + staticQuestions.length) % staticQuestions.length
        const item = staticQuestions[itemIndex]
        return { ...item, label: relativePeriod(offset), key: `static-${itemIndex}-${item.ar}` }
      })
    : []

  const previousQuestions = [...liveArchive, ...staticArchive]
    .filter((item) => item.ar !== currentQuestion.ar)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.ar === item.ar) === index)
    .map((item) => ({ ...item, topic: questionTopic(`${item.ar} ${item.take}`) }))

  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const topics = Array.from(new Set(previousQuestions.map((item) => item.topic)))
  const filteredQuestions = topicFilter ? previousQuestions.filter((item) => item.topic === topicFilter) : previousQuestions
  const currentTopic = questionTopic(`${currentQuestion.ar} ${currentQuestion.take}`)

  const paged = usePagedList(filteredQuestions, 12, `${topicFilter || ''}:${filteredQuestions.length}`)

  return (
    <Page className="content-questions page-journey">
      <PageHead
        label="الزاوية المتجددة"
        title="سؤال يُقلق التعليم."
        sub="أسئلةٌ تتجدّد عند تقاطع التعليم والتكنولوجيا والإنسان — كلٌّ منها يستحقّ أن تتوقّف عنده."
      />
      <section className="border-b border-hair px-6 py-16 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-6 flex flex-wrap items-center gap-3 text-[.82rem] font-semibold text-accent">
              <span>السؤال الأحدث</span>
              {currentDate && <span className="font-normal text-soft">· {currentDate}</span>}
              <span className="rounded-full border border-accent/30 px-3 py-1 text-[.68rem] font-semibold">{currentTopic}</span>
            </div>
          </FadeUp>
          <Reveal>
            <h2 className="max-w-4xl font-display text-[clamp(1.7rem,4.6vw,3.2rem)] font-bold leading-[1.5] text-ink">
              {currentQuestion.ar}
            </h2>
          </Reveal>
          {currentQuestion.en && (
            <FadeUp delay={0.15}>
              <p className="mt-5 max-w-3xl text-[1.05rem] leading-relaxed text-soft" dir="ltr" style={{ textAlign: 'left' }}>
                {currentQuestion.en}
              </p>
            </FadeUp>
          )}
          <FadeUp delay={0.25}>
            <div className="mt-12 max-w-3xl rounded-2xl border border-hair bg-wash p-6 md:p-8">
              <p className="mb-3 text-[.8rem] font-semibold text-accent">رأيي — في سطرين</p>
              <p className="text-[1.05rem] leading-[2] text-ink">{currentQuestion.take}</p>
              {currentQuestion.takeEn && (
                <p className="mt-4 border-t border-hair pt-4 text-[.92rem] leading-relaxed text-soft" dir="ltr" style={{ textAlign: 'left' }}>
                  {currentQuestion.takeEn}
                </p>
              )}
            </div>
          </FadeUp>
          <FadeUp delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Share title={`سؤال يُقلق التعليم: ${currentQuestion.ar}`} path="/questions" />
              {/* الجسر إلى العقل الحي: السؤال يفتح المكتبة كلها بنقرة (مقترح معتمد) */}
              <Link
                to={`/ask?q=${encodeURIComponent(currentQuestion.ar)}`}
                className="inline-flex items-center gap-2 rounded-full border border-accent/35 px-5 py-2.5 text-[.82rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
              >
                ابحث عن هذا السؤال في أرشيفي
                <span aria-hidden>←</span>
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
      <section className="px-6 py-16 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-display text-2xl font-bold text-ink">أسئلة سابقة</h3>
              {topics.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTopicFilter(null)}
                    className={`rounded-full border px-3.5 py-1.5 text-[.74rem] font-semibold transition-colors ${!topicFilter ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                  >
                    الكل
                  </button>
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => setTopicFilter(topicFilter === topic ? null : topic)}
                      className={`rounded-full border px-3.5 py-1.5 text-[.74rem] font-semibold transition-colors ${topicFilter === topic ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FadeUp>
          <div id="questions-list" className="mobile-card-rail scroll-mt-28 grid gap-5">
            {paged.pageItems.map((question, index) => (
              <FadeUp key={question.key} delay={Math.min(index * 0.04, 0.3)}>
                <article className="rounded-2xl border border-hair p-6">
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-[.75rem] text-soft">
                    {question.label}
                    <span className="rounded-full border border-hair px-2.5 py-0.5 text-[.64rem] font-semibold text-accent">{question.topic}</span>
                  </p>
                  <p className="font-display text-xl font-semibold leading-relaxed text-ink">{question.ar}</p>
                  {question.en && (
                    <p className="mt-2 text-[.9rem] text-soft" dir="ltr" style={{ textAlign: 'left' }}>
                      {question.en}
                    </p>
                  )}
                  <p className="mt-4 text-[.95rem] leading-[1.9] text-soft">{question.take}</p>
                </article>
              </FadeUp>
            ))}
          </div>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filteredQuestions.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="questions-list" label="صفحات الأسئلة" className="mt-8" />
        </div>
      </section>
    </Page>
  )
}
