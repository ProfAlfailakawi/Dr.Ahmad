#!/usr/bin/env bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RESIDENT_ROOT="$HOME/Library/Application Support/DrAhmadWhatsAppBridge"
RESIDENT_APP="$RESIDENT_ROOT/app"
SESSION_DIR="$RESIDENT_ROOT/session"
LOG_DIR="$RESIDENT_ROOT/logs"
BACKUP_DIR="$RESIDENT_ROOT/legacy-launch-agents"
PLIST_NAME="com.alturath.whatsapp-bridge.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"
LABEL="com.alturath.whatsapp-bridge"

echo "======================================================"
echo "    Installing WhatsApp Bridge Auto-Start Service     "
echo "======================================================"

NODE_PATH="$(command -v node || echo "/usr/local/bin/node")"
NPM_PATH="$(command -v npm || echo "/usr/local/bin/npm")"
GCLOUD_PATH="$(command -v gcloud || echo "/opt/homebrew/share/google-cloud-sdk/bin/gcloud")"

mkdir -p "$HOME/Library/LaunchAgents" "$RESIDENT_APP" "$SESSION_DIR" "$LOG_DIR" "$BACKUP_DIR"
chmod 700 "$RESIDENT_ROOT" "$RESIDENT_APP" "$SESSION_DIR" "$LOG_DIR" "$BACKUP_DIR"

# مصدرٌ مقيم لا يتأثر بحذف المشروع أو استبداله. الجلسة خارج app فلا يمسها أي تحديث.
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'session' \
  --exclude '*.log' \
  "$DIR/" "$RESIDENT_APP/"

if [ -f "$DIR/package-lock.json" ]; then
  "$NPM_PATH" --prefix "$RESIDENT_APP" ci --omit=dev --no-audit --no-fund
else
  "$NPM_PATH" --prefix "$RESIDENT_APP" install --omit=dev --no-audit --no-fund
fi

# إيقاف البقايا المتعارضة: كان على الجهاز ناقلان وLaunchAgent قديم في حلقة انهيار.
for OLD_LABEL in com.dr-alfailakawi.whatsapp-agent com.dr-alfailakawi.whatsapp-watchdog com.dr-alfailakawi.whatsapp-bridge "$LABEL"; do
  launchctl bootout "gui/$(id -u)/$OLD_LABEL" 2>/dev/null || true
done
for OLD_PLIST in \
  "$HOME/Library/LaunchAgents/com.dr-alfailakawi.whatsapp-agent.plist" \
  "$HOME/Library/LaunchAgents/com.dr-alfailakawi.whatsapp-watchdog.plist" \
  "$HOME/Library/LaunchAgents/com.dr-alfailakawi.whatsapp-bridge.plist"; do
  if [ -f "$OLD_PLIST" ]; then
    OLD_BACKUP="$BACKUP_DIR/$(basename "$OLD_PLIST").disabled"
    if [ -f "$OLD_BACKUP" ]; then
      OLD_BACKUP="$OLD_BACKUP.$(date +%Y%m%d-%H%M%S)"
    fi
    mv "$OLD_PLIST" "$OLD_BACKUP"
  fi
done

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-ims</string>
    <string>$NODE_PATH</string>
    <string>$RESIDENT_APP/service-runner.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$RESIDENT_APP</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WHATSAPP_MAIN_SERVER_URL</key>
    <string>https://dr-alfailakawi.com</string>
    <key>WHATSAPP_BRIDGE_DEVICE_ID</key>
    <string>primary</string>
    <key>WHATSAPP_BRIDGE_DEVICE_NAME</key>
    <string>Dr Ahmad WhatsApp Bridge</string>
    <key>WHATSAPP_SESSION_DIR</key>
    <string>$SESSION_DIR</string>
    <key>WHATSAPP_SECRET_PROJECT</key>
    <string>gen-lang-client-0200723670</string>
    <key>WHATSAPP_SECRET_NAME</key>
    <string>whatsapp-bridge-secret</string>
    <key>GCLOUD_BIN</key>
    <string>$GCLOUD_PATH</string>
    <key>NPM_BIN</key>
    <string>$NPM_PATH</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/bridge.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/bridge.err.log</string>
</dict>
</plist>
EOF

chmod 644 "$PLIST_PATH"

launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/$LABEL"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo "[✓] WhatsApp Bridge Auto-Start Service installed successfully!"
echo "[✓] Plist created at: $PLIST_PATH"
echo "[✓] Stable app: $RESIDENT_APP"
echo "[✓] Persistent session: $SESSION_DIR"
