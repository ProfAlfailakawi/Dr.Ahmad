#!/usr/bin/env node
/**
 * التدقيق النهائي للروابط القديمة — إكمالٌ لمنظومة الترحيل لا استبدالٌ لها.
 *
 * المنظومة القائمة كما هي: تحويلات `firebase.json`، وحارس التقاعد
 * `verify-legacy-retirement.mjs`، وفحص الروابط الساكنة `check-static-links.mjs`،
 * وsitemap وcanonical في مسار البناء. هذا الملف يجمع الجرد ويكشف ما لا يكشفه
 * أيٌّ منها منفرداً: السلاسل والحلقات والوجهة غير المطابقة والروابط الداخلية
 * التي ما زالت تستعمل العنوان القديم.
 *
 * صدقٌ في التصنيف: ما لا يمكن إثباته بلا شبكة يُوسم `unverified` صراحةً،
 * ولا يُدَّعى له كود استجابة.
 *
 * الاستعمال:
 *   node scripts/audit-legacy-links.mjs           تقرير كامل
 *   node scripts/audit-legacy-links.mjs --ci      حارس التراجع للروابط الحرجة
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CI = process.argv.includes('--ci')
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')
const has = (path) => existsSync(resolve(ROOT, path))

/* ── مسارات التطبيق الحقيقية ─────────────────────────────────────── */

