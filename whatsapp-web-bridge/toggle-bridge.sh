#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Load env variables
if [ -f .env ]; then
  # Load env variables safely without crashing on comments or empty lines
  export $(grep -v '^#' .env | xargs)
fi

export WHATSAPP_MAIN_SERVER_URL="${WHATSAPP_MAIN_SERVER_URL:-https://dr-alfailakawi.com}"
if [ -z "${WHATSAPP_BRIDGE_SECRET:-}" ] || [ "${#WHATSAPP_BRIDGE_SECRET}" -lt 24 ]; then
  echo "WHATSAPP_BRIDGE_SECRET is required in whatsapp-web-bridge/.env (at least 24 characters)." >&2
  exit 1
fi
export WHATSAPP_BRIDGE_SECRET
export WHATSAPP_BRIDGE_DEVICE_ID="${WHATSAPP_BRIDGE_DEVICE_ID:-primary}"
export WHATSAPP_SESSION_DIR="${WHATSAPP_SESSION_DIR:-$DIR/session}"

PID_FILE="$WHATSAPP_SESSION_DIR/bridge-$WHATSAPP_BRIDGE_DEVICE_ID.pid"

NODE_PATH="$(which node || echo "/usr/local/bin/node")"

# Check if PID file exists and process is running
RUNNING=false
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" | tr -d '[:space:]')
  if [ -n "$PID" ] && ps -p "$PID" > /dev/null 2>&1; then
    RUNNING=true
  fi
fi

if [ "$RUNNING" = true ]; then
  echo "Stopping bridge with PID $PID..."
  kill "$PID" || true
  # Wait up to 5 seconds for it to stop
  for i in {1..5}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  rm -f "$PID_FILE"
  
  # Trigger beautiful macOS notification
  osascript -e 'display notification "تم إيقاف تشغيل الواتساب بريدج بنجاح." with title "WhatsApp Bridge" sound name "Subtle"'
  echo "Stopped."
else
  echo "Starting bridge..."
  mkdir -p "$WHATSAPP_SESSION_DIR"
  caffeinate -ims "$NODE_PATH" service-runner.mjs > "$WHATSAPP_SESSION_DIR/bridge.stdout.log" 2> "$WHATSAPP_SESSION_DIR/bridge.stderr.log" &
  
  # Trigger beautiful macOS notification
  osascript -e 'display notification "تم تشغيل الواتساب بريدج في الخلفية بنجاح!" with title "WhatsApp Bridge" sound name "Glass"'
  echo "Started."
fi
