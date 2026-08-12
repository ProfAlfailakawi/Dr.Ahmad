#!/usr/bin/env node
/**
 * «مجلس الفكرة — كويتي»
 * يولّد نسخة كويتية مستقلة عبر Gemini 3.1 Flash TTS Multi-speaker.
 * لا يقرأ manual-dialogues ولا يكتب .dialogue.mp3؛ الفصحى تبقى منفصلة بالكامل.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { normalizeManualDialogueTurns } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-kw-tmp')
const AUDITS = resolve(ROOT, 'podcast-audits', 'kuwaiti')
const STATE = resolve(ROOT, '.podcast-state.json')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
const MALE_VOICE = process.env.GEMINI_TTS_MALE_VOICE || 'Sadaltager'
const FEMALE_VOICE = process.env.GEMINI_TTS_FEMALE_VOICE || 'Sulafat'
const PROFILE = process.env.PODCAST_KW_PROFILE || 'kuwaiti-urban-soft-v2'
const GENERATION_MODE = String(process.env.PODCAST_KW_GENERATION_MODE || 'pilot').trim().toLowerCase()
const PILOT_SLUG = String(process.env.PODCAST_KW_PILOT_SLUG || 'success-that-does-not-bring-joy-to-its-ownerarabic').trim()
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const args = process.argv.slice(2)
const SELF_TEST = args.includes('--self-test')
const DRY_RUN = args.includes('--dry-run')
const slug = (args.find((item) => item.startsWith('--slug=')) || '').slice(7)
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const MUSIC_BRIDGE = process.env.PODCAST_KW_BRIDGE || resolve(ROOT, 'music', 'quiet-echoes.mp3')
const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
const words = (text) => String(text || '').trim().split(/\s+/).filter(Boolean)

function wavHeader(pcmBytes, sampleRate = 24000, channels = 1, bits = 16) {
  const header = Buffer.alloc(44)
  const blockAlign = channels * bits / 8
  const byteRate = sampleRate * blockAlign
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcmBytes, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32); header.writeUInt16LE(bits, 34); header.write('data', 36); header.writeUInt32LE(pcmBytes, 40)
  return header
}
function writePcmWav(path, pcm) { writeFileSync(path, Buffer.concat([wavHeader(pcm.length), pcm])) }

function chunkTurns(turns, { maxTurns = 1, maxChars = 4300 } = {}) {
  const chunks = []
  let row = []
  let chars = 0
  for (const turn of turns) {
    const nextChars = chars + turn.text.length
    if (row.length && (row.length >= maxTurns || nextChars > maxChars)) {
      chunks.push(row); row = []; chars = 0
    }
    row.push(turn); chars += turn.text.length
    if (turn.musicBridgeAfter && row.length >= 2) { chunks.push(row); row = []; chars = 0 }
  }
  if (row.length) chunks.push(row)
  return chunks
}

const directionFor = (type) => ({
  question: '[curious]', reflection: '[reflective]', objection: '[gently skeptical]', gentleObjection: '[gently skeptical]',
  emphasis: '[serious]', briefReaction: '[warmly]', conclusion: '[calmly]', closing: '[softly]',
}[type] || '')

function promptFor(turns, index, total) {
  const transcript = turns.map((turn) => `${turn.speaker === 'male' ? 'Fahad' : 'Noura'}: ${directionFor(turn.deliveryType)} ${turn.text}`.replace(/:\s+\[/, ': [')).join('\n')
  return `AUDIO PROFILE\nFahad and Noura are educated contemporary Kuwait City speakers in an intimate ideas podcast. Fahad is calm, knowledgeable and warm. Noura is warm, intelligent, naturally curious and never theatrical.\n\nSCENE\nA quiet modern studio in Kuwait. Two colleagues are discussing an idea for a thoughtful general audience. It must feel like a real relaxed Kuwaiti conversation, not an announcer reading copy.\n\nDIRECTOR'S NOTES\n- Speak in contemporary URBAN KUWAITI ARABIC exactly as written in the transcript.\n- Accent target: educated urban Kuwait City. Soft, modern, clear and broadly understandable across the Arab world.\n- IMPORTANT: even when a sentence contains an academic term, proper name, quotation, or a word shared with MSA, pronounce the surrounding Arabic with Kuwaiti phonology and Kuwaiti conversational rhythm. Never switch the sentence into a formal MSA reading voice.\n- Treat question marks as Kuwaiti spoken questions; do not add formal interrogative cadence.\n- Do NOT drift into Egyptian, Levantine/Syrian, Saudi, Emirati, Bedouin, or Modern Standard Arabic pronunciation patterns.\n- Do not caricature Kuwaiti speech and do not exaggerate slang.\n- Preserve every word, number, proper name, research attribution and factual qualifier. Never paraphrase, summarize, translate, add, or omit words.\n- Natural turn-taking, subtle reactions, short human pauses, gentle intellectual chemistry. No radio-news cadence, no commercial voice, no melodrama.\n- Keep Fahad and Noura audibly consistent with earlier chunks. This is chunk ${index + 1} of ${total}.\n- Inline English performance tags guide delivery only; never speak the tags aloud.\n\nTRANSCRIPT\n${transcript}`
}

/* `output_audio` خاصيةُ راحةٍ في مكتبات Gemini، لا حقلٌ في ردّ REST الخام:
   المكتبة تصنعها من «آخر كتلة صوت» داخل `steps`. ولأننا نستدعي REST مباشرةً
   وجب أن نحفر في steps بأنفسنا — وهذه علّة تشغيلتَي ١٢ أغسطس ٢٠٢٦: الردّ كان
   ناجحاً (status=completed وusage يعلن رموزاً مولَّدة) والصوت موجود، لكن
   السكربت كان يبحث عنه في حقلٍ لا وجود له فيسقط. */
