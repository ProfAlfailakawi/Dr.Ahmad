#!/usr/bin/env bash
set -euo pipefail

# Local-only recovery installer. It DOES NOT commit or push anything.
# Run this from the repository root based on db52193 (or a descendant you intentionally kept).

ROOT="$(pwd)"
BASE_SHA="db52193817930f69d18eb8523d0267e5c62f119e"

test -d .git || { echo "ERROR: run from the real git repository root"; exit 1; }

echo "== Kuwaiti recovery installer =="
echo "HEAD: $(git rev-parse --short HEAD)"
echo "No commit. No push."

# 1) StyleChecker: Google Studio placed the completed component at repository root.
# Copy the exact bytes into the path Admin.tsx already imports. Do not redesign it.
if [ -f "StyleChecker.tsx" ]; then
  mkdir -p src/components/admin
  if [ ! -f src/components/admin/StyleChecker.tsx ] || ! cmp -s StyleChecker.tsx src/components/admin/StyleChecker.tsx; then
    cp StyleChecker.tsx src/components/admin/StyleChecker.tsx
    echo "✓ StyleChecker copied verbatim into live admin path"
  else
    echo "✓ StyleChecker live path already matches the completed root copy"
  fi
else
  echo "ERROR: root StyleChecker.tsx is missing; refusing to invent/rebuild the UI."
  exit 1
fi

# 2) Full history is mandatory for certificate recovery.
if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
  echo "ERROR: repository is shallow. Fetch full history before running recovery."
  exit 1
fi

# 3) Patch workflow conservatively: add fetch-depth: 0 and the certified-state guard before selection.
python3 - <<'PY'
from pathlib import Path
p = Path(".github/workflows/podcast-kuwaiti-production-batch.yml")
s = p.read_text()

checkout_old = "      - uses: actions/checkout@v6\n\n      - uses: actions/setup-node@v6"
checkout_new = "      - uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n\n      - uses: actions/setup-node@v6"
if checkout_old in s:
    s = s.replace(checkout_old, checkout_new, 1)
elif "uses: actions/checkout@v6" in s and "fetch-depth: 0" not in s.split("uses: actions/checkout@v6", 1)[1][:160]:
    raise SystemExit("ERROR: checkout block changed; refusing a blind patch")

marker = "      - name: Select a deterministic batch from all 143 site articles\n"
guard = """      - name: Restore certified Kuwaiti state before any paid generation
        shell: bash
        env:
          AUDIO_PUBLIC_BASE_URL: ${{ vars.AUDIO_PUBLIC_BASE_URL }}
        run: |
          set -euo pipefail
          node scripts/repair-kuwaiti-production-state.mjs --apply --strict-r2

"""
if guard not in s:
    if marker not in s:
        raise SystemExit("ERROR: selection step not found; refusing a blind patch")
    s = s.replace(marker, guard + marker, 1)

p.write_text(s)
print("✓ workflow patched: full history + certified-state guard before selection")
PY

# 4) Preserve evidence of root ghost file so it can be deleted deliberately later.
cat > DELETE-FILES-KUWAITI-RECOVERY.txt <<'EOF'
# These are duplicate/root ghost files only if the live src equivalents are verified byte-for-byte.
# Do NOT delete automatically. Review after tests.
StyleChecker.tsx
EOF

echo
echo "Next safe commands (still no push):"
echo "  node scripts/repair-kuwaiti-production-state.mjs --self-test"
echo "  AUDIO_PUBLIC_BASE_URL='<your existing value>' node scripts/repair-kuwaiti-production-state.mjs --strict-r2"
echo "  # Review dry-run. Then:"
echo "  AUDIO_PUBLIC_BASE_URL='<your existing value>' node scripts/repair-kuwaiti-production-state.mjs --apply --strict-r2"
echo
echo "Installer finished. Nothing committed or pushed."
