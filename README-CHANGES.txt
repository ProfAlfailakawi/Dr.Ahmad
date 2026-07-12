=========================================================
 تعديلات الجلسة — للرفع في AI Studio  (ارفع بنفس المسارات ثم Publish)
=========================================================

⚠️ متغيّر بيئة جديد واحد — أضِفه في إعدادات AI Studio (Environment):
   VITE_SITE_URL = https://dr-alfailakawi.web.app
   (عند ربط الدومين لاحقاً: غيّره إلى https://dr-alfailakawi.com)

ملخّص التعديلات:
• src/data.ts               : النطاق المركزي + المؤلف المشارك (د. عبدالعزيز دخيل العنزي) في كل الكتب والأبحاث + Scholar/RG
• src/lib/cms.ts            : تمرير coAuthors + scholar + researchgate للكتب/الأبحاث (كانت تُحذف)
• src/pages/ArticleDetail.tsx: أداة تحديد موحّدة + استشهاد واحد + النطاق المركزي
• src/pages/PaperDetail.tsx  : أيقونتا Scholar/RG + استشهاد واحد + النطاق المركزي
• src/pages/Home.tsx        : تحسين LCP للبورتريه
• src/components/IdeaFeatures.tsx : شريط التحديد الموحّد (خيط الفكرة + بطاقة اقتباس)
• index.html                : preload لصورة LCP
• scripts/build-static.mjs  : النطاق المركزي + robots مولّد + Schema كامل + مُحلّل يتحمّل حقولاً إضافية
• scripts/podcast-dialogue.mjs + audition-sample.json + prompts + bakeoff-sample.json + VoiceBakeoff.tsx : محرك البودكاست + الوضع المجاني + اختبار الأصوات

ملاحظة: المؤلف المشارك أُضيف إلى كل الأبحاث (18) وكل الكتب (9) — احذف بنفسك أي عملٍ لم يشاركك فيه.
ملف .env لم يُرفق (أسرار) — أضِف فقط VITE_SITE_URL.
