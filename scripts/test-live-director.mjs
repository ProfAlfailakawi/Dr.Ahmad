import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createArticleVideoProject,
  createPublicVideoProject,
  isValidYouTubeUrl,
  liveDirectorDailyPlan,
  recommendArticleVideoDuration,
  recommendPublicVideoDuration,
  repairLiveDirectorSegment,
} from '../src/lib/live-director.ts'

const ROOT = resolve(import.meta.dirname, '..')
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

const meta = (kind, slug) => ({ kind, origin: 'base', modified: false, hidden: false, deleted: false, docId: slug, baseSlug: slug })
const buildArticle = (words, status = 'published') => ({
  slug: status === 'draft' ? 'draft-article' : 'published-article',
  title: 'مستقبل المعلم في زمن الذكاء الاصطناعي',
  date: '1 أغسطس 2026', iso: '2026-08-01', cat: 'التعليم',
  excerpt: 'المعلم لا يفقد دوره حين تظهر أداة جديدة؛ بل ينتقل من نقل الإجابة إلى بناء السؤال والحكم على معناها.',
  body: Array.from({ length: words }, (_, index) => index % 19 === 0 ? 'المعلم.' : index % 13 === 0 ? 'الطالب' : 'التعليم').join(' '),
  status, words, year: '2026', hasAudio: false, missing: false, _cms: meta('article', status === 'draft' ? 'draft-article' : 'published-article'),
})

const published = buildArticle(400)
const articleProject = createArticleVideoProject({ article: published, useAvatar: true })

// 1–11: مسار المقال.
check(recommendArticleVideoDuration(published).duration === 48, 'مقالة 350–450 كلمة يجب أن توصى بـ48 ثانية')
check(articleProject.type === 'article_video', 'نوع مشروع المقال')
check(articleProject.articleId === published.slug, 'نقل معرف المقال الصحيح')
check(articleProject.duration === 48, 'مدة مشروع المقال الافتراضية')
check(articleProject.segmentCount === 6, 'ستة مقاطع للمقال')
check(articleProject.days === 2, 'تقسيم يومين')
check(articleProject.segments.every((segment) => segment.duration === 8), 'كل مقطع 8 ثوانٍ')
check(liveDirectorDailyPlan(articleProject).every((day) => day.clips.length <= 3), 'ثلاثة مقاطع يومياً')
check(articleProject.narration.split(/\s+/).length < published.body.split(/\s+/).length / 3, 'لا يقرأ المقال كاملاً')
check(articleProject.segments.some((segment) => segment.role.includes('رأي د. أحمد')), 'استخراج موضع رأي د. أحمد')
check(articleProject.segments.length === 6 && articleProject.segments.every((segment) => segment.prompt.length > 200), 'ستة برومبتات مستقلة')

// 12–17: المقال البسيط والمسودة والمحتوى العام والسلسلة.
check(recommendArticleVideoDuration(buildArticle(180)).duration === 24, 'مقال بسيط يوصى بـ24 ثانية')
const draftProject = createArticleVideoProject({ article: buildArticle(380, 'draft') })
check(draftProject.articleId === 'draft-article', 'تحويل مسودة إلى مشروع')
const publicSimple = createPublicVideoProject({ topic: 'كيف نحافظ على معنى التعلم؟', message: 'ابدأ من الإنسان قبل الأداة', archive: [published], source: 'دراسة تربوية محكمة', sourceSessionId: 'session-1', linkedEditorialDecisionId: 'decision-1' })
check(publicSimple.type === 'public_topic_video', 'إنشاء فيديو عام')
check(publicSimple.duration === 24 && publicSimple.segmentCount === 3, '24 ثانية لموضوع عام بسيط')
check(publicSimple.source === 'دراسة تربوية محكمة' && publicSimple.sourceSessionId === 'session-1' && publicSimple.linkedEditorialDecisionId === 'decision-1', 'حفظ مصدر المشروع وروابط منشئه')
const publicComplex = createPublicVideoProject({ topic: 'دراسة ومقارنة أثر الذكاء الاصطناعي', message: Array(70).fill('تحليل').join(' '), archive: [published] })
check(publicComplex.duration === 48 && publicComplex.segmentCount === 6, '48 ثانية لموضوع يحتاج شرحاً')
const publicSeries = createPublicVideoProject({ topic: 'كل ما يتعلق بمستقبل التعليم وأسبابه ونتائجه وحلوله', wantsSeries: true, archive: [published] })
check(publicSeries.series && publicSeries.seriesPlan.length >= 5, 'تحويل الموضوع الكبير إلى سلسلة')

