import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  getRenderPreferences,
  printCompositionPdf,
  downloadSocialCampaignRaster,
  printSocialCampaignPdf,
  renderCompositionSvg,
  infographicVariantOf,
  setRenderPreferences,
  type BackgroundPattern,
} from '../../lib/social-design-renderer'
import { type LayoutFamilyId, type InfographicVariantId, type StudioCommandParse, type PaletteId, type Palette, type PlanContent, type PlanOverlay, type AttentionMap, type DesignExplanation, parseStudioCommand, critiqueCompositionPlan, predictEngagement, computeAttentionMap, explainDesign, PALETTES } from '../../lib/social-design-engine'
import { extractVisualDnaFromFile, type VisualDna } from '../../lib/visual-dna'
import { currentSeason } from '../../lib/seasons'
import { getDb } from '../../lib/firebase'
import { useCmsContent } from '../../lib/content'

const card = 'rounded-[1.75rem] border border-hair bg-paper p-5 shadow-sm md:p-7'
const input = 'w-full rounded-2xl border border-hair bg-canvas px-4 py-3 text-[.88rem] text-ink outline-none transition focus:border-accent'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'
// الاتجاهات الفنية الخمسة للإنفوجرافيك — لاختيارها يدوياً في المحرر.
const INFO_VARIANTS: { id: InfographicVariantId; label: string }[] = [
  { id: 'rail', label: 'السكة' },
  { id: 'ordinal', label: 'الأرقام' },
  { id: 'cards', label: 'البطاقات' },
  { id: 'timeline', label: 'المسار' },
  { id: 'ring', label: 'الحلقة' },
  { id: 'spotlight', label: 'الواجهة' },
]
const HISTORY_KEY = 'dr-ahmad-social-design-history-v1'
const SAVED_KEY = 'dr-ahmad-social-design-saved-v1'
const TASTE_KEY = 'dr-ahmad-social-design-taste-v1'
const TASTE_LEDGER_KEY = 'dr-ahmad-social-design-taste-ledger-v1'
const QUALITY_THRESHOLD_KEY = 'dr-ahmad-social-quality-threshold-v1'
const SEAL_KEY = 'dr-ahmad-social-seal-v1'
const SEASONAL_KEY = 'dr-ahmad-social-seasonal-v1'
const PATTERN_KEY = 'dr-ahmad-social-pattern-v1'
const DNA_FAVES_KEY = 'dr-ahmad-social-dna-faves-v1'
const BG_PATTERNS: { id: BackgroundPattern; label: string }[] = [
  { id: 'none', label: 'بلا نمط' },
  { id: 'dots', label: 'نقطية' },
  { id: 'lines', label: 'خطوط' },
  { id: 'giri', label: 'زخرفة' },
  { id: 'mesh', label: 'تدرّج شبكي' },
]
const CAMPAIGN_SEED_KEY = 'studio-campaign-seed'

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

/* طبقة خريطة الانتباه (النقطة ٨): تُرسم فوق المعاينة بمساحة إحداثيات المقاس
   نفسها (بكسلاته) فتبقى البؤر دائريّةً والأرقام غير مشوّهة مهما اختلفت النسبة.
   طبقةٌ حراريّةٌ دافئةٌ (الأحمر = أعلى جذب) + مسارٌ مرقّمٌ يحاكي تدرّج العين. */
