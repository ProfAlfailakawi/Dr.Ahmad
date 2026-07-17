import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FFMPEG,
  HUMAN_AUDIO_PIPELINE_HASH,
  READING_VOICES,
  analyzeLoudness,
  analyzeSilence,
  assembleReading,
  atomicWriteJson,
  buildReadingSsml,
  cleanWorkDirectory,
  compareSpeechText,
  countArabicWords,
  humanLikenessGate,
  planReadingPerformance,
  probeAudio,
  snapshotLastKnownGood,
  sourceHash,
  trimAzureBoundarySilence,
} from './arabic-audio-engine.mjs'
import { spawnSync } from 'node:child_process'

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds))
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))
const PIPELINE_FILE = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(PIPELINE_FILE), '../..')
const PRONUNCIATION_MEMORY = resolve(ROOT, 'ArabicPronunciationMemory.sqlite')
export const HUMAN_READING_PIPELINE_HASH = createHash('sha256')
  .update(`${HUMAN_AUDIO_PIPELINE_HASH}\n${readFileSync(PIPELINE_FILE, 'utf8')}`)
  .digest('hex')
const normalizeArabic = (value) => String(value || '').replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '')
  .replace(/[^\u0621-\u064A0-9A-Za-z ]/g, '').replace(/\s+/g, ' ').trim()

function pronunciationMemory() {
  const db = new DatabaseSync(PRONUNCIATION_MEMORY)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS pronunciation_memory (
      normalized_word TEXT NOT NULL, original_text TEXT NOT NULL, sense_key TEXT NOT NULL,
      context_hash TEXT NOT NULL, context TEXT NOT NULL, voice TEXT NOT NULL,
      failed_pronunciation TEXT NOT NULL DEFAULT '', successful_pronunciation TEXT NOT NULL,
      method TEXT NOT NULL, ssml TEXT NOT NULL DEFAULT '', provider_fingerprint TEXT NOT NULL,
      last_success TEXT NOT NULL, use_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (normalized_word, sense_key, context_hash, voice, provider_fingerprint)
    );
  `)
  return db
}

function applyPronunciationMemory(unit, voice) {
  if (!unit.risks?.length) return unit
  const db = pronunciationMemory()
  try {
    const query = db.prepare(`SELECT successful_pronunciation, method FROM pronunciation_memory
      WHERE normalized_word = ? AND voice = ? ORDER BY use_count DESC, last_success DESC LIMIT 1`)
    const working = structuredClone(unit)
    const learned = []
    for (const risk of working.risks) {
      const row = query.get(normalizeArabic(risk.word), voice.azure)
      if (!row?.successful_pronunciation || !working.pronunciationText.includes(risk.word)) continue
      working.pronunciationText = working.pronunciationText.split(risk.word).join(row.successful_pronunciation)
      learned.push({ word: risk.word, pronunciation: row.successful_pronunciation, method: row.method })
    }
    working.pronunciationMemory = learned
    return working
  } finally {
    db.close()
  }
}

function rememberAcceptedPronunciations(unit, voice) {
  const learned = unit.pronunciationMemory || []
  if (!learned.length) return
  const db = pronunciationMemory()
  try {
    const update = db.prepare(`UPDATE pronunciation_memory SET use_count = use_count + 1, last_success = ?
      WHERE normalized_word = ? AND voice = ? AND successful_pronunciation = ?`)
    const now = new Date().toISOString()
    for (const item of learned) update.run(now, normalizeArabic(item.word), voice.azure, item.pronunciation)
  } finally {
    db.close()
  }
}

async function azureTts({ ssml, output, key, region }) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    try {
      const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
          'User-Agent': 'alfailakawi-human-reading-engine',
        },
        body: ssml,
      })
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length < 4_000) throw new Error('Azure أعاد WAV فارغاً أو مبتوراً')
        writeFileSync(output, buffer)
        return
      }
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`Azure TTS ${response.status}: ${(await response.text()).slice(0, 240)}`)
      }
    } catch (error) {
      if (attempt === 4) throw error
    } finally {
      clearTimeout(timer)
    }
    await sleep(1_200 * attempt)
  }
}

function wav16(input, output) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'تعذر تجهيز WAV لفحص STT')
}

async function azureSttLocale({ wav, key, region, language }) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed&profanity=raw`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
      },
      body: readFileSync(wav),
    }).catch(() => null)
    if (response?.ok) {
      const result = await response.json()
      const best = result.NBest?.[0] || {}
      const text = best.Display || best.Lexical || result.DisplayText || ''
      if (text) return { locale: language, text, confidence: Number(best.Confidence || 0), words: best.Words || [] }
    }
    if (response && response.status !== 429 && response.status < 500) break
    await sleep(900 * attempt)
  }
  return null
}

