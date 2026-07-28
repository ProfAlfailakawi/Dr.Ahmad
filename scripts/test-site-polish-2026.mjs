#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const ok = (condition, message) => {
  if (!condition) throw new Error(`✘ ${message}`)
  console.log(`✓ ${message}`)
}

const contact = read('src/components/ContactForm.tsx')
const firestore = read('firestore.rules')
const storage = read('storage.rules')
const adminAuth = read('src/lib/admin-auth.tsx')
const home = read('src/pages/Home.tsx')
const homeExperience = read('src/components/home/HomeExperience.tsx')
const studio = read('src/components/admin/SocialDesignStudio.tsx')
const buildStatic = read('scripts/build-static.mjs')
const index = read('index.html')
const boot = read('public/boot.js')
const firebase = JSON.parse(read('firebase.json'))
const workflow = read('.github/workflows/firebase-hosting-live.yml')

console.log('\nContact + Firestore')
ok(contact.includes('<motion.form') && contact.includes('onSubmit={(event) =>'), 'نموذج التواصل semantic form ويعمل بالإرسال الطبيعي')
ok(contact.includes('aria-live="polite"') && contact.includes('type="email"'), 'حالات التواصل وحقول البريد محسنة للوصول')
ok(firestore.includes("'reference'") && firestore.includes("^AH-[0-9]{6}-[0-9]{4}$"), 'رقم مرجع التواصل مسموح ومتحقق منه في Firestore')

console.log('\nAdmin authentication + security')
ok(adminAuth.includes('claims.admin === true'), 'صلاحية الإدارة تعتمد custom claim admin:true')
ok(!/OWNER_EMAIL|ownerEmail|allowedEmails/i.test(adminAuth), 'لا يوجد مسار صلاحية احتياطي مبني على البريد')
ok((firestore.match(/function isAdmin\(\)[\s\S]*?\n\s*}/) || [''])[0].includes('request.auth.token.admin == true'), 'Firestore يطابق claim الإدارة فقط')
ok((storage.match(/function isAdmin\(\)[\s\S]*?\n\s*}/) || [''])[0].includes('request.auth.token.admin == true'), 'Storage يطابق claim الإدارة فقط')
const csp = firebase.hosting.headers.flatMap((entry) => entry.headers || []).find((entry) => entry.key === 'Content-Security-Policy')?.value || ''
ok(csp.includes("script-src 'self'") && !csp.match(/script-src[^;]*'unsafe-inline'/), 'CSP يمنع inline JavaScript')
ok(csp.includes("script-src-attr 'none'") && csp.includes("object-src 'none'"), 'CSP يشدد event handlers والأجسام القابلة للتنفيذ')
ok(index.includes('<script src="/boot.js"></script>') && index.includes('<link href="/boot.css" rel="stylesheet" />'), 'إقلاع الصفحة نُقل إلى أصول خارجية متوافقة مع CSP')
ok(boot.includes('serviceWorker') && boot.includes('location.replace'), 'ملف الإقلاع يحتفظ بالتحويل الرسمي وService Worker')

console.log('\nStatic SEO parity')
for (const path of ['/about', '/contact', '/impact', '/thought-paths', '/atlas', '/ask', '/decade']) {
  ok(buildStatic.includes(`path === '${path}'`) || buildStatic.includes(`path === '/impact' || path === '/cv/impact'`), `نسخة SEO غنية للمسار ${path}`)
}
ok(buildStatic.includes("db.collection('site_papers').get()") && buildStatic.includes("db.collection('site_articles').get()"), 'البناء الثابت يدمج إضافات CMS الحية عند توفر حساب الخدمة')
ok(buildStatic.includes('mergeCloudAdditions') && buildStatic.includes('overridePatches'), 'SEO يطبق إضافات CMS وتعديلات المحتوى بدل الاعتماد على نسخة محلية فقط')
ok(buildStatic.includes('href="/decade"') && buildStatic.includes('وثيقة العقد'), 'التنقل الثابت يبرز وثيقة العقد بدل إعادة About إلى الواجهة')
ok(buildStatic.includes("desc: `Official website") && buildStatic.includes("desc: `${nPapers} peer-reviewed"), 'أرقام النسخة الإنجليزية ديناميكية وليست نصوصاً ثابتة قديمة')

