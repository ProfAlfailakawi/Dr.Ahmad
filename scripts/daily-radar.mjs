#!/usr/bin/env node
/**
 * «رادار المختارات» — التقاط يومي آلي من الإنترنت، بلا تدخل بشري.
 *
 * - المصدر مغلق على قائمة المؤسسات والمجلات الموجودة في editorial-policy.json.
 * - التصفية الميكانيكية تمنع الموضوعات غير المناسبة والمصادر غير المعتمدة.
 * - يترجم العنوان والخلاصة إلى العربية تلقائياً ترجمة أمينة، ويحتفظ بالرابط الأصلي كما هو.
 * - إن تعذرت خدمة الترجمة لا يظهر نص إنجليزي في الموقع؛ يُستخدم وصف عربي آمن مؤقتاً وتُعاد المحاولة لاحقاً.
 * - التنويع مفروضٌ في الاختيار: مصدرٌ ظهر حديثاً يتأخّر عن مصدرٍ لم يظهر.
 * - وثيقة واحدة كحد أقصى يومياً في site_radar، والرابط الأصلي لا يكتبه النموذج.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { POLICY, evaluateCandidate } from './editorial-policy.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const decodeEntities = (value = '') => String(value)
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;/gi, ' ')

const strip = (value = '') => decodeEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseDate = (raw = '') => {
  const text = strip(raw)
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function firstMatch(block, expressions) {
  for (const expression of expressions) {
    const match = block.match(expression)
    if (match?.[1]) return match[1]
  }
  return ''
}

export function parseFeed(xml, source) {
  const blocks = [...String(xml).matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)]
    .slice(0, 14)
    .map((match) => match[0])

  return blocks.map((block) => {
    const rawLink = firstMatch(block, [
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i,
      /<link\b[^>]*>([\s\S]*?)<\/link>/i,
      /<guid\b[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i,
    ])
    let link = strip(rawLink)
    try { link = new URL(link, source.feedUrl).href } catch { link = '' }

    const description = firstMatch(block, [
      /<description\b[^>]*>([\s\S]*?)<\/description>/i,
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/i,
      /<content(?::encoded)?\b[^>]*>([\s\S]*?)<\/content(?::encoded)?>/i,
    ])
    const rawDate = firstMatch(block, [
      /<pubDate\b[^>]*>([\s\S]*?)<\/pubDate>/i,
      /<published\b[^>]*>([\s\S]*?)<\/published>/i,
      /<updated\b[^>]*>([\s\S]*?)<\/updated>/i,
      /<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i,
    ])
    const publishedAt = parseDate(rawDate)

    return {
      source: source.name,
      title: strip(firstMatch(block, [/<title\b[^>]*>([\s\S]*?)<\/title>/i])),
      link,
      desc: strip(description).slice(0, 700),
      publishedAt,
    }
  }).filter((item) => item.title && item.link)
}

async function fetchFeed(source) {
  try {
    const response = await fetch(source.feedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (alfailakawi-curated-radar/2.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      console.warn(`  ⚠ ${source.name}: HTTP ${response.status}`)
      return []
    }
    const items = parseFeed(await response.text(), source)
    console.log(`  • ${source.name}: ${items.length} مادة`)
    return items
  } catch (error) {
    console.warn(`  ⚠ ${source.name}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

const topicSignals = [
  'education', 'learning', 'school', 'teacher', 'student', 'university', 'classroom',
  'artificial intelligence', 'generative ai', 'ai ', 'edtech', 'literacy', 'curriculum',
  'تعليم', 'تعلم', 'مدرس', 'معلم', 'طالب', 'جامعة', 'ذكاء اصطناعي', 'تقنية', 'منهج',
]

/* ═══ الموضوع بالعربية — استنتاجٌ ميكانيكيّ لا ترجمة ═══
 *
 * لا نترجم العنوان (لا نملك مترجماً أميناً بلا نموذج)، لكننا نستطيع أن نقول
 * بصدقٍ في أي بابٍ تقع المادة: نعدّ إشاراتِ كل باب في العنوان والوصف، ونسمّي
 * الأعلى. جملةٌ قصيرة، مختلفةٌ من مادةٍ لأخرى، ولا تدّعي ما ليس في النص.
 */
