#!/usr/bin/env node
/**
 * يتحقق من جاهزية استضافة الصوت الخارجية قبل حذف MP3 من Git.
 *
 * الاستخدام:
 *   AUDIO_PUBLIC_BASE_URL=https://audio.example.com npm run audio:external:verify
 *
 * الفحص يتأكد من:
 * - وجود رابط عام ثابت.
 * - كل ملف في src/data/audio-meta.json يرجع 200/206.
 * - دعم Range Requests أو طلب Range فعلي.
 * - Content-Length مطابق قدر الإمكان.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try { process.loadEnvFile(resolve(process.cwd(), '.env')) } catch { /* .env اختياري */ }

const base = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
if (!base || /YOUR-R2-PUBLIC-DOMAIN|audio\.example\.com/.test(base)) {
  console.error('✘ AUDIO_PUBLIC_BASE_URL غير مضبوط برابط R2 عام حقيقي.')
  process.exit(1)
}

const metaPath = resolve(process.cwd(), 'src/data/audio-meta.json')
if (!existsSync(metaPath)) {
  console.error('✘ src/data/audio-meta.json غير موجود.')
  process.exit(1)
}

const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
const entries = Object.entries(meta).filter(([name]) => name.endsWith('.mp3'))
if (!entries.length) {
  console.error('✘ لا توجد ملفات MP3 في audio-meta.json.')
  process.exit(1)
}

const concurrency = Number(process.env.AUDIO_VERIFY_CONCURRENCY || 12)
const failures = []
let checked = 0

const checkOne = async ([name, info]) => {
  const url = `${base}/${encodeURIComponent(name).replace(/%2F/g, '/')}`
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    const range = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'follow',
    })
    const length = Number(head.headers.get('content-length') || 0)
    const expected = Number(info.bytes || 0)
    const acceptsRanges = /bytes/i.test(head.headers.get('accept-ranges') || '') || range.status === 206
    const okStatus = (head.status >= 200 && head.status < 300) || head.status === 405
    if (!okStatus) throw new Error(`HTTP ${head.status}`)
    if (!range.ok && range.status !== 206) throw new Error(`Range HTTP ${range.status}`)
    if (!acceptsRanges) throw new Error('لا يدعم Range Requests')
    if (expected > 0 && length > 0 && Math.abs(length - expected) > 16) {
      throw new Error(`Content-Length ${length} لا يطابق ${expected}`)
    }
    checked += 1
  } catch (error) {
    failures.push({ name, url, error: error?.message || String(error) })
  }
}

for (let i = 0; i < entries.length; i += concurrency) {
  await Promise.all(entries.slice(i, i + concurrency).map(checkOne))
  process.stdout.write(`\rفحص الصوت الخارجي: ${Math.min(i + concurrency, entries.length)}/${entries.length}`)
}
process.stdout.write('\n')

if (failures.length) {
  console.error(`✘ فشل فحص ${failures.length} ملفاً. أمثلة:`)
  for (const failure of failures.slice(0, 10)) {
    console.error(`- ${failure.name}: ${failure.error}`)
  }
  process.exit(1)
}

console.log(`✔ الصوت الخارجي جاهز: ${checked} ملفاً · ${base}`)
