# Design QA — Visitor discovery surfaces

Date: 2026-08-14

## Scope

- Visitor-facing pages only: Curated, Articles, Media, Publications, and Thought Paths.
- No admin/control-panel surface was changed.
- Visual reference: Inspora grid/detail captures in `audit/inspora-2026-08-13/`, compared side-by-side with the local implementation.

## Viewports checked

- Desktop: 1280 × 900.
- Mobile: 390 × 844.

## Fidelity and layout

- Existing palette, radius scale, borders, spacing language, and page hierarchy were preserved.
- New headings use the existing El Messiri display family; body text and controls use the existing Tajawal family.
- Curated scene cards are equal: 369 × 304 px on desktop and 342 × 272 px on mobile in the tested states.
- Articles scene cards are equal in the tested mobile state: 342 × 256 px.
- Thought Path entrances form a complete 3 × 2 desktop grid and retain the compact horizontal mobile selector.
- Book and media previews use real existing cover/thumbnail assets; no media autoplays.

## Interaction and accessibility

- Sort, category, year, kind, view, and selected-item state persist in URL query parameters.
- Context viewers support Escape, focus containment/restoration, backdrop close, and keyboard previous/next navigation.
- Dialogs expose semantic labels; controls retain visible focus states and practical tap targets.
- Mobile implementation has no document-level horizontal overflow at 390 px.
- Curated textual previews remove the duplicated visual title on mobile.
- Browser console check returned no errors or warnings across the tested routes.

## Verification

- `npm run lint`: passed.
- `npm run site-polish:self-test`: passed.
- `npx vite build --outDir /tmp/dr-alfailakawi-visitor-build-final`: passed.
- The repository-wide critical bridge guard could not start because the supplied workspace has no `Dockerfile`; this predates and is unrelated to the visitor changes.

final result: passed
