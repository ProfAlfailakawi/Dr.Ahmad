import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { useSeo } from '../components/seo'
import { CiteButton, OwnerEdit } from '../components/extras'
import { profile, SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'

const cleanText = (value = '') => value.replace(/^ملخص عربي:\s*/, '').replace(/\s+/g, ' ').trim()

const firstSentence = (value = '', fallback = '') => {
  const text = cleanText(value) || fallback
  if (!text) return ''
  return text.split(/(?<=[.!؟…])\s+/)[0] || text
}

const paperYear = (paper: { journal?: string; iso?: string; date?: string }) =>
  (paper.journal?.match(/20\d{2}/) || paper.iso?.match(/20\d{2}/) || paper.date?.match(/20\d{2}/) || ['2026'])[0]

const methodologyAndSample = (text = '') => {
  const clean = cleanText(text)
  const method = (
    clean.match(/(اعتمد(?:ت الدراسة)?[^.؟]*?(?:المنهج[^.؟]*|الاستبانة[^.؟]*|الوصفي[^.؟]*|التحليلي[^.؟]*|المسحي[^.؟]*))[.؟]?/) ||
    clean.match(/(استخدم(?:ت الدراسة)?[^.؟]*?(?:المنهج[^.؟]*|الاستبانة[^.؟]*|العينة[^.؟]*))[.؟]?/) ||
    clean.match(/(طبّق[^.؟]*?(?:استبانة|أداة الدراسة|العينة)[^.؟]*)[.؟]?/)
  )?.[1]?.trim()

  const sampleNumbers = Array.from(new Set(Array.from(clean.matchAll(/\b(\d{2,4})\b/g)).map((match) => match[1])))
    .filter((item) => Number(item) >= 30)
    .slice(0, 4)

  const sampleLabel = sampleNumbers.length
    ? `العينة المذكورة في الملخص تضم ${sampleNumbers.join('، ')} مشاركاً/مشاركاً أو رقماً مرتبطاً بالعينة.`
    : 'لم يذكر الملخص المختصر حجم العينة بوضوح؛ راجع نص PDF أو صفحة الناشر للتفاصيل الدقيقة.'

  return {
    method: method || 'يستخدم البحث مقاربة وصفية/تحليلية لفهم القضية في سياقها التعليمي، مع أداة جمع بيانات يشرحها النص الأصلي أو ملف PDF.',
    sample: sampleLabel,
  }
}

const mainFinding = (text = '') => {
  const clean = cleanText(text)
  return (
    clean.match(/((?:أظهرت|أظهرت النتائج|بينت النتائج|بيّنت النتائج|كشفت النتائج|خلصت الدراسة)[^.؟]*[.؟]?)/)?.[1]?.trim() ||
    clean.match(/((?:وجود|عدم وجود|جاءت|تبين أن|وتقدم النتائج)[^.؟]*[.؟]?)/)?.[1]?.trim() ||
    firstSentence(clean)
  )
}

const teacherMeaning = (meta = '', title = '') => {
  const text = `${meta} ${title}`
  if (/تعلم إلكتروني|LMS|E-Learning|التحول الرقمي|تكنولوجيا|Technology|واقع معزز|ذكاء/i.test(text)) {
    return 'المغزى للمعلم واضح: التقنية ليست قيمة بحد ذاتها؛ القيمة في الجاهزية، والتصميم التربوي، والتدريب الذي يجعل الأداة تخدم التعلم فعلاً.'
  }
  if (/اتجاهات|Awareness|وعي|Faculty|Members/i.test(text)) {
    return 'قبل أن نعمم أي أداة أو مبادرة، علينا أن نفهم درجة القبول والوعي عند المعلمين؛ لأن القناعة المهنية جزء من نجاح التطبيق، لا تفصيل ثانوي.'
  }
  if (/Special Needs|الاحتياجات الخاصة/i.test(text)) {
    return 'تقول النتيجة للمعلم إن الإتاحة ليست إضافة تجميلية؛ بل شرطٌ لعدالة التعلم. أي تطوير تقني يجب أن يبدأ من سؤال: هل يصل لجميع المتعلمين؟'
  }
  return 'بالنسبة للمعلم، فالقيمة العملية هنا هي تحويل النتيجة إلى قرار صفّي أو مؤسسي: ما الذي ينبغي تطويره في الممارسة، وما الذي يحتاج دعماً أو تدريباً إضافياً؟'
}

const unresolvedQuestion = (meta = '', title = '') => {
  const text = `${meta} ${title}`
  if (/اتجاهات|وعي|Awareness/i.test(text)) {
    return 'السؤال الذي يبقى مفتوحاً: كيف تتحول الاتجاهات أو درجة الوعي من موقف معلَن إلى ممارسة فعلية يمكن ملاحظتها داخل القاعات الدراسية؟'
  }
  if (/فاعلية|أهمية|Effectiveness|Importance/i.test(text)) {
    return 'السؤال غير المحسوم هنا: هل يستمر هذا الأثر على المدى البعيد، وهل يظهر بالدرجة نفسها في تخصصات ومؤسسات تعليمية مختلفة؟'
  }
  if (/معوقات|Obstacles/i.test(text)) {
    return 'ما السؤال الذي لم يجب عنه البحث بالكامل؟ ما التدخل العملي الأكثر جدوى لتجاوز هذه المعوقات، وكيف نقيس أثره بعد التنفيذ؟'
  }
  return 'السؤال الذي لم يحسمه الملخص وحده: ماذا يحدث لو انتقلنا من الرصد والوصف إلى تجربة تطبيقية تقيس الأثر الحقيقي على التعلم نفسه؟'
}

function CopySnippet({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-2xl border border-hair bg-white/80 p-4 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[.8rem] font-semibold text-soft">{label}</p>
        <button onClick={copy} className="rounded-full border border-hair px-3 py-1 text-[.75rem] text-soft transition-colors hover:border-accent hover:text-accent">
          {copied ? 'نُسخ ✓' : 'نسخ'}
        </button>
      </div>
      <p className="mt-3 text-[.86rem] leading-[1.95] text-ink/85 dark:text-soft">{value}</p>
    </div>
  )
}

export default function PaperDetail() {
  const { slug } = useParams()
  const { papers, loading } = useCmsContent()
  const i = papers.findIndex((paper) => paper.slug === slug)
  const p = papers[i]
  const [guideOpen, setGuideOpen] = useState(false)

  useSeo({ title: p?.title ?? 'بحث', description: p?.abstractAr || p?.meta, path: `/research/${slug}`, type: 'article' })

  const guide = useMemo(() => {
    if (!p) return null
    const year = paperYear(p)
    const journal = p.journal || 'بحث محكّم'
    const summary = firstSentence(p.abstractAr, p.meta || p.title)
    const parsed = methodologyAndSample(p.abstractAr || '')
    const finding = mainFinding(p.abstractAr || '')
    const researchers = [profile.fullName, p.coAuthors].filter(Boolean).join('، ')
    const sourceUrl = p.source || p.pdf || `${SITE_URL}/research/${p.slug}`
    const apa = `الفيلكاوي، أحمد حسين${p.coAuthors ? `، و${p.coAuthors}` : ''}. (${year}). ${p.title}. ${journal}. ${sourceUrl}`
    const chicago = `الفيلكاوي، أحمد حسين${p.coAuthors ? `، و${p.coAuthors}` : ''}. "${p.title}." ${journal}، ${year}. ${sourceUrl}`

    const problem = (() => {
      const title = p.title
      if (/اتجاهات|Trends/i.test(title)) return 'يحاول البحث فهم اتجاهات المشاركين نحو القضية المدروسة: هل هناك قبول؟ تحفظ؟ وما العوامل التي تفسر ذلك؟'
      if (/فاعلية|Effectiveness/i.test(title)) return 'المشكلة الأساسية هنا هي قياس مدى فاعلية الأداة أو الممارسة التعليمية: هل تضيف شيئاً ملموساً فعلاً أم لا؟'
      if (/أهمية|Importance/i.test(title)) return 'يسأل البحث عن الأهمية العملية لهذه الأداة أو الفكرة: لماذا ينبغي أن نهتم بها داخل البيئة التعليمية؟'
      if (/معوقات|Obstacles/i.test(title)) return 'يركز البحث على تشخيص العوائق التي تمنع التطبيق الجيد، سواء كانت تقنية أو بشرية أو تنظيمية.'
      if (/وعي|Awareness/i.test(title)) return 'يبحث هذا العمل في درجة الوعي والفهم بالمفهوم المدروس، لأن أي تطبيق ناجح يبدأ من وضوح المفهوم لا من تكرار المصطلح.'
      return `يحاول هذا البحث أن يفسر القضية المرتبطة بـ ${p.meta || 'موضوع الدراسة'}، وأن يقدّم قراءة علمية تساعد على الفهم واتخاذ القرار.`
    })()

    return {
      summary,
      problem,
      method: parsed.method,
      sample: parsed.sample,
      finding,
      teacherMeaning: teacherMeaning(p.meta || '', p.title),
      gapQuestion: unresolvedQuestion(p.meta || '', p.title),
      apa,
      chicago,
      researchers,
      journal,
      year,
    }
  }, [p])

  if (!p && loading)
    return (
      <Page className="content-research article-journey">
        <div className="px-6 pt-44 text-center text-soft">لحظة…</div>
      </Page>
    )

  if (!p)
    return (
      <Page>
        <div className="px-6 pt-44 text-center text-soft">لم يُعثر على البحث.</div>
      </Page>
    )

  const prev = papers[i - 1]
  const next = papers[i + 1]

  return (
    <Page>
      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[760px]">
          <FadeUp>
            <Link to="/research" className="text-[.85rem] text-soft transition-colors hover:text-accent">
              ← كل المساهمات العلمية
            </Link>
          </FadeUp>

          <FadeUp delay={0.05}>
            <span className="mt-8 block text-[.76rem] font-semibold uppercase text-accent">بحث محكّم</span>
            <h1 dir="auto" className="mt-4 font-display text-[clamp(1.7rem,4vw,2.7rem)] font-bold leading-[1.45] text-ink">
              <Reveal>{p.title}</Reveal>
            </h1>
            <OwnerEdit tab="papers" slug={p.slug} className="mt-3" />
            <div className="mt-7 h-[2px] w-16 bg-accent" />
          </FadeUp>

          <FadeUp delay={0.1}>
            <dl className="mt-10 divide-y divide-hair border-y border-hair">
              {p.meta && (
                <div className="flex flex-wrap gap-4 py-5">
                  <dt className="w-32 shrink-0 text-[.85rem] text-soft">الموضوع</dt>
                  <dd className="text-[.98rem] text-ink">{p.meta}</dd>
                </div>
              )}
              <div className="flex flex-wrap gap-4 py-5">
                <dt className="w-32 shrink-0 text-[.85rem] text-soft">الباحث</dt>
                <dd className="text-[.98rem] text-ink">
                  {profile.fullName}
                  {(p as { coAuthors?: string }).coAuthors?.trim() && (
                    <span className="text-soft"> — بالاشتراك مع {(p as { coAuthors?: string }).coAuthors}</span>
                  )}
                </dd>
              </div>
              {p.journal && (
                <div className="flex flex-wrap gap-4 py-5">
                  <dt className="w-32 shrink-0 text-[.85rem] text-soft">النشر</dt>
                  <dd className="text-[.98rem] text-accent">{p.journal}</dd>
                </div>
              )}
            </dl>
          </FadeUp>

          {p.abstractAr && (
            <FadeUp delay={0.12}>
              <section className="mt-8 rounded-2xl border border-hair bg-wash px-6 py-5">
                <p className="text-[.76rem] font-semibold text-accent">الملخص</p>
                <p className="mt-3 text-[.95rem] font-light leading-[1.95] text-ink/80 dark:text-soft">{cleanText(p.abstractAr)}</p>
              </section>
            </FadeUp>
          )}

          <FadeUp delay={0.14}>
            <div className="mt-10 flex flex-wrap gap-3">
              {p.source && (
                <a href={p.source} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full bg-accent px-7 py-3.5 font-semibold text-canvas transition-colors duration-300 hover:bg-accent-deep">
                  صفحة البحث لدى الناشر ←
                </a>
              )}
              {p.pdf && (
                <a href={p.pdf} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-full border-[1.5px] border-accent px-7 py-3.5 font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas">
                  تحميل نسخة PDF
                </a>
              )}
              {!p.source && !p.pdf && (
                <Link to="/contact" className="inline-flex items-center rounded-full border-[1.5px] border-accent px-7 py-3.5 font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas">
                  اطلب نسخة
                </Link>
              )}
              {guide && (
                <button
                  onClick={() => setGuideOpen((current) => !current)}
                  className="inline-flex items-center rounded-full border border-hair px-6 py-3.5 font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                  aria-expanded={guideOpen}
                >
                  {guideOpen ? 'إخفاء رفيق الباحث' : 'افهم هذا البحث'}
                </button>
              )}
            </div>
            {(p as { verification?: string }).verification === 'needs-manual-review' && (
              <p className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50/70 px-4 py-3 text-[.82rem] leading-[1.8] text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
                بيانات هذا البحث مأخوذة من قائمة الإنتاج العلمي، ويحتاج رابط الناشر والملخص الأصلي إلى مراجعة يدوية نهائية.
              </p>
            )}
            {(() => {
              const links = p as { scholar?: string; researchgate?: string }
              const scholar = links.scholar
              const researchgate = links.researchgate
              if (!scholar && !researchgate) return null
              const btn = 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent'
              return (
                <div className="mt-7 flex items-center gap-3">
                  <span className="text-[.82rem] text-soft">فهرسة البحث نفسه</span>
                  {scholar && (
                    <a href={scholar} target="_blank" rel="noreferrer" aria-label="البحث نفسه في Google Scholar" title="Google Scholar" className={btn}>
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d="M5.242 13.769 0 9.5 12 0l12 9.5-5.242 4.269C17.548 11.249 14.978 9.5 12 9.5s-5.548 1.749-6.758 4.269zM12 10a7 7 0 1 0 0 14 7 7 0 0 0 0-14z" /></svg>
                    </a>
                  )}
                  {researchgate && (
                    <a href={researchgate} target="_blank" rel="noreferrer" aria-label="صفحة البحث نفسه في ResearchGate" title="ResearchGate" className={btn}>
                      <span className="text-[.72rem] font-bold leading-none tracking-tight">R<span className="text-accent">G</span></span>
                    </a>
                  )}
                </div>
              )
            })()}
            <CiteButton title={p.title} year={(p.journal?.match(/20[0-2][0-9]/) || ['2022'])[0]} container={p.journal || 'بحث محكّم'} url={`${SITE_URL}/research/${p.slug}`} />
          </FadeUp>

          {guide && guideOpen && (
            <FadeUp delay={0.16}>
              <section className="mt-10 rounded-[30px] border border-hair bg-wash/90 p-6 md:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[.76rem] font-semibold text-accent">رفيق الباحث</p>
                    <h2 className="mt-2 font-display text-[1.45rem] font-semibold text-ink">طبقة سريعة لفهم البحث واستخدامه</h2>
                    <p className="mt-2 max-w-[620px] text-[.88rem] leading-[1.9] text-soft">بدلاً من الاكتفاء بالملخص وملف PDF، تُعرض لك هنا خلاصة عملية قابلة للفهم السريع والتوظيف الأكاديمي المباشر.</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 px-4 py-3 text-[.8rem] leading-[1.8] text-soft dark:bg-white/[0.02]">
                    <span className="block text-ink">{guide.journal}</span>
                    <span>الباحثون: {guide.researchers}</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">البحث في جملة واحدة</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.summary}</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">المشكلة التي حاول حلها</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.problem}</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">المنهج والعينة</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.method}</p>
                    <p className="mt-3 text-[.86rem] leading-[1.85] text-soft">{guide.sample}</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">أهم نتيجة</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.finding}</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">ماذا تعني النتيجة للمعلم؟</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.teacherMeaning}</p>
                  </div>
                  <div className="rounded-2xl border border-hair bg-white/80 p-5 dark:bg-white/[0.02]">
                    <p className="text-[.75rem] font-semibold text-accent">ما السؤال الذي لم يجب عنه البحث؟</p>
                    <p className="mt-3 text-[.92rem] leading-[1.95] text-ink/85 dark:text-soft">{guide.gapQuestion}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <CopySnippet label="APA" value={guide.apa} />
                  <CopySnippet label="Chicago" value={guide.chicago} />
                </div>

                <div className="mt-6 flex flex-wrap gap-3 text-[.82rem] text-soft">
                  <span className="rounded-full border border-hair px-4 py-2">الناشر/المجلة: {guide.journal}</span>
                  <span className="rounded-full border border-hair px-4 py-2">سنة النشر: {guide.year}</span>
                  <span className="rounded-full border border-hair px-4 py-2">الباحثون: {guide.researchers}</span>
                  {p.pdf && <a href={p.pdf} target="_blank" rel="noreferrer" className="rounded-full border border-hair px-4 py-2 transition-colors hover:border-accent hover:text-accent">رابط PDF</a>}
                  {p.source && <a href={p.source} target="_blank" rel="noreferrer" className="rounded-full border border-hair px-4 py-2 transition-colors hover:border-accent hover:text-accent">رابط الناشر</a>}
                </div>
              </section>
            </FadeUp>
          )}

          <FadeUp>
            <nav className="mt-16 grid gap-6 border-t border-hair pt-8 sm:grid-cols-2">
              {prev ? (
                <Link to={`/research/${prev.slug}`} className="group">
                  <span className="text-[.78rem] text-soft">السابق</span>
                  <span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{prev.title}</span>
                </Link>
              ) : <span />}
              {next && (
                <Link to={`/research/${next.slug}`} className="group sm:text-left">
                  <span className="text-[.78rem] text-soft">التالي</span>
                  <span className="mt-1 block font-display text-[1.02rem] font-medium leading-[1.55] text-ink transition-colors group-hover:text-accent">{next.title}</span>
                </Link>
              )}
            </nav>
          </FadeUp>
        </div>
      </article>
    </Page>
  )
}
