/**
 * «المختارات» — نافذة مستقلة على الإنترنت.
 *
 * المصدر الحي الوحيد هو site_radar، الذي يلتقط مواد حديثة من قائمة مغلقة
 * من المؤسسات والمجلات الموثوقة. لا تُسحب أي مادة من مقالات الدكتور أو كتبه
 * أو لقاءاته إلى هذه الصفحة.
 */
import { useSeo } from "../components/seo";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router";
import { EASE, FadeUp, Page, PageHead } from "../components/ui";
import {
  curatedBank,
  curioKinds,
  thisMonthsBook,
  type Curio,
} from "../data-curated";
import { useExtras } from "../lib/content";
import { radarArabicNote, radarArabicTitle, radarSourceArabic } from "../lib/radar-display";
import { liveLink } from "../lib/dead-links";
import { Pagination, usePagedList } from "../components/Pagination";
/* روابط خارجية ثبت موتها (404/410) عبر الفاحص الأسبوعي — تُصفّى فلا يظهر كرتٌ ميّت.
   وحدات site_radar الميتة تُحذف من Firestore مباشرةً، فلا تصل الصفحة أصلاً. */
import deadLinks from "../data/curated-dead-links.json";
const DEAD_LINKS = new Set(Object.keys(deadLinks as Record<string, string>));

const resolvedCurioUrl = (url?: string) => {
  if (!url) return undefined;
  const registryUrl = liveLink(url);
  if (registryUrl && registryUrl !== url) return registryUrl;
  if (DEAD_LINKS.has(url)) return undefined;
  return registryUrl;
};

function CardWrap({
  c,
  className,
  children,
}: {
  c: Curio;
  className: string;
  children: React.ReactNode;
}) {
  const url = resolvedCurioUrl(c.url);
  if (url)
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        data-hover
        className={`${className} group cursor-pointer transition-colors duration-300 hover:border-accent`}
      >
        {children}
      </a>
    );
  return <div className={className}>{children}</div>;
}

/* لا تُعرض في الواجهة إلا الصياغة العربية؛ يبقى الأصل محفوظاً للرابط والتحقق. */
function CurioBody({ c }: { c: Curio }) {
  const title = radarArabicTitle(c.ar, c.en);
  const note = radarArabicNote(c.arNote, c.en);
  return (
    <>
      <h3 className="font-display text-[1.2rem] font-semibold leading-[1.7] text-ink">
        {title}
      </h3>
      {note && (
        <p className="measure mt-2 text-[.9rem] font-light leading-relaxed text-soft">
          {note}
        </p>
      )}
    </>
  );
}

const fmtAdded = (iso: string) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("ar-KW-u-nu-arab", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const timestampIso = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (typeof value === "number")
    return new Date(value).toISOString().slice(0, 10);
  if (typeof value !== "object") return "";
  const candidate = value as {
    seconds?: unknown;
    toDate?: () => Date;
    toMillis?: () => number;
  };
  try {
    if (typeof candidate.toDate === "function")
      return candidate.toDate().toISOString().slice(0, 10);
    if (typeof candidate.toMillis === "function")
      return new Date(candidate.toMillis()).toISOString().slice(0, 10);
    if (typeof candidate.seconds === "number")
      return new Date(candidate.seconds * 1000).toISOString().slice(0, 10);
  } catch {
    /* ignore malformed timestamps */
  }
  return "";
};

const todayIso = () => new Date().toISOString().slice(0, 10);

/*
 * تعبئة موثوقة خارجية فقط، حتى لا تبدو الصفحة متوقفة قبل أول تشغيل ناجح
 * للرادار بعد الرفع. الروابط تقود إلى المادة الأصلية، ولا علاقة لها بأرشيف الدكتور.
 */
