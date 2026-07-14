#!/usr/bin/env node
/**
 * نشر ذاتي لقسمي «رسائل على الهامش» و«أسئلة تصلني».
 *
 * - يعمل يومياً من GitHub Actions، لكنه لا ينشر إلا عند حلول الموعد.
 * - الرسائل: كل 3–5 أيام، بنبرة متنوّعة، من محتوى الموقع نفسه.
 * - الأسئلة: كل 2–3 أيام، من تخصصات واهتمامات د. أحمد، بإجابة شديدة الاختصار.
 * - يمنع تكرار المصدر والموضوع والنبرة، ويحفظ الموعد التالي داخل Firestore.
 * - لا يقرأ البريد الشخصي ولا ينشر بيانات أشخاص.
 *
 * الاستخدام:
 *   npm run content:auto
 *   npm run content:auto -- --force
 *   npm run content:auto:self-test
 */
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const FORCE = args.has('--force')
const SELF_TEST = args.has('--self-test')

try { process.loadEnvFile(resolve(ROOT, '.env')) } catch { /* اختياري */ }

const env = { ...process.env }
const PROJECT_ID = env.FIREBASE_PROJECT_ID || 'drahmad-8e9e2'
const STATE_COLLECTION = 'automation_state'
const STATE_DOC = 'site-content-cycle'
const now = new Date()

const styles = [
  'تأمل هادئ',
  'اعتراض مهذب',
  'سؤال يفتح زاوية جديدة',
  'امتنان لفكرة',
  'مفارقة ذكية',
  'موقف تربوي مختصر',
  'وقفة إنسانية',
]

const topicFamilies = [
  'تكنولوجيا التعليم',
  'الذكاء الاصطناعي والتعليم',
  'التربية الأسرية',
  'الطفل والتكنولوجيا',
  'المعلم وتطوير الممارسة',
  'التقييم والقياس',
  'التفكير النقدي',
  'الهوية الرقمية',
  'أخلاقيات التقنية',
  'البحث العلمي',
  'التعليم الجامعي',
  'التعلم الإلكتروني',
  'المدارس الذكية',
  'التلعيب والألعاب التعليمية',
  'ذوو الاحتياجات الخاصة والتقنيات المساندة',
  'القيادة والابتكار',
  'الإعلام والمجتمع الرقمي',
  'الصحة النفسية في البيئة التعليمية',
]

const clean = (value = '') => String(value).replace(/\\'/g, "'").replace(/\s+/g, ' ').trim()
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 18)
const isoDay = (date = new Date()) => date.toISOString().slice(0, 10)
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000)
const dayNumber = Math.floor(Date.now() / 86_400_000)
const deterministicSpan = (min, max, salt = 0) => min + ((dayNumber + salt) % (max - min + 1))

function grabArray(source, name) {
  return (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) || [])[1] || ''
}

function loadSources() {
  const source = readFileSync(resolve(ROOT, 'data.ts'), 'utf8')
  const bodiesPath = resolve(ROOT, 'src/data/bodies.json')
  const bodies = existsSync(bodiesPath) ? JSON.parse(readFileSync(bodiesPath, 'utf8')) : {}

  const articles = [...grabArray(source, 'articles').matchAll(
    /\{ slug: '([^']+)', title: '([^']+)', date: '([^']*)', iso: '([^']*)', cat: '([^']*)',\s*excerpt: '([^']*)'/g,
  )].map((m) => ({
    key: `article:${m[1]}`,
    type: 'مقال',
    title: clean(m[2]),
    category: clean(m[5]),
    url: `/articles/${m[1]}`,
    text: clean(bodies[m[1]] || m[6]).slice(0, 5200),
  })).filter((item) => item.title && item.text)

  const books = [...grabArray(source, 'books').matchAll(
    /\{ slug: '([^']+)'[\s\S]*?title: '([^']+)'[\s\S]*?isbn: '([^']*)'[\s\S]*?cover: '([^']*)'[\s\S]*?pdf: '([^']*)'[\s\S]*?desc: '([^']*)'/g,
  )].map((m) => ({
    key: `book:${m[1]}`,
    type: 'كتاب',
    title: clean(m[2]),
    category: 'كتاب',
    url: `/publications/${m[1]}`,
    text: clean(m[6]),
  })).filter((item) => item.title && item.text)

  const media = [...grabArray(source, 'media').matchAll(
    /\{ title: '([^']+)', outlet: '([^']+)', url: '([^']+)' \}/g,
  )].map((m, index) => ({
    key: `media:${index}:${hash(m[1])}`,
    type: 'لقاء',
    title: clean(m[1]),
    category: clean(m[2]),
    url: clean(m[3]),
    text: `لقاء بعنوان «${clean(m[1])}» في ${clean(m[2])}.`,
  })).filter((item) => item.title)

  return [...articles, ...books, ...media]
}

function normalizeTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function due(nextAt) {
  if (FORCE) return true
  const date = normalizeTimestamp(nextAt)
  return !date || date.getTime() <= Date.now()
}

function chooseUnused(items, usedKeys, salt = 0) {
  const available = items.filter((item) => !usedKeys.has(item.key))
  const pool = available.length ? available : items
  if (!pool.length) throw new Error('لا توجد مصادر محلية صالحة للتوليد.')
  return pool[(dayNumber + salt) % pool.length]
}

function chooseUnusedText(items, used, salt = 0) {
  const available = items.filter((item) => !used.has(item))
  const pool = available.length ? available : items
  return pool[(dayNumber + salt) % pool.length]
}

async function geminiJson(prompt) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY أو GOOGLE_API_KEY مفقود')
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest']

  let lastError = ''
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.86 },
      }),
    })
    if (response.ok) {
      const payload = await response.json()
      const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error(`لم يُرجع ${model} نصاً.`)
      return JSON.parse(text)
    }
    lastError = `${model} → ${response.status}: ${(await response.text()).slice(0, 180)}`
    if (![404, 429, 503].includes(response.status)) break
  }
  throw new Error(`فشل التوليد: ${lastError}`)
}

