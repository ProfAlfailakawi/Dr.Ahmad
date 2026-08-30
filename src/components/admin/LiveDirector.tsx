import { useEffect, useMemo, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { useAdminAuth } from '../../lib/admin-auth'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { DEFAULT_FLOW_CLIP_SECONDS, DEFAULT_FLOW_LOOK, FLOW_CLIP_SECONDS, FLOW_LOOKS, FLOW_SECONDS_NOTE, flowLook, type FlowLookId } from '../../lib/flow-cinema.ts'
import { forgeSymbolicReels, reelPromptFromScene, type ReelConcept } from '../../lib/symbolic-reels.ts'
import type { InventedScene as InventedReel } from '../../lib/reel-invention.mjs'
import {
  CAST_LABELS,
  CAST_MODES,
  CAST_NOTES,
  CONTINUITY_LABELS,
  LIVE_DIRECTOR_REPAIR_ISSUES,
  REFERENCE_LABELS,
  VOICE_MODE_LABELS,
  applyReferenceFrame,
  createArticleVideoProject,
  createPublicVideoProject,
  ensureLiveDirectorPromptVariants,
  getFlowPrompt,
  isValidYouTubeUrl,
  liveDirectorDailyPlan,
  liveDirectorPerformanceInsights,
  nearMinuteEditPlan,
  repairLiveDirectorSegment,
  setLiveDirectorSegmentStatus,
  setSegmentContinuity,
  type CastMode,
  type ContinuityMode,
  type FlowPromptMode,
  type LiveDirectorClipStatus,
  type LiveDirectorPlatform,
  type LiveDirectorProject,
  type LiveDirectorRepairIssue,
  type LiveDirectorSegment,
  type LiveDirectorTone,
  type NarrationSource,
  type ReferenceStrategy,
} from '../../lib/live-director'
import { extractVideoFrame, measureImageSharpness } from '../../lib/live-director-frames'
import { buildTweets, verifiedLineOf, type TweetSource } from '../../lib/tweet-forge'
import { resolveResonantQuotes, resonanceBySlug, type ResonanceRow } from '../../lib/resonance-quotes'
import { arabicCountPhrase, DAY_FORMS, REEL_SCENE_FORMS, SAVED_PROMPT_COPY_FORMS, SECOND_AFTER_PREPOSITION_FORMS, SECOND_FORMS, SHOT_FORMS, WORD_PLAIN_FORMS } from '../../lib/arabic-count.ts'

type DirectorPath = 'article' | 'public' | 'reel' | null
type StoredProject = LiveDirectorProject & { userId?: string }

const card = 'min-w-0 rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.86rem] text-ink outline-none transition placeholder:text-soft/[.55] focus:border-accent'
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
const METRIC_FIELDS = [
  { key: 'views' as const, label: 'المشاهدات' },
  { key: 'completion' as const, label: 'نسبة الإكمال' },
  { key: 'saves' as const, label: 'الحفظ' },
  { key: 'shares' as const, label: 'المشاركة' },
  { key: 'articleClicks' as const, label: 'النقر على المقال' },
]
const NARRATION_SOURCE_LABELS: Record<NarrationSource, string> = {
  resonance: 'من كلامه — جملة ظلّلها القرّاء',
  verified: 'من متن المقال، موثّقة حرفاً بحرف',
  derived: 'مستخرجة من المادة نفسها',
  scaffold: 'صياغة المحرك — راجعها',
}
const SITE = 'https://dr-alfailakawi.com'
const CONTINUITY_MODES: ContinuityMode[] = ['direct', 'soft', 'thematic', 'independent']
const REFERENCE_STRATEGIES: ReferenceStrategy[] = ['last_frame', 'selected_frame', 'style_only', 'none']
const FLOW_PROMPT_MODES: FlowPromptMode[] = ['speech_ar', 'speech_en', 'silent']
const FLOW_PROMPT_LABELS: Record<FlowPromptMode, string> = {
  speech_ar: 'كلام عربي',
  speech_en: 'كلام إنجليزي',
  silent: 'بدون كلام',
}

function flowPromptModeNotice(mode: FlowPromptMode) {
  if (mode === 'speech_ar') return 'مع كلام عربي'
  if (mode === 'speech_en') return 'مع كلام إنجليزي'
  return 'بدون كلام'
}

function fileExtension(file: File | Blob) {
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
  /* الطاقم: كان الأفتار مفروضاً في الإعدادات الافتراضية، وهو خطأ — لأن الأفتار
     يتطلب اختياره داخل Flow، وحين لا يُختار يخترع النموذج شخصاً آخر. الافتراض
     الآن «بشر بلا أفتار»، و«بلا ناس» خيارٌ كامل لا التفافٌ على الوصف. */
  const [castMode, setCastMode] = useState<CastMode>('people')
  /* النمط البصري ومدة المقطع: بُني المخرج أيام Flow المجاني فكانت المدة مثبتة
     بثماني ثوانٍ والشكل واحداً. الاشتراك يتيح أطول وأدقّ، فصارا اختياراً. */
  const [look, setLook] = useState<FlowLookId>(DEFAULT_FLOW_LOOK)
  const [clipSeconds, setClipSeconds] = useState<number>(DEFAULT_FLOW_CLIP_SECONDS)
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
  const [repairIssue, setRepairIssue] = useState<Record<string, LiveDirectorRepairIssue>>({})
  const [youtubeDraft, setYoutubeDraft] = useState('')
  const [clipFiles, setClipFiles] = useState<Record<string, File>>({})
  const [frameSecond, setFrameSecond] = useState<Record<string, string>>({})
  const [resonanceRows, setResonanceRows] = useState<ResonanceRow[]>([])

  const selectedArticle = articles.find((article) => article.slug === articleSlug) || null
  const linkedArticle = articles.find((article) => article.slug === linkedArticleSlug) || null
  const dailyPlan = useMemo(() => project ? liveDirectorDailyPlan(project) : [], [project])
  const nearMinute = useMemo(() => project ? nearMinuteEditPlan(project) : null, [project])
  const insights = useMemo(() => liveDirectorPerformanceInsights(projects), [projects])

  const loadProjects = async () => {
    try {
      const db = await getDb(); if (!db) return
      const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, 'admin_live_director_projects'), orderBy('updatedAt', 'desc'), limit(12)))
      setProjects(snapshot.docs
        .map((item) => ensureLiveDirectorPromptVariants({ id: item.id, ...(item.data() as Omit<StoredProject, 'id'>) } as StoredProject))
        .sort((left, right) => safeTimestamp((right as unknown as { updatedAt?: unknown }).updatedAt) - safeTimestamp((left as unknown as { updatedAt?: unknown }).updatedAt)))
    } catch { /* أول تشغيل قبل نشر القواعد: المشروع الحالي يبقى محلياً */ }
  }

  useEffect(() => { void loadProjects() }, [])

  // رنين القرّاء: ما ظلّله الناس فعلاً. غيابه لا يوقف شيئاً — يعود المحرك إلى المتن.
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const db = await getDb(); if (!db || !active) return
        const { collection, getDocs } = await import('firebase/firestore')
        const snapshot = await getDocs(collection(db, 'article_highlights'))
        if (!active) return
        setResonanceRows(snapshot.docs.map((item) => item.data() as ResonanceRow))
      } catch { /* غياب الرنين لا يوقف المخرج الحي */ }
    })()
    return () => { active = false }
  }, [])

  const resonanceMap = useMemo(() => {
    if (!resonanceRows.length) return new Map<string, { text: string; count: number }[]>()
    const rows = resolveResonantQuotes(resonanceRows, articles.map((article) => ({ slug: article.slug, title: article.title, body: article.body || '' })), { limit: 60 })
    return resonanceBySlug(rows)
  }, [articles, resonanceRows])

  /** يبني مدخل المسبك: زوايا التغريدات، والجملة الموثّقة، وما ظلّله القرّاء. */
  const forgeFor = (tweetSource: TweetSource, slug: string) => {
    const resonantLines = slug ? resonanceMap.get(slug) : undefined
    try {
      const drafts = buildTweets({ ...tweetSource, resonantLines }, { count: 8, withHashtags: true })
      return {
        drafts: drafts.map((draft) => ({ angle: draft.angle, angleLabel: draft.angleLabel, text: draft.text, hashtags: draft.hashtags, quote: draft.quote, quoteVerified: draft.quoteVerified, score: draft.score, resonanceCount: draft.resonanceCount })),
        verifiedLine: verifiedLineOf(tweetSource.text || '', tweetSource.title),
        resonantLines,
      }
    } catch {
      // تعثّر المسبك لا يُفرغ المشروع؛ المحرك يعود إلى متن المقال نفسه.
      return { resonantLines }
    }
  }

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
        setProject({ ...createArticleVideoProject({ article: temporary, audience, platform, tone, castMode, clipSeconds, forge: forgeFor({ kind: 'article', id: temporary.slug, title: temporary.title, text: [temporary.excerpt, body].filter(Boolean).join(' '), url: '' }, temporary.slug), source: seededSource, sourceSessionId: seededSessionId, linkedEditorialDecisionId: seededDecisionId, linkedCampaignId: seededCampaignId }), look, clipSeconds })
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
      const forge = forgeFor({ kind: 'article', id: selectedArticle.slug, title: selectedArticle.title, text: [selectedArticle.excerpt, selectedArticle.body].filter(Boolean).join(' '), url: `${SITE}/articles/${selectedArticle.slug}`, date: selectedArticle.iso }, selectedArticle.slug)
      setProject({ ...createArticleVideoProject({ article: selectedArticle, audience, platform, tone, castMode, clipSeconds, forge, source, sourceSessionId, linkedEditorialDecisionId, linkedCampaignId }), look, clipSeconds })
      return
    }
    if (path === 'public') {
      if (topic.trim().length < 4) { setNotice('اكتب موضوع الفيديو أولاً.'); return }
      const forge = forgeFor({ kind: linkedArticle ? 'article' : 'free', id: linkedArticle?.slug || 'topic', title: linkedArticle?.title || topic, text: [message, topic, linkedArticle?.body].filter(Boolean).join(' '), url: linkedArticle ? `${SITE}/articles/${linkedArticle.slug}` : '' }, linkedArticle?.slug || '')
      setProject({ ...createPublicVideoProject({ topic, message, audience, platform, tone, castMode, clipSeconds, wantsSeries, linkedArticle, archive: articles, forge, source, sourceSessionId, linkedEditorialDecisionId, linkedCampaignId }), look, clipSeconds })
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

  /** يرفع أصلاً خاصاً إلى مساحة المشروع؛ الإطار المرجعي صورة تخضع للتحقق نفسه. */
  const uploadAsset = async (file: File | Blob, kind: 'clip' | 'final' | 'cover' | 'frame', segmentId = '', frameSharpness = 1) => {
    if (!project || !user || busy) return
    const isImage = kind === 'cover' || kind === 'frame'
    const validVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)
    const validImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (isImage ? !validImage : !validVideo) { setNotice(isImage ? 'الصورة يجب أن تكون JPG أو PNG أو WebP.' : 'الفيديو يجب أن يكون MP4 أو WebM أو MOV.'); return }
    const max = isImage ? 12 * 1024 * 1024 : 220 * 1024 * 1024
    if (file.size <= 0 || file.size > max) { setNotice(isImage ? 'حجم الصورة يتجاوز 12MB.' : 'حجم الفيديو يتجاوز 220MB.'); return }
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
      else if (kind === 'frame') {
        const outcome = applyReferenceFrame(project, segmentId, { frameUrl: url, kind: 'selected_frame', sharpness: frameSharpness })
        next = outcome.project
        setProject(next)
        setNotice(outcome.applied ? `${outcome.note} أُعيد بناء برومبت المقطع التالي وحده.` : outcome.note)
        return
      }
      else next = { ...project, coverUrl: url, updatedAtClient: new Date().toISOString() }
      setProject(next)
      setNotice('اكتمل الرفع الخاص. احفظ المشروع لتثبيت الرابط في Firestore.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر رفع الأصل.')
    } finally { setBusy('') }
  }

  /** يلتقط إطاراً من ملف المقطع محلياً ثم يرفعه ويمرّره إلى المقطع التالي وحده. */
  const captureFrame = async (segmentId: string, mode: 'last' | 'manual') => {
    if (!project || busy) return
    const file = clipFiles[segmentId]
    if (!file) { setNotice('اختر ملف المقطع أولاً حتى يُستخرج منه الإطار على جهازك.'); return }
    setBusy(`frame:${segmentId}`); setNotice('أستخرج الإطار داخل المتصفح…')
    try {
      const second = mode === 'manual' ? Number(frameSecond[segmentId] || '0') : undefined
      const frame = await extractVideoFrame(file, mode === 'manual' && Number.isFinite(second) ? second : undefined)
      // الإطار الضبابي لا يُعتمد تلقائياً؛ يُعرض السبب ويُترك الاختيار لد. أحمد.
      if (frame.sharpness < 0.35) {
        setNotice(`الإطار عند ${arabicCountPhrase(Number(frame.atSecond.toFixed(2)), SECOND_AFTER_PREPOSITION_FORMS)} ضبابي أو أثناء حركة؛ اختر ثانية أخرى بدل اعتماده.`)
        return
      }
      await uploadAsset(frame.blob, 'frame', segmentId, frame.sharpness)
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر استخراج الإطار.')
    } finally { setBusy('') }
  }

  const uploadManualFrame = async (segmentId: string, file: File) => {
    const sharpness = await measureImageSharpness(file)
    if (sharpness < 0.35) { setNotice('الصورة المرفوعة ضبابية؛ اختر إطاراً أوضح بدل اعتماده تلقائياً.'); return }
    await uploadAsset(file, 'frame', segmentId, sharpness)
  }

  const changeContinuity = (segmentId: string, change: { mode?: ContinuityMode; strategy?: ReferenceStrategy }) => {
    if (!project) return
    setProject(setSegmentContinuity(project, segmentId, change))
    setNotice('حُدِّث ترابط هذا المقطع وأُعيد بناء برومبته وحده.')
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
            {/* دُمج «فيديو للجمهور» و«الريل الرمزي» في باب واحد بأمر الدكتور:
                كلاهما يبدأ من موضوعٍ يكتبه، فلا داعي لبابين وأيقونتين. */}
            <button type="button" onClick={() => setPath('reel')} className="rounded-3xl border border-hair bg-canvas p-6 text-right transition hover:-translate-y-0.5 hover:border-accent"><span className="text-[.68rem] font-semibold text-accent">المسار الثاني</span><strong className="mt-2 block font-display text-xl text-ink">من فكرة إلى ريل</strong><span className="mt-2 block text-[.78rem] leading-relaxed text-soft">اكتب فكرتك فتخرج مشاهد رمزية توقف السكرول — ومعها الكابشن والمنشورات جاهزة.</span></button>
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

        {!project && path === 'reel' && <SymbolicReelsPanel clipSeconds={clipSeconds} setClipSeconds={setClipSeconds} onNotice={setNotice} onPublicVideo={() => setPath('public')} />}

        {!project && path === 'article' && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">المقالة المنشورة أو المسودة</span><select className={input} value={articleSlug} onChange={(event) => setArticleSlug(event.target.value)}>{articles.map((article) => <option key={article.slug} value={article.slug}>{article.status === 'draft' ? 'مسودة — ' : ''}{article.title}</option>)}</select></label><CommonSelects platform={platform} tone={tone} setPlatform={setPlatform} setTone={setTone} look={look} setLook={setLook} clipSeconds={clipSeconds} setClipSeconds={setClipSeconds} /><CastPicker castMode={castMode} setCastMode={setCastMode} /></div>}

        {!project && path === 'public' && <div className="mt-6 grid gap-4"><div className="grid gap-4 lg:grid-cols-2"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ما الموضوع؟</span><textarea className={`${input} min-h-28`} value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="فكرة، سؤال، موقف، دراسة أو حدث…" /></label><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ما الرسالة التي تريد إيصالها؟</span><textarea className={`${input} min-h-28`} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="اختياري؛ إن تركته يختصر المحرك جوهر الموضوع." /></label></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">الجمهور</span><input className={input} value={audience} onChange={(event) => setAudience(event.target.value)} /></label><CastPicker castMode={castMode} setCastMode={setCastMode} /><CommonSelects platform={platform} tone={tone} setPlatform={setPlatform} setTone={setTone} look={look} setLook={setLook} clipSeconds={clipSeconds} setClipSeconds={setClipSeconds} /><label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ربط اختياري بمقال</span><select className={input} value={linkedArticleSlug} onChange={(event) => setLinkedArticleSlug(event.target.value)}><option value="">بلا ربط</option>{articles.map((article) => <option key={article.slug} value={article.slug}>{article.title}</option>)}</select></label></div><details className="rounded-xl border border-hair bg-canvas p-4"><summary className="cursor-pointer list-none text-[.72rem] font-semibold text-soft">خيارات متقدمة عند الحاجة</summary><div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="mb-2 block text-[.7rem] font-semibold text-ink">مصدر أو دراسة مرتبطة</span><input className={input} value={source} onChange={(event) => setSource(event.target.value)} placeholder="رابط أو مرجع مختصر — اختياري" /></label><div className="flex flex-wrap items-center gap-5"><label className="text-[.74rem] text-ink"><input type="checkbox" checked={wantsSeries} onChange={(event) => setWantsSeries(event.target.checked)} /> الموضوع يحتاج سلسلة</label></div></div></details></div>}

        {!project && path !== 'reel' && <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={buildProject} className={primary}>حلّل وابنِ خطة Flow</button><span className="text-[.7rem] text-soft">3 مقاطع يومياً · 8 ثوانٍ لكل مقطع · لا توليد فيديو داخل الموقع</span></div>}
        {notice && <p className="mt-4 rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.76rem] leading-relaxed text-accent">{notice}</p>}
      </section>

      {project && <>
        <section className={card} data-live-director-recommendation="true"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="المدة المقترحة" value={arabicCountPhrase(project.duration, SECOND_FORMS)} /><Metric label="المقاطع" value={`${project.segmentCount} × 8 ثوانٍ`} /><Metric label="خطة التوليد" value={arabicCountPhrase(project.days, DAY_FORMS)} /><Metric label="الحالة" value={project.status} /></div><p className="mt-4 border-t border-hair pt-4 text-[.78rem] leading-relaxed text-soft">{project.durationReason}</p>{project.series && <div className="mt-4 rounded-xl border border-accent/20 bg-canvas p-4"><strong className="text-[.76rem] text-accent">الموضوع يستحق سلسلة بدل الحشر</strong><ol className="mt-2 grid gap-1 text-[.72rem] text-soft">{project.seriesPlan.map((item) => <li key={item}>{item}</li>)}</ol></div>}</section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">السيناريو المختصر</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">{project.title}</h3><p className="mt-2 text-[.78rem] leading-relaxed text-soft">{project.centralMessage}</p><div className="mt-4 rounded-xl border border-hair bg-canvas p-4"><span className="text-[.66rem] font-semibold text-accent">النص المنطوق · {arabicCountPhrase(project.narration.split(/\s+/).filter(Boolean).length, WORD_PLAIN_FORMS)}</span><p className="mt-2 text-[.8rem] leading-loose text-ink">{project.narration}</p></div><details className="mt-4 rounded-xl border border-hair bg-canvas p-4"><summary className="cursor-pointer list-none text-[.72rem] font-semibold text-ink">قفل الهوية وملاحظات الاستمرارية</summary><p className="mt-3 text-[.72rem] leading-relaxed text-soft">{project.identityLock}</p><ul className="mt-3 grid gap-1 text-[.7rem] text-soft">{project.continuityNotes.map((item) => <li key={item}>— {item}</li>)}</ul></details></section>

        <section className={card} data-live-director-daily-plan="true"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[.72rem] font-semibold text-accent">خطة العمل اليومية</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">ولّد ثلاثة مقاطع فقط في اليوم.</h3></div><span className="text-[.68rem] text-soft">إذا فشل مقطع، أصلحه وحده.</span></div><div className="mt-5 grid gap-6">{dailyPlan.map((day) => <section key={day.day}><h4 className="mb-3 text-[.76rem] font-semibold text-ink">اليوم {day.day}</h4><div className="grid gap-4 xl:grid-cols-3">{day.clips.map((segment) => <ClipCard key={segment.id} segment={segment} status={CLIP_STATUS_LABELS} busy={busy} repairIssue={repairIssue[segment.id] || LIVE_DIRECTOR_REPAIR_ISSUES[0]} hasFile={Boolean(clipFiles[segment.id])} frameSecond={frameSecond[segment.id] || ''} onStatus={(value) => updateClipStatus(segment.id, value)} onRepairIssue={(value) => setRepairIssue((previous) => ({ ...previous, [segment.id]: value }))} onRepair={() => repairClip(segment.id)} onCopy={(prompt, mode) => void navigator.clipboard.writeText(prompt).then(() => setNotice(`نُسخ برومبت المقطع ${segment.order} — ${flowPromptModeNotice(mode)}.`))} onPickClip={(file) => { setClipFiles((previous) => ({ ...previous, [segment.id]: file })); void uploadAsset(file, 'clip', segment.id) }} onFrameSecond={(value) => setFrameSecond((previous) => ({ ...previous, [segment.id]: value }))} onCaptureFrame={(mode) => void captureFrame(segment.id, mode)} onManualFrame={(file) => void uploadManualFrame(segment.id, file)} onContinuity={(change) => changeContinuity(segment.id, change)} />)}</div></section>)}</div></section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">بوابة الجودة</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">{Object.entries({ 'الفكرة': project.quality.idea, 'المدة': project.quality.duration, 'المقاطع': project.quality.clips, 'الأفتار': project.quality.avatar, 'الترابط': project.quality.continuity, 'النشر': project.quality.publishing }).map(([label, value]) => <div key={label} className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.64rem] text-soft">{label}</span><strong className="mt-1 block text-[.76rem] text-ink">{value}</strong></div>)}</div><ul className="mt-4 grid gap-1 text-[.7rem] leading-relaxed text-soft">{project.quality.notes.map((item) => <li key={item}>— {item}</li>)}</ul></section>

        {nearMinute && <section className={card} data-live-director-near-minute="true">
          <p className="text-[.72rem] font-semibold text-accent">النسخة القريبة من دقيقة</p>
          <p className="mt-2 text-[.78rem] leading-relaxed text-soft">{nearMinute.statement}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.63rem] text-soft">مقدمة تحريرية</span><strong className="mt-1 block text-[.75rem] text-ink">من {nearMinute.intro.from} إلى {arabicCountPhrase(nearMinute.intro.to, SECOND_AFTER_PREPOSITION_FORMS)}</strong><span className="mt-1 block text-[.63rem] leading-relaxed text-soft">{nearMinute.intro.note}</span></div>
            <div className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.63rem] text-soft">مادة Flow المولدة</span><strong className="mt-1 block text-[.75rem] text-ink">{arabicCountPhrase(nearMinute.generated, SECOND_FORMS)}</strong><span className="mt-1 block text-[.63rem] leading-relaxed text-soft">هذه وحدها ما يولّده Flow.</span></div>
            <div className="rounded-xl border border-hair bg-canvas p-3"><span className="text-[.63rem] text-soft">خاتمة أو بطاقة رابط</span><strong className="mt-1 block text-[.75rem] text-ink">من {nearMinute.outro.from} إلى {arabicCountPhrase(nearMinute.outro.to, SECOND_AFTER_PREPOSITION_FORMS)}</strong><span className="mt-1 block text-[.63rem] leading-relaxed text-soft">{nearMinute.outro.note}</span></div>
          </div>
        </section>}

        <section className={card} data-live-director-performance="true">
          <p className="text-[.72rem] font-semibold text-accent">ما تقوله النتائج المنشورة</p>
          <ul className="mt-3 grid gap-1 text-[.74rem] leading-relaxed text-soft">{insights.notes.map((note) => <li key={note}>— {note}</li>)}</ul>
          {!insights.enough && <p className="mt-3 text-[.68rem] leading-relaxed text-soft">أدخل أرقام المشاهدات والإكمال يدوياً بعد النشر؛ لا يوجد تكامل مدفوع، ولا تُعرض خلاصة قبل خمسة مشاريع مقيسة.</p>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {METRIC_FIELDS.map((field) => <label key={field.key}><span className="mb-1 block text-[.63rem] font-semibold text-ink">{field.label}</span><input dir="ltr" inputMode="numeric" className="w-full rounded-lg border border-hair bg-canvas px-2 py-1.5 text-left text-[.7rem] text-ink" value={String(project.metrics?.[field.key] ?? '')} onChange={(event) => setProject({ ...project, metrics: { views: 0, completion: 0, saves: 0, shares: 0, articleClicks: 0, ...(project.metrics || {}), [field.key]: Number(event.target.value.replace(/[^0-9.]/g, '')) || 0 }, updatedAtClient: new Date().toISOString() })} /></label>)}
          </div>
        </section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">مواد النشر</p><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries({ 'نص الغلاف': project.social.coverText, 'Caption': project.social.caption, 'تغريدة': project.social.x, 'Instagram': project.social.instagram, 'LinkedIn': project.social.linkedin, 'وصف YouTube': project.social.youtube, 'سؤال للجمهور': project.social.audienceQuestion, 'الدعوة': project.social.callToAction, 'الصورة المصغرة': project.social.thumbnailIdea }).map(([label, value]) => <article key={label} className="rounded-xl border border-hair bg-canvas p-4"><strong className="text-[.7rem] text-accent">{label}</strong><p className="mt-2 whitespace-pre-line text-[.74rem] leading-relaxed text-soft">{value}</p><button type="button" onClick={() => void navigator.clipboard.writeText(value).then(() => setNotice(`نُسخ «${label}».`))} className="mt-3 text-[.65rem] font-semibold text-accent">نسخ</button></article>)}</div>{project.social.articleDecision && <p className="mt-4 rounded-xl border border-accent/20 bg-canvas px-4 py-3 text-[.74rem] text-ink"><strong className="text-accent">قرار المقال:</strong> {project.social.articleDecision}</p>}</section>

        <section className={card}><p className="text-[.72rem] font-semibold text-accent">الأصول النهائية</p><div className="mt-4 grid gap-4 lg:grid-cols-3"><label className="rounded-xl border border-dashed border-hair bg-canvas p-4 text-center text-[.72rem] text-soft">رفع النسخة المركبة<input type="file" accept="video/mp4,video/webm,video/quicktime" className="mt-3 block w-full text-[.66rem]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, 'final'); event.currentTarget.value = '' }} /></label><label className="rounded-xl border border-dashed border-hair bg-canvas p-4 text-center text-[.72rem] text-soft">رفع صورة الغلاف<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-[.66rem]" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file, 'cover'); event.currentTarget.value = '' }} /></label><div className="rounded-xl border border-hair bg-canvas p-4"><label className="text-[.7rem] font-semibold text-ink">رابط YouTube — لا رفع تلقائي</label><input dir="ltr" className={`${input} mt-2 text-left`} value={youtubeDraft} onChange={(event) => setYoutubeDraft(event.target.value)} placeholder="https://youtube.com/watch?v=…" /><button type="button" onClick={saveYoutube} className={`${ghost} mt-2`}>إضافة الرابط</button></div></div>{project.finalVideoUrl && <video controls preload="metadata" className="mt-4 aspect-video w-full max-w-2xl rounded-xl bg-ink" src={project.finalVideoUrl} />}{project.youtubeUrl && <a href={project.youtubeUrl} target="_blank" rel="noreferrer" className="mt-3 block text-[.72rem] font-semibold text-accent">فتح فيديو YouTube</a>}</section>

        <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.72rem] font-semibold text-accent">حفظ المشروع</p><p className="mt-1 text-[.72rem] text-soft">المشروع والبرومبتات والنسخ والحالات خاصة بالمشرف.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => void saveProject()} className={primary}>{busy === 'save' ? 'أحفظ…' : 'احفظ المشروع'}</button><button type="button" disabled={Boolean(busy)} onClick={() => void saveProject('ready_to_publish')} className={ghost}>جاهز للنشر</button></div></div></section>
      </>}

      {projects.length > 0 && <RecentProjects projects={projects.filter((item) => item.id !== project?.id)} onOpen={(item) => { setProject(item); setPath(item.type === 'article_video' ? 'article' : 'public'); setYoutubeDraft(item.youtubeUrl || ''); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
    </div>
  )
}

type ClipCardProps = {
  segment: LiveDirectorSegment
  status: Record<LiveDirectorClipStatus, string>
  busy: string
  repairIssue: LiveDirectorRepairIssue
  hasFile: boolean
  frameSecond: string
  onStatus: (value: LiveDirectorClipStatus) => void
  onRepairIssue: (value: LiveDirectorRepairIssue) => void
  onRepair: () => void
  onCopy: (prompt: string, mode: FlowPromptMode) => void
  onPickClip: (file: File) => void
  onFrameSecond: (value: string) => void
  onCaptureFrame: (mode: 'last' | 'manual') => void
  onManualFrame: (file: File) => void
  onContinuity: (change: { mode?: ContinuityMode; strategy?: ReferenceStrategy }) => void
}

function ClipCard(props: ClipCardProps) {
  const { segment } = props
  const founding = segment.continuityMode === 'independent'
  const [promptMode, setPromptMode] = useState<FlowPromptMode>(() => segment.voiceMode === 'ambient' ? 'silent' : 'speech_ar')
  const activePrompt = getFlowPrompt(segment, promptMode)
  return (
    <article className="min-w-0 rounded-2xl border border-hair bg-canvas p-4" data-flow-clip={segment.id}>
      <div className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-[.62rem] font-semibold text-accent">المقطع {segment.order} · {segment.role}</span>
          <strong className="mt-1 block text-[.78rem] text-ink">{arabicCountPhrase(segment.shotCount, SHOT_FORMS)} · 8 ثوانٍ · {VOICE_MODE_LABELS[segment.voiceMode]}</strong>
        </span>
        <select aria-label={`حالة المقطع ${segment.order}`} className="rounded-full border border-hair bg-wash px-2 py-1 text-[.62rem] text-soft" value={segment.status} onChange={(event) => props.onStatus(event.target.value as LiveDirectorClipStatus)}>
          {Object.entries(props.status).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <p className="mt-3 text-[.68rem] leading-relaxed text-soft"><span className="font-semibold text-ink">المعنى الواحد:</span> {segment.message}</p>
      <p className="mt-1 text-[.62rem] text-soft">{NARRATION_SOURCE_LABELS[segment.narrationSource]}{segment.resonanceCount > 0 ? ` · ظلّلها ${segment.resonanceCount} من القرّاء` : ''}</p>
      {segment.narration
        ? <p className="mt-2 rounded-xl bg-wash px-3 py-2 text-[.72rem] leading-relaxed text-ink">{segment.narration}</p>
        : <p className="mt-2 rounded-xl border border-dashed border-hair px-3 py-2 text-[.68rem] leading-relaxed text-soft">بلا جملة منطوقة؛ الصورة تحمل المعنى والنص يُضاف في المونتاج.</p>}

      <ul className="mt-3 grid gap-1 text-[.63rem] text-soft">
        {segment.shotPlan.map((shot, index) => <li key={`${segment.id}-shot-${index}`} dir="ltr" className="text-left font-mono">{shot.from.toFixed(1)}–{shot.to.toFixed(1)}s · {shot.framing}</li>)}
      </ul>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label><span className="mb-1 block text-[.62rem] font-semibold text-ink">الترابط مع السابق</span>
          <select className="w-full rounded-lg border border-hair bg-wash px-2 py-1.5 text-[.66rem] text-ink" value={segment.continuityMode} onChange={(event) => props.onContinuity({ mode: event.target.value as ContinuityMode })}>
            {CONTINUITY_MODES.map((mode) => <option key={mode} value={mode}>{CONTINUITY_LABELS[mode]}</option>)}
          </select>
        </label>
        <label><span className="mb-1 block text-[.62rem] font-semibold text-ink">الصورة المرجعية</span>
          <select className="w-full rounded-lg border border-hair bg-wash px-2 py-1.5 text-[.66rem] text-ink" value={segment.referenceStrategy} onChange={(event) => props.onContinuity({ strategy: event.target.value as ReferenceStrategy })}>
            {REFERENCE_STRATEGIES.map((strategy) => <option key={strategy} value={strategy}>{REFERENCE_LABELS[strategy]}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[.62rem] leading-relaxed text-soft">
        {founding ? 'مشهد مؤسس: يبني العالم البصري الذي ترثه بقية المقاطع.' : segment.selectedReferenceFrame ? `يوجد إطار اختياري من ${segment.referenceSourceClipId} لتعزيز الاستمرارية.` : `لا يحتاج رفع صورة: البرومبت يبدأ بفقرة صريحة تجعله امتداداً للمقطع السابق ${segment.referenceSourceClipId || ''}.`}
      </p>
      {segment.selectedReferenceFrame && <img src={segment.selectedReferenceFrame} alt={`الإطار المرجعي للمقطع ${segment.order}`} loading="lazy" className="mt-2 h-24 w-full rounded-lg object-cover" />}

      {segment.overlayPlan.length > 0 && <details className="mt-3 rounded-xl border border-hair bg-wash p-3">
        <summary className="cursor-pointer list-none text-[.67rem] font-semibold text-soft">النصوص التي تُضاف بعد التوليد · {segment.overlayPlan.length}</summary>
        <ul className="mt-2 grid gap-2 text-[.64rem] leading-relaxed text-soft">
          {segment.overlayPlan.map((cue, index) => <li key={`${segment.id}-cue-${index}`}><strong className="text-ink">{cue.kind}</strong> — «{cue.text}» · {cue.from.toFixed(1)}–{cue.to.toFixed(1)}ث · {cue.position} · {cue.space}</li>)}
        </ul>
      </details>}

      <details className="mt-3 rounded-xl border border-hair p-3">
        <summary className="cursor-pointer list-none text-[.68rem] font-semibold text-accent">برومبت Flow · ثلاثة مسارات · بلا نصوص داخل الفيديو</summary>
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-wash p-1 sm:grid-cols-3" role="tablist" aria-label={`مسار الصوت للمقطع ${segment.order}`}>
          {FLOW_PROMPT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={promptMode === mode}
              onClick={() => setPromptMode(mode)}
              className={`min-h-9 rounded-lg px-3 py-2 text-[.66rem] font-semibold transition ${promptMode === mode ? 'bg-canvas text-accent shadow-sm' : 'text-soft hover:text-ink'}`}
            >
              {FLOW_PROMPT_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[.62rem] leading-relaxed text-soft">
          {promptMode === 'speech_ar'
            ? 'الأفتار يتحدث بالعربية. اكتب الجملة العربية منفصلة داخل Flow؛ البرومبت نفسه إنجليزي ولا يولّد كتابة أو ترجمة داخل الفيديو.'
            : promptMode === 'speech_en'
              ? 'الأفتار يتحدث بالإنجليزية. اكتب الجملة الإنجليزية منفصلة داخل Flow؛ لا يولّد البرومبت عناوين أو ترجمة أو أي نص ظاهر.'
              : 'المشهد صامت تماماً: لا حوار ولا تعليق صوتي ولا حركة فم توحي بالكلام، ولا أي نص ظاهر.'}
        </p>
        {segment.order > 1 && <p className="mt-1 text-[.62rem] leading-relaxed text-soft">أول فقرة في البرومبت تعرّف هذا المقطع تلقائياً بأنه إكمال مباشر للمقطع السابق، من دون الحاجة إلى رفع صورة أو ملف مرجعي.</p>}
        <pre dir="ltr" className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[.62rem] leading-relaxed text-soft">{activePrompt}</pre>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => props.onCopy(activePrompt, promptMode)} className={ghost}>نسخ · {FLOW_PROMPT_LABELS[promptMode]}</button>
        <label className={`${ghost} cursor-pointer`}>رفع المقطع<input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onPickClip(file); event.currentTarget.value = '' }} /></label>
      </div>

      <details className="mt-3 rounded-xl border border-hair bg-wash p-3">
        <summary className="cursor-pointer list-none text-[.67rem] font-semibold text-soft">إطار مرجعي اختياري للمقطع التالي</summary>
        <p className="mt-2 text-[.63rem] leading-relaxed text-soft">ليس مطلوباً لإكمال السلسلة؛ البرومبت يعمل وحده. عند استخدامه يُستخرج على جهازك فقط ولا يُرسل إلى خدمة معالجة.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!props.hasFile || Boolean(props.busy)} onClick={() => props.onCaptureFrame('last')} className={ghost}>الإطار الأخير</button>
          <input aria-label={`ثانية الإطار اليدوي للمقطع ${segment.order}`} dir="ltr" inputMode="decimal" value={props.frameSecond} onChange={(event) => props.onFrameSecond(event.target.value)} placeholder="5.5" className="w-20 rounded-lg border border-hair bg-canvas px-2 py-1.5 text-left text-[.66rem] text-ink" />
          <button type="button" disabled={!props.hasFile || Boolean(props.busy)} onClick={() => props.onCaptureFrame('manual')} className={ghost}>التقط هذه الثانية</button>
          <label className={`${ghost} cursor-pointer`}>ارفع صورة إطار<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) props.onManualFrame(file); event.currentTarget.value = '' }} /></label>
        </div>
        {!props.hasFile && <p className="mt-2 text-[.62rem] text-soft">اختر ملف المقطع من زر «رفع المقطع» ليصبح الالتقاط متاحاً.</p>}
        {segment.lastFrameImage && <img src={segment.lastFrameImage} alt={`إطار مأخوذ من المقطع ${segment.order}`} loading="lazy" className="mt-2 h-24 w-full rounded-lg object-cover" />}
      </details>

      <details className="mt-3 rounded-xl border border-hair bg-wash p-3">
        <summary className="cursor-pointer list-none text-[.67rem] font-semibold text-soft">النتيجة لم تضبط</summary>
        <select className={`${input} mt-3`} value={props.repairIssue} onChange={(event) => props.onRepairIssue(event.target.value as LiveDirectorRepairIssue)}>
          {LIVE_DIRECTOR_REPAIR_ISSUES.map((issue) => <option key={issue}>{issue}</option>)}
        </select>
        <button type="button" onClick={props.onRepair} className={`${ghost} mt-2 w-full`}>أصلح هذا المقطع فقط</button>
        {segment.revisionReason && <span className="mt-2 block text-[.62rem] text-soft">آخر سبب تعديل: {segment.revisionReason}</span>}
        {segment.promptVersions.length > 1 && <span className="mt-1 block text-[.62rem] text-soft">{arabicCountPhrase(segment.promptVersions.length, SAVED_PROMPT_COPY_FORMS)} لهذا المقطع.</span>}
      </details>

      {segment.videoUrl && <video controls preload="metadata" className="mt-3 aspect-video w-full rounded-xl bg-ink" src={segment.videoUrl} />}
    </article>
  )
}

