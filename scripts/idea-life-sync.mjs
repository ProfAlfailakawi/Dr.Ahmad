#!/usr/bin/env node
/**
 * «حياة الفكرة» — مزامنة مجانية بالكامل.
 *
 * ما تفعله المهمة:
 *  1) تلتقط المقالات الجديدة تلقائياً من المصدر الثابت وFirestore.
 *  2) تستخرج التوقعات حرفياً بقواعد لغوية محلية، بلا نموذج مدفوع.
 *  3) تلتقط «مستجدات الفكرة» من الدراسات المفتوحة والرادار الموثوق، مع تنويع النوع ومنع التكرار.
 *  4) تبحث بحذر عن ذكر عام مباشر عبر GDELT، وعن الاستشهادات العلمية عبر OpenCitations وCrossref.
 *  5) تحفظ فقط الروابط التي تعمل وتتجاوز عتبة تطابق مرتفعة في site_idea_life.
 *
 * لا تستخدم OpenAI أو Gemini أو أي API مدفوع، ولا تنشر حكماً «تحقق/فشل» تلقائياً.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const SELF_TEST = args.has('--self-test')
const FORCE = args.has('--force')
const MAX_ARTICLES = Number(process.env.IDEA_LIFE_MAX_ARTICLES || 14)
const MAX_PAPERS = Number(process.env.IDEA_LIFE_MAX_PAPERS || 10)
const STALE_DAYS = Number(process.env.IDEA_LIFE_STALE_DAYS || 14)
const SITE_HOSTS = new Set(['dr-alfailakawi.com', 'www.dr-alfailakawi.com'])

try { process.loadEnvFile(resolve(ROOT, '.env')) } catch { /* optional */ }

