# Monteur director upgrade

Reviewed from a fresh GitHub clone of `dde560bdd42f447e4e19a68d267706966e4fc50c`, not the pre-existing workspace.

## Delivered

- Admin-only Firestore `monteur_plans`: live subscription, AI markers, source hashes, transactional revisions and eight prior versions. No localStorage dependency.
- Topic generation retrieves the existing mixed library corpus (articles, book summaries and available interview/research/podcast content). The prompt restricts drafts to educational technology and related specialties, rejects unrelated topics, and labels generated text for review.
- 72 animated symbols, 18 environments, nine book covers and two generated conceptual images. Search uses Arabic normalization and topic keywords; it is not an embedding search engine.
- Scene-level symbol/photo selection, word editing with source-order/negation checks, locks, focus positions, opening choices and single-scene regeneration.
- Full-bleed photo layers, veils and camera movement in calm/bold styles. Personal portraits and interview thumbnails are excluded. Automatic OG lookup was intentionally removed following the owner's no-personal-photos instruction; unreviewed OG images might contain his portrait.
- Kufic logo is the visual signature. No repeated name in the outro.
- Export uses region capture where supported, fullscreen fallback, and the site's own audio graph. Existing external JS/CSS architecture is preserved because the actual reviewed revision already uses it; no other admin tools were changed.

## Narration investigation — not implemented

`POST /api/admin/audio/manage` accepts an article slug, reading/dialogue mode and clear/regenerate action. It dispatches `auto-audio-r2.yml` or a dialogue workflow. It does not accept a scene's text and return a clip URL and duration. The missing reusable contract is authenticated scene-text synthesis plus `{url, seconds}`, storage/availability and completion handling. No new provider or browser TTS was added. Music and effects remain available.

## Verification

All required commands passed (exit 0):

```text
npx tsc --noEmit
node scripts/guard-cloudrun-context.mjs  # 56 COPY sources, 42 server imports, 14 runtime resources
node scripts/guard-arabic-tanween.mjs   # policy passed
node scripts/guard-design-system.mjs   # identity guard passed
node scripts/guard-site-architecture.mjs # 15 checks
node scripts/test-all-user-notes.mjs   # 175 passed, 0 failed
npx vite build                        # success; existing chunk-size warning
node scripts/test-monteur-contract.mjs # source, numbers, order, negation, URL and 72-symbol assertions passed
```

Browser verification used the in-app Chromium browser, not headless Chromium. The adjacent PNG files capture three photo-backed chapters in both styles, plus opening/outro and an icon chapter. Real browser runtime checks passed for project round-trip, isolated mount/unmount, and scene locking. A real MediaRecorder with a mocked canvas capture stream produced 7079 bytes, reset the button and stopped its tracks. This checks recorder lifecycle, not native screen-picker/cropping behavior. Live authenticated Firestore persistence and provider-backed AI generation still require a signed-in integration check; they were not simulated as production successes.

## Generated visual assets

Mode: image generation using the built-in image tool; no reference portrait supplied.

- `covers/monteur-learning.png`: portrait conceptual editorial scene, ivory architectural classroom, school desk before a monumental circular brass doorway, blue daylight, tangible materials, no people or text.
- `covers/monteur-ethics.png`: portrait conceptual editorial scene, brass balance holding a blue circuit cube and folded-paper human symbol, warm ivory/brass/blue palette, no portrait or text.

These are conceptual illustrations rendered with photographic materials, not documentary photographs. Existing book cover assets remain the original source imagery.

## Visual vault expansion

- 72 meaning-matched specialist symbols now have 14 distinct compositions and motion signatures: 1,008 selectable icon treatments. Only 18 are mounted at once for performance.
- The engine assigns non-repeating icon compositions within a video, rejects a duplicate manual composition, and persists the chosen composition in the Firestore plan.
- Six editorial surfaces vary mini UI and infographic scenes. Consecutive chapters never use the same surface.
- Nineteen source images are available: ten conceptual images and nine book covers. Automatic and manual selection prevent the same image from appearing twice in one video.
- `visualRevision` changes the unpinned visual direction on a full regeneration while locked scenes retain their chosen assets.

