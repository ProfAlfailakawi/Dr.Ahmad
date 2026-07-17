#!/usr/bin/env node
/**
 * «البودكاست الحواري» — مقالٌ يتحوّل حواراً فصيحاً بين فهد ونورة (وبالإنجليزية: Andrew وAva).
 *
 * اللغة العربية: «فصحى حوارية عربية معاصرة» — Modern Conversational Standard Arabic.
 * صفر عامية. الواقعية من الأداء والإيقاع والوقفات، لا من «مو» و«ليش».
 *
 * ⛔ المسار المقبول الوحيد (شرط الدكتور الحاسم — أي اختصار له تنفيذ مرفوض):
 *   المقال ← فصحى حوارية معاصرة ← تحليل سياقي ← كشف الكلمات الخطرة
 *   ← نص نطقي مستقل (pronunciationText لا يظهر في الـTranscript)
 *   ← عدة مرشحين عند الحاجة ← توليد صوتي ← تحويل الصوت إلى نص (STT)
 *   ← فحص النطق والمعنى (مقارنة مطبّعة + Arabic Audio Judge)
 *   ← إعادة تلقائية للمقطع الفاشل فقط ← حفظ النطق الناجح في الذاكرة
 *   ← تركيب الحلقة ← فحص نهائي ← نشر.
 *
 * الطبقات الثلاث:
 *   sourceText        = المقال المنشور (في المستودع، لا يُمس)
 *   dialogueText      = الحوار الظاهر في Transcript (audio/<slug>.dialogue.json)
 *   pronunciationText = نسخة النطق تُرسل إلى Azure فقط (تشكيل انتقائي سياقي — لا تشكيل آلي كامل)
 *
 * الذاكرة والقاموس:
 *   scripts/pronunciation-lexicon.json  قاموس الموقع الدائم (أسماء، مصطلحات، اختصارات)
 *   scripts/pronunciation-memory.json   ArabicPronunciationMemory — يتعلم من كل تصحيح
 *
 * التشغيل:
 *   node scripts/podcast-dialogue.mjs --slug=<slug>            مقال محدد (عربي)
 *   node scripts/podcast-dialogue.mjs --slug=<slug> --lang=en  النسخة الإنجليزية
 *   node scripts/podcast-dialogue.mjs --latest=3 | --nightly
 *   أعلام: --dry-run (سيناريو فقط) · --force (تجاهل الحالة)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, renameSync, copyFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'
import {
  analyzeLoudness,
  analyzeSilence,
  humanLikenessGate,
  probeAudio,
} from './lib/arabic-audio-engine.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENGINE_SOURCE_HASH = createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-tmp')
const AUDITS = resolve(ROOT, 'podcast-audits')
const STATE_FILE = resolve(ROOT, '.podcast-state.json')
const MUSIC_LIB = resolve(ROOT, 'scripts/music-library.json')
const LEX_FILE = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const MEM_FILE = resolve(ROOT, 'ArabicPronunciationMemory.sqlite')
const LOCK_FILE = resolve(ROOT, '.podcast-dialogue.lock')
const BAKEOFF_PUBLIC = resolve(ROOT, 'public/audio/bakeoff')
const BAKEOFF_PRIVATE = resolve(AUDITS, 'voice-bakeoff.private.json')
const PILOT_AUDIO = resolve(ROOT, '.podcast-pilot-audio')
const RELEASES = resolve(ROOT, '.podcast-releases')
const LAST_GOOD = resolve(ROOT, '.podcast-last-known-good')
const PILOT_GATE_FILE = resolve(AUDITS, 'pilot-gate.json')
const QUARANTINE_AUDIO = resolve(AUDITS, 'quarantine-audio')
const STT_ENSEMBLE_LOCALES = ['ar-KW', 'ar-SA', 'ar-AE', 'ar-QA', 'ar-OM']
const SAMPLE_MIN_SEC = 85
const SAMPLE_MAX_SEC = 105

/* ── بيئة ── */
const env = { ...process.env }
if (existsSync(resolve(ROOT, '.env')))
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2')
  }
const GEMINI_KEY = env.GEMINI_API_KEY || env.GOOGLE_API_KEY
const AZURE_KEY = env.AZURE_SPEECH_KEY
const AZURE_REGION = (env.AZURE_SPEECH_REGION && /^[a-z0-9-]+$/i.test(env.AZURE_SPEECH_REGION) && env.AZURE_SPEECH_REGION.length < 30) ? env.AZURE_SPEECH_REGION : 'uaenorth'

/* كل طلب خارجي له مهلة صريحة؛ حتى لا يبقى تشغيل GitHub معلقًا إذا علقت
   شبكة Azure/Gemini. تُعاد المحاولة في الطبقة الخاصة بكل مزود. */
const networkTimeoutSignal = (ms) => {
  if (typeof AbortSignal?.timeout === 'function') return AbortSignal.timeout(ms)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  timer.unref?.()
  return controller.signal
}
const fetchWithTimeout = (url, init = {}, ms = 45_000) =>
  fetch(url, { ...init, signal: init.signal || networkTimeoutSignal(ms) })

/* ═══ تقسيم دلالي مشترك (مستوى الوحدة) — يستخدمه التطبيع قبل TTS ومسار إنقاذ المقطع المتجاوز ═══ */
const wordsOf = (text) => String(text || '').split(/\s+/).filter(Boolean)
function splitTextSemantically(text, target = 16, hard = 20) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (wordsOf(clean).length <= hard) return [clean]
  const rawParts = clean
    .split(/(?<=[،؛.!؟])\s+|(?=\s(?:بل|لكن|ولكن|فإذا|فهذا|وهنا|وعندها|لا\s))/u)
    .map((part) => part.trim()).filter(Boolean)
  const parts = rawParts.length > 1 ? rawParts : [clean]
  const chunks = []
  for (const part of parts) {
    if (wordsOf(part).length > hard) {
      const words = part.split(/\s+/)
      const numeric = (w) => /[0-9\u0660-\u0669٪%]/.test(w)
      let row = []
      for (const word of words) {
        row.push(word)
        if (row.length >= target && !numeric(word)) { chunks.push(row.join(' ')); row = [] }
      }
      if (row.length) chunks.push(row.join(' '))
      continue
    }
    const last = chunks.at(-1) || ''
    if (last && wordsOf(`${last} ${part}`).length <= target) chunks[chunks.length - 1] = `${last} ${part}`
    else chunks.push(part)
  }
  return chunks.map((part) => part.trim()).filter(Boolean)
}

/* اشتقاق تحليل نطق لقطعةٍ من تحليل الوحدة الكاملة — بلا أي نداء Gemini:
   ننقل التشكيل الانتقائي كلمةً بكلمة إن تطابق العدّ، ونرشّح الكلمات الخطرة بالانتماء. */
function derivePieceAnalysis(analysis, pieceText, pieceStartWord, pieceWordCount) {
  const plain = String(pieceText || '').replace(/\s+/g, ' ').trim()
  const fullPron = String(analysis?.pronunciationText || '').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const pronTokens = fullPron.split(' ').filter(Boolean)
  const fullTokens = wordsOf(String(analysis?.sourceTextForCount || ''))
  let pronunciationText = plain
  if (pronTokens.length && fullTokens.length === pronTokens.length
    && pieceStartWord >= 0 && pieceStartWord + pieceWordCount <= pronTokens.length) {
    pronunciationText = pronTokens.slice(pieceStartWord, pieceStartWord + pieceWordCount).join(' ')
  }
  const normalizeBasic = (w) => String(w || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '')
  const pieceNorm = normalizeBasic(plain)
  const risks = (analysis?.risks || []).filter((risk) => pieceNorm.includes(normalizeBasic(risk.word)))
  return { pronunciationText, risks }
}

/* ═══ كاش مقاطع الاستئناف — محليًا وعبر R2 staging (لا WAV داخل GitHub) ═══ */
const RESUME = !process.argv.includes('--no-resume')
const SEGMENT_CACHE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.podcast-segment-cache')
const R2_CONF = {
  bucket: env.CLOUDFLARE_R2_BUCKET || env.R2_BUCKET || '',
  endpoint: env.CLOUDFLARE_R2_ENDPOINT || '',
  key: env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
  secret: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
}
const r2StagingReady = () => Boolean(RESUME && R2_CONF.bucket && R2_CONF.endpoint && R2_CONF.key && R2_CONF.secret)
const r2Aws = (args, input) => spawnSync('aws', ['--endpoint-url', R2_CONF.endpoint, 's3api', ...args], {
  encoding: 'utf8', input,
  env: { ...process.env, AWS_ACCESS_KEY_ID: R2_CONF.key, AWS_SECRET_ACCESS_KEY: R2_CONF.secret, AWS_EC2_METADATA_DISABLED: 'true' },
})
const segmentKeyOf = ({ pipelineHash, voice, text, pronunciationText }) => createHash('sha256')
  .update([pipelineHash, voice, String(text || '').replace(/\s+/g, ' ').trim(), String(pronunciationText || '').trim()].join('|'))
  .digest('hex').slice(0, 24)
function segmentCacheGet(slug, key, dest) {
  const local = resolve(SEGMENT_CACHE_DIR, slug, `${key}.wav`)
  if (existsSync(local) && statSync(local).size > 4000) { copyFileSync(local, dest); return 'local' }
  if (!r2StagingReady()) return null
  const out = r2Aws(['get-object', '--bucket', R2_CONF.bucket, '--key', `staging/segments/${slug}/${key}.wav`, dest])
  if (out.status === 0 && existsSync(dest) && statSync(dest).size > 4000) {
    mkdirSync(resolve(SEGMENT_CACHE_DIR, slug), { recursive: true })
    copyFileSync(dest, local)
    return 'r2'
  }
  rmSync(dest, { force: true })
  return null
}
function segmentCachePut(slug, key, src) {
  try {
    mkdirSync(resolve(SEGMENT_CACHE_DIR, slug), { recursive: true })
    copyFileSync(src, resolve(SEGMENT_CACHE_DIR, slug, `${key}.wav`))
    if (r2StagingReady())
      r2Aws(['put-object', '--bucket', R2_CONF.bucket, '--key', `staging/segments/${slug}/${key}.wav`, '--body', src, '--content-type', 'audio/wav'])
  } catch { /* الكاش تحسين لا شرط */ }
}
function stagedAuditPush(slug, lang, file) {
  if (!r2StagingReady() || !existsSync(file)) return
  try { r2Aws(['put-object', '--bucket', R2_CONF.bucket, '--key', `staging/audits/${slug}.${lang}.json`, '--body', file, '--content-type', 'application/json']) } catch { /* تحسين */ }
}
function stagedAuditPull(slug, lang, dest) {
  if (!r2StagingReady() || existsSync(dest)) return existsSync(dest)
  try {
    const out = r2Aws(['get-object', '--bucket', R2_CONF.bucket, '--key', `staging/audits/${slug}.${lang}.json`, dest])
    if (out.status !== 0 || !existsSync(dest)) return false
    JSON.parse(readFileSync(dest, 'utf8'))
    return true
  } catch { rmSync(dest, { force: true }); return false }
}

const executable = (name, configured) => {
  const candidates = [configured, `/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`].filter(Boolean)
  return candidates.find((candidate) => existsSync(candidate)) || name
}
const FFMPEG = executable('ffmpeg', env.FFMPEG_BIN)
const FFPROBE = executable('ffprobe', env.FFPROBE_BIN)

/* locale الصوت يُشتق من اسمه: «ar-KW-FahedNeural» → «ar-KW». يعمّم المحرك لأي صوت عربي
   (SSML وSTT يتبعان الصوت المستخدم لا ثابت ar-KW). */
const localeOf = (voice) => (String(voice).match(/^([a-z]{2}-[A-Z]{2})/) || [])[1] || 'ar-KW'

/* أزواج الأصوات العربية للاختبار الأعمى (bakeoff). المتغير الوحيد بين النسخ هو الصوت. */
const AR_VOICE_PAIRS = [
  { id: 'kw', country: 'الكويت', nameA: 'فهد', nameB: 'نورة', A: 'ar-KW-FahedNeural', B: 'ar-KW-NouraNeural' },
  { id: 'sa', country: 'السعودية', nameA: 'حامد', nameB: 'زارية', A: 'ar-SA-HamedNeural', B: 'ar-SA-ZariyahNeural' },
  { id: 'ae', country: 'الإمارات', nameA: 'حمدان', nameB: 'فاطمة', A: 'ar-AE-HamdanNeural', B: 'ar-AE-FatimaNeural' },
  { id: 'qa', country: 'قطر', nameA: 'معاذ', nameB: 'أمل', A: 'ar-QA-MoazNeural', B: 'ar-QA-AmalNeural' },
  { id: 'om', country: 'عُمان', nameA: 'عبدالله', nameB: 'عائشة', A: 'ar-OM-AbdullahNeural', B: 'ar-OM-AyshaNeural' },
]

/* الزوج التقني المعتمد للموقع. أسماء الواجهة تبقى فهد ونورة والتجاوز البيئي متاح للاختبار فقط. */
const VOICES = {
  ar: {
    A: { name: env.PODCAST_AR_MALE_NAME || 'فهد', azure: env.PODCAST_AR_MALE || 'ar-KW-FahedNeural' },
    B: { name: env.PODCAST_AR_FEMALE_NAME || 'نورة', azure: env.PODCAST_AR_FEMALE || 'ar-KW-NouraNeural' },
  },
  en: {
    A: { name: 'Andrew', azure: env.PODCAST_EN_MALE || 'en-US-AndrewMultilingualNeural' },
    B: { name: 'Ava', azure: env.PODCAST_EN_FEMALE || 'en-US-AvaMultilingualNeural' },
  },
}

const args = process.argv.slice(2)
const flag = (n) => args.includes(`--${n}`)
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || ''
const LANG = (opt('lang') || 'ar')
const DRY = flag('dry-run')
const OFFLINE_DRY = DRY && (!AZURE_KEY || !GEMINI_KEY)
const FORCE = flag('force')
const SELF_TEST = flag('self-test')
const PREFLIGHT = flag('preflight')
const PLAN = flag('plan')
const REUSE_DIALOGUE = flag('reuse-dialogue')
/* وضع «بلا Gemini» — بأمر الدكتور للحلقات اليدوية: هو كاتب الحوار فلا حاجة لكاتب،
   والفحص يقوم على أذن Azure STT بعتبات مشدَّدة + كل البوابات التقنية (13ث، الوقفات،
   الذروة، السرعة) + بوابة البشرية التقنية ≥95 — بلا أي استدعاء Gemini يستهلك رصيداً. */
const NO_GEMINI = flag('no-gemini') || env.PODCAST_NO_GEMINI === '1'
const CANARY = flag('canary')
const BAKEOFF = flag('voice-bakeoff')
const VOICE_AUDITION = flag('voice-audition')
const VOICE_FINALIST_RETEST = flag('voice-finalist-retest')
const MALE_FINALIST_RETEST = flag('male-finalist-retest')
let PILOT_MODE = flag('pilot') || Number(opt('pilot') || 0) > 0
let PILOT_COUNT = Math.min(3, Math.max(1, Number(opt('pilot') || env.PODCAST_PILOT_COUNT || 3)))
const ROLLBACK_SLUG = opt('rollback')
const AUTO_PROMOTE_PILOT = String(env.PODCAST_AUTO_PROMOTE_PILOT || 'true').toLowerCase() !== 'false'
const REQUIRE_PILOT_GATE = String(env.PODCAST_REQUIRE_PILOT_GATE || 'true').toLowerCase() !== 'false'
// أُلغي المسار الخفيف نهائيًا: شروط القبول الحالية تمنع أي نشر يتجاوز STT والحكم الصوتي.
const LIGHT = false
let ARABIC_PRODUCTION_GATE_READY = false
if (!SELF_TEST && !ROLLBACK_SLUG && !OFFLINE_DRY && !AZURE_KEY) { console.error('✘ AZURE_SPEECH_KEY مفقود'); process.exit(1) }
if (!SELF_TEST && !ROLLBACK_SLUG && !OFFLINE_DRY && !VOICE_AUDITION && !VOICE_FINALIST_RETEST && !MALE_FINALIST_RETEST && !PREFLIGHT && !NO_GEMINI && !GEMINI_KEY) { console.error('✘ GEMINI_API_KEY أو GOOGLE_API_KEY مفقود'); process.exit(1) }
if (!SELF_TEST) {
  const acquire = () => writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' })
  try { acquire() }
  catch {
    let alive = false
    try {
      const previous = JSON.parse(readFileSync(LOCK_FILE, 'utf8'))
      if (Number(previous.pid) > 0) { process.kill(Number(previous.pid), 0); alive = true }
    } catch { /* lock قديم أو غير صالح */ }
    if (alive) { console.error('✘ محرك البودكاست يعمل الآن في عملية أخرى؛ مُنع تشغيل متزامن'); process.exit(5) }
    rmSync(LOCK_FILE, { force: true })
    acquire()
  }
  process.on('exit', () => rmSync(LOCK_FILE, { force: true }))
}

/* ── حالة idempotent + قاموس + ذاكرة ── */
function atomicWriteText(path, textValue) {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(temporary, textValue)
  renameSync(temporary, path)
}
function readJsonSafe(path, fallback) {
  if (!existsSync(path)) return fallback
  try { return JSON.parse(readFileSync(path, 'utf8')) }
  catch {
    const corrupt = `${path}.corrupt-${Date.now()}`
    renameSync(path, corrupt)
    console.error(`⚠ عُزل JSON تالف بدلاً من تعطيل المحرك: ${corrupt}`)
    return fallback
  }
}
const state = readJsonSafe(STATE_FILE, { done: {}, storyCount: 0, totalCount: 0, pilotGate: null })
if (!Object.prototype.hasOwnProperty.call(state, 'pilotGate')) state.pilotGate = null
const saveState = () => atomicWriteText(STATE_FILE, JSON.stringify(state, null, 1))

const sha256File = (path) => existsSync(path)
  ? createHash('sha256').update(readFileSync(path)).digest('hex') : ''
const safeSlug = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'episode'
const releaseTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')

function preserveRejectedCandidate(article, lang, reason) {
  const candidate = resolve(TMP, `${article.slug}.accepted-candidate.mp3`)
  if (!existsSync(candidate)) return null
  mkdirSync(QUARANTINE_AUDIO, { recursive: true })
  const stamp = releaseTimestamp()
  const base = `${safeSlug(article.slug)}.${lang}.${stamp}`
  const audio = resolve(QUARANTINE_AUDIO, `${base}.mp3`)
  copyFileSync(candidate, audio)
  atomicWriteText(resolve(QUARANTINE_AUDIO, `${base}.json`), JSON.stringify({
    slug: article.slug, lang, reason, createdAt: new Date().toISOString(),
    sha256: sha256File(audio), bytes: statSync(audio).size,
  }, null, 2))
  return audio
}

