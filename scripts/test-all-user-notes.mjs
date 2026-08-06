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
const articleSignal = read('src/components/ArticlePivot.tsx')
const publications = read('src/pages/Publications.tsx')
const homePage = read('src/pages/Home.tsx')
const bookDetail = read('src/pages/BookDetail.tsx')
const bookWorld = read('src/components/BookWorld.tsx')
const encyclopediaPortal = read('src/components/EncyclopediaPortal.tsx')
const encyclopediaVideoIndex = read('src/lib/encyclopedia-video-index.ts')
const encyclopediaVideoClient = read('src/lib/encyclopedia-videos.ts')
const encyclopediaVideoServer = read('src/server/encyclopedia-videos.mjs')
const encyclopediaTeachingMap = read('src/lib/encyclopedia-teaching-map.ts')
const encyclopediaTeachingData = JSON.parse(read('src/data/encyclopedia-teaching-map.json'))
const encyclopediaKnowledgeResults = read('src/components/EncyclopediaKnowledgeResults.tsx')
const encyclopediaBuzzImporter = read('scripts/lib/encyclopedia-buzz-transcripts.mjs')
const encyclopediaTranscriptData = JSON.parse(read('src/data/encyclopedia-video-transcripts.json'))
const dockerfile = read('Dockerfile')
const gcloudignore = read('.gcloudignore')
const gitignore = read('.gitignore')
const nodeServer = read('server.mjs')
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
const editorialLetters = read('src/lib/editorial-letters.ts')
const liveDirector = read('src/lib/live-director.ts')
const liveDirectorUi = read('src/components/admin/LiveDirector.tsx')
const archiveDialogue = read('src/lib/archive-dialogue.ts')
const homeExperience = read('src/components/home/HomeExperience.tsx')
const ask = read('src/pages/AskLibrary.tsx')
const extras = read('src/components/extras.tsx')
const icons = read('src/components/icons.tsx')
const staticBuild = read('scripts/build-static.mjs')
const socialTemplates = read('src/lib/social-templates.ts')
const publishingStudio = read('src/components/admin/PublishingStudio.tsx')
const content = read('src/lib/content.ts')
const serviceWorker = read('public/sw.js')
const indexHtml = read('index.html')
const smartSearch = read('src/lib/smart-search.ts')
const bookQuotesSearch = read('src/lib/book-quotes.ts')
const bookKnowledgeSearch = read('src/lib/book-knowledge.ts')
const knowledgeGraphSearch = read('src/lib/knowledge-graph.ts')
const knowledgeFingerprint = read('src/components/KnowledgeFingerprint.tsx')
const impactMap = read('src/components/ImpactMap.tsx')
const cvPage = read('src/pages/CV.tsx')
const arabicCount = read('src/lib/arabic-count.ts')
const thoughtOverview = read('src/pages/ThoughtOverview.tsx')
const paperDetail = read('src/pages/PaperDetail.tsx')
const conceptLife = read('src/pages/ConceptLife.tsx')
const radar = read('src/pages/Radar.tsx')

const rawCountPattern = /(?:\$\{([^}\n]+)\}|\{([^}\n]+)\})\s*(?:<\/(?:strong|span|b)>\s*)?(?:مقال(?:اً|ة|ات)?|بحث(?:اً|ان|ين|ون)?|كتاب(?:اً|ان|ين|ات)?|باب(?:اً|ان|ين)?|سنة|سنوات|حلقة|حلقات|ساعة|ساعات|مداخلة|مداخلات|طبقة|طبقات|قطعة|قطع|بطاقة|بطاقات|لفظ(?:اً|ان|ين)?|ألفاظ|مشترك(?:اً|ان|ين|ون)?|رد(?:اً|ان|ين|ود)?|كلمة|كلمات|فقرة|فقرات|صفحة|صفحات|مادة|مواد|دقيقة|دقائق|ثانية|ثوانٍ|يوم|أيام|أسبوع|أسابيع|ملف|ملفات|جهة|جهات|مشكلة|مشكلات|تنبيه|تنبيهات|قاعدة|قواعد|محادثة|محادثات|مجموعة|مجموعات|رقم|أرقام|حالة|حالات|صورة|صور|نسخة|نسخ|اتجاه|اتجاهات|مصدر|مصادر|رابط|روابط|جملة|جمل|قرار|قرارات|نقطة|نقاط|مشهد|مشاهد|تغريدة|تغريدات|مشاركة|مشاركات|مشاهدة|مشاهدات|قراءة|قراءات|نص|نصوص|خانة|خانات|عنقود(?:اً|ان|ين)?|مقالة|مقالات|جهاز|أجهزة)/u
function rawDynamicCountLines() {
  const files = [
    ...walk('src').filter((file) => /\.(?:ts|tsx|js|mjs)$/.test(file)),
    'server.mjs',
    ...walk('whatsapp-agent').filter((file) => /\.(?:js|mjs)$/.test(file) && !/(?:self-test|nuclear)/.test(file)),
  ]
  return files.flatMap((file) => read(file).split(/\r?\n/).flatMap((line, index) => {
    if (line.includes('arabicCountPhrase') || line.includes('arabicCountLabel')) return []
    const match = line.match(rawCountPattern)
    if (!match) return []
    const expression = String(match[1] || match[2] || '')
    return /length|count|Count|total|Total|words|Words|views|Views|number|Number|years|hours|minutes|seconds|files|devices|subscriber|silenced|poll|articles|papers|books|rows|queue|turns|assets|blocking|issue/.test(expression)
      ? [`${file}:${index + 1}`]
      : []
  }))
}

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


