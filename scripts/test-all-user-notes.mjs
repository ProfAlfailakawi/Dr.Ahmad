import fs from 'node:fs'
import path from 'node:path'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
let failed = 0
let passed = 0
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`✓ ${name}`)
  } else {
    failed += 1
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const app = read('src/App.tsx')
const ui = read('src/components/ui.tsx')
const knowledgeEntry = read('src/components/KnowledgeEntry.tsx')
const css = read('src/index.css')
const articleDetail = read('src/pages/ArticleDetail.tsx')
const articleReader = read('src/components/ArticleReader.tsx')
const articles = read('src/pages/Articles.tsx')
const listen = read('src/pages/Listen.tsx')
const research = read('src/pages/Research.tsx')
const pagination = read('src/components/Pagination.tsx')
const resonance = read('src/components/ReaderResonance.tsx')
const publications = read('src/pages/Publications.tsx')
const bookDetail = read('src/pages/BookDetail.tsx')
const bookWorld = read('src/components/BookWorld.tsx')
const search = read('src/pages/Search.tsx')
const media = read('src/pages/Media.tsx')
const mediaDetail = read('src/pages/MediaDetail.tsx')
const mySpace = read('src/components/MySpace.tsx')
const readingSpace = read('src/lib/reading-space.ts')
const sync = read('src/lib/myspace-sync.ts')
const quoteImage = read('src/components/QuoteImage.tsx')
const quoteCard = read('src/components/QuoteCard.tsx')
const ideaFeatures = read('src/components/IdeaFeatures.tsx')
const home = read('src/pages/Home.tsx')
const curated = read('src/pages/Curated.tsx')
const inbox = read('src/pages/Inbox.tsx')
const archiveDialogue = read('src/lib/archive-dialogue.ts')
const homeExperience = read('src/components/home/HomeExperience.tsx')
const ask = read('src/pages/AskLibrary.tsx')
const extras = read('src/components/extras.tsx')
const icons = read('src/components/icons.tsx')
const staticBuild = read('scripts/build-static.mjs')
const socialTemplates = read('src/lib/social-templates.ts')
const publishingStudio = read('src/components/admin/PublishingStudio.tsx')

console.log('\nالأساس البصري والأعطاب الصامتة')
check('غلاف الصفحات يستعمل overflow-x-clip ولا يقتل sticky', /signature-page[^\n]+overflow-x-clip/.test(ui))
check('لا يوجد overflow-x-hidden في الواجهات العامة', ![...walk('src/pages'), ...walk('src/components')].filter((file) => !file.includes('/admin/')).some((file) => read(file).includes('overflow-x-hidden')))
check('حارس التوكنات البصرية موجود ومربوط بالبناء', exists('scripts/guard-visual-tokens.mjs') && read('package.json').includes('guard-visual-tokens.mjs'))
check('لا توجد شفافية hair غير مدعومة في الواجهة', !/\b(?:border|bg|text|ring)-hair\/(?:\d+|\[[^\]]+\])/.test([...walk('src')].filter((file) => /\.(?:ts|tsx|css)$/.test(file)).map(read).join('\n')))
check('شريط المقالات sticky بخلفية مصمتة صحيحة', articles.includes('sticky top-16') && articles.includes('bg-canvas/[.92]'))
check('شريط الاستماع sticky بخلفية مصمتة صحيحة', listen.includes('sticky top-16') && listen.includes('bg-canvas/[.92]'))
check('زر مساحتي العائم له خلفية صحيحة', mySpace.includes('bg-canvas/[.92]'))
check('ستائر النوافذ تستعمل تعتيماً مولداً', !/bg-ink\/(?:24|38)\b/.test([articleReader, ideaFeatures, quoteCard, mySpace].join('\n')))
check('لا يوجد maxresdefault في المصدر أو البناء الثابت', ![...walk('src'), ...walk('scripts')].filter((file) => !file.endsWith('test-all-user-notes.mjs')).some((file) => /\.(?:ts|tsx|js|mjs)$/.test(file) && read(file).includes('maxresdefault')))
check('صور YouTube تتحقق من naturalWidth وتملك hq→mq fallback', media.includes('naturalWidth <= 120') && media.includes('mqdefault.jpg') && home.includes('naturalWidth <= 120') && home.includes('/mqdefault.'))
check('البناء الثابت لا يكتب صورة YouTube الرمادية عالية الدقة الوهمية', staticBuild.includes('hqdefault.jpg') && !staticBuild.includes('maxresdefault.jpg'))

