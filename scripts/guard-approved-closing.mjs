#!/usr/bin/env node
/**
 * حارس الختام المعتمد.
 *
 * الجملة الختامية واحدةٌ حرفياً في ١٤٣ حلقة، ومع ذلك كان اسم الدكتور
 * يُقال صحيحاً في حلقةٍ وخطأً في أخرى **داخل التشغيلة الواحدة** — برهانٌ
 * قاطع أن العلّة تذبذبُ المحرّك لا الإملاء (شكواه تكرّرت أكثر من عشر
 * مرات في يومٍ واحد). فأقرّ مقطعاً بعينه من الحلقة الجبارة (تشغيلة
 * 32508152455) ليُلصق في كل حلقة.
 *
 * وهذا الحارس يمنع ثلاث سقطات: أن يُفقد المقطع · أن يُبدَّل بغيره ·
 * أن يتغيّر نصّ الإحالة فلا يعود المقطع مطابقاً لما يقوله المتن.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CLIP = resolve(ROOT, 'music', 'kuwaiti-closing-approved.mp3')
export const APPROVED_SHA256 = '79e0ca1dd20d539737d0f36b43fd065b8929fb2beca621f3895af1b5815f7bf8'
export const REFERRAL = 'تلقى المقال الأصلي في موقع الدكتور'

assert.ok(existsSync(CLIP), 'الختام المعتمد مفقود: music/kuwaiti-closing-approved.mp3')
const sha = createHash('sha256').update(readFileSync(CLIP)).digest('hex')
assert.equal(sha, APPROVED_SHA256, 'الختام المعتمد بُدّل — هذا المقطع أقرّه الدكتور بأذنه ولا يُستبدل إلا بإقرارٍ جديد')

/* والنصّ يجب أن يوافق ما ينطقه المقطع، وإلا لصقنا ختاماً يخالف المتن. */
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
  assert.equal(mismatched, 0, `${mismatched} حلقة ختامها يخالف نصّ المقطع المعتمد`)
  console.log(`✓ الختام المعتمد: بصمةٌ مطابقة · ${withReferral} حلقة ختامها يوافق المقطع`)
} else {
  console.log('✓ الختام المعتمد: بصمةٌ مطابقة')
}