const clean = (value = '') => String(value).replace(/\\'/g, "'").replace(/\s+/g, ' ').trim()
const normalize = (value = '') => clean(value)
  .replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .toLocaleLowerCase('ar')
  .replace(/[^\p{L}\p{N} ]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const STOP = new Set(['على','الى','إلى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','بين','بعد','قبل','عند','حتى','كان','كانت','هل','ما','لا','لم','لن','قد','ثم','او','أو','ام','أم','بل','كل','بعض','غير','نحو','لدى','منذ','حين','حول','ان','أن','إن','لان','لأن','كيف','اين','أين','ليس','وهو','وهي','لكن'])
const words = (value = '') => [...new Set(normalize(value).split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word)))]
const overlap = (left, right) => {
  const mine = new Set(words(left)); return words(right).filter((word) => mine.has(word)).length
}
const ratio = (left, right) => {
  const a = words(left); const b = words(right)
  if (!a.length || !b.length) return 0
  return b.filter((word) => new Set(a).has(word)).length / Math.max(3, Math.min(a.length, b.length))
}
const hash = (value) => {
  let out = 2166136261
  for (const char of String(value)) { out ^= char.charCodeAt(0); out = Math.imul(out, 16777619) }
  return (out >>> 0).toString(36)
}
const FUTURE_RE = /(?:^|[\s،؛:!.؟?()\[\]{}«»\"'…-])(?:سوف|سيكون|ستكون|سيصبح|ستصبح|سنرى|سنشهد|سيؤدي|ستؤدي|سيزداد|ستزداد|سيقل|ستقل|سيتراجع|ستتراجع|ستنتهي|سيختفي|ستختفي|سيحل|ستحل|ستتغير|سيتغير|مستقبلاً|في المستقبل|في السنوات القادمة|في الأعوام القادمة|خلال السنوات|خلال الأعوام|ربما نشهد|قد يصبح|قد تتحول|قد نصل|لن يعود)(?=$|[\s،؛:!.؟?()\[\]{}«»\"'…-])/i
const FUTURE_QUESTION_RE = /(?:^| )(?:ف)?(?:هل|كيف|متي|ماذا|ما الذي) (?:سوف |سي|ست|سن)|(?:لا احد يعرف|لا نعرف|لا ندري|نتساءل|تساءل|سائلا|يفكر كيف|ما سيحدث)/i
const FUTURE_ATTRIBUTION_RE = /(?:دراسه|بحث|تقرير|منظمه|جامعه|بحسب|وفقا|قالت|اعلنت|اشارت|حذرت|تري مايكروسوفت|تعد سامسونج)/i
const FUTURE_FRAGMENT_RE = /^(?:هو|هي|لكن المميز|ومن المميز) /i
const isPredictionSentence = (sentence) => {
  const normalized = normalize(sentence)
  return FUTURE_RE.test(sentence)
    && !sentence.includes('؟')
    && !FUTURE_QUESTION_RE.test(normalized)
    && !FUTURE_ATTRIBUTION_RE.test(normalized)
    && !FUTURE_FRAGMENT_RE.test(normalized)
}
const RESEARCH_CONCEPTS = [
  { ar: /ذكاء|اصطناعي|خوارزمي|نماذج لغويه/, en: ['artificial intelligence', 'generative ai'] },
  { ar: /تعليم|تعلم|تدريس|مدرسه|جامعه/, en: ['education', 'learning'] },
  { ar: /طالب|متعلمين|متعلم/, en: ['student', 'learner'] },
  { ar: /معلم|مدرس/, en: ['teacher'] },
  { ar: /اختبار|امتحان|تقييم|قياس/, en: ['assessment', 'evaluation'] },
  { ar: /شهاده|مؤهل/, en: ['credential', 'qualification'] },
  { ar: /تفكير نقدي|تفكير|عقل/, en: ['critical thinking', 'cognition'] },
  { ar: /ابداع|ابتكار/, en: ['creativity', 'innovation'] },
  { ar: /طفل|اطفال|ابناء/, en: ['child', 'children'] },
  { ar: /اسره|والدين|والد|امومه|ابوه/, en: ['family', 'parenting'] },
  { ar: /تواصل اجتماعي|منصات|مشاهير|فاشينست/, en: ['social media'] },
  { ar: /هاتف|شاشه|اجهزه/, en: ['screen time', 'smartphone'] },
  { ar: /صحه نفسيه|نفسي|قلق|اكتئاب/, en: ['mental health', 'wellbeing'] },
  { ar: /دافعيه|تحفيز/, en: ['motivation'] },
  { ar: /تحول رقمي|رقمنه|اداره رقميه/, en: ['digital transformation', 'digital governance'] },
  { ar: /قياده|اداره|مؤسسه|مؤسسات/, en: ['leadership', 'organizational change'] },
  { ar: /جامعات ذكيه|جامعه ذكيه/, en: ['smart university', 'higher education'] },
  { ar: /تعلم الكتروني|تعليم الكتروني|تعلم مدمج/, en: ['online learning', 'blended learning'] },
  { ar: /اخلاق|حوكمه|مسؤوليه/, en: ['ethics', 'governance'] },
  { ar: /مستقبل العمل|سوق العمل|وظائف/, en: ['future of work', 'employment'] },
]
const researchConcepts = (value = '') => RESEARCH_CONCEPTS.filter((concept) => concept.ar.test(normalize(value)))
const researchQuery = (article, quote) => {
  const concepts = researchConcepts(`${article.title} ${article.excerpt || ''} ${quote}`)
  const primary = concepts.map((concept) => concept.en[0])
  const alternates = concepts.flatMap((concept) => concept.en.slice(1))
  const english = [...new Set([...primary, ...alternates])].slice(0, 7)
  return { concepts, terms: english.length >= 2 ? english : words(quote).filter((word) => word.length > 4).slice(0, 7) }
}
const sentences = (value = '') => String(value).replace(/\r/g, '').split(/(?<=[.!؟…])\s+|\n{2,}/).map(clean).filter((item) => item.length >= 45)
const extractPredictions = (article) => {
  const output = []
  const seen = new Set()
  for (const sentence of sentences(`${article.title}. ${article.excerpt || ''}

${article.body || ''}`)) {
    if (!isPredictionSentence(sentence)) continue
    const value = sentence.slice(0, 360)
    const key = normalize(value)
    if (!key || seen.has(key)) continue
    seen.add(key)
    output.push(value)
    if (output.length >= 3) break
  }
  return output
}

function grabArray(source, name) {
  return (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) || [])[1] || ''
}

function loadStaticArticles() {
  const source = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
  return [...grabArray(source, 'articles').matchAll(/\{ slug: '([^']+)', title: '([^']+)', date: '([^']*)', iso: '([^']*)', cat: '([^']*)',\s*excerpt: '([^']*)'/g)]
    .map((match) => ({ slug: match[1], title: clean(match[2]), date: match[3], iso: match[4], cat: match[5], excerpt: clean(match[6]), body: clean(bodies[match[1]] || ''), kind: 'article' }))
}

function loadStaticPapers() {
  const source = readFileSync(resolve(ROOT, 'src/data/research-papers.ts'), 'utf8')
  const blocks = [...source.matchAll(/\{\n\s*slug: '([^']+)'([\s\S]*?)\n\s*\},/g)]
  return blocks.map((match) => {
    const block = match[2]
    const field = (name) => (block.match(new RegExp(`\\n\\s*${name}: '([^']*)'`)) || [])[1] || ''
    return { slug: match[1], title: clean(field('title')), titleAr: clean(field('titleAr')), doi: clean(field('doi')), iso: '', kind: 'paper' }
  }).filter((paper) => paper.title && paper.doi)
}

async function openFirestore() {
  const saPath = resolve(ROOT, process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`حساب الخدمة مفقود: ${saPath}`)
  const [{ initializeApp, cert, getApps }, { getFirestore, FieldValue }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/firestore'),
  ])
  const account = JSON.parse(readFileSync(saPath, 'utf8'))
  const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: process.env.FIREBASE_PROJECT_ID || account.project_id })
  return { db: getFirestore(app), FieldValue }
}

