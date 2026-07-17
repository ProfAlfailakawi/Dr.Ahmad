import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { articleCats, books, papers } from '../../data'
import privateBookLinks from '../../data/private-book-links.json'
import bookTocLinks from '../../data/book-toc-links.json'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { useAdminAuth } from '../../lib/admin-auth'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import { beginAdminTask, setAdminTaskState } from '../../lib/admin-task-state'
import { articleSimilarityReport, editorialStyleProfile, ideaLab, relatedForIdea, representativeStyleSamples, strongestQuote, suggestStrongTitle } from '../../lib/intelligence'
import { buildSocialVisuals, compositionNameOf, detectVisualTopic, downloadSocialPng, renderSocialPng, visualTopicLabel, type SocialVisualTemplate, type VisualTopic } from '../../lib/social-templates'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-6 py-2.5 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const ghost = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'
const MIN_ARTICLE_WORDS = 350
const MAX_GENERATION_WORDS = 4000

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
  originalityBypassed?: boolean
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
  sections?: { label?: string; page?: number; pages?: string; keywords?: string[]; note?: string }[]
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

type SevenDayCampaign = {
  day: string
  platform: string
  goal: string
  copy: string
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
const fromArabicDigits = (value: string) => value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

function humanParagraphs(value: string, target: number) {
  const words = value.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const paragraphCount = Math.max(6, Math.min(24, Math.round(Math.max(MIN_ARTICLE_WORDS, target) / 70)))
  const chunks: string[] = []
  let start = 0
  for (let index = 0; index < paragraphCount; index += 1) {
    const remainingParagraphs = paragraphCount - index
    const remainingWords = words.length - start
    if (remainingParagraphs === 1) { chunks.push(words.slice(start).join(' ')); break }
    const ideal = start + Math.round(remainingWords / remainingParagraphs)
    const minimum = Math.max(start + 28, ideal - 12)
    const maximum = Math.min(words.length - (remainingParagraphs - 1) * 28, ideal + 12)
    let end = ideal
    for (let cursor = minimum; cursor <= maximum; cursor += 1) {
      if (/[.!؟…][”"']?$/.test(words[cursor - 1] || '')) { end = cursor; break }
    }
    end = Math.max(start + 1, Math.min(words.length, end))
    chunks.push(words.slice(start, end).join(' '))
    start = end
  }
  return chunks.filter(Boolean).join('\n\n')
}

function fitExactWords(value: string, target: number) {
  const clean = value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  let words = clean.split(/\s+/).filter(Boolean)
  const additions = [
    'والفكرة هنا ليست في مقاومة الجديد، بل في أن نمنحه معنى تربويًا يحفظ الإنسان قبل أن يحتفل بالأداة.',
    'حين يتقدم الإجراء على الغاية، يصبح التطوير أسرع، لكنه لا يصبح بالضرورة أعدل أو أعمق أو أكثر أثرًا.',
    'لهذا يحتاج القرار التعليمي إلى سؤال بسيط: ما الذي سيتغير فعليًا في وعي الطالب وفي حضور المعلم؟',
    'التقنية الجيدة لا تلغي العلاقة الإنسانية، بل تمنحها وقتًا أوسع للفهم والحوار والتأمل والمراجعة الصادقة.',
    'وكلما ازدادت قدرة النظام، ازدادت مسؤوليتنا عن الحدود والقيم واللغة التي تشرح للناس لماذا نستخدمه.',
    'لا نحتاج حماسًا أقل، بل نحتاج بصيرة أكبر توازن بين الإمكان والمصلحة وبين السرعة وكرامة المتعلم.',
    'المعيار ليس حجم الانبهار، وإنما جودة الأثر الذي يبقى بعد أن تهدأ الضجة وتتحول الفكرة إلى ممارسة يومية.',
    'ومن هنا يبدأ النقاش الحقيقي: تطوير يضيف للإنسان، لا تطوير يطلب من الإنسان أن يتكيف بصمت مع كل جديد.',
  ]
  let index = 0
  while (words.length < target) {
    const sentence = additions[index % additions.length].split(/\s+/).filter(Boolean)
    const remaining = target - words.length
    if (sentence.length <= remaining) words.push(...sentence)
    else words.push(...sentence.slice(0, remaining))
    index += 1
  }
  if (words.length > target) words = words.slice(0, target)
  const last = words.length - 1
  words[last] = words[last].replace(/[،؛:!.؟]+$/g, '') + '.'
  return humanParagraphs(words.join(' '), target)
}

function buildExactLocalArticle(idea: string, audience: string, angle: string, related: ArticleRecord[], target: number) {
  const base = buildArticleDraft(idea, audience, angle, related)
  const nearest = related.slice(0, 2).map((article) => article.title).join('، ')
  const extension = [
    `وإذا كانت هذه الفكرة قريبة من موضوعات سابقة مثل ${nearest || 'الإنسان والتعليم والتقنية'}، فإن زاويتها الجديدة ينبغي أن تبدأ من اللحظة الراهنة لا من تكرار الإجابات القديمة.`,
    `المطلوب ليس مقالًا يصف الظاهرة فقط، بل نصًا يختبر افتراضاتها، ويقارن بين الوعد الذي تعلنه والنتيجة التي يلمسها الناس في الواقع.`,
    `بالنسبة إلى ${audience}، تصبح المسؤولية أوضح: ترجمة الفكرة إلى قرار يمكن شرحه، وقياس أثره، والتراجع عنه حين يثبت أنه يختصر الإنسان بدل أن يخدمه.`,
    `وهنا تظهر قيمة ${angle}: فهي لا تضع التقنية في مواجهة التربية، بل تضع كلتيهما أمام معيار واحد هو المعنى الإنساني الذي نريد حمايته.`,
  ].join('\n\n')
  return fitExactWords(`${base}\n\n${extension}`, target)
}

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


function distinctEditorialTitle(candidate: string, requestedIdea: string, previousTitle: string, articles: ArticleRecord[], variation: number) {
  const cleanCandidate = candidate.trim().replace(/\s+/g, ' ')
  const forbidden = new Set([previousTitle, ...articles.map((article) => article.title)].map(normalize).filter(Boolean))
  if (cleanCandidate.length >= 12 && !forbidden.has(normalize(cleanCandidate))) return cleanCandidate

  const core = requestedIdea
    .replace(/[.!؟?،,:؛]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 9)
    .join(' ')
    .slice(0, 92) || 'الفكرة الجديدة'
  const alternatives = [
    `حين تصبح «${core}» سؤالًا تربويًا`,
    `ما الذي لا تقوله لنا «${core}»؟`,
    `بين بريق «${core}» وأثره في الإنسان`,
    `قبل أن نحتفل بـ«${core}»`,
    `«${core}»… من يدفع ثمن الاختصار؟`,
    `كيف نعيد الإنسان إلى قلب «${core}»؟`,
  ]
  for (let offset = 0; offset < alternatives.length; offset += 1) {
    const title = alternatives[(variation + offset) % alternatives.length]
    if (!forbidden.has(normalize(title))) return title
  }
  return `${alternatives[variation % alternatives.length]} — قراءة ${variation + 1}`
}

function uniqueArticleSlug(title: string, articles: ArticleRecord[]) {
  const base = makeSlug(title)
  const used = new Set(articles.map((article) => article.slug))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
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
  if (words < 350) draft += '\n\nوالأهم أن يبقى السؤال مفتوحًا: ما الأثر الإنساني الذي لا نريد أن نخسره ونحن نطارد الحلول السريعة؟'
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

function topicLanguage(topic: VisualTopic) {
  const profiles: Record<VisualTopic, {
    insight: string
    tension: string
    standard: string
    question: string
    hashtags: string[]
    directions: { layout: string; tone: string; headline: string; subline: string }[]
  }> = {
    ai: {
      insight: 'القيمة ليست في ذكاء الأداة وحده، بل في نوع التفكير الذي تتركه للإنسان.',
      tension: 'كلما أصبحت الإجابة أسرع، ازدادت حاجتنا إلى سؤال يختبر الفهم لا الانبهار.',
      standard: 'تقنية جيدة تعيد للإنسان قدرته على القرار، ولا تستبدلها عنه.',
      question: 'هل توسّع الأداة تفكيرنا… أم تختصره قبل أن يبدأ؟',
      hashtags: ['#الذكاء_الاصطناعي', '#تكنولوجيا_التعليم', '#الإنسان'],
      directions: [
        { layout: 'circuit', tone: 'الإنسان داخل التقنية', headline: 'الأداة ذكية… فهل التجربة إنسانية؟', subline: 'اقرأ أثر التقنية في التفكير والعلاقة والقرار.' },
        { layout: 'signal', tone: 'إشارة رقمية', headline: 'الإجابة الأسرع ليست دائمًا الأذكى.', subline: 'المعيار: ماذا بقي للمتعلم كي يكتشفه بنفسه؟' },
        { layout: 'orbit', tone: 'مدار القرار', headline: 'ضع الإنسان في المركز.', subline: 'ثم اجعل التقنية تدور حول حاجته، لا العكس.' },
        { layout: 'dark', tone: 'ما خلف الشاشة', headline: 'حين تختفي الأداة… ماذا بقي من الفهم؟', subline: 'هذا هو الاختبار الحقيقي.' },
      ],
    },
    education: {
      insight: 'التعليم لا يقاس بما قيل داخل الصف، بل بما استطاع المتعلم أن يفعله بعده.',
      tension: 'قد يمتلئ الدرس بالمحتوى ويبقى عقل الطالب خارج التجربة.',
      standard: 'المعيار ليس هدوء الصف؛ بل حركة الفهم داخله.',
      question: 'هل تعلّم الطالب… أم نجح فقط في المرور من المهمة؟',
      hashtags: ['#التعليم', '#التعلم', '#المعلم'],
      directions: [
        { layout: 'notebook', tone: 'من دفتر التعلّم', headline: 'ما الذي سيستطيع الطالب فعله؟', subline: 'ابدأ من الأثر، ثم صمّم الدرس.' },
        { layout: 'window', tone: 'نافذة الصف', headline: 'المحتوى ليس التجربة.', subline: 'التعلّم يحدث حين يشارك الطالب في بناء المعنى.' },
        { layout: 'question', tone: 'سؤال تربوي', headline: 'هل قسنا الحفظ أم الفهم؟', subline: 'الإجابة تظهر في التطبيق والتفسير والاختيار.' },
        { layout: 'timeline', tone: 'رحلة التعلّم', headline: 'قبل الدرس · أثناءه · بعده', subline: 'كل مرحلة تحتاج قرارًا مختلفًا من المعلم.' },
      ],
    },
    family: {
      insight: 'التربية علاقة يشعر فيها الطفل بالأمان قبل أن يسمع التوجيه.',
      tension: 'قد نقول الكلام الصحيح بنبرة تجعل الطفل لا يسمع إلا الخوف.',
      standard: 'الحدود الواضحة لا تحتاج إلى قسوة؛ تحتاج إلى ثبات وقرب.',
      question: 'هل وصل للطفل معنى الرسالة… أم وصل فقط انفعالنا؟',
      hashtags: ['#التربية', '#الأسرة', '#الطفل'],
      directions: [
        { layout: 'human', tone: 'قرب إنساني', headline: 'العلاقة قبل التعليمات.', subline: 'الطفل يتلقى نبرتنا قبل كلماتنا.' },
        { layout: 'dialogue', tone: 'حوار داخل البيت', headline: 'قل أقل… واسمع أكثر.', subline: 'الحوار لا يلغي الحدود؛ يجعلهـا مفهومة.' },
        { layout: 'window', tone: 'من زاوية الطفل', headline: 'كيف تبدو الرسالة من الجهة الأخرى؟', subline: 'تغيير الزاوية قد يغيّر الاستجابة.' },
        { layout: 'quote', tone: 'ومضة تربوية', headline: 'الأمان لا يفسد التربية.', subline: 'إنه المساحة التي تجعلها ممكنة.' },
      ],
    },
    research: {
      insight: 'الدليل لا يلغي الخبرة، لكنه يحميها من أن تتحول إلى حكم عام.',
      tension: 'الرقم قد يبدو حاسمًا وهو لا يجيب أصلًا عن السؤال الذي نطرحه.',
      standard: 'ابحث عن السؤال والمنهج والسياق قبل أن تنبهر بالنتيجة.',
      question: 'هل تقول الدراسة ما نعتقد أنها تقوله فعلًا؟',
      hashtags: ['#البحث_العلمي', '#المعرفة', '#التعليم'],
      directions: [
        { layout: 'research', tone: 'الدليل أولًا', headline: 'لا تبدأ بالنتيجة.', subline: 'ابدأ بالسؤال والمنهج والسياق.' },
        { layout: 'timeline', tone: 'مسار البحث', headline: 'سؤال · منهج · دليل · معنى', subline: 'القفز فوق أي حلقة يضعف الاستنتاج.' },
        { layout: 'split', tone: 'بين الرقم والتفسير', headline: 'البيانات لا تتكلم وحدها.', subline: 'نحن من يمنحها سياقًا وحدودًا.' },
        { layout: 'manifesto', tone: 'قاعدة بحثية', headline: 'الادعاء الكبير يحتاج دليلًا أكبر.', subline: 'والدليل الجيد يحتاج قراءة عادلة.' },
      ],
    },
    media: {
      insight: 'ما يصل إلى الناس ليس مجرد محتوى؛ إنه ترتيب خفي لما يستحق الانتباه.',
      tension: 'قد ينتشر الصوت لأنه مثير، لا لأنه دقيق أو نافع.',
      standard: 'الإعلام الجيد لا يكتفي بأن يجذب العين؛ يحترم عقل المتلقي.',
      question: 'ما الذي غاب عن المشهد بينما كنا نتابع ما تصدّر؟',
      hashtags: ['#الإعلام', '#الوعي_الرقمي', '#المحتوى'],
      directions: [
        { layout: 'dialogue', tone: 'خلف الحوار', headline: 'من يحدد السؤال… يحدد نصف الإجابة.', subline: 'انتبه إلى إطار القصة قبل تفاصيلها.' },
        { layout: 'signal', tone: 'إشارة وسط الضجيج', headline: 'الانتشار ليس دليلًا.', subline: 'قد يكون مجرد مكافأة لخوارزمية تعرف ما يثيرنا.' },
        { layout: 'event', tone: 'قراءة الحدث', headline: 'ماذا حدث؟ وماذا يعني؟', subline: 'الخبر بداية الفهم، لا نهايته.' },
        { layout: 'split', tone: 'المشهد وما وراءه', headline: 'ما نراه / ما لا نراه', subline: 'كل لقطة تستبعد شيئًا من الإطار.' },
      ],
    },
    future: {
      insight: 'المستقبل لا يأتي جاهزًا؛ يتشكل من القرارات الصغيرة التي نكررها اليوم.',
      tension: 'قد نلاحق الجديد وننسى أن نسأل أي مستقبل نريد أصلًا.',
      standard: 'الابتكار الحقيقي يوسع الخيارات ولا يضيق معنى الإنسان.',
      question: 'هل نصمم المستقبل… أم نتكيف فقط مع ما صممه غيرنا؟',
      hashtags: ['#المستقبل', '#الابتكار', '#القيادة'],
      directions: [
        { layout: 'horizon', tone: 'أفق القرار', headline: 'المستقبل يبدأ من قرار اليوم.', subline: 'ليس كل جديد اتجاهًا يستحق الاتباع.' },
        { layout: 'orbit', tone: 'خريطة الاحتمالات', headline: 'لا تتنبأ فقط… صمّم البدائل.', subline: 'الاستشراف الجيد يوسّع مساحة القرار.' },
        { layout: 'manifesto', tone: 'بيان للمستقبل', headline: 'ما لا نصممه بوعي… قد يُفرض علينا.', subline: 'ابدأ بالقيم قبل الأدوات.' },
        { layout: 'circuit', tone: 'بنية الغد', headline: 'التقنية تبني الممكن.', subline: 'والإنسان يقرر ما يستحق أن يصبح واقعًا.' },
      ],
    },
    human: {
      insight: 'كل فكرة تبدو عظيمة حتى نختبر أثرها في كرامة الإنسان وحريته ومعناه.',
      tension: 'قد ننجح في تحسين النظام ونفشل في حماية الشخص الذي يعيش داخله.',
      standard: 'اجعل الإنسان غاية التطوير، لا كلفة جانبية له.',
      question: 'ماذا بقي من الإنسان بعد أن أصبح كل شيء أكثر كفاءة؟',
      hashtags: ['#الإنسان', '#المعنى', '#الوعي'],
      directions: [
        { layout: 'human', tone: 'الإنسان أولًا', headline: 'لا تجعل الكفاءة تمحو المعنى.', subline: 'اسأل دائمًا: من يخدم من؟' },
        { layout: 'signature', tone: 'أثر شخصي', headline: 'الفكرة تُقاس بما تتركه في الإنسان.', subline: 'لا بما تعد به على الورق.' },
        { layout: 'quote', tone: 'وقفة إنسانية', headline: 'نحتاج ما يقرّبنا… لا ما ينجز عنا فقط.', subline: 'التقدم بلا علاقة قد يكون عزلة أسرع.' },
        { layout: 'window', tone: 'نافذة المعنى', headline: 'انظر إلى الشخص لا إلى المؤشر.', subline: 'الأرقام تصف جزءًا من التجربة.' },
      ],
    },
    general: {
      insight: 'الفكرة الجيدة لا تضيف ضجيجًا جديدًا؛ تمنحنا زاوية أوضح لما نعيشه.',
      tension: 'قد يبدو الأمر بسيطًا حتى نرى ما يغيّره في القرار اليومي.',
      standard: 'الأثر قبل الانبهار، والوضوح قبل كثرة الكلام.',
      question: 'ما الذي سيتغير فعلًا إذا أخذنا هذه الفكرة بجدية؟',
      hashtags: ['#فكرة', '#تعليم', '#وعي'],
      directions: [
        { layout: 'editorial', tone: 'زاوية تحريرية', headline: 'فكرة تستحق الوقوف.', subline: 'ليس لأنها جديدة فقط؛ بل لأنها تغيّر زاوية النظر.' },
        { layout: 'orbit', tone: 'مدار الفكرة', headline: 'ماذا يدور حول هذا المعنى؟', subline: 'انظر إلى السبب والأثر والقرار.' },
        { layout: 'question', tone: 'سؤال مفتوح', headline: 'ماذا لو نظرنا من جهة أخرى؟', subline: 'أحيانًا يبدأ التغيير من إعادة صياغة السؤال.' },
        { layout: 'signature', tone: 'توقيع الفكرة', headline: 'جملة قصيرة… وأثر أطول.', subline: 'احتفظ بما يغيّر القرار، واترك الباقي.' },
      ],
    },
  }
  return profiles[topic]
}

const rotateBy = <T,>(items: T[], offset: number) => {
  if (!items.length) return items
  const index = ((offset % items.length) + items.length) % items.length
  return [...items.slice(index), ...items.slice(0, index)]
}

function buildStandaloneSocialPack(idea: string, purpose: string, audience: string, event?: CurrentEvent | null, variation = 0): PerfectSocialPack {
  const thought = idea.trim() || 'فكرة تستحق التوقف عندها'
  const goal = purpose.trim() || 'لفت الانتباه إلى المعنى قبل الضجيج'
  const topic = detectVisualTopic(`${thought} ${goal} ${audience}`)
  const language = topicLanguage(topic)
  const hook = event ? `الحدث: ${event.title}` : ''
  const directionPool = [
    ...language.directions,
    { layout: 'question', tone: 'سؤال يفتح النقاش', headline: language.question, subline: thought },
    { layout: 'manifesto', tone: 'الخلاصة', headline: language.standard, subline: goal },
    { layout: 'window', tone: 'زاوية أخرى', headline: language.tension, subline: language.insight },
    { layout: 'signature', tone: 'جملة تبقى', headline: thought, subline: language.standard },
  ]
  const visualDirections = rotateBy(directionPool, variation).slice(0, 7)
  const carouselPool = [
    { kicker: visualTopicLabel(topic), title: thought, body: goal },
    { kicker: 'المعنى', title: language.insight, body: `بالنسبة إلى ${audience}، لا يكفي أن تكون الفكرة جذابة؛ يجب أن تغيّر طريقة الفهم أو القرار.` },
    { kicker: 'المفارقة', title: language.tension, body: 'هنا تبدأ المسافة بين ما يبدو ناجحًا وما يصنع أثرًا حقيقيًا.' },
    { kicker: 'المعيار', title: language.standard, body: 'استخدم هذا المعيار عند تقييم الفكرة في الواقع.' },
    { kicker: 'زاوية تطبيقية', title: 'حوّل الفكرة إلى قرار صغير يمكن ملاحظته.', body: `اسأل ${audience}: ما السلوك أو الاختيار الذي سيتغير بعد قراءة هذه الفكرة؟` },
    { kicker: 'سؤال مفتوح', title: language.question, body: 'لا تبحث عن إجابة سريعة؛ ابحث عن إجابة تستطيع الدفاع عنها في الواقع.' },
    { kicker: 'الخلاصة', title: goal, body: 'الفكرة التي تستحق النشر هي التي تترك للقارئ خطوة تالية واضحة.' },
  ]
  const carouselSlides = rotateBy(carouselPool.slice(1), variation).slice(0, 6)
  carouselSlides.unshift(carouselPool[0])

  return {
    x: [
      `${thought}\n\n${language.standard}`,
      `${language.question}\n\n${thought}`,
      `${language.tension}\n\n${goal}`,
    ],
    linkedin: [
      `${thought}\n\nأكتب هذه الفكرة لأن ${goal}. بالنسبة إلى ${audience}، ${language.insight}\n\n${language.question}`,
      `${hook ? `${hook}\n\n` : ''}${thought}\n\n${language.tension}\n\nالمعيار الذي أقترحه: ${language.standard}`,
    ],
    threads: [
      `${thought}\n\n${language.insight}`,
      `${language.question}\nهذه ليست خاتمة؛ بل بداية النقاش.` ,
      `${goal}.\n\n${language.standard}`,
    ],
    instagramCaptions: [
      `${thought}\n\n${goal}.\n\n${language.hashtags.join(' ')}`,
      `${hook ? `${hook}\n\n` : ''}${language.tension}\n\n${thought}`,
      `${language.question}\n\n${language.standard}`,
    ],
    carouselSlides,
    stories: [thought, language.tension, language.standard, language.question, goal],
    reelScript: `ابدأ بهذه الجملة: ${thought}. ثم اعرض المفارقة: ${language.tension}. وضّح المعيار: ${language.standard}. اختم بالسؤال: ${language.question}`,
    whatsapp: `${thought}\n\n${goal}.\n\n${language.question}`,
    newsletter: `${visualTopicLabel(topic)}\n\n${thought}\n\n${language.insight}\n\n${language.question}`,
    hashtags: language.hashtags,
    event: event || null,
    eventHook: event ? 'الربط بالحدث هنا يكشف معنى مرتبطًا بالفكرة، ولا يستخدم الحدث لمجرد اللحاق بالترند.' : '',
    visualDirections,
    generatedAt: new Date().toISOString(),
  }
}

function buildArticleSocialPack(articleBundle: Bundle, audience: string, event?: CurrentEvent | null, variation = 0): PerfectSocialPack {
  const bodySentences = articleBundle.body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 190)
  const base = buildStandaloneSocialPack(articleBundle.title, articleBundle.excerpt, audience, event, variation)
  const topic = detectVisualTopic(`${articleBundle.title} ${articleBundle.excerpt} ${articleBundle.body.slice(0, 1200)}`)
  const language = topicLanguage(topic)
  const selected = rotateBy(bodySentences, variation).slice(0, 4)
  const slides = [
    { kicker: visualTopicLabel(topic), title: articleBundle.title, body: articleBundle.excerpt },
    ...selected.map((sentence, index) => ({
      kicker: ['الفكرة', 'المفارقة', 'التحليل', 'الأثر'][index] || 'من المقال',
      title: sentence,
      body: index === selected.length - 1 ? language.standard : '',
    })),
    { kicker: 'السؤال', title: language.question, body: 'اقرأ المقال كاملًا لتتبع الفكرة من بدايتها إلى أثرها.' },
  ]
  return {
    ...base,
    x: [
      `${selected[0] || articleBundle.excerpt}\n\n${articleBundle.title}`,
      `${language.question}\n\n${articleBundle.title}`,
      `${language.standard}\n\n${articleBundle.excerpt}`,
    ],
    linkedin: [
      `${articleBundle.title}\n\n${articleBundle.excerpt}\n\n${language.question}`,
      `${selected.slice(0, 2).join('\n\n')}\n\n${language.standard}`,
    ],
    instagramCaptions: [
      `${articleBundle.title}\n\n${selected[0] || articleBundle.excerpt}\n\n${base.hashtags.join(' ')}`,
      `${language.tension}\n\n${articleBundle.excerpt}`,
      `${language.question}\n\nاقرأ المقال كاملًا في الموقع.`,
    ],
    carouselSlides: slides,
    newsletter: `${articleBundle.title}\n\n${articleBundle.excerpt}\n\n${selected.slice(0, 2).join('\n\n')}\n\n${language.question}`,
  }
}

function qualityGate(bundle: Bundle, articles: ArticleRecord[], targetWords: number, skipOriginality: boolean) {
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
    { key: 'duplicate', label: skipOriginality ? 'الأصالة: مستثناة بإقرار الكاتب' : `أصالة الفكرة (${similarity.originality}٪)`, ok: skipOriginality || (!similarity.repeated && !articles.some((article) => normalize(article.title) === normalize(bundle.title))) },
    { key: 'words', label: `الحد الأدنى: ${MIN_ARTICLE_WORDS} كلمة (الحالي ${words})`, ok: words >= MIN_ARTICLE_WORDS },
    { key: 'voice', label: 'قابلية صوتية', ok: words >= MIN_ARTICLE_WORDS && hasQuestion },
    { key: 'style-ai', label: 'مبني من بصمة أرشيفك', ok: Boolean(bundle.generatedBy) },
    { key: 'social', label: 'قابل للتحويل إلى حزمة سوشيال لاحقًا', ok: socialOk },
  ]
  return {
    checks,
    ready: checks.every((check) => check.ok),
    blocking: checks.filter((check) => !check.ok).map((check) => check.label),
  }
}

function sentenceStats(text = '') {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!؟])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 12)
  const counts = sentences.map((sentence) => wordCount(sentence))
  const average = counts.length ? Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length) : 0
  return { sentences, average }
}

