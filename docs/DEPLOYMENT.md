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

يُنشر **يدوياً**، ولا ينشره مسار الموقع.

- المنطقة والمشروع: `gen-lang-client-0200723670`؛ سجل Cloud Build في `europe-west1`.
- المتغيّر `FIREBASE_PROJECT_ID=drahmad-8e9e2` إلزاميّ للوصول إلى Firestore.

### لغمان معروفان

1. **`.gcloudignore` ليست `Dockerfile`.** أي ملفٍ جديد يستورده الخادم يحتاج
   سطرين: سماحاً في `.gcloudignore` **و**`COPY` في `Dockerfile`. نسيان الثاني
   يُسقط الخدمة، و`node --check` لا يمسكه.
2. **ترتيب `.gcloudignore`:** سطر السماح **بعد** نمط الاستبعاد لا قبله. الحارس
   `npm run guard:cloudrun` يمنع هذا الخطأ قبل النشر.

## ٤) الأتمتة — GitHub Actions

الرادار اليومي، وقافلة الصوت، وإنتاج البودكاست، والنسخ الاحتياطي، والتقارير.
جميعها على Node 24، وتقرأ أسرارها من GitHub Secrets. لا يُستخدم أي نموذجٍ لغويّ
مدفوع في أيّ مسار.

## الفحص قبل النشر

```bash
npm ci
npm run build          # يشمل كل الحرّاس
npm run legacy:ci      # لا تراجع في الروابط الحرجة
npm run docs:check     # التوثيق يطابق المشروع
```