check('حارس التوكنات يقبل البصمة بعد تحويل الشفافية إلى قيمة اعتباطية', knowledgeFingerprint.includes('border-accent/[.15]') && !knowledgeFingerprint.includes('border-accent/15'))
check('البصمة المعرفية باقية في السيرة ولا تتكرر في الرئيسية', cvPage.includes('<KnowledgeFingerprint feature />') && !home.includes('KnowledgeFingerprint'))
check('مساحتي تحذف كلمة إدارة وتحسب عدد القراءات المعروضة فعلياً', !mySpace.includes('>إدارة<') && mySpace.includes('Math.min(8, snapshot.recent.length)') && mySpace.includes('snapshot.recent.slice(0, 8)'))
check('عداد الصوت يوحّد فهد ونورة ويضيف الحوار مستقلاً', impactMap.includes("replace(/\\.noura\\.mp3$/u, '')") && impactMap.includes("file.endsWith('.dialogue.mp3')") && impactMap.includes('if (bucket.standard)') && impactMap.includes('if (bucket.dialogue)'))
check('صياغة العدد والمعدود مركزية وتشمل أبواب المعرفة', arabicCount.includes("few: 'أبواب معرفية'") && impactMap.includes('arabicCountLabel(stats.categories, CATEGORY_FORMS)'))
check('العدادات العامة لا تعود إلى صيغ خام خاطئة', !paperDetail.includes('{evidenceCount} أدلة') && !paperDetail.includes('{dataCards.length} أبعاد') && !bookDetail.includes('{group.entries.length} فصول') && !conceptLife.includes('{evolution.years} سنة') && !radar.includes('{arNum(items.length)} مادة') && !thoughtOverview.includes('{number.format(period.count)} مادة'))
check('لا يبقى عداد ديناميكي خام قبل اسم عربي في الواجهة أو الخادم أو الوكيل', rawDynamicCountLines().length === 0, rawDynamicCountLines().slice(0, 5).join('، '))

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
check('اختيار الكتاب والسؤال والجواب كلها داخل صفحة البحث', search.includes('ask-book-rail') && search.includes('submitAskBook') && search.includes('searchBookPassages(askBookAsked') && search.includes('الجواب من الكتاب'))
check('البحث يحمّل فهرس متون الكتب التسعة ويستعمله في البحث العام والكتاب والعقل الحي', bookQuotesSearch.includes("import('../data/book-passages.json')") && bookQuotesSearch.includes('searchBookPassages') && search.includes('loadBookPassages') && bookWorld.includes('searchBookPassages(asked') && ask.includes('searchBookPassages(asked'))
check('الجواب يعرض الكتاب والصفحة والمحور دون رابط لفتح الكتاب', search.includes('match.bookTitle') && search.includes('match.quote.page') && search.includes('match.quote.conceptTitle') && !search.includes('في الكتاب ←') && !search.includes('افتح صفحة الكتاب'))
check('غياب الدليل لا ينتج جواباً جازماً من خارج الكتاب', search.includes('لن أختلق جواباً من خارجه'))
check('تبويبات البحث قابلة للسحب على الهاتف', search.includes('role="tablist"') && search.includes('overflow-x-auto') && css.includes('.content-search [role="tablist"].rail'))
check('وضع البحث داخل كتاب لا يكرر بوابة طرق البحث أو الشروح المحذوفة', search.includes("{tab !== 'askbook' && <div className=\"px-6 pt-8 md:px-11\">") && !search.includes('البحث داخل كتاب واحد') && !search.includes('اختر كتاباً واكتب ما تبحث عنه؛ تظهر الإجابة من متن الكتاب نفسه.') && !search.includes('اختر كتاباً من كتب الدكتور ثم اكتب سؤالك أو مفهومك.'))
check('كروت اختيار الكتب تعرض العنوان فقط', !search.includes('من كتب الدكتور · ${book.year}') && !search.includes("book.desc ? ` · ${book.desc}`"))
check('السؤال الجاهز يدور ويحفظ ما استُخدم لكل كتاب', search.includes('READY_QUESTION_STORAGE_KEY') && search.includes('nextReadyQuestion') && search.includes('markReadyQuestionUsed') && search.includes('readyQuestionsForBook'))
check('بطاقة جواب الكتاب لا تظهر بلا نتائج', search.includes('askBookMatches.length > 0 && (') && search.includes('askBookMatches.length === 0') && !search.includes('mt-4 rounded-2xl border border-hair bg-wash px-4 py-5'))
check('جملة عدد النتائج عربية سليمة', search.includes("const resultWord = (count: number)") && search.includes('arabicCountPhrase(count, RESULT_FORMS'))
check('تبويب نصوص الكتب واضح للزائر', search.includes("label: 'داخل كتب الدكتور'"))
check('اقتراحات البحث تستبعد الكلمات العامة المربكة', search.includes('SEARCH_SUGGESTION_STOPWORDS') && search.includes("'الدكتور'") && search.includes("'المقال'"))
check('المحرك يفهم المعنى والمرادفات والأخطاء لا الكلمات فقط', smartSearch.includes('DR_AHMAD_DOMAIN_GLOSSARY') && smartSearch.includes('SEMANTIC_FAMILIES') && smartSearch.includes('fuzzyContains') && smartSearch.includes('scoreSmartFields'))
check('نتائج الأرشيف موحدة ومتوازنة بين الأنواع', search.includes('diversifySmartRows') && knowledgeGraphSearch.includes('item.body') && knowledgeGraphSearch.includes('item.pdfText') && knowledgeGraphSearch.includes('item.transcript'))
check('عناوين ومحاور الكتب تعود دليلاً حتى عند غياب مقطع حرفي', bookQuotesSearch.includes("evidenceType: 'concept'") && bookQuotesSearch.includes('bestBookConcept(query, onlySlug)') && bookKnowledgeSearch.includes('concept.summary') && bookKnowledgeSearch.includes('concept.question'))
check('واجهة البحث تشرح فهم السؤال وتقترح إعادة صياغته', search.includes('فهم البحث') && search.includes('حوّلها إلى إجابة موثقة') && search.includes('اكتب بطريقتك: سؤال، موقف، فكرة'))
check('العقل الحي وعالم الكتاب يستعملان المحرك الدلالي نفسه', ask.includes('buildSmartQueryPlan') && ask.includes('scoreSmartFields') && bookWorld.includes('buildSmartQueryPlan') && bookWorld.includes('لم تظهر شواهد كافية'))
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
check('عبارة في مثل هذا الأسبوع بلا نقطة فاصلة أو فراغ وهمي', !home.includes('في مثل هذا الأسبوع <span') && !homeExperience.includes('في مثل هذا الأسبوع ·'))
check('الضغط على أدوات البطاقة لا يفتح المقال', home.includes('event.preventDefault(); event.stopPropagation()'))
check('بطاقات المقالات الكاملة لا تكرر اقرأ المقال أو افتح المسار', !/>\s*اقرأ المقال\s*</u.test(home) && !/>\s*افتح المسار\s*</u.test(home))
check('النشرة وتبيان والجدول الدراسي عادت أيقونات دائرية', ui.includes('SocialIcon name="Mail"') && ui.includes('<TebyanProjectLink') && ui.includes('<ScheduleProjectLink') && ui.includes('iconOnly = true'))
check('PROFESSIONAL لم تتغير والخط العربي للمنشور المستقل Alexandria', /PROFESSIONAL/u.test(socialTemplates + publishingStudio) && /المنشور المستقل[\s\S]{0,500}Alexandria/u.test(socialTemplates))
check('صور الإعلام في الرئيسية تفحص الصورة الرمادية', home.includes('function HomeMediaThumb') && homeExperience.includes('function YouTubeThumb') && home.includes('naturalWidth <= 120'))
check('سطر المهنة يمنع الفاصلة من الانفراد', home.includes('QuickArticleActions') && read('src/components/home/HumanCoreHero.tsx').includes('whitespace-nowrap') && read('src/components/home/HumanCoreHero.tsx').includes('أستاذ تكنولوجيا التعليم والذكاء الاصطناعي · باحث · مستشار'))
check('الكروت الديناميكية لا تُعرض عندما تخلو من النتائج', bookWorld.includes('(activeConnections.articles.length > 0 || activeConnections.papers.length > 0)') && curated.includes('if (!items.length) return null') && !curated.includes('سيظهر هنا أحدث ما يلتقطه الرادار'))
check('رسائل على الهامش تغيّر رأسها مع التبويب وتنوّع المصادر', inbox.includes('const pageHead =') && inbox.includes('books, papers, media') && inbox.includes('kind: "كتاب"') && inbox.includes('kind: "بحث"') && inbox.includes('kind: "لقاء"'))
check('خيوط الأرشيف تربط المقال والكتاب والبحث واللقاء', archiveDialogue.includes("kind: 'مقال' | 'كتاب' | 'بحث' | 'لقاء'") && archiveDialogue.includes('buildBookMedia') && archiveDialogue.includes('buildResearchMedia'))

