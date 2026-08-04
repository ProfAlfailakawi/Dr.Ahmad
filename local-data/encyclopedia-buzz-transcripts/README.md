# تفريغات Buzz لموسوعة تكنولوجيا التعليم

1. افتح الفيديو أو ملفه الصوتي في **Buzz by Chidi Williams** وشغّل التفريغ محليًا.
2. صدّر التفريغ بصيغة `VTT` أو `SRT` أو `JSON` مع التوقيتات.
3. سمِّ الملف بمعرّف YouTube وحده، مثل: `emisZzaICy8.vtt`.
4. ضع الملف في هذا المجلد.
5. شغّل:

```bash
npm run encyclopedia:buzz:import
npm run encyclopedia:buzz:report
```

يعتمد الربط على معرّف الفيديو لا على العنوان. لا تضع هنا فيديوهات أو ملفات صوت أو نماذج Whisper أو cache. المجلد محلي؛ ملف README وحده مرفوع للمستودع.
