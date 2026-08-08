# تقرير الفحص والتنفيذ الشامل

## الخلاصة المعمارية قبل التنفيذ
- التحليلات الحالية كانت تعتمد Plausible/Reader Pulse ورحلات الزائر، ولم يكن هناك مخطط موحد للأحداث الدلالية. تم توسيع البنية الحالية عبر `/api/analytics/event` ومجموعة `analytics_events` الخاصة بقراءة الأدمن.
- البحث العام في `src/pages/Search.tsx`، وبحث الموسوعة في `EncyclopediaPortal.tsx` مع محركات الفيديو واللحظات والكتاب والشرائح، و«اسأل المكتبة» في `AskLibrary.tsx`.
- الاستشهاد كان في `CitationCopy.tsx` و`CiteButton` ويدعم APA/MLA/Chicago وRIS في المسارات البحثية؛ أضيف BibTeX لنفس الأداة.
- مسار البودكاست اليدوي: `ManualDialogueEditor` → `podcast_dialogues` و`podcast_production` → `/api/admin/podcast/dispatch` → workflow `podcast-pilot-release.yml` → `fetch-manual-dialogues.mjs` → `podcast-dialogue.mjs`/Azure/FFmpeg → بوابات الجودة وR2 → `report-dialogue-status.mjs` → Firestore والواجهة.

## السبب الجذري للبودكاست
الخلل المثبت في المصدر كان انفصال «نجاح المحرك والنشر» عن «تحديث حالة لوحة الإدارة»: مسار البدء كتب `generating`، لكن النتيجة النهائية لم تكن تُعاد دائمًا إلى `podcast_production`. لذلك بدت الحلقة متوقفة، وأعيد إرسالها رغم أن ملفاتها قد تكون اجتازت البوابات ورُفعت. سبب ثانٍ كان بقاء `dialogueDisabled=true` بعد مسح سابق، حتى بعد نجاح نسخة جديدة. عولج ذلك في `report-dialogue-status.mjs` بقراءة `.podcast-state.json` وتحديث الحالة وإنزال راية الإيقاف للحلقات المقبولة. كما أن `human-reading-pipeline.mjs` يستخدم checkpoints مرتبطة ببصمة الوحدة، وworkflow يحفظها ويستعيدها، فلا يعاد توليد المقاطع المكتملة.

لم يتغير نص الحوار اليدوي؛ البصمة canonical تعتمد `speaker` و`text` حرفيًا، والتقسيم الصوتي داخلي فقط.

## التنفيذ حسب المهام الثماني
1. الاستخدام الفعلي: أحداث الأطلس والعقل الحي والبحث وRUM، لوحة p75 والعينات والفصل بين الهاتف وسطح المكتب.
2. BibTeX: توليد ونسخ وتنزيل `.bib`، Unicode عربي، مؤلفون بـ `and`، حقول غير فارغة فقط، مفتاح ثابت.
3. أدوات الأدمن الواحد: أحداث دلالية خاصة، تعطيل اختياري، استبعاد جلسات الاختبار، فتح/ترك/نتيجة/تحويل.
4. البحث القابل للمشاركة: `q/tab/video/t/result`، push/replace state، popstate، Web Share/clipboard، بلا تشغيل صوت تلقائي عند استعادة الرابط.
5. نتائج الموسوعة: تبويبات حقيقية للمصادر، أعداد محسوبة من المحركات القائمة، عرض تدريجي قائم، وعدم تحميل الوسائط قبل الاختيار.
6. الروابط القديمة: مدقق موحد للتكرار والسلاسل و302، مع تقرير JSON وعدم اعتبار الروابط الخارجية سبب فشل.
7. التوثيق: مولد `PROJECT-STATUS.md` من package/git/المجلدات، وعدم تثبيت أعداد Firestore ديناميكية.
8. البودكاست: قفل canonical، idempotency حسب revision، checkpoints، حالة مرحلة/مقطع/run، ورسائل الخطأ الأصلية بدل «فشل» العام.

## Firestore
- `analytics_events`: كتابة خادمية فقط، قراءة أدمن فقط.
- `admin_tool_events`: إنشاء/قراءة/حذف للأدمن، بلا update.
- `podcast_production`: الحقول الموجودة توسعت بحالة dispatch، run URL، stage، currentSegment/totalSegments، lastAudioPath، mergeStarted، uploaded، retryCount، stageHistory.

## مخاطر متبقية
التحقق من أسرار GitHub/Azure وحالة حلقة بعينها يحتاج الوصول إلى بيئة الإنتاج وGitHub Actions/Firestore؛ لا توجد قيم أسرار داخل المشروع ولا يجوز استنتاجها. الاختبارات المحلية تثبت منطق المسار، لا الحالة التشغيلية للحسابات الخارجية.