function styleReview(bundle: Bundle, style: ReturnType<typeof editorialStyleProfile>) {
  const body = bundle.body || ''
  const words = wordCount(body)
  const paragraphs = body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
  const stats = sentenceStats(body)
  const avgSentence = Number(style.avgSentenceWords || 0)
  const sentenceGap = avgSentence ? Math.abs(stats.average - avgSentence) : 0
  const paragraphGap = style.avgParagraphs ? Math.abs(paragraphs.length - Number(style.avgParagraphs)) : 0
  const anchors = ['الإنسان', 'الطالب', 'المعلم', 'المعنى', 'الوعي', 'القيمة', 'الخوف', 'التعليم'].filter((word) => body.includes(word))
  const connectors = (style.connectors || []).map((item) => item.term).filter((term) => body.includes(term)).slice(0, 5)
  const weakPhrases = [
    'في عالمنا اليوم',
    'لا شك أن',
    'مما لا شك فيه',
    'في الختام',
    'من الجدير بالذكر',
    'يلعب دورًا حيويًا',
    'ثورة غير مسبوقة',
  ].filter((phrase) => body.includes(phrase))
  const hasHumanOpening = /^(قد يبدو|حين|عندما|ليست|ليس|في|أمام|داخل|هل|كيف|لماذا|ماذا)/.test(body.trim())
  const checks = [
    { label: 'افتتاحية من عالم الإنسان لا من تعريف مدرسي', ok: hasHumanOpening, note: hasHumanOpening ? 'البداية قريبة من روح المقالات.' : 'جرّب أن تبدأ بمشهد أو مفارقة.' },
    { label: `متوسط الجملة قريب من بصمتك (${style.avgSentenceWords || '—'} كلمة)`, ok: !avgSentence || sentenceGap <= 7, note: stats.average ? `المقال الحالي: ${stats.average} كلمة للجملة.` : 'لا توجد جمل كافية للحكم.' },
    { label: `تقسيم الفقرات قريب من عادتك (${style.avgParagraphs || '—'} فقرات)`, ok: !style.avgParagraphs || paragraphGap <= 4, note: `${paragraphs.length || 0} فقرات في النص الحالي.` },
    { label: 'حضور مفرداتك الإنسانية', ok: anchors.length >= 3, note: anchors.length ? anchors.join('، ') : 'أضف أثر الفكرة في الإنسان/الطالب/المعلم.' },
    { label: 'روابط انتقال طبيعية في التحليل', ok: connectors.length >= 2, note: connectors.length ? connectors.join('، ') : 'النص يحتاج مفاصل انتقال أكثر.' },
    { label: 'خلو من عبارات AI العامة', ok: weakPhrases.length === 0, note: weakPhrases.length ? weakPhrases.join('، ') : 'لا توجد عبارات آلية ظاهرة.' },
    { label: 'طول مريح للمقال الفكري', ok: words >= MIN_ARTICLE_WORDS, note: `${words} كلمة.` },
  ]
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100)
  return {
    score,
    label: score >= 86 ? 'قريب جدًا من بصمتك' : score >= 70 ? 'قريب… يحتاج تهذيبًا بسيطًا' : 'بعيد عن روحك ويحتاج مراجعة',
    checks,
  }
}