function AttentionOverlay({ map, w, h }: { map: AttentionMap; w: number; h: number }) {
  const unit = Math.min(w, h)
  const warm = (intensity: number) => (intensity >= 0.8 ? '#ff2d2d' : intensity >= 0.55 ? '#ff8a00' : '#ffd000')
  const toArabic = (value: number) => String(value).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
  const gazePoints = map.gaze.map((step) => `${(step.x * w).toFixed(1)},${(step.y * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <filter id="attn-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={unit * 0.02} /></filter>
      </defs>
      <g filter="url(#attn-blur)" opacity="0.7">
        {map.hotspots.map((spot) => <circle key={`halo-${spot.id}`} cx={spot.x * w} cy={spot.y * h} r={spot.radius * unit} fill={warm(spot.intensity)} opacity={0.18 + spot.intensity * 0.3} />)}
        {map.hotspots.map((spot) => <circle key={`core-${spot.id}`} cx={spot.x * w} cy={spot.y * h} r={spot.radius * unit * 0.5} fill={warm(spot.intensity)} opacity={0.26 + spot.intensity * 0.36} />)}
      </g>
      {map.gaze.length > 1 && <polyline points={gazePoints} fill="none" stroke="#0a84ff" strokeWidth={unit * 0.008} strokeDasharray={`${unit * 0.022} ${unit * 0.016}`} strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />}
      {map.gaze.map((step) => (
        <g key={`gaze-${step.order}`}>
          <circle cx={step.x * w} cy={step.y * h} r={unit * 0.03} fill="#0a84ff" stroke="#fff" strokeWidth={unit * 0.006} />
          <text x={step.x * w} y={step.y * h} dy={unit * 0.012} textAnchor="middle" fontSize={unit * 0.036} fontWeight="700" fill="#fff">{toArabic(step.order)}</text>
        </g>
      ))}
    </svg>
  )
}

/* حقل تحرير مباشر (مقترحات الصديق ١٢): يلتزم عند المغادرة أو Enter — فلا يضج
   التراجع بكل ضغطة حرف، ويُعاد فحص الجودة عند كل التزام */
function EditableText({ label, value, onCommit, multiline = false }: { label: string; value: string; onCommit: (next: string) => void; multiline?: boolean }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const commit = () => { if (draft !== value) onCommit(draft) }
  const shared = 'w-full rounded-xl border border-hair bg-paper px-3 py-2 text-[.8rem] text-ink outline-none focus:border-accent'
  return (
    <label className="grid gap-1">
      <span className="text-[.64rem] font-semibold text-soft">{label}</span>
      {multiline
        ? <textarea value={draft} rows={3} onChange={(event) => setDraft(event.target.value)} onBlur={commit} className={`${shared} resize-y leading-relaxed`} />
        : <input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur() }} className={shared} />}
    </label>
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
  const [plans, setPlans] = useState<CompositionPlan[]>([])
  const [selected, setSelected] = useState<CompositionPlan | null>(null)
  /* المحرر المباشر (١٢-١٥): تراجع/إعادة داخل جلسة النافذة + إعادة فحص الجودة حية */
  const [editUndo, setEditUndo] = useState<CompositionPlan[]>([])
  const [editRedo, setEditRedo] = useState<CompositionPlan[]>([])
  const editedPlanIdRef = useRef<string | null>(null)
  const [notice, setNotice] = useState('')
  const [generation, setGeneration] = useState(0)
  const [locks, setLocks] = useState({ content: false, style: false, color: false, format: false })
  const [savedPlans, setSavedPlans] = useState<CompositionPlan[]>(() => loadSavedPlans())
  const [showSaved, setShowSaved] = useState(false)
  const [tasteProfile, setTasteProfile] = useState<DesignTasteProfile>(() => loadTasteProfile())
  const [tasteLedger, setTasteLedger] = useState<TasteSignalLedger>(() => loadTasteLedger())

  /* ذوقك يرافقك: مزامنة ذاكرة الذوق لحسابك — تتبعك من الجوال للمكتب.
     الأحدث توقيتاً يفوز، ولا شيء يعطل الاستوديو إن غابت الشبكة. */
  const tasteSyncedRef = useRef(false)
  useEffect(() => {
    if (tasteSyncedRef.current) return
    tasteSyncedRef.current = true
    void (async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'site_settings', 'design-taste'))
        if (!snapshot.exists()) return
        const remote = snapshot.data() as { profile?: DesignTasteProfile; ledger?: TasteSignalLedger; updatedAt?: number }
        const localStamp = Number(localStorage.getItem('dr-ahmad-taste-updated') || 0)
        if (Number(remote.updatedAt || 0) > localStamp && remote.profile) {
          setTasteProfile(remote.profile)
          if (remote.ledger) setTasteLedger(remote.ledger)
          try {
            localStorage.setItem(TASTE_KEY, JSON.stringify(remote.profile))
            if (remote.ledger) localStorage.setItem(TASTE_LEDGER_KEY, JSON.stringify(remote.ledger))
            localStorage.setItem('dr-ahmad-taste-updated', String(remote.updatedAt))
          } catch { /* noop */ }
        }
      } catch { /* المزامنة رفاهية — المحلي يعمل دوماً */ }
    })()
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const db = await getDb()
          if (!db) return
          const { doc, setDoc } = await import('firebase/firestore')
          const stamp = Date.now()
          await setDoc(doc(db, 'site_settings', 'design-taste'), { profile: tasteProfile, ledger: tasteLedger, updatedAt: stamp }, { merge: true })
          try { localStorage.setItem('dr-ahmad-taste-updated', String(stamp)) } catch { /* noop */ }
        } catch { /* noop */ }
      })()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [tasteProfile, tasteLedger])
  const [campaign, setCampaign] = useState<SocialCampaign | null>(null)
  const [campaignBusy, setCampaignBusy] = useState(false)
  const [qualityThreshold, setQualityThreshold] = useState(() => Number(localStorage.getItem(QUALITY_THRESHOLD_KEY) || 82))
  /* البصمة البصرية: لوحةٌ مستخرجةٌ من صورةٍ محلية تكسو كل الاتجاهات الحالية
     والقادمة حتى تُزال — بلا خدمةٍ خارجية ولا رفعٍ لأي خادم. */
  const [dna, setDna] = useState<VisualDna | null>(null)
  const [dnaBusy, setDnaBusy] = useState(false)
  const textRef = useRef<HTMLTextAreaElement | null>(null)

  /* ختم الهوية ولمسة الموسم: تفضيلان يسريان على المعاينة والتصدير معاً،
     ويبقيان محفوظين في هذا المتصفح. */
  const [sealOn, setSealOn] = useState(() => { try { return localStorage.getItem(SEAL_KEY) === '1' } catch { return false } })
  const [seasonalOn, setSeasonalOn] = useState(() => { try { return localStorage.getItem(SEASONAL_KEY) !== '0' } catch { return true } })
  const [bgPattern, setBgPattern] = useState<BackgroundPattern>(() => { try { return (localStorage.getItem(PATTERN_KEY) as BackgroundPattern) || 'none' } catch { return 'none' } })
  const [dnaFaves, setDnaFaves] = useState<VisualDna[]>(() => { try { return JSON.parse(localStorage.getItem(DNA_FAVES_KEY) || '[]') } catch { return [] } })
  const [phoneView, setPhoneView] = useState(false)
  const [attentionOn, setAttentionOn] = useState(false)
  const activeSeason = useMemo(() => currentSeason(), [])
  // مختبر الأداء: تنبّؤ التفاعل للتصميم المختار — يُحسب محلياً عند كل تغيير.
  const forecast = useMemo(() => (selected ? predictEngagement(selected) : null), [selected])
  // خريطة الانتباه (٨) وشرح التعثّر (٢٢): محاكاةٌ وتشخيصٌ محليّان للتصميم المختار.
  const attention = useMemo<AttentionMap | null>(() => (selected && attentionOn ? computeAttentionMap(selected) : null), [selected, attentionOn])
  const explanation = useMemo<DesignExplanation | null>(() => (selected ? explainDesign(selected) : null), [selected])
  // أثناء الرسم لا بعده: المعاينات تقرأ التفضيل في نفس الدورة التي تغيّر فيها
  useMemo(() => setRenderPreferences({ seal: sealOn, seasonal: seasonalOn && Boolean(activeSeason), pattern: bgPattern }), [sealOn, seasonalOn, activeSeason, bgPattern])
  useEffect(() => {
    try {
      localStorage.setItem(SEAL_KEY, sealOn ? '1' : '0')
      localStorage.setItem(SEASONAL_KEY, seasonalOn ? '1' : '0')
      localStorage.setItem(PATTERN_KEY, bgPattern)
    } catch { /* noop */ }
  }, [sealOn, seasonalOn, bgPattern])
  const saveDnaFave = () => {
    if (!dna) return
    setDnaFaves((list) => {
      const next = [dna, ...list.filter((fav) => fav.palette.accent !== dna.palette.accent)].slice(0, 8)
      try { localStorage.setItem(DNA_FAVES_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
    setNotice('حُفظت البصمة في المفضّلة — طبّقها بنقرةٍ متى شئت.')
  }

  useEffect(() => { if (initialText && !text.trim()) setText(initialText) }, [initialText])
  useEffect(() => { if (initialContext && !context.trim()) setContext(initialContext) }, [initialContext])

  // «يفهم من أول كلمة»: توليد تلقائي مؤجل أثناء الكتابة، مرة واحدة لكل نص —
  // الزر يبقى لإعادة التوليد بدفعة مختلفة على النص نفسه.
  const autoGenerateKeyRef = useRef('')
  const generateRef = useRef<() => void>(() => {})
  useEffect(() => {
    const clean = text.trim()
    /* كلمة واحدة تكفي لبدء التوليد (مقترح الصديق ١) — حرفان فأكثر */
    if (clean.length < 2) return
    const key = `${clean}::${context.trim()}`
    if (autoGenerateKeyRef.current === key) return
    const timer = window.setTimeout(() => {
      autoGenerateKeyRef.current = key
      generateRef.current()
    }, 850)
    return () => window.clearTimeout(timer)
  }, [text, context])

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

  const hasInput = text.trim().length >= 2
  const analysis = useMemo(() => analyzeSocialContent(hasInput ? text : 'فكرة معرفية جديدة', context, { author: 'د. أحمد حسين الفيلكاوي' }), [context, hasInput, text])
  /* لوحة «ما فهمه الاستوديو» (مقترح الصديق ٧) */
  const [commandParse, setCommandParse] = useState<StudioCommandParse | null>(null)
  const [speechEdit, setSpeechEdit] = useState('')

  const generate = (overrides: { tone?: ContentTone | 'auto'; density?: DesignDensity | 'auto'; platform?: SocialPlatform | 'auto'; count?: number; preferLayout?: LayoutFamilyId } = {}) => {
    if (text.trim().length < 2) {
      setNotice('اكتب كلمة أو فكرة أولًا؛ المحرك لا يصنع تصميمًا فارغًا.')
      textRef.current?.focus()
      return
    }
    /* المحلل الخليجي المحلي (مقترحات ١-٦): يفصل الأمر عن المحتوى ويستخرج
       النوع والنبرة والمقاس والقيود — ويعمل دوماً بلا سحابة */
    const parsed = parseStudioCommand(text)
    setCommandParse(parsed.understood.length ? parsed : null)
    if (overrides.platform && overrides.platform !== platform) setPlatform(overrides.platform)
    const nextGeneration = generation + 1
    const result = generateSocialDesigns({
      text: parsed.content,
      context: [context, parsed.contextHint].filter(Boolean).join(' · '),
      author: 'د. أحمد حسين الفيلكاوي',
      tone: overrides.tone ?? (parsed.tone || tone),
      density: overrides.density ?? (parsed.noBody ? 'minimal' : density),
      platform: overrides.platform ?? (parsed.platform || platform),
      ...(parsed.format ? { format: parsed.format } : {}),
      count: 8,
      seed: `${text}:${context}:${nextGeneration}:${Date.now()}`,
      history: loadHistory(),
      noveltyThreshold: .36,
      tasteProfile,
      ...((overrides.preferLayout || parsed.preferLayout) ? { preferLayout: overrides.preferLayout || parsed.preferLayout } : {}),
    })
    setGeneration(nextGeneration)
    localStorage.setItem('dr-ahmad-social-design-generated-count', String(Number(localStorage.getItem('dr-ahmad-social-design-generated-count') || 0) + result.generation.requestedCount))
    // البصمة البصرية القائمة تكسو الدفعة الجديدة أيضاً، ويعيد الناقد حكمه عليها.
    const finalPlans = dna
      ? result.plans.map((plan) => { const skinned = { ...plan, paletteOverride: dna.palette }; return { ...skinned, quality: critiqueCompositionPlan(skinned, result.plans) } })
      : result.plans
    setPlans(finalPlans)
    setSelected(null)
    remember(finalPlans)
    setNotice(result.generation.warnings[0] || `فحص الناقد ثمانية اتجاهات داخلية وعرض أقوى ${result.plans.length} فقط.`)
  }
  generateRef.current = () => generate()

  /* ═══ رنين القراء: الجمل التي ظللها جمهورك الحقيقي — بضغطة تصير تصميماً ═══ */
  const { articles: cmsArticles } = useCmsContent()
  const [resonance, setResonance] = useState<{ quote: string; title: string; count: number }[] | null>(null)
  const [resonanceBusy, setResonanceBusy] = useState(false)
  const loadResonance = async () => {
    if (resonance) { setResonance(null); return }
    setResonanceBusy(true)
    try {
      const db = await getDb()
      if (!db) { setNotice('Firebase غير متاح الآن.'); return }
      const { collection, getDocs } = await import('firebase/firestore')
      const snapshot = await getDocs(collection(db, 'article_highlights'))
      const rows = snapshot.docs
        .map((item) => item.data() as { slug?: string; paragraph?: number; startOffset?: number; endOffset?: number; count?: number })
        .filter((item) => item.slug && Number(item.count || 0) >= 1)
        .sort((left, right) => Number(right.count || 0) - Number(left.count || 0))
        .slice(0, 24)
      const resolved: { quote: string; title: string; count: number }[] = []
      for (const row of rows) {
        const article = cmsArticles.find((candidate) => candidate.slug === row.slug)
        if (!article?.body) continue
        const paragraph = article.body.split('\n\n')[Number(row.paragraph || 0)] || ''
        const quote = paragraph.slice(Number(row.startOffset || 0), Number(row.endOffset || 0)).replace(/\s+/g, ' ').trim()
        if (quote.length < 15 || quote.length > 220) continue
        if (resolved.some((item) => item.quote === quote)) continue
        resolved.push({ quote, title: article.title, count: Number(row.count || 0) })
        if (resolved.length >= 6) break
      }
      setResonance(resolved)
      if (!resolved.length) setNotice('لا تظليلات قابلة للتحويل بعد — ستظهر هنا كلما ظلل قراؤك جملاً.')
    } catch { setNotice('تعذر جلب تظليلات القراء الآن.') }
    finally { setResonanceBusy(false) }
  }
  const designFromResonance = (item: { quote: string; title: string }) => {
    setText(item.quote)
    setContext(`اقتباس انتخبه القراء بتظليلهم من مقال «${item.title}»`)
    setResonance(null)
    setNotice('جملة قرائك في الاستوديو — التوليد يبدأ حالاً.')
  }

  /* ═══ المحرر المباشر (١٢-١٥): كل التزامٍ يعيد فحص الجودة فوراً ═══ */
  const syncPlanEverywhere = (plan: CompositionPlan) => {
    setSelected(plan)
    setPlans((list) => list.map((item) => (item.id === plan.id ? plan : item)))
  }
  const editPlan = (mutate: (plan: CompositionPlan) => CompositionPlan) => {
    if (!selected) return
    if (editedPlanIdRef.current !== selected.id) { setEditUndo([]); setEditRedo([]); editedPlanIdRef.current = selected.id }
    const next = mutate(selected)
    const requalified = { ...next, quality: critiqueCompositionPlan(next, plans.filter((plan) => plan.id !== next.id)) }
    setEditUndo((stack) => [...stack.slice(-19), selected])
    setEditRedo([])
    syncPlanEverywhere(requalified)
  }
  const editContent = (patch: Partial<PlanContent>) => editPlan((plan) => ({ ...plan, content: { ...plan.content, ...patch } }))
  // اختيار لوحة هوية بنقرة يرفع البصمة البصرية عن هذا التصميم (لا يتزاحمان).
  const editPalette = (palette: PaletteId) => editPlan((plan) => ({ ...plan, palette, paletteOverride: undefined }))

  /* ═══ البصمة البصرية: استخراج لوحةٍ من صورةٍ ثم كسوةُ كل الاتجاهات بها ═══ */
  const applyDnaOverride = (palette: Palette | null) => {
    setPlans((list) => list.map((plan) => { const skinned = { ...plan, paletteOverride: palette ?? undefined }; return { ...skinned, quality: critiqueCompositionPlan(skinned, list.filter((peer) => peer.id !== plan.id)) } }))
    setSelected((current) => { if (!current) return current; const skinned = { ...current, paletteOverride: palette ?? undefined }; return { ...skinned, quality: critiqueCompositionPlan(skinned) } })
  }
  const runVisualDna = async (file: File) => {
    setDnaBusy(true)
    try {
      const result = await extractVisualDnaFromFile(file)
      if (!result) { setNotice('تعذّرت قراءة الصورة — جرّب صورة أخرى (PNG أو JPG).'); return }
      setDna(result)
      applyDnaOverride(result.palette)
      setNotice('استُخرجت البصمة البصرية وكست كل الاتجاهات — والناقد أعاد حكمه. أزلها متى شئت.')
    } catch { setNotice('تعذّر استخراج البصمة البصرية الآن.') }
    finally { setDnaBusy(false) }
  }
  const clearVisualDna = () => { setDna(null); applyDnaOverride(null); setNotice('أُزيلت البصمة البصرية وعادت اللوحات المختارة.') }
  const undoEdit = () => {
    if (!selected || !editUndo.length) return
    const previous = editUndo[editUndo.length - 1]
    setEditUndo((stack) => stack.slice(0, -1))
    setEditRedo((stack) => [...stack, selected])
    syncPlanEverywhere(previous)
  }
  const redoEdit = () => {
    if (!selected || !editRedo.length) return
    const next = editRedo[editRedo.length - 1]
    setEditRedo((stack) => stack.slice(0, -1))
    setEditUndo((stack) => [...stack, selected])
    syncPlanEverywhere(next)
  }

  /* ═══ الطبقات الحرة (أمر الدكتور: محرر بالسحب): إضافة وسحب وتحجيم فوق التصميم ═══ */
  const [freeMode, setFreeMode] = useState(false)
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origin: PlanOverlay } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const addOverlay = (kind: PlanOverlay['kind']) => {
    if (!selected) return
    const overlay: PlanOverlay = {
      id: `ov-${Date.now().toString(36)}`,
      kind,
      x: kind === 'rule' ? .2 : .3,
      y: .42,
      width: kind === 'circle' ? .18 : kind === 'rule' ? .6 : .4,
      height: kind === 'circle' ? .18 : kind === 'rule' ? .004 : kind === 'rect' ? .2 : .1,
      text: kind === 'text' ? 'نص جديد — حرّرني' : undefined,
      size: kind === 'text' ? .034 : undefined,
      color: kind === 'text' ? 'ink' : 'accent',
      opacity: kind === 'text' ? 1 : .55,
      align: 'end',
    }
    editPlan((plan) => ({ ...plan, overlays: [...(plan.overlays || []), overlay] }))
    setActiveOverlay(overlay.id)
    setFreeMode(true)
  }
  const patchOverlay = (id: string, patch: Partial<PlanOverlay>) =>
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const removeOverlay = (id: string) => {
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).filter((item) => item.id !== id) }))
    setActiveOverlay(null)
  }
  /* مشاهد الانبهار الجاهزة: توقيعات فنية بضغطة — بألوان اللوحة نفسها */
  const addFlourish = (preset: 'gilded-arcs' | 'orbit' | 'horizon') => {
    if (!selected) return
    const stamp = Date.now().toString(36)
    const flourishes: PlanOverlay[] = preset === 'gilded-arcs' ? [
      { id: `fl-${stamp}-a`, kind: 'circle', x: .62, y: -.18, width: .55, height: .55, color: 'accent', opacity: .16 },
      { id: `fl-${stamp}-b`, kind: 'circle', x: .68, y: -.12, width: .42, height: .42, color: 'accent', opacity: .26 },
      { id: `fl-${stamp}-c`, kind: 'rule', x: .08, y: .88, width: .3, height: .004, color: 'accent', opacity: .6 },
    ] : preset === 'orbit' ? [
      { id: `fl-${stamp}-a`, kind: 'circle', x: -.1, y: .55, width: .5, height: .5, color: 'muted', opacity: .2 },
      { id: `fl-${stamp}-b`, kind: 'circle', x: .02, y: .67, width: .26, height: .26, color: 'accent', opacity: .3 },
    ] : [
      { id: `fl-${stamp}-a`, kind: 'rule', x: .08, y: .78, width: .84, height: .003, color: 'muted', opacity: .5 },
      { id: `fl-${stamp}-b`, kind: 'rule', x: .08, y: .8, width: .5, height: .005, color: 'accent', opacity: .7 },
    ]
    editPlan((plan) => ({ ...plan, overlays: [...(plan.overlays || []), ...flourishes] }))
    setFreeMode(true)
  }
  const beginDrag = (event: React.PointerEvent, overlay: PlanOverlay, mode: 'move' | 'resize') => {
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = { id: overlay.id, mode, startX: event.clientX, startY: event.clientY, origin: { ...overlay } }
    setActiveOverlay(overlay.id)
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current
      const canvas = canvasRef.current
      if (!drag || !canvas) return
      const bounds = canvas.getBoundingClientRect()
      const deltaX = (move.clientX - drag.startX) / bounds.width
      const deltaY = (move.clientY - drag.startY) / bounds.height
      const clampRatio = (value: number, minimum = -0.4, maximum = 1.2) => Math.max(minimum, Math.min(maximum, value))
      /* معاينة حية بلا تراجع لكل حركة: نلتزم مرة واحدة عند الإفلات */
      setSelected((current) => {
        if (!current) return current
        return {
          ...current,
          overlays: (current.overlays || []).map((item) => item.id !== drag.id ? item : drag.mode === 'move'
            ? { ...item, x: clampRatio(drag.origin.x + deltaX), y: clampRatio(drag.origin.y + deltaY) }
            : { ...item, width: clampRatio(drag.origin.width + deltaX, .02, 1.4), height: clampRatio(drag.origin.height + deltaY, .003, 1.2) }),
        }
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const drag = dragRef.current
      dragRef.current = null
      if (!drag) return
      setSelected((current) => {
        if (!current) return current
        const moved = (current.overlays || []).find((item) => item.id === drag.id)
        if (!moved) return current
        /* الالتزام النهائي عبر editPlan لتسجيل التراجع وإعادة فحص الجودة */
        setTimeout(() => patchOverlay(drag.id, moved), 0)
        return current
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /* التعديل بالكلام (مقترح ١١): «خله أفخم وداكن» · «حوّله ستوري» · «بدون متن» */
  const applySpeechEdit = () => {
    const command = speechEdit.trim()
    if (!command) return
    const parsed = parseStudioCommand(command)
    if (!parsed.tone && !parsed.format && !parsed.noBody && !parsed.preferLayout && !parsed.platform) {
      setNotice('ما فهمت الأمر — جرّب: «خله أفخم» أو «حوّله ستوري» أو «بدون متن».')
      return
    }
    if (parsed.format && selected) {
      transform(parsed.format)
      if (!parsed.tone && !parsed.noBody) { setSpeechEdit(''); return }
    }
    generate({
      ...(parsed.tone ? { tone: parsed.tone } : {}),
      ...(parsed.noBody ? { density: 'minimal' as DesignDensity } : {}),
      ...(parsed.platform && !selected ? { platform: parsed.platform } : {}),
      ...(parsed.preferLayout ? { preferLayout: parsed.preferLayout } : {}),
    })
    setSpeechEdit('')
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
      count: 8,
      seed: `${profile}:${Date.now()}:${selected.fingerprint}`,
      locks,
      history: loadHistory(),
      noveltyThreshold: .38,
      tasteProfile,
    })
    const regenerated = dna
      ? result.plans.map((plan) => { const skinned = { ...plan, paletteOverride: dna.palette }; return { ...skinned, quality: critiqueCompositionPlan(skinned, result.plans) } })
      : result.plans
    setPlans(regenerated)
    setSelected(regenerated[0] || selected)
    remember(regenerated)
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
      count: 8,
      seed: `carousel:${text}:${context}:${nextGeneration}:${Date.now()}`,
      history: loadHistory(),
      noveltyThreshold: .38,
      tasteProfile,
    })
    const carouselDrafts = result.plans.map((plan, index) => {
      const transformed = transformDesignFormat(plan, 'instagram-carousel', {
        respectFormatLock: false,
        seed: `${plan.fingerprint}:carousel:${index}`,
      })
      return dna ? { ...transformed, paletteOverride: dna.palette } : transformed
    })
    const carouselPlans = carouselDrafts.map((plan) => ({
      ...plan,
      quality: critiqueCompositionPlan(plan, carouselDrafts.filter((peer) => peer.id !== plan.id)),
    }))
    setPlatform('instagram')
    setGeneration(nextGeneration)
    setPlans(carouselPlans)
    setSelected(null)
    remember(carouselPlans)
    setNotice('فُحصت ثمانية اتجاهات كاروسيل، وعُرضت أقوى أربعة بتوزيع حقيقي على الشرائح.')
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
    const score = plan.quality?.score || 0
    if (score < qualityThreshold || (plan.quality?.lineFit || 0) < 78 || plan.quality?.issues.some((issue) => issue.startsWith('خطأ:'))) {
      setNotice(`منع محرك الجودة التصدير: النتيجة ${score}٪ والحد ${qualityThreshold}٪. اختر اتجاهًا أقوى أو أعد توليده.`)
      return
    }
    teachTaste(plan, 1)
    await downloadCompositionRaster(plan, type)
  }

  /* تصدير كل المقاسات بنقرة: الأصل ثم مربع وستوري وLinkedIn — كل نسخة
     تُعاد هندستها لمقاسها (لا تمديد صورة)، وتنزل ملفاً ملفاً. */
  const exportAllSizes = async (plan: CompositionPlan) => {
    const targets: SocialFormatId[] = ['instagram-square', 'story', 'linkedin-landscape']
    setNotice('أصدّر الطقم الكامل: الأصل + مربع + ستوري + LinkedIn…')
    teachTaste(plan, 1)
    await downloadCompositionRaster(plan, 'png')
    for (const target of targets) {
      if (target === plan.format.id) continue
      const variant = transformDesignFormat(plan, target, { respectFormatLock: false, seed: `${plan.fingerprint}:batch:${target}` })
      await downloadCompositionRaster(variant, 'png')
    }
    setNotice('نزل الطقم الكامل — نسخة مهيأة لكل منصة بهندستها الخاصة.')
  }

  const runCampaign = (campaignText: string, campaignContext: string, basePlan?: CompositionPlan) => {
    setCampaignBusy(true)
    try {
      let next = generateSocialCampaign({
        text: campaignText,
        context: campaignContext,
        author: 'د. أحمد حسين الفيلكاوي',
        tone,
        density,
        seed: `campaign:${campaignText}:${Date.now()}`,
        history: loadHistory(),
        tasteProfile,
        basePlan,
        noveltyThreshold: .36,
      })
      if (dna) {
        const drafts = next.assets.map((asset) => ({ ...asset.plan, paletteOverride: dna.palette }))
        const assets = next.assets.map((asset, index) => {
          const plan = drafts[index]
          return {
            ...asset,
            plan: { ...plan, quality: critiqueCompositionPlan(plan, drafts.filter((peer) => peer.id !== plan.id)) },
          }
        })
        const qualityScore = Math.round(assets.reduce((sum, asset) => sum + (asset.plan.quality?.score || 0), 0) / Math.max(1, assets.length))
        const dnaWarning = assets.some((asset) => asset.plan.quality?.issues.some((issue) => issue.startsWith('خطأ:')))
          ? 'البصمة البصرية سببت مشكلة أمان في قطعة واحدة على الأقل؛ أعد التوليد أو أزل البصمة.'
          : qualityScore < 75
            ? 'تحتاج الحملة مراجعة إضافية بعد تطبيق البصمة البصرية.'
            : ''
        next = {
          ...next,
          assets,
          qualityScore,
          ready: next.ready && !dnaWarning,
          warnings: dnaWarning ? [...next.warnings, dnaWarning] : next.warnings,
        }
      }
      setCampaign(next)
      localStorage.setItem('dr-ahmad-social-campaign-count', String(Number(localStorage.getItem('dr-ahmad-social-campaign-count') || 0) + 1))
      remember(next.assets.map((asset) => asset.plan))
      setSelected(null)
      setNotice(next.ready
        ? `اكتملت حملة من ${next.assets.length} قطع متناسقة وغير مكررة واجتازت لجنة الجودة: ${next.qualityScore}٪.`
        : next.warnings[0] || 'الحملة تحتاج إعادة توليد قبل التصدير.')
    } finally { setCampaignBusy(false) }
  }
  const runCampaignRef = useRef(runCampaign)
  runCampaignRef.current = runCampaign

  const buildCampaign = () => {
    if (!selected && !plans[0]) {
      setNotice('ولّد اتجاهًا أولًا، ثم حوّله إلى حملة متكاملة.')
      return
    }
    runCampaign(text, context, selected || plans[0])
  }

  /* «حملة من مقال بنقرة»: بذرة قادمة من مكتبة المقالات — نملأ الحقول ونبني
     الحملة فوراً من دون أي نقرة إضافية. */
  useEffect(() => {
    let raw = ''
    try {
      raw = localStorage.getItem(CAMPAIGN_SEED_KEY) || ''
      if (raw) localStorage.removeItem(CAMPAIGN_SEED_KEY)
    } catch { /* noop */ }
    if (!raw) return
    try {
      const seed = JSON.parse(raw) as { text?: string; context?: string }
      const seedText = String(seed?.text || '').trim()
      if (!seedText) return
      const seedContext = String(seed?.context || '').trim()
      setText(seedText)
      setContext(seedContext)
      autoGenerateKeyRef.current = `${seedText}::${seedContext}`
      setNotice('وصل المقال من المكتبة — أبني له حملة متكاملة الآن…')
      window.setTimeout(() => { runCampaignRef.current(seedText, seedContext) }, 80)
    } catch { /* بذرة تالفة: نتجاهلها بصمت */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* البصمة البصرية القادمة من مختبر الصور: نلتقطها عند الفتح فتلبسها كل دفعة تُولَّد. */
  useEffect(() => {
    let raw = ''
    try { raw = localStorage.getItem('studio-dna-palette') || ''; if (raw) localStorage.removeItem('studio-dna-palette') } catch { /* noop */ }
    if (!raw) return
    try {
      const seed = JSON.parse(raw) as VisualDna
      if (seed?.palette?.background) { setDna(seed); applyDnaOverride(seed.palette); setNotice('وصلت البصمة البصرية من مختبر الصور — كل تصميمٍ ستولّده سيلبس ألوان صورتك.') }
    } catch { /* بصمة تالفة: نتجاهلها */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid gap-5">
      <section className={`${card} overflow-hidden`}>
        <div className="relative">
          <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <p className="relative text-[.72rem] font-bold uppercase tracking-[.18em] text-accent">Design Intelligence · Local</p>
          <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">استوديو التصميم الذكي</h2>
              <p className="mt-3 max-w-3xl text-[.88rem] leading-loose text-soft">اكتب الفكرة فقط — يبدأ التوليد وحده وأنت تكتب. المحرك يبني ثمانية اتجاهات فنية في الخلفية، يمررها على الناقد البصري، ثم يعرض لك أقوى أربعة فقط — بلا API أو صور جاهزة.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-accent/25 bg-accent/[.06] px-4 py-2 text-[.72rem] font-semibold text-accent">لا تكلفة تشغيلية · عربي أولًا</span>
              <button type="button" title="الجمل التي ظللها قراؤك بأيديهم — جمهورك ينتخب اقتباساتك" onClick={() => void loadResonance()} className={`rounded-full px-4 py-2 text-[.72rem] font-semibold transition ${resonance ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{resonanceBusy ? 'يجلب الرنين…' : '♥ جمل قرائي الرنانة'}</button>
              <button type="button" title="شعارك المخطوط كختم صغير على قرص ورقي — يظهر في المعاينة والتصدير" onClick={() => setSealOn((value) => !value)} className={`rounded-full px-4 py-2 text-[.72rem] font-semibold transition ${sealOn ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{sealOn ? '✓ ' : ''}ختم الهوية</button>
              {activeSeason && <button type="button" title={`رسمة خطية هادئة بمناسبة ${activeSeason.label}`} onClick={() => setSeasonalOn((value) => !value)} className={`rounded-full px-4 py-2 text-[.72rem] font-semibold transition ${seasonalOn ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{seasonalOn ? '✓ ' : ''}لمسة {activeSeason.label}</button>}
              {/* أنماط الخلفية الراقية (أمر الدكتور): خفيفةٌ جداً وقابلةٌ للإطفاء */}
              <span className="inline-flex items-center gap-0.5 rounded-full border border-hair bg-canvas px-2 py-1" title="نمط خلفيةٍ راقٍ خفيف — يظهر في المعاينة والتصدير">
                <span className="px-1 text-[.68rem] text-soft">خلفية:</span>
                {BG_PATTERNS.map((pat) => (
                  <button key={pat.id} type="button" onClick={() => setBgPattern(pat.id)} className={`rounded-full px-2 py-0.5 text-[.66rem] font-semibold transition ${bgPattern === pat.id ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>{pat.label}</button>
                ))}
              </span>
            </div>
          </div>
        </div>

        {resonance && resonance.length > 0 && (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/[.04] p-4">
            <p className="text-[.7rem] font-bold text-accent">جمهورك انتخب هذه الجمل بتظليله — اضغط واحدة لتصير تصميماً:</p>
            <div className="mt-2.5 grid gap-2">
              {resonance.map((item) => (
                <button key={item.quote} type="button" onClick={() => designFromResonance(item)} className="rounded-xl border border-hair bg-canvas px-4 py-2.5 text-right text-[.8rem] leading-relaxed text-ink transition-colors hover:border-accent">
                  «{item.quote}»
                  <span className="mt-1 block text-[.66rem] text-soft">{item.title} · {item.count} {item.count === 1 ? 'تظليل' : 'تظليلاً'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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
            <button
              key={suggestion.id}
              type="button"
              className={ghost}
              title={suggestion.reason}
              onClick={() => {
                // كل رقاقة تنفذ وعدها حرفياً — لا توليد عام يتنكر بلافتة ذكية
                if (suggestion.id === 'shorten') shorten()
                else if (suggestion.id === 'carousel') makeCarousel()
                else if (suggestion.id === 'quiet-version') generate({ tone: 'calm' })
                else if (suggestion.id === 'hero-word') generate({ preferLayout: 'hero-word' })
                else if (suggestion.id === 'poster') generate({ preferLayout: 'hero-word', tone: 'bold' })
                else if (suggestion.id === 'story') generate({ platform: 'story' })
                else if (suggestion.id === 'linkedin') generate({ platform: 'linkedin' })
                else generate()
              }}
            >{suggestion.label}</button>
          ))}
        </div>}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1fr_1fr_1fr_.8fr_auto]">
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">النبرة<select className={input} value={tone} onChange={(event) => setTone(event.target.value as ContentTone | 'auto')}>{Object.entries(toneLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">المنصة<select className={input} value={platform} onChange={(event) => setPlatform(event.target.value as SocialPlatform | 'auto')}>{Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="grid gap-2 text-[.72rem] font-semibold text-soft">الكثافة<select className={input} value={density} onChange={(event) => setDensity(event.target.value as DesignDensity | 'auto')}>{Object.entries(densityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="grid content-end gap-2 rounded-2xl border border-hair bg-canvas px-4 py-3"><span className="text-[.68rem] font-semibold text-soft">لجنة الجودة</span><strong className="text-[.82rem] text-ink">8 محاولات ← أقوى 4</strong></div>
          <div className="flex items-end"><button type="button" className={`${primary} w-full px-8`} onClick={() => generate()}>ولّد أقوى أربعة</button></div>
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
            {/* لوحة الفهم (مقترح الصديق ٧): ما فهمه الاستوديو من أمرك، بثقة وافتراضات صريحة */}
            {commandParse && (
              <div className="mb-3 rounded-2xl border border-accent/20 bg-accent/[.04] px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[.72rem]">
                  <span className="font-bold text-accent">فهمتُ:</span>
                  {commandParse.understood.map((item) => (
                    <span key={`${item.label}-${item.value}`} className="text-soft"><span className="font-semibold text-ink">{item.label}:</span> {item.value}</span>
                  ))}
                  <span className="ms-auto rounded-full border border-accent/25 px-2.5 py-0.5 text-[.64rem] font-bold text-accent">ثقة {Math.round(commandParse.confidence * 100)}٪</span>
                </div>
                {commandParse.assumptions.length > 0 && (
                  <p className="mt-1.5 text-[.66rem] font-light leading-relaxed text-soft">افتراضات: {commandParse.assumptions.join(' · ')}</p>
                )}
              </div>
            )}
            {/* التعديل بالكلام (مقترح ١١): أمرٌ خليجي قصير يعيد تشكيل النتائج */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={speechEdit}
                onChange={(event) => setSpeechEdit(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') applySpeechEdit() }}
                placeholder="عدّل بالكلام: خله أفخم · حوّله ستوري · بدون متن…"
                aria-label="تعديل التصميم بالكلام"
                className="min-w-[16rem] flex-1 rounded-full border border-hair bg-canvas px-4 py-2 text-[.78rem] text-ink outline-none placeholder:text-soft/60 focus:border-accent"
              />
              <button type="button" className={ghost} onClick={applySpeechEdit}>طبّق</button>
            </div>
            <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-full border border-hair bg-canvas px-3 py-2 text-[.7rem] text-soft">حد التصدير <input aria-label="حد جودة التصدير" className="w-14 bg-transparent text-center font-bold text-accent outline-none" type="number" min="70" max="98" value={qualityThreshold} onChange={(event) => { const next=Math.max(70,Math.min(98,Number(event.target.value)||82)); setQualityThreshold(next); localStorage.setItem(QUALITY_THRESHOLD_KEY,String(next)) }} />٪</label><span className="rounded-full border border-accent/25 bg-accent/[.05] px-4 py-2 text-[.72rem] font-semibold text-accent">لجنة الجودة {Math.round(plans.reduce((sum, plan) => sum + (plan.quality?.score || 0), 0) / plans.length)}٪</span><span className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft">ذاكرة ذوقك {Object.keys(tasteLedger).length} اتجاه</span>{Object.keys(tasteLedger).length > 0 && <button type="button" className={ghost} onClick={resetTaste}>إعادة ضبط الذوق</button>}<button type="button" className={primary} disabled={campaignBusy} onClick={buildCampaign}>{campaignBusy ? 'يبني الحملة…' : 'حوّلها إلى حملة'}</button><button type="button" className={ghost} onClick={() => setShowSaved((value) => !value)}>المحفوظة {savedPlans.length}</button><button type="button" className={ghost} onClick={() => generate()}>توليد دفعة مختلفة</button></div>
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
          <div className="mt-5 overflow-x-auto pb-2"><ol className="flex min-w-max items-center gap-2" aria-label="الخط الزمني المقترح للحملة">{campaign.assets.map((asset, index) => <li key={`timeline-${asset.id}`} className="flex items-center gap-2"><div className="rounded-2xl border border-hair bg-canvas px-4 py-3"><span className="block text-[.62rem] font-bold text-accent">اليوم {index + 1}</span><strong className="mt-1 block text-[.74rem] text-ink">{asset.label}</strong><span className="mt-1 block max-w-[160px] text-[.62rem] leading-relaxed text-soft">{asset.purpose}</span></div>{index < campaign.assets.length - 1 && <span aria-hidden className="text-soft/50">←</span>}</li>)}</ol></div>
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
          {/* المحرر سطحٌ فاتحٌ ثابت مهما كان وضع الموقع (فاتح/داكن): كان الوضع
             الداكن يقلب النصوص إلى أزرق/رمادي باهت فلا يُقرأ («ما أدري شنو مكتوب»).
             نُثبّت متغيّرات اللون على قيم الوضع الفاتح داخل المحرر فقط. */}
          <div
            className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-black/10 shadow-2xl"
            style={{
              '--c-canvas': '252 252 250',
              '--c-ink': '21 22 26',
              '--c-soft': '94 101 112',
              '--c-accent': '62 92 120',
              '--c-accent-deep': '51 80 107',
              '--c-wash': '244 245 243',
              '--c-hair': 'rgba(21, 22, 26, 0.09)',
              colorScheme: 'light',
              background: '#FCFCFA',
            } as CSSProperties}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-4 md:px-6">
              <div><p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">التصميم المختار</p><h3 className="mt-1 font-display text-2xl font-bold text-ink">{selected.directionLabel}</h3></div>
              <button type="button" className={ghost} onClick={() => setSelected(null)}>إغلاق</button>
            </div>
            {/* المعاينة تثبت يميناً والأدوات وحدها تنساب يساراً (أمر الدكتور:
               «خلّ مكان المعاينة ثابتاً والأدوات متحركة») */}
            <div className="grid min-h-0 flex-1 gap-5 p-4 md:p-6 lg:grid-cols-[minmax(0,1.32fr)_minmax(320px,.7fr)]">
              <div className="grid content-start justify-items-center rounded-[1.5rem] border border-hair bg-canvas p-3 md:p-6 min-h-0 lg:max-h-full lg:overflow-y-auto">
                {/* «أرني كما يراه المتابع» (النقطة ٢٠) + «خريطة الانتباه» (النقطة ٨) */}
                <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2">
                  <span className="text-[.66rem] font-semibold text-soft">{phoneView ? 'كما يراه المتابع على هاتفه' : 'المعاينة'}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setAttentionOn((value) => !value)} disabled={phoneView} title="محاكاةٌ تقديريّةٌ لأين تقع العين أوّلاً" className={`rounded-full px-3 py-1 text-[.66rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${attentionOn && !phoneView ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>{attentionOn ? '✓ خريطة الانتباه' : '🔥 خريطة الانتباه'}</button>
                    <button type="button" onClick={() => setPhoneView((value) => !value)} className={`rounded-full px-3 py-1 text-[.66rem] font-semibold transition ${phoneView ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>{phoneView ? '✓ عرض الاستوديو' : '📱 أرني كما يراه المتابع'}</button>
                  </div>
                </div>
                {attentionOn && attention && !phoneView && (
                  <div className="mb-3 w-full rounded-xl border border-accent/25 bg-accent/[.06] px-3 py-2">
                    <p className="text-[.68rem] leading-relaxed text-ink/85">👁️ {attention.summary}</p>
                    <p className="mt-1 text-[.62rem] text-soft">توازن توزّع الانتباه: <strong className="text-accent">{attention.balance}٪</strong> — {attention.balance >= 78 ? 'موزّعٌ ناضج' : attention.balance >= 60 ? 'مقبول' : 'مركّزٌ في بؤرةٍ واحدة'}</p>
                  </div>
                )}
                {phoneView && (
                  <div className="mx-auto w-full" style={{ maxWidth: `min(300px, calc(62vh * ${selected.format.width} / ${selected.format.height}))` }}>
                    <div className="relative rounded-[2.4rem] border-[11px] border-ink bg-ink shadow-2xl">
                      <div className="absolute left-1/2 top-2 z-10 h-3.5 w-24 -translate-x-1/2 rounded-full bg-black/60" />
                      <div className="overflow-hidden rounded-[1.7rem] bg-black"><Preview plan={selected} className="w-full" /></div>
                    </div>
                    <p className="mt-2 text-center text-[.62rem] leading-relaxed text-soft">بالحجم الفعلي على الهاتف — إن لم تُقرأ الفكرة فوراً هنا، فلن تُقرأ في الخلاصة.</p>
                  </div>
                )}
                {/* الكانفس الحر: المعاينة نفسها تصير سطح سحبٍ للطبقات. نحدّ عرضها
                   بحسب نسبة المقاس كي لا يتجاوز ارتفاعُها الشاشة فتُقصّ («المعاينة
                   مو كامله») — الآن يظهر التصميمُ كاملاً مهما طال (ستوري وغيره). */}
                <div ref={canvasRef} className={`relative mx-auto w-full ${phoneView ? 'hidden' : ''}`} style={{ maxWidth: `min(100%, calc(68vh * ${selected.format.width} / ${selected.format.height}))`, touchAction: freeMode ? 'none' : undefined }}>
                  <Preview plan={selected} className="w-full" />
                  {attention && <AttentionOverlay map={attention} w={selected.format.width} h={selected.format.height} />}
                  {freeMode && (selected.overlays || []).map((overlay) => (
                    <div
                      key={overlay.id}
                      onPointerDown={(event) => beginDrag(event, overlay, 'move')}
                      className={`absolute cursor-move rounded-md border-2 border-dashed transition-colors ${activeOverlay === overlay.id ? 'border-accent bg-accent/10' : 'border-accent/35 hover:border-accent/70'}`}
                      style={{
                        left: `${overlay.x * 100}%`,
                        top: `${overlay.y * 100}%`,
                        width: `${Math.max(overlay.width, .04) * 100}%`,
                        height: `${Math.max(overlay.height, .035) * 100}%`,
                      }}
                    >
                      <span
                        onPointerDown={(event) => beginDrag(event, overlay, 'resize')}
                        className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-accent shadow"
                        title="اسحب للتحجيم"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid content-start gap-4 pb-6 lg:max-h-full lg:overflow-y-auto lg:pl-1">
                <section className="rounded-2xl border border-accent/30 bg-accent/[.09] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold text-accent">الناقد البصري الداخلي</p><p className="mt-1 text-[.78rem] text-ink/70">قرأه على الهاتف قبل أن يعرضه لك.</p></div><strong className="font-display text-3xl text-accent">{selected.quality?.score || 0}٪</strong></div><div className="mt-3 flex flex-wrap gap-2">{selected.quality?.strengths.map((item) => <span key={item} className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.66rem] font-medium text-ink">✓ {item}</span>)}</div>{selected.quality?.issues.length ? <p className="mt-3 text-[.72rem] leading-relaxed text-ink/80">{selected.quality.issues.join(' · ')}</p> : null}{explanation && (explanation.reasons.length > 0 || !explanation.healthy) ? <div className="mt-3 rounded-xl border border-accent/20 bg-canvas/70 p-3"><p className="text-[.72rem] font-semibold text-ink/90">🔍 لماذا هذه النتيجة؟ {explanation.verdict}</p>{explanation.reasons.length ? <ul className="mt-2 grid gap-2">{explanation.reasons.map((reason) => <li key={reason.dimension} className="rounded-lg border border-hair bg-paper/70 px-3 py-2"><div className="flex items-center justify-between gap-2"><strong className="text-[.7rem] text-ink">{reason.severity === 'critical' ? '⛔' : '⚠️'} {reason.dimension}</strong><span className={`rounded-full px-2 py-0.5 text-[.6rem] font-bold ${reason.severity === 'critical' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-700'}`}>{reason.score}٪</span></div><p className="mt-1 text-[.68rem] leading-relaxed text-soft">{reason.why}</p><p className="mt-1 text-[.68rem] leading-relaxed text-accent">↳ {reason.fix}</p></li>)}</ul> : null}{!explanation.healthy ? <p className="mt-2 rounded-lg bg-accent/[.08] px-3 py-2 text-[.68rem] font-semibold text-accent">أهمّ خطوةٍ الآن: {explanation.nextStep}</p> : null}</div> : null}{selected.rationale?.length ? <div className="mt-4 rounded-xl border border-hair bg-paper/70 p-3"><p className="text-[.64rem] font-bold text-accent">قراءة المخرج الفنّي</p><ul className="mt-2 grid gap-1">{selected.rationale.slice(0, 3).map((line) => <li key={line} className="text-[.72rem] leading-relaxed text-ink/85">• {line}</li>)}</ul></div> : null}</section>
                {/* مختبر الأداء (أ-٣): يتنبّأ بقوة التوقّف والتفاعل — لا يكرّر الناقد (الجودة) بل يكمّله */}
                {forecast && (
                  <section className="rounded-2xl border border-hair bg-canvas p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-[.7rem] font-bold text-accent">مختبر الأداء · تنبّؤ التفاعل</p><p className="mt-1 text-[.72rem] text-ink/60">يقيس قوة التوقّف والتفاعل — لا جودة التصميم.</p></div>
                      <strong className="font-display text-3xl text-accent">{forecast.score}٪</strong>
                    </div>
                    <div className="mt-3 grid gap-1.5">
                      {forecast.signals.map((signal) => (
                        <div key={signal.id} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 text-[.66rem] text-soft">{signal.label}</span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-hair/60"><span className={`block h-full rounded-full ${signal.score >= 70 ? 'bg-accent' : 'bg-accent/40'}`} style={{ width: `${signal.score}%` }} /></span>
                          <span className="w-9 shrink-0 text-left text-[.64rem] font-semibold tabular-nums text-ink/70">{signal.score}٪</span>
                        </div>
                      ))}
                    </div>
                    {forecast.tips.length
                      ? <ul className="mt-3 grid gap-1">{forecast.tips.slice(0, 2).map((tip) => <li key={tip} className="text-[.7rem] leading-relaxed text-ink/75">↑ {tip}</li>)}</ul>
                      : <p className="mt-3 text-[.7rem] text-ink/70">{forecast.highlights.length ? `قويٌّ في: ${forecast.highlights.join(' · ')}.` : 'إشاراته متوازنة — جاهزٌ للنشر.'}</p>}
                  </section>
                )}
                {/* الطبقات الحرة بالسحب (أمر الكمال المطلق) */}
                <section className="rounded-2xl border border-hair bg-canvas p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[.7rem] font-bold text-accent">الطبقات الحرة</p>
                    <button type="button" onClick={() => setFreeMode((value) => !value)} className={`rounded-full px-3 py-1 text-[.68rem] font-semibold transition ${freeMode ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>{freeMode ? '✓ وضع السحب فعّال' : 'فعّل السحب'}</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button type="button" className={ghost} onClick={() => addOverlay('text')}>+ نص</button>
                    <button type="button" className={ghost} onClick={() => addOverlay('rule')}>+ خط</button>
                    <button type="button" className={ghost} onClick={() => addOverlay('circle')}>+ دائرة</button>
                    <button type="button" className={ghost} onClick={() => addOverlay('rect')}>+ إطار</button>
                  </div>
                  <p className="mt-2 text-[.64rem] font-semibold text-soft">مشاهد انبهار جاهزة — بألوان اللوحة نفسها:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <button type="button" className={ghost} onClick={() => addFlourish('gilded-arcs')}>أقواس مذهّبة</button>
                    <button type="button" className={ghost} onClick={() => addFlourish('orbit')}>مدار هادئ</button>
                    <button type="button" className={ghost} onClick={() => addFlourish('horizon')}>خط الأفق</button>
                  </div>
                  {(selected.overlays || []).length > 0 && (
                    <div className="mt-3 grid gap-1.5">
                      {(selected.overlays || []).map((overlay) => (
                        <div key={overlay.id} className={`rounded-xl border px-3 py-2 ${activeOverlay === overlay.id ? 'border-accent bg-accent/[.05]' : 'border-hair'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <button type="button" onClick={() => { setActiveOverlay(overlay.id); setFreeMode(true) }} className="text-[.72rem] font-semibold text-ink hover:text-accent">
                              {overlay.kind === 'text' ? `نص: ${String(overlay.text || '').slice(0, 18)}…` : overlay.kind === 'rule' ? 'خط' : overlay.kind === 'circle' ? 'دائرة' : 'إطار'}
                            </button>
                            <button type="button" onClick={() => removeOverlay(overlay.id)} className="text-[.66rem] text-soft hover:text-red-500">حذف</button>
                          </div>
                          {activeOverlay === overlay.id && (
                            <div className="mt-2 grid gap-2">
                              {overlay.kind === 'text' && (
                                <input value={overlay.text || ''} onChange={(event) => patchOverlay(overlay.id, { text: event.target.value })} className="w-full rounded-lg border border-hair bg-paper px-2.5 py-1.5 text-[.76rem] text-ink outline-none focus:border-accent" />
                              )}
                              <div className="flex flex-wrap items-center gap-3">
                                {(['ink', 'accent', 'muted', 'paper'] as const).map((color) => (
                                  <button key={color} type="button" title={color} onClick={() => patchOverlay(overlay.id, { color })} className={`h-5 w-5 rounded-full border-2 ${overlay.color === color ? 'border-accent' : 'border-hair'}`} style={{ background: color === 'ink' ? '#15161A' : color === 'accent' ? '#3E5C78' : color === 'muted' ? '#626A76' : '#FCFBF7' }} />
                                ))}
                                <label className="flex items-center gap-1.5 text-[.64rem] text-soft">شفافية<input type="range" min="10" max="100" value={Math.round(overlay.opacity * 100)} onChange={(event) => patchOverlay(overlay.id, { opacity: Number(event.target.value) / 100 })} className="w-20 accent-[#3E5C78]" /></label>
                                {overlay.kind === 'text' && (
                                  <label className="flex items-center gap-1.5 text-[.64rem] text-soft">حجم<input type="range" min="15" max="90" value={Math.round((overlay.size || .03) * 1000)} onChange={(event) => patchOverlay(overlay.id, { size: Number(event.target.value) / 1000 })} className="w-20 accent-[#3E5C78]" /></label>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                {/* المحرر المباشر (١٢-١٥): نصوص ولوحات بتراجع وفحص جودة حي */}
                <section className="rounded-2xl border border-hair bg-canvas p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[.7rem] font-bold text-accent">المحرر المباشر</p>
                    <div className="flex gap-1.5">
                      <button type="button" disabled={!editUndo.length} onClick={undoEdit} className={`rounded-full border px-3 py-1 text-[.68rem] font-semibold transition-colors ${editUndo.length ? 'border-hair text-soft hover:border-accent hover:text-accent' : 'border-hair/50 text-soft/40'}`}>↩ تراجع</button>
                      <button type="button" disabled={!editRedo.length} onClick={redoEdit} className={`rounded-full border px-3 py-1 text-[.68rem] font-semibold transition-colors ${editRedo.length ? 'border-hair text-soft hover:border-accent hover:text-accent' : 'border-hair/50 text-soft/40'}`}>↪ إعادة</button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2.5">
                    <EditableText label="العنوان" value={selected.content.title} onCommit={(next) => editContent({ title: next })} />
                    <EditableText label="العنوان الفرعي" value={selected.content.subtitle} onCommit={(next) => editContent({ subtitle: next })} />
                    <EditableText label="المتن" multiline value={selected.content.body} onCommit={(next) => editContent({ body: next })} />
                    <div className="grid grid-cols-2 gap-2.5">
                      <EditableText label="الدعوة" value={selected.content.cta} onCommit={(next) => editContent({ cta: next })} />
                      <EditableText label="الكلمة البطلة" value={selected.content.heroWord} onCommit={(next) => editContent({ heroWord: next })} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-[.64rem] font-semibold text-soft">المنظومة اللونية — بنقرة، والناقد يعيد الحكم فوراً</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(Object.keys(PALETTES) as PaletteId[]).map((paletteId) => {
                        const paletteSpec = PALETTES[paletteId]
                        return (
                          <button
                            key={paletteId}
                            type="button"
                            title={paletteId}
                            aria-label={`لوحة ${paletteId}`}
                            onClick={() => editPalette(paletteId)}
                            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${selected.palette === paletteId ? 'border-accent ring-2 ring-accent/30' : 'border-hair'}`}
                            style={{ background: `linear-gradient(135deg, ${paletteSpec.background} 55%, ${paletteSpec.accent} 55%)` }}
                          />
                        )
                      })}
                    </div>
                  </div>
                  {/* البصمة البصرية: ألوانٌ من صورة الدكتور تكسو كل الاتجاهات — بلا رفعٍ لأي خادم */}
                  <div className="mt-3 border-t border-hair pt-3">
                    <p className="text-[.64rem] font-semibold text-soft">بصمة بصرية — ألوانٌ من صورة تكسو كل الاتجاهات</p>
                    {dna ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="flex overflow-hidden rounded-full border border-hair">{dna.swatches.slice(0, 5).map((color, index) => <span key={index} className="h-5 w-5" style={{ background: color }} />)}</span>
                        <span className="rounded-full border border-accent/30 bg-accent/[.06] px-2.5 py-1 text-[.62rem] font-semibold text-accent">مطبّقة فعلياً على {plans.length} اتجاه</span>
                        <span className="text-[.6rem] text-soft">خلفية · توهجات · زوايا · توقيع لوني</span>
                        <button type="button" onClick={saveDnaFave} className="rounded-full border border-accent/40 px-2.5 py-1 text-[.62rem] font-semibold text-accent transition hover:bg-accent hover:text-white">★ احفظ في المفضّلة</button>
                        <button type="button" onClick={clearVisualDna} className="rounded-full border border-hair px-2.5 py-1 text-[.62rem] font-semibold text-soft transition hover:border-accent hover:text-accent">أزل البصمة</button>
                      </div>
                    ) : (
                      <label className={`mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-hair px-3 py-1.5 text-[.66rem] font-semibold text-soft transition hover:border-accent hover:text-accent ${dnaBusy ? 'pointer-events-none opacity-60' : ''}`}>
                        <input type="file" accept="image/*" className="hidden" disabled={dnaBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void runVisualDna(file); event.currentTarget.value = '' }} />
                        {dnaBusy ? 'يستخرج الألوان…' : '⬆ استخرج ألواناً من صورة'}
                      </label>
                    )}
                    {dnaFaves.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="text-[.6rem] text-soft">بصماتك المفضّلة:</span>
                        {dnaFaves.map((fave, index) => (
                          <button key={index} type="button" title="طبّق هذه البصمة على كل الاتجاهات" onClick={() => { setDna(fave); applyDnaOverride(fave.palette); setNotice('طُبّقت بصمةٌ مفضّلة على كل الاتجاهات.') }} className="h-6 w-6 rounded-full border-2 border-hair transition hover:scale-110" style={{ background: `linear-gradient(135deg, ${fave.palette.background} 50%, ${fave.palette.accent} 50%)` }} />
                        ))}
                        <button type="button" onClick={() => { setDnaFaves([]); try { localStorage.removeItem(DNA_FAVES_KEY) } catch { /* noop */ } }} className="rounded-full border border-hair px-2 py-0.5 text-[.58rem] text-soft transition hover:border-accent hover:text-accent">امسح</button>
                      </div>
                    )}
                  </div>
                  {/* اتجاه الإنفوجرافيك الفنّي: اختيارٌ يدويّ يتقدّم على الانتقاء التلقائي — يظهر للإنفوجرافيك فقط */}
                  {selected.layout === 'infographic' && (
                    <div className="mt-3 border-t border-hair pt-3">
                      <p className="text-[.64rem] font-semibold text-soft">اتجاه الإنفوجرافيك الفنّي — بنقرة</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {INFO_VARIANTS.map(({ id, label }) => {
                          const active = (selected.infoVariant || infographicVariantOf(selected)) === id
                          return <button key={id} type="button" onClick={() => editPlan((plan) => ({ ...plan, infoVariant: id }))} className={`rounded-full px-2.5 py-1 text-[.66rem] font-semibold transition ${active ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{label}</button>
                        })}
                        {selected.infoVariant && <button type="button" onClick={() => editPlan((plan) => ({ ...plan, infoVariant: undefined }))} className="rounded-full border border-hair px-2.5 py-1 text-[.66rem] font-semibold text-soft transition hover:border-accent hover:text-accent">تلقائي</button>}
                      </div>
                    </div>
                  )}
                </section>
                <section className="rounded-2xl border border-hair bg-canvas p-4">
                  <p className="text-[.7rem] font-bold text-accent">أقفال التعديل</p>
                  <div className="mt-3 flex flex-wrap gap-2"><LockButton active={locks.content} onClick={() => setLocks((value) => ({ ...value, content: !value.content }))}>النص</LockButton><LockButton active={locks.style} onClick={() => setLocks((value) => ({ ...value, style: !value.style }))}>الأسلوب</LockButton><LockButton active={locks.color} onClick={() => setLocks((value) => ({ ...value, color: !value.color }))}>اللون</LockButton><LockButton active={locks.format} onClick={() => setLocks((value) => ({ ...value, format: !value.format }))}>المقاس</LockButton></div>
                </section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">إخراج جديد</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={ghost} type="button" onClick={() => regenerateSelected('smart')}>اقتراح أذكى</button><button className={ghost} type="button" onClick={() => regenerateSelected('luxury')}>أكثر فخامة</button><button className={ghost} type="button" onClick={() => regenerateSelected('calm')}>أكثر هدوءًا</button><button className={ghost} type="button" onClick={() => regenerateSelected('bold')}>أكثر جرأة</button></div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">تحويل ذكي للمقاس</p><div className="mt-3 flex flex-wrap gap-2">{formatActions.map((action) => <button key={action.id} className={ghost} type="button" onClick={() => transform(action.id)}>{action.label}</button>)}</div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">التصدير</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={primary} type="button" onClick={() => void exportPlan(selected, 'png')}>تنزيل PNG</button><button className={ghost} type="button" onClick={() => void exportPlan(selected, 'jpeg')}>تنزيل JPG</button><button className={ghost} type="button" onClick={() => void downloadCompositionSvg(selected)}>تنزيل SVG</button><button className={ghost} type="button" onClick={() => printCompositionPdf(selected)}>طباعة / PDF</button><button className={`${primary} sm:col-span-2`} type="button" title="الأصل + مربع + ستوري + LinkedIn، كل نسخة بهندسة مقاسها" onClick={() => void exportAllSizes(selected)}>كل المقاسات دفعة واحدة</button></div></section>
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
