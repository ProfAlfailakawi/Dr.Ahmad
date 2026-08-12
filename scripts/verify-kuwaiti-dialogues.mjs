#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeManualDialogueTurns } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STANDARD = resolve(ROOT, 'manual-dialogues')
const SEED = resolve(ROOT, 'src/data/kuwaiti-dialogues.json')
const PILOT = 'success-that-does-not-bring-joy-to-its-ownerarabic'
const forbiddenTokens = new Set(['عايز', 'عاوز', 'إزاي', 'ازاي', 'مش', 'دلوقتي', 'أوي', 'اوي', 'كده', 'شو', 'هلّق', 'هلأ', 'إيش', 'وش'])
const kuwaitiMarkers = ['مو', 'هني', 'شنو', 'شلون', 'الحين', 'وايد', 'ماكو', 'تبي', 'ترى', 'إي', 'بس', 'قاعد', 'هال']

assert.ok(existsSync(STANDARD), 'مجلد الحوار العربي مطلوب للتحقق')
assert.ok(existsSync(SEED), 'ملف الحوار الكويتي الموحّد مطلوب للتحقق')
const standard = readdirSync(STANDARD).filter((name) => name.endsWith('.json')).sort()
const seed = JSON.parse(readFileSync(SEED, 'utf8'))
const episodes = seed?.episodes && typeof seed.episodes === 'object' ? seed.episodes : {}
const kuwaiti = Object.keys(episodes).sort()
const standardSlugs = standard.map((name) => basename(name, '.json'))
assert.equal(standard.length, 144, `المصدر العربي المتوقع 144، الموجود ${standard.length}`)
assert.equal(Number(seed?.count), 144, `عداد البذرة الكويتية المتوقع 144، الموجود ${seed?.count}`)
assert.deepEqual(new Set(kuwaiti), new Set(standardSlugs), 'يجب أن يكون لكل حوار عربي نظير كويتي بالـslug نفسه دون زيادة أو نقص')

let totalTurns = 0
let dialectHits = 0
for (const slug of kuwaiti) {
  const original = normalizeManualDialogueTurns(JSON.parse(readFileSync(resolve(STANDARD, `${slug}.json`), 'utf8')))
  const adapted = normalizeManualDialogueTurns(episodes[slug])
  assert.equal(adapted.length, original.length, `${slug}: عدد المداخلات تغير`)
  assert.deepEqual(adapted.map((turn) => turn.speaker), original.map((turn) => turn.speaker), `${slug}: ترتيب المتحدثين تغير`)
  const text = adapted.map((turn) => turn.text).join(' ')
  const contamination = (text.match(/[\u0621-\u064A]+/gu) || []).filter((token) => forbiddenTokens.has(token))
  if (text.includes('من بس') || text.includes('من من بس')) contamination.push('تركيب آلي فاسد')
  assert.equal(contamination.length, 0, `${slug}: انزلاق لهجي غير كويتي: ${contamination.join('، ')}`)
  const hits = kuwaitiMarkers.reduce((sum, marker) => sum + text.split(marker).length - 1, 0)
  assert.ok(hits >= 2, `${slug}: لا توجد إشارات كويتية كافية (${hits})`)
  dialectHits += hits
  totalTurns += adapted.length
}

const pilot = episodes[PILOT]
assert.ok(Array.isArray(pilot) && pilot.length >= 20, 'الحلقة التجريبية الكويتية غير مكتملة')
console.log(`✓ 144/144 حواراً كويتياً جاهزاً ومقابلاً للعربي واحداً بواحد`)
console.log(`✓ ${totalTurns} مداخلة · ${dialectHits} علامة لهجية كويتية · صفر انزلاق مصري/شامي/سعودي/إماراتي صريح`)
console.log(`✓ الحلقة التجريبية الجاهزة للتوليد: ${PILOT} (${pilot.length} مداخلة)`)
