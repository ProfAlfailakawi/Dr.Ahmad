تعديلات الجلسة — ارفعها بنفس المسارات في AI Studio ثم Publish.

⚠️ أضِف متغيّراً واحداً في إعدادات AI Studio (Environment):
   VITE_SITE_URL = https://dr-alfailakawi.com

أبرز التعديلات:
• data.ts / cms.ts     : النطاق المركزي + المؤلف المشارك (د. عبدالعزيز دخيل العنزي) في كل الكتب والأبحاث + تمرير coAuthors/scholar/researchgate
• ArticleDetail/PaperDetail/IdeaFeatures : أداة تحديد موحّدة + استشهاد واحد + أيقونات + النطاق المركزي
• Home.tsx / index.html : تحسين LCP للبورتريه
• Media.tsx            : أبعاد ثابتة + decoding + احتياطي عند فشل مصغّر يوتيوب
• firebase.json        : رؤوس أمان (CSP + HSTS + X-Frame + nosniff + Referrer + Permissions)
• build-static.mjs     : النطاق المركزي + robots مولّد + Schema كامل + مُحلّل متسامح
• podcast-dialogue.mjs + audition-sample.json + prompts + bakeoff-sample.json + VoiceBakeoff.tsx : محرك البودكاست + الوضع المجاني + اختبار الأصوات

المؤلف المشارك أُضيف إلى كل الأبحاث (18) وكل الكتب (9) — احذف بنفسك ما لم يشاركك فيه.
.env لم يُرفق (أسرار).
