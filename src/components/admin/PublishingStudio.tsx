import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { articleCats, books, papers } from '../../data'
import privateBookLinks from '../../data/private-book-links.json'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { useAdminAuth } from '../../lib/admin-auth'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import { articleSimilarityReport, editorialStyleProfile, ideaLab, relatedForIdea, representativeStyleSamples, strongestQuote, suggestStrongTitle } from '../../lib/intelligence'
import { buildSocialVisuals, downloadSocialPng, type SocialVisualTemplate } from '../../lib/social-templates'

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
  exactTarget?: number
  originality?: number
  similarity?: { slug: string; title: string; score: number }[]
  event?: CurrentEvent | null
  eventConnection?: string
  generatedBy?: 'archive-ai' | 'local-fallback'
  socialPack?: PerfectSocialPack | null
}


type CurrentEvent = {
  id: string
  title: string
  summary?: string
  source: string
  url: string
  publishedAt?: string
  ageHours?: number | null
  relevance?: number
}

type PerfectSocialPack = {
  x: string[]
  linkedin: string[]
  threads: string[]
  instagramCaptions: string[]
  carouselSlides: { kicker: string; title: string; body: string }[]
  stories: string[]
  reelScript: string
  whatsapp: string
  newsletter: string
  hashtags: string[]
  event?: CurrentEvent | null
  eventHook?: string
  visualDirections: { layout: string; tone: string; headline: string; subline: string }[]
  generatedAt?: string
}

type PerfectArticleResponse = {
  title: string
  cat: string
  excerpt: string
  body: string
  angle: string
  event?: CurrentEvent | null
  eventConnection?: string
  originalityNote?: string
  exactWords: number
  originality: number
  similarity: { slug: string; title: string; score: number }[]
  modelValidated: boolean
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

async function adminAiRequest<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  let payload: any = null
  try { payload = await response.json() } catch { /* يعالج الخطأ أدناه */ }
  if (!response.ok) throw new Error(payload?.error || payload?.message || `تعذّر الاتصال بالخدمة (${response.status}).`)
  return payload as T
}

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

