/**
 * مصنع الروح — يحوّل حلقة حوارية إلى مادة بثّ.
 *
 * الفرق بين قراءةٍ آلية وحلقةٍ يظنّها السامع بشرية ليس في الصوت وحده، بل في
 * أربعة أشياء تُصنع هنا: نبرةٌ تتغيّر مع المعنى، وسكتةٌ قصيرة قبل الجملة التي
 * تضرب، ونَفَسٌ يُسمع قبل الكلام وبعد الجسر، وغرفةٌ لا تسكت سكوتاً رقمياً ميتاً.
 *
 * ولا يحتاج المستودع لأي ملفٍّ صوتيٍّ إضافي: التوقيع والفواصل تُقتطع من مكتبة
 * الموسيقى المرخّصة القائمة، والنَّفَس ونَفَس الغرفة يُصنعان بـffmpeg من ضجيجٍ
 * ورديٍّ مُشكَّل. فالحزمة كلها نصوصٌ وشِفرة.
 *
 * الاستعمال:
 *   node scripts/podcast-soul-forge.mjs <slug> [<slug> …]
 *   node scripts/podcast-soul-forge.mjs --all --limit 40 --batch 1   (الدفعة الأولى)
 * المخرج: public/audio/<slug>.dialogue.mp3 (48kHz · 160k · ‎-16 LUFS)
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, rmSync, renameSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = process.cwd()
const SOUL_DIR = resolve(ROOT, 'manual-dialogues-soul')
const MUSIC_DIR = resolve(ROOT, 'music')
const OUT_DIR = resolve(ROOT, 'public/audio')
const WORK = resolve(ROOT, '.soul-forge-work')

const KEY = process.env.AZURE_SPEECH_KEY
const REGION = process.env.AZURE_SPEECH_REGION || 'uaenorth'
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe'

const VOICE = { male: 'ar-KW-FahedNeural', female: 'ar-KW-NouraNeural' }

/* ═══════════ خريطة الشعور → نبرة وسرعة ═══════════
   مقيسة على الحلقة التي اعتمدها الدكتور بأذنه، لا مقدَّرة. */
const FEEL = {
  gravitas: { rate: '0.96', pitch: '-2%' },   // وقار الافتتاح
  lively: { rate: '1.01' },                   // سردٌ حيّ
  shockbeat: { rate: '0.95' },                // جملةٌ فيها ضربة
  aphorism: { rate: '0.94', pitch: '-2%' },   // حكمةٌ مصقولة
  curious: { rate: '0.99', pitch: '+4%' },    // سؤالٌ فضولي
  intimate: { rate: '0.93', pitch: '-2%' },   // تأمّلٌ حميم
  realization: { rate: '0.94', pitch: '+2%' },// لحظة اكتشاف
  challenge: { rate: '1.02', pitch: '+3%' },  // اعتراضٌ متحدٍّ
  firm: { rate: '0.96', pitch: '+1%' },       // ردٌّ حاسم
  warm: { rate: '0.95', pitch: '-1%' },       // دفءٌ وحنين
  resolve: { rate: '0.93', pitch: '-2%' },    // عزم الختام
  wonder: { rate: '0.96', pitch: '+2%' },     // دهشةٌ هادئة
  hush: { rate: '0.90', pitch: '-3%' },       // همس
  cta: { rate: '0.95', pitch: '-2%' },        // الدعوة الختامية
  plain: {},
}

/* الوقفة بين الأدوار: مشدودةٌ لا ميتة */
const GAP = { 480: 0.35, 560: 0.42, 620: 0.46, 680: 0.50, 760: 0.56, 900: 0.60, 240: 0.30 }
const gapOf = (ms) => GAP[ms] ?? Math.min(Math.max((ms / 1000) * 0.72, 0.30), 0.62)

