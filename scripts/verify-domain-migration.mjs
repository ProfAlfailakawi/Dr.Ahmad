#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST_ONLY = process.argv.includes('--dist')
const OFFICIAL = 'https://dr-alfailakawi.com'
const OFFICIAL_HOST = 'dr-alfailakawi.com'
const HOSTING_PROJECT = 'gen-lang-client-0200723670'
const HOSTING_SITE = 'dr-alfailakawi'
const DATA_PROJECT = 'drahmad-8e9e2'
const DATA_BUCKET = 'drahmad-8e9e2.firebasestorage.app'

const errors = []
const notes = []
const fail = (message) => errors.push(message)
const note = (message) => notes.push(message)
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')
const json = (path) => JSON.parse(read(path))

function expect(condition, message) {
  if (!condition) fail(message)
}

function walk(base) {
  const result = []
  if (!existsSync(base)) return result
  for (const name of readdirSync(base)) {
    if (name === '.git' || name === 'node_modules') continue
    const path = resolve(base, name)
    const info = statSync(path)
    if (info.isDirectory()) result.push(...walk(path))
    else result.push(path)
  }
  return result
}

function isTextFile(path) {
  return /\.(?:html?|mjs|cjs|js|jsx|ts|tsx|json|xml|txt|md|yml|yaml|css|webmanifest|rules)$/i.test(path)
    || /(?:^|\/)(?:\.env(?:\.[^/]+)?|_redirects|robots\.txt)$/i.test(path)
}

function stripCanonicalRedirect(html) {
  return html.replace(/<script id="canonical-host-redirect">[\s\S]*?<\/script>/gi, '')
}

function stripBootLegacyRedirect(js, rel) {
  if (rel !== 'dist/boot.js') return js

  // public/boot.js is the one sanctioned place where legacy hosts must remain:
  // they are inputs to the earliest possible redirect into the canonical host.
  // Validate the redirect shape first, then remove only those literal host keys
  // from the scan so any legacy hostname elsewhere in boot.js still fails.
  const expected = [
    "var canonicalHost = 'dr-alfailakawi.com';",
    "'www.dr-alfailakawi.com': true",
    "'dr-alfailakawi.web.app': true",
    "'dr-alfailakawi.firebaseapp.com': true",
    "window.location.replace('https://' + canonicalHost + window.location.pathname + window.location.search + window.location.hash);",
  ]
  for (const token of expected) {
    expect(js.includes(token), `${rel}: كود التحويل المبكر للدومين ناقص أو تغيّر`)
  }

  return js
    .replace("'www.dr-alfailakawi.com': true", "'__legacy_www__': true")
    .replace("'dr-alfailakawi.web.app': true", "'__legacy_webapp__': true")
    .replace("'dr-alfailakawi.firebaseapp.com': true", "'__legacy_firebaseapp__': true")
}

function isOfficialUrl(value) {
  try {
    const parsed = new URL(String(value))
    return parsed.protocol === 'https:' && parsed.origin === OFFICIAL
  } catch {
    return false
  }
}

function isTrustedVideoAsset(value, key) {
  try {
    const parsed = new URL(String(value))
    if (parsed.protocol !== 'https:') return false
    if (key === 'contentUrl') return ['www.youtube.com', 'youtube.com', 'youtu.be'].includes(parsed.hostname)
    if (key === 'embedUrl') return parsed.hostname === 'www.youtube-nocookie.com'
    if (key === 'thumbnailUrl' || key === 'image') return parsed.hostname === 'i.ytimg.com'
    return false
  } catch {
    return false
  }
}

