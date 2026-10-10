#!/usr/bin/env node
/** Final user-note contract — 2026-08-09.
 * This guard is intentionally user-facing: it checks the latest requirements
 * without dictating incidental implementation details.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const ideaFeatures = read('src/components/IdeaFeatures.tsx')
const articleReader = read('src/components/ArticleReader.tsx')
const articlePivot = read('src/components/ArticlePivot.tsx')
const articleDetail = read('src/pages/ArticleDetail.tsx')
const atlas = read('src/pages/Atlas.tsx')
const paper = read('src/pages/PaperDetail.tsx')
const researchNav = read('src/components/ResearchSectionNavigator.tsx')
const media = read('src/pages/Media.tsx')
const publications = read('src/pages/Publications.tsx')
const bookDetail = read('src/pages/BookDetail.tsx')
const encyclopediaPortal = read('src/components/EncyclopediaPortal.tsx')
const ui = read('src/components/ui.tsx')
const readingShelf = read('src/components/ReadingShelf.tsx')
const impact = read('src/pages/Impact.tsx')
const ask = read('src/pages/AskLibrary.tsx')
const persistentAudio = read('src/lib/persistent-audio.tsx')
const css = read('src/index.css')
const html = read('index.html')
const hero = read('src/components/home/HumanCoreHero.tsx')
const quoteMerge = read('src/lib/quote-merge.ts')

let passed = 0
const failed = []
/* يكمل بقية الفحوص بعد أول إخفاق ثم يفشل في النهاية: فلا يحجب إخفاقٌ واحد ما بعده. */
const check = (label, fn) => {
  try {
    fn()
    passed += 1
    console.log(`✓ ${label}`)
  } catch (error) {
    failed.push(label)
    console.log(`✘ ${label}\n    ${String(error.message).split('\n').slice(0, 3).join(' ').slice(0, 220)}`)
  }
}

check('تحديد iPhone يبقى Native وقابلاً للتمديد بلا removeAllRanges أو سقف 800 حرف', () => {
  assert.ok(ideaFeatures.includes("addEventListener('selectionchange'"))
  assert.ok(!ideaFeatures.includes('selection.removeAllRanges()'))
  assert.ok(!/text\.length\s*>\s*800/.test(ideaFeatures))
  /* منع contextmenu المُوجَّه (بلا منع touchstart/selectstart) ميزةٌ مقصودة لـiOS/PWA
     تحمي طبقة الأوامر الأصلية مع بقاء المقابض والتمديد — فلا يُمنع هنا. */
})

check('عدّاد الاقتباس حيّ ويعرض بيانات Popular Quotes الحقيقية', () => {
  assert.ok(articleReader.includes('export const POPULAR_THRESHOLD = 1'))
  assert.ok(articleDetail.includes('popularQuotes.filter((quote) => quote.paragraph === pIdx)'))
  assert.ok(ideaFeatures.includes("new CustomEvent('reader:quote-saved'"))
  assert.ok(quoteMerge.includes('MERGE_LENGTH_TOLERANCE = 0.40'))
})

check('إشارات المقال 1–3 باقية ومنفصلة عن عدّاد القرّاء الحقيقي', () => {
  assert.ok(articlePivot.includes('export function articleSignalsOf'))
  assert.ok(articlePivot.includes('meaningfulParagraphs >= 10 ? 3'))
  assert.ok(articleDetail.includes('articleSignals.filter((signal) => signal.paragraph === pIdx)'))
  assert.ok(articlePivot.includes("signal.count > 0"))
})

check('بعد القراءة أزيل كواجهة فقط وموقعها في السماء انتقل بأناقة', () => {
  assert.ok(!articleDetail.includes('id="after-reading-title"'))
  assert.ok(!articleDetail.includes('امتداد الفكرة · أدوات الباحث · المشاركة والاستشهاد'))
  assert.ok(articleDetail.includes('article-atlas-knot'))
  assert.ok(articleDetail.includes('/atlas?star=${encodeURIComponent(article.slug)}'))
})

