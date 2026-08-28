#!/usr/bin/env node
/**
 * طابور توليد كويتي قابل للاستئناف.
 *
 * لا يغيّر البرومت ولا الأصوات ولا بوابات الجودة. وظيفته الوحيدة أن يجعل
 * المحرك الاحتمالي صالحاً لإنتاج 143 حلقة:
 *   - النجاح المثبت بالبصمات لا يُولّد مرة ثانية عند Rerun.
 *   - رفض الجودة (3) ينتقل إلى بذرة جديدة.
 *   - عطل Gemini المؤقت (75) يعيد البذرة نفسها ولا يحرق محاولة جودة.
 *   - نفاد الرصيد (78) يوقف القافلة ويحفظ كل ما سبق وما بقي.
 *   - كل حالة تُكتب ذرياً في manifest وPENDING؛ فلا توجد حلقة «سقطت».
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IS_MAIN = Boolean(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const valueArg = (name, fallback = '') => argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const SELF_TEST = argv.includes('--self-test')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (file, fallback = null) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}
const atomicJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true })
  const temporary = `${file}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, file)
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

export function seedForAttempt ({
  seedBase,
  slot,
  qualityAttempt,
  qualityStep = 10,
  qualityWaveSize = 3,
  qualityWaveStep = 1000,
}) {
  const attempt = Number(qualityAttempt)
  const waveSize = Number(qualityWaveSize)
  if (!Number.isSafeInteger(attempt) || attempt < 1) throw new Error(`محاولة جودة غير صالحة: ${qualityAttempt}`)
  if (!Number.isSafeInteger(waveSize) || waveSize < 1) throw new Error(`حجم موجة البذور غير صالح: ${qualityWaveSize}`)
  const wave = Math.floor((attempt - 1) / waveSize)
  const insideWave = (attempt - 1) % waveSize
  const seed = Number(seedBase) + Number(slot)
    + wave * Number(qualityWaveStep) + insideWave * Number(qualityStep)
  if (!Number.isSafeInteger(seed) || seed < 1) throw new Error(`بذرة غير صالحة: ${seed}`)
  return seed
}

export function queueActionForExitCode (code, transportAttempt, transientAttempts) {
  if (code === 0) return 'accept'
  if (code === 3) return 'next_quality_sample'
  if (code === 75) return transportAttempt < transientAttempts ? 'retry_same_seed' : 'defer_provider'
  if (code === 78) return 'stop_for_credit'
  return 'fatal'
}

export function candidatePaths (root, outputDir, slug) {
  return {
    source: resolve(root, 'manual-dialogues-kuwaiti', `${slug}.json`),
    generatedAudio: resolve(root, 'audio', `${slug}.dialogue-kw.mp3`),
    generatedTranscript: resolve(root, 'audio', `${slug}.dialogue-kw.json`),
    generatedAudit: resolve(root, 'podcast-audits', 'kuwaiti', `${slug}.json`),
    audio: resolve(outputDir, `${slug}.mp3`),
    transcript: resolve(outputDir, `${slug}.json`),
    audit: resolve(outputDir, `${slug}.audit.json`),
  }
}

/* Gemini Transcribe شاهد توقيت ممتاز، لكنه قد يخترع spk:2 أو يبدّل اسم
   الوسم مع بقاء الشخص نفسه. لذلك الاستئناف يطابق عقد المحرك v14: حدود
   الكلمات تقرر اكتمال الأدوار، وهوية الحنجرتين تقررها بوابات الطبقة
   والرنين أدناه. إعادة فرض speakerAgreement هنا كانت ترفض حلقة نجحت
   فعلاً، ثم تصرف عليها من جديد في كل Rerun. */
export function packagedAlignmentBoundaryTrustworthy (witness, turnCount) {
  if (!witness || witness.rejected || Number(witness.similarity) < 0.78 || Number(witness.coverage) < 0.84) return false
  const cuts = Array.isArray(witness.cuts) ? witness.cuts : null
  const perTurnCoverage = Array.isArray(witness.perTurnCoverage) ? witness.perTurnCoverage : []
  const perTurnHeardRatio = Array.isArray(witness.perTurnHeardRatio) ? witness.perTurnHeardRatio : []
  if (!Number.isInteger(turnCount) || turnCount < 1 || !cuts || cuts.length !== turnCount - 1) return false
  if (perTurnCoverage.length !== turnCount || perTurnHeardRatio.length !== turnCount) return false
  return perTurnCoverage.every((ratio) => Number(ratio) >= 0.5)
    && perTurnHeardRatio.every((ratio) => Number(ratio) >= 0.45 && Number(ratio) <= 1.8)
}

