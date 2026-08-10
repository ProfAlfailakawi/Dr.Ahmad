# خطة التعافي من الكوارث — موقع د. أحمد الفيلكاوي

> هذه الوثيقة تُنفَّذ من أي شخص تقنيّ لو لم يكن صاحب المشروع موجوداً. مصدر الحقيقة
> للجرد هو `backup-inventory.json`. الحارس `scripts/guard-backup-inventory.mjs`
> يمنع تسلّل مصدر بيانات دائم جديد دون إدراجه في السياسة.

## 0) صدقٌ في الحالة (٢٠٢٦-٠٨-١٠)

**النظام مبنيّ ومختبَر offline + بروفة قراءة حيّة، لكن «ليس كل شيء محفوظاً بعد».**
لإعلان «محفوظ» يلزم: جرد موثّق ✅ + Backup كامل ناجح على الإنتاج (يحتاج `sa.json` في CI) +
Verify ناجح ✅ (offline + على عيّنة حيّة) + بروفة استرجاع معزولة على مشروع منفصل (لم تُنفَّذ بعد).

### حقائق حيّة مؤكّدة (قراءة فقط، بحساب المالك)
| المصدر | الحالة الفعلية | الأثر |
|---|---|---|
| Firestore PITR | **معطّل** (مدفوع، مؤجّل بأمر المالك) | أقصى ما يُفقد = منذ آخر نسخة يومية (RPO ٢٤س) |
| Firestore حماية الحذف | **مُفعّلة ✅** | لا يمكن محو قاعدة البيانات بأمر واحد |
| Firestore نسخ مُدارة | **صفر** (مدفوعة، مؤجّلة) | يعوّضها النسخ العودي المجاني اليومي |
| Firebase Storage versioning | **مُفعّلة ✅** | الدهس/الحذف صار قابلاً للاسترجاع |
| حجم Storage / الصوت | **~٧١ م.ب / ~٦.٦ ج** | Storage صغير؛ الصوت أكبر مما توقّعناه |
| Cloudflare R2 versioning | لا شيء | يعوّضه نسخ Firestore (باكت خاص) وأثر GitHub |

### الفجوات الجذرية (سبب كلٍّ منها)
1. **النسخة القديمة كانت عليا فقط** — كانت تتجاهل `site_cv_files/{id}/chunks` (بايتات ملفات السيرة) بوصفها «غير حرجة»، وهذا خطأ. **عُولج:** `scripts/backup-firestore.mjs` صار عودياً ويلتقط `chunks` و`readers` (مُبرهَن حيّاً: النسخة رصدت `site_cv_files/ar/chunks` و`en/chunks`).
2. **النسخة كانت في باكت R2 نفسه الذي تحميه منه** — خرق 3-2-1. **عُولج:** أُضيفت نسخة ثالثة مستقلة (أثر GitHub ٩٠ يوماً) في الـworkflow.
3. **جرد الشيفرة الثابت يفوته مجموعات ديناميكية** — ١٠ مجموعات `whatsapp_*` تُبنى أسماؤها في الخادم. **عُولج:** أُدرجت، وأُضيف وضع مصالحة حيّة `--live` للحارس.
4. **~~لا نسخ لـFirebase Storage ولا لصوت R2~~ — عُولج:** Storage يُنسخ أسبوعياً إلى أثر GitHub مستقل (`backup-storage.yml`، ٣٩ ملفاً/٧٢م.ب + SHA-256)، والصوت (٦.٦ج) إلى GitHub Release مستقل (`backup-audio-release.yml`). مرآة R2→R2 رُفضت لأنها تتجاوز حصة R2 المجانية (كلفة).
5. **🔴 مؤكّد حيّاً (٢٠٢٦-٠٨-١٠) — أولوية قصوى · تسريب خصوصية نشط:**
   `curl -I https://pub-e2ce7a54469544ecab38d55cd80787aa.r2.dev/backups/firestore-latest.json.gz`
   يعيد **`200`**: نسخة Firestore الكاملة **مقروءة للعالم الآن**، وفيها بيانات شخصية
   (إيميلات `subscribers`، رسائل `messages`) وأي مفاتيح في `admin_publication_signing_keys`.
   السبب: النسخ تُوضع في باكت R2 نفسه الذي يخدم الصوت عبر نطاق `pub-…r2.dev` العام.
   **العلاج العاجل (يحتاج صلاحية R2 — لم أستطع تنفيذه بلا مفاتيح، ولن أحذف نسخةً):**
   (أ) أنشئ باكت R2 **خاصّاً منفصلاً** بلا نطاق عام ووجّه النسخ إليه (غيّر `CLOUDFLARE_R2_BUCKET`
   للنسخ فقط)، أو (ب) عطّل النطاق العام عن مسار `backups/`، و/أو (ج) شفّر النسخة قبل الرفع
   (`gpg --symmetric`). النسخة الثالثة (أثر GitHub) خاصّة أصلاً فلا تتأثر.