function buildSevenDayCampaign(bundle: Bundle, pack: WeeklyPack): SevenDayCampaign[] {
  const quote = pack.quote || 'الفكرة القوية تبدأ حين نرى الإنسان قبل الأداة.'
  return [
    {
      day: 'اليوم ١',
      platform: 'LinkedIn',
      goal: 'إطلاق الفكرة بهدوء',
      copy: pack.linkedin[0],
    },
    {
      day: 'اليوم ٢',
      platform: 'X',
      goal: 'سؤال قصير يفتح النقاش',
      copy: `سؤال اليوم:\n${pack.question}`,
    },
    {
      day: 'اليوم ٣',
      platform: 'Instagram Carousel',
      goal: 'تبسيط الفكرة بصريًا',
      copy: `${bundle.title}\n\n١. الفكرة ليست في الأداة.\n٢. الأثر الحقيقي في الإنسان.\n٣. التعليم علاقة قبل أن يكون إجراء.\n٤. السؤال: ماذا يبقى في الطالب بعد التجربة؟`,
    },
    {
      day: 'اليوم ٤',
      platform: 'LinkedIn',
      goal: 'ربط المقال بالأرشيف والخبرة',
      copy: pack.linkedin[1],
    },
    {
      day: 'اليوم ٥',
      platform: 'X',
      goal: 'اقتباس قابل للمشاركة',
      copy: quote,
    },
    {
      day: 'اليوم ٦',
      platform: 'Instagram Story',
      goal: 'تصويت أو تفاعل سريع',
      copy: `هل ترى أن «${bundle.title}» قضية تقنية أم إنسانية أولًا؟\n\n[تقنية]\n[إنسانية]\n[الاثنان معًا]`,
    },
    {
      day: 'اليوم ٧',
      platform: 'Newsletter / WhatsApp',
      goal: 'إغلاق الحملة ودعوة للقراءة',
      copy: `لمن فاته النقاش هذا الأسبوع:\n${bundle.title}\n\n${bundle.excerpt}\n\nاقرأ المقال كاملًا، ثم اسأل: ما القرار الصغير الذي يمكن أن يتغير غدًا؟`,
    },
  ]
}

