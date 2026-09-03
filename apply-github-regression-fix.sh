#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "ERROR: شغّل هذا الملف من داخل نسخة Git لمشروع Dr.Ahmad."
  exit 1
fi
cd "$ROOT"

BASE="6265d52907d00788a8c199d3b69219c71a1d5c1e"

echo "[1/8] التحقق من النسخة المرجعية قبل جولة الـpolish..."
for file in \
  src/components/ArticleReader.tsx \
  src/pages/ArticleDetail.tsx \
  src/index.css
do
  if ! git cat-file -e "${BASE}:${file}" 2>/dev/null; then
    echo "ERROR: لا أجد ${BASE}:${file}. نفّذ git fetch --all أولاً ثم أعد المحاولة."
    exit 1
  fi
done

echo "[2/8] استعادة طبقات القراءة/التحديد والطباعة التي سُحقت بملفات أقدم..."
git show "${BASE}:src/components/ArticleReader.tsx" > src/components/ArticleReader.tsx
git show "${BASE}:src/pages/ArticleDetail.tsx" > src/pages/ArticleDetail.tsx
git show "${BASE}:src/index.css" > src/index.css

echo "[3/8] تنظيف عداد مجموعات القائمة فقط، مع إبقاء IA الجديدة..."
python3 - <<'PY'
from pathlib import Path

ui = Path("src/components/ui.tsx")
s = ui.read_text(encoding="utf-8")
needle = """                <span className="ms-2 font-sans text-[.62rem] font-normal text-soft" aria-hidden="true">{g.items.length.toLocaleString('ar-KW')}</span>
"""
if needle in s:
    s = s.replace(needle, "", 1)
else:
    # صيغة احتياطية إن تغيّر الـindent فقط
    s = s.replace(
        """<span className="ms-2 font-sans text-[.62rem] font-normal text-soft" aria-hidden="true">{g.items.length.toLocaleString('ar-KW')}</span>""",
        "",
        1,
    )
ui.write_text(s, encoding="utf-8")

main = Path("src/main.tsx")
s = main.read_text(encoding="utf-8")
if "import './polish-2026-overrides.css'" not in s:
    s = s.replace("import './index.css'", "import './index.css'\nimport './polish-2026-overrides.css'", 1)
main.write_text(s, encoding="utf-8")

# اختبار الـpolish الإضافي يجب أن يقرأ طبقة الـoverride أيضاً لأنها CSS حقيقية محمّلة بعد index.css.
test = Path("scripts/test-site-polish-2026.mjs")
if test.exists():
    s = test.read_text(encoding="utf-8")
    s = s.replace(
        "read('src/index.css')",
        "(read('src/index.css') + '\\n' + read('src/polish-2026-overrides.css'))"
    )
    s = s.replace(
        "articleDetail.includes('articleSignalOf(slug, body, popularQuotes)')",
        "articleDetail.includes('articleSignalsOf(slug, body, popularQuotes)')"
    )
    test.write_text(s, encoding="utf-8")
PY

echo "[4/8] إعادة طبقة الـpolish الجديدة فوق المصدر الصحيح، بلا سحق للميزات القديمة..."
cat > src/polish-2026-overrides.css <<'CSS'
/*
  2026-08-09 — طبقة polish محدودة.
  الغرض: إبقاء تحسينات الجولة الأخيرة فوق طبقات القراءة/التحديد والطباعة الأصلية،
  بدلاً من استبدال index.css كاملاً بملف أقدم.
*/

/* Hero: يبهر أولاً ثم يهدأ تدريجياً بعد is-settled التي يفعّلها HumanCoreHero بعد 4 ثوانٍ. */
.human-core__scan,
.human-core__signal > i,
.human-core__bridge-pulse,
.human-core__words span {
  transition: opacity 1.55s var(--E), stroke-opacity 1.55s var(--E), filter 1.55s var(--E);
}
.human-core.is-settled .human-core__scan {
  opacity: calc(var(--human-scan) * .28);
  animation-duration: 17s;
}
.human-core.is-settled .human-core__signal > i {
  opacity: .42;
  animation-duration: 7.8s;
}
.human-core.is-settled .human-core__bridge-pulse {
  stroke-opacity: .34;
  animation-duration: 11s;
}
.human-core.is-settled .human-core__orbit {
  opacity: .62;
  animation-duration: 42s;
}
.human-core.is-settled .human-core__words span {
  opacity: .62;
  animation-duration: 18s;
}

/* خط التوقيع: مرة واحدة عند دخول القسم، لا loop دوري. */
.signature-label > span:first-child::after {
  animation: none !important;
}
.signature-label.is-visible > span:first-child::after {
  animation: signature-line-pass-once .72s var(--E) .06s both !important;
}
@keyframes signature-line-pass-once {
  0% { transform: translateX(140%); opacity: 0; }
  24% { opacity: .7; }
  100% { transform: translateX(-140%); opacity: 0; }
}

