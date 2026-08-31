#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getKuwaitiProductionProgress,
  selectKuwaitiProductionSlug,
  validateKuwaitiQualityHolds,
} from './lib/kuwaiti-production-progress.mjs'
import { verifyKuwaitiProductionCorpusCertificate } from './lib/kuwaiti-production-corpus-certificate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')

const manifest = JSON.parse(read('scripts/data/kuwaiti-approved-site-five-v1.json'))
assert.equal(manifest.episodes.length, 5, 'قفل البداية يجب أن يحمل خمس حلقات فقط')
assert.equal(new Set(manifest.episodes.map((item) => item.audioSha256)).size, 5, 'بصمة صوت مكررة في الخمس')
for (const item of manifest.episodes) {
  assert.match(item.audioSha256, /^[a-f0-9]{64}$/u, `${item.slug}: بصمة الصوت ناقصة`)
  assert.ok(Number(item.runId) > 0 && item.artifactName, `${item.slug}: هوية Artifact ناقصة`)
}

const publisher = read('scripts/publish-audio-r2.mjs')
assert.match(publisher, /validationStatus:\s*'verified-r2'/u,
  'الناشر يجب أن يوسم الملف مباشرة بعد إثباته العام')
assert.match(publisher, /verifyPublicObject/u, 'لا اعتماد من دون فحص object العام')

const prune = read('scripts/prune-orphan-audio.mjs')
assert.match(prune, /\.dialogue-kw\.mp3/u, 'منظف اليتيم لا يعرف لاحقة الصوت الكويتي')
assert.match(prune, /\.dialogue-kw\.json/u, 'منظف اليتيم لا يعرف Transcript الكويتي')

const sync = read('scripts/sync-audio.mjs')
assert.ok((sync.match(/name\.endsWith\('\.dialogue-kw\.mp3'\)/gu) || []).length >= 2,
  'audio.json القديم يجب أن يتخطى الكويتي محلياً وخارجياً')

const reconcile = read('scripts/reconcile-audio-meta.mjs')
assert.match(reconcile, /`\$\{slug\}\.dialogue-kw\.mp3`/u, 'مصالحة R2 لا تستعيد الصوت الكويتي')
assert.match(reconcile, /`\$\{slug\}\.dialogue-kw\.json`/u, 'مصالحة R2 لا تستعيد Transcript الكويتي')

const firstRelease = read('.github/workflows/podcast-kuwaiti-publish-approved-five.yml')
for (const required of [
  'prepare-kuwaiti-approved-five-release.mjs',
  'audio:r2:publish',
  'audio:r2:commit',
  'commit-kuwaiti-public-ledger.sh',
  'podcast-kuwaiti-production-batch.yml',
]) assert.ok(firstRelease.includes(required), `حلقة نشر الخمس ناقصها: ${required}`)

const production = read('.github/workflows/podcast-kuwaiti-production-batch.yml')
for (const required of [
  "PODCAST_KW_REQUIRE_SINGLE_EPISODE: '1'",
  'prepare-kuwaiti-delegated-release.mjs',
  'audio:r2:publish',
  'audio:r2:commit',
  'inputs.chain_remaining == true',
  'select-kuwaiti-production-episode.mjs',
  'defer-kuwaiti-production-quality-hold.sh',
  'quality_round="$NEXT_ROUND"',
  'resume_run="$GITHUB_RUN_ID"',
  "steps.quality_recovery.outputs.retried",
  '--production-certificate',
  "steps.queue.conclusion == 'success'",
  'kuwaiti-production-progress.mjs --git-ref=origin/main',
  'include_quality_holds',
  '-f slugs="$NEXT"',
]) assert.ok(production.includes(required), `مسار الـ143 ناقصه: ${required}`)
assert.ok(!production.includes('batch_size مقفول على 5'), 'ممنوع رجوع توليد خمس حلقات في نداء واحد')
assert.ok(production.includes('if [ "$MISSING" -eq 0 ]'),
  'ممنوع إعلان 143/143 أو النشر النهائي وفي القائمة حلقات مؤجلة')
