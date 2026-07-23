#!/bin/bash
# إسعاف مساعد الواتساب — انقر هذا الملف نقرتين في Finder وسيتكفل بالباقي.
# يعالج الحالة المعروفة: استبدال مجلد الموقع بنسخة جديدة يمحو اعتماديات البوت
# فتنهار الخدمة بصمت. هذا الملف يعيد التثبيت والتشغيل ويخبرك بالنتيجة بالعربي.

cd "$(dirname "$0")" || exit 1

echo "══════════════════════════════════════════"
echo "   🔧 إسعاف مساعد الواتساب — د. أحمد"
echo "══════════════════════════════════════════"
echo ""

# ١) نتأكد من وجود node
NODE_BIN="$(command -v node || echo /usr/local/bin/node)"
if ! "$NODE_BIN" --version >/dev/null 2>&1; then
  echo "✗ لم أجد node على الجهاز — ثبّت Node.js أولاً ثم أعد النقر."
  read -r -p "اضغط Enter للإغلاق"; exit 1
fi
echo "✓ Node موجود ($($NODE_BIN --version))"

# ٢) الاعتماديات: إن كانت مفقودة نثبتها من قفل الحزم
if [ ! -d node_modules/@whiskeysockets/baileys ]; then
  echo "⏳ الاعتماديات مفقودة — أثبّتها الآن (دقيقة تقريباً)…"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund || {
    echo "✗ تعذر التثبيت. تأكد من اتصال الإنترنت ثم أعد النقر."
    read -r -p "اضغط Enter للإغلاق"; exit 1
  }
  echo "✓ الاعتماديات رجعت"
else
  echo "✓ الاعتماديات موجودة"
fi

# ٣) نعيد تثبيت خدمة التشغيل التلقائي (يصحح المسارات لو انتقل المجلد) ثم نوقظها
"$NODE_BIN" cli.mjs install >/dev/null 2>&1
launchctl kickstart -k "gui/$(id -u)/com.dr-alfailakawi.whatsapp-agent" 2>/dev/null
echo "✓ أُعيد تشغيل الخدمة"

# ٤) ننتظر نبضة الجسر حتى ٤٥ ثانية
echo -n "⏳ أنتظر نبضة البوت"
for i in $(seq 1 45); do
  if curl -s -m 1 http://127.0.0.1:34321/ping | grep -q alive; then
    echo ""
    echo ""
    echo "══════════════════════════════════════════"
    echo "   ✅ البوت يعمل الآن — الجسر حي"
    echo "   جرّب من الواتساب: اكتب «موقع د. أحمد»"
    echo "══════════════════════════════════════════"
    read -r -p "اضغط Enter للإغلاق"; exit 0
  fi
  echo -n "."
  sleep 1
done

echo ""
echo "⚠ الخدمة انطلقت لكن النبضة تأخرت. آخر سطرين من السجل:"
tail -2 "$HOME/Library/Application Support/DrAhmadWhatsAppAgent/agent.err.log" 2>/dev/null
echo "أعد النقر مرة أخرى بعد دقيقة؛ فإن تكرر أرسل لقطة هذه الشاشة."
read -r -p "اضغط Enter للإغلاق"