function validateLetter(output) {
  const message = clean(output?.message)
  const reply = clean(output?.reply)
  if (message.length < 180 || message.length > 850) throw new Error(`طول الرسالة غير صالح: ${message.length}`)
  if (reply.length < 35 || reply.length > 260) throw new Error(`طول الرد غير صالح: ${reply.length}`)
  if (/اسمي|بريدي|رقم هاتفي|أنا فلان|وصلتك هذه الرسالة من/i.test(message)) throw new Error('الرسالة تحتوي تعريفاً شخصياً غير مطلوب.')
  return { message, reply }
}

function validateFaq(output) {
  const q = clean(output?.q)
  const a = clean(output?.a)
  if (q.length < 18 || q.length > 150) throw new Error(`طول السؤال غير صالح: ${q.length}`)
  if (a.length < 25 || a.length > 260) throw new Error(`طول الإجابة غير صالح: ${a.length}`)
  return { q, a }
}

async function generateLetter(source, style) {
  const prompt = `أنت محرر عربي يكتب لموقع د. أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم والذكاء الاصطناعي.
اكتب نصاً قصيراً بصوت قارئ يخاطب الدكتور مباشرة، بنبرة: «${style}».
المادة التي يجب أن تبني عليها النص حصراً:
النوع: ${source.type}
العنوان: ${source.title}
المجال: ${source.category}
النص: ${source.text}

أعد JSON فقط:
{"message":"...","reply":"..."}

قواعد ملزمة:
- الرسالة 70–125 كلمة، عربية بيضاء، إنسانية، ذكية، ولا تبدأ كل مرة بالعبارة نفسها.
- يجوز أن تبدأ بـ«دكتور أحمد» أو تدخل في الفكرة مباشرة.
- لا تذكر اسماً أو بريداً أو مدينة أو جهة أو توقيعاً للكاتب.
- لا تدّعِ حادثة شخصية محددة، ولا شهادة نجاح، ولا نتيجة واقعية لم تقع.
- لا تقل إن الرسالة وصلت بالبريد، ولا تستخدم عبارة «أنا أحد قرائك».
- اربط الرسالة بفكرة حقيقية من المادة، لا تنسخ منها فقرة طويلة.
- الرد 15–35 كلمة، بصوت د. أحمد، واضح وغير متكلّف.
- لا تستخدم وسوماً أو Markdown.`
  return validateLetter(await geminiJson(prompt))
}

async function generateFaq(source, topic) {
  const prompt = `أنت مساعد تحريري لموقع د. أحمد حسين الفيلكاوي.
أنشئ سؤالاً عاماً قصيراً جداً في مجال «${topic}»، مستنداً إلى الفكرة الآتية من محتوى الدكتور:
العنوان: ${source.title}
النص: ${source.text}

أعد JSON فقط:
{"q":"...","a":"..."}

القواعد:
- السؤال مستقل ومفهوم، من تخصصات واهتمامات الدكتور، وليس خبراً آنياً.
- نوّع بين التربية، التعليم، التقنية، الذكاء الاصطناعي، الأسرة، الطفل، المعلم، البحث، القيادة والمجتمع الرقمي.
- الإجابة جملة أو جملتان فقط، عملية وواضحة، من 18 إلى 42 كلمة.
- لا تكرر عنوان المادة حرفياً.
- لا تستخدم ادعاءات طبية أو قانونية أو أرقاماً غير موجودة في النص.
- لا تستخدم Markdown.`
  return validateFaq(await geminiJson(prompt))
}