assert.match(production,
  /Start the next missing episode[\s\S]*steps\.queue\.conclusion == 'success'[\s\S]*steps\.ledger_commit\.conclusion == 'success'[\s\S]*steps\.quality_recovery\.conclusion == 'success'/u,
  'غياب queue code لا يجوز أن يتحول رقميا إلى نجاح ويطلق قطار فشل')
assert.match(production,
  /quality_recovery[\s\S]*steps\.package_upload\.conclusion == 'success'/u,
  'الجولة التالية لا تبدأ قبل حفظ Artifact الجولة الحالية')

const certifiedCorpus = verifyKuwaitiProductionCorpusCertificate(ROOT)
assert.equal(certifiedCorpus.certificate.episodeCount, 143, 'شهادة الكلمات لا تغطي مقالات الموقع كلها')
assert.equal(certifiedCorpus.corpus.size, 143, 'متن الصقل الفعلي ناقص عن شهادة الـ143')

const qualityHolds = JSON.parse(read('scripts/data/kuwaiti-production-quality-holds-v1.json'))
validateKuwaitiQualityHolds(qualityHolds, ['a-generation-without-rootsarabic'])
assert.equal(qualityHolds.episodes[0]?.slug, 'a-generation-without-rootsarabic',
  'الحلقة التي استنفدت 18 Take يجب ألا تحبس بقية الإنتاج')
const syntheticProgress = getKuwaitiProductionProgress({
  slugs: ['held', 'next', 'done'],
  audioMeta: { 'done.dialogue-kw.mp3': { validationStatus: 'verified-r2' } },
  qualityHolds: {
    schemaVersion: 1,
    episodes: [{
      slug: 'held', status: 'quality-hold', failedRunId: 1, failedRunAttempt: 3,
      failedRounds: 3, failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
    }],
  },
})
assert.equal(syntheticProgress.nextSlug, 'next', 'المؤجلة حبست الحلقة السليمة التالية')
assert.equal(syntheticProgress.complete, false, 'المؤجلة حسبت خطأ ضمن الإنتاج المكتمل')
assert.throws(() => selectKuwaitiProductionSlug({
  slugs: ['held'], audioMeta: {}, qualityHolds: {
    schemaVersion: 1,
    episodes: [{
      slug: 'held', status: 'quality-hold', failedRunId: 1, failedRunAttempt: 3,
      failedRounds: 3, failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
    }],
  }, explicitSlug: 'held',
}), /include_quality_holds/u, 'الحلقة المؤجلة أعيد صرفها من غير قرار صريح')
assert.equal(selectKuwaitiProductionSlug({
  slugs: ['held'], audioMeta: {}, qualityHolds: {
    schemaVersion: 1,
    episodes: [{
      slug: 'held', status: 'quality-hold', failedRunId: 1, failedRunAttempt: 3,
      failedRounds: 3, failedTakes: 18, reason: 'test', deferredAt: '2026-01-01T00:00:00.000Z',
    }],
  }, explicitSlug: 'held', includeQualityHolds: true,
}), 'held', 'تعذر فتح المؤجلة لاحقا بقرار صريح')

const lightweightLedger = read('scripts/commit-kuwaiti-public-ledger.sh')
assert.ok(lightweightLedger.includes('kuwaiti-production-quality-holds-v1.json'),
  'نجاح الحلقة المؤجلة لن يحررها من سجل main')

const delegated = read('scripts/prepare-kuwaiti-delegated-release.mjs')
for (const lock of [
  "audit.model !== 'gemini-2.5-pro-preview-tts'",
  "audit.voices?.male !== 'Puck'",
  "audit.voices?.female !== 'Zephyr'",
  "speaker?.dominant_register !== 'kuwait-city'",
  'speaker?.presenter_mode !== false',
  '(speaker?.drift_windows || []).length',
]) assert.ok(delegated.includes(lock), `تفويض النشر فقد قفلاً: ${lock}`)

const hosting = read('.github/workflows/firebase-hosting-live.yml')
assert.ok(hosting.includes('نشر الخمس الكويتية المعتمدة إلى الموقع'),
  'رفع الخمس عبر GITHUB_TOKEN لا يطلق push؛ يلزم workflow_run صريح للنشر')

console.log('✓ منظومة نشر الكويتية: بصمات الخمس + R2 + بقاء اللاحقة + حلقة واحدة + سلسلة محافظة')
