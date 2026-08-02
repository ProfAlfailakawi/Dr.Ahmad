import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { OwnerEdit } from '../components/extras'
import { useCmsContent } from '../lib/content'
import { SITE_URL } from '../data'
import tocData from '../data/book-toc-links.json'
import { SocialIcon } from '../components/icons'
import type { ArticleRecord, BookRecord, PaperRecord } from '../lib/cms'

type BookGuide = { idea: string; audience: string; entry: string }

type TocEntry = { index: number; label: string; page: string }
type TocGroup = { title: string; entries: TocEntry[] }

const LazyBookWorld = lazy(() => import('../components/BookWorld').then((module) => ({ default: module.BookWorld })))

function splitTocLabel(value: string) {
  const match = value.match(/^(.*?)(?:\s*[–—-]\s*ص\s*([0-9٠-٩]+))\s*$/u)
  return match ? { label: match[1].trim(), page: match[2] } : { label: value.trim(), page: '' }
}

function groupToc(items: string[]): TocGroup[] {
  const groups: TocGroup[] = []
  let current: TocGroup = { title: 'مدخل الكتاب', entries: [] }
  items.forEach((raw, index) => {
    const value = raw.trim()
    if (!value) return
    if (/^الباب\s/u.test(value)) {
      if (current.entries.length) groups.push(current)
      current = { title: value, entries: [] }
      return
    }
    const parsed = splitTocLabel(value)
    current.entries.push({ index: index + 1, ...parsed })
  })
  if (current.entries.length) groups.push(current)
  if (!groups.length && items.length) {
    return [{ title: 'محتويات الكتاب', entries: items.map((item, index) => ({ index: index + 1, ...splitTocLabel(item) })) }]
  }
  return groups
}

function DeferredBookWorld({ book, seed, articles, books, papers }: { book: BookRecord; seed: string; articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[] }) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false
    return /book-knowledge|ask-book-section/u.test(window.location.hash) || new URLSearchParams(window.location.search).has('book_question')
  })

  useEffect(() => {
    const revealFromLocation = () => {
      if (/book-knowledge|ask-book-section/u.test(window.location.hash) || new URLSearchParams(window.location.search).has('book_question')) setReady(true)
    }
    revealFromLocation()
    window.addEventListener('hashchange', revealFromLocation)
    return () => window.removeEventListener('hashchange', revealFromLocation)
  }, [])

  useEffect(() => {
    if (ready || !anchorRef.current) return
    if (!('IntersectionObserver' in window)) {
      const timer = window.setTimeout(() => setReady(true), 500)
      return () => window.clearTimeout(timer)
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setReady(true)
      observer.disconnect()
    }, { rootMargin: '700px 0px' })
    observer.observe(anchorRef.current)
    return () => observer.disconnect()
  }, [ready])

  return (
    <div ref={anchorRef} className="min-h-28">
      {ready ? (
        <Suspense fallback={<div className="border-t border-hair bg-wash px-6 py-14 text-center text-[.78rem] text-soft">تُجهّز امتدادات الكتاب بهدوء…</div>}>
          <LazyBookWorld book={book} seed={seed} articles={articles} books={books} papers={papers} />
        </Suspense>
      ) : (
        <div className="border-t border-hair bg-wash px-6 py-10 text-center text-[.74rem] text-soft" aria-hidden="true">تظهر امتدادات الكتاب عند الاقتراب منها.</div>
      )}
    </div>
  )
}

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

const TOC_TITLE_BY_SLUG: Record<string, string> = {
  encyclopedia: 'موسوعة تكنولوجيا التعليم',
  teaching: 'مناهج وطرق التدريس (تكنولوجيا التعليم)',
  'handy-tech': 'التكنولوجيا المساندة لذوي الاحتياجات الخاصة',
  'smart-school': 'المدرسة الذكية',
  gamification: 'التلعيب في التعليم',
  'digital-education': 'التعليم الرقمي',
}

function verifiedToc(slug: string, custom = '') {
  if (custom.trim()) return custom.split('\n').map((item) => item.trim()).filter(Boolean)
  const title = TOC_TITLE_BY_SLUG[slug]
  const record = (tocData as { books?: { title: string; sections?: { label?: string }[] }[] }).books?.find((item) => item.title === title)
  return (record?.sections || []).map((item) => item.label?.trim() || '').filter(Boolean)
}

