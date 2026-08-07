#!/usr/bin/env node
/**
 * يحذف ملفات الصوت اليتيمة قبل البناء.
 *
 * السبب: قد تُرفع ملفات MP3 قديمة إلى audio/ باسم slug لم يعد موجوداً،
 * فيوقف sync-audio/build النشر حمايةً للـRSS والبودكاست. هذا السكربت
 * يزيل فقط الملفات التي لا تطابق أي مقال ذي نص كامل، ولا يمس ملفات
 * الحوار البودكاستي أو الملفات المطابقة لمقالات حقيقية.
 */
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_DIR = resolve(ROOT, 'audio')
const BODIES = resolve(ROOT, 'src/data/bodies.json')
const AUDIO_META = resolve(ROOT, 'src/data/audio-meta.json')

if (!existsSync(AUDIO_DIR) || !existsSync(BODIES)) {
  process.exit(0)
}

const knownSlugs = new Set(Object.keys(JSON.parse(readFileSync(BODIES, 'utf8'))))
const removed = []
const removedMeta = []

for (const name of readdirSync(AUDIO_DIR).filter((item) => item.endsWith('.mp3')).sort()) {
  if (name.includes('.dialogue')) continue
  const slug = name.endsWith('.noura.mp3')
    ? name.slice(0, -'.noura.mp3'.length)
    : name.slice(0, -'.mp3'.length)

  if (!knownSlugs.has(slug)) {
    unlinkSync(resolve(AUDIO_DIR, name))
    removed.push(name)
  }
}

if (removed.length) {
  console.log(`✔ حُذفت ${removed.length} ملفات صوت يتيمة قبل البناء:`)
  for (const name of removed) console.log(`  - ${name}`)
} else {
  console.log('✔ لا توجد ملفات صوت يتيمة.')
}

function slugFromAudioMetaName(name) {
  if (name.endsWith('.dialogue-en.mp3')) return name.slice(0, -'.dialogue-en.mp3'.length)
  if (name.endsWith('.dialogue.mp3')) return name.slice(0, -'.dialogue.mp3'.length)
  if (name.endsWith('.dialogue.json')) return name.slice(0, -'.dialogue.json'.length)
  if (name.endsWith('.noura.mp3')) return name.slice(0, -'.noura.mp3'.length)
  if (name.endsWith('.mp3')) return name.slice(0, -'.mp3'.length)
  return null
}

if (existsSync(AUDIO_META)) {
  const meta = JSON.parse(readFileSync(AUDIO_META, 'utf8'))
  const nextMeta = {}
  for (const [name, info] of Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))) {
    const slug = slugFromAudioMetaName(name)
    if (slug && !knownSlugs.has(slug)) {
      removedMeta.push(name)
      continue
    }
    nextMeta[name] = info
  }

  if (removedMeta.length) {
    const temp = `${AUDIO_META}.tmp-${process.pid}`
    writeFileSync(temp, `${JSON.stringify(nextMeta, null, 2)}\n`, 'utf8')
    renameSync(temp, AUDIO_META)
    console.log(`✔ نُظّفت ${removedMeta.length} مداخل صوت يتيمة من audio-meta.json:`)
    /* «يتيم» كلمةٌ تُخفي حالتين مختلفتين: ملفٌّ لمقالٍ حُذف (فحذفه صواب)،
       وحلقةٌ كاملةٌ مكتوبةٌ ينتظر مقالها النشر (فحذفها صامتاً يُضيعها بلا
       أن يعرف أحد). الثانية تُسمّى بسببها هنا كي لا تُبتلع مرّةً أخرى. */
    const soulDir = resolve(ROOT, 'manual-dialogues-soul')
    for (const name of removedMeta) {
      const slug = slugFromAudioMetaName(name)
      const hasDialogue = slug && existsSync(resolve(soulDir, `${slug}.soul.json`))
      console.log(hasDialogue
        ? `  - ${name} ← حوارٌ مكتوبٌ ينتظر نشر مقاله، لا ملفٌّ زائد`
        : `  - ${name}`)
    }
  } else {
    console.log('✔ لا توجد مداخل صوت يتيمة في audio-meta.json.')
  }
}