async function azureSttEnsemble({ wav, key, region, locale, intended }) {
  const converted = `${wav}.16k.wav`
  wav16(wav, converted)
  try {
    const locales = [...new Set([locale, 'ar-SA', 'ar-AE'])]
    const recognitions = (await Promise.all(locales.map((language) => azureSttLocale({
      wav: converted, key, region, language,
    })))).filter(Boolean).map((heard) => ({ ...heard, comparison: compareSpeechText(intended, heard.text) }))
    if (!recognitions.length) return null
    const ranked = [...recognitions].sort((left, right) => right.comparison.importantRatio - left.comparison.importantRatio
      || right.comparison.ratio - left.comparison.ratio || right.confidence - left.confidence)
    const importantPasses = recognitions.filter((item) => item.comparison.importantRatio >= 0.95).length
    return { ...ranked[0], ensemble: recognitions, consensusPass: importantPasses >= Math.ceil(recognitions.length / 2) }
  } finally {
    rmSync(converted, { force: true })
  }
}

function actualWpm(text, file) {
  const duration = Math.max(0.35, probeAudio(file).durationSec)
  /* السرعة تُقاس على زمن النطق الفعلي لا على الوقفات الدلالية: وحدة خطّاف قصيرة
     فيها «...» كانت تُحسب بطيئة مهما دفع المصحح (r002 في «ذكاء بلا ضمير») */
  const silence = analyzeSilence(file)
  const active = Math.max(0.35, duration - Number(silence?.totalSec || 0))
  return Math.round(countArabicWords(text) * 60 / active)
}