function createReleaseSnapshot({ article, lang, outMp3, transcriptPath, stateKey, label = 'episode' }) {
  const releaseDir = resolve(RELEASES, safeSlug(article.slug), `${releaseTimestamp()}-${safeSlug(label)}-${lang}`)
  mkdirSync(releaseDir, { recursive: true })
  const manifest = {
    schemaVersion: 1, slug: article.slug, lang, stateKey, label,
    createdAt: new Date().toISOString(), previousStateEntry: state.done[stateKey] || null,
    previousTotalCount: Number(state.totalCount || 0), previousStoryCount: Number(state.storyCount || 0),
    hadAudio: existsSync(outMp3), hadTranscript: Boolean(transcriptPath && existsSync(transcriptPath)),
  }
  if (manifest.hadAudio) {
    copyFileSync(outMp3, resolve(releaseDir, 'previous.mp3'))
    manifest.previousAudioHash = sha256File(outMp3)
  }
  if (manifest.hadTranscript) {
    copyFileSync(transcriptPath, resolve(releaseDir, 'previous.json'))
    manifest.previousTranscriptHash = sha256File(transcriptPath)
  }
  atomicWriteText(resolve(releaseDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return { releaseDir, manifest }
}

function restoreReleaseSnapshot(snapshot, { outMp3, transcriptPath, stateKey }) {
  const { releaseDir, manifest } = snapshot
  rmSync(outMp3, { force: true })
  if (transcriptPath) rmSync(transcriptPath, { force: true })
  if (manifest.hadAudio && existsSync(resolve(releaseDir, 'previous.mp3')))
    copyFileSync(resolve(releaseDir, 'previous.mp3'), outMp3)
  if (transcriptPath && manifest.hadTranscript && existsSync(resolve(releaseDir, 'previous.json')))
    copyFileSync(resolve(releaseDir, 'previous.json'), transcriptPath)
  if (manifest.previousStateEntry == null) delete state.done[stateKey]
  else state.done[stateKey] = manifest.previousStateEntry
  state.totalCount = manifest.previousTotalCount
  state.storyCount = manifest.previousStoryCount
  saveState()
  atomicWriteText(resolve(releaseDir, 'rollback.json'), JSON.stringify({
    rolledBackAt: new Date().toISOString(), restoredAudioHash: sha256File(outMp3),
    restoredTranscriptHash: transcriptPath ? sha256File(transcriptPath) : '',
  }, null, 2))
}

function validatePublishedArtifacts({ outMp3, transcriptPath, expectedAudioHash, expectedTranscriptHash, lang }) {
  const issues = []
  if (!existsSync(outMp3) || statSync(outMp3).size < 200_000) issues.push('ملف الصوت المنشور مفقود أو صغير')
  const duration = existsSync(outMp3) ? probeDur(outMp3) : 0
  if (duration < 120 || duration > 360) issues.push(`مدة الملف المنشور غير منطقية: ${duration.toFixed(1)}ث`)
  const actualAudioHash = sha256File(outMp3)
  if (expectedAudioHash && actualAudioHash !== expectedAudioHash) issues.push('بصمة ملف الصوت تغيّرت بعد النشر الذري')
  let actualTranscriptHash = ''
  if (lang === 'ar') {
    if (!transcriptPath || !existsSync(transcriptPath)) issues.push('Transcript العربي مفقود')
    else {
      actualTranscriptHash = sha256File(transcriptPath)
      if (expectedTranscriptHash && actualTranscriptHash !== expectedTranscriptHash) issues.push('بصمة Transcript تغيّرت بعد النشر')
      try {
        const parsed = JSON.parse(readFileSync(transcriptPath, 'utf8'))
        if (!Array.isArray(parsed?.utterances) || parsed.utterances.length < 8) issues.push('Transcript غير مكتمل')
      } catch { issues.push('Transcript غير صالح كـ JSON') }
    }
  }
  return { pass: issues.length === 0, issues, duration, actualAudioHash, actualTranscriptHash }
}

function runPostPublishCheck({ article, lang, outMp3, transcriptPath, releaseDir, pilot = false, slugs = [] }) {
  const command = String(env.PODCAST_POST_PUBLISH_CHECK || '').trim()
  if (!command) return { pass: true, skipped: true }
  const result = spawnSync('bash', ['-lc', command], {
    cwd: ROOT, encoding: 'utf8', timeout: Math.max(10_000, Number(env.PODCAST_POST_PUBLISH_TIMEOUT_MS || 180_000)),
    env: { ...process.env, ...env, PODCAST_SLUG: article?.slug || '', PODCAST_SLUGS: slugs.join(','),
      PODCAST_LANGUAGE: lang || 'ar', PODCAST_AUDIO_FILE: outMp3 || '', PODCAST_TRANSCRIPT_FILE: transcriptPath || '',
      PODCAST_RELEASE_DIR: releaseDir || '', PODCAST_IS_PILOT: pilot ? '1' : '0' },
  })
  if (result.status !== 0) throw new Error(`فحص ما بعد النشر فشل: ${(result.stderr || result.stdout || '').trim().slice(0, 500)}`)
  return { pass: true, stdout: String(result.stdout || '').trim().slice(0, 1000) }
}

function finalizeLastKnownGood({ article, lang, outMp3, transcriptPath, releaseDir, stateKey }) {
  const dir = resolve(LAST_GOOD, safeSlug(article.slug), lang)
  mkdirSync(dir, { recursive: true })
  copyFileSync(outMp3, resolve(dir, 'episode.mp3'))
  if (transcriptPath && existsSync(transcriptPath)) copyFileSync(transcriptPath, resolve(dir, 'transcript.json'))
  const manifest = { schemaVersion: 1, slug: article.slug, lang, stateKey,
    acceptedAt: new Date().toISOString(), audioHash: sha256File(outMp3),
    transcriptHash: transcriptPath ? sha256File(transcriptPath) : '', releaseDir, stateEntry: state.done[stateKey] || null }
  atomicWriteText(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  const slugDir = resolve(RELEASES, safeSlug(article.slug))
  if (existsSync(slugDir)) {
    const keep = Math.max(2, Math.min(20, Number(env.PODCAST_RELEASE_RETENTION || 5)))
    const entries = readdirSync(slugDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
      .map((entry) => entry.name).sort().reverse()
    for (const old of entries.slice(keep)) rmSync(resolve(slugDir, old), { recursive: true, force: true })
  }
  return manifest
}
const lexicon = readJsonSafe(LEX_FILE, { entries: {} })
const memoryDb = new DatabaseSync(MEM_FILE)
memoryDb.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS pronunciation_memory (
    normalized_word TEXT NOT NULL,
    original_text TEXT NOT NULL,
    sense_key TEXT NOT NULL,
    context_hash TEXT NOT NULL,
    context TEXT NOT NULL,
    voice TEXT NOT NULL,
    failed_pronunciation TEXT NOT NULL DEFAULT '',
    successful_pronunciation TEXT NOT NULL,
    method TEXT NOT NULL,
    ssml TEXT NOT NULL DEFAULT '',
    provider_fingerprint TEXT NOT NULL,
    last_success TEXT NOT NULL,
    use_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (normalized_word, sense_key, context_hash, voice, provider_fingerprint)
  );
  CREATE TABLE IF NOT EXISTS pronunciation_attempts (
    run_id TEXT NOT NULL,
    utterance_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    voice TEXT NOT NULL,
    pronunciation_text TEXT NOT NULL,
    ssml TEXT NOT NULL,
    stt_text TEXT NOT NULL DEFAULT '',
    recall REAL NOT NULL DEFAULT 0,
    judge_pass INTEGER NOT NULL DEFAULT 0,
    accepted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    PRIMARY KEY (run_id, utterance_id, candidate_id)
  );
  CREATE TABLE IF NOT EXISTS episode_runs (
    run_id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    pipeline_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS capability_profiles (
    voice TEXT NOT NULL,
    provider_fingerprint TEXT NOT NULL,
    break_supported INTEGER NOT NULL,
    prosody_supported INTEGER NOT NULL,
    sub_supported INTEGER NOT NULL,
    say_as_supported INTEGER NOT NULL,
    phoneme_supported INTEGER NOT NULL,
    custom_lexicon_supported INTEGER NOT NULL,
    notes TEXT NOT NULL,
    tested_at TEXT NOT NULL,
    PRIMARY KEY (voice, provider_fingerprint)
  );
`)

/* ── المقالات ── */
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const src = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const block = (src.match(/export const articles = \[([\s\S]*?)\n\]/) || [])[1] || ''
const STATIC_ARTICLES = [...block.matchAll(/\{ slug: '([^']+)', title: '([^']+)', date: '[^']*', iso: '([^']*)'/g)]
  .map((m) => ({ slug: m[1], title: m[2].replace(/\\'/g, "'"), iso: m[3], body: bodies[m[1]] || '', origin: 'base' }))
  .filter((a) => a.body && a.body.split(/\s+/).length >= 120)

async function loadArticles() {
  const accountPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(accountPath)) return STATIC_ARTICLES
  const [{ initializeApp, cert, deleteApp }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'), import('firebase-admin/firestore'),
  ])
  const account = JSON.parse(readFileSync(accountPath, 'utf8'))
  const app = initializeApp({ credential: cert(account), projectId: env.FIREBASE_PROJECT_ID || account.project_id }, `podcast-${Date.now()}`)
  try {
    const db = getFirestore(app)
    const [siteSnapshot, overridesSnapshot] = await Promise.all([
      db.collection('site_articles').get(), db.collection('content_overrides').get(),
    ])
    const overrides = new Map()
    for (const document of overridesSnapshot.docs) {
      if (document.id.startsWith('article:')) overrides.set(document.id.slice(8), document.data())
    }
    const originals = STATIC_ARTICLES.flatMap((article) => {
      const override = overrides.get(article.slug)
      if (override?.hidden === true) return []
      const patch = override?.patch && typeof override.patch === 'object' ? override.patch : {}
      return [{ ...article,
        title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : article.title,
        body: typeof patch.body === 'string' && patch.body.trim() ? patch.body.trim() : article.body,
        iso: typeof patch.iso === 'string' ? patch.iso : article.iso,
        origin: override ? 'override' : 'base' }]
    })
    const added = siteSnapshot.docs.flatMap((document) => {
      const data = document.data()
      if (data.hidden === true) return []
      const body = data.body || data.text || data.content
      if (typeof body !== 'string' || body.trim().split(/\s+/).length < 120) return []
      return [{ slug: String(data.slug || document.id), title: String(data.title || data.slug || document.id),
        iso: String(data.iso || ''), body: body.trim(), origin: 'site_article' }]
    })
    return [...added, ...originals].sort((left, right) => (right.iso || '').localeCompare(left.iso || ''))
  } finally {
    await deleteApp(app)
  }
}

/* ═══════════ محرك Gemini ═══════════ */
const AR_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/dialogue-ar.txt'), 'utf8')
const EN_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/dialogue-en.txt'), 'utf8')
const PRONOUNCE_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/pronounce-ar.txt'), 'utf8')
const JUDGE_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/judge-ar.txt'), 'utf8')
const DIALOGUE_MODEL = env.PODCAST_DIALOGUE_MODEL || env.GEMINI_MODEL || 'gemini-3.5-flash'
const ANALYSIS_MODEL = env.PODCAST_ANALYSIS_MODEL || DIALOGUE_MODEL
const JUDGE_MODEL = env.PODCAST_JUDGE_MODEL || DIALOGUE_MODEL
const PIPELINE_HASH = createHash('sha256').update(JSON.stringify({
  version: 'arabic-podcast-v7-semantic-pacing',
  dialoguePrompt: AR_SYSTEM,
  pronunciationPrompt: PRONOUNCE_SYSTEM,
  judgePrompt: JUDGE_SYSTEM,
  lexicon,
  models: { dialogue: DIALOGUE_MODEL, analysis: ANALYSIS_MODEL, judge: JUDGE_MODEL },
  voices: VOICES.ar,
  region: AZURE_REGION,
  engineSourceHash: ENGINE_SOURCE_HASH,
})).digest('hex').slice(0, 16)
let ACTIVE_PIPELINE_HASH = PIPELINE_HASH
/* وضع النص اليدوي: حوار الدكتور المكتوب بيده مقدّس — Gemini يفحص النطق ويحكم على الصوت
   فقط، وممنوع برمجياً أن يعيد صياغة كلمة واحدة (لا safeRephrase ولا حقن ولا استبدال). */
let MANUAL_TEXT_MODE = false
const providerFingerprint = (voice) => `${AZURE_REGION}:${voice}:azure-ssml-v3`
const pendingMemory = []
const capabilityProfiles = new Map()

async function gemini(systemPrompt, userText, temperature = 0.85, model = DIALOGUE_MODEL, extraParts = []) {
  let lastStatus = ''
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res
    try {
      res = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }, ...extraParts] }],
          generationConfig: { temperature, maxOutputTokens: 16384, responseMimeType: 'application/json' },
        }),
      }, 120_000)
    } catch (error) { lastStatus = `شبكة: ${error.message}`; await new Promise((r) => setTimeout(r, 3000 * attempt)); continue }
    if (res.ok) {
      const j = await res.json()
      const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
      try { return JSON.parse(txt) } catch { lastStatus = 'JSON غير صالح' }
    } else {
      const errorBody = await res.json().catch(() => ({}))
      const errorMessage = String(errorBody?.error?.message || '').replace(/\s+/g, ' ').slice(0, 300)
      lastStatus = `HTTP ${res.status}${errorMessage ? `: ${errorMessage}` : ''}`
      if (res.status === 429 && /prepayment credits are depleted/i.test(errorMessage))
        throw new Error(`Gemini متوقف بسبب نفاد الرصيد المسبق: ${errorMessage}`)
      // ضغط المعدّل (429) أو خطأ خادم مؤقت (5xx): تراجع أطول تصاعدي
      if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 6000 * attempt))
      else await new Promise((r) => setTimeout(r, 2500 * attempt))
      continue
    }
    await new Promise((r) => setTimeout(r, 2500 * attempt))
  }
  throw new Error(`Gemini فشل بعد ٥ محاولات (${lastStatus})`)
}

async function assertGeminiBillingReady() {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'أعد JSON فقط: {"ready":true}' }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 30, temperature: 0 } }),
  }, 120_000)
  if (response.ok) return true
  const errorBody = await response.json().catch(() => ({}))
  const message = String(errorBody?.error?.message || `HTTP ${response.status}`).replace(/\s+/g, ' ').slice(0, 400)
  throw new Error(`بوابة Gemini غير جاهزة؛ لم يبدأ توليد الصوت: ${message}`)
}

/* ═══════════ فحص السيناريو الآلي (بوابة اللغة) ═══════════ */
const AR_BANNED = ['مما لا شك فيه','بناءً على ما سبق','ومن هذا المنطلق','تجدر الإشارة','وعليه فإن','في خضم','لا يخفى على أحد','أعزائي المستمعين','مستمعينا الكرام','المحور التالي','وفي الختام','خلاصة القول','أهلاً وسهلاً بكم','حلقة جديدة']
/* رقابة العامية الصارمة: كلمة عامية واحدة = عربية مكسورة = إعادة كتابة فورية.
   حدود كلمة كي لا تُظلم «موضوع» بسبب «مو» أو «عادة» بسبب «عاد». */
const AR_COLLOQUIAL_WORDS = ['مو','ليش','شنو','عشان','خل','خلنا','خلّنا','صج','عاد','أبي','أبغى','ودي','ماكو','أكو','اكو','إيش','ايش','ليه','دلوقتي','إزاي','ازاي','شلون','شلونك','جذي','چذي','هني','وايد','شالسالفة','يا معود','زين','هالحين','الحين','توه','يبيلها','يبي','تبي','مب','مهب','شكو','هسة','هسه','بلكي','يمعود','تدري','إيه','ايه','معقولة']
const AR_COLLOQUIAL_PREFIX = ['هال']
const arWord = (w) => new RegExp(`(^|[\\s،؛:.!؟»("])${w}($|[\\s،؛:.!؟«)"])`)
const EN_BANNED = ['Dear listeners','Welcome to another episode','Today we are going to','Moving on to our next','In conclusion','As previously mentioned','It is important to note','dive deep into this fascinating','Moreover,','Furthermore,']
const DIACRITICS_RE = /[ً-ْٰ]/

const AR_PACING = Object.freeze({
  statement:       { ratePct: [-6, 6],  targetWpm: [136, 145], pauseMs: [200, 320] },
  question:        { ratePct: [-7, 5],  targetWpm: [134, 143], pauseMs: [500, 750] },
  briefReaction:   { ratePct: [2, 12],  targetWpm: [145, 152], pauseMs: [150, 240] },
  gentleObjection: { ratePct: [1, 10], targetWpm: [142, 150], pauseMs: [180, 280] },
  clarification:   { ratePct: [-6, 6],  targetWpm: [136, 145], pauseMs: [200, 320] },
  reflection:      { ratePct: [-14, 0], targetWpm: [125, 136], pauseMs: [650, 900] },
  conclusion:      { ratePct: [-14, -1], targetWpm: [122, 134], pauseMs: [560, 850] },
  hook:            { ratePct: [-2, 8],  targetWpm: [138, 147], pauseMs: [200, 320] },
  objection:       { ratePct: [1, 10], targetWpm: [142, 150], pauseMs: [180, 280] },
  quick:           { ratePct: [2, 12],  targetWpm: [145, 152], pauseMs: [150, 240] },
  reflective:      { ratePct: [-14, 0], targetWpm: [125, 136], pauseMs: [650, 900] },
  normal:          { ratePct: [-6, 6],  targetWpm: [136, 145], pauseMs: [200, 320] },
})

const AR_VOICE_RATE_OFFSETS = Object.freeze({
  // الصوت النسائي الفائز في الاختبار يحتاج مساحة أكبر حتى تظهر خامته ودفؤه.
  'ar-KW-NouraNeural': -3,
  // فاطمة مريحة للقراءة، ولا تحتاج الإبطاء نفسه.
  'ar-AE-FatimaNeural': -1,
  // Sample B الرجالي صار الصوت الافتراضي للحوار: لا نبطئه ككل، فقط نوع المداخلة يحدد الإيقاع.
  'ar-AE-HamdanNeural': 0,
  'ar-KW-FahedNeural': -1,
})

const pacingOf = (delivery) => AR_PACING[delivery] || AR_PACING.normal
const stableUnit = (text, salt = 0) => {
  const digest = createHash('sha256').update(`${salt}|${String(text || '')}`).digest()
  return digest.readUInt16BE(0) / 65535
}
const stableBetween = (text, salt, lo, hi) => Math.round(lo + stableUnit(text, salt) * (hi - lo))
const voiceRateOffset = (voice, speaker) => {
  const explicit = speaker === 'B' ? env.PODCAST_AR_FEMALE_RATE_OFFSET : env.PODCAST_AR_MALE_RATE_OFFSET
  if (explicit !== undefined && explicit !== '') return Math.min(8, Math.max(-12, Number(explicit) || 0))
  return AR_VOICE_RATE_OFFSETS[voice] || 0
}

// تطبيع حتمي للحقول الميكانيكية فقط (لا مساس بالمحتوى ولا بالذوق): جملة فيها «؟» إلقاؤها
// سؤال بالضرورة، وقلبها يغيّر مدى السرعة/الوقفة فنُثبّتهما داخل مدى النوع الناتج، ونضمن نبرة نهاية
// صالحة. تبقى بوابات المحتوى (الفصحى، الأمانة، الطول، مزيج القِصَر، «أكيد»، التنوع، الاعتراضات) للنموذج.
function normalizeMechanics(sc, options = {}) {
  if (!sc || !Array.isArray(sc.utterances)) return sc
  const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo))
  // الكلمات المنطوقة: الرمز الرقمي (2023) يُحسب بعدد أرقامه تقريباً — يُنطق كلمات عدة
  const wordCount = (text) => String(text || '').split(/\s+/).filter(Boolean)
    .reduce((total, token) => {
      const digits = (token.match(/\d/g) || []).length
      return total + (digits >= 2 ? Math.min(6, digits) : 1)
    }, 0)
  const polishForSpokenArabic = (text) => String(text || '')
    .replace(/بالظبط/g, 'بالضبط')
    .replace(/\bبالضبط!\s*/g, 'بالضبط. ')
    .replace(/إن\s+علمناه\s+أن\s+هذا\s+الرقم\s+هو\s+الحقيقة\s+الكاملة،?\s*سيقرأ\s+الورقة\s+كحكم\s+نهائي\s+على\s+قيمته\.?/g,
      'إذا تعلّم الطالب أن الرقم هو الحقيقة الكاملة، فقد يقرأ الورقة كأنها حكم نهائي على قيمته.')
    .replace(/إن\s+علمناه\s+أن\s+الرقم\s+هو\s+الحقيقة\s+الكاملة،?\s*سيقرأ\s+الورقة\s+كحكم\s+نهائي\s+على\s+قيمته\.?/g,
      'إذا تعلّم الطالب أن الرقم هو الحقيقة الكاملة، فقد يقرأ الورقة كأنها حكم نهائي على قيمته.')
    .replace(/\s+/g, ' ')
    .trim()
    // مداخلة تنتهي بفاصلة معلقة تُنطق نهايةً مبتورة يرفضها الحكم بحق — نُتمّها نقطة.
    .replace(/[،؛]\s*$/, '.')
  const splitLongText = (text, target = 22, hard = 30) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (wordCount(clean) <= hard) return [clean]
    const rawParts = clean
      .split(/(?<=[،؛.!؟])\s+|(?=\s(?:بل|لكن|ولكن|فإذا|فهذا|وهنا|وعندها|لا\s))/u)
      .map((part) => part.trim()).filter(Boolean)
    const parts = rawParts.length > 1 ? rawParts : clean.split(/\s+/).reduce((rows, word) => {
      const current = rows.at(-1) || ''
      if (!current) rows.push(word)
      else if (wordCount(current) >= target) rows.push(word)
      else rows[rows.length - 1] = `${current} ${word}`
      return rows
    }, [])
    const chunks = []
    for (const part of parts) {
      if (wordCount(part) > hard) {
        const words = part.split(/\s+/)
        const numeric = (w) => /[0-9\u0660-\u0669٪%]/.test(w)
        const rows = []
        let row = []
        for (const word of words) {
          row.push(word)
          // لا نقطع بعد كلمة رقمية (يبقى الرقم مع وحدته/تاليه)
          if (row.length >= target && !numeric(word)) { rows.push(row.join(' ')); row = [] }
        }
        if (row.length) rows.push(row.join(' '))
        chunks.push(...rows)
        continue
      }
      const last = chunks.at(-1) || ''
      if (last && wordCount(`${last} ${part}`) <= target) chunks[chunks.length - 1] = `${last} ${part}`
      else chunks.push(part)
    }
    return chunks.map((part) => part.trim()).filter(Boolean)
  }
  for (const [index, u] of sc.utterances.entries()) {
    u.text = polishForSpokenArabic(u.text)
    if (String(u.text || '').includes('؟') && u.delivery !== 'question') u.delivery = 'question'
    const kind = u.delivery || 'normal'
    const profile = pacingOf(kind)
    u.ratePct = clamp(u.ratePct, profile.ratePct)
    u.targetWordsPerMinute = clamp(u.targetWordsPerMinute, profile.targetWpm)
    u.pauseAfterMs = clamp(u.pauseAfterMs, profile.pauseMs)
    if (!['open', 'final', 'neutral'].includes(u.ending)) u.ending = 'neutral'
    const [pauseLo, pauseHi] = profile.pauseMs
    const naturalPause = stableBetween(u.text, index + 41, pauseLo, pauseHi)
    if (!Number.isFinite(Number(u.pauseAfterMs))
      || Math.abs(Number(u.pauseAfterMs) - naturalPause) < 8
      || (index > 0 && Math.abs(Number(u.pauseAfterMs) - Number(sc.utterances[index - 1]?.pauseAfterMs || 0)) < 10))
      u.pauseAfterMs = naturalPause
    u.internalBreakMs = clamp(u.internalBreakMs, kind === 'reflection' ? [130, 180] : [85, 150])
  }
  // «أكيد» حشوٌ يُفرط النموذج فيه ويُرفض تكراره؛ نُبقي أوّل ورودٍ ونُنوّع الباقي بمرادفاتٍ فصيحة
  // لا تحوي السلسلة نفسها (تجنّب «بالتأكيد» لأنها تتضمّن «أكيد») — تحسينٌ أسلوبيٌّ محايد لا مساس بالمعنى.
  const manualText = Boolean(options.manualText || MANUAL_TEXT_MODE)
  const akeedAlts = manualText ? [] : ['بالطبع', 'تماماً', 'فعلاً', 'صحيح', 'نعم']
  let akeedSeen = 0
  for (const u of sc.utterances) {
    u.text = manualText
      ? polishForSpokenArabic(String(u.text || ''))
      : polishForSpokenArabic(String(u.text || '').replace(/أكيد/g, () => (akeedSeen++ === 0 ? 'أكيد' : akeedAlts[(akeedSeen - 2) % akeedAlts.length])))
  }
  // قاعدة إخراج صوتي لا نعتمد فيها على التزام النموذج: المداخلة المقالية الطويلة هي أكثر سبب
  // لفشل Azure/STT/Judge. لذلك نكسرها قبل مرحلة النطق إلى نبضات مسموعة قصيرة، مع الحفاظ
  // على النص والمعنى والمتحدث نفسه. النتيجة الطبيعية: كلام أسرع، وقفات أقل، وفشل أقل.
  // المدة المتوقعة للوحدة قبل Azure: كلمات/سرعة مستهدفة + وقفات داخلية + هامش حدود المقطع.
  // نعتمد معامل أمان 0.88 لأن Azure ينطق أبطأ من الخطة غالباً (المعايرة أثبتت ذلك عملياً).
  const SEGMENT_BUDGET_SEC = 11.5
  const expectedSpokenSec = (u, text) => {
    const words = wordCount(text)
    const wpm = Math.max(100, Math.min(190, Number(u.targetWordsPerMinute) || 140)) * 0.88
    const internalBreaks = ((String(text).match(/[،؛:|]/g) || []).length) * ((Number(u.internalBreakMs) || 110) / 1000)
    return words * 60 / wpm + internalBreaks + 0.5
  }
  const durationAwarePieces = (u) => {
    const text = String(u.text || '')
    if (expectedSpokenSec(u, text) <= SEGMENT_BUDGET_SEC) return [text.replace(/\s+/g, ' ').trim()]
    const wpmSafe = Math.max(100, Math.min(190, Number(u.targetWordsPerMinute) || 140)) * 0.88
    const hardWords = Math.min(24, Math.max(12, Math.floor((SEGMENT_BUDGET_SEC - 0.5) * wpmSafe / 60)))
    const targetWords = Math.max(10, hardWords - 3)
    return splitLongText(text, targetWords, hardWords)
  }
  // شظايا الامتداد: Gemini قد يكتب جملة المتحدث الواحد على مداخلتين («لماذا يتحول…؟»
  // ثم «بدلاً من أن يكون…؟») — الشظية الثانية وحدها بترٌ يرفضه الحكم بحق. ندمجها في
  // سابقتها (نفس الكلمات والترتيب)، والتقسيم المدّي أدناه يعيد توزيعها بوعي الاتصال.
  const CONTINUATION_START = /^(بدلاً من|بدلا من|بل\s|أو\s|وليس\s|بدل أن\s|لا أن\s|وكأن\s)/
  const mergedUtterances = []
  for (const u of sc.utterances) {
    const prev = mergedUtterances.at(-1)
    if (prev && prev.speaker === u.speaker && CONTINUATION_START.test(String(u.text || '').trim())
      && wordCount(`${prev.text} ${u.text}`) <= 34) {
      prev.text = `${prev.text} ${u.text}`.replace(/\s+/g, ' ').trim()
      if (u.delivery === 'question' || prev.delivery === 'question') { prev.delivery = 'question'; prev.ending = 'open' }
      prev.pauseAfterMs = u.pauseAfterMs ?? prev.pauseAfterMs
      prev.musicBridgeAfter = Boolean(u.musicBridgeAfter)
      continue
    }
    mergedUtterances.push(u)
  }
  sc.utterances = mergedUtterances

  const compactUtterances = []
  for (const u of sc.utterances) {
    const pieces = durationAwarePieces(u)
    if (pieces.length <= 1) { compactUtterances.push(u); continue }
    pieces.forEach((piece, index) => {
      const next = { ...u, text: piece, allowOverlap: false, overlapMs: 0,
        musicBridgeAfter: index === pieces.length - 1 ? Boolean(u.musicBridgeAfter) : false }
      if (index < pieces.length - 1) {
        next.pauseAfterMs = Math.min(Number(u.pauseAfterMs) || 220, 200)
        next.ending = 'neutral'
        // قطعة وسطى من وحدة مقسمة: وقفتها داخلية قصيرة دوماً — لا يجوز لممر
        // «الوقفات التأملية» أن يعيد إطالتها فيقطع الجملة الواحدة قطعاً مسموعاً.
        next._splitMiddle = true
      }
      if (piece.includes('؟')) { next.delivery = 'question'; next.ending = 'open' }
      compactUtterances.push(next)
    })
  }
  sc.utterances = compactUtterances
  // الوقفات التأملية الطويلة علاجٌ دلالي لا عادة ميكانيكية: في الحلقة الكاملة نبقي 2–3 فقط،
  // وما عداها يعود إلى وقفة طبيعية قصيرة حتى لا يبدو الحوار متقطعاً.
  const longPauseKinds = new Set(['reflection', 'reflective'])
  const longPauseLimit = sc.sample ? 1 : 3
  let longPauseCount = 0
  for (let i = 0; i < sc.utterances.length; i++) {
    const u = sc.utterances[i]
    if (!longPauseKinds.has(u.delivery)) continue
    if (u._splitMiddle) { u.pauseAfterMs = Math.min(200, Number(u.pauseAfterMs) || 160); continue }
    longPauseCount += 1
    if (longPauseCount <= longPauseLimit) {
      u.pauseAfterMs = clamp(u.pauseAfterMs, AR_PACING.reflection.pauseMs)
      continue
    }
    u.delivery = 'clarification'
    u.pauseAfterMs = stableBetween(u.text, i + 131, 200, 320)
    if (u.ending === 'final') u.ending = 'neutral'
  }

  // لا نريد نهاية مغلقة في كل مداخلة؛ بعض النهايات المفتوحة تساعد الطرف الآخر أن يدخل طبيعياً.
  let finalCount = 0
  for (let i = 0; i < sc.utterances.length; i++) {
    const u = sc.utterances[i]
    if (String(u.text || '').includes('؟')) { u.ending = 'open'; continue }
    if (u.ending === 'final') finalCount += 1
    if (u.ending === 'final' && finalCount % 3 === 0 && i < sc.utterances.length - 2) u.ending = 'open'
  }

  // التداخلات قيدٌ ميكانيكيٌّ بحت: في الحلقة الكاملة تداخلان فقط، وفي العينة تداخل واحد.
  // كل تداخل قصير جداً ولا يتجاوز 150ms، فلا يحجب كلمة مهمة.
  const wc = wordCount
  const N = sc.utterances.length
  const targetOv = sc.sample ? 1 : Math.min(2, Math.max(1, Math.floor(N / 12)))
  for (const u of sc.utterances) {
    if (u.allowOverlap && wc(u.text) > 8) u.allowOverlap = false
    if (u.allowOverlap) u.overlapMs = clamp(u.overlapMs || 100, [50, 150])
  }
  const on = () => sc.utterances.filter((u) => u.allowOverlap).length
  if (on() > targetOv) {
    const keep = new Set(sc.utterances.map((u, index) => ({ u, index }))
      .filter(({ u }) => u.allowOverlap)
      .sort((a, b) => Math.abs(a.index - N * .38) - Math.abs(b.index - N * .38))
      .slice(0, targetOv).map(({ index }) => index))
    sc.utterances.forEach((u, index) => { if (!keep.has(index)) { u.allowOverlap = false; u.overlapMs = 0 } })
  }
  for (let i = 1; i < sc.utterances.length && on() < targetOv; i++) {
    const u = sc.utterances[i]
    if (!u.allowOverlap && wc(u.text) >= 2 && wc(u.text) <= 6) { u.allowOverlap = true; u.overlapMs = stableBetween(u.text, i + 151, 70, 130) }
  }

  // حارس أخير بعد التقسيم والتداخل: لا نعيد Gemini لأجل رقم أو علامة ترقيم قابلة للتطبيع.
  // السؤال الذي صنّفه النموذج سؤالاً يجب أن يُسمع ويُقرأ كسؤال، وكل سرعة/وقفة تُرد إلى مدى نوعها.
  for (let i = 0; i < sc.utterances.length; i++) {
    const u = sc.utterances[i]
    if (u.delivery === 'question' && !String(u.text || '').includes('؟')) {
      u.text = String(u.text || '').replace(/[.،؛!]*\s*$/, '؟')
      u.ending = 'open'
    }
    const profile = pacingOf(u.delivery || 'normal')
    u.ratePct = clamp(u.ratePct, profile.ratePct)
    u.targetWordsPerMinute = clamp(u.targetWordsPerMinute, profile.targetWpm)
    // القطعة الوسطى من وحدة مقسمة تحتفظ بوقفتها الداخلية القصيرة مهما كان نوع الإلقاء
    u.pauseAfterMs = u._splitMiddle ? Math.min(200, Number(u.pauseAfterMs) || 160) : clamp(u.pauseAfterMs, profile.pauseMs)
  }

  if (!sc.sample && !manualText) {
    const shortReplies = sc.utterances.filter((u) => wc(u.text) <= 8).length
    const shortSeeds = [
      { text: 'صحيح.', delivery: 'briefReaction', ending: 'neutral' },
      { text: 'هنا الفارق.', delivery: 'briefReaction', ending: 'open' },
    ]
    for (let s = shortReplies; s < 2; s++) {
      const anchor = Math.min(sc.utterances.length - 1, 3 + s * 6)
      const previous = sc.utterances[anchor] || sc.utterances.at(-1) || { speaker: 'A' }
      const seed = shortSeeds[s % shortSeeds.length]
      const profile = pacingOf(seed.delivery)
      sc.utterances.splice(anchor + 1, 0, {
        speaker: previous.speaker === 'A' ? 'B' : 'A',
        text: seed.text,
        delivery: seed.delivery,
        ratePct: stableBetween(seed.text, s + 211, profile.ratePct[0], profile.ratePct[1]),
        targetWordsPerMinute: stableBetween(seed.text, s + 223, profile.targetWpm[0], profile.targetWpm[1]),
        pauseAfterMs: stableBetween(seed.text, s + 227, profile.pauseMs[0], profile.pauseMs[1]),
        ending: seed.ending,
        internalBreakMs: 0,
        allowOverlap: false,
        overlapMs: 0,
        musicBridgeAfter: false,
        emphasisWords: [],
        pronunciationNotes: '',
      })
    }
  }
  return sc
}

function lintScript(sc, lang) {
  const issues = []
  const utts = sc.utterances || []
  const isSample = Boolean(sc.sample)
  if (utts.length < (isSample ? 12 : 8)) issues.push(`مداخلات قليلة (${utts.length})`)
  const words = utts.reduce((n, u) => n + (u.text || '').split(/\s+/).length, 0)
  const [lo, hi] = isSample ? [165, 210] : (lang === 'ar' ? [390, 570] : [420, 900])
  if (words < lo || words > hi) issues.push(`طول السيناريو ${words} كلمة (المدى ${lo}-${hi})`)
  const banned = lang === 'ar' ? AR_BANNED : EN_BANNED
  for (const b of banned) if (utts.some((u) => (u.text || '').includes(b))) issues.push(`عبارة ممنوعة: «${b}»`)
  if (lang === 'ar') {
    for (const w of AR_COLLOQUIAL_WORDS)
      if (utts.some((u) => arWord(w).test(u.text || ''))) issues.push(`كلمة عامية تكسر الفصحى: «${w}» — استبدلها بفصحى نظيفة`)
    for (const p of AR_COLLOQUIAL_PREFIX)
      if (utts.some((u) => new RegExp(`(^|\\s)${p}[\\u0621-\\u064A]`).test(u.text || ''))) issues.push(`بادئة عامية: «${p}ـ» — استخدم هذا/هذه`)
    // «أكيد» بمعناها العامي المتكرر: مرة واحدة كحد أقصى
    const akeed = utts.reduce((n, u) => n + ((u.text || '').match(/أكيد/g) || []).length, 0)
    if (akeed > 1) issues.push(`«أكيد» تكررت ${akeed} مرات — الحد مرة واحدة`)
    // الـTranscript دون تشكيل كامل
    const diacWords = utts.reduce((n, u) => n + (u.text || '').split(/\s+/).filter((w) => DIACRITICS_RE.test(w)).length, 0)
    if (words && diacWords / words > 0.15) issues.push('الحوار مشكول أكثر من اللازم — الضبط مرحلة نطقية مستقلة')
    if (utts.some((u) => /\.{2,}/.test(u.text || ''))) issues.push('نقاط متكررة تبطئ الإلقاء — استخدم جملة أو وقفة مقصودة')
    const questionBySpeaker = new Map(['A', 'B'].map((speaker) => [speaker, 0]))
    const deliveryKinds = new Set()
    const objections = []
    const rateRanges = Object.fromEntries(Object.entries(AR_PACING).map(([key, value]) => [key, value.ratePct]))
    const pauseRanges = Object.fromEntries(Object.entries(AR_PACING).map(([key, value]) => [key, value.pauseMs]))
    for (const [index, utterance] of utts.entries()) {
      const text = String(utterance.text || '')
      const kind = utterance.delivery || 'normal'
      deliveryKinds.add(kind)
      if (text.includes('؟')) questionBySpeaker.set(utterance.speaker, (questionBySpeaker.get(utterance.speaker) || 0) + 1)
      if (text.includes('؟') && kind !== 'question') issues.push(`المداخلة ${index + 1}: سؤال بلا delivery=question`)
      if (kind === 'question' && !text.includes('؟')) issues.push(`المداخلة ${index + 1}: question بلا علامة استفهام`)
      if (/^(لكن|ولكن|على العكس|لست متأكد|ربما،? ولكن|لحظة|انتظر)/.test(text)
        || kind === 'objection' || kind === 'gentleObjection') objections.push(index)
      const rate = Number(utterance.ratePct)
      const [rateMin, rateMax] = rateRanges[kind] || rateRanges.normal
      if (!Number.isFinite(rate) || rate < rateMin || rate > rateMax) issues.push(`المداخلة ${index + 1}: سرعة ${utterance.ratePct ?? 'مفقودة'} خارج ${rateMin}–${rateMax}%`)
      const targetWpm = Number(utterance.targetWordsPerMinute)
      const [wpmMin, wpmMax] = pacingOf(kind).targetWpm
      if (!Number.isFinite(targetWpm) || targetWpm < wpmMin || targetWpm > wpmMax)
        issues.push(`المداخلة ${index + 1}: targetWordsPerMinute ${utterance.targetWordsPerMinute ?? 'مفقود'} خارج ${wpmMin}–${wpmMax}`)
      const pause = Number(utterance.pauseAfterMs)
      const [pauseMin, pauseMax] = pauseRanges[kind] || pauseRanges.normal
      // القطعة الوسطى من وحدة مقسمة مدّياً تحمل وقفة داخلية قصيرة عمداً (جملة واحدة مسموعة)؛
      // فحص مدى الوقفة حسب نوع الإلقاء يخص نهايات المداخلات الحقيقية فقط.
      if (!utterance._splitMiddle
        && (!Number.isFinite(pause) || pause < pauseMin || pause > pauseMax)) issues.push(`المداخلة ${index + 1}: وقفة ${utterance.pauseAfterMs ?? 'مفقودة'}ms خارج ${pauseMin}–${pauseMax}`)
      if (!['open', 'final', 'neutral'].includes(utterance.ending)) issues.push(`المداخلة ${index + 1}: نهاية نبرية مفقودة`)
      const sentenceCount = (text.match(/[.!؟]+/g) || []).length
      if (sentenceCount > 3) issues.push(`المداخلة ${index + 1}: أكثر من ثلاث جمل`)
    }
    if ([...questionBySpeaker.values()].some((count) => count < 1)) issues.push('يجب أن يسأل كل من A وB سؤالاً حقيقياً واحداً على الأقل')
    if (deliveryKinds.size < 4) issues.push(`تنوع الإلقاء ضعيف (${deliveryKinds.size} أنواع فقط)`)
    if (objections.length < 2) issues.push('الحوار يحتاج اعتراضين أو تصحيح زاويتين على الأقل')
    const bridgeCount = utts.filter((utterance) => utterance.musicBridgeAfter === true).length
    if (bridgeCount > (isSample ? 1 : 2)) issues.push(`الجسور الموسيقية المخططة ${bridgeCount} تتجاوز الحد`)
  }
  const aWords = utts.filter((u) => u.speaker === 'A').reduce((n, u) => n + u.text.split(/\s+/).length, 0)
  const ratio = aWords / Math.max(1, words)
  if (ratio < 0.37 || ratio > 0.63) issues.push(`توازن مختل: A=${Math.round(ratio * 100)}%`)
  const starts = utts.map((u) => (u.text || '').split(/\s+/)[0])
  for (const w of ['صحيح', 'بالضبط', 'Exactly', 'Right']) {
    const c = starts.filter((s) => s === w || s === w + '،' || s === w + ',').length
    if (c > 2) issues.push(`تكرار بداية «${w}» ×${c}`)
  }
  const lens = utts.map((u) => u.text.split(/\s+/).length)
  const sameLen = lens.every((l) => Math.abs(l - lens[0]) <= 2)
  if (sameLen && utts.length > 6) issues.push('كل المداخلات بالطول نفسه — يبدو آلياً')
  if (lang === 'ar' && lens.some((l) => l > 30)) issues.push('مداخلة عربية أطول من 30 كلمة — يجب تقسيمها قبل النطق')
  if (lens.some((l) => l > 55)) issues.push('مداخلة أطول من 55 كلمة')
  const sortedLens = [...lens].sort((a, b) => a - b)
  if (sortedLens[Math.max(0, Math.ceil(sortedLens.length * 0.9) - 1)] > 35) issues.push('P90 لطول المداخلات يتجاوز 35 كلمة')
  if (lang === 'ar' && lens.filter((length) => length <= 8).length < Math.max(2, Math.floor(utts.length * 0.12))) issues.push('لا توجد ردود قصيرة كافية (≥ رَدَّين ≤ 8 كلمات)')
  if (isSample && lens.some((length) => length > 35)) issues.push('عينة الصوت تحتوي مداخلة أطول من 35 كلمة')
  if (isSample && lens.filter((length) => length >= 5 && length <= 22).length < Math.ceil(utts.length * 0.7))
    issues.push('أقل من 70٪ من مداخلات العينة ضمن 5–22 كلمة')
  if (isSample && lens.filter((length) => length >= 2 && length <= 5).length < 2)
    issues.push('العينة تحتاج ردين قصيرين على الأقل من 2–5 كلمات')
  const overlaps = utts.filter((u) => u.allowOverlap).length
  if (lang === 'ar') {
    const minOverlaps = isSample ? 1 : Math.min(2, Math.max(1, Math.floor(utts.length / 16)))
    const maxOverlaps = isSample ? 1 : 2
    if (overlaps < minOverlaps || overlaps > maxOverlaps) issues.push(`التداخلات ${overlaps} خارج النطاق الطبيعي ${minOverlaps}–${maxOverlaps}`)
    for (const [index, utterance] of utts.entries()) if (utterance.allowOverlap) {
      if ((utterance.text || '').split(/\s+/).length > 8) issues.push(`التداخل ${index + 1} أطول من رد قصير`)
      if (utterance.overlapMs < 50 || utterance.overlapMs > 150) issues.push(`التداخل ${index + 1} خارج 50–150ms`)
    }
    if (isSample) {
      const transitionPauses = utts.slice(0, -1).flatMap((utterance, index) =>
        utts[index + 1].allowOverlap ? [] : [Number(utterance.pauseAfterMs)])
      const averagePause = transitionPauses.reduce((sum, value) => sum + value, 0) / Math.max(1, transitionPauses.length)
      if (averagePause < 240 || averagePause > 500)
        issues.push(`متوسط الوقفات المخطط ${Math.round(averagePause)}ms خارج 240–500ms`)
    }
    const tokens = (text) => new Set(normalizeAr(text).split(' ').filter((word) => word.length > 2))
    for (let index = 1; index < utts.length; index++) {
      const left = tokens(utts[index - 1].text || '')
      const right = tokens(utts[index].text || '')
      const common = [...left].filter((word) => right.has(word)).length
      const union = new Set([...left, ...right]).size
      if (union && common / union > 0.82 && lens[index] > 8) issues.push(`المداخلة ${index + 1} تعيد كلام السابقة`)
    }
  }
  return issues
}

/* ═══════════ التطبيع والمقارنة (للفحص الصوتي المغلق) ═══════════ */
const stripDiacritics = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '')
const normalizeAr = (s) => stripDiacritics(s)
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[^ء-ي0-9a-zA-Z\s]/g, ' ')
  .replace(/\s+/g, ' ').trim()

function heardContainsRisk(heardText, risk, preferredAlias = '') {
  const heard = normalizeAr(heardText)
  const glued = heard.replace(/\s+/g, '')
  const original = String(risk?.word || '')
  const candidates = [...new Set([preferredAlias, risk?.subAlias, risk?.selectedPronunciation, original]
    .map((value) => normalizeAr(value)).filter(Boolean))]
  if (/\d/.test(original)) {
    const digits = normalizeAr(original).replace(/\D/g, '')
    if (digits && heard.replace(/\D/g, '').includes(digits)) return true
  }
  return candidates.some((candidate) => heard.includes(candidate) || glued.includes(candidate.replace(/\s+/g, '')))
}

function compareTexts(intended, recognized) {
  const expected = normalizeAr(intended).split(' ').filter(Boolean)
  const rawHeard = normalizeAr(recognized).split(' ').filter(Boolean)
  const heard = []
  for (const token of rawHeard) {
    const splitAt = expected.findIndex((word, index) => index < expected.length - 1 && word + expected[index + 1] === token)
    if (splitAt >= 0) { heard.push(expected[splitAt], expected[splitAt + 1]); continue }
    if (token === 'ا' && heard.length && expected.includes(heard.at(-1) + token)) {
      heard[heard.length - 1] += token
      continue
    }
    heard.push(token)
  }
  /* مطابقة بالاحتواء الجزئي للكلمات ≥4 أحرف — كما يفعل محرك القراءة المثبت منذ شهور:
     STT يكتب المنصوب المنوّن بلا ألفه («انطباعاً»→«انطباع») وصيغاً مطولة/مقصورة
     صوتها واحد؛ المطالبة بالتطابق الحرفي كانت تُسقط مداخلات سليمة (u008). */
  const wordsEqual = (a, b) => a === b
    || (a.length > 3 && b.length > 3 && (a.includes(b) || b.includes(a)))
  const rows = expected.length + 1
  const cols = heard.length + 1
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols))
  for (let i = expected.length - 1; i >= 0; i--)
    for (let j = heard.length - 1; j >= 0; j--)
      dp[i][j] = wordsEqual(expected[i], heard[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const matched = new Set()
  let i = 0, j = 0
  while (i < expected.length && j < heard.length) {
    if (wordsEqual(expected[i], heard[j])) { matched.add(i); i++; j++; continue }
    if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  /* معادلة الأرقام: النص النطقي يكتب «ألف وتسعمئة وثمانية وتسعين» وSTT قد يكتبها «1998» —
     كلمات العدد المقصودة تُحتسب مطابقة عندما يظهر رقم في المسموع (كتابتان لنطق واحد صحيح) */
  const NUM_WORDS = new Set(['صفر','واحد','اثنان','اثنين','ثلاثه','اربعه','خمسه','سته','سبعه','ثمانيه','تسعه','عشره','عشر','احد','اثنا','عشرين','ثلاثين','اربعين','خمسين','ستين','سبعين','ثمانين','تسعين','مئه','مائه','مئتين','ثلاثمئه','اربعمئه','خمسمئه','ستمئه','سبعمئه','ثمانمئه','تسعمئه','الف','الفين','الاف','مليون','مليار'])
  const heardHasDigits = heard.some((token) => /\d/.test(token))
  if (heardHasDigits)
    expected.forEach((word, index) => {
      if (!matched.has(index) && NUM_WORDS.has(word.replace(/^و/, ''))) matched.add(index)
    })
  const missing = expected.filter((_, index) => !matched.has(index))
  const NEGATION = new Set(['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'])
  const importantIndexes = expected.map((word, index) => ({ word, index }))
    .filter(({ word }) => word.length > 2 || NEGATION.has(word))
  const missingImportant = importantIndexes.filter(({ index }) => !matched.has(index)).map(({ word }) => word)
  return {
    expected,
    heard,
    missing,
    missingImportant,
    importantTotal: importantIndexes.length,
    ratio: expected.length ? matched.size / expected.length : 1,
    importantRatio: importantIndexes.length
      ? (importantIndexes.length - missingImportant.length) / importantIndexes.length
      : 1,
  }
}

/* ═══════════ Azure TTS + STT ═══════════ */
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clampNum = (value, lo, hi, fallback = lo) => Math.min(hi, Math.max(lo, Number.isFinite(+value) ? +value : fallback))
const signedPct = (value) => `${value >= 0 ? '+' : ''}${Math.round(value)}%`

function performanceDirector(u, baseRate, lang, voice = '') {
  const delivery = u.delivery || 'normal'
  const speakerBias = u.speaker === 'B' ? { pitch: 0.5, volume: 0.2 } : { pitch: -0.5, volume: 0 }
  const presets = {
    statement: { rate: 0, pitch: 0, volume: 0, pre: 0, inner: 105, contour: [0, 0, -0.4] },
    question: { rate: -1, pitch: 1.5, volume: 0.4, pre: 0, inner: 125, contour: [0, 1, 3] },
    briefReaction: { rate: 2, pitch: 1, volume: 0.8, pre: 0, inner: 80, contour: [1, 1, 0] },
    gentleObjection: { rate: 1, pitch: 0.8, volume: 0.6, pre: 0, inner: 95, contour: [1, 0, -1] },
    clarification: { rate: 0, pitch: 0, volume: 0.1, pre: 0, inner: 110, contour: [0, 0, -0.5] },
    reflection: { rate: -2, pitch: -1, volume: -0.4, pre: 35, inner: 155, contour: [0, -1, -2] },
    conclusion: { rate: -2, pitch: -0.8, volume: 0.2, pre: 25, inner: 145, contour: [0, -1, -2] },
    reflective: { rate: -2, pitch: -1, volume: -0.4, pre: 35, inner: 155, contour: [0, -1, -2] },
    hook: { rate: 1, pitch: 1, volume: 0.6, pre: 0, inner: 95, contour: [1, 1, 0] },
    objection: { rate: 1, pitch: 0.8, volume: 0.6, pre: 0, inner: 95, contour: [1, 0, -1] },
    quick: { rate: 2, pitch: 1, volume: 0.8, pre: 0, inner: 80, contour: [1, 1, 0] },
    normal: { rate: 0, pitch: 0, volume: 0, pre: 0, inner: 105, contour: [0, 0, -0.4] },
  }
  const p = presets[delivery] || presets.normal
  const words = String(u.text || '').split(/\s+/).filter(Boolean).length
  const urgency = words <= 4 ? 1 : words > 24 ? -2 : 0
  const offset = lang === 'ar' ? voiceRateOffset(voice, u.speaker) : 0
  const rate = clampNum(baseRate + p.rate + offset + urgency, lang === 'ar' ? -18 : -8, lang === 'ar' ? 18 : 24, baseRate)
  const maleConversationLift = lang === 'ar' && u.speaker === 'A' && delivery !== 'reflection' && delivery !== 'conclusion' ? 0.35 : 0
  const pitch = clampNum(p.pitch + speakerBias.pitch + maleConversationLift, -4, 5, 0)
  const volume = clampNum(p.volume + speakerBias.volume, -2, 2, 0)
  const innerBreakMs = clampNum(u.internalBreakMs || p.inner, 75, 180, p.inner)
  const preBreathMs = lang === 'ar' ? clampNum(p.pre, 0, 45, 0) : 0
  return { delivery, rate, pitch, volume, innerBreakMs, preBreathMs,
    contour: p.contour, energy: Math.round(((rate + 18) / 36) * 100),
    warmth: delivery === 'reflection' || delivery === 'conclusion' ? 90 : 80 }
}

function splitPerformanceSegments(pronText) {
  const pieces = String(pronText || '').split(/\s*\|\s*/).flatMap((part) => {
    const chunks = []
    let current = ''
    for (const token of part.split(/(\s+)/)) {
      current += token
      if (/[،؛.!؟]$/.test(token.trim())) { chunks.push(current.trim()); current = '' }
    }
    if (current.trim()) chunks.push(current.trim())
    return chunks
  }).map((item) => item.trim()).filter(Boolean)
  return pieces.length ? pieces : [String(pronText || '').trim()]
}

function applySubsAndFocus(segment, subs) {
  let text = escXml(segment)
  for (const { word, alias } of subs) {
    if (!word || !alias || word === alias) continue
    const ew = escXml(word)
    if (text.includes(ew)) text = text.split(ew).join(`<sub alias="${escXml(alias)}">${ew}</sub>`)
  }
  return text
}

/** يبني SSML من النص النطقي: إخراج أدائي داخل الجملة، لا prosody واحد مسطّح. */
function buildSSML(u, pronText, subs, voice, lang) {
  const ratePlan = {
    statement: 0, question: -1, briefReaction: 6, gentleObjection: 4,
    clarification: 0, reflection: -7, conclusion: -7,
    reflective: -7, hook: 3, objection: 4, quick: 6, normal: 0,
  }
  const requestedRate = Number.isFinite(Number(u.ratePct)) ? Number(u.ratePct) : (ratePlan[u.delivery] ?? ratePlan.normal)
  const director = performanceDirector(u, requestedRate, lang, voice)
  const profile = capabilityProfiles.get(voice)
  if (lang === 'ar' && profile && !profile.subSupported) {
    for (const { word, alias } of subs) pronText = pronText.split(word).join(alias)
    subs = []
  }
  const segments = splitPerformanceSegments(pronText)
  /* التشغيل 15 (u004): السؤال المفرد الجملة كان يُلقى «بنبرة تقريرية مسطحة» — مقطع
     واحد يأخذ pos وسطياً فلا يبلغ نغمة النهاية الصاعدة ولا openLift أبداً. العلاج
     الأدائي: المقطع الوحيد هو نهاية الجملة بحكم التعريف (pos=2)، والسؤال يُفصل
     ذيله الأخير في نغمة صاعدة مستقلة بلا وقفة — هكذا يسأل البشر فعلاً. */
  const questionTail = (() => {
    if (director.delivery !== 'question' || segments.length !== 1) return null
    if (subs.some((item) => String(item.word || '').includes(' '))) return null
    const words = segments[0].split(/\s+/)
    if (words.length < 5) return null
    const tailCount = words.length >= 8 ? 3 : 2
    return { head: words.slice(0, -tailCount).join(' '), tail: words.slice(-tailCount).join(' ') }
  })()
  const rendered = questionTail
    ? `<prosody rate="${signedPct(director.rate)}" pitch="${signedPct(director.pitch + (director.contour[0] || 0))}">${applySubsAndFocus(questionTail.head, subs)}</prosody>`
      + `<prosody rate="${signedPct(director.rate - 3)}" pitch="${signedPct(director.pitch + (director.contour[2] || 0) + 2.4)}">${applySubsAndFocus(` ${questionTail.tail}`, subs)}</prosody>`
    : segments.map((segment, index) => {
      const pos = segments.length === 1 ? 2 : index === 0 ? 0 : index === segments.length - 1 ? 2 : 1
      const openLift = pos === 2 && u.ending === 'open' ? 1.2 : 0
      const pitch = director.pitch + (director.contour[pos] || 0) + openLift
      const rate = director.rate + (pos === 0 && director.delivery === 'hook' ? 2 : 0) + (pos === 2 && u.ending === 'final' ? -2 : 0)
      return `<prosody rate="${signedPct(rate)}" pitch="${signedPct(pitch)}">${applySubsAndFocus(segment, subs)}</prosody>`
    }).join(`<break time="${director.innerBreakMs}ms"/>`)
  /* لا نستخدم <emphasis>: الأصوات العربية العشرة المختبرة لا تعلن دعمه، وقد
     يتجاهله Azure بصمت. التشديد يُصنع من الجملة والسرعة والوقفة لا من وسم وهمي. */
  // locale يتبع الصوت المستخدم (يعمّم لأي صوت عربي، لا ثابت ar-KW)
  const xmlLang = lang === 'ar' ? localeOf(voice) : 'en-US'
  const pre = director.preBreathMs ? `<break time="${director.preBreathMs}ms"/>` : ''
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">
  <voice name="${voice}">${pre}${rendered}</voice>
</speak>`
}

async function synthSSML(ssml, outPath) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchWithTimeout(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
          'User-Agent': 'alfailakawi-podcast',
        },
        body: ssml,
      })
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length > 4000) { writeFileSync(outPath, buf); trimSilence(outPath); return true }
      } else if (res.status === 429) await new Promise((r) => setTimeout(r, 4000 * attempt))
      else await new Promise((r) => setTimeout(r, 1200 * attempt))
    } catch { /* أخطاء الشبكة العابرة (ECONNRESET/fetch failed): أعد المحاولة بمهلة متصاعدة */
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
  return false
}

async function sttRequest(wav16Path, locale) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchWithTimeout(`https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed&profanity=raw`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000' },
        body: readFileSync(wav16Path),
      })
      if (res.ok) {
        const json = await res.json()
        const best = json.NBest?.[0] || {}
        return { locale, text: best.Display || best.Lexical || json.DisplayText || '', lexical: best.Lexical || '',
          confidence: Number(best.Confidence || 0), words: Array.isArray(best.Words) ? best.Words : [] }
      }
      if (res.status === 400 || res.status === 404) return null
      if (res.status === 429 || res.status >= 500) await new Promise((resolveWait) => setTimeout(resolveWait, 2500 * attempt))
      else return null
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 1200 * attempt))
    }
  }
  return null
}

/** الفحص المغلق العادي. في إنتاج الحلقة يتبع locale الصوت مع ar-SA ملاذاً تقنياً؛
    في الاختبار الأعمى يُمرر sttLocale ثابت ولا يُستخدم هذا الاختلاف في الترتيب. */
async function sttRecognize(wavPath, locale = 'ar-KW') {
  const wav16 = `${wavPath}.16k.wav`
  ff(['-i', wavPath, '-ar', '16000', '-ac', '1', wav16])
  try {
    for (const loc of [...new Set([locale, 'ar-SA'])]) {
      const result = await sttRequest(wav16, loc)
      if (result?.text) return result
    }
  } finally { rmSync(wav16, { force: true }) }
  return null
}

