#!/usr/bin/env node
/**
 * تجربة أصوات — مقارنة لهجة (أزواج بصوتين).
 *
 * حكم «إماراتي مليون بالمية» (أذن كويتية أصلية) جذرُه صوتُ المحرّك لا النص.
 * فنجرّب عدّة أزواج أصوات Gemini على **نفس المقطع** المليء بالكلمات التي
 * سُمعت إماراتيةً (يعرف · ورقة · عقله · يفهمها · منو · سبق)، ونجمعها في ملفٍ
 * واحد يسمعه الدكتور وزوجته: أيّ زوجٍ كويتيّ وأيّها إماراتي.
 *
 * كلّ مقطع حوارٌ قصير بصوتين (نفس عقد الإنتاج المُثبَت: متحدّثان Fahad/Noura)
 * يبدأ برقمه. مجموعها ملفٌّ واحد. التشغيل عبر الورشة حيث GEMINI_API_KEY سرٌّ.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  buildPronunciationMap, toSpokenKuwaiti,
  buildForeignRedactions, redactForeignNames,
} from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = resolve(ROOT, '.voice-test-tmp')
const OUT = resolve(ROOT, 'audio', 'voice-test.mp3')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* الجولة الثالثة (١٤ أغسطس ٢٠٢٦): حكم الدكتور بأذنه أن گ لم تعالج شيئاً —
   «ورگة/سبگ» في الجولة الثانية ظلّت تنحرف إماراتيةً وإيرانيةً وعراقية. فماتت
   فكرة الحروف (بقيت چ وحدها المثبتة سماعاً)، وانتقلت المعركة إلى البرومت:
   حظرٌ مسمّى بسبعة سجلات + قفلٌ يركب كل سطر + فحصٌ ختامي بعد النص + تمهيدٌ
   كويتيٌّ بكلماتٍ مثبتة (شلون/ترى/وايد/چذي) يسبق كلمات الفخ فيقفل اللهجة
   قبل وصولها. النص هنا بإملاء الإنتاج حرفياً (ورقه/الورقه كما يخرجها
   المعجم) — ما يُختبر هو ما سيُبثّ فعلاً. */
const PAIRS = [
  ['أربعة', 'Orus', 'Callirrhoe'],
  ['خمسة', 'Puck', 'Despina'],
]

/* التمهيد — يقفل السجل الكويتي قبل أول كلمة فخ. */
const OPEN_FAHAD = 'هلا والله، شلونكم؟ اليوم بنسولف شوي عن الدرجات والعيال.'
const OPEN_NOURA = 'إي حياك، ترى الموضوع وايد يستاهل — خل نبدأ چذي على طول.'

/* الفخاخ الست التي سُمعت غير كويتية، بإملاء الإنتاج نفسه (بلا گ). */
const TRAP_FAHAD = 'شوف، الطالب بالنهاية ايعرف إن الدرجة مجرد ورقه، وعقله يفهمها بس ما يفرح.'
const TRAP_NOURA = 'إي، بس منو قال إن اللي سبق لازم يفرح؟ الورقه تعرفها، بس الفكرة ما تعرفها.'

const PROMPT_HEAD = `ABSOLUTE RULE — APPLY TO EVERY SINGLE WORD
This is Kuwait City (حضري) Kuwaiti Arabic and nothing else. Seven registers are FORBIDDEN outright; each is an automatic hard failure:
1. Emirati (Dubai/Abu Dhabi) — thinned, lighter, forward articulation. FORBIDDEN.
2. Iraqi — backed vowels, Mesopotamian drawl and cadence. FORBIDDEN.
3. Iranian/Persian — stretched long vowels, soft rolling consonants. FORBIDDEN.
4. Saudi — Najdi or Hejazi rhythm, harder qaf, desert cadence. FORBIDDEN.
5. Levantine — imala and softened articulation. FORBIDDEN.
6. Egyptian — its stress pattern and vowel colour. FORBIDDEN.
7. Generic pan-Gulf blend belonging to no city. FORBIDDEN.
No "close enough": one drifted word ruins the take — re-read it as a Kuwait City Kuwaiti. Two natural Kuwaitis talking, not actors imitating an accent. The six trap words a Kuwaiti listener catches instantly: «ايعرف» «ورقه» «عقله» «يفهمها» «منو» «سبق» — give each the full Kuwait City weight of the sentence around it.`

const PROMPT_TAIL = `FINAL CHECK — LAST INSTRUCTION BEFORE SPEAKING
Re-scan every word above. Any word that would come out Emirati, Iraqi, Persian, Saudi, Levantine, Egyptian, or generic-Gulf must be corrected to Kuwait City Kuwaiti before the take. Every word, every line, both speakers: Kuwait City Kuwaiti only.`

