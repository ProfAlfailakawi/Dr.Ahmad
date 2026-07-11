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
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync, renameSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'

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
const STT_ENSEMBLE_LOCALES = ['ar-KW', 'ar-SA', 'ar-AE', 'ar-QA', 'ar-OM']
const SAMPLE_MIN_SEC = 60
const SAMPLE_MAX_SEC = 90

/* ── بيئة ── */
const env = { ...process.env }
if (existsSync(resolve(ROOT, '.env')))
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2')
  }
const GEMINI_KEY = env.GEMINI_API_KEY
const AZURE_KEY = env.AZURE_SPEECH_KEY
const AZURE_REGION = env.AZURE_SPEECH_REGION || 'uaenorth'

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

/* الزوج الافتراضي الثابت — يُقرأ من البيئة (يحرّره الدكتور من اللوحة عبر site_settings)،
   ويسقط إلى فهد ونورة حتى يُعتمد زوجٌ من الاختبار الأعمى. لا تثبيت نهائي هنا. */
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
const FORCE = flag('force')
const SELF_TEST = flag('self-test')
const PREFLIGHT = flag('preflight')
const PLAN = flag('plan')
const REUSE_DIALOGUE = flag('reuse-dialogue')
const CANARY = flag('canary')
const BAKEOFF = flag('voice-bakeoff')
let ARABIC_PRODUCTION_GATE_READY = false
if (!SELF_TEST && (!GEMINI_KEY || !AZURE_KEY)) { console.error('✘ GEMINI_API_KEY أو AZURE_SPEECH_KEY مفقود'); process.exit(1) }
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
const state = readJsonSafe(STATE_FILE, { done: {}, storyCount: 0, totalCount: 0 })
const saveState = () => atomicWriteText(STATE_FILE, JSON.stringify(state, null, 1))
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
const DIALOGUE_MODEL = env.PODCAST_DIALOGUE_MODEL || env.GEMINI_MODEL || 'gemini-2.5-flash'
const ANALYSIS_MODEL = env.PODCAST_ANALYSIS_MODEL || DIALOGUE_MODEL
const JUDGE_MODEL = env.PODCAST_JUDGE_MODEL || DIALOGUE_MODEL
const PIPELINE_HASH = createHash('sha256').update(JSON.stringify({
  version: 'arabic-podcast-v5-natural-delivery',
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
const providerFingerprint = (voice) => `${AZURE_REGION}:${voice}:azure-ssml-v3`
const pendingMemory = []
const capabilityProfiles = new Map()

async function gemini(systemPrompt, userText, temperature = 0.85, model = DIALOGUE_MODEL, extraParts = []) {
  let lastStatus = ''
  for (let attempt = 1; attempt <= 5; attempt++) {
    let res
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userText }, ...extraParts] }],
          generationConfig: { temperature, maxOutputTokens: 16384, responseMimeType: 'application/json' },
        }),
      })
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'أعد JSON فقط: {"ready":true}' }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 30, temperature: 0 } }),
  })
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

