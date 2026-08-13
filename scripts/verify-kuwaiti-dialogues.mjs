#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeManualDialogueTurns } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STANDARD = resolve(ROOT, 'manual-dialogues')
const KUWAITI_DIR = resolve(ROOT, 'manual-dialogues-kuwaiti')
const SEED = resolve(ROOT, 'src/data/kuwaiti-dialogues.json')
const PILOT = 'success-that-does-not-bring-joy-to-its-ownerarabic'
const forbiddenTokens = new Set(['عايز','عاوز','إزاي','ازاي','مش','دلوقتي','أوي','اوي','كده','شو','هلّق','هلأ','لسه','إيش','وش'])
const kuwaitiMarkers = ['مو','هني','شنو','شلون','الحين','وايد','ماكو','تبي','ترى','إي','بس','قاعد','هال','ليش','وين','إحنا','عشان','جذي','راح','نبي','نقدر','اللي']
const formalPatterns = [
  /(?:^|[\s،.!؟؛:])[وف]?هل(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?لم(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?لن(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?ليس(?:ت)?(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?فإن(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?(?:الذي|التي|الذين|اللذان|اللتان)(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])(?:ماذا|لماذا|إذن|لقد|فيا|بينما|أينما)(?=[\s،.!؟؛:]|$)/u,
  /(?:^|[\s،.!؟؛:])[وف]?بات(?:ت)?(?=[\s،.!؟؛:]|$)/u,
  /\bعلى الرغم\b/u, /\bفي خضم\b/u, /\bإلى إن\b/u,
  /\bلا بد\b/u, /\bولو نظرنا\b/u, /\bفلو نظرنا\b/u, /\bنحتاج إلى\b/u,
]
const malformed = ['من بس','من من بس','للحينهم','وايدً','إن إحنا','بس بس','البره كله فرح','ماكو شي يتحرك','فهوإن']

assert.ok(existsSync(SEED), 'ملف src/data/kuwaiti-dialogues.json مطلوب')
const seed = JSON.parse(readFileSync(SEED,'utf8'))
const episodes = seed?.episodes && typeof seed.episodes === 'object' ? seed.episodes : {}
const slugs = Object.keys(episodes).sort()
assert.equal(Number(seed?.count),144,`عداد الحوارات المتوقع 144، الموجود ${seed?.count}`)
assert.equal(slugs.length,144,`عدد الحوارات المتوقع 144، الموجود ${slugs.length}`)
assert.equal(seed?.profile,'kuwaiti-urban-soft-v2','يجب استخدام بروفايل اللهجة المدقق v2')

let totalTurns=0, dialectHits=0, formalFailures=0
for (const slug of slugs) {
  const turns=normalizeManualDialogueTurns(episodes[slug])
  assert.ok(turns.length>=15,`${slug}: الحوار أقصر من الحد المتوقع`)
  const text=turns.map(t=>t.text).join(' ')
  /* \u0627\u0644\u0645\u062F\u0649 \u200E0621\u2013064A\u200E \u0648\u062D\u062F\u0647 \u0644\u0627 \u064A\u0639\u0631\u0641 \u062D\u0631\u0648\u0641 \u0627\u0644\u062E\u0644\u064A\u062C \u0627\u0644\u0645\u0639\u0631\u064E\u0651\u0628\u0629 (\u0686 \u06AF \u067E \u06A4)\u060C \u0641\u0643\u0627\u0646
     \u064A\u0634\u0637\u0631 \u00AB\u0627\u0644\u0641\u064A\u0644\u0686\u0627\u0648\u064A\u00BB \u0625\u0644\u0649 \u00AB\u0627\u0644\u0641\u064A\u0644\u00BB \u0648\u00AB\u0627\u0648\u064A\u00BB \u062B\u0645 \u064A\u062A\u0651\u0647\u0645\u0647\u0627 \u0628\u0627\u0644\u0645\u0635\u0631\u064A\u0629. \u0627\u0644\u062D\u0631\u0641 \u062C\u0632\u0621\u064C \u0645\u0646
     \u0627\u0644\u0643\u0644\u0645\u0629 \u0644\u0627 \u0641\u0627\u0635\u0644\u064C \u0628\u064A\u0646 \u0643\u0644\u0645\u062A\u064A\u0646. */
  const contamination=(text.match(/[\u0621-\u064A\u0686\u067E\u06A4\u06AF]+/gu)||[]).filter(token=>forbiddenTokens.has(token))
  assert.equal(contamination.length,0,`${slug}: انزلاق لهجي غير كويتي: ${contamination.join('، ')}`)
  for (const bad of malformed) assert.ok(!text.includes(bad),`${slug}: تركيب آلي فاسد: ${bad}`)
  assert.ok(!/[\u064B-\u0652\u0670]/u.test(text),`${slug}: بقي تشكيل/تنوين في النص المنطوق`)
  for (let i=0;i<turns.length;i+=1) {
    const turn=turns[i]
    const hits=formalPatterns.filter(rx=>rx.test(turn.text))
    if (hits.length) {
      formalFailures += 1
      throw new Error(`${slug}#${i+1}: صياغة فصيحة مسموعة ما زالت موجودة: ${turn.text}`)
    }
  }
  const hits=kuwaitiMarkers.reduce((sum,marker)=>sum + text.split(marker).length-1,0)
  const density=hits/turns.length
  assert.ok(density>=0.22,`${slug}: كثافة اللهجة الكويتية ضعيفة (${density.toFixed(2)} علامة/مداخلة)`)
  dialectHits+=hits; totalTurns+=turns.length
}

// If the full project is present, also guarantee one-to-one correspondence and speaker order.
if (existsSync(STANDARD)) {
  const standardNames=readdirSync(STANDARD).filter(n=>n.endsWith('.json')).sort()
  assert.equal(standardNames.length,144,'المصدر العربي الكامل يجب أن يحتوي 144 حوارا')
  assert.deepEqual(new Set(slugs),new Set(standardNames.map(n=>basename(n,'.json'))),'كل slug عربي لازم يكون له نظير كويتي')
  for (const name of standardNames) {
    const slug=basename(name,'.json')
    const original=normalizeManualDialogueTurns(JSON.parse(readFileSync(resolve(STANDARD,name),'utf8')))
    const adapted=normalizeManualDialogueTurns(episodes[slug])
    assert.equal(adapted.length,original.length,`${slug}: عدد المداخلات تغير`)
    assert.deepEqual(adapted.map(t=>t.speaker),original.map(t=>t.speaker),`${slug}: ترتيب المتحدثين تغير`)
  }
}

assert.ok(Array.isArray(episodes[PILOT]) && episodes[PILOT].length>=20,'الحلقة التجريبية الكويتية غير مكتملة')
console.log(`✓ 144/144 حواراً اجتاز بوابة اللهجة الكويتية الصارمة`)
console.log(`✓ ${totalTurns} مداخلة · ${dialectHits} علامة كويتية · صفر علامة فصحى عالية الخطورة · صفر تنوين/تشكيل`)
console.log(`✓ بروفايل: ${seed.profile} · formalFailures=${formalFailures}`)
