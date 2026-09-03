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
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-preview-tts'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* الجولة الرابعة (١٤ أغسطس ٢٠٢٦ مساءً) — بعد حكم الدكتور على الثالثة:
   «اعتمد ٥، الرجل ممتاز، لكنتها غير جيدة، والورقة ما زالت خطأ». فأمر:
   «أي شي يميل إماراتي أو عراقي أو إيراني — بدله أو احذفه وأعد الصياغة».
   وُلدت مصفاة اللهجة في المعجم: الكلمات المسموعة تُستبدل في الصوت وحده
   (ورقة→شهاده وأخواتها سياقاً سياقاً). هذي الجولة تختبر الزوج المعتمد ٥
   وحده على الواقع الجديد: لا «ورقه» بعد اليوم — «الشهاده» مكانها.
   وسطر نورة يحمل أثقل الفخاخ عمداً لأن لكنتها هي المشكوك فيها. */
const PAIRS = [
  ['خمسة', 'Puck', 'Despina'],
]

/* التمهيد — يقفل السجل الكويتي قبل أول كلمة فخ. */
/* «هلا والله» حُذفت من الافتتاح — سمعها الدكتور (الجولة الرابعة) تجر المقطع
   كله إلى اللحن السوري: أول كلمتين تقفلان السجل، ومسلسلات الشام أشبع النموذج
   بهذي العبارة. البديل تحية خليجية لا يملكها الشامي. */
const OPEN_FAHAD = 'حياكم الله، شخباركم؟ اليوم بنسولف شوي عن الدرجات والعيال.'
const OPEN_NOURA = 'إي حياك، ترى الموضوع وايد يستاهل — خل نبدأ چذي على طول.'

/* الفخاخ بإملاء الإنتاج بعد المصفاة — وأثقلها في فم نورة عمداً. */
const TRAP_FAHAD = 'شوف، الطالب بالنهاية ايعرف إن الدرجة شهاده وبس، ومخه فاهمها بس ما يفرح فيها.'
const TRAP_NOURA = 'إي، بس منو قال إن الشهاده تكفي؟ الشهاده بيدها اليوم، والفكرة بعدها بعيده عنها.'

const PROMPT_HEAD = `Synthesize the labelled dialogue only.
Fahad and Noura are two real, native, educated contemporary urban Kuwait City speakers in a relaxed diwaniya. They are clearly different people but share one effortless city accent. Build it through compact vowels, conversational timing, sentence melody, and responsive turn-taking — never through consonant exaggeration.
Qaf is lexical and understated, never one mechanical [q]/[g] rule. Ordinary lines stay ordinary; pauses follow thought and breath rather than punctuation; no final word becomes a slogan. Keep the same Kuwaiti conversational identity on research or formal vocabulary.
Read every line exactly once and in order. Do not add fillers or speak instructions.`

const PROMPT_TAIL = `Silently verify that these sound like the same two Kuwaitis talking naturally, not actors, narrators, presenters, or a synthetic voice, then speak the dialogue.`

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
      `Fahad: المقطع رقم ${label}. ${OPEN_FAHAD}`,
      `Noura: ${OPEN_NOURA}`,
      `Fahad: ${TRAP_FAHAD}`,
      `Noura: ${TRAP_NOURA}`,
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
