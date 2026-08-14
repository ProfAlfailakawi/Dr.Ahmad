#!/usr/bin/env node
/**
 * تجربة أصوات — مقارنة لهجة.
 *
 * الغرض: حكم «إماراتي مليون بالمية» (أذن كويتية أصلية) جذرُه صوتُ المحرّك نفسه،
 * لا النص. فنجرّب عدّة أصوات Gemini على **نفس المقطع** المليء بالكلمات التي
 * سُمعت إماراتيةً (يعرف · ورقة · عقله · يفهمها · منو · سبق)، ونجمعها في ملفٍ
 * واحد يسمعه الدكتور وزوجته: أيّ صوتٍ كويتيّ وأيّها إماراتي.
 *
 * كلّ صوتٍ نداءٌ مستقل يقول رقمه بصوته ثم المقطع. مجموعها ملفٌّ واحد.
 * التشغيل عبر الورشة (podcast-voice-test.yml) حيث GEMINI_API_KEY سرٌّ.
 */
import { createHash } from 'node:crypto'
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

/* الأصوات المرشّحة — نبدأ بالحالي (Sadaltager/Sulafat) كخطِّ أساسٍ ثم بدائل
   من مجموعة Gemini. الحكم بالأذن: أيّها لا يُسمع إماراتياً. */
const VOICES = [
  ['واحد', 'Sadaltager'],   // الحالي (فهد) — خط الأساس
  ['اثنين', 'Sulafat'],     // الحالي (نورة) — خط الأساس
  ['ثلاثة', 'Charon'],
  ['أربعة', 'Kore'],
  ['خمسة', 'Fenrir'],
  ['ستة', 'Orus'],
  ['سبعة', 'Puck'],
  ['ثمانية', 'Aoede'],
  ['تسعة', 'Enceladus'],
  ['عشرة', 'Algieba'],
]

/* المقطع: مكتنزٌ بالكلمات التي سُمعت إماراتية. يمرّ بنفس طبقة الصوت الإنتاجية. */
const SRC = JSON.parse(readFileSync(resolve(ROOT, 'src', 'data', 'kuwaiti-pronunciation.json'), 'utf8'))
const PRON = buildPronunciationMap(SRC)
const FOREIGN = buildForeignRedactions(SRC)
const spokenForm = (t) => toSpokenKuwaiti(redactForeignNames(t, FOREIGN), PRON)
const PASSAGE = spokenForm('الطالب بالنهاية يعرف إن الدرجة مجرد ورقة، وعقله يفهمها بس ما يفرح. منو قال إن اللي سبق لازم يفرح؟ الورقة تعرفها، بس الفكرة ما تعرفها.')

const PROMPT_HEAD = `ABSOLUTE RULE: This is Kuwait City (حضري) Arabic — never Emirati, never Iranian/Persian. Keep full Kuwaiti weight on every word; if any word thins toward Dubai/Abu Dhabi the take is wrong. A natural Kuwaiti speaker, not someone imitating the accent.`

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

async function gen(voice, text) {
  const input = `${PROMPT_HEAD}\n\nSpeaker: ${text}`
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90_000)
      const res = await fetch(API, {
        method: 'POST', signal: controller.signal,
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, input, response_format: { type: 'audio' },
          generation_config: { speech_config: [{ speaker: 'Speaker', voice }] },
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
  const files = []
  for (const [label, voice] of VOICES) {
    console.log(`🎙️ الصوت «${label}» = ${voice}`)
    const pcm = await gen(voice, `الصوت رقم ${label}. ${PASSAGE}`)
    const wav = resolve(TMP, `v-${voice}.wav`); writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm]))
    files.push(wav)
  }
  // إدراج صمت 0.6s بين المقاطع ثم دمج في mp3 واحد
  const inputs = []; const filters = []
  files.forEach((f, i) => { inputs.push('-i', f); filters.push(`[${i}:a]apad=pad_dur=0.6[a${i}]`) })
  const concat = files.map((_, i) => `[a${i}]`).join('')
  filters.push(`${concat}concat=n=${files.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`)
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', OUT], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || 'فشل الدمج')
  console.log(`\n✓ جاهز: audio/voice-test.mp3`)
  console.log('الدليل (الرقم ← الصوت):')
  VOICES.forEach(([label, voice]) => console.log(`  ${label} = ${voice}`))
  writeFileSync(resolve(dirname(OUT), 'voice-test-legend.json'), JSON.stringify({ passage: PASSAGE, voices: VOICES }, null, 2))
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
