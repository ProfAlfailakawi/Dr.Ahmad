#!/usr/bin/env node
/**
 * يعيد بناء سجل اعتماد الحوارات الفصحى (.podcast-state.json) من مصدر الثقة
 * نفسه الذي يفحصه build-static: audio-meta.json.
 *
 * العلّة التي أنتجت هذا السكربت (١٦ أغسطس ٢٠٢٦): سجل الاعتماد
 * .podcast-state.json مُستبعَدٌ من المستودع في .gitignore، ولا تستعيده
 * تشغيلة النشر من أيّ مصدر. فحين يُبنى الموقع في GitHub لا يكون الملف
 * موجوداً أصلاً، فتسقط بوابةُ acceptedArabicDialogue كلَّ الحوارات إلى
 * القراءة المفردة — بلا استثناء. النتيجة: الخلاصة (podcast.xml) تخدم
 * القراءة المفردة على كل المنصات (Apple · Spotify · Deezer · Anghami ·
 * Amazon · YouTube)، رغم أن الوصف يَعِد بحوارٍ بصوتين. اعتمدها الدكتور
 * كلَّها (١٦ أغسطس) وأمر بإدخالها.
 *
 * لماذا audio-meta مصدرُ ثقةٍ كافٍ: build-static نفسه لا يقبل الحوار إلا
 * إذا طابقت بصمةُ audioMeta بصمةَ الاعتماد وتجاوز حجمُه ٢٠٠ ك.ب. فبناءُ
 * الاعتماد من بصمة audioMeta يجعل الشرطين يتطابقان بالبناء لا بالصدفة —
 * الاعتماد يشهد بالضبط على ما هو موجودٌ ومتحقَّقٌ على R2. ولا يُعتمد إلا
 * حوارٌ حاضرٌ ببصمتين مكتملتين وحجمين صالحين؛ ما نقص منه يُتجاوَز ويُعلَن.
 *
 * لا يمسّ الكويتي: يكتب مفاتيح «:ar» وحدها. الحوار الكويتي بوابته منفصلة
 * (podcast_dialogues_kw + .podcast-state الكويتي) ولم يعتمده الدكتور بعد.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
const statePath = resolve(ROOT, '.podcast-state.json')
const MIN_AUDIO = 200_000
const MIN_TRANSCRIPT = 100

if (!existsSync(metaPath)) {
  console.error('✘ audio-meta.json مفقود — لا يمكن إعادة بناء الاعتماد')
  process.exit(1)
}
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))

/* لا يُدهس سجلٌّ قائم: يُدمَج فوقه، فإن كان أحدثَ (اعتمادٌ يدويٌّ حديث) بقي. */
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : {}
if (!state.done || typeof state.done !== 'object') state.done = {}

const dialogueAudio = Object.keys(meta).filter((k) => k.endsWith('.dialogue.mp3'))
let restored = 0
const skipped = []

for (const audioName of dialogueAudio) {
  const slug = audioName.replace('.dialogue.mp3', '')
  const transcriptName = `${slug}.dialogue.json`
  const audio = meta[audioName]
  const transcript = meta[transcriptName]

  const ok = audio?.sha256 && Number(audio.bytes || 0) >= MIN_AUDIO
    && transcript?.sha256 && Number(transcript.bytes || 0) > MIN_TRANSCRIPT
  if (!ok) { skipped.push(slug); continue }

  const key = `${slug}:ar`
  const existing = state.done[key]
  /* اعتمادٌ يدويٌّ سابقٌ بنفس البصمة يُترك كما هو. */
  if (existing?.status === 'accepted_automated'
      && existing.audioHash === audio.sha256
      && existing.transcriptHash === transcript.sha256) continue

  state.done[key] = {
    ...(existing || {}),
    status: 'accepted_automated',
    audioHash: audio.sha256,
    transcriptHash: transcript.sha256,
    acceptedAt: existing?.acceptedAt || new Date(0).toISOString(),
    restoredFrom: 'audio-meta',
    restoredAt: new Date(0).toISOString(),
  }
  restored += 1
}

writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
console.log(`✓ أُعيد بناء اعتماد الحوارات الفصحى: ${restored} حواراً`)
console.log(`  إجمالي الحوارات المعتمدة الآن: ${Object.keys(state.done).filter((k) => k.endsWith(':ar')).length}`)
if (skipped.length) console.log(`  ⚠️ تُجووزت ${skipped.length} (بصمةٌ أو حجمٌ ناقص): ${skipped.slice(0, 5).join(' · ')}`)

/* فحصٌ ذاتيٌّ: كل مفتاحٍ مكتوبٍ عربيٌّ لا كويتي. */
const nonArabic = Object.keys(state.done).filter((k) => !k.endsWith(':ar'))
if (process.argv.includes('--strict-ar') && nonArabic.length) {
  console.error(`✘ مفاتيح غير عربية في السجل: ${nonArabic.slice(0, 3).join(', ')}`)
  process.exit(1)
}
