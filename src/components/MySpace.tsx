import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";
import { useCmsContent } from "../lib/content";
import { categoryLabel } from "../lib/content-taxonomy";
import { usePersistentAudio } from "../lib/persistent-audio";
import {
  SPACE_EVENT,
  isArticleSaved,
  isMediaSaved,
  progressFor,
  readingSpaceSnapshot,
  sanitizeReadingSpace,
  toggleSavedArticle,
  toggleSavedMedia,
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
  const { articles, media, loading } = useCmsContent();
  useEffect(() => {
    if (loading || !articles.length) return;
    sanitizeReadingSpace(articles, media);
  }, [articles, loading, media]);
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

export function MediaSaveButton({ slug, className = '', compact = true }: { slug: string; className?: string; compact?: boolean }) {
  const [saved, setSaved] = useState(() => isMediaSaved(slug));

  useEffect(() => {
    const sync = () => setSaved(isMediaSaved(slug));
    window.addEventListener(SPACE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SPACE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  return (
    <button
      type="button"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSaved(toggleSavedMedia(slug)); }}
      aria-label={saved ? "إزالة اللقاء من محفوظاتي" : "حفظ اللقاء في مساحتي"}
      aria-pressed={saved}
      title={saved ? "محفوظ في مساحتي" : "حفظ اللقاء في مساحتي"}
      className={`${compact ? "flex h-9 w-9 items-center justify-center rounded-full" : "inline-flex min-h-11 items-center gap-2 rounded-full px-4"} border transition-colors ${saved ? "border-accent bg-accent text-white" : "border-hair bg-canvas/[.92] text-soft hover:border-accent hover:text-accent"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill={saved ? "currentColor" : "none"} aria-hidden="true">
        <path d="M7 4.75h10v14.5L12 16.2 7 19.25V4.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {!compact && <span className="text-[.76rem] font-semibold">{saved ? "محفوظ في مساحتي" : "احفظ اللقاء"}</span>}
    </button>
  );
}

/* مزامنة عبر الأجهزة — اختيارية، محلي افتراضي. مكوّن مستقل يحمّل منطق المزامنة
   كسولاً فلا يُثقل «مساحتي» لمن لا يفعّلها، ويتحمّل غياب السحابة بسلاسة. */
function CrossDeviceSync({ onActiveChange }: { onActiveChange?: (active: boolean) => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [entry, setEntry] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "unavailable" | "error" | "copied" | "cleared">("idle");

  useEffect(() => {
    let active = true;
    void import("../lib/myspace-sync").then(async (module) => {
      const existing = module.getSyncCode();
      if (!active) return;
      setCode(existing);
      onActiveChange?.(Boolean(existing));
      setReady(true);
      if (existing) {
        setStatus("busy");
        const outcome = await module.syncNow(existing);
        if (active) setStatus(outcome === "synced" ? "ok" : outcome === "unavailable" ? "unavailable" : "error");
      }
    });
    return () => { active = false; };
  }, [onActiveChange]);

  const enable = async () => {
    setStatus("busy");
    const module = await import("../lib/myspace-sync");
    const fresh = module.generateSyncCode();
    const outcome = await module.syncNow(fresh);
    if (outcome === "unavailable") { setStatus("unavailable"); return; }
    module.setSyncCode(fresh);
    setCode(fresh);
    onActiveChange?.(true);
    setStatus("ok");
  };
  const connect = async () => {
    const module = await import("../lib/myspace-sync");
    const normalized = module.normalizeSyncCode(entry);
    if (normalized.replace(/-/g, "").length < 8) { setStatus("error"); return; }
    setStatus("busy");
    const outcome = await module.syncNow(normalized);
    if (outcome === "unavailable") { setStatus("unavailable"); return; }
    if (outcome === "error") { setStatus("error"); return; }
    module.setSyncCode(normalized);
    setCode(normalized);
    onActiveChange?.(true);
    setEntry("");
    setStatus("ok");
  };
  const syncAgain = async () => {
    if (!code) return;
    setStatus("busy");
    const module = await import("../lib/myspace-sync");
    const outcome = await module.syncNow(code);
    setStatus(outcome === "synced" ? "ok" : outcome === "unavailable" ? "unavailable" : "error");
  };
  const disable = async () => {
    const module = await import("../lib/myspace-sync");
    module.setSyncCode(null);
    setCode(null);
    onActiveChange?.(false);
    setStatus("idle");
  };
  const clearCloud = async () => {
    if (!code) return;
    setStatus("busy");
    const module = await import("../lib/myspace-sync");
    const cleared = await module.clearCloudState(code);
    if (!cleared) { setStatus("error"); return; }
    module.setSyncCode(null);
    setCode(null);
    onActiveChange?.(false);
    setStatus("cleared");
  };
  const copyCode = async () => {
    if (!code || !navigator.clipboard) return;
    try { await navigator.clipboard.writeText(code); setStatus("copied"); } catch { /* noop */ }
  };

  if (!ready) return null;
  const message = status === "busy" ? "جارٍ تنفيذ الطلب…"
    : status === "ok" ? "تمت المزامنة بتشفير داخل المتصفح."
      : status === "copied" ? "نُسخ الرمز."
        : status === "cleared" ? "مُسحت النسخة السحابية، وبقيت بيانات هذا الجهاز."
          : status === "unavailable" ? "المزامنة غير متاحة الآن؛ كل شيء باقٍ على جهازك."
            : status === "error" ? "تعذّر التنفيذ؛ تحقّق من الرمز وحاول ثانيةً."
              : "";

  return (
    <section className="border-t border-hair pt-5">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-4 text-right" aria-expanded={expanded}>
        <span className="min-w-0">
          <span className="block text-[.72rem] font-semibold text-ink">المزامنة عبر الأجهزة</span>
          <span className="mt-1 block text-[.7rem] leading-relaxed text-soft">{code ? "مفعّلة · البيانات تُشفّر قبل مغادرة جهازك." : "غير مفعّلة · التخزين المحلي هو الافتراضي."}</span>
        </span>
        <span className="shrink-0 text-[.72rem] font-semibold text-accent">{expanded ? "إغلاق" : "إدارة"}</span>
      </button>
      {expanded && (
        <div className="mt-4 grid gap-3 rounded-2xl bg-wash/[.55] p-4">
          {code ? (
            <>
              <div className="rounded-xl border border-hair bg-canvas p-3">
                <p className="text-[.66rem] font-semibold text-soft">رمزك السري لجهازك الآخر</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code dir="ltr" className="select-all font-mono text-[.92rem] tracking-wide text-ink">{code}</code>
                  <button type="button" onClick={copyCode} className="shrink-0 rounded-full border border-hair px-3 py-1 text-[.68rem] font-semibold text-soft hover:border-accent hover:text-accent">نسخ</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={syncAgain} className="rounded-full bg-accent px-4 py-2 text-[.72rem] font-semibold text-white">زامن الآن</button>
                <button type="button" onClick={clearCloud} className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-soft hover:border-accent hover:text-accent">امسح النسخة السحابية</button>
                <button type="button" onClick={disable} className="rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-soft hover:border-red-400 hover:text-red-500">أوقفها على هذا الجهاز</button>
              </div>
              <p className="text-[.65rem] leading-[1.75] text-soft">الرمز هو مفتاح فك التشفير؛ احتفظ به سراً. مسح السحابة أو إيقاف المزامنة لا يحذف ما على هذا الجهاز.</p>
            </>
          ) : (
            <>
              <button type="button" onClick={enable} className="rounded-full bg-accent px-4 py-2.5 text-[.76rem] font-semibold text-white">فعّل المزامنة وأنشئ رمزاً</button>
              <div className="rounded-xl border border-hair bg-canvas p-3">
                <p className="text-[.66rem] font-semibold text-soft">أو أدخل رمزاً من جهاز آخر</p>
                <div className="mt-2 flex items-center gap-2">
                  <input dir="ltr" value={entry} onChange={(event) => setEntry(event.target.value)} placeholder="xxxx-xxxx-xxxx" className="w-full rounded-lg border border-hair bg-canvas px-3 py-2 font-mono text-[.82rem] text-ink outline-none focus:border-accent" />
                  <button type="button" onClick={connect} className="shrink-0 rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-soft hover:border-accent hover:text-accent">اربط</button>
                </div>
              </div>
            </>
          )}
          {message && <p className={`text-[.7rem] font-medium ${status === "error" ? "text-red-500" : "text-accent"}`}>{message}</p>}
        </div>
      )}
    </section>
  );
}

type SpaceTab = "continue" | "saved" | "quotes";

function PlayMark() {
  return <svg aria-hidden viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8.25" /><path d="m10.4 8.8 5 3.2-5 3.2Z" fill="currentColor" stroke="none" /></svg>;
}

export function MySpace({ variant = "floating" }: { variant?: "floating" | "footer" }) {
  const location = useLocation();
  const { articles, media } = useCmsContent();
  const audio = usePersistentAudio();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [tab, setTab] = useState<SpaceTab>("continue");
  const [query, setQuery] = useState("");
  const [syncActive, setSyncActive] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const snapshot = useMemo(() => readingSpaceSnapshot(articles, media), [articles, media, version]);
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
      if (event.key === "Escape") { event.preventDefault(); closeSpace(); return; }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') || []).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [closeSpace, open]);

  const [leftAtLine, setLeftAtLine] = useState<{ speaker: string; text: string } | null>(null);
  useEffect(() => {
    setLeftAtLine(null);
    const track = snapshot.audio?.track;
    const at = Number(snapshot.audio?.current || 0);
    if (!open || !track?.src || !track.src.includes(".dialogue.mp3") || at < 5) return;
    let active = true;
    const url = track.src.split("?")[0].replace(/\.mp3$/, ".json");
    fetch(url, { cache: "force-cache" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active || !data || !Array.isArray(data.utterances)) return;
      let found: { speaker?: string; text?: string; startSec?: number } | null = null;
      for (const line of data.utterances) { if (typeof line?.startSec !== "number") continue; if (line.startSec <= at + 0.5) found = line; else break; }
      if (found?.text) setLeftAtLine({ speaker: String(found.speaker || ""), text: String(found.text) });
    }).catch(() => {});
    return () => { active = false; };
  }, [open, snapshot.audio]);

  const resumeAudio = async () => {
    if (!snapshot.audio) return;
    await audio.playTrack(snapshot.audio.track);
    window.setTimeout(() => audio.seekTo(snapshot.audio?.current || 0), 250);
    closeSpace(false);
  };

  const hasJourney = Boolean(snapshot.last || snapshot.audio || snapshot.saved.length || snapshot.savedMedia.length || snapshot.recent.length || snapshot.quotes.length);
  const savedCount = snapshot.saved.length + snapshot.savedMedia.length;
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const filteredArticles = snapshot.saved.filter((item) => !normalizedQuery || `${item.title} ${categoryLabel(item.cat)}`.toLocaleLowerCase("ar").includes(normalizedQuery));
  const filteredMedia = snapshot.savedMedia.filter((item) => !normalizedQuery || `${item.title} ${item.outlet || ""} ${item.program || ""}`.toLocaleLowerCase("ar").includes(normalizedQuery));
  const latestIsAudio = Boolean(snapshot.audio && (!snapshot.last || snapshot.audio.updatedAt >= snapshot.last.at));

  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/cv-file/")) return null;

  const tabs: { id: SpaceTab; label: string; count?: number }[] = [
    { id: "continue", label: "متابعة" },
    { id: "saved", label: "محفوظاتي", count: savedCount },
    { id: "quotes", label: "اقتباساتي", count: snapshot.quotes.length },
  ];

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => { setOpen(true); setTab("continue"); }}
        aria-label="فتح مساحتي"
        title={snapshot.last && resumeProgress > 0 ? `مساحتي · أكمل القراءة من ${arNumber(Math.round(resumeProgress * 100))}%` : "مساحتي"}
        className={`my-space-trigger group relative flex items-center justify-center text-ink transition-all hover:text-accent ${variant === "footer" ? "h-10 w-10 bg-transparent" : "h-11 w-11 rounded-full border border-hair bg-canvas/[.92] shadow-[0_12px_32px_-16px_rgba(21,22,26,.52)] backdrop-blur hover:border-accent"}`}
      >
        {variant === "floating" && resumeProgress > 0 && (
          <svg aria-hidden viewBox="0 0 44 44" className="pointer-events-none absolute inset-[-1px] h-[44px] w-[44px] -rotate-90 text-accent">
            <circle cx="22" cy="22" r="20.5" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="1.5" />
            <circle cx="22" cy="22" r="20.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${Math.max(3, resumeProgress * 100)} 100`} />
          </svg>
        )}
        <SpaceIcon />
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div className="my-space-overlay fixed inset-0 z-[310] flex items-end justify-center bg-ink/25 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] backdrop-blur-[3px] md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2 }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeSpace(); }} role="presentation">
              <motion.section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="my-space-title" initial={{ opacity: 0, y: 28, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .99 }} transition={{ duration: .38, ease: EASE }} className="my-space-panel relative flex max-h-[min(780px,90dvh)] w-full max-w-[780px] flex-col overflow-hidden rounded-[1.75rem] border border-hair bg-canvas shadow-[0_40px_120px_-44px_rgba(15,25,36,.7)]">
                <header className="shrink-0 border-b border-hair bg-canvas/[.95] px-5 pt-5 backdrop-blur md:px-8 md:pt-6">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h2 id="my-space-title" className="font-display text-[1.45rem] font-semibold text-ink">مساحتي</h2>
                      <p className="mt-1 text-[.74rem] font-light text-soft">{syncActive ? "متزامنة بين أجهزتك · مشفّرة قبل الرفع" : "لا حساب · بياناتك محفوظة على جهازك"}</p>
                    </div>
                    <button ref={closeRef} type="button" onClick={() => closeSpace()} aria-label="إغلاق مساحتي" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">×</button>
                  </div>
                  <nav className="mt-5 flex gap-6 overflow-x-auto" role="tablist" aria-label="أقسام مساحتي">
                    {tabs.map((item) => (
                      <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`relative min-h-11 shrink-0 pb-3 text-[.78rem] font-semibold transition-colors ${tab === item.id ? "text-accent" : "text-soft hover:text-ink"}`}>
                        {item.label}{item.count ? ` · ${arNumber(item.count)}` : ""}
                        {tab === item.id && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-accent" />}
                      </button>
                    ))}
                  </nav>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {!hasJourney ? (
                    <div className="px-7 py-12 text-center md:px-12 md:py-14">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/25 bg-wash text-accent"><SpaceIcon /></span>
                      <h3 className="mt-5 font-display text-[1.15rem] font-semibold text-ink">تبدأ المساحة مع أول خطوة.</h3>
                      <p className="mx-auto mt-2 max-w-md text-[.86rem] font-light leading-[1.9] text-soft">اقرأ مقالاً، احفظ لقاءً إعلامياً، احتفظ باقتباس، أو شغّل حلقة؛ وستجد خيطك هنا.</p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <Link to="/articles" onClick={() => setOpen(false)} className="rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white">ابدأ من المقالات</Link>
                        <Link to="/media" onClick={() => setOpen(false)} className="rounded-full border border-hair px-5 py-2.5 text-[.82rem] font-semibold text-soft hover:border-accent hover:text-accent">استكشف اللقاءات</Link>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-6 md:px-8 md:py-8">
                      {tab === "continue" && (
                        <div className="space-y-7">
                          <section>
                            <p className="text-[.7rem] font-semibold text-accent">تابع من حيث توقفت</p>
                            <div className="mt-3 overflow-hidden rounded-2xl border border-accent/25 bg-wash/[.55]">
                              {latestIsAudio && snapshot.audio ? (
                                <button type="button" onClick={() => void resumeAudio()} className="group flex w-full items-center gap-5 p-5 text-right md:p-6">
                                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-white"><PlayMark /></span>
                                  <span className="min-w-0 flex-1"><span className="text-[.68rem] font-semibold text-accent">أكمل الاستماع</span><strong className="mt-1 line-clamp-2 block font-display text-[1.08rem] leading-[1.65] text-ink group-hover:text-accent">{snapshot.audio.track.title}</strong><span className="mt-1 line-clamp-2 block text-[.76rem] leading-[1.8] text-soft">{leftAtLine ? <><b className="text-accent">{leftAtLine.speaker}:</b> {leftAtLine.text}</> : <>توقفت عند {arNumber(Math.floor(snapshot.audio.current / 60))}:{arNumber(String(Math.floor(snapshot.audio.current % 60)).padStart(2, "0"))}</>}</span></span>
                                </button>
                              ) : snapshot.last ? (
                                <Link to={`/articles/${snapshot.last.slug}`} onClick={() => setOpen(false)} className="group block p-5 md:p-6">
                                  <div className="flex items-center justify-between gap-3"><span className="text-[.68rem] font-semibold text-accent">أكمل القراءة</span><span className="text-[.68rem] text-soft">{arNumber(Math.round(resumeProgress * 100))}%</span></div>
                                  <h3 className="mt-2 line-clamp-2 font-display text-[1.12rem] font-semibold leading-[1.65] text-ink group-hover:text-accent">{snapshot.last.title}</h3>
                                  <div className="mt-4 h-1 overflow-hidden rounded-full bg-canvas"><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, resumeProgress * 100)}%` }} /></div>
                                </Link>
                              ) : (
                                <button type="button" onClick={() => setTab("saved")} className="group block w-full p-5 text-right md:p-6">
                                  <span className="text-[.68rem] font-semibold text-accent">محفوظاتك جاهزة</span>
                                  <strong className="mt-2 block font-display text-[1.08rem] leading-[1.65] text-ink group-hover:text-accent">عد إلى المقالات واللقاءات التي اخترتها.</strong>
                                  <span className="mt-3 inline-flex text-[.72rem] font-semibold text-accent">افتح محفوظاتي ←</span>
                                </button>
                              )}
                            </div>
                            {snapshot.last && snapshot.audio && (
                              latestIsAudio ? <Link to={`/articles/${snapshot.last.slug}`} onClick={() => setOpen(false)} className="mt-3 inline-flex text-[.74rem] font-semibold text-accent">أكمل القراءة أيضاً ←</Link> : <button type="button" onClick={() => void resumeAudio()} className="mt-3 inline-flex text-[.74rem] font-semibold text-accent">أكمل الاستماع أيضاً ←</button>
                            )}
                          </section>

                          {snapshot.recent.length > 0 && (
                            <details className="group border-t border-hair pt-5">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[.8rem] font-semibold text-ink"><span>آخر القراءات</span><span className="text-[.7rem] text-soft group-open:hidden">عرض {arNumber(Math.min(5, snapshot.recent.length))}</span><span className="hidden text-[.7rem] text-soft group-open:inline">إخفاء</span></summary>
                              <ol className="mt-3 divide-y divide-hair">
                                {snapshot.recent.slice(0, 8).map((item) => <li key={`${item.slug}-${item.at}`}><Link to={`/articles/${item.slug}`} onClick={() => setOpen(false)} className="group flex items-center gap-4 py-3.5"><span className="min-w-0 flex-1 line-clamp-1 text-[.82rem] text-ink group-hover:text-accent">{item.title}</span><span className="shrink-0 text-[.66rem] text-soft">{timeAgo(item.at)}</span></Link></li>)}
                              </ol>
                            </details>
                          )}
                        </div>
                      )}

                      {tab === "saved" && (
                        <div className="space-y-8">
                          {savedCount >= 8 && <label className="relative block"><span className="sr-only">ابحث في محفوظاتي</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في المقالات واللقاءات المحفوظة…" className="w-full rounded-full border border-hair bg-canvas py-3 pe-11 ps-4 text-[.8rem] text-ink outline-none placeholder:text-soft focus:border-accent" /><span aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-soft">⌕</span></label>}
                          {filteredArticles.length > 0 && <section><div className="flex items-baseline justify-between gap-4"><h3 className="font-display text-[1rem] font-semibold text-ink">مقالات للعودة</h3><span className="text-[.68rem] text-soft">{arNumber(filteredArticles.length)}</span></div><div className="mt-3 divide-y divide-hair border-y border-hair">{filteredArticles.map((item) => <div key={item.slug} className="flex items-center gap-2 py-2"><Link to={`/articles/${item.slug}`} onClick={() => setOpen(false)} className="group flex min-w-0 flex-1 items-center justify-between gap-4 py-1.5"><span className="min-w-0"><span className="block text-[.65rem] text-soft">{categoryLabel(item.cat)}</span><span className="mt-1 line-clamp-2 block text-[.82rem] font-medium leading-[1.55] text-ink group-hover:text-accent">{item.title}</span></span><span className="text-accent">←</span></Link><button type="button" onClick={() => toggleSavedArticle(item)} aria-label="إزالة المقال من محفوظاتي" title="إزالة من محفوظاتي" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-soft transition-colors hover:bg-wash hover:text-accent">×</button></div>)}</div></section>}
                          {filteredMedia.length > 0 && <section><div className="flex items-baseline justify-between gap-4"><h3 className="font-display text-[1rem] font-semibold text-ink">لقاءات إعلامية محفوظة</h3><span className="text-[.68rem] text-soft">{arNumber(filteredMedia.length)}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{filteredMedia.map((item) => { const videoId = (item.url || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/)?.[1] || ""; return <div key={item.slug} className="group relative overflow-hidden rounded-xl border border-hair bg-canvas transition-colors hover:border-accent"><Link to={`/media/${item.slug}`} onClick={() => setOpen(false)} className="block"><div className="relative aspect-video overflow-hidden bg-wash">{videoId && <img src={item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" onLoad={(event) => { const img = event.currentTarget; if (!item.thumbnail && img.naturalWidth <= 120 && !img.dataset.fallback) { img.dataset.fallback = "1"; img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`; } }} onError={(event) => { const img = event.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = "1"; img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`; } else img.style.display = "none"; }} className="h-full w-full object-cover" />}<span className="absolute inset-0 flex items-center justify-center bg-ink/10"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas/[.92] text-accent"><PlayMark /></span></span></div><div className="p-3.5 pe-12"><span className="text-[.64rem] font-semibold text-accent">{item.program || item.outlet || "لقاء إعلامي"}</span><strong className="mt-1 line-clamp-2 block text-[.8rem] leading-[1.6] text-ink group-hover:text-accent">{item.title}</strong></div></Link><MediaSaveButton slug={item.slug} className="absolute bottom-3 left-3" /></div>; })}</div></section>}
                          {!filteredArticles.length && !filteredMedia.length && <p className="py-10 text-center text-[.84rem] text-soft">لا توجد نتيجة مطابقة في محفوظاتك.</p>}
                        </div>
                      )}

                      {tab === "quotes" && (
                        snapshot.quotes.length ? <ol className="space-y-6">{snapshot.quotes.map((item, index) => <li key={`${item.slug}-${item.id || index}`} className="border-r-2 border-accent/25 pr-4"><blockquote className="font-display text-[.92rem] leading-[1.9] text-ink">«{item.quote}»</blockquote>{item.note && <p className="mt-2 text-[.72rem] leading-relaxed text-soft">{item.note}</p>}<Link to={`/articles/${item.slug}`} onClick={() => setOpen(false)} className="mt-2 inline-flex text-[.7rem] font-semibold text-accent">{item.title || "عد إلى المصدر"} ←</Link></li>)}</ol> : <div className="py-12 text-center"><p className="font-display text-[1.05rem] font-semibold text-ink">دفتر الاقتباسات ينتظر أول جملة.</p><p className="mx-auto mt-2 max-w-md text-[.82rem] leading-[1.8] text-soft">حدّد جملة داخل أي مقال، ثم اختر حفظها؛ ستظهر هنا تلقائياً.</p></div>
                      )}
                    </div>
                  )}
                </div>
                <footer className="shrink-0 bg-canvas px-5 pb-5 md:px-8 md:pb-6"><CrossDeviceSync onActiveChange={setSyncActive} /></footer>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>, document.body)}
    </>
  );
}
