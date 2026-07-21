import { useEffect, useMemo, useState } from 'react'
import podcastAdmin from '../../data/podcast-admin.json'
import { getDb } from '../../lib/firebase'
import { loadArticleBodies } from '../../lib/article-bodies'
import type { ArticleRecord, BookRecord, PaperRecord } from '../../lib/cms'
import type { AdminTab } from './AdminArchitecture'
import { fingerprintDialogue } from '../../lib/podcast-dialogue-lock'
import { dispatchPodcastGeneration } from '../../lib/podcast-generation'
import { useAdminAuth } from '../../lib/admin-auth'
import { Pagination, usePagedList } from '../Pagination'

const card = 'min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const pill = 'min-w-0 rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.74rem] font-semibold leading-tight text-soft'

type Stage = 'draft' | 'queued' | 'generating' | 'pronunciation' | 'needs_review' | 'passed' | 'published'

/* تقرير الفاحص الشامل: كل رابط في الموقع، بحالته وسببه ومكانه واقتراح علاجه */
type SourcePlace = { kind?: string; title?: string; slug?: string; where?: string }
type SourceIssue = { url: string; state: string; status?: number; note?: string; advice?: string; owned?: boolean; replacement?: string; action?: string; places?: SourcePlace[] }
type SourceReport = { checkedAt?: string; total?: number; places?: number; ok?: number; problems?: number; warnings?: number; items?: SourceIssue[] }
const sourceStateLabel: Record<string, string> = {
  dead: 'ميت', unreachable: 'النطاق لا يستجيب', suspect: 'استجابة غريبة',
  blocked: 'يحجب الفحص', throttled: 'حدّ الطلبات', server: 'عطل مؤقت', timeout: 'بطيء جداً',
  'host-blocked': 'النطاق محجوب عنّا',
}
type ProductionState = { status?: Stage; updatedAt?: unknown; note?: string; expectedDialogueContentSha256?: string }
type Episode = {
  slug: string
  title: string
  status?: string
  statusLabel?: string
  failure?: { utteranceId?: string; reason?: string } | null
  progress?: { done: number; total: number } | null
  hasTranscript?: boolean
  audio?: string
  listen?: string
  quality?: { score?: number; pass?: boolean; pronunciation?: string; issues?: string[] }
}

const stages: { key: Stage; label: string }[] = [
  { key: 'draft', label: 'مسودة' },
  { key: 'queued', label: 'في قائمة الانتظار' },
  { key: 'generating', label: 'جارٍ التوليد' },
  { key: 'pronunciation', label: 'فحص النطق' },
  { key: 'needs_review', label: 'يحتاج مراجعة' },
  { key: 'passed', label: 'مجتاز' },
  { key: 'published', label: 'منشور' },
]

const generatedEpisodes = (podcastAdmin as { episodes?: Episode[] }).episodes || []
const stageFromEpisode = (episode?: Episode): Stage => {
  if (!episode) return 'draft'
  if (episode.status === 'published') return 'published'
  if (episode.status === 'passed') return 'passed'
  if (episode.status === 'failed') return 'needs_review'
  if (episode.status === 'generating') return 'generating'
  if (episode.quality?.pass) return 'passed'
  if (episode.status === 'under_review' || episode.quality?.issues?.length) return 'needs_review'
  if (episode.audio && !episode.hasTranscript) return 'pronunciation'
  if (episode.audio) return 'generating'
  return 'draft'
}

