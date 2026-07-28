import { useMemo } from 'react'
import audio from '../../data/audio.json'

/*
 * قافلة الصوت — تقدّم حقيقي لا أسماء أصوات داخلية.
 * المقال له مساران يهمان الدكتور: «قراءة المقال» و«الحوار».
 * القراءة تُعد جاهزة إذا وُجد أي ملف قراءة متوافق (الجديد أو الموروث)،
 * والحالة الحية القادمة من Firestore تتقدّم على لقطة audio.json الثابتة.
 */
type Voice = { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
type Article = { slug: string; title?: string; ar?: string; audio?: Voice }

const READ = '#2E7D8A'
const DIALOGUE = '#C2913C'
const exists = (value: unknown) => value === true || (typeof value === 'string' && Boolean(value.trim()))

function Meter({ name, note, val, total, color }: { name: string; note: string; val: number; total: number; color: string }) {
  const pct = total ? Math.round((val / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-hair bg-canvas p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold text-ink">{name}</span>
        <span className="text-[.7rem] text-soft">{note}</span>
      </div>
      <div className="flex items-end gap-1 tabular-nums">
        <span className="text-3xl font-extrabold text-ink">{val}</span>
        <span className="pb-1 text-sm text-soft">/ {total}</span>
        <span className="mr-auto pb-1 text-sm font-semibold" style={{ color }}>{pct}٪</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-2 text-[.72rem] text-soft">{val === total ? 'اكتمل المسار' : `باقٍ ${Math.max(0, total - val)} مقالاً`}</div>
    </div>
  )
}

export function SoundCaravanBoard({ articles }: { articles: Article[] }) {
  const snapshot = audio as Record<string, Voice>
  const rows = useMemo(() => articles.map((article, index) => {
    const fallback = snapshot[article.slug] || {}
    const live = article.audio || {}
    const reading = exists(live.fahed) || exists(live.noura) || exists(fallback.fahed) || exists(fallback.noura)
    const dialogue = exists(live.dialogue) || exists(fallback.dialogue)
    return { n: index + 1, slug: article.slug, title: article.title || article.ar || article.slug, reading, dialogue }
  }), [articles, snapshot])

  const total = rows.length
  const reading = rows.filter((row) => row.reading).length
  const dialogue = rows.filter((row) => row.dialogue).length
  const done = reading + dialogue
  const target = total * 2
  const overall = target ? Math.round((done / target) * 100) : 0

  return (
    <div className="grid gap-5">
      <header>
        <h2 className="text-2xl font-extrabold text-ink">قافلة الصوت</h2>
        <p className="mt-1 text-sm text-soft">لكل مقال مساران واضحان: قراءة المقال والحوار — {done} من {target} مساراً جاهزاً ({overall}٪).</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Meter name="قراءة المقال" note="النسخة المنشورة" val={reading} total={total} color={READ} />
        <Meter name="الحوار" note="الحلقة الحوارية" val={dialogue} total={total} color={DIALOGUE} />
      </div>

      <div className="rounded-2xl border border-hair bg-canvas p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-soft">إجمالي المسارات الصوتية الجاهزة</span>
          <span className="text-xl font-extrabold tabular-nums text-ink">{done} <span className="text-sm font-normal text-soft">/ {target}</span></span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-wash">
          <div className="h-full transition-[width] duration-700" style={{ width: `${target ? (reading / target) * 100 : 0}%`, background: READ }} />
          <div className="h-full transition-[width] duration-700" style={{ width: `${target ? (dialogue / target) * 100 : 0}%`, background: DIALOGUE }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[.72rem] text-soft">
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: READ }} />قراءة المقال {reading}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DIALOGUE }} />الحوار {dialogue}</span>
          <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-soft/40" />{total - reading} مقالاً بلا قراءة بعد</span>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="whitespace-nowrap text-base font-bold text-ink">المتون الـ{total}</h3>
          <span className="h-px flex-1 bg-hair" />
          <span className="text-[.72rem] text-soft">كل مربع مقال · شارة للقراءة وشارة للحوار</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
          {rows.map((row) => {
            const full = row.reading && row.dialogue
            return (
              <div key={row.slug} title={row.title}
                className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-canvas ${full ? 'border-accent/50' : 'border-hair'}`}
                style={full ? { boxShadow: `0 0 0 1px ${DIALOGUE}33` } : undefined}>
                <span className="text-[.62rem] font-semibold tabular-nums text-soft">{row.n}</span>
                <span className="flex gap-[3px]">
                  <i className="h-[5px] w-[12px] rounded-sm" style={{ background: row.reading ? READ : 'var(--c-wash, #e5e5e5)' }} />
                  <i className="h-[5px] w-[12px] rounded-sm" style={{ background: row.dialogue ? DIALOGUE : 'var(--c-wash, #e5e5e5)' }} />
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[.72rem] leading-relaxed text-soft">
        الحالة الحية القادمة من لوحة المحتوى تتقدّم على لقطة البناء؛ لذلك يرتفع الرقم فور مزامنة R2 مع Firestore، ولا ينتظر نشر الموقع التالي.
      </p>
    </div>
  )
}