function editorialDescription(title: string, guide: BookGuide) {
  return [
    `يقدّم كتاب «${title}» مدخلاً منظماً إلى قضية تتصل مباشرة بتحولات التعليم المعاصر، ويضع القارئ أمام الفكرة قبل الأداة، وأمام الغاية قبل الانبهار بالتقنية. ينطلق الكتاب من أن المعرفة التربوية لا تكتمل بتجميع المصطلحات أو استعراض التطبيقات؛ بل تحتاج إلى لغة دقيقة تربط المفهوم بالسياق، وتبيّن شروط الاستخدام، وتكشف أثر القرار في المعلم والمتعلم والمؤسسة. وفي هذا الإطار تتمثل فكرته المركزية في أن ${guide.idea}`,
    `بُني الكتاب ليكون قابلاً للقراءة بأكثر من طريقة. يستطيع الطالب أن يتعامل معه بوصفه مدخلاً تأسيسياً يضبط المصطلحات، ويستطيع المعلم أن يرجع إلى المحور الأقرب إلى موقفه العملي، كما يستطيع الباحث أو القائد التربوي أن يستخدمه خريطةً للأسئلة التي تستحق التحقق والتطوير. لا يفترض النص أن التقنية حلٌ قائم بذاته، ولا يحوّلها إلى قائمة أجهزة ومنصات؛ بل يقرأ علاقتها بالتصميم والتعلّم والسلوك والعدالة والجاهزية المؤسسية. لذلك تتجاور فيه المعرفة النظرية مع الأسئلة التطبيقية، ويظل الحكم على الأداة مرتبطاً بما تحققه من معنى تعلمي يمكن ملاحظته وتقويمه.` ,
    `كُتب هذا العمل لأن الخطاب الشائع حول التكنولوجيا التعليمية كثيراً ما يقفز إلى المنتج قبل أن يحدد المشكلة، أو يساوي بين كثرة الاستخدام وجودة الأثر. يحاول الكتاب إعادة ترتيب هذا المسار: تشخيص الحاجة أولاً، ثم فهم المتعلم والسياق، ثم اختيار التصميم أو التقنية، وأخيراً مراجعة النتيجة وآثارها المقصودة وغير المقصودة. هذه البنية تجعل مادته نافعة في الدراسة الجامعية، وفي تطوير الدروس والبرامج، وفي النقاشات المؤسسية التي تحتاج قراراً أكثر مسؤولية وأقل اندفاعاً.` ,
    `الفئة الأقرب إلى الكتاب هي ${guide.audience} ومع ذلك لا يُشترط أن يبدأ جميع القراء من الصفحة الأولى؛ ${guide.entry} ويستطيع القارئ بعد كل محور أن يقارن ما قرأه بخبرته، وأن يسجل الأسئلة التي بقيت مفتوحة، وأن يعود إلى المقالات والأبحاث المرتبطة في الموقع لتتبّع الفكرة عبر مواد منشورة أخرى. وبهذا لا تبقى صفحة الكتاب بطاقة تعريف جامدة، بل تصبح بوابة إلى مشروع معرفي أوسع يصل المؤلف بالبحث والمقال والحوار العام، مع فصل واضح بين ما يورده الكتاب فعلاً وما يقترحه الأرشيف بوصفه صلة موضوعية.` ,
    `القيمة الأساسية لهذا الكتاب ليست في وعدٍ بحل سريع، بل في بناء معيار يساعد القارئ على التمييز بين استخدام تقني شكلي وممارسة تعليمية لها هدف ودليل ومسؤولية. إنه يدعو إلى قراءة هادئة، وتطبيق متدرج، ومراجعة صريحة للنتائج؛ لأن التجديد الحقيقي لا يُقاس بحداثة الأداة وحدها، بل بقدرتها على تحسين الفهم، وتوسيع المشاركة، وحماية الإنسان داخل التجربة التعليمية.`,
  ].join('\n\n')
}

