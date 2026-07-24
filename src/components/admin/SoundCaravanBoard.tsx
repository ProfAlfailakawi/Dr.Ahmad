import { useMemo } from 'react'
import audio from '../../data/audio.json'

/* قافلة الصوت — لوحةُ تقدّمٍ داخل لوحة التحكم: لكلّ مقالٍ ثلاثة أصوات
   (تلاوة فهد · تلاوة نورة · الحوار). تقرأ الحالة من src/data/audio.json
   المولَّد من القافلة، فتُحدَّث ذاتياً مع كل نشر. بألوان الموقع نفسها. */

type Voice = { fahed?: boolean; noura?: boolean; dialogue?: boolean }
type Article = { slug: string; title?: string; ar?: string }

const F = '#2E7D8A'
const N = '#C05F7C'
const D = '#C2913C'

function Meter({ name, neural, val, total, color }: { name: string; neural: string; val: number; total: number; color: string }) {
  const pct = total ? Math.round((val / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-hair bg-canvas p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-lg font-bold text-ink">{name}</span>
        <span className="text-[.7rem] text-soft">{neural}</span>
      </div>
      <div className="flex items-end gap-1 tabular-nums">
        <span className="text-3xl font-extrabold text-ink">{val}</span>
        <span className="pb-1 text-sm text-soft">/ {total}</span>
        <span className="mr-auto pb-1 text-sm font-semibold" style={{ color }}>{pct}٪</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-2 text-[.72rem] text-soft">{val === total ? 'اكتمل الصوت' : `باقٍ ${total - val} مقالاً`}</div>
    </div>
  )
}

export function SoundCaravanBoard({ articles }: { articles: Article[] }) {
  const map = audio as Record<string, Voice>
  const rows = useMemo(() => articles.map((a, i) => {
    const v = map[a.slug] || {}
    return { n: i + 1, slug: a.slug, title: a.title || a.ar || a.slug, f: !!v.fahed, no: !!v.noura, d: !!v.dialogue }
  }), [articles, map])

  const T = rows.length
  const fahed = rows.filter((r) => r.f).length
  const noura = rows.filter((r) => r.no).length
  const dial = rows.filter((r) => r.d).length
  const anyRead = rows.filter((r) => r.f || r.no).length
  const done = fahed + noura + dial
  const target = T * 3
  const overall = target ? Math.round((done / target) * 100) : 0

  return (
    <div className="grid gap-5">
      <header>
        <h2 className="text-2xl font-extrabold text-ink">قافلة الصوت</h2>
        <p className="mt-1 text-sm text-soft">لكلّ مقالٍ من {T} مقالاً ثلاثة أصوات: تلاوة فهد، تلاوة نورة، ثمّ الحوار — {done} من {target} تسجيلاً ({overall}٪).</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Meter name="فهد" neural="ar-KW-FahedNeural" val={fahed} total={T} color={F} />
        <Meter name="نورة" neural="ar-KW-NouraNeural" val={noura} total={T} color={N} />
        <Meter name="الحوار" neural="فهد + نورة" val={dial} total={T} color={D} />
      </div>

      <div className="rounded-2xl border border-hair bg-canvas p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-soft">إجمالي التسجيلات المُنجَزة عبر الأصوات الثلاثة</span>
          <span className="text-xl font-extrabold tabular-nums text-ink">{done} <span className="text-sm font-normal text-soft">/ {target}</span></span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-wash">
          <div className="h-full transition-[width] duration-700" style={{ width: `${(fahed / target) * 100}%`, background: F }} />
          <div className="h-full transition-[width] duration-700" style={{ width: `${(noura / target) * 100}%`, background: N }} />
          <div className="h-full transition-[width] duration-700" style={{ width: `${(dial / target) * 100}%`, background: D }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[.72rem] text-soft">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: F }} />فهد {fahed}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: N }} />نورة {noura}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: D }} />حوار {dial}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-soft/40" />{T - anyRead} مقالاً بلا صوتٍ بعد</span>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="whitespace-nowrap text-base font-bold text-ink">المتون الـ{T}</h3>
          <span className="h-px flex-1 bg-hair" />
          <span className="text-[.72rem] text-soft">كل مربّعٍ مقال · ثلاث شارات لأصواته · المكتمل يتوهّج</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
          {rows.map((r) => {
            const full = r.f && r.no && r.d
            return (
              <div key={r.slug} title={r.title}
                className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-canvas ${full ? 'border-accent/50' : 'border-hair'}`}
                style={full ? { boxShadow: `0 0 0 1px ${D}33` } : undefined}>
                <span className="text-[.62rem] font-semibold tabular-nums text-soft">{r.n}</span>
                <span className="flex gap-[3px]">
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: r.f ? F : 'var(--c-wash, #e5e5e5)' }} />
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: r.no ? N : 'var(--c-wash, #e5e5e5)' }} />
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: r.d ? D : 'var(--c-wash, #e5e5e5)' }} />
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[.72rem] leading-relaxed text-soft">
        تُحدَّث اللوحة مع كل نشرٍ للموقع. المُنجَز اليوم: <b className="text-ink">{anyRead}</b> مقالاً له تلاوة · الهدف: <b className="text-ink">{T}</b> مقالاً بالأصوات الثلاثة.
      </p>
    </div>
  )
}
