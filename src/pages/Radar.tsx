/**
 * «أرشيف الرادار» — /radar
 * كل التقاطات الرادار اليومية مؤرشفة كمرجع بحثي:
 *   · مجمّعة «حصاد أسبوع» أسبوعاً بأسبوع (الأحدث أولاً)
 *   · عناوين سنوية عند تغيّر السنة
 *   · كل بطاقة تقود للمصدر الأصلي مباشرة
 * يقرأ من site_radar (المنشور فقط) — يُحدَّث تلقائياً بلا أي رفع.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { loadBookPassages, matchBookQuotes, searchBookPassages } from "../lib/book-quotes";
import { useSeo } from "../components/seo";
import { FadeUp, Page, PageHead } from "../components/ui";
import { useExtrasState } from "../lib/content";
import {
  radarArabicNote,
  radarArabicTitle,
  radarDateArabic,
  radarSourceArabic,
} from "../lib/radar-display";
import { Pagination, usePagedList } from "../components/Pagination";
import { liveLink } from "../lib/dead-links";
import { arabicCountPhrase, CAPTURE_FORMS, MATERIAL_FORMS, SOURCE_PLAIN_FORMS } from '../lib/arabic-count.ts';

type RadarItem = {
  ar: string;
  arNote?: string;
  en: string;
  enNote?: string;
  source: string;
  url: string;
  day: string;
  status?: string;
  translationStatus?: string;
};

const arNum = (n: number | string) =>
  String(n).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);

/** رقم الأسبوع ISO + مداه للعرض */
function weekOf(dayIso: string) {
  const d = new Date(dayIso + "T12:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // الاثنين = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (x: Date) =>
    x.toLocaleDateString("ar-KW-u-nu-arab", {
      day: "numeric",
      month: "long",
    });
  return {
    key: monday.toISOString().slice(0, 10),
    label: `${fmt(monday)} — ${fmt(sunday)}`,
    year: monday.getUTCFullYear(),
  };
}

/**
 * صدى الكتب في خبر اليوم.
 *
 * الرادار يجلب ما يُنشر في العالم عن التعليم والتقنية. وكتب الدكتور التسعة
 * تناولت أكثر هذه الموضوعات قبل سنوات. فبدل أن يبقى الطرفان متجاورين بلا
 * صلة، نصل الخبر بما قاله هو — فتصير كتبه حيّةً مع الأحداث لا أرشيفاً.
 *
 * الشرط: لا نفتعل الصلة. المقطع لا يظهر إلا إذا تجاوز عتبة تطابقٍ معتبرة،
 * فلا يُنسب إلى الدكتور رأيٌ في خبرٍ لم يتناوله.
 */
function BookEcho({ item, deep }: { item: RadarItem; deep: boolean }) {
  const match = useMemo(() => {
    const query = `${item.ar || ''} ${item.arNote || ''}`.trim();
    if (query.length < 8) return null;
    const found = deep ? searchBookPassages(query, 1) : matchBookQuotes(query, 1);
    /* عتبة الصدق: تطابقٌ ضعيف يعني موضوعاً آخر يشترك في كلمةٍ عامة. */
    return found[0] && found[0].score >= 9 ? found[0] : null;
  }, [deep, item.ar, item.arNote]);

  if (!match) return null;

  return (
    <div className="border-t border-hair px-6 py-4">
      <span className="text-[.68rem] font-semibold text-accent">وقد تناوله في كتبه</span>
      <blockquote className="mt-1.5 border-r-2 border-accent/30 pr-3 text-[.82rem] font-light leading-[1.85] text-ink/80">
        {match.quote.text}
      </blockquote>
      <Link
        to={`/publications/${match.bookSlug}#book-knowledge`}
        className="mt-2 inline-block pr-3 text-[.68rem] text-soft transition-colors hover:text-accent"
      >
        {match.bookTitle} · ص {match.quote.page} ←
      </Link>
    </div>
  );
}

function RadarCard({ item, index = 0, deep = false }: { item: RadarItem; index?: number; deep?: boolean }) {
  return (
    <FadeUp delay={Math.min(index * 0.05, 0.2)}>
      <div className="h-full rounded-2xl border border-hair transition-colors hover:border-accent">
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        data-hover
        className="group flex flex-col p-6"
      >
        <span className="text-[.72rem] text-soft">
          {radarDateArabic(item.day)} · {radarSourceArabic(item.source)}
        </span>
        <h4 className="mt-2.5 font-display text-[1.08rem] font-semibold leading-[1.7] text-ink">
          {item.ar}
        </h4>
        {item.arNote && (
          <p className="mt-1.5 text-[.87rem] font-light leading-[1.85] text-soft">
            {item.arNote}
          </p>
        )}
        <span className="mt-auto pt-4 text-[.8rem] text-soft transition-colors group-hover:text-accent">
          اقرأ المادة في مصدرها ←
        </span>
      </a>
      <BookEcho item={item} deep={deep} />
      </div>
    </FadeUp>
  );
}

export default function Radar() {
  /* فهرس المتون ثقيل، فلا يُجلب مع الصفحة: نؤجّله إلى ما بعد أول رسم،
     فتظهر البطاقات فوراً ثم يرتقي الصدى من المختارات إلى المتون كاملة. */
  const [deepReady, setDeepReady] = useState(false);
  useEffect(() => {
    let on = true;
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => { void loadBookPassages().then(() => { if (on) setDeepReady(true); }); }, { timeout: 3000 })
      : window.setTimeout(() => { void loadBookPassages().then(() => { if (on) setDeepReady(true); }); }, 1200);
    return () => {
      on = false;
      if (window.cancelIdleCallback && typeof idle === "number") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle as number);
    };
  }, []);

  useSeo({
    title: "أرشيف الرادار",
    path: "/radar",
    description:
      "كل ما التقطه الرادار من مصادر موثوقة، يوماً بيوم — حصاد أسبوعي مؤرشف بالعربية مع رابط المادة الأصلية.",
  });

  const radarState = useExtrasState<RadarItem>("site_radar", { realtime: true });
  const items = radarState.data
    .map((r) => ({ ...r, url: liveLink(r.url) || "", ar: radarArabicTitle(r.ar, r.en), arNote: radarArabicNote(r.arNote, r.en) }))
    .filter((r) => (!r.status || r.status === "published") && r.day && r.ar && r.url)
    .sort((a, b) => b.day.localeCompare(a.day));

  // تجميع أسبوعي مع فواصل سنوية
  const weeks: {
    key: string;
    label: string;
    year: number;
    items: RadarItem[];
  }[] = [];
  for (const it of items) {
    const w = weekOf(it.day);
    const last = weeks[weeks.length - 1];
    if (last && last.key === w.key) last.items.push(it);
    else weeks.push({ ...w, items: [it] });
  }

  const sources = new Set(items.map((i) => i.source));
  const years = Array.from(new Set(weeks.map((week) => week.year))).sort((a, b) => b - a);
  const [year, setYear] = useState<number | "latest">("latest");
  const visibleWeeks = year === "latest" ? weeks : weeks.filter((week) => week.year === year);
  const paged = usePagedList(visibleWeeks, 1, `${year}:${visibleWeeks.length}`);

  return (
    <Page>
      <PageHead
        label="رادار الشبكة"
        title="أرشيف الرادار."
        sub="نافذةٌ أسبوعية على أفكار ودراسات ومستجدات تستحق المتابعة."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {items.length === 0 ? (
            <FadeUp>
              <div className="rounded-2xl border border-hair bg-wash py-20 text-center">
                <p className="text-[1.05rem] font-light text-soft">
                  {radarState.loading || radarState.refreshing
                    ? "نستعيد أرشيف الرادار المحفوظ ونتحقق من أحدث نسخة…"
                    : "لا توجد مواد في أرشيف الرادار الآن."}
                </p>
              </div>
            </FadeUp>
          ) : (
            <>
              <FadeUp>
                <p className="mb-12 text-[.9rem] text-soft">
                  {arabicCountPhrase(items.length, MATERIAL_FORMS, arNum)} · {arabicCountPhrase(sources.size, SOURCE_PLAIN_FORMS, arNum)} · الأحدث أولاً
                </p>
              </FadeUp>

              <FadeUp delay={0.05}>
                <div className="mb-10 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex min-w-max items-center gap-1.5" role="tablist" aria-label="تصفية أرشيف الرادار حسب السنة">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={year === "latest"}
                      onClick={() => setYear("latest")}
                      className={`min-h-11 rounded-full px-5 text-[.82rem] font-semibold transition-colors ${year === "latest" ? "bg-accent text-white" : "border border-hair text-soft hover:border-accent hover:text-accent"}`}
                    >
                      الأحدث
                    </button>
                    {years.map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={year === value}
                        onClick={() => setYear(value)}
                        className={`min-h-11 rounded-full px-5 text-[.82rem] font-semibold transition-colors ${year === value ? "bg-accent text-white" : "border border-hair text-soft hover:border-accent hover:text-accent"}`}
                      >
                        {arNum(value)}
                      </button>
                    ))}
                  </div>
                </div>
              </FadeUp>

              <div id="radar-weeks" className="scroll-mt-28">
              {paged.pageItems.map((w, wi) => (
                <div key={w.key} className="mb-14">
                  {(wi === 0 || paged.pageItems[wi - 1].year !== w.year) && (
                    <FadeUp>
                      <h2 className="mb-8 border-b border-hair pb-3 font-display text-2xl font-bold text-accent">
                        {arNum(w.year)}
                      </h2>
                    </FadeUp>
                  )}
                  <FadeUp>
                    <h3 className="mb-6 flex flex-wrap items-baseline gap-3">
                      <span className="font-display text-lg font-semibold text-ink">
                        حصاد الأسبوع
                      </span>
                      <span className="text-[.85rem] text-soft">
                        {w.label} · {arNum(w.items.length)}{" "}
                        {arabicCountPhrase(w.items.length, CAPTURE_FORMS)}
                      </span>
                    </h3>
                  </FadeUp>
                  <div className="mx-auto max-w-4xl space-y-4">
                    {w.items.slice(0, 2).map((item, index) => (
                      <RadarCard key={`${item.url || item.ar || item.day}-${index}`} item={item} index={index} deep={deepReady} />
                    ))}
                  </div>
                  {w.items.length > 2 && (
                    <details className="group mt-5 rounded-2xl border border-hair bg-wash/[.35] px-5 py-4">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[.82rem] font-semibold text-accent marker:hidden">
                        <span>بقية مواد هذا الأسبوع</span>
                        <span className="text-soft transition-transform group-open:rotate-45" aria-hidden="true">＋</span>
                      </summary>
                      <div className="mx-auto mt-4 max-w-4xl space-y-4 border-t border-hair pt-5">
                        {w.items.slice(2).map((item, index) => (
                          <RadarCard key={`${item.url || item.ar || item.day}-more-${index}`} item={item} index={index} deep={deepReady} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
              </div>
              <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={visibleWeeks.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="radar-weeks" label="صفحات أرشيف الرادار" />
            </>
          )}
        </div>
      </section>
    </Page>
  );
}