/* شريط أفقي: إشارة حافة هادئة تعرّف المستخدم بوجود محتوى يمين/يسار. */
:root { --rail-fade: 40px; }
:is(
  .rail,
  .signatures-rail,
  .article-featured-rail,
  .research-smart-reader-rail,
  .media-related-rail,
  .ask-book-rail,
  .book-spine-rail,
  .home-motion-rail,
  [data-horizontal-video-rail="true"],
  .edge-fade
) {
  -webkit-mask-image: linear-gradient(to left, #000 calc(100% - var(--rail-fade)), transparent 100%);
  mask-image: linear-gradient(to left, #000 calc(100% - var(--rail-fade)), transparent 100%);
}
:is(
  .rail,
  .signatures-rail,
  .article-featured-rail,
  .research-smart-reader-rail,
  .media-related-rail,
  .ask-book-rail,
  .book-spine-rail,
  .home-motion-rail,
  [data-horizontal-video-rail="true"],
  .edge-fade
):dir(ltr) {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - var(--rail-fade)), transparent 100%);
  mask-image: linear-gradient(to right, #000 calc(100% - var(--rail-fade)), transparent 100%);
}

/* AdaptiveSilence: لا تستمر حركات الظهور بعد الدخول في القراءة الهادئة. */
html.site-silent .site-fade-up {
  opacity: 1 !important;
  transform: none !important;
  transition: none !important;
}

/* البحث العلمي المفرد: Evidence Thread واحد، بلا glow أو loop. */
.research-evidence-thread-wrap {
  position: relative;
  padding-inline-start: 1.35rem;
}
.research-evidence-thread-line {
  position: absolute;
  z-index: 0;
  inset-inline-start: .34rem;
  inset-block: 1.7rem;
  inline-size: 1px;
  transform-origin: top;
  background: linear-gradient(180deg, rgb(var(--c-accent) / .72), rgb(var(--c-accent) / .16));
  pointer-events: none;
}
.research-evidence-thread-wrap > .site-fade-up {
  position: relative;
  z-index: 1;
}
.research-evidence-thread-node {
  position: absolute;
  z-index: 2;
  inset-inline-start: -1.26rem;
  inset-block-start: 1.55rem;
  inline-size: .56rem;
  block-size: .56rem;
  border: 2px solid rgb(var(--c-canvas));
  border-radius: 999px;
  background: rgb(var(--c-accent));
  box-shadow: 0 0 0 1px rgb(var(--c-accent) / .32);
  pointer-events: none;
}

/* iPhone/Safari: 16px فعلي داخل كل أدوات الإدخال يمنع zoom التلقائي. */
@media (max-width: 767px) {
  input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]),
  textarea,
  select {
    font-size: 16px !important;
  }

  /* الإعلام على الهاتف: المحتوى يصل مبكراً، والبحث يبقى أداة لا بطلاً للصفحة. */
  .content-media .page-head {
    padding-top: 6.6rem;
    padding-bottom: 1.8rem;
  }
  .content-media .page-head .signature-label { margin-bottom: .7rem; }
  .content-media .page-head h1 {
    font-size: clamp(2rem, 10vw, 2.8rem);
    line-height: 1.22;
    max-inline-size: 20rem;
  }
  .content-media .media-archive-body { padding-top: 1rem; }
  .content-media .media-search-shell {
    background: rgb(var(--c-canvas) / .82);
    box-shadow: none;
  }
  .content-media .media-search-note {
    margin-top: .45rem;
    font-size: .66rem;
    line-height: 1.6;
  }
  .content-media .media-archive-grid { margin-top: 1.35rem; }
}
CSS

echo "[5/8] فحص الحراس المباشرين..."
node scripts/guard-cloudrun-context.mjs
node scripts/guard-critical-bridges.mjs
node scripts/guard-visual-tokens.mjs
node scripts/guard-site-architecture.mjs
node scripts/guard-arabic-tanween.mjs
node scripts/guard-arabic-typography.mjs

echo "[6/8] فحص جميع ملاحظات الموقع..."
node scripts/test-all-user-notes.mjs

echo "[7/8] فحص جولة الـpolish نفسها..."
node scripts/test-site-polish-2026.mjs

echo "[8/8] فحص TypeScript..."
npx tsc --noEmit

echo
echo "SUCCESS: إصلاح regressions اكتمل. راجع git diff ثم commit/push."
echo "الملفات التي ينبغي أن تظهر في diff:"
echo "  src/components/ArticleReader.tsx"
echo "  src/pages/ArticleDetail.tsx"
echo "  src/index.css"
echo "  src/components/ui.tsx"
echo "  src/main.tsx"
echo "  src/polish-2026-overrides.css"
echo "  scripts/test-site-polish-2026.mjs"
