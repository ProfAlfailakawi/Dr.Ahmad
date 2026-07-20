#!/usr/bin/env node
/**
 * «مُصلح الرادار» — يعالج البطاقات القالبية التي نُشرت قبل نزع Gemini.
 *
 * حين كان الرادار يسقط إلى «البديل الآمن»، كتب فوق كل مادةٍ الجملة نفسها:
 *   ar    = «مادة حديثة موثوقة في التعليم والتقنية من {المصدر}»
 *   arNote = «اختارها الرادار لارتباطها المباشر بالتعليم أو التعلم…»
 * فخرجت بطاقاتٌ متطابقة تختلف في اسم المصدر وحده.
 *
 * تعديل السكربت لا يمسّ ما نُشر — فهذه الأداة تمسّه: تُفرغ ar وتضع مكان
 * arNote بابَ المادة المستنتَج من عنوانها ووصفها، فتصير كلُّ بطاقةٍ بعنوانها
 * الحقيقي. ولا تُخترع كلمة: كلّ ما يُكتب مشتقٌّ ممّا في الوثيقة أصلاً.
 *
 * التشغيل:
 *   node scripts/radar-repair.mjs            # عرضٌ فقط، لا يكتب شيئاً
 *   node scripts/radar-repair.mjs --apply    # ينفّذ الإصلاح
 *   node scripts/radar-repair.mjs --self-test
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

/* بصمة الجملة القالبية. نطابق بالشكل لا بالنص الحرفي، فالمصدر يتغيّر داخلها. */
const TEMPLATE_AR = /^مادة حديثة موثوقة في التعليم والتقنية من /
const TEMPLATE_NOTE = /^اختارها الرادار لارتباطها المباشر/

export const isTemplated = (fields = {}) => (
  TEMPLATE_AR.test(fields.ar?.stringValue || '') || TEMPLATE_NOTE.test(fields.arNote?.stringValue || '')
)

/* نسخةٌ مطابقة لما في daily-radar.mjs — والاختبار الذاتي يحرس تطابقهما */
const TOPIC_BUCKETS = [
  { label: 'الذكاء الاصطناعي في التعليم', signals: ['artificial intelligence', 'generative ai', 'chatgpt', 'llm', 'machine learning', 'algorithm', 'ai '] },
  { label: 'التقييم والامتحانات', signals: ['exam', 'test score', 'assessment', 'grading', 'grade', 'standardized'] },
  { label: 'المعلّم والممارسة الصفّية', signals: ['teacher', 'teaching', 'classroom', 'instruction', 'pedagog', 'curriculum'] },
  { label: 'الطالب والتحصيل', signals: ['student', 'learner', 'literacy', 'absent', 'enrollment', 'dropout', 'achievement'] },
  { label: 'التعليم الجامعي', signals: ['university', 'college', 'campus', 'higher education', 'undergraduate', 'faculty'] },
  { label: 'سياسات التعليم وتمويله', signals: ['policy', 'funding', 'district', 'reform', 'budget', 'legislat', 'federal'] },
  { label: 'التقنية والمجتمع الرقمي', signals: ['technology', 'digital', 'platform', 'device', 'screen', 'social media', 'edtech'] },
  { label: 'البحث العلمي والدراسات', signals: ['research', 'study finds', 'researchers', 'evidence', 'data show'] },
]

export function topicOf(item) {
  const text = `${item.title} ${item.desc}`.toLocaleLowerCase('en')
  let best = null
  for (const bucket of TOPIC_BUCKETS) {
    const hits = bucket.signals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0)
    if (hits && (!best || hits > best.hits)) best = { label: bucket.label, hits }
  }
  return best?.label || 'التعليم والتقنية'
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

function selfTest() {
  const templated = { ar: { stringValue: 'مادة حديثة موثوقة في التعليم والتقنية من EdSurge' }, arNote: { stringValue: 'اختارها الرادار لارتباطها المباشر بالتعليم' } }
  const genuine = { ar: { stringValue: 'جامعة شيكاغو تمنع الهواتف في السنة الأولى' }, arNote: { stringValue: 'قرارٌ يسبق تعليم الذكاء الاصطناعي بمرحلة.' } }
  if (!isTemplated(templated)) throw new Error('لم يلتقط البطاقة القالبية')
  if (isTemplated(genuine)) throw new Error('حكم على بطاقةٍ سليمة بأنها قالبية — خطرٌ يمسّ ما كتبه الدكتور')
  const a = topicOf({ title: 'Why are so many kindergartners chronically absent?', desc: 'Students missing school days.' })
  const b = topicOf({ title: 'The days of good guy capitalists are over', desc: 'College students turn against tech elites on campus.' })
  if (a === b) throw new Error('الباب المستنتج قالبيّ')
  console.log(JSON.stringify({ ok: true, sampleTopics: [a, b] }, null, 2))
}

if (SELF_TEST) {
  selfTest()
  process.exit(0)
}

if (!env.FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID مفقود')

const token = await firestoreToken()
const response = await fetch(`${firestoreBase()}/site_radar?pageSize=300`, { headers: { Authorization: `Bearer ${token}` } })
if (!response.ok) throw new Error(`Firestore ${response.status}`)
const documents = (await response.json()).documents || []

const damaged = documents.filter((document) => isTemplated(document.fields || {}))
console.log(`في site_radar ${documents.length} وثيقة · القالبية منها: ${damaged.length}\n`)

if (!damaged.length) {
  console.log('✔ لا توجد بطاقةٌ قالبية.')
  process.exit(0)
}

for (const document of damaged) {
  const fields = document.fields || {}
  const name = document.name.split('/').pop()
  const title = fields.en?.stringValue || ''
  const desc = fields.enNote?.stringValue || ''
  const topic = topicOf({ title, desc })
  console.log(`${name} · ${fields.source?.stringValue || ''}\n  العنوان: ${title || '(مفقود)'}\n  الباب الجديد: ${topic}`)

  if (!title) {
    console.log('  ⊘ متروكة: لا عنوان أصليّ فيها — الحذف قرارُ الدكتور لا قرارُ السكربت.\n')
    continue
  }
  if (!APPLY) { console.log('  (عرضٌ فقط — أضف --apply للتنفيذ)\n'); continue }

  const patch = await fetch(
    `${firestoreBase()}/site_radar/${name}?updateMask.fieldPaths=ar&updateMask.fieldPaths=arNote`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { ar: { stringValue: '' }, arNote: { stringValue: topic } } }),
    },
  )
  if (!patch.ok) throw new Error(`Firestore ${patch.status}: ${(await patch.text()).slice(0, 200)}`)
  console.log('  ✔ أُصلحت\n')
}

console.log(APPLY ? '✔ انتهى الإصلاح.' : 'لم يُكتب شيء. أعد التشغيل بـ --apply للتنفيذ.')