const TOPIC_BUCKETS = [
  { label: 'الذكاء الاصطناعي في التعليم', signals: ['artificial intelligence', 'generative ai', 'chatgpt', 'llm', 'machine learning', 'algorithm', 'ai '] },
  { label: 'التقييم والامتحانات', signals: ['exam', 'test score', 'assessment', 'grading', 'grade', 'standardized'] },
  { label: 'المعلّم والممارسة الصفّية', signals: ['teacher', 'teaching', 'classroom', 'instruction', 'pedagog', 'curriculum'] },
  { label: 'الطالب والتحصيل', signals: ['student', 'learner', 'literacy', 'absent', 'enrollment', 'dropout', 'achievement'] },
  { label: 'التعليم الجامعي', signals: ['university', 'college', 'campus', 'higher education', 'undergraduate', 'faculty'] },
  { label: 'سياسات التعليم وتمويله', signals: ['policy', 'funding', 'district', 'reform', 'budget', 'legislat', 'federal'] },
  { label: 'التكنولوجيا والمجتمع الرقمي', signals: ['technology', 'digital', 'platform', 'device', 'screen', 'social media', 'edtech'] },
  { label: 'البحث العلمي والدراسات', signals: ['research', 'study finds', 'researchers', 'evidence', 'data show'] },
]

function topicOf(item) {
  const text = `${item.title} ${item.desc}`.toLocaleLowerCase('en')
  let best = null
  for (const bucket of TOPIC_BUCKETS) {
    const hits = bucket.signals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0)
    if (hits && (!best || hits > best.hits)) best = { label: bucket.label, hits }
  }
  return best?.label || 'التعليم والتكنولوجيا'
}

function candidateScore(item, tiredSources = new Map()) {
  const text = `${item.title} ${item.desc}`.toLocaleLowerCase('en')
  const signalScore = topicSignals.reduce((score, signal) => score + (text.includes(signal) ? 7 : 0), 0)
  const ageHours = item.publishedAt ? Math.max(0, (Date.now() - item.publishedAt.getTime()) / 3_600_000) : 240
  const freshnessScore = Math.max(0, 36 - Math.min(36, ageHours / 12))
  const detailScore = Math.min(12, item.desc.length / 55)
  /* التنويع: مصدرٌ نشر لنا أمس أقلُّ استحقاقاً من مصدرٍ لم يظهر منذ أسبوعين.
     أربع بطاقاتٍ متتالية من دارٍ واحدة تجعل «الرادار» صفحةَ نشرةٍ واحدة. */
  const recent = tiredSources.get(item.source) || 0
  const varietyPenalty = recent * 26
  return signalScore + freshnessScore + detailScore - varietyPenalty
}

function pickCandidate(items, tiredSources = new Map()) {
  return [...items].sort((left, right) => candidateScore(right, tiredSources) - candidateScore(left, tiredSources))[0] || null
}

const hasArabic = (value = '') => /[ء-ي]/.test(value)
const hasLatin = (value = '') => /[A-Za-z]/.test(value)
const cleanJson = (value = '') => String(value).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()

/* المصطلحات التي تنجو من الترجمة الآلية بحروفٍ لاتينية — نُعرّبها كي تجتاز
   بوابة العرض التي ترفض أي حرفٍ لاتيني في صفحةٍ اشترط مالكها أن تكون عربية. */
const TRANSLIT = [
  [/\bChatGPT\b/gi, 'شات جي بي تي'],
  [/\bNotebookLM\b/gi, 'نوتبوك إل إم'],
  [/\bOpenAI\b/gi, 'أوبن إيه آي'],
  [/\bMicrosoft\b/gi, 'مايكروسوفت'],
  [/\bGoogle\b/gi, 'غوغل'],
  [/\bChatbot(s)?\b/gi, 'روبوت المحادثة'],
  [/\bAI\b/gi, 'الذكاء الاصطناعي'],
  [/\bLMS\b/gi, 'نظام إدارة التعلّم'],
  [/\bSTEM\b/gi, 'العلوم والتكنولوجيا والهندسة والرياضيات'],
  [/\bEdTech\b/gi, 'تقنيات التعليم'],
]
const arabize = (value = '') => {
  let text = String(value).replace(/\s+/g, ' ').trim()
  for (const [pattern, replacement] of TRANSLIT) text = text.replace(pattern, replacement)
  return text.replace(/\s+/g, ' ').trim()
}
/** يقبل النص فقط إن صار عربياً خالصاً بلا حرفٍ لاتيني (مطابقةً لبوابة العرض). */
const acceptArabic = (value = '') => {
  const text = arabize(value)
  return text && hasArabic(text) && !hasLatin(text) ? text : ''
}

