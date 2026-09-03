# إصلاح صلاحية Secret Manager في GitHub Actions

إذا ظهر الخطأ:

```text
Permission secretmanager.secrets.create denied
```

فهذا لا يعني أن Cloudflare أو التوكن الجديد فاشلان. ظهور رسالة `Cloudflare preflight passed` يثبت أن Account ID والتوكن والصلاحيات والنموذج يعملون. المشكلة فقط أن حساب Google المستخدم في GitHub Actions لا يملك إنشاء أسرار داخل Google Secret Manager.

النسخة الحالية تعالج ذلك تلقائياً بطبقتين:

1. تحاول أولاً التخزين المفضل داخل **Google Secret Manager**.
2. عند رفض IAM، تكمل النشر دون سقوط، وتأخذ التوكن من **GitHub Secrets** وتوصله إلى مراجعة Cloud Run كمتغير تشغيل. لا يكتب التوكن في المستودع أو ZIP أو ملفات React.
3. مسار الصحة يعرض `tokenStorage` بقيمة `secret-manager` أو `cloud-run-environment` لتسهيل التشخيص.
4. عندما تمنح الصلاحية لاحقاً، التشغيل التالي يهاجر تلقائياً إلى Secret Manager.

للوضع الأمني المفضل دائماً، امنح حساب النشر:

```text
github-firebase-hosting@gen-lang-client-0200723670.iam.gserviceaccount.com
```

الدور التالي على مشروع `gen-lang-client-0200723670`:

```text
Secret Manager Admin
roles/secretmanager.admin
```

بعدها أعد تشغيل GitHub Actions. لا حاجة لإنشاء توكن Cloudflare جديد مرة أخرى ما دام التوكن الحالي جديداً ونجح في الـpreflight.

---

# ربط Cloudflare Workers AI باستوديو التصاميم

## المعمارية المعتمدة

المتصفح لا يتصل بـ Cloudflare مباشرة ولا يرى الرمز السري.

```text
استوديو التصاميم
        ↓  POST /api/ai/studio-image + Firebase ID token
Firebase Hosting
        ↓  rewrite /api/**
Cloud Run: dr-api (europe-west1)
        ↓  Authorization: Bearer <server secret>
Cloudflare Workers AI
```

ملف `firebase.json` في المشروع يحتوي أصلًا على Rewrite يمرر `/api/**` إلى خدمة `dr-api`، لذلك لا يلزم وضع أي مفتاح في React أو متغير يبدأ بـ `VITE_`.


## إصلاح HTTP 404 ونشر الخادم مع الموقع

كان GitHub Actions ينشر ملفات Firebase Hosting فقط، بينما تبقى خدمة `dr-api` على مراجعة قديمة من `server.mjs`. لذلك كانت الواجهة الحديثة تصل إلى خدمة موجودة، لكن المسار `/api/ai/studio-image` غير موجود داخل مراجعتها القديمة فيرجع `HTTP 404`.

الـworkflow الحالي أصبح ينفذ بالترتيب:

1. فحوص TypeScript واختبارات مسار التوليد.
2. نشر **المراجعة الحالية** من `server.mjs` إلى Cloud Run.
3. فحص `/api/ai/studio-image/health` مباشرة على Cloud Run.
4. نشر Firebase Hosting.
5. فحص المسار مرة أخرى من النطاق الرسمي.

كما أضيف مساران احتياطيان متكافئان داخل الخادم لمنع اختلاف أسماء المسارات:

- `/api/studio-image`
- `/api/generate-studio-image`

جميع مسارات التوليد الفعلية تبقى محمية بتوثيق الإدارة؛ مسار الصحة فقط لا يولد صورة ولا يعرض أي سر.

## الربط الآلي عبر GitHub Actions

أضف التوكن الجديد بعد تدويره إلى **Repository secret** باسم:

```text
CLOUDFLARE_API_TOKEN
```

يمكن إضافة Account ID كـRepository variable باسم `CLOUDFLARE_ACCOUNT_ID`. المشروع يحتوي fallback خاصًا بحسابه الحالي لأن Account ID ليس مفتاحًا سريًا.

يفضل إضافة حساب خدمة Google مخصص للنشر كسر اختياري باسم:

```text
GCP_CLOUD_RUN_SERVICE_ACCOUNT
```

وعند عدم وجوده يحاول الـworkflow استخدام حساب خدمة Firebase الموجود. يحتاج الحساب صلاحيات نشر Cloud Run والبناء من المصدر والتعامل مع Secret Manager.

## الأسرار المطلوبة في Cloud Run

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

والإعدادات الاختيارية:

- `CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell`
- `CLOUDFLARE_IMAGE_STEPS=8`
- `CLOUDFLARE_IMAGE_TIMEOUT_MS=45000`

## الإعداد الآمن عبر Google Secret Manager

