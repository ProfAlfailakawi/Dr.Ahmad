#!/usr/bin/env node
/**
 * يحوّل صور المحتوى تلقائياً إلى WebP بجانب الأصل، من دون لمس صور OG أو الشعارات.
 * يبقى الأصل موجوداً للرجوع، بينما تستخدم الواجهة نسخة WebP الأخف.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const inputs = []
const collect = (directory) => {
  const absolute = resolve(ROOT, directory)
  if (!existsSync(absolute)) return
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    const extension = extname(entry.name).toLowerCase()
    if (!['.png', '.jpg', '.jpeg'].includes(extension)) continue
    inputs.push(resolve(absolute, entry.name))
  }
}
collect('covers')
if (existsSync(resolve(ROOT, 'public/portrait.jpg'))) inputs.push(resolve(ROOT, 'public/portrait.jpg'))

let converted = 0
let skipped = 0
for (const source of inputs) {
  const target = source.replace(/\.(?:png|jpe?g)$/i, '.webp')
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(source).mtimeMs) {
    skipped += 1
    continue
  }
  await sharp(source, { failOn: 'none' })
    .rotate()
    .webp({ quality: 84, effort: 5, smartSubsample: true })
    .toFile(target)
  converted += 1
  console.log(`  WebP: ${basename(source)} → ${basename(target)}`)
}
console.log(`✔ تحسين الصور: ${converted} جديد · ${skipped} صالح مسبقاً`)