const published = (item) => item && item.hidden !== true && item.deleted !== true && item.status !== 'draft' && item.status !== 'hidden' && item.published !== false

async function loadCloudContent(db) {
  const [articlesSnap, papersSnap, existingSnap, radarSnap] = await Promise.all([
    db.collection('site_articles').get(), db.collection('site_papers').get(), db.collection('site_idea_life').get(), db.collection('site_radar').get(),
  ])
  const articles = articlesSnap.docs.map((doc) => ({ slug: doc.id, ...doc.data(), kind: 'article' })).filter(published)
  const papers = papersSnap.docs.map((doc) => ({ slug: doc.id, ...doc.data(), kind: 'paper' })).filter(published)
  const radar = radarSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter(published)
  const existing = new Map(existingSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }]))
  return { articles, papers, radar, existing }
}

function mergeBySlug(base, cloud) {
  const map = new Map(base.map((item) => [item.slug, item]))
  for (const item of cloud) map.set(item.slug, { ...(map.get(item.slug) || {}), ...item })
  return [...map.values()].filter((item) => item.slug && item.title)
}

const stale = (record) => {
  if (FORCE || !record?.checkedAt) return true
  const date = typeof record.checkedAt?.toDate === 'function' ? record.checkedAt.toDate() : new Date(record.checkedAt)
  return Number.isNaN(date.getTime()) || Date.now() - date.getTime() >= STALE_DAYS * 86_400_000
}

