/**
 * استوديو التغريدات — لوحة الدكتور لكتابة تغريداته من مادته هو.
 *
 * المصادر ستة: المقالات والكتب والأبحاث واللقاءات الإعلامية وأخبار الرادار
 * الراهنة وفكرةٌ حرّة يكتبها بيده. والمحرك محليٌّ بالكامل (`tweet-forge`) بلا
 * شبكةٍ ولا مقابل، ولا يخرج منه بين قوسين إلا ما وُجد في متنه حرفاً بحرف.
 *
 * ومن كل تغريدةٍ زرٌّ واحد يسلّمها إلى «منشور مستقل» في استوديو النشر فتصير
 * تصميماً — وهو الطريق الذي طلبه الدكتور: تغريدة ← تصميم ← نشر.
 *
 * ودفترُ «ما نُشر» يجعل الاستوديو يتذكّر ويتعلّم: ما نشره لا يعود، وما يختاره
 * يرتفع. والخزن محليٌّ أولاً ثم يُزامَن إلى `site_settings/tweet-memory` فيتبع
 * الدفترُ الدكتورَ بين هاتفه وحاسوبه.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadArticleBodies } from '../../lib/article-bodies'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import { useCmsContent } from '../../lib/content'
import { currentSeason } from '../../lib/seasons'
import { resolveResonantQuotes, resonanceBySlug, type ResonanceRow, type ResonantQuote } from '../../lib/resonance-quotes'
import { Pagination, usePagedList } from '../Pagination'
import {
  TWEET_ANGLES,
  TWEET_LIMIT,
  buildThread,
  buildTweetBatch,
  buildTweets,
  buildWeeklyTweetPlan,
  type TweetAngleId,
  type TweetDraft,
  type TweetSource,
  type TweetSourceKind,
  type TweetThread,
} from '../../lib/tweet-forge'
import {
  createEmptyTweetMemory,
  daysSinceSource,
  forgetPublishedTweet,
  isPublished,
  loadTweetMemory,
  mergeTweetMemories,
  recordPublishedTweet,
  storeTweetMemory,
  tasteHighlights,
  tweetTasteAffinity,
  buildSignalCalibration,
  calibrationMap,
  outcomeCount,
  recordTweetOutcome,
  MIN_OUTCOME_SAMPLES,
  type TweetMemory,
  type TweetPublishRecord,
} from '../../lib/tweet-memory'
import { buildMeaningFingerprint } from '../../lib/editorial-memory'
import { buildMultimodalMeaningCourt } from '../../lib/semantic-court.mjs'

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
  { kind: 'free', label: 'فكرة حرّة', note: 'أربع عشرة زاوية؛ نعرض أقوى عشر' },
]

const SITE = 'https://dr-alfailakawi.com'

/** أسماءٌ عربيةٌ لمفاتيح الإشارات — تُعرض في لوحة «ما علّمك إياه الواقع». */
const SIGNAL_NAMES: Record<string, string> = {
  hook: 'خطّافٌ في أول سطر',
  'no-hook': 'بدايةٌ تقريرية',
  'length-sweet': 'طولٌ في نطاق الانتشار',
  'length-short': 'أقصر من أن تحمل فكرة',
  'length-long': 'أطول من القراءة السريعة',
  turn: 'منعطفٌ يقلب المعنى',
  'breathing-lines': 'مُقطَّعةٌ إلى أسطر',
  'one-block': 'كتلةٌ واحدة بلا تنفّس',
  'short-sentences': 'جُملٌ قصيرة',
  'long-sentences': 'جُملٌ طويلة',
  concrete: 'صورةٌ محسوسة',
  jargon: 'لغةٌ أكاديمية',
  'verified-quote': 'جملةٌ موثّقةٌ من متنك',
  resonance: 'سطرٌ ظلّله القرّاء',
  'ends-well': 'تنتهي بمعنى',
  'ends-badly': 'تنتهي برابطٍ أو وسم',
  'no-hashtags': 'بلا وسوم',
  'two-hashtags': 'وسمان',
  'many-hashtags': 'وسومٌ كثيرة',
  'many-links': 'أكثر من رابط',
  'promo-opener': 'تفتح بترويج',
  'repeated-marks': 'علاماتٌ مكرّرة',
  emoji: 'رموزٌ تعبيرية',
  'quotable-line': 'سطرٌ يُقتبس وحده',
}

