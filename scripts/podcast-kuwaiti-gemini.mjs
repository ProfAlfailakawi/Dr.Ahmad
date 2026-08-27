#!/usr/bin/env node
/**
 * «مجلس الفكرة — كويتي»
 * يولّد نسخة كويتية مستقلة عبر Gemini 2.5 Pro TTS Multi-speaker.
 * لا يقرأ manual-dialogues ولا يكتب .dialogue.mp3؛ الفصحى تبقى منفصلة بالكامل.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { normalizeManualDialogueTurns } from './lib/manual-dialogue-source.mjs'
import { buildPronunciationMap, toSpokenKuwaiti, buildForeignRedactions, redactForeignNames } from './lib/kuwaiti-pronunciation.mjs'
import { conversationFamilyForSlug } from './lib/kuwaiti-dialogue-variety.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-kw-tmp')
const AUDITS = resolve(ROOT, 'podcast-audits', 'kuwaiti')
const STATE = resolve(ROOT, '.podcast-state.json')
const VERTEX_PROJECT = String(process.env.PODCAST_KW_VERTEX_PROJECT || '').trim()
const VERTEX_LOCATION = String(process.env.PODCAST_KW_VERTEX_LOCATION || 'us-central1').trim()
const USE_VERTEX = Boolean(VERTEX_PROJECT)
const API = USE_VERTEX
  ? `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1beta1/projects/${encodeURIComponent(VERTEX_PROJECT)}/locations/${encodeURIComponent(VERTEX_LOCATION)}/publishers/google/models`
  : 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-preview-tts'
/* اعتماد الدكتور ١٤ أغسطس ٢٠٢٦ بعد سماع الجولة الثالثة: المقطع ٥ —
   فهد Puck («الرجل ممتاز») ونورة Despina. سُمع ضعفٌ في لكنة Despina وبقيت
   «الورقه» إماراتيةً في سطرها وحده بينما صمدت في سطر Puck بالإملاء نفسه —
   فالعلّة قدرة الصوت لا الإملاء. إن لم تستقم في الحلقة الكاملة فالبديل
   الجاهز Callirrhoe (أنثى المقطع ٤)، والتبديل بلا كود:
   GEMINI_TTS_FEMALE_VOICE=Callirrhoe.
   [٢٠ أغسطس ٢٠٢٦] صار الافتراض Zephyr بحكمه سماعاً على البيك أوف الثالث
   («روعه» — وهو أرفع ثنائه في المشروع كله)، ووافقه القياس: أحد زوجين
   وحيدين بقيت فجوتهما موجبةً في القياسات الثلاث (وسيط ١٥ · المدى ١٢..٢٣).
   وCallirrhoe كانت تقع تحت Puck فتنقلب الفجوة — وهو سبب «صوت واحد بس». */
const MALE_VOICE = process.env.GEMINI_TTS_MALE_VOICE || 'Puck'
/* فُعِّل البديل (١٦ أغسطس): فجوة الحنجرتين مع Despina انهارت عبر التشغيلات
   ٣٤ ← ٢٧ ← ٢٢ ← ٨ ← ٧ هرتزاً، فسمعهما الدكتور «صوت واحد بس». وشكواه
   الأولى عن لكنتها (١٤ أغسطس: «لكنتها غير جيدة») تأكّدت بالقياس. فتُعتمد
   Callirrhoe — أنثى المقطع ٤ التي بقيت في تصفيته النهائية. */
const FEMALE_VOICE = process.env.GEMINI_TTS_FEMALE_VOICE || 'Zephyr'
/* المساران المنفصلان منعا تبديل preset، لكن Vertex اضطر أن يحذف منهما كلام
   الطرف الآخر: صارت نورة تقول 14 فقرة وراء بعض وفهد 13، ثم رُكّبا بالتبادل.
   حكم الدكتور على الناتج: نفس preset تقريباً، لكن مو نفس الإنسان بعد
   الثلثين، ونورة مالت للخليجي العام. لذلك الإنتاج يعود إلى **حوار حقيقي
   واحد**؛ المساران يبقيان مختبراً صريحاً فقط ولا يجوز أن يكونا fallback. */
const ISOLATE_SPEAKER_STEMS = process.env.PODCAST_KW_ISOLATE_SPEAKER_STEMS === '1'
const PROFILE = process.env.PODCAST_KW_PROFILE || 'kuwaiti-urban-soft-v2'
const GENERATION_MODE = String(process.env.PODCAST_KW_GENERATION_MODE || 'pilot').trim().toLowerCase()
const PILOT_SLUG = String(process.env.PODCAST_KW_PILOT_SLUG || 'success-that-does-not-bring-joy-to-its-ownerarabic').trim()
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const args = process.argv.slice(2)
const SELF_TEST = args.includes('--self-test')
const DRY_RUN = args.includes('--dry-run')
const slug = (args.find((item) => item.startsWith('--slug=')) || '').slice(7)
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
/* PODCAST_KW_BRIDGE يثبّت المقطوعة يدوياً إن أردت؛ وإلا اختيرت لكل حلقةٍ
   نغمتُها من المكتبة (انظر pickEpisodeMusic أدناه). */
const MUSIC_OVERRIDE = process.env.PODCAST_KW_BRIDGE || ''
const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe'
/* [٢٧ أغسطس ٢٠٢٦] حدود الأدوار لم تعد تُخمَّن من طول النص والصمت وحدهما.
   Gemini 3.5 Transcribe يعطي كل كلمة وقتها وهوية المتحدث؛ نطابق الكلمات
   بالنص المنطوق ثم نقص عند الفراغ الحقيقي بينها. بهذه الشهادة المستقلة لا
   تُحسب آخر كلمة من فهد على نورة، ولا تتحول غلطة قص إلى Voice Drift كاذب. */
const ALIGNMENT_MODE = String(process.env.PODCAST_KW_TRANSCRIPT_ALIGNMENT || 'off').trim().toLowerCase()
const TRANSCRIBE_MODEL = String(process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe').trim()
const REJECT_DIR = String(process.env.PODCAST_KW_REJECT_DIR || '').trim()

/* ═══ عقد الخروج من المحرك ═══
   رفض الجودة ليس عطل مزوّد، وعطل المزوّد المؤقت ليس نفاد رصيد. كانت الحالات
   الثلاث تخرج بالرمز 1 نفسه؛ لذلك كان خطأ Gemini داخلي مؤقت يقتل التشغيلة
   قبل تجربة البذرة التالية، ومع 143 حلقة يصير هذا إسقاطاً عشوائياً للطابور.

   3  = Take مولّد لكنه مرفوض جودةً (هوية/رنين/زمن)؛ جرّب بذرة جديدة.
   75 = عطل Gemini مؤقت؛ أعد **البذرة نفسها** ولا تخصمه من محاولات الجودة.
   78 = الرصيد منتهٍ؛ أوقف الصرف واحفظ الطابور كما هو.
   1  = عطب حقيقي في النص أو الإعداد أو الشيفرة؛ لا تخفه بإعادة عمياء. */
export function geminiFailureExitCode (error) {
  const message = String(error?.stack || error?.message || error || '')
  if (/نفد رصيد Gemini|prepayment credits are depleted|credits.*depleted|billing/i.test(message)) return 78
  if (/internal error|please retry|temporar(?:y|ily)|service unavailable|resource exhausted|too many requests|HTTP\s*(?:429|5\d\d)|\b429\b|AbortError|aborted|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network error/i.test(message)) return 75
  return 1
}

let terminatingFromUnhandledFailure = false
function terminateFromUnhandledFailure (error) {
  if (terminatingFromUnhandledFailure) return
  terminatingFromUnhandledFailure = true
  const code = geminiFailureExitCode(error)
  const label = code === 75 ? 'GEMINI_TRANSIENT' : code === 78 ? 'GEMINI_CREDIT_BLOCKED' : 'GENERATOR_FATAL'
  console.error(`⛔ ${label}: ${String(error?.message || error || 'خطأ غير معروف')}`)
  process.exit(code)
}
process.on('uncaughtException', terminateFromUnhandledFailure)
process.on('unhandledRejection', terminateFromUnhandledFailure)

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

/* كم مداخلةً في الطلب الواحد؟ هذا هو مقبض علّة «تغيّر صوت المذيع فجأة».
   كل طلبٍ إلى Gemini مستقلٌّ تماماً: النموذج لا يسمع ما ولّده قبله، فيعيد
   بناء نبرة فهد ونورة من الصفر في كل مرّة. بمداخلةٍ واحدةٍ للطلب صار في
   الحلقة سبعةٌ وثلاثون حدّاً، وعند كل حدٍّ فرصةُ انزلاق — ولهذا يُسمع التبدّل
   واضحاً. أربع مداخلاتٍ في الطلب تُنزل الحدود إلى تسعةٍ أو عشرة، والنموذج
   متعدّد المتحدثين مصمَّمٌ أصلاً ليؤدّي حواراً كاملاً في نداءٍ واحد فيحفظ
   النبرة داخله. (وتوفّر الحصة أيضاً: ٣٧ طلباً تصير ١٠.) */
/* ═══ نداءٌ واحدٌ للحلقة كلها ═══
   أثقلُ شكوى سمعها الدكتور بعد كل إصلاحٍ آخر: «الصوت عندي تبدّل بين ٤ إلى ٥
   مرات… وأول صوت كان جداً جداً جميل وأقرب للواقع». والسبب أن كلَّ نداءٍ
   يُخرج نبرةً مختلفةً قليلاً للحنجرة نفسها — فثلاثة عشر نداءً تعني ثلاث عشرة
   نبرة. وتضييقي الدفعةَ من ثمانية إلى ثلاثة (علاجاً للاسترسال) ضاعف العلّة
   من خمس نبراتٍ إلى ثلاث عشرة: صلّحتُ عيباً فأفسدتُ ما هو أثمن منه.
   والحلقة كلها ٢٦١٠ حرفاً — تدخل في نداءٍ واحدٍ تحت سقف ٤٣٠٠. فنداءٌ واحد
   يعني نبرةً واحدةً من أول الحلقة إلى آخرها: صفر تبدّل، وبنبرة النداء الأول
   التي وصفها بأنها «معدومة الأخطاء».
   والدور المفرد يبقى ممنوعاً (الفحص الذاتي أدناه يبرهن أنه يعيد تبدّل الصوت)،
   لكنه لم يعد مطلوباً أصلاً. */
/* أطول حلقة كاملة حالية 74 مداخلة/3176 حرفاً: كانت تنشطر عند سقف 64 بلا
   سبب رغم دخول نصها بأمان تحت 4300 حرف. السقف 96 يجعل كل الحلقات الحالية
   Take واحداً، ويبقي التقسيم المتداخل للحلقات المستقبلية الأطول فعلاً. */
const TURNS_PER_REQUEST = Math.max(2, Math.min(96, Number(process.env.PODCAST_KW_TURNS_PER_REQUEST || 96)))

/* ═══ الحوار Take واحد، والجسر مونتاج فقط (٢٤ أغسطس ٢٠٢٦) ═══
   التدقيق السمعي وتشغيلة 32754682989 أثبتا أن القطع عند الجسر صنع ثلاثة
   طلبات Gemini مستقلة. الـvoice preset بقي نفسه، لكن كل طلب أعاد تفسير
   الجرس ومركز النبرة والمدّ واللهجة؛ فصار Voice/Accent Reset بعد الجسر.
   لذلك هذا قفل أمان لا إعداد: لا موسيقى ولا خانة تحرير تقطع طلب الـTTS.
   الحوار يولَّد متصلاً أولاً، ثم تُضاف الجسور من التسجيل نفسه في المونتاج. */
const SPLIT_AT_BRIDGES = false
/* Gemini يولّد الأخذ والردّ داخل النداء نفسه بتوقيتٍ عضوي. النسخة السابقة
   قصّت الصمت الطبيعي من طرفَي **كل دور** ثم أعادت بناء الحلقة بسبع وقفات
   ثابتة وoverlap مفروض؛ أي إنها ألغت بعد التوليد ما طلبه البرومت منه.
   الافتراض الجديد يحفظ زمن النداء كما وُلد. المفتاح 0 للمقارنة التاريخية
   فقط، ولا يُستعمل في الإنتاج الطبيعي. */
const PRESERVE_NATIVE_TURN_TIMING = process.env.PODCAST_KW_PRESERVE_NATIVE_TIMING !== '0'
/* نحفظ التوقيت العضوي، لكن القياس السمعي الثاني وجد 53–63 وقفة فوق ربع
   ثانية ومتوسطاً يقارب 0.60ث: لم تعد المشكلة في وقفة شاذة، بل في تكرار
   الوقفة النظيفة نفسها. نضغط ما يتجاوز 0.44ث إلى 0.30ث، ونترك الأنفاس
   الأقصر كما وُلدت. والـoverlap المصرّح به على الردود الخاطفة يرجع 70ms
   فقط؛ دخول أسرع من غير مقاطعة مسموعة أو إعادة بناء جدول ميكانيكي. */
const MAX_INTERNAL_SILENCE_MS = Math.max(220, Math.min(900, Number(process.env.PODCAST_KW_MAX_INTERNAL_SILENCE_MS || 300)))
const LONG_SILENCE_TRIGGER_MS = Math.max(MAX_INTERNAL_SILENCE_MS + 80,
  Math.min(1400, Number(process.env.PODCAST_KW_LONG_SILENCE_TRIGGER_MS || 440)))
const silenceCompaction = { calls: 0, removedSec: 0 }
const splitAlignmentAudits = []
const generatedTakeSources = []

function preserveRejectedTake (reason, details = {}) {
  if (!REJECT_DIR || !generatedTakeSources.length) return
  const directory = resolve(ROOT, REJECT_DIR)
  mkdirSync(directory, { recursive: true })
  const base = `${slug || 'unknown'}-seed-${SEED || 'none'}`
  const audio = resolve(directory, `${base}.dry.mp3`)
  const source = generatedTakeSources[0]?.file
  if (source && existsSync(source)) {
    spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',source,
      '-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','128k',audio], { encoding: 'utf8' })
  }
  writeFileSync(resolve(directory, `${base}.rejection.json`), `${JSON.stringify({
    schemaVersion: 1, slug, seed: SEED, model: MODEL, voices: { male: MALE_VOICE, female: FEMALE_VOICE },
    reason, details, alignment: splitAlignmentAudits, dryAudio: existsSync(audio) ? `${base}.dry.mp3` : null,
    generatedAt: new Date().toISOString(),
  }, null, 2)}\n`)
  console.error(`🧪 حُفظ الـTake المرفوض وتقريره للسماع: ${REJECT_DIR}/${base}.dry.mp3`)
}

function rejectTake (reason, details = {}) {
  preserveRejectedTake(reason, details)
  console.error(reason)
  process.exit(3)
}

/* ملف الحوار يحمل أحياناً سطرين أو أربعة متتالية للشخص نفسه. هذه وحدات
   تحريرية وليست تبادل أدوار مسموعاً: Gemini يقولها بنفس النفس، وماكو حد
   صوتي صادق يسمح بقصها إلى ملفات منفصلة. محاولة فرض حد لكل سطر صنعت
   مقاطع قصيرة كاذبة، ثم اتهمت بوابات الزمن والطبقة الصوت بالانزلاق.

   وحدة TTS والقياس هي لذلك «المداخلة المسموعة»: كلام متصل للشخص نفسه إلى
   أن يتغير المتحدث أو يأتي جسر المونتاج. الكلمات وترتيبها لا يتغيران. */
export function audibleSpeakerRuns (inputTurns = []) {
  const runs = []
  for (const sourceTurn of inputTurns) {
    const turn = { ...sourceTurn }
    const previous = runs[runs.length - 1]
    if (previous && previous.speaker === turn.speaker && !previous.musicBridgeAfter) {
      previous.text = `${String(previous.text || '').trim()} ${String(turn.text || '').trim()}`.trim()
      previous.pauseAfterMs = turn.pauseAfterMs
      previous.musicBridgeAfter = Boolean(turn.musicBridgeAfter)
      previous._sourceTurnCount += 1
      if (turn.deliveryType === 'conclusion') previous.deliveryType = 'conclusion'
      continue
    }
    runs.push({ ...turn, _sourceTurnCount: 1 })
  }
  return runs
}

function chunkTurns(turns, { maxTurns = TURNS_PER_REQUEST, maxChars = 4300 } = {}) {
  const chunks = []
  let row = []
  let chars = 0
  for (const turn of turns) {
    const nextChars = chars + turn.text.length
    if (row.length && (row.length >= maxTurns || nextChars > maxChars)) {
      chunks.push(row); row = []; chars = 0
    }
    row.push(turn); chars += turn.text.length
    /* musicBridgeAfter معلومة مونتاج لا تحمل أي معنى صوتي لـGemini. وحدهما
       سقف النص/المداخلات قد يفرضان طلباً جديداً، وعندها نستخدم الإحماء. */
  }
  if (row.length) chunks.push(row)
  return chunks
}

/* قفل اللهجة يركب كل دورٍ — الانزلاق يقع عند حدود الأدوار والدفعات، فتحذيرٌ
   واحدٌ في رأس الطلب لا يحرس آخره. وقبل هذا كانت أدوار الـstatement — وهي
   أكثر الحلقة — تسافر بلا أي تاجٍ أصلاً. (أمر الدكتور ١٤ أغسطس ٢٠٢٦:
   «تحذير صارم جداً — لا إماراتي ولا عراقي ولا إيراني ولا سعودي ولا شامي
   ولا مصري».) */
/* القفل صار أصرح بعد سماع الدكتور (١٥ أغسطس): «اللكنة كانت أمس أقوى… كويتي
   بحت ١٠٠٠٠٠٪ — أتكلم عن اللكنة لا اللهجة». وسببُ الضعف أن النداء الواحد
   يُبعِد تعليماتِ الرأس عن أواخر الأدوار، بينما كانت تتكرّر ثلاث عشرة مرّةً
   حين كانت الدفعات ثلاث عشرة. فيثقُل تاجُ الدور نفسه ليحمل الأمر كاملاً. */
/* «احنا ما نفخم ترى الكلمات… احنا دايم نرقق» — حكمه ١٥ أغسطس، وهو أثمن
   مفتاحٍ في المشروع. كان القفل يطلب الغِلَظ فيُخرج تفخيماً
   بدوياً؛ والكويتية الحضرية مرقَّقةٌ خفيفة. */
/* [٢١ أغسطس ٢٠٢٦ — متغيّر الجولة الوحيد] حكم الدكتور على حلقة إصلاح الموسيقى:
   «بعد دقيقة مرات كويتي ومرات اماراتي… تغير الصوت وتغير الأسلوب وتحول اماراتي».
   رأس الطلب يحرّم الإماراتي بالاسم، لكن التاج الذي يركب كل دورٍ — وهو ما يبقى
   حيّاً حين تبتعد تعليمات الرأس — لم يسمِّه قط. والانجراف المسموع إماراتيٌّ
   تحديداً لا غيره، فالاسم يُثبَّت حيث يقع الانزلاق: على الدور نفسه. */
const KW_LOCK = 'light, soft Kuwait-City Kuwaiti — never heavy, never emphatic, never Emirati'
/* ═══ وضع البرومت الأدنى — تجربة صديق الدكتور (٢٢ أغسطس ٢٠٢٦) ═══
   فرضيته: «كل ما زدت القيود تتعب» مع Gemini — وهي وجيهة بميزانَي هندسة
   الأوامر: (١) فخ الفيل الوردي: تعداد اللهجات المحرمة بالاسم (نجدي،
   حجازي، إماراتي…) يزرعها في سياق المحرك — و«نجدي جدة» الذي سمعه الدكتور
   الليلة قد يكون من الجدار نفسه؛ (٢) تخفيف التعليمات يركز وزنها.
   الوضع الأدنى: رأسٌ إيجابي قصير بلا اسم أي لهجة أجنبية، بلا تذكيرات،
   وتيجانُ الأداء بلا نص القفل. طبقة النص (المعجم بأحكامه العشرين) لا
   تتأثر — تعمل في الوضعين. متغير تجربة واحد يُفعَّل بـ
   PODCAST_KW_PROMPT_MODE=minimal. وبعد التجربة المعماة صار C هو الافتراض. */
/* [٢٢ أغسطس ٢٠٢٦ — حكم تجربة التسعة المعمّاة] الافتراض صار C:
   ٣ برومتات × ٣ بذور، وحكم الدكتور بأذنه على المعمّى:
     c       → «روعة · روعة · جميل»  (٣/٣ بلا سقطة)  ← الفائز
     minimal → «الأفضل» مرة، وحساوي وبحريني مرتين     (يانصيب)
     full    → سعودي وبحريني وضعيف                    (٠/٣)
   وأثمن قرينة: «ظيّج» نُطقت «ضيق» في ذراع full وحده — لأن جدار القواعد
   يدفع المحرك لتصحيح الإملاء غير المألوف إلى الفصحى، بينما سطر C
   («النص يحمل الإملاء المقصود، اتبعه بطبيعية») يجعله يحترمه.
   وضع full يبقى متاحاً للمقارنة التاريخية لا للإنتاج. */
const PROMPT_MODE = ['minimal','c','full'].includes(process.env.PODCAST_KW_PROMPT_MODE) ? process.env.PODCAST_KW_PROMPT_MODE : 'c'
const SEED = Number.isInteger(Number(process.env.PODCAST_KW_SEED)) && Number(process.env.PODCAST_KW_SEED) > 0 ? Number(process.env.PODCAST_KW_SEED) : null
const MINIMAL_HEAD = `كويتي حضري من أهل مدينة الكويت، خفيف في الفم — يرققون الكلام وما يفخمون، ونهاية الجملة تنزل هادئة.
اثنان من أهل الكويت يتسولفون في ديوانية بكل طبيعية ودفء وحيوية، مهتمان بما يقولان: فهد رجل هادئ دافئ عارف، ونورة امرأة ذكية فضولية غير مسرحية.
تجنب ولا تستخدم: سوري، شامي، مصري، عراقي، إيراني، إماراتي، عماني، سعودي بكل تفاصيله (نجدي، حساوي، حجازي)، ولا أي خليجي عام.
اقرأ كل سطر كما هو مكتوب حرفاً بحرف.`
const MINIMAL_TAIL = 'نفس الصوتين ونفس لسان مدينة الكويت، من أول سطر إلى آخر سطر.'

/* البرومت C — الفائز ٣/٣ في التجربة المعماة، ثم نُقّح في ٢٤ أغسطس ٢٠٢٦
   بعقد MASTER VOICE DIRECTOR. بقي إيجابياً ومركّزاً، لكن الهوية صارت تُبنى
   من الإيقاع والحركات ولحن الجملة لا من استعراض حرفٍ واحد. ونُزعت منه
   الأوامر التي كانت تعطي كل جملة وزناً تمثيلياً أو تفرض قافاً ميكانيكية. */