function canonicalUrl(value = '') {
  try {
    const url = new URL(value)
    url.hash = ''
    url.search = ''
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/$/, '')}`
  } catch { return '' }
}

async function liveUrl(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DrAlfailakawi-IdeaLife/1.0)' }, signal: AbortSignal.timeout(15_000) })
    return response.ok ? response.url : ''
  } catch { return '' }
}

function gdeltQuery(article) {
  const title = article.title.replace(/["“”]/g, '').slice(0, 180)
  const query = `\"${title}\" (Alfailakawi OR الفيلكاوي)`
  const start = /^\d{4}-\d{2}-\d{2}/.test(article.iso || '') ? article.iso.slice(0, 10).replaceAll('-', '') + '000000' : '20160101000000'
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=12&format=json&sort=HybridRel&startdatetime=${start}`
}

async function publicMentions(article) {
  if (article.title.length < 18) return []
  const original = canonicalUrl(article.source || '')
  try {
    const response = await fetch(gdeltQuery(article), { headers: { 'User-Agent': 'DrAlfailakawi-IdeaLife/1.0' }, signal: AbortSignal.timeout(25_000) })
    if (!response.ok) return []
    const payload = await response.json()
    const candidates = Array.isArray(payload?.articles) ? payload.articles : []
    const output = []
    for (const item of candidates) {
      if (!item?.url || !item?.title) continue
      let host = ''
      try { host = new URL(item.url).hostname.replace(/^www\./, '') } catch { continue }
      if (SITE_HOSTS.has(host)) continue
      const candidateCanonical = canonicalUrl(item.url)
      if (original && candidateCanonical === original) continue
      if (original && candidateCanonical.split('/')[0] === original.split('/')[0] && normalize(item.title) === normalize(article.title)) continue
      const match = ratio(article.title, item.title)
      if (match < .48 && overlap(article.title, item.title) < 4) continue
      const url = await liveUrl(item.url)
      if (!url) continue
      output.push({
        title: clean(item.title).slice(0, 220), summary: `ذكر عام مباشر رُصد خارج الموقع مع تطابق مرتفع بعنوان العمل.`,
        url, source: item.domain || host, publishedAt: String(item.seendate || '').replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'),
        type: 'media', confidence: Math.min(.98, .82 + match * .16), relation: 'ذكر عام مباشر',
      })
      if (output.length >= 4) break
    }
    return output
  } catch { return [] }
}

const OFFICIAL_SOURCE_RE = /(?:unesco|oecd|world bank|worldbank|who\b|unicef|government|ministry|gov\.|edu\.|جامعة|وزار|هيئة|منظمة|اليونسكو|الأمم المتحدة|البنك الدولي)/i
const STUDY_SOURCE_RE = /(?:study|research|journal|university|science|دراسة|بحث|باحث|جامعة|مجلة علمية)/i
const REPORT_SOURCE_RE = /(?:report|policy|framework|guidance|standard|survey|تقرير|سياسة|إطار|دليل|مسح)/i

function updateKind(value, source = '', url = '') {
  const text = `${value} ${source} ${url}`
  if (OFFICIAL_SOURCE_RE.test(text)) return 'official'
  if (REPORT_SOURCE_RE.test(text)) return 'report'
  if (STUDY_SOURCE_RE.test(text)) return 'study'
  return 'field'
}

function updateRelation(kind) {
  if (kind === 'study') return 'يضيف دليلاً أحدث إلى السؤال نفسه'
  if (kind === 'official') return 'يوسّع السياق المؤسسي للفكرة'
  if (kind === 'report') return 'يضع الموضوع داخل إطار أحدث'
  return 'ينقل النقاش من النص إلى الواقع'
}

function dateIso(value) {
  if (!value) return ''
  if (typeof value === 'string') return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''
  if (typeof value?.toDate === 'function') {
    try { return value.toDate().toISOString().slice(0, 10) } catch { return '' }
  }
  return ''
}

function researchSummary(article, item, index) {
  const source = item.publisher || item['container-title']?.[0] || 'مصدر علمي مفتوح'
  const templates = [
    `دراسة أحدث عبر ${source} تعيد اختبار محور «${article.title}» في سياق بحثي جديد، من دون تحويل نتيجة واحدة إلى حكم نهائي.`,
    `ينقل هذا العمل المنشور عبر ${source} سؤال «${article.title}» إلى بيانات أحدث وحدود منهجية تستحق القراءة بجوار النص.`,
    `إضافة علمية من ${source} توسّع الأدلة المتاحة حول القضية التي يناقشها «${article.title}».`,
    `بحث لاحق عبر ${source} يفتح زاوية قياس جديدة للموضوع نفسه، ويُعرض هنا بوصفه مستجداً لا تصحيحاً صامتاً للمقال.`,
  ]
  return templates[index % templates.length]
}

async function topicStudies(article) {
  const { concepts, terms } = researchQuery(article, `${article.title} ${article.excerpt || ''}`)
  if (terms.length < 2 || concepts.length < 2) return []
  const query = encodeURIComponent(terms.join(' '))
  const from = /^\d{4}-\d{2}-\d{2}/.test(article.iso || '') ? article.iso.slice(0, 10) : '2016-01-01'
  const url = `https://api.crossref.org/works?query.bibliographic=${query}&filter=from-pub-date:${from},type:journal-article&sort=published&order=desc&rows=12&select=DOI,title,publisher,container-title,published,URL&mailto=site@dr-alfailakawi.com`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'DrAlfailakawi-IdeaLife/2.0 (mailto:site@dr-alfailakawi.com)' }, signal: AbortSignal.timeout(25_000) })
    if (!response.ok) return []
    const items = (await response.json())?.message?.items || []
    const output = []
    for (const [index, item] of items.entries()) {
      const title = clean(Array.isArray(item.title) ? item.title[0] : item.title)
      const normalizedTitle = normalize(title)
      const matchedConcepts = concepts.filter((concept) => concept.en.some((term) => normalizedTitle.includes(term))).length
      if (!title || matchedConcepts < Math.min(2, concepts.length)) continue
      const target = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '')
      const live = target ? await liveUrl(target) : ''
      if (!live) continue
      const parts = item.published?.['date-parts']?.[0] || []
      const publishedAt = parts[0] ? `${parts[0]}-${String(parts[1] || 1).padStart(2, '0')}-${String(parts[2] || 1).padStart(2, '0')}` : ''
      const kind = 'study'
      output.push({
        title: title.slice(0, 240), summary: researchSummary(article, item, index), url: live,
        source: item.publisher || item['container-title']?.[0] || 'Crossref', publishedAt,
        discoveredAt: new Date().toISOString(), kind, relation: updateRelation(kind), confidence: Math.min(.97, .84 + matchedConcepts * .04),
      })
      if (output.length >= 4) break
    }
    return output
  } catch { return [] }
}