console.log('\nالرسائل والسرعة')
check('الرسائل التمثيلية تُبنى من مخزون واسع لا من عشر رسائل ثابتة', count(editorialLetters, 'key:') >= 20 && editorialLetters.includes('openings:') && editorialLetters.includes('followups:') && editorialLetters.includes('combinations: pool().length'))
check('كل دخول يختار دفعة جديدة ويتذكر ما ظهر قبل إعادة التدوير', editorialLetters.includes('createEditorialLetterBatch') && editorialLetters.includes('window.localStorage') && editorialLetters.includes('seen') && editorialLetters.includes('recent') && editorialLetters.includes('randomSeed()'))
check('الرسائل متنوعة بلا وصف للمرسل وتظل موسومة تمثيلياً', inbox.includes('createEditorialLetterBatch') && inbox.includes('نموذج تمثيلي') && !inbox.includes('senderLabel') && !inbox.includes('ولي أمر') && !inbox.includes('معلمة') && !inbox.includes('طالب دراسات عليا'))
check('تنبيه النماذج التمثيلية الطويل محذوف مع بقاء وسم كل نموذج', !inbox.includes('وليست رسائل واردة من أشخاص حقيقيين') && inbox.includes('رسالة تمثيلية'))
check('أصداء الأرشيف وخيوطه محفوظة للمستقبل لكنها مخفية من تبويبات الرسائل حالياً', inbox.includes('const SHOW_ARCHIVE_SIDE_TABS = false') && inbox.includes('if (SHOW_ARCHIVE_SIDE_TABS)') && inbox.includes('setActiveView("letters")'))
check('Flow يوفّر ثلاثة مسارات: كلام عربي وكلام إنجليزي وبدون كلام', liveDirector.includes("FlowPromptMode = 'speech_ar' | 'speech_en' | 'silent'") && liveDirector.includes('WITH ARABIC SPEECH') && liveDirector.includes('WITH ENGLISH SPEECH') && liveDirectorUi.includes('كلام عربي') && liveDirectorUi.includes('كلام إنجليزي') && liveDirectorUi.includes('بدون كلام'))
check('برومبتات Flow إنجليزية وتمنع أي نص ظاهر في الفيديو', liveDirector.includes('VISIBLE-TEXT RULE') && liveDirector.includes('englishOnly') && liveDirector.includes('visible text in any language') && liveDirectorUi.includes('بلا نصوص داخل الفيديو'))
check('كل مقطع بعد الأول يبدأ بفقرة إكمال ولا يشترط رفع مرجع', liveDirector.includes('CONTINUATION CLIP') && liveDirector.includes('No reference image upload is required') && liveDirectorUi.includes('أول فقرة في البرومبت') && liveDirectorUi.includes('لا يحتاج رفع صورة'))
check('خطأ ArchiveEchoCard في TypeScript معالج بنوع وسيط صريح', inbox.includes('const candidates: Array<ArchiveEchoCard | null>') && inbox.includes('item !== null'))
check('صفحة الرسائل تؤجل البيانات الحية وتحمل التبويبات عند الطلب', inbox.includes('liveDataReady') && inbox.includes('{ enabled: activeView === "questions" }') && inbox.includes('{ enabled: activeView === "echoes" }'))
check('متون المقالات الثقيلة لا تحمل قبل فتح أصداء الأرشيف', inbox.includes('activeView !== "echoes" || !articles.length'))
check('إشارة المقال موحّدة وتغني كلياً عن نبض المقال', articleSignal.includes('article-signal-mark') && articleSignal.includes("source: 'readers'") && articleSignal.includes("source: 'pivot'") && articleSignal.includes("source: 'text'") && articleDetail.includes('articleSignalOf(slug, body, popularQuotes)') && articleDetail.includes('<ArticleSignal signal={articleSignal} title={title} />') && !resonance.includes('ArticlePulse') && !articleSignal.includes('نبض المقال') && !articleDetail.includes('ArticlePulse'))
check('موسوعة تكنولوجيا التعليم لها بوابة مستقلة عن قالب الكتب العام', bookDetail.includes("book.slug === 'encyclopedia'") && bookDetail.includes('<EncyclopediaPortal') && encyclopediaPortal.includes('بوابة معرفية مستقلة'))
check('تهيئة الزائر الجديد FirstVisitOnboarding متاحة بجمال واحترافية عالية وبلا إرباك', homePage.includes('<FirstVisitOnboarding />') && !app.includes('ConditionalOnboarding'))
check('الموسوعة تظهر وحدها في أول سطر وبقية الكتب كتابان في كل سطر', publications.includes("right.slug === 'encyclopedia'") && publications.includes("featured ? 'group col-span-2") && publications.includes('grid-cols-2') && !publications.includes('lg:grid-cols-3'))
check('تفريغ Buzz محلي ثابت يدعم VTT وSRT وJSON والاستئناف والكتابة الذرية', encyclopediaBuzzImporter.includes("SUPPORTED_EXTENSIONS = new Set(['.vtt', '.srt', '.json'])") && encyclopediaBuzzImporter.includes('sourceHash') && encyclopediaBuzzImporter.includes('atomicWriteJson') && encyclopediaBuzzImporter.includes('renameSync'))
check('الفهرس لا يعلن اكتمال metadata ولا يعرض توقيتاً إلا من segment موثوق', encyclopediaTranscriptData.catalogCount === 169 && Object.keys(encyclopediaTranscriptData.records || {}).length === 169 && encyclopediaTranscriptData.progress.available === Object.values(encyclopediaTranscriptData.records || {}).filter((record) => record.available && Array.isArray(record.segments) && record.segments.length > 0).length && encyclopediaVideoServer.includes('hasExactTiming: exact') && encyclopediaKnowledgeResults.includes('moment.hasExactTiming'))
check('البحث الزمني لا يقفز بالصفحة وCloud Run يحمل JSON النهائي فقط', !encyclopediaPortal.includes('scrollIntoView') && encyclopediaPortal.includes('data-horizontal-video-rail="true"') && dockerfile.includes('COPY src/data/encyclopedia-video-transcripts.json') && gcloudignore.includes('!src/data/encyclopedia-video-transcripts.json') && gitignore.includes('local-data/encyclopedia-buzz-transcripts/*'))
check('بوابة الموسوعة تفهرس الفيديوهات وتربطها بأبواب PDF وفصوله والبحث والعروض', encyclopediaPortal.includes('structureData') && encyclopediaPortal.includes('خريطة الموسوعة') && encyclopediaPortal.includes('الموسوعة المرئية') && encyclopediaPortal.includes('getEncyclopediaVideoCatalog') && encyclopediaPortal.includes('searchResults.videos') && encyclopediaPortal.includes('searchResults.units') && encyclopediaPortal.includes('knowledgeResults.slides') && encyclopediaPortal.includes('searchEncyclopediaVideoMoments') && encyclopediaPortal.includes('EncyclopediaKnowledgeResults') && encyclopediaPortal.includes('playingStartSeconds') && encyclopediaPortal.includes('شاهد الشرح') && encyclopediaPortal.includes('teachingMaterial.door.presentation') && encyclopediaPortal.includes('مواد التدريس') && encyclopediaPortal.includes('خيط المادة') && encyclopediaPortal.includes('موضع الموضوع في العرض') && encyclopediaPortal.includes('getEncyclopediaTeachingTopic') && encyclopediaPortal.includes('onOpenTeaching') && encyclopediaPortal.includes('aria-modal="true"') && encyclopediaPortal.includes('name="YouTube"') && !encyclopediaPortal.includes('AUDIENCES') && !encyclopediaPortal.includes('activeAudience') && !encyclopediaPortal.includes('bg-ink/45') && !encyclopediaPortal.includes('text-soft/55') && !encyclopediaPortal.includes('FEATURED_VIDEO_EMBED') && !encyclopediaPortal.includes('channelSearch(') && encyclopediaVideoIndex.includes('extractEncyclopediaSequence') && encyclopediaVideoIndex.includes('resolveConcept') && encyclopediaVideoIndex.includes('resolveChapter') && encyclopediaVideoIndex.includes('chapterTitle') && encyclopediaVideoClient.includes('/api/encyclopedia/videos') && encyclopediaVideoServer.includes('parseYouTubeContinuations') && encyclopediaTeachingMap.includes('encyclopediaSlideRangeLabel') && nodeServer.includes('loadEncyclopediaVideoCatalog') && (nodeServer.match(/clamp\(Number\(url\.searchParams\.get\('door'\)\) \|\| 0, 0, 5\)/g) || []).length === 2)
check('مدخل البحث في رأس الموسوعة أيقونة بلا نص ظاهر', encyclopediaPortal.includes('aria-label="ابحث في الموسوعة"') && encyclopediaPortal.includes('name="Search"') && !/>\s*ابحث\s*<\/a>/u.test(encyclopediaPortal))
check('بحث كل كتاب في بطاقات المؤلفات والنتائج أيقونة فقط', publications.includes('aria-label={`ابحث داخل كتاب ${b.title}`}') && search.includes('aria-label={`ابحث داخل كتاب ${row.title}`}') && !publications.includes('ابحث فيه') && !search.includes('ابحث فيه'))
check('قناة الموسوعة تفتح بأيقونة يوتيوب فقط والفهرس يبقى داخل الصفحة', encyclopediaPortal.includes('aria-label="فتح قناة الموسوعة على يوتيوب"') && encyclopediaPortal.includes('name="YouTube"') && !/>\s*افتح القناة\s*</u.test(encyclopediaPortal) && encyclopediaPortal.includes('aria-label="فهرس فيديوهات الموسوعة"'))
check('تصنيفات الجمهور المتطابقة محذوفة من بوابة الموسوعة', !encyclopediaPortal.includes('AUDIENCES') && !encyclopediaPortal.includes('activeAudience') && !encyclopediaPortal.includes('setActiveAudience'))
check('لوحة مواد التدريس تخفي الأسهم العائمة وتعرض زر تنزيل أيقونياً واحداً في كل حالة', css.includes('body.encyclopedia-sheet-open .floating-actions') && encyclopediaPortal.includes('encyclopedia-teaching-overlay') && encyclopediaPortal.includes('aria-label="تحميل عرض الباب"') && !/>\s*تحميل عرض الباب\s*</u.test(encyclopediaPortal))
const teachingDoors = Object.entries(encyclopediaTeachingData)
const teachingTopics = teachingDoors.flatMap(([doorId, door]) => Object.entries(door.topics || {}).map(([title, topic]) => ({ doorId, title, ...topic, slideCount: door.slideCount })))
check('خريطة مواد التدريس تغطي الأبواب الأربعة ومحاورها الأربعة والعشرين', teachingDoors.length === 4 && teachingTopics.length === 24 && teachingDoors.every(([, door]) => Number(door.slideCount) > 0 && Object.keys(door.topics || {}).length === 6))
check('كل محور مرتبط بشرائح دقيقة وهدف وسؤال وفيديو مرشّح', teachingTopics.every((topic) => topic.chapter && topic.objective && topic.discussion && Array.isArray(topic.videoHints) && topic.videoHints.length > 0 && Array.isArray(topic.ranges) && topic.ranges.length > 0 && topic.ranges.every((range) => Number.isInteger(range.from) && Number.isInteger(range.to) && range.from >= 1 && range.to >= range.from && range.to <= topic.slideCount && range.label)))
check('PDF الموسوعة محفوظ والعروض الأربعة ملفات تحميل فعلية منفصلة عن أبواب الكتاب', exists('files/encyclopedia.pdf') && [1, 2, 3, 4].every((door) => exists(`files/encyclopedia/encyclopedia-door-${door}.pptx`)) && encyclopediaPortal.includes('book.pdf') && encyclopediaPortal.includes('PRESENTATION_DOORS') && encyclopediaPortal.includes('download={`موسوعة تكنولوجيا التعليم - الباب ${teachingMaterial.door.number}.pptx`}'))
check('عيّنة الموسوعة تفتح في المتصفح بالصياغة الموحدة مع بقية الكتب', encyclopediaPortal.includes('عرض عيّنة الكتاب') && encyclopediaPortal.includes('target="_blank"') && !encyclopediaPortal.includes('تحميل المقدمة والفهرس') && !encyclopediaPortal.includes('downloadPdf'))
check('النصوص الوصفية المكررة والمربكة حذفت من عالم الكتاب ومواد التدريس', !bookWorld.includes('على امتداد ${arabicCountPhrase') && !bookWorld.includes('كلٌّ منسوبٌ إلى صفحته') && !bookWorld.includes('مؤلَّفات تتقاطع مع محاور هذا الكتاب') && !encyclopediaPortal.includes('العروض الأربعة الأولى فقط') && !bookDetail.includes('book-detail-guides') && !encyclopediaPortal.includes('طريقة الدخول'))
check('فيديوهات الموسوعة تبدأ من فهرس ثابت كامل وتندمج مع القناة الحية بلا فقد', encyclopediaVideoClient.includes('getEncyclopediaFallbackCatalog') && encyclopediaVideoClient.includes('completeCatalog') && encyclopediaVideoClient.includes('static-complete-catalog') && encyclopediaPortal.includes('supplementalVideos') && encyclopediaPortal.includes('جميع فيديوهات الفهرس ظاهرة'))
check('فتح باب في الموسوعة يغلق الباب الآخر مع بقاء باب واحد متحكماً به', encyclopediaPortal.includes('openDoorId') && encyclopediaPortal.includes('open={isOpen}') && encyclopediaPortal.includes("current === door.id ? '' : door.id"))
check('الفيديوهان المعتمدان ثابتان أولاً وثانياً وبقية أبرز الشروحات تتحرك تلقائياً', encyclopediaPortal.includes("FEATURED_PINNED_VIDEO_IDS = ['emisZzaICy8', 'JtSaEiD0rzQ']") && encyclopediaPortal.includes('FEATURED_ROTATING_COUNT') && encyclopediaPortal.includes('window.setInterval(() => moveFeatured(1), 7000)'))
check('تنقل أبرز الشروحات أفقي فقط ولا يعيد الصفحة إلى الأعلى أثناء تصفح الفصول', encyclopediaPortal.includes('featuredInView') && encyclopediaPortal.includes('IntersectionObserver') && encyclopediaPortal.includes("container.scrollBy({ left: delta, behavior: 'smooth' })") && !encyclopediaPortal.includes("card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })"))
check('فيديو التدريب والمران وفيديو تاريخ الإنترنت مصنفان يدوياً في فصليهما الصحيحين', encyclopediaPortal.includes('pSIVIgPsD9g: { doorNumber: 2, chapterNumber: 4 }') && encyclopediaPortal.includes("'8u5a5WQ_RGA': { doorNumber: 2, chapterNumber: 2 }") && encyclopediaPortal.includes('video.chapterTitle || video.sequenceLabel'))
check('قسم مقدمات ومواد عامة والوصف الزائد تحت أبرز الشروحات محذوفان نهائياً', !encyclopediaPortal.includes('مقدمات ومواد عامة') && !encyclopediaPortal.includes('تصفّح فيديوهات الموسوعة من فهرس واحد منظم'))
check('كروت الفيديو على الهاتف تكشف طرف الكرت التالي ولا تمنع التمرير الرأسي', encyclopediaPortal.includes('w-[76vw]') && !encyclopediaPortal.includes('[touch-action:pan-x_pinch-zoom]'))
check('تشغيل الفيديو محصور في الكرت المضغوط ولا ينشئ مشغلات متزامنة مكررة', encyclopediaPortal.includes('playingVideoInstance') && encyclopediaPortal.includes('instanceKey={`featured-${video.id}`}') && encyclopediaPortal.includes('instancePrefix={`unit-${door.id}-${unit.number}`}'))
check('خطأ مجلس التحرير في GitHub محمي بقيم رقمية افتراضية', publishingStudio.includes('(editorialCalibrationProfile.sampleSize ?? 0)') && publishingStudio.includes('editorialCalibrationProfile.stubbornWins ?? 0'))
check('أرشيف الرادار يستورد صيغة عدد الالتقاطات قبل استخدامها', radar.includes('CAPTURE_FORMS, MATERIAL_FORMS') && radar.includes('arabicCountPhrase(w.items.length, CAPTURE_FORMS)'))
check('الموقع العام لا يفتح خمس قنوات Firestore دائمة', content.includes('CmsProvider({ children, realtime = false }') && content.includes('if (realtime)') && content.includes('getDocs(collection(db, name))'))
check('محتوى CMS العام محفوظ محلياً ويُحدّث بعد استقرار الواجهة', content.includes('site:cms-cache:v1') && content.includes('hasCmsCache(initialCache) ? 12000 : 4500') && content.includes('writeCmsCache(next)'))
check('التحميل العام المسبق للمجموعات الحساسة أزيل من بداية التطبيق', !app.includes('warmPublicExtras') && !app.includes('CriticalContentWarmup'))
check('حارس الأرقام يجمع تغييرات DOM بدلاً من فحصها فوراً', app.includes('const pending = new Set<Node>()') && app.includes('requestIdleCallback(flush'))
check('خدمة العمل تعرض غلاف التطبيق فوراً وتحدّث الشبكة في الخلفية', serviceWorker.includes('navigationPreload.enable') && serviceWorker.includes('e.waitUntil(networkUpdate') && serviceWorker.includes("cache.match('/index.html')"))
check('اتصال Firestore المبكر لا ينافس أصول الصفحة الحرجة', !indexHtml.includes('preconnect" href="https://firestore.googleapis.com') && !indexHtml.includes('dns-prefetch" href="https://firestore.googleapis.com'))