console.log('\nالمقالات والقراءة')
check('رأس المقال يضع أدوات القارئ في ReaderControls', articleDetail.includes('<ReaderControls') && articleReader.includes('Aa'))
check('الرمز المكسور ۩ محذوف من القارئ', !articleReader.includes('۩') && !articleDetail.includes('۩'))
check('تلميح تحديد الجملة يظهر مرة واحدة محلياً', articleDetail.includes('reader:selection-hint-seen:v1'))
check('فلاتر المقالات تفصل التصنيفات عن البحث والسنة', articles.includes('overflow-x-auto') && articles.includes('sm:grid-cols-[minmax(0,1fr)_auto_auto]') && articles.includes('استكشف الأرشيف'))
check('ذيل المقال يبقي الأسهم والعناوين ويحذف الكلمات الثلاث المرئية فقط', articleDetail.includes('بعد القراءة') && articleDetail.includes('مشاركة المقال والاستشهاد به') && articleDetail.includes('aria-label="جميع المقالات"') && !articleDetail.includes('<span className="text-ink">السابق:</span>') && !articleDetail.includes('<span className="text-ink">التالي:</span>') && !articleDetail.includes('>جميع المقالات</span>'))
check('إعدادات القارئ لا تكرر الخلفية ولا شرح التشكيل', !articleReader.includes('>الخلفية</p>') && !articleReader.includes('كل المقالات متوفّرة بنص'))
check('الترقيم لا يكرر عبارة الصفحة X من Y', !pagination.includes('الصفحة {page} من') && !pagination.includes('صفحة {page} من'))
check('بصمة القارئ لا تعرض بطاقة إنجاز عند الصفر', resonance.includes('data.articles < 2 && data.sentences === 0'))
check('فتح مادة جديدة يبدأ من الأعلى ويحترم POP والـ anchors', app.includes('RouteScrollManager') && app.includes("navigationType === 'POP'") && app.includes('location.hash') && app.includes('window.scrollTo({ top: 0'))
check('أدوات الاقتباس داخل القارئ أيقونات بلا نصوص صغيرة', articleReader.includes('SocialIcon name="Image"') && articleReader.includes('SocialIcon name="History"') && !/>\s*بطاقة اقتباس\s*</u.test(articleReader))

console.log('\nالأبحاث والكتب')
check('بطاقة البحث تعرض نوع الدراسة فقط كوسم متكرر', research.includes('const type =') && research.includes('{type &&') && !/badge[^\n]+محكّم/u.test(research))
check('المعلومة العامة عن التحكيم والمصادر تظهر مرة أعلى صفحة الأبحاث', research.includes('الأرشيف العلمي المحكّم') && research.includes('بمصادر أصلية'))
check('ISBN لا يظهر في بطاقات المؤلفات ويظل في صفحة الكتاب', !/ISBN|ردمك/u.test(publications) && /ISBN \/ ردمك/u.test(bookDetail))
check('صفحة الكتاب تحمل عالم الكتاب كسولاً عند الاقتراب', bookDetail.includes('LazyBookWorld') && bookDetail.includes('IntersectionObserver') && bookDetail.includes("rootMargin: '700px 0px'"))
check('فهرس الكتاب هرمي بالأبواب والفصول لا جدار بطاقات', bookDetail.includes('groupToc') && bookDetail.includes('<details') && bookDetail.includes('أبوابٌ تُفتح عند الحاجة'))
check('عناوين الفهرس تنتقل إلى المحور نفسه لا إلى البحث', bookDetail.includes('bookKnowledgeAnchor') && bookDetail.includes('#${anchor}') && !bookDetail.includes('book_question=${encodeURIComponent(entry.label)}'))
check('عالم الكتاب يستقبل فكرة الفهرس بعد التحميل الكسول', bookWorld.includes("searchParams.get('book_idea')") && bookWorld.includes('useLocation') && bookWorld.includes('[location.hash, model.knowledge]') && bookWorld.includes('setActiveIdea'))
check('شريط محاور الكتاب صف واحد قابل للسحب RTL', bookWorld.includes('book-spine-rail') && bookWorld.includes('dir="rtl"') && bookWorld.includes('overflow-x-auto') && bookWorld.includes('touch-action:pan-x'))
check('عالم الكتاب يحمي كل الحاويات من خروج الهاتف', css.includes('.content-book-world') && css.includes('max-width: 100%') && css.includes('min-width: 0') && css.includes('overflow-x: clip'))
check('حقل اسأل هذا الكتاب ينكمش داخل الهاتف', /id="ask-book-section"[\s\S]{0,800}min-w-0[\s\S]{0,800}w-full/u.test(bookWorld))
check('فهرس متن الكتاب لا يحمل إلا عند السؤال', bookWorld.includes('loadBookPassages().then') && !bookDetail.includes('loadBookPassages'))
check('فهرس الكتاب لا يستعمل defaultOpen غير المدعوم في React', !bookDetail.includes('defaultOpen=') && bookDetail.includes('<TocDisclosure'))
check('التحميل الكسول لا يضيّق window إلى never في TypeScript', !bookDetail.includes("'IntersectionObserver' in window") && bookDetail.includes("typeof IntersectionObserver === 'undefined'"))