const sh = (bin, args, label) => {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`${label || bin}: ${(r.stderr || '').slice(-400)}`)
  return r.stdout || ''
}
const durationOf = (file) => Number(sh(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'csv=p=0', file]).trim())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ═══════════ بناء SSML: النبرة والوقفات ═══════════ */
function spanOf(text, feeling) {
  const f = FEEL[feeling] || {}
  const attrs = [f.rate ? `rate="${f.rate}"` : '', f.pitch ? `pitch="${f.pitch}"` : ''].filter(Boolean).join(' ')
  const body = esc(text.trim()).replace(/⏸⏸/g, '<break time="400ms"/>').replace(/⏸/g, '<break time="280ms"/>')
  return attrs ? `<prosody ${attrs}>${body}</prosody>` : body
}

function ssmlOf(utterance) {
  const boundary = utterance.deliveryType === 'reflection' ? 380 : 300
  const halves = utterance.text.split('~~')
  let body = spanOf(halves[0], utterance.feeling || 'plain')
  if (halves[1]) body += '<break time="250ms"/>' + spanOf(halves[1], utterance.feeling2 || utterance.feeling || 'plain')
  return '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
    + 'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ar-KW">'
    + `<voice name="${VOICE[utterance.speaker] || VOICE.male}">`
    + '<mstts:silence type="Leading-exact" value="30ms"/>'
    + '<mstts:silence type="Tailing-exact" value="50ms"/>'
    + `<mstts:silence type="Sentenceboundary-exact" value="${boundary}ms"/>`
    + body + '</voice></speak>'
}

/* ═══════════ التوليد: حدّ الباقة المجانية عشرون طلباً في الدقيقة ═══════════ */
async function synthesize(utterance, path) {
  /* البصمة تحرس المخزون: إن تغيّر نصُّ الدور أو نبرتُه أُعيد توليد صوته من نفسه،
     فلا يبقى صوتٌ قديمٌ فوق نصٍّ جديد. */
  const body = ssmlOf(utterance)
  const stamp = `${path}.sha`
  const digest = createHash('sha256').update(body).digest('hex')
  if (existsSync(path) && statSync(path).size > 4000
    && existsSync(stamp) && readFileSync(stamp, 'utf8') === digest) return false
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let res
    try {
      res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': KEY,
          'Content-Type': 'application/ssml+xml; charset=utf-8',
          'X-Microsoft-OutputFormat': 'riff-48khz-16bit-mono-pcm',
          'User-Agent': 'dr-alfailakawi-soul-forge',
        },
        body,
      })
    } catch { await sleep(5000); continue }
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 4000) { writeFileSync(path, buf); writeFileSync(stamp, digest); return true }
    } else if (res.status === 429) {
      await sleep(20000)
    } else if (res.status === 401 || res.status === 403) {
      throw new Error(`مفتاح Azure مرفوض (${res.status}) — تحقّق من AZURE_SPEECH_KEY`)
    }
    await sleep(4000)
  }
  throw new Error('تعذّر توليد الدور بعد أربع محاولات')
}

/* ═══════════ الأصول: تُصنع من مكتبة الموسيقى ومن الضجيج ═══════════ */
const musicTracks = () => readdirSync(MUSIC_DIR).filter((f) => f.endsWith('.mp3')).sort()

function cutAsset(source, seconds, target, outPath, fadeOutAt, startAt = 0) {
  if (existsSync(outPath)) return outPath
  /* نقتطع من قلب المقطوعة لا من مطلعها: أوائل المقاطع مدٌّ خافتٌ يصعد،
     فلو أُخذ منها جسرٌ لخرج همهمةً يرفعها المعايِر رفعاً يُبرز الطنين وحده.
     ويُنزع الصمت من مطلع المقطع أولاً: الاقتطاع قد يقع على سكتةٍ بين عبارتين،
     فتُضاف سكتةُ المقطوعة إلى سكتة الوصل فتصير فجوةً ميتة يسمعها السامع. */
  const args = ['-hide_banner', '-loglevel', 'error', '-y']
  if (startAt > 0) args.push('-ss', String(startAt))
  args.push('-t', String(seconds + 2.5), '-i', source,
    '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02:detection=peak,'
      + `atrim=0:${seconds},asetpts=PTS-STARTPTS,`
      + `afade=t=in:st=0:d=0.32,afade=t=out:st=${fadeOutAt}:d=1.4,`
      + `loudnorm=I=${target}:TP=-2:LRA=7,aresample=48000`,
    '-c:a', 'pcm_f32le', outPath)
  sh(FFMPEG, args, 'cut-asset')
  return outPath
}