const KW_LOCK = '[Kuwaiti Kuwait-City accent only]'

function wavHeader(pcmBytes, sampleRate = 24000, channels = 1, bits = 16) {
  const h = Buffer.alloc(44); const blockAlign = channels * bits / 8
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcmBytes, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20)
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * blockAlign, 28)
  h.writeUInt16LE(blockAlign, 32); h.writeUInt16LE(bits, 34); h.write('data', 36); h.writeUInt32LE(pcmBytes, 40)
  return h
}

function pcmFromBody(body) {
  const direct = body?.output_audio?.data || body?.interaction?.output_audio?.data || body?.response?.output_audio?.data
  if (typeof direct === 'string' && direct.length > 100) return direct
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.data === 'string' && node.data.length > 100 && /audio/i.test(node.mime_type || node.mimeType || '')) out.push(node.data)
    for (const v of Object.values(node)) walk(v)
  }
  walk(body)
  return out.length ? out[out.length - 1] : null
}

async function gen(maleVoice, femaleVoice, transcript) {
  const input = `${PROMPT_HEAD}\n\n${transcript}\n\n${PROMPT_TAIL}`
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90_000)
      const res = await fetch(API, {
        method: 'POST', signal: controller.signal,
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, input, response_format: { type: 'audio' },
          generation_config: { speech_config: [
            { speaker: 'Fahad', voice: maleVoice },
            { speaker: 'Noura', voice: femaleVoice },
          ] },
        }),
      }).finally(() => clearTimeout(timer))
      const raw = await res.text()
      let body = null; try { body = JSON.parse(raw) } catch { /* غلاف غير JSON */ }
      let data = pcmFromBody(body)
      if (res.ok && !data && body?.id && body?.status === 'completed') {
        const f = await fetch(`${API}/${encodeURIComponent(body.id)}`, { headers: { 'x-goog-api-key': KEY } }).catch(() => null)
        if (f?.ok) data = pcmFromBody(await f.json().catch(() => null))
      }
      if (res.ok && data) {
        const pcm = Buffer.from(data, 'base64')
        if (pcm.length < 4000) throw new Error('صوت قصير/فارغ')
        return pcm
      }
      const msg = body?.error?.message || `HTTP ${res.status}`
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * attempt); continue }
      throw new Error(msg)
    } catch (e) { if (attempt === 6) throw e; await sleep(1200 * attempt) }
  }
  throw new Error('فشل التوليد')
}

async function main() {
  if (!KEY) throw new Error('GEMINI_API_KEY مفقود')
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(dirname(OUT), { recursive: true })
  const PARTS = resolve(dirname(OUT), 'voice-test')
  rmSync(PARTS, { recursive: true, force: true }); mkdirSync(PARTS, { recursive: true })

  const files = []
  const legend = []
  for (const [label, male, female] of PAIRS) {
    console.log(`🎙️ المقطع «${label}» = ${male} + ${female}`)
    const transcript = [
      `Fahad: ${KW_LOCK} المقطع رقم ${label}. ${OPEN_FAHAD}`,
      `Noura: ${KW_LOCK} ${OPEN_NOURA}`,
      `Fahad: ${KW_LOCK} ${TRAP_FAHAD}`,
      `Noura: ${KW_LOCK} ${TRAP_NOURA}`,
    ].join('\n')
    const pcm = await gen(male, female, transcript)
    const wav = resolve(TMP, `seg-${label}.wav`); writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm]))
    files.push(wav)

    /* ملفٌّ مفردٌ باسمٍ ناطق — يكفي وحده للتمييز على الجوال. */
    const solo = resolve(PARTS, `${label}.mp3`)
    const s1 = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
      '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', solo], { encoding: 'utf8' })
    if (s1.status !== 0) throw new Error(s1.stderr || 'فشل ترميز المقطع المفرد')
    legend.push({ pair: label, male, female, file: `audio/voice-test/${label}.mp3` })
  }

  const inputs = []; const filters = []
  files.forEach((f, i) => { inputs.push('-i', f); filters.push(`[${i}:a]apad=pad_dur=0.7[a${i}]`) })
  const concat = files.map((_, i) => `[a${i}]`).join('')
  filters.push(`${concat}concat=n=${files.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`)
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', OUT], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || 'فشل الدمج')

  console.log(`\n✓ جاهز: audio/voice-test.mp3 (المقطعان متتاليان)`)
  console.log('  وملفان مفردان في audio/voice-test/')
  legend.forEach((l) => console.log(`  ${l.pair} = ${l.male} + ${l.female}`))
  writeFileSync(resolve(dirname(OUT), 'voice-test-legend.json'), JSON.stringify({ round: 3, pairs: PAIRS, files: legend }, null, 2))
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