function packagedSpeakerIdentityTrustworthy (audit, minimumVoiceGap) {
  const gap = Number(audit.pitchGate?.voiceGapHz)
  if (!Number.isFinite(gap) || gap < minimumVoiceGap) return false
  for (const speaker of ['femaleContinuity', 'maleContinuity']) {
    const continuity = audit.pitchGate?.[speaker]
    if (!continuity || (continuity.segmentSuspects || []).length || (continuity.swapSegments || []).length) return false
  }
  return !(audit.acousticContinuity?.corroboratedBoundaryResets || []).length
}

export function verifyPackagedCandidate ({ root = ROOT, outputDir, slug, minimumVoiceGap = 25 }) {
  const paths = candidatePaths(root, outputDir, slug)
  for (const key of ['source', 'audio', 'transcript', 'audit']) {
    if (!existsSync(paths[key])) return { ok: false, reason: `ملف ${key} مفقود` }
  }
  const audit = readJson(paths.audit)
  if (!audit || audit.slug !== slug || audit.status !== 'candidate') return { ok: false, reason: 'سجل المرشح غير صالح' }
  if (audit.qualityGateVersion !== 'kuwaiti-aligned-v14') return { ok: false, reason: 'المرشح سابق لشاهد الكلمات v14' }
  if (audit.sourceSha256 !== sha256(readFileSync(paths.source))) return { ok: false, reason: 'المصدر تغيّر' }
  if (audit.audioSha256 !== sha256(readFileSync(paths.audio))) return { ok: false, reason: 'بصمة الصوت لا تطابق السجل' }
  if (audit.transcriptSha256 !== sha256(readFileSync(paths.transcript))) return { ok: false, reason: 'بصمة النص المتزامن لا تطابق السجل' }
  if (!audit.oneTake || audit.speakerIsolation !== 'multispeaker-single-take') return { ok: false, reason: 'الملف ليس Same-Take الحقيقي' }
  if (audit.ttsInput !== 'dry-dialogue-only' || audit.bridgeGeneration !== 'external-post-tts') return { ok: false, reason: 'الجسر دخل مرحلة TTS' }
  if (!packagedSpeakerIdentityTrustworthy(audit, minimumVoiceGap)) return { ok: false, reason: 'بوابات طبقة الصوت والرنين لا تثبت هوية الصوتين' }
  /* طبقة المنطوق قد تدمج أسطراً متجاورة للمتحدث نفسه؛ شاهد الكلمات
     يُحاذي utterances الفعلية في ملف التوقيت، لا عدد صفوف المصدر قبل الدمج. */
  const synchronizedTranscript = readJson(paths.transcript, {})
  const turnCount = Array.isArray(synchronizedTranscript?.utterances) ? synchronizedTranscript.utterances.length : 0
  const witness = (audit.turnAlignment?.witnesses || []).find((entry) => !entry.rejected)
  if (audit.turnAlignment?.mode !== 'required' || !packagedAlignmentBoundaryTrustworthy(witness, turnCount)) {
    return { ok: false, reason: 'شاهد حدود الكلمات ناقص أو دون العتبة' }
  }
  if ((audit.repeatGate?.confirmedSuspects || []).length) return { ok: false, reason: 'قص أو تمديد مؤكّد في دور' }
  return { ok: true, audit }
}

function runEngine ({ engine, slug, seed }) {
  return new Promise((done) => {
    const child = spawn(process.execPath, [engine, `--slug=${slug}`], {
      cwd: ROOT,
      env: { ...process.env, PODCAST_KW_PILOT_SLUG: slug, PODCAST_KW_SEED: String(seed) },
      stdio: 'inherit',
    })
    child.once('error', () => done(1))
    child.once('exit', (code, signal) => done(signal ? 1 : Number(code ?? 1)))
  })
}

function copyAcceptedCandidate (paths) {
  copyFileSync(paths.generatedAudio, paths.audio)
  copyFileSync(paths.generatedTranscript, paths.transcript)
  copyFileSync(paths.generatedAudit, paths.audit)
}

function removeInvalidPackagedCandidate (paths) {
  for (const key of ['audio', 'transcript', 'audit']) rmSync(paths[key], { force: true })
}