check('سماء المقالات تستقبل deep-link وتحفظ المقارنة؛ ومفتاح الألوان دُمج في الفلتر', () => {
  /* لوحة «ألوان المحاور» و?colors= استُبدلتا عمداً بنقاط اللون داخل فلتر المحاور
     (scripts/test-site-polish-2026.mjs يحرس غيابها)، فلا نطلب هنا ما يناقضه. */
  assert.ok(atlas.includes('atlas-axis-filter__dot'))
  assert.ok(!atlas.includes('ألوان المحاور') && !atlas.includes("get('colors')"))
  assert.ok(atlas.includes('compareMode'))
  assert.ok(atlas.includes('compareIndex'))
  assert.ok(atlas.includes("params.get('star')"))
  assert.ok(read('src/lib/atlas-compare.ts').includes(".get('compare')") && atlas.includes('compareSlugsFromSearch'))
  assert.ok(atlas.includes('...urlCompareSlugs'), 'slugs المقارنة تُثبَّت في عيّنة النجوم')
  assert.ok(atlas.includes('contentLoading') && atlas.includes('resolveCompare('), 'لا يُسقَط slug قبل انتهاء تحميل المحتوى')
  assert.ok(/onPopState[\s\S]{0,700}setCompareMode\(false\)[\s\S]{0,200}setUrlCompareSlugs\(compareSlugsFromSearch[\s\S]{0,120}setQueryHydrated\(false\)/.test(atlas), 'الرجوع/التقدّم يمسح المقارنة ويعيد استعادتها من الرابط الجديد')
  assert.ok(atlas.includes('queryHydrated'))
  assert.ok(atlas.includes('if (!queryHydrated) return'))
  assert.ok(atlas.includes('setQueryHydrated(true)'))
  assert.ok(atlas.includes("addEventListener('popstate'"))
})

check('شريط البحث العلمي يبدأ من 1 ويتبع 1→2→3 بلا transform jitter', () => {
  assert.ok(paper.includes("useState<ResearchLayer>('layer1')"))
  assert.ok(paper.includes("addEventListener('scroll', handleScroll, { passive: true })"), 'الطبقة النشطة تتبع التمرير بمستمع passive (بلا transform)')
  assert.ok(paper.includes("'research-passport-layer1'"))
  assert.ok(paper.includes("'research-passport-layer2'"))
  assert.ok(paper.includes("'research-passport-layer3'"))
  assert.ok(researchNav.includes('research-section-nav'))
  assert.ok(!researchNav.includes('translate3d'))
  assert.ok(!researchNav.includes('willChange'))
  assert.ok(researchNav.includes('flex flex-1 flex-col items-center py-3'), 'ارتفاع الشريط ثابت بحشوة عمودية موحّدة لا تتغيّر بحالة الطبقة (بدل min-h القديمة)')
})

check('الأرشيف الإعلامي لا يركّب ألف بطاقة دفعة واحدة على الهاتف', () => {
  assert.ok(media.includes('useState(25)'))
  assert.ok(media.includes('filteredMedia.slice(0, visibleCount)'))
  assert.ok(media.includes('visibleMedia.slice(0, 3)') && media.includes('visibleMedia.slice(3)'), 'ثلاث بطاقات بارزة والباقي مجموعات تُعرض من المرئيّ فقط')
  assert.ok(media.includes('media-poster--compact'), 'ملصق مضغوط للبطاقات الصغيرة')
  assert.ok(media.includes('count + 24'))
})

check('رسائل على الهامش تحت المختارات واقتباساتي ليست بنداً في القائمة الرئيسية', () => {
  const curated = ui.indexOf("{ to: '/curated', label: 'المختارات'")
  const inbox = ui.indexOf("{ to: '/inbox', label: 'رسائل على الهامش'")
  assert.ok(curated >= 0 && inbox > curated && inbox - curated < 900)
  assert.ok(!ui.includes("label: 'اقتباساتي'"))
})

check('الجملة المطلوب حذفها من الموسوعة اختفت دون مساس ببوابة الموسوعة', () => {
  assert.ok(!publications.includes('الموسوعة المرئية والكتاب ومواد التدريس في بوابة معرفية واحدة، مع بحث يصل إلى الفصل والصفحة واللحظة الزمنية الموثقة.'))
  assert.ok(bookDetail.includes('EncyclopediaPortal'))
  assert.ok(encyclopediaPortal.includes('export function EncyclopediaPortal'))
  assert.ok(publications.includes('BookTerrain'))
})

check('المراجع والمصطلحات العلمية لها micro-emphasis هادئ مع معجم مركزي', () => {
  assert.ok(articleReader.includes('dr-ahmad-domain-glossary.json'))
  assert.ok(articleReader.includes('canonicalAr'))
  assert.ok(articleReader.includes('reader-reference-term'))
  assert.ok(css.includes('.reader-reference-term'))
  assert.ok(css.includes('@media (hover: hover) and (pointer: fine)'))
})

check('أزرار مشاركة المقال تلتف بأمان ولا تُقص على الهاتف', () => {
  assert.ok(articleDetail.includes('article-share-actions'))
  assert.ok(css.includes('.article-share-actions'))
  assert.ok(css.includes('flex-wrap: wrap'))
})

check('مسارات الطباعة الحالية تحافظ على user activation وتملك عقد A4', () => {
  /* الطباعة مركزية في printSiteContent وتُستدعى مباشرةً من معالج النقر (فيبقى user activation) */
  const printLib = read('src/lib/print.ts')
  assert.ok(articleDetail.includes("onClick={() => { setSerenity(false); window.dispatchEvent(new CustomEvent('reader:close-overlays')); printSiteContent("), 'المقال: الطباعة من نفس النقرة')
  assert.ok(readingShelf.includes('printSiteContent('))
  assert.ok(impact.includes('onClick={() => printSiteContent('))
  assert.ok(printLib.includes('window.print()') && printLib.includes("window.open('', '_blank')"), 'المكتبة: window.print() على سطح المكتب وwindow.open من النقرة نفسها على الجوال')
  assert.ok(ask.includes('print()'))
  assert.ok(css.includes('@page'))
  assert.ok(css.includes('size: A4'))
})

check('مزامنة الصوت تقرأ currentTime الفعلي بإطار العرض أثناء التشغيل', () => {
  assert.ok(persistentAudio.includes('requestAnimationFrame'))
  assert.ok(persistentAudio.includes('el.currentTime'))
  assert.ok(!persistentAudio.includes('500'))
})

check('حقول الهاتف تمنع zoom القسري بلا تعطيل pinch zoom', () => {
  assert.ok(css.includes('font-size: 16px !important'))
  assert.ok(!/user-scalable\s*=\s*no/i.test(html))
  assert.ok(!/maximum-scale\s*=\s*1/i.test(html))
})

check('الحواف والـrails تحترم safe area والـRTL وتُظهر إمكانية السحب', () => {
  assert.ok(css.includes('scroll-padding-inline'))
  assert.ok(css.includes('env(safe-area-inset-left)'))
  assert.ok(css.includes('env(safe-area-inset-right)'))
  assert.ok(css.includes('.atlas-category-rail'))
})

check('ما صنعه القراء paginated ولا يُركّب الأرشيف كله', () => {
  assert.ok(articleDetail.includes('usePagedList(readerMade, 6'))
  assert.ok(articleDetail.includes('readerMadePages.pageItems'))
})

check('واجهة وعد/تحفظ الآلية ليست ضمن صفحات الزائر', () => {
  const visitorSurface = [
    'src/pages/ArticleDetail.tsx', 'src/pages/Articles.tsx', 'src/pages/Home.tsx',
    'src/pages/Search.tsx', 'src/pages/AskLibrary.tsx', 'src/pages/Media.tsx',
    'src/pages/Publications.tsx', 'src/pages/Research.tsx', 'src/pages/PaperDetail.tsx',
    'src/pages/Atlas.tsx', 'src/components/ArticleReader.tsx', 'src/components/IdeaLife.tsx',
  ].map(read).join('\n')
  assert.ok(!visitorSurface.includes('المقياس آليّ من مفردات الوعد والتحفّظ، لا حكم تحريري.'))
})

check('Hero المحمي بقي بالنص والحركات المطلوبة', () => {
  assert.ok(hero.includes('أُبقي <span className="human-core__human">الإنسانَ</span>'))
  assert.ok(hero.includes('في قلبِ الآلة.'))
})

console.log(`\nالنتيجة: ${passed} تحققاً ناجحاً، ${failed.length} إخفاقاً.`)
if (failed.length) {
  console.error(`إخفاقات: ${failed.join(' | ')}`)
  process.exit(1)
}
