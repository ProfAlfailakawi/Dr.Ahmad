# النشر

النشر مفصولٌ إلى ثلاث طبقاتٍ مستقلّة: الواجهة، وقواعد البيانات، والخادم.

## ١) الواجهة — Firebase Hosting

```bash
npm run build
npm run deploy:hosting
```

- المشروع: `gen-lang-client-0200723670` · Site ID: `dr-alfailakawi`
- النطاق الرسمي الوحيد: `https://dr-alfailakawi.com`
- `trailingSlash: false` · و`www` تُحوَّل ٣٠١ إلى النطاق الأساسي

تفاصيل القطع النهائي وسجلات DNS في [`../DOMAIN-CUTOVER.md`](../DOMAIN-CUTOVER.md).

## ٢) قواعد البيانات والتخزين

```bash
npm run deploy:data-rules
```

مشروع البيانات منفصل: `drahmad-8e9e2` (Auth · Firestore · Storage).

## ٣) الخادم `dr-api` — Cloud Run

ينشره مسار الموقع [`firebase-hosting-live.yml`](../.github/workflows/firebase-hosting-live.yml)
تلقائياً (`gcloud run deploy dr-api --source=.`) **قبل** Hosting في كل نشر، فتبقى
الواجهة والخادم على الالتزام نفسه. النشر اليدوي بالأمر نفسه ممكن عند الحاجة.

- المنطقة والمشروع: `gen-lang-client-0200723670`؛ سجل Cloud Build في `europe-west1`.
- المتغيّر `FIREBASE_PROJECT_ID=drahmad-8e9e2` إلزاميّ للوصول إلى Firestore.

### لغمان معروفان

1. **`.gcloudignore` ليست `Dockerfile`.** أي ملفٍ جديد يستورده الخادم يحتاج
   سطرين: سماحاً في `.gcloudignore` **و**`COPY` في `Dockerfile`. نسيان الثاني
   يُسقط الخدمة، و`node --check` لا يمسكه.
2. **ترتيب `.gcloudignore`:** سطر السماح **بعد** نمط الاستبعاد لا قبله. الحارس
   `npm run guard:cloudrun` يمنع هذا الخطأ قبل النشر.

## ٤) الأتمتة — GitHub Actions

الرادار الأسبوعي، وقافلة الصوت، وإنتاج البودكاست، والنسخ الاحتياطي، والتقارير.
جميعها على Node 24، وتقرأ أسرارها من GitHub Secrets.

### النماذج اللغوية — اختيارية وتعتمد على الطبقة المجانية

لا يشترط أيّ مسارٍ نموذجاً لغويّاً مدفوعاً، لكنّ بعضها **يستدعي Gemini إن وُجد مفتاحه**:

- **الخادم `server.mjs`:** اقتراحات المحتوى والمخرجات المنظَّمة تستدعي Gemini
  (`GEMINI_MODEL`، الافتراضي `gemini-3.5-flash`) متى ضُبط `GEMINI_API_KEY` أو
  `GOOGLE_API_KEY` في Cloud Run. بلا مفتاح، أو عند فشل Gemini (نفاد حصة، ٤٢٩،
  عطل)، يتحوّل المسار المنظَّم إلى **Cloudflare Workers AI** (حصة نيورونات يومية
  مجانية يعدّها الخادم)؛ أما اقتراحات المحتوى وتحليل الأبحاث فلا بديل مجانيّ لهما: بلا مفتاح
  تردّان ٥٠٣ «AI service is not configured»، وعند فشل Gemini تردّان خطأً.
- **GitHub Actions:** الرادار ونشر الرسائل وأدوات البودكاست تقرأ `GEMINI_API_KEY`
  من GitHub Secrets.

الكلفة إذن **صفرٌ ما دام المفتاح على الطبقة المجانية** لـ Google AI Studio (مشروع
بلا فوترة مفعّلة) وما دامت Workers AI ضمن حصتها اليومية. ربطُ المفتاح بمشروعٍ
مفوتَر يجعل الاستدعاءات مدفوعة — فلا تفعّل الفوترة على مشروع المفتاح.

## الفحص قبل النشر

```bash
npm ci
npm run build          # يشمل كل الحرّاس
npm run docs:check     # التوثيق يطابق المشروع
```
