Dr. Ahmad — Million-Scale Knowledge Glossary + Cloud Run Build Fix
Date: 2026-07-26

This archive contains modified files only. Extract it over the project root.

Critical Cloud Run repair
- Removed the new runtime dependency on copying the personal glossary JSON into the Cloud Run image.
- The server now receives the resolved glossary profile from the frontend request and safely builds a server-side profile.
- Missing local glossary JSON no longer breaks or warns during Cloud Run startup.
- Dockerfile validates server.mjs during image build.

Knowledge engine
- 290 curated base concepts grounded in Dr. Ahmad's fields, books, research, projects, methods, platforms and professional work.
- 59 semantic facets across audience, context, action, outcome and method.
- Compositional capacity: 94,883,360 distinct domain concept combinations.
- Arabic morphology, spelling variants, English aliases, abbreviations, acronyms, transliterations and first-word recognition.
- Compound understanding: a prompt can combine concept + audience + context + goal + method.
- The engine distinguishes near terms such as gamification vs manipulation, AR vs VR, assessment meanings, and domain abbreviations.

Visual diversity
- Bright and diverse worlds added: sunlit campus, living learning lab, kinetic collage, spatial learning, optimistic data and material future.
- Positive educational concepts no longer default to dark or sad scenes.
- Dark corridors, empty depressing classrooms and repeated visual themes are explicitly blocked unless the topic itself requires a serious mood.
- Repeated generations rotate through distinct worlds, palettes, lighting and composition directions.

Content protection
- No article, book, research paper, CV, original title or user-authored text is included or modified.

Verification completed
- server.mjs syntax check passed.
- Glossary self-test passed: 290 entries, first-word cases, synthetic Cloud Run profile, positive-mood guard and distinct visual worlds.
- Studio image generation self-test passed: JSON, data URI, binary, PNG and empty-payload recovery.
- Standalone strict TypeScript check passed for the glossary, visual search and creative director modules.
- Cloud Run-equivalent source-layout startup test passed and the studio-image health endpoint returned HTTP 200.

Files in this patch
- Dockerfile
- server.mjs
- src/data/dr-ahmad-domain-glossary.json
- src/lib/dr-ahmad-domain-glossary.ts
- src/lib/external-visual-sources.ts
- src/lib/creative-director.ts
- src/components/admin/SocialDesignStudio.tsx
- scripts/test-dr-ahmad-domain-glossary.mjs
- README-GLOSSARY-CLOUDRUN-FIX.txt
