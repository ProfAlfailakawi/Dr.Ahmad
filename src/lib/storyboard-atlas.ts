/**
 * أطلس القصص البصرية — منطق نقيّ قابل للاختبار.
 *
 * لا يولّد شيئاً جديداً ولا يكرّر «المخرج الحي»: يقرأ الأرشيف الموجود ويقيس شيئين
 * منفصلين بحسابٍ حتميٍّ شفاف (بلا نموذج لغوي وبلا استدعاء خارجي):
 *   • اكتمال المادة (material): هل في النص ما يكفي لبناء لوحة قصة؟ — طولٌ ومقتطفٌ وعنوان؛
 *   • قوة الفكرة (idea): هل في النص مؤشراتٌ لفظية تعين على التصوير؟ — حكايةٌ وسؤالٌ وألفاظٌ حسّية
 *     وتظليل القرّاء. هذه كلماتٌ مفتاحية لا فهمٌ للمعنى؛ مؤشرٌ لا حكم.
 * «جاهزة للوحة» تعني أن المادة كافية وأن للفكرة حداً أدنى من المؤشرات — لا أنها فكرةٌ بصريةٌ ممتازة.
 * ثم يقترح عائلة عالمٍ من عوالم الاستوديو، ويجهّز «بذرة» تُفتح في `live-director` عبر
 * المصافحة القائمة (studio:live-director-seed).
 *
 * الملف نقيّ عمداً: لا يستورد سوى الأنواع (تُمحى في التشغيل)، فيبقى قابلاً
 * للاختبار تحت node مباشرة كما تُختبر بقية محركات الموقع.
 */
import type { ArticleRecord, BookRecord, PaperRecord } from './cms.ts'

export type AtlasKind = 'article' | 'paper' | 'book'

/** عائلات العوالم الست عشرة كما في design-worlds؛ يُطابقها المكوّن لاختيار عالمٍ بعينه. */
export type AtlasFamilyHint =
  | 'cosmic' | 'editorial' | 'organic' | 'architectural' | 'kuwait-gulf'
  | 'technology-data' | 'cinematic' | 'quiet-luxury' | 'typographic' | 'surreal'
  | 'human-emotional' | 'experimental' | 'academic-knowledge' | 'media-society'
  | 'education-childhood' | 'material-environment'

/** بذرة تُمرَّر حرفياً في تفاصيل حدث studio:live-director-seed. */
export type AtlasSeed = {
  type: 'article_video'
  source: string
  title: string
  article: { slug: string; title: string; excerpt: string; body: string; cat: string }
}

export type AtlasEstimate = { seconds: 24 | 48 | 64; shots: number; layers: number }

/** حالة الجاهزية للوحة: تفصل اكتمال المادة عن قوة الفكرة. */
export type AtlasBoardState = 'ready' | 'needs-idea' | 'needs-material'

export type AtlasEntry = {
  kind: AtlasKind
  slug: string
  title: string
  subtitle: string
  year: string
  /** 0..100 — مؤشر مركّب للترتيب فقط (٣٥٪ مادة + ٦٥٪ فكرة)، لا يُعرض وحده بوصفه حكماً. */
  potential: number
  /** 0..100 — اكتمال المادة: هل تكفي لبناء لوحة؟ */
  material: number
  /** 0..100 — قوة الفكرة بمؤشراتٍ لفظية (حكاية، سؤال، ألفاظ حسية، تظليل القرّاء). */
  idea: number
  /** الحكم العملي: جاهزة / المادة كافية والفكرة تحتاج زاوية / تحتاج مادة أوضح. */
  board: AtlasBoardState
  /** أسبابٌ بشرية تشرح الدرجتين، تُعرض في اللوحة. */
  reasons: string[]
  materialReasons: string[]
  ideaReasons: string[]
  familyHint: AtlasFamilyHint
  estimate: AtlasEstimate
  seed: AtlasSeed
}

const KIND_LABEL: Record<AtlasKind, string> = { article: 'مقال', paper: 'بحث', book: 'كتاب' }
/* حدّا الجاهزية: المادة لا تقلّ عن ٥٠ و٦٠ كلمة، والفكرة لا تقلّ عن ٤٥ من المؤشرات اللفظية. */
export const MATERIAL_READY_MIN = 50
export const MIN_BOARD_WORDS = 60
export const IDEA_READY_MIN = 45

const words = (value = '') => value.trim().split(/\s+/).filter(Boolean)
const wordCount = (value = '') => words(value).length
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const clip = (value: string, max: number) => { const w = words(value); return w.length <= max ? value.trim() : `${w.slice(0, max).join(' ')}…` }

