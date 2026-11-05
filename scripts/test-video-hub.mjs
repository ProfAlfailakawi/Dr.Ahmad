#!/usr/bin/env node
/**
 * مدخل الفيديو والموشن: أربعة مسارات متمايزة، مراحل خمس، وتسليم المادة من الأطلس إلى المسار المختار
 * دون فقد ودون بذرة معلّقة. المنطق نقيّ؛ ربط الواجهة به يُفحص بـtsc وبالبناء.
 */
import assert from 'node:assert/strict'
import {
  VIDEO_PATHS, VIDEO_STAGES, pathById, parseVideoSeed, writeVideoSeed, readVideoSeed, clearVideoSeed,
  reelSeedFor, writeReelSeed, takeReelSeed, directorSeedFor, standaloneSeedFor, VIDEO_SEED_KEY, REEL_SEED_KEY,
} from '../src/lib/video-hub.ts'

let checks = 0
const check = (c, m) => { assert.ok(c, m); checks += 1 }
const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), has: (k) => m.has(k) } }

// 1) المسارات الأربعة بأسماء المستخدم نفسها، وكل منها يفتح وجهة
check(VIDEO_PATHS.map((p) => p.title).join('|') === 'ريل بمشاهد|ريل Flow مرسوم|فيديو منشور متحرك|خطة تصوير للمخرج الحي', 'الأسماء الأربعة كما طُلبت وبالترتيب')
check(new Set(VIDEO_PATHS.map((p) => p.id)).size === 4, 'معرّفات فريدة')
check(VIDEO_PATHS.every((p) => p.tagline && p.input && p.output && p.whoNote && p.actionLabel && p.tab), 'كل مسار يصف مُدخله ومُخرجه ومن يصنع الفيديو')
// 2) الفرق الجوهري: المخرج الحي وحده يولّد المستخدم مقاطعه خارج الموقع
check(VIDEO_PATHS.filter((p) => p.who === 'user-generates-outside').map((p) => p.id).join() === 'director-plan', 'المخرج الحي وحده يعتمد على توليد يدوي خارج الموقع')
const director = pathById('director-plan')
check(director.whoNote.includes('يدوياً') && director.whoNote.includes('خارج الموقع') && director.whoNote.includes('ترفع'), 'وصف المخرج الحي يقول: توليد يدوي خارج الموقع ثم رفع الملفات')
check(pathById('drawn-flow-reel').tagline.includes('لا علاقة له بخدمة Flow'), '«Flow مرسوم» لا يُلتبس بخدمة Flow')
check(VIDEO_PATHS.filter((p) => p.who === 'site-renders').every((p) => !p.whoNote.includes('خارج الموقع')), 'المسارات المرسومة لا تَعِد بشيء خارج الموقع')
// 3) المراحل الخمس بالترتيب المطلوب
check(VIDEO_STAGES.map((s) => s.label).join(' ← ') === 'المصدر ← الخطة ← المعاينة ← الفحص ← التصدير', 'المراحل: المصدر ← الخطة ← المعاينة ← الفحص ← التصدير')
check(VIDEO_STAGES.find((s) => s.id === 'export').note.includes('إن اجتاز الفحص'), 'التصدير لا يَعِد بـ«جاهز» دون فحص')
// 4) بذرة الأطلس: حفظ وقراءة ومسح، وتالفة لا تنهار
const store = memory()
const atlasSeed = { origin: 'atlas', kind: 'paper', slug: 'p1', title: 'أثر التقويم', body: 'متن البحث', excerpt: 'خلاصة', cat: 'بحث' }
check(writeVideoSeed(store, atlasSeed) && store.has(VIDEO_SEED_KEY), 'تُحفظ البذرة')
check(readVideoSeed(store).title === 'أثر التقويم' && readVideoSeed(store).origin === 'atlas', 'تُقرأ كما حُفظت')
clearVideoSeed(store); check(readVideoSeed(store) === null, 'تُمسح')
check(parseVideoSeed('{bad json') === null && parseVideoSeed('{}') === null && parseVideoSeed(null) === null, 'بذرة تالفة أو فارغة → null بلا استثناء')
check(parseVideoSeed(JSON.stringify({ title: 'عنوان فقط' })).body === '', 'عنوان بلا متن مقبول')
check(writeVideoSeed({ getItem: () => null, removeItem() {}, setItem() { throw new Error('quota') } }, atlasSeed) === false, 'تخزين ممتلئ → false لا استثناء')
// 5) تسليم الريل: الوضع من المسار، والبذرة تُستهلك مرة واحدة
const scenes = reelSeedFor(pathById('scenes-reel'), atlasSeed)
const drawn = reelSeedFor(pathById('drawn-flow-reel'), atlasSeed)
check(scenes.mode === 'monteur' && drawn.mode === 'flow' && scenes.title === 'أثر التقويم' && drawn.body === 'متن البحث', 'كل مسار ريل يحمل وضعه ومادة الأطلس')
check(reelSeedFor(pathById('director-plan'), atlasSeed) === null && reelSeedFor(pathById('animated-post'), atlasSeed) === null, 'غير الريل لا يحمل بذرة ريل')
check(reelSeedFor(pathById('scenes-reel'), null).title === '', 'بلا مادة مختارة: وضع فقط')
writeReelSeed(store, drawn)
const taken = takeReelSeed(store)
check(taken.mode === 'flow' && taken.body === 'متن البحث', 'تُستلم')
check(takeReelSeed(store) === null && !store.has(REEL_SEED_KEY), 'ولا تُستلم ثانيةً (لا تعيد ملء حقول المستخدم في زيارة لاحقة)')
store.setItem(REEL_SEED_KEY, JSON.stringify({ mode: 'hack', title: 'x' }))
check(takeReelSeed(store) === null, 'وضع غير معروف يُرفض')
// 6) البذور المشتقة تطابق ما يتوقعه المستقبِلون القائمون
const dir = directorSeedFor(atlasSeed)
check(dir.type === 'article_video' && dir.source === 'atlas:paper' && dir.article.slug === 'p1' && dir.article.body === 'متن البحث', 'بذرة المخرج الحي بشكل الأطلس القائم')
check(directorSeedFor(null) === null, 'بلا مادة لا بذرة')
check(directorSeedFor({ origin: 'manual', title: 'ت', body: 'م' }).article.slug === 'hub-seed', 'مادة يدوية بمعرّف احتياطي')
const post = standaloneSeedFor(atlasSeed)
check(post.idea === 'أثر التقويم' && post.purpose === 'خلاصة', 'بذرة المنشور المستقل: فكرة وغاية')

console.log(`✓ اجتاز مدخل الفيديو والموشن ${checks} فحصاً`)