const PROMPT_C_HEAD = `Synthesize speech from the TRANSCRIPT section only.
Do not speak headings, instructions, or bracketed performance tags.

# SINGLE-SESSION ACOUSTIC CONTINUITY — ABSOLUTE PRIORITY

This entire transcript is one uninterrupted recording session. There are no chapters, segments, transitions, scene changes, or resets. Formatting and topic movement carry no acoustic meaning.

Speaker identity is immutable. Preserve for each speaker from the first word to the last the exact same vocal age, timbre, pitch center, resonance, vocal weight, energy baseline, vowel system, sentence melody, Urban Kuwait City cadence, and conversational personality.

Do not reinterpret either speaker after paragraph boundaries, topic changes, long pauses, research material, emotional changes, or formatting changes. Never restart the accent, character, prosody, or vocal placement.

Later speech must not merely use the same preset voice. It must feel like the exact same human being continuing the same conversation seconds later.

The opening 20 seconds establish the permanent acoustic reference for both speakers. For the entire remainder of the recording, preserve those exact speaker identities, pitch centers, vocal weights, vowel timing, sentence-ending behavior, and Urban Kuwait City cadence. Never reinterpret either speaker later in the take.

# NOURA — IMMUTABLE KUWAIT CITY PROSODY

Noura's earliest utterances permanently define her acoustic and dialect reference. Every later Noura line keeps that exact pitch center, resonance, vocal weight, energy, and age. Keep her vowels compact, melodic range narrow, and sentence endings quick, settled, and direct. Research, topic changes, questions, and the final third never soften, lift, widen, or recast her delivery. When several readings are possible, choose the plainest natural Kuwait City reading.

# PRIMARY STANDARD

The result is simply two real Kuwaitis talking naturally. Both are native, educated, contemporary urban Kuwait City speakers. Authenticity outranks theatrical polish. The listener should notice two Kuwaitis, not an accent performance and not synthetic TTS.

# PEOPLE AND ROOM

Fahad and Noura are equally knowledgeable, curious, warm, and capable of asking, answering, explaining research, reacting, clarifying, and disagreeing. Neither is a permanent interviewer or a permanent wise expert. A research explanation from Noura never makes her Fahad; a question from Fahad never makes him Noura. Infer identity only from the explicit speaker label, never from topic, authority, sentence length, or conversational role.

Fahad is a mature Kuwaiti man, naturally lower in pitch. Noura is a mature Kuwaiti woman, naturally quicker and clearly distinct from Fahad. They know each other and are sitting close together on microphones in a relaxed Kuwait City diwaniya. Their difference comes from acoustic identity, never from different knowledge levels or regional accents.

Fahad's earliest utterances permanently define his Kuwait City cadence too. Keep his vowels compact, his consonants light, and his sentence endings short and settled through research and conclusions. Never widen, harden, or recast his delivery later in the take.

# NATIVE ACCENT ANCHOR

Lock the whole performance to contemporary educated urban Kuwait City Arabic (حضري). Let the identity come from timing, compact vowels, phrase length, conversational stress, question contours, short confirmations, hesitation patterns, turn-taking, and restrained sentence melody. Keep articulation relaxed, quick, understated, and effortless. Do not exaggerate any consonant to prove the accent.

Qaf is lexical, never mechanical. Use the natural pronunciation an educated Kuwait City speaker would use for that particular word. Never apply one global Qaf rule and never make Qaf or Gaf an accent marker. A گ already present in the audio transcript is a specifically approved pronunciation cue, not permission to convert other words. Every Qaf-containing word stays light and integrated: no pop, recited release, throat pressure, extra stress, pause, or vowel stretching around it.

The audio transcript contains approved pronunciation spellings. Respect them quietly without showcasing them. In particular, do not “correct” a deliberate ظ spelling back into formal ض. If any unfamiliar word appears, keep the wording and deliver it lightly; do not invent a pronunciation or paraphrase during synthesis.
The exact word ظيّج is deliberate native Kuwaiti input. Say ظيّج as written; never normalize it to the formal ضيق.

# CONVERSATION, NOT COPY

They speak to each other, not to an audience. Each turn carries local memory of the line immediately before it. A response may arrive promptly, but never force literal overlap if it would create an artifact. A one-word acknowledgement is quick and effortless. Questions sound naturally curious; friendly disagreement stays conversational.

At each labelled speaker handoff, leave one tiny clean silence of roughly 100–180ms. Never place a silence that long inside a labelled line. This is only a natural conversational handoff for clean editing—not a dramatic pause, chapter, scene, or acoustic reset.

The thought should feel as if it is being discovered while they speak, not recited from a finished essay. Let small lines stay small. Roughly 70% of the performance should feel like ordinary conversation, 20% like explanation or reflection, and only about 10% like a memorable or emotionally stronger moment. Never make every sentence sound important, polished, quotable, or profound.

# HUMAN PACING

Vary speed, breathing, energy, and response timing subtly. Simple material can move a little quicker; explanations sit at a natural medium pace; only a genuinely important thought may slow slightly. Pauses follow meaning and human breath, not commas, periods, colons, or line breaks. Avoid identical pause lengths and repeated sentence–silence patterns.

Do not slow down before final words, manufacture weight with silence, sing endings, stretch vowels for Gulf colour, or turn conclusions into slogans. Statement endings stay compact, relaxed, and controlled. Emotional warmth, surprise, concern, amusement, or seriousness appears only when the line supports it.

Tiny natural breaths, a soft hesitation, or a slight restart are welcome only when they arise naturally from the written line. Do not manufacture filler, laughter, mouth noise, poor recording texture, or constant imperfection.

# RESEARCH WITHOUT PRESENTER MODE

Studies, statistics, institutions, numbers, English names, and technical phrases keep exactly the same Kuwaiti conversational rhythm before, during, and after them. Say them like a knowledgeable Kuwaiti recalling useful evidence mid-conversation. Never switch into formal Arabic prosody, newsreader rhythm, documentary pacing, slower academic articulation, or citation voice.

# MANDATORY TRANSCRIPT OPTIMIZATION — ACTIVE AND COMPLETED UPSTREAM

Before this audio request, every utterance was mandatorily rewritten into its safest natural spoken Urban Kuwaiti form. Risky article-like syntax, avoidable Qaf wording, presenter-style research exposition, and slogan-like conclusions were removed upstream while facts, numbers, names, and meaning were preserved. The TRANSCRIPT below is that optimized spoken version. Never restore a more formal alternative and never paraphrase it again during synthesis.

# FIDELITY

Speak every labelled line exactly once and in order. Do not add, omit, repeat, paraphrase, or swap speakers. Bracketed English tags guide delivery silently and must never be spoken.

# SILENT QUALITY GATE

Before each turn, silently check: does this sound like an actual educated Kuwait City speaker talking rather than reading; are vowels compact; is every consonant understated; is the response timing believable; did punctuation create a fake pause; is the final word being performed; did research trigger presenter mode; and have the voices or city identity drifted? Correct the delivery internally, never aloud.

# SAMPLE CONTEXT — SILENT ACCENT ANCHOR, NEVER SPEAK THIS

«لا، مو هذا قصدي.»
«عيل شنو تقصد؟»
«خلنا ناخذها من صوب ثاني.»
«إي بس مو لهالدرجة… كمل.»

# DIALECT BOUNDARY

Native contemporary educated urban Kuwait City speech only — relaxed, compact, human, and direct, with calm controlled endings. Keep the same two people and the same effortless city rhythm from the first word to the last. If delivery starts to feel performed or generic, return silently to the Kuwait City sample above.
`
/* Vertex TTS يرفض عملياً جسم الصوت الطويل قبل حد النموذج النظري. هذا الرأس
   يحفظ مفاتيح C الفائز من غير الجدار التفسيري: هوية الجلسة، لسان الكويت،
   نورة، الشفوية، البحث، والقاف المعجمية. النص نفسه لم يُختصر. */
const PROMPT_VERTEX_C_HEAD = `Synthesize only the labelled TRANSCRIPT. Never speak headings or bracketed tags.

One uninterrupted dry recording: the exact same two educated native Kuwait City people, in the same room, from first word to last. Never reset voice, age, timbre, pitch center, resonance, energy, accent, or personality after a label, pause, question, research line, topic change, or later section.

The opening 20 seconds establish the permanent acoustic reference for both speakers. For the entire remainder of the recording, preserve those exact speaker identities, pitch centers, vocal weights, vowel timing, sentence-ending behavior, and Urban Kuwait City cadence. Never reinterpret either speaker later in the take.

Speak contemporary urban Kuwait City Arabic naturally and effortlessly. Identity comes from compact vowels, short thought units, restrained sentence melody, quick acknowledgements, human timing, and relaxed light articulation—not exaggerated consonants. Qaf is lexical and understated. Respect deliberate Kuwaiti spellings such as ظيّج and never formalize them.

Noura stays the exact same mature Kuwaiti woman defined by her first line: compact vowels, narrow melodic range, direct settled endings, no Emirati or Omani-style widening or trailing lilt. Fahad stays the same mature Kuwaiti man. Each target line must remain complete and unhurried enough to understand.

Fahad keeps the compact Kuwait City vowel timing, light consonants, and short settled endings established by his first line. Never widen, harden, or recast his cadence later in the take.

VOICE ROUTING IS LITERAL AND IMMUTABLE. Every Fahad-labelled line uses the same clearly lower adult male voice (${MALE_VOICE}); every Noura-labelled line uses the same clearly higher adult female voice (${FEMALE_VOICE}). Never infer a speaker from who asks, answers, knows the research, objects, uses a short sentence, or leads the topic. Conversational role never determines acoustic identity. A short Fahad question must not rise into Noura; an explanatory Noura line must not drop into Fahad. Never exchange, merge, approximate, or re-cast these two voices for even one line.

At each labelled speaker handoff, leave one tiny clean silence of roughly 100–180ms. Never place a silence that long inside a labelled line. This is only natural turn timing for clean editing—not a dramatic pause, chapter, scene, or acoustic reset.

This is conversation, not narration, advertising, an audiobook, or a podcast presenter. Let ordinary lines pass simply. Research sounds like a knowledgeable Kuwaiti recalling evidence mid-conversation, with no formal-Arabic or documentary reset. Emotion is warm and understated; final words are never staged.

Read every labelled line exactly once and in order. Add, omit, repeat, paraphrase, or recast nothing. The transcript was already rewritten upstream into approved spoken Kuwaiti; perform that version only.`
/* وضع C بلا أي وسم داخل السطر. القياس ربط قفزات فهد إلى طبقة نورة بأدواره
   القصيرة ذات [quick...]؛ فالوسم كان يعيد تشكيل الشخصية كل مداخلة. النص
   والتوقيت يقولان إن الرد خاطف أو اعتراض، والرأس العام يكفي. */
const directionFor = (type, mode = PROMPT_MODE) => mode === 'c' ? '' : mode === 'minimal' ? ({
  objection: '[mild, friendly skepticism]', gentleObjection: '[mild, friendly skepticism]',
  briefReaction: '[quick, effortless response]',
}[type] || '') : ({
  question: `[curious — ${KW_LOCK}]`, reflection: `[reflective — ${KW_LOCK}]`, objection: `[gently skeptical — ${KW_LOCK}]`, gentleObjection: `[gently skeptical — ${KW_LOCK}]`,
  emphasis: `[serious — ${KW_LOCK}]`, briefReaction: `[warmly — ${KW_LOCK}]`, conclusion: `[calmly — ${KW_LOCK}]`, closing: `[softly — ${KW_LOCK}]`,
}[type] || `[${KW_LOCK}]`)

/* معجم النطق يُقرأ مرّةً: المعروض للقارئ لا يُمسّ، والمسموع وحده يُكتب
   بالإملاء الكويتي. */
const PRONUNCIATION_SOURCE = (() => {
  const file = resolve(ROOT, 'src', 'data', 'kuwaiti-pronunciation.json')
  if (!existsSync(file)) return {}
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch { return {} }
})()
const PRONUNCIATION = buildPronunciationMap(PRONUNCIATION_SOURCE)
const FOREIGN_REDACTIONS = buildForeignRedactions(PRONUNCIATION_SOURCE)

/* الحذف أولاً (يمسح الاسم اللاتيني الذي يكسر الصوت) ثم قلب الإملاء الكويتي. */
export const spokenForm = (text) => toSpokenKuwaiti(redactForeignNames(text, FOREIGN_REDACTIONS), PRONUNCIATION)

