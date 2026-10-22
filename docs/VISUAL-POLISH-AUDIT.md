# تدقيق الصقل البصري — VISUAL-POLISH-AUDIT

نطاق: طبقة العرض فقط. لا منطق ولا بيانات ولا مسارات ولا اختبارات تغيّرت.

## الأمانة في التغطية
- عدد ملفات الواجهة المحصاة: 162 (41 صفحة/مسار، 121 مكوّن/ورقة أنماط).
- **قُرئت قراءةً كاملة أو شبه كاملة**: Contact، ContactForm، AboutSite، Now، NotFound، Legal (الأقسام والبنية)، وأجزاء من Home.
- **فُحصت آلياً فقط** (البحث عن أسطر عربية طويلة داخل JSX كمؤشر لجدران النص) بقية الصفحات والمكوّنات؛ لم تُقرأ سطراً سطراً ولم تُلتقط لها لقطات.
- لم تُعدَّل لوحة الإدارة (src/components/admin، Admin.tsx): أدوات داخلية وكثافتها مقصودة.
- ما لم يُعرض: صفحات تعتمد Firebase حيّ؛ الوضع التجريبي (VITE_DEMO_MODE=1) استُخدم للقطات /contact و/about و/now و404 عند 390 و1280 بلا تمرير أفقي.

## ما غُيّر
| الشاشة | الملاحظة | التغيير |
|---|---|---|
| src/pages/Contact.tsx | فقرة تعريفية من ثلاثة أسطر تكرّر ما يشرحه النموذج تحتها | استُبدلت بثلاث خدمات برموز lucide داخل حلقات (نفس النص الحرفي تقريباً، لا ادّعاءات جديدة) |
| src/pages/AboutSite.tsx | جملة hero تُكرَّر حرفياً في رأس الصفحة وعنوان الختام | حُذف التكرار وبقي زر التواصل؛ نقاط «ما يميّزه» صارت حلقات مرقّمة |
| src/pages/Now.tsx | الحالة الفارغة نصّ مجرّد | أيقونة مصباح فوق النص (النص نفسه) |
| src/pages/NotFound.tsx | قائمة الوجهات نصّ فقط | أيقونة لكل وجهة (الأعداد من البيانات الفعلية كما كانت) |

الأيقونات زخرفية (aria-hidden) ولا عنصر تفاعلي فقد اسمه المتاح. كل الروابط والأزرار والمعرّفات كما هي.

## تُركت عمداً
- Legal.tsx: فيها أصلاً شريط «نظرة سريعة» بأيقونات؛ النص قانوني ولا يُختصر.
- ContactForm.tsx: بطاقات الاختيار بأيقونات أصلاً؛ حقول وحارس عسل ومعرّفات يعتمد عليها السلوك.
- الصفحة الرئيسية (Home/HomeExperience/ThresholdOverture) وArticleReader وAtlas وSearch وAskLibrary: كبيرة ومصقولة وعليها حرّاس وسلوك؛ لم تُقرأ بما يكفي لتعديل آمن.
- نصوص build-static.mjs للـSEO لم تُمسّ.

