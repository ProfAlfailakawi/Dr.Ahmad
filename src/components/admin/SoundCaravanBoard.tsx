import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth'
import { getDb } from '../../lib/firebase'
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
type CloudInventory = {
  fahed?: number
  noura?: number
  dialogue?: number
  totalAudioFiles?: number
  articleCount?: number
  source?: string
  scanComplete?: boolean
  lastAttemptComplete?: boolean
  scanMethod?: string
  scanMessage?: string
  unknownObjects?: number
  bySlug?: Record<string, Voice>
  lastAttemptAt?: unknown
  lastSyncAt?: unknown
}
type SyncState = 'idle' | 'checking' | 'queued' | 'error'

const FAHED = '#2E7D8A'
const NOURA = '#6B5A8E'
const DIALOGUE = '#C2913C'
const exists = (value: unknown) => value === true || (typeof value === 'string' && Boolean(value.trim()))
const AUTO_SYNC_COOLDOWN_MS = 8 * 60 * 1000
const INVENTORY_STALE_MS = 20 * 60 * 1000
const AUTO_SYNC_KEY = 'dr-ahmad-audio-auto-sync-request-v2'

const timestampMs = (value: unknown) => {
  if (!value) return 0
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime()
  }
  if (typeof value === 'object' && value && 'seconds' in value) {
    return Number(value.seconds || 0) * 1000
  }
  const parsed = new Date(String(value)).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

