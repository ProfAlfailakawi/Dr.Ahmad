import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { articleCats, books, papers } from '../../data'
import privateBookLinks from '../../data/private-book-links.json'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { useAdminAuth } from '../../lib/admin-auth'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import { ideaLab, relatedForIdea, styleFingerprint, strongestQuote, suggestStrongTitle } from '../../lib/intelligence'

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-6 py-2.5 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const ghost = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'

type StudioStatus = 'draft' | 'published' | 'scheduled'
type SocialKey = 'x' | 'linkedin' | 'instagram' | 'threads' | 'whatsapp' | 'newsletter'

type Bundle = {
  title: string
  slug: string
  cat: string
  excerpt: string
  body: string
  social: Record<SocialKey, string>
  related: { slug: string; title: string; iso?: string }[]
  books: { slug: string; title: string }[]
  papers: { slug: string; title: string }[]
  quality: string[]
}

type RadarItem = { id: string; ar?: string; arNote?: string; en?: string; source?: string; url?: string }
type PrivateBookLink = {
  title: string
  pages?: number
  topTerms?: string[]
  linkedPublicBook?: { slug: string; title: string; confidence?: number } | null
  relatedPublicArticles?: { slug: string; title: string; confidence?: number }[]
}
type WeeklyPack = {
  linkedin: string[]
  x: string[]
  generalX: string[]
  instagram: string
  question: string
  quote: string
  radarComment: string
}

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .trim()

const wordCount = (value = '') => value.trim().split(/\s+/).filter(Boolean).length

function today() {
  const date = new Date()
  return {
    iso: date.toISOString().slice(0, 10),
    ar: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(date),
  }
}