console.log('\nاسأل كتاباً والبحث المعرفي')
check('ابحث في كتاب بوابة مستقلة بلا بطاقة مكررة', knowledgeEntry.includes("/search?tab=askbook") && knowledgeEntry.includes('ابحث في كتاب') && !search.includes('ميزة مستقلة') && !search.includes('اختر كتاباً واحداً، ثم ابحث في متنه الموثق فقط'))
check('بوابة الكتاب تخفي البحث العام وتعمل بلا كتابة مسبقة', search.includes("{tab !== 'askbook' && <FadeUp>") && search.includes("{tab === 'askbook' && <FadeUp") && search.includes("searchStarted && tab !== 'askbook'"))
check('مركز البحث السريع يعرض ابحث في كتاب كمسار ثالث', ui.includes("const bookTo = '/search?tab=askbook'") && ui.includes('grid-cols-3') && ui.includes('ابحث في كتاب'))
check('اختيار الكتاب والسؤال والجواب كلها داخل صفحة البحث', search.includes('ask-book-rail') && search.includes('submitAskBook') && search.includes('searchBookPassages(askBookAsked') && search.includes('الجواب من متن الكتاب'))
check('الجواب يعرض الكتاب والصفحة والمحور ورابطاً اختيارياً', search.includes('match.bookTitle') && search.includes('match.quote.page') && search.includes('match.quote.conceptTitle') && search.includes('في الكتاب'))
check('غياب الدليل لا ينتج جواباً جازماً من خارج الكتاب', search.includes('لن أقدّم جواباً من خارج المتن'))
check('تبويبات البحث قابلة للسحب على الهاتف', search.includes('role="tablist"') && search.includes('overflow-x-auto') && css.includes('.content-search [role="tablist"].rail'))
check('وضع البحث داخل كتاب لا يكرر بوابة طرق البحث أو الشروح المحذوفة', search.includes("{tab !== 'askbook' && <div className=\"px-6 pt-8 md:px-11\">") && !search.includes('البحث داخل كتاب واحد') && !search.includes('اختر كتاباً واكتب ما تبحث عنه؛ تظهر الإجابة من متن الكتاب نفسه.') && !search.includes('اختر كتاباً من كتب الدكتور ثم اكتب سؤالك أو مفهومك.'))
check('كروت اختيار الكتب تعرض العنوان فقط', !search.includes('من كتب الدكتور · ${book.year}') && !search.includes("book.desc ? ` · ${book.desc}`"))
check('السؤال الجاهز يدور ويحفظ ما استُخدم لكل كتاب', search.includes('READY_QUESTION_STORAGE_KEY') && search.includes('nextReadyQuestion') && search.includes('markReadyQuestionUsed') && search.includes('readyQuestionsForBook'))
check('بطاقة جواب الكتاب لا تظهر بلا نتائج', search.includes('askBookMatches.length > 0 && (') && search.includes('askBookMatches.length === 0') && !search.includes('mt-4 rounded-2xl border border-hair bg-wash px-4 py-5'))
check('جملة عدد النتائج عربية سليمة', search.includes("const resultWord = (count: number)") && search.includes("return 'نتيجتان'") && search.includes('نتائج'))
check('تبويب نصوص الكتب واضح للزائر', search.includes("label: 'داخل كتب الدكتور'"))
check('اقتراحات البحث تستبعد الكلمات العامة المربكة', search.includes('SEARCH_SUGGESTION_STOPWORDS') && search.includes("'الدكتور'") && search.includes("'المقال'"))
check('تنقل المقالات صف واحد صغير والعناوين موجودة بلا تسميات زائدة', articleDetail.includes('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]') && !articleDetail.includes('السابق:</span>') && !articleDetail.includes('التالي:</span>') && articleDetail.includes('text-[.6rem]'))
check('متون المقالات القديمة والجديدة مضبوطة المحاذاة', css.includes('.article-body-synced') && css.includes('text-align: justify') && css.includes('text-align-last: start'))