/** يسلّم نص التغريدة إلى «منشور مستقل» في استوديو النشر. */
function sendToStandalone(draft: TweetDraft) {
  const seed = { idea: draft.standalonePost, purpose: draft.designPurpose, at: new Date().toISOString() }
  try { localStorage.setItem('studio-standalone-seed', JSON.stringify(seed)) } catch { /* الخزن ليس شرطاً */ }
  window.dispatchEvent(new CustomEvent('studio:standalone-seed', { detail: seed }))
}

type OutcomeInput = { impressions?: number; likes?: number; reposts?: number; replies?: number }

/**
 * صفُّ الدفتر: التغريدة المنشورة، وزرُّ إدخال أرقامها من X يدوياً.
 * يدويٌّ لأن واجهة X مدفوعة — والدكتور قال «ما ابي اصلا شي ادفع عليه».
 */
function LedgerRow({ record, onSaveOutcome, onForget }: { record: TweetPublishRecord; onSaveOutcome: (id: string, outcome: OutcomeInput | null) => void; onForget: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    impressions: String(record.outcome?.impressions ?? ''),
    likes: String(record.outcome?.likes ?? ''),
    reposts: String(record.outcome?.reposts ?? ''),
    replies: String(record.outcome?.replies ?? ''),
  })
  const num = (value: string) => { const parsed = Number(value.replace(/[^\d]/g, '')); return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined }
  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'impressions', label: 'مشاهدات' },
    { key: 'likes', label: 'إعجاب' },
    { key: 'reposts', label: 'إعادة نشر' },
    { key: 'replies', label: 'ردود' },
  ]
  return (
    <li className="rounded-xl border border-hair bg-paper p-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="text-[.58rem] font-bold text-accent">{TWEET_ANGLES[record.angle]?.label || record.angle} · {new Date(record.publishedAt).toLocaleDateString('ar', { day: 'numeric', month: 'short' })}</span>
          <span className="mt-0.5 block truncate text-[.7rem] text-ink">{record.excerpt}</span>
        </span>
        <span className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className={`rounded-full border px-2.5 py-1 text-[.56rem] transition ${record.outcome ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-hair text-soft hover:border-violet-400 hover:text-violet-700'}`}
          >{record.outcome ? 'أرقامها ✓' : 'أضف أرقامها'}</button>
          <button
            type="button"
            onClick={onForget}
            className="rounded-full border border-hair px-2.5 py-1 text-[.58rem] text-soft transition hover:border-red-300 hover:text-red-600"
          >تراجع</button>
        </span>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 rounded-xl border border-violet-200 bg-violet-50/40 p-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {fields.map(({ key, label }) => (
              <label key={key} className="grid gap-1 text-[.54rem] text-soft">
                {label}
                <input
                  inputMode="numeric"
                  className="w-full rounded-lg border border-hair bg-canvas px-2 py-1 text-[.68rem] text-ink outline-none focus:border-accent"
                  value={form[key]}
                  onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-full bg-accent px-3 py-1 text-[.6rem] font-bold text-white"
              onClick={() => { onSaveOutcome(record.id, { impressions: num(form.impressions), likes: num(form.likes), reposts: num(form.reposts), replies: num(form.replies) }); setOpen(false) }}
            >احفظ</button>
            {record.outcome && (
              <button type="button" className="rounded-full border border-hair px-3 py-1 text-[.6rem] text-soft hover:text-red-600" onClick={() => { onSaveOutcome(record.id, null); setOpen(false) }}>امسحها</button>
            )}
            <button type="button" className="rounded-full border border-hair px-3 py-1 text-[.6rem] text-soft" onClick={() => setOpen(false)}>إلغاء</button>
          </div>
          <p className="text-[.54rem] leading-relaxed text-soft">تُنقل من صفحة التغريدة في X. حين تكتب المشاهدات تُقاس النسبة لا العدد المطلق.</p>
        </div>
      )}
    </li>
  )
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 82 ? 'bg-emerald-500' : score >= 68 ? 'bg-amber-500' : 'bg-red-400'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-wash" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(4, score)}%` }} />
    </div>
  )
}

