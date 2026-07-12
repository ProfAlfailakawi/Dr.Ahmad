#!/usr/bin/env node
/**
 * «الرادار» — التقاط يومي آلي من الإنترنت، بلا أي تدخل بشري.
 *
 *   npm run radar          (يشغَّل يومياً عبر المجدول)
 *
 * جداران للحماية قبل أي نشر:
 *   الجدار ١ (ميكانيكي): editorial-policy.mjs — قائمة مصادر مغلقة
 *      (المصدر والرابط النهائي كلاهما يجب أن يطابقا القائمة)،
 *      و٢٥٠+ عبارة محظورة بالعربية والإنجليزية
 *      (ديني · عنصري · جنسي · عنف · بذاءة · لاأخلاقي) مع تطبيع نصي
 *      يمنع التحايل، وموضوع تعليمي إلزامي.
 *   الجدار ٢ (تحريري): Gemini يختار الأنفع من الناجين فقط، بتعليمات
 *      منع صريحة، وله حق الانسحاب (pick: 0) فلا يُنشر شيء ذلك اليوم.
 *
 * ضمانة المصدر: النموذج يعيد «رقم» المادة فقط — العنوان الإنجليزي
 * والرابط والمصدر تُنسخ حرفياً من الخلاصة، فيستحيل تلفيق رابط.
 *
 * الناتج: وثيقة واحدة يومياً في site_radar بمعرّف التاريخ
 * (تشغيل اليوم مرتين لا يكرر ولا يبدّل الصيدة) بحالة status: published.
 *
 * الإعداد (.env): GEMINI_API_KEY · FIREBASE_PROJECT_ID · FIREBASE_SERVICE_ACCOUNT
 * وضع المراجعة اليدوية بديل محفوظ في: daily-radar-review-queue.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { POLICY, evaluateCandidate } from './editorial-policy.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ---------- قراءة .env ---------- */
const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- جلب وتفكيك RSS/Atom (بلا اعتماديات) ---------- */
const strip = (s = '') => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

async function fetchFeed(source) {
  try {
    const res = await fetch(source.feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (alfailakawi-radar)' }, redirect: 'follow' })
    if (!res.ok) return []
    const xml = await res.text()
    const items = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/g)].slice(0, 8)
    return items.map(([block]) => ({
      source: source.name,
      title: strip((block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]),
      link: strip((block.match(/<link[^>]*href="([^"]+)"/) || block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1]),
      desc: strip((block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\2>/) || [])[2]).slice(0, 400),
    })).filter((x) => x.title && x.link)
  } catch { return [] }
}

/* ---------- Gemini: يختار رقماً ويصوغ — لا يكتب الروابط أبداً ---------- */
async function pickAndSummarize(pool) {
  const key = env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY مفقود')
  const models = env.GEMINI_MODEL
    ? [env.GEMINI_MODEL]
    : ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest']

  const prompt = `أنت محرر أكاديمي لموقع أستاذ تكنولوجيا التعليم د. أحمد حسين الفيلكاوي (الكويت).
أمامك مواد اليوم من مصادر موثوقة، مرقّمة. اختر «الأنفع» واحدة فقط لقارئ عربي مهتم بالتعليم والتقنية والذكاء الاصطناعي.
أعد JSON فقط بلا أي نص آخر، بهذه الحقول حصراً:
{"pick": رقم_المادة_المختارة, "ar":"عنوان عربي دقيق يلخص المادة", "arNote":"سطر عربي واحد: لماذا تهم القارئ التربوي", "enNote":"one short English line on why it matters"}

قواعد صارمة لا استثناء فيها:
١. لخّص من النص المعطى فقط — يُمنع تأليف أي معلومة ليست فيه.
٢. يُمنع منعاً باتاً اختيار أي مادة: سياسية أو جدلية، عنصرية أو تمييزية،
   دينية أو طائفية، جنسية أو خادشة، فيها عنف أو إساءة لفئة أو شخص,
   أو أي محتوى لا يليق ببيئة أكاديمية محافظة.
٣. المسموح حصراً: التعليم، التربية، التقنية، الذكاء الاصطناعي، البحث العلمي، مهارات التعلم.
٤. إن لم تجد مادة واحدة تحقق كل الشروط أعلاه، أعد: {"pick": 0} — الانسحاب أفضل من نشر مشبوه.

المواد:
${pool.map((x, i) => `${i + 1}. [${x.source}] ${x.title} — ${x.desc}`).join('\n')}`

  // المصادقة بالهيدر + دورتان على سلسلة الموديلات عند الزحام المؤقت
  let data, lastErr
  outer:
  for (let round = 1; round <= 2 && !data; round++) {
    for (const model of models) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
      })
      if (res.ok) { data = await res.json(); console.log(`  النموذج: ${model}`); break outer }
      lastErr = `Gemini ${model} → ${res.status}: ${(await res.text()).slice(0, 120)}`
      if (![503, 429, 404].includes(res.status)) throw new Error(lastErr)
      console.log(`  ⏳ ${model} غير متاح — أجرب البديل`)
    }
    if (!data && round === 1) {
      console.log('  ⏳ كل الموديلات مزدحمة — انتظار ٩٠ ثانية ودورة أخيرة')
      await sleep(90000)
    }
  }
  if (!data) throw new Error(lastErr)
  const out = JSON.parse(data.candidates[0].content.parts[0].text)

  // «الانسحاب بأدب»: لا مادة نظيفة اليوم ← لا ننشر شيئاً
  if (Number(out.pick) === 0) {
    console.log('⊘ لم يجد المحرر مادة تليق بالشروط اليوم — لا نشر. (سلوك صحيح لا خطأ)')
    process.exit(0)
  }
  const item = pool[Number(out.pick) - 1]
  if (!item) throw new Error(`رقم اختيار غير صالح: ${out.pick}`)

  return {
    ar: String(out.ar || item.title).slice(0, 200),
    arNote: String(out.arNote || '').slice(0, 300),
    en: item.title,          // العنوان الأصلي حرفياً — بلا أي تدخل
    enNote: String(out.enNote || '').slice(0, 300),
    source: item.source,     // المصدر حرفياً
    url: item.link,          // الرابط حرفياً — الزائر يصل للمصدر نفسه
  }
}

