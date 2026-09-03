#!/usr/bin/env node
/**
 * IndexNow — إشعار محركات البحث فور النشر بدل انتظار زحفها.
 *
 * اليوم: يُنشر المقال فلا تعرف به المحركات حتى تزور الموقع من نفسها،
 * وقد تتأخّر أياماً. هذا البروتوكول يقلبها: الموقع هو من يطرق الباب.
 *
 * مجاني تماماً وبلا حساب: يكفي أن يُستضاف ملفُ مفتاحٍ نصيّ في الجذر
 * (يكتبه build-static.mjs) ثم يُرسل الطلب. تدعمه Bing وYandex وNaver
 * وSeznam وYep. **وGoogle لا تدعمه** — تغطيتها عبر خريطة الموقع
 * وSearch Console. ومع ذلك يهمّ: فهرس Bing يغذّي عدة محركات إجابة
 * بالذكاء الاصطناعي، فالمقال الذي يدخله اليوم قد يُستشهد به غداً.
 *
 * لا يُرسل كل شيء في كل نشرة: الروابط الحديثة وحدها (افتراضياً 7 أيام)
 * وفق `lastmod` في خريطة الموقع. وسقف البروتوكول 10000 رابط للطلب.
 *
 * لا يُفشل النشر أبداً: خدمة خارجية متعثّرة ليست سبباً لإيقاف الموقع.
 *
 *   node scripts/indexnow-ping.mjs            # يرسل
 *   node scripts/indexnow-ping.mjs --dry-run  # يطبع ولا يرسل
 *   node scripts/indexnow-ping.mjs --self-test
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')

/** المفتاح علنيّ بطبعه — إثباتُ الملكية أنه مستضاف على النطاق نفسه. */
export const INDEXNOW_KEY = '45035633eb883df667a7d367aeda4c7b'

const OFFICIAL_SITE = 'https://dr-alfailakawi.com'
const SITE = (process.env.VITE_SITE_URL || OFFICIAL_SITE).replace(/\/+$/, '')
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const WINDOW_DAYS = Number(process.env.INDEXNOW_WINDOW_DAYS || 7)
const MAX_URLS = 10000

export function recentUrls(sitemapXml, { days = WINDOW_DAYS, now = Date.now() } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const entries = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1])
  const fresh = []
  for (const entry of entries) {
    const loc = (entry.match(/<loc>([^<]+)<\/loc>/) || [])[1]
    const lastmod = (entry.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1]
    if (!loc || !lastmod) continue
    const stamp = Date.parse(lastmod)
    if (Number.isNaN(stamp) || stamp < cutoff) continue
    fresh.push(loc)
  }
  return fresh.slice(0, MAX_URLS)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const sitemapPath = resolve(DIST, 'sitemap.xml')
  if (!existsSync(sitemapPath)) {
    console.log('IndexNow: لا خريطة موقع في dist — تُبنى أولاً. تخطٍّ بلا خطأ.')
    return
  }

  /* `--all` للمرة الأولى وحدها: يعرّف المحركات بالأرشيف كلّه دفعةً.
     بعدها تكفي النافذة، فإرسال كل شيء في كل نشرة ضجيجٌ بلا فائدة. */
  const sitemap = readFileSync(sitemapPath, 'utf8')
  const all = process.argv.includes('--all')
  const urls = all
    ? [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, MAX_URLS)
    : recentUrls(sitemap)

  if (!urls.length) {
    console.log(`IndexNow: لا رابط تغيّر خلال ${WINDOW_DAYS} أيام — لا شيء يُرسل.`)
    return
  }

  const host = new URL(SITE).hostname
  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  }

  if (dryRun) {
    console.log(`IndexNow (تجربة): ${urls.length} رابطاً إلى ${host}`)
    urls.slice(0, 8).forEach((u) => console.log('  ' + u))
    if (urls.length > 8) console.log(`  … و${urls.length - 8} غيرها`)
    return
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    })
    /* 200 قُبل · 202 قُبل والمفتاح قيد التحقّق — كلاهما نجاح. */
    if (response.ok) console.log(`IndexNow: أُرسل ${urls.length} رابطاً · ${response.status}`)
    else console.log(`::warning::IndexNow ردّ بـ${response.status} — لا يؤثّر في النشر.`)
  } catch (error) {
    console.log(`::warning::IndexNow تعذّر (${error.message}) — لا يؤثّر في النشر.`)
  }
}

function selfTest() {
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2026-08-13T00:00:00Z')
  const iso = (offset) => new Date(now - offset * day).toISOString().slice(0, 10)
  const xml = `<urlset>
    <url><loc>${SITE}/a</loc><lastmod>${iso(1)}</lastmod></url>
    <url><loc>${SITE}/b</loc><lastmod>${iso(30)}</lastmod></url>
    <url><loc>${SITE}/c</loc></url>
    <url><loc>${SITE}/d</loc><lastmod>${iso(6)}</lastmod></url>
  </urlset>`
  const out = recentUrls(xml, { days: 7, now })

  const checks = [
    ['الحديث يُرسل', out.includes(`${SITE}/a`)],
    ['القديم لا يُرسل', !out.includes(`${SITE}/b`)],
    ['ما لا تاريخ له لا يُرسل', !out.includes(`${SITE}/c`)],
    ['حدّ النافذة محسوب بدقّة', out.includes(`${SITE}/d`)],
    ['المفتاح ست عشري وطوله مقبول', /^[0-9a-f]{8,128}$/.test(INDEXNOW_KEY)],
    ['العدد الصحيح', out.length === 2],
  ]
  let failed = 0
  for (const [label, ok] of checks) {
    console.log(`${ok ? '✓' : '✘'} ${label}`)
    if (!ok) failed += 1
  }
  if (failed) {
    console.error(`\nIndexNow: ${failed} إخفاقاً.`)
    process.exit(1)
  }
  console.log('\nIndexNow: الفحص الذاتي سليم.')
}

/* ★ build-static.mjs يستورد INDEXNOW_KEY من هنا. فلولا هذا الحارس
   لأرسل كلُّ بناءٍ طلباً إلى الخدمة بمجرّد الاستيراد. لا يعمل إلا
   إذا شُغّل هذا الملف بنفسه. */
const runDirectly = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url

if (runDirectly) {
  if (process.argv.includes('--self-test')) selfTest()
  else await main()
}