console.log('\nصياغة العقل الحي')
check('لا يقول لم أجد جواباً ثم يعرض جواباً', !ask.includes('لم أجد جواباً مباشراً') && !ask.includes('وهذه أقرب مادة موثّقة'))
check('الإجابة المركبة تصف تعدد المواد والشواهد', ask.includes('إجابة مركّبة من المواد والشواهد الموثّقة'))
check('الجواب غير المؤسس لا يمر كجواب موثق', ask.includes('grounded') && ask.includes('setTwin(fallback)'))
check('طباعة المسار في الواجهة أيقونة فقط', ask.includes('SocialIcon name="Print"') && ask.includes('aria-label="طباعة مسار القراءة"'))


const answerQuality = read('src/components/admin/AnswerQualityLab.tsx')
const intelligenceLab = read('src/components/admin/IntelligenceLab.tsx')
check('مختبر جودة اسأل المكتبة داخلي فقط', answerQuality.includes('داخلي · لا يظهر للزائر') && intelligenceLab.includes('AnswerQualityLab') && !read('src/App.tsx').includes('AnswerQualityLab'))
check('مختبر الجودة يفحص الامتناع واللهجة والمصادر', answerQuality.includes('mustAnswer: false') && answerQuality.includes('toRoot') && answerQuality.includes('أقوى المصادر الحالية'))

check('أيقونة مواد الباب انتقلت بجانب عنوان الباب', encyclopediaPortal.includes('مواد التدريس المرتبطة بهذا الباب') && !encyclopediaPortal.includes('<div className="mt-4 flex justify-end">\n          {door.presentation ?'))
check('الأيقونات غير الواضحة تشرح نفسها في أول لمسة فقط', read('src/components/ClarifiedIconAction.tsx').includes('localStorage') && read('src/components/ClarifiedIconAction.tsx').includes('(hover: none), (pointer: coarse)'))
check('روابط جواب الكتاب تفتح PDF على الصفحة الحقيقية', search.includes('#page=${Math.max(1, Number(match.quote.page || 1))}') && search.includes('window.scrollTo({ top: 0'))

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
