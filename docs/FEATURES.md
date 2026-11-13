# خريطة الميزات الكاملة

مرجعٌ مفصّل يكمّل [README.md](../README.md): كل ميزة، ومسارها الحيّ، وملفها الرئيسي،
وحالتها. الأرقام الحيّة (عدد المسارات والمقالات والأوامر) في
[PROJECT-STATUS.md](../PROJECT-STATUS.md) لا هنا.

**مفتاح الحالة:** يعمل = منشور ويُستخدم · خاص = يعمل لكن للمشرف وحده ·
محلي = يعمل على جهاز الدكتور لا على الخادم · تجريبي = موجود في الشيفرة ولم يُعتمد بعد.

جدول المسارات مصدرٌ واحد: [src/App.tsx](../src/App.tsx).

---

## ١) الموقع العام — القراءة والأرشيف

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| الرئيسية | العتبة، «فكرة اليوم»، شريط «الآن» | [/](https://dr-alfailakawi.com/) | [src/pages/Home.tsx](../src/pages/Home.tsx) | يعمل |
| المقالات | الأرشيف مع عدساتٍ موضوعية وتصفية بالسنة | [/articles](https://dr-alfailakawi.com/articles) | [src/pages/Articles.tsx](../src/pages/Articles.tsx) | يعمل |
| صفحة المقال | قراءة، تتبّع الجملة مع الصوت، الأغصان المرتبطة | `/articles/:slug` | [src/pages/ArticleDetail.tsx](../src/pages/ArticleDetail.tsx) | يعمل |
| الكتب | المؤلفات وصفحة لكل كتاب مع بوابة الموسوعة | [/publications](https://dr-alfailakawi.com/publications) | [src/pages/Publications.tsx](../src/pages/Publications.tsx) · [src/pages/BookDetail.tsx](../src/pages/BookDetail.tsx) · [src/components/EncyclopediaPortal.tsx](../src/components/EncyclopediaPortal.tsx) | يعمل |
| الأبحاث | المساهمات العلمية وصفحة لكل بحث مع BibTeX | [/research](https://dr-alfailakawi.com/research) | [src/pages/Research.tsx](../src/pages/Research.tsx) · [src/pages/PaperDetail.tsx](../src/pages/PaperDetail.tsx) · [src/lib/bibtex.ts](../src/lib/bibtex.ts) | يعمل |
| الإعلام | الظهور واللقاءات، والبحث داخل الكلام المفرَّغ | [/media](https://dr-alfailakawi.com/media) | [src/pages/Media.tsx](../src/pages/Media.tsx) · [src/pages/MediaDetail.tsx](../src/pages/MediaDetail.tsx) | يعمل |
| السيرة | السيرة الأكاديمية وملفاتها القابلة للتنزيل | [/cv](https://dr-alfailakawi.com/cv) | [src/pages/CV.tsx](../src/pages/CV.tsx) · [src/pages/CvFile.tsx](../src/pages/CvFile.tsx) | يعمل |
| سجل الأثر | رحلات الأثر الموثّقة وملخّصها السنوي | [/impact](https://dr-alfailakawi.com/impact) | [src/pages/Impact.tsx](../src/pages/Impact.tsx) | يعمل |
| المرآة الإنجليزية | الرئيسية والسيرة والأبحاث والتواصل بالإنجليزية | [/en](https://dr-alfailakawi.com/en) | [src/pages/English.tsx](../src/pages/English.tsx) · [src/pages/EnglishContact.tsx](../src/pages/EnglishContact.tsx) | يعمل |

## ٢) الاكتشاف والبحث

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| محرك المعرفة | بحث موحّد في المقالات والكتب والأبحاث والتفريغات، مع رابطٍ عميق | [/search](https://dr-alfailakawi.com/search) | [src/pages/Search.tsx](../src/pages/Search.tsx) · [docs/SEARCH.md](SEARCH.md) | يعمل |
| «العقل الحي» — اسأل المكتبة | سؤال حرّ يُجاب من أرشيف الدكتور وحده باقتباساتٍ حرفية | [/ask](https://dr-alfailakawi.com/ask) | [src/pages/AskLibrary.tsx](../src/pages/AskLibrary.tsx) · `/api/ai/archive-answer` في [server.mjs](../server.mjs) | يعمل (يعتمد على الخادم) |
| سماء المقالات (الأطلس) | خريطة SVG للمقالات بحسب المحاور | [/atlas](https://dr-alfailakawi.com/atlas) | [src/pages/Atlas.tsx](../src/pages/Atlas.tsx) · [docs/ARCHIVE-2036.md](ARCHIVE-2036.md) | يعمل |
| منظومة الفكرة | الباب الجامع لمحاور الفكر | [/thought](https://dr-alfailakawi.com/thought) | [src/pages/ThoughtOverview.tsx](../src/pages/ThoughtOverview.tsx) | يعمل |
| مسارات الفكرة | تسلسلات قراءة مع «أكمل من حيث توقفت» | [/thought-paths](https://dr-alfailakawi.com/thought-paths) | [src/pages/ThoughtPaths.tsx](../src/pages/ThoughtPaths.tsx) | يعمل |
| مسارات التعلّم | محطات قراءة بتقدّمٍ حقيقي | [/paths](https://dr-alfailakawi.com/paths) | [src/pages/LearningPaths.tsx](../src/pages/LearningPaths.tsx) | يعمل |
| وثيقة العقد | رحلة فكرةٍ بعينها عبر السنوات والتوقّعات | [/decade](https://dr-alfailakawi.com/decade) | [src/pages/Decade.tsx](../src/pages/Decade.tsx) | يعمل |
| سيرة مفهوم | تبدأ من فكرة وتعرض رحلتها في الزمن | `/concept/:term` | [src/pages/ConceptLife.tsx](../src/pages/ConceptLife.tsx) | يعمل |

## ٣) الصوت والفيديو والموسوعة

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| مجلس الفكرة (الاستماع) | المقالات المسموعة وحلقات البودكاست الحوارية | [/listen](https://dr-alfailakawi.com/listen) | [src/pages/Listen.tsx](../src/pages/Listen.tsx) · [docs/PODCAST.md](PODCAST.md) | يعمل |
| الإذاعة | بثٌّ متزامن بساعة الكويت من جدولٍ ثابت (فصحى وكويتي) | [/radio](https://dr-alfailakawi.com/radio) | [src/pages/Radio.tsx](../src/pages/Radio.tsx) · [src/data/radio-schedule.json](../src/data/radio-schedule.json) | يعمل |
| الموسوعة الحيّة | تطبيق كاميرا (AR) يتعرّف على صفحات الكتاب المطبوع ويعرض مشاهد ثلاثية وفيديو | [/living](https://dr-alfailakawi.com/living) | [public/living/index.html](../public/living/index.html) · [public/living/app.js](../public/living/app.js) | يعمل |
| فيديوهات الموسوعة | فيديوهات وتفريغاتٌ زمنية ولحظاتٌ قابلة للبحث | داخل صفحات الكتب والبحث | [src/server/encyclopedia-videos.mjs](../src/server/encyclopedia-videos.mjs) · [docs/video-pipeline.md](video-pipeline.md) | يعمل |
| استضافة الصوت | الصوت على Cloudflare R2 خارج المستودع | — | [scripts/publish-audio-r2.mjs](../scripts/publish-audio-r2.mjs) · [docs/MEDIA-AUDIO-HOSTING.md](MEDIA-AUDIO-HOSTING.md) | يعمل |
| البودكاست الكويتي | حلقات حوارية باللهجة الكويتية عبر بوابات اعتماد | ضمن [/listen](https://dr-alfailakawi.com/listen) | [scripts/podcast-kuwaiti-gemini.mjs](../scripts/podcast-kuwaiti-gemini.mjs) · [docs/KUWAITI-DIWANIYA-DNA.md](KUWAITI-DIWANIYA-DNA.md) | تجريبي (يُنشر ما يُعتمد يدوياً فقط) |

## ٤) الانتقاء والتفاعل والتواصل

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| المختارات | مواد حديثة من قائمة مغلقة من المصادر الموثوقة | [/curated](https://dr-alfailakawi.com/curated) | [src/pages/Curated.tsx](../src/pages/Curated.tsx) · [scripts/daily-radar.mjs](../scripts/daily-radar.mjs) | يعمل |
| أرشيف الرادار | التقاطات الرادار مجمّعةً أسبوعاً بأسبوع | [/radar](https://dr-alfailakawi.com/radar) | [src/pages/Radar.tsx](../src/pages/Radar.tsx) | يعمل |
| الأسئلة | أسئلة الزوار مصنّفةً آلياً | [/questions](https://dr-alfailakawi.com/questions) | [src/pages/Questions.tsx](../src/pages/Questions.tsx) | يعمل |
| رسائل الهامش | الرسائل والشهادات المنشورة | [/inbox](https://dr-alfailakawi.com/inbox) | [src/pages/Inbox.tsx](../src/pages/Inbox.tsx) | يعمل |
| اللقاءات القادمة | المواعيد وربط المنتهي منها بمادته | [/upcoming](https://dr-alfailakawi.com/upcoming) | [src/pages/Upcoming.tsx](../src/pages/Upcoming.tsx) | يعمل |
| التواصل | نموذج التواصل العربي | [/contact](https://dr-alfailakawi.com/contact) | [src/pages/Contact.tsx](../src/pages/Contact.tsx) | يعمل |
| البطاقة الرقمية | بطاقة للمؤتمرات مع ملف vCard، ونسخة «حيّة» بالجسيمات | [/card](https://dr-alfailakawi.com/card) · [/cards](https://dr-alfailakawi.com/cards) | [src/pages/Card.tsx](../src/pages/Card.tsx) · [src/pages/CardLive.tsx](../src/pages/CardLive.tsx) | يعمل |
| عن الموقع والسياسات | عن الموقع، الخصوصية، الشروط، حذف البيانات | [/about](https://dr-alfailakawi.com/about) | [src/pages/AboutSite.tsx](../src/pages/AboutSite.tsx) · [src/pages/Legal.tsx](../src/pages/Legal.tsx) | يعمل |
| تطبيق الويب (PWA) | تثبيت، شاشة إقلاع واحدة، استئناف آخر قراءة | `/launch` | [src/pages/PwaLaunch.tsx](../src/pages/PwaLaunch.tsx) · [public/sw.js](../public/sw.js) · [public/boot.js](../public/boot.js) | يعمل |

## ٥) أدوات خاصة بالمشرف

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| لوحة الإدارة | غرفة القيادة، المكتبة، الإنتاج والنشر، الصوت، الجمهور، التحليلات | `/admin` (noindex) | [src/pages/Admin.tsx](../src/pages/Admin.tsx) · [src/components/admin/admin-navigation.ts](../src/components/admin/admin-navigation.ts) · [docs/ADMIN.md](ADMIN.md) | خاص |
| استوديو النشر ومجلس التحرير | من الفكرة إلى الحزمة التحريرية، فاحص الأسلوب، الذاكرة والاستشراف | داخل `/admin` | [src/components/admin/PublishingStudio.tsx](../src/components/admin/PublishingStudio.tsx) · [src/components/admin/StyleChecker.tsx](../src/components/admin/StyleChecker.tsx) | خاص |
| استوديو التصاميم والتغريدات | منشورات لكل منصّة وتصاميمها | داخل `/admin` | [src/components/admin/SocialDesignStudio.tsx](../src/components/admin/SocialDesignStudio.tsx) · [src/components/admin/TweetStudio.tsx](../src/components/admin/TweetStudio.tsx) | خاص |
| الفيديو والموشن | مدخل الفيديو، أطلس القصص، الريل، المخرج الحي | داخل `/admin` | [src/components/admin/VideoHub.tsx](../src/components/admin/VideoHub.tsx) · [src/components/admin/ReelStudio.tsx](../src/components/admin/ReelStudio.tsx) · [src/components/admin/LiveDirector.tsx](../src/components/admin/LiveDirector.tsx) | خاص |
| المونتير الآلي | توليد مشاهد الريل وتصديرها (يُضمَّن في اللوحة) | `/monteur` | [public/monteur/index.html](../public/monteur/index.html) · [docs/monteur/README.md](monteur/README.md) | خاص |
| قافلة الصوت والحوار اليدوي | طابور الصوت، تحرير حلقات البودكاست مداخلةً مداخلة، قاموس النطق | داخل `/admin` | [src/components/admin/SoundCaravanBoard.tsx](../src/components/admin/SoundCaravanBoard.tsx) · [src/components/admin/ManualDialogueEditor.tsx](../src/components/admin/ManualDialogueEditor.tsx) · [src/components/admin/PronunciationLexicon.tsx](../src/components/admin/PronunciationLexicon.tsx) | خاص |
| التحليلات | المشاهدات ورحلة الزائر، خاصة بالمشرف | داخل `/admin` | [src/components/admin/UsageAnalytics.tsx](../src/components/admin/UsageAnalytics.tsx) · [docs/ANALYTICS.md](ANALYTICS.md) | خاص |
| مِحور | مساحة قراءة خاصة تجمع خلاصات مصادر عامة | `/mihwar` (دخول المشرف) | [src/pages/Mihwar.tsx](../src/pages/Mihwar.tsx) · [scripts/mihwar-feed.mjs](../scripts/mihwar-feed.mjs) | خاص |
| استوديو المحاضرات | بوابة تفتح استوديو محلياً على جهاز الدكتور | `/live` (noindex) | [src/pages/Live.tsx](../src/pages/Live.tsx) | محلي |
| مساعد واتساب | بوت ومحادثات وحملات، يعمل على جهاز Mac عبر launchd | لوحة «مساعد واتساب» | [whatsapp-agent/agent.mjs](../whatsapp-agent/agent.mjs) · [scripts/whatsapp-agent.mjs](../scripts/whatsapp-agent.mjs) · [WHATSAPP-AGENT-README.md](../WHATSAPP-AGENT-README.md) | محلي |
| تطبيق Apple | غلاف Capacitor لـiOS/iPadOS/Mac مع بيانات المتجر وسكربت الإصدار | — | [apple/capacitor.config.json](../apple/capacitor.config.json) · [apple/apple-release.sh](../apple/apple-release.sh) · [apple-release/](../apple-release) | قيد التطوير |
| وضع العرض التوضيحي | الموقع واللوحة ببياناتٍ خيالية بلا Firebase | `npm run demo` | [src/demo/seed.ts](../src/demo/seed.ts) · [src/demo/api-mock.ts](../src/demo/api-mock.ts) | يعمل محلياً |

## ٦) نقاط الخادم `dr-api` (Cloud Run)

كل `/api/**` يُعاد توجيهه من Firebase Hosting إلى خدمة `dr-api`
([firebase.json](../firebase.json)). المصدر كله في [server.mjs](../server.mjs).

| المجموعة | المسارات | الوصول |
| --- | --- | --- |
| عامة | `/api/version` · `/api/analytics/event` · `/api/journey` · `/api/oembed` | مفتوحة (مع حدود معدّل) |
| الموسوعة | `/api/encyclopedia/videos` · `/api/encyclopedia/video-search` · `/api/encyclopedia/video-moment` | مفتوحة |
| سؤال الأرشيف | `/api/ai/archive-answer` | مفتوحة بحدّ معدّلٍ وسقفٍ يومي |
| أدوات الذكاء | `/api/ai/*` (اقتراح المقال، تحليل البحث، حزمة النشر، الريل، المونتير، صور الاستوديو) | رمز Firebase + ادّعاء `admin`؛ Gemini مع بديل Cloudflare Workers AI |
| الإدارة | `/api/admin/*` (مركز التحكم، النشر، الصوت، البودكاست، التحليلات، جواز النشر) | رمز Firebase + ادّعاء `admin` |
| المجدول | `/api/cron/radar` | مفتاح المهمة المجدولة |

## ٧) الأتمتة — كل الـWorkflows مجمّعةً بحسب الغرض

كلها في [.github/workflows/](../.github/workflows). «يدوي» = `workflow_dispatch` فقط.

### النشر
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [firebase-hosting-live.yml](../.github/workflows/firebase-hosting-live.yml) | بوابة فحوص (tsc والحرّاس) ثم البناء والنشر إلى Firebase Hosting | يدوي · بعد نجاح «توليد الصوت إلى R2» أو «نشر الخمس الكويتية» |
| [scheduled-content-release.yml](../.github/workflows/scheduled-content-release.yml) | يطلق المحتوى المجدول ويستدعي النشر إن استحقّ شيء | يومي · يدوي |
| [project-status-sync.yml](../.github/workflows/project-status-sync.yml) | يعيد توليد PROJECT-STATUS.md | عند الرفع |

### المحتوى والانتقاء
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [auto-site-content.yml](../.github/workflows/auto-site-content.yml) | نشر الرسائل والأسئلة تلقائياً | مرّتان يومياً · رفع · يدوي |
| [auto-testimonials.yml](../.github/workflows/auto-testimonials.yml) | مزامنة «ماذا قالوا» | أسبوعي · رفع · يدوي |
| [daily-radar.yml](../.github/workflows/daily-radar.yml) | رادار المختارات من الإنترنت | أسبوعي (الأحد) · يدوي |
| [mihwar-feed.yml](../.github/workflows/mihwar-feed.yml) | جلب مصادر مِحور | يومي · يدوي |
| [check-curated-links.yml](../.github/workflows/check-curated-links.yml) | فحص روابط المصادر | أسبوعي · يدوي |
| [source-desk-watch.yml](../.github/workflows/source-desk-watch.yml) | حارس مكتب المصادر الشخصي | شهري · يدوي |
| [refresh-academic-presence.yml](../.github/workflows/refresh-academic-presence.yml) | تحديث حضور الملفات الأكاديمية | شهري · يدوي |
| [editorial-board-calibration.yml](../.github/workflows/editorial-board-calibration.yml) | معايرة مجلس التحرير | أسبوعي · يدوي |

### الصوت
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [auto-audio-r2.yml](../.github/workflows/auto-audio-r2.yml) | توليد صوت المقالات إلى R2 | رفعٌ يغيّر `src/data.ts` أو `src/data/bodies.json` · يدوي |
| [audio-dashboard-sync.yml](../.github/workflows/audio-dashboard-sync.yml) | مزامنة عدّاد الصوت الحي | كل ربع ساعة · يدوي |
| [audio-r2-migration.yml](../.github/workflows/audio-r2-migration.yml) · [media-audio-r2.yml](../.github/workflows/media-audio-r2.yml) | نقل الصوت وصوت الأرشيف الإعلامي إلى R2 | يدوي |
| [admin-audio-clear.yml](../.github/workflows/admin-audio-clear.yml) · [admin-audio-reset.yml](../.github/workflows/admin-audio-reset.yml) | إلغاء صوت مقال أو تصفير الصوت (من لوحة التحكم) | يدوي |

### البودكاست — الإنتاج والنشر
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [podcast-pilot-release.yml](../.github/workflows/podcast-pilot-release.yml) | إطلاق البودكاست من الحوار المرفوع فقط | أسبوعي · يدوي |
| [podcast-soul-forge.yml](../.github/workflows/podcast-soul-forge.yml) | توليد الحلقات الحوارية | يدوي |
| [podcast-dialogue-final-review.yml](../.github/workflows/podcast-dialogue-final-review.yml) | حلقة كاملة للاعتماد | يدوي |
| [podcast-kuwaiti-production-batch.yml](../.github/workflows/podcast-kuwaiti-production-batch.yml) | إنتاج حلقة كويتية قابلة للاستئناف | يدوي |
| [podcast-kuwaiti-promote.yml](../.github/workflows/podcast-kuwaiti-promote.yml) · [podcast-kuwaiti-publish-approved-five.yml](../.github/workflows/podcast-kuwaiti-publish-approved-five.yml) | اعتماد ونشر الحلقات الكويتية | يدوي |

### البودكاست — مختبرات الصوت والتجارب (تجريبي)
كلها يدوية، لتجربة الأصوات واللهجة قبل الاعتماد:
[podcast-dialogue-trial.yml](../.github/workflows/podcast-dialogue-trial.yml) ·
[podcast-voice-bakeoff.yml](../.github/workflows/podcast-voice-bakeoff.yml) ·
[podcast-voice-bakeoff-kw.yml](../.github/workflows/podcast-voice-bakeoff-kw.yml) ·
[podcast-voice-test.yml](../.github/workflows/podcast-voice-test.yml) ·
[podcast-finalist-retest.yml](../.github/workflows/podcast-finalist-retest.yml) ·
[podcast-male-finalist-retest.yml](../.github/workflows/podcast-male-finalist-retest.yml) ·
[podcast-prompt-experiment.yml](../.github/workflows/podcast-prompt-experiment.yml) ·
[podcast-word-audition.yml](../.github/workflows/podcast-word-audition.yml) ·
[podcast-kuwaiti-pilot.yml](../.github/workflows/podcast-kuwaiti-pilot.yml) ·
[podcast-kuwaiti-five-canaries.yml](../.github/workflows/podcast-kuwaiti-five-canaries.yml) ·
[podcast-kuwaiti-name-lab.yml](../.github/workflows/podcast-kuwaiti-name-lab.yml) ·
[podcast-kuwaiti-lexicon-screening.yml](../.github/workflows/podcast-kuwaiti-lexicon-screening.yml)

### الحراسة والمراقبة
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [site-guardian.yml](../.github/workflows/site-guardian.yml) | حارس الموقع وتقريره | أسبوعي · يدوي |
| [schedule-guard.yml](../.github/workflows/schedule-guard.yml) | حارس التوقّف الصامت: يفتح Issue إن تجاوز جدولٌ أساسيّ نافذة آخر نجاح | كل ٦ ساعات · يدوي |
| [uptime-alarm.yml](../.github/workflows/uptime-alarm.yml) | إنذار التوقف | كل ربع ساعة · يدوي |
| [domain-tls-watch.yml](../.github/workflows/domain-tls-watch.yml) | حارس النطاقات والشهادات | شهري · يدوي |
| [archive-scale-guard.yml](../.github/workflows/archive-scale-guard.yml) | حارس قابلية الأرشيف للتوسّع | رفع · طلب دمج · شهري · يدوي |
| [kuwaiti-no-silent-deletion.yml](../.github/workflows/kuwaiti-no-silent-deletion.yml) | لا يزول شيء صامتاً + فحوص البودكاست الكويتي | رفع · طلب دمج · يدوي |

### النسخ الاحتياطي
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [backup-firestore.yml](../.github/workflows/backup-firestore.yml) | نسخ Firestore وبروفة استرجاع | يومي · يدوي |
| [backup-storage.yml](../.github/workflows/backup-storage.yml) | نسخة مستقلة لملفات Storage | أسبوعي · يدوي |
| [backup-audio-release.yml](../.github/workflows/backup-audio-release.yml) | نسخة الصوت في GitHub Releases | أسبوعي · يدوي |

### التقارير
| Workflow | ما يفعله | التشغيل |
| --- | --- | --- |
| [daily-inbox.yml](../.github/workflows/daily-inbox.yml) | بريد المساء — رسائل اليوم | يومي · يدوي |
| [weekly-report.yml](../.github/workflows/weekly-report.yml) | تقرير الجمعة | أسبوعي · يدوي |

---

آخر تحديث للتوثيق: 2026-11-13