console.log('\nالإعلام ومساحتي')
check('امتداد اللقاء شريط أفقي واحد لا شبكة', mediaDetail.includes('media-related-rail') && mediaDetail.includes('flex snap-x') && mediaDetail.includes('shrink-0 snap-start') && !/media-related-rail[^\n]+grid/u.test(mediaDetail))
check('شريط امتداد اللقاء RTL وقابل للسحب باللمس', mediaDetail.includes('dir="rtl"') && mediaDetail.includes('overflow-x-auto') && mediaDetail.includes('touch-action:pan-x'))
check('شاهد لاحقاً موحد مع مساحتي', readingSpace.includes('MEDIA_SAVED_KEY') && mySpace.includes('savedMedia') && mySpace.includes('MediaSaveButton'))
check('مساحتي منظمة بثلاثة تبويبات', mySpace.includes('متابعة') && mySpace.includes('محفوظاتي') && mySpace.includes('اقتباساتي'))
check('التخزين المحلي افتراضي والمزامنة اختيارية', sync.includes('الوضع المحلي يبقى الافتراضي') && mySpace.includes('فعّل المزامنة'))
check('مزامنة مساحتي مشفرة داخل المتصفح', sync.includes('crypto.subtle.encrypt') && sync.includes('crypto.subtle.decrypt'))
check('يمكن مسح النسخة السحابية دون حذف المحلي', mySpace.includes('امسح النسخة السحابية') && mySpace.includes('لا يحذف ما على هذا الجهاز'))
check('الأزرار العائمة لا تغطي آخر محتوى على الهاتف', css.includes('padding-bottom: calc(5.5rem + env(safe-area-inset-bottom))'))

console.log('\nالصور والأيقونات')
check('بطاقة النشر مدخلها أيقونة فقط', quoteImage.includes('SocialIcon name="Image"') && !/>\s*بطاقة للنشر\s*</u.test(quoteImage))
check('استشهد بهذا مدخله أيقونة فقط', read('src/components/QuoteCite.tsx').includes('SocialIcon name="Cite"') && !/>\s*استشهد بهذا\s*</u.test(read('src/components/QuoteCite.tsx')))
check('تنزيل وإغلاق صورة الاقتباس أيقونات فقط', quoteImage.includes('SocialIcon name="Download"') && quoteImage.includes('SocialIcon name="Close"') && quoteCard.includes('SocialIcon name="Download"') && quoteCard.includes('SocialIcon name="Close"'))
check('كل مسارات صور الاقتباس تدعم iPhone Share Sheet', [quoteImage, quoteCard, ideaFeatures, articleReader].every((text) => text.includes('navigator.share') && /iP\(\?:hone\|ad\|od\)|iP(?:hone|ad|od)/.test(text)))
check('أيقونات الطباعة والتقويم والمشاركة الصغيرة بلا كلمات', icons.includes('Print:') && read('src/pages/Impact.tsx').includes('SocialIcon name="Print"') && read('src/pages/Upcoming.tsx').includes('SocialIcon name="Calendar"') && extras.includes('SocialIcon name={i.icon}'))
check('الأفعال الرئيسية والحساسة ما زالت نصية وواضحة', mySpace.includes('فعّل المزامنة وأنشئ رمزاً') && search.includes('ابحث في الكتاب') && read('src/components/ContactForm.tsx').includes("send: 'إرسال'"))
check('لا توجد أزرار صغيرة مرئية لعبارات بطاقة النشر/استشهد/تحميل/إغلاق', compactActionAudit())

