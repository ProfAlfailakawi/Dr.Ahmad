import { useEffect, useMemo, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import {
  LIVE_DIRECTOR_REPAIR_ISSUES,
  createArticleVideoProject,
  createPublicVideoProject,
  isValidYouTubeUrl,
  liveDirectorDailyPlan,
  repairLiveDirectorSegment,
  setLiveDirectorSegmentStatus,
  type LiveDirectorClipStatus,
  type LiveDirectorPlatform,
  type LiveDirectorProject,
  type LiveDirectorTone,
} from '../../lib/live-director'

type DirectorPath = 'article' | 'public' | null
type StoredProject = LiveDirectorProject & { userId?: string }

const card = 'min-w-0 rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.86rem] text-ink outline-none transition placeholder:text-soft/55 focus:border-accent'
const primary = 'min-h-11 rounded-full bg-accent px-6 py-2.5 text-[.8rem] font-semibold text-white transition hover:bg-accent-deep disabled:opacity-45'
const ghost = 'min-h-10 rounded-full border border-hair bg-canvas px-4 py-2 text-[.72rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-45'

const CLIP_STATUS_LABELS: Record<LiveDirectorClipStatus, string> = {
  not_generated: 'لم يولّد',
  generated: 'تم التوليد',
  needs_revision: 'يحتاج إعادة',
  approved: 'معتمد',
  uploaded: 'تم رفع الفيديو',
}

const PLATFORMS: LiveDirectorPlatform[] = ['متعدد المنصات', 'Instagram Reels', 'X', 'YouTube Shorts', 'LinkedIn', 'TikTok']
const TONES: LiveDirectorTone[] = ['فكرية', 'تربوية', 'إنسانية', 'صادمة', 'إعلامية', 'أكاديمية مبسطة', 'مستقبلية', 'ساخرة بذكاء']

function fileExtension(file: File) {
  const typed = file.type === 'video/mp4' ? 'mp4' : file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  return typed
}

function safeTimestamp(value: unknown) {
  if (value && typeof value === 'object' && 'seconds' in value) return Number((value as { seconds?: number }).seconds || 0)
  return 0
}

export function LiveDirector({ articles }: { articles: ArticleRecord[] }) {
  const { user } = useAdminAuth()
  const [path, setPath] = useState<DirectorPath>(null)
  const [articleSlug, setArticleSlug] = useState(articles[0]?.slug || '')
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [audience, setAudience] = useState('الجمهور العام')
  const [platform, setPlatform] = useState<LiveDirectorPlatform>('متعدد المنصات')
  const [tone, setTone] = useState<LiveDirectorTone>('فكرية')
  const [useAvatar, setUseAvatar] = useState(true)
  const [wantsSeries, setWantsSeries] = useState(false)
  const [linkedArticleSlug, setLinkedArticleSlug] = useState('')
  const [source, setSource] = useState('')
  const [sourceSessionId, setSourceSessionId] = useState('')
  const [linkedEditorialDecisionId, setLinkedEditorialDecisionId] = useState('')
  const [linkedCampaignId, setLinkedCampaignId] = useState('')
  const [project, setProject] = useState<LiveDirectorProject | null>(null)
  const [projects, setProjects] = useState<StoredProject[]>([])
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [repairIssue, setRepairIssue] = useState<Record<string, (typeof LIVE_DIRECTOR_REPAIR_ISSUES)[number]>>({})
  const [youtubeDraft, setYoutubeDraft] = useState('')

  const selectedArticle = articles.find((article) => article.slug === articleSlug) || null
  const linkedArticle = articles.find((article) => article.slug === linkedArticleSlug) || null
  const dailyPlan = useMemo(() => project ? liveDirectorDailyPlan(project) : [], [project])

  const loadProjects = async () => {
    try {
      const db = await getDb(); if (!db) return
      const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, 'admin_live_director_projects'), orderBy('updatedAt', 'desc'), limit(12)))
      setProjects(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<StoredProject, 'id'>) })).sort((left, right) => safeTimestamp((right as unknown as { updatedAt?: unknown }).updatedAt) - safeTimestamp((left as unknown as { updatedAt?: unknown }).updatedAt)))
    } catch { /* أول تشغيل قبل نشر القواعد: المشروع الحالي يبقى محلياً */ }
  }

  useEffect(() => { void loadProjects() }, [])

  const applySeed = (seed: Record<string, unknown> | null) => {
    if (!seed) return
    const seededSource = String(seed.source || '')
    const seededSessionId = String(seed.sourceSessionId || '')
    const seededDecisionId = String(seed.editorialDecisionId || seed.linkedEditorialDecisionId || '')
    const seededCampaignId = String(seed.campaignId || seed.linkedCampaignId || '')
    setSource(seededSource); setSourceSessionId(seededSessionId); setLinkedEditorialDecisionId(seededDecisionId); setLinkedCampaignId(seededCampaignId)
    if (seed.type === 'article_video' || seed.articleSlug) {
      const slug = String(seed.articleSlug || '')
      if (slug) setArticleSlug(slug)
      setPath('article')
      if (seed.article && typeof seed.article === 'object' && !Array.isArray(seed.article)) {
        const draft = seed.article as Record<string, unknown>
        const body = String(draft.body || '')
        const temporary: ArticleRecord = {
          slug: String(draft.slug || slug || `room-draft-${Date.now()}`),
          title: String(draft.title || seed.title || 'مسودة فيديو مقال'),
          date: '', iso: new Date().toISOString().slice(0, 10), cat: String(draft.cat || 'التعليم'),
          excerpt: String(draft.excerpt || seed.message || ''), body, status: 'draft',
          words: body.trim().split(/\s+/).filter(Boolean).length, year: String(new Date().getFullYear()), hasAudio: false, missing: false,
          _cms: { kind: 'article', origin: 'added', modified: true, hidden: true, deleted: false, docId: String(draft.slug || slug || 'room-draft'), baseSlug: String(draft.slug || slug || 'room-draft') },
        }
        setProject(createArticleVideoProject({ article: temporary, audience, platform, tone, useAvatar, source: seededSource, sourceSessionId: seededSessionId, linkedEditorialDecisionId: seededDecisionId, linkedCampaignId: seededCampaignId }))
      }
    } else {
      setPath('public')
      setTopic(String(seed.topic || seed.idea || ''))
      setMessage(String(seed.message || seed.purpose || ''))
      if (seed.audience) setAudience(String(seed.audience))
    }
    try { sessionStorage.removeItem('admin:live-director-seed') } catch { /* noop */ }
  }

  useEffect(() => {
    const onSeed = (event: Event) => applySeed((event as CustomEvent).detail || null)
    window.addEventListener('studio:live-director-seed', onSeed)
    try {
      const stored = sessionStorage.getItem('admin:live-director-seed')
      if (stored) applySeed(JSON.parse(stored))
    } catch { /* بذرة تالفة لا توقف الاستوديو */ }
    return () => window.removeEventListener('studio:live-director-seed', onSeed)
  }, [articles.length])

  const buildProject = () => {
    setNotice('')
    if (path === 'article') {
      if (!selectedArticle) { setNotice('اختر المقالة أولاً.'); return }
      setProject(createArticleVideoProject({ article: selectedArticle, audience, platform, tone, useAvatar, source, sourceSessionId, linkedEditorialDecisionId, linkedCampaignId }))
      return
    }
    if (path === 'public') {
      if (topic.trim().length < 4) { setNotice('اكتب موضوع الفيديو أولاً.'); return }
      setProject(createPublicVideoProject({ topic, message, audience, platform, tone, useAvatar, wantsSeries, linkedArticle, archive: articles, source, sourceSessionId, linkedEditorialDecisionId, linkedCampaignId }))
    }
  }

  const saveProject = async (status = project?.status || 'draft') => {
    if (!project || !user || busy) return
    setBusy('save'); setNotice('أحفظ المشروع…')
    try {
      const db = await getDb(); if (!db) throw new Error('Firebase غير متاح')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const next = { ...project, status, updatedAtClient: new Date().toISOString() }
      const exists = projects.some((item) => item.id === project.id)
      await setDoc(doc(db, 'admin_live_director_projects', project.id), {
        ...next,
        userId: user.uid,
        updatedAt: serverTimestamp(),
        ...(!exists ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true })
      setProject(next)
      setNotice('حُفظ المشروع الخاص ومقاطع Flow ونسخها وحالاتها.')
      await loadProjects()
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر حفظ المشروع.')
    } finally { setBusy('') }
  }

  const uploadAsset = async (file: File, kind: 'clip' | 'final' | 'cover', segmentId = '') => {
    if (!project || !user || busy) return
    const isCover = kind === 'cover'
    const validVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
    const validImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (isCover ? !validImage : !validVideo) { setNotice(isCover ? 'الغلاف يجب أن يكون JPG أو PNG أو WebP.' : 'الفيديو يجب أن يكون MP4 أو WebM أو MOV.'); return }
    const max = isCover ? 12 * 1024 * 1024 : 220 * 1024 * 1024
    if (file.size <= 0 || file.size > max) { setNotice(isCover ? 'حجم الغلاف يتجاوز 12MB.' : 'حجم الفيديو يتجاوز 220MB.'); return }
    setBusy(`upload:${kind}:${segmentId}`); setNotice('أرفع الأصل الخاص…')
    try {
      const app = await getFirebaseApp(); if (!app) throw new Error('Firebase غير متاح')
      const { getDownloadURL, getStorage, ref, uploadBytesResumable } = await import('firebase/storage')
      const extension = fileExtension(file)
      const name = `${kind}${segmentId ? `-${segmentId}` : ''}-${Date.now()}.${extension}`
      const target = ref(getStorage(app), `admin-live-director/${user.uid}/${project.id}/${name}`)
      const snapshot = await new Promise<Awaited<ReturnType<typeof uploadBytesResumable>>>((resolve, reject) => {
        const task = uploadBytesResumable(target, file, { contentType: file.type, customMetadata: { projectId: project.id, kind, segmentId } })
        task.on('state_changed', undefined, reject, () => resolve(task.snapshot))
      })
      const url = await getDownloadURL(snapshot.ref)
      let next = project
      if (kind === 'clip') next = setLiveDirectorSegmentStatus(project, segmentId, 'uploaded', url)
      else if (kind === 'final') next = { ...project, finalVideoUrl: url, status: 'ready_to_publish', updatedAtClient: new Date().toISOString() }
      else next = { ...project, coverUrl: url, updatedAtClient: new Date().toISOString() }
      setProject(next)
      setNotice('اكتمل الرفع الخاص. احفظ المشروع لتثبيت الرابط في Firestore.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر رفع الأصل.')
    } finally { setBusy('') }
  }

  const saveYoutube = () => {
    if (!project) return
    const url = youtubeDraft.trim()
    if (!isValidYouTubeUrl(url)) { setNotice('رابط YouTube غير صالح. لم يُحفظ.'); return }
    setProject({ ...project, youtubeUrl: url, updatedAtClient: new Date().toISOString() })
    setNotice('أُضيف رابط YouTube محلياً. احفظ المشروع لتثبيته.')
  }

  const updateClipStatus = (segmentId: string, status: LiveDirectorClipStatus) => {
    if (!project) return
    setProject(setLiveDirectorSegmentStatus(project, segmentId, status))
  }

  const repairClip = (segmentId: string) => {
    if (!project) return
    const issue = repairIssue[segmentId] || LIVE_DIRECTOR_REPAIR_ISSUES[0]
    setProject(repairLiveDirectorSegment(project, segmentId, issue))
    setNotice(`أُنشئت نسخة محسّنة للمقطع المتضرر فقط: ${issue}. بقيت بقية المقاطع كما هي.`)
  }

  if (!path && !project) {
    return (
      <div className="grid gap-5" data-live-director="entry">
        <section className={card}>
          <p className="text-[.72rem] font-semibold text-accent">المخرج الحي</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">اختر نقطة البداية.</h2>
          <p className="mt-2 max-w-3xl text-[.8rem] leading-relaxed text-soft">الموقع يحلل ويكتب خطة ومقاطع وبرومبتات Flow؛ التوليد يدوي داخل حسابك، بلا Flow API أو Veo أو خدمة فيديو مدفوعة.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button type="button" onClick={() => setPath('article')} className="rounded-3xl border border-hair bg-canvas p-6 text-right transition hover:-translate-y-0.5 hover:border-accent"><span className="text-[.68rem] font-semibold text-accent">المسار الأول</span><strong className="mt-2 block font-display text-xl text-ink">فيديو من مقال</strong><span className="mt-2 block text-[.78rem] leading-relaxed text-soft">حوّل مقالة موجودة إلى شرح بصري مختصر يجذب الناس إلى قراءتها.</span></button>
            <button type="button" onClick={() => setPath('public')} className="rounded-3xl border border-hair bg-canvas p-6 text-right transition hover:-translate-y-0.5 hover:border-accent"><span className="text-[.68rem] font-semibold text-accent">المسار الثاني</span><strong className="mt-2 block font-display text-xl text-ink">فيديو للجمهور</strong><span className="mt-2 block text-[.78rem] leading-relaxed text-soft">أنشئ فيديو مستقلاً في موضوع جديد، مع تغريدة ومنشورات جاهزة للنشر.</span></button>
          </div>
        </section>
        {projects.length > 0 && <RecentProjects projects={projects} onOpen={(item) => { setProject(item); setPath(item.type === 'article_video' ? 'article' : 'public'); setYoutubeDraft(item.youtubeUrl || '') }} />}
      </div>
    )
  }

  return (
    <div className="grid gap-5" data-live-director={project ? 'project' : path || 'entry'}>
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[.72rem] font-semibold text-accent">المخرج الحي</p><h2 className="mt-1 font-display text-2xl font-semibold text-ink">{path === 'article' ? 'فيديو المقال' : 'فيديو للجمهور'}</h2></div>
          <button type="button" onClick={() => { setPath(null); setProject(null); setNotice('') }} className={ghost}>بدّل المسار</button>
        </div>

        {!project && path === 'article' && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">المقالة المنشورة أو المسودة</span><select className={input} value={articleSlug} onChange={(event) => setArticleSlug(event.target.value)}>{articles.map((article) => <option key={article.slug} value={article.slug}>{article.status === 'draft' ? 'مسودة — ' : ''}{article.title}</option>)}</select></label><CommonSelects platform={platform} tone={tone} setPlatform={setPlatform} setTone={setTone} /><label className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.72rem] font-semibold text-ink">الأفتار المحفوظ في Flow</span><span className="mt-1 block text-[.68rem] leading-relaxed text-soft">لا رفع صور ولا إنشاء شخصية جديدة.</span><input className="mt-3" type="checkbox" checked={useAvatar} onChange={(event) => setUseAvatar(event.target.checked)} /> <span className="text-[.72rem] text-ink">استخدمه عند خدمة الفكرة</span></label></div>}

        {!project && path === 'public' && <div className="mt-6 grid gap-4"><div className="grid gap-4 lg:grid-cols-2"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ما الموضوع؟</span><textarea className={`${input} min-h-28`} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="فكرة، سؤال، موقف، دراسة أو حدث…" /></label><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ما الرسالة التي تريد إيصالها؟</span><textarea className={`${input} min-h-28`} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="اختياري؛ إن تركته يختصر المحرك جوهر الموضوع." /></label></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">الجمهور</span><input className={input} value={audience} onChange={(event) => setAudience(event.target.value)} /></label><CommonSelects platform={platform} tone={tone} setPlatform={setPlatform} setTone={setTone} /><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ربط اختياري بمقال</span><select className={input} value={linkedArticleSlug} onChange={(event) => setLinkedArticleSlug(event.target.value)}><option value="">بلا ربط</option>{articles.map((article) => <option key={article.slug} value={article.slug}>{article.title}</option>)}</select></label></div><details className="rounded-xl border border-hair bg-canvas p-4"><summary className="cursor-pointer list-none text-[.72rem] font-semibold text-soft">خيارات متقدمة عند الحاجة</summary><div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="mb-2 block text-[.7rem] font-semibold text-ink">مصدر أو دراسة مرتبطة</span><input className={input} value={source} onChange={(event) => setSource(event.target.value)} placeholder="رابط أو مرجع مختصر — اختياري" /></label><div className="flex flex-wrap items-center gap-5"><label className="text-[.74rem] text-ink"><input type="checkbox" checked={useAvatar} onChange={(event) => setUseAvatar(event.target.checked)} /> استخدم أفتار د. أحمد المحفوظ</label><label className="text-[.74rem] text-ink"><input type="checkbox" checked={wantsSeries} onChange={(event) => setWantsSeries(event.target.checked)} /> الموضوع يحتاج سلسلة</label></div></div></details></div>}

        {!project && <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={buildProject} className={primary}>حلّل وابنِ خطة Flow</button><span className="text-[.7rem] text-soft">3 مقاطع يومياً · 8 ثوانٍ لكل مقطع · لا توليد فيديو داخل الموقع</span></div>}
        {notice && <p className="mt-4 rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.76rem] leading-relaxed text-accent">{notice}</p>}
      </section>

      {project && <>
        <section className={card} data-live-director-recommendation="true"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="المدة المقترحة" value={`${project.duration} ثانية`} /><Metric label="المقاطع" value={`${project.segmentCount} × 8 ثوانٍ`} /><Metric label="خطة التوليد" value={`${project.days} ${project.days === 1 ? 'يوم' : 'أيام'}`} /><Metric label="الحالة" value={project.status} /></div><p className="mt-4 border-t border-hair pt-4 text-[.78rem] leading-relaxed text-soft">{project.durationReason}</p>{project.series && <div className="mt-4 rounded-xl border border-accent/20 bg-canvas p-4"><strong className="text-[.76rem] text-accent">الموضوع يستحق سلسلة بدل الحشر</strong><ol className="mt-2 grid gap-1 text-[.72rem] text-soft">{project.seriesPlan.map((item) => <li key={item}>{item}</li>)}</ol></div>}</section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">السيناريو المختصر</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">{project.title}</h3><p className="mt-2 text-[.78rem] leading-relaxed text-soft">{project.centralMessage}</p><div className="mt-4 rounded-xl border border-hair bg-canvas p-4"><span className="text-[.66rem] font-semibold text-accent">النص المنطوق · {project.narration.split(/\s+/).filter(Boolean).length} كلمة</span><p className="mt-2 text-[.8rem] leading-loose text-ink">{project.narration}</p></div><details className="mt-4 rounded-xl border border-hair bg-canvas p-4"><summary className="cursor-pointer list-none text-[.72rem] font-semibold text-ink">قفل الهوية وملاحظات الاستمرارية</summary><p className="mt-3 text-[.72rem] leading-relaxed text-soft">{project.identityLock}</p><ul className="mt-3 grid gap-1 text-[.7rem] text-soft">{project.continuityNotes.map((item) => <li key={item}>— {item}</li>)}</ul></details></section>

        <section className={card} data-live-director-daily-plan="true"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.72rem] font-semibold text-accent">خطة العمل اليومية</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">ولّد ثلاثة مقاطع فقط في اليوم.</h3></div><span className="text-[.68rem] text-soft">إذا فشل مقطع، أصلحه وحده.</span></div><div className="mt-5 grid gap-6">{dailyPlan.map((day) => <section key={day.day}><h4 className="mb-3 text-[.76rem] font-semibold text-ink">اليوم {day.day}</h4><div className="grid gap-4 xl:grid-cols-3">{day.clips.map((segment) => <article key={segment.id} className="min-w-0 rounded-2xl border border-hair bg-canvas p-4" data-flow-clip={segment.id}><div className="flex items-start justify-between gap-3"><span><span className="block text-[.62rem] font-semibold text-accent">المقطع {segment.order} · {segment.role}</span><strong className="mt-1 block text-[.78rem] text-ink">{segment.shotCount} {segment.shotCount === 1 ? 'لقطة' : 'لقطات'} · {segment.appearance === 'visual_only' ? 'مشهد بصري' : 'الأفتار المحفوظ'}</strong></span><select aria-label={`حالة المقطع ${segment.order}`} className="rounded-full border border-hair bg-wash px-2 py-1 text-[.62rem] text-soft" value={segment.status} onChange={(event) => updateClipStatus(segment.id, event.target.value as LiveDirectorClipStatus)}>{Object.entries(CLIP_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><p className="mt-3 rounded-xl bg-wash px-3 py-2 text-[.72rem] leading-relaxed text-ink">{segment.narration}</p><details className="mt-3 rounded-xl border border-hair p-3"><summary className="cursor-pointer list-none text-[.68rem] font-semibold text-accent">برومبت Flow باللغة الإنجليزية</summary><pre dir="ltr" className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[.62rem] leading-relaxed text-soft">{segment.prompt}</pre></details><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void navigator.clipboard.writeText(segment.prompt).then(() => setNotice(`نُسخ برومبت المقطع ${segment.order}.`))} className={ghost}>نسخ البرومبت</button><label className={`${ghost} cursor-pointer`}>رفع المقطع<input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, 'clip', segment.id); event.currentTarget.value = '' }} /></label></div><details className="mt-3 rounded-xl border border-hair bg-wash p-3"><summary className="cursor-pointer list-none text-[.67rem] font-semibold text-soft">النتيجة لم تضبط</summary><select className={`${input} mt-3`} value={repairIssue[segment.id] || LIVE_DIRECTOR_REPAIR_ISSUES[0]} onChange={(event) => setRepairIssue((previous) => ({ ...previous, [segment.id]: event.target.value as (typeof LIVE_DIRECTOR_REPAIR_ISSUES)[number] }))}>{LIVE_DIRECTOR_REPAIR_ISSUES.map((issue) => <option key={issue}>{issue}</option>)}</select><button type="button" onClick={() => repairClip(segment.id)} className={`${ghost} mt-2 w-full`}>أصلح هذا المقطع فقط</button>{segment.promptVersions.length > 1 && <span className="mt-2 block text-[.62rem] text-soft">محفوظة {segment.promptVersions.length} نسخ لهذا المقطع.</span>}</details>{segment.videoUrl && <video controls preload="metadata" className="mt-3 aspect-video w-full rounded-xl bg-ink" src={segment.videoUrl} />}</article>)}</div></section>)}</div></section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">بوابة الجودة</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.entries({ 'الفكرة': project.quality.idea, 'المدة': project.quality.duration, 'المقاطع': project.quality.clips, 'الأفتار': project.quality.avatar, 'النشر': project.quality.publishing }).map(([label, value]) => <div key={label} className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.64rem] text-soft">{label}</span><strong className="mt-1 block text-[.76rem] text-ink">{value}</strong></div>)}</div><ul className="mt-4 grid gap-1 text-[.7rem] leading-relaxed text-soft">{project.quality.notes.map((item) => <li key={item}>— {item}</li>)}</ul></section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">مواد النشر</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries({ 'نص الغلاف': project.social.coverText, 'Caption': project.social.caption, 'تغريدة': project.social.x, 'Instagram': project.social.instagram, 'LinkedIn': project.social.linkedin, 'وصف YouTube': project.social.youtube, 'سؤال للجمهور': project.social.audienceQuestion, 'الدعوة': project.social.callToAction, 'الصورة المصغرة': project.social.thumbnailIdea }).map(([label, value]) => <article key={label} className="rounded-xl border border-hair bg-canvas p-4"><strong className="text-[.7rem] text-accent">{label}</strong><p className="mt-2 whitespace-pre-line text-[.74rem] leading-relaxed text-soft">{value}</p><button type="button" onClick={() => void navigator.clipboard.writeText(value).then(() => setNotice(`نُسخ «${label}».`))} className="mt-3 text-[.65rem] font-semibold text-accent">نسخ</button></article>)}</div>{project.social.articleDecision && <p className="mt-4 rounded-xl border border-accent/20 bg-canvas px-4 py-3 text-[.74rem] text-ink"><strong className="text-accent">قرار المقال:</strong> {project.social.articleDecision}</p>}</section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">الأصول النهائية</p><div className="mt-4 grid gap-4 lg:grid-cols-3"><label className="rounded-xl border border-dashed border-hair bg-canvas p-4 text-center text-[.72rem] text-soft">رفع النسخة المركبة<input type="file" accept="video/mp4,video/webm,video/quicktime" className="mt-3 block w-full text-[.66rem]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, 'final'); event.currentTarget.value = '' }} /></label><label className="rounded-xl border border-dashed border-hair bg-canvas p-4 text-center text-[.72rem] text-soft">رفع صورة الغلاف<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-[.66rem]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, 'cover'); event.currentTarget.value = '' }} /></label><div className="rounded-xl border border-hair bg-canvas p-4"><label className="text-[.7rem] font-semibold text-ink">رابط YouTube — لا رفع تلقائي</label><input dir="ltr" className={`${input} mt-2 text-left`} value={youtubeDraft} onChange={(event) => setYoutubeDraft(event.target.value)} placeholder="https://youtube.com/watch?v=…" /><button type="button" onClick={saveYoutube} className={`${ghost} mt-2`}>إضافة الرابط</button></div></div>{project.finalVideoUrl && <video controls preload="metadata" className="mt-4 aspect-video w-full max-w-2xl rounded-xl bg-ink" src={project.finalVideoUrl} />}{project.youtubeUrl && <a href={project.youtubeUrl} target="_blank" rel="noreferrer" className="mt-3 block text-[.72rem] font-semibold text-accent">فتح فيديو YouTube</a>}</section>

        <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.72rem] font-semibold text-accent">حفظ المشروع</p><p className="mt-1 text-[.72rem] text-soft">المشروع والبرومبتات والنسخ والحالات خاصة بالمشرف.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void saveProject()} className={primary}>{busy === 'save' ? 'أحفظ…' : 'احفظ المشروع'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void saveProject('ready_to_publish')} className={ghost}>جاهز للنشر</button></div></div></section>
      </>}

      {projects.length > 0 && <RecentProjects projects={projects.filter((item) => item.id !== project?.id)} onOpen={(item) => { setProject(item); setPath(item.type === 'article_video' ? 'article' : 'public'); setYoutubeDraft(item.youtubeUrl || ''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
    </div>
  )
}

function CommonSelects({ platform, tone, setPlatform, setTone }: { platform: LiveDirectorPlatform; tone: LiveDirectorTone; setPlatform: (value: LiveDirectorPlatform) => void; setTone: (value: LiveDirectorTone) => void }) {
  return <><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">المنصة الأساسية</span><select className={input} value={platform} onChange={(event) => setPlatform(event.target.value as LiveDirectorPlatform)}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">النبرة</span><select className={input} value={tone} onChange={(event) => setTone(event.target.value as LiveDirectorTone)}>{TONES.map((item) => <option key={item}>{item}</option>)}</select></label></>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-hair bg-canvas p-4"><span className="text-[.65rem] text-soft">{label}</span><strong className="mt-1 block font-display text-lg text-ink">{value}</strong></div>
}

function RecentProjects({ projects, onOpen }: { projects: StoredProject[]; onOpen: (project: StoredProject) => void }) {
  if (!projects.length) return null
  return <details className={card}><summary className="cursor-pointer list-none text-[.76rem] font-semibold text-ink">المشاريع المحفوظة · {projects.length}</summary><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{projects.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)} className="rounded-xl border border-hair bg-canvas p-4 text-right transition hover:border-accent"><span className="text-[.62rem] font-semibold text-accent">{item.type === 'article_video' ? 'فيديو مقال' : 'فيديو جمهور'} · {item.duration} ثانية</span><strong className="mt-1 line-clamp-2 block text-[.76rem] text-ink">{item.title}</strong><span className="mt-1 block text-[.65rem] text-soft">{item.status}</span></button>)}</div></details>
}
