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
import { buildPronunciationMap, toSpokenKuwaiti, buildForeignRedactions, redactForeignNames } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const TMP = resolve(ROOT, '.podcast-kw-tmp')
const AUDITS = resolve(ROOT, 'podcast-audits', 'kuwaiti')
const STATE = resolve(ROOT, '.podcast-state.json')
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview'
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
const TURNS_PER_REQUEST = Math.max(2, Math.min(64, Number(process.env.PODCAST_KW_TURNS_PER_REQUEST || 64)))

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
    /* الجسر يُركَّب في التجميع لا في التوليد، فلا يقفل النداء: إقفاله كان
       يشطر الحلقة إلى ثلاثة نداءات = ثلاث نبرات. يبقى قافلاً حين تُطلب
       دفعاتٌ صغيرة صراحةً (PODCAST_KW_TURNS_PER_REQUEST). */
    if (turn.musicBridgeAfter && row.length >= 2 && maxTurns < 16) { chunks.push(row); row = []; chars = 0 }
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
const directionFor = (type) => ({
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

function promptFor(turns, index, total) {
  /* تذكيرٌ يتخلّل النصّ كل عشرة أدوار: في النداء الواحد تبتعد تعليماتُ الرأس
     عن أواخر الحلقة فتفتر اللكنة تدريجياً — وهو ما سمعه الدكتور. السطر
     المتخلّل يُعيد شدَّ اللكنة من داخل النصّ نفسه، ولا يُنطق لأنه تعليمةٌ
     بين قوسين معقوفين على سطرٍ مستقلٍّ بلا اسم متحدّث. */
  const lines = []
  turns.forEach((turn, index) => {
      /* [٢١ أغسطس ٢٠٢٦] كان التذكير إنجليزيّاً كل عشرة أدوار — منعٌ لا مرساة.
         وحكم الدكتور على أول حلقةٍ بالمرساة العربية: «البداية كانت كويتية ١٠٠٠٠٠٪»
         ثم تنجرف بعد الدقيقة الثانية. فالمرساة تعمل ويتلاشى أثرها. فصار التذكير
         **نسخةً مصغّرة من المرساة نفسها بالعربية**، وكل ستة أدوارٍ لا عشرة —
         لأن الانجراف يبدأ نحو الدور العشرين. */
      if (index > 0 && index % 6 === 0) {
        lines.push('[تذكير — نفس لسان مدينة الكويت الذي بدأتَ به: «شخبارك؟ شلونك اليوم؟» · خفيفٌ في الفم، لا تفخيم ولا إطالة، ونهاية الجملة تنزل هادئة. وبنفس حماس أول سطرٍ وحيويته: أنتما اثنان مهتمّان بما تقولان، لا قارئان لنصّ. الحيوية في الحوار لا في ثِقَل النطق. لا تسترخِ ولا تبرد كلما طال التسجيل.]')
    }
    lines.push(`${turn.speaker === 'male' ? 'Fahad' : 'Noura'}: ${directionFor(turn.deliveryType)} ${spokenForm(turn.text)}`.replace(/:\s+\[/, ': ['))
  })
  const transcript = lines.join('\n')
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

SCENE
A quiet modern studio in Kuwait. Two colleagues are discussing an idea for a thoughtful general audience. It must feel like a real relaxed Kuwaiti conversation, not an announcer reading copy.

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
- القاف: قُلها خفيفةً غيرَ مفخّمة، لا قافاً فصيحةً ثقيلةً من أقصى الحلق. مثل: أقوى · بقاء · حقيقية · ضيق · صدق — كلها بقافٍ خفيفةٍ مرتخية.
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

async function geminiPcm(prompt) {
  if (!KEY) throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY مفقود')
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
      /* 429: تُحترم مهلة الخادم نفسها، ويُفرَّغ سجلّ النافذة كي لا يُطلق
         الطلبُ التالي في دقيقةٍ ما زالت مستهلكة. */
      if (response.status === 429) {
        quotaWaitMs = retryAfterMs(body, message) || 15_000 * attempt
        requestTimes.length = 0
        console.log(`⏳ الحصة امتلأت — انتظار ${(quotaWaitMs / 1000).toFixed(1)} ثانية (محاولة ${attempt}/6)`)
      }
      last = new Error(message)
    } catch (error) { last = error }
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
  introSec: 5.6, introLufs: -19, introFadeIn: 0.55, introFadeOut: 1.15, introOverlapSec: 1.15,
  outroSec: 6.5, outroLufs: -19, outroFadeIn: 0.65, outroFadeOut: 2.20, outroOverlapSec: 0.76,
  /* الجسر فاصلٌ يُنتظر، لا نغمةٌ تمرّ تحت الكلام. كان ١.٦٠ث والمتحدث التالي
     يدخل بعد ٠.٧٢ث من بدايته، فيدهسه قبل أن يأخذ حقّه — وهذه شكوى الدكتور. */
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
   الجملة، فأطولُ (ن-١) صمتةً هي حدود المداخلات. وإن لم يُطابق العدد — لأي
   سببٍ — يعود المقطع مداخلةً مداخلةً كما كان، فلا تُفقد حلقةٌ أبداً. */
function detectSilences(file) {
  const run = spawnSync(FFMPEG, ['-hide_banner','-nostats','-i',file,'-af','silencedetect=noise=-38dB:d=0.24','-f','null','-'], { encoding:'utf8' })
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
 * بأكثر من نصف متوسّط المداخلة، فالقصّ غير موثوق: يُرَدُّ ‎null‎ فيسقط
 * التوليد إلى الشطر — نبرتان صادقتان خيرٌ من سبعٍ وثلاثين حدّاً كاذباً.
 */
export function chooseSplitPoints(gaps, expectedTurns, totalSec, edgeGuardSec = 0.45, weights = null) {
  if (expectedTurns <= 1) return []
  const inner = gaps.filter((gap) => gap.mid > edgeGuardSec && gap.mid < totalSec - edgeGuardSec)
  if (inner.length < expectedTurns - 1) return null
  if (!weights || weights.length !== expectedTurns) {
    const strongest = [...inner].sort((a, b) => b.span - a.span).slice(0, expectedTurns - 1)
    return strongest.map((gap) => gap.mid).sort((a, b) => a - b)
  }
  const totalWeight = weights.reduce((sum, w) => sum + Math.max(w, 1), 0)
  const ordered = [...inner].sort((a, b) => a.mid - b.mid)
  const tolerance = (totalSec / expectedTurns) * 0.5
  const cuts = []
  let acc = 0
  let from = 0
  for (let i = 0; i < expectedTurns - 1; i += 1) {
    acc += Math.max(weights[i], 1)
    const target = totalSec * (acc / totalWeight)
    let best = -1
    let bestDistance = Infinity
    /* يبقى مكانٌ لكل حدٍّ باقٍ بعد هذا الحدّ. */
    const limit = ordered.length - (expectedTurns - 2 - i)
    for (let k = from; k < limit; k += 1) {
      const distance = Math.abs(ordered[k].mid - target)
      if (distance < bestDistance) { bestDistance = distance; best = k }
    }
    if (best < 0 || bestDistance > tolerance) return null
    cuts.push(ordered[best].mid)
    from = best + 1
  }
  return cuts
}

function splitChunk(file, chunkTurnsList, outPrefix) {
  const expected = chunkTurnsList.length
  if (expected === 1) return [file]
  let total = 0
  try { total = duration(file) } catch { return null }
  const weights = chunkTurnsList.map((turn) => String(turn.text || '').length)
  const cuts = chooseSplitPoints(detectSilences(file), expected, total, 0.45, weights)
  if (!cuts) return null
  const bounds = [0, ...cuts, total]
  const parts = []
  for (let i = 0; i < expected; i += 1) {
    const from = bounds[i]
    const to = bounds[i + 1]
    if (!(to - from > 0.35)) return null
    const part = `${outPrefix}-${String(i + 1).padStart(2, '0')}.wav`
    const run = spawnSync(FFMPEG, ['-hide_banner','-loglevel','error','-y','-ss',from.toFixed(3),'-t',(to - from).toFixed(3),
      '-i',file,'-ar','24000','-ac','1','-c:a','pcm_s16le',part], { encoding:'utf8' })
    if (run.status !== 0 || !existsSync(part)) return null
    parts.push(part)
  }
  return parts
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
        const overlap = Math.max(0, Math.min(150, Number(turns[j].overlapMs || 0)))
        items[j].startSec = overlap > 0
          ? Math.max(0, prev.startSec + prev.durationSec - overlap / 1000)
          : prev.startSec + prev.durationSec + Math.max(80, Math.min(1200, Number(turns[j - 1].pauseAfterMs || 320))) / 1000
        if (turns[j - 1].musicBridgeAfter) items[j].startSec = Math.max(items[j].startSec, prev.startSec + prev.durationSec + 0.55)
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
    pauseAfterMs: Number(turns[index].pauseAfterMs || 0),
    overlapMs: Number(turns[index].overlapMs || 0),
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
  /* الوضع المعتمد: الحلقة كلها نداءٌ واحدٌ — نبرةٌ واحدةٌ بلا تبدّل. */
  assert.equal(chunkTurns(turns).length, 1, 'الحلقة تُولَّد بنداءٍ واحدٍ فتثبت النبرة')
  /* وحين تُطلب دفعاتٌ صغيرةٌ صراحةً يعود الجسر حدّاً طبيعياً لا يُعبر. */
  const chunks = chunkTurns(turns, { maxTurns: 8 })
  assert.equal(chunks.length, 2, 'الجسر الموسيقي يقفل المقطع في الدفعات الصغيرة')
  assert.deepEqual(chunks.map((chunk) => chunk.length), [2, 1])
  const prompt = promptFor(chunks[0],0,chunks.length)
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
  const longPrompt = promptFor(longTurns, 0, 1)
    /* [٢١ أغسطس ٢٠٢٦] التذكير صار عربيّاً وكل ستة أدوار، فالعدد المتوقّع تغيّر.
       يُحسب من طول النصّ لا برقمٍ ثابت، حتى لا يكذب التأكيد إن تغيّرت الوتيرة. */
    const expectedReminders = Math.floor((longTurns.length - 1) / 6)
    assert.equal((longPrompt.match(/\[تذكير — نفس لسان مدينة الكويت/g) || []).length, expectedReminders,
      'التذكير العربيّ يتخلّل النصّ مرّةً كل ستة أدوار — رُدّت من ٤ بأمره بعد أن أكثرت الأخطاء')
    assert.ok(!/\[REMINDER —/.test(longPrompt), 'لم يبقَ تذكيرٌ إنجليزيّ قديم')
    assert.ok(expectedReminders >= 2, 'النصّ الطويل يحمل تذكيرين على الأقل')
  assert.ok(!/ض/.test(longPrompt.split('\n').filter((line) => /^(Fahad|Noura):/.test(line)).join(' ')),
    'الضاد صارت ظاءً في كل سطور الصوت')
  assert.match(prompt,/ALWAYS the male voice/i, 'منع تبديل الأصوات: فهد ذكر دائماً ونورة أنثى دائماً')
  /* بوابة الطبقة: النطاقات لا تتلامس فلا يقع دورٌ في الجنسين معاً. */
  assert.ok(voiceSwapped(true, 180) && !voiceSwapped(true, 120) && voiceSwapped(false, 120) && !voiceSwapped(false, 180), 'بوابة الطبقة تحكم بالنطاق الصحيح')
  assert.ok(!voiceSwapped(true, 157) && !voiceSwapped(false, 157), 'المنطقة الرمادية 150-165 بريئة لا تحرق إعادات')
  assert.ok(!voiceSwapped(true, null), 'غياب القياس لا يُنذر')
  assert.match(prompt,/FINAL CHECK — LAST INSTRUCTION/i, 'القفل الثالث: الفحص الختامي بعد النص')
  assert.ok(prompt.split('\n').filter(l=>/^(Fahad|Noura):/.test(l)).every(l=>l.includes(KW_LOCK)), 'القفل الثاني: تاج اللهجة يركب كل سطر حوار بلا استثناء')
  /* [٢١ أغسطس ٢٠٢٦] الانجراف المسموع إماراتيٌّ بالاسم («مرات كويتي ومرات
     اماراتي»)، ورأس الطلب وحده لا يحرس أواخر الحلقة — فالاسم يجب أن يركب
     التاج نفسه في كل دور. التأكيد هنا يمنع كنسةً مستقبلية من إسقاطه. */
  assert.match(KW_LOCK, /never Emirati/, 'تاج كل دورٍ يسمّي الإماراتي — موضع الانجراف الذي سمعه الدكتور بعد الدقيقة الأولى')
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

  /* حصة الطبقة المجانية: عشرة طلباتٍ في الدقيقة. المنظّم يبقى دونها،
     ومهلة الخادم تُقرأ من الحقل ومن نصّ الرسالة معاً. */
  assert.ok(RPM <= 10, `إيقاع ${RPM} طلباً/دقيقة يتجاوز حصة النموذج المجانية`)

  /* عقد تماسك الصوت: الطلب يحمل عدّة مداخلاتٍ فتقلّ حدود الانزلاق، والقصّ
     يرفض ما لا يطابق فيعود إلى التوليد المفرد بدل أن يخترع حدوداً. */
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
    /* السابقة الملاصقة تُختبر على مدخلٍ قائمٍ (ألف الوصل) بعد حذف الهجاء المخترع. */
    assert.equal(spokenForm('وتعرف الفرق'), 'واتعرف الفرق', 'السابقة الملاصقة لا تمنع النطق')
    const trap = 'المجموع والجمال وجمعنا'
    assert.equal(spokenForm(trap), trap, 'ما كانت «جم» جزءاً منه لا يُمسّ')
    /* گ كانت ممنوعةً كلياً لأنها في v3 أُدخلت قاعدةً عامّةً على كل قاف فأسقطت
       چ معها. والآن چ نفسها لم تعد تُكتب حرفاً بل صوتاً («تش»)، فزال التعارض،
       وأذن الدكتور اعتمدت «أَصْدَگ» في موضعها. فالحارس يمنع التعميم لا الحرف:
       تبقى گ في كلماتٍ معدودةٍ مسموعةٍ فردياً، ولا تتجاوزها. */
    const gafWords = Object.values(PRONUNCIATION_SOURCE.words || {}).filter((value) => String(value).includes('گ'))
    assert.ok(gafWords.length <= 5, `گ تبقى في كلماتٍ معدودةٍ بالسماع لا قاعدةً عامّة (الآن ${gafWords.length})`)
    /* الچ مسموحةٌ في المفاتيح (نصّ الدكتور يكتبها) وممنوعةٌ في النواتج
       (المحرّك يبتلعها) — فتُفحص جهةُ الخرج وحدها. */
    const chehOut = Object.values(PRONUNCIATION_SOURCE.words || {}).filter((value) => String(value).includes('چ'))
    assert.equal(chehOut.length, 0, 'چ لا تصل المحرّك حرفاً — تُكتب صوتاً «تش»')
    /* حذف الأسماء اللاتينية: أوضح سبب تبدّل الصوت (Frontiers سمعها الدكتور «فلنتير»). */
    assert.equal(spokenForm('منشور في Frontiers in Psychology عن القلق'), 'منشور في مجلة علمية عن القلق', 'الاسم اللاتيني يُحذف ويُستبدل بعربية عامة')
    assert.ok(!/[A-Za-z]/.test(spokenForm('حسب OECD وUNICEF')), 'لا يبقى أيّ حرف لاتيني في مدخل الصوت')
  }
  const grouped = chunkTurns(Array.from({ length: 12 }, (_, i) => ({
    speaker: i % 2 ? 'female' : 'male', text: `مداخلة ${i}`, deliveryType: 'statement', musicBridgeAfter: false,
  })))
  assert.ok(grouped.length < 12, `التجميع لم يحدث: ${grouped.length} مقاطع لـ12 مداخلة`)
  assert.equal(grouped.flat().length, 12, 'التجميع لا يفقد مداخلةً ولا يكرّرها')
  const fakeGaps = [{ mid: 2.0, span: 0.5 }, { mid: 3.7, span: 0.5 }, { mid: 6.3, span: 0.5 }]
  assert.deepEqual(chooseSplitPoints(fakeGaps, 4, 8.1), [2.0, 3.7, 6.3], 'حدود المداخلات تُقرأ من أطول الصمتات')
  assert.equal(chooseSplitPoints(fakeGaps, 9, 8.1), null, 'نقصُ الصمتات يعني الرجوع للتوليد المفرد لا اختراع حدود')
  assert.deepEqual(chooseSplitPoints([], 1, 5), [], 'مداخلةٌ واحدةٌ لا تحتاج قصّاً')
  /* الأوزان تُرجّح الموضع المتوقّع على طول الصمتة: مداخلةٌ طويلةٌ ثم قصيرة،
     والصمتة الأطول واقعةٌ باكراً — القديم كان يقتنصها فيمنح القصيرة أكثرَ حقّها. */
  const weighted = [{ mid: 1.0, span: 1.2 }, { mid: 6.0, span: 0.3 }]
  assert.deepEqual(chooseSplitPoints(weighted, 2, 8, 0.45, [70, 10]), [6.0],
    'الحدّ يُختار بموضعه المتوقّع لا بطول صمتته')
  assert.equal(chooseSplitPoints([{ mid: 1.0, span: 0.5 }], 2, 20, 0.45, [50, 50]), null,
    'الصمتة البعيدة عن موضعها المتوقّع تُرَدّ فيسقط التوليد إلى الشطر')
  assert.equal(retryAfterMs({ error:{ details:[{ retryDelay:'1.875496542s' }] } }, ''), 2626, 'مهلة الخادم من details')
  assert.equal(retryAfterMs(null, 'Please retry in 12.5s'), 13250, 'مهلة الخادم من نصّ الرسالة')
  assert.equal(retryAfterMs(null, 'boom'), 0, 'بلا مهلةٍ معلنة يعود إلى التراجع الأسّي')

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
const delivery = recoverDeliveryTypes(turns, slug)
if (delivery.recovered) {
  turns.splice(0, turns.length, ...delivery.turns)
  console.log(`✓ توجيهات الأداء: استُردّت ${delivery.recovered} من ${turns.length} من المصدر الفصيح`)
} else if (delivery.reason && delivery.reason !== 'المصدر يحملها أصلاً') {
  console.log(`⚠️ توجيهات الأداء لم تُستردّ (${delivery.reason}) — النبرة ستكون موحّدة`)
}
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
let rescuedChunks=0
for (let i=0;i<chunks.length;i+=1) {
  const group=chunks[i]
  console.log(`🎙️ Gemini ${i+1}/${chunks.length} (${group.length} مداخلة)`)
  const prompt=prompts[i]; requestHashes.push(sha256(prompt))
  const stem=resolve(TMP,`chunk-${String(i+1).padStart(2,'0')}`)
  const rawWav=`${stem}.raw.wav`
  let pcm=null
  try { pcm=await geminiPcm(prompt) }
  catch (error) {
    /* إخفاق النداء الضخم (مهلة أو خطأ) لا يُسقط الحلقة: تُشطر المجموعة
       نصفين ويُولَّد كلٌّ منهما — نبرتان خيرٌ من لا حلقة. */
    if (group.length < 2) throw error
    console.log(`↻ أخفق نداء المقطع ${i+1} (${group.length} مداخلة): ${error.message} — يُشطر نصفين`)
    rescuedChunks += 1
    const half=Math.ceil(group.length/2)
    const halves=[group.slice(0,half), group.slice(half)]
    const files=[]
    for (let h=0;h<halves.length;h+=1) {
      const hp=promptFor(halves[h], i, chunks.length)
      requestHashes.push(sha256(hp))
      const hraw=`${stem}-fb${h+1}.raw.wav`
      writePcmWav(hraw, await geminiPcm(hp))
      const hsplit=splitChunk(hraw, halves[h], `${stem}-fb${h+1}`)
      files.push(...(hsplit || [hraw]))
    }
    if (files.length === group.length) {
      files.forEach((part, j) => {
        const clean=`${stem}-turn-${String(j+1).padStart(2,'0')}.wav`
        chunkFiles.push(tightenChunk(part, clean)); durations.push(duration(chunkFiles.at(-1)))
      })
      continue
    }
    throw new Error(`تعذّر إنقاذ المقطع ${i+1}: ${files.length} ملفاً لـ${group.length} مداخلة`)
  }
  writePcmWav(rawWav,pcm)

  /* المقطع يحمل عدّة مداخلات بصوتٍ متّسق؛ يُقصّ إلى مداخلاته ليبقى التوقيت
     الدقيق لكل واحدةٍ منها. وإن تعذّر القصّ رجعنا لهذا المقطع وحده إلى
     مداخلةٍ لكل طلب: صوتٌ يتبدّل في أربع مداخلاتٍ خيرٌ من حلقةٍ تسقط. */
  let parts=splitChunk(rawWav, group, stem)
  if (!parts) {
    if (group.length > 1) {
      /* الإنقاذ بالنصفين لا بالأفراد: النداء الواحد للحلقة كلها قد يتعذّر قصّه
         إلى سبعةٍ وثلاثين، فالسقوط إلى سبعةٍ وثلاثين نداءً مفرداً يعني سبعاً
         وثلاثين نبرة — وهو أسوأ ما يكون لأثقل شكاوى الدكتور. فيُشطر المقطع
         نصفين ويُعاد توليد كلٍّ منهما، ثم يُشطر ما يتعذّر منهما، حتى يُقصّ
         أو يبلغ الفرد. النبرات تُعدّ باللوغاريتم لا بالعدد. */
      console.log(`↻ تعذّر قصّ المقطع ${i+1} إلى ${group.length} مداخلة — يُشطر نصفين`)
      rescuedChunks += 1
      const rescue = async (subgroup, tag) => {
        if (subgroup.length === 1) {
          const p=promptFor(subgroup, i, chunks.length)
          requestHashes.push(sha256(p))
          const raw=`${stem}-${tag}.raw.wav`
          writePcmWav(raw, await geminiPcm(p))
          return [raw]
        }
        const p=promptFor(subgroup, i, chunks.length)
        requestHashes.push(sha256(p))
        const raw=`${stem}-${tag}.raw.wav`
        writePcmWav(raw, await geminiPcm(p))
        const split=splitChunk(raw, subgroup, `${stem}-${tag}`)
        if (split) return split
        const mid=Math.ceil(subgroup.length/2)
        return [...await rescue(subgroup.slice(0,mid), `${tag}a`), ...await rescue(subgroup.slice(mid), `${tag}b`)]
      }
      const mid=Math.ceil(group.length/2)
      parts=[...await rescue(group.slice(0,mid), 'h1'), ...await rescue(group.slice(mid), 'h2')]
    } else parts=[rawWav]
  }

  /* Gemini يترك هواءً ميّتاً في طرفَي كل مداخلة، فيتراكم على عشرات المداخلات
     إلى بطءٍ محسوس. يُقصّ الصمت من الطرفين فقط — لا يُمسّ صمتٌ داخل الجملة،
     فتبقى الوقفة الطبيعية التي تصنع المعنى. */
  parts.forEach((part, j) => {
    const clean=`${stem}-turn-${String(j+1).padStart(2,'0')}.wav`
    const finalFile=tightenChunk(part, clean)
    chunkFiles.push(finalFile); durations.push(duration(finalFile))
  })
}
if (chunkFiles.length !== turns.length) {
  throw new Error(`عدد المقاطع ${chunkFiles.length} لا يطابق ${turns.length} مداخلة`)
}
console.log(`✓ ${chunks.length} طلباً لـ${turns.length} مداخلة${rescuedChunks ? ` · ${rescuedChunks} مقطعاً عاد إلى التوليد المفرد` : ''}`)

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
if (maleMid && femaleMid && femaleMid - maleMid > 12) {
  for (let t = 0; t < turns.length; t += 1) {
    const f0 = pitchOf[t]; if (!f0) continue
    const expectMale = turns[t].speaker === 'male'
    const own = expectMale ? maleMid : femaleMid
    const other = expectMale ? femaleMid : maleMid
    /* شاذٌّ صارخ: أقرب إلى الحنجرة الأخرى بفارق يتجاوز نصف المسافة بينهما. */
    if (Math.abs(f0 - other) + (femaleMid - maleMid) * 0.5 < Math.abs(f0 - own)) {
      swapped.push(`${t + 1} (${expectMale ? 'فهد' : 'نورة'} ${f0.toFixed(0)}Hz)`)
    }
  }
}
/* فجوة الحنجرتين: قياسٌ يمسك «صوتٌ واحدٌ يقرأ الحوار كله» قبل أذن الدكتور.
   المقيس على نسخةٍ أعجبته: ٣٤ هرتزاً. وعلى نسخةٍ سمعها صوتاً واحداً: ٢٢.
   فما دون الخامس والعشرين إنذارٌ يُعلن ولا يُسقط — الحكم النهائي لأذنه. */
const voiceGap = (maleMid && femaleMid) ? femaleMid - maleMid : null
console.log(`✓ بوابة الطبقة: وسيط فهد ${maleMid ? maleMid.toFixed(0) : '—'}Hz · نورة ${femaleMid ? femaleMid.toFixed(0) : '—'}Hz${swapped.length ? ` · أدوار مشتبهة: ${swapped.join(' · ')}` : ' · لا انعكاس'}`)
if (voiceGap !== null) {
  console.log(voiceGap < 25
    ? `⚠️ فجوة الحنجرتين ${voiceGap.toFixed(0)} هرتزاً — الصوتان متقاربان وقد يُسمعان صوتاً واحداً (المريح ≥ ٣٠)`
    : `✓ فجوة الحنجرتين ${voiceGap.toFixed(0)} هرتزاً — صوتان متمايزان`)
}

/* ═══ عتبة الإعادة ═══
   قياس Puck عبر ١٨ نداءً في جلسةٍ واحدة: ١٤٧..٢٠٥ — مدىً ٥٨ هرتزاً.
   فالصوت نفسه يتنقّل بين طبقة رجلٍ وطبقة امرأة، ولا وجود لزوجٍ يضمن
   التمايز دائماً — جُرّبت إحدى عشرة امرأة، ولا واحدة فوق ٢١٠.
   فالعلاج ليس زوجاً أفضل بل **إعادةً عند السقوط**: العيّنة السيئة تُرمى.

   يُفعَّل بـPODCAST_KW_MIN_GAP فقط؛ صفرٌ أو غيابه = السلوك القديم حرفياً.
   والخروج بالرمز ٣ يقع **قبل** كتابة الصوت النهائي وقبل أي رفع، فلا
   يترك أثراً نصف مكتوب. والورك-فلو يعيد، ويقبل آخر محاولةٍ كما هي
   حتى لا نبقى بلا حلقة. */
const MIN_GAP = Number(process.env.PODCAST_KW_MIN_GAP || 0)
if (MIN_GAP > 0 && voiceGap !== null && voiceGap < MIN_GAP) {
  console.error(`↻ الفجوة ${voiceGap.toFixed(0)} هرتزاً دون العتبة ${MIN_GAP} — عيّنةٌ مرفوضة، تُعاد.`)
  process.exit(3)
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
for (let t = 0; t < turns.length; t += 1) {
  const expected = Math.max(String(turns[t].text || '').length, 1) * medianRate
  const tooLong = durations[t] > expected * 1.9 && durations[t] - expected > 2.5
  const tooShort = durations[t] < expected * 0.55 && expected - durations[t] > 1.5
  if (tooLong || tooShort) repeatSuspects.push(`${t + 1}${tooLong ? '↑' : '↓'} (${durations[t].toFixed(1)}ث/${expected.toFixed(1)}ث)`)
}
const repeatRegens = 0
console.log(repeatSuspects.length
  ? `✓ بوابة الزمن: ${repeatSuspects.length} دوراً تحت السمع — ${repeatSuspects.join(' · ')}`
  : '✓ بوابة الزمن: كل الأدوار في مداها')

const audioFile=resolve(AUDIO,`${slug}.dialogue-kw.mp3`)
const transcriptFile=resolve(AUDIO,`${slug}.dialogue-kw.json`)
const assembly=buildTimedMaster(turns,chunkFiles,audioFile,slug)
const timeline=timelineFor(turns,assembly)
writeFileSync(transcriptFile,`${JSON.stringify(timeline,null,2)}\n`)
const audit={
  schemaVersion:1, slug, revisionId, status:'candidate', provider:'gemini', model:MODEL, profile:PROFILE,
  voices:{male:MALE_VOICE,female:FEMALE_VOICE}, sourceFile:`manual-dialogues-kuwaiti/${slug}.json`,
  sourceSha256:sha256(readFileSync(source)), turnCount:turns.length, chunkCount:chunks.length,
  requestHashes, audioSha256:sha256(readFileSync(audioFile)), transcriptSha256:sha256(readFileSync(transcriptFile)),
  durationSec:duration(audioFile), pitchGate:{maleMedianHz:maleMid?Math.round(maleMid):null,femaleMedianHz:femaleMid?Math.round(femaleMid):null,voiceGapHz:voiceGap?Math.round(voiceGap):null,suspects:swapped},
  repeatGate:{regenerated:repeatRegens,suspects:repeatSuspects,medianSecPerChar:Number(medianRate.toFixed(4))},
  mastered:{lufsTarget:-16,truePeakTarget:-1.5,sampleRate:48000,channels:1,bitrateKbps:160},
  generatedAt:new Date().toISOString(),
}
writeFileSync(resolve(AUDITS,`${slug}.json`),`${JSON.stringify(audit,null,2)}\n`)
console.log(`✓ جاهز: audio/${slug}.dialogue-kw.mp3`)
console.log(`✓ النص المتزامن: audio/${slug}.dialogue-kw.json`)