function summarize (manifest, outputDir) {
  const entries = Object.values(manifest.entries)
  manifest.counts = {
    total: entries.length,
    accepted: entries.filter((entry) => entry.status === 'accepted').length,
    qualityPending: entries.filter((entry) => entry.status === 'quality_pending').length,
    providerDeferred: entries.filter((entry) => entry.status === 'provider_deferred').length,
    creditBlocked: entries.filter((entry) => entry.status === 'credit_blocked').length,
    fatal: entries.filter((entry) => entry.status === 'fatal').length,
    untouched: entries.filter((entry) => entry.status === 'pending').length,
  }
  manifest.updatedAt = new Date().toISOString()
  atomicJson(resolve(outputDir, 'manifest.json'), manifest)
  const pending = entries.filter((entry) => entry.status !== 'accepted')
  const lines = pending.map((entry) => `${entry.slug}\t${entry.status}\t${entry.lastReason || ''}`)
  const pendingFile = resolve(outputDir, 'PENDING.txt')
  if (lines.length) writeFileSync(pendingFile, `${lines.join('\n')}\n`)
  else rmSync(pendingFile, { force: true })
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n## طابور الصوت الكويتي\n\n- ناجح ومحفوظ: **${manifest.counts.accepted}/${manifest.counts.total}**\n- ينتظر Take أفضل: **${manifest.counts.qualityPending}**\n- مؤجل بسبب المحرك: **${manifest.counts.providerDeferred}**\n- متوقف للرصيد: **${manifest.counts.creditBlocked}**\n- عطل حقيقي: **${manifest.counts.fatal}**\n`, { flag: 'a' })
  }
}

