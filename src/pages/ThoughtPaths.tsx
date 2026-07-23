import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent, useExtras } from '../lib/content'
import { normalizeArabic } from '../lib/cms'
import { staticQuestions } from './Questions'
import { dynamicArticleCategories } from '../lib/content-taxonomy'

type ThoughtPath = {
  id: string
  title: string
  intro: string
  anchors: string[]
  signals: string[]
}

const paths: ThoughtPath[] = [
  {
    id: 'human-in-machine',
    title: 'الإنسان في قلب الآلة',
    intro: 'كيف تصبح التقنية أكثر تقدماً من دون أن يصبح الإنسان هامشاً في تجربتها؟',
    anchors: ['الآلة', 'الذكاء الاصطناعي', 'الخوارزمية'],
    signals: ['الإنسان', 'العقل', 'معنى', 'وعي', 'تعليم', 'تقنية', 'فهم'],
  },
  {
    id: 'future-teacher',
    title: 'مستقبل المعلم',
    intro: 'من ناقل للمعلومة إلى صانع للمعنى: ما الذي يبقى للمعلم حين تجيب الآلة؟',
    anchors: ['المعلم', 'المعلمين', 'هيئة التدريس', 'التدريس'],
    signals: ['مستقبل', 'ذكاء اصطناعي', 'رقمي', 'تعليم', 'مدرسة', 'تطوير'],
  },
  {
    id: 'child-and-technology',
    title: 'الطفل والتكنولوجيا',
    intro: 'رحلة بين فضول الطفل والشاشة: متى تكون التقنية أداة نمو، ومتى تقوده بدلاً من أن يقودها؟',
    anchors: ['الطفل', 'الأطفال', 'أبنائنا', 'الطفولة'],
    signals: ['تكنولوجيا', 'هاتف', 'هواتف', 'ألعاب', 'رقمي', 'تربية'],
  },
  {
    id: 'ai-and-ethics',
    title: 'الذكاء الاصطناعي والأخلاق',
    intro: 'ليست المسألة ماذا تستطيع الخوارزمية أن تفعل فقط، بل ماذا ينبغي لها أن تفعل.',
    anchors: ['الذكاء الاصطناعي', 'الخوارزمية', 'حوكمة', 'أخلاق'],
    signals: ['إنسان', 'غش', 'صدق', 'وعي', 'بيانات', 'مسؤولية'],
  },
  {
    id: 'exam-and-fear',
    title: 'الامتحان والخوف',
    intro: 'كيف تحوّل القياس من مرآة للتعلّم إلى مصدر ضغط، وماذا خسر الفهم في الطريق؟',
    anchors: ['امتحان', 'اختبار', 'الدرجة', 'الدرجات', 'قياس'],
    signals: ['خوف', 'خطأ', 'شهادة', 'نجاح', 'فهم', 'حفظ', 'طالب'],
  },
  {
    id: 'identity-digital-age',
    title: 'الهوية في العصر الرقمي',
    intro: 'حين تتسع المنصات ويضيق الانتباه: كيف نحفظ الجذور من دون أن نخاف المستقبل؟',
    anchors: ['هوية', 'العصر الرقمي', 'سوشيال ميديا', 'التواصل الاجتماعي'],
    signals: ['جذور', 'مجتمع', 'رقمي', 'ثقافة', 'منصات', 'جيل', 'مستقبل'],
  },
]

const normalized = (value: string) => normalizeArabic(value || '')

function matchScore(text: string, path: ThoughtPath) {
  const haystack = normalized(text)
  const anchorHits = path.anchors.reduce((sum, term) => sum + (haystack.includes(normalized(term)) ? 1 : 0), 0)
  if (!anchorHits) return 0
  const signalHits = path.signals.reduce((sum, term) => sum + (haystack.includes(normalized(term)) ? 1 : 0), 0)
  const titleHit = haystack.includes(normalized(path.title)) ? 5 : 0
  return anchorHits * 5 + signalHits * 2 + titleHit
}

function bestMatch<T>(items: T[], text: (item: T) => string, path: ThoughtPath, minimum = 5) {
  return items
    .map((item) => ({ item, score: matchScore(text(item), path) }))
    .filter(({ score }) => score >= minimum)
    .sort((left, right) => right.score - left.score)[0]?.item
}

type PathNode = {
  key: string
  label: string
  title: string
  description?: string
  to?: string
  href?: string
  /* تسمية العلاقة (مقترح معتمد): كيف ترتبط هذه المادة بجارتها في المسار */
  relation?: string
}

type ThoughtQuestion = {
  ar: string
  take: string
}

const shorten = (value = '', limit = 155) => value.length > limit ? `${value.slice(0, limit).trim()}…` : value

