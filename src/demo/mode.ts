/**
 * وضع العرض التوضيحي (Demo). يُفعَّل فقط ببناء/تشغيل Vite مع VITE_DEMO_MODE=1.
 * في هذا الوضع: لا اتصال بـFirebase الحقيقي ولا بأي خادم؛ كل القراءة والكتابة
 * تذهب إلى مخزن في الذاكرة مُهيَّأ ببياناتٍ خيالية (src/demo/seed.ts).
 * الإنتاج لا يتأثر: الاستبدال يتم بأسماء مستعارة (alias) في vite.config.ts عند هذا المتغيّر وحده.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === '1'
