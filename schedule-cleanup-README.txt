تنظيف مشروع الجدول — حذف ثلاثة ملفات
=====================================
الأساس: c46549f (أحدث كوميت على GitHub وقت إنشاء هذا الملف)


ما الذي يفعله هذا التعديل
--------------------------
يحذف ثلاثة ملفات، ولا يعدّل أي ملف آخر:

1. src/components/InterfacePolish.tsx      (267 سطراً)
2. src/pages/Impact.tsx                    (243 سطراً)
   الملفان أعلاه من مشروع website لا من مشروع الجدول. يستوردان
   react-router و ThoughtSystemNav و ImpactMap و Pagination و seo
   و ComposeScene و lib/content و lib/idea-life و lib/dead-links
   و FadeUp/Page/PageHead/SocialIcon — ولا وجود لأيٍّ منها هنا.
   نتيجتهما: أكثر من عشرين خطأ استيراد في tsc على HEAD نفسه.
   البناء لا يلاحظ لأن لا أحد يستوردهما، فڤيت لا يحزم ملفاً
   غير مستخدم. الـ typecheck وحده يكشفهما.

3. src/components/SchedulePhysics/ScheduleDecisionPreview.tsx  (74 سطراً)
   مكوّن «تأكيد قبل النقل» غير مستورد في أي مكان. بقايا واجهة
   تعرض حواراً قبل إتمام السحب — وهو عكس المطلوب من السحب.
   حُذف حتى لا يعيد أحد توصيله لاحقاً.


الطريقة الأولى: تطبيق الـ patch
--------------------------------
من داخل مجلد المشروع:

    git apply ~/Downloads/schedule-cleanup.patch

للتأكد قبل التطبيق دون تغيير شيء:

    git apply --check ~/Downloads/schedule-cleanup.patch


الطريقة الثانية: الحذف يدوياً
------------------------------
نفس النتيجة تماماً — احذف هذه المسارات الثلاثة:

    git rm src/components/InterfacePolish.tsx
    git rm src/pages/Impact.tsx
    git rm src/components/SchedulePhysics/ScheduleDecisionPreview.tsx

ثم احذف مجلد src/pages إن بقي فارغاً.


التحقق بعد التطبيق
-------------------
    npx tsc --noEmit          ← يجب أن يمر بلا خطأ
    npm run test:behavior     ← 2004 ناجح · 0 فاشل
    npx vite build            ← ينجح

هذه هي النتائج التي حصلت عليها بعد التطبيق على شجرة نظيفة.


ملاحظة
-------
إن كنت نقلت InterfacePolish.tsx و Impact.tsx إلى هنا بالقصد كبداية
لصفحة جديدة في الجدول، فلا يمكن أن يعملا كما هما: تبعيّاتهما كلها
من نظام تصميم آخر. يحتاجان إعادة كتابة من الصفر على مكوّنات هذا
المشروع. أخبرني إن كان هذا مقصدك.