const trustedRecent: Curio[] = [
  {
    kind: "رؤية عميقة",
    ar: "اليونسكو تدعو إلى توسيع مبادلة الديون بالتعليم",
    arNote:
      "مقترح تمويلي يعيد توجيه وفورات خدمة الدين إلى المدارس وتدريب المعلمين ودعم الطلبة.",
    en: "UNESCO urges wider use of debt-for-education swaps",
    enNote:
      "A financing approach designed to redirect debt-service savings toward education systems.",
    source: "Reuters · 10 يوليو 2026",
    url: "https://www.reuters.com/world/africa/unesco-urges-wider-use-debt-for-education-swaps-2026-07-10/",
    added: "2026-07-14",
  },
  {
    kind: "رؤية عميقة",
    ar: "كلية قانون تعيد الأجهزة خارج الصف لحماية التفكير المستقل",
    arNote:
      "جامعة شيكاغو تمنع الهواتف والحواسيب في مقررات السنة الأولى، مع إبقاء تعليم الذكاء الاصطناعي في مراحل لاحقة.",
    en: "Chicago Law bans devices from first-year classes as part of its AI strategy",
    enNote:
      "The policy prioritizes foundational reasoning before students move to AI-assisted legal work.",
    source: "Reuters · 9 يوليو 2026",
    url: "https://www.reuters.com/legal/legalindustry/chicago-law-bans-phones-laptops-first-year-classes-combat-ai-2026-07-09/",
    added: "2026-07-13",
  },
];

type RadarItem = {
  id?: string;
  ar: string;
  arNote?: string;
  en: string;
  enNote?: string;
  source: string;
  url: string;
  day: string;
  status?: string;
  translationStatus?: string;
  createdAt?: unknown;
};

const radarKind = (item: RadarItem): Curio["kind"] => {
  const text = `${item.ar} ${item.arNote || ""} ${item.en}`;
  if (/أداة|منصة|تطبيق|tool|platform/i.test(text)) return "أداة تستحق";
  if (/مفهوم|مصطلح|framework|literacy/i.test(text)) return "مفهوم ناشئ";
  return "رؤية عميقة";
};

const radarAsCurio = (item: RadarItem): Curio => ({
  kind: radarKind(item),
  ar: radarArabicTitle(item.ar, item.en),
  arNote: radarArabicNote(item.arNote, item.en),
  en: item.en || "",
  enNote: item.enNote,
  source: item.source,
  url: item.url,
  added: timestampIso(item.createdAt) || item.day || todayIso(),
});

const dedupe = (items: Curio[]) =>
  items.filter((item, index, allItems) => {
    const url = resolvedCurioUrl(item.url);
    if (item.url && !url) return false;
    const key = url || item.ar;
    return allItems.findIndex((candidate) => (resolvedCurioUrl(candidate.url) || candidate.ar) === key) === index;
  });

function SourceLine({ c }: { c: Curio }) {
  return (
    <div className="mt-4 border-t border-hair pt-3 text-[.78rem] text-soft">
      <p className="flex items-center justify-between gap-3">
        <span>المصدر: {radarSourceArabic(c.source)}</span>
        {resolvedCurioUrl(c.url) && (
          <span className="shrink-0 text-accent transition-transform duration-300 group-hover:-translate-x-1">
            اذهب للمصدر ←
          </span>
        )}
      </p>
      {c.added && (
        <p className="mt-1.5 text-[.7rem] font-light text-soft/70">
          أُضيفت في {fmtAdded(c.added)}
        </p>
      )}
    </div>
  );
}