/* منتقي الطاقم: ثلاثة قرارات صريحة بدل مربع اختيار واحد اسمه «الأفتار».
   «بلا ناس» ليس إطفاءً للأفتار — بل بنك مشاهد مختلف وقيود منعٍ شاملة. */
function CastPicker({ castMode, setCastMode }: { castMode: CastMode; setCastMode: (value: CastMode) => void }) {
  return (
    <label className="rounded-xl border border-hair bg-canvas p-3">
      <span className="text-[.72rem] font-semibold text-ink">من يظهر في الفيديو</span>
      <select className={`${input} mt-2`} value={castMode} onChange={(event) => setCastMode(event.target.value as CastMode)}>
        {CAST_MODES.map((item) => <option key={item} value={item}>{CAST_LABELS[item]}</option>)}
      </select>
      <span className="mt-2 block text-[.66rem] leading-relaxed text-soft">{CAST_NOTES[castMode]}</span>
    </label>
  )
}

function CommonSelects({ platform, tone, setPlatform, setTone, look, setLook, clipSeconds, setClipSeconds }: { platform: LiveDirectorPlatform; tone: LiveDirectorTone; setPlatform: (value: LiveDirectorPlatform) => void; setTone: (value: LiveDirectorTone) => void; look: FlowLookId; setLook: (value: FlowLookId) => void; clipSeconds: number; setClipSeconds: (value: number) => void }) {
  const chosen = flowLook(look)
  return <>
    <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">المنصة الأساسية</span><select className={input} value={platform} onChange={(event) => setPlatform(event.target.value as LiveDirectorPlatform)}>{PLATFORMS.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">النبرة</span><select className={input} value={tone} onChange={(event) => setTone(event.target.value as LiveDirectorTone)}>{TONES.map((item) => <option key={item}>{item}</option>)}</select></label>
    {/* النمط البصري يحمل العدسة والإضاءة والتدرّج والنسيج — لا اللون وحده. */}
    <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">النمط البصري</span>
      <select className={input} value={look} onChange={(event) => setLook(event.target.value as FlowLookId)}>
        {FLOW_LOOKS.map((item) => <option key={item.id} value={item.id}>{item.labelAr}</option>)}
      </select>
      <span className="mt-1 block text-[.65rem] leading-relaxed text-soft">{chosen.noteAr}</span>
      <span className="mt-1 block text-[.62rem] text-soft" dir="ltr">{chosen.lens} · {chosen.aperture}</span>
    </label>
    <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">مدة المقطع الواحد</span>
      <select className={input} value={clipSeconds} onChange={(event) => setClipSeconds(Number(event.target.value))}>
        {FLOW_CLIP_SECONDS.map((item) => <option key={item} value={item}>{arabicCountPhrase(item, SECOND_FORMS)}</option>)}
      </select>
      <span className="mt-1 block text-[.65rem] leading-relaxed text-soft">{FLOW_SECONDS_NOTE[clipSeconds] || ''}</span>
    </label>
  </>
}