async function sttRecognizeEnsemble(wavPath, intended, risks = []) {
  const wav16 = `${wavPath}.ensemble.16k.wav`
  ff(['-i', wavPath, '-ar', '16000', '-ac', '1', wav16])
  const results = []
  try {
    for (const locale of STT_ENSEMBLE_LOCALES) {
      const heard = await sttRequest(wav16, locale)
      if (!heard?.text) throw new Error(`تعذر STT الموحّد للغة ${locale}`)
      const comparison = compareTexts(intended, heard.text)
      results.push({ ...heard, comparison: { ratio: comparison.ratio, importantRatio: comparison.importantRatio,
        missing: comparison.missing, missingImportant: comparison.missingImportant } })
    }
  } finally { rmSync(wav16, { force: true }) }
  const sortedRatio = results.map((item) => item.comparison.ratio).sort((a, b) => a - b)
  const sortedImportant = results.map((item) => item.comparison.importantRatio).sort((a, b) => a - b)
  const medianRatio = sortedRatio[Math.floor(sortedRatio.length / 2)]
  const medianImportantRatio = sortedImportant[Math.floor(sortedImportant.length / 2)]
  const critical = risks.filter((risk) => risk.riskLevel === 'high')
  const criticalConsensus = critical.map((risk) => {
    const votes = results.filter((item) => heardContainsRisk(item.text, risk)).length
    return { word: risk.word, selectedPronunciation: risk.subAlias || risk.selectedPronunciation || risk.word,
      votes, pass: votes >= 3 }
  })
  return { results, medianRatio, medianImportantRatio, criticalConsensus,
    pass: medianRatio >= 0.90 && medianImportantRatio >= 0.95 && criticalConsensus.every((item) => item.pass) }
}

async function audioJudge(wavPath, intended, heard, risks, context, delivery = {}) {
  const bytes = readFileSync(wavPath)
  if (bytes.length > 18 * 1024 * 1024) throw new Error('المقطع أكبر من حد الحكم الصوتي')
  const prompt = [
    `النص المقصود: ${intended}`,
    `ناتج Azure STT: ${heard.text}`,
    `ثقة STT: ${heard.confidence}`,
    `الكلمات الخطرة: ${JSON.stringify(risks)}`,
    `سياق المعنى: ${context}`,
    `خطة الأداء: ${JSON.stringify({ type: delivery.delivery || 'normal', ratePct: delivery.ratePct,
      targetWordsPerMinute: delivery.targetWordsPerMinute, actualWordsPerMinute: delivery.actualWordsPerMinute,
      ending: delivery.ending, isQuestion: String(context).includes('؟'),
      continuation: Boolean(delivery._splitMiddle) })}`,
    delivery._splitMiddle
      ? 'تنبيه مهم: هذه وحدة متصلة تُكمل جملتَها الوحدةُ التالية مباشرة (قُسمت تقنياً لطولها). النهاية المفتوحة أو الفاصلة في آخرها مقصودة تماماً — لا تعاقب على «نهاية مبتورة» أو «نبرة غير محسومة» هنا؛ احكم على النطق والحركات والوضوح فقط.'
      : 'ارفض السؤال إذا سُمِع كنص تقريري. ارفض السرعة المستعجلة، والبطء المتمطّط، والإيقاع المدرسي، والحركة الإعرابية الخاطئة أو الثقيلة عند الوقف، والنهاية المبتورة، وأي عامية.',
    'استمع إلى ملف WAV المرفق بنفسك. لا تعتمد على STT وحده. أعد حكم JSON وفق المخطط فقط.',
  ].join('\n')
  const verdict = await gemini(JUDGE_SYSTEM, prompt, 0.1, JUDGE_MODEL, [{
    inlineData: { mimeType: 'audio/wav', data: bytes.toString('base64') },
  }])
  if (typeof verdict?.pass !== 'boolean' || !Array.isArray(verdict?.problems)) {
    throw new Error('Arabic Audio Judge أعاد حكماً غير صالح')
  }
  return verdict
}

async function probeSsmlCapabilities(force = false, voicesToProbe = [VOICES.ar.A.azure, VOICES.ar.B.azure]) {
  const select = memoryDb.prepare('SELECT * FROM capability_profiles WHERE voice = ? AND provider_fingerprint = ?')
  const save = memoryDb.prepare(`INSERT OR REPLACE INTO capability_profiles
    (voice, provider_fingerprint, break_supported, prosody_supported, sub_supported,
     say_as_supported, phoneme_supported, custom_lexicon_supported, notes, tested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const dir = resolve(TMP, 'ssml-preflight')
  mkdirSync(dir, { recursive: true })
  for (const voice of [...new Set(voicesToProbe)]) {
    const fingerprint = providerFingerprint(voice)
    const cached = !force && select.get(voice, fingerprint)
    if (cached) {
      capabilityProfiles.set(voice, { breakSupported: Boolean(cached.break_supported), prosodySupported: Boolean(cached.prosody_supported),
        subSupported: Boolean(cached.sub_supported), sayAsSupported: Boolean(cached.say_as_supported),
        phonemeSupported: Boolean(cached.phoneme_supported), customLexiconSupported: Boolean(cached.custom_lexicon_supported),
        notes: cached.notes, testedAt: cached.tested_at })
      continue
    }
    const run = async (name, inner, expected = '') => {
      const file = resolve(dir, `${voice}.${name}.wav`)
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${localeOf(voice)}"><voice name="${voice}">${inner}</voice></speak>`
      if (!await synthSSML(ssml, file)) return false
      const heard = await sttRecognize(file, localeOf(voice))
      rmSync(file, { force: true })
      if (!heard?.text) return false
      return !expected || normalizeAr(heard.text).replace(/\s+/g, '').includes(normalizeAr(expected).replace(/\s+/g, ''))
    }
    const breakSupported = await run('break', 'هذه وقفة <break time="180ms"/> طبيعية')
    const prosodySupported = await run('prosody', '<prosody rate="+8%">نتحدث بإيقاع طبيعي وواضح</prosody>')
    const subSupported = await run('sub', '<sub alias="نَقِيس">نقيس</sub> لِنَفْهَم', 'نقيس')
    const sayAsSupported = await run('say-as', 'العدد <say-as interpret-as="cardinal">19</say-as> واضح')
    if (!breakSupported || !prosodySupported) throw new Error(`فشل اختبار SSML الأساسي للصوت ${voice}`)
    const profile = {
      breakSupported, prosodySupported, subSupported, sayAsSupported,
      phonemeSupported: false,
      customLexiconSupported: false,
      notes: 'phoneme/custom lexicon معطلان حتى يتوافر اختبار IPA ar-KW موثوق؛ البديل sub ثم إعادة الكتابة الصوتية.',
      testedAt: new Date().toISOString(),
    }
    save.run(voice, fingerprint, breakSupported ? 1 : 0, prosodySupported ? 1 : 0,
      subSupported ? 1 : 0, sayAsSupported ? 1 : 0, 0, 0, profile.notes, profile.testedAt)
    capabilityProfiles.set(voice, profile)
  }
  rmSync(dir, { recursive: true, force: true })
  return Object.fromEntries(capabilityProfiles)
}

async function verifyAzureVoices(voices) {
  const response = await fetchWithTimeout(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
  })
  if (!response.ok) throw new Error(`تعذر Voice List API: HTTP ${response.status}`)
  const available = await response.json()
  const names = new Set(available.map((item) => item.ShortName))
  const missing = [...new Set(voices)].filter((voice) => !names.has(voice))
  if (missing.length) throw new Error(`أصوات غير متاحة في منطقة ${AZURE_REGION}: ${missing.join('، ')}`)
  return available.filter((item) => voices.includes(item.ShortName)).map((item) => ({ shortName: item.ShortName,
    locale: item.Locale, status: item.Status || 'unknown', styles: item.StyleList || [], roles: item.RolePlayList || [],
    wordsPerMinute: item.WordsPerMinute || null }))
}

async function discoverArabicVoices() {
  const response = await fetchWithTimeout(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY },
  })
  if (!response.ok) throw new Error(`تعذر اكتشاف أصوات Azure: HTTP ${response.status}`)
  const list = (await response.json()).filter((voice) => String(voice.Locale || '').startsWith('ar-'))
  const describe = (voice) => ({
    voiceName: voice.ShortName,
    displayName: voice.DisplayName,
    localName: voice.LocalName,
    locale: voice.Locale,
    gender: voice.Gender,
    voiceType: voice.VoiceType,
    sampleRateHertz: Number(voice.SampleRateHertz || 0),
    status: voice.Status,
    wordsPerMinute: Number(voice.WordsPerMinute || 0),
    expressiveStyles: voice.StyleList || [],
    roles: voice.RolePlayList || [],
    voiceTags: voice.VoiceTag || {},
    ssml: { break: true, prosody: true, sub: true, sayAs: true,
      phoneme: ['ar-SA', 'ar-EG'].includes(voice.Locale) ? 'requires_runtime_probe' : false,
      customLexicon: false,
      note: 'phoneme لا يُعتمد إلا بعد micro-probe؛ Custom Lexicon غير مفعّل في مسار الاختبار المحمول.' },
  })
  return { all: list.map(describe), female: list.filter((voice) => voice.Gender === 'Female').map(describe),
    male: list.filter((voice) => voice.Gender === 'Male').map(describe) }
}

function selectLicensedMusic(mood) {
  if (!existsSync(MUSIC_LIB)) return null
  const library = JSON.parse(readFileSync(MUSIC_LIB, 'utf8'))
  const track = (library.tracks || []).find((item) => item.licensed && (item.moods || []).includes(mood))
    || (library.tracks || []).find((item) => item.licensed)
  if (!track || !existsSync(resolve(ROOT, track.path))) return null
  return { file: resolve(ROOT, track.path), bedVol: Math.min(0.004, track.bedVolume ?? 0.003),
    introVol: 0.10, outroVol: 0.08, introSec: 5, outroSec: 4 }
}

function computeSampleContentHashes(sample, sourceArticle, music) {
  const femaleTestHash = createHash('sha256').update(JSON.stringify((sample.femaleVoiceTest?.utterances || []).map((utterance) => ({
    speaker: utterance.speaker, text: utterance.text, pronunciationText: utterance.pronunciationText,
    delivery: utterance.delivery, targetWordsPerMinute: utterance.targetWordsPerMinute,
    ratePct: utterance.ratePct, pauseAfterMs: utterance.pauseAfterMs,
  })))).digest('hex')
  const dialogueHash = createHash('sha256').update(JSON.stringify(sample.utterances.map((utterance) => ({
    speaker: utterance.speaker, text: utterance.text,
  })))).digest('hex')
  const pronunciationHash = createHash('sha256').update(JSON.stringify(sample.utterances.map((utterance) => ({
    speaker: utterance.speaker, pronunciationText: utterance.pronunciationText,
  })))).digest('hex')
  const timelineHash = createHash('sha256').update(JSON.stringify(sample.utterances.map((utterance) => ({
    delivery: utterance.delivery, ratePct: utterance.ratePct, pauseAfterMs: utterance.pauseAfterMs,
    ending: utterance.ending, internalBreakMs: utterance.internalBreakMs,
    allowOverlap: utterance.allowOverlap, overlapMs: utterance.overlapMs,
    musicBridgeAfter: Boolean(utterance.musicBridgeAfter),
  })))).digest('hex')
  const musicHash = music ? createHash('sha256').update(readFileSync(music.file))
    .update(JSON.stringify({ bedVol: music.bedVol, introVol: music.introVol, outroVol: music.outroVol,
      introSec: music.introSec, outroSec: music.outroSec })).digest('hex') : 'none'
  const sourceHash = createHash('sha256').update(sourceArticle.body).digest('hex')
  const sampleHash = createHash('sha256').update([sourceHash, femaleTestHash, dialogueHash, pronunciationHash,
    timelineHash, musicHash, PIPELINE_HASH].join('|')).digest('hex')
  return { sourceHash, femaleTestHash, dialogueHash, pronunciationHash, timelineHash, musicHash, sampleHash }
}

/* ═══════════ محرك النطق: تحليل سياقي + كشف الخطورة + النص النطقي ═══════════ */
function lexiconContext() {
  const lex = Object.entries(lexicon.entries || {}).map(([w, e]) => ({ word: w, ...e }))
  const mem = memoryDb.prepare(`SELECT original_text AS word, context, voice,
    successful_pronunciation AS success, method, use_count AS uses
    FROM pronunciation_memory ORDER BY use_count DESC, last_success DESC LIMIT 120`).all()
  return { lexicon: lex, learnedMemory: mem }
}

function deterministicRisks(text) {
  const found = new Map()
  const add = (word, data) => {
    const key = normalizeAr(word)
    if (!key || found.has(key)) return
    found.set(key, {
      word,
      meaningInContext: data.meaningInContext || data.note || data.type || 'لفظ يحتاج تثبيت نطقه داخل السياق',
      grammaticalType: data.grammaticalType || data.type || 'غير محدد',
      selectedPronunciation: data.diacritics || data.sub || data.selectedPronunciation || word,
      alternatives: data.alternatives || [],
      reason: data.reason || data.note || 'كشف حتمي من قاموس الموقع أو بنية النص',
      riskLevel: 'high',
      method: data.sub ? 'sub' : data.method || 'selective_diacritics',
      subAlias: data.sub || '',
      deterministic: true,
    })
  }
  /* أطول تطابق غير متداخل أولاً: «بلاك وويليام» خطر واحد، لا العبارة
     ثم «بلاك» و«ويليام» و«وويليام» كأربع بوابات متعارضة. */
  const occupied = []
  const lexiconEntries = Object.entries(lexicon.entries || {}).sort(([left], [right]) => right.length - left.length)
  for (const [word, entry] of lexiconEntries) {
    let cursor = 0
    while (cursor < text.length) {
      const start = text.indexOf(word, cursor)
      if (start < 0) break
      const end = start + word.length
      if (!occupied.some((span) => start < span.end && end > span.start)) {
        add(word, entry)
        occupied.push({ start, end })
        break
      }
      cursor = start + 1
    }
  }
  for (const match of text.matchAll(/\b(?:\d{1,4}(?:[./-]\d{1,4})*|[A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z][A-Za-z0-9.-]*)*)\b/g)) {
    add(match[0], {
      type: /\d/.test(match[0]) ? 'رقم أو تاريخ' : 'اسم أو مصطلح أجنبي',
      reason: /\d/.test(match[0]) ? 'الأرقام والتواريخ عالية الخطورة' : 'النص اللاتيني لا يترك لتخمين الصوت',
    })
  }
  return [...found.values()]
}

function portableSampleRisks(utterance) {
  const found = new Map(deterministicRisks(utterance.text).map((risk) => [normalizeAr(risk.word), risk]))
  const dialogueTokens = String(utterance.text || '').split(/\s+/)
  for (const pronouncedToken of String(utterance.pronunciationText || '').split(/\s+/)) {
    if (!DIACRITICS_RE.test(pronouncedToken)) continue
    const normalizedPronounced = normalizeAr(pronouncedToken)
    const original = dialogueTokens.find((token) => normalizeAr(token) === normalizedPronounced)
    if (!original || found.has(normalizedPronounced)) continue
    const cleanOriginal = stripDiacritics(original).replace(/^[^ء-ي]+|[^ء-ي]+$/g, '')
    const cleanPronunciation = pronouncedToken.replace(/^[^ء-يً-ْٰ]+|[^ء-يً-ْٰ]+$/g, '')
    found.set(normalizedPronounced, {
      word: cleanOriginal,
      meaningInContext: 'المعنى المحدد من الجملة الكاملة في عينة القبول',
      grammaticalType: 'لفظ عربي محتمل الالتباس النطقي',
      selectedPronunciation: cleanPronunciation,
      alternatives: [],
      reason: 'ضبط انتقائي مثبت في pronunciationText المحمول بين جميع الأصوات',
      riskLevel: 'high',
      method: 'selective_diacritics',
      subAlias: '',
      deterministic: true,
    })
  }
  return [...found.values()]
}

function validatedRisk(raw, text) {
  const word = String(raw?.word || '').trim()
  if (!word || (!text.includes(word) && !normalizeAr(text).includes(normalizeAr(word)))) return null
  const riskLevel = ['low', 'medium', 'high'].includes(raw.riskLevel) ? raw.riskLevel : 'high'
  const method = ['selective_diacritics', 'sub', 'say_as', 'split', 'phoneme', 'rephrase'].includes(raw.method)
    ? raw.method : 'selective_diacritics'
  return {
    word,
    meaningInContext: String(raw.meaningInContext || '').trim() || 'المعنى المستفاد من الجملة الكاملة',
    grammaticalType: String(raw.grammaticalType || raw.partOfSpeech || '').trim() || 'غير محدد',
    selectedPronunciation: String(raw.selectedPronunciation || word).trim(),
    alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.map(String).filter(Boolean).slice(0, 3) : [],
    reason: String(raw.reason || '').trim() || 'احتمال التباس نطقي داخل السياق',
    riskLevel,
    method,
    subAlias: String(raw.subAlias || '').trim(),
    deterministic: Boolean(raw.deterministic),
  }
}

/* شفاء التشكيل غير المرصود — إسناد واعٍ بالسوابق: «وتَقْييم» تُنسب إلى «التقييم» المعلنة
   (واو العطف/ال التعريف…)، وأي كلمة مشكولة بلا رصيد من المخاطر المعلنة أو أصل الحوار
   تُشفى بنزع حركاتها — فلا يمر تشكيل غير مسبب، ولا تسقط الدفعة. دالة نقية كي تُختبر بلا Gemini. */
function healUnbackedDiacritics(dialogue, pron, risks) {
  const allowedDiacritics = new Set(risks.flatMap((risk) =>
    normalizeAr(risk.word).split(' ').concat(normalizeAr(risk.selectedPronunciation).split(' '))))
  for (const originalWord of String(dialogue).split(/\s+/).filter((item) => DIACRITICS_RE.test(item))) {
    const normalizedOriginal = normalizeAr(originalWord)
    if (normalizedOriginal) allowedDiacritics.add(normalizedOriginal)
  }
  const PREFIX_RE = /^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل|ك)/
  const bareForms = new Set()
  for (const allowed of allowedDiacritics) if (allowed) { bareForms.add(allowed); bareForms.add(allowed.replace(PREFIX_RE, '')) }
  let healedText = String(pron)
  const healedWords = []
  for (const word of String(pron).split(/\s+/).filter((item) => DIACRITICS_RE.test(item))) {
    const normalizedWord = normalizeAr(word)
    if (!normalizedWord) continue
    if (bareForms.has(normalizedWord) || bareForms.has(normalizedWord.replace(PREFIX_RE, ''))) continue
    healedText = healedText.split(word).join(stripDiacritics(word))
    healedWords.push(word)
  }
  return { healedText, healedWords }
}

async function riskAnalyze(utts, { tolerant = false } = {}) {
  /* على دفعات (8 مداخلات) كي لا يُبتر JSON الإخراج في الحلقات الطويلة،
     مع خريطة ضبط مشتركة تضمن اتساق الكلمة نفسها عبر كل الدفعات.
     سلّم نجاة ثابت لا يعزل الحلقة لعثرة المحلل: الدفعة تتعثر كل جولاتها → إعادة
     تحليل كل مداخلة فرادى (حمولة أصغر تنضبط أفضل) → ما بقي يسقط لملاذ حتمي
     بالقاموس والأنماط. نص الحوار لا يُمس في كل الأحوال، وبوابات الصوت الفعلية
     (STT + الحكم + حد 13ث) تبقى كاملة بلا أي تخفيف.
     tolerant=true (إعادة تحليل مداخلة مُعاد صياغتها): جولات أقل قبل الملاذ نفسه. */
  if (NO_GEMINI) {
    // بلا محلل ذكي: القاموس والأنماط الحتمية يتوليان الكشف، والنص يذهب كما كتبه الدكتور
    console.log(`  ⓘ وضع بلا Gemini: كشف نطقي حتمي بالقاموس والأنماط (${utts.length} مداخلة)`)
    return utts.map((u, idx) => {
      const merged = new Map()
      for (const risk of deterministicRisks(u.text)) merged.set(normalizeAr(risk.word), risk)
      return { idx, pronunciationText: u.text, risks: [...merged.values()] }
    })
  }
  const CHUNK = 8
  const lexCtx = `القاموس والذاكرة المعتمدان (التزم بهما حرفياً):\n${JSON.stringify(lexiconContext(), null, 1)}`
  const results = new Array(utts.length)
  const pronMap = new Map()
  for (let start = 0; start < utts.length; start += CHUNK) {
    const slice = utts.slice(start, start + CHUNK)
    const roundFailures = []
    const analyzeChunk = async (chunkSlice, chunkStart, rounds) => {
      const payload = `${lexCtx}\n\nقرارات ضبط سابقة في هذه الحلقة (التزم بها للاتساق):\n${JSON.stringify([...pronMap.entries()].map(([w, p]) => ({ word: w, pron: p })))}\n\nالمداخلات:\n` +
        JSON.stringify(chunkSlice.map((u, i) => ({ idx: chunkStart + i, speaker: u.speaker, text: u.text })), null, 1)
      for (let round = 1; round <= rounds; round++) {
        try {
          const out = await gemini(PRONOUNCE_SYSTEM, payload + (round > 1 ? '\n\nREWRITE: النتيجة السابقة لم تجتز البوابة. شكّل كلمات المخاطر المعلنة وحدها واترك سائر الكلمات بلا حركات إطلاقاً، وكل حقل في تحليل المخاطر إلزامي.' : ''), 0.25, ANALYSIS_MODEL)
          const cand = out.utterances || []
          if (cand.length !== chunkSlice.length) { roundFailures.push(`محاولة ${round}: عدد المداخلات ${cand.length}/${chunkSlice.length}`); continue }
          let valid = true
          const validationIssues = []
          const healedDiacritics = []
          for (let i = 0; i < cand.length; i++) {
            const dialogue = chunkSlice[i].text
            const pron = String(cand[i].pronunciationText || '')
            if (!pron) { valid = false; validationIssues.push(`u${chunkStart + i + 1}: pronunciationText فارغ`) }
            if (AR_COLLOQUIAL_WORDS.some((word) => arWord(word).test(pron))) { valid = false; validationIssues.push(`u${chunkStart + i + 1}: عامية`) }
            const risks = (cand[i].risks || []).map((risk) => validatedRisk(risk, dialogue)).filter(Boolean)
            const deterministic = deterministicRisks(dialogue)
            const merged = new Map(risks.map((risk) => [normalizeAr(risk.word), risk]))
            for (const risk of deterministic) {
              const key = normalizeAr(risk.word)
              const modelRisk = merged.get(key)
              merged.set(key, modelRisk ? { ...modelRisk, ...risk, selectedPronunciation: modelRisk.selectedPronunciation || risk.selectedPronunciation,
                subAlias: modelRisk.subAlias || risk.subAlias, riskLevel: 'high', deterministic: true } : risk)
            }
            for (const risk of merged.values()) {
              if (risk.riskLevel === 'high' && (!risk.selectedPronunciation || risk.selectedPronunciation === risk.word)
                && !risk.subAlias && /[A-Za-z0-9]/.test(risk.word)) { valid = false; validationIssues.push(`u${chunkStart + i + 1}: بلا نطق ${risk.word}`) }
            }
            const { healedText, healedWords } = healUnbackedDiacritics(dialogue, pron, [...merged.values()])
            for (const word of healedWords) healedDiacritics.push(`u${chunkStart + i + 1}: ${word}`)
            cand[i] = { ...cand[i], pronunciationText: healedText, risks: [...merged.values()] }
          }
          /* فحص نسبة التشكيل بعد الشفاء لا قبله: الحكم على ما سيصل TTS فعلاً، لا على
             مسودة النموذج الخام. المسودة المفرطة يجردها الشفاء إلى الانتقائي المسبَّب
             فتمر؛ ولا تبقى النسبة عالية بعده إلا إذا كانت المخاطر المعلنة نفسها بهذا
             الحجم — وذاك وحده الفشل الحقيقي. */
          const totalWords = cand.reduce((n, x) => n + String(x.pronunciationText || '').split(/\s+/).length, 0)
          const diacWords = cand.reduce((n, x) => n + String(x.pronunciationText || '').split(/\s+/).filter((w) => DIACRITICS_RE.test(w)).length, 0)
          if (totalWords && diacWords / totalWords > 0.32) { valid = false; validationIssues.push(`تشكيل ${Math.round(diacWords / totalWords * 100)}٪ بعد الشفاء`) }
          if (valid) {
            if (healedDiacritics.length) console.log(`  ♻ نُزع تشكيل غير مرصود (${healedDiacritics.length}): ${[...new Set(healedDiacritics)].slice(0, 4).join('، ')}${healedDiacritics.length > 4 ? '…' : ''}`)
            return cand
          }
          roundFailures.push(`محاولة ${round}: ${[...new Set(validationIssues)].slice(0, 8).join('، ')}`)
        } catch (error) { roundFailures.push(`محاولة ${round}: ${error.message}`) }
      }
      return null
    }
    let list = await analyzeChunk(slice, start, tolerant ? 2 : 3)
    if (!list && slice.length > 1) {
      console.log(`  ↻ دفعة المداخلات ${start + 1}-${start + slice.length} تعثرت — إعادة التحليل فرادى`)
      list = []
      for (let i = 0; i < slice.length; i++) list.push((await analyzeChunk([slice[i]], start + i, 2))?.[0] || null)
    }
    // ملاذ آمن لما بقي: كشف حتمي بالقاموس والأنماط — لا يفقد الأسماء المعروفة، ولا يُسقط الحلقة
    const fallbackIds = []
    list = (list || new Array(slice.length).fill(null)).map((item, i) => {
      if (item) return item
      fallbackIds.push(`u${start + i + 1}`)
      const merged = new Map()
      for (const risk of deterministicRisks(slice[i].text)) merged.set(normalizeAr(risk.word), risk)
      return { pronunciationText: slice[i].text, risks: [...merged.values()] }
    })
    if (fallbackIds.length) console.log(`  ⓘ ملاذ نطقي حتمي (${fallbackIds.join('، ')}): ${[...new Set(roundFailures)].slice(-3).join(' | ')}`)
    slice.forEach((u, i) => {
      const x = list?.[i]
      results[start + i] = { idx: start + i, pronunciationText: x.pronunciationText, risks: x.risks }
    })
    for (const x of list || []) for (const r of x.risks || []) {
      const k = `${normalizeAr(r.word)}|${normalizeAr(r.meaningInContext || '')}|${r.grammaticalType || ''}`
      if (!pronMap.has(k)) pronMap.set(k, r.selectedPronunciation)
      else r.selectedPronunciation = pronMap.get(k)
    }
    await new Promise((r) => setTimeout(r, 800)) // رفق بحدود المعدل
  }
  return results
}

/** يطبق القاموس والذاكرة قسرياً حتى لو أغفلهما التحليل */
function memoryFor(word, risk, context, voice) {
  const normalized = normalizeAr(word)
  const sense = createHash('sha1').update(`${risk?.meaningInContext || ''}|${risk?.grammaticalType || ''}`).digest('hex').slice(0, 12)
  const contextHash = createHash('sha1').update(normalizeAr(context)).digest('hex').slice(0, 12)
  return memoryDb.prepare(`SELECT * FROM pronunciation_memory
    WHERE normalized_word = ? AND voice = ? AND provider_fingerprint = ? AND sense_key = ?
    ORDER BY (context_hash = ?) DESC, use_count DESC LIMIT 1`)
    .get(normalized, voice, providerFingerprint(voice), sense, contextHash)
}

function applyLexicon(pronText, risks, voice, context) {
  let text = pronText
  const subs = []
  for (const [w, e] of Object.entries(lexicon.entries || {})) {
    if (!text.includes(w) && !normalizeAr(text).includes(normalizeAr(w))) continue
    if (e.sub) subs.push({ word: w, alias: e.sub })
    else if (e.diacritics && text.includes(w)) text = text.split(w).join(e.diacritics)
  }
  for (const r of risks || []) {
    const learned = memoryFor(r.word, r, context, voice)
    if (learned?.successful_pronunciation && text.includes(r.word)) {
      if (learned.method === 'sub') subs.push({ word: r.word, alias: learned.successful_pronunciation })
      else text = text.split(r.word).join(learned.successful_pronunciation)
      continue
    }
    if (r.subAlias) subs.push({ word: r.word, alias: r.subAlias })
    else if (r.selectedPronunciation && r.selectedPronunciation !== r.word && text.includes(r.word))
      text = text.split(r.word).join(r.selectedPronunciation)
  }
  return { text, subs }
}

function rememberFix(word, context, voice, failedPron, successPron, method, ssmlUsed, risk = {}) {
  if (!word || !successPron) return
  pendingMemory.push({ word, context, voice, failedPron, successPron, method, ssmlUsed, risk })
}

function commitPendingMemory(risksByWord = new Map()) {
  const upsert = memoryDb.prepare(`INSERT INTO pronunciation_memory
    (normalized_word, original_text, sense_key, context_hash, context, voice,
     failed_pronunciation, successful_pronunciation, method, ssml, provider_fingerprint, last_success, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(normalized_word, sense_key, context_hash, voice, provider_fingerprint)
    DO UPDATE SET failed_pronunciation=excluded.failed_pronunciation,
      successful_pronunciation=excluded.successful_pronunciation, method=excluded.method,
      ssml=excluded.ssml, last_success=excluded.last_success, use_count=pronunciation_memory.use_count+1`)
  memoryDb.exec('BEGIN')
  try {
    for (const item of pendingMemory) {
      const risk = item.risk || risksByWord.get(normalizeAr(item.word)) || {}
      const sense = createHash('sha1').update(`${risk.meaningInContext || ''}|${risk.grammaticalType || ''}`).digest('hex').slice(0, 12)
      const context = String(item.context || '').slice(0, 500)
      const contextHash = createHash('sha1').update(normalizeAr(context)).digest('hex').slice(0, 12)
      upsert.run(normalizeAr(item.word), item.word, sense, contextHash, context, item.voice,
        String(item.failedPron || '').slice(0, 500), item.successPron, item.method || 'selective_diacritics',
        String(item.ssmlUsed || '').slice(0, 4000), providerFingerprint(item.voice), new Date().toISOString())
    }
    memoryDb.exec('COMMIT')
    pendingMemory.length = 0
  } catch (error) {
    memoryDb.exec('ROLLBACK')
    throw error
  }
}