function fallbackArabic() {
  return { titleAr: '', summaryAr: '', translationStatus: 'pending' }
}

/* مسارٌ مجاني تماماً للتعريب: بلا مفتاح ولا فوترة (أمر الدكتور: لا خدمات مدفوعة).
   نقطة غوغل المجانية أولاً لجودتها، ثم MyMemory احتياطاً. لا يُنشر نصٌّ إنجليزي:
   إن فشل المساران يبقى الحقل فارغاً وتُعاد المحاولة لاحقاً. */
async function googleFreeTranslate(text) {
  if (!text) return ''
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(String(text).slice(0, 800))}`
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20_000) })
  if (!response.ok) return ''
  const data = await response.json()
  return Array.isArray(data?.[0]) ? strip(data[0].map((segment) => segment?.[0] || '').join('')) : ''
}
async function myMemoryTranslate(text) {
  if (!text) return ''
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(String(text).slice(0, 480))}&langpair=en|ar`
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) return ''
  const data = await response.json()
  return strip(data?.responseData?.translatedText || '')
}
async function freeTranslateArabic(item) {
  for (const engine of [googleFreeTranslate, myMemoryTranslate]) {
    try {
      const titleAr = acceptArabic(await engine(item.title))
      if (!titleAr) continue
      const summaryAr = item.desc ? acceptArabic(await engine(item.desc)) : ''
      return { titleAr: titleAr.slice(0, 180), summaryAr: summaryAr.slice(0, 340), translationStatus: 'translated' }
    } catch { /* نجرّب المحرك التالي المجاني */ }
  }
  return fallbackArabic(item)
}

/** التعريب الموحّد: Gemini إن توفّر مفتاحٌ عامل، وإلا المسار المجاني الكامل. */
async function translateArabic(item) {
  const gemini = await geminiTranslate(item)
  if (gemini.translationStatus === 'translated') return gemini
  return freeTranslateArabic(item)
}

async function geminiTranslate(item) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
  if (!key) return fallbackArabic(item)
  const models = env.GEMINI_MODEL ? [env.GEMINI_MODEL] : ['gemini-flash-latest', 'gemini-flash-lite-latest']
  const prompt = `ترجم المادة التالية إلى العربية الفصحى المعاصرة ترجمة دقيقة بلا إضافة أي معلومة غير موجودة.\nأعد JSON فقط بالشكل: {"titleAr":"...","summaryAr":"..."}.\n- العنوان العربي واضح وطبيعي، لا يتجاوز 120 حرفاً.\n- الخلاصة العربية جملة أو جملتان، لا تتجاوز 260 حرفاً.\n- لا تكتب الاسم الإنجليزي أو النص الإنجليزي داخل الحقول العربية إلا الاختصارات العلمية التي لا بد منها.\nالعنوان: ${item.title}\nالوصف: ${item.desc || ''}\nالمصدر: ${item.source}`
  for (const model of models) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.15 } }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) continue
      const payload = await response.json()
      const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = JSON.parse(cleanJson(raw))
      const titleAr = strip(parsed?.titleAr).slice(0, 180)
      const summaryAr = strip(parsed?.summaryAr).slice(0, 340)
      if (hasArabic(titleAr) && hasArabic(summaryAr)) return { titleAr, summaryAr, translationStatus: 'translated' }
    } catch { /* نجرب النموذج التالي ثم البديل الآمن */ }
  }
  return fallbackArabic(item)
}

function sourceSummary(item, translation) {
  const translated = translation || fallbackArabic()
  return {
    ar: translated.titleAr,
    arNote: translated.summaryAr,
    en: item.title,
    enNote: item.desc ? item.desc.slice(0, 260) : '',
    source: item.source,
    url: item.link,
    publishedAt: item.publishedAt?.toISOString() || '',
    translationStatus: translated.translationStatus || 'fallback',
  }
}