/* الإطار الأول: صورة من وصف المشهد نفسه، تُحكَم بالعين قبل صرف رصيد Flow.
   المجانية تكفي للحكم على المزاج والتكوين؛ والفاخرة للمرشّح الذي وقع عليه الاختيار. */
function FramePreview({ frame, busy, onPreview }: { frame?: string; busy: boolean; onPreview: (premium: boolean) => void }) {
  return (
    <div className="mt-3">
      {frame
        ? <img src={frame} alt="الإطار الأول للمشهد" loading="lazy" className="mb-2 w-full rounded-xl border border-hair object-cover" />
        : <p className="mb-2 rounded-xl border border-dashed border-hair px-3 py-4 text-center text-[.66rem] leading-relaxed text-soft">لم تُولَّد معاينة بعد — شاهد الإطار الأول قبل أن تصرف من رصيد Flow.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => onPreview(false)} className={ghost}>{busy ? 'أولّد…' : frame ? 'معاينة أخرى' : 'شاهد الإطار الأول'}</button>
        <button type="button" disabled={busy} onClick={() => onPreview(true)} className={ghost}>معاينة فاخرة</button>
      </div>
    </div>
  )
}

/* مصنع الريلز الرمزية: فكرة الدكتور × مكتبة مشاهد سينمائية = مفاهيم إنستغرام
   جاهزة. حتميٌّ بلا نموذج لغوي؛ التوليد داخل حساب Flow المدفوع يدوياً. */
