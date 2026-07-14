import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { books, papers } from '../../data'
import podcastAdmin from '../../data/podcast-admin.json'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { fetchExtras, fetchPublishedExtras, getDb } from '../../lib/firebase'
import { useAdminAuth } from '../../lib/admin-auth'
import {
  articleSystem,
  automaticSeries,
  ideaLab,
  monthlyPlan,
} from '../../lib/intelligence'

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const softBtn = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent'
const primaryBtn = 'rounded-full bg-accent px-5 py-2 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const adminAudioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const adminAudioUrl = (path: string) => adminAudioBase ? `${adminAudioBase}/${path.replace(/^\/?audio\//, '')}` : path

function CopyButton({ value, label = 'نسخ' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        window.setTimeout(() => setDone(false), 1800)
      }}
      className={softBtn}
    >
      {done ? 'تم النسخ ✓' : label}
    </button>
  )
}

function SmallList({ title, items, path }: { title: string; items: { slug: string; title: string }[]; path: string }) {
  return (
    <div>
      <p className="text-[.76rem] font-semibold text-accent">{title}</p>
      {items.length ? (
        <ul className="mt-2 grid gap-1.5">
          {items.map((item) => (
            <li key={item.slug}>
              <a href={`${path}/${item.slug}`} target="_blank" rel="noreferrer" className="text-[.84rem] leading-relaxed text-ink transition-colors hover:text-accent">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[.84rem] text-soft">لا رابط واضح بعد.</p>}
    </div>
  )
}

function LabLayer({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-hair bg-canvas p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-hair pb-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">طبقة عمل</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">{title}</h2>
        </div>
        <p className="max-w-2xl text-[.86rem] leading-relaxed text-soft">{note}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  )
}

function ToolDetails({
  title,
  note,
  children,
  defaultOpen = false,
}: {
  title: string
  note: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className={`${card} group`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block font-display text-lg font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-[.82rem] leading-relaxed text-soft">{note}</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 border-t border-hair pt-5">{children}</div>
    </details>
  )
}

function ReadinessCard({ articles }: { articles: ArticleRecord[] }) {
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState<{ label: string; ok: boolean; note: string }[]>([])

  const run = async () => {
    setBusy(true)
    const test = async (url: string, contains?: string) => {
      try {
        const response = await fetch(url, { cache: 'no-store' })
        const text = await response.text()
        return response.ok && (!contains || text.includes(contains))
      } catch { return false }
    }
    const [sitemap, rss, podcast, robots] = await Promise.all([
      test('/sitemap.xml', '<urlset'),
      test('/feed.xml', '<rss'),
      test('/podcast.xml', '<rss'),
      test('/robots.txt', 'Sitemap:'),
    ])
    const withAudio = articles.filter((article) => article.hasAudio).length
    const missingImages = books.filter((book) => !book.cover).length
    setChecks([
      { label: 'Sitemap', ok: sitemap, note: sitemap ? 'يفتح ويحتوي XML.' : 'يحتاج نشر/توليد.' },
      { label: 'RSS', ok: rss, note: rss ? 'الخلاصة متاحة.' : 'الخلاصة غير متاحة.' },
      { label: 'Podcast', ok: podcast, note: podcast ? 'خلاصة البودكاست متاحة.' : 'خلاصة البودكاست غير متاحة.' },
      { label: 'Robots', ok: robots, note: robots ? 'يوجه لمحركات البحث.' : 'يحتاج مراجعة.' },
      { label: 'الصوت', ok: withAudio === articles.length, note: `${withAudio} من ${articles.length} مقالاً لديها صوت.` },
      { label: 'الصور', ok: missingImages === 0, note: missingImages ? `${missingImages} غلاف يحتاج مراجعة.` : 'أغلفة الكتب متاحة.' },
    ])
    setBusy(false)
  }

  const ok = checks.length && checks.every((check) => check.ok)
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">جاهزية النشر</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{ok ? 'جاهز للنشر.' : checks.length ? 'يحتاج انتباه.' : 'فحص هادئ قبل الإطلاق.'}</h2>
        </div>
        <button type="button" onClick={run} disabled={busy} className={primaryBtn}>{busy ? 'أفحص…' : 'افحص الآن'}</button>
      </div>
      {checks.length > 0 && (
        <ul className="mt-5 grid gap-2 md:grid-cols-2">
          {checks.map((check) => (
            <li key={check.label} className="rounded-xl border border-hair bg-canvas px-4 py-3">
              <span className={`me-2 ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : '!'}</span>
              <span className="font-semibold text-ink">{check.label}</span>
              <p className="mt-1 text-[.78rem] text-soft">{check.note}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function IdeaLabCard({ articles }: { articles: ArticleRecord[] }) {
  const [idea, setIdea] = useState('الخوف من الامتحان')
  const result = useMemo(() => ideaLab(idea, articles, books, papers), [articles, idea])
  const bundle = [
    `عنوان أقوى: ${result.title}`,
    `زاوية: ${result.angle}`,
    `مقال قصير:\n${result.shortArticle}`,
    `LinkedIn:\n${result.linkedin}`,
    `بودكاست:\n${result.podcast}`,
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">مختبر الفكرة</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">اكتب فكرة خاماً… والموقع يردّ من أرشيفك.</h2>
      <input className={`${input} mt-5`} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="مثال: الذكاء الاصطناعي في التعليم" />
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,.8fr)]">
        <div className="rounded-2xl border border-hair bg-canvas p-5">
          <p className="font-display text-lg font-semibold text-ink">{result.title}</p>
          <p className="mt-3 text-[.9rem] leading-relaxed text-soft">{result.angle}</p>
          <div className="mt-4 whitespace-pre-wrap text-[.9rem] leading-loose text-ink">{result.shortArticle}</div>
          <div className="mt-4 flex flex-wrap gap-2"><CopyButton value={bundle} label="نسخ الحزمة" /></div>
        </div>
        <div className="grid gap-4">
          <SmallList title="مقالات مرتبطة" items={result.relatedArticles} path="/articles" />
          <SmallList title="أبحاث مناسبة" items={result.relatedPapers} path="/research" />
          <SmallList title="كتب قريبة" items={result.relatedBooks} path="/publications" />
        </div>
      </div>
    </section>
  )
}

function ArticleSystemCard({ articles }: { articles: ArticleRecord[] }) {
  const [slug, setSlug] = useState(articles[0]?.slug || '')
  const article = articles.find((item) => item.slug === slug) || articles[0]
  const result = useMemo(() => article ? articleSystem(article, articles, books, papers) : null, [article, articles])
  if (!article || !result) return null
  const full = [
    `مختصر:\n${result.summary}`,
    `نسخة أكاديمية:\n${result.academic}`,
    `X:\n${result.xPost}`,
    `LinkedIn:\n${result.linkedin}`,
    `فيديو دقيقة:\n${result.videoScript}`,
    `سؤال طلاب:\n${result.studentQuestion}`,
    `شريحة:\n${result.slide}`,
    `بودكاست:\n${result.podcast}`,
    `اقتباسات:\n${result.quotes.join('\n')}`,
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">تحويل المقال إلى منظومة</p>
      <select className={`${input} mt-4`} value={article.slug} onChange={(event) => setSlug(event.target.value)}>
        {articles.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
      </select>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          ['نسخة مختصرة', result.summary],
          ['منشور LinkedIn', result.linkedin],
          ['نص فيديو دقيقة', result.videoScript],
          ['سؤال للطلاب', result.studentQuestion],
        ].map(([title, text]) => (
          <div key={title} className="rounded-xl border border-hair bg-canvas p-4">
            <p className="font-semibold text-ink">{title}</p>
            <p className="mt-2 text-[.86rem] leading-relaxed text-soft">{text}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><CopyButton value={full} label="نسخ المنظومة كاملة" /></div>
    </section>
  )
}

function AudioControlCard({ articles }: { articles: ArticleRecord[] }) {
  const noAudio = articles.filter((article) => !article.hasAudio)
  const withAudio = articles.filter((article) => article.hasAudio)
  const podcast = podcastAdmin as {
    episodes: { slug: string; title: string; status: string; audio: string; hasTranscript: boolean; utterances: number; quality?: { score?: number; pass?: boolean; pronunciation?: string; pace?: string; pauses?: string; issues?: string[]; metrics?: { durationSeconds?: number; importantRatio?: number | null; longSilences?: number | null } } }[]
    playlists: { title: string; episodes: { slug: string; title: string }[] }[]
  }
  return (
    <ToolDetails title="غرفة التحكم الصوتية" note="خاصة لك فقط: تلخص حالة الصوت، ولا تنشر حلقة جديدة من المتصفح." defaultOpen>
      <div className="grid grid-cols-2 gap-3">
        <span className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-accent">{withAudio.length}</strong><small className="text-soft">مقالات بصوت</small></span>
        <span className="rounded-xl border border-hair bg-canvas p-4"><strong className="block font-display text-2xl text-ink">{noAudio.length}</strong><small className="text-soft">تحتاج صوت</small></span>
      </div>
      <p className="mt-4 text-[.84rem] leading-relaxed text-soft">الحلقات الحوارية المعتمدة تبقى في خلاصة البودكاست فقط بعد اجتياز بوابة الجودة. إعادة التوليد تتم من سكربت الصوت حتى لا نضيف زرًا خطيرًا داخل المتصفح.</p>
      <div className="mt-5 grid gap-3">
        <p className="text-[.78rem] font-semibold text-accent">الحلقات الحوارية المنشورة</p>
        {podcast.episodes.length ? podcast.episodes.map((episode) => (
          <div key={episode.slug} className="rounded-xl border border-hair bg-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{episode.title}</p>
                <p className="mt-1 text-[.78rem] text-soft">
                  الحالة: {episode.status === 'published' ? 'منشورة' : episode.status}
                  {' · '}Transcript: {episode.hasTranscript ? `${episode.utterances} مداخلة` : 'غير موجود'}
                  {' · '}Score: {episode.quality?.score ?? 0}/100
                </p>
                {episode.quality?.metrics && (
                  <p className="mt-1 text-[.74rem] text-soft">
                    مدة: {episode.quality.metrics.durationSeconds || '—'}ث
                    {' · '}تطابق مهم: {episode.quality.metrics.importantRatio ?? '—'}٪
                    {' · '}وقفات طويلة: {episode.quality.metrics.longSilences ?? '—'}
                  </p>
                )}
                {episode.quality?.issues?.length ? <p className="mt-1 text-[.78rem] text-soft">{episode.quality.issues[0]}</p> : null}
              </div>
              <a href={adminAudioUrl(episode.audio)} target="_blank" rel="noreferrer" className={softBtn}>استماع</a>
            </div>
          </div>
        )) : (
          <p className="rounded-xl border border-hair bg-canvas p-4 text-[.84rem] text-soft">لا توجد حلقات حوارية منشورة بعد.</p>
        )}
      </div>
      <div className="mt-5 grid gap-3">
        <p className="text-[.78rem] font-semibold text-accent">قوائم استماع فكرية</p>
        {podcast.playlists.length ? podcast.playlists.map((playlist) => (
          <div key={playlist.title} className="rounded-xl border border-hair bg-canvas p-4">
            <p className="font-semibold text-ink">{playlist.title}</p>
            <ul className="mt-2 grid gap-1 text-[.82rem] text-soft">
              {playlist.episodes.map((episode) => <li key={episode.slug}>• {episode.title}</li>)}
            </ul>
          </div>
        )) : (
          <p className="rounded-xl border border-hair bg-canvas p-4 text-[.84rem] text-soft">ستُبنى القوائم تلقائيًا مع زيادة الحلقات الحوارية.</p>
        )}
      </div>
      <div className="mt-5 rounded-xl border border-hair bg-canvas p-4">
        <p className="font-semibold text-ink">اعتماد الصوت قبل النشر</p>
        <p className="mt-2 text-[.84rem] leading-relaxed text-soft">
          المقارنة العمياء للأصوات موجودة في بطاقة «اختبار الأصوات» أعلى لوحة المؤشرات. بعد اعتماد زوج صوتي، يستخدمه سكربت الحوار الليلي للحلقات التالية. هذه الغرفة تعرض ما نُشر فقط ولا تعتمد صوتًا جديدًا من المتصفح.
        </p>
      </div>
    </ToolDetails>
  )
}

function MonthlyPlanDetails({ articles }: { articles: ArticleRecord[] }) {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { month: 'long', year: 'numeric' }).format(now)
  const plan = useMemo(() => monthlyPlan(articles, books, papers, now), [articles, period])
  return (
    <ToolDetails title={`خطة ${monthLabel}`} note="تتبدّل تلقائيًا مع بداية كل شهر، وتنوّع بين التصنيفات والأرشيف والزوايا الجديدة.">
      <ol className="grid gap-2 md:grid-cols-2">
        {plan.map((week) => (
          <li key={`${week.period}-${week.week}`} className="rounded-xl border border-hair bg-canvas p-4 text-[.84rem] leading-relaxed">
            <span className="font-semibold text-accent">الأسبوع {week.week}: </span>
            <span className="text-ink">{week.article.title}</span>
            <span className="mt-1 block text-soft">{week.action}</span>
            <span className="mt-1 block text-[.76rem] text-soft">المرافق: {week.companion}</span>
          </li>
        ))}
      </ol>
    </ToolDetails>
  )
}

function SeriesDetails({ articles }: { articles: ArticleRecord[] }) {
  const series = useMemo(() => automaticSeries(articles), [articles])
  return (
    <ToolDetails title="سلاسل فكرية تلقائية" note="ترتيب داخلي يساعدك على رؤية المسارات. لا يظهر للناس إلا إذا حوّلناه لاحقًا إلى صفحة عامة.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {series.map((group) => (
          <div key={group.title} className="rounded-xl border border-hair bg-canvas p-4">
            <p className="font-display text-lg font-semibold text-ink">{group.title}</p>
            <ul className="mt-3 grid gap-1.5">
              {group.items.slice(0, 4).map((item) => <li key={item.slug}><a className="text-[.83rem] text-soft hover:text-accent" href={`/articles/${item.slug}`} target="_blank" rel="noreferrer">{item.title}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
    </ToolDetails>
  )
}

type NowAdminItem = {
  id: string
  question?: string
  note?: string
  link?: string
  status?: string
  duration?: string
  createdAt?: { seconds?: number }
  expiresAt?: { seconds?: number } | null
}

const expiresLabel = (item: NowAdminItem) => {
  if (!item.expiresAt?.seconds) return 'دائمة'
  const date = new Date(item.expiresAt.seconds * 1000)
  return date.getTime() < Date.now() ? 'انتهت' : `حتى ${date.toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' })}`
}

function NowCard() {
  const { isAdmin, refresh, user } = useAdminAuth()
  const [form, setForm] = useState({ question: '', note: '', link: '', duration: '14' })
  const [items, setItems] = useState<NowAdminItem[]>([])
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const serverRequest = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>, id?: string) => {
    if (!user) return null
    const token = await user.getIdToken()
    const query = id ? `?id=${encodeURIComponent(id)}` : ''
    const response = await fetch(`/api/admin/site-now${query}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
    if (response.status === 404) return null
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(payload?.error || 'تعذّر تنفيذ العملية عبر الخادم.')
    }
    if (response.status === 204) return { ok: true }
    return response.json().catch(() => ({ ok: true }))
  }

  const load = async () => {
    try {
      if (user) {
        const payload = await serverRequest('GET') as { items?: NowAdminItem[] } | null
        if (payload?.items) {
          setItems(payload.items.slice(0, 8))
          setError('')
          return
        }
      }
      const value = await fetchExtras<NowAdminItem>('site_now')
      setItems(value.slice(0, 8))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر جلب الأفكار المحفوظة.')
    }
  }
  useEffect(() => { void load() }, [user])

  const save = async () => {
    setError('')
    setSaved('')
    if (!form.question.trim()) {
      setError('اكتب السؤال أو الفكرة أولاً.')
      return
    }
    setBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('صلاحية المشرف غير مفعّلة في جلسة المتصفح. سجّل خروجك وادخل من جديد أو شغّل set-admin.')
      const serverResult = await serverRequest('POST', { ...form, status: 'published' })
      if (!serverResult) {
        const db = await getDb()
        if (!db) throw new Error('Firebase غير متاح الآن.')
        const { Timestamp, collection, addDoc, serverTimestamp } = await import('firebase/firestore')
        const days = form.duration === 'forever' ? 0 : Number(form.duration || 14)
        const expiresAt = days ? Timestamp.fromDate(new Date(Date.now() + days * 86_400_000)) : null
        await addDoc(collection(db, 'site_now'), { ...form, status: 'published', expiresAt, createdAt: serverTimestamp() })
      }
      setForm({ question: '', note: '', link: '', duration: '14' })
      setSaved('حُفظت الفكرة في صفحة ماذا أفكر الآن ✓')
      await load()
      window.setTimeout(() => setSaved(''), 2500)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'فشل الحفظ.'
      setError(message.includes('permission') || message.includes('Missing or insufficient permissions')
        ? 'تعذّر الحفظ بسبب صلاحيات قاعدة البيانات. تأكد من نشر الخادم الجديد ثم أعد تسجيل الدخول.'
        : message)
    } finally {
      setBusy(false)
    }
  }

  const hide = async (id: string) => {
    try {
      const result = await serverRequest('PATCH', { id, status: 'hidden' })
      if (!result) {
        const db = await getDb()
        if (!db) return
        const { doc, updateDoc } = await import('firebase/firestore')
        await updateDoc(doc(db, 'site_now', id), { status: 'hidden' })
      }
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر إخفاء الفكرة.')
    }
  }

  const remove = async (id: string) => {
    try {
      const result = await serverRequest('DELETE', undefined, id)
      if (!result) {
        const db = await getDb()
        if (!db) return
        const { deleteDoc, doc } = await import('firebase/firestore')
        await deleteDoc(doc(db, 'site_now', id))
      }
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حذف الفكرة.')
    }
  }
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">ماذا أفكر الآن؟</p>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input className={input} value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} placeholder="سؤال يشغلني" />
        <input className={input} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="ملاحظة قصيرة" />
        <input className={input} dir="ltr" value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} placeholder="/articles/..." />
        <select className={`${input} min-w-[8.5rem]`} value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} aria-label="مدة ظهور الفكرة">
          <option value="7">٧ أيام</option>
          <option value="14">١٤ يومًا</option>
          <option value="forever">دائم</option>
        </select>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className={primaryBtn}>{busy ? 'أحفظ…' : 'حفظ فكرة'}</button>
        {saved && <span className="text-[.82rem] text-accent">{saved}</span>}
      </div>
      {error && <p className="mt-3 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.82rem] leading-relaxed text-soft">{error}</p>}
      <div className="mt-6 border-t border-hair pt-4">
        <p className="text-[.78rem] font-semibold text-soft">آخر الأفكار المحفوظة</p>
        {items.length ? (
          <ol className="mt-3 grid gap-2">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[.9rem] font-semibold text-ink">{item.question || 'فكرة بلا عنوان'}</p>
                  <p className="mt-0.5 text-[.74rem] text-soft">
                    {item.status === 'published' ? 'ظاهرة' : 'مخفية'} · {expiresLabel(item)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.status === 'published' && <button type="button" onClick={() => hide(item.id)} className={softBtn}>إخفاء</button>}
                  <button type="button" onClick={() => remove(item.id)} className="rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-red-400 hover:text-red-500">حذف</button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] text-soft">لا توجد أفكار محفوظة بعد.</p>
        )}
      </div>
    </section>
  )
}

type RadarItem = { id: string; ar?: string; arNote?: string; source?: string; url?: string }
function DoctorRadarCard({ articles }: { articles: ArticleRecord[] }) {
  const [items, setItems] = useState<RadarItem[]>([])
  useEffect(() => {
    let active = true
    fetchPublishedExtras<RadarItem>('site_radar').then((value) => { if (active) setItems(value.slice(0, 5)) })
    return () => { active = false }
  }, [])
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">رادار الدكتور</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">خمس لقطات تستحق تعليقك.</h2>
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item) => {
          const related = ideaLab(`${item.ar || ''} ${item.arNote || ''}`, articles, books, papers).relatedArticles[0]
          const draft = `تعليق مقترح:\n${item.ar}\n\nاللافت هنا أنه لا يتعلق بالخبر وحده، بل بسؤال أعمق: ماذا يحدث للإنسان عندما تتغير أدوات التعليم؟${related ? `\n\nيرتبط هذا بما كتبته في: ${related.title}` : ''}`
          return (
            <div key={item.id} className="rounded-xl border border-hair bg-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[.9rem] font-semibold leading-relaxed text-ink">{item.ar}</p>
                  {item.arNote && <p className="mt-1 text-[.82rem] leading-relaxed text-soft">{item.arNote}</p>}
                  {related && (
                    <a href={`/articles/${related.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[.78rem] text-accent transition-colors hover:text-accent-deep">
                      يرتبط بمقال: {related.title} ←
                    </a>
                  )}
                </div>
                <CopyButton value={draft} label="اكتب تعليقاً" />
              </div>
            </div>
          )
        }) : <p className="rounded-xl border border-hair bg-canvas p-4 text-[.86rem] text-soft">تظهر هنا لقطات الرادار بعد تشغيل/نشر الرادار اليومي.</p>}
      </div>
    </section>
  )
}

function AudioQualityGateCard() {
  const episodes = (podcastAdmin as { episodes?: { slug: string; title: string; status: string; hasTranscript?: boolean; bytes?: number; quality?: { score?: number; pass?: boolean; pronunciation?: string; pace?: string; pauses?: string; issues?: string[]; metrics?: { durationSeconds?: number; sttRatio?: number | null; importantRatio?: number | null; longSilences?: number | null; peakDb?: number | null } } }[] }).episodes || []
  const blocked = episodes.filter((episode) => episode.status !== 'published')
  const averageScore = episodes.length ? Math.round(episodes.reduce((sum, episode) => sum + Number(episode.quality?.score || 0), 0) / episodes.length) : 0
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">بوابة صوت</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">لا تعتمد أي حلقة إلا بعد Score واضح.</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-hair bg-canvas p-4"><span className="block font-display text-2xl text-accent">{episodes.length}</span><span className="text-[.78rem] text-soft">حلقات حوارية</span></div>
        <div className="rounded-xl border border-hair bg-canvas p-4"><span className="block font-display text-2xl text-accent">{episodes.length - blocked.length}</span><span className="text-[.78rem] text-soft">منشورة</span></div>
        <div className="rounded-xl border border-hair bg-canvas p-4"><span className="block font-display text-2xl text-accent">{blocked.length}</span><span className="text-[.78rem] text-soft">تحت المراجعة</span></div>
        <div className="rounded-xl border border-hair bg-canvas p-4"><span className="block font-display text-2xl text-accent">{averageScore}</span><span className="text-[.78rem] text-soft">متوسط الجودة</span></div>
      </div>
      <p className="mt-4 text-[.86rem] leading-relaxed text-soft">
        البوابة تفحص النطق والمعنى، سرعة الحلقة، الوقفات، Transcript، حجم الملف، والرابط الدائم. أي حلقة أقل من 92/100 أو بلا تقرير جودة تبقى تحت المراجعة ولا تدخل RSS.
      </p>
      {blocked.length ? (
        <ol className="mt-4 grid gap-2">
          {blocked.slice(0, 5).map((episode) => (
            <li key={episode.slug} className="rounded-xl border border-hair bg-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{episode.title}</p>
                  <p className="mt-1 text-[.76rem] text-soft">
                    النطق: {episode.quality?.pronunciation || '—'}
                    {' · '}السرعة: {episode.quality?.pace || '—'}
                    {' · '}الوقفات: {episode.quality?.pauses || '—'}
                  </p>
                  {episode.quality?.metrics && (
                    <p className="mt-1 text-[.74rem] text-soft">
                      مدة: {episode.quality.metrics.durationSeconds || '—'}ث
                      {' · '}STT مهم: {episode.quality.metrics.importantRatio ?? '—'}٪
                      {' · '}وقفات طويلة: {episode.quality.metrics.longSilences ?? '—'}
                    </p>
                  )}
                  <p className="mt-1 text-[.78rem] text-soft">{episode.quality?.issues?.join(' · ') || 'تحتاج اعتماد الجودة قبل النشر.'}</p>
                </div>
                <span className="rounded-full border border-hair px-3 py-1.5 font-display text-lg text-accent">{episode.quality?.score ?? 0}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 rounded-xl border border-hair bg-canvas p-4 text-[.84rem] text-soft">كل الحلقات الحوارية المنشورة اجتازت البوابة.</p>}
    </section>
  )
}

export function IntelligenceLab({ articles }: { articles: ArticleRecord[] }) {
  const [richArticles, setRichArticles] = useState<ArticleRecord[]>(articles)
  const [view, setView] = useState<'before' | 'develop' | 'system'>('before')

  useEffect(() => {
    let active = true
    setRichArticles(articles)
    loadArticleBodies()
      .then((bodies) => {
        if (!active) return
        setRichArticles(articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })))
      })
      .catch(() => {
        if (active) setRichArticles(articles)
      })
    return () => { active = false }
  }, [articles])

  return (
    <div className="grid gap-5">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">المختبر المتقدم</p>
        <p className="mt-2 text-[.88rem] leading-relaxed text-soft">الأدوات نفسها باقية، لكنها موزعة على ثلاث غرف حتى لا تظهر كلها في شاشة واحدة.</p>
        <div className="rail mt-5 flex gap-2 overflow-x-auto pb-1">
          {([['before','قبل النشر'],['develop','تطوير الفكرة'],['system','تحويل المقال والصوت']] as const).map(([key,label]) => <button key={key} type="button" onClick={() => setView(key)} className={`shrink-0 rounded-full px-4 py-2 text-[.8rem] font-semibold ${view === key ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft'}`}>{label}</button>)}
        </div>
      </section>

      {view === 'before' && <LabLayer title="قبل النشر" note="فحص الجاهزية وخطة نشر تتغير تلقائيًا كل شهر."><ReadinessCard articles={richArticles} /><MonthlyPlanDetails articles={richArticles} /></LabLayer>}

      {view === 'develop' && <LabLayer title="تطوير الفكرة" note="مساحة هادئة لتطوير سؤال أو خبر أو ملاحظة، وربطه بتاريخك الفكري."><IdeaLabCard articles={richArticles} /><DoctorRadarCard articles={richArticles} /><SeriesDetails articles={richArticles} /><ToolDetails title="ماذا أفكر الآن؟" note="هذه الأداة الوحيدة هنا التي تحفظ شيئًا يمكن أن يظهر للعامة إذا ضغطت حفظ."><NowCard /></ToolDetails></LabLayer>}

      {view === 'system' && <LabLayer title="تحويل المقال إلى منظومة" note="تحويل المقال الواحد إلى محاضرة، منشورات، سؤال طلاب، وبودكاست — من دون نشر تلقائي."><ArticleSystemCard articles={richArticles} /><AudioQualityGateCard /><AudioControlCard articles={richArticles} /></LabLayer>}
    </div>
  )
}
