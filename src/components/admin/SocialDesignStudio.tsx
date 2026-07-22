import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  analyzeSocialContent,
  createEmptyTasteProfile,
  designHistoryEntry,
  generateSocialDesigns,
  generateSocialCampaign,
  regenerateFromPlan,
  transformDesignFormat,
  updateTasteProfile,
  type CompositionPlan,
  type ContentTone,
  type DesignDensity,
  type DesignHistoryEntry,
  type DesignTasteProfile,
  type SocialFormatId,
  type SocialPlatform,
  type SocialCampaign,
} from '../../lib/social-design-engine'
import {
  downloadCompositionRaster,
  downloadCompositionSvg,
  printCompositionPdf,
  downloadSocialCampaignRaster,
  printSocialCampaignPdf,
  renderCompositionSvg,
} from '../../lib/social-design-renderer'

const card = 'rounded-[1.75rem] border border-hair bg-paper p-5 shadow-sm md:p-7'
const input = 'w-full rounded-2xl border border-hair bg-canvas px-4 py-3 text-[.88rem] text-ink outline-none transition focus:border-accent'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'
const HISTORY_KEY = 'dr-ahmad-social-design-history-v1'
const SAVED_KEY = 'dr-ahmad-social-design-saved-v1'
const TASTE_KEY = 'dr-ahmad-social-design-taste-v1'
const TASTE_LEDGER_KEY = 'dr-ahmad-social-design-taste-ledger-v1'

const toneLabels: Record<ContentTone | 'auto', string> = {
  auto: 'ذكي تلقائي',
  formal: 'رسمي',
  institutional: 'مؤسسي',
  luxury: 'فاخر',
  human: 'إنساني',
  inspiring: 'ملهم',
  deep: 'عميق',
  bold: 'جريء',
  calm: 'هادئ',
  academic: 'أكاديمي',
  media: 'إعلامي',
  promotional: 'ترويجي',
  intellectual: 'فكري',
}

const densityLabels: Record<DesignDensity | 'auto', string> = {
  auto: 'ذكية',
  minimal: 'Minimal',
  balanced: 'Balanced',
  rich: 'Rich',
}

const platformLabels: Record<SocialPlatform | 'auto', string> = {
  auto: 'يختار الأنسب',
  instagram: 'Instagram',
  story: 'Story',
  reel: 'Reel',
  linkedin: 'LinkedIn',
  x: 'X',
  pinterest: 'Pinterest',
  presentation: '16:9',
  thumbnail: 'Thumbnail',
}

const formatActions: { id: SocialFormatId; label: string }[] = [
  { id: 'story', label: 'حوّله إلى Story' },
  { id: 'instagram-carousel', label: 'حوّله إلى Carousel' },
  { id: 'linkedin-landscape', label: 'نسخة LinkedIn' },
  { id: 'x-landscape', label: 'نسخة X' },
  { id: 'reel-cover', label: 'غلاف Reel' },
]

const kindArabic: Record<string, string> = {
  quote: 'اقتباس',
  'core-idea': 'فكرة رئيسية',
  summary: 'ملخص',
  'provocative-question': 'سؤال جدلي',
  announcement: 'إعلان',
  invitation: 'دعوة',
  information: 'معلومة',
  statistic: 'إحصائية',
  recommendation: 'توصية',
  lecture: 'محاضرة',
  course: 'دورة',
  consultation: 'استشارة',
  'media-appearance': 'لقاء إعلامي',
  book: 'كتاب',
  research: 'بحث',
  article: 'مقال',
  carousel: 'كاروسيل',
  'reel-cover': 'غلاف Reel',
  'linkedin-post': 'منشور LinkedIn',
  'x-post': 'منشور X',
  'impression-card': 'بطاقة انطباعية',
  'knowledge-design': 'تصميم معرفي',
}

function loadHistory(): DesignHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 96) : []
  } catch { return [] }
}

function remember(plans: CompositionPlan[]) {
  const previous = loadHistory()
  const next = [...plans.map((plan) => designHistoryEntry(plan, new Date().toISOString())), ...previous]
  const unique = new Map<string, DesignHistoryEntry>()
  for (const item of next) if (!unique.has(item.fingerprint)) unique.set(item.fingerprint, item)
  try { window.localStorage.setItem(HISTORY_KEY, JSON.stringify([...unique.values()].slice(0, 96))) } catch { /* وضع خاص أو تخزين ممتلئ: لا نوقف التوليد */ }
}

