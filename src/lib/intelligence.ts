import type { ArticleRecord, BookRecord, PaperRecord } from './cms'

type SimpleBook = Pick<BookRecord, 'slug' | 'title' | 'desc'>
type SimplePaper = Pick<PaperRecord, 'slug' | 'title' | 'meta'>
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

export function ideaTokens(value = '') {
  return normalizeIdea(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token) && !/^ال..$/.test(token))
}

function scoreText(needle: string[], haystack = '') {
  const mine = new Set(needle)
  let score = 0
  for (const token of ideaTokens(haystack)) if (mine.has(token)) score += 1
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
  const relatedPapers = relatedForIdea(idea, papers, (p) => p.meta || '', 2)
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
  const relatedPapers = relatedForIdea(`${article.title} ${article.excerpt}`, papers, (p) => p.meta || '', 2)
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
    relatedPapers: relatedForIdea(idea, papers, (p) => p.meta || '', 2),
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

export function monthlyPlan(articles: ArticleLike[], books: SimpleBook[], papers: SimplePaper[]) {
  const top = [...articles].sort((a, b) => (b.iso || '').localeCompare(a.iso || '')).slice(0, 4)
  return top.map((article, index) => ({
    week: index + 1,
    article,
    action: index === 0 ? 'مقال جديد أو إعادة نشر واعية' : 'إعادة إحياء مقال قديم',
    companion: relatedForIdea(article.title, papers, (p) => p.meta || '', 1)[0]?.title
      || relatedForIdea(article.title, books, (b) => b.desc || '', 1)[0]?.title
      || 'منشور قصير يمهد للفكرة',
  }))
}
