#!/usr/bin/env node
/**
 * مختبر اسم العائلة — جولةٌ قصيرة لأذن الدكتور وحدها.
 *
 * العلّة (٢٩ أغسطس ٢٠٢٦، مقيسة لا مظنونة): في التشغيلة ٧٠ رُفضت الحلقة
 * الثانية على **ست بذورٍ من ست**، كلها للسبب نفسه — خرج الاسم «فيلكاوي».
 * والحلقتان اللتان مرّتا لم يتحقق فيهما الاسم أصلاً؛ قال الشاهد «ما التقطه
 * ASR في موضعه — لا حكم». فلا حلقة واحدة حتى الآن ثبت أن الاسم خرج فيها
 * صحيحاً. ومعدّلٌ كهذا لا يُهرب منه بإعادةٍ ببذرةٍ ثانية.
 *
 * والتفسير الأرجح هو درس «شُغُل» نفسه: «الفيلتشاوي» اختارها الدكتور سماعاً
 * في ١٥ أغسطس، لكن **في عينة معزولة**. والعينة المعزولة تخطئ في الاتجاهين
 * (isolatedSampleVsFullEpisode في المعجم): تنجح وحدها وتسقط داخل الحلقة.
 *
 * فهذي الجولة تُسمعه الاسم **في جملة الإحالة الحقيقية** التي تُقال في آخر
 * كل حلقة، بصوت نورة نفسها التي تقولها، وفي أخذٍ واحدٍ متصل كي تكون
 * المقارنة عادلة: نفس الحنجرة ونفس الإيقاع، ولا يتغيّر إلا الإملاء.
 *
 * المرشّحون كلهم طرقُ كتابةٍ للصوت نفسه — لا كلمة مخترعة ولا اسم جديد.
 * والسادس ضبطٌ مرجعي: إن خرج مثل الأول، فالمحرّك يتجاهل «تش» من أصلها،
 * والعلاج عندئذٍ ليس إملاءً آخر.
 *
 * هذا المختبر **لا يمسّ المعجم**. يُخرج صوتاً ودفتراً مرقّماً؛ والحكم بأذنه
 * وحده، ثم يُدوَّن في heardByEar بتاريخه ونصّ كلامه.
 *
 *   node scripts/podcast-kuwaiti-name-lab.mjs --self-test
 *   node scripts/podcast-kuwaiti-name-lab.mjs        # يحتاج GEMINI_API_KEY
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
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-preview-tts'
const KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
const FFMPEG = process.env.FFMPEG_BIN || 'ffmpeg'
const MALE = process.env.PODCAST_KW_MALE_VOICE || 'Puck'
const FEMALE = process.env.PODCAST_KW_FEMALE_VOICE || 'Zephyr'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* جملة الإحالة كما هي في المتون الـ١٤٣، بصوت نورة كما في الإنتاج. */
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
These lines differ only in the spelling of one family name, and that is the whole point of the screening: read each spelling exactly as written. Never normalize one spelling to another, never make two of them sound the same on purpose, and never repair a spelling you find unusual.`
const TAIL = 'Silently count the test lines, then read all of them in order. Speak only the labelled lines.'

const NUM = ['واحد', 'اثنين', 'ثلاثة', 'أربعة', 'خمسة', 'ستة']

export function buildNameLabLines (candidates = CANDIDATES, carrier = CARRIER) {
  const lines = ['Fahad: هذي جولة اسم العائلة. ستة خيارات، وكلها نفس الجملة.']
  candidates.forEach((item, index) => {
    lines.push(`Noura: خيار ${NUM[index]}. ${carrier.replace('{W}', item.spelling)}`)
  })
  return lines.join('\n')
}

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

function selfTest () {
  assert.equal(CANDIDATES.length, 6, 'ستة مرشحين لا أكثر — الجولة قصيرة عمداً')
  assert.equal(new Set(CANDIDATES.map((c) => c.spelling)).size, 6, 'لا تكرار في الإملاءات')
  assert.ok(CANDIDATES.some((c) => c.spelling === 'الفيلتشاوي'), 'المعتمد اليوم حاضرٌ للمقارنة')
  assert.ok(CANDIDATES.some((c) => c.spelling === 'الفيلكاوي'), 'الضبط المرجعي حاضر')
  const lines = buildNameLabLines()
  assert.equal(lines.split('\n').length, 7, 'سطر تمهيد وستة خيارات')
  assert.equal(lines.split('\n').filter((l) => l.startsWith('Noura:')).length, 6,
    'الاسم يُقال بصوت نورة كما في الإنتاج، لا بصوتٍ آخر')
  for (const c of CANDIDATES) {
    assert.ok(lines.includes(`أحمد حسين ${c.spelling}.`),
      `${c.spelling}: يُسمع داخل جملة الإحالة الحقيقية لا معزولاً — درس «شُغُل»`)
  }
  assert.doesNotMatch(lines, /اختبار رقم/u, 'لا رقم عارٍ قبل الجملة يكسر السياق')
  console.log(`✓ مختبر الاسم: ${CANDIDATES.length} إملاءات · كلها داخل جملة الإحالة · بصوت نورة`)
}

async function main () {
  if (process.argv.includes('--self-test')) return selfTest()
  if (!KEY) throw new Error('GEMINI_API_KEY مفقود')
  rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true })
  mkdirSync(dirname(OUT), { recursive: true })
  console.log(`🎙️ جولة الاسم: ${CANDIDATES.length} إملاءات في أخذٍ واحد متصل`)
  const pcm = await generate(buildNameLabLines())
  const wav = resolve(TMP, 'name-lab.wav')
  writeFileSync(wav, Buffer.concat([wavHeader(pcm.length), pcm]))
  const run = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
    '-af', 'loudnorm=I=-16:TP=-1.5', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', OUT], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error(run.stderr || 'فشل ترميز جولة الاسم')
  writeFileSync(LEGEND, JSON.stringify({
    note: 'جولة اسم العائلة. الحكم بأذن الدكتور وحده؛ لا يدخل المعجم شيءٌ قبل أن يسمعه ويختاره.',
    generatedAt: new Date().toISOString(), model: MODEL, voices: { male: MALE, female: FEMALE },
    carrier: CARRIER,
    candidates: CANDIDATES.map((c, i) => ({ number: i + 1, ...c })),
  }, null, 2) + '\n')
  console.log(`✓ جاهزة: ${OUT}`)
  CANDIDATES.forEach((c, i) => console.log(`   ${i + 1}. ${c.spelling} — ${c.note}`))
}

main().catch((error) => { console.error('✗', error.message); process.exit(1) })
