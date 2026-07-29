import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { OwnerEdit } from '../components/extras'
import { useCmsContent } from '../lib/content'
import { SITE_URL } from '../data'
import { ideaWords } from '../lib/idea-life'

type BookGuide = { idea: string; audience: string; entry: string }

const BOOK_GUIDES: Record<string, BookGuide> = {
  encyclopedia: {
    idea: 'مرجع موسوعي يرسم خريطة متكاملة لمفاهيم تكنولوجيا التعليم وتطوّرها ونظمها وأدواتها وتطبيقاتها؛ ليعود إليه القارئ عند الحاجة ويبني لغة دقيقة ومشتركة حول المجال.',
    audience: 'طلبة كليات التربية، والمعلمون، وأعضاء هيئة التدريس، والباحثون، ومصممو التعلّم، وكل من يحتاج مرجعاً واسعاً ومنظماً في تكنولوجيا التعليم.',
    entry: 'لا تقرأه بالضرورة من أوله إلى آخره؛ ابدأ بالمفهوم الذي تبحث عنه، ثم اتبع الإحالات والعناوين القريبة منه لبناء صورة أشمل.',
  },
  teaching: {
    idea: 'يربط المناهج وطرق التدريس بتكامل التكنولوجيا داخل الموقف التعليمي؛ من تصميم التدريس وعلم النفس التربوي إلى التعلّم الإلكتروني والوسائط وأنظمة إدارة التعلّم والفيديو والإنفوجرافيك والألعاب.',
    audience: 'الطلبة المعلمون، والمعلمون، ومشرفو المناهج، ومصممو التعليم، والمدربون، وكل من يريد تحويل التقنية إلى ممارسة تدريسية واعية.',
    entry: 'ابدأ بالفصل الأقرب لمشكلتك الصفية أو مقررِك، ثم ارجع إلى الفصول التأسيسية لفهم المبدأ الذي يقف خلف الأداة.',
  },
  'mega-data': {
    idea: 'يناقش كيف تُدار منظومات الذكاء الاصطناعي والبيانات الضخمة بمسؤولية؛ من السياسات والخصوصية والأخلاقيات إلى جودة القرار والحوكمة داخل المؤسسات التعليمية.',
    audience: 'القيادات التعليمية، وصنّاع السياسات، والباحثون، ومديرو التحول الرقمي والبيانات، وأعضاء اللجان التي تعتمد أنظمة الذكاء الاصطناعي.',
    entry: 'ابدأ بسؤال القرار الذي تواجهه مؤسستك، ثم اقرأ المحاور المرتبطة بالبيانات والخصوصية والمساءلة قبل الانتقال إلى التطبيقات.',
  },
  'handy-tech': {
    idea: 'يقدّم التقنيات المساعدة بوصفها طريقاً إلى الإتاحة والاستقلال والتعلّم، ويشرح فئاتها ومعايير اختيارها وتوظيفها مع اختلاف احتياجات المتعلمين.',
    audience: 'معلمو التربية الخاصة، والأسر، وأخصائيو الدعم، ومصممو التعلّم، والقيادات التي تبني بيئات تعليمية دامجة.',
    entry: 'ابدأ بنوع الحاجة التعليمية، لا باسم الجهاز؛ ثم قارِن بين البدائل وفق قدرة المتعلم والسياق وهدف الاستخدام.',
  },
  'smart-school': {
    idea: 'يحوّل مفهوم المدرسة الذكية من شعار تقني إلى منظومة تشمل القيادة والبنية الرقمية والمعلم والمتعلم والبيئة التعليمية وآليات الانتقال والتقويم.',
    audience: 'قادة المدارس، وصنّاع السياسات، والمعلمون، وفرق التحول الرقمي، والباحثون في تطوير المؤسسات التعليمية.',
    entry: 'ابدأ بتشخيص واقع المدرسة، ثم اقرأ المحور الذي يمثل أضعف حلقة قبل بناء خطة التحول على مراحل قابلة للقياس.',
  },
  'virtual-world': {
    idea: 'يفكك مفهوم العوالم والبيئات الافتراضية ويبحث إمكاناتها التعليمية وتصميمها وتجربة الحضور والتفاعل فيها، مع الانتباه إلى حدودها ومخاطرها.',
    audience: 'المعلمون، ومصممو البيئات الغامرة، والباحثون، وطلبة تكنولوجيا التعليم، وكل من يخطط لتجربة تعلم افتراضية.',
    entry: 'ابدأ بالهدف التعليمي الذي لا يحققه الواقع بسهولة، ثم انتقل إلى اختيار البيئة الافتراضية وتصميم التفاعل وتقويم التجربة.',
  },
  'kids-tech': {
    idea: 'يضع الطفل قبل الشاشة، ويناقش أثر التكنولوجيا في نموه وتعلّمه وعلاقاته وعاداته، ويبحث الاستخدام المتوازن الذي يحمي المعنى ولا يعادي التقنية.',
    audience: 'الآباء والأمهات، ومعلمو الطفولة المبكرة، والمرشدون، والباحثون، وكل من يشارك في تشكيل علاقة الطفل بالتكنولوجيا.',
    entry: 'ابدأ بعمر الطفل والسلوك الذي تلاحظه، ثم اقرأ أثر الاستخدام وبدائله وقواعد المرافقة الأسرية والتربوية المناسبة.',
  },
  gamification: {
    idea: 'يميّز بين اللعب والألعاب التعليمية والتلعيب، ثم يشرح كيف تُستخدم عناصر الدافعية والتحدي والتغذية الراجعة في تصميم تعلّم ذي معنى لا في جمع النقاط فقط.',
    audience: 'المعلمون، والمدربون، ومصممو التعليم، ومطورو التجارب الرقمية، وكل من يريد رفع المشاركة من دون إفراغ التعلّم من مضمونه.',
    entry: 'ابدأ بالهدف والسلوك المراد تغييره، ثم اختر عنصر اللعب الذي يخدمه؛ لا تبدأ بالنقاط والشارات قبل فهم الدافعية.',
  },
  'digital-education': {
    idea: 'يشرح التحول إلى التعلّم الرقمي ومتطلباته المؤسسية والبشرية، وأدوار المعلم والمتعلم، ونماذج دمج التقنية مثل TPACK وSAMR والأدوات التي تدعم الممارسة.',
    audience: 'المعلمون، والقيادات التعليمية، ومصممو التعليم، والجامعات، وفرق التحول الرقمي، والطلبة الباحثون في التعليم المعاصر.',
    entry: 'ابدأ بجاهزية المؤسسة والمعلم والمتعلم، ثم استخدم النماذج والأدوات لتصميم ممارسة رقمية تحقق هدفاً تعليمياً واضحاً.',
  },
}

