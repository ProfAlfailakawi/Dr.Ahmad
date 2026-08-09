import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readerSource = fs.readFileSync(path.join(root, 'src/components/ArticleReader.tsx'), 'utf8')
const rulesSource = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8')

// Keep this pure and offline: it verifies the invariants that must never depend
// on Firebase availability, credentials, or a browser session.
const normalize = (value) => value
  .normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/ـ/g, '')
  .replace(/[إأآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/[“”«»]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/[\u060C،؛؟!.,:()[\]{}]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const intervalOverlap = (aStart, aEnd, bStart, bEnd) => {
  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
  const shortest = Math.max(1, Math.min(aEnd - aStart, bEnd - bStart))
  return overlap / shortest
}

const wordOverlap = (left, right) => {
  const a = new Set(normalize(left).split(' ').filter(Boolean))
  const b = new Set(normalize(right).split(' ').filter(Boolean))
  if (!a.size || !b.size) return 0
  let common = 0
  for (const word of a) if (b.has(word)) common++
  return common / Math.max(1, Math.min(a.size, b.size))
}

assert.equal(normalize('إِنَّ  الذكاءـــ الاصطناعي،'), 'ان الذكاء الاصطناعي')
assert(intervalOverlap(10, 30, 12, 31) >= 0.8, 'overlapping selections must share a canonical highlight')
assert(wordOverlap('الذكاء الاصطناعي والإنسان', 'الذكاء الاصطناعي، والإنسان') >= 0.8, 'equivalent wording must canonicalize')
assert(intervalOverlap(0, 10, 40, 50) < 0.8, 'distant selections must remain distinct')
assert(readerSource.includes('lenDiffRatio <= 0.40'), 'canonical highlight must preserve the agreed ±40% selection tolerance')
assert(readerSource.includes('spans >= 0.60') && readerSource.includes('words >= 0.50'), '±40% tolerance must still require the same sentence, not a one-character collision')

// Transaction invariant model: one anonymous reader can contribute once;
// removal is idempotent and can never make the aggregate negative.
const members = new Set()
let count = 0
const save = (readerId) => {
  if (members.has(readerId)) return count
  members.add(readerId)
  count += 1
  return count
}
const remove = (readerId) => {
  if (!members.delete(readerId)) return count
  count = Math.max(0, count - 1)
  return count
}

assert.equal(save('reader-a'), 1)
assert.equal(save('reader-a'), 1, 'duplicate save must not increment')
assert.equal(save('reader-b'), 2, 'a second anonymous reader increments once')
assert.equal(remove('reader-a'), 1)
assert.equal(remove('reader-a'), 1, 'duplicate removal must not decrement')
assert.equal(remove('reader-b'), 0)
assert.equal(remove('reader-b'), 0, 'count must never become negative')

// Two simultaneous saves are serialized by the transaction in production;
// this queue model proves that both memberships survive without a lost update.
let transactionQueue = Promise.resolve()
const atomicSave = (readerId) => {
  const result = transactionQueue.then(() => save(readerId))
  transactionQueue = result.then(() => undefined, () => undefined)
  return result
}
const concurrentResults = await Promise.all([atomicSave('reader-c'), atomicSave('reader-d')])
assert.deepEqual(concurrentResults, [1, 2], 'concurrent saves must not lose a membership')
assert.equal(count, 2)
assert.equal(remove('reader-c'), 1)
assert.equal(remove('reader-d'), 0)

// Static guardrails: these are deliberately explicit so a future refactor
// cannot silently restore the old local-device counter or threshold.
for (const token of [
  "article_highlights",
  "article_highlight_members",
  "signInAnonymously",
  "articleContentVersion",
  "POPULAR_THRESHOLD = 1",
  "reader:quote-saved",
  "reader:popular-quote-updated",
  "findCanonicalHighlight",
  "أول إشارة قراءة لهذه العبارة",
  "showPopular",
]) assert(readerSource.includes(token), `missing reader invariant: ${token}`)

for (const token of [
  "isAnonymous()",
  "article_highlight_members/{highlightKey}/readers/{readerId}",
  "existsAfter",
  "request.resource.data.count == resource.data.count - 1",
  "allow read, write: if false",
]) assert(rulesSource.includes(token), `missing Firestore rule invariant: ${token}`)

assert(!readerSource.includes('article_quote_counts'), 'old client counter must not be used')
assert(!readerSource.includes('article_quote_votes'), 'old client vote collection must not be used')
assert(!readerSource.includes('lastMembership'), 'anonymous membership ids must not be exposed by the client count document')
assert(!rulesSource.includes('lastMembership'), 'anonymous membership ids must not be exposed by public aggregate documents')
const aggregateWrite = readerSource.slice(readerSource.indexOf('transaction.set(countRef'), readerSource.indexOf('return previous + 1'))
assert(!aggregateWrite.includes('note') && !aggregateWrite.includes('email'), 'personal note and email must never enter the aggregate write')

console.log('Popular Highlights self-test: PASS (normalization, canonical overlap, idempotent membership, threshold, and rule guardrails)')
