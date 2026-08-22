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
/* [٢١ أغسطس ٢٠٢٦] الافتراض الأنثوي كان Callirrhoe وقد اعتُمدت Zephyr بأذنه
   («روعه») على البيك أوف الثالث — فكانت نورة ستُسمع في المختبر بغير صوتها
   المعتمد، ويُحكم على الكلمة بحنجرةٍ لن تنطقها في الحلقة. الافتراض يطابق
   الآن محرّك الحلقات (GEMINI_TTS_FEMALE_VOICE=Zephyr). */
const MALE = process.env.PODCAST_KW_MALE_VOICE || 'Puck'
const FEMALE = process.env.PODCAST_KW_FEMALE_VOICE || 'Zephyr'

const KW = '[Kuwaiti Kuwait-City accent only]'
const NUM = ['واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر']

/* كل كلمةٍ شكا منها الدكتور (٢٠ أغسطس ٢٠٢٦) مع جملتها الحاملة من المتن.
   البدائل ثلاثة أنواع لا رابع:
     • الحالة الراهنة (ليقارن)
     • هجاءٌ صوتي (الگ) — جُرّب مع Azure فسقط، ولم يُجرَّب مع Gemini
     • استبدالٌ بكلمةٍ كويتيةٍ حقيقية بلا قاف — الطريق الذي نجح في «معلقة→مربوطة»
   لا كلمة مخترعة هنا. */
const WORDS = [
  /* ═══ الجولة ١٦ (٢٢ أغسطس ٢٠٢٦ مساءً) — حسم القاف والاسم ═══
     أمر الدكتور بعد كناريا v3: «احنا ما نفخم القاف… القاف نحط فوقها
     ٣ نقط». والثلاث نقط ڨ، والگ جُرّبت سابقاً فنجحت في «أگرب» وسقطت
     في «أگوى» — فالهجاء يُحسم بأذنه لا بقياسي. وفي نصّ صديقك وحده
     ٨٥ كلمة قاف في ١٢٦ موضعاً، فالقرار هنا يحكم المتن كله.
     واسمه قيل خطأً في أربع حلقات من خمس — وهذا أخطر ما في الجولة. */

  /* الاسم — الحالي «الفيلتشاوي» (اختاره سماعاً ١٥ أغسطس)، والذاكرة تقول
     الواجب «الفَيْلَكَاوِي» بالكاف والسكون. تعارضٌ يحسمه هو. */
  { key: 'اسم الدكتور', speaker: 'Noura',
    carrier: 'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في {W}.',
    options: ['موقع الدكتور أحمد حسين الفيلتشاوي',
              'موقع الدكتور أَحْمَدْ حُسَيْنْ الفَيْلَكَاوِي',
              'موقع الدكتور أحمد حسين الفيلچاوي'] },

  /* القاف — أربع كلمات موروثة عالية التكرار، كلٌّ بثلاثة هجاءات:
     الحالي · الگ (نجحت في أگرب) · الڨ (ثلاث نقط كما أمر). */
  { key: 'يقول', speaker: 'Fahad',
    carrier: 'بدال ما يفكر وين غلطت، يقعد يفكر شنو {W}ون عني؟',
    options: ['يق', 'يگ', 'يڨ'] },
  { key: 'قال', speaker: 'Noura',
    carrier: 'هذا اللي {W}ه أبوه أول شي.',
    options: ['ق', 'گ', 'ڨ'] },
  { key: 'عقب', speaker: 'Noura',
    carrier: 'تصير، خصوصا {W} ضغط طويل.',
    options: ['عقب', 'عگب', 'عڨب'] },
  { key: 'قاعد', speaker: 'Fahad',
    carrier: 'شنو {W} يسوي الحين؟',
    options: ['قاعد', 'گاعد', 'ڨاعد'] },

  /* «شُغل ما نحط ضمه» — نقضٌ صريح لاختياره السابق «شُغُل» (مختبر الثماني
     ٧/٢). فتُعرض المجرّدة والفتحة والضمة الواحدة. */
  { key: 'شغل', speaker: 'Fahad',
    carrier: 'ودافعية كلها {W} دفع وخوف مو {W} رغبة.',
    options: ['شغل', 'شَغل', 'شُغل'] },

  /* «تبقى» سمعها مفخّمة، و«وقت» أعلى كلمات القاف تكراراً بعد الأربع. */
  { key: 'تبقى', speaker: 'Noura',
    carrier: 'وهني الورقة ما {W} ورقة.',
    options: ['تبقى', 'تبگى', 'تبڨى'] },
  { key: 'وقت', speaker: 'Fahad',
    carrier: 'ما عندنا {W} نضيعه.',
    options: ['وقت', 'وگت', 'وڨت'] },
]