## 1) أهداف التعافي
- **RPO (أقصى عمل يُفقد):** Firestore = **٢٤ ساعة** (النسخة اليومية). الأثمن (chunks/التواقيع/المقالات) = **ساعة واحدة** فقط إن فُعّل PITR.
- **RTO (زمن الاسترجاع):** الموقع الثابت + Firestore = **< ٤ ساعات** من نسخة سليمة. الصوت (R2) بحسب الحجم. البوت = إعادة إقران QR يدوية.

## 2) 3-2-1 — الحالة
- **٣ نسخ:** (أ) R2 `backups/` (ب) أثر GitHub مستقل (ج) *ناقصة:* نسخة خارج مزوّدَي الإنتاج (أنزلها دورياً محلياً — أمر أدناه).
- **وسيطان:** Cloudflare R2 + GitHub artifacts ✅.
- **مستقلة عن مزوّد الإنتاج:** أثر GitHub مستقل عن R2 ✅ (لكن ليس عن GitHub — لذا أضف تنزيلاً محلياً/بارداً).

## 3) الأوامر
```bash
npm run backup:self-test      # اختبار كامل بلا شبكة (عودية + كشف فساد + تغطية)
npm run guard:backup-inventory
npm run backup:full           # يحتاج sa.json أو GOOGLE_ACCESS_TOKEN+FIREBASE_PROJECT_ID
npm run backup:verify -- build/firestore-backup-YYYY-MM-DD.json.gz
npm run restore:dry-run -- build/firestore-backup-YYYY-MM-DD.json.gz
```
نسخة يدوية حيّة بحساب gcloud المالك (قراءة فقط، مجانية):
```bash
export GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token)"
export FIREBASE_PROJECT_ID=drahmad-8e9e2
node scripts/backup-firestore.mjs --out=~/dr-backups   # النسخة الباردة المستقلة (النسخة ٣)
```

## 4) إجراء الاسترجاع الكارثي (Firestore)
1. أنشئ **مشروعاً معزولاً** جديداً (لا تلمس الإنتاج): `gcloud firestore databases create --location=nam5 --project=<isolated>`.
2. نزّل أحدث نسخة سليمة: `aws s3 cp s3://<R2_BUCKET>/backups/firestore-latest.json.gz . --endpoint-url <R2_ENDPOINT>` (أو من أثر GitHub).
3. تحقّق: `node scripts/backup-restore.mjs verify firestore-latest.json.gz` (يجب أن يطابق SHA-256 والأعداد).
4. بروفة: `node scripts/backup-restore.mjs dry-run firestore-latest.json.gz`.
5. استرجاع فعليّ إلى المعزول فقط: `... restore <file> --apply --confirm-write-to=<isolated>` — **ممنوع `--confirm-write-to=drahmad-8e9e2` (الأداة ترفضه).** الكتابة الفعلية إلى Firestore يُنفّذها بشريٌّ بحساب خدمة المعزول بعد مراجعة.
6. بعد التأكّد من سلامة المعزول، تُقرّر بشرياً ترقيته أو النسخ منه إلى الإنتاج.

