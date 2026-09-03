#!/usr/bin/env node
/**
 * حلقة ضغط طويلة للمعجم الكويتي: ٦ كلمات بخيارات + نحو ٢٠٠ كلمة فحص.
 * الطلبات تُجزّأ داخلياً ثم تُدمج في ملف واحد؛ الرقم ثابت في الدفتر والصوت.
 */
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { buildKuwaitiLexiconScreening } from './lib/kuwaiti-lexicon-screening.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = resolve(ROOT, '.lexicon-screening-tmp')
const OUTDIR = resolve(ROOT, 'audio', 'kuwaiti-lexicon-screening')
const OUT = resolve(ROOT, 'audio', 'kuwaiti-lexicon-screening.mp3')
const LEGEND = resolve(ROOT, 'audio', 'kuwaiti-lexicon-screening.json')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-preview-tts'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const MALE = process.env.PODCAST_KW_MALE_VOICE || 'Puck'
const FEMALE = process.env.PODCAST_KW_FEMALE_VOICE || 'Zephyr'
const GROUP = Math.max(4, Math.min(10, Number(process.env.PODCAST_KW_SCREEN_GROUP || 8)))
const RPM = Math.max(1, Number(process.env.PODCAST_KW_SCREEN_RPM || 9))
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const NUM = ['واحد', 'اثنين', 'ثلاثة']
const requestTimes = []

async function paceRequest () {
  for (;;) {
    const now = Date.now()
    while (requestTimes.length && now - requestTimes[0] >= 60_000) requestTimes.shift()
    if (requestTimes.length < RPM) { requestTimes.push(now); return }
    await sleep(60_000 - (now - requestTimes[0]) + 300)
  }
}

const HEAD = `Read only the labelled TEST LINES below. This is one continuous pronunciation screening by the same two educated contemporary urban Kuwait City speakers, Fahad and Noura.
Preserve their exact Puck and Zephyr identities throughout. Keep compact vowels, light consonants, direct settled endings, and ordinary conversational timing. Never turn the list into an advertisement, documentary, chant, or dramatic performance.
Every Arabic test number and every carrier sentence is mandatory. Read in order, exactly once, without skipping, merging, correcting, paraphrasing, or adding commentary. A deliberately vocalized or unusual test form must be read exactly as written. The doctor's deliberate ض→ظ spellings are not to be normalized.`
const TAIL = 'Silently count the test lines, then read all of them in order. Speak only the labelled lines.'

function wavHeader (bytes, sampleRate = 24000, channels = 1, bits = 16) {
  const h = Buffer.alloc(44); const align = channels * bits / 8
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20)
  h.writeUInt16LE(channels, 22); h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * align, 28)
  h.writeUInt16LE(align, 32); h.writeUInt16LE(bits, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40)
  return h
}

function pcmFromBody (body) {
  const direct = body?.output_audio?.data || body?.interaction?.output_audio?.data || body?.response?.output_audio?.data
  if (typeof direct === 'string' && direct.length > 100) return direct
  const out = []
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (typeof node.data === 'string' && node.data.length > 100 && /audio/i.test(node.mime_type || node.mimeType || '')) out.push(node.data)
    for (const value of Object.values(node)) walk(value)
  }
  walk(body)
  return out.at(-1) || null
}

async function generate (lines) {
  const input = `${HEAD}\n\n# TEST LINES\n${lines}\n\n${TAIL}`
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await paceRequest()
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 180_000)
      const response = await fetch(API, {
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
      const raw = await response.text(); let body = null
      try { body = JSON.parse(raw) } catch { /* غير JSON */ }
      let data = pcmFromBody(body)
      if (response.ok && !data && body?.id && body?.status === 'completed') {
        const follow = await fetch(`${API}/${encodeURIComponent(body.id)}`, { headers: { 'x-goog-api-key': KEY } }).catch(() => null)
        if (follow?.ok) data = pcmFromBody(await follow.json().catch(() => null))
      }
      if (response.ok && data) {
        const pcm = Buffer.from(data, 'base64')
        if (pcm.length < 4000) throw new Error('صوت قصير/فارغ')
        return pcm
      }
      if (response.status === 429 || response.status >= 500) { await sleep(2000 * attempt); continue }
      throw new Error(body?.error?.message || `HTTP ${response.status}`)
    } catch (error) {
      if (attempt === 6) throw error
      await sleep(1600 * attempt)
    }
  }
  throw new Error('فشل التوليد')
}

function encode (wav, mp3) {
  const run = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', mp3], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || 'فشل ترميز جزء المعجم')
}

