# مواصفات لوحة التحكم — موقع د. أحمد حسين الفيلكاوي
> برومت تنفيذي كامل. الهدف: لوحة تتيح للدكتور (غير مبرمج) إدارة كل المحتوى من المتصفح، بلا تدخل برمجي ولا إعادة رفع.

## المبدأ المعماري: طبقة تعديلات (Overlay) في Firestore
المحتوى الحالي (مقالات/كتب/أبحاث/إعلام) مخبوز في `src/data.ts` (ثابت). لتعديله حيّاً دون إعادة بناء:
- يبقى `data.ts` **طبقة الأصل**.
- مجموعة `content_overrides/{type}:{slug}` تحمل: `{ patch: {حقول معدّلة}, hidden?: bool, updatedAt }` — للتعديل والحذف على الأصل.
- مجموعات `site_articles`, `site_books`, `site_papers`, `site_media` — للإضافات الجديدة.
- في طبقة القراءة (`src/lib/cms.ts`): دمج وقت التشغيل: الأصل → تطبيق overrides (تعديل الحقول، إسقاط hidden) → إلحاق الإضافات. مصفوفة موحّدة تستهلكها كل الصفحات.
- الصفحات المولّدة مسبقاً (SEO) تبقى على الأصل حتى البناء التالي؛ الـSPA يعكس التعديل فوراً للزوار.

## قواعد الأمان (تُضاف إلى firestore.rules بلا مساس بالموجود)
```
match /content_overrides/{id} { allow read: if true;  allow write: if isAdmin(); }
match /site_books/{id}  { allow read: if true; allow write: if isAdmin(); }
match /site_papers/{id} { allow read: if true; allow write: if isAdmin(); }
match /site_media/{id}  { allow read: if true; allow write: if isAdmin(); }
match /cv_overrides/{id} { allow read: if true; allow write: if isAdmin(); }
match /views/{path} {
  allow read: if isAdmin();
  allow create: if request.resource.data.count == 1
    && request.resource.data.keys().hasOnly(['count','title','updatedAt']);
  allow update: if request.resource.data.count == resource.data.count + 1
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['count','updatedAt']);
}
```
(الكتابة كلها للمشرف عبر custom claim `admin:true` — مُفعّل.)

## الميزات

### 1) إحصائيات المشاهدة
- Hook `useTrackView(path, title)` في `ArticleDetail` وكل صفحة: يزيد `views/{path}.count` بـ `increment(1)`، مع منع تكرار الجلسة عبر `sessionStorage`.
- تبويب «المؤشرات»: إجمالي المشاهدات · أعلى ١٠ مقالات قراءةً (شريط أفقي) · اتجاه آخر ٧ أيام.

### 2) CRUD كامل (مقالات/كتب/أبحاث/إعلام) — نفس النمط لكل نوع
- تبويب لكل نوع يعرض **جدولاً بكل العناصر** (الأصل + الإضافات) مع بحث وفرز بالتاريخ.
- لكل صف: «تعديل» (نموذج بكل الحقول) · «إخفاء/حذف» · شارة «أصل / مُضاف / مُعدّل».
- «إضافة جديد» → يكتب في `site_<type>`. التعديل على عنصر أصلي → يكتب `content_overrides/<type>:<slug>` بالحقول المتغيّرة فقط.
- الحقول:
  - **مقال**: slug (تلقائي)، العنوان، التاريخ (iso + عربي تلقائي)، التصنيف (تلقائي + تعديل)، المقتطف (تلقائي + تعديل)، النص، رابط المصدر (اختياري).
  - **كتاب**: slug، العنوان، ISBN، الوصف، الغلاف (رفع)، PDF (رفع).
  - **بحث**: slug، العنوان، الوصف/الميتا، الرابط/PDF.
  - **إعلام**: slug، العنوان، المنصّة، رابط الفيديو/يوتيوب، التاريخ.

### 3) التصنيف والمقتطف تلقائياً (AI)
- زرّ «اقترح التصنيف والمقتطف» في نموذج المقال → يستدعي **نقطة خدمة آمنة** (Cloud Function / نقطة في `server.mjs`) تمرّر النص إلى Gemini وتُعيد `{ cat, excerpt ≤ 200 }`.
- **مفتاح Gemini يبقى في الخادم** (متغيّر بيئة)، لا يُكشف للمتصفح.
- الأركان: التعليم، التربية، مجتمع، تقنية، هوية، إعلام، بحث.

### 4) محرّر السيرة (فكرة إبداعية: التحرير على الصفحة نفسها)
- في `/cv`، إذا كان الزائر مشرفاً، تظهر أزرار «✎» على كل قسم (تعليم/خبرات/عضويات/مؤتمرات).
- تحرير موضعي (إضافة/تعديل/حذف/إعادة ترتيب) يُحفظ في `cv_overrides`، وتدمجه طبقة القراءة مع `bio` الثابت.

### 5) صوت تلقائي للمقالات الجديدة (Azure) — «أي مقالة مستقبلية تحصل على صوت تلقائياً»
- سكربت `scripts/auto-audio.mjs` (جدولة ليلية launchd أو وظيفة سحابية):
  1. يقرأ كل المقالات (الأصل + `site_articles`).
  2. يجد ما ينقصه صوت (لا MP3 مطابق للـslug).
  3. يولّد **فهد + نورة** عبر Azure TTS (`ar-KW-FahedNeural` / `ar-KW-NouraNeural`).
  4. يخزّن MP3 (في `audio/` ويُودع، أو Firebase Storage) ويحدّث `src/data/audio.json`.
- يشمل **الـ96 مقالة الأرشيفية الحالية** (بلا صوت الآن) وكل جديد.
- المتطلّب: مفتاح Azure في بيئة تشغيل السكربت.

### 6) تنظيف — ✅ منجز
- إزالة تبويبَي «سؤال الأسبوع» و«مختارة جديدة» (تلقائيان من بنك دوّار).

## قيود الهوية
أحادي اللون + لمسة واحدة (accent)، بلا تلوّث بصري، بلا نوافذ حاجزة، بلا ألوان جديدة.
