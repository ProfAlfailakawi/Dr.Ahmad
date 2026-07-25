/**
 * «أرشيف الرادار» — /radar
 * كل التقاطات الرادار اليومية مؤرشفة كمرجع بحثي:
 *   · مجمّعة «حصاد أسبوع» أسبوعاً بأسبوع (الأحدث أولاً)
 *   · عناوين سنوية عند تغيّر السنة
 *   · كل بطاقة تقود للمصدر الأصلي مباشرة
 * يقرأ من site_radar (المنشور فقط) — يُحدَّث تلقائياً بلا أي رفع.
 */
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
  const paged = usePagedList(weeks, 4, String(weeks.length));

  return (
    <Page>
      <PageHead
        label="رادار الشبكة"
        title="أرشيف الرادار."
        sub="قراءةٌ أسبوعية لما يتغيّر على الشبكة: مواد منتقاة، وعناوين عربية واضحة، ورابط مباشر إلى المصدر الأول لكل مادة."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {items.length === 0 ? (
            <FadeUp>
              <div className="rounded-2xl border border-hair bg-wash py-20 text-center">
                <p className="text-[1.05rem] font-light text-soft">
                  الرادار يبدأ الالتقاط قريباً — أول التقاطة تظهر هنا تلقائياً.
                </p>
              </div>
            </FadeUp>
          ) : (
            <>
              <FadeUp>
                <p className="mb-12 text-[.9rem] text-soft">
                  {arNum(items.length)} التقاطة · {arNum(sources.size)} مصادر
                  موثوقة · يُحدَّث تلقائياً كل يوم
                </p>
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
                    {w.items.map((r, i) => (
                      <FadeUp
                        key={`${r.url || r.ar || r.day}-${i}`}
                        delay={Math.min(i * 0.05, 0.2)}
                      >
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          data-hover
                          className="group flex h-full flex-col rounded-2xl border border-hair p-6 transition-colors hover:border-accent"
                        >
                          <span className="text-[.72rem] text-soft">
                            {radarDateArabic(r.day)} ·{" "}
                            {radarSourceArabic(r.source)}
                          </span>
                          <h4 className="mt-2.5 font-display text-[1.08rem] font-semibold leading-[1.7] text-ink">
                            {r.ar}
                          </h4>
                          {r.arNote && (
                            <p className="mt-1.5 text-[.87rem] font-light leading-[1.85] text-soft">
                              {r.arNote}
                            </p>
                          )}
                          <span className="mt-auto pt-4 text-[.8rem] text-soft transition-colors group-hover:text-accent">
                            اقرأ المادة في مصدرها ←
                          </span>
                        </a>
                      </FadeUp>
                    ))}
                  </div>
                </div>
              ))}
              </div>
              <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={weeks.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="radar-weeks" label="صفحات أرشيف الرادار" />
            </>
          )}
        </div>
      </section>
    </Page>
  );
}