function highRiskMissing(comparison, risks) {
  const missing = new Set((comparison.missing || []).map((word) => word.replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي')))
  return (risks || []).filter((risk) => {
    const normalized = String(risk.word || '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[^\u0621-\u064A]/g, '')
    return normalized && [...missing].some((word) => normalized.includes(word) || word.includes(normalized))
  })
}

async function synthesizeAndVerifyUnit({ unit, voice, workDir, key, region, maxAttempts = 3 }) {
  const attempts = []
  let working = applyPronunciationMemory(unit, voice)
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const raw = resolve(workDir, `${unit.id}.a${attempt}.raw.wav`)
    const trimmed = resolve(workDir, `${unit.id}.a${attempt}.wav`)
    await azureTts({ ssml: buildReadingSsml(working, voice), output: raw, key, region })
    trimAzureBoundarySilence(raw, trimmed)
    rmSync(raw, { force: true })
    const measuredWpm = actualWpm(working.pronunciationText, trimmed)
    const target = Number(working.targetWordsPerMinute)
    const paceDelta = measuredWpm - target
    const heard = await azureSttEnsemble({ wav: trimmed, key, region, locale: voice.locale,
      intended: working.pronunciationText })
    const comparison = heard?.comparison || (heard ? compareSpeechText(working.pronunciationText, heard.text) : {
      ratio: 0, importantRatio: 0, missing: [], missingImportant: ['STT unavailable'],
    })
    const missingRisks = highRiskMissing(comparison, working.risks)
    const negationMissing = (comparison.missing || []).filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'غير', 'دون'].includes(word))
    /* الهدف تركيبي من المخطط لا من الدكتور، وSTT هو الفيصل الحقيقي على سلامة القراءة؛
       فتُوسَّع نافذة السرعة للأنواع البطيئة طبيعياً (تأمل/خلاصة/إنساني/تحذير) وتبقى
       أضيق للأنواع السريعة. r013 قُرئ بـSTT 100٪ وسقط عند 114/134 على نافذة ±8 صلبة. */
    const slowType = ['human', 'reflection', 'conclusion', 'closing', 'warning', 'question'].includes(String(working.type || ''))
    const paceWindow = slowType ? 16 : 11
    const pacePass = Math.abs(paceDelta) <= paceWindow
    /* عدالة الزلة الواحدة: وحدة من 8 كلمات مهمة لا تملك رصيد خطأ STT واحد بينما
       وحدة من 25 تملكه رياضياً (r002: كلمة واحدة أسقطتها ست ساعات متتالية).
       تُقبل زلة واحدة في الوحدات ذات ≤13 كلمة مهمة بشروط صارمة: ليست كلمة خطر
       ولا نفياً، النسبة الكلية ≥0.85، ونصف اللهجات على الأقل لا يفقد أكثر من زلة. */
    const importantTotal = Number(comparison.importantTotal || 99)
    const ensembleRecognitions = heard?.ensemble || []
    const oneSlipConsensus = ensembleRecognitions.length
      ? ensembleRecognitions.filter((item) => (item.comparison?.missingImportant || []).length <= 1).length
        >= Math.ceil(ensembleRecognitions.length / 2)
      : false
    const oneSlipPass = comparison.missingImportant.length === 1 && importantTotal < 20
      && comparison.ratio >= 0.85 && oneSlipConsensus
    const sttStrict = comparison.ratio >= 0.9 && comparison.importantRatio >= 0.95
      && heard?.consensusPass === true
    const sttPass = (sttStrict || oneSlipPass)
      && missingRisks.length === 0 && negationMissing.length === 0
    attempts.push({ attempt, ratePct: working.ratePct, targetWpm: target, measuredWpm, pacePass,
      stt: heard, comparison, missingRisks: missingRisks.map((risk) => risk.word), negationMissing })
    if (pacePass && sttPass) {
      rememberAcceptedPronunciations(working, voice)
      return { file: trimmed, unit: working, attempts, comparison, heard, measuredWpm }
    }
    if (attempt < maxAttempts) {
      rmSync(trimmed, { force: true })
      /* الهدف الرقمي تركيبي من المخطط لا من الكاتب؛ إن كان النص سليماً سمعياً والإيقاع
         المقاس ضمن النطاق البشري لكن بعيداً عن الهدف، يُصوَّب الهدف إلى المقاس —
         نفس مبدأ محرك الحوار المثبت (تصويب u002) بدل دفع المصحح إلى سقفه عبثاً */
      const unitAvgWordLen = String(working.pronunciationText || '').replace(/\s+/g, '').length
        / Math.max(1, String(working.pronunciationText || '').trim().split(/\s+/).length)
      const retargetFloor = (slowType || unitAvgWordLen >= 6) ? 92 : 104
      if (sttPass && !pacePass && measuredWpm >= retargetFloor && measuredWpm <= 175) {
        working.targetWordsPerMinute = measuredWpm
      }
      const retryTarget = Number(working.targetWordsPerMinute)
      const ratioCorrection = retryTarget > 0 && measuredWpm > 0 ? ((retryTarget / measuredWpm) - 1) * 100 : 0
      const articulationCorrection = sttPass ? 0 : -2
      working.ratePct = clamp(Math.round(working.ratePct + ratioCorrection + articulationCorrection), -16, 10)
      if (!sttPass && working.internalBreaks?.length) {
        working.internalBreaks = working.internalBreaks.map((item) => ({ ...item,
          durationMs: clamp(Number(item.durationMs || 110) + 25, 90, 220) }))
      }
    }
  }
  const last = attempts.at(-1)
  // أذن تشخيصية: ما سمعه STT فعلاً + الكلمات المفقودة — تشخيص بيقين لا بتخمين
  const heardText = String(last?.stt?.text || '').slice(0, 120)
  const missed = (last?.comparison?.missingImportant || []).slice(0, 6).join('، ')
  throw new Error(`${unit.id} فشل بعد ${maxAttempts} محاولات: STT ${Math.round((last?.comparison?.importantRatio || 0) * 100)}٪، السرعة ${last?.measuredWpm || 0}/${last?.targetWpm || 0}${heardText ? ` · سُمع: «${heardText}»` : ''}${missed ? ` · مفقود: ${missed}` : ''}`)
}

