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
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import assert from 'node:assert/strict'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-tmp')
const AUDITS = resolve(ROOT, 'podcast-audits')
const STATE_FILE = resolve(ROOT, '.podcast-state.json')
const MUSIC_LIB = resolve(ROOT, 'scripts/music-library.json')
const LEX_FILE = resolve(ROOT, 'scripts/pronunciation-lexicon.json')
const MEM_FILE = resolve(ROOT, 'ArabicPronunciationMemory.sqlite')

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

const VOICES = {
  ar: { A: { name: 'فهد', azure: 'ar-KW-FahedNeural' }, B: { name: 'نورة', azure: 'ar-KW-NouraNeural' } },
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
if (!SELF_TEST && (!GEMINI_KEY || !AZURE_KEY)) { console.error('✘ GEMINI_API_KEY أو AZURE_SPEECH_KEY مفقود'); process.exit(1) }

/* ── حالة idempotent + قاموس + ذاكرة ── */
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { done: {}, storyCount: 0, totalCount: 0 }
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))
const lexicon = existsSync(LEX_FILE) ? JSON.parse(readFileSync(LEX_FILE, 'utf8')) : { entries: {} }
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
  version: 'arabic-podcast-v4',
  dialoguePrompt: AR_SYSTEM,
  pronunciationPrompt: PRONOUNCE_SYSTEM,
  judgePrompt: JUDGE_SYSTEM,
  lexicon,
  models: { dialogue: DIALOGUE_MODEL, analysis: ANALYSIS_MODEL, judge: JUDGE_MODEL },
  voices: VOICES.ar,
  region: AZURE_REGION,
})).digest('hex').slice(0, 16)
const PROVIDER_FINGERPRINT = `${AZURE_REGION}:${VOICES.ar.A.azure}:${VOICES.ar.B.azure}:azure-ssml-v1`
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
      lastStatus = `HTTP ${res.status}`
      // ضغط المعدّل (429) أو خطأ خادم مؤقت (5xx): تراجع أطول تصاعدي
      if (res.status === 429 || res.status >= 500) await new Promise((r) => setTimeout(r, 6000 * attempt))
      else await new Promise((r) => setTimeout(r, 2500 * attempt))
      continue
    }
    await new Promise((r) => setTimeout(r, 2500 * attempt))
  }
  throw new Error(`Gemini فشل بعد ٥ محاولات (${lastStatus})`)
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
  if (utts.length < 8) issues.push(`مداخلات قليلة (${utts.length})`)
  const words = utts.reduce((n, u) => n + (u.text || '').split(/\s+/).length, 0)
  const [lo, hi] = lang === 'ar' ? [380, 850] : [420, 900]
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
  }
  const aWords = utts.filter((u) => u.speaker === 'A').reduce((n, u) => n + u.text.split(/\s+/).length, 0)
  const ratio = aWords / Math.max(1, words)
  if (ratio < 0.3 || ratio > 0.7) issues.push(`توازن مختل: A=${Math.round(ratio * 100)}%`)
  const starts = utts.map((u) => (u.text || '').split(/\s+/)[0])
  for (const w of ['صحيح', 'بالضبط', 'Exactly', 'Right']) {
    const c = starts.filter((s) => s === w || s === w + '،' || s === w + ',').length
    if (c > 2) issues.push(`تكرار بداية «${w}» ×${c}`)
  }
  const lens = utts.map((u) => u.text.split(/\s+/).length)
  const sameLen = lens.every((l) => Math.abs(l - lens[0]) <= 2)
  if (sameLen && utts.length > 6) issues.push('كل المداخلات بالطول نفسه — يبدو آلياً')
  if (lens.some((l) => l > 85)) issues.push('مداخلة أطول من المسموح')
  const overlaps = utts.filter((u) => u.allowOverlap).length
  if (overlaps > Math.ceil(utts.length / 3)) issues.push('تداخلات أكثر من اللازم')
  return issues
}

/* ═══════════ التطبيع والمقارنة (للفحص الصوتي المغلق) ═══════════ */
const stripDiacritics = (s) => String(s || '').replace(/[ً-ْٰـ]/g, '')
const normalizeAr = (s) => stripDiacritics(s)
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[^ء-ي0-9a-zA-Z\s]/g, ' ')
  .replace(/\s+/g, ' ').trim()

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