/* حارس الجسر: يقيس ما يُسمع فعلاً لا ما يُفترض.
   الجسر يُقاس بوسطه الترددي (٣٥٠–٤٠٠٠ هرتز) — وهو نطاق ما تسمعه الأذن لحناً.
   فإن خرج ضعيفاً جُرّب موضعٌ آخر من المقطوعة، ثم مقطوعةٌ أخرى. */
const MID_FLOOR = -24

function midrangeOf(file) {
  const out = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file,
    '-af', 'highpass=f=350,lowpass=f=4000,astats=metadata=0', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stderr || ''
  const m = out.match(/RMS level dB:\s*(-?[\d.]+)/)
  return m ? Number(m[1]) : -99
}

function startsSilent(file) {
  const out = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file,
    '-af', 'silencedetect=noise=-50dB:d=0.25', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).stderr || ''
  const m = out.match(/silence_start:\s*([\d.]+)/)
  return Boolean(m) && Number(m[1]) < 0.1
}

function cutAudibleBridge(candidates, outPath) {
  if (existsSync(outPath)) return outPath
  /* الامتدادان .wav لازمان: ffmpeg يستنتج الحاوية من الامتداد، فاسمٌ بلا امتدادٍ معروف يُفشل الكتابة */
  const stash = `${outPath}.best.wav`
  const probe = `${outPath}.try.wav`
  let bestMid = -99
  for (const candidate of candidates) {
    for (const shift of [0, 17, 34]) {
      try { cutAsset(candidate.file, 5.6, '-16.8', probe, 4.2, candidate.startAt + shift) } catch { continue }
      const mid = midrangeOf(probe)
      if (mid >= MID_FLOOR && !startsSilent(probe)) { renameSync(probe, outPath); return outPath }
      if (mid > bestMid) { bestMid = mid; renameSync(probe, stash) } else { unlinkSync(probe) }
    }
  }
  if (existsSync(stash)) { renameSync(stash, outPath); return outPath }
  throw new Error('تعذّر اقتطاع جسرٍ مسموع من مكتبة الموسيقى')
}

function makeBreath(outPath) {
  if (existsSync(outPath)) return outPath
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', 'anoisesrc=color=pink:duration=0.6:sample_rate=48000:amplitude=0.5',
    '-af', 'highpass=f=450,lowpass=f=2400,highpass=f=450,lowpass=f=2400,'
      + 'afade=t=in:st=0:d=0.30:curve=esin,afade=t=out:st=0.32:d=0.26:curve=esin,volume=-5.5dB',
    '-c:a', 'pcm_f32le', outPath], 'breath')
  return outPath
}

function makeRoomTone(outPath, seconds) {
  if (existsSync(outPath)) return outPath
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
    '-i', `anoisesrc=color=pink:duration=${Math.ceil(seconds)}:sample_rate=48000:amplitude=0.5`,
    '-af', 'highpass=f=100,lowpass=f=3200,volume=-58dB', '-c:a', 'pcm_f32le', outPath], 'roomtone')
  return outPath
}

