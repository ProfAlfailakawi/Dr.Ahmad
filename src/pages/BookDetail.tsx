import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { OwnerEdit } from '../components/extras'
import { useCmsContent } from '../lib/content'

function bookAudience(title: string) {
  if (/طفل|الطفولة/.test(title)) return 'للآباء والمعلمين والباحثين في أثر التقنية على الطفل.'
  if (/ذوي الاحتياجات|الاحتياجات الخاصة/.test(title)) return 'للمعلمين ومصممي بيئات التعلم الشاملة.'
  if (/ذكاء|بيانات|حوكمة/.test(title)) return 'لصنّاع القرار والباحثين في التقنية والتعليم.'
  if (/العالم الافتراضي|افتراضي|واقع/.test(title)) return 'لمن يريد فهم البيئات الافتراضية بوصفها تجربة تعلم لا مجرد أداة.'
  if (/التلعيب|الألعاب/.test(title)) return 'للمهتمين بتحويل الدافعية واللعب إلى تصميم تعليمي واعٍ.'
  if (/مناهج|طرق التدريس/.test(title)) return 'للمعلم والطالب الجامعي ومن يصمم تعلمًا قابلًا للتطبيق.'
  return 'للمهتمين بتكنولوجيا التعليم بوصفها معرفة عملية وإنسانية.'
}

function bookKey(title: string, desc?: string) {
  if (/موسوعة/.test(title)) return 'مدخل مرجعي واسع؛ يعود إليه القارئ ليبني لغة مشتركة حول المجال.'
  if (/الطفل/.test(title)) return 'يسأل عن الطفل قبل الجهاز: ماذا تفعل الشاشة في النمو والمعنى؟'
  if (/ذكاء|بيانات/.test(title)) return 'يربط التقنية بالمسؤولية: من يملك القرار حين تتضخم البيانات؟'
  if (/مدارس ذكية/.test(title)) return 'ينقل المدرسة الذكية من شعار تقني إلى بيئة تعلم قابلة للقياس.'
  return desc || 'يضع المفهوم في سياقه التعليمي، ثم يفتح طريقًا عمليًا للفهم والتطبيق.'
}

export default function BookDetail() {
  const { slug } = useParams()
  const { books, loading } = useCmsContent()
  const book = books.find((b) => b.slug === slug)
  useSeo({ title: book?.title ?? 'كتاب', description: book?.desc, path: `/publications/${slug}` })
  if (!book && loading) return <Page><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!book) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على الكتاب.</div></Page>

  return (
    <Page>
      <section className="px-6 pb-24 pt-36 md:px-11 md:pt-44">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Link to="/publications" className="text-[.85rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link>
          </FadeUp>

          <div className="mt-10 grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
            <FadeUp>
              <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-30px_rgba(21,22,26,.45)]">
                {book.cover ? (
                  <img src={book.cover} alt={book.title} className="w-full" />
                ) : (
                  <div className="flex min-h-72 items-center justify-center bg-wash px-10 text-center font-display text-2xl font-semibold text-soft">{book.title}</div>
                )}
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <span className="text-[.8rem] font-semibold uppercase text-accent">كتاب</span>
              <h1 className="mt-4 font-display text-[clamp(2rem,4.6vw,3.2rem)] font-bold leading-[1.25] text-ink">
                <Reveal>{book.title}</Reveal>
              </h1>
            <OwnerEdit tab="books" slug={book.slug} className="mt-3" />
              {(book as { coAuthors?: string }).coAuthors?.trim() && (
                <p className="mt-4 text-[.92rem] text-soft">بالاشتراك مع {(book as { coAuthors?: string }).coAuthors}</p>
              )}
              {book.desc && <p className="mt-5 text-[1.08rem] font-light leading-[1.9] text-ink/80">{book.desc}</p>}

              {book.isbn && (
                <dl className="mt-8 border-t border-hair pt-6">
                  <div className="flex gap-4">
                    <dt className="w-24 shrink-0 text-[.85rem] text-soft">ردمك</dt>
                    <dd className="text-[.95rem] font-medium text-ink">{book.isbn}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-9 grid gap-3">
                {[
                  ['فكرة الكتاب', bookKey(book.title, book.desc)],
                  ['لمن يناسب؟', bookAudience(book.title)],
                  ['طريقة الدخول', 'ابدأ بالفكرة العامة، ثم انتقل إلى الفهرس لتختار الفصل الأقرب لسؤالك.'],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-hair bg-wash p-4">
                    <p className="text-[.78rem] font-semibold text-accent">{title}</p>
                    <p className="mt-1 text-[.9rem] leading-relaxed text-soft">{text}</p>
                  </div>
                ))}
              </div>

              {book.pdf && (
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href={book.pdf}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 rounded-full bg-accent px-7 py-3 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
                  >
                    <span>عرض عيّنة الكتاب</span>
                    <span className="text-[.85rem] opacity-80">PDF</span>
                  </a>
                </div>
              )}
            </FadeUp>
          </div>
        </div>
      </section>
    </Page>
  )
}