function makeSlug(title: string) {
  const dictionary: Record<string, string> = {
    الذكاء: 'ai',
    اصطناعي: 'ai',
    التعليم: 'education',
    المعلم: 'teacher',
    الطالب: 'student',
    الطفل: 'child',
    الأسرة: 'family',
    الاسرة: 'family',
    الخوف: 'fear',
    الامتحان: 'exam',
    الاختبار: 'exam',
    الهوية: 'identity',
    التقنية: 'technology',
    التكنولوجيا: 'technology',
    الإنسان: 'human',
    الانسان: 'human',
    المستقبل: 'future',
  }
  const tokens = normalize(title)
    .split(/\s+/)
    .map((token) => dictionary[token] || dictionary[token.replace(/^ال/, '')])
    .filter(Boolean)
  const base = tokens.length ? tokens.slice(0, 5).join('-') : 'thought-article'
  return `${base}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
}

function chooseCat(idea: string) {
  const text = normalize(idea)
  if (/ذكاء|تقني|تكنولوجيا|رقمي|شاشه|شاشة/.test(text)) return 'تقنية'
  if (/هويه|لغه|ثقافه|قيم/.test(text)) return 'هوية'
  if (/اعلام|منصه|سوشال|ميديا/.test(text)) return 'إعلام'
  if (/بحث|دراسه|جامعه|اكاديمي/.test(text)) return 'بحث'
  if (/اسره|طفل|ابناء|بيت/.test(text)) return 'مجتمع'
  if (/تعليم|معلم|طالب|امتحان|اختبار|مدرسه/.test(text)) return 'التعليم'
  return articleCats.includes('التربية') ? 'التربية' : 'التعليم'
}

function clampExcerpt(text: string) {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, 195).join('')
}

function buildArticleDraft(idea: string, audience: string, angle: string, related: ArticleRecord[]) {
  const seed = related[0]
  const second = related[1]
  const topic = idea.trim() || 'السؤال التربوي الجديد'
  const p1 = `ليست قيمة ${topic} في أنه موضوع جديد يملأ العناوين، بل في أنه يكشف طريقة نظرنا إلى الإنسان داخل التعليم. كل أداة أو فكرة تبدأ جذابة حين نراها من بعيد، لكنها تصبح أكثر تعقيدًا عندما تقترب من الطالب والمعلم والأسرة والقرار اليومي داخل الصف. هنا لا يكفي أن نسأل: ما الذي تغيّر؟ بل ينبغي أن نسأل: ماذا فعل هذا التغيّر في المعنى؟`
  const p2 = `بالنسبة إلى ${audience}، تبدو الزاوية الأهم في ${angle}. فالتعليم لا يتحرك بالأدوات وحدها، ولا يعيش بالشعارات وحدها. يعيش حين تتحول الفكرة إلى ممارسة عادلة، وإلى سؤال يحفظ كرامة المتعلم، وإلى قرار لا يختصر الإنسان في رقم أو سرعة أو نتيجة عابرة. ولذلك فإن أي نقاش جاد يجب أن يبدأ من أثر الفكرة لا من بريقها.`
  const p3 = seed
    ? `وقد كتبت من قبل في «${seed.title}» ما يقترب من هذا المعنى؛ فهناك خيط واضح بين السؤال القديم والسؤال الحالي: كيف نحافظ على حضور الإنسان بينما تتبدل اللغة والأدوات؟ وإذا كان المقال القديم قد فتح الباب، فإن اللحظة الحالية تطلب خطوة أهدأ وأكثر دقة: أن نميّز بين التطوير الذي يخدم التعلم، والتطوير الذي يجعل الإنسان تابعًا للإجراء.`
    : `هذه الفكرة تحتاج إلى أن تُقرأ من الداخل لا من الحافة. فكل تغيير تعليمي يحمل وعدًا وخطرًا في الوقت نفسه؛ الوعد أن يساعدنا على الفهم، والخطر أن يجعلنا ننسى لماذا نتعلم أصلًا.`
  const p4 = second
    ? `واللافت أن هذا الخيط يظهر أيضًا في «${second.title}». هذا لا يعني تكرار الفكرة، بل يعني أن المسألة عادت إلينا بوجه جديد. فالأفكار الحقيقية لا تنتهي بعد مقال واحد؛ إنها تتطور، وتراجع نفسها، وتطلب منا لغة أكثر إنصافًا كلما تغيّر الزمن.`
    : `المسألة إذن ليست رفضًا ولا اندفاعًا. هي دعوة إلى بطء عاقل داخل زمن سريع؛ بطء لا يعطل التطوير، لكنه يمنحه ضميرًا واتجاهًا.`
  const p5 = `لهذا أرى أن السؤال العملي ليس: هل نقبل ${topic} أو نرفضه؟ السؤال الأقرب إلى التعليم هو: كيف نجعله أداة تخدم الإنسان ولا تختصره؟ عندما نبدأ من هذا السؤال، يصبح التطوير أكثر تواضعًا، وأكثر صدقًا، وأقرب إلى روح التربية.`
  let draft = [p1, p2, p3, p4, p5].join('\n\n')
  const words = wordCount(draft)
  if (words > 450) draft = draft.split(/\s+/).slice(0, 445).join(' ') + '.'
  if (words < 305) draft += '\n\nوالأهم أن يبقى السؤال مفتوحًا: ما الأثر الإنساني الذي لا نريد أن نخسره ونحن نطارد الحلول السريعة؟'
  return draft
}

function buildSocial(bundle: Pick<Bundle, 'title' | 'excerpt' | 'body'>, audience: string) {
  const quote = bundle.body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .find((sentence) => sentence.length > 65 && sentence.length < 165)
    || bundle.excerpt
  return {
    x: `${quote}\n\n${bundle.title}`,
    linkedin: `${bundle.title}\n\n${bundle.excerpt}\n\nالسؤال الذي يستحق النقاش: كيف نحافظ على الإنسان في قلب التطوير؟`,
    instagram: `${bundle.title}\n\n${quote}\n\n#التعليم #الذكاء_الاصطناعي #د_أحمد_الفيلكاوي`,
    threads: `${bundle.excerpt}\n\nأحيانًا لا نحتاج إجابة أسرع، بل سؤالًا أعدل.`,
    whatsapp: `مقال جديد: ${bundle.title}\n${bundle.excerpt}`,
    newsletter: `اقتراح للنشرة: ${bundle.title}\n\nلماذا يهم هذا الموضوع ${audience}؟\n${bundle.excerpt}`,
  }
}

function qualityGate(bundle: Bundle, articles: ArticleRecord[]) {
  const usedSlug = articles.some((article) => article.slug === bundle.slug)
  const words = wordCount(bundle.body)
  const linked = bundle.related.length + bundle.books.length + bundle.papers.length
  const hasQuestion = /[؟?]/.test(bundle.body) || /السؤال|لماذا|كيف/.test(bundle.body)
  const socialOk = bundle.social.x.length <= 280 && bundle.social.linkedin.length >= 120 && bundle.social.instagram.length >= 90
  const checks = [
    { key: 'title', label: 'عنوان قوي وواضح', ok: bundle.title.trim().length >= 12 && !/^مقال|فكرة/.test(bundle.title.trim()) },
    { key: 'excerpt', label: 'مقتطف صالح للمشاركة', ok: bundle.excerpt.trim().length >= 70 && bundle.excerpt.trim().length <= 200 },
    { key: 'slug', label: 'Slug نظيف وغير مكرر', ok: /^[a-z0-9-]{8,}$/.test(bundle.slug) && !usedSlug },
    { key: 'links', label: 'روابط داخلية/معرفية', ok: linked >= 2 },
    { key: 'image', label: 'صورة مشاركة افتراضية متاحة', ok: true },
    { key: 'duplicate', label: 'لا يظهر تكرار مباشر', ok: !articles.some((article) => normalize(article.title) === normalize(bundle.title)) },
    { key: 'voice', label: 'قابلية صوتية', ok: words >= 305 && words <= 450 && hasQuestion },
    { key: 'social', label: 'قابلية سوشال', ok: socialOk },
  ]
  return {
    checks,
    ready: checks.every((check) => check.ok),
    blocking: checks.filter((check) => !check.ok).map((check) => check.label),
  }
}