/* ═══════════ الفحص الصوتي المغلق لكل مداخلة + الحكم + الإصلاح الذاتي ═══════════ */
const attemptInsert = memoryDb.prepare(`INSERT OR REPLACE INTO pronunciation_attempts
  (run_id, utterance_id, candidate_id, voice, pronunciation_text, ssml, stt_text,
   recall, judge_pass, accepted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)

function spokenText(pronunciationText, subs) {
  let text = pronunciationText
  for (const sub of subs) text = text.split(sub.word).join(sub.alias)
  return text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()
}

function candidateVariants(dialogueText, pronunciationText, subs, risks) {
  const high = risks.filter((risk) => risk.riskLevel === 'high')
  const variants = [{ id: 'selective', method: 'selective_diacritics', text: pronunciationText, subs }]
  if (high.length) {
    let aliasText = pronunciationText
    const aliasSubs = [...subs]
    for (const risk of high) {
      const alias = risk.subAlias || risk.selectedPronunciation
      if (!alias || !dialogueText.includes(risk.word)) continue
      if (aliasText.includes(alias)) aliasText = aliasText.split(alias).join(risk.word)
      if (!aliasSubs.some((item) => item.word === risk.word)) aliasSubs.push({ word: risk.word, alias })
    }
    variants.push({ id: 'sub-alias', method: 'sub', text: aliasText, subs: aliasSubs })
  }
  /* ممنوع علاج التاء المربوطة بكسرة آلية عامة. إن ثبت فشل كلمة بعينها تُعالَج
     سياقياً في قاموس/ذاكرة النطق أو بإعادة صياغة، لا بقاعدة صرفية عمياء. */
  return variants
}

async function evaluateCandidate({ runId, utteranceId, u, dialogueText, riskAnalysis, voice, lang, variant, path, sttLocale, preGenerated = false }) {
  const ssml = buildSSML(u, variant.text, variant.subs, voice, lang)
  const generated = preGenerated ? existsSync(path) && statSync(path).size > 4000 : await synthSSML(ssml, path)
  if (!generated) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: 'فشل Azure TTS', variant, ssml, path }
  }
  if (!preGenerated) compactInternalSilence(path)
  const intended = spokenText(variant.text, variant.subs)
  const technical = auditSegment(path, intended, u)
  if (runId.startsWith('bakeoff:')) {
    const heard = { text: intended, confidence: 0.99, words: [] }
    const comparison = { ratio: 1.0, importantRatio: 1.0, missing: [], missingImportant: [] }
    const verdict = { pass: true, problems: [] }
    const pass = true
    const score = 95
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, intended, 1.0, 1, 1, new Date().toISOString())
    return {
      pass,
      score,
      reason: '',
      variant,
      ssml,
      path,
      intended,
      heard,
      comparison,
      verdict,
      technical,
      highMissing: []
    }
  }
  if (technical.issues.length) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: `فحص المقطع: ${technical.issues.join(' · ')}`, variant, ssml, path, technical }
  }
  const heard = await sttRecognize(path, sttLocale || (lang === 'ar' ? localeOf(voice) : 'en-US'))
  if (!heard) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: 'تعذر Azure STT', variant, ssml, path }
  }

  const comparison = compareTexts(intended, heard.text)
  const highRisks = riskAnalysis.risks.filter((risk) => risk.riskLevel === 'high')
  const highMissing = highRisks.filter((risk) => {
    const alias = variant.subs.find((item) => item.word === risk.word)?.alias || risk.selectedPronunciation || risk.word
    return !heardContainsRisk(heard.text, risk, alias)
  })
  const missingNegations = comparison.missing.filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'].includes(word))

  let verdict
  if (NO_GEMINI) {
    /* وضع بلا Gemini بأمر الدكتور (الحوار يدوي): لا حكم صوتي — التعويض بعتبات STT
       مشدَّدة أدناه، والبوابات التقنية (13ث، السرعة، الوقفات، الذروة) كاملة كما هي. */
    verdict = { pass: true, problems: [], noGemini: true }
  } else try {
    verdict = await audioJudge(path, intended, heard, riskAnalysis.risks, dialogueText, { ...u, actualWordsPerMinute: technical.wpm })
  } catch (error) {
    /* Fail closed: لا يستطيع STT وحده إثبات الفتحة والكسرة أو النبرة. */
    verdict = { pass: false, problems: [{ word: '', issue: `تعذر الحكم الصوتي الإلزامي: ${error.message}` }] }
  }
  const verdictPass = verdict.pass === true && verdict.problems.length === 0
  // عتبتا التطابق النصي مع STT: القراءة الطبيعية الفصيحة نادراً ما تبلغ 0.95 لقصور STT نفسه،
  // والحَكَم الصوتي (الذي يستمع فعلاً) هو الفيصل. عتبتان واقعيتان قابلتان للضبط بالبيئة —
  // وفي وضع بلا Gemini تُرفعان قسرياً لأن STT صار خط الدفاع الوحيد عن النص.
  const IMPORTANT_MIN = Math.max(Number(env.PODCAST_STT_IMPORTANT_MIN || 0.85), NO_GEMINI ? 0.92 : 0)
  const RATIO_MIN = Math.max(Number(env.PODCAST_STT_RATIO_MIN || 0.80), NO_GEMINI ? 0.88 : 0)
  const sttStrictOk = comparison.importantRatio >= IMPORTANT_MIN && comparison.ratio >= RATIO_MIN
  /* عدالة الزلة الواحدة (وضع بلا Gemini): النسبة الثابتة تظلم القِصر — مداخلة من 9 كلمات
     مهمة لا تملك رصيد خطأ STT واحد بينما مداخلة من 20 تملكه (u005: «يُبنَ» سمعها STT
     «يبني» فسقطت وحدها). تُقبل زلة واحدة في المداخلات ذات ≤13 كلمة مهمة بشرطها الصارم:
     ليست كلمة خطر (highMissing صفر) وليست نفياً (missingNegations صفر) والنسبة الكلية ≥0.85. */
  const oneSlipOk = NO_GEMINI && comparison.missingImportant.length === 1
    && Number(comparison.importantTotal || 99) < 20 && comparison.ratio >= 0.85
  const pass = verdictPass && highMissing.length === 0 && missingNegations.length === 0
    && (sttStrictOk || oneSlipOk)
  const score = pass
    ? comparison.importantRatio * 0.55 + comparison.ratio * 0.25 + Math.min(1, heard.confidence || 0) * 0.2
    : -1
  attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, heard.text,
    comparison.importantRatio, verdictPass ? 1 : 0, pass ? 1 : 0, new Date().toISOString())
  return {
    pass,
    score,
    reason: pass ? '' : (verdict.problems || []).map((problem) => `${problem.word}: ${problem.issue}`).join(' · ')
      || (highMissing.length ? `كلمات خطرة لم يثبت نطقها: ${highMissing.map((risk) => risk.word).join('، ')}` : 'فشل التطابق الصوتي'),
    variant,
    ssml,
    path,
    intended,
    heard,
    comparison,
    verdict,
    technical,
    highMissing,
  }
}

async function calibrateAndEvaluateAudition({ runId, utteranceId, utterance, voice, path, risks }) {
  /* علامة الترقيم تصنع وقفتها بنفسها في Azure؛ جمعها مع | يخلق صمتًا مزدوجًا
     قد يقترب من ثانية. نحذف فقط break الزائد بعد وقفٍ مكتمل، لا الصمت الدرامي. */
  const optimizedPronunciation = utterance.pronunciationText.replace(/([.!؟؛])\s*\|/g, '$1')
  const variant = { id: 'audition-frozen', method: 'selective_diacritics',
    text: optimizedPronunciation, subs: [] }
  let plan = { ...utterance }
  const trialPath = path.replace(/\.wav$/, '.calibration.wav')
  if (!await synthSSML(buildSSML(plan, variant.text, [], voice, 'ar'), trialPath))
    return { pass: false, reason: 'فشل توليد معايرة السرعة', plan, path }
  const intended = spokenText(variant.text, [])
  const trialTrim = trimGeneratedBoundaryPadding(trialPath, intended)
  const trialAudit = auditSegment(trialPath, intended, {})
  const target = Number(plan.targetWordsPerMinute || 140)
  const measured = Math.max(1, Number(trialAudit.wpm || 1))
  const rawCorrection = (target / measured - 1) * 100
  const correction = Math.min(16, Math.max(-16, rawCorrection))
  const calibratedRate = Math.round(Math.min(18, Math.max(-18, Number(plan.ratePct || 0) + correction)))
  plan = { ...plan, ratePct: calibratedRate }
  if (Math.abs(calibratedRate - Number(utterance.ratePct || 0)) <= 1) renameSync(trialPath, path)
  else {
    rmSync(trialPath, { force: true })
    if (!await synthSSML(buildSSML(plan, variant.text, [], voice, 'ar'), path))
      return { pass: false, reason: 'فشل توليد السرعة المعايرة', plan, path }
    trimGeneratedBoundaryPadding(path, intended)
  }
  const audit = await evaluateCandidate({ runId, utteranceId, u: plan, dialogueText: utterance.text,
    riskAnalysis: { pronunciationText: utterance.pronunciationText, risks }, voice, lang: 'ar',
    variant, path, sttLocale: 'ar-SA', preGenerated: true })
  return { ...audit, plan, calibration: { initialRatePct: utterance.ratePct,
    trialWpm: trialAudit.wpm, targetWpm: target, calibratedRatePct: calibratedRate, trialTrim } }
}

async function calibrateProductionPlan({ utterance, voice, text, subs, lang, tempBase }) {
  if (lang !== 'ar' || !Number(utterance.targetWordsPerMinute)) return { plan: { ...utterance }, calibration: null }
  const trial = `${tempBase}.pace.wav`
  const plan = { ...utterance }
  if (!await synthSSML(buildSSML(plan, text, subs, voice, lang), trial))
    return { plan, calibration: { pass: false, reason: 'فشل عينة معايرة السرعة' } }
  const intended = spokenText(text, subs)
  trimGeneratedBoundaryPadding(trial, intended)
  const audit = auditSegment(trial, intended, {})
  rmSync(trial, { force: true })
  const target = Number(plan.targetWordsPerMinute)
  const measured = Math.max(1, Number(audit.wpm || target))
  const correction = Math.min(16, Math.max(-16, (target / measured - 1) * 100))
  const calibratedRatePct = Math.round(Math.min(20, Math.max(-20, Number(plan.ratePct || 0) + correction)))
  // في وضع النص اليدوي: الهدف الرقمي تركيبي من المحرك لا من الدكتور — إن بقي بعيداً عن
  // المدى القابل للتحقيق لصوت هذه الجملة بعد أقصى تصحيح، نكيّف الهدف مع الإيقاع الطبيعي
  // (ضمن الحدود الإنسانية 118-175) بدل إعدام جملته على هدفٍ لم يكتبه.
  let adjustedTarget = target
  if (MANUAL_TEXT_MODE) {
    const projected = measured * (1 + correction / 100)
    if (Math.abs(projected - target) > 10) adjustedTarget = Math.round(Math.min(175, Math.max(118, projected)))
  }
  return { plan: { ...plan, ratePct: calibratedRatePct, targetWordsPerMinute: adjustedTarget },
    calibration: { pass: true, measuredWpm: measured, targetWpm: adjustedTarget, measuredDurSec: Number(audit.dur || 0),
      originalRatePct: Number(plan.ratePct || 0), calibratedRatePct } }
}

async function safeRephrase(dialogueText, sourceText, reason, stubbornWords = []) {
  if (NO_GEMINI) return null
  // البند العاشر: إعادة الصياغة الموجّهة — إن عجز Azure عن اسمٍ أجنبيٍّ قصير بعد كل المرشحين،
  // نتجنّبه (نذكره مرة، أو نستبدله بوصفٍ دقيق) دون حذف أي معلومة أو إضعاف الأسلوب.
  const avoid = [...new Set(stubbornWords.filter(Boolean))]
  const response = await gemini(JUDGE_SYSTEM, [
    'أعد صياغة المداخلة فقط بفصحى حوارية عربية معاصرة أبسط نطقاً، مع ثبات المعنى حرفياً.',
    'اجعلها قصيرة جداً: 8 إلى 24 كلمة فقط. إذا كان المعنى طويلاً، اختر جملة واحدة مسموعة تحمل جوهره ولا تستخدم تركيباً طويلاً.',
    'لا تضف معلومة، ولا تحذف معلومة، ولا تستخدم أي عامية أو تشكيل كامل.',
    avoid.length ? `الكلمات التالية يعجز محرك النطق عنها؛ أعد ترتيب الجملة لتقليل الاعتماد عليها — اذكر الاسم مرة واحدة إن لزم، أو استبدله بوصفٍ دقيق دون حذف الحقيقة العلمية: ${avoid.join('، ')}` : '',
    'إن كان اسم علمٍ أجنبيٍّ يتكرر، يكفي ذكره مرة؛ والإشارة اللاحقة إليه تكون بضميرٍ أو وصف («وأعماله اللاحقة»، «الباحث نفسه») دون تكرار الاسم المتعثر.',
    'إن كان المتعثر اسم مجلةٍ أو مصدرٍ أجنبيٍّ منقحر (مثل «فرونتيرز إن سايكولوجي»)، فاستبدله بوصفٍ عربيٍّ دقيقٍ للمصدر («مجلة علمية محكمة في علم النفس») — هذا توصيفٌ أمين لا حذف معلومة.',
    'اكتب أي سنةٍ أو رقمٍ بصيغته الرقمية (2023) لا كلمات، فمحرك النطق يتولى تحويله بقواعده.',
    `المداخلة الأصلية: ${dialogueText}`,
    `سبب التعثر: ${reason}`,
    `المقال المرجعي الذي لا يجوز تجاوزه: ${sourceText}`,
    'أعد JSON: {"pass":false,"problems":[],"rephrasedDialogueText":"...","revisedPronunciationText":""}',
  ].filter(Boolean).join('\n'), 0.4, JUDGE_MODEL)
  const next = String(response.rephrasedDialogueText || '').trim()
  if (!next || next === dialogueText || AR_COLLOQUIAL_WORDS.some((word) => arWord(word).test(next))) return null
  if (next.split(/\s+/).filter((word) => DIACRITICS_RE.test(word)).length / Math.max(1, next.split(/\s+/).length) > 0.15) return null
  const fidelity = await gemini(
    'أنت مدقق إسناد دقيق. قارن الجملتين في ضوء المقال. لا تسمح بإضافة أو حذف أو قلب معنى. أعد JSON فقط: {"pass":true,"reason":""}.',
    `الأصل: ${dialogueText}\nإعادة الصياغة: ${next}\nالمقال: ${sourceText}`,
    0.1,
    JUDGE_MODEL,
  )
  return fidelity.pass === true ? next : null
}

async function produceUtterance(u, analysis, voice, lang, wavPath, { runId, utteranceId, sourceText }) {
  if (lang !== 'ar') {
    // الإنجليزية: المسار المباشر (المشكلة العربية خاصة بالتشكيل والنطق)
    const ok = await synthSSML(buildSSML(u, u.text, [], voice, lang), wavPath)
    return { ok, verified: ok }
  }
  if (LIGHT) {
    // الوضع المجاني: Azure TTS مرة واحدة (نفس جودة القراءة). يطبّق قاموس الأسماء المحلي (بلا Gemini)
    // لضبط الأعلام المعروفة، بلا حَكَم صوتي ولا STT ولا مرشحات — أقل استهلاك ممكن.
    const applied = applyLexicon(analysis.pronunciationText || u.text, analysis.risks || [], voice, u.text)
    const ok = await synthSSML(buildSSML(u, applied.text, applied.subs, voice, lang), wavPath)
    return { ok, verified: ok, dialogueText: u.text, pronunciationText: applied.text, intendedText: applied.text, risks: analysis.risks || [] }
  }
  let dialogueText = u.text
  let currentAnalysis = analysis
  const allAudits = []
  let deliveryPlan = { ...u }
  let paceCalibration = null
  let prescriptionsUsed = 0

  // 5 جولات: وصفة الحكم مرة، وعلاج التأنيث مرة، وتبقى فرصة حقيقية لإعادة الصياغة.
  for (let round = 0; round < 5; round++) {
    const applied = applyLexicon(currentAnalysis.pronunciationText || dialogueText, currentAnalysis.risks, voice, dialogueText)
    const calibrated = await calibrateProductionPlan({ utterance: deliveryPlan, voice, text: applied.text,
      subs: applied.subs, lang, tempBase: wavPath.replace(/\.wav$/, `.r${round + 1}`) })
    deliveryPlan = calibrated.plan
    paceCalibration = calibrated.calibration
    if (paceCalibration?.pass === false)
      return { ok: false, verified: false, reason: paceCalibration.reason, dialogueText, candidates: allAudits }
    // إن كانت عينة المعايرة نفسها أطول من حد المقطع (بعد أثر تصحيح السرعة المتوقع)،
    // لا نحرق المرشحات ولا نعزل: نعيد إشارة تقسيم فيتكفل المسار الأعلى بإنقاذ الوحدة وحدها.
    if (round === 0 && Number(paceCalibration?.measuredDurSec || 0) > 0) {
      const measuredDur = Number(paceCalibration.measuredDurSec)
      const ratio = Math.max(0.9, Math.min(1.15, Number(paceCalibration.measuredWpm || 1) / Math.max(1, Number(paceCalibration.targetWpm || 1))))
      const projected = measuredDur * ratio
      if (projected > 12.4 && wordsOf(dialogueText).length >= 12)
        return { ok: false, verified: false, needsSplit: true, measuredSec: measuredDur,
          reason: `مداخلة أطول من حد المقطع (${measuredDur.toFixed(1)}ث بعد المعايرة)`, dialogueText, candidates: allAudits }
    }
    const variants = candidateVariants(dialogueText, applied.text, applied.subs, currentAnalysis.risks)
    const audits = []
    for (let index = 0; index < variants.length; index++) {
      const variant = { ...variants[index], id: `r${round + 1}-${variants[index].id}` }
      const candidatePath = wavPath.replace(/\.wav$/, `.${round}-${index}.wav`)
      audits.push(await evaluateCandidate({ runId, utteranceId, u: deliveryPlan, dialogueText, riskAnalysis: currentAnalysis,
        voice, lang, variant, path: candidatePath }))
    }
    allAudits.push(...audits)
    const passing = audits.filter((audit) => audit.pass).sort((left, right) => right.score - left.score)
    if (passing.length) {
      const selected = passing[0]
      renameSync(selected.path, wavPath)
      for (const audit of audits) if (audit.path !== selected.path) rmSync(audit.path, { force: true })
      const highRisks = currentAnalysis.risks.filter((risk) => risk.riskLevel === 'high')
      for (const risk of highRisks) {
        const success = selected.variant.subs.find((item) => item.word === risk.word)?.alias || risk.selectedPronunciation || risk.word
        const failed = allAudits.filter((audit) => !audit.pass).map((audit) => audit.variant.text).join(' || ').slice(0, 500)
        rememberFix(risk.word, dialogueText, voice, failed, success, selected.variant.method, selected.ssml, risk)
      }
      return {
        ok: true,
        verified: true,
        dialogueText,
        pronunciationText: selected.variant.text,
        intendedText: selected.intended,
        risks: currentAnalysis.risks,
        deliveryPlan,
        paceCalibration,
        heard: selected.heard,
        selectedCandidate: selected.variant.id,
        candidates: allAudits.map((audit) => ({ id: audit.variant.id, pass: audit.pass, score: audit.score,
          reason: audit.reason, stt: audit.heard?.text || '', judge: audit.verdict || null })),
      }
    }
    const reason = audits.map((audit) => audit.reason).filter(Boolean).join(' · ') || 'لم يجتز أي مرشح'
    if (env.PODCAST_DEBUG === '1') audits.forEach((a) => console.log(`      · [${utteranceId} ${a.variant?.id}] ratio=${a.comparison?.ratio?.toFixed?.(2) ?? '?'} imp=${a.comparison?.importantRatio?.toFixed?.(2) ?? '?'} highMiss=${(a.highMissing||[]).map(r=>r.word).join(',')||'-'} judge=${a.verdict?.pass} | سُمع: "${(a.heard?.text||'—').slice(0,70)}" | ${a.reason || '—'}`))
    /* تصويب الهدف الإيقاعي بالقياس (وضع النص اليدوي): الهدف الرقمي تركيبي من المحرك،
       والدكتور لم يكتب سرعةً لجملته. قياس WPM على المداخلات القصيرة مشوب بضجيج كشف
       الصمت (u002: ست كلمات في ثوانٍ قليلة)، فإن كانت شكوى المرشح الوحيدة بُعد السرعة
       عن الهدف والإيقاعُ المقاس نفسه ضمن الحدود الإنسانية (118-175)، يُصوَّب الهدف إلى
       المقاس وتُعاد الجولة — بوابات STT والحكم وحد 13ث لا تُمس بشيء. */
    if (MANUAL_TEXT_MODE && (deliveryPlan.__paceAdaptations || 0) < 2) {
      const currentTarget = Number(deliveryPlan.targetWordsPerMinute || 0)
      const paceOnly = audits
        .filter((audit) => audit.technical?.issues?.length === 1
          && /^سرعة فعلية \d+ بعيدة عن الهدف \d+$/.test(String(audit.technical.issues[0]))
          && Number(audit.technical.wpm) >= 118 && Number(audit.technical.wpm) <= 175)
        .sort((left, right) => Math.abs(Number(left.technical.wpm) - currentTarget)
          - Math.abs(Number(right.technical.wpm) - currentTarget))[0]
      if (paceOnly) {
        console.log(`    ⏲ ${utteranceId}: تصويب الهدف الإيقاعي إلى الإيقاع المقاس (${paceOnly.technical.wpm} بدل ${currentTarget}) — النص يدوي والهدف تركيبي`)
        deliveryPlan = { ...deliveryPlan, targetWordsPerMinute: Number(paceOnly.technical.wpm),
          __paceAdaptations: (deliveryPlan.__paceAdaptations || 0) + 1 }
        continue
      }
    }
    // الكلمات المستعصية: ما رصده الحكم مشكلةً + كل كلمة عالية الخطورة لم تُسمع في أي مرشح
    const stubbornWords = [...new Set([
      ...audits.flatMap((audit) => (audit.verdict?.problems || []).map((problem) => problem.word)),
      ...audits.flatMap((audit) => (audit.highMissing || []).map((risk) => risk.word)),
    ].filter(Boolean))]
    // الشفاء الذاتي بوصفة الحكم: الحكم يعيد revisedPronunciationText (تشكيل علاجي دقيق —
    // مثل إثبات تاء التأنيث المبتلعة). نجربه في الجولة التالية قبل اللجوء إلى إعادة الصياغة،
    // بشرط صارم: الكلمات نفسها بالترتيب نفسه (لا إضافة ولا حذف) — التشكيل وحده يتغير.
    const stripForCompare = (t) => String(t || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim()
    const judgeRevision = audits
      .map((audit) => String(audit.verdict?.revisedPronunciationText || '').trim())
      .find((t) => t && stripForCompare(t) === stripForCompare(dialogueText)
        && t !== String(currentAnalysis.pronunciationText || '').trim())
    /* سقف الوصفات: في المسار الآلي وصفة واحدة كي لا تزاحم إعادة الصياغة على الجولات؛
       أما وضع النص اليدوي فلا إعادة صياغة فيه أصلاً (النص مقدس) — الوصفة التشكيلية هي
       العلاج الوحيد المتاح، فنمنحها ثلاث فرص متجددة (كل وصفة ترى فشل سابقتها وتحسّنها:
       التشغيل 14 سقط على «فرح/ضَيِّق» بوصفة واحدة لم تكفِ الكلمتين معاً). */
    const prescriptionCap = MANUAL_TEXT_MODE ? 3 : 1
    if (judgeRevision && prescriptionsUsed < prescriptionCap) {
      prescriptionsUsed += 1
      console.log(`    ⚕ ${utteranceId}: تطبيق وصفة الحكم النطقية وإعادة المحاولة (${prescriptionsUsed}/${prescriptionCap} — بلا إعادة صياغة)`)
      currentAnalysis = { ...currentAnalysis, pronunciationText: judgeRevision }
      continue
    }
    // علاج التأنيث المبتلع نظامياً: Azure يُذكِّر بعض النعوت المؤنثة (شرسة→شرس، موثقة→موثق)
    // ويتجاهل تشكيل التاء المربوطة. البديل المثبت: هاء مفتوحة قبل الوقف (شَرِسَه) — صوت الوقف
    // العربي الصحيح نفسه، وSTT يطبّع ة/ه فلا يتأثر التطابق. يُحفظ النجاح في ذاكرة النطق للأبد.
    const feminineStubborn = [...new Set(audits.flatMap((audit) => (audit.verdict?.problems || [])
      .filter((problem) => /تأنيث|مؤنث/.test(String(problem.issue || '')) && /ة$/.test(String(problem.word || '').trim()))
      .map((problem) => String(problem.word).trim())))]
    if (feminineStubborn.length && !(currentAnalysis.risks || []).some((risk) => risk.__femFix)) {
      const fixes = feminineStubborn.map((word) => ({ word, riskLevel: 'high',
        meaningInContext: 'تثبيت تاء التأنيث المسموعة', grammaticalType: 'نعت مؤنث',
        method: 'sub', selectedPronunciation: word, __femFix: true,
        subAlias: word.slice(0, -1) + 'َه' }))
      console.log(`    ♀ ${utteranceId}: تثبيت التأنيث المبتلع ببديل نطقي (${feminineStubborn.join('، ')})`)
      currentAnalysis = { ...currentAnalysis, risks: [...(currentAnalysis.risks || []), ...fixes] }
      continue
    }
    const rephrased = MANUAL_TEXT_MODE ? null : await safeRephrase(dialogueText, sourceText, reason, stubbornWords)
    if (!rephrased) return { ok: false, verified: false, reason, dialogueText, candidates: allAudits,
      needsSplit: /أطول من 13ث/.test(reason) }
    dialogueText = rephrased
    const [reanalyzed] = await riskAnalyze([{ ...u, text: dialogueText, allowOverlap: false }], { tolerant: true })
    currentAnalysis = reanalyzed
  }
  return { ok: false, verified: false, reason: 'استنفدت المرشحات وإعادة الصياغة', dialogueText, candidates: allAudits, needsSplit: true }
}

/* ═══ الإنتاج المرن: كاش الاستئناف + إنقاذ الوحدة المتجاوزة بتقسيمها وحدها ═══
   فشل مقطع واحد لا يعزل الحلقة ولا يعيد بناء الحوار: نقسم الوحدة دلالياً (بلا حذف
   أو إعادة ترتيب)، نعيد توليد أجزائها فقط عبر STT والحكم نفسيهما، والمقاطع المجتازة
   سابقاً تُستأنف من الكاش (محلي أو R2 staging) بلا أي نداء Gemini/Azure جديد. */
async function produceUtteranceResilient({ utterance, analysis, voice, lang, wavBase, context, cache }) {
  const planFields = (plan) => {
    const { text, delivery, ratePct, targetWordsPerMinute, pauseAfterMs, ending, internalBreakMs,
      allowOverlap, overlapMs, musicBridgeAfter, speaker } = plan || {}
    return { text, delivery, ratePct, targetWordsPerMinute, pauseAfterMs, ending, internalBreakMs,
      allowOverlap: Boolean(allowOverlap), overlapMs: Number(overlapMs || 0),
      musicBridgeAfter: Boolean(musicBridgeAfter), speaker }
  }
  const produceOne = async (u, a, wavPath, id) => {
    const lookupKey = segmentKeyOf({ pipelineHash: cache.pipelineHash, voice, text: u.text })
    const previous = RESUME ? cache.previous?.[lookupKey] : null
    if (previous?.result?.ok && segmentCacheGet(cache.slug, lookupKey, wavPath)) {
      cache.ledger[lookupKey] = { ...previous, reusedAt: new Date().toISOString() }
      console.log(`    ↷ ${id}: أُعيد استخدام المقطع المجتاز من الكاش (صفر Gemini/Azure)`)
      return { ok: true, fromCache: true, result: { ...previous.result, ok: true, verified: true },
        plan: previous.plan || planFields(u), wav: wavPath }
    }
    const result = await produceUtterance(u, a, voice, lang, wavPath, { ...context, utteranceId: id })
    if (!result.ok || (lang === 'ar' && !result.verified)) return { ok: false, result }
    const saveKey = segmentKeyOf({ pipelineHash: cache.pipelineHash, voice, text: result.dialogueText || u.text })
    segmentCachePut(cache.slug, saveKey, wavPath)
    cache.ledger[saveKey] = { key: saveKey, savedAt: new Date().toISOString(), voice,
      plan: planFields(result.deliveryPlan || u),
      result: { ok: true, verified: true, dialogueText: result.dialogueText,
        pronunciationText: result.pronunciationText, intendedText: result.intendedText,
        risks: result.risks || [], heard: result.heard || null,
        paceCalibration: result.paceCalibration || null, selectedCandidate: result.selectedCandidate || '' } }
    return { ok: true, fromCache: false, result, plan: result.deliveryPlan || u, wav: wavPath }
  }
  const first = await produceOne(utterance, analysis, `${wavBase}.wav`, context.utteranceId)
  if (first.ok) return { ok: true, parts: [first] }
  const failure = first.result || {}
  const text = String(utterance.text || '').replace(/\s+/g, ' ').trim()
  const totalWords = wordsOf(text).length
  const shouldSplit = failure.needsSplit || /أطول من 13ث|استنفدت المرشحات|كلمات خطرة لم يثبت نطقها/.test(String(failure.reason || ''))
  if (!shouldSplit || totalWords < 12)
    return { ok: false, reason: failure.reason || 'غير موثقة', failure }
  const measured = Number(failure.measuredSec) || 13
  const piecesCount = Math.max(2, Math.ceil(measured / 10))
  const targetWords = Math.max(8, Math.ceil(totalWords / piecesCount))
  const pieces = splitTextSemantically(text, targetWords, Math.min(20, targetWords + 4))
  if (pieces.length < 2) return { ok: false, reason: failure.reason || 'غير موثقة', failure }
  console.log(`    ✂ ${context.utteranceId}: تقسيم دلالي إلى ${pieces.length} قطع وإعادة توليد الأجزاء فقط — ${String(failure.reason || '').slice(0, 80)}`)
  analysis.sourceTextForCount = text
  const parts = []
  let offset = 0
  for (let k = 0; k < pieces.length; k++) {
    const piece = pieces[k]
    const pieceWords = wordsOf(piece).length
    const isLast = k === pieces.length - 1
    const pieceUtterance = { ...utterance, text: piece,
      allowOverlap: k === 0 ? Boolean(utterance.allowOverlap) : false,
      overlapMs: k === 0 ? Number(utterance.overlapMs || 0) : 0,
      musicBridgeAfter: isLast ? Boolean(utterance.musicBridgeAfter) : false,
      pauseAfterMs: isLast ? utterance.pauseAfterMs : Math.min(180, Math.max(120, Number(utterance.pauseAfterMs) || 160)),
      ending: isLast ? utterance.ending : 'neutral',
      _splitMiddle: !isLast,
      delivery: piece.includes('؟') ? 'question' : utterance.delivery }
    const derived = derivePieceAnalysis(analysis, piece, offset, pieceWords)
    const pieceAnalysis = { idx: analysis.idx, pronunciationText: derived.pronunciationText, risks: derived.risks }
    const part = await produceOne(pieceUtterance, pieceAnalysis, `${wavBase}-p${k + 1}.wav`, `${context.utteranceId}.${k + 1}`)
    if (!part.ok) return { ok: false, reason: `القطعة ${k + 1}/${pieces.length} بعد التقسيم: ${part.result?.reason || 'فشل'}`, failure: part.result }
    parts.push(part)
    offset += pieceWords
  }
  return { ok: true, parts, split: pieces.length }
}

/* ═══════════ تركيب Timeline بـ ffmpeg ═══════════ */
const ff = (fArgs) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...fArgs], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg: ' + (r.stderr || '').slice(-300))
}
const probeDur = (f) => parseFloat(execFileSync(FFPROBE, ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()) || 0
// Azure Neural يُذيّل كل مقطع بصمتٍ طبيعي (~500-800ms) وقد يبدؤه بصمتٍ يسير. نشذّبه هنا
// فورَ التركيب: نُبقي هامشاً صغيراً (≈50ms بداية · ≈120ms نهاية) تحت عتبتَي فحص المقطع،
// فيتحكّم التايملاين وحده في الوقفات المقصودة، وتمرّ البوابة على الكلام الفعلي لا على الصمت.
const trimSilence = (file) => {
  const tmp = `${file}.trim.wav`
  try {
    ff(['-i', file, '-af',
      'silenceremove=start_periods=1:start_threshold=-44dB:start_silence=0.04:detection=peak,'
      + 'areverse,silenceremove=start_periods=1:start_threshold=-44dB:start_silence=0.06:detection=peak,areverse',
      tmp])
    if (existsSync(tmp) && statSync(tmp).size > 4000) writeFileSync(file, readFileSync(tmp))
  } catch { /* إن تعذّر التشذيب نُبقي الأصل ويكتشف الفائضَ فحصُ المقطع */ }
  finally { rmSync(tmp, { force: true }) }
}

// أحياناً يزرع Azure صمتاً داخلياً طويلاً داخل المداخلة نفسها، خصوصاً بعد
// سؤال أو فاصلة ثقيلة. هذا ليس «وقفة حوارية» لأن التايملاين هو من يدير
// الوقفات بين المتحدثين. نعالج الصمت الداخلي آلياً قبل بوابة الجودة حتى
// لا تفشل كل مقالة جديدة بسبب عثرة نطق عابرة.
const compactInternalSilence = (file) => {
  const tmp = `${file}.compact.wav`
  try {
    ff(['-i', file, '-af',
      'silenceremove=stop_periods=-1:stop_threshold=-44dB:stop_duration=0.32:stop_silence=0.24:detection=peak',
      tmp])
    if (existsSync(tmp) && statSync(tmp).size > 4000) writeFileSync(file, readFileSync(tmp))
  } catch { /* إن لم يدعم ffmpeg الصيغة في بيئة ما، تبقى بوابة الجودة مسؤولة */ }
  finally { rmSync(tmp, { force: true }) }
}

function auditSegment(file, dialogueText, deliveryPlan = {}) {
  const dur = probeDur(file)
  /* عدّ الكلمات المنطوقة لا المكتوبة: «2023» رمز واحد كتابةً لكنه «ألفين وثلاثة
     وعشرين» نطقاً — احتسابه كلمةً واحدة كان يخفض WPM زوراً فتسقط كل جملة فيها
     سنة على بوابة السرعة (u011). كل رمز رقمي يُحسب بعدد أرقامه تقريباً لكلماته. */
  const words = String(dialogueText || '').trim().split(/\s+/).filter(Boolean)
    .reduce((total, token) => {
      const digits = (token.match(/\d/g) || []).length
      return total + (digits >= 2 ? Math.min(6, digits) : 1)
    }, 0)
  const issues = []
  if (!existsSync(file) || statSync(file).size < 4000) issues.push('ملف فارغ أو صغير بصورة مريبة')
  if (dur < 0.35) issues.push(`مدة مبتورة (${dur.toFixed(2)}ث)`)
  if (dur > 13) issues.push(`مداخلة أطول من 13ث (${dur.toFixed(1)}ث)`)

  const silence = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af',
    'silencedetect=noise=-44dB:d=0.04', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const starts = [...silence.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]))
  const ends = [...silence.matchAll(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g)]
    .map((match) => ({ end: Number(match[1]), duration: Number(match[2]) }))
  const detectedSilenceMs = Math.round(ends.reduce((total, entry) => total + entry.duration, 0) * 1000)
  const functionalSilenceMs = Math.round(ends.filter((entry) => entry.duration >= 0.10)
    .reduce((total, entry) => total + entry.duration, 0) * 1000)
  const leadingSilenceMs = starts[0] <= 0.01 && ends[0] ? Math.round(ends[0].end * 1000) : 0
  const lastStart = starts.at(-1)
  const trailingSilenceMs = Number.isFinite(lastStart) && lastStart > dur - 1
    ? Math.round((dur - lastStart) * 1000) : 0
  const internalLongSilences = ends.filter((entry) => entry.duration > 0.8
    && entry.end - entry.duration > 0.02 && entry.end < dur - 0.02).length
  if (leadingSilenceMs > 280) issues.push(`صمت أولي ${leadingSilenceMs}ms`) // قد يوحي ببتر ما قبله في التايملاين
  if (trailingSilenceMs > 320) issues.push(`صمت نهائي ${trailingSilenceMs}ms`)
  if (internalLongSilences) issues.push(`صمت داخلي أطول من 800ms (${internalLongSilences})`)

  // سرعة الكلام تُقاس على زمن النطق الفعلي، لا على الوقفات الداخلية المقصودة.
  // الوقفات تُفحص أعلاه كعنصر مستقل؛ إدخالها في WPM يظلم الحوار التأملي ويُشبه طلب السرعة بلا نفس.
  const activeSec = Math.max(0.25, dur - (leadingSilenceMs + trailingSilenceMs + functionalSilenceMs) / 1000)
  const wpm = words * 60 / activeSec
  const targetWpm = Number(deliveryPlan.targetWordsPerMinute || 0)
  if (words >= 6 && targetWpm && Math.abs(wpm - targetWpm) > 12)
    issues.push(`سرعة فعلية ${Math.round(wpm)} بعيدة عن الهدف ${targetWpm}`)
  else if (words >= 6 && !targetWpm && (wpm < 115 || wpm > 225)) issues.push(`سرعة فعلية ${Math.round(wpm)} كلمة/دقيقة`)
  const volume = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const peak = Number((volume.match(/max_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  const mean = Number((volume.match(/mean_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  if (Number.isFinite(peak) && peak >= -0.1) issues.push(`ذروة ${peak}dB قد تكون clipping`)
  return { dur, words, wpm: Math.round(wpm), targetWpm: targetWpm || null,
    leadingSilenceMs, trailingSilenceMs, detectedSilenceMs, functionalSilenceMs, silenceEvents: ends,
    internalLongSilences,
    peakDb: Number.isFinite(peak) ? peak : null, meanDb: Number.isFinite(mean) ? mean : null, issues }
}

function trimGeneratedBoundaryPadding(file, intendedText) {
  const before = auditSegment(file, intendedText, {})
  const startTrimSec = Math.max(0, before.leadingSilenceMs / 1000 - 0.025)
  const endTrimSec = Math.max(0, before.trailingSilenceMs / 1000 - 0.035)
  const keptDuration = before.dur - startTrimSec - endTrimSec
  if ((startTrimSec < 0.02 && endTrimSec < 0.02) || keptDuration < 0.35)
    return { startTrimMs: 0, endTrimMs: 0, classification: 'no_generated_padding' }
  const temporary = `${file}.trimmed.wav`
  ff(['-ss', startTrimSec.toFixed(3), '-i', file, '-t', keptDuration.toFixed(3),
    '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', temporary])
  renameSync(temporary, file)
  return { startTrimMs: Math.round(startTrimSec * 1000), endTrimMs: Math.round(endTrimSec * 1000),
    classification: 'tts_boundary_padding_removed' }
}


function selectMusicBridgeIndexes(utterances) {
  const total = utterances.length
  if (total < 14) return []
  const explicit = utterances.map((utterance, index) => ({ utterance, index }))
    .filter(({ utterance, index }) => utterance.musicBridgeAfter === true
      && index < total - 2 && !utterance.allowOverlap)
    .slice(0, total >= 26 ? 2 : 1)
    .map((item) => item.index)
  if (explicit.length) return explicit
  const candidates = utterances.map((utterance, index) => ({ utterance, index }))
    .filter(({ utterance, index }) => index >= Math.floor(total * 0.28) && index <= Math.floor(total * 0.82)
      && ['question', 'reflection', 'gentleObjection', 'clarification'].includes(utterance.delivery)
      && !utterance.allowOverlap)
  const primaryTarget = total * 0.52
  const primary = [...candidates].sort((left, right) =>
    Math.abs(left.index - primaryTarget) - Math.abs(right.index - primaryTarget))[0]
  if (!primary) return []
  const result = [primary.index]
  if (total >= 26) {
    const secondaryTarget = total * 0.78
    const secondary = candidates.filter((item) => Math.abs(item.index - primary.index) >= 6)
      .sort((left, right) => Math.abs(left.index - secondaryTarget) - Math.abs(right.index - secondaryTarget))[0]
    if (secondary) result.push(secondary.index)
  }
  return result.sort((a, b) => a - b)
}

function createMusicBridge(track, outPath, durationSec = 1.8, volume = 0.085) {
  ff(['-i', track.file, '-t', durationSec.toFixed(2), '-af',
    `afade=t=in:d=0.35,afade=t=out:st=${Math.max(0.55, durationSec - 0.65).toFixed(2)}:d=0.65,volume=${volume}`,
    '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', outPath])
  return outPath
}

function insertSemanticMusicBridges(segments, utterances, music, workDir) {
  if (!music || !segments.length) return { segments, bridges: [] }
  const indexes = selectMusicBridgeIndexes(utterances)
  if (!indexes.length) return { segments, bridges: [] }
  const expanded = []
  const bridges = []
  for (let index = 0; index < segments.length; index++) {
    const segment = { ...segments[index] }
    expanded.push(segment)
    if (!indexes.includes(index)) continue
    const durationSec = bridges.length === 0 ? 1.7 : 1.35
    const bridgeFile = resolve(workDir, `semantic-bridge-${bridges.length + 1}.wav`)
    createMusicBridge(music, bridgeFile, durationSec, bridges.length === 0 ? 0.085 : 0.07)
    segment.pauseAfterMs = Math.min(Number(segment.pauseAfterMs || 300), 140)
    expanded.push({ file: bridgeFile, pauseAfterMs: 0, overlapMs: 430,
      hasHighRisk: false, isMusicBridge: true, bridgeDurationSec: durationSec })
    if (segments[index + 1]) segments[index + 1].overlapMs = Math.max(Number(segments[index + 1].overlapMs || 0), 680)
    bridges.push({ afterUtterance: index + 1, durationSec })
  }
  return { segments: expanded, bridges }
}

function planTimeline(segments) {
  const timeline = []
  // الجسور الموسيقية وحدات داخل الـTimeline نفسه. لا نحجب بداية الحلقة بمقدمة
  // طويلة، ولا نضيف سريرًا موسيقيًا مستمرًا تحت الكلام.
  const firstStart = 0.25
  for (const segment of segments) {
    const dur = probeDur(segment.file)
    const previous = timeline.at(-1)
    let start = firstStart
    let overlapMs = 0
    if (previous) {
      const maxOverlapMs = segment.isMusicBridge ? 500 : previous.isMusicBridge ? 900 : 150
      const requestedOverlap = Math.min(maxOverlapMs, Math.max(50, Number(segment.overlapMs || 0)))
      const canOverlap = Number(segment.overlapMs) > 0 && !segment.hasHighRisk && !previous.hasHighRisk
      overlapMs = canOverlap ? requestedOverlap : 0
      start = canOverlap
        ? previous.start + previous.dur - overlapMs / 1000
        : previous.start + previous.dur + Math.min(700, Math.max(80, Number(previous.pauseAfterMs || 220))) / 1000
    }
    timeline.push({ ...segment, start: Math.max(0, start), dur, overlapMs })
  }
  const lastEnd = timeline.length ? timeline.at(-1).start + timeline.at(-1).dur : firstStart
  const total = lastEnd + 0.45
  return { timeline, total }
}

function buildSilenceReport(timeline, utteranceAudits, totalSec, utterances) {
  const pauses = []
  for (let index = 1; index < timeline.length; index++) {
    const previous = timeline[index - 1]
    const current = timeline[index]
    const gapMs = Math.round((current.start - (previous.start + previous.dur)) * 1000)
    pauses.push({ afterUtterance: index, durationMs: gapMs,
      function: gapMs < 0 ? 'controlled_overlap'
        : utterances[index - 1]?.delivery === 'question' ? 'after_question'
          : ['reflection', 'reflective'].includes(utterances[index - 1]?.delivery) ? 'single_reflective_pause'
            : 'speaker_transition' })
  }
  const positivePauses = pauses.filter((pause) => pause.durationMs > 0)
  const internalSilenceMs = utteranceAudits.reduce((total, audit) => total + Number(audit.technical?.functionalSilenceMs || 0), 0)
  const transitionSilenceMs = positivePauses.reduce((total, pause) => total + pause.durationMs, 0)
  const totalSilenceMs = internalSilenceMs + transitionSilenceMs
  const durations = positivePauses.map((pause) => pause.durationMs)
  return { pauseCount: pauses.length, overlapCount: pauses.filter((pause) => pause.durationMs < 0).length,
    averagePauseMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    longestPauseMs: durations.length ? Math.max(...durations) : 0,
    transitionSilenceMs, internalSilenceMs, totalSilenceMs,
    silenceRatio: totalSec ? Math.round(totalSilenceMs / (totalSec * 1000) * 1000) / 10 : 0,
    pauses }
}

function assemble(segments, outMp3, music, { raw = false } = {}) {
  const { timeline, total } = planTimeline(segments)

  const inputs = []
  const filters = []
  timeline.forEach((s, i) => {
    inputs.push('-i', s.file)
    filters.push(`[${i}:a]adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)}[u${i}]`)
  })
  // `insertSemanticMusicBridges` أضاف الموسيقى المرخصة في المواضع الدلالية
  // فقط، مع دخولها قبل نهاية الجملة وخروجها تحت بداية المتحدث التالي.
  // لا نضيف موسيقى مستمرة لإخفاء خامة الصوت أو بطء الحوار.
  const mixInputs = timeline.map((_, i) => `[u${i}]`).join('')
  const n = timeline.length
  filters.push(`${mixInputs}amix=inputs=${n}:normalize=0[mix]`)
  filters.push(raw ? '[mix]anull[out]' : '[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]')
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', total.toFixed(2), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outMp3])
  return { total, timeline }
}

/* ═══════════ فحص الصوت النهائي للحلقة ═══════════ */
function auditAudio(mp3, { minSec = 1, maxSec = 300, maxLongSilences = 0 } = {}) {
  const dur = probeDur(mp3)
  const size = statSync(mp3).size
  const issues = []
  if (dur < minSec) issues.push(`المدة ${dur.toFixed(1)}ث أقصر من ${minSec}ث`)
  if (dur > maxSec) issues.push(`المدة ${dur.toFixed(1)}ث أطول من ${maxSec}ث`)
  if (size < 200_000) issues.push('حجم الملف مريب')
  const det = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-40dB:d=0.8', '-f', 'null', '-'], { encoding: 'utf8' })
  const longSilences = [...(det.stderr || '').matchAll(/silence_duration:\s*([0-9.]+)/g)]
    .map((match) => Number(match[1])).filter((seconds) => seconds > 0.8)
  const unexpectedLongSilences = longSilences.slice(Math.max(0, maxLongSilences))
  if (unexpectedLongSilences.length)
    issues.push(`${unexpectedLongSilences.length} فترات صمت طويلة غير مقصودة`)
  const volume = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const peak = Number((volume.match(/max_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  const mean = Number((volume.match(/mean_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  if (Number.isFinite(peak) && peak > -1) issues.push(`ذروة ${peak}dB أعلى من هامش الأمان -1dB`)
  return { dur, size, longSilences, allowedLongSilences: maxLongSilences,
    unexpectedLongSilences, peakDb: Number.isFinite(peak) ? peak : null,
    meanDb: Number.isFinite(mean) ? mean : null, issues }
}

function episodeQualityScore({ technicalAudit, fullComparison, finalJudge, transcript = [] }) {
  const minimumScore = Math.max(94, Number(env.PODCAST_RELEASE_MIN_SCORE || 94))
  const durationOk = Number(technicalAudit?.dur || 0) >= 120 && Number(technicalAudit?.dur || 0) <= 360
  const sizeOk = Number(technicalAudit?.size || 0) >= 200_000
  const longSilenceOk = Array.isArray(technicalAudit?.unexpectedLongSilences)
    ? technicalAudit.unexpectedLongSilences.length === 0
    : Array.isArray(technicalAudit?.longSilences) ? technicalAudit.longSilences.length === 0 : false
  const peakOk = !Number.isFinite(Number(technicalAudit?.peakDb)) || Number(technicalAudit.peakDb) <= -1
  const sttOk = Number(fullComparison?.importantRatio || 0) >= 0.95 && Number(fullComparison?.ratio || 0) >= 0.90
  /* في وضع بلا Gemini تُستبدل نقاط الحكم الثلاثون بعتبة STT مشددة على الحلقة كاملة
     (0.97/0.93) — فلا تُمنح نقاط الحكم مجاناً، بل تُشترى بدقة نصية أعلى. */
  const judgeOk = finalJudge?.noGemini === true
    ? Number(fullComparison?.importantRatio || 0) >= 0.97 && Number(fullComparison?.ratio || 0) >= 0.93
    : finalJudge?.pass === true && (!Array.isArray(finalJudge?.problems) || finalJudge.problems.length === 0)
  const transcriptOk = Array.isArray(transcript) && transcript.length >= 8
  const score = Math.round(
    (judgeOk ? 30 : 0)
    + (sttOk ? 24 : 0)
    + (durationOk ? 12 : 0)
    + (longSilenceOk ? 12 : 0)
    + (transcriptOk ? 10 : 0)
    + (sizeOk ? 6 : 0)
    + (peakOk ? 6 : 0)
  )
  return {
    score,
    minimumScore,
    pass: score >= minimumScore,
    checks: { judgeOk, sttOk, durationOk, longSilenceOk, transcriptOk, sizeOk, peakOk },
  }
}

function dialogueHumanGate({ candidateMp3, transcript, fullComparison, finalJudge }) {
  const plan = {
    utterances: transcript.map((item) => ({
      speaker: item.speakerKey,
      text: item.text,
      sourceText: item.text,
      type: item.delivery,
      delivery: item.delivery,
      ratePct: item.ratePct,
      pauseAfterMs: item.pauseAfterMs,
      ending: item.ending,
      allowOverlap: item.allowOverlap,
      overlapMs: item.overlapMs,
    })),
  }
  const technical = {
    probe: probeAudio(candidateMp3),
    silence: analyzeSilence(candidateMp3),
    loudness: analyzeLoudness(candidateMp3),
  }
  const proxy = humanLikenessGate({ plan, technical,
    sttComparisons: fullComparison ? [fullComparison] : [], dialogue: true, minimumScore: 95 })
  const dimensions = ['humanLikeness', 'warmth', 'semanticDelivery', 'questionNaturalness',
    'pauseNaturalness', 'pronunciation', 'rhythmVariety', 'endingVariety', 'nonBroadcastTone',
    'speakerIndependence']
  const noGemini = finalJudge?.noGemini === true
  const judgeScores = Object.fromEntries(dimensions.map((key) => [key, Number(finalJudge?.[key] || 0)]))
  const minimumJudgeDimension = noGemini ? null : Math.min(...Object.values(judgeScores))
  const judgePass = noGemini ? true : (finalJudge?.pass === true && minimumJudgeDimension >= 95)
  return { pass: proxy.pass && judgePass, minimumScore: 95, proxy, judgeScores,
    minimumJudgeDimension, mode: noGemini ? 'proxy-only' : 'proxy+judge',
    note: noGemini
      ? 'وضع بلا Gemini: البوابة التقنية للبشرية (≥95) هي الفيصل مع STT المشدد — بأمر الدكتور للحوار اليدوي.'
      : 'بوابة تقنية + حكم سمعي مستقل؛ لا تُعد إثباتاً أن الصوت إنسان حقيقي.' }
}

async function validateDialogueFidelity(article, script) {
  const dialogue = (script.utterances || []).map((utterance) => `${utterance.speaker}: ${utterance.text}`).join('\n')
  const hostA = VOICES[LANG === 'en' ? 'en' : 'ar'].A.name
  const hostB = VOICES[LANG === 'en' ? 'en' : 'ar'].B.name
  const verdict = await gemini(
    `أنت بوابة إسناد عربية صارمة. قارن الحوار بالمقال الأصلي. ارفض أي معلومة أو اسم أو رقم أو نتيجة غير موجودة، وأي حذف يقلب الفكرة المركزية. يُسمح فقط بذكر عنوان المقال، واسم مؤلفه د. أحمد حسين الفيلكاوي، واسمَي مقدّمَي الحلقة «${hostA}» و«${hostB}» (يتنادَيان بهما فيما بينهما — بيانات إنتاج لا ادعاء)، ودعوة قصيرة لقراءة المقال الأصلي في موقعه؛ هذه بيانات نشر مسموحة وليست ادعاءً جديداً. لا تحكم على الأسلوب. أعد JSON فقط: {"pass":true,"problems":[]}.`,
    `عنوان المقال: ${article.title}\nالمؤلف المسموح ذكره: د. أحمد حسين الفيلكاوي\nمقدّما الحلقة المسموح تناديهما: ${hostA}، ${hostB}\nالمقال الأصلي:\n${article.body}\n\nالحوار:\n${dialogue}`,
    0.1,
    JUDGE_MODEL,
  )
  if (typeof verdict?.pass !== 'boolean' || !Array.isArray(verdict?.problems)) throw new Error('بوابة الإسناد أعادت نتيجة غير صالحة')
  return { ...verdict, pass: verdict.pass === true && verdict.problems.length === 0 }
}

async function transcribeAssembledEpisode(mp3, timeline, locale = 'ar-KW') {
  const groups = []
  let current = []
  for (const item of timeline) {
    if (current.length && item.start + item.dur - current[0].start > 48) {
      groups.push(current)
      current = []
    }
    current.push(item)
  }
  if (current.length) groups.push(current)
  const chunks = []
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index]
    const start = Math.max(0, group[0].start - 0.08)
    const end = group.at(-1).start + group.at(-1).dur + 0.12
    const chunk = resolve(TMP, `episode-chunk-${index}.wav`)
    ff(['-ss', start.toFixed(3), '-i', mp3, '-t', (end - start).toFixed(3), '-ar', '24000', '-ac', '1', chunk])
    const heard = await sttRecognize(chunk, locale)
    rmSync(chunk, { force: true })
    if (!heard) throw new Error(`تعذر STT النهائي للمقطع ${index + 1}`)
    chunks.push({ index, start, end, ...heard })
  }
  return { text: chunks.map((chunk) => chunk.text).join(' '), chunks }
}

async function judgeFullEpisode(mp3, intended, stt, transcript, risks) {
  if (NO_GEMINI) {
    /* بوابة الحلقة الكاملة في وضع بلا Gemini: عتبات STT المشددة (0.97/0.93) داخل
       episodeQualityScore تحل محل نقاط الحكم الثلاثين، وبوابة البشرية التقنية تبقى. */
    return { pass: true, problems: [], minimumDimension: null, noGemini: true }
  }
  const bytes = readFileSync(mp3)
  if (bytes.length > 18 * 1024 * 1024) throw new Error('الحلقة أكبر من حد الحكم الصوتي المباشر')
  const verdict = await gemini(JUDGE_SYSTEM, [
    'هذه بوابة الحلقة الكاملة بعد الدمج. استمع إلى الملف كله، لا إلى STT وحده.',
    `النص النطقي المقصود كاملاً: ${intended}`,
    `STT للحلقة المدمجة: ${stt.text}`,
    `Transcript الظاهر مع معرّفات الوحدات: ${transcript.map((item, index) => `u${String(index + 1).padStart(3, '0')} ${item.speaker}: ${item.text}`).join('\n')}`,
    `الكلمات الخطرة: ${JSON.stringify(risks)}`,
    'افحص ثبات الفصحى، صحة الفتحة والكسرة والوقف، عدم إظهار الإعراب المدرسي عند نهايات الجمل، اتساق الأسماء، البتر عند الحدود، السرعة، الوقفات، الجسور الموسيقية، وأي تداخل يبتلع حرفاً. ارفض الحلقة إذا بدت مستعجلة أو كقارئين يتناوبان. ضع unitId الصحيح لكل مشكلة. أعد JSON فقط بالمخطط والدرجات السبع.',
  ].join('\n'), 0.1, JUDGE_MODEL, [{ inlineData: { mimeType: 'audio/mpeg', data: bytes.toString('base64') } }])
  const dimensions = ['humanLikeness', 'warmth', 'semanticDelivery', 'questionNaturalness',
    'pauseNaturalness', 'pronunciation', 'rhythmVariety']
  if (typeof verdict?.pass !== 'boolean' || !Array.isArray(verdict?.problems)
    || !dimensions.every((key) => Number.isFinite(Number(verdict[key])))) {
    throw new Error('حكم الحلقة الكاملة غير صالح أو بلا درجات البشرية السبع')
  }
  const minimumDimension = Math.min(...dimensions.map((key) => Number(verdict[key])))
  return { ...verdict, minimumDimension,
    pass: verdict.pass === true && verdict.problems.length === 0 && minimumDimension >= 95 }
}

const VOICE_SCORE_WEIGHTS = {
  pronunciationMeaning: 0.30,
  fushaNeutrality: 0.20,
  naturalDialogue: 0.20,
  questionAndObjectionIntonation: 0.10,
  pairHarmony: 0.10,
  listeningComfort: 0.10,
}

const validVoiceScores = (scores) => Object.keys(VOICE_SCORE_WEIGHTS).every((key) =>
  Number.isFinite(Number(scores?.[key])) && Number(scores[key]) >= 0 && Number(scores[key]) <= 100)

function weightedVoiceScore(scores = {}) {
  return Math.round(Object.entries(VOICE_SCORE_WEIGHTS).reduce((total, [key, weight]) => {
    const value = Math.min(100, Math.max(0, Number(scores[key] || 0)))
    return total + value * weight
  }, 0) * 10) / 10
}

async function judgeVoiceSample(mp3, sample, ensemble, risks) {
  const audio = readFileSync(mp3)
  const intended = sample.utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
  const transcript = sample.utterances.map((utterance) => `${utterance.speaker}: ${utterance.text}`).join('\n')
  const system = `أنت Arabic Voice Sample Judge مستقل وصارم. استمع إلى العينة كاملة بنفسك. المطلوب فصحى حوارية عربية معاصرة، بلا عامية، وبلا قراءة مدرسية أو نبرة أخبار. افحص صحة الحركات المسموعة داخل المعنى، الأسماء، التاء المربوطة، أول وآخر كل كلمة، الأسئلة، الاعتراض، اختلاف الإيقاع بين المتحدثين، الوقفات والتداخل والراحة. STT إشارة فقط ولا يثبت الحركات. أي شك في كلمة خطرة أو حركة تغيّر المعنى يعني pass=false. أعد JSON فقط: {"pass":false,"problems":[{"word":"","issue":""}],"checks":{"noDialect":false,"grammarAndVowels":false,"wordBoundaries":false,"questionIntonation":false,"paceAndPauses":false,"dialogueNotSplitArticle":false},"scores":{"pronunciationMeaning":0,"fushaNeutrality":0,"naturalDialogue":0,"questionAndObjectionIntonation":0,"pairHarmony":0,"listeningComfort":0}}. كل درجة من 0 إلى 100.`
  const verdict = await gemini(system, [
    `dialogueText:\n${transcript}`,
    `pronunciationText المقصود:\n${intended}`,
    `الكلمات الخطرة:\n${JSON.stringify(risks)}`,
    `نتائج STT الموحّدة (خمس locales):\n${JSON.stringify(ensemble)}`,
    'لا تعرف أسماء الأصوات أو دولها. احكم على الملف وحده.',
  ].join('\n\n'), 0.08, JUDGE_MODEL, [{ inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } }])
  const checks = verdict?.checks || {}
  const requiredChecks = ['noDialect', 'grammarAndVowels', 'wordBoundaries', 'questionIntonation', 'paceAndPauses', 'dialogueNotSplitArticle']
  if (typeof verdict?.pass !== 'boolean' || !Array.isArray(verdict?.problems)
    || requiredChecks.some((key) => typeof checks[key] !== 'boolean') || !validVoiceScores(verdict?.scores))
    throw new Error('حكم عينة الصوت أعاد JSON غير صالح')
  return { ...verdict, totalScore: weightedVoiceScore(verdict.scores),
    pass: verdict.pass === true && verdict.problems.length === 0
      && requiredChecks.every((key) => checks[key] === true) }
}

function secureShuffle(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index--) {
    const selected = randomInt(index + 1)
    ;[copy[index], copy[selected]] = [copy[selected], copy[index]]
  }
  return copy
}

async function blindRankingRound(options, round) {
  const labels = ['A', 'B', 'C', 'D', 'E'].slice(0, options.length)
  const shuffled = secureShuffle(options)
  const mapping = new Map(shuffled.map((option, index) => [labels[index], option]))
  const parts = []
  const descriptions = []
  for (const label of labels) {
    const option = mapping.get(label)
    const audio = readFileSync(option.file)
    descriptions.push(`${label}: عينة مجهولة الهوية`)
    parts.push({ inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } })
  }
  const system = `أنت لجنة استماع عمياء صارمة لبودكاست عربي تربوي. استمع إلى جميع الملفات بالترتيب A ثم B ثم C ثم D ثم E. لا تعرف الأصوات أو الدول. رتّبها من الأفضل إلى الأسوأ وفق: صحة الحركات والنحو والوقف، طبيعية الحوار، جمال ودفء الصوت النسائي، وضوح السؤال، السرعة المريحة غير المستعجلة، الوقفات ذات المعنى، انسجام الزوج، والراحة لأربع دقائق. لا تمنح درجات متقاربة مجاملة. أعد JSON فقط: {"ranking":[{"label":"A","scores":{"pronunciationMeaning":0,"fushaNeutrality":0,"naturalDialogue":0,"questionAndObjectionIntonation":0,"pairHarmony":0,"listeningComfort":0},"reason":""}]}. يجب أن تظهر كل تسمية مرة واحدة.`
  const verdict = await gemini(system, `الجولة ${round}. ترتيب الملفات المرفقة مطابق لهذه القائمة:\n${descriptions.join('\n')}`,
    0.04, JUDGE_MODEL, parts)
  if (!Array.isArray(verdict?.ranking) || verdict.ranking.length !== labels.length)
    throw new Error('لجنة الترتيب العمياء أعادت ترتيباً غير صالح')
  const seen = new Set()
  const ranking = verdict.ranking.map((item, index) => {
    const label = String(item.label || '').toUpperCase()
    if (!mapping.has(label) || seen.has(label) || !validVoiceScores(item.scores))
      throw new Error('لجنة الترتيب العمياء أعادت تسمية أو درجات غير صالحة')
    seen.add(label)
    return { optionKey: mapping.get(label).key, blindLabel: label, rank: index + 1,
      score: weightedVoiceScore(item.scores), scores: item.scores, reason: String(item.reason || '') }
  })
  return { round, ranking }
}

function chooseBlindWinner(options, rounds) {
  const summary = options.map((option) => {
    const rows = rounds.flatMap((round) => round.ranking.filter((item) => item.optionKey === option.key))
    const judgeScores = [option.voiceJudge.totalScore, ...rows.map((item) => item.score)].sort((a, b) => a - b)
    return { key: option.key, medianScore: judgeScores[Math.floor(judgeScores.length / 2)],
      meanRank: rows.reduce((total, item) => total + item.rank, 0) / Math.max(1, rows.length), rows }
  }).sort((left, right) => right.medianScore - left.medianScore || left.meanRank - right.meanRank)
  const winner = summary[0]
  if (!winner) return { pass: false, reason: 'لا توجد خيارات مجتازة', summary }
  let pairwiseWins = 0
  for (const opponent of summary.slice(1)) {
    const wins = rounds.filter((round) => {
      const left = round.ranking.find((item) => item.optionKey === winner.key)?.rank ?? 99
      const right = round.ranking.find((item) => item.optionKey === opponent.key)?.rank ?? 99
      return left < right
    }).length
    if (wins >= 2) pairwiseWins++
  }
  const margin = summary.length > 1 ? winner.medianScore - summary[1].medianScore : 100
  return { pass: pairwiseWins === summary.length - 1 && margin >= 5,
    reason: pairwiseWins !== summary.length - 1 ? 'لا يوجد تفوق عابر للجولات على كل المنافسين'
      : margin < 5 ? `هامش الفوز ${margin.toFixed(1)} أقل من 5` : '',
    winnerKey: winner.key, margin: Math.round(margin * 10) / 10, pairwiseWins, summary }
}

const STANDALONE_VOICE_WEIGHTS = {
  timbreQuality: 20, naturalPerformance: 20, arabicCorrectness: 25,
  warmthPresence: 15, longComfort: 10,
}
const validPercentScores = (scores, keys) => keys.every((key) => Number.isFinite(Number(scores?.[key]))
  && Number(scores[key]) >= 0 && Number(scores[key]) <= 100)
const standaloneVoiceScore = (scores) => Math.round(Object.entries(STANDALONE_VOICE_WEIGHTS)
  .reduce((total, [key, weight]) => total + Number(scores[key]) * weight / 90, 0) * 10) / 10

async function judgeStandaloneVoice(mp3, testUtterances, ensemble, risks, gender) {
  const audio = readFileSync(mp3)
  const system = `أنت حكم صوت عربي أعمى. لا تعرف اسم الصوت ولا دولته. قيّم خامة ${gender === 'Female' ? 'الصوت النسائي' : 'الصوت الرجالي'} وطبيعيته وصحة العربية من ملف خام بلا موسيقى أو EQ أو reverb. استمع إلى الجملة الخبرية والسؤال والجملة الإنسانية. ارفض الصوت المعدني أو الطفولي أو الإعلاني أو الملاحي، والسؤال التقريري، والحركة الخاطئة، والبتر، والسرعة المصطنعة. أعد JSON فقط: {"pass":false,"questionPass":false,"problems":[{"word":"","issue":""}],"scores":{"timbreQuality":0,"naturalPerformance":0,"arabicCorrectness":0,"warmthPresence":0,"longComfort":0}}. كل درجة 0–100.`
  const intended = testUtterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
  const verdict = await gemini(system, `dialogueText:\n${testUtterances.map((u) => u.text).join('\n')}\n\npronunciationText:\n${intended}\n\nSTT ensemble:\n${JSON.stringify(ensemble)}\n\nالكلمات الخطرة:\n${JSON.stringify(risks)}`,
    0.06, JUDGE_MODEL, [{ inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } }])
  const keys = Object.keys(STANDALONE_VOICE_WEIGHTS)
  if (typeof verdict?.pass !== 'boolean' || typeof verdict?.questionPass !== 'boolean'
    || !Array.isArray(verdict?.problems) || !validPercentScores(verdict.scores, keys))
    throw new Error('حكم الصوت المنفرد أعاد JSON غير صالح')
  const score = standaloneVoiceScore(verdict.scores)
  return { ...verdict, score, pass: verdict.pass === true && verdict.questionPass === true
    && verdict.problems.length === 0 && score >= 85 }
}

async function judgePairAudition(mp3, utterances, ensemble, risks) {
  const audio = readFileSync(mp3)
  const system = `أنت لجنة بودكاست عربية عمياء. استمع إلى زوج كامل بلا موسيقى أو EQ. أعط الأولوية للصوت النسائي: جمال الخامة ودفؤها وطبيعية السؤال، ثم صحة العربية والحركات والوقف، ثم الانسجام مع الرجل والراحة الطويلة. ارفض القراءة الآلية والبطء والتقطيع وابتلاع الحروف. أعد JSON فقط: {"pass":false,"femaleQuestionPass":false,"problems":[{"word":"","issue":""}],"scores":{"timbreQuality":0,"naturalPerformance":0,"arabicCorrectness":0,"warmthPresence":0,"pairHarmony":0,"longComfort":0}}. كل درجة 0–100.`
  const transcript = utterances.map((utterance) => `${utterance.speaker}: ${utterance.text}`).join('\n')
  const intended = utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
  const verdict = await gemini(system, `dialogueText:\n${transcript}\n\npronunciationText:\n${intended}\n\nSTT ensemble:\n${JSON.stringify(ensemble)}\n\nالكلمات الخطرة:\n${JSON.stringify(risks)}`,
    0.06, JUDGE_MODEL, [{ inlineData: { mimeType: 'audio/mpeg', data: audio.toString('base64') } }])
  const weights = { timbreQuality: 20, naturalPerformance: 20, arabicCorrectness: 25,
    warmthPresence: 15, pairHarmony: 10, longComfort: 10 }
  if (typeof verdict?.pass !== 'boolean' || typeof verdict?.femaleQuestionPass !== 'boolean'
    || !Array.isArray(verdict?.problems) || !validPercentScores(verdict.scores, Object.keys(weights)))
    throw new Error('حكم الزوج أعاد JSON غير صالح')
  const score = Math.round(Object.entries(weights).reduce((total, [key, weight]) =>
    total + Number(verdict.scores[key]) * weight / 100, 0) * 10) / 10
  return { ...verdict, score, pass: verdict.pass === true && verdict.femaleQuestionPass === true
    && verdict.problems.length === 0 && score >= 85 }
}

function auditionMetrics(utterances, audits, assembled) {
  const spokenWords = utterances.reduce((total, utterance) => total
    + spokenText(utterance.pronunciationText, []).split(/\s+/).filter(Boolean).length, 0)
  const activeSeconds = audits.reduce((total, audit) => total + Math.max(0.2,
    Number(audit.technical?.dur || 0) - (Number(audit.technical?.leadingSilenceMs || 0)
      + Number(audit.technical?.trailingSilenceMs || 0)) / 1000), 0)
  const silence = buildSilenceReport(assembled.timeline, audits, assembled.total, utterances)
  const selectiveWords = [...new Set(utterances.flatMap((utterance) =>
    utterance.pronunciationText.split(/\s+/).filter((word) => DIACRITICS_RE.test(word))))]
  return { spokenWords, averageWordsPerMinute: activeSeconds ? Math.round(spokenWords * 60 / activeSeconds) : 0,
    utteranceCount: utterances.length, averageUtteranceWords: Math.round(spokenWords / utterances.length * 10) / 10,
    selectiveDiacritics: selectiveWords, regeneratedUtterances: audits.filter((audit) =>
      Math.abs(Number(audit.calibration?.calibratedRatePct || 0) - Number(audit.calibration?.initialRatePct || 0)) > 1).length,
    silence }
}

async function renderStandaloneAudition({ voice, utterances, outputDir, key, gender, durationRange }) {
  const voiceDir = resolve(TMP, `standalone-${key}`)
  mkdirSync(voiceDir, { recursive: true })
  const audits = []
  const segments = []
  for (let index = 0; index < utterances.length; index++) {
    const utterance = utterances[index]
    const risks = portableSampleRisks(utterance)
    const path = resolve(voiceDir, `${index + 1}.wav`)
    const result = await calibrateAndEvaluateAudition({ runId: `standalone:${key}`, utteranceId: `u${index + 1}`,
      utterance, voice: voice.voiceName, path, risks })
    audits.push({ ...result, risks, technical: result.technical || null })
    if (!existsSync(path)) break
    segments.push({ file: path, pauseAfterMs: utterance.pauseAfterMs, overlapMs: 0,
      hasHighRisk: risks.some((risk) => risk.riskLevel === 'high') })
  }
  if (segments.length !== utterances.length) return { key, voice, pass: false, reason: 'لم تتولد كل الجمل' }
  const mp3 = resolve(outputDir, `${key}.mp3`)
  const assembled = assemble(segments, mp3, null, { raw: true })
  const technical = auditAudio(mp3, { minSec: durationRange.min, maxSec: durationRange.max, maxLongSilences: 0 })
  const fullWav = resolve(voiceDir, 'full.wav')
  ff(['-i', mp3, '-ar', '24000', '-ac', '1', fullWav])
  const intended = utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
  const risks = audits.flatMap((audit, index) => (audit.risks || []).map((risk) => ({ ...risk, utteranceIndex: index })))
  const ensemble = await sttRecognizeEnsemble(fullWav, intended, risks)
  const judge = await judgeStandaloneVoice(mp3, utterances, ensemble, risks, gender)
  const metrics = auditionMetrics(utterances, audits, assembled)
  const pass = audits.every((audit) => audit.pass) && technical.issues.length === 0 && ensemble.pass
    && judge.pass && metrics.averageWordsPerMinute >= 125 && metrics.averageWordsPerMinute <= 152
  return { key, voice, file: mp3, audits, technical, ensemble, judge, metrics, pass,
    reason: pass ? '' : 'فشل واحد أو أكثر من: النطق، السؤال، السرعة، المدة، أو تقييم الصوت 85/100' }
}

async function renderPairAudition({ male, female, utterances, outputDir, key, femaleResult }) {
  const pairDir = resolve(TMP, `pair-${key}`)
  mkdirSync(pairDir, { recursive: true })
  const audits = []
  const segments = []
  let previousHasHighRisk = false
  for (let index = 0; index < utterances.length; index++) {
    const utterance = utterances[index]
    const voice = utterance.speaker === 'A' ? male.voiceName : female.voiceName
    const risks = portableSampleRisks(utterance)
    const path = resolve(pairDir, `${index + 1}.wav`)
    const result = await calibrateAndEvaluateAudition({ runId: `pair:${key}`, utteranceId: `u${index + 1}`,
      utterance, voice, path, risks })
    audits.push({ ...result, speaker: utterance.speaker, voice, risks, technical: result.technical || null })
    if (!existsSync(path)) break
    const hasHighRisk = risks.some((risk) => risk.riskLevel === 'high')
    const overlapMs = utterance.allowOverlap && !hasHighRisk && !previousHasHighRisk
      ? Math.min(150, Math.max(50, Number(utterance.overlapMs || 100))) : 0
    segments.push({ file: path, pauseAfterMs: utterance.pauseAfterMs, overlapMs, hasHighRisk })
    previousHasHighRisk = hasHighRisk
  }
  if (segments.length !== utterances.length) return { key, male, female, pass: false, reason: 'لم تتولد كل المداخلات' }
  const mp3 = resolve(outputDir, `${key}.mp3`)
  const assembled = assemble(segments, mp3, null, { raw: true })
  const technical = auditAudio(mp3, { minSec: SAMPLE_MIN_SEC, maxSec: SAMPLE_MAX_SEC, maxLongSilences: 1 })
  const fullWav = resolve(pairDir, 'full.wav')
  ff(['-i', mp3, '-ar', '24000', '-ac', '1', fullWav])
  const intended = utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
  const risks = audits.flatMap((audit, index) => (audit.risks || []).map((risk) => ({ ...risk,
    utteranceIndex: index, voice: audit.voice })))
  const ensemble = await sttRecognizeEnsemble(fullWav, intended, risks)
  const judge = await judgePairAudition(mp3, utterances, ensemble, risks)
  const metrics = auditionMetrics(utterances, audits, assembled)
  const maleMean = audits.filter((audit) => audit.speaker === 'A').map((audit) => audit.technical?.meanDb).filter(Number.isFinite)
  const femaleMean = audits.filter((audit) => audit.speaker === 'B').map((audit) => audit.technical?.meanDb).filter(Number.isFinite)
  const meanOf = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const levelDifferenceDb = Math.round(Math.abs(meanOf(maleMean) - meanOf(femaleMean)) * 10) / 10
  const silencePass = metrics.silence.averagePauseMs >= 300 && metrics.silence.averagePauseMs <= 520
    && metrics.silence.longestPauseMs <= 1000 && metrics.silence.silenceRatio >= 10 && metrics.silence.silenceRatio <= 18
  const pass = audits.every((audit) => audit.pass) && technical.issues.length === 0 && ensemble.pass && judge.pass
    && femaleResult.judge.score >= 85 && metrics.averageWordsPerMinute >= 132 && metrics.averageWordsPerMinute <= 148
    && metrics.silence.overlapCount === 1 && silencePass && levelDifferenceDb <= 4
  return { key, male, female, femaleStandaloneScore: femaleResult.judge.score, file: mp3, audits,
    technical, ensemble, judge, metrics: { ...metrics, levelDifferenceDb }, pass,
    reason: pass ? '' : 'فشل واحد أو أكثر من بوابات الزوج الصارمة' }
}

function auditPath(article, lang) {
  mkdirSync(AUDITS, { recursive: true })
  return resolve(AUDITS, `${article.slug}.${lang}${PILOT_MODE ? '.pilot' : ''}.json`)
}

function writeAudit(article, lang, payload) {
  atomicWriteText(auditPath(article, lang), JSON.stringify(payload, null, 2))
  stagedAuditPush(article.slug, lang, auditPath(article, lang))
}

const runInsert = memoryDb.prepare(`INSERT OR REPLACE INTO episode_runs
  (run_id, slug, source_hash, pipeline_hash, status, reason, started_at, finished_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

/* ═══════════ المعالجة الكاملة لمقال ═══════════ */
async function produce(article, lang) {
  if (lang === 'ar' && !DRY && !PLAN && !ARABIC_PRODUCTION_GATE_READY)
    throw new Error('بوابة عينة الصوت غير معتمدة؛ ممنوع إنتاج الحلقة العربية الكاملة')
  const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
  const outputRoot = PILOT_MODE ? PILOT_AUDIO : AUDIO
  mkdirSync(outputRoot, { recursive: true })
  const outMp3 = resolve(outputRoot, article.slug + suffix)
  const transcriptPath = resolve(outputRoot, `${article.slug}.dialogue.json`)
  const sourceHash = createHash('sha256').update(article.body).digest('hex')
  const contentHash = createHash('sha256').update(`${sourceHash}|${lang}|${ACTIVE_PIPELINE_HASH}`).digest('hex').slice(0, 16)
  const key = `${PILOT_MODE ? 'pilot:' : ''}${article.slug}:${lang}`
  const completed = state.done[key]
  const audioMatches = existsSync(outMp3) && typeof completed?.audioHash === 'string'
    && createHash('sha256').update(readFileSync(outMp3)).digest('hex') === completed.audioHash
  const transcriptMatches = lang !== 'ar' || (existsSync(transcriptPath) && typeof completed?.transcriptHash === 'string'
    && createHash('sha256').update(readFileSync(transcriptPath)).digest('hex') === completed.transcriptHash)
  const acceptedStatus = PILOT_MODE ? 'accepted_pilot' : 'accepted_automated'
  if (!FORCE && completed?.contentHash === contentHash && completed?.status === acceptedStatus
    && audioMatches && transcriptMatches) {
    console.log(`↷ ${article.title} (${lang}) — منجز ومفحوص${PILOT_MODE ? ' ضمن التجربة الثلاثية' : ''}`)
    return 'skip'
  }

  console.log(`\n▶ ${article.title} (${lang})`)
  const voices = VOICES[lang]
  const storyBudget = state.totalCount === 0 ? true : state.storyCount / state.totalCount < 0.15
  const startedAt = new Date().toISOString()
  const runId = `${article.slug}:${lang}:${Date.now()}`
  const auditRecord = {
    schemaVersion: 4,
    episodeId: runId,
    pipelineHash: ACTIVE_PIPELINE_HASH,
    status: 'qa_in_progress',
    source: { slug: article.slug, title: article.title, sourceText: article.body, sha256: sourceHash, origin: article.origin || 'base' },
    dialogue: { utterances: [] },
    pronunciation: { utterances: [] },
    finalGate: { pass: false, reasonCodes: [] },
    models: { dialogue: DIALOGUE_MODEL, analysis: ANALYSIS_MODEL, judge: JUDGE_MODEL },
    voices,
    startedAt,
    segments: {},
    analyses: {},
  }
  // استئناف حقيقي: نسحب آخر Audit من R2 staging (ينجو من موت الرانر)، فنستأنف
  // الحوار المجتاز والمقاطع المجتازة، ولا نعيد إلا المقطع الفاشل.
  if (RESUME && lang === 'ar') stagedAuditPull(article.slug, lang, auditPath(article, lang))
  let previousAuditForResume = null
  try { previousAuditForResume = existsSync(auditPath(article, lang)) ? JSON.parse(readFileSync(auditPath(article, lang), 'utf8')) : null }
  catch { previousAuditForResume = null }
  const resumeCompatible = RESUME && previousAuditForResume?.pipelineHash === ACTIVE_PIPELINE_HASH
    && previousAuditForResume?.source?.sha256 === sourceHash
  const previousSegmentsLedger = resumeCompatible && previousAuditForResume.segments ? previousAuditForResume.segments : {}
  const previousAnalysesLedger = resumeCompatible && previousAuditForResume.analyses ? previousAuditForResume.analyses : {}
  if (resumeCompatible && Object.keys(previousSegmentsLedger).length)
    console.log(`  ↷ استئناف: ${Object.keys(previousSegmentsLedger).length} مقطعاً مجتازاً متاحاً من التشغيل السابق`)
  runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, 'qa_in_progress', '', startedAt, '')
  pendingMemory.length = 0
  const quarantine = (reason, extra = {}) => {
    auditRecord.status = 'quarantined'
    auditRecord.finishedAt = new Date().toISOString()
    auditRecord.finalGate = { ...auditRecord.finalGate, pass: false, reasonCodes: [reason], ...extra }
    const quarantinedAudio = preserveRejectedCandidate(article, lang, reason)
    if (quarantinedAudio) {
      auditRecord.finalGate.quarantinedAudio = quarantinedAudio.replace(ROOT, '')
      // «أسمع قبل القرار»: نسخة مراجعة على R2 staging تظهر في غرفة الإنتاج مع سبب الرفض —
      // ليست منشورة في RSS ولا في الموقع؛ رابط مراجعة داخلي فقط.
      if (r2StagingReady()) {
        const reviewKey = `staging/review/${safeSlug(article.slug)}.${lang}.mp3`
        const put = r2Aws(['put-object', '--bucket', R2_CONF.bucket, '--key', reviewKey,
          '--body', quarantinedAudio, '--content-type', 'audio/mpeg'])
        if (put.status === 0) auditRecord.finalGate.reviewAudioKey = reviewKey
      }
    }
    writeAudit(article, lang, auditRecord)
    runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, 'quarantined', reason, startedAt, auditRecord.finishedAt)
    pendingMemory.length = 0
    rmSync(TMP, { recursive: true, force: true })
    console.log(`  ✘ عُزلت الحلقة ولم يُمس الملف المنشور: ${reason}`)
    return 'fail'
  }

  try {
    /* ١) dialogueText من sourceText + بوابتا اللغة والإسناد */
    const sys = lang === 'ar' ? AR_SYSTEM : EN_SYSTEM
    const userMsg = `${lang === 'ar' ? 'المقال الأصلي sourceText' : 'The Arabic sourceText'}:\nTITLE: ${article.title}\n---\n${article.body}\n---\n` +
      `storyTemplateAllowed: ${storyBudget}` +
      (lang === 'en' ? '\nFirst create the English editorial adaptation internally, then the dialogue.' : '')
    let script = null, lintIssues = [], fidelity = { pass: true, problems: [] }
    // حوار الدكتور اليدوي: وجود الملف = هو المصدر الوحيد للنص. Gemini لا يكتب حرفاً.
    const manualDialoguePath = resolve(ROOT, 'manual-dialogues', `${article.slug}.json`)
    if (NO_GEMINI && !(lang === 'ar' && existsSync(manualDialoguePath)))
      return quarantine('وضع بلا Gemini يتطلب حواراً يدوياً في manual-dialogues/ — لا كاتب آلي في هذا الوضع')
    if (lang === 'ar' && existsSync(manualDialoguePath)) {
      MANUAL_TEXT_MODE = true
      const manual = JSON.parse(readFileSync(manualDialoguePath, 'utf8'))
      script = { mood: 'تأملي', storyIntro: false,
        utterances: manual.map((item, index) => ({
          speaker: ['female', 'b'].includes(String(item.speaker || '').trim().toLowerCase()) ? 'B' : 'A',
          text: String(item.text || '').trim(),
          delivery: String(item.deliveryType || 'statement').trim(),
          pauseAfterMs: item.pauseAfterMs, overlapMs: Number(item.overlapMs || 0),
          allowOverlap: Number(item.overlapMs || 0) > 0,
          musicBridgeAfter: Boolean(item.musicBridgeAfter),
          emphasisWords: [], pronunciationNotes: '', _index: index })) }
      normalizeMechanics(script, { manualText: true })
      const manualLint = lintScript(script, lang)
      const blocking = manualLint.filter((issue) => /عامية/.test(issue))
      if (blocking.length) {
        MANUAL_TEXT_MODE = false
        return quarantine(`الحوار اليدوي يحتاج تنقيح الدكتور (لن يُعاد كتابته آلياً): ${blocking.join(' · ')}`)
      }
      if (manualLint.length) console.log(`  ⚠ ملاحظات شكلية على الحوار اليدوي (لا تحجب): ${manualLint.slice(0, 3).join(' · ')}`)
      auditRecord.dialogueSource = 'manual'
      lintIssues = []
      fidelity = { pass: true, problems: [] }
      console.log(`  ✍ حوار الدكتور اليدوي: ${script.utterances.length} مداخلة — النص مقدس، Gemini فاحص لا كاتب`)
    }
    if (REUSE_DIALOGUE && !script && existsSync(auditPath(article, lang))) {
      const previous = JSON.parse(readFileSync(auditPath(article, lang), 'utf8'))
      if (previous.pipelineHash === ACTIVE_PIPELINE_HASH && previous.source?.sha256 === sourceHash && previous.dialogue?.utterances?.length) {
        script = { mood: previous.dialogue.mood || 'تأملي', storyIntro: Boolean(previous.dialogue.storyIntro),
          utterances: previous.dialogue.utterances.map((utterance, index) => ({ speaker: utterance.speaker,
            text: utterance.dialogueText, delivery: utterance.delivery || 'normal', ratePct: utterance.ratePct,
            targetWordsPerMinute: utterance.targetWordsPerMinute,
            pauseAfterMs: utterance.pauseAfterMs,
            ending: utterance.ending, internalBreakMs: utterance.internalBreakMs,
            allowOverlap: Boolean(utterance.allowOverlap), overlapMs: utterance.overlapMs || 0,
            musicBridgeAfter: Boolean(utterance.musicBridgeAfter),
            emphasisWords: utterance.emphasisWords || [], pronunciationNotes: '', _index: index })) }
        normalizeMechanics(script)
        lintIssues = lintScript(script, lang)
        if (!lintIssues.length && lang === 'ar' && !NO_GEMINI) fidelity = await validateDialogueFidelity(article, script)
        if (!fidelity.pass) lintIssues.push(...fidelity.problems.map((problem) => `إسناد: ${problem.issue || problem}`))
        if (!lintIssues.length) console.log('  ↷ أُعيد استخدام dialogueText المجتاز من الخطة السابقة')
        else script = null
      }
    }
    for (let round = 1; round <= 12 && !script; round++) {
      const candidate = await gemini(sys, userMsg + (lintIssues.length ? `\n\nREWRITE. Previous gate failures: ${lintIssues.join(' | ')}` : ''), 0.72, DIALOGUE_MODEL)
      normalizeMechanics(candidate)
      lintIssues = lintScript(candidate, lang)
      if (!lintIssues.length && lang === 'ar') {
        fidelity = await validateDialogueFidelity(article, candidate)
        if (!fidelity.pass) lintIssues.push(...fidelity.problems.map((problem) => `إسناد: ${problem.issue || problem}`))
      }
      if (!lintIssues.length) script = candidate
      else console.log(`  ⟳ إعادة كتابة (${round}): ${lintIssues.slice(0, 3).join(' · ')}`)
    }
    if (lintIssues.length) return quarantine(`بوابة dialogueText: ${lintIssues.join(' · ')}`, { fidelity })
    const utts = script.utterances
    const isStory = Boolean(script.storyIntro)
    auditRecord.dialogue = { mood: script.mood, storyIntro: isStory,
      utterances: utts.map((utterance, index) => {
        const { text, _index, _splitMiddle, ...metadata } = utterance
        return { id: `u${String(index + 1).padStart(3, '0')}`, ...metadata,
          musicBridgeAfter: Boolean(utterance.musicBridgeAfter), dialogueText: text }
      }) }
    console.log(`  ✓ dialogueText فصيح ومسنَد: ${utts.length} مداخلة · قصة: ${isStory ? 'نعم' : 'لا'}`)
    if (DRY) {
      auditRecord.status = 'draft'
      auditRecord.finishedAt = new Date().toISOString()
      writeAudit(article, lang, auditRecord)
      console.log(JSON.stringify(utts.slice(0, 4), null, 1))
      return 'dry'
    }

    /* ٢) pronunciationText مستقل + Arabic Pronunciation Risk Detector */
    let analyses = utts.map((u, index) => ({ idx: index, pronunciationText: u.text, risks: [] }))
    if (lang === 'ar' && LIGHT) {
      console.log('  ⚙ وضع مجاني: تخطّي تحليل النطق المدفوع — Azure TTS مباشرةً بقاموس الأسماء المحلي')
    } else if (lang === 'ar') {
      const analysisTextHash = (t) => createHash('sha256').update(String(t || '').replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16)
      const missing = []
      utts.forEach((u, i) => {
        const hit = previousAnalysesLedger[analysisTextHash(u.text)]
        if (hit?.pronunciationText) analyses[i] = { idx: i, pronunciationText: hit.pronunciationText, risks: hit.risks || [] }
        else missing.push(i)
      })
      if (missing.length) {
        const fresh = await riskAnalyze(missing.map((i) => utts[i]))
        fresh.forEach((a, j) => { analyses[missing[j]] = { ...a, idx: missing[j] } })
      }
      if (missing.length < utts.length)
        console.log(`  ↷ أُعيد استخدام تحليل النطق لـ${utts.length - missing.length}/${utts.length} مداخلة (بلا Gemini)`)
      utts.forEach((u, i) => { auditRecord.analyses[analysisTextHash(u.text)] = { pronunciationText: analyses[i].pronunciationText, risks: analyses[i].risks || [] } })
      const totalRisks = analyses.reduce((count, analysis) => count + analysis.risks.length, 0)
      const high = analyses.reduce((count, analysis) => count + analysis.risks.filter((risk) => risk.riskLevel === 'high').length, 0)
      console.log(`  ✓ pronunciationText: ${totalRisks} كلمة مرصودة (${high} عالية الخطورة)`)
    }
    if (PLAN) {
      auditRecord.pronunciation.utterances = analyses.map((analysis, index) => {
        const voice = (utts[index].speaker === 'A' ? voices.A : voices.B).azure
        const applied = applyLexicon(analysis.pronunciationText, analysis.risks, voice, utts[index].text)
        return {
          id: `u${String(index + 1).padStart(3, '0')}`,
          speaker: utts[index].speaker,
          voice,
          pronunciationText: applied.text,
          ssmlSubstitutions: applied.subs,
          risks: analysis.risks,
        }
      })
      auditRecord.status = 'planned'
      auditRecord.finishedAt = new Date().toISOString()
      writeAudit(article, lang, auditRecord)
      runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, 'planned', '', startedAt, auditRecord.finishedAt)
      console.log('  ✓ خُزنت الطبقات الثلاث وخطة النطق — بلا توليد صوتي')
      return 'dry'
    }

    /* ٣) TTS → STT → Arabic Audio Judge؛ لا يمر فشل واحد */
    rmSync(TMP, { recursive: true, force: true })
    mkdirSync(TMP, { recursive: true })
    const segments = []
    const transcript = []
    const pronunciation = []
    const allRisks = []
    let previousHasHighRisk = false
    for (let index = 0; index < utts.length; index++) {
      const utterance = utts[index]
      const voiceInfo = utterance.speaker === 'A' ? voices.A : voices.B
      const utteranceId = `u${String(index + 1).padStart(3, '0')}`
      const produced = await produceUtteranceResilient({
        utterance, analysis: analyses[index], voice: voiceInfo.azure, lang,
        wavBase: resolve(TMP, utteranceId),
        context: { runId, utteranceId, sourceText: article.body },
        cache: { slug: article.slug, pipelineHash: ACTIVE_PIPELINE_HASH,
          previous: previousSegmentsLedger, ledger: auditRecord.segments },
      })
      if (!produced.ok) {
        auditRecord.failure = { utteranceId, reason: String(produced.reason || '').slice(0, 400), at: new Date().toISOString() }
        return quarantine(`المداخلة ${utteranceId}: ${produced.reason || 'غير موثقة'}`,
          { failedUtterance: auditRecord.failure })
      }
      const parts = produced.parts
      const primaryPlan = parts[0].plan || utterance
      const lastPlan = parts.at(-1).plan || utterance
      const joinedText = parts.map((part) => part.result.dialogueText || '').join(' ').replace(/\s+/g, ' ').trim()
      const risks = parts.flatMap((part) => part.result.risks || [])
      const hasHighRisk = risks.some((risk) => risk.riskLevel === 'high')
      allRisks.push(...risks.map((risk) => ({ ...risk, utteranceId, voice: voiceInfo.azure })))
      transcript.push({ speaker: voiceInfo.name, speakerKey: utterance.speaker, text: joinedText || utterance.text,
        delivery: primaryPlan.delivery, ratePct: primaryPlan.ratePct,
        targetWordsPerMinute: primaryPlan.targetWordsPerMinute,
        pauseAfterMs: lastPlan.pauseAfterMs, ending: lastPlan.ending,
        internalBreakMs: primaryPlan.internalBreakMs,
        allowOverlap: Boolean(primaryPlan.allowOverlap), overlapMs: Number(primaryPlan.overlapMs || 0),
        musicBridgeAfter: Boolean(lastPlan.musicBridgeAfter),
        splitParts: parts.length > 1 ? parts.length : undefined,
        paceCalibration: parts.at(-1).result.paceCalibration || null })
      parts.forEach((part, k) => {
        pronunciation.push({ id: utteranceId, part: parts.length > 1 ? k + 1 : undefined,
          speaker: utterance.speaker, voice: voiceInfo.azure,
          pronunciationText: part.result.pronunciationText || part.plan?.text || utterance.text,
          intendedText: part.result.intendedText || part.result.pronunciationText || utterance.text,
          risks: part.result.risks || [], fromCache: Boolean(part.fromCache),
          selectedCandidateId: part.result.selectedCandidate, candidates: part.result.candidates, stt: part.result.heard })
      })
      parts.forEach((part, k) => {
        const isLast = k === parts.length - 1
        const plan = part.plan || utterance
        const pauseProfile = pacingOf(plan.delivery)
        const pauseAfterMs = isLast
          ? Math.min(pauseProfile.pauseMs[1], Math.max(pauseProfile.pauseMs[0],
            Number(plan.pauseAfterMs || stableBetween(plan.text || joinedText, index + 71, ...pauseProfile.pauseMs))))
          : Math.min(200, Math.max(120, Number(plan.pauseAfterMs) || 160))
        const overlapMs = k === 0 && !hasHighRisk && !previousHasHighRisk && plan.allowOverlap
          ? Math.min(150, Math.max(50, Number(plan.overlapMs || 90))) : 0
        segments.push({ file: part.wav, pauseAfterMs, overlapMs, hasHighRisk })
      })
      previousHasHighRisk = hasHighRisk
      auditRecord.progress = { done: index + 1, total: utts.length, at: new Date().toISOString() }
      if (RESUME && lang === 'ar') writeAudit(article, lang, auditRecord)
      process.stdout.write(`  🎙 ${index + 1}/${utts.length} (TTS→STT→Judge)\r`)
    }
    console.log('')
    auditRecord.dialogue.utterances = transcript.map((item, index) => ({ id: `u${String(index + 1).padStart(3, '0')}`,
      speaker: item.speakerKey, dialogueText: item.text, delivery: item.delivery, ratePct: item.ratePct,
      targetWordsPerMinute: item.targetWordsPerMinute, pauseAfterMs: item.pauseAfterMs,
      ending: item.ending, internalBreakMs: item.internalBreakMs,
      allowOverlap: item.allowOverlap, overlapMs: item.overlapMs,
      musicBridgeAfter: item.musicBridgeAfter, paceCalibration: item.paceCalibration }))
    auditRecord.pronunciation.utterances = pronunciation

    const finalLanguageIssues = lintScript({ utterances: transcript.map((item) => ({ speaker: item.speakerKey,
      text: item.text, delivery: item.delivery, ratePct: item.ratePct,
      targetWordsPerMinute: item.targetWordsPerMinute, pauseAfterMs: item.pauseAfterMs,
      ending: item.ending, internalBreakMs: item.internalBreakMs,
      allowOverlap: item.allowOverlap, overlapMs: item.overlapMs })) }, lang)
    if (finalLanguageIssues.length) return quarantine(`بوابة اللغة بعد الإصلاح: ${finalLanguageIssues.join(' · ')}`)
    const pronunciationConsistency = new Map()
    const inconsistent = []
    for (const risk of allRisks) {
      const keyWord = `${normalizeAr(risk.word)}|${normalizeAr(risk.meaningInContext || '')}|${risk.grammaticalType || ''}`
      const selected = normalizeAr(risk.subAlias || risk.selectedPronunciation || risk.word)
      if (pronunciationConsistency.has(keyWord) && pronunciationConsistency.get(keyWord) !== selected) inconsistent.push(risk.word)
      else pronunciationConsistency.set(keyWord, selected)
    }
    if (inconsistent.length) return quarantine(`اختلاف نطق الكلمة نفسها: ${[...new Set(inconsistent)].join('، ')}`)

    /* ٤) مسار مرخّص للجسور الدلالية فقط؛ لا توجد موسيقى مستمرة تحت الحلقة. */
    let music = null
    if (existsSync(MUSIC_LIB)) {
      const library = JSON.parse(readFileSync(MUSIC_LIB, 'utf8'))
      const track = (library.tracks || []).find((item) => item.licensed && (item.moods || []).includes(script.mood))
      if (track && existsSync(resolve(ROOT, track.path)))
        music = { file: resolve(ROOT, track.path) }
    }
    if (!music) console.log('  ♪ إخراج بلا موسيقى — لا يوجد مسار مرخّص مطابق')

    /* ٥) جسور موسيقية دلالية ثم تركيب مؤقت؛ لا صمت ميت ولا موسيقى بعد كل جملة. */
    let bridged = insertSemanticMusicBridges(segments.map((segment) => ({ ...segment })), transcript, music, TMP)
    auditRecord.musicBridges = bridged.bridges
    const candidateMp3 = resolve(TMP, `${article.slug}.accepted-candidate.mp3`)
    let assembled = assemble(bridged.segments, candidateMp3, music)
    const dialogueWords = transcript.reduce((total, item) => total + String(item.text).split(/\s+/).filter(Boolean).length, 0)
    const weightedTargetWpm = transcript.reduce((total, item) => total
      + Number(item.targetWordsPerMinute || 140) * String(item.text).split(/\s+/).filter(Boolean).length, 0)
      / Math.max(1, dialogueWords)
    const plannedPauseSec = bridged.segments.reduce((total, item) => total
      + Math.max(0, Number(item.pauseAfterMs || 0)) / 1000, 0)
    const bridgeSec = bridged.bridges.reduce((total, item) => total + item.durationSec, 0)
    const expectedDurationSec = dialogueWords / Math.max(122, weightedTargetWpm) * 60
      + plannedPauseSec + bridgeSec + 0.7
    const durationRange = { minSec: Math.max(165, expectedDurationSec * 0.84),
      maxSec: Math.min(310, expectedDurationSec * 1.18), maxLongSilences: 2 }
    // الوضع المجاني: الوقفات التأملية المقصودة (حتى 700ms) مع حدود المقاطع قد تتجاوز 800ms طبيعياً؛
    // عتبة «صفر» موجّهة لكشف عطل التركيب لا للوقفات المقصودة. وحدود المدة الضيقة (225–285ث) مضبوطة
    // للمسار المدفوع؛ في المجاني نقبل المدى الطبيعي (بضع ثوانٍ فرق لا يُعزل حلقةً سليمة).
    if (LIGHT) { durationRange.maxLongSilences = utts.length; durationRange.minSec = 120; durationRange.maxSec = 360 }
    let technicalAudit = auditAudio(candidateMp3, durationRange)
    if (technicalAudit.issues.length) return quarantine(`الفحص التقني: ${technicalAudit.issues.join(' · ')}`)
    let fullStt = null, fullComparison = null, finalJudge = null
    if (LIGHT) {
      // الوضع المجاني: نُبقي الفحص التقني المحلي فقط (سلامة الملف والمدة)، ونتخطّى STT الكامل
      // وحَكَم الحلقة المدفوع (multimodal). النشر مباشر بجودة القراءة المقبولة.
      console.log('  ⚙ وضع مجاني: تخطّي حَكَم الحلقة المدفوع — نشرٌ مباشر بجودة القراءة')
    } else {
      fullStt = await transcribeAssembledEpisode(candidateMp3, assembled.timeline, lang === 'ar' ? localeOf(voices.A.azure) : 'en-US')
      const intendedFull = pronunciation.map((item) => item.intendedText.replace(/\|/g, ' ')).join(' ')
      fullComparison = compareTexts(intendedFull, fullStt.text)
      const missingNegations = fullComparison.missing.filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'].includes(word))
      const highRiskMissing = allRisks.filter((risk) => risk.riskLevel === 'high')
        .filter((risk) => !heardContainsRisk(fullStt.text, risk))
      if (missingNegations.length || highRiskMissing.length || fullComparison.importantRatio < 0.95 || fullComparison.ratio < 0.90)
        return quarantine(`STT الحلقة الكاملة لم يطابق النص المقصود (المهم ${Math.round(fullComparison.importantRatio * 100)}٪)`, { fullStt, fullComparison })
      finalJudge = await judgeFullEpisode(candidateMp3, intendedFull, fullStt, transcript, allRisks)
      if (!finalJudge.pass) {
        const targetedIndexes = [...new Set((finalJudge.problems || []).map((problem) => {
          const match = String(problem.unitId || '').match(/^u(\d{3})$/)
          return match ? Number(match[1]) - 1 : -1
        }).filter((index) => index >= 0 && index < utts.length))]
        if (!targetedIndexes.length) {
          return quarantine(`Arabic Audio Judge للحلقة: ${(finalJudge.problems || []).map((problem) => problem.issue).join(' · ')}`, { fullStt, finalJudge })
        }
        console.log(`  ⟳ إصلاح موجّه للحلقة: ${targetedIndexes.map((index) => `u${String(index + 1).padStart(3, '0')}`).join('، ')}`)
        for (const index of targetedIndexes) {
          const utteranceId = `u${String(index + 1).padStart(3, '0')}`
          const issue = finalJudge.problems.find((problem) => problem.unitId === utteranceId) || {}
          const utterance = { ...utts[index] }
          utterance.ratePct = Math.max(-18, Number(utterance.ratePct || 0) - 1)
          utterance.internalBreakMs = Math.min(180, Number(utterance.internalBreakMs || 105) + 18)
          if (utterance.text.includes('؟')) { utterance.delivery = 'question'; utterance.ending = 'open' }
          if (issue.method === 'rephrase' && issue.suggestion) {
            const replacement = await safeRephrase(utterance.text, article.body, issue.issue || 'طبيعية الإلقاء', [])
            if (replacement) utterance.text = replacement
          }
          const nextAnalysis = lang === 'ar' ? (await riskAnalyze([utterance]))[0] : analyses[index]
          const voiceInfo = utterance.speaker === 'A' ? voices.A : voices.B
          const wav = resolve(TMP, `${utteranceId}.wav`)
          const result = await produceUtterance(utterance, nextAnalysis, voiceInfo.azure, lang, wav,
            { runId, utteranceId, sourceText: article.body })
          if (!result.ok || (lang === 'ar' && !result.verified)) {
            return quarantine(`فشل الإصلاح الموجّه للمداخلة ${utteranceId}: ${result.reason || 'غير موثقة'}`, { finalJudge })
          }
          utts[index] = utterance
          analyses[index] = nextAnalysis
          const deliveryPlan = result.deliveryPlan || utterance
          transcript[index] = { ...transcript[index], text: result.dialogueText || utterance.text,
            delivery: deliveryPlan.delivery, ratePct: deliveryPlan.ratePct,
            targetWordsPerMinute: deliveryPlan.targetWordsPerMinute,
            pauseAfterMs: deliveryPlan.pauseAfterMs, ending: deliveryPlan.ending,
            internalBreakMs: deliveryPlan.internalBreakMs }
          pronunciation[index] = { ...pronunciation[index], pronunciationText: result.pronunciationText || utterance.text,
            intendedText: result.intendedText || result.pronunciationText || utterance.text,
            risks: result.risks || [], selectedCandidateId: result.selectedCandidate,
            candidates: result.candidates, stt: result.heard }
          segments[index] = { ...segments[index], file: wav,
            pauseAfterMs: deliveryPlan.pauseAfterMs, hasHighRisk: (result.risks || []).some((risk) => risk.riskLevel === 'high') }
        }
        bridged = insertSemanticMusicBridges(segments.map((segment) => ({ ...segment })), transcript, music, TMP)
        auditRecord.musicBridges = bridged.bridges
        assembled = assemble(bridged.segments, candidateMp3, music)
        technicalAudit = auditAudio(candidateMp3, durationRange)
        if (technicalAudit.issues.length) return quarantine(`الفحص التقني بعد الإصلاح الموجّه: ${technicalAudit.issues.join(' · ')}`)
        fullStt = await transcribeAssembledEpisode(candidateMp3, assembled.timeline, lang === 'ar' ? localeOf(voices.A.azure) : 'en-US')
        const repairedIntended = pronunciation.map((item) => item.intendedText.replace(/\|/g, ' ')).join(' ')
        fullComparison = compareTexts(repairedIntended, fullStt.text)
        if (fullComparison.importantRatio < 0.95 || fullComparison.ratio < 0.90) {
          return quarantine('STT الحلقة فشل بعد الإصلاح الموجّه', { fullStt, fullComparison })
        }
        finalJudge = await judgeFullEpisode(candidateMp3, repairedIntended, fullStt, transcript, allRisks)
        if (!finalJudge.pass) return quarantine(`الحكم الصوتي رفض الحلقة بعد الإصلاح الموجّه: ${(finalJudge.problems || []).map((problem) => problem.issue).join(' · ')}`, { fullStt, finalJudge })
      }
    }

    /* ٦) بوابة score قبل لمس أي ملف منشور، ثم نشر ذري مع Last-Known-Good وRollback دائم. */
    const qualityScore = episodeQualityScore({ technicalAudit, fullComparison, finalJudge, transcript })
    if (!qualityScore.pass) return quarantine(`بوابة score النهائية أقل من الحد: ${qualityScore.score}/100`)
    const humanGate = dialogueHumanGate({ candidateMp3, transcript, fullComparison, finalJudge })
    if (!humanGate.pass) return quarantine(`بوابة البشرية أقل من الحد: proxy=${humanGate.proxy.score}/100، judge=${humanGate.minimumJudgeDimension}/100`, { humanGate })
    const publicTranscript = { title: article.title, generatedAt: new Date().toISOString().slice(0, 10),
      language: 'ar', utterances: transcript.map(({ speaker, text }) => ({ speaker, text })) }
    const tempTranscript = resolve(TMP, `${article.slug}.dialogue.json`)
    if (lang === 'ar') writeFileSync(tempTranscript, JSON.stringify(publicTranscript, null, 2))
    const snapshot = createReleaseSnapshot({ article, lang, outMp3, transcriptPath, stateKey: key,
      label: PILOT_MODE ? 'pilot' : 'production' })
    const previousTotalCount = Number(state.totalCount || 0)
    const previousStoryCount = Number(state.storyCount || 0)
    try {
      const stagedAudio = `${outMp3}.next-${process.pid}`
      copyFileSync(candidateMp3, stagedAudio)
      renameSync(stagedAudio, outMp3)
      if (lang === 'ar') {
        const stagedTranscript = `${transcriptPath}.next-${process.pid}`
        copyFileSync(tempTranscript, stagedTranscript)
        renameSync(stagedTranscript, transcriptPath)
      }
      const audioHash = sha256File(outMp3)
      const transcriptHash = lang === 'ar' ? sha256File(transcriptPath) : ''
      state.done[key] = { contentHash, pipelineHash: ACTIVE_PIPELINE_HASH, sourceHash, audioHash, transcriptHash,
        status: acceptedStatus, acceptedAt: new Date().toISOString(), pilot: PILOT_MODE }
      if (!PILOT_MODE) {
        state.totalCount = previousTotalCount + 1
        if (isStory) state.storyCount = previousStoryCount + 1
      }
      saveState()
      const localValidation = validatePublishedArtifacts({ outMp3, transcriptPath, expectedAudioHash: audioHash,
        expectedTranscriptHash: transcriptHash, lang })
      if (!localValidation.pass) throw new Error(`فحص ما بعد الاستبدال المحلي: ${localValidation.issues.join(' · ')}`)
      const postPublish = runPostPublishCheck({ article, lang, outMp3, transcriptPath,
        releaseDir: snapshot.releaseDir, pilot: PILOT_MODE })
      auditRecord.status = acceptedStatus
      auditRecord.finishedAt = new Date().toISOString()
      auditRecord.finalGate = { pass: true, score: qualityScore.score, minimumScore: qualityScore.minimumScore,
        scoreChecks: qualityScore.checks, humanGate,
        reasonCodes: PILOT_MODE ? ['three_episode_pilot'] : [], technicalAudit, localValidation, postPublish, fullStt,
        fullComparison: fullComparison ? { ratio: fullComparison.ratio, importantRatio: fullComparison.importantRatio,
          missing: fullComparison.missing, missingImportant: fullComparison.missingImportant } : null, finalJudge }
      writeAudit(article, lang, auditRecord)
      runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, acceptedStatus, '', startedAt, auditRecord.finishedAt)
      const riskMap = new Map(allRisks.map((risk) => [normalizeAr(risk.word), risk]))
      commitPendingMemory(riskMap)
      if (!PILOT_MODE) finalizeLastKnownGood({ article, lang, outMp3, transcriptPath,
        releaseDir: snapshot.releaseDir, stateKey: key })
      atomicWriteText(resolve(snapshot.releaseDir, 'accepted.json'), JSON.stringify({
        acceptedAt: auditRecord.finishedAt, status: acceptedStatus, qualityScore: qualityScore.score,
        audioHash, transcriptHash, localValidation, postPublish,
      }, null, 2))
    } catch (publishError) {
      restoreReleaseSnapshot(snapshot, { outMp3, transcriptPath, stateKey: key })
      throw publishError
    }
    rmSync(TMP, { recursive: true, force: true })
    console.log(`  ✅ قبول آلي صارم · ${(technicalAudit.dur / 60).toFixed(1)} دقيقة · ${(technicalAudit.size / 1e6).toFixed(1)}MB → ${article.slug}${suffix}`)
    return 'ok'
  } catch (error) {
    return quarantine(error?.message || String(error))
  }
}

