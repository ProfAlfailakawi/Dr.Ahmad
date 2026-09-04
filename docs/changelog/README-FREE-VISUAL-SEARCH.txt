تم تنفيذ البحث البصري الخارجي في الاستوديو على الشكل الآتي:

1) المصدر المجاني العامل مباشرة الآن:
- Wikimedia Commons
- لا يحتاج مفتاحاً
- البحث يتم تلقائياً من داخل الاستوديو

2) مصدر مجاني إضافي اختياري:
- Pexels
- فعّل المفتاح المجاني عبر:
  VITE_PEXELS_API_KEY=YOUR_KEY

3) التوليد البصري:
- تم تجهيز Prompt ذكي داخل الاستوديو
- ويمكن ربط مزودك لاحقاً عبر:
  VITE_STUDIO_IMAGE_GENERATOR_ENDPOINT=https://your-endpoint

الملفات المعدلة:
- src/components/admin/SocialDesignStudio.tsx
- src/lib/visual-dna.ts
- src/lib/external-visual-sources.ts
