#!/usr/bin/env node
/**
 * عدّاد الاقتباس: متى يُجمع تحديدان في رقمٍ واحد؟
 *
 * الشكوى الأصلية كانت أن العدّاد لا يحسب الاختيارات المتقاربة، فيقتبس قارئان
 * الجملة نفسها بحدودٍ مختلفةٍ قليلاً فيخرج عدّادان بقيمة ١ بدل عدّادٍ بقيمة ٢.
 * هنا تُقاس القاعدة بالأرقام: ±٤٠٪ من طول التحديد القائم تُجمع، وما تجاوزها
 * لا يُجمع إلا إذا أثبت أنه الاقتباس نفسه بتقاطعٍ واسعٍ ومفرداتٍ مشتركة.
 */
import assert from 'node:assert/strict'
import { highlightMergeVerdict, MERGE_LENGTH_TOLERANCE } from '../src/lib/quote-merge.ts'

let passed = 0
const check = (label, fn) => { fn(); passed += 1; console.log(`✓ ${label}`) }

/* اقتباسٌ قائم في الفقرة: من الحرف ١٠٠ إلى ٢٠٠ (طوله ١٠٠). */
const existing = { existingStart: 100, existingEnd: 200 }
/* تحديدٌ يبدأ من الموضع نفسه بطولٍ مختلف — الحالة الواقعية: القارئ يسحب أبعد
   قليلاً أو يقصّر قليلاً وهو يقصد الجملة نفسها. */
const userOfLength = (length) => ({ userStart: 100, userEnd: 100 + length })
const verdictFor = (length, wordsRatio = 0.9) => highlightMergeVerdict({ ...existing, ...userOfLength(length), wordsRatio })

check('حدّ التسامح المعلن ٤٠٪', () => {
  assert.equal(MERGE_LENGTH_TOLERANCE, 0.40)
})

check('التطابق التام يُجمع', () => {
  const v = verdictFor(100)
  assert.equal(v.lenDiffRatio, 0)
  assert.equal(v.merges, true)
})

check('زيادة ١٠٪ تُجمع', () => {
  const v = verdictFor(110)
  assert.ok(Math.abs(v.lenDiffRatio - 0.10) < 1e-9)
  assert.equal(v.merges, true)
})

check('نقص ١٠٪ يُجمع', () => {
  const v = verdictFor(90)
  assert.ok(Math.abs(v.lenDiffRatio - 0.10) < 1e-9)
  assert.equal(v.merges, true)
})

check('زيادة ٤٠٪ تُجمع (الحدّ نفسه داخل النطاق)', () => {
  const v = verdictFor(140)
  assert.ok(Math.abs(v.lenDiffRatio - 0.40) < 1e-9)
  assert.equal(v.withinTolerance, true)
  assert.equal(v.merges, true)
})

check('نقص ٤٠٪ يُجمع', () => {
  const v = verdictFor(60)
  assert.ok(Math.abs(v.lenDiffRatio - 0.40) < 1e-9)
  assert.equal(v.withinTolerance, true)
  assert.equal(v.merges, true)
})

check('ما تجاوز ٤٠٪ يخرج من نطاق التسامح', () => {
  const v = verdictFor(160)
  assert.ok(v.lenDiffRatio > 0.40)
  assert.equal(v.withinTolerance, false)
})

check('ما تجاوز ٤٠٪ بمفرداتٍ ضعيفة لا يُجمع', () => {
  const v = highlightMergeVerdict({ ...existing, userStart: 100, userEnd: 260, wordsRatio: 0.1 })
  assert.equal(v.merges, false)
})

check('ما تجاوز ٤٠٪ لا يُجمع إلا بتقاطعٍ واسعٍ ومفرداتٍ مشتركة', () => {
  /* تحديدٌ أطول بكثير لكنه يبتلع الاقتباس القائم كلَّه ويشاركه مفرداته:
     هذا هو الاقتباس نفسه بحدودٍ أوسع، فيُجمع. */
  const v = highlightMergeVerdict({ ...existing, userStart: 100, userEnd: 260, wordsRatio: 0.85 })
  assert.equal(v.withinTolerance, false)
  assert.equal(v.spans >= 0.35, true)
  assert.equal(v.merges, true)
})

check('تحديدٌ في موضعٍ آخر من الفقرة لا يُجمع', () => {
  const v = highlightMergeVerdict({ ...existing, userStart: 400, userEnd: 500, wordsRatio: 0.05 })
  assert.equal(v.spans, 0)
  assert.equal(v.merges, false)
})

console.log(`\nالنتيجة: ${passed} تحققاً ناجحاً، 0 إخفاقاً.`)