// 18–27: المنصات، الأفتار، اللقطات والقيود.
check(Boolean(articleProject.social.x), 'إنشاء تغريدة')
check(Boolean(articleProject.social.instagram), 'إنشاء Instagram')
check(Boolean(articleProject.social.linkedin), 'إنشاء LinkedIn')
check(new Set([articleProject.social.x, articleProject.social.instagram, articleProject.social.linkedin]).size === 3, 'عدم تكرار نص المنصات')
check(articleProject.segments.some((segment) => segment.appearance !== 'visual_only'), 'فيديو بأفتار')
const withoutAvatar = createPublicVideoProject({ topic: 'سؤال تربوي واحد', message: 'كيف نبني الفهم؟', useAvatar: false })
check(withoutAvatar.segments.every((segment) => segment.appearance === 'visual_only'), 'فيديو من دون أفتار')
check(articleProject.identityLock.includes('pre-saved avatar') && !articleProject.identityLock.includes('upload'), 'قفل الأفتار الجاهز بلا طلب رفع')
check(articleProject.segments.filter((segment) => segment.appearance !== 'visual_only').length <= 3, 'الأفتار لا يتحدث في المقاطع الستة')
check(articleProject.segments.every((segment) => segment.narration.split(/\s+/).length <= (segment.appearance === 'visual_only' ? 14 : 11)), 'منع جملة طويلة داخل مقطع')
check(articleProject.segments.every((segment) => segment.shotCount >= 1 && segment.shotCount <= 3), 'من لقطة إلى ثلاث لقطات')
check(articleProject.segments.every((segment) => /Camera movement: one restrained motion per shot/.test(segment.prompt)), 'منع حركات كاميرا متنافسة')
check(articleProject.segments.every((segment) => segment.negativeConstraints.includes('Arabic text inside the scene')), 'منع النص العربي المولّد')

// 28: إصلاح مقطع واحد فقط.
const beforeRefs = [...articleProject.segments]
const repaired = repairLiveDirectorSegment(articleProject, 'clip-2', 'المشهد مزدحم')
check(repaired.segments[1].promptVersions.length === 2, 'إنشاء نسخة إصلاح للمقطع')
check(repaired.segments[0] === beforeRefs[0] && repaired.segments[2] === beforeRefs[2], 'عدم تغيير باقي المقاطع')

// 29–35: الرفع، الرابط، الحفظ، RTL، سلامة الأنظمة، وعدم وجود خدمة مدفوعة.
const liveUi = readFileSync(resolve(ROOT, 'src/components/admin/LiveDirector.tsx'), 'utf8')
const studioUi = readFileSync(resolve(ROOT, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const roomUi = readFileSync(resolve(ROOT, 'src/components/admin/DrAhmadRoom.tsx'), 'utf8')
const firestoreRules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8')
const storageRules = readFileSync(resolve(ROOT, 'storage.rules'), 'utf8')
const askLibrary = readFileSync(resolve(ROOT, 'src/pages/AskLibrary.tsx'), 'utf8')
check(/accept="video\/mp4,video\/webm,video\/quicktime"/.test(liveUi), 'رفع مقطع فيديو بأنواع مقيدة')
check(isValidYouTubeUrl('https://www.youtube.com/watch?v=abc123') && !isValidYouTubeUrl('https://evil.example/video'), 'التحقق من رابط YouTube')
check(/admin_live_director_projects/.test(liveUi) && /admin_live_director_projects/.test(firestoreRules), 'حفظ واسترجاع المشروع Admin-only')
check(/dir="rtl"/.test(studioUi) && /sm:|md:|lg:|xl:/.test(liveUi), 'RTL والهاتف والتجاوب')
check(askLibrary.includes('/api/ai/archive-answer') && studioUi.includes('buildMultimodalMeaningCourt'), 'عدم كسر العقل الحي ومحكمة المعنى')
check(studioUi.includes('PublishingStudioNavigation') && studioUi.includes("view === 'idea'") && studioUi.includes("view === 'distribution'"), 'عدم كسر استوديو النشر')
check(!/generateVideo|veo:generate|flow:generate|api\/ai\/video|fetch\([^)]*(?:flow|veo)/i.test(liveUi), 'عدم إضافة خدمة فيديو مدفوعة')
check(/admin-live-director/.test(storageRules) && /220 \* 1024 \* 1024/.test(storageRules), 'حد النوع والحجم في Storage')
check(/ماذا تريد أن تنجز اليوم يا د\. أحمد/.test(roomUi), 'غرفة د. أحمد تعرض السؤال الرئيسي')
check(recommendPublicVideoDuration({ topic: 'اقتباس: التعليم معنى' }).duration === 8, 'دعم ومضة 8 ثوانٍ')
check(publicSimple.social.articleDecision != null, 'قرار تحويل الفيديو العام إلى مقال')

assert.ok(checks >= 35)
console.log(`✓ المخرج الحي: ${checks}/${checks}`)
