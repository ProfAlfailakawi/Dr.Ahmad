STYLE CHECKER BUILD FIX

Run from the website project root:
  bash APPLY-STYLE-CHECKER-BUILD-FIX.sh

This fix ONLY:
- copies the existing completed root StyleChecker.tsx into src/components/admin/StyleChecker.tsx if missing
- adds the lazy import in src/pages/Admin.tsx
- adds the style-checker render entry to tabContent
- optionally adds the dev preview route
- runs npm run build

It does not touch WhatsApp, audio generation, or any unrelated feature.