async function firebaseContext() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`)
  const [{ initializeApp, cert, getApps }, { getFirestore, Timestamp, FieldValue }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'))
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID })
  return { db: getFirestore(app), Timestamp, FieldValue }
}

async function recentDocs(db, collectionName, limit = 40) {
  const snapshot = await db.collection(collectionName).orderBy('createdAt', 'desc').limit(limit).get()
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

async function run() {
  const sources = loadSources()
  if (SELF_TEST) {
    const articles = sources.filter((item) => item.type === 'مقال').length
    const books = sources.filter((item) => item.type === 'كتاب').length
    const media = sources.filter((item) => item.type === 'لقاء').length
    if (articles < 100 || books < 5 || media < 3) throw new Error(`مصادر غير كافية: ${articles}/${books}/${media}`)
    const sample = chooseUnused(sources, new Set(), 3)
    const sampleStyle = chooseUnusedText(styles, new Set(), 2)
    const sampleTopic = chooseUnusedText(topicFamilies, new Set(), 5)
    console.log(JSON.stringify({ ok: true, total: sources.length, articles, books, media, sample: sample.title, style: sampleStyle, topic: sampleTopic }, null, 2))
    return
  }

  const { db, Timestamp, FieldValue } = await firebaseContext()
  const stateRef = db.collection(STATE_COLLECTION).doc(STATE_DOC)
  const stateSnap = await stateRef.get()
  const state = stateSnap.exists ? stateSnap.data() : {}

  const [recentLetters, recentFaqs, recentRadar] = await Promise.all([
    recentDocs(db, 'site_inbox'),
    recentDocs(db, 'site_faqs'),
    recentDocs(db, 'site_radar', 20).catch(() => []),
  ])
  const radarSources = recentRadar.map((item) => {
    const title = clean(item.ar || item.title || item.en || '')
    const note = clean(item.arNote || item.summary || item.note || '')
    if (!title && !note) return null
    return {
      key: `radar:${item.id || hash(`${title}:${note}`)}`,
      type: 'رادار',
      title: title || 'لقطة من رادار الدكتور',
      category: clean(item.source || 'حدث تربوي/تقني راهن'),
      url: clean(item.url || '/radar'),
      text: clean(`${title}. ${note}`).slice(0, 2800),
    }
  }).filter(Boolean)
  const contentSources = [...radarSources, ...sources]

  const usedSourceKeys = new Set([
    ...recentLetters.map((item) => item.sourceKey).filter(Boolean),
    ...recentFaqs.map((item) => item.sourceKey).filter(Boolean),
  ])
  const usedStyles = new Set(recentLetters.slice(0, styles.length).map((item) => item.tone).filter(Boolean))
  const usedTopics = new Set(recentFaqs.slice(0, topicFamilies.length).map((item) => item.topicFamily).filter(Boolean))

  let published = 0
  const statePatch = { updatedAt: FieldValue.serverTimestamp() }

  if (due(state?.nextLetterAt)) {
    const source = chooseUnused(contentSources, usedSourceKeys, 11)
    const style = chooseUnusedText(styles, usedStyles, 7)
    const letter = await generateLetter(source, style)
    const id = `auto-${isoDay(now)}-${hash(`${source.key}:${letter.message}`)}`
    await db.collection('site_inbox').doc(id).set({
      ...letter,
      tone: style,
      sourceKey: source.key,
      sourceType: source.type,
      sourceTitle: source.title,
      sourcePath: source.url,
      autoGenerated: true,
      status: 'published',
      published: true,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: false })
    statePatch.lastLetterAt = FieldValue.serverTimestamp()
    statePatch.nextLetterAt = Timestamp.fromDate(addDays(now, deterministicSpan(3, 5, 13)))
    statePatch.lastLetterSource = source.key
    published += 1
    usedSourceKeys.add(source.key)
    console.log(`✔ رسالة جديدة: ${source.title} · ${style}`)
  } else {
    console.log(`— الرسالة التالية ليست مستحقة بعد: ${normalizeTimestamp(state?.nextLetterAt)?.toISOString() || 'غير محدد'}`)
  }

  if (due(state?.nextFaqAt)) {
    const source = chooseUnused(contentSources, usedSourceKeys, 29)
    const topic = chooseUnusedText(topicFamilies, usedTopics, 17)
    const faq = await generateFaq(source, topic)
    const id = `auto-${isoDay(now)}-${hash(`${source.key}:${faq.q}`)}`
    await db.collection('site_faqs').doc(id).set({
      ...faq,
      topicFamily: topic,
      sourceKey: source.key,
      sourceType: source.type,
      sourceTitle: source.title,
      autoGenerated: true,
      status: 'published',
      published: true,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: false })
    statePatch.lastFaqAt = FieldValue.serverTimestamp()
    statePatch.nextFaqAt = Timestamp.fromDate(addDays(now, deterministicSpan(2, 3, 31)))
    statePatch.lastFaqSource = source.key
    published += 1
    console.log(`✔ سؤال جديد: ${faq.q} · ${topic}`)
  } else {
    console.log(`— السؤال التالي ليس مستحقاً بعد: ${normalizeTimestamp(state?.nextFaqAt)?.toISOString() || 'غير محدد'}`)
  }

  await stateRef.set(statePatch, { merge: true })
  console.log(published ? `\n✔ نُشر ${published} عنصر تلقائياً.` : '\n✔ لا نشر اليوم؛ الجدولة تعمل كما ينبغي.')
}

await run()
