/**
 * ذاكرة الفكرة — تعمل محليًا داخل جهاز الزائر فقط.
 * لا ترسل أي سجل قراءة إلى الخادم ولا تنشئ ملفًا شخصيًا للزائر.
 */
export type IdeaMemoryArticle = {
  slug: string
  title: string
  cat?: string
  excerpt?: string
  body?: string
}

type TopicDefinition = { id: string; label: string; terms: string[] }
type StoredTopic = { score: number; lastAt: number; lastSlug: string; lastTitle: string }
type IdeaMemory = { version: 1; topics: Record<string, StoredTopic> }

const STORAGE_KEY = 'idea-memory:v1'
const MAX_AGE = 120 * 24 * 60 * 60 * 1000

const topics: TopicDefinition[] = [
  { id: 'ai-education', label: 'الذكاء الاصطناعي في التعليم', terms: ['الذكاء الاصطناعي', 'ذكاء', 'الخوارزمية', 'الآلة', 'تقنية', 'تكنولوجيا', 'رقمي'] },
  { id: 'teacher-learning', label: 'المعلم والتعلّم', terms: ['المعلم', 'المعلمين', 'التدريس', 'التعلم', 'التعليم', 'الفصل', 'المنهج'] },
  { id: 'child-family', label: 'الطفل والأسرة', terms: ['الطفل', 'الأبناء', 'الأسرة', 'الوالدين', 'التربية', 'الأم', 'الأب'] },
  { id: 'assessment', label: 'التقييم والامتحان', terms: ['التقييم', 'الامتحان', 'الاختبار', 'الدرجة', 'القياس', 'الفهم', 'الحفظ'] },
  { id: 'identity-language', label: 'الهوية واللغة', terms: ['الهوية', 'اللغة', 'العربية', 'الثقافة', 'القيم', 'الانتماء'] },
  { id: 'human-meaning', label: 'الإنسان والمعنى', terms: ['الإنسان', 'المعنى', 'الوعي', 'العلاقة', 'الأثر', 'الأخلاق', 'القيمة'] },
  { id: 'research-future', label: 'البحث ومستقبل المعرفة', terms: ['البحث', 'المعرفة', 'المستقبل', 'الابتكار', 'الجامعة', 'الدراسة', 'الباحث'] },
]

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const readMemory = (): IdeaMemory => {
  if (typeof window === 'undefined') return { version: 1, topics: {} }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as IdeaMemory | null
    if (!parsed || parsed.version !== 1 || !parsed.topics) return { version: 1, topics: {} }
    return parsed
  } catch { return { version: 1, topics: {} } }
}

const matchingTopics = (article: IdeaMemoryArticle) => {
  const haystack = normalize(`${article.title} ${article.cat || ''} ${article.excerpt || ''} ${(article.body || '').slice(0, 1600)}`)
  return topics
    .map((topic) => ({ topic, score: topic.terms.reduce((sum, term) => sum + (haystack.includes(normalize(term)) ? (term.includes(' ') ? 3 : 1) : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

export function rememberIdeaVisit(article: IdeaMemoryArticle) {
  if (typeof window === 'undefined') return
  const matches = matchingTopics(article)
  if (!matches.length) return
  const now = Date.now()
  const memory = readMemory()
  for (const [id, stored] of Object.entries(memory.topics)) {
    if (now - stored.lastAt > MAX_AGE) delete memory.topics[id]
    else stored.score = Math.max(.35, stored.score * .985)
  }
  matches.forEach(({ topic, score }, index) => {
    const current = memory.topics[topic.id]
    memory.topics[topic.id] = {
      score: Math.min(30, (current?.score || 0) + score * (index === 0 ? 1 : .55)),
      lastAt: now,
      lastSlug: article.slug,
      lastTitle: article.title,
    }
  })
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory)) } catch { /* التخزين المحلي قد يكون محجوبًا */ }
}

export function ideaContinuation(articles: IdeaMemoryArticle[]) {
  if (typeof window === 'undefined') return null
  const memory = readMemory()
  const ranked = Object.entries(memory.topics)
    .map(([id, stored]) => ({ definition: topics.find((topic) => topic.id === id), stored }))
    .filter((item): item is { definition: TopicDefinition; stored: StoredTopic } => Boolean(item.definition) && Date.now() - item.stored.lastAt < MAX_AGE)
    .sort((a, b) => (b.stored.score + b.stored.lastAt / 1e13) - (a.stored.score + a.stored.lastAt / 1e13))
  const leading = ranked[0]
  if (!leading) return null

  const candidates = articles
    .filter((article) => article.slug !== leading.stored.lastSlug)
    .map((article) => {
      const haystack = normalize(`${article.title} ${article.cat || ''} ${article.excerpt || ''}`)
      const score = leading.definition.terms.reduce((sum, term) => sum + (haystack.includes(normalize(term)) ? (term.includes(' ') ? 3 : 1) : 0), 0)
      return { article, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]
  if (!candidates) return null
  return { label: leading.definition.label, article: candidates.article }
}