/* الجسر يُسمع وحده، والفرش يُسمع تحت الكلام — وليسا سواء.
   مكتبة الموسيقى اختيرت أصلاً لتكون فرشاً: طاقتها تبتعد عن نطاق الصوت البشري
   عمداً كي لا تُغبّش كلمات فهد ونورة. وهذا يصلح تحت الحوار ولا يصلح جسراً:
   يخرج طنيناً لا لحناً. فهذه المقطوعات وحدها — المقيسة بوسطٍ تردديٍّ مسموع —
   تصلح للجسور، والبقية تبقى لما خُلقت له. */
const BRIDGE_POOL = [
  'oriental-world.mp3', 'eastern-night.mp3', 'eastern-spell.mp3',
  'cultural-echoes.mp3', 'eastern-tapestry.mp3', 'eastern-elegance.mp3',
]

function bridgesFor(slug, count) {
  const tracks = musicTracks()
  const list = BRIDGE_POOL.filter((t) => tracks.includes(t))
  const pool = list.length ? list : tracks
  const seed = parseInt(createHash('sha256').update(slug).digest('hex').slice(0, 8), 16)
  return Array.from({ length: count }, (_, i) => ({
    file: join(MUSIC_DIR, pool[(seed + i * 3) % pool.length]),
    /* موضع الاقتطاع يختلف بالحلقة أيضاً، فلا يتكرر الجسر نفسه مرتين */
    startAt: 12 + ((seed >> (i * 4)) % 22),
  }))
}

/* ═══════════ التركيب ═══════════ */
function buildVoiceTrack(doc, work) {
  const utterances = doc.utterances
  const bridges = new Set(doc.bridgeAfter || [])
  const breaths = new Set(doc.breathAfter || [])
  const bridgeFiles = bridgesFor(doc.slug, Math.max(1, (doc.bridgeAfter || []).length))
  const breath = makeBreath(join(work, 'breath.wav'))
  const inputs = []
  const parts = []
  const labels = []
  const push = (label) => labels.push(`[${label}]`)
  const silence = (tag, seconds) => {
    parts.push(`aevalsrc=0:d=${seconds}:s=48000,aformat=channel_layouts=mono[${tag}]`)
    push(tag)
  }

  utterances.forEach((_, i) => inputs.push(join(work, `u${String(i).padStart(3, '0')}.trim.wav`)))
  const breathIndex = inputs.length
  inputs.push(breath)
  const bridgeIndexes = bridgeFiles.map((bridge, n) => {
    /* المرشّح الأول جسر الحلقة، ومن بعده بقية الصالحات — فلا تُنتج مقطوعةٌ صامتة جسراً أخرس */
    const rest = BRIDGE_POOL.filter((t) => musicTracks().includes(t))
      .map((t) => ({ file: join(MUSIC_DIR, t), startAt: bridge.startAt }))
      .filter((b) => b.file !== bridge.file)
    const cut = cutAudibleBridge([bridge, ...rest], join(work, `bridge${n}.wav`))
    inputs.push(cut)
    return breathIndex + 1 + n
  })

  utterances.forEach((_, i) => {
    parts.push(`[${i}:a]aformat=channel_layouts=mono:sample_rates=48000[v${i}]`)
    push(`v${i}`)
    if (i === utterances.length - 1) return
    if (bridges.has(i)) {
      const which = [...bridges].indexOf(i) % bridgeIndexes.length
      silence(`sa${i}`, 0.35)
      parts.push(`[${bridgeIndexes[which]}:a]aformat=channel_layouts=mono:sample_rates=48000[m${i}]`)
      push(`m${i}`)
      silence(`sb${i}`, 0.15)
      parts.push(`[${breathIndex}:a]aformat=channel_layouts=mono:sample_rates=48000,acopy[b${i}]`)
      push(`b${i}`)
      silence(`sc${i}`, 0.08)
    } else if (breaths.has(i)) {
      silence(`sa${i}`, 0.20)
      parts.push(`[${breathIndex}:a]aformat=channel_layouts=mono:sample_rates=48000,acopy[b${i}]`)
      push(`b${i}`)
      silence(`sb${i}`, 0.05)
    } else {
      silence(`g${i}`, gapOf(utterances[i].pauseAfterMs).toFixed(2))
    }
  })

  const script = join(work, 'voice.fc')
  writeFileSync(script, `${parts.join(';')};${labels.join('')}concat=n=${labels.length}:v=0:a=1[out]`)
  const voice = join(work, 'voice.wav')
  const args = ['-hide_banner', '-loglevel', 'error', '-y']
  inputs.forEach((file) => args.push('-i', file))
  args.push('-filter_complex_script', script, '-map', '[out]', '-c:a', 'pcm_s16le', voice)
  sh(FFMPEG, args, 'voice-concat')
  return voice
}

