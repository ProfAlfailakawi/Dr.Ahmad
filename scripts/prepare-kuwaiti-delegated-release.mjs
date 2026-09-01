#!/usr/bin/env node
/**
 * يحوّل مرشح إنتاج واحد اجتاز كل البوابات إلى ملف قابل لناشر R2.
 *
 * التفويض من مالك الموقع لا يلغي أي بوابة: الاعتماد الآلي مقصور على Take
 * كامل يطابق مرجع الأذن الذهبي، وشاهد كلمات كامل، وشاهد لهجة كويت مدينة
 * مستقل للمتحدثين الاثنين. ما دون ذلك يبقى خارج الموقع.
 */
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyPackagedCandidate } from './run-kuwaiti-generation-queue.mjs'
import { validateKuwaitiHumanVetoes } from './lib/kuwaiti-production-progress.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IS_MAIN = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback = '') => argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback
const SELF_TEST = argv.includes('--self-test')
const readJson = (file, fallback = null) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}
const writeJson = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

export function delegatedDialectPolicy (audit) {
  if (!audit || audit.status !== 'candidate') return { ok: false, reason: 'الحالة ليست candidate' }
  if (audit.qualityGateVersion !== 'kuwaiti-city-gold-locked-v17') return { ok: false, reason: 'بوابة الجودة أقدم من v17' }
  if (audit.provider !== 'gemini' || audit.ttsApi !== 'ai-studio') return { ok: false, reason: 'مسار TTS غير معتمد' }
  if (audit.model !== 'gemini-2.5-pro-preview-tts') return { ok: false, reason: 'نموذج TTS غير مقفول' }
  if (audit.profile !== 'kuwaiti-urban-soft-v2') return { ok: false, reason: 'بروفايل اللهجة غير مقفول' }
  if (audit.voices?.male !== 'Puck' || audit.voices?.female !== 'Zephyr') return { ok: false, reason: 'الكاست تغيّر' }
  if (!Number.isInteger(Number(audit.seed)) || Number(audit.seed) < 1) return { ok: false, reason: 'بذرة العينة مفقودة' }
  if (audit.oneTake !== true || audit.speakerIsolation !== 'multispeaker-single-take') return { ok: false, reason: 'الحلقة ليست Same-Take حقيقي' }
  if (audit.ttsInput !== 'dry-dialogue-only' || audit.bridgeGeneration !== 'external-post-tts') return { ok: false, reason: 'الموسيقى دخلت TTS' }
  if (audit.goldAcousticReference?.status !== 'pass') return { ok: false, reason: 'مرجع أذن فهد ونورة لم يمر' }
  const dialect = audit.dialectAudit
  if (dialect?.status !== 'pass') return { ok: false, reason: 'شاهد اللهجة لم يمر' }
  const overall = dialect.assessment?.overall
  if (overall?.verdict !== 'pass' || Number(overall.confidence) < 0.90) return { ok: false, reason: 'ثقة اللهجة العامة دون 90%' }
  for (const [key, label] of [['fahad', 'فهد'], ['noura', 'نورة']]) {
    const speaker = dialect.assessment?.speakers?.[key]
    if (speaker?.verdict !== 'pass' || speaker?.dominant_register !== 'kuwait-city'
      || Number(speaker?.confidence) < 0.90 || speaker?.presenter_mode !== false
      || (speaker?.drift_windows || []).length) {
      return { ok: false, reason: `${label} ليس كويت مدينة ثابتاً بثقة 90%` }
    }
  }
  const duration = Number(audit.durationSec)
  if (!Number.isFinite(duration) || duration < 70 || duration > 180) return { ok: false, reason: 'مدة الحلقة خارج العقد' }
  return { ok: true, reason: '' }
}