function bookGuide(slug: string, fallback?: string): BookGuide {
  return BOOK_GUIDES[slug] || {
    idea: fallback || 'يضع المفهوم في سياقه التعليمي، ثم يفتح طريقاً عملياً للفهم والتطبيق.',
    audience: 'للمهتمين بتكنولوجيا التعليم بوصفها معرفة عملية وإنسانية.',
    entry: 'ابدأ بالفكرة العامة، ثم انتقل إلى الفهرس واختر الفصل الأقرب لسؤالك.',
  }
}

export default function BookDetail() {
  const { slug } = useParams()
  const { books, articles, papers, loading } = useCmsContent()
  const book = books.find((b) => b.slug === slug)
  const guide = book ? bookGuide(book.slug, book.desc) : null
  const related = useMemo(() => {
    if (!book) return { article: null, paper: null }
    const source = new Set(ideaWords(`${book.title} ${book.desc || ''} ${guide?.idea || ''}`))
    const score = (value: string) => ideaWords(value).reduce((total, word) => total + (source.has(word) ? 1 : 0), 0)
    const article = articles
      .map((item) => ({ item, score: score(`${item.title} ${item.excerpt || ''} ${item.cat || ''}`) }))
      .sort((a, b) => b.score - a.score || b.item.iso.localeCompare(a.item.iso))[0]
    const paper = papers
      .map((item) => ({ item, score: score(`${item.title} ${item.titleAr || ''} ${item.abstractAr || ''} ${item.meta || ''}`) }))
      .sort((a, b) => b.score - a.score)[0]
    return { article: article?.score ? article.item : null, paper: paper?.score ? paper.item : null }
  }, [articles, book, guide?.idea, papers])
  useSeo({ title: book?.title ?? 'كتاب', description: book?.desc, path: `/publications/${slug}` })
  if (!book && loading) return <Page className="content-books"><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!book) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على الكتاب.</div></Page>

  return (
    <Page>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Book',
        '@id': `${SITE_URL}/publications/${book.slug}#book`,
        name: book.title,
        description: book.desc,
        isbn: book.isbn || undefined,
        url: `${SITE_URL}/publications/${book.slug}`,
        image: book.cover ? `${SITE_URL}${book.cover}` : undefined,
        inLanguage: 'ar',
        author: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'د. أحمد حسين الفيلكاوي' },
      }} />
      <section className="px-6 pb-24 pt-36 md:px-11 md:pt-44">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Link to="/publications" className="text-[.85rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link>
          </FadeUp>

          <div className="mt-10 grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
            <FadeUp>
              {/* لا تُعرض محتويات الكتب إطلاقاً (أمر الدكتور) — غلافٌ ثابت أنيق فقط،
                  بلا مفصلٍ يفتح على «داخل الكتاب» المضلِّل. صورة الغلاف تكفي. */}
              <div className="book-detail-cover mx-auto max-w-sm overflow-hidden rounded-xl border border-hair bg-white">
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
                  ['فكرة الكتاب', guide?.idea || book.desc],
                  ['لمن يناسب؟', guide?.audience || 'للمهتمين بموضوع الكتاب.'],
                  ['طريقة الدخول', guide?.entry || 'ابدأ بالفكرة العامة، ثم انتقل إلى الفهرس لتختار الفصل الأقرب لسؤالك.'],
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

      <section className="border-t border-hair bg-wash px-6 py-14 md:px-11 md:py-16" aria-labelledby="book-continue-title">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-[.72rem] font-semibold text-accent">واصل الفكرة</span>
                <h2 id="book-continue-title" className="mt-1 font-display text-2xl font-semibold text-ink">الكتاب داخل أرشيفٍ أوسع.</h2>
              </div>
              <Link to={`/thought-paths?idea=${encodeURIComponent(book.title)}`} className="text-[.78rem] font-semibold text-accent transition-opacity hover:opacity-70">افتح مساراً فكرياً ←</Link>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {related.article && (
                <Link to={`/articles/${related.article.slug}`} className="group rounded-2xl border border-hair bg-canvas p-5 transition-colors hover:border-accent">
                  <span className="text-[.68rem] font-semibold text-accent">مقال قريب</span>
                  <strong className="mt-2 block font-display text-[1.05rem] font-semibold leading-[1.55] text-ink transition-colors group-hover:text-accent">{related.article.title}</strong>
                  <span className="mt-2 block text-[.72rem] text-soft">{related.article.date}</span>
                </Link>
              )}
              {related.paper && (
                <Link to={`/research/${related.paper.slug}`} className="group rounded-2xl border border-hair bg-canvas p-5 transition-colors hover:border-accent">
                  <span className="text-[.68rem] font-semibold text-accent">بحث قريب</span>
                  <strong className="mt-2 block text-[.96rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent">{related.paper.titleAr || related.paper.title}</strong>
                  {related.paper.meta && <span className="mt-2 block text-[.72rem] text-soft">{related.paper.meta}</span>}
                </Link>
              )}
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