function TweetCard({ draft, source, onCopied, onPublished }: { draft: TweetDraft; source?: TweetSource | null; onCopied: (message: string) => void; onPublished: (draft: TweetDraft, text: string) => void }) {
  const [text, setText] = useState(draft.text)
  const [open, setOpen] = useState(false)
  const [marked, setMarked] = useState(false)
  useEffect(() => { setText(draft.text); setMarked(false) }, [draft.id, draft.text])
  const chars = [...text].length
  const meaningCourt = useMemo(() => {
    const origin = String(source?.text || draft.sourceTitle || '').trim()
    const fingerprint = buildMeaningFingerprint({ slug: source?.id || draft.sourceId, title: source?.title || draft.sourceTitle, body: origin, thesis: source?.title || draft.sourceTitle, sourceIds: [`tweet-source:${source?.id || draft.sourceId}`] })
    return buildMultimodalMeaningCourt({
      article: { slug: source?.id || draft.sourceId, title: source?.title || draft.sourceTitle, excerpt: '', body: origin },
      fingerprint,
      media: { social: [{ id: draft.id, channel: 'X', text }] },
      evidence: { sourceIds: [`tweet-source:${source?.id || draft.sourceId}`], proofs: ['tweet-studio|source-bound'], alerts: [] },
    })
  }, [draft.id, draft.sourceId, draft.sourceTitle, source, text])
  const meaningBlocked = meaningCourt.chambers.social.status === 'blocked'
    || meaningCourt.safeguards.headlineGuard.status === 'blocked'
    || meaningCourt.safeguards.claimLineage.status === 'blocked'
  const copy = async () => {
    if (meaningBlocked) { onCopied(`محكمة المعنى أوقفت النسخ: ${meaningCourt.alerts[0] || 'راجع صلة التغريدة بالمصدر.'}`); return }
    try {
      await navigator.clipboard.writeText(text)
      onCopied('نُسخت التغريدة. الصقها في X — ثم اضغط «نشرتُها» ليتذكّرها الدفتر.')
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
          {typeof draft.tasteLean === 'number' && draft.tasteLean > .15 && (
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[.6rem] font-bold text-violet-700" title="الدفتر يرى أنها تشبه ما تنشره عادةً">على ذوقك</span>
          )}
          {Boolean(draft.resonanceCount) && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[.6rem] font-bold text-amber-800" title="جملةٌ ظلّلها القرّاء بأصابعهم في صفحة المقال">اختارها القرّاء · {draft.resonanceCount}</span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[.6rem] font-bold ${meaningBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{meaningBlocked ? 'محكمة المعنى ✕' : 'المعنى محفوظ ✓'}</span>
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
            <span key={signal.key} className="flex items-center justify-between gap-3 text-[.64rem]">
              <span className="text-soft">
                {signal.label}
                {typeof signal.baseWeight === 'number' && (
                  <em className="ms-1.5 text-[.56rem] not-italic text-violet-700" title={`قدّرتُ وزنها ${signal.baseWeight}، وأرقامك عدّلته`}>عايَره واقعك</em>
                )}
              </span>
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
          onClick={() => { if (meaningBlocked) { onCopied(`محكمة المعنى أوقفت التسليم للتصميم: ${meaningCourt.alerts[0] || 'راجع النص.'}`); return } sendToStandalone({ ...draft, standalonePost: text.split('\n').filter((line) => !/^https?:\/\//.test(line.trim()) && !/^#/.test(line.trim())).join('\n').trim() }); onCopied('أُرسلت إلى «منشور مستقل» في استوديو النشر.') }}
        >صمّمها في منشور مستقل ←</button>
      </div>
      {/* التعليم صريحٌ بيد الدكتور: الاستوديو لا يزعم أنه يعرف ما نشره. */}
      <button
        type="button"
        disabled={marked}
        onClick={() => { onPublished(draft, text); setMarked(true) }}
        className={`rounded-full px-4 py-2 text-[.72rem] font-bold transition ${marked ? 'bg-emerald-100 text-emerald-700' : 'border border-hair bg-canvas text-soft hover:border-emerald-400 hover:text-emerald-700'}`}
      >{marked ? 'سُجّلت في الدفتر ✓ — لن تعود' : 'نشرتُها ✓'}</button>
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
  const [memory, setMemory] = useState<TweetMemory>(() => createEmptyTweetMemory())
  const [weeklyMode, setWeeklyMode] = useState(false)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [resonant, setResonant] = useState<ResonantQuote[]>([])
  const [resonanceMode, setResonanceMode] = useState(false)

  useEffect(() => {
    let active = true
    loadArticleBodies().then((map) => { if (active) setBodies(map) }).catch(() => undefined)
    fetchPublishedExtras<RadarItem>('site_radar').then((items) => { if (active) setRadar(items.slice(0, 40)) }).catch(() => undefined)
    return () => { active = false }
  }, [])

  /* رنينُ القرّاء: ما ظلّلوه في المتون. يُجلب مرةً واحدة ثم يُحلّ إلى جُملٍ
     مقروءة بعد وصول المتون — ولذلك يعتمد على `bodies` لا على التركيب وحده. */
  useEffect(() => {
    if (!cms.articles.length || !Object.keys(bodies).length) return
    let active = true
    void (async () => {
      try {
        const db = await getDb()
        if (!db || !active) return
        const { collection, getDocs } = await import('firebase/firestore')
        const snapshot = await getDocs(collection(db, 'article_highlights'))
        if (!active) return
        const rows = snapshot.docs.map((item) => item.data() as ResonanceRow)
        const articles = cms.articles.map((article) => ({ slug: article.slug, title: article.title, body: article.body || bodies[article.slug] || '' }))
        setResonant(resolveResonantQuotes(rows, articles, { limit: 60 }))
      } catch { /* غياب الرنين لا يوقف الاستوديو — يبقى الأرشيف كله متاحاً */ }
    })()
    return () => { active = false }
  }, [bodies, cms.articles])

  const resonanceMap = useMemo(() => resonanceBySlug(resonant), [resonant])

  /* الدفتر: المحلي فوراً (يعمل بلا شبكة)، ثم يُدمج مع نسخة السحابة إن وُجدت.
     الدمج اتحادٌ لا استبدال، فلا يضيع ما نُشر من هاتفٍ آخر. */
  useEffect(() => {
    let active = true
    const local = loadTweetMemory()
    setMemory(local)
    void (async () => {
      try {
        const db = await getDb()
        if (!db || !active) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'site_settings', 'tweet-memory'))
        if (!snapshot.exists() || !active) return
        const remote = snapshot.data() as { memory?: TweetMemory }
        if (!remote.memory?.records) return
        const merged = mergeTweetMemories(local, remote.memory)
        setMemory(merged)
        storeTweetMemory(merged)
      } catch { /* الدفتر المحلي يكفي حين تتعذّر السحابة */ }
    })()
    return () => { active = false }
  }, [])

  const persistMemory = useCallback((next: TweetMemory) => {
    setMemory(next)
    storeTweetMemory(next)
    void (async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc(db, 'site_settings', 'tweet-memory'), { memory: next, updatedAt: Date.now() }, { merge: true })
      } catch { /* فشل المزامنة لا يُفقد الدفتر المحلي */ }
    })()
  }, [])

  const saveOutcome = useCallback((id: string, outcome: OutcomeInput | null) => {
    persistMemory(recordTweetOutcome(memory, id, outcome, new Date()))
    setNotice(outcome ? 'سُجّلت الأرقام. كلما جمعتَ ثمانياً صارت الدرجة تتعلّم من واقعك لا من تقديري.' : 'مُسحت أرقام هذه التغريدة.')
  }, [memory, persistMemory])

  const markPublished = useCallback((draft: TweetDraft, text: string) => {
    const next = recordPublishedTweet(memory, { ...draft, text, chars: [...text].length }, new Date())
    persistMemory(next)
    setNotice('سُجّلت في الدفتر. لن تُعرض عليك ثانيةً، وزاويتُها صارت أقربَ إلى ذوقك.')
  }, [memory, persistMemory])

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
          resonantLines: resonanceMap.get(article.slug),
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
  }, [bodies, cms.articles, cms.books, cms.media, cms.papers, kind, radar, resonanceMap])

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

  /* حقنُ الدفتر: المسبك يستدعي هاتين لا يعرف Firestore ولا localStorage. */
  const forgeMemory = useMemo(() => ({
    isPublished: (text: string) => isPublished(memory, text),
    affinity: (draft: { angle: TweetAngleId; sourceKind: TweetSourceKind; chars: number }) => tweetTasteAffinity(memory.taste, draft),
  }), [memory])

  const taste = useMemo(() => tasteHighlights(memory.taste, (angle) => TWEET_ANGLES[angle].label), [memory.taste])
  /* المعايرة تُحسب من الدفتر كله مرةً واحدة، وتُمرَّر إلى كل توليد. */
  const calibrations = useMemo(() => buildSignalCalibration(memory.records), [memory.records])
  const calibration = useMemo(() => calibrationMap(calibrations), [calibrations])
  const measured = useMemo(() => outcomeCount(memory), [memory])

  const drafts = useMemo(() => {
    if (weeklyMode || resonanceMode) return []
    if (batchMode) return buildTweetBatch(sources.slice(0, 30), { variation, withHashtags, count: 12, perSource: 1, memory: forgeMemory, calibration })
    if (!activeSource) return []
    return buildTweets(activeSource, { variation, withHashtags, count: 10, memory: forgeMemory, calibration })
  }, [activeSource, batchMode, calibration, forgeMemory, resonanceMode, sources, variation, weeklyMode, withHashtags])

  /* خطة الأسبوع: كل المصادر الحقيقية معاً (لا نوعاً واحداً)، فالأسبوع يُبنى من
     الأرشيف كله. والمناسبة تُقرأ من نواة المواسم المشتركة لا من جدولٍ ثانٍ. */
  const allSources = useMemo<TweetSource[]>(() => [
    ...cms.articles.slice(0, 60).map((article) => ({ kind: 'article' as const, id: article.slug, title: article.title, text: [article.excerpt, article.body || bodies[article.slug] || ''].filter(Boolean).join(' '), url: `${SITE}/articles/${article.slug}`, date: article.iso, resonantLines: resonanceMap.get(article.slug) })),
    ...cms.books.map((book) => ({ kind: 'book' as const, id: book.slug, title: book.title, text: book.desc || '', url: `${SITE}/publications` })),
    ...cms.papers.map((paper) => ({ kind: 'paper' as const, id: paper.slug, title: paper.titleAr || paper.title, text: paper.abstractAr || '', url: paper.url || `${SITE}/research`, outlet: paper.journal || '' })),
    ...radar.slice(0, 10).map((item) => ({ kind: 'news' as const, id: item.id, title: item.ar || item.en || '', text: [item.ar, item.arNote].filter(Boolean).join('. '), url: item.url, outlet: item.source })),
  ], [bodies, cms.articles, cms.books, cms.papers, radar, resonanceMap])

  const weeklyPlan = useMemo(() => {
    if (!weeklyMode) return null
    const start = new Date()
    return buildWeeklyTweetPlan(allSources, {
      startDate: start,
      variation,
      withHashtags,
      memory: forgeMemory,
      calibration,
      occasionOf: (date) => currentSeason(date)?.label || null,
      daysSinceSource: (sourceId) => daysSinceSource(memory, sourceId, start.getTime()),
    })
  }, [allSources, calibration, forgeMemory, memory, variation, weeklyMode, withHashtags])


  const readyCount = drafts.filter((draft) => draft.score >= 78).length
  const verifiedCount = drafts.filter((draft) => draft.quoteVerified).length

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">استوديو التغريدات</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink">تغريداتك من كلامك أنت — لا من كلامٍ يُنسب إليك.</h2>
        <p className="mt-2 text-[.82rem] leading-relaxed text-soft">
          اختر مادةً من أرشيفك أو اكتب فكرةً حرّة؛ يفحص المسبك أربع عشرة زاويةً بلاغيةً ثم يعرض أقوى عشر، كلٌّ بدرجةِ انتشارٍ وأسبابها.
          كل جملةٍ تحمل شارة «موثّقة» موجودةٌ في متنك حرفاً بحرف؛ وما عداها إطارٌ من الاستوديو لا يدّعي عليك قولاً.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {SOURCE_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              onClick={() => { setKind(tab.kind); setSelectedId(''); setBatchMode(false); setWeeklyMode(false); setResonanceMode(false) }}
              className={`min-h-16 rounded-2xl px-3 py-2.5 text-right transition-colors ${kind === tab.kind && !batchMode && !weeklyMode && !resonanceMode ? 'bg-accent text-white' : 'border border-hair bg-wash text-ink hover:border-accent hover:text-accent'}`}
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
            onClick={() => { setBatchMode((current) => !current); setWeeklyMode(false); setThread(null) }}
            disabled={kind === 'free'}
          >ماذا أغرّد اليوم؟ — أفضل ما في الأرشيف</button>
          <button
            type="button"
            className={weeklyMode ? primary : ghost}
            onClick={() => { setWeeklyMode((current) => !current); setBatchMode(false); setThread(null) }}
          >خطة الأسبوع — سبعة أيام</button>
          <button
            type="button"
            className={resonanceMode ? primary : ghost}
            onClick={() => { setResonanceMode((current) => !current); setBatchMode(false); setWeeklyMode(false); setThread(null) }}
            disabled={!resonant.length}
            title={resonant.length ? '' : 'لم يظلّل القرّاء شيئاً بعد — أو لم يصل سجلّ التظليل'}
          >رنين القرّاء{resonant.length ? ` — ${resonant.length} جملة` : ' (لا يوجد بعد)'}</button>
          {activeSource && !batchMode && !weeklyMode && !resonanceMode && (
            <button type="button" className={ghost} onClick={() => setThread(buildThread(activeSource, { variation }))}>ابنِ خيطاً</button>
          )}
        </div>
        {notice && <p className="mt-3 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-2.5 text-[.72rem] text-accent">{notice}</p>}

        {/* الدفتر: ما نُشر وما تعلّمه الاستوديو منه — مفتوحٌ للفحص لا صندوقاً مغلقاً. */}
        <details
          className="mt-4 rounded-2xl border border-hair bg-canvas"
          open={ledgerOpen}
          onToggle={(event) => setLedgerOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[.72rem] font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <span>دفتر ما نُشر — {memory.records.length} تغريدة</span>
            <span className="text-[.64rem] font-normal text-soft">{memory.taste.samples >= 5 ? 'الدفتر يرجّح ترتيب الزوايا الآن' : `يبدأ التعلّم بعد ${Math.max(0, 5 - memory.taste.samples)} تغريدات`}</span>
          </summary>
          <div className="grid gap-3 border-t border-hair p-4">
            {taste.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {taste.map((line) => <span key={line} className="rounded-full bg-violet-50 px-3 py-1.5 text-[.64rem] font-semibold text-violet-700">{line}</span>)}
              </div>
            )}

            {/* حلقة الصدق: ما علّمه الواقعُ للأداة — أو صراحةُ أنه لم يعلّمها بعد. */}
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[.68rem] text-violet-800">ما علّمك إياه الواقع</strong>
                <span className="text-[.6rem] text-violet-700">{measured} تغريدة بأرقام{measured < MIN_OUTCOME_SAMPLES ? ` · تبدأ المعايرة عند ${MIN_OUTCOME_SAMPLES}` : ''}</span>
              </div>
              {calibrations.length === 0
                ? (
                  <p className="mt-2 text-[.62rem] leading-relaxed text-soft">
                    {measured < MIN_OUTCOME_SAMPLES
                      ? `أوزان الإشارات ما زالت تقديري أنا. أدخل أرقام ${MIN_OUTCOME_SAMPLES - measured} تغريدةٍ أخرى من X (زر «أضف أرقامها» تحت كل سجل) فتبدأ الدرجة تُقاس على جمهورك أنت.`
                      : 'الأرقام موجودة لكن لا إشارة بلغت عيّنةً كافيةً في الجانبين (ثلاثٌ مع وثلاثٌ بدون). واصل التسجيل — الصمت هنا أصدق من رقمٍ بلا سند.'}
                  </p>
                )
                : (
                  <div className="mt-2 grid gap-1">
                    {calibrations.slice(0, 6).map((item) => (
                      <span key={item.key} className="flex items-center justify-between gap-3 text-[.62rem]">
                        <span className="text-soft">{SIGNAL_NAMES[item.key] || item.key}</span>
                        <span className={`font-bold ${item.lift >= 1.15 ? 'text-emerald-700' : item.lift <= .85 ? 'text-red-600' : 'text-soft'}`}>
                          ×{item.lift.toFixed(2)} <em className="not-italic text-[.54rem] font-normal text-soft">({item.withSamples} مع · {item.withoutSamples} بدون)</em>
                        </span>
                      </span>
                    ))}
                    <p className="mt-1 text-[.56rem] leading-relaxed text-soft">
                      النسبة = متوسط تفاعل التغريدات التي حملت الإشارة ÷ متوسط التي لم تحملها. وإعادة النشر تزن ثلاثة أضعاف الإعجاب لأنك طلبتَ ما يُعاد تغريده.
                      والتعديل محصورٌ بين ‎×0.6‎ و‎×1.5‎ — الواقع يعدّل تقديري ولا يلغيه.
                    </p>
                  </div>
                )}
            </div>
            {memory.records.length === 0
              ? <p className="text-[.72rem] leading-relaxed text-soft">فارغ. كلما نشرتَ تغريدةً اضغط «نشرتُها ✓» تحتها — عندها لن تُعرض عليك ثانيةً، ويبدأ الاستوديو يتعلّم زواياك المفضّلة.</p>
              : (
                <ul className="grid max-h-72 gap-2 overflow-y-auto">
                  {memory.records.slice(0, 40).map((record) => (
                    <LedgerRow
                      key={record.id}
                      record={record}
                      onSaveOutcome={saveOutcome}
                      onForget={() => { persistMemory(forgetPublishedTweet(memory, record.id)); setNotice('حُذفت من الدفتر — قد تُعرض عليك ثانيةً.') }}
                    />
                  ))}
                </ul>
              )}
          </div>
        </details>
      </section>

      {resonanceMode && (
        <section className={card}>
          <p className="text-[.76rem] font-semibold uppercase text-accent">رنين القرّاء</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">جُملٌ صوّت عليها قرّاؤك بأصابعهم — لا أنا ولا أنت اخترناها.</h3>
          <p className="mt-2 text-[.8rem] leading-relaxed text-soft">
            هذه ما ظلّله الناس في صفحات مقالاتك. كل جملةٍ هنا أثبتت بالفعل أنها تستوقف قارئاً —
            وهذا دليلٌ من الواقع لا يملكه أيّ ترتيبٍ بلاغيّ. اضغط جملةً لتصير تغريدات.
          </p>
          <div className="mt-5 grid gap-3">
            {resonant.slice(0, 24).map((quote) => (
              <div key={`${quote.slug}-${quote.text.slice(0, 24)}`} className="rounded-2xl border border-hair bg-canvas p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[.62rem] font-bold text-amber-800">ظلّلها {quote.count} من القرّاء</span>
                  <span className="truncate text-[.64rem] text-soft">{quote.title}</span>
                </div>
                <p className="mt-2.5 text-[.9rem] leading-relaxed text-ink">«{quote.text}»</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      setResonanceMode(false)
                      setKind('article')
                      setSelectedId(quote.slug)
                      setNotice(`فُتح «${quote.title}» — والجملة التي ظلّلها ${quote.count} قارئاً تتصدّر زواياه الآن.`)
                    }}
                  >اصنع منها تغريدات ←</button>
                  <button
                    type="button"
                    className={ghost}
                    onClick={() => {
                      const seed = { idea: `«${quote.text}»`, purpose: `اقتباس انتخبه ${quote.count} من القرّاء بتظليلهم من مقال «${quote.title}»`, at: new Date().toISOString() }
                      try { localStorage.setItem('studio-standalone-seed', JSON.stringify(seed)) } catch { /* الخزن ليس شرطاً */ }
                      window.dispatchEvent(new CustomEvent('studio:standalone-seed', { detail: seed }))
                      setNotice('أُرسلت إلى «منشور مستقل» لتصير تصميماً.')
                    }}
                  >صمّمها مباشرةً</button>
                </div>
              </div>
            ))}
            {!resonant.length && <p className="text-[.78rem] text-soft">لم يصل سجلّ التظليل بعد، أو لم يظلّل أحدٌ شيئاً حتى الآن.</p>}
          </div>
        </section>
      )}

      {weeklyPlan && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">خطة الأسبوع</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">
                {weeklyPlan.filled} من ٧ أيامٍ ممتلئة · متوسط الدرجة {weeklyPlan.averageScore}٪
              </h3>
              <p className="mt-1 text-[.68rem] leading-relaxed text-soft">مادةٌ مختلفة وزاويةٌ مختلفة لكل يوم. الخبر الراهن يتقدّم، والمناسبة تأخذ يومها، واليوم الذي لا يجد مادةً يبقى فارغاً بصراحة.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {weeklyPlan.days.map((day) => (
              <div key={day.iso} className="grid gap-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <strong className="text-[.74rem] text-ink">{day.offset === 0 ? 'اليوم' : day.dayLabel}</strong>
                  {day.occasion && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[.58rem] font-bold text-amber-800">{day.occasion}</span>}
                </div>
                <p className="px-1 text-[.62rem] leading-relaxed text-soft">{day.reason}</p>
                {day.draft
                  ? <TweetCard draft={day.draft} source={allSources.find((source) => source.id === day.draft?.sourceId)} onCopied={setNotice} onPublished={markPublished} />
                  : <div className="rounded-[1.35rem] border border-dashed border-hair bg-canvas p-5 text-center text-[.7rem] text-soft">يومٌ بلا تغريدة</div>}
              </div>
            ))}
          </div>
          {weeklyPlan.skipped.length > 0 && (
            <p className="mt-5 text-[.64rem] leading-relaxed text-soft">استُبعدت لأنها نُشرت قريباً: {weeklyPlan.skipped.join(' · ')}</p>
          )}
        </section>
      )}

      {kind === 'free' && !batchMode && !weeklyMode && !resonanceMode && (
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

      {kind !== 'free' && !batchMode && !weeklyMode && !resonanceMode && (
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

      {!weeklyMode && !resonanceMode && <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[.7rem] font-semibold text-accent">{batchMode ? 'أقوى ما في الأرشيف اليوم' : 'الزوايا الجاهزة'}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">
              {drafts.length ? `${drafts.length} تغريدة · ${readyCount} منها في نطاق الانتشار · ${verifiedCount} بجملةٍ موثّقة` : 'لا تغريدات بعد'}
            </h3>
          </div>
        </div>
        {drafts.length
          ? <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{drafts.map((draft) => <TweetCard key={draft.id} draft={draft} source={allSources.find((source) => source.id === draft.sourceId)} onCopied={setNotice} onPublished={markPublished} />)}</div>
          : (
            <p className="mt-4 text-[.78rem] leading-relaxed text-soft">
              {kind === 'free'
                ? 'اكتب فكرتك أعلاه (٤٠ حرفاً فأكثر) وستظهر الزوايا فوراً.'
                : 'اختر مادةً من القائمة. المواد القصيرة جداً قد لا تكفي لبناء زاوية — والمحرك يصمت بدل أن يخترع.'}
            </p>
          )}
      </section>}
    </div>
  )
}