export function delegatedReplacementPolicy ({ slug, existing, candidateAudioSha256, humanVetoes }) {
  if (existing?.validationStatus !== 'verified-r2') return { ok: true, replacingHumanVeto: false, reason: '' }
  validateKuwaitiHumanVetoes(humanVetoes)
  const veto = humanVetoes.episodes.find((episode) => episode.slug === slug)
  if (!veto || existing.sha256 !== veto.rejectedAudioSha256) {
    return { ok: false, replacingHumanVeto: false, reason: 'النسخة المنشورة ليست بصمة رفض بشري معتمدة' }
  }
  if (candidateAudioSha256 === veto.rejectedAudioSha256) {
    return { ok: false, replacingHumanVeto: false, reason: 'المرشح أعاد نفس الصوت الذي رفضه الدكتور' }
  }
  return { ok: true, replacingHumanVeto: true, reason: '' }
}

export function prepareDelegatedRelease ({ slug, packageDir, outputRoot = ROOT, minimumVoiceGap = 25 }) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('slug غير صالح')
  const verified = verifyPackagedCandidate({ root: outputRoot, outputDir: packageDir, slug, minimumVoiceGap })
  if (!verified.ok) throw new Error(`${slug}: الحزمة لا تجتاز عقد الاستئناف: ${verified.reason}`)
  const policy = delegatedDialectPolicy(verified.audit)
  if (!policy.ok) throw new Error(`${slug}: التفويض الآلي مرفوض: ${policy.reason}`)

  const publicMeta = readJson(resolve(outputRoot, 'src/data/audio-meta.json'), {}) || {}
  const existing = publicMeta[`${slug}.dialogue-kw.mp3`]
  const humanVetoes = readJson(resolve(outputRoot, 'scripts/data/kuwaiti-production-human-vetoes-v1.json'), {
    schemaVersion: 1, episodes: [],
  })
  const replacement = delegatedReplacementPolicy({
    slug,
    existing,
    candidateAudioSha256: verified.audit.audioSha256,
    humanVetoes,
  })
  if (!replacement.ok) throw new Error(`${slug}: النسخة الكويتية منشورة أصلاً؛ ${replacement.reason}`)
  if (replacement.replacingHumanVeto) {
    console.log(`✓ استبدال آمن: بصمة النسخة الحالية مرفوضة من الدكتور والمرشح الجديد مختلف`)
  }

  const audioDir = resolve(outputRoot, 'audio')
  const auditDir = resolve(outputRoot, 'podcast-audits/kuwaiti')
  mkdirSync(audioDir, { recursive: true })
  mkdirSync(auditDir, { recursive: true })
  const sourceAudio = resolve(packageDir, `${slug}.mp3`)
  const sourceTranscript = resolve(packageDir, `${slug}.json`)
  const sourceAudit = resolve(packageDir, `${slug}.audit.json`)
  for (const file of [sourceAudio, sourceTranscript, sourceAudit]) {
    if (!existsSync(file)) throw new Error(`ملف المرشح مفقود: ${file}`)
  }
  const audio = resolve(audioDir, `${slug}.dialogue-kw.mp3`)
  const transcript = resolve(audioDir, `${slug}.dialogue-kw.json`)
  copyFileSync(sourceAudio, audio)
  copyFileSync(sourceTranscript, transcript)
  copyFileSync(sourceAudit, resolve(auditDir, `${slug}.json`))

  const stateFile = resolve(outputRoot, '.podcast-state.json')
  const state = readJson(stateFile, { done: {} }) || { done: {} }
  state.done ||= {}
  state.done[`${slug}:kw`] = {
    status: 'accepted_automated',
    provider: 'gemini',
    model: verified.audit.model,
    profile: verified.audit.profile,
    audioHash: verified.audit.audioSha256,
    transcriptHash: verified.audit.transcriptSha256,
    revisionId: verified.audit.revisionId,
    acceptedAt: new Date().toISOString(),
    approval: 'owner_delegated_gold_gates_v1',
    approvalEvidence: {
      qualityGateVersion: verified.audit.qualityGateVersion,
      goldReferenceVersion: verified.audit.goldAcousticReference.referenceVersion,
      dialectConfidence: Number(verified.audit.dialectAudit.assessment.overall.confidence),
      exactAudioSha256: verified.audit.audioSha256,
    },
  }
  writeJson(stateFile, state)

  const githubEnv = process.env.GITHUB_ENV
  if (githubEnv) {
    writeFileSync(githubEnv,
      `RELEASED_SLUG=${slug}\nDIALOGUE_REVISION=${verified.audit.revisionId}\nRELEASE_AUDIO_SHA256=${verified.audit.audioSha256}\n`,
      { flag: 'a' })
  }
  console.log(`✓ تفويض محافظ: ${slug} · seed=${verified.audit.seed} · ${verified.audit.audioSha256.slice(0, 12)}`)
  return verified.audit
}

