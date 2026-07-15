import type { ArticleRecord, BookRecord, PaperRecord } from './cms'

type SimpleBook = Pick<BookRecord, 'slug' | 'title' | 'desc'>
type SimplePaper = Pick<PaperRecord, 'slug' | 'title' | 'meta' | 'abstractAr' | 'journal'>
type ArticleLike = Pick<ArticleRecord, 'slug' | 'title' | 'excerpt' | 'body' | 'cat' | 'iso' | 'hasAudio'>

const STOP = new Set([
  'هذا', 'هذه', 'ذلك', 'تلك', 'الذي', 'التي', 'الذين', 'على', 'إلى', 'الى', 'عن', 'من', 'في', 'مع', 'كان', 'كانت',
  'يكون', 'ليس', 'لكن', 'لأن', 'أن', 'إن', 'كل', 'بعد', 'قبل', 'حين', 'حتى', 'نحن', 'وهو', 'وهي', 'كما', 'وقد',
  'لقد', 'أو', 'ثم', 'بل', 'ما', 'لا', 'لم', 'لن', 'قد', 'هو', 'هي', 'هم', 'بين', 'عند',
])

export function normalizeIdea(value = '') {
  return value
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const IDEA_SYNONYMS: Record<string, string[]> = {
  ذكاء: ['اصطناعي', 'خوارزميات', 'بيانات', 'رقمي', 'تقنيه'],
  اصطناعي: ['ذكاء', 'خوارزميات', 'بيانات', 'رقمي'],
  تعليم: ['تعلم', 'تدريس', 'طالب', 'معلم', 'اكاديمي', 'جامعي'],
  تعلم: ['تعليم', 'تدريس', 'مهارات', 'طالب'],
  تقنيه: ['تكنولوجيا', 'رقمي', 'الكتروني', 'اجهزه'],
  تكنولوجيا: ['تقنيه', 'رقمي', 'الكتروني', 'اجهزه'],
  رقمي: ['الكتروني', 'تقنيه', 'تكنولوجيا', 'منصات'],
  طفل: ['طفوله', 'اطفال', 'ابناء'],
  اعاقه: ['احتياجات', 'خاصه', 'مساعده', 'اتاحه'],
  بحث: ['دراسه', 'علمي', 'اكاديمي'],
  جامعه: ['جامعي', 'كليه', 'هيئه', 'طلبه'],
  معلم: ['تدريس', 'هيئه', 'استاذ', 'تعليم'],
  اداره: ['حوكمه', 'قياده', 'نظم', 'مؤسسه'],
}

function tokenVariants(token: string) {
  const clean = token.replace(/^ال(?=.{3,})/, '')
  const variants = new Set([token, clean])
  if (clean.length > 4) {
    variants.add(clean.replace(/ات$/, ''))
    variants.add(clean.replace(/ون$|ين$/, ''))
    variants.add(clean.replace(/يه$/, ''))
  }
  for (const synonym of IDEA_SYNONYMS[clean] || []) variants.add(synonym)
  return Array.from(variants).filter((item) => item.length > 2 && !STOP.has(item))
}

export function ideaTokens(value = '') {
  const tokens = normalizeIdea(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token) && !/^ال..$/.test(token))
  return Array.from(new Set(tokens.flatMap(tokenVariants)))
}

function scoreText(needle: string[], haystack = '') {
  const normalizedHaystack = normalizeIdea(haystack)
  const mine = new Set(needle)
  let score = 0
  for (const token of ideaTokens(haystack)) if (mine.has(token)) score += 2
  for (const token of needle) {
    if (token.length >= 4 && normalizedHaystack.includes(token)) score += 1
  }
  return score
}

