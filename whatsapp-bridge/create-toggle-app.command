#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================================"
echo "    Compiling Native Silent macOS Application         "
echo "======================================================"

# Make sure toggle-bridge.sh exists and is executable
chmod +x "$DIR/toggle-bridge.sh"

OS_APP_NAME="WhatsApp Bridge Toggle.app"
PARENT_DIR="$(dirname "$DIR")"

echo "[i] Compiling AppleScript app..."
# We compile an AppleScript that calls the toggle-bridge.sh script in the background silently
osacompile -o "$DIR/$OS_APP_NAME" -e "do shell script \"bash '$DIR/toggle-bridge.sh'\""
osacompile -o "$PARENT_DIR/$OS_APP_NAME" -e "do shell script \"bash '$DIR/toggle-bridge.sh'\""

# Let's make sure they are executable and ready
chmod -R +x "$DIR/$OS_APP_NAME" || true
chmod -R +x "$PARENT_DIR/$OS_APP_NAME" || true

echo ""
echo "[✓] Native macOS Application created successfully!"
echo "[✓] App 1: $PARENT_DIR/$OS_APP_NAME"
echo "[✓] App 2: $DIR/$OS_APP_NAME"
echo "======================================================"
echo "يمكنك الآن سحب التطبيق إلى الـ Applications أو الـ Dock"
echo "لتشغيله وإيقافه بضغطة زر واحدة دون فتح نافذة التيرمنال!"
echo "======================================================"
