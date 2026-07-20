#!/usr/bin/env node
/**
 * رافع الحوارات اليدوية إلى Firestore — بالبصمة نفسها التي تقفلها اللوحة.
 *
 * الدكتور كتب ملفاته نصّاً («الرجل: …» / «المرأة: …»)، ومحرّك الصوت لا يقرأ
 * نصّاً بل مداخلاتٍ مقفولةً ببصمة. واستيراد مئةٍ وثلاثةٍ وأربعين ملفاً بيده
 * واحداً واحداً عملُ ساعات، وسهوةٌ واحدة تُدخل حواراً في مقالٍ غير مقاله.
 *
 * فهذا يفعل ما تفعله اللوحة بالضبط، لا تقريباً:
 *   • يحوّل النصّ إلى مداخلات بالخريطة نفسها ([تداخل]→overlapMs، [موسيقى]→
 *     musicBridgeAfter، والوسوم→deliveryType، والوقفات بجدولها).
 *   • يحسب البصمتين بـ`dialogueHashes` — وهي الدالّة التي يتحقّق بها الخادم.
 *   • يكتب `status:'draft'` **لا queued**: الرفع لا يُطلق Azure. الإطلاق قرارٌ
 *     منفصل بزرٍّ واحد، وإلا استيقظ الدكتور على فاتورةٍ لم يأذن بها.
 *   • ثم يقرأ ما كُتب ويقارن البصمة — فلا يُعلن نجاحاً لم يقع.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dialogueHashes } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/* الخريطة نفسها الموجودة في محرّر اللوحة — أيّ اختلافٍ هنا يُغيّر الأداء
   الصوتيّ عمّا يراه الدكتور في الشاشة، فتُنسخ حرفاً بحرف لا اجتهاداً. */
const TYPE_TAGS = {
  'خبر': 'statement', 'سؤال': 'question', 'رد': 'response', 'تأمل': 'reflection', 'اعتراض': 'objection',
  'اعتراض هادئ': 'gentleObjection', 'شرح': 'explanation', 'توضيح': 'clarification', 'تمهيد': 'setup',
  'مثال': 'example', 'تأكيد': 'emphasis', 'رد قصير': 'briefReaction', 'خلاصة': 'conclusion', 'إغلاق': 'closing',
}
const TYPE_PAUSES = {
  statement: 560, question: 680, response: 520, reflection: 760, objection: 640, gentleObjection: 620,
  explanation: 600, clarification: 600, setup: 640, example: 580, emphasis: 620, briefReaction: 240,
  conclusion: 900, closing: 900,
}

