#!/usr/bin/env node
/**
 * توليد ملفات صوت طبيعية لكل مقال — مرّة واحدة.
 *
 *   npm run audio
 *
 * الإعداد (في ملف .env):
 *   TTS_PROVIDER=azure                     # أو elevenlabs
 *   AZURE_SPEECH_KEY=xxxxxxxx
 *   AZURE_SPEECH_REGION=uaenorth           # أقرب منطقة للكويت
 *   TTS_VOICE=ar-KW-FahedNeural            # صوت كويتي — أو ar-KW-NouraNeural
 *
 * أو:
 *   TTS_PROVIDER=elevenlabs
 *   ELEVENLABS_API_KEY=xxxxxxxx
 *   ELEVENLABS_VOICE_ID=xxxxxxxx
 *
 * الناتج: public/audio/<slug>.mp3  +  src/data/audio.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = resolve(ROOT, 'public/audio')
const MANIFEST = resolve(ROOT, 'src/data/audio.json')

/* ---------- قراءة .env يدوياً (بلا اعتماديات) ---------- */
const env = { ...process.env }
const envFile = resolve(ROOT, '.env')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const PROVIDER = (env.TTS_PROVIDER || 'azure').toLowerCase()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/* ---------- Azure ---------- */
async function azure(text, title, voiceName) {
  const key = env.AZURE_SPEECH_KEY
  const region = env.AZURE_SPEECH_REGION || 'uaenorth'
  const voice = voiceName || env.TTS_VOICE || 'ar-KW-FahedNeural'
  if (!key) throw new Error('AZURE_SPEECH_KEY مفقود')

  // فواصل بين الفقرات + وقفة بعد العنوان = إيقاع طبيعي
  const paras = text.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('<break time="700ms"/>')
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-KW">
  <voice name="${voice}">
    <prosody rate="-4%" pitch="0%">
      ${esc(title)}<break time="900ms"/>
      ${paras}
    </prosody>
  </voice>
</speak>`

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'alfailakawi-site',
    },
    body: ssml,
  })
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return Buffer.from(await res.arrayBuffer())
}

/* ---------- ElevenLabs ---------- */
async function eleven(text, title) {
  const key = env.ELEVENLABS_API_KEY
  const voice = env.ELEVENLABS_VOICE_ID
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY أو ELEVENLABS_VOICE_ID مفقود')

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${title}.\n\n${text}`.slice(0, 4800),
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15 },
    }),
  })
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`)
  return Buffer.from(await res.arrayBuffer())
}

const synth = PROVIDER === 'elevenlabs' ? eleven : azure

/* ---------- التشغيل ---------- */
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const src = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const titles = Object.fromEntries(
  [...(src.match(/export const articles = \[([\s\S]*?)\n\]/) || ['', ''])[1]
    .matchAll(/slug: '([^']+)', title: '([^']+)'/g)].map((m) => [m[1], m[2].replace(/\\'/g, "'")])
)

const slugs = Object.keys(bodies)
mkdirSync(OUT_DIR, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}

/* صوتان كويتيان — المستخدم يختار بينهما في المشغّل.
   فهد يبقى بالاسم القديم <slug>.mp3،
   ونورة تُحفظ كـ <slug>.noura.mp3 */
const VOICES = PROVIDER === 'elevenlabs'
  ? [{ key: 'fahed', name: '', suffix: '', label: 'افتراضي' }]
  : [
      { key: 'fahed', name: 'ar-KW-FahedNeural', suffix: '', label: 'فهد' },
      { key: 'noura', name: 'ar-KW-NouraNeural', suffix: '.noura', label: 'نورة' },
    ]

console.log(`المزوّد: ${PROVIDER} · ${slugs.length} مقالاً × ${VOICES.length} صوت\n`)
let done = 0, skipped = 0, failed = 0

outer:
for (const [i, slug] of slugs.entries()) {
  // ترقية الصيغة القديمة { slug: true } → { fahed: true }
  if (manifest[slug] === true) manifest[slug] = { fahed: true }
  if (!manifest[slug] || typeof manifest[slug] !== 'object') manifest[slug] = {}

  for (const v of VOICES) {
    const file = resolve(OUT_DIR, `${slug}${v.suffix}.mp3`)
    if (existsSync(file) && statSync(file).size > 5000) {
      manifest[slug][v.key] = true
      skipped++
      continue
    }
    try {
      const buf = await synth(bodies[slug], titles[slug] || '', v.name)
      writeFileSync(file, buf)
      manifest[slug][v.key] = true
      done++
      console.log(`  ✔ ${i + 1}/${slugs.length} ${v.label}  ${(buf.length / 1024).toFixed(0)}KB  ${titles[slug]?.slice(0, 40) ?? slug}`)
      await sleep(600) // لطفاً بالخدمة
    } catch (e) {
      failed++
      console.error(`  ✘ ${slug} (${v.label}): ${e.message}`)
      if (String(e.message).includes('401') || String(e.message).includes('مفقود')) break outer
    }
  }
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8')
console.log(`\n✔ جديد ${done} · موجود ${skipped} · فشل ${failed}`)
console.log(`  الملفات في public/audio/ — شغّل npm run dev`)
