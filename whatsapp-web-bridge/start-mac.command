#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================================"
echo "    Dr. Ahmad WhatsApp Web Bridge Launcher (macOS)    "
echo "======================================================"

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

export WHATSAPP_MAIN_SERVER_URL="${WHATSAPP_MAIN_SERVER_URL:-https://dr-alfailakawi.com}"
export WHATSAPP_BRIDGE_SECRET="${WHATSAPP_BRIDGE_SECRET:-dr_alfailakawi_whatsapp_bridge_secret_key_2026_super_secure}"
export WHATSAPP_BRIDGE_DEVICE_ID="${WHATSAPP_BRIDGE_DEVICE_ID:-primary}"
export WHATSAPP_SESSION_DIR="${WHATSAPP_SESSION_DIR:-$DIR/session}"

mkdir -p "$WHATSAPP_SESSION_DIR"

echo "[i] Server URL: $WHATSAPP_MAIN_SERVER_URL"
echo "[i] Device ID: $WHATSAPP_BRIDGE_DEVICE_ID"
echo "[i] Session Dir: $WHATSAPP_SESSION_DIR"

caffeinate -ims node service-runner.mjs