function StageRail({ active }: { active: Stage }) {
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.key === active))
  return (
    <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2" aria-label="مراحل إنتاج الحلقة">
      {stages.map((stage, index) => (
        <span
          key={stage.key}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[.7rem] font-semibold ${index === activeIndex ? 'border-accent bg-accent text-white' : index < activeIndex ? 'border-accent/25 bg-accent/[.06] text-accent' : 'border-hair bg-canvas text-soft'}`}
        >
          {stage.label}
        </span>
      ))}
    </div>
  )
}

const focusManualDialogue = (slug: string, onOpen: (tab: AdminTab) => void) => {
  try { localStorage.setItem('podcast:focus-slug', slug) } catch { /* noop */ }
  onOpen('manual-dialogue')
}

export function ProductionHealthCenter({
  articles,
  books,
  papers,
  onOpen,
  view = 'production',
}: {
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  onOpen: (tab: AdminTab) => void
  view?: 'production' | 'health'
}) {
  const { user } = useAdminAuth()
  const [remote, setRemote] = useState<Record<string, ProductionState>>({})
  const [draftSlugs, setDraftSlugs] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { collection, getDocs } = await import('firebase/firestore')
        const [states, drafts] = await Promise.all([
          getDocs(collection(db, 'podcast_production')).catch(() => null),
          getDocs(collection(db, 'podcast_dialogues')).catch(() => null),
        ])
        if (!active) return
        setRemote(Object.fromEntries((states?.docs || []).map((document) => [document.id, document.data() as ProductionState])))
        setDraftSlugs(new Set((drafts?.docs || []).map((document) => document.id)))
      } catch { /* العرض المحلي يبقى صالحاً */ }
    })()
    return () => { active = false }
  }, [])

  const episodeRows = useMemo(() => {
    const bySlug = new Map(generatedEpisodes.map((episode) => [episode.slug, episode]))
    const candidates = articles.filter((article) => {
      const audio = article.audio as { dialogue?: boolean | string } | undefined
      return bySlug.has(article.slug) || draftSlugs.has(article.slug) || Boolean(audio?.dialogue)
    })
    const base = candidates.length ? candidates : articles.slice(0, 4)
    return base.slice(0, 8).map((article) => {
      const episode = bySlug.get(article.slug)
      const machine = stageFromEpisode(episode)
      const remoteStatus = remote[article.slug]?.status
      // الحالة الآلية أصدق من الأزرار: «منشور» لا يظهر إلا إذا أثبتته المنظومة (R2 + RSS)،
      // وأزرار البشر تقود المراحل البشرية فقط (الانتظار/المراجعة).
      let status: Stage = machine
      if (remoteStatus === 'queued' && machine === 'draft') status = 'queued'
      else if (remoteStatus === 'needs_review' && machine !== 'generating' && machine !== 'published') status = 'needs_review'
      return { article, episode, status }
    })
  }, [articles, draftSlugs, remote])

  /* فحص المصادر عند الطلب: نفس فاحص الأحد الأسبوعي، يبدأ الآن بضغطة. */
  const [sourcesBusy, setSourcesBusy] = useState(false)
  const [sourcesNotice, setSourcesNotice] = useState('')
  const [sourceReport, setSourceReport] = useState<SourceReport | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      const db = await getDb()
      if (!db || !active) return
      const { doc, onSnapshot } = await import('firebase/firestore')
      const stop = onSnapshot(doc(db, 'site_health', 'sources'), (snapshot) => {
        if (active && snapshot.exists()) setSourceReport(snapshot.data() as SourceReport)
      }, () => undefined)
      if (!active) stop()
    })()
    return () => { active = false }
  }, [])
  const checkSourcesNow = async () => {
    setSourcesBusy(true); setSourcesNotice('')
    try {
      if (!user) throw new Error('انتهت جلسة المشرف؛ سجّل الدخول من جديد.')
      const token = await user.getIdToken(true)
      const response = await fetch('/api/admin/sources/check', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(payload.detail || payload.error || 'تعذّر بدء الفحص'))
      setSourcesNotice(String(payload.message || 'بدأ فحص المصادر الآن.'))
    } catch (error) {
      setSourcesNotice(error instanceof Error ? error.message : 'تعذّر بدء الفحص.')
    } finally {
      setSourcesBusy(false)
    }
  }

  const ownedSourceItems = (sourceReport?.items || []).filter((item) => item.owned)
  const externalSourceItems = (sourceReport?.items || []).filter((item) => !item.owned)
  const ownedSourcePages = usePagedList(ownedSourceItems, 8, `${sourceReport?.checkedAt || ''}|${ownedSourceItems.length}`)
  const externalSourcePages = usePagedList(externalSourceItems, 8, `${sourceReport?.checkedAt || ''}|${externalSourceItems.length}`)

  const setStatus = async (slug: string, status: Stage) => {
    setBusy(slug); setMessage('')
    try {
      const db = await getDb()
      if (!db) throw new Error('قاعدة البيانات غير متاحة')
      const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const productionRef = doc(db, 'podcast_production', slug)
      let payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() }
      if (status === 'queued') {
        const dialogueRef = doc(db, 'podcast_dialogues', slug)
        const dialogueSnapshot = await getDoc(dialogueRef)
        if (!dialogueSnapshot.exists()) throw new Error('ارفع الحوار واحفظه من محرر الحوار أولاً')
        const dialogue = dialogueSnapshot.data()
        const proof = await fingerprintDialogue(dialogue.turns || [])
        if (dialogue.source !== 'admin-upload'
          || Number(dialogue.schemaVersion) !== 2
          || dialogue.contentSha256 !== proof.contentSha256
          || dialogue.revisionSha256 !== proof.revisionSha256
          || dialogue.revisionId !== proof.revisionId
          || Number(dialogue.turnCount) !== proof.turnCount) {
          throw new Error('نسخة الحوار غير مقفولة بالبصمة الجديدة؛ افتح محرر الحوار واضغط حفظ وإرسال')
        }
        payload = {
          ...payload,
          sourceCollection: 'podcast_dialogues',
          expectedDialogueContentSha256: proof.contentSha256,
          expectedDialogueRevisionSha256: proof.revisionSha256,
          expectedDialogueRevisionId: proof.revisionId,
          expectedTurnCount: proof.turnCount,
          queuedAt: serverTimestamp(),
          note: 'الحوار اليدوي مقفول بالبصمة؛ ممنوع استخدام المقال أو نسخة أخرى.',
        }
      }
      await setDoc(productionRef, payload, { merge: true })
      const readBack = await getDoc(productionRef)
      const readBackData = readBack.data() || {}
      if (!readBack.exists() || readBackData.status !== status) throw new Error('لم تثبت القراءة الراجعة لقرار الإنتاج')
      if (status === 'queued' && (
        readBackData.sourceCollection !== 'podcast_dialogues'
        || readBackData.expectedDialogueContentSha256 !== payload.expectedDialogueContentSha256
        || readBackData.expectedDialogueRevisionSha256 !== payload.expectedDialogueRevisionSha256
        || readBackData.expectedDialogueRevisionId !== payload.expectedDialogueRevisionId
        || Number(readBackData.expectedTurnCount) !== Number(payload.expectedTurnCount)
      )) throw new Error('لم تتطابق بصمات الحوار في القراءة الراجعة لقائمة الإنتاج')
      setRemote((current) => ({ ...current, [slug]: { ...current[slug], status,
        expectedDialogueContentSha256: String(readBackData.expectedDialogueContentSha256 || '') } }))
      if (status === 'queued') {
        const dispatch = await dispatchPodcastGeneration({
          user,
          slug,
          proof: {
            contentSha256: String(readBackData.expectedDialogueContentSha256 || ''),
            revisionSha256: String(readBackData.expectedDialogueRevisionSha256 || ''),
            revisionId: String(readBackData.expectedDialogueRevisionId || ''),
            turnCount: Number(readBackData.expectedTurnCount || 0),
          },
        })
        setMessage(dispatch.duplicate
          ? `التوليد يعمل بالفعل لهذه النسخة ✓ بصمة ${String(readBackData.expectedDialogueContentSha256 || '').slice(0, 12)}`
          : `بدأ التوليد تلقائياً من اللوحة ✓ بصمة ${String(readBackData.expectedDialogueContentSha256 || '').slice(0, 12)}${dispatch.workflowRunId ? ` · تشغيل ${dispatch.workflowRunId}` : ''}`)
      } else {
        setMessage(status === 'published' ? 'اعتمدت الحلقة وأصبحت جاهزة للنشر.' : 'أُعيدت الحلقة إلى المراجعة.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذّر حفظ القرار سحابياً.')
    } finally {
      setBusy('')
    }
  }

  // نصوص الأرشيف تعيش في bodies.json وتُحمَّل كسولاً — فحص حقل body وحده كان
  // يعلن 161 نصاً «ناقصاً» زوراً. نحمّل الخريطة الحقيقية ونفحص عليها.
  const [staticBodies, setStaticBodies] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let active = true
    loadArticleBodies().then((bodies) => { if (active) setStaticBodies(bodies) }).catch(() => { if (active) setStaticBodies({}) })
    return () => { active = false }
  }, [])

  const health = useMemo(() => {
    const bodyOf = (article: ArticleRecord) => article.body || staticBodies?.[article.slug] || ''
    const missingBody = staticBodies === null ? [] : articles.filter((article) => bodyOf(article).trim().length < 80)
    const missingSource = articles.filter((article) => !article.source)
    const missingAudio = articles.filter((article) => !article.hasAudio)
    const paperIssues = papers.filter((paper) => !paper.abstractAr || !paper.source || paper.verification === 'needs-manual-review')
    const bookIssues = books.filter((book) => !book.desc || !book.cover || !book.pdf)
    return { missingBody, missingSource, missingAudio, paperIssues, bookIssues }
  }, [articles, books, papers, staticBodies])

  const archiveCoverage = useMemo(() => {
    const live = articles.filter((article) => !article._cms.hidden && article.status !== 'draft')
    const total = live.length || 1
    const percent = (count: number) => Math.round((count / total) * 100)
    return [
      { label: 'الصوت', value: percent(live.filter((article) => article.hasAudio).length) },
      { label: 'المصادر', value: percent(live.filter((article) => Boolean(article.source || article.url)).length) },
      { label: 'المقتطفات', value: percent(live.filter((article) => Boolean(article.excerpt?.trim())).length) },
      { label: 'التصنيف', value: percent(live.filter((article) => Boolean(article.cat?.trim())).length) },
    ]
  }, [articles])

  const pathIdeas = useMemo(() => {
    const groups = new Map<string, ArticleRecord[]>()
    for (const article of articles) {
      const key = article.cat || 'فكر عام'
      const list = groups.get(key) || []
      list.push(article)
      groups.set(key, list)
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([category, list]) => ({ category, first: list[0], next: list[1], count: list.length }))
  }, [articles])

  return (
    <div className="grid min-w-0 max-w-full gap-5">
      {view === 'production' && <section className={card}>
        <div className="grid min-w-0 gap-4 sm:flex sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة إنتاج البودكاست</p>
            <h2 className="mt-2 font-display text-[1.35rem] font-semibold text-ink">الحلقة من المسودة إلى النشر، في مسار واحد.</h2>
            <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">لا توجد لوحة ثانية مكررة: الكتابة في «الحوار اليدوي»، والفحص والقرار النهائي هنا.</p>
          </div>
          <button type="button" onClick={() => onOpen('manual-dialogue')} className="w-full min-w-0 rounded-full border border-accent/30 px-4 py-2 text-[.78rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white sm:w-auto">افتح محرر الحوار</button>
        </div>

        <div className="mt-5 grid gap-3">
          {episodeRows.map(({ article, episode, status }) => {
            const hasDraft = draftSlugs.has(article.slug)
            return (
            <article key={article.slug} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-canvas p-4 md:p-5">
              <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[.7rem] font-semibold text-accent">{stages.find((stage) => stage.key === status)?.label}</p>
                  <h3 className="mt-1 break-words font-display text-[1rem] font-semibold leading-[1.55] text-ink">{article.title}</h3>
                  <p className="mt-1 text-[.74rem] text-soft">{episode?.failure?.reason
                    ? `${episode.statusLabel || 'فشل'}: ${episode.failure.reason}`
                    : episode?.statusLabel || episode?.quality?.pronunciation || (hasDraft ? 'توجد مسودة حوار محفوظة' : 'لم يبدأ إنتاج الحلقة بعد')}</p>
                  {hasDraft && (
                    <p className="mt-1 text-[.68rem] leading-relaxed text-soft/80">
                      مكانها: لوحة التحكم ← الصوت والبودكاست ← الحوار اليدوي ← هذا المقال.
                    </p>
                  )}
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap">
                  {hasDraft && (
                    <button
                      type="button"
                      onClick={() => focusManualDialogue(article.slug, onOpen)}
                      className="min-w-0 rounded-full border border-accent/30 px-3 py-2 text-[.72rem] font-semibold leading-tight text-accent transition-colors hover:bg-accent hover:text-white sm:px-4 sm:text-[.74rem]"
                    >
                      فتح المسودة
                    </button>
                  )}
                  {status === 'draft' || status === 'queued' ? (
                    <button disabled={busy === article.slug || status === 'queued'} onClick={() => void setStatus(article.slug, 'queued')} className="min-w-0 rounded-full bg-accent px-3 py-2 text-[.72rem] font-semibold leading-tight text-white disabled:opacity-50 sm:px-4 sm:text-[.74rem]">{status === 'queued' ? 'جارٍ بدء التوليد' : '🎬 ابدأ التوليد الآن'}</button>
                  ) : (
                    <button disabled={busy === article.slug} onClick={() => void setStatus(article.slug, 'published')} className="min-w-0 rounded-full bg-accent px-3 py-2 text-[.72rem] font-semibold leading-tight text-white disabled:opacity-50 sm:px-4 sm:text-[.74rem]">اعتماد الحلقة</button>
                  )}
                  <button disabled={busy === article.slug} onClick={() => void setStatus(article.slug, 'needs_review')} className="min-w-0 rounded-full border border-hair px-3 py-2 text-[.72rem] font-semibold leading-tight text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50 sm:px-4 sm:text-[.74rem]">إعادتها للمراجعة</button>
                </div>
              </div>
              {episode?.listen && (
                <div className="mt-3 grid min-w-0 gap-2 rounded-xl border border-hair bg-wash px-3 py-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <span className="text-[.72rem] font-semibold text-accent">🎧 اسمع قبل القرار{episode.failure ? ' (نسخة المراجعة المرفوضة)' : ''}</span>
                  <audio controls preload="none" src={episode.listen} className="h-10 w-full min-w-0 max-w-full flex-1" />
                </div>
              )}
              <button type="button" onClick={() => setOpenStages((current) => ({ ...current, [article.slug]: !current[article.slug] }))} aria-expanded={Boolean(openStages[article.slug])} className="mt-3 rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">
                {openStages[article.slug] ? 'إخفاء المراحل' : 'عرض مراحل الإنتاج'}
              </button>
              {openStages[article.slug] && <StageRail active={status} />}
            </article>
          )})}
        </div>
        {message && <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{message}</p>}
      </section>}

      {view === 'health' && <section className={card}>
        <div className="grid min-w-0 gap-3 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[.76rem] font-semibold uppercase text-accent">صحة المحتوى</p>
            <h2 className="mt-2 font-display text-[1.3rem] font-semibold text-ink">ما ينقص الموقع فعلاً، بلا ضجيج.</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void checkSourcesNow()} disabled={sourcesBusy} className={`${pill} disabled:opacity-50`}>
              {sourcesBusy ? 'يبدأ الفحص…' : '↻ افحص المصادر الآن'}
            </button>
            <button type="button" onClick={() => onOpen('lab')} className={pill}>الفحص التفصيلي</button>
          </div>
        </div>
        {sourcesNotice && <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{sourcesNotice}</p>}

        {/* تقرير المصادر التفصيلي: لم يعد رقماً صامتاً — اضغطه فيقول لك أي رابط
            سقط، ولماذا، وفي أي مادة، وما العلاج، مع فتحه بضغطة. */}
        {sourceReport && (
          <div className="mt-4 rounded-2xl border border-hair bg-canvas">
            <button
              type="button"
              onClick={() => setSourcesOpen((current) => !current)}
              aria-expanded={sourcesOpen}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-start"
            >
              <span className="min-w-0">
                <span className="block text-[.82rem] font-semibold text-ink">
                  فحص المصادر · {sourceReport.ok ?? 0} سليمة من {sourceReport.total ?? 0}
                </span>
                <span className="mt-0.5 block text-[.72rem] text-soft">
                  {sourceReport.problems ? `${sourceReport.problems} مصدراً يحتاج قرارك` : 'لا مصدر تالفاً'}
                  {sourceReport.warnings ? ` · ${sourceReport.warnings} تنبيهاً عابراً` : ''}
                  {sourceReport.checkedAt ? ` · ${new Date(sourceReport.checkedAt).toLocaleString('ar-KW', { dateStyle: 'medium', timeStyle: 'short', numberingSystem: 'latn' })}` : ''}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[.72rem] font-semibold ${sourceReport.problems ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>
                {sourcesOpen ? 'إخفاء التفاصيل' : 'التفاصيل'}
              </span>
            </button>
            {sourcesOpen && (
              <div className="grid gap-4 border-t border-hair p-3 lg:grid-cols-2" dir="rtl">
                <section className="rounded-2xl border border-hair bg-wash p-3">
                  <div className="mb-3 border-b border-hair pb-3">
                    <h3 className="text-[.86rem] font-semibold text-ink">مكتبتي</h3>
                    <p className="mt-1 text-[.7rem] leading-relaxed text-soft">عرض ومقترحات فقط — لا حذف ولا استبدال آلي لأي رابط يخصك.</p>
                  </div>
                  <div className="grid gap-2">
                    {!ownedSourceItems.length && <p className="px-2 py-3 text-[.8rem] text-soft">لا رابط في مكتبتك يحتاج مراجعة.</p>}
                    {ownedSourcePages.pageItems.map((item) => {
                      const place = item.places?.[0]
                      return <div key={item.url} className="min-w-0 rounded-xl border border-hair bg-canvas px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-hair px-2.5 py-1 text-[.68rem] font-semibold text-soft">{sourceStateLabel[item.state] || item.state}{item.status ? ` · ${item.status}` : ''}</span>{place?.kind && <span className="text-[.7rem] text-soft">{place.kind}</span>}</div>
                        {(place?.title || place?.slug) && <p className="mt-1.5 break-words text-[.84rem] font-semibold leading-[1.6] text-ink">{place.title || place.slug}</p>}
                        <p className="mt-1 text-[.74rem] leading-relaxed text-soft">{item.note}{item.advice ? ` — ${item.advice}` : ''}</p>
                        {item.replacement && <a href={item.replacement} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[.72rem] font-semibold text-accent underline underline-offset-4">بديل مقترح فقط ↗</a>}
                        <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[.7rem] text-soft underline underline-offset-4">فتح الرابط الحالي ↗</a>
                      </div>
                    })}
                  </div>
                  <Pagination page={ownedSourcePages.page} pageCount={ownedSourcePages.pageCount} onChange={ownedSourcePages.setPage} totalItems={ownedSourceItems.length} firstItem={ownedSourcePages.firstItem} lastItem={ownedSourcePages.lastItem} label="صفحات مكتبتي" className="mt-4" />
                </section>
                <section className="rounded-2xl border border-hair bg-canvas p-3">
                  <div className="mb-3 border-b border-hair pb-3">
                    <h3 className="text-[.86rem] font-semibold text-ink">المصادر الخارجية</h3>
                    <p className="mt-1 text-[.7rem] leading-relaxed text-soft">تُعاد مراجعتها؛ يُستبدل المؤكد، وما ثبت موته بلا بديل يُحذف من الموقع بالكامل.</p>
                  </div>
                  <div className="grid gap-2">
                    {!externalSourceItems.length && <p className="px-2 py-3 text-[.8rem] text-soft">كل المصادر الخارجية سليمة.</p>}
                    {externalSourcePages.pageItems.map((item) => {
                      const place = item.places?.[0]
                      const critical = ['dead', 'unreachable', 'suspect'].includes(item.state)
                      return <div key={item.url} className={`min-w-0 rounded-xl border px-3 py-3 ${critical ? 'border-accent/40 bg-accent/[.04]' : 'border-hair bg-wash'}`}>
                        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[.68rem] font-semibold ${critical ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>{sourceStateLabel[item.state] || item.state}{item.status ? ` · ${item.status}` : ''}</span>{item.action && <span className="text-[.68rem] font-semibold text-accent">{item.action}</span>}</div>
                        {(place?.title || place?.slug) && <p className="mt-1.5 break-words text-[.84rem] font-semibold leading-[1.6] text-ink">{place.title || place.slug}</p>}
                        <p className="mt-1 text-[.74rem] leading-relaxed text-soft">{item.note}{item.advice ? ` — ${item.advice}` : ''}</p>
                        <a href={item.replacement || item.url} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[.72rem] text-accent underline underline-offset-4">{item.replacement ? 'فتح البديل المعتمد' : 'فتح المصدر'} ↗</a>
                      </div>
                    })}
                  </div>
                  <Pagination page={externalSourcePages.page} pageCount={externalSourcePages.pageCount} onChange={externalSourcePages.setPage} totalItems={externalSourceItems.length} firstItem={externalSourcePages.firstItem} lastItem={externalSourcePages.lastItem} label="صفحات المصادر الخارجية" className="mt-4" />
                </section>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 grid min-w-0 grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ['نصوص ناقصة', health.missingBody.length],
            ['مصادر ناقصة', health.missingSource.length],
            ['صوت غير متاح', health.missingAudio.length],
            ['أبحاث للمراجعة', health.paperIssues.length],
            ['كتب للمراجعة', health.bookIssues.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0 rounded-2xl border border-hair bg-canvas p-3 sm:p-4">
              <strong className="block font-display text-2xl text-ink">{value}</strong>
              <span className="mt-1 block text-[.72rem] text-soft">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-hair bg-canvas p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.76rem] font-semibold uppercase text-accent">تغطية الأرشيف</p>
              <h3 className="mt-1 font-display text-[1.05rem] font-semibold text-ink">نسبة اكتمال العناصر الهادئة.</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {archiveCoverage.map((item) => (
              <div key={item.label} className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[.76rem]">
                  <span className="font-semibold text-ink">{item.label}</span>
                  <span className="text-accent">{item.value}%</span>
                </div>
                <span className="block h-2 overflow-hidden rounded-full bg-wash">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${item.value}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
        {(health.missingBody.length || health.paperIssues.length) > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {health.missingBody.slice(0, 3).map((article) => <button key={article.slug} type="button" onClick={() => onOpen('articles')} className="rounded-xl border border-hair bg-canvas px-4 py-3 text-start text-[.8rem] text-soft hover:border-accent"><strong className="block text-ink">نص يحتاج استكمالاً</strong>{article.title}</button>)}
            {health.paperIssues.slice(0, 3).map((paper) => <button key={paper.slug} type="button" onClick={() => onOpen('papers')} className="rounded-xl border border-hair bg-canvas px-4 py-3 text-start text-[.8rem] text-soft hover:border-accent"><strong className="block text-ink">بحث يحتاج تحققاً</strong>{paper.title}</button>)}
          </div>
        )}
      </section>}

      {view === 'health' && <section className={card}>
        <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[.76rem] font-semibold uppercase text-accent">مسارات القراءة الشخصية</p>
            <h2 className="mt-2 font-display text-[1.3rem] font-semibold text-ink">اقتراح هادئ يتكوّن من رحلة كل زائر.</h2>
            <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">المحرك يستخدم آخر قراءة ومحور الاهتمام على جهاز الزائر، ويعرض اقتراحاً واحداً فقط؛ لا ملف شخصي، ولا ازدحام في الواجهة.</p>
          </div>
          <span className="rounded-full border border-accent/25 bg-accent/[.06] px-3 py-1.5 text-[.72rem] font-semibold text-accent">فعّال</span>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 md:grid-cols-3">
          {pathIdeas.map((path) => (
            <div key={path.category} className="min-w-0 rounded-2xl border border-hair bg-canvas p-3 sm:p-4">
              <p className="text-[.72rem] font-semibold text-accent">{path.category} · {path.count} مادة</p>
              <p className="mt-2 font-display text-[.92rem] font-semibold leading-[1.55] text-ink">{path.first?.title}</p>
              {path.next && <p className="mt-2 text-[.74rem] leading-relaxed text-soft">ثم: {path.next.title}</p>}
            </div>
          ))}
        </div>
      </section>}
    </div>
  )
}
