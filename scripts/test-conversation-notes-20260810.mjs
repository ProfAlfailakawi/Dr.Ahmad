#!/usr/bin/env node
/**
 * Regression contract for the 2026-08-10 conversation-wide UX pass.
 * No external packages: it can run against the uploaded source tree itself.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const text = (path) => readFileSync(resolve(root, path), 'utf8')
const json = (path) => JSON.parse(text(path))
let passed = 0
const check = (label, fn) => {
  fn()
  passed += 1
  console.log(`✓ ${label}`)
}

const app = text('src/App.tsx')
const css = text('src/index.css')
const atlas = text('src/pages/Atlas.tsx')
const research = text('src/pages/Research.tsx')
const media = text('src/pages/Media.tsx')
const impact = text('src/pages/Impact.tsx')
const article = text('src/pages/ArticleDetail.tsx')
const pivot = text('src/components/ArticlePivot.tsx')
const selection = text('src/components/IdeaFeatures.tsx')
const entry = text('src/components/KnowledgeEntry.tsx')
const ui = text('src/components/ui.tsx')
const home = text('src/pages/Home.tsx')
const card = text('src/pages/Card.tsx')
const conceptWeave = text('src/lib/concept-weave.ts')
const conceptEcho = text('src/components/ConceptEcho.tsx')
const mediaMerge = text('src/lib/media-archive.ts')
const mediaArchive = json('src/data/media-archive.json')
const atlasPayload = json('src/data/atlas-constellations.json')
const glossary = json('src/data/dr-ahmad-domain-glossary.json')
const bodies = json('src/data/bodies.json')

check('مؤشرات السحب تعمل على كل السكك المعروفة، ومنها توقيعات الموقع، ولا تظهر إلا مع وجود محتوى في الجهة', () => {
  assert.match(app, /\.signatures-rail/)
  assert.match(app, /data-can-left/)
  assert.match(app, /data-can-right/)
  assert.match(app, /const signatureRail = rail\.matches\('\.signatures-rail'\)/)
  assert.match(css, /\[data-mobile-card-rail="true"\]\[data-can-left="true"\]/)
  assert.match(css, /\[data-mobile-card-rail="true"\]\[data-can-right="true"\]/)
  assert.match(css, /background-position:\s*left 10px bottom 5px, right 10px bottom 5px/)
})

check('بطاقة السحب على الهاتف كاملة العرض ولا تُظهر حافة بطاقة ثانية', () => {
  assert.match(css, /\[data-mobile-card-rail="true"\] > :not\(\[aria-hidden="true"\]\)[\s\S]*?flex:\s*0 0 100% !important/)
  assert.match(css, /\[data-mobile-card-rail="true"\][\s\S]*?-webkit-mask-image:\s*none !important/)
})

check('تعليم السحب يظهر مرة واحدة فقط عند أول سكة مرئية ويعمل على الهاتف والكمبيوتر بلا زر ضغط', () => {
  assert.match(app, /const SWIPE_DISCOVERY_KEY = 'dr-ahmad:swipe-discovery:v1'/)
  assert.match(app, /window\.localStorage\.setItem\(SWIPE_DISCOVERY_KEY, 'seen'\)/)
  assert.match(app, /new IntersectionObserver/)
  assert.match(app, /rail-swipe-discovery__label">اسحب للتنقّل<\/span>/)
  assert.match(app, /finePointerMedia/)
  assert.match(app, /rail\.scrollLeft = startScrollLeft - delta/)
  assert.match(css, /\.rail-swipe-discovery\s*\{[\s\S]*?pointer-events:\s*none/)
  assert.match(css, /rail-swipe-discovery-pulse[\s\S]*?1 both/)
  assert.match(css, /\[data-swipe-rail="true"\]\[data-swipe-drag="true"\][\s\S]*?cursor:\s*grab/)
})

check('مقياس الوعد/التحفّظ حُذف بصرياً من سماء المقالات', () => {
  assert.doesNotMatch(atlas, />\s*وعد\s*</)
  assert.doesNotMatch(atlas, />\s*تحفّظ\s*</)
  assert.doesNotMatch(atlas, /المقياس آلي/)
})

check('مفتاح ألوان سماء المقالات يكتب اسم التصنيف بجانب خط اللون على الهاتف والكمبيوتر', () => {
  const uses = atlas.match(/<text[^>]*>[{]categoryLabel\(category\)[}]<\/text>/g) || []
  assert.ok(uses.length >= 2, `وجد ${uses.length} فقط`)
})

check('إشارات المقال المنحنية داخل الفقرة نفسها ولا تستهلك صفاً مستقلاً', () => {
  assert.match(article, /<p[\s\S]*?article-signal-inline-cluster[\s\S]*?<\/p>/)
  const closeP = article.indexOf('</p>', article.indexOf('article-signal-inline-cluster'))
  assert.ok(closeP > article.indexOf('article-signal-inline-cluster'))
  assert.match(css, /\.article-signal-inline-cluster\s*\{[\s\S]*?display:\s*inline-flex/)
  assert.match(css, /\.article-signal-inline-cluster[\s\S]*?white-space:\s*nowrap/)
  assert.match(pivot, /article-pull-quote--marker-only/)
})

check('سماء التظليل صارت بطاقة مدمجة بعد متن المقال', () => {
  const bodyAt = article.indexOf('id="article-body"')
  const archiveAt = article.indexOf('reader-made-archive')
  assert.ok(bodyAt >= 0 && archiveAt > bodyAt)
  assert.match(article, /reader-made-summary[\s\S]*?px-4 py-3/)
  assert.doesNotMatch(article, /reader-made-summary[^\n]*py-(?:8|9|10|12)/)
})

check('البحث وسؤال الأرشيف اندمجا بصرياً مع بقاء الوظيفتين مستقلتين', () => {
  assert.match(entry, /ابحث أو اسأل الأرشيف/)
  assert.match(entry, /to:\s*'\/search'/)
  assert.match(entry, /to:\s*'\/ask'/)
  assert.match(entry, /\/search\?tab=askbook/)
  assert.match(entry, /role="tablist"/)
})

check('فلتر الأثر يبيّن الحالة النشطة بخط سفلي واضح', () => {
  assert.match(impact, /impact-filter-tab editorial-tab[\s\S]*?is-active/)
  assert.match(css, /\.content-impact \.impact-filter-tab\.is-active::after[\s\S]*?height:\s*2px/)
  assert.match(css, /\.editorial-tab\.is-active::after\s*\{\s*transform:\s*scaleX\(1\)/)
})

check('معلومة التحكيم والمصادر تبقى مرة واحدة أعلى الأبحاث من دون كتلة مستقلة', () => {
  assert.equal((research.match(/الأرشيف العلمي المحكّم/g) || []).length, 1)
  assert.match(research, /PageHead[\s\S]*?الأرشيف العلمي المحكّم[\s\S]*?بمصادر أصلية/)
  assert.doesNotMatch(research, /17 بحثاً محكّماً/)
  assert.match(research, /placeholder="ابحث: عنوان، باحث، كلمة مفتاحية"/)
})

check('حقل بحث الظهور الإعلامي مختصر', () => {
  assert.match(media, /placeholder="مثال: التعليم الإلكتروني، الذكاء الاصطناعي"/)
})

check('كل مواد الأرشيف الإعلامي الحالية مؤرخة ولا تظهر عبارة «غير مؤرخ»', () => {
  assert.ok(mediaArchive.items.length > 0)
  for (const item of mediaArchive.items) {
    assert.match(String(item.iso || item.date || ''), /(?:19|20)\d{2}/, `${item.id} بلا سنة`)
  }
  assert.doesNotMatch(media, /غير مؤرخ/)
})

check('التواريخ التي أعطاها المستخدم محفوظة حرفياً', () => {
  const byId = new Map(mediaArchive.items.map((item) => [item.id, item]))
  assert.equal(byId.get('RuazVRH7eLM')?.date, '2020')
  assert.equal(byId.get('Tarbawyah-14')?.date, '2024')
  assert.equal(byId.get('idaa')?.date, '2025')
})

check('تحرير مادة من لوحة المحتوى لا يمحو تاريخ الأرشيف الموثق إذا تُرك التاريخ فارغاً', () => {
  assert.match(mediaMerge, /date:\s*item\.date \|\| archived\?\.date/)
  assert.match(mediaMerge, /iso:\s*item\.iso \|\| archived\?\.iso/)
})

const normalize = (value = '') => String(value)
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .toLowerCase().replace(/[^\p{L}\p{N}\s-]+/gu, ' ').replace(/\s+/g, ' ').trim()

check('مصطلحات كوكبات سماء المقالات معتمدة ومسنودة حرفياً بمتون المقالات نفسها', () => {
  const byCanonical = new Map(glossary.map((item) => [String(item.canonicalAr || '').trim(), item]))
  const banned = new Set(['الاتصالية', 'الحضور الإلكتروني بالرمز السريع', 'تحويل النص إلى كلام', 'تحويل الكلام إلى نص', 'نموذج كيمب', 'الفجوة الرقمية', 'روبوتات المحادثة الذكية', 'التعلّم بالأجهزة الذكية'])
  for (const constellation of atlasPayload.constellations) {
    assert.ok(!banned.has(constellation.title), `مصطلح قديم غير موثّق ما زال ظاهراً: ${constellation.title}`)
    const term = byCanonical.get(constellation.title)
    assert.ok(term, `ليس في القاموس: ${constellation.title}`)
    const aliases = [term.canonicalAr, ...(term.aliases || [])]
      .filter((value) => /[\u0600-\u06ff]/.test(String(value)))
      .map(normalize).filter(Boolean)
    assert.ok(constellation.slugs.length >= 2, `${constellation.title}: أقل من مقالتين`)
    for (const slug of constellation.slugs) {
      const body = normalize(bodies[slug] || '')
      assert.ok(body && aliases.some((alias) => body.includes(alias)), `${constellation.title} غير مسنود داخل ${slug}`)
    }
  }
})

check('فوتر الرئيسية والفوتر العام مضغوطان ويستخدمان Social Dock وسنة ديناميكية', () => {
  assert.match(home, /<SocialDock centered \/>/)
  assert.match(home, /new Date\(\)\.getFullYear\(\)/)
  assert.match(ui, /export function SocialDock/)
  assert.match(ui, /site-social-dock__trigger/)
  assert.match(ui, /new Date\(\)\.getFullYear\(\)/)
  assert.match(css, /site-footer--calm/)
  assert.match(css, /site-social-dock\.is-open \.site-social-dock__panel/)
})

check('الطباعة في صف المشاركة نفسه ولا يمكن أن تنفرد بصف على الهاتف', () => {
  const shareStart = article.indexOf('article-share-actions')
  const shareEnd = article.indexOf('</div>', shareStart)
  const shareChunk = article.slice(shareStart, shareEnd + 6)
  assert.match(shareChunk, /طباعة المقال/)
  assert.match(css, /\.article-share-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap !important/)
  assert.match(css, /\.article-share-actions[\s\S]*?overflow-x:\s*auto !important/)
})

check('التحديد في المقال يبقى نصياً مع منع callout/context menu وإبراز شريط الموقع', () => {
  assert.match(selection, /addEventListener\('contextmenu', suppressNativeMenu, \{ capture: true \}\)/)
  assert.match(selection, /addEventListener\('dragstart', suppressNativeMenu, \{ capture: true \}\)/)
  assert.match(selection, /addEventListener\('touchend', suppressNativeSelectionAction, \{ capture: true, passive: false \}\)/)
  assert.match(selection, /addEventListener\('pointerup', suppressNativeSelectionAction, \{ capture: true \}\)/)
  assert.match(css, /\.content-articles #article-body[\s\S]*?-webkit-touch-callout:\s*none !important/)
  assert.match(css, /-webkit-user-select:\s*text !important/)
  assert.match(css, /\.reader-selection-toolbar\s*\{\s*z-index:\s*10050 !important/)
})

check('مصطلح صدى الفكرة استبدل «يوسّعها» بلفظ عربي محايد وأنيق', () => {
  assert.doesNotMatch(conceptWeave, /يوسّعها/)
  assert.doesNotMatch(conceptEcho, /يوسّعها/)
  assert.match(conceptWeave, /يعمّقها/)
  assert.match(conceptEcho, /'يعمّقها':/)
})

check('تسميات محاور سماء المقالات تعيش في هامش مستقل ولا تتقاطع مع النجوم', () => {
  assert.match(atlas, /<text x=\{MOBILE_W - 18\}[^>]*textAnchor="end"[^>]*>\{categoryLabel\(category\)\}<\/text>/)
  assert.match(atlas, /<line x1=\{MOBILE_W - 105\}[^>]*x2=\{MOBILE_W - 91\}/)
  assert.match(atlas, /<text x=\{W - 18\}[^>]*textAnchor="end"[^>]*>\{categoryLabel\(category\)\}<\/text>/)
  assert.match(atlas, /<line x1=\{W - 116\}[^>]*x2=\{W - 102\}/)
})

check('الأرشيف الإعلامي مرتب حسب الظهور من الأحدث إلى الأقدم مع احترام التاريخ الدقيق', () => {
  assert.match(media, /const mediaAppearanceOrder/)
  assert.match(media, /mergeMediaArchive\(cmsMedia\)\.sort\(\(left, right\) => mediaAppearanceOrder\(right\) - mediaAppearanceOrder\(left\)\)/)
})

check('ResearchGate وGoogle Scholar وروابط الفوتر المهمة أيقونات فقط بلا أسماء مرئية', () => {
  assert.match(ui, /site-social-dock__academic[\s\S]*?<SocialIcon name=\{item\.label\} size=\{17\}/)
  assert.doesNotMatch(ui, /<a key=\{item\.label\}[^>]*>\{item\.label\}<\/a>/)
  assert.match(ui, /<SocialIcon name="Share" size=\{17\} \/>/)
  assert.doesNotMatch(ui, /<span>\{english \? 'Connect' : 'تواصل معي'\}<\/span>/)
  assert.match(ui, /id="footer-cv-ar"[\s\S]*?<SocialIcon name="CV"/)
  assert.match(ui, /<TebyanProjectLink label="تبيان" iconOnly className="site-footer__project" \/>/)
  assert.match(ui, /<ScheduleProjectLink label="الجدول" iconOnly className="site-footer__project" \/>/)
  assert.match(home, /<TebyanProjectLink label="تبيان" iconOnly className="home-footer-tools__item is-icon-only" \/>/)
  assert.match(home, /<ScheduleProjectLink label="الجدول" iconOnly className="home-footer-tools__item is-icon-only" \/>/)
  assert.match(card, /aria-label="الملفات الأكاديمية"[\s\S]*?<SocialIcon name=\{item\.label\} size=\{18\}/)
})

check('توكن الحافة الكامل لا يُغلّف داخل rgb() مرة أخرى', () => {
  assert.doesNotMatch(css, /rgb\(var\(--c-hair/)
  assert.match(css, /border:\s*1px solid var\(--c-hair\)/)
})

console.log(`\nالنتيجة: ${passed} تحققاً ناجحاً، 0 إخفاقاً.`)