function wrapAndMaster(doc, work, voice, outPath) {
  const tracks = musicTracks()
  const signature = cutAsset(join(MUSIC_DIR, tracks.includes('maqam-reflections.mp3') ? 'maqam-reflections.mp3' : tracks[0]),
    4.2, '-16.5', join(work, 'drop.wav'), 2.8)
  const closing = cutAsset(join(MUSIC_DIR, tracks.includes('heritage-echoes.mp3') ? 'heritage-echoes.mp3' : tracks[tracks.length - 1]),
    3.4, '-17', join(work, 'sting.wav'), 1.9)
  const breath = makeBreath(join(work, 'breath.wav'))
  const spoken = durationOf(voice)
  const room = makeRoomTone(join(work, 'room.wav'), spoken + 2)
  const stingAt = Math.round((4.0 + spoken + 0.45) * 1000)
  const total = (4.0 + spoken + 0.45 + 3.4 + 0.3).toFixed(2)
  const pre = join(work, 'premaster.wav')
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y',
    '-i', signature, '-i', breath, '-i', voice, '-i', room, '-i', closing,
    '-filter_complex',
    '[1:a]adelay=3350[br];[2:a]adelay=4000[vo];'
    + `[3:a]atrim=0:${(spoken + 1.2).toFixed(2)},adelay=3600[rt];[4:a]adelay=${stingAt}[st];`
    + '[0:a][br][vo][rt][st]amix=inputs=5:normalize=0:duration=longest,'
    + 'highpass=f=55,acompressor=threshold=-18dB:ratio=1.55:attack=18:release=150,'
    + `atrim=0:${total}[out]`,
    '-map', '[out]', '-c:a', 'pcm_f32le', pre], 'wrap')

  /* الإتقان بقياسين: يقيس أولاً ثم يعاير — فلا يتنفّس المستوى ولا يُقصّ */
  const probe = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', pre,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  const blocks = [...(probe.stderr || '').matchAll(/\{[\s\S]*?"input_i"[\s\S]*?\}/g)]
  const measured = blocks.length ? JSON.parse(blocks.at(-1)[0]) : null
  const filter = measured
    ? `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}`
      + `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}`
      + `:offset=${measured.target_offset}:linear=true,aresample=48000`
    : 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000'
  mkdirSync(OUT_DIR, { recursive: true })
  sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', pre, '-af', filter,
    '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', outPath], 'master')
  return outPath
}

/* ═══════════ فحص الجودة قبل التسليم ═══════════ */
function inspect(file) {
  const out = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', file,
    '-af', 'ebur128=peak=true:framelog=verbose', '-f', 'null', '-'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).stderr || ''
  const tail = out.slice(out.lastIndexOf('Summary:'))
  const lufs = Number((tail.match(/I:\s*(-?[\d.]+)\s*LUFS/) || [])[1])
  const peak = Number((tail.match(/Peak:\s*(-?[\d.]+)\s*dBFS/) || [])[1])
  return { lufs, peak, seconds: durationOf(file) }
}

