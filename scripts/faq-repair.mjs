#!/usr/bin/env node
/**
 * «مُنظّف الأسئلة» — يحذف أسئلة القالب القديم من site_faqs.
 *
 * كان المولّد الاحتياطي يكتب سؤالاً واحداً لا يتغيّر فيه إلا اسم الموضوع:
 *   «كيف نعرف أن تطبيق «{الموضوع}» يحقق أثراً حقيقياً؟»
 * بإجابةٍ واحدة متطابقة في كل مرة. وأُصلح المولّد (auto-site-content.mjs)،
 * لكن ما نُشر قبل الإصلاح باقٍ: المولّد يضيف ولا يحذف، فتبقى هذه أبداً.
 *
 * ولا نُصلحها بإعادة صياغة — نحذفها. فالمولّد الجديد يُنشئ بدائلها من أرشيف
 * الدكتور خلال أيام، وسؤالٌ ناقص خيرٌ من سؤالٍ قالبيّ يوهم القارئ بأنه مكتوب له.
 *
 * التشغيل:
 *   node scripts/faq-repair.mjs            # عرضٌ فقط، لا يحذف شيئاً
 *   node scripts/faq-repair.mjs --apply    # ينفّذ الحذف
 *   node scripts/faq-repair.mjs --self-test
 */
import { readFileSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')

const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

/* بصمة القالب القديم — بالشكل لا بالنصّ الحرفيّ، فالموضوع يتغيّر داخله.
   والإجابة الثابتة تُطابَق ببدايتها، فقد تُقتطع في بعض الوثائق. */
const TEMPLATE_Q = /^كيف نعرف أن تطبيق «[^»]*» يحقق أثراً حقيقياً؟$/
const TEMPLATE_A = /^يظهر الأثر عندما يتغير قرار أو ممارسة بوضوح/

export const isTemplatedFaq = (fields = {}) => (
  TEMPLATE_Q.test((fields.q?.stringValue || '').trim())
  || TEMPLATE_A.test((fields.a?.stringValue || '').trim())
)

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

function selfTest() {
  const templated = {
    q: { stringValue: 'كيف نعرف أن تطبيق «التربية الأسرية» يحقق أثراً حقيقياً؟' },
    a: { stringValue: 'يظهر الأثر عندما يتغير قرار أو ممارسة بوضوح، ويمكن ملاحظته ومراجعته.' },
  }
  const genuine = {
    q: { stringValue: 'هل استخدام الذكاء الاصطناعي يضعف تفكير الطالب؟' },
    a: { stringValue: 'يضعفه حين يحلّ مكان المحاولة، ويقويه حين يُستخدم للمقارنة والنقد.' },
  }
  /* ★ سؤالٌ يشبه القالب لفظاً لكنه ليس منه — لا يجوز حذفه */
  const lookalike = {
    q: { stringValue: 'كيف نعرف أن التقييم الجديد يحقق أثراً في الصف؟' },
    a: { stringValue: 'حين يشرح الطالب بلغته ويطبّق في موقفٍ جديد ويدافع عن قراره.' },
  }
  if (!isTemplatedFaq(templated)) throw new Error('لم يلتقط السؤال القالبي')
  if (isTemplatedFaq(genuine)) throw new Error('★ حكم على سؤالٍ سليم بأنه قالبي')
  if (isTemplatedFaq(lookalike)) throw new Error('★ حذف سؤالاً يشبه القالب وليس منه — خطرُ فقد محتوى')
  console.log(JSON.stringify({ ok: true, guards: ['exact-template-only', 'no-lookalike-deletion'] }, null, 2))
}

if (SELF_TEST) {
  selfTest()
  process.exit(0)
}

if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID مفقود')

const token = await firestoreToken()
const response = await fetch(`${firestoreBase()}/site_faqs?pageSize=300`, { headers: { Authorization: `Bearer ${token}` } })
if (!response.ok) throw new Error(`Firestore ${response.status}`)
const documents = (await response.json()).documents || []

const templated = documents.filter((document) => isTemplatedFaq(document.fields || {}))
console.log(`في site_faqs ${documents.length} وثيقة · القالبية منها: ${templated.length}\n`)

if (!templated.length) {
  console.log('✔ لا يوجد سؤالٌ قالبيّ.')
  process.exit(0)
}

/* ولا نترك القسم فارغاً: إن كان القالبيّ هو كل ما فيه، نتوقف ونُبلّغ.
   صفحةٌ فيها سؤالٌ ضعيف خيرٌ من قسمٍ يختفي بلا إنذار. */
if (templated.length === documents.length) {
  console.log('⊘ كل الأسئلة قالبية. الحذف يُفرغ القسم — أوقفتُ العملية.')
  console.log('  شغّل مولّد المحتوى أولاً ليكتب بدائل، ثم أعد هذا الأمر.')
  process.exit(0)
}

for (const document of templated) {
  const name = document.name.split('/').pop()
  console.log(`${name}\n  ${document.fields?.q?.stringValue || '(بلا سؤال)'}`)
  if (!APPLY) { console.log('  (عرضٌ فقط — أضف --apply للحذف)\n'); continue }
  const deleted = await fetch(`${firestoreBase()}/site_faqs/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!deleted.ok) throw new Error(`Firestore ${deleted.status}: ${(await deleted.text()).slice(0, 200)}`)
  console.log('  ✔ حُذف\n')
}

console.log(APPLY
  ? `✔ حُذف ${templated.length} · بقي ${documents.length - templated.length} سؤالاً سليماً. والمولّد الجديد يكتب البدائل من أرشيف الدكتور.`
  : 'لم يُحذف شيء. أعد التشغيل بـ --apply للتنفيذ.')