/** نصّ الدكتور ⇐ مداخلاتٌ يفهمها المحرك */
export function scriptToTurns(script) {
  const lines = String(script || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
  const turns = []
  for (const line of lines) {
    const match = line.match(/^(الرجل|المرأة)\s*[:：]\s*(.+)$/u)
    if (!match) { if (turns.length) turns[turns.length - 1].text += ` ${line}`; continue }
    turns.push({ speaker: match[1] === 'الرجل' ? 'male' : 'female', text: match[2].trim(), deliveryType: 'statement', pauseAfterMs: 560, overlapMs: 0, musicBridgeAfter: false })
  }
  turns.forEach((turn, index) => {
    let lockedType = false
    let lockedPause = false
    turn.text = turn.text.replace(/\[([^\]]{1,24})\]/g, (_, rawTag) => {
      const tag = String(rawTag).trim()
      const pause = tag.match(/^وقفة\s*(\d{2,4})$/)
      const overlap = tag.match(/^تداخل\s*(\d{1,3})$/)
      if (tag === 'موسيقى') turn.musicBridgeAfter = true
      else if (pause) { turn.pauseAfterMs = Math.min(2000, Number(pause[1])); lockedPause = true }
      else if (overlap) turn.overlapMs = Math.min(150, Number(overlap[1]))
      else if (TYPE_TAGS[tag]) { turn.deliveryType = TYPE_TAGS[tag]; lockedType = true }
      return ' '
    }).replace(/\s+/g, ' ').trim()
    if (!lockedType) {
      if (/[؟?]\s*$/.test(turn.text)) turn.deliveryType = 'question'
      else if (turn.text.split(/\s+/).length <= 8) turn.deliveryType = 'briefReaction'
      else if (index === turns.length - 1) turn.deliveryType = 'conclusion'
    }
    if (!lockedPause) turn.pauseAfterMs = TYPE_PAUSES[turn.deliveryType] ?? 560
  })
  return turns
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  const turns = scriptToTurns('الرجل: [تأمل] جملة طويلة فيها كلماتٌ كثيرة تتجاوز الثمانية بوضوح تام هنا.\nالمرأة: [تداخل 90] قصيرة. [موسيقى]\nالمرأة: هل هذا سؤال؟')
  assert(turns.length === 3, 'ثلاث مداخلات')
  assert(turns[0].speaker === 'male' && turns[1].speaker === 'female', 'المتحدثون بمواضعهم')
  assert(turns[0].deliveryType === 'reflection' && turns[0].pauseAfterMs === 760, '★ [تأمل] يضبط النوع والوقفة معاً')
  assert(turns[1].overlapMs === 90, '★ [تداخل 90] يصير تداخلاً بالمللي ثانية')
  assert(turns[1].musicBridgeAfter === true, '★ [موسيقى] يصير جسراً موسيقياً')
  assert(!/\[/.test(turns[0].text), '★ الوسم يُنتزع فلا يُنطق')
  assert(turns[2].deliveryType === 'question', '★ ما انتهى بعلامة استفهام سؤالٌ ولو بلا وسم')
  assert(turns[1].deliveryType === 'briefReaction', 'والقصير ردٌّ قصير')

  /* ★ البصمة تتغيّر بتغيّر حرفٍ واحد — وهي عقد الثقة مع الخادم */
  const a = dialogueHashes(scriptToTurns('الرجل: كلام أول هنا في المداخلة.\nالمرأة: ردّ ثانٍ هنا في المداخلة.'))
  const b = dialogueHashes(scriptToTurns('الرجل: كلام أول هنا في المداخلة.\nالمرأة: ردّ ثانٍ هنا في المداخلةِ.'))
  assert(a.contentSha256 !== b.contentSha256, '★ حرفٌ واحد يغيّر البصمة')
  assert(a.turnCount === 2, 'ويُحصى عدد المداخلات')

  console.log('✓ اختبارات رافع الحوارات: 10/10')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const apply = process.argv.includes('--apply')
const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || resolve(ROOT, 'podcast-audits/dialogues')
const sa = JSON.parse(readFileSync(resolve(ROOT, 'sa.json'), 'utf8'))

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const head = encode({ alg: 'RS256', typ: 'JWT' })
  const body = encode({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })
  const signer = createSign('RSA-SHA256'); signer.update(`${head}.${body}`); signer.end()
  const jwt = `${head}.${body}.${signer.sign(sa.private_key).toString('base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) })
  const json = await response.json()
  if (!json.access_token) throw new Error(`تعذّر التوثيق: ${JSON.stringify(json).slice(0, 160)}`)
  return json.access_token
}

/** تحويل قيمة جافاسكربت إلى شكل Firestore */
function fsValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } }
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fsValue(v)])) } }
  return { stringValue: String(value) }
}
const fsRead = (value) => {
  if (!value || typeof value !== 'object') return value
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return Number(value.doubleValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('nullValue' in value) return null
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fsRead)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fsRead(v)]))
  return value
}

const titles = (() => {
  const source = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const map = {}
  const pattern = /slug:\s*'([^']+)'[\s\S]{0,600}?title:\s*'((?:[^'\\]|\\.)*)'/g
  let hit
  while ((hit = pattern.exec(source))) if (!(hit[1] in map)) map[hit[1]] = hit[2].replace(/\\'/g, "'")
  return map
})()

const files = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.txt')).sort() : []
console.log(`═══ ${files.length} حواراً · مشروع ${sa.project_id} ═══\n`)
if (!files.length) process.exit(0)

const token = await accessToken()
const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`
let uploaded = 0
const failures = []

for (const name of files) {
  const slug = name.replace(/\.txt$/, '')
  const turns = scriptToTurns(readFileSync(resolve(dir, name), 'utf8'))
  let proof
  try { proof = dialogueHashes(turns) } catch (error) { failures.push(`${slug}: ${error.message}`); continue }

  if (!apply) { console.log(`  ⋯ ${slug} · ${proof.turnCount} مداخلة · بصمة ${proof.contentSha256.slice(0, 12)}`); continue }

  const payload = {
    slug, title: titles[slug] || slug, turns: proof.turns, source: 'admin-upload', schemaVersion: 2,
    contentSha256: proof.contentSha256, revisionSha256: proof.revisionSha256, revisionId: proof.revisionId,
    turnCount: proof.turnCount, status: 'draft', savedAtClient: new Date().toISOString(),
    uploadedBy: 'dialogue-batch-uploader',
  }
  const fields = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, fsValue(v)]))
  const mask = Object.keys(payload).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const write = await fetch(`${base}/podcast_dialogues/${encodeURIComponent(slug)}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!write.ok) { failures.push(`${slug}: كتابة ${write.status} ${(await write.text()).slice(0, 120)}`); continue }

  /* القراءة الراجعة إلزامية — لا نُعلن نجاحاً حتى نثبت أن السحابة تحمل
     البصمة نفسها. وإلا ظنّ الدكتور أن الحوار مرفوعٌ وهو ليس كذلك. */
  const back = await fetch(`${base}/podcast_dialogues/${encodeURIComponent(slug)}`, { headers: { Authorization: `Bearer ${token}` } })
  const cloud = Object.fromEntries(Object.entries((await back.json()).fields || {}).map(([k, v]) => [k, fsRead(v)]))
  const echo = dialogueHashes(cloud.turns || [])
  if (echo.contentSha256 !== proof.contentSha256 || cloud.contentSha256 !== proof.contentSha256 || Number(cloud.turnCount) !== proof.turnCount) {
    failures.push(`${slug}: القراءة الراجعة لا تطابق البصمة`); continue
  }
  uploaded += 1
  console.log(`✓ ${slug} · ${proof.turnCount} مداخلة · بصمة ${proof.contentSha256.slice(0, 12)} · مطابقة`)
}

for (const failure of failures) console.log(`✘ ${failure}`)
console.log(`\n── مرفوع: ${uploaded} · متعذّر: ${failures.length} ──`)
if (!apply) console.log('\nⓘ تشغيلةٌ جافّة. أضف --apply للرفع الفعليّ.')
else console.log('ⓘ الحالة draft — لم يُطلق أيّ توليد. الإطلاق بزرٍّ منفصل.')
process.exitCode = failures.length ? 1 : 0