function buildWeeklyPack(bundle: Bundle, articles: ArticleRecord[], radar: RadarItem[]): WeeklyPack {
  const related = bundle.related
    .map((item) => articles.find((article) => article.slug === item.slug))
    .filter(Boolean) as ArticleRecord[]
  const pool = related.length ? related : articles.slice(0, 5)
  const quote = strongestQuote(pool.map((article) => `${article.excerpt || ''} ${article.body || ''}`).join(' ') || bundle.body)
  const radarTop = radar[0]
  const radarComment = radarTop
    ? `${radarTop.ar}\n\nاللافت في هذا الحدث أنه لا يخص التقنية وحدها؛ بل يفتح سؤالًا تربويًا أعمق: كيف نحافظ على الإنسان داخل موجة التغيير؟\n\nيرتبط ذلك بما كتبته في «${bundle.related[0]?.title || bundle.title}».`
    : `لا توجد صيدة رادار منشورة اليوم. التعليق الجاهز:\n\n${bundle.title}\n\nقد يبدو الموضوع تقنيًا، لكنه في التعليم سؤال إنساني أولًا: ماذا يتغير في الطالب والمعلم حين تتغير الأداة؟`
  return {
    linkedin: [
      `${bundle.title}\n\n${bundle.excerpt}\n\nالفكرة ليست في سرعة التغيير، بل في المعنى الذي نحافظ عليه ونحن نتغير.`,
      `حين نناقش ${bundle.title}، لا أبدأ من الأداة، بل من أثرها في الإنسان.\n\nالتعليم لا يحتاج انبهارًا إضافيًا؛ يحتاج سؤالًا أعدل: ماذا يحدث للطالب والمعلم عندما تتحول الفكرة إلى ممارسة؟`,
      `${quote}\n\nهذه الجملة تصلح كبداية نقاش طويل مع المعلمين والباحثين: هل نطوّر التعليم أم نسرّع إجراءاته فقط؟`,
    ],
    x: [
      `${quote}\n\n${bundle.title}`,
      `السؤال ليس: ما الأداة؟\nالسؤال: ماذا تفعل الأداة في وعي الطالب والمعلم؟`,
      `كل تطوير تعليمي لا يبدأ من الإنسان، ينتهي غالبًا إلى إجراء جميل… ومعنى ناقص.`,
    ],
    generalX: [
      `ليست المشكلة أن التقنية تتقدم بسرعة.\nالمشكلة أن أسئلتنا التربوية أحيانًا تتأخر عنها.`,
      `في التعليم، لا يكفي أن نعرف ماذا يستطيع الذكاء الاصطناعي أن يفعل.\nالأهم: ماذا يجب ألا نسمح له أن يختصر؟`,
      `المعلم لا يفقد قيمته حين تظهر أداة جديدة.\nيفقدها فقط إذا اختزلنا التعليم في نقل المعلومة، ونسينا بناء الإنسان.`,
    ],
    instagram: `${bundle.title}\n\n${quote}\n\nفكرة للنقاش: كيف نجعل التقنية تخدم الإنسان لا تختصره؟\n\n#التعليم #الذكاء_الاصطناعي #تكنولوجيا_التعليم`,
    question: `لو كنت في قاعة تدريب: ما السؤال الأول الذي ستطرحه حول «${bundle.title}»؟`,
    quote,
    radarComment,
  }
}

