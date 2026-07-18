import { useEffect, useMemo, useState } from 'react'
import type { ArticleAudioControl, ArticleRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import { manageArticleAudio, type ArticleAudioAction, type ArticleAudioMode } from '../../lib/audio-management'

type AudioVoice = 'fahed' | 'noura' | 'dialogue'
type Filter = 'all' | 'ready' | 'working' | 'missing'
type PlayerState = { slug: string; mode: ArticleAudioMode; voice: AudioVoice } | null

type Props = {
  articles: ArticleRecord[]
  onChanged: () => Promise<unknown> | unknown
}

const audioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const audioUrl = (article: ArticleRecord, voice: AudioVoice) => {
  const stored = article.audio?.[voice]
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  const suffix = voice === 'fahed' ? '.mp3' : voice === 'noura' ? '.noura.mp3' : '.dialogue.mp3'
  return audioBase ? `${audioBase}/${article.slug}${suffix}` : `/audio/${article.slug}${suffix}`
}

const exists = (value: unknown) => value === true || (typeof value === 'string' && Boolean(value.trim()))
const inProgress = (status = '') => ['requested', 'queued', 'generating', 'clearing'].includes(status)

const statusLabel = (status = '', disabled = false, available = false) => {
  if (status === 'requested' || status === 'queued') return 'في قائمة التوليد'
  if (status === 'generating') return 'جارٍ التوليد'
  if (status === 'failed') return 'تعذّر آخر تشغيل'
  if (status === 'clearing') return 'جارٍ الحذف'
  if (status === 'cleared' || disabled) return 'محذوف وغير ظاهر'
  if (status === 'published' || available) return 'جاهز للسماع'
  return 'غير مولّد'
}

const statusClass = (status = '', disabled = false, available = false) => {
  if (status === 'failed') return 'text-red-700 dark:text-red-300'
  if (inProgress(status)) return 'text-accent'
  if (status === 'published' || (available && !disabled)) return 'text-ink'
  return 'text-soft'
}

const dateLabel = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(date)
}

const normalized = (value = '') => value
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .toLowerCase()
  .trim()

