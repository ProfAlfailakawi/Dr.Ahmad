#!/usr/bin/env node
/**
 * حلقة مراجعة مقفلة: تستخدم الزوج المعتمد فقط (Sample B الرجل + Sample D المرأة)
 * لإنتاج ملف استماع كامل عند تعطل Gemini أو نفاد رصيده. لا تنشر، لا ترفع إلى R2،
 * ولا تكتب داخل Firebase. هدفها: سماع الإيقاع والنبرة قبل فتح النشر الشامل.
 *
 * مبدأ قبول ثابت: الزمن مؤشر تقني فقط، وليس هدفاً إنتاجياً. لا نضغط الحلقة ولا نمددها
 * لإرضاء رقم معيّن؛ الحاكم الحقيقي هو بشرية الحوار، صحة الفصحى، النفس، والوقفات.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { buildDialogueSsml } from './lib/arabic-audio-engine.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'review-output')
const TMP = resolve(ROOT, '.podcast-review-tmp')
const env = { ...process.env }
if (existsSync(resolve(ROOT, '.env'))) {
  for (const line of readFileSync(resolve(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2')
  }
}

const AZURE_KEY = env.AZURE_SPEECH_KEY
const AZURE_REGION = env.AZURE_SPEECH_REGION || 'uaenorth'
if (!AZURE_KEY) {
  console.error('✘ AZURE_SPEECH_KEY مفقود')
  process.exit(1)
}

const FFMPEG = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg'].find((p) => existsSync(p)) || 'ffmpeg'
const FFPROBE = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe', 'ffprobe'].find((p) => existsSync(p)) || 'ffprobe'
const opt = (name) => (process.argv.find((arg) => arg.startsWith(`--${name}=`)) || '').split('=')[1] || ''
const SLUG = opt('slug') || 'how-do-we-assess-without-breaking-the-human-beingarabic'
const MALE = env.PODCAST_AR_MALE || 'ar-KW-FahedNeural'
const FEMALE = env.PODCAST_AR_FEMALE || 'ar-KW-NouraNeural'
const MALE_NAME = env.PODCAST_AR_MALE_NAME || 'فهد'
const FEMALE_NAME = env.PODCAST_AR_FEMALE_NAME || 'نورة'
const MUSIC = resolve(ROOT, 'music/maqam-reflections.mp3')

const ff = (args) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || `ffmpeg failed: ${args.join(' ')}`)
}
const probeDur = (file) => Number(spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).stdout.trim() || 0)
const hashFile = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

const delivery = {
  hook: { rate: 1, pitch: 1, pause: 260 },
  statement: { rate: 0, pitch: 0, pause: 260 },
  question: { rate: -1, pitch: 2, pause: 640 },
  briefReaction: { rate: 6, pitch: 1, pause: 190 },
  gentleObjection: { rate: 4, pitch: 0.5, pause: 250 },
  clarification: { rate: 0, pitch: 0, pause: 280 },
  reflection: { rate: -6, pitch: -1, pause: 780 },
  conclusion: { rate: -5, pitch: -0.5, pause: 620 },
}

const episode = [
  ['A', 'hook', 'أحياناً لا تؤلم الدرجة لأنها رقم. تؤلم لأنها تصل إلى الطالب كأنها حكم عليه.', 280, 0, false, 'open'],
  ['B', 'question', 'وهل تبدأ المشكلة من الدرجة نفسها، أم من المعنى الذي نضعه فوقها؟', 650, 0, false, 'open'],
  ['A', 'gentleObjection', 'ربما قبل ذلك. تبدأ حين نُقنع الطالب أن الورقة تختصر قيمته كلها.', 250, 0, false, 'open'],
  ['B', 'briefReaction', 'هنا يتغير الأمر.', 180, 90, false, 'neutral'],
  ['A', 'statement', 'فالاختبار في أصله أداة معرفة. نحتاجه لنرى أين نقف، وأين يحتاج التعلم إلى مساعدة.', 290, 0, false, 'neutral'],
  ['B', 'gentleObjection', 'لكن حين يتحول إلى تهديد، يفقد وظيفته الأولى. لا يعود يقيس التعلم، بل يقيس الخوف.', 270, 0, false, 'open'],
  ['A', 'briefReaction', 'هذه نقطة دقيقة.', 190, 0, false, 'neutral'],
  ['B', 'statement', 'لأن الطالب لا يرى الرقم وحده. يرى معه نظرة المعلم، وتوقع الأسرة، وصورته عن نفسه.', 300, 0, false, 'neutral'],
  ['A', 'question', 'إذاً، كيف نَقيس دون أن نحطم هذه الصورة؟', 660, 0, false, 'open'],
  ['B', 'clarification', 'نبدأ من الفرق بين الأداء والقيمة. قد يخطئ الطالب في مسألة، لكن هذا لا يجعله أقل شأناً.', 290, 0, false, 'open'],
  ['A', 'statement', 'والتعلم الحقيقي يحتاج إلى هذا الأمان. الطالب لا يجرب إذا كان كل خطأ سيطارده.', 280, 0, false, 'neutral'],
  ['B', 'briefReaction', 'ولا يغامر أيضاً.', 180, 80, false, 'neutral'],
  ['A', 'gentleObjection', 'لكنني لا أريد إلغاء القياس. هذا هروب من المشكلة، لا حل لها.', 250, 0, false, 'open'],
  ['B', 'clarification', 'صحيح. المطلوب أن نعيد القياس إلى حجمه الطبيعي: دليل يساعدنا، لا سلاح يربك المتعلم.', 300, 0, false, 'neutral'],
  ['A', 'reflection', 'هناك فرق كبير بين أن أقول للطالب: أخطأت هنا، وبين أن أوحي له بأنه فشل كامل.', 820, 0, true, 'final'],
  ['B', 'question', 'وهل يدرك المعلم دائماً أن كلمته قد تكون أثقل من الدرجة نفسها؟', 620, 0, false, 'open'],
  ['A', 'statement', 'ليس دائماً. ولهذا يحتاج التقييم إلى لغة تربوية، لا إلى لغة محكمة تصدر أحكاماً.', 270, 0, false, 'neutral'],
  ['B', 'briefReaction', 'لغة تفتح الباب.', 180, 90, false, 'open'],
  ['A', 'briefReaction', 'ولا تغلقه.', 190, 0, false, 'neutral'],
  ['B', 'clarification', 'حين يعرف الطالب أن الخطأ جزء من الطريق، يتعامل مع الدرجة بوصفها إشارة، لا نهاية.', 290, 0, false, 'neutral'],
  ['A', 'gentleObjection', 'لكن هناك زاوية أخرى. بعض الطلبة لا يخافون من الاختبار فقط، بل من الصورة التي تأتي بعده.', 280, 0, false, 'open'],
  ['B', 'statement', 'صورة الطالب المتفوق، والطالب الضعيف، والطالب الذي يحتاج دائماً إلى إنقاذ. هذه التصنيفات تلتصق بسرعة.', 300, 0, false, 'neutral'],
  ['A', 'question', 'فكيف نمنع الدرجة من أن تتحول إلى اسم دائم؟', 610, 0, false, 'open'],
  ['B', 'clarification', 'بأن نربطها بالفعل لا بالهوية. نقول: هذا الأداء يحتاج تدريباً، لا نقول: أنت طالب فاشل.', 300, 0, false, 'neutral'],
  ['A', 'briefReaction', 'فرق صغير.', 170, 0, false, 'neutral'],
  ['B', 'briefReaction', 'وأثره كبير.', 210, 0, false, 'neutral'],
  ['A', 'statement', 'اللغة هنا ليست تزييناً. هي جزء من عدالة التقييم. كلمة واحدة قد تجعل الطالب ينهض أو ينسحب.', 310, 0, false, 'neutral'],
  ['B', 'gentleObjection', 'ومع ذلك، لا يكفي أن نلطف العبارة. يجب أن يكون القياس نفسه واضحاً ومنصفاً.', 260, 0, false, 'open'],
  ['A', 'clarification', 'نعم. معيار واضح، فرصة للتغذية الراجعة، وحق في المحاولة من جديد. هكذا تصبح الدرجة بداية حوار.', 300, 0, false, 'neutral'],
  ['B', 'question', 'وهل يملك النظام المدرسي وقتاً لهذا الحوار؟', 620, 0, false, 'open'],
  ['A', 'gentleObjection', 'قد لا يملكه كاملاً. لكن السؤال: هل نملك رفاهية أن نترك الطالب وحده أمام رقم صامت؟', 310, 0, false, 'open'],
  ['B', 'reflection', 'الرقم الصامت قاسٍ، لأنه لا يشرح. لا يقول للطالب أين تعثر، ولا كيف يعود.', 780, 0, false, 'final'],
  ['A', 'statement', 'وهنا تصبح التغذية الراجعة قلب العملية. ليست هامشاً بعد الاختبار، بل هي الجسر بين القياس والتعلم.', 300, 0, false, 'neutral'],
  ['B', 'clarification', 'حين يسمع الطالب: هذه نقطة تحتاج مراجعة، وهذه نقطة أتقنتها، يبدأ في رؤية نفسه بصورة أكثر عدلاً.', 300, 0, false, 'neutral'],
  ['A', 'briefReaction', 'وتعود الثقة.', 190, 0, false, 'neutral'],
  ['B', 'gentleObjection', 'لكن الثقة لا تعني المجاملة. تعني أن نقول الحقيقة بطريقة لا تكسر الإنسان.', 270, 0, false, 'open'],
  ['A', 'statement', 'وهذا هو جوهر الفكرة. لسنا ضد الاختبار، ولسنا ضد الدرجة. نحن ضد أن تصبح الدرجة آخر الكلام.', 300, 0, false, 'neutral'],
  ['B', 'question', 'وربما السؤال الأعمق: ماذا يتعلم الطالب عن نفسه بعد كل اختبار؟', 680, 0, false, 'open'],
  ['A', 'reflection', 'إن تعلم أن قيمته أكبر من ورقة، صار الاختبار محطة. وإن تعلم أنه هو الورقة، صار الاختبار خوفاً متكرراً.', 850, 0, true, 'final'],
  ['B', 'conclusion', 'لذلك نقيس، لكن برفق. نراجع، لكن بعدل. ونعلّم الطالب أن الخطأ لا يلغي الإنسان.', 620, 0, false, 'final'],
  ['A', 'conclusion', 'عندها لا يكون التقييم باباً للانكسار، بل فرصة لفهم أعمق، وتعلم أشجع، وإنسان أكثر اتزاناً.', 0, 0, false, 'final'],
].map(([speaker, type, text, pauseAfterMs, overlapMs, musicBridgeAfter, ending]) => ({
  speaker, type, text, pauseAfterMs, overlapMs, musicBridgeAfter, ending,
}))

function ssmlFor(item) {
  const isMale = item.speaker === 'A'
  return buildDialogueSsml({ ...item, delivery: item.type }, isMale ? MALE : FEMALE,
    { voiceKey: isMale ? 'fahed' : 'noura' })
}

async function synth(item, outPath) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'alfailakawi-final-review',
      },
      body: ssmlFor(item),
    }).catch(() => null)
    if (res?.ok) {
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 4000) {
        writeFileSync(outPath, buf)
        const trimmed = `${outPath}.trim.wav`
        ff(['-i', outPath, '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_duration=0.06:start_threshold=-42dB,areverse', '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', trimmed])
        rmSync(outPath, { force: true })
        writeFileSync(outPath, readFileSync(trimmed))
        rmSync(trimmed, { force: true })
        return
      }
    }
    await new Promise((r) => setTimeout(r, 1200 * attempt))
  }
  throw new Error(`فشل Azure TTS للمداخلة: ${item.text.slice(0, 40)}`)
}

function musicClip(name, duration, volume) {
  const out = resolve(TMP, `${name}.wav`)
  if (!existsSync(MUSIC)) return null
  ff(['-i', MUSIC, '-t', String(duration), '-af', `afade=t=in:d=0.35,afade=t=out:st=${Math.max(0.4, duration - 0.7)}:d=0.7,volume=${volume}`, '-ar', '24000', '-ac', '1', '-c:a', 'pcm_s16le', out])
  return out
}

function assemble(voiceFiles, outMp3) {
  const timeline = []
  let cursor = 4.15
  const intro = musicClip('intro', 4.8, 0.08)
  if (intro) timeline.push({ file: intro, start: 0, kind: 'music' })
  let bridgeNo = 0
  for (let i = 0; i < voiceFiles.length; i++) {
    const item = episode[i]
    const dur = probeDur(voiceFiles[i])
    const overlap = Number(item.overlapMs || 0) / 1000
    const start = Math.max(0, cursor - overlap)
    timeline.push({ file: voiceFiles[i], start, kind: 'voice', speaker: item.speaker, text: item.text })
    cursor = start + dur + Number(item.pauseAfterMs || 250) / 1000
    if (item.musicBridgeAfter && bridgeNo < 2) {
      const bridge = musicClip(`bridge-${bridgeNo + 1}`, bridgeNo === 0 ? 1.8 : 1.35, bridgeNo === 0 ? 0.085 : 0.065)
      if (bridge) {
        const bridgeStart = start + dur - 0.42
        timeline.push({ file: bridge, start: bridgeStart, kind: 'bridge' })
        cursor = Math.max(cursor, bridgeStart + (bridgeNo === 0 ? 1.25 : 1.0))
        bridgeNo++
      }
    }
  }
  const outro = musicClip('outro', 7.2, 0.07)
  if (outro) timeline.push({ file: outro, start: cursor + 0.18, kind: 'music' })
  const total = Math.max(...timeline.map((t) => t.start + probeDur(t.file))) + 0.35
  const inputs = []
  const filters = []
  timeline.forEach((t, i) => {
    inputs.push('-i', t.file)
    const delay = Math.round(t.start * 1000)
    filters.push(`[${i}:a]adelay=${delay}|${delay}[a${i}]`)
  })
  filters.push(`${timeline.map((_, i) => `[a${i}]`).join('')}amix=inputs=${timeline.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`)
  ff([...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-t', total.toFixed(2), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', outMp3])
  return { total, bridgeCount: bridgeNo, timeline }
}

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync(OUT, { recursive: true })

const voiceFiles = []
for (let i = 0; i < episode.length; i++) {
  const file = resolve(TMP, `u${String(i + 1).padStart(2, '0')}.wav`)
  process.stdout.write(`🎙 ${i + 1}/${episode.length}\r`)
  await synth(episode[i], file)
  voiceFiles.push(file)
}
console.log('')

const outMp3 = resolve(OUT, `${SLUG}.sample-b-sample-d.dialogue.mp3`)
const outJson = resolve(OUT, `${SLUG}.sample-b-sample-d.dialogue.json`)
const outAudit = resolve(OUT, `${SLUG}.sample-b-sample-d.audit.json`)
const assembled = assemble(voiceFiles, outMp3)
const words = episode.reduce((n, item) => n + item.text.split(/\s+/).filter(Boolean).length, 0)
const transcript = {
  title: 'كيف نقيس دون أن نكسر الإنسان',
  generatedAt: new Date().toISOString(),
  mode: 'locked-review-only',
  voices: { male: MALE, female: FEMALE, maleName: MALE_NAME, femaleName: FEMALE_NAME },
  utterances: episode.map((item) => ({ speaker: item.speaker === 'A' ? MALE_NAME : FEMALE_NAME, text: item.text })),
}
writeFileSync(outJson, JSON.stringify(transcript, null, 2))
writeFileSync(outAudit, JSON.stringify({
  generatedAt: transcript.generatedAt,
  status: 'review_only_not_published',
  reason: 'Quality-first human listening review; duration is diagnostic only and automatic publishing remains disabled.',
  words,
  durationSec: +assembled.total.toFixed(1),
  averageWordsPerMinute: Math.round(words * 60 / Math.max(1, assembled.total - 9)),
  musicBridges: assembled.bridgeCount,
  bytes: statSync(outMp3).size,
  sha256: hashFile(outMp3),
  voices: transcript.voices,
}, null, 2))
rmSync(TMP, { recursive: true, force: true })
console.log(`✅ حلقة مراجعة فقط: ${outMp3}`)