function SymbolicReelsPanel({ clipSeconds, setClipSeconds, onNotice, onPublicVideo }: { clipSeconds: number; setClipSeconds: (value: number) => void; onNotice: (value: string) => void; onPublicVideo: () => void }) {
  const [idea, setIdea] = useState('')
  const [sentence, setSentence] = useState('')
  const [concepts, setConcepts] = useState<ReelConcept[]>([])
  const [invented, setInvented] = useState<InventedReel[]>([])
  const [inventing, setInventing] = useState(false)
  const [sources, setSources] = useState<string[]>([])
  /* الإطار الأول: صورة ثابتة من وصف المشهد نفسه، تُرى قبل صرف رصيد Flow.
     مجانية عبر مولّد الموقع، ولها خيار فاخر بمفتاح Gemini للمرشّح النهائي. */
  const [frames, setFrames] = useState<Record<string, string>>({})
  const [framing, setFraming] = useState('')

  const previewFrame = async (key: string, sceneEn: string, premium: boolean) => {
    setFraming(key); onNotice(premium ? 'أولّد معاينة فاخرة…' : 'أولّد الإطار الأول…')
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const { getAuth } = await import('firebase/auth')
      const user = getAuth(app).currentUser
      if (!user) throw new Error('الدخول كمشرف مطلوب')
      const token = await user.getIdToken()
      const response = await fetch('/api/ai/studio-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ idea: sceneEn, orientation: 'portrait', generationMode: premium ? 'masterpiece' : 'daily' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(data?.error || 'تعذّرت المعاينة'))
      const image = String(data?.imageUrl || '')
      if (!image) throw new Error('لم تصل صورة')
      setFrames((previous) => ({ ...previous, [key]: image }))
      onNotice('جاهزة — احكم عليها قبل Flow.')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'تعذّرت المعاينة')
    } finally { setFraming('') }
  }
  const forge = () => {
    if (idea.trim().length < 4) { onNotice('اكتب الفكرة أولاً.'); return }
    setConcepts(forgeSymbolicReels({ idea, sentence, seconds: clipSeconds, count: 4 }))
  }
  /* الابتكار: النموذج يخترع مشهداً لم يُكتب من قبل، مغذّى بمعجم الدكتور
     وبمقاطع من أرشيفه كله — الكتب والمقالات واللقاءات والأبحاث. */
  const invent = async () => {
    if (idea.trim().length < 4) { onNotice('اكتب الفكرة أولاً.'); return }
    setInventing(true); onNotice('أبتكر مشاهد من أرشيفك…')
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const { getAuth } = await import('firebase/auth')
      const user = getAuth(app).currentUser
      if (!user) throw new Error('الدخول كمشرف مطلوب')
      const token = await user.getIdToken()
      const response = await fetch('/api/ai/reel-invention', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ idea, sentence, seconds: clipSeconds, count: 4 }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(String(data?.error || 'تعذّر الابتكار'))
      const scenes: InventedReel[] = Array.isArray(data?.scenes) ? data.scenes : []
      setInvented(scenes)
      setSources(Array.isArray(data?.sources) ? data.sources : [])
      onNotice(scenes.length ? `ابتُكر ${arabicCountPhrase(scenes.length, REEL_SCENE_FORMS)} من أرشيفك.` : 'لم يخرج مشهد مطابق — أعد المحاولة.')
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'تعذّر الابتكار')
    } finally { setInventing(false) }
  }
  const copy = (value: string, label: string) => void navigator.clipboard.writeText(value).then(() => onNotice(`نُسخ ${label}.`))
  return (
    <div className="mt-6 grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">ما الفكرة؟</span><textarea className={`${input} min-h-24`} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="فكرة أو موضوع بكلماتك — الركض الدائم، سؤال معلّق، عادة تتجذّر…" /></label>
        <label><span className="mb-2 block text-[.72rem] font-semibold text-ink">الجملة التي ستظهر فوق الفيديو</span><textarea className={`${input} min-h-24`} value={sentence} onChange={(event) => setSentence(event.target.value)} placeholder="اختياري؛ إن تركتها تُستعمل الفكرة نفسها." /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void invent()} disabled={inventing} className={primary}>{inventing ? 'أبتكر…' : 'ابتكر من أرشيفي'}</button>
        <button type="button" onClick={forge} className={ghost}>مشاهد جاهزة (بلا انتظار)</button>
        {/* الباب القديم «فيديو للجمهور» لم يُحذف: صار خياراً داخل هذا المسار
            لمن أراد فيديو أفتار يشرح بدل المشهد الرمزي. */}
        <button type="button" onClick={onPublicVideo} className={ghost}>أريده فيديو شرح بدل المشهد</button>
        <label className="flex items-center gap-2 text-[.7rem] text-soft">المدة
          <select className="rounded-lg border border-hair bg-canvas px-2 py-1.5 text-[.7rem] text-ink" value={clipSeconds} onChange={(event) => setClipSeconds(Number(event.target.value))}>
            {FLOW_CLIP_SECONDS.map((item) => <option key={item} value={item}>{arabicCountPhrase(item, SECOND_FORMS)}</option>)}
          </select>
        </label>
        <span className="text-[.7rem] text-soft">بلا أفتار · بلا نص داخل الفيديو — جملتك تُركَّب بعد التوليد</span>
      </div>
      <div className="rounded-xl border border-hair bg-wash px-4 py-3 text-[.7rem] leading-relaxed text-soft">
        <b className="font-semibold text-ink">أطول من ثماني ثوانٍ؟</b> ولّد المقطع الأول بالبرومبت، ثم اضغط <b className="text-ink">Extend</b> داخل Flow والصق «برومبت التمديد» — يضيف سبع ثوانٍ متصلة تكمل الاستعارة ولا تعيدها. كرّرها لما تشاء (٨ ← ١٥ ← ٢٢…).
      </div>
      {invented.length > 0 && <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="font-display text-lg font-semibold text-ink">مشاهد ابتُكرت لفكرتك</h3>
          {sources.length > 0 && <span className="text-[.64rem] leading-relaxed text-soft">من أرشيفك: {sources.slice(0, 4).join(' · ')}</span>}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {invented.map((scene, index) => {
            const prompt = reelPromptFromScene({ ...scene, lookId: DEFAULT_FLOW_LOOK }, clipSeconds)
            const line = sentence.trim() || idea.trim()
            return (
              <article key={`${scene.labelAr}-${index}`} className="rounded-2xl border border-accent/25 bg-canvas p-5">
                <span className="text-[.66rem] font-semibold text-accent">مبتكَر · {arabicCountPhrase(clipSeconds, SECOND_FORMS)}</span>
                <strong className="mt-1 block font-display text-lg text-ink">{scene.labelAr}</strong>
                <p className="mt-2 text-[.78rem] leading-relaxed text-soft">{scene.sceneAr}</p>
                <p className="mt-2 text-[.7rem] leading-relaxed text-soft"><span className="font-semibold text-ink">لماذا:</span> {scene.whyAr}</p>
                {line && <p className="mt-2 rounded-xl bg-wash px-3 py-2 font-display text-[.85rem] leading-loose text-ink">«{line}»</p>}
                <details className="mt-3 rounded-xl border border-hair p-3">
                  <summary className="cursor-pointer list-none text-[.68rem] font-semibold text-accent">برومبت Flow</summary>
                  <pre dir="ltr" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[.62rem] leading-relaxed text-soft">{prompt}</pre>
                </details>
                <FramePreview
                  frame={frames[`inv:${index}`]}
                  busy={framing === `inv:${index}`}
                  onPreview={(premium) => void previewFrame(`inv:${index}`, scene.sceneEn, premium)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => copy(prompt, `برومبت «${scene.labelAr}»`)} className={ghost}>نسخ البرومبت</button>
                </div>
              </article>
            )
          })}
        </div>
      </section>}

      {concepts.length > 0 && <div className="grid gap-4 md:grid-cols-2">
        {concepts.map((concept) => {
          const look = flowLook(concept.scene.lookId)
          return (
            <article key={concept.scene.id} className="rounded-2xl border border-hair bg-canvas p-5">
              <span className="text-[.66rem] font-semibold text-accent">{look.labelAr} · {arabicCountPhrase(concept.seconds, SECOND_FORMS)}</span>
              <strong className="mt-1 block font-display text-lg text-ink">{concept.scene.labelAr}</strong>
              <p className="mt-2 text-[.78rem] leading-relaxed text-soft">{concept.scene.sceneAr}</p>
              <p className="mt-2 rounded-xl bg-wash px-3 py-2 font-display text-[.85rem] leading-loose text-ink">«{concept.overlay.text}»</p>
              <p className="mt-1 text-[.64rem] text-soft">تُركَّب {concept.overlay.positionAr} · من {concept.overlay.from.toFixed(1)} إلى {concept.overlay.to.toFixed(1)}ث</p>
              <details className="mt-3 rounded-xl border border-hair p-3">
                <summary className="cursor-pointer list-none text-[.68rem] font-semibold text-accent">برومبت Flow</summary>
                <pre dir="ltr" className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[.62rem] leading-relaxed text-soft">{concept.flowPrompt}</pre>
              </details>
              <FramePreview
                frame={frames[`lib:${concept.scene.id}`]}
                busy={framing === `lib:${concept.scene.id}`}
                onPreview={(premium) => void previewFrame(`lib:${concept.scene.id}`, concept.scene.sceneEn, premium)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copy(concept.flowPrompt, `برومبت «${concept.scene.labelAr}»`)} className={ghost}>نسخ البرومبت</button>
                <button type="button" onClick={() => copy(`${concept.captionAr}\n\n${concept.hashtags.join(' ')}`, 'الكابشن والهاشتاقات')} className={ghost}>نسخ الكابشن</button>
                {/* «مرات أبي أكثر من ٨ ثواني»: التمديد داخل Flow يضيف سبعاً،
                    وبرومبته يكمل من الإطار الأخير ولا يعيد المشهد. */}
                <button type="button" onClick={() => copy(concept.extendPrompt, `تمديد «${concept.scene.labelAr}»`)} className={ghost}>نسخ التمديد ‎+٧ث</button>
              </div>
              <p className="mt-2 text-[.62rem] leading-relaxed text-soft">الغلاف: {concept.scene.coverIdeaAr} — من استوديو التصاميم.</p>
            </article>
          )
        })}
      </div>}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-hair bg-canvas p-4"><span className="text-[.65rem] text-soft">{label}</span><strong className="mt-1 block font-display text-lg text-ink">{value}</strong></div>
}

function RecentProjects({ projects, onOpen }: { projects: StoredProject[]; onOpen: (project: StoredProject) => void }) {
  if (!projects.length) return null
  return <details className={card}><summary className="cursor-pointer list-none text-[.76rem] font-semibold text-ink">المشاريع المحفوظة · {projects.length}</summary><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{projects.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item)} className="rounded-xl border border-hair bg-canvas p-4 text-right transition hover:border-accent"><span className="text-[.62rem] font-semibold text-accent">{item.type === 'article_video' ? 'فيديو مقال' : 'فيديو جمهور'} · {arabicCountPhrase(item.duration, SECOND_FORMS)}</span><strong className="mt-1 line-clamp-2 block text-[.76rem] text-ink">{item.title}</strong><span className="mt-1 block text-[.65rem] text-soft">{item.status}</span></button>)}</div></details>
}
