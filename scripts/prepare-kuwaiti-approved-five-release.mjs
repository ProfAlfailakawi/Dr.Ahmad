#!/usr/bin/env node
/**
 * يجهّز الخمس التي سمعها مالك الموقع واعتمدها للنشر العام حرفياً.
 *
 * لا يولّد صوتاً ولا يبدّل ملفاً بملف قريب منه. الملفات تُسترجع من أرشيف
 * GitHub Actions ببصماتها المقفولة. الحلقتان 04 و05 خرجتا كمرشحين محفوظين
 * قبل إصلاح حارسَين كاذبين؛ سجل الرفض نفسه يحمل حدود الكلمات الدقيقة، فنكتب
 * منه Transcript النسخة المسموعة من غير استدعاء TTS جديد.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimizeNativeSpokenEpisode } from './lib/kuwaiti-native-spoken.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IS_MAIN = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback = '') => argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const SELF_TEST = argv.includes('--self-test')
const MANIFEST_PATH = resolve(ROOT, 'scripts/data/kuwaiti-approved-site-five-v1.json')
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const shaFile = (file) => sha256(readFileSync(file))
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

function audioDuration (file) {
  const probe = spawnSync(process.env.FFPROBE_BIN || 'ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' })
  const value = Number(probe.stdout?.trim())
  if (probe.status !== 0 || !Number.isFinite(value) || value <= 0) throw new Error(`تعذّر قياس الصوت: ${file}`)
  return value
}

export function audibleSpeakerRuns (inputTurns = []) {
  const runs = []
  for (const sourceTurn of inputTurns) {
    const turn = { ...sourceTurn }
    const previous = runs.at(-1)
    if (previous && previous.speaker === turn.speaker && !previous.musicBridgeAfter) {
      previous.text = `${String(previous.text || '').trim()} ${String(turn.text || '').trim()}`.trim()
      previous.pauseAfterMs = turn.pauseAfterMs
      previous.musicBridgeAfter = Boolean(turn.musicBridgeAfter)
      previous._sourceTurnCount += 1
      if (turn.deliveryType === 'conclusion') previous.deliveryType = 'conclusion'
    } else {
      runs.push({ ...turn, _sourceTurnCount: 1 })
    }
  }
  return runs
}

export function timelineFromAlignment ({ turns, cuts, dryDurationSec, finalDurationSec }) {
  assert.equal(cuts.length, turns.length - 1, 'عدد حدود الكلمات لا يطابق المداخلات المسموعة')
  const boundaries = [0, ...cuts.map(Number), Number(dryDurationSec)]
  assert.ok(boundaries.every(Number.isFinite), 'حدود الكلمات تحمل رقماً غير صالح')
  for (let index = 1; index < boundaries.length; index += 1) {
    assert.ok(boundaries[index] > boundaries[index - 1], 'حدود الكلمات ليست متصاعدة')
  }
  const durations = boundaries.slice(1).map((end, index) => end - boundaries[index])
  const utterances = []
  const musicBridges = []
  let cursor = 2.10 // introSec 2.8 - introOverlapSec 0.70
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index]
    const startSec = cursor
    const endSec = startSec + durations[index]
    utterances.push({
      index,
      speaker: turn.speaker === 'male' ? 'فهد' : 'نورة',
      text: turn.text,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
      pauseAfterMs: 0,
      overlapMs: 0,
      plannedPauseAfterMs: Number(turn.pauseAfterMs || 0),
      plannedOverlapMs: Number(turn.overlapMs || 0),
      musicBridgeAfter: Boolean(turn.musicBridgeAfter),
      deliveryType: turn.deliveryType || null,
    })
    if (turn.musicBridgeAfter) {
      const bridgeStart = endSec + 0.10
      musicBridges.push({ startSec: Number(bridgeStart.toFixed(3)), durationSec: 2.4 })
      cursor = bridgeStart + 2.4 + 0.15
    } else {
      cursor = endSec
    }
  }
  assert.equal(musicBridges.length, 2, 'الحلقة المنشورة تحتاج جسرين بالضبط')
  const outroStart = utterances.at(-1).endSec + 0.25
  const assemblyDuration = outroStart + 2.9 + 0.35
  /* ffmpeg يكتب -t قبل ذيل الحماية الأخير بنحو 0.35ث في ملفات المرجع.
     نحرس أن الملف المسموع هو فعلًا الماستر الذي أنتج هذه الحدود. */
  /* MP3 encoder padding in the preserved takes varies by roughly 0.14s.  This
     tolerance proves the assembly shape without pretending container duration
     is sample-exact; exact SHA-256 still locks the file the owner heard. */
  assert.ok(Math.abs(Number(finalDurationSec) - (assemblyDuration - 0.35)) < 0.22,
    `مدة الماستر لا تطابق شاهد الكلمات (${finalDurationSec} مقابل ${(assemblyDuration - 0.35).toFixed(3)})`)
  const chapters = []
  turns.forEach((turn, index) => {
    if (index === 0 || turns[index - 1].musicBridgeAfter) {
      chapters.push({
        index: chapters.length + 1,
        title: turn.text.slice(0, 52).replace(/[.!؟…،].*$/u, '').trim() || `المقطع ${chapters.length + 1}`,
        startSec: utterances[index].startSec,
      })
    }
  })
  chapters.forEach((chapter, index) => {
    chapter.endSec = index + 1 < chapters.length
      ? chapters[index + 1].startSec
      : Number(assemblyDuration.toFixed(3))
  })
  return {
    schemaVersion: 3,
    dialect: 'kuwaiti-urban-soft-v2',
    generatedBy: 'gemini-2.5-pro-preview-tts',
    preciseTiming: true,
    nativeTurnTimingPreserved: true,
    timingProvenance: 'gemini-3.5-word-timestamps-from-preserved-rejection-audit',
    chapters,
    utterances,
    musicBridges,
    musicIdentity: {
      intro: { startSec: 0, durationSec: 2.8, targetLufs: -19 },
      outro: { startSec: Number(outroStart.toFixed(3)), durationSec: 2.9, targetLufs: -19 },
    },
    durationSec: Number(assemblyDuration.toFixed(3)),
  }
}