أنشئ رمز Cloudflare جديدًا بعد إلغاء الرمز الذي سبق مشاركته في المحادثة. عند إنشاء Token مخصص، امنحه صلاحيتَي **Workers AI — Read** و **Workers AI — Edit** للحساب المقصود، ثم خزنه:

```bash
printf '%s' "$NEW_CLOUDFLARE_TOKEN" | \
  gcloud secrets create cloudflare-workers-ai-token \
  --data-file=- \
  --replication-policy=automatic
```

عند وجود السر مسبقًا، أضف نسخة جديدة بدل إنشاء السر مرة ثانية:

```bash
printf '%s' "$NEW_CLOUDFLARE_TOKEN" | \
  gcloud secrets versions add cloudflare-workers-ai-token \
  --data-file=-
```

ثم اربط الإعدادات بخدمة Cloud Run:

```bash
gcloud run services update dr-api \
  --region=europe-west1 \
  --set-env-vars=CLOUDFLARE_ACCOUNT_ID=<ACCOUNT_ID>,CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell,CLOUDFLARE_IMAGE_STEPS=8,CLOUDFLARE_IMAGE_TIMEOUT_MS=45000 \
  --set-secrets=CLOUDFLARE_API_TOKEN=cloudflare-workers-ai-token:latest
```

يجب منح حساب تشغيل خدمة `dr-api` صلاحية قراءة السر عند طلب Google ذلك.

## ما يحدث داخل الاستوديو

1. يكتب المستخدم الفكرة والسياق الاختياري.
2. يبني الخادم توجيهًا بصريًا تحريريًا غير حرفي، مع استعارة بصرية ومساحة آمنة للعربية وقائمة كليشيهات ممنوعة.
3. يولد Cloudflare صورة أصلية.
4. يحلل الاستوديو الصورة محليًا لتحديد القص ونقطة التركيز والمساحة الهادئة.
5. يبني المحرك عشرات التكوينات داخليًا، ويقصي المتشابه والضعيف.
6. يمرر أفضلها على الناقد وحزمة Final / Safer / Viral.
7. يعرض نتيجة واحدة معتمدة فقط.
8. مسارا الصور منفصلان تمامًا:
   - **توليد من الصفر:** Cloudflare فقط. عند الفشل تظهر المشكلة الحقيقية ولا ينتقل إلى Pexels من وراء المستخدم.
   - **صورة جاهزة:** Pexels/Wikimedia/Openverse فقط، مع المصدر والترخيص.
9. «أعد التوليد من الصفر» يرسل معرّفًا وبذرة وتوجيهًا فنيًا جديدًا، فلا يعيد استعمال الصورة أو التكوين السابقين.

## فحص سريع بعد النشر

- سجّل الدخول بحساب إداري.
- افتح استوديو التصاميم.
- اختر **توليد من الصفر**، اكتب فكرة، ثم اضغط «ولّد من الصفر — وصمّم لي».
- يجب أن تظهر في النتيجة شارة `AI GENERATED` واسم نموذج Cloudflare ووقت التوليد.
- اختر بعد ذلك **صورة جاهزة** للتأكد أن النتيجة تحمل شارة `READY SOURCE` ومصدر الصورة.
- عند فشل Cloudflare، لن ترى صورة Pexels بدلًا منه؛ ستظهر رسالة دقيقة تشير إلى المصادقة أو الربط أو المهلة.
- افحص سجلات `dr-api` عند ظهور رسالة تعذر التوليد.

## قاعدة أمنية

لا تضع `CLOUDFLARE_API_TOKEN` في:

- ملفات React أو TypeScript الأمامية.
- `firebase.json`.
- أي متغير يبدأ بـ `VITE_`.
- ملفات GitHub أو ZIP أو سجل الالتزامات؛ داخل GitHub استخدم **Secrets** فقط.

## ربط آلي من الطرفية

بعد تسجيل الدخول إلى `gcloud` وضبط المشروع، يمكن تشغيل السكربت المرفق من دون أن يطبع الرمز السري:

```bash
export CLOUDFLARE_ACCOUNT_ID='<ACCOUNT_ID>'
export CLOUDFLARE_API_TOKEN='<NEW_ROTATED_TOKEN>'
npm run studio-image:configure
```

السكربت يجري أولًا **اختبار توليد حيًا صغيرًا** للتأكد من صحة Account ID والتوكن والصلاحيات والنموذج. لا يحفظ شيئًا في Google إذا فشل الاختبار. بعد نجاحه ينشئ السر أو يضيف نسخة جديدة، يكتشف حساب تشغيل `dr-api` ويمنحه صلاحية القراءة، **ينشر كود الخادم الحالي من الصفر**، ثم يربط المتغيرات ويختبر مسار الصحة في `europe-west1`.

لتجاوز الاختبار الحي فقط عند الضرورة:

```bash
CLOUDFLARE_PREFLIGHT=false npm run studio-image:configure
```