export function relatedForIdea<T extends { title: string }>(
  idea: string,
  items: readonly T[],
  textOf: (item: T) => string,
  limit = 5,
) {
  const tokens = ideaTokens(idea)
  return items
    .map((item) => ({ item, score: scoreText(tokens, `${item.title} ${textOf(item)}`) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((entry) => entry.item)
}

export function suggestStrongTitle(idea: string) {
  const clean = idea.trim().replace(/[؟?!.]+$/g, '')
  if (!clean) return 'فكرة تحتاج عنواناً'
  if (/الخوف|قلق|امتحان|اختبار/.test(clean)) return 'حين يتحول القياس إلى خوف'
  if (/ذكاء|اصطناعي|تقني|تكنولوجيا|رقمي/.test(clean)) return 'الإنسان في قلب التحول الرقمي'
  if (/معلم|تعليم|مدرس/.test(clean)) return 'المعلم في زمن الأسئلة الجديدة'
  if (/طفل|اسره|أسرة|ابناء|أبناء/.test(clean)) return 'الطفل بين الشاشة والمعنى'
  return clean.startsWith('لماذا') || clean.startsWith('كيف') ? clean : `ماذا يكشف لنا ${clean}؟`
}

export function ideaLab(idea: string, articles: ArticleLike[], books: SimpleBook[], papers: SimplePaper[]) {
  const relatedArticles = relatedForIdea(idea, articles, (a) => `${a.excerpt || ''} ${a.body || ''}`, 4)
  const relatedBooks = relatedForIdea(idea, books, (b) => b.desc || '', 2)
  const relatedPapers = relatedForIdea(idea, papers, (p) => `${p.meta || ''} ${p.abstractAr || ''} ${p.journal || ''}`, 2)
  const title = suggestStrongTitle(idea)
  const seed = relatedArticles[0]
  const quote = strongestQuote(seed?.body || seed?.excerpt || idea)
  return {
    title,
    angle: seed ? `ابدأ من زاوية «${seed.cat}»: ${seed.excerpt || seed.title}` : 'ابدأ بسؤال إنساني صغير ثم انتقل إلى أثره التربوي.',
    shortArticle: [
      `ليست المسألة في ${idea || 'الفكرة'} بوصفها حدثاً عابراً، بل في الأثر الذي تتركه في الإنسان.`,
      'حين ننظر إلى التعليم بوصفه علاقة لا إجراءً، تتغير طريقة السؤال، وتتغير معها طريقة الحل.',
      'السؤال الأهم هنا: كيف نحافظ على المعنى ونحن نطوّر الأداة؟',
    ].join('\n\n'),
    linkedin: `قد يبدو ${idea || 'هذا الموضوع'} تفصيلاً مهنياً، لكنه في التعليم يمسّ الإنسان مباشرة.\n\nالسؤال ليس: ما التقنية أو الأداة؟\nالسؤال: ماذا تفعل هذه الأداة في وعي الطالب والمعلم؟`,
    podcast: `افتتاحية مقترحة: «قد تبدو الفكرة بسيطة، لكن أثرها لا يصل إلى الإنسان بهذه البساطة.»`,
    question: `ما الذي يتغير في الطالب أو المعلم عندما ننظر إلى ${idea || 'هذه الفكرة'} من زاوية إنسانية؟`,
    quote,
    relatedArticles,
    relatedBooks,
    relatedPapers,
  }
}

export function strongestQuote(text = '') {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 170)
  return sentences.find((sentence) => /الإنسان|التعليم|الطالب|المعلم|المعنى|الخوف|الفكرة/.test(sentence))
    || sentences[0]
    || 'الفكرة القوية تبدأ حين نرى الإنسان قبل الأداة.'
}

export function styleFingerprint(articles: ArticleLike[]) {
  const complete = articles.filter((article) => (article.body || article.excerpt || '').trim().length > 80)
  const corpus = complete.map((article) => `${article.title}. ${article.excerpt || ''}. ${article.body || ''}`).join('\n\n')
  const sentences = corpus
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 18)
  const sentenceWords = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length)
  const avgSentenceWords = sentenceWords.length
    ? Math.round(sentenceWords.reduce((sum, n) => sum + n, 0) / sentenceWords.length)
    : 0
  const terms = new Map<string, number>()
  for (const token of ideaTokens(corpus)) {
    if (token.length < 4 || /^\d+$/.test(token)) continue
    terms.set(token, (terms.get(token) || 0) + 1)
  }
  const recurringTerms = Array.from(terms)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term]) => term)
  const categories = Array.from(complete.reduce((map, article) => {
    map.set(article.cat, (map.get(article.cat) || 0) + 1)
    return map
  }, new Map<string, number>()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, count]) => ({ cat, count }))
  const years = Array.from(new Set(complete.map((article) => article.iso?.slice(0, 4)).filter(Boolean))).sort()
  const humanAnchors = ['الإنسان', 'الطالب', 'المعلم', 'المعنى', 'الخوف', 'الوعي', 'القيمة']
    .filter((word) => corpus.includes(word))
  return {
    articleCount: complete.length,
    years,
    avgSentenceWords,
    recurringTerms,
    categories,
    humanAnchors,
    guidance: [
      'ابدأ غالباً من موقف إنساني صغير، لا من تعريف أكاديمي مباشر.',
      'اجعل التقنية أو النظام وسيلة لفهم أثرها في الطالب والمعلم والإنسان.',
      'استخدم سؤالاً واضحاً يفتح المعنى، ثم فقرة قصيرة تضيء المفارقة.',
      'تجنب النبرة الوعظية المباشرة، وفضّل التأمل الهادئ المدعوم بمثال.',
    ],
  }
}