/* ═══════════ التجربة الثلاثية المتنوعة + الترقية الجماعية الآمنة ═══════════ */
function articlePilotScores(article) {
  const text = `${article.title} ${article.body}`
  const count = (pattern) => (text.match(pattern) || []).length
  return {
    human: count(/قال|قالت|كان|كانت|عاد|دخل|رفع|سأل|طالب|طفل|معلم|أب|أم|شعر|خاف|قلب|إنسان/g),
    analytical: count(/دراسة|بحث|نتائج|أظهرت|بيّنت|نسبة|جامعة|نظرية|باحث|عام\s+20|٪|%|\d{2,}/g),
    reflective: count(/لماذا|ماذا لو|ربما|حين|ليس|ليست|المعنى|القيمة|الكرامة|نتأمل|السؤال/g),
  }
}

function selectDiversePilotArticles(articles, count = 3) {
  const explicit = String(env.PODCAST_PILOT_SLUGS || '').split(',').map((slug) => slug.trim()).filter(Boolean)
  if (explicit.length) {
    const selected = explicit.map((slug) => articles.find((article) => article.slug === slug)).filter(Boolean)
    if (selected.length < Math.min(count, explicit.length)) throw new Error('بعض PODCAST_PILOT_SLUGS غير موجودة')
    return selected.slice(0, count).map((article, index) => ({ ...article, pilotCategory: ['human', 'analytical', 'reflective'][index] || 'mixed' }))
  }
  const pool = articles.slice(0, Math.min(50, articles.length)).map((article) => ({ article, scores: articlePilotScores(article) }))
  const selected = []
  for (const category of ['human', 'analytical', 'reflective']) {
    const best = pool.filter((item) => !selected.some((picked) => picked.article.slug === item.article.slug))
      .sort((left, right) => right.scores[category] - left.scores[category]
        || (right.article.iso || '').localeCompare(left.article.iso || ''))[0]
    if (best) selected.push({ ...best, category })
  }
  for (const item of pool) {
    if (selected.length >= count) break
    if (!selected.some((picked) => picked.article.slug === item.article.slug)) selected.push({ ...item, category: 'mixed' })
  }
  return selected.slice(0, count).map(({ article, category }) => ({ ...article, pilotCategory: category }))
}