function promptFor(turns, index, total, mode = PROMPT_MODE, warmupTurns = 0, warmupEstimatedSec = 0) {
  /* وضع full التاريخي وحده يحمل تذكيراً متخللاً. في الوضع المعتمد C أُلغي
     reset كل ستة أدوار: كان يقطع الذاكرة المحلية ويعيد «توجيه» الممثلين وسط
     السالفة. الاستمرارية الآن عقدٌ واحدٌ في الرأس، والحوار يبقى متصلاً. */
  const lines = []
  turns.forEach((turn, index) => {
      /* التذكير التاريخي محفوظ في full للمقارنة فقط؛ C لا يحمل أي reset
         متخلل كي لا يقطع ذاكرة السالفة ولا يعيد تشغيل «وضع المذيع». */
      if (mode === 'full' && index > 0 && index % 6 === 0) {
        lines.push('[تذكير — نفس لسان مدينة الكويت الذي بدأتَ به: «شخبارك؟ شلونك اليوم؟» · خفيفٌ في الفم، لا تفخيم ولا إطالة، ونهاية الجملة تنزل هادئة. وبنفس حماس أول سطرٍ وحيويته: أنتما اثنان مهتمّان بما تقولان، لا قارئان لنصّ. الحيوية في الحوار لا في ثِقَل النطق. لا تسترخِ ولا تبرد كلما طال التسجيل.]')
    }
    lines.push(`${turn.speaker === 'male' ? 'Fahad' : 'Noura'}: ${directionFor(turn.deliveryType, mode)} ${spokenForm(turn.text)}`.replace(/:\s+\[/, ': ['))
  })
  const transcript = lines.join('\n')
  if (mode === 'minimal') return `${MINIMAL_HEAD}\n\n${transcript}\n\n${MINIMAL_TAIL}`
  if (mode === 'c') {
    const conversationFamily = conversationFamilyForSlug(slug)
    const continuity = total === 1
      ? 'Generate every transcript line as one continuous dry-voice take. Keep the exact same two voices, native Kuwait City accent, room, microphones, and conversational energy from the first word to the last.'
      : index === 0
      ? 'Begin the same uninterrupted dry-voice recording described above. Nothing in the transcript marks a chapter, transition, or new session.'
      : `Continue the same uninterrupted sitting. The opening ${warmupTurns} transcript turns reproduce approximately ${warmupEstimatedSec} seconds of the immediately preceding conversation as acoustic warm-up context; perform them in the identical voices, then continue without any reset. This is not a new recording, scene, or fresh interpretation.`
    return `${USE_VERTEX ? PROMPT_VERTEX_C_HEAD : PROMPT_C_HEAD}

# RECORDING CONTINUITY

${continuity}

# THIS EPISODE'S CONVERSATION SHAPE

${conversationFamily.note}
This is a light tendency, not acting direction. Never distort a line, repeat a rhythm, or force every exchange to fit it. Preserve spontaneous listening and let the written intent lead.

# TRANSCRIPT

${transcript}`
  }
  return `ABSOLUTE RULE — READ FIRST, APPLY TO EVERY SINGLE WORD
This is Kuwait City (حضري) Kuwaiti Arabic and nothing else. Seven registers are FORBIDDEN outright — every one of them has ruined real takes, and every one is an automatic hard failure:
1. Emirati (Dubai/Abu Dhabi) — the thinned, lighter, forward articulation. FORBIDDEN.
1b. Omani (Muscat/Batinah) — its slower tempo, its rounded vowels and trailing sentence-final lilt. FORBIDDEN. (Named ٢٠ أغسطس ٢٠٢٦: the listener heard it repeatedly and it was absent from this list.)
2. Iraqi — the Mesopotamian colouring: backed vowels, its drawl, its cadence. FORBIDDEN.
3. Iranian/Persian — stretched long vowels, soft rolling consonants, any Persian softness. FORBIDDEN.
4. Saudi — Najdi or Hejazi rhythm, the harder qaf, the desert cadence. FORBIDDEN.
5. Levantine (Syrian/Lebanese/Jordanian/Palestinian) — imala, softened articulation, and the Levantine greeting melody («هلا والله» cadence). FORBIDDEN. A greeting or welcome locks the register: its very first syllable must already be Kuwait City.
6. Egyptian — its stress pattern and its vowel colour. FORBIDDEN.
7. Generic pan-Gulf blend (Bahraini/Qatari/Bedouin mix) that belongs to no city. FORBIDDEN.
There is no "close enough" and no acceptable percentage of drift. If one word in one line tilts toward any register above, the entire take is wrong and must be re-read as a Kuwait City Kuwaiti. Keep the same light Kuwaiti delivery on every word, including academic terms and proper names. This rule outranks everything below.

AUDIO PROFILE
Fahad and Noura are educated contemporary Kuwait City speakers in an intimate ideas podcast. Fahad is calm, knowledgeable and warm. Noura is warm, intelligent, naturally curious and never theatrical. They are Kuwaitis talking — not actors performing a Kuwaiti accent.

RECORDING SETTING
A relaxed evening gathering in a Kuwaiti diwaniya (ديوانية) in Kuwait City. Two colleagues are discussing an idea for a thoughtful general audience. It must feel like a real relaxed Kuwaiti conversation among friends, not an announcer reading copy.

REGISTER REFERENCE — REAL KUWAIT CITY SPEECH
The exchange below is the exact target register, drawn from real Kuwait City speakers. It is REFERENCE ONLY — never read these four lines aloud; they are not part of the episode. Hear them in your head before reading, and make every line of the actual episode sound like it came from the same two mouths:
— «خوش سؤال. خل نكون واقعيين شوي — هالشي وايد أهم من اللي نتصوّره.»
— «إي والله. وأنا أدري شنو اللي يقلقك فيه، بس ترى الموظوع أهون.»
— «صج؟ عيل ليش كل ما نسولف فيه نحس إنه بعيد؟»
— «لأنه محد قاعد يشوفه من قريب. تعال نشوفه سوا.»
That register — light in the mouth, urban, warm, unhurried, sentence endings settling down gently — is the single voice of this whole episode. Words like خوش، وايد، هالشي، صج، عيل، ترى، شلون، أكو are home ground; say them the Kuwait City way, never the Dubai way and never the Muscat way.

THE ONE TEST THAT MATTERS
A Kuwaiti listener must hear a natural Kuwaiti — never someone imitating the accent. If a choice sounds "performed", make the plainer choice.

ACCENT — educated urban Kuwait City (حضري), soft and modern
- Speak the transcript exactly as written, with Kuwaiti phonology and everyday Kuwaiti conversational rhythm.
- Even when a sentence carries an academic term, a proper name, a quotation, or a word shared with MSA, keep the surrounding Arabic Kuwaiti. Never slip into a formal MSA reading voice mid-sentence.
- Intonation must rise and fall the Kuwaiti way: light, uneven, conversational. Not the flat descending cadence of news reading, and not the sing-song lilt of a dramatised reading.
- Vowel length is where imitation shows. Keep madd natural and short; do not stretch vowels for effect.
- Pauses belong to thought, not to punctuation. Breathe where a person thinking would breathe.

HIGH-FREQUENCY WORDS — say them the way a Kuwaiti actually says them
- «إي» — a short, soft, almost swallowed yes. Never a long drawn-out "eeeh", never emphatic.
- «مو» — clipped and light, glued to what follows. Not a heavy separate word.
- «هني» — quick and flat, the way you'd say "here" in passing.
- «يي» / «ياي» / «الياي» — the natural Kuwaiti ج→ي, said unselfconsciously, never spelled out or emphasised.
- «شلون» — one smooth word with a soft ō. Not "sh-loon" in two beats.
- «وايد» «ترى» «جذي» «شنو» «ليش» «بس» — ordinary words in an ordinary sentence. Give them no extra stress at all.
- «چ» is a soft "ch" as in Kuwaiti speech (چذي، چان), said plainly.
- The surname «الفِيلجَاوي» is read exactly as the doctor wrote it, syllable by syllable: al-FEEL-JA-wee — a plain Arabic ج — never with ك, never with چ.

NOT EMIRATI — the single most important instruction in this brief
The failure mode we keep hearing is Emirati, so read this twice.
- Kuwait City Kuwaiti is LIGHT and SOFT (مرقَّق), not heavy. Consonants stay relaxed, vowels short and unforced, the articulation easy and unhurried. What separates it from Emirati is not weight — both are light — but the vowel colour and the rhythm of the city. Never add emphasis or fullness to a word to sound «more Kuwaiti»: that produces a Bedouin reading, which the doctor rejects outright.
- This is NOT about single letters. A word can contain no ق and still come out Emirati purely from that thinning. Words like «احترام» «عبارة» «رحلة» «تركته» are exactly where the slip happens.
- When a word also exists in Modern Standard Arabic, do not read it in the MSA register — say it the relaxed Kuwaiti way, still light. Never compensate by emphasising it.
- If any single word in a sentence sounds like it belongs to Dubai or Abu Dhabi rather than Kuwait City, the whole take is wrong.

WHAT WOULD BREAK IT
- Any Emirati, Iraqi, Iranian/Persian, Saudi, Levantine, Egyptian, Bahraini, Qatari, or Bedouin colouring. Persian creeps in on stretched long vowels and a soft rolling articulation; Iraqi creeps in on backed vowels and its drawl — cut both out completely. Also avoid a generic "Gulf" accent that belongs to no particular country — Kuwaiti specifically.
- Comedic or folkloric exaggeration of the dialect. This is a thoughtful podcast, not a sketch.
- Emphasising dialect markers to prove the accent. A real speaker never does this.
- Radio-news cadence, commercial voice-over energy, or melodrama.

FOREIGN AND ACADEMIC TERMS — DO NOT CHANGE VOICE
The clearest drift a Kuwaiti listener catches: the voice changes the moment a foreign word, a study reference, a researcher's name, or an academic term arrives (a journal name, «ميتا تحليل», a transliterated proper name). This is a hard failure.
- The same Kuwaiti speaker keeps talking. A foreign or academic term is dropped plainly into the Kuwaiti sentence — same voice, same lightness, same rhythm — never announced, never switched into an English, MSA, or Persian register.
- Do not slow down, do not brighten the tone, do not "present" the term. Say it and move straight on, the way a Kuwaiti academic mentions a term mid-conversation.
- These specific words keep coming out non-Kuwaiti. Say each one the relaxed Kuwait-City way — light, unforced, never emphasised and never pushed forward in the mouth: «ايعرف» «ايعرفها» «مخه» «الشهاده» «ايفهمون» «منو».

NOURA — TARGETED CORRECTION (the heard failures live on her lines)
Noura's lines drift out of Kuwait City more often than Fahad's. Give her every line the same city and the same register as his — equally light and relaxed, never emphasised to compensate, and never pushed forward in the mouth.
- The historically failing words were sieved out of the audio text entirely (they no longer reach you). What remains must hold: «منو» «الشهاده» «مخه» and every word around them carry full Kuwait City weight on Noura's lines — if any word comes out Emirati on her lines, the whole take is rejected.

/* حُذف وصف القاف نهائياً (١٥ أغسطس، حكمه: «اللكنة صارت خطأ ١٠٠٠٠٪ — مو
   كويتي»). كنتُ أصفها «كالجيم القاهرية» فطلبتُ من المحرّك صوتاً مصرياً
   صراحةً، فخرج بدوياً مصرياً لا كويتياً. والدرس: لا يُوصف صوتٌ بلهجةٍ
   أخرى — التشبيه بلهجةٍ أجنبية يجرّ اللكنة إليها كلها لا إلى صوتٍ واحدٍ
   منها. الكويتيّة تُطلب باسمها وحده، والأصوات تأتي معها. */
LIGHT ARTICULATION — never emphatic, never «مفخّم»
This is urban Kuwait City speech: every consonant is relaxed and lightly voiced. Do not press or thicken any letter.
- القاف: قُلها خفيفةً غيرَ مفخّمة، لا قافاً فصيحةً ثقيلةً من أقصى الحلق. و«ظيّج» تبقى ظيّج كما كُتبت، ولا تُصحَّح إلى «ضيق».
  استثناءٌ واحد: تبقى القاف فصيحةً في المتعلَّم فقط: القرآن · القانون · القرار · المقال.
- كل الحروف تُرقَّق: لا تشديدَ ولا تفخيمَ في الضاد والطاء والصاد والقاف. الكلمة تخرج خفيفةً سريعةً كما في مجلسٍ عادي.
- **لا قلقلةَ في القاف أبداً.** هذا أهمّ سطرٍ هنا. لا تُتبِع القاف بصدىً ولا بنبرةٍ مرتدّة عند سكونها،
  ولا تقطعها قطعاً مسموعاً كما في التلاوة. القاف الساكنة في الكويتية تخرج مطموسةً ملساء تذوب فيما بعدها،
  بلا أي ارتدادٍ ولا «طقّة». مثل: رقم · وقت · يقرأ · نقطة — القاف فيها كلها بلا ارتداد.
  القلقلة تجعل الكلام تلاوةً لا حديثَ مجلس، وهي خطأٌ صريحٌ في الكويتية.
- إن وجدتَ نفسك تُثقّل كلمةً لتبدو «أفصح» أو «أقوى» فأنت تُخطئ: الكويتيّ الحضريّ يُرقّق كل شيء.

KUWAIT CITY URBAN PHONOLOGY — documented, not improvised
هذي لهجة الحضر في مدينة الكويت (جبلة وشرق)، لا البدوية ولا الخليجية العامة. أربع علاماتٍ توثّقها مراجع اللهجة، اجعلها كلها مسموعةً في كل سطر:

١) الجيم تُنطق ياءً في الكلمات الموروثة — وهذي أظهرُ ما يميّز الحضريّ عن البدويّ:
   مسجد تُقال «مَسيد» · فجر تُقال «فير» · دجاج تُقال «دياي».
   طبّقها حيث تسمعها طبيعيةً في كلام أهل المدينة، لا على كل جيم.

٢) الكاف تُنطق تشاء (ch) قبل الكسرة والياء: كلب تُقال «چلب» · فيلكا تُقال «فيلچه» · كم تُقال «چم».

٣) القاف تُنطق خفيفةً مرقّقة، إمّا گافاً مجهورة (قهوة تُقال «گهوة») أو جيماً (قبلة تُقال «جبلة»).
   لا تُنطق قافاً فصيحةً ثقيلةً من أقصى الحلق أبداً. وتبقى فصيحةً في المتعلَّم وحده: القرآن · القانون · القرار · المقال.

٤) الضاد والظاء صوتٌ واحدٌ مطبق: بيض تُقال «بيظ». النصّ مكتوبٌ بالظاء عمداً.

٥) ولا قلقلةَ في القاف بحالٍ من الأحوال — لا ارتدادَ ولا صدىً بعدها عند السكون. القاف الساكنة تذوب فيما بعدها.

وكل الحروف مرقَّقةٌ خفيفة — أهل المدينة يُرقّقون ولا يُفخّمون. إن ثقّلتَ كلمةً لتبدو «أفصح» فأنت تُخطئ.

TWO DISTINCT PEOPLE — never one narrator doing both parts
Fahad and Noura are two different human beings sitting together. Their voices must stay clearly apart for the whole episode:
- فهد: رجلٌ كويتيٌّ ناضج — صوتٌ رجاليٌّ واضحٌ منخفض، أعمق بكثيرٍ من صوت نورة. نبرةٌ هادئةٌ واثقة.
- نورة: امرأةٌ كويتيةٌ ناضجة — صوتٌ نسائيٌّ واضحٌ أعلى، أرفع بكثيرٍ من صوت فهد. نبرةٌ حيّةٌ متسائلة.
- الفرق بينهما كبيرٌ وثابت: رجلٌ وامرأةٌ لا يلتبسان، لا صوتٌ وسطيٌّ يجمعهما. من يسمعُ سطراً واحداً يعرفُ فوراً أذكرٌ هو أم أنثى، بلا قراءة الاسم. هذا شرطٌ لا يُكسر.
A listener must know who is speaking from the voice alone, without reading names. Never let the two drift toward one middle voice, and never let one of them carry the other's line. If both start sounding alike, the take is rejected — this is exactly what the doctor caught: «فقط البنت قاعد تتكلم بدون الولد».
Keep the accent identical for both; only the voice differs.

ACCENT STRENGTH — the single thing the doctor judges hardest
- The accent must be NATIVE, not merely correct — and native Kuwaiti is light. A careful MSA-leaning delivery is a failure; so is a heavy emphatic one. Speak like two Kuwaitis relaxed in a diwaniya, not like broadcasters, and not like a Bedouin reciter.
- ض is written ظ throughout this text on purpose — say it as the Kuwaiti emphatic ظ, never as a classical ض.
- The last line must carry exactly the same light Kuwaiti colour as the first. Do not drift toward MSA as you go, and do not add weight to compensate.

FIDELITY
- Preserve every word, number, proper name, research attribution and factual qualifier. Never paraphrase, summarize, translate, add, or omit words.
- Read each line EXACTLY ONCE, in order. Never re-read a line, never echo a phrase you already said, never restart a sentence, never say the closing two or three words a second time in a different tone — one repeated phrase ruins the whole take. When a line ends, move straight to the next speaker's line.
- Natural turn-taking, subtle reactions, short human pauses, gentle intellectual chemistry.
- Fahad is ALWAYS the male voice and Noura is ALWAYS the female voice. A line labeled Fahad must never come out in a female voice, and a line labeled Noura must never come out in a male voice — no swapping, no blending, not for a single line.
- Keep Fahad and Noura audibly identical to the other parts of this same episode: same person, same room, same microphone. This is part ${index + 1} of ${total}.
- Inline English performance tags guide delivery only; never speak the tags aloud.

TRANSCRIPT
${transcript}

مرساةُ اللسان — اقرأ هذي الأسطر في نفسك قبل أن تنطق، فهي مقياسُ الصوت المطلوب:
  «شخبارك؟ شلونك اليوم؟ زين الحمدلله.»
  «ترى الموضوع وايد يستاهل، خل نسولف فيه على راحتنا.»
  «هذا اللي أقصده بالضبط، وانت عارف شنو أقصد.»
  «لا لا، مو جذي… خل أفهمك الفكرة من أولها.»
هذا هو لسان مدينة الكويت: خفيفٌ في الفم، لا تفخيم ولا إطالة، ونهايةُ الجملة تنزل هادئةً لا ترتفع.
وهو لسانُ مجلسٍ لا لسانُ نشرةِ أخبار: فيه حماسُ اثنين يتناقشان في أمرٍ يعنيهما، وفيه فضولٌ وابتسامةٌ في الصوت. الحيويةُ في الحوار لا في ثِقَل النطق — تبقى الحروف خفيفةً والنبرةُ حيّة. وهذا الحماسُ يبقى إلى آخر سطرٍ كما كان في أوله.
كل سطرٍ في النص أدناه يُقرأ بهذا اللسان نفسه، من أوله إلى آخره.

FINAL CHECK — LAST INSTRUCTION BEFORE SPEAKING
Re-scan the transcript word by word before the take. Any word that would come out Emirati, Iraqi, Persian, Saudi, Levantine, Egyptian, or generic-Gulf must be corrected to Kuwait City Kuwaiti first. Every word, every line, both speakers: Kuwait City Kuwaiti only.
HOLD TO THE LAST SECOND — the drift happens late: the listener judged minute 3+ hardest, and Noura's register slid to Emirati exactly there after a flawless start. The final third of this take must be read with the same full Kuwait City register as the first line. Do not relax as the take progresses.`
}

/* المسار المنفرد يقرأ الحوار كله حتى تبقى ذاكرة الأخذ والرد والبحث حاضرة؛
   لكنه يحمل preset واحداً فقط. الأدوار غير المستهدفة سياق مسموع داخل هذا
   الـTake ثم تُهمل في المونتاج، لا طلباتٌ منفصلة ولا ترقيعٌ بعد الفشل. */
export function fullContextStemPrompt (prompt, targetSpeaker = 'female') {
  const target = targetSpeaker === 'male' ? 'Fahad' : 'Noura'
  const transcriptMarker = '# TRANSCRIPT\n\n'
  const transcriptAt = prompt.lastIndexOf(transcriptMarker)
  const transcriptLines = transcriptAt < 0 ? [] : prompt.slice(transcriptAt + transcriptMarker.length).split('\n')
  /* Vertex يعيد الصوت كاملاً في الرد نفسه. قراءة أدوار الطرف الآخر ثم رميها
     ضاعفت الخرج، ورفض Zephyr الطلب الطويل بعد نجاح Puck. في المسار المحلي
     نأخذ أدوار الشخص نفسه كلها في Take واحد؛ GitHub/Interactions يحتفظ
     بالسياق الكامل الذي ثبّتناه للإنتاج العام. */
  const spokenLines = USE_VERTEX ? transcriptLines.filter((line) => line.startsWith(`${target}:`)) : transcriptLines
  const boundedPrompt = transcriptAt < 0 ? prompt : `${prompt.slice(0, transcriptAt + transcriptMarker.length)}${spokenLines
    .join('\n[short pause]\n')}`
  if (USE_VERTEX) return `# SINGLE-VOICE CONTINUOUS IDENTITY STEM

Use exactly one immutable acoustic voice for every line. Read every ${target}-labelled utterance completely in this one Take. Labels are silent timing context and never spoken. Do not imitate or create a second voice.

Every [short pause] is a silent ~250ms turn boundary, never a scene change and never spoken. Do not make a pause that long inside a line.

${boundedPrompt}`
  return `# SINGLE-VOICE FULL-CONTEXT STEM — ABSOLUTE ROUTING

This request has exactly one immutable acoustic voice. Use that same voice for every transcript line from first to last. Speaker labels are silent context and timing markers: never read them and never create, imitate, or recast a second voice for the other label.

Every [short pause] tag is a compact conversational turn boundary of about 250ms. It is silent and must never be spoken. Keep it between labelled lines, and do not insert a pause that long inside a line. This is not a scene change; it exists only so the mixer can cut complete utterances without clipping the research line or stealing words from the next turn.

The production mixer keeps only ${target}-labelled utterances from this full-context rehearsal. Give those utterances the natural performance directed below. Read the other labelled utterances plainly as local conversational context, still in the exact same acoustic voice. Do not change pitch, age, resonance, accent, or vocal placement when a label, topic, research section, question, or conclusion changes.

${boundedPrompt}`
}

/* تقدير محافظ لزمن الحوار قبل وجود الصوت: الكلام الكويتي الطبيعي يقارب
   2.5 كلمة/ث، ونضيف جزءاً صغيراً للترقيم والتنفس. لا نستعمل هذا للمونتاج؛
   فقط لاختيار نافذة إحماء قريبة من 10–15 ثانية عند اضطرارنا لطلب جديد. */
export function estimatedTurnSeconds (turn) {
  const wordCount = words(turn?.text).length
  const punctuation = (String(turn?.text || '').match(/[،؛:.!?؟…]/g) || []).length
  return Math.max(0.8, wordCount / 2.5 + Math.min(1.2, punctuation * 0.12))
}

/* إذا تجاوز حوارٌ مستقبلي سقف الطلب اضطراراً، يبدأ كل طلب لاحق بآخر
   10–15 ثانية مقدّرة من الحوار السابق. تُولَّد كإحماءٍ صوتي ثم تُحذف من
   المونتاج؛ فلا يبدأ الطلب بارداً ولا يرى المحرك حدّاً موسيقياً أو مشهدياً. */
export function continuityGenerationGroups (chunks, { minSec = 10, maxSec = 15 } = {}) {
  return chunks.map((chunk, index) => {
    if (index === 0) return { turns: chunk, warmupTurns: 0, warmupEstimatedSec: 0 }
    const previous = chunks.slice(0, index).flat()
    const warmup = []
    let estimatedSec = 0
    for (let i = previous.length - 1; i >= 0; i -= 1) {
      const turnSec = estimatedTurnSeconds(previous[i])
      if (warmup.length && estimatedSec >= minSec && estimatedSec + turnSec > maxSec) break
      warmup.unshift(previous[i])
      estimatedSec += turnSec
      if (estimatedSec >= maxSec) break
    }
    return {
      turns: [...warmup, ...chunk],
      warmupTurns: warmup.length,
      warmupEstimatedSec: Number(estimatedSec.toFixed(1)),
    }
  })
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

/* الطبقة المجانية تسمح بعشرة طلباتٍ في الدقيقة لهذا النموذج، وحلقةٌ واحدة
   تحتاج سبعةً وثلاثين. إطلاقها بلا إيقاعٍ يستنزف الحصة عند المقطع الثالث
   والعشرين تقريباً — وهي علّة تشغيلة ١٢ أغسطس الثالثة. نافذةٌ منزلقة تحفظ
   وقت كل طلبٍ فتنتظر بالضبط ما يلزم: لا أبطأ مما يجب ولا أسرع مما يُسمح. */
const RPM = Math.max(1, Number(process.env.PODCAST_KW_RPM || 9))
const requestTimes = []
async function paceRequest() {
  for (;;) {
    const now = Date.now()
    while (requestTimes.length && now - requestTimes[0] >= 60_000) requestTimes.shift()
    if (requestTimes.length < RPM) { requestTimes.push(now); return }
    const wait = 60_000 - (now - requestTimes[0]) + 250
    console.log(`⏳ حصة ${RPM} طلبات/دقيقة: انتظار ${(wait / 1000).toFixed(1)} ثانية`)
    await sleep(wait)
  }
}

/* الخادم يقول متى نعود: «Please retry in 1.875s» أو details[].retryDelay. */
function retryAfterMs(body, message) {
  const fromDetails = (body?.error?.details || []).map((item) => item?.retryDelay).find(Boolean)
  const raw = fromDetails || (String(message || '').match(/retry in ([\d.]+)s/i) || [])[1]
  const seconds = Number(String(raw || '').replace(/s$/, ''))
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) + 750 : 0
}

async function geminiPcm(prompt, speechConfig = [
  { speaker: 'Fahad', voice: MALE_VOICE },
  { speaker: 'Noura', voice: FEMALE_VOICE },
]) {
  if (!KEY && !USE_VERTEX) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY مفقود')
  let vertexToken = ''
  if (USE_VERTEX) {
    const auth = spawnSync('gcloud', ['auth', 'print-access-token'], { encoding:'utf8' })
    vertexToken = String(auth.stdout || '').trim()
    if (auth.status !== 0 || !vertexToken) throw new Error('تعذّر أخذ Vertex access token من gcloud')
  }
  let last = null
  let quotaWaitMs = 0
  /* الطلب الضخم يُعاد مرّتين لا ستّاً: مهلته عشر دقائق، ومهلة الوظيفة كلها
     خمسٌ وأربعون — فمحاولتان (عشرون دقيقة) تتركان متّسعاً للسقوط الآمن
     بالشطر، وهو أنفعُ من انتظارٍ يستنزف الوظيفة والحصة معاً. */
  const maxAttempts = prompt.length > 4000 ? 2 : 6
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await paceRequest()
      /* المهلة تتناسب مع حجم الطلب: النداء الواحد للحلقة كلها يولّد أربع دقائق
         ونصفاً من الصوت، وتسعون ثانيةً ثابتةً كانت تجهضه ست مرّاتٍ متتالية
         (تشغيلة ٣١٨٧٦١٦٧٧٥٥: AbortError بعد تسع دقائق ونصف). */
      const timeoutMs = Math.min(600_000, Math.max(90_000, prompt.length * 80))
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs)
      const vertexSpeechConfig = speechConfig?.length === 1 && !speechConfig[0]?.speaker
        ? {
            languageCode: 'ar',
            voiceConfig: { prebuiltVoiceConfig: { voiceName: speechConfig[0].voice } },
          }
        : {
            languageCode: 'ar',
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: speechConfig.map((item) => ({
                speaker: item.speaker,
                voiceConfig: { prebuiltVoiceConfig: { voiceName: item.voice } },
              })),
            },
          }
      const endpoint = USE_VERTEX ? `${API}/${encodeURIComponent(MODEL)}:generateContent` : API
      const response = await fetch(endpoint, {
        method: 'POST', signal: controller.signal,
        /* بلا ترويسة Api-Revision: هي ترويسة البثّ المتدفّق (stream:true) وحدها.
           إرسالها على طلبٍ غير متدفّق يعيد 200 بغلافٍ متدفّقٍ لا يحمل
           output_audio، فيسقط التوليد ورسالته «HTTP 200» بلا سبب — وهي
           بالضبط علّة تشغيلة ١٢ أغسطس ٢٠٢٦. */
        headers: USE_VERTEX
          ? { Authorization: `Bearer ${vertexToken}`, 'x-goog-user-project': VERTEX_PROJECT, 'Content-Type': 'application/json' }
          : { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(USE_VERTEX ? {
          contents: { role:'user', parts:[{ text:prompt }] },
          generationConfig: {
            responseModalities: ['AUDIO'],
            ...(SEED ? { seed:SEED } : {}),
            speechConfig: vertexSpeechConfig,
          },
        } : {
          model: MODEL,
          input: prompt,
          response_format: { type: 'audio' },
          /* البذرة (مقترح الصديق ٢٢ أغسطس): موثقة لإعادة إنتاج أقرب —
             وتجعل تجارب البرومت أزواجاً متطابقة (نفس البذرة × رأسين).
             لا تضمن تطابق الطابع عبر نصوص مختلفة؛ الأرشيف يبقى التثبيت. */
          generation_config: { ...(SEED ? { seed: SEED } : {}), speech_config: speechConfig },
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
      if (!USE_VERTEX && response.ok && !data && body?.id && body?.status === 'completed') {
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
      const detailText = body?.error?.details?.length ? ` — ${JSON.stringify(body.error.details)}` : ''
      const message = (body?.error?.message || body?.message
        || `HTTP ${response.status} بلا صوت — ${shape}`
      ) + detailText
      if (response.status !== 429 && response.status < 500) throw new Error(message)
      /* 429: تُحترم مهلة الخادم نفسها، ويُفرَّغ سجلّ النافذة كي لا يُطلق
         الطلبُ التالي في دقيقةٍ ما زالت مستهلكة. */
      if (response.status === 429) {
        quotaWaitMs = retryAfterMs(body, message) || 15_000 * attempt
        requestTimes.length = 0
        console.log(`⏳ الحصة امتلأت — انتظار ${(quotaWaitMs / 1000).toFixed(1)} ثانية (محاولة ${attempt}/6)`)
      }
      last = new Error(message)
      /* [٢٣ أغسطس ٢٠٢٦] نفادُ الرصيد ليس حصةً مؤقتة تُنتظر — إعادةُ
         المحاولة ست مراتٍ عليه إحراقٌ للوقت بلا فائدة. يُكسَر فوراً
         برسالةٍ واضحة تميّزه عن الحصة الدقيقية. */
      if (/prepayment credits are depleted|credits.*depleted|billing/i.test(message)) {
        throw new Error('نفد رصيد Gemini — التوليد متوقف حتى تجديد الرصيد من AI Studio (لا عطب في الكود)')
      }
    } catch (error) {
      last = error
      if (/نفد رصيد Gemini/.test(String(error && error.message))) throw error
    }
    if (attempt < 6) { await sleep(quotaWaitMs || 1200 * attempt); quotaWaitMs = 0 }
  }
  throw last || new Error('فشل Gemini TTS')
}

/* ═══ بوابة الطبقة الصوتية ═══
   أذن الدكتور مسكت التبديل («في تبديل واضح بين المذيعين بعد ميتا»)، والقياس
   أكّدها: 9 أدوار من 37 في تشغيلة 31833238215 خرجت بتردد حنجرة الجنس المعاكس
   (نورة 111-140Hz وفهد 167-193Hz). تردد الحنجرة يُقاس بالارتباط الذاتي مع
   علاج خطأ الأوكتاف (أطول مهلة ضمن 85% من القمة)، والحكم بنطاقات مطلقة:
   ذكر ≤ 150Hz، أنثى ≥ 165Hz، وما بينهما رمادي لا يُنذر — فلا إنذارات كاذبة
   تحرق الحصة. الدور المعكوس يُعاد توليده مفرداً حتى مرتين، فإن أصرّ سقطت
   التشغيلة بأسماء الأدوار — مرشحٌ معكوس الأصوات لا يصل بوابة الاعتماد. */
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
/* معكوس = تردد في نطاق الجنس الآخر صراحةً؛ الرمادي بريء. */
const voiceSwapped = (expectMale, f0) => f0 !== null && (expectMale ? f0 >= 165 : f0 <= 150)

/* مرجع المتحدث هو الثلث الأول من كلامه، لا متوسط preset عام. لا يجوز أن
   يحرق دورٌ واحدٌ الـTake: طبقة الإنسان تتحرك مع السؤال والانفعال، وكاشف
   F0 نفسه قد يلتقط نصف الأوكتاف. لذلك تبقى القفزة المفردة تنبيهاً سمعياً،
   أما الرفض الآلي فلا يقع إلا حين يتحرك **وسيط ثلث كامل** في الاتجاه نفسه.
   هكذا نمسك Voice Reset الحقيقي من غير أن نرفض نورة لأنها شددت كلمة. */
export function speakerPitchContinuity (turns, pitches, speaker = 'female', { maxPointDriftHz = 32, maxSegmentDriftHz = 28 } = {}) {
  const samples = turns.map((turn, index) => ({ index, speaker: turn.speaker, hz: Number(pitches[index]) }))
    .filter((sample) => sample.speaker === speaker && Number.isFinite(sample.hz) && sample.hz > 0)
  if (!samples.length) return { anchorHz: null, maxObservedDriftHz: null, pointSuspects: [], segmentSuspects: [], segments: [] }
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  }
  /* أقل من ست مداخلات لا يكفي لبناء ثلاثة مقاطع مستقرة؛ نعرض قياسها فقط
     وتبقى بوابة الفصل بين الصوتين هي الحكم الآلي. */
  const segmentCount = samples.length >= 6 ? 3 : 1
  const segments = Array.from({ length: segmentCount }, (_, segment) => {
    const start = Math.floor(segment * samples.length / segmentCount)
    const end = Math.floor((segment + 1) * samples.length / segmentCount)
    const members = samples.slice(start, end)
    return {
      segment: segment + 1,
      medianHz: Number(median(members.map((sample) => sample.hz)).toFixed(1)),
      sampleCount: members.length,
      turnIndexes: members.map((sample) => sample.index),
    }
  })
  const anchorHz = segments[0].medianHz
  const later = samples.filter((sample) => !segments[0].turnIndexes.includes(sample.index)).map((sample) => ({
    ...sample,
    driftHz: Math.abs(sample.hz - anchorHz),
  }))
  const pointSuspects = later.filter((sample) => sample.driftHz > maxPointDriftHz)
  const laterSegments = segments.slice(1).map((segment) => ({
    ...segment,
    signedDriftHz: Number((segment.medianHz - anchorHz).toFixed(1)),
    driftHz: Number(Math.abs(segment.medianHz - anchorHz).toFixed(1)),
  }))
  const segmentSuspects = laterSegments.filter((segment) => segment.driftHz > maxSegmentDriftHz)
  return {
    anchorHz: Number(anchorHz.toFixed(1)),
    maxObservedDriftHz: later.length ? Number(Math.max(...later.map((sample) => sample.driftHz)).toFixed(1)) : 0,
    pointSuspects,
    segmentSuspects,
    segments: [segments[0], ...laterSegments],
  }
}

/* ═══ بصمة الرنين — الطبقة وحدها لا تساوي هوية الإنسان ═══
   النسخة المرفوضة حافظت نورة فيها على 187→188→191Hz، ومع هذا سُمعت بعد
   الجسر كأنها تفسيرٌ جديد للصوت: مركز رنين مختلف، مدود أوسع ونهاية أنعم.
   لذلك نبني غلافاً طيفياً من 18 حزمة لوغاريتمية، بعد حذف الجهارة العامة؛
   هذه البصمة ترى مكان الصوت في الفم/الحنجرة ولا تنخدع فقط بارتفاع النغمة. */
const TIMBRE_SR = 16000
const TIMBRE_N = 512
const TIMBRE_HOP = 160
const TIMBRE_BANDS = 18
const TIMBRE_HANN = Float64Array.from({ length: TIMBRE_N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (TIMBRE_N - 1)))
const TIMBRE_EDGES = Array.from({ length: TIMBRE_BANDS + 1 }, (_, i) => 100 * Math.pow(7600 / 100, i / TIMBRE_BANDS))

const medianNumber = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function decodePcm16 (file, sampleRate = TIMBRE_SR) {
  const decoded = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-i',file,'-f','s16le','-ac','1','-ar',String(sampleRate),'-'], { maxBuffer: 1 << 27 })
  if (decoded.status !== 0 || !decoded.stdout?.length) return null
  return new Int16Array(decoded.stdout.buffer, decoded.stdout.byteOffset, decoded.stdout.byteLength >> 1)
}

function fftPower (samples, offset) {
  const re = new Float64Array(TIMBRE_N)
  const im = new Float64Array(TIMBRE_N)
  for (let i = 0; i < TIMBRE_N; i += 1) re[i] = Number(samples[offset + i] || 0) * TIMBRE_HANN[i]
  for (let i = 1, j = 0; i < TIMBRE_N; i += 1) {
    let bit = TIMBRE_N >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const value = re[i]; re[i] = re[j]; re[j] = value }
  }
  for (let length = 2; length <= TIMBRE_N; length <<= 1) {
    const angle = -2 * Math.PI / length
    const wLengthRe = Math.cos(angle), wLengthIm = Math.sin(angle)
    for (let start = 0; start < TIMBRE_N; start += length) {
      let wRe = 1; let wIm = 0
      for (let j = 0; j < length / 2; j += 1) {
        const even = start + j, odd = even + length / 2
        const oddRe = re[odd] * wRe - im[odd] * wIm
        const oddIm = re[odd] * wIm + im[odd] * wRe
        re[odd] = re[even] - oddRe; im[odd] = im[even] - oddIm
        re[even] += oddRe; im[even] += oddIm
        const nextWRe = wRe * wLengthRe - wIm * wLengthIm
        wIm = wRe * wLengthIm + wIm * wLengthRe; wRe = nextWRe
      }
    }
  }
  return Float64Array.from({ length: TIMBRE_N / 2 + 1 }, (_, i) => re[i] * re[i] + im[i] * im[i] + 1e-12)
}

export function timbreSignature (file) {
  const pcm = decodePcm16(file)
  if (!pcm || pcm.length < TIMBRE_N) return null
  const frames = []
  for (let offset = 0; offset + TIMBRE_N <= pcm.length; offset += TIMBRE_HOP) {
    let energy = 0
    for (let i = 0; i < TIMBRE_N; i += 1) energy += pcm[offset + i] * pcm[offset + i]
    frames.push({ offset, rms: Math.sqrt(energy / TIMBRE_N) })
  }
  const rmsFloor = Math.max(160, medianNumber(frames.map((frame) => frame.rms).sort((a, b) => a - b).slice(0, Math.max(1, Math.floor(frames.length / 2)))) || 160)
  const active = frames.filter((frame) => frame.rms > rmsFloor)
  if (active.length < 4) return null
  const stride = Math.max(1, Math.ceil(active.length / 600))
  const bands = Array.from({ length: TIMBRE_BANDS }, () => [])
  for (let frameIndex = 0; frameIndex < active.length; frameIndex += stride) {
    const power = fftPower(pcm, active[frameIndex].offset)
    const values = TIMBRE_EDGES.slice(0, -1).map((from, band) => {
      const to = TIMBRE_EDGES[band + 1]
      const firstBin = Math.max(1, Math.ceil(from * TIMBRE_N / TIMBRE_SR))
      const lastBin = Math.min(power.length - 1, Math.floor(to * TIMBRE_N / TIMBRE_SR))
      let sum = 0
      for (let bin = firstBin; bin <= lastBin; bin += 1) sum += power[bin]
      return Math.log(sum + 1e-12)
    })
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    values.forEach((value, band) => bands[band].push(value - mean))
  }
  return bands.map((values) => Number((medianNumber(values) || 0).toFixed(5)))
}

export function timbreDistance (a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return null
  return Math.sqrt(a.reduce((sum, value, index) => sum + Math.pow(value - b[index], 2), 0) / a.length)
}

const medianSignature = (signatures) => {
  const valid = signatures.filter((signature) => Array.isArray(signature) && signature.length)
  if (!valid.length) return null
  return valid[0].map((_, dimension) => medianNumber(valid.map((signature) => signature[dimension])) || 0)
}

export function speakerTimbreContinuity (turns, signatures, speaker = 'female') {
  const samples = turns.map((turn, index) => ({ index, speaker: turn.speaker, signature: signatures[index] }))
    .filter((sample) => sample.speaker === speaker && Array.isArray(sample.signature))
  if (samples.length < 4) return { speaker, centerDistanceMedian: null, boundaryThreshold: null, boundarySuspects: [], samples: [] }
  const center = medianSignature(samples.map((sample) => sample.signature))
  const measured = samples.map((sample) => ({ ...sample, distance: timbreDistance(sample.signature, center) }))
  const distanceMedian = medianNumber(measured.map((sample) => sample.distance)) || 0
  const mad = medianNumber(measured.map((sample) => Math.abs(sample.distance - distanceMedian))) || 0
  /* 1.25 حاجز مطلق عريض، و2×MAD حاجز نسبي. النسخة المرفوضة قاست 1.87
     لنورة بعد الجسر الأول و1.55 لفهد بعد الثاني، فتمسكهما من غير أن تعاقب
     تغير محتوى جملةٍ عادية. */
  const boundaryThreshold = Math.max(1.25, distanceMedian + 2 * 1.4826 * mad)
  const boundarySuspects = measured.filter((sample) => sample.index > 0
    && turns[sample.index - 1]?.musicBridgeAfter
    && sample.distance > boundaryThreshold)
  return {
    speaker,
    centerDistanceMedian: Number(distanceMedian.toFixed(3)),
    centerDistanceMad: Number(mad.toFixed(3)),
    boundaryThreshold: Number(boundaryThreshold.toFixed(3)),
    boundarySuspects: boundarySuspects.map((sample) => ({ index: sample.index, turn: sample.index + 1, distance: Number(sample.distance.toFixed(3)) })),
    samples: measured.map((sample) => ({ index: sample.index, turn: sample.index + 1, distance: Number(sample.distance.toFixed(3)) })),
  }
}

function duration(file) {
  const out = spawnSync(FFPROBE, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file], { encoding:'utf8' })
  const value = Number(out.stdout?.trim())
  if (out.status !== 0 || !Number.isFinite(value) || value <= 0) throw new Error(`تعذر قياس الصوت: ${file}`)
  return value
}