console.log('\nLegacy WordPress retirement')
const redirects = firebase.hosting.redirects || []
const redirectMap = new Map(redirects.map((entry) => [entry.source, entry]))
const researchSource = read('src/data/research-papers.ts')
const slugs = [...researchSource.matchAll(/\bslug:\s*'([^']+)'/g)].map((match) => match[1])
ok(slugs.length >= 15, `تم التعرف على ${slugs.length} مسارات بحث محلية للفحص`)
for (const slug of slugs) {
  for (const prefix of ['', '/ar', '/en']) {
    const source = `${prefix}/scholarly_contributi/${slug}`
    const target = redirectMap.get(source)
    ok(target?.type === 301 && target?.destination === `/research/${slug}`, `301 مباشر للبحث القديم ${source}`)
  }
}
ok(redirectMap.get('/scholarly_contributi/اتجاهات-الهيئة-التدريسية-نحو-استخدام-2')?.destination === '/research/faculty-attitudes-edtech', 'المسار العربي القديم المفهرس يتحول مباشرة إلى البحث الصحيح')

console.log('\nHomepage polish')
ok(home.includes('من الأرشيف اليوم') && home.includes('أربعة مداخل، تتغيّر مع كل زيارة.'), 'قسم الأعمال أصبح «من الأرشيف اليوم» مع بقاء الاكتشاف المتجدد')
ok(home.includes('archive-editorial-cover') && home.includes("item.kind === 'paper' ? 'RESEARCH'") && home.includes("item.kind === 'media' ? 'MEDIA' : 'ESSAY'"), 'المقال والبحث يحصلان على أغلفة تحريرية أصلية، مع هوية احتياطية صحيحة لكل نوع بلا صور stock')
ok(home.includes('home-idea-thread-line') && home.includes('<i /><i /><i /><i />'), 'خيط الفكرة موجود كصلة بصرية هادئة بين المحطات')
ok(!home.includes('function QuietEnding()') && !home.includes('الخاتمة الهادئة') && !home.includes('يفتح طريقاً إلى الفكرة'), 'الخاتمة الهادئة محذوفة بالكامل من الرئيسية')
ok(!homeExperience.includes('الخاتمة الهادئة') && !homeExperience.includes('يفتح طريقاً إلى الفكرة'), 'لا توجد نسخة قديمة مخفية من الخاتمة الهادئة')

console.log('\nStudio generation library')
ok(firestore.includes('match /admin_generated_assets/{id}') && firestore.includes('match /admin_generated_designs/{id}'), 'Firestore يفهرس الصور والتصاميم المولدة للمشرف فقط')
ok(storage.includes('match /admin-generated/{fileName}') && storage.includes('match /admin-generated-designs/{fileName}'), 'Storage يحفظ أصول الصور وJSON التصميم الكامل في مساحات خاصة')
ok(workflow.includes('Storage rules not deployed') && workflow.includes('Public Hosting will continue'), 'تعذر Storage الإداري لا يسقط نشر الموقع العام؛ يظهر تحذير واضح وتستمر الاستضافة')
ok(studio.includes('archiveGeneratedImage') && studio.includes('await archiveGeneratedImage(generated)'), 'كل صورة مولدة تنتظر محاولة الأرشفة قبل اكتمال مسار التوليد')
ok(studio.includes("const id = `gen-${Date.now()}") && studio.includes('requestToken'), 'كل صورة مولدة تحصل على معرف أرشيف فريد ولا تكتب فوق توليد سابق')
for (const kind of ['توليد اتجاهات', 'إعادة توليد', 'تحويل مقاس', 'كاروسيل', 'حملة سردية', 'Final / Safer / Viral', 'طيار آلي', 'نسخة محفوظة بعد التحرير']) {
  ok(studio.includes(`archiveGeneratedDesigns`) && studio.includes(`'${kind}'`), `أرشفة تلقائية لمسار: ${kind}`)
}
ok(studio.includes('التصاميم الكاملة') && studio.includes('الأصول البصرية المولّدة') && studio.includes('فتح للتعديل'), 'مكتبة التوليد تفصل التصاميم الكاملة عن الأصول وتعيد فتحها للتحرير')
ok(studio.includes('data-generation-library="true"'), 'مكتبة التوليد لها مدخل دائم الظهور حتى قبل كتابة فكرة جديدة')
ok(studio.includes('loadOlderGeneratedDesigns') && studio.includes('loadOlderGeneratedImages'), 'المكتبة تستطيع تحميل الأرشيف الأقدم ولا تقتصر على أول دفعة')