function lintScript(sc, lang) {
  const issues = []
  const utts = sc.utterances || []
  const isSample = Boolean(sc.sample)
  if (utts.length < (isSample ? 12 : 8)) issues.push(`مداخلات قليلة (${utts.length})`)
  const words = utts.reduce((n, u) => n + (u.text || '').split(/\s+/).length, 0)
  const [lo, hi] = isSample ? [120, 160] : (lang === 'ar' ? [430, 620] : [420, 900])
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
    const rateRanges = {
      reflective: [3, 6], hook: [10, 14], question: [6, 9], objection: [10, 14],
      clarification: [7, 10], conclusion: [3, 6], quick: [10, 14], normal: [7, 10],
    }
    const pauseRanges = {
      reflective: [500, 700], question: [350, 550], quick: [100, 220], objection: [100, 220],
      hook: [100, 220], clarification: [180, 350], conclusion: [350, 550], normal: [180, 350],
    }
    for (const [index, utterance] of utts.entries()) {
      const text = String(utterance.text || '')
      const kind = utterance.delivery || 'normal'
      deliveryKinds.add(kind)
      if (text.includes('؟')) questionBySpeaker.set(utterance.speaker, (questionBySpeaker.get(utterance.speaker) || 0) + 1)
      if (text.includes('؟') && kind !== 'question') issues.push(`المداخلة ${index + 1}: سؤال بلا delivery=question`)
      if (kind === 'question' && !text.includes('؟')) issues.push(`المداخلة ${index + 1}: question بلا علامة استفهام`)
      if (/^(لكن|ولكن|على العكس|لست متأكد|ربما،? ولكن|لحظة|انتظر)/.test(text) || kind === 'objection') objections.push(index)
      const rate = Number(utterance.ratePct)
      const [rateMin, rateMax] = rateRanges[kind] || rateRanges.normal
      if (!Number.isFinite(rate) || rate < rateMin || rate > rateMax) issues.push(`المداخلة ${index + 1}: سرعة ${utterance.ratePct ?? 'مفقودة'} خارج ${rateMin}–${rateMax}%`)
      const pause = Number(utterance.pauseAfterMs)
      const [pauseMin, pauseMax] = pauseRanges[kind] || pauseRanges.normal
      if (!Number.isFinite(pause) || pause < pauseMin || pause > pauseMax) issues.push(`المداخلة ${index + 1}: وقفة ${utterance.pauseAfterMs ?? 'مفقودة'}ms خارج ${pauseMin}–${pauseMax}`)
      if (!['open', 'final', 'neutral'].includes(utterance.ending)) issues.push(`المداخلة ${index + 1}: نهاية نبرية مفقودة`)
      const sentenceCount = (text.match(/[.!؟]+/g) || []).length
      if (sentenceCount > 3) issues.push(`المداخلة ${index + 1}: أكثر من ثلاث جمل`)
    }
    if ([...questionBySpeaker.values()].some((count) => count < 1)) issues.push('يجب أن يسأل كل من A وB سؤالاً حقيقياً واحداً على الأقل')
    if (deliveryKinds.size < 4) issues.push(`تنوع الإلقاء ضعيف (${deliveryKinds.size} أنواع فقط)`)
    if (objections.length < 2) issues.push('الحوار يحتاج اعتراضين أو تصحيح زاويتين على الأقل')
  }
  const aWords = utts.filter((u) => u.speaker === 'A').reduce((n, u) => n + u.text.split(/\s+/).length, 0)
  const ratio = aWords / Math.max(1, words)
  if (ratio < 0.4 || ratio > 0.6) issues.push(`توازن مختل: A=${Math.round(ratio * 100)}%`)
  const starts = utts.map((u) => (u.text || '').split(/\s+/)[0])
  for (const w of ['صحيح', 'بالضبط', 'Exactly', 'Right']) {
    const c = starts.filter((s) => s === w || s === w + '،' || s === w + ',').length
    if (c > 2) issues.push(`تكرار بداية «${w}» ×${c}`)
  }
  const lens = utts.map((u) => u.text.split(/\s+/).length)
  const sameLen = lens.every((l) => Math.abs(l - lens[0]) <= 2)
  if (sameLen && utts.length > 6) issues.push('كل المداخلات بالطول نفسه — يبدو آلياً')
  if (lens.some((l) => l > 55)) issues.push('مداخلة أطول من 55 كلمة')
  const sortedLens = [...lens].sort((a, b) => a - b)
  if (sortedLens[Math.max(0, Math.ceil(sortedLens.length * 0.9) - 1)] > 35) issues.push('P90 لطول المداخلات يتجاوز 35 كلمة')
  if (lang === 'ar' && lens.filter((length) => length <= 8).length < Math.max(2, Math.floor(utts.length * 0.2))) issues.push('لا توجد ردود قصيرة كافية (20٪ تقريباً ≤ 8 كلمات)')
  const overlaps = utts.filter((u) => u.allowOverlap).length
  if (lang === 'ar') {
    const minOverlaps = Math.max(1, Math.floor(utts.length / 8))
    const maxOverlaps = Math.max(1, Math.ceil(utts.length / 5))
    if (overlaps < minOverlaps || overlaps > maxOverlaps) issues.push(`التداخلات ${overlaps} خارج النطاق الطبيعي ${minOverlaps}–${maxOverlaps}`)
    for (const [index, utterance] of utts.entries()) if (utterance.allowOverlap) {
      if ((utterance.text || '').split(/\s+/).length > 8) issues.push(`التداخل ${index + 1} أطول من رد قصير`)
      if (utterance.overlapMs < 60 || utterance.overlapMs > 180) issues.push(`التداخل ${index + 1} خارج 60–180ms`)
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
  const rows = expected.length + 1
  const cols = heard.length + 1
  const dp = Array.from({ length: rows }, () => new Uint16Array(cols))
  for (let i = expected.length - 1; i >= 0; i--)
    for (let j = heard.length - 1; j >= 0; j--)
      dp[i][j] = expected[i] === heard[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const matched = new Set()
  let i = 0, j = 0
  while (i < expected.length && j < heard.length) {
    if (expected[i] === heard[j]) { matched.add(i); i++; j++; continue }
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
    ratio: expected.length ? matched.size / expected.length : 1,
    importantRatio: importantIndexes.length
      ? (importantIndexes.length - missingImportant.length) / importantIndexes.length
      : 1,
  }
}

/* ═══════════ Azure TTS + STT ═══════════ */
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** يبني SSML من النص النطقي: إيقاع حواري أسرع من النسخة المرفوضة، بلا سرعة موحّدة. */
function buildSSML(u, pronText, subs, voice, lang) {
  const ratePlan = {
    reflective: 5,
    hook: 11,
    question: 8,
    objection: 12,
    clarification: 8,
    conclusion: 5,
    quick: 13,
    normal: 8,
  }
  const requestedRate = Number.isFinite(Number(u.ratePct)) ? Number(u.ratePct) : (ratePlan[u.delivery] ?? ratePlan.normal)
  const ratePct = Math.min(14, Math.max(3, requestedRate))
  const pitch = u.delivery === 'question' ? '+2%'
    : u.delivery === 'objection' || u.ending === 'open' ? '+1%'
      : u.delivery === 'reflective' || u.ending === 'final' ? '-1%' : '+0%'
  const profile = capabilityProfiles.get(voice)
  if (lang === 'ar' && profile && !profile.subSupported) {
    for (const { word, alias } of subs) pronText = pronText.split(word).join(alias)
    subs = []
  }
  let text = escXml(pronText)
  for (const { word, alias } of subs) {
    if (!word || !alias || word === alias) continue
    const ew = escXml(word)
    if (text.includes(ew)) text = text.split(ew).join(`<sub alias="${escXml(alias)}">${ew}</sub>`)
  }
  const internalBreakMs = Math.min(180, Math.max(90, Number(u.internalBreakMs || (u.delivery === 'reflective' ? 170 : u.delivery === 'question' ? 150 : 110))))
  text = text.replace(/\s*\|\s*/g, `<break time="${internalBreakMs}ms"/>`)
  /* لا نستخدم <emphasis>: الأصوات العربية العشرة المختبرة لا تعلن دعمه، وقد
     يتجاهله Azure بصمت. التشديد يُصنع من الجملة والسرعة والوقفة لا من وسم وهمي. */
  // locale يتبع الصوت المستخدم (يعمّم لأي صوت عربي، لا ثابت ar-KW)
  const xmlLang = lang === 'ar' ? localeOf(voice) : 'en-US'
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">
  <voice name="${voice}"><prosody rate="+${ratePct}%" pitch="${pitch}">${text}</prosody></voice>
</speak>`
}

async function synthSSML(ssml, outPath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
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
      if (buf.length > 4000) { writeFileSync(outPath, buf); return true }
    } else if (res.status === 429) await new Promise((r) => setTimeout(r, 4000 * attempt))
    else await new Promise((r) => setTimeout(r, 1200 * attempt))
  }
  return false
}

async function sttRequest(wav16Path, locale) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed&profanity=raw`, {
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
      ending: delivery.ending, isQuestion: String(context).includes('؟') })}`,
    'ارفض السؤال إذا سُمِع كنص تقريري. ارفض الإيقاع المدرسي، والنهاية المبتورة، والوقف الطويل، وأي عامية أو حركة تقلب المعنى.',
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
  const response = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
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
  })))).digest('hex')
  const musicHash = music ? createHash('sha256').update(readFileSync(music.file))
    .update(JSON.stringify({ bedVol: music.bedVol, introVol: music.introVol, outroVol: music.outroVol,
      introSec: music.introSec, outroSec: music.outroSec })).digest('hex') : 'none'
  const sourceHash = createHash('sha256').update(sourceArticle.body).digest('hex')
  const sampleHash = createHash('sha256').update([sourceHash, dialogueHash, pronunciationHash, timelineHash,
    musicHash, PIPELINE_HASH].join('|')).digest('hex')
  return { sourceHash, dialogueHash, pronunciationHash, timelineHash, musicHash, sampleHash }
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

async function riskAnalyze(utts, { tolerant = false } = {}) {
  /* على دفعات (8 مداخلات) كي لا يُبتر JSON الإخراج في الحلقات الطويلة،
     مع خريطة ضبط مشتركة تضمن اتساق الكلمة نفسها عبر كل الدفعات.
     tolerant=true (إعادة تحليل مداخلة مُعاد صياغتها): الدفعة الفاشلة تسقط لملاذ
     حتمي بالقاموس بدل رمي خطأ يُهدر الحلقة كلها — الصرامة تبقى في التوليد الأولي. */
  const CHUNK = 8
  const lexCtx = `القاموس والذاكرة المعتمدان (التزم بهما حرفياً):\n${JSON.stringify(lexiconContext(), null, 1)}`
  const results = new Array(utts.length)
  const pronMap = new Map()
  for (let start = 0; start < utts.length; start += CHUNK) {
    const slice = utts.slice(start, start + CHUNK)
    const payload = `${lexCtx}\n\nقرارات ضبط سابقة في هذه الحلقة (التزم بها للاتساق):\n${JSON.stringify([...pronMap.entries()].map(([w, p]) => ({ word: w, pron: p })))}\n\nالمداخلات:\n` +
      JSON.stringify(slice.map((u, i) => ({ idx: start + i, speaker: u.speaker, text: u.text })), null, 1)
    let list = null
    const roundFailures = []
    for (let round = 1; round <= 3 && !list; round++) {
      try {
        const out = await gemini(PRONOUNCE_SYSTEM, payload + (round > 1 ? '\n\nREWRITE: النتيجة السابقة لم تجتز البوابة. التشكيل انتقائي فقط، وكل حقل في تحليل المخاطر إلزامي.' : ''), 0.25, ANALYSIS_MODEL)
        const cand = out.utterances || []
        if (cand.length !== slice.length) { roundFailures.push(`محاولة ${round}: عدد المداخلات ${cand.length}/${slice.length}`); continue }
        let valid = true
        const validationIssues = []
        const healedDiacritics = []
        const totalWords = cand.reduce((n, x) => n + String(x.pronunciationText || '').split(/\s+/).length, 0)
        const diacWords = cand.reduce((n, x) => n + String(x.pronunciationText || '').split(/\s+/).filter((w) => DIACRITICS_RE.test(w)).length, 0)
        if (totalWords && diacWords / totalWords > 0.32) { valid = false; validationIssues.push(`تشكيل ${Math.round(diacWords / totalWords * 100)}٪`) }
        for (let i = 0; i < cand.length; i++) {
          const dialogue = slice[i].text
          const pron = String(cand[i].pronunciationText || '')
          if (!pron) { valid = false; validationIssues.push(`u${start + i + 1}: pronunciationText فارغ`) }
          if (AR_COLLOQUIAL_WORDS.some((word) => arWord(word).test(pron))) { valid = false; validationIssues.push(`u${start + i + 1}: عامية`) }
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
              && !risk.subAlias && /[A-Za-z0-9]/.test(risk.word)) { valid = false; validationIssues.push(`u${start + i + 1}: بلا نطق ${risk.word}`) }
          }
          const allowedDiacritics = new Set([...merged.values()].flatMap((risk) =>
            normalizeAr(risk.word).split(' ').concat(normalizeAr(risk.selectedPronunciation).split(' '))))
          for (const originalWord of dialogue.split(/\s+/).filter((item) => DIACRITICS_RE.test(item))) {
            const normalizedOriginal = normalizeAr(originalWord)
            if (normalizedOriginal) allowedDiacritics.add(normalizedOriginal)
          }
          /* إسناد واعٍ بالسوابق: «وتَقْييم» تُنسب إلى «التقييم» المعلنة (واو العطف/ال التعريف…)،
             وأي تشكيل يبقى بلا رصيد يُشفى ذاتياً بنزع حركاته — فلا يمر تشكيل غير مسبب، ولا تسقط الدفعة */
          const PREFIX_RE = /^(وال|فال|بال|كال|لل|ال|و|ف|ب|ل|ك)/
          const bareForms = new Set()
          for (const allowed of allowedDiacritics) if (allowed) { bareForms.add(allowed); bareForms.add(allowed.replace(PREFIX_RE, '')) }
          let healedText = pron
          for (const word of pron.split(/\s+/).filter((item) => DIACRITICS_RE.test(item))) {
            const normalizedWord = normalizeAr(word)
            if (!normalizedWord) continue
            const bare = normalizedWord.replace(PREFIX_RE, '')
            if (bareForms.has(normalizedWord) || bareForms.has(bare)) continue
            healedText = healedText.split(word).join(stripDiacritics(word))
            healedDiacritics.push(`u${start + i + 1}: ${word}`)
          }
          cand[i] = { ...cand[i], pronunciationText: healedText, risks: [...merged.values()] }
        }
        if (valid) {
          if (healedDiacritics.length) console.log(`  ♻ نُزع تشكيل غير مرصود (${healedDiacritics.length}): ${[...new Set(healedDiacritics)].slice(0, 4).join('، ')}${healedDiacritics.length > 4 ? '…' : ''}`)
          list = cand
        }
        else roundFailures.push(`محاولة ${round}: ${[...new Set(validationIssues)].slice(0, 8).join('، ')}`)
      } catch (error) { roundFailures.push(`محاولة ${round}: ${error.message}`) }
    }
    if (!list) {
      if (!tolerant) throw new Error(`Arabic Pronunciation Risk Detector فشل مغلقاً في المداخلات ${start + 1}-${start + slice.length}: ${roundFailures.join(' | ')}`)
      // ملاذ آمن: كشف حتمي بالقاموس والأنماط — لا يفقد الأسماء المعروفة، ولا يُسقط الحلقة
      console.log(`  ⓘ ملاذ نطقي حتمي للمداخلات ${start + 1}-${start + slice.length} (تعذّر التحليل الكامل)`)
      list = slice.map((u) => {
        const merged = new Map()
        for (const risk of deterministicRisks(u.text)) merged.set(normalizeAr(risk.word), risk)
        return { pronunciationText: u.text, risks: [...merged.values()] }
      })
    }
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

async function evaluateCandidate({ runId, utteranceId, u, dialogueText, riskAnalysis, voice, lang, variant, path, sttLocale }) {
  const ssml = buildSSML(u, variant.text, variant.subs, voice, lang)
  const generated = await synthSSML(ssml, path)
  if (!generated) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: 'فشل Azure TTS', variant, ssml, path }
  }
  const intended = spokenText(variant.text, variant.subs)
  const technical = auditSegment(path, intended)
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
  try {
    verdict = await audioJudge(path, intended, heard, riskAnalysis.risks, dialogueText, u)
  } catch (error) {
    /* Fail closed: لا يستطيع STT وحده إثبات الفتحة والكسرة أو النبرة. */
    verdict = { pass: false, problems: [{ word: '', issue: `تعذر الحكم الصوتي الإلزامي: ${error.message}` }] }
  }
  const verdictPass = verdict.pass === true && verdict.problems.length === 0
  const pass = verdictPass && highMissing.length === 0 && missingNegations.length === 0
    && comparison.importantRatio >= 0.95 && comparison.ratio >= 0.90
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

async function safeRephrase(dialogueText, sourceText, reason, stubbornWords = []) {
  // البند العاشر: إعادة الصياغة الموجّهة — إن عجز Azure عن اسمٍ أجنبيٍّ قصير بعد كل المرشحين،
  // نتجنّبه (نذكره مرة، أو نستبدله بوصفٍ دقيق) دون حذف أي معلومة أو إضعاف الأسلوب.
  const avoid = [...new Set(stubbornWords.filter(Boolean))]
  const response = await gemini(JUDGE_SYSTEM, [
    'أعد صياغة المداخلة فقط بفصحى حوارية عربية معاصرة أبسط نطقاً، مع ثبات المعنى حرفياً.',
    'لا تضف معلومة، ولا تحذف معلومة، ولا تستخدم أي عامية أو تشكيل كامل.',
    avoid.length ? `الكلمات التالية يعجز محرك النطق عنها؛ أعد ترتيب الجملة لتقليل الاعتماد عليها — اذكر الاسم مرة واحدة إن لزم، أو استبدله بوصفٍ دقيق دون حذف الحقيقة العلمية: ${avoid.join('، ')}` : '',
    'إن كان اسم علمٍ أجنبيٍّ يتكرر، يكفي ذكره مرة؛ والإشارة اللاحقة إليه تكون بضميرٍ أو وصف («وأعماله اللاحقة»، «الباحث نفسه») دون تكرار الاسم المتعثر.',
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
  let dialogueText = u.text
  let currentAnalysis = analysis
  const allAudits = []

  for (let round = 0; round < 3; round++) {
    const applied = applyLexicon(currentAnalysis.pronunciationText || dialogueText, currentAnalysis.risks, voice, dialogueText)
    const variants = candidateVariants(dialogueText, applied.text, applied.subs, currentAnalysis.risks)
    const audits = []
    for (let index = 0; index < variants.length; index++) {
      const variant = { ...variants[index], id: `r${round + 1}-${variants[index].id}` }
      const candidatePath = wavPath.replace(/\.wav$/, `.${round}-${index}.wav`)
      audits.push(await evaluateCandidate({ runId, utteranceId, u, dialogueText, riskAnalysis: currentAnalysis,
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
        heard: selected.heard,
        selectedCandidate: selected.variant.id,
        candidates: allAudits.map((audit) => ({ id: audit.variant.id, pass: audit.pass, score: audit.score,
          reason: audit.reason, stt: audit.heard?.text || '', judge: audit.verdict || null })),
      }
    }
    const reason = audits.map((audit) => audit.reason).filter(Boolean).join(' · ') || 'لم يجتز أي مرشح'
    // الكلمات المستعصية: ما رصده الحكم مشكلةً + كل كلمة عالية الخطورة لم تُسمع في أي مرشح
    const stubbornWords = [...new Set([
      ...audits.flatMap((audit) => (audit.verdict?.problems || []).map((problem) => problem.word)),
      ...audits.flatMap((audit) => (audit.highMissing || []).map((risk) => risk.word)),
    ].filter(Boolean))]
    const rephrased = await safeRephrase(dialogueText, sourceText, reason, stubbornWords)
    if (!rephrased) return { ok: false, verified: false, reason, dialogueText, candidates: allAudits }
    dialogueText = rephrased
    const [reanalyzed] = await riskAnalyze([{ ...u, text: dialogueText, allowOverlap: false }], { tolerant: true })
    currentAnalysis = reanalyzed
  }
  return { ok: false, verified: false, reason: 'استنفدت المرشحات وإعادة الصياغة', dialogueText, candidates: allAudits }
}

/* ═══════════ تركيب Timeline بـ ffmpeg ═══════════ */
const ff = (fArgs) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...fArgs], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg: ' + (r.stderr || '').slice(-300))
}
const probeDur = (f) => parseFloat(execFileSync(FFPROBE, ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()) || 0

function auditSegment(file, dialogueText) {
  const dur = probeDur(file)
  const words = String(dialogueText || '').trim().split(/\s+/).filter(Boolean).length
  const issues = []
  if (!existsSync(file) || statSync(file).size < 4000) issues.push('ملف فارغ أو صغير بصورة مريبة')
  if (dur < 0.35) issues.push(`مدة مبتورة (${dur.toFixed(2)}ث)`)
  if (dur > 13) issues.push(`مداخلة أطول من 13ث (${dur.toFixed(1)}ث)`)

  const silence = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af',
    'silencedetect=noise=-44dB:d=0.04', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const starts = [...silence.matchAll(/silence_start:\s*([0-9.]+)/g)].map((match) => Number(match[1]))
  const ends = [...silence.matchAll(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/g)]
    .map((match) => ({ end: Number(match[1]), duration: Number(match[2]) }))
  const leadingSilenceMs = starts[0] <= 0.01 && ends[0] ? Math.round(ends[0].end * 1000) : 0
  const lastStart = starts.at(-1)
  const trailingSilenceMs = Number.isFinite(lastStart) && lastStart > dur - 1
    ? Math.round((dur - lastStart) * 1000) : 0
  const internalLongSilences = ends.filter((entry) => entry.duration > 0.8
    && entry.end - entry.duration > 0.02 && entry.end < dur - 0.02).length
  if (leadingSilenceMs > 280) issues.push(`صمت أولي ${leadingSilenceMs}ms`) // قد يوحي ببتر ما قبله في التايملاين
  if (trailingSilenceMs > 320) issues.push(`صمت نهائي ${trailingSilenceMs}ms`)
  if (internalLongSilences) issues.push(`صمت داخلي أطول من 800ms (${internalLongSilences})`)

  const activeSec = Math.max(0.25, dur - (leadingSilenceMs + trailingSilenceMs) / 1000)
  const wpm = words * 60 / activeSec
  if (words >= 6 && (wpm < 115 || wpm > 225)) issues.push(`سرعة فعلية ${Math.round(wpm)} كلمة/دقيقة`)
  const volume = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const peak = Number((volume.match(/max_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  if (Number.isFinite(peak) && peak >= -0.1) issues.push(`ذروة ${peak}dB قد تكون clipping`)
  return { dur, words, wpm: Math.round(wpm), leadingSilenceMs, trailingSilenceMs, internalLongSilences,
    peakDb: Number.isFinite(peak) ? peak : null, issues }
}

function planTimeline(segments, music) {
  const timeline = []
  const firstStart = music ? Math.min(6, Math.max(4, Number(music.introSec || 5))) : 0.25
  for (const segment of segments) {
    const dur = probeDur(segment.file)
    const previous = timeline.at(-1)
    let start = firstStart
    let overlapMs = 0
    if (previous) {
      const requestedOverlap = Math.min(180, Math.max(60, Number(segment.overlapMs || 0)))
      const canOverlap = Number(segment.overlapMs) > 0 && !segment.hasHighRisk && !previous.hasHighRisk
      overlapMs = canOverlap ? requestedOverlap : 0
      start = canOverlap
        ? previous.start + previous.dur - overlapMs / 1000
        : previous.start + previous.dur + Math.min(700, Math.max(100, Number(previous.pauseAfterMs || 220))) / 1000
    }
    timeline.push({ ...segment, start: Math.max(0, start), dur, overlapMs })
  }
  const lastEnd = timeline.length ? timeline.at(-1).start + timeline.at(-1).dur : firstStart
  const total = lastEnd + (music ? Math.min(6, Math.max(3, Number(music.outroSec || 4))) : 0.45)
  return { timeline, total }
}

function assemble(segments, outMp3, music) {
  const { timeline, total } = planTimeline(segments, music)

  const inputs = []
  const filters = []
  timeline.forEach((s, i) => {
    inputs.push('-i', s.file)
    filters.push(`[${i}:a]adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)}[u${i}]`)
  })
  let mixInputs = timeline.map((_, i) => `[u${i}]`).join('')
  let n = timeline.length
  if (music) {
    inputs.push('-stream_loop', '-1', '-i', music.file)
    const introSec = Math.min(6, Math.max(4, Number(music.introSec || 5)))
    const outroSec = Math.min(6, Math.max(3, Number(music.outroSec || 4)))
    const bedEnd = Math.max(introSec, total - outroSec)
    const introVol = Number(music.introVol || 0.10)
    const bedVol = Math.min(0.008, Number(music.bedVol || 0.005))
    const outroVol = Number(music.outroVol || 0.08)
    filters.push(`[${n}:a]atrim=0:${total.toFixed(2)},asplit=3[mi][mb][mo]`)
    filters.push(`[mi]atrim=0:${introSec.toFixed(2)},afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, introSec - 1.2).toFixed(2)}:d=1.2,volume=${introVol}[mintro]`)
    filters.push(`[mb]atrim=${introSec.toFixed(2)}:${bedEnd.toFixed(2)},asetpts=PTS-STARTPTS,volume=${bedVol},adelay=${Math.round(introSec * 1000)}|${Math.round(introSec * 1000)}[mbed]`)
    filters.push(`[mo]atrim=${bedEnd.toFixed(2)}:${total.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, outroSec - 1).toFixed(2)}:d=1,volume=${outroVol},adelay=${Math.round(bedEnd * 1000)}|${Math.round(bedEnd * 1000)}[moutro]`)
    filters.push('[mintro][mbed][moutro]amix=inputs=3:normalize=0[mus]')
    mixInputs += '[mus]'; n++
  }
  filters.push(`${mixInputs}amix=inputs=${n}:normalize=0[mix]`)
  filters.push(`[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
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
  if (longSilences.length > maxLongSilences) issues.push(`${longSilences.length} فترات صمت أطول من 800ms`)
  const volume = spawnSync(FFMPEG, ['-hide_banner', '-i', mp3, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || ''
  const peak = Number((volume.match(/max_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  const mean = Number((volume.match(/mean_volume:\s*(-?[0-9.]+) dB/) || [])[1])
  if (Number.isFinite(peak) && peak > -1) issues.push(`ذروة ${peak}dB أعلى من هامش الأمان -1dB`)
  return { dur, size, longSilences, peakDb: Number.isFinite(peak) ? peak : null,
    meanDb: Number.isFinite(mean) ? mean : null, issues }
}

async function validateDialogueFidelity(article, script) {
  const dialogue = (script.utterances || []).map((utterance) => `${utterance.speaker}: ${utterance.text}`).join('\n')
  const verdict = await gemini(
    'أنت بوابة إسناد عربية صارمة. قارن الحوار بالمقال الأصلي. ارفض أي معلومة أو اسم أو رقم أو نتيجة غير موجودة، وأي حذف يقلب الفكرة المركزية. يُسمح فقط بذكر عنوان المقال، واسم مؤلفه د. أحمد الفيلكاوي، ودعوة قصيرة لقراءة المقال الأصلي في موقعه؛ هذه بيانات نشر مسموحة وليست ادعاءً جديداً. لا تحكم على الأسلوب. أعد JSON فقط: {"pass":true,"problems":[]}.',
    `عنوان المقال: ${article.title}\nالمؤلف المسموح ذكره: د. أحمد الفيلكاوي\nالمقال الأصلي:\n${article.body}\n\nالحوار:\n${dialogue}`,
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
  const bytes = readFileSync(mp3)
  if (bytes.length > 18 * 1024 * 1024) throw new Error('الحلقة أكبر من حد الحكم الصوتي المباشر')
  const verdict = await gemini(JUDGE_SYSTEM, [
    'هذه بوابة الحلقة الكاملة بعد الدمج. استمع إلى الملف كله، لا إلى STT وحده.',
    `النص النطقي المقصود كاملاً: ${intended}`,
    `STT للحلقة المدمجة: ${stt.text}`,
    `Transcript الظاهر: ${transcript.map((item) => `${item.speaker}: ${item.text}`).join('\n')}`,
    `الكلمات الخطرة: ${JSON.stringify(risks)}`,
    'افحص ثبات الفصحى، اتساق الأسماء بين الصوتين، البتر عند الحدود، الوقفات، وأي تداخل يبتلع حرفاً. أعد JSON فقط.',
  ].join('\n'), 0.1, JUDGE_MODEL, [{ inlineData: { mimeType: 'audio/mpeg', data: bytes.toString('base64') } }])
  if (typeof verdict?.pass !== 'boolean' || !Array.isArray(verdict?.problems)) throw new Error('حكم الحلقة الكاملة غير صالح')
  return { ...verdict, pass: verdict.pass === true && verdict.problems.length === 0 }
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
  for (const label of labels) {
    const option = mapping.get(label)
    parts.push({ text: `الملف ${label}` })
    parts.push({ inlineData: { mimeType: 'audio/mpeg', data: readFileSync(option.file).toString('base64') } })
  }
  const system = `أنت لجنة تحكيم صوتية عمياء. ستسمع نسخاً للنص والتوقيت والموسيقى نفسيها؛ المتغير الوحيد زوج الصوت. لا تحاول تخمين البلد أو الاسم. قيّم الفصحى والنطق والمعنى والطبيعية والراحة. أعد JSON فقط: {"ranking":[{"label":"A","scores":{"pronunciationMeaning":0,"fushaNeutrality":0,"naturalDialogue":0,"questionAndObjectionIntonation":0,"pairHarmony":0,"listeningComfort":0},"reason":""}],"winner":"A"}. يجب إدراج كل labels مرة واحدة وترتيبها من الأفضل إلى الأضعف. كل درجة 0–100.`
  const response = await gemini(system, `جولة عمياء مستقلة رقم ${round}. استمع إلى كل الملفات كاملة قبل الترتيب.`, 0.12, JUDGE_MODEL, parts)
  const ranking = Array.isArray(response?.ranking) ? response.ranking : []
  if (ranking.length !== labels.length || new Set(ranking.map((item) => item.label)).size !== labels.length
    || ranking.some((item) => !mapping.has(item.label) || !validVoiceScores(item.scores)))
    throw new Error(`نتيجة ترتيب أعمى غير صالحة في الجولة ${round}`)
  return { round, ranking: ranking.map((item, rank) => ({ optionKey: mapping.get(item.label).key,
    blindLabel: item.label, rank: rank + 1, score: weightedVoiceScore(item.scores), scores: item.scores,
    reason: String(item.reason || '') })) }
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

function auditPath(article, lang) {
  mkdirSync(AUDITS, { recursive: true })
  return resolve(AUDITS, `${article.slug}.${lang}.json`)
}

function writeAudit(article, lang, payload) {
  atomicWriteText(auditPath(article, lang), JSON.stringify(payload, null, 2))
}

const runInsert = memoryDb.prepare(`INSERT OR REPLACE INTO episode_runs
  (run_id, slug, source_hash, pipeline_hash, status, reason, started_at, finished_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

/* ═══════════ المعالجة الكاملة لمقال ═══════════ */
async function produce(article, lang) {
  if (lang === 'ar' && !DRY && !PLAN && !ARABIC_PRODUCTION_GATE_READY)
    throw new Error('بوابة عينة الصوت غير معتمدة؛ ممنوع إنتاج الحلقة العربية الكاملة')
  const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
  const outMp3 = resolve(AUDIO, article.slug + suffix)
  const transcriptPath = resolve(AUDIO, `${article.slug}.dialogue.json`)
  const sourceHash = createHash('sha256').update(article.body).digest('hex')
  const contentHash = createHash('sha256').update(`${sourceHash}|${lang}|${ACTIVE_PIPELINE_HASH}`).digest('hex').slice(0, 16)
  const key = `${article.slug}:${lang}`
  const completed = state.done[key]
  const audioMatches = existsSync(outMp3) && typeof completed?.audioHash === 'string'
    && createHash('sha256').update(readFileSync(outMp3)).digest('hex') === completed.audioHash
  const transcriptMatches = lang !== 'ar' || (existsSync(transcriptPath) && typeof completed?.transcriptHash === 'string'
    && createHash('sha256').update(readFileSync(transcriptPath)).digest('hex') === completed.transcriptHash)
  if (!FORCE && completed?.contentHash === contentHash && completed?.status === 'accepted_automated'
    && audioMatches && transcriptMatches) {
    console.log(`↷ ${article.title} (${lang}) — منجز ومفحوص`)
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
  }
  runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, 'qa_in_progress', '', startedAt, '')
  pendingMemory.length = 0
  const quarantine = (reason, extra = {}) => {
    auditRecord.status = 'quarantined'
    auditRecord.finishedAt = new Date().toISOString()
    auditRecord.finalGate = { ...auditRecord.finalGate, pass: false, reasonCodes: [reason], ...extra }
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
    if (REUSE_DIALOGUE && existsSync(auditPath(article, lang))) {
      const previous = JSON.parse(readFileSync(auditPath(article, lang), 'utf8'))
      if (previous.pipelineHash === ACTIVE_PIPELINE_HASH && previous.source?.sha256 === sourceHash && previous.dialogue?.utterances?.length) {
        script = { mood: previous.dialogue.mood || 'تأملي', storyIntro: Boolean(previous.dialogue.storyIntro),
          utterances: previous.dialogue.utterances.map((utterance, index) => ({ speaker: utterance.speaker,
            text: utterance.dialogueText, delivery: utterance.delivery || 'normal', ratePct: utterance.ratePct,
            pauseAfterMs: utterance.pauseAfterMs,
            ending: utterance.ending, internalBreakMs: utterance.internalBreakMs,
            allowOverlap: Boolean(utterance.allowOverlap), overlapMs: utterance.overlapMs || 0,
            emphasisWords: utterance.emphasisWords || [], pronunciationNotes: '', _index: index })) }
        lintIssues = lintScript(script, lang)
        if (!lintIssues.length && lang === 'ar') fidelity = await validateDialogueFidelity(article, script)
        if (!fidelity.pass) lintIssues.push(...fidelity.problems.map((problem) => `إسناد: ${problem.issue || problem}`))
        if (!lintIssues.length) console.log('  ↷ أُعيد استخدام dialogueText المجتاز من الخطة السابقة')
        else script = null
      }
    }
    for (let round = 1; round <= 4 && !script; round++) {
      const candidate = await gemini(sys, userMsg + (lintIssues.length ? `\n\nREWRITE. Previous gate failures: ${lintIssues.join(' | ')}` : ''), 0.72, DIALOGUE_MODEL)
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
        const { text, _index, ...metadata } = utterance
        return { id: `u${String(index + 1).padStart(3, '0')}`, ...metadata, dialogueText: text }
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
    if (lang === 'ar') {
      analyses = await riskAnalyze(utts)
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
      const wav = resolve(TMP, `${utteranceId}.wav`)
      const result = await produceUtterance(utterance, analyses[index], voiceInfo.azure, lang, wav,
        { runId, utteranceId, sourceText: article.body })
      if (!result.ok || (lang === 'ar' && !result.verified)) return quarantine(`المداخلة ${utteranceId}: ${result.reason || 'غير موثقة'}`)
      const risks = result.risks || []
      const hasHighRisk = risks.some((risk) => risk.riskLevel === 'high')
      allRisks.push(...risks.map((risk) => ({ ...risk, utteranceId, voice: voiceInfo.azure })))
      transcript.push({ speaker: voiceInfo.name, speakerKey: utterance.speaker, text: result.dialogueText || utterance.text,
        delivery: utterance.delivery, ratePct: utterance.ratePct, pauseAfterMs: utterance.pauseAfterMs,
        ending: utterance.ending, internalBreakMs: utterance.internalBreakMs,
        allowOverlap: Boolean(utterance.allowOverlap), overlapMs: Number(utterance.overlapMs || 0) })
      pronunciation.push({ id: utteranceId, speaker: utterance.speaker, voice: voiceInfo.azure,
        pronunciationText: result.pronunciationText || utterance.text, intendedText: result.intendedText || result.pronunciationText || utterance.text, risks,
        selectedCandidateId: result.selectedCandidate, candidates: result.candidates, stt: result.heard })
      const pauseAfterMs = Math.min(700, Math.max(100, Number(utterance.pauseAfterMs || 220)))
      const overlapMs = !hasHighRisk && !previousHasHighRisk && utterance.allowOverlap
        ? Math.min(180, Math.max(60, Number(utterance.overlapMs || 100))) : 0
      segments.push({ file: wav, pauseAfterMs, overlapMs, hasHighRisk })
      previousHasHighRisk = hasHighRisk
      process.stdout.write(`  🎙 ${index + 1}/${utts.length} (TTS→STT→Judge)\r`)
    }
    console.log('')
    auditRecord.dialogue.utterances = transcript.map((item, index) => ({ id: `u${String(index + 1).padStart(3, '0')}`,
      speaker: item.speakerKey, dialogueText: item.text, delivery: item.delivery, ratePct: item.ratePct,
      pauseAfterMs: item.pauseAfterMs, ending: item.ending, internalBreakMs: item.internalBreakMs,
      allowOverlap: item.allowOverlap, overlapMs: item.overlapMs }))
    auditRecord.pronunciation.utterances = pronunciation

    const finalLanguageIssues = lintScript({ utterances: transcript.map((item) => ({ speaker: item.speakerKey,
      text: item.text, delivery: item.delivery, ratePct: item.ratePct, pauseAfterMs: item.pauseAfterMs,
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

    /* ٤) الموسيقى مقدمة وخاتمة؛ تحت الكلام تكاد تختفي ولا تُستخدم لإخفاء النطق. */
    let music = null
    if (existsSync(MUSIC_LIB)) {
      const library = JSON.parse(readFileSync(MUSIC_LIB, 'utf8'))
      const track = (library.tracks || []).find((item) => item.licensed && (item.moods || []).includes(script.mood))
      if (track && existsSync(resolve(ROOT, track.path)))
        music = { file: resolve(ROOT, track.path), bedVol: Math.min(0.004, track.bedVolume ?? 0.003),
          introVol: 0.10, outroVol: 0.08, introSec: 5, outroSec: 4 }
    }
    if (!music) console.log('  ♪ إخراج بلا موسيقى — لا يوجد مسار مرخّص مطابق')

    /* ٥) تركيب مؤقت ثم فحص الحلقة كاملة؛ الملف الحالي لا يُمس */
    const candidateMp3 = resolve(TMP, `${article.slug}.accepted-candidate.mp3`)
    const assembled = assemble(segments, candidateMp3, music)
    const sourceWordCount = article.body.trim().split(/\s+/).length
    const durationRange = sourceWordCount >= 350 && sourceWordCount <= 450
      ? { minSec: 225, maxSec: 285, maxLongSilences: 0 }
      : { minSec: 180, maxSec: 300, maxLongSilences: 0 }
    const technicalAudit = auditAudio(candidateMp3, durationRange)
    if (technicalAudit.issues.length) return quarantine(`الفحص التقني: ${technicalAudit.issues.join(' · ')}`)
    const fullStt = await transcribeAssembledEpisode(candidateMp3, assembled.timeline, lang === 'ar' ? localeOf(voices.A.azure) : 'en-US')
    const intendedFull = pronunciation.map((item) => item.intendedText.replace(/\|/g, ' ')).join(' ')
    const fullComparison = compareTexts(intendedFull, fullStt.text)
    const missingNegations = fullComparison.missing.filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'].includes(word))
    const highRiskMissing = allRisks.filter((risk) => risk.riskLevel === 'high')
      .filter((risk) => !heardContainsRisk(fullStt.text, risk))
    if (missingNegations.length || highRiskMissing.length || fullComparison.importantRatio < 0.95 || fullComparison.ratio < 0.90)
      return quarantine(`STT الحلقة الكاملة لم يطابق النص المقصود (المهم ${Math.round(fullComparison.importantRatio * 100)}٪)`, { fullStt, fullComparison })
    const finalJudge = await judgeFullEpisode(candidateMp3, intendedFull, fullStt, transcript, allRisks)
    if (!finalJudge.pass) return quarantine(`Arabic Audio Judge للحلقة: ${(finalJudge.problems || []).map((problem) => problem.issue).join(' · ')}`, { fullStt, finalJudge })

    /* ٦) نشر ذري بعد النجاح وحده + تثبيت الذاكرة الناجحة */
    const publicTranscript = { title: article.title, generatedAt: new Date().toISOString().slice(0, 10),
      language: 'ar', utterances: transcript.map(({ speaker, text }) => ({ speaker, text })) }
    const tempTranscript = resolve(TMP, `${article.slug}.dialogue.json`)
    if (lang === 'ar') writeFileSync(tempTranscript, JSON.stringify(publicTranscript, null, 2))
    const backupAudio = resolve(TMP, `${article.slug}.previous.mp3`)
    const backupTranscript = resolve(TMP, `${article.slug}.previous.json`)
    const previousStateEntry = Object.prototype.hasOwnProperty.call(state.done, key) ? structuredClone(state.done[key]) : undefined
    const previousTotalCount = Number(state.totalCount || 0)
    const previousStoryCount = Number(state.storyCount || 0)
    if (existsSync(outMp3)) renameSync(outMp3, backupAudio)
    if (lang === 'ar' && existsSync(transcriptPath)) renameSync(transcriptPath, backupTranscript)
    try {
      renameSync(candidateMp3, outMp3)
      if (lang === 'ar') renameSync(tempTranscript, transcriptPath)
      const audioHash = createHash('sha256').update(readFileSync(outMp3)).digest('hex')
      const transcriptHash = lang === 'ar' ? createHash('sha256').update(readFileSync(transcriptPath)).digest('hex') : ''
      state.done[key] = { contentHash, pipelineHash: ACTIVE_PIPELINE_HASH, sourceHash, audioHash, transcriptHash,
        status: 'accepted_automated', acceptedAt: new Date().toISOString() }
      state.totalCount = previousTotalCount + 1
      if (isStory) state.storyCount = previousStoryCount + 1
      saveState()
      auditRecord.status = 'accepted_automated'
      auditRecord.finishedAt = new Date().toISOString()
      auditRecord.finalGate = { pass: true, reasonCodes: [], technicalAudit, fullStt,
        fullComparison: { ratio: fullComparison.ratio, importantRatio: fullComparison.importantRatio,
          missing: fullComparison.missing, missingImportant: fullComparison.missingImportant }, finalJudge }
      writeAudit(article, lang, auditRecord)
      runInsert.run(runId, article.slug, sourceHash, ACTIVE_PIPELINE_HASH, 'accepted_automated', '', startedAt, auditRecord.finishedAt)
      const riskMap = new Map(allRisks.map((risk) => [normalizeAr(risk.word), risk]))
      commitPendingMemory(riskMap)
      rmSync(backupAudio, { force: true })
      rmSync(backupTranscript, { force: true })
    } catch (publishError) {
      rmSync(outMp3, { force: true })
      if (lang === 'ar') rmSync(transcriptPath, { force: true })
      if (existsSync(backupAudio)) renameSync(backupAudio, outMp3)
      if (lang === 'ar' && existsSync(backupTranscript)) renameSync(backupTranscript, transcriptPath)
      if (previousStateEntry === undefined) delete state.done[key]
      else state.done[key] = previousStateEntry
      state.totalCount = previousTotalCount
      state.storyCount = previousStoryCount
      saveState()
      throw publishError
    }
    rmSync(TMP, { recursive: true, force: true })
    console.log(`  ✅ قبول آلي صارم · ${(technicalAudit.dur / 60).toFixed(1)} دقيقة · ${(technicalAudit.size / 1e6).toFixed(1)}MB → ${article.slug}${suffix}`)
    return 'ok'
  } catch (error) {
    return quarantine(error?.message || String(error))
  }
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
  assert(sampleFixture.utterances.every((utterance) => utterance.ratePct >= 3 && utterance.ratePct <= 14), 'كل سرعة في العينة ضمن +3..+14')
  assert(existsSync(FFMPEG) && existsSync(FFPROBE), 'ffmpeg/ffprobe يجب أن يكونا قابلين للتنفيذ خارج PATH')
  console.log('✓ اختبارات بوابة البودكاست العربي: 12/12')
  process.exit(0)
}

const requiresGeminiNow = !PREFLIGHT && (BAKEOFF || CANARY || DRY || PLAN || Boolean(opt('slug'))
  || Boolean(opt('latest')) || flag('nightly'))
if (requiresGeminiNow) {
  try { await assertGeminiBillingReady() }
  catch (error) { console.error(`⛔ ${error.message}`); process.exit(4) }
}
const voicesForPreflight = BAKEOFF
  ? AR_VOICE_PAIRS.flatMap((pair) => [pair.A, pair.B])
  : [VOICES.ar.A.azure, VOICES.ar.B.azure]
const ssmlProfiles = await probeSsmlCapabilities(PREFLIGHT && FORCE, voicesForPreflight)
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

/* ═══════════ اختبار الأصوات الأعمى (voice bake-off) ═══════════
   النص والنطق والتوقيت والموسيقى والمعالجة مجمّدة. المتغير الوحيد ShortName للصوت
   وxml:lang الملازم له. لا يُسمح بإنتاج حلقة كاملة من هذه الكتلة. */
if (BAKEOFF) {
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
    const outMp3 = resolve(stagedPublic, `${optionKey}.mp3`)
    const assembled = assemble(segments, outMp3, music)
    const technical = auditAudio(outMp3, { minSec: SAMPLE_MIN_SEC, maxSec: SAMPLE_MAX_SEC, maxLongSilences: 0 })
    const fullWav = resolve(pairDir, 'assembled.wav')
    ff(['-i', outMp3, '-ar', '24000', '-ac', '1', fullWav])
    const intended = sample.utterances.map((utterance) => utterance.pronunciationText.replace(/\|/g, ' ')).join(' ')
    const risks = utteranceAudits.flatMap((audit) => audit.risks.map((risk) => ({ ...risk,
      utteranceIndex: audit.index, voice: audit.voice })))
    let ensemble = null
    let voiceJudge = { pass: false, problems: [{ word: '', issue: 'لم يبدأ الحكم' }], scores: {}, totalScore: 0 }
    try {
      ensemble = await sttRecognizeEnsemble(fullWav, intended, risks)
      voiceJudge = await judgeVoiceSample(outMp3, sample, ensemble, risks)
    } catch (error) {
      voiceJudge = { pass: false, problems: [{ word: '', issue: `تعذر حكم العينة: ${error.message}` }], scores: {}, totalScore: 0 }
    }
    const hardGate = { pass: utteranceAudits.every((audit) => audit.pass) && technical.issues.length === 0
      && ensemble?.pass === true && voiceJudge.pass === true,
    utterancesPass: utteranceAudits.filter((audit) => audit.pass).length,
    utterancesTotal: utteranceAudits.length, technicalPass: technical.issues.length === 0,
    ensemblePass: ensemble?.pass === true, audioJudgePass: voiceJudge.pass === true }
    options.push({ key: optionKey, file: outMp3, pairId: pair.id, country: pair.country,
      voiceA: pair.A, voiceB: pair.B, nameA: pair.nameA, nameB: pair.nameB,
      durationSec: Math.round(technical.dur * 10) / 10,
      utteranceAudits, technical, ensemble, voiceJudge, hardGate, timeline: assembled.timeline })
    console.log(`\n  ${hardGate.pass ? '✅' : '⛔'} ${optionKey} · ${technical.dur.toFixed(1)}ث · ${utteranceAudits.filter((audit) => audit.pass).length}/${utteranceAudits.length} مداخلات`)
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
  const audioHashes = Object.fromEntries(options.map((option) => [option.key,
    createHash('sha256').update(readFileSync(option.file)).digest('hex')]))
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
    options: options.map((option) => ({ key: option.key, durationSec: option.durationSec,
      audio: `/audio/bakeoff/${option.key}.mp3?v=${audioHashes[option.key].slice(0, 16)}`,
      audioHash: audioHashes[option.key], eligible: option.hardGate.pass })),
  }
  const privateAudit = { schemaVersion: 2, generatedAt, pipelineHash: PIPELINE_HASH, frozen,
    sample: { title: sample.title, sourceSlug: sample.sourceSlug, utterances: sample.utterances },
    voiceAvailability, capabilityProfiles: ssmlProfiles,
    options: options.map(({ file, ...option }) => ({ ...option, fileName: `${option.key}.mp3` })),
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

const needsArabicProductionGate = (LANG === 'ar' || LANG === 'both' || flag('nightly')) && !DRY && !PLAN
if (needsArabicProductionGate) {
  const gate = await loadApprovedVoices()
  if (!gate.pass) {
    console.error(`⛔ لم تُنتج أي حلقة: ${gate.reason}`)
    console.error('شغّل عينة 60–90 ثانية، ثم اعتمد optionKey المجتاز من اللوحة. --force لا يتجاوز هذه البوابة.')
    process.exit(3)
  }
  ARABIC_PRODUCTION_GATE_READY = true
}

const ARTICLES = await loadArticles()
const targetSlug = opt('slug')
const latest = Number(opt('latest') || 0)
const nightly = flag('nightly')

let queue = []
if (targetSlug) queue = ARTICLES.filter((a) => a.slug === targetSlug)
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
      && createHash('sha256').update(readFileSync(audioFile)).digest('hex') === saved.audioHash
    const transcriptIntact = existsSync(transcriptFile) && typeof saved?.transcriptHash === 'string'
      && createHash('sha256').update(readFileSync(transcriptFile)).digest('hex') === saved.transcriptHash
    return saved?.contentHash !== expected || saved?.status !== 'accepted_automated'
      || !audioIntact || !transcriptIntact
  }).slice(0, limit)
}
else { console.log('حدد --slug= أو --latest=N أو --nightly'); process.exit(1) }
if (!queue.length) { console.log(targetSlug ? `لا يوجد مقال مطابق: ${targetSlug}` : 'لا حلقات ناقصة ضمن حد الليلة'); process.exit(targetSlug ? 1 : 0) }

/* لا fallback صامتاً: الحلقة العربية الكاملة تحتاج عينة محلية ناجحة + اعتماد Firestore
   يحمل optionKey وsampleHash نفسيهما. --force لا يتجاوز هذه البوابة. */
async function loadApprovedVoices() {
  try {
    if (!existsSync(BAKEOFF_PRIVATE)) return { pass: false, reason: 'لا يوجد تدقيق خاص ناجح لعينة الأصوات' }
    const audit = JSON.parse(readFileSync(BAKEOFF_PRIVATE, 'utf8'))
    if (audit?.sampleGate?.pass !== true) return { pass: false, reason: `بوابة العينة غير ناجحة: ${audit?.sampleGate?.reason || 'سبب غير مسجل'}` }
    if (audit.pipelineHash !== PIPELINE_HASH) return { pass: false, reason: 'تدقيق العينة أقدم من محرك اللغة/الصوت الحالي' }
    const sampleFile = resolve(ROOT, 'scripts/bakeoff-sample.json')
    if (!existsSync(sampleFile)) return { pass: false, reason: 'ملف عينة القبول الحالي مفقود' }
    const currentSample = JSON.parse(readFileSync(sampleFile, 'utf8'))
    const sourceArticle = STATIC_ARTICLES.find((article) => article.slug === currentSample.sourceSlug)
    if (!sourceArticle) return { pass: false, reason: 'مصدر عينة القبول الحالية غير موجود' }
    const currentFrozen = computeSampleContentHashes(currentSample, sourceArticle, selectLicensedMusic(currentSample.mood))
    if (currentFrozen.sampleHash !== audit.frozen?.sampleHash)
      return { pass: false, reason: 'المقال أو الحوار أو النطق أو التوقيت أو الموسيقى تغيّر بعد اختبار العينة' }
    const publicManifestPath = resolve(BAKEOFF_PUBLIC, 'manifest.json')
    if (!existsSync(publicManifestPath)) return { pass: false, reason: 'manifest العينة العامة مفقود' }
    const publicManifest = JSON.parse(readFileSync(publicManifestPath, 'utf8'))
    if (publicManifest.schemaVersion !== 2 || publicManifest.sampleHash !== audit.frozen.sampleHash
      || publicManifest.approvalHash !== audit.frozen.approvalHash)
      return { pass: false, reason: 'manifest العام لا يطابق التدقيق الخاص' }
    for (const [optionKey, expectedHash] of Object.entries(audit.frozen.audioHashes || {})) {
      const audioFile = resolve(BAKEOFF_PUBLIC, `${optionKey}.mp3`)
      if (!existsSync(audioFile) || createHash('sha256').update(readFileSync(audioFile)).digest('hex') !== expectedHash)
        return { pass: false, reason: `ملف العينة ${optionKey} تغيّر بعد الحكم` }
    }
    if (Object.keys(audit.frozen.audioHashes || {}).length !== AR_VOICE_PAIRS.length)
      return { pass: false, reason: 'بصمات ملفات الأزواج الخمسة غير مكتملة' }
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
  for (const l of nightly ? (autoEn ? ['ar', 'en'] : ['ar']) : langs) {
    const r = await produce(a, l).catch((e) => { console.error('  ✘', String(e).slice(0, 150)); return 'fail' })
    if (r === 'ok') done++
    if (r === 'fail') failed++
  }
}
console.log(`\n═══ اكتمل: ${done} · فشل: ${failed} ═══`)
process.exit(failed ? 2 : 0)