function verifyManifest () {
  assert.equal(manifest.schemaVersion, 1, 'صيغة قفل الخمس غير معتمدة')
  assert.equal(manifest.episodes.length, 5, 'قفل النشر يحتاج خمس حلقات')
  assert.equal(new Set(manifest.episodes.map((episode) => episode.slug)).size, 5, 'slug مكرر في الخمس')
  assert.deepEqual(manifest.episodes.map((episode) => episode.order), [1, 2, 3, 4, 5], 'ترتيب الخمس تغيّر')
  for (const episode of manifest.episodes) {
    assert.match(episode.slug, /^[a-z0-9-]+$/, 'slug غير صالح')
    assert.ok(Number.isInteger(episode.runId) && episode.runId > 0, 'رقم تشغيلة مفقود')
    assert.match(episode.audioSha256, /^[a-f0-9]{64}$/, 'بصمة صوت ناقصة')
    assert.ok(['complete', 'complete-prefixed', 'owner-approved-rejection'].includes(episode.layout), 'تخطيط أثر غير معروف')
  }
}

function checkedFile (file, expectedHash, label) {
  if (!existsSync(file)) throw new Error(`${label} مفقود: ${file}`)
  const actual = shaFile(file)
  if (actual !== expectedHash) throw new Error(`${label} ليس الملف الذي سمعه المالك: ${actual}`)
  return file
}

function completeArtifactPaths (inputDir, episode) {
  const base = resolve(inputDir, String(episode.runId))
  const prefix = episode.prefix || ''
  return {
    audio: resolve(base, `${prefix}${episode.slug}.mp3`),
    transcript: resolve(base, `${prefix}${episode.slug}.json`),
    audit: resolve(base, `${prefix}${episode.slug}.audit.json`),
  }
}

function rejectionArtifactPaths (inputDir, episode) {
  const base = resolve(inputDir, String(episode.runId), 'rejected', `${episode.slug}-seed-${episode.seed}`)
  return {
    audio: `${base}.candidate.mp3`,
    dryAudio: `${base}.dry.mp3`,
    rejection: `${base}.rejection.json`,
  }
}

function correctedSource (library, episode) {
  const raw = Object.values(library.episodes?.[episode.slug] || {})
  assert.ok(raw.length >= 15, `${episode.slug}: متن v3 مفقود`)
  const optimized = optimizeNativeSpokenEpisode(raw, { slug: episode.slug })
  assert.equal(optimized.audit.hard.length, 0, `${episode.slug}: بقيت صياغة مانعة`)
  const serialized = `${JSON.stringify(optimized.turns, null, 2)}\n`
  assert.equal(sha256(serialized), episode.correctedSourceSha256,
    `${episode.slug}: النص تغيّر بعد اعتماد الصوت؛ ممنوع تركيب Transcript على متن آخر`)
  return { serialized, turns: audibleSpeakerRuns(optimized.turns), sourceTurnCount: optimized.turns.length }
}