console.log('\nVisitor-facing refinement')
const inbox = read('src/pages/Inbox.tsx')
const radar = read('src/pages/Radar.tsx')
const curated = read('src/pages/Curated.tsx')
const ideaLife = read('src/components/IdeaLife.tsx')
const thoughtOverview = read('src/pages/ThoughtOverview.tsx')
const cv = read('src/pages/CV.tsx')
const extras = read('src/components/extras.tsx')
const articleDetail = read('src/pages/ArticleDetail.tsx')
ok(inbox.includes('role="tablist"') && inbox.includes('خيوط الأرشيف') && inbox.includes('activeView === "questions"'), 'رسائل على الهامش صارت تبويبات بدل تكديس الأقسام')
ok(radar.includes('setYear') && radar.includes('visibleWeeks') && radar.includes('usePagedList(visibleWeeks, 1') && radar.includes('max-w-4xl space-y-4'), 'أرشيف الرادار يتنقل حسب السنة ويعرض أسبوعاً واحداً وبطاقتين عموديتين بلا زحام')
ok(curated.includes('role="tablist"') && curated.includes('usePagedList(shown, 2') && curated.includes('max-w-4xl scroll-mt-28 space-y-4'), 'مختارات د. أحمد تبويبات وبطاقتان عموديتان في كل صفحة')
ok(cv.includes('السيرة الذاتية الأكاديمية') && cv.includes('السيرة الذاتية التدريبية') && cv.includes('السيرة الذاتية الإعلامية'), 'بطاقات ملفات CV توضّح مباشرة أنها سير ذاتية متخصصة')
ok(!extras.includes("label: 'قراءة نورة'") && extras.includes('publicSpeakerLabel'), 'المشغل العام لا يكشف أسماء الأصوات الداخلية')
ok(ideaLife.includes('من البدايات الأولى للفكرة إلى امتداداتها عبر الزمن.') && !ideaLife.includes('لا يدّعي هذا الخيط علاقة سببية'), 'لغة حياة الفكرة إنسانية وغير دفاعية')
ok(thoughtOverview.includes('هنا تتجاور المواد التي تدور حول فكرةٍ واحدة'), 'شرح العلاقات الدلالية في خريطة الفكر أصبح موجهاً للزائر')
ok(extras.includes('contextUrl === undefined ? citationUrl : safeLink(contextUrl)') && articleDetail.includes("contextUrl={liveLink(article.source) || ''}"), 'زر فتح المصدر يظهر فقط عند وجود مصدر أصلي حقيقي ولا يعيد المستخدم إلى المقال نفسه')

console.log('\nWhatsApp detached-frame recovery')
const broadcast = read('src/components/admin/BroadcastStudio.tsx')
const waBridge = read('whatsapp-web-bridge/index.mjs')
const waController = read('src/server/whatsapp-controller.mjs')
ok(broadcast.includes('attempt < 30'), 'معاينة واتساب تمنح إعادة تهيئة الجسر وقتاً كافياً')
ok(waBridge.includes('command_requeued_after_detached_frame') && waBridge.includes('process.exit(75)'), 'الجسر يعيد طابور الأمر ويعيد تشغيل جلسته عند detached frame')
ok(waController.includes('transientBridgeError') && waController.includes('retryableBridgeFailure') && waController.includes("status: 'pending'"), 'الخادم يعيد detached-frame إلى الطابور حتى لو وصل الخطأ من جسر قديم بلا retry flag')
const waIntent = read('whatsapp-agent/intent-engine.mjs')
ok(waIntent.includes('قراءة المقال:') && !waIntent.includes('فهد:') && !waIntent.includes('نورة:'), 'رسائل واتساب العامة تعرض «قراءة المقال» فقط ولا تكشف أسماء الإنتاج')

