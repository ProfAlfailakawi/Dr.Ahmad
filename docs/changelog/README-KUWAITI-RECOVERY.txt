KUWAITI PRODUCTION RECOVERY — 299d8f5+
======================================

The protection is now part of the real production workflow; this is not an
unapplied patch bundle.

Before any paid TTS request, the workflow:

1. checks out full Git history;
2. restores only entries certified by GitHub Actions and still present on R2;
3. quarantines a Kuwaiti MP3/JSON pair if R2 differs from its certificate;
4. restores quality holds erased by a stale Google Studio upload;
5. selects exactly one genuinely missing, non-held episode.

Manual local recovery (optional):

  AUDIO_PUBLIC_BASE_URL='https://…r2.dev' bash APPLY-LOCAL-FIXES.sh

AI Studio may run `bash APPLY-LOCAL-FIXES.sh` without the URL: it will remove
the two root shadows and run the offline self-tests, while keeping the repaired
ledger files already included in this ZIP.

This command never commits or pushes. The doctor still uploads the reviewed
ZIP through AI Studio.

Repository cleanup included in the reviewed ZIP:

- delete root Admin.tsx (the live file is src/pages/Admin.tsx)
- delete root admin-navigation.ts (the live file is
  src/components/admin/admin-navigation.ts)

scripts/clean-obsolete-root-files.mjs enforces the same rule before every build,
so a future Studio upload cannot make the root shadows authoritative again.