const isBase64Audio = (value) => typeof value === 'string' && value.length > 512 && /^[A-Za-z0-9+/\r\n]*={0,2}$/.test(value)

export function collectAudioBlocks(body) {
  const blocks = []
  const seen = new Set()
  const walk = (node, key, inAudio) => {
    if (!node || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) { for (const item of node) walk(item, key, inAudio) ; return }
    const audioHere = inAudio || node.type === 'audio' || node.modality === 'audio'
      || String(node.mime_type || node.mimeType || '').startsWith('audio/')
    for (const [childKey, value] of Object.entries(node)) {
      if (isBase64Audio(value) && (audioHere || /^(data|audio|b64_audio|audio_data)$/.test(childKey))) blocks.push(value)
      else walk(value, childKey, audioHere)
    }
  }
  walk(body, '', false)
  return blocks
}

export function extractPcmBase64(body) {
  const direct = body?.output_audio?.data || body?.interaction?.output_audio?.data || body?.response?.output_audio?.data
  if (isBase64Audio(direct)) return direct
  const blocks = collectAudioBlocks(body)
  /* «آخر كتلة» هي دلالة المكتبة نفسها حين تتعدّد الكتل. */
  return blocks.length ? blocks[blocks.length - 1] : null
}

/* خريطة مسارات الردّ بلا حمولته: لو تغيّر الغلاف مرةً أخرى ظهر الشكل كاملاً
   في السجل بدل أن نعود إلى تخمينٍ ثالث. */
export function describeShape(node, prefix = '', depth = 0, out = []) {
  if (depth > 4 || out.length > 60) return out
  if (Array.isArray(node)) {
    out.push(`${prefix}[] (${node.length})`)
    if (node.length) describeShape(node[0], `${prefix}[0]`, depth + 1, out)
    return out
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'string') out.push(`${path}:string(${value.length})`)
      else if (value === null || typeof value !== 'object') out.push(`${path}:${typeof value}`)
      else describeShape(value, path, depth + 1, out)
    }
  }
  return out
}