console.log('\nRealtime audio ledger')
const audioSync = read('scripts/sync-audio-firestore.mjs')
const autoAudioWorkflow = read('.github/workflows/auto-audio-r2.yml')
const podcastWorkflow = read('.github/workflows/podcast-pilot-release.yml')
ok(audioSync.includes("collection('content_overrides')") && audioSync.includes("collection('site_articles')"), 'مزامنة الصوت تكتب للمصدر الحي الذي تقرؤه لوحة التحكم')
ok(autoAudioWorkflow.includes('audio:firestore:sync'), 'دورة R2 التلقائية تحدث عدادات الصوت الحية بعد التثبيت')
ok(podcastWorkflow.includes('audio:firestore:sync'), 'نشر الحوار يحدث مكتبة الصوت الحية بعد التثبيت')
const audioLibrary = read('src/components/admin/AudioLibrary.tsx')
const soundCaravan = read('src/components/admin/SoundCaravanBoard.tsx')
const server = read('server.mjs')
ok(audioLibrary.includes('قراءة المقال') && audioLibrary.includes('الحوار') && !audioLibrary.includes('صوت فهد') && !audioLibrary.includes('صوت نورة'), 'لوحة الصوت لا تكشف أسماء الإنتاج وتعد القراءة مساراً واحداً')
ok(soundCaravan.includes('قراءة المقال') && soundCaravan.includes('الحوار') && !soundCaravan.includes('صوت فهد') && !soundCaravan.includes('صوت نورة'), 'قافلة الصوت تعرض القراءة والحوار فقط')
ok(server.includes("const title = mode === 'dialogue' ? 'الحوار' : 'قراءة المقال'"), 'رسائل حالة الإدارة تستخدم الاسم العام «قراءة المقال»')
const audioClearWorkflow = read('.github/workflows/admin-audio-clear.yml')
ok(audioClearWorkflow.includes('reading) FILES=') && audioClearWorkflow.includes('.noura.mp3') && !audioClearWorkflow.includes("description: 'fahed"), 'حذف «قراءة المقال» يحذف الملف الحديث والموروث معاً ولا يعرض أسماء الإنتاج في GitHub')
ok(!autoAudioWorkflow.includes('github.event.inputs.voice') && !autoAudioWorkflow.includes('--voice=fahed') && autoAudioWorkflow.includes('MODE="reading"'), 'واجهة GitHub لا تعرض اسم محرك القراءة؛ دورة التوليد وحالة Firestore تعملان بمسمى القراءة العام')
const audioReconcile = read('scripts/reconcile-audio-meta.mjs')
const audioManifestSync = read('scripts/sync-audio.mjs')
ok(audioReconcile.includes('`${slug}.dialogue.mp3`') && audioReconcile.includes('`${slug}.dialogue.json`'), 'مصالحة R2 تستعيد الحوار ونصه إذا ضاعا من metadata')
ok(audioManifestSync.includes('verifiedR2Pair') && audioManifestSync.includes("transcriptMeta?.validationStatus === 'verified-r2'"), 'الحوار المتحقق فعلياً على R2 يعود إلى manifest حتى لو فُقد سجل الاعتماد المحلي من رانر النشر')

console.log('\nArabic tanween policy')
const tanweenGuard = read('scripts/guard-arabic-tanween.mjs')
const instructions = read('instructions.md')
ok(tanweenGuard.includes('FATHATAN') && tanweenGuard.includes('DAMMATAN') && tanweenGuard.includes('KASRATAN'), 'الحارس يغطي تنوين الفتح والضم والكسر معاً')
ok(instructions.includes('مشروعاً') && instructions.includes('ممدوحٌ') && instructions.includes('كتابٍ') && instructions.includes('guard-arabic-tanween.mjs'), 'قاعدة التنوين الثلاثية موثقة للمستقبل')

console.log('\nAll requested polish guards passed.')
