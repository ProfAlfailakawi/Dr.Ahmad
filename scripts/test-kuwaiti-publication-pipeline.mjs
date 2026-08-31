#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  '-f slugs="$NEXT"',
]) assert.ok(production.includes(required), `مسار الـ143 ناقصه: ${required}`)
assert.ok(!production.includes('batch_size مقفول على 5'), 'ممنوع رجوع توليد خمس حلقات في نداء واحد')

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