function selfTest () {
  const suite = buildKuwaitiLexiconScreening()
  assert.equal(suite.optionTests.length, 6, 'الست المختلف عليها في رأس الاختبار')
  assert.ok(suite.screening.length >= 400, 'تغطية طويلة للمتوقع وغير المتوقع وعائلات الخطر')
  assert.ok(suite.screening.every((item) => item.carrier.length <= 120), 'كل سياق قصير ويختبر الكلمة لا فقرةً كاملة')
  assert.deepEqual(suite.optionTests[0].options.includes('انْرَكُظ'), false, 'ألف الوصل المسحوبة لا تعود خياراً')
  assert.deepEqual(suite.optionTests[5].options.some((value) => value.includes('ايْهَر')), false, 'ألف هرب المسحوبة لا تعود')
  assert.ok(suite.screening.some((item) => item.category === 'غير متوقع من متن المقالات'), 'مقالات لم تدخل الحوار ممثلة')
  assert.ok(suite.screening.some((item) => item.category === 'تغطية معجم كويتي'), 'المعاجم ممثلة')
  assert.ok(suite.screening.some((item) => item.category === 'مصطلح مرجح لمقال قادم'), 'مصطلحات المستقبل ممثلة')
  console.log(`✓ مختبر المعجم الطويل: 8/8 · ${suite.optionTests.length} خيارات · ${suite.screening.length} فحصاً`)
}

async function main () {
  if (process.argv.includes('--self-test')) return selfTest()
  if (!KEY) throw new Error('GEMINI_API_KEY مفقود')
  const suite = buildKuwaitiLexiconScreening()
  const screening = suite.screening.map((item, index) => ({ number: suite.optionTests.length + index + 1, ...item }))
  const parts = []
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  rmSync(OUTDIR, { recursive: true, force: true }); mkdirSync(OUTDIR, { recursive: true })
  mkdirSync(dirname(OUT), { recursive: true })

  for (const [index, item] of suite.optionTests.entries()) {
    const number = index + 1
    console.log(`🎙️ خيارات ${number}/${suite.optionTests.length}: ${item.key}`)
    const lines = [`${item.speaker}: اختبار رقم ${number}. الكلمة: ${item.key}.`]
    item.options.forEach((option, optionIndex) => lines.push(`${item.speaker}: خيار ${NUM[optionIndex]}. ${item.carrier.replaceAll('{W}', option)}`))
    const pcm = await generate(lines.join('\n'))
    const wav = resolve(TMP, `option-${String(number).padStart(3, '0')}.wav`)
    const mp3 = resolve(OUTDIR, `option-${String(number).padStart(3, '0')}.mp3`)
    writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm])); encode(wav, mp3); parts.push(wav)
    await sleep(1200)
  }

  for (let start = 0; start < screening.length; start += GROUP) {
    const group = screening.slice(start, start + GROUP)
    console.log(`🎙️ فحص ${group[0].number}–${group.at(-1).number} من ${screening.at(-1).number}`)
    const lines = group.map((item) => `${item.speaker}: اختبار رقم ${item.number}. الكلمة: ${item.key}. ${item.carrier}`).join('\n')
    const pcm = await generate(lines)
    const partNumber = Math.floor(start / GROUP) + 1
    const wav = resolve(TMP, `screen-${String(partNumber).padStart(3, '0')}.wav`)
    const mp3 = resolve(OUTDIR, `screen-${String(partNumber).padStart(3, '0')}.mp3`)
    writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm])); encode(wav, mp3); parts.push(wav)
    if (start + GROUP < screening.length) await sleep(1200)
  }

  const inputs = []; const filters = []
  parts.forEach((file, index) => { inputs.push('-i', file); filters.push(`[${index}:a]apad=pad_dur=0.65[a${index}]`) })
  filters.push(`${parts.map((_, index) => `[a${index}]`).join('')}concat=n=${parts.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`)
  const merged = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '1',
    '-c:a', 'libmp3lame', '-b:a', '160k', OUT], { encoding: 'utf8' })
  if (merged.status !== 0) throw new Error(merged.stderr || 'فشل دمج حلقة المعجم')

  writeFileSync(LEGEND, JSON.stringify({ ...suite, model: MODEL, voices: { male: MALE, female: FEMALE }, screening }, null, 2) + '\n')
  console.log(`✓ حلقة المعجم جاهزة: ${suite.optionTests.length} بخيارات · ${screening.length} فحصاً · ${OUT}`)
}

main().catch((error) => { console.error('✗', error.message); process.exit(1) })
