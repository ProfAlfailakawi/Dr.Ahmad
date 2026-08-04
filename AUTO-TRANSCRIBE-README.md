# التفريغ التلقائي الكامل للموسوعة

## تشغيل بنقرة واحدة

- macOS: افتح `ابدأ-تفريغ-الموسوعة.command`.
- Windows: افتح `ابدأ-تفريغ-الموسوعة.bat`.

المنظومة تقرأ 169 رابطًا من فهرس المشروع، وتنزّل الصوت مؤقتًا، وتشغّل Buzz محليًا بالعربية، وتنتج VTT باسم YouTube Video ID، ثم تستورد كل ملف وتتحقق من وجود مقاطع زمنية فعلية قبل اعتبار الفيديو مكتملًا.

## المتطلبات مرة واحدة

1. Node.js 24.
2. Buzz مثبت على الجهاز، مع توفر أمر `buzz` أو نسخة Buzz في المسار المعتاد.
3. اتصال بالإنترنت لتنزيل صوت فيديوهاتك ونموذج Whisper في أول تشغيل.

لا يستخدم OpenAI API ولا يرسل الصوت إلى خدمة مدفوعة. Buzz يعمل محليًا.

## أوامر متقدمة

```bash
npm run encyclopedia:auto-transcribe
npm run encyclopedia:auto-transcribe -- --limit 3
npm run encyclopedia:auto-transcribe -- --video-id emisZzaICy8
npm run encyclopedia:auto-transcribe -- --model-size large
npm run encyclopedia:auto-transcribe -- --keep-audio
npm run encyclopedia:auto-transcribe -- --force
```

الإعداد الافتراضي هو `fasterwhisper/medium` بالعربية. يمكن تغيير المسار التنفيذي عبر `BUZZ_COMMAND` و`YTDLP_COMMAND`.

## الاستئناف والأمان

- يتجاوز الفيديوهات المكتملة فعليًا.
- يستأنف بعد الانقطاع من ملف الحالة المحلي.
- يعيد المحاولة تلقائيًا.
- لا يحذف الصوت إلا بعد نجاح الاستيراد والتحقق من المقاطع.
- لا يستبدل تفريغًا صالحًا بملف فاسد.
- لا يرفع الصوت أو نماذج Buzz أو cache إلى GitHub.
