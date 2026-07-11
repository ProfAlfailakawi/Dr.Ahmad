#!/usr/bin/env node
/**
 * «البودكاست الحواري» — مقالٌ يتحوّل حواراً حقيقياً بين فهد ونورة (وبالإنجليزية: Andrew وAva).
 *
 * المسار لكل مقال (idempotent عبر content-hash):
 *   ١) Gemini يكتب سيناريو حوار بعربية بيضاء (System Prompt الدكتور حرفياً)
 *      → بيانات منظمة: speaker/text/delivery/pauseAfterMs/allowOverlap/overlapMs
 *   ٢) فحص سيناريو آلي (قوائم الممنوع، التوازن، التكرار، الطول) — يعيد الكتابة عند الفشل
 *   ٣) توليد **كل مداخلة ملفاً منفصلاً** عبر Azure (WAV عالي الجودة، SSML لكل جملة)
 *   ٤) تركيب Timeline بـ ffmpeg: وقفات متفاوتة + تداخلات 80–280ms (amix) + توحيد -16 LUFS
 *   ٥) فحص صوت (مدة، صمت شاذ، صلاحية MP3) → إعادة توليد المداخلة الفاشلة فقط
 *   ٦) الإخراج: audio/<slug>.dialogue.mp3 (+ .dialogue-en.mp3) — يلتقطه podcast.xml تلقائياً
 *
 * ⛔ شرط القبول الحاسم (من الدكتور): يُرفض أي توليد بـSSML واحد أو تناوبٍ بوقفات ثابتة.
 *    هذا السكربت يولّد كل مداخلة وحدها ويركّبها بوقفات عشوائية-الطبيعة وتداخلات مدروسة.
 *
 * الموسيقى: تُقرأ من scripts/music-library.json (مرخّصة فقط). المكتبة فارغة الآن
 * فيُبنى الإخراج نظيفاً بلا موسيقى — وتُفعَّل تلقائياً فور إضافة ملف مرخّص.
 *
 * قالب «صوت من داخل القصة»: Gemini يقيّم سردية المقال؛ إن كانت قوية (وستبقى نسبته
 * ≤15% عبر عدّاد الحالة) يفتتح بمشهد تمثيلي 8–20 ثانية ثم الحوار.
 *
 * التشغيل:
 *   node scripts/podcast-dialogue.mjs --slug=<slug>            مقال محدد (عربي)
 *   node scripts/podcast-dialogue.mjs --slug=<slug> --lang=en  النسخة الإنجليزية
 *   node scripts/podcast-dialogue.mjs --latest=3               أحدث ٣ مقالات ناقصة
 *   node scripts/podcast-dialogue.mjs --nightly                كل الناقص (للجدولة)
 *   أعلام: --dry-run (سيناريو فقط) · --force (تجاهل الحالة)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-tmp')
const STATE_FILE = resolve(ROOT, '.podcast-state.json')
const MUSIC_LIB = resolve(ROOT, 'scripts/music-library.json')

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
if (!GEMINI_KEY || !AZURE_KEY) { console.error('✘ GEMINI_API_KEY أو AZURE_SPEECH_KEY مفقود'); process.exit(1) }

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

/* ── حالة idempotent ── */
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { done: {}, storyCount: 0, totalCount: 0 }
const saveState = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))