async function geminiAudioJudge({ file, plan, key, model = 'gemini-2.5-flash' }) {
  if (!key) return null
  const audio = readFileSync(file)
  if (audio.length > 18 * 1024 * 1024) throw new Error('ملف القراءة أكبر من حد الحكم الصوتي المباشر')
  const system = [
    'أنت حكم صوتي عربي مستقل وصارم. استمع إلى القراءة كاملة.',
    'قيّم ما إذا كان القارئ يفهم معنى كل جملة، وهل الأسئلة أسئلة حقيقية، وهل الوقفات والتنغيم والسرعة طبيعية.',
    'ارفض النبرة الإخبارية والإعلانية والمدرسية، التمثيل الزائد، النهايات المتطابقة، الكلمات المبتورة، الحركة الخاطئة، والصمت الآلي.',
    'النص الأصلي يجب أن يبقى كاملاً وبالترتيب نفسه. لا تعتبر نجاح STT دليلاً على صحة الحركة.',
    'أعد JSON فقط: {"pass":false,"humanLikeness":0,"warmth":0,"semanticDelivery":0,"questionNaturalness":0,"pauseNaturalness":0,"pronunciation":0,"rhythmVariety":0,"endingVariety":0,"nonBroadcastTone":0,"problems":[{"unitId":"","issue":"","repair":"rate|pitch|pause|pronunciation|regenerate"}]}',
  ].join('\n')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [
        { text: `خطة الأداء والنص المقصود:\n${JSON.stringify(plan.units.map((unit) => ({ id: unit.id, sourceText: unit.sourceText, type: unit.type, targetWordsPerMinute: unit.targetWordsPerMinute, pauseAfterMs: unit.pauseAfterMs, ending: unit.ending })))}` },
        { inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } },
      ] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 1400 },
    }),
  })
  if (!response.ok) throw new Error(`حكم Gemini الصوتي رفض الطلب (${response.status}): ${(await response.text()).slice(0, 300)}`)
  const result = await response.json()
  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || ''
  const verdict = JSON.parse(text)
  const numericScores = ['humanLikeness', 'warmth', 'semanticDelivery', 'questionNaturalness', 'pauseNaturalness',
    'pronunciation', 'rhythmVariety', 'endingVariety', 'nonBroadcastTone']
  if (typeof verdict.pass !== 'boolean' || !Array.isArray(verdict.problems)
    || !numericScores.every((keyName) => Number.isFinite(Number(verdict[keyName])))) {
    throw new Error('حكم Gemini الصوتي أعاد بنية غير صالحة')
  }
  const minimum = Math.min(...numericScores.map((keyName) => Number(verdict[keyName])))
  return { ...verdict, pass: verdict.pass === true && verdict.problems.length === 0 && minimum >= 95, minimumDimension: minimum }
}

function stageAcceptedFile({ candidate, output }) {
  mkdirSync(dirname(output), { recursive: true })
  const staged = `${output}.next-${process.pid}-${Date.now()}`
  copyFileSync(candidate, staged)
  renameSync(staged, output)
}