/* ═══ أرشيف الجولات — للرجوع لا للتشغيل ═══ */
const WORDS_ROUND_9 = [
  /* الجولة الثامنة (٢١ أغسطس ٢٠٢٦ مساءً) — ملاحظات الدكتور على حلقة إصلاح
     الموسيقى (تشغيلة 32478195899). الجمل الحاملة مكتوبة بإملاء مدخل الصوت
     نفسه (بعد المعجم وقلب الضاد) لأن المختبر يقرأ حرفياً كما كُتب،
     فتُسمع الكلمة في بيئتها الصوتية الحقيقية لا في نصٍّ لم يصل المحرّك قط. */

  /* دور ٧ — «النجاح ما عاد بداية وعي»: «ما عاد» نفسها من إصلاحٍ سابق
     («ما يعود ← ما عاد») وحكمه الآن: «مو راكبه». البديلان كويتيان حقيقيان. */
  { key: 'ما عاد', speaker: 'Fahad',
    carrier: 'لما الامتحان يتحول لمعركة بقاء، النجاح {W} بداية وعي؛ يصير نهاية توتر.',
    options: ['ما عاد', 'ما يصير', 'مو'] },

  /* دور ١٦ — سمعها «غلط». الذي وصل المحرّك فعلاً «ما ايطمنه»: مدخل
     «يطمنه ← ايطمنه» أطلق ألف الوصل بعد «ما» فصارت ثقيلة في هذا الموضع
     تحديداً — نمط المفتاح الحامل سياقه («ورقة وقلم ← قلم ودفتر»). */
  { key: 'ما يطمنه', speaker: 'Fahad',
    carrier: 'لأنه {W} من داخل؛ بس يأجل خوفه للاختبار الياي.',
    options: ['ما ايطمنه', 'ما يطمنه', 'ما يريحه'] },

  /* دور ١٨ — سمعها إماراتية. الذي وصل المحرّك «عارفها بعقله» (المعجم بدّل
     «يدريها»). الثالث هو الأصل بلا استبدال ليُقارن. */
  { key: 'عارفها بعقله', speaker: 'Fahad',
    carrier: '{W}، إي. بس الإحساس مو دايما يسمع كلام العقل.',
    options: ['عارفها بعقله', 'داري فيها بعقله', 'يدريها بعقله'] },

  /* دور ١٩ — سمعتها نورة إماراتية. الذي وصل المحرّك «لظعف» (قلب الضاد
     الشامل). الثاني بالضاد الفصيحة ليُقارن أثر القلب في هذا الموضع،
     والثالث مشكولٌ يثبّت المقاطع. */
  { key: 'لظعف ثقته بنفسه', speaker: 'Noura',
    carrier: 'لما الواحد يربط قيمته بروحه بدرجاته، هالشي يجره بعدين {W}.',
    options: ['لظعف ثقته بنفسه', 'لضعف ثقته بنفسه', 'لِظَعْف ثِقَته بِنَفْسَه'] },

  /* ═══ الجولة التاسعة (٢١ أغسطس ٢٠٢٦ ليلاً) — ملاحظات حلقة القطع عند
     الجسر (تشغيلة 32504080695). ستٌّ جديدة، وبدائلها مسنودة بالبحث الذي
     أمر به («ابحث عن لهجة مدينة الكويت العامية»): الهمزة نادرة في
     الكويتية ولا تبقى إلا في المستعار من الفصحى — فـ«اسأله» بهمزتها
     تجرّ المحرّك للفصحى، وبديلها الحضري «إسِله». و«عقب» هي الكويتية
     الأصيلة لـ«بعدين»، و«شُغُل» بضمّتين هي بنية الخليجية. */

  /* دور ٢ (فهد) — «طلع منه» قالها غلط. «فتك منه» كويتية أصيلة بمعنى
     خلص/نجا وتناسب المحشور الذي انفكّ. */
  { key: 'طلع منه', speaker: 'Fahad',
    carrier: 'بس راحة مؤقتة… مثل واحد كان محشور بباب ظيّج و{W}.',
    options: ['طلع منه', 'طِلَع مِنّه', 'فتك منه'] },

  /* دور ١٩ (نورة) — «بعدين» قالتها غلط. «عقب» هي الكويتية الأم. */
  { key: 'بعدين', speaker: 'Noura',
    carrier: 'لما الواحد يربط قيمته بروحه بدرجاته، هالشي يجره {W} لظعف ثقته بنفسه.',
    options: ['بعدين', 'بَعْدين', 'عقب'] },

  /* دور ٢٠ (فهد) — «شغل» سمعها سورية. الكلمة مرتين في الجملة و{W}
     يستبدلهما معاً (replaceAll). «شُغُل» بضمتين بنية خليجية موثقة. */
  { key: 'شغل', speaker: 'Fahad',
    carrier: 'ويي معاه ظغط أكبر، وقلق امتحان، ودافعية كلها {W} دفع وخوف مو {W} رغبة.',
    options: ['شغل', 'شُغُل', 'شغلة'] },

  /* دور ٣٠ (فهد) — «صج» في أول الجملة سمعها إماراتية أو عمانية.
     وهي أخصّ كلمة كويتية في الحلقة كلها — لا بديل لها، فالخياران
     الآخران تشكيلان يضيّقان على المحرّك. */
  { key: 'صج', speaker: 'Fahad',
    carrier: '{W} طلعوا من التجربة أگرب لنفسهم… ولا طلعوا وهم خايفين؟',
    options: ['صج', 'صِج', 'صِجّ'] },

  /* دورا ٣٢ و٣٣ — «اسأله» قالها غلط مرتين (فهد ثم نورة). الهمزة وسط
     الكلمة تستدعي الفصحى؛ والحضري يسقطها: «إسِله». */
  { key: 'اسأله — فهد', speaker: 'Fahad',
    carrier: 'مو بس: جم يبت؟ {W}: شنو تعلمت عن نفسك؟',
    options: ['اسأله', 'إسِله', 'سِله'] },
  /* المخاطَب في الجملتين هو الأب — أمرٌ مذكّرٌ من الاثنين، فلا صيغة مؤنثة. */
  { key: 'اسأله — نورة', speaker: 'Noura',
    carrier: 'ومو: منو غلب؟ {W}: انت اليوم أنظج شوي من نفسك أمس؟',
    options: ['اسأله', 'إسِله', 'سِله'] },
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
      /* replaceAll لا replace: جملة «كلها شغل دفع مو شغل رغبة» فيها الكلمة
         مرتين، وreplace الأولى وحدها كانت ستخلط البديل بالحالة الراهنة. */
      lines.push(`${w.speaker}: ${KW} ${NUM[j]}. ${w.carrier.replaceAll('{W}', opt)}`)
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