function passingAudit () {
  return {
    status: 'candidate', qualityGateVersion: 'kuwaiti-city-gold-locked-v17', provider: 'gemini', ttsApi: 'ai-studio',
    model: 'gemini-2.5-pro-preview-tts', profile: 'kuwaiti-urban-soft-v2', seed: 2101,
    voices: { male: 'Puck', female: 'Zephyr' }, oneTake: true, speakerIsolation: 'multispeaker-single-take',
    ttsInput: 'dry-dialogue-only', bridgeGeneration: 'external-post-tts', durationSec: 110,
    goldAcousticReference: { status: 'pass' },
    dialectAudit: {
      status: 'pass',
      assessment: {
        overall: { verdict: 'pass', confidence: 0.95 },
        speakers: {
          fahad: { verdict: 'pass', dominant_register: 'kuwait-city', confidence: 0.95, presenter_mode: false, drift_windows: [] },
          noura: { verdict: 'pass', dominant_register: 'kuwait-city', confidence: 0.96, presenter_mode: false, drift_windows: [] },
        },
      },
    },
  }
}

function selfTest () {
  assert.equal(delegatedDialectPolicy(passingAudit()).ok, true)
  for (const mutate of [
    (audit) => { audit.ttsApi = 'vertex' },
    (audit) => { audit.oneTake = false },
    (audit) => { audit.goldAcousticReference.status = 'reject' },
    (audit) => { audit.dialectAudit.assessment.speakers.fahad.dominant_register = 'saudi' },
    (audit) => { audit.dialectAudit.assessment.speakers.noura.presenter_mode = true },
    (audit) => { audit.dialectAudit.assessment.speakers.noura.drift_windows = [{ startSec: 40 }] },
    (audit) => { audit.dialectAudit.assessment.overall.confidence = 0.89 },
  ]) {
    const audit = structuredClone(passingAudit())
    mutate(audit)
    assert.equal(delegatedDialectPolicy(audit).ok, false, 'أي انزلاق لازم يوقف التفويض')
  }
  const slug = 'human-veto-test'
  const rejected = 'b'.repeat(64)
  const humanVetoes = {
    schemaVersion: 1,
    episodes: [{
      slug, status: 'human-veto', rejectedAudioSha256: rejected,
      runId: 1, reason: 'test', rejectedAt: '2026-01-01T00:00:00.000Z',
    }],
  }
  assert.equal(delegatedReplacementPolicy({
    slug, existing: { validationStatus: 'verified-r2', sha256: rejected },
    candidateAudioSha256: 'a'.repeat(64), humanVetoes,
  }).replacingHumanVeto, true, 'رفض الدكتور يجب أن يفتح استبدالاً واحداً ببصمة جديدة')
  assert.equal(delegatedReplacementPolicy({
    slug, existing: { validationStatus: 'verified-r2', sha256: rejected },
    candidateAudioSha256: rejected, humanVetoes,
  }).ok, false, 'ممنوع إعادة نفس الصوت المرفوض')
  assert.equal(delegatedReplacementPolicy({
    slug, existing: { validationStatus: 'verified-r2', sha256: 'c'.repeat(64) },
    candidateAudioSha256: 'a'.repeat(64), humanVetoes,
  }).ok, false, 'ممنوع الكتابة فوق حلقة منشورة ليست المرفوضة')
  console.log('✓ التفويض الآلي محافظ: Same-Take + فهد ونورة + كويت مدينة + صفر drift/presenter')
}

if (IS_MAIN) {
  if (SELF_TEST) selfTest()
  else {
    const slug = arg('slug')
    const packageDir = resolve(ROOT, arg('package-dir', 'kuwaiti-production-package'))
    prepareDelegatedRelease({ slug, packageDir })
  }
}