/** يبني SSML من النص النطقي: <sub> للصيغ المنطوقة البديلة، | ← وقفة داخلية، سرعة هادئة حسب الأداء */
function buildSSML(u, pronText, subs, voice, lang) {
  const rate = u.delivery === 'reflective' ? '-16%' : u.delivery === 'hook' ? '-4%' : u.delivery === 'question' ? '-12%' : '-10%'
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
  text = text.replace(/\s*\|\s*/g, '<break time="220ms"/>')
  for (const w of u.emphasisWords || []) {
    const ew = escXml(w)
    if (!text.includes('<sub') && text.includes(ew)) text = text.replace(ew, `<emphasis level="moderate">${ew}</emphasis>`)
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang === 'ar' ? 'ar-KW' : 'en-US'}">
  <voice name="${voice}"><prosody rate="${rate}">${text}</prosody></voice>
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

/** الفحص المغلق: الملف الصوتي ← Azure STT ← النص المسموع فعلاً */
async function sttRecognize(wavPath) {
  const wav16 = wavPath.replace(/\.wav$/, '.16k.wav')
  ff(['-i', wavPath, '-ar', '16000', '-ac', '1', wav16])
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://${AZURE_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ar-KW&format=detailed&profanity=raw`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000' },
        body: readFileSync(wav16),
      })
      if (res.ok) {
        const j = await res.json()
        rmSync(wav16, { force: true })
        const best = j.NBest?.[0] || {}
        return {
          text: best.Display || best.Lexical || j.DisplayText || '',
          lexical: best.Lexical || '',
          confidence: Number(best.Confidence || 0),
          words: Array.isArray(best.Words) ? best.Words : [],
        }
      }
      if (res.status === 429) await new Promise((r) => setTimeout(r, 3000 * attempt))
    } catch { /* أعد */ }
  }
  rmSync(wav16, { force: true })
  return null
}

