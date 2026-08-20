#!/usr/bin/env node
/**
 * بيك أوف الأصوات الكويتية.
 *
 * حكم الدكتور المتكرر: «مرات يحوّل إماراتي وعماني، لكن إماراتي أكثر».
 * وهذا صوتُ المحرّك لا كلماتِه — لا يصلحه استبدالٌ في المعجم.
 * والزوج الحالي (Puck + Callirrhoe) اختير لفجوة الطبقة وحدها لا للهجة.
 *
 * فهذي الجولة تقيس أمرين معاً على **نفس المقطع**:
 *   • فجوة الحنجرتين — رقمياً، بلا أذنه (نفس مقياس بوابة الطبقة).
 *   • قربُ اللهجة من كويت المدينة — بأذنه وحدها، فهي ما لا يُقاس.
 *
 * المقطع محشوٌّ عمداً بالمواضع التي سمعها إماراتية، وفي فم نورة أثقلها
 * لأن لكنتها هي المشكوّ منها منذ ١٤ أغسطس.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = resolve(ROOT, '.bakeoff-tmp')
const OUTDIR = resolve(ROOT, 'audio', 'voice-bakeoff')
const OUT = resolve(ROOT, 'audio', 'voice-bakeoff.mp3')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* الأزواج. الأول هو الحالي — مرجعٌ يقارن عليه لا مرشّح.
   أسماء أصوات Gemini قد يُرفض بعضها؛ الفشل يُلتقط ويُبلَّغ ولا يُسقط الجولة. */
const PAIRS = [
  /* الجولة الثانية (٢٠ أغسطس ٢٠٢٦ مساءً) — بحكمه على الجولة الأولى:
     «١ الرجل جيد» و«٤ المرأة ممتازة و١ جيدة». فالتركيبة التي يريدها
     (Puck + Autonoe) لم تُختبر أصلاً — كل زوجٍ في الجولة الأولى كان مغلقاً.
     فهذي الجولة تختبرها، ومعها المنافسان اللذان أثنى عليهما مفردَين. */
  ['واحد', 'Puck',    'Autonoe',    'تركيبتك — رجل ١ + امرأة ٤'],
  ['اثنين', 'Iapetus', 'Autonoe',    'الأوسع فجوةً في الجولة الأولى (٤٠)'],
  ['ثلاثة', 'Puck',    'Callirrhoe', 'الحالي — مرجع'],
]

const KW = '[Kuwaiti Kuwait-City accent only]'

/* المقطع: مواضعُ سمعها إماراتيةً، وأثقلها في فم نورة عمداً. */
const LINES = (label) => [
  `Fahad: ${KW} الزوج رقم ${label}. حياكم الله، شخباركم؟ اليوم بنسولف عن الدرجات والعيال.`,
  `Noura: ${KW} إي حياك. ترى الموظوع وايد يستاهل، خل نبدأ چذي على طول.`,
  `Fahad: ${KW} الطالب ايعرف إن الدرجة شهاده وبس، ومخه فاهمها، بس ما يفرح فيها.`,
  `Noura: ${KW} بس منو قال إن الشهاده تكفي؟ الشهاده بيدها اليوم، والفكرة بعدها بعيده عنها.`,
  `Fahad: ${KW} وعندي سؤال أخير، ترى يمكن هو اللي يِقْلِب الفكرة كلها.`,
]

const PROMPT_HEAD = `ABSOLUTE RULE — APPLY TO EVERY SINGLE WORD
This is Kuwait City (حضري) Kuwaiti Arabic and nothing else. These registers are FORBIDDEN outright; each is an automatic hard failure: Emirati (Dubai/Abu Dhabi), Omani, Iraqi, Iranian/Persian, Saudi (Najdi/Hejazi), Levantine, Egyptian, and any generic pan-Gulf blend belonging to no city.
Never heavy, never emphatic: Kuwait City speech is light and soft in the mouth. Do not thicken or darken any consonant.
NOURA — TARGETED: the Emirati thinning keeps surfacing on her lines specifically while the male lines hold Kuwait City weight. Give her every line the same full Kuwait City register as Fahad: never lighter, never more forward.
Read each line exactly as written, letter for letter, including any vowel marks.`

const PROMPT_TAIL = `FINAL CHECK — re-scan every word. Anything that would come out Emirati, Omani, or generic-Gulf must be corrected to Kuwait City Kuwaiti before the take.`

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

