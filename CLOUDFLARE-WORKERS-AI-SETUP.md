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
- GitHub أو ZIP أو سجل الالتزامات.

## ربط آلي من الطرفية

بعد تسجيل الدخول إلى `gcloud` وضبط المشروع، يمكن تشغيل السكربت المرفق من دون أن يطبع الرمز السري:

```bash
export CLOUDFLARE_ACCOUNT_ID='<ACCOUNT_ID>'
export CLOUDFLARE_API_TOKEN='<NEW_ROTATED_TOKEN>'
npm run studio-image:configure
```

السكربت يجري أولًا **اختبار توليد حيًا صغيرًا** للتأكد من صحة Account ID والتوكن والصلاحيات والنموذج. لا يحفظ شيئًا في Google إذا فشل الاختبار. بعد نجاحه ينشئ السر أو يضيف نسخة جديدة، يمنح خدمة Cloud Run صلاحية القراءة، ثم يربط المتغيرات بخدمة `dr-api` في `europe-west1`.

لتجاوز الاختبار الحي فقط عند الضرورة:

```bash
CLOUDFLARE_PREFLIGHT=false npm run studio-image:configure
```
