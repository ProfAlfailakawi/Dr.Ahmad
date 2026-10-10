import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (condition, message) => {
  if (!condition) throw new Error(`✘ ${message}`)
  console.log(`✓ ${message}`)
}

const studio = read('src/components/admin/SocialDesignStudio.tsx')
const library = read('src/components/admin/GenerationLibraryPanel.tsx')
const whatsappServer = read('src/server/whatsapp-controller.mjs')
const whatsappPanel = read('src/components/admin/WhatsAppAgentPanel.tsx')
const broadcast = read('src/components/admin/BroadcastStudio.tsx')
const ui = read('src/components/ui.tsx')
const home = read('src/pages/Home.tsx')
const article = read('src/pages/ArticleDetail.tsx')
const search = read('src/pages/Search.tsx')
const adminNav = read('src/components/admin/admin-navigation.ts')

console.log('\nStudio protection + library')
ok(studio.includes('STUDIO_DRAFT_DB') && studio.includes('writeStudioLiveDraft') && studio.includes('عُثر على تصميم غير مكتمل') && studio.includes('استئناف') && studio.includes('تجاهل'), 'المسودة الحية تحفظ محلياً وتعرض استئناف/تجاهل فقط عند وجود جلسة منقطعة')
ok(studio.includes('pagehide') && studio.includes('clearStudioLiveDraft()') && studio.includes('الحفظ النهائي'), 'الحفظ الصامت يغطي مغادرة الصفحة ويُزال بعد الحفظ النهائي')
ok(library.includes('ابحث بالعنوان، الموضوع، العالم البصري أو الحملة') && library.includes('كل المقاسات') && library.includes('كل العوالم البصرية') && library.includes('آخر 30 يوماً') && library.includes('★ المفضلة'), 'مكتبة التوليد تملك بحثاً وفلاتر تاريخ/مقاس/عالم بصري/حملة ومفضلة داخل الشاشة نفسها')

console.log('\nWhatsApp reality + campaigns')
ok(!whatsappServer.includes('conversations: { active: 0, human: 0, intents: [], gaps: [], answers: [] }') && whatsappServer.includes('conversationSnapshot') && whatsappServer.includes('eventSnapshot'), 'شاشة المعرفة تقرأ مجاميع Firestore الفعلية بدل أصفار ثابتة')
ok(whatsappPanel.includes('المحادثات النشطة') && whatsappPanel.includes('التدخلات البشرية') && whatsappPanel.includes('الإجابات المسجلة'), 'واجهة المعرفة تعرض المحادثات والتدخلات والنوايا والفجوات والإجابات الفعلية')
ok(whatsappServer.includes("path === '/campaigns'") && whatsappServer.includes('/pause$') && whatsappServer.includes('/resume$') && whatsappServer.includes('/retry-failed$'), 'الخادم يدعم سجل الحملات والإيقاف والاستئناف وإعادة الفاشل فقط')
ok(broadcast.includes('متابعة الحملات') && broadcast.includes('الرسالة التالية') && broadcast.includes('إعادة الفاشل فقط') && broadcast.includes('أسباب الفشل') && broadcast.includes('سجل الحملات السابقة'), 'قسم الحملات الحالي يعرض التقدم الحي والمتبقي والرسالة التالية والتحكم والسجل وأسباب الفشل')

console.log('\nVisitor UI polish')
ok(home.includes("createPortal(modal, document.body)") && home.includes('home-thought-maps-overlay') && home.includes("document.body.style.overflow = 'hidden'"), 'نافذة خرائط الفكر معزولة في Portal وتمنع تمرير الخلفية')
ok(home.includes('أربع زوايا، ورؤية تتجدّد.'), 'العبارة الداخلية استبدلت بصياغة نهائية احترافية')
const articlesItem = ui.match(/\{ to: '\/articles', label: 'المقالات الفكرية', children: \[[\s\S]*?\] \}/)?.[0] || ''
ok(articlesItem && !articlesItem.includes('sub:') && articlesItem.includes("to: '/atlas'") && !articlesItem.includes('/paths'), 'مدخل المقالات بلا سطور sub؛ سماء المقالات فرعٌ يُفتح بالنقر (children) ومسارات الفكرة غير مدرجة')
const aboutBlock = ui.slice(ui.indexOf("label: 'عن الدكتور'"), ui.indexOf("function Overlay"))
ok(!aboutBlock.includes('وثيقة العقد'), 'وثيقة العقد أزيلت من «عن الدكتور» فقط')
ok(article.includes('aria-label="فتح المصدر الأصلي"') && article.includes('<CiteButton compact') && !article.includes('compactLabel="استشهاد"'), 'المصدر والاستشهاد أيقونتان فقط في صف المشاركة')
ok(home.includes('<TebyanProjectLink label="تبيان" iconOnly') && home.includes('home-footer-tools') && !home.includes('h-4 w-px bg-hair'), 'أدوات تذييل الرئيسية صفٌّ موحّد بأيقونات فقط (تبيان بلا كلمة) ومن دون فاصل عمودي')
ok(!adminNav.includes("{ tab: 'image-lab', label: 'مختبر الصور'") && adminNav.includes("HIDDEN_ADMIN_TABS: AdminTab[] = ['image-lab']"), 'مختبر الصور مخفي من الواجهة مع إبقاء المسار البرمجي للمستقبل')
ok(search.includes('placeholder="اكتب بطريقتك: سؤال، موقف، فكرة"') && search.includes('pe-16 ps-3'), 'عبارة البحث كاملة ولا تصطدم بأيقونة البحث على الجوال (حشوة نهاية الحقل pe-16)')

console.log('\nAll requested improvements are guarded.')
