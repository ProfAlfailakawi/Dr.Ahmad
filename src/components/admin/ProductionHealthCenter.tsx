import { useEffect, useMemo, useState } from 'react'
import podcastAdmin from '../../data/podcast-admin.json'
import { getDb } from '../../lib/firebase'
import type { ArticleRecord, BookRecord, PaperRecord } from '../../lib/cms'
import type { AdminTab } from './AdminArchitecture'

const card = 'min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const pill = 'min-w-0 rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.74rem] font-semibold leading-tight text-soft'

type Stage = 'draft' | 'queued' | 'generating' | 'pronunciation' | 'needs_review' | 'passed' | 'published'
type ProductionState = { status?: Stage; updatedAt?: unknown; note?: string }
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

export function ProductionHealthCenter({
  articles,
  books,
  papers,
  onOpen,
}: {
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  onOpen: (tab: AdminTab) => void
}) {
  const [remote, setRemote] = useState<Record<string, ProductionState>>({})
  const [draftSlugs, setDraftSlugs] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

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

  const setStatus = async (slug: string, status: Stage) => {
    setBusy(slug); setMessage('')
    try {
      const db = await getDb()
      if (!db) throw new Error('قاعدة البيانات غير متاحة')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'podcast_production', slug), { status, updatedAt: serverTimestamp() }, { merge: true })
      setRemote((current) => ({ ...current, [slug]: { ...current[slug], status } }))
      setMessage(status === 'published' ? 'اعتمدت الحلقة وأصبحت جاهزة للنشر.'
        : status === 'queued' ? 'أُدرجت في قائمة التوليد الليلي — ستُنتج تلقائياً في الليلة القادمة.'
        : 'أُعيدت الحلقة إلى المراجعة.')
    } catch {
      setMessage('تعذّر حفظ القرار سحابياً. انشر قواعد Firestore الجديدة ثم أعد المحاولة.')
    } finally {
      setBusy('')
    }
  }

  const health = useMemo(() => {
    const missingBody = articles.filter((article) => !article.body || article.body.trim().length < 80)
    const missingSource = articles.filter((article) => !article.source)
    const missingAudio = articles.filter((article) => !article.hasAudio)
    const paperIssues = papers.filter((paper) => !paper.abstractAr || !paper.source || paper.verification === 'needs-manual-review')
    const bookIssues = books.filter((book) => !book.desc || !book.cover || !book.pdf)
    return { missingBody, missingSource, missingAudio, paperIssues, bookIssues }
  }, [articles, books, papers])

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
      <section className={card}>
        <div className="grid min-w-0 gap-4 sm:flex sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة إنتاج البودكاست</p>
            <h2 className="mt-2 font-display text-[1.35rem] font-semibold text-ink">الحلقة من المسودة إلى النشر، في مسار واحد.</h2>
            <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">لا توجد لوحة ثانية مكررة: الكتابة في «الحوار اليدوي»، والفحص والقرار النهائي هنا.</p>
          </div>
          <button type="button" onClick={() => onOpen('manual-dialogue')} className="w-full min-w-0 rounded-full border border-accent/30 px-4 py-2 text-[.78rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white sm:w-auto">افتح محرر الحوار</button>
        </div>

        <div className="mt-5 grid gap-3">
          {episodeRows.map(({ article, episode, status }) => (
            <article key={article.slug} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-hair bg-canvas p-4 md:p-5">
              <div className="grid min-w-0 gap-3 sm:flex sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[.7rem] font-semibold text-accent">{stages.find((stage) => stage.key === status)?.label}</p>
                  <h3 className="mt-1 break-words font-display text-[1rem] font-semibold leading-[1.55] text-ink">{article.title}</h3>
                  <p className="mt-1 text-[.74rem] text-soft">{episode?.failure?.reason
                    ? `${episode.statusLabel || 'فشل'}: ${episode.failure.reason}`
                    : episode?.statusLabel || episode?.quality?.pronunciation || (draftSlugs.has(article.slug) ? 'توجد مسودة حوار محفوظة' : 'لم يبدأ إنتاج الحلقة بعد')}</p>
                </div>
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap">
                  {status === 'draft' || status === 'queued' ? (
                    <button disabled={busy === article.slug || status === 'queued'} onClick={() => void setStatus(article.slug, 'queued')} className="min-w-0 rounded-full bg-accent px-3 py-2 text-[.72rem] font-semibold leading-tight text-white disabled:opacity-50 sm:px-4 sm:text-[.74rem]">{status === 'queued' ? 'في قائمة الليلة' : '🎬 أرسل للتوليد الليلي'}</button>
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
              <StageRail active={status} />
            </article>
          ))}
        </div>
        {message && <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] text-soft">{message}</p>}
      </section>

      <section className={card}>
        <div className="grid min-w-0 gap-3 sm:flex sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[.76rem] font-semibold uppercase text-accent">صحة المحتوى</p>
            <h2 className="mt-2 font-display text-[1.3rem] font-semibold text-ink">ما ينقص الموقع فعلاً، بلا ضجيج.</h2>
          </div>
          <button type="button" onClick={() => onOpen('lab')} className={pill}>الفحص التفصيلي</button>
        </div>
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
        {(health.missingBody.length || health.paperIssues.length) > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {health.missingBody.slice(0, 3).map((article) => <button key={article.slug} type="button" onClick={() => onOpen('articles')} className="rounded-xl border border-hair bg-canvas px-4 py-3 text-start text-[.8rem] text-soft hover:border-accent"><strong className="block text-ink">نص يحتاج استكمالاً</strong>{article.title}</button>)}
            {health.paperIssues.slice(0, 3).map((paper) => <button key={paper.slug} type="button" onClick={() => onOpen('papers')} className="rounded-xl border border-hair bg-canvas px-4 py-3 text-start text-[.8rem] text-soft hover:border-accent"><strong className="block text-ink">بحث يحتاج تحققاً</strong>{paper.title}</button>)}
          </div>
        )}
      </section>

      <section className={card}>
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
      </section>
    </div>
  )
}
