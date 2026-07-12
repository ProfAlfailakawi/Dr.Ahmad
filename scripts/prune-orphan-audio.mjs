#!/usr/bin/env node
/**
 * يحذف ملفات الصوت اليتيمة قبل البناء.
 *
 * السبب: قد تُرفع ملفات MP3 قديمة إلى audio/ باسم slug لم يعد موجوداً،
 * فيوقف sync-audio/build النشر حمايةً للـRSS والبودكاست. هذا السكربت
 * يزيل فقط الملفات التي لا تطابق أي مقال ذي نص كامل، ولا يمس ملفات
 * الحوار البودكاستي أو الملفات المطابقة لمقالات حقيقية.
 */
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_DIR = resolve(ROOT, 'audio')
const BODIES = resolve(ROOT, 'src/data/bodies.json')

if (!existsSync(AUDIO_DIR) || !existsSync(BODIES)) {
  process.exit(0)
}

const knownSlugs = new Set(Object.keys(JSON.parse(readFileSync(BODIES, 'utf8'))))
const removed = []

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
