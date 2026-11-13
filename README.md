# الموقع الرسمي — د. أحمد حسين الفيلكاوي

أرشيفٌ فكريّ حيّ: مقالات وكتب وأبحاث وظهورٌ إعلاميّ، ومقالاتٌ مسموعة وبودكاست حواري
وإذاعة، وموسوعةٌ مرئية لتكنولوجيا التعليم مع «موسوعة حيّة» تقرأ الكتاب المطبوع بالكاميرا،
ولوحة تحكّمٍ يديرها مالك الموقع وحده — تحرير، وتصميم، وإنتاج صوت وفيديو، وتحليلاتٌ للاستخدام الفعلي.

**الموقع:** <https://dr-alfailakawi.com> · **الموسوعة الحيّة:** <https://dr-alfailakawi.com/living> · **English:** <https://dr-alfailakawi.com/en>

[![نشر الموقع](https://github.com/ProfAlfailakawi/Dr.Ahmad/actions/workflows/firebase-hosting-live.yml/badge.svg)](.github/workflows/firebase-hosting-live.yml)
[![Site Guardian](https://github.com/ProfAlfailakawi/Dr.Ahmad/actions/workflows/site-guardian.yml/badge.svg)](.github/workflows/site-guardian.yml)
[![إنذار التوقف](https://github.com/ProfAlfailakawi/Dr.Ahmad/actions/workflows/uptime-alarm.yml/badge.svg)](.github/workflows/uptime-alarm.yml)
[![النسخ الاحتياطي](https://github.com/ProfAlfailakawi/Dr.Ahmad/actions/workflows/backup-firestore.yml/badge.svg)](.github/workflows/backup-firestore.yml)
[![Archive scale guard](https://github.com/ProfAlfailakawi/Dr.Ahmad/actions/workflows/archive-scale-guard.yml/badge.svg)](.github/workflows/archive-scale-guard.yml)

الأرقام الحيّة للمشروع في **[PROJECT-STATUS.md](PROJECT-STATUS.md)** — ملفٌ مولَّد
آلياً من المصدر. لا تُكتب أعدادٌ يدوية في هذا الملف حتى لا يَشيخ التوثيق بصمت.

---

## خريطة الميزات / Feature map

أبرز الميزات العامة هنا؛ **الخريطة الكاملة** (أدوات المشرف، نقاط الخادم، وكل الـWorkflows)
في [docs/FEATURES.md](docs/FEATURES.md). جدول المسارات مصدرٌ واحد: [src/App.tsx](src/App.tsx).

| الميزة | ما تفعله | الرابط المباشر | الشيفرة | الحالة |
| --- | --- | --- | --- | --- |
| الرئيسية | العتبة، «فكرة اليوم»، شريط «الآن» | [/](https://dr-alfailakawi.com/) | [src/pages/Home.tsx](src/pages/Home.tsx) | يعمل |
| المقالات | الأرشيف وصفحة المقال مع تتبّع الجملة أثناء الاستماع | [/articles](https://dr-alfailakawi.com/articles) | [src/pages/Articles.tsx](src/pages/Articles.tsx) · [src/pages/ArticleDetail.tsx](src/pages/ArticleDetail.tsx) | يعمل |
| الكتب | المؤلفات وصفحة لكل كتاب مع بوابة الموسوعة | [/publications](https://dr-alfailakawi.com/publications) | [src/pages/Publications.tsx](src/pages/Publications.tsx) · [src/pages/BookDetail.tsx](src/pages/BookDetail.tsx) | يعمل |
| الأبحاث | المساهمات العلمية مع تصدير BibTeX | [/research](https://dr-alfailakawi.com/research) | [src/pages/Research.tsx](src/pages/Research.tsx) · [src/pages/PaperDetail.tsx](src/pages/PaperDetail.tsx) | يعمل |
| الإعلام | اللقاءات (يوتيوب وإذاعة) والبحث داخل الكلام المفرَّغ | [/media](https://dr-alfailakawi.com/media) | [src/pages/Media.tsx](src/pages/Media.tsx) · [src/pages/MediaDetail.tsx](src/pages/MediaDetail.tsx) | يعمل |
| مجلس الفكرة (الاستماع والبودكاست) | المقالات المسموعة والحلقات الحوارية | [/listen](https://dr-alfailakawi.com/listen) | [src/pages/Listen.tsx](src/pages/Listen.tsx) | يعمل |
| الإذاعة | بثٌّ متزامن بساعة الكويت من جدولٍ ثابت | [/radio](https://dr-alfailakawi.com/radio) | [src/pages/Radio.tsx](src/pages/Radio.tsx) | يعمل |
| الموسوعة الحيّة | تطبيق كاميرا (AR) يتعرّف على صفحات الكتاب المطبوع ويعرض مشاهد وفيديو | [/living](https://dr-alfailakawi.com/living) | [public/living/app.js](public/living/app.js) | يعمل |
| محرك المعرفة | بحث موحّد في المقالات والكتب والأبحاث والتفريغات | [/search](https://dr-alfailakawi.com/search) | [src/pages/Search.tsx](src/pages/Search.tsx) | يعمل |
| اسأل المكتبة | سؤال حرّ يُجاب من أرشيف الدكتور وحده باقتباساتٍ حرفية | [/ask](https://dr-alfailakawi.com/ask) | [src/pages/AskLibrary.tsx](src/pages/AskLibrary.tsx) | يعمل (يعتمد على الخادم) |
| منظومة الفكرة | الأطلس، مسارات الفكرة، مسارات التعلّم، وثيقة العقد | [/thought](https://dr-alfailakawi.com/thought) | [src/pages/ThoughtOverview.tsx](src/pages/ThoughtOverview.tsx) · [src/pages/Atlas.tsx](src/pages/Atlas.tsx) · [src/pages/LearningPaths.tsx](src/pages/LearningPaths.tsx) | يعمل |
| المختارات والرادار | مواد من مصادر موثوقة مختارة، وأرشيفها الأسبوعي | [/curated](https://dr-alfailakawi.com/curated) | [src/pages/Curated.tsx](src/pages/Curated.tsx) · [src/pages/Radar.tsx](src/pages/Radar.tsx) | يعمل |
| السيرة والأثر | السيرة الأكاديمية وملفاتها، وسجل الأثر | [/cv](https://dr-alfailakawi.com/cv) | [src/pages/CV.tsx](src/pages/CV.tsx) · [src/pages/Impact.tsx](src/pages/Impact.tsx) | يعمل |
| التواصل والبطاقة | التواصل، الأسئلة، اللقاءات القادمة، البطاقة الرقمية (vCard) | [/contact](https://dr-alfailakawi.com/contact) | [src/pages/Contact.tsx](src/pages/Contact.tsx) · [src/pages/Card.tsx](src/pages/Card.tsx) | يعمل |
| المرآة الإنجليزية | الرئيسية والسيرة والأبحاث والتواصل | [/en](https://dr-alfailakawi.com/en) | [src/pages/English.tsx](src/pages/English.tsx) | يعمل |
| لوحة الإدارة | النشر والتصميم والصوت والفيديو والتحليلات — للمشرف وحده | `/admin` | [src/pages/Admin.tsx](src/pages/Admin.tsx) · [src/components/admin/admin-navigation.ts](src/components/admin/admin-navigation.ts) | خاص |
| البودكاست الكويتي | حلقات حوارية باللهجة الكويتية عبر بوابات اعتماد | ضمن `/listen` | [scripts/podcast-kuwaiti-gemini.mjs](scripts/podcast-kuwaiti-gemini.mjs) | تجريبي |
| مساعد واتساب | بوت ومحادثات وحملات، يعمل على جهاز Mac لا على الخادم | من لوحة الإدارة | [whatsapp-agent/agent.mjs](whatsapp-agent/agent.mjs) · [WHATSAPP-AGENT-README.md](WHATSAPP-AGENT-README.md) | محلي |
| تطبيق Apple | غلاف Capacitor لـiOS/iPadOS/Mac مع بيانات المتجر | — | [apple/capacitor.config.json](apple/capacitor.config.json) · [apple/apple-release.sh](apple/apple-release.sh) | قيد التطوير |

## المعمارية

| الطبقة | الأداة | الموضع |
| --- | --- | --- |
| الواجهة | React 19 · TypeScript 5.5 · Vite 8 | [src/main.tsx](src/main.tsx) · [src/App.tsx](src/App.tsx) |
| التنسيق | Tailwind 3.4 · Framer Motion 11 | [tailwind.config.js](tailwind.config.js) · [DESIGN.md](DESIGN.md) |
| التوجيه | React Router 8 | [src/App.tsx](src/App.tsx) |
| البيانات | بياناتٌ ثابتة في `src/data*` + Firestore للمحتوى الحيّ | [src/data.ts](src/data.ts) · [docs/FIRESTORE.md](docs/FIRESTORE.md) |
| الصوت | Cloudflare R2 (خارج المستودع دائماً) | [docs/MEDIA-AUDIO-HOSTING.md](docs/MEDIA-AUDIO-HOSTING.md) |
| الخادم | Node على Cloud Run (خدمة `dr-api`) | [server.mjs](server.mjs) · [Dockerfile](Dockerfile) |
| الأتمتة | GitHub Actions | [.github/workflows/](.github/workflows) |

يعيد Firebase Hosting توجيه كل `/api/**` إلى `dr-api` ([firebase.json](firebase.json)). أهم النقاط في [server.mjs](server.mjs):

- **عامة:** `/api/version` · `/api/analytics/event` · `/api/journey` · `/api/encyclopedia/*`.
- **سؤال الأرشيف:** `/api/ai/archive-answer` — مفتوح بحدّ معدّلٍ وسقفٍ يومي.
- **أدوات الذكاء** `/api/ai/*` و**الإدارة** `/api/admin/*`: تتطلّب رمز Firebase بادّعاء `admin`.
  أدوات الذكاء تستدعي Gemini إن وُجد مفتاحه، وتهبط إلى Cloudflare Workers AI
  ([CLOUDFLARE-WORKERS-AI-SETUP.md](CLOUDFLARE-WORKERS-AI-SETUP.md)).

التفصيل في [ARCHITECTURE.md](ARCHITECTURE.md)، والقائمة الكاملة للنقاط في [docs/FEATURES.md](docs/FEATURES.md).

### بنية المجلدات

```
src/
  pages/            صفحات المسارات
  components/       مكوّنات الواجهة العامة
  components/admin/ شاشات لوحة التحكّم (المصدر الوحيد: admin-navigation.ts)
  lib/              المنطق: البحث، الاستشهاد، التحليلات، الصوت، المحرّر
  data/             بياناتٌ ثابتة مولَّدة أو محرَّرة
  server/           منطقٌ يشاركه الخادم
  demo/             وحدات وضع العرض التوضيحي
public/living/      الموسوعة الحيّة (تطبيق مستقل بـthree.js)
public/monteur/     المونتير الآلي (يُضمَّن في لوحة الإدارة)
whatsapp-agent/     مساعد واتساب (يعمل محلياً على Mac)
apple/              غلاف تطبيق Apple (Capacitor)
scripts/            البناء والحرّاس والفحوص والأتمتة
docs/               وثائق الأنظمة المتخصّصة
dist/               ناتج البناء — لا يُعدَّل يدوياً
```

## التشغيل المحلي

**المتطلبات:** Node ‏`>=24 <25` (انظر [.nvmrc](.nvmrc)) · npm (المشروع على `package-lock.json`).

```bash
npm install        # أو npm ci لتثبيتٍ مطابق للقفل
npm run dev
```

| الأمر | ما يفعله |
| --- | --- |
| `npm run dev` | خادم تطوير Vite |
| `npm run demo` | الموقع واللوحة ببياناتٍ خيالية بلا Firebase (انظر أدناه) |
| `npm run build` | البناء الكامل مع كل الحرّاس |
| `npm run preview` | معاينة الناتج المبني |
| `npm run prerender` | توليد الصفحات الثابتة وحدها |
| `npm run start` | تشغيل الخادم `server.mjs` |
| `npm run project:status` | إعادة توليد PROJECT-STATUS.md |

### وضع العرض التوضيحي (Demo)

```bash
npm run demo                      # خادم تطوير (بما فيه واجهات الموسوعة المرئية)
npm run demo:build && npm run demo:preview   # نسخة مبنية على المنفذ 3000
```

يُفعَّل بالمتغيّر `VITE_DEMO_MODE=1` وحده؛ يستبدل Vite عندها وحدات Firebase بنسخٍ في الذاكرة
([src/demo/](src/demo)) مُهيَّأة من [src/demo/seed.ts](src/demo/seed.ts)، وتردّ
[src/demo/api-mock.ts](src/demo/api-mock.ts) على مسارات `/api/*`. الدخول إلى `/admin` تلقائي بحساب
مشرفٍ تجريبي، وكل ما يُكتب يبقى في الذاكرة ويزول بإعادة التحميل. لا أثر على الإنتاج لأن الاستبدال
شرطه المتغيّر. ملفات الصوت (R2) ليست في المستودع: في وضع العرض يُخدَم لكل mp3 مفقود ملف صامت مولَّد
محلياً كي لا تظهر أخطاء تحميل؛ فلا يُسمع كلام. ومولّدات الذكاء تردّ بنتائج جاهزة من
[src/demo/ai-mock.ts](src/demo/ai-mock.ts).

## الاختبارات وبوابات الجودة

`npm run build` ليس `vite build` وحده: يسبقه حرّاسٌ وفحوص (سياق Cloud Run، الجسور الحرجة،
الرموز البصرية، معمارية الموقع، التنوين والطباعة العربية، فحوص الموسوعة والصوت والفيديو)،
ويليه توليدُ الصفحات الثابتة وsitemap وRSS، ثم فحص الروابط وتطابق التوثيق وميزانية الأداء
والتحقق من ترحيل النطاق. سقوط أيّ حارسٍ يوقف البناء عمداً. السكربتات كلها في [scripts/](scripts).

```bash
npm run lint                        # tsc --noEmit
npm run test:smoke                  # الصفحات الثابتة
npm run test:performance            # ميزانية الأداء
npm run links:internal              # الروابط الداخلية في dist
npm run docs:check                  # تطابق التوثيق مع المشروع
npm run citations:bibtex:self-test  # الاستشهادات وBibTeX
npm run search:deeplink:self-test   # الرابط العميق في البحث
npm run podcast:ar:self-test        # قفل الحوار اليدوي وبوابات البودكاست
npm run podcast:kw:self-test        # سلسلة فحوص البودكاست الكويتي
npm run backup:self-test            # النسخ الاحتياطي والاسترجاع
npm run upgrades:self-test          # عقود الترقيات المجمّعة
```

القائمة الكاملة لأوامر الفحص في [package.json](package.json)، وعددها المحدَّث في `PROJECT-STATUS.md`.

**في CI:** بوابة [firebase-hosting-live.yml](.github/workflows/firebase-hosting-live.yml) تشغّل
`tsc` والحرّاس ثم `npm run build` قبل أي نشر؛ و[kuwaiti-no-silent-deletion.yml](.github/workflows/kuwaiti-no-silent-deletion.yml)
و[archive-scale-guard.yml](.github/workflows/archive-scale-guard.yml) تعملان على كل رفعٍ وطلب دمج.

## النشر

| الطبقة | كيف يُنشر | المرجع |
| --- | --- | --- |
| الموقع (Firebase Hosting) | Workflow **«نشر الموقع على Firebase Hosting»**: تلقائياً عند كل رفعٍ إلى `main` (عدا ملفات `*.md` و`docs/` و`.github/` الأخرى)، ويدوي (`workflow_dispatch`)، وبعد نجاح «توليد الصوت إلى R2» (رفعٌ يغيّر `src/data.ts` أو `src/data/bodies.json` يُنشر من هذا المسار وحده بعد جاهزية الصوت) أو «نشر الخمس الكويتية»، أو حين يجد [scheduled-content-release.yml](.github/workflows/scheduled-content-release.yml) محتوىً مستحقّاً. محلياً: `npm run deploy:hosting`. | [firebase-hosting-live.yml](.github/workflows/firebase-hosting-live.yml) |
| قواعد البيانات والتخزين | `npm run deploy:data-rules` (يدوي) | [firestore.rules](firestore.rules) · [storage.rules](storage.rules) |
| الخادم `dr-api` | يُنشر يدوياً إلى Cloud Run؛ لا ينشره مسار الموقع | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

> رفعُ شيفرةٍ إلى `main` وحده لا ينشر الموقع ما لم يمسّ ملفات المقالات؛ شغّل الـWorkflow يدوياً بعد الدمج.

### الأتمتة — مجمّعةً بحسب الغرض

| الغرض | ما يشمله | أمثلة |
| --- | --- | --- |
| النشر | البوابة والبناء والنشر، الإطلاق المجدول، تحديث حالة المشروع | [firebase-hosting-live.yml](.github/workflows/firebase-hosting-live.yml) · [scheduled-content-release.yml](.github/workflows/scheduled-content-release.yml) |
| المحتوى والانتقاء | الرسائل والأسئلة، الشهادات، الرادار، مِحور، فحص المصادر، معايرة مجلس التحرير | [auto-site-content.yml](.github/workflows/auto-site-content.yml) · [daily-radar.yml](.github/workflows/daily-radar.yml) |
| الصوت | توليد صوت المقالات إلى R2، العدّاد الحي، الترحيل، الإلغاء والتصفير | [auto-audio-r2.yml](.github/workflows/auto-audio-r2.yml) |
| البودكاست | الإنتاج والاعتماد والنشر، ومختبرات الأصوات واللهجة (تجريبية، يدوية) | [podcast-pilot-release.yml](.github/workflows/podcast-pilot-release.yml) · [podcast-kuwaiti-production-batch.yml](.github/workflows/podcast-kuwaiti-production-batch.yml) |
| الحراسة والمراقبة | حارس الموقع، إنذار التوقف، النطاقات والشهادات، توسّع الأرشيف | [site-guardian.yml](.github/workflows/site-guardian.yml) · [uptime-alarm.yml](.github/workflows/uptime-alarm.yml) |
| النسخ الاحتياطي | Firestore وStorage والصوت | [backup-firestore.yml](.github/workflows/backup-firestore.yml) |
| التقارير | بريد المساء وتقرير الجمعة | [weekly-report.yml](.github/workflows/weekly-report.yml) |

الجدول الكامل لكل Workflow ومشغّله في [docs/FEATURES.md](docs/FEATURES.md).

## المتغيرات البيئية

القائمة الكاملة بأسمائها وشروحها — بلا قيم — في [.env.example](.env.example).
**لا يُلتزم بأي سرٍّ في المستودع.** المستودع عامّ عمداً (دقائق Actions المجانية)،
فأي ملفٍ خاصّ يُخرَج من المستودع ولا يُخصخص المستودع. أسرار الأتمتة (Azure Speech،
حساب خدمة Firebase، مفاتيح التخزين، Gemini) تُسجَّل في GitHub Secrets أو بيئة Cloud Run.

## ملفات مولَّدة — لا تُحرَّر يدوياً

`PROJECT-STATUS.md` · `dist/**` · `reports/**` · `src/data/knowledge-graph*.json` ·
`src/data/article-pivots.json` · `src/data/listen-index.json` ·
`src/data/book-passages.json` · `src/data/encyclopedia-video-transcripts.json` ·
`src/data/audio*.json`. تعديلها يدوياً يُدهَس في البناء التالي.

## الموقع العام ولوحة الإدارة

- **الموقع العام:** يقرأ البيانات الثابتة أولاً ثم يُثريها من Firestore، ويعمل
  كاملاً حتى لو تعذّر Firebase.
- **لوحة الإدارة (`/admin`):** خلف مصادقة Firebase بادّعاء `admin`، و`noindex`،
  ويستخدمها شخصٌ واحد. تحليلاتها خاصّة ولا تظهر في الموقع العام.

## وثائق الأنظمة

| النظام | الوثيقة |
| --- | --- |
| خريطة الميزات الكاملة | [docs/FEATURES.md](docs/FEATURES.md) |
| المعمارية العامة | [ARCHITECTURE.md](ARCHITECTURE.md) |
| الهوية البصرية | [DESIGN.md](DESIGN.md) |
| البحث والموسوعة | [docs/SEARCH.md](docs/SEARCH.md) |
| البودكاست والحوار اليدوي | [docs/PODCAST.md](docs/PODCAST.md) |
| الصوت والاستضافة | [docs/MEDIA-AUDIO-HOSTING.md](docs/MEDIA-AUDIO-HOSTING.md) |
| الاستشهادات | [docs/CITATIONS.md](docs/CITATIONS.md) |
| التحليلات والخصوصية | [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| لوحة الإدارة | [docs/ADMIN.md](docs/ADMIN.md) |
| مجموعات Firestore | [docs/FIRESTORE.md](docs/FIRESTORE.md) |
| أرشيف 2036 والتوسّع | [docs/ARCHIVE-2036.md](docs/ARCHIVE-2036.md) |
| الأمان وحدوده | [SECURITY-NOTES.md](SECURITY-NOTES.md) |
| التعافي من الكوارث | [DISASTER-RECOVERY.md](DISASTER-RECOVERY.md) |
| النشر | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

## حالة المشروع

قيد التطوير النشط. آخر تحقّقٍ آليّ من هذا التوثيق مسجَّل في `PROJECT-STATUS.md`،
ويُعاد التحقّق بـ`npm run docs:check`.

آخر تحديث للتوثيق: 2026-11-12
