#!/bin/bash
# Usage: scripts/set-encyclopedia-cover.sh <image>
#
# Makes <image> the encyclopedia cover on /publications, the book page and the home shelf.
# Called by the cover watcher (~/LivingBuild/auto-cover.sh) with the newest cover dropped into
# its covers folder (cover, cover1, cover2 ... the highest number is the newest), so the site
# cover follows the same folder that feeds /living.
#
# The files are named after the image's hash (covers/encyclopedia-<hash>.webp plus the 480w and
# 768w steps that coverSrcSet() expects). /covers/** is cached for a week, so a new name is what
# makes every visitor and both app shells see the new cover at once instead of the old one.
# Needs cwebp (brew install webp).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="${1:-}"
[ -f "$SRC" ] || { echo "set-encyclopedia-cover: image not found: $SRC" >&2; exit 1; }
command -v cwebp >/dev/null || { echo "set-encyclopedia-cover: cwebp is missing (brew install webp)" >&2; exit 1; }

DATA=src/data.ts
MONTEUR=public/monteur/monteur.js
OLD="$(grep -oE "cover: '/covers/encyclopedia[^']*\.webp'" "$DATA" | head -1 | sed -E "s/cover: '(.*)'/\1/")"
[ -n "$OLD" ] || { echo "set-encyclopedia-cover: encyclopedia cover line not found in $DATA" >&2; exit 1; }

HASH="$(shasum "$SRC" | cut -c1-10)"
BASE="covers/encyclopedia-$HASH"
NEW="/$BASE.webp"
if [ "$OLD" = "$NEW" ] && [ -f "$BASE.webp" ]; then echo "encyclopedia cover unchanged ($NEW)"; exit 0; fi

cwebp -quiet -metadata none -q 84 -resize 1024 0 "$SRC" -o "$BASE.webp"
cwebp -quiet -metadata none -q 82 -resize 768 0 "$SRC" -o "$BASE-768w.webp"
cwebp -quiet -metadata none -q 82 -resize 480 0 "$SRC" -o "$BASE-480w.webp"

# Only earlier generated editions are removed; the original encyclopedia.webp/png stay untouched.
if [[ "$OLD" =~ ^/covers/encyclopedia-[0-9a-f]{10}\.webp$ ]] && [ "$OLD" != "$NEW" ]; then
  O="${OLD#/}"; rm -f "$O" "${O%.webp}-768w.webp" "${O%.webp}-480w.webp"
fi

sed -i.bak -E "s#cover: '/covers/encyclopedia[^']*\.webp'#cover: '$NEW'#" "$DATA" && rm -f "$DATA.bak"
if [ -f "$MONTEUR" ]; then
  sed -i.bak -E "s#\"encyclopedia\":\"/covers/encyclopedia[^\"]*-480w\.webp\"#\"encyclopedia\":\"/$BASE-480w.webp\"#" "$MONTEUR" && rm -f "$MONTEUR.bak"
fi
grep -q "cover: '$NEW'" "$DATA" || { echo "set-encyclopedia-cover: failed to update $DATA" >&2; exit 1; }
echo "encyclopedia cover: $OLD -> $NEW"
