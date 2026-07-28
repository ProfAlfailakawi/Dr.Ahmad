/**
 * «أرشيف الرادار» — /radar
 * كل التقاطات الرادار اليومية مؤرشفة كمرجع بحثي:
 *   · مجمّعة «حصاد أسبوع» أسبوعاً بأسبوع (الأحدث أولاً)
 *   · عناوين سنوية عند تغيّر السنة
 *   · كل بطاقة تقود للمصدر الأصلي مباشرة
 * يقرأ من site_radar (المنشور فقط) — يُحدَّث تلقائياً بلا أي رفع.
 */
import { useState } from "react";
import { useSeo } from "../components/seo";
import { FadeUp, Page, PageHead } from "../components/ui";
import { useExtras } from "../lib/content";
import {
  radarArabicNote,
  radarArabicTitle,
  radarDateArabic,
  radarSourceArabic,
} from "../lib/radar-display";
import { Pagination, usePagedList } from "../components/Pagination";
import { liveLink } from "../lib/dead-links";

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

function RadarCard({ item, index = 0 }: { item: RadarItem; index?: number }) {
  return (
    <FadeUp delay={Math.min(index * 0.05, 0.2)}>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        data-hover
        className="group flex h-full flex-col rounded-2xl border border-hair p-6 transition-colors hover:border-accent"
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
    </FadeUp>
  );
}

export default function Radar() {
  useSeo({
    title: "أرشيف الرادار",
    path: "/radar",
    description:
      "كل ما التقطه الرادار من مصادر موثوقة، يوماً بيوم — حصاد أسبوعي مؤرشف بالعربية مع رابط المادة الأصلية.",
  });

  const items = useExtras<RadarItem>("site_radar", { realtime: true })
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
  const paged = usePagedList(visibleWeeks, 2, `${year}:${visibleWeeks.length}`);

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
                  لا توجد مواد في أرشيف الرادار الآن.
                </p>
              </div>
            </FadeUp>
          ) : (
            <>
              <FadeUp>
                <p className="mb-12 text-[.9rem] text-soft">
                  {arNum(items.length)} مادة · {arNum(sources.size)} مصادر · الأحدث أولاً
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
                        {w.items.length === 1 ? "التقاطة" : "التقاطات"}
                      </span>
                    </h3>
                  </FadeUp>
                  <div className="mobile-card-rail grid gap-5 md:grid-cols-2">
                    {w.items.slice(0, 2).map((item, index) => (
                      <RadarCard key={`${item.url || item.ar || item.day}-${index}`} item={item} index={index} />
                    ))}
                  </div>
                  {w.items.length > 2 && (
                    <details className="group mt-5 rounded-2xl border border-hair bg-wash/35 px-5 py-4">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[.82rem] font-semibold text-accent marker:hidden">
                        <span>بقية مواد هذا الأسبوع</span>
                        <span className="text-soft transition-transform group-open:rotate-45" aria-hidden="true">＋</span>
                      </summary>
                      <div className="mt-4 grid gap-5 border-t border-hair pt-5 md:grid-cols-2">
                        {w.items.slice(2).map((item, index) => (
                          <RadarCard key={`${item.url || item.ar || item.day}-more-${index}`} item={item} index={index} />
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