async function main () {
  const slugsFile = resolve(ROOT, valueArg('slugs-file', 'kuwaiti-production-slugs.txt'))
  const outputDir = resolve(ROOT, valueArg('out-dir', 'kuwaiti-production-package'))
  const engine = resolve(ROOT, valueArg('engine', 'scripts/podcast-kuwaiti-gemini.mjs'))
  const slotMap = readJson(resolve(ROOT, valueArg('slot-map', 'kuwaiti-production-seed-slots.json')), {}) || {}
  const seedBase = Number(valueArg('seed-base', process.env.PODCAST_KW_SEED_BASE || '2100'))
  const qualityAttempts = Number(valueArg('quality-attempts', '6'))
  const transientAttempts = Number(valueArg('transient-attempts', '3'))
  const qualityStep = Math.max(1, Number(valueArg('quality-step', '10')))
  const qualityWaveSize = Math.max(1, Number(valueArg('quality-wave-size', '3')))
  const qualityWaveStep = Math.max(1, Number(valueArg('quality-wave-step', '1000')))
  if (!Number.isInteger(qualityAttempts) || qualityAttempts < 1 || qualityAttempts > 6) throw new Error('quality-attempts بين 1 و6')
  if (!Number.isInteger(transientAttempts) || transientAttempts < 1 || transientAttempts > 6) throw new Error('transient-attempts بين 1 و6')
  const minimumVoiceGap = Math.max(0, Number(process.env.PODCAST_KW_MIN_GAP || 25))
  const slugs = readFileSync(slugsFile, 'utf8').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
  if (!slugs.length || new Set(slugs).size !== slugs.length) throw new Error('قائمة الحلقات فارغة أو مكررة')
  mkdirSync(outputDir, { recursive: true })
  const old = readJson(resolve(outputDir, 'manifest.json'), {}) || {}
  const manifest = {
    schemaVersion: 1,
    sourceSetSha256: sha256(slugs.map((slug) => readFileSync(resolve(ROOT, 'manual-dialogues-kuwaiti', `${slug}.json`))).join('\n')),
    startedAt: old.startedAt || new Date().toISOString(),
    entries: {}, counts: {},
  }
  for (const slug of slugs) {
    const previous = old.entries?.[slug]
    manifest.entries[slug] = previous && typeof previous === 'object'
      ? { ...previous, slug, history: Array.isArray(previous.history) ? previous.history : [] }
      : { slug, status: 'pending', history: [] }
  }
  summarize(manifest, outputDir)

  let circuitCode = 0
  for (let index = 0; index < slugs.length; index += 1) {
    const slug = slugs[index]
    const entry = manifest.entries[slug]
    const paths = candidatePaths(ROOT, outputDir, slug)
    const resume = verifyPackagedCandidate({ outputDir, slug, minimumVoiceGap })
    if (resume.ok) {
      entry.status = 'accepted'; entry.resumed = true; entry.seed = resume.audit.seed ?? entry.seed ?? null
      entry.audioSha256 = resume.audit.audioSha256; entry.lastReason = ''
      console.log(`↷ ${slug} — ناجحة ومحفوظة بالبصمات؛ ما نعيد صرفها`)
      summarize(manifest, outputDir)
      continue
    }
    removeInvalidPackagedCandidate(paths)
    if (circuitCode) {
      entry.status = 'pending'; entry.lastReason = 'لم تبدأ لأن قاطع حماية الرصيد/المحرك أوقف الجولة'
      continue
    }

    const slot = Number(slotMap[slug] || index + 1)
    let accepted = false
    for (let qualityAttempt = 1; qualityAttempt <= qualityAttempts; qualityAttempt += 1) {
      const seed = seedForAttempt({ seedBase, slot, qualityAttempt, qualityStep, qualityWaveSize, qualityWaveStep })
      for (let transportAttempt = 1; transportAttempt <= transientAttempts; transportAttempt += 1) {
        console.log(`── ${slug} · عينة ${qualityAttempt}/${qualityAttempts} · نقل ${transportAttempt}/${transientAttempts} · seed=${seed}`)
        const code = await runEngine({ engine, slug, seed })
        entry.history.push({ at: new Date().toISOString(), seed, qualityAttempt, transportAttempt, code })
        const action = queueActionForExitCode(code, transportAttempt, transientAttempts)
        if (action === 'accept') {
          copyAcceptedCandidate(paths)
          const verified = verifyPackagedCandidate({ outputDir, slug, minimumVoiceGap })
          if (!verified.ok) {
            entry.status = 'fatal'; entry.lastReason = `المحرك خرج ناجحاً لكن الحزمة فشلت: ${verified.reason}`; circuitCode = 1
          } else {
            entry.status = 'accepted'; entry.seed = seed; entry.audioSha256 = verified.audit.audioSha256
            entry.lastReason = ''; accepted = true
            console.log(`✓ ${slug} — اعتُمد seed=${seed} وحُفظ؛ لن يعاد في Rerun`)
          }
          break
        }
        if (action === 'next_quality_sample') {
          entry.status = 'quality_pending'; entry.lastReason = `العينة ${qualityAttempt} مرفوضة جودةً`
          break
        }
        if (action === 'retry_same_seed' || action === 'defer_provider') {
          entry.status = 'provider_deferred'; entry.lastReason = `عطل Gemini مؤقت على seed=${seed}`
          if (action === 'retry_same_seed') {
            const waitMs = Math.min(20_000, transportAttempt * 5_000)
            console.log(`↻ عطل مؤقت؛ نعيد البذرة نفسها بعد ${waitMs / 1000}ث من غير خصم عينة جودة`)
            await sleep(waitMs)
            continue
          }
          circuitCode = 75
          break
        }
        if (action === 'stop_for_credit') {
          entry.status = 'credit_blocked'; entry.lastReason = 'نفد رصيد Gemini؛ لم تُمس الحلقات الباقية'
          circuitCode = 78
          break
        }
        entry.status = 'fatal'; entry.lastReason = `المحرك خرج بالرمز ${code}`; circuitCode = 1
        break
      }
      summarize(manifest, outputDir)
      if (accepted || circuitCode) break
    }
    if (!accepted && !circuitCode) {
      entry.status = 'quality_pending'
      entry.lastReason = `${qualityAttempts} عينات مولدة رُفضت؛ تنتظر جولة ببذور جديدة`
      summarize(manifest, outputDir)
    }
  }
  summarize(manifest, outputDir)
  const { counts } = manifest
  console.log(`✓ الجولة: ${counts.accepted}/${counts.total} محفوظة · جودة مؤجلة ${counts.qualityPending} · محرك ${counts.providerDeferred} · رصيد ${counts.creditBlocked} · عطل ${counts.fatal}`)
  if (circuitCode) process.exit(circuitCode)
  if (counts.accepted !== counts.total) process.exit(2)
}

