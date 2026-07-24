import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useCmsContent } from "../lib/content";
import { usePersistentAudio } from "../lib/persistent-audio";
import {
  SPACE_EVENT,
  isArticleSaved,
  progressFor,
  readingSpaceSnapshot,
  sanitizeReadingSpace,
  toggleSavedArticle,
} from "../lib/reading-space";

const EASE = [0.16, 1, 0.3, 1] as const;
const arNumber = (value: number | string) =>
  String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
const timeAgo = (at: number) => {
  if (!at) return "";
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${arNumber(days)} أيام`;
  return new Date(at).toLocaleDateString("ar-KW-u-nu-arab", {
    day: "numeric",
    month: "short",
  });
};

function SpaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[19px] w-[19px]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6.25 4.75h8.5a2 2 0 0 1 2 2v11.5l-6.25-3.35-4.25 2.3V4.75Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path
        d="M9 8.25h5M9 11h3.75"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
      <circle
        cx="17.6"
        cy="6.4"
        r="2.85"
        fill="rgb(var(--c-canvas))"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M17.6 4.95v2.9M16.15 6.4h2.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReadingMemoryGuard() {
  const { articles, loading } = useCmsContent();
  useEffect(() => {
    if (loading || !articles.length) return;
    sanitizeReadingSpace(articles);
  }, [articles, loading]);
  return null;
}

export function SaveForLaterButton({ slug }: { slug: string }) {
  const { articles } = useCmsContent();
  const article = articles.find((item) => item.slug === slug);
  const [saved, setSaved] = useState(() => isArticleSaved(slug));

  useEffect(() => {
    const sync = () => setSaved(isArticleSaved(slug));
    window.addEventListener(SPACE_EVENT, sync);
    return () => window.removeEventListener(SPACE_EVENT, sync);
  }, [slug]);

  if (!article) return null;
  return (
    <button
      type="button"
      onClick={() => setSaved(toggleSavedArticle(article))}
      aria-label={
        saved ? "إزالة المقال من المحفوظ للعودة" : "حفظ المقال للعودة لاحقاً"
      }
      aria-pressed={saved}
      title={saved ? "محفوظ للعودة" : "حفظ للعودة"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-canvas transition-colors ${saved ? "border-accent text-accent" : "border-hair text-soft hover:border-accent hover:text-accent"}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[18px] w-[18px]"
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      >
        <path
          d="M7 4.75h10v14.5L12 16.2 7 19.25V4.75Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* مزامنة عبر الأجهزة — اختيارية، محلي افتراضي. مكوّن مستقل يحمّل منطق المزامنة
   كسولاً فلا يُثقل «مساحتي» لمن لا يفعّلها، ويتحمّل غياب السحابة بسلاسة. */
function CrossDeviceSync() {
  const [code, setCode] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [entry, setEntry] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'ok' | 'unavailable' | 'error' | 'copied'>('idle')

  useEffect(() => {
    let active = true
    void import('../lib/myspace-sync').then(async (module) => {
      const existing = module.getSyncCode()
      if (!active) return
      setCode(existing)
      setReady(true)
      if (existing) { setStatus('busy'); const outcome = await module.syncNow(existing); if (active) setStatus(outcome === 'synced' ? 'ok' : outcome === 'unavailable' ? 'unavailable' : 'error') }
    })
    return () => { active = false }
  }, [])

  const enable = async () => {
    setStatus('busy')
    const module = await import('../lib/myspace-sync')
    const fresh = module.generateSyncCode()
    const outcome = await module.syncNow(fresh)
    if (outcome === 'unavailable') { setStatus('unavailable'); return }
    module.setSyncCode(fresh); setCode(fresh); setStatus('ok')
  }
  const connect = async () => {
    const module = await import('../lib/myspace-sync')
    const norm = module.normalizeSyncCode(entry)
    if (norm.replace(/-/g, '').length < 8) { setStatus('error'); return }
    setStatus('busy')
    const outcome = await module.syncNow(norm)
    if (outcome === 'unavailable') { setStatus('unavailable'); return }
    module.setSyncCode(norm); setCode(norm); setEntry(''); setStatus('ok')
  }
  const syncAgain = async () => {
    if (!code) return
    setStatus('busy')
    const module = await import('../lib/myspace-sync')
    const outcome = await module.syncNow(code)
    setStatus(outcome === 'synced' ? 'ok' : outcome === 'unavailable' ? 'unavailable' : 'error')
  }
  const disable = async () => {
    const module = await import('../lib/myspace-sync')
    module.setSyncCode(null); setCode(null); setStatus('idle')
  }
  const copyCode = async () => {
    if (!code || !navigator.clipboard) return
    try { await navigator.clipboard.writeText(code); setStatus('copied') } catch { /* تجاهل */ }
  }

  if (!ready) return null
  const message = status === 'busy' ? 'جارٍ المزامنة…'
    : status === 'ok' ? 'تمت المزامنة ✓'
    : status === 'copied' ? 'نُسخ الرمز ✓'
    : status === 'unavailable' ? 'المزامنة غير متاحة الآن — كلُّ شيءٍ يبقى محفوظاً على جهازك.'
    : status === 'error' ? 'تعذّرت المزامنة — تحقّق من الرمز وحاول ثانيةً.'
    : ''

  return (
    <section className="rounded-2xl border border-hair bg-canvas p-5">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 text-right">
        <span>
          <span className="text-[.7rem] font-semibold text-accent">المزامنة عبر الأجهزة · اختيارية</span>
          <span className="mt-1 block text-[.76rem] text-soft">{code ? 'مُفعّلة — قراءتُك ومحفوظاتك تنتقل بين هاتفك وحاسوبك.' : 'اربط هاتفك وحاسوبك بلا حساب. الوضع المحلي يبقى الافتراضي.'}</span>
        </span>
        <span className="shrink-0 text-soft">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-4 grid gap-3">
          {code ? (
            <>
              <div className="rounded-xl border border-hair bg-paper p-3">
                <p className="text-[.66rem] font-semibold text-soft">رمزك السرّي — أدخله في جهازك الآخر:</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code dir="ltr" className="select-all font-mono text-[.95rem] tracking-wide text-ink">{code}</code>
                  <button type="button" onClick={copyCode} className="shrink-0 rounded-full border border-hair px-3 py-1 text-[.68rem] font-semibold text-soft hover:border-accent hover:text-accent">نسخ</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={syncAgain} className="rounded-full bg-accent px-4 py-2 text-[.74rem] font-semibold text-white">زامن الآن</button>
                <button type="button" onClick={disable} className="rounded-full border border-hair px-4 py-2 text-[.74rem] font-semibold text-soft hover:border-red-400 hover:text-red-500">أوقف المزامنة على هذا الجهاز</button>
              </div>
              <p className="text-[.66rem] leading-[1.7] text-soft">الرمزُ مفتاحُ بياناتك — احفظه سرّاً ولا تشاركه. إيقاف المزامنة لا يمحو ما على جهازك.</p>
            </>
          ) : (
            <>
              <button type="button" onClick={enable} className="rounded-full bg-accent px-4 py-2 text-[.78rem] font-semibold text-white">فعّل المزامنة وأنشئ رمزاً</button>
              <div className="rounded-xl border border-hair bg-paper p-3">
                <p className="text-[.66rem] font-semibold text-soft">أو أدخل رمزاً من جهازٍ آخر:</p>
                <div className="mt-2 flex items-center gap-2">
                  <input dir="ltr" value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="xxxx-xxxx-xxxx" className="w-full rounded-lg border border-hair bg-canvas px-3 py-2 font-mono text-[.82rem] text-ink outline-none focus:border-accent" />
                  <button type="button" onClick={connect} className="shrink-0 rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-soft hover:border-accent hover:text-accent">اربط</button>
                </div>
              </div>
            </>
          )}
          {message && <p className={`text-[.72rem] font-medium ${status === 'error' ? 'text-red-500' : status === 'unavailable' ? 'text-soft' : 'text-accent'}`}>{message}</p>}
        </div>
      )}
    </section>
  )
}

export function MySpace({ variant = 'floating' }: { variant?: 'floating' | 'footer' }) {
  const location = useLocation();
  const { articles } = useCmsContent();
  const audio = usePersistentAudio();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const snapshot = useMemo(
    () => readingSpaceSnapshot(articles),
    [articles, version],
  );
  const resumeProgress = snapshot.last ? progressFor(snapshot.last.slug) : 0;

  useEffect(() => {
    const sync = () => setVersion((value) => value + 1);
    window.addEventListener(SPACE_EVENT, sync);
    window.addEventListener("reader:quotes-changed", sync);
    window.addEventListener("reader:journey-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SPACE_EVENT, sync);
      window.removeEventListener("reader:quotes-changed", sync);
      window.removeEventListener("reader:journey-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const closeSpace = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 30);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSpace();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [closeSpace, open]);

  const resumeAudio = async () => {
    if (!snapshot.audio) return;
    await audio.playTrack(snapshot.audio.track);
    window.setTimeout(() => audio.seekTo(snapshot.audio?.current || 0), 250);
    closeSpace(false);
  };

  const hasJourney = Boolean(
    snapshot.last ||
    snapshot.audio ||
    snapshot.saved.length ||
    snapshot.recent.length ||
    snapshot.quotes.length,
  );
  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/cv-file/")
  )
    return null;

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen(true)}
        aria-label="فتح مساحتي"
        title="مساحتي"
        className={`my-space-trigger group relative flex items-center justify-center rounded-full border border-hair text-ink transition-all hover:border-accent hover:text-accent ${variant === 'footer' ? 'h-10 w-10 bg-transparent shadow-none' : 'h-11 w-11 bg-canvas/92 shadow-[0_12px_32px_-16px_rgba(21,22,26,.52)] backdrop-blur'}`}
      >
        <SpaceIcon />
        {hasJourney && (
          <span
            className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent"
            aria-hidden="true"
          />
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                className="my-space-overlay fixed inset-0 z-[310] flex items-end justify-center bg-ink/25 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur-[3px] md:items-center md:p-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeSpace();
                }}
                role="presentation"
              >
                <motion.section
                  ref={dialogRef}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="my-space-title"
                  initial={{ opacity: 0, y: 28, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.99 }}
                  transition={{ duration: 0.38, ease: EASE }}
                  className="my-space-panel relative max-h-[min(760px,88vh)] w-full max-w-[780px] overflow-y-auto rounded-[1.75rem] border border-hair bg-canvas shadow-[0_40px_120px_-44px_rgba(15,25,36,.7)]"
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-hair bg-canvas/95 px-6 py-5 backdrop-blur md:px-8">
                    <div>
                      <p className="text-[.68rem] font-semibold text-accent">
                        خاص بهذا الجهاز فقط
                      </p>
                      <h2
                        id="my-space-title"
                        className="mt-1 font-display text-[1.45rem] font-semibold text-ink"
                      >
                        مساحتك الهادئة
                      </h2>
                      <p className="mt-1 text-[.8rem] font-light text-soft">
                        قراءاتك واستماعك ومحفوظاتك، بلا حساب وبلا إرسال للخادم.
                      </p>
                    </div>
                    <button
                      ref={closeRef}
                      type="button"
                      onClick={() => closeSpace()}
                      aria-label="إغلاق مساحتي"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent"
                    >
                      ×
                    </button>
                  </div>

                  {!hasJourney ? (
                    <div className="px-7 py-14 text-center md:px-12 md:py-16">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/25 bg-wash text-accent">
                        <SpaceIcon />
                      </span>
                      <h3 className="mt-5 font-display text-[1.15rem] font-semibold text-ink">
                        تبدأ المساحة مع أول قراءة.
                      </h3>
                      <p className="mx-auto mt-2 max-w-md text-[.86rem] font-light leading-[1.9] text-soft">
                        افتح مقالاً، احفظ ما يستحق العودة، أو شغّل حلقة؛ وستجد
                        خيطك محفوظاً هنا تلقائياً.
                      </p>
                      <Link
                        to="/articles"
                        onClick={() => setOpen(false)}
                        className="mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-canvas"
                      >
                        ابدأ من المقالات
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-8 px-5 py-6 md:px-8 md:py-8">
                      <div className="grid gap-4 md:grid-cols-2">
                        {snapshot.last && (
                          <Link
                            to={`/articles/${snapshot.last.slug}`}
                            onClick={() => setOpen(false)}
                            className="group rounded-2xl border border-hair bg-wash/55 p-5 transition-colors hover:border-accent"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[.7rem] font-semibold text-accent">
                                أكمل القراءة
                              </span>
                              <span className="text-[.68rem] text-soft">
                                {arNumber(Math.round(resumeProgress * 100))}%
                              </span>
                            </div>
                            <h3 className="mt-3 line-clamp-2 font-display text-[1.02rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent">
                              {snapshot.last.title}
                            </h3>
                            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas">
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{
                                  width: `${Math.max(4, resumeProgress * 100)}%`,
                                }}
                              />
                            </div>
                          </Link>
                        )}
                        {snapshot.audio && (
                          <button
                            type="button"
                            onClick={() => void resumeAudio()}
                            className="group rounded-2xl border border-hair bg-wash/55 p-5 text-right transition-colors hover:border-accent"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-[.7rem] font-semibold text-accent">
                                أكمل الاستماع
                              </span>
                              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/25 text-accent">
                                ▶
                              </span>
                            </div>
                            <h3 className="mt-3 line-clamp-2 font-display text-[1.02rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent">
                              {snapshot.audio.track.title}
                            </h3>
                            <p className="mt-2 text-[.74rem] text-soft">
                              توقفت عند{" "}
                              {arNumber(
                                Math.floor(snapshot.audio.current / 60),
                              )}
                              :
                              {arNumber(
                                String(
                                  Math.floor(snapshot.audio.current % 60),
                                ).padStart(2, "0"),
                              )}
                            </p>
                          </button>
                        )}
                      </div>

                      {snapshot.saved.length > 0 && (
                        <section>
                          <div className="flex items-baseline justify-between gap-4">
                            <h3 className="font-display text-[1rem] font-semibold text-ink">
                              للعودة لاحقاً
                            </h3>
                            <span className="text-[.7rem] text-soft">
                              {snapshot.saved.length.toLocaleString("en-US")}{" "}
                              محفوظة
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                            {snapshot.saved.slice(0, 6).map((item) => (
                              <Link
                                key={item.slug}
                                to={`/articles/${item.slug}`}
                                onClick={() => setOpen(false)}
                                className="group flex min-h-[82px] items-center justify-between gap-4 rounded-xl border border-hair px-4 py-3 transition-colors hover:border-accent"
                              >
                                <span className="min-w-0">
                                  <span className="block text-[.68rem] text-soft">
                                    {item.cat}
                                  </span>
                                  <span className="mt-1 line-clamp-2 block text-[.84rem] font-medium leading-[1.55] text-ink group-hover:text-accent">
                                    {item.title}
                                  </span>
                                </span>
                                <span className="text-accent">←</span>
                              </Link>
                            ))}
                          </div>
                        </section>
                      )}

                      {snapshot.recent.length > 0 && (
                        <section>
                          <div className="flex items-baseline justify-between gap-4">
                            <h3 className="font-display text-[1rem] font-semibold text-ink">
                              آخر القراءات
                            </h3>
                            <span className="text-[.7rem] text-soft">
                              مسار لا سجلّ مراقبة
                            </span>
                          </div>
                          <ol className="mt-3 divide-y divide-hair rounded-xl border border-hair px-4">
                            {snapshot.recent.slice(0, 5).map((item) => (
                              <li key={`${item.slug}-${item.at}`}>
                                <Link
                                  to={`/articles/${item.slug}`}
                                  onClick={() => setOpen(false)}
                                  className="group flex items-center gap-4 py-3.5"
                                >
                                  <span className="min-w-0 flex-1 line-clamp-1 text-[.84rem] text-ink transition-colors group-hover:text-accent">
                                    {item.title}
                                  </span>
                                  <span className="shrink-0 text-[.68rem] text-soft">
                                    {timeAgo(item.at)}
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}

                      {snapshot.quotes.length > 0 && (
                        <section className="rounded-2xl border border-accent/20 bg-accent/[.045] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[.7rem] font-semibold text-accent">
                                دفتر الاقتباسات
                              </p>
                              <p className="mt-1 text-[.78rem] text-soft">
                                {snapshot.quotes.length.toLocaleString("en-US")}{" "}
                                جملة احتفظت بها
                              </p>
                            </div>
                            <span className="font-display text-[2rem] leading-none text-accent/35">
                              ”
                            </span>
                          </div>
                          <blockquote className="mt-4 line-clamp-3 font-display text-[.94rem] leading-[1.8] text-ink">
                            «{snapshot.quotes[0].quote}»
                          </blockquote>
                          <Link
                            to={`/articles/${snapshot.quotes[0].slug}`}
                            onClick={() => setOpen(false)}
                            className="mt-3 inline-flex text-[.74rem] font-semibold text-accent"
                          >
                            عد إلى مصدرها ←
                          </Link>
                        </section>
                      )}
                    </div>
                  )}
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