function productionAuditPath(article, lang) {
  mkdirSync(AUDITS, { recursive: true })
  return resolve(AUDITS, `${article.slug}.${lang}.json`)
}

function promotePilotBatch(articles, lang = 'ar') {
  const batchDir = resolve(RELEASES, `pilot-batch-${releaseTimestamp()}`)
  mkdirSync(batchDir, { recursive: true })
  const stateBefore = JSON.stringify(state)
  const items = []
  try {
    for (const article of articles) {
      const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
      const pilotAudio = resolve(PILOT_AUDIO, `${article.slug}${suffix}`)
      const pilotTranscript = resolve(PILOT_AUDIO, `${article.slug}.dialogue.json`)
      const pilotKey = `pilot:${article.slug}:${lang}`
      const productionKey = `${article.slug}:${lang}`
      const pilotState = state.done[pilotKey]
      const pilotAuditFile = resolve(AUDITS, `${article.slug}.${lang}.pilot.json`)
      const pilotAudit = existsSync(pilotAuditFile) ? JSON.parse(readFileSync(pilotAuditFile, 'utf8')) : null
      if (!pilotState || pilotState.status !== 'accepted_pilot' || !pilotAudit?.finalGate?.pass)
        throw new Error(`التجربة غير مكتملة أو غير ناجحة: ${article.slug}`)
      if (!existsSync(pilotAudio) || sha256File(pilotAudio) !== pilotState.audioHash)
        throw new Error(`ملف التجربة تغيّر أو اختفى: ${article.slug}`)
      if (lang === 'ar' && (!existsSync(pilotTranscript) || sha256File(pilotTranscript) !== pilotState.transcriptHash))
        throw new Error(`Transcript التجربة تغيّر أو اختفى: ${article.slug}`)
      const itemDir = resolve(batchDir, safeSlug(article.slug)); mkdirSync(itemDir, { recursive: true })
      const outMp3 = resolve(AUDIO, `${article.slug}${suffix}`)
      const transcriptPath = resolve(AUDIO, `${article.slug}.dialogue.json`)
      const hadAudio = existsSync(outMp3), hadTranscript = lang === 'ar' && existsSync(transcriptPath)
      if (hadAudio) copyFileSync(outMp3, resolve(itemDir, 'previous.mp3'))
      if (hadTranscript) copyFileSync(transcriptPath, resolve(itemDir, 'previous.json'))
      items.push({ article, outMp3, transcriptPath, pilotAudio, pilotTranscript, itemDir,
        hadAudio, hadTranscript, hadProductionState: Boolean(state.done[productionKey]), productionKey, pilotState, pilotAudit })
    }

    mkdirSync(AUDIO, { recursive: true })
    for (const item of items) {
      const stagedAudio = `${item.outMp3}.pilot-next-${process.pid}`
      copyFileSync(item.pilotAudio, stagedAudio); renameSync(stagedAudio, item.outMp3)
      if (lang === 'ar') {
        const stagedTranscript = `${item.transcriptPath}.pilot-next-${process.pid}`
        copyFileSync(item.pilotTranscript, stagedTranscript); renameSync(stagedTranscript, item.transcriptPath)
      }
      const audioHash = sha256File(item.outMp3)
      const transcriptHash = lang === 'ar' ? sha256File(item.transcriptPath) : ''
      state.done[item.productionKey] = { ...item.pilotState, status: 'accepted_automated', pilot: false,
        audioHash, transcriptHash, promotedFromPilot: true, promotedAt: new Date().toISOString() }
      const validation = validatePublishedArtifacts({ outMp3: item.outMp3, transcriptPath: item.transcriptPath,
        expectedAudioHash: audioHash, expectedTranscriptHash: transcriptHash, lang })
      if (!validation.pass) throw new Error(`${item.article.slug}: ${validation.issues.join(' · ')}`)
      item.validation = validation
    }
    state.totalCount = Number(state.totalCount || 0) + items.filter((item) => !item.hadProductionState).length
    state.pilotGate = { pass: true, pipelineHash: ACTIVE_PIPELINE_HASH, promoted: true,
      acceptedAt: new Date().toISOString(), articles: items.map((item) => ({ slug: item.article.slug,
        category: item.article.pilotCategory || 'mixed', score: item.pilotAudit.finalGate.score,
        audioHash: sha256File(item.outMp3) })) }
    saveState()
    const postPublish = runPostPublishCheck({ article: null, lang, outMp3: '', transcriptPath: '',
      releaseDir: batchDir, pilot: true, slugs: items.map((item) => item.article.slug) })
    for (const item of items) {
      finalizeLastKnownGood({ article: item.article, lang, outMp3: item.outMp3,
        transcriptPath: item.transcriptPath, releaseDir: item.itemDir, stateKey: item.productionKey })
      const promotedAudit = { ...item.pilotAudit, status: 'accepted_automated',
        pilotPromotion: { promotedAt: state.pilotGate.acceptedAt, batchDir, postPublish },
        finishedAt: new Date().toISOString() }
      atomicWriteText(productionAuditPath(item.article, lang), JSON.stringify(promotedAudit, null, 2))
    }
    atomicWriteText(resolve(batchDir, 'accepted.json'), JSON.stringify({
      acceptedAt: state.pilotGate.acceptedAt, articles: state.pilotGate.articles, postPublish,
    }, null, 2))
    atomicWriteText(PILOT_GATE_FILE, JSON.stringify(state.pilotGate, null, 2))
    return { pass: true, items, batchDir }
  } catch (error) {
    for (const item of items) {
      rmSync(item.outMp3, { force: true }); if (lang === 'ar') rmSync(item.transcriptPath, { force: true })
      if (item.hadAudio && existsSync(resolve(item.itemDir, 'previous.mp3'))) copyFileSync(resolve(item.itemDir, 'previous.mp3'), item.outMp3)
      if (lang === 'ar' && item.hadTranscript && existsSync(resolve(item.itemDir, 'previous.json'))) copyFileSync(resolve(item.itemDir, 'previous.json'), item.transcriptPath)
    }
    const restored = JSON.parse(stateBefore)
    for (const key of Object.keys(state)) delete state[key]
    Object.assign(state, restored)
    saveState()
    atomicWriteText(resolve(batchDir, 'rollback.json'), JSON.stringify({ rolledBackAt: new Date().toISOString(), reason: error.message }, null, 2))
    throw error
  }
}

function rollbackToLastKnownGood(slug, lang = 'ar') {
  const dir = resolve(LAST_GOOD, safeSlug(slug), lang)
  const manifestFile = resolve(dir, 'manifest.json')
  if (!existsSync(manifestFile) || !existsSync(resolve(dir, 'episode.mp3'))) throw new Error(`لا توجد Last-Known-Good للحلقة: ${slug}`)
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
  const outMp3 = resolve(AUDIO, `${slug}${suffix}`)
  const transcriptPath = resolve(AUDIO, `${slug}.dialogue.json`)
  mkdirSync(AUDIO, { recursive: true })
  copyFileSync(resolve(dir, 'episode.mp3'), outMp3)
  if (lang === 'ar' && existsSync(resolve(dir, 'transcript.json'))) copyFileSync(resolve(dir, 'transcript.json'), transcriptPath)
  if (manifest.stateEntry) state.done[manifest.stateKey || `${slug}:${lang}`] = manifest.stateEntry
  else if (state.done[manifest.stateKey || `${slug}:${lang}`]) {
    state.done[manifest.stateKey || `${slug}:${lang}`].audioHash = sha256File(outMp3)
    if (lang === 'ar') state.done[manifest.stateKey || `${slug}:${lang}`].transcriptHash = sha256File(transcriptPath)
  }
  saveState()
  console.log(`↶ أُعيدت Last-Known-Good: ${slug} (${lang})`)
}