function checkJsonLdUrls(value, rel, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => checkJsonLdUrls(entry, rel, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  const protectedKeys = new Set(['url', 'mainEntityOfPage', 'image', 'logo', 'contentUrl', 'thumbnailUrl', 'embedUrl'])
  const isVideoObject = value['@type'] === 'VideoObject'
  for (const [key, entry] of Object.entries(value)) {
    const child = `${path}.${key}`
    if (protectedKeys.has(key)) {
      const candidates = typeof entry === 'string'
        ? [entry]
        : entry && typeof entry === 'object' && typeof entry['@id'] === 'string'
          ? [entry['@id']]
          : []
      for (const candidate of candidates) {
        if (/^https?:\/\//i.test(candidate)) {
          const allowed = isOfficialUrl(candidate) || (isVideoObject && isTrustedVideoAsset(candidate, key))
          expect(allowed, `${rel}: Schema ${child} خارج الدومين الرسمي أو قائمة أصول الفيديو الموثوقة`)
        }
      }
    }
    checkJsonLdUrls(entry, rel, child)
  }
}

function checkRepository() {
  const production = read('.env.production')
  expect(production.includes(`VITE_SITE_URL=${OFFICIAL}`), '.env.production لا يعتمد الدومين الرسمي')
  expect(!existsSync(resolve(ROOT, 'public/sitemap.xml')), 'public/sitemap.xml نسخة ثابتة قد تتقادم؛ يجب أن يولّدها build-static فقط')
  const staticBuilder = read('scripts/build-static.mjs')
  expect(staticBuilder.includes(`const OFFICIAL_SITE = '${OFFICIAL}'`), 'مولّد sitemap/SEO لا يقفل الدومين الرسمي')
  expect(production.includes(`VITE_FIREBASE_PROJECT_ID=${DATA_PROJECT}`), '.env.production لا يعتمد مشروع البيانات الصحيح')
  expect(production.includes(`VITE_FIREBASE_STORAGE_BUCKET=${DATA_BUCKET}`), '.env.production لا يعتمد Storage الصحيح')

  const runtimeFirebase = json('firebase-applet-config.json')
  expect(runtimeFirebase.projectId === DATA_PROJECT, 'firebase-applet-config.json يشير إلى مشروع بيانات غير صحيح')
  expect(runtimeFirebase.storageBucket === DATA_BUCKET, 'firebase-applet-config.json يشير إلى Storage غير صحيح')

  const hosting = json('firebase.json')
  expect(hosting.hosting?.site === HOSTING_SITE, 'Firebase Hosting Site ID تغيّر أو غير موجود')
  expect(hosting.hosting?.public === 'dist', 'مجلد نشر Firebase Hosting ليس dist')
  expect(!hosting.firestore && !hosting.storage, 'firebase.json يجب أن يبقى للاستضافة فقط حتى لا تُنشر قواعد البيانات على مشروع الاستضافة')
  const publicRedirects = hosting.hosting?.redirects || []
  /* تحويلات الهجرة المسموحة هنا كلها exact 1:1 فقط. لا wildcard ولا regex ولا
     تحويل مجلد كامل إلى صفحة عامة؛ هذا يحرسنا من إعادة soft-404 بسبب migration. */
  const migrationPairs = [
    ['/ar', '/'], ['/home-2', '/'], ['/ar/home-2', '/'], ['/en/home', '/en'],
    ['/academic-biography', '/cv'], ['/academic-biography-2', '/cv'], ['/ar/academic-biography', '/cv'], ['/ar/academic-biography-2', '/cv'],
    ['/en/academic-biography', '/en/cv'], ['/en/academic-biography-2', '/en/cv'],
    ['/scholarly-contributions', '/research'], ['/scholarly-contributions-2', '/research'], ['/ar/scholarly-contributions', '/research'], ['/ar/scholarly-contributions-2', '/research'],
    ['/en/scholarly-contributions', '/en/research'], ['/en/scholarly-contributions-2', '/en/research'],
    ['/published-books', '/publications'], ['/published-books-2', '/publications'], ['/ar/published-books', '/publications'], ['/ar/published-books-2', '/publications'],
    ['/signature-thought-articles', '/articles'], ['/signature-thought-articles-2', '/articles'], ['/ar/signature-thought-articles', '/articles'], ['/ar/signature-thought-articles-2', '/articles'],
    ['/recorded-interviews-media-appearances', '/media'], ['/recorded-interviews-media-appearances-2', '/media'], ['/ar/recorded-interviews-media-appearances', '/media'], ['/ar/recorded-interviews-media-appearances-2', '/media'],
    ['/upcoming-speaking-engagements', '/upcoming'], ['/upcoming-speaking-engagements-2', '/upcoming'], ['/ar/upcoming-speaking-engagements', '/upcoming'], ['/ar/upcoming-speaking-engagements-2', '/upcoming'],
    ['/from-my-inbox', '/inbox'], ['/ar/from-my-inbox', '/inbox'],
    ['/about-the-website', '/about'], ['/about-the-website-2', '/about'], ['/ar/about-the-website', '/about'], ['/ar/about-the-website-2', '/about'],
    ['/contact-consultation', '/contact'], ['/contact-consultation-2', '/contact'], ['/ar/contact-consultation', '/contact'], ['/ar/contact-consultation-2', '/contact'],
  ]
  const allowedRedirects = new Map([
    ...migrationPairs,
    ['/now', '/'],
    ['/rss', '/feed.xml'],
    ['/podcast', '/podcast.xml'],
    ['/articles/a-society-that-fears-the-different-scheduledarabbic', '/articles/a-society-that-fears-the-different-arabic'],
    ['/signature_articles/a-society-that-fears-the-different-scheduledarabbic', '/articles/a-society-that-fears-the-different-arabic'],
  ])
  expect(publicRedirects.length === allowedRedirects.size
    && publicRedirects.every((entry) => entry.type === 301
      && typeof entry.source === 'string' && !/[{}:*]/.test(entry.source)
      && allowedRedirects.get(entry.source) === entry.destination),
  'Firebase Hosting يحتوي تحويلات عامة أو غير معتمدة')

  const dataRules = json('firebase.data.json')
  expect(dataRules.firestore?.rules === 'firestore.rules', 'إعداد قواعد Firestore المنفصل غير صحيح')
  expect(dataRules.storage?.rules === 'storage.rules', 'إعداد قواعد Storage المنفصل غير صحيح')

  const rc = json('.firebaserc')
  expect(rc.projects?.hosting === HOSTING_PROJECT, 'اسم مشروع الاستضافة في .firebaserc غير صحيح')
  expect(rc.projects?.data === DATA_PROJECT, 'اسم مشروع البيانات في .firebaserc غير صحيح')

  const hostingWorkflow = read('.github/workflows/firebase-hosting-live.yml')
  expect(hostingWorkflow.includes(`projectId: ${HOSTING_PROJECT}`) || hostingWorkflow.includes(`--project ${HOSTING_PROJECT}`), 'Workflow الاستضافة لا ينشر إلى المشروع الصحيح')
  expect(!/deploy\s+--only\s+firestore|Deploy Firestore rules/i.test(hostingWorkflow), 'Workflow الاستضافة ما زال يحاول نشر قواعد Firestore')
  expect(hostingWorkflow.includes(`VITE_SITE_URL: ${OFFICIAL}`), 'Workflow الاستضافة لا يبني بالدومين الرسمي')

  for (const path of ['.github/workflows/auto-audio-r2.yml', '.github/workflows/daily-radar.yml']) {
    const content = read(path)
    expect(content.includes(`FIREBASE_PROJECT_ID: ${DATA_PROJECT}`), `${path} لا يستخدم مشروع البيانات الصحيح`)
    expect(!content.includes('FIREBASE_PROJECT_ID: gen-lang-client-0200723670'), `${path} ما زال يكتب إلى مشروع الاستضافة`)
  }

  const server = read('server.mjs')
  expect(server.includes("process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'drahmad-8e9e2'"), 'خادم API لا يثبت مشروع البيانات عند تشغيله داخل مشروع الاستضافة')
  expect(!/FIREBASE_PROJECT_ID[\s\S]{0,120}GOOGLE_CLOUD_PROJECT/.test(server), 'خادم API قد يعود إلى مشروع Cloud Run المضيف بدلاً من مشروع البيانات')
  const radarQueue = read('scripts/daily-radar-review-queue.mjs')
  expect(!radarQueue.includes('GOOGLE_CLOUD_PROJECT') && !radarQueue.includes('GCLOUD_PROJECT'), 'الرادار قد يعود إلى مشروع التشغيل المضيف بدلاً من مشروع البيانات')

  const allowedLegacyFiles = new Set([
    'index.html',
    'public/boot.js',
    'server.mjs',
    'scripts/verify-domain-migration.mjs',
    'DOMAIN-CUTOVER.md',
    'src/components/CitationCopy.tsx',
  ])
  const legacyPatterns = [
    /dr-alfailakawi\.web\.app/gi,
    /dr-alfailakawi\.firebaseapp\.com/gi,
    /www\.dr-alfailakawi\.com/gi,
    /208\.115\.236\.10/g,
    /website-34704073784[^\s"'<>)]*/gi,
  ]
  for (const path of walk(ROOT).filter(isTextFile)) {
    const rel = relative(ROOT, path).replaceAll('\\', '/')
    if (rel.startsWith('dist/')) continue
    const content = readFileSync(path, 'utf8')
    for (const pattern of legacyPatterns) {
      pattern.lastIndex = 0
      if (pattern.test(content) && !allowedLegacyFiles.has(rel)) {
        fail(`أثر نطاق/استضافة قديم خارج طبقة التحويل المسموحة: ${rel}`)
      }
    }
  }

  for (const path of ['src/data.ts', 'data.ts'].filter((p) => existsSync(resolve(ROOT, p)))) {
    const content = read(path)
    expect(!content.includes('http://schedule.dr-alfailakawi.com'), `${path} يحتوي رابط حجز غير مشفّر`)
  }
}

function checkDist() {
  const dist = resolve(ROOT, 'dist')
  expect(existsSync(dist), 'مجلد dist غير موجود؛ شغّل npm run build أولاً')
  if (!existsSync(dist)) return

  for (const required of ['index.html', 'sitemap.xml', 'robots.txt', 'feed.xml', 'podcast.xml', 'firebase-applet-config.json']) {
    expect(existsSync(resolve(dist, required)), `ملف النشر مفقود: dist/${required}`)
  }

  const sitemap = readFileSync(resolve(dist, 'sitemap.xml'), 'utf8')
  const robots = readFileSync(resolve(dist, 'robots.txt'), 'utf8')
  const feed = readFileSync(resolve(dist, 'feed.xml'), 'utf8')
  const podcast = readFileSync(resolve(dist, 'podcast.xml'), 'utf8')
  const runtimeFirebase = JSON.parse(readFileSync(resolve(dist, 'firebase-applet-config.json'), 'utf8'))

  const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
  expect(sitemapLocs.length > 0, 'sitemap.xml لا يحتوي أي رابط <loc>')
  expect(sitemapLocs.every(isOfficialUrl), 'sitemap.xml يحتوي رابطاً خارج الدومين الرسمي')
  expect(new Set(sitemapLocs).size === sitemapLocs.length, 'sitemap.xml يحتوي روابط مكررة')
  expect(!sitemapLocs.some((url) => /scheduledarabbic/i.test(url)), 'sitemap.xml يحتوي slug غير نظيف')
  expect(robots.includes(`Sitemap: ${OFFICIAL}/sitemap.xml`), 'robots.txt لا يشير إلى خريطة الموقع الرسمية')
  expect(feed.includes(`<link>${OFFICIAL}</link>`), 'feed.xml لا يعتمد الدومين الرسمي')
  expect(podcast.includes(`<link>${OFFICIAL}</link>`), 'podcast.xml لا يعتمد الدومين الرسمي')
  expect(runtimeFirebase.projectId === DATA_PROJECT, 'إعداد Firebase المنشور لا يعتمد مشروع البيانات')
  note(`sitemap.xml: ${sitemapLocs.length} رابطاً على الدومين الرسمي`)

  const unsafeHttp = /http:\/\/(?!www\.w3\.org\/|www\.sitemaps\.org\/|www\.itunes\.com\/|purl\.org\/|www\.apache\.org\/licenses\/)/i
  const legacy = /(?:dr-alfailakawi\.web\.app|dr-alfailakawi\.firebaseapp\.com|www\.dr-alfailakawi\.com|208\.115\.236\.10|website-34704073784)/i
  let htmlCount = 0

  for (const path of walk(dist).filter(isTextFile)) {
    const rel = relative(ROOT, path).replaceAll('\\', '/')
    let content = readFileSync(path, 'utf8')
    if (/\.html?$/i.test(path)) {
      htmlCount += 1
      const canonical = content.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1]
      const ogUrl = content.match(/<meta\s+property=["']og:url["'][^>]*content=["']([^"']+)/i)?.[1]
      if (canonical) expect(isOfficialUrl(canonical), `${rel}: canonical خارج الدومين الرسمي`)
      if (ogUrl) expect(isOfficialUrl(ogUrl), `${rel}: og:url خارج الدومين الرسمي`)
      for (const match of content.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          checkJsonLdUrls(JSON.parse(match[1]), rel)
        } catch {
          fail(`${rel}: Schema JSON-LD غير صالح`)
        }
      }
      content = stripCanonicalRedirect(content)
    }
    content = stripBootLegacyRedirect(content, rel)
    legacy.lastIndex = 0
    if (legacy.test(content)) fail(`${rel}: يحتوي أثراً قديماً خارج كود التحويل المبكر`)
    const thirdPartyVendorBundle = /^dist\/assets\/vendor-[^/]+\.js$/i.test(rel)
    if (!thirdPartyVendorBundle && unsafeHttp.test(content)) fail(`${rel}: يحتوي رابط HTTP قابل للتحميل وقد يسبب Mixed Content`)
  }
  note(`تم فحص ${htmlCount} صفحة HTML منشورة`)
}

if (!DIST_ONLY) checkRepository()
if (DIST_ONLY || existsSync(resolve(ROOT, 'dist'))) checkDist()
else note('فحص المستودع اكتمل؛ فحص dist سيعمل تلقائياً بعد vite build')

for (const message of notes) console.log(`• ${message}`)
if (errors.length) {
  console.error(`✘ فشل فحص اعتماد الدومين (${errors.length})`)
  for (const message of [...new Set(errors)]) console.error(`  - ${message}`)
  process.exit(1)
}
console.log(`✔ الدومين الرسمي الوحيد في المخرجات: ${OFFICIAL_HOST}`)
console.log(`✔ Hosting: ${HOSTING_PROJECT} / ${HOSTING_SITE}`)
console.log(`✔ Auth + Firestore + Storage: ${DATA_PROJECT}`)
