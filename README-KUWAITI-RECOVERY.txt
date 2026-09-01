KUWAITI RECOVERY — db52193 continuation
===========================================

Purpose
-------
This bundle continues the exact recovery direction described before the cancelled account/session.
It does NOT roll the site back and does NOT contain the full project.

What it protects
----------------
1) StyleChecker:
   The completed StyleChecker was uploaded at repository root while Admin imports
   src/components/admin/StyleChecker. APPLY-LOCAL-FIXES.sh copies the completed file
   byte-for-byte into the live path. No visual redesign is performed.

2) Published Kuwaiti dialogue ledger:
   Git bot commits with the exact message:
     "chore: publish verified Kuwaiti dialogue"
   are treated as the publication certificate.

   R2 is NOT a quality certificate.
   R2 is used only to verify that the object still exists with the same byte count
   as the certified bot entry.

   If R2 differs from the bot certificate, the entry is quarantined and is not
   silently replaced or announced as published.

3) Quality holds:
   Holds erased by a stale human/Studio push are recovered from bot-owned history,
   unless a newer verified publication exists for that slug.

4) Workflow history:
   The production workflow is changed to checkout full git history (fetch-depth: 0)
   because the historical certificate guard cannot work in a shallow clone.

5) No paid generation first:
   State recovery runs before episode selection, so previously completed or exhausted
   episodes cannot be selected merely because an old ledger erased them.

Files in this ZIP
-----------------
APPLY-LOCAL-FIXES.sh
scripts/repair-kuwaiti-production-state.mjs
patches/podcast-kuwaiti-production-batch.patch
README-KUWAITI-RECOVERY.txt

Important
---------
- No GitHub write was performed while producing this bundle.
- No commit and no push are performed by APPLY-LOCAL-FIXES.sh.
- The repair script defaults to DRY RUN.
- --apply writes only:
    src/data/audio-meta.json
    scripts/data/kuwaiti-production-quality-holds-v1.json
    reports/kuwaiti-ledger-quarantine.json
  and only after certificate/R2 checks.
- Do not resume e-learning-culture-2 until the recovery dry-run is clean.
