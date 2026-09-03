#!/usr/bin/env bash
set -euo pipefail

slug="${1:?slug is required}"
run_id="${2:?run id is required}"
run_attempt="${3:?run attempt is required}"
failed_takes="${4:?failed takes is required}"
reason="${5:?reason is required}"

[ "$run_attempt" -ge 3 ] || { echo '::error::لا تأجيل قبل ثلاث جولات كاملة'; exit 1; }
[ "$failed_takes" -ge 18 ] || { echo '::error::لا تأجيل قبل 18 Take مرفوض'; exit 1; }

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

for attempt in 1 2 3 4 5; do
  git fetch origin main
  worktree="$(mktemp -d)"
  rmdir "$worktree"
  git worktree add --detach "$worktree" origin/main >/dev/null
  status=0
  (
    cd "$worktree"
    node scripts/manage-kuwaiti-production-quality-holds.mjs defer \
      --slug="$slug" --run-id="$run_id" --run-attempt="$run_attempt" \
      --failed-rounds=3 --failed-takes="$failed_takes" --reason="$reason"
    git add scripts/data/kuwaiti-production-quality-holds-v1.json
    if git diff --cached --quiet; then exit 20; fi
    git commit -m "chore: defer exhausted Kuwaiti quality candidate"
    git push origin HEAD:main
  ) || status=$?
  git worktree remove --force "$worktree" >/dev/null 2>&1 || true
  if [ "$status" -eq 0 ] || [ "$status" -eq 20 ]; then
    echo "✓ سجل main تأجيل $slug؛ بقية الإنتاج غير محبوسة."
    exit 0
  fi
  echo "تقدم main أثناء تسجيل التأجيل (${attempt}/5) — نعيد فوق أحدث نسخة."
  sleep $((attempt * 3))
done

echo '::error::تعذر تثبيت تأجيل الجودة بعد خمس محاولات؛ لن تبدأ حلقة أخرى قبل حفظ القرار.'
exit 1
