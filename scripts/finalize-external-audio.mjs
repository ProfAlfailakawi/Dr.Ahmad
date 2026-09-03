#!/usr/bin/env node
/**
 * يجهّز حذف ملفات الصوت من Git بعد نجاح R2.
 *
 * هذا السكربت لا يحذف ملفات الصوت من جهازك. يستخدم git rm --cached
 * حتى تبقى نسخة العمل المحلية موجودة كنسخة أمان، لكن تختفي من GitHub
 * بعد الـCommit التالي.
 *
 * الاستخدام الآمن:
 *   AUDIO_PUBLIC_BASE_URL=https://audio.example.com npm run audio:external:verify
 *   AUDIO_PUBLIC_BASE_URL=https://audio.example.com npm run audio:external:finalize -- --apply
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

try { process.loadEnvFile(resolve(process.cwd(), '.env')) } catch { /* .env اختياري */ }

const apply = process.argv.includes('--apply')
const base = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
if (!base || /YOUR-R2-PUBLIC-DOMAIN|audio\.example\.com/.test(base)) {
  console.error('✘ لا يمكن حذف الصوت من Git قبل ضبط AUDIO_PUBLIC_BASE_URL برابط حقيقي.')
  process.exit(1)
}

const verify = spawnSync(process.execPath, [resolve(process.cwd(), 'scripts/verify-external-audio.mjs')], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})
if (verify.status !== 0) process.exit(verify.status || 1)

if (!apply) {
  console.log('')
  console.log('جاهز للحذف من Git، لكن لم أطبّق شيئاً.')
  console.log('للتطبيق:')
  console.log(`AUDIO_PUBLIC_BASE_URL=${base} npm run audio:external:finalize -- --apply`)
  process.exit(0)
}

const rm = spawnSync('git', ['rm', '-r', '--cached', '--ignore-unmatch', 'audio'], {
  cwd: process.cwd(),
  stdio: 'inherit',
})
if (rm.status !== 0) process.exit(rm.status || 1)

mkdirSync(resolve(process.cwd(), 'audio'), { recursive: true })
writeFileSync(resolve(process.cwd(), 'audio/.gitkeep'), '')

const add = spawnSync('git', ['add', 'audio/.gitkeep', '.gitignore', 'src/data/audio-meta.json'], {
  cwd: process.cwd(),
  stdio: 'inherit',
})
if (add.status !== 0) process.exit(add.status || 1)

console.log('✔ تم تجهيز حذف الصوت من Git فقط. الملفات المحلية باقية.')
console.log('الخطوة التالية:')
console.log('git commit -m "chore: move audio assets to external hosting" && git push')
