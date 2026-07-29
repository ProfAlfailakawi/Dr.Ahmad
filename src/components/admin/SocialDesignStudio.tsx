import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
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
  SOCIAL_FORMATS,
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
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { useCmsContent } from '../../lib/content'
import { interpretDrAhmadDomain } from '../../lib/dr-ahmad-domain-glossary'
import { GenerationLibraryPanel, type GeneratedDesignLibraryAsset, type GeneratedLibraryAsset } from './GenerationLibraryPanel'

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
const VISUAL_WORLD_HISTORY_KEY = 'dr-ahmad-studio-visual-world-history-v2'
const GENERATION_LIBRARY_BACKFILL_KEY = 'dr-ahmad-generation-library-backfill-v1'
const STUDIO_DRAFT_DB = 'dr-ahmad-studio-drafts-v1'
const STUDIO_DRAFT_STORE = 'drafts'
const STUDIO_DRAFT_ID = 'current'
const STUDIO_DRAFT_FALLBACK_KEY = 'dr-ahmad-social-design-live-draft-v1'
const STUDIO_DRAFT_HINT_KEY = 'dr-ahmad-social-design-live-draft-hint-v1'
const SIMPLIFIED_STUDIO = true

const STUDIO_STAGES = [
  { id: 'idea', number: '01', label: 'الفكرة', description: 'أنت تكتب فقط' },
  { id: 'directions', number: '02', label: 'النتيجة', description: 'الأقوى فقط' },
  { id: 'edit', number: '03', label: 'التحرير', description: 'تدخلك يبدأ هنا' },
  { id: 'publish', number: '04', label: 'النشر', description: 'حملة وتصدير' },
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
  visualOrigin: StudioVisualOrigin
}

type StudioImageMetadata = {
  source?: string
  owner?: string
  license?: string
  description?: string
  visualWorld?: string
  visualWorldLabel?: string
  imageTreatment?: NonNullable<PlanOverlay['imageTreatment']>
  layoutHint?: LayoutFamilyId
  paletteHint?: PaletteId
  conceptKey?: string
  conceptLabel?: string
  semanticScene?: string
  relevanceScore?: number | null
  relevanceReason?: string
  generationAttempts?: number
  semanticVerified?: boolean | null
  criticSource?: string
  imageCaption?: string
  missingAnchor?: string
  literalSubjects?: string[]
  visualScore?: number | null
  visualReasons?: string[]
  safeTextZone?: StudioImagePassport['negativeSpace']
  zoneScores?: StudioImagePassport['zoneScores']
  imageWidth?: number
  imageHeight?: number
  targetWidth?: number
  targetHeight?: number
  nativeAspect?: boolean
  formatId?: string
}

type GeneratedStudioImage = {
  passport: StudioImagePassport
  metadata: StudioImageMetadata
  prompt: string
  model: string
  generatedAt?: string
  requestId?: string
}

type StudioVisualMode = 'generate' | 'ready'
type StudioVisualOrigin = 'generated' | 'ready' | 'none'
type StudioLibraryImage = { id: string; title: string; note: string; url: string }
type ZeroDecisionPhase = 'idle' | 'understand' | 'prompt' | 'image' | 'compose' | 'critic' | 'campaign' | 'done'

type StudioLiveDraft = {
  version: 1
  updatedAt: number
  text: string
  context: string
  tone: ContentTone | 'auto'
  density: DesignDensity | 'auto'
  platform: SocialPlatform | 'auto'
  stage: StudioStage
  plans: CompositionPlan[]
  reservePlans: CompositionPlan[]
  selected: CompositionPlan | null
  editUndo: CompositionPlan[]
  editRedo: CompositionPlan[]
  generation: number
  locks: { content: boolean; style: boolean; color: boolean; format: boolean }
  campaign: SocialCampaign | null
  imagePassport: StudioImagePassport | null
  imageDescription: string
  imageSource: string
  imageOwner: string
  imageLicense: string
  externalVisuals: ExternalVisualResult[]
  externalQuery: string
  generatedPrompt: string
  visualMode: StudioVisualMode
  visualOrigin: StudioVisualOrigin
  generatedModel: string
  generatedAt: string
  generatedVisualWorld: string
  generatedRelevanceScore: number | null
  generatedRelevanceReason: string
  generationMode: 'daily' | 'masterpiece'
  dna: VisualDna | null
  sealOn: boolean
  seasonalOn: boolean
  bgPattern: BackgroundPattern
  autopilotPack: AutoPilotCandidate[]
  releasePack: ReleaseVariant[]
  zeroDecision: ZeroDecisionSummary | null
  zeroDecisionPhase: ZeroDecisionPhase
}

function studioDraftHasWork(draft: StudioLiveDraft | null | undefined) {
  return Boolean(draft && (
    draft.text.trim()
    || draft.context.trim()
    || draft.plans.length
    || draft.reservePlans.length
    || draft.selected
    || draft.imagePassport
    || draft.campaign
    || draft.autopilotPack.length
    || draft.releasePack.length
    || draft.zeroDecision
  ))
}

function openStudioDraftDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(STUDIO_DRAFT_DB, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STUDIO_DRAFT_STORE)) db.createObjectStore(STUDIO_DRAFT_STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

async function readStudioLiveDraft(): Promise<StudioLiveDraft | null> {
  if (typeof window === 'undefined') return null
  const db = await openStudioDraftDb()
  if (db) {
    try {
      const draft = await new Promise<StudioLiveDraft | null>((resolve) => {
        const tx = db.transaction(STUDIO_DRAFT_STORE, 'readonly')
        const request = tx.objectStore(STUDIO_DRAFT_STORE).get(STUDIO_DRAFT_ID)
        request.onsuccess = () => resolve((request.result as StudioLiveDraft | undefined) || null)
        request.onerror = () => resolve(null)
      })
      db.close()
      if (draft?.version === 1) return draft
    } catch { db.close() }
  }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STUDIO_DRAFT_FALLBACK_KEY) || 'null') as StudioLiveDraft | null
    return parsed?.version === 1 ? parsed : null
  } catch { return null }
}

async function writeStudioLiveDraft(draft: StudioLiveDraft) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STUDIO_DRAFT_HINT_KEY, String(draft.updatedAt)) } catch { /* hint only */ }
  const db = await openStudioDraftDb()
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STUDIO_DRAFT_STORE, 'readwrite')
        tx.objectStore(STUDIO_DRAFT_STORE).put(draft, STUDIO_DRAFT_ID)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      })
      db.close()
      return
    } catch { db.close() }
  }
  // احتياطٌ فقط للمتصفحات التي تمنع IndexedDB؛ لا نخاطر بملء localStorage بصورة ضخمة.
  try {
    const serialized = JSON.stringify(draft)
    if (serialized.length <= 3_500_000) window.localStorage.setItem(STUDIO_DRAFT_FALLBACK_KEY, serialized)
  } catch { /* الحفظ الصامت لا يعطل الاستوديو */ }
}

async function clearStudioLiveDraft() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(STUDIO_DRAFT_FALLBACK_KEY)
      window.localStorage.removeItem(STUDIO_DRAFT_HINT_KEY)
    } catch { /* noop */ }
  }
  const db = await openStudioDraftDb()
  if (!db) return
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STUDIO_DRAFT_STORE, 'readwrite')
      tx.objectStore(STUDIO_DRAFT_STORE).delete(STUDIO_DRAFT_ID)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  } finally { db.close() }
}

const FRESH_GENERATION_VARIATIONS = [
  'Use luminous natural daylight, optimistic educational energy, clean spatial rhythm, and an active learning moment; avoid dark corridors and lonely empty classrooms.',
  'Build a sophisticated tactile learning system with modular levels, progress markers, achievement tokens and material detail; elegant, gameful and not childish.',
  'Create a bold color-field editorial cover with one intelligent educational metaphor, asymmetrical balance and an unmistakably positive visual pulse.',
  'Use authentic human documentary warmth: collaboration, motion, curiosity and dignity. The scene must feel alive, not staged, gloomy or sentimental.',
  'Create a refined paper-sculpture or physical-model interpretation with warm light, museum-grade craft and a fresh conceptual structure.',
  'Use a precise evidence-led still life with neutral daylight, clear cause and effect, and no melodramatic shadows.',
  'Create a cinematic image only when the idea truly needs tension; otherwise prefer balanced light, visible possibility and a contemporary international magazine mood.',
  'Invent a completely different visual world from the recent generations: change emotional valence, material language, spatial structure and color family while preserving semantic accuracy.',
] as const

const AUTOPILOT_PRESETS: { id: AutoPilotModeId; label: string; note: string; tone: ContentTone; density: DesignDensity; preferLayout: LayoutFamilyId; palette: PaletteId; platform?: SocialPlatform | 'auto'; imageTreatment?: NonNullable<PlanOverlay['imageTreatment']> }[] = [
  { id: 'safe', label: 'المضيء المؤسسي', note: 'وضوح عالٍ وضوء طبيعي وحضور أكاديمي معاصر.', tone: 'formal', density: 'balanced', preferLayout: 'editorial-axis', palette: 'scholar-blue', platform: 'auto', imageTreatment: 'documentary' },
  { id: 'editorial', label: 'التحريري اللوني', note: 'غلاف أفكار عالمي بلون حيّ ومساحة ذكية.', tone: 'intellectual', density: 'minimal', preferLayout: 'quote-stage', palette: 'signal-ivory', platform: 'instagram', imageTreatment: 'editorial' },
  { id: 'luxury', label: 'الفاخر الدافئ', note: 'فخامة هادئة بمواد دافئة لا بسواد متكرر.', tone: 'luxury', density: 'minimal', preferLayout: 'quiet-orbit', palette: 'warm-parchment', platform: 'instagram', imageTreatment: 'duotone' },
  { id: 'impact', label: 'السينمائي الجريء', note: 'توتر بصري قوي يُستخدم حين يخدم المعنى فقط.', tone: 'bold', density: 'minimal', preferLayout: 'hero-word', palette: 'brand-night', platform: 'instagram', imageTreatment: 'cinematic' },
  { id: 'evidence', label: 'المعرفي البرهاني', note: 'دليل واضح وتكوين مادي منضبط بعيد عن الدراما.', tone: 'academic', density: 'balanced', preferLayout: 'evidence-ledger', palette: 'quiet-stone', platform: 'linkedin', imageTreatment: 'editorial' },
]

function selectDistinctTriptych(plans: CompositionPlan[]) {
  const selected: CompositionPlan[] = []
  const heroSource = (plan: CompositionPlan) => plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')?.src || ''
  const treatment = (plan: CompositionPlan) => plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')?.imageTreatment || 'none'
  const surface = (plan: CompositionPlan) => PALETTES[plan.palette]?.isDark ? 'dark' : 'light'
  const ranked = [...plans].sort((left, right) => (right.quality?.score || 0) - (left.quality?.score || 0))
  while (selected.length < 3 && ranked.length) {
    let bestIndex = 0
    let bestScore = -Infinity
    for (let index = 0; index < ranked.length; index += 1) {
      const candidate = ranked[index]
      const image = heroSource(candidate)
      const imageNovel = !image || selected.every((item) => heroSource(item) !== image)
      const layoutNovel = selected.every((item) => item.layout !== candidate.layout)
      const paletteNovel = selected.every((item) => item.palette !== candidate.palette)
      const treatmentNovel = selected.every((item) => treatment(item) !== treatment(candidate))
      const surfaceNovel = selected.every((item) => surface(item) !== surface(candidate))
      const similarity = selected.length ? Math.max(...selected.map((item) => designSimilarity(item, candidate))) : 0
      const score = (candidate.quality?.score || 0)
        + (imageNovel ? 42 : -36)
        + (layoutNovel ? 22 : -12)
        + (paletteNovel ? 14 : -8)
        + (treatmentNovel ? 10 : -5)
        + (surfaceNovel ? 5 : 0)
        - similarity * 28
      if (score > bestScore) { bestScore = score; bestIndex = index }
    }
    const [picked] = ranked.splice(bestIndex, 1)
    if (!picked) break
    selected.push(picked)
  }
  return selected
}

type ImageProbe = { url: string; width: number; height: number }

function probeImageUrl(url: string, timeoutMs = 3500): Promise<ImageProbe | null> {
  if (!url || typeof Image === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const image = new Image()
    let settled = false
    const finish = (value: ImageProbe | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), timeoutMs)
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish({ url, width: image.naturalWidth || 0, height: image.naturalHeight || 0 })
    image.onerror = () => finish(null)
    image.src = url
  })
}

function generatedImageFileFromDataUri(dataUri: string, fileName: string): File | null {
  const match = dataUri.match(/^data:(image\/(?:jpeg|jpg|png|webp|gif|avif))(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i)
  if (!match) return null
  const mime = match[1].toLowerCase().replace('image/jpg', 'image/jpeg')
  const raw = match[2].replace(/\s+/g, '')
  if (!raw || raw.length > 28_000_000) return null
  try {
    const binary = window.atob(raw)
    if (binary.length < 256 || binary.length > 18_000_000) return null
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : mime === 'image/avif' ? 'avif' : 'jpg'
    const safeName = fileName.replace(/\.[A-Za-z0-9]+$/, '') || 'dr-ahmad-ai'
    return new File([bytes], `${safeName}.${extension}`, { type: mime })
  } catch { return null }
}

function generatedImageDataUri(payload: unknown): string {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const nested = record.result && typeof record.result === 'object' ? record.result as Record<string, unknown> : {}
  const value = [record.imageUrl, record.image, record.imageBase64, nested.image, nested.imageUrl]
    .find((item): item is string => typeof item === 'string' && item.trim().length > 100)
  if (!value) return ''
  const raw = value.trim()
  if (/^data:image\//i.test(raw)) return raw
  const mime = typeof record.imageMime === 'string' && /^image\//i.test(record.imageMime) ? record.imageMime : 'image/jpeg'
  return `data:${mime};base64,${raw.replace(/\s+/g, '')}`
}

function generatedThumbnailDataUri(dataUri: string, maxSide = 280): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale))
      canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(''); return }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      try { resolve(canvas.toDataURL('image/jpeg', .68)) } catch { resolve('') }
    }
    image.onerror = () => resolve('')
    image.src = dataUri
  })
}

function generatedDesignThumbnailDataUri(plan: CompositionPlan, maxSide = 300): Promise<string> {
  return new Promise((resolve) => {
    let objectUrl = ''
    try {
      const svg = renderCompositionSvg(plan)
      objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
      const image = new Image()
      const finish = (value = '') => {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        resolve(value)
      }
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || plan.format.width || 1, image.naturalHeight || plan.format.height || 1))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round((image.naturalWidth || plan.format.width || 1) * scale))
        canvas.height = Math.max(1, Math.round((image.naturalHeight || plan.format.height || 1) * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) { finish(); return }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        try { finish(canvas.toDataURL('image/jpeg', .7)) } catch { finish() }
      }
      image.onerror = () => finish()
      image.src = objectUrl
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      resolve('')
    }
  })
}

function basicGeneratedImagePassport(imageUrl: string, fileName: string, file?: File | null): Promise<StudioImagePassport | null> {
  return new Promise((resolve) => {
    const image = new Image()
    const objectUrl = file ? URL.createObjectURL(file) : ''
    const cleanup = () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
    const timer = window.setTimeout(() => { image.onload = null; image.onerror = null; cleanup(); resolve(null) }, 20_000)
    image.onload = () => {
      window.clearTimeout(timer)
      cleanup()
      const width = image.naturalWidth || 0
      const height = image.naturalHeight || 0
      if (!width || !height) { resolve(null); return }
      const aspectRatio = width / height
      resolve({
        dataUrl: imageUrl,
        fileName,
        mime: imageUrl.match(/^data:(image\/[^;,]+)/i)?.[1] || 'image/jpeg',
        width,
        height,
        aspectRatio,
        orientation: aspectRatio > 1.08 ? 'landscape' : aspectRatio < .92 ? 'portrait' : 'square',
        luminance: 50,
        contrast: 50,
        edgeDensity: 35,
        visualScore: 70,
        zoneScores: { right: 35, left: 35, top: 35, bottom: 35 },
        negativeSpace: 'balanced',
        focalX: .5,
        focalY: .5,
        recommendedFit: 'cover',
        cropRisk: 'medium',
        cropNotes: ['الصورة المولدة صالحة؛ استُخدم تحليل بصري آمن لأن التحليل التفصيلي تعذّر على الجهاز.', 'يمكن ضبط نقطة التركيز والقص يدوياً داخل التحرير.'],
      })
    }
    image.onerror = () => { window.clearTimeout(timer); cleanup(); resolve(null) }
    image.src = objectUrl || imageUrl
  })
}

async function analyzeGeneratedStudioImage(imageUrl: string, fileName: string): Promise<StudioImagePassport | null> {
  const localFile = generatedImageFileFromDataUri(imageUrl, fileName)
  if (localFile) {
    const detailed = await analyzeStudioImageFromFile(localFile)
    if (detailed) return detailed
  }
  const detailedFromUrl = await analyzeStudioImageFromUrl(imageUrl, fileName)
  if (detailedFromUrl) return detailedFromUrl
  return basicGeneratedImagePassport(imageUrl, fileName, localFile)
}

async function verifyExternalVisuals(items: ExternalVisualResult[], limit = 10): Promise<ExternalVisualResult[]> {
  const candidates = items.slice(0, Math.max(limit, 12))
  const checked: Array<ExternalVisualResult | null> = await Promise.all(candidates.map(async (item): Promise<ExternalVisualResult | null> => {
    const urls = [...new Set([item.thumbnailUrl, item.imageUrl].filter((url): url is string => Boolean(url)))]
    for (const url of urls) {
      const probe = await probeImageUrl(url)
      if (probe) {
        const verified: ExternalVisualResult = {
          ...item,
          thumbnailUrl: probe.url,
          ...(item.width || probe.width ? { width: item.width || probe.width } : {}),
          ...(item.height || probe.height ? { height: item.height || probe.height } : {}),
        }
        return verified
      }
    }
    return null
  }))
  return checked.filter((item): item is ExternalVisualResult => item !== null).slice(0, limit)
}