/* ═══════════ المسار ═══════════ */
async function forge(slug) {
  const soulPath = join(SOUL_DIR, `${slug}.soul.json`)
  if (!existsSync(soulPath)) throw new Error(`لا يوجد نصّ روح للحلقة: ${slug}`)
  const doc = JSON.parse(readFileSync(soulPath, 'utf8'))
  const work = join(WORK, slug)
  mkdirSync(work, { recursive: true })
  let fresh = 0
  for (let i = 0; i < doc.utterances.length; i += 1) {
    const raw = join(work, `u${String(i).padStart(3, '0')}.wav`)
    const trimmed = join(work, `u${String(i).padStart(3, '0')}.trim.wav`)
    const made = await synthesize(doc.utterances[i], raw)
    if (made) fresh += 1
    if (made || !existsSync(trimmed) || statSync(trimmed).size < 4000) {
      /* قصّ الصمت الآلي من الطرفين: الوقفة تُصنع بقصدٍ لا تُترك للمحرك */
      sh(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af',
        'silenceremove=start_periods=1:start_threshold=-44dB:start_silence=0.03:detection=peak,'
        + 'areverse,silenceremove=start_periods=1:start_threshold=-44dB:start_silence=0.05:detection=peak,areverse',
        '-c:a', 'pcm_s16le', trimmed], 'trim')
      if (made) await sleep(3200)
    }
  }
  const voice = buildVoiceTrack(doc, work)
  const outPath = join(OUT_DIR, `${slug}.dialogue.mp3`)
  wrapAndMaster(doc, work, voice, outPath)
  const qa = inspect(outPath)
  const pass = Math.abs(qa.lufs + 16) <= 0.8 && qa.peak <= -1.2
  console.log(`${pass ? '✓' : '⚠'} ${slug} — ${qa.seconds.toFixed(0)}ث · ${qa.lufs} LUFS · ذروة ${qa.peak} · أدوار ${doc.utterances.length} · جديد ${fresh}`)
  return { slug, ...qa, pass, utterances: doc.utterances.length }
}

async function main() {
  if (!KEY) { console.error('✘ AZURE_SPEECH_KEY مفقود'); process.exit(1) }
  const argv = process.argv.slice(2)
  let slugs = argv.filter((a) => !a.startsWith('--'))
  if (argv.includes('--all')) {
    slugs = readdirSync(SOUL_DIR).filter((f) => f.endsWith('.soul.json')).map((f) => f.slice(0, -10)).sort()
  }
  /* الدفعات مرقّمة: الدفعة الأولى أول أربعين، والثانية التي تليها… فلا يُعاد توليدُ ما وُلّد.
     ويُتخطّى كذلك ما وُلّد فعلاً في هذه النسخة من العمل. */
  const numAfter = (flag, fallback) => {
    const at = argv.indexOf(flag)
    return at >= 0 ? Number(argv[at + 1] || fallback) : fallback
  }
  const limit = numAfter('--limit', 0)
  const batch = numAfter('--batch', 0)
  if (batch > 0 && limit > 0) slugs = slugs.slice((batch - 1) * limit, batch * limit)
  else if (limit > 0) slugs = slugs.slice(0, limit)
  if (argv.includes('--skip-done')) slugs = slugs.filter((s) => !existsSync(join(OUT_DIR, `${s}.dialogue.mp3`)))
  if (!slugs.length) { console.error('✘ لم تُحدَّد حلقة'); process.exit(1) }
  mkdirSync(WORK, { recursive: true })
  const results = []
  for (const slug of slugs) {
    try { results.push(await forge(slug)) } catch (error) { console.error(`✘ ${slug}: ${error.message}`) }
  }
  const passed = results.filter((r) => r.pass).length
  console.log(`\nاكتمل: ${passed}/${results.length} اجتازت فحص البثّ`)
  writeFileSync(join(WORK, 'last-run.json'), JSON.stringify(results, null, 1))
  if (process.argv.includes('--clean')) rmSync(WORK, { recursive: true, force: true })
}

main().catch((error) => { console.error('✘', error.message); process.exit(1) })
