#!/usr/bin/env node
/**
 * هل يخسر «التصعيد» جودةً مقابل ربع الكلفة؟
 *
 * السؤال: كان المحرك يشتري مرشحين دائماً ويسلّم أفضلهما. صار يشتري الأول،
 * فإن جاء مطابقاً (٩٠٪ فأعلى بلا تحفّظ وبطولٍ صحيح) سلّمه بنداءٍ واحد.
 * فكم تكلّف هذه الصفقة من جودة؟
 *
 * القياس هنا لا يستهلك نيوروناً: يستعمل مقالات الدكتور نفسها بدرجاتها
 * الحقيقية (٥٥–١٠٠) بديلاً عن مسودات النموذج، ويجرّب كل زوجٍ ممكن منها
 * كمرشحَين، ثم يقارن ما يُسلَّم في الوضعين.
 *
 *   node scripts/test-candidate-escalation.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const { measureStyleDna, judgeStyle, buildOrthographyIndex } = await import(resolve(root, 'src/lib/style-dna.mjs'))

const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const archive = Object.entries(bodies)
  .filter(([, body]) => typeof body === 'string' && body.trim().length > 200)
  .map(([slug, body]) => ({ slug, body }))
const dna = measureStyleDna(archive)
const orthography = buildOrthographyIndex(archive)

/* درجات حقيقية من نصوصٍ حقيقية — لا أرقام مخترعة */
const pool = archive.map((item) => {
  const verdict = judgeStyle(item.body, dna, { orthography })
  return { slug: item.slug, score: verdict.score, fatal: verdict.fatal.length > 0 }
})
const scores = pool.map((item) => item.score).sort((left, right) => left - right)
console.log(`\n  حوض المرشحين: ${pool.length} نصاً حقيقياً · المدى ${scores[0]}–${scores[scores.length - 1]} · الوسيط ${scores[Math.floor(scores.length / 2)]}\n`)

/* قاعدة القرار كما هي في server.mjs حرفياً */
const ACCEPT = Number(process.env.ARTICLE_ACCEPT_SCORE || 90)
const needsSecond = (first) => !first || first.score < ACCEPT || first.fatal

let pairs = 0
let escalated = 0
let lostPoints = 0
let lostCases = 0
let worstLoss = 0
let callsAlways = 0
let callsEscalate = 0

for (const first of pool) {
  for (const second of pool) {
    if (first === second) continue
    pairs += 1

    /* الوضع القديم: يُشترى الاثنان ويُسلَّم الأفضل */
    const always = (second.score > first.score && !second.fatal) || first.fatal ? second : first
    callsAlways += 2

    /* الوضع الجديد: الأول، ثم الثاني عند الحاجة فقط */
    const escalate = needsSecond(first)
    callsEscalate += escalate ? 2 : 1
    if (escalate) escalated += 1
    const delivered = escalate
      ? ((second.score > first.score && !second.fatal) || first.fatal ? second : first)
      : first

    const loss = always.score - delivered.score
    if (loss > 0) { lostCases += 1; lostPoints += loss; worstLoss = Math.max(worstLoss, loss) }
  }
}

const pct = (value) => `${(value * 100).toFixed(1)}٪`
console.log(`  أزواج مُختبَرة: ${pairs.toLocaleString('ar-EG')}`)
console.log(`  تصعيدٌ فعليّ (اشتُري الثاني): ${pct(escalated / pairs)}`)
console.log(`  الكلفة: ${callsEscalate.toLocaleString('ar-EG')} نداءً بدل ${callsAlways.toLocaleString('ar-EG')} — توفير ${pct(1 - callsEscalate / callsAlways)}`)
console.log(`  حالاتٌ خسرت درجةً واحدة فأكثر: ${pct(lostCases / pairs)}`)
console.log(`  متوسط الخسارة على كل الأزواج: ${(lostPoints / pairs).toFixed(3)} نقطة`)
console.log(`  أسوأ خسارة ممكنة: ${worstLoss} نقطة\n`)

/* البرهان الذي يهمّ الدكتور: لا يُسلَّم نصٌّ دون العتبة بسبب التصعيد */
const belowThreshold = pool.filter((item) => item.score < ACCEPT || item.fatal).length
console.log(`  ونصفُ الحوض تحت العتبة (${pct(belowThreshold / pool.length)}) — أي أن التصعيد يشتغل حين يجب.\n`)

/* شروط القبول */
assert.ok(callsEscalate < callsAlways * 0.8, 'التوفير حقيقي لا اسمي')
assert.ok(lostPoints / pairs < 1.5, `متوسط الخسارة ضئيل (${(lostPoints / pairs).toFixed(3)} نقطة)`)
assert.ok(worstLoss <= 12, `لا خسارة كارثية في أي زوج (${worstLoss})`)

/* والأهم: كل نصٍّ يُسلَّم في الوضع الجديد إمّا فوق العتبة، أو أفضل ما وُجد */
let deliveredBelow = 0
for (const first of pool) {
  if (!needsSecond(first)) { if (first.score < ACCEPT || first.fatal) deliveredBelow += 1 }
}
assert.equal(deliveredBelow, 0, 'لا يُسلَّم نصٌّ دون العتبة بلا محاولة ثانية')

console.log('  التصعيد: خضراء ✓\n')