function RemoteVisualThumbnail({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) return <div className={`${className} grid place-items-center bg-paper text-center text-[.64rem] leading-relaxed text-soft`}><span>تعذّر تحميل المعاينة<br />جرّب مصدراً آخر</span></div>
  return <img src={src} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function StageRail({ stage, onChange }: { stage: StudioStage; onChange: (stage: StudioStage) => void }) {
  return <nav aria-label="مراحل استوديو التصميم" className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><ol className="flex min-w-max gap-2 rounded-[1.4rem] border border-hair bg-canvas/80 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.5)]">{STUDIO_STAGES.map((item) => <li key={item.id}><button type="button" onClick={() => onChange(item.id)} className={`group min-w-[145px] rounded-[1.1rem] px-4 py-3 text-right transition-all duration-300 ${stage === item.id ? 'bg-ink text-white shadow-[0_12px_30px_rgba(15,23,42,.16)]' : 'text-soft hover:bg-paper hover:text-ink'}`}><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[.58rem] font-black tracking-[.08em] ${stage === item.id ? 'bg-white/14 text-white' : 'border border-hair bg-paper text-accent'}`}>{item.number}</span><strong className="mt-2 block text-[.82rem]">{item.label}</strong><span className={`mt-1 block text-[.62rem] ${stage === item.id ? 'text-white/65' : 'text-soft'}`}>{item.description}</span></button></li>)}</ol></nav>
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

function loadVisualWorldHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VISUAL_WORLD_HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 10) : []
  } catch { return [] }
}

function rememberVisualWorld(world?: string) {
  if (!world || typeof window === 'undefined') return
  const next = [world, ...loadVisualWorldHistory().filter((item) => item !== world)].slice(0, 10)
  try { window.localStorage.setItem(VISUAL_WORLD_HISTORY_KEY, JSON.stringify(next)) } catch { /* لا نوقف التوليد */ }
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

/* جزيرة إدخال حقيقية: المتصفح يكتب مباشرةً في DOM من دون setState إطلاقاً.
   النسخة السابقة أبقت draft في React؛ فكان الحقل نفسه يعاد رسمه مع كل حرف،
   ثم يعيد الاستوديو الثقيل كله بعد 320ms. هنا لا نرسل النص للمحرك إلا بعد
   هدوءٍ قصير أو عند مغادرة الحقل، لذلك تظل الكتابة بسرعة لوحة المفاتيح
   وتصل المسودة الحية إلى الحفظ الصامت من دون انتظار طويل. */
function BufferedIdeaTextarea({
  value,
  onCommit,
  textareaRef,
  className,
  placeholder,
}: {
  value: string
  onCommit: (next: string) => void
  textareaRef: Ref<HTMLTextAreaElement>
  className: string
  placeholder: string
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const idleTimerRef = useRef<number | null>(null)
  const assignRef = (node: HTMLTextAreaElement | null) => {
    localRef.current = node
    if (typeof textareaRef === 'function') textareaRef(node)
    else if (textareaRef && 'current' in textareaRef) {
      (textareaRef as { current: HTMLTextAreaElement | null }).current = node
    }
  }
  useEffect(() => {
    const field = localRef.current
    if (field && document.activeElement !== field && field.value !== value) field.value = value
  }, [value])
  useEffect(() => () => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
  }, [])
  const commit = (next: string) => {
    if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = null
    if (next !== value) onCommit(next)
  }
  return (
    <textarea
      ref={assignRef}
      className={className}
      defaultValue={value}
      data-performance-island="studio-idea"
      onInput={(event) => {
        const next = event.currentTarget.value
        if (idleTimerRef.current != null) window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = window.setTimeout(() => commit(next), 280)
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
      placeholder={placeholder}
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
  const externalSearchSequenceRef = useRef(0)
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
  const [zeroDecisionPhase, setZeroDecisionPhase] = useState<ZeroDecisionPhase>('idle')
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [visualMode, setVisualMode] = useState<StudioVisualMode>('generate')
  const [visualOrigin, setVisualOrigin] = useState<StudioVisualOrigin>('none')
  const [visualFailure, setVisualFailure] = useState('')
  const [generatedModel, setGeneratedModel] = useState('')
  const [generatedAt, setGeneratedAt] = useState('')
  const [generatedVisualWorld, setGeneratedVisualWorld] = useState('')
  const [generatedRelevanceScore, setGeneratedRelevanceScore] = useState<number | null>(null)
  const [generatedRelevanceReason, setGeneratedRelevanceReason] = useState('')
  const [generatedLibraryAssets, setGeneratedLibraryAssets] = useState<GeneratedLibraryAsset[]>([])
  const [generatedLibraryBusy, setGeneratedLibraryBusy] = useState(false)
  const [generatedLibraryError, setGeneratedLibraryError] = useState('')
  const [generatedLibraryHasMore, setGeneratedLibraryHasMore] = useState(false)
  const [generatedDesignLibraryAssets, setGeneratedDesignLibraryAssets] = useState<GeneratedDesignLibraryAsset[]>([])
  const [generatedDesignLibraryBusy, setGeneratedDesignLibraryBusy] = useState(false)
  const [generatedDesignLibraryError, setGeneratedDesignLibraryError] = useState('')
  const [generatedDesignLibraryHasMore, setGeneratedDesignLibraryHasMore] = useState(false)
  const [generationStorageStatus, setGenerationStorageStatus] = useState<'idle' | 'checking' | 'ready' | 'failed'>('idle')
  const [generationStorageMessage, setGenerationStorageMessage] = useState('')
  const [generationBackfillBusy, setGenerationBackfillBusy] = useState(false)
  const [generationBackfillSummary, setGenerationBackfillSummary] = useState('')
  const [generationMode, setGenerationMode] = useState<'daily' | 'masterpiece'>(() => {
    try { return localStorage.getItem('dr-ahmad-image-generation-mode') === 'masterpiece' ? 'masterpiece' : 'daily' } catch { return 'daily' }
  })
  const generationSerialRef = useRef(0)
  const [qualityThreshold, setQualityThreshold] = useState(() => Number(localStorage.getItem(QUALITY_THRESHOLD_KEY) || 82))
  /* البصمة البصرية: لوحةٌ مستخرجةٌ من صورةٍ محلية تكسو كل الاتجاهات الحالية
     والقادمة حتى تُزال — بلا خدمةٍ خارجية ولا رفعٍ لأي خادم. */
  const [dna, setDna] = useState<VisualDna | null>(null)
  const [dnaBusy, setDnaBusy] = useState(false)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  const commitIdeaNow = () => {
    const latest = textRef.current?.value ?? text
    if (latest !== text) setText(latest)
  }

  /* ختم الهوية ولمسة الموسم: تفضيلان يسريان على المعاينة والتصدير معاً،
     ويبقيان محفوظين في هذا المتصفح. */
  const [sealOn, setSealOn] = useState(() => { try { return localStorage.getItem(SEAL_KEY) === '1' } catch { return false } })
  const [seasonalOn, setSeasonalOn] = useState(() => { try { return localStorage.getItem(SEASONAL_KEY) !== '0' } catch { return true } })
  const [bgPattern, setBgPattern] = useState<BackgroundPattern>(() => { try { return (localStorage.getItem(PATTERN_KEY) as BackgroundPattern) || 'none' } catch { return 'none' } })
  const [dnaFaves, setDnaFaves] = useState<VisualDna[]>(() => { try { return JSON.parse(localStorage.getItem(DNA_FAVES_KEY) || '[]') } catch { return [] } })
  const [phoneView, setPhoneView] = useState(false)
  const [mobileEditorPanel, setMobileEditorPanel] = useState<MobileEditorPanel>('preview')
  const [attentionOn, setAttentionOn] = useState(false)

  // المسودة الحية: تحفظ الجلسة غير المكتملة محلياً بصمت، ولا تستعيدها إلا بإذن المستخدم.
  const [interruptedDraft, setInterruptedDraft] = useState<StudioLiveDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false)
  const suppressAutosaveRef = useRef(false)

  const liveDraft = useMemo<StudioLiveDraft>(() => ({
    version: 1,
    updatedAt: Date.now(),
    text,
    context,
    tone,
    density,
    platform,
    stage,
    plans,
    reservePlans,
    selected,
    editUndo,
    editRedo,
    generation,
    locks,
    campaign,
    imagePassport,
    imageDescription,
    imageSource,
    imageOwner,
    imageLicense,
    externalVisuals,
    externalQuery,
    generatedPrompt,
    visualMode,
    visualOrigin,
    generatedModel,
    generatedAt,
    generatedVisualWorld,
    generatedRelevanceScore,
    generatedRelevanceReason,
    generationMode,
    dna,
    sealOn,
    seasonalOn,
    bgPattern,
    autopilotPack,
    releasePack,
    zeroDecision,
    zeroDecisionPhase,
  }), [
    text, context, tone, density, platform, stage, plans, reservePlans, selected, editUndo, editRedo, generation, locks,
    campaign, imagePassport, imageDescription, imageSource, imageOwner, imageLicense, externalVisuals, externalQuery,
    generatedPrompt, visualMode, visualOrigin, generatedModel, generatedAt, generatedVisualWorld,
    generatedRelevanceScore, generatedRelevanceReason, generationMode, dna, sealOn, seasonalOn, bgPattern, autopilotPack,
    releasePack, zeroDecision, zeroDecisionPhase,
  ])
  const latestDraftRef = useRef(liveDraft)
  useEffect(() => { latestDraftRef.current = liveDraft }, [liveDraft])

  useEffect(() => {
    let alive = true
    void readStudioLiveDraft().then((draft) => {
      if (!alive) return
      const maxAge = 1000 * 60 * 60 * 24 * 30
      const usable = draft && draft.version === 1 && Date.now() - Number(draft.updatedAt || 0) <= maxAge && studioDraftHasWork(draft) ? draft : null
      setInterruptedDraft(usable)
      setDraftReady(true)
      if (draft && !usable) void clearStudioLiveDraft()
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!draftReady || interruptedDraft) return
    // بعد حفظ نهائي نتجاهل أي مؤقت قديم؛ أول تعديل حقيقي لاحق يبدأ مسودة جديدة.
    if (suppressAutosaveRef.current) suppressAutosaveRef.current = false
    const timer = window.setTimeout(() => {
      if (suppressAutosaveRef.current) return
      const snapshot = { ...liveDraft, updatedAt: Date.now() }
      if (studioDraftHasWork(snapshot)) void writeStudioLiveDraft(snapshot)
      else void clearStudioLiveDraft()
    }, 260)
    return () => window.clearTimeout(timer)
  }, [draftReady, interruptedDraft, liveDraft])

  useEffect(() => {
    const persistBeforeLeave = () => {
      if (!draftReady || interruptedDraft || suppressAutosaveRef.current) return
      const snapshot: StudioLiveDraft = {
        ...latestDraftRef.current,
        text: textRef.current?.value ?? latestDraftRef.current.text,
        updatedAt: Date.now(),
      }
      if (studioDraftHasWork(snapshot)) void writeStudioLiveDraft(snapshot)
    }
    window.addEventListener('pagehide', persistBeforeLeave)
    return () => window.removeEventListener('pagehide', persistBeforeLeave)
  }, [draftReady, interruptedDraft])

  const restoreInterruptedDraft = () => {
    const draft = interruptedDraft
    if (!draft) return
    suppressAutosaveRef.current = true
    setText(draft.text)
    setContext(draft.context)
    setTone(draft.tone)
    setDensity(draft.density)
    setPlatform(draft.platform)
    setStage(draft.stage)
    setPlans(draft.plans)
    setReservePlans(draft.reservePlans)
    setSelected(draft.selected)
    setEditUndo(draft.editUndo)
    setEditRedo(draft.editRedo)
    setGeneration(draft.generation)
    setLocks(draft.locks)
    setCampaign(draft.campaign)
    setImagePassport(draft.imagePassport)
    setImageDescription(draft.imageDescription)
    setImageSource(draft.imageSource)
    setImageOwner(draft.imageOwner)
    setImageLicense(draft.imageLicense)
    setExternalVisuals(draft.externalVisuals)
    setExternalQuery(draft.externalQuery)
    setGeneratedPrompt(draft.generatedPrompt)
    setVisualMode(draft.visualMode === 'ready' ? 'ready' : 'generate')
    setVisualOrigin(draft.visualOrigin)
    setGeneratedModel(draft.generatedModel)
    setGeneratedAt(draft.generatedAt)
    setGeneratedVisualWorld(draft.generatedVisualWorld)
    setGeneratedRelevanceScore(draft.generatedRelevanceScore)
    setGeneratedRelevanceReason(draft.generatedRelevanceReason)
    setGenerationMode(draft.generationMode)
    setDna(draft.dna)
    setSealOn(draft.sealOn)
    setSeasonalOn(draft.seasonalOn)
    setBgPattern(draft.bgPattern)
    setAutopilotPack(draft.autopilotPack)
    setReleasePack(draft.releasePack)
    setZeroDecision(draft.zeroDecision)
    setZeroDecisionPhase(draft.zeroDecisionPhase)
    setInterruptedDraft(null)
    setNotice('استُعيد التصميم غير المكتمل كما تركته — ويمكنك متابعة العمل من النقطة نفسها.')
  }

  const dismissInterruptedDraft = () => {
    suppressAutosaveRef.current = true
    setInterruptedDraft(null)
    void clearStudioLiveDraft()
    setNotice('تم تجاهل المسودة المنقطعة. لم تُمس تصاميمك المحفوظة أو مكتبة التوليد.')
  }

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
    const verdict = score >= 92 ? 'جاهز لمنافسة أفضل الإخراجات.' : score >= 86 ? 'قوي جداً ويستحق النشر.' : score >= 80 ? 'ممتاز لكن يمكن دفعه أكثر.' : 'جيد، ويحتاج دفعة أخرى قبل أن يبهر.'
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
        ? 'هذا الاتجاه قريب جداً من سلالة سابقة؛ الأفضل كسر النبرة أو المعالجة قبل الاعتماد النهائي.'
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

  // لا ينتقل الاستوديو تلقائياً أثناء الكتابة. التحليل يتحدّث لحظياً،
  // أمّا بناء التصاميم والبحث الخارجي فلا يبدأان إلا بأمر صريح من المستخدم.

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
  const domainUnderstanding = useMemo(() => interpretDrAhmadDomain(text, context), [context, text])
  const expertContext = useMemo(() => [context, domainUnderstanding.expandedContext].filter(Boolean).join(' · '), [context, domainUnderstanding.expandedContext])
  const analysis = useMemo(() => analyzeSocialContent(hasInput ? text : 'فكرة معرفية جديدة', expertContext, { author: 'د. أحمد حسين الفيلكاوي' }), [expertContext, hasInput, text])
  const creativeBrief = useMemo(() => buildCreativeBrief(text || 'فكرة معرفية جديدة', `${expertContext} · ${identityContext(creativeIdentity)}`, analysis), [analysis, creativeIdentity, expertContext, text])
  const visualSearchPlan = useMemo(() => buildVisualSearchPlan(text || 'فكرة معرفية جديدة', expertContext, creativeBrief, creativeIdentity), [creativeBrief, creativeIdentity, expertContext, text])
  const artDirections = useMemo<ArtDirection[]>(() => buildArtDirections(creativeBrief), [creativeBrief])
  const externalProviderLabels = useMemo(() => [...new Set(externalVisuals.map((item) => item.providerLabel))], [externalVisuals])
  const hasPexelsProvider = useMemo(() => externalVisuals.some((item) => item.provider === 'pexels'), [externalVisuals])
  const hasOpenverseProvider = useMemo(() => externalVisuals.some((item) => item.provider === 'openverse'), [externalVisuals])
  const bestExternalVisual = externalVisuals[0]
  const configuredImageGeneratorEndpoint = ((import.meta as any)?.env?.VITE_STUDIO_IMAGE_GENERATOR_ENDPOINT as string | undefined)?.trim()
  const imageGeneratorEndpoints = useMemo(() => [...new Set([
    configuredImageGeneratorEndpoint,
    '/api/ai/studio-image',
    '/api/studio-image',
    '/api/generate-studio-image',
  ].filter((item): item is string => Boolean(item)))], [configuredImageGeneratorEndpoint])
  const imageGeneratorEndpoint = imageGeneratorEndpoints[0] || '/api/ai/studio-image'

  const describeGeneratorFailure = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '')
    if (/admin_auth_required|admin access required|403/i.test(message)) return 'جلسة الإدارة غير مخوّلة لتوليد الصور. أعد تسجيل الدخول إلى لوحة التحكم ثم جرّب مجدداً.'
    if (/firebase_unavailable/i.test(message)) return 'تعذّر الوصول إلى جلسة Firebase، لذلك لم يصل طلب التوليد إلى الخادم.'
    if (/generator_backend_revision_missing|route_missing|HTTP 404|Not Found/i.test(message)) return 'خدمة dr-api المنشورة لا تتضمن مسار التوليد الحالي. حدّث الخدمة ثم أعد المحاولة.'
    if (/not configured|account is not configured/i.test(message)) return 'مسار dr-api يعمل، لكن بيانات Cloudflare Workers AI غير مربوطة في بيئة Cloud Run. لم أستبدل الصورة بصورة جاهزة كي يبقى الفرق واضحاً.'
    if (/daily free allocation exhausted|10[,.]?000 neurons|free allocation|errorCode=3036/i.test(message)) {
      const resetAt = /resetAt=([^\s·]+)/i.exec(message)?.[1]
      const parsedReset = resetAt ? new Date(resetAt) : null
      const resetLabel = parsedReset && Number.isFinite(parsedReset.getTime())
        ? new Intl.DateTimeFormat('ar-KW-u-nu-latn', { timeZone: 'Asia/Kuwait', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(parsedReset)
        : '03:05 صباحاً بتوقيت الكويت'
      return `انتهى رصيد Cloudflare اليومي الخارجي (الخطأ 3036). التجديد الرسمي عند 00:00 UTC، أي 03:00 في الكويت؛ وإذا جربت في لحظة الثالثة فامنح Cloudflare دقائق التحديث. المحاولة الآمنة التالية: ${resetLabel}.`
    }
    if (/timed out|abort|504/i.test(message)) return 'انتهت مهلة التوليد قبل وصول الصورة. سيحاول الاستوديو بالمسار المحلي الاحتياطي.'
    if (/busy|temporar|rate.?limit|resource exhausted|429|503/i.test(message)) return 'خدمة التوليد مزدحمة مؤقتاً. حاول الاستوديو تلقائياً بتأخير متدرج من دون استبدال الصورة بصورة جاهزة؛ أعد التوليد لاحقاً إذا استمر ضغط الخدمة.'
    if (/analysis_failed/i.test(message)) return 'وصلت الصورة المولدة، لكن الجهاز لم يتمكن من فتحها داخل المحرر. سيعيد النظام فكها بمسار آمن في المحاولة التالية.'
    if (/semantic_rejected|تعذّر اعتماد الصورة دلالياً|HTTP 422/i.test(message)) return 'رُفضت الصورة لأنها لم تمثّل المعنى الكامل أو أسقطت عنصراً أساسياً من الفكرة. لم تُركّب داخل التصميم؛ أعد التوليد ليُبنى مشهد مختلف فعلياً.'
    if (/no usable image|empty/i.test(message)) return 'خدمة التوليد لم ترسل بيانات صورة قابلة للفتح؛ سيعيد النظام الطلب ببذرة جديدة بدل استخدام صورة جاهزة.'
    return `تعذّر توليد الصورة الأصلية: ${message || 'فشل غير معروف في خدمة التوليد'}. لم يستخدم النظام صورة جاهزة بدلاً منها.`
  }

  const archiveGeneratedDesigns = async (generatedPlans: CompositionPlan[], generationKind = 'توليد') => {
    if (!generatedPlans.length) return
    try {
      const [app, db] = await Promise.all([getFirebaseApp(), getDb()])
      if (!app || !db) return
      const [{ getStorage, ref, uploadBytes }, { doc, serverTimestamp, setDoc }] = await Promise.all([import('firebase/storage'), import('firebase/firestore')])
      const storage = getStorage(app)
      const createdAtMs = Date.now()
      /* مكتبة الصور تبقى تاريخاً كاملاً، أما التصميم المركّب فله سجل واحد:
         آخر نسخة اعتمدها المستخدم. هذا يمنع امتلاء المكتبة بمرشحي الناقد
         والاتجاهات الداخلية التي لم يخترها أحد. */
      const cleanPlan = JSON.parse(JSON.stringify(generatedPlans[0])) as CompositionPlan
      const id = 'latest-approved'
      const storagePath = 'admin-generated-designs/latest-approved.json'
      const payload = JSON.stringify({ version: 1, plan: cleanPlan, generationKind, archivedAt: new Date(createdAtMs).toISOString() })
      if (payload.length > 15 * 1024 * 1024) throw new Error('generated_design_too_large')
      const thumbnail = await generatedDesignThumbnailDataUri(cleanPlan)
      await uploadBytes(ref(storage, storagePath), new Blob([payload], { type: 'application/json' }), {
        contentType: 'application/json',
        customMetadata: { source: 'social-design-studio', generationKind, archivePolicy: 'latest-approved-only' },
      })
      const asset: GeneratedDesignLibraryAsset = {
        id,
        storagePath,
        title: (cleanPlan.content?.title || creativeBrief.issue || text || 'آخر تصميم معتمد').replace(/\s+/g, ' ').trim().slice(0, 140),
        note: (cleanPlan.rationale?.[0] || cleanPlan.directionLabel || generationKind).replace(/\s+/g, ' ').trim().slice(0, 180),
        thumbnail,
        formatId: cleanPlan.format?.id || '',
        formatLabel: cleanPlan.format?.label || '',
        width: cleanPlan.format?.width || 0,
        height: cleanPlan.format?.height || 0,
        quality: cleanPlan.quality?.score || 0,
        directionLabel: cleanPlan.directionLabel || '',
        generationKind,
        topic: (creativeBrief.issue || text || cleanPlan.content?.title || '').replace(/\s+/g, ' ').trim().slice(0, 160),
        visualWorld: cleanPlan.directionLabel || '',
        campaign: /(?:حملة|campaign)/i.test(generationKind) ? generationKind : '',
        createdAtMs,
      }
      await setDoc(doc(db, 'admin_generated_designs', id), { ...asset, createdAt: serverTimestamp(), archivePolicy: 'latest-approved-only' })
      setGeneratedDesignLibraryAssets([asset])
      setGeneratedDesignLibraryHasMore(false)
      setGeneratedDesignLibraryError('')
    } catch (error) {
      const detail = error instanceof Error && error.message === 'generated_design_too_large'
        ? 'أحد التصاميم كبير جداً للحفظ الآمن؛ بقي داخل الجلسة الحالية.'
        : 'التصميم وُلّد بنجاح، لكن تعذّر أرشفته سحابياً في مكتبة التوليد. راجع نشر قواعد Storage/Firestore.'
      setGeneratedDesignLibraryError(detail)
    }
  }

  const useGeneratedDesignLibraryAsset = async (asset: GeneratedDesignLibraryAsset) => {
    setGeneratedDesignLibraryBusy(true)
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('firebase_unavailable')
      const { getBlob, getStorage, ref } = await import('firebase/storage')
      const blob = await getBlob(ref(getStorage(app), asset.storagePath), 18 * 1024 * 1024)
      const payload = JSON.parse(await blob.text()) as { version?: number; plan?: CompositionPlan }
      const plan = payload?.plan
      if (!plan?.id || !plan?.format || !plan?.content) throw new Error('invalid_generated_design')
      setPlans((previous) => [plan, ...previous.filter((item) => item.id !== plan.id)].slice(0, 8))
      setSelected(plan)
      setStage('edit')
      const hero = plan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && item.src)
      if (hero?.src) {
        const passport = await analyzeGeneratedStudioImage(hero.src, `${asset.id}.jpg`)
        if (passport) setImagePassport(passport)
        setImageDescription(hero.semanticDescription || asset.title)
        setImageSource(hero.sourceUrl || 'مكتبة التوليد الخاصة')
        setImageOwner(hero.owner || 'أصل محفوظ مع التصميم')
        setImageLicense(hero.license || 'أصل محفوظ داخل مكتبة خاصة')
        setVisualOrigin(hero.sourceUrl?.startsWith('http') ? 'ready' : 'generated')
      }
      setNotice('فُتح التصميم الكامل من مكتبة التوليد وأصبح جاهزاً للتحرير أو إعادة التصدير.')
    } catch {
      setNotice('تعذّر فتح التصميم المحفوظ الآن. لم تُستبدل النسخة الحالية.')
    } finally { setGeneratedDesignLibraryBusy(false) }
  }

  const deleteGeneratedDesignLibraryAsset = async (asset: GeneratedDesignLibraryAsset) => {
    if (!window.confirm('حذف هذا التصميم نهائياً من مكتبة التوليد؟')) return
    setGeneratedDesignLibraryBusy(true)
    try {
      const [app, db] = await Promise.all([getFirebaseApp(), getDb()])
      if (!app || !db) throw new Error('firebase_unavailable')
      const [{ deleteObject, getStorage, ref }, { deleteDoc, doc }] = await Promise.all([import('firebase/storage'), import('firebase/firestore')])
      try {
        await deleteObject(ref(getStorage(app), asset.storagePath))
      } catch (storageError) {
        const code = String((storageError as { code?: unknown })?.code || '')
        if (!code.includes('object-not-found')) throw storageError
      }
      await deleteDoc(doc(db, 'admin_generated_designs', asset.id))
      setGeneratedDesignLibraryAssets((previous) => previous.filter((item) => item.id !== asset.id))
      setNotice('حُذف التصميم من مكتبة التوليد.')
    } catch { setNotice('تعذّر حذف التصميم الآن.') }
    finally { setGeneratedDesignLibraryBusy(false) }
  }

  // البحث الخارجي لا يعمل أثناء الكتابة؛ يبدأ فقط من زر البحث أو من الطيار الآلي.
  // هذا يمنع تراكم الطلبات وتعليق الهاتف عند كل تغيير في النص.
  const clicheWarnings = useMemo(() => detectVisualCliches(imageDescription), [imageDescription])
  useEffect(() => {
    try { localStorage.setItem('dr-ahmad-creative-identity-v1', JSON.stringify(creativeIdentity)) } catch { /* الذاكرة اختيارية */ }
  }, [creativeIdentity])
  /* لوحة «ما فهمه الاستوديو» (مقترح الصديق ٧) */
  const [commandParse, setCommandParse] = useState<StudioCommandParse | null>(null)
  const [speechEdit, setSpeechEdit] = useState('')

  const generate = (overrides: { tone?: ContentTone | 'auto'; density?: DesignDensity | 'auto'; platform?: SocialPlatform | 'auto'; count?: number; preferLayout?: LayoutFamilyId } = {}) => {
    if (text.trim().length < 2) {
      setNotice('اكتب كلمة أو فكرة أولاً؛ المحرك لا يصنع تصميماً فارغاً.')
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
      context: [expertContext, parsed.contextHint].filter(Boolean).join(' · '),
      author: 'د. أحمد حسين الفيلكاوي',
      tone: overrides.tone ?? (parsed.tone || tone),
      density: overrides.density ?? (parsed.noBody ? 'minimal' : density),
      platform: overrides.platform ?? (parsed.platform || platform),
      ...(parsed.format ? { format: parsed.format } : {}),
      count: 8,
      seed: `${text}:${expertContext}:${domainUnderstanding.recognizedTerms.slice(0, 5).map((item) => item.id).join('-') || domainUnderstanding.primary?.id || 'general'}:${nextGeneration}:${Date.now()}`,
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
    setNotice(result.generation.warnings[0] || 'فحص المخرج ثمانية احتمالات داخلياً، ثم اختار ثلاث رؤى متباعدة بدل نتائج متقاربة.')
  }

  /* ═══ رنين القراء: الجمل التي ظللها جمهورك الحقيقي — بضغطة تصير تصميماً ═══ */
  const { articles: cmsArticles, books: cmsBooks } = useCmsContent()
  const libraryImages = useMemo(() => {
    const normalize = (value: string) => value.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()
    const wanted = new Set(normalize(`${text} ${context}`).split(' ').filter((word) => word.length > 2))
    const score = (value: string) => normalize(value).split(' ').reduce((sum, word) => sum + (wanted.has(word) ? 1 : 0), 0)
    const candidates: StudioLibraryImage[] = [
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

  const generatedLibraryLoadedRef = useRef(false)
  useEffect(() => {
    if (generatedLibraryLoadedRef.current) return
    generatedLibraryLoadedRef.current = true
    void (async () => {
      setGeneratedLibraryBusy(true)
      try {
        const db = await getDb()
        if (!db) return
        const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
        const snapshot = await getDocs(query(collection(db, 'admin_generated_assets'), orderBy('createdAtMs', 'desc'), limit(80)))
        const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as GeneratedLibraryAsset))
          .filter((entry) => entry.storagePath && entry.thumbnail)
        setGeneratedLibraryAssets(rows)
        setGeneratedLibraryHasMore(rows.length === 80)
        setGeneratedLibraryError('')
      } catch {
        setGeneratedLibraryError('تعذّر تحميل مكتبة التوليد الآن؛ الاستوديو نفسه ما زال يعمل.')
      } finally { setGeneratedLibraryBusy(false) }
    })()
  }, [])

  const generatedDesignLibraryLoadedRef = useRef(false)
  useEffect(() => {
    if (generatedDesignLibraryLoadedRef.current) return
    generatedDesignLibraryLoadedRef.current = true
    void (async () => {
      setGeneratedDesignLibraryBusy(true)
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'admin_generated_designs', 'latest-approved'))
        const asset = snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as GeneratedDesignLibraryAsset) : null
        setGeneratedDesignLibraryAssets(asset?.storagePath && asset.title ? [asset] : [])
        setGeneratedDesignLibraryHasMore(false)
        setGeneratedDesignLibraryError('')
      } catch {
        setGeneratedDesignLibraryError('تعذّر تحميل آخر تصميم معتمد الآن؛ التوليد والتحرير ما زالا يعملان بصورة مستقلة.')
      } finally { setGeneratedDesignLibraryBusy(false) }
    })()
  }, [])

  const loadOlderGeneratedDesigns = async () => {
    setGeneratedDesignLibraryHasMore(false)
  }

  const loadOlderGeneratedImages = async () => {
    const before = generatedLibraryAssets[generatedLibraryAssets.length - 1]?.createdAtMs
    if (!before || generatedLibraryBusy) return
    setGeneratedLibraryBusy(true)
    try {
      const db = await getDb()
      if (!db) return
      const { collection, getDocs, limit, orderBy, query, where } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, 'admin_generated_assets'), where('createdAtMs', '<', before), orderBy('createdAtMs', 'desc'), limit(80)))
      const rows = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() } as GeneratedLibraryAsset)).filter((entry) => entry.storagePath && entry.thumbnail)
      setGeneratedLibraryAssets((previous) => {
        const seen = new Set(previous.map((item) => item.id))
        return [...previous, ...rows.filter((item) => !seen.has(item.id))]
      })
      setGeneratedLibraryHasMore(rows.length === 80)
    } catch { setGeneratedLibraryError('تعذّر تحميل الدفعة الأقدم من الأصول البصرية الآن.') }
    finally { setGeneratedLibraryBusy(false) }
  }

  const archiveGeneratedImage = async (generated: GeneratedStudioImage) => {
    const file = generatedImageFileFromDataUri(generated.passport.dataUrl, `dr-ahmad-ai-${Date.now()}`)
    if (!file) return
    // كل توليد يأخذ سجلاً مستقلاً حتى لو أعاد الخادم requestId نفسه؛ لا نكتب فوق أصل قديم أبداً.
    const requestToken = (generated.requestId || 'generated').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64) || 'generated'
    const id = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${requestToken}`.slice(0, 120)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : file.type === 'image/avif' ? 'avif' : 'jpg'
    const storagePath = `admin-generated/${id}.${ext}`
    const createdAtMs = Date.now()
    const thumbnail = await generatedThumbnailDataUri(generated.passport.dataUrl)
    const title = (creativeBrief.issue || text || 'توليد بصري').replace(/\s+/g, ' ').trim().slice(0, 120)
    const note = (generated.metadata.visualWorldLabel || generated.metadata.visualWorld || generated.metadata.description || 'صورة مولدة داخل الاستوديو').slice(0, 180)
    try {
      const [app, db] = await Promise.all([getFirebaseApp(), getDb()])
      if (!app || !db) return
      const [{ getStorage, ref, uploadBytes }, { doc, serverTimestamp, setDoc }] = await Promise.all([import('firebase/storage'), import('firebase/firestore')])
      const storage = getStorage(app)
      await uploadBytes(ref(storage, storagePath), file, {
        contentType: file.type,
        customMetadata: { source: 'social-design-studio', requestId: id },
      })
      const asset: GeneratedLibraryAsset = {
        id, storagePath, title, note, thumbnail, mime: file.type, width: generated.passport.width, height: generated.passport.height,
        prompt: generated.prompt || '', model: generated.model || '', generatedAt: generated.generatedAt || new Date(createdAtMs).toISOString(),
        visualWorld: generated.metadata.visualWorldLabel || generated.metadata.visualWorld || '', description: generated.metadata.description || '', createdAtMs,
      }
      await setDoc(doc(db, 'admin_generated_assets', id), { ...asset, createdAt: serverTimestamp() }, { merge: true })
      setGeneratedLibraryAssets((previous) => [asset, ...previous.filter((item) => item.id !== id)])
      setGeneratedLibraryError('')
    } catch {
      setGeneratedLibraryError('الصورة وُلّدت بنجاح، لكن تعذّر أرشفتها سحابياً في مكتبة التوليد. راجع نشر قواعد Storage/Firestore.')
    }
  }

  const useGeneratedLibraryAsset = async (asset: GeneratedLibraryAsset) => {
    setGeneratedLibraryBusy(true)
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('firebase_unavailable')
      const { getBlob, getStorage, ref } = await import('firebase/storage')
      const blob = await getBlob(ref(getStorage(app), asset.storagePath), 18 * 1024 * 1024)
      const file = new File([blob], asset.storagePath.split('/').pop() || `${asset.id}.jpg`, { type: asset.mime || blob.type || 'image/jpeg' })
      const passport = await analyzeStudioImageFromFile(file)
      if (!passport) throw new Error('analysis_failed')
      setImagePassport(passport)
      setImageDescription(asset.description || asset.title)
      setImageSource('مكتبة التوليد الخاصة')
      setImageOwner('توليد أصلي داخل الاستوديو')
      setImageLicense('أصل مولد ومحفوظ في مكتبة خاصة')
      setGeneratedPrompt(asset.prompt)
      setGeneratedModel(asset.model)
      setGeneratedAt(asset.generatedAt)
      setGeneratedVisualWorld(asset.visualWorld)
      setVisualOrigin('generated')
      setVisualFailure('')
      if (selected) {
        const metadata: StudioImageMetadata = {
          source: 'مكتبة التوليد الخاصة',
          owner: 'توليد أصلي داخل الاستوديو',
          license: 'أصل مولد ومحفوظ في مكتبة خاصة',
          description: asset.description || asset.title,
          visualWorldLabel: asset.visualWorld,
        }
        syncPlanEverywhere(buildImageLedPlan(selected, 'cinematic', passport, metadata))
        setStage('edit')
        setNotice('فُتحت الصورة المولدة وأعاد المخرج بناء التكوين حول نقطة تركيزها ومساحة النص، لا كخلفية عادية.')
      } else {
        setNotice('فُتحت الصورة من مكتبة التوليد. اختر اتجاهاً وسيبني المخرج تكويناً إبداعياً حولها.')
      }
    } catch {
      setNotice('تعذّر فتح الأصل من مكتبة التوليد الآن. لم تُستبدل الصورة الحالية.')
    } finally { setGeneratedLibraryBusy(false) }
  }

  const deleteGeneratedLibraryAsset = async (asset: GeneratedLibraryAsset) => {
    if (!window.confirm('حذف هذه الصورة نهائياً من مكتبة التوليد؟')) return
    setGeneratedLibraryBusy(true)
    try {
      const [app, db] = await Promise.all([getFirebaseApp(), getDb()])
      if (!app || !db) throw new Error('firebase_unavailable')
      const [{ deleteObject, getStorage, ref }, { deleteDoc, doc }] = await Promise.all([import('firebase/storage'), import('firebase/firestore')])
      try {
        await deleteObject(ref(getStorage(app), asset.storagePath))
      } catch (storageError) {
        const code = String((storageError as { code?: unknown })?.code || '')
        if (!code.includes('object-not-found')) throw storageError
      }
      await deleteDoc(doc(db, 'admin_generated_assets', asset.id))
      setGeneratedLibraryAssets((previous) => previous.filter((item) => item.id !== asset.id))
      setNotice('حُذفت الصورة من مكتبة التوليد.')
    } catch { setNotice('تعذّر حذف الصورة الآن.') }
    finally { setGeneratedLibraryBusy(false) }
  }

  const verifyGenerationLibraryStorage = async () => {
    setGenerationStorageStatus('checking')
    setGenerationStorageMessage('أتحقق من الحاوية والقواعد بصلاحية المشرف…')
    let cleanup: (() => Promise<void>) | null = null
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const [{ getAuth, getIdTokenResult }, storageModule] = await Promise.all([import('firebase/auth'), import('firebase/storage')])
      const user = getAuth(app).currentUser
      if (!user) throw new Error('سجّل الدخول إلى لوحة التحكم أولاً.')
      const token = await getIdTokenResult(user, true)
      if (token.claims.admin !== true) throw new Error('الحساب الحالي لا يحمل صلاحية admin.')
      const storage = storageModule.getStorage(app)
      const sentinelName = `health-${user.uid.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 48)}-${Date.now()}.json`
      const target = storageModule.ref(storage, `admin-generated-designs/${sentinelName}`)
      cleanup = async () => { try { await storageModule.deleteObject(target) } catch { /* ملف الفحص قد يكون حُذف بالفعل */ } }
      const payload = JSON.stringify({ ok: true, scope: 'generation-library', at: new Date().toISOString() })
      await storageModule.uploadBytes(target, new Blob([payload], { type: 'application/json' }), {
        contentType: 'application/json',
        customMetadata: { source: 'generation-library-health-check' },
      })
      const downloaded = await storageModule.getBlob(target, 4096)
      const parsed = JSON.parse(await downloaded.text()) as { ok?: boolean; scope?: string }
      if (parsed.ok !== true || parsed.scope !== 'generation-library') throw new Error('فشل التحقق من قراءة الملف بعد رفعه.')
      await cleanup()
      cleanup = null
      setGenerationStorageStatus('ready')
      setGenerationStorageMessage('Firebase Storage جاهز: نجح الرفع والقراءة والحذف داخل مكتبة التوليد.')
      return true
    } catch (reason) {
      if (cleanup) await cleanup()
      const value = reason as { code?: string; message?: string }
      const code = String(value?.code || '')
      const detail = code === 'storage/unauthorized'
        ? 'قواعد Storage لم تسمح لمسار مكتبة التوليد. أعد نشر storage.rules ثم جرّب الفحص.'
        : code === 'storage/bucket-not-found'
          ? 'حاوية Firebase Storage غير مفعّلة أو اسمها غير صحيح في drahmad-8e9e2.'
          : code === 'storage/quota-exceeded'
            ? 'حصة Firebase Storage أو خطة المشروع تمنع الكتابة حالياً.'
            : value?.message || 'تعذّر اختبار Firebase Storage.'
      setGenerationStorageStatus('failed')
      setGenerationStorageMessage(detail)
      return false
    }
  }

  const backfillGenerationLibrary = async () => {
    if (generationBackfillBusy) return
    const candidates = savedPlans.filter((plan) => plan?.id && plan?.format && plan?.content)
    if (!candidates.length) {
      setGenerationBackfillSummary('لا توجد تصاميم كاملة قديمة قابلة للاستعادة في هذا المتصفح.')
      return
    }
    setGenerationBackfillBusy(true)
    setGenerationBackfillSummary('أفحص المحفوظات المحلية وأستعيد ما يمكن إثباته فقط…')
    try {
      const storageReady = generationStorageStatus === 'ready' || await verifyGenerationLibraryStorage()
      if (!storageReady) throw new Error('storage_not_ready')
      const [app, db] = await Promise.all([getFirebaseApp(), getDb()])
      if (!app || !db) throw new Error('firebase_unavailable')
      const [storageModule, firestoreModule] = await Promise.all([import('firebase/storage'), import('firebase/firestore')])
      const storage = storageModule.getStorage(app)
      const archivedImages: GeneratedLibraryAsset[] = []
      let imageCount = 0
      await archiveGeneratedDesigns([candidates[0]], 'استعادة آخر تصميم معتمد')
      for (const [index, plan] of candidates.entries()) {
        const fingerprint = (plan.fingerprint || plan.id || `saved-${index}`).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 84) || `saved-${index}`
        const cleanPlan = JSON.parse(JSON.stringify(plan)) as CompositionPlan
        const createdAtMs = Date.now() - index

        const hero = cleanPlan.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background' && typeof item.src === 'string' && item.src.startsWith('data:image/'))
        if (!hero?.src) continue
        const legacyFile = generatedImageFileFromDataUri(hero.src, `legacy-${fingerprint}`)
        if (!legacyFile) continue
        const imageId = `legacy-image-${fingerprint}`.slice(0, 120)
        const ext = legacyFile.type === 'image/png' ? 'png' : legacyFile.type === 'image/webp' ? 'webp' : legacyFile.type === 'image/gif' ? 'gif' : legacyFile.type === 'image/avif' ? 'avif' : 'jpg'
        const imageStoragePath = `admin-generated/${imageId}.${ext}`
        await storageModule.uploadBytes(storageModule.ref(storage, imageStoragePath), legacyFile, {
          contentType: legacyFile.type, customMetadata: { source: 'social-design-studio-backfill', fingerprint },
        })
        const passport = await analyzeGeneratedStudioImage(hero.src, legacyFile.name)
        const imageAsset: GeneratedLibraryAsset = {
          id: imageId, storagePath: imageStoragePath,
          title: (cleanPlan.content?.title || cleanPlan.directionLabel || 'أصل بصري محفوظ').replace(/\s+/g, ' ').trim().slice(0, 120),
          note: 'أصل بصري استُعيد من تصميم محفوظ محلياً قبل إنشاء مكتبة التوليد.',
          thumbnail: await generatedThumbnailDataUri(hero.src), mime: legacyFile.type,
          width: passport?.width || cleanPlan.format?.width || 0, height: passport?.height || cleanPlan.format?.height || 0,
          prompt: '', model: 'legacy-local-backfill', generatedAt: new Date(createdAtMs).toISOString(),
          visualWorld: cleanPlan.directionLabel || '', description: hero.semanticDescription || cleanPlan.content?.title || '', createdAtMs,
        }
        await firestoreModule.setDoc(firestoreModule.doc(db, 'admin_generated_assets', imageId), { ...imageAsset, backfilled: true, createdAt: firestoreModule.serverTimestamp() }, { merge: true })
        archivedImages.push(imageAsset)
        imageCount += 1
      }
      setGeneratedLibraryAssets((previous) => {
        const map = new Map(previous.map((item) => [item.id, item]))
        for (const item of archivedImages) map.set(item.id, item)
        return [...map.values()].sort((a, b) => b.createdAtMs - a.createdAtMs)
      })
      const summary = `استُعيد آخر تصميم معتمد و${imageCount} أصل بصري قديم قابل للإثبات.`
      setGenerationBackfillSummary(summary)
      try { localStorage.setItem(GENERATION_LIBRARY_BACKFILL_KEY, JSON.stringify({ at: new Date().toISOString(), designs: 1, images: imageCount })) } catch { /* لا نعطل الاستعادة */ }
    } catch (reason) {
      setGenerationBackfillSummary(reason instanceof Error && reason.message === 'storage_not_ready'
        ? 'توقفت الاستعادة لأن Firebase Storage لم يجتز الفحص الفعلي.'
        : 'تعذّرت استعادة المحفوظات القديمة الآن؛ لم يُحذف أي شيء محلي.')
    } finally {
      setGenerationBackfillBusy(false)
    }
  }

  const storageHealthAutoCheckedRef = useRef(false)
  useEffect(() => {
    if (storageHealthAutoCheckedRef.current) return
    storageHealthAutoCheckedRef.current = true
    let unsubscribe: (() => void) | undefined
    void (async () => {
      try {
        const app = await getFirebaseApp()
        if (!app) return
        const { getAuth, onAuthStateChanged } = await import('firebase/auth')
        unsubscribe = onAuthStateChanged(getAuth(app), (user) => {
          if (!user || generationStorageStatus !== 'idle') return
          void verifyGenerationLibraryStorage()
        })
      } catch { /* يبقى زر إعادة الفحص متاحاً داخل المكتبة */ }
    })()
    return () => unsubscribe?.()
    // الفحص مرة واحدة عند دخول الاستوديو؛ زر إعادة الفحص يغطي أي تغيير لاحق.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (!result) { setNotice('تعذّر تحليل الصورة محلياً. جرّب PNG أو JPG آخر.'); return }
      setImagePassport(result)
      setImageDescription((value) => value || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      if (selected) {
        syncPlanEverywhere(buildImageLedPlan(selected, 'editorial', result, {
          source: imageSource || 'صورة رفعها المستخدم',
          owner: imageOwner || 'المستخدم',
          license: imageLicense || 'تحتاج مراجعة الحقوق قبل النشر',
          description: imageDescription || file.name.replace(/\.[^.]+$/, ''),
        }))
        setStage('edit')
        setNotice('حُللت الصورة وأُعيد بناء التكوين إبداعياً حول نقطة تركيزها والمساحة الهادئة فيها.')
      } else {
        setNotice('اكتملت معالجة جواز الصورة: القص، نقطة التركيز، المساحة الهادئة والتباين. اختر اتجاهاً ليُبنى التكوين حولها.')
      }
    } catch { setNotice('تعذّر إعداد جواز الصورة الآن.') }
    finally { setImageBusy(false) }
  }
  const resolveLibraryImagePassport = async (item: StudioLibraryImage) => {
    let passport = await analyzeStudioImageFromUrl(item.url, item.title)
    if (!passport) {
      const probe = await probeImageUrl(item.url, 4_000)
      if (!probe) return null
      const width = probe.width || 1200
      const height = probe.height || 900
      const aspectRatio = width / Math.max(1, height)
      passport = {
        dataUrl: probe.url,
        fileName: item.title,
        mime: 'image/jpeg',
        width,
        height,
        aspectRatio,
        orientation: aspectRatio > 1.08 ? 'landscape' : aspectRatio < .92 ? 'portrait' : 'square',
        luminance: 50,
        contrast: 45,
        edgeDensity: 35,
        visualScore: 68,
        zoneScores: { right: 35, left: 35, top: 35, bottom: 35 },
        negativeSpace: 'balanced',
        focalX: .5,
        focalY: .5,
        recommendedFit: 'cover',
        cropRisk: 'medium',
        cropNotes: ['تعذّر تحليل البكسلات محلياً؛ استُخدم قص مركزي آمن لصورة موثقة من مكتبة الموقع.'],
      }
    }
    return {
      passport,
      metadata: {
        source: item.url,
        owner: 'مكتبة الموقع',
        license: 'أصل داخلي موثق؛ راجع حقوق الغلاف قبل النشر الخارجي',
        description: `${item.title} — ${item.note}`,
      } satisfies StudioImageMetadata,
    }
  }

  const runLibraryImage = async (item: StudioLibraryImage) => {
    setImageBusy(true)
    try {
      const resolved = await resolveLibraryImagePassport(item)
      if (!resolved) { setNotice('تعذّر فتح هذه الصورة من مكتبة الموقع الآن. لم تُستبدل الصورة الحالية.'); return }
      setImagePassport(resolved.passport)
      setImageDescription(resolved.metadata.description || item.title)
      setImageSource(resolved.metadata.source || item.url)
      setImageOwner(resolved.metadata.owner || 'مكتبة الموقع')
      setImageLicense(resolved.metadata.license || '')
      setVisualOrigin('ready')
      setVisualFailure('')
      if (selected) {
        syncPlanEverywhere(buildImageLedPlan(selected, 'editorial', resolved.passport, resolved.metadata))
        setStage('edit')
        setNotice('أعاد المخرج بناء التكوين حول الصورة المختارة مع قص واعٍ ومساحة قراءة، لا كتركيب تلقائي جامد.')
      } else {
        setNotice('اختيرت صورة من مكتبة الموقع وحُللت محلياً. اختر اتجاهاً ليُبنى حولها تكوين إبداعي.')
      }
    } catch { setNotice('تعذّر إعداد جواز الصورة من مكتبة الموقع.') }
    finally { setImageBusy(false) }
  }

  const resolveExternalVisualPassport = async (item: ExternalVisualResult) => {
    const urls = [...new Set([item.imageUrl, item.thumbnailUrl].filter(Boolean))]
    let passport: StudioImagePassport | null = null
    let workingUrl = ''
    for (const url of urls) {
      passport = await analyzeStudioImageFromUrl(url, item.title)
      if (passport) { workingUrl = url; break }
    }
    if (!passport) {
      for (const url of urls) {
        const probe = await probeImageUrl(url, 4000)
        if (!probe) continue
        workingUrl = probe.url
        const width = item.width || probe.width || 1200
        const height = item.height || probe.height || 900
        const aspectRatio = width / Math.max(1, height)
        passport = {
          dataUrl: workingUrl,
          fileName: item.title || 'external-image',
          mime: 'image/jpeg',
          width,
          height,
          aspectRatio,
          orientation: aspectRatio > 1.08 ? 'landscape' : aspectRatio < .92 ? 'portrait' : 'square',
          luminance: 50,
          contrast: 45,
          edgeDensity: 35,
          visualScore: 66,
          zoneScores: { right: 35, left: 35, top: 35, bottom: 35 },
          negativeSpace: 'balanced',
          focalX: .5,
          focalY: .5,
          recommendedFit: 'cover',
          cropRisk: 'medium',
          cropNotes: ['تعذّر تحليل البكسلات بسبب قيود المصدر؛ استُخدم قص مركزي آمن ويمكن ضبط نقطة التركيز يدوياً.', 'المصدر والترخيص محفوظان في جواز الصورة.'],
        }
        break
      }
    }
    if (!passport) return null
    return {
      passport,
      metadata: {
        source: item.pageUrl || workingUrl || item.imageUrl,
        owner: item.author,
        license: item.license,
        description: item.description || item.title,
      },
    }
  }

  const applyExternalVisual = async (item: ExternalVisualResult, autoTreatment?: NonNullable<PlanOverlay['imageTreatment']>) => {
    if (imageBusy) return
    setImageBusy(true)
    try {
      const resolved = await resolveExternalVisualPassport(item)
      if (!resolved) {
        setExternalVisuals((items) => items.filter((candidate) => candidate.id !== item.id))
        setNotice('هذه الصورة غير قابلة للتحميل من المصدر الحالي، فتم استبعادها. اختر المرشح التالي.')
        return
      }
      const { passport, metadata } = resolved
      setImagePassport(passport)
      setImageDescription(metadata.description || '')
      setImageSource(metadata.source || '')
      setImageOwner(metadata.owner || '')
      setImageLicense(metadata.license || '')
      setVisualOrigin('ready')
      setVisualFailure('')
      if (autoTreatment || selected) {
        applyImageLedDirection(autoTreatment || (visualSearchPlan.tone === 'documentary' ? 'documentary' : 'editorial'), passport, metadata)
      } else {
        setNotice(`اختيرت صورة جاهزة من ${item.providerLabel} وأُنشئ جوازها. اختر اتجاهاً ليعيد المخرج بناء التصميم حولها.`)
      }
    } catch {
      setExternalVisuals((items) => items.filter((candidate) => candidate.id !== item.id))
      setNotice('تعذّر تحميل هذا المرشح وتم استبعاده تلقائياً. اختر صورة أخرى.')
    } finally { setImageBusy(false) }
  }
  const runExternalSearch = async (overrideQuery?: string) => {
    if (!hasInput || externalBusy) return
    const query = (overrideQuery || externalQuery || visualSearchPlan.queries[0] || visualSearchPlan.headline).trim()
    if (!query) return
    const signature = `${query}::${visualSearchPlan.queries.join('|')}::${visualSearchPlan.englishQueries.join('|')}`
    const sequence = ++externalSearchSequenceRef.current
    setExternalBusy(true)
    setExternalError('')
    setLastVisualSearchSignature(signature)
    try {
      const queryPlan = { ...visualSearchPlan, queries: [query, ...visualSearchPlan.queries.filter((item) => item !== query)] }
      const rawResults = await searchExternalVisualSources(queryPlan, 12)
      if (sequence !== externalSearchSequenceRef.current) return
      const results = await verifyExternalVisuals(rawResults, 10)
      if (sequence !== externalSearchSequenceRef.current) return
      setExternalVisuals(results)
      setExternalQuery(query)
      setLastVisualSearchSignature(signature)
      if (results.length) setNotice(`تم التحقق من ${results.length} صور قابلة للعرض من المصادر المجانية؛ أُزيلت الروابط المكسورة تلقائياً.`)
      else setNotice('لم أجد صورة قابلة للتحميل بهذه العبارة. جرّب عبارة أقصر أو اختر مصدراً موثّقاً آخر.')
    } catch {
      if (sequence !== externalSearchSequenceRef.current) return
      setExternalVisuals([])
      setExternalError('توقف البحث ضمن المهلة المحددة حتى لا يعلق الاستوديو. جرّب مرة أخرى أو استخدم صورة من جهازك.')
      setNotice('أوقفت البحث ضمن المهلة الآمنة حتى لا يعلق الهاتف.')
    } finally {
      if (sequence === externalSearchSequenceRef.current) setExternalBusy(false)
    }
  }
  const copyGenerationPrompt = async () => {
    try {
      await navigator.clipboard.writeText(visualSearchPlan.generationPrompt)
      setNotice('نُسخ Prompt التوليد إلى الحافظة.')
    } catch {
      setNotice('تعذّر النسخ الآلي. انسخه يدوياً من الحقل الظاهر.')
    }
  }
  const requestGeneratedStudioImage = async (options: { regenerationId?: string; variation?: string; preferredWorld?: string; recentVisualWorlds?: string[]; candidateIndex?: number; textZone?: StudioImagePassport['negativeSpace'] } = {}): Promise<GeneratedStudioImage> => {
    const app = await getFirebaseApp()
    if (!app) throw new Error('firebase_unavailable')
    const { getAuth } = await import('firebase/auth')
    const user = getAuth(app).currentUser
    if (!user) throw new Error('admin_auth_required')
    const token = await user.getIdToken()
    const controller = new AbortController()
    /* قد يرفض ناقد الرؤية مرشحاً ويطلب من الخادم صناعة بديل كامل. نمنح
       الدورة وقتها بدل قطعها من المتصفح قبل مهلة Cloud Run بقليل. */
    const timer = window.setTimeout(() => controller.abort(), 285_000)
    try {
      const platformFormat: Record<SocialPlatform | 'auto', SocialFormatId> = {
        auto: 'instagram-portrait',
        instagram: 'instagram-portrait',
        story: 'story',
        reel: 'reel-cover',
        linkedin: 'linkedin-landscape',
        x: 'x-landscape',
        pinterest: 'pinterest-tall',
        presentation: 'widescreen-cover',
        thumbnail: 'video-thumbnail',
      }
      const targetFormat = selected?.format || SOCIAL_FORMATS[platformFormat[platform]]
      const requestBody = JSON.stringify({
        idea: text.trim(),
        context: context.trim(),
        issue: creativeBrief.issue,
        tension: creativeBrief.tension,
        emotion: creativeBrief.emotion,
        audience: creativeBrief.audience,
        visualReason: creativeBrief.visualReason,
        avoid: creativeBrief.avoid,
        persona: creativeIdentity.persona,
        lighting: creativeIdentity.lighting,
        negativeSpace: creativeIdentity.negativeSpace,
        orientation: targetFormat.width > targetFormat.height * 1.08
          ? 'landscape'
          : targetFormat.height > targetFormat.width * 1.08
            ? 'portrait'
            : 'square',
        targetWidth: targetFormat.width,
        targetHeight: targetFormat.height,
        formatId: targetFormat.id,
        textZone: options.textZone || (Number(options.candidateIndex || 0) % 3 === 0 ? 'right' : Number(options.candidateIndex || 0) % 3 === 1 ? 'bottom' : 'left'),
        prompt: visualSearchPlan.generationPrompt,
        glossaryConcept: visualSearchPlan.glossaryConcept,
        glossaryLabel: visualSearchPlan.glossaryLabel,
        glossaryCanonicalEn: visualSearchPlan.glossaryCanonicalEn,
        glossaryMeaning: visualSearchPlan.glossaryMeaning,
        glossaryScenes: visualSearchPlan.visualScenes,
        glossaryAvoid: visualSearchPlan.avoidTerms,
        preferredWorlds: options.preferredWorld ? [options.preferredWorld] : visualSearchPlan.preferredWorlds,
        moods: visualSearchPlan.moods,
        literalAnchors: visualSearchPlan.literalAnchors,
        candidateIndex: options.candidateIndex || 0,
        recentVisualWorlds: options.recentVisualWorlds || loadVisualWorldHistory(),
        regenerationId: options.regenerationId,
        variation: options.variation,
        generationMode,
      })
      let response: Response | null = null
      let lastRouteError = ''
      for (const endpoint of imageGeneratorEndpoints) {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          signal: controller.signal,
          body: requestBody,
        })
        if (response.status !== 404) break
        const missingPayload = await response.json().catch(() => ({})) as { error?: string; detail?: string; code?: string }
        lastRouteError = [missingPayload.error, missingPayload.detail, missingPayload.code, `HTTP ${response.status}`, endpoint].filter(Boolean).join(' · ')
      }
      if (!response || response.status === 404) throw new Error(`generator_backend_revision_missing · ${lastRouteError || 'HTTP 404'}`)
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string; detail?: string; code?: string }
        throw new Error([payload.error, payload.detail, payload.code, `HTTP ${response.status}`].filter(Boolean).join(' · '))
      }
      const payload = await response.json() as { imageUrl?: string; image?: string; imageBase64?: string; result?: { image?: string; imageUrl?: string }; sourceUrl?: string; owner?: string; license?: string; description?: string; prompt?: string; model?: string; generatedAt?: string; requestId?: string; visualWorld?: string; visualWorldLabel?: string; imageTreatment?: NonNullable<PlanOverlay['imageTreatment']>; layoutHint?: LayoutFamilyId; paletteHint?: PaletteId; conceptKey?: string; conceptLabel?: string; semanticScene?: string; relevanceScore?: number | null; relevanceReason?: string; generationAttempts?: number; imageMime?: string; imageBytes?: number; semanticVerified?: boolean | null; criticSource?: string; imageCaption?: string; missingAnchor?: string; literalSubjects?: string[]; visualScore?: number | null; visualReasons?: string[]; safeTextZone?: StudioImagePassport['negativeSpace']; zoneScores?: StudioImagePassport['zoneScores']; imageWidth?: number; imageHeight?: number; targetWidth?: number; targetHeight?: number; nativeAspect?: boolean; formatId?: string }
      const relevanceScore = typeof payload.relevanceScore === 'number' ? payload.relevanceScore : null
      const visualScore = typeof payload.visualScore === 'number' ? payload.visualScore : null
      /* لا نعتمد صورة فشل الناقد الدلالي ثم نطلب من المستخدم مراجعتها يدوياً؛
         هذا كان يسمح بمرور صورة جميلة لكنها لا تعبّر عن الفكرة. الحكم الصريح
         من الخادم نهائي، وأي نتيجة دون الحد تُرفض قبل تركيبها داخل التصميم. */
      if (payload.semanticVerified === false || (relevanceScore != null && relevanceScore < 86)) {
        throw new Error(`semantic_rejected · ${payload.relevanceReason || payload.missingAnchor || `score ${relevanceScore ?? 0}`}`)
      }
      if (visualScore != null && visualScore < 62) {
        throw new Error(`visual_rejected · ${(payload.visualReasons || []).join(', ') || `score ${visualScore}`}`)
      }
      const imageUrl = generatedImageDataUri(payload)
      if (!imageUrl) throw new Error('generator_empty')
      const analyzedPassport = await analyzeGeneratedStudioImage(imageUrl, `dr-ahmad-ai-${Date.now()}`)
      if (!analyzedPassport) throw new Error('generator_image_analysis_failed')
      const trustedSafeZone = payload.safeTextZone && payload.safeTextZone !== 'balanced'
        ? payload.safeTextZone
        : analyzedPassport.negativeSpace
      const passport: StudioImagePassport = {
        ...analyzedPassport,
        negativeSpace: trustedSafeZone,
        visualScore: typeof payload.visualScore === 'number' ? Math.round((analyzedPassport.visualScore + payload.visualScore) / 2) : analyzedPassport.visualScore,
        zoneScores: payload.zoneScores || analyzedPassport.zoneScores,
        cropRisk: payload.nativeAspect ? 'low' : analyzedPassport.cropRisk,
        cropNotes: [
          payload.nativeAspect ? `وُلّدت الصورة أصلاً على نسبة ${payload.imageWidth || analyzedPassport.width}×${payload.imageHeight || analyzedPassport.height}؛ لا يوجد قصّ تعويضي في المقاس الأساسي.` : 'الصورة ليست مولّدة على النسبة الأصلية؛ يطبّق المحرك قصاً واعياً بحسب نقطة التركيز.',
          ...analyzedPassport.cropNotes,
        ],
      }
      const generated: GeneratedStudioImage = {
        passport,
        metadata: {
          source: payload.sourceUrl || 'مولد الصور الداخلي',
          owner: payload.owner || 'توليد أصلي داخل الاستوديو',
          license: payload.license || 'نموذج FLUX',
          description: payload.description || creativeBrief.issue,
          visualWorld: payload.visualWorld,
          visualWorldLabel: payload.visualWorldLabel,
          imageTreatment: payload.imageTreatment,
          layoutHint: payload.layoutHint,
          paletteHint: payload.paletteHint,
          conceptKey: payload.conceptKey,
          conceptLabel: payload.conceptLabel,
          semanticScene: payload.semanticScene,
          relevanceScore,
          relevanceReason: payload.relevanceReason,
          generationAttempts: payload.generationAttempts,
          semanticVerified: payload.semanticVerified,
          criticSource: payload.criticSource,
          imageCaption: payload.imageCaption,
          missingAnchor: payload.missingAnchor,
          literalSubjects: payload.literalSubjects,
          visualScore: payload.visualScore,
          visualReasons: payload.visualReasons,
          safeTextZone: payload.safeTextZone,
          zoneScores: payload.zoneScores,
          imageWidth: payload.imageWidth,
          imageHeight: payload.imageHeight,
          targetWidth: payload.targetWidth,
          targetHeight: payload.targetHeight,
          nativeAspect: payload.nativeAspect,
          formatId: payload.formatId,
        },
        prompt: payload.prompt || visualSearchPlan.generationPrompt,
        model: payload.model || '@cf/leonardo/phoenix-1.0',
        generatedAt: payload.generatedAt,
        requestId: payload.requestId,
      }
      await archiveGeneratedImage(generated)
      return generated
    } finally {
      window.clearTimeout(timer)
    }
  }

  const requestGeneratedStudioImageWithBackoff = async (
    options: NonNullable<Parameters<typeof requestGeneratedStudioImage>[0]> = {},
    maxAttempts = 2,
  ): Promise<GeneratedStudioImage> => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const attemptOptions = attempt === 0
          ? options
          : {
              ...options,
              regenerationId: `${options.regenerationId || 'studio'}-rescue-${attempt}`,
              candidateIndex: Number(options.candidateIndex || 0) + attempt,
              variation: [
                options.variation,
                'SEMANTIC RESCUE: build a materially different scene with every literal subject clearly visible.',
              ].filter(Boolean).join(' '),
            }
        return await requestGeneratedStudioImage(attemptOptions)
      } catch (error) {
        lastError = error
        const message = error instanceof Error ? error.message : String(error || '')
        const dailyQuotaExhausted = /daily free allocation exhausted|10[,.]?000 neurons|free allocation/i.test(message)
        const semanticRetry = /semantic_rejected|visual_rejected|تعذّر اعتماد الصورة (?:دلالياً|بصرياً)|HTTP 422/i.test(message)
        const transient = !dailyQuotaExhausted && /timed out|abort|busy|temporar|rate.?limit|resource exhausted|HTTP 429|HTTP 502|HTTP 503|HTTP 504/i.test(message)
        if ((!transient && !semanticRetry) || attempt === maxAttempts - 1) throw error
        const delayMs = semanticRetry ? 750 : 2_000 * (attempt + 1)
        setNotice(semanticRetry
          ? 'رفض فاحص الجودة المرشح الأول؛ أصنع الآن مشهداً مختلفاً وأفحصه من جديد…'
          : `خدمة الصور تحت ضغط لحظي؛ أحافظ على الفكرة وأعيد هذا المشهد تلقائياً بعد ${Math.round(delayMs / 1_000)} ثوانٍ…`)
        await new Promise<void>((resolve) => window.setTimeout(resolve, delayMs))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('generator_retry_exhausted')
  }


  const shouldUseLocalReserveFallback = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '')
    return !/admin_auth_required|admin access required|firebase_unavailable/i.test(message)
      && /daily free allocation exhausted|free allocation|timed out|abort|504|busy|temporar|rate.?limit|resource exhausted|429|503|not configured|route_missing|generator_backend_revision_missing|generator_empty|analysis_failed|visual_rejected|semantic_rejected|HTTP 404|Not Found/i.test(message)
  }

  const buildLocalReserveImage = async (options: { reason: string; candidateIndex?: number; preferredWorld?: string; textZone?: 'right' | 'left' | 'bottom' } = { reason: 'local-reserve' }): Promise<GeneratedStudioImage> => {
    const platformFormat: Record<SocialPlatform | 'auto', SocialFormatId> = {
      auto: 'instagram-portrait',
      instagram: 'instagram-portrait',
      story: 'story',
      reel: 'reel-cover',
      linkedin: 'linkedin-landscape',
      x: 'x-landscape',
      pinterest: 'pinterest-tall',
      presentation: 'widescreen-cover',
      thumbnail: 'video-thumbnail',
    }
    const targetFormat = selected?.format || SOCIAL_FORMATS[platformFormat[platform]]
    const width = targetFormat.width
    const height = targetFormat.height
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('local_reserve_canvas_failed')
    const seedSource = `${text}|${context}|${creativeBrief.issue}|${options.preferredWorld || ''}|${options.candidateIndex || 0}`
    let seed = 0
    for (let index = 0; index < seedSource.length; index += 1) seed = (seed * 31 + seedSource.charCodeAt(index)) >>> 0
    const rand = () => {
      seed = (1664525 * seed + 1013904223) >>> 0
      return seed / 4294967295
    }
    const hue = Math.round(rand() * 360)
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, `hsl(${hue}, ${42 + Math.round(rand() * 18)}%, ${91 - Math.round(rand() * 7)}%)`)
    gradient.addColorStop(.55, `hsl(${(hue + 28) % 360}, ${32 + Math.round(rand() * 14)}%, ${84 - Math.round(rand() * 6)}%)`)
    gradient.addColorStop(1, `hsl(${(hue + 68) % 360}, ${24 + Math.round(rand() * 12)}%, ${74 - Math.round(rand() * 8)}%)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const textZone = options.textZone || (Number(options.candidateIndex || 0) % 3 === 0 ? 'right' : Number(options.candidateIndex || 0) % 3 === 1 ? 'bottom' : 'left')
    const accentX = textZone === 'right' ? width * .28 : textZone === 'left' ? width * .72 : width * (.32 + rand() * .36)
    const accentY = textZone === 'bottom' ? height * .3 : height * (.32 + rand() * .26)
    for (let i = 0; i < 7; i += 1) {
      ctx.save()
      ctx.globalAlpha = .11 + rand() * .1
      ctx.fillStyle = `hsla(${(hue + 18 * i) % 360}, 70%, ${55 + Math.round(rand() * 18)}%, .8)`
      ctx.beginPath()
      ctx.arc(accentX + (rand() - .5) * width * .22, accentY + (rand() - .5) * height * .22, width * (.08 + rand() * .12), 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.save()
    ctx.globalAlpha = .18
    ctx.fillStyle = 'rgba(255,255,255,.9)'
    const cardW = width * (textZone === 'bottom' ? .62 : .24)
    const cardH = height * (textZone === 'bottom' ? .11 : .42)
    const cardX = textZone === 'right' ? width * .68 : textZone === 'left' ? width * .08 : width * .2
    const cardY = textZone === 'bottom' ? height * .76 : height * .16
    const radius = Math.min(width, height) * .03
    ctx.beginPath()
    ctx.moveTo(cardX + radius, cardY)
    ctx.lineTo(cardX + cardW - radius, cardY)
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + radius)
    ctx.lineTo(cardX + cardW, cardY + cardH - radius)
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - radius, cardY + cardH)
    ctx.lineTo(cardX + radius, cardY + cardH)
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - radius)
    ctx.lineTo(cardX, cardY + radius)
    ctx.quadraticCurveTo(cardX, cardY, cardX + radius, cardY)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = .22
    ctx.strokeStyle = 'rgba(20,32,44,.18)'
    ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * .005))
    for (let i = 0; i < 3; i += 1) {
      const baseY = cardY + cardH * (.28 + i * .22)
      ctx.beginPath()
      ctx.moveTo(cardX + cardW * .14, baseY)
      ctx.lineTo(cardX + cardW * (.84 - i * .08), baseY)
      ctx.stroke()
    }
    ctx.restore()

    const dataUrl = canvas.toDataURL('image/png')
    const analyzed = await analyzeGeneratedStudioImage(dataUrl, `dr-ahmad-local-reserve-${Date.now()}.png`)
    if (!analyzed) throw new Error('local_reserve_analysis_failed')
    const safeTextZone = textZone === 'bottom' ? 'bottom' : textZone === 'left' ? 'left' : 'right'
    const passport: StudioImagePassport = {
      ...analyzed,
      negativeSpace: safeTextZone,
      cropRisk: 'low',
      cropNotes: [
        'هذه صورة احتياطية محلية بُنيت داخل المتصفح عندما تعذّر مسار Cloudflare، لذلك لم يُستخدم أي مخزون صور جاهز.',
        ...analyzed.cropNotes,
      ],
    }
    const generated: GeneratedStudioImage = {
      passport,
      metadata: {
        source: 'مولد احتياطي محلي داخل الاستوديو',
        owner: 'رسم محلي داخل المتصفح',
        license: 'توليد احتياطي محلي — بلا صورة جاهزة مستبدلة',
        description: creativeBrief.issue,
        visualWorld: options.preferredWorld || 'local-reserve',
        visualWorldLabel: 'احتياطي محلي',
        imageTreatment: selected?.overlays?.find((item) => item.kind === 'image')?.imageTreatment || 'editorial',
        layoutHint: selected?.layout,
        paletteHint: selected?.palette,
        conceptKey: visualSearchPlan.glossaryConcept,
        conceptLabel: visualSearchPlan.glossaryLabel,
        semanticScene: creativeBrief.visualReason,
        relevanceScore: 84,
        relevanceReason: `استُخدم مولد احتياطي محلي لأن خدمة الصور تعذّرت: ${options.reason}`,
        generationAttempts: 0,
        semanticVerified: true,
        criticSource: 'browser-fallback',
        imageCaption: creativeBrief.visualReason,
        literalSubjects: visualSearchPlan.literalAnchors,
        visualScore: 72,
        visualReasons: ['احتياطي محلي منسجم مع الفكرة', 'يحافظ على مساحة نص آمنة للتصميم'],
        safeTextZone,
        imageWidth: width,
        imageHeight: height,
        targetWidth: width,
        targetHeight: height,
        nativeAspect: true,
        formatId: targetFormat.id,
      },
      prompt: visualSearchPlan.generationPrompt,
      model: 'browser-local-reserve',
      generatedAt: new Date().toISOString(),
      requestId: `local-reserve-${Date.now()}`,
    }
    await archiveGeneratedImage(generated)
    return generated
  }

  const installGeneratedImage = (generated: GeneratedStudioImage) => {
    setImagePassport(generated.passport)
    setImageDescription(generated.metadata.description || creativeBrief.issue)
    setImageSource(generated.metadata.source || 'مولد الصور الداخلي')
    setImageOwner(generated.metadata.owner || 'توليد أصلي داخل الاستوديو')
    setImageLicense(generated.metadata.license || 'نموذج FLUX')
    setGeneratedPrompt(generated.prompt)
    setGeneratedModel(generated.model)
    setGeneratedAt(generated.generatedAt || new Date().toISOString())
    setGeneratedVisualWorld(generated.metadata.visualWorldLabel || '')
    rememberVisualWorld(generated.metadata.visualWorld)
    setGeneratedRelevanceScore(typeof generated.metadata.relevanceScore === 'number' ? generated.metadata.relevanceScore : null)
    setGeneratedRelevanceReason(generated.metadata.relevanceReason || '')
    setVisualOrigin('generated')
    setVisualFailure('')
  }

  const runGenerator = async () => {
    if (generatorBusy) return
    setGeneratorBusy(true)
    try {
      const serial = ++generationSerialRef.current
      const history = loadVisualWorldHistory()
      const preferredWorlds = [...new Set(visualSearchPlan.preferredWorlds)]
      const freshWorlds = preferredWorlds.filter((world) => !history.includes(world))
      const worldPool = freshWorlds.length ? freshWorlds : preferredWorlds
      const preferredWorld = worldPool.length ? worldPool[serial % worldPool.length] : undefined
      const textZones: Array<'right' | 'bottom' | 'left'> = ['right', 'bottom', 'left']
      const generated = await requestGeneratedStudioImage({
        regenerationId: `manual-${Date.now()}-${serial}`,
        variation: FRESH_GENERATION_VARIATIONS[serial % FRESH_GENERATION_VARIATIONS.length],
        candidateIndex: serial % 3,
        preferredWorld,
        recentVisualWorlds: history,
        textZone: textZones[serial % textZones.length],
      })
      installGeneratedImage(generated)
      const treatment = generated.metadata.imageTreatment || 'cinematic'
      if (selected) {
        syncPlanEverywhere(buildImageLedPlan(selected, treatment, generated.passport, generated.metadata))
        setStage('edit')
        setNotice(`وُلّدت صورة مختلفة واجتازت المطابقة ${generated.metadata.relevanceScore || ''}٪، ثم أُعيد بناء التكوين حولها إبداعياً.`)
      } else {
        const pack = await runAutopilot({ passport: generated.passport, metadata: generated.metadata, visualSet: [generated], quiet: true, allowExternalSearch: false })
        setNotice(pack.length
          ? `وُلّدت صورة مختلفة واجتازت المطابقة ${generated.metadata.relevanceScore || ''}٪، ثم بُني حولها أفضل تكوين تلقائياً.`
          : 'وُلّدت الصورة وأُعدّ جوازها؛ اكتب فكرة أو اختر اتجاهاً ليُبنى التكوين حولها.')
      }
    } catch (error) {
      const message = describeGeneratorFailure(error)
      setVisualFailure(message)
      setVisualOrigin('none')
      setNotice(message)
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
    metadata?: StudioImageMetadata,
    styleOverride?: { treatment?: NonNullable<PlanOverlay['imageTreatment']>; layout?: LayoutFamilyId; palette?: PaletteId; ignoreServerStyle?: boolean },
  ) => {
    const roleId = `hero-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    /* أصل المشكلة: اختيار منطقة النص كان يعود إلى «الوسط» تقريباً في كل مرة
       بسبب شرط يعيد center دائماً، فكان الكلام والإطار يقعان فوق مركز الصورة
       حتى عندما تظهر المساحة الهادئة بوضوح على اليمين أو اليسار. العلاج:
       نعتمد أولاً على جواز الصورة (negative space / focal point)، ثم نلجأ إلى
       هندسة الخطة القديمة فقط كمرشد احتياطي إن تعذّر ذلك. */
    const titleCenterX = plan.geometry.titleZone.x + plan.geometry.titleZone.width / 2
    const titleCenterY = plan.geometry.titleZone.y
    const passportZone = cinematicTextZone(passport)
    const fallbackZone: NonNullable<PlanOverlay['textZone']> = titleCenterY < .24 ? 'top' : titleCenterY > .64 ? 'bottom' : titleCenterX < .46 ? 'left' : titleCenterX > .54 ? 'right' : 'right'
    const zone: NonNullable<PlanOverlay['textZone']> = passportZone || fallbackZone
    const existing = (plan.overlays || []).filter((item) => item.imageRole !== 'background')
    const resolvedTreatment = styleOverride?.treatment
      || (styleOverride?.ignoreServerStyle ? treatment : metadata?.imageTreatment || treatment)
    const fallbackPalette: Record<NonNullable<PlanOverlay['imageTreatment']>, PaletteId> = {
      none: 'brand-paper',
      documentary: 'scholar-blue',
      editorial: 'signal-ivory',
      duotone: 'warm-parchment',
      cinematic: 'brand-night',
    }
    const fallbackLayout: Record<NonNullable<PlanOverlay['imageTreatment']>, LayoutFamilyId> = {
      none: 'editorial-axis',
      documentary: 'human-note',
      editorial: 'editorial-axis',
      duotone: 'quiet-orbit',
      cinematic: 'cinematic-window',
    }
    const serverLayoutHint = !styleOverride?.ignoreServerStyle
      ? metadata?.layoutHint
      : undefined
    const palette: PaletteId = styleOverride?.palette
      || (styleOverride?.ignoreServerStyle ? fallbackPalette[resolvedTreatment] : metadata?.paletteHint || fallbackPalette[resolvedTreatment])
    const layout: LayoutFamilyId = styleOverride?.layout
      || serverLayoutHint
      || fallbackLayout[resolvedTreatment]
    const darkSurface = Boolean(PALETTES[palette]?.isDark)
    const vignette = resolvedTreatment === 'cinematic' ? .44 : resolvedTreatment === 'duotone' ? .32 : resolvedTreatment === 'editorial' ? .18 : .10
    const readabilityShade = darkSurface
      ? resolvedTreatment === 'cinematic' ? .78 : resolvedTreatment === 'duotone' ? .70 : .62
      : resolvedTreatment === 'cinematic' ? .66 : resolvedTreatment === 'duotone' ? .58 : resolvedTreatment === 'editorial' ? .56 : .50
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
      imageTreatment: resolvedTreatment,
      textZone: zone,
      vignette,
      readabilityShade,
    }
    const next = {
      ...plan,
      layout,
      palette,
      paletteOverride: undefined,
      density: resolvedTreatment === 'cinematic' || resolvedTreatment === 'duotone' ? 'minimal' : plan.density,
      content: { ...plan.content, source: /dr-?alfailakawi\.com/i.test(plan.content.source || '') ? '' : plan.content.source },
      framing: resolvedTreatment === 'cinematic' || resolvedTreatment === 'duotone' ? 'cinematic-crop' : 'open-canvas',
      overlays: [background, ...existing],
      rationale: [
        `الصورة أصبحت المسرح الأساسي بتوجه ${metadata?.visualWorldLabel || (resolvedTreatment === 'cinematic' ? 'سينمائي' : resolvedTreatment === 'documentary' ? 'وثائقي مضيء' : resolvedTreatment === 'duotone' ? 'مادي دافئ' : 'تحريري لوني')}.`,
        `هذا الاتجاه مستقل في بنيته ولوحته ومعالجته حتى لا تبدو النتائج نسخاً من ثيم واحد.`,
        `اختيرت منطقة النص ${zone === 'right' ? 'يميناً' : zone === 'left' ? 'يساراً' : zone === 'top' ? 'أعلى' : zone === 'bottom' ? 'أسفل' : 'في الوسط'} بحسب أهدأ مساحة في الصورة.`,
        'حافظ المحرك على بيانات المنشأ داخل جواز الصورة من دون طباعتها فوق العمل البصري.',
        ...(plan.rationale || []).slice(0, 2),
      ],
    } as CompositionPlan
    return next
  }

  const applyImageLedDirection = (
    treatment: NonNullable<PlanOverlay['imageTreatment']>,
    passportOverride?: StudioImagePassport,
    metadata?: StudioImageMetadata,
  ) => {
    if (!selected) { setNotice('اختر اتجاهاً أولاً، ثم حوّل الصورة إلى مشهد بطولي.'); return }
    const passport = passportOverride || imagePassport
    if (!passport) { setNotice('اختر صورة أولاً كي أبني حولها المشهد السينمائي.'); return }
    editPlan((plan) => buildImageLedPlan(plan, treatment, passport, metadata))
    setFreeMode(false)
    setMobileEditorPanel('preview')
    setStage('edit')
    setNotice('بُني مشهد بصري بطولي حول الصورة: معالجة، تعتيم موجه، نقطة تركيز، ومناطق قراءة — لا مجرد صورة خلف النص.')
  }

  const addOverlay = (kind: PlanOverlay['kind']) => {
    if (!selected) return
    if (kind === 'image' && !imagePassport) { setNotice('حمّل صورة وأنشئ جوازها أولاً، ثم أضفها إلى اللوحة.'); return }
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
    setNotice(axis === 'x' ? 'وُزعت الطبقات المحددة أفقياً بمسافات متساوية.' : 'وُزعت الطبقات المحددة رأسياً بمسافات متساوية.')
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
      setNotice('المقاس مقفول؛ افتح قفل المقاس أولاً.')
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
      setNotice('اكتب الفكرة أولاً كي أبني لها كاروسيلاً حقيقياً.')
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
      setNotice(signal > 0 ? 'هذا الاتجاه محفوظ أصلاً في ذاكرة ذوقك؛ لن نضاعف وزنه بسبب تكرار التنزيل.' : 'هذا الأسلوب مستبعد أصلاً من ذاكرتك.')
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

  const saveSelectedToLibrary = (plan: CompositionPlan) => {
    // هذا هو الحفظ النهائي؛ بعده لا تبقى مسودة منقطعة تتنافس مع النسخة المعتمدة.
    suppressAutosaveRef.current = true
    setInterruptedDraft(null)
    void clearStudioLiveDraft()
    teachTaste(plan, 1)
    const next = savePlan(plan)
    setSavedPlans(next)
    void archiveGeneratedDesigns([plan], 'نسخة محفوظة بعد التحرير')
    setNotice(`حُفظ التصميم محلياً وفي مكتبة التوليد السحابية، وتعلّم الاستوديو ذوقك. لديك الآن ${next.length} نسخة محفوظة محلياً.`)
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
      setNotice(`منع محرك الجودة التصدير: النتيجة ${score}٪ والحد ${qualityThreshold}٪. اختر اتجاهاً أقوى أو أعد توليده.`)
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

  const runCampaign = (campaignText: string, campaignContext: string, basePlan?: CompositionPlan, options: { preserveSelection?: boolean; quiet?: boolean } = {}) => {
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
      if (!options.preserveSelection) setSelected(null)
      if (!options.quiet) setNotice(next.ready
        ? `اكتملت حملة من ${next.assets.length} قطع متناسقة وغير مكررة واجتازت لجنة الجودة: ${next.qualityScore}٪.`
        : next.warnings[0] || 'الحملة تحتاج إعادة توليد قبل التصدير.')
      return next
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
      setNotice(`نُزّلت ${picked.length} نسخ نهائية جاهزة للنشر — مختلفة حقاً لا تكراراً شكلياً.`)
    } finally {
      setAutoFinalsBusy(false)
    }
  }

  const bestPlanForRelease = () => selected || autopilotPack[0]?.plan || plans[0] || null

  const scorePlan = (plan: CompositionPlan) => Math.round(((plan.quality?.score || 0) * .68) + predictEngagement(plan).score * .22 + plan.novelty * 10)

  const buildReleasePack = async (baseOverride?: CompositionPlan | null, options: { passport?: StudioImagePassport | null; metadata?: StudioImageMetadata; quiet?: boolean } = {}) => {
    const base = baseOverride || bestPlanForRelease()
    if (!base) {
      setNotice('ولّد اتجاهاً قوياً أولاً، ثم ابنِ حزمة النشر العليا.')
      return
    }
    setReleasePackBusy(true)
    try {
      const hero = base.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')
      const carryHero = (plan: CompositionPlan, treatment?: NonNullable<PlanOverlay['imageTreatment']>) => {
        const passport = Object.prototype.hasOwnProperty.call(options, 'passport') ? options.passport ?? null : imagePassport
        if (!hero || !passport) return plan
        return buildImageLedPlan(plan, treatment || hero.imageTreatment || 'cinematic', passport, options.metadata || { source: hero.sourceUrl, owner: hero.owner, license: hero.license, description: hero.semanticDescription })
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
        { id: 'final', label: 'Final', note: 'النسخة المرجعية الأعلى اتزاناً للنشر الرسمي.', plan: finalPlan, score: scorePlan(finalPlan) },
        { id: 'safer', label: 'Safer', note: 'أهدأ وأكثر تحفظاً للجهات والمؤسسات والبيئات الحساسة.', plan: saferPlan, score: scorePlan(saferPlan) },
        { id: 'viral', label: 'Viral', note: 'أقوى نسخة للتوقف والانتشار البصري السريع.', plan: viralPlan, score: scorePlan(viralPlan) },
      ]
      pack.sort((a, b) => b.score - a.score)
      setReleasePack(pack)
      setZeroDecision(null)
      if (!options.quiet) setNotice('بُنيت الآن حزمة النشر العليا: Final / Safer / Viral — ثلاث نهايات تفهم سبب وجودها، لا نسخاً عشوائية.')
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

  const runZeroDecisionMode = async (requestedMode: StudioVisualMode = visualMode) => {
    if (text.trim().length < 2) {
      setNotice('اكتب الفكرة أولاً، وبعدها اترك كل القرار للمخرج الذكي.')
      textRef.current?.focus()
      return
    }
    if (zeroDecisionBusy) return
    setVisualMode(requestedMode)
    setZeroDecisionBusy(true)
    setZeroDecision(null)
    setReleasePack([])
    setCampaign(null)
    setVisualFailure('')
    setGeneratedPrompt('')
    setZeroDecisionPhase('understand')
    setNotice('أفهم المعنى العميق للفكرة الآن… لا أبحث عن شكل جميل فقط، بل عن مشهد يلامس الإنسان.')
    try {
      let passport: StudioImagePassport | null = null
      let metadata: StudioImageMetadata | undefined
      let generatedSet: GeneratedStudioImage[] = []

      setZeroDecisionPhase('prompt')
      setNotice(requestedMode === 'generate'
        ? 'أبني توجيهاً بصرياً أصلياً، ثم أصنع مشهداً جديداً من الصفر.'
        : 'أحوّل الفكرة إلى عبارات بحث تحريرية، ثم أفحص الصور الجاهزة وأختار الأقوى من المصادر الموثقة.')
      setZeroDecisionPhase('image')

      if (requestedMode === 'generate') {
        const history = loadVisualWorldHistory()
        const serial = ++generationSerialRef.current
        const preferredWorlds = [...new Set(visualSearchPlan.preferredWorlds)]
        const freshWorlds = preferredWorlds.filter((world) => !history.includes(world))
        const worldPool = freshWorlds.length ? freshWorlds : preferredWorlds
        const preferredWorld = worldPool.length ? worldPool[serial % worldPool.length] : undefined
        const textZones: Array<'right' | 'bottom' | 'left'> = ['right', 'bottom', 'left']
        setNotice('أصنع صورة أصلية دقيقة وأفحص معناها وجودتها؛ وإذا رُفضت أنشئ مرشحاً جديداً تلقائياً ضمن طلب مستقل وسريع.')
        try {
          const generated = await requestGeneratedStudioImageWithBackoff({
            regenerationId: `zero-final-${Date.now()}-${serial}`,
            variation: FRESH_GENERATION_VARIATIONS[serial % FRESH_GENERATION_VARIATIONS.length],
            preferredWorld,
            candidateIndex: serial % 3,
            textZone: textZones[serial % textZones.length],
            recentVisualWorlds: history,
          })
          generatedSet = [generated]
        } catch (error) {
          const failure = describeGeneratorFailure(error)
          setVisualOrigin('none')
          setVisualFailure(failure)
          throw new Error(`studio_visual_failure:${failure}`)
        }
        const uniqueGenerated = new Map<string, GeneratedStudioImage>()
        for (const generated of generatedSet) {
          const key = generated.metadata.visualWorld || generated.requestId || generated.passport.dataUrl.slice(0, 96)
          if (!uniqueGenerated.has(key)) uniqueGenerated.set(key, generated)
        }
        generatedSet = [...uniqueGenerated.values()].sort((left, right) => {
          const verifiedGap = Number(Boolean(right.metadata.semanticVerified)) - Number(Boolean(left.metadata.semanticVerified))
          if (verifiedGap) return verifiedGap
          return Number(right.metadata.relevanceScore || 0) - Number(left.metadata.relevanceScore || 0)
        })
        const semanticallyApproved = generatedSet.filter((item) => item.metadata.semanticVerified !== false && (item.metadata.relevanceScore == null || item.metadata.relevanceScore >= 80))
        if (semanticallyApproved.length) generatedSet = semanticallyApproved
        for (const generated of generatedSet) rememberVisualWorld(generated.metadata.visualWorld)
        installGeneratedImage(generatedSet[0])
        passport = generatedSet[0].passport
        metadata = generatedSet[0].metadata
      } else {
        setNotice('أبحث الآن عن صورة جاهزة قوية، ثم أتحقق من صلاحية رابطها ومصدرها قبل أن تدخل التصميم.')
        const queries = [...new Set([
          ...visualSearchPlan.englishQueries.slice(0, 3),
          externalQuery,
          visualSearchPlan.queries[0],
          visualSearchPlan.headline,
        ].map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 4)
        const merged = new Map<string, ExternalVisualResult>()
        for (const query of queries) {
          try {
            const queryPlan = { ...visualSearchPlan, queries: [query, ...visualSearchPlan.queries.filter((item) => item !== query)] }
            const rawResults = await searchExternalVisualSources(queryPlan, 12)
            const verified = await verifyExternalVisuals(rawResults, 8)
            for (const item of verified) merged.set(item.id, item)
            if (merged.size >= 8) break
          } catch { /* نكمل بالاستعلام التالي بدل تعليق الدورة */ }
        }
        const verified = [...merged.values()].sort((left, right) => right.score - left.score)
        setExternalVisuals(verified)
        let chosen: ExternalVisualResult | null = null
        let resolved: Awaited<ReturnType<typeof resolveExternalVisualPassport>> = null
        for (const candidate of verified.slice(0, 6)) {
          resolved = await resolveExternalVisualPassport(candidate)
          if (resolved) { chosen = candidate; break }
        }
        if (!chosen || !resolved) {
          const failure = 'لم أجد صورة جاهزة صالحة وموثقة لهذه الفكرة ضمن المهلة. لم أستبدلها بصورة مولدة أو بتصميم قديم.'
          setVisualOrigin('none')
          setVisualFailure(failure)
          throw new Error(`studio_visual_failure:${failure}`)
        }
        passport = resolved.passport
        metadata = resolved.metadata
        setImagePassport(passport)
        setImageDescription(metadata.description || chosen.title)
        setImageSource(metadata.source || chosen.pageUrl || chosen.imageUrl)
        setImageOwner(metadata.owner || chosen.author)
        setImageLicense(metadata.license || chosen.license)
        setGeneratedModel('')
        setGeneratedAt('')
        setGeneratedPrompt('')
        setGeneratedVisualWorld('')
        setGeneratedRelevanceScore(null)
        setGeneratedRelevanceReason('')
        setVisualOrigin('ready')
        setVisualFailure('')
        setNotice(`اختار المخرج صورة جاهزة من ${chosen.providerLabel} بعد فحص ${verified.length} مرشحين صالحين.`)
      }

      setZeroDecisionPhase('compose')
      setNotice('أبني عشرات الاحتمالات في الخلفية، وأقصي المتشابه والضعيف قبل أن تراه.')
      const autoPack = await runAutopilot({ passport, metadata, visualSet: generatedSet, keepStage: true, quiet: true, allowExternalSearch: false })
      const champion = autoPack[0]?.plan || null
      if (!champion) throw new Error('no_champion')

      setZeroDecisionPhase('critic')
      setNotice('الناقد العالمي يفحص القراءة والهيبة وقوة التوقف والصدق الإنساني وعدم التكرار.')
      const builtPack = await buildReleasePack(champion, { passport, metadata, quiet: true })
      const computedPack: ReleaseVariant[] = builtPack?.length ? builtPack : [
        { id: 'final', label: 'Final', note: 'النسخة المرجعية الأعلى اتزاناً للنشر الرسمي.', plan: champion, score: scorePlan(champion) },
      ]
      const emotionalBonus = (variant: ReleaseVariant) => {
        if (analysis.primaryTone === 'human' || analysis.primaryTone === 'deep') return variant.id === 'final' ? 4 : variant.id === 'viral' ? 2 : 0
        if (analysis.primaryKind === 'announcement' || analysis.primaryKind === 'invitation') return variant.id === 'safer' ? 3 : 0
        return variant.id === 'final' ? 2 : 0
      }
      const approved = [...computedPack].sort((a, b) => (b.score + emotionalBonus(b)) - (a.score + emotionalBonus(a)))[0]
      if (generatedSet.length) {
        const approvedImage = approved.plan.overlays?.find((overlay) => overlay.kind === 'image' && overlay.imageRole === 'background')?.src
        const approvedGenerated = generatedSet.find((item) => item.passport.dataUrl === approvedImage)
        if (approvedGenerated) installGeneratedImage(approvedGenerated)
      }

      setZeroDecisionPhase('campaign')
      setNotice('أبني الآن الحملة والمقاسات حول النسخة المعتمدة، من دون تكرار شكلي.')
      const completeCampaign = runCampaign(text, context, approved.plan, { preserveSelection: true, quiet: true })
      const summary: ZeroDecisionSummary = {
        approved,
        campaignReady: Boolean(completeCampaign?.ready),
        campaignQuality: completeCampaign?.qualityScore || 0,
        visualOrigin: requestedMode === 'generate' ? 'generated' : 'ready',
        note: approved.id === 'viral'
          ? 'اختار النظام النسخة الأعلى توقفاً لأن الفكرة تحتاج لحظة بصرية تسبق القراءة، مع الحفاظ على الوقار.'
          : approved.id === 'safer'
            ? 'اختار النظام النسخة الأكثر اتزاناً ووضوحاً لأن الثقة هنا أهم من الاستعراض.'
            : 'اختار النظام النسخة المرجعية لأنها حققت أفضل توازن بين الجمال والعمق والقراءة والأثر الإنساني.'
      }
      setReleasePack(computedPack)
      setZeroDecision(summary)
      setSelected(approved.plan)
      void archiveGeneratedDesigns([approved.plan], 'آخر تصميم معتمد تلقائياً')
      setStage('directions')
      setZeroDecisionPhase('done')
      teachTaste(approved.plan, 1)
      setNotice(requestedMode === 'generate'
        ? 'اكتملت الصورة الأصلية بعد اجتياز فحص المعنى والجودة، ثم حُسم أفضل إخراج.'
        : 'اكتمل مسار الصورة الجاهزة، ثم حُسم أفضل إخراج. المصدر والترخيص ظاهران بوضوح.')
    } catch (error) {
      setZeroDecisionPhase('idle')
      const raw = error instanceof Error ? error.message : ''
      const failure = raw.startsWith('studio_visual_failure:')
        ? raw.slice('studio_visual_failure:'.length)
        : 'تعذر إكمال الدورة هذه المرة من دون خفض المستوى. بقيت النتيجة السابقة كما هي ولم يعتمد النظام نتيجة ضعيفة.'
      setVisualFailure(failure)
      setNotice('')
    } finally {
      setZeroDecisionBusy(false)
    }
  }

  const runAutopilot = async (options: { passport?: StudioImagePassport | null; metadata?: StudioImageMetadata; visualSet?: GeneratedStudioImage[]; keepStage?: boolean; quiet?: boolean; allowExternalSearch?: boolean } = {}): Promise<AutoPilotCandidate[]> => {
    if (text.trim().length < 2) {
      setNotice('اكتب العنوان أولاً كي يبني الطيار الآلي خمس نهايات عالمية.')
      textRef.current?.focus()
      return []
    }
    setAutopilotBusy(true)
    try {
      const parsed = parseStudioCommand(text)
      setCommandParse(parsed.understood.length ? parsed : null)
      const nextGeneration = generation + 1
      const localHistory = loadHistory()
      const hasPassportOverride = Object.prototype.hasOwnProperty.call(options, 'passport')
      let passport = hasPassportOverride ? options.passport ?? null : imagePassport
      let sourceMeta: StudioImageMetadata | undefined = options.metadata || (!hasPassportOverride && imagePassport
        ? { source: imageSource, owner: imageOwner, license: imageLicense, description: imageDescription }
        : undefined)
      if (!passport && options.allowExternalSearch !== false) {
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
      const positiveSemantic = visualSearchPlan.moods.some((mood) => ['bright', 'playful', 'energetic', 'optimistic', 'creative', 'warm', 'collaborative', 'curious', 'dynamic'].includes(mood))
      const brightPalettes: PaletteId[] = ['scholar-blue', 'signal-ivory', 'warm-parchment', 'quiet-stone', 'brand-paper']
      const pool: AutoPilotCandidate[] = []
      const visualSet = (options.visualSet || []).filter((item) => item?.passport?.dataUrl)
      for (const [presetIndex, preset] of AUTOPILOT_PRESETS.entries()) {
        const visualCandidate = visualSet.length ? visualSet[presetIndex % visualSet.length] : null
        const presetPassport = visualCandidate?.passport || passport
        const presetMetadata = visualCandidate?.metadata || sourceMeta
        const effectiveLayout = presetMetadata?.layoutHint || preset.preferLayout
        const effectiveTreatment = presetMetadata?.imageTreatment || (positiveSemantic && preset.imageTreatment === 'cinematic' ? 'editorial' : preset.imageTreatment)
        const effectivePalette = presetMetadata?.paletteHint || (positiveSemantic && PALETTES[preset.palette]?.isDark ? brightPalettes[presetIndex % brightPalettes.length] : preset.palette)
        let attempts = 0
        let winner: AutoPilotCandidate | null = null
        while (attempts < 2 && !winner) {
          const result = generateSocialDesigns({
            text: parsed.content,
            context: [expertContext, parsed.contextHint].filter(Boolean).join(' · '),
            author: 'د. أحمد حسين الفيلكاوي',
            tone: preset.tone,
            density: preset.density,
            platform: preset.platform ?? (parsed.platform || platform),
            count: 8,
            seed: `autopilot:${preset.id}:${text}:${context}:${nextGeneration}:${Date.now()}:${attempts}`,
            history: localHistory,
            noveltyThreshold: .42,
            tasteProfile,
            preferLayout: effectiveLayout,
          })
          const candidates = result.plans.map((plan) => {
            const withImage = presetPassport && effectiveTreatment ? buildImageLedPlan(plan, effectiveTreatment, presetPassport, presetMetadata, { treatment: effectiveTreatment, layout: effectiveLayout, palette: effectivePalette, ignoreServerStyle: false }) : { ...plan, layout: effectiveLayout, palette: effectivePalette }
            const quality = critiqueCompositionPlan(withImage, result.plans.filter((peer) => peer.id !== plan.id))
            const enriched = { ...withImage, quality }
            const stop = predictEngagement(enriched)
            const worldScore = Math.round(quality.score * .62 + stop.score * .24 + enriched.novelty * 9 + (enriched.tasteAffinity || 0) * 5 + (presetPassport ? 3 : 0))
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
      if (!options.keepStage) setStage('directions')
      remember(championPlans)
      if (!options.quiet) setNotice((visualSet.length > 0 || passport)
        ? visualSet.length > 1
          ? `بنى الطيار الآلي خمس نهايات من ${visualSet.length} مشاهد مولدة مستقلة، مع اختلاف الصورة والبنية واللون والمعالجة — لا ثيم واحد مكرر.`
          : 'بنى الطيار الآلي خمس نهايات عالمية، اختار الصورة الأقوى تلقائياً، وأعاد المحاولة عند ضعف النسخة حتى خرج بأفضل عرض.'
        : 'بنى الطيار الآلي خمس نهايات عالمية، وأعاد المحاولة داخلياً عند ضعف النسخة حتى رفع الجودة قدر الإمكان.')
      return finalPack
    } finally {
      setAutopilotBusy(false)
    }
  }

  const buildCampaign = () => {
    if (!selected && !plans[0]) {
      setNotice('ولّد اتجاهاً أولاً، ثم حوّله إلى حملة متكاملة.')
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

  const approvedPlan = selected || zeroDecision?.approved.plan || releasePack[0]?.plan || autopilotPack[0]?.plan || plans[0] || null
  const approvedHero = approvedPlan?.overlays?.find((item) => item.kind === 'image' && item.imageRole === 'background')
  const approvedVisualOrigin: StudioVisualOrigin = zeroDecision?.visualOrigin || visualOrigin
  const approvedImageSource = approvedHero?.sourceUrl || imageSource
  const approvedImageOwner = approvedHero?.owner || imageOwner
  const approvedImageLicense = approvedHero?.license || imageLicense
  const zeroDecisionSteps: { id: ZeroDecisionPhase; label: string; note: string }[] = [
    { id: 'understand', label: 'فهم المعنى', note: domainUnderstanding.recognizedTerms.length ? `${domainUnderstanding.recognizedTerms.slice(0, 3).map((item) => item.canonicalAr).join(' + ')} · ${domainUnderstanding.confidence}٪` : 'القضية والجمهور والأثر' },
    { id: 'prompt', label: 'إخراج الفكرة', note: visualMode === 'generate' ? 'برومبت فني أصلي ومختلف' : 'عبارات بحث تحريرية ذكية' },
    { id: 'image', label: visualMode === 'generate' ? 'توليد الصورة' : 'انتقاء الصورة', note: visualMode === 'generate' ? 'أصلية · مفحوصة دلالياً' : 'مصدر جاهز وموثق فقط' },
    { id: 'compose', label: 'بناء التكوين', note: 'عشرات الاحتمالات في الخلفية' },
    { id: 'critic', label: 'النقد العالمي', note: 'قراءة وهيبة وأصالة' },
    { id: 'campaign', label: 'الحملة', note: 'مقاسات وسرد متكامل' },
  ]
  const zeroDecisionPhaseIndex = zeroDecisionPhase === 'done' ? zeroDecisionSteps.length : zeroDecisionSteps.findIndex((item) => item.id === zeroDecisionPhase)
  const handleStageChange = (next: StudioStage) => {
    if (next === 'edit') {
      if (!approvedPlan) {
        setNotice('صمّم النتيجة أولاً، ثم يبدأ تدخلك من التحرير.')
        setStage('idea')
        return
      }
      setSelected(approvedPlan)
    }
    if (next === 'publish' && !campaign && approvedPlan) runCampaign(text, context, approvedPlan, { preserveSelection: true, quiet: true })
    setStage(next)
  }

  return (
    <div className="grid gap-5">
      <section className={`${card} overflow-hidden`}>
        <div className="relative overflow-hidden rounded-[1.8rem] border border-hair bg-[radial-gradient(circle_at_12%_0%,rgba(62,92,120,.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,.94),rgba(247,248,247,.82))] p-5 md:p-7">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-ink/[.055] blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-white/70 px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.18em] text-accent shadow-sm backdrop-blur">Zero-Decision Creative Director</div>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-ink md:text-5xl">اكتب الفكرة… وأنا أتولى الباقي.</h2>
              <p className="mt-4 max-w-2xl text-[.88rem] leading-loose text-soft md:text-[.95rem]">اختر <strong className="text-ink">توليداً أصلياً</strong> أو <strong className="text-ink">صورة جاهزة موثقة</strong>، ثم يتولى المخرج بناء النتيجة واعتمادها.</p>
            </div>
            <div className="grid min-w-[230px] gap-2 sm:grid-cols-2 md:min-w-[340px]">
              <span className="rounded-2xl border border-hair bg-white/75 px-4 py-3 text-[.68rem] text-soft shadow-sm backdrop-blur"><strong className="block text-[.76rem] text-ink">مسار التوليد</strong>صورة جديدة من الصفر</span>
              <span className="rounded-2xl border border-hair bg-white/75 px-4 py-3 text-[.68rem] text-soft shadow-sm backdrop-blur"><strong className="block text-[.76rem] text-ink">قرار صفري</strong>أفضل نتيجة واحدة فقط</span>
              <span className="rounded-2xl border border-hair bg-white/75 px-4 py-3 text-[.68rem] text-soft shadow-sm backdrop-blur"><strong className="block text-[.76rem] text-ink">صور جاهزة منتقاة</strong>Pexels · Wikimedia · Openverse</span>
              <span className="rounded-2xl border border-hair bg-white/75 px-4 py-3 text-[.68rem] text-soft shadow-sm backdrop-blur"><strong className="block text-[.76rem] text-ink">محركات مخفية</strong>الناقد · الحملة · عدم التكرار</span>
            </div>
          </div>
        </div>
        <div className="relative mt-5"><StageRail stage={stage} onChange={handleStageChange} /></div>

        {interruptedDraft && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/[.045] px-4 py-3 text-[.68rem] shadow-sm" role="status" aria-live="polite">
            <span className="font-semibold text-ink">عُثر على تصميم غير مكتمل</span>
            <span className="flex items-center gap-2">
              <button type="button" className={`${primary} px-4 py-2 text-[.64rem]`} onClick={restoreInterruptedDraft}>استئناف</button>
              <button type="button" className={`${ghost} px-4 py-2 text-[.64rem]`} onClick={dismissInterruptedDraft}>تجاهل</button>
            </span>
          </div>
        )}

        <GenerationLibraryPanel
          designs={generatedDesignLibraryAssets}
          assets={generatedLibraryAssets}
          designBusy={generatedDesignLibraryBusy}
          assetBusy={generatedLibraryBusy}
          designError={generatedDesignLibraryError}
          assetError={generatedLibraryError}
          designHasMore={generatedDesignLibraryHasMore}
          assetHasMore={generatedLibraryHasMore}
          storageStatus={generationStorageStatus}
          storageMessage={generationStorageMessage}
          backfillBusy={generationBackfillBusy}
          backfillSummary={generationBackfillSummary}
          savedCount={savedPlans.length}
          ghostClass={ghost}
          primaryClass={primary}
          onVerify={() => void verifyGenerationLibraryStorage()}
          onBackfill={() => void backfillGenerationLibrary()}
          onUseDesign={(asset) => void useGeneratedDesignLibraryAsset(asset)}
          onDeleteDesign={(asset) => void deleteGeneratedDesignLibraryAsset(asset)}
          onUseAsset={(asset) => void useGeneratedLibraryAsset(asset)}
          onDeleteAsset={(asset) => void deleteGeneratedLibraryAsset(asset)}
          onOlderDesigns={() => void loadOlderGeneratedDesigns()}
          onOlderAssets={() => void loadOlderGeneratedImages()}
        />

        {SIMPLIFIED_STUDIO && stage === 'idea' && (
          <section className="mt-6 overflow-hidden rounded-[1.8rem] border border-hair bg-canvas shadow-[0_24px_70px_rgba(15,23,42,.06)]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
              <div className="p-5 md:p-8">
                <label className="grid gap-3">
                  <span className="text-[.72rem] font-black uppercase tracking-[.12em] text-accent">الفكرة الوحيدة التي أحتاجها منك</span>
                  <BufferedIdeaTextarea
                    textareaRef={textRef}
                    value={text}
                    onCommit={setText}
                    className="min-h-[190px] w-full resize-y rounded-[1.5rem] border border-hair bg-paper px-5 py-5 text-[1.08rem] font-medium leading-[2] text-ink outline-none transition placeholder:text-soft/45 focus:border-accent focus:shadow-[0_0_0_4px_rgba(62,92,120,.08)]"
                    placeholder="اكتب العنوان أو الفكرة كما هي في ذهنك… يمكنك أن تطيل؛ لن يقاطعك الاستوديو ولن يبدأ قبل ضغط الزر."
                  />
                </label>
                {domainUnderstanding.recognizedTerms.length > 0 && <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,.96),rgba(255,255,255,.9))] px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.6rem] font-black uppercase tracking-[.12em] text-emerald-700">الرسم المعرفي الشخصي فهم العبارة</p><h3 className="mt-1 text-[.86rem] font-bold text-ink">{domainUnderstanding.recognizedTerms.slice(0, 4).map((item) => item.canonicalAr).join(' + ')}</h3></div><div className="flex flex-wrap gap-1.5"><span className="rounded-full bg-emerald-100 px-3 py-1 text-[.6rem] font-bold text-emerald-700">ثقة {domainUnderstanding.confidence}٪</span><span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[.58rem] font-semibold text-emerald-800">سعة تركيبية {new Intl.NumberFormat('ar-KW-u-nu-latn').format(domainUnderstanding.conceptCapacity)} مفهوم</span></div></div>
                  <p className="mt-2 text-[.68rem] leading-relaxed text-soft">{domainUnderstanding.compoundMeaning}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{domainUnderstanding.recognizedTerms.slice(0, 10).map((entry) => <span key={`${entry.kind}-${entry.id}`} className="rounded-full border border-emerald-100 bg-white/80 px-2.5 py-1 text-[.56rem] text-soft">{entry.kind === 'concept' ? 'مفهوم' : entry.kind === 'audience' ? 'جمهور' : entry.kind === 'context' ? 'سياق' : entry.kind === 'action' ? 'غاية' : entry.kind === 'outcome' ? 'ناتج' : 'منهج'}: {entry.canonicalAr}</span>)}</div>
                </div>}
                <details className="mt-3 rounded-2xl border border-hair bg-paper/70 px-4 py-3">
                  <summary className="cursor-pointer text-[.72rem] font-semibold text-soft">أضف سياقاً اختيارياً فقط عند الحاجة</summary>
                  <textarea className="mt-3 min-h-24 w-full resize-y rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] leading-loose text-ink outline-none focus:border-accent" value={context} onChange={(event) => setContext(event.target.value)} placeholder="الجمهور، المناسبة، الرسالة التي يجب أن تبقى، أو أي حساسية ثقافية." />
                </details>
                <div className="mt-5 rounded-[1.45rem] border border-hair bg-paper/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.7)]" role="tablist" aria-label="مصدر الصورة">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" role="tab" aria-selected={visualMode === 'generate'} disabled={zeroDecisionBusy} onClick={() => { setVisualMode('generate'); setVisualFailure(''); setNotice('مسار التوليد يصنع صورة أصلية، ولا يعتمد بديلاً شكلياً إذا لم تجتز الصورة بوابات الجودة.') }} className={`relative overflow-hidden rounded-[1.15rem] border px-4 py-4 text-right transition ${visualMode === 'generate' ? 'border-ink bg-ink text-white shadow-[0_14px_32px_rgba(15,23,42,.16)]' : 'border-transparent bg-canvas text-ink hover:border-accent/30'}`}>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[.56rem] font-black uppercase tracking-[.1em] ${visualMode === 'generate' ? 'bg-white/12 text-white' : 'bg-accent/10 text-accent'}`}>AI Original</span>
                      <strong className="mt-3 block text-[.88rem]">توليد من الصفر</strong>
                      <span className={`mt-1.5 block text-[.64rem] leading-relaxed ${visualMode === 'generate' ? 'text-white/65' : 'text-soft'}`}>مشهد جديد من الصفر يجتاز فحص المعنى والجودة.</span>
                    </button>
                    <button type="button" role="tab" aria-selected={visualMode === 'ready'} disabled={zeroDecisionBusy} onClick={() => { setVisualMode('ready'); setVisualFailure(''); setNotice('مسار الجاهز يبحث فقط في المصادر المفتوحة، ويفصح عن المصدر والترخيص بوضوح.') }} className={`relative overflow-hidden rounded-[1.15rem] border px-4 py-4 text-right transition ${visualMode === 'ready' ? 'border-accent bg-accent text-white shadow-[0_14px_32px_rgba(62,92,120,.18)]' : 'border-transparent bg-canvas text-ink hover:border-accent/30'}`}>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[.56rem] font-black uppercase tracking-[.1em] ${visualMode === 'ready' ? 'bg-white/14 text-white' : 'bg-paper text-soft'}`}>Curated Source</span>
                      <strong className="mt-3 block text-[.88rem]">صورة جاهزة</strong>
                      <span className={`mt-1.5 block text-[.64rem] leading-relaxed ${visualMode === 'ready' ? 'text-white/72' : 'text-soft'}`}>اختيار ذكي من Pexels وWikimedia وOpenverse بعد فحص الرابط.</span>
                    </button>
                  </div>
                  {visualMode === 'generate' && (
                    <div className="mt-3 grid gap-2 rounded-[1.25rem] border border-hair bg-canvas p-3 sm:grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={generationMode === 'daily'}
                        onClick={() => {
                          setGenerationMode('daily')
                          try { localStorage.setItem('dr-ahmad-image-generation-mode', 'daily') } catch { /* noop */ }
                          setNotice('الوضع اليومي لا يضع حداً داخلياً ويستخدم FLUX.2 الاقتصادي لتكبير الحصة المجانية عشرات المرات.')
                        }}
                        className={`rounded-xl border px-4 py-3 text-right transition ${generationMode === 'daily' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-hair bg-paper text-ink'}`}
                      >
                        <strong className="block text-[.76rem]">اليومي الاقتصادي · الافتراضي</strong>
                        <span className="mt-1 block text-[.61rem] leading-relaxed opacity-75">FLUX.2 سريع وقليل الاستهلاك · بلا عدّاد داخل الموقع.</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={generationMode === 'masterpiece'}
                        onClick={() => {
                          setGenerationMode('masterpiece')
                          try { localStorage.setItem('dr-ahmad-image-generation-mode', 'masterpiece') } catch { /* noop */ }
                          setNotice('الدقة القصوى تستخدم Phoenix وفاحصاً سحابياً إضافياً؛ خصصها للنسخة النهائية لأنها تستهلك من رصيد Cloudflare أكثر.')
                        }}
                        className={`rounded-xl border px-4 py-3 text-right transition ${generationMode === 'masterpiece' ? 'border-violet-400 bg-violet-50 text-violet-900' : 'border-hair bg-paper text-ink'}`}
                      >
                        <strong className="block text-[.76rem]">الدقة القصوى · للنهائي</strong>
                        <span className="mt-1 block text-[.61rem] leading-relaxed opacity-75">Phoenix + فحص دلالي سحابي · استهلاك أعلى للحصة الخارجية.</span>
                      </button>
                    </div>
                  )}
                </div>
                <button type="button" onPointerDown={commitIdeaNow} onClick={() => void runZeroDecisionMode(visualMode)} disabled={zeroDecisionBusy} className="group relative mt-3 w-full overflow-hidden rounded-[1.45rem] bg-ink px-6 py-5 text-right text-white shadow-[0_22px_50px_rgba(15,23,42,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(15,23,42,.28)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0">
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,255,255,.22),transparent_36%)] opacity-80" />
                  <span className="relative flex items-center justify-between gap-4"><span><strong className="block text-[1rem] md:text-[1.08rem]">{zeroDecisionBusy ? (visualMode === 'generate' ? 'أولّد المشهد وأصنع النتيجة…' : 'أنتقي الصورة وأصنع النتيجة…') : visualMode === 'generate' ? 'ولّد من الصفر — وصمّم لي' : 'اختر الأقوى الجاهز — وصمّم لي'}</strong><span className="mt-1 block text-[.68rem] leading-relaxed text-white/62">{visualMode === 'generate' ? 'صورة أصلية · فحص دلالي · بلا بديل شكلي' : 'مصدر موثق · فحص تلقائي · أفضل صورة جاهزة فقط'}</span></span><span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl transition group-hover:translate-x-[-3px]">←</span></span>
                </button>
                {visualFailure && <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[.72rem] leading-relaxed text-rose-800"><strong className="block">تعذّر مسار الصورة</strong><span className="mt-1 block">{visualFailure}</span></div>}
                {notice && <p className="mt-4 rounded-2xl border border-accent/20 bg-accent/[.045] px-4 py-3 text-[.76rem] leading-relaxed text-accent">{notice}</p>}
              </div>
              <div className="border-t border-hair bg-[linear-gradient(180deg,rgba(62,92,120,.055),rgba(255,255,255,.3))] p-5 md:p-7 xl:border-r xl:border-t-0">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[.68rem] font-black uppercase tracking-[.12em] text-accent">خلف الكواليس</p><h3 className="mt-1 text-[.95rem] font-bold text-ink">كل هذا يحدث من نفسه</h3></div><span className={`rounded-full px-3 py-1 text-[.62rem] font-bold ${zeroDecisionPhase === 'done' ? 'bg-emerald-100 text-emerald-700' : zeroDecisionBusy ? 'bg-accent/10 text-accent' : 'bg-paper text-soft'}`}>{zeroDecisionPhase === 'done' ? 'اكتمل' : zeroDecisionBusy ? 'يعمل الآن' : 'جاهز'}</span></div>
                <div className="mt-4 grid gap-2">
                  {zeroDecisionSteps.map((item, index) => {
                    const complete = zeroDecisionPhase === 'done' || (zeroDecisionPhaseIndex >= 0 && index < zeroDecisionPhaseIndex)
                    const active = zeroDecisionPhase !== 'done' && index === zeroDecisionPhaseIndex
                    return <div key={item.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition ${active ? 'border-accent/35 bg-white shadow-sm' : complete ? 'border-emerald-200 bg-emerald-50/70' : 'border-hair bg-white/45'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[.65rem] font-black ${active ? 'bg-accent text-white' : complete ? 'bg-emerald-500 text-white' : 'border border-hair bg-paper text-soft'}`}>{complete ? '✓' : String(index + 1).padStart(2, '0')}</span><span><strong className="block text-[.72rem] text-ink">{item.label}</strong><span className="mt-0.5 block text-[.62rem] text-soft">{item.note}</span></span></div>
                  })}
                </div>
                {generatedPrompt && <details className="mt-4 rounded-2xl border border-hair bg-white/65 px-4 py-3"><summary className="cursor-pointer text-[.68rem] font-semibold text-ink">التوجيه البصري الذي كتبه المخرج للصورة</summary><p dir="ltr" className="mt-3 max-h-40 overflow-y-auto text-left text-[.62rem] leading-relaxed text-soft">{generatedPrompt}</p></details>}
              </div>
            </div>
          </section>
        )}

        {!SIMPLIFIED_STUDIO && stage === 'idea' && <>
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
            <BufferedIdeaTextarea textareaRef={textRef} className={`${input} min-h-36 resize-y text-base leading-loose`} value={text} onCommit={setText} placeholder="مثال: الذكاء الاصطناعي لا يجب أن يسرق من المعلم إنسانيته" /><span className="text-[.62rem] font-normal leading-relaxed text-soft">اكتب براحتك؛ لن ينتقل الاستوديو أو يبدأ البحث حتى تضغط زر البناء.</span>
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
              <div className="flex items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold text-accent">قراءة المخرج للقصة</p><h3 className="mt-1 text-[.95rem] font-bold text-ink">ليست قالباً؛ هذه هي الحجة التي يجب أن تحملها الصورة.</h3></div><span className="rounded-full border border-accent/25 px-2.5 py-1 text-[.62rem] font-bold text-accent">ثقة {creativeBrief.confidence}٪</span></div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[['القضية المركزية', creativeBrief.issue], ['التوتر', creativeBrief.tension], ['جملة التوقف', creativeBrief.hook], ['الدليل الأقوى', creativeBrief.evidence], ['العاطفة', creativeBrief.emotion], ['الجمهور', creativeBrief.audience], ['ما يجب أن يبقى', creativeBrief.memory], ['ما يجب تجنبه', creativeBrief.avoid]].map(([label, value]) => <div key={label} className="rounded-xl border border-hair bg-canvas px-3 py-2.5"><dt className="text-[.62rem] font-semibold text-soft">{label}</dt><dd className="mt-1 text-[.73rem] leading-relaxed text-ink">{value}</dd></div>)}
              </dl>
              <p className="mt-3 rounded-xl border border-hair bg-canvas px-3 py-2.5 text-[.72rem] leading-relaxed text-ink"><strong className="text-accent">الحاجة البصرية:</strong> {creativeBrief.visualReason}</p>
            </section>
            <section className="rounded-2xl border border-hair bg-canvas p-4">
              <p className="text-[.68rem] font-bold text-accent">شخصية الهوية لهذه القطعة</p>
              <p className="mt-1 text-[.7rem] leading-relaxed text-soft">تُحفظ محلياً وتوجّه القرارات من دون تغيير هوية الموقع الأساسية.</p>
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
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold text-accent">ذكاء الصور · جواز الصورة</p><p className="mt-1 text-[.72rem] text-soft">يبحث عند طلبك في المصادر المفتوحة <strong className="text-ink">Wikimedia Commons</strong> و<strong className="text-ink">Pexels</strong> و<strong className="text-ink">Openverse</strong>، أو يحلل الصورة التي ترفعها. بعدها يعيد بناء التكوين حول نقطة التركيز والمساحة الهادئة ويحتفظ بالمصدر والترخيص.</p></div><label className={`${ghost} cursor-pointer`}><input type="file" accept="image/*" className="hidden" disabled={imageBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void runImagePassport(file); event.currentTarget.value = '' }} />{imageBusy ? 'يحلل الصورة…' : 'حمّل صورة مرشحة'}</label></div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-2xl border border-hair bg-paper/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">البحث البصري الذكي</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">يبني الاستوديو الاستعلام من القضية المركزية لا من كلمات عشوائية، ويقترح مصادر مجانية وموثقة أولاً.</p></div><button type="button" className={ghost} disabled={externalBusy} onClick={() => void runExternalSearch()}>{externalBusy ? 'يبحث…' : 'أعد البحث الآن'}</button></div>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <input className={input} value={externalQuery || visualSearchPlan.queries[0] || ''} onChange={(event) => setExternalQuery(event.target.value)} placeholder="عبارة البحث البصري" />
                  <div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={() => void runExternalSearch(externalQuery || visualSearchPlan.queries[0])}>ابحث</button><button type="button" className={ghost} onClick={() => void copyGenerationPrompt()}>انسخ Prompt</button><button type="button" className={ghost} disabled={!imageGeneratorEndpoint || generatorBusy} onClick={() => void runGenerator()}>{generatorBusy ? 'يولّد…' : imageGeneratorEndpoint ? 'ولّد صورة جديدة' : 'مولّد الصور غير موصول'}</button></div>
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
                  <p className="mt-2 text-[.6rem] leading-relaxed text-soft">البحث المجاني يعمل الآن مباشرة. أمّا توليد صورة جديدة بالذكاء الاصطناعي فيحتاج مزوداً خلفياً موصولاً؛ عند غيابه يبقى هذا الـPrompt جاهزاً للنسخ.</p>
                </div>
                {externalError && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.68rem] text-amber-900">{externalError}</p>}
              </section>
              <section className="rounded-2xl border border-hair bg-paper/60 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">المصادر المجانية المفعلة</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">Wikimedia Commons مفعّل. Pexels مفعّل بالمفتاح الحالي. {hasOpenverseProvider ? 'Openverse مفعّل أيضاً.' : 'Openverse سيظهر تلقائياً عند توفر نتائج مناسبة.'}</p></div><div className="rounded-full border border-hair px-3 py-1.5 text-[.62rem] text-soft">{externalProviderLabels.length ? externalProviderLabels.join(' · ') : 'Wikimedia Commons'}</div></div>
                <div className="mt-3 grid gap-2 text-[.66rem] text-soft"><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">المسار</strong>استعلام إنجليزي دلالي → فحص المصدر والدقة → استبعاد الصور العامة → أفضل مرشح فقط.</div><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">جواز الصورة</strong>يعرض المصدر، المالك، الترخيص، ولماذا اختيرت الصورة قبل إدخالها إلى اللوحة.</div><div className="rounded-xl border border-hair bg-canvas px-3 py-2"><strong className="block text-ink">التنسيق الإبداعي</strong>يعاد بناء التكوين حول نقطة التركيز ومساحة القراءة؛ لا توضع الصورة كخلفية جامدة تحت النص.</div></div>
              </section>
            </div>
            {bestExternalVisual && <section className="mt-3 rounded-2xl border border-accent/15 bg-accent/[.035] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">المرشح الأقوى الآن</p><p className="mt-1 text-[.68rem] leading-relaxed text-soft">هذا الترشيح الأعلى صلةً من بين النتائج المجانية الحالية، ويصلح غالباً للعنوان والقص عبر المنصات.</p></div><span className="rounded-full border border-accent/20 bg-white/70 px-3 py-1.5 text-[.62rem] font-semibold text-accent">درجة الملاءمة {bestExternalVisual.score}/99</span></div>
              <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
                <RemoteVisualThumbnail src={bestExternalVisual.thumbnailUrl} alt={bestExternalVisual.title} className="aspect-[4/3] w-full rounded-2xl border border-hair object-cover" />
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-[.86rem] text-ink">{bestExternalVisual.title}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{bestExternalVisual.providerLabel}</span><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{bestExternalVisual.orientation === 'landscape' ? 'أفقي' : bestExternalVisual.orientation === 'portrait' ? 'عمودي' : bestExternalVisual.orientation === 'square' ? 'مربع' : 'غير محدد'}</span></div>
                  <p className="text-[.68rem] leading-relaxed text-soft">{bestExternalVisual.description}</p>
                  <p className="text-[.62rem] leading-relaxed text-soft"><strong className="text-ink">سبب الترشيح:</strong> {bestExternalVisual.rationale}</p>
                  <div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => void applyExternalVisual(bestExternalVisual, 'cinematic')}>ابنِ المشهد مباشرة</button><button type="button" className={ghost} onClick={() => void applyExternalVisual(bestExternalVisual)}>حلّل الصورة فقط</button><a href={bestExternalVisual.pageUrl || bestExternalVisual.imageUrl} target="_blank" rel="noreferrer" className={ghost}>افتح المصدر</a></div>
                </div>
              </div>
            </section>}
            
            <details className="mt-3 rounded-xl border border-hair bg-paper/55" open={externalVisuals.length > 0}>
              <summary className="cursor-pointer list-none px-4 py-3 text-[.7rem] font-semibold text-ink">مرشحات خارجية مجانية <span className="ms-2 font-normal text-soft">مرتبة تلقائياً من البحث البصري الذكي</span></summary>
              <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto border-t border-hair p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{externalBusy ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أبحث الآن في المصادر المجانية…</p> : externalVisuals.length ? externalVisuals.map((item, index) => <article key={item.id} className={`w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-canvas ${index === 0 ? 'border-accent/30 shadow-[0_16px_40px_rgba(17,41,75,.08)]' : 'border-hair'}`}><RemoteVisualThumbnail src={item.thumbnailUrl} alt={item.title} className="aspect-[4/3] w-full object-cover" /><div className="grid gap-2 p-3 text-right"><div className="flex items-start justify-between gap-2"><strong className="line-clamp-2 text-[.72rem] text-ink">{item.title}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.56rem] text-soft">{item.providerLabel}</span></div><div className="flex flex-wrap gap-2">{index === 0 ? <span className="rounded-full border border-accent/20 bg-accent/[.06] px-2 py-1 text-[.54rem] font-semibold text-accent">الأقوى الآن</span> : null}<span className="rounded-full border border-hair px-2 py-1 text-[.54rem] text-soft">{item.score}/99</span><span className="rounded-full border border-hair px-2 py-1 text-[.54rem] text-soft">{item.orientation === 'landscape' ? 'أفقي' : item.orientation === 'portrait' ? 'عمودي' : item.orientation === 'square' ? 'مربع' : 'غير محدد'}</span></div><p className="line-clamp-3 text-[.62rem] leading-relaxed text-soft">{item.description}</p><p className="text-[.58rem] leading-relaxed text-soft"><strong className="text-ink">لماذا اختيرت؟</strong> {item.rationale}</p><p className="text-[.56rem] text-soft">{item.author} · {item.license}</p><div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => void applyExternalVisual(item, index === 0 ? 'cinematic' : 'editorial')}>ابنِ بها</button><button type="button" className={ghost} onClick={() => void applyExternalVisual(item)}>حلّل</button><a href={item.pageUrl || item.imageUrl} target="_blank" rel="noreferrer" className={ghost}>المصدر</a></div></div></article>) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">لا توجد مرشحات خارجية بعد. اضغط «أعد البحث الآن» بعد اكتمال الفكرة. لا يبدأ البحث أثناء الكتابة حتى لا يعلق الهاتف.</p>}</div>
            </details>
            {imagePassport ? <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="overflow-hidden rounded-2xl border border-hair bg-paper"><img src={imagePassport.dataUrl} alt="معاينة الصورة المرشحة" className="aspect-square h-full w-full object-cover" /></div>
              <div className="grid gap-3">
                <div className="grid gap-2 sm:grid-cols-4"><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.width}×{imagePassport.height}</strong>الأبعاد</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.luminance}٪</strong>الإضاءة</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.contrast}٪</strong>التباين</span><span className="rounded-xl border border-hair px-3 py-2 text-[.66rem] text-soft"><strong className="block text-ink">{imagePassport.edgeDensity}٪</strong>كثافة التفاصيل</span></div>
                <div className="grid gap-2 sm:grid-cols-2"><input className={input} value={imageDescription} onChange={(event) => setImageDescription(event.target.value)} placeholder="صف المشهد لاختبار الكليشيه" /><input className={input} value={imageSource} onChange={(event) => setImageSource(event.target.value)} placeholder="المصدر أو الرابط" /><input className={input} value={imageOwner} onChange={(event) => setImageOwner(event.target.value)} placeholder="المالك أو المصور" /><input className={input} value={imageLicense} onChange={(event) => setImageLicense(event.target.value)} placeholder="نوع الترخيص" /></div>
                <ul className="grid gap-1">{imagePassport.cropNotes.map((note) => <li key={note} className="text-[.69rem] leading-relaxed text-soft">— {note}</li>)}</ul>
                {clicheWarnings.length > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.7rem] leading-relaxed text-amber-900"><strong>تنبيه ضد الكليشيه:</strong> {clicheWarnings.map((item) => `${item.label}: ${item.alternative}`).join(' · ')}</div> : imageDescription && <p className="rounded-xl border border-accent/20 bg-accent/[.04] px-3 py-2 text-[.68rem] text-accent">لم يلتقط الفحص الوصفي أحد الكليشيهات الثمانية المعروفة. هذا فحص وصفي، لا حكم فني نهائي.</p>}
                <div className="grid gap-3"><div className="flex flex-wrap gap-2"><button type="button" className={primary} disabled={!selected} onClick={() => applyImageLedDirection('cinematic')}>مشهد سينمائي كامل</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('documentary')}>وثائقي إنساني</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('editorial')}>غلاف تحريري</button><button type="button" className={ghost} disabled={!selected} onClick={() => applyImageLedDirection('duotone')}>ثنائي اللون فاخر</button><button type="button" className={ghost} disabled={!selected} onClick={() => addOverlay('image')}>أضفها كطبقة حرة</button></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-hair px-3 py-2 text-[.62rem] text-soft">المخرج يحدد منطقة النص من المساحة الهادئة ويثبت نقطة التركيز تلقائياً.</span><span className="self-center text-[.62rem] text-soft">المصدر: {imageSource || 'غير مسجل'} · الترخيص: {imageLicense || 'غير مسجل'}</span></div></div>
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

      {SIMPLIFIED_STUDIO && stage === 'directions' && (
        <section className={`${card} overflow-hidden`}>
          {approvedPlan ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
            <div className="rounded-[1.65rem] border border-hair bg-canvas p-3 shadow-[0_24px_70px_rgba(15,23,42,.08)]"><Preview plan={approvedPlan} className="w-full" /></div>
            <div className="grid content-start gap-4">
              <div><div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[.62rem] font-black uppercase tracking-[.12em] text-emerald-700">Approved by Zero-Decision</div><h3 className="mt-4 font-display text-3xl font-bold leading-tight text-ink">هذه هي النتيجة التي اعتمدها المخرج.</h3><p className="mt-3 text-[.82rem] leading-loose text-soft">{zeroDecision?.note || 'تم اختيارها بعد مقارنة الجودة وقوة التوقف والقراءة والأصالة وملاءمة الفكرة والجمهور.'}</p></div>
              <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-hair bg-canvas px-3 py-3 text-center"><strong className="block font-display text-2xl text-accent">{approvedPlan.quality?.score || 0}٪</strong><span className="text-[.62rem] text-soft">جودة التكوين</span></div><div className="rounded-2xl border border-hair bg-canvas px-3 py-3 text-center"><strong className="block font-display text-2xl text-accent">{predictEngagement(approvedPlan).score}٪</strong><span className="text-[.62rem] text-soft">قوة التوقف</span></div><div className="rounded-2xl border border-hair bg-canvas px-3 py-3 text-center"><strong className="block font-display text-2xl text-accent">{zeroDecision?.campaignQuality || campaign?.qualityScore || 0}٪</strong><span className="text-[.62rem] text-soft">جودة الحملة</span></div></div>
              <div className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.66rem] font-bold text-accent">لماذا هذه النسخة؟</p><ul className="mt-2 grid gap-1.5">{approvedPlan.rationale.slice(0,4).map((line) => <li key={line} className="text-[.7rem] leading-relaxed text-ink/80">• {line}</li>)}</ul></div>
              <div className={`overflow-hidden rounded-2xl border p-4 ${approvedVisualOrigin === 'generated' ? 'border-violet-200 bg-[linear-gradient(135deg,rgba(124,58,237,.07),rgba(255,255,255,.7))]' : approvedVisualOrigin === 'ready' ? 'border-accent/25 bg-[linear-gradient(135deg,rgba(62,92,120,.07),rgba(255,255,255,.7))]' : 'border-hair bg-canvas'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.66rem] font-bold text-accent">هوية الصورة</p><h4 className="mt-1 text-[.88rem] font-bold text-ink">{approvedVisualOrigin === 'generated' ? 'مولدة من الصفر بالذكاء الاصطناعي' : approvedVisualOrigin === 'ready' ? 'صورة جاهزة منتقاة وموثقة' : 'تكوين بصري بلا صورة'}</h4><p className="mt-1.5 text-[.66rem] leading-relaxed text-soft">{approvedImageOwner || 'لا يوجد مالك خارجي'} · {approvedImageLicense || 'لا يوجد ترخيص خارجي'}</p></div><span className={`rounded-full px-3 py-1.5 text-[.6rem] font-black ${approvedVisualOrigin === 'generated' ? 'bg-violet-100 text-violet-700' : approvedVisualOrigin === 'ready' ? 'bg-accent/10 text-accent' : 'bg-paper text-soft'}`}>{approvedVisualOrigin === 'generated' ? 'AI GENERATED' : approvedVisualOrigin === 'ready' ? 'READY SOURCE' : 'TYPOGRAPHIC'}</span></div>
                {approvedVisualOrigin === 'generated' && <div className="mt-3 grid gap-2 rounded-xl border border-violet-100 bg-white/55 px-3 py-2.5 text-[.62rem] text-soft sm:grid-cols-2"><span><strong className="text-ink">البصمة الفنية:</strong> {generatedVisualWorld || 'يحددها المخرج لكل فكرة'}</span><span><strong className="text-ink">مطابقة المعنى:</strong> {generatedRelevanceScore == null ? 'فحص بصري داخلي' : `${generatedRelevanceScore}٪`}</span>{generatedRelevanceReason && <span className="sm:col-span-2"><strong className="text-ink">حكم المطابقة:</strong> {generatedRelevanceReason}</span>}<span className="sm:col-span-2 text-[.56rem]">بيانات النموذج والمصدر محفوظة في جواز التصميم ولا تُطبع داخل الصورة.</span></div>}
                {approvedImageSource && <p dir="ltr" className="mt-3 truncate text-left text-[.58rem] text-accent">{approvedImageSource}</p>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2"><button type="button" className={`${primary} rounded-[1.2rem] py-3.5`} onClick={() => { setSelected(approvedPlan); setStage('edit') }}>افتح التحرير</button><button type="button" className={`${ghost} rounded-[1.2rem] py-3.5`} onClick={() => handleStageChange('publish')}>انتقل إلى النشر</button><button type="button" className="rounded-[1.2rem] border border-violet-200 bg-violet-50 px-4 py-3 text-[.72rem] font-bold text-violet-700 transition hover:border-violet-400 disabled:opacity-50" onClick={() => void runZeroDecisionMode('generate')} disabled={zeroDecisionBusy}>{zeroDecisionBusy && visualMode === 'generate' ? 'يولّد من الصفر…' : 'أعد التوليد من الصفر'}</button><button type="button" className="rounded-[1.2rem] border border-accent/25 bg-accent/[.055] px-4 py-3 text-[.72rem] font-bold text-accent transition hover:border-accent/50 disabled:opacity-50" onClick={() => void runZeroDecisionMode('ready')} disabled={zeroDecisionBusy}>{zeroDecisionBusy && visualMode === 'ready' ? 'يبحث عن جاهز مختلف…' : 'اختر جاهزاً مختلفاً'}</button></div>
            </div>
          </div> : <div className="grid min-h-[360px] place-items-center rounded-[1.6rem] border border-dashed border-hair bg-canvas p-8 text-center"><div><h3 className="font-display text-2xl font-bold text-ink">لا توجد نتيجة معتمدة بعد.</h3><p className="mt-2 text-[.78rem] text-soft">ارجع إلى تبويب الفكرة واضغط «صمّم لي».</p><button type="button" className={`${primary} mt-4`} onClick={() => setStage('idea')}>العودة إلى الفكرة</button></div></div>}
        </section>
      )}

      {SIMPLIFIED_STUDIO && stage === 'publish' && (
        <section className={`${card} overflow-hidden`}>
          {approvedPlan ? <>
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[.68rem] font-black uppercase tracking-[.15em] text-accent">Publish without noise</p><h3 className="mt-1 font-display text-3xl font-bold text-ink">كل شيء جاهز للنشر من مكان واحد.</h3><p className="mt-2 max-w-2xl text-[.8rem] leading-loose text-soft">النسخة المعتمدة، المقاسات، والحملة السردية. لا خيارات تصميم إضافية هنا؛ فقط القرار النهائي والتنزيل.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => void exportPlan(approvedPlan, 'png')}>تنزيل التصميم PNG</button><button type="button" className={ghost} onClick={() => void exportAllSizes(approvedPlan)}>كل المقاسات</button></div></div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]"><div className="rounded-[1.4rem] border border-hair bg-canvas p-3"><Preview plan={approvedPlan} /><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => { setSelected(approvedPlan); setStage('edit') }}>التحرير</button><button type="button" className={ghost} onClick={() => void downloadCompositionSvg(approvedPlan)}>SVG</button><button type="button" className={ghost} onClick={() => printCompositionPdf(approvedPlan)}>PDF</button></div></div>
              <div>{campaign ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.68rem] font-bold text-accent">الحملة السردية</p><p className="mt-1 text-[.72rem] text-soft">{campaign.assets.length} قطع، لكل واحدة وظيفة بصرية مختلفة.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-hair px-3 py-1.5 text-[.64rem] text-soft">جودة {campaign.qualityScore}٪</span><span className="rounded-full border border-hair px-3 py-1.5 text-[.64rem] text-soft">تماسك {campaign.coherenceScore}٪</span><button type="button" className={primary} disabled={!campaign.ready} onClick={() => void downloadSocialCampaignRaster(campaign, 'png')}>تنزيل الحملة</button><button type="button" className={ghost} disabled={!campaign.ready} onClick={() => printSocialCampaignPdf(campaign)}>PDF</button></div></div><div className="mt-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex min-w-max gap-3">{campaign.assets.map((asset) => <article key={asset.id} className="w-[220px] shrink-0 rounded-2xl border border-hair bg-canvas p-2.5"><Preview plan={asset.plan} /><strong className="mt-2 block text-[.72rem] text-ink">{asset.label}</strong><p className="mt-1 text-[.62rem] leading-relaxed text-soft">{asset.purpose}</p></article>)}</div></div></> : <div className="grid min-h-[280px] place-items-center rounded-[1.5rem] border border-dashed border-hair bg-canvas p-6 text-center"><div><h4 className="font-display text-xl font-bold text-ink">الحملة لم تُبنَ بعد.</h4><p className="mt-2 text-[.72rem] text-soft">ابنها حول النسخة المعتمدة من دون تغيير التصميم الأساسي.</p><button type="button" className={`${primary} mt-4`} onClick={() => runCampaign(text, context, approvedPlan, { preserveSelection: true })}>ابنِ الحملة الآن</button></div></div>}</div></div>
          </> : <div className="grid min-h-[340px] place-items-center text-center"><div><h3 className="font-display text-2xl font-bold text-ink">ابدأ بالفكرة أولاً.</h3><button type="button" className={`${primary} mt-4`} onClick={() => setStage('idea')}>العودة</button></div></div>}
        </section>
      )}

      {!SIMPLIFIED_STUDIO && plans.length > 0 && stage !== 'idea' && stage !== 'publish' && (
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
          {releasePack.length > 0 && <div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-accent/20 bg-accent/[.04] p-4 md:col-span-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[.68rem] font-bold uppercase tracking-[.16em] text-accent">Absolute Release Pack</p><h4 className="mt-1 text-[1rem] font-bold text-ink">ثلاث نسخ لا يحتاج بعدها الفريق إلى سؤال: ماذا ننشر؟</h4><p className="mt-1 text-[.72rem] leading-relaxed text-soft">هذه الحزمة ليست تبديلاً سطحياً؛ كل نسخة بُنيت لوظيفة نشر مختلفة: المرجع الرسمي، النسخة الأكثر أماناً، والنسخة الأعلى قابلية للتوقف والانتشار.</p></div><div className="flex flex-wrap gap-2"><button type="button" className={ghost} onClick={() => void buildReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'يعيد بناء الحزمة…' : 'أعد بناء الحزمة'}</button><button type="button" className={primary} onClick={() => void exportReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'ينزّل الحزمة…' : 'تنزيل Final / Safer / Viral'}</button></div></div></div>{releasePack.map((item) => <article key={item.id} className="rounded-2xl border border-hair bg-canvas p-3"><button type="button" className="block w-full text-right" onClick={() => { setSelected(item.plan); setStage('edit') }}><Preview plan={item.plan} /></button><div className="pt-3"><div className="flex items-center justify-between gap-2"><strong className="text-[.8rem] text-ink">{item.label}</strong><span className="rounded-full border border-hair px-2 py-1 text-[.58rem] text-soft">{item.score}٪</span></div><p className="mt-2 text-[.66rem] leading-relaxed text-soft">{item.note}</p><div className="mt-3 flex gap-2"><button type="button" className={`${ghost} flex-1`} onClick={() => { setSelected(item.plan); setStage('edit') }}>فتح</button><button type="button" className={ghost} onClick={() => void exportPlan(item.plan, 'png')}>PNG</button></div></div></article>)}</div>}
          {zeroDecision && <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[.68rem] font-bold uppercase tracking-[.16em] text-emerald-700">Zero-Decision Mode</p><h4 className="mt-1 text-[1rem] font-bold text-ink">النظام حسم قرار النشر بدلاً عنك.</h4><p className="mt-1 max-w-3xl text-[.74rem] leading-relaxed text-soft">{zeroDecision.note}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">النسخة المعتمدة: {zeroDecision.approved.label}</span><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">درجة النسخة {zeroDecision.approved.score}٪</span><span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[.64rem] font-semibold text-emerald-700">الحملة {zeroDecision.campaignQuality}٪</span></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={primary} onClick={() => { setSelected(zeroDecision.approved.plan); setStage('edit') }}>افتح النسخة المعتمدة</button><button type="button" className={ghost} onClick={() => void exportPlan(zeroDecision.approved.plan, 'png')}>تنزيل النسخة المعتمدة</button><button type="button" className={ghost} onClick={() => void exportReleasePack()} disabled={releasePackBusy}>{releasePackBusy ? 'ينزّل الحزمة…' : 'تنزيل الحزمة كاملة'}</button><span className={`rounded-full px-3 py-2 text-[.66rem] font-semibold ${zeroDecision.campaignReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{zeroDecision.campaignReady ? 'الحملة جاهزة مبدئياً' : 'الحملة تحتاج مراجعة نهائية'}</span></div></section>}
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


      {!SIMPLIFIED_STUDIO && campaign && stage === 'publish' && (
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

      {selected && stage === 'edit' && (
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
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">إخراج جديد</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={ghost} type="button" onClick={() => regenerateSelected('smart')}>اقتراح أذكى</button><button className={ghost} type="button" onClick={() => regenerateSelected('luxury')}>أكثر فخامة</button><button className={ghost} type="button" onClick={() => regenerateSelected('calm')}>أكثر هدوءاً</button><button className={ghost} type="button" onClick={() => regenerateSelected('bold')}>أكثر جرأة</button></div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">تحويل ذكي للمقاس</p><div className="mt-3 flex flex-wrap gap-2">{formatActions.map((action) => <button key={action.id} className={ghost} type="button" onClick={() => transform(action.id)}>{action.label}</button>)}</div></section>
                <section className="rounded-2xl border border-hair bg-canvas p-4"><p className="text-[.7rem] font-bold text-accent">التصدير</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button className={primary} type="button" onClick={() => void exportPlan(selected, 'png')}>تنزيل PNG</button><button className={ghost} type="button" onClick={() => void exportPlan(selected, 'jpeg')}>تنزيل JPG</button><button className={ghost} type="button" onClick={() => void downloadCompositionSvg(selected)}>تنزيل SVG</button><button className={ghost} type="button" onClick={() => printCompositionPdf(selected)}>طباعة / PDF</button><button className={`${primary} sm:col-span-2`} type="button" title="الأصل + مربع + ستوري + LinkedIn، كل نسخة بهندسة مقاسها" onClick={() => void exportAllSizes(selected)}>كل المقاسات دفعة واحدة</button></div></section>
                <div className="grid gap-2 sm:grid-cols-2"><button type="button" className={primary} onClick={() => saveSelectedToLibrary(selected)}>هذا ذوقي · احفظه</button><button type="button" className={ghost} onClick={() => { teachTaste(selected, -1); setSelected(null); generate() }}>أبعد هذا الأسلوب</button></div>
                <button type="button" className={ghost} onClick={buildCampaign}>حوّل هذا الاتجاه إلى حملة متكاملة</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
