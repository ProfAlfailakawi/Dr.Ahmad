#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
ADMIN="src/pages/Admin.tsx"
TARGET="src/components/admin/StyleChecker.tsx"
SOURCE="StyleChecker.tsx"

if [ ! -f "$ADMIN" ]; then
  echo "ERROR: $ADMIN not found. Run this from the website project root."
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  if [ -f "$SOURCE" ]; then
    mkdir -p "$(dirname "$TARGET")"
    cp "$SOURCE" "$TARGET"
    echo "✓ copied completed StyleChecker to live source path"
  else
    echo "ERROR: neither $TARGET nor root $SOURCE exists"
    exit 1
  fi
else
  echo "✓ live StyleChecker already exists"
fi

python3 - <<'PY'
from pathlib import Path

p = Path("src/pages/Admin.tsx")
s = p.read_text(encoding="utf-8")

lazy_line = "const StyleChecker = lazy(() => import('../components/admin/StyleChecker').then((module) => ({ default: module.StyleChecker })))"
anchor = "const PublishingStudio = lazy(() => import('../components/admin/PublishingStudio').then((module) => ({ default: module.PublishingStudio })))"
if lazy_line not in s:
    if anchor not in s:
        raise SystemExit("ERROR: PublishingStudio lazy-import anchor not found; refusing blind edit.")
    s = s.replace(anchor, anchor + "\n" + lazy_line, 1)
    print("✓ added StyleChecker lazy import")
else:
    print("✓ StyleChecker lazy import already present")

preview_line = "  if (creativePreview === 'style-checker') return <Page><div className=\"mx-auto w-full max-w-[1500px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32\"><StyleChecker articles={[]} /></div></Page>"
preview_anchor = "  if (creativePreview === 'publishing') return <Page><div className=\"mx-auto w-full max-w-[1500px] px-4 pb-24 pt-28 sm:px-6 md:px-10 md:pt-32\"><PublishingStudio articles={[]} /></div></Page>"
if preview_line not in s and preview_anchor in s:
    s = s.replace(preview_anchor, preview_anchor + "\n" + preview_line, 1)
    print("✓ added StyleChecker dev preview route")

tab_line = "    'style-checker': <StyleChecker articles={cms.articles} />,"
tab_anchor = "    studio: <div className=\"grid gap-5\"><PublishingStudio articles={cms.articles} onTransferToArticles={openTransferredArticle} /><AtlasEditorialSettings articles={cms.articles} /></div>,"
if tab_line not in s:
    if tab_anchor not in s:
        raise SystemExit("ERROR: tabContent studio anchor not found; refusing blind edit.")
    s = s.replace(tab_anchor, tab_anchor + "\n" + tab_line, 1)
    print("✓ registered style-checker in tabContent")
else:
    print("✓ style-checker tabContent already present")

p.write_text(s, encoding="utf-8")
PY

echo
echo "Checking wiring..."
grep -n "StyleChecker" "$ADMIN"
grep -n "style-checker" src/components/admin/admin-navigation.ts || true

echo
echo "Running TypeScript/build validation..."
npm run build

echo
echo "✓ StyleChecker wiring/build fix completed successfully."