async function firestoreToken() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`)
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'))
  const issuedAt = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: issuedAt,
    exp: issuedAt + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(serviceAccount.private_key).toString('base64url')
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  })
  if (!response.ok) throw new Error(`OAuth ${response.status}: ${(await response.text()).slice(0, 160)}`)
  return (await response.json()).access_token
}

const firestoreBase = () => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

async function todayAlreadyPublished(token, day) {
  const response = await fetch(`${firestoreBase()}/site_radar/${day}`, { headers: { Authorization: `Bearer ${token}` } })
  return response.ok
}

/**
 * ما نُشر قريباً: روابطُه لمنع التكرار، ومصادرُه لفرض التنويع.
 * ووزن الإرهاق يتدرّج: آخرُ ما نُشر أثقل من الذي قبله، فلا يُمنع المصدر
 * الجيد إلى الأبد — يتأخّر أياماً ثم يعود.
 */
async function recentRadar(token) {
  try {
    const response = await fetch(`${firestoreBase()}/site_radar?pageSize=60`, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) return { urls: new Set(), tiredSources: new Map(), documents: [] }
    const payload = await response.json()
    const documents = (payload.documents || [])
      .map((document) => ({
        url: document.fields?.url?.stringValue || '',
        source: document.fields?.source?.stringValue || '',
        day: document.fields?.day?.stringValue || '',
        name: String(document.name || '').split('/').pop(),
        ar: document.fields?.ar?.stringValue || '',
        en: document.fields?.en?.stringValue || '',
        enNote: document.fields?.enNote?.stringValue || '',
        translationStatus: document.fields?.translationStatus?.stringValue || '',
      }))
      .sort((left, right) => right.day.localeCompare(left.day))
    const urls = new Set(documents.map((document) => document.url).filter(Boolean))
    const tiredSources = new Map()
    documents.slice(0, 6).forEach((document, index) => {
      if (!document.source) return
      const weight = (6 - index) / 6            // الأحدث ١٫٠ ثم يتناقص
      tiredSources.set(document.source, (tiredSources.get(document.source) || 0) + weight)
    })
    return { urls, tiredSources, documents }
  } catch { return { urls: new Set(), tiredSources: new Map(), documents: [] } }
}

async function repairMissingArabic(token, documents = []) {
  const missing = documents.filter((item) => item.name && item.en && (!hasArabic(item.ar) || item.translationStatus !== 'translated')).slice(0, 12)
  if (!missing.length) return
  console.log(`إصلاح عربي: ${missing.length} بطاقة قديمة`)
  for (const item of missing) {
    const translated = await translateArabic({ title: item.en, desc: item.enNote, source: item.source })
    if (translated.translationStatus !== 'translated') {
      console.warn(`  ⚠ الترجمة غير متاحة الآن لـ ${item.name}؛ ستُعاد المحاولة في التشغيل التالي.`)
      continue
    }
    const fields = {
      ar: { stringValue: translated.titleAr },
      arNote: { stringValue: translated.summaryAr },
      translationStatus: { stringValue: translated.translationStatus },
    }
    const response = await fetch(`${firestoreBase()}/site_radar/${encodeURIComponent(item.name)}?updateMask.fieldPaths=ar&updateMask.fieldPaths=arNote&updateMask.fieldPaths=translationStatus`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
    })
    if (!response.ok) console.warn(`  ⚠ تعذر تحديث ${item.name}: ${response.status}`)
  }
}

async function publish(item, token, day) {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID مفقود')
  const values = { ...item, status: 'published', day, createdAt: new Date().toISOString() }
  const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: String(value || '') }]))
  const response = await fetch(`${firestoreBase()}/site_radar/${day}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${(await response.text()).slice(0, 220)}`)
}

function selfTest() {
  const fixture = `<?xml version="1.0"?><rss><channel><item><title>AI literacy for teachers</title><link>https://example.org/story</link><description>New education research for classroom learning.</description><pubDate>Tue, 14 Jul 2026 08:00:00 GMT</pubDate></item></channel></rss>`
  const items = parseFeed(fixture, { name: 'Fixture', feedUrl: 'https://example.org/feed' })
  if (items.length !== 1 || !items[0].desc || !items[0].publishedAt) throw new Error('فشل اختبار قارئ RSS')
  const selected = pickCandidate(items)
  if (!selected || selected.link !== 'https://example.org/story') throw new Error('فشل اختبار الاختيار')

  /* ١) لا جملةً قالبيةً بعد اليوم: بطاقتان من مصدرٍ واحد يجب أن تختلفا. */
  const cardA = sourceSummary({ ...selected, source: 'Fixture' }, { titleAr: 'محو الأمية بالذكاء الاصطناعي للمعلمين', summaryAr: 'بحث جديد عن التعلم داخل الصف.', translationStatus: 'translated' })
  const cardB = sourceSummary({
    source: 'Fixture', title: 'University funding policy reform debated', link: 'https://example.org/two',
    desc: 'Lawmakers weigh a new budget for higher education districts.', publishedAt: new Date(),
  }, { titleAr: 'نقاش حول إصلاح تمويل الجامعات', summaryAr: 'مقترح جديد لميزانيات التعليم العالي.', translationStatus: 'translated' })
  if (!hasArabic(cardA.ar) || !hasArabic(cardB.ar)) throw new Error('العنوان العربي الاحتياطي مفقود')
  if (!cardA.en || cardA.en !== selected.title) throw new Error('العنوان الأصلي يجب أن يبقى محفوظاً للمرجع')
  if (cardA.arNote === cardB.arNote) throw new Error('السطر العربي قالبيّ — مادتان مختلفتان أعطتا السطر نفسه')
  if (cardA.url !== selected.link) throw new Error('الرابط تغيّر')

  /* ٢) التنويع فعّالٌ لا شعار: مصدرٌ ظهر أمس يخسر أمام مصدرٍ لم يظهر. */
  const rivalPublishedAt = new Date()
  const rivals = [
    { source: 'Tired', title: 'AI in the classroom for teachers', link: 'https://a.org/1', desc: 'A long piece about artificial intelligence and student learning in school.'.repeat(3), publishedAt: rivalPublishedAt },
    { source: 'Fresh', title: 'AI in the classroom for teachers', link: 'https://b.org/1', desc: 'A long piece about artificial intelligence and student learning in school.'.repeat(3), publishedAt: rivalPublishedAt },
  ]
  if (pickCandidate(rivals, new Map()).source !== 'Tired') throw new Error('الترتيب الأساسي اختلّ')
  if (pickCandidate(rivals, new Map([['Tired', 1]])).source !== 'Fresh') throw new Error('التنويع لا يعمل — المصدر المُرهَق ما زال يفوز')

  console.log(JSON.stringify({
    ok: true, sources: POLICY.allowedSources.length, parsed: items.length,
    selected: selected.title, topic: cardA.arNote, variety: 'enforced', arabic: 'automatic',
  }, null, 2))
}