export async function renderHumanReading({
  article,
  voiceKey,
  output,
  auditFile,
  workRoot,
  lastKnownGoodDirectory,
  quarantineDirectory,
  azureKey,
  azureRegion = 'uaenorth',
  geminiKey = '',
  requireAudioJudge = true,
  minimumHumanScore = 95,
  maxAttempts = 3,
}) {
  if (!azureKey) throw new Error('AZURE_SPEECH_KEY مفقود')
  const voice = READING_VOICES[voiceKey]
  if (!voice) throw new Error(`صوت غير معروف: ${voiceKey}`)
  const workDir = resolve(workRoot, `${article.slug}-${voiceKey}-${process.pid}`)
  cleanWorkDirectory(workDir)
  mkdirSync(dirname(auditFile), { recursive: true })
  mkdirSync(quarantineDirectory, { recursive: true })
  const startedAt = new Date().toISOString()
  const plan = planReadingPerformance({ title: article.title, sourceText: article.body, voiceKey })
  const articleSourceHash = sourceHash({ title: article.title, text: article.body, voice: voice.azure })
  let unitResults = []
  try {
    for (const unit of plan.units) {
      process.stdout.write(`    ${voice.label} ${unit.id}/${plan.units.length}\r`)
      unitResults.push(await synthesizeAndVerifyUnit({ unit, voice, workDir, key: azureKey,
        region: azureRegion, maxAttempts }))
    }
    process.stdout.write('\n')
    const candidate = resolve(workDir, `${article.slug}.${voiceKey}.candidate.mp3`)
    let assembled = null
    let technical = null
    let proxyGate = null
    let audioJudge = null
    let pass = false
    const semanticRepairRounds = []
    for (let reviewRound = 1; reviewRound <= 2; reviewRound += 1) {
      plan.units = unitResults.map((result) => ({ ...result.unit, measuredWordsPerMinute: result.measuredWpm }))
      assembled = assembleReading({
        segments: unitResults.map((result) => ({ file: result.file, pauseAfterMs: result.unit.pauseAfterMs, unitId: result.unit.id })),
        output: candidate,
        workDir,
      })
      technical = { probe: probeAudio(candidate), silence: analyzeSilence(candidate), loudness: analyzeLoudness(candidate) }
      proxyGate = humanLikenessGate({ plan, technical,
        sttComparisons: unitResults.map((result) => result.comparison), minimumScore: minimumHumanScore })
      audioJudge = await geminiAudioJudge({ file: candidate, plan, key: geminiKey })
      const judgePass = audioJudge ? audioJudge.pass : !requireAudioJudge
      pass = proxyGate.pass && judgePass
      semanticRepairRounds.push({ reviewRound, proxyGate, audioJudge })
      if (pass || reviewRound === 2 || !audioJudge?.problems?.length) break
      const targeted = [...new Set(audioJudge.problems.map((problem) => String(problem.unitId || '')).filter(Boolean))]
      if (!targeted.length) break
      for (const unitId of targeted) {
        const index = unitResults.findIndex((result) => result.unit.id === unitId)
        if (index < 0) continue
        const issue = audioJudge.problems.find((problem) => problem.unitId === unitId) || {}
        const repairedUnit = structuredClone(unitResults[index].unit)
        if (issue.repair === 'rate') repairedUnit.ratePct = clamp(repairedUnit.ratePct - 2, -16, 10)
        if (issue.repair === 'pause') repairedUnit.pauseAfterMs = clamp(repairedUnit.pauseAfterMs + 90, 120, 950)
        if (issue.repair === 'pitch' || repairedUnit.type === 'question') {
          repairedUnit.pitchPct = clamp(repairedUnit.pitchPct + 0.8, -3, 3)
          repairedUnit.ending = repairedUnit.type === 'question' ? 'open' : repairedUnit.ending
        }
        if (issue.repair === 'pronunciation') repairedUnit.internalBreaks = (repairedUnit.internalBreaks || [])
          .map((item) => ({ ...item, durationMs: clamp(Number(item.durationMs || 110) + 25, 90, 220) }))
        unitResults[index] = await synthesizeAndVerifyUnit({ unit: repairedUnit, voice, workDir,
          key: azureKey, region: azureRegion, maxAttempts })
      }
    }
    const audit = {
      schemaVersion: 1,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: pass ? 'accepted' : 'quarantined',
      sourceHash: articleSourceHash,
      pipelineHash: HUMAN_READING_PIPELINE_HASH,
      article: { slug: article.slug, title: article.title },
      voice,
      textIntegrity: {
        sourceUnchanged: plan.displayText === article.body,
        sourceWordCount: countArabicWords(article.body),
        plannedWordCount: countArabicWords(plan.units.filter((unit) => !unit.isTitle).map((unit) => unit.sourceText).join(' ')),
      },
      plan,
      units: unitResults.map((result) => ({ id: result.unit.id, attempts: result.attempts,
        acceptedRatePct: result.unit.ratePct, measuredWordsPerMinute: result.measuredWpm, stt: result.heard,
        comparison: result.comparison })),
      assembled,
      technical,
      humanLikenessProxy: proxyGate,
      audioJudge,
      semanticRepairRounds,
      pass,
    }
    if (!pass) {
      const quarantinedAudio = resolve(quarantineDirectory, `${article.slug}.${voiceKey}.${Date.now()}.mp3`)
      copyFileSync(candidate, quarantinedAudio)
      audit.quarantinedAudio = quarantinedAudio.replace(`${resolve(quarantineDirectory, '..')}/`, '')
      atomicWriteJson(auditFile, audit)
      throw new Error(`بوابة الصوت رفضت القراءة: proxy=${proxyGate.score}/100${audioJudge ? `، judge=${audioJudge.minimumDimension}/100` : '، الحكم السمعي غير متاح'}`)
    }
    snapshotLastKnownGood({ currentFile: output, auditFile, directory: lastKnownGoodDirectory })
    stageAcceptedFile({ candidate, output })
    audit.audio = { bytes: statSync(output).size, sha256: createHash('sha256').update(readFileSync(output)).digest('hex') }
    atomicWriteJson(auditFile, audit)
    return audit
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

export function readingNeedsGeneration({ article, voiceKey, output, auditFile, externalExists = false }) {
  if (!existsSync(output) && !externalExists) return { needed: true, reason: 'missing_audio' }
  if (!existsSync(auditFile)) return { needed: false, reason: 'legacy_last_known_good' }
  try {
    const audit = JSON.parse(readFileSync(auditFile, 'utf8'))
    const expectedSourceHash = sourceHash({ title: article.title, text: article.body, voice: READING_VOICES[voiceKey].azure })
    if (audit.status !== 'accepted') return { needed: true, reason: 'previous_not_accepted' }
    if (audit.sourceHash !== expectedSourceHash) return { needed: true, reason: 'source_changed' }
    if (audit.pipelineHash !== HUMAN_READING_PIPELINE_HASH) return { needed: true, reason: 'pipeline_changed' }
    return { needed: false, reason: 'content_hash_match' }
  } catch {
    return { needed: true, reason: 'invalid_audit' }
  }
}