function qualityGate(bundle: Bundle, articles: ArticleRecord[], targetWords: number) {
  const usedSlug = articles.some((article) => article.slug === bundle.slug)
  const words = wordCount(bundle.body)
  const linked = bundle.related.length + bundle.books.length + bundle.papers.length
  const hasQuestion = /[؟?]/.test(bundle.body) || /السؤال|لماذا|كيف/.test(bundle.body)
  const socialOk = bundle.social.x.length <= 280 && bundle.social.linkedin.length >= 120 && bundle.social.instagram.length >= 90
  const similarity = articleSimilarityReport(bundle.title, bundle.body, articles)
  const checks = [
    { key: 'title', label: 'عنوان قوي وواضح', ok: bundle.title.trim().length >= 12 && !/^مقال|فكرة/.test(bundle.title.trim()) },
    { key: 'excerpt', label: 'مقتطف صالح للمشاركة', ok: bundle.excerpt.trim().length >= 70 && bundle.excerpt.trim().length <= 200 },
    { key: 'slug', label: 'Slug نظيف وغير مكرر', ok: /^[a-z0-9-]{8,}$/.test(bundle.slug) && !usedSlug },
    { key: 'links', label: 'روابط داخلية/معرفية', ok: linked >= 2 },
    { key: 'image', label: 'صورة مشاركة افتراضية متاحة', ok: true },
    { key: 'duplicate', label: `أصالة الفكرة (${similarity.originality}٪)`, ok: !similarity.repeated && !articles.some((article) => normalize(article.title) === normalize(bundle.title)) },
    { key: 'words', label: `عدد الكلمات حرفي: ${targetWords}`, ok: words === targetWords },
    { key: 'voice', label: 'قابلية صوتية', ok: words === targetWords && hasQuestion },
    { key: 'style-ai', label: 'مبني من بصمة أرشيفك', ok: bundle.generatedBy === 'archive-ai' },
    { key: 'social', label: 'حزمة سوشيال كاملة ومتنوعة', ok: socialOk && Boolean(bundle.socialPack?.carouselSlides?.length && bundle.socialPack.carouselSlides.length >= 5) },
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


function CurrentEventsCard({
  items,
  selected,
  loading,
  onToggle,
}: {
  items: CurrentEvent[]
  selected: string[]
  loading: boolean
  onToggle: (id: string) => void
}) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">أحداث الساعة</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">يربط الحدث فقط عندما يخدم الفكرة.</h2>
          <p className="mt-2 text-[.8rem] leading-relaxed text-soft">اتركها بلا اختيار ليقرر الاستوديو تلقائيًا، أو ثبّت حدثًا موثوقًا بنفسك.</p>
        </div>
        <span className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft">{loading ? 'أحدّث المصادر…' : selected.length ? `${selected.length} محدد` : 'اختيار ذكي'}</span>
      </div>
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {items.slice(0, 8).map((item) => {
            const active = selected.includes(item.id)
            return (
              <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={`rounded-2xl border p-4 text-right transition-colors ${active ? 'border-accent bg-accent/[.06]' : 'border-hair bg-canvas hover:border-accent'}`}>
                <span className="flex items-center justify-between gap-2 text-[.7rem] font-semibold text-accent"><span>{item.source}</span><span>{item.ageHours != null ? `قبل ${item.ageHours} س` : 'حديث'}</span></span>
                <span className="mt-2 line-clamp-2 block font-display text-[.96rem] font-semibold leading-[1.55] text-ink">{item.title}</span>
                <span className="mt-3 block text-[.72rem] text-soft">{active ? 'مثبّت للربط ✓' : 'اضغط لتثبيته'}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">{loading ? 'أقرأ المصادر الموثوقة الآن…' : 'لا يوجد حدث راهن مناسب لهذه الفكرة، وهذا أفضل من ربط مصطنع.'}</p>
      )}
    </section>
  )
}

function VisualTemplateCard({ template }: { template: SocialVisualTemplate }) {
  const dark = template.layout === 'dark'
  return (
    <div className="overflow-hidden rounded-2xl border border-hair bg-canvas">
      <div className={`relative aspect-[4/5] overflow-hidden p-5 ${dark ? 'bg-ink text-white' : template.layout === 'event' ? 'bg-[#eef2f5] text-ink' : 'bg-[#f7f6f3] text-ink'}`}>
        <span className="absolute inset-x-5 top-5 h-px bg-accent/40" />
        <p className="mt-5 text-[.68rem] font-semibold text-accent">{template.kicker}</p>
        <h3 className={`mt-4 font-display text-[1.35rem] font-bold leading-[1.5] ${dark ? 'text-white' : 'text-ink'}`}>{template.title}</h3>
        {template.body && <p className={`mt-4 line-clamp-5 text-[.78rem] leading-[1.8] ${dark ? 'text-white/65' : 'text-soft'}`}>{template.body}</p>}
        <span className={`absolute bottom-5 right-5 text-[.66rem] ${dark ? 'text-white/50' : 'text-soft'}`}>{template.footer}</span>
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="text-[.72rem] text-soft">{template.format}</span>
        <button type="button" onClick={() => void downloadSocialPng(template)} className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-accent transition-colors hover:border-accent">تنزيل PNG</button>
      </div>
    </div>
  )
}

function PerfectSocialPackCard({
  pack,
  article,
  busy,
  onRegenerate,
  onSave,
  saveBusy,
}: {
  pack: PerfectSocialPack
  article: { title: string; excerpt: string }
  busy: boolean
  onRegenerate: () => void
  onSave: () => void
  saveBusy: boolean
}) {
  const visuals = buildSocialVisuals(pack, article)
  return (
    <div className="grid gap-5">
      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">منظومة السوشيال</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">كل منصة بصوتها… وكل تصميم من هوية الموقع.</h2>
            <p className="mt-2 text-[.82rem] leading-relaxed text-soft">لا نسخ ولصق بين المنصات: كاروسيل، Story، Reel، LinkedIn، X، Threads، واتساب ونشرة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={onRegenerate} className={ghost}>{busy ? 'أعيد البناء…' : 'تنويع جديد'}</button>
            <button type="button" disabled={saveBusy} onClick={onSave} className={primary}>{saveBusy ? 'أحفظ…' : 'حفظ الحزمة'}</button>
          </div>
        </div>
        {pack.event && (
          <a href={pack.event.url} target="_blank" rel="noreferrer" className="mt-5 block rounded-2xl border border-accent/30 bg-accent/[.05] p-4 transition-colors hover:border-accent">
            <span className="text-[.72rem] font-semibold text-accent">ربط راهن موثق · {pack.event.source}</span>
            <span className="mt-2 block font-display text-[1rem] font-semibold text-ink">{pack.event.title}</span>
            {pack.eventHook && <span className="mt-2 block text-[.8rem] leading-relaxed text-soft">{pack.eventHook}</span>}
          </a>
        )}
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">قوالب Instagram الجاهزة</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visuals.instagram.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
        </div>
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">Story وLinkedIn</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <VisualTemplateCard template={visuals.linkedin} />
          {visuals.stories.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
        </div>
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">النصوص حسب المنصة</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pack.x.map((text, index) => <SocialCard key={`x-perfect-${index}`} title={`X · صيغة ${index + 1}`} text={text} />)}
          {pack.linkedin.map((text, index) => <SocialCard key={`li-perfect-${index}`} title={`LinkedIn · صيغة ${index + 1}`} text={text} />)}
          {pack.instagramCaptions.map((text, index) => <SocialCard key={`ig-perfect-${index}`} title={`Instagram · Caption ${index + 1}`} text={`${text}\n\n${pack.hashtags.join(' ')}`} />)}
          {pack.threads.map((text, index) => <SocialCard key={`th-perfect-${index}`} title={`Threads · صيغة ${index + 1}`} text={text} />)}
          <SocialCard title="Reel · 45–60 ثانية" text={pack.reelScript} />
          <SocialCard title="WhatsApp" text={pack.whatsapp} />
          <SocialCard title="النشرة البريدية" text={pack.newsletter} />
        </div>
      </section>
    </div>
  )
}

export function PublishingStudio({ articles }: { articles: ArticleRecord[] }) {
  const { isAdmin, refresh, user } = useAdminAuth()
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
  const [generating, setGenerating] = useState(false)
  const [socialGenerating, setSocialGenerating] = useState(false)
  const [targetWords, setTargetWords] = useState(400)
  const [currentEvents, setCurrentEvents] = useState<CurrentEvent[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
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

  const style = useMemo(() => editorialStyleProfile(richArticles), [richArticles])
  const styleSamples = useMemo(() => representativeStyleSamples(richArticles, 6), [richArticles])
  const lab = useMemo(() => ideaLab(idea, richArticles, books, papers), [idea, richArticles])
  const privateLinks = (privateBookLinks as { books?: PrivateBookLink[] }).books || []
  const gate = useMemo(() => qualityGate(bundle, richArticles, targetWords), [bundle, richArticles, targetWords])
  const similarity = useMemo(() => articleSimilarityReport(bundle.title, bundle.body, richArticles), [bundle.title, bundle.body, richArticles])
  const weeklyPack = useMemo(() => buildWeeklyPack(bundle, richArticles, radar), [bundle, radar, richArticles])
  const articleSuggestions = useMemo(() => suggestArticleIdeas(richArticles, radar, privateLinks), [privateLinks, radar, richArticles])

  useEffect(() => {
    let active = true
    fetchPublishedExtras<RadarItem>('site_radar').then((items) => {
      if (active) setRadar(items.slice(0, 5))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])


  useEffect(() => {
    if (!user || idea.trim().length < 3) return
    let active = true
    const timer = window.setTimeout(() => {
      setEventsLoading(true)
      user.getIdToken().then((token) => adminAiRequest<{ items: CurrentEvent[] }>('/api/ai/current-context', { idea, selectedEventIds }, token))
        .then((result) => {
          if (!active) return
          setCurrentEvents(result.items || [])
          setSelectedEventIds((previous) => previous.filter((id) => (result.items || []).some((item) => item.id === id)))
        })
        .catch(() => { if (active) setCurrentEvents([]) })
        .finally(() => { if (active) setEventsLoading(false) })
    }, 650)
    return () => { active = false; window.clearTimeout(timer) }
  }, [idea, user])

  const requestSocialPack = async (articleBundle: Bundle) => {
    if (!user) throw new Error('جلسة المشرف غير متاحة.')
    setSocialGenerating(true)
    try {
      const token = await user.getIdToken()
      const socialPack = await adminAiRequest<PerfectSocialPack>('/api/ai/social-pack', {
        title: articleBundle.title,
        excerpt: articleBundle.excerpt,
        body: articleBundle.body,
        audience,
        styleProfile: style,
        selectedEventIds,
      }, token)
      setBundle((previous) => previous.slug === articleBundle.slug ? { ...previous, socialPack } : previous)
      return socialPack
    } finally {
      setSocialGenerating(false)
    }
  }

  const rebuild = async (override?: { title?: string; angle?: string }) => {
    setError('')
    setNotice('')
    setGenerating(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok || !user) throw new Error('جلسة المشرف تحتاج تحديثًا. سجّل خروجك وادخل من جديد.')
      const token = await user.getIdToken()
      const requestedIdea = override?.title ? `${override.title}. ${override.angle || ''}` : idea
      const requestedAngle = override?.angle || angle
      const nearest = relatedForIdea(`${requestedIdea} ${requestedAngle}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 45)
      const seen = new Set(nearest.map((article) => article.slug))
      const archive = [...nearest, ...richArticles.filter((article) => !seen.has(article.slug))].slice(0, 180)
      const generated = await adminAiRequest<PerfectArticleResponse>('/api/ai/perfect-article', {
        idea: requestedIdea,
        audience,
        angle: requestedAngle,
        targetWords,
        styleProfile: style,
        styleSamples,
        selectedEventIds,
        existing: archive.map((article) => ({
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt || '',
          body: article.body || '',
        })),
      }, token)
      if (generated.exactWords !== targetWords || wordCount(generated.body) !== targetWords) {
        throw new Error(`رفض الاستوديو النص لأن عدده ${wordCount(generated.body)} وليس ${targetWords} كلمة حرفيًا.`)
      }
      const related = relatedForIdea(`${generated.title} ${generated.excerpt}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 5)
      const relatedBooks = relatedForIdea(`${generated.title} ${generated.excerpt}`, books, (book) => book.desc || '', 3)
      const relatedPapers = relatedForIdea(`${generated.title} ${generated.excerpt}`, papers, (paper) => paper.meta || '', 3)
      const partial = { title: generated.title, excerpt: generated.excerpt, body: generated.body }
      const nextBundle: Bundle = {
        ...partial,
        slug: makeSlug(generated.title),
        cat: generated.cat,
        social: buildSocial(partial, audience),
        related: related.map(({ slug, title, iso }) => ({ slug, title, iso })),
        books: relatedBooks.map(({ slug, title }) => ({ slug, title })),
        papers: relatedPapers.map(({ slug, title }) => ({ slug, title })),
        quality: [
          `العدد مقفول حرفيًا: ${generated.exactWords} كلمة.`,
          `درجة الأصالة مقابل الأرشيف: ${generated.originality}٪.`,
          `تعلّم من ${style.articleCount} مقالًا ومن ${styleSamples.length} عينات أسلوب متنوعة.`,
          generated.event ? `ربط راهن موثّق: ${generated.event.source} — ${generated.event.title}` : 'لم يُفرض حدث راهن لأن الصلة لم تكن عضوية.',
          generated.originalityNote || 'اجتاز فحص عدم تكرار الزاوية والحجة.',
          'قوالب السوشيال تُبنى منفصلة لكل منصة لمنع النسخ المتكرر.',
        ],
        exactTarget: targetWords,
        originality: generated.originality,
        similarity: generated.similarity,
        event: generated.event || null,
        eventConnection: generated.eventConnection || '',
        generatedBy: 'archive-ai',
        socialPack: null,
      }
      setBundle(nextBundle)
      setIdea(override?.title || idea)
      if (override?.angle) setAngle(override.angle)
      setNotice(`مقال أصيل بأسلوبك، ${targetWords} كلمة حرفيًا، اجتاز بوابة عدم التكرار ✓`)
      setView('write')
      void requestSocialPack(nextBundle).catch(() => undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر بناء المقال الكامل.')
    } finally {
      setGenerating(false)
    }
  }

  const pickSuggestion = (title: string, suggestion: string) => {
    setIdea(title)
    setAngle(suggestion)
    void rebuild({ title, angle: suggestion })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateBundle = (patch: Partial<Bundle>) => {
    setBundle((previous) => {
      const next = { ...previous, ...patch }
      if ('title' in patch && patch.title) next.slug = makeSlug(patch.title)
      if ('body' in patch || 'excerpt' in patch || 'title' in patch) {
        next.social = buildSocial({ title: next.title, excerpt: next.excerpt, body: next.body }, audience)
        next.socialPack = null
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
      if (wordCount(bundle.body) !== targetWords) throw new Error(`المقال يجب أن يكون ${targetWords} كلمة حرفيًا. العدد الحالي: ${wordCount(bundle.body)}.`)
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
          exactWords: targetWords,
          originality: similarity.originality,
          nearestArchive: similarity.matches,
          styleProfile: style,
          styleSamples: styleSamples.map((sample) => ({ slug: sample.slug, title: sample.title, cat: sample.cat, year: sample.year })),
          currentEvent: bundle.event || null,
          eventConnection: bundle.eventConnection || '',
          socialPack: bundle.socialPack || null,
          generatedBy: bundle.generatedBy || 'local-archive-studio',
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
        posts: bundle.socialPack ? {
          linkedin: bundle.socialPack.linkedin,
          x: bundle.socialPack.x,
          threads: bundle.socialPack.threads,
          instagramCaptions: bundle.socialPack.instagramCaptions,
          carouselSlides: bundle.socialPack.carouselSlides,
          stories: bundle.socialPack.stories,
          reelScript: bundle.socialPack.reelScript,
          whatsapp: bundle.socialPack.whatsapp,
          newsletter: bundle.socialPack.newsletter,
          hashtags: bundle.socialPack.hashtags,
          eventHook: bundle.socialPack.eventHook || '',
        } : {
          linkedin: weeklyPack.linkedin,
          x: weeklyPack.x,
          generalX: weeklyPack.generalX,
          instagram: weeklyPack.instagram,
          interactiveQuestion: weeklyPack.question,
          archiveQuote: weeklyPack.quote,
          radarComment: weeklyPack.radarComment,
        },
        visualTemplates: bundle.socialPack ? buildSocialVisuals(bundle.socialPack, { title: bundle.title, excerpt: bundle.excerpt }) : null,
        currentEvent: bundle.socialPack?.event || bundle.event || null,
        relatedArticles: bundle.related,
        radar: radar.slice(0, 3),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNotice('حُفظت الحزمة النصية والبصرية ومصدر الحدث في طابور الموافقة ✓')
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
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_8rem_auto]">
              <Field label="الفكرة الخام"><input className={input} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="مثال: الخوف من الامتحان" /></Field>
              <Field label="الجمهور"><select className={input} value={audience} onChange={(event) => setAudience(event.target.value)}><option>المعلمين والقيادات التعليمية</option><option>أولياء الأمور</option><option>الطلاب والباحثين</option><option>الإعلاميين</option><option>الجمهور العام</option></select></Field>
              <Field label="الزاوية"><select className={input} value={angle} onChange={(event) => setAngle(event.target.value)}><option>الأثر الإنساني قبل بريق الأداة</option><option>زاوية تربوية عملية</option><option>سؤال أخلاقي وفكري</option><option>مدخل إعلامي سريع</option><option>امتداد أكاديمي من الأرشيف</option></select></Field>
              <Field label="الكلمات حرفيًا"><input className={input} dir="ltr" type="number" min={350} max={450} step={1} value={targetWords} onChange={(event) => setTargetWords(Math.max(350, Math.min(450, Number(event.target.value) || 400)))} /></Field>
              <div className="flex items-end"><button type="button" disabled={generating} className={`${primary} w-full`} onClick={() => void rebuild()}>{generating ? 'أكتب وأراجع…' : 'ابنِ المقال الكامل'}</button></div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.articleCount}</strong><span className="text-[.76rem] text-soft">مقالًا يحلل أسلوبها</span></div>
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.avgSentenceWords || '—'}</strong><span className="text-[.76rem] text-soft">متوسط الجملة</span></div>
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.avgParagraphs || '—'}</strong><span className="text-[.76rem] text-soft">متوسط الفقرات</span></div>
              <div className="rounded-xl border border-accent/40 bg-accent/[.05] p-4"><strong className="block font-display text-2xl text-accent">{targetWords}</strong><span className="text-[.76rem] text-soft">عدد مقفول بلا زيادة أو نقص</span></div>
            </div>
            {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
            {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] text-soft">{error}</p>}
          </section>
          <CurrentEventsCard items={currentEvents} selected={selectedEventIds} loading={eventsLoading} onToggle={(id) => setSelectedEventIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id].slice(0, 3))} />
          <IdeaSuggestionsCard suggestions={articleSuggestions} onPick={pickSuggestion} />
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
              <Field label={`المقال — ${wordCount(bundle.body)} / ${targetWords} كلمة ${wordCount(bundle.body) === targetWords ? '✓' : '— يحتاج ضبط'}`}><textarea className={`${input} min-h-[500px] leading-loose`} value={bundle.body} onChange={(event) => updateBundle({ body: event.target.value })} /></Field>
            </div>
          </section>
          <aside className="grid content-start gap-5">
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">قفل الكلمات والأصالة</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className={`rounded-xl border p-4 ${wordCount(bundle.body) === targetWords ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{wordCount(bundle.body)}</strong><span className="text-[.72rem] text-soft">المطلوب {targetWords}</span></div>
                <div className={`rounded-xl border p-4 ${!similarity.repeated ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{similarity.originality}٪</strong><span className="text-[.72rem] text-soft">أصالة مقابل الأرشيف</span></div>
              </div>
              {similarity.matches[0] && <p className="mt-3 text-[.78rem] leading-relaxed text-soft">الأقرب موضوعيًا: «{similarity.matches[0].title}» — التشابه {Math.round(similarity.matches[0].score * 100)}٪.</p>}
              {(wordCount(bundle.body) !== targetWords || similarity.repeated) && <button type="button" disabled={generating} onClick={() => void rebuild()} className={`${ghost} mt-4 w-full`}>{generating ? 'أعيد التحرير…' : 'إعادة بناء بضبط حرفي'}</button>}
            </section>
            {bundle.event && <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">صلة راهنة موثقة</p><a href={bundle.event.url} target="_blank" rel="noreferrer" className="mt-3 block font-display text-[1rem] font-semibold leading-relaxed text-ink hover:text-accent">{bundle.event.title}</a><p className="mt-2 text-[.78rem] text-soft">{bundle.event.source}</p>{bundle.eventConnection && <p className="mt-3 text-[.8rem] leading-relaxed text-soft">{bundle.eventConnection}</p>}</section>}
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
          {bundle.socialPack ? (
            <PerfectSocialPackCard
              pack={bundle.socialPack}
              article={{ title: bundle.title, excerpt: bundle.excerpt }}
              busy={socialGenerating}
              onRegenerate={() => void requestSocialPack(bundle).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذّر بناء الحزمة.'))}
              onSave={saveWeeklyQueue}
              saveBusy={queueBusy}
            />
          ) : (
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">منظومة السوشيال</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">القوالب تُبنى من النسخة النهائية للمقال.</h2>
              <p className="mt-3 max-w-3xl text-[.84rem] leading-relaxed text-soft">لكل منصة صياغة مختلفة، مع كاروسيل وStories وReel وقوالب PNG من ثيم الموقع وربط راهن موثق عند وجود صلة حقيقية.</p>
              <button type="button" disabled={socialGenerating || wordCount(bundle.body) !== targetWords} onClick={() => void requestSocialPack(bundle).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذّر بناء الحزمة.'))} className={`${primary} mt-5`}>
                {socialGenerating ? 'أبني النصوص والتصاميم…' : 'ابنِ منظومة السوشيال'}
              </button>
              {wordCount(bundle.body) !== targetWords && <p className="mt-3 text-[.78rem] text-soft">أكمل ضبط المقال إلى {targetWords} كلمة أولًا.</p>}
            </section>
          )}

          <details className={`${card} group`}>
            <summary className="cursor-pointer list-none text-[.82rem] font-semibold text-soft transition-colors hover:text-accent">الحزمة الكلاسيكية الاحتياطية</summary>
            <div className="mt-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SocialCard title="X" text={bundle.social.x} /><SocialCard title="LinkedIn" text={bundle.social.linkedin} /><SocialCard title="Instagram" text={bundle.social.instagram} /><SocialCard title="Threads" text={bundle.social.threads} /><SocialCard title="WhatsApp / Broadcast" text={bundle.social.whatsapp} /><SocialCard title="النشرة البريدية" text={bundle.social.newsletter} /></div>
              <div className="mt-5"><WeeklyPackCard pack={weeklyPack} onSave={saveWeeklyQueue} busy={queueBusy} /></div>
            </div>
          </details>

          {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
          {error && <p className="rounded-xl border border-red-300/40 bg-wash px-4 py-3 text-[.84rem] text-soft">{error}</p>}
          <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">ما بعد الاعتماد</p><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['١','المقال لا يُقبل إلا بعد قفل العدد والأصالة.'],['٢','القوالب البصرية تُنزّل PNG جاهزة.'],['٣','مصدر الحدث يُحفظ مع الحزمة للمراجعة.'],['٤','الطابور يحتفظ بكل نسخة قبل النشر المباشر.']].map(([num, note]) => <div key={num} className="rounded-xl border border-hair bg-canvas p-4"><span className="font-display text-2xl text-accent">{num}</span><p className="mt-2 text-[.8rem] leading-relaxed text-soft">{note}</p></div>)}</div></section>
        </>
      )}
    </div>
  )

}