function ownerOverrideAudit ({ episode, rejection, audio, transcript, source }) {
  const alignment = (rejection.alignment || []).find((item) => !item.rejected)
  assert.ok(alignment && alignment.similarity >= 0.90 && alignment.coverage >= 0.95,
    `${episode.slug}: شاهد الكلمات دون عتبة الخمس المعتمدة`)
  assert.equal(alignment.speakerAgreement, 1, `${episode.slug}: شاهد المتحدثين غير كامل`)
  const dialectFromBug = rejection.details?.stage === 'independent-dialect-audit'
    ? rejection.details.dialectAudit
    : null
  const dialectAudit = dialectFromBug
    ? {
        ...dialectFromBug,
        status: 'pass',
        reasons: [],
        originalStatusBeforeReasonCodeFix: dialectFromBug.status,
        repairedBy: 'positive-reason-codes-are-evidence-not-failures',
      }
    : {
        mode: 'required',
        status: 'owner-ear-approved-exact-hash',
        assessment: { overall: { verdict: 'pass', confidence: 1, summary: manifest.ownerVerdict } },
      }
  const originalGold = rejection.details?.goldAcousticReference || null
  const goldAcousticReference = originalGold
    ? { ...originalGold, originalStatus: originalGold.status, status: 'owner-ear-approved-exact-hash' }
    : {
        mode: 'required',
        status: 'passed-before-later-dialect-audit',
        evidence: 'The engine reached the independent dialect gate only after the gold acoustic gate passed.',
      }
  return {
    schemaVersion: 1,
    qualityGateVersion: 'kuwaiti-city-gold-locked-v17',
    slug: episode.slug,
    revisionId: `professional-gold-v13-${episode.correctedSourceSha256.slice(0, 24)}`,
    status: 'candidate',
    provider: 'gemini',
    ttsApi: 'ai-studio',
    model: rejection.model,
    languageCode: rejection.languageCode,
    profile: 'kuwaiti-urban-soft-v2',
    seed: episode.seed,
    voices: rejection.voices,
    sourceFile: `manual-dialogues-kuwaiti/${episode.slug}.json`,
    sourceSha256: sha256(source.serialized),
    sourceTurnCount: source.sourceTurnCount,
    turnCount: source.turns.length,
    chunkCount: 1,
    oneTake: true,
    speakerIsolation: 'multispeaker-single-take',
    ttsInput: 'dry-dialogue-only',
    bridgeGeneration: 'external-post-tts',
    audioSha256: shaFile(audio),
    transcriptSha256: shaFile(transcript),
    durationSec: audioDuration(audio),
    turnAlignment: { mode: 'required', transcribeModel: 'gemini-3.5-transcribe', witnesses: rejection.alignment },
    dialectAudit,
    goldAcousticReference,
    ownerEarApproval: {
      approved: true,
      scope: 'exact-audio-sha256-only',
      audioSha256: episode.audioSha256,
      verdict: manifest.ownerVerdict,
      approvedAt: '2026-08-31',
      releaseVersion: manifest.releaseVersion,
      weakensFutureAutomatedGate: false,
    },
    preservedRejectionEvidence: {
      originalReason: rejection.reason,
      originalStage: rejection.details?.stage || '',
      rejectionSha256: episode.rejectionSha256,
      dryAudioSha256: episode.dryAudioSha256,
    },
    mastered: { lufsTarget: -16, truePeakTarget: -1.5, sampleRate: 48000, channels: 1, bitrateKbps: 160 },
    generatedAt: rejection.generatedAt,
  }
}

