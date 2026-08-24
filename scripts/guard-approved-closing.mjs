#!/usr/bin/env node
/**
 * حارس الختام المتصل.
 *
 * كان المونتاج يلصق مقطعاً قديماً معتمداً كي يضمن نطق الاسم، لكنه كان
 * يغيّر جرس الشخصية في آخر جملة. القرار الأحدث: نثبّت **النطق** في طبقة
 * مدخل الصوت، ونترك الختام يتولد داخل الـTake الحالي كي يبقى نفس الإنسان.
 *
 * يمنع هذا الحارس ثلاث سقطات: عودة المقطع القديم، اختلاف نص الإحالة بين
 * الحلقات، أو خروج اسم العائلة من مدخل الصوت بغير «الفيلتشاوي» المعتمدة.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPronunciationMap, toSpokenKuwaiti } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const REFERRAL = 'تلقى المقال الأصلي في موقع الدكتور'
export const APPROVED_SPOKEN_FAMILY_NAME = 'الفيلتشاوي'

const engine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
const buildStart = engine.indexOf('function buildTimedMaster')
const buildEnd = engine.indexOf('\nfunction ', buildStart + 1)
assert.ok(buildStart >= 0 && buildEnd > buildStart, 'تعذر العثور على مونتاج الحلقة لفحص الختام')
const buildSource = engine.slice(buildStart, buildEnd)
assert.doesNotMatch(buildSource, /kuwaiti-closing-approved\.mp3|CLOSING_CLIP|useFixedClosing/,
  'عاد لصق الختام القديم؛ الاسم يجب أن يتولد داخل نفس الـTake الحالي')
assert.match(buildSource, /const file = files\[i\]/,
  'المونتاج لا يثبت أن كل دور، ومنه الختام، مأخوذ من الـTake الحالي')

const pronunciationPath = resolve(ROOT, 'src/data/kuwaiti-pronunciation.json')
assert.ok(existsSync(pronunciationPath), 'دفتر النطق الكويتي مفقود')
const pronunciation = buildPronunciationMap(JSON.parse(readFileSync(pronunciationPath, 'utf8')))
const displayClosing = `${REFERRAL} أحمد حسين الفيلچاوي.`
const spokenClosing = toSpokenKuwaiti(displayClosing, pronunciation)
assert.match(spokenClosing, new RegExp(APPROVED_SPOKEN_FAMILY_NAME),
  `اسم العائلة لا يصل الصوت بالنطق المعتمد «${APPROVED_SPOKEN_FAMILY_NAME}»`)
assert.doesNotMatch(spokenClosing, /الفيل(?:ك|چ)اوي/,
  'الإملاء المعروض وصل إلى الصوت بدل النطق المعتمد')

/* نصّ الإحالة يبقى موحداً، لكن الصوت يتجدد مع شخصية الحلقة الحالية. */
const libPath = resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json')
if (existsSync(libPath)) {
  const eps = JSON.parse(readFileSync(libPath, 'utf8')).episodes
  let withReferral = 0; let mismatched = 0
  for (const ep of Object.values(eps)) {
    const t = Array.isArray(ep) ? ep : Object.values(ep)
    const last = String(t[t.length - 1]?.text || '')
    if (!last.includes('الفيل')) continue
    withReferral += 1
    if (!last.includes(REFERRAL)) mismatched += 1
  }
  assert.equal(mismatched, 0, `${mismatched} حلقة ختامها يخالف نصّ الإحالة المقفول`)
  console.log(`✓ الختام المتصل: ${withReferral} حلقة تولّد الاسم مع صوتها الحالي · النطق ${APPROVED_SPOKEN_FAMILY_NAME}`)
} else {
  console.log(`✓ الختام المتصل: الاسم يتولد في نفس الـTake · النطق ${APPROVED_SPOKEN_FAMILY_NAME}`)
}