function loadSavedPlans(): CompositionPlan[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.slice(0, 30) : []
  } catch { return [] }
}

function savePlan(plan: CompositionPlan) {
  let saved: CompositionPlan[] = []
  if (typeof window === 'undefined') return [plan]
  try { saved = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]') } catch { saved = [] }
  const next = [plan, ...saved.filter((item) => item.fingerprint !== plan.fingerprint)].slice(0, 30)
  try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* تظل النسخة حية في الجلسة الحالية */ }
  return next
}

function loadTasteProfile(): DesignTasteProfile {
  if (typeof window === 'undefined') return createEmptyTasteProfile()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TASTE_KEY) || 'null')
    return parsed?.version === 1 ? parsed : createEmptyTasteProfile()
  } catch { return createEmptyTasteProfile() }
}

function storeTasteProfile(profile: DesignTasteProfile) {
  try { window.localStorage.setItem(TASTE_KEY, JSON.stringify(profile)) } catch { /* لا نوقف الاستوديو إن مُنع التخزين */ }
}

type TasteSignalLedger = Record<string, 1 | -1>

function loadTasteLedger(): TasteSignalLedger {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TASTE_LEDGER_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}

function storeTasteLedger(ledger: TasteSignalLedger) {
  try { window.localStorage.setItem(TASTE_LEDGER_KEY, JSON.stringify(ledger)) } catch { /* الذاكرة اختيارية ولا تعطل التصدير */ }
}

function Preview({ plan, className = '' }: { plan: CompositionPlan; className?: string }) {


  return (
    <div
      className={`overflow-hidden rounded-2xl border border-hair bg-canvas shadow-sm ${className}`}
      style={{ aspectRatio: `${plan.format.width} / ${plan.format.height}` }}
      dangerouslySetInnerHTML={{ __html: renderCompositionSvg(plan) }}
    />
  )
}

function LockButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-[.7rem] font-semibold transition ${active ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{active ? 'مقفول · ' : ''}{children}</button>
}

