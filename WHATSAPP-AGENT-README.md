# مساعد د. أحمد داخل واتساب

هذه منظومة محلية اختيارية تعمل على Mac Apple Silicon وتبقى خارج حزمة الموقع العامة. الربط غير الرسمي يتم عبر Baileys وعلى رقم واتساب الشخصي فقط؛ لا توجد Meta Cloud API ولا خدمة رسائل خارجية.

## ما نُفّذ

- وكيل محلي مفصول خلف Adapter (`MockTransport` للاختبارات وBaileys للربط الحقيقي).
- فهرس مشتق قابل لإعادة البناء من المقالات والكتب والأبحاث والمختارات والبودكاست وملفات الصوت الحالية.
- SQLite محلي مع FTS5 للبحث، وAES-256-GCM للحقول الحساسة. مفتاح macOS Keychain باسم `dr-ahmad-whatsapp-agent`.
- بوابة موافقة للحملات: Draft → Approved، مع تعطيل الإرسال افتراضيًا.
- محرك نوايا عربي ببوابة ثقة، ورفض هادئ للمحادثات الشخصية غير المرتبطة بالمحتوى.
- أوضاع `suggest-only` و`manual-takeover` و`opt-out`، واحتفاظ مختصر بالسجلات.
- مؤشرات استخدام Azure وحالة Zero-Cost، مع تعطيل الصوت افتراضيًا.
- اقتباس موثق مرتبط بمصدر الموقع، من دون اختراع شهادة أو رأي.
- تثبيت إصدار Baileys بدل الاعتماد على `master`.
- Self-test وCost Audit وLaunchAgent اختياري على macOS.

## التثبيت على الماك

```bash
cd whatsapp-agent
npm install --ignore-scripts
npm run self-test
npm run cost-audit
```

لا تُرفع مجلدات `node_modules` أو `Library/Application Support/DrAhmadWhatsAppAgent` إلى Git أو ZIP.

## التشغيل والربط

```bash
npm run start
```

سيظهر QR عند تشغيل الوكيل بعد تثبيت Baileys. اربط من الهاتف: واتساب → الإعدادات → الأجهزة المرتبطة → ربط جهاز. يمكن طلب رمز اقتران عبر:

```bash
npm run start -- --phone=965XXXXXXXX
```

لا يمكن إثبات نجاح QR أو قوائم البث قبل تنفيذ الربط على هاتف د. أحمد نفسه. لا ترسل إلى قوائم أو أرقام قبل اختبار الإرسال إلى الذات.

يمكن تشغيل الجسر المحلي اختياريًا للوحة الإدارة فقط، ولا يستمع إلا على `127.0.0.1`:

```bash
WHATSAPP_AGENT_BRIDGE=true npm run start
```

ثم يُضبط `VITE_WHATSAPP_AGENT_BRIDGE_URL=http://127.0.0.1:34321` محليًا عند الحاجة. لا يُنشر هذا المتغير ولا يُفتح المنفذ على الإنترنت.

## الإرسال الآمن

الوضع الافتراضي لا يرسل أي شيء (`WHATSAPP_SEND_ENABLED=false`) ولا يرد آليًا (`WHATSAPP_AUTO_REPLY_ENABLED=false`). بعد اختبار Mock والربط، فعّلها محليًا فقط في جلسة واضحة، ثم أرسل إلى الذات بتأكيد مزدوج من واجهة التشغيل.

```bash
WHATSAPP_SEND_ENABLED=true npm run send-self -- --confirm --text "تجربة من مساعد د. أحمد"
```

لا يوجد إرسال جماعي تلقائي. أي حملة تحفظ Draft، ثم تحتاج اعتمادًا صريحًا قبل أن تصبح Approved.
حتى بعد الاعتماد لا يبدأ الإرسال تلقائيًا؛ الإرسال اليدوي يحتاج `--confirm --confirm-again`، ويُرسل فقط إلى جهات محفوظة صراحة أو إلى الذات، مع حد أقصى محلي للحملة.

## الأوامر

```bash
npm run status
npm run index
npm run agent:self-test   # من جذر الموقع
npm run agent:cost-audit
npm run stop
npm run install           # LaunchAgent اختياري على macOS
npm run uninstall
npm run logout -- --confirm --confirm-again
npm run send-campaign -- --id=CAMPAIGN_ID --confirm --confirm-again
npm run stop-campaign -- --id=CAMPAIGN_ID
```

`logout` يحذف جلسة واتساب المحلية فقط، ولا يحذف المحتوى أو جهات الاتصال من الهاتف.

## Azure والصوت

`ZERO_COST_MODE=true` و`WHATSAPP_VOICE_ENABLED=false` هما الإعدادان الافتراضيان. لا تُفعّل قراءة Voice Notes إلا بعد تأكيد أن مورد Azure الفعلي F0، وتبقى حدود الإيقاف المحلية أقل من الحصة. عند غياب التأكيد يتحول النظام إلى النص فقط بلا مزود بديل مدفوع.

## ما يحتاج خطوة من د. أحمد

1. تثبيت تبعيات `whatsapp-agent` محليًا.
2. تشغيل الوكيل وربط QR على الهاتف.
3. اختبار الذات فقط.
4. تقرير Capability Probe لقوائم البث؛ لا أعد بقراءة الأعضاء قبل الاختبار الفعلي.

لا توجد جلسة أو مفاتيح أو قاعدة بيانات داخل التسليم.
