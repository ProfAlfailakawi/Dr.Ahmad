# اعتماد الدومين الرسمي — خطوات القطع النهائي

## البنية المعتمدة

- الدومين الرسمي الوحيد: `https://dr-alfailakawi.com`
- مشروع Firebase Hosting: `gen-lang-client-0200723670`
- Site ID: `dr-alfailakawi`
- مشروع Auth وFirestore وStorage: `drahmad-8e9e2`

المشروع يفصل الآن نشر الاستضافة عن نشر قواعد البيانات. أمر `npm run deploy:hosting` ينشر الواجهة فقط، بينما `npm run deploy:data-rules` ينشر القواعد صراحة إلى مشروع البيانات.

## إعدادات لا توجد داخل ZIP ويجب تثبيتها من لوحات الخدمات

1. في Firebase Hosting داخل مشروع الاستضافة، اربط `dr-alfailakawi.com` بالموقع `dr-alfailakawi`، واربط `www.dr-alfailakawi.com` كدومين تحويل إلى الدومين الأساسي.
2. احذف من DNS أي سجلات A أو AAAA أو CNAME قديمة تشير إلى `208.115.236.10` أو مزود الواجهة القديمة، ثم ضع سجلات Firebase التي يعرضها معالج الدومين.
3. في Firebase Authentication داخل مشروع `drahmad-8e9e2`، أضف `dr-alfailakawi.com` إلى Authorized Domains. أبقِ `drahmad-8e9e2.firebaseapp.com` لأنه نطاق خدمة داخلي للمصادقة، وليس عنوان الموقع العام.
4. إن كان Google أو Meta OAuth مفعلاً في لوحة Firebase، ثبّت App Domain على `dr-alfailakawi.com`، واستخدم Redirect URI الذي تعرضه إعدادات مزود Firebase للمشروع `drahmad-8e9e2`. لا تستبدله تخميناً بعنوان مشروع الاستضافة.
5. غيّر خاصية Google Search Console وGoogle Analytics وPlausible وMeta إلى الدومين الرسمي، وأعد إرسال `https://dr-alfailakawi.com/sitemap.xml`.
6. أضف سر GitHub باسم `FIREBASE_SERVICE_ACCOUNT_DRAHMAD_8E9E2` لحساب خدمة مشروع البيانات؛ مهام الرادار والصوت لن تستخدم حساب مشروع الاستضافة بعد الآن.
7. تأكد أن خدمة Cloud Run المسماة `dr-api` لديها `FIREBASE_PROJECT_ID=drahmad-8e9e2` واعتماداً مخولاً للوصول إلى Firestore في مشروع البيانات.

## التحويلات

طبقة الخادم تعيد 301 إلى الدومين الرسمي مع حفظ المسار والاستعلام. الصفحات الثابتة تحتوي أيضاً تحويلاً مبكراً جداً لحماية الزائر الذي يصل إلى نطاق Firebase الافتراضي. تحويل `www` إلى الدومين الأساسي يجب تفعيله أيضاً من معالج Firebase Hosting حتى يكون 301 قبل تنزيل الصفحة.

## الفحص قبل النشر

```bash
npm ci
npm run build
npm run verify:domain
npm run deploy:hosting
```

بعد نشر DNS والاستضافة، اختبر الصفحة الرئيسية ومسارات المقالات والبحث والإدارة وملفات PDF والصور و`feed.xml` و`podcast.xml` و`sitemap.xml`، ثم اختبر الروابط القديمة مع مسار واستعلام فعليين.