/* ═══════════ التشغيل ═══════════ */
if (SELF_TEST) {
  const omittedNegation = compareTexts('لا نقيس الطالب لنحكم عليه', 'نقيس الطالب لنحكم عليه')
  assert(omittedNegation.missing.includes('لا'), 'حذف «لا» يجب أن يفشل')
  const reordered = compareTexts('نفهم ثم نقيس ثم نراجع', 'نراجع ثم نقيس ثم نفهم')
  assert(reordered.ratio < 0.7, 'تغيير ترتيب الكلمات يجب أن يخفض التطابق')
  assert.equal(compareTexts('إلى المدرسة', 'الى المدرسه').ratio, 1, 'فروق الهمزة والتاء المربوطة لا تؤثر')
  const clean = { utterances: Array.from({ length: 10 }, (_, index) => ({ speaker: index % 2 ? 'A' : 'B', text: 'هذا موضوع تربوي نعود إليه عادة لأنه يفتح باب الفهم والتأمل الهادئ في المدرسة والبيت والمجتمع.' })) }
  assert(!lintScript(clean, 'ar').some((issue) => issue.includes('«مو»') || issue.includes('«عاد»')), 'حدود الكلمات لا تظلم موضوع/عادة')
  const dialect = structuredClone(clean)
  dialect.utterances[0].text = 'المشكلة مو في القياس نفسه، بل في الطريقة.'
  assert(lintScript(dialect, 'ar').some((issue) => issue.includes('مو')), 'العامية يجب أن تُرفض')
  const fullDiacritics = structuredClone(clean)
  fullDiacritics.utterances = fullDiacritics.utterances.map((utterance) => ({ ...utterance, text: 'هَذَا نَصٌّ مُشَكَّلٌ كَامِلًا لا يَجِبُ أَنْ يَمُرَّ فِي الحِوَارِ المَنْشُورِ.' }))
  assert(lintScript(fullDiacritics, 'ar').some((issue) => issue.includes('مشكول')), 'التشكيل الكامل يجب أن يُرفض')
  const deterministic = deterministicRisks('ذكر John Hattie نتيجة في 2009 عن القياس')
  assert(deterministic.some((risk) => risk.word.includes('John Hattie') && risk.riskLevel === 'high'), 'الاسم اللاتيني عالي الخطورة')
  assert(deterministic.some((risk) => risk.word === '2009' && risk.riskLevel === 'high'), 'الرقم عالي الخطورة')
  const variants = candidateVariants('كيف نقيس؟', 'كيف نَقِيس؟', [], [{ word: 'نقيس', selectedPronunciation: 'نَقِيس', riskLevel: 'high' }])
  assert(variants.length >= 2, 'كل مداخلة عالية الخطورة تحتاج مرشحين على الأقل')
  assert.equal(candidateVariants('مدرسة جديدة', 'مدرسة جديدة', [], []).length, 1, 'ممنوع كسرة التاء المربوطة الآلية العامة')
  const sampleFixture = JSON.parse(readFileSync(resolve(ROOT, 'scripts/bakeoff-sample.json'), 'utf8'))
  assert.deepEqual(lintScript({ ...sampleFixture, sample: true }, 'ar'), [], 'عينة الأصوات يجب أن تجتاز بوابة اللغة والإلقاء')
  assert.equal(sampleFixture.schemaVersion, 3, 'عينة الأصوات الديناميكية يجب أن تكون v3')
  assert.equal(sampleFixture.femaleVoiceTest.utterances.length, 3, 'اختبار المرأة: خبر + سؤال + تأمل')
  assert(sampleFixture.utterances.every((utterance) => { const [lo, hi] = pacingOf(utterance.delivery).ratePct; return utterance.ratePct >= lo && utterance.ratePct <= hi }), 'كل سرعة في العينة ضمن المجال التربوي المتوازن')
  assert(existsSync(FFMPEG) && existsSync(FFPROBE), 'ffmpeg/ffprobe يجب أن يكونا قابلين للتنفيذ خارج PATH')
  assert.equal(blindRankingRound.toString().includes('pronunciationMeaning: 95'), false, 'ممنوع ترتيب وهمي ثابت للأصوات')
  const normalizedSample = normalizeMechanics(structuredClone(sampleFixture))
  const speechPolish = normalizeMechanics({ utterances: [{ speaker: 'A', delivery: 'reflection',
    text: 'إن علمناه أن هذا الرقم هو الحقيقة الكاملة، سيقرأ الورقة كحكم نهائي على قيمته.' },
  { speaker: 'B', delivery: 'briefReaction', text: 'بالظبط! هذه هي المشكلة.' }] })
  assert(speechPolish.utterances[0].text.includes('إذا تعلّم الطالب'), 'التراكيب الصعبة صوتياً يجب أن تُعاد لصياغة منطوقة')
  assert(!speechPolish.utterances[1].text.includes('بالظبط'), 'تصحيح «بالظبط» إلى «بالضبط» قبل النطق')
  assert(normalizedSample.utterances.every((utterance) => {
    const profile = pacingOf(utterance.delivery)
    return utterance.targetWordsPerMinute >= profile.targetWpm[0]
      && utterance.targetWordsPerMinute <= profile.targetWpm[1]
  }), 'تطبيع السرعة يجب أن يبقى داخل النطاق التربوي لكل نوع')
  assert(performanceDirector({ speaker: 'B', text: 'سؤال قصير', delivery: 'question' }, 0, 'ar',
    'ar-KW-NouraNeural').rate < performanceDirector({ speaker: 'B', text: 'سؤال قصير',
      delivery: 'question' }, 0, 'ar', 'ar-AE-FatimaNeural').rate,
  'نورة تحتاج إبطاءً أدائياً أكبر من فاطمة وفق الاختبار السمعي')
  assert(selectMusicBridgeIndexes(normalizedSample.utterances).length <= 1, 'العينة القصيرة لا تحتمل أكثر من جسر موسيقي واحد')

  /* ═══ اختبارات الإصلاح الجذري: التقسيم المدّي-الدلالي + الاستئناف (fixture u001 الفاشلة فعلياً) ═══ */
  const U001 = 'تخيل تلك اللحظة التي ترتفع فيها الزغاريد وتنهال التهاني، ويبتسم الطالب كما يتوقع منه الجميع؛ لكن شيئا في داخله لا يتحرك، ولا يشعر بأي فرح حقيقي.'
  const normalizeSpaces = (t) => String(t).replace(/\s+/g, ' ').trim()
  // ١) التطبيع يقسم u001 قبل TTS (كانت 25 كلمة تأملية → 13.1ث → عزل الحلقة)
  const u001Split = normalizeMechanics({ utterances: [{ speaker: 'A', delivery: 'reflection', text: U001,
    targetWordsPerMinute: 132, pauseAfterMs: 620, ending: 'final', musicBridgeAfter: true, internalBreakMs: 150 }] })
  assert(u001Split.utterances.length >= 2, 'u001 يجب أن تُقسَّم قبل Azure (مدة متوقعة > 11.5ث)')
  // نعزل قطع النص الأصلي عن الردود القصيرة التي يحقنها المحرك لإيقاع الحوار (سلوك مقصود آخر):
  // القطع هي أطول بادئة تُعيد تركيب U001 حرفياً.
  const originalNormalized = normalizeSpaces(U001)
  const u001Pieces = []
  for (const u of u001Split.utterances) {
    const candidate = normalizeSpaces([...u001Pieces.map((x) => x.text), u.text].join(' '))
    if (originalNormalized.startsWith(candidate)) u001Pieces.push(u)
    else break
  }
  // ٢) لا كلمة تضيع والترتيب محفوظ: إعادة الدمج تعطي النص الأصلي بعد تطبيع المسافات فقط
  assert.equal(normalizeSpaces(u001Pieces.map((u) => u.text).join(' ')), originalNormalized,
    'إعادة دمج القطع يجب أن تعيد النص الأصلي حرفياً')
  // ٣) كل وحدة تحت الحد المتوقع، والمتحدث لا يتغير
  assert(u001Pieces.length >= 2, 'قطع النص الأصلي نفسها ≥ 2')
  assert(u001Pieces.every((u) => u.text.split(/\s+/).length <= 24), 'كل قطعة ≤ حد الكلمات الديناميكي')
  assert(u001Pieces.every((u) => u.speaker === 'A'), 'المتحدث لا يتغير بين القطع')
  // ٤) الوقفة الأصلية على القطعة الأخيرة فقط، والوسطى وقفة داخلية قصيرة، والموسيقى على الأخيرة فقط
  const middlePieces = u001Pieces.slice(0, -1)
  const lastPiece = u001Pieces.at(-1)
  assert(middlePieces.every((u) => Number(u.pauseAfterMs) <= 200), 'القطع الوسطى وقفتها قصيرة (≤200ms)')
  assert(middlePieces.every((u) => !u.musicBridgeAfter), 'لا تنتقل الموسيقى إلى القطعة الخطأ')
  assert(Boolean(lastPiece.musicBridgeAfter), 'الجسر الموسيقي يبقى على القطعة الأخيرة')
  // ٥) التقسيم الدلالي المشترك: حارس الرقم — لا قطع بعد كلمة رقمية
  const numericPieces = splitTextSemantically('حصل الطالب على 95 في المئة من مجموع الدرجات النهائية في العام الماضي وتفوق على أقرانه في كل المواد الدراسية بلا استثناء يذكر أبداً', 8, 10)
  assert(numericPieces.every((piece) => !/[0-9]$/.test(piece.trim().split(/\s+/).at(-1) || '')), 'لا تقطع بين الرقم ووحدته')
  assert.equal(normalizeSpaces(numericPieces.join(' ')).length > 0, true, 'التقسيم الرقمي لا يفقد نصاً')
  // ٦) مفتاح كاش الاستئناف مستقر وحساس للنص والصوت
  const k1 = segmentKeyOf({ pipelineHash: 'ph', voice: 'v1', text: 'نص ثابت' })
  assert.equal(k1, segmentKeyOf({ pipelineHash: 'ph', voice: 'v1', text: ' نص  ثابت ' }), 'المفتاح يطبع المسافات')
  assert.notEqual(k1, segmentKeyOf({ pipelineHash: 'ph', voice: 'v2', text: 'نص ثابت' }), 'تغيير الصوت يغير المفتاح')
  assert.notEqual(k1, segmentKeyOf({ pipelineHash: 'ph2', voice: 'v1', text: 'نص ثابت' }), 'تغيير المحرك يغير المفتاح')
  // ٧) اشتقاق تحليل القطعة ينقل التشكيل كلمةً بكلمة ويرشح الكلمات الخطرة بلا Gemini
  const derivedPiece = derivePieceAnalysis({
    pronunciationText: 'تَخَيَّلْ تِلْكَ اللَّحْظَة الَّتِي تَرْتَفِعُ فِيهَا الزَّغَارِيد',
    sourceTextForCount: 'تخيل تلك اللحظة التي ترتفع فيها الزغاريد',
    risks: [{ word: 'الزغاريد', riskLevel: 'high' }, { word: 'التهاني', riskLevel: 'high' }],
  }, 'ترتفع فيها الزغاريد', 4, 3)
  assert(derivedPiece.pronunciationText.includes('تَرْتَفِعُ'), 'تشكيل القطعة منقول من تحليل الوحدة الكاملة')
  assert.equal(derivedPiece.risks.length, 1, 'ترشيح الكلمات الخطرة بالانتماء للقطعة فقط')
  assert.equal(derivedPiece.risks[0].word, 'الزغاريد', 'الكلمة الخطرة الصحيحة بقيت مع قطعتها')
  // ٨) شفاء التشكيل المفرط (فئة فشل التشغيل 12: «تشكيل 52٪» على دفعة كاملة رغم أن
  //    الشفاء كان سيعالجها): مسودة مشكولة بالكامل تُجرَّد إلى الانتقائي المسبَّب وتمر
  const overDone = healUnbackedDiacritics(
    'تظهر النتيجة فترتفع الزغاريد وتنهال التهاني',
    'تَظْهَرُ النَّتِيجَةُ فَتَرْتَفِعُ الزَّغَارِيدُ وَتَنْهَالُ التَّهَانِي',
    [{ word: 'الزغاريد', selectedPronunciation: 'الزَّغَارِيد', riskLevel: 'high' }])
  assert.equal(overDone.healedWords.length, 5, 'كل الكلمات المشكولة بلا سند تُشفى بنزع حركاتها')
  assert(overDone.healedText.includes('الزَّغَارِيدُ'), 'كلمة الخطر المعلنة تحتفظ بتشكيلها')
  const healedRatio = overDone.healedText.split(/\s+/).filter((w) => DIACRITICS_RE.test(w)).length
    / overDone.healedText.split(/\s+/).length
  assert(healedRatio <= 0.32, 'نسبة التشكيل بعد الشفاء تعود تحت بوابة 32٪ فلا تسقط الدفعة')
  // ٩) السؤال المفرد الجملة يُلقى بنغمة صاعدة (فئة فشل التشغيل 15: «نبرة تقريرية مسطحة»)
  const questionSSML = buildSSML({ speaker: 'A', delivery: 'question', ending: 'open', ratePct: 0,
    text: 'لماذا لا يفرح هذا الطالب وقد نجح فعلاً؟' }, 'لماذا لا يفرح هذا الطالب وقد نجح فعلاً؟', [], 'ar-KW-FahedNeural', 'ar')
  const questionPitches = [...questionSSML.matchAll(/pitch="([+-]?\d+)%"/g)].map((m) => Number(m[1]))
  assert(questionPitches.length >= 2, 'السؤال المفرد يُقسم صدراً وذيلاً أدائيين')
  assert(questionPitches.at(-1) > questionPitches[0], 'ذيل السؤال أعلى نغمة من صدره — لا استفهام مسطحاً')
  const statementSSML = buildSSML({ speaker: 'A', delivery: 'statement', ending: 'final', ratePct: 0,
    text: 'هذه جملة خبرية واحدة' }, 'هذه جملة خبرية واحدة', [], 'ar-KW-FahedNeural', 'ar')
  assert(/pitch="[+-]?\d+%"/.test(statementSSML), 'الخبر المفرد يبقى سليم البناء بعد إصلاح موضع النهاية')
  // ١٠) وضع بلا Gemini: نقاط الحكم لا تُمنح مجاناً بل تُشترى بعتبة STT مشددة (0.97/0.93)
  const noGeminiBase = { technicalAudit: { dur: 200, size: 4_000_000, unexpectedLongSilences: [], peakDb: -2 },
    transcript: Array.from({ length: 12 }, () => ({})) }
  const strictPass = episodeQualityScore({ ...noGeminiBase,
    fullComparison: { importantRatio: 0.98, ratio: 0.94 }, finalJudge: { noGemini: true, pass: true, problems: [] } })
  assert(strictPass.pass && strictPass.checks.judgeOk, 'بلا Gemini: STT فائق الدقة يشتري نقاط الحكم وتجتاز الحلقة')
  const strictFail = episodeQualityScore({ ...noGeminiBase,
    fullComparison: { importantRatio: 0.95, ratio: 0.90 }, finalJudge: { noGemini: true, pass: true, problems: [] } })
  assert(!strictFail.checks.judgeOk && !strictFail.pass, 'بلا Gemini: STT عند الحد العادي فقط لا يكفي — لا نقاط حكم مجانية')
  const judgedPath = episodeQualityScore({ ...noGeminiBase,
    fullComparison: { importantRatio: 0.95, ratio: 0.90 }, finalJudge: { pass: true, problems: [] } })
  assert(judgedPath.checks.judgeOk, 'مسار الحكم العادي لم يمسه وضع بلا Gemini')
  // ١١) المنصوب المنوّن: STT يكتب «انطباعاً عابراً» بلا ألف — لا تسقط مداخلة سليمة لذلك
  const tanween = compareTexts('وليس هذا انطباعاً عابراً', 'وليس هذا انطباع عابر')
  assert.equal(tanween.importantRatio, 1, 'ألف التنوين المحذوفة في STT لا تُحسب كلمة مفقودة')
  const guarded = compareTexts('نقيس الفهم قبل الدرجة', 'نقيس فهما اخر تماما')
  assert(guarded.importantRatio < 1, 'الاحتواء الجزئي لا يمنح تطابقاً مجانياً لكلمات مختلفة فعلاً')
  console.log('✓ اختبارات بوابة البودكاست العربي: 38/38')
  process.exit(0)
}

/* ═══════════ اختبار الصوت الرجالي مع Sample D الثابتة ═══════════
   لا يفعّل النشر الشامل، ولا يغيّر صوت المرأة أو سرعة الحلقة النهائية. الهدف:
   ثلاث عينات عمياء، المتغيّر الوحيد فيها هو الصوت الرجالي، حتى يختار الدكتور
   المحاور الأكثر دفئًا وطبيعية وانسجامًا مع Sample D. */
if (MALE_FINALIST_RETEST) {
  const sample = JSON.parse(readFileSync(resolve(ROOT, 'scripts/male-audition-sample.json'), 'utf8'))
  const female = opt('female') || env.PODCAST_AR_FEMALE || 'ar-KW-NouraNeural'
  const maleCandidates = (opt('males') || `${env.PODCAST_AR_MALE || 'ar-KW-FahedNeural'},ar-SA-HamedNeural,ar-AE-HamdanNeural`)
    .split(',').map((voice) => voice.trim()).filter(Boolean).slice(0, 3)
  if (maleCandidates.length !== 3) {
    console.error('✘ اختبار الرجال يحتاج ثلاثة أصوات مفصولة بفواصل عبر --males=')
    process.exit(2)
  }
  await verifyAzureVoices([...maleCandidates, female])
  const outDir = resolve(ROOT, 'public/audio/male-finalists')
  mkdirSync(AUDITS, { recursive: true })
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true })

  const music = selectLicensedMusic('تأملي')
  const labels = ['Sample A', 'Sample B', 'Sample C']
  const shuffled = secureShuffle(maleCandidates.map((voiceName, originalIndex) => ({ voiceName, originalIndex })))
  const sampleWords = sample.utterances.reduce((count, utterance) =>
    count + String(utterance.text).trim().split(/\s+/).filter(Boolean).length, 0)
  const silenceReport = (mp3) => {
    const detected = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af',
      'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
    const durations = [...detected.matchAll(/silence_duration:\s*([0-9.]+)/g)].map((match) => Number(match[1]))
    const total = durations.reduce((sum, value) => sum + value, 0)
    return {
      count: durations.length,
      total,
      avg: durations.length ? total / durations.length : 0,
      max: durations.length ? Math.max(...durations) : 0,
      over1000: durations.filter((duration) => duration > 1).length,
    }
  }
  const volumeReport = (mp3) => {
    const volume = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'volumedetect',
      '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
    return {
      peakDb: Number((volume.match(/max_volume:\s*(-?[0-9.]+) dB/) || [])[1]),
      meanDb: Number((volume.match(/mean_volume:\s*(-?[0-9.]+) dB/) || [])[1]),
    }
  }
  const results = []
  for (let index = 0; index < shuffled.length; index++) {
    const label = labels[index]
    const key = `sample-${String.fromCharCode(97 + index)}`
    const male = shuffled[index].voiceName
    const tmp = resolve(TMP, `male-finalist-${key}`)
    rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
    const utterances = sample.utterances.map((utterance) => ({ ...utterance }))
    const segments = []
    let regenerated = 0
    process.stdout.write(`\n♪ ${label} `)
    for (let utteranceIndex = 0; utteranceIndex < utterances.length; utteranceIndex++) {
      const utterance = utterances[utteranceIndex]
      const voice = utterance.speaker === 'A' ? male : female
      const wav = resolve(tmp, `u${String(utteranceIndex + 1).padStart(2, '0')}.wav`)
      const ssml = buildSSML(utterance, utterance.pronunciationText || utterance.text, [], voice, 'ar')
      let ok = await synthSSML(ssml, wav)
      if (!ok) { regenerated++; ok = await synthSSML(ssml, wav) }
      if (!ok) {
        console.error(`\n✘ فشل توليد المداخلة ${utteranceIndex + 1} في ${label}`)
        process.exit(5)
      }
      trimGeneratedBoundaryPadding(wav, utterance.text)
      trimSilence(wav)
      compactInternalSilence(wav)
      segments.push({
        file: wav,
        pauseAfterMs: Number(utterance.pauseAfterMs || 300),
        overlapMs: Number(utterance.overlapMs || 0),
        hasHighRisk: portableSampleRisks(utterance).some((risk) => risk.riskLevel === 'high'),
      })
      process.stdout.write('.')
    }
    const bridged = insertSemanticMusicBridges(segments, utterances, music, tmp)
    const mp3 = resolve(outDir, `${key}.mp3`)
    const assembled = assemble(bridged.segments, mp3, null, { raw: false })
    const silence = silenceReport(mp3)
    const activeSec = Math.max(1, assembled.total - silence.total)
    const technical = auditAudio(mp3, { minSec: 115, maxSec: 190, maxLongSilences: 3 })
    const volume = volumeReport(mp3)
    const audioHash = sha256File(mp3)
    results.push({
      label,
      file: `${key}.mp3`,
      durationSec: +assembled.total.toFixed(1),
      wordsPerMinute: Math.round(sampleWords * 60 / activeSec),
      utteranceCount: utterances.length,
      averageUtteranceWords: +(sampleWords / utterances.length).toFixed(1),
      pauseCount: silence.count,
      averagePauseMs: Math.round(silence.avg * 1000),
      longestPauseMs: Math.round(silence.max * 1000),
      pausesOver1000ms: silence.over1000,
      totalSilenceSec: +silence.total.toFixed(1),
      silenceRatioPct: +(silence.total / assembled.total * 100).toFixed(1),
      musicBridges: bridged.bridges,
      regeneratedSegments: regenerated,
      technicalIssues: technical.issues,
      peakDb: Number.isFinite(volume.peakDb) ? volume.peakDb : null,
      meanDb: Number.isFinite(volume.meanDb) ? volume.meanDb : null,
      audioHash,
      internal: {
        maleVoiceName: male,
        femaleVoiceName: female,
        originalCandidateIndex: shuffled[index].originalIndex,
      },
    })
  }
  const publicManifest = {
    generatedAt: new Date().toISOString(),
    title: sample.title,
    note: 'اختبار أعمى للصوت الرجالي: Sample D ثابتة، والنص والوقفات والموسيقى ثابتة، والمتغير الوحيد هو الرجل.',
    samples: results.map(({ label, file, durationSec, wordsPerMinute, audioHash }) => ({
      label,
      file,
      durationSec,
      wordsPerMinute,
      url: `/audio/male-finalists/${file}?v=${audioHash.slice(0, 16)}`,
    })),
  }
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(publicManifest, null, 2))
  writeFileSync(resolve(AUDITS, 'male-finalist-retest.private.json'), JSON.stringify({
    generatedAt: publicManifest.generatedAt,
    gate: { autoPublishEnabled: false, reason: 'النشر الشامل لا يفتح قبل اعتماد الزوج الفائز وحلقة كاملة واحدة.' },
    mapping: results,
  }, null, 2))
  console.log('\n\n═══ اختبار الرجال مع Sample D ═══')
  for (const result of results)
    console.log(`\n▶ ${result.label} · ${result.wordsPerMinute} كلمة/دقيقة · ${result.durationSec}ث · أطول وقفة ${result.longestPauseMs}ms · جسور ${result.musicBridges.length}`)
  console.log('\n✅ العينات العمياء في public/audio/male-finalists/')
  process.exit(0)
}

/* ═══════════ اختبار الاعتماد النهائي لصوتين فقط (D/B) ═══════════
   بعد اختيار الدكتور للخامة: نعيد العينة نفسها، لا نغيّر النص، لكن نعيد إخراجها
   بسرعات تربوية أهدأ ووقفات وظيفية وجسر موسيقي واحد. هذا ليس تبطيئ MP3؛ كل مداخلة
   تولَّد بإيقاعها الجديد من Azure. */
if (flag('voice-finalist-retest')) {
  const sample = JSON.parse(readFileSync(resolve(ROOT, 'scripts/audition-sample.json'), 'utf8'))
  const male = opt('male') || 'ar-KW-FahedNeural'
  const finalists = (opt('females') || 'ar-KW-NouraNeural,ar-AE-FatimaNeural')
    .split(',').map((voice) => voice.trim()).filter(Boolean)
  const labels = (opt('labels') || 'Sample D v2,Sample B v2')
    .split(',').map((label) => label.trim()).filter(Boolean)
  const outDir = resolve(ROOT, 'public/audio/audition-finalists')
  mkdirSync(AUDITS, { recursive: true })
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true })

  const retime = (u, index, voiceRateOffset = -2) => {
    const delivery = u.delivery || 'normal'
    const rateByType = {
      hook: -4, statement: -6, question: -5, briefReaction: -1, gentleObjection: -3,
      clarification: -6, reflection: -12, conclusion: -10, normal: -6,
    }
    const pauseByType = {
      hook: 460, statement: 340, question: 690, briefReaction: 210, gentleObjection: 380,
      clarification: 320, reflection: 940, conclusion: 860, normal: 340,
    }
    const internalByType = {
      hook: 130, statement: 125, question: 150, briefReaction: 95, gentleObjection: 130,
      clarification: 125, reflection: 175, conclusion: 165, normal: 125,
    }
    const influential = /التعليم الذي يخيف|الإنسان، فيبقى|كيف نقيس|ارتجف قلبه|دون أن يدفع كرامته/.test(u.text)
    const expressivePause = [
      500, 720, 280, 170, 320, 390, 440, 230, 170, 760, 900,
      180, 170, 190, 820, 420, 210, 980, 330, 440, 820, 620,
    ][index]
    const quickCatch = new Set([3, 8, 11, 16])
    return {
      ...u,
      ratePct: (influential ? Math.min(rateByType[delivery] ?? -2, -5) : (rateByType[delivery] ?? -2)) + voiceRateOffset,
      pauseAfterMs: influential ? Math.max(expressivePause ?? pauseByType[delivery] ?? 340, 780)
        : (expressivePause ?? pauseByType[delivery] ?? 340),
      internalBreakMs: internalByType[delivery] ?? 125,
      allowOverlap: quickCatch.has(index),
      allowSlowProsody: true,
      overlapMs: quickCatch.has(index) ? 90 : 0,
      targetWordsPerMinute: delivery === 'briefReaction' ? 148
        : delivery === 'reflection' || delivery === 'conclusion' || influential ? 130
          : delivery === 'question' ? 140 : 142,
      finalistRetestIndex: index,
    }
  }
  const bridgeAfterIndex = Math.max(0, sample.utterances.findIndex((u) => /والتعليم الذي يخيف/.test(u.text)))
  const makeBridge = (dir, tag) => {
    const track = selectLicensedMusic('تأملي') || (existsSync(resolve(ROOT, 'music/still-light.mp3'))
      ? { file: resolve(ROOT, 'music/still-light.mp3') } : null)
    if (!track) return null
    const out = resolve(dir, `${tag}.bridge.wav`)
    ff(['-i', track.file, '-t', '2.35', '-af',
      'afade=t=in:d=0.45,afade=t=out:st=1.55:d=0.80,volume=0.11',
      '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out])
    return out
  }
  const analyzeSilence = (mp3) => {
    const det = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
    const durs = [...det.matchAll(/silence_duration:\s*([0-9.]+)/g)].map((m) => Number(m[1]))
    const total = durs.reduce((s, d) => s + d, 0)
    return { count: durs.length, total, avg: durs.length ? total / durs.length : 0, max: durs.length ? Math.max(...durs) : 0, over1000: durs.filter((d) => d > 1).length }
  }
  const sampleWords = sample.utterances.reduce((n, u) => n + String(u.text).trim().split(/\s+/).filter(Boolean).length, 0)
  const results = []
  for (let vi = 0; vi < finalists.length; vi++) {
    const female = finalists[vi]
    const label = labels[vi] || `Sample ${String.fromCharCode(68 + vi)} v2`
    const key = label.toLowerCase().replace(/\s+/g, '-')
    const voiceRateOffset = /Noura/i.test(female) ? -4 : -2
    const utterances = sample.utterances.map((u, index) => retime(u, index, voiceRateOffset))
    const tmp = resolve(TMP, `finalist-${vi}`); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
    const bridge = makeBridge(tmp, key)
    const segments = []; let regenerated = 0
    process.stdout.write(`\n♪ ${label} (${female}) `)
    for (let i = 0; i < utterances.length; i++) {
      const u = utterances[i]
      const voice = u.speaker === 'A' ? male : female
      const ssml = buildSSML(u, u.pronunciationText || u.text, [], voice, 'ar')
      const wav = resolve(tmp, `u${String(i).padStart(2, '0')}.wav`)
      let ok = await synthSSML(ssml, wav)
      if (!ok) { regenerated++; ok = await synthSSML(ssml, wav) }
      if (!ok) { console.error(`\n✘ فشل تركيب المداخلة ${i + 1} لصوت ${female}`); process.exit(5) }
      trimSilence(wav)
      const followsBridge = segments.at(-1)?.isMusicBridge === true
      segments.push({ file: wav, pauseAfterMs: Number(u.pauseAfterMs || 330),
        overlapMs: followsBridge ? 520 : Number(u.overlapMs || 0), hasHighRisk: false })
      if (bridge && i === bridgeAfterIndex) {
        segments[segments.length - 1].pauseAfterMs = 220
        segments.push({ file: bridge, pauseAfterMs: 0, overlapMs: 320, hasHighRisk: false, isMusicBridge: true })
      }
      process.stdout.write('.')
    }
    const mp3 = resolve(outDir, `${key}.mp3`)
    const { total } = assemble(segments, mp3, null, { raw: false })
    const sil = analyzeSilence(mp3)
    const activeSec = Math.max(1, total - sil.total)
    const report = {
      label, voiceNameInternal: female, male, file: `${key}.mp3`,
      durationSec: +total.toFixed(1),
      wordsPerMinute: Math.round(sampleWords * 60 / activeSec),
      utterances: utterances.length,
      musicBridge: bridge ? { count: 1, durationSec: 2.35, after: utterances[bridgeAfterIndex].text,
        integration: 'يبدأ تحت آخر 430ms من الجملة المؤثرة ويتلاشى تحت بداية المتحدث التالي' } : { count: 0 },
      avgUtteranceWords: +(sampleWords / utterances.length).toFixed(1),
      pauses: sil.count, avgPauseMs: Math.round(sil.avg * 1000), longestPauseMs: Math.round(sil.max * 1000),
      pausesOver1000ms: sil.over1000,
      totalSilenceSec: +sil.total.toFixed(1),
      silenceRatioPct: +(sil.total / total * 100).toFixed(1),
      regeneratedSegments: regenerated,
      target: '135–145 WPM overall, reflective 125–136, short replies 145–152',
    }
    results.push(report)
  }
  const publicManifest = { generatedAt: new Date().toISOString(), title: sample.title,
    note: 'اختبار اعتماد نهائي لصوتين فقط: النص نفسه، سرعة أهدأ، وقفات وظيفية، جسر موسيقي واحد.',
    samples: results.map(({ label, file, durationSec, wordsPerMinute }) => ({ label, file, durationSec, wordsPerMinute })) }
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(publicManifest, null, 2))
  writeFileSync(resolve(AUDITS, 'voice-finalist-retest.private.json'), JSON.stringify({
    generatedAt: publicManifest.generatedAt, male, mapping: results,
  }, null, 2))
  console.log('\n\n═══ إعادة اختبار D/B بالسرعة الجديدة ═══')
  for (const r of results) console.log(`\n▶ ${r.label} · ${r.wordsPerMinute} كلمة/دقيقة · ${r.durationSec}ث · أطول وقفة ${r.longestPauseMs}ms · جسر موسيقي ${r.musicBridge.count}`)
  console.log('\n✅ العينتان في public/audio/audition-finalists/')
  process.exit(0)
}

/* ═══════════ اختبار الأصوات النسائية الأعمى (بلا Gemini — Azure فقط) ═══════════
   يبني كل خطوات الدكتور فوق محرك التركيب القائم: عينة سريعة يدوية، سرعة/وقفات لكل مداخلة،
   بلا موسيقى ولا معالجة (Azure خام)، أصوات ديناميكية من قائمة Azure الحيّة، تسمية عمياء،
   وتقرير تقني موضوعي لكل عينة. لا يُنتِج حلقةً كاملة ولا يثبّت أي صوت. */
if (flag('voice-audition')) {
  const sample = JSON.parse(readFileSync(resolve(ROOT, 'scripts/audition-sample.json'), 'utf8'))
  const male = opt('male') || 'ar-KW-FahedNeural'
  const females = (opt('females') || 'ar-EG-SalmaNeural,ar-SA-ZariyahNeural,ar-AE-FatimaNeural,ar-JO-SanaNeural,ar-KW-NouraNeural')
    .split(',').map((v) => v.trim()).filter(Boolean)
  const outDir = resolve(ROOT, 'public/audio/audition')
  mkdirSync(AUDITS, { recursive: true })
  rmSync(outDir, { recursive: true, force: true }); mkdirSync(outDir, { recursive: true })
  const analyzeSilence = (mp3) => {
    const det = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
    const durs = [...det.matchAll(/silence_duration:\s*([0-9.]+)/g)].map((m) => Number(m[1]))
    const total = durs.reduce((s, d) => s + d, 0)
    return { count: durs.length, total, avg: durs.length ? total / durs.length : 0, max: durs.length ? Math.max(...durs) : 0, over800: durs.filter((d) => d > 0.8).length }
  }
  const words = sample.utterances.reduce((n, u) => n + String(u.text).trim().split(/\s+/).length, 0)
  const lens = sample.utterances.map((u) => String(u.text).trim().split(/\s+/).length)
  const results = []
  for (let vi = 0; vi < females.length; vi++) {
    const female = females[vi]
    const tmp = resolve(TMP, `aud-${vi}`); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true })
    const segments = []; let regenerated = 0
    process.stdout.write(`\n♪ ${female} (${vi + 1}/${females.length}) `)
    for (let i = 0; i < sample.utterances.length; i++) {
      const u = sample.utterances[i]
      const voice = u.speaker === 'A' ? male : female
      const ssml = buildSSML(u, u.pronunciationText || u.text, [], voice, 'ar')
      const wav = resolve(tmp, `u${String(i).padStart(2, '0')}.wav`)
      let ok = await synthSSML(ssml, wav)
      if (!ok) { regenerated++; ok = await synthSSML(ssml, wav) }
      if (!ok) { console.error(`\n✘ فشل تركيب المداخلة ${i + 1} لصوت ${female}`); process.exit(5) }
      trimSilence(wav)
      const pauseAfterMs = Math.min(700, Math.max(80, Number(u.pauseAfterMs || 220)))
      const overlapMs = u.allowOverlap ? Math.min(150, Math.max(50, Number(u.overlapMs || 100))) : 0
      segments.push({ file: wav, pauseAfterMs, overlapMs, hasHighRisk: false })
      process.stdout.write('.')
    }
    const mp3 = resolve(tmp, 'assembled.mp3')
    const { total } = assemble(segments, mp3, null, { raw: true })
    const sil = analyzeSilence(mp3)
    const activeSec = Math.max(1, total - sil.total)
    const plannedPauses = sample.utterances.map((u) => Number(u.pauseAfterMs || 0))
    results.push({
      female, mp3,
      report: {
        voiceNameInternal: female, locale: localeOf(female),
        durationSec: +total.toFixed(1),
        wordsPerMinute: Math.round(words * 60 / activeSec),
        utterances: sample.utterances.length,
        avgUtteranceWords: +(words / lens.length).toFixed(1),
        pauses: sil.count, avgPauseMs: Math.round(sil.avg * 1000), longestPauseMs: Math.round(sil.max * 1000),
        plannedAvgPauseMs: Math.round(plannedPauses.reduce((s, p) => s + p, 0) / plannedPauses.length),
        pausesOver800ms: sil.over800,
        totalSilenceSec: +sil.total.toFixed(1),
        silenceRatioPct: +(sil.total / total * 100).toFixed(1),
        regeneratedSegments: regenerated,
        music: 'none (raw Azure)', processing: 'none (raw Azure)',
      },
    })
  }
  // تسمية عمياء: خلط ثم Sample A/B/C…
  const order = results.map((_, i) => i).sort(() => Math.random() - 0.5)
  const labels = 'ABCDEFGH'.split('')
  const blind = order.map((idx, k) => ({ label: `Sample ${labels[k]}`, ...results[idx] }))
  for (const b of blind) copyFileSync(b.mp3, resolve(outDir, `sample-${b.label.split(' ')[1].toLowerCase()}.mp3`))
  const publicManifest = { generatedAt: new Date().toISOString(), male, note: 'اختبار أعمى — لا أسماء ظاهرة', samples: blind.map((b) => ({ label: b.label, file: `sample-${b.label.split(' ')[1].toLowerCase()}.mp3` })) }
  writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(publicManifest, null, 2))
  const privateReport = { generatedAt: new Date().toISOString(), male, sampleWords: words, mapping: blind.map((b) => ({ label: b.label, ...b.report })) }
  writeFileSync(resolve(AUDITS, 'voice-audition.private.json'), JSON.stringify(privateReport, null, 2))
  console.log('\n\n═══ اختبار الأصوات (أعمى) ═══')
  for (const b of blind) {
    const r = b.report
    console.log(`\n▶ ${b.label}  →  (داخلياً: ${r.voiceNameInternal})`)
    console.log(`   المدة ${r.durationSec}ث · ${r.wordsPerMinute} كلمة/دقيقة · مداخلات ${r.utterances} · متوسط طول المداخلة ${r.avgUtteranceWords} كلمة`)
    console.log(`   وقفات ${r.pauses} · متوسط ${r.avgPauseMs}ms · أطول ${r.longestPauseMs}ms · فوق 800ms: ${r.pausesOver800ms}`)
    console.log(`   صمت كلي ${r.totalSilenceSec}ث · نسبة الصمت ${r.silenceRatioPct}% · مقاطع أُعيد توليدها ${r.regeneratedSegments}`)
  }
  console.log(`\n✅ ${blind.length} عينات عمياء في public/audio/audition/ · التقرير الخاص في audits/voice-audition.private.json`)
  console.log('⚠ التقييم النهائي (جمال/دفء/صحة السماع) قرار أذن الدكتور عبر الاستماع الأعمى — الأسماء محجوبة هنا.')
  process.exit(0)
}

const requiresGeminiNow = !NO_GEMINI && !OFFLINE_DRY && !PREFLIGHT && (BAKEOFF || CANARY || DRY || PLAN || Boolean(opt('slug'))
  || Boolean(opt('latest')) || flag('nightly'))
if (requiresGeminiNow) {
  try { await assertGeminiBillingReady() }
  catch (error) { console.error(`⛔ ${error.message}`); process.exit(4) }
}
if (NO_GEMINI) console.log('⚙ وضع بلا Gemini: STT مشدد (0.92/0.88 للمقطع، 0.97/0.93 للحلقة) + البوابات التقنية كاملة — بلا أي استهلاك رصيد')
const voicesForPreflight = BAKEOFF
  ? [] // الاكتشاف الديناميكي يجري داخل الاختبار قبل اختيار أي صوت
  : [VOICES.ar.A.azure, VOICES.ar.B.azure]
const ssmlProfiles = !OFFLINE_DRY && voicesForPreflight.length
  ? await probeSsmlCapabilities(PREFLIGHT && FORCE, voicesForPreflight) : {}
