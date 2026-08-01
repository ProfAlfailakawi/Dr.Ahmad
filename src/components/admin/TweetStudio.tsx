/**
 * استوديو التغريدات — لوحة الدكتور لكتابة تغريداته من مادته هو.
 *
 * المصادر ستة: المقالات والكتب والأبحاث واللقاءات الإعلامية وأخبار الرادار
 * الراهنة وفكرةٌ حرّة يكتبها بيده. والمحرك محليٌّ بالكامل (`tweet-forge`) بلا
 * شبكةٍ ولا مقابل، ولا يخرج منه بين قوسين إلا ما وُجد في متنه حرفاً بحرف.
 *
 * ومن كل تغريدةٍ زرٌّ واحد يسلّمها إلى «منشور مستقل» في استوديو النشر فتصير
 * تصميماً — وهو الطريق الذي طلبه الدكتور: تغريدة ← تصميم ← نشر.
 */

import { useEffect, useMemo, useState } from 'react'
import { loadArticleBodies } from '../../lib/article-bodies'
import { fetchPublishedExtras } from '../../lib/firebase'
import { useCmsContent } from '../../lib/content'
import { Pagination, usePagedList } from '../Pagination'
import {
  TWEET_ANGLES,
  TWEET_LIMIT,
  buildThread,
  buildTweetBatch,
  buildTweets,
  type TweetDraft,
  type TweetSource,
  type TweetSourceKind,
  type TweetThread,
} from '../../lib/tweet-forge'

const card = 'rounded-[1.75rem] border border-hair bg-paper p-5 shadow-sm md:p-7'
const input = 'w-full rounded-2xl border border-hair bg-canvas px-4 py-3 text-[.88rem] text-ink outline-none transition focus:border-accent'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'

type RadarItem = { id: string; ar?: string; arNote?: string; en?: string; source?: string; url?: string }

const SOURCE_TABS: { kind: TweetSourceKind; label: string; note: string }[] = [
  { kind: 'article', label: 'مقالاتي', note: 'المتن كاملاً — أغنى مصدر للتغريدات' },
  { kind: 'book', label: 'كتبي', note: 'من وصف الكتاب وفكرته' },
  { kind: 'paper', label: 'أبحاثي', note: 'من الملخص العربي' },
  { kind: 'media', label: 'اللقاءات', note: 'ظهور إعلامي يستحق التذكير' },
  { kind: 'news', label: 'الواقع الآن', note: 'أخبار الرادار — قراءةٌ تربوية للخبر' },
  { kind: 'free', label: 'فكرة حرّة', note: 'اكتب فكرتك وسأصوغها بأربع عشرة زاوية' },
]

const SITE = 'https://dr-alfailakawi.com'

