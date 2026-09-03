#!/usr/bin/env node
/** بوابة النسخة الصوتية: 144 حلقة حول دقيقتين ونصف، بثلاثة فصول حية. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lib = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json'), 'utf8'))
const report = JSON.parse(readFileSync(resolve(ROOT, 'podcast-audits/condense-report.json'), 'utf8'))
const episodes = Object.entries(lib.episodes || {})
const durOf = (t) => String(t.text || '').length * 0.083 + (Number(t.pauseAfterMs) || 560) / 1000

assert.equal(episodes.length, 144, 'النسخة القصيرة يجب أن تحمل 144 حلقة')
assert.equal(report.length, 144, 'تقرير التكثيف يجب أن يغطي 144 حلقة')
assert.equal(report.filter((r) => r.flags?.length).length, 0, 'بقيت حلقات موسومة للمراجعة')

let minSec = Infinity; let maxSec = 0; let totalSec = 0; let overlaps = 0
for (const [slug, raw] of episodes) {
  const turns = Object.values(raw)
  assert.ok(turns.length >= 15, `${slug}: أقل من 15 مداخلة`)
  assert.equal(new Set(turns.map((t) => t.speaker)).size, 2, `${slug}: ليس حوار شخصين`)

  let run = 0; let last = null; let longest = 0; let segment = 0
  const segments = []
  for (const turn of turns) {
    run = turn.speaker === last ? run + 1 : 1
    longest = Math.max(longest, run); last = turn.speaker
    segment += durOf(turn)
    if (Number(turn.overlapMs) > 0) overlaps += 1
    if (turn.musicBridgeAfter) { segments.push(segment); segment = 0 }
  }
  segments.push(segment)
  const total = segments.reduce((a, b) => a + b, 0)
  minSec = Math.min(minSec, total); maxSec = Math.max(maxSec, total); totalSec += total

  assert.equal(longest <= 2, true, `${slug}: ${longest} مداخلات متتالية للمتحدث نفسه`)
  assert.equal(turns.filter((t) => t.musicBridgeAfter).length, 2, `${slug}: يلزم جسران`)
  assert.ok(turns.some((t) => Number(t.overlapMs) > 0), `${slug}: بلا مقاطعة/تداخل واحد على الأقل`)
  assert.ok(total >= 120 && total <= 165, `${slug}: المدة ${total.toFixed(1)}ث خارج هامش 2:30`)
  assert.ok(Math.max(...segments) <= 68, `${slug}: فصل يتجاوز 68ث (${segments.map((x) => x.toFixed(1)).join('/')})`)
  assert.ok(Math.min(...segments) >= 28, `${slug}: فصل قصير مصطنع (${segments.map((x) => x.toFixed(1)).join('/')})`)
}

console.log(`✓ 144/144 حلقة قصيرة: متوسط ${Math.round(totalSec / episodes.length)}ث · المدى ${Math.round(minSec)}–${Math.round(maxSec)}ث`)
console.log(`✓ جسران/حلقة · كل نداء ≤68ث · لا أكثر من صوتين متتاليين · ${overlaps} لحظة تداخل`)