async function gen(male, female, transcript) {
  const input = `${PROMPT_HEAD}\n\n${transcript}\n\n${PROMPT_TAIL}`
  let lastErr = 'غير معروف'
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 120_000)
      const res = await fetch(API, {
        method: 'POST', signal: controller.signal,
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, input, response_format: { type: 'audio' },
          generation_config: { speech_config: [
            { speaker: 'Fahad', voice: male },
            { speaker: 'Noura', voice: female },
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
        return { pcm }
      }
      lastErr = body?.error?.message || `HTTP ${res.status}`
      /* اسمُ صوتٍ مرفوض لا يُصلحه التكرار — يُبلَّغ فوراً ويُمضى للزوج التالي. */
      if (res.status === 400) return { error: lastErr }
      if (res.status === 429 || res.status >= 500) { await sleep(1500 * attempt); continue }
      return { error: lastErr }
    } catch (e) { lastErr = e.message; if (attempt === 4) return { error: lastErr }; await sleep(1200 * attempt) }
  }
  return { error: lastErr }
}

/* نفس مقياس بوابة الطبقة في المولّد — منقولٌ حرفياً ليكون الرقمان مقارنَين. */
const F0_SR = 16000
function medianF0(file) {
  const dec = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-i',file,'-f','s16le','-ac','1','-ar',String(F0_SR),'-'], { maxBuffer: 1 << 27 })
  if (dec.status !== 0 || !dec.stdout?.length) return null
  const pcm = new Int16Array(dec.stdout.buffer, dec.stdout.byteOffset, dec.stdout.byteLength >> 1)
  const F = Math.floor(0.04 * F0_SR), H = Math.floor(0.02 * F0_SR)
  const minLag = Math.floor(F0_SR / 350), maxLag = Math.floor(F0_SR / 60)
  const f0s = []
  for (let off = 0; off + F <= pcm.length; off += H) {
    let rms = 0
    for (let i = 0; i < F; i++) rms += pcm[off + i] * pcm[off + i]
    if (Math.sqrt(rms / F) < 300) continue
    let best = 0, bestLag = 0, energy = 0
    for (let i = 0; i < F; i++) energy += pcm[off + i] * pcm[off + i]
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i < F - lag; i++) sum += pcm[off + i] * pcm[off + i + lag]
      if (sum > best) { best = sum; bestLag = lag }
    }
    if (!bestLag || best / energy < 0.45) continue
    let lag = bestLag
    for (let cand = maxLag; cand >= minLag; cand--) {
      let sum = 0
      for (let i = 0; i < F - cand; i++) sum += pcm[off + i] * pcm[off + i + cand]
      if (sum >= 0.85 * best) { lag = cand; break }
    }
    f0s.push(F0_SR / lag)
  }
  if (f0s.length < 5) return null
  f0s.sort((a, b) => a - b)
  return f0s[Math.floor(f0s.length / 2)]
}

/* الفجوة تُقاس بعزل نصفَي المقطع: أدوار فهد الثلاثة ثم أدوار نورة الاثنان.
   ولأن الأدوار متتابعة بلا علامةٍ في الصوت، نولّد لكل متحدّثٍ نداءً منفصلاً
   للقياس وحده — لا للاستماع. أرخصُ من محاولة تقطيع المقطع بالصمت وأدقّ. */
/* التذبذب هو المشكلة: Puck وحده قيس ١٢٥ و١٣٦ و١٦٠ و١٦٢ و١٩٠ عبر التشغيلات.
   فقياسٌ واحدٌ لا يحكم على زوج. نقيس ثلاث مرات ونعطي المدى والوسيط —
   والزوج الذي فجوته موجبةٌ في القياسات الثلاث هو وحده الذي يُوثق به. */
async function measureGapOnce(male, female) {
  const one = await gen(male, female, `Fahad: ${KW} الطالب ايعرف إن الدرجة شهاده وبس، ومخه فاهمها بس ما يفرح فيها.`)
  const two = await gen(male, female, `Noura: ${KW} بس منو قال إن الشهاده تكفي؟ الشهاده بيدها اليوم، والفكرة بعدها بعيده عنها.`)
  if (one.error || two.error) return null
  const wav = (pcm, name) => {
    const p = resolve(TMP, name)
    writeFileSync(p, Buffer.concat([wavHeader(pcm.length), pcm]))
    return p
  }
  const m = medianF0(wav(one.pcm, `m-${male}-${Math.random().toString(36).slice(2, 8)}.wav`))
  const f = medianF0(wav(two.pcm, `f-${female}-${Math.random().toString(36).slice(2, 8)}.wav`))
  return (m && f) ? { male: m, female: f, gap: f - m } : null
}

