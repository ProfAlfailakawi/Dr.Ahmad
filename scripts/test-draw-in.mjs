#!/usr/bin/env node
/* حارس منطق «الرسم عند الظهور»: المنحنى الموحّد، العدّاد، التتابع، ووميض التغيّر. */
import assert from 'node:assert/strict'
import { countAt, easeE, shouldFlash, staggerMs } from '../src/lib/draw-logic.ts'

assert.equal(easeE(0), 0)
assert.equal(easeE(1), 1)
assert.ok(easeE(0.5) > 0.5, 'المنحنى يبدأ سريعاً ثم يستقرّ')
let last = -1
for (let i = 0; i <= 20; i += 1) { const v = easeE(i / 20); assert.ok(v >= last); last = v }

assert.equal(countAt(42, 0), 0)
assert.equal(countAt(42, 1), 42)
assert.equal(countAt(42, 5), 42)
assert.ok(Number.isInteger(countAt(42, 0.37)))
assert.equal(countAt(0, 0.5), 0)
assert.ok(Number.isNaN(countAt(NaN, 0.5)))
assert.equal(countAt(2.5, 1), 2.5)

assert.equal(staggerMs(0), 0)
assert.equal(staggerMs(3), 180)
assert.equal(staggerMs(100), 600)
assert.equal(staggerMs(-4), 0)

assert.equal(shouldFlash(null, 3, 5000), false)
assert.equal(shouldFlash(3, 3, 5000), false)
assert.equal(shouldFlash(0, 3, 30), false)
assert.equal(shouldFlash(2, 3, 2000), true)

console.log('draw-in logic: ok')
