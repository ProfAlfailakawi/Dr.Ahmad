#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const useDist = process.argv.includes('--dist')
const read = (file) => readFileSync(resolve(ROOT, file), 'utf8')
let passed = 0
let failed = 0
const check = (label, condition) => {
  if (condition) { passed += 1; console.log(`✓ ${label}`); return }
  failed += 1
  console.error(`✗ ${label}`)
}

const envProduction = existsSync(resolve(ROOT, '.env.production')) ? read('.env.production') : ''
const siteMatch = envProduction.match(/^VITE_SITE_URL=(.+)$/m)
const site = (process.env.VITE_SITE_URL || siteMatch?.[1] || 'https://dr-alfailakawi.com').trim().replace(/\/+$/, '')
const firebase = JSON.parse(read('firebase.json'))
const server = read('server.mjs')
const staticBuild = read('scripts/build-static.mjs')
const app = read('src/App.tsx')
const robotsTemplate = staticBuild.match(/writeFileSync\(resolve\(DIST, 'robots\.txt'\), `([\s\S]*?)`, 'utf8'\)/)?.[1] || ''
const redirectPairs = new Map((firebase.hosting?.redirects || []).map((item) => [item.source, item.destination]))
const retiredFiles = [
  'ROOT-CAUSES-AND-FILES.txt',
  'docs/MIGRATION.md',
  'reports/legacy-links-report.json',
  'reports/legacy-links-report.md',
  'reports/legacy-links.json',
  'scripts/audit-legacy-links.mjs',
  'scripts/verify-legacy-retirement.mjs',
  'src/pages/Legacy.tsx',
]

console.log(`\nSearch Console readiness — ${site}`)
check('النطاق المركزي HTTPS صحيح', /^https:\/\/dr-alfailakawi\.com$/i.test(site))
check('المسارات العامة الحالية لا تستورد صفحة WordPress القديمة', !/from ['"].*Legacy|<Legacy\b/.test(app))
check('المعادِل الحقيقي للكتب القديمة يملك 301 إلى /publications', redirectPairs.get('/ar/published-books-2') === '/publications')
check('الصفحات القديمة ذات البديل الحقيقي تملك 301 صريحاً', redirectPairs.get('/ar/home-2') === '/' && redirectPairs.get('/en/home') === '/en' && redirectPairs.get('/academic-biography-2') === '/cv' && redirectPairs.get('/scholarly-contributions-2') === '/research')
check('الخادم يمنع /ar القديمة من السقوط إلى SPA بصفحة 200', server.includes('retiredLegacyPathPatterns') && server.includes("/^\\/ar(?:\\/|$)/i") && server.includes("sendText(res, 410, 'Gone'"))
check('الخادم يتقاعد صفحات WordPress المفهرسة بلا بديل بدلاً من soft-404', server.includes('retiredLegacyExactPaths') && server.includes("'/mini-library'") && server.includes("'/en/reading-room'") && server.includes('category|tag|author'))
check('الخادم لا يحوّل كل صفحات WordPress القديمة إلى الرئيسية', !/legacyEquivalentRedirects[\s\S]{0,2000}\['\/ar\/',\s*'\/'\]/.test(server))
check('robots لا يحظر /ar القديمة؛ Google يستطيع رؤية 404/410', !/Disallow:\s*\/ar(?:\/|\s|$)/i.test(robotsTemplate))
check('robots يعلن sitemap على النطاق المركزي', staticBuild.includes('Sitemap: ${SITE}/sitemap.xml'))
check('sitemap يحظر إدراج /ar وبقايا WordPress', staticBuild.includes("'/ar/'") && staticBuild.includes("'/signature_articles/'") && staticBuild.includes("'/published_articles/'") && staticBuild.includes("'/category/'") && staticBuild.includes("'/mini-library'"))
check('صفحات SEO الثابتة تدعم Google verification من بيئة البناء', staticBuild.includes('VITE_GOOGLE_SITE_VERIFICATION') || staticBuild.includes('GOOGLE_SITE_VERIFICATION'))
check('canonical يُكتب لكل صفحة ثابتة', staticBuild.includes('rel="canonical"') && staticBuild.includes('canonical'))

if (useDist) {
  console.log('\nBuilt output')
  const dist = resolve(ROOT, 'dist')
  check('dist موجود بعد البناء', existsSync(dist))
  if (existsSync(dist)) {
    const sitemapPath = resolve(dist, 'sitemap.xml')
    const robotsPath = resolve(dist, 'robots.txt')
    check('sitemap.xml مولّد', existsSync(sitemapPath))
    check('robots.txt مولّد', existsSync(robotsPath))
    if (existsSync(sitemapPath)) {
      const sitemap = readFileSync(sitemapPath, 'utf8')
      check('sitemap لا يحتوي /ar القديمة', !/https?:\/\/[^<]+\/ar\//i.test(sitemap))
      check('sitemap لا يحتوي مسارات WordPress المتقاعدة', !/(?:signature_articles|published_articles|scholarly_contributi|\/wp-)/i.test(sitemap))
      check('كل loc يستخدم النطاق canonical', [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].every((match) => match[1].startsWith(`${site}/`) || match[1] === site))
    }
    if (existsSync(robotsPath)) {
      const robots = readFileSync(robotsPath, 'utf8')
      check('robots في dist يعلن sitemap الصحيح', robots.includes(`Sitemap: ${site}/sitemap.xml`))
      check('robots في dist لا يمنع مسارات WordPress المتقاعدة', !/Disallow:\s*\/(?:ar|signature_articles|published_articles|scholarly_contributi)(?:\/|\s|$)/i.test(robots))
    }
    check('تنظيف البناء حذف ملفات خطة WordPress المتقادمة', retiredFiles.every((file) => !existsSync(resolve(ROOT, file))))
  }
}

console.log(`\nالنتيجة: ${passed} ناجحاً، ${failed} إخفاقاً.`)
if (failed) process.exit(1)