Eight new project-bound images were generated with the built-in image tool in `photorealistic-natural` mode and stored as compressed WebP files: teacher/AI architectural portal, digital-parenting overhead still life, immersive classroom, media-literacy macro lens, inclusive-learning model, cinematic gamification path, learning-analytics glass landscape, and creative-classroom suspended still life. Every prompt required a vertical editorial composition, useful caption space, no people, no faces, no portraits, no readable text, no logo, and no watermark. The source PNGs remain in the image tool's generated-images directory; the site consumes the following workspace assets:

```text
covers/monteur-teacher-ai.webp
covers/monteur-digital-parenting.webp
covers/monteur-immersive-learning.webp
covers/monteur-media-literacy.webp
covers/monteur-inclusive-learning.webp
covers/monteur-gamification.webp
covers/monteur-learning-analytics.webp
covers/monteur-creative-classroom.webp
```

## Typography and composition review

Removed the television-program counter from the fallback credits. Arabic labels now use normal letter spacing, including entrance animations. Supporting headline lines remain at full foreground contrast during reveal. Repeated bottom progress and circular chapter indicators are hidden; the preview retains its top progress bar. Square exports use a dedicated symbol/text scale.

Browser layout audit of the default eleven-chapter storyboard across both styles and all three aspect ratios checked 66 combinations. It detected four square headline overflows before the fix and zero after. This is a sample-storyboard geometry check, not a claim that every possible article is visually perfect. `typography-polish.png` shows the revised Arabic composition.


## العائلات البصرية ومنع التكرار

- الرموز مرتبة في 10 عائلات متخصصة؛ تعرض كل عائلة رسومات مختلفة فعلياً، ثم يختار المونتير حركة غير متكررة تلقائياً.
- كل رمز يملك حركة داخلية مستمرة فوق حركته الدلالية الأصلية، بما في ذلك الرموز المركبة.
- يرفض المونتير تكرار الرمز أو المعالجة الحركية داخل الفيديو نفسه.
- يستخدم الفيديو حتى ست صور أصلية مختلفة، ولا يعد تغيير الفلتر صورة جديدة.
- لكل صورة حركة كاميرا مستقلة من 10 حركات، مع منع تكرار حركة الصورة داخل الفيديو.

## المخرج البصري السينمائي

- يقرأ معنى كل مشهد ويقرر وسيطه تلقائياً بين الرمز، الصورة المفاهيمية، غلاف الكتاب، واجهة تعليمية، البيانات، أو التكوين الطباعي.
- يبني رحلة من الغلاف إلى الاكتشاف ثم التحول والخاتمة، ويختار انتقالاً دلالياً من ثمانية أساليب وفق علاقة المشهد بما قبله.
- يوزع أربعة مقاييس للقطات ولا يسمح بمقياسين متشابهين متتاليين، ويوازن الوسائط والأسطح والحركات داخل الفيديو.
- يضيف لحظات توقيع نادرة للإنسان، المعرفة، البيانات، الفكرة، انقسام العالم، ومسار التعلّم. كل توقيع يظهر مرة واحدة ويخفض الموسيقى لحظة ظهوره.
- تحرك الرموز بلغات تناسب عائلاتها: نبض الشبكات والبحث، نمو التعليم والأسرة، توهج القيم، وعمق التلعيب والعوالم الغامرة.
- تحفظ اللوحة آخر أربعين بصمة بصرية في Firestore؛ زر «إخراج بصري جديد» يغير الصورة والحركة والسطح ومقياس اللقطة مع احترام المشاهد المثبتة.
- يفحص مدقق الإخراج طول الكلمات، وتكرار الصور والرموز وحركات الكاميرا، وتتابع الوسيط ومقياس اللقطة، ويعرض درجة جودة فورية.
- تبقى الكلمات المرئية في ست كلمات كحد أعلى، وتستمر القطوع والكلمة الأهم في الاستجابة لنبض الموسيقى.
