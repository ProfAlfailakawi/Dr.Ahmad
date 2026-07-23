#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
rm -f \
  App.tsx \
  ArticleDetail.tsx \
  PaperDetail.tsx \
  IdeaFeatures.tsx \
  bun.lock \
  public/sitemap.xml
printf '\nتم حذف النسخ الجذرية القديمة فقط. النسخ الفعلية داخل src/ بقيت كما هي.\n'
printf 'يمكن الآن رفع التغييرات إلى GitHub.\n\n'
rm -f "$0"