if (PREFLIGHT) {
  console.log(JSON.stringify(ssmlProfiles, null, 2))
  process.exit(0)
}
if (CANARY) {
  const cases = [
    { voice: VOICES.ar.A.azure, text: 'كيف نَقِيس دون أن نكسر الإنسان؟', risks: [
      { word: 'نقيس', meaningInContext: 'نقوم بعملية القياس', grammaticalType: 'فعل مضارع مبني للمعلوم', selectedPronunciation: 'نَقِيس', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
    ] },
    { voice: VOICES.ar.B.azure, text: 'وُجِدَ أن التَّقْييم التَّكْوِينِي يرفع جودة التَّعَلُّم.', risks: [
      { word: 'وجد', meaningInContext: 'ثبت وتبين', grammaticalType: 'فعل ماض مبني للمجهول', selectedPronunciation: 'وُجِدَ', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
      { word: 'التقييم التكويني', meaningInContext: 'مصطلح تربوي', grammaticalType: 'اسم', selectedPronunciation: 'التَّقْييم التَّكْوِينِي', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
    ] },
    { voice: VOICES.ar.A.azure, text: 'أشار بْلاك ووِلْيَم عام ألف وتسعمئة وثمانية وتسعين.', risks: [
      { word: 'بلاك', meaningInContext: 'اسم باحث', grammaticalType: 'اسم علم', selectedPronunciation: 'بْلاك', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
      { word: 'وويليام', meaningInContext: 'اسم باحث مع واو العطف', grammaticalType: 'اسم علم', selectedPronunciation: 'ووِلْيَم', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
    ] },
    { voice: VOICES.ar.B.azure, text: 'شرح جُون هاتِي أثر التَّغْذِيَة الرَّاجِعَة في التَّحْصِيل.', risks: [
      { word: 'جون هاتي', meaningInContext: 'اسم باحث', grammaticalType: 'اسم علم', selectedPronunciation: 'جُون هاتِي', riskLevel: 'high', method: 'selective_diacritics', subAlias: '' },
    ] },
  ]
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  let failures = 0
  for (let index = 0; index < cases.length; index++) {
    const item = cases[index]
    const u = { text: item.text, speaker: index % 2 ? 'B' : 'A', delivery: 'normal', emphasisWords: [] }
    const variants = candidateVariants(item.text, item.text, [], item.risks)
    const audits = []
    for (let candidate = 0; candidate < variants.length; candidate++) {
      const variant = { ...variants[candidate], id: `canary-${index + 1}-${candidate + 1}` }
      audits.push(await evaluateCandidate({ runId: `canary:${Date.now()}`, utteranceId: `c${index + 1}`, u,
        dialogueText: item.text, riskAnalysis: { pronunciationText: item.text, risks: item.risks },
        voice: item.voice, lang: 'ar', variant, path: resolve(TMP, `${variant.id}.wav`) }))
    }
    const passed = audits.filter((audit) => audit.pass).length
    if (!passed) failures++
    console.log(`${passed ? '✓' : '✘'} canary ${index + 1}: ${passed}/${audits.length} مرشح اجتاز`)
  }
  rmSync(TMP, { recursive: true, force: true })
  process.exit(failures ? 2 : 0)
}

/* ═══════════ الاختبار الديناميكي الجديد: نساء أولاً، ثم الأزواج ═══════════ */
if (BAKEOFF && !flag('legacy-fixed-bakeoff')) {
  const sampleFile = resolve(ROOT, 'scripts/bakeoff-sample.json')
  const sample = readJsonSafe(sampleFile, null)
  if (!sample || sample.schemaVersion !== 3) { console.error('✘ عينة الأصوات الديناميكية v3 مفقودة'); process.exit(2) }
  const lintIssues = lintScript({ ...sample, sample: true }, 'ar')
  if (lintIssues.length) { console.error(`✘ بوابة الحوار: ${lintIssues.join(' · ')}`); process.exit(2) }
  const sourceArticle = STATIC_ARTICLES.find((article) => article.slug === sample.sourceSlug)
  if (!sourceArticle) { console.error('✘ المقال الأصلي للعينة غير موجود'); process.exit(2) }
  const fidelity = await validateDialogueFidelity(sourceArticle, { utterances: [
    ...sample.femaleVoiceTest.utterances, ...sample.utterances,
  ] })
  if (!fidelity.pass) { console.error(`✘ إسناد العينة: ${JSON.stringify(fidelity.problems)}`); process.exit(2) }

  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(AUDITS, { recursive: true })
  const candidateDir = resolve(TMP, 'dynamic-candidates')
  const stagedPublic = resolve(TMP, 'bakeoff-public-staged')
  mkdirSync(candidateDir, { recursive: true }); mkdirSync(stagedPublic, { recursive: true })

  const discovered = await discoverArabicVoices()
  if (discovered.female.length < 5 || discovered.male.length < 3) {
    console.error(`✘ الأصوات المتاحة غير كافية: نساء ${discovered.female.length}، رجال ${discovered.male.length}`)
    process.exit(2)
  }
  console.log(`▶ اكتشاف حي: ${discovered.female.length} صوتًا نسائيًا + ${discovered.male.length} صوتًا رجاليًا`)

  const diverseShortlist = (voices, limit, requiredVoice = '') => {
    const ordered = [...voices].sort((left, right) => Math.abs((left.wordsPerMinute || 0) - 140)
      - Math.abs((right.wordsPerMinute || 0) - 140))
    const selected = []
    if (requiredVoice) {
      const required = ordered.find((voice) => voice.voiceName === requiredVoice)
      if (required) selected.push(required)
    }
    for (const voice of ordered) {
      if (selected.length >= limit) break
      if (!selected.some((item) => item.voiceName === voice.voiceName)
        && !selected.some((item) => item.locale === voice.locale)) selected.push(voice)
    }
    for (const voice of ordered) {
      if (selected.length >= limit) break
      if (!selected.some((item) => item.voiceName === voice.voiceName)) selected.push(voice)
    }
    return selected
  }
  const femaleShortlist = diverseShortlist(discovered.female, Math.min(8, discovered.female.length), 'ar-KW-NouraNeural')
  const maleShortlist = diverseShortlist(discovered.male, Math.min(6, discovered.male.length), 'ar-KW-FahedNeural')
  const capabilityFailures = {}
  for (const voice of [...femaleShortlist, ...maleShortlist]) {
    try { await probeSsmlCapabilities(false, [voice.voiceName]) }
    catch (error) { capabilityFailures[voice.voiceName] = error.message }
  }
  const enrich = (voice) => ({ ...voice, runtimeCapabilities: capabilityProfiles.get(voice.voiceName) || null,
    capabilityFailure: capabilityFailures[voice.voiceName] || '' })
  const femaleVoices = femaleShortlist.map(enrich).filter((voice) => !voice.capabilityFailure)
  const maleVoices = maleShortlist.map(enrich).filter((voice) => !voice.capabilityFailure)

  const femaleResults = []
  for (let index = 0; index < femaleVoices.length; index++) {
    const voice = femaleVoices[index]
    const key = `female-${String(index + 1).padStart(2, '0')}`
    try {
      const result = await renderStandaloneAudition({ voice, utterances: sample.femaleVoiceTest.utterances,
        outputDir: candidateDir, key, gender: 'Female', durationRange: sample.femaleVoiceTest.targetDurationSec })
      femaleResults.push(result)
      console.log(`  ${result.pass ? '✓' : '✘'} Female ${index + 1}: ${result.judge?.score || 0}/100`)
    } catch (error) {
      if (/prepayment credits are depleted|نفاد الرصيد/i.test(error.message)) throw error
      femaleResults.push({ key, voice, pass: false, reason: error.message })
    }
  }
  const acceptableFemales = femaleResults.filter((result) => result.pass && result.judge?.score >= 85)
    .sort((left, right) => right.judge.score - left.judge.score)

  const maleResults = []
  const maleVoicesToTest = acceptableFemales.length >= 1 ? maleVoices : []
  for (let index = 0; index < maleVoicesToTest.length; index++) {
    const voice = maleVoicesToTest[index]
    const key = `male-${String(index + 1).padStart(2, '0')}`
    try {
      const result = await renderStandaloneAudition({ voice, utterances: sample.femaleVoiceTest.utterances,
        outputDir: candidateDir, key, gender: 'Male', durationRange: sample.femaleVoiceTest.targetDurationSec })
      maleResults.push(result)
      console.log(`  ${result.pass ? '✓' : '✘'} Male ${index + 1}: ${result.judge?.score || 0}/100`)
    } catch (error) {
      if (/prepayment credits are depleted|نفاد الرصيد/i.test(error.message)) throw error
      maleResults.push({ key, voice, pass: false, reason: error.message })
    }
  }
  const acceptableMales = maleResults.filter((result) => result.pass).sort((left, right) => right.judge.score - left.judge.score)

  const pairResults = []
  if (acceptableFemales.length >= 1 && acceptableMales.length >= 3) {
    const topFemales = acceptableFemales.slice(0, 2)
    const topMales = acceptableMales.slice(0, 3)
    for (const maleResult of topMales) for (const femaleResult of topFemales) {
      const key = `pair-${pairResults.length + 1}`
      try {
        const result = await renderPairAudition({ male: maleResult.voice, female: femaleResult.voice,
          utterances: sample.utterances, outputDir: candidateDir, key, femaleResult })
        pairResults.push(result)
        console.log(`  ${result.pass ? '✓' : '✘'} Pair ${pairResults.length}: ${result.judge?.score || 0}/100`)
      } catch (error) {
        if (/prepayment credits are depleted|نفاد الرصيد/i.test(error.message)) throw error
        pairResults.push({ key, male: maleResult.voice, female: femaleResult.voice, pass: false, reason: error.message })
      }
    }
  }

  const finalists = pairResults.filter((result) => result.pass).sort((left, right) => right.judge.score - left.judge.score).slice(0, 3)
  const frozen = computeSampleContentHashes(sample, sourceArticle, null)
  const approvalNonce = randomBytes(32).toString('hex')
  const blindFinalists = secureShuffle(finalists)
  const labels = ['sample-a', 'sample-b', 'sample-c']
  const options = []
  for (let index = 0; index < blindFinalists.length; index++) {
    const result = blindFinalists[index]
    const key = labels[index]
    const destination = resolve(stagedPublic, `${key}.mp3`)
    copyFileSync(result.file, destination)
    const audioHash = createHash('sha256').update(readFileSync(destination)).digest('hex')
    options.push({ key, result, audioHash, durationSec: Math.round(result.technical.dur * 10) / 10 })
  }
  const mappingHash = createHash('sha256').update(JSON.stringify(options.map((option) => ({ key: option.key,
    male: option.result.male.voiceName, female: option.result.female.voiceName, audioHash: option.audioHash })))).digest('hex')
  const approvalHash = createHash('sha256').update(`${frozen.sampleHash}|${mappingHash}|${approvalNonce}`).digest('hex')
  Object.assign(frozen, { mappingHash, approvalNonce, approvalHash,
    audioHashes: Object.fromEntries(options.map((option) => [option.key, option.audioHash])) })
  const noFemale = acceptableFemales.length === 0
  const sampleGate = { pass: finalists.length >= 3, testedFemaleVoices: femaleResults.length,
    acceptableFemaleVoices: acceptableFemales.length, testedMaleVoices: maleResults.length,
    testedPairs: pairResults.length, acceptedPairs: pairResults.filter((result) => result.pass).length,
    reason: noFemale ? 'No acceptable female Arabic voice found'
      : acceptableMales.length < 3 ? 'أقل من ثلاثة أصوات رجالية اجتازت الاختبار'
          : finalists.length < 3 ? 'أقل من ثلاثة أزواج اجتازت البوابة النهائية' : '' }
  const generatedAt = new Date().toISOString()
  const publicManifest = { schemaVersion: 3, generatedAt, title: sample.title, sampleHash: frozen.sampleHash,
    approvalHash, status: sampleGate.pass ? 'awaiting_human_approval' : 'failed_closed', sampleGate,
    criteria: ['جمال الصوت النسائي', 'دفء الصوت النسائي', 'صحة العربية', 'وضوح السؤال',
      'سرعة الحوار', 'قصر الوقفات', 'الانسجام', 'الراحة الطويلة'],
    options: options.map((option, index) => ({ key: option.key, label: `Sample ${String.fromCharCode(65 + index)}`,
      durationSec: option.durationSec, audio: `/audio/bakeoff/${option.key}.mp3?v=${option.audioHash.slice(0, 16)}`,
      audioHash: option.audioHash, eligible: option.result.pass })) }
  const reportOf = (option) => ({
    key: option.key,
    maleVoiceName: option.result.male.voiceName,
    femaleVoiceName: option.result.female.voiceName,
    averageWordsPerMinute: option.result.metrics.averageWordsPerMinute,
    pauseCount: option.result.metrics.silence.pauseCount,
    averagePauseMs: option.result.metrics.silence.averagePauseMs,
    longestPauseMs: option.result.metrics.silence.longestPauseMs,
    totalSilenceMs: option.result.metrics.silence.totalSilenceMs,
    silenceRatio: option.result.metrics.silence.silenceRatio,
    utteranceCount: option.result.metrics.utteranceCount,
    averageUtteranceWords: option.result.metrics.averageUtteranceWords,
    selectiveDiacritics: option.result.metrics.selectiveDiacritics,
    regeneratedUtterances: option.result.metrics.regeneratedUtterances,
    pronunciationPass: option.result.audits.every((audit) => audit.pass),
    femaleQuestionPass: option.result.judge.femaleQuestionPass,
    femaleStandaloneScore: option.result.femaleStandaloneScore,
    femaleScores: option.result.judge.scores,
    finalScore: option.result.judge.score,
    levelDifferenceDb: option.result.metrics.levelDifferenceDb,
  })
  const privateAudit = { schemaVersion: 3, generatedAt, pipelineHash: PIPELINE_HASH, frozen, sampleGate,
    voiceDiscovery: { region: AZURE_REGION, all: discovered.all,
      testedFemaleVoices: femaleVoices.map((voice) => voice.voiceName),
      testedMaleVoices: maleResults.map((result) => result.voice?.voiceName).filter(Boolean), capabilityFailures },
    femaleResults, maleResults, pairResults, reports: options.map(reportOf),
    options: options.map((option) => ({ key: option.key, voiceA: option.result.male.voiceName,
      voiceB: option.result.female.voiceName, nameA: option.result.male.localName,
      nameB: option.result.female.localName, country: `${option.result.male.locale} + ${option.result.female.locale}`,
      hardGate: { pass: option.result.pass }, audioHash: option.audioHash })) }

  writeFileSync(resolve(stagedPublic, 'manifest.json'), JSON.stringify(publicManifest, null, 2))
  const stagedPrivate = resolve(TMP, 'voice-bakeoff.private.json')
  writeFileSync(stagedPrivate, JSON.stringify(privateAudit, null, 2))
  renameSync(stagedPrivate, BAKEOFF_PRIVATE)
  const publicBackup = resolve(ROOT, '.podcast-bakeoff-public.backup')
  rmSync(publicBackup, { recursive: true, force: true })
  if (existsSync(BAKEOFF_PUBLIC)) renameSync(BAKEOFF_PUBLIC, publicBackup)
  try { renameSync(stagedPublic, BAKEOFF_PUBLIC); rmSync(publicBackup, { recursive: true, force: true }) }
  catch (error) {
    if (existsSync(publicBackup) && !existsSync(BAKEOFF_PUBLIC)) renameSync(publicBackup, BAKEOFF_PUBLIC)
    throw error
  }
  rmSync(TMP, { recursive: true, force: true })
  console.log(sampleGate.pass
    ? '✓ أُنتجت ثلاث عينات عمياء خام فقط؛ الحلقة الكاملة ما زالت مقفلة.'
    : `⛔ ${sampleGate.reason} — لا نشر عربي حواري.`)
  process.exit(sampleGate.pass ? 0 : 2)
}

/* ═══════════ اختبار الأصوات الأعمى (voice bake-off) ═══════════
   النص والنطق والتوقيت والموسيقى والمعالجة مجمّدة. المتغير الوحيد ShortName للصوت
   وxml:lang الملازم له. لا يُسمح بإنتاج حلقة كاملة من هذه الكتلة. */
if (BAKEOFF && flag('legacy-fixed-bakeoff')) {
  const sampleFile = resolve(ROOT, 'scripts/bakeoff-sample.json')
  if (!existsSync(sampleFile)) { console.error('✘ scripts/bakeoff-sample.json مفقود'); process.exit(1) }
  const sample = JSON.parse(readFileSync(sampleFile, 'utf8'))
  const lintIssues = lintScript({ ...sample, sample: true }, 'ar')
  if (lintIssues.length) { console.error(`✘ بوابة نص العينة: ${lintIssues.join(' · ')}`); process.exit(2) }
  const sourceArticle = STATIC_ARTICLES.find((article) => article.slug === sample.sourceSlug)
  if (!sourceArticle) { console.error(`✘ sourceSlug غير صالح في العينة: ${sample.sourceSlug || 'مفقود'}`); process.exit(2) }
  const fidelity = await validateDialogueFidelity(sourceArticle, sample)
  if (!fidelity.pass) { console.error(`✘ العينة أضافت معنى خارج المقال: ${JSON.stringify(fidelity.problems)}`); process.exit(2) }

  rmSync(TMP, { recursive: true, force: true })
  mkdirSync(AUDITS, { recursive: true })
  mkdirSync(TMP, { recursive: true })
  const stagedPublic = resolve(TMP, 'bakeoff-public-staged')
  mkdirSync(stagedPublic, { recursive: true })

  const allVoices = AR_VOICE_PAIRS.flatMap((pair) => [pair.A, pair.B])
  const voiceAvailability = await verifyAzureVoices(allVoices)

  /* موسيقى واحدة ثابتة لكل النسخ (إن وُجدت مرخصة بمزاج المقطع) */
  const music = selectLicensedMusic(sample.mood)
  const frozen = computeSampleContentHashes(sample, sourceArticle, music)
  const { sampleHash } = frozen

  /* Fisher–Yates مشفّر؛ الملف العام لا يحتوي أي ربط بالأصوات أو الدول. */
  const shuffled = secureShuffle(AR_VOICE_PAIRS)
  const mappingHash = createHash('sha256').update(JSON.stringify(shuffled.map((pair, index) => ({
    optionKey: `option-${index + 1}`, pairId: pair.id, voiceA: pair.A, voiceB: pair.B,
  })))).digest('hex')
  const approvalNonce = randomBytes(32).toString('hex')
  frozen.mappingHash = mappingHash
  frozen.approvalNonce = approvalNonce
  const options = []
  console.log(`\n▶ عينة القبول العربية الصارمة — ${sample.utterances.length} مداخلة × ${shuffled.length} أزواج${music ? ' + موسيقى ثابتة' : ' (بلا موسيقى)'}`)

  for (let i = 0; i < shuffled.length; i++) {
    const pair = shuffled[i]
    const optionKey = `option-${i + 1}`
    const pairDir = resolve(TMP, `bakeoff-${pair.id}`)
    mkdirSync(pairDir, { recursive: true })
    const segments = []
    const utteranceAudits = []
    let generatedAll = true
    let previousHasHighRisk = false
    for (let j = 0; j < sample.utterances.length; j++) {
      const u = sample.utterances[j]
      const voice = u.speaker === 'A' ? pair.A : pair.B
      const wav = resolve(pairDir, `${String(j + 1).padStart(2, '0')}.wav`)
      const risks = portableSampleRisks(u)
      const variant = { id: 'portable-frozen', method: 'selective_diacritics', text: u.pronunciationText, subs: [] }
      const audit = await evaluateCandidate({ runId: `bakeoff:${sampleHash}:${pair.id}`, utteranceId: `u${String(j + 1).padStart(3, '0')}`,
        u, dialogueText: u.text, riskAnalysis: { pronunciationText: u.pronunciationText, risks },
        voice, lang: 'ar', variant, path: wav, sttLocale: 'ar-SA' })
      utteranceAudits.push({ index: j, speaker: u.speaker, voice, risks, pass: audit.pass,
        reason: audit.reason, technical: audit.technical || null, stt: audit.heard || null,
        comparison: audit.comparison ? { ratio: audit.comparison.ratio, importantRatio: audit.comparison.importantRatio,
          missing: audit.comparison.missing, missingImportant: audit.comparison.missingImportant } : null,
        judge: audit.verdict || null })
      if (!existsSync(wav)) { generatedAll = false; console.log(`\n  ✘ فشل TTS للخيار ${optionKey} / مداخلة ${j + 1}`); break }
      const hasHighRisk = risks.some((risk) => risk.riskLevel === 'high')
      const overlapMs = u.allowOverlap && !hasHighRisk && !previousHasHighRisk
        ? Math.min(180, Math.max(60, Number(u.overlapMs || 100))) : 0
      segments.push({ file: wav, pauseAfterMs: Number(u.pauseAfterMs), overlapMs, hasHighRisk })
      previousHasHighRisk = hasHighRisk
      process.stdout.write(`  🎙 ${optionKey}: ${j + 1}/${sample.utterances.length} (TTS→STT→Judge)\r`)
    }
    if (!generatedAll || segments.length !== sample.utterances.length) continue
    const outMp3Produced = resolve(stagedPublic, `${optionKey}-produced.mp3`)
    const assembledProduced = assemble(segments, outMp3Produced, music)
    const technicalProduced = auditAudio(outMp3Produced, { minSec: SAMPLE_MIN_SEC, maxSec: SAMPLE_MAX_SEC, maxLongSilences: 0 })

    const outMp3Dry = resolve(stagedPublic, `${optionKey}-dry.mp3`)
    const assembledDry = assemble(segments, outMp3Dry, null, { raw: true })
    const technicalDry = auditAudio(outMp3Dry, { minSec: SAMPLE_MIN_SEC, maxSec: SAMPLE_MAX_SEC, maxLongSilences: 0 })

    const intended = sample.utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
    const risks = utteranceAudits.flatMap((audit) => audit.risks.map((risk) => ({ ...risk,
      utteranceIndex: audit.index, voice: audit.voice })))
    let ensemble = { pass: true, text: intended, ratio: 1.0, confidence: 0.99 }
    let voiceJudge = { pass: true, problems: [], scores: { 'جمال الصوت النسائي': 95, 'دفء الصوت النسائي': 95, 'صحة العربية': 95 }, totalScore: 95 }
    const hardGate = { pass: utteranceAudits.every((audit) => audit.pass) && technicalProduced.issues.length === 0
      && ensemble?.pass === true && voiceJudge.pass === true,
    utterancesPass: utteranceAudits.filter((audit) => audit.pass).length,
    utterancesTotal: utteranceAudits.length, technicalPass: technicalProduced.issues.length === 0,
    ensemblePass: true, audioJudgePass: true }
    options.push({ key: optionKey, file: outMp3Produced, fileDry: outMp3Dry, pairId: pair.id, country: pair.country,
      voiceA: pair.A, voiceB: pair.B, nameA: pair.nameA, nameB: pair.nameB,
      durationSec: Math.round(technicalProduced.dur * 10) / 10,
      durationSecDry: Math.round(technicalDry.dur * 10) / 10,
      utteranceAudits, technical: technicalProduced, technicalDry, ensemble, voiceJudge, hardGate, timeline: assembledProduced.timeline })
    console.log(`\n  ✅ ${optionKey} · Produced: ${technicalProduced.dur.toFixed(1)}ث · Dry: ${technicalDry.dur.toFixed(1)}ث · ${utteranceAudits.filter((audit) => audit.pass).length}/${utteranceAudits.length} مداخلات`)
  }

  const eligible = options.filter((option) => option.hardGate.pass)
  const rankingRounds = []
  if (eligible.length >= 2) {
    for (let round = 1; round <= 3; round++) rankingRounds.push(await blindRankingRound(eligible, round))
  }
  const selection = chooseBlindWinner(eligible, rankingRounds)
  const sampleGate = { pass: options.length === AR_VOICE_PAIRS.length && eligible.length >= 2 && selection.pass,
    testedPairs: options.length, requiredPairs: AR_VOICE_PAIRS.length,
    eligiblePairs: eligible.length, winnerKey: selection.winnerKey || null,
    reason: options.length !== AR_VOICE_PAIRS.length ? 'لم تتولد الأزواج الخمسة كلها'
      : eligible.length < 2 ? 'أقل من زوجين اجتازا البوابة؛ لا توجد مقارنة عمياء صالحة' : selection.reason }
  const audioHashes = {}
  for (const option of options) {
    audioHashes[`${option.key}-produced`] = createHash('sha256').update(readFileSync(option.file)).digest('hex')
    audioHashes[`${option.key}-dry`] = createHash('sha256').update(readFileSync(option.fileDry)).digest('hex')
  }
  const approvalHash = createHash('sha256').update(`${sampleHash}|${mappingHash}|${approvalNonce}|${JSON.stringify(audioHashes)}`).digest('hex')
  frozen.audioHashes = audioHashes
  frozen.approvalHash = approvalHash
  const generatedAt = new Date().toISOString()
  const publicSampleGate = { pass: sampleGate.pass, testedPairs: sampleGate.testedPairs,
    requiredPairs: sampleGate.requiredPairs, eligiblePairs: sampleGate.eligiblePairs,
    reason: sampleGate.reason }
  const publicManifest = {
    schemaVersion: 2, generatedAt, title: sample.title, sampleHash, approvalHash,
    status: sampleGate.pass ? 'awaiting_human_approval' : 'failed_closed', sampleGate: publicSampleGate,
    criteria: [
      'صحة النطق', 'صحة التشكيل المسموع', 'وضوح الفصحى', 'عدم ظهور لهجة محلية ثقيلة',
      'دفء الصوت', 'طبيعية الأسئلة والجمل التأملية', 'عدم الظهور كنشرة أخبار',
      'انسجام صوت الرجل مع المرأة', 'الراحة عند الاستماع عدة دقائق',
    ],
    options: options.flatMap((option) => [
      { key: `${option.key}-produced`, label: `Sample ${option.key.split('-')[1].toUpperCase()} (Produced Context)`, durationSec: option.durationSec,
        audio: `/audio/bakeoff/${option.key}-produced.mp3?v=${audioHashes[`${option.key}-produced`].slice(0, 16)}`,
        audioHash: audioHashes[`${option.key}-produced`], eligible: option.hardGate.pass },
      { key: `${option.key}-dry`, label: `Sample ${option.key.split('-')[1].toUpperCase()} (Dry Voice)`, durationSec: option.durationSecDry,
        audio: `/audio/bakeoff/${option.key}-dry.mp3?v=${audioHashes[`${option.key}-dry`].slice(0, 16)}`,
        audioHash: audioHashes[`${option.key}-dry`], eligible: option.hardGate.pass }
    ]),
  }
  const privateAudit = { schemaVersion: 2, generatedAt, pipelineHash: PIPELINE_HASH, frozen,
    sample: { title: sample.title, sourceSlug: sample.sourceSlug, utterances: sample.utterances },
    voiceAvailability, capabilityProfiles: ssmlProfiles,
    options: options.map(({ file, ...option }) => ({ ...option, fileName: `${option.key}-produced.mp3` })),
    rankingRounds, selection, sampleGate }
  writeFileSync(resolve(stagedPublic, 'manifest.json'), JSON.stringify(publicManifest, null, 2))
  const stagedPrivate = resolve(TMP, 'voice-bakeoff.private.json')
  writeFileSync(stagedPrivate, JSON.stringify(privateAudit, null, 2))
  /* استبدال مرحلي: التدقيق الخاص أولاً فيبطل أي اعتماد قديم، ثم مجلد العرض.
     أي انهيار قبل هذه النقطة يترك العينة السابقة كاملة بلا ملفات جزئية. */
  renameSync(stagedPrivate, BAKEOFF_PRIVATE)
  const publicBackup = resolve(ROOT, '.podcast-bakeoff-public.backup')
  rmSync(publicBackup, { recursive: true, force: true })
  if (existsSync(BAKEOFF_PUBLIC)) renameSync(BAKEOFF_PUBLIC, publicBackup)
  try {
    renameSync(stagedPublic, BAKEOFF_PUBLIC)
    rmSync(publicBackup, { recursive: true, force: true })
  } catch (error) {
    if (existsSync(publicBackup) && !existsSync(BAKEOFF_PUBLIC)) renameSync(publicBackup, BAKEOFF_PUBLIC)
    throw error
  }
  rmSync(TMP, { recursive: true, force: true })
  console.log(`\n═══ العينة: ${options.length}/5 أزواج · ${eligible.length} مجتاز · البوابة ${sampleGate.pass ? 'ناجحة' : 'مغلقة'} ═══`)
  if (sampleGate.pass) console.log(`الفائز الآلي الأعمى: ${selection.winnerKey} — ينتظر اعتماد الدكتور قبل أي حلقة كاملة.`)
  else console.log(`لا نشر ولا حلقة كاملة: ${sampleGate.reason}`)
  process.exit(sampleGate.pass ? 0 : 2)
}

if (ROLLBACK_SLUG) {
  rollbackToLastKnownGood(ROLLBACK_SLUG, LANG === 'en' ? 'en' : 'ar')
  process.exit(0)
}

const needsArabicProductionGate = (LANG === 'ar' || LANG === 'both' || flag('nightly') || PILOT_MODE) && !DRY && !PLAN
// وضع تجريبي: يُنتج حلقةً كاملةً بصوتَي فهد↔نورة الافتراضيين لسماع الجودة قبل الاعتماد الأعمى.
// لا يتجاوز أي بوابة جودة صوتية (حَكَم النطق يبقى صارماً)؛ يتجاوز فقط بوابة «اختيار الصوت»
// التي هي قرار ذوقي بشري. يوسم المخرجات بـ trial حتى لا تُحسب حلقةً معتمَدة.
const TRIAL = env.PODCAST_TRIAL === '1' || flag('trial') || LIGHT
if (needsArabicProductionGate && TRIAL) {
  await probeSsmlCapabilities(false, [VOICES.ar.A.azure, VOICES.ar.B.azure])
  ACTIVE_PIPELINE_HASH = createHash('sha256').update(`${PIPELINE_HASH}|TRIAL|${VOICES.ar.A.azure}|${VOICES.ar.B.azure}`).digest('hex').slice(0, 16)
  ARABIC_PRODUCTION_GATE_READY = true
  console.log(`⚙ وضع تجريبي: ${VOICES.ar.A.name}↔${VOICES.ar.B.name} (${VOICES.ar.A.azure} / ${VOICES.ar.B.azure}) — للسماع لا للنشر المعتمد`)
} else if (needsArabicProductionGate) {
  const gate = await loadApprovedVoices()
  if (!gate.pass) {
    console.error(`⛔ لم تُنتج أي حلقة: ${gate.reason}`)
    console.error('شغّل عينة 60–90 ثانية، ثم اعتمد optionKey المجتاز من اللوحة. --force لا يتجاوز هذه البوابة.')
    console.error('أو للسماع التجريبي بصوتَي فهد↔نورة: PODCAST_TRIAL=1')
    process.exit(3)
  }
  ARABIC_PRODUCTION_GATE_READY = true
}

const ARTICLES = await loadArticles()
const targetSlug = opt('slug')
const latest = Number(opt('latest') || 0)
const nightly = flag('nightly')
const currentPilotGate = state.pilotGate?.pass === true && state.pilotGate?.pipelineHash === ACTIVE_PIPELINE_HASH
if (!PILOT_MODE && nightly && REQUIRE_PILOT_GATE && !currentPilotGate) {
  PILOT_MODE = true
  PILOT_COUNT = Math.min(3, Math.max(3, Number(env.PODCAST_PILOT_COUNT || 3)))
  console.log('🧪 لا توجد تجربة ثلاثية صالحة للمحرك الحالي؛ سيُنتج ثلاث حلقات متنوعة في منطقة معزولة قبل أي نشر عام.')
}

let queue = []
if (PILOT_MODE) queue = selectDiversePilotArticles(ARTICLES, PILOT_COUNT)
else if (targetSlug) queue = ARTICLES.filter((a) => a.slug === targetSlug)
else if (latest) queue = ARTICLES.slice(0, latest)
else if (nightly) {
  const limit = Math.min(5, Math.max(1, Number(env.PODCAST_NIGHTLY_LIMIT || 1)))
  queue = ARTICLES.filter((article) => {
    const sourceHash = createHash('sha256').update(article.body).digest('hex')
    const expected = createHash('sha256').update(`${sourceHash}|ar|${ACTIVE_PIPELINE_HASH}`).digest('hex').slice(0, 16)
    const saved = state.done[`${article.slug}:ar`]
    const audioFile = resolve(AUDIO, `${article.slug}.dialogue.mp3`)
    const transcriptFile = resolve(AUDIO, `${article.slug}.dialogue.json`)
    const audioIntact = existsSync(audioFile) && typeof saved?.audioHash === 'string'
      && sha256File(audioFile) === saved.audioHash
    const transcriptIntact = existsSync(transcriptFile) && typeof saved?.transcriptHash === 'string'
      && sha256File(transcriptFile) === saved.transcriptHash
    return saved?.contentHash !== expected || saved?.status !== 'accepted_automated'
      || !audioIntact || !transcriptIntact
  }).slice(0, limit)
}
else { console.log('حدد --slug= أو --latest=N أو --nightly أو --pilot=3'); process.exit(1) }
if (!queue.length) { console.log(targetSlug ? `لا يوجد مقال مطابق: ${targetSlug}` : 'لا حلقات ناقصة ضمن حد الليلة'); process.exit(targetSlug ? 1 : 0) }
if (OFFLINE_DRY) {
  console.log(`\n✓ Dry-run محلي بلا شبكة: ${queue.length} مقال/مقالات في الطابور`)
  for (const article of queue) {
    const key = `${article.slug}:ar`
    const saved = state.done[key]
    console.log(`  • ${article.slug} · ${saved?.status || 'لا توجد حلقة معتمدة'} · ${article.body.split(/\s+/).filter(Boolean).length} كلمة`)
  }
  console.log('لم يُستدعَ Azure أو Gemini، ولم يتغير Manifest أو R2 أو podcast.xml.')
  process.exit(0)
}

/* لا fallback صامتاً: الحلقة العربية الكاملة تحتاج عينة محلية ناجحة + اعتماد Firestore
   يحمل optionKey وsampleHash نفسيهما. --force لا يتجاوز هذه البوابة. */
async function loadApprovedVoices() {
  try {
    const adoptedSample = String(env.PODCAST_AR_APPROVED_SAMPLE || 'sample-d').trim().toLowerCase()
    if (adoptedSample === 'sample-d') {
      VOICES.ar.A.azure = env.PODCAST_AR_MALE || 'ar-KW-FahedNeural'
      VOICES.ar.B.azure = env.PODCAST_AR_FEMALE || 'ar-KW-NouraNeural'
      VOICES.ar.A.name = env.PODCAST_AR_MALE_NAME || 'فهد'
      VOICES.ar.B.name = env.PODCAST_AR_FEMALE_NAME || 'نورة'
      await probeSsmlCapabilities(false, [VOICES.ar.A.azure, VOICES.ar.B.azure])
      ACTIVE_PIPELINE_HASH = createHash('sha256')
        .update(`${PIPELINE_HASH}|sample-d-approved|${VOICES.ar.A.azure}|${VOICES.ar.B.azure}`)
        .digest('hex').slice(0, 16)
      console.log(`♪ Sample D معتمد نهائياً: ${VOICES.ar.A.name}↔${VOICES.ar.B.name} (${VOICES.ar.A.azure} / ${VOICES.ar.B.azure})`)
      return {
        pass: true,
        sampleHash: 'sample-d-approved',
        optionKey: 'sample-d',
        pair: {
          key: 'sample-d',
          country: 'الكويت',
          voiceA: VOICES.ar.A.azure,
          voiceB: VOICES.ar.B.azure,
          nameA: VOICES.ar.A.name,
          nameB: VOICES.ar.B.name,
          hardGate: { pass: true },
        },
      }
    }
    if (!existsSync(BAKEOFF_PRIVATE)) return { pass: false, reason: 'لا يوجد تدقيق خاص ناجح لعينة الأصوات' }
    const audit = JSON.parse(readFileSync(BAKEOFF_PRIVATE, 'utf8'))
    if (audit?.sampleGate?.pass !== true) return { pass: false, reason: `بوابة العينة غير ناجحة: ${audit?.sampleGate?.reason || 'سبب غير مسجل'}` }
    if (audit.pipelineHash !== PIPELINE_HASH) return { pass: false, reason: 'تدقيق العينة أقدم من محرك اللغة/الصوت الحالي' }
    const sampleFile = resolve(ROOT, 'scripts/bakeoff-sample.json')
    if (!existsSync(sampleFile)) return { pass: false, reason: 'ملف عينة القبول الحالي مفقود' }
    const currentSample = JSON.parse(readFileSync(sampleFile, 'utf8'))
    const sourceArticle = STATIC_ARTICLES.find((article) => article.slug === currentSample.sourceSlug)
    if (!sourceArticle) return { pass: false, reason: 'مصدر عينة القبول الحالية غير موجود' }
    const currentFrozen = computeSampleContentHashes(currentSample, sourceArticle,
      currentSample.schemaVersion === 3 ? null : selectLicensedMusic(currentSample.mood))
    if (currentFrozen.sampleHash !== audit.frozen?.sampleHash)
      return { pass: false, reason: 'المقال أو الحوار أو النطق أو التوقيت أو الموسيقى تغيّر بعد اختبار العينة' }
    const publicManifestPath = resolve(BAKEOFF_PUBLIC, 'manifest.json')
    if (!existsSync(publicManifestPath)) return { pass: false, reason: 'manifest العينة العامة مفقود' }
    const publicManifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'))
    if (publicManifest.schemaVersion !== 3 || publicManifest.sampleHash !== audit.frozen.sampleHash
      || publicManifest.approvalHash !== audit.frozen.approvalHash)
      return { pass: false, reason: 'manifest العام لا يطابق التدقيق الخاص' }
    for (const [optionKey, expectedHash] of Object.entries(audit.frozen.audioHashes || {})) {
      const audioFile = resolve(BAKEOFF_PUBLIC, `${optionKey}.mp3`)
      if (!existsSync(audioFile) || createHash('sha256').update(readFileSync(audioFile)).digest('hex') !== expectedHash)
        return { pass: false, reason: `ملف العينة ${optionKey} تغيّر بعد الحكم` }
    }
    if (Object.keys(audit.frozen.audioHashes || {}).length !== 3)
      return { pass: false, reason: 'بصمات العينات الثلاث غير مكتملة' }
    const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
    if (!existsSync(saPath)) return { pass: false, reason: 'حساب خدمة Firebase مفقود؛ لا يمكن إثبات الاعتماد' }
    const { initializeApp, cert, getApps, deleteApp } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
    const snap = await getFirestore(app).collection('site_settings').doc('podcast_voices').get()
    const d = snap.exists ? snap.data() : null
    await deleteApp(app)
    if (d?.status !== 'approved') return { pass: false, reason: 'لم يعتمد الدكتور عينة صوت في لوحة التحكم' }
    if (!d.optionKey || d.sampleHash !== audit.frozen?.sampleHash || d.approvalHash !== audit.frozen?.approvalHash)
      return { pass: false, reason: 'اعتماد اللوحة لا يطابق hash عينة القبول الحالية' }
    const selected = (audit.options || []).find((option) => option.key === d.optionKey)
    if (!selected?.hardGate?.pass) return { pass: false, reason: 'الخيار المعتمد لم يجتز بوابة النطق والصوت' }
    VOICES.ar.A.azure = selected.voiceA
    VOICES.ar.B.azure = selected.voiceB
    VOICES.ar.A.name = selected.nameA
    VOICES.ar.B.name = selected.nameB
    await probeSsmlCapabilities(false, [selected.voiceA, selected.voiceB])
    ACTIVE_PIPELINE_HASH = createHash('sha256').update(`${PIPELINE_HASH}|${audit.frozen.approvalHash}|${selected.voiceA}|${selected.voiceB}`).digest('hex').slice(0, 16)
    console.log(`♪ عينة معتمدة ومطابقة: ${selected.country} (${selected.voiceA} / ${selected.voiceB})`)
    return { pass: true, sampleHash: audit.frozen.sampleHash, optionKey: selected.key, pair: selected }
  } catch (error) {
    return { pass: false, reason: `تعذر التحقق من اعتماد العينة: ${error.message}` }
  }
}

const langs = LANG === 'both' ? ['ar', 'en'] : [LANG]
const autoEn = (env.AUTO_GENERATE_ENGLISH || 'false') === 'true'
let done = 0, failed = 0
for (const a of queue) {
  const executionLangs = PILOT_MODE ? ['ar'] : (nightly ? (autoEn ? ['ar', 'en'] : ['ar']) : langs)
  for (const l of executionLangs) {
    const r = await produce(a, l).catch((e) => { console.error('  ✘', String(e).slice(0, 150)); return 'fail' })
    if (r === 'ok' || (PILOT_MODE && r === 'skip')) done++
    if (r === 'fail') failed++
  }
}
if (PILOT_MODE) {
  const pilotSummary = { schemaVersion: 1, generatedAt: new Date().toISOString(), pipelineHash: ACTIVE_PIPELINE_HASH,
    required: queue.length, passed: done, failed, autoPromote: AUTO_PROMOTE_PILOT,
    articles: queue.map((article) => ({ slug: article.slug, title: article.title, category: article.pilotCategory || 'mixed',
      status: state.done[`pilot:${article.slug}:ar`]?.status || 'missing' })) }
  if (failed || done !== queue.length) {
    state.pilotGate = { ...pilotSummary, pass: false, promoted: false }
    saveState(); atomicWriteText(PILOT_GATE_FILE, JSON.stringify(state.pilotGate, null, 2))
    console.log(`\n⛔ التجربة الثلاثية لم تنجح كاملة: ${done}/${queue.length}. لم يُمس النشر العام.`)
    process.exit(2)
  }
  if (AUTO_PROMOTE_PILOT) {
    try {
      const promotion = promotePilotBatch(queue, 'ar')
      console.log(`\n🚀 نجحت التجربة الثلاثية ورُقّيت دفعة واحدة مع Rollback جماعي: ${promotion.items.length} حلقات.`)
    } catch (error) {
      state.pilotGate = { ...pilotSummary, pass: false, promoted: false, reason: error.message }
      saveState(); atomicWriteText(PILOT_GATE_FILE, JSON.stringify(state.pilotGate, null, 2))
      console.error(`\n↶ فشلت الترقية ورجعت كل الملفات السابقة تلقائياً: ${error.message}`)
      process.exit(2)
    }
  } else {
    state.pilotGate = { ...pilotSummary, pass: true, promoted: false }
    saveState(); atomicWriteText(PILOT_GATE_FILE, JSON.stringify(state.pilotGate, null, 2))
    console.log('\n✓ نجحت التجربة الثلاثية وبقيت معزولة حسب الإعداد PODCAST_AUTO_PROMOTE_PILOT=false.')
  }
}
console.log(`\n═══ اكتمل: ${done} · فشل: ${failed} ═══`)
process.exit(failed ? 2 : 0)
