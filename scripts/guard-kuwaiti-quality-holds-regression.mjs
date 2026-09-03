#!/usr/bin/env node
/**
 * حارس سجلّ تأجيل الجودة الكويتي.
 *
 * رفعُ نسخةٍ قديمة من Google Studio قد يمحو حلقةً استنفدت 18 Take من ملف
 * التأجيل، فتعود الحلقة تلقائياً إلى الطابور ويُصرف عليها مرةً ثانية. هذا
 * الحارس يجمع شهادات التأجيل التي ثبّتها GitHub Actions عبر التاريخ، ويعيد
 * كل شهادةٍ اختفت ما دامت الحلقة لم تُنشر لاحقاً بصوتٍ موثّق جديد.
 *
 * النشر الناجح هو طريق التحرير الوحيد: متى صار للصوت الكويتي مدخل
 * verified-r2 (وليس البصمة التي رفضها الدكتور) لا تُبعث شهادة التأجيل.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isVerifiedKuwaitiEpisode,
  validateKuwaitiQualityHolds,
} from './lib/kuwaiti-production-progress.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOLD_FILE = resolve(ROOT, 'scripts/data/kuwaiti-production-quality-holds-v1.json')
const AUDIO_META_FILE = resolve(ROOT, 'src/data/audio-meta.json')
const HUMAN_VETO_FILE = resolve(ROOT, 'scripts/data/kuwaiti-production-human-vetoes-v1.json')
const CORPUS_FILE = resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json')
const APPLY = process.argv.includes('--apply')
const SELF_TEST = process.argv.includes('--self-test')
const LOOKBACK = Number(process.env.KUWAITI_HOLD_LOOKBACK || 240)
const EMPTY_VETOES = { schemaVersion: 1, episodes: [] }

export function isTrustedQualityHoldCommit({ email = '', subject = '' } = {}) {
  return /github-actions\[bot\]@users\.noreply\.github\.com$/u.test(String(email))
    && subject === 'chore: defer exhausted Kuwaiti quality candidate'
}

export function restoreHistoricalQualityHolds({
  current,
  historical = [],
  audioMeta = {},
  humanVetoes = EMPTY_VETOES,
}) {
  const episodes = [...(current?.episodes || [])]
  const present = new Set(episodes.map((episode) => episode.slug))
  const restored = []
  for (const episode of historical) {
    if (present.has(episode.slug)) continue
    if (isVerifiedKuwaitiEpisode(audioMeta, episode.slug, humanVetoes)) continue
    episodes.push(episode)
    present.add(episode.slug)
    restored.push(episode.slug)
  }
  episodes.sort((left, right) => String(left.deferredAt || '').localeCompare(String(right.deferredAt || ''))
    || left.slug.localeCompare(right.slug, 'en'))
  return { document: { ...current, episodes }, restored }
}

if (SELF_TEST) {
  const hold = {
    slug: 'held', status: 'quality-hold', failedRunId: 9, failedRunAttempt: 3,
    failedRounds: 3, failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
  }
  const empty = { schemaVersion: 1, policy: {}, episodes: [] }
  const restored = restoreHistoricalQualityHolds({ current: empty, historical: [hold] })
  assert.deepEqual(restored.restored, ['held'], 'الحلقة الممحوة من نسخة قديمة لم تعد إلى التأجيل')
  assert.equal(restoreHistoricalQualityHolds({
    current: empty,
    historical: [hold],
    audioMeta: { 'held.dialogue-kw.mp3': { validationStatus: 'verified-r2', sha256: 'a'.repeat(64) } },
  }).restored.length, 0, 'الحلقة المنشورة عادت إلى التأجيل')
  assert.equal(restoreHistoricalQualityHolds({
    current: { ...empty, episodes: [hold] }, historical: [hold],
  }).document.episodes.length, 1, 'شهادة التأجيل تضاعفت')
  assert.equal(restoreHistoricalQualityHolds({
    current: empty,
    historical: [hold],
    audioMeta: { 'held.dialogue-kw.mp3': { validationStatus: 'verified-r2', sha256: 'b'.repeat(64) } },
    humanVetoes: {
      schemaVersion: 1,
      episodes: [{
        slug: 'held', status: 'human-veto', rejectedAudioSha256: 'b'.repeat(64),
        runId: 7, reason: 'رفض الدكتور',
      }],
    },
  }).restored.length, 1, 'الصوت المرفوض بشرياً حرر التأجيل خطأً')
  assert.ok(isTrustedQualityHoldCommit({
    email: '41898282+github-actions[bot]@users.noreply.github.com',
    subject: 'chore: defer exhausted Kuwaiti quality candidate',
  }), 'دفعة التأجيل الآلية لم تُعرف')
  assert.ok(!isTrustedQualityHoldCommit({
    email: 'owner@example.com',
    subject: 'chore: defer exhausted Kuwaiti quality candidate',
  }), 'رفع الإنسان صار شهادة تأجيل آلية')
  console.log('✓ حارس ارتداد تأجيل الجودة: 6/6')
  process.exit(0)
}

for (const file of [HOLD_FILE, AUDIO_META_FILE, CORPUS_FILE]) {
  if (!existsSync(file)) throw new Error(`ملف مطلوب مفقود: ${file}`)
}

function historicalQualityHolds() {
  const log = spawnSync('git', [
    'log', `-n${LOOKBACK}`, '--format=%H%x09%ae%x09%s',
    '--', 'scripts/data/kuwaiti-production-quality-holds-v1.json',
  ], { cwd: ROOT, encoding: 'utf8' })
  const rows = (log.stdout || '').split('\n').filter(Boolean).map((line) => {
    const [sha, email, ...subjectParts] = line.split('\t')
    return { sha, email, subject: subjectParts.join('\t') }
  }).filter(isTrustedQualityHoldCommit)
  const seen = new Map()
  for (const { sha } of rows) {
    const shown = spawnSync('git', [
      'show', `${sha}:scripts/data/kuwaiti-production-quality-holds-v1.json`,
    ], { cwd: ROOT, encoding: 'utf8' })
    if (shown.status !== 0) continue
    let parsed
    try { parsed = JSON.parse(shown.stdout) } catch { continue }
    for (const episode of parsed.episodes || []) {
      if (!seen.has(episode.slug)) seen.set(episode.slug, episode)
    }
  }
  return [...seen.values()]
}

const current = JSON.parse(readFileSync(HOLD_FILE, 'utf8'))
const audioMeta = JSON.parse(readFileSync(AUDIO_META_FILE, 'utf8'))
const humanVetoes = existsSync(HUMAN_VETO_FILE)
  ? JSON.parse(readFileSync(HUMAN_VETO_FILE, 'utf8'))
  : EMPTY_VETOES
const knownSlugs = Object.keys(JSON.parse(readFileSync(CORPUS_FILE, 'utf8')).episodes || {})
const historical = historicalQualityHolds()
const { document, restored } = restoreHistoricalQualityHolds({
  current, historical, audioMeta, humanVetoes,
})
validateKuwaitiQualityHolds(document, knownSlugs)

if (!restored.length) {
  console.log(`✓ حارس تأجيل الجودة: لا شهادة اختفت (${document.episodes.length} مؤجلة).`)
  process.exit(0)
}

console.log(`⛨ استُعيدت ${restored.length} حلقة مؤجلة محذوفة من رفع قديم:`)
for (const slug of restored) console.log(`  · ${slug}`)
if (!APPLY) {
  console.log('⚠ تشغيلة جافة. أضف --apply لكتابة السجل.')
  process.exit(0)
}
writeFileSync(HOLD_FILE, `${JSON.stringify(document, null, 2)}\n`)
console.log('✓ حُفظ سجل التأجيل؛ لن تُصرف الحلقات المستنفدة مرةً ثانية.')
