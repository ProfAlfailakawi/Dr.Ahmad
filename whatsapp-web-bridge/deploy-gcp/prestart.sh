#!/bin/bash
# قبل كل إقلاع: يجلب السر من Secret Manager عبر هوية الجهاز (بلا مفاتيح على القرص)
# وينظف أقفال كروم اليتيمة — مواصفة «المشغل الحارس» حرفياً.
set -euo pipefail
TOKEN=$(curl -s -H 'Metadata-Flavor: Google' 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' | jq -r .access_token)
SECRET=$(curl -s -H "Authorization: Bearer $TOKEN" 'https://secretmanager.googleapis.com/v1/projects/gen-lang-client-0200723670/secrets/whatsapp-bridge-secret/versions/latest:access' | jq -r .payload.data | base64 -d)
umask 077
printf 'WHATSAPP_BRIDGE_SECRET=%s\n' "$SECRET" > /run/dr-bridge/env
find /opt/dr-bridge/session -maxdepth 5 \( -name SingletonLock -o -name SingletonCookie -o -name SingletonSocket \) -delete 2>/dev/null || true