export function articleSystem(article: ArticleLike, articles: ArticleLike[], books: SimpleBook[], papers: SimplePaper[]) {
  const body = article.body || article.excerpt || article.title
  const first = body.replace(/\s+/g, ' ').slice(0, 280)
  const quote = strongestQuote(body)
  const relatedArticles = relatedForIdea(`${article.title} ${article.excerpt}`, articles.filter((a) => a.slug !== article.slug), (a) => `${a.excerpt || ''} ${a.body || ''}`, 4)
  const relatedBooks = relatedForIdea(`${article.title} ${article.excerpt}`, books, (b) => b.desc || '', 2)
  const relatedPapers = relatedForIdea(`${article.title} ${article.excerpt}`, papers, (p) => `${p.meta || ''} ${p.abstractAr || ''} ${p.journal || ''}`, 2)
  return {
    summary: `${article.title}: ${article.excerpt || first}`,
    academic: `تتناول هذه المقالة قضية ${article.cat} من زاوية إنسانية، وتبرز أثرها في فهم المتعلم والمعلم وسياق التعليم. يمكن استخدامها مدخلاً للنقاش حول العلاقة بين الأداة والمعنى.`,
    xPost: `${quote}\n\n${article.title}`,
    linkedin: `${article.title}\n\n${article.excerpt || first}\n\nالسؤال الذي يستحق النقاش: ماذا نربح حين نضع الإنسان أولاً؟`,
    videoScript: `في دقيقة واحدة: ${article.title}. الفكرة ليست في الحدث وحده، بل في أثره على الإنسان. لننظر إلى السؤال من زاوية الطالب والمعلم والمعنى.`,
    studentQuestion: `ناقش: كيف تغيّر هذه الفكرة طريقة فهمك للتعليم أو التقنية؟`,
    slide: `العنوان: ${article.title}\nالفكرة المركزية: ${article.excerpt || first}\nسؤال ختامي: ماذا يحدث عندما يغيب الإنسان عن القرار؟`,
    podcast: `فهد: «قد تبدو الفكرة واضحة من العنوان.»\nنورة: «لكن أثرها الحقيقي يظهر عندما نربطها بحياة الطالب والمعلم.»`,
    quotes: [quote, ...body.replace(/\s+/g, ' ').split(/(?<=[.!؟])\s+/).filter((s) => s.length > 55 && s.length < 150).slice(0, 3)].slice(0, 4),
    relatedArticles,
    relatedBooks,
    relatedPapers,
  }
}