if (SELF_TEST) {
  selfTest()
  process.exit(0)
}

const day = new Date().toISOString().slice(0, 10)
console.log(`رادار المختارات · ${day} · ${POLICY.allowedSources.length} مصادر موثوقة\n`)

const token = await firestoreToken()
const recentState = await recentRadar(token)
await repairMissingArabic(token, recentState.documents)
if (await todayAlreadyPublished(token, day)) {
  console.log(`✔ مختارة اليوم (${day}) منشورة أصلاً، وتمت مراجعة التعريب القديم.`)
  process.exit(0)
}

const raw = (await Promise.all(POLICY.allowedSources.map(fetchFeed))).flat()
console.log(`\nالتقط ${raw.length} مادة خام`)

const { urls: recentUrls, tiredSources } = recentState
const pool = raw.filter((item) => {
  if (recentUrls.has(item.link)) return false
  if (item.publishedAt && Date.now() - item.publishedAt.getTime() > 21 * 86_400_000) return false
  return evaluateCandidate({
    source: item.source,
    url: item.link,
    title: item.title,
    summary: item.desc,
  }).allowed
})

console.log(`نجا من التحقق: ${pool.length} مادة`)
if (!pool.length) {
  console.log('⊘ لا توجد مادة حديثة وآمنة من القائمة الموثوقة الآن؛ سيعيد المجدول المحاولة لاحقاً اليوم.')
  process.exit(0)
}

if (tiredSources.size) {
  console.log(`تنويع: ${[...tiredSources.keys()].join(' · ')} ظهرت حديثاً — تتأخّر في الترجيح`)
}

const chosen = pickCandidate(pool, tiredSources)
const translation = await translateArabic(chosen)
if (translation.translationStatus !== 'translated') {
  console.log('⊘ تعذرت الترجمة العربية الدقيقة؛ لن تُنشر عبارة عامة. سيعيد المجدول المحاولة لاحقاً.')
  process.exit(0)
}
const summary = sourceSummary(chosen, translation)
console.log(`اختار: ${chosen.title}\nالمصدر: ${chosen.source}\nالباب: ${summary.arNote}\nالرابط: ${chosen.link}`)
await publish(summary, token, day)
console.log('\n✔ نُشرت مختارة الإنترنت في site_radar وتظهر فوراً في /curated')
