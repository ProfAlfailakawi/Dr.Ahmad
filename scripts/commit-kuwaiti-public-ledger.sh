#!/usr/bin/env bash
set -euo pipefail

# يثبّت فقط الدليل الخفيف على ما صار حيّاً في R2. ملفات MP3 وTranscript
# تبقى خارج Git، وتُنسخ اللقطة فوق أحدث main في worktree منفصل حتى لا يمحو
# سباقُ تشغيلةٍ أخرى سجل الصوت أو PROJECT-STATUS.
MANAGED=(
  src/data/audio-meta.json
  src/data/audio-peaks.json
  src/data/audio-versions.json
  src/data/listen-index.json
  src/data/spoken-index-kw.json
  src/data/radio-schedule-kw.json
  scripts/data/kuwaiti-production-quality-holds-v1.json
  PROJECT-STATUS.md
)

SNAPSHOT="$(mktemp -d)"
WORKTREE=""
cleanup_kuwaiti_ledger() {
  cd "$GITHUB_WORKSPACE"
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
  rm -rf "$SNAPSHOT"
}
trap cleanup_kuwaiti_ledger EXIT

for managed in "${MANAGED[@]}"; do
  if [ -f "$managed" ]; then
    mkdir -p "$SNAPSHOT/$(dirname "$managed")"
    cp -p "$managed" "$SNAPSHOT/$managed"
  fi
done

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
message="${KUWAITI_LEDGER_COMMIT_MESSAGE:-chore: publish verified Kuwaiti dialogue}"

for attempt in 1 2 3 4 5; do
  git fetch origin main
  WORKTREE="$(mktemp -d)"
  rmdir "$WORKTREE"
  git worktree add --detach "$WORKTREE" origin/main >/dev/null
  for managed in "${MANAGED[@]}"; do
    if [ -f "$SNAPSHOT/$managed" ]; then
      mkdir -p "$WORKTREE/$(dirname "$managed")"
      cp -p "$SNAPSHOT/$managed" "$WORKTREE/$managed"
    fi
  done
  status=0
  (
    cd "$WORKTREE"
    present=()
    for managed in "${MANAGED[@]}"; do [ -f "$managed" ] && present+=("$managed"); done
    [ "${#present[@]}" -gt 0 ] || exit 20
    git add -f -- "${present[@]}"
    git diff --cached --quiet && exit 20
    git commit -m "$message"
    git push origin HEAD:main
  ) || status=$?
  if [ "$status" -eq 0 ]; then
    echo "✓ ثُبّت سجل النسخة الكويتية فوق أحدث main."
    exit 0
  fi
  if [ "$status" -eq 20 ]; then
    echo "✓ سجل النسخة الكويتية مطابق؛ لا تغيير يحتاج التزاماً."
    exit 0
  fi
  git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  WORKTREE=""
  echo "تقدّم main أثناء التثبيت (${attempt}/5) — نعيد اللقطة بلا مسّ الصوت."
  sleep $((attempt * 4))
done

echo "::error::تعذّر تثبيت سجل R2 بعد خمس محاولات؛ الصوت نفسه بقي آمناً في Cloud."
exit 1