async function geminiPcm(prompt) {
  if (!KEY) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY مفقود')
  let last = null
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90_000)
      const response = await fetch(API, {
        method: 'POST', signal: controller.signal,
        /* بلا ترويسة Api-Revision: هي ترويسة البثّ المتدفّق (stream:true) وحدها.
           إرسالها على طلبٍ غير متدفّق يعيد 200 بغلافٍ متدفّقٍ لا يحمل
           output_audio، فيسقط التوليد ورسالته «HTTP 200» بلا سبب — وهي
           بالضبط علّة تشغيلة ١٢ أغسطس ٢٠٢٦. */
        headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          input: prompt,
          response_format: { type: 'audio' },
          generation_config: { speech_config: [
            { speaker: 'Fahad', voice: MALE_VOICE },
            { speaker: 'Noura', voice: FEMALE_VOICE },
          ] },
        }),
      }).finally(() => clearTimeout(timer))
      /* يُقرأ نصاً أولاً: الغلاف غير المتوقّع (أو المتدفّق) ليس JSON دائماً،
         و.json().catch(()=>({})) كان يبتلعه فتضيع كل قرينة على سبب السقوط. */
      const raw = await response.text()
      let body = null
      try { body = JSON.parse(raw) } catch { /* غلاف غير JSON: يُشخَّص أدناه */ }
      let data = extractPcmBase64(body)
      /* لو عاد الردّ إحالةً (معرّف تفاعلٍ مكتمل بلا حمولة) سُحب التفاعل نفسه
         مرّةً واحدة؛ أرخص من إسقاط التوليد كلّه على شكل غلافٍ متغيّر. */
      if (response.ok && !data && body?.id && body?.status === 'completed') {
        const followUp = await fetch(`${API}/${encodeURIComponent(body.id)}`, {
          headers: { 'x-goog-api-key': KEY },
        }).catch(() => null)
        if (followUp?.ok) {
          const followBody = await followUp.json().catch(() => null)
          data = extractPcmBase64(followBody)
          if (data) console.log('ℹ️ الصوت جاء من سحب التفاعل بمعرّفه لا من ردّ الطلب')
        }
      }
      if (response.ok && data) {
        const pcm = Buffer.from(data, 'base64')
        if (pcm.length < 4000) throw new Error('Gemini أعاد صوتاً قصيراً/فارغاً')
        return pcm
      }
      /* الرسالة تحمل خريطة الردّ كاملة: بلا هذا كانت تُختصر إلى «HTTP 200». */
      const shape = body && typeof body === 'object'
        ? `شكل الردّ: ${describeShape(body).join(' | ')}`
        : `ردّ غير JSON (${raw.length} حرفاً): ${raw.slice(0, 200).replace(/\s+/g, ' ')}`
      const message = body?.error?.message || body?.message
        || `HTTP ${response.status} بلا صوت — ${shape}`
      if (response.status !== 429 && response.status < 500) throw new Error(message)
      last = new Error(message)
    } catch (error) { last = error }
    if (attempt < 4) await sleep(1200 * attempt)
  }
  throw last || new Error('فشل Gemini TTS')
}

function duration(file) {
  const out = spawnSync(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file], { encoding:'utf8' })
  const value = Number(out.stdout?.trim())
  if (out.status !== 0 || !Number.isFinite(value) || value <= 0) throw new Error(`تعذر قياس الصوت: ${file}`)
  return value
}