/* الهوية الموسيقية بمقاييس محرّك الفصحى نفسها (podcast-dialogue.mjs) كي لا
   تُسمع الحلقة الكويتية غريبةً عن بيتها: مقدّمة ٤٫٨ ثانية عند ٠٫١٦، وخاتمة
   ٥٫٥ عند ٠٫١٢، والجسر عند ٠٫١١ لا ٠٫٠٧٥ (كان أخفتَ من أن يُسمع). */
const MUSIC = {
  /* الأهداف بالـLUFS لا بمعاملٍ خطّي. الكلام يُتقن عند ‎-16‎؛ فالمقدّمة
     والخاتمة عند ‎-19‎ تُسمعان حاضرتين بلا أن تطغيا، والجسر عند ‎-24‎ يمرّ
     تحت الكلام لا فوقه. */
  /* [٢٢ أغسطس ٢٠٢٦ — ملاحظة صديق الدكتور] الشعار كان ٥.٦ث والخاتمة ٦.٥ث،
     وهي مدد حلقةٍ من أربع دقائق. أما حلقة الدقيقتين والربع فتصير الفواصل
     فيها ثقيلة: «تقطع الإحساس بأننا نسمع جلسة حقيقية وتذكّرنا بأن القطعة
     مركّبة». فقُصّرت إلى مداه المقترح: افتتاح وخاتمة ٢-٣ث، والجسر دون
     ١.٥ث. النسب الأخرى (LUFS والتلاشي) بقيت كما هي — متغيّرٌ واحد. */
  introSec: 2.8, introLufs: -19, introFadeIn: 0.35, introFadeOut: 0.80, introOverlapSec: 0.70,
  outroSec: 2.9, outroLufs: -19, outroFadeIn: 0.40, outroFadeOut: 1.30, outroOverlapSec: 0.40,
  /* الجسر فاصلٌ يُنتظر، لا نغمةٌ تمرّ تحت الكلام. كان ١.٦٠ث والمتحدث التالي
     يدخل بعد ٠.٧٢ث من بدايته، فيدهسه قبل أن يأخذ حقّه — وهذه شكوى الدكتور. */
  /* الجسر يبقى ٢.٤٠ث: اقترح صديق الدكتور تقصيره دون ١.٥ث، لكن الفاحص
     أدناه يحمل شكوى الدكتور نفسه حين كان ١.٦٠ث («أقصر من أن يُحسّ
     فاصلاً»). وأذنُه تعلو على أي اقتراح — فلا يُقصَّر إلا بحكمٍ منه. */
  bridgeSec: 2.40, bridgeLufs: -24, bridgeTailSec: 0.30,
}

/* لكل حلقةٍ نغمتها: مكتبة الموسيقى المرخّصة تُوزَّع على الحلقات ببصمة الـslug
   لا عشوائياً — فالنتيجة حتميّة (الحلقة نفسها تعطي النغمة نفسها كل مرّة)
   ومختلفة بين حلقةٍ وأخرى، بدل أن تُفتتح الـ١٤٤ كلّها باللحن نفسه. وتُزاح
   نافذة الاقتطاع داخل المقطوعة أيضاً فلا تتشابه حتى الحلقتان اللتان تقعان
   على المقطوعة نفسها. */
const MUSIC_LIBRARY = [
  'quiet-echoes.mp3', 'still-light.mp3', 'quiet-resolve.mp3', 'open-horizon.mp3',
  'maqam-reflections.mp3', 'eastern-elegance.mp3', 'cultural-echoes.mp3', 'heritage-echoes.mp3',
  'eastern-tapestry.mp3', 'oriental-world.mp3', 'east-journey.mp3', 'eastern-night.mp3',
]

export function pickEpisodeMusic(slug, available = MUSIC_LIBRARY) {
  if (!available.length) return null
  const digest = sha256(String(slug || ''))
  const track = available[parseInt(digest.slice(0, 8), 16) % available.length]
  /* إزاحة بين ٠ و٢٤ ثانية داخل المقطوعة: مدخلٌ مختلف للنغمة نفسها. */
  const offset = (parseInt(digest.slice(8, 14), 16) % 24)
  return { track, offset }
}

/* قصُّ الهواء الميّت من طرفَي المداخلة وتنظيفٌ خفيف: عتبة ‎-42dB‎ تلتقط
   الصمت لا الهمس، و‎afftdn‎ عند ‎nr=10‎ يزيل أزيز الخلفية بلا ذلك الرنين
   المعدني الذي يفضح المعالجة. النبرة والوقفات داخل الجملة تبقى كما نطقها. */
/* الطلب صار يحمل عدّة مداخلات، لكن الجدول الزمني (نص الإذاعة المتزامن) يحتاج
   ملفاً لكل مداخلة. فبدل أن نضحّي بأحدهما، تُقرأ مواضع الصمت داخل المقطع
   ونُقصّ عندها: النموذج يترك بين متحدّثٍ وآخر صمتاً أطول ممّا يتركه داخل
   الجملة، فأطولُ (ن-١) صمتةً هي حدود المداخلات. وإن لم يُطابق العدد نجرب
   حساسيةً أعلى على الأخذ نفسه؛ ولا نعيد توليد مداخلات مستقلة. */
function detectSilences(file, minDurationSec = 0.24) {
  const minDuration = Math.max(0.04, Math.min(1, Number(minDurationSec) || 0.24))
  const run = spawnSync(FFMPEG, ['-hide_banner','-nostats','-i',file,'-af',`silencedetect=noise=-38dB:d=${minDuration}`,'-f','null','-'], { encoding:'utf8' })
  const log = `${run.stderr || ''}`
  const gaps = []
  const starts = [...log.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]))
  for (let i = 0; i < starts.length; i += 1) {
    const from = starts[i]
    const to = Number.isFinite(ends[i]) ? ends[i] : null
    if (to === null || !(to > from)) continue
    gaps.push({ from, to, mid: (from + to) / 2, span: to - from })
  }
  return gaps
}

/* اختيار حدود المداخلات داخل مقطعٍ واحد.
 *
 * كان الاختيار «أطولَ (ن‑١) صمتة» — وهو يصحّ لأربع مداخلاتٍ ويسقط لسبعٍ
 * وثلاثين: الوقفةُ التأمليةُ داخل الجملة قد تطول أكثر من الفاصل بين متحدّثَين،
 * فتُنتزع حدوداً في غير مواضعها. رصده القياس في تشغيلة ٣١٨٧٨٥٠٧٣٤٩: الدور
 * السادس نال ١٨٫٩ ثانيةً (خمسةَ أضعاف حقّه) والثاني والثلاثون ٠٫٤ ثانية.
 *
 * الصواب أن لكل مداخلةٍ حصّةً متوقّعةً من الزمن بمقدار طول نصّها، فتُحسب
 * المواضع المتوقّعة للحدود، ويُختار لكلٍّ منها أقربُ صمتةٍ إليه — يساراً
 * فيميناً كي تبقى الحدود متزايدةً ولا تتقاطع. وإن بَعُدت صمتةٌ عن موضعها
 * بأكثر من نصف متوسّط المداخلة، فالقصّ غير موثوق: يُرَدُّ ‎null‎ ويُوقف
 * التشغيل. ففشلٌ واضح خيرٌ من Voice/Accent Reset مخفي في ملفٍ يبدو ناجحاً.
 */
export function chooseSplitPoints(gaps, expectedTurns, totalSec, edgeGuardSec = 0.45, weights = null, toleranceFactor = 0.5) {
  if (expectedTurns <= 1) return []
  const inner = gaps.filter((gap) => gap.mid > edgeGuardSec && gap.mid < totalSec - edgeGuardSec)
  if (inner.length < expectedTurns - 1) return null
  if (!weights || weights.length !== expectedTurns) {
    const strongest = [...inner].sort((a, b) => b.span - a.span).slice(0, expectedTurns - 1)
    return strongest.map((gap) => gap.mid).sort((a, b) => a - b)
  }
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(w, 1), 0)
  const ordered = [...inner].sort((a, b) => a.mid - b.mid)
  const tolerance = (totalSec / expectedTurns) * Math.max(0.5, Number(toleranceFactor) || 0.5)
  const targets = []
  let acc = 0
  for (let i = 0; i < expectedTurns - 1; i += 1) {
    acc += Math.max(weights[i], 1)
    targets.push(totalSec * (acc / totalWeight))
  }
  /* الاختيار القديم كان جشعاً: حدٌّ مبكر يأخذ أفضل صمتة لنفسه ثم يزحزح
     بقية الحلقة كلها. هنا نحل الحدود معاً بـdynamic programming. المسافة
     هي الأساس، وطول الصمتة كاسر تعادل صغير فقط — فلا تُنتزع وقفة تأملية
     بعيدة لمجرد أنها أطول. */
  const maxSpan = Math.max(...ordered.map((gap) => gap.span), 0.04)
  const rows = targets.map(() => Array(ordered.length).fill(null))
  for (let boundary = 0; boundary < targets.length; boundary += 1) {
    for (let gapIndex = boundary; gapIndex < ordered.length; gapIndex += 1) {
      const distance = Math.abs(ordered[gapIndex].mid - targets[boundary])
      if (distance > tolerance) continue
      const local = Math.pow(distance / Math.max(tolerance, 0.01), 2)
        + 0.08 * (1 - Math.min(1, ordered[gapIndex].span / maxSpan))
      if (boundary === 0) {
        rows[boundary][gapIndex] = { cost: local, previous: -1 }
        continue
      }
      let best = null
      for (let previous = boundary - 1; previous < gapIndex; previous += 1) {
        const state = rows[boundary - 1][previous]
        if (!state || ordered[gapIndex].mid - ordered[previous].mid <= 0.35) continue
        const cost = state.cost + local
        if (!best || cost < best.cost) best = { cost, previous }
      }
      rows[boundary][gapIndex] = best
    }
  }
  const lastRow = rows.at(-1)
  let cursor = -1
  let bestCost = Infinity
  for (let i = 0; i < lastRow.length; i += 1) {
    if (lastRow[i] && lastRow[i].cost < bestCost) { bestCost = lastRow[i].cost; cursor = i }
  }
  if (cursor < 0) return null
  const selected = []
  for (let boundary = targets.length - 1; boundary >= 0; boundary -= 1) {
    selected.push(ordered[cursor].mid)
    cursor = rows[boundary][cursor].previous
  }
  return selected.reverse()
}

const alignmentToken = (value) => String(value || '')
  .normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06EDـ]/gu, '')
  .replace(/[أإآٱ]/gu, 'ا').replace(/[ؤئ]/gu, 'ء').replace(/ى/gu, 'ي')
  .replace(/ة/gu, 'ه').replace(/ض/gu, 'ظ').replace(/گ/gu, 'ق')
  .replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()

const alignmentTokens = (value) => String(value || '').split(/\s+/u).map(alignmentToken).filter(Boolean)

const tokenDistance = (left, right) => {
  if (left === right) return 0
  if (!left || !right) return 1
  const a = [...left], b = [...right]
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length] / Math.max(a.length, b.length)
}

const offsetSeconds = (value) => {
  const match = String(value || '').match(/^([\d.]+)s$/)
  return match ? Number(match[1]) : Number.NaN
}

export function extractWordAnnotations (interaction) {
  const found = []
  for (const step of interaction?.steps || []) {
    for (const content of step?.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type !== 'word_info') continue
        const startSec = offsetSeconds(annotation.start_offset)
        const endSec = offsetSeconds(annotation.end_offset)
        if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || !(endSec > startSec)) continue
        found.push({ text: String(annotation.text || ''), speaker: String(annotation.speaker || ''), startSec, endSec })
      }
    }
  }
  return found.sort((a, b) => a.startSec - b.startSec)
}

/* Needleman–Wunsch على كلمات النص المنطوق وكلمات الشاهد. الهدف مو تصحيح
   الكتابة من ASR؛ الهدف معرفة أي كلمةٍ من التسجيل تقابل نهاية كل مداخلة.
   التطابق القريب يُقبل لأن «ظيّج/ضيج» وتهجئات الهمزة لا تغيّر الحد الزمني. */
export function alignTranscriptBoundaries (turns, annotations, totalSec) {
  const sourceByTurn = turns.map((turn) => alignmentTokens(spokenForm(turn.text)))
  const source = sourceByTurn.flat()
  const heardWords = annotations.filter((word) => alignmentToken(word.text))
  const heard = heardWords.map((word) => alignmentToken(word.text))
  if (!source.length || !heard.length) return null
  const n = source.length, m = heard.length
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  const back = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1))
  for (let i = 1; i <= n; i += 1) { dp[i][0] = i; back[i][0] = 1 }
  for (let j = 1; j <= m; j += 1) { dp[0][j] = j; back[0][j] = 2 }
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const distance = tokenDistance(source[i - 1], heard[j - 1])
      const substitution = dp[i - 1][j - 1] + (distance === 0 ? 0 : distance <= 0.34 ? 0.35 : 1)
      const deletion = dp[i - 1][j] + 1
      const insertion = dp[i][j - 1] + 1
      if (substitution <= deletion && substitution <= insertion) { dp[i][j] = substitution; back[i][j] = 0 }
      else if (deletion <= insertion) { dp[i][j] = deletion; back[i][j] = 1 }
      else { dp[i][j] = insertion; back[i][j] = 2 }
    }
  }
  const mapping = Array(n).fill(null)
  let matched = 0; let near = 0; let i = n; let j = m
  while (i > 0 || j > 0) {
    const direction = back[i][j]
    if (i > 0 && j > 0 && direction === 0) {
      const distance = tokenDistance(source[i - 1], heard[j - 1])
      if (distance <= 0.34) { mapping[i - 1] = j - 1; matched += 1; if (distance > 0) near += 1 }
      i -= 1; j -= 1
    } else if (i > 0 && (j === 0 || direction === 1)) i -= 1
    else j -= 1
  }
  const similarity = 1 - dp[n][m] / Math.max(n, m)
  const coverage = matched / n
  const cuts = []
  let sourceCursor = 0
  for (let turn = 0; turn < turns.length - 1; turn += 1) {
    sourceCursor += sourceByTurn[turn].length
    let leftSource = sourceCursor - 1
    while (leftSource >= 0 && mapping[leftSource] === null) leftSource -= 1
    let rightSource = sourceCursor
    while (rightSource < mapping.length && mapping[rightSource] === null) rightSource += 1
    if (leftSource < 0 || rightSource >= mapping.length) return null
    const left = heardWords[mapping[leftSource]]
    const right = heardWords[mapping[rightSource]]
    if (!left || !right || !(right.startSec >= left.endSec) || right.startSec - left.endSec > 1.8) return null
    cuts.push((left.endSec + right.startSec) / 2)
  }
  const speakerVotes = turns.map((turn, turnIndex) => {
    const start = sourceByTurn.slice(0, turnIndex).reduce((sum, words) => sum + words.length, 0)
    const indexes = mapping.slice(start, start + sourceByTurn[turnIndex].length).filter(Number.isInteger)
    const counts = new Map()
    for (const index of indexes) {
      const speaker = heardWords[index]?.speaker
      if (speaker) counts.set(speaker, (counts.get(speaker) || 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  })
  const timeBounds = [0, ...cuts, totalSec]
  const perTurnCoverage = []
  const perTurnHeardRatio = []
  let tokenCursor = 0
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const sourceCount = sourceByTurn[turnIndex].length
    const mappedCount = mapping.slice(tokenCursor, tokenCursor + sourceCount).filter(Number.isInteger).length
    const heardCount = heardWords.filter((word) => {
      const middle = (word.startSec + word.endSec) / 2
      return middle >= timeBounds[turnIndex] && middle < timeBounds[turnIndex + 1]
    }).length
    perTurnCoverage.push(Number((mappedCount / Math.max(sourceCount, 1)).toFixed(4)))
    perTurnHeardRatio.push(Number((heardCount / Math.max(sourceCount, 1)).toFixed(4)))
    tokenCursor += sourceCount
  }
  const labels = [...new Set(speakerVotes.filter(Boolean))]
  const expectedLabel = new Map()
  let speakerMatches = 0; let speakerMeasured = 0
  turns.forEach((turn, turnIndex) => {
    const label = speakerVotes[turnIndex]
    if (!label) return
    speakerMeasured += 1
    if (!expectedLabel.has(turn.speaker)) expectedLabel.set(turn.speaker, label)
    if (expectedLabel.get(turn.speaker) === label) speakerMatches += 1
  })
  const speakerAgreement = speakerMeasured ? speakerMatches / speakerMeasured : 0
  const speakerMappingDistinct = expectedLabel.size === 2 && new Set(expectedLabel.values()).size === 2
  const validCuts = cuts.length === turns.length - 1
    /* الرد الكويتي الخاطف «إي» قد يخلص خلال ربع ثانية. شهادة الكلمات تعرف
       حدوده، فلا نفرض عليه حد الصمت التخميـني القديم (0.35ث). */
    && cuts.every((cut, index) => cut > (index ? cuts[index - 1] : 0) + 0.18 && cut < totalSec - 0.18)
  return {
    cuts: validCuts ? cuts : null,
    similarity: Number(similarity.toFixed(4)), coverage: Number(coverage.toFixed(4)),
    nearMatches: near, sourceWordCount: n, heardWordCount: m,
    speakerLabels: labels, speakerAgreement: Number(speakerAgreement.toFixed(4)), speakerMappingDistinct, speakerVotes,
    perTurnCoverage, perTurnHeardRatio,
  }
}

async function uploadForTranscription (file) {
  const bytes = readFileSync(file)
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': KEY, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: `kuwaiti-alignment-${slug}-${SEED}` } }),
  })
  if (!start.ok) throw new Error(`رفع شاهد المحاذاة HTTP ${start.status}: ${(await start.text()).slice(0, 300)}`)
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Files API لم يرجع رابط رفع شاهد المحاذاة')
  const upload = await fetch(uploadUrl, {
    method: 'POST', headers: { 'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: bytes,
  })
  const body = await upload.json().catch(() => null)
  if (!upload.ok || !body?.file?.uri) throw new Error(`تعذّر تثبيت شاهد المحاذاة: ${JSON.stringify(body || {}).slice(0, 300)}`)
  return body.file
}

async function transcriptionWitness (file, turns) {
  let uploaded = null
  try {
    uploaded = await uploadForTranscription(file)
    let last = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: TRANSCRIBE_MODEL,
          input: [{ type: 'audio', uri: uploaded.uri, mime_type: uploaded.mimeType || uploaded.mime_type || 'audio/wav' }],
          /* الواجهة الحية في 27 أغسطس رفضت custom_vocabulary مع timestamps
             رغم اجتماعها في مثال الوثائق. المطابقة المعجمية تجري محلياً
             بعد التفريغ، لذلك نحذف التوجيه من الطلب ولا نخسر أي بوابة. */
          generation_config: { transcription_config: { language_codes: [],
            mode: { type: 'verbatim', diarization_mode: 'speaker', timestamp_granularities: ['word'] } } },
        }),
      })
      const raw = await response.text()
      let body = null
      try { body = JSON.parse(raw) } catch { /* diagnosed below */ }
      if (response.ok && body?.status === 'completed') return { body, words: extractWordAnnotations(body) }
      if (response.ok && body?.id) {
        const interactionPath = String(body.id).startsWith('interactions/')
          ? String(body.id) : `interactions/${encodeURIComponent(body.id)}`
        for (let poll = 1; poll <= 12; poll += 1) {
          await sleep(Math.min(5000, 750 * poll))
          const follow = await fetch(`https://generativelanguage.googleapis.com/v1beta/${interactionPath}`, {
            headers: { 'x-goog-api-key': KEY },
          })
          const followBody = await follow.json().catch(() => null)
          if (follow.ok && followBody?.status === 'completed') {
            return { body: followBody, words: extractWordAnnotations(followBody) }
          }
          if (!follow.ok || followBody?.status === 'failed') {
            last = new Error(followBody?.error?.message || `تعذّر سحب شاهد المحاذاة HTTP ${follow.status}`)
            break
          }
        }
        if (last) continue
      }
      last = new Error(body?.error?.message || `Transcribe HTTP ${response.status}: ${raw.slice(0, 300)}`)
      if (response.status !== 429 && response.status < 500) break
      await sleep(1000 * attempt)
    }
    throw last || new Error('تعذّر شاهد التفريغ الصوتي')
  } finally {
    if (uploaded?.name) fetch(`https://generativelanguage.googleapis.com/v1beta/${uploaded.name}`, {
      method: 'DELETE', headers: { 'x-goog-api-key': KEY },
    }).catch(() => {})
  }
}

function cutChunkAt (file, cuts, expected, total, outPrefix, minSegmentSec = 0.35) {
  const bounds = [0, ...cuts, total]
  const parts = []
  for (let i = 0; i < expected; i += 1) {
    const from = bounds[i], to = bounds[i + 1]
    if (!(to - from > minSegmentSec)) return null
    const part = `${outPrefix}-${String(i + 1).padStart(2, '0')}.wav`
    rmSync(part, { force: true })
    const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-ss',from.toFixed(3),'-t',(to - from).toFixed(3),
      '-i',file,'-ar','24000','-ac','1','-c:a','pcm_s16le',part], { encoding:'utf8' })
    if (run.status !== 0 || !existsSync(part)) { for (const made of parts) rmSync(made, { force: true }); return null }
    parts.push(part)
  }
  return parts
}

async function splitChunk(file, chunkTurnsList, outPrefix) {
  const expected = chunkTurnsList.length
  if (expected === 1) return [file]
  let total = 0
  try { total = duration(file) } catch { return null }
  const weights = chunkTurnsList.map((turn) => String(turn.text || '').length)
  if (ALIGNMENT_MODE === 'required' || ALIGNMENT_MODE === 'prefer') {
    try {
      const witness = await transcriptionWitness(file, chunkTurnsList)
      const aligned = alignTranscriptBoundaries(chunkTurnsList, witness.words, total)
      const trustworthy = aligned?.cuts && aligned.similarity >= 0.78 && aligned.coverage >= 0.84
        && aligned.speakerLabels.length === 2 && aligned.speakerMappingDistinct && aligned.speakerAgreement >= 0.88
      if (trustworthy) {
        const parts = cutChunkAt(file, aligned.cuts, expected, total, outPrefix, 0.18)
        if (parts) {
          splitAlignmentAudits.push({ method: 'gemini-3.5-word-timestamps+diarization', model: TRANSCRIBE_MODEL, ...aligned, cuts: aligned.cuts.map((cut) => Number(cut.toFixed(3))) })
          console.log(`✓ شاهد الأدوار: ${aligned.sourceWordCount} كلمة · تطابق ${(aligned.similarity * 100).toFixed(0)}٪ · تغطية ${(aligned.coverage * 100).toFixed(0)}٪ · اتفاق الصوت ${(aligned.speakerAgreement * 100).toFixed(0)}٪`)
          return parts
        }
      }
      splitAlignmentAudits.push({ method: 'gemini-3.5-word-timestamps+diarization', model: TRANSCRIBE_MODEL, ...(aligned || {}), cuts: undefined, rejected: true })
      throw new Error(`شاهد الأدوار غير حاسم (تطابق ${aligned ? (aligned.similarity * 100).toFixed(0) : '0'}٪ · تغطية ${aligned ? (aligned.coverage * 100).toFixed(0) : '0'}٪ · أصوات ${aligned?.speakerLabels?.length || 0})`)
    } catch (error) {
      if (ALIGNMENT_MODE === 'required') throw error
      console.warn(`⚠️ شاهد الأدوار تعذّر؛ رجوع محافظ لمحاذاة الصمت: ${error.message}`)
    }
  }
  /* إذا ما ظهرت حدودٌ كافية عند 240ms، نرخي كاشف الصمت على **نفس الأخذ**.
     ما نعيد توليد نصفٍ أو دورٍ مستقل، لأن نجاح القص لا يساوي خسارة الهوية. */
  for (const minDurationSec of [0.24, 0.14, 0.08, 0.06, 0.04]) {
    /* عند الأخذ السريع قد يكون حدّ المتحدثين 40–70ms فقط. هذا مو سبب
       لتوليد دور منفرد أو رفض جلسة سليمة: نرخي كاشف الصمت على الأخذ نفسه،
       ونوسّع نافذة الموضع قليلاً. القطع لا يحذف أي عينة؛ الأجزاء تُعاد
       متجاورة كما كانت، وبوابتا الزمن والهوية ترفضان الاختيار الشاذ. */
    const toleranceFactor = minDurationSec <= 0.08 ? 0.75 : 0.5
    const cuts = chooseSplitPoints(detectSilences(file, minDurationSec), expected, total, 0.45, weights, toleranceFactor)
    if (!cuts) continue
    const parts = cutChunkAt(file, cuts, expected, total, outPrefix)
    if (parts?.length === expected) return parts
  }
  return null
}

