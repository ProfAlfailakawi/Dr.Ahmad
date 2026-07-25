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
  designSimilarity,
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
import { analyzeStudioImageFromFile, analyzeStudioImageFromUrl, extractVisualDnaFromFile, type StudioImagePassport, type VisualDna } from '../../lib/visual-dna'
import { buildArtDirections, buildCreativeBrief, detectVisualCliches, DEFAULT_CREATIVE_IDENTITY, identityContext, type ArtDirection, type CreativeIdentity } from '../../lib/creative-director'
import { buildVisualSearchPlan, searchExternalVisualSources, type ExternalVisualResult } from '../../lib/external-visual-sources'
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

const STUDIO_STAGES = [
  { id: 'idea', number: '01', label: 'الفكرة', description: 'المعنى والجمهور والهدف' },
  { id: 'directions', number: '02', label: 'الاتجاهات', description: 'ثلاث رؤى متباعدة' },
  { id: 'edit', number: '03', label: 'التحرير', description: 'اللوحة والطبقات والخصائص' },
  { id: 'publish', number: '04', label: 'النشر', description: 'المقاسات والحملة والتصدير' },
] as const

type StudioStage = typeof STUDIO_STAGES[number]['id']
type MobileEditorPanel = 'preview' | 'layers' | 'properties'

type AutoPilotModeId = 'safe' | 'editorial' | 'luxury' | 'impact' | 'evidence'
type AutoPilotCandidate = {
  id: AutoPilotModeId
  label: string
  note: string
  plan: CompositionPlan
  worldScore: number
  qualityScore: number
  stopScore: number
}

type ReleaseVariant = {
  id: 'final' | 'safer' | 'viral'
  label: string
  note: string
  plan: CompositionPlan
  score: number
}

type ZeroDecisionSummary = {
  approved: ReleaseVariant
  campaignReady: boolean
  campaignQuality: number
  note: string
}

const AUTOPILOT_PRESETS: { id: AutoPilotModeId; label: string; note: string; tone: ContentTone; density: DesignDensity; preferLayout: LayoutFamilyId; platform?: SocialPlatform | 'auto'; imageTreatment?: NonNullable<PlanOverlay['imageTreatment']> }[] = [
  { id: 'safe', label: 'النسخة الآمنة', note: 'أوضح قراءة وأعلى موثوقية للنشر الرسمي.', tone: 'formal', density: 'balanced', preferLayout: 'editorial-axis', platform: 'auto', imageTreatment: 'editorial' },
  { id: 'editorial', label: 'الغلاف التحريري', note: 'غلاف مجلة فكرية بهدوء وهيبة.', tone: 'intellectual', density: 'minimal', preferLayout: 'cinematic-window', platform: 'instagram', imageTreatment: 'cinematic' },
  { id: 'luxury', label: 'الفاخر الصامت', note: 'رقي بصري أقل كلاماً وأكثر هيبة.', tone: 'luxury', density: 'minimal', preferLayout: 'quiet-orbit', platform: 'instagram', imageTreatment: 'duotone' },
  { id: 'impact', label: 'نسخة التوقف', note: 'مصممة لالتقاط العين بسرعة من أول ثانية.', tone: 'bold', density: 'minimal', preferLayout: 'hero-word', platform: 'instagram', imageTreatment: 'cinematic' },
  { id: 'evidence', label: 'نسخة الدليل', note: 'تدفع الرقم أو الحجة إلى الواجهة بلا ضجيج.', tone: 'academic', density: 'balanced', preferLayout: 'evidence-ledger', platform: 'linkedin', imageTreatment: 'documentary' },
]

function selectDistinctTriptych(plans: CompositionPlan[]) {
  const selected: CompositionPlan[] = []
  for (const plan of plans) {
    if (!selected.some((item) => item.layout === plan.layout)) selected.push(plan)
    if (selected.length === 3) break
  }
  for (const plan of plans) {
    if (selected.length === 3) break
    if (!selected.some((item) => item.id === plan.id)) selected.push(plan)
  }
  return selected
}

