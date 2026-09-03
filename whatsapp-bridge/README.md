# جسر واتساب المركزي

هذا المجلد خدمة مستقلة عن الموقع. يستخدم `whatsapp-web.js` و`LocalAuth`، ولا
يحتوي منطق الإجابات. كل رسالة تذهب إلى الخادم الرئيسي عبر Webhook محمي،
والخادم وحده يقرر الرد من فهرس الموقع والقواعد المعتمدة.

## النشر على Ubuntu VM صغيرة

المقترح العملي 1GB RAM مع 1GB swap. لا تضع هذه الخدمة على جهاز الدكتور ولا
تعتمد على بقاء Chrome مفتوحًا.

```bash
sudo apt update
sudo apt install -y ca-certificates fonts-noto-core fonts-noto-color-emoji logrotate
sudo useradd --system --home /var/lib/whatsapp-bridge --shell /usr/sbin/nologin whatsapp
sudo mkdir -p /opt/whatsapp-bridge /var/lib/whatsapp-bridge/session /var/log/whatsapp-bridge
sudo chown -R whatsapp:whatsapp /var/lib/whatsapp-bridge /var/log/whatsapp-bridge
```

انسخ **محتويات** `whatsapp-bridge` إلى `/opt/whatsapp-bridge` ثم:

```bash
cd /opt/whatsapp-bridge
# LocalAuth لا يحتاج إضافات الأرشفة الاختيارية؛ لا نثبتها لتقليل السطح الأمني.
sudo npm ci --omit=dev --omit=optional
sudo cp .env.example /etc/whatsapp-bridge.env
sudo chmod 600 /etc/whatsapp-bridge.env
sudo cp deploy/whatsapp-bridge.service /etc/systemd/system/
sudo cp deploy/whatsapp-bridge.logrotate /etc/logrotate.d/whatsapp-bridge
sudo systemctl daemon-reload
sudo systemctl enable --now whatsapp-bridge
sudo systemctl status whatsapp-bridge
```

ضع في الخادم الرئيسي القيمة نفسها لـ`WHATSAPP_BRIDGE_SECRET`. أنشئها مثلًا:

```bash
openssl rand -hex 32
```

بعد ظهور QR في تبويب «جهاز الواتساب»:

1. افتح واتساب في الرقم المخصص.
2. الإعدادات ← الأجهزة المرتبطة ← ربط جهاز.
3. امسح QR مرة واحدة.

تبقى الجلسة في `/var/lib/whatsapp-bridge/session`. المشغّل الحارس ينظف قبل
كل إقلاع عمليات Chrome الخاصة بهذه الجلسة فقط وملفات
`SingletonLock/SingletonCookie/SingletonSocket`، ثم يعيد التشغيل بتأخير
متدرج. لا تُحذف بيانات `LocalAuth` إلا من أمر «إعادة ربط» الصريح.

## الفحص

```bash
curl http://127.0.0.1:34322/healthz
sudo tail -f /var/log/whatsapp-bridge/bridge.log
sudo logrotate -d /etc/logrotate.d/whatsapp-bridge
```

السجلات تقنّع أرقام الناس ولا تطبع السر أو نصوص المحادثات.