function RadarPanel({ items }: { items: Curio[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[.78rem] font-semibold text-accent">الأحدث من رادار الشبكة</p>
        <Link to="/radar" data-hover className="text-[.8rem] text-accent transition-colors hover:text-accent-deep">الأرشيف الكامل ←</Link>
      </div>
      <div className="mt-5 space-y-4">
        {items.slice(0, 2).map((item, index) => (
          <FadeUp key={`${item.url || item.ar}-${index}`} delay={Math.min(index * 0.05, 0.12)}>
            <CardWrap c={item} className="flex min-h-[11rem] flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors hover:border-accent md:p-7">
              <span className="text-[.72rem] text-soft">{item.added ? fmtAdded(item.added) : "حديث"} · {radarSourceArabic(item.source)}</span>
              <div className="mt-2.5 flex-1"><CurioBody c={item} /></div>
              <span className="mt-auto pt-4 text-[.8rem] text-soft transition-colors group-hover:text-accent">اقرأ المادة في مصدرها ←</span>
            </CardWrap>
          </FadeUp>
        ))}
      </div>
    </div>
  );
}

export default function Curated() {
  useSeo({
    title: "المختارات",
    path: "/curated",
    description:
      "مواد حديثة وأدوات وأبحاث من الإنترنت، منتقاة بعناية من مصادر موثوقة وروابط أصلية.",
  });
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<"الكل" | string>("الكل");
  const [feature, setFeature] = useState<"today" | "book" | "question" | "radar">("today");
  const [today, setToday] = useState("");

  useEffect(() => {
    try {
      setToday(
        new Date().toLocaleDateString("ar-KW-u-nu-arab", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
      );
    } catch {
      /* noop */
    }
  }, []);

  /* المصدر الحي الوحيد: رادار الإنترنت. site_picks المحلي متروك عمداً ولا يُقرأ هنا. */
  const radarItems = useExtras<RadarItem>("site_radar", {
    realtime: true,
  }).filter((item) => !item.status || item.status === "published");

  const dynamic = useMemo(
    () =>
      dedupe([...radarItems.map(radarAsCurio), ...trustedRecent])
        /* لا يدخل العرض إلا سجل مكتمل الصياغة العربية والمصدر والرابط. */
        .filter(
          (item) => item.ar && item.source && item.url?.startsWith("https://"),
        )
        .sort((left, right) =>
          (right.added || "").localeCompare(left.added || ""),
        ),
    [radarItems],
  );

  const daily = dynamic[0] || curatedBank[0];
  const book = thisMonthsBook();
  /* عدالة العرض (مقترح معتمد): المادة الرئيسية لا تتكرر في الرادار،
     والمعروض أعلى الصفحة كله لا يعود في الشبكة أسفلها — التكرار يوحي
     بغباءٍ حتى لو كان التصميم جميلاً. */
  const radarHighlights = dynamic.slice(1, 3);
  const curioKey = (item: Curio) => resolvedCurioUrl(item.url) || item.ar;
  const highlightedKeys = new Set([daily, book, ...radarHighlights].filter(Boolean).map((item) => curioKey(item as Curio)));
  const all = dedupe([...dynamic, ...curatedBank]).filter((item) => !highlightedKeys.has(curioKey(item)));
  const shown =
    kind === "الكل" ? all : all.filter((item) => item.kind === kind);
  const paged = usePagedList(shown, 2, kind);
  /* صدق الوسم: «الأحدث من الإنترنت» لا تُقال حين نعمل على الاحتياطي */
  const radarLive = radarItems.length > 0;
  const latestAdded = dynamic[0]?.added ? fmtAdded(dynamic[0].added) : "";

  return (
    <Page className="content-curated page-journey">
      <PageHead
        label="مختارات د. أحمد"
        title="ما يستحق أن يبقى في المشهد."
        sub="قراءاتٌ وأدواتٌ وأحداثٌ أختارها بعد التحقق من قيمتها؛ لكل مادة سياقٌ يوضح سبب الاختيار، وطريقٌ مباشر إلى مصدرها الأول."
      />

      <section className="border-b border-hair px-6 py-12 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2.5 text-[.78rem] font-semibold text-accent">
                  <span className={`relative h-2 w-2 rounded-full bg-accent ${radarLive ? "pulse" : ""}`} />
                  {radarLive ? "يتجدد من الشبكة" : "مختارات محفوظة"}
                </span>
                <p className="mt-1 text-[.74rem] text-soft">{radarLive ? today : latestAdded ? `آخر إضافة: ${latestAdded}` : "مسارات مختارة للقراءة"}</p>
              </div>
              <div className="max-w-full edge-fade overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-1" role="tablist" aria-label="واجهة مختارات د. أحمد">
                  {[
                    ["today", "اختيار اليوم"],
                    ["book", "كتاب الشهر"],
                    ["question", "سؤال"],
                    ["radar", "الرادار"],
                  ].map(([key, label]) => (
                    <button key={key} type="button" role="tab" aria-selected={feature === key} onClick={() => setFeature(key as typeof feature)} className={`min-h-11 rounded-full px-4 text-[.78rem] font-semibold transition-colors ${feature === key ? "bg-accent text-white" : "text-soft hover:bg-wash hover:text-ink"}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>

          <div className="mx-auto mt-7 max-w-4xl" role="tabpanel">
            {feature === "today" && (
              <FadeUp key="today">
                <CardWrap c={daily} className="block rounded-2xl border border-accent/[.35] bg-wash/[.55] p-7 md:p-9">
                  <span className="text-[.74rem] font-semibold text-accent">{daily.kind}</span>
                  <div className="mt-3"><CurioBody c={daily} /></div>
                  <SourceLine c={daily} />
                </CardWrap>
              </FadeUp>
            )}
            {feature === "book" && (
              <FadeUp key="book">
                <CardWrap c={book} className="flex min-h-[12rem] flex-col rounded-2xl border border-hair bg-canvas p-7 md:p-9">
                  <span className="text-[.74rem] font-semibold text-accent">كتاب الشهر</span>
                  <div className="mt-3 flex-1"><CurioBody c={book} /></div>
                  <SourceLine c={book} />
                </CardWrap>
              </FadeUp>
            )}
            {feature === "question" && (
              <FadeUp key="question">
                <Link to="/questions" data-hover className="group flex min-h-[12rem] flex-col rounded-2xl border border-hair bg-canvas p-7 transition-colors hover:border-accent md:p-9">
                  <span className="text-[.74rem] font-semibold text-accent">سؤال متجدد</span>
                  <h3 className="mt-3 font-display text-[1.3rem] font-semibold leading-[1.7] text-ink">سؤال يُقلق التعليم</h3>
                  <p className="measure mt-2 text-[.9rem] font-light leading-relaxed text-soft">سؤال قصير في صياغته، واسع في أثره؛ يفتح زاوية جديدة كل مرة.</p>
                  <span className="mt-auto pt-5 text-[.82rem] text-soft transition-colors group-hover:text-accent">إلى الزاوية ←</span>
                </Link>
              </FadeUp>
            )}
            {feature === "radar" && <RadarPanel items={radarHighlights} />}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="edge-fade overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-1.5" role="tablist" aria-label="تصفية مختارات د. أحمد">
                {["الكل", ...curioKinds].map((itemKind) => (
                  <button
                    key={itemKind}
                    type="button"
                    role="tab"
                    aria-selected={kind === itemKind}
                    onClick={() => setKind(itemKind)}
                    className={`min-h-11 rounded-full border px-5 text-[.85rem] font-medium transition-colors duration-300 ${kind === itemKind ? "border-accent bg-accent text-white" : "border-hair text-soft hover:border-accent hover:text-accent"}`}
                  >
                    {itemKind}
                  </button>
                ))}
              </div>
            </div>
          </FadeUp>

          <div id="curated-grid" className="mx-auto mt-10 max-w-4xl scroll-mt-28 space-y-4">
            {paged.pageItems.map((item, index) => (
              <motion.div
                key={item.url || item.ar}
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.7,
                  delay: Math.min((index % 6) * 0.06, 0.3),
                  ease: EASE,
                }}
                className="w-full"
              >
                <CardWrap
                  c={item}
                  className="flex min-h-[13rem] flex-col rounded-2xl border border-hair bg-canvas p-7 transition-colors hover:border-accent md:p-9"
                >
                  <span className="text-[.74rem] font-semibold text-accent">
                    {item.kind}
                  </span>
                  <div className="mt-3 flex-1">
                    <CurioBody c={item} />
                  </div>
                  <SourceLine c={item} />
                </CardWrap>
              </motion.div>
            ))}
          </div>


          <Pagination
            page={paged.page}
            pageCount={paged.pageCount}
            onChange={paged.setPage}
            totalItems={shown.length}
            firstItem={paged.firstItem}
            lastItem={paged.lastItem}
            scrollTargetId="curated-grid"
            className="mt-10"
            label="صفحات المختارات"
          />

        </div>
      </section>
    </Page>
  );
}
