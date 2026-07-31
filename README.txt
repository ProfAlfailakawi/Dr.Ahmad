مزامنة قوقل ستوديو — ٤ ملفات
مأخوذة من GitHub مباشرة (الالتزام 59d9dd7)

ضعها بمساراتها الأصلية فوق النسخة الموجودة. لا تنشئ مجلداً جديداً.

  whatsapp-web-bridge/index.mjs   ← عطب «أول مرة يوصل والثانية ما توصل»
  src/lib/admin-push.ts           ← تشخيص الإشعارات بالعربية
  src/lib/idea-revision.ts        ← «كيف تغيّر رأيي» + المسار المقرَّر
  src/data/idea-revisions.json    ← جديد (فارغ) تملؤه باختياراتك

ملاحظة: كل هذه الملفات مرفوعةٌ على GitHub أصلاً ومنشورة، وملف الجسر يعمل
على الآلة الآن. الغرض من هذه الحزمة أن تصير نسخة ستوديو مطابقة، فلا تدهس
عملاً منشوراً في رفعتك القادمة.

قبل أي رفعةٍ من ستوديو:
  ١) اسحب من GitHub أولاً.
  ٢) لا ترفع: src/data/audio.json · audio-meta.json · audio-supervisor.json
     · podcast-admin.json · .audio-failures.json  (تكتبها Actions).
