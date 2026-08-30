import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { resolve } from 'node:path'
import {
  createArticleVideoProject,
  createPublicVideoProject,
  ensureLiveDirectorPromptVariants,
  getFlowPrompt,
  isValidYouTubeUrl,
  liveDirectorDailyPlan,
  recommendArticleVideoDuration,
  recommendPublicVideoDuration,
  repairLiveDirectorSegment,
  applyReferenceFrame,
  assessReferenceFrame,
  setSegmentContinuity,
  nearMinuteEditPlan,
  liveDirectorPerformanceInsights,
  LIVE_DIRECTOR_REPAIR_ISSUES,
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
// المدة صارت تابعة لمدة المقطع في Flow: خمس عشرة افتراضاً، فثلاثة مقاطع لا ستة.
check(recommendArticleVideoDuration(published).duration === 45 && recommendArticleVideoDuration(published).segments === 3, 'مقالة 350–450 كلمة: ثلاثة مقاطع من خمس عشرة ثانية')
check(recommendArticleVideoDuration(published, 8).duration === 48 && recommendArticleVideoDuration(published, 8).segments === 6, 'المقاس القديم يبقى صحيحاً عند اختيار ثماني ثوانٍ')
check(articleProject.type === 'article_video', 'نوع مشروع المقال')
check(articleProject.articleId === published.slug, 'نقل معرف المقال الصحيح')
check(articleProject.duration === 45, 'مدة مشروع المقال الافتراضية')
check(articleProject.segmentCount === 3, 'ثلاثة مقاطع للمقال')
check(articleProject.days === 1, 'يوم واحد يكفي لثلاثة مقاطع')
check(articleProject.segments.every((segment) => segment.duration === 15), 'كل مقطع خمس عشرة ثانية')
check(liveDirectorDailyPlan(articleProject).every((day) => day.clips.length <= 3), 'ثلاثة مقاطع يومياً')
check(articleProject.narration.split(/\s+/).length < published.body.split(/\s+/).length / 3, 'لا يقرأ المقال كاملاً')
check(articleProject.segments.some((segment) => segment.role.includes('رأي د. أحمد')), 'استخراج موضع رأي د. أحمد')
check(articleProject.segments.length === 3 && articleProject.segments.every((segment) => segment.prompt.length > 200), 'ثلاثة برومبتات مستقلة')

// 12–17: المقال البسيط والمسودة والمحتوى العام والسلسلة.
check(recommendArticleVideoDuration(buildArticle(180)).duration === 30, 'مقال بسيط: مقطعان من خمس عشرة')
const draftProject = createArticleVideoProject({ article: buildArticle(380, 'draft') })
check(draftProject.articleId === 'draft-article', 'تحويل مسودة إلى مشروع')
const publicSimple = createPublicVideoProject({ topic: 'كيف نحافظ على معنى التعلم؟', message: 'ابدأ من الإنسان قبل الأداة', archive: [published], source: 'دراسة تربوية محكمة', sourceSessionId: 'session-1', linkedEditorialDecisionId: 'decision-1' })
check(publicSimple.type === 'public_topic_video', 'إنشاء فيديو عام')
check(publicSimple.duration === 30 && publicSimple.segmentCount === 2, 'ثلاثون ثانية لموضوع عام بسيط')
check(publicSimple.source === 'دراسة تربوية محكمة' && publicSimple.sourceSessionId === 'session-1' && publicSimple.linkedEditorialDecisionId === 'decision-1', 'حفظ مصدر المشروع وروابط منشئه')
const publicComplex = createPublicVideoProject({ topic: 'دراسة ومقارنة أثر الذكاء الاصطناعي', message: Array(70).fill('تحليل').join(' '), archive: [published] })
check(publicComplex.duration === 45 && publicComplex.segmentCount === 3, 'خمس وأربعون ثانية لموضوع يحتاج شرحاً')
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
/* أول فيديو حقيقي (٢٩ أغسطس ٢٠٢٦) أخرج رجلاً أوروبياً مسنّاً في مكتبة
   فيكتورية: القفل كان يفترض أفتاراً يراه النموذج، فلمّا لم يجده اخترع بديلاً.
   القفل الآن يمنع البديل صراحةً ويأمر بإخراج الوجه من الكادر عند غيابه. */
check(/never fall back to a generic professor|never invent/i.test(articleProject.identityLock), 'القفل يمنع اختراع شخص بديل')
check(/keep every human face out of the frame/i.test(articleProject.identityLock), 'غياب الأفتار يعني إخراج الوجه لا اختراعه')
check(articleProject.identityLock.includes('already selected in this generation') && !articleProject.identityLock.includes('upload'), 'قفل الأفتار الجاهز بلا طلب رفع')
check(articleProject.segments.filter((segment) => segment.appearance !== 'visual_only').length <= 3, 'الأفتار لا يتحدث في المقاطع الستة')
check(articleProject.segments.every((segment) => segment.narration.split(/\s+/).length <= (segment.appearance === 'visual_only' ? 14 : 11)), 'منع جملة طويلة داخل مقطع')
check(articleProject.segments.every((segment) => segment.shotCount >= 1 && segment.shotCount <= 3), 'من لقطة إلى ثلاث لقطات')
check(articleProject.segments.every((segment) => /Camera movement: one committed motion per shot[\s\S]*never combine competing moves/.test(segment.prompt)), 'منع حركات كاميرا متنافسة')
check(articleProject.segments.every((segment) => segment.negativeConstraints.includes('Arabic text inside the scene')), 'منع النص العربي المولّد')
check(articleProject.segments.every((segment) => Boolean(segment.flowPrompts?.speech_ar && segment.flowPrompts?.speech_en && segment.flowPrompts?.silent)), 'كل مقطع يملك كلاماً عربياً وكلاماً إنجليزياً ومساراً صامتاً')
const arabicScript = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/
check(articleProject.segments.every((segment) => !arabicScript.test(segment.flowPrompts?.speech_ar || '') && !arabicScript.test(segment.flowPrompts?.speech_en || '') && !arabicScript.test(segment.flowPrompts?.silent || '')), 'برومبتات Flow الثلاثة خالية تماماً من الحروف العربية')
check(articleProject.segments.every((segment) => getFlowPrompt(segment, 'speech_ar').includes('WITH ARABIC SPEECH') && getFlowPrompt(segment, 'speech_en').includes('WITH ENGLISH SPEECH') && getFlowPrompt(segment, 'silent').includes('WITHOUT SPEECH')), 'المسارات الثلاثة واضحة عند النسخ')
check(articleProject.segments.every((segment) => /VISIBLE-TEXT RULE/.test(getFlowPrompt(segment, 'speech_ar')) && /no on-screen text of any kind/i.test(getFlowPrompt(segment, 'speech_en')) && /no on-screen text of any kind/i.test(getFlowPrompt(segment, 'silent'))), 'كل المسارات تمنع أي نص ظاهر داخل الفيديو')
const legacyPromptProject = ensureLiveDirectorPromptVariants({ ...articleProject, segments: articleProject.segments.map(({ flowPrompts: _flowPrompts, ...segment }) => segment) })
check(legacyPromptProject.segments.every((segment) => segment.flowPrompts?.speech_ar && segment.flowPrompts?.speech_en && segment.flowPrompts?.silent), 'المشاريع المحفوظة القديمة تُرقّى تلقائياً للمسارات الثلاثة')

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
check(recommendPublicVideoDuration({ topic: 'اقتباس: التعليم معنى' }).segments === 1, 'دعم الومضة بمقطع واحد')
check(publicSimple.social.articleDecision != null, 'قرار تحويل الفيديو العام إلى مقال')

// 44–71: سلسلة الترابط البصري وخطة النصوص المضافة وإصلاح المقطع الواحد.
// سلسلة الترابط تُختبر على ثماني ثوانٍ: ستة مقاطع تُبقي كل ضمانات التوقيت والأصوات مقيسةً حرفياً.
const chain = createArticleVideoProject({ article: published, useAvatar: true, clipSeconds: 8 })
check(chain.segments[0].continuityMode === 'independent' && chain.segments[0].referenceStrategy === 'none', 'المقطع الأول مشهد مؤسس بلا مرجع')
check(chain.segments.slice(1).every((segment) => segment.referenceSourceClipId === `clip-${segment.order - 1}`), 'كل مقطع يرث مرجعه من سابقه')
const modes = new Set(chain.segments.map((segment) => segment.continuityMode))
check(modes.size >= 3, 'تنويع أنماط الترابط بدل امتداد مباشر متكرر')
check(chain.segments.some((segment) => segment.continuityMode === 'soft'), 'دعم الامتداد البصري اللطيف')
check(chain.segments.some((segment) => segment.continuityMode === 'thematic'), 'دعم الانتقال الموضوعي')
check(chain.segments.some((segment) => segment.continuityMode === 'direct'), 'دعم الامتداد المباشر')
check(chain.segments.every((segment) => segment.prompt.includes('Continuity with the previous clip')), 'البرومبت يحدد نوع الترابط')
check(chain.segments.every((segment) => segment.prompt.includes('Clip start state') && segment.prompt.includes('Clip end state')), 'البرومبت يصف بداية المقطع ونهايته')
check(chain.segments.slice(1).every((segment) => getFlowPrompt(segment, 'speech_ar').split(/\n\n/)[0].startsWith(`CONTINUATION CLIP ${segment.order}`)), 'أول فقرة تعرّف كل مقطع بعد الأول بأنه إكمال للسابق')
check(chain.segments.slice(1).every((segment) => /No reference image upload is required/i.test(getFlowPrompt(segment, 'speech_en').split(/\n\n/)[0])), 'فقرة الإكمال لا تشترط رفع صورة أو ملف مرجعي')

const weak = applyReferenceFrame(chain, 'clip-1', { frameUrl: 'https://example.com/blur.jpg', kind: 'last_frame', sharpness: 0.2 })
check(!weak.applied && weak.project === chain, 'الإطار الضبابي لا يُعتمد تلقائياً')
check(assessReferenceFrame({ sharpness: 0.9 }).usable && !assessReferenceFrame({ sharpness: 0.1 }).usable, 'تقييم صلاحية الإطار المرجعي')

const linked = applyReferenceFrame(chain, 'clip-1', { frameUrl: 'https://example.com/frame.jpg', kind: 'last_frame', sharpness: 0.9 })
check(linked.applied && linked.project.segments[0].lastFrameImage === 'https://example.com/frame.jpg', 'حفظ الإطار الأخير في مقطعه')
check(linked.project.segments[1].selectedReferenceFrame === 'https://example.com/frame.jpg', 'حفظ selectedReferenceFrame في المقطع التالي')
check(linked.project.segments[1].referenceSourceClipId === 'clip-1', 'حفظ referenceSourceClipId')
check(linked.project.segments[1].prompt !== chain.segments[1].prompt, 'إعادة بناء برومبت المقطع التالي وحده')
check(linked.project.segments.slice(2).every((segment, index) => segment.prompt === chain.segments[index + 2].prompt), 'بقية المقاطع لم تُمس عند اعتماد المرجع')
check(/Reference handling: use the optional attached frame for identity, wardrobe, palette and lighting only, not for composition\./.test(linked.project.segments[1].prompt), 'الانتقال الموضوعي يستخدم المرجع للهوية واللون فقط')

const direct = setSegmentContinuity(chain, 'clip-2', { mode: 'direct' })
const withFrame = applyReferenceFrame(direct, 'clip-1', { frameUrl: 'https://example.com/frame.jpg', kind: 'last_frame', sharpness: 0.9 })
check(/Continue from the provided reference frame/.test(withFrame.project.segments[1].prompt), 'الامتداد المباشر يبدأ من الإطار المرجعي')
check(/Do not reset the character pose/.test(withFrame.project.segments[1].prompt), 'تعليمات الامتداد المباشر كاملة')
const soft = setSegmentContinuity(chain, 'clip-3', { mode: 'soft', strategy: 'selected_frame' })
check(/Shift to the requested camera angle smoothly/.test(soft.segments[2].prompt), 'تعليمات الامتداد اللطيف')
const none = setSegmentContinuity(chain, 'clip-2', { strategy: 'none' })
check(/no uploaded frame is required/i.test(none.segments[1].prompt), 'عدم اشتراط رفع مرجع حين لا يناسب')

const disconnected = repairLiveDirectorSegment(withFrame.project, 'clip-2', 'المقطع غير مترابط مع السابق')
check(disconnected.segments[1].continuityMode === 'soft', 'إصلاح عدم الترابط ينزل من المباشر إلى اللطيف')
check(disconnected.segments[1].revisionReason === 'المقطع غير مترابط مع السابق', 'تسجيل سبب التعديل')
check(disconnected.segments[1].promptVersions.length > withFrame.project.segments[1].promptVersions.length, 'حفظ النسخة السابقة قبل الإصلاح')
check(disconnected.segments[0] === withFrame.project.segments[0] && disconnected.segments[3] === withFrame.project.segments[3], 'إصلاح مقطع دون إعادة المشروع كاملاً')

const tooManyAngles = repairLiveDirectorSegment(chain, 'clip-1', 'الزوايا كثيرة')
check(tooManyAngles.segments[0].shotCount < chain.segments[0].shotCount && tooManyAngles.segments[0].shotPlan.length === tooManyAngles.segments[0].shotCount, 'تقليل عدد اللقطات عند كثرة الزوايا')
const lipSync = repairLiveDirectorSegment(chain, 'clip-1', 'مزامنة الفم سيئة')
check(lipSync.segments[0].voiceMode === 'voice_over', 'تحويل الحديث إلى تعليق صوتي عند ضعف مزامنة الفم')
check(LIVE_DIRECTOR_REPAIR_ISSUES.length >= 20 && LIVE_DIRECTOR_REPAIR_ISSUES.includes('الإطار المرجعي غير مناسب'), 'قائمة أسباب الإصلاح كاملة')
check(chain.segments.every((segment) => segment.shotPlan.length === segment.shotCount && segment.shotPlan.at(-1).to === 8), 'خط زمني للقطات يغطي ثماني ثوانٍ')

check(chain.segments.some((segment) => segment.voiceMode === 'avatar_speech'), 'مقطع بحديث مباشر')
check(chain.segments.some((segment) => segment.voiceMode === 'voice_over'), 'مقطع بتعليق صوتي')
check(chain.segments.some((segment) => segment.voiceMode === 'ambient' && !segment.narration), 'مقطع بصري دون كلام')
check(chain.segments.every((segment) => segment.message), 'لكل مقطع معنى واحد محدد')
check(chain.segments.some((segment) => segment.overlayPlan.length > 0), 'خطة النصوص المضافة بعد التوليد')
check(chain.segments.every((segment) => segment.overlayPlan.every((cue) => cue.to <= 8 && cue.from >= 0)), 'توقيت النصوص داخل حدود المقطع')
check(chain.segments.at(-1).overlayPlan.some((cue) => cue.kind === 'رابط' || cue.kind === 'دعوة'), 'الخاتمة تترك مساحة للرابط أو الدعوة')
const outsideQuotes = (prompt) => prompt.replace(/[«“"][^»”"]*[»”"]/g, '')
check(chain.segments.every((segment) => !/[\u0600-\u06FF]/.test(outsideQuotes(segment.prompt))), 'البرومبت إنجليزي عدا الحوار والعنوان بين علامتي اقتباس')
check(chain.quality.continuity === 'ممتاز' || chain.quality.continuity === 'جيد', 'بوابة جودة الترابط')

const near = nearMinuteEditPlan(chain)
check(near.generated === 48 && near.finalTo <= 60 && near.finalFrom >= 55, 'النسخة القريبة من دقيقة: 48 مولدة والباقي تحرير')
check(/المادة المولدة من Flow 48 ثانية/.test(near.statement), 'تصريح صادق بأن الدقيقة ليست كلها من Flow')
// الطاقم: الأفتار لم يعد مفروضاً، و«بلا ناس» منعٌ صريح لا مجرد وصف.
const defaultCast = createArticleVideoProject({ article: published })
check(defaultCast.castMode === 'people' && defaultCast.useAvatar === false, 'الأفتار ليس الافتراض')
check(defaultCast.segments.every((segment) => segment.appearance === 'visual_only'), 'لا ظهور للأفتار بلا طلب صريح')
const avatarCast = createArticleVideoProject({ article: published, castMode: 'avatar' })
check(avatarCast.useAvatar === true && avatarCast.segments.some((segment) => segment.appearance !== 'visual_only'), 'الأفتار يعمل حين يُطلب')
// «ناس في المشهد»: لا يجوز أن يمنع الذيلُ ما أذن به المتن.
const scenePeople = createArticleVideoProject({ article: published, castMode: 'people' })
check(scenePeople.segments.every((segment) => !segment.negativeConstraints.includes('extra characters')), 'ناس في المشهد: لا تناقض بين المتن والقيود')
// «أنا ومعي ناس»: هويته مقفلة، والآخرون مسموحون بشرط ألّا يشبهه أحدهم.
const withPeople = createArticleVideoProject({ article: published, castMode: 'avatar_and_people' })
const withPeoplePrompts = withPeople.segments.map((segment) => Object.values(segment.flowPrompts).join(' ')).join(' ')
check(withPeople.useAvatar === true && withPeople.castMode === 'avatar_and_people', 'أنا ومعي ناس: نسخته تظهر')
check(/Other people may appear in the scene/.test(withPeoplePrompts), 'أنا ومعي ناس: الآخرون مسموحون نصاً')
check(/none of them may resemble that figure/.test(withPeoplePrompts), 'أنا ومعي ناس: منع الشبيه')
check(withPeople.segments.every((segment) => !segment.negativeConstraints.includes('extra characters')), 'أنا ومعي ناس: لا منع للشخصيات الإضافية')
check(avatarCast.segments.every((segment) => segment.negativeConstraints.includes('extra characters')), 'أنا وحدي: منع أي شخص آخر')
check(!/Other people may appear in the scene/.test(avatarCast.segments.map((segment) => segment.prompt).join(' ')), 'أنا وحدي: لا يُسرَّب إذن الآخرين')
const noPeople = createArticleVideoProject({ article: published, castMode: 'no_people' })
const noPeoplePrompts = noPeople.segments.map((segment) => Object.values(segment.flowPrompts).join(' ')).join(' ')
check(noPeople.segments.every((segment) => segment.cast === 'no_people' && segment.appearance === 'visual_only'), 'بلا ناس: لا أفتار في أي مقطع')
check(noPeople.segments.every((segment) => ['people', 'faces', 'hands', 'human silhouettes'].every((ban) => segment.negativeConstraints.includes(ban))), 'بلا ناس: منع بشري صريح في القيود')
check(/Not a face, not a hand/.test(noPeoplePrompts) && /NO-PEOPLE LOCK/.test(noPeoplePrompts), 'بلا ناس: قفل صريح داخل البرومبت')
check(!/IDENTITY —/.test(noPeoplePrompts), 'بلا ناس: لا قفل أفتار مسرَّب')
// الحيوية: العلة كانت «بطاقة بريدية متحركة»؛ القانون الآن مكتوب في كل برومبت.
const kinetic = avatarCast.segments.map((segment) => segment.prompt).join(' ')
/* رفض Flow التوليد: «policies about generating prominent people» — لأن الاسم
   كان مكتوباً في القفل. الأفتار يُختار في اللوحة، فالاسم لا يفيد المولّد. */
const nameLeak = /ahmad|failakawi|أحمد الفيلكاوي/i
const allPrompts = [articleProject, avatarCast, withPeople, noPeople, scenePeople]
  .flatMap((item) => item.segments.flatMap((segment) => [segment.prompt, ...Object.values(segment.flowPrompts)]))
check(allPrompts.every((text) => !nameLeak.test(text)), 'لا اسم حقيقي في أي برومبت يذهب إلى Flow')
check([articleProject, avatarCast, withPeople].every((item) => !nameLeak.test(item.identityLock)), 'لا اسم حقيقي في قفل الهوية')
check(/OPENING RULE/.test(kinetic) && /already mid-event/.test(kinetic), 'قانون الافتتاح: الحدث بدأ قبل الإطار الأول')
check(/Required transformation/.test(kinetic), 'كل مشهد يلزمه تحوّل مرئي لا حالة ساكنة')

/* حارس: اللوحة كانت تطبع «8 ثوانٍ» نصاً مكتوباً باليد بينما المحرك يبني
   مقاطع خمس عشرة — فرأى الدكتور «3 × 8 ثوانٍ» تحت «45 ثانية». الرقم يُقرأ
   من المشروع لا يُكتب. */
const navUi = readFileSync(resolve(ROOT, 'src/components/admin/PublishingStudioNavigation.tsx'), 'utf8')
check(!/8 ثوانٍ/.test(liveUi) && !/× 8 ثوان/.test(liveUi), 'لا مدة مكتوبة باليد في لوحة المخرج الحي')
check(!/8 ثوانٍ/.test(navUi), 'لا مدة مكتوبة باليد في شريط استوديو النشر')
check(/arabicCountPhrase\(segment\.duration, SECOND_FORMS\)/.test(liveUi), 'سطر المقطع يقرأ مدته الحقيقية')
check(/CAST_LABELS\[project\.castMode/.test(liveUi), 'بطاقة المشروع تعرض من يظهر فيه')

/* الزر كان يستدعي buildProject فيبني من النموذج لا من المشروع المعروض،
   فيموت صامتاً على كل مشروعٍ قادم من الأطلس أو من المحفوظات. */
check(/onClick=\{rebuildProject\}/.test(liveUi), 'زر إعادة البناء يستدعي دالته لا بناء النموذج')
check(/const rebuildProject = \(\) => \{[\s\S]{0,400}if \(!project\) return/.test(liveUi), 'إعادة البناء تنطلق من المشروع نفسه')
check(/setRebuildNote\(`أُعيد بناء البرومبتات/.test(liveUi), 'إعادة البناء تُعلن نتيجتها عند الزر')
check(/videoUrl: old\.videoUrl/.test(liveUi), 'ما وُلّد في Flow يُحمل إلى المقطع المقابل')
check(/setCastMode\(item\.castMode/.test(liveUi), 'فتح مشروع محفوظ يضبط منتقي من يظهر على قراره')
check(/data-live-director-rebuild/.test(liveUi), 'شريط تبديل القرار حاضر داخل المشروع لا في النموذج وحده')
check((liveUi.match(/<CastPicker /g) || []).length >= 3, 'منتقي من يظهر في المسارين وداخل المشروع')

check(liveDirectorPerformanceInsights([]).notes[0] === 'لا توجد بيانات كافية بعد.', 'لا استنتاج قبل عينة كافية')
check(/live-director-frames/.test(liveUi) && !/ffmpeg|api\/video|cloudinary/i.test(liveUi), 'استخراج الإطار داخل المتصفح بلا خدمة خارجية')
check(/بلا Flow API|لا Flow API|بلا Flow/.test(liveUi) || !/flow\.google|veo/i.test(liveUi), 'لا استدعاء إلى Flow أو Veo')

// 72–90: صوت د. أحمد — رنين القرّاء ومسبك التغريدات بدل النص المُعلَّب.
const loud = 'المعلم لا يفقد دوره حين تظهر أداة جديدة؛ بل ينتقل من نقل الإجابة إلى بناء السؤال.'
const quieter = 'المدرسة التي تقيس الحفظ وحده ستربح الاختبار وتخسر العقل.'
const richBody = [loud, quieter, 'التقنية تكشف ما في المدرسة ولا تصنعه من عدم.', 'السؤال الحقيقي ليس ماذا تفعل الأداة بل ماذا تفعل بنا.', 'في المقابل تظهر تجربة أخرى تكشف نتيجة مختلفة عن الشائع.'].join(' ')
const richArticle = { ...buildArticle(400), body: richBody, excerpt: 'سؤال يتكرر كل عام ويحتاج جواباً هادئاً لا حماسياً.' }
const injected = {
  resonantLines: [{ text: loud, count: 14 }, { text: quieter, count: 6 }],
  verifiedLine: quieter,
  drafts: [
    { angle: 'core-claim', angleLabel: 'الجملة الحاكمة', text: loud, hashtags: ['#التعليم'], quote: loud, quoteVerified: true, score: 91, resonanceCount: 14 },
    { angle: 'scene', angleLabel: 'مشهد قصير', text: 'طفلٌ يسأل، وشاشةٌ تجيب فوراً. والمعلم كان يسأله: ولماذا تظن ذلك؟', hashtags: ['#المعلم'], quote: '', quoteVerified: false, score: 84 },
    { angle: 'rule', angleLabel: 'قاعدة', text: quieter, hashtags: [], quote: quieter, quoteVerified: true, score: 78 },
    { angle: 'invitation', angleLabel: 'دعوة', text: 'كتبتُ عن هذا السؤال بهدوء. اقرأه ثم اختبره في صفّك.', hashtags: [], quote: '', quoteVerified: false, score: 60 },
  ],
}
const voiced = createArticleVideoProject({ article: richArticle, forge: injected, useAvatar: true })

check(voiced.segments[0].narrationSource === 'resonance' && voiced.segments[0].resonanceCount === 14, 'الخطاف من الجملة التي ظلّلها أكثر القرّاء')
check(voiced.segments.some((segment) => segment.role.includes('رأي') && segment.narrationSource === 'resonance'), 'مقطع الرأي من كلامه المُظلَّل')
check(voiced.segments.every((segment) => !segment.narration || !/^بل\s|\s(?:بل|من|في|إلى|على|عن|أن|و)$/.test(segment.narration)), 'لا تُقطع جملته في منتصف المعنى')
check(new Set(voiced.segments.map((segment) => segment.narration).filter(Boolean)).size === voiced.segments.filter((segment) => segment.narration).length, 'لا تتكرر جملة منطوقة بين مقطعين')
check(voiced.segments.every((segment) => ['resonance', 'verified', 'derived', 'scaffold'].includes(segment.narrationSource)), 'لكل جملة نسبٌ معلوم')

check(voiced.social.x.includes(loud), 'التغريدة من المسبك لا من قالب ثابت')
check(voiced.social.instagram.includes('طفلٌ يسأل'), 'Instagram من زاوية إنسانية مختلفة')
check(voiced.social.linkedin.includes(quieter), 'LinkedIn من زاوية مهنية مختلفة')
check(new Set([voiced.social.x, voiced.social.instagram, voiced.social.linkedin, voiced.social.caption]).size === 4, 'أربع مواد نشر متمايزة')
check(voiced.social.hashtags.length <= 2 && voiced.social.hashtags.includes('#التعليم'), 'وسوم من المسبك لا وسمان ثابتان')
const canned = ['ليست الفكرة أن نضيف أداة جديدة', 'قد تبدو المسألة تقنية', 'جودة القرار لا تُقاس بحداثة الأداة', 'المشكلة ليست في الحدث وحده', 'رأيي أن القرار الجيد يبدأ من الإنسان']
const engineSource = readFileSync(resolve(ROOT, 'src/lib/live-director.ts'), 'utf8')
check(canned.every((phrase) => !engineSource.includes(phrase)), 'حذف الجمل المُعلَّبة من المحرك')

// المشروع بلا رنين ولا مسبك يجب أن يبقى عاملاً — الغياب لا يُفرغ المخرجات.
const bare = createArticleVideoProject({ article: richArticle, useAvatar: true })
check(bare.segments.every((segment) => segment.narrationSource !== 'resonance') && bare.segments.filter((segment) => segment.narration).length === bare.segments.filter((segment) => segment.voiceMode !== 'ambient').length && bare.segments.length >= 3, 'غياب الرنين لا يوقف المشروع')
check(Boolean(bare.social.x && bare.social.instagram && bare.social.linkedin) && new Set([bare.social.x, bare.social.instagram, bare.social.linkedin]).size === 3, 'غياب المسبك يُبقي مواد النشر متمايزة')

// وصلٌ حقيقي بالمسبك نفسه — لا نكتفي بمسودات مصطنعة.
const compile = async (path, replacements = {}) => {
  const source = await readFile(resolve(ROOT, path), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020, strict: true }, fileName: resolve(ROOT, path) })
  let output = result.outputText
  for (const [specifier, url] of Object.entries(replacements)) output = output.replace(specifier, url)
  return `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
}
const glossaryJson = await readFile(resolve(ROOT, 'src/data/dr-ahmad-domain-glossary.json'), 'utf8')
const glossarySource = (await readFile(resolve(ROOT, 'src/lib/dr-ahmad-domain-glossary.ts'), 'utf8'))
  .replace(/^import\s+glossaryData\s+from\s+['\"]\.\.\/data\/dr-ahmad-domain-glossary\.json['\"][^\n]*$/m, `const glossaryData = ${glossaryJson}`)
const glossaryUrl = `data:text/javascript;base64,${Buffer.from(ts.transpileModule(glossarySource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText).toString('base64')}`
const realForge = await import(await compile('src/lib/tweet-forge.ts', {
  './dr-ahmad-domain-glossary': glossaryUrl,
  './voice-echoes': await compile('src/lib/voice-echoes.ts'),
  './resonance-quotes': await compile('src/lib/resonance-quotes.ts'),
  './arabic-count.ts': await compile('src/lib/arabic-count.ts'),
}))
const realDrafts = realForge.buildTweets({ kind: 'article', id: 'a', title: richArticle.title, text: richBody, url: 'https://dr-alfailakawi.com/articles/a', resonantLines: injected.resonantLines }, { count: 8, withHashtags: true })
check(realDrafts.length >= 3, 'المسبك الحقيقي ينتج زوايا متعددة')
const realProject = createArticleVideoProject({
  article: richArticle,
  forge: { drafts: realDrafts.map((draft) => ({ angle: draft.angle, angleLabel: draft.angleLabel, text: draft.text, hashtags: draft.hashtags, quote: draft.quote, quoteVerified: draft.quoteVerified, score: draft.score, resonanceCount: draft.resonanceCount })), verifiedLine: realForge.verifiedLineOf(richBody, richArticle.title), resonantLines: injected.resonantLines },
})
check(new Set([realProject.social.x, realProject.social.instagram, realProject.social.linkedin]).size === 3, 'المسبك الحقيقي يعطي ثلاث مواد متمايزة')
check(realProject.social.x.length > 0 && !realProject.social.x.includes('undefined'), 'نص المسبك الحقيقي سليم')
check(realDrafts.some((draft) => draft.resonanceCount > 0), 'المسبك يكافئ الجمل التي ظلّلها القرّاء')
const liveUiVoice = readFileSync(resolve(ROOT, 'src/components/admin/LiveDirector.tsx'), 'utf8')
check(/buildTweets|verifiedLineOf/.test(liveUiVoice) && /article_highlights/.test(liveUiVoice), 'اللوحة تصل المسبك والرنين فعلاً')
check(/NARRATION_SOURCE_LABELS/.test(liveUiVoice), 'اللوحة تُظهر نسب كل جملة')
check(/كلام عربي/.test(liveUiVoice) && /كلام إنجليزي/.test(liveUiVoice) && /بدون كلام/.test(liveUiVoice) && /getFlowPrompt/.test(liveUiVoice), 'اللوحة تعرض المسارات الثلاثة لكل مقطع')

assert.ok(checks >= 35)
console.log(`✓ المخرج الحي: ${checks}/${checks}`)
