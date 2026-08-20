#!/usr/bin/env node
/**
 * مختبر الكلمات — يولّد عيّناتٍ مرقّمة لكل كلمةٍ اختلفت أذنُ الدكتور عليها.
 *
 * العلّة الجذرية: أنا لا أسمع. فكل بديلٍ اقترحتُه من وصفٍ لفظيّ كان تخميناً،
 * وثلاث جولاتٍ منه سقطت (٣٣ مدخلاً ثم ٢١ ثم ٨). العلاج أن يسمع هو البدائل
 * ويختار رقماً — لا أن أصف أنا وأخمّن هو.
 *
 * لكل كلمةٍ مقطعٌ واحد: الجملة الحاملة من متن الحوارات نفسها (لا جملة مصنوعة)،
 * تُقرأ ثلاث مرات، كلٌّ ببديل، مسبوقةً برقمها. مخرجه ملفٌّ لكل كلمة وملفٌّ جامع.
 *
 * التشغيل في الورشة وحدها حيث GEMINI_API_KEY سرّ.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = resolve(ROOT, '.word-audition-tmp')
const OUTDIR = resolve(ROOT, 'audio', 'word-audition')
const OUT = resolve(ROOT, 'audio', 'word-audition.mp3')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* الأصوات المعتمدة حالياً (فجوة الحنجرتين ٢٠ هرتزاً — ٢٠ أغسطس). */
const MALE = process.env.PODCAST_KW_MALE_VOICE || 'Puck'
const FEMALE = process.env.PODCAST_KW_FEMALE_VOICE || 'Callirrhoe'

const KW = '[Kuwaiti Kuwait-City accent only]'
const NUM = ['واحد', 'اثنين', 'ثلاثة', 'أربعة']

/* كل كلمةٍ شكا منها الدكتور (٢٠ أغسطس ٢٠٢٦) مع جملتها الحاملة من المتن.
   البدائل ثلاثة أنواع لا رابع:
     • الحالة الراهنة (ليقارن)
     • هجاءٌ صوتي (الگ) — جُرّب مع Azure فسقط، ولم يُجرَّب مع Gemini
     • استبدالٌ بكلمةٍ كويتيةٍ حقيقية بلا قاف — الطريق الذي نجح في «معلقة→مربوطة»
   لا كلمة مخترعة هنا. */
const WORDS = [
  /* الجولة الرابعة (٢٠ أغسطس ٢٠٢٦ مساءً) — كلمتان من حكمه على «كويتي-٥»:
     «نجاحات ما تفرح … التشكيل خطأ قالها» و«يمكن هو اللي يقلب … إماراتي».
     كلتاهما ليست في المعجم، فالمحرّك ينطقهما من عنده.

     و«تفرح» فخُّ معنيين في مداخلةٍ واحدة (٤): «إنك تَفْرَح» فعلٌ لازم،
     و«ما تُفَرِّح صاحبها» فعلٌ متعدٍّ بالتضعيف. بديلٌ عامٌّ يكسر الأولى —
     نفس فخّ «ما يعود» الذي وقعتُ فيه اليوم. فالمقطعان ٣ و٤ يختبران
     السياقين منفصلين حتى لا أعمّم ما يصلح لأحدهما على الآخر. */
  { key: 'ما تفرح صاحبها', speaker: 'Fahad',
    carrier: 'في نجاحات {W} لأن ما وراها معنى؛ وراها نجاة.',
    options: ['ما تفرح صاحبها', 'ما تُفَرِّح صاحبها', 'ما تفرّح صاحبها'] },
  { key: 'إنك تفرح — اللازم', speaker: 'Noura',
    carrier: 'بس هني الفرق بين {W}… وإنك بس توقف خوفك شوي.',
    options: ['إنك تفرح', 'إنك تَفْرَح', 'إنك تنبسط'] },
  { key: 'يقلب — خرجت إماراتية', speaker: 'Fahad',
    carrier: 'وعندي سؤال أخير، ترى يمكن هو اللي {W} الفكرة كلها.',
    options: ['يقلب', 'يگلب', 'يِقْلِب'] },
  { key: 'يقلب — بديلٌ بلا قاف', speaker: 'Noura',
    carrier: 'وعندي سؤال أخير، ترى يمكن هو اللي {W} الفكرة كلها.',
    options: ['يعكس', 'يغيّر', 'يقلب'] },
]