## 5) استعادة الأسرار والحالة غير القابلة لإعادة البناء
راجع `backup-inventory.json` → `secretsCatalog`. **حواجز الاسترجاع (بدونها لا استرجاع كامل):**
`FIREBASE_SERVICE_ACCOUNT_DRAHMAD_8E9E2` · مفاتيح R2 الأربعة + `AUDIO_PUBLIC_BASE_URL` ·
`WHATSAPP_BRIDGE_SECRET` · `AZURE_SPEECH_KEY/REGION`. مصدرها: لوحات المزوّدين + GitHub secrets.
**حالة لا تُبنى من مصدر:** `agent.sqlite` (ذاكرة البوت) و`whatsapp-web-bridge/session/` (فقدها = إقران QR يدوي جديد على هاتف الدكتور).

## 6) أوامر المالك المطلوبة — «غير متحقق» حتى تُنفَّذ (بعضها بكلفة)
> قاعدتك «لا خدمات مدفوعة». نبّهتُ على كل بند بكلفة. المجاني نفّذه فوراً.

- **[مجاني · موصى به بشدّة] فعّل حماية حذف Firestore:**
  `gcloud firestore databases update --database='(default)' --delete-protection --project=drahmad-8e9e2`
- **[مجاني] تحقّق PITR/النسخ المُدارة:**
  `gcloud firestore databases describe --database='(default)' --project=drahmad-8e9e2`
- **[بكلفة صغيرة] PITR (نافذة ٧ أيام، RPO ساعة):** `... update --enable-pit-recovery ...` — يكلّف تخزين تغييرات. قرارك.
- **[بكلفة صغيرة] نسخ Firestore مُدارة يومية (٧ أيام):** `gcloud firestore backups schedules create ...` — تخزين نسخ. قرارك.
- **[مجاني تقريباً · ٧١م.ب] مرآة Firebase Storage** (لا يوجد لها نسخ حالياً):
  `gsutil -m rsync -r gs://drahmad-8e9e2.firebasestorage.app ~/dr-backups/storage/`
  ولتفعيل الإصدارات (يمنع الدهس النهائي): `gsutil versioning set on gs://drahmad-8e9e2.firebasestorage.app` (تخزين إضافي بسيط).
- **[يحتاج مفاتيح R2] مرآة صوت R2** (لا نسخ حالياً): `aws s3 sync s3://<R2_BUCKET> ~/dr-backups/r2/ --endpoint-url <R2_ENDPOINT>`.
- **[يدوي] انسخ `agent.sqlite` و`whatsapp-web-bridge/session/`** إلى مكان بارد مشفّر دورياً.

## 7) الجدول
- **يومي:** نسخة Firestore عودية + تحقّق + بروفة معزولة (workflow، RPO ٢٤س).
- **أسبوعي:** مرآة Storage + R2 (أمر المالك، حتى يُؤتمت).
- **شهري:** نسخة باردة محلية مستقلة عن المزوّدَين (الأمر في §3) — طويلة الاحتفاظ.
- **ربع سنوي:** بروفة استرجاع كاملة إلى مشروع معزول (§4)، ثم حذفه.

## 8) الأمان
أقلّ صلاحيات لكل حساب خدمة. لا تطبع الأسرار في السجلّات. النسخ الخاصة (source-desk،
التواقيع، المشتركون، الرسائل) تبقى في مسارات خاصة لا عامة. لا تنقل أي سرّ إلى Git.
عند تدوير مفتاح: احتفظ بالقديم حتى تتأكّد أن النسخ القديمة ما زالت تُقرأ بالجديد.