function privateBookMatches(bundle: Bundle, privateLinks: PrivateBookLink[]) {
  const text = normalize(`${bundle.title} ${bundle.excerpt} ${bundle.body} ${bundle.cat}`)
  const tocBooks = (bookTocLinks as { books?: PrivateBookLink[] }).books || []
  const publicSlugs = new Set([
    ...bundle.related.map((item) => item.slug),
    ...bundle.books.map((item) => item.slug),
  ])
  return privateLinks
    .map((book) => {
      const tocBook = tocBooks.find((candidate) => normalize(candidate.title) === normalize(book.title))
      const sections = [...(book.sections || []), ...(tocBook?.sections || [])]
      const termScore = (book.topTerms || []).reduce((sum, term) => sum + (text.includes(normalize(term)) ? 1 : 0), 0)
      const articleScore = (book.relatedPublicArticles || []).reduce((sum, article) => sum + (publicSlugs.has(article.slug) ? 2 : 0), 0)
      const linkedBookScore = book.linkedPublicBook && publicSlugs.has(book.linkedPublicBook.slug) ? 3 : 0
      const score = termScore + articleScore + linkedBookScore
      const section = sections
        .map((candidate) => ({
          ...candidate,
          score: (candidate.keywords || []).reduce((sum, keyword) => sum + (text.includes(normalize(keyword)) ? 1 : 0), 0)
            + (text.includes(normalize(candidate.label || '')) ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)[0] || null
      return { ...book, score, section }
    })
    .filter((book) => book.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
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
    : `لا توجد مادة رادار منشورة اليوم. التعليق الجاهز:\n\n${bundle.title}\n\nقد يبدو الموضوع تقنيًا، لكنه في التعليم سؤال إنساني أولًا: ماذا يتغير في الطالب والمعلم حين تتغير الأداة؟`
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
  const relatedPapers = relatedForIdea(`${idea} ${angle}`, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, 3)
  const body = buildArticleDraft(idea, audience, angle, related)
  const excerpt = clampExcerpt(body.split('\n\n')[0])
  const partial = { title, excerpt, body }
  const quality = [
    wordCount(body) >= 350 && wordCount(body) <= 450 ? `عدد الكلمات مناسب: ${wordCount(body)} كلمة.` : `عدد الكلمات يحتاج ضبطًا: ${wordCount(body)} كلمة.`,
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

function ArchiveWakeCard({
  articles,
  onPick,
}: {
  articles: ArticleRecord[]
  onPick: (title: string, idea: string) => void
}) {
  const now = new Date()
  const month = now.getMonth() + 1
  const seasonal =
    month >= 5 && month <= 7 ? 'الاختبارات والتخرج وتسجيل الجامعة وبداية القرار الأكاديمي'
      : month >= 8 && month <= 10 ? 'العودة للدراسة والمعلم والطالب والبيت'
        : month >= 11 || month <= 2 ? 'التقنية والهوية والأسرة في نهاية وبداية العام'
          : 'التعليم والتقنية والإنسان في منتصف العام'
  const candidates = relatedForIdea(seasonal, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 12)
    .filter((article) => Number(article.iso?.slice(0, 4) || 3000) <= now.getFullYear() - 2)
    .slice(0, 4)

  if (!candidates.length) return null
  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-[.76rem] font-semibold uppercase text-accent">أرشيف يستيقظ</span>
          <span className="mt-1 block font-display text-xl font-semibold text-ink">مقال قديم مناسب للحظة الحالية.</span>
          <span className="mt-1 block text-[.82rem] leading-relaxed text-soft">اقتراح موسمي هادئ لإعادة نشر فكرة من أرشيفك، لا إضافة محتوى جديد.</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 grid gap-3 border-t border-hair pt-5 md:grid-cols-2">
        {candidates.map((article) => {
          const year = article.iso?.slice(0, 4)
          const quote = strongestQuote(`${article.excerpt || ''} ${article.body || ''}`)
          const idea = `إعادة قراءة مقال «${article.title}» في ضوء ${seasonal}. ${quote}`
          return (
            <button
              key={article.slug}
              type="button"
              onClick={() => onPick(`إعادة قراءة: ${article.title}`, idea)}
              className="rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent"
            >
              <span className="block text-[.72rem] font-semibold text-accent">{year ? `من أرشيف ${year}` : 'من الأرشيف'}</span>
              <span className="mt-1 block font-display text-[1.05rem] font-semibold leading-relaxed text-ink">{article.title}</span>
              <span className="mt-2 block text-[.82rem] leading-relaxed text-soft">{article.excerpt || quote}</span>
            </button>
          )
        })}
      </div>
    </details>
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

function StyleEditorCard({ review }: { review: ReturnType<typeof styleReview> }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">المحرر الذي يعرفك</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{review.label}</h2>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/[.06] px-4 py-2 font-display text-xl text-accent">{review.score}٪</span>
      </div>
      <div className="mt-4 grid gap-2">
        {review.checks.map((check) => (
          <div key={check.label} className="rounded-xl border border-hair bg-canvas px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[.84rem] font-semibold text-ink">{check.label}</span>
              <span className={`text-[.78rem] font-semibold ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : 'راجع'}</span>
            </div>
            <p className="mt-1 text-[.76rem] leading-relaxed text-soft">{check.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function PrivateBookMemoryCard({ matches }: { matches: ReturnType<typeof privateBookMatches> }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة الكتب الخاصة</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">ربط داخلي لا يظهر للناس.</h2>
        </div>
        <span className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft">خاص باللوحة فقط</span>
      </div>
      <p className="mt-3 text-[.82rem] leading-relaxed text-soft">
        لا يعرض PDF ولا نصوص الكتب. يظهر لك فقط أن المسودة قريبة من كتاب أو محور خاص حتى تستثمر أرشيفك بأمان.
      </p>
      {matches.length ? (
        <div className="mt-4 grid gap-2">
          {matches.map((book) => (
            <div key={book.title} className="rounded-xl border border-hair bg-canvas px-4 py-3">
              <p className="font-semibold leading-relaxed text-ink">قريب من «{book.title}»</p>
              <p className="mt-1 text-[.76rem] leading-relaxed text-soft">
                {book.section
                  ? `${book.section.label || 'محور خاص'}${book.section.pages ? ` · الصفحات ${book.section.pages}` : book.section.page ? ` · ص ${book.section.page}` : ''}`
                  : 'محور عام من الكتاب'}
                {book.section?.keywords?.length ? ` · ${book.section.keywords.slice(0, 4).join('، ')}` : ''}
              </p>
              {book.linkedPublicBook && (
                <p className="mt-1 text-[.74rem] text-soft">يرتبط أيضًا بالكتاب المنشور: {book.linkedPublicBook.title}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] leading-relaxed text-soft">
          لم أجد رابطًا واثقًا مع الكتب الخاصة لهذه المسودة بعد. زِد وضوح الفكرة أو شغّل ذاكرة الكتب بعد إضافة PDFs جديدة.
        </p>
      )}
    </section>
  )
}

function WeeklyPackCard({
  pack,
  campaign,
  onSave,
  busy,
}: {
  pack: WeeklyPack
  campaign: SevenDayCampaign[]
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
    ...campaign.map((item) => `${item.day} · ${item.platform}\n${item.goal}\n${item.copy}`),
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">حزمة الأسبوع</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">محتوى أسبوع كامل ينتظر موافقتك.</h2>
          <p className="mt-2 max-w-2xl text-[.82rem] leading-relaxed text-soft">غرفة حملات هادئة: لا تنشر شيئًا وحدها، لكنها ترتّب المقال على سبعة أيام حتى توافق.</p>
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
      <details className="mt-5 rounded-2xl border border-hair bg-canvas p-4">
        <summary className="cursor-pointer list-none font-semibold text-ink">غرفة حملة ٧ أيام</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {campaign.map((item) => (
            <div key={`${item.day}-${item.platform}`} className="rounded-xl border border-hair bg-wash p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-accent">{item.day} · {item.platform}</p>
                <CopyButton value={item.copy} />
              </div>
              <p className="mt-2 text-[.76rem] text-soft">{item.goal}</p>
              <p className="mt-3 whitespace-pre-wrap text-[.82rem] leading-relaxed text-ink">{item.copy}</p>
            </div>
          ))}
        </div>
      </details>
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
  const kuwait = items.filter((item) => /kuwait|kuna|times kuwait|الكويت/i.test(`${item.source} ${item.title}`))
  const rest = items.filter((item) => !kuwait.some((local) => local.id === item.id))
  const shown = [...kuwait, ...rest].slice(0, 8)
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">أحداث الساعة</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">يربط الحدث فقط عندما يخدم الفكرة.</h2>
          <p className="mt-2 text-[.8rem] leading-relaxed text-soft">رادار الكويت يظهر أولًا عند وجود مادة محلية موثوقة، ثم تأتي المصادر العالمية.</p>
        </div>
        <span className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft">{loading ? 'أحدّث المصادر…' : selected.length ? `${selected.length} محدد` : 'اختيار ذكي'}</span>
      </div>
      {items.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {shown.map((item) => {
            const active = selected.includes(item.id)
            const local = kuwait.some((candidate) => candidate.id === item.id)
            return (
              <article key={item.id} className={`rounded-2xl border p-4 text-right transition-colors ${active ? 'border-accent bg-accent/[.06]' : 'border-hair bg-canvas hover:border-accent'}`}>
                <button type="button" onClick={() => onToggle(item.id)} className="block w-full text-right">
                  <span className="flex items-center justify-between gap-2 text-[.7rem] font-semibold text-accent"><span>{local ? `رادار الكويت · ${item.source}` : item.source}</span><span>{item.ageHours != null ? `قبل ${item.ageHours} س` : 'حديث'}</span></span>
                  <span className="mt-2 line-clamp-2 block font-display text-[.96rem] font-semibold leading-[1.55] text-ink">{item.title}</span>
                  <span className="mt-3 block text-[.72rem] text-soft">{active ? 'مثبّت للربط ✓' : 'اضغط لتثبيته'}</span>
                </button>
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[.7rem] font-semibold text-accent hover:underline">فتح المصدر ↗</a>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">{loading ? 'أقرأ المصادر الموثوقة الآن…' : 'لا يوجد حدث راهن مناسب لهذه الفكرة، وهذا أفضل من ربط مصطنع.'}</p>
      )}
    </section>
  )
}

function standaloneVisualTemplates(idea: string, purpose: string): SocialVisualTemplate[] {
  const title = idea.trim() || 'الفكرة لا تحتاج مقالاً كي تستحق النشر.'
  const body = purpose.trim() || 'اكتب الجملة، واختر القالب، ثم نزّل الصورة الجاهزة للنشر.'
  const topic = detectVisualTopic(`${title} ${body}`)
  const shared = { platform: 'instagram' as const, width: 1080, height: 1350, topic, title, body, footer: 'د. أحمد حسين الفيلكاوي · dr-alfailakawi.com' }
  return [
    { ...shared, id: `standalone-midad-${title}`, format: 'منشور مستقل 1080×1350', layout: 'orbit', kicker: 'المداد' },
    { ...shared, id: `standalone-layl-${title}`, format: 'منشور مستقل 1080×1350', layout: 'dark', kicker: 'الليل' },
    { ...shared, id: `standalone-jarida-${title}`, format: 'منشور مستقل 1080×1350', layout: 'editorial', kicker: 'الجريدة' },
    { ...shared, id: `standalone-sharit-${title}`, format: 'منشور مستقل 1080×1350', layout: 'split', kicker: 'الشريط' },
    { ...shared, id: `standalone-mishkat-${title}`, format: 'منشور مستقل 1080×1350', layout: 'arch', kicker: 'المشكاة' },
    { ...shared, id: `standalone-tawqee-${title}`, format: 'منشور مستقل 1080×1350', layout: 'signature', kicker: 'التوقيع' },
  ]
}

function VisualTemplateCard({ template }: { template: SocialVisualTemplate }) {
  /* المعاينة هي الصورة الحقيقية المرسومة بمحرك «الطبعة الفاخرة» نفسه —
     ما تراه هنا هو ملف PNG الذي سيُنزَّل حرفياً، لا تقليد CSS تقريبي. */
  const [previewUrl, setPreviewUrl] = useState('')
  const [renderError, setRenderError] = useState('')
  const [renderNonce, setRenderNonce] = useState(0)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setPreviewUrl('')
    setRenderError('')
    void renderSocialPng(template)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((reason) => {
        /* الفشل الصامت («أرسم القالب…» للأبد) حرمنا من معرفة السبب عند الدكتور —
           الآن البطاقة تنطق بالخطأ وتعرض إعادة المحاولة */
        if (active) setRenderError(reason instanceof Error ? reason.message : 'تعذّر رسم القالب في هذا المتصفح')
      })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [template, renderNonce])
  return (
    <div className="overflow-hidden rounded-2xl border border-hair bg-canvas">
      <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: `${template.width} / ${template.height}` }}>
        {previewUrl
          ? <img src={previewUrl} alt={template.title} className="h-full w-full object-cover" />
          : renderError
            ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-[.72rem] leading-relaxed text-soft">{renderError}</p>
                <button type="button" onClick={() => setRenderNonce((n) => n + 1)} className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-accent transition-colors hover:border-accent">إعادة الرسم</button>
              </div>
            )
            : <div className="flex h-full w-full items-center justify-center text-[.74rem] text-soft">أرسم القالب…</div>}
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="text-[.72rem] text-soft"><span className="font-semibold text-accent">{compositionNameOf(template.layout)}</span> · {template.format}</span>
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
            <p className="text-[.76rem] font-semibold uppercase text-accent">منظومة السوشيال · {visuals.topicLabel}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">كل موضوع يتعرّف على لغته البصرية.</h2>
            <p className="mt-2 text-[.82rem] leading-relaxed text-soft">يقرأ النظام الفكرة أولًا، ثم يختار تكوينات تناسب التعليم أو التقنية أو الأسرة أو البحث أو الإعلام أو المستقبل — مع تنويع جديد في كل مرة.</p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visuals.instagram.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
        </div>
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">Story وLinkedIn وX</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <VisualTemplateCard template={visuals.linkedin} />
          <VisualTemplateCard template={visuals.x} />
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

export function PublishingStudio({ articles, onTransferToArticles }: { articles: ArticleRecord[]; onTransferToArticles?: (slug: string) => void | Promise<void> }) {
  const { isAdmin, refresh, user } = useAdminAuth()
  const [richArticles, setRichArticles] = useState<ArticleRecord[]>(articles)
  const [radar, setRadar] = useState<RadarItem[]>([])
  const [idea, setIdea] = useState('الذكاء الاصطناعي في التعليم')
  const [audience, setAudience] = useState('المعلمين والقيادات التعليمية')
  const [angle, setAngle] = useState('الأثر الإنساني قبل بريق الأداة')
  const [bundle, setBundle] = useState<Bundle>(() => buildBundle(idea, audience, angle, articles))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [queueBusy, setQueueBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [socialGenerating, setSocialGenerating] = useState(false)
  const [targetWords, setTargetWords] = useState(MIN_ARTICLE_WORDS)
  const [targetWordsInput, setTargetWordsInput] = useState(String(MIN_ARTICLE_WORDS))
  const generationRun = useRef(0)
  const socialVariation = useRef(0)
  const pulseVariation = useRef(0)
  const [skipOriginality, setSkipOriginality] = useState(false)
  const [currentEvents, setCurrentEvents] = useState<CurrentEvent[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [view, setView] = useState<'idea' | 'write' | 'review' | 'distribution' | 'pulse'>('idea')
  const [pulseIdea, setPulseIdea] = useState('')
  const [pulsePurpose, setPulsePurpose] = useState('فكرة قصيرة تستحق أن تُقال الآن')
  const [pulsePreviewCopy, setPulsePreviewCopy] = useState({ idea: '', purpose: 'فكرة قصيرة تستحق أن تُقال الآن' })
  const [pulseAudience, setPulseAudience] = useState('الجمهور العام')
  const [pulsePack, setPulsePack] = useState<PerfectSocialPack | null>(null)
  const [pulseBusy, setPulseBusy] = useState(false)
  const [pulseQueueBusy, setPulseQueueBusy] = useState(false)
  const [pulseEvents, setPulseEvents] = useState<CurrentEvent[]>([])
  const [pulseSelectedEventIds, setPulseSelectedEventIds] = useState<string[]>([])
  const [pulseEventsLoading, setPulseEventsLoading] = useState(false)

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
  const gate = useMemo(() => qualityGate(bundle, richArticles, targetWords, skipOriginality), [bundle, richArticles, skipOriginality, targetWords])
  const similarity = useMemo(() => articleSimilarityReport(bundle.title, bundle.body, richArticles), [bundle.title, bundle.body, richArticles])
  const weeklyPack = useMemo(() => buildWeeklyPack(bundle, richArticles, radar), [bundle, radar, richArticles])
  const styleInsight = useMemo(() => styleReview(bundle, style), [bundle, style])
  const sevenDayCampaign = useMemo(() => buildSevenDayCampaign(bundle, weeklyPack), [bundle, weeklyPack])
  const privateMemoryMatches = useMemo(() => privateBookMatches(bundle, privateLinks), [bundle, privateLinks])
  const articleSuggestions = useMemo(() => suggestArticleIdeas(richArticles, radar, privateLinks), [privateLinks, radar, richArticles])
  const pulseTemplateShowcase = useMemo(() => standaloneVisualTemplates(pulsePreviewCopy.idea, pulsePreviewCopy.purpose), [pulsePreviewCopy])

  useEffect(() => {
    const timer = window.setTimeout(() => setPulsePreviewCopy({ idea: pulseIdea, purpose: pulsePurpose }), 450)
    return () => window.clearTimeout(timer)
  }, [pulseIdea, pulsePurpose])

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

  const requestSocialPack = async (articleBundle: Bundle, announce = true) => {
    const task = announce ? beginAdminTask('بناء منظومة التوزيع') : null
    setSocialGenerating(true)
    setError('')
    socialVariation.current += 1
    const variation = socialVariation.current
    const selectedEvent = selectedEventIds.length
      ? currentEvents.find((item) => item.id === selectedEventIds[0]) || articleBundle.event || null
      : articleBundle.event || null
    try {
      let socialPack: PerfectSocialPack | null = null
      if (user) {
        try {
          const token = await user.getIdToken()
          socialPack = await adminAiRequest<PerfectSocialPack>('/api/ai/social-pack', {
            title: articleBundle.title,
            excerpt: articleBundle.excerpt,
            body: articleBundle.body,
            audience,
            styleProfile: style,
            selectedEventIds,
          }, token)
        } catch {
          socialPack = null
        }
      }
      if (!socialPack) {
        socialPack = buildArticleSocialPack(articleBundle, audience, selectedEvent, variation)
        setNotice('بُنيت منظومة التوزيع محليًا وبكامل القوالب؛ لا تتوقف إذا تعذر اتصال الذكاء الاصطناعي ✓')
      } else {
        const local = buildArticleSocialPack(articleBundle, audience, selectedEvent, variation)
        socialPack = {
          ...local,
          ...socialPack,
          carouselSlides: socialPack.carouselSlides?.length ? socialPack.carouselSlides : local.carouselSlides,
          stories: socialPack.stories?.length ? socialPack.stories : local.stories,
          visualDirections: socialPack.visualDirections?.length ? socialPack.visualDirections : local.visualDirections,
          hashtags: socialPack.hashtags?.length ? socialPack.hashtags : local.hashtags,
          event: socialPack.event || selectedEvent,
        }
        setNotice('بُنيت منظومة توزيع جديدة، وتعرّفت القوالب على موضوع المقال ✓')
      }
      setBundle((previous) => previous.slug === articleBundle.slug ? { ...previous, socialPack } : previous)
      task?.needsInput('منظومة التوزيع جاهزة للمراجعة')
      return socialPack
    } catch (reason) {
      task?.fail(reason, 'تعذّر بناء منظومة التوزيع')
      throw reason
    } finally {
      setSocialGenerating(false)
    }
  }

  useEffect(() => {
    if (view !== 'distribution' || bundle.socialPack || !bundle.title.trim()) return
    const fallback = buildArticleSocialPack(bundle, audience, bundle.event || null, socialVariation.current)
    setBundle((previous) => previous.slug === bundle.slug && !previous.socialPack ? { ...previous, socialPack: fallback } : previous)
  }, [audience, bundle, view])

  const rebuild = async (override?: { title?: string; angle?: string }) => {
    const task = beginAdminTask('توليد المقال')
    setError('')
    setNotice('')
    setGenerating(true)
    try {
      const parsedTarget = Number(fromArabicDigits(targetWordsInput).replace(/[^0-9]/g, ''))
      const requestedTarget = Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : targetWords))
      setTargetWords(requestedTarget)
      setTargetWordsInput(String(requestedTarget))
      generationRun.current += 1
      const ok = isAdmin || await refresh()
      if (!ok || !user) throw new Error('جلسة المشرف تحتاج تحديثًا. سجّل خروجك وادخل من جديد.')
      const token = await user.getIdToken()
      const requestedIdea = override?.title ? `${override.title}. ${override.angle || ''}` : idea
      const rawAngle = override?.angle || angle
      const ideaPreflight = articleSimilarityReport(requestedIdea, rawAngle, richArticles)
      const requestedAngle = !skipOriginality && ideaPreflight.repeated && ideaPreflight.matches[0]
        ? `${rawAngle}. اكتب من زاوية مغايرة بوضوح لمقال «${ideaPreflight.matches[0].title}»، وركّز على ما تغيّر الآن.`
        : rawAngle
      const nearest = relatedForIdea(`${requestedIdea} ${requestedAngle}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 45)
      const seen = new Set(nearest.map((article) => article.slug))
      const archive = [...nearest, ...richArticles.filter((article) => !seen.has(article.slug))].slice(0, 180)
      let generated: PerfectArticleResponse
      try {
        generated = await adminAiRequest<PerfectArticleResponse>('/api/ai/perfect-article', {
          idea: requestedIdea,
          audience,
          angle: requestedAngle,
          targetWords: requestedTarget,
          skipOriginality,
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
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : ''
        if (/جلسة|صلاحية|Unauthenticated|Admin access/i.test(message)) throw reason
        const initialTitle = suggestStrongTitle(requestedIdea)
        const localBody = buildExactLocalArticle(requestedIdea, audience, requestedAngle, nearest, requestedTarget)
        const localReport = articleSimilarityReport(initialTitle, localBody, richArticles)
        const title = !skipOriginality && localReport.repeated ? `${initialTitle}… وما الذي تغيّر الآن؟` : initialTitle
        const finalReport = articleSimilarityReport(title, localBody, richArticles)
        generated = {
          title,
          cat: chooseCat(`${requestedIdea} ${requestedAngle}`),
          excerpt: clampExcerpt(localBody.split(/(?<=[.!؟])\s+/).slice(0, 2).join(' ')),
          body: localBody,
          angle: requestedAngle,
          event: selectedEventIds.length ? currentEvents.find((item) => item.id === selectedEventIds[0]) || null : null,
          eventConnection: selectedEventIds.length ? 'استُخدم الحدث كمدخل راهن من دون أن يطغى على الفكرة الأصلية.' : '',
          originalityNote: 'بُني محليًا من بصمة الأرشيف بعد فحص أقرب الزوايا السابقة.',
          exactWords: requestedTarget,
          originality: finalReport.originality,
          similarity: finalReport.matches.slice(0, 5),
          modelValidated: false,
        }
      }
      const generatedWords = wordCount(generated.body)
      if (generatedWords < requestedTarget) {
        generated = { ...generated, body: fitExactWords(generated.body, requestedTarget), exactWords: requestedTarget }
      } else {
        generated = { ...generated, body: humanParagraphs(generated.body, generatedWords), exactWords: generatedWords }
      }
      generated = {
        ...generated,
        title: distinctEditorialTitle(generated.title, requestedIdea, bundle.title, richArticles, generationRun.current),
      }
      const related = relatedForIdea(`${generated.title} ${generated.excerpt}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 5)
      const relatedBooks = relatedForIdea(`${generated.title} ${generated.excerpt}`, books, (book) => book.desc || '', 3)
      const relatedPapers = relatedForIdea(`${generated.title} ${generated.excerpt}`, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, 3)
      const partial = { title: generated.title, excerpt: generated.excerpt, body: generated.body }
      const nextBundle: Bundle = {
        ...partial,
        slug: uniqueArticleSlug(generated.title, richArticles),
        cat: generated.cat,
        social: buildSocial(partial, audience),
        related: related.map(({ slug, title, iso }) => ({ slug, title, iso })),
        books: relatedBooks.map(({ slug, title }) => ({ slug, title })),
        papers: relatedPapers.map(({ slug, title }) => ({ slug, title })),
        quality: [
          `الحد الأدنى 350 كلمة؛ النسخة المولّدة الآن ${generated.exactWords} كلمة ويمكنك زيادتها بحرية.`,
          `درجة الأصالة مقابل الأرشيف: ${generated.originality}٪.`,
          `تعلّم من ${style.articleCount} مقالًا ومن ${styleSamples.length} عينات أسلوب متنوعة.`,
          generated.event ? `ربط راهن موثّق: ${generated.event.source} — ${generated.event.title}` : 'لم يُفرض حدث راهن لأن الصلة لم تكن عضوية.',
          skipOriginality ? 'استُثني فحص الأصالة بإقرار الكاتب لأن النص أو فكرته أصلية له.' : (generated.originalityNote || 'اجتاز فحص عدم تكرار الزاوية والحجة.'),
          'قوالب السوشيال تُبنى منفصلة لكل منصة لمنع النسخ المتكرر.',
        ],
        exactTarget: requestedTarget,
        originality: generated.originality,
        originalityBypassed: skipOriginality,
        similarity: generated.similarity,
        event: generated.event || null,
        eventConnection: generated.eventConnection || '',
        generatedBy: generated.modelValidated ? 'archive-ai' : 'local-fallback',
        socialPack: null,
      }
      setBundle(nextBundle)
      setIdea(override?.title || idea)
      if (override?.angle) setAngle(override.angle)
      setNotice(`بُني المقال بطول مبدئي ${generated.exactWords} كلمة. الحد الأدنى 350، ويمكنك الكتابة حتى 4000 كلمة وأكثر يدويًا${skipOriginality ? '، مع تسجيل استثناء الأصالة بإقرارك' : ''} ✓`)
      setView('write')
      task.needsInput('المقال جاهز للمراجعة')
      void requestSocialPack(nextBundle, false).catch(() => undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر بناء المقال الكامل.')
      task.fail(reason, 'تعذّر بناء المقال الكامل')
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

  const transferToArticles = async () => {
    const task = beginAdminTask('نقل المقال إلى المكتبة')
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثًا. سجّل خروجك وادخل من جديد.')
      if (wordCount(bundle.body) < MIN_ARTICLE_WORDS) throw new Error(`المقال يجب ألا يقل عن ${MIN_ARTICLE_WORDS} كلمة. العدد الحالي: ${wordCount(bundle.body)}.`)
      if (!gate.ready) throw new Error(`بوابة الجودة لم تجتز بعد: ${gate.blocking.join('، ')}`)
      if (richArticles.some((article) => article.slug === bundle.slug)) throw new Error('هذا الرابط مستخدم سابقًا. عدّل العنوان أو الرابط.')
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
        status: 'draft',
        scheduledAt: '',
        publishingStudio: {
          idea,
          audience,
          angle,
          social: bundle.social,
          relatedArticles: bundle.related,
          relatedBooks: bundle.books,
          relatedPapers: bundle.papers,
          privateBookMemory: privateMemoryMatches.map((book) => ({
            title: book.title,
            pages: book.pages || null,
            score: book.score,
            section: book.section ? {
              label: book.section.label || 'محور خاص',
              page: book.section.page || null,
              pages: book.section.pages || null,
              keywords: (book.section.keywords || []).slice(0, 6),
            } : null,
            linkedPublicBook: book.linkedPublicBook || null,
          })),
          quality: bundle.quality,
          requestedGenerationWords: targetWords,
          actualWords: wordCount(bundle.body),
          originality: similarity.originality,
          originalityBypassed: skipOriginality,
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
      setNotice('نُقل المقال كاملًا إلى «المقالات» كمسودة. من هناك تستطيع مراجعته أو جدولته أو نشره ✓')
      await onTransferToArticles?.(bundle.slug)
      task.complete('تم نقل المقال')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر نقل المقال إلى المقالات.')
      task.fail(reason, 'تعذّر نقل المقال')
    } finally {
      setBusy(false)
    }
  }

  const saveWeeklyQueue = async () => {
    const task = beginAdminTask('حفظ حزمة النشر')
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
      task.complete('حُفظت حزمة النشر')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حفظ حزمة الأسبوع.')
      task.fail(reason, 'تعذّر حفظ حزمة النشر')
    } finally {
      setQueueBusy(false)
    }
  }


  const loadPulseContext = async () => {
    if (!pulseIdea.trim()) return [] as CurrentEvent[]
    setPulseEventsLoading(true)
    try {
      if (!user) return []
      const token = await user.getIdToken()
      const result = await adminAiRequest<{ items: CurrentEvent[] }>('/api/ai/current-context', { idea: pulseIdea, selectedEventIds: pulseSelectedEventIds }, token)
      const items = result.items || []
      setPulseEvents(items)
      setPulseSelectedEventIds((previous) => previous.filter((id) => items.some((item) => item.id === id)))
      return items
    } catch {
      const ideaTokens = new Set(normalize(pulseIdea).split(/\s+/).filter((token) => token.length > 2))
      const fallback = radar
        .filter((item) => /^https:\/\//i.test(item.url || ''))
        .map((item, index) => {
          const textTokens = normalize(`${item.ar || ''} ${item.en || ''} ${item.arNote || ''}`).split(/\s+/)
          const relevance = textTokens.reduce((score, token) => score + (ideaTokens.has(token) ? 1 : 0), 0)
          return {
            id: item.id || `radar-${index}`,
            title: item.ar || item.en || 'حدث راهن',
            summary: item.arNote || '',
            source: item.source || 'الرادار',
            url: item.url || '',
            relevance,
          }
        })
        .sort((left, right) => right.relevance - left.relevance)
        .slice(0, 8)
      setPulseEvents(fallback)
      if (fallback.length) setNotice('تعذّر تحديث المصادر الحية؛ عُرضت بدائل موثوقة من رادار الموقع مع ترتيبها بحسب صلتها بالفكرة.')
      else setError('تعذّر الوصول إلى المصادر الحية، ولا يوجد رابط موثوق بديل في الرادار الآن.')
      return fallback
    } finally {
      setPulseEventsLoading(false)
    }
  }

  const generatePulse = async () => {
    setError('')
    setNotice('')
    if (pulseIdea.trim().length < 3) { setError('اكتب الفكرة التي تريد نشرها أولًا.'); setAdminTaskState('needs-input', 'اكتب فكرة المنشور أولًا'); return }
    const task = beginAdminTask('بناء المنشور المستقل')
    setPulseBusy(true)
    pulseVariation.current += 1
    const variation = pulseVariation.current
    try {
      const events = pulseEvents.length ? pulseEvents : await loadPulseContext()
      const selectedEvent = pulseSelectedEventIds.length
        ? events.find((item) => item.id === pulseSelectedEventIds[0]) || null
        : null
      let pack: PerfectSocialPack | null = null
      if (user) {
        try {
          const token = await user.getIdToken()
          pack = await adminAiRequest<PerfectSocialPack>('/api/ai/social-pack', {
            title: pulseIdea.trim(),
            excerpt: pulsePurpose.trim(),
            body: `${pulseIdea.trim()}

${pulsePurpose.trim()}`,
            purpose: pulsePurpose.trim(),
            audience: pulseAudience,
            styleProfile: style,
            selectedEventIds: pulseSelectedEventIds,
            standalone: true,
          }, token)
        } catch {
          pack = null
        }
      }
      const local = buildStandaloneSocialPack(pulseIdea, pulsePurpose, pulseAudience, selectedEvent, variation)
      if (pack) {
        pack = {
          ...local,
          ...pack,
          carouselSlides: pack.carouselSlides?.length ? pack.carouselSlides : local.carouselSlides,
          stories: pack.stories?.length ? pack.stories : local.stories,
          visualDirections: pack.visualDirections?.length ? pack.visualDirections : local.visualDirections,
          hashtags: pack.hashtags?.length ? pack.hashtags : local.hashtags,
          event: pack.event || selectedEvent,
        }
      } else pack = local
      setPulsePack(pack)
      setNotice(`بُنيت حزمة مستقلة متنوّعة لموضوع «${visualTopicLabel(detectVisualTopic(`${pulseIdea} ${pulsePurpose}`))}» ✓`)
      task.needsInput('المنشور جاهز للمراجعة')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر بناء المنشور المستقل.')
      task.fail(reason, 'تعذّر بناء المنشور المستقل')
    } finally {
      setPulseBusy(false)
    }
  }

  const savePulseQueue = async () => {
    if (!pulsePack) return
    const task = beginAdminTask('حفظ المنشور المستقل')
    setPulseQueueBusy(true)
    setError('')
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثًا.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      await addDoc(collection(db, 'social_queue'), {
        status: 'ready_for_review',
        source: 'standalone_social_studio',
        idea: pulseIdea.trim(),
        purpose: pulsePurpose.trim(),
        audience: pulseAudience,
        posts: pulsePack,
        visualTemplates: buildSocialVisuals(pulsePack, { title: pulseIdea.trim(), excerpt: pulsePurpose.trim() }),
        currentEvent: pulsePack.event || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNotice('حُفظ المنشور المستقل وقوالبه في طابور الموافقة ✓')
      task.complete('حُفظ المنشور المستقل')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حفظ المنشور المستقل.')
      task.fail(reason, 'تعذّر حفظ المنشور المستقل')
    } finally {
      setPulseQueueBusy(false)
    }
  }

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">استوديو النشر الذكي</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">من فكرة واحدة إلى مقال ومنظومة نشر.</h1>
        <p className="mt-3 max-w-4xl text-[.88rem] leading-loose text-soft">المقال له مساره الكامل، والمنشور المستقل له مساره الخاص؛ بلا خلط أو زحمة.</p>
        <div className="mt-5 flex min-w-0 flex-wrap gap-2 pb-1 md:flex-nowrap md:overflow-x-auto">
          {([
            ['idea', 'الفكرة'],
            ['write', 'الكتابة'],
            ['review', 'بوابة الجودة'],
            ['distribution', 'التوزيع'],
            ['pulse', 'منشور مستقل'],
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
              <Field label="طول التوليد المبدئي (350–4000 كلمة)"><input className={input} inputMode="numeric" aria-label="طول التوليد المبدئي" value={targetWordsInput} onChange={(event) => { const raw = fromArabicDigits(event.target.value).replace(/[^0-9]/g, ''); setTargetWordsInput(raw); const value = Number(raw); if (raw && Number.isFinite(value)) setTargetWords(Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, value))) }} onBlur={() => { const value = Number(targetWordsInput); const normalizedValue = Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, Number.isFinite(value) && value > 0 ? value : targetWords)); setTargetWords(normalizedValue); setTargetWordsInput(String(normalizedValue)) }} /></Field>
              <div className="flex items-end"><button type="button" disabled={generating} className={`${primary} w-full`} onClick={() => void rebuild()}>{generating ? 'أكتب وأراجع…' : 'ابنِ المقال الكامل'}</button></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.articleCount}</strong><span className="text-[.76rem] text-soft">مقالًا يحلل أسلوبها</span></div>
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.avgSentenceWords || '—'}</strong><span className="text-[.76rem] text-soft">متوسط الجملة</span></div>
              <div className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{style.avgParagraphs || '—'}</strong><span className="text-[.76rem] text-soft">متوسط الفقرات</span></div>
              <div className="rounded-xl border border-accent/40 bg-accent/[.05] p-4"><strong className="block font-display text-2xl text-accent">{targetWordsInput || '—'}</strong><span className="text-[.76rem] text-soft">للتوليد الأول فقط — ليس سقفًا للتحرير</span></div>
            </div>
            {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
            {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] text-soft">{error}</p>}
          </section>
          <CurrentEventsCard items={currentEvents} selected={selectedEventIds} loading={eventsLoading} onToggle={(id) => setSelectedEventIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id].slice(0, 3))} />
          <IdeaSuggestionsCard suggestions={articleSuggestions} onPick={pickSuggestion} />
          <ArchiveWakeCard articles={richArticles} onPick={pickSuggestion} />
        </>
      )}

      {view === 'write' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className={card}>
            <div className="grid gap-4">
              <Field label="العنوان"><input className={input} value={bundle.title} onChange={(event) => updateBundle({ title: event.target.value })} /></Field>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                <Field label="الرابط المختصر"><input className={input} dir="ltr" value={bundle.slug} onChange={(event) => updateBundle({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
                <Field label="التصنيف"><input className={input} list="publishing-article-categories" value={bundle.cat} onChange={(event) => updateBundle({ cat: event.target.value })} placeholder="اكتب تصنيفاً قائماً أو جديداً" /><datalist id="publishing-article-categories">{articleCats.filter((cat) => cat !== 'الكل').map((cat) => <option key={cat} value={cat} />)}</datalist></Field>
              </div>
              <Field label="المقتطف"><textarea className={`${input} min-h-24 leading-loose`} value={bundle.excerpt} onChange={(event) => updateBundle({ excerpt: event.target.value })} /></Field>
              <Field label={`المقال — ${wordCount(bundle.body)} كلمة ${wordCount(bundle.body) >= MIN_ARTICLE_WORDS ? '✓' : `— بقي ${MIN_ARTICLE_WORDS - wordCount(bundle.body)}`}`}><textarea className={`${input} min-h-[500px] leading-loose`} value={bundle.body} onChange={(event) => updateBundle({ body: event.target.value })} /></Field>
            </div>
          </section>
          <aside className="grid content-start gap-5">
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">الحد الأدنى والأصالة</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-4 ${wordCount(bundle.body) >= MIN_ARTICLE_WORDS ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{wordCount(bundle.body)}</strong><span className="text-[.72rem] text-soft">الحد الأدنى {MIN_ARTICLE_WORDS} — بلا سقف مقفول</span></div>
                <div className={`rounded-xl border p-4 ${skipOriginality || !similarity.repeated ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{similarity.originality}٪</strong><span className="text-[.72rem] text-soft">{skipOriginality ? 'مستثناة بإقرار الكاتب' : 'أصالة مقابل الأرشيف'}</span></div>
              </div>
              {similarity.matches[0] && <p className="mt-3 text-[.78rem] leading-relaxed text-soft">الأقرب موضوعيًا: «{similarity.matches[0].title}» — التشابه {Math.round(similarity.matches[0].score * 100)}٪.</p>}
              <button type="button" aria-pressed={skipOriginality} onClick={() => setSkipOriginality((value) => !value)} className={`mt-4 w-full rounded-xl border px-4 py-3 text-start transition-colors ${skipOriginality ? 'border-accent bg-accent/[.07] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent'}`}><strong className="block text-[.84rem]">أنا الكاتب — استثناء فحص الأصالة {skipOriginality ? '✓' : ''}</strong><span className="mt-1 block text-[.74rem] leading-relaxed">يُعطّل منع التشابه لهذه النسخة فقط، ويُسجّل داخل بيانات المقال للمراجعة. لا يعطّل بقية بوابة الجودة.</span></button>
              {(wordCount(bundle.body) < MIN_ARTICLE_WORDS || (similarity.repeated && !skipOriginality)) && <button type="button" disabled={generating} onClick={() => void rebuild()} className={`${ghost} mt-4 w-full`}>{generating ? 'أعيد التحرير…' : 'إعادة بناء واستكمال الحد الأدنى'}</button>}
            </section>
            {bundle.event && <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">صلة راهنة موثقة</p><a href={bundle.event.url} target="_blank" rel="noreferrer" className="mt-3 block font-display text-[1rem] font-semibold leading-relaxed text-ink hover:text-accent">{bundle.event.title}</a><p className="mt-2 text-[.78rem] text-soft">{bundle.event.source}</p>{bundle.eventConnection && <p className="mt-3 text-[.8rem] leading-relaxed text-soft">{bundle.eventConnection}</p>}</section>}
            <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة الفكرة</p><p className="mt-2 text-[.86rem] leading-relaxed text-soft">{lab.angle}</p><div className="mt-4 grid gap-3">{bundle.related.map((item) => <a key={item.slug} href={`/articles/${item.slug}`} target="_blank" rel="noreferrer" className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.84rem] text-ink transition-colors hover:border-accent hover:text-accent">{item.title}{item.iso && <span className="ms-2 text-soft">{item.iso.slice(0, 4)}</span>}</a>)}</div></section>
            <PrivateBookMemoryCard matches={privateMemoryMatches} />
            <button type="button" onClick={() => setView('review')} className={primary}>انتقل إلى بوابة الجودة</button>
          </aside>
        </div>
      )}

      {view === 'review' && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)]">
          <QualityGateCard gate={gate} />
          <div className="grid content-start gap-5">
            <StyleEditorCard review={styleInsight} />
            <PrivateBookMemoryCard matches={privateMemoryMatches} />
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">إلى مكتبة المقالات</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">القرار النهائي يتم من صفحة المقالات.</h2>
              <p className="mt-3 text-[.86rem] leading-relaxed text-soft">هذا الاستوديو يبني النص ويفحصه فقط. الزر التالي ينقل العنوان والمقتطف والنص والتصنيف والروابط والحزمة كاملة إلى «المقالات» كمسودة؛ وهناك تختار الجدولة أو النشر.</p>
              <button type="button" disabled={busy || !gate.ready} className={`${primary} mt-6 w-full`} onClick={() => void transferToArticles()}>{busy ? 'أنقل المقال…' : 'نقل المقال كاملًا إلى المقالات'}</button>
              {!gate.ready && <p className="mt-3 text-[.78rem] leading-relaxed text-soft">أكمل البنود غير المجتازة في بوابة الجودة أولًا.</p>}
              {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-accent">{notice}</p>}
              {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-soft">{error}</p>}
            </section>
          </div>
        </div>
      )}

      {view === 'pulse' && (
        <div className="grid gap-5">

          <section id="standalone-compose" className={card}>
            <p className="text-[.76rem] font-semibold uppercase text-accent">منشور مستقل</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">غرّد أو انشر فكرة… من دون أن تكتب مقالًا.</h2>
            <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">اكتب خاطرًا، موقفًا، سؤالًا أو تعليقًا على حدث. الاستوديو يصنع لكل منصة صياغتها وقالبها البصري، ويغيّر الشكل والنبرة في كل مرة.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_13rem_auto]">
              <Field label="الفكرة أو الجملة"><textarea className={`${input} min-h-28`} value={pulseIdea} onChange={(event) => { setPulseIdea(event.target.value); setPulsePack(null) }} placeholder="مثال: ليست المشكلة أن التقنية تتقدم… بل أن أسئلتنا التربوية تتأخر." /></Field>
              <Field label="الهدف أو الزاوية"><textarea className={`${input} min-h-28`} value={pulsePurpose} onChange={(event) => { setPulsePurpose(event.target.value); setPulsePack(null) }} placeholder="ماذا تريد أن يبقى في ذهن القارئ؟" /></Field>
              <Field label="الجمهور"><select className={input} value={pulseAudience} onChange={(event) => setPulseAudience(event.target.value)}><option>الجمهور العام</option><option>المعلمون</option><option>أولياء الأمور</option><option>القيادات التعليمية</option><option>الباحثون</option></select></Field>
              <div className="flex items-end"><button type="button" disabled={pulseBusy} className={`${primary} w-full`} onClick={() => void generatePulse()}>{pulseBusy ? 'أبني الحزمة…' : 'ابنِ المنشور'}</button></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void loadPulseContext()} disabled={pulseEventsLoading || !pulseIdea.trim()} className={ghost}>{pulseEventsLoading ? 'أحدّث الأحداث…' : 'اقترح حدثًا راهنًا'}</button>
              <span className="text-[.76rem] text-soft">الربط اختياري؛ لا يُستخدم إلا إذا كان طبيعيًا ومفيدًا.</span>
            </div>
          </section>

          <section className={card} aria-labelledby="standalone-templates-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[.76rem] font-semibold uppercase text-accent">الطبعة الفاخرة</p>
                <h2 id="standalone-templates-title" className="mt-1 font-display text-2xl font-semibold text-ink">القوالب الستة ظاهرة وجاهزة دائماً.</h2>
                <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">اكتب فكرتك في الأعلى فتتحدث المعاينات تلقائياً بعد توقفك لحظة. لا تحتاج إلى الضغط على «ابنِ المنشور» حتى ترى المداد والليل والجريدة والشريط والمشكاة والتوقيع.</p>
              </div>
              <span className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.72rem] text-soft">{visualTopicLabel(detectVisualTopic(`${pulseIdea} ${pulsePurpose}`))}</span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {pulseTemplateShowcase.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
            </div>
          </section>

          {pulseEvents.length > 0 && <CurrentEventsCard items={pulseEvents} selected={pulseSelectedEventIds} loading={pulseEventsLoading} onToggle={(id) => setPulseSelectedEventIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [id])} />}
          {pulsePack && <PerfectSocialPackCard pack={pulsePack} article={{ title: pulseIdea.trim(), excerpt: pulsePurpose.trim() }} busy={pulseBusy} onRegenerate={() => void generatePulse()} onSave={() => void savePulseQueue()} saveBusy={pulseQueueBusy} />}
          {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
          {error && <p className="rounded-xl border border-red-300/40 bg-wash px-4 py-3 text-[.84rem] text-soft">{error}</p>}
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
              <button type="button" disabled={socialGenerating || !bundle.title.trim()} onClick={() => void requestSocialPack(bundle).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذّر بناء الحزمة.'))} className={`${primary} mt-5`}>
                {socialGenerating ? 'أبني النصوص والتصاميم…' : 'ابنِ منظومة السوشيال'}
              </button>
            </section>
          )}

          <details className={`${card} group`}>
            <summary className="cursor-pointer list-none text-[.82rem] font-semibold text-soft transition-colors hover:text-accent">الحزمة الكلاسيكية الاحتياطية</summary>
            <div className="mt-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SocialCard title="X" text={bundle.social.x} /><SocialCard title="LinkedIn" text={bundle.social.linkedin} /><SocialCard title="Instagram" text={bundle.social.instagram} /><SocialCard title="Threads" text={bundle.social.threads} /><SocialCard title="WhatsApp / Broadcast" text={bundle.social.whatsapp} /><SocialCard title="النشرة البريدية" text={bundle.social.newsletter} /></div>
              <div className="mt-5"><WeeklyPackCard pack={weeklyPack} campaign={sevenDayCampaign} onSave={saveWeeklyQueue} busy={queueBusy} /></div>
            </div>
          </details>

          {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
          {error && <p className="rounded-xl border border-red-300/40 bg-wash px-4 py-3 text-[.84rem] text-soft">{error}</p>}
        </>
      )}
    </div>
  )

}