export function topicMemory(title: string, body: string, articles: ArticleLike[], books: SimpleBook[], papers: SimplePaper[]) {
  const idea = `${title} ${body.slice(0, 700)}`
  const relatedArticles = relatedForIdea(idea, articles, (a) => `${a.excerpt || ''} ${a.body || ''}`, 5)
  const years = relatedArticles.map((a) => a.iso?.slice(0, 4)).filter(Boolean)
  return {
    relatedArticles,
    relatedBooks: relatedForIdea(idea, books, (b) => b.desc || '', 2),
    relatedPapers: relatedForIdea(idea, papers, (p) => `${p.meta || ''} ${p.abstractAr || ''} ${p.journal || ''}`, 2),
    note: relatedArticles.length
      ? `كتبت حول هذه الفكرة في ${Array.from(new Set(years)).join('، ')}. الزاوية الجديدة يمكن أن تكون: ماذا تغيّر اليوم؟`
      : 'هذه تبدو زاوية جديدة في الأرشيف؛ اربطها بسؤال إنساني واضح قبل النشر.',
  }
}

export function publicationGate(article: Partial<ArticleLike> & { slug?: string; scheduledAt?: string }, articles: ArticleLike[]) {
  const issues: string[] = []
  if (!article.title || article.title.trim().length < 5) issues.push('العنوان قصير.')
  if (!article.slug || !/^[a-z0-9-]{4,}$/.test(article.slug)) issues.push('الرابط المختصر يحتاج مراجعة.')
  if (article.slug && articles.some((item) => item.slug === article.slug)) issues.push('الرابط المختصر مستخدم سابقاً.')
  if (!article.excerpt || article.excerpt.trim().length < 35) issues.push('المقتطف قصير أو غير موجود.')
  if (!article.body || article.body.trim().length < 80) issues.push('نص المقال قصير.')
  if (!article.cat) issues.push('التصنيف لم يتولد بعد.')
  if (!article.hasAudio) issues.push('الصوت غير جاهز بعد؛ لا يمنع النشر لكنه يحتاج متابعة.')
  return { ready: issues.filter((issue) => !issue.includes('الصوت')).length === 0, issues }
}

export function automaticSeries(articles: ArticleLike[]) {
  const seeds = [
    { title: 'الإنسان في قلب الآلة', terms: 'ذكاء اصطناعي تقنية رقمي انسان آلة' },
    { title: 'مستقبل المعلم', terms: 'معلم تعليم مدرس تدريس' },
    { title: 'الطفل والتكنولوجيا', terms: 'طفل اسرة ابناء تكنولوجيا شاشة' },
    { title: 'الامتحان والخوف', terms: 'امتحان اختبار خوف قياس درجة' },
    { title: 'الهوية في العصر الرقمي', terms: 'هوية لغة تراث رقمي ثقافة' },
  ]
  return seeds
    .map((seed) => ({ title: seed.title, items: relatedForIdea(seed.terms, articles, (a) => `${a.title} ${a.excerpt || ''} ${a.body || ''}`, 5) }))
    .filter((series) => series.items.length >= 2)
}

export function monthlyPlan(articles: ArticleLike[], books: SimpleBook[], papers: SimplePaper[], date = new Date()) {
  const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const seed = Number(period.replace('-', '')) || 1
  const hash = (value: string) => [...value].reduce((total, char) => (total * 33 + char.charCodeAt(0)) % 2_147_483_647, seed)
  const categories = new Set<string>()
  const pool = [...articles]
    .filter((article) => article.title && article.slug)
    .sort((left, right) => hash(`${left.slug}:${period}`) - hash(`${right.slug}:${period}`))
  const selected: ArticleLike[] = []

  for (const article of pool) {
    const category = article.cat || 'عام'
    if (selected.length < 3 && categories.has(category)) continue
    selected.push(article)
    categories.add(category)
    if (selected.length === 4) break
  }
  for (const article of pool) {
    if (selected.length === 4) break
    if (!selected.some((item) => item.slug === article.slug)) selected.push(article)
  }

  const actions = [
    'مقال جديد من زاوية لم تُكتب بهذا الشكل',
    'إعادة إحياء مقال قديم بمدخل راهن',
    'منشور قصير يختبر الفكرة قبل توسيعها',
    'مقال تحليلي يربط الأرشيف بسؤال الشهر',
  ]

  return selected.map((article, index) => ({
    week: index + 1,
    period,
    article,
    action: actions[(index + seed) % actions.length],
    companion: relatedForIdea(article.title, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, 1)[0]?.title
      || relatedForIdea(article.title, books, (book) => book.desc || '', 1)[0]?.title
      || 'منشور مستقل يمهّد للفكرة',
  }))
}

