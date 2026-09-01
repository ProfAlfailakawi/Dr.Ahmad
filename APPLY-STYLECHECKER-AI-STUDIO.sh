#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

SRC_ROOT="StyleChecker.tsx"
SRC_LIVE="src/components/admin/StyleChecker.tsx"
ADMIN="src/pages/Admin.tsx"
NAV="src/components/admin/admin-navigation.ts"

for f in "$SRC_ROOT" "$ADMIN" "$NAV"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f"
    exit 1
  fi
done

mkdir -p "$(dirname "$SRC_LIVE")"
cp "$SRC_ROOT" "$SRC_LIVE"

python3 - <<'PY'
from pathlib import Path
import re

style = Path("src/components/admin/StyleChecker.tsx")
admin = Path("src/pages/Admin.tsx")
nav = Path("src/components/admin/admin-navigation.ts")

s = style.read_text(encoding="utf-8")

# 1) Visual token guard — preserve the exact 45% opacity.
s = s.replace("text-soft/45", "text-soft/[.45]")

# 2) Project orthography rule — tanween fatha after alef: مشروعاً
s = re.sub("\u064bا", "ا\u064b", s)

# 3) Use the project's Arabic counter helper for dynamic numbers.
cms_import = "import type { ArticleRecord } from '../../lib/cms'"
count_import = "import { arabicCountPhrase, WORD_PLAIN_FORMS } from '../../lib/arabic-count.ts'"
if count_import not in s:
    if cms_import not in s:
        raise SystemExit("ERROR: StyleChecker CMS import anchor not found")
    s = s.replace(cms_import, cms_import + "\n" + count_import, 1)

# Robustly replace the swollen-paragraph reason, regardless of tanween spelling.
s = re.sub(
    r"reason:\s*`\$\{item\.words\} كلمة في فقرة واحدة؛ قسّمها عند انتقال الفكرة، والمعتاد ألا تتجاوز \$\{paragraphCeiling\} تقريب(?:ًا|اً)\.`",
    "reason: `${arabicCountPhrase(item.words, WORD_PLAIN_FORMS)} في فقرة واحدة؛ قسّمها عند انتقال الفكرة، والمعتاد ألا تتجاوز ${arabicCountPhrase(paragraphCeiling, WORD_PLAIN_FORMS)} تقريباً.`",
    s,
    count=1,
)

s = s.replace(
    "<span>{words.toLocaleString('ar-EG')} كلمة</span>",
    "<span>{arabicCountPhrase(words, WORD_PLAIN_FORMS, (value) => value.toLocaleString('ar-EG'))}</span>",
)

style.write_text(s, encoding="utf-8")

a = admin.read_text(encoding="utf-8")
lazy = "const StyleChecker = lazy(() => import('../components/admin/StyleChecker').then((module) => ({ default: module.StyleChecker })))"
anchor = "const PublishingStudio = lazy(() => import('../components/admin/PublishingStudio').then((module) => ({ default: module.PublishingStudio })))"
if lazy not in a:
    if anchor not in a:
        raise SystemExit("ERROR: Admin lazy import anchor not found")
    a = a.replace(anchor, anchor + "\n" + lazy, 1)

tab = "    'style-checker': <StyleChecker articles={cms.articles} />,"
tab_anchor = '    studio: <div className="grid gap-5"><PublishingStudio articles={cms.articles} onTransferToArticles={openTransferredArticle} /><AtlasEditorialSettings articles={cms.articles} /></div>,'
if tab not in a:
    if tab_anchor not in a:
        raise SystemExit("ERROR: Admin tabContent anchor not found")
    a = a.replace(tab_anchor, tab_anchor + "\n" + tab, 1)

admin.write_text(a, encoding="utf-8")

n = nav.read_text(encoding="utf-8")
if "| 'style-checker'" not in n:
    type_anchor = "| 'studio'"
    if type_anchor not in n:
        raise SystemExit("ERROR: navigation AdminTab anchor not found")
    n = n.replace(type_anchor, type_anchor + "\n  | 'style-checker'", 1)

menu = "{ tab: 'style-checker', label: 'فاحص الأسلوب', note: 'الصق المقال واعرف مواضع التعديل قبل النشر' },"
if menu not in n:
    # Insert next to the publishing studio item if possible.
    candidates = [
        "{ tab: 'studio',",
        "tab: 'studio'",
    ]
    inserted = False
    lines = n.splitlines()
    for i, line in enumerate(lines):
        if any(c in line for c in candidates):
            indent = line[:len(line)-len(line.lstrip())]
            lines.insert(i + 1, indent + menu)
            n = "\n".join(lines) + ("\n" if n.endswith("\n") else "")
            inserted = True
            break
    if not inserted:
        raise SystemExit("ERROR: navigation studio menu anchor not found")

nav.write_text(n, encoding="utf-8")

print("✓ StyleChecker integrated")
print("✓ Admin wiring present")
print("✓ Navigation entry present")
print("✓ Visual/Arabic guards fixed")
PY

echo
echo "Changed files:"
printf '%s\n' \
  "src/components/admin/StyleChecker.tsx" \
  "src/pages/Admin.tsx" \
  "src/components/admin/admin-navigation.ts"

echo
echo "No commit. No push. No WhatsApp changes. No Kuwaiti production changes."