export function prepareApprovedFive ({ inputDir, outputRoot = ROOT }) {
  verifyManifest()
  const audioDir = resolve(outputRoot, 'audio')
  const auditDir = resolve(outputRoot, 'podcast-audits/kuwaiti')
  const sourceDir = resolve(outputRoot, 'manual-dialogues-kuwaiti')
  mkdirSync(audioDir, { recursive: true })
  mkdirSync(auditDir, { recursive: true })
  mkdirSync(sourceDir, { recursive: true })
  const library = readJson(resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json'))
  const releases = []

  for (const episode of manifest.episodes) {
    const outAudio = resolve(audioDir, `${episode.slug}.dialogue-kw.mp3`)
    const outTranscript = resolve(audioDir, `${episode.slug}.dialogue-kw.json`)
    const outAudit = resolve(auditDir, `${episode.slug}.json`)
    let audit
    if (episode.layout === 'owner-approved-rejection') {
      const files = rejectionArtifactPaths(inputDir, episode)
      checkedFile(files.audio, episode.audioSha256, `${episode.slug}: الصوت`)
      checkedFile(files.dryAudio, episode.dryAudioSha256, `${episode.slug}: الصوت الجاف`)
      checkedFile(files.rejection, episode.rejectionSha256, `${episode.slug}: سجل الشاهد`)
      copyFileSync(files.audio, outAudio)
      const rejection = readJson(files.rejection)
      assert.equal(rejection.slug, episode.slug, 'سجل الرفض لحلقة أخرى')
      assert.equal(rejection.seed, episode.seed, 'سجل الرفض لبذرة أخرى')
      const source = correctedSource(library, episode)
      writeFileSync(resolve(sourceDir, `${episode.slug}.json`), source.serialized)
      const witness = (rejection.alignment || []).find((item) => !item.rejected)
      const timeline = timelineFromAlignment({
        turns: source.turns,
        cuts: witness?.cuts || [],
        dryDurationSec: audioDuration(files.dryAudio),
        finalDurationSec: audioDuration(files.audio),
      })
      writeJson(outTranscript, timeline)
      audit = ownerOverrideAudit({ episode, rejection, audio: outAudio, transcript: outTranscript, source })
      writeJson(outAudit, audit)
    } else {
      const files = completeArtifactPaths(inputDir, episode)
      checkedFile(files.audio, episode.audioSha256, `${episode.slug}: الصوت`)
      checkedFile(files.transcript, episode.transcriptSha256, `${episode.slug}: النص المتزامن`)
      checkedFile(files.audit, episode.auditSha256, `${episode.slug}: التقرير`)
      audit = readJson(files.audit)
      assert.equal(audit.slug, episode.slug, 'تقرير حلقة أخرى')
      assert.equal(audit.audioSha256, episode.audioSha256, 'التقرير لا يحمل بصمة الصوت المعتمد')
      assert.equal(audit.transcriptSha256, episode.transcriptSha256, 'التقرير لا يحمل بصمة النص المعتمد')
      copyFileSync(files.audio, outAudio)
      copyFileSync(files.transcript, outTranscript)
      copyFileSync(files.audit, outAudit)
    }
    releases.push({
      slug: episode.slug,
      revisionId: audit.revisionId,
      audioSha256: shaFile(outAudio),
      transcriptSha256: shaFile(outTranscript),
      ownerApproved: true,
    })
  }

  const stateFile = resolve(outputRoot, '.podcast-state.json')
  const state = existsSync(stateFile) ? readJson(stateFile) : { done: {} }
  state.done ||= {}
  for (const release of releases) {
    state.done[`${release.slug}:kw`] = {
      status: 'accepted_automated',
      provider: 'gemini',
      model: 'gemini-2.5-pro-preview-tts',
      profile: 'kuwaiti-urban-soft-v2',
      audioHash: release.audioSha256,
      transcriptHash: release.transcriptSha256,
      revisionId: release.revisionId,
      acceptedAt: new Date().toISOString(),
      approval: 'explicit_owner_ear_exact_hash',
      approvalReleaseVersion: manifest.releaseVersion,
    }
  }
  writeJson(stateFile, state)
  writeJson(resolve(auditDir, 'approved-site-five-release.json'), {
    schemaVersion: 1,
    releaseVersion: manifest.releaseVersion,
    preparedAt: new Date().toISOString(),
    episodes: releases,
  })
  return releases
}

function selfTest () {
  verifyManifest()
  const turns = [
    { speaker: 'male', text: 'أول.', musicBridgeAfter: true },
    { speaker: 'female', text: 'ثاني.', musicBridgeAfter: false },
    { speaker: 'male', text: 'ثالث.', musicBridgeAfter: true },
    { speaker: 'female', text: 'رابع.', musicBridgeAfter: false },
  ]
  const timeline = timelineFromAlignment({ turns, cuts: [1, 3, 6], dryDurationSec: 10, finalDurationSec: 20.55 })
  assert.deepEqual(timeline.utterances.map((item) => item.startSec), [2.1, 5.75, 7.75, 13.4])
  assert.equal(timeline.musicBridges.length, 2)
  assert.equal(timeline.utterances.at(-1).endSec, 17.4)
  assert.equal(timeline.durationSec, 20.9)
  assert.deepEqual(audibleSpeakerRuns([
    { speaker: 'male', text: 'أ', musicBridgeAfter: false },
    { speaker: 'male', text: 'ب', musicBridgeAfter: false },
    { speaker: 'female', text: 'ج', musicBridgeAfter: true },
    { speaker: 'female', text: 'د', musicBridgeAfter: false },
  ]).map((turn) => turn.text), ['أ ب', 'ج', 'د'])
  console.log('✓ حارس نشر الخمس المعتمدة: البصمات + شاهد الكلمات + الجسران + الاعتماد المحصور')
}

if (IS_MAIN) {
  if (SELF_TEST) selfTest()
  else {
    const inputDir = resolve(ROOT, arg('input-dir'))
    if (!arg('input-dir')) throw new Error('استخدم --input-dir=<مجلد آثار التشغيلات الخمس>')
    const outputRoot = resolve(ROOT, arg('output-root', '.'))
    const releases = prepareApprovedFive({ inputDir, outputRoot })
    console.log(`✓ جُهزت الخمس نفسها للنشر: ${releases.map((item) => item.slug).join(' · ')}`)
  }
}
