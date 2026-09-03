#!/bin/bash
# إقلاع الجسر: يجلب السر بهوية الجهاز إلى بيئة العملية فقط (لا يُكتب على قرص)،
# ينظف أقفال كروم، ثم يسلّم القيادة للمشغّل — بديل ExecStartPre/EnvironmentFile
# اللذين يتعارضان في ترتيب systemd (يقرأ ملف البيئة قبل خطوة التحضير).
set -euo pipefail
TOKEN=$(curl -s -H 'Metadata-Flavor: Google' 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' | jq -r .access_token)
export WHATSAPP_BRIDGE_SECRET=$(curl -s -H "Authorization: Bearer $TOKEN" 'https://secretmanager.googleapis.com/v1/projects/gen-lang-client-0200723670/secrets/whatsapp-bridge-secret/versions/latest:access' | jq -r .payload.data | base64 -d)
find /opt/dr-bridge/session -maxdepth 5 \( -name SingletonLock -o -name SingletonCookie -o -name SingletonSocket \) -delete 2>/dev/null || true
exec /usr/bin/node /opt/dr-bridge/app/service-runner.mjs