function tightenChunk(input, output) {
  const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',input,
    '-af','silenceremove=start_periods=1:start_silence=0.06:start_threshold=-42dB:detection=peak,'
      + 'areverse,silenceremove=start_periods=1:start_silence=0.10:start_threshold=-42dB:detection=peak,areverse,'
      + 'afftdn=nr=10:nf=-30:tn=1,highpass=f=70',
    '-ar','24000','-ac','1','-c:a','pcm_s16le',output], { encoding:'utf8' })
  /* لو تعذّر التنظيف يُستعمل الأصل: تأخيرُ حلقةٍ خيرٌ من إسقاطها. */
  if (run.status !== 0 || !existsSync(output)) return input
  try { if (duration(output) < 0.35) return input } catch { return input }
  return output
}

export function silenceCompactionIntervals(gaps, totalSec, triggerMs = LONG_SILENCE_TRIGGER_MS, capMs = MAX_INTERNAL_SILENCE_MS) {
  const trigger = triggerMs / 1000
  const cap = capMs / 1000
  const long = gaps.filter((gap) => gap.span > trigger && gap.from > 0.05 && gap.to < totalSec - 0.05)
    .sort((a, b) => a.from - b.from)
  const intervals = []
  let cursor = 0
  for (const gap of long) {
    const removeFrom = gap.from + cap / 2
    const removeTo = gap.to - cap / 2
    if (!(removeTo > removeFrom) || removeFrom < cursor) continue
    intervals.push({ from: cursor, to: removeFrom })
    cursor = removeTo
  }
  if (cursor < totalSec) intervals.push({ from: cursor, to: totalSec })
  return intervals
}

function compactLongSilences(input, output) {
  if (!(MAX_INTERNAL_SILENCE_MS > 0)) return input
  let before = 0
  try { before = duration(input) } catch { return input }
  const intervals = silenceCompactionIntervals(detectSilences(input), before)
  if (intervals.length <= 1) return input
  const filters = intervals.map((part, index) =>
    `[0:a]atrim=start=${part.from.toFixed(4)}:end=${part.to.toFixed(4)},asetpts=PTS-STARTPTS[p${index}]`)
  filters.push(`${intervals.map((_, index) => `[p${index}]`).join('')}concat=n=${intervals.length}:v=0:a=1[out]`)
  const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-i',input,
    '-filter_complex',filters.join(';'),'-map','[out]','-ar','24000','-ac','1','-c:a','pcm_s16le',output], { encoding:'utf8' })
  if (run.status !== 0 || !existsSync(output)) return input
  let after = 0
  try { after = duration(output) } catch { return input }
  /* حاجز أمان: انكماش فوق 35٪ يعني أن العتبة التقطت كلاماً لا صمتاً. */
  if (after < 0.35 || after < before * 0.65) return input
  silenceCompaction.calls += 1
  silenceCompaction.removedSec += Math.max(0, before - after)
  return output
}

function prepareGeneratedChunk(input, stem) {
  const edges = tightenChunk(input, `${stem}.edges.wav`)
  return compactLongSilences(edges, `${stem}.clean.wav`)
}

function speechStartAfter(previous, previousTurn, currentTurn, preserveNativeTiming = PRESERVE_NATIVE_TURN_TIMING) {
  const end = previous.startSec + previous.durationSec
  const requestedOverlap = Math.max(0, Math.min(150, Number(currentTurn?.overlapMs || 0)))
  const quickCrossSpeakerReply = previousTurn?.speaker !== currentTurn?.speaker
    && currentTurn?.deliveryType === 'briefReaction'
  if (preserveNativeTiming) {
    return quickCrossSpeakerReply && requestedOverlap > 0
      ? Math.max(0, end - requestedOverlap / 1000)
      : end
  }
  if (requestedOverlap > 0) return Math.max(0, end - requestedOverlap / 1000)
  return end + Math.max(80, Math.min(1200, Number(previousTurn?.pauseAfterMs || 320))) / 1000
}

/* الموسيقى تُعاير إلى مستوىً مُعلَن، لا تُضرب بمعاملٍ أعمى.
 *
 * المعامل الخطّي (volume=0.12) يفترض أن كل المقطوعات بالجهارة نفسها، وهذا
 * غير صحيح: الفارق بين مقطوعةٍ وأخرى في المكتبة يبلغ عشرة ديسيبل. وحين صارت
 * كل حلقةٍ تختار نغمتها، صار مستوى الموسيقى يتغيّر بين حلقةٍ وأخرى بلا سبب.
 * والأسوأ أن سلسلة الإتقان (ضاغط + loudnorm) تُطبَّق بعدها على المزيج كله،
 * فترفع أول الملف وتترك آخره — ولهذا خرجت خاتمة v4 عند ‎-32dB‎ بينما مقدّمتها
 * عند ‎-15dB‎، والفارق المفترض بينهما ديسيبلان ونصف لا سبعة عشر.
 *
 * الحلّ: loudnorm على المقطع نفسه إلى هدفٍ ثابت، ثم التلاشي. النتيجة أن
 * المقدّمة والخاتمة والجسر تُسمع بالمستوى نفسه في الحلقات الـ144 كلها، أياً
 * كانت المقطوعة وأياً كان موضع الاقتطاع منها.
 */
function makeMusicClip(source, file, seconds, targetLufs, fadeInSec, fadeOutSec, startSec = 0) {
  const fadeOutAt = Math.max(fadeInSec + 0.15, seconds - fadeOutSec)
  const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-ss',String(startSec),'-i',source,'-t',String(seconds),
    '-af',`loudnorm=I=${targetLufs}:TP=-3:LRA=7,afade=t=in:d=${fadeInSec},afade=t=out:st=${fadeOutAt.toFixed(2)}:d=${fadeOutSec}`,
    '-ar','24000','-ac','1','-c:a','pcm_s16le',file], { encoding:'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || `فشل إنشاء مقطع موسيقي: ${file}`)
  return file
}

function buildTimedMaster(turns, files, output, episodeSlug = '') {
  if (turns.length !== files.length) throw new Error('precise timing requires one generated file per dialogue turn')
  const library = MUSIC_LIBRARY.filter((name) => existsSync(resolve(ROOT, 'music', name)))
  const chosen = MUSIC_OVERRIDE ? { track: MUSIC_OVERRIDE, offset: 0 } : pickEpisodeMusic(episodeSlug, library)
  const musicPath = chosen ? (MUSIC_OVERRIDE || resolve(ROOT, 'music', chosen.track)) : ''
  const hasMusic = Boolean(musicPath) && existsSync(musicPath)
  if (hasMusic) console.log(`♪ نغمة الحلقة: ${chosen.track}${chosen.offset ? ` (من الثانية ${chosen.offset})` : ''}`)
  const items = []
  /* الكلام يدخل تحت ذيل المقدّمة لا بعد صمتها، تماماً كالفصحى. */
  let cursor = hasMusic ? Math.max(0.20, MUSIC.introSec - MUSIC.introOverlapSec) : 0.20
  for (let i = 0; i < turns.length; i += 1) {
    const turn = turns[i]
    /* الختام جزءٌ من الـTake الحالي مثل بقية الأدوار. نثبت نطق الاسم في
       spokenForm/kuwaiti-pronunciation.json، ولا نلصق صوتاً قديماً يغيّر
       جرس نورة أو فهد عند آخر جملة. */
    const file = files[i]
    const dur = duration(file)
    if (i > 0) {
      const previous = items.at(-1)
      cursor = speechStartAfter(previous, turns[i - 1], turn)
    }
    items.push({ index: i, file, startSec: cursor, durationSec: dur, isBridge: false })
  }

  const bridgeItems = []
  if (hasMusic) {
    let bridgeNo = 0
    for (let i = 0; i < turns.length - 1; i += 1) {
      if (!turns[i].musicBridgeAfter) continue
      const current = items[i]
      const next = items[i + 1]
      const bridgeFile = resolve(TMP, `bridge-${String(++bridgeNo).padStart(2, '0')}.wav`)
      const bridgeDuration = MUSIC.bridgeSec
      makeMusicClip(musicPath, bridgeFile, bridgeDuration, MUSIC.bridgeLufs, 0.22, 0.70, chosen.offset + MUSIC.introSec + 1.2)
      /* وكذلك الجسر: كان يبدأ قبل نهاية المداخلة بـ٠.١٢ ثانية فيبتلع آخرها. */
      const bridgeStart = current.startSec + current.durationSec + 0.10
      bridgeItems.push({ file: bridgeFile, startSec: bridgeStart, durationSec: bridgeDuration, isBridge: true })
      /* [٢٠ أغسطس ٢٠٢٦] كان المتحدّث التالي يدخل تحت ذيل الجسر (آخر ٠.٣ث)
         فتُداس أول كلمته — سمعها الدكتور في «عشان جذي الإصلاح…»: «ما خلاه
         يكمل على طول شغل الجسر». صار الكلام يبدأ بعد انتهاء الجسر كاملاً. */
      next.startSec = Math.max(current.startSec + current.durationSec + 0.18, bridgeStart + MUSIC.bridgeSec + 0.15)
      for (let j = i + 2; j < items.length; j += 1) {
        const prev = items[j - 1]
        items[j].startSec = speechStartAfter(prev, turns[j - 1], turns[j])
      }
    }
  }

  /* المقدّمة تفتح الحلقة والخاتمة تغلقها؛ الكلام يعبر تحت ذيليهما فلا يبدأ
     المجلس ببرودٍ ولا ينقطع فجأةً عند آخر كلمة. */
  const identity = { intro: null, outro: null }
  if (hasMusic) {
    const introFile = makeMusicClip(musicPath, resolve(TMP, 'music-intro.wav'), MUSIC.introSec, MUSIC.introLufs, MUSIC.introFadeIn, MUSIC.introFadeOut, chosen.offset)
    identity.intro = { file: introFile, startSec: 0, durationSec: MUSIC.introSec, isMusic: true, role: 'intro' }
    identity.track = chosen.track
    const lastSpoken = items.at(-1)
    /* [٢١ أغسطس ٢٠٢٦] كانت الخاتمة تبدأ قبل نهاية آخر كلمةٍ بـ٠.٧٦ ثانية
       (outroOverlapSec) — تداخلٌ مقصودٌ لتفادي القطع المفاجئ، لكنه كان
       **يبتلع آخر الكلام**. سمعها الدكتور: «حتى اسمي ما كمّله، ظهرت الموسيقى».
       فصارت تبدأ بعد آخر كلمةٍ بربع ثانية: لا ابتلاع ولا قطعٌ مفاجئ. */
    const outroStart = lastSpoken.startSec + lastSpoken.durationSec + 0.25
    const outroFile = makeMusicClip(musicPath, resolve(TMP, 'music-outro.wav'), MUSIC.outroSec, MUSIC.outroLufs, MUSIC.outroFadeIn, MUSIC.outroFadeOut, chosen.offset + MUSIC.introSec + 1.2)
    identity.outro = { file: outroFile, startSec: outroStart, durationSec: MUSIC.outroSec, isMusic: true, role: 'outro' }
  }

  const musicItems = [identity.intro, identity.outro].filter(Boolean)
  const all = [...items, ...bridgeItems, ...musicItems].sort((a,b)=>a.startSec-b.startSec)
  const ffInputs = []; const filters = []
  all.forEach((item, idx) => {
    ffInputs.push('-i', item.file)
    const delay = Math.max(0, Math.round(item.startSec * 1000))
    filters.push(`[${idx}:a]adelay=${delay}|${delay}[a${idx}]`)
  })
  const mixed = all.map((_,idx)=>`[a${idx}]`).join('')
  filters.push(`${mixed}amix=inputs=${all.length}:normalize=0[mix]`)
  /* سلسلة الإتقان: مرشّح ٦٥Hz يرفع الهدير، ضاغطٌ لطيف (نسبة ١٫٧) يثبّت
     الحضور بلا سحق الديناميكا، وloudnorm عند ‎-16 LUFS‎ وذروة ‎-1.5dBTP‎ —
     معيار البودكاست. LRA ٩ بدل ١١: تماسكٌ أعلى فلا يضطرّ السامع إلى رفع
     الصوت وخفضه بين مداخلةٍ وأخرى. */
  filters.push('[mix]highpass=f=65,acompressor=threshold=-19dB:ratio=1.7:attack=15:release=200,loudnorm=I=-16:TP=-1.5:LRA=9[out]')
  const total = Math.max(...all.map((item)=>item.startSec+item.durationSec), 0) + 0.35
  const result = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y',...ffInputs,'-filter_complex',filters.join(';'),'-map','[out]','-t',total.toFixed(3),
    '-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','160k',output], { encoding:'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'فشل precise mastering')
  return { items, bridges: bridgeItems, identity, durationSec: total }
}

