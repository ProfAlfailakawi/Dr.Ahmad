import citationsJson from "../data/citations.json";

const ar = (value: number) => value.toLocaleString("en-US");

type Snapshot = { date: string; total: number };
type YearPoint = { year: number; count: number };
type CitationData = {
  total?: number;
  history?: Snapshot[];
  yearly?: YearPoint[];
  updatedAt?: string;
  profileUrl?: string;
};
const citations = citationsJson as CitationData;

function Sparkline({ points }: { points: Snapshot[] }) {
  if (points.length < 2) return null;
  const width = 560;
  const height = 118;
  const values = points.map((point) => point.total);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const d = points
    .map((point, index) => {
      const x =
        points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - 14 - ((point.total - min) / spread) * (height - 28);
      return `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-5 h-auto w-full"
      role="img"
      aria-label="تطور عدد الاستشهادات عبر الزمن"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-accent"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => {
        const x =
          points.length === 1
            ? width / 2
            : (index / (points.length - 1)) * width;
        const y = height - 14 - ((point.total - min) / spread) * (height - 28);
        return (
          <circle
            key={`${point.date}:${point.total}`}
            cx={x}
            cy={y}
            r="3.5"
            className="fill-canvas stroke-accent"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}

export default function CitationImpact() {
  const total = typeof citations.total === "number" ? citations.total : null;
  const history = (
    Array.isArray(citations.history) ? citations.history : []
  ) as Snapshot[];
  const yearly = Array.isArray(citations.yearly) ? citations.yearly : [];
  const recentHistory = history.slice(-12);
  const lastYear = yearly[yearly.length - 1];
  const previousYear = yearly[yearly.length - 2];
  const annualDelta =
    lastYear && previousYear ? lastYear.count - previousYear.count : null;
  const updated = citations.updatedAt
    ? new Date(citations.updatedAt).toLocaleDateString("ar-KW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <section
      className="mb-14 overflow-hidden rounded-2xl border border-hair bg-wash/[.55] p-5 md:p-7"
      aria-labelledby="citation-impact-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.72rem] font-semibold text-accent">أثر علمي حي</p>
          <h2
            id="citation-impact-title"
            className="mt-1 font-display text-[1.18rem] font-semibold text-ink"
          >
            استشهادات Google Scholar
          </h2>
        </div>
        <a
          href={citations.profileUrl || "https://scholar.google.com/"}
          target="_blank"
          rel="noreferrer"
          className="text-[.74rem] font-semibold text-accent transition-colors hover:text-accent-deep"
        >
          الملف العلمي ←
        </a>
      </div>

      {total !== null ? (
        <>
          <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <strong className="font-display text-[clamp(2rem,5vw,3.2rem)] leading-none text-accent">
              {ar(total)}
            </strong>
            <span className="text-[.85rem] text-soft">استشهاداً موثّقاً</span>
            {annualDelta !== null && annualDelta > 0 && (
              <span className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.7rem] text-soft">
                +{ar(annualDelta)} في أحدث سنة
              </span>
            )}
          </div>
          <Sparkline points={recentHistory} />
          <p className="mt-3 text-[.68rem] leading-relaxed text-soft">
            يُحدَّث الرقم تلقائياً من الملف العام، ويُحفظ تاريخ النمو من دون أي
            إدخال يدوي{updated ? ` · آخر تحديث ${updated}` : ""}.
          </p>
        </>
      ) : (
        <p className="mt-5 text-[.8rem] leading-[1.8] text-soft">
          أُعدّت اللوحة لتُحدَّث تلقائياً من Google Scholar عند البناء. لا يُعرض
          أي رقم قبل التحقق منه من المصدر.
        </p>
      )}
    </section>
  );
}
