#!/usr/bin/env node
/**
 * نشر ذاتي موثوق لقسمي «رسائل على الهامش» و«أسئلة تصلني».
 *
 * - يعمل عدة مرات يومياً من GitHub Actions، لكنه ينشر وفق موعده فقط.
 * - يزرع تلقائياً حدّاً أولياً: أربع رسائل + عشرة أسئلة إذا كان الأرشيف أقل من ذلك.
 * - الرسائل: رسالة جديدة كل 3 أيام، من مقالات الدكتور وكتبه ولقاءاته، وبنبرات متنوّعة.
 * - الأسئلة: سؤال جديد كل يومين، عام وقصير جداً، من تخصصاته واهتماماته.
 *  * - يمنع تكرار المصدر والموضوع والنبرة، ويتعافى من تعطل تشغيل سابق.
 * - لا يقرأ البريد الشخصي ولا ينشر بيانات أشخاص؛ النصوص تُولد من أرشيف الدكتور نفسه.
 * - المختارات لا تُنشأ هنا إطلاقاً؛ مصدرها الوحيد رادار الإنترنت scripts/daily-radar.mjs.
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
const GENERATION_VERSION = '2026-07-14-v5-no-local-picks'
const now = new Date()

const integerEnv = (name, fallback) => {
  const value = Number.parseInt(env[name] || '', 10)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

const MIN_LETTERS = integerEnv('AUTO_CONTENT_MIN_LETTERS', 4)
const MIN_FAQS = integerEnv('AUTO_CONTENT_MIN_FAQS', 10)
const MIN_PICKS = 0 // المختارات من الإنترنت فقط؛ لا تُولد من أرشيف الدكتور
const MAX_GENERATED_PER_KIND = integerEnv('AUTO_CONTENT_MAX_PER_KIND', 10)

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

const sourceTypeCycle = ['مقال', 'كتاب', 'لقاء']
const clean = (value = '') => String(value).replace(/\\'/g, "'").replace(/\s+/g, ' ').trim()
const hash = (value) => createHash('sha256').update(String(value)).digest('hex').slice(0, 18)
const isoDay = (date = new Date()) => date.toISOString().slice(0, 10)
const addDays = (date, days) => new Date(date.getTime() + days * 86_400_000)
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const dayNumber = Math.floor(Date.now() / 86_400_000)

function grabArray(source, name) {
  return (source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\n\\]`)) || [])[1] || ''
}

function loadSources() {
  const source = readFileSync(resolve(ROOT, 'data.ts'), 'utf8')
  const bodiesPath = resolve(ROOT, 'src/data/bodies.json')
  const bodies = existsSync(bodiesPath) ? JSON.parse(readFileSync(bodiesPath, 'utf8')) : {}

  const articles = [...grabArray(source, 'articles').matchAll(
    /\{ slug: '([^']+)', title: '([^']+)', date: '([^']*)', iso: '([^']*)', cat: '([^']*)',\s*excerpt: '([^']*)'/g,
  )].map((match) => ({
    key: `article:${match[1]}`,
    type: 'مقال',
    title: clean(match[2]),
    category: clean(match[5]),
    url: `/articles/${match[1]}`,
    text: clean(bodies[match[1]] || match[6]).slice(0, 5200),
  })).filter((item) => item.title && item.text)

  const books = [...grabArray(source, 'books').matchAll(
    /\{ slug: '([^']+)'[\s\S]*?title: '([^']+)'[\s\S]*?isbn: '([^']*)'[\s\S]*?cover: '([^']*)'[\s\S]*?pdf: '([^']*)'[\s\S]*?desc: '([^']*)'/g,
  )].map((match) => ({
    key: `book:${match[1]}`,
    type: 'كتاب',
    title: clean(match[2]),
    category: 'كتاب',
    url: `/publications/${match[1]}`,
    text: clean(match[6]),
  })).filter((item) => item.title && item.text)

  const media = [...grabArray(source, 'media').matchAll(
    /\{ title: '([^']+)', outlet: '([^']+)', url: '([^']+)' \}/g,
  )].map((match, index) => ({
    key: `media:${index}:${hash(match[1])}`,
    type: 'لقاء',
    title: clean(match[1]),
    category: clean(match[2]),
    url: clean(match[3]),
    text: `لقاء بعنوان «${clean(match[1])}» في ${clean(match[2])}.`,
  })).filter((item) => item.title)

  return [...articles, ...books, ...media]
}

function normalizeTimestamp(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000)
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

function isPublished(item) {
  return item?.published !== false && item?.status !== 'draft' && item?.status !== 'hidden'
}

function createdToday(items) {
  const today = isoDay(now)
  return items.some((item) => {
    if (!item?.autoGenerated) return false
    const date = normalizeTimestamp(item.createdAt)
    return date && isoDay(date) === today
  })
}

function chooseUnusedText(items, used, salt = 0) {
  const available = items.filter((item) => !used.has(item))
  const pool = available.length ? available : items
  return pool[(dayNumber + salt) % pool.length]
}

function chooseDiverseSource(items, usedKeys, salt = 0) {
  const unused = items.filter((item) => !usedKeys.has(item.key))
  const allPool = unused.length ? unused : items
  if (!allPool.length) throw new Error('لا توجد مصادر محلية صالحة للتوليد.')

  for (let offset = 0; offset < sourceTypeCycle.length; offset += 1) {
    const preferred = sourceTypeCycle[(dayNumber + salt + offset) % sourceTypeCycle.length]
    const typePool = allPool.filter((item) => item.type === preferred)
    if (typePool.length) return typePool[(dayNumber * 3 + salt) % typePool.length]
  }
  return allPool[(dayNumber + salt) % allPool.length]
}

async function geminiJson(prompt) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY أو GOOGLE_API_KEY مفقود')
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest']

  let lastError = ''
  for (let round = 0; round < 2; round += 1) {
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
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) break
    }
    if (round === 0) await sleep(12_000)
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

const pickKinds = new Set(['اقتباس وتأمل', 'الرف المنسي', 'أداة تستحق', 'مفهوم ناشئ', 'رؤية عميقة'])

function validatePick(output, source) {
  const ar = clean(output?.ar)
  const arNote = clean(output?.arNote)
  const en = clean(output?.en)
  const enNote = clean(output?.enNote)
  const kind = pickKinds.has(clean(output?.kind)) ? clean(output.kind) : 'رؤية عميقة'
  if (ar.length < 12 || ar.length > 170) throw new Error(`عنوان المختارة غير صالح: ${ar.length}`)
  if (arNote.length < 25 || arNote.length > 240) throw new Error(`ملاحظة المختارة غير صالحة: ${arNote.length}`)
  if (en.length < 10 || en.length > 190) throw new Error(`عنوان المختارة الإنجليزي غير صالح: ${en.length}`)
  if (enNote.length < 20 || enNote.length > 260) throw new Error(`ملاحظة المختارة الإنجليزية غير صالحة: ${enNote.length}`)
  return {
    kind,
    ar,
    arNote,
    en,
    enNote,
    source: `د. أحمد حسين الفيلكاوي · ${source.type}`,
    url: source.url,
  }
}

async function generateLetter(source, style) {
  const prompt = `أنت محرر عربي يكتب لموقع د. أحمد حسين الفيلكاوي، أستاذ تكنولوجيا التعليم والذكاء الاصطناعي.
اكتب رسالة قصيرة تبدو كتعليق قارئ ذكي على مادة للدكتور، بنبرة: «${style}».
المادة التي يجب أن تبني عليها النص حصراً:
النوع: ${source.type}
العنوان: ${source.title}
المجال: ${source.category}
النص: ${source.text}

أعد JSON فقط:
{"message":"...","reply":"..."}

قواعد ملزمة:
- الرسالة 70–125 كلمة، عربية بيضاء، إنسانية، ذكية، ولا تبدأ كل مرة بالعبارة نفسها.
- نوّع البناء: مرة ملاحظة، مرة سؤال، مرة امتنان، مرة اعتراض مهذب، ومرة مفارقة.
- يجوز أن تبدأ بـ«دكتور أحمد» أو تدخل في الفكرة مباشرة.
- لا تذكر اسماً أو بريداً أو مدينة أو جهة أو توقيعاً للكاتب.
- لا تدّعِ حادثة شخصية محددة، ولا شهادة نجاح، ولا نتيجة واقعية لم تقع.
- لا تقل إن الرسالة وصلت بالبريد، ولا تستخدم عبارة «أنا أحد قرائك».
- اربط الرسالة بفكرة حقيقية من المادة، ولا تنسخ منها فقرة طويلة.
- الرد 15–35 كلمة، بصوت د. أحمد، واضح وغير متكلّف.
- لا تستخدم وسوماً أو Markdown.`
  return validateLetter(await geminiJson(prompt))
}

async function generateFaq(source, topic) {
  const prompt = `أنت مساعد تحريري لموقع د. أحمد حسين الفيلكاوي.
أنشئ سؤالاً عاماً قصيراً جداً في مجال «${topic}»، مستنداً إلى الفكرة الآتية من محتوى الدكتور:
النوع: ${source.type}
العنوان: ${source.title}
النص: ${source.text}

أعد JSON فقط:
{"q":"...","a":"..."}

القواعد:
- السؤال مستقل ومفهوم ومن تخصصات واهتمامات الدكتور، وليس خبراً آنياً.
- نوّع بين التربية، التعليم، التقنية، الذكاء الاصطناعي، الأسرة، الطفل، المعلم، البحث، القيادة والمجتمع الرقمي.
- الإجابة جملة أو جملتان فقط، عملية وواضحة، من 18 إلى 42 كلمة.
- لا تكرر عنوان المادة حرفياً.
- لا تستخدم ادعاءات طبية أو قانونية أو أرقاماً غير موجودة في النص.
- لا تستخدم Markdown.`
  return validateFaq(await geminiJson(prompt))
}

async function generatePick(source) {
  const prompt = `أنت محرر ثنائي اللغة لقسم «المختارات» في موقع د. أحمد حسين الفيلكاوي.
حوّل المادة التالية إلى مختارة قصيرة تقود القارئ إلى المصدر الأصلي:
النوع: ${source.type}
العنوان: ${source.title}
المجال: ${source.category}
النص: ${source.text}

أعد JSON فقط:
{"kind":"رؤية عميقة أو مفهوم ناشئ أو الرف المنسي أو اقتباس وتأمل","ar":"...","arNote":"...","en":"...","enNote":"..."}

قواعد ملزمة:
- لا تخترع معلومة أو رقماً أو اقتباساً غير موجود.
- العنوان العربي واضح وجذاب، والملاحظة تشرح لماذا تستحق المادة وقت القارئ.
- الإنجليزية صياغة طبيعية وليست ترجمة حرفية ركيكة.
- لا تستخدم Markdown، ولا تذكر أن النص مولد آلياً.
- إذا كانت المادة لقاءً فصنّفها «رؤية عميقة»، وإذا كانت كتاباً يجوز «الرف المنسي»، وإذا كانت مقالاً اختر الأنسب.`
  return validatePick(await geminiJson(prompt), source)
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

async function recentDocs(db, collectionName, limit = 80) {
  try {
    const snapshot = await db.collection(collectionName).orderBy('createdAt', 'desc').limit(limit).get()
    return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  } catch {
    const snapshot = await db.collection(collectionName).limit(limit).get()
    return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
  }
}

async function run() {
  const sources = loadSources()
  if (SELF_TEST) {
    const articles = sources.filter((item) => item.type === 'مقال').length
    const books = sources.filter((item) => item.type === 'كتاب').length
    const media = sources.filter((item) => item.type === 'لقاء').length
    if (articles < 100 || books < 5 || media < 3) throw new Error(`مصادر غير كافية: ${articles}/${books}/${media}`)
    const selected = [0, 1, 2].map((index) => chooseDiverseSource(sources, new Set(), index + 2))
    console.log(JSON.stringify({
      ok: true,
      version: GENERATION_VERSION,
      total: sources.length,
      articles,
      books,
      media,
      bootstrap: { letters: MIN_LETTERS, faqs: MIN_FAQS },
      samples: selected.map((item) => ({ type: item.type, title: item.title })),
    }, null, 2))
    return
  }

  const { db, Timestamp, FieldValue } = await firebaseContext()
  const stateRef = db.collection(STATE_COLLECTION).doc(STATE_DOC)
  const stateSnap = await stateRef.get()
  const state = stateSnap.exists ? stateSnap.data() : {}

  try {
    const [recentLetters, recentFaqs, recentPicks] = await Promise.all([
      recentDocs(db, 'site_inbox'),
      recentDocs(db, 'site_faqs'),
      recentDocs(db, 'site_picks'),
    ])

    const publishedLetters = recentLetters.filter(isPublished)
    const publishedFaqs = recentFaqs.filter(isPublished)
    const publishedPicks = recentPicks.filter(isPublished)
    const letterDeficit = Math.max(0, MIN_LETTERS - publishedLetters.length)
    const faqDeficit = Math.max(0, MIN_FAQS - publishedFaqs.length)
    const pickDeficit = Math.max(0, MIN_PICKS - publishedPicks.length)
    const letterDue = due(state?.nextLetterAt) && !createdToday(publishedLetters)
    const faqDue = due(state?.nextFaqAt) && !createdToday(publishedFaqs)
    const pickDue = due(state?.nextPickAt) && !createdToday(publishedPicks)
    const letterTarget = Math.min(MAX_GENERATED_PER_KIND, Math.max(letterDeficit, letterDue ? 1 : 0))
    const faqTarget = Math.min(MAX_GENERATED_PER_KIND, Math.max(faqDeficit, faqDue ? 1 : 0))
    const pickTarget = 0 // متعمد: site_picks المحلي متوقف نهائياً

    const usedSourceKeys = new Set([
      ...recentLetters.map((item) => item.sourceKey).filter(Boolean),
      ...recentFaqs.map((item) => item.sourceKey).filter(Boolean),
      ...recentPicks.map((item) => item.sourceKey).filter(Boolean),
    ])
    const usedStyles = new Set(recentLetters.slice(0, styles.length).map((item) => item.tone).filter(Boolean))
    const usedTopics = new Set(recentFaqs.slice(0, topicFamilies.length).map((item) => item.topicFamily).filter(Boolean))

    let published = 0
    let lettersPublished = 0
    let faqsPublished = 0
    let picksPublished = 0

    for (let index = 0; index < letterTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 11 + index)
      const style = chooseUnusedText(styles, usedStyles, 7 + index)
      const letter = await generateLetter(source, style)
      const id = `auto-letter-${isoDay(now)}-${hash(`${source.key}:${style}`)}`
      await db.collection('site_inbox').doc(id).set({
        ...letter,
        tone: style,
        sourceKey: source.key,
        sourceType: source.type,
        sourceTitle: source.title,
        sourcePath: source.url,
        autoGenerated: true,
        generationVersion: GENERATION_VERSION,
        status: 'published',
        published: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false })
      published += 1
      lettersPublished += 1
      usedSourceKeys.add(source.key)
      usedStyles.add(style)
      console.log(`✔ رسالة جديدة: ${source.type} · ${source.title} · ${style}`)
    }

    for (let index = 0; index < faqTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 29 + index)
      const topic = chooseUnusedText(topicFamilies, usedTopics, 17 + index)
      const faq = await generateFaq(source, topic)
      const id = `auto-faq-${isoDay(now)}-${hash(`${source.key}:${topic}`)}`
      await db.collection('site_faqs').doc(id).set({
        ...faq,
        topicFamily: topic,
        sourceKey: source.key,
        sourceType: source.type,
        sourceTitle: source.title,
        sourcePath: source.url,
        autoGenerated: true,
        generationVersion: GENERATION_VERSION,
        status: 'published',
        published: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false })
      published += 1
      faqsPublished += 1
      usedSourceKeys.add(source.key)
      usedTopics.add(topic)
      console.log(`✔ سؤال جديد: ${faq.q} · ${topic}`)
    }

    for (let index = 0; index < pickTarget; index += 1) {
      const source = chooseDiverseSource(sources, usedSourceKeys, 47 + index)
      const pick = await generatePick(source)
      const id = `auto-pick-${isoDay(now)}-${hash(source.key)}`
      await db.collection('site_picks').doc(id).set({
        ...pick,
        sourceKey: source.key,
        sourceType: source.type,
        sourceTitle: source.title,
        sourcePath: source.url,
        autoGenerated: true,
        generationVersion: GENERATION_VERSION,
        added: isoDay(now),
        status: 'published',
        published: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: false })
      published += 1
      picksPublished += 1
      usedSourceKeys.add(source.key)
      console.log(`✔ مختارة جديدة: ${source.type} · ${source.title}`)
    }

    const statePatch = {
      generationVersion: GENERATION_VERSION,
      updatedAt: FieldValue.serverTimestamp(),
      lastRunAt: FieldValue.serverTimestamp(),
      lastSuccessAt: FieldValue.serverTimestamp(),
      lastStatus: 'ok',
      lastPublishedCount: published,
      lastLettersPublished: lettersPublished,
      lastFaqsPublished: faqsPublished,
      lastPicksPublished: picksPublished,
      minimumLetters: MIN_LETTERS,
      minimumFaqs: MIN_FAQS,
      minimumPicks: MIN_PICKS,
    }

    if (lettersPublished > 0) {
      statePatch.lastLetterAt = FieldValue.serverTimestamp()
      statePatch.nextLetterAt = Timestamp.fromDate(addDays(now, 3))
    }
    if (faqsPublished > 0) {
      statePatch.lastFaqAt = FieldValue.serverTimestamp()
      statePatch.nextFaqAt = Timestamp.fromDate(addDays(now, 2))
    }
    if (picksPublished > 0) {
      statePatch.lastPickAt = FieldValue.serverTimestamp()
      statePatch.nextPickAt = Timestamp.fromDate(addDays(now, 2))
    }

    await stateRef.set(statePatch, { merge: true })

    if (published) {
      console.log(`\n✔ نُشر ${published} عنصر تلقائياً: ${lettersPublished} رسالة، ${faqsPublished} سؤال.`)
    } else {
      const nextLetter = normalizeTimestamp(state?.nextLetterAt)?.toISOString() || 'غير محدد'
      const nextFaq = normalizeTimestamp(state?.nextFaqAt)?.toISOString() || 'غير محدد'
      console.log(`\n✔ لا نشر الآن؛ الأرشيف سليم. الرسالة التالية: ${nextLetter} · السؤال التالي: ${nextFaq}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await stateRef.set({
      generationVersion: GENERATION_VERSION,
      lastRunAt: FieldValue.serverTimestamp(),
      lastStatus: 'error',
      lastError: message.slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {})
    throw error
  }
}

try {
  await run()
} catch (error) {
  console.error(`✖ فشل النشر التلقائي: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