const routes = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1])
const staticRoutes = new Set(routes.filter((route) => !route.includes(':') && !route.includes('*')))
const dynamicRoutes = routes
  .filter((route) => route.includes(':') || route.endsWith('/*'))
  .map((route) => new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+').replace(/\/\*$/, '(?:/.*)?')}$`))

/* ملفاتٌ يولّدها مسار البناء ولا توجد في المستودع — غيابها ليس عطباً. */
const GENERATED_ASSETS = new Set(['/sitemap.xml', '/feed.xml', '/podcast.xml', '/robots.txt', '/manifest.webmanifest'])

const knownDestination = (target) => {
  const path = String(target || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (staticRoutes.has(path)) return true
  if (dynamicRoutes.some((pattern) => pattern.test(path))) return true
  /* أصلٌ محليّ — في المستودع أو public/ أو مما يولّده البناء في dist/. */
  if (/\.[a-z0-9]{2,5}$/i.test(path)) {
    return has(path.replace(/^\//, '')) || has(`public${path}`) || has(`dist${path}`) || GENERATED_ASSETS.has(path)
  }
  return false
}

/* ── مصادر قائمة الروابط ─────────────────────────────────────────── */

const rows = []
const seenSource = new Set()
const add = (source, target, status, file, note = '') => {
  const clean = String(source || '').trim()
  if (!clean.startsWith('/') || seenSource.has(clean)) return
  seenSource.add(clean)
  rows.push({ source: clean, target: String(target || '').trim(), status: Number(status) || 301, file, note })
}

/* ١) تحويلات الاستضافة — المصدر التنفيذي */
if (has('firebase.json')) {
  const hosting = JSON.parse(read('firebase.json')).hosting || {}
  for (const item of hosting.redirects || []) add(item.source || item.regex, item.destination, item.type || 301, 'firebase.json')
}

/* ٢) تحويلات الخادم */
if (has('server.mjs')) {
  const text = read('server.mjs')
  for (const match of text.matchAll(/\[\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\]/g)) {
    if (/legacy|wordpress|\/en\/|\.php|wp-/i.test(match[1])) add(match[1], match[2], 301, 'server.mjs')
  }
}

/* ٣) الروابط الحرجة التي يفرضها حارس التقاعد — لا يجوز أن تسقط بصمت */
const criticalPairs = []
if (has('scripts/verify-legacy-retirement.mjs')) {
  for (const match of read('scripts/verify-legacy-retirement.mjs').matchAll(/'(\/[^']+) -> (\/[^']+)'/g)) {
    criticalPairs.push({ source: match[1], target: match[2] })
    add(match[1], match[2], 301, 'verify-legacy-retirement.mjs', 'حرج')
  }
}

/* ٤) تصدير Search Console متى وضعه المستخدم — يُقرأ ولا يُشترط */
const consolePath = 'reports/search-console-urls.csv'
let searchConsoleCount = 0
if (has(consolePath)) {
  for (const line of read(consolePath).split('\n').slice(1)) {
    const url = line.split(',')[0]?.trim().replace(/^"|"$/g, '')
    if (!url) continue
    try {
      const path = url.startsWith('http') ? new URL(url).pathname : url
      add(path, '', 0, consolePath, 'من Search Console')
      searchConsoleCount += 1
    } catch { /* سطرٌ غير صالح يُتجاوز */ }
  }
}

/* ── الروابط الداخلية القديمة داخل المصدر والمحتوى ───────────────── */

/* المسار القديم إمّا نسبيٌّ داخل الموقع، وإمّا على نطاقنا نحن. روابط المجلات
   الخارجية (‎/index.php‎ في مواقع الجامعات مثلاً) ليست تراثاً نُرحّله، وإدخالها
   يُغرق التقرير بضجيجٍ كاذب فيُهمَل التقرير كلّه. */
const LEGACY_PATH = String.raw`(?:\/wp-content\/|\/wp-json\/|\/wp-admin|\/signature_articles\/|\/published_articles\/|\/scholarly_contributi|\/\?p=\d+)`
const LEGACY_PATTERN = new RegExp(`(?:['"\`(]${LEGACY_PATH}|dr-alfailakawi\\.com${LEGACY_PATH})`, 'i')
const scanDirs = ['src', 'scripts', 'docs']
const skipDirs = new Set(['node_modules', '.git', 'dist', 'assets'])
const internalLegacy = []

const walk = (dir) => {
  for (const entry of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) { walk(path); continue }
    if (!/\.(tsx?|mjs|json|md)$/.test(entry.name)) continue
    if (/audit-legacy-links|verify-legacy-retirement|legacy-links-report/.test(path)) continue
    const text = readFileSync(resolve(ROOT, path), 'utf8')
    for (const [index, line] of text.split('\n').entries()) {
      if (!LEGACY_PATTERN.test(line)) continue
      /* التحويلة نفسها والتعليقُ الشارح لها ليسا رابطاً قديماً — هما علاجه. */
      if (/redirect|destination|source:|legacy|قديم|forbidden/i.test(line)) continue
      if (/^\s*(?:\/\*|\*|\/\/)/.test(line.trim())) continue
      if (/\[\s*'\/[^']*',\s*'\//.test(line)) continue
      internalLegacy.push({ file: path, line: index + 1, text: line.trim().slice(0, 160) })
    }
  }
}
for (const dir of scanDirs) if (has(dir)) walk(dir)

/* ── السلاسل والحلقات والوجهات ───────────────────────────────────── */

const bySource = new Map(rows.map((row) => [row.source, row]))
const chains = []
const loops = []
const mismatched = []
const toHome = []
const notFound = []
const gone = []
const unverified = []

for (const row of rows) {
  if (row.status === 410) { gone.push(row.source); continue }
  if (!row.target) { unverified.push(row.source); continue }

  let current = row
  const visited = new Set([row.source])
  let hops = 1
  while (current.target && bySource.has(current.target)) {
    if (visited.has(current.target)) { loops.push({ source: row.source, at: current.target }); break }
    visited.add(current.target)
    current = bySource.get(current.target)
    hops += 1
    if (hops > 25) { loops.push({ source: row.source, at: current.target }); break }
  }
  if (loops.at(-1)?.source === row.source) continue
  if (hops > 1) chains.push({ source: row.source, hops, final: current.target })

  const final = current.target
  /* «كل المفقود إلى الرئيسية» ليس ترحيلاً — يُرصد ولا يُبرَّر. */
  /* `/now` تحويلٌ مقصود داخل التطبيق، لا «كل المفقود إلى الرئيسية». */
  if (final === '/' && row.source !== '/' && !/^\/(?:home|index)/i.test(row.source) && !staticRoutes.has(row.source)) {
    toHome.push({ source: row.source, target: final })
  }
  if (final.includes(':')) continue
  if (knownDestination(final)) continue
  if (/\.[a-z0-9]{2,5}$/i.test(final)) notFound.push({ source: row.source, target: final, kind: 'أصل محلي مفقود' })
  else mismatched.push({ source: row.source, target: final, kind: 'وجهة غير معروفة في جدول المسارات' })
}

const temporary = rows.filter((row) => row.status === 302 || row.status === 307)
const missingCritical = criticalPairs.filter((pair) => {
  const row = bySource.get(pair.source)
  return !row || (row.target !== pair.target && row.file === 'verify-legacy-retirement.mjs')
})

/* ── canonical وsitemap متى توفّر البناء ─────────────────────────── */

const canonicalConflicts = []
let sitemapPaths = new Set()
if (has('dist/sitemap.xml')) {
  sitemapPaths = new Set([...read('dist/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => { try { return new URL(match[1]).pathname.replace(/\/+$/, '') || '/' } catch { return '' } })
    .filter(Boolean))
  /* رابطٌ قديمٌ لا يجوز أن يبقى في خريطة الموقع الجديدة. */
  for (const row of rows) if (sitemapPaths.has(row.source)) canonicalConflicts.push({ path: row.source, reason: 'رابط قديم ما زال في sitemap' })
}

/* ── التقرير ─────────────────────────────────────────────────────── */

const report = {
  generatedAt: new Date().toISOString(),
  sources: {
    'firebase.json': rows.filter((row) => row.file === 'firebase.json').length,
    'server.mjs': rows.filter((row) => row.file === 'server.mjs').length,
    'verify-legacy-retirement.mjs': criticalPairs.length,
    'search-console': searchConsoleCount,
  },
  total: rows.length,
  permanent301: rows.filter((row) => row.status === 301 || row.status === 308).length,
  temporary302: temporary.length,
  gone410: gone.length,
  chains,
  loops,
  redirectToHome: toHome,
  mismatchedDestination: mismatched,
  missingLocalAsset: notFound,
  unverified,
  missingCritical,
  canonicalConflicts,
  internalLegacyLinks: internalLegacy,
  sitemapChecked: sitemapPaths.size,
  note: 'أكواد الاستجابة الحيّة (200/404/5xx) لا تُدَّعى بلا شبكة؛ ما لا يُثبت يُوسم unverified.',
  rows,
}

mkdirSync(resolve(ROOT, 'reports'), { recursive: true })
writeFileSync(resolve(ROOT, 'reports/legacy-links-report.json'), `${JSON.stringify(report, null, 2)}\n`)

const list = (items, render) => (items.length ? items.slice(0, 40).map(render).join('\n') : '- لا شيء')
writeFileSync(resolve(ROOT, 'reports/legacy-links-report.md'), `# تدقيق الروابط القديمة

تاريخ التوليد: ${report.generatedAt}

## الإجمالي
- الروابط المجرودة: ${report.total}
- تحويل دائم 301/308: ${report.permanent301}
- تحويل مؤقّت 302/307: ${report.temporary302}
- محذوف نهائياً 410: ${report.gone410}
- بلا وجهة (يحتاج قراراً): ${report.unverified.length}
- تحقّق sitemap: ${report.sitemapChecked} رابطاً

## ما يحتاج قراراً
### سلاسل تحويل
${list(chains, (item) => `- ${item.source} → ${item.final} (${item.hops} قفزات)`)}

### حلقات تحويل
${list(loops, (item) => `- ${item.source} عند ${item.at}`)}

### وجهة غير مطابقة
${list(mismatched, (item) => `- ${item.source} → ${item.target} · ${item.kind}`)}

### أصل محلي مفقود
${list(notFound, (item) => `- ${item.source} → ${item.target}`)}

### تحويل إلى الرئيسية بلا بديل مطابق
${list(toHome, (item) => `- ${item.source}`)}

### canonical متعارض
${list(canonicalConflicts, (item) => `- ${item.path} · ${item.reason}`)}

### روابط داخلية ما زالت قديمة
${list(internalLegacy, (item) => `- ${item.file}:${item.line}`)}

### روابط حرجة ناقصة
${list(missingCritical, (item) => `- ${item.source} → ${item.target}`)}

> ${report.note}
`)

/* ── المخرجات وحارس التراجع ──────────────────────────────────────── */

console.log(`الروابط: ${report.total} · 301: ${report.permanent301} · 302: ${report.temporary302} · 410: ${report.gone410}`)
console.log(`سلاسل: ${chains.length} · حلقات: ${loops.length} · وجهة غير مطابقة: ${mismatched.length} · أصل مفقود: ${notFound.length}`)
console.log(`روابط داخلية قديمة: ${internalLegacy.length} · إلى الرئيسية: ${toHome.length} · حرجة ناقصة: ${missingCritical.length}`)
console.log('✓ reports/legacy-links-report.{json,md}')

if (!CI) process.exit(0)

/* الحارس يمنع التراجع في الحرج وحده: لا يُكسر البناء لرابطٍ خارجيٍّ عارض. */
const blocking = [
  loops.length && `حلقات تحويل: ${loops.length}`,
  chains.length && `سلاسل تحويل: ${chains.length}`,
  temporary.length && `تحويل مؤقّت لوجهةٍ دائمة: ${temporary.length}`,
  missingCritical.length && `روابط حرجة ناقصة: ${missingCritical.length}`,
  notFound.length && `أصل محلي مفقود: ${notFound.length}`,
  internalLegacy.length && `روابط داخلية قديمة في المصدر: ${internalLegacy.length}`,
].filter(Boolean)

if (blocking.length) {
  console.error('\n✗ تراجعٌ في الروابط الحرجة:')
  for (const reason of blocking) console.error(`  - ${reason}`)
  console.error('  التفصيل في reports/legacy-links-report.md')
  process.exit(1)
}
console.log('✓ لا تراجع في الروابط الحرجة')