async function audioJudge(wavPath, intended, heard, risks, context) {
  const bytes = readFileSync(wavPath)
  if (bytes.length > 18 * 1024 * 1024) throw new Error('المقطع أكبر من حد الحكم الصوتي')
  const prompt = [
    `النص المقصود: ${intended}`,
    `ناتج Azure STT: ${heard.text}`,
    `ثقة STT: ${heard.confidence}`,
    `الكلمات الخطرة: ${JSON.stringify(risks)}`,
    `سياق المعنى: ${context}`,
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

async function probeSsmlCapabilities(force = false) {
  const select = memoryDb.prepare('SELECT * FROM capability_profiles WHERE voice = ? AND provider_fingerprint = ?')
  const save = memoryDb.prepare(`INSERT OR REPLACE INTO capability_profiles
    (voice, provider_fingerprint, break_supported, prosody_supported, sub_supported,
     say_as_supported, phoneme_supported, custom_lexicon_supported, notes, tested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const dir = resolve(TMP, 'ssml-preflight')
  mkdirSync(dir, { recursive: true })
  for (const voice of [VOICES.ar.A.azure, VOICES.ar.B.azure]) {
    const cached = !force && select.get(voice, PROVIDER_FINGERPRINT)
    if (cached) {
      capabilityProfiles.set(voice, { breakSupported: Boolean(cached.break_supported), prosodySupported: Boolean(cached.prosody_supported),
        subSupported: Boolean(cached.sub_supported), sayAsSupported: Boolean(cached.say_as_supported),
        phonemeSupported: Boolean(cached.phoneme_supported), customLexiconSupported: Boolean(cached.custom_lexicon_supported),
        notes: cached.notes, testedAt: cached.tested_at })
      continue
    }
    const run = async (name, inner, expected = '') => {
      const file = resolve(dir, `${voice}.${name}.wav`)
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-KW"><voice name="${voice}">${inner}</voice></speak>`
      if (!await synthSSML(ssml, file)) return false
      const heard = await sttRecognize(file)
      rmSync(file, { force: true })
      if (!heard?.text) return false
      return !expected || normalizeAr(heard.text).replace(/\s+/g, '').includes(normalizeAr(expected).replace(/\s+/g, ''))
    }
    const breakSupported = await run('break', 'هذه وقفة <break time="180ms"/> طبيعية')
    const prosodySupported = await run('prosody', '<prosody rate="-8%">نقرأ بهدوء ووضوح</prosody>')
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
    save.run(voice, PROVIDER_FINGERPRINT, breakSupported ? 1 : 0, prosodySupported ? 1 : 0,
      subSupported ? 1 : 0, sayAsSupported ? 1 : 0, 0, 0, profile.notes, profile.testedAt)
    capabilityProfiles.set(voice, profile)
  }
  rmSync(dir, { recursive: true, force: true })
  return Object.fromEntries(capabilityProfiles)
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
  for (const [word, entry] of Object.entries(lexicon.entries || {})) {
    if (text.includes(word)) add(word, entry)
  }
  for (const match of text.matchAll(/\b(?:\d{1,4}(?:[./-]\d{1,4})*|[A-Za-z][A-Za-z0-9.-]*(?:\s+[A-Za-z][A-Za-z0-9.-]*)*)\b/g)) {
    add(match[0], {
      type: /\d/.test(match[0]) ? 'رقم أو تاريخ' : 'اسم أو مصطلح أجنبي',
      reason: /\d/.test(match[0]) ? 'الأرقام والتواريخ عالية الخطورة' : 'النص اللاتيني لا يترك لتخمين الصوت',
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
    WHERE normalized_word = ? AND voice = ? AND provider_fingerprint = ?
    ORDER BY (sense_key = ?) DESC, (context_hash = ?) DESC, use_count DESC LIMIT 1`)
    .get(normalized, voice, PROVIDER_FINGERPRINT, sense, contextHash)
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
        String(item.ssmlUsed || '').slice(0, 4000), PROVIDER_FINGERPRINT, new Date().toISOString())
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
  /* مرشح «حركة الوصل»: التاء المربوطة وسط الكلام (الراجعة في…) تُضبط بكسرة وصلٍ
     فينطقها Azure تاءً واضحة بدل ابتلاعها — علاج مثبت لكلمة ة قبل كلمة تالية */
  const taWasl = pronunciationText.replace(/ة(?=\s+[^\s،؛.!؟|)»])/g, 'ةِ')
  if (taWasl !== pronunciationText) variants.push({ id: 'ta-wasl', method: 'selective_diacritics', text: taWasl, subs })
  return variants
}

async function evaluateCandidate({ runId, utteranceId, u, dialogueText, riskAnalysis, voice, lang, variant, path }) {
  const ssml = buildSSML(u, variant.text, variant.subs, voice, lang)
  const generated = await synthSSML(ssml, path)
  if (!generated) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: 'فشل Azure TTS', variant, ssml, path }
  }
  const heard = await sttRecognize(path)
  if (!heard) {
    attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, '', 0, 0, 0, new Date().toISOString())
    return { pass: false, score: -1, reason: 'تعذر Azure STT', variant, ssml, path }
  }

  const intended = spokenText(variant.text, variant.subs)
  const comparison = compareTexts(intended, heard.text)
  const highRisks = riskAnalysis.risks.filter((risk) => risk.riskLevel === 'high')
  const normalizedHeard = normalizeAr(heard.text)
  const gluedHeard = normalizedHeard.replace(/\s+/g, '')
  const highMissing = highRisks.filter((risk) => {
    const alias = variant.subs.find((item) => item.word === risk.word)?.alias || risk.selectedPronunciation || risk.word
    const normalized = normalizeAr(alias)
    return normalized && !normalizedHeard.includes(normalized) && !gluedHeard.includes(normalized.replace(/\s+/g, ''))
  })
  const missingNegations = comparison.missing.filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'].includes(word))

  let verdict
  try {
    verdict = await audioJudge(path, intended, heard, riskAnalysis.risks, dialogueText)
  } catch (error) {
    // تعطل الحكم المؤقت (انقطاع/حصة) لا يُسقط مرشحاً سليماً — نتراجع لحكم المقارنة الصارم وحده
    const fallbackPass = highMissing.length === 0 && missingNegations.length === 0
      && comparison.importantRatio >= 0.92 && comparison.ratio >= 0.88
    verdict = { pass: fallbackPass, problems: fallbackPass ? [] : [{ word: '', issue: `تعذر الحكم وفشلت المقارنة الاحتياطية: ${error.message}` }] }
  }
  const pass = verdict.pass === true && highMissing.length === 0 && missingNegations.length === 0
    && comparison.importantRatio >= 0.78 && comparison.ratio >= 0.72
  const score = pass
    ? comparison.importantRatio * 0.55 + comparison.ratio * 0.25 + Math.min(1, heard.confidence || 0) * 0.2
    : -1
  attemptInsert.run(runId, utteranceId, variant.id, voice, variant.text, ssml, heard.text,
    comparison.importantRatio, verdict.pass ? 1 : 0, pass ? 1 : 0, new Date().toISOString())
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

function assemble(segments, outMp3, music) {
  let cursor = music ? music.introSec : 0.35
  const timeline = []
  for (const s of segments) {
    const start = Math.max(0, cursor - (s.overlapMs || 0) / 1000)
    const dur = probeDur(s.file)
    timeline.push({ ...s, start, dur })
    cursor = start + dur + (s.pauseAfterMs || 300) / 1000
  }
  const total = cursor + (music ? music.outroSec : 0.6)

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
    filters.push(`[${n}:a]atrim=0:${total.toFixed(2)},volume=${music.bedVol},afade=t=in:d=2.5,afade=t=out:st=${(total - music.outroSec - 1).toFixed(2)}:d=${music.outroSec}[mus]`)
    mixInputs += '[mus]'; n++
  }
  filters.push(`anoisesrc=color=brown:amplitude=0.0018:d=${total.toFixed(2)}[room]`)
  mixInputs += '[room]'; n++
  filters.push(`${mixInputs}amix=inputs=${n}:normalize=0[mix]`)
  filters.push(`[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', total.toFixed(2), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outMp3])
  return { total, timeline }
}

/* ═══════════ فحص الصوت النهائي للحلقة ═══════════ */
function auditAudio(mp3, expectedMinSec) {
  const dur = probeDur(mp3)
  const size = statSync(mp3).size
  const issues = []
  if (dur < expectedMinSec) issues.push(`المدة ${dur.toFixed(0)}ث أقصر من المتوقع`)
  if (dur > 480) issues.push(`المدة ${dur.toFixed(0)}ث أطول من 8 دقائق`)
  if (size < 200_000) issues.push('حجم الملف مريب')
  const det = spawnSync(FFMPEG, ['-i', mp3, '-af', 'silencedetect=noise=-38dB:d=2.5,astats=metadata=1:reset=1', '-f', 'null', '-'], { encoding: 'utf8' })
  const silences = (det.stderr.match(/silence_duration/g) || []).length
  if (silences > 1) issues.push(`${silences} فترات صمت طويلة`)
  if (/Peak level dB:\s*(?:0(?:\.0+)?|-0\.0+)/.test(det.stderr)) issues.push('ذروة صوتية قد تشير إلى clipping')
  return { dur, size, issues }
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
  return verdict
}

async function transcribeAssembledEpisode(mp3, timeline) {
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
    const heard = await sttRecognize(chunk)
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
  return verdict
}

function auditPath(article, lang) {
  mkdirSync(AUDITS, { recursive: true })
  return resolve(AUDITS, `${article.slug}.${lang}.json`)
}

function writeAudit(article, lang, payload) {
  writeFileSync(auditPath(article, lang), JSON.stringify(payload, null, 2))
}

const runInsert = memoryDb.prepare(`INSERT OR REPLACE INTO episode_runs
  (run_id, slug, source_hash, pipeline_hash, status, reason, started_at, finished_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

/* ═══════════ المعالجة الكاملة لمقال ═══════════ */
async function produce(article, lang) {
  const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
  const outMp3 = resolve(AUDIO, article.slug + suffix)
  const transcriptPath = resolve(AUDIO, `${article.slug}.dialogue.json`)
  const sourceHash = createHash('sha256').update(article.body).digest('hex')
  const contentHash = createHash('sha256').update(`${sourceHash}|${lang}|${PIPELINE_HASH}`).digest('hex').slice(0, 16)
  const key = `${article.slug}:${lang}`
  const completed = state.done[key]
  if (!FORCE && completed?.contentHash === contentHash && completed?.status === 'accepted_automated'
    && existsSync(outMp3) && (lang !== 'ar' || existsSync(transcriptPath))) {
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
    pipelineHash: PIPELINE_HASH,
    status: 'qa_in_progress',
    source: { slug: article.slug, title: article.title, sourceText: article.body, sha256: sourceHash, origin: article.origin || 'base' },
    dialogue: { utterances: [] },
    pronunciation: { utterances: [] },
    finalGate: { pass: false, reasonCodes: [] },
    models: { dialogue: DIALOGUE_MODEL, analysis: ANALYSIS_MODEL, judge: JUDGE_MODEL },
    voices,
    startedAt,
  }
  runInsert.run(runId, article.slug, sourceHash, PIPELINE_HASH, 'qa_in_progress', '', startedAt, '')
  pendingMemory.length = 0
  const quarantine = (reason, extra = {}) => {
    auditRecord.status = 'quarantined'
    auditRecord.finishedAt = new Date().toISOString()
    auditRecord.finalGate = { ...auditRecord.finalGate, pass: false, reasonCodes: [reason], ...extra }
    writeAudit(article, lang, auditRecord)
    runInsert.run(runId, article.slug, sourceHash, PIPELINE_HASH, 'quarantined', reason, startedAt, auditRecord.finishedAt)
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
      if (previous.pipelineHash === PIPELINE_HASH && previous.source?.sha256 === sourceHash && previous.dialogue?.utterances?.length) {
        script = { mood: previous.dialogue.mood || 'تأملي', storyIntro: Boolean(previous.dialogue.storyIntro),
          utterances: previous.dialogue.utterances.map((utterance, index) => ({ speaker: utterance.speaker,
            text: utterance.dialogueText, delivery: utterance.delivery || 'normal', pauseAfterMs: utterance.pauseAfterMs || 420,
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
      runInsert.run(runId, article.slug, sourceHash, PIPELINE_HASH, 'planned', '', startedAt, auditRecord.finishedAt)
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
      transcript.push({ speaker: voiceInfo.name, speakerKey: utterance.speaker, text: result.dialogueText || utterance.text })
      pronunciation.push({ id: utteranceId, speaker: utterance.speaker, voice: voiceInfo.azure,
        pronunciationText: result.pronunciationText || utterance.text, intendedText: result.intendedText || result.pronunciationText || utterance.text, risks,
        selectedCandidateId: result.selectedCandidate, candidates: result.candidates, stt: result.heard })
      const base = Math.min(1200, Math.max(160, utterance.pauseAfterMs ?? 380))
      const jitter = base * (0.8 + ((index * 2654435761) % 100) / 250)
      segments.push({ file: wav, pauseAfterMs: Math.round(jitter), overlapMs: !hasHighRisk && utterance.allowOverlap
        ? Math.min(280, Math.max(80, utterance.overlapMs || 150)) : 0, hasHighRisk })
      process.stdout.write(`  🎙 ${index + 1}/${utts.length} (TTS→STT→Judge)\r`)
    }
    console.log('')
    auditRecord.dialogue.utterances = transcript.map((item, index) => ({ id: `u${String(index + 1).padStart(3, '0')}`,
      speaker: item.speakerKey, dialogueText: item.text }))
    auditRecord.pronunciation.utterances = pronunciation

    const finalLanguageIssues = lintScript({ utterances: transcript.map((item) => ({ speaker: item.speakerKey, text: item.text })) }, lang)
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

    /* ٤) الأولوية للنطق: لا موسيقى حين توجد كلمة عالية الخطورة، ولا تداخل فوقها */
    let music = null
    const hasAnyHighRisk = segments.some((segment) => segment.hasHighRisk)
    if (!hasAnyHighRisk && existsSync(MUSIC_LIB)) {
      const library = JSON.parse(readFileSync(MUSIC_LIB, 'utf8'))
      const track = (library.tracks || []).find((item) => item.licensed && (item.moods || []).includes(script.mood))
      if (track && existsSync(resolve(ROOT, track.path)))
        music = { file: resolve(ROOT, track.path), bedVol: track.bedVolume ?? 0.035, introSec: 5, outroSec: 4 }
    }
    if (!music) console.log('  ♪ إخراج بلا موسيقى — أولوية مطلقة لوضوح الكلمات الخطرة')

    /* ٥) تركيب مؤقت ثم فحص الحلقة كاملة؛ الملف الحالي لا يُمس */
    const candidateMp3 = resolve(TMP, `${article.slug}.accepted-candidate.mp3`)
    const assembled = assemble(segments, candidateMp3, music)
    const technicalAudit = auditAudio(candidateMp3, Math.min(150, utts.length * 6))
    if (technicalAudit.issues.length) return quarantine(`الفحص التقني: ${technicalAudit.issues.join(' · ')}`)
    const fullStt = await transcribeAssembledEpisode(candidateMp3, assembled.timeline)
    const intendedFull = pronunciation.map((item) => item.intendedText.replace(/\|/g, ' ')).join(' ')
    const fullComparison = compareTexts(intendedFull, fullStt.text)
    const missingNegations = fullComparison.missing.filter((word) => ['لا', 'لم', 'لن', 'ليس', 'ليست', 'ما', 'غير', 'دون'].includes(word))
    if (missingNegations.length || fullComparison.importantRatio < 0.78 || fullComparison.ratio < 0.70)
      return quarantine(`STT الحلقة الكاملة لم يطابق النص المقصود (المهم ${Math.round(fullComparison.importantRatio * 100)}٪)`, { fullStt, fullComparison })
    const finalJudge = await judgeFullEpisode(candidateMp3, intendedFull, fullStt, transcript, allRisks)
    if (!finalJudge.pass) return quarantine(`Arabic Audio Judge للحلقة: ${(finalJudge.problems || []).map((problem) => problem.issue).join(' · ')}`, { fullStt, finalJudge })

    /* ٦) نشر ذري بعد النجاح وحده + تثبيت الذاكرة الناجحة */
    const publicTranscript = { title: article.title, generatedAt: new Date().toISOString().slice(0, 10),
      language: 'ar', utterances: transcript.map(({ speaker, text }) => ({ speaker, text })) }
    const tempTranscript = resolve(TMP, `${article.slug}.dialogue.json`)
    if (lang === 'ar') writeFileSync(tempTranscript, JSON.stringify(publicTranscript, null, 2))
    renameSync(candidateMp3, outMp3)
    if (lang === 'ar') renameSync(tempTranscript, transcriptPath)
    const riskMap = new Map(allRisks.map((risk) => [normalizeAr(risk.word), risk]))
    commitPendingMemory(riskMap)
    const audioHash = createHash('sha256').update(readFileSync(outMp3)).digest('hex')
    const transcriptHash = lang === 'ar' ? createHash('sha256').update(readFileSync(transcriptPath)).digest('hex') : ''
    state.done[key] = { contentHash, pipelineHash: PIPELINE_HASH, sourceHash, audioHash, transcriptHash,
      status: 'accepted_automated', acceptedAt: new Date().toISOString() }
    state.totalCount++
    if (isStory) state.storyCount++
    saveState()
    auditRecord.status = 'accepted_automated'
    auditRecord.finishedAt = new Date().toISOString()
    auditRecord.finalGate = { pass: true, reasonCodes: [], technicalAudit, fullStt,
      fullComparison: { ratio: fullComparison.ratio, importantRatio: fullComparison.importantRatio,
        missing: fullComparison.missing, missingImportant: fullComparison.missingImportant }, finalJudge }
    writeAudit(article, lang, auditRecord)
    runInsert.run(runId, article.slug, sourceHash, PIPELINE_HASH, 'accepted_automated', '', startedAt, auditRecord.finishedAt)
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
  assert(existsSync(FFMPEG) && existsSync(FFPROBE), 'ffmpeg/ffprobe يجب أن يكونا قابلين للتنفيذ خارج PATH')
  console.log('✓ اختبارات بوابة البودكاست العربي: 9/9')
  process.exit(0)
}

const ssmlProfiles = await probeSsmlCapabilities(PREFLIGHT && FORCE)
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
    const expected = createHash('sha256').update(`${sourceHash}|ar|${PIPELINE_HASH}`).digest('hex').slice(0, 16)
    const saved = state.done[`${article.slug}:ar`]
    return saved?.contentHash !== expected || saved?.status !== 'accepted_automated'
      || !existsSync(resolve(AUDIO, `${article.slug}.dialogue.mp3`))
      || !existsSync(resolve(AUDIO, `${article.slug}.dialogue.json`))
  }).slice(0, limit)
}
else { console.log('حدد --slug= أو --latest=N أو --nightly'); process.exit(1) }
if (!queue.length) { console.log(targetSlug ? `لا يوجد مقال مطابق: ${targetSlug}` : 'لا حلقات ناقصة ضمن حد الليلة'); process.exit(targetSlug ? 1 : 0) }

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
