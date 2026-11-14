# iPhone Duo — قبول الجولة النهائية: الكتاب المفتوح (14 نوفمبر 2026)

> **تحديث الجولة الثانية:** الكتاب صار عرضياً فقط (721–1000 × 520–960)، ونُسخ فرع الطولي 640–720 وشرط 7:5؛ انظر [IPHONE-DUO-ROUND2.md](IPHONE-DUO-ROUND2.md). ما يرد أدناه عن «كتاب طولي» تاريخي.

> **الأجزاء 3–5 (#231، #232، وهذا):** المسارات الـ32 الباقية صارت كتاباً مفتوحاً صفحةً صفحة (القسم 2)، ومعها أدوات مشتركة صغيرة داخل استعلام الكتاب: `.duo-sheet` (صفحة | كعب | صفحة)، `.duo-stack`/`.duo-pair` (سكك البطاقات عموداً في صفحة أو عمودين عند الكعب)، `.duo-chapter` (رأس الفصل ثابت يساراً ومحتواه يميناً)، `.duo-half`، `.duo-quad`، `.duo-seals`. المشغّل العائم يسكن الصفحة اليسرى. النتيجة: **0 عنصر على الكعب في المسارات الـ47 كلها**.

> **الجزء الثاني (بعد دمج #229):** «بوصلة الفكر» في الرئيسية (المحاور والخريطة يميناً ومقالات المحور يساراً، فلا يقع مركز الخريطة على المفصل)، الأبحاث (القائمة يميناً والفهرسة والتصفية يساراً ثابتة)، لوحات «بالأرقام» (الحلقات يميناً والخط الزمني يساراً)، شريط المنظومة الفكرية ترويسةً على الصفحة اليمنى (العقد، مسارات الفكر، المسارات، الفكر، الأثر)، ترقيم الصفحات في ذيل الصفحة اليمنى، «عالم الكتاب» فهرساً من عمودين، صدى العنوان في الشريط العلوي مخفي في الشاشة الداخلية، وكل الاستعلامات مقيّدة بـ `screen` (مراجعة Codex على #229). القياس صار يمسح الصفحة كلها (خمسة مواضع) لا أعلاها فقط.

تبني هذه الجولة على [IPHONE-DUO-ADAPTIVE-QUALITY.md](IPHONE-DUO-ADAPTIVE-QUALITY.md) (#226) ولا تعيد فتح ما حُلّ فيها (موضع القراءة، الارتفاع المضغوط، حواف الأمان، عمود مِحور الجانبي في 600×350).

**المشكلة:** الشاشة الداخلية في وضع الكتاب (≈669×867 طولياً و≈951×585 عرضياً) كانت تعرض عموداً واحداً ممطوطاً كصفحة آيباد، والعنوان والفقرات والأزرار تعبر خط المفصل.

**الحل:** صفحتان بينهما كعب هادئ (32px، خط شعري وظل طيّ خفيف) في منتصف النافذة. لكل صفحة دور: المهمة الأساسية على اليمنى (بداية القراءة بالعربية) والسياق على اليسرى. CSS وحده؛ لم يُعَد تركيب أي مكوّن عند الطي، ولم تُمَسّ البيانات ولا المسارات ولا المصادقة ولا Firestore ولا الخادم ولا النشر ولا مفاتيح حفظ القراءة.

رموز الحالة: `PASS` قيس ورُوجعت لقطته بالعين · `PASS·م` قيس آلياً فقط (0 تمرير أفقي، 0 مقصوص، 0 على الكعب) ولم تُراجَع لقطته بالعين · `PARTIAL` يعمل لكن بقي عنصر أو أكثر على الكعب أو جزء لم يُصمَّم · `FAIL` خلل · `BLOCKED` يحتاج جهازاً · `NOT_TESTED` لم يُختبر.

## 1. كيف يُقرَّر «الكتاب المفتوح»

| الحالة | الشرط (من مساحة النافذة وحدها) |
|---|---|
| كتاب طولي (C) | عرض 640–720 وارتفاع ≥ 520 (669×867، 669×520) |
| كتاب عرضي (D) | عرض 880–1000 وارتفاع ≥ 520 ونسبة ≥ 7:5 (951×585). لا يدخل آيباد 768×1024 ولا 1024×768 |
| مفصل حقيقي | `@media (horizontal-viewport-segments: 2)` يفعّل الكتاب أياً كان المقاس، ويصير عرض الكعب `env(viewport-segment-left 1 0) − env(viewport-segment-right 0 0) + 16px` (حدّه الأدنى 32px) |
| الطباعة | كل الاستعلامات أعلاه مقيّدة بـ `screen`: عرض صفحة A4 (≈658px) يقع في 640–720، فبغير القيد كان المقال المطبوع/PDF يُضغط في نصف الصفحة. مقيس: في `print` يعود `.article-spread` إلى `block` والمكتب إلى `static` (مراجعة Codex) |
| حاسوب/عريض قصير (E، B) | ارتفاع ≤ 480 ونسبة ≥ 3:2: رأس الصفحة سطر من عمودين، والصفحات ذات المهمتين (التواصل، البحث، 404، الكتاب) عمودان، وأدوات المقال شريط سفلي ثابت يُحجز له حشو |

الملفات: [src/index.css](../src/index.css) (القسم «iPhone Duo — الكتاب المفتوح»)، [src/pages/mihwar.css](../src/pages/mihwar.css) (داخل Shadow DOM)، وسطر واحد في [src/beauty.css](../src/beauty.css) (متغيّر `--floating-right` بدل قيمة ثابتة كي لا نكدّس `!important`). وفي الصفحات: أسماء أصناف فقط (`article-spread__*`، `contact-spread`، `not-found-spread`، `book-spread`، `search-spread`، `legal-spread`، `duo-book`).

## 2. ما صار عليه كل مشهد

| الشاشة | الصفحة اليمنى (المهمة) | الصفحة اليسرى (السياق) | العريض القصير (E/B) |
|---|---|---|---|
| قارئ المقال | التصنيف والتاريخ والعنوان ثم النص كله، ثم الامتدادات والمشاركة والتنقل | «مكتب القارئ» ثابت أثناء القراءة: المشغّل، حجم الخط/الحفظ/السكينة، «موقعها في السماء» | المحتوى فوق وشريط أدوات سفلي ثابت لا يغطي النص |
| أرشيف المقالات | الرأس والتصنيفات | الوصف، البحث والتصفية | الرأس سطر من عمودين |
| — المختارات والفهرس | عمودان يلتقيان عند الكعب (كل مقال صفحة) | | |
| المؤلفات | شبكة عمودين فجوتها الكعب؛ الموسوعة المميزة تأخذ صفحة واحدة | | |
| صفحة الكتاب | الغلاف والعنوان والبيانات والأفعال | لمحة الكتاب، «عن الكتاب»، الفهرس | الغلاف والعنوان متجاوران |
| البحث | مدخل المعرفة، حقل السؤال، التبويبات والفلاتر (ثابتة) | النتائج أو «لا نتائج» واقتراحاتها | عمودان |
| التواصل | الدعوة والخدمات (ثابتة) | نموذج الحجز | عمودان |
| 404 | الرسالة والعودة | البحث والوجهات | عمودان |
| الصفحات القانونية (3) | النص العربي ومفاتيحه | النسخة الإنجليزية مقابله | — |
| مِحور | العنوان والبحث والفلاتر والتبويبات والتنبيه (فهرس العمل) | المواد نفسها. استثناء مقصود من «الأساسي يميناً»: في العرضي يشغل الشريط الجانبي أصلاً نصف الصفحة اليمنى | 600×350 عمود جانبي (#226) |
| مِحور — الشريط السفلي (669) | «العالم» و«شغلي» | «+ إضافة» — لا زر على الكعب | |
| الرئيسية — الغلاف | الصورة | العنوان والاسم وبطاقة «المسيرة» | 594×368 صار عمودين بدل صورة تحت الحافة |
| التذييل (كل الصفحات) | الشعار والتواصل وسطر الحقوق | روابط الموقع المختصرة | |
| الشريط العلوي | عنوان الصفحة المصغّر بجوار الشعار بدل منتصف الشريط | | |
| الأزرار العائمة | | تنتقل إلى ذيل الصفحة اليسرى | الجهة اليمنى من الشريط السفلي متروكة لها |
| الرئيسية — العمق (الجزء 4) | «الآن»: المقال الأحدث؛ رؤوس الأقسام؛ «أربع زوايا» بطاقتان | شرارة اليوم والمجلس و«في مثل هذا الأسبوع»؛ رابط القسم؛ بطاقتان | كما كانت |
| `/questions` | السؤال الأحدث؛ الأسئلة السابقة | «رأيي» وأدواته؛ العنوان والتصفية (ثابتة) | — |
| `/curated` | المادة المختارة؛ الأرشيف | حالة التجدد ومفاتيح الواجهة؛ تصفية الأنواع (ثابتة) | — |
| `/inbox` | الرسالة؛ بطاقات الخيوط والرسائل والأسئلة (عمود) | تعقيب الدكتور؛ العمود المقابل | — |
| `/concept/:term` | خيط المحطات | الأنواع و«ما الذي تغيّر؟» (ثابتة) | — |
| `/listen` | الأسئلة ومشغّل الحلقة المضمّن | «افتح المجلس» والمنصات والبحث والتصفية (ثابتة) | — |
| المشغّل العائم (كل الصفحات) | | يسكن الصفحة اليسرى، أزراره سطر ثانٍ | — |
| `/media` | الواجهة والمسار الزمني | البحث داخل ما قيل وفهرس السنوات/الأنواع (ثابت) | — |
| `/media/:slug` | العنوان والمشغّل | تفاصيل الظهور والنص الزمني؛ المرتبطة بطاقتان | — |
| `/radio` | الجملة الحيّة | على الهواء واللهجة وجدول ما يلي | — |
| `/card`، `/cards` | الهوية وحفظ جهة الاتصال / الاسم والعبارة | الملفات والروابط / الأرقام والروابط والحفظ | — |
| الموسوعة | العنوان والبيانات؛ الأبواب والشروحات | الغلاف؛ البحث في الموسوعة (ثابت) | — |
| `/research/:slug` | الطبقات الثلاث ثم «داخل المشروع» والتالي | غلاف البحث وفهرس الطبقات (ثابت) | — |
| `/decade`، `/thought-paths`، `/paths/:id` | المحتوى (التوقعات، المراحل، السنوات، المحطات، الخطوات) | رأس الفصل أو بطاقة التقدّم (ثابت) | — |
| `/thought`، `/about`، `/paths` | لوحات متقابلة: اثنتان في كل صفحة | | — |
| `/impact` | أصل كل رحلة أثر؛ الأرقام | سلسلة أدلتها؛ التصفية وحصاد السنوات | — |
| `/cv` | العبارة؛ نسخ PDF؛ التعليم | التمهيد والمجالات؛ عنوانها؛ التدريس؛ المطويّات عمودان | — |
| `/upcoming` | بطاقات المواعيد | اللقاءات المنقضية والنشرة | — |
| `/radar` | الأسابيع وموادها | الأرقام وحصاد الأسابيع والسنوات | — |
| `/ask`، `?tab=askbook` | الجواب أو «كيف يعمل»؛ قائمة الكتب | السؤال (ثابت)؛ سؤال الكتاب | — |
| `/atlas` | المحاور والبحث والكوكبة والتلميح | تبديل طريقة العرض. السماء نفسها لوحة واحدة على الصفحتين (رسم لا نص) | — |
| `/admin` (لوحة «اليوم») | التحية و«ماذا تريد؟» | الأدوات والقرارات ونبض الموقع؛ شريط المجالات اثنان في كل صفحة | — |
| `/live` | العنوان وزر فتح الاستوديو | ضمانات الخصوصية والتعليمات | — |
| `/cv-file/:kind` | رسالة الانتظار | | — |
| `/en`، `/en/cv`، `/en/research`، `/en/contact` (LTR: الأولى يساراً) | الاسم والعبارة؛ السيرة عمودان؛ الفهرس المرقّم؛ الدعوة | التعريف والأبواب؛ الملفات العلمية؛ النموذج | — |
| بوابة الإنجليزية | العنوان والتمهيد | الأبواب الثلاثة | — |

## 3. جرد الشاشات (من `src/App.tsx`)

47 مساراً. كل مسار له صف في المصفوفة (القسم 4). الحالات الفرعية المختبرة: البحث فارغاً وبلا نتائج وتبويب «داخل كتاب»، نموذج التواصل بعد اختيار الموضوع (I)، لوحة البحث الموحّد مفتوحة (I)، 404 (`*` و`/mylib`)، حالة مِحور الفارغة وتنبيه الجالب، تحميل المقال ثم ظهور النص.

| المجموعة | المسارات |
|---|---|
| الدخول والرئيسية | `/`، `/launch`، `/live`، `/en` |
| القراءة | `/articles`، `/articles/:slug`، `/thought`، `/thought-paths`، `/decade`، `/concept/:term`، `/paths`، `/paths/:id`، `/atlas` |
| المؤلفات والبحث العلمي | `/publications`، `/publications/:slug` (كتاب عادي + الموسوعة)، `/research`، `/research/:slug`، `/en/research` |
| الصوت والمرئي | `/listen`، `/radio`، `/media`، `/media/:slug` |
| البحث والسؤال | `/search` (بداية، بلا نتائج، `?tab=askbook`)، `/ask`، `/questions`، `/radar` |
| السيرة والتواصل | `/cv`، `/cv-file/:kind`، `/impact/*`، `/about`، `/contact`، `/en/cv`، `/en/contact`، `/card`، `/cards` |
| المالك | `/mihwar` (عرض تجريبي)، `/admin` (عرض تجريبي)، `/inbox`، `/curated`، `/upcoming` |
| قانونية | `/privacy`، `/terms`، `/data-deletion` |
| خطأ | `*` (404)، `/mylib` |
| تحويلات بلا شاشة | `/now` ← `/`، `/cv/impact` ← `/impact` |

## 4. المصفوفة: الشاشات × الوضعيات

الوضعيات: **A** مطوي طولي (382×580، 385×571، 320×568) · **B** مطوي عرضي (594×368) · **C** كتاب طولي (669×867) · **D** كتاب عرضي (951×585) · **E** حاسوب (951×350، 600×350) · **F** نصف/قصير داخلي (669×520، 600×480) · **G** لوحي/مكتبي (768×1024 … 1440×900) · **H** هواتف مرجعية (360×640، 390×844، 844×390) · **I** انتقال حي بلا إعادة تحميل · **J** إجهاد الوصول.

المنصة: Playwright WebKit، `VITE_DEMO_MODE=1` (بيانات وهمية، Firestore وهمي، `/api/*` معترَضة؛ لا كتابة إلى أي خادم)، لمس، تقليل الحركة. الصفحات التسع الأولى قيست في 26 مقاساً؛ بقية المسارات في 9 مقاسات مفتاحية (382×580، 594×368، 669×867، 951×585، 951×350، 600×350، 669×520، 390×844، 1280×800)، فخلية لا مقاس لها هناك = `NOT_TESTED`. «على الكعب» = عدد العناصر النصية أو التفاعلية الظاهرة التي تقطع المنطقة (المركز ± 16px) في أعلى الصفحة وعند 20% و40% و60% و80% منها.

| الشاشة | المسار | A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|---|---|
| home | `/` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | PARTIAL |
| articles | `/articles` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| article | `/articles/aggression-in-the-sky-and-steadfastness-withinarabic` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| publications | `/publications` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | NOT_TESTED |
| book | `/publications/teaching` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | PARTIAL |
| search-empty | `/search?q=%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | PARTIAL |
| contact | `/contact` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL |
| mihwar | `/mihwar` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED |
| not-found | `/no-such-page-duo` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | PARTIAL |
| launch | `/launch` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| live | `/live` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| research | `/research` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| paper | `/research/faculty-attitudes-edtech` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| encyclopedia | `/publications/encyclopedia` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| listen | `/listen` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | PASS | NOT_TESTED |
| radio | `/radio` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| search-start | `/search` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | PARTIAL |
| search-askbook | `/search?tab=askbook` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | PARTIAL |
| ask | `/ask` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| decade | `/decade` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| thought-paths | `/thought-paths` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| paths | `/paths` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| path | `/paths/ai-and-the-learner` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| concept | `/concept/%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| thought | `/thought` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| atlas | `/atlas` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| media | `/media` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| media-detail | `/media/radio-idaa` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| questions | `/questions` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| radar | `/radar` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| admin | `/admin` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | FAIL ( 4 مقصوص) | PASS·م | NOT_TESTED | NOT_TESTED |
| curated | `/curated` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| upcoming | `/upcoming` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| inbox | `/inbox` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| about | `/about` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| cv | `/cv` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| impact | `/impact` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| cv-file | `/cv-file/ar` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| card | `/card` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| cards | `/cards` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| privacy | `/privacy` | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | NOT_TESTED | NOT_TESTED |
| terms | `/terms` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| data-deletion | `/data-deletion` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| mylib | `/mylib` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| en | `/en` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| en-cv | `/en/cv` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| en-research | `/en/research` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |
| en-contact | `/en/contact` | PASS·م | PASS·م | PASS | PASS | PASS·م | PASS | PASS·م | PASS·م | NOT_TESTED | NOT_TESTED |

`PASS` في C/D/F: صفحتان مصمَّمتان وروجعت لقطاتهما بالعين؛ `PASS·م`: المقاييس سليمة (لا تمرير أفقي، لا قص، لا شيء على الكعب) دون مراجعة بصرية لهذا المقاس تحديداً في هذه الجولة. CSS الأجزاء 3–5 كلها داخل استعلام الكتاب المفتوح، فالوضعيات A/B/E/G/H لم يتغير فيها شيء عن الجزأين الأولين.

**عناصر على الكعب في الشاشات الداخلية لكل مسار** (669×867 + 951×585 + 669×520، كل منها في أعلى الصفحة وعند 20/40/60/80% من طولها؛ أي عنصر يُعدّ مرة واحدة في كل مقاس). «قبل» = `audit-routes.json` بعد الجزء الثاني (#230)؛ «بعد» = القياس الكامل الأخير:

| المسار | قبل الأجزاء 3–5 | بعد |
|---|---|---|
| `/concept/%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85` | 203 | 0 |
| `/listen` | 110 | 0 |
| `/en` | 82 | 0 |
| `/en/research` | 77 | 0 |
| `/media` | 76 | 0 |
| `/card` | 66 | 0 |
| `/publications/encyclopedia` | 63 | 0 |
| `/admin` | 62 | 0 |
| `/impact` | 57 | 0 |
| `/cv` | 48 | 0 |
| `/research/faculty-attitudes-edtech` | 45 | 0 |
| `/upcoming` | 45 | 0 |
| `/en/cv` | 40 | 0 |
| `/decade` | 39 | 0 |
| `/paths/ai-and-the-learner` | 38 | 0 |
| `/questions` | 37 | 0 |
| `/thought-paths` | 36 | 0 |
| `/curated` | 34 | 0 |
| `/radar` | 30 | 0 |
| `/paths` | 29 | 0 |
| `/about` | 28 | 0 |
| `/en/contact` | 28 | 0 |
| `/launch` | 27 | 0 |
| `/live` | 26 | 0 |
| `/thought` | 24 | 0 |
| `/` | 22 | 0 |
| `/ask` | 22 | 0 |
| `/inbox` | 20 | 0 |
| `/search?tab=askbook` | 18 | 0 |
| `/radio` | 17 | 0 |
| `/media/radio-idaa` | 16 | 0 |
| `/atlas` | 14 | 0 |
| `/cv-file/ar` | 12 | 0 |
| `/cards` | 4 | 0 |
| `/articles` | 3 | 0 |
| `/articles/aggression-in-the-sky-and-steadfastness-withinarabic` | 2 | 0 |
| `/publications` | 0 | 0 |
| `/publications/teaching` | 0 | 0 |
| `/search?q=%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2%D8%B2` | 0 | 0 |
| `/contact` | 0 | 0 |
| `/mihwar` | 0 | 0 |
| `/no-such-page-duo` | 0 | 0 |
| `/research` | 0 | 0 |
| `/search` | 0 | 0 |
| `/privacy` | 0 | 0 |
| `/terms` | 0 | 0 |
| `/data-deletion` | 0 | 0 |
| `/mylib` | 0 | 0 |

**القراءة الصريحة للمصفوفة (بعد الأجزاء 3–5):** المسارات الـ47 كلها بلا أي عنصر نصي أو تفاعلي على الكعب في الشاشات الداخلية الثلاث وفي خمسة مواضع من كل صفحة؛ 0 تمرير أفقي في 432 قياساً؛ القص الوحيد `/admin` على 1280×800 (سابق على main). استثناءان مقصودان لا يُعدّان نصاً: سماء `/atlas` لوحة رسم واحدة على الصفحتين، والبطاقات ذات الإطار التي تمتد على الصفحتين (عقيدة «حول الموقع»، لوحة «كيف تغيّر مركز الكتابة») ونصوصها في صفحتيها.

## 5. الانتقال الحي (I) — صفحة واحدة بلا إعادة تحميل

951×585 → 669×867 → 470×700 → 382×580 → 594×368 → 951×350 → 951×585 ([live-and-stress.json](iphone-duo-final/live-and-stress.json)):

| الحالة | النتيجة |
|---|---|
| المقال: الفقرة المقروءة | أعلاها عند y = 140 / 121 / 121 / 120 / 93 / 88 / 138: الفقرة نفسها أمام القارئ في كل خطوة (خطاف #226 يعمل مع الشبكة الجديدة). الشبكة `grid` في 951 و669 و`block` في البقية |
| المقال: النص المحدد | باقٍ في الخطوات السبع |
| التواصل: الموضوع المختار والاسم والرسالة (36 حرفاً) | باقية في الخطوات السبع |
| لوحة البحث الموحّد مفتوحة وفيها «تعليم» | مفتوحة والنص باقٍ في الخطوات السبع |
| مِحور | عنصر المضيف نفسه في كل الخطوات (لا إعادة تركيب). نص البحث والتبويب المختار لا يثبتان حتى قبل أي تغيير في المقاس، وهذا مطابق تماماً لـ `origin/main` (قيس على الاثنين): سلوك التطبيق التجريبي، لا أثر للتخطيط |
| الصوت | المشغّل نفسه ينتقل بين المكتب والشريط السفلي بـ CSS (لا إعادة تركيب)، لكن تشغيل الصوت فعلياً لم يُختبر في المحاكاة: NOT_TESTED |
| مجلس الفكرة (`/listen`): حلقة مفتوحة بمشغّلها ونص «هل» في البحث | المشغّل مفتوح، **وهو العنصر نفسه** (لا إعادة تركيب) في الخطوات السبع، والنص باقٍ؛ الشبكة على جذر الصفحة |
| تمرير أفقي في كل الخطوات | 0 |

## 6. الوصول والإجهاد (J)

| الاختبار | النطاق | النتيجة |
|---|---|---|
| نص 200% (`html{font-size:200%}`) | 7 صفحات × 669×867، 951×585، 382×580 | 0 تمرير أفقي. لقطة: [after-article-669x867-text200.jpg](iphone-duo-final/after-article-669x867-text200.jpg). الكتاب يبقى صفحتين والعنوان يلتف؛ لم يُقَس الكعب تحت التكبير: PARTIAL |
| الوضع الليلي | 7 صفحات × 669×867، 951×585 | 0 تمرير أفقي؛ للكعب لون ليلي خاص. [after-article-669x867-dark.jpg](iphone-duo-final/after-article-669x867-dark.jpg) (التُقطت قبل وصول المتن الكسول، فهي أيضاً لقطة حالة «النص قيد الإضافة») |
| تقليل الحركة | كل القياسات أعلاه | PASS: لا حركة جديدة؛ المكتب والاستعلام ثابتان بـ `sticky` لا بحركة |
| لوحة المفاتيح (محاكاة: حقل مركّز ثم ارتفاع 350) | التواصل، البحث، الأرشيف | النص المكتوب باقٍ والتركيز باقٍ و0 تمرير أفقي. المحاكاة لا تمرّر الحقل إلى الشاشة كما يفعل Safari مع لوحة حقيقية: NOT_TESTED على الجهاز |
| حواف غير متماثلة (حشو 44px يساراً فقط على body) | 7 صفحات × 951×585، 594×368 | 0 تمرير أفقي. الكعب الثابت يبقى في منتصف النافذة، والشبكة تنزاح بنصف الفرق (22px) — مقبول لأن Duo في وضع الكتاب الطولي بلا حواف جانبية: PARTIAL |
| أهداف اللمس ≥ 44px | الصفحات التسع × 26 مقاساً | زر «مساحتي» في التذييل كان 40px في كل المقاسات فصار 44px. الباقي سابق: رابط البحث في بطاقة الكتاب 32px على المكتبي، زر إشارة المقال 28px، رابطا تبيان/الجدول 40px على المكتبي |
| VoiceOver | — | NOT_TESTED |

## 7. ما بقي

**P0:** لا شيء معروف.

**P1**
1. التشغيل الصوتي الفعلي أثناء الطي لم يُختبر (المشغّل يبقى العنصر نفسه، والصوت لا يعمل في المحاكاة).
2. الوضعيات A/B/E/G/H للمسارات الجديدة `PASS·م` (مقاييس فقط): CSS الأجزاء 3–5 لا يمسّها، لكنها لم تُراجع بالعين صفحةً صفحة في هذه الجولة.
3. أدوات لوحة التحكم غير «اليوم» (`/admin` بتبويباتها الـ35) تبقى عموداً واحداً بلا كعب مرسوم في الشاشة الداخلية؛ صُمّمت لوحة «اليوم» وحدها.

**P2**
1. شريط أقسام `/admin` على 1280×800 يتجاوز الحافة (FAIL في عمود G) — **سابق** على main.
2. سماء `/atlas` لوحة رسم واحدة تمتد على الصفحتين (مقصود، لا نص عليها عند الكعب)؛ قد يُفضَّل لاحقاً تقسيمها.
3. في وضع السكينة على الشاشة الداخلية تبقى الصفحة اليسرى فارغة (المكتب مخفي).
4. بعض الصفحات (المواعيد، المجلس، الأسئلة) تترك الصفحة اليسرى خفيفة تحت الأدوات الثابتة حين تطول القائمة اليمنى — مقصود (فهرس ثابت)، لكنه هادئ أكثر من اللازم.
5. أخطاء «access control» لملف `/books/passages/v1/meta.json` في قياسين على خادم التطوير (594×368، 951×350)؛ لا علاقة لها بالتخطيط.

## 8. الاختبارات

| الأمر | النتيجة |
|---|---|
| `npx tsc --noEmit` (`npm run lint`) | PASS |
| `npx vite build` | PASS |
| حراس البناء: design-system، visual-tokens، arabic-typography، arabic-tanween، critical-bridges، site-architecture | PASS |
| `npm run mihwar:test`، `npm run style:self-test` | PASS |
| كل `scripts/test-*.mjs` | PASS عدا اثنين **سابقين** يفشلان على `origin/main` بالقدر نفسه: `test-conversation-notes-20260810`، `test-publishing-studio-regressions` |
| `test-all-user-notes` | PASS (فحص نصي يشترط `{tab !== 'askbook' && <FadeUp>` حرفياً؛ حُفظ واستُعمل `:has()` بدل اسم صنف) |
| `npm run build` الكامل | لم يُشغَّل محلياً (يعيد كتابة ملفات بيانات متتبَّعة)؛ تشغّله بوابة النشر بعد الدمج |

## 9. صور قبل/بعد (WebKit، DPR 1)

| المشهد | قبل | بعد |
|---|---|---|
| المقال 669×867 | ![](iphone-duo-final/before-article-669x867.jpg) | ![](iphone-duo-final/after-article-669x867.jpg) |
| المقال 951×585 | ![](iphone-duo-final/before-article-951x585.jpg) | ![](iphone-duo-final/after-article-951x585.jpg) |
| الأرشيف 669×867 | ![](iphone-duo-final/before-articles-669x867.jpg) | ![](iphone-duo-final/after-articles-669x867.jpg) |
| الأرشيف 951×585 | ![](iphone-duo-final/before-articles-951x585.jpg) | ![](iphone-duo-final/after-articles-951x585.jpg) |
| الكتاب 669×867 | ![](iphone-duo-final/before-book-669x867.jpg) | ![](iphone-duo-final/after-book-669x867.jpg) |
| الكتاب 951×585 | ![](iphone-duo-final/before-book-951x585.jpg) | ![](iphone-duo-final/after-book-951x585.jpg) |
| الرئيسية 669×867 | ![](iphone-duo-final/before-home-669x867.jpg) | ![](iphone-duo-final/after-home-669x867.jpg) |
| مجلس الفكرة 669×867 / 951×585 | — | ![](iphone-duo-final/after-listen-669x867.jpg) ![](iphone-duo-final/after-listen-951x585.jpg) |
| الأرشيف الإعلامي 669×867 / 951×585 | — | ![](iphone-duo-final/after-media-669x867.jpg) ![](iphone-duo-final/after-media-951x585.jpg) |
| سجل الأثر 669×867 / 951×585 | — | ![](iphone-duo-final/after-impact-669x867.jpg) ![](iphone-duo-final/after-impact-951x585.jpg) |

## 10. إعادة القياس

```bash
VITE_DEMO_MODE=1 npx vite --port 5110 --strictPort --host 127.0.0.1
# في نافذة أخرى (Playwright 1.63 العام، WebKit):
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node docs/iphone-duo-final/duo-audit.cjs --label after --shots          # الصفحات التسع × 26 مقاساً (~9 دقائق)
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node docs/iphone-duo-final/duo-audit.cjs --label routes --set all --key # 47 مساراً × 9 مقاسات (~17 دقيقة)
NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node docs/iphone-duo-final/duo-live.cjs                                 # I وJ
node docs/iphone-duo-final/make-matrix.cjs                               # جدول القسم 4
```
خيارات: `--inner` (المقاسات الداخلية فقط)، `--only id1,id2`، `--base URL`. التقارير: `audit-before.json` (على `origin/main`)، `audit-after.json`، `audit-routes.json`، `live-and-stress.json`.

## 11. على الجهاز الحقيقي (للمالك)

لم يُختبر شيء هنا على جهاز. افتح الجهاز في وضع الكتاب ثم:

1. **مقال طويل:** هل النص كله على النصف الأيمن، والمشغّل وأزرار الخط والحفظ على الأيسر ثابتة وأنت تنزل؟ هل خط المنتصف يقع على المفصل أو قريباً جداً منه؟
2. **ابدأ الاستماع** ثم اطوِ الجهاز وافتحه: هل يستمر الصوت، وهل ينتقل المشغّل إلى الشريط السفلي في وضع الحاسوب؟
3. **وضع الحاسوب** (النصف السفلي أفقي): هل الشريط السفلي بعيد عن النص ولا يغطي آخر سطر؟
4. **/contact:** اختر موضوعاً واكتب سطراً ثم اطوِ وافتح: هل بقي ما كتبت؟ (لا تضغط «إرسال».)
5. **/mihwar بعد الدخول:** هل التبويبات والبحث يميناً والمواد يساراً، وهل «+ إضافة» وحدها على اليسار في الشريط السفلي؟
6. **الشاشة الخارجية مطوية:** هل كل صفحة مهمة واحدة واضحة والخلفية حتى الحافة؟
7. إن كان Safari يعرض علم «Viewport Segments» في الإعدادات التجريبية فعّله: هل يتسع الكعب ليطابق المفصل تماماً؟
8. **/listen:** افتح حلقة واستمع ثم اطوِ وافتح: هل يستمر الصوت والمشغّل في مكانه؟ هل المشغّل العائم في الصفحة اليسرى لا فوق الكعب؟
9. صوّر أي صفحة تبدو ممطوطة أو صفحتها اليسرى فارغة لتكون التالية.
