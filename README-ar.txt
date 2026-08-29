إصلاح انهيار البناء — ٢٩ أغسطس ٢٠٢٦

السبب الجذري
────────────
التزام 0866aa8 («automate academic presence updates») أضاف إلى src/data.ts:

    import academicPresence from './data/academic-presence.json'

Vite يبلع هذا الاستيراد المجرّد. لكن سكربتات البناء تقرأ src/data.ts بـNode
ESM مباشرةً — وNode يوجب سمةَ النوع على استيراد JSON. فسقطت سلسلة البناء
كلها عند أول قارئ بعد build-article-pivots، وهو build-article-caution،
برمز ERR_IMPORT_ATTRIBUTE_MISSING. وفي السلسلة أكثر من عشرين سكربتاً يقرأ
هذا الملف، فكانت ستسقط جميعاً.

العلاج — سطر واحد
─────────────────
    import academicPresence from './data/academic-presence.json' with { type: 'json' }

الملف المعدّل: src/data.ts  (سطر ٢، ومعه تعليق يمنع تكرارها)

التحقق
──────
node scripts/build-article-caution.mjs   → رمز ٠  (كان يسقط)
node scripts/build-article-pivots.mjs    → رمز ٠
node scripts/test-all-user-notes.mjs     → رمز ٠
node scripts/build-media-chapters.mjs    → رمز ٠
node scripts/build-podcast-admin.mjs     → رمز ٠

وبُني src/data.ts بـVite 8.2.0 نفسها للتأكد أن السمة لا تكسر الحزمة:
البناء نجح، والسمة حُلّت، وأرقام academic-presence دخلت الناتج فعلاً.

ملاحظة جانبية
─────────────
README-ar.txt (شرح دفعة حارس الجنس) دخل جذر المستودع في التزام d249118 —
شاردةٌ في الجذر لا مكان لها. احذفها متى شئت؛ ليست عضواً في أي سقّاطة.