export function AudioLibrary({ articles, onChanged }: Props) {
  const { user } = useAdminAuth()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [player, setPlayer] = useState<PlayerState>(null)
  const [busyKey, setBusyKey] = useState('')
  const [listeningKey, setListeningKey] = useState('')
  const [notice, setNotice] = useState('')
  const [localControls, setLocalControls] = useState<Record<string, ArticleAudioControl>>({})

  const allArticles = useMemo(() => [...articles]
    .filter((article) => !article._cms.deleted)
    .sort((a, b) => String(b.iso || '').localeCompare(String(a.iso || ''))), [articles])

  const controlFor = (article: ArticleRecord): ArticleAudioControl => ({
    ...(article.audioControl || {}),
    ...(localControls[article.slug] || {}),
  })

  const stateFor = (article: ArticleRecord) => {
    const control = controlFor(article)
    const readingDisabled = Boolean(control.readingDisabled)
    const dialogueDisabled = Boolean(control.dialogueDisabled)
    const readingAvailable = !readingDisabled && (
      exists(article.audio?.fahed)
      || exists(article.audio?.noura)
      || control.readingStatus === 'published'
      || Boolean(article.hasAudio)
    )
    const dialogueAvailable = !dialogueDisabled && (
      exists(article.audio?.dialogue)
      || control.dialogueStatus === 'published'
    )
    const working = inProgress(control.readingStatus) || inProgress(control.dialogueStatus)
    return { control, readingDisabled, dialogueDisabled, readingAvailable, dialogueAvailable, working }
  }

  const filtered = useMemo(() => {
    const q = normalized(query)
    return allArticles.filter((article) => {
      const state = stateFor(article)
      const matchesQuery = !q || normalized(`${article.title} ${article.cat || ''} ${article.slug}`).includes(q)
      if (!matchesQuery) return false
      if (filter === 'ready') return state.readingAvailable || state.dialogueAvailable
      if (filter === 'working') return state.working
      if (filter === 'missing') return !state.readingAvailable && !state.dialogueAvailable && !state.working
      return true
    })
  // localControls intentionally changes the derived state of every row.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allArticles, filter, query, localControls])

  const totals = useMemo(() => allArticles.reduce((sum, article) => {
    const state = stateFor(article)
    if (state.readingAvailable || state.dialogueAvailable) sum.ready += 1
    if (state.working) sum.working += 1
    if (!state.readingAvailable && !state.dialogueAvailable && !state.working) sum.missing += 1
    return sum
  }, { ready: 0, working: 0, missing: 0 }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allArticles, localControls])

  useEffect(() => {
    if (!totals.working) return
    const timer = window.setInterval(() => { void onChanged() }, 12_000)
    return () => window.clearInterval(timer)
  }, [onChanged, totals.working])

  const chooseReadingVoice = async (article: ArticleRecord): Promise<AudioVoice | null> => {
    if (exists(article.audio?.fahed)) return 'fahed'
    if (exists(article.audio?.noura)) return 'noura'
    const candidates: AudioVoice[] = ['fahed', 'noura']
    for (const voice of candidates) {
      try {
        let response = await fetch(audioUrl(article, voice), { method: 'HEAD', cache: 'no-store' })
        if (response.status === 405) response = await fetch(audioUrl(article, voice), { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
        const type = (response.headers.get('content-type') || '').toLowerCase()
        if (response.ok && !type.includes('text/html')) return voice
      } catch { /* جرّب الصوت التالي */ }
    }
    return null
  }

  const listen = async (article: ArticleRecord, mode: ArticleAudioMode) => {
    const key = `${article.slug}:${mode}`
    if (player?.slug === article.slug && player.mode === mode) {
      setPlayer(null)
      return
    }
    setListeningKey(key)
    setNotice('')
    try {
      const voice: AudioVoice | null = mode === 'dialogue' ? 'dialogue' : await chooseReadingVoice(article)
      if (!voice) {
        setNotice(`لم أجد ملف قراءة جاهزاً لمقال «${article.title}». حدّث الحالة أو أعد التوليد.`)
        return
      }
      setPlayer({ slug: article.slug, mode, voice })
    } finally {
      setListeningKey('')
    }
  }

  const run = async (article: ArticleRecord, mode: ArticleAudioMode, action: ArticleAudioAction) => {
    const label = mode === 'reading' ? 'القراءة العادية' : 'الحوار'
    const confirmation = action === 'clear'
      ? `سيُحذف ${label} المنشور لمقال «${article.title}». ${mode === 'dialogue' ? 'ستبقى مسودة الحوار محفوظة.' : 'سيُحذف صوتا فهد ونورة.'} هل تتابع؟`
      : `استمعت إلى النسخة الحالية إن احتجت. الآن ستُحذف ${label} القديمة ويبدأ توليد نسخة جديدة لمقال «${article.title}». هل تتابع؟`
    if (!window.confirm(confirmation)) return

    const key = `${article.slug}:${mode}:${action}`
    setBusyKey(key)
    setNotice('')
    setPlayer((current) => current?.slug === article.slug && current.mode === mode ? null : current)
    try {
      const result = await manageArticleAudio({ user, slug: article.slug, mode, action })
      const statusKey = `${mode}Status` as 'readingStatus' | 'dialogueStatus'
      const disabledKey = `${mode}Disabled` as 'readingDisabled' | 'dialogueDisabled'
      const updatedKey = `${mode}UpdatedAt` as 'readingUpdatedAt' | 'dialogueUpdatedAt'
      setLocalControls((current) => ({
        ...current,
        [article.slug]: {
          ...(current[article.slug] || {}),
          [disabledKey]: true,
          [statusKey]: action === 'clear' ? 'clearing' : 'requested',
          [updatedKey]: new Date().toISOString(),
        },
      }))
      setNotice(result.message || (action === 'clear'
        ? `بدأ حذف ${label} لمقال «${article.title}».`
        : `أُرسل «${article.title}» إلى قائمة إعادة توليد ${label}.`))
      await onChanged()
      window.setTimeout(() => {
        setLocalControls((current) => {
          if (!current[article.slug]) return current
          const next = { ...current }
          delete next[article.slug]
          return next
        })
      }, 500)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر تنفيذ أمر الصوت.')
    } finally {
      setBusyKey('')
    }
  }

  const actionButtons = (article: ArticleRecord, mode: ArticleAudioMode) => {
    const state = stateFor(article)
    const control = state.control
    const available = mode === 'reading' ? state.readingAvailable : state.dialogueAvailable
    const disabled = mode === 'reading' ? state.readingDisabled : state.dialogueDisabled
    const status = mode === 'reading' ? control.readingStatus : control.dialogueStatus
    const working = inProgress(status)
    const rowBusy = busyKey.startsWith(`${article.slug}:${mode}:`)
    const listenBusy = listeningKey === `${article.slug}:${mode}`
    const canDelete = available || (!disabled && Boolean(status) && status !== 'cleared')

    return (
      <div className="mt-2 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 text-[.76rem]">
        <button
          type="button"
          disabled={!available || working || rowBusy || listenBusy}
          onClick={() => void listen(article, mode)}
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent transition-colors hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-35"
        >
          <span aria-hidden className="text-[.68rem]">▶</span>
          {listenBusy ? 'أتحقق…' : player?.slug === article.slug && player.mode === mode ? 'إغلاق السماع' : 'سماع'}
        </button>
        <button
          type="button"
          disabled={working || Boolean(busyKey)}
          onClick={() => void run(article, mode, 'regenerate')}
          className="min-h-11 font-semibold text-ink transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busyKey === `${article.slug}:${mode}:regenerate` ? 'جارٍ الإرسال…' : 'إعادة توليد'}
        </button>
        <button
          type="button"
          disabled={!canDelete || working || Boolean(busyKey)}
          onClick={() => void run(article, mode, 'clear')}
          className="min-h-11 font-medium text-red-700/75 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-red-300/80"
        >
          {busyKey === `${article.slug}:${mode}:clear` ? 'جارٍ الحذف…' : 'حذف'}
        </button>
      </div>
    )
  }

  const playerFor = (article: ArticleRecord) => {
    if (!player || player.slug !== article.slug) return null
    const state = stateFor(article)
    const canFahed = !state.readingDisabled && (exists(article.audio?.fahed) || state.control.readingStatus === 'published' || article.hasAudio)
    const canNoura = !state.readingDisabled && (exists(article.audio?.noura) || state.control.readingStatus === 'published' || article.hasAudio)
    const label = player.voice === 'dialogue' ? 'الحلقة الحوارية' : player.voice === 'noura' ? 'قراءة نورة' : 'قراءة فهد'
    return (
      <div className="col-span-full border-t border-hair pt-4" aria-live="polite">
        <div className="grid min-w-0 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[.72rem] font-semibold text-soft">{label}</span>
            {player.mode === 'reading' && canFahed && canNoura && (
              <div className="flex items-center gap-1 border-r border-hair pr-2">
                <button type="button" onClick={() => setPlayer({ ...player, voice: 'fahed' })} className={`min-h-10 px-2 text-[.72rem] font-semibold ${player.voice === 'fahed' ? 'text-accent' : 'text-soft hover:text-accent'}`}>فهد</button>
                <button type="button" onClick={() => setPlayer({ ...player, voice: 'noura' })} className={`min-h-10 px-2 text-[.72rem] font-semibold ${player.voice === 'noura' ? 'text-accent' : 'text-soft hover:text-accent'}`}>نورة</button>
              </div>
            )}
          </div>
          <audio
            key={`${article.slug}:${player.voice}`}
            className="h-10 w-full min-w-0"
            controls
            autoPlay
            preload="metadata"
            src={audioUrl(article, player.voice)}
            onError={() => setNotice(`تعذّر فتح ${label} لمقال «${article.title}». قد يكون الملف قيد النشر؛ حدّث الحالة بعد قليل.`)}
          >
            متصفحك لا يدعم تشغيل الصوت.
          </audio>
        </div>
      </div>
    )
  }

  return (
    <section className="min-w-0" aria-labelledby="audio-library-title">
      <div className="mb-7 grid gap-4 border-b border-hair pb-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-[.76rem] font-semibold text-accent">الصوت والبودكاست</p>
          <h2 id="audio-library-title" className="mt-1 font-display text-3xl font-bold text-ink">مكتبة الصوت</h2>
          <p className="mt-3 max-w-3xl text-[.84rem] leading-loose text-soft">
            اسمع النسخة الموجودة أولاً، ثم قرّر إعادة توليدها أو حذفها. جميع المقالات هنا؛ لا حاجة إلى فتح صفحة المقال أو محرّره.
          </p>
        </div>
        <button type="button" onClick={() => void onChanged()} className="min-h-11 justify-self-start text-[.76rem] font-semibold text-soft transition-colors hover:text-accent md:justify-self-end">تحديث الحالات</button>
      </div>

      <div className="mb-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-center">
        <label className="min-w-0">
          <span className="sr-only">ابحث عن مقال</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم المقال أو التصنيف…"
            className="min-h-11 w-full rounded-xl border border-hair bg-canvas px-4 text-[.84rem] text-ink outline-none transition-colors placeholder:text-soft/65 focus:border-accent"
          />
        </label>
        <div className="rail flex min-w-0 gap-1 overflow-x-auto pb-1">
          {([
            ['all', `الكل ${allArticles.length}`],
            ['ready', `جاهز ${totals.ready}`],
            ['working', `قيد التنفيذ ${totals.working}`],
            ['missing', `بلا صوت ${totals.missing}`],
          ] as [Filter, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`min-h-11 shrink-0 px-3 text-[.74rem] font-semibold transition-colors ${filter === key ? 'border-b-2 border-accent text-ink' : 'text-soft hover:text-accent'}`}>{label}</button>
          ))}
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-4 border-y border-hair py-3 text-[.78rem] leading-relaxed text-accent" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="min-h-9 shrink-0 text-soft hover:text-ink" aria-label="إغلاق التنبيه">×</button>
        </div>
      )}

      <div className="hidden border-b border-hair px-3 pb-2 text-[.7rem] font-semibold text-soft lg:grid lg:grid-cols-[minmax(260px,1.45fr)_minmax(280px,1fr)_minmax(260px,1fr)] lg:gap-6">
        <span>المقال</span><span>القراءة العادية</span><span>الحوار</span>
      </div>

      <div className="divide-y divide-hair border-b border-hair">
        {filtered.map((article) => {
          const state = stateFor(article)
          const readingStatus = state.control.readingStatus || ''
          const dialogueStatus = state.control.dialogueStatus || ''
          const readingDate = dateLabel(state.control.readingUpdatedAt)
          const dialogueDate = dateLabel(state.control.dialogueUpdatedAt)
          return (
            <article key={article.slug} className="grid min-w-0 gap-5 px-1 py-5 sm:px-3 lg:grid-cols-[minmax(260px,1.45fr)_minmax(280px,1fr)_minmax(260px,1fr)] lg:gap-6">
              <div className="min-w-0">
                <p className="line-clamp-2 text-[.9rem] font-semibold leading-relaxed text-ink">{article.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[.7rem] text-soft">
                  {article.cat && <span>{article.cat}</span>}
                  {article.iso && <span dir="ltr">{article.iso}</span>}
                  {article._cms.hidden && <span>مخفي</span>}
                </div>
                <a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-[.72rem] text-soft transition-colors hover:text-accent">فتح المقال ↗</a>
              </div>

              <div className="min-w-0 border-t border-hair pt-4 lg:border-0 lg:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[.78rem] font-semibold text-ink">القراءة</p>
                  <span className={`text-[.7rem] ${statusClass(readingStatus, state.readingDisabled, state.readingAvailable)}`}>{statusLabel(readingStatus, state.readingDisabled, state.readingAvailable)}</span>
                </div>
                {readingDate && <p className="mt-1 text-[.66rem] text-soft">آخر تحديث: {readingDate}</p>}
                {actionButtons(article, 'reading')}
              </div>

              <div className="min-w-0 border-t border-hair pt-4 lg:border-0 lg:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[.78rem] font-semibold text-ink">الحوار</p>
                  <span className={`text-[.7rem] ${statusClass(dialogueStatus, state.dialogueDisabled, state.dialogueAvailable)}`}>{statusLabel(dialogueStatus, state.dialogueDisabled, state.dialogueAvailable)}</span>
                </div>
                {dialogueDate && <p className="mt-1 text-[.66rem] text-soft">آخر تحديث: {dialogueDate}</p>}
                {actionButtons(article, 'dialogue')}
              </div>

              {playerFor(article)}
            </article>
          )
        })}
        {!filtered.length && <p className="py-16 text-center text-[.84rem] text-soft">لا توجد مقالات تطابق هذا البحث.</p>}
      </div>
    </section>
  )
}