function suggestArticleIdeas(articles: ArticleRecord[], radar: RadarItem[], privateLinks: PrivateBookLink[]) {
  const strategic = [
    { title: 'المعلم حين يصبح الذكاء الاصطناعي زميلًا لا بديلًا', idea: 'زاوية عن العلاقة العملية بين المعلم والأدوات الذكية داخل الصف.' },
    { title: 'الطالب الذي يعرف الإجابة ولا يعرف الطريق إليها', idea: 'عن أثر الإجابات الفورية في بناء التفكير والصبر المعرفي.' },
    { title: 'من يربّي الخوارزمية؟', idea: 'سؤال أخلاقي حول البيانات والقيم والتحيز في التعليم.' },
    { title: 'الأسرة أمام واجب رقمي جديد', idea: 'كيف يتغير دور ولي الأمر حين تصبح التقنية جزءًا من التعلم اليومي؟' },
    { title: 'الجامعة في زمن المحتوى المتولد', idea: 'ما الذي يبقى من البحث والكتابة الأكاديمية حين تتغير أدوات الإنتاج؟' },
  ]
  const radarIdeas = radar.slice(0, 3).map((item) => ({
    title: `ماذا يعني ${item.ar || item.en || 'هذا الحدث'} للتعليم؟`,
    idea: item.arNote || 'تعليق تربوي على حدث تقني/تعليمي راهن وربطه بأرشيف الدكتور.',
  }))
  const privateIdeas = privateLinks.slice(0, 3).map((book) => ({
    title: `من كتاب «${book.title}» إلى سؤال جديد في التعليم`,
    idea: `استخرج زاوية عامة من محاور الكتاب الخاصة: ${(book.topTerms || []).slice(0, 4).join('، ')} — من دون كشف نص الكتاب.`,
  }))
  return [...radarIdeas, ...privateIdeas, ...strategic]
    .map((item) => ({
      ...item,
      coverage: relatedForIdea(`${item.title} ${item.idea}`, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 4),
    }))
    .sort((a, b) => a.coverage.length - b.coverage.length)
    .slice(0, 8)
}

function buildBundle(idea: string, audience: string, angle: string, articles: ArticleRecord[]): Bundle {
  const title = suggestStrongTitle(idea)
  const cat = chooseCat(`${idea} ${angle}`)
  const related = relatedForIdea(`${idea} ${angle}`, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 5)
  const relatedBooks = relatedForIdea(`${idea} ${angle}`, books, (book) => book.desc || '', 3)
  const relatedPapers = relatedForIdea(`${idea} ${angle}`, papers, (paper) => paper.meta || '', 3)
  const body = buildArticleDraft(idea, audience, angle, related)
  const excerpt = clampExcerpt(body.split('\n\n')[0])
  const partial = { title, excerpt, body }
  const quality = [
    wordCount(body) >= 305 && wordCount(body) <= 450 ? `عدد الكلمات مناسب: ${wordCount(body)} كلمة.` : `عدد الكلمات يحتاج ضبطًا: ${wordCount(body)} كلمة.`,
    related.length ? `مرتبط بـ ${related.length} مقالات من أرشيفك.` : 'لم أجد ربطًا قويًا؛ أضف كلمات من قاموسك الفكري.',
    relatedBooks.length || relatedPapers.length ? 'يوجد امتداد أكاديمي/كتابي مناسب.' : 'لا يوجد امتداد كتابي أو بحثي واضح بعد.',
    'صورة المشاركة الافتراضية جاهزة إذا لم ترفع صورة خاصة.',
    'الحزمة الاجتماعية تولّدت للمقال، ويمكن حفظها في طابور الموافقة.',
    'التصنيف والمقتطف والـslug جاهزة مبدئيًا.',
    'بعد النشر: الصوت الآلي وR2 ينتظران مفاتيح Azure/Gemini ليصبحا تلقائيين بالكامل.',
  ]
  return {
    ...partial,
    slug: makeSlug(title),
    cat,
    social: buildSocial(partial, audience),
    related: related.map(({ slug, title, iso }) => ({ slug, title, iso })),
    books: relatedBooks.map(({ slug, title }) => ({ slug, title })),
    papers: relatedPapers.map(({ slug, title }) => ({ slug, title })),
    quality,
  }
}

function CopyButton({ value, label = 'نسخ' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      }}
    >
      {done ? 'تم النسخ ✓' : label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[.76rem] font-semibold text-accent">{label}</span>
      {children}
    </label>
  )
}

function SocialCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-hair bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">{title}</p>
        <CopyButton value={text} />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[.84rem] leading-relaxed text-soft">{text}</p>
    </div>
  )
}

