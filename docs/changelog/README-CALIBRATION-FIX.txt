علاج جذري: فشل «معايرة مجلس التحرير — 7 و30 يوماً» الدائم
===========================================================

السبب الجذري
------------
الـworkflow يستعمل sparse-checkout (جلب ملفاتٍ محدّدة لتسريع التشغيل)، وكان
يعدّد ثلاثة ملفات فقط:
  scripts/editorial-board-calibration.mjs
  src/lib/impact-mirror.mjs
  src/lib/adversarial-misunderstanding.mjs
لكن adversarial-misunderstanding.mjs يستورد src/lib/style-dna.mjs — وهو
غير مُدرَج في القائمة. فيفشل كل تشغيلٍ بـ:
  ERR_MODULE_NOT_FOUND: Cannot find module '.../src/lib/style-dna.mjs'
ولهذا كان «دائماً» يفشل — القائمة ناقصة بنيوياً.

لماذا لم يُكتشف مبكراً
---------------------
الفحوص المحلية تعمل على المستودع الكامل (كل الملفات حاضرة)، فتنجح.
النقص يظهر فقط في بيئة الجلب الجزئي على GitHub.

العلاج الجذري (لا ترقيع)
-------------------------
بدل تعداد ملفاتٍ مفردة تنكسر كلما أُضيف استيراد، نجلب المجلدين كاملَين:
  scripts/editorial-board-calibration.mjs
  src/lib      (١١٤ ملفاً · ~١.٨MB)
  src/data     (لأن بعض ملفات lib تقرأ من data)
فيُحلّ أيّ استيرادٍ حالي أو مستقبلي بلا صيانةِ قائمةٍ هشّة. والسلسلة كلها بلا
تبعيات node_modules، فلا حاجة لـnpm ci. الحجم (~18MB) يُجلب في ثوانٍ ضمن
مهلة العشر دقائق.

البرهان
-------
· حاكيتُ الجلب بالضبط (السكربت + src/lib + src/data فقط) وشغّلتُ خطوة CI
  نفسها: node scripts/editorial-board-calibration.mjs --self-test → نجح برمز 0.
· تحققتُ أن لا ملف في السلسلة يستورد من node_modules (صفر تبعيات خارجية).
· فحصتُ أن سلسلة استيراد المدخل تُحلّ كاملةً (لا ERR_MODULE_NOT_FOUND).

الملف (1)
---------
معدّل  .github/workflows/editorial-board-calibration.yml  (قائمة الجلب فقط)

الأساس: نسخة GitHub الحالية للـworkflow — لم يتغيّر إلا بلوك sparse-checkout.

بعد الدفع: التشغيلة القادمة (يومياً 08:10 صباح الكويت) ستنجح، أو شغّلها الآن
يدوياً من تبويب Actions ← «معايرة مجلس التحرير» ← Run workflow للتأكد فوراً.