async function measureGap(male, female, rounds = 3) {
  const runs = []
  for (let i = 0; i < rounds; i += 1) {
    const r = await measureGapOnce(male, female)
    if (r) runs.push(r)
    if (i < rounds - 1) await sleep(800)
  }
  if (!runs.length) return null
  const gaps = runs.map((r) => r.gap).sort((a, b) => a - b)
  return {
    runs: runs.map((r) => ({ male: Math.round(r.male), female: Math.round(r.female), gap: Math.round(r.gap) })),
    gap: gaps[Math.floor(gaps.length / 2)],
    min: gaps[0],
    max: gaps[gaps.length - 1],
    allPositive: gaps[0] > 0,
  }
}

async function main() {
  if (!KEY) throw new Error('GEMINI_API_KEY مفقود')
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  rmSync(OUTDIR, { recursive: true, force: true }); mkdirSync(OUTDIR, { recursive: true })
  mkdirSync(dirname(OUT), { recursive: true })

  const wavs = []
  const legend = []
  for (const [label, male, female, note] of PAIRS) {
    console.log(`🎙️ الزوج «${label}» = ${male} + ${female}${note ? ' — ' + note : ''}`)
    const r = await gen(male, female, LINES(label).join('\n'))
    if (r.error) {
      console.log(`   ✗ سقط: ${r.error}`)
      legend.push({ label, male, female, note, failed: r.error })
      continue
    }
    const wav = resolve(TMP, `pair-${male}-${female}.wav`)
    writeFileSync(wav, Buffer.concat([wavHeader(r.pcm.length), r.pcm]))
    wavs.push(wav)
    const slug = `${label}-${male}-${female}`.replace(/[^\p{L}\p{N}-]+/gu, '-')
    const mp3 = resolve(OUTDIR, `${slug}.mp3`)
    const enc = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',wav,
      '-af','loudnorm=I=-16:TP=-1.5','-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','160k',mp3], { encoding: 'utf8' })
    if (enc.status !== 0) throw new Error(enc.stderr || 'فشل الترميز')
    const g = await measureGap(male, female)
    if (g) {
      console.log(`   الفجوة: وسيط ${g.gap} · المدى ${g.min}..${g.max} هرتزاً${g.allPositive ? ' · موجبة في الثلاثة ✓' : ' · انقلبت في قياسٍ واحدٍ على الأقل ⚠️'}`)
      console.log(`   القياسات: ${g.runs.map((r) => `فهد ${r.male}/نورة ${r.female} = ${r.gap}`).join(' · ')}`)
    }
    else console.log('   الفجوة لم تُقَس')
    legend.push({ label, male, female, note, file: `audio/voice-bakeoff/${slug}.mp3`, ...(g || {}) })
    await sleep(1000)
  }

  if (!wavs.length) throw new Error('لم ينجح أي زوج')

  const inputs = []; const filters = []
  wavs.forEach((f, i) => { inputs.push('-i', f); filters.push(`[${i}:a]apad=pad_dur=1.0[a${i}]`) })
  filters.push(`${wavs.map((_, i) => `[a${i}]`).join('')}concat=n=${wavs.length}:v=0:a=1,loudnorm=I=-16:TP=-1.5[out]`)
  const r = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y', ...inputs,
    '-filter_complex', filters.join(';'), '-map','[out]','-ar','48000','-ac','1',
    '-c:a','libmp3lame','-b:a','160k', OUT], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || 'فشل الدمج')

  writeFileSync(resolve(dirname(OUT), 'voice-bakeoff-legend.json'), JSON.stringify({ pairs: legend }, null, 2))
  console.log('\n✓ جاهز: audio/voice-bakeoff.mp3')
  const ok = legend.filter((l) => !l.failed)
  const ranked = ok.filter((l) => typeof l.gap === 'number').sort((a, b) => b.gap - a.gap)
  if (ranked.length) {
    console.log('  ترتيب الفجوة (الرقم وحده — اللهجة لأذنه):')
    for (const l of ranked) console.log(`    ${l.label}: وسيط ${l.gap} (${l.min}..${l.max})${l.allPositive ? ' ✓' : ' ⚠️ انقلبت'} — ${l.male} + ${l.female}`)
  }
  const failed = legend.filter((l) => l.failed)
  if (failed.length) console.log(`  سقط ${failed.length} زوجاً: ${failed.map((f) => `${f.label} (${f.male}+${f.female})`).join(' · ')}`)
}

main().catch((e) => { console.error('✗', e.message); process.exit(1) })