function StageRail({ stage, onChange }: { stage: StudioStage; onChange: (stage: StudioStage) => void }) {
  return <nav aria-label="مراحل استوديو التصميم" className="overflow-x-auto pb-1"><ol className="flex min-w-max gap-2">{STUDIO_STAGES.map((item) => <li key={item.id}><button type="button" onClick={() => onChange(item.id)} className={`min-w-[170px] rounded-2xl border px-4 py-3 text-right transition ${stage === item.id ? 'border-accent bg-accent text-white shadow-sm' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}><span className="text-[.62rem] font-bold tracking-[.12em] opacity-75">{item.number}</span><strong className="mt-1 block text-[.8rem]">{item.label}</strong><span className="mt-1 block text-[.64rem] opacity-80">{item.description}</span></button></li>)}</ol></nav>
}

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
  const [stage, setStage] = useState<StudioStage>('idea')
  const [plans, setPlans] = useState<CompositionPlan[]>([])
  const [reservePlans, setReservePlans] = useState<CompositionPlan[]>([])
  const [professionalCheckOpen, setProfessionalCheckOpen] = useState(false)
  const [creativeIdentity, setCreativeIdentity] = useState<CreativeIdentity>(() => {
    try { return { ...DEFAULT_CREATIVE_IDENTITY, ...JSON.parse(localStorage.getItem('dr-ahmad-creative-identity-v1') || '{}') } }
    catch { return DEFAULT_CREATIVE_IDENTITY }
  })
  const [imagePassport, setImagePassport] = useState<StudioImagePassport | null>(null)
  const [imageDescription, setImageDescription] = useState('')
  const [imageSource, setImageSource] = useState('')
  const [imageOwner, setImageOwner] = useState('')
  const [imageLicense, setImageLicense] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [externalVisuals, setExternalVisuals] = useState<ExternalVisualResult[]>([])
  const [externalBusy, setExternalBusy] = useState(false)
  const [externalError, setExternalError] = useState('')
  const [externalQuery, setExternalQuery] = useState('')
  const [generatorBusy, setGeneratorBusy] = useState(false)
  const [lastVisualSearchSignature, setLastVisualSearchSignature] = useState('')
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
  const [autopilotBusy, setAutopilotBusy] = useState(false)
  const [autopilotPack, setAutopilotPack] = useState<AutoPilotCandidate[]>([])
  const [autoFinalsBusy, setAutoFinalsBusy] = useState(false)
  const [releasePackBusy, setReleasePackBusy] = useState(false)
  const [releasePack, setReleasePack] = useState<ReleaseVariant[]>([])
  const [zeroDecisionBusy, setZeroDecisionBusy] = useState(false)
  const [zeroDecision, setZeroDecision] = useState<ZeroDecisionSummary | null>(null)
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
  const [mobileEditorPanel, setMobileEditorPanel] = useState<MobileEditorPanel>('preview')
  const [attentionOn, setAttentionOn] = useState(false)
  const activeSeason = useMemo(() => currentSeason(), [])
  // مختبر الأداء: تنبّؤ التفاعل للتصميم المختار — يُحسب محلياً عند كل تغيير.
  const forecast = useMemo(() => (selected ? predictEngagement(selected) : null), [selected])
  // خريطة الانتباه (٨) وشرح التعثّر (٢٢): محاكاةٌ وتشخيصٌ محليّان للتصميم المختار.
  const attention = useMemo<AttentionMap | null>(() => (selected && attentionOn ? computeAttentionMap(selected) : null), [selected, attentionOn])
  const explanation = useMemo<DesignExplanation | null>(() => (selected ? explainDesign(selected) : null), [selected])
  const globalCritic = useMemo(() => {
    if (!selected) return null
    const quality = selected.quality || critiqueCompositionPlan(selected, plans.filter((peer) => peer.id !== selected.id))
    const stop = predictEngagement(selected)
    const imageDriven = Boolean(selected.overlays?.some((item) => item.kind === 'image' && item.imageRole === 'background'))
    const score = Math.round(quality.score * .62 + stop.score * .24 + selected.novelty * 9 + (selected.tasteAffinity || 0) * 5 + (imageDriven ? 3 : 0))
    const verdict = score >= 92 ? 'جاهز لمنافسة أفضل الإخراجات.' : score >= 86 ? 'قوي جدًا ويستحق النشر.' : score >= 80 ? 'ممتاز لكن يمكن دفعه أكثر.' : 'جيد، ويحتاج دفعة أخرى قبل أن يبهر.'
    const nextStep = quality.issues[0] || stop.tips[0] || 'جرّب نسخة الطيار الآلي أو بدّل زاوية المشهد.'
    return { score, verdict, nextStep, imageDriven, stop }
  }, [plans, selected])
  const designLineage = useMemo(() => {
    if (!selected) return null
    const history = loadHistory().filter((entry) => entry.fingerprint !== selected.fingerprint)
    if (!history.length) return null
    const nearest = history
      .map((entry) => ({ entry, similarity: designSimilarity(selected, entry.signature) }))
      .sort((left, right) => right.similarity - left.similarity)[0]
    if (!nearest) return null
    const sameFamily = nearest.entry.signature.layout === selected.layout
    return {
      similarity: Math.round(nearest.similarity * 100),
      message: nearest.similarity >= .82
        ? 'هذا الاتجاه قريب جدًا من سلالة سابقة؛ الأفضل كسر النبرة أو المعالجة قبل الاعتماد النهائي.'
        : nearest.similarity >= .66
          ? 'هذا الاتجاه امتداد ناضج لسلالة سابقة مع تطور واضح.'
          : 'الاتجاه الحالي يفتح سلالة جديدة شبه مستقلة عن تاريخك.' ,
      family: sameFamily ? 'العائلة نفسها' : 'عائلة مختلفة',
    }
  }, [selected])
  const designProvenance = useMemo(() => {
    if (!selected) return null
    const hero = selected.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')
    return {
      source: hero?.sourceUrl || imageSource || 'غير مسجل',
      owner: hero?.owner || imageOwner || 'غير مسجل',
      license: hero?.license || imageLicense || 'غير مسجل',
      reasons: selected.rationale?.slice(0, 4) || [],
      heroMode: hero?.imageTreatment || 'لا توجد صورة بطولية',
      slides: selected.content.slides?.length || 0,
    }
  }, [selected, imageLicense, imageOwner, imageSource])
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
    setMobileEditorPanel('preview')
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
  const creativeBrief = useMemo(() => buildCreativeBrief(text || 'فكرة معرفية جديدة', `${context} · ${identityContext(creativeIdentity)}`, analysis), [analysis, context, creativeIdentity, text])
  const visualSearchPlan = useMemo(() => buildVisualSearchPlan(text || 'فكرة معرفية جديدة', context, creativeBrief, creativeIdentity), [context, creativeBrief, creativeIdentity, text])
  const artDirections = useMemo<ArtDirection[]>(() => buildArtDirections(creativeBrief), [creativeBrief])
  const externalProviderLabels = useMemo(() => [...new Set(externalVisuals.map((item) => item.providerLabel))], [externalVisuals])
  const hasPexelsProvider = useMemo(() => externalVisuals.some((item) => item.provider === 'pexels'), [externalVisuals])
  const hasOpenverseProvider = useMemo(() => externalVisuals.some((item) => item.provider === 'openverse'), [externalVisuals])
  const bestExternalVisual = externalVisuals[0]
  const imageGeneratorEndpoint = (import.meta as any)?.env?.VITE_STUDIO_IMAGE_GENERATOR_ENDPOINT as string | undefined

  useEffect(() => {
    if (!hasInput || stage !== 'idea') return
    const signature = `${visualSearchPlan.queries.join('|')}::${visualSearchPlan.englishQueries.join('|')}`
    if (signature === lastVisualSearchSignature || externalBusy) return
    const timer = window.setTimeout(() => { void runExternalSearch(visualSearchPlan.queries[0] || visualSearchPlan.headline) }, 900)
    return () => window.clearTimeout(timer)
  }, [externalBusy, hasInput, lastVisualSearchSignature, stage, visualSearchPlan])
  const clicheWarnings = useMemo(() => detectVisualCliches(imageDescription), [imageDescription])
  useEffect(() => {
    try { localStorage.setItem('dr-ahmad-creative-identity-v1', JSON.stringify(creativeIdentity)) } catch { /* الذاكرة اختيارية */ }
  }, [creativeIdentity])
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
    const triptych = selectDistinctTriptych(finalPlans)
    setPlans(triptych)
    setReservePlans(finalPlans.filter((plan) => !triptych.some((item) => item.id === plan.id)))
    setSelected(null)
    setStage('directions')
    remember(finalPlans)
    setNotice(result.generation.warnings[0] || 'فحص المخرج ثمانية احتمالات داخليًا، ثم اختار ثلاث رؤى متباعدة بدل نتائج متقاربة.')
  }
  generateRef.current = () => generate()

  /* ═══ رنين القراء: الجمل التي ظللها جمهورك الحقيقي — بضغطة تصير تصميماً ═══ */
  const { articles: cmsArticles, books: cmsBooks } = useCmsContent()
  const libraryImages = useMemo(() => {
    const normalize = (value: string) => value.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
    const wanted = new Set(normalize(`${text} ${context}`).split(' ').filter((word) => word.length > 2))
    const score = (value: string) => normalize(value).split(' ').reduce((sum, word) => sum + (wanted.has(word) ? 1 : 0), 0)
    const candidates = [
      { id: 'portrait', title: 'الصورة الشخصية', note: 'حضور إنساني موثّق داخل الموقع', url: '/portrait.webp' },
      { id: 'podcast', title: 'غلاف البودكاست', note: 'هوية صوتية موجودة في المكتبة', url: '/podcast-cover.png' },
      { id: 'identity', title: 'الغلاف العام', note: 'هوية الموقع البصرية الأساسية', url: '/og.png' },
      ...cmsBooks.filter((book) => book.cover).map((book) => ({ id: `book-${book.slug}`, title: book.title, note: 'غلاف كتاب من مكتبة المؤلفات', url: book.cover })),
    ]
    return candidates
      .map((item, index) => ({ ...item, score: score(`${item.title} ${item.note}`), index }))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 8)
  }, [cmsBooks, context, text])
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
    setEditUndo((stack) => [...stack.slice(-79), selected])
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
  const runImagePassport = async (file: File) => {
    setImageBusy(true)
    try {
      const result = await analyzeStudioImageFromFile(file)
      if (!result) { setNotice('تعذّر تحليل الصورة محليًا. جرّب PNG أو JPG آخر.'); return }
      setImagePassport(result)
      setImageDescription((value) => value || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      setNotice('اكتمل جواز الصورة تقنيًا: القص، نقطة التركيز، المساحة الهادئة، والتباين. أضف المصدر والترخيص قبل الاعتماد.')
    } catch { setNotice('تعذّر إعداد جواز الصورة الآن.') }
    finally { setImageBusy(false) }
  }
  const runLibraryImage = async (item: { title: string; note: string; url: string }) => {
    setImageBusy(true)
    try {
      const result = await analyzeStudioImageFromUrl(item.url, item.title)
      if (!result) { setNotice('تعذّر فتح هذه الصورة من مكتبة الموقع الآن. لم تُستبدل الصورة الحالية.'); return }
      setImagePassport(result)
      setImageDescription(`${item.title} — ${item.note}`)
      setImageSource(item.url)
      setImageOwner('مكتبة الموقع')
      setImageLicense('تحتاج مراجعة سجل الأصل قبل النشر الخارجي')
      setNotice('اختيرت صورة من مكتبة الموقع وحُللت محليًا. حالة الحقوق معلّمة للمراجعة ولا يفترض النظام ترخيصًا غير مسجل.')
    } catch { setNotice('تعذّر إعداد جواز الصورة من مكتبة الموقع.') }
    finally { setImageBusy(false) }
  }

  const applyExternalVisual = async (item: ExternalVisualResult, autoTreatment?: NonNullable<PlanOverlay['imageTreatment']>) => {
    setImageBusy(true)
    try {
      const result = await analyzeStudioImageFromUrl(item.imageUrl, item.title)
      if (!result) { setNotice('وصلت بيانات الصورة الخارجية لكن تحليلها التقني تعذّر الآن. جرّب مرشحًا آخر أو افتح الصفحة الأصلية.'); return }
      const source = item.pageUrl || item.imageUrl
      const description = item.description || item.title
      setImagePassport(result)
      setImageDescription(description)
      setImageSource(source)
      setImageOwner(item.author)
      setImageLicense(item.license)
      if (autoTreatment) {
        applyImageLedDirection(autoTreatment, result, { source, owner: item.author, license: item.license, description })
      } else {
        setNotice(`اختيرت صورة من ${item.providerLabel} وحُللت محليًا. جواز الصورة يعرض المصدر والترخيص قبل الاعتماد.`)
      }
    } catch {
      setNotice('تعذّر إعداد جواز الصورة من المرشح الخارجي الآن.')
    } finally { setImageBusy(false) }
  }
  const runExternalSearch = async (overrideQuery?: string) => {
    if (!hasInput) return
    const query = (overrideQuery || externalQuery || visualSearchPlan.queries[0] || visualSearchPlan.headline).trim()
    if (!query) return
    const signature = `${query}::${visualSearchPlan.queries.join('|')}::${visualSearchPlan.englishQueries.join('|')}`
    setExternalBusy(true)
    setExternalError('')
    setLastVisualSearchSignature(signature)
    try {
      const queryPlan = { ...visualSearchPlan, queries: [query, ...visualSearchPlan.queries.filter((item) => item !== query)] }
      const results = await searchExternalVisualSources(queryPlan, 12)
      setExternalVisuals(results)
      setExternalQuery(query)
      setLastVisualSearchSignature(signature)
      if (results.length) setNotice(`عُثر على ${results.length} مرشحًا بصريًا من مصادر مجانية وموثقة.`)
      else setNotice('لم أجد مرشحات قوية بهذه العبارة. جرّب استعلامًا أقصر أو بدّل الزاوية البصرية.')
    } catch {
      setExternalVisuals([])
      setExternalError('تعذّر جلب المرشحات الخارجية الآن. استمرّت المكتبة المحلية بالعمل.')
      setNotice('تعذّر جلب المرشحات الخارجية الآن. استمرّت المكتبة المحلية بالعمل.')
    } finally { setExternalBusy(false) }
  }
  const copyGenerationPrompt = async () => {
    try {
      await navigator.clipboard.writeText(visualSearchPlan.generationPrompt)
      setNotice('نُسخ Prompt التوليد إلى الحافظة.')
    } catch {
      setNotice('تعذّر النسخ الآلي. انسخه يدويًا من الحقل الظاهر.')
    }
  }
  const runGenerator = async () => {
    if (!imageGeneratorEndpoint) {
      setNotice('لا يوجد مزود توليد موصول بعد. Prompt التوليد جاهز ويمكن نسخه أو ربط endpoint لاحقًا.')
      return
    }
    setGeneratorBusy(true)
    try {
      const response = await fetch(imageGeneratorEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: visualSearchPlan.generationPrompt,
          identity: creativeIdentity,
          brief: creativeBrief,
        }),
      })
      if (!response.ok) throw new Error('generator_failed')
      const payload = await response.json() as { imageUrl?: string; sourceUrl?: string; owner?: string; license?: string; description?: string }
      if (!payload.imageUrl) throw new Error('generator_empty')
      await applyExternalVisual({
        id: `generated-${Date.now()}`,
        provider: 'wikimedia',
        providerLabel: 'مولد بصري موصول',
        title: creativeBrief.issue,
        description: payload.description || visualSearchPlan.generationPrompt,
        thumbnailUrl: payload.imageUrl,
        imageUrl: payload.imageUrl,
        pageUrl: payload.sourceUrl || payload.imageUrl,
        author: payload.owner || 'مولد بصري',
        license: payload.license || 'تحتاج مراجعة سياسة المزود',
        requiresAttribution: false,
        rationale: 'صورة مولدة بعد تعذر إيجاد مرشح بصري مناسب أو الرغبة في اتجاه أصلي.',
        score: 90,
        orientation: 'unknown',
      })
    } catch {
      setNotice('تعذّر التوليد البصري الآن. بقي Prompt التوليد جاهزًا والبحث الخارجي يعمل.')
    } finally { setGeneratorBusy(false) }
  }
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
  const [selectedOverlayIds, setSelectedOverlayIds] = useState<string[]>([])
  const [overlayStyleClipboard, setOverlayStyleClipboard] = useState<Partial<PlanOverlay> | null>(null)
  const [activeGuides, setActiveGuides] = useState<{ x?: number; y?: number }>({})
  const dragRef = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; origins: PlanOverlay[]; originalPlan: CompositionPlan } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const cinematicTextZone = (passport: StudioImagePassport): NonNullable<PlanOverlay['textZone']> => {
    if (passport.negativeSpace === 'right') return 'right'
    if (passport.negativeSpace === 'left') return 'left'
    if (passport.negativeSpace === 'top') return 'top'
    if (passport.negativeSpace === 'bottom') return 'bottom'
    return passport.focalX < .46 ? 'right' : 'left'
  }
  const buildImageLedPlan = (
    plan: CompositionPlan,
    treatment: NonNullable<PlanOverlay['imageTreatment']>,
    passport: StudioImagePassport,
    metadata?: { source?: string; owner?: string; license?: string; description?: string },
  ) => {
    const roleId = `hero-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const zone = cinematicTextZone(passport)
    const existing = (plan.overlays || []).filter((item) => item.imageRole !== 'background')
    const background: PlanOverlay = {
      id: roleId,
      kind: 'image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      src: passport.dataUrl,
      name: passport.fileName,
      sourceUrl: metadata?.source || imageSource.trim() || undefined,
      owner: metadata?.owner || imageOwner.trim() || undefined,
      license: metadata?.license || imageLicense.trim() || undefined,
      importedAt: new Date().toISOString(),
      semanticDescription: metadata?.description || imageDescription.trim() || undefined,
      color: 'paper',
      opacity: 1,
      zIndex: -100,
      locked: true,
      rotation: 0,
      blendMode: 'normal',
      fit: 'cover',
      focalX: passport.focalX,
      focalY: passport.focalY,
      mask: 'none',
      imageRole: 'background',
      imageTreatment: treatment,
      textZone: zone,
      vignette: treatment === 'documentary' ? .22 : treatment === 'editorial' ? .32 : treatment === 'duotone' ? .38 : .46,
      readabilityShade: treatment === 'documentary' ? .58 : treatment === 'editorial' ? .68 : .76,
    }
    const palette: PaletteId = treatment === 'duotone' ? 'graphite-gold' : 'brand-night'
    const layout: LayoutFamilyId = treatment === 'documentary' ? 'editorial-axis' : treatment === 'editorial' ? 'quote-stage' : 'cinematic-window'
    const next = {
      ...plan,
      layout,
      palette,
      paletteOverride: undefined,
      density: treatment === 'documentary' ? 'balanced' : 'minimal',
      framing: treatment === 'editorial' ? 'editorial-folio' : 'cinematic-crop',
      overlays: [background, ...existing],
      rationale: [
        `الصورة أصبحت المسرح الأساسي للتكوين بمعالجة ${treatment === 'cinematic' ? 'سينمائية' : treatment === 'documentary' ? 'وثائقية' : treatment === 'duotone' ? 'ثنائية اللون' : 'تحريرية'}.`,
        `اختيرت منطقة النص ${zone === 'right' ? 'يمينًا' : zone === 'left' ? 'يسارًا' : zone === 'top' ? 'أعلى' : zone === 'bottom' ? 'أسفل' : 'في الوسط'} بحسب أهدأ مساحة في الصورة.`,
        'حافظ المحرك على المصدر والترخيص ونقطة التركيز داخل جواز الصورة.',
        ...(plan.rationale || []).slice(0, 2),
      ],
    } as CompositionPlan
    return next
  }
  const applyImageLedDirection = (
    treatment: NonNullable<PlanOverlay['imageTreatment']>,
    passportOverride?: StudioImagePassport,
    metadata?: { source?: string; owner?: string; license?: string; description?: string },
  ) => {
    if (!selected) { setNotice('اختر اتجاهًا أولًا، ثم حوّل الصورة إلى مشهد بطولي.'); return }
    const passport = passportOverride || imagePassport
    if (!passport) { setNotice('اختر صورة أولًا كي أبني حولها المشهد السينمائي.'); return }
    editPlan((plan) => buildImageLedPlan(plan, treatment, passport, metadata))
    setFreeMode(false)
    setMobileEditorPanel('preview')
    setStage('edit')
    setNotice('بُني مشهد بصري بطولي حول الصورة: معالجة، تعتيم موجه، نقطة تركيز، ومناطق قراءة — لا مجرد صورة خلف النص.')
  }

  const addOverlay = (kind: PlanOverlay['kind']) => {
    if (!selected) return
    if (kind === 'image' && !imagePassport) { setNotice('حمّل صورة وأنشئ جوازها أولًا، ثم أضفها إلى اللوحة.'); return }
    const currentTop = Math.max(0, ...(selected.overlays || []).map((item) => item.zIndex || 0))
    const overlay: PlanOverlay = {
      id: `ov-${Date.now().toString(36)}`,
      kind,
      x: kind === 'rule' ? .2 : kind === 'image' ? .08 : .3,
      y: kind === 'image' ? .08 : .42,
      width: kind === 'circle' ? .18 : kind === 'rule' ? .6 : kind === 'image' ? .84 : .4,
      height: kind === 'circle' ? .18 : kind === 'rule' ? .004 : kind === 'rect' ? .2 : kind === 'image' ? .42 : .1,
      text: kind === 'text' ? 'نص جديد — حرّرني' : undefined,
      src: kind === 'image' ? imagePassport?.dataUrl : undefined,
      name: kind === 'image' ? imagePassport?.fileName : undefined,
      sourceUrl: kind === 'image' ? imageSource.trim() || undefined : undefined,
      owner: kind === 'image' ? imageOwner.trim() || undefined : undefined,
      license: kind === 'image' ? imageLicense.trim() || undefined : undefined,
      importedAt: kind === 'image' ? new Date().toISOString() : undefined,
      semanticDescription: kind === 'image' ? imageDescription.trim() || undefined : undefined,
      size: kind === 'text' ? .034 : undefined,
      color: kind === 'text' ? 'ink' : 'accent',
      opacity: kind === 'text' || kind === 'image' ? 1 : .55,
      align: 'end',
      zIndex: currentTop + 1,
      locked: false,
      rotation: 0,
      blendMode: 'normal',
      fit: kind === 'image' ? imagePassport?.recommendedFit : undefined,
      focalX: kind === 'image' ? imagePassport?.focalX : undefined,
      focalY: kind === 'image' ? imagePassport?.focalY : undefined,
      mask: kind === 'image' ? 'rounded' : undefined,
    }
    editPlan((plan) => ({ ...plan, overlays: [...(plan.overlays || []), overlay] }))
    setActiveOverlay(overlay.id)
    setSelectedOverlayIds([overlay.id])
    setFreeMode(true)
  }
  const patchOverlay = (id: string, patch: Partial<PlanOverlay>) =>
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const removeOverlay = (id: string) => {
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).filter((item) => item.id !== id) }))
    setActiveOverlay((current) => current === id ? null : current)
    setSelectedOverlayIds((current) => current.filter((item) => item !== id))
  }
  const duplicateOverlay = (overlay: PlanOverlay) => {
    const copy = { ...overlay, id: `ov-${Date.now().toString(36)}`, x: Math.min(.95, overlay.x + .025), y: Math.min(.95, overlay.y + .025), zIndex: (overlay.zIndex || 0) + 1 }
    editPlan((plan) => ({ ...plan, overlays: [...(plan.overlays || []), copy] }))
    setActiveOverlay(copy.id)
    setSelectedOverlayIds([copy.id])
  }
  const moveOverlayLayer = (id: string, direction: 1 | -1) => {
    const all = selected?.overlays || []
    const top = Math.max(0, ...all.map((item) => item.zIndex || 0))
    const bottom = Math.min(0, ...all.map((item) => item.zIndex || 0))
    patchOverlay(id, { zIndex: direction > 0 ? top + 1 : bottom - 1 })
  }
  const alignOverlay = (id: string, target: 'right' | 'center' | 'left' | 'top' | 'middle' | 'bottom') => {
    const overlay = (selected?.overlays || []).find((item) => item.id === id)
    if (!overlay) return
    const patch = target === 'right' ? { x: 1 - overlay.width - .06 }
      : target === 'center' ? { x: .5 - overlay.width / 2 }
        : target === 'left' ? { x: .06 }
          : target === 'top' ? { y: .06 }
            : target === 'middle' ? { y: .5 - overlay.height / 2 }
              : { y: 1 - overlay.height - .06 }
    patchOverlay(id, patch)
  }
  const toggleOverlaySelection = (id: string) => setSelectedOverlayIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const groupSelectedOverlays = () => {
    if (selectedOverlayIds.length < 2) { setNotice('اختر طبقتين على الأقل لتكوين مجموعة.'); return }
    const groupId = `group-${Date.now().toString(36)}`
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => selectedOverlayIds.includes(item.id) ? { ...item, groupId } : item) }))
    setNotice(`جُمعت ${selectedOverlayIds.length} طبقات؛ سحب إحداها يحرك المجموعة كلها.`)
  }
  const ungroupSelectedOverlays = () => {
    if (!selectedOverlayIds.length) return
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => selectedOverlayIds.includes(item.id) ? { ...item, groupId: undefined } : item) }))
    setNotice('فُك ارتباط الطبقات المحددة مع بقاء مواقعها كما هي.')
  }
  const distributeSelectedOverlays = (axis: 'x' | 'y') => {
    const picked = (selected?.overlays || []).filter((item) => selectedOverlayIds.includes(item.id))
    if (picked.length < 3) { setNotice('اختر ثلاث طبقات على الأقل للتوزيع المتساوي.'); return }
    const sorted = [...picked].sort((left, right) => axis === 'x' ? left.x - right.x : left.y - right.y)
    const first = axis === 'x' ? sorted[0].x : sorted[0].y
    const last = axis === 'x' ? sorted[sorted.length - 1].x : sorted[sorted.length - 1].y
    const step = (last - first) / Math.max(1, sorted.length - 1)
    const positions = new Map(sorted.map((item, index) => [item.id, first + step * index]))
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => {
      const position = positions.get(item.id)
      return position == null ? item : { ...item, [axis]: position }
    }) }))
    setNotice(axis === 'x' ? 'وُزعت الطبقات المحددة أفقيًا بمسافات متساوية.' : 'وُزعت الطبقات المحددة رأسيًا بمسافات متساوية.')
  }
  const copyOverlayStyle = (overlay: PlanOverlay) => {
    setOverlayStyleClipboard({ color: overlay.color, opacity: overlay.opacity, rotation: overlay.rotation, size: overlay.size, weight: overlay.weight, align: overlay.align, blendMode: overlay.blendMode, fit: overlay.fit, mask: overlay.mask, imageRole: overlay.imageRole, imageTreatment: overlay.imageTreatment, textZone: overlay.textZone, vignette: overlay.vignette, readabilityShade: overlay.readabilityShade })
    setNotice('نُسخ نمط الطبقة. حدّد طبقة أو أكثر ثم اختر «ألصق النمط».')
  }
  const pasteOverlayStyle = () => {
    if (!overlayStyleClipboard || !selectedOverlayIds.length) return
    editPlan((plan) => ({ ...plan, overlays: (plan.overlays || []).map((item) => selectedOverlayIds.includes(item.id) ? { ...item, ...overlayStyleClipboard } : item) }))
    setNotice(`طُبق النمط على ${selectedOverlayIds.length} طبقة من دون تغيير محتواها أو موقعها.`)
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
    if (overlay.locked || !selected) return
    event.preventDefault()
    event.stopPropagation()
    const origins = mode === 'move' && overlay.groupId
      ? (selected.overlays || []).filter((item) => item.groupId === overlay.groupId && !item.locked).map((item) => ({ ...item }))
      : [{ ...overlay }]
    dragRef.current = { id: overlay.id, mode, startX: event.clientX, startY: event.clientY, origins, originalPlan: selected }
    setActiveOverlay(overlay.id)
    if (!selectedOverlayIds.includes(overlay.id)) setSelectedOverlayIds([overlay.id])
    const onMove = (move: PointerEvent) => {
      const drag = dragRef.current
      const canvas = canvasRef.current
      if (!drag || !canvas) return
      const bounds = canvas.getBoundingClientRect()
      const rawDeltaX = (move.clientX - drag.startX) / bounds.width
      const rawDeltaY = (move.clientY - drag.startY) / bounds.height
      const clampRatio = (value: number, minimum = -0.4, maximum = 1.2) => Math.max(minimum, Math.min(maximum, value))
      const snap = (value: number, guides = [.06, .08, .5, .92, .94]) => {
        const nearest = guides.reduce((best, guide) => Math.abs(guide - value) < Math.abs(best - value) ? guide : best, guides[0])
        return Math.abs(nearest - value) < .012 ? { value: nearest, guide: nearest } : { value: Math.round(value * 1000) / 1000, guide: undefined }
      }
      const activeOrigin = drag.origins.find((item) => item.id === drag.id) || drag.origins[0]
      let deltaX = rawDeltaX
      let deltaY = rawDeltaY
      if (drag.mode === 'move') {
        const snappedX = snap(clampRatio(activeOrigin.x + rawDeltaX))
        const snappedY = snap(clampRatio(activeOrigin.y + rawDeltaY))
        deltaX = snappedX.value - activeOrigin.x
        deltaY = snappedY.value - activeOrigin.y
        setActiveGuides({ x: snappedX.guide, y: snappedY.guide })
      }
      const originsById = new Map(drag.origins.map((item) => [item.id, item]))
      setSelected((current) => {
        if (!current) return current
        return {
          ...current,
          overlays: (current.overlays || []).map((item) => {
            const origin = originsById.get(item.id)
            if (!origin) return item
            return drag.mode === 'move'
              ? { ...item, x: clampRatio(origin.x + deltaX), y: clampRatio(origin.y + deltaY) }
              : item.id === drag.id
                ? { ...item, width: clampRatio(origin.width + rawDeltaX, .02, 1.4), height: clampRatio(origin.height + rawDeltaY, .003, 1.2) }
                : item
          }),
        }
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const drag = dragRef.current
      dragRef.current = null
      setActiveGuides({})
      if (!drag) return
      setSelected((current) => {
        if (!current) return current
        const requalified = { ...current, quality: critiqueCompositionPlan(current, plans.filter((plan) => plan.id !== current.id)) }
        setEditUndo((stack) => [...stack.slice(-79), drag.originalPlan])
        setEditRedo([])
        setPlans((list) => list.map((item) => item.id === requalified.id ? requalified : item))
        return requalified
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
    const triptych = selectDistinctTriptych(regenerated)
    setPlans(triptych)
    setReservePlans(regenerated.filter((plan) => !triptych.some((item) => item.id === plan.id)))
    setSelected(triptych[0] || selected)
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
    const triptych = selectDistinctTriptych(carouselPlans)
    setPlans(triptych)
    setReservePlans(carouselPlans.filter((plan) => !triptych.some((item) => item.id === plan.id)))
    setSelected(null)
    setStage('directions')
    remember(carouselPlans)
    setNotice('فُحصت ثمانية اتجاهات كاروسيل، وعُرضت ثلاث رؤى متباعدة بتوزيع حقيقي على الشرائح.')
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
      const heroImage = basePlan?.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && item.src)
      if (heroImage) {
        const treatmentForRole: Partial<Record<SocialCampaign['assets'][number]['role'], NonNullable<PlanOverlay['imageTreatment']>>> = {
          hero: 'cinematic', teaser: 'cinematic', story: 'documentary', quote: 'editorial', linkedin: 'editorial', closing: 'duotone', reminder: 'documentary', reel: 'cinematic',
        }
        const assets = next.assets.map((asset, index) => {
          const treatment = treatmentForRole[asset.role] || (index % 2 ? 'editorial' : 'documentary')
          const imageLayer: PlanOverlay = {
            ...heroImage,
            id: `${heroImage.id}-${asset.role}-${index}`,
            imageTreatment: treatment,
            textZone: index % 3 === 0 ? heroImage.textZone : index % 3 === 1 ? (heroImage.textZone === 'right' ? 'left' : 'right') : 'bottom',
            readabilityShade: treatment === 'documentary' ? .58 : treatment === 'duotone' ? .8 : .7,
            vignette: treatment === 'documentary' ? .2 : .38,
            locked: true,
            zIndex: -100,
          }
          const plan = {
            ...asset.plan,
            palette: treatment === 'duotone' ? 'graphite-gold' as PaletteId : 'brand-night' as PaletteId,
            paletteOverride: undefined,
            framing: treatment === 'documentary' ? 'full-bleed' as const : 'cinematic-crop' as const,
            layout: asset.role === 'linkedin' ? 'editorial-axis' as LayoutFamilyId : asset.role === 'quote' ? 'quote-stage' as LayoutFamilyId : asset.role === 'closing' ? 'hero-word' as LayoutFamilyId : 'cinematic-window' as LayoutFamilyId,
            overlays: [imageLayer, ...(asset.plan.overlays || []).filter((item) => item.imageRole !== 'background')],
            rationale: [`هذه القطعة فصل بصري مستقل في الحملة بمعالجة ${treatment}.`, ...(asset.plan.rationale || [])],
          }
          return { ...asset, plan }
        })
        const drafts = assets.map((asset) => asset.plan)
        const requalified = assets.map((asset) => ({ ...asset, plan: { ...asset.plan, quality: critiqueCompositionPlan(asset.plan, drafts.filter((peer) => peer.id !== asset.plan.id)) } }))
        const qualityScore = Math.round(requalified.reduce((sum, asset) => sum + (asset.plan.quality?.score || 0), 0) / Math.max(1, requalified.length))
        next = { ...next, assets: requalified, qualityScore, ready: next.ready && qualityScore >= 75 }
      }
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

  const exportAutoFinals = async () => {
    const candidates = [...autopilotPack.map((item) => item.plan), ...plans].filter(Boolean)
    const finalists = candidates
      .map((plan) => ({ plan, score: Math.round(((plan.quality?.score || 0) * .7) + predictEngagement(plan).score * .3) }))
      .sort((left, right) => right.score - left.score)
    const picked: CompositionPlan[] = []
    for (const candidate of finalists) {
      if (picked.every((item) => designSimilarity(item, candidate.plan) < .72)) picked.push(candidate.plan)
      if (picked.length === 3) break
    }
    if (!picked.length) {
      setNotice('لا توجد نسخ نهائية جاهزة للتصدير بعد.')
      return
    }
    setAutoFinalsBusy(true)
    try {
      for (const plan of picked) await downloadCompositionRaster(plan, 'png')
      setNotice(`نُزّلت ${picked.length} نسخ نهائية جاهزة للنشر — مختلفة حقًا لا تكرارًا شكليًا.`)
    } finally {
      setAutoFinalsBusy(false)
    }
  }

  const bestPlanForRelease = () => selected || autopilotPack[0]?.plan || plans[0] || null

  const scorePlan = (plan: CompositionPlan) => Math.round(((plan.quality?.score || 0) * .68) + predictEngagement(plan).score * .22 + plan.novelty * 10)

  const buildReleasePack = async (baseOverride?: CompositionPlan | null) => {
    const base = baseOverride || bestPlanForRelease()
    if (!base) {
      setNotice('ولّد اتجاهًا قويًا أولًا، ثم ابنِ حزمة النشر العليا.')
      return
    }
    setReleasePackBusy(true)
    try {
      const hero = base.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')
      const carryHero = (plan: CompositionPlan, treatment?: NonNullable<PlanOverlay['imageTreatment']>) => {
        if (!hero || !imagePassport) return plan
        return buildImageLedPlan(plan, treatment || hero.imageTreatment || 'cinematic', imagePassport, { source: hero.sourceUrl, owner: hero.owner, license: hero.license, description: hero.semanticDescription })
      }
      const finalPlan = carryHero(base, 'cinematic')
      const saferResult = regenerateFromPlan(base, {
        tone: 'formal',
        density: 'balanced',
        platform: 'linkedin',
        count: 4,
        seed: `safer:${base.id}:${Date.now()}`,
        history: loadHistory(),
        tasteProfile,
      })
      const viralResult = regenerateFromPlan(base, {
        tone: 'bold',
        density: 'minimal',
        platform: 'instagram',
        count: 4,
        seed: `viral:${base.id}:${Date.now()}`,
        history: loadHistory(),
        tasteProfile,
      })
      const saferPlan = saferResult.plans.map((plan) => carryHero(plan, 'editorial')).sort((a, b) => scorePlan(b) - scorePlan(a))[0] || finalPlan
      const viralPlan = viralResult.plans.map((plan) => carryHero(plan, 'cinematic')).sort((a, b) => scorePlan(b) - scorePlan(a))[0] || finalPlan
      const pack: ReleaseVariant[] = [
        { id: 'final', label: 'Final', note: 'النسخة المرجعية الأعلى اتزانًا للنشر الرسمي.', plan: finalPlan, score: scorePlan(finalPlan) },
        { id: 'safer', label: 'Safer', note: 'أهدأ وأكثر تحفظًا للجهات والمؤسسات والبيئات الحساسة.', plan: saferPlan, score: scorePlan(saferPlan) },
        { id: 'viral', label: 'Viral', note: 'أقوى نسخة للتوقف والانتشار البصري السريع.', plan: viralPlan, score: scorePlan(viralPlan) },
      ].sort((a, b) => b.score - a.score)
      setReleasePack(pack)
      setZeroDecision(null)
      setNotice('بُنيت الآن حزمة النشر العليا: Final / Safer / Viral — ثلاث نهايات تفهم سبب وجودها، لا نسخًا عشوائية.')
      return pack
    } finally {
      setReleasePackBusy(false)
    }
  }

  const exportReleasePack = async () => {
    if (!releasePack.length) {
      await buildReleasePack()
      return
    }
    setReleasePackBusy(true)
    try {
      for (const item of releasePack) await downloadCompositionRaster(item.plan, 'png')
      setNotice('نُزّلت حزمة Final / Safer / Viral كاملةً — جاهزة للاعتماد أو المقارنة المباشرة.')
    } finally {
      setReleasePackBusy(false)
    }
  }

  const runZeroDecisionMode = async () => {
    if (text.trim().length < 2) {
      setNotice('اكتب العنوان أولًا كي يتخذ النظام قرار النشر الكامل من الصفر.')
      textRef.current?.focus()
      return
    }
    setZeroDecisionBusy(true)
    try {
      let champion = bestPlanForRelease()
      if (!champion) {
        await runAutopilot()
        champion = bestPlanForRelease()
      }
      if (!champion) {
        setNotice('تعذر تكوين بطل بصري أولي. أعد المحاولة بعنوان أوضح.')
        return
      }
      const builtPack = await buildReleasePack(champion)
      const releaseBase = builtPack && builtPack.length ? builtPack : (releasePack.length ? releasePack : null)
      const computedPack = releaseBase || [
        { id: 'final' as const, label: 'Final', note: 'النسخة المرجعية الأعلى اتزانًا للنشر الرسمي.', plan: champion, score: scorePlan(champion) },
      ]
      const approved = [...computedPack].sort((a, b) => b.score - a.score)[0]
      runCampaign(text, context, approved.plan)
      const campaignText = approved.plan.content.original || text
      const quickCampaign = generateSocialCampaign({
        text: campaignText,
        context,
        author: 'د. أحمد حسين الفيلكاوي',
        tone,
        density,
        seed: `zero-decision:${approved.plan.id}:${Date.now()}`,
        history: loadHistory(),
        tasteProfile,
        basePlan: approved.plan,
        noveltyThreshold: .36,
      })
      const summary: ZeroDecisionSummary = {
        approved,
        campaignReady: quickCampaign.ready,
        campaignQuality: quickCampaign.qualityScore,
        note: approved.id === 'viral'
          ? 'اعتمد النظام النسخة الأعلى توقفًا لأنها الأكثر احتمالًا لصنع أثر سريع مع بقاء الحملة قابلة للبناء.'
          : approved.id === 'safer'
            ? 'اعتمد النظام النسخة الأكثر أمانًا لأن اتزانها ووضوحها تفوقا على جاذبية البدائل في هذا السياق.'
            : 'اعتمد النظام النسخة المرجعية لأنها الأكثر توازنًا بين الهيبة والقراءة وقوة التوقف.'
      }
      setZeroDecision(summary)
      if (!releasePack.length) setReleasePack(computedPack)
      setSelected(approved.plan)
      setStage('publish')
      setNotice('وضع القرار الصفري أنجز الدورة كاملة: اختار، وحسم، وبنى حزمة النشر، واقترح النسخة الأولى المعتمدة.')
    } finally {
      setZeroDecisionBusy(false)
    }
  }

  const runAutopilot = async () => {
    if (text.trim().length < 2) {
      setNotice('اكتب العنوان أولًا كي يبني الطيار الآلي خمس نهايات عالمية.')
      textRef.current?.focus()
      return
    }
    setAutopilotBusy(true)
    try {
      const parsed = parseStudioCommand(text)
      setCommandParse(parsed.understood.length ? parsed : null)
      const nextGeneration = generation + 1
      const localHistory = loadHistory()
      let passport = imagePassport
      let sourceMeta: { source?: string; owner?: string; license?: string; description?: string } | undefined = imagePassport
        ? { source: imageSource, owner: imageOwner, license: imageLicense, description: imageDescription }
        : undefined
      if (!passport) {
        let best = bestExternalVisual
        if (!best && hasInput) {
          try {
            const query = (externalQuery || visualSearchPlan.queries[0] || visualSearchPlan.headline).trim()
            const queryPlan = { ...visualSearchPlan, queries: [query, ...visualSearchPlan.queries.filter((item) => item !== query)] }
            const results = await searchExternalVisualSources(queryPlan, 12)
            if (results.length) {
              setExternalVisuals(results)
              best = results[0]
            }
          } catch { /* noop */ }
        }
        if (best?.imageUrl) {
          try {
            const analyzed = await analyzeStudioImageFromUrl(best.imageUrl, best.title)
            if (analyzed) {
              passport = analyzed
              sourceMeta = { source: best.pageUrl || best.imageUrl, owner: best.author, license: best.license, description: best.description || best.title }
              setImagePassport(analyzed)
              setImageDescription(sourceMeta.description || '')
              setImageSource(sourceMeta.source || '')
              setImageOwner(sourceMeta.owner || '')
              setImageLicense(sourceMeta.license || '')
            }
          } catch { /* يبقى الطيار الآلي يعمل حتى بلا صورة */ }
        }
      }
      const pool: AutoPilotCandidate[] = []
      for (const preset of AUTOPILOT_PRESETS) {
        let attempts = 0
        let winner: AutoPilotCandidate | null = null
        while (attempts < 2 && !winner) {
          const result = generateSocialDesigns({
            text: parsed.content,
            context: [context, parsed.contextHint].filter(Boolean).join(' · '),
            author: 'د. أحمد حسين الفيلكاوي',
            tone: preset.tone,
            density: preset.density,
            platform: preset.platform ?? (parsed.platform || platform),
            count: 8,
            seed: `autopilot:${preset.id}:${text}:${context}:${nextGeneration}:${Date.now()}:${attempts}`,
            history: localHistory,
            noveltyThreshold: .42,
            tasteProfile,
            preferLayout: preset.preferLayout,
          })
          const candidates = result.plans.map((plan) => {
            const withImage = passport && preset.imageTreatment ? buildImageLedPlan(plan, preset.imageTreatment, passport, sourceMeta) : plan
            const quality = critiqueCompositionPlan(withImage, result.plans.filter((peer) => peer.id !== plan.id))
            const enriched = { ...withImage, quality }
            const stop = predictEngagement(enriched)
            const worldScore = Math.round(quality.score * .62 + stop.score * .24 + enriched.novelty * 9 + (enriched.tasteAffinity || 0) * 5 + (passport ? 3 : 0))
            return { id: preset.id, label: preset.label, note: preset.note, plan: enriched, worldScore, qualityScore: quality.score, stopScore: stop.score }
          }).sort((left, right) => right.worldScore - left.worldScore)
          if (candidates[0]?.worldScore >= 85 || attempts === 1) winner = candidates[0] || null
          attempts += 1
        }
        if (winner) pool.push(winner)
      }
      const distinct: AutoPilotCandidate[] = []
      for (const candidate of pool.sort((left, right) => right.worldScore - left.worldScore)) {
        if (distinct.every((item) => designSimilarity(item.plan, candidate.plan) < .72)) distinct.push(candidate)
        if (distinct.length === 5) break
      }
      const finalPack = (distinct.length ? distinct : pool).slice(0, 5)
      const championPlans = finalPack.map((item, index) => ({
        ...item.plan,
        directionIndex: index + 1,
        directionLabel: `${item.label}`,
        rationale: [`نسخة الطيار الآلي: ${item.note}`, `تقييم عالمي ${item.worldScore}٪ · جودة داخلية ${item.qualityScore}٪ · قوة توقف ${item.stopScore}٪.`, ...(item.plan.rationale || []).slice(0, 3)],
      }))
      const triptych = selectDistinctTriptych(championPlans)
      setPlans(triptych)
      setReservePlans(championPlans.filter((plan) => !triptych.some((item) => item.id === plan.id)))
      setAutopilotPack(finalPack)
      setReleasePack([])
      setZeroDecision(null)
      setSelected(triptych[0] || null)
      setGeneration(nextGeneration)
      setStage('directions')
      remember(championPlans)
      setNotice(passport
        ? 'بنى الطيار الآلي خمس نهايات عالمية، اختار الصورة الأقوى تلقائيًا، وأعاد المحاولة عند ضعف النسخة حتى خرج بأفضل عرض.'
        : 'بنى الطيار الآلي خمس نهايات عالمية، وأعاد المحاولة داخليًا عند ضعف النسخة حتى رفع الجودة قدر الإمكان.')
    } finally {
      setAutopilotBusy(false)
    }
  }

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
              <p className="mt-3 max-w-3xl text-[.88rem] leading-loose text-soft">ابدأ بما يجب أن يشعر به الإنسان في أول ثانية. يفهم المخرج القصة، يفحص ثمانية احتمالات داخليًا، ثم يعرض ثلاث رؤى فنية متباعدة قابلة للتحرير والنشر.</p>
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
        <div className="relative mt-6"><StageRail stage={stage} onChange={setStage} /></div>

        {stage === 'idea' && <>
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

        {hasInput && (
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border border-accent/20 bg-accent/[.035] p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold text-accent">قراءة المخرج للقصة</p><h3 className="mt-1 text-[.95rem] font-bold text-ink">ليست قالبًا؛ هذه هي الحجة التي يجب أن تحملها الصورة.</h3></div><span className="rounded-full border border-accent/25 px-2.5 py-1 text-[.62rem] font-bold text-accent">ثقة {creativeBrief.confidence}٪</span></div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[['القضية المركزية', creativeBrief.issue], ['التوتر', creativeBrief.tension], ['جملة التوقف', creativeBrief.hook], ['الدليل الأقوى', creativeBrief.evidence], ['العاطفة', creativeBrief.emotion], ['الجمهور', creativeBrief.audience], ['ما يجب أن يبقى', creativeBrief.memory], ['ما يجب تجنبه', creativeBrief.avoid]].map(([label, value]) => <div key={label} className="rounded-xl border border-hair bg-canvas px-3 py-2.5"><dt className="text-[.62rem] font-semibold text-soft">{label}</dt><dd className="mt-1 text-[.73rem] leading-relaxed text-ink">{value}</dd></div>)}
              </dl>
              <p className="mt-3 rounded-xl border border-hair bg-canvas px-3 py-2.5 text-[.72rem] leading-relaxed text-ink"><strong className="text-accent">الحاجة البصرية:</strong> {creativeBrief.visualReason}</p>
            </section>
            <section className="rounded-2xl border border-hair bg-canvas p-4">
              <p className="text-[.68rem] font-bold text-accent">شخصية الهوية لهذه القطعة</p>
              <p className="mt-1 text-[.7rem] leading-relaxed text-soft">تُحفظ محليًا وتوجّه القرارات من دون تغيير هوية الموقع الأساسية.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-[.64rem] text-soft">الشخصية<select className={input} value={creativeIdentity.persona} onChange={(event) => setCreativeIdentity((value) => ({ ...value, persona: event.target.value as CreativeIdentity['persona'] }))}><option value="academic">د. أحمد الأكاديمي</option><option value="human">د. أحمد الإنساني</option><option value="media">د. أحمد الإعلامي</option><option value="future">د. أحمد المستقبلي</option><option value="book">إطلاق كتاب</option><option value="research">بحث علمي</option><option value="quote">اقتباس</option><option value="event">حدث</option></select></label>
                <label className="grid gap-1 text-[.64rem] text-soft">واقعية الصورة<select className={input} value={creativeIdentity.imageRealism} onChange={(event) => setCreativeIdentity((value) => ({ ...value, imageRealism: event.target.value as CreativeIdentity['imageRealism'] }))}><option value="documentary">وثائقية</option><option value="editorial">تحريرية</option><option value="abstract">تجريدية</option></select></label>
                <label className="grid gap-1 text-[.64rem] text-soft">الإضاءة<select className={input} value={creativeIdentity.lighting} onChange={(event) => setCreativeIdentity((value) => ({ ...value, lighting: event.target.value as CreativeIdentity['lighting'] }))}><option value="natural">طبيعية</option><option value="dramatic">درامية</option><option value="soft">ناعمة</option></select></label>
                <label className="grid gap-1 text-[.64rem] text-soft">المساحة السلبية<select className={input} value={creativeIdentity.negativeSpace} onChange={(event) => setCreativeIdentity((value) => ({ ...value, negativeSpace: event.target.value as CreativeIdentity['negativeSpace'] }))}><option value="generous">واسعة</option><option value="balanced">متوازنة</option><option value="compact">مضغوطة</option></select></label>
              </div>
              <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-[.68rem] leading-relaxed text-soft">{identityContext(creativeIdentity)}</p>
            </section>
          </div>
        )}

        {hasInput && (
          <section className="mt-4 rounded-2xl border border-hair bg-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold text-accent">ذكاء الصور · جواز الصورة</p><p className="mt-1 text-[.72rem] text-soft">يبدأ من مكتبة الموقع، ثم يبحث تلقائيًا في المصادر المجانية المفتوحة <strong className="text-ink">Wikimedia Commons</strong> و<strong className="text-ink">Pexels</strong> و<strong className="text-ink">Openverse</strong>. بعد الاختيار يُحلَّل القص ونقطة التركيز والمساحة الهادئة محليًا، ويُنشأ جواز صورة واضح بالمصدر والترخيص وسبب الاختيار.</p></div><label className={`${ghost} cursor-pointer`}><input type="file" accept="image/*" className="hidden" disabled={imageBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void runImagePassport(file); event.currentTarget.value = '' }} />{imageBusy ? 'يحلل الصورة…' : 'حمّل صورة مرشحة'}</label></div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-2xl border border-hair bg-paper/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">البحث البصري الذكي</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">يبني الاستوديو الاستعلام من القضية المركزية لا من كلمات عشوائية، ويقترح مصادر مجانية وموثقة أولًا.</p></div><button type="button" className={ghost} disabled={externalBusy} onClick={() => void runExternalSearch()}>{externalBusy ? 'يبحث…' : 'أعد البحث الآن'}</button></div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <input className={input} value={externalQuery || visualSearchPlan.queries[0] || ''} onChange={(event) => setExternalQuery(event.target.value)} placeholder="عبارة البحث البصري" />
                  <div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={() => void runExternalSearch(externalQuery || visualSearchPlan.queries[0])}>ابحث</button><button type="button" className={ghost} onClick={() => void copyGenerationPrompt()}>انسخ Prompt</button><button type="button" className={ghost} disabled={generatorBusy} onClick={() => void runGenerator()}>{generatorBusy ? 'يولّد…' : 'ولّد عند الحاجة'}</button></div>
                </div>
                <div className="mt-3 rounded-xl border border-hair bg-canvas px-3 py-3">
                  <p className="text-[.62rem] font-semibold text-soft">عبارات البحث المقترحة</p>
                  <div className="mt-2 flex flex-wrap gap-2">{visualSearchPlan.queries.slice(0, 6).map((query) => <button key={query} type="button" className="rounded-full border border-hair px-3 py-1.5 text-[.62rem] text-soft transition hover:border-accent hover:text-accent" onClick={() => { setExternalQuery(query); void runExternalSearch(query) }}>{query}</button>)}</div>
                  <p className="mt-3 text-[.64rem] leading-relaxed text-soft"><strong className="text-ink">منطق الاختيار:</strong> {visualSearchPlan.rationale}</p>
                  <p className="mt-2 text-[.62rem] leading-relaxed text-soft"><strong className="text-ink">تجنب:</strong> {visualSearchPlan.avoidTerms.slice(0, 3).join(' · ')}</p>
                </div>
                <div className="mt-3 rounded-xl border border-hair bg-canvas px-3 py-3">
                  <p className="text-[.62rem] font-semibold text-soft">Prompt التوليد البصري</p>
                  <textarea readOnly rows={4} className={`${input} mt-2 min-h-28 resize-y text-[.72rem] leading-relaxed`} value={visualSearchPlan.generationPrompt} />
                  <p className="mt-2 text-[.6rem] leading-relaxed text-soft">التوليد لا يحل محل الترخيص. عند عدم ربط مزود توليد يبقى هذا الـPrompt جاهزًا للنسخ أو للربط بخادمك لاحقًا.</p>
                </div>
                {externalError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.68rem] text-amber-900">{externalError}</p>}
              </section>
              <section className="rounded-2xl border border-hair bg-paper/60 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">المصادر المجانية المفعلة</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">Wikimedia Commons مفعّل. Pexels مفعّل بالمفتاح الحالي. {hasOpenverseProvider ? 'Openverse مفعّل أيضًا.' : 'Openverse سيظهر تلقائيًا عند توفر نتائج مناسبة.'}</p></div><div className="rounded-full border border-hair px-3 py-1.5 text-[.62rem] text-soft">{externalProviderLabels.length ? externalProviderLabels.join(' · ') : 'Wikimedia Commons'}</div></div>
                <div className="mt-3 grid gap-2 text-[.66rem] text-soft"><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">المسار</strong>مكتبتك أولًا → Wikimedia Commons → Pexels → Openverse → التوليد عند الحاجة فقط.</div><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">جواز الصورة</strong>يعرض المصدر، المالك، الترخيص، ولماذا اختيرت الصورة قبل إدخالها إلى اللوحة.</div><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">الاختيار الواعي</strong>تُفضَّل الصورة التي تترك مساحة عنوان وتتجنب الكليشيهات وتصلح للقص عبر المنصات.</div></div>
              </section>
            </div>
            {bestExternalVisual && <section className="mt-3 rounded-2xl border border-accent/15 bg-accent/[.035] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">المرشح الأقوى الآن</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">هذا الترشيح الأعلى صلةً من بين النتائج المجانية الحالية، ويصلح غالبًا للعنوان والقص عبر المنصات.</p></div><span className="rounded-full border border-accent/20 bg-white/70 px-3 py-1.5 text-[.62rem] font-semibold text-accent">درجة الملاءمة {bestExternalVisual.score}/99</span></div>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                <img src={bestExternalVisual.thumbnailUrl} alt={bestExternalVisual.title} className="aspect-[4/3] w-full rounded-2xl border border-hair object-cover" loading="lazy" />
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-[.86rem] text-ink">{bestExternalVisual.title}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{bestExternalVisual.providerLabel}</span><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{bestExternalVisual.orientation === 'landscape' ? 'أفقي' : bestExternalVisual.orientation === 'portrait' ? 'عمودي' : bestExternalVisual.orientation === 'square' ? 'مربع' : 'غير محدد'}</span></div>
                  <p className="text-[.68rem] leading-relaxed text-soft">{bestExternalVisual.description}</p>
                  <p className="text-[.62rem] leading-relaxed text-soft"><strong className="text-ink">سبب الترشيح:</strong> {bestExternalVisual.rationale}</p>
                  <div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => void applyExternalVisual(bestExternalVisual, 'cinematic')}>ابنِ المشهد مباشرة</button><button type="button" className={ghost} onClick={() => void applyExternalVisual(bestExternalVisual)}>حلّل الصورة فقط</button><a href={bestExternalVisual.pageUrl || bestExternalVisual.imageUrl} target="_blank" rel="noreferrer" className={ghost}>افتح المصدر</a></div>
                </div>
              </div>
            </section>}
            <details className="mt-3 rounded-xl border border-hair bg-paper/55"><summary className="cursor-pointer list-none px-4 py-3 text-[.7rem] font-semibold text-ink">مرشحات من مكتبة الموقع <span className="ms-2 font-normal text-soft">مرتبة دلاليًا بحسب الموضوع</span></summary><div className="mobile-card-rail flex snap-x snap-mandatory gap-2 overflow-x-auto border-t border-hair p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{libraryImages.map((item) => <button key={item.id} type="button" disabled={imageBusy} onClick={() => void runLibraryImage(item)} className="group w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-hair bg-canvas text-right transition hover:border-accent disabled:opacity-50"><img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /><span className="block px-2.5 py-2"><strong className="line-clamp-1 block text-[.65rem] text-ink group-hover:text-accent">{item.title}</strong><span className="mt-1 line-clamp-2 block text-[.58rem] leading-relaxed text-soft">{item.note}</span></span></button>)}</div></details>
            <details className="mt-3 rounded-xl border border-hair bg-paper/55" open={externalVisuals.length > 0}>
              <summary className="cursor-pointer list-none px-4 py-3 text-[.7rem] font-semibold text-ink">مرشحات خارجية مجانية <span className="ms-2 font-normal text-soft">مرتبة تلقائيًا من البحث البصري الذكي</span></summary>
              <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto border-t border-hair p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{externalBusy ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أبحث الآن في المصادر المجانية…</p> : externalVisuals.length ? externalVisuals.map((item, index) => <article key={item.id} className={`w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-canvas ${index === 0 ? 'border-accent/30 shadow-[0_16px_40px_rgba(17,41,75,.08)]' : 'border-hair'}`}><img src={item.thumbnailUrl} alt={item.title} className="aspect-[4/3] w-full object-cover" loading="lazy" /><div className="grid gap-2 p-3 text-right"><div className="flex items-start justify-between gap-2"><strong className="line-clamp-2 text-[.72rem] text-ink">{item.title}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{item.providerLabel}</span></div><div className="flex flex-wrap gap-2">{index === 0 ? <span className="rounded-full border border-accent/20 bg-accent/[.06] px-2 py-1 text-[.54rem] font-semibold text-accent">الأقوى الآن</span> : null}<span className="rounded-full border border-hair px-2 py-1 text-[.54rem] text-soft">{item.score}/99</span><span className="rounded-full border border-hair px-2 py-1 text-[.54rem] text-soft">{item.orientation === 'landscape' ? 'أفقي' : item.orientation === 'portrait' ? 'عمودي' : item.orientation === 'square' ? 'مربع' : 'غير محدد'}</span></div><p className="line-clamp-3 text-[.62rem] leading-relaxed text-soft">{item.description}</p><p className="text-[.58rem] leading-relaxed text-soft"><strong className="text-ink">لماذا اختيرت؟</strong> {item.rationale}</p><p className="text-[.56rem] text-soft">{item.author} · {item.license}</p><div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => void applyExternalVisual(item, index === 0 ? 'cinematic' : 'editorial')}>ابنِ بها</button><button type="button" className={ghost} onClick={() => void applyExternalVisual(item)}>حلّل</button><a href={item.pageUrl || item.imageUrl} target="_blank" rel="noreferrer" className={ghost}>المصدر</a></div></div></article>) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">لا توجد مرشحات خارجية بعد. اكتب الفكرة وسيبدأ البحث التلقائي، أو اضغط «أعد البحث الآن».</p>}</div>
            </details>
            {imagePassport ? <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-hair bg-paper"><img src={imagePassport.dataUrl} alt="معاينة الصورة المرشحة" className="aspect-square h-full w-full object-cover" /></div>
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-4"><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.width}×{imagePassport.height}</strong>الأبعاد</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.luminance}٪</strong>الإضاءة</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.contrast}٪</strong>التباين</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.edgeDensity}٪</strong>كثافة التفاصيل</span></div>
                <div className="grid gap-2 sm:grid-cols-2"><input className={input} value={imageDescription} onChange={(event) => setImageDescription(event.target.value)} placeholder="صف المشهد لاختبار الكليشيه" /><input className={input} value={imageSource} onChange={(event) => setImageSource(event.target.value)} placeholder="المصدر أو الرابط" /><input className={input} value={imageOwner} onChange={(event) => setImageOwner(event.target.value)} placeholder="المالك أو المصور" /><input className={input} value={imageLicense} onChange={(event) => setImageLicense(event.target.value)} placeholder="نوع الترخيص" /></div>
                <ul className="grid gap-1">{imagePassport.cropNotes.map((note) => <li key={note} className="text-[.69rem] leading-relaxed text-soft">— {note}</li>)}</ul>
                {clicheWarnings.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.7rem] leading-relaxed text-amber-900"><strong>تنبيه ضد الكليشيه:</strong> {clicheWarnings.map((item) => `${item.label}: ${item.alternative}`).join(' · ')}</div> : imageDescription && <p className="rounded-xl border border-accent/20 bg-accent/[.04] px-3 py-2 text-[.68rem] text-accent">لم يلتقط الفحص الوصفي أحد الكليشيهات الثمانية المعروفة. هذا فحص وصفي، لا حكم فني نهائي.</p>}
                <div className="grid gap-3"><div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={!selected} onClick={() => applyImageLedDirection('cinematic')}>مشهد سينمائي كامل</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('documentary')}>وثائقي إنساني</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('editorial')}>غلاف تحريري</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('duotone')}>ثنائي اللون فاخر</button><button type="button" className={ghost} disabled={!selected} onClick={() => addOverlay('image')}>أضفها كطبقة حرة</button></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-hair px-3 py-2 text-[.62rem] text-soft">المخرج يحدد منطقة النص من المساحة الهادئة ويثبت نقطة التركيز تلقائيًا.</span><span className="self-center text-[.62rem] text-soft">المصدر: {imageSource || 'غير مسجل'} · الترخيص: {imageLicense || 'غير مسجل'}</span></div></div>
              </div>
            </div> : <p className="mt-3 rounded-xl border border-dashed border-hair px-4 py-5 text-center text-[.72rem] text-soft">ابدأ بصورة من مكتبتك أو صور المقالات والفعاليات. لا تُرفع الصورة إلى أي خادم.</p>}
          </section>
        )}

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
          <div className="grid content-end gap-2 rounded-2xl border border-hair bg-canvas px-4 py-3"><span className="text-[.68rem] font-semibold text-soft">اختيار المخرج</span><strong className="text-[.82rem] text-ink">8 احتمالات ← 3 رؤى متباعدة</strong></div>
          <div className="grid gap-2 md:grid-cols-4"><button type="button" className={`${primary} w-full px-8`} onClick={() => generate()}>ابنِ ثلاث رؤى فنية</button><button type="button" className={`${ghost} w-full`} onClick={() => void runAutopilot()} disabled={autopilotBusy}>{autopilotBusy ? 'يبني النهايات العالمية…' : 'الطيار الآلي العالمي'}</button><button type="button" className={`${ghost} w-full`} onClick={() => void buildReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'يبني الحزمة العليا…' : 'Final / Safer / Viral'}</button><button type="button" className={`${ghost} w-full`} onClick={() => void runZeroDecisionMode()} disabled={zeroDecisionBusy}>{zeroDecisionBusy ? 'يحسم القرار الكامل…' : 'وضع القرار الصفري'}</button></div>
        </div>
        {notice && <p className="mt-5 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}
        </>}
        {stage !== 'idea' && notice && <p className="mt-5 rounded-2xl border border-accent/25 bg-accent/[.05] px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}
      </section>

      {plans.length > 0 && stage !== 'idea' && stage !== 'publish' && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.72rem] font-bold uppercase tracking-[.16em] text-accent">Creative directions</p>
              <h3 className="mt-1 font-display text-2xl font-bold text-ink">ليست قوالب؛ هذه اتجاهات تكوين.</h3>
              <p className="mt-2 text-[.8rem] leading-relaxed text-soft">ثلاث رؤى مختلفة في الشعور والمنطق البصري؛ المحرك احتفظ بـ{reservePlans.length} بدائل داخلية من دون تلويث الواجهة.</p>
              {autopilotPack.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{autopilotPack.map((item) => <span key={item.id} className="rounded-full border border-accent/20 bg-accent/[.05] px-3 py-1.5 text-[.66rem] font-semibold text-accent">{item.label} {item.worldScore}٪</span>)}</div>}
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
            <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-full border border-hair bg-canvas px-3 py-2 text-[.7rem] text-soft">حد التصدير <input aria-label="حد جودة التصدير" className="w-14 bg-transparent text-center font-bold text-accent outline-none" type="number" min="70" max="98" value={qualityThreshold} onChange={(event) => { const next=Math.max(70,Math.min(98,Number(event.target.value)||82)); setQualityThreshold(next); localStorage.setItem(QUALITY_THRESHOLD_KEY,String(next)) }} />٪</label><span className="rounded-full border border-accent/25 bg-accent/[.05] px-4 py-2 text-[.72rem] font-semibold text-accent">لجنة الجودة {Math.round(plans.reduce((sum, plan) => sum + (plan.quality?.score || 0), 0) / plans.length)}٪</span><span className="rounded-full border border-hair px-4 py-2 text-[.72rem] text-soft">ذاكرة ذوقك {Object.keys(tasteLedger).length} اتجاه</span>{Object.keys(tasteLedger).length > 0 && <button type="button" className={ghost} onClick={resetTaste}>إعادة ضبط الذوق</button>}<button type="button" className={ghost} onClick={() => void runAutopilot()} disabled={autopilotBusy}>{autopilotBusy ? 'يعيد بناء الأفضل…' : 'أعد بناء 5 نهايات'}</button><button type="button" className={ghost} onClick={() => void buildReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'يبني الحزمة العليا…' : 'ابنِ Final / Safer / Viral'}</button><button type="button" className={ghost} onClick={() => void runZeroDecisionMode()} disabled={zeroDecisionBusy}>{zeroDecisionBusy ? 'يحسم القرار…' : 'القرار الصفري'}</button><button type="button" className={ghost} onClick={() => void exportAutoFinals()} disabled={autoFinalsBusy || (!autopilotPack.length && !plans.length)}>{autoFinalsBusy ? 'يصدر النهائيات…' : 'صدّر 3 نهائيات'}</button><button type="button" className={primary} disabled={campaignBusy} onClick={() => { buildCampaign(); setStage('publish') }}>{campaignBusy ? 'يبني الحملة…' : 'حوّلها إلى حملة سردية'}</button><button type="button" className={ghost} onClick={() => setShowSaved((value) => !value)}>المحفوظة {savedPlans.length}</button><button type="button" className={ghost} onClick={() => generate()}>توليد دفعة مختلفة</button></div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {artDirections.map((direction, index) => <article key={direction.id} className="rounded-2xl border border-hair bg-canvas p-4"><div className="flex items-start justify-between gap-3"><div><span className="text-[.62rem] font-bold text-accent">الرؤية {index + 1}</span><h4 className="mt-1 text-[.9rem] font-bold text-ink">{direction.title}</h4></div><span className="rounded-full bg-paper px-2 py-1 text-[.62rem] font-semibold text-accent">قرب الهوية {direction.identityFit}٪</span></div><p className="mt-2 text-[.72rem] leading-relaxed text-soft">{direction.description}</p><dl className="mt-3 grid gap-2"><div><dt className="text-[.6rem] font-semibold text-soft">الشعور</dt><dd className="text-[.68rem] text-ink">{direction.feeling}</dd></div><div><dt className="text-[.6rem] font-semibold text-soft">الصورة المطلوبة</dt><dd className="text-[.68rem] leading-relaxed text-ink">{direction.imageNeed}</dd></div><div><dt className="text-[.6rem] font-semibold text-soft">الخطر</dt><dd className="text-[.68rem] leading-relaxed text-ink">{direction.risk}</dd></div></dl><button type="button" className={`${ghost} mt-3 w-full`} onClick={() => generate({ tone: direction.tone, platform: direction.platform, preferLayout: direction.preferLayout })}>أعد بناء هذه الرؤية</button></article>)}
          </div>
          {autopilotPack.length > 0 && <div className="mt-4 grid gap-3 xl:grid-cols-5 md:grid-cols-2"><div className="rounded-2xl border border-accent/20 bg-accent/[.04] p-4 xl:col-span-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.68rem] font-bold uppercase tracking-[.16em] text-accent">Creative Director Autopilot</p><h4 className="mt-1 text-[1rem] font-bold text-ink">خمس نهايات لا خمس محاولات عشوائية.</h4><p className="mt-1 text-[.72rem] leading-relaxed text-soft">الطيار الآلي يبني خمس نسخ نهائية: آمنة، تحريرية، فاخرة، عالية التوقف، ونسخة دليل — ثم يختار منها الأجدر بالعرض، ويستطيع الآن تصدير أفضل 3 نهائيات بضغطة واحدة.</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-accent/20 bg-white/70 px-3 py-1.5 text-[.66rem] font-semibold text-accent">الأفضل الآن {autopilotPack[0]?.label || '—'} · {autopilotPack[0]?.worldScore || 0}٪</span><button type="button" className={ghost} onClick={() => void exportAutoFinals()} disabled={autoFinalsBusy}>{autoFinalsBusy ? 'يصدر النهائيات…' : 'تنزيل أفضل 3'}</button></div></div></div>{autopilotPack.map((item) => <article key={item.id} className="rounded-2xl border border-hair bg-canvas p-3"><div className="flex items-center justify-between gap-2"><strong className="text-[.76rem] text-ink">{item.label}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.58rem] text-soft">{item.worldScore}٪</span></div><p className="mt-2 text-[.66rem] leading-relaxed text-soft">{item.note}</p><div className="mt-2 flex flex-wrap gap-1.5 text-[.58rem] text-soft"><span className="rounded-full border border-hair px-2 py-1">جودة {item.qualityScore}٪</span><span className="rounded-full border border-hair px-2 py-1">توقف {item.stopScore}٪</span></div><button type="button" className={`${ghost} mt-3 w-full`} onClick={() => { setSelected(item.plan); setStage('edit') }}>افتح هذه النسخة</button></article>)}</div>}
          {releasePack.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-accent/20 bg-accent/[.04] p-4 md:col-span-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.68rem] font-bold uppercase tracking-[.16em] text-accent">Absolute Release Pack</p><h4 className="mt-1 text-[1rem] font-bold text-ink">ثلاث نسخ لا يحتاج بعدها الفريق إلى سؤال: ماذا ننشر؟</h4><p className="mt-1 text-[.72rem] leading-relaxed text-soft">هذه الحزمة ليست تبديلًا سطحيًا؛ كل نسخة بُنيت لوظيفة نشر مختلفة: المرجع الرسمي، النسخة الأكثر أمانًا، والنسخة الأعلى قابلية للتوقف والانتشار.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={() => void buildReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'يعيد بناء الحزمة…' : 'أعد بناء الحزمة'}</button><button type="button" className={primary} onClick={() => void exportReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'ينزّل الحزمة…' : 'تنزيل Final / Safer / Viral'}</button></div></div></div>{releasePack.map((item) => <article key={item.id} className="rounded-2xl border border-hair bg-canvas p-3"><button type="button" className="block w-full text-right" onClick={() => { setSelected(item.plan); setStage('edit') }}><Preview plan={item.plan} /></button><div className="pt-3"><div className="flex items-center justify-between gap-2"><strong className="text-[.8rem] text-ink">{item.label}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.58rem] text-soft">{item.score}٪</span></div><p className="mt-2 text-[.66rem] leading-relaxed text-soft">{item.note}</p><div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => { setSelected(item.plan); setStage('edit') }}>فتح</button><button type="button" className={ghost} onClick={() => void exportPlan(item.plan, 'png')}>PNG</button></div></div></article>)}</div>}
          {zeroDecision && <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold uppercase tracking-[.16em] text-emerald-700">Zero-Decision Mode</p><h4 className="mt-1 text-[1rem] font-bold text-ink">النظام حسم قرار النشر بدلًا عنك.</h4><p className="mt-1 max-w-3xl text-[.74rem] leading-relaxed text-soft">{zeroDecision.note}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">النسخة المعتمدة: {zeroDecision.approved.label}</span><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">درجة النسخة {zeroDecision.approved.score}٪</span><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">الحملة {zeroDecision.campaignQuality}٪</span></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => { setSelected(zeroDecision.approved.plan); setStage('edit') }}>افتح النسخة المعتمدة</button><button type="button" className={ghost} onClick={() => void exportPlan(zeroDecision.approved.plan, 'png')}>تنزيل النسخة المعتمدة</button><button type="button" className={ghost} onClick={() => void exportReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'ينزّل الحزمة…' : 'تنزيل الحزمة كاملة'}</button><span className={`rounded-full px-3 py-2 text-[.66rem] font-semibold ${zeroDecision.campaignReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{zeroDecision.campaignReady ? 'الحملة جاهزة مبدئيًا' : 'الحملة تحتاج مراجعة نهائية'}</span></div></section>}
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-hair bg-canvas p-3"><span className="me-auto text-[.68rem] font-semibold text-soft">مفاتيح إبداع غير عادية:</span><button type="button" className={ghost} onClick={() => { setNotice('أبتعد عن تاريخك البصري بمقدار مضبوط مع إبقاء الهوية.'); generate({ tone: 'bold', preferLayout: 'quiet-orbit' }) }}>اكسر ذوقي بذكاء</button><button type="button" className={ghost} onClick={() => generate({ tone: 'human', density: 'minimal', preferLayout: 'human-note' })}>لا تجعلها تبدو مصممة</button><button type="button" className={ghost} onClick={() => generate({ tone: 'deep', density: 'minimal', preferLayout: 'cinematic-window' })}>التصميم الصامت</button></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="group grid content-start gap-3 rounded-[1.4rem] border border-hair bg-canvas p-3 transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
                <button type="button" className="block w-full text-right" onClick={() => { setStage('edit'); setSelected(plan) }} aria-label={`افتح ${plan.directionLabel}`}><Preview plan={plan} /></button>
                <div className="px-1 pb-1">
                  <div className="flex items-start justify-between gap-3"><div><strong className="block text-[.82rem] text-ink">{plan.directionLabel}</strong><span className="mt-1 block text-[.68rem] text-soft">{plan.format.label}</span></div><div className="flex flex-col items-end gap-1"><span className="rounded-full bg-paper px-2 py-1 text-[.64rem] font-semibold text-accent">تقييم داخلي {plan.quality?.score || 0}٪</span><span className="text-[.62rem] text-soft">{Math.round(plan.novelty * 100)}٪ جديد</span></div></div>
                  <p className="mt-2 line-clamp-2 text-[.72rem] leading-relaxed text-soft">{plan.rationale.join(' · ')}</p>
                  <div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => { setStage('edit'); setSelected(plan) }}>تكبير وتعديل</button><button type="button" className={ghost} onClick={() => void exportPlan(plan, 'png')}>PNG</button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}


      {campaign && stage === 'publish' && (
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
                <button type="button" className="block w-full text-right" onClick={() => { setStage('edit'); setSelected(asset.plan) }}><Preview plan={asset.plan} /></button>
                <div className="px-1 pt-3"><strong className="block text-[.8rem] text-ink">{asset.label}</strong><p className="mt-1 text-[.68rem] leading-relaxed text-soft">{asset.purpose}</p><div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => { setStage('edit'); setSelected(asset.plan) }}>فتح</button><button type="button" className={ghost} onClick={() => void exportPlan(asset.plan, 'png')}>PNG</button></div></div>
              </article>
            ))}
          </div>
        </section>
      )}

      {showSaved && savedPlans.length > 0 && (
        <section className={card} aria-labelledby="saved-social-designs-title">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">Saved directions</p><h3 id="saved-social-designs-title" className="mt-1 font-display text-2xl font-bold text-ink">نسخك المختارة</h3></div><button type="button" className={ghost} onClick={() => setShowSaved(false)}>إخفاء</button></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {savedPlans.map((plan) => <button key={plan.fingerprint} type="button" onClick={() => { setStage('edit'); setSelected(plan) }} className="rounded-[1.3rem] border border-hair bg-canvas p-3 text-right transition hover:border-accent/40 hover:shadow-lg"><Preview plan={plan} /><strong className="mt-3 block text-[.78rem] text-ink">{plan.directionLabel}</strong><span className="mt-1 block text-[.66rem] text-soft">{plan.format.label}</span></button>)}
          </div>
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/70 p-0 backdrop-blur-md md:p-3" role="dialog" aria-modal="true" aria-label="محرر التصميم">
          {/* المحرر سطحٌ فاتحٌ ثابت مهما كان وضع الموقع (فاتح/داكن): كان الوضع
             الداكن يقلب النصوص إلى أزرق/رمادي باهت فلا يُقرأ («ما أدري شنو مكتوب»).
             نُثبّت متغيّرات اللون على قيم الوضع الفاتح داخل المحرر فقط. */}
          <div
            className="flex h-[100dvh] max-h-none w-full max-w-[1800px] flex-col overflow-hidden rounded-none border border-black/10 shadow-2xl md:h-[calc(100dvh-1.5rem)] md:rounded-[2rem]"
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
            <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hair px-3 py-2.5 md:px-6 md:py-3">
              <div className="min-w-0"><p className="text-[.58rem] font-bold uppercase tracking-[.12em] text-accent md:text-[.64rem] md:tracking-[.16em]">المرحلة 03 · التحرير</p><h3 className="mt-1 truncate font-display text-[1rem] font-bold text-ink md:text-2xl">{selected.directionLabel}</h3></div>
              <div className="hidden flex-wrap items-center gap-2 md:flex"><button type="button" className={ghost} onClick={() => { setSelected(null); setStage('directions') }}>الاتجاهات</button><button type="button" className={primary} onClick={() => { buildCampaign(); setSelected(null); setStage('publish') }}>إلى النشر</button><button type="button" className={ghost} onClick={() => setSelected(null)}>إغلاق</button></div>
              <div className="flex items-center gap-1.5 md:hidden">
                <button type="button" onClick={() => { setSelected(null); setStage('directions') }} className="rounded-full border border-hair bg-canvas px-2.5 py-1.5 text-[.62rem] font-semibold text-soft">الاتجاهات</button>
                <button type="button" onClick={() => { buildCampaign(); setSelected(null); setStage('publish') }} className="rounded-full bg-accent px-3 py-1.5 text-[.62rem] font-bold text-white">النشر</button>
                <button type="button" aria-label="إغلاق المحرر" onClick={() => setSelected(null)} className="grid h-8 w-8 place-items-center rounded-full border border-hair bg-canvas text-base leading-none text-soft">×</button>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-3 gap-1 border-b border-hair bg-paper/90 p-1.5 lg:hidden" role="tablist" aria-label="أقسام محرر الهاتف">
              {([
                ['preview', 'المعاينة'],
                ['layers', 'الطبقات'],
                ['properties', 'التحرير'],
              ] as const).map(([panel, label]) => <button key={panel} type="button" role="tab" aria-selected={mobileEditorPanel === panel} onClick={() => setMobileEditorPanel(panel)} className={`rounded-xl px-2 py-2 text-[.68rem] font-semibold transition ${mobileEditorPanel === panel ? 'bg-accent text-white shadow-sm' : 'text-soft hover:bg-canvas hover:text-accent'}`}>{label}</button>)}
            </div>
            {/* ثلاث مناطق مستقلة: الطبقات يميناً، اللوحة في الوسط، الخصائص يساراً.
                ارتفاع النافذة محسوب من 100dvh لذلك لا تُقصّ المعاينة على Desktop. */}
            <div className="grid min-h-0 flex-1 gap-2 overflow-hidden p-2 md:gap-3 md:p-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]" dir="rtl">
              <aside className={`${mobileEditorPanel === 'layers' ? 'grid' : 'hidden'} min-h-0 content-start gap-3 overflow-y-auto rounded-[1.25rem] border border-hair bg-canvas p-3 lg:grid lg:max-h-full`} aria-label="لوحة الطبقات">
                <div className="flex items-center justify-between gap-2"><div><p className="text-[.7rem] font-bold text-accent">الطبقات</p><p className="mt-1 text-[.62rem] text-soft">ترتيب، قفل، محاذاة، أقنعة وصور.</p></div><button type="button" onClick={() => setFreeMode((value) => !value)} className={`rounded-full px-2.5 py-1 text-[.62rem] font-semibold ${freeMode ? 'bg-accent text-white' : 'border border-hair text-soft'}`}>{freeMode ? 'السحب فعّال' : 'فعّل السحب'}</button></div>
                <div className="flex flex-wrap gap-1.5"><button type="button" className={ghost} onClick={() => addOverlay('text')}>نص</button><button type="button" className={ghost} onClick={() => addOverlay('rule')}>خط</button><button type="button" className={ghost} onClick={() => addOverlay('circle')}>دائرة</button><button type="button" className={ghost} onClick={() => addOverlay('rect')}>إطار</button><button type="button" className={ghost} onClick={() => addOverlay('image')}>صورة</button></div>
                {selectedOverlayIds.length > 0 && <div className="rounded-xl border border-hair bg-paper p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[.62rem] font-semibold text-soft">{selectedOverlayIds.length} محددة</span><button type="button" className="text-[.6rem] text-soft hover:text-accent" onClick={() => setSelectedOverlayIds([])}>إلغاء التحديد</button></div><div className="mt-2 flex flex-wrap gap-1"><button type="button" className={ghost} onClick={groupSelectedOverlays}>تجميع</button><button type="button" className={ghost} onClick={ungroupSelectedOverlays}>فك المجموعة</button><button type="button" className={ghost} onClick={() => distributeSelectedOverlays('x')}>توزيع أفقي</button><button type="button" className={ghost} onClick={() => distributeSelectedOverlays('y')}>توزيع رأسي</button><button type="button" className={ghost} disabled={!overlayStyleClipboard} onClick={pasteOverlayStyle}>ألصق النمط</button></div></div>}
                <div className="grid gap-2">{(selected.overlays || []).length ? [...(selected.overlays || [])].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0)).map((overlay) => <div key={overlay.id} className={`rounded-xl border p-2.5 ${activeOverlay === overlay.id ? 'border-accent bg-accent/[.04]' : selectedOverlayIds.includes(overlay.id) ? 'border-accent/40 bg-accent/[.02]' : 'border-hair bg-paper'}`}><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" aria-label="تحديد الطبقة" checked={selectedOverlayIds.includes(overlay.id)} onChange={() => toggleOverlaySelection(overlay.id)} className="accent-current" /><button type="button" className="min-w-0 flex-1 truncate text-right text-[.68rem] font-semibold text-ink" onClick={() => { setActiveOverlay(overlay.id); setSelectedOverlayIds((current) => current.includes(overlay.id) ? current : [overlay.id]); setFreeMode(true) }}>{overlay.kind === 'text' ? String(overlay.text || 'نص').slice(0,22) : overlay.kind === 'image' ? `صورة: ${overlay.name || 'مرشحة'}` : overlay.kind === 'rule' ? 'خط' : overlay.kind === 'circle' ? 'دائرة' : 'إطار'}</button></div><button type="button" className="text-[.62rem] text-soft hover:text-red-500" onClick={() => removeOverlay(overlay.id)}>حذف</button></div>{activeOverlay === overlay.id && <div className="mt-2 grid gap-2"><div className="flex flex-wrap gap-1"><button type="button" className={ghost} onClick={() => moveOverlayLayer(overlay.id, 1)}>للأمام</button><button type="button" className={ghost} onClick={() => moveOverlayLayer(overlay.id, -1)}>للخلف</button><button type="button" className={ghost} onClick={() => duplicateOverlay(overlay)}>نسخ</button><button type="button" className={ghost} onClick={() => copyOverlayStyle(overlay)}>نسخ النمط</button><button type="button" className={ghost} onClick={() => patchOverlay(overlay.id, { locked: !overlay.locked })}>{overlay.locked ? 'فك القفل' : 'قفل'}</button></div><div className="grid grid-cols-3 gap-1">{(['right','center','left','top','middle','bottom'] as const).map((target) => <button key={target} type="button" className="rounded-lg border border-hair px-1 py-1 text-[.58rem] text-soft hover:border-accent hover:text-accent" onClick={() => alignOverlay(overlay.id, target)}>{({right:'يمين',center:'وسط أفقي',left:'يسار',top:'أعلى',middle:'وسط رأسي',bottom:'أسفل'} as const)[target]}</button>)}</div><label className="grid gap-1 text-[.6rem] text-soft">دوران<input type="range" min="-180" max="180" value={overlay.rotation || 0} onChange={(event) => patchOverlay(overlay.id, { rotation: Number(event.target.value) })} /></label><label className="grid gap-1 text-[.6rem] text-soft">شفافية<input type="range" min="5" max="100" value={Math.round(overlay.opacity*100)} onChange={(event) => patchOverlay(overlay.id, { opacity:Number(event.target.value)/100 })} /></label>{overlay.kind === 'image' && <><label className="grid gap-1 text-[.6rem] text-soft">دور الصورة<select className={input} value={overlay.imageRole || 'foreground'} onChange={(event) => patchOverlay(overlay.id,{ imageRole:event.target.value as PlanOverlay['imageRole'], x:event.target.value === 'background' ? 0 : overlay.x, y:event.target.value === 'background' ? 0 : overlay.y, width:event.target.value === 'background' ? 1 : overlay.width, height:event.target.value === 'background' ? 1 : overlay.height, mask:event.target.value === 'background' ? 'none' : overlay.mask })}><option value="foreground">طبقة حرة</option><option value="background">صورة بطولية كاملة</option></select></label>{overlay.imageRole === 'background' && <><label className="grid gap-1 text-[.6rem] text-soft">المعالجة<select className={input} value={overlay.imageTreatment || 'cinematic'} onChange={(event) => patchOverlay(overlay.id,{ imageTreatment:event.target.value as PlanOverlay['imageTreatment']})}><option value="cinematic">سينمائية</option><option value="documentary">وثائقية</option><option value="editorial">تحريرية</option><option value="duotone">ثنائية اللون</option><option value="none">طبيعية</option></select></label><label className="grid gap-1 text-[.6rem] text-soft">منطقة النص<select className={input} value={overlay.textZone || 'right'} onChange={(event) => patchOverlay(overlay.id,{ textZone:event.target.value as PlanOverlay['textZone']})}><option value="right">يمين</option><option value="left">يسار</option><option value="top">أعلى</option><option value="bottom">أسفل</option><option value="center">وسط</option></select></label><label className="grid gap-1 text-[.6rem] text-soft">قوة التعتيم<input type="range" min="10" max="95" value={Math.round((overlay.readabilityShade ?? .72)*100)} onChange={(event)=>patchOverlay(overlay.id,{readabilityShade:Number(event.target.value)/100})}/></label><label className="grid gap-1 text-[.6rem] text-soft">الحواف السينمائية<input type="range" min="0" max="80" value={Math.round((overlay.vignette ?? .34)*100)} onChange={(event)=>patchOverlay(overlay.id,{vignette:Number(event.target.value)/100})}/></label></>}<label className="grid gap-1 text-[.6rem] text-soft">الدمج<select className={input} value={overlay.blendMode || 'normal'} onChange={(event) => patchOverlay(overlay.id,{ blendMode:event.target.value as PlanOverlay['blendMode']})}><option value="normal">عادي</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="soft-light">Soft Light</option><option value="luminosity">Luminosity</option></select></label><label className="grid gap-1 text-[.6rem] text-soft">القناع<select className={input} value={overlay.mask || 'rounded'} onChange={(event) => patchOverlay(overlay.id,{ mask:event.target.value as PlanOverlay['mask']})}><option value="none">بدون</option><option value="rounded">مستدير</option><option value="circle">دائري</option></select></label><label className="grid gap-1 text-[.6rem] text-soft">نقطة التركيز أفقياً<input type="range" min="0" max="100" value={Math.round((overlay.focalX ?? .5)*100)} onChange={(event)=>patchOverlay(overlay.id,{focalX:Number(event.target.value)/100})}/></label><label className="grid gap-1 text-[.6rem] text-soft">نقطة التركيز رأسياً<input type="range" min="0" max="100" value={Math.round((overlay.focalY ?? .5)*100)} onChange={(event)=>patchOverlay(overlay.id,{focalY:Number(event.target.value)/100})}/></label><div className="rounded-lg border border-hair bg-canvas px-2.5 py-2 text-[.58rem] leading-relaxed text-soft"><strong className="block text-ink">جواز الصورة</strong>{overlay.owner || 'مالك غير مسجل'} · {overlay.license || 'ترخيص غير مسجل'}{overlay.sourceUrl && <span dir="ltr" className="mt-1 block truncate text-accent">{overlay.sourceUrl}</span>}</div></>}</div>}</div>) : <p className="rounded-xl border border-dashed border-hair p-4 text-center text-[.65rem] leading-relaxed text-soft">لا طبقات إضافية. التصميم الأساسي محفوظ كما هو.</p>}</div>
              </aside>
              <div className={`${mobileEditorPanel === 'preview' ? 'grid' : 'hidden'} min-h-0 content-center justify-items-center overflow-hidden rounded-[1.25rem] border border-hair bg-canvas p-2.5 md:p-4 lg:grid lg:max-h-full`}>
                {/* «أرني كما يراه المتابع» (النقطة ٢٠) + «خريطة الانتباه» (النقطة ٨) */}
                <div className="mb-2 flex w-full items-center justify-between gap-2 md:mb-3">
                  <span className="text-[.64rem] font-semibold text-soft md:text-[.66rem]">{phoneView ? 'كما يراه المتابع' : 'المعاينة الكاملة'}</span>
                  <div className="flex items-center gap-1.5 md:flex-wrap md:gap-2">
                    {professionalCheckOpen && <button type="button" onClick={() => setAttentionOn((value) => !value)} disabled={phoneView} title="محاكاة بصرية تقديرية وليست تتبع عين بشرياً" className={`rounded-full px-3 py-1 text-[.66rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${attentionOn && !phoneView ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>{attentionOn ? 'إخفاء مسار الانتباه' : 'محاكاة مسار الانتباه'}</button>}
                    <button type="button" onClick={() => setPhoneView((value) => !value)} className={`rounded-full px-3 py-1 text-[.66rem] font-semibold transition ${phoneView ? 'bg-accent text-white' : 'border border-hair text-soft hover:border-accent hover:text-accent'}`}>{phoneView ? '✓ عرض الاستوديو' : '📱 أرني كما يراه المتابع'}</button>
                  </div>
                </div>
                {attentionOn && attention && !phoneView && (
                  <div className="mb-3 w-full rounded-xl border border-accent/25 bg-accent/[.06] px-3 py-2">
                    <p className="text-[.68rem] leading-relaxed text-ink/85">{attention.summary}</p>
                    <p className="mt-1 text-[.62rem] text-soft">توازن المحاكاة البصرية: <strong className="text-accent">{attention.balance}٪</strong> — {attention.balance >= 78 ? 'موزّعٌ ناضج' : attention.balance >= 60 ? 'مقبول' : 'مركّزٌ في بؤرةٍ واحدة'}</p>
                  </div>
                )}
                {phoneView && (
                  <div className="social-editor-phone-preview mx-auto w-full" style={{ '--preview-ratio': selected.format.width / selected.format.height } as CSSProperties}>
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
                <div ref={canvasRef} className={`social-editor-canvas relative mx-auto w-full ${phoneView ? 'hidden' : ''}`} style={{ '--preview-ratio': selected.format.width / selected.format.height, touchAction: freeMode ? 'none' : undefined } as CSSProperties}>
                  <Preview plan={selected} className="w-full" />
                  {attention && <AttentionOverlay map={attention} w={selected.format.width} h={selected.format.height} />}
                  {freeMode && activeGuides.x != null && <span aria-hidden className="pointer-events-none absolute inset-y-0 z-30 w-px bg-accent/70" style={{ left: `${activeGuides.x * 100}%` }} />}
                  {freeMode && activeGuides.y != null && <span aria-hidden className="pointer-events-none absolute inset-x-0 z-30 h-px bg-accent/70" style={{ top: `${activeGuides.y * 100}%` }} />}
                  {freeMode && (selected.overlays || []).map((overlay) => (
                    <div
                      key={overlay.id}
                      onPointerDown={(event) => beginDrag(event, overlay, 'move')}
                      className={`absolute cursor-move rounded-md border-2 border-dashed transition-colors ${activeOverlay === overlay.id ? 'border-accent bg-accent/10' : selectedOverlayIds.includes(overlay.id) ? 'border-accent/70 bg-accent/[.04]' : 'border-accent/35 hover:border-accent/70'}`}
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
                <div className="mt-2 grid w-full grid-cols-2 gap-2 lg:hidden">
                  <button type="button" onClick={() => setMobileEditorPanel('properties')} className="rounded-xl border border-hair bg-paper px-3 py-2 text-[.68rem] font-semibold text-ink">حرّر النص والألوان</button>
                  <button type="button" onClick={() => setMobileEditorPanel('layers')} className="rounded-xl border border-hair bg-paper px-3 py-2 text-[.68rem] font-semibold text-ink">الطبقات والعناصر</button>
                </div>
              </div>
              <div className={`${mobileEditorPanel === 'properties' ? 'grid' : 'hidden'} min-h-0 content-start gap-3 overflow-y-auto pb-5 lg:grid lg:max-h-full lg:gap-4 lg:pl-1`} aria-label="خصائص التصميم">
                <button type="button" onClick={() => setProfessionalCheckOpen((value) => !value)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-right transition ${professionalCheckOpen ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-ink hover:border-accent'}`}><span><strong className="block text-[.74rem]">فحص احترافي</strong><span className="mt-1 block text-[.64rem] opacity-75">تقييم داخلي ومحاكاة تقديرية؛ ليست بيانات نشر فعلية ولا تتبع عين بشرياً.</span></span><span aria-hidden>{professionalCheckOpen ? '−' : '+'}</span></button>
                <div className={professionalCheckOpen ? 'grid gap-4' : 'hidden'}>
                <section className="rounded-2xl border border-accent/30 bg-accent/[.09] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold text-accent">تقييم داخلي للتكوين</p><p className="mt-1 text-[.72rem] text-ink/60">قواعد محلية للتباين والقراءة والتوازن؛ ليست اختباراً بشرياً.</p></div><strong className="font-display text-3xl text-accent">{selected.quality?.score || 0}٪</strong></div><div className="mt-3 flex flex-wrap gap-2">{selected.quality?.strengths.map((item) => <span key={item} className="rounded-full border border-hair bg-canvas px-3 py-1 text-[.66rem] font-medium text-ink">✓ {item}</span>)}</div>{selected.quality?.issues.length ? <p className="mt-3 text-[.72rem] leading-relaxed text-ink/80">{selected.quality.issues.join(' · ')}</p> : null}{explanation && (explanation.reasons.length > 0 || !explanation.healthy) ? <div className="mt-3 rounded-xl border border-accent/20 bg-canvas/70 p-3"><p className="text-[.72rem] font-semibold text-ink/90">🔍 لماذا هذه النتيجة؟ {explanation.verdict}</p>{explanation.reasons.length ? <ul className="mt-2 grid gap-2">{explanation.reasons.map((reason) => <li key={reason.dimension} className="rounded-lg border border-hair bg-paper/70 px-3 py-2"><div className="flex items-center justify-between gap-2"><strong className="text-[.7rem] text-ink">{reason.severity === 'critical' ? '⛔' : '⚠️'} {reason.dimension}</strong><span className={`rounded-full px-2 py-0.5 text-[.6rem] font-bold ${reason.severity === 'critical' ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-700'}`}>{reason.score}٪</span></div><p className="mt-1 text-[.68rem] leading-relaxed text-soft">{reason.why}</p><p className="mt-1 text-[.68rem] leading-relaxed text-accent">↳ {reason.fix}</p></li>)}</ul> : null}{!explanation.healthy ? <p className="mt-2 rounded-lg bg-accent/[.08] px-3 py-2 text-[.68rem] font-semibold text-accent">أهمّ خطوةٍ الآن: {explanation.nextStep}</p> : null}</div> : null}{selected.rationale?.length ? <div className="mt-4 rounded-xl border border-hair bg-paper/70 p-3"><p className="text-[.64rem] font-bold text-accent">قراءة المخرج الفنّي</p><ul className="mt-2 grid gap-1">{selected.rationale.slice(0, 3).map((line) => <li key={line} className="text-[.72rem] leading-relaxed text-ink/85">• {line}</li>)}</ul></div> : null}</section>
                {globalCritic && <section className="rounded-2xl border border-hair bg-canvas p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold text-accent">حكم الناقد العالمي</p><p className="mt-1 text-[.72rem] text-ink/60">درجة مركبة من الجودة والقراءة وقوة التوقف والتميّز عن تاريخك.</p></div><strong className="font-display text-3xl text-accent">{globalCritic.score}٪</strong></div><p className="mt-3 text-[.74rem] leading-relaxed text-ink/85">{globalCritic.verdict}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-hair bg-paper px-3 py-1 text-[.66rem] text-ink">{globalCritic.imageDriven ? 'مشهد بصري بطولي' : 'تكوين طباعي/مركب'}</span><span className="rounded-full border border-hair bg-paper px-3 py-1 text-[.66rem] text-ink">قوة التوقف {globalCritic.stop.score}٪</span>{globalCritic.score >= qualityThreshold ? <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[.66rem] font-semibold text-emerald-700">جاهز للتصدير وفق الحد الحالي</span> : <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[.66rem] font-semibold text-amber-700">لم يبلغ حد التصدير الحالي بعد</span>}</div><p className="mt-3 rounded-xl bg-accent/[.06] px-3 py-2 text-[.68rem] leading-relaxed text-accent">أهم دفعة الآن: {globalCritic.nextStep}</p></section>}
                {designLineage && <section className="rounded-2xl border border-hair bg-canvas p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[.7rem] font-bold text-accent">سلالة التصميم</p><p className="mt-1 text-[.72rem] text-ink/60">هل هذه النسخة امتداد ذكي أم تكرار لما سبق؟</p></div><strong className="font-display text-2xl text-accent">{designLineage.similarity}٪</strong></div><p className="mt-3 text-[.72rem] leading-relaxed text-ink/85">{designLineage.message}</p><span className="mt-3 inline-flex rounded-full border border-hair bg-paper px-3 py-1 text-[.64rem] text-soft">{designLineage.family}</span></section>}
                {designProvenance && <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">شهادة منشأ التصميم</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border border-hair bg-paper/70 px-3 py-2"><p className="text-[.6rem] font-semibold text-soft">المصدر</p><p className="mt-1 text-[.7rem] leading-relaxed text-ink break-all">{designProvenance.source}</p></div><div className="rounded-xl border border-hair bg-paper/70 px-3 py-2"><p className="text-[.6rem] font-semibold text-soft">المالك / الترخيص</p><p className="mt-1 text-[.7rem] leading-relaxed text-ink">{designProvenance.owner} · {designProvenance.license}</p></div><div className="rounded-xl border border-hair bg-paper/70 px-3 py-2"><p className="text-[.6rem] font-semibold text-soft">المعالجة البطولية</p><p className="mt-1 text-[.7rem] leading-relaxed text-ink">{designProvenance.heroMode}</p></div><div className="rounded-xl border border-hair bg-paper/70 px-3 py-2"><p className="text-[.6rem] font-semibold text-soft">بنية الكاروسيل</p><p className="mt-1 text-[.7rem] leading-relaxed text-ink">{designProvenance.slides ? `${designProvenance.slides} شريحة` : 'ليس كاروسيلاً'}</p></div></div>{designProvenance.reasons.length ? <ul className="mt-3 grid gap-1">{designProvenance.reasons.map((reason) => <li key={reason} className="text-[.7rem] leading-relaxed text-ink/80">• {reason}</li>)}</ul> : null}</section>}
                {/* مختبر الأداء (أ-٣): يتنبّأ بقوة التوقّف والتفاعل — لا يكرّر الناقد (الجودة) بل يكمّله */}
                {forecast && (
                  <section className="rounded-2xl border border-hair bg-canvas p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-[.7rem] font-bold text-accent">تقدير أولي لقوة التوقف</p><p className="mt-1 text-[.72rem] text-ink/60">محاكاة داخلية للإشارات البصرية؛ غير مبنية على أداء منشورات فعلي.</p></div>
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
                </div>
                {/* الأدوات نفسها نُقلت إلى عمود الطبقات المستقل كي تبقى اللوحة كاملة. */}
                <section className="hidden">
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
