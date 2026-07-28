#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const git = (args) => spawnSync('git', args, { encoding: 'utf8' })

const inside = git(['rev-parse', '--is-inside-work-tree'])
if (inside.status !== 0 || inside.stdout.trim() !== 'true') {
  console.log('حارس الصوت: لا يوجد Git هنا؛ تم التخطي.')
  process.exit(0)
}

const tracked = git(['ls-files'])
if (tracked.status !== 0) {
  console.error('✘ تعذر فحص ملفات Git المتتبعة.')
  process.exit(1)
}

const forbidden = tracked.stdout
  .split('\n')
  .map((item) => item.trim())
  .filter(Boolean)
  .filter((file) => {
    if (/^music\/.+\.mp3$/i.test(file)) return false
    return /\.mp3$/i.test(file)
      || /^audio\/.+\.(dialogue\.json|json)$/i.test(file)
      || /^public\/audio\/.+\.(mp3|json)$/i.test(file)
      || /^dist\/audio\/.+\.(mp3|json)$/i.test(file)
  })

if (forbidden.length) {
  console.error('✘ حارس الصوت أوقف العملية: يوجد صوت مولّد داخل Git.')
  console.error('انقل الصوت إلى R2 ولا تلتزم إلا بملفات البيانات الخفيفة مثل audio-meta/audio.json.')
  for (const file of forbidden.slice(0, 30)) console.error(`- ${file}`)
  if (forbidden.length > 30) console.error(`… و${forbidden.length - 30} ملفاً إضافياً`)
  process.exit(1)
}

console.log('✓ حارس الصوت: لا توجد ملفات صوت مولّدة داخل Git.')