const timeLabel = (value: unknown) => {
  const millis = timestampMs(value)
  if (!millis) return 'لم يكتمل بعد'
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(millis))
}

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
  const { user } = useAdminAuth()
  const snapshot = audio as Record<string, Voice>
  const [detail, setDetail] = useState<DetailSelection | null>(null)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [cloudInventory, setCloudInventory] = useState<CloudInventory | null>(null)
  const [inventoryLoaded, setInventoryLoaded] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncNotice, setSyncNotice] = useState('')
  const [clock, setClock] = useState(() => Date.now())
  const syncBusy = useRef(false)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    ;(async () => {
      const db = await getDb()
      if (!db || !active) {
        if (active) setInventoryLoaded(true)
        return
      }
      const { doc, onSnapshot } = await import('firebase/firestore')
      unsubscribe = onSnapshot(
        doc(db, 'site_settings', 'audio_inventory'),
        (inventorySnapshot) => {
          if (!active) return
          setCloudInventory(inventorySnapshot.exists() ? inventorySnapshot.data() as CloudInventory : null)
          setInventoryLoaded(true)
        },
        () => {
          if (active) setInventoryLoaded(true)
        },
      )
    })().catch(() => {
      if (active) setInventoryLoaded(true)
    })
    return () => { active = false; unsubscribe() }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const requestCloudSync = useCallback(async (automatic = false) => {
    if (!user || syncBusy.current) return
    if (automatic) {
      const lastRequest = Number(window.localStorage.getItem(AUTO_SYNC_KEY) || 0)
      if (Date.now() - lastRequest < AUTO_SYNC_COOLDOWN_MS) return
    }
    syncBusy.current = true
    setSyncState('checking')
    setSyncNotice(automatic ? 'اكتُشف تأخر في الجرد؛ جارٍ تشغيل المصالحة تلقائياً…' : 'جارٍ طلب جرد R2 الآن…')
    window.localStorage.setItem(AUTO_SYNC_KEY, String(Date.now()))
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/admin/control-center', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'audio-sync' }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(payload?.error || 'تعذّر تشغيل مصالحة الصوت.'))
      setSyncState('queued')
      setSyncNotice('بدأ جرد R2 الموقّع. ستتغير الأرقام هنا تلقائياً عند اكتماله من دون إعادة تحميل الصفحة.')
    } catch (error) {
      setSyncState('error')
      setSyncNotice(error instanceof Error ? error.message : 'تعذّر تشغيل مصالحة الصوت.')
    } finally {
      syncBusy.current = false
    }
  }, [user])

  const lastSyncMillis = timestampMs(cloudInventory?.lastSyncAt)
  const inventoryStale = !lastSyncMillis || clock - lastSyncMillis > INVENTORY_STALE_MS
  useEffect(() => {
    if (!inventoryLoaded || !user) return
    if (!cloudInventory?.scanComplete || cloudInventory.lastAttemptComplete === false || inventoryStale) {
      void requestCloudSync(true)
    }
  }, [clock, cloudInventory?.lastAttemptComplete, cloudInventory?.scanComplete, inventoryLoaded, inventoryStale, requestCloudSync, user])

  const authoritative = cloudInventory?.scanComplete === true && Boolean(cloudInventory.bySlug)
  const rows = useMemo(() => articles.map((article, index) => {
    const fallback = snapshot[article.slug] || {}
    const live = article.audio || {}
    const cloud = cloudInventory?.bySlug?.[article.slug] || {}
    const fahed = authoritative ? exists(cloud.fahed) : exists(live.fahed) || exists(fallback.fahed)
    const noura = authoritative ? exists(cloud.noura) : exists(live.noura) || exists(fallback.noura)
    const dialogue = authoritative ? exists(cloud.dialogue) : exists(live.dialogue) || exists(fallback.dialogue)
    return { n: index + 1, slug: article.slug, title: article.title || article.ar || article.slug, fahed, noura, dialogue }
  }), [articles, authoritative, cloudInventory?.bySlug, snapshot])

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
    <div className="grid gap-5" data-audio-self-healing-inventory="true">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">قافلة الصوت</h2>
          <p className="mt-1 text-sm text-soft">لكل مقال ثلاثة مسارات إنتاج ظاهرة للإدارة: فهد، نورة، والحوار — {done} من {target} مساراً جاهزاً ({overall}٪). كل رقم قابل للفتح لمعرفة المقالات التي وراءه.</p>
        </div>
        <button
          type="button"
          onClick={() => void requestCloudSync(false)}
          disabled={!user || syncState === 'checking'}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-hair bg-canvas px-4 text-[.72rem] font-bold text-accent transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          data-audio-manual-r2-sync="true"
        >
          {syncState === 'checking' ? 'جارٍ تشغيل الجرد…' : 'افحص R2 الآن'}
        </button>
      </header>

      <section className={`rounded-2xl border px-4 py-3 ${authoritative && !inventoryStale ? 'border-emerald-200 bg-emerald-50/55' : 'border-amber-200 bg-amber-50/60'}`} aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <strong className="text-[.76rem] text-ink">
            {authoritative ? 'الأرقام من جرد R2 المباشر' : 'اللوحة تعمل على آخر لقطة متاحة'}
          </strong>
          <span className="text-[.7rem] text-soft">آخر جرد صحيح: {timeLabel(cloudInventory?.lastSyncAt)}</span>
          {cloudInventory?.scanMethod && <span className="rounded-full bg-canvas/80 px-2 py-1 text-[.64rem] text-soft">{cloudInventory.scanMethod}</span>}
          {authoritative && Number(cloudInventory?.articleCount || 0) !== total && (
            <span className="text-[.68rem] font-semibold text-amber-800">اختلاف فهرس المقالات: R2 يعرف {Number(cloudInventory?.articleCount || 0)} والواجهة تعرض {total}</span>
          )}
        </div>
        <p className="mt-1 text-[.7rem] leading-5 text-soft">
          {syncNotice || (cloudInventory?.lastAttemptComplete === false
            ? `آخر محاولة لم تكتمل، فاحتفظ النظام بآخر عدّاد صحيح وسيعيد المحاولة تلقائياً. ${cloudInventory.scanMessage || ''}`
            : inventoryStale
              ? 'الجرد متأخر؛ ستشغّل اللوحة المصالحة تلقائياً عند دخول المشرف.'
              : 'أي دفعة صوت جديدة تظهر تلقائياً من Firestore فور انتهاء الجرد، بلا تعديل كود أو إعادة نشر.')}
        </p>
      </section>

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
        جرد R2 الموقّع هو مصدر الحقيقة للأرقام. إذا تأخر أو فشل فحص مؤقت، تحتفظ اللوحة بآخر نتيجة مكتملة وتطلب الإصلاح تلقائياً؛ لذلك لا تنخفض الأرقام بسبب 429 ولا تنتظر نشر الموقع التالي.
      </p>
    </div>
  )
}