const PROMPT_HEAD = `ABSOLUTE RULE — APPLY TO EVERY SINGLE WORD
This is Kuwait City (حضري) Kuwaiti Arabic and nothing else. These registers are FORBIDDEN outright; each is an automatic hard failure: Emirati, Iraqi, Iranian/Persian, Saudi (Najdi/Hejazi), Levantine, Egyptian, and any generic pan-Gulf blend belonging to no city.
Never heavy, never emphatic: Kuwait City speech is light and soft in the mouth. Do not thicken or darken any consonant.
Read each numbered line exactly as written, letter for letter. The point of this take is to compare spellings — so a spelling you find unusual must still be read exactly as spelled, never "corrected" to a more familiar word.`

const PROMPT_TAIL = `FINAL CHECK — read every line exactly as spelled, in Kuwait City Kuwaiti, light and soft.`

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

async function gen(transcript) {
  const input = `${PROMPT_HEAD}\n\n${transcript}\n\n${PROMPT_TAIL}`
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120_000)
      const res = await fetch(API, {
        method: 'POST', signal: controller.signal,
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, input, response_format: { type: 'audio' },
          generation_config: { speech_config: [
            { speaker: 'Fahad', voice: MALE },
            { speaker: 'Noura', voice: FEMALE },
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

function encode(wav, mp3) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', mp3], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || 'فشل الترميز')
}

async function main() {
  if (!KEY) throw new Error('GEMINI_API_KEY مفقود')
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  rmSync(OUTDIR, { recursive: true, force: true }); mkdirSync(OUTDIR, { recursive: true })
  mkdirSync(dirname(OUT), { recursive: true })

  const wavs = []
  const legend = []
  for (const [i, w] of WORDS.entries()) {
    const n = i + 1
    console.log(`🎙️ (${n}/${WORDS.length}) ${w.key} — ${w.options.length} بدائل`)
    const lines = [`${w.speaker}: ${KW} كلمة رقم ${NUM[i] || n}: ${w.key}.`]
    w.options.forEach((opt, j) => {
      lines.push(`${w.speaker}: ${KW} ${NUM[j]}. ${w.carrier.replace('{W}', opt)}`)
    })
    const pcm = await gen(lines.join('\n'))
    const wav = resolve(TMP, `w-${n}.wav`)
    writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm]))
    wavs.push(wav)
    const slug = w.key.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
    const mp3 = resolve(OUTDIR, `${n}-${slug}.mp3`)
    encode(wav, mp3)
    legend.push({ n, word: w.key, speaker: w.speaker, options: w.options, file: `audio/word-audition/${n}-${slug}.mp3` })
    if (i < WORDS.length - 1) await sleep(1200)
  }

  const inputs = []; const filters = []
  wavs.forEach((f, i) => { inputs.push('-i', f); filters.push(`[${i}:a]apad=pad_dur=1.0[a${i}]`) })
  filters.push(`${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${wavs.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`)
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1',
    '-c:a', 'libmp3lame', '-b:a', '160k', OUT], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || 'فشل الدمج')

  writeFileSync(resolve(dirname(OUT), 'word-audition-legend.json'), JSON.stringify({ male: MALE, female: FEMALE, words: legend }, null, 2))
  console.log('\n✓ جاهز: audio/word-audition.mp3 — والمفردات في audio/word-audition/')
  legend.forEach((l) => console.log(`  ${l.n}. ${l.word}: ${l.options.join(' · ')}`))
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