function radarUpdates(article, radar) {
  const articleText = `${article.title} ${article.excerpt || ''} ${article.cat || ''}`
  const articleDate = /^\d{4}-\d{2}-\d{2}/.test(article.iso || '') ? article.iso.slice(0, 10) : ''
  return radar
    .map((item) => {
      const publishedAt = dateIso(item.day) || dateIso(item.createdAt)
      const candidateText = `${item.ar || ''} ${item.arNote || ''} ${item.en || ''} ${item.enNote || ''}`
      const score = overlap(articleText, candidateText)
      const titleScore = overlap(article.title, `${item.ar || ''} ${item.en || ''}`)
      if (!item.url || !item.ar || (articleDate && publishedAt && publishedAt < articleDate) || score < 2 || (score === 2 && titleScore < 1)) return null
      const kind = updateKind(candidateText, item.source, item.url)
      return {
        title: clean(item.ar || item.en).slice(0, 240),
        summary: clean(item.arNote || item.enNote) || `مادة حديثة من ${item.source || 'مصدر موثوق'} تفتح زاوية جديدة في موضوع «${article.title}».`,
        url: item.url, source: item.source || '', publishedAt, discoveredAt: new Date().toISOString(), kind,
        relation: updateRelation(kind), confidence: Math.min(.97, .80 + score * .045 + titleScore * .025),
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) || b.confidence - a.confidence)
    .slice(0, 8)
}

function updateKey(item) {
  return canonicalUrl(item.url) || `title:${normalize(item.title)}`
}

function mergeUpdates(previous = [], fresh = [], blocked = new Set()) {
  const map = new Map()
  const now = new Date().toISOString()
  for (const item of previous) {
    const key = updateKey(item)
    if (!key || blocked.has(key)) continue
    map.set(key, item)
  }
  for (const item of fresh) {
    const key = updateKey(item)
    if (!key || blocked.has(key) || (item.confidence ?? 1) < .82) continue
    const old = map.get(key)
    map.set(key, { ...old, ...item, discoveredAt: old?.discoveredAt || item.discoveredAt || now })
  }
  const unique = []
  const titleSeen = new Set()
  for (const item of [...map.values()].sort((a, b) => String(b.publishedAt || b.discoveredAt || '').localeCompare(String(a.publishedAt || a.discoveredAt || '')) || (b.confidence || 0) - (a.confidence || 0))) {
    const title = normalize(item.title)
    if (!title || titleSeen.has(title)) continue
    titleSeen.add(title)
    unique.push(item)
  }
  return unique.slice(0, 12)
}

async function predictionEvidence(article, quote) {
  const { concepts, terms } = researchQuery(article, quote)
  if (terms.length < 2) return []
  const query = encodeURIComponent(terms.join(' '))
  const from = /^\d{4}-\d{2}-\d{2}/.test(article.iso || '') ? article.iso.slice(0, 10) : '2016-01-01'
  const url = `https://api.crossref.org/works?query.bibliographic=${query}&filter=from-pub-date:${from}&rows=4&select=DOI,title,publisher,published,URL&mailto=site@dr-alfailakawi.com`
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'DrAlfailakawi-IdeaLife/1.0 (mailto:site@dr-alfailakawi.com)' }, signal: AbortSignal.timeout(25_000) })
    if (!response.ok) return []
    const items = (await response.json())?.message?.items || []
    const evidence = []
    for (const item of items) {
      const title = clean(Array.isArray(item.title) ? item.title[0] : item.title)
      const normalizedTitle = normalize(title)
      const matchedConcepts = concepts.filter((concept) => concept.en.some((term) => normalizedTitle.includes(term))).length
      if (!title || (concepts.length ? matchedConcepts < Math.min(2, concepts.length) : overlap(quote, title) < 3)) continue
      const target = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '')
      const live = target ? await liveUrl(target) : ''
      if (!live) continue
      const parts = item.published?.['date-parts']?.[0] || []
      evidence.push({ title, summary: `دراسة ذات صلة موضوعية بالتوقع؛ تُعرض كدليل للمراجعة لا كحكم نهائي عليه.`, url: live, source: item.publisher || 'Crossref', publishedAt: parts[0] ? `${parts[0]}-${String(parts[1] || 1).padStart(2, '0')}-${String(parts[2] || 1).padStart(2, '0')}` : '', type: 'academic', confidence: .86, relation: 'دليل للمراجعة' })
      if (evidence.length >= 2) break
    }
    return evidence
  } catch { return [] }
}