export default function BookDetail() {
  const { slug } = useParams()
  const { books, articles, papers, loading } = useCmsContent()
  const book = books.find((b) => b.slug === slug)
  const guide = book ? bookGuide(book.slug, book.desc) : null
  const longDescription = book && guide ? (book.longDescription || editorialDescription(book.title, guide)) : ''
  const toc = book ? verifiedToc(book.slug, book.toc) : []
  const tocGroups = useMemo(() => groupToc(toc), [toc])
  useSeo({ title: book?.title ?? 'كتاب', description: book?.desc, path: `/publications/${slug}`, image: book?.cover })
  if (!book && loading) return <Page className="content-books"><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!book) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على الكتاب.</div></Page>

  return (
    <Page className="content-book-detail">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [{
          '@type': 'Book',
          '@id': `${SITE_URL}/publications/${book.slug}#book`,
          name: book.title,
          description: longDescription,
          isbn: book.isbn || undefined,
          url: `${SITE_URL}/publications/${book.slug}`,
          image: book.cover ? `${SITE_URL}${book.cover}` : undefined,
          inLanguage: 'ar',
          datePublished: book.year || undefined,
          bookEdition: book.edition || undefined,
          numberOfPages: book.pageCount ? Number(book.pageCount) || book.pageCount : undefined,
          publisher: book.publisher ? { '@type': 'Organization', name: book.publisher } : undefined,
          audience: { '@type': 'Audience', audienceType: book.targetAudience || guide?.audience },
          author: [
            { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'د. أحمد حسين الفيلكاوي' },
            ...(book.coAuthors ? book.coAuthors.split(/[،,]/).map((name) => ({ '@type': 'Person', name: name.trim() })).filter((item) => item.name) : []),
          ],
        }, {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'المؤلفات', item: `${SITE_URL}/publications` },
            { '@type': 'ListItem', position: 3, name: book.title, item: `${SITE_URL}/publications/${book.slug}` },
          ],
        }],
      }} />
      <section className="px-6 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-28 md:px-11 md:pb-24 md:pt-44">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Link to="/publications" className="text-[.85rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link>
          </FadeUp>

          <div className="book-detail-layout mt-8 grid items-start gap-8 md:mt-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
            <FadeUp>
              {/* الغلاف لا يفتح المتن ولا PDF الكامل. استخدام المتن يحدث في
                  خريطة المعرفة أدناه، أما القراءة العامة فتبقى للعينة المعتمدة. */}
              <div className="book-detail-cover mx-auto w-full max-w-[20rem] overflow-hidden rounded-2xl border border-hair bg-white md:max-w-sm">
                {book.cover ? (
                  <img src={book.cover} alt={`غلاف كتاب ${book.title}`} width="1024" height="720" fetchPriority="high" decoding="async" sizes="(max-width: 768px) 320px, 420px" className="w-full" />
                ) : (
                  <div className="flex min-h-72 items-center justify-center bg-wash px-10 text-center font-display text-2xl font-semibold text-soft">{book.title}</div>
                )}
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <div className="book-detail-copy"><span className="text-[.76rem] font-semibold text-accent">كتاب منشور</span>
              <h1 className="mt-4 font-display text-[clamp(2rem,4.6vw,3.2rem)] font-bold leading-[1.25] text-ink">
                <Reveal>{book.title}</Reveal>
              </h1>
            <OwnerEdit tab="books" slug={book.slug} className="mt-3" />
              {(book as { coAuthors?: string }).coAuthors?.trim() && (
                <p className="mt-4 text-[.92rem] text-soft">بالاشتراك مع {(book as { coAuthors?: string }).coAuthors}</p>
              )}
              {book.desc && <p className="mt-5 text-[1.08rem] font-light leading-[1.9] text-ink/80">{book.desc}</p>}

              <dl className="book-detail-meta-grid mt-7 grid grid-cols-2 gap-2.5 border-t border-hair pt-5 md:mt-8 md:gap-3 md:pt-6">
                {[
                  ['سنة النشر', book.year],
                  ['الطبعة', book.edition],
                  ['الناشر', book.publisher],
                  ['عدد الصفحات', book.pageCount],
                  ['ISBN / ردمك', book.isbn],
                ].map(([label, value]) => (
                  <div key={label} className={`min-w-0 rounded-2xl border border-hair bg-wash px-3.5 py-3 md:px-4 ${label === 'ISBN / ردمك' ? 'col-span-2' : ''}`}>
                    <dt className="text-[.66rem] leading-relaxed text-soft">{label}</dt>
                    <dd dir={label === 'ISBN / ردمك' ? 'ltr' : undefined} className={`mt-1 break-words text-[.82rem] font-medium leading-relaxed ${label === 'ISBN / ردمك' ? 'text-left tabular-nums' : ''} ${value ? 'text-ink' : 'text-soft/[.65]'}`}>{value || 'غير موثّق بعد'}</dd>
                  </div>
                ))}
              </dl>

              <div className="book-detail-guides mt-6 grid gap-2 md:mt-9">
                {[
                  ['لماذا كُتب الكتاب؟', book.whyWritten || guide?.idea || book.desc],
                  ['الفئة المستهدفة', book.targetAudience || guide?.audience || 'للمهتمين بموضوع الكتاب.'],
                  ['طريقة الدخول', guide?.entry || 'ابدأ بالفكرة العامة، ثم انتقل إلى الفهرس لتختار الفصل الأقرب لسؤالك.'],
                ].map(([title, text]) => (
                  <details key={title} className="group rounded-2xl border border-hair bg-wash">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5">
                      <span className="text-[.8rem] font-semibold leading-relaxed text-accent">{title}</span>
                      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="border-t border-hair px-4 py-4 text-[.86rem] leading-[1.9] text-soft">{text}</p>
                  </details>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to={`/publications/${book.slug}#ask-book-section`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.78rem] font-semibold text-white transition-colors hover:bg-accent-deep"
                >
                  <SocialIcon name="Question" size={16} />
                  <span>اسأل هذا الكتاب</span>
                </Link>
                {book.pdf && (
                  <a
                    href={book.pdf}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-3 rounded-full border border-hair px-5 text-[.78rem] font-semibold text-ink transition-colors duration-300 hover:border-accent hover:text-accent"
                  >
                    <span>عرض عيّنة الكتاب</span>
                    <span className="text-[.72rem] text-soft">PDF</span>
                  </a>
                )}
              </div>
              </div>
            </FadeUp>
          </div>

          <FadeUp delay={0.14}>
            <details className="group mx-auto mt-14 max-w-[880px] overflow-hidden rounded-2xl border border-hair bg-canvas">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-5 md:px-7">
                <span>
                  <span id="book-description-title" className="block font-display text-2xl font-semibold text-ink">عن الكتاب</span>
                  <span className="mt-1 block text-[.78rem] leading-relaxed text-soft">فكرة الكتاب وسياقه وطريقة قراءته.</span>
                </span>
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="whitespace-pre-line border-t border-hair bg-wash/[.45] px-5 py-6 text-[1rem] font-light leading-[2.05] text-ink/[.85] md:px-7 md:py-8">{longDescription}</div>
            </details>
          </FadeUp>

          <FadeUp delay={0.18}>
            <section className="book-toc mx-auto mt-12 max-w-[880px] overflow-hidden rounded-2xl border border-hair bg-canvas" aria-labelledby="book-toc-title">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-5 py-5 md:px-7">
                <div>
                  <h2 id="book-toc-title" className="font-display text-2xl font-semibold text-ink">فهرس المحتويات</h2>
                  <p className="mt-1 text-[.72rem] leading-relaxed text-soft">أبوابٌ تُفتح عند الحاجة؛ لا جدار من البطاقات المتشابهة.</p>
                </div>
                {toc.length > 0 && <span className="text-[.68rem] text-soft">{toc.length} عنواناً</span>}
              </div>
              {toc.length ? (
                <div className="divide-y divide-hair">
                  {tocGroups.map((group, groupIndex) => (
                    <details key={`${group.title}-${groupIndex}`} className="group/toc" defaultOpen={groupIndex === 0}>
                      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-5 py-4 md:px-7">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair font-display text-[.68rem] text-accent">{String(groupIndex + 1).padStart(2, '0')}</span>
                        <strong className="min-w-0 flex-1 break-words text-[.9rem] leading-relaxed text-ink">{group.title}</strong>
                        <span className="shrink-0 text-[.66rem] text-soft">{group.entries.length} فصول</span>
                        <span aria-hidden className="text-accent transition-transform group-open/toc:rotate-45">＋</span>
                      </summary>
                      <ol className="border-t border-hair bg-wash/[.38] px-5 py-2 md:px-7">
                        {group.entries.map((entry) => (
                          <li key={`${entry.index}-${entry.label}`} className="grid min-w-0 grid-cols-[2.2rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-hair py-3.5 last:border-b-0">
                            <span className="font-display text-[.68rem] tabular-nums text-accent">{String(entry.index).padStart(2, '0')}</span>
                            <Link to={`?book_idea=${encodeURIComponent(entry.label)}#book-knowledge`} className="min-w-0 break-words text-[.82rem] leading-[1.8] text-ink transition-colors hover:text-accent">{entry.label}</Link>
                            {entry.page && <span className="shrink-0 text-[.68rem] tabular-nums text-soft">ص {entry.page}</span>}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>
              ) : <p className="px-5 py-6 text-[.82rem] leading-relaxed text-soft md:px-7">لم يُنشر الفهرس قبل مطابقته بالنسخة المطبوعة. يمكن اعتماده من لوحة التحكم، ولن يعرض الموقع عناوين مُخمنة.</p>}
            </section>
          </FadeUp>
        </div>
      </section>

      <DeferredBookWorld book={book} seed={guide?.idea || book.desc || ''} articles={articles} books={books} papers={papers} />
    </Page>
  )
}
