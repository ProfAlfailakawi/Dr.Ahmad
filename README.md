# الموقع الرسمي — د. أحمد حسين الفيلكاوي

أرشيفٌ فكريّ حيّ: مقالات وكتب وأبحاث وظهورٌ إعلاميّ وموسوعةٌ مرئية لتكنولوجيا
التعليم، مع لوحة تحكّمٍ يديرها مالك الموقع وحده — تحرير، وتصميم، وإنتاج صوت
وبودكاست، وتحليلاتٌ للاستخدام الفعلي.

الأرقام الحيّة للمشروع في **[PROJECT-STATUS.md](PROJECT-STATUS.md)** — ملفٌ مولَّد
آلياً من المصدر. لا تُكتب أعدادٌ يدوية في هذا الملف حتى لا يَشيخ التوثيق بصمت.

---

## التقنيات

| الطبقة | الأداة |
| --- | --- |
| الواجهة | React 19 · TypeScript 5.5 · Vite 8 |
| التنسيق | Tailwind 3.4 · Framer Motion 11 |
| التوجيه | React Router 8 |
| البيانات | بياناتٌ ثابتة في `src/data*` + Firestore للمحتوى الحيّ |
| الخادم | Node على Cloud Run (`server.mjs`) |
| الأتمتة | GitHub Actions |

الإصدارات الفعلية تُقرأ من `package.json` و`package-lock.json`، ويتحقّق منها
`npm run docs:check`.

## التشغيل

**المتطلبات:** Node ‏`>=24 <25` (انظر `.nvmrc`) · npm (المشروع على `package-lock.json`).

```bash
npm install
npm run dev
```

## البناء

```bash
npm run build
```

مسار البناء ليس `vite build` وحده: يسبقه حرّاسٌ وفحوص (سياق Cloud Run، الجسور
الحرجة، الرموز البصرية، معمارية الموقع، التنوين العربي، فحوص الموسوعة والصوت)،
ويليه توليدُ الصفحات الثابتة وsitemap وRSS وبطاقات المشاركة، ثم فحص الروابط
وميزانية الأداء والتحقق من ترحيل النطاق. سقوط أيّ حارسٍ يوقف البناء عمداً.

```bash
npm run preview     # معاينة الناتج
npm run prerender   # توليد الصفحات الثابتة وحدها
```

## الاختبارات

```bash
npm run lint                        # tsc --noEmit
npm run test:smoke                  # الصفحات الثابتة
npm run test:performance            # ميزانية الأداء
npm run citations:bibtex:self-test  # الاستشهادات وBibTeX
npm run analytics:self-test         # محرّك «استخدام أدواتي»
npm run search:deeplink:self-test   # الرابط العميق واستعراض النتائج
npm run podcast:ar:self-test        # قفل الحوار اليدوي وبوابات البودكاست
npm run legacy:audit                # جرد الروابط القديمة
npm run docs:check                  # تطابق التوثيق مع المشروع
npm run upgrades:self-test          # عقود الترقيات المجمّعة
```

القائمة الكاملة (أكثر من ثمانين أمر فحص) في `package.json`، وعددها المحدَّث في
`PROJECT-STATUS.md`.

## النشر

- **الموقع:** `npm run deploy:hosting` (Firebase Hosting).
- **قواعد البيانات والتخزين:** `npm run deploy:data-rules`.
- **الخادم (`dr-api`):** يُنشر يدوياً إلى Cloud Run؛ التفاصيل في
  [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- **الأتمتة الدورية:** GitHub Actions (الرادار، الصوت، البودكاست، النسخ الاحتياطي).

## المتغيرات البيئية

القائمة الكاملة بأسمائها وشروحها — بلا قيم — في [`.env.example`](.env.example).
**لا يُلتزم بأي سرٍّ في المستودع.** المستودع عامّ عمداً (دقائق Actions المجانية)،
فأي ملفٍ خاصّ يُخرَج من المستودع ولا يُخصخص المستودع.

الأسرار المطلوبة لعمل الأتمتة تُسجَّل في GitHub Secrets: مفتاح Azure Speech
ومنطقته، وحساب خدمة Firebase، ومفاتيح التخزين. لا يُستخدم أي نموذج لغويّ مدفوع
في أيّ مسار.

## بنية المجلدات

```
src/
  pages/            صفحات المسارات
  components/       مكوّنات الواجهة العامة
  components/admin/ شاشات لوحة التحكّم (المصدر الوحيد: admin-navigation.ts)
  lib/              المنطق: البحث، الاستشهاد، التحليلات، الصوت، المحرّر
  data/             بياناتٌ ثابتة مولَّدة أو محرَّرة
  server/           منطقٌ يشاركه الخادم
scripts/            البناء والحرّاس والفحوص والأتمتة
public/             ملفات تُنسخ كما هي
docs/               وثائق الأنظمة المتخصّصة
dist/               ناتج البناء — لا يُعدَّل يدوياً
```

## ملفات مولَّدة — لا تُحرَّر يدوياً

`PROJECT-STATUS.md` · `dist/**` · `reports/**` · `src/data/knowledge-graph*.json` ·
`src/data/article-pivots.json` · `src/data/listen-index.json` ·
`src/data/book-passages.json` · `src/data/encyclopedia-video-transcripts.json` ·
`src/data/audio*.json`. تعديلها يدوياً يُدهَس في البناء التالي.

## الموقع العام ولوحة الإدارة

- **الموقع العام:** يقرأ البيانات الثابتة أولاً ثم يُثريها من Firestore، ويعمل
  كاملاً حتى لو تعذّر Firebase.
- **لوحة الإدارة (`/admin`):** خلف مصادقة Firebase بادّعاء `admin`، و`noindex`،
  ويستخدمها شخصٌ واحد. تحليلاتها خاصّة ولا تظهر في الموقع العام.

## وثائق الأنظمة

| النظام | الوثيقة |
| --- | --- |
| المعمارية العامة | [ARCHITECTURE.md](ARCHITECTURE.md) |
| البحث والموسوعة | [docs/SEARCH.md](docs/SEARCH.md) |
| البودكاست والحوار اليدوي | [docs/PODCAST.md](docs/PODCAST.md) |
| الصوت والاستضافة | [docs/MEDIA-AUDIO-HOSTING.md](docs/MEDIA-AUDIO-HOSTING.md) |
| الاستشهادات | [docs/CITATIONS.md](docs/CITATIONS.md) |
| التحليلات والخصوصية | [docs/ANALYTICS.md](docs/ANALYTICS.md) |
| لوحة الإدارة | [docs/ADMIN.md](docs/ADMIN.md) |
| مجموعات Firestore | [docs/FIRESTORE.md](docs/FIRESTORE.md) |
| ترحيل الروابط القديمة | [docs/MIGRATION.md](docs/MIGRATION.md) |
| الأمان وحدوده | [SECURITY-NOTES.md](SECURITY-NOTES.md) |
| النشر | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |

## حالة المشروع

قيد التطوير النشط. آخر تحقّقٍ آليّ من هذا التوثيق مسجَّل في `PROJECT-STATUS.md`،
ويُعاد التحقّق بـ`npm run docs:check`.
