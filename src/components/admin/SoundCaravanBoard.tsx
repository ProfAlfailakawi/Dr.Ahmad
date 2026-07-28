import { useMemo, useState } from 'react'
import audio from '../../data/audio.json'

/*
 * قافلة الصوت — لوحة إدارة صريحة. نعرض فهد ونورة والحوار كلٌّ على حدة،
 * بينما واجهة المقال العامة وحدها تخفي أسماء الأصوات وتقول «قراءة المقال».
 * الحالة الحية القادمة من Firestore تتقدّم على لقطة audio.json الثابتة.
 */
type Voice = { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
type Article = { slug: string; title?: string; ar?: string; audio?: Voice }
type Row = { n: number; slug: string; title: string; fahed: boolean; noura: boolean; dialogue: boolean }
type VoiceKey = 'fahed' | 'noura' | 'dialogue'
type DetailSelection = { voice: VoiceKey | 'all'; state: 'ready' | 'missing' }

const FAHED = '#2E7D8A'
const NOURA = '#6B5A8E'
const DIALOGUE = '#C2913C'
const exists = (value: unknown) => value === true || (typeof value === 'string' && Boolean(value.trim()))

const voiceMeta: Record<VoiceKey, { label: string; color: string }> = {
  fahed: { label: 'صوت فهد', color: FAHED },
  noura: { label: 'صوت نورة', color: NOURA },
  dialogue: { label: 'الحوار', color: DIALOGUE },
}

function Meter({
  name, note, val, total, color, onReady, onMissing,
}: {
  name: string
  note: string
  val: number
  total: number
  color: string
  onReady: () => void
  onMissing: () => void
}) {
  const pct = total ? Math.round((val / total) * 100) : 0
  const missing = Math.max(0, total - val)
  return (
    <div className="rounded-2xl border border-hair bg-canvas p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-lg font-bold text-ink">{name}</span>
        <span className="text-[.7rem] text-soft">{note}</span>
      </div>
      <div className="flex items-end gap-1 tabular-nums">
        <button
          type="button"
          onClick={onReady}
          className="group inline-flex min-h-11 items-end gap-1 rounded-lg text-right transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={`عرض المقالات الجاهزة في ${name}: ${val}`}
        >
          <span className="text-3xl font-extrabold text-ink transition-colors group-hover:text-accent">{val}</span>
          <span className="pb-1 text-sm text-soft">/ {total}</span>
        </button>
        <span className="mr-auto pb-1 text-sm font-semibold" style={{ color }}>{pct}٪</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-wash">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      {missing ? (
        <button
          type="button"
          onClick={onMissing}
          className="mt-1 min-h-9 text-[.72rem] text-soft transition-colors hover:text-accent"
          aria-label={`عرض المقالات المتبقية في ${name}: ${missing}`}
        >
          باقٍ {missing} مقالاً ← اعرضها
        </button>
      ) : <div className="mt-2 text-[.72rem] text-soft">اكتمل المسار</div>}
    </div>
  )
}

function DetailPanel({ selection, rows, onClose }: { selection: DetailSelection; rows: Row[]; onClose: () => void }) {
  const label = selection.voice === 'all' ? 'القافلة كلها' : voiceMeta[selection.voice].label
  const title = selection.state === 'ready' ? `${label} — الجاهز` : `${label} — المتبقي`
  return (
    <section className="overflow-hidden rounded-2xl border border-accent/25 bg-canvas" aria-live="polite">
      <div className="flex items-center justify-between gap-4 border-b border-hair px-4 py-3 sm:px-5">
        <div>
          <p className="text-[.68rem] font-semibold text-accent">تفاصيل قافلة الصوت</p>
          <h3 className="mt-0.5 text-sm font-bold text-ink">{title} · {rows.length}</h3>
        </div>
        <button type="button" onClick={onClose} className="min-h-10 min-w-10 rounded-full text-xl text-soft transition-colors hover:bg-wash hover:text-ink" aria-label="إغلاق تفاصيل القافلة">×</button>
      </div>
      <div className="max-h-[24rem] overflow-y-auto divide-y divide-hair">
        {rows.map((row) => (
          <a
            key={row.slug}
            href={`/articles/${row.slug}`}
            target="_blank"
            rel="noreferrer"
            className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-wash/55 sm:px-5"
          >
            <span className="text-[.68rem] tabular-nums text-soft">{row.n}</span>
            <span className="min-w-0 truncate text-[.78rem] font-semibold text-ink">{row.title}</span>
            <span className="flex items-center gap-1.5" aria-label={`فهد ${row.fahed ? 'جاهز' : 'غير جاهز'}، نورة ${row.noura ? 'جاهزة' : 'غير جاهزة'}، الحوار ${row.dialogue ? 'جاهز' : 'غير جاهز'}`}>
              <i className="h-2 w-2 rounded-full" style={{ background: row.fahed ? FAHED : 'var(--c-wash, #e5e5e5)' }} />
              <i className="h-2 w-2 rounded-full" style={{ background: row.noura ? NOURA : 'var(--c-wash, #e5e5e5)' }} />
              <i className="h-2 w-2 rounded-full" style={{ background: row.dialogue ? DIALOGUE : 'var(--c-wash, #e5e5e5)' }} />
              <span className="mr-1 text-[.7rem] text-accent">↗</span>
            </span>
          </a>
        ))}
        {!rows.length && <p className="px-5 py-8 text-center text-[.78rem] text-soft">لا توجد مقالات في هذه الحالة.</p>}
      </div>
    </section>
  )
}

