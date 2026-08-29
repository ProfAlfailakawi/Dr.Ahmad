/**
 * أطلس القصص البصرية — منطق نقيّ قابل للاختبار.
 *
 * لا يولّد شيئاً جديداً ولا يكرّر «المخرج الحي»: يقرأ الأرشيف الموجود، يرتّب كل
 * عملٍ حسب إمكانيته البصرية بحسابٍ حتميٍّ شفاف (بلا نموذج لغوي وبلا استدعاء
 * خارجي)، ويقترح له عائلة عالمٍ من عوالم الاستوديو، ثم يجهّز «بذرة» جاهزة تُفتح
 * في `live-director` عبر نفس المصافحة القائمة (studio:live-director-seed).
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

export type AtlasEntry = {
  kind: AtlasKind
  slug: string
  title: string
  subtitle: string
  year: string
  /** 0..100 — إمكانية بصرية حتمية. */
  potential: number
  /** أسبابٌ بشرية تشرح الدرجة، تُعرض في اللوحة. */
  reasons: string[]
  familyHint: AtlasFamilyHint
  estimate: AtlasEstimate
  seed: AtlasSeed
}

const KIND_LABEL: Record<AtlasKind, string> = { article: 'مقال', paper: 'بحث', book: 'كتاب' }
const KIND_BASE: Record<AtlasKind, number> = { article: 60, paper: 55, book: 52 }

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

const NARRATIVE = /قصة|حكاية|تجربة|مقارنة|في المقابل|من جهة|مثال|موقف|ذات مرة|حدث/
const PROVOKE = /[؟?]|لماذا|كيف|هل |ماذا لو|حين /
const IMAGERY = /باب|ضوء|جسر|مرآة|طريق|بحر|نافذة|ظل|جدار|شجرة|نهر|بوصلة|خريطة|مصباح|عتبة|أفق|سماء|جذر|صدى/

/** تقدير المدة/اللقطات بمرآةٍ خفيفة لمنطق المخرج الحي (بلا استيراده). */
export function estimateFor(input: { body?: string; excerpt?: string }): AtlasEstimate {
  const text = input.body || input.excerpt || ''
  const count = wordCount(text)
  const complex = NARRATIVE.test(text) || /دراسة|نتيجة|مقارنة|أولاً|ثانياً/.test(text)
  if (count <= 260 && !complex) return { seconds: 24, shots: 3, layers: 3 }
  if (count >= 600 && complex) return { seconds: 64, shots: 8, layers: 5 }
  return { seconds: 48, shots: 6, layers: 4 }
}

/** الحساب الحتمي للإمكانية البصرية — شفاف ومبرّر. */
export function visualPotential(input: {
  kind: AtlasKind; title?: string; excerpt?: string; body?: string; resonanceCount?: number
}): { potential: number; reasons: string[] } {
  const text = `${input.title || ''} ${input.excerpt || ''} ${input.body || ''}`
  const bodyCount = wordCount(input.body || input.excerpt || '')
  const reasons: string[] = []
  let score = KIND_BASE[input.kind]

  if (bodyCount >= 350) { score += 14; reasons.push('متنٌ كافٍ لستّ لقطات دون حشو') }
  else if (bodyCount >= 200) { score += 9; reasons.push('متنٌ متوسط يكفي لقصةٍ مركّزة') }
  else if (bodyCount >= 60) { score += 4; reasons.push('متنٌ قصير يناسب إعلاناً مركّزاً') }
  else { score -= 6; reasons.push('المادة نحيلة؛ تحتاج فكرةً أوضح قبل اللوحة') }

  if (NARRATIVE.test(text)) { score += 8; reasons.push('قصّة أو مقارنة تُغني تعدّد اللقطات') }
  if (PROVOKE.test(text)) { score += 6; reasons.push('سؤالٌ مثيرٌ يصلح خطّافاً قوياً') }
  if (IMAGERY.test(text)) { score += 6; reasons.push('صورٌ حسّية تُترجَم بصرياً بسهولة') }
  if ((input.excerpt || '').trim()) { score += 4; reasons.push('مقتطفٌ جاهز يختصر الفكرة') }

  const resonance = Math.max(0, input.resonanceCount || 0)
  if (resonance > 0) { const bump = Math.min(10, resonance * 2); score += bump; reasons.push(`ظلّله ${resonance} من القرّاء — أقوى إشارة`) }

  return { potential: Math.round(clamp(score)), reasons }
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
  const { potential, reasons } = visualPotential({ kind: 'article', title: a.title, excerpt: a.excerpt, body: a.body, resonanceCount: a.resonanceCount })
  const body = a.body || a.excerpt || ''
  return {
    kind: 'article', slug: a.slug, title: a.title, subtitle: `${a.cat || 'مقال'}`.trim(), year: a.year || '',
    potential, reasons, familyHint: familyHintFor({ title: a.title, cat: a.cat }),
    estimate: estimateFor({ body, excerpt: a.excerpt }),
    seed: seedFrom('article', { slug: a.slug, title: a.title, excerpt: a.excerpt || '', body, cat: a.cat || 'التعليم' }),
  }
}

export function entryFromPaper(p: Pick<PaperRecord, 'slug' | 'title' | 'titleAr' | 'abstractAr' | 'keyFinding' | 'researchQuestion' | 'contribution' | 'methodology' | 'keywords' | 'journal' | 'year'>): AtlasEntry {
  const title = p.titleAr || p.title
  // متن البحث للوحة: السؤال ثم أهم نتيجة ثم الإسهام ثم الملخّص — بلا PDF.
  const body = [p.researchQuestion, p.keyFinding, p.contribution, p.abstractAr, p.methodology].filter(Boolean).join(' ')
  const excerpt = clip(p.keyFinding || p.abstractAr || p.contribution || '', 30)
  const { potential, reasons } = visualPotential({ kind: 'paper', title, excerpt, body })
  return {
    kind: 'paper', slug: p.slug, title, subtitle: p.journal || 'بحث محكّم', year: p.year || '',
    potential, reasons, familyHint: familyHintFor({ title, cat: 'بحث علمي', keywords: p.keywords }),
    estimate: estimateFor({ body, excerpt }),
    seed: seedFrom('paper', { slug: p.slug, title, excerpt, body, cat: 'بحث' }),
  }
}

export function entryFromBook(b: Pick<BookRecord, 'slug' | 'title' | 'desc' | 'longDescription' | 'whyWritten' | 'toc' | 'targetAudience' | 'year'>): AtlasEntry {
  // متن الكتاب للوحة: لماذا كُتب ثم الوصف الطويل ثم الفهرس — لا ملف الـPDF.
  const body = [b.whyWritten, b.longDescription, b.desc, b.toc].filter(Boolean).join(' ')
  const excerpt = clip(b.desc || b.longDescription || '', 30)
  const { potential, reasons } = visualPotential({ kind: 'book', title: b.title, excerpt, body })
  return {
    kind: 'book', slug: b.slug, title: b.title, subtitle: b.targetAudience ? `لـ${clip(b.targetAudience, 6)}` : 'كتاب', year: b.year || '',
    potential, reasons, familyHint: familyHintFor({ title: b.title, cat: 'كتاب' }),
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
