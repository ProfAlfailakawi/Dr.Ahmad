#!/usr/bin/env bash
set -euo pipefail

# مدخل يدوي اختياري للاستعادة المحلية. لا يعدّل كوداً، ولا ينشئ commit،
# ولا يدفع إلى GitHub. الـworkflow نفسه يحمل الحماية قبل أي توليد مدفوع.
test -e .git || { echo 'ERROR: run from the repository root'; exit 1; }

node scripts/clean-obsolete-root-files.mjs
node scripts/repair-kuwaiti-production-state.mjs --self-test
if [ -z "${AUDIO_PUBLIC_BASE_URL:-}" ]; then
  echo '✓ Code cleanup and self-tests passed; packaged ledgers stay unchanged (no R2 URL in this environment).'
  echo '✓ No commit. No push.'
  exit 0
fi
node scripts/repair-kuwaiti-production-state.mjs --apply

echo '✓ Local ledgers repaired. No commit. No push.'
