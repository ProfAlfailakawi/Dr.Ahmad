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

/* رفّ الكتب يعرض تسعة أغلفة في مربعات صغيرة، وكان ينزّل كلاً منها بعرض ١٠٢٤ بكسل
   (نحو سبعمئة كيلوبايت لصفحةٍ واحدة). فنولّد درجتين أضيق بجانب الأصل ونصف الدرجات
   في srcset، فيختار المتصفح أصغر نسخةٍ تكفي شاشته: الصورة نفسها، والحدّة نفسها،
   ولا ينزل عن حاجته أبداً — فالنسخة الكاملة تبقى للشاشات التي تطلبها. */
const VARIANT_WIDTHS = [480, 768]

let converted = 0
let skipped = 0
for (const source of inputs) {
  const target = source.replace(/\.(?:png|jpe?g)$/i, '.webp')
  /* الدرجات الأضيق للأغلفة وحدها: البورتريه صورة الواجهة الكبرى، ولها في index.html
     تحميلٌ مبكّر بمسارٍ واحد، فلا نضيف لها مقاساتٍ تفترق عنه. */
  const variants = source.includes('/covers/')
    ? VARIANT_WIDTHS.map((width) => [width, source.replace(/\.(?:png|jpe?g)$/i, `-${width}w.webp`)])
    : []
  const fresh = (file) => existsSync(file) && statSync(file).mtimeMs >= statSync(source).mtimeMs
  if (fresh(target) && variants.every(([, file]) => fresh(file))) {
    skipped += 1
    continue
  }
  if (!fresh(target)) {
    await sharp(source, { failOn: 'none' })
      .rotate()
      .webp({ quality: 84, effort: 5, smartSubsample: true })
      .toFile(target)
    console.log(`  WebP: ${basename(source)} → ${basename(target)}`)
  }
  const metadata = variants.every(([, file]) => fresh(file)) ? null : await sharp(source).metadata()
  for (const [width, file] of variants) {
    if (fresh(file)) continue
    /* الصورة الأضيق من الحد أصلاً تُنسخ كما هي فلا نكبّرها. */
    await sharp(source, { failOn: 'none' })
      .rotate()
      .resize(metadata?.width && metadata.width > width ? { width } : {})
      .webp({ quality: 82, effort: 5, smartSubsample: true })
      .toFile(file)
    console.log(`  WebP ${width}w: ${basename(source)} → ${basename(file)}`)
  }
  converted += 1
}
console.log(`✔ تحسين الصور: ${converted} جديد · ${skipped} صالح مسبقاً`)