function selfTest () {
  assert.equal(seedForAttempt({ seedBase: 2100, slot: 4, qualityAttempt: 1 }), 2104)
  assert.equal(seedForAttempt({ seedBase: 2100, slot: 4, qualityAttempt: 2 }), 2114)
  assert.equal(seedForAttempt({ seedBase: 2100, slot: 4, qualityAttempt: 3 }), 2124)
  assert.equal(seedForAttempt({ seedBase: 2100, slot: 4, qualityAttempt: 4 }), 3104,
    'الموجة الثانية تبدأ بعائلة بذور جديدة تلقائياً')
  assert.equal(seedForAttempt({ seedBase: 2100, slot: 4, qualityAttempt: 6 }), 3124)
  assert.equal(queueActionForExitCode(3, 1, 3), 'next_quality_sample', 'رفض الجودة يغيّر البذرة')
  assert.equal(queueActionForExitCode(75, 1, 3), 'retry_same_seed', 'العطل المؤقت لا يغيّر البذرة')
  assert.equal(queueActionForExitCode(75, 3, 3), 'defer_provider', 'تكرر عطل المزوّد يفتح قاطع الحماية')
  assert.equal(queueActionForExitCode(78, 1, 3), 'stop_for_credit', 'نفاد الرصيد يوقف القافلة')
  assert.equal(queueActionForExitCode(1, 1, 3), 'fatal', 'عطب الكود لا يختبئ كرفض جودة')
  const root = mkdtempSync(resolve(tmpdir(), 'kw-queue-test-'))
  const outputDir = resolve(root, 'package')
  const slug = 'fixture'
  mkdirSync(resolve(root, 'manual-dialogues-kuwaiti'), { recursive: true })
  mkdirSync(outputDir, { recursive: true })
  const source = Buffer.from('[{"speaker":"male","text":"أ"},{"speaker":"female","text":"ب"}]\n')
  const audio = Buffer.from('fake-mp3-for-hash')
  const transcript = Buffer.from('{"utterances":[{"speaker":"male"},{"speaker":"female"}]}\n')
  writeFileSync(resolve(root, 'manual-dialogues-kuwaiti', `${slug}.json`), source)
  writeFileSync(resolve(outputDir, `${slug}.mp3`), audio)
  writeFileSync(resolve(outputDir, `${slug}.json`), transcript)
  atomicJson(resolve(outputDir, `${slug}.audit.json`), {
    slug, status: 'candidate', seed: 3114, qualityGateVersion: 'kuwaiti-aligned-v14',
    sourceSha256: sha256(source), audioSha256: sha256(audio), transcriptSha256: sha256(transcript),
    oneTake: true, speakerIsolation: 'multispeaker-single-take', ttsInput: 'dry-dialogue-only',
    bridgeGeneration: 'external-post-tts', pitchGate: {
      voiceGapHz: 67,
      femaleContinuity: { segmentSuspects: [], swapSegments: [] },
      maleContinuity: { segmentSuspects: [], swapSegments: [] },
    },
    turnAlignment: { mode: 'required', witnesses: [{
      method:'gemini-3.5-word-timestamps+diarization', similarity:0.96, coverage:0.98,
      cuts:[0.5], perTurnCoverage:[1,1], perTurnHeardRatio:[1,1],
      speakerLabels:['spk:0','spk:1','spk:2'], speakerMappingDistinct:true,
      speakerAgreement:0.5263, diarizationConsistent:false,
    }] },
    acousticContinuity: { boundarySuspects: [], pitchBoundarySuspects: [], corroboratedBoundaryResets: [] },
    repeatGate: { suspects: [], confirmedSuspects: [] },
  })
  assert.equal(verifyPackagedCandidate({ root, outputDir, slug }).ok, true,
    'وسوم ASR غير الثابتة لا تلغي حدود كلمات سليمة وهوية أثبتتها البوابات الصوتية')
  const fixtureAudit = readJson(resolve(outputDir, `${slug}.audit.json`))
  fixtureAudit.turnAlignment.witnesses[0].perTurnCoverage = [1, 0]
  atomicJson(resolve(outputDir, `${slug}.audit.json`), fixtureAudit)
  assert.match(verifyPackagedCandidate({ root, outputDir, slug }).reason, /حدود الكلمات/,
    'ضياع دور كامل يمنع الاستئناف حتى لو كان التطابق الإجمالي عالياً')
  fixtureAudit.turnAlignment.witnesses[0].perTurnCoverage = [1, 1]
  atomicJson(resolve(outputDir, `${slug}.audit.json`), fixtureAudit)
  writeFileSync(resolve(outputDir, `${slug}.mp3`), Buffer.from('tampered'))
  assert.match(verifyPackagedCandidate({ root, outputDir, slug }).reason, /بصمة الصوت/, 'أي تلف يمنع التخطي الكاذب')
  rmSync(root, { recursive: true, force: true })
  console.log('✓ Kuwaiti generation queue self-test: resume + hashes + seed plan')
}

if (IS_MAIN) {
  if (SELF_TEST) selfTest()
  else await main()
}