/* ---------- Firestore REST عبر حساب الخدمة (بلا اعتماديات) ---------- */
async function firestoreToken() {
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) throw new Error(`ملف حساب الخدمة مفقود: ${saPath}`)
  const sa = JSON.parse(readFileSync(saPath, 'utf8'))
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}`,
  })
  if (!res.ok) throw new Error(`OAuth ${res.status}`)
  return (await res.json()).access_token
}

const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

async function todayAlreadyPublished(token, day) {
  const res = await fetch(`${FS_BASE()}/site_radar/${day}`, { headers: { Authorization: `Bearer ${token}` } })
  return res.ok
}

async function recentRadarUrls(token) {
  try {
    const res = await fetch(`${FS_BASE()}/site_radar?pageSize=30`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return new Set()
    const data = await res.json()
    return new Set((data.documents || []).map((d) => d.fields?.url?.stringValue).filter(Boolean))
  } catch { return new Set() }
}

async function publish(item, token, day) {
  if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID مفقود')
  const fields = Object.fromEntries(
    Object.entries({ ...item, status: 'published', day, createdAt: new Date().toISOString() })
      .map(([k, v]) => [k, { stringValue: String(v) }])
  )
  const res = await fetch(`${FS_BASE()}/site_radar/${day}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Firestore ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/* ---------- التشغيل ---------- */
const day = new Date().toISOString().slice(0, 10)
console.log(`الرادار · ${day} · ${POLICY.allowedSources.length} مصادر موثوقة (قائمة مغلقة)\n`)

const token = await firestoreToken()

// تشغيل متكرر في نفس اليوم؟ لا نكرر ولا نبدّل
if (await todayAlreadyPublished(token, day)) {
  console.log(`✔ صيدة اليوم (${day}) منشورة أصلاً — لا حاجة لغيرها.`)
  process.exit(0)
}

const raw = (await Promise.all(POLICY.allowedSources.map(fetchFeed))).flat()
console.log(`التقط ${raw.length} مادة خام`)

// الجدار الأول: السياسة التحريرية الميكانيكية (مصدر + رابط + موضوع + محظورات)
const recent = await recentRadarUrls(token)
const pool = raw.filter((x) => {
  if (recent.has(x.link)) return false
  const verdict = evaluateCandidate({ source: x.source, url: x.link, title: x.title, summary: x.desc })
  return verdict.allowed
})
console.log(`نجا من الجدار الأول: ${pool.length} مادة (استُبعد ${raw.length - pool.length})`)
if (pool.length === 0) { console.log('⊘ لا مواد نظيفة اليوم — لا نشر.'); process.exit(0) }

// الجدار الثاني: المحرر الآلي يختار أو ينسحب
const chosen = await pickAndSummarize(pool)
console.log(`اختار: ${chosen.ar}\n        ${chosen.en}\n المصدر: ${chosen.source}\n الرابط: ${chosen.url}`)

await publish(chosen, token, day)
console.log('\n✔ نُشر في site_radar — يظهر في «المختارات» فوراً، ورابطه يقود للمصدر الأصلي')