function ArticlePreview({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border border-accent/25 bg-canvas shadow-[0_18px_45px_rgba(20,30,40,.07)]"
      aria-live="polite"
      data-caravan-article-preview="true"
    >
      <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[.68rem] font-semibold tracking-wide text-accent">المقال رقم {String(row.n).padStart(2, '0')}</p>
          <h3 className="mt-1 text-base font-extrabold leading-7 text-ink sm:text-lg">{row.title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-10 min-w-10 shrink-0 rounded-full text-xl text-soft transition-colors hover:bg-wash hover:text-ink"
          aria-label="إغلاق بطاقة المقال"
        >×</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-hair px-4 py-3 sm:px-5">
        {([
          ['fahed', 'فهد', row.fahed, FAHED],
          ['noura', 'نورة', row.noura, NOURA],
          ['dialogue', 'الحوار', row.dialogue, DIALOGUE],
        ] as const).map(([key, label, ready, color]) => (
          <span
            key={key}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-[.7rem] font-semibold ${ready ? 'border-accent/20 text-ink' : 'border-hair text-soft'}`}
            aria-label={`${label}: ${ready ? 'جاهز' : 'غير جاهز'}`}
          >
            <i className="h-2 w-2 rounded-full" style={{ background: ready ? color : 'var(--c-wash, #e5e5e5)' }} />
            {label} {ready ? 'جاهز' : 'غير جاهز'}
          </span>
        ))}
        <a
          href={`/articles/${row.slug}`}
          target="_blank"
          rel="noreferrer"
          className="mr-auto inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.78rem] font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          data-caravan-open-article="true"
        >
          فتح المقال ↗
        </a>
      </div>
    </section>
  )
}

export function SoundCaravanBoard({ articles }: { articles: Article[] }) {
  const snapshot = audio as Record<string, Voice>
  const [detail, setDetail] = useState<DetailSelection | null>(null)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const rows = useMemo(() => articles.map((article, index) => {
    const fallback = snapshot[article.slug] || {}
    const live = article.audio || {}
    const fahed = exists(live.fahed) || exists(fallback.fahed)
    const noura = exists(live.noura) || exists(fallback.noura)
    const dialogue = exists(live.dialogue) || exists(fallback.dialogue)
    return { n: index + 1, slug: article.slug, title: article.title || article.ar || article.slug, fahed, noura, dialogue }
  }), [articles, snapshot])

  const total = rows.length
  const fahed = rows.filter((row) => row.fahed).length
  const noura = rows.filter((row) => row.noura).length
  const dialogue = rows.filter((row) => row.dialogue).length
  const done = fahed + noura + dialogue
  const target = total * 3
  const overall = target ? Math.round((done / target) * 100) : 0

  const detailRows = useMemo(() => {
    if (!detail) return []
    const voice = detail.voice
    if (voice === 'all') return rows
    // ثبّت النوع قبل الدخول إلى callback حتى لا يعود TypeScript ليوسّعه إلى 'all' | VoiceKey.
    const voiceKey: VoiceKey = voice
    return rows.filter((row) => detail.state === 'ready' ? row[voiceKey] : !row[voiceKey])
  }, [detail, rows])

  return (
    <div className="grid gap-5">
      <header>
        <h2 className="text-2xl font-extrabold text-ink">قافلة الصوت</h2>
        <p className="mt-1 text-sm text-soft">لكل مقال ثلاثة مسارات إنتاج ظاهرة للإدارة: فهد، نورة، والحوار — {done} من {target} مساراً جاهزاً ({overall}٪). كل رقم قابل للفتح لمعرفة المقالات التي وراءه.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Meter name="صوت فهد" note="قراءة صوتية" val={fahed} total={total} color={FAHED} onReady={() => setDetail({ voice: 'fahed', state: 'ready' })} onMissing={() => setDetail({ voice: 'fahed', state: 'missing' })} />
        <Meter name="صوت نورة" note="قراءة صوتية" val={noura} total={total} color={NOURA} onReady={() => setDetail({ voice: 'noura', state: 'ready' })} onMissing={() => setDetail({ voice: 'noura', state: 'missing' })} />
        <Meter name="الحوار" note="الحلقة الحوارية" val={dialogue} total={total} color={DIALOGUE} onReady={() => setDetail({ voice: 'dialogue', state: 'ready' })} onMissing={() => setDetail({ voice: 'dialogue', state: 'missing' })} />
      </div>

      {detail && <DetailPanel selection={detail} rows={detailRows} onClose={() => setDetail(null)} />}

      <div className="rounded-2xl border border-hair bg-canvas p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-soft">إجمالي المسارات الصوتية الجاهزة</span>
          <button type="button" onClick={() => setDetail({ voice: 'all', state: 'ready' })} className="min-h-10 rounded-lg text-xl font-extrabold tabular-nums text-ink transition-colors hover:text-accent" aria-label="عرض كل مقالات القافلة">
            {done} <span className="text-sm font-normal text-soft">/ {target}</span>
          </button>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-wash">
          <div className="h-full transition-[width] duration-700" style={{ width: `${target ? (fahed / target) * 100 : 0}%`, background: FAHED }} />
          <div className="h-full transition-[width] duration-700" style={{ width: `${target ? (noura / target) * 100 : 0}%`, background: NOURA }} />
          <div className="h-full transition-[width] duration-700" style={{ width: `${target ? (dialogue / target) * 100 : 0}%`, background: DIALOGUE }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[.72rem] text-soft">
          <button type="button" onClick={() => setDetail({ voice: 'fahed', state: 'ready' })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-wash hover:text-accent"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FAHED }} />فهد {fahed}</button>
          <button type="button" onClick={() => setDetail({ voice: 'noura', state: 'ready' })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-wash hover:text-accent"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NOURA }} />نورة {noura}</button>
          <button type="button" onClick={() => setDetail({ voice: 'dialogue', state: 'ready' })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-wash hover:text-accent"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: DIALOGUE }} />الحوار {dialogue}</button>
          <button type="button" onClick={() => setDetail({ voice: 'noura', state: 'missing' })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-wash hover:text-accent"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-soft/40" />{total - noura} مقالاً بلا صوت نورة بعد</button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="whitespace-nowrap text-base font-bold text-ink">المتون الـ{total}</h3>
          <span className="h-px flex-1 bg-hair" />
          <span className="text-[.72rem] text-soft">اضغط الرقم لمعرفة المقال أولاً · فهد ثم نورة ثم الحوار</span>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
          {rows.map((row) => {
            const full = row.fahed && row.noura && row.dialogue
            return (
              <button
                key={row.slug}
                type="button"
                onClick={() => setSelectedRow(row)}
                title={`معرفة المقال رقم ${row.n}: ${row.title}`}
                aria-label={`معرفة المقال رقم ${row.n}: ${row.title}`}
                data-caravan-number={row.n}
                className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-canvas transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-accent/60 hover:bg-wash/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${selectedRow?.slug === row.slug ? 'border-accent ring-1 ring-accent/20' : full ? 'border-accent/50' : 'border-hair'}`}
                style={full ? { boxShadow: `0 0 0 1px ${DIALOGUE}33` } : undefined}
              >
                <span className="text-[.62rem] font-semibold tabular-nums text-soft">{row.n}</span>
                <span className="flex gap-[3px]">
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: row.fahed ? FAHED : 'var(--c-wash, #e5e5e5)' }} />
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: row.noura ? NOURA : 'var(--c-wash, #e5e5e5)' }} />
                  <i className="h-[5px] w-[9px] rounded-sm" style={{ background: row.dialogue ? DIALOGUE : 'var(--c-wash, #e5e5e5)' }} />
                </span>
              </button>
            )
          })}
        </div>
        {selectedRow && (
          <div className="mt-3">
            <ArticlePreview row={selectedRow} onClose={() => setSelectedRow(null)} />
          </div>
        )}
      </div>

      <p className="text-[.72rem] leading-relaxed text-soft">
        الحالة الحية القادمة من لوحة المحتوى تتقدّم على لقطة البناء؛ لذلك يرتفع الرقم فور مزامنة R2 مع Firestore، ولا ينتظر نشر الموقع التالي.
      </p>
    </div>
  )
}
