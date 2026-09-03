#!/usr/bin/env node
/**
 * خطة نقل الصوت إلى Cloudflare R2 بدون كسر الموقع.
 *
 * لا يرفع ولا يحذف افتراضياً. يعطي جرداً دقيقاً، وروابط متوقعة، وأمر رفع آمن.
 * بعد رفع الملفات إلى R2 اضبط:
 *   AUDIO_PUBLIC_BASE_URL=https://audio.example.com
 *   VITE_AUDIO_BASE_URL=https://audio.example.com
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const OUT = resolve(ROOT, '.audio-r2-plan.json')
const publicBase = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || 'https://YOUR-R2-PUBLIC-DOMAIN').replace(/\/+$/, '')

if (!existsSync(AUDIO)) {
  console.error('✘ مجلد audio غير موجود.')
  process.exit(1)
}

const files = readdirSync(AUDIO)
  .filter((name) => /\.(mp3|json)$/i.test(name))
  .sort()
  .map((name) => {
    const file = resolve(AUDIO, name)
    const bytes = statSync(file).size
    const data = createHash('sha256').update(readFileSync(file)).digest('hex')
    return { name, bytes, sha256: data, url: `${publicBase}/${name}` }
  })

const total = files.reduce((sum, file) => sum + file.bytes, 0)
const mp3 = files.filter((file) => file.name.endsWith('.mp3'))
const dialogue = files.filter((file) => file.name.includes('.dialogue.'))

writeFileSync(OUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), publicBase, totalBytes: total, files }, null, 2)}\n`, 'utf8')

console.log('خطة نقل الصوت إلى R2')
console.log(`- الملفات: ${files.length} (${mp3.length} MP3 · ${dialogue.length} ملفات حوار/Transcript)`)
console.log(`- الحجم الحالي: ${(total / 1024 / 1024).toFixed(1)}MB`)
console.log(`- الخطة مكتوبة في: ${OUT}`)
console.log('')
console.log('بعد إنشاء R2 bucket وضبط custom/public domain، ارفع هكذا مثلاً:')
console.log('aws s3 sync audio/ s3://YOUR_BUCKET/ --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com --exclude "*" --include "*.mp3" --include "*.json"')
console.log('')
console.log('ثم ابنِ الموقع بهذه المتغيرات:')
console.log(`AUDIO_PUBLIC_BASE_URL=${publicBase} VITE_AUDIO_BASE_URL=${publicBase} npm run build`)