console.log('\nالرئيسية والذيل والتصميم')
check('بطاقات المقالات الرئيسية تستعمل حفظاً ونسخاً موحدين', home.includes('function QuickArticleActions') && count(home, '<QuickArticleActions article=') >= 6)
check('بطاقة في مثل هذا الأسبوع تفصل العنوان عن الأيقونات في سطرين', home.includes('flex min-w-0 flex-col items-start gap-3 text-accent') && home.includes('في مثل هذا الأسبوع') && home.includes('whitespace-nowrap'))
check('الضغط على أدوات البطاقة لا يفتح المقال', home.includes('event.preventDefault(); event.stopPropagation()'))
check('بطاقات المقالات الكاملة لا تكرر اقرأ المقال أو افتح المسار', !/>\s*اقرأ المقال\s*</u.test(home) && !/>\s*افتح المسار\s*</u.test(home))
check('النشرة وتبيان والجدول الدراسي عادت أيقونات دائرية', ui.includes('SocialIcon name="Mail"') && ui.includes('<TebyanProjectLink') && ui.includes('<ScheduleProjectLink') && ui.includes('iconOnly = true'))
check('PROFESSIONAL لم تتغير والخط العربي للمنشور المستقل Alexandria', /PROFESSIONAL/u.test(socialTemplates + publishingStudio) && /المنشور المستقل[\s\S]{0,500}Alexandria/u.test(socialTemplates))
check('صور الإعلام في الرئيسية تفحص الصورة الرمادية', home.includes('function HomeMediaThumb') && homeExperience.includes('function YouTubeThumb') && home.includes('naturalWidth <= 120'))
check('سطر المهنة يمنع الفاصلة من الانفراد', home.includes('QuickArticleActions') && read('src/components/home/HumanCoreHero.tsx').includes('whitespace-nowrap') && read('src/components/home/HumanCoreHero.tsx').includes('أستاذ تكنولوجيا التعليم والذكاء الاصطناعي · باحث · مستشار'))
check('الكروت الديناميكية لا تُعرض عندما تخلو من النتائج', bookWorld.includes('(activeConnections.articles.length > 0 || activeConnections.papers.length > 0)') && curated.includes('if (!items.length) return null') && !curated.includes('سيظهر هنا أحدث ما يلتقطه الرادار'))
check('رسائل على الهامش تغيّر رأسها مع التبويب وتنوّع المصادر', inbox.includes('const pageHead =') && inbox.includes('books, papers, media') && inbox.includes('kind: "كتاب"') && inbox.includes('kind: "بحث"') && inbox.includes('kind: "لقاء"'))
check('خيوط الأرشيف تربط المقال والكتاب والبحث واللقاء', archiveDialogue.includes("kind: 'مقال' | 'كتاب' | 'بحث' | 'لقاء'") && archiveDialogue.includes('buildBookMedia') && archiveDialogue.includes('buildResearchMedia'))

console.log('\nصياغة العقل الحي')
check('لا يقول لم أجد جواباً ثم يعرض جواباً', !ask.includes('لم أجد جواباً مباشراً') && !ask.includes('وهذه أقرب مادة موثّقة'))
check('الإجابة المركبة تصف تعدد المواد والشواهد', ask.includes('إجابة مركّبة من المواد والشواهد الموثّقة'))
check('الجواب غير المؤسس لا يمر كجواب موثق', ask.includes('grounded') && ask.includes('setTwin(fallback)'))
check('طباعة المسار في الواجهة أيقونة فقط', ask.includes('SocialIcon name="Print"') && ask.includes('aria-label="طباعة مسار القراءة"'))


const answerQuality = read('src/components/admin/AnswerQualityLab.tsx')
const intelligenceLab = read('src/components/admin/IntelligenceLab.tsx')
check('مختبر جودة اسأل المكتبة داخلي فقط', answerQuality.includes('داخلي · لا يظهر للزائر') && intelligenceLab.includes('AnswerQualityLab') && !read('src/App.tsx').includes('AnswerQualityLab'))
check('مختبر الجودة يفحص الامتناع واللهجة والمصادر', answerQuality.includes('mustAnswer: false') && answerQuality.includes('toRoot') && answerQuality.includes('أقوى المصادر الحالية'))

console.log(`\nالنتيجة: ${passed} تحققاً ناجحاً، ${failed} إخفاقاً.`)
if (failed) process.exit(1)

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(file))
    else out.push(file)
  }
  return out
}
function count(text, needle) {
  return text.split(needle).length - 1
}
function compactActionAudit() {
  const files = [...walk('src/pages'), ...walk('src/components')].filter((file) => file.endsWith('.tsx') && !file.includes(`${path.sep}admin${path.sep}`))
  const forbidden = ['بطاقة للنشر', 'استشهد بهذا', 'تحميل الصورة', 'نزّل الصورة', 'تنزيل الصورة', 'إغلاق الصورة']
  for (const file of files) {
    const text = read(file)
    for (const match of text.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gu)) {
      const body = match[1].replace(/<[^>]+>/gu, ' ').replace(/\{[^{}]*\}/gu, ' ').replace(/\s+/gu, ' ').trim()
      if (forbidden.some((word) => body === word || body.startsWith(`${word} `))) return false
    }
  }
  return true
}
