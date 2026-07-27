#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Read .env without destroying quoted values or paths containing spaces.
if [ -f "$DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$DIR/.env"
  set +a
fi

export WHATSAPP_MAIN_SERVER_URL="${WHATSAPP_MAIN_SERVER_URL:-https://dr-alfailakawi.com}"
export WHATSAPP_BRIDGE_SECRET="${WHATSAPP_BRIDGE_SECRET:-REDACTED}"
export WHATSAPP_BRIDGE_DEVICE_ID="${WHATSAPP_BRIDGE_DEVICE_ID:-primary}"

# Keep LocalAuth outside the downloaded project. Replacing, renaming or moving
# the bridge folder must never create a second WhatsApp device or lose pairing.
DEFAULT_SESSION_DIR="$HOME/Library/Application Support/Dr Ahmad WhatsApp Bridge/session"
LEGACY_SESSION_DIR="$DIR/session"
export WHATSAPP_SESSION_DIR="${WHATSAPP_SESSION_DIR:-$DEFAULT_SESSION_DIR}"

mkdir -p "$WHATSAPP_SESSION_DIR"
chmod 700 "$WHATSAPP_SESSION_DIR" 2>/dev/null || true

TARGET_PROFILE="$WHATSAPP_SESSION_DIR/session-$WHATSAPP_BRIDGE_DEVICE_ID"
LEGACY_PROFILE="$LEGACY_SESSION_DIR/session-$WHATSAPP_BRIDGE_DEVICE_ID"

PID_FILE="$WHATSAPP_SESSION_DIR/bridge-$WHATSAPP_BRIDGE_DEVICE_ID.pid"
LEGACY_PID_FILE="$LEGACY_SESSION_DIR/bridge-$WHATSAPP_BRIDGE_DEVICE_ID.pid"

running_pid=""
for candidate in "$PID_FILE" "$LEGACY_PID_FILE"; do
  [ -f "$candidate" ] || continue
  pid="$(tr -cd '0-9' < "$candidate")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    running_pid="$pid"
    break
  fi
  rm -f "$candidate"
done

if [ -n "$running_pid" ]; then
  echo "Stopping bridge with PID $running_pid..."
  kill "$running_pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8; do
    kill -0 "$running_pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$running_pid" 2>/dev/null; then
    kill -9 "$running_pid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" "$LEGACY_PID_FILE"
  osascript -e 'display notification "تم إيقاف تشغيل جسر واتساب بنجاح." with title "WhatsApp Bridge" sound name "Subtle"' 2>/dev/null || true
  echo "Stopped."
  exit 0
fi

# One-time safe migration from the old folder-local session. It runs only
# after confirming that no Chrome/bridge process is using that profile.
if [ "$WHATSAPP_SESSION_DIR" != "$LEGACY_SESSION_DIR" ] \
  && [ ! -e "$TARGET_PROFILE" ] \
  && [ -d "$LEGACY_PROFILE" ]; then
  echo "Migrating the saved WhatsApp session to its permanent macOS location..."
  if command -v ditto >/dev/null 2>&1; then
    ditto "$LEGACY_PROFILE" "$TARGET_PROFILE"
  else
    cp -R "$LEGACY_PROFILE" "$TARGET_PROFILE"
  fi
  chmod -R go-rwx "$TARGET_PROFILE" 2>/dev/null || true
fi

NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then
  osascript -e 'display alert "WhatsApp Bridge" message "لم يتم العثور على Node.js. ثبّت Node.js ثم أعد المحاولة." as critical' 2>/dev/null || true
  echo "Node.js was not found in PATH." >&2
  exit 1
fi

if ! command -v caffeinate >/dev/null 2>&1; then
  echo "macOS caffeinate command was not found." >&2
  exit 1
fi

STDOUT_LOG="$WHATSAPP_SESSION_DIR/bridge.stdout.log"
STDERR_LOG="$WHATSAPP_SESSION_DIR/bridge.stderr.log"

echo "Starting bridge with permanent session storage..."
nohup caffeinate -ims "$NODE_PATH" "$DIR/service-runner.mjs" > "$STDOUT_LOG" 2> "$STDERR_LOG" < /dev/null &
launcher_pid=$!

# Fail visibly if the launcher dies immediately instead of showing a false
# success notification.
sleep 2
if ! kill -0 "$launcher_pid" 2>/dev/null && [ ! -f "$PID_FILE" ]; then
  osascript -e 'display alert "WhatsApp Bridge" message "تعذّر تشغيل الجسر. راجع bridge.stderr.log داخل مجلد الجلسة." as critical' 2>/dev/null || true
  echo "Bridge failed to start. See: $STDERR_LOG" >&2
  exit 1
fi

osascript -e 'display notification "تم تشغيل جسر واتساب في الخلفية والجلسة محفوظة دائمًا." with title "WhatsApp Bridge" sound name "Glass"' 2>/dev/null || true
echo "Started."
echo "Session: $WHATSAPP_SESSION_DIR"
