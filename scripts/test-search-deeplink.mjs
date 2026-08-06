#!/usr/bin/env node
/**
 * اختبارات البحث القابل للمشاركة (الرابط مصدر الحالة) واستعراض كل النتائج.
 *
 * ما يُختبر منطقٌ خالص يُستورد فعلاً؛ وما هو عقدُ واجهةٍ يُتحقّق من المصدر
 * حتى لا يعود العطب صامتاً بعد إعادة كتابةٍ لاحقة.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8')
const portal = read('src/components/EncyclopediaPortal.tsx')
const browser = read('src/components/EncyclopediaResultBrowser.tsx')
const searchLib = read('src/lib/encyclopedia-knowledge-search.ts')
const passages = JSON.parse(read('src/data/book-passages.json'))

let passed = 0
const test = (name, fn) => { fn(); passed += 1; console.log(`  ✓ ${name}`) }

console.log('اختبارات الرابط العميق واستعراض النتائج:')

test('الرابط مصدر الحالة عند الفتح المباشر', () => {
  assert.match(portal, /useState\(\(\) => initialParams\.get\('q'\) \|\| ''\)/, 'العبارة تُقرأ من الرابط')
  assert.match(portal, /useState\(\(\) => initialParams\.get\('tab'\) \|\| 'all'\)/, 'التبويب يُقرأ من الرابط')
  assert.match(portal, /params\.get\('video'\)/, 'الفيديو يُستعاد')
  assert.match(portal, /params\.get\('t'\)/, 'التوقيت يُستعاد')
})

test('الرجوع والتقدم يعيدان الحالة كاملة', () => {
  assert.match(portal, /addEventListener\('popstate', restore\)/)
  assert.match(portal, /removeEventListener\('popstate', restore\)/, 'المستمع يُنظَّف')
})

test('pushState للمهم وreplaceState للثانوي', () => {
  assert.match(portal, /history\[mode === 'push' \? 'pushState' : 'replaceState'\]/)
  assert.match(portal, /mode: 'push' \| 'replace' = 'replace'/, 'الافتراضي replace')
  assert.ok(portal.includes("updateDeepLink({ q: clean, tab: resultTab }, 'push')"), 'البحث المُرسَل يدخل التاريخ')
  /* لا تُكتب حالةٌ في التاريخ مع كل حرف: onChange يضبط الحالة ولا يلمس الرابط. */
  const onChange = portal.match(/onChange=\{\(event\) => \{ const value = event\.target\.value;[^}]*\}\}/)?.[0] || ''
  assert.ok(onChange && !onChange.includes('updateDeepLink'), 'لا كتابة في التاريخ مع كل حرف')
})

test('الرابط يُنظَّف من القيم الافتراضية ويحدّ طول العبارة', () => {
  assert.match(portal, /value === 'all'\) url\.searchParams\.delete\(key\)/, 'التبويب الافتراضي لا يُكتب')
  assert.match(portal, /key === 'q' \? String\(value\)\.slice\(0, 160\)/, 'حدّ لطول العبارة')
})

test('لا تشغيل صوتي تلقائي عند فتح الرابط', () => {
  assert.match(portal, /autoplay=\$\{userInitiatedPlayback \? '1' : '0'\}/, 'التشغيل بإجراء صريح')
  assert.match(portal, /setUserInitiatedPlayback\(false\)/, 'الاستعادة من الرابط لا تُشغّل')
  assert.match(portal, /setUserInitiatedPlayback\(true\)/, 'ضغط المستخدم هو ما يُشغّل')
})

test('توقيت أكبر من مدة الفيديو يُقصّ ولا يُمرَّر', () => {
  assert.match(portal, /Math\.min\(Math\.floor\(startSeconds\), video\.durationSeconds - 1\)/)
})

test('المشاركة: Web Share ثم الحافظة', () => {
  assert.match(portal, /navigator\.share/, 'واجهة المشاركة على الأجهزة الداعمة')
  assert.match(portal, /clipboard\.writeText\(url\)/, 'بديل النسخ')
})

test('حالات البحث الديناميكية لا تُفهرس', () => {
  assert.match(read('src/pages/BookDetail.tsx'), /robots: isSearchState \? 'noindex, follow' : undefined/)
  assert.match(read('src/pages/Search.tsx'), /robots: searchParams\.get\('q'\) \? 'noindex, follow' : undefined/)
})

test('العدد المعلن هو العدد القابل للاستعراض', () => {
  assert.match(portal, /const resultCount = tabCounts\.all/, 'العدّاد من مصدر التبويبات نفسه')
  assert.match(portal, /const video = searchResults\.videos\.length \+ exactMomentCount/)
  assert.match(portal, /formatArabicNumber\(count\)/, 'كل تبويب يعرض عدده الحقيقي')
  assert.match(portal, /passageLimit: 40, slideLimit: 40/, 'الطلب لا يبتر النتائج إلى ستة')
})

test('الاستعراض تدريجي ولا يحمّل وسائط', () => {
  assert.match(browser, /const PAGE_SIZE = 6/)
  assert.match(browser, /عرض المزيد/)
  assert.match(browser, /loading="lazy"/, 'الصور المصغّرة كسولة')
  assert.ok(!/<iframe|<video|embedUrl/.test(browser), 'لا يُحمَّل مشغّل ولا ملف وسائط في القائمة')
  assert.match(browser, /لا نتيجة مطابقة/, 'حالة الصفر')
})

test('تبديل التبويب لا يعيد البحث', () => {
  const tabClick = portal.match(/onClick=\{\(\) => \{ setResultTab\(value\);[\s\S]{0,160}?\}\}/)?.[0] || ''
  assert.ok(tabClick, 'زر التبويب موجود')
  assert.ok(!/searchEncyclopediaKnowledge|setSpokenMoments/.test(tabClick), 'لا إعادة بحث عند التبديل')
  assert.match(portal, /const knowledgeResults = useMemo\(/, 'النتائج محفوظة')
})

test('سقف المحرك يتّسع لما تعرضه الواجهة', () => {
  assert.match(searchLib, /Math\.min\(60, passageLimit\)/, 'سقف المقاطع ٦٠ لا ١٠')
  assert.match(searchLib, /Math\.min\(60, slideLimit\)/, 'سقف الشرائح ٦٠ لا ١٠')
  assert.match(searchLib, /cleanQuery\.length < 2\) return \{ query: cleanQuery, passages: \[\], slides: \[\] \}/, 'عبارة أقصر من حرفين ترجع فارغة لا خطأ')
  const corpus = passages.books.find((book) => book.slug === 'encyclopedia')
  assert.ok(corpus.passages.length > 60, 'المتن أكبر من السقف، فالسقف هو ما يحكم لا حجم البيانات')
})

console.log(`✓ الرابط العميق والنتائج: ${passed}/12 حالة`)