export function SocialDesignStudio({ initialText = '', initialContext = '' }: { initialText?: string; initialContext?: string }) {
  const [text, setText] = useState(initialText)
  const [context, setContext] = useState(initialContext)
  const [tone, setTone] = useState<ContentTone | 'auto'>('auto')
  const [density, setDensity] = useState<DesignDensity | 'auto'>('auto')
  const [platform, setPlatform] = useState<SocialPlatform | 'auto'>('auto')
  const [count, setCount] = useState(6)
  const [plans, setPlans] = useState<CompositionPlan[]>([])
  const [selected, setSelected] = useState<CompositionPlan | null>(null)
  const [notice, setNotice] = useState('')
  const [generation, setGeneration] = useState(0)
  const [locks, setLocks] = useState({ content: false, style: false, color: false, format: false })
  const [savedPlans, setSavedPlans] = useState<CompositionPlan[]>(() => loadSavedPlans())
  const [showSaved, setShowSaved] = useState(false)
  const [tasteProfile, setTasteProfile] = useState<DesignTasteProfile>(() => loadTasteProfile())
  const [tasteLedger, setTasteLedger] = useState<TasteSignalLedger>(() => loadTasteLedger())
  const [campaign, setCampaign] = useState<SocialCampaign | null>(null)
  const [campaignBusy, setCampaignBusy] = useState(false)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => { if (initialText && !text.trim()) setText(initialText) }, [initialText])
  useEffect(() => { if (initialContext && !context.trim()) setContext(initialContext) }, [initialContext])

  useEffect(() => {
    if (!selected) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selected])

  const hasInput = text.trim().length >= 3
  const analysis = useMemo(() => analyzeSocialContent(hasInput ? text : 'فكرة معرفية جديدة', context, { author: 'د. أحمد حسين الفيلكاوي' }), [context, hasInput, text])

  const generate = (overrides: { tone?: ContentTone | 'auto'; density?: DesignDensity | 'auto'; platform?: SocialPlatform | 'auto'; count?: number } = {}) => {
    if (text.trim().length < 3) {
      setNotice('اكتب جملة أو فكرة أولًا؛ المحرك لا يصنع تصميمًا فارغًا.')
      textRef.current?.focus()
      return
    }
    const nextGeneration = generation + 1
    const result = generateSocialDesigns({
      text,
      context,
      author: 'د. أحمد حسين الفيلكاوي',
      tone: overrides.tone ?? tone,
      density: overrides.density ?? density,
      platform: overrides.platform ?? platform,
      count: overrides.count ?? count,
      seed: `${text}:${context}:${nextGeneration}:${Date.now()}`,
      history: loadHistory(),
      noveltyThreshold: .36,
      tasteProfile,
    })
    setGeneration(nextGeneration)
    setPlans(result.plans)
    setSelected(null)
    remember(result.plans)
    setNotice(result.generation.warnings[0] || `وُلّدت ${result.plans.length} اتجاهات مختلفة فعليًا؛ لا مجرد تغيير لون.`)
  }

  const regenerateSelected = (profile: 'smart' | 'luxury' | 'calm' | 'bold') => {
    if (!selected) return
    const profileTone: ContentTone | 'auto' = profile === 'luxury' ? 'luxury' : profile === 'calm' ? 'calm' : profile === 'bold' ? 'bold' : tone
    const result = regenerateFromPlan(selected, {
      text,
      context,
      tone: profileTone,
      density,
      platform,
      count: 6,
      seed: `${profile}:${Date.now()}:${selected.fingerprint}`,
      locks,
      history: loadHistory(),
      noveltyThreshold: .38,
      tasteProfile,
    })
    setPlans(result.plans)
    setSelected(result.plans[0] || selected)
    remember(result.plans)
    setNotice(profile === 'smart' ? 'بُني اقتراح أذكى مع الابتعاد عن تاريخك البصري.' : `بُنيت نسخة ${toneLabels[profileTone]} مع احترام الأقفال.`)
  }

  const transform = (format: SocialFormatId) => {
    if (!selected) return
    const next = transformDesignFormat(selected, format, { locks, respectFormatLock: true, seed: Date.now() })
    if (next === selected && locks.format) {
      setNotice('المقاس مقفول؛ افتح قفل المقاس أولًا.')
      return
    }
    setSelected(next)
    setPlans((previous) => [next, ...previous.filter((item) => item.id !== selected.id)].slice(0, 8))
    remember([next])
    setNotice(`أُعيد بناء التكوين للمقاس ${next.format.label}، وليس مجرد تمديد الصورة.`)
  }

  const shorten = () => {
    const compact = analysis.structure.title || analysis.structure.keyPoint || text.split(/[.!؟\n]/)[0] || text
    setText(compact.trim())
    setNotice('اختُصر النص إلى فكرته البصرية الأقوى. اضغط «ولّد الاتجاهات».')
  }

  const makeCarousel = () => {
    if (text.trim().length < 3) {
      setNotice('اكتب الفكرة أولًا كي أبني لها كاروسيلًا حقيقيًا.')
      textRef.current?.focus()
      return
    }
    const nextGeneration = generation + 1
    const result = generateSocialDesigns({
      text,
      context,
      author: 'د. أحمد حسين الفيلكاوي',
      tone,
      density,
      platform: 'instagram',
      count: 6,
      seed: `carousel:${text}:${context}:${nextGeneration}:${Date.now()}`,
      history: loadHistory(),
      noveltyThreshold: .38,
      tasteProfile,
    })
    const carouselPlans = result.plans.map((plan, index) => transformDesignFormat(plan, 'instagram-carousel', {
      respectFormatLock: false,
      seed: `${plan.fingerprint}:carousel:${index}`,
    }))
    setPlatform('instagram')
    setGeneration(nextGeneration)
    setPlans(carouselPlans)
    setSelected(null)
    remember(carouselPlans)
    setNotice('بُنيت ستة اتجاهات كاروسيل مختلفة؛ كل اتجاه يعيد توزيع الفكرة على شرائح بدل تمديد قالب واحد.')
  }

  const teachTaste = (plan: CompositionPlan, signal: 1 | -1) => {
    const previousSignal = tasteLedger[plan.fingerprint]
    if (previousSignal === signal) {
      setNotice(signal > 0 ? 'هذا الاتجاه محفوظ أصلًا في ذاكرة ذوقك؛ لن نضاعف وزنه بسبب تكرار التنزيل.' : 'هذا الأسلوب مستبعد أصلًا من ذاكرتك.')
      return tasteProfile
    }
    let next = tasteProfile
    if (previousSignal) next = updateTasteProfile(next, plan, previousSignal === 1 ? -1 : 1)
    next = updateTasteProfile(next, plan, signal)
    const nextLedger = { ...tasteLedger, [plan.fingerprint]: signal }
    setTasteProfile(next)
    setTasteLedger(nextLedger)
    storeTasteProfile(next)
    storeTasteLedger(nextLedger)
    setNotice(signal > 0
      ? `تعلّم الاستوديو هذا الاختيار مرة واحدة. ذاكرة الذوق الآن مبنية على ${Object.keys(nextLedger).length} اتجاهات مستقلة.`
      : 'ابتعد الاستوديو عن هذا الأسلوب في التوليدات القادمة من دون أن يقتل التنوع.')
    return next
  }

  const resetTaste = () => {
    const empty = createEmptyTasteProfile()
    setTasteProfile(empty)
    setTasteLedger({})
    storeTasteProfile(empty)
    storeTasteLedger({})
    setNotice('أُعيد ضبط ذاكرة الذوق فقط؛ لم تُحذف تصاميمك المحفوظة ولا تاريخ التنويع.')
  }

  const exportPlan = async (plan: CompositionPlan, type: 'png' | 'jpeg') => {
    teachTaste(plan, 1)
    await downloadCompositionRaster(plan, type)
  }

  const buildCampaign = () => {
    if (!selected && !plans[0]) {
      setNotice('ولّد اتجاهًا أولًا، ثم حوّله إلى حملة متكاملة.')
      return
    }
    setCampaignBusy(true)
    try {
      const basePlan = selected || plans[0]
      const next = generateSocialCampaign({
        text,
        context,
        author: 'د. أحمد حسين الفيلكاوي',
        tone,
        density,
        seed: `campaign:${text}:${Date.now()}`,
        history: loadHistory(),
        tasteProfile,
        basePlan,
        noveltyThreshold: .36,
      })
      setCampaign(next)
      remember(next.assets.map((asset) => asset.plan))
      setSelected(null)
      setNotice(next.ready
        ? `اكتملت حملة من ${next.assets.length} قطع متناسقة وغير مكررة واجتازت لجنة الجودة: ${next.qualityScore}٪.`
        : next.warnings[0] || 'الحملة تحتاج إعادة توليد قبل التصدير.')
    } finally { setCampaignBusy(false) }
  }

  return (
    <div className="grid gap-5">
      <section className={`${card} overflow-hidden`}>
        <div className="relative">
          <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <p className="relative text-[.72rem] font-bold uppercase tracking-[.18em] text-accent">Design Intelligence · Local</p>
          <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">استوديو التصميم الذكي</h2>
              <p className="mt-3 max-w-3xl text-[.88rem] leading-loose text-soft">اكتب الفكرة فقط. المحرك يفهم النبرة والبنية والمنصة، ثم يبني 4–8 تكوينات مختلفة فعليًا باستخدام هندسة محلية مجانية بلا API أو صور جاهزة.</p>
            </div>
            <span className="rounded-full border border-accent/25 bg-accent/[.06] px-4 py-2 text-[.72rem] font-semibold text-accent">لا تكلفة تشغيلية · عربي أولًا</span>
          </div>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,.7fr)]">
          <label className="grid gap-2 text-[.75rem] font-semibold text-soft">
            الجملة أو الموضوع
            <textarea ref={textRef} className={`${input} min-h-36 resize-y text-base leading-loose`} value={text} onChange={(event) => setText(event.target.value)} placeholder="مثال: الذكاء الاصطناعي لا يجب أن يسرق من المعلم إنسانيته" />
          </label>
          <label className="grid gap-2 text-[.75rem] font-semibold text-soft">
            السياق أو الهدف — اختياري
            <textarea className={`${input} min-h-36 resize-y leading-loose`} value={context} onChange={(event) => setContext(event.target.value)} placeholder="محاضرة، مقال، دعوة، جمهور مستهدف، أو ما تريد أن يبقى في ذهن القارئ." />
          </label>
        </div>

        {hasInput && <div className="mt-4 grid gap-3 rounded-2xl border border-hair bg-canvas p-4 sm:grid-cols-2 xl:grid-cols-5">
          <div><span className="block text-[.66rem] text-soft">فهم المحتوى</span><strong className="mt-1 block text-[.82rem] text-ink">{kindArabic[analysis.primaryKind] || analysis.primaryKind}</strong></div>
          <div><span className="block text-[.66rem] text-soft">النبرة المكتشفة</span><strong className="mt-1 block text-[.82rem] text-ink">{toneLabels[analysis.primaryTone]}</strong></div>
          <div><span className="block text-[.66rem] text-soft">الكلمة البطولية</span><strong className="mt-1 block line-clamp-1 text-[.82rem] text-ink">{analysis.structure.heroWord || '—'}</strong></div>
          <div><span className="block text-[.66rem] text-soft">المخرج الأنسب</span><strong className="mt-1 block text-[.82rem] text-ink">{analysis.recommendedFormats[0]?.reason || 'يُحدد بعد اكتمال النص'}</strong></div>
          <div><span className="block text-[.66rem] text-soft">الثقة</span><strong className="mt-1 block text-[.82rem] text-ink">{Math.round(analysis.confidence)}٪</strong></div>
        </div>}

        {hasInput && <div className="mt-4 flex flex-wrap gap-2">
          {analysis.suggestions.slice(0, 5).map((suggestion) => (
            <button key={suggestion.id} type="button" className={ghost} title={suggestion.reason} onClick={() => suggestion.id === 'shorten' ? shorten() : suggestion.id === 'carousel' ? makeCarousel() : suggestion.id === 'quiet-version' ? generate({ tone: 'calm' }) : generate()}>{suggestion.label}</button>
          ))}
        </div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_.8fr_auto]">
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">النبرة<select className={input} value={tone} onChange={(event) => setTone(event.target.value as ContentTone | 'auto')}>{Object.entries(toneLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">المنصة<select className={input} value={platform} onChange={(event) => setPlatform(event.target.value as SocialPlatform | 'auto')}>{Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">الكثافة<select className={input} value={density} onChange={(event) => setDensity(event.target.value as DesignDensity | 'auto')}>{Object.entries(densityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">عدد الاتجاهات<select className={input} value={count} onChange={(event) => setCount(Number(event.target.value))}>{[4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="flex items-end"><button type="button" className={`${primary} w-full px-8`} onClick={() => generate()}>ولّد الاتجاهات</button></div>
        </div>
        {notice && <p className="mt-5 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}
      </section>

      {plans.length > 0 && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.72rem] font-bold uppercase tracking-[.16em] text-accent">Creative directions</p>
              <h3 className="mt-1 font-display text-2xl font-bold text-ink">ليست قوالب؛ هذه اتجاهات تكوين.</h3>
              <p className="mt-2 text-[.8rem] leading-relaxed text-soft">كل نتيجة تختلف في العائلة، والهندسة، والخط، والإيقاع، وطريقة إبراز الفكرة.</p>
            </div>
            <div className="flex flex-wrap gap-2"><span className="rounded-full border border-accent/25 bg-accent/[.05] px-4 py-2 text-[.72rem] font-semibold text-accent">لجنة الجودة {Math.round(plans.reduce((sum, plan) => sum + (plan.quality?.score || 0), 0) / plans.length)}٪</span><span className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft">ذاكرة ذوقك {Object.keys(tasteLedger).length} اتجاه</span>{Object.keys(tasteLedger).length > 0 && <button type="button" className={ghost} onClick={resetTaste}>إعادة ضبط الذوق</button>}<button type="button" className={primary} disabled={campaignBusy} onClick={buildCampaign}>{campaignBusy ? 'يبني الحملة…' : 'حوّلها إلى حملة'}</button><button type="button" className={ghost} onClick={() => setShowSaved((value) => !value)}>المحفوظة {savedPlans.length}</button><button type="button" className={ghost} onClick={() => generate()}>توليد دفعة مختلفة</button></div>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {plans.map((plan) => (
              <article key={plan.id} className="group grid content-start gap-3 rounded-[1.4rem] border border-hair bg-canvas p-3 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
                <button type="button" className="block w-full text-right" onClick={() => setSelected(plan)} aria-label={`افتح ${plan.directionLabel}`}><Preview plan={plan} /></button>
                <div className="px-1 pb-1">
                  <div className="flex items-start justify-between gap-3"><div><strong className="block text-[.82rem] text-ink">{plan.directionLabel}</strong><span className="mt-1 block text-[.68rem] text-soft">{plan.format.label}</span></div><div className="flex flex-col items-end gap-1"><span className="rounded-full bg-paper px-2 py-1 text-[.64rem] font-semibold text-accent">جودة {plan.quality?.score || 0}٪</span><span className="text-[.62rem] text-soft">{Math.round(plan.novelty * 100)}٪ جديد</span></div></div>
                  <p className="mt-2 line-clamp-2 text-[.72rem] leading-relaxed text-soft">{plan.rationale.join(' · ')}</p>
                  <div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => setSelected(plan)}>تكبير وتعديل</button><button type="button" className={ghost} onClick={() => void exportPlan(plan, 'png')}>PNG</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}


      {campaign && (
        <section className={`${card} overflow-hidden`} aria-labelledby="campaign-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[.72rem] font-bold uppercase tracking-[.16em] text-accent">One idea · Complete campaign</p>
              <h3 id="campaign-title" className="mt-1 font-display text-2xl font-bold text-ink">حملة واحدة، لكل منصة لغتها.</h3>
              <p className="mt-2 max-w-2xl text-[.8rem] leading-relaxed text-soft">ليست الصورة نفسها بمقاسات مختلفة؛ كل قطعة أعادت بناء الفكرة لدورها، مع خيط لوني واحد وتكوينات متباعدة.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-hair px-3 py-2 text-[.7rem] text-soft">جودة {campaign.qualityScore}٪</span>
              <span className="rounded-full border border-hair px-3 py-2 text-[.7rem] text-soft">تماسك {campaign.coherenceScore}٪</span>
              <span className="rounded-full border border-hair px-3 py-2 text-[.7rem] text-soft">تنوع {campaign.diversityScore}٪</span>
              <span className={`rounded-full px-3 py-2 text-[.7rem] font-semibold ${campaign.ready ? 'bg-accent/10 text-accent' : 'bg-amber-50 text-amber-800'}`}>{campaign.ready ? 'جاهزة للنشر' : 'تحتاج إعادة توليد'}</span>
              <button type="button" className={primary} disabled={!campaign.ready} onClick={() => void downloadSocialCampaignRaster(campaign, 'png')}>تنزيل الحملة PNG</button>
              <button type="button" className={ghost} disabled={!campaign.ready} onClick={() => printSocialCampaignPdf(campaign)}>PDF للحملة</button>
            </div>
          </div>
          {!campaign.ready && campaign.warnings.length > 0 && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[.76rem] leading-relaxed text-amber-900">{campaign.warnings.join(' · ')}</p>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {campaign.assets.map((asset) => (
              <article key={asset.id} className="rounded-[1.4rem] border border-hair bg-canvas p-3">
                <button type="button" className="block w-full text-right" onClick={() => setSelected(asset.plan)}><Preview plan={asset.plan} /></button>
                <div className="px-1 pt-3"><strong className="block text-[.8rem] text-ink">{asset.label}</strong><p className="mt-1 text-[.68rem] leading-relaxed text-soft">{asset.purpose}</p><div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => setSelected(asset.plan)}>فتح</button><button type="button" className={ghost} onClick={() => void exportPlan(asset.plan, 'png')}>PNG</button></div></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {showSaved && savedPlans.length > 0 && (
        <section className={card} aria-labelledby="saved-social-designs-title">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">Saved directions</p><h3 id="saved-social-designs-title" className="mt-1 font-display text-2xl font-bold text-ink">نسخك المختارة</h3></div><button type="button" className={ghost} onClick={() => setShowSaved(false)}>إخفاء</button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {savedPlans.map((plan) => <button key={plan.fingerprint} type="button" onClick={() => setSelected(plan)} className="rounded-[1.3rem] border border-hair bg-canvas p-3 text-right transition hover:border-accent/40 hover:shadow-lg"><Preview plan={plan} /><strong className="mt-3 block text-[.78rem] text-ink">{plan.directionLabel}</strong><span className="mt-1 block text-[.66rem] text-soft">{plan.format.label}</span></button>)}
          </div>
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/70 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="محرر التصميم">
          <div className="max-h-[96vh] w-full max-w-7xl overflow-y-auto rounded-[2rem] border border-white/10 bg-paper p-4 shadow-2xl md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">Selected direction</p><h3 className="mt-1 font-display text-2xl font-bold text-ink">{selected.directionLabel}</h3></div>
              <button type="button" className={ghost} onClick={() => setSelected(null)}>إغلاق</button>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(310px,.75fr)]">
              <div className="grid place-items-center rounded-[1.5rem] border border-hair bg-canvas p-3 md:p-6"><Preview plan={selected} className="w-full max-w-3xl" /></div>
              <div className="grid content-start gap-4">
                <section className="rounded-2xl border border-accent/25 bg-accent/[.045] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold text-accent">الناقد البصري الداخلي</p><p className="mt-1 text-[.78rem] text-soft">قرأه على الهاتف قبل أن يعرضه لك.</p></div><strong className="font-display text-3xl text-accent">{selected.quality?.score || 0}٪</strong></div><div className="mt-3 flex flex-wrap gap-2">{selected.quality?.strengths.map((item) => <span key={item} className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.66rem] text-soft">✓ {item}</span>)}</div>{selected.quality?.issues.length ? <p className="mt-3 text-[.7rem] leading-relaxed text-soft">{selected.quality.issues.join(' · ')}</p> : null}</section>
                <section className="rounded-2xl border border-hair bg-canvas p-4">
                  <p className="text-[.7rem] font-bold text-accent">أقفال التعديل</p>
                  <div className="mt-3 flex flex-wrap gap-2"><LockButton active={locks.content} onClick={() => setLocks((value) => ({ ...value, content: !value.content }))}>النص</LockButton><LockButton active={locks.style} onClick={() => setLocks((value) => ({ ...value, style: !value.style }))}>الأسلوب</LockButton><LockButton active={locks.color} onClick={() => setLocks((value) => ({ ...value, color: !value.color }))}>اللون</LockButton><LockButton active={locks.format} onClick={() => setLocks((value) => ({ ...value, format: !value.format }))}>المقاس</LockButton></div>
                </section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">إخراج جديد</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={ghost} type="button" onClick={() => regenerateSelected('smart')}>اقتراح أذكى</button><button className={ghost} type="button" onClick={() => regenerateSelected('luxury')}>أكثر فخامة</button><button className={ghost} type="button" onClick={() => regenerateSelected('calm')}>أكثر هدوءًا</button><button className={ghost} type="button" onClick={() => regenerateSelected('bold')}>أكثر جرأة</button></div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">تحويل ذكي للمقاس</p><div className="mt-3 flex flex-wrap gap-2">{formatActions.map((action) => <button key={action.id} className={ghost} type="button" onClick={() => transform(action.id)}>{action.label}</button>)}</div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">التصدير</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={primary} type="button" onClick={() => void exportPlan(selected, 'png')}>تنزيل PNG</button><button className={ghost} type="button" onClick={() => void exportPlan(selected, 'jpeg')}>تنزيل JPG</button><button className={ghost} type="button" onClick={() => downloadCompositionSvg(selected)}>تنزيل SVG</button><button className={ghost} type="button" onClick={() => printCompositionPdf(selected)}>طباعة / PDF</button></div></section>
                <div className="grid gap-2 sm:grid-cols-2"><button type="button" className={primary} onClick={() => { teachTaste(selected, 1); const next = savePlan(selected); setSavedPlans(next); setNotice(`حُفظ التصميم وتعلّم الاستوديو ذوقك. لديك الآن ${next.length} نسخة محفوظة.`) }}>هذا ذوقي · احفظه</button><button type="button" className={ghost} onClick={() => { teachTaste(selected, -1); setSelected(null); generate() }}>أبعد هذا الأسلوب</button></div>
                <button type="button" className={ghost} onClick={buildCampaign}>حوّل هذا الاتجاه إلى حملة متكاملة</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
