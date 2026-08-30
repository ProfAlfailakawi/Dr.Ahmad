#!/usr/bin/env node
/**
 * يجهّز حلقةً واحدة من الخمس التي اعتمدها الدكتور في run 33132655399.
 * الأداء والكاست والبذرة مقفولة؛ الشيء الوحيد المتغير عن الملفات المسموعة
 * هو تصحيح الكلمات التي سمّاها الدكتور صراحةً.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimizeNativeSpokenEpisode } from './lib/kuwaiti-native-spoken.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback = '') => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const SELF_TEST = process.argv.includes('--self-test')
const slug = arg('slug')
const outDir = resolve(ROOT, arg('out-dir', 'manual-dialogues-kuwaiti'))
const lockDir = resolve(ROOT, arg('lock-dir', 'podcast-audits/source-locks-kuwaiti'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (file) => JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'))

const manifest = readJson('scripts/data/kuwaiti-professional-gold-v13.json')
const library = readJson('src/data/kuwaiti-diwania-v3.json')
assert.equal(manifest.schemaVersion, 1, 'صيغة المرجع الاحترافي غير معتمدة')
assert.equal(manifest.approvedRunId, 33132655399, 'رقم تشغيلة المرجع الاحترافي تغيّر')
assert.equal(manifest.episodes.length, 5, 'المرجع الاحترافي لازم يحتوي الخمس المعتمدة كلها')
assert.deepEqual(manifest.episodes.map((episode) => episode.seed), [2101, 2102, 2103, 2114, 2115],
  'بذور الخمس المعتمدة تغيّرت')

const forbiddenBySlug = new Map([
  ['the-classroom-that-fears-mistakesarabic', [
    /القلق/u, /ينختبر/u, /نرجع لجبهة/u, /يبلع صوته/u, /\bتكفي\b/u, /\bبدال\b/u,
  ]],
  ['intelligence-without-a-consciencearabic', [/خلنا نوقف هني/u]],
  ['when-seriousness-becomes-a-mask-for-escapearabic', [
    /نرد… ونكتشف/u, /عن سؤال ندري/u, /\bنفرق بين/u,
  ]],
  ['how-do-we-assess-without-breaking-the-human-beingarabic', [
    /\bتدرين شنو/u, /\bبالضبط\b/u, /اختبار يصير حكم/u, /\bتخيلي طالب/u,
  ]],
])

function prepare (episode) {
  const raw = Object.values(library.episodes?.[episode.slug] || {})
  assert.ok(raw.length >= 15, `${episode.slug}: متن v3 مفقود`)
  assert.equal(raw.filter((turn) => turn.musicBridgeAfter).length, 2, `${episode.slug}: يلزم جسران مونتاجيان`)
  const result = optimizeNativeSpokenEpisode(raw, { slug: episode.slug })
  assert.equal(result.audit.hard.length, 0,
    `${episode.slug}: بقيت صياغة مانعة: ${result.audit.hard.map((finding) => finding.label).join(' · ')}`)
  const serialized = `${JSON.stringify(result.turns, null, 2)}\n`
  const sourceHash = sha256(serialized)
  assert.equal(sourceHash, episode.correctedSourceSha256,
    `${episode.slug}: النص/الكاست خرج عن النسخة المعتمدة ذات تصحيحات الكلمات فقط`)
  const fullText = result.turns.map((turn) => turn.text).join('\n')
  for (const pattern of forbiddenBySlug.get(episode.slug) || []) {
    assert.doesNotMatch(fullText, pattern, `${episode.slug}: رجعت كلمة سبق أن رفضها الدكتور: ${pattern}`)
  }
  return { ...result, serialized, sourceHash }
}

const selected = SELF_TEST
  ? manifest.episodes
  : manifest.episodes.filter((episode) => episode.slug === slug)
assert.ok(selected.length, SELF_TEST ? 'لا حلقات في المرجع الاحترافي' : `الحلقة مو من الخمس المعتمدة: ${slug}`)

if (!SELF_TEST) {
  mkdirSync(outDir, { recursive: true })
  mkdirSync(lockDir, { recursive: true })
}

for (const episode of selected) {
  const prepared = prepare(episode)
  if (!SELF_TEST) {
    writeFileSync(resolve(outDir, `${episode.slug}.json`), prepared.serialized)
    writeFileSync(resolve(lockDir, `${episode.slug}.json`), `${JSON.stringify({
      slug: episode.slug,
      revisionId: `professional-gold-v13-${prepared.sourceHash.slice(0, 24)}`,
      sourceVariant: 'doctor-approved-professional-v13-word-fixes-only',
      turnCount: prepared.turns.length,
      bridgeCount: 2,
      shortContentSha256: prepared.sourceHash,
      nativeSpokenVersion: prepared.version,
      nativeSpokenRewriteCount: prepared.changes.length,
      nativeSpokenChangesSha256: sha256(JSON.stringify(prepared.changes)),
      nativeSpokenQafRiskCount: prepared.audit.qafRiskCount,
      nativeSpokenSoftWarnings: prepared.audit.soft.length,
      dialogueVarietyVersion: prepared.conversationPlan.version,
      dialogueVarietyFamily: prepared.conversationPlan.family,
      dialogueVarietyCastSwapped: prepared.conversationPlan.castSwapped,
      professionalGoldReferenceVersion: manifest.referenceVersion,
      professionalGoldRunId: manifest.approvedRunId,
      professionalGoldAudioSha256: episode.audioSha256,
      professionalGoldSeed: episode.seed,
      professionalGoldHistoricalRequestSha256: episode.historicalRequestSha256,
    }, null, 2)}\n`)
  }
  console.log(`✓ ${episode.order}/5 ${episode.slug}: seed=${episode.seed} · ${prepared.turns.length} دوراً · ${prepared.sourceHash.slice(0, 12)}`)
}

console.log(SELF_TEST
  ? '✓ الخمس الاحترافية مقفولة: اللهجة والكاست كما سُمعت، والتغيير كلمات معتمدة فقط'
  : `✓ جُهّزت حلقة واحدة من المرجع الاحترافي: ${slug}`)