/** يسلّم نص التغريدة إلى «منشور مستقل» في استوديو النشر. */
function sendToStandalone(draft: TweetDraft) {
  const seed = { idea: draft.standalonePost, purpose: draft.designPurpose, at: new Date().toISOString() }
  try { localStorage.setItem('studio-standalone-seed', JSON.stringify(seed)) } catch { /* الخزن ليس شرطاً */ }
  window.dispatchEvent(new CustomEvent('studio:standalone-seed', { detail: seed }))
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 82 ? 'bg-emerald-500' : score >= 68 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, score)}%` }} />
    </div>
  )
}

function TweetCard({ draft, onCopied }: { draft: TweetDraft; onCopied: (message: string) => void }) {
  const [text, setText] = useState(draft.text)
  const [open, setOpen] = useState(false)
  useEffect(() => setText(draft.text), [draft.id, draft.text])
  const chars = [...text].length
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      onCopied('نُسخت التغريدة. الصقها في X.')
    } catch {
      onCopied('تعذّر النسخ في هذا المتصفح — حدّد النص وانسخه يدوياً.')
    }
  }
  return (
    <article className="grid gap-3 rounded-[1.35rem] border border-hair bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[.62rem] font-bold text-accent">{draft.angleLabel}</span>
          {draft.quoteVerified && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[.6rem] font-bold text-emerald-700" title="جملةٌ موجودةٌ في متنك حرفاً بحرف">جملة موثّقة ✓</span>}
        </div>
        <span className={`text-[.66rem] font-black ${draft.score >= 82 ? 'text-emerald-700' : draft.score >= 68 ? 'text-amber-700' : 'text-red-600'}`}>{draft.score}٪</span>
      </div>
      <ScoreBar score={draft.score} />
      <textarea
        rows={Math.min(9, Math.max(4, text.split('\n').length + 1))}
        className={`${input} min-h-0 resize-y whitespace-pre-wrap px-3.5 py-3 text-[.84rem] leading-relaxed`}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[.64rem] text-soft">
        <span className={chars > TWEET_LIMIT ? 'font-bold text-red-600' : ''}>{chars} / {TWEET_LIMIT} حرفاً</span>
        <span className="truncate">{draft.sourceTitle}</span>
      </div>
      <details className="rounded-xl border border-hair bg-paper" open={open} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer list-none px-3 py-2 text-[.64rem] font-semibold text-accent [&::-webkit-details-marker]:hidden">لماذا هذه الدرجة؟</summary>
        <div className="grid gap-1 border-t border-hair p-3">
          {draft.signals.map((signal) => (
            <span key={signal.label} className="flex items-center justify-between gap-3 text-[.64rem]">
              <span className="text-soft">{signal.label}</span>
              <strong className={signal.weight >= 0 ? 'text-emerald-700' : 'text-red-600'}>{signal.weight > 0 ? '+' : ''}{signal.weight}</strong>
            </span>
          ))}
          <p className="mt-1 text-[.6rem] leading-relaxed text-soft">الدرجة تقيس بنية النص لا مستقبله؛ لا أحد يعرف ما ينتشر مسبقاً.</p>
        </div>
      </details>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className={primary} onClick={() => void copy()}>انسخ للتغريد</button>
        <button
          type="button"
          className="rounded-full border border-accent/30 bg-accent/[.06] px-4 py-2.5 text-[.76rem] font-bold text-accent transition hover:border-accent"
          onClick={() => { sendToStandalone({ ...draft, standalonePost: text.split('\n').filter((line) => !/^https?:\/\//.test(line.trim()) && !/^#/.test(line.trim())).join('\n').trim() }); onCopied('أُرسلت إلى «منشور مستقل» في استوديو النشر.') }}
        >صمّمها في منشور مستقل ←</button>
      </div>
    </article>
  )
}

export function TweetStudio() {
  const cms = useCmsContent()
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [radar, setRadar] = useState<RadarItem[]>([])
  const [kind, setKind] = useState<TweetSourceKind>('article')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [freeText, setFreeText] = useState('')
  const [freeTitle, setFreeTitle] = useState('')
  const [variation, setVariation] = useState(0)
  const [withHashtags, setWithHashtags] = useState(false)
  const [notice, setNotice] = useState('')
  const [thread, setThread] = useState<TweetThread | null>(null)
  const [batchMode, setBatchMode] = useState(false)

  useEffect(() => {
    let active = true
    loadArticleBodies().then((map) => { if (active) setBodies(map) }).catch(() => undefined)
    fetchPublishedExtras<RadarItem>('site_radar').then((items) => { if (active) setRadar(items.slice(0, 40)) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  useEffect(() => { setNotice(''); setThread(null) }, [kind, selectedId, variation])

  /** كل المصادر المتاحة بصيغةٍ واحدة يفهمها المحرك. */
  const sources = useMemo<TweetSource[]>(() => {
    switch (kind) {
      case 'article':
        return cms.articles.map((article) => ({
          kind: 'article' as const,
          id: article.slug,
          title: article.title,
          text: [article.excerpt, article.body || bodies[article.slug] || ''].filter(Boolean).join(' '),
          url: `${SITE}/articles/${article.slug}`,
          date: article.iso,
        }))
      case 'book':
        return cms.books.map((book) => ({ kind: 'book' as const, id: book.slug, title: book.title, text: book.desc || '', url: `${SITE}/publications` }))
      case 'paper':
        return cms.papers.map((paper) => ({
          kind: 'paper' as const,
          id: paper.slug,
          title: paper.titleAr || paper.title,
          text: paper.abstractAr || '',
          url: paper.url || `${SITE}/research`,
          outlet: paper.journal || '',
        }))
      case 'media':
        return cms.media.map((item) => ({ kind: 'media' as const, id: item.slug, title: item.title, text: item.title, url: item.url, outlet: item.outlet }))
      case 'news':
        return radar.map((item) => ({ kind: 'news' as const, id: item.id, title: item.ar || item.en || '', text: [item.ar, item.arNote].filter(Boolean).join('. '), url: item.url, outlet: item.source }))
      case 'free':
      default:
        return []
    }
  }, [bodies, cms.articles, cms.books, cms.media, cms.papers, kind, radar])

  const filtered = useMemo(() => {
    const needle = query.trim()
    if (!needle) return sources
    return sources.filter((source) => `${source.title} ${source.text || ''}`.includes(needle))
  }, [query, sources])

  const paged = usePagedList(filtered, 8, `${kind}|${query}`)

  const activeSource = useMemo<TweetSource | null>(() => {
    if (kind === 'free') {
      const text = freeText.trim()
      if (text.length < 40) return null
      return { kind: 'free', id: `free-${text.length}`, title: freeTitle.trim() || text.split(/[.!؟]/)[0].slice(0, 60), text }
    }
    return filtered.find((source) => source.id === selectedId) || filtered[0] || null
  }, [filtered, freeText, freeTitle, kind, selectedId])

  const drafts = useMemo(() => {
    if (batchMode) return buildTweetBatch(sources.slice(0, 30), { variation, withHashtags, count: 12, perSource: 1 })
    if (!activeSource) return []
    return buildTweets(activeSource, { variation, withHashtags, count: 10 })
  }, [activeSource, batchMode, sources, variation, withHashtags])

  const readyCount = drafts.filter((draft) => draft.score >= 78).length
  const verifiedCount = drafts.filter((draft) => draft.quoteVerified).length

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">استوديو التغريدات</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink">تغريداتك من كلامك أنت — لا من كلامٍ يُنسب إليك.</h2>
        <p className="mt-2 text-[.82rem] leading-relaxed text-soft">
          اختر مادةً من أرشيفك أو اكتب فكرةً حرّة، فيخرج لك أربع عشرة زاويةً بلاغيةً مختلفة، كلٌّ بدرجةِ انتشارٍ وأسبابها.
          كل جملةٍ تحمل شارة «موثّقة» موجودةٌ في متنك حرفاً بحرف؛ وما عداها إطارٌ من الاستوديو لا يدّعي عليك قولاً.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => { setKind(tab.kind); setSelectedId(''); setBatchMode(false) }}
              className={`min-h-16 rounded-2xl px-3 py-2.5 text-right transition-colors ${kind === tab.kind && !batchMode ? 'bg-accent text-white' : 'border border-hair bg-wash text-ink hover:border-accent hover:text-accent'}`}
            >
              <strong className="block text-[.78rem]">{tab.label}</strong>
              <span className={`mt-0.5 block text-[.6rem] leading-relaxed ${kind === tab.kind && !batchMode ? 'text-white/70' : 'text-soft'}`}>{tab.note}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className={ghost} onClick={() => setVariation((current) => current + 1)}>تنويع جديد</button>
          <button type="button" className={ghost} onClick={() => setWithHashtags((current) => !current)}>{withHashtags ? 'أزل الوسوم' : 'أضف وسمين'}</button>
          <button
            type="button"
            className={batchMode ? primary : ghost}
            onClick={() => { setBatchMode((current) => !current); setThread(null) }}
            disabled={kind === 'free'}
          >ماذا أغرّد اليوم؟ — أفضل ما في الأرشيف</button>
          {activeSource && !batchMode && (
            <button type="button" className={ghost} onClick={() => setThread(buildThread(activeSource, { variation }))}>ابنِ خيطاً 🧵</button>
          )}
        </div>
        {notice && <p className="mt-3 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-2.5 text-[.72rem] text-accent">{notice}</p>}
      </section>

      {kind === 'free' && !batchMode && (
        <section className={card}>
          <p className="text-[.7rem] font-semibold text-accent">فكرة حرّة</p>
          <div className="mt-3 grid gap-3">
            <input className={input} value={freeTitle} onChange={(event) => setFreeTitle(event.target.value)} placeholder="عنوان الفكرة (اختياري)" />
            <textarea
              rows={6}
              className={`${input} min-h-0 resize-y leading-relaxed`}
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder="اكتب فكرتك في فقرةٍ أو فقرتين. كلما كتبت جملاً مكتملة خرجت الزوايا أغنى — والمحرك لا يخترع عليك جملة."
            />
            <p className="text-[.64rem] text-soft">{[...freeText].length} حرفاً · يبدأ التوليد من ٤٠ حرفاً فأكثر.</p>
          </div>
        </section>
      )}

      {kind !== 'free' && !batchMode && (
        <section className={card} id="tweet-sources">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-[.7rem] font-semibold text-accent">اختر المادة ({filtered.length})</p>
            <input className={`${input} max-w-xs py-2 text-[.78rem]`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في العناوين والمتون…" />
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {paged.pageItems.map((source) => (
              <button
                key={source.id}
                type="button"
                onClick={() => setSelectedId(source.id)}
                className={`rounded-2xl border px-4 py-3 text-right transition-colors ${activeSource?.id === source.id ? 'border-accent bg-accent/[.06]' : 'border-hair bg-canvas hover:border-accent'}`}
              >
                <strong className="block text-[.8rem] text-ink">{source.title || 'بلا عنوان'}</strong>
                <span className="mt-1 block text-[.64rem] text-soft">{[...(source.text || '')].length} حرفاً {source.outlet ? `· ${source.outlet}` : ''}</span>
              </button>
            ))}
            {!paged.pageItems.length && <p className="text-[.74rem] text-soft">لا توجد مادةٌ بهذه العبارة.</p>}
          </div>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={filtered.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="tweet-sources" label="صفحات المواد" className="mt-5" />
        </section>
      )}

      {thread && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">خيطٌ من «{thread.sourceTitle}»</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">{thread.tweets.length} تغريدات · متوسط الدرجة {thread.score}٪</h3>
            </div>
            <button
              type="button"
              className={ghost}
              onClick={() => { void navigator.clipboard.writeText(thread.tweets.join('\n\n———\n\n')).then(() => setNotice('نُسخ الخيط كاملاً.')).catch(() => setNotice('تعذّر النسخ في هذا المتصفح.')) }}
            >انسخ الخيط كاملاً</button>
          </div>
          <ol className="mt-4 grid gap-2">
            {thread.tweets.map((tweet, index) => (
              <li key={`${thread.id}-${index}`} className="rounded-2xl border border-hair bg-canvas p-3">
                <span className="text-[.6rem] font-bold text-accent">تغريدة {index + 1}</span>
                <p className="mt-1 whitespace-pre-wrap text-[.82rem] leading-relaxed text-ink">{tweet}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[.7rem] font-semibold text-accent">{batchMode ? 'أقوى ما في الأرشيف اليوم' : 'الزوايا الجاهزة'}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">
              {drafts.length ? `${drafts.length} تغريدة · ${readyCount} منها في نطاق الانتشار · ${verifiedCount} بجملةٍ موثّقة` : 'لا تغريدات بعد'}
            </h3>
          </div>
        </div>
        {drafts.length
          ? <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{drafts.map((draft) => <TweetCard key={draft.id} draft={draft} onCopied={setNotice} />)}</div>
          : (
            <p className="mt-4 text-[.78rem] leading-relaxed text-soft">
              {kind === 'free'
                ? 'اكتب فكرتك أعلاه (٤٠ حرفاً فأكثر) وستظهر الزوايا فوراً.'
                : 'اختر مادةً من القائمة. المواد القصيرة جداً قد لا تكفي لبناء زاوية — والمحرك يصمت بدل أن يخترع.'}
            </p>
          )}
      </section>
    </div>
  )
}