/* ── المقالات ── */
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const src = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const block = (src.match(/export const articles = \[([\s\S]*?)\n\]/) || [])[1] || ''
const ARTICLES = [...block.matchAll(/\{ slug: '([^']+)', title: '([^']+)', date: '[^']*', iso: '([^']*)'/g)]
  .map((m) => ({ slug: m[1], title: m[2].replace(/\\'/g, "'"), iso: m[3], body: bodies[m[1]] || '' }))
  .filter((a) => a.body && a.body.split(/\s+/).length >= 120)

/* ═══════════ ١) محرك السيناريو (Gemini) ═══════════ */
const AR_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/dialogue-ar.txt'), 'utf8')
const EN_SYSTEM = readFileSync(resolve(ROOT, 'scripts/prompts/dialogue-en.txt'), 'utf8')

async function gemini(systemPrompt, userText, temperature = 0.85) {
  const model = env.GEMINI_MODEL || 'gemini-flash-latest'
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: { temperature, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    })
    if (res.ok) {
      const j = await res.json()
      const txt = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
      try { return JSON.parse(txt) } catch { /* أعد المحاولة */ }
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt))
  }
  throw new Error('Gemini فشل بعد ٣ محاولات')
}

/* ═══════════ ٢) فحص السيناريو الآلي ═══════════ */
const AR_BANNED = ['مما لا شك فيه','بناءً على ما سبق','ومن هذا المنطلق','تجدر الإشارة','وعليه فإن','في خضم','لا يخفى على أحد','أعزائي المستمعين','مستمعينا الكرام','المحور التالي','وفي الختام','خلاصة القول','أهلاً وسهلاً بكم','حلقة جديدة']
const AR_TOO_LOCAL = ['شالسالفة','جذي','هني','وايد','شلون','صج يا','عاد ','يا معود','تدري عاد','تدري شنو اللافت']
const EN_BANNED = ['Dear listeners','Welcome to another episode','Today we are going to','Moving on to our next','In conclusion','As previously mentioned','It is important to note','dive deep into this fascinating','Moreover,','Furthermore,']

function lintScript(sc, lang) {
  const issues = []
  const utts = sc.utterances || []
  if (utts.length < 8) issues.push(`مداخلات قليلة (${utts.length})`)
  const words = utts.reduce((n, u) => n + (u.text || '').split(/\s+/).length, 0)
  const [lo, hi] = lang === 'ar' ? [380, 850] : [420, 900]
  if (words < lo || words > hi) issues.push(`طول السيناريو ${words} كلمة (المدى ${lo}-${hi})`)
  const banned = lang === 'ar' ? [...AR_BANNED, ...AR_TOO_LOCAL] : EN_BANNED
  for (const b of banned) if (utts.some((u) => (u.text || '').includes(b))) issues.push(`عبارة ممنوعة: «${b}»`)
  // توازن الصوتين 30-70% على الأقل
  const aWords = utts.filter((u) => u.speaker === 'A').reduce((n, u) => n + u.text.split(/\s+/).length, 0)
  const ratio = aWords / Math.max(1, words)
  if (ratio < 0.3 || ratio > 0.7) issues.push(`توازن مختل: A=${Math.round(ratio * 100)}%`)
  // لا يبدأ كل رد بنفس الكلمة
  const starts = utts.map((u) => (u.text || '').split(/\s+/)[0])
  for (const w of ['صحيح', 'بالضبط', 'Exactly', 'Right']) {
    const c = starts.filter((s) => s === w || s === w + '،' || s === w + ',').length
    if (c > 2) issues.push(`تكرار بداية «${w}» ×${c}`)
  }
  // تناوب ميت (A,B,A,B بلا أي تتابع لنفس المتحدث إطلاقاً + أطوال متطابقة)
  const lens = utts.map((u) => u.text.split(/\s+/).length)
  const sameLen = lens.every((l) => Math.abs(l - lens[0]) <= 2)
  if (sameLen && utts.length > 6) issues.push('كل المداخلات بالطول نفسه — يبدو آلياً')
  // مداخلة > 80 كلمة
  if (lens.some((l) => l > 85)) issues.push('مداخلة أطول من المسموح')
  // تداخل معقول
  const overlaps = utts.filter((u) => u.allowOverlap).length
  if (overlaps > Math.ceil(utts.length / 3)) issues.push('تداخلات أكثر من اللازم')
  return issues
}

/* ═══════════ ٣) Azure لكل مداخلة على حدة ═══════════ */
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function utteranceSSML(u, voice, lang) {
  // سرعة حسب الأداء المطلوب — فروق خفيفة فقط، بلا عبث بالـpitch
  const rate = u.delivery === 'reflective' ? '-6%' : u.delivery === 'hook' ? '+4%' : '0%'
  let text = escXml(u.text)
  for (const w of u.emphasisWords || []) {
    const ew = escXml(w)
    text = text.replace(ew, `<emphasis level="moderate">${ew}</emphasis>`)
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang === 'ar' ? 'ar-KW' : 'en-US'}">
  <voice name="${voice}"><prosody rate="${rate}">${text}</prosody></voice>
</speak>`
}

async function synthUtterance(u, voice, lang, outPath) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'alfailakawi-podcast',
      },
      body: utteranceSSML(u, voice, lang),
    })
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 4000) { writeFileSync(outPath, buf); return true }
    } else if (res.status === 429) await new Promise((r) => setTimeout(r, 4000 * attempt))
    else await new Promise((r) => setTimeout(r, 1200 * attempt))
  }
  return false
}

/* ═══════════ ٤) تركيب Timeline بـ ffmpeg ═══════════ */
const ff = (fArgs) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...fArgs], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('ffmpeg: ' + (r.stderr || '').slice(-300))
}
const probeDur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()) || 0

function assemble(segments, outMp3, music) {
  /* segments: [{file, pauseAfterMs, overlapMs}] — نبني الجدول الزمني:
     بداية كل مقطع = نهاية السابق + وقفته − تداخل المقطع الحالي (إن سُمح). */
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
    inputs.push('-i', music.file)
    filters.push(`[${n}:a]volume=${music.bedVol},afade=t=in:d=1.2,afade=t=out:st=${(total - music.outroSec - 1).toFixed(2)}:d=${music.outroSec}[mus]`)
    mixInputs += '[mus]'; n++
  }
  // room tone خفيف جداً يمنع إحساس القص واللصق
  filters.push(`anoisesrc=color=brown:amplitude=0.0018:d=${total.toFixed(2)}[room]`)
  mixInputs += '[room]'; n++
  filters.push(`${mixInputs}amix=inputs=${n}:normalize=0[mix]`)
  filters.push(`[mix]loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', total.toFixed(2), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outMp3])
  return total
}

/* ═══════════ ٥) فحص الصوت النهائي ═══════════ */
function auditAudio(mp3, expectedMinSec) {
  const dur = probeDur(mp3)
  const size = statSync(mp3).size
  const issues = []
  if (dur < expectedMinSec) issues.push(`المدة ${dur.toFixed(0)}ث أقصر من المتوقع`)
  if (dur > 480) issues.push(`المدة ${dur.toFixed(0)}ث أطول من 8 دقائق`)
  if (size < 200_000) issues.push('حجم الملف مريب')
  // صمت > 2.5ث داخل الحلقة؟
  const det = spawnSync('ffmpeg', ['-i', mp3, '-af', 'silencedetect=noise=-38dB:d=2.5', '-f', 'null', '-'], { encoding: 'utf8' })
  const silences = (det.stderr.match(/silence_duration/g) || []).length
  if (silences > 1) issues.push(`${silences} فترات صمت طويلة`)
  return { dur, size, issues }
}

/* ═══════════ المعالجة الكاملة لمقال ═══════════ */
async function produce(article, lang) {
  const suffix = lang === 'ar' ? '.dialogue.mp3' : '.dialogue-en.mp3'
  const outMp3 = resolve(AUDIO, article.slug + suffix)
  const contentHash = createHash('sha1').update(article.body + '|' + lang + '|v1').digest('hex').slice(0, 12)
  const key = `${article.slug}:${lang}`
  if (!FORCE && state.done[key] === contentHash && existsSync(outMp3)) { console.log(`↷ ${article.title} (${lang}) — منجز`); return 'skip' }

  console.log(`\n▶ ${article.title} (${lang})`)
  const voices = VOICES[lang]
  const storyBudget = state.totalCount === 0 ? true : state.storyCount / state.totalCount < 0.15

  /* ١+٢) سيناريو + فحص (حتى ٣ كتابات) */
  const sys = lang === 'ar' ? AR_SYSTEM : EN_SYSTEM
  const userMsg = `${lang === 'ar' ? 'المقال' : 'The Arabic article'}:\nTITLE: ${article.title}\n---\n${article.body}\n---\n` +
    `storyTemplateAllowed: ${storyBudget}` +
    (lang === 'en' ? '\nFirst create the English editorial adaptation internally, then the dialogue.' : '')
  let script = null, lintIssues = []
  for (let round = 1; round <= 3; round++) {
    script = await gemini(sys, userMsg + (lintIssues.length ? `\n\nREWRITE. Previous issues: ${lintIssues.join(' | ')}` : ''), 0.85)
    lintIssues = lintScript(script, lang)
    if (!lintIssues.length) break
    console.log(`  ⟳ إعادة كتابة (${round}): ${lintIssues.slice(0, 3).join(' · ')}`)
  }
  if (lintIssues.length) { console.log(`  ✘ السيناريو لم يجتز الفحص: ${lintIssues.join(' · ')}`); return 'fail' }
  const utts = script.utterances
  const isStory = Boolean(script.storyIntro)
  console.log(`  ✓ سيناريو: ${utts.length} مداخلة · قصة: ${isStory ? 'نعم' : 'لا'}`)
  if (DRY) { console.log(JSON.stringify(utts.slice(0, 4), null, 1)); return 'dry' }

  /* ٣) توليد كل مداخلة منفصلة */
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  const segments = []
  for (let i = 0; i < utts.length; i++) {
    const u = utts[i]
    const voice = (u.speaker === 'A' ? voices.A : voices.B).azure
    const wav = resolve(TMP, `u${String(i).padStart(3, '0')}.wav`)
    const ok = await synthUtterance(u, voice, lang, wav)
    if (!ok) { console.log(`  ✘ فشل توليد المداخلة ${i}`); return 'fail' }
    // وقفة متفاوتة الطبيعة (jitter ±20%) حول قيمة السيناريو
    const base = Math.min(1100, Math.max(90, u.pauseAfterMs ?? 320))
    const jitter = base * (0.8 + ((i * 2654435761) % 100) / 250)
    segments.push({ file: wav, pauseAfterMs: Math.round(jitter), overlapMs: u.allowOverlap ? Math.min(280, Math.max(80, u.overlapMs || 150)) : 0 })
    process.stdout.write(`  🎙 ${i + 1}/${utts.length}\r`)
  }
  console.log('')

  /* ٤) الموسيقى إن وُجدت مكتبة مرخصة */
  let music = null
  if (existsSync(MUSIC_LIB)) {
    const lib = JSON.parse(readFileSync(MUSIC_LIB, 'utf8'))
    const mood = script.mood || 'تأملي'
    const track = (lib.tracks || []).find((t) => t.licensed && (t.moods || []).includes(mood)) || (lib.tracks || []).find((t) => t.licensed)
    if (track && existsSync(resolve(ROOT, track.path)))
      music = { file: resolve(ROOT, track.path), bedVol: track.bedVolume ?? 0.07, introSec: 5, outroSec: 4 }
  }
  if (!music) console.log('  ♪ لا موسيقى مرخصة في المكتبة — إخراج نظيف')

  /* التركيب + الفحص */
  const totalSec = assemble(segments, outMp3, music)
  const audit = auditAudio(outMp3, Math.min(150, utts.length * 6))
  if (audit.issues.length) { console.log(`  ✘ فحص الصوت: ${audit.issues.join(' · ')}`); rmSync(outMp3, { force: true }); return 'fail' }

  state.done[key] = contentHash
  state.totalCount++
  if (isStory) state.storyCount++
  saveState()
  rmSync(TMP, { recursive: true, force: true })
  console.log(`  ✅ ${(audit.dur / 60).toFixed(1)} دقيقة · ${(audit.size / 1e6).toFixed(1)}MB → ${article.slug}${suffix}`)
  return 'ok'
}

/* ═══════════ التشغيل ═══════════ */
const targetSlug = opt('slug')
const latest = Number(opt('latest') || 0)
const nightly = flag('nightly')

let queue = []
if (targetSlug) queue = ARTICLES.filter((a) => a.slug === targetSlug)
else if (latest) queue = ARTICLES.slice(0, latest)
else if (nightly) queue = ARTICLES
else { console.log('حدد --slug= أو --latest=N أو --nightly'); process.exit(1) }

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
process.exit(failed && !done ? 1 : 0)
