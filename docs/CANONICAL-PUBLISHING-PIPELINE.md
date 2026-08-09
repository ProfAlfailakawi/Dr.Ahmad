# Canonical Publishing Pipeline

هذا المستند عقدٌ معماري لا واجهة جديدة. الغاية أن يضيف د. أحمد المادة مرة واحدة
من لوحة الإدارة، ثم تتولى المنصة بقية العمل من المصدر نفسه للحقيقة.

## المسار الواحد

1. الحفظ الأصلي ينجح أولاً في Firestore (`site_articles`, `site_books`, `site_papers`, `site_media`, `content_overrides`).
2. `/api/admin/content/publish-sync` يسجل المادة في `admin_content_pipeline`.
3. المسودة تبقى `draft` ولا تخرج للعامة. المادة المجدولة تبقى `scheduled` حتى وقتها.
4. المادة العامة تطلق `firebase-hosting-live.yml`. إن تعذر dispatch الفوري تبقى `queued` ولا تضيع، ويستعيدها حارس الجدولة لاحقاً.
5. البناء يلتقط **لقطة Canonical واحدة** من Firestore قبل بناء أي فهرس عميق.
6. نفس اللقطة تغذي Knowledge Graph، فهرس البحث/واتساب، Archive 2036 body shards، SEO، RSS وSitemap.
7. بعد نجاح Hosting فقط تُعلَّم الوظائف التي شملتها اللقطة `deployed`؛ أي حفظ أحدث يبقى في الطابور ولا يُبتلع خطأً.
8. وكيل واتساب الحي يجلب نفس المجموعات العامة كل بضع دقائق، ويعيد فهرسته فقط عند تغير checksum، فلا ينتظر deploy كي يرى المادة الجديدة.

## مبدأ عدم إعادة حساب العالم

الزائر يرى Firestore كـ live delta صغير، بينما البناء يثبت النسخة الدائمة والفهارس.
Archive 2036 يستخدم sharding، postings، candidate sets وLOD، لذلك نمو الأرشيف لا يعني
تحميل أو رسم كل شيء لكل زائر.

## ضمانات الفشل

- فشل GitHub لا يتراجع عن حفظ المحتوى.
- الوظيفة تبقى `queued` وتُعاد تلقائياً.
- فشل Firestore REST لدى واتساب لا يمحو آخر لقطة صحيحة.
- الـdraft لا يدخل فهارس عامة.
- المقال المجدول لا يصبح عاماً قبل موعده.
- لا تُعلَّم مادة `deployed` إلا بعد نجاح النشر وبشرط أن تكون قد دخلت اللقطة التي نُشرت فعلاً.

## اختبارات الحماية

- `npm run content:pipeline:self-test`
- `npm run content:live:self-test`
- `node scripts/guard-archive-2036.mjs`
- `node scripts/test-archive-scale-100k.mjs`
- `npx tsc --noEmit` داخل GitHub/Node 24.18

أي تعديل مستقبلي على CMS أو الفهارس يجب أن يحافظ على هذا المسار الواحد، وألا ينشئ
قارئ Firestore ثانياً مستقلاً أثناء البناء إلا كـ fallback صريح ومختبر.