/** بصمة رقمية ثابتة من نصّ — لاختيارٍ حتميٍّ بلا عشوائية. */
export function stableHash(seed: string): number {
  let hash = 2166136261
  for (const character of seed) { hash ^= character.codePointAt(0) || 0; hash = Math.imul(hash, 16777619) }
  return hash >>> 0
}

/*
 * إشارات لفظية بمطابقة كلمة كاملة (لا مطابقة جزء من كلمة). الصيغة السابقة كانت تطابق «باب» داخل «أسباب»،
 * و«طريق» داخل «طريقة»، و«حدث» داخل «الحديث»، و«حين » في كل نثر — فتبدو أغلب النصوص حسّيةً وسرديةً بلا سبب.
 * نُجرّد البادئات (و/ف + ب/ل/ك/لل + ال) واللواحق الضميرية قبل المقارنة.
 */
const AR_MARKS = /[\u064B-\u065F\u0670\u0640]/g
const normalizeArabic = (text: string) => text.replace(AR_MARKS, '').replace(/[إأآ]/g, 'ا').replace(/ى/g, 'ي')
const tokensOf = (text: string) => normalizeArabic(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
const PREFIX = /^(?:و|ف)?(?:لل|ب|ل|ك)?(?:ال)?/
const SUFFIX = /(?:ها|هم|هن|كم|نا|ه|ي|ك)$/
const wordSet = (words: string) => new Set(words.split(/\s+/).filter(Boolean).map(normalizeArabic))
const hasAnyWord = (tokens: string[], set: Set<string>) => tokens.some((token) => {
  const bare = token.replace(PREFIX, '')
  const stem = bare.replace(SUFFIX, '')
  /* تاء التأنيث تصير تاءً مفتوحة مع الضمير: «تجربتي» ← «تجربة». */
  return set.has(token) || set.has(bare) || set.has(stem) || (stem !== bare && stem.endsWith('ت') && set.has(`${stem.slice(0, -1)}ة`))
})

const NARRATIVE_WORDS = wordSet('قصة قصص حكاية حكايات تجربة تجارب مقارنة مثال امثلة موقف مواقف حدث حادثة')
const NARRATIVE_PHRASES = /في المقابل|من جهة|ذات مرة|يحكى ان/
const PROVOKE_WORDS = wordSet('لماذا كيف هل')
const PROVOKE_PHRASES = /ماذا لو|[؟?]/
const IMAGERY_WORDS = wordSet('باب ابواب ضوء اضواء جسر جسور مراة مرايا بحر بحار نافذة نوافذ ظل ظلال جدار جدران شجرة اشجار شجر نهر انهار بوصلة خريطة خرائط مصباح مصابيح عتبة افق افاق سماء جذر جذور صدى')

export function verbalSignals(text: string): { narrative: boolean; provoke: boolean; imagery: boolean } {
  const tokens = tokensOf(text)
  const plain = normalizeArabic(text)
  return {
    narrative: hasAnyWord(tokens, NARRATIVE_WORDS) || NARRATIVE_PHRASES.test(plain),
    provoke: hasAnyWord(tokens, PROVOKE_WORDS) || PROVOKE_PHRASES.test(plain),
    imagery: hasAnyWord(tokens, IMAGERY_WORDS),
  }
}

/** تقدير المدة/اللقطات بمرآةٍ خفيفة لمنطق المخرج الحي (بلا استيراده). */
export function estimateFor(input: { body?: string; excerpt?: string }): AtlasEstimate {
  const text = input.body || input.excerpt || ''
  const count = wordCount(text)
  const complex = verbalSignals(text).narrative || /دراسة|نتيجة|مقارنة|أولاً|ثانياً/.test(text)
  if (count <= 260 && !complex) return { seconds: 24, shots: 3, layers: 3 }
  if (count >= 600 && complex) return { seconds: 64, shots: 8, layers: 5 }
  return { seconds: 48, shots: 6, layers: 4 }
}

/**
 * اكتمال المادة — لا يعتمد على نوع العمل (كان لكل نوعٍ درجة أساس فتبدو «جاهزة» مادةٌ شبه فارغة).
 * الكلمات: <٣٠ → ١٠ · <٦٠ → ٣٠ · <١٢٠ → ٥٠ · <٢٠٠ → ٦٥ · <٣٥٠ → ٨٠ · غير ذلك ٩٥. +٥ لمقتطف، −٢٠ بلا عنوان.
 */
export function materialReadiness(input: { title?: string; excerpt?: string; body?: string }): { material: number; reasons: string[]; words: number } {
  const words = wordCount(input.body || input.excerpt || '')
  const reasons: string[] = []
  let material: number
  if (words >= 350) { material = 95; reasons.push('متنٌ كافٍ لستّ لقطات دون حشو') }
  else if (words >= 200) { material = 80; reasons.push('متنٌ متوسط يكفي لقصةٍ مركّزة') }
  else if (words >= 120) { material = 65; reasons.push('متنٌ يكفي لإعلانٍ مركّز بثلاث لقطات') }
  else if (words >= MIN_BOARD_WORDS) { material = 50; reasons.push('متنٌ قصير يناسب إعلاناً مركّزاً') }
  else if (words >= 30) { material = 30; reasons.push('المادة نحيلة؛ تحتاج مزيداً من النص قبل اللوحة') }
  else { material = 10; reasons.push('المادة شبه فارغة؛ لا تكفي لبناء لوحة') }
  if ((input.excerpt || '').trim()) { material += 5; reasons.push('مقتطفٌ جاهز يختصر الفكرة') }
  if (!(input.title || '').trim()) { material -= 20; reasons.push('بلا عنوان') }
  return { material: Math.round(clamp(material)), reasons, words }
}

/**
 * قوة الفكرة — مؤشراتٌ لفظية فقط: وجود كلماتٍ دالّة على حكاية أو مقارنة، وسؤالٍ يصلح خطّافاً، وألفاظٍ حسّية،
 * وتظليل قرّاء. لا تقيس جودة المعنى ولا قابلية التصوير الفعلية؛ لذلك تُسمّى «مؤشرات» في الواجهة.
 * أساس ٢٠ + حكاية ٢٥ + سؤال ٢٠ + ألفاظ حسية ٢٠ + تظليل حتى ٢٥ (٥ لكل قارئ).
 */
export function ideaStrength(input: { title?: string; excerpt?: string; body?: string; resonanceCount?: number }): { idea: number; reasons: string[] } {
  const text = `${input.title || ''} ${input.excerpt || ''} ${input.body || ''}`
  const reasons: string[] = []
  let idea = 20
  const signals = verbalSignals(text)
  if (signals.narrative) { idea += 25; reasons.push('مؤشر لفظي: حكاية أو مقارنة تُغني تعدّد اللقطات') }
  if (signals.provoke) { idea += 20; reasons.push('مؤشر لفظي: صيغة سؤال تصلح خطّافاً') }
  if (signals.imagery) { idea += 20; reasons.push('مؤشر لفظي: ألفاظ حسّية تُترجَم بصرياً') }
  const resonance = Math.max(0, input.resonanceCount || 0)
  if (resonance > 0) { idea += Math.min(25, resonance * 5); reasons.push(`ظلّله ${resonance} من القرّاء — أقوى إشارة`) }
  if (idea === 20) reasons.push('لا مؤشرات لفظية على حكاية أو سؤال أو صورة — الفكرة تحتاج زاوية بصرية يختارها المخرج')
  return { idea: Math.round(clamp(idea)), reasons }
}

export function boardStateOf(material: number, idea: number, words: number): AtlasBoardState {
  if (material < MATERIAL_READY_MIN || words < MIN_BOARD_WORDS) return 'needs-material'
  return idea >= IDEA_READY_MIN ? 'ready' : 'needs-idea'
}

/** حسابٌ مركّب حتميّ: يفصل المادة عن الفكرة ويحتفظ بـ`potential` للترتيب والتوافق. */
export function visualPotential(input: {
  kind: AtlasKind; title?: string; excerpt?: string; body?: string; resonanceCount?: number
}): { potential: number; reasons: string[]; material: number; idea: number; board: AtlasBoardState; materialReasons: string[]; ideaReasons: string[] } {
  const m = materialReadiness(input)
  const i = ideaStrength(input)
  return {
    potential: Math.round(clamp(m.material * 0.35 + i.idea * 0.65)),
    reasons: [...m.reasons, ...i.reasons],
    material: m.material, idea: i.idea,
    board: boardStateOf(m.material, i.idea, m.words),
    materialReasons: m.reasons, ideaReasons: i.reasons,
  }
}

/** يقترح عائلة عالمٍ من موضوع المادة (حتمي بالكلمات لا بالذكاء). */
export function familyHintFor(input: { title?: string; cat?: string; keywords?: string }): AtlasFamilyHint {
  const text = `${input.cat || ''} ${input.title || ''} ${input.keywords || ''}`
  const has = (re: RegExp) => re.test(text)
  if (has(/كويت|خليج|ديوانية|سدو/)) return 'kuwait-gulf'
  if (has(/تقنية|تكنولوجيا|ذكاء|بيانات|رقمي|خوارزم/)) return 'technology-data'
  if (has(/طفل|طفولة|مدرسة|صف|روضة|تعليم مبكر/)) return 'education-childhood'
  if (has(/بحث|دراسة|علمي|منهج|أكاديمي|نظرية|برهان|دليل/)) return 'academic-knowledge'
  if (has(/إعلام|مجتمع|رأي عام|جمهور|منصّة|تواصل/)) return 'media-society'
  if (has(/إنسان|عاطفة|حب|ألم|فقد|أمل|وحدة|قلق/)) return 'human-emotional'
  if (has(/بيئة|طبيعة|مناخ|أرض|ماء|صحراء/)) return 'material-environment'
  if (has(/تفكير|عقل|فلسفة|معرفة|سؤال|حيرة/)) return 'typographic'
  if (has(/تربية|قيم|أخلاق|هوية/)) return 'editorial'
  return 'editorial'
}

function seedFrom(kind: AtlasKind, article: AtlasSeed['article']): AtlasSeed {
  return { type: 'article_video', source: `atlas:${kind}`, title: article.title, article }
}

export function entryFromArticle(a: Pick<ArticleRecord, 'slug' | 'title' | 'excerpt' | 'body' | 'cat' | 'year'> & { resonanceCount?: number }): AtlasEntry {
  const scored = visualPotential({ kind: 'article', title: a.title, excerpt: a.excerpt, body: a.body, resonanceCount: a.resonanceCount })
  const body = a.body || a.excerpt || ''
  return {
    kind: 'article', slug: a.slug, title: a.title, subtitle: `${a.cat || 'مقال'}`.trim(), year: a.year || '',
    ...scored, familyHint: familyHintFor({ title: a.title, cat: a.cat }),
    estimate: estimateFor({ body, excerpt: a.excerpt }),
    seed: seedFrom('article', { slug: a.slug, title: a.title, excerpt: a.excerpt || '', body, cat: a.cat || 'التعليم' }),
  }
}

export function entryFromPaper(p: Pick<PaperRecord, 'slug' | 'title' | 'titleAr' | 'abstractAr' | 'keyFinding' | 'researchQuestion' | 'contribution' | 'methodology' | 'keywords' | 'journal' | 'year'>): AtlasEntry {
  const title = p.titleAr || p.title
  // متن البحث للوحة: السؤال ثم أهم نتيجة ثم الإسهام ثم الملخّص — بلا PDF.
  const body = [p.researchQuestion, p.keyFinding, p.contribution, p.abstractAr, p.methodology].filter(Boolean).join(' ')
  const excerpt = clip(p.keyFinding || p.abstractAr || p.contribution || '', 30)
  const scored = visualPotential({ kind: 'paper', title, excerpt, body })
  return {
    kind: 'paper', slug: p.slug, title, subtitle: p.journal || 'بحث محكّم', year: p.year || '',
    ...scored, familyHint: familyHintFor({ title, cat: 'بحث علمي', keywords: p.keywords }),
    estimate: estimateFor({ body, excerpt }),
    seed: seedFrom('paper', { slug: p.slug, title, excerpt, body, cat: 'بحث' }),
  }
}

export function entryFromBook(b: Pick<BookRecord, 'slug' | 'title' | 'desc' | 'longDescription' | 'whyWritten' | 'toc' | 'targetAudience' | 'year'>): AtlasEntry {
  // متن الكتاب للوحة: لماذا كُتب ثم الوصف الطويل ثم الفهرس — لا ملف الـPDF.
  const body = [b.whyWritten, b.longDescription, b.desc, b.toc].filter(Boolean).join(' ')
  const excerpt = clip(b.desc || b.longDescription || '', 30)
  const scored = visualPotential({ kind: 'book', title: b.title, excerpt, body })
  return {
    kind: 'book', slug: b.slug, title: b.title, subtitle: b.targetAudience ? `لـ${clip(b.targetAudience, 6)}` : 'كتاب', year: b.year || '',
    ...scored, familyHint: familyHintFor({ title: b.title, cat: 'كتاب' }),
    estimate: estimateFor({ body, excerpt }),
    seed: seedFrom('book', { slug: b.slug, title: b.title, excerpt, body, cat: 'كتاب' }),
  }
}

export type BuildAtlasInput = {
  articles?: Array<Parameters<typeof entryFromArticle>[0]>
  papers?: Array<Parameters<typeof entryFromPaper>[0]>
  books?: Array<Parameters<typeof entryFromBook>[0]>
}

/** يبني الأطلس مرتّباً تنازلياً حسب الإمكانية البصرية (كسر التعادل بالبصمة، فحتمي). */
export function buildAtlas(input: BuildAtlasInput): AtlasEntry[] {
  const entries: AtlasEntry[] = [
    ...(input.articles || []).map(entryFromArticle),
    ...(input.papers || []).map(entryFromPaper),
    ...(input.books || []).map(entryFromBook),
  ]
  return entries.sort((a, b) => b.potential - a.potential || (stableHash(b.slug) - stableHash(a.slug)))
}

export const ATLAS_KIND_LABEL = KIND_LABEL
