#!/usr/bin/env node
/**
 * استيراد نصوص المقالات الكاملة من موقع ووردبريس إلى المشروع.
 *
 *   node scripts/import-articles.mjs
 *
 * يجرّب ثلاثة مسارات بالترتيب:
 *   1) REST API  (wp-json/wp/v2/signature_articles)
 *   2) REST بديل (?rest_route=...)
 *   3) كشط HTML لكل صفحة مقال (بطيء لكنه يعمل دائماً)
 *
 * الناتج: src/data/bodies.json  →  { "slug": "فقرة\n\nفقرة", ... }
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '..')
const OUT = resolve(ROOT, 'src/data/bodies.json')
const SITE = 'https://dr-alfailakawi.com'
const TYPE = 'signature_articles'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------- تنظيف HTML → فقرات نصّية ---------- */
function htmlToText(html) {
  if (!html) return ''
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/gi, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/* ---------- المسار ١+٢: REST ---------- */
async function viaRest() {
  const urls = [
    `${SITE}/wp-json/wp/v2/${TYPE}?per_page=100&_fields=slug,content`,
    `${SITE}/?rest_route=/wp/v2/${TYPE}&per_page=100&_fields=slug,content`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!res.ok) continue
      const json = await res.json()
      if (!Array.isArray(json) || !json.length) continue
      const out = {}
      for (const post of json) {
        const text = htmlToText(post?.content?.rendered ?? '')
        if (text) out[post.slug] = text
      }
      if (Object.keys(out).length) {
        console.log(`✔ REST نجح — ${Object.keys(out).length} مقالاً`)
        return out
      }
    } catch { /* جرّب التالي */ }
  }
  return null
}

/* ---------- المسار ٣: كشط HTML ---------- */
function slugsFromData() {
  const src = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const block = src.match(/export const articles = \[([\s\S]*?)\n\]/)
  if (!block) return []
  return [...block[1].matchAll(/slug: '([^']+)'/g)].map((m) => m[1])
}

function extractBody(html) {
  // محتوى Elementor للمقال
  const patterns = [
    /<div[^>]+elementor-widget-theme-post-content[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) {
      const text = htmlToText(m[1])
      if (text.length > 250) return text
    }
  }
  return ''
}

async function viaScrape() {
  const slugs = slugsFromData()
  console.log(`⟳ كشط ${slugs.length} صفحة…`)
  const out = {}
  for (const [i, slug] of slugs.entries()) {
    try {
      const res = await fetch(`${SITE}/${TYPE}/${slug}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (res.ok) {
        const body = extractBody(await res.text())
        if (body) out[slug] = body
      }
      process.stdout.write(`\r  ${i + 1}/${slugs.length}  ${Object.keys(out).length} ✓`)
      await sleep(400) // لطفاً بالخادم
    } catch { /* تجاوز */ }
  }
  console.log('')
  return out
}

/* ---------- التشغيل ---------- */
const bodies = (await viaRest()) ?? (await viaScrape())

if (!bodies || !Object.keys(bodies).length) {
  console.error('✘ لم يُستورد أي نص. جرّب تصدير ووردبريس (اقرأ README).')
  process.exit(1)
}

// دمج مع الموجود بدل الاستبدال
let prev = {}
if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, 'utf8')) } catch {} }
const merged = { ...prev, ...bodies }

writeFileSync(OUT, JSON.stringify(merged, null, 2), 'utf8')
console.log(`✔ حُفظ ${Object.keys(merged).length} نصاً في src/data/bodies.json`)
console.log('  شغّل: npm run dev')