function timelineFor(turns, assembly) {
  const utterances = assembly.items.map((item, index) => ({
    index,
    speaker: turns[index].speaker === 'male' ? 'فهد' : 'نورة',
    text: turns[index].text,
    startSec: Number(item.startSec.toFixed(3)),
    endSec: Number((item.startSec + item.durationSec).toFixed(3)),
    /* في الوضع الطبيعي الصمت/الدخول جزءٌ من الملف نفسه، فلا نكذب في
       التايملاين ونسمي الخطة القديمة توقيتاً منفذاً. نحفظها كمرجع فقط. */
    pauseAfterMs: PRESERVE_NATIVE_TURN_TIMING ? 0 : Number(turns[index].pauseAfterMs || 0),
    overlapMs: PRESERVE_NATIVE_TURN_TIMING ? 0 : Number(turns[index].overlapMs || 0),
    plannedPauseAfterMs: Number(turns[index].pauseAfterMs || 0),
    plannedOverlapMs: Number(turns[index].overlapMs || 0),
    musicBridgeAfter: Boolean(turns[index].musicBridgeAfter),
    /* [٢١ أغسطس ٢٠٢٦] يُحفظ للتشخيص: غيابُه عن الوصف أوهمني أن توجيهات الأداء
       مفقودةٌ من المصدر، وهي موجودة. الوصف الناقص يُنتج تشخيصاً خاطئاً. */
    deliveryType: turns[index].deliveryType || null,
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
    nativeTurnTimingPreserved: PRESERVE_NATIVE_TURN_TIMING,
    chapters, utterances, musicBridges: assembly.bridges.map((b)=>({ startSec:Number(b.startSec.toFixed(3)), durationSec:b.durationSec })),
    musicIdentity: {
      intro: assembly.identity?.intro ? { startSec: 0, durationSec: MUSIC.introSec, targetLufs: MUSIC.introLufs } : null,
      outro: assembly.identity?.outro ? { startSec: Number(assembly.identity.outro.startSec.toFixed(3)), durationSec: MUSIC.outroSec, targetLufs: MUSIC.outroLufs } : null,
    },
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
  const audibleRunsProbe = audibleSpeakerRuns([
    { speaker:'male', text:'أول فكرة.', deliveryType:'statement', pauseAfterMs:100, musicBridgeAfter:false },
    { speaker:'male', text:'وتكملتها.', deliveryType:'reflection', pauseAfterMs:320, musicBridgeAfter:false },
    { speaker:'female', text:'رد قبل الجسر.', deliveryType:'response', pauseAfterMs:280, musicBridgeAfter:true },
    { speaker:'female', text:'رد عقب الجسر.', deliveryType:'conclusion', pauseAfterMs:400, musicBridgeAfter:false },
  ])
  assert.deepEqual(audibleRunsProbe.map((turn) => [turn.speaker, turn.text, turn.musicBridgeAfter, turn._sourceTurnCount]), [
    ['male', 'أول فكرة. وتكملتها.', false, 2],
    ['female', 'رد قبل الجسر.', true, 1],
    ['female', 'رد عقب الجسر.', false, 1],
  ], 'السطور المتجاورة للشخص نفسه تصير مداخلة مسموعة، والجسر لا يُبتلع')
  /* الوضع المعتمد: الحلقة كلها نداءٌ واحدٌ — نبرةٌ واحدةٌ بلا تبدّل. */
  assert.equal(chunkTurns(turns).length, 1, 'الحلقة تُولَّد بنداءٍ واحدٍ فتثبت النبرة')
  assert.equal(SPLIT_AT_BRIDGES, false, 'قفل الجسر مطفأ داخل المحرك مهما كان إعداد workflow القديم')
  assert.equal(chunkTurns(turns, { maxTurns: 8 }).length, 1,
    'الجسر لا يقطع TTS حتى مع سقف مداخلات صغير يكفي الحلقة')
  /* التقسيم الاضطراري سببه سقف الطلب وحده، لا موقع الموسيقى. */
  const chunks = chunkTurns(turns, { maxTurns: 2 })
  assert.equal(chunks.length, 2, 'سقف الطلب وحده يفرض جزأين عند الضرورة')
  assert.deepEqual(chunks.map((chunk) => chunk.length), [2, 1])
  const bridged = chunkTurns(turns, { splitAtBridges: true })
  assert.equal(bridged.length, 1, 'حتى المتغير التاريخي لا يستطيع تحويل الجسر إلى Scene Reset')
  /* [٢٢ أغسطس] الافتراض صار C، فتأكيدات الجدار تُثبَّت على 'full' صراحةً —
     تبقى حارسةً عليه إن عاد يوماً، ولا تكذب على الوضع الجاري. */
  const prompt = promptFor(chunks[0],0,chunks.length,'full')
  /* عقد الأداء الكويتي: هذه البنود هي ما يفصل «كويتيّاً طبيعياً» عن «مقلّدٍ
     للهجة»، وحذفُ أيّها سهوٌ يعود بالأداء إلى خليجيٍّ عام. */
  assert.match(prompt,/urban Kuwait City/i, 'هدف اللهجة: حضري كويتي محدّد')
  assert.match(prompt,/never someone imitating the accent/i, 'محكّ الأصالة')
  assert.match(prompt,/generic "Gulf" accent/i, 'منع الخليجي العام')
  assert.match(prompt,/Emirati, Iraqi, Iranian\/Persian, Saudi/i, 'منع اللهجات المجاورة بالاسم — والعراقي معها (كان غائباً وهو مسموع)')
  /* الأقفال الثلاثة (١٤ أغسطس ٢٠٢٦) — أمر الدكتور: «تحذير صارم جداً». */
  assert.match(prompt,/Seven registers are FORBIDDEN/i, 'القفل الأول: الحظر السباعي المسمّى في الرأس')
  assert.match(prompt,/NOURA — TARGETED CORRECTION/i, 'تصويب نورة: العطب المسموع يعيش في سطورها فالعلاج يصوَّب إليها')
  assert.match(prompt,/ACCENT STRENGTH/i, 'قسم اللكنة: الثقل مطلوبٌ لا مجرّد الصواب')
  /* قياس ١٥ أغسطس: الفجوة بين الحنجرتين ضاقت من ٣٤ هرتزاً إلى ٢٢ حين رُكّز
     على اللهجة وحدها، فسمعهما الدكتور صوتاً واحداً. فصل الشخصيتين شرطٌ. */
  assert.match(prompt,/TWO DISTINCT PEOPLE/i, 'فصل الشخصيتين: صوتان لا راوٍ واحد')
  /* اللهجة تُوصف من مراجعها لا من اجتهادٍ على وصف (١٦ أغسطس: «سيئة جداً»). */
  assert.match(prompt,/KUWAIT CITY URBAN PHONOLOGY/i, 'اللهجة الحضرية موصوفةٌ من مراجعها')
  assert.match(prompt,/مَسيد/, 'الجيم→ياء: أظهر علامات الحضرية عن البدوية')
  /* الحظر السباعي يسمّي اللهجات ليمنعها — وهذا مطلوب. يُفحص قسم اللهجة وحده. */
  const phon = prompt.slice(prompt.indexOf('KUWAIT CITY URBAN PHONOLOGY'), prompt.indexOf('TWO DISTINCT PEOPLE'))
  assert.ok(!/قاهري|مصري|Egyptian|Cairo|نجدي/i.test(phon), 'لا تشبيهٌ بلهجةٍ أخرى في وصف اللهجة')
  assert.match(prompt,/LIGHT ARTICULATION/i, 'الترقيق: القاف خفيفةٌ غير مفخّمة (حكمه ١٦ أغسطس: «القاف حيل فخّمها… احنا نرقق»)')
  /* حكمه ٢٠ أغسطس: «القاف دايم هنا قاعد يقلقلها وهذا خطأ بالكويتي».
     القلقلة غير التفخيم — كانت غائبةً عن الأمر كلّه فأُضيفت في موضعين. */
  assert.match(prompt,/لا قلقلةَ في القاف أبداً/u, 'منعُ القلقلة منصوصٌ في الترقيق')
  assert.match(prompt,/ولا قلقلةَ في القاف بحالٍ من الأحوال/u, 'منعُ القلقلة منصوصٌ في الأصوات الحضرية')
  assert.match(prompt,/قُلها خفيفةً غيرَ مفخّمة/, 'وصف القاف بالعربية بلا تشبيهٍ بلهجة')
  /* لا تشبيه بلهجةٍ أخرى في **وصف** الأصوات — الحظر السباعي يسمّي اللهجات
     ليمنعها، وهذا مطلوب. يُفحص قسم الترقيق وحده. (كارثة «الجيم القاهرية».) */
  const lightBlock = prompt.slice(prompt.indexOf('LIGHT ARTICULATION'), prompt.indexOf('TWO DISTINCT PEOPLE'))
  assert.ok(!/قاهري|مصري|Egyptian|Cairo|Najdi|نجدي/i.test(lightBlock), 'لا تشبيهٌ بلهجةٍ أخرى في وصف الترقيق')
  /* «احنا ما نفخم ترى الكلمات… احنا دايم نرقق» — حكمه ١٥ أغسطس. كان البرومت
     يطلب الثقل صراحةً («Kuwaiti is heavier and fuller in the mouth») وهو عكس
     الحقيقة، فأخرج تفخيماً بدوياً. لا يعود طلبُ ثقلٍ إلى البرومت أبداً. */
  /* يُمنع **طلبُ** الثقل لا نفيُه: «Not a heavy separate word» نفيٌ مطلوب. */
  const demandsWeight = /(?<!not a |never |no )\b(HEAVY Kuwait|thick and local|as thick as|heavier and fuller|full Kuwaiti weight|never lighter)\b/i
  assert.ok(!demandsWeight.test(prompt), 'لا يُطلب تفخيمٌ في البرومت — الكويتية الحضرية مرقَّقة')
  assert.match(prompt,/light, soft Kuwait-City Kuwaiti/, 'قفل الدور يطلب الترقيق لا التفخيم')
  /* الحرف اللاتيني في وصف الأصوات جرّ المحرّك إلى سجلٍّ أجنبي (١٥ أغسطس). */
  /* العناوين والتوجيهات بالإنجليزية مقبولة؛ المحظور نقحرةُ الأصوات نفسها
     (agrab · i-yaʿraf) — حروفٌ أعجميةٌ منقوطةٌ تُكتب بها الفارسيةُ لاتينياً. */
  /* التذكير يظهر بعد العاشر، فيُختبر على حلقةٍ بطول حقيقيّ لا على أربعة أدوار. */
  const longTurns = Array.from({ length: 25 }, (_, i) => ({
    speaker: i % 2 ? 'female' : 'male', text: `سطر رقم ${i + 1} فيه ضاد واضحة.`,
    deliveryType: 'statement', pauseAfterMs: 300, musicBridgeAfter: false,
  }))
  const longPrompt = promptFor(longTurns, 0, 1, 'full')
    /* [٢١ أغسطس ٢٠٢٦] التذكير صار عربيّاً وكل ستة أدوار، فالعدد المتوقّع تغيّر.
       يُحسب من طول النصّ لا برقمٍ ثابت، حتى لا يكذب التأكيد إن تغيّرت الوتيرة. */
    const expectedReminders = Math.floor((longTurns.length - 1) / 6)
    assert.equal((longPrompt.match(/\[تذكير — نفس لسان مدينة الكويت/g) || []).length, expectedReminders,
      'التذكير العربيّ يتخلّل النصّ مرّةً كل ستة أدوار — رُدّت من ٤ بأمره بعد أن أكثرت الأخطاء')
    assert.ok(!/\[REMINDER —/.test(longPrompt), 'لم يبقَ تذكيرٌ إنجليزيّ قديم')
    assert.ok(expectedReminders >= 2, 'النصّ الطويل يحمل تذكيرين على الأقل')
  assert.ok(!/ض/.test(longPrompt.split('\n').filter((line) => /^(Fahad|Noura):/.test(line)).join(' ')),
    'الضاد صارت ظاءً في كل سطور الصوت')
  /* والطبقة نفسها تعمل في الوضع الجاري C — الإملاء واحد في كل الرؤوس. */
  assert.ok(!/ض/.test(promptFor(longTurns, 0, 1, 'c').split('\n').filter((l) => /^(Fahad|Noura):/.test(l)).join(' ')),
    'طبقة النطق تعمل في C أيضاً — الرأس لا يمس النص المنطوق')
  assert.match(prompt,/ALWAYS the male voice/i, 'منع تبديل الأصوات: فهد ذكر دائماً ونورة أنثى دائماً')
  /* بوابة الطبقة: النطاقات لا تتلامس فلا يقع دورٌ في الجنسين معاً. */
  assert.ok(voiceSwapped(true, 180) && !voiceSwapped(true, 120) && voiceSwapped(false, 120) && !voiceSwapped(false, 180), 'بوابة الطبقة تحكم بالنطاق الصحيح')
  assert.ok(!voiceSwapped(true, 157) && !voiceSwapped(false, 157), 'المنطقة الرمادية 150-165 بريئة لا تحرق إعادات')
  assert.ok(!voiceSwapped(true, null), 'غياب القياس لا يُنذر')
  const continuityProbeTurns = Array.from({ length: 6 }, () => ({ speaker: 'female' }))
  const continuityProbe = speakerPitchContinuity(continuityProbeTurns, [178, 180, 182, 179, 145, 181])
  assert.equal(continuityProbe.anchorHz, 179, 'الثلث الأول من مداخلات نورة يثبت مرجع طبقتها')
  assert.deepEqual(continuityProbe.pointSuspects.map((finding) => finding.index), [4],
    'القفزة المفردة الأكبر من 32Hz تبقى ظاهرة للتدقيق السمعي')
  assert.equal(continuityProbe.segmentSuspects.length, 0,
    'قفزة دور واحد لا تحرق Take كامل بصوت طبيعي')
  const coherentDriftProbe = speakerPitchContinuity(
    Array.from({ length: 9 }, () => ({ speaker: 'female' })),
    [178, 180, 182, 149, 147, 151, 146, 148, 145],
  )
  assert.deepEqual(coherentDriftProbe.segmentSuspects.map((finding) => finding.segment), [2, 3],
    'انزلاق وسيط مقطعين كاملين عن نورة الأولى يُرفض')
  const timbreProbeTurns = Array.from({ length: 8 }, (_, index) => ({
    speaker: 'female', musicBridgeAfter: index === 3,
  }))
  const stableSignature = Array.from({ length: TIMBRE_BANDS }, () => 0)
  const resetSignature = Array.from({ length: TIMBRE_BANDS }, () => 2)
  const timbreProbe = speakerTimbreContinuity(timbreProbeTurns,
    timbreProbeTurns.map((_, index) => index === 4 ? resetSignature : stableSignature), 'female')
  assert.deepEqual(timbreProbe.boundarySuspects.map((finding) => finding.turn), [5],
    'ثبات Hz لا يخفي إعادة الرنين في أول دور بعد الانتقال')
  assert.match(prompt,/FINAL CHECK — LAST INSTRUCTION/i, 'القفل الثالث: الفحص الختامي بعد النص')
  assert.ok(prompt.split('\n').filter(l=>/^(Fahad|Noura):/.test(l)).every(l=>l.includes(KW_LOCK)), 'القفل الثاني: تاج اللهجة يركب كل سطر حوار بلا استثناء')
  /* [٢١ أغسطس ٢٠٢٦] الانجراف المسموع إماراتيٌّ بالاسم («مرات كويتي ومرات
     اماراتي»)، ورأس الطلب وحده لا يحرس أواخر الحلقة — فالاسم يجب أن يركب
     التاج نفسه في كل دور. التأكيد هنا يمنع كنسةً مستقبلية من إسقاطه. */
  assert.match(KW_LOCK, /never Emirati/, 'تاج كل دورٍ يسمّي الإماراتي — موضع الانجراف الذي سمعه الدكتور بعد الدقيقة الأولى')
  /* [٢١ أغسطس ٢٠٢٦ — الجولة التاسعة، بأمره «ابحث عن لهجة مدينة الكويت وحطها
     عندك… فكر بطريقة مختلفة»] المحرّك يقلّد المثال الملموس أفضل بكثير من
     امتثاله للتحريم المجرّد (وثائق Gemini TTS نفسها: السجل يُقاد بالأمثلة).
     فوُضعت عيّنة سجلٍ مرجعية بلسان مدينة الكويت — عباراتها مقتناة من كلام
     الدكتور الحقيقي في تفريغات لقاءاته (خوش سؤال · خل نكون واقعيين · وايد ·
     هالشي · ما أدري شنو · نسولف) لا من اختراعي. والمشهد صار ديوانية —
     اسم البودكاست نفسه. */
  assert.match(prompt, /REGISTER REFERENCE/, 'عيّنة السجل المرجعية حاضرة في رأس الطلب')
  assert.match(prompt, /خوش سؤال\. خل نكون واقعيين/, 'العيّنة بلسانه الحقيقي المقتنى من تفريغات لقاءاته')
  assert.match(prompt, /diwaniya/, 'المشهد ديوانية كويتية — اسم البودكاست وهويته')
  /* [٢٢ أغسطس ٢٠٢٦] فحوص الوضع الأدنى — تجربة صديق الدكتور: */
  const minimalPrompt = promptFor(chunks[0], 0, chunks.length, 'minimal')
  /* وصفة الصديق كما نقلها الدكتور (٢٢ أغسطس): عربي قصير، والمنع قائمة
     أسماء مجردة في سطر واحد — الخطر ليس ذكر الاسم بل الوصف الحي لصوت
     اللهجة (rhythm/cadence/articulation) الذي يكاد يعلّمها للمحرك. */
  assert.ok(!/FORBIDDEN|cadence|rhythm|articulation|lilt|drawl/i.test(minimalPrompt),
    'الأدنى بلا وصف حي لأصوات اللهجات المحرمة — الأسماء المجردة وحدها')
  assert.ok(minimalPrompt.includes('تجنب ولا تستخدم'), 'قائمة المنع المضغوطة بصيغة الصديق حاضرة')
  assert.ok(!/\[تذكير/.test(minimalPrompt), 'الأدنى بلا تذكيرات متخللة')
  assert.ok(minimalPrompt.includes('أهل مدينة الكويت') && minimalPrompt.includes('يرققون'),
    'الجوهر الإيجابي بألفاظ الوصفة: أهل مدينة الكويت، الترقيق لا التفخيم')
  /* [٢٢ أغسطس ٢٠٢٦] البرومت C — الفائز ٣/٣. أضيفت له بعد سماع انزلاق
     مقاطع الحلقة إلى عُماني ثم «عجمي خليجي» بطاقةُ منعٍ قصيرة بالأسماء
     فقط؛ لا وصفَ حياً لصوت أي لهجة حتى لا نزرعها في سياق المحرك. */
  const continuityGroups = continuityGenerationGroups(chunks)
  assert.equal(continuityGroups[1].warmupTurns, 2, 'إذا ما سبق إلا مداخلتان يأخذهما الإحماء كلتيهما')
  assert.deepEqual(continuityGroups[1].turns.slice(0, 2), chunks[0].slice(-2),
    'الإحماء هو التبادل السابق نفسه حرفياً')
  const warmupFixture = chunkTurns(Array.from({ length: 12 }, (_, i) => ({
    speaker: i % 2 ? 'female' : 'male',
    text: `هذي مداخلة كويتية طبيعية تحمل ست كلمات ${i}`,
    deliveryType: 'statement',
  })), { maxTurns: 6 })
  const timedWarmup = continuityGenerationGroups(warmupFixture)[1]
  assert.ok(timedWarmup.warmupEstimatedSec >= 10 && timedWarmup.warmupEstimatedSec <= 15,
    `الإحماء ${timedWarmup.warmupEstimatedSec}ث خارج نافذة 10–15ث`)
  assert.deepEqual(timedWarmup.turns.slice(0, timedWarmup.warmupTurns),
    warmupFixture[0].slice(-timedWarmup.warmupTurns), 'النافذة الزمنية هي ذيل الحوار السابق بلا إعادة ترتيب')
  const cPrompt = promptFor(continuityGroups[0].turns, 0, chunks.length, 'c',
    continuityGroups[0].warmupTurns, continuityGroups[0].warmupEstimatedSec)
  const cContinuation = promptFor(continuityGroups[1].turns, 1, chunks.length, 'c',
    continuityGroups[1].warmupTurns, continuityGroups[1].warmupEstimatedSec)
  const cSingleCall = promptFor(turns, 0, 1, 'c')
  const nouraStemPrompt = fullContextStemPrompt(cSingleCall, 'female')
  const fahadStemPrompt = fullContextStemPrompt(cSingleCall, 'male')
  const cResetProbe = promptFor(Array.from({ length: 7 }, (_, index) => turns[index % turns.length]), 0, 1, 'c')
  assert.ok(cPrompt.includes('# PRIMARY STANDARD') && cPrompt.includes('# NATIVE ACCENT ANCHOR')
    && cPrompt.trimEnd().endsWith(spokenForm(chunks[0][chunks[0].length-1].text)),
  'C ببنية المخرج والنص المنطوق آخر شيء في الطلب')
  assert.match(cPrompt, /# SAMPLE CONTEXT/, 'C يحمل مرساةً كويتيةً صامتة كما توصي بنية Google')
  assert.match(cPrompt, /# DIALECT BOUNDARY/, 'C يحمل حدَّ لهجة')
  assert.ok(!/Emirati|Omani|Najdi|Hejazi|Bahraini|Qatari|Iraqi|Persian|Egyptian|Levantine|عُماني|إماراتي|نجدي|حساوي|قطري|بحريني|عراقي|شامي|مصري/.test(cPrompt),
    'توجيه إيجابي صرف — لا اسم لهجةٍ واحدٍ في C (توصية الصديق: نحذف كل الأسماء من برومت الصوت)')
  assert.match(cPrompt, /Qaf is lexical, never mechanical/,
    'القاف معجمية لا قاعدة [q]/[g] ميكانيكية — الهوية لا تُحمل على حرف')
  assert.match(cPrompt, /70% of the performance.*20%.*10%/s,
    'وزن المحتوى: أكثره محادثة عادية وقليلٌ منه لحظة قوية')
  assert.match(cPrompt, /Pauses follow meaning and human breath, not commas, periods, colons, or line breaks/,
    'الوقفة للمعنى والنفس لا لعلامة الترقيم')
  assert.match(cPrompt, /Do not slow down before final words/,
    'لا مسرحية للكلمة الأخيرة')
  assert.match(cPrompt, /RESEARCH WITHOUT PRESENTER MODE/,
    'البحث لا يفتح وضع المذيع')
  assert.match(cPrompt, /MANDATORY TRANSCRIPT OPTIMIZATION — ACTIVE AND COMPLETED UPSTREAM/,
    'إعادة الصياغة صارت مرحلة إلزامية قبل الصوت لا شرطاً يختاره Gemini')
  assert.match(cPrompt, /The TRANSCRIPT below is that optimized spoken version/,
    'المحرك ينطق النسخة المصقولة نفسها فلا يختلف الصوت عن الـTranscript')
  assert.match(cPrompt, /Neither is a permanent interviewer or a permanent wise expert/,
    'الشخصيتان ليستا كاريكاتير سؤال/حكمة ثابتاً')
  assert.match(cPrompt, /Begin the same uninterrupted dry-voice recording/,
    'الطلب الأول يبدأ Dry Voice متصلاً بلا فصل أو انتقال')
  assert.doesNotMatch(cPrompt, /CONTINUITY CARD|PART \d+ OF|opening part|next parts/i,
    'طلب Gemini لا يحمل رقم جزء أو بطاقة تقسيم تعيد تهيئة المشهد')
  assert.match(cContinuation, /opening 2 transcript turns reproduce approximately [\d.]+ seconds/,
    'كل طلب اضطراري لاحق يعلن سياق الإحماء القريب ثم يكمل بلا reset')
  assert.match(cSingleCall, /one continuous dry-voice take/, 'الإنتاج بنداء واحد يصرّح أن الحوار Dry Voice متصل')
  assert.match(cSingleCall, /# SINGLE-SESSION ACOUSTIC CONTINUITY — ABSOLUTE PRIORITY/,
    'استمرارية الجلسة والهوية هي الأولوية المطلقة في رأس البرومت')
  assert.match(cSingleCall, /# NOURA — IMMUTABLE KUWAIT CITY PROSODY/,
    'نورة تحمل قفل prosody كويتي موجهاً بلا حشو لهجات')
  assert.match(PROMPT_VERTEX_C_HEAD, /VOICE ROUTING IS LITERAL AND IMMUTABLE[\s\S]*Conversational role never determines acoustic identity/,
    'رأس Vertex المختصر لا يعيد ربط السائل أو الخبير بصوتٍ بدل الاسم')
  assert.match(PROMPT_VERTEX_C_HEAD, /speaker handoff[\s\S]*100–180ms[\s\S]*Never place a silence that long inside a labelled line/i,
    'حد القص الصادق يقع عند تسليم المتحدث فقط وبسكتة طبيعية صغيرة')
  assert.match(cSingleCall, /# THIS EPISODE'S CONVERSATION SHAPE/,
    'كل حلقة تحمل ميلاً حوارياً حتمياً مختلفاً بدل قالب أداء واحد')
  assert.match(nouraStemPrompt, /exactly one immutable acoustic voice/,
    'مسار نورة لا يستطيع إنشاء صوت فهد')
  assert.match(nouraStemPrompt, /keeps only Noura-labelled utterances/,
    'مسار نورة يرى الحوار كله لكن المونتاج يأخذ أدوارها وحدها')
  assert.match(fahadStemPrompt, /keeps only Fahad-labelled utterances/,
    'مسار فهد يرى الحوار كله لكن المونتاج يأخذ أدواره وحدها')
  const nouraStemTranscript = nouraStemPrompt.split('# TRANSCRIPT\n\n').at(-1)
  assert.equal((nouraStemTranscript.match(/\[short pause\]/g) || []).length, turns.length - 1,
    'مسار الهوية يحمل فاصلاً صامتاً موثقاً عند كل حد دور كي لا يقص البحث')
  assert.equal(ISOLATE_SPEAKER_STEMS, false,
    'الإنتاج الافتراضي حوار حقيقي متصل؛ مسارا الفقرات اللذان كسرا الأخذ والرد ليسا fallback')
  assert.match(cSingleCall, /Speaker identity is immutable/, 'الهوية الصوتية غير قابلة لإعادة التفسير في السطور المتأخرة')
  assert.match(cSingleCall, /Later speech must not merely use the same preset voice\. It must feel like the exact same human being/,
    'المطلوب نفس الإنسان لا مجرد اسم voice ثابت')
  assert.match(cSingleCall, /Noura's earliest utterances permanently define her acoustic and dialect reference/,
    'أول نورة مرجعٌ غير قابل لإعادة التفسير في البحث والخاتمة')
  assert.match(cSingleCall, /Fahad's earliest utterances permanently define his Kuwait City cadence too[\s\S]*Never widen, harden, or recast his delivery later in the take/,
    'فهد يحافظ على الإيقاع الحضري الخفيف نفسه من البداية إلى الخاتمة')
  assert.match(cSingleCall, /The opening 20 seconds establish the permanent acoustic reference for both speakers/,
    'أول عشرين ثانية هي المرجع الصوتي الدائم للشخصيتين')
  assert.match(PROMPT_VERTEX_C_HEAD, /Never reinterpret either speaker later in the take/,
    'رأس Vertex المختصر يمنع إعادة تفسير أي متحدث بعد المرجع الافتتاحي')
  assert.match(PROMPT_VERTEX_C_HEAD, /Fahad keeps the compact Kuwait City vowel timing[\s\S]*Never widen, harden, or recast his cadence later in the take/,
    'قفل فهد نفسه حاضر في مسار Vertex الإنتاجي')
  assert.doesNotMatch(buildTimedMaster.toString(), /kuwaiti-closing-approved|CLOSING_CLIP|useFixedClosing/,
    'الختام لا يُستبدل بمقطعٍ قديم يغيّر هوية الصوت في آخر جملة')
  assert.match(buildTimedMaster.toString(), /const file = files\[i\]/,
    'كل دور، ومنه الاسم في الختام، يأتي من الـTake الحالي نفسه')
  assert.doesNotMatch(`${cPrompt}\n${cContinuation}\n${cSingleCall}`, /\b(?:music|bridge)\b/i,
    'طلب الصوت لا يذكر الموسيقى أو الجسر إطلاقاً')
  const cTranscript = cSingleCall.split('# TRANSCRIPT\n\n')[1]
  assert.ok(cTranscript && !/\n\s*\n/.test(cTranscript),
    'داخل الـTranscript ماكو فراغ كبير أو label يفصل الجلسة')
  assert.doesNotMatch(cResetProbe, /director reset|\[تذكير/u,
    'C بلا reset متخلل يقطع ذاكرة السالفة أو يعيد وضع المذيع')
  assert.equal(directionFor('statement', 'c'), '', 'الجملة العادية بلا أمر أداء')
  assert.equal(directionFor('reflection', 'c'), '', 'التأمل لا يصير اقتباساً مهماً تلقائياً')
  assert.equal(directionFor('conclusion', 'c'), '', 'الخاتمة لا تُحوّل إلى شعار')
  assert.equal(directionFor('briefReaction', 'c'), '',
    'الرد الخاطف يعتمد النص والتوقيت؛ وسمه كان يعيد تشكيل طبقة المتحدث')
  assert.ok(!cPrompt.includes(KW_LOCK), 'C بلا قفل لهجي مكرر على كل سطر')
  for (const file of ['podcast-voice-bakeoff-kw.mjs', 'podcast-voice-test.mjs', 'podcast-word-audition.mjs']) {
    const lab = readFileSync(resolve(ROOT, 'scripts', file), 'utf8')
    assert.doesNotMatch(lab, /ABSOLUTE RULE — APPLY TO EVERY SINGLE WORD|accent only\]/,
      `${file}: المختبر ما يرجع للتوجيه العدواني أو قفل اللهجة على كل سطر`)
    assert.match(lab, /Qaf is (?:normally )?lexical/,
      `${file}: المختبر يثبت القاف المعجمية لا الاستبدال الآلي`)
  }
  assert.ok(minimalPrompt.length < transcriptOf(chunks[0]).length + 900,
    'الأدنى قصير فعلاً — رأس وذيل دون ٩٠٠ حرف فوق النص')
  function transcriptOf(group){ return group.map((t)=>spokenForm(t.text)).join('\n') }
  assert.equal(PROMPT_MODE, 'c', 'الافتراض C — الفائز بأذن الدكتور في تجربة التسعة المعمّاة (٣/٣)')
  assert.match(prompt,/Comedic or folkloric exaggeration/i, 'منع المبالغة الكوميدية')
  assert.match(prompt,/NOT EMIRATI/i, 'التحذير الإماراتي الصريح — أوضح علّة شكا منها الدكتور')
    /* [٢١ أغسطس ٢٠٢٦] القفلان الجديدان يُثبَّتان بتأكيدٍ لا بثقة — درس «معلقة»:
       ملاحظةٌ تصف إصلاحاً ومدخلةٌ غائبة أضاعت ثلاث جولات قبل أن تُكتشف. */
    assert.match(prompt, /Omani \(Muscat\/Batinah\)/i, 'العُماني محظورٌ صراحةً — سمعه الدكتور وكان غائباً عن القائمة')
    assert.match(prompt, /مرساةُ اللسان/, 'المرساة العربية الإيجابية داخل الأمر')
    assert.match(prompt, /حماسُ اثنين يتناقشان/, 'المرساة تصف الحيوية لا النعومة وحدها — علّة «مو نفس حماس البداية»')
    assert.match(longPrompt, /بنفس حماس أول سطرٍ وحيويته/, 'التذكير المتخلّل يحمل الحيوية أيضاً')
    assert.match(prompt, /شخبارك؟ شلونك اليوم؟/, 'جمل المرساة النموذجية بالعربية')
    assert.ok(prompt.indexOf('مرساةُ اللسان') < prompt.indexOf('FINAL CHECK'), 'المرساة قبل الفحص الختامي لا بعده')
  /* «ترقيق» كانت تُنسب إلى الإماراتية وتُطلب للكويتية ضدُّها — وقد انقلب
     الحكم بسماعه: الكويتية الحضرية هي المرقَّقة. فيُحرس المعنى الجديد. */
  assert.match(prompt,/مرقَّق/, 'الترقيق صفةُ الكويتية نفسها — حكمه ١٥ أغسطس')
  assert.match(prompt,/Iranian\/Persian/i, 'منع الانحراف الفارسي — علّة رصدها الدكتور بأذنه')
  assert.match(prompt,/DO NOT CHANGE VOICE/i, 'المصطلح الأجنبي لا يغيّر الصوت — أوضح انحراف سمعه الدكتور')

  /* عقد الموسيقى: تُعاير بالـLUFS لا بمعاملٍ خطّي. المعامل الخام أخرج خاتمة
     v4 عند ‎-32dB‎ — خمسة عشر ديسيبل تحت الكلام، أي مكتومة. ولأن كل حلقةٍ
     تختار مقطوعةً غير الأخرى، المعامل الأعمى يجعل المستوى يتأرجح بين حلقةٍ
     وأخرى بلا سبب. */
  const engineSource = readFileSync(resolve(ROOT, 'scripts', 'podcast-kuwaiti-gemini.mjs'), 'utf8')
  const witnessSource = engineSource.slice(engineSource.indexOf('async function transcriptionWitness'), engineSource.indexOf('function cutChunkAt'))
  assert.ok(!/custom_vocabulary\s*:/.test(witnessSource),
    'واجهة 3.5 الحية ترفض custom_vocabulary مع timestamps — المطابقة تبقى محلية')
  assert.match(engineSource, /function compactLongSilences[\s\S]*atrim=start=/,
    'الوقفات الطويلة تُختصر من وسط الصمت من غير إعادة بناء توقيت الحوار')
  const productionGenerationStart = engineSource.lastIndexOf('const chunks = chunkTurns(turns)')
  const productionGeneration = engineSource.slice(productionGenerationStart,
    engineSource.indexOf('/* ═══ بوابة الطبقة', productionGenerationStart))
  assert.match(productionGeneration, /continuityGenerationGroups\(chunks\)/,
    'أي تقسيم اضطراري يمر بنافذة إحماء من الحوار السابق')
  assert.match(productionGeneration, /generatedParts\.slice\(generation\.warmupTurns\)/,
    'مداخلات الإحماء تُحذف من الناتج ولا تتكرر على المستمع')
  assert.match(productionGeneration, /ISOLATE_SPEAKER_STEMS \? \[/,
    'المساران المنفصلان باقيان للمختبر الصريح فقط')
  assert.match(productionGeneration, /: \[\{ key:'dialogue'/,
    'المسار الافتراضي يولّد الحوار المتعدد كله في Take واحد')
  assert.doesNotMatch(productionGeneration, /\bhalves\b|const rescue|promptFor\(subgroup|عاد إلى التوليد المفرد/,
    'لا إنقاذ بأنصاف أو أدوار مستقلة يعيد تفسير الصوت واللهجة')
  assert.match(engineSource, /PODCAST_KW_REJECT_SPEAKER_IDENTITY_DRIFT[\s\S]*rejectTake\(/,
    'انزلاق أي واحد من المتحدثين يرمي الـTake كله ويستدعي إعادة ببذرة جديدة')
  assert.match(engineSource, /PODCAST_KW_REJECT_SPEAKER_SWAPS[\s\S]*rejectTake\(/,
    'تبديل صوت داخل الحوار المتصل يرمي الـTake كله')
  assert.match(engineSource, /PODCAST_KW_REJECT_ACOUSTIC_RESET[\s\S]*corroboratedBoundaryResets[\s\S]*rejectTake\(/,
    'إعادة الهوية عند الانتقال تحتاج اتفاق الرنين والطبقة؛ قراءة منفردة لا تحرق Take سليماً')
  assert.match(engineSource, /PODCAST_KW_REJECT_TIMING_SUSPECTS[\s\S]*confirmedTimingSuspects[\s\S]*rejectTake\(/,
    'الدور المقصوص أو الممدود يرمي الـTake كله')
  assert.match(engineSource, /for \(const minDurationSec of \[0\.24, 0\.14, 0\.08, 0\.06, 0\.04\]\)/,
    'قص المداخلات يرخي الحساسية على Take نفسه قبل أن يسقط بوضوح')
  assert.match(engineSource, /تعذّر قص مسار[^]*rejectTake\(/,
    'فشل فصل حدود الأدوار عينة رديئة قابلة للإعادة، لا عطل يوقف طابور الحلقات')
  assert.equal(MAX_INTERNAL_SILENCE_MS, 300, 'السقف الحواري الافتراضي 0.30ث')
  assert.equal(LONG_SILENCE_TRIGGER_MS, 440, 'الضغط لا يمس أي نفس أقصر من 0.44ث')
  const pauseIntervals = silenceCompactionIntervals([
    { from: 0.5, to: 1.7, span: 1.2 },
    { from: 2.2, to: 2.6, span: 0.4 },
  ], 3.1, 440, 300)
  const keptSec = pauseIntervals.reduce((sum, part) => sum + part.to - part.from, 0)
  assert.ok(Math.abs(keptSec - 2.20) < 1e-9, '1.2ث تُختصر إلى 0.30ث والوقفة 0.4ث تبقى كاملة')
  const clipSource = engineSource.slice(engineSource.indexOf('function makeMusicClip'), engineSource.indexOf('function buildTimedMaster'))
  assert.match(clipSource, /loudnorm=I=\$\{targetLufs\}/, 'المقاطع الموسيقية تُعاير بالـLUFS')
  assert.ok(!/volume=\$\{volume\}/.test(clipSource), 'المعامل الخطّي الأعمى أعاد الخاتمة مكتومة — لا يُستعاد')
  for (const key of ['introVol', 'outroVol', 'bridgeVol']) {
    assert.ok(!(key in MUSIC), `${key} استُبدل بهدف LUFS`)
  }
  assert.ok(MUSIC.introLufs >= -22 && MUSIC.introLufs <= -16, 'المقدّمة تُسمع ولا تطغى')
  assert.ok(MUSIC.outroLufs >= -22 && MUSIC.outroLufs <= -16, 'الخاتمة تُسمع — وهذه شكوى الدكتور')
  assert.ok(MUSIC.bridgeLufs < MUSIC.introLufs, 'الجسر يمرّ تحت الكلام لا فوقه')
  /* الجسر فاصلٌ يُنتظر لا نغمةٌ تمرّ. كان ١.٦٠ث والمتحدث التالي يدخل بعد
     ٠.٧٢ث من بدايته فيدهسه قبل أن يأخذ حقّه — وهذه شكوى الدكتور بأذنه. */
  assert.ok(MUSIC.bridgeSec >= 2.0, 'الجسر أقصر من أن يُحسّ فاصلاً')
  assert.ok(MUSIC.bridgeSec - MUSIC.bridgeTailSec >= 1.8, 'المتحدث التالي يدهس الجسر قبل أن يأخذ حقّه')
  for (const word of ['«إي»','«مو»','«هني»','«شلون»']) {
    assert.ok(prompt.includes(word), `توجيه نطق ${word} مفقود`)
  }
  assert.match(prompt,/Fahad:/)
  assert.match(prompt,/Noura:/, 'المقطع الواحد يحمل المتحدثين معاً فيثبت الصوت داخله')
  const header = wavHeader(100)
  assert.equal(header.toString('ascii',0,4),'RIFF'); assert.equal(header.readUInt32LE(24),24000)

  /* حارس علّة «HTTP 200»: تشغيلة ١٢ أغسطس ٢٠٢٦ سقطت لأن طلباً غير متدفّق
     حمل ترويسة البثّ، فعاد ٢٠٠ بغلافٍ بلا output_audio ولم تُبلّغ الرسالةُ
     شيئاً. الحارسان أدناه يمنعان عودة الوجهين معاً. */
  const source = readFileSync(resolve(ROOT,'scripts','podcast-kuwaiti-gemini.mjs'),'utf8')
  const requestBlock = source.slice(source.indexOf('const response = await fetch(endpoint'), source.indexOf('const raw = await response.text()'))
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

  /* حصة الطبقة المجانية: عشرة طلباتٍ في الدقيقة. المنظّم يبقى دونها،
     ومهلة الخادم تُقرأ من الحقل ومن نصّ الرسالة معاً. */
  assert.ok(RPM <= 10, `إيقاع ${RPM} طلباً/دقيقة يتجاوز حصة النموذج المجانية`)

  /* عقد تماسك الصوت: الطلب يحمل عدّة مداخلاتٍ فتقلّ حدود الانزلاق، والقصّ
     يرفض ما لا يطابق ويوقف التشغيل بدل أن يخترع حدوداً أو صوتاً جديداً. */
  assert.ok(TURNS_PER_REQUEST >= 2, 'مداخلةٌ واحدةٌ لكل طلب تعيد علّة تبدّل صوت المذيع')

  /* معجم النطق: يمسّ المسموع ولا يمسّ المكتوب، ويستبدل الكلمة كاملةً فقط.
     «الورقيات» و«التوريق» تبقى كما هي — وهي علّة مسخٍ سابقة لا تُعاد. */
  if (PRONUNCIATION.length) {
    /* چ وحدها في المعجم: الحرف الوحيد الذي أثبت الدكتور صحّته سماعاً
       (چذي/چان). الاسم نُطقه المعتمد «الفيلاجاوي» — هجّاه الدكتور بنفسه حرفاً
       حرفاً: «ال · في · لا · جا · وي». گ أُدخلت في v3 فأسقطت نطق چ، فنُزعت. */
    /* «جم» سقطت بالچ وبـ«تش» في سماعه، فحكمها الاستبدال بكلمةٍ حقيقية. */
    /* «جم» تبقى كما كتبها الدكتور — الاستبدال المخترع («شكثر») رفضه بأذنه.
       الكاف→چ تُوصف في البرومت لا تُكتب حرفاً، فالنصّ يبقى نصّه. */
    /* [٢٠ أغسطس ٢٠٢٦] «جم» تبقى كما هي — أمّا «جبت» فأملى الدكتور بدلها بنفسه:
       «جم جبت … هذا بدوي … احنا نقول جم يبت». فالجيم ياءً هنا حكمُه لا اجتهادي،
       ومصدرها مسجَّلٌ في heardByEar بتاريخه. الشرط يحمي نصّه من اجتهادي وحده،
       لا من إملائه هو — وهذا ما كان يقفله قبل التصحيح. */
    assert.equal(spokenForm('مو بس: جم جبت؟'), 'مو بس: جم يبت؟', 'إملاء الدكتور يُنفَّذ، و«جم» تبقى')
    /* السابقة الملاصقة تُختبر على مدخلٍ قائمٍ (ألف الوصل). و«الفرق» صارت
       «الفرگ» بقائمة الگاف (٢٣ أغسطس) فالتأكيد يتابعها. */
    assert.equal(spokenForm('وتعرف الجواب'), 'واتعرف الجواب', 'السابقة الملاصقة لا تمنع النطق')
    const trap = 'المجموع والجمال وجمعنا'
    assert.equal(spokenForm(trap), trap, 'ما كانت «جم» جزءاً منه لا يُمسّ')
    /* [٢٤ أغسطس ٢٠٢٦] تشخيص الحرف لا يساوي إذن هجائه آلياً. قائمة المرشحين
       بقيت محفوظة للمختبر، لكن مدخل الصوت لا يحمل گ إلا في كلمةٍ جُرّبت
       فعلاً واختارها الدكتور بأذنه. هذا هو الفرق بين lexical pronunciation
       وبين قاعدة «كل ق = گ» التي تجعل اللكنة مؤدّاة. */
    const gafWords = Object.values(PRONUNCIATION_SOURCE.words || {}).filter((value) => String(value).includes('گ'))
    const untestedGaf = gafWords.filter((value) => !PRONUNCIATION_SOURCE.heardByEar?.[value])
    assert.deepEqual(untestedGaf, [], `كل هجاء گ في مدخل الصوت لازم يكون مجرّباً ومقبولاً بالأذن: ${untestedGaf.join('، ')}`)
    assert.ok(gafWords.length > 0 && gafWords.length <= 4,
      `گ استثناءٌ مسموع ضيق، مو قائمة آلية (الآن ${gafWords.length})`)
    /* الچ مسموحةٌ في المفاتيح (نصّ الدكتور يكتبها) وممنوعةٌ في النواتج
       (المحرّك يبتلعها) — فتُفحص جهةُ الخرج وحدها. */
    const chehOut = Object.values(PRONUNCIATION_SOURCE.words || {}).filter((value) => String(value).includes('چ'))
    assert.equal(chehOut.length, 0, 'چ لا تصل المحرّك حرفاً — تُكتب صوتاً «تش»')
    /* حذف الأسماء اللاتينية: أوضح سبب تبدّل الصوت (Frontiers سمعها الدكتور «فلنتير»). */
    assert.equal(spokenForm('منشور في Frontiers in Psychology عن التوتر'), 'منشور في مجلة علمية عن التوتر', 'الاسم اللاتيني يُحذف ويُستبدل بعربية عامة')
    assert.ok(!/[A-Za-z]/.test(spokenForm('حسب OECD وUNICEF')), 'لا يبقى أيّ حرف لاتيني في مدخل الصوت')
    assert.equal(spokenForm('مثل واحد كان منحشر بمكان ضيّج… وبعدها طلع منه'),
      'مثل واحد كان منحشر بمكان ظيّج… وبعدها طِلَع مِنّه',
      '«ضيّج» المعتمدة تصل مدخل الصوت ظيّج ولا ترجع إلى «ضيق»')
  }
  const grouped = chunkTurns(Array.from({ length: 12 }, (_, i) => ({
    speaker: i % 2 ? 'female' : 'male', text: `مداخلة ${i}`, deliveryType: 'statement', musicBridgeAfter: false,
  })))
  assert.ok(grouped.length < 12, `التجميع لم يحدث: ${grouped.length} مقاطع لـ12 مداخلة`)
  assert.equal(grouped.flat().length, 12, 'التجميع لا يفقد مداخلةً ولا يكرّرها')
  assert.equal(TURNS_PER_REQUEST, 96, 'السقف يحمل أطول حلقة كاملة حالية في Take واحد')
  for (const file of ['src/data/kuwaiti-diwania-v3.json', 'src/data/kuwaiti-dialogues.json']) {
    const library = JSON.parse(readFileSync(resolve(ROOT, file), 'utf8'))
    const splitCurrent = Object.entries(library.episodes || {})
      .filter(([, episode]) => chunkTurns(Object.values(episode)).length !== 1)
      .map(([episodeSlug]) => episodeSlug)
    assert.deepEqual(splitCurrent, [], `${file}: حلقات حالية انقسمت بلا ضرورة: ${splitCurrent.join('، ')}`)
  }
  const fakeGaps = [{ mid: 2.0, span: 0.5 }, { mid: 3.7, span: 0.5 }, { mid: 6.3, span: 0.5 }]
  assert.deepEqual(chooseSplitPoints(fakeGaps, 4, 8.1), [2.0, 3.7, 6.3], 'حدود المداخلات تُقرأ من أطول الصمتات')
  assert.equal(chooseSplitPoints(fakeGaps, 9, 8.1), null, 'نقصُ الصمتات يوقف القص ولا يختلق حدوداً أو توليداً منفصلاً')
  assert.deepEqual(chooseSplitPoints([], 1, 5), [], 'مداخلةٌ واحدةٌ لا تحتاج قصّاً')
  /* الأوزان تُرجّح الموضع المتوقّع على طول الصمتة: مداخلةٌ طويلةٌ ثم قصيرة،
     والصمتة الأطول واقعةٌ باكراً — القديم كان يقتنصها فيمنح القصيرة أكثرَ حقّها. */
  const weighted = [{ mid: 1.0, span: 1.2 }, { mid: 6.0, span: 0.3 }]
  assert.deepEqual(chooseSplitPoints(weighted, 2, 8, 0.45, [70, 10]), [6.0],
    'الحدّ يُختار بموضعه المتوقّع لا بطول صمتته')
  assert.equal(chooseSplitPoints([{ mid: 1.0, span: 0.5 }], 2, 20, 0.45, [50, 50]), null,
    'الصمتة البعيدة عن موضعها المتوقّع تُرَدّ من غير إعادة توليد للشطر')
  assert.deepEqual(chooseSplitPoints([{ mid: 4.3, span: 0.08 }], 2, 10, 0.45, [80, 20], 0.75), [4.3],
    'النافذة الأوسع تقبل حدّاً صوتياً سريعاً على الأخذ نفسه من غير ترقيع')
  const annotationEnvelope = { steps: [{ content: [{ annotations: [
    { type:'word_info', text:'هذا', speaker:'spk_1', start_offset:'0.100s', end_offset:'0.500s' },
    { type:'word_info', text:'فرق', speaker:'spk_1', start_offset:'0.550s', end_offset:'1.000s' },
    { type:'word_info', text:'إي', speaker:'spk_2', start_offset:'1.100s', end_offset:'1.400s' },
    { type:'word_info', text:'واضح', speaker:'spk_2', start_offset:'1.450s', end_offset:'2.000s' },
    { type:'word_info', text:'هذا', speaker:'spk_1', start_offset:'2.200s', end_offset:'2.550s' },
    { type:'word_info', text:'صح', speaker:'spk_1', start_offset:'2.600s', end_offset:'2.900s' },
  ] }] }] }
  const parsedAnnotations = extractWordAnnotations(annotationEnvelope)
  assert.equal(parsedAnnotations.length, 6, 'شاهد Gemini يُقرأ من word_info لا من نص حر')
  const alignedProbe = alignTranscriptBoundaries([
    { speaker:'male', text:'هذا فرق' }, { speaker:'female', text:'إي واضح' }, { speaker:'male', text:'هذا صح' },
  ], parsedAnnotations, 3.1)
  assert.deepEqual(alignedProbe.cuts.map((cut) => Number(cut.toFixed(2))), [1.05, 2.10],
    'حد الدور يقع بين آخر كلمة للأول وأول كلمة للثاني')
  assert.equal(alignedProbe.speakerAgreement, 1, 'التفريغ يثبت أن فهد ونورة لم يتبادلا الأدوار')
  assert.deepEqual(alignedProbe.perTurnCoverage, [1, 1, 1], 'كل كلمات كل دور حاضرة قبل بوابة الزمن')
  assert.equal(retryAfterMs({ error:{ details:[{ retryDelay:'1.875496542s' }] } }, ''), 2626, 'مهلة الخادم من details')
  assert.equal(retryAfterMs(null, 'Please retry in 12.5s'), 13250, 'مهلة الخادم من نصّ الرسالة')
  assert.equal(retryAfterMs(null, 'boom'), 0, 'بلا مهلةٍ معلنة يعود إلى التراجع الأسّي')
  assert.equal(geminiFailureExitCode(new Error('An internal error has occurred. Please retry')), 75,
    'عطل Gemini المؤقت يعاد بلا أن يحرق محاولة جودة')
  assert.equal(geminiFailureExitCode(new Error('HTTP 503 بلا صوت')), 75,
    'أعطال 5xx مؤقتة لا تسقط الطابور')
  assert.equal(geminiFailureExitCode(new Error('نفد رصيد Gemini — التوليد متوقف')), 78,
    'نفاد الرصيد يوقف الصرف ويحفظ الباقي')
  assert.equal(geminiFailureExitCode(new Error('قفل المصدر مفقود')), 1,
    'عطب المصدر الحقيقي لا يختبئ خلف إعادة المحاولة')
  const previous = { startSec: 2, durationSec: 4 }
  assert.equal(speechStartAfter(previous,
    { speaker: 'male', pauseAfterMs: 900 },
    { speaker: 'female', deliveryType: 'briefReaction', overlapMs: 150 }, true), 5.85,
    'التوقيت الطبيعي يحترم دخول الرد الخاطف وحده ولا يضيف وقفة ثابتة')
  assert.equal(speechStartAfter(previous,
    { speaker: 'male', pauseAfterMs: 900 },
    { speaker: 'male', deliveryType: 'statement', overlapMs: 150 }, true), 6,
    'لا overlap بين شطرين للمتحدث نفسه ولا على جملة عادية')
  assert.ok(Math.abs(speechStartAfter(previous, { pauseAfterMs: 560 }, { overlapMs: 0 }, false) - 6.56) < 1e-9,
    'الوضع التاريخي يبقى متاحاً للمقارنة فقط')
  assert.equal(PRESERVE_NATIVE_TURN_TIMING, true,
    'الافتراض يحفظ الصمت وتوقيت الردود اللذين ولّدهما النداء نفسه')

  console.log('✓ Gemini Kuwaiti pipeline self-test: chunking + prompt + PCM/WAV + عقد الطلب والاستخراج')
  process.exit(0)
}

if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('استخدم --slug=<slug>')
if (GENERATION_MODE !== 'all' && slug !== PILOT_SLUG) {
  throw new Error(`pilot-only: التوليد مقفول على ${PILOT_SLUG} حتى اعتماد التجربة`)
}
const source = resolve(ROOT, 'manual-dialogues-kuwaiti', `${slug}.json`)
if (!existsSync(source)) throw new Error(`الحوار الكويتي غير موجود: ${slug}`)
const sourceTurns = normalizeManualDialogueTurns(JSON.parse(readFileSync(source,'utf8')))

/* ═══ استرداد توجيهات الأداء ═══
   المحرّك يترجم deliveryType إلى توجيهٍ مسموع ([curious] · [gently skeptical] ·
   [warmly] · [reflective]). لكن المصدر الكويتي لا يحمل الحقل — قيست حلقةٌ
   كاملة (٢١ أغسطس ٢٠٢٦): ٣٧ مداخلةً كلها deliveryType فارغ، فتأخذ التاج
   المجرّد بلا أي توجيه. فآلية الأداء كانت معطّلةً في المسار الكويتي وحده،
   وهذا سببُ «كأن كل متحدث يقرأ فقرة» في ملاحظات المراجعة.

   والمصدر الفصيح لنفس الحلقة يحملها كاملةً. فتُستردّ بالفهرس — لكن بشرطين
   لا ثالث لهما، وإلا تُترك كما هي: تطابقُ عدد المداخلات، وتطابقُ تسلسل
   المتحدّثين كاملاً. بلا الشرطين قد يُلصق توجيه سؤالٍ على جملةٍ خبرية. */
const recoverDeliveryTypes = (kuwaitiTurns, articleSlug) => {
  const missing = kuwaitiTurns.filter((t) => !t.deliveryType).length
  if (!missing) return { turns: kuwaitiTurns, recovered: 0, reason: 'المصدر يحملها أصلاً' }
  const fusha = resolve(ROOT, 'manual-dialogues', `${articleSlug}.json`)
  if (!existsSync(fusha)) return { turns: kuwaitiTurns, recovered: 0, reason: 'لا مصدر فصيح' }
  let ref = null
  try { ref = normalizeManualDialogueTurns(JSON.parse(readFileSync(fusha, 'utf8'))) }
  catch { return { turns: kuwaitiTurns, recovered: 0, reason: 'تعذّرت قراءة الفصيح' } }
  if (!Array.isArray(ref) || ref.length !== kuwaitiTurns.length) {
    return { turns: kuwaitiTurns, recovered: 0, reason: `عدد مختلف (${ref?.length} مقابل ${kuwaitiTurns.length})` }
  }
  const aligned = kuwaitiTurns.every((t, i) => t.speaker === ref[i].speaker)
  if (!aligned) return { turns: kuwaitiTurns, recovered: 0, reason: 'تسلسل المتحدّثين مختلف' }
  let recovered = 0
  const merged = kuwaitiTurns.map((t, i) => {
    if (t.deliveryType || !ref[i].deliveryType) return t
    recovered += 1
    return { ...t, deliveryType: ref[i].deliveryType }
  })
  return { turns: merged, recovered, reason: '' }
}
const delivery = recoverDeliveryTypes(sourceTurns, slug)
if (delivery.recovered) {
  sourceTurns.splice(0, sourceTurns.length, ...delivery.turns)
  console.log(`✓ توجيهات الأداء: استُردّت ${delivery.recovered} من ${sourceTurns.length} من المصدر الفصيح`)
} else if (delivery.reason && delivery.reason !== 'المصدر يحملها أصلاً') {
  console.log(`⚠️ توجيهات الأداء لم تُستردّ (${delivery.reason}) — النبرة ستكون موحّدة`)
}
const turns = audibleSpeakerRuns(sourceTurns)
if (turns.length !== sourceTurns.length) {
  console.log(`✓ الأدوار المسموعة: ${sourceTurns.length} سطراً مقفولاً → ${turns.length} مداخلة فعلية بلا تغيير كلمة`)
}
const sourceLockFile = resolve(ROOT, 'podcast-audits', 'source-locks-kuwaiti', `${slug}.json`)
const sourceLock = existsSync(sourceLockFile) ? JSON.parse(readFileSync(sourceLockFile, 'utf8')) : null
if (!DRY_RUN && (!sourceLock || sourceLock.slug !== slug || !sourceLock.revisionId)) {
  throw new Error('قفل المصدر الكويتي مفقود؛ ممنوع توليد نسخة قابلة للاعتماد')
}
if (!DRY_RUN && !sourceLock?.nativeSpokenVersion) {
  throw new Error('طبقة النص الكويتي الطبيعي غير مثبتة في القفل؛ ممنوع Gemini قبل الصقل الإلزامي')
}
const revisionId = sourceLock?.revisionId || 'dry-run-pilot'
const chunks = chunkTurns(turns)
const generationGroups = continuityGenerationGroups(chunks)
const prompts = generationGroups.map((group, index) =>
  promptFor(group.turns, index, chunks.length, PROMPT_MODE, group.warmupTurns, group.warmupEstimatedSec))
if (DRY_RUN) {
  console.log(`✓ ${slug}: ${turns.length} مداخلة → ${chunks.length === 1 ? 'Take واحد متصل' : `${chunks.length} طلبات متداخلة بإحماء صوتي`}`)
  console.log(`✓ model=${MODEL} · male=${MALE_VOICE} · female=${FEMALE_VOICE} · profile=${PROFILE}`)
  console.log(prompts[0].slice(0,2200))
  process.exit(0)
}

mkdirSync(AUDIO,{recursive:true}); rmSync(TMP,{recursive:true,force:true}); mkdirSync(TMP,{recursive:true}); mkdirSync(AUDITS,{recursive:true})
const chunkFiles=[]; const durations=[]; const requestHashes=[]
for (let i=0;i<chunks.length;i+=1) {
  const group = chunks[i]
  const generation = generationGroups[i]
  console.log(`🎙️ Gemini ${i+1}/${chunks.length} (${group.length} مداخلة${generation.warmupTurns ? ` + إحماء ${generation.warmupEstimatedSec}ث محذوف` : ''}${ISOLATE_SPEAKER_STEMS ? ' · مسارا هوية كاملان' : ''})`)
  const prompt=prompts[i]
  const plans = ISOLATE_SPEAKER_STEMS ? [
    { key:'male', label:'فهد', target:'male', voice:MALE_VOICE },
    { key:'female', label:'نورة', target:'female', voice:FEMALE_VOICE },
  ] : [{ key:'dialogue', label:'الحوار', target:'dialogue', voice:'' }]
  const partsByPlan = {}
  for (const plan of plans) {
    const passPrompt = ISOLATE_SPEAKER_STEMS ? fullContextStemPrompt(prompt, plan.target) : prompt
    if (USE_VERTEX) console.log(`    Vertex input: ${Buffer.byteLength(passPrompt, 'utf8')} بايت`)
    /* speech_config بصوتٍ واحد موثقة رسمياً في Interactions API. لذلك لا
       يملك هذا الطلب صوت الطرف الآخر كي يبدّله وسط البحث أو الخاتمة. */
    const speechConfig = ISOLATE_SPEAKER_STEMS ? [{ voice:plan.voice }] : undefined
    requestHashes.push(sha256(`${JSON.stringify(speechConfig || 'multi')}:${passPrompt}`))
    const stem=resolve(TMP,`chunk-${String(i+1).padStart(2,'0')}-${plan.key}`)
    const rawWav=`${stem}.raw.wav`
    console.log(ISOLATE_SPEAKER_STEMS ? `  ↳ مسار ${plan.label}: ${plan.voice} بصوت واحد ثابت والسياق الكامل` : '  ↳ مسار الحوار المتعدد')
    let pcm=null
    try { pcm=await geminiPcm(passPrompt, speechConfig) }
    catch (error) {
      throw new Error(`أخفق مسار ${plan.label} المتصل ${i+1}/${chunks.length}: ${error.message}. أُوقف التشغيل؛ ممنوع إنقاذه بأدوار مستقلة تغيّر الصوت واللهجة.`, { cause: error })
    }
    writePcmWav(rawWav,pcm)
    const cleanWav=prepareGeneratedChunk(rawWav, stem)
    generatedTakeSources.push({ file: cleanWav, chunk: i + 1, plan: plan.key })

    /* كل مسارٍ Take كامل بالسياق نفسه. لو لم نجد حدوده نسقط المحاولة كلها؛
       لا يُعاد أي دور منفرد ولا تُخاط نبرات من جلسات قصيرة. */
    const planTurns = USE_VERTEX && ISOLATE_SPEAKER_STEMS
      ? generation.turns.filter((turn) => turn.speaker === plan.target)
      : generation.turns
    let generatedParts = null
    try { generatedParts = await splitChunk(cleanWav, planTurns, stem) }
    catch (error) {
      if (/شاهد الأدوار غير حاسم/.test(String(error?.message || error))) {
        rejectTake(`↻ شاهد الكلمات والصوتين لم يثبت حدود الأدوار — الـTake مرفوض من غير اتهام الحنجرة ولا ترقيع: ${error.message}`,
          { stage: 'transcript-alignment', error: error.message })
      }
      throw error
    }
    if (!generatedParts) {
      rejectTake(`↻ تعذّر قص مسار ${plan.label} ${i+1} إلى ${planTurns.length} مداخلة من التسجيل المتصل نفسه — الـTake مرفوض ويُعاد كاملاً؛ ممنوع إعادة توليد أنصاف أو أدوار مستقلة.`,
        { stage: 'turn-splitting', plan: plan.key, expectedTurns: planTurns.length })
    }
    if (USE_VERTEX && ISOLATE_SPEAKER_STEMS) {
      const originalIndexes = generation.turns
        .map((turn, originalIndex) => ({ turn, originalIndex }))
        .filter(({ turn }) => turn.speaker === plan.target)
      const kept = originalIndexes
        .map((entry, partIndex) => ({ ...entry, file: generatedParts[partIndex] }))
        .filter(({ originalIndex }) => originalIndex >= generation.warmupTurns)
      partsByPlan[plan.key] = new Map(kept.map(({ originalIndex, file }) => [originalIndex - generation.warmupTurns, file]))
    } else {
      const parts = generatedParts.slice(generation.warmupTurns)
      if (parts.length !== group.length) throw new Error(`قص إحماء مسار ${plan.label} أعطى ${parts.length} ملفاً بدل ${group.length}`)
      partsByPlan[plan.key] = parts
    }
  }

  /* المونتاج يأخذ فهد من Take فهد الكامل ونورة من Take نورة الكامل. كلاهما
     سمع كل الحوار، فتبقى الاستجابة محلية؛ ولا واحد منهما تولّد كسطر يتيم. */
  const selectedParts = ISOLATE_SPEAKER_STEMS
    ? group.map((turn, turnIndex) => USE_VERTEX
        ? partsByPlan[turn.speaker].get(turnIndex)
        : partsByPlan[turn.speaker][turnIndex])
    : partsByPlan.dialogue
  selectedParts.forEach((part) => {
    chunkFiles.push(part); durations.push(duration(part))
  })
}
if (chunkFiles.length !== turns.length) {
  throw new Error(`عدد المقاطع ${chunkFiles.length} لا يطابق ${turns.length} مداخلة`)
}
console.log(chunks.length === 1
  ? ISOLATE_SPEAKER_STEMS
    ? `✓ مسارا هوية متصلان لـ${turns.length} مداخلة · نورة لا تحمل Puck وفهد لا يحمل Zephyr · صفر ترقيع أدوار`
    : `✓ Take واحد متصل لـ${turns.length} مداخلة · صفر إعادة ضبط عند الجسور`
  : `✓ ${chunks.length} طلبات لـ${turns.length} مداخلة · كل طلب لاحق بدأ بإحماء 10–15ث وحُذف التكرار`)
console.log(silenceCompaction.removedSec > 0.02
  ? `✓ تنفّس الحوار: اختُصر ${silenceCompaction.removedSec.toFixed(1)}ث من الوقفات الأطول من ${(LONG_SILENCE_TRIGGER_MS / 1000).toFixed(2)}ث؛ الوقفات الطبيعية الأقصر بقيت كما هي`
  : '✓ تنفّس الحوار: ماكو وقفات طويلة احتاجت اختصار')

/* ═══ بوابة الطبقة — بالنسبة لا بالعتبة المطلقة ═══
   العتبتان المطلقتان (ذكر ≤١٥٠ · أنثى ≥١٦٥) كانتا خطأً فادحاً: القياس على
   حلقةٍ سليمةٍ كاملة أظهر أن Puck يقع بين ١١٥ و١٦٥ (وسيطه ١٣٧) وDespina بين
   ١٥١ و١٨٤ (وسيطها ١٦٥) — أي أن حنجرتَي هذا الزوج **متداخلتان** في النطاق
   ١٥١‑١٦٥. فاتّهمت البوابةُ اثني عشر دوراً سليماً وأعادت توليدها: أحرقت
   الحصة، وكسرت وحدة النبرة التي وُلد النداء الواحد لأجلها، وهي أثمن ما في
   الحلقة عند الدكتور.
   العلاج: يُقاس كل دورٍ بالنسبة إلى **وسيط متحدّثه نفسه** في هذه الحلقة.
   والانعكاس الحقيقي شاذٌّ صارخ: الدور يقع أقرب إلى وسيط المتحدّث الآخر منه
   إلى وسيط متحدّثه، وبفارقٍ معتبر. ولا يُعاد توليده — لأن إعادة دورٍ مفردٍ
   وسط نداءٍ واحدٍ تُدخل نبرةً غريبةً هي نفسها العلّة — بل يُسمّى في السجل
   وفي سجلّ التدقيق ليحكم عليه الدكتور بأذنه. */
const pitchOf = turns.map((_, t) => medianF0(chunkFiles[t]))
const medianOf = (isMale) => {
  const vals = pitchOf.filter((f, t) => f && (turns[t].speaker === 'male') === isMale).sort((a, b) => a - b)
  return vals.length ? vals[Math.floor(vals.length / 2)] : null
}
const maleMid = medianOf(true), femaleMid = medianOf(false)
const swapped = []
const swappedDetails = []
if (maleMid && femaleMid && femaleMid - maleMid > 12) {
  for (let t = 0; t < turns.length; t += 1) {
    const f0 = pitchOf[t]; if (!f0) continue
    const expectMale = turns[t].speaker === 'male'
    const own = expectMale ? maleMid : femaleMid
    const other = expectMale ? femaleMid : maleMid
    /* شاذٌّ صارخ: أقرب إلى الحنجرة الأخرى بفارق يتجاوز نصف المسافة بينهما. */
    if (Math.abs(f0 - other) + (femaleMid - maleMid) * 0.5 < Math.abs(f0 - own)) {
      swapped.push(`${t + 1} (${expectMale ? 'فهد' : 'نورة'} ${f0.toFixed(0)}Hz)`)
      swappedDetails.push({ index: t, turn: t + 1, speaker: turns[t].speaker, hz: Number(f0.toFixed(1)) })
    }
  }
}
const femaleContinuity = speakerPitchContinuity(turns, pitchOf, 'female')
const maleContinuity = speakerPitchContinuity(turns, pitchOf, 'male')
const femaleSwapSuspects = swappedDetails.filter((finding) => finding.speaker === 'female')
const femaleSwapIndexSet = new Set(femaleSwapSuspects.map((finding) => finding.index))
const maleSwapSuspects = swappedDetails.filter((finding) => finding.speaker === 'male')
const maleSwapIndexSet = new Set(maleSwapSuspects.map((finding) => finding.index))
/* «أقرب إلى فهد» قياسٌ نسبي شديد الحساسية حين تتقارب الحنجرتان. لا يصبح
   دليلاً قاطعاً إلا إذا أصاب نصف أدوار مقطعٍ لاحق (ودورين على الأقل).
   المقطع، لا النبرة العابرة، هو وحدة الحكم على تبدّل الهوية. */
const femaleSwapSegments = femaleContinuity.segments.slice(1).map((segment) => {
  const count = segment.turnIndexes.filter((index) => femaleSwapIndexSet.has(index)).length
  return { segment: segment.segment, count, sampleCount: segment.sampleCount }
}).filter((segment) => segment.count >= 2 && segment.count / segment.sampleCount >= 0.5)
const maleSwapSegments = maleContinuity.segments.slice(1).map((segment) => {
  const count = segment.turnIndexes.filter((index) => maleSwapIndexSet.has(index)).length
  return { segment: segment.segment, count, sampleCount: segment.sampleCount }
}).filter((segment) => segment.count >= 2 && segment.count / segment.sampleCount >= 0.5)
/* فجوة الحنجرتين حارسٌ مساعد لا تعريفٌ كامل للهوية. في الحوار المتعدد
   الحقيقي عيّنة 20Hz سُمعت صوتاً واحداً؛ الإنتاج يمرر 25 من البيئة، ثم
   تضيف بوابة الرنين ما لا يراه F0. */
const voiceGap = (maleMid && femaleMid) ? femaleMid - maleMid : null
console.log(`✓ بوابة الطبقة: وسيط فهد ${maleMid ? maleMid.toFixed(0) : '—'}Hz · نورة ${femaleMid ? femaleMid.toFixed(0) : '—'}Hz${swapped.length ? ` · أدوار مشتبهة: ${swapped.join(' · ')}` : ' · لا انعكاس'}`)
if (voiceGap !== null) {
  console.log(voiceGap < 25
    ? `⚠️ فجوة الحنجرتين ${voiceGap.toFixed(0)} هرتزاً — الصوتان متقاربان وقد يُسمعان صوتاً واحداً (المريح ≥ ٣٠)`
    : `✓ فجوة الحنجرتين ${voiceGap.toFixed(0)} هرتزاً — صوتان متمايزان`)
}
console.log(femaleContinuity.anchorHz === null
  ? '⚠️ استمرارية نورة: تعذّر بناء مرجع طبقتها'
  : `✓ استمرارية نورة: مرجع الثلث الأول ${femaleContinuity.anchorHz.toFixed(0)}Hz · أوساط المقاطع ${femaleContinuity.segments.map((segment) => segment.medianHz.toFixed(0)).join(' ← ')}Hz · أقصى قفزة مفردة ${femaleContinuity.maxObservedDriftHz.toFixed(0)}Hz${femaleContinuity.pointSuspects.length ? ` · تنبيه سمعي للأدوار ${femaleContinuity.pointSuspects.map((finding) => finding.index + 1).join('، ')}` : ''}`)
console.log(maleContinuity.anchorHz === null
  ? '⚠️ استمرارية فهد: تعذّر بناء مرجع طبقته'
  : `✓ استمرارية فهد: مرجع الثلث الأول ${maleContinuity.anchorHz.toFixed(0)}Hz · أوساط المقاطع ${maleContinuity.segments.map((segment) => segment.medianHz.toFixed(0)).join(' ← ')}Hz · أقصى قفزة مفردة ${maleContinuity.maxObservedDriftHz.toFixed(0)}Hz${maleContinuity.pointSuspects.length ? ` · تنبيه سمعي للأدوار ${maleContinuity.pointSuspects.map((finding) => finding.index + 1).join('، ')}` : ''}`)

/* بوابة «نفس الإنسان» عند منطقتَي الانتقال. الموسيقى لم تدخل Gemini، لكن
   أول سطر بعدها قد يكون شاذاً داخل الـTake نفسه؛ وهذا بالضبط ما حدث في
   النسخة المحلية. نقرأ غلاف الرنين لكل دور ونقارن الدور التالي للعلامة
   التحريرية بمرجع الشخص نفسه. */
const timbreOf = chunkFiles.map((file) => timbreSignature(file))
const femaleTimbre = speakerTimbreContinuity(turns, timbreOf, 'female')
const maleTimbre = speakerTimbreContinuity(turns, timbreOf, 'male')
const acousticBoundarySuspects = [...femaleTimbre.boundarySuspects, ...maleTimbre.boundarySuspects]
  .sort((a, b) => a.index - b.index)
const pitchBoundarySuspects = [
  ...femaleContinuity.pointSuspects.map((finding) => ({ ...finding, speaker: 'female' })),
  ...maleContinuity.pointSuspects.map((finding) => ({ ...finding, speaker: 'male' })),
].filter((finding) => finding.index > 0 && turns[finding.index - 1]?.musicBridgeAfter)
  .sort((a, b) => a.index - b.index)
console.log(acousticBoundarySuspects.length
  ? `⚠️ استمرارية الرنين بعد الانتقال: ${acousticBoundarySuspects.map((finding) => `الدور ${finding.turn} (${finding.distance.toFixed(2)})`).join(' · ')}`
  : `✓ استمرارية الرنين بعد الانتقال: نورة ≤${femaleTimbre.boundaryThreshold?.toFixed(2) || '—'} · فهد ≤${maleTimbre.boundaryThreshold?.toFixed(2) || '—'}`)
console.log(pitchBoundarySuspects.length
  ? `⚠️ استمرارية الطبقة عند الانتقال: ${pitchBoundarySuspects.map((finding) => `الدور ${finding.index + 1} (${finding.driftHz.toFixed(0)}Hz)`).join(' · ')}`
  : '✓ استمرارية الطبقة عند الانتقال: ماكو قفزة مفردة فوق 32Hz')

/* لا نرقّع نورة بدورٍ منفرد. الانزلاق المتماسك في وسيط مقطع كامل يرمي
   الـTake كله، وكذلك تحوّل نصف مقطع لاحق إلى طبقة فهد. أما الدور المفرد
   فيُسجل للتدقيق ولا يوقف الإنتاج — وهذا بالضبط ما أنقذ عينة 26Hz الجيدة
   التي رفضها الحارس القديم بسبب كلمة واحدة عند 38Hz. */
const REJECT_SPEAKER_IDENTITY_DRIFT = process.env.PODCAST_KW_REJECT_SPEAKER_IDENTITY_DRIFT === '1'
  || process.env.PODCAST_KW_REJECT_FEMALE_IDENTITY_DRIFT === '1'
if (REJECT_SPEAKER_IDENTITY_DRIFT && (femaleSwapSegments.length || maleSwapSegments.length
  || femaleContinuity.segmentSuspects.length || maleContinuity.segmentSuspects.length)) {
  const reasons = [
    femaleSwapSegments.length ? `طبقة فهد غلبت على مقطع نورة ${femaleSwapSegments.map((segment) => segment.segment).join('، ')}` : '',
    femaleContinuity.segmentSuspects.length ? `وسيط مقطع نورة ${femaleContinuity.segmentSuspects.map((segment) => segment.segment).join('، ')} انحرف أكثر من 28Hz` : '',
    maleSwapSegments.length ? `طبقة نورة غلبت على مقطع فهد ${maleSwapSegments.map((segment) => segment.segment).join('، ')}` : '',
    maleContinuity.segmentSuspects.length ? `وسيط مقطع فهد ${maleContinuity.segmentSuspects.map((segment) => segment.segment).join('، ')} انحرف أكثر من 28Hz` : '',
  ].filter(Boolean).join(' · ')
  rejectTake(`↻ هوية أحد المتحدثين انزلقت (${reasons}) — الـTake مرفوض بالكامل ويُعاد، بلا ترقيع.`, {
    stage: 'speaker-identity', femaleContinuity, maleContinuity, femaleSwapSegments, maleSwapSegments,
  })
}
const REJECT_SPEAKER_SWAPS = process.env.PODCAST_KW_REJECT_SPEAKER_SWAPS === '1'
if (REJECT_SPEAKER_SWAPS && swapped.length) {
  rejectTake(`↻ تبديل صوتٍ داخل الحوار المتصل: ${swapped.join(' · ')} — الـTake كله مرفوض، ولا رجوع لمسارات الفقرات المنفصلة.`,
    { stage: 'speaker-swap', swapped: swappedDetails })
}
const REJECT_ACOUSTIC_RESET = process.env.PODCAST_KW_REJECT_ACOUSTIC_RESET === '1'
const corroboratedBoundaryResets = acousticBoundarySuspects.filter((acoustic) =>
  pitchBoundarySuspects.some((pitch) => pitch.index === acoustic.index))
if (REJECT_ACOUSTIC_RESET && corroboratedBoundaryResets.length) {
  const reasons = [
    ...corroboratedBoundaryResets.map((finding) => {
      const pitch = pitchBoundarySuspects.find((candidate) => candidate.index === finding.index)
      return `الرنين والطبقة اتفقا في الدور ${finding.turn} (${finding.distance.toFixed(2)} · ${pitch.driftHz.toFixed(0)}Hz)`
    }),
  ]
  rejectTake(`↻ نفس الـpreset لكن مو نفس الإنسان عند الانتقال: ${reasons.join(' · ')} — الـTake مرفوض بالكامل.`, {
    stage: 'acoustic-reset', corroboratedBoundaryResets, acousticBoundarySuspects, pitchBoundarySuspects,
  })
}

/* ═══ عتبة الإعادة ═══
   قياس Puck عبر ١٨ نداءً في جلسةٍ واحدة: ١٤٧..٢٠٥ — مدىً ٥٨ هرتزاً.
   فالصوت نفسه يتنقّل بين طبقة رجلٍ وطبقة امرأة، ولا وجود لزوجٍ يضمن
   التمايز دائماً — جُرّبت إحدى عشرة امرأة، ولا واحدة فوق ٢١٠.
   فالعلاج ليس زوجاً أفضل بل **إعادةً عند السقوط**: العيّنة السيئة تُرمى.

   يُفعَّل بـPODCAST_KW_MIN_GAP فقط؛ صفرٌ أو غيابه = السلوك القديم حرفياً.
   والخروج بالرمز ٣ يقع **قبل** كتابة الصوت النهائي وقبل أي رفع، فلا
   يترك أثراً نصف مكتوب. والـworkflow يعيد الTake كله، وإن فشلت المحاولات
   كلها تسقط التشغيلة بدل قبول صوتٍ يعرف الحارس أنه سيئ. */
const MIN_GAP = Number(process.env.PODCAST_KW_MIN_GAP || 0)
if (MIN_GAP > 0 && voiceGap !== null && voiceGap < MIN_GAP) {
  rejectTake(`↻ الفجوة ${voiceGap.toFixed(0)} هرتزاً دون العتبة ${MIN_GAP} — عيّنةٌ مرفوضة، تُعاد.`, {
    stage: 'voice-gap', maleMedianHz: maleMid, femaleMedianHz: femaleMid, voiceGapHz: voiceGap,
  })
}
const regenerated = 0

/* ═══ بوابة الزمن — تقيس ولا تُرقّع ═══
   طرفان: الدور الطويل جداً (تكرار/صدى) والقصير جداً (اقتطاع). وكانت تعيد
   توليد الشاذّ مفرداً — وهذا في وضع النداء الواحد يُدخل نبرةً غريبةً وسط
   نبرةٍ موحّدة، أي يُفسد أثمن ما في الحلقة إصلاحاً لأهون منه. فصارت تقيس
   وتُسمّي فقط؛ والحكم على اللقطة كلها: إن كثر شذوذها أُعيدت **الحلقة
   بأكملها** بنداءٍ واحدٍ جديد (نبرة واحدة أخرى) لا أن تُرقَّع دوراً دوراً. */
const secPerChar = turns.map((t, i) => durations[i] / Math.max(String(t.text || '').length, 1))
const sortedRates = [...secPerChar].sort((a, b) => a - b)
const medianRate = sortedRates[Math.floor(sortedRates.length / 2)] || 0.1
const repeatSuspects = []
const repeatSuspectDetails = []
for (let t = 0; t < turns.length; t += 1) {
  const expected = Math.max(String(turns[t].text || '').length, 1) * medianRate
  const tooLong = durations[t] > expected * 1.9 && durations[t] - expected > 2.5
  const tooShort = durations[t] < expected * 0.55 && expected - durations[t] > 1.5
  if (tooLong || tooShort) {
    repeatSuspects.push(`${t + 1}${tooLong ? '↑' : '↓'} (${durations[t].toFixed(1)}ث/${expected.toFixed(1)}ث)`)
    repeatSuspectDetails.push({ index: t, turn: t + 1, tooLong, tooShort, durationSec: durations[t], expectedSec: expected })
  }
}
const repeatRegens = 0
console.log(repeatSuspects.length
  ? `✓ بوابة الزمن: ${repeatSuspects.length} دوراً تحت السمع — ${repeatSuspects.join(' · ')}`
  : '✓ بوابة الزمن: كل الأدوار في مداها')
const REJECT_TIMING_SUSPECTS = process.env.PODCAST_KW_REJECT_TIMING_SUSPECTS === '1'
const timingWitness = splitAlignmentAudits.find((entry) => !entry.rejected && Array.isArray(entry.perTurnCoverage))
/* طول الحروف تقديرٌ فقط؛ إن شهد التفريغ أن كلمات الدور كلها موجودة فلا
   نعاقب متحدثاً قال الجملة أسرع من الوسيط. القصير يُرفض عند نقص الكلمات،
   والطويل عند سماع كلمات زائدة بوضوح. هكذا نجت عينة 3194 الصحيحة التي كان
   صوتاها ثابتين ورفضها عدّاد 2.1/4.9 وحده. */
const confirmedTimingSuspects = repeatSuspectDetails.filter((finding) => {
  if (!timingWitness) return true
  const coverage = timingWitness.perTurnCoverage[finding.index] ?? 0
  const heardRatio = timingWitness.perTurnHeardRatio[finding.index] ?? 0
  return finding.tooShort ? coverage < 0.80 : (coverage < 0.80 || heardRatio > 1.35)
})
if (repeatSuspects.length && timingWitness && !confirmedTimingSuspects.length) {
  console.log('✓ شاهد الكلمات برّأ اختلاف السرعة: النص كامل داخل الأدوار المشتبهة، فلا رفض بتقدير الحروف وحده')
}
if (REJECT_TIMING_SUSPECTS && confirmedTimingSuspects.length) {
  const confirmedLabels = confirmedTimingSuspects.map((finding) => repeatSuspects[repeatSuspectDetails.indexOf(finding)])
  rejectTake(`↻ قصّ/تمديد مؤكّد بالكلمات في ${confirmedTimingSuspects.length} دور — الـTake مرفوض بالكامل ويُعاد: ${confirmedLabels.join(' · ')}`, {
    stage: 'turn-timing', suspects: confirmedTimingSuspects, durations, medianSecPerChar: medianRate, witness: timingWitness,
  })
}

const audioFile=resolve(AUDIO,`${slug}.dialogue-kw.mp3`)
const transcriptFile=resolve(AUDIO,`${slug}.dialogue-kw.json`)
const assembly=buildTimedMaster(turns,chunkFiles,audioFile,slug)
const timeline=timelineFor(turns,assembly)
writeFileSync(transcriptFile,`${JSON.stringify(timeline,null,2)}\n`)
const audit={
  schemaVersion:1, qualityGateVersion:'kuwaiti-aligned-v14', slug, revisionId, status:'candidate', provider:'gemini', model:MODEL, profile:PROFILE,
  seed:SEED,
  voices:{male:MALE_VOICE,female:FEMALE_VOICE}, sourceFile:`manual-dialogues-kuwaiti/${slug}.json`,
  sourceSha256:sha256(readFileSync(source)), sourceTurnCount:sourceTurns.length, turnCount:turns.length, chunkCount:chunks.length,
  oneTake:!ISOLATE_SPEAKER_STEMS && chunks.length === 1,
  oneTakePerSpeaker:ISOLATE_SPEAKER_STEMS && chunks.length === 1,
  fullDialogueContextPerSpeaker:ISOLATE_SPEAKER_STEMS && !USE_VERTEX,
  targetTurnsContinuousPerSpeaker:ISOLATE_SPEAKER_STEMS && USE_VERTEX,
  speakerIsolation:ISOLATE_SPEAKER_STEMS
    ? (USE_VERTEX ? 'dual-target-continuous-single-voice-stems' : 'dual-full-context-single-voice-stems')
    : 'multispeaker-single-take',
  ttsRequestCount:requestHashes.length,
  ttsInput:ISOLATE_SPEAKER_STEMS
    ? (USE_VERTEX ? 'dry-dialogue-target-turns-continuous-single-voice-stems' : 'dry-dialogue-full-context-single-voice-stems')
    : 'dry-dialogue-only',
  bridgeGeneration:'external-post-tts',
  continuityWarmupTurns:generationGroups.map((group) => group.warmupTurns),
  continuityWarmupEstimatedSec:generationGroups.map((group) => group.warmupEstimatedSec),
  nativeSpoken:{version:sourceLock?.nativeSpokenVersion || '',rewriteCount:Number(sourceLock?.nativeSpokenRewriteCount || 0),
    changesSha256:sourceLock?.nativeSpokenChangesSha256 || '',qafRiskCount:Number(sourceLock?.nativeSpokenQafRiskCount || 0),
    softWarnings:Number(sourceLock?.nativeSpokenSoftWarnings || 0)},
  requestHashes, audioSha256:sha256(readFileSync(audioFile)), transcriptSha256:sha256(readFileSync(transcriptFile)),
  durationSec:duration(audioFile), pitchGate:{maleMedianHz:maleMid?Math.round(maleMid):null,femaleMedianHz:femaleMid?Math.round(femaleMid):null,voiceGapHz:voiceGap?Math.round(voiceGap):null,suspects:swapped,
    femaleContinuity:{anchorHz:femaleContinuity.anchorHz,maxObservedDriftHz:femaleContinuity.maxObservedDriftHz,
      segments:femaleContinuity.segments.map((segment) => ({ segment:segment.segment,medianHz:segment.medianHz,sampleCount:segment.sampleCount })),
      pointSuspects:femaleContinuity.pointSuspects.map((finding) => ({ turn:finding.index + 1,hz:Number(finding.hz.toFixed(1)),driftHz:Number(finding.driftHz.toFixed(1)) })),
      segmentSuspects:femaleContinuity.segmentSuspects.map((segment) => ({ segment:segment.segment,medianHz:segment.medianHz,driftHz:segment.driftHz })),
      swapSegments:femaleSwapSegments},
    maleContinuity:{anchorHz:maleContinuity.anchorHz,maxObservedDriftHz:maleContinuity.maxObservedDriftHz,
      segments:maleContinuity.segments.map((segment) => ({ segment:segment.segment,medianHz:segment.medianHz,sampleCount:segment.sampleCount })),
      pointSuspects:maleContinuity.pointSuspects.map((finding) => ({ turn:finding.index + 1,hz:Number(finding.hz.toFixed(1)),driftHz:Number(finding.driftHz.toFixed(1)) })),
      segmentSuspects:maleContinuity.segmentSuspects.map((segment) => ({ segment:segment.segment,medianHz:segment.medianHz,driftHz:segment.driftHz })),
      swapSegments:maleSwapSegments}},
  acousticContinuity:{method:'18-band-log-spectral-envelope-v1',female:femaleTimbre,male:maleTimbre,
    boundarySuspects:acousticBoundarySuspects,
    corroboratedBoundaryResets,
    pitchBoundarySuspects:pitchBoundarySuspects.map((finding) => ({ turn:finding.index + 1,speaker:finding.speaker,hz:Number(finding.hz.toFixed(1)),driftHz:Number(finding.driftHz.toFixed(1)) }))},
  turnAlignment:{mode:ALIGNMENT_MODE,transcribeModel:TRANSCRIBE_MODEL,witnesses:splitAlignmentAudits},
  repeatGate:{regenerated:repeatRegens,suspects:repeatSuspects,
    confirmedSuspects:confirmedTimingSuspects.map((finding) => ({ turn:finding.turn,tooLong:finding.tooLong,tooShort:finding.tooShort })),
    medianSecPerChar:Number(medianRate.toFixed(4))},
  mastered:{lufsTarget:-16,truePeakTarget:-1.5,sampleRate:48000,channels:1,bitrateKbps:160,nativeTurnTimingPreserved:PRESERVE_NATIVE_TURN_TIMING,
    longSilenceCompaction:{maxSilenceMs:MAX_INTERNAL_SILENCE_MS,triggerMs:LONG_SILENCE_TRIGGER_MS,calls:silenceCompaction.calls,removedSec:Number(silenceCompaction.removedSec.toFixed(3))}},
  generatedAt:new Date().toISOString(),
}
writeFileSync(resolve(AUDITS,`${slug}.json`),`${JSON.stringify(audit,null,2)}\n`)
console.log(`✓ جاهز: audio/${slug}.dialogue-kw.mp3`)
console.log(`✓ النص المتزامن: audio/${slug}.dialogue-kw.json`)