## قائمة الملفات المحصاة
- `index.html`
- `public/boot.css`
- `src/App.tsx`
- `src/components/ArticlePivot.tsx`
- `src/components/ArticleReader.tsx`
- `src/components/AskHowItWorks.tsx`
- `src/components/AudioPlayer.tsx`
- `src/components/BookTerrain.tsx`
- `src/components/BookToc.tsx`
- `src/components/BookWorld.tsx`
- `src/components/BooksAtlas.tsx`
- `src/components/CitationCopy.tsx`
- `src/components/CitationImpact.tsx`
- `src/components/ClarifiedIconAction.tsx`
- `src/components/ComposeScene.tsx`
- `src/components/ConceptEcho.tsx`
- `src/components/ContactForm.tsx`
- `src/components/CountTiles.tsx`
- `src/components/CvDownloadCards.tsx`
- `src/components/DrawIn.tsx`
- `src/components/EncyclopediaKnowledgeResults.tsx`
- `src/components/EncyclopediaPortal.tsx`
- `src/components/EncyclopediaResultBrowser.tsx`
- `src/components/EnglishThreshold.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/GlyphLoader.tsx`
- `src/components/IconTooltipPortal.tsx`
- `src/components/IdeaFeatures.tsx`
- `src/components/IdeaLife.tsx`
- `src/components/ImpactMap.tsx`
- `src/components/InterfacePolish.tsx`
- `src/components/JourneyStepper.tsx`
- `src/components/KnowledgeEntry.tsx`
- `src/components/KnowledgeFingerprint.tsx`
- `src/components/KuficMark.tsx`
- `src/components/MySpace.tsx`
- `src/components/NextStep.tsx`
- `src/components/Pagination.tsx`
- `src/components/PodcastPlatforms.tsx`
- `src/components/QuoteCard.tsx`
- `src/components/QuoteCite.tsx`
- `src/components/QuoteImage.tsx`
- `src/components/ReaderResonance.tsx`
- `src/components/ReaderResonanceSky.tsx`
- `src/components/ReadingShelf.tsx`
- `src/components/ResearchSectionNavigator.tsx`
- `src/components/SitewideIconClarifications.tsx`
- `src/components/ThoughtHub.tsx`
- `src/components/ThoughtSystemNav.tsx`
- `src/components/VoiceFigure.tsx`
- `src/components/WhatsAppSupportInbox.tsx`
- `src/components/admin/AdminArchitecture.tsx`
- `src/components/admin/AdminDashboard.tsx`
- `src/components/admin/AdminTaskFavicon.tsx`
- `src/components/admin/AnswerQualityLab.tsx`
- `src/components/admin/AtlasEditorialSettings.tsx`
- `src/components/admin/AudienceStudio.tsx`
- `src/components/admin/AudioLibrary.tsx`
- `src/components/admin/AudioSystemOverview.tsx`
- `src/components/admin/BotMessagesPanel.tsx`
- `src/components/admin/BroadcastStudio.tsx`
- `src/components/admin/ContentManager.tsx`
- `src/components/admin/ContentManagerHeader.tsx`
- `src/components/admin/ContentSyncHealth.tsx`
- `src/components/admin/CvSectionEditor.tsx`
- `src/components/admin/DesignBirthStage.tsx`
- `src/components/admin/DesignWorldsGallery.tsx`
- `src/components/admin/DrAhmadRoom.tsx`
- `src/components/admin/EditorialForesightPanel.tsx`
- `src/components/admin/EditorialMemoryPanel.tsx`
- `src/components/admin/GenerationLibraryPanel.tsx`
- `src/components/admin/IdeaDnaPanel.tsx`
- `src/components/admin/ImageLab.tsx`
- `src/components/admin/InboxIntelligence.tsx`
- `src/components/admin/Indicators.tsx`
- `src/components/admin/IntelligenceLab.tsx`
- `src/components/admin/KuwaitiManualDialogueEditor.tsx`
- `src/components/admin/LegacyModePanel.tsx`
- `src/components/admin/LiveDirector.tsx`
- `src/components/admin/LivingMetaphorIcon.tsx`
- `src/components/admin/ManualDialogueEditor.tsx`
- `src/components/admin/MonteurEmbed.tsx`
- `src/components/admin/MovableWords.tsx`
- `src/components/admin/NewsletterCenter.tsx`
- `src/components/admin/NextBookCard.tsx`
- `src/components/admin/PersonalKnowledgeGraph.tsx`
- `src/components/admin/ProductionHealthCenter.tsx`
- `src/components/admin/ProductionMonitor.tsx`
- `src/components/admin/PronunciationLexicon.tsx`
- `src/components/admin/PublishingStudio.tsx`
- `src/components/admin/PublishingStudioNavigation.tsx`
- `src/components/admin/ReaderPulse.tsx`
- `src/components/admin/ReelStudio.tsx`
- `src/components/admin/SocialDesignStudio.tsx`
- `src/components/admin/SoundCaravanBoard.tsx`
- `src/components/admin/StoryboardAtlas.tsx`
- `src/components/admin/StyleChecker.tsx`
- `src/components/admin/SystemHealthOverview.tsx`
- `src/components/admin/TweetStudio.tsx`
- `src/components/admin/UsageAnalytics.tsx`
- `src/components/admin/VisitorJourneySuggestion.tsx`
- `src/components/admin/VoiceBakeoff.tsx`
- `src/components/admin/WhatsAppAgentPanel.tsx`
- `src/components/dna/DnaKit.tsx`
- `src/components/dna/dna-theme.css`
- `src/components/dna/dna.css`
- `src/components/elevation.css`
- `src/components/extras.tsx`
- `src/components/home/HomeExperience.tsx`
- `src/components/home/HumanCoreHero.tsx`
- `src/components/home/OnAirNow.tsx`
- `src/components/home/ThresholdOverture.tsx`
- `src/components/icons.tsx`
- `src/components/interface-polish.css`
- `src/components/morph.tsx`
- `src/components/seo.tsx`
- `src/components/ui.tsx`
- `src/index.css`
- `src/lib/admin-auth.tsx`
- `src/lib/persistent-audio.tsx`
- `src/main.tsx`
- `src/pages/AboutSite.tsx`
- `src/pages/Admin.tsx`
- `src/pages/ArticleDetail.tsx`
- `src/pages/Articles.tsx`
- `src/pages/AskLibrary.tsx`
- `src/pages/Atlas.tsx`
- `src/pages/BookDetail.tsx`
- `src/pages/CV.tsx`
- `src/pages/Card.tsx`
- `src/pages/CardLive.tsx`
- `src/pages/ConceptLife.tsx`
- `src/pages/Contact.tsx`
- `src/pages/Curated.tsx`
- `src/pages/CvFile.tsx`
- `src/pages/Decade.tsx`
- `src/pages/English.tsx`
- `src/pages/EnglishContact.tsx`
- `src/pages/Home.tsx`
- `src/pages/Impact.tsx`
- `src/pages/Inbox.tsx`
- `src/pages/LearningPaths.tsx`
- `src/pages/Legal.tsx`
- `src/pages/Listen.tsx`
- `src/pages/Live.tsx`
- `src/pages/Media.tsx`
- `src/pages/MediaDetail.tsx`
- `src/pages/NotFound.tsx`
- `src/pages/Now.tsx`
- `src/pages/PaperDetail.tsx`
- `src/pages/Publications.tsx`
- `src/pages/PwaLaunch.tsx`
- `src/pages/Questions.tsx`
- `src/pages/Radar.tsx`
- `src/pages/Radio.tsx`
- `src/pages/Research.tsx`
- `src/pages/Search.tsx`
- `src/pages/ThoughtOverview.tsx`
- `src/pages/ThoughtPaths.tsx`
- `src/pages/Upcoming.tsx`
- `src/pages/WeeklyLetter.tsx`
- `src/pages/radio.css`
