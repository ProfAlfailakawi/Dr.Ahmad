=========================================================
 تعديلات الجلسة — للرفع في AI Studio
=========================================================

ارفع الملفات المرفقة بنفس مساراتها، ثم Publish.

⚠️ متغيّر بيئة جديد واحد — أضِفه في إعدادات AI Studio (Environment):
   VITE_SITE_URL = https://dr-alfailakawi.web.app
   (عند ربط الدومين الرسمي لاحقاً: غيّره إلى https://dr-alfailakawi.com — سطر واحد يوحّد كل canonical/OG/RSS/Schema)

ملخّص التعديلات:
• index.html            : preload لصورة LCP (البورتريه)
• src/data.ts           : النطاق المركزي SITE_URL + روابط Scholar/ResearchGate + إصلاحات
• src/pages/ArticleDetail.tsx : أداة التحديد الموحّدة + استشهاد واحد + النطاق المركزي
• src/pages/PaperDetail.tsx   : أيقونتا Scholar/ResearchGate + استشهاد واحد + النطاق المركزي
• src/pages/Home.tsx    : تحسين LCP للبورتريه (fetchpriority + أبعاد)
• src/components/IdeaFeatures.tsx : شريط التحديد الموحّد (خيط الفكرة + بطاقة اقتباس، بلا تداخل)
• scripts/build-static.mjs : النطاق المركزي + robots مولّد + Schema كامل (Person/Article/ScholarlyArticle/Book/Breadcrumb)
• scripts/podcast-dialogue.mjs : الوضع المجاني (حوار Azure بلا حَكَم مدفوع) + وضع اختبار الأصوات + إصلاحات
• scripts/audition-sample.json : عيّنة اختبار الأصوات النسائية (سريعة، فصحى)
• scripts/prompts/*, bakeoff-sample.json, VoiceBakeoff.tsx : ضبط محرك البودكاست

ملاحظة: ملف .env لم يُرفق (يحوي مفاتيح سرية) — احتفظ بنسختك، وأضِف فقط VITE_SITE_URL أعلاه.
