import { useEffect, useMemo, useState } from 'react'
import type { ArticleAudioControl, ArticleRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import { manageArticleAudio, type ArticleAudioAction, type ArticleAudioMode } from '../../lib/audio-management'
import supervisorSnapshot from '../../data/audio-supervisor.json'
import { Pagination, usePagedList } from '../Pagination'
import { categoryLabel } from '../../lib/content-taxonomy'

type Filter = 'all' | 'ready' | 'working' | 'missing'
type PlayerState = { slug: string; voice: ArticleAudioMode } | null

type Props = {
  articles: ArticleRecord[]
  onChanged: () => Promise<unknown> | unknown
}

type VoiceDefinition = {
  key: ArticleAudioMode
  title: string
  shortTitle: string
  description: string
}

const voices: VoiceDefinition[] = [
  { key: 'reading', title: 'قراءة المقال', shortTitle: 'القراءة', description: 'القراءة الصوتية المنشورة للمقال' },
  { key: 'dialogue', title: 'الحوار', shortTitle: 'الحوار', description: 'الحلقة الحوارية الكاملة' },
]

const audioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const audioUrl = (article: ArticleRecord, voice: ArticleAudioMode) => {
  if (voice === 'reading') {
    const noura = article.audio?.noura
    const fahed = article.audio?.fahed
    if (typeof noura === 'string' && noura.trim()) return noura.trim()
    if (typeof fahed === 'string' && fahed.trim()) return fahed.trim()
    const suffix = exists(noura) ? '.noura.mp3' : '.mp3'
    return audioBase ? `${audioBase}/${article.slug}${suffix}` : `/audio/${article.slug}${suffix}`
  }
  const stored = article.audio?.dialogue
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  return audioBase ? `${audioBase}/${article.slug}.dialogue.mp3` : `/audio/${article.slug}.dialogue.mp3`
}

const exists = (value: unknown) => value === true || (typeof value === 'string' && Boolean(value.trim()))
const inProgress = (status = '') => ['requested', 'queued', 'generating', 'clearing'].includes(status)

const statusLabel = (status = '', disabled = false, available = false) => {
  if (status === 'requested' || status === 'queued') return 'في قائمة التوليد'
  if (status === 'generating') return 'جارٍ التوليد'
  if (status === 'failed') return 'تعذّر آخر تشغيل'
  if (status === 'clearing') return 'جارٍ الحذف'
  if (status === 'cleared' || disabled) return 'محذوف وغير ظاهر'
  if (available) return 'جاهز للسماع'
  if (status === 'published') return 'لا يوجد ملف صوتي'
  return 'غير مولّد'
}

const statusClass = (status = '', disabled = false, available = false) => {
  if (status === 'failed') return 'text-red-700 dark:text-red-300'
  if (inProgress(status)) return 'text-accent'
  if (available && !disabled) return 'text-ink'
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

const supervisorUpdatedLabel = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

const normalized = (value = '') => value
  .normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .toLowerCase()
  .trim()

const disabledFor = (control: ArticleAudioControl, voice: ArticleAudioMode) => {
  if (voice === 'dialogue') return Boolean(control.dialogueDisabled)
  return Boolean(control.readingDisabled ?? control.fahedDisabled ?? control.nouraDisabled ?? false)
}

const statusFor = (control: ArticleAudioControl, voice: ArticleAudioMode) => {
  if (voice === 'dialogue') return control.dialogueStatus || ''
  return control.readingStatus || control.fahedStatus || control.nouraStatus || ''
}

const updatedFor = (control: ArticleAudioControl, voice: ArticleAudioMode) => {
  if (voice === 'dialogue') return control.dialogueUpdatedAt
  return control.readingUpdatedAt || control.fahedUpdatedAt || control.nouraUpdatedAt
}

const messageFor = (control: ArticleAudioControl, voice: ArticleAudioMode) => {
  if (voice === 'dialogue') return control.dialogueMessage || ''
  return control.readingMessage || control.fahedMessage || control.nouraMessage || ''
}

export function AudioLibrary({ articles, onChanged }: Props) {
  const { user } = useAdminAuth()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [player, setPlayer] = useState<PlayerState>(null)
  const [busyKey, setBusyKey] = useState('')
  const [notice, setNotice] = useState('')
  const [localControls, setLocalControls] = useState<Record<string, ArticleAudioControl>>({})

  const allArticles = useMemo(() => [...articles]
    .filter((article) => !article._cms.deleted)
    .sort((a, b) => String(b.iso || '').localeCompare(String(a.iso || ''))), [articles])

  const controlFor = (article: ArticleRecord): ArticleAudioControl => ({
    ...(article.audioControl || {}),
    ...(localControls[article.slug] || {}),
  })

  const voiceState = (article: ArticleRecord, voice: ArticleAudioMode) => {
    const control = controlFor(article)
    const disabled = disabledFor(control, voice)
    const status = statusFor(control, voice)
    // قراءة المقال مسار واحد في الواجهة مهما كان ملف الصوت المتوافق الذي يحملها.
    // هذا يحافظ على المكتبة القديمة من دون كشف أسماء الأصوات أو عدّ القراءة مرتين.
    const available = !disabled && (voice === 'reading'
      ? (exists(article.audio?.fahed) || exists(article.audio?.noura))
      : exists(article.audio?.dialogue))
    return {
      available,
      disabled,
      status,
      working: inProgress(status),
      updatedAt: updatedFor(control, voice),
      message: messageFor(control, voice),
    }
  }

  const articleState = (article: ArticleRecord) => {
    const states = voices.map(({ key }) => voiceState(article, key))
    return {
      ready: states.some((state) => state.available),
      working: states.some((state) => state.working),
      missing: states.every((state) => !state.available && !state.working),
    }
  }

  const filtered = useMemo(() => {
    const q = normalized(query)
    return allArticles.filter((article) => {
      const state = articleState(article)
      const matchesQuery = !q || normalized(`${article.title} ${article.cat || ''} ${article.slug}`).includes(q)
      if (!matchesQuery) return false
      if (filter === 'ready') return state.ready
      if (filter === 'working') return state.working
      if (filter === 'missing') return state.missing
      return true
    })
  // localControls intentionally changes the derived state of every row.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allArticles, filter, query, localControls])

  const paged = usePagedList(filtered, 20, `${filter}|${query}`)

  const totals = useMemo(() => {
    const result = {
      ready: 0,
      working: 0,
      missing: 0,
      voices: { reading: 0, dialogue: 0 } as Record<ArticleAudioMode, number>,
    }
    for (const article of allArticles) {
      const state = articleState(article)
      if (state.ready) result.ready += 1
      if (state.working) result.working += 1
      if (state.missing) result.missing += 1
      for (const { key } of voices) if (voiceState(article, key).available) result.voices[key] += 1
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allArticles, localControls])
  /* أرقام الواجهة تُشتق من ملفات الصوت المرتبطة بالمقالات التي يراها الدكتور
     الآن، لا من لقطة JSON قديمة قد تتأخر عن R2 عدة تشغيلات. */
  // قراءة المقال تُحسب مرة واحدة: أي ملف قراءة متوافق يكفي. الحوار مسار مستقل.
  const liveExpectedVoices = allArticles.length
  const liveNouraVoices = allArticles.reduce((sum, article) => sum + Number(exists(article.audio?.noura)), 0)
  const liveFahedVoices = allArticles.reduce((sum, article) => sum + Number(exists(article.audio?.fahed)), 0)
  const liveReadyVoices = allArticles.reduce((sum, article) => sum + Number(exists(article.audio?.fahed) || exists(article.audio?.noura)), 0)
  const liveRemainingVoices = Math.max(0, liveExpectedVoices - liveReadyVoices)
  const liveProgressPercent = Math.round((liveReadyVoices / Math.max(1, liveExpectedVoices)) * 1000) / 10
  const nextReadingTitle = allArticles.find((article) => !exists(article.audio?.fahed) && !exists(article.audio?.noura))?.title

  useEffect(() => {
    if (!totals.working) return
    const timer = window.setInterval(() => { void onChanged() }, 12_000)
    return () => window.clearInterval(timer)
  }, [onChanged, totals.working])

  const listen = (article: ArticleRecord, voice: ArticleAudioMode) => {
    if (player?.slug === article.slug && player.voice === voice) {
      setPlayer(null)
      return
    }
    setNotice('')
    setPlayer({ slug: article.slug, voice })
  }

  const run = async (article: ArticleRecord, voice: ArticleAudioMode, action: ArticleAudioAction) => {
    const definition = voices.find((item) => item.key === voice)!
    const detail = voice === 'dialogue'
      ? 'ستبقى مسودة الحوار محفوظة لإعادة التوليد لاحقاً.'
      : 'لن تتأثر الحلقة الحوارية.'
    const confirmation = action === 'clear'
      ? `سيُحذف ${definition.title} فقط من مقال «${article.title}». ${detail}\n\nهل تتابع؟`
      : `سيُلغى ${definition.title} الحالي فقط، ثم يبدأ توليد نسخة جديدة للمقال «${article.title}». ${detail}\n\nهل تتابع؟`
    if (!window.confirm(confirmation)) return

    const key = `${article.slug}:${voice}:${action}`
    setBusyKey(key)
    setNotice('')
    setPlayer((current) => current?.slug === article.slug && current.voice === voice ? null : current)
    try {
      const result = await manageArticleAudio({ user, slug: article.slug, mode: voice, action })
      const disabledKey = `${voice}Disabled` as 'readingDisabled' | 'dialogueDisabled'
      const statusKey = `${voice}Status` as 'readingStatus' | 'dialogueStatus'
      const updatedKey = `${voice}UpdatedAt` as 'readingUpdatedAt' | 'dialogueUpdatedAt'
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
        ? `بدأ حذف ${definition.title} فقط لمقال «${article.title}».`
        : `أُرسل ${definition.title} فقط إلى قائمة إعادة التوليد لمقال «${article.title}».`))
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

  const voiceCell = (article: ArticleRecord, definition: VoiceDefinition) => {
    const state = voiceState(article, definition.key)
    const date = dateLabel(state.updatedAt)
    const busyPrefix = `${article.slug}:${definition.key}:`
    const rowBusy = busyKey.startsWith(busyPrefix)
    const canDelete = state.available || (!state.disabled && Boolean(state.status) && state.status !== 'cleared')
    const isListening = player?.slug === article.slug && player.voice === definition.key

    return (
      <div className="min-w-0 border-t border-hair pt-4 lg:border-0 lg:pt-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[.78rem] font-semibold text-ink">{definition.title}</p>
            <p className="mt-0.5 text-[.66rem] text-soft">{definition.description}</p>
            {definition.key === 'reading' && <div className="mt-2 flex flex-wrap gap-1.5 text-[.58rem] font-semibold">
              <span className={`rounded-full px-2 py-1 ${exists(article.audio?.noura) ? 'bg-violet-100 text-violet-800' : 'bg-wash text-soft'}`}>نورة {exists(article.audio?.noura) ? 'جاهزة' : 'غير مولّدة'}</span>
              <span className={`rounded-full px-2 py-1 ${exists(article.audio?.fahed) ? 'bg-cyan-100 text-cyan-800' : 'bg-wash text-soft'}`}>فهد {exists(article.audio?.fahed) ? 'جاهز' : 'غير مولّد'}</span>
            </div>}
          </div>
          <span className={`text-[.68rem] ${statusClass(state.status, state.disabled, state.available)}`}>
            {statusLabel(state.status, state.disabled, state.available)}
          </span>
        </div>
        {date && <p className="mt-2 text-[.65rem] text-soft">آخر تحديث: {date}</p>}
        {state.message && <p className="mt-2 line-clamp-2 text-[.66rem] leading-relaxed text-soft">{state.message}</p>}
        <div className="mt-3 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 text-[.75rem]">
          <button
            type="button"
            disabled={!state.available || state.working || rowBusy}
            onClick={() => listen(article, definition.key)}
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent transition-colors hover:text-accent-deep disabled:cursor-not-allowed disabled:opacity-35"
          >
            <span aria-hidden className="text-[.66rem]">▶</span>
            {isListening ? 'إغلاق السماع' : 'سماع'}
          </button>
          <button
            type="button"
            disabled={state.working || Boolean(busyKey)}
            onClick={() => void run(article, definition.key, 'regenerate')}
            className="min-h-11 font-semibold text-ink transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busyKey === `${busyPrefix}regenerate` ? 'جارٍ الإرسال…' : 'إعادة توليد'}
          </button>
          <button
            type="button"
            disabled={!canDelete || state.working || Boolean(busyKey)}
            onClick={() => void run(article, definition.key, 'clear')}
            className="min-h-11 font-medium text-red-700/75 transition-colors hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:text-red-300/80"
          >
            {busyKey === `${busyPrefix}clear` ? 'جارٍ الحذف…' : 'حذف'}
          </button>
        </div>
      </div>
    )
  }

  const playerFor = (article: ArticleRecord) => {
    if (!player || player.slug !== article.slug) return null
    const definition = voices.find((item) => item.key === player.voice)!
    return (
      <div className="col-span-full border-t border-hair pt-4" aria-live="polite">
        <div className="grid min-w-0 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <span className="text-[.72rem] font-semibold text-soft">تستمع الآن: {definition.title}</span>
          <audio
            key={`${article.slug}:${player.voice}`}
            className="h-10 w-full min-w-0"
            controls
            autoPlay
            preload="metadata"
            src={audioUrl(article, player.voice)}
            onError={() => setNotice(`تعذّر فتح ${definition.title} لمقال «${article.title}». قد يكون الملف قيد النشر؛ حدّث الحالات بعد قليل.`)}
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
            كل مقال يحتفظ بقراءات فهد ونورة وبالحوار. في واجهة المقال العامة يظهر الاسم المحايد «قراءة المقال»، أما هنا فتظهر الأصوات الحقيقية وحالتها بالتفصيل.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[.7rem] text-soft">
            <span>نورة جاهزة: {liveNouraVoices}</span>
            <span>فهد جاهز: {liveFahedVoices}</span>
            <span>مقال لديه قراءة: {liveReadyVoices}</span>
            <span>حوار جاهز: {totals.voices.dialogue}</span>
          </div>
        </div>
        <button type="button" onClick={() => void onChanged()} className="min-h-11 justify-self-start text-[.76rem] font-semibold text-soft transition-colors hover:text-accent md:justify-self-end">تحديث الحالات</button>
      </div>

      <div className="mb-6 overflow-hidden rounded-[1.4rem] border border-hair bg-canvas/70">
        <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_5px_rgba(0,83,125,.08)]" aria-hidden="true" />
              <p className="text-[.72rem] font-bold text-ink">المشرف الحي للإنتاج</p>
              <span className="text-[.66rem] text-soft">آخر لقطة {supervisorUpdatedLabel(supervisorSnapshot.generatedAt)}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-[.78rem] leading-relaxed text-soft">
              {liveRemainingVoices
                ? <>قراءة المقال تستأنف من آخر نقطة تلقائياً. التالي: <strong className="font-semibold text-ink">{nextReadingTitle || 'أول مقال غير مكتمل في الطابور'}</strong></>
                : 'اكتملت قراءات المقالات الموثقة، وأي مقال جديد سيدخل تلقائياً. الحوار يبقى مساراً مستقلاً.'}
            </p>
          </div>
          <div className="flex items-center gap-4 sm:justify-end">
            <div className="text-center"><p className="font-display text-2xl font-bold text-ink">{liveProgressPercent}%</p><p className="text-[.62rem] text-soft">قراءة المقال</p></div>
            <div className="h-9 w-px bg-hair" aria-hidden="true" />
            <div className="text-center"><p className="font-display text-2xl font-bold text-ink">{liveRemainingVoices}</p><p className="text-[.62rem] text-soft">متبقٍ</p></div>
            {supervisorSnapshot.queue.failed > 0 && <><div className="h-9 w-px bg-hair" aria-hidden="true" /><div className="text-center"><p className="font-display text-2xl font-bold text-red-700 dark:text-red-300">{supervisorSnapshot.queue.failed}</p><p className="text-[.62rem] text-soft">يعاد إصلاحه</p></div></>}
          </div>
        </div>
        <div className="h-1 bg-hair" aria-hidden="true"><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(0, Math.min(100, liveProgressPercent))}%` }} /></div>
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
            ['ready', `لديه صوت ${totals.ready}`],
            ['working', `قيد التنفيذ ${totals.working}`],
            ['missing', `بلا أي صوت ${totals.missing}`],
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

      <div className="hidden border-b border-hair px-3 pb-2 text-[.7rem] font-semibold text-soft lg:grid lg:grid-cols-[minmax(230px,1.25fr)_repeat(2,minmax(215px,1fr))] lg:gap-5">
        <span>المقال</span><span>القراءات · نورة / فهد</span><span>الحوار</span>
      </div>

      <div id="audio-library-list" className="scroll-mt-28 divide-y divide-hair border-b border-hair">
        {paged.pageItems.map((article) => (
          <article key={article.slug} className="grid min-w-0 gap-5 px-1 py-5 sm:px-3 lg:grid-cols-[minmax(230px,1.25fr)_repeat(2,minmax(215px,1fr))] lg:gap-5">
            <div className="min-w-0">
              <p className="line-clamp-2 text-[.9rem] font-semibold leading-relaxed text-ink">{article.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[.7rem] text-soft">
                {article.cat && <span>{categoryLabel(article.cat)}</span>}
                {article.iso && <span dir="ltr">{article.iso}</span>}
                {article._cms.hidden && <span>مخفي</span>}
              </div>
              <a href={`/articles/${article.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center text-[.72rem] text-soft transition-colors hover:text-accent">فتح المقال ↗</a>
            </div>

            {voices.map((definition) => <div key={definition.key}>{voiceCell(article, definition)}</div>)}
            {playerFor(article)}
          </article>
        ))}
        {!filtered.length && <p className="py-16 text-center text-[.84rem] text-soft">لا توجد مقالات تطابق هذا البحث.</p>}
      </div>
      <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filtered.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="audio-library-list" label="صفحات مكتبة الصوت" className="mt-7" />
    </section>
  )
}
