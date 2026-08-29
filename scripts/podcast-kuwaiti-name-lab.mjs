#!/usr/bin/env node
/**
 * مختبر اسم العائلة — جولةٌ قصيرة لأذن الدكتور وحدها.
 *
 * لا يعيد توليد حلقة ولا يغيّر المعجم. يولّد الإملاءات الستة داخل جملة
 * الإحالة الحقيقية، وكل إملاء يقوله فهد ثم نورة في Same-Take واحد. جذي
 * يكون الحكم صالحاً مهما بدّل تنويع الحوار صاحب سطر الختام مستقبلاً.
 *
 * المختبر يستعمل Vertex Pro المستقر نفسه الذي يستعمله إنتاج الـ143، لا
 * Preview في AI Studio. اختيارٌ نجح في بوابةٍ ثانية ما يعتبر اعتماداً.
 *
 *   node scripts/podcast-kuwaiti-name-lab.mjs --self-test
 *   node scripts/podcast-kuwaiti-name-lab.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TMP = resolve(ROOT, '.name-lab-tmp')
const OUT = resolve(ROOT, 'audio', 'kuwaiti-name-lab.mp3')
const LEGEND = resolve(ROOT, 'audio', 'kuwaiti-name-lab.json')
const PROJECT = String(process.env.PODCAST_KW_VERTEX_PROJECT || '').trim()
const LOCATION = String(process.env.PODCAST_KW_VERTEX_LOCATION || 'us-central1').trim()
const MODEL = String(process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-tts').trim()
const LANGUAGE = String(process.env.PODCAST_KW_TTS_LANGUAGE || 'ar-001').trim()
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const MALE = process.env.PODCAST_KW_MALE_VOICE || 'Puck'
const FEMALE = process.env.PODCAST_KW_FEMALE_VOICE || 'Zephyr'
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

export const CARRIER = 'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في موقع الدكتور أحمد حسين {W}.'

export const CANDIDATES = [
  { spelling: 'الفيلتشاوي', note: 'المعتمد اليوم — اختياره سماعاً ١٥ أغسطس في عينة معزولة' },
  { spelling: 'الفيلچاوي', note: 'الإملاء المكتوب نفسه، بلا تحويل' },
  { spelling: 'الفيلتْشاوي', note: 'سكون على التاء كي لا تُبتلع قبل الشين' },
  { spelling: 'الفيل تشاوي', note: 'مفصولة كي لا يدمجها المحرّك في كلمة واحدة' },
  { spelling: 'الفَيْلَتشاوي', note: 'مشكّلة على وزن الاسم كما يُنطق' },
  { spelling: 'الفيلكاوي', note: 'ضبطٌ مرجعي — إن خرج مثل الأول فالمحرّك يتجاهل «تش»' },
]

const HEAD = `Read only the labelled TEST LINES below. This is one continuous pronunciation screening by the same two educated contemporary urban Kuwait City speakers, Fahad and Noura.
Preserve their exact Puck and Zephyr identities throughout. Keep compact vowels, light consonants, direct settled endings, and ordinary conversational timing. Never turn the list into an advertisement, documentary, chant, or dramatic performance.
Every Arabic test number and every carrier sentence is mandatory. Read in order, exactly once, without skipping, merging, correcting, paraphrasing, or adding commentary.
For every spelling, Fahad says the real carrier sentence once and Noura immediately says the same carrier sentence once. Preserve each speaker's identity. Do not merge their two readings.
These lines differ only in the spelling of one family name. Read each spelling exactly as written. Never normalize one spelling to another, never make two of them sound the same on purpose, and never repair a spelling you find unusual.`
const TAIL = 'Silently verify that every option was spoken once by Fahad and once by Noura. Speak only the labelled lines.'
const NUM = ['واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة']

export function buildNameLabLines (candidates = CANDIDATES, carrier = CARRIER) {
  const lines = ['Fahad: هذي جولة اسم العائلة. ستة خيارات، وكل خيار بنسمعه بالصوتين.']
  candidates.forEach((item, index) => {
    const sentence = carrier.replace('{W}', item.spelling)
    lines.push(`Fahad: خيار ${NUM[index]}. ${sentence}`)
    lines.push(`Noura: خيار ${NUM[index]}. ${sentence}`)
  })
  return lines.join('\n')
}

function wavHeader (bytes, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44); const align = channels * bits / 8
  header.write('RIFF', 0); header.writeUInt32LE(36 + bytes, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * align, 28)
  header.writeUInt16LE(align, 32); header.writeUInt16LE(bits, 34); header.write('data', 36); header.writeUInt32LE(bytes, 40)
  return header
}

const isBase64Audio = (value) => typeof value === 'string' && value.length > 512
  && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(value)

export function collectAudioBlocks (body) {
  const blocks = []; const seen = new Set()
  const walk = (node, inAudio = false) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) { node.forEach((item) => walk(item, inAudio)); return }
    const audioHere = inAudio || node.type === 'audio' || node.modality === 'audio'
      || String(node.mime_type || node.mimeType || '').startsWith('audio/')
    for (const [key, value] of Object.entries(node)) {
      if (isBase64Audio(value) && (audioHere || /^(data|audio|b64_audio|audio_data)$/.test(key))) blocks.push(value)
      else walk(value, audioHere)
    }
  }
  walk(body)
  return blocks
}

export async function collectVertexSsePcm (response) {
  if (!response?.body?.getReader) throw new Error('Vertex streaming response بلا جسم قابل للقراءة')
  const reader = response.body.getReader(); const decoder = new TextDecoder()
  const chunks = []; let pending = ''
  const consume = (event) => {
    const payload = String(event || '').split(/\r?\n/)
      .filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n').trim()
    if (!payload || payload === '[DONE]') return
    let packet = null
    try { packet = JSON.parse(payload) } catch { throw new Error(`Vertex أعاد حدثاً غير JSON: ${payload.slice(0, 180)}`) }
    if (packet?.error) throw new Error(packet.error.message || 'Vertex streaming error')
    for (const block of collectAudioBlocks(packet)) chunks.push(Buffer.from(block, 'base64'))
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    pending += decoder.decode(value, { stream:true })
    const events = pending.split(/\r?\n\r?\n/); pending = events.pop() || ''
    events.forEach(consume)
  }
  pending += decoder.decode()
  if (pending.trim()) consume(pending)
  if (!chunks.length) throw new Error('Vertex streaming اكتمل بلا صوت')
  return Buffer.concat(chunks)
}

function accessToken () {
  const result = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding:'utf8' })
  const token = String(result.stdout || '').trim()
  if (result.status !== 0 || !token) throw new Error(String(result.stderr || '').trim() || 'تعذّر أخذ Vertex access token')
  return token
}

async function generate (lines) {
  if (!PROJECT) throw new Error('PODCAST_KW_VERTEX_PROJECT مفقود')
  const prompt = `${HEAD}\n\n# TEST LINES\n${lines}\n\n${TAIL}`
  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(PROJECT)}/locations/${encodeURIComponent(LOCATION)}/publishers/google/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`
  let last = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 240_000)
    try {
      const response = await fetch(endpoint, {
        method:'POST', signal:controller.signal,
        headers:{ Authorization:`Bearer ${accessToken()}`, 'x-goog-user-project':PROJECT, 'Content-Type':'application/json' },
        body:JSON.stringify({
          contents:{ role:'user', parts:[{ text:prompt }] },
          generationConfig:{ responseModalities:['AUDIO'], speechConfig:{
            languageCode:LANGUAGE,
            multiSpeakerVoiceConfig:{ speakerVoiceConfigs:[
              { speaker:'Fahad', voiceConfig:{ prebuiltVoiceConfig:{ voiceName:MALE } } },
              { speaker:'Noura', voiceConfig:{ prebuiltVoiceConfig:{ voiceName:FEMALE } } },
            ] },
          } },
        }),
      })
      if (!response.ok) {
        const detail = await response.text()
        if (response.status !== 429 && response.status < 500) throw new Error(`Vertex HTTP ${response.status}: ${detail.slice(0, 300)}`)
        last = new Error(`Vertex HTTP ${response.status}: ${detail.slice(0, 300)}`)
      } else {
        const pcm = await collectVertexSsePcm(response)
        if (pcm.length < 4000) throw new Error('صوت قصير/فارغ')
        return pcm
      }
    } catch (error) {
      last = error
      if (attempt === 4 || /Vertex HTTP 4\d\d/.test(String(error?.message || error))) throw error
    } finally {
      clearTimeout(timer)
    }
    await sleep(1800 * attempt)
  }
  throw last || new Error('فشل Vertex TTS')
}

function selfTest () {
  assert.equal(CANDIDATES.length, 6, 'ستة مرشحين لا أكثر')
  assert.equal(new Set(CANDIDATES.map((candidate) => candidate.spelling)).size, 6, 'لا تكرار في الإملاءات')
  assert.ok(CANDIDATES.some((candidate) => candidate.spelling === 'الفيلتشاوي'), 'المعتمد اليوم حاضر')
  assert.ok(CANDIDATES.some((candidate) => candidate.spelling === 'الفيلكاوي'), 'الضبط المرجعي حاضر')
  const lines = buildNameLabLines(); const rows = lines.split('\n')
  assert.equal(rows.length, 13, 'تمهيد ثم ستة خيارات بصوتين')
  assert.equal(rows.filter((line) => line.startsWith('Fahad:')).length, 7, 'فهد يقول المرشحين الستة')
  assert.equal(rows.filter((line) => line.startsWith('Noura:')).length, 6, 'نورة تقول المرشحين الستة')
  for (const candidate of CANDIDATES) {
    assert.equal(rows.filter((line) => line.includes(`أحمد حسين ${candidate.spelling}.`)).length, 2,
      `${candidate.spelling}: يُسمع داخل جملة الإحالة الحقيقية مرةً بكل صوت`)
  }
  assert.doesNotMatch(MODEL, /preview/i, 'المختبر يستعمل نموذج Vertex المستقر نفسه، لا Preview')
  assert.doesNotMatch(HEAD, /Emirati|Omani|Saudi|عُماني|إماراتي|سعودي/i,
    'توجيه الممثل إيجابي ولا يزرع لهجات مرفوضة')
  const fake = Buffer.alloc(800, 7).toString('base64')
  assert.equal(collectAudioBlocks({ candidates:[{ content:{ parts:[{ inlineData:{ mimeType:'audio/L16', data:fake } }] } }] }).length, 1,
    'غلاف Vertex الفعلي يُقرأ ولا تنتهي الجولة 200 بلا صوت')
  console.log(`✓ مختبر الاسم: ${CANDIDATES.length} إملاءات · جملة حقيقية · فهد ونورة · Vertex ${MODEL}`)
}

async function main () {
  if (process.argv.includes('--self-test')) return selfTest()
  rmSync(TMP, { recursive:true, force:true }); mkdirSync(TMP, { recursive:true })
  mkdirSync(dirname(OUT), { recursive:true })
  console.log(`🎙️ جولة الاسم: ${CANDIDATES.length} إملاءات × صوتين في Same-Take Vertex واحد`)
  const pcm = await generate(buildNameLabLines())
  const wav = resolve(TMP, 'name-lab.wav')
  writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm]))
  const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',wav,
    '-af','loudnorm=I=-16:TP=-1.5','-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','160k',OUT], { encoding:'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || 'فشل ترميز جولة الاسم')
  writeFileSync(LEGEND, JSON.stringify({
    note:'جولة اسم العائلة. الحكم بأذن الدكتور وحده؛ لا يدخل المعجم شيء قبل أن يسمعه ويختاره في الصوتين.',
    generatedAt:new Date().toISOString(), provider:'vertex', project:PROJECT, location:LOCATION,
    model:MODEL, languageCode:LANGUAGE, voices:{ male:MALE, female:FEMALE }, carrier:CARRIER,
    candidates:CANDIDATES.map((candidate, index) => ({ number:index + 1, heardIn:['Fahad','Noura'], ...candidate })),
  }, null, 2) + '\n')
  console.log(`✓ جاهزة: ${OUT}`)
  CANDIDATES.forEach((candidate, index) => console.log(`   ${index + 1}. ${candidate.spelling} — ${candidate.note}`))
}

main().catch((error) => { console.error('✗', error.message); process.exit(1) })