async function crossrefWork(doi) {
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=site@dr-alfailakawi.com`, {
      headers: { 'User-Agent': 'DrAlfailakawi-IdeaLife/1.0 (mailto:site@dr-alfailakawi.com)' },
      signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) return null
    const item = (await response.json())?.message
    const title = clean(Array.isArray(item?.title) ? item.title[0] : item?.title)
    if (!title) return null
    const parts = item?.published?.['date-parts']?.[0] || item?.created?.['date-parts']?.[0] || []
    return {
      title,
      url: item?.URL || `https://doi.org/${doi}`,
      source: item?.publisher || item?.['container-title']?.[0] || 'Crossref',
      publishedAt: parts[0] ? `${parts[0]}-${String(parts[1] || 1).padStart(2, '0')}-${String(parts[2] || 1).padStart(2, '0')}` : '',
    }
  } catch { return null }
}

function extractCitingDois(rows, originalDoi) {
  const dois = []
  for (const row of rows) {
    for (const match of String(row?.citing || '').matchAll(/doi:([^\s;]+)/gi)) {
      const doi = match[1].replace(/[.,]+$/, '').toLowerCase()
      if (doi && doi !== originalDoi && !dois.includes(doi)) dois.push(doi)
      if (dois.length >= 4) break
    }
    if (dois.length >= 4) break
  }
  return dois
}