function IdeaSuggestionsCard({
  suggestions,
  onPick,
}: {
  suggestions: ReturnType<typeof suggestArticleIdeas>
  onPick: (title: string, idea: string) => void
}) {
  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">ما لم أكتب فيه بعد</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">اقتراحات مقالات جديدة قبل الكتابة.</h2>
        </div>
        <p className="max-w-xl text-[.84rem] leading-relaxed text-soft">يراقب الرادار المنشور + كتبك الخاصة المشتقة + فجوات الأرشيف، ثم يقترح عناوين لا تزاحم ما كتبته.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {suggestions.map((item) => (
          <button
            key={`${item.title}-${item.idea}`}
            type="button"
            onClick={() => onPick(item.title, item.idea)}
            className="rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent"
          >
            <span className="block font-display text-lg font-semibold leading-relaxed text-ink">{item.title}</span>
            <span className="mt-2 block text-[.84rem] leading-relaxed text-soft">{item.idea}</span>
            <span className="mt-3 block text-[.74rem] text-accent">
              {item.coverage.length ? `الأرشيف يغطيها جزئيًا: ${item.coverage.length} روابط` : 'فجوة شبه جديدة — مناسبة لمقال'}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PrivateArchiveCard({
  links,
  bundle,
}: {
  links: PrivateBookLink[]
  bundle: Bundle
}) {
  const related = relatedForIdea(`${bundle.title} ${bundle.excerpt}`, links, (book) => `${book.topTerms?.join(' ') || ''} ${book.relatedPublicArticles?.map((article) => article.title).join(' ') || ''}`, 4)
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">أرشيف الدكتور السري</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">كتبك الخاصة لا تظهر للناس… لكنها تربط الفكرة بذاكرتك.</h2>
      {links.length ? (
        <div className="mt-4 grid gap-3">
          {related.map((book) => (
            <div key={book.title} className="rounded-xl border border-hair bg-canvas p-4">
              <p className="font-semibold text-ink">{book.title}</p>
              <p className="mt-1 text-[.78rem] leading-relaxed text-soft">
                قريب من هذا المقال عبر محاور: {(book.topTerms || []).slice(0, 5).join('، ') || 'محاور مشتقة'}.
              </p>
              {book.linkedPublicBook && (
                <a href={`/publications/${book.linkedPublicBook.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[.78rem] text-accent hover:text-accent-deep">
                  الكتاب المنشور الأقرب: {book.linkedPublicBook.title} ←
                </a>
              )}
            </div>
          ))}
          {!related.length && <p className="rounded-xl border border-hair bg-canvas p-4 text-[.84rem] text-soft">لا توجد صلة قوية بهذه الفكرة في الذاكرة الخاصة حتى الآن.</p>}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-hair bg-canvas p-4 text-[.84rem] leading-relaxed text-soft">
          الذاكرة الخاصة لم تُبنَ بعد في هذه النسخة. شغّل <span dir="ltr">npm run private-books:memory</span> بعد وضع الكتب في <span dir="ltr">PrivateBooks</span>، وسيظهر هنا الربط المشتق الآمن فقط.
        </p>
      )}
    </section>
  )
}

function QualityGateCard({ gate }: { gate: ReturnType<typeof qualityGate> }) {
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">بوابة جودة قبل النشر</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">{gate.ready ? 'جاهز للاعتماد.' : 'يحتاج انتباه قبل النشر.'}</h2>
      <div className="mt-4 grid gap-2">
        {gate.checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3">
            <span className="text-[.84rem] text-ink">{check.label}</span>
            <span className={`text-[.78rem] font-semibold ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : 'يحتاج ضبط'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function WeeklyPackCard({
  pack,
  onSave,
  busy,
}: {
  pack: WeeklyPack
  onSave: () => void
  busy: boolean
}) {
  const all = [
    ...pack.linkedin.map((text, index) => `LinkedIn ${index + 1}:\n${text}`),
    ...pack.x.map((text, index) => `X ${index + 1}:\n${text}`),
    ...pack.generalX.map((text, index) => `X عام ${index + 1}:\n${text}`),
    `Instagram:\n${pack.instagram}`,
    `سؤال تفاعلي:\n${pack.question}`,
    `اقتباس:\n${pack.quote}`,
    `تعليق على حدث راهن:\n${pack.radarComment}`,
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">حزمة الأسبوع</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">محتوى أسبوع كامل ينتظر موافقتك.</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={all} label="نسخ الكل" />
          <button type="button" className={primary} disabled={busy} onClick={onSave}>{busy ? 'أحفظ…' : 'حفظ في طابور الموافقة'}</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pack.linkedin.map((text, index) => <SocialCard key={`li-${index}`} title={`LinkedIn ${index + 1}`} text={text} />)}
        {pack.x.map((text, index) => <SocialCard key={`x-${index}`} title={`X للمقال ${index + 1}`} text={text} />)}
        {pack.generalX.map((text, index) => <SocialCard key={`gx-${index}`} title={`X عام ${index + 1}`} text={text} />)}
        <SocialCard title="Instagram" text={pack.instagram} />
        <SocialCard title="سؤال تفاعلي" text={pack.question} />
        <SocialCard title="اقتباس من الأرشيف" text={pack.quote} />
        <SocialCard title="تعليق على حدث راهن" text={pack.radarComment} />
      </div>
    </section>
  )
}

export function PublishingStudio({ articles }: { articles: ArticleRecord[] }) {
  const { isAdmin, refresh } = useAdminAuth()
  const [richArticles, setRichArticles] = useState<ArticleRecord[]>(articles)
  const [radar, setRadar] = useState<RadarItem[]>([])
  const [idea, setIdea] = useState('الذكاء الاصطناعي في التعليم')
  const [audience, setAudience] = useState('المعلمين والقيادات التعليمية')
  const [angle, setAngle] = useState('الأثر الإنساني قبل بريق الأداة')
  const [bundle, setBundle] = useState<Bundle>(() => buildBundle(idea, audience, angle, articles))
  const [status, setStatus] = useState<StudioStatus>('draft')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [queueBusy, setQueueBusy] = useState(false)
  const [view, setView] = useState<'idea' | 'write' | 'review' | 'distribution'>('idea')

  useEffect(() => {
    let active = true
    setRichArticles(articles)
    loadArticleBodies().then((bodies) => {
      if (!active) return
      setRichArticles(articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })))
    }).catch(() => undefined)
    return () => { active = false }
  }, [articles])

  const style = useMemo(() => styleFingerprint(richArticles), [richArticles])
  const lab = useMemo(() => ideaLab(idea, richArticles, books, papers), [idea, richArticles])
  const privateLinks = (privateBookLinks as { books?: PrivateBookLink[] }).books || []
  const gate = useMemo(() => qualityGate(bundle, richArticles), [bundle, richArticles])
  const weeklyPack = useMemo(() => buildWeeklyPack(bundle, richArticles, radar), [bundle, radar, richArticles])
  const articleSuggestions = useMemo(() => suggestArticleIdeas(richArticles, radar, privateLinks), [privateLinks, radar, richArticles])

  useEffect(() => {
    let active = true
    fetchPublishedExtras<RadarItem>('site_radar').then((items) => {
      if (active) setRadar(items.slice(0, 5))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const rebuild = () => {
    setBundle(buildBundle(idea, audience, angle, richArticles))
    setNotice('بُنيت الحزمة من أرشيف الدكتور وأسلوبه ✓')
    window.setTimeout(() => setNotice(''), 2200)
  }

  const pickSuggestion = (title: string, suggestion: string) => {
    setIdea(title)
    setAngle(suggestion)
    const next = buildBundle(`${title}. ${suggestion}`, audience, suggestion, richArticles)
    setBundle({ ...next, title })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateBundle = (patch: Partial<Bundle>) => {
    setBundle((previous) => {
      const next = { ...previous, ...patch }
      if ('title' in patch && patch.title) next.slug = makeSlug(patch.title)
      if ('body' in patch || 'excerpt' in patch || 'title' in patch) {
        next.social = buildSocial({ title: next.title, excerpt: next.excerpt, body: next.body }, audience)
      }
      return next
    })
  }

  const save = async (mode: StudioStatus) => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثًا. سجّل خروجك وادخل من جديد.')
      if (mode === 'scheduled' && !scheduledAt) throw new Error('اختر موعد الجدولة أولًا.')
      if (wordCount(bundle.body) < 305 || wordCount(bundle.body) > 450) throw new Error('المقال يجب أن يبقى بين 305 و450 كلمة.')
      if (mode === 'published' && !gate.ready) throw new Error(`بوابة الجودة لم تجتز بعد: ${gate.blocking.join('، ')}`)
      if (richArticles.some((article) => article.slug === bundle.slug)) throw new Error('هذا الـslug مستخدم سابقًا. عدّل العنوان أو الرابط.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const date = today()
      await setDoc(doc(db, 'site_articles', bundle.slug), {
        slug: bundle.slug,
        title: bundle.title.trim(),
        cat: bundle.cat,
        excerpt: bundle.excerpt.trim(),
        body: bundle.body.trim(),
        iso: date.iso,
        date: date.ar,
        status: mode,
        scheduledAt: mode === 'scheduled' ? scheduledAt : '',
        publishingStudio: {
          idea,
          audience,
          angle,
          social: bundle.social,
          relatedArticles: bundle.related,
          relatedBooks: bundle.books,
          relatedPapers: bundle.papers,
          quality: bundle.quality,
          generatedBy: 'local-archive-studio',
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setStatus(mode)
      setNotice(mode === 'published'
        ? 'نُشر المقال فورًا. سيظهر للزوار، وسيدخل دورة الصوت التلقائي بعد إضافة مفاتيح Azure/Gemini.'
        : mode === 'scheduled'
          ? 'حُفظ المقال مجدولًا ولن يظهر قبل موعده.'
          : 'حُفظ كمسودة داخل مقالات اللوحة.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر الحفظ.')
    } finally {
      setBusy(false)
    }
  }

  const saveWeeklyQueue = async () => {
    setError('')
    setNotice('')
    setQueueBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثًا. سجّل خروجك وادخل من جديد.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      await addDoc(collection(db, 'social_queue'), {
        status: 'ready_for_review',
        source: 'publishing_studio',
        articleSlug: bundle.slug,
        articleTitle: bundle.title,
        idea,
        audience,
        posts: {
          linkedin: weeklyPack.linkedin,
          x: weeklyPack.x,
          generalX: weeklyPack.generalX,
          instagram: weeklyPack.instagram,
          interactiveQuestion: weeklyPack.question,
          archiveQuote: weeklyPack.quote,
          radarComment: weeklyPack.radarComment,
        },
        relatedArticles: bundle.related,
        radar: radar.slice(0, 3),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNotice('حُفظت حزمة الأسبوع في طابور الموافقة. لاحقًا نربطها بالنشر المباشر لحساباتك.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حفظ حزمة الأسبوع.')
    } finally {
      setQueueBusy(false)
    }
  }

  const fullPackage = [
    `العنوان: ${bundle.title}`,
    `التصنيف: ${bundle.cat}`,
    `المقتطف: ${bundle.excerpt}`,
    `المقال:\n${bundle.body}`,
    `X:\n${bundle.social.x}`,
    `LinkedIn:\n${bundle.social.linkedin}`,
    `Instagram:\n${bundle.social.instagram}`,
    `Newsletter:\n${bundle.social.newsletter}`,
  ].join('\n\n---\n\n')

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">استوديو النشر الذكي</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">من فكرة واحدة إلى مقال ومنظومة نشر.</h1>
        <p className="mt-3 max-w-4xl text-[.88rem] leading-loose text-soft">كل قدرات الاستوديو باقية، لكن موزعة على أربع مراحل واضحة بدل ظهورها دفعة واحدة.</p>
        <div className="rail mt-5 flex gap-2 overflow-x-auto pb-1">
          {([
            ['idea', 'الفكرة'],
            ['write', 'الكتابة'],
            ['review', 'المراجعة والنشر'],
            ['distribution', 'التوزيع'],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold transition-colors ${view === key ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{label}</button>
          ))}
        </div>
      </section>

      {view === 'idea' && (
        <>
          <section className={card}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_14rem_auto]">
              <Field label="الفكرة الخام"><input className={input} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="مثال: الخوف من الامتحان" /></Field>
              <Field label="الجمهور"><select className={input} value={audience} onChange={(event) => setAudience(event.target.value)}><option>المعلمين والقيادات التعليمية</option><option>أولياء الأمور</option><option>الطلاب والباحثين</option><option>الإعلاميين</option><option>الجمهور العام</option></select></Field>
              <Field label="الزاوية"><select className={input} value={angle} onChange={(event) => setAngle(event.target.value)}><option>الأثر الإنساني قبل بريق الأداة</option><option>زاوية تربوية عملية</option><option>سؤال أخلاقي وفكري</option><option>مدخل إعلامي سريع</option><option>امتداد أكاديمي من الأرشيف</option></select></Field>
              <div className="flex items-end"><button type="button" className={`${primary} w-full`} onClick={() => { rebuild(); setView('write') }}>ابنِ الحزمة</button></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.articleCount}</strong><span className="text-[.76rem] text-soft">مقالًا يتعلم منها</span></div>
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.avgSentenceWords || '—'}</strong><span className="text-[.76rem] text-soft">متوسط الجملة</span></div>
              <div className="col-span-2 rounded-xl border border-hair bg-canvas p-4 lg:col-span-1"><strong className="block font-display text-2xl text-accent">{bundle.related.length}</strong><span className="text-[.76rem] text-soft">روابط فكرية</span></div>
            </div>
          </section>
          <IdeaSuggestionsCard suggestions={articleSuggestions} onPick={(title, suggestion) => { pickSuggestion(title, suggestion); setView('write') }} />
        </>
      )}

      {view === 'write' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className={card}>
            <div className="grid gap-4">
              <Field label="العنوان"><input className={input} value={bundle.title} onChange={(event) => updateBundle({ title: event.target.value })} /></Field>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                <Field label="الرابط المختصر"><input className={input} dir="ltr" value={bundle.slug} onChange={(event) => updateBundle({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
                <Field label="التصنيف"><select className={input} value={bundle.cat} onChange={(event) => updateBundle({ cat: event.target.value })}>{articleCats.filter((cat) => cat !== 'الكل').map((cat) => <option key={cat}>{cat}</option>)}</select></Field>
              </div>
              <Field label="المقتطف"><textarea className={`${input} min-h-24 leading-loose`} value={bundle.excerpt} onChange={(event) => updateBundle({ excerpt: event.target.value })} /></Field>
              <Field label={`المقال (${wordCount(bundle.body)} كلمة)`}><textarea className={`${input} min-h-[500px] leading-loose`} value={bundle.body} onChange={(event) => updateBundle({ body: event.target.value })} /></Field>
            </div>
          </section>
          <aside className="grid content-start gap-5">
            <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة الفكرة</p><p className="mt-2 text-[.86rem] leading-relaxed text-soft">{lab.angle}</p><div className="mt-4 grid gap-3">{bundle.related.map((item) => <a key={item.slug} href={`/articles/${item.slug}`} target="_blank" rel="noreferrer" className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.84rem] text-ink transition-colors hover:border-accent hover:text-accent">{item.title}{item.iso && <span className="ms-2 text-soft">{item.iso.slice(0, 4)}</span>}</a>)}</div></section>
            <PrivateArchiveCard links={privateLinks} bundle={bundle} />
            <button type="button" onClick={() => setView('review')} className={primary}>انتقل إلى المراجعة</button>
          </aside>
        </div>
      )}

      {view === 'review' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <QualityGateCard gate={gate} />
          <section className={card}>
            <p className="text-[.76rem] font-semibold uppercase text-accent">بوابة الاعتماد</p>
            <ul className="mt-3 grid gap-2 text-[.84rem] leading-relaxed text-soft">{bundle.quality.map((item) => <li key={item}>• {item}</li>)}</ul>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" disabled={busy} className={primary} onClick={() => save('published')}>اعتماد ونشر فورًا</button><button type="button" disabled={busy} className={ghost} onClick={() => save('draft')}>حفظ كمسودة</button><div className="grid gap-2 sm:col-span-2"><input className={input} dir="ltr" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><button type="button" disabled={busy || !scheduledAt} className={ghost} onClick={() => save('scheduled')}>حفظ وجدولة</button></div><CopyButton value={fullPackage} label="نسخ الحزمة كاملة" /></div>
            {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-accent">{notice}</p>}
            {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-soft">{error}</p>}
            <p className="mt-4 text-[.76rem] leading-relaxed text-soft">آخر وضع محفوظ: {status === 'published' ? 'منشور' : status === 'scheduled' ? 'مجدول' : 'مسودة'}</p>
          </section>
        </div>
      )}

      {view === 'distribution' && (
        <>
          <section className={card}>
            <div className="mb-4"><p className="text-[.76rem] font-semibold uppercase text-accent">قوالب السوشال الجاهزة</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">من المقال نفسه… بلا إعادة تفكير.</h2></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SocialCard title="X" text={bundle.social.x} /><SocialCard title="LinkedIn" text={bundle.social.linkedin} /><SocialCard title="Instagram" text={bundle.social.instagram} /><SocialCard title="Threads" text={bundle.social.threads} /><SocialCard title="WhatsApp / Broadcast" text={bundle.social.whatsapp} /><SocialCard title="النشرة البريدية" text={bundle.social.newsletter} /></div>
          </section>
          <WeeklyPackCard pack={weeklyPack} onSave={saveWeeklyQueue} busy={queueBusy} />
          <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">ما بعد الاعتماد</p><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['١','يظهر في Firestore فورًا.'],['٢','يدخل Sitemap/RSS في البناء التالي.'],['٣','يلتقطه Workflow الصوت بعد ربط Azure.'],['٤','تُرفع الحوارات إلى R2 بعد الاعتماد.']].map(([num, note]) => <div key={num} className="rounded-xl border border-hair bg-canvas p-4"><span className="font-display text-2xl text-accent">{num}</span><p className="mt-2 text-[.8rem] leading-relaxed text-soft">{note}</p></div>)}</div></section>
        </>
      )}
    </div>
  )

}