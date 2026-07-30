#!/bin/bash
# الحارس الخارجي كل دقيقتين: (١) غير جاهز ٥ دقائق كاملة → إعادة تشغيل؛
# (٢) عطب «الإطار المنفصل» في فحصين متتاليين → إعادة تشغيل؛
# (٣) نبضة الخادم أقدم من ٤ دقائق → إعادة تشغيل. التنظيف يجري في prestart.
STATE=/opt/dr-bridge/logs/guardian-state
mkdir -p /opt/dr-bridge/logs
H=$(curl -s -m 6 http://127.0.0.1:34322/health || true)
NOW=$(date +%s)
ready=0; detached=0; stale=0
if echo "$H" | jq -e '.connected == true' >/dev/null 2>&1; then ready=1; fi
if echo "$H" | jq -e '.lastCatchupError | test("detached|Execution context|Target closed|reinjection")' >/dev/null 2>&1; then detached=1; fi
HB=$(echo "$H" | jq -r '.lastWebhookAt // empty' 2>/dev/null)
if [ -n "$HB" ]; then HBS=$(date -d "$HB" +%s 2>/dev/null || echo 0); [ $((NOW - HBS)) -gt 240 ] && stale=1; fi
prev_first=$(sed -n 1p "$STATE" 2>/dev/null || echo 0)
prev_detached=$(sed -n 2p "$STATE" 2>/dev/null || echo 0)
restart() { logger -t dr-bridge-guardian "restart: $1"; printf '0\n0\n' > "$STATE"; systemctl restart whatsapp-bridge; exit 0; }
if [ "$detached" = 1 ] && [ "$prev_detached" = 1 ]; then restart "detached-context persistent"; fi
if [ "$ready" = 1 ] && [ "$stale" = 1 ]; then restart "stale-heartbeat"; fi
if [ "$ready" = 1 ]; then printf '0\n%s\n' "$detached" > "$STATE"; exit 0; fi
first=$prev_first; [ "$first" = 0 ] && first=$NOW
if [ $((NOW - first)) -ge 300 ]; then restart "not ready for 5 minutes"; fi
printf '%s\n%s\n' "$first" "$detached" > "$STATE"