async function paperCitations(paper) {
  if (!paper.doi) return []
  const originalDoi = clean(paper.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase()
  try {
    const response = await fetch(`https://api.opencitations.net/index/v2/citations/doi:${encodeURIComponent(originalDoi)}`, {
      headers: { 'User-Agent': 'DrAlfailakawi-IdeaLife/1.0' }, signal: AbortSignal.timeout(25_000),
    })
    if (!response.ok) return []
    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : []
    const dois = extractCitingDois(rows, originalDoi)

    const signals = await Promise.all(dois.map(async (doi) => {
      const metadata = await crossrefWork(doi)
      if (!metadata) return null
      const live = await liveUrl(metadata.url)
      if (!live) return null
      return {
        title: metadata.title.slice(0, 240), summary: 'عمل علمي يذكر البحث في قائمة مراجعه وفق فهرس OpenCitations المفتوح.',
        url: live, source: metadata.source, publishedAt: metadata.publishedAt,
        type: 'academic', confidence: .99, relation: 'استشهاد علمي مباشر',
      }
    }))
    return signals.filter(Boolean)
  } catch { return [] }
}

function dimensions(hasEvidence) {
  return {
    direction: hasEvidence ? 'ظهرت مواد علمية حديثة على الخيط نفسه، من دون تحويلها وحدها إلى حكم نهائي.' : 'لا توجد بعد إشارة عامة كافية للحكم.',
    timing: hasEvidence ? 'بدأت المراجعة لأن دليلاً لاحقاً أصبح متاحاً.' : 'يبقى التوقع قيد المتابعة حتى ينضج زمنه أو يظهر حدث ذو صلة مباشرة.',
    scale: 'لا يُستنتج حجم التأثير من دراسة أو خبر منفرد.',
    scope: 'يظل الحكم مقيداً بالسياقات التي تغطيها الأدلة القابلة للتحقق.',
  }
}

async function buildArticleRecord(article, radar = [], previous = {}) {
  const quotes = extractPredictions(article)
  const [signals, studies, ...evidenceSets] = await Promise.all([
    publicMentions(article),
    topicStudies(article),
    ...quotes.map((quote) => predictionEvidence(article, quote)),
  ])
  const reviewedAt = new Date().toISOString()
  const predictions = quotes.map((quote, index) => {
    const evidence = evidenceSets[index] || []
    return { quote, status: evidence.length ? 'ظهرت أدلة جديدة' : 'قيد المتابعة', reviewedAt, evidence, dimensions: dimensions(evidence.length > 0) }
  })
  const blocked = new Set([
    ...signals.map(updateKey),
    ...predictions.flatMap((prediction) => (prediction.evidence || []).map(updateKey)),
  ])
  const updates = mergeUpdates(previous.updates, [...studies, ...radarUpdates(article, radar)], blocked)
  return {
    slug: article.slug, kind: 'article', title: article.title, articleIso: article.iso || '',
    predictions, signals, updates, checkedAt: reviewedAt,
    engine: 'local-rules+open-sources-v2', costModel: 'zero-paid-ai',
  }
}

async function buildPaperRecord(paper) {
  const signals = await paperCitations(paper)
  return { slug: paper.slug, kind: 'paper', title: paper.titleAr || paper.title, doi: paper.doi, predictions: [], signals, checkedAt: new Date().toISOString(), engine: 'opencitations-crossref-v1', costModel: 'zero-paid-ai' }
}

async function selfTest() {
  const sample = { title: 'حين تصبح الشهادة أقل قدرة على إثبات المهارة', excerpt: 'قد نصل في المستقبل إلى شهادة لا تعكس ما يستطيع صاحبها فعله.', body: 'سوف تتغير أدوات التقييم خلال السنوات القادمة. لكن الحكم يحتاج إلى دليل طويل المدى.' }
  const predictions = extractPredictions(sample)
  if (predictions.length !== 2) throw new Error(`فشل استخراج التوقعات: ${predictions.length}`)
  if (FUTURE_RE.test('قدرته على صياغة رأي مستقل')) throw new Error('التقط المحرك جزءاً من كلمة بوصفه توقعاً')
  if (!FUTURE_RE.test('سوف تتغير أدوات التقييم')) throw new Error('فشل حدّ الكلمة في توقع صريح')
  if (isPredictionSentence('كيف سيكون شكل التعليم في المستقبل؟')) throw new Error('التقط المحرك سؤالاً بوصفه توقعاً')
  if (isPredictionSentence('لا أحد يعرف ما سيحدث غداً')) throw new Error('التقط المحرك عدم اليقين بوصفه توقعاً')
  if (isPredictionSentence('وترى مايكروسوفت أن الواقع المعزز سيستبدل الهواتف')) throw new Error('نسب المحرك توقع جهة خارجية إلى الكاتب')
  if (overlap('الذكاء الاصطناعي في التعليم', 'استخدام الذكاء الاصطناعي داخل التعليم الجامعي') < 3) throw new Error('فشل التطابق الموضوعي')
  if (ratio('حين تصبح الشهادة أقل قدرة على إثبات المهارة', 'الشهادة وقدرتها على إثبات المهارة') < .45) throw new Error('فشل تطابق العنوان')
  const citing = extractCitingDois([{ citing: 'omid:br/1 doi:10.1000/first; doi:10.1000/second' }], '10.1000/original')
  if (citing.length !== 2 || citing[0] !== '10.1000/first') throw new Error('فشل استخراج DOI للاستشهادات')
  const query = researchQuery({ title: 'الذكاء الاصطناعي في التعليم', excerpt: '' }, 'ستتغير أدوات تقييم الطالب')
  if (!query.terms.includes('artificial intelligence') || !query.terms.includes('assessment')) throw new Error('فشل توسيع البحث العلمي ثنائي اللغة')
  if (canonicalUrl('https://www.example.com/a?x=1#top') !== 'example.com/a') throw new Error('فشل توحيد روابط الأثر')
  const radarFixture = radarUpdates(
    { ...sample, slug: 'sample', title: 'الذكاء الاصطناعي وتقييم الطلاب', excerpt: 'كيف يؤثر الذكاء الاصطناعي في تقييم تعلم الطلاب؟', iso: '2026-01-01', cat: 'تعليم' },
    [
      { ar: 'دراسة جديدة عن الذكاء الاصطناعي وتقييم الطلاب', arNote: 'تبحث الدراسة أثر الاستخدام الموجّه داخل التعليم.', en: 'AI and student assessment', source: 'University Research', url: 'https://example.org/study', day: '2026-07-01' },
      { ar: 'دراسة جديدة عن الذكاء الاصطناعي وتقييم الطلاب', arNote: 'نسخة مكررة.', en: 'AI and student assessment', source: 'University Research', url: 'https://example.org/study', day: '2026-07-01' },
      { ar: 'خبر رياضي لا علاقة له بالتعليم', arNote: 'نتيجة مباراة.', en: 'Sports result', source: 'News', url: 'https://example.org/sport', day: '2026-07-01' },
    ],
  )
  const merged = mergeUpdates([], radarFixture)
  if (merged.length !== 1 || merged[0].kind !== 'study') throw new Error('فشل تنويع مستجدات الفكرة أو منع التكرار')
  const staticArticles = loadStaticArticles()
  const staticPapers = loadStaticPapers()
  if (staticArticles.length < 100) throw new Error(`فشل قراءة المقالات الثابتة: ${staticArticles.length}`)
  if (staticPapers.length < 1) throw new Error('فشل قراءة الأبحاث ذات DOI')
  console.log(`✔ حياة الفكرة: ${staticArticles.length} مقالاً و${staticPapers.length} بحثاً — المستجدات متنوعة، بلا تكرار أو نموذج مدفوع`)
}

async function main() {
  if (SELF_TEST) return selfTest()
  const { db, FieldValue } = await openFirestore()
  const cloud = await loadCloudContent(db)
  const articles = mergeBySlug(loadStaticArticles(), cloud.articles)
  const papers = mergeBySlug(loadStaticPapers(), cloud.papers).filter((paper) => paper.doi)

  const dueArticles = articles.filter((article) => stale(cloud.existing.get(`article-${article.slug}`))).sort((a, b) => String(b.iso || '').localeCompare(String(a.iso || ''))).slice(0, MAX_ARTICLES)
  const duePapers = papers.filter((paper) => stale(cloud.existing.get(`paper-${paper.slug}`))).slice(0, MAX_PAPERS)
  console.log(`حياة الفكرة: ${dueArticles.length} مقالاً + ${duePapers.length} بحثاً`)

  for (const article of dueArticles) {
    const previous = cloud.existing.get(`article-${article.slug}`) || {}
    const record = await buildArticleRecord(article, cloud.radar, previous)
    const timestamps = previous.createdAt
      ? { updatedAt: FieldValue.serverTimestamp() }
      : { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
    await db.collection('site_idea_life').doc(`article-${article.slug}`).set({ ...record, ...timestamps }, { merge: true })
    console.log(`  • مقال: ${article.slug} — ${record.predictions.length} توقع، ${record.updates.length} مستجد، ${record.signals.length} أثر عام`)
  }
  for (const paper of duePapers) {
    const previous = cloud.existing.get(`paper-${paper.slug}`) || {}
    const record = await buildPaperRecord(paper)
    const timestamps = previous.createdAt
      ? { updatedAt: FieldValue.serverTimestamp() }
      : { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
    await db.collection('site_idea_life').doc(`paper-${paper.slug}`).set({ ...record, ...timestamps }, { merge: true })
    console.log(`  • بحث: ${paper.slug} — ${record.signals.length} استشهادات موثقة`)
  }
  console.log('✔ اكتملت المزامنة بلا ذكاء اصطناعي مدفوع')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