function buildTimedMaster(turns, files, output) {
  if (turns.length !== files.length) throw new Error('precise timing requires one generated file per dialogue turn')
  const items = []
  let cursor = 0.20
  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i]
    const file = files[i]
    const dur = duration(file)
    if (i > 0) {
      const previous = items.at(-1)
      const requestedOverlap = Math.max(0, Math.min(150, Number(turn.overlapMs || 0)))
      if (requestedOverlap > 0) cursor = Math.max(0, previous.startSec + previous.durationSec - requestedOverlap / 1000)
      else cursor = previous.startSec + previous.durationSec + Math.max(80, Math.min(1200, Number(turns[i - 1].pauseAfterMs || 320))) / 1000
      if (turns[i - 1].musicBridgeAfter) cursor = Math.max(cursor, previous.startSec + previous.durationSec + 0.55)
    }
    items.push({ index: i, file, startSec: cursor, durationSec: dur, isBridge: false })
  }

  const bridgeItems = []
  if (existsSync(MUSIC_BRIDGE)) {
    let bridgeNo = 0
    for (let i = 0; i < turns.length - 1; i += 1) {
      if (!turns[i].musicBridgeAfter) continue
      const current = items[i]
      const next = items[i + 1]
      const bridgeFile = resolve(TMP, `bridge-${String(++bridgeNo).padStart(2, '0')}.wav`)
      const bridgeDuration = 1.35
      const bridge = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',MUSIC_BRIDGE,'-t',String(bridgeDuration),
        '-af',`afade=t=in:d=0.20,afade=t=out:st=0.75:d=0.60,volume=0.075`,'-ar','24000','-ac','1','-c:a','pcm_s16le',bridgeFile], { encoding:'utf8' })
      if (bridge.status !== 0) throw new Error(bridge.stderr || 'فشل إنشاء الجسر الموسيقي')
      const bridgeStart = Math.max(0, current.startSec + current.durationSec - 0.12)
      bridgeItems.push({ file: bridgeFile, startSec: bridgeStart, durationSec: bridgeDuration, isBridge: true })
      // Let the next speaker enter under the tail of the bridge, but never over the previous spoken turn.
      next.startSec = Math.max(current.startSec + current.durationSec + 0.18, bridgeStart + 0.72)
      for (let j = i + 2; j < items.length; j += 1) {
        const prev = items[j - 1]
        const overlap = Math.max(0, Math.min(150, Number(turns[j].overlapMs || 0)))
        items[j].startSec = overlap > 0
          ? Math.max(0, prev.startSec + prev.durationSec - overlap / 1000)
          : prev.startSec + prev.durationSec + Math.max(80, Math.min(1200, Number(turns[j - 1].pauseAfterMs || 320))) / 1000
        if (turns[j - 1].musicBridgeAfter) items[j].startSec = Math.max(items[j].startSec, prev.startSec + prev.durationSec + 0.55)
      }
    }
  }

  const all = [...items, ...bridgeItems].sort((a,b)=>a.startSec-b.startSec)
  const ffInputs = []; const filters = []
  all.forEach((item, idx) => {
    ffInputs.push('-i', item.file)
    const delay = Math.max(0, Math.round(item.startSec * 1000))
    filters.push(`[${idx}:a]adelay=${delay}|${delay}[a${idx}]`)
  })
  const mixed = all.map((_,idx)=>`[a${idx}]`).join('')
  filters.push(`${mixed}amix=inputs=${all.length}:normalize=0[mix]`)
  filters.push('[mix]highpass=f=55,acompressor=threshold=-18dB:ratio=1.6:attack=18:release=180,loudnorm=I=-16:TP=-1.5:LRA=11[out]')
  const total = Math.max(...all.map((item)=>item.startSec+item.durationSec), 0) + 0.35
  const result = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y',...ffInputs,'-filter_complex',filters.join(';'),'-map','[out]','-t',total.toFixed(3),
    '-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','160k',output], { encoding:'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'فشل precise mastering')
  return { items, bridges: bridgeItems, durationSec: total }
}

function timelineFor(turns, assembly) {
  const utterances = assembly.items.map((item, index) => ({
    index,
    speaker: turns[index].speaker === 'male' ? 'فهد' : 'نورة',
    text: turns[index].text,
    startSec: Number(item.startSec.toFixed(3)),
    endSec: Number((item.startSec + item.durationSec).toFixed(3)),
    pauseAfterMs: Number(turns[index].pauseAfterMs || 0),
    overlapMs: Number(turns[index].overlapMs || 0),
    musicBridgeAfter: Boolean(turns[index].musicBridgeAfter),
  }))
  const chapters = []
  turns.forEach((turn,index)=>{
    if (index === 0 || turns[index - 1].musicBridgeAfter) {
      chapters.push({ index: chapters.length + 1, title: turn.text.slice(0,52).replace(/[.!؟…،].*$/u,'').trim() || `المقطع ${chapters.length + 1}`,
        startSec: utterances[index].startSec })
    }
  })
  chapters.forEach((chapter,index)=>{ chapter.endSec = index + 1 < chapters.length ? chapters[index + 1].startSec : Number(assembly.durationSec.toFixed(3)) })
  return { schemaVersion: 3, dialect: PROFILE, generatedBy: MODEL, preciseTiming: true,
    chapters, utterances, musicBridges: assembly.bridges.map((b)=>({ startSec:Number(b.startSec.toFixed(3)), durationSec:b.durationSec })),
    durationSec: Number(assembly.durationSec.toFixed(3)) }
}