/* ---------- محرك الأسلوب والأصالة التحريرية ---------- */
export type StyleSample = {
  slug: string
  title: string
  cat: string
  year: string
  words: number
  opening: string
  middle: string
  closing: string
}

export type SimilarityMatch = {
  slug: string
  title: string
  score: number
  titleScore: number
  ideaScore: number
  phraseScore: number
}

const arabicWordCount = (value = '') => value.trim().split(/\s+/).filter(Boolean).length

function textTokens(value = '') {
  return ideaTokens(value).filter((token) => token.length >= 3)
}

function ngrams(tokens: string[], size = 3) {
  const out = new Set<string>()
  for (let index = 0; index <= tokens.length - size; index += 1) {
    out.add(tokens.slice(index, index + size).join(' '))
  }
  return out
}

function jaccard(left: Iterable<string>, right: Iterable<string>) {
  const a = new Set(left)
  const b = new Set(right)
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const item of a) if (b.has(item)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

function cleanSegment(value = '', maximum = 900) {
  return Array.from(value.replace(/\s+/g, ' ').trim()).slice(0, maximum).join('')
}

/**
 * عينات متنوعة تمثل أسلوب الكاتب، لا مجرد أحدث المقالات. نرسل مقتطفات قصيرة
 * فقط إلى المولّد حتى يتعلم الإيقاع والبناء من دون نسخ عبارات كاملة.
 */
export function representativeStyleSamples(articles: ArticleLike[], limit = 6): StyleSample[] {
  const complete = articles
    .filter((article) => (article.body || '').trim().length >= 500)
    .map((article) => {
      const body = (article.body || '').trim()
      const paragraphs = body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
      const words = arabicWordCount(body)
      const middleIndex = Math.max(0, Math.floor(paragraphs.length / 2))
      return {
        slug: article.slug,
        title: article.title,
        cat: article.cat,
        year: article.iso?.slice(0, 4) || '',
        words,
        opening: cleanSegment(paragraphs[0] || body, 700),
        middle: cleanSegment(paragraphs[middleIndex] || body, 700),
        closing: cleanSegment(paragraphs.at(-1) || body, 700),
      }
    })

  if (complete.length <= limit) return complete
  const average = complete.reduce((sum, item) => sum + item.words, 0) / complete.length
  const selected: StyleSample[] = []
  const usedCategories = new Set<string>()
  const usedYears = new Set<string>()

  const ranked = [...complete].sort((left, right) => {
    const leftDiversity = (usedCategories.has(left.cat) ? 1 : 0) + (usedYears.has(left.year) ? .4 : 0)
    const rightDiversity = (usedCategories.has(right.cat) ? 1 : 0) + (usedYears.has(right.year) ? .4 : 0)
    return leftDiversity - rightDiversity || Math.abs(left.words - average) - Math.abs(right.words - average)
  })

  while (selected.length < limit && ranked.length) {
    ranked.sort((left, right) => {
      const leftPenalty = (usedCategories.has(left.cat) ? 1 : 0) + (usedYears.has(left.year) ? .35 : 0)
      const rightPenalty = (usedCategories.has(right.cat) ? 1 : 0) + (usedYears.has(right.year) ? .35 : 0)
      return leftPenalty - rightPenalty || Math.abs(left.words - average) - Math.abs(right.words - average)
    })
    const next = ranked.shift()
    if (!next) break
    selected.push(next)
    usedCategories.add(next.cat)
    usedYears.add(next.year)
  }
  return selected
}

/** يقيس التشابه الفكري واللفظي مع كل الأرشيف، لا العنوان فقط. */
export function articleSimilarityReport(title: string, body: string, articles: ArticleLike[], limit = 5) {
  const titleTokens = textTokens(title)
  const bodyTokens = textTokens(body)
  const bodyPhrases = ngrams(bodyTokens, 3)
  const matches: SimilarityMatch[] = articles.map((article) => {
    const sourceTitle = textTokens(article.title)
    const sourceIdea = textTokens(`${article.title} ${article.excerpt || ''}`)
    const sourceBody = textTokens(article.body || article.excerpt || '')
    const titleScore = jaccard(titleTokens, sourceTitle)
    const ideaScore = jaccard([...titleTokens, ...bodyTokens.slice(0, 90)], sourceIdea)
    const phraseScore = jaccard(bodyPhrases, ngrams(sourceBody, 3))
    // الوزن الأعلى للزاوية والمعنى، ثم العبارات، ثم العنوان.
    const score = titleScore * .28 + ideaScore * .42 + phraseScore * .30
    return {
      slug: article.slug,
      title: article.title,
      score: Math.round(score * 1000) / 1000,
      titleScore: Math.round(titleScore * 1000) / 1000,
      ideaScore: Math.round(ideaScore * 1000) / 1000,
      phraseScore: Math.round(phraseScore * 1000) / 1000,
    }
  }).sort((left, right) => right.score - left.score).slice(0, limit)

  const highest = matches[0]?.score || 0
  return {
    matches,
    highest,
    originality: Math.max(0, Math.round((1 - highest) * 100)),
    repeated: highest >= .52,
    warning: highest >= .40,
  }
}

/** ملف أسلوب أكثر عمقاً للاستخدام في التوليد والتحكيم. */
export function editorialStyleProfile(articles: ArticleLike[]) {
  const base = styleFingerprint(articles)
  const complete = articles.filter((article) => (article.body || '').trim().length >= 300)
  const articleWords = complete.map((article) => arabicWordCount(article.body || ''))
  const paragraphs = complete.map((article) => (article.body || '').split(/\n\s*\n/).filter((part) => part.trim()).length)
  const corpus = complete.map((article) => article.body || '').join('\n\n')
  const sentences = corpus.replace(/\s+/g, ' ').split(/(?<=[.!؟])\s+/).filter((sentence) => sentence.trim().length > 15)
  const questionRate = sentences.length ? sentences.filter((sentence) => sentence.includes('؟')).length / sentences.length : 0
  const shortSentenceRate = sentences.length ? sentences.filter((sentence) => arabicWordCount(sentence) <= 9).length / sentences.length : 0
  const openings = complete.map((article) => (article.body || '').trim().split(/\s+/).slice(0, 8).join(' '))
  const openingModes = {
    question: openings.filter((value) => /هل|كيف|لماذا|ماذا|متى|أين/.test(value)).length,
    contrast: openings.filter((value) => /ليس|ليست|لكن|بينما|قد يبدو/.test(value)).length,
    scene: openings.filter((value) => /حين|عندما|في صباح|داخل|أمام/.test(value)).length,
    direct: 0,
  }
  openingModes.direct = Math.max(0, openings.length - openingModes.question - openingModes.contrast - openingModes.scene)
  const connectors = ['لكن', 'لذلك', 'لهذا', 'وحين', 'ومع ذلك', 'في المقابل', 'والأهم', 'المشكلة', 'السؤال']
    .map((term) => ({ term, count: normalizeIdea(corpus).split(normalizeIdea(term)).length - 1 }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 8)
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0

  return {
    ...base,
    avgArticleWords: average(articleWords),
    avgParagraphs: average(paragraphs),
    questionRate: Math.round(questionRate * 100),
    shortSentenceRate: Math.round(shortSentenceRate * 100),
    openingModes,
    connectors,
    styleRules: [
      'الافتتاحية تبدأ بصورة إنسانية أو مفارقة حقيقية، لا بتعريف مدرسي.',
      'النبرة تأملية واثقة، قريبة من القارئ، بلا وعظ ولا استعراض اصطلاحي.',
      'الجمل متفاوتة الطول؛ جملة قصيرة للحسم ثم جملة أوسع للتحليل.',
      'السؤال البلاغي يستخدم عند الحاجة فقط، ولا يتحول المقال إلى سلسلة أسئلة.',
      'الخاتمة تفتح معنى أو موقفاً، ولا تعيد المقدمة بصياغة أخرى.',
      'يُمنع نسخ جملة من الأرشيف؛ المطلوب محاكاة الإيقاع والبناء لا العبارات.',
    ],
  }
}