export default function ThoughtPaths() {
  const { articles, books, papers, media, loading } = useCmsContent()
  const extraQuestions = useExtras<ThoughtQuestion>('site_questions')
  const availablePaths = useMemo(() => {
    const covered = new Set(['التعليم', 'التربية', 'مجتمع', 'تقنية', 'هوية', 'إعلام', 'بحث'])
    const automatic = dynamicArticleCategories(articles, false)
      .filter((category) => !covered.has(category))
      .map((category) => ({
        id: `category-${encodeURIComponent(category)}`,
        title: category,
        intro: `مسار يتكوّن تلقائياً من كل مادة جديدة تُنشر تحت تصنيف «${category}».`,
        anchors: [category],
        signals: [category],
      }))
    return [...paths, ...automatic]
  }, [articles])
  const [activeId, setActiveId] = useState(() => {
    if (typeof window === 'undefined') return paths[0].id
    const hash = window.location.hash.replace(/^#/, '')
    return paths.some((path) => path.id === hash) ? hash : paths[0].id
  })
  const active = availablePaths.find((path) => path.id === activeId) || availablePaths[0] || paths[0]

  /* «أكمل من حيث توقفت» (مقترح معتمد): آخر مسار زاره القارئ يُحفظ محلياً */
  const LAST_PATH_KEY = 'thought-paths:last:v1'
  const [resumeId, setResumeId] = useState<string | null>(null)
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_PATH_KEY)
      if (last && last !== activeId) setResumeId(last)
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try { localStorage.setItem(LAST_PATH_KEY, activeId) } catch { /* noop */ }
  }, [activeId])
  const resumePath = resumeId && resumeId !== activeId ? availablePaths.find((path) => path.id === resumeId) : undefined

  useSeo({
    title: 'مسار الفكرة',
    path: '/thought-paths',
    description: 'رحلات فكرية تربط المقال بالسؤال والبحث والكتاب واللقاء لتكشف كيف تطورت الفكرة عبر الأرشيف.',
  })

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.replace(/^#/, '')
      if (availablePaths.some((path) => path.id === hash)) setActiveId(hash)
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [availablePaths])

  const journey = useMemo(() => {
    const rankedArticles = articles
      .map((article) => ({ article, score: matchScore(`${article.title} ${article.excerpt} ${article.body || ''} ${article.cat}`, active) }))
      .filter(({ score }) => score >= 5)
      .sort((left, right) => right.score - left.score || right.article.iso.localeCompare(left.article.iso))

    const strongest = rankedArticles[0]?.score || 0
    const clearArticles = rankedArticles
      .filter(({ score }) => score >= Math.max(5, Math.ceil(strongest * 0.55)))
      .map(({ article }) => article)
    const earliest = [...clearArticles].sort((a, b) => a.iso.localeCompare(b.iso))[0]
    const latest = [...clearArticles].sort((a, b) => b.iso.localeCompare(a.iso))[0]
    const question = bestMatch<ThoughtQuestion>([...staticQuestions, ...extraQuestions], (item) => `${item.ar} ${item.take}`, active)
    /* عتبة ثقة أعلى للوصلات الجانبية (مقترح معتمد): مرساة + إشارة على الأقل،
       وإلا أُخفي العنصر بصمت — لا وصلة تقديرية ولا اعتذار عنها */
    const paper = bestMatch(papers, (item) => `${item.title} ${item.meta} ${item.journal || ''}`, active, 7)
    const book = bestMatch(books, (item) => `${item.title} ${item.desc}`, active, 7)
    const mediaItem = bestMatch(media, (item) => `${item.title} ${item.outlet} ${item.platform || ''}`, active, 7)

    const nodes: PathNode[] = []
    if (earliest) nodes.push({
      key: `start-${earliest.slug}`,
      label: `بداية الخيط · ${earliest.year}`,
      title: earliest.title,
      description: shorten(earliest.excerpt),
      to: `/articles/${earliest.slug}`,
    })
    if (question) nodes.push({
      key: `question-${question.ar}`,
      label: 'سؤال يفتح المسار',
      title: question.ar,
      description: shorten(question.take),
    })
    if (paper) nodes.push({
      key: `paper-${paper.slug}`,
      label: 'الدليل الأكاديمي',
      relation: 'خلفية علمية',
      title: paper.title,
      description: paper.journal || paper.meta,
      to: `/research/${paper.slug}`,
    })
    if (book) nodes.push({
      key: `book-${book.slug}`,
      label: 'السياق الأوسع',
      relation: 'امتداد',
      title: book.title,
      description: shorten(book.desc),
      to: `/publications/${book.slug}`,
    })
    if (mediaItem) nodes.push({
      key: `media-${mediaItem.slug}`,
      label: 'حين خرجت الفكرة إلى الحوار العام',
      relation: 'تطبيق',
      title: mediaItem.title,
      description: mediaItem.outlet,
      href: mediaItem.url,
    })
    if (latest && latest.slug !== earliest?.slug) nodes.push({
      key: `latest-${latest.slug}`,
      label: `أحدث كتابة في المسار · ${latest.year}`,
      relation: 'تحوّل الفكرة',
      title: latest.title,
      description: shorten(latest.excerpt),
      to: `/articles/${latest.slug}`,
    })

    /* زمن المسار التقريبي (مقترح معتمد): متنا المقالين على سرعة قراءة عربية
       مريحة (٢٠٠ كلمة/د) + دقيقة لكل محطة جانبية */
    const wordCount = (value = '') => value.split(/\s+/).filter(Boolean).length
    const articleWords = wordCount(earliest?.body || earliest?.excerpt) + (latest && latest.slug !== earliest?.slug ? wordCount(latest.body || latest.excerpt) : 0)
    const sideStops = nodes.length - (earliest ? 1 : 0) - (latest && latest.slug !== earliest?.slug ? 1 : 0)
    const minutes = Math.max(1, Math.round(articleWords / 200) + sideStops)

    return { nodes, minutes }
  }, [active, articles, books, extraQuestions, media, papers])

  const selectPath = (id: string) => {
    setActiveId(id)
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`)
  }

  return (
    <Page className="content-thought-paths page-journey">
      <PageHead
        label="قراءة عابرة للأنواع"
        title="مسار الفكرة."
        sub="لا تبدأ من نوع المحتوى، بل من سؤال. اختر فكرة لترى كيف انتقلت بين المقال والبحث والكتاب والحوار العام."
      />

      <section className="border-b border-hair px-6 py-10 md:px-11 md:py-12">
        <div className="mx-auto max-w-shell">
          {resumePath && (
            <button
              type="button"
              onClick={() => { selectPath(resumePath.id); setResumeId(null) }}
              className="mb-5 rounded-full border border-hair bg-wash px-4 py-2 text-[.78rem] text-soft transition-colors hover:border-accent hover:text-accent"
            >
              أكمل من حيث توقفت: {resumePath.title} ←
            </button>
          )}
          <div role="tablist" aria-label="اختر مساراً فكرياً" className="flex gap-6 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availablePaths.map((path) => (
              <button
                key={path.id}
                id={`tab-${path.id}`}
                type="button"
                role="tab"
                aria-selected={active.id === path.id}
                aria-controls="thought-path-panel"
                onClick={() => selectPath(path.id)}
                className={`shrink-0 border-b py-2 text-[.84rem] transition-colors ${
                  active.id === path.id ? 'border-ink font-semibold text-ink' : 'border-transparent text-soft hover:text-ink'
                }`}
              >
                {path.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 md:px-11 md:py-24">
        <div
          id="thought-path-panel"
          role="tabpanel"
          aria-labelledby={`tab-${active.id}`}
          className="mx-auto max-w-3xl"
        >
          <FadeUp key={`${active.id}-head`}>
            <span className="text-[.78rem] font-medium text-soft">كيف بدأت الفكرة عندي… وكيف تطورت؟</span>
            <h2 className="mt-3 font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.35] text-ink">{active.title}</h2>
            <p className="mt-4 max-w-2xl text-[1rem] font-light leading-[1.95] text-soft">{active.intro}</p>
            {journey.nodes.length > 0 && (
              <p className="mt-4 text-[.76rem] font-medium text-soft">
                {journey.nodes.length} محطات · قراءة المسار كاملاً نحو {journey.minutes === 1 ? 'دقيقة' : journey.minutes === 2 ? 'دقيقتين' : journey.minutes <= 10 ? `${journey.minutes} دقائق` : `${journey.minutes} دقيقة`}
              </p>
            )}
          </FadeUp>

          {loading && journey.nodes.length === 0 ? (
            <p className="mt-14 text-soft">يُجمع المسار من الأرشيف…</p>
          ) : journey.nodes.length === 0 ? (
            <div className="mt-14 rounded-2xl border border-hair bg-wash p-7 text-center">
              <p className="font-display text-[1.2rem] font-semibold text-ink">لا توجد مواد متطابقة بوضوح بعد.</p>
              <p className="mt-2 text-[.84rem] font-light leading-[1.8] text-soft">سيظهر المسار تلقائياً حين تُضاف مادة تحمل خيطه الموضوعي.</p>
            </div>
          ) : (
            <FadeUp key={`${active.id}-journey`}>
            <ol className="mt-14 border-r border-hair pe-7 md:pe-10">
              {journey.nodes.map((node, index) => {
                const content = (
                  <>
                    <span className="text-[.73rem] font-medium text-soft">
                      {String(index + 1).padStart(2, '0')} · {node.label}
                      {node.relation && <span className="ms-2 rounded-full border border-hair px-2 py-0.5 text-[.66rem]">{node.relation}</span>}
                    </span>
                    <h3 className="mt-2 font-display text-[1.2rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent">{node.title}</h3>
                    {node.description && <p className="mt-2 text-[.86rem] font-light leading-[1.85] text-soft">{node.description}</p>}
                    {(node.to || node.href) && <span className="mt-3 inline-block text-[.76rem] font-medium text-soft transition-colors group-hover:text-accent">المادة ←</span>}
                  </>
                )
                return (
                    <li key={`${active.id}-${node.key}`} className="relative pb-11 last:pb-0">
                      <span className="absolute -right-[5px] top-2 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent" />
                      {node.to ? (
                        <Link to={node.to} className="group block">{content}</Link>
                      ) : node.href ? (
                        <a href={node.href} target="_blank" rel="noreferrer" className="group block">{content}</a>
                      ) : (
                        <div className="group">{content}</div>
                      )}
                    </li>
                )
              })}
            </ol>
            </FadeUp>
          )}

        </div>
      </section>
    </Page>
  )
}