function saveState(slugValue, audioFile, transcriptFile) {
  const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE,'utf8')) : { done: {} }
  state.done ||= {}
  state.done[`${slugValue}:kw`] = {
    status: 'accepted_automated', provider: 'gemini', model: MODEL, profile: PROFILE,
    audioHash: sha256(readFileSync(audioFile)), transcriptHash: sha256(readFileSync(transcriptFile)),
    acceptedAt: new Date().toISOString(),
  }
  writeFileSync(STATE, `${JSON.stringify(state,null,2)}\n`)
}

if (SELF_TEST) {
  const turns = [
    { speaker:'male', text:'شلون نعرف إن الفكرة تستاهل؟', deliveryType:'question', pauseAfterMs:300, musicBridgeAfter:false },
    { speaker:'female', text:'إي، خلنا نشوف الدليل أول.', deliveryType:'response', pauseAfterMs:300, musicBridgeAfter:true },
    { speaker:'male', text:'هني يبين الفرق.', deliveryType:'reflection', pauseAfterMs:300, musicBridgeAfter:false },
  ]
  const chunks = chunkTurns(turns)
  assert.equal(chunks.length, 3)
  const prompt = promptFor(chunks[0],0,chunks.length)
  assert.match(prompt,/URBAN KUWAITI ARABIC/); assert.match(prompt,/Fahad:/); assert.match(promptFor(chunks[1],1,chunks.length),/Noura:/)
  const header = wavHeader(100)
  assert.equal(header.toString('ascii',0,4),'RIFF'); assert.equal(header.readUInt32LE(24),24000)

  /* حارس علّة «HTTP 200»: تشغيلة ١٢ أغسطس ٢٠٢٦ سقطت لأن طلباً غير متدفّق
     حمل ترويسة البثّ، فعاد ٢٠٠ بغلافٍ بلا output_audio ولم تُبلّغ الرسالةُ
     شيئاً. الحارسان أدناه يمنعان عودة الوجهين معاً. */
  const source = readFileSync(resolve(ROOT,'scripts','podcast-kuwaiti-gemini.mjs'),'utf8')
  const requestBlock = source.slice(source.indexOf('const response = await fetch(API'), source.indexOf('const raw = await response.text()'))
  /* يُطابَق شكل الترويسة لا اسمها، وإلا لأمسك الحارسُ شرحه المكتوب أعلاه. */
  assert.ok(!/['"]Api-Revision['"]\s*:/.test(requestBlock), 'ترويسة Api-Revision للبثّ وحده؛ وجودها على طلبٍ غير متدفّق يعيد 200 بلا صوت')
  const b64 = (seed) => seed.repeat(Math.ceil(600 / seed.length)).slice(0, 600)
  const A = b64('QUJD'), B = b64('WFla'), C = b64('MTIz')
  assert.equal(extractPcmBase64({ output_audio:{ data:A } }), A, 'غلاف المكتبة إن وُجد')
  assert.equal(extractPcmBase64({ interaction:{ output_audio:{ data:B } } }), B)
  /* الشكل الحقيقي الذي أعادته الواجهة في تشغيلة ١٢ أغسطس: الصوت داخل steps. */
  assert.equal(extractPcmBase64({
    id:'v1_x', object:'interaction', status:'completed', model:MODEL,
    usage:{ total_tokens:763 },
    steps:[{ type:'audio', data:C }],
  }), C, 'الصوت داخل steps هو شكل REST الخام')
  assert.equal(extractPcmBase64({ steps:[{ content:[{ type:'audio', audio:{ data:C } }] }] }), C, 'تعشيش أعمق داخل steps')
  assert.equal(extractPcmBase64({ steps:[{ type:'audio', data:A },{ type:'audio', data:C }] }), C, 'تُؤخذ آخر كتلة كما تفعل المكتبة')
  /* لا يُخطف نصٌّ طويل ليس صوتاً. */
  assert.equal(extractPcmBase64({ steps:[{ type:'text', text:'ا'.repeat(900) }] }), null, 'النص الطويل ليس صوتاً')
  assert.equal(extractPcmBase64({ id:'v1_x', status:'completed', usage:{ total_tokens:5 } }), null)
  assert.equal(extractPcmBase64(null), null)
  assert.ok(describeShape({ steps:[{ type:'audio', data:'x' }] }).join('|').includes('steps[0].type'), 'الخريطة تُظهر مسارات الردّ')

  console.log('✓ Gemini Kuwaiti pipeline self-test: chunking + prompt + PCM/WAV + عقد الطلب والاستخراج')
  process.exit(0)
}

if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('استخدم --slug=<slug>')
if (GENERATION_MODE !== 'all' && slug !== PILOT_SLUG) {
  throw new Error(`pilot-only: التوليد مقفول على ${PILOT_SLUG} حتى اعتماد التجربة`)
}
const source = resolve(ROOT, 'manual-dialogues-kuwaiti', `${slug}.json`)
if (!existsSync(source)) throw new Error(`الحوار الكويتي غير موجود: ${slug}`)
const turns = normalizeManualDialogueTurns(JSON.parse(readFileSync(source,'utf8')))
const sourceLockFile = resolve(ROOT, 'podcast-audits', 'source-locks-kuwaiti', `${slug}.json`)
const sourceLock = existsSync(sourceLockFile) ? JSON.parse(readFileSync(sourceLockFile, 'utf8')) : null
if (!DRY_RUN && (!sourceLock || sourceLock.slug !== slug || !sourceLock.revisionId)) {
  throw new Error('قفل المصدر الكويتي مفقود؛ ممنوع توليد نسخة قابلة للاعتماد')
}
const revisionId = sourceLock?.revisionId || 'dry-run-pilot'
const chunks = chunkTurns(turns)
const prompts = chunks.map((chunk,index)=>promptFor(chunk,index,chunks.length))
if (DRY_RUN) {
  console.log(`✓ ${slug}: ${turns.length} مداخلة → ${chunks.length} مقاطع Gemini`)
  console.log(`✓ model=${MODEL} · male=${MALE_VOICE} · female=${FEMALE_VOICE} · profile=${PROFILE}`)
  console.log(prompts[0].slice(0,2200))
  process.exit(0)
}

mkdirSync(AUDIO,{recursive:true}); rmSync(TMP,{recursive:true,force:true}); mkdirSync(TMP,{recursive:true}); mkdirSync(AUDITS,{recursive:true})
const chunkFiles=[]; const durations=[]; const requestHashes=[]
for (let i=0;i<chunks.length;i+=1) {
  console.log(`🎙️ Gemini ${i+1}/${chunks.length}`)
  const prompt=prompts[i]; requestHashes.push(sha256(prompt))
  const pcm=await geminiPcm(prompt)
  const wav=resolve(TMP,`chunk-${String(i+1).padStart(2,'0')}.wav`); writePcmWav(wav,pcm)
  chunkFiles.push(wav); durations.push(duration(wav))
}
const audioFile=resolve(AUDIO,`${slug}.dialogue-kw.mp3`)
const transcriptFile=resolve(AUDIO,`${slug}.dialogue-kw.json`)
const assembly=buildTimedMaster(turns,chunkFiles,audioFile)
const timeline=timelineFor(turns,assembly)
writeFileSync(transcriptFile,`${JSON.stringify(timeline,null,2)}\n`)
const audit={
  schemaVersion:1, slug, revisionId, status:'candidate', provider:'gemini', model:MODEL, profile:PROFILE,
  voices:{male:MALE_VOICE,female:FEMALE_VOICE}, sourceFile:`manual-dialogues-kuwaiti/${slug}.json`,
  sourceSha256:sha256(readFileSync(source)), turnCount:turns.length, chunkCount:chunks.length,
  requestHashes, audioSha256:sha256(readFileSync(audioFile)), transcriptSha256:sha256(readFileSync(transcriptFile)),
  durationSec:duration(audioFile), mastered:{lufsTarget:-16,truePeakTarget:-1.5,sampleRate:48000,channels:1,bitrateKbps:160},
  generatedAt:new Date().toISOString(),
}
writeFileSync(resolve(AUDITS,`${slug}.json`),`${JSON.stringify(audit,null,2)}\n`)
console.log(`✓ جاهز: audio/${slug}.dialogue-kw.mp3`)
console.log(`✓ النص المتزامن: audio/${slug}.dialogue-kw.json`)
