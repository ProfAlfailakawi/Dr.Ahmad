#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

PLIST_NAME="com.dr-alfailakawi.whatsapp-bridge.plist"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "======================================================"
echo "    Installing WhatsApp Bridge Auto-Start Service     "
echo "======================================================"

NODE_PATH="$(which node || echo "/usr/local/bin/node")"

mkdir -p "$HOME/Library/LaunchAgents"

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.dr-alfailakawi.whatsapp-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_PATH</string>
    <string>$DIR/service-runner.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$DIR/bridge.out.log</string>
  <key>StandardErrorPath</key>
  <string>$DIR/bridge.err.log</string>
</dict>
</plist>
EOF

chmod 644 "$PLIST_PATH"

launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"

echo "[✓] WhatsApp Bridge Auto-Start Service installed successfully!"
echo "[✓] Plist created at: $PLIST_PATH"
