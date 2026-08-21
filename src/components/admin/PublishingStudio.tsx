import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pagination, usePagedList } from '../Pagination'
import { articleCats, books, papers } from '../../data'
/* خريطة المواد المنطوقة (قراءات فهد ونورة والحوارات): تدخل وعي المحفظة
   الفكرية فيعرف المجلس أن صوت الدكتور حاضر أصلاً في إقليم الفكرة. */
import audioCatalog from '../../data/audio.json'
import privateBookLinks from '../../data/private-book-links.json'
import bookTocLinks from '../../data/book-toc-links.json'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { useAdminAuth } from '../../lib/admin-auth'
import { fetchPublishedExtras, getDb } from '../../lib/firebase'
import { beginAdminTask, setAdminTaskState } from '../../lib/admin-task-state'
import { beginAdminToolTask, trackAdminUsage, trackRecommendation } from '../../lib/admin-usage'
import { PublishingStudioNavigation, type PublishingStudioView } from './PublishingStudioNavigation'
import { EditorialMemoryPanel } from './EditorialMemoryPanel'
import { EditorialForesightPanel } from './EditorialForesightPanel'
import { LiveDirector } from './LiveDirector'
import { articleSimilarityReport, editorialStyleProfile, ideaLab, relatedForIdea, representativeStyleSamples, strongestQuote, suggestStrongTitle } from '../../lib/intelligence'
/* بصمة الأسلوب: المسطرة نفسها التي يقيس بها الخادم — الملف .mjs عمداً كي
   يستورده server.mjs بلا ترجمة، فلا يمدح أحدهما ما يرفضه الآخر. */
import { buildOrthographyIndex, extractVoiceSignature, judgeStyle, locateIssues, measureStyleDna, refineToStyle, withVoiceMemory, type StyleVerdict } from '../../lib/style-dna.mjs'
import { createIdeaDna } from '../../lib/idea-dna'
import { buildKnowledgeGraph, graphSearch } from '../../lib/knowledge-graph'
import { buildEditorialBoardDecision, editorialScoreLabel, type EditorialArchiveMaterial, type EditorialAudienceEvidence, type EditorialBoardDecision, type EditorialCalibrationProfile, type EditorialPortfolioEvidence, type EditorialSourceType } from '../../lib/editorial-board'
import { buildAgendaAlignment, buildEvidenceChain, buildMeaningFingerprint, matchPersonalSources, reviewMeaningDrift, type IntellectualAgendaItem, type PersonalSourceRecord } from '../../lib/editorial-memory'
import { buildSocialVisuals, compositionNameOf, analyzeSocialCopy,
  detectVisualTopic, downloadSocialPng, renderSocialPng, visualTopicLabel, type SocialVisualTemplate, type VisualTopic } from '../../lib/social-templates'
import {
  designSimilarity,
  generateSocialDesigns,
  parseStudioCommand,
  professionalReleaseGate,
  type CompositionPlan,
} from '../../lib/social-design-engine'
import { downloadCompositionRaster, renderCompositionSvg } from '../../lib/social-design-renderer'
import { LivingMetaphorIcon, LivingIconToggle, LivingIconPicker, useLivingIconEnabled } from './LivingMetaphorIcon'
import { MovableWordsLayer, MoveWordsToggle } from './MovableWords'
import { downloadDesignVideo, designVideoSupported, designHasMotion } from '../../lib/design-video'
import { dressPlanInWorld, planWorldId, type DesignWorld } from '../../lib/design-worlds'
import DesignWorldsGallery from './DesignWorldsGallery'
import {
  buildOpportunityRadar,
  buildPublicationPassportDraft,
  buildTransformingCampaign,
  type OpportunityRadarItem,
  type PublicationPassportDraft,
  type TransformingCampaign,
} from '../../lib/sovereign-publishing.mjs'
import { requestPublicationPassportSignature } from '../../lib/publication-passport-client'
import { requestContentPublicationSync } from '../../lib/content-publication-sync'
import { audioProofAssets } from '../../lib/audio-proof'
import { buildMultimodalMeaningCourt, type MultimodalMeaningCourt } from '../../lib/semantic-court.mjs'
import { buildImpactMirror, type EditorialImpactMirror, type ImpactObservationSource } from '../../lib/impact-mirror.mjs'
import { arabicCountPhrase, ARTICLE_AFTER_PREPOSITION_FORMS, ARTICLE_PLAIN_FORMS, AUDIO_NEAR_MATERIAL_FORMS, BOOK_PLAIN_FORMS, CALIBRATION_RESULT_FORMS, CLAIM_FORMS, DIRECTION_FORMS, EVIDENCE_FORMS, EVENT_FORMS, LAST_SAVED_DECISION_FORMS, LINK_FORMS, OPPORTUNITY_FORMS, PAPER_PLAIN_FORMS, PARAGRAPH_FORMS, PENDING_ITEM_FORMS, PUBLISHED_ARTICLE_AFTER_PREPOSITION_FORMS, SAVED_DECISION_FORMS, STUBBORN_WIN_FORMS, WORD_PLAIN_FORMS } from '../../lib/arabic-count.ts'

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-6 py-2.5 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const ghost = 'rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'
const MIN_ARTICLE_WORDS = 350
const MAX_GENERATION_WORDS = 4000

type SocialKey = 'x' | 'linkedin' | 'facebook' | 'instagram' | 'threads' | 'whatsapp' | 'newsletter'

type Bundle = {
  title: string
  slug: string
  cat: string
  excerpt: string
  body: string
  social: Record<SocialKey, string>
  related: { slug: string; title: string; iso?: string }[]
  books: { slug: string; title: string }[]
  papers: { slug: string; title: string }[]
  quality: string[]
  exactTarget?: number
  originality?: number
  originalityBypassed?: boolean
  similarity?: { slug: string; title: string; score: number }[]
  event?: CurrentEvent | null
  eventConnection?: string
  generatedBy?: 'archive-ai' | 'local-fallback'
  socialPack?: PerfectSocialPack | null
}


type CurrentEvent = {
  id: string
  title: string
  summary?: string
  source: string
  url: string
  publishedAt?: string
  ageHours?: number | null
  relevance?: number
}

type EditorialProgress = 'idle' | 'archive' | 'graph' | 'current' | 'portfolio' | 'decision' | 'done'
type EditorialPerformanceMeasure = {
  windowDays?: number
  views?: number
  siteAverage?: number
  vsSiteAveragePct?: number | null
  performanceScore?: number | null
  measuredAt?: string
}
type EditorialCalibrationRecord = {
  status?: string
  predictedStrength?: number | null
  predictedArticlePotential?: number | null
  actual7?: EditorialPerformanceMeasure | null
  actual30?: EditorialPerformanceMeasure | null
}

const IMPACT_SOURCE_LABELS: Array<{ value: ImpactObservationSource; label: string }> = [
  { value: 'comment', label: 'تعليق عام' },
  { value: 'conversation', label: 'حوار مباشر' },
  { value: 'message', label: 'رسالة' },
  { value: 'field', label: 'ملاحظة ميدانية' },
  { value: 'other', label: 'شاهد آخر' },
]

const EDITORIAL_SOURCE_LABELS: Array<{ value: EditorialSourceType; label: string }> = [
  { value: 'friend', label: 'صديق' },
  { value: 'colleague', label: 'زميل' },
  { value: 'reader', label: 'قارئ' },
  { value: 'student', label: 'طالب' },
  { value: 'meeting', label: 'اجتماع' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'encounter', label: 'لقاء' },
  { value: 'other', label: 'أخرى' },
]

const EDITORIAL_PROGRESS_LABELS: Record<EditorialProgress, string> = {
  idle: '',
  archive: 'يفحص الأرشيف والمحتوى الكامل…',
  graph: 'يربط الفكرة بخريطة المعرفة وIdea DNA…',
  current: 'يفحص اللحظة الحالية من المصادر الموثوقة…',
  portfolio: 'يفحص توازن أرشيفك وما يحتاجه مشروعك الفكري…',
  decision: 'يبني الحكم ويشغّل محامي الشيطان…',
  done: 'اكتمل القرار.',
}

function personalAudienceEvidence(): EditorialAudienceEvidence {
  return {
    available: false,
    score: null,
    messageMatches: [],
    readingMatches: [],
    explanation: 'الوضع الشخصي لا يستخدم ردود الجمهور أو الرسائل في القرار.',
  }
}

function buildEditorialPortfolioEvidence(idea: string, articles: ArticleRecord[], voicedArticles: ArticleRecord[] = []): EditorialPortfolioEvidence {
  const totalArticles = articles.length
  if (!totalArticles) {
    return {
      available: false,
      totalArticles: 0,
      focusCategory: '',
      focusCategoryCount: 0,
      focusCategoryShare: null,
      relatedArticleCount: 0,
      relatedBookCount: 0,
      relatedPaperCount: 0,
      saturationScore: null,
      strategicNeedScore: null,
      dominantCategories: [],
      explanation: 'لا توجد مقالات كافية لبناء وعي المحفظة الفكرية.',
    }
  }
  const categoryCounts = new Map<string, number>()
  for (const article of articles) {
    const category = article.cat || 'غير مصنّف'
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1)
  }
  const focusCategory = chooseCat(idea)
  const focusCategoryCount = categoryCounts.get(focusCategory) || 0
  const focusCategoryShare = Math.round((focusCategoryCount / totalArticles) * 100)
  const similarityRows = articleSimilarityReport(idea, '', articles, Math.max(1, totalArticles)).matches
  const meaningful = similarityRows.filter((item) => item.score >= .18)
  const relatedArticleCount = meaningful.length
  const relatedBookCount = relatedForIdea(idea, books, (book) => book.desc || '', Math.max(1, books.length)).length
  const relatedPaperCount = relatedForIdea(idea, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, Math.max(1, papers.length)).length
  /* فكرة المجلس (٤): الأرشيف الصوتي جزء من المحفظة — مادة قريبة لها قراءة
     أو حوار منطوق تعني أن صوته يغطي الإقليم فعلاً، فيرتفع التشبع قليلاً. */
  const relatedAudioCount = voicedArticles.length
    ? relatedForIdea(idea, voicedArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, Math.max(1, Math.min(voicedArticles.length, 30))).length
    : 0
  const highestSimilarity = Math.round((similarityRows[0]?.score || 0) * 100)
  const relatedDensity = Math.min(100, Math.round((relatedArticleCount / Math.max(1, Math.min(totalArticles, 20))) * 100))
  const audioSaturationBoost = Math.min(6, relatedAudioCount * 2)
  const saturationScore = Math.max(0, Math.min(100, Math.round((focusCategoryShare * .35) + (relatedDensity * .35) + (highestSimilarity * .30)) + audioSaturationBoost))
  const strategicNeedScore = Math.max(0, Math.min(100, 100 - saturationScore))
  const dominantCategories = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ar'))
    .slice(0, 4)
    .map(([category, count]) => ({ category, count, share: Math.round((count / totalArticles) * 100) }))
  const explanation = saturationScore >= 68
    ? `محور «${focusCategory}» مشبع نسبياً داخل الأرشيف (${focusCategoryCount} من ${arabicCountPhrase(totalArticles, ARTICLE_AFTER_PREPOSITION_FORMS)})، لذلك لا تكفي جودة الفكرة وحدها؛ يجب أن تضيف زاوية جديدة بوضوح.`
    : saturationScore <= 34
      ? `محور «${focusCategory}» أقل حضوراً داخل الأرشيف؛ إذا كانت الفكرة ملائمة لهويتك فهي تسد فراغاً في المحفظة بدلاً من زيادة محور مكتمل.`
      : `محور «${focusCategory}» متوازن داخل الأرشيف؛ القرار يعتمد على الجِدة والتوقيت أكثر من الحاجة العددية للمحور.`
  return {
    available: true,
    totalArticles,
    focusCategory,
    focusCategoryCount,
    focusCategoryShare,
    relatedArticleCount,
    relatedBookCount,
    relatedPaperCount,
    relatedAudioCount,
    saturationScore,
    strategicNeedScore,
    dominantCategories,
    explanation: relatedAudioCount > 0
      ? `${explanation} وصوتك حاضر في هذا الإقليم فعلاً: ${arabicCountPhrase(relatedAudioCount, AUDIO_NEAR_MATERIAL_FORMS)}.`
      : explanation,
  }
}

function archiveMaterialFromArticle(article: ArticleRecord, score: number): EditorialArchiveMaterial {
  return { kind: 'article', slug: article.slug, title: article.title, url: `/articles/${article.slug}`, score, date: article.date || article.iso || '', excerpt: article.excerpt || '' }
}

function editorialCalibrationProfileFromRows(rows: Array<Record<string, any>>, publishedArticles: ArticleRecord[] = []): EditorialCalibrationProfile {
  const strengthErrors: number[] = []
  const potentialErrors: number[] = []
  for (const row of rows) {
    const decision = row.decision as EditorialBoardDecision | undefined
    const calibration = row.calibration as Record<string, any> | undefined
    const actual = calibration?.actual30 || calibration?.actual7
    const performance = Number(actual?.performanceScore)
    if (!decision || !Number.isFinite(performance)) continue
    if (decision.scores.strength != null) strengthErrors.push(performance - decision.scores.strength)
    if (decision.scores.articlePotential != null) potentialErrors.push(performance - decision.scores.articlePotential)
  }
  /* فكرة المجلس (٣) — معايرة العناد: فكرة رفضها المجلس أو أجّلها ثم كتبها
     الدكتور رغم ذلك ونُشرت فعلاً = دليل أن المجلس بخس أفكاراً من هذا الطراز.
     تُحتسب إشارة تصحيح محدودة (+٢ لكل انتصار عنيد بسقف +٤) داخل سقف ±٨
     القائم — بلا ادعاء تعلم آلي، والعينة تُعرض بعددها الصريح. */
  let stubbornWins = 0
  for (const row of rows) {
    const decision = row.decision as EditorialBoardDecision | undefined
    if (!decision || !['reject', 'wait'].includes(decision.verdict)) continue
    const decidedAt = Date.parse(decision.generatedAt || '') || 0
    if (!decidedAt) continue
    const laterMatch = articleSimilarityReport(decision.idea, '', publishedArticles, 3).matches
      .some((match) => {
        if (match.score < .5) return false
        const article = publishedArticles.find((item) => item.slug === match.slug)
        const publishedAt = Date.parse(article?.iso || article?.date || '') || 0
        return publishedAt > decidedAt
      })
    if (laterMatch) stubbornWins += 1
  }
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
  const cap = (value: number) => Math.max(-8, Math.min(8, value))
  const stubbornLift = Math.min(4, stubbornWins * 2)
  return {
    sampleSize: Math.max(strengthErrors.length, potentialErrors.length),
    strengthBias: cap(average(strengthErrors) + stubbornLift),
    articlePotentialBias: cap(average(potentialErrors) + stubbornLift),
    stubbornWins,
  }
}

type PerfectSocialPack = {
  x: string[]
  linkedin: string[]
  /* فيسبوك: منصةٌ ينشر فيها الدكتور فعلاً وكانت غائبة عن الحزمة كلها بينما
     حضر ما لا ينشر فيه. نبرتها بين رسمية لينكدإن وعفوية X: فقرة تروي لا تبرق. */
  facebook: string[]
  threads: string[]
  instagramCaptions: string[]
  carouselSlides: { kicker: string; title: string; body: string }[]
  stories: string[]
  reelScript: string
  whatsapp: string
  newsletter: string
  hashtags: string[]
  event?: CurrentEvent | null
  eventHook?: string
  visualDirections: { layout: string; tone: string; headline: string; subline: string }[]
  qualityScore?: number
  qualityChecks?: string[]
  creativeDirectives?: Record<string, string>
  generatedAt?: string
  visualSeed?: string
}

type PerfectArticleResponse = {
  title: string
  cat: string
  excerpt: string
  body: string
  angle: string
  event?: CurrentEvent | null
  eventConnection?: string
  originalityNote?: string
  exactWords: number
  originality: number
  similarity: { slug: string; title: string; score: number }[]
  modelValidated: boolean
  alternates?: {
    title: string
    excerpt: string
    body: string
    cat: string
    words: number
    score: number
    structure: string
    model: string
    originality: number
  }[]
  style?: {
    score: number
    ready: boolean
    structure: string
    model?: string
    proofread?: string
    lines: string[]
    checks: { key: string; label: string; grade: number; actual: string; wanted: string }[]
    fatal: string[]
    metrics: { ellipsis: number; antithesis: number; questions: number; medianSentence: number; shortRate: number; paragraphs: number }
  }
}

type RadarItem = { id: string; ar?: string; arNote?: string; en?: string; source?: string; url?: string }
type PrivateBookLink = {
  title: string
  pages?: number
  topTerms?: string[]
  sections?: { label?: string; page?: number; pages?: string; keywords?: string[]; note?: string }[]
  linkedPublicBook?: { slug: string; title: string; confidence?: number } | null
  relatedPublicArticles?: { slug: string; title: string; confidence?: number }[]
}
type WeeklyPack = {
  linkedin: string[]
  x: string[]
  generalX: string[]
  instagram: string
  question: string
  quote: string
  radarComment: string
}

const normalize = (value = '') => value
  .toLowerCase()
  .replace(/[ًٌٍَُِّْـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  .trim()

const wordCount = (value = '') => value.trim().split(/\s+/).filter(Boolean).length
const fromArabicDigits = (value: string) => value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

/* لم يعد يُستدعى على مخرَج المحرك — إيقاع الفقرات صار من بصمته عبر
   refineToStyle. باقٍ لأن مسارات قديمة قد تناديه على نصٍّ بلا فواصل. */
function humanParagraphs(value: string, target: number) {
  const words = value.replace(/[ \t]+/g, ' ').replace(/\n+/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const paragraphCount = Math.max(6, Math.min(24, Math.round(Math.max(MIN_ARTICLE_WORDS, target) / 70)))
  const chunks: string[] = []
  let start = 0
  for (let index = 0; index < paragraphCount; index += 1) {
    const remainingParagraphs = paragraphCount - index
    const remainingWords = words.length - start
    if (remainingParagraphs === 1) { chunks.push(words.slice(start).join(' ')); break }
    const ideal = start + Math.round(remainingWords / remainingParagraphs)
    const minimum = Math.max(start + 28, ideal - 12)
    const maximum = Math.min(words.length - (remainingParagraphs - 1) * 28, ideal + 12)
    let end = ideal
    for (let cursor = minimum; cursor <= maximum; cursor += 1) {
      if (/[.!؟…][”"']?$/.test(words[cursor - 1] || '')) { end = cursor; break }
    }
    end = Math.max(start + 1, Math.min(words.length, end))
    chunks.push(words.slice(start, end).join(' '))
    start = end
  }
  return chunks.filter(Boolean).join('\n\n')
}

/* ⚠️ حُذف من هنا مصدرا «ليس أسلوبي» — لا يُعادان:

   ١) fitExactWords: كان يحشو أي مقالٍ أقصر من الهدف بثماني جملٍ مُعلَّبة
      محفوظة في الكود («والفكرةُ هنا ليست في مقاومةِ الجديد…»)، وكان يعمل على
      مخرَج النموذج الناجح أيضاً — فكل مقالٍ يخرج من الاستوديو كان يُختم
      بجملٍ لم يكتبها أحد.

   ٢) buildExactLocalArticle: قالبٌ يملأ الفراغات، يفتتح فقرته الثالثة بإحالةٍ
      إلى «عنوان مقالك» — أي أنه ينقل عناوينه حرفياً داخل المقال الجديد.
      قياسه بحَكَم الأسلوب: ٤٥٪ مقابل ٨٧٪ لمقالاته، مع رصدِ نقلٍ حرفي.

   البديل: النقص يُعالَج بطلبِ توسيعٍ حقيقي من المحرك، والعجزُ يُقال صراحةً. */

async function adminAiRequest<T>(path: string, body: unknown, token: string): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  let payload: any = null
  try { payload = await response.json() } catch { /* يعالج الخطأ أدناه */ }
  if (!response.ok) throw new Error(payload?.error || payload?.message || `تعذّر الاتصال بالخدمة (${response.status}).`)
  return payload as T
}

function today() {
  const date = new Date()
  return {
    iso: date.toISOString().slice(0, 10),
    ar: new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(date),
  }
}

function makeSlug(title: string) {
  const dictionary: Record<string, string> = {
    الذكاء: 'ai',
    اصطناعي: 'ai',
    التعليم: 'education',
    المعلم: 'teacher',
    الطالب: 'student',
    الطفل: 'child',
    الأسرة: 'family',
    الاسرة: 'family',
    الخوف: 'fear',
    الامتحان: 'exam',
    الاختبار: 'exam',
    الهوية: 'identity',
    التقنية: 'technology',
    التكنولوجيا: 'technology',
    الإنسان: 'human',
    الانسان: 'human',
    المستقبل: 'future',
  }
  const tokens = normalize(title)
    .split(/\s+/)
    .map((token) => dictionary[token] || dictionary[token.replace(/^ال/, '')])
    .filter(Boolean)
  const base = tokens.length ? tokens.slice(0, 5).join('-') : 'thought-article'
  return `${base}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
}


function distinctEditorialTitle(candidate: string, requestedIdea: string, previousTitle: string, articles: ArticleRecord[], variation: number) {
  const cleanCandidate = candidate.trim().replace(/\s+/g, ' ')
  const forbidden = new Set([previousTitle, ...articles.map((article) => article.title)].map(normalize).filter(Boolean))
  if (cleanCandidate.length >= 12 && !forbidden.has(normalize(cleanCandidate))) return cleanCandidate

  const core = requestedIdea
    .replace(/[.!؟?،,:؛]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 9)
    .join(' ')
    .slice(0, 92) || 'الفكرة الجديدة'
  const alternatives = [
    `حين تصبح «${core}» سؤالاً تربوياً`,
    `ما الذي لا تقوله لنا «${core}»؟`,
    `بين بريق «${core}» وأثره في الإنسان`,
    `قبل أن نحتفل بـ«${core}»`,
    `«${core}»… من يدفع ثمن الاختصار؟`,
    `كيف نعيد الإنسان إلى قلب «${core}»؟`,
  ]
  for (let offset = 0; offset < alternatives.length; offset += 1) {
    const title = alternatives[(variation + offset) % alternatives.length]
    if (!forbidden.has(normalize(title))) return title
  }
  return `${alternatives[variation % alternatives.length]} — قراءة ${variation + 1}`
}

function uniqueArticleSlug(title: string, articles: ArticleRecord[]) {
  const base = makeSlug(title)
  const used = new Set(articles.map((article) => article.slug))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function chooseCat(idea: string) {
  const text = normalize(idea)
  if (/ذكاء|تقني|تكنولوجيا|رقمي|شاشه|شاشة/.test(text)) return 'تكنولوجيا'
  if (/هويه|لغه|ثقافه|قيم/.test(text)) return 'هوية'
  if (/اعلام|منصه|سوشال|ميديا/.test(text)) return 'إعلام'
  if (/بحث|دراسه|جامعه|اكاديمي/.test(text)) return 'بحث'
  if (/اسره|طفل|ابناء|بيت/.test(text)) return 'مجتمع'
  if (/تعليم|معلم|طالب|امتحان|اختبار|مدرسه/.test(text)) return 'التعليم'
  return articleCats.includes('التربية') ? 'التربية' : 'التعليم'
}

function clampExcerpt(text: string) {
  return Array.from(text.replace(/\s+/g, ' ').trim()).slice(0, 195).join('')
}

/* ⚠️ حُذف «buildArticleDraft» — قالبُ الفراغات الذي كان يفتتح الاستوديو.

   كان يُستدعى مرتين: مرةً ليملأ محرّر المقال لحظةَ فتح الاستوديو (فيرى
   الدكتور نصّاً ليس نصّه قبل أن يضغط شيئاً)، ومرةً داخل السقوط المحلي. وكان
   يكتب إحالةً إلى مقالٍ سابقٍ بعنوانه، ويقول «لهذا أرى أنّ…» — وكلاهما صوتٌ
   لا يظهر في أرشيفه: «أرى أنّ» وردت مرتين في ٥٣ ألف كلمة.

   المحرّر يفتح الآن فارغاً؛ الفراغ أصدق من نصٍّ منتحل. */

function buildSocial(bundle: Pick<Bundle, 'title' | 'excerpt' | 'body'>, audience: string) {
  const quote = bundle.body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .find((sentence) => sentence.length > 65 && sentence.length < 165)
    || bundle.excerpt
  return {
    x: `${quote}\n\n${bundle.title}`,
    linkedin: `${bundle.title}\n\n${bundle.excerpt}\n\nالسؤال الذي يستحق النقاش: كيف نحافظ على الإنسان في قلب التطوير؟`,
    /* فيسبوك يقرأ بعين المتصفّح لا القارئ: فقرة تفتح بمشهد، ثم الفكرة، ثم
       سؤال يفتح تعليقاً. أطول من X، وأدفأ من لينكدإن. */
    facebook: `${bundle.title}\n\n${quote}\n\n${bundle.excerpt}\n\nما رأيك أنت؟ أقرأ تعليقاتكم وأتعلّم منها.`,
    instagram: `${bundle.title}\n\n${quote}\n\n#التعليم #الذكاء_الاصطناعي #د_أحمد_الفيلكاوي`,
    threads: `${bundle.excerpt}\n\nأحياناً لا نحتاج إجابة أسرع، بل سؤالاً أعدل.`,
    whatsapp: `مقال جديد: ${bundle.title}\n${bundle.excerpt}`,
    newsletter: `اقتراح للنشرة: ${bundle.title}\n\nلماذا يهم هذا الموضوع ${audience}؟\n${bundle.excerpt}`,
  }
}

function topicLanguage(topic: VisualTopic) {
  const profiles: Record<VisualTopic, {
    insight: string
    tension: string
    standard: string
    question: string
    hashtags: string[]
    directions: { layout: string; tone: string; headline: string; subline: string }[]
  }> = {
    ai: {
      insight: 'القيمة ليست في ذكاء الأداة وحده، بل في نوع التفكير الذي تتركه للإنسان.',
      tension: 'كلما أصبحت الإجابة أسرع، ازدادت حاجتنا إلى سؤال يختبر الفهم لا الانبهار.',
      standard: 'تكنولوجيا جيدة تعيد للإنسان قدرته على القرار، ولا تستبدلها عنه.',
      question: 'هل توسّع الأداة تفكيرنا… أم تختصره قبل أن يبدأ؟',
      hashtags: ['#الذكاء_الاصطناعي', '#تكنولوجيا_التعليم', '#الإنسان'],
      directions: [
        { layout: 'circuit', tone: 'الإنسان داخل التكنولوجيا', headline: 'الأداة ذكية… فهل التجربة إنسانية؟', subline: 'اقرأ أثر التكنولوجيا في التفكير والعلاقة والقرار.' },
        { layout: 'signal', tone: 'إشارة رقمية', headline: 'الإجابة الأسرع ليست دائماً الأذكى.', subline: 'المعيار: ماذا بقي للمتعلم كي يكتشفه بنفسه؟' },
        { layout: 'orbit', tone: 'مدار القرار', headline: 'ضع الإنسان في المركز.', subline: 'ثم اجعل التكنولوجيا تدور حول حاجته، لا العكس.' },
        { layout: 'dark', tone: 'ما خلف الشاشة', headline: 'حين تختفي الأداة… ماذا بقي من الفهم؟', subline: 'هذا هو الاختبار الحقيقي.' },
      ],
    },
    education: {
      insight: 'التعليم لا يقاس بما قيل داخل الصف، بل بما استطاع المتعلم أن يفعله بعده.',
      tension: 'قد يمتلئ الدرس بالمحتوى ويبقى عقل الطالب خارج التجربة.',
      standard: 'المعيار ليس هدوء الصف؛ بل حركة الفهم داخله.',
      question: 'هل تعلّم الطالب… أم نجح فقط في المرور من المهمة؟',
      hashtags: ['#التعليم', '#التعلم', '#المعلم'],
      directions: [
        { layout: 'notebook', tone: 'من دفتر التعلّم', headline: 'ما الذي سيستطيع الطالب فعله؟', subline: 'ابدأ من الأثر، ثم صمّم الدرس.' },
        { layout: 'window', tone: 'نافذة الصف', headline: 'المحتوى ليس التجربة.', subline: 'التعلّم يحدث حين يشارك الطالب في بناء المعنى.' },
        { layout: 'question', tone: 'سؤال تربوي', headline: 'هل قسنا الحفظ أم الفهم؟', subline: 'الإجابة تظهر في التطبيق والتفسير والاختيار.' },
        { layout: 'timeline', tone: 'رحلة التعلّم', headline: 'قبل الدرس · أثناءه · بعده', subline: 'كل مرحلة تحتاج قراراً مختلفاً من المعلم.' },
      ],
    },
    family: {
      insight: 'التربية علاقة يشعر فيها الطفل بالأمان قبل أن يسمع التوجيه.',
      tension: 'قد نقول الكلام الصحيح بنبرة تجعل الطفل لا يسمع إلا الخوف.',
      standard: 'الحدود الواضحة لا تحتاج إلى قسوة؛ تحتاج إلى ثبات وقرب.',
      question: 'هل وصل للطفل معنى الرسالة… أم وصل فقط انفعالنا؟',
      hashtags: ['#التربية', '#الأسرة', '#الطفل'],
      directions: [
        { layout: 'human', tone: 'قرب إنساني', headline: 'العلاقة قبل التعليمات.', subline: 'الطفل يتلقى نبرتنا قبل كلماتنا.' },
        { layout: 'dialogue', tone: 'حوار داخل البيت', headline: 'قل أقل… واسمع أكثر.', subline: 'الحوار لا يلغي الحدود؛ يجعلهـا مفهومة.' },
        { layout: 'window', tone: 'من زاوية الطفل', headline: 'كيف تبدو الرسالة من الجهة الأخرى؟', subline: 'تغيير الزاوية قد يغيّر الاستجابة.' },
        { layout: 'quote', tone: 'ومضة تربوية', headline: 'الأمان لا يفسد التربية.', subline: 'إنه المساحة التي تجعلها ممكنة.' },
      ],
    },
    research: {
      insight: 'الدليل لا يلغي الخبرة، لكنه يحميها من أن تتحول إلى حكم عام.',
      tension: 'الرقم قد يبدو حاسماً وهو لا يجيب أصلاً عن السؤال الذي نطرحه.',
      standard: 'ابحث عن السؤال والمنهج والسياق قبل أن تنبهر بالنتيجة.',
      question: 'هل تقول الدراسة ما نعتقد أنها تقوله فعلاً؟',
      hashtags: ['#البحث_العلمي', '#المعرفة', '#التعليم'],
      directions: [
        { layout: 'research', tone: 'الدليل أولاً', headline: 'لا تبدأ بالنتيجة.', subline: 'ابدأ بالسؤال والمنهج والسياق.' },
        { layout: 'timeline', tone: 'مسار البحث', headline: 'سؤال · منهج · دليل · معنى', subline: 'القفز فوق أي حلقة يضعف الاستنتاج.' },
        { layout: 'split', tone: 'بين الرقم والتفسير', headline: 'البيانات لا تتكلم وحدها.', subline: 'نحن من يمنحها سياقاً وحدوداً.' },
        { layout: 'manifesto', tone: 'قاعدة بحثية', headline: 'الادعاء الكبير يحتاج دليلاً أكبر.', subline: 'والدليل الجيد يحتاج قراءة عادلة.' },
      ],
    },
    media: {
      insight: 'ما يصل إلى الناس ليس مجرد محتوى؛ إنه ترتيب خفي لما يستحق الانتباه.',
      tension: 'قد ينتشر الصوت لأنه مثير، لا لأنه دقيق أو نافع.',
      standard: 'الإعلام الجيد لا يكتفي بأن يجذب العين؛ يحترم عقل المتلقي.',
      question: 'ما الذي غاب عن المشهد بينما كنا نتابع ما تصدّر؟',
      hashtags: ['#الإعلام', '#الوعي_الرقمي', '#المحتوى'],
      directions: [
        { layout: 'dialogue', tone: 'خلف الحوار', headline: 'من يحدد السؤال… يحدد نصف الإجابة.', subline: 'انتبه إلى إطار القصة قبل تفاصيلها.' },
        { layout: 'signal', tone: 'إشارة وسط الضجيج', headline: 'الانتشار ليس دليلاً.', subline: 'قد يكون مجرد مكافأة لخوارزمية تعرف ما يثيرنا.' },
        { layout: 'event', tone: 'قراءة الحدث', headline: 'ماذا حدث؟ وماذا يعني؟', subline: 'الخبر بداية الفهم، لا نهايته.' },
        { layout: 'split', tone: 'المشهد وما وراءه', headline: 'ما نراه / ما لا نراه', subline: 'كل لقطة تستبعد شيئاً من الإطار.' },
      ],
    },
    future: {
      insight: 'المستقبل لا يأتي جاهزاً؛ يتشكل من القرارات الصغيرة التي نكررها اليوم.',
      tension: 'قد نلاحق الجديد وننسى أن نسأل أي مستقبل نريد أصلاً.',
      standard: 'الابتكار الحقيقي يوسع الخيارات ولا يضيق معنى الإنسان.',
      question: 'هل نصمم المستقبل… أم نتكيف فقط مع ما صممه غيرنا؟',
      hashtags: ['#المستقبل', '#الابتكار', '#القيادة'],
      directions: [
        { layout: 'horizon', tone: 'أفق القرار', headline: 'المستقبل يبدأ من قرار اليوم.', subline: 'ليس كل جديد اتجاهاً يستحق الاتباع.' },
        { layout: 'orbit', tone: 'خريطة الاحتمالات', headline: 'لا تتنبأ فقط… صمّم البدائل.', subline: 'الاستشراف الجيد يوسّع مساحة القرار.' },
        { layout: 'manifesto', tone: 'بيان للمستقبل', headline: 'ما لا نصممه بوعي… قد يُفرض علينا.', subline: 'ابدأ بالقيم قبل الأدوات.' },
        { layout: 'circuit', tone: 'بنية الغد', headline: 'التكنولوجيا تبني الممكن.', subline: 'والإنسان يقرر ما يستحق أن يصبح واقعاً.' },
      ],
    },
    human: {
      insight: 'كل فكرة تبدو عظيمة حتى نختبر أثرها في كرامة الإنسان وحريته ومعناه.',
      tension: 'قد ننجح في تحسين النظام ونفشل في حماية الشخص الذي يعيش داخله.',
      standard: 'اجعل الإنسان غاية التطوير، لا كلفة جانبية له.',
      question: 'ماذا بقي من الإنسان بعد أن أصبح كل شيء أكثر كفاءة؟',
      hashtags: ['#الإنسان', '#المعنى', '#الوعي'],
      directions: [
        { layout: 'human', tone: 'الإنسان أولاً', headline: 'لا تجعل الكفاءة تمحو المعنى.', subline: 'اسأل دائماً: من يخدم من؟' },
        { layout: 'signature', tone: 'أثر شخصي', headline: 'الفكرة تُقاس بما تتركه في الإنسان.', subline: 'لا بما تعد به على الورق.' },
        { layout: 'quote', tone: 'وقفة إنسانية', headline: 'نحتاج ما يقرّبنا… لا ما ينجز عنا فقط.', subline: 'التقدم بلا علاقة قد يكون عزلة أسرع.' },
        { layout: 'window', tone: 'نافذة المعنى', headline: 'انظر إلى الشخص لا إلى المؤشر.', subline: 'الأرقام تصف جزءاً من التجربة.' },
      ],
    },
    general: {
      insight: 'الفكرة الجيدة لا تضيف ضجيجاً جديداً؛ تمنحنا زاوية أوضح لما نعيشه.',
      tension: 'قد يبدو الأمر بسيطاً حتى نرى ما يغيّره في القرار اليومي.',
      standard: 'الأثر قبل الانبهار، والوضوح قبل كثرة الكلام.',
      question: 'ما الذي سيتغير فعلاً إذا أخذنا هذه الفكرة بجدية؟',
      hashtags: ['#فكرة', '#تعليم', '#وعي'],
      directions: [
        { layout: 'editorial', tone: 'زاوية تحريرية', headline: 'فكرة تستحق الوقوف.', subline: 'ليس لأنها جديدة فقط؛ بل لأنها تغيّر زاوية النظر.' },
        { layout: 'orbit', tone: 'مدار الفكرة', headline: 'ماذا يدور حول هذا المعنى؟', subline: 'انظر إلى السبب والأثر والقرار.' },
        { layout: 'question', tone: 'سؤال مفتوح', headline: 'ماذا لو نظرنا من جهة أخرى؟', subline: 'أحياناً يبدأ التغيير من إعادة صياغة السؤال.' },
        { layout: 'signature', tone: 'توقيع الفكرة', headline: 'جملة قصيرة… وأثر أطول.', subline: 'احتفظ بما يغيّر القرار، واترك الباقي.' },
      ],
    },
  }
  return profiles[topic]
}

const rotateBy = <T,>(items: T[], offset: number) => {
  if (!items.length) return items
  const index = ((offset % items.length) + items.length) % items.length
  return [...items.slice(index), ...items.slice(0, index)]
}

function buildStandaloneSocialPack(idea: string, purpose: string, audience: string, event?: CurrentEvent | null, variation = 0): PerfectSocialPack {
  const thought = idea.trim() || 'فكرة تستحق التوقف عندها'
  const goal = purpose.trim() || 'لفت الانتباه إلى المعنى قبل الضجيج'
  const topic = detectVisualTopic(`${thought} ${goal} ${audience}`)
  const language = topicLanguage(topic)
  const hook = event ? `الحدث: ${event.title}` : ''
  const directionPool = [
    ...language.directions,
    { layout: 'question', tone: 'سؤال يفتح النقاش', headline: language.question, subline: thought },
    { layout: 'manifesto', tone: 'الخلاصة', headline: language.standard, subline: goal },
    { layout: 'window', tone: 'زاوية أخرى', headline: language.tension, subline: language.insight },
    { layout: 'signature', tone: 'جملة تبقى', headline: thought, subline: language.standard },
  ]
  const visualDirections = rotateBy(directionPool, variation).slice(0, 7)
  const carouselPool = [
    { kicker: visualTopicLabel(topic), title: thought, body: goal },
    { kicker: 'المعنى', title: language.insight, body: `بالنسبة إلى ${audience}، لا يكفي أن تكون الفكرة جذابة؛ يجب أن تغيّر طريقة الفهم أو القرار.` },
    { kicker: 'المفارقة', title: language.tension, body: 'هنا تبدأ المسافة بين ما يبدو ناجحاً وما يصنع أثراً حقيقياً.' },
    { kicker: 'المعيار', title: language.standard, body: 'استخدم هذا المعيار عند تقييم الفكرة في الواقع.' },
    { kicker: 'زاوية تطبيقية', title: 'حوّل الفكرة إلى قرار صغير يمكن ملاحظته.', body: `اسأل ${audience}: ما السلوك أو الاختيار الذي سيتغير بعد قراءة هذه الفكرة؟` },
    { kicker: 'سؤال مفتوح', title: language.question, body: 'لا تبحث عن إجابة سريعة؛ ابحث عن إجابة تستطيع الدفاع عنها في الواقع.' },
    { kicker: 'الخلاصة', title: goal, body: 'الفكرة التي تستحق النشر هي التي تترك للقارئ خطوة تالية واضحة.' },
  ]
  const carouselSlides = rotateBy(carouselPool.slice(1), variation).slice(0, 6)
  carouselSlides.unshift(carouselPool[0])
  const x = rotateBy([
    `${thought}

${language.standard}`,
    `${language.question}

${thought}`,
    `${language.tension}

${goal}`,
    `${language.insight}

${thought}`,
  ], variation).slice(0, 3)
  const linkedin = rotateBy([
    `${thought}

أكتب هذه الفكرة لأن ${goal}. بالنسبة إلى ${audience}، ${language.insight}

${language.question}`,
    `${hook ? `${hook}

` : ''}${thought}

${language.tension}

المعيار الذي أقترحه: ${language.standard}`,
    `${language.insight}

الفكرة الأساسية: ${thought}

ما يهم ${audience}: ${goal}.

${language.question}`,
  ], variation).slice(0, 2)
  const threads = rotateBy([
    `${thought}

${language.insight}`,
    `${language.question}
هذه ليست خاتمة؛ بل بداية النقاش.`,
    `${goal}.

${language.standard}`,
    `${language.tension}

وهنا تحديداً تستحق الفكرة أن تُناقش.`,
  ], variation).slice(0, 3)
  const instagramCaptions = rotateBy([
    `${thought}

${goal}.

${language.hashtags.join(' ')}`,
    `${hook ? `${hook}

` : ''}${language.tension}

${thought}`,
    `${language.question}

${language.standard}`,
    `${language.insight}

${thought}

${language.hashtags.join(' ')}`,
  ], variation).slice(0, 3)
  const generatedAt = new Date().toISOString()

  const facebook = rotateBy([
    `${thought}\n\n${goal}.\n\n${language.question}`,
    `${language.insight}\n\n${thought}\n\nما الذي تراه أنت في هذا؟`,
    `${goal}.\n\n${thought}\n\nأكتب هذا وأنا أنتظر رأيكم — فالنقاش يصحّح ما تفوته الكتابة.`,
  ], variation).slice(0, 3)

  return {
    x,
    linkedin,
    facebook,
    threads,
    instagramCaptions,
    carouselSlides,
    stories: rotateBy([thought, language.tension, language.standard, language.question, goal], variation),
    reelScript: `ابدأ بهذه الجملة: ${thought}. ثم اعرض المفارقة: ${language.tension}. وضّح المعيار: ${language.standard}. اختم بالسؤال: ${language.question}`,
    whatsapp: `${thought}

${goal}.

${language.question}`,
    newsletter: `${visualTopicLabel(topic)}

${thought}

${language.insight}

${language.question}`,
    hashtags: language.hashtags,
    event: event || null,
    eventHook: event ? 'الربط بالحدث هنا يكشف معنى مرتبطاً بالفكرة، ولا يستخدم الحدث لمجرد اللحاق بالترند.' : '',
    visualDirections,
    generatedAt,
    visualSeed: `${topic}:${variation}:${normalize(`${thought} ${goal}`).slice(0, 72)}`,
  }
}

function buildArticleSocialPack(articleBundle: Bundle, audience: string, event?: CurrentEvent | null, variation = 0): PerfectSocialPack {
  const bodySentences = articleBundle.body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 45 && sentence.length <= 190)
  const base = buildStandaloneSocialPack(articleBundle.title, articleBundle.excerpt, audience, event, variation)
  const topic = detectVisualTopic(`${articleBundle.title} ${articleBundle.excerpt} ${articleBundle.body.slice(0, 1200)}`)
  const language = topicLanguage(topic)
  const selected = rotateBy(bodySentences, variation).slice(0, 4)
  const slides = [
    { kicker: visualTopicLabel(topic), title: articleBundle.title, body: articleBundle.excerpt },
    ...selected.map((sentence, index) => ({
      kicker: ['الفكرة', 'المفارقة', 'التحليل', 'الأثر'][index] || 'من المقال',
      title: sentence,
      body: index === selected.length - 1 ? language.standard : '',
    })),
    { kicker: 'السؤال', title: language.question, body: 'اقرأ المقال كاملاً لتتبع الفكرة من بدايتها إلى أثرها.' },
  ]
  return {
    ...base,
    x: rotateBy([
      `${selected[0] || articleBundle.excerpt}

${articleBundle.title}`,
      `${language.question}

${articleBundle.title}`,
      `${language.standard}

${articleBundle.excerpt}`,
      `${language.tension}

${selected[1] || articleBundle.title}`,
    ], variation).slice(0, 3),
    linkedin: rotateBy([
      `${articleBundle.title}

${articleBundle.excerpt}

${language.question}`,
      `${selected.slice(0, 2).join('\n\n')}

${language.standard}`,
      `${language.tension}

${articleBundle.excerpt}

${selected[2] || language.question}`,
    ], variation).slice(0, 2),
    threads: rotateBy([
      `${selected[0] || articleBundle.excerpt}

${language.question}`,
      `${language.tension}

${articleBundle.title}`,
      `${language.insight}

${selected[1] || articleBundle.excerpt}`,
      `${language.standard}

اقرأ الفكرة كاملة في الموقع.`,
    ], variation).slice(0, 3),
    instagramCaptions: rotateBy([
      `${articleBundle.title}

${selected[0] || articleBundle.excerpt}

${base.hashtags.join(' ')}`,
      `${language.tension}

${articleBundle.excerpt}`,
      `${language.question}

اقرأ المقال كاملاً في الموقع.`,
      `${selected[1] || language.insight}

${language.standard}

${base.hashtags.join(' ')}`,
    ], variation).slice(0, 3),
    carouselSlides: slides,
    newsletter: `${articleBundle.title}

${articleBundle.excerpt}

${selected.slice(0, 2).join('\n\n')}

${language.question}`,
    visualSeed: `${topic}:${variation}:${normalize(`${articleBundle.title} ${articleBundle.excerpt}`).slice(0, 72)}`,
  }
}

const uniqueBy = <T,>(items: T[], keyOf: (item: T) => string) => items.filter((item, index, all) => {
  const key = keyOf(item).trim()
  return Boolean(key) && all.findIndex((candidate) => keyOf(candidate).trim() === key) === index
})

function mergeSocialPacks(local: PerfectSocialPack, remote: PerfectSocialPack, variation: number, event?: CurrentEvent | null): PerfectSocialPack {
  const mixText = (remoteItems: string[] | undefined, localItems: string[], limit: number) => rotateBy(
    uniqueBy([...(remoteItems || []), ...localItems], (item) => normalize(item)),
    variation,
  ).slice(0, limit)
  const pick = (remoteValue: string | undefined, localValue: string) => variation % 2 && localValue.trim() ? localValue : (remoteValue?.trim() || localValue)
  const carouselSlides = rotateBy(uniqueBy(
    [...(remote.carouselSlides || []), ...local.carouselSlides],
    (item) => normalize(`${item.kicker} ${item.title} ${item.body}`),
  ), variation).slice(0, 8)
  const visualDirections = rotateBy(uniqueBy(
    [...(remote.visualDirections || []), ...local.visualDirections],
    (item) => normalize(`${item.layout} ${item.headline} ${item.subline}`),
  ), variation).slice(0, 8)

  return {
    ...local,
    ...remote,
    x: mixText(remote.x, local.x, 3),
    linkedin: mixText(remote.linkedin, local.linkedin, 2),
    threads: mixText(remote.threads, local.threads, 3),
    instagramCaptions: mixText(remote.instagramCaptions, local.instagramCaptions, 3),
    carouselSlides,
    stories: mixText(remote.stories, local.stories, 5),
    reelScript: pick(remote.reelScript, local.reelScript),
    whatsapp: pick(remote.whatsapp, local.whatsapp),
    newsletter: pick(remote.newsletter, local.newsletter),
    hashtags: uniqueBy([...(remote.hashtags || []), ...local.hashtags], (item) => normalize(item)).slice(0, 10),
    visualDirections,
    event: remote.event || event || local.event || null,
    eventHook: remote.eventHook?.trim() || local.eventHook || '',
    generatedAt: new Date().toISOString(),
    /* بذرة محلية مرتبطة بالموضوع والضغطة؛ لا يستطيع ردّ الخادم العام أن يمحوها. */
    visualSeed: local.visualSeed,
  }
}

function qualityGate(bundle: Bundle, articles: ArticleRecord[], targetWords: number, skipOriginality: boolean, styleScore: number | null = null, styleBlockers: string[] = []) {
  const usedSlug = articles.some((article) => article.slug === bundle.slug)
  const words = wordCount(bundle.body)
  const evaluated = bundle.title.trim().length >= 6 && words >= 40
  const linked = bundle.related.length + bundle.books.length + bundle.papers.length
  const hasQuestion = /[؟?]/.test(bundle.body) || /السؤال|لماذا|كيف/.test(bundle.body)
  const socialOk = bundle.social.x.length <= 280 && bundle.social.linkedin.length >= 120 && bundle.social.instagram.length >= 90
  const similarity = articleSimilarityReport(bundle.title, bundle.body, articles)
  const checks = [
    { key: 'title', label: 'عنوان قوي وواضح', ok: bundle.title.trim().length >= 12 && !/^مقال|فكرة/.test(bundle.title.trim()) },
    { key: 'excerpt', label: 'مقتطف صالح للمشاركة', ok: bundle.excerpt.trim().length >= 70 && bundle.excerpt.trim().length <= 200 },
    { key: 'slug', label: 'Slug نظيف وغير مكرر', ok: /^[a-z0-9-]{8,}$/.test(bundle.slug) && !usedSlug },
    { key: 'links', label: 'روابط داخلية/معرفية', ok: linked >= 2 },
    { key: 'image', label: 'صورة مشاركة افتراضية متاحة', ok: true },
    { key: 'duplicate', label: skipOriginality ? 'الأصالة: مستثناة بإقرار الكاتب' : `أصالة الفكرة (${similarity.originality}٪)`, ok: skipOriginality || (!similarity.repeated && !articles.some((article) => normalize(article.title) === normalize(bundle.title))) },
    { key: 'words', label: `الحد الأدنى: ${arabicCountPhrase(MIN_ARTICLE_WORDS, WORD_PLAIN_FORMS)} (الحالي ${words})`, ok: words >= MIN_ARTICLE_WORDS },
    { key: 'voice', label: 'قابلية صوتية', ok: words >= MIN_ARTICLE_WORDS && hasQuestion },
    /* كان: `Boolean(bundle.generatedBy)` — وسمٌ لا يضعه إلا المولّد، فصار
       المقال الذي يكتبه الدكتور بيده عاجزاً عن مغادرة الاستوديو بعد أن صار
       المحرّر يفتح فارغاً. المقياس الآن ما يدّعيه: مطابقة البصمة نفسها. */
    /* ولا تُقاس المطابقة بعتبةٍ تحجب: قِسْتُها على متونه فوجدت أن عتبة ٧٢
       ترسّب ٢١٪ من مقالاته المنشورة — عشرةٌ منها حديثة. أسلوبه متفاوتٌ بطبعه،
       والدرجة تدرّجٌ لا حكم. فالبوابة تُخبر ولا تحجب هنا؛ ولا يحجب إلا العيب
       الموضوعي: نقلٌ حرفي، أو رقمٌ مختلق، أو نصٌّ يلفّ على نفسه، أو عبارة
       نموذجٍ آليّ — وهذه تُقاس في بندٍ مستقلّ لا يقبل التأويل. */
    { key: 'style-ai', label: `مطابقة أسلوبك${styleScore === null ? '' : ` — ${styleScore}٪`}`, ok: true },
    { key: 'style-blockers', label: styleBlockers.length ? `عيوبٌ توقف النشر: ${styleBlockers.join(' · ')}` : 'بلا نقلٍ حرفي ولا رقمٍ مختلق ولا تكرار', ok: styleBlockers.length === 0 },
    { key: 'social', label: 'قابل للتحويل إلى حزمة سوشيال لاحقاً', ok: socialOk },
  ]
  return {
    evaluated,
    checks,
    ready: evaluated && checks.every((check) => check.ok),
    blocking: evaluated ? checks.filter((check) => !check.ok).map((check) => check.label) : [],
  }
}

function sentenceStats(text = '') {
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!؟])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 12)
  const counts = sentences.map((sentence) => wordCount(sentence))
  const average = counts.length ? Math.round(counts.reduce((sum, count) => sum + count, 0) / counts.length) : 0
  return { sentences, average }
}

function styleReview(bundle: Bundle, style: ReturnType<typeof editorialStyleProfile>) {
  const body = bundle.body || ''
  const words = wordCount(body)
  const paragraphs = body.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
  const stats = sentenceStats(body)
  const avgSentence = Number(style.avgSentenceWords || 0)
  const sentenceGap = avgSentence ? Math.abs(stats.average - avgSentence) : 0
  const paragraphGap = style.avgParagraphs ? Math.abs(paragraphs.length - Number(style.avgParagraphs)) : 0
  const anchors = ['الإنسان', 'الطالب', 'المعلم', 'المعنى', 'الوعي', 'القيمة', 'الخوف', 'التعليم'].filter((word) => body.includes(word))
  const connectors = (style.connectors || []).map((item) => item.term).filter((term) => body.includes(term)).slice(0, 5)
  const weakPhrases = [
    'في عالمنا اليوم',
    'لا شك أن',
    'مما لا شك فيه',
    'في الختام',
    'من الجدير بالذكر',
    'يلعب دوراً حيوياً',
    'ثورة غير مسبوقة',
  ].filter((phrase) => body.includes(phrase))
  const hasHumanOpening = /^(قد يبدو|حين|عندما|ليست|ليس|في|أمام|داخل|هل|كيف|لماذا|ماذا)/.test(body.trim())
  const checks = [
    { label: 'افتتاحية من عالم الإنسان لا من تعريف مدرسي', ok: hasHumanOpening, note: hasHumanOpening ? 'البداية قريبة من روح المقالات.' : 'جرّب أن تبدأ بمشهد أو مفارقة.' },
    { label: `متوسط الجملة قريب من بصمتك (${style.avgSentenceWords ? arabicCountPhrase(style.avgSentenceWords, WORD_PLAIN_FORMS) : '—'})`, ok: !avgSentence || sentenceGap <= 7, note: stats.average ? `المقال الحالي: ${arabicCountPhrase(stats.average, WORD_PLAIN_FORMS)} للجملة.` : 'لا توجد جمل كافية للحكم.' },
    { label: `تقسيم الفقرات قريب من عادتك (${style.avgParagraphs ? arabicCountPhrase(style.avgParagraphs, PARAGRAPH_FORMS) : '—'})`, ok: !style.avgParagraphs || paragraphGap <= 4, note: `${arabicCountPhrase(paragraphs.length || 0, PARAGRAPH_FORMS)} في النص الحالي.` },
    { label: 'حضور مفرداتك الإنسانية', ok: anchors.length >= 3, note: anchors.length ? anchors.join('، ') : 'أضف أثر الفكرة في الإنسان/الطالب/المعلم.' },
    { label: 'روابط انتقال طبيعية في التحليل', ok: connectors.length >= 2, note: connectors.length ? connectors.join('، ') : 'النص يحتاج مفاصل انتقال أكثر.' },
    { label: 'خلو من عبارات AI العامة', ok: weakPhrases.length === 0, note: weakPhrases.length ? weakPhrases.join('، ') : 'لا توجد عبارات آلية ظاهرة.' },
    { label: 'طول مريح للمقال الفكري', ok: words >= MIN_ARTICLE_WORDS, note: `${arabicCountPhrase(words, WORD_PLAIN_FORMS)}.` },
  ]
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100)
  return {
    score,
    label: score >= 86 ? 'قريب جداً من بصمتك' : score >= 70 ? 'قريب… يحتاج تهذيباً بسيطاً' : 'بعيد عن روحك ويحتاج مراجعة',
    checks,
  }
}

type EditorialStatus = 'pass' | 'watch' | 'hold'
type EditorialSignal = {
  label: string
  status: EditorialStatus
  detail: string
}

const statusTone: Record<EditorialStatus, string> = {
  pass: 'border-accent/[.35] bg-accent/[.055] text-accent',
  watch: 'border-hair bg-canvas text-soft',
  hold: 'border-red-300/40 bg-canvas text-soft',
}

const signalLabel: Record<EditorialStatus, string> = {
  pass: 'يمر',
  watch: 'انتبه',
  hold: 'أوقف',
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalize(word)))
}

function buildEditorialDecisionSuite({
  bundle,
  gate,
  styleInsight,
  weeklyPack,
  privateMatches,
  similarity,
}: {
  bundle: Bundle
  gate: ReturnType<typeof qualityGate>
  styleInsight: ReturnType<typeof styleReview>
  weeklyPack: WeeklyPack
  privateMatches: ReturnType<typeof privateBookMatches>
  similarity: ReturnType<typeof articleSimilarityReport>
}) {
  const fullText = normalize(`${bundle.title} ${bundle.excerpt} ${bundle.body}`)
  const rawText = `${bundle.title}\n${bundle.excerpt}\n${bundle.body}`
  const words = wordCount(bundle.body)
  const hasEvidence = /\d|دراسة|بحث|جامعة|تقرير|مصدر|وفق|يشير|تبيّن|تبين|بيانات|إحصاء|احصاء/.test(rawText)
  const hasHumanAnchor = hasAny(fullText, ['الإنسان', 'انسان', 'طالب', 'معلم', 'أسرة', 'طفل', 'معنى', 'كرامة', 'وعي'])
  const hasAction = hasAny(fullText, ['ماذا نفعل', 'خطوة', 'عملي', 'قرار', 'تطبيق', 'ممارسة', 'نبدأ', 'نغيّر', 'نغير'])
  const repeatedRisk = !bundle.originalityBypassed && (similarity.repeated || similarity.originality < 68)
  const decisionSignals: EditorialSignal[] = [
    {
      label: 'بوابة النشر الأساسية',
      status: gate.ready ? 'pass' : 'hold',
      detail: gate.ready ? 'العنوان والمقتطف والرابط والأصالة والحد الأدنى اجتازت الفحص.' : `تحتاج معالجة: ${gate.blocking.slice(0, 2).join('، ') || 'بنود جودة ناقصة'}.`,
    },
    {
      label: 'قربه من بصمة الدكتور',
      status: styleInsight.score >= 84 ? 'pass' : styleInsight.score >= 70 ? 'watch' : 'hold',
      detail: `${styleInsight.label} — ${styleInsight.score}٪.`,
    },
    {
      label: 'خطر التكرار',
      status: repeatedRisk ? 'hold' : similarity.originality < 78 ? 'watch' : 'pass',
      detail: repeatedRisk ? `قريب جداً من «${similarity.matches[0]?.title || 'مقال سابق'}».` : `الأصالة التحريرية ${similarity.originality}٪.`,
    },
    {
      label: 'جاهزية التحويل',
      status: bundle.socialPack || weeklyPack.linkedin.length ? 'pass' : 'watch',
      detail: bundle.socialPack ? 'الحزمة الاجتماعية الفاخرة جاهزة للمراجعة.' : 'الحزمة الاحتياطية جاهزة؛ الأفضل بناء النسخة الفاخرة قبل الاعتماد.',
    },
  ]

  const decisionHolds = decisionSignals.filter((signal) => signal.status === 'hold').length
  const decisionWatches = decisionSignals.filter((signal) => signal.status === 'watch').length
  const decisionScore = Math.max(0, Math.round(100 - decisionHolds * 24 - decisionWatches * 9))
  const decision = decisionHolds
    ? 'لا تنشر الآن.'
    : decisionWatches
      ? 'جاهز بشرط مراجعة هادئة.'
      : 'جاهز للنشر بثقة.'

  const silenceDimensions = [
    { label: 'صوت الطالب', words: ['طالب', 'متعلم', 'طفل'], prompt: 'هل يظهر أثر الفكرة على الطالب لا على النظام فقط؟' },
    { label: 'صوت المعلم', words: ['معلم', 'مدرس', 'تدريس'], prompt: 'هل توضّح العبء أو القرار الذي سيواجهه المعلم؟' },
    { label: 'الأسرة والمجتمع', words: ['أسرة', 'اسره', 'ولي', 'بيت', 'مجتمع'], prompt: 'هل توجد زاوية اجتماعية حين يحتاج الموضوع ذلك؟' },
    { label: 'الدليل أو المثال', words: ['دراسة', 'بحث', 'مثال', 'حالة', 'تجربة', 'رقم', 'نسبة'], prompt: 'هل يوجد مثال أو دليل يمنع النص من أن يبقى تأملاً عاماً؟' },
    { label: 'الحد الأخلاقي', words: ['أخلاق', 'قيمة', 'كرامة', 'خصوصية', 'تحيز', 'مسؤولية'], prompt: 'هل يضع المقال حداً واضحاً لما لا ينبغي تجاوزه؟' },
    { label: 'الخطوة العملية', words: ['خطوة', 'قرار', 'تطبيق', 'ممارسة', 'كيف', 'نبدأ'], prompt: 'هل يعرف القارئ ماذا يفعل بالفكرة بعد قراءتها؟' },
  ].map((dimension) => ({
    ...dimension,
    present: hasAny(fullText, dimension.words),
  }))
  const silent = silenceDimensions.filter((dimension) => !dimension.present)
  const silenceScore = Math.round(((silenceDimensions.length - silent.length) / silenceDimensions.length) * 100)

  const digitalSignals: EditorialSignal[] = [
    {
      label: 'تنوع المنصات',
      status: weeklyPack.linkedin.length >= 3 && weeklyPack.x.length >= 3 && Boolean(weeklyPack.instagram) ? 'pass' : 'watch',
      detail: 'LinkedIn وX وInstagram وسؤال تفاعلي جاهزة من المقال.',
    },
    {
      label: 'لغة غير متضخمة',
      status: /ثوري|غير مسبوق|يقلب العالم|الأفضل على الإطلاق/.test(rawText) ? 'watch' : 'pass',
      detail: 'يعتمد الحضور الرقمي على فكرة هادئة لا ادعاء تسويقي.',
    },
    {
      label: 'الحدث الراهن',
      status: bundle.event ? 'pass' : 'watch',
      detail: bundle.event ? `مرتبط بمصدر: ${bundle.event.source}.` : 'لا يوجد حدث مثبت؛ لا مشكلة إذا كان المقال فكرياً لا خبرياً.',
    },
    {
      label: 'قابلية الصورة والاقتباس',
      status: strongestQuote(bundle.body).length >= 40 ? 'pass' : 'watch',
      detail: 'توجد جملة قابلة للتحويل إلى بطاقة اقتباس أو كاروسيل.',
    },
  ]
  const digitalScore = Math.max(0, Math.round(100 - digitalSignals.filter((signal) => signal.status === 'watch').length * 10 - digitalSignals.filter((signal) => signal.status === 'hold').length * 24))

  const ethicalSignals: EditorialSignal[] = [
    {
      label: 'لا يخترع يقيناً باسم الدكتور',
      status: /أثبتت كل الدراسات|بلا شك|حتمياً|حتما|مستحيل/.test(rawText) && !hasEvidence ? 'watch' : 'pass',
      detail: hasEvidence ? 'الادعاءات الحساسة لها إشارة بحثية أو رقمية.' : 'لا توجد ادعاءات علمية حاسمة بلا سند واضح.',
    },
    {
      label: 'كرامة الإنسان قبل الأداة',
      status: hasHumanAnchor ? 'pass' : 'watch',
      detail: hasHumanAnchor ? 'الأثر الإنساني حاضر في النص.' : 'أضف أثراً مباشراً على الإنسان/الطالب/المعلم.',
    },
    {
      label: 'لا يكشف خصوصيات',
      status: /رقم هاتف|بريد خاص|اسم طالب|بيانات شخصية/.test(rawText) ? 'hold' : 'pass',
      detail: 'لا توجد بيانات شخصية ظاهرة داخل المسودة.',
    },
    {
      label: 'قابل للمراجعة لا للتفويض الأعمى',
      status: hasAction || hasEvidence ? 'pass' : 'watch',
      detail: 'يفضّل أن يترك النص معياراً أو خطوة قابلة للمراجعة.',
    },
  ]
  const ethicalHolds = ethicalSignals.filter((signal) => signal.status === 'hold').length
  const ethicalScore = Math.max(0, Math.round(100 - ethicalHolds * 35 - ethicalSignals.filter((signal) => signal.status === 'watch').length * 10))

  return {
    evaluated: gate.evaluated,
    decision,
    decisionScore,
    decisionSignals,
    silenceScore,
    silent,
    silenceSummary: silent.length
      ? `الصمت الأبرز: ${silent.slice(0, 2).map((item) => item.label).join('، ')}.`
      : 'لا توجد فجوة صامتة واضحة؛ الفكرة متوازنة.',
    digitalScore,
    digitalSignals,
    digitalDecision: digitalScore >= 86 ? 'اعتمد الحضور الرقمي.' : digitalScore >= 70 ? 'اعتمد بعد تهذيب بسيط.' : 'أعد ضبط الحملة قبل النشر.',
    ethicalScore,
    ethicalSignals,
    ethicalDecision: ethicalHolds ? 'أوقف حتى تُزال المخالفة.' : ethicalScore >= 86 ? 'منسجم أخلاقياً.' : 'يحتاج تدقيقاً أخلاقياً خفيفاً.',
    privateMemory: privateMatches[0]?.title ? `قريب داخلياً من «${privateMatches[0].title}».` : 'لا يوجد ربط خاص واثق حتى الآن.',
    words,
  }
}

function privateBookMatches(bundle: Bundle, privateLinks: PrivateBookLink[]) {
  const text = normalize(`${bundle.title} ${bundle.excerpt} ${bundle.body} ${bundle.cat}`)
  const tocBooks = (bookTocLinks as { books?: PrivateBookLink[] }).books || []
  const publicSlugs = new Set([
    ...bundle.related.map((item) => item.slug),
    ...bundle.books.map((item) => item.slug),
  ])
  return privateLinks
    .map((book) => {
      const tocBook = tocBooks.find((candidate) => normalize(candidate.title) === normalize(book.title))
      const sections = [...(book.sections || []), ...(tocBook?.sections || [])]
      const termScore = (book.topTerms || []).reduce((sum, term) => sum + (text.includes(normalize(term)) ? 1 : 0), 0)
      const articleScore = (book.relatedPublicArticles || []).reduce((sum, article) => sum + (publicSlugs.has(article.slug) ? 2 : 0), 0)
      const linkedBookScore = book.linkedPublicBook && publicSlugs.has(book.linkedPublicBook.slug) ? 3 : 0
      const score = termScore + articleScore + linkedBookScore
      const section = sections
        .map((candidate) => ({
          ...candidate,
          score: (candidate.keywords || []).reduce((sum, keyword) => sum + (text.includes(normalize(keyword)) ? 1 : 0), 0)
            + (text.includes(normalize(candidate.label || '')) ? 1 : 0),
        }))
        .sort((a, b) => b.score - a.score)[0] || null
      return { ...book, score, section }
    })
    .filter((book) => book.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

function buildWeeklyPack(bundle: Bundle, articles: ArticleRecord[], opportunity?: OpportunityRadarItem): WeeklyPack {
  const related = bundle.related
    .map((item) => articles.find((article) => article.slug === item.slug))
    .filter(Boolean) as ArticleRecord[]
  const pool = related.length ? related : articles.slice(0, 5)
  const quote = strongestQuote(pool.map((article) => `${article.excerpt || ''} ${article.body || ''}`).join(' ') || bundle.body)
  const radarComment = opportunity
    ? `${opportunity.event.title}\n\n${opportunity.whyNow}\n\nلهذا أعود اليوم إلى «${opportunity.article.title}» — لا لأن المادة قديمة، بل لأن اللحظة أعادت فتح سؤالها.\n\nثقة الرادار الموثقة: ${opportunity.confidence}٪ · المصدر: ${opportunity.event.source}`
    : ''
  return {
    linkedin: [
      `${bundle.title}\n\n${bundle.excerpt}\n\nالفكرة ليست في سرعة التغيير، بل في المعنى الذي نحافظ عليه ونحن نتغير.`,
      `حين نناقش ${bundle.title}، لا أبدأ من الأداة، بل من أثرها في الإنسان.\n\nالتعليم لا يحتاج انبهاراً إضافياً؛ يحتاج سؤالاً أعدل: ماذا يحدث للطالب والمعلم عندما تتحول الفكرة إلى ممارسة؟`,
      `${quote}\n\nهذه الجملة تصلح كبداية نقاش طويل مع المعلمين والباحثين: هل نطوّر التعليم أم نسرّع إجراءاته فقط؟`,
    ],
    x: [
      `${quote}\n\n${bundle.title}`,
      `السؤال ليس: ما الأداة؟\nالسؤال: ماذا تفعل الأداة في وعي الطالب والمعلم؟`,
      `كل تطوير تعليمي لا يبدأ من الإنسان، ينتهي غالباً إلى إجراء جميل… ومعنى ناقص.`,
    ],
    generalX: [
      `ليست المشكلة أن التكنولوجيا تتقدم بسرعة.\nالمشكلة أن أسئلتنا التربوية أحياناً تتأخر عنها.`,
      `في التعليم، لا يكفي أن نعرف ماذا يستطيع الذكاء الاصطناعي أن يفعل.\nالأهم: ماذا يجب ألا نسمح له أن يختصر؟`,
      `المعلم لا يفقد قيمته حين تظهر أداة جديدة.\nيفقدها فقط إذا اختزلنا التعليم في نقل المعلومة، ونسينا بناء الإنسان.`,
    ],
    instagram: `${bundle.title}\n\n${quote}\n\nفكرة للنقاش: كيف نجعل التكنولوجيا تخدم الإنسان لا تختصره؟\n\n#التعليم #الذكاء_الاصطناعي #تكنولوجيا_التعليم`,
    question: `لو كنت في قاعة تدريب: ما السؤال الأول الذي ستطرحه حول «${bundle.title}»؟`,
    quote,
    radarComment,
  }
}

function suggestArticleIdeas(articles: ArticleRecord[], radar: RadarItem[], privateLinks: PrivateBookLink[]) {
  const strategic = [
    { title: 'المعلم حين يصبح الذكاء الاصطناعي زميلاً لا بديلاً', idea: 'زاوية عن العلاقة العملية بين المعلم والأدوات الذكية داخل الصف.' },
    { title: 'الطالب الذي يعرف الإجابة ولا يعرف الطريق إليها', idea: 'عن أثر الإجابات الفورية في بناء التفكير والصبر المعرفي.' },
    { title: 'من يربّي الخوارزمية؟', idea: 'سؤال أخلاقي حول البيانات والقيم والتحيز في التعليم.' },
    { title: 'الأسرة أمام واجب رقمي جديد', idea: 'كيف يتغير دور ولي الأمر حين تصبح التكنولوجيا جزءاً من التعلم اليومي؟' },
    { title: 'الجامعة في زمن المحتوى المتولد', idea: 'ما الذي يبقى من البحث والكتابة الأكاديمية حين تتغير أدوات الإنتاج؟' },
  ]
  const radarIdeas = radar.slice(0, 3).map((item) => ({
    title: `ماذا يعني ${item.ar || item.en || 'هذا الحدث'} للتعليم؟`,
    idea: item.arNote || 'تعليق تربوي على حدث تكنولوجي/تعليمي راهن وربطه بأرشيف الدكتور.',
  }))
  const privateIdeas = privateLinks.slice(0, 3).map((book) => ({
    title: `من كتاب «${book.title}» إلى سؤال جديد في التعليم`,
    idea: `استخرج زاوية عامة من محاور الكتاب الخاصة: ${(book.topTerms || []).slice(0, 4).join('، ')} — من دون كشف نص الكتاب.`,
  }))
  return [...radarIdeas, ...privateIdeas, ...strategic]
    .map((item) => ({
      ...item,
      coverage: relatedForIdea(`${item.title} ${item.idea}`, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 4),
    }))
    .sort((a, b) => a.coverage.length - b.coverage.length)
    .slice(0, 8)
}

function buildBundle(idea: string, audience: string, angle: string, articles: ArticleRecord[]): Bundle {
  const title = suggestStrongTitle(idea)
  const cat = chooseCat(`${idea} ${angle}`)
  const related = relatedForIdea(`${idea} ${angle}`, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 5)
  const relatedBooks = relatedForIdea(`${idea} ${angle}`, books, (book) => book.desc || '', 3)
  const relatedPapers = relatedForIdea(`${idea} ${angle}`, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, 3)
  /* المحرّر يفتح فارغاً: لا نصَّ يُنسب إليه قبل أن يكتبه المحرك بأسلوبه. */
  const body = ''
  const excerpt = ''
  const partial = { title, excerpt, body }
  const quality = [
    'المحرّر يفتح فارغاً عمداً؛ المقال يُكتب ببصمتك المقيسة لا بقالب.',
    related.length ? `مرتبط بـ ${arabicCountPhrase(related.length, ARTICLE_AFTER_PREPOSITION_FORMS)} من أرشيفك.` : 'لم أجد ربطاً قوياً؛ أضف كلمات من قاموسك الفكري.',
    relatedBooks.length || relatedPapers.length ? 'يوجد امتداد أكاديمي/كتابي مناسب.' : 'لا يوجد امتداد كتابي أو بحثي واضح بعد.',
    'صورة المشاركة الافتراضية جاهزة إذا لم ترفع صورة خاصة.',
    'الحزمة الاجتماعية تُبنى بعد كتابة المقال، ويمكن حفظها في طابور الموافقة.',
    'التصنيف والمقتطف والـslug جاهزة مبدئياً.',
    'بعد النشر: الصوت الآلي وR2 ينتظران مفاتيح Azure/Gemini ليصبحا تلقائيين بالكامل.',
  ]
  return {
    ...partial,
    slug: makeSlug(title),
    cat,
    social: buildSocial(partial, audience),
    related: related.map(({ slug, title, iso }) => ({ slug, title, iso })),
    books: relatedBooks.map(({ slug, title }) => ({ slug, title })),
    papers: relatedPapers.map(({ slug, title }) => ({ slug, title })),
    quality,
  }
}

function CopyButton({ value, label = 'نسخ' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={ghost}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setDone(true)
        window.setTimeout(() => setDone(false), 1600)
      }}
    >
      {done ? 'تم النسخ ✓' : label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[.76rem] font-semibold text-accent">{label}</span>
      {children}
    </label>
  )
}

function SocialCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-hair bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-ink">{title}</p>
        <CopyButton value={text} />
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[.84rem] leading-relaxed text-soft">{text}</p>
    </div>
  )
}

function IdeaSuggestionsCard({
  suggestions,
  onPick,
}: {
  suggestions: ReturnType<typeof suggestArticleIdeas>
  onPick: (title: string, idea: string) => void
}) {
  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-[.76rem] font-semibold uppercase text-accent">ما لم أكتب فيه بعد</span>
          <span className="mt-1 block font-display text-xl font-semibold text-ink">اقتراحات مقالات جديدة قبل الكتابة.</span>
          <span className="mt-1 block text-[.82rem] leading-relaxed text-soft">{suggestions.length} اقتراحات من فجوات الأرشيف — افتحها عند الحاجة.</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 grid gap-3 border-t border-hair pt-5 md:grid-cols-2">
        {suggestions.map((item) => (
          <button
            key={`${item.title}-${item.idea}`}
            type="button"
            onClick={() => onPick(item.title, item.idea)}
            className="rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent"
          >
            <span className="block font-display text-lg font-semibold leading-relaxed text-ink">{item.title}</span>
            <span className="mt-2 block text-[.84rem] leading-relaxed text-soft">{item.idea}</span>
            <span className="mt-3 block text-[.74rem] text-accent">
              {item.coverage.length ? `الأرشيف يغطيها جزئياً: ${arabicCountPhrase(item.coverage.length, LINK_FORMS)}` : 'فجوة شبه جديدة — مناسبة لمقال'}
            </span>
          </button>
        ))}
      </div>
    </details>
  )
}

function ArchiveWakeCard({
  articles,
  onPick,
}: {
  articles: ArticleRecord[]
  onPick: (title: string, idea: string) => void
}) {
  const now = new Date()
  const month = now.getMonth() + 1
  const seasonal =
    month >= 5 && month <= 7 ? 'الاختبارات والتخرج وتسجيل الجامعة وبداية القرار الأكاديمي'
      : month >= 8 && month <= 10 ? 'العودة للدراسة والمعلم والطالب والبيت'
        : month >= 11 || month <= 2 ? 'التكنولوجيا والهوية والأسرة في نهاية وبداية العام'
          : 'التعليم والتكنولوجيا والإنسان في منتصف العام'
  const candidates = relatedForIdea(seasonal, articles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 12)
    .filter((article) => Number(article.iso?.slice(0, 4) || 3000) <= now.getFullYear() - 2)
    .slice(0, 4)

  if (!candidates.length) return null
  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-[.76rem] font-semibold uppercase text-accent">أرشيف يستيقظ</span>
          <span className="mt-1 block font-display text-xl font-semibold text-ink">مقال قديم مناسب للحظة الحالية.</span>
          <span className="mt-1 block text-[.82rem] leading-relaxed text-soft">اقتراح موسمي هادئ لإعادة نشر فكرة من أرشيفك، لا إضافة محتوى جديد.</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 grid gap-3 border-t border-hair pt-5 md:grid-cols-2">
        {candidates.map((article) => {
          const year = article.iso?.slice(0, 4)
          const quote = strongestQuote(`${article.excerpt || ''} ${article.body || ''}`)
          const idea = `إعادة قراءة مقال «${article.title}» في ضوء ${seasonal}. ${quote}`
          return (
            <button
              key={article.slug}
              type="button"
              onClick={() => onPick(`إعادة قراءة: ${article.title}`, idea)}
              className="rounded-2xl border border-hair bg-canvas p-4 text-right transition-colors hover:border-accent"
            >
              <span className="block text-[.72rem] font-semibold text-accent">{year ? `من أرشيف ${year}` : 'من الأرشيف'}</span>
              <span className="mt-1 block font-display text-[1.05rem] font-semibold leading-relaxed text-ink">{article.title}</span>
              <span className="mt-2 block text-[.82rem] leading-relaxed text-soft">{article.excerpt || quote}</span>
            </button>
          )
        })}
      </div>
    </details>
  )
}


function EditorialBoardPanel({
  decision,
  progress,
  busy,
  historyCount,
  onStart,
  onOpenExisting,
}: {
  decision: EditorialBoardDecision | null
  progress: EditorialProgress
  busy: boolean
  historyCount: number
  onStart: (decision: EditorialBoardDecision) => void
  onOpenExisting: (decision: EditorialBoardDecision) => void
}) {
  if (busy && !decision) {
    return (
      <section className={`${card} border-accent/25`} aria-live="polite" data-editorial-board-analyzing="true">
        <p className="text-[.72rem] font-semibold uppercase text-accent">مجلس التحرير</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color:var(--c-hair)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div>
        <p className="mt-4 font-display text-xl font-semibold text-ink">{EDITORIAL_PROGRESS_LABELS[progress] || 'يبدأ التحليل…'}</p>
        <p className="mt-2 text-[.8rem] leading-relaxed text-soft">كل خطوة هنا مرتبطة بفحص حقيقي؛ لا توجد حركة تحميل وهمية.</p>
      </section>
    )
  }
  if (!decision) return null
  const scoreRows = [
    ['قوة الفكرة', decision.scores.strength],
    ['الجِدة بالنسبة لأرشيفك', decision.scores.novelty],
    ['خطر التكرار', decision.scores.repetitionRisk],
    ['قوة التوقيت', decision.scores.timing],
    ['ملاءمة الموضوع لهويتك', decision.scores.identityFit],
    ['حاجة المحفظة لهذا الاتجاه', decision.portfolio.strategicNeedScore],
    ['قابلية التحول إلى مقال قوي', decision.scores.articlePotential],
  ] as const
  const canStart = ['write_now', 'change_angle'].includes(decision.verdict)
  return (
    <section className={`${card} border-accent/25`} data-editorial-board-decision="true">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hair pb-5">
        <div className="max-w-3xl">
          <p className="text-[.72rem] font-semibold uppercase text-accent">قرار مجلس التحرير</p>
          <h2 className="mt-1 font-display text-[clamp(1.55rem,3vw,2.3rem)] font-semibold leading-tight text-ink">{decision.verdictLabel}</h2>
          <p className="mt-3 text-[.84rem] leading-[1.85] text-soft">{decision.why[0]}</p>
        </div>
        <div className="text-left">
          <span className="block font-display text-3xl font-semibold text-accent">{editorialScoreLabel(decision.scores.strength)}</span>
          <span className="mt-1 block text-[.66rem] text-soft">قوة القرار · {historyCount ? arabicCountPhrase(historyCount, SAVED_DECISION_FORMS) : 'أول قرار محفوظ'}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {scoreRows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b border-hair py-2.5">
            <span className="text-[.76rem] text-soft">{label}</span>
            <strong className="text-[.8rem] text-ink">{editorialScoreLabel(value)}</strong>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-2">
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">لماذا هذا الحكم؟</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3">{decision.why.map((line) => <p key={line} className="mt-2 text-[.8rem] leading-relaxed text-soft">{line}</p>)}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">الفراغ التحريري</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3"><p className="text-[.84rem] font-semibold leading-relaxed text-ink">{decision.editorialGap.headline}</p>{decision.editorialGap.gap.map((line) => <p key={line} className="mt-2 text-[.78rem] leading-relaxed text-soft">{line}</p>)}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">محكمة الأرشيف</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3">
            <p className="text-[.8rem] leading-relaxed text-soft">{decision.archiveCourt.summary}</p>
            <div className="mt-3 grid gap-2">{decision.archiveCourt.nearest.map((item) => <a key={`${item.kind}-${item.slug}`} href={item.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-hair px-3 py-2 text-[.76rem] text-ink transition-colors hover:border-accent hover:text-accent"><span className="min-w-0 truncate">{item.kind === 'article' ? 'مقال' : item.kind === 'book' ? 'كتاب' : 'بحث'} · {item.title}</span><span className="shrink-0 text-soft">صلة {item.score}</span></a>)}</div>
            {decision.archiveCourt.contradictionOpportunity && <p className="mt-3 text-[.78rem] leading-relaxed text-accent">{decision.archiveCourt.contradictionOpportunity}</p>}
          </div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">رادار اللحظة</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3"><p className="text-[.78rem] leading-relaxed text-soft">{decision.timingRadar.explanation}</p>{decision.dataNotes.map((note) => <p key={note} className="mt-2 text-[.72rem] leading-relaxed text-soft">{note}</p>)}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3" data-editorial-evidence-trace="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">بصمة الدليل</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 grid gap-3 border-t border-hair pt-3">{decision.scoreEvidence.map((item) => <div key={item.key} className="border-b border-hair pb-3 last:border-0 last:pb-0"><div className="flex items-baseline justify-between gap-4"><strong className="text-[.78rem] text-ink">{item.label}</strong><span className="text-[.72rem] text-soft">{editorialScoreLabel(item.value)} · {item.confidence === 'high' ? 'دليل قوي' : item.confidence === 'medium' ? 'دليل متوسط' : 'دليل محدود'}</span></div>{item.signals.map((signal) => <p key={signal} className="mt-1 text-[.72rem] leading-relaxed text-soft">{signal}</p>)}</div>)}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3" data-editorial-portfolio="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">وعي المحفظة الفكرية</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3"><p className="text-[.8rem] leading-relaxed text-ink">{decision.portfolio.explanation}</p>{decision.portfolio.available && <p className="mt-2 text-[.72rem] leading-relaxed text-soft">المحور: {decision.portfolio.focusCategory} · حضوره {decision.portfolio.focusCategoryCount}/{decision.portfolio.totalArticles} · مواد قريبة: {arabicCountPhrase(decision.portfolio.relatedArticleCount, ARTICLE_PLAIN_FORMS)}، {arabicCountPhrase(decision.portfolio.relatedBookCount, BOOK_PLAIN_FORMS)}، {arabicCountPhrase(decision.portfolio.relatedPaperCount, PAPER_PLAIN_FORMS)}.</p>}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3" data-editorial-personal-context="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">السياق الشخصي الخاص</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3">
            <p className="text-[.8rem] leading-relaxed text-ink">{decision.agenda.explanation}</p>
            {decision.personalSources.length ? <div className="mt-3 grid gap-2">{decision.personalSources.map((source) => <div key={source.id} className="flex items-start justify-between gap-3 border-b border-hair pb-2 last:border-0"><span className="min-w-0 text-[.74rem] leading-relaxed text-soft">{source.title}</span><span className="shrink-0 text-[.68rem] text-soft">{source.status === 'active' ? 'فعّال' : source.status === 'retracted' ? 'منسحب' : source.status === 'corrected' ? 'مصحح' : 'يحتاج مراجعة'}</span></div>)}</div> : <p className="mt-2 text-[.72rem] leading-relaxed text-soft">لا توجد مادة محفوظة قريبة من هذه الفكرة في مكتب المصادر الشخصي.</p>}
          </div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3" data-editorial-scenarios="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">محاكاة القرار</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 grid gap-2 border-t border-hair pt-3">{decision.scenarios.items.map((scenario) => <div key={scenario.id} className="grid gap-1 border-b border-hair py-2 last:border-0"><div className="flex items-baseline justify-between gap-4"><strong className={scenario.preferred ? 'text-[.78rem] text-accent' : 'text-[.78rem] text-ink'}>{scenario.label}{scenario.preferred ? ' · المسار المفضّل' : ''}</strong><span className="text-[.72rem] text-soft">{editorialScoreLabel(scenario.strength)}</span></div><p className="text-[.72rem] leading-relaxed text-soft">{scenario.explanation}</p></div>)}</div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">محامي الشيطان</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3"><p className="text-[.82rem] font-semibold leading-relaxed text-ink">{decision.devilAdvocate.objection}</p><p className="mt-2 text-[.78rem] leading-relaxed text-soft">{decision.devilAdvocate.answer}</p></div>
        </details>
        <details className="group rounded-xl border border-hair bg-canvas px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="font-semibold text-ink">الخطة المقترحة</span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
          <div className="mt-3 border-t border-hair pt-3">
            <p className="text-[.72rem] font-semibold text-accent">العنوان الذي يرشحه المجلس</p><p className="mt-1 font-display text-xl font-semibold leading-relaxed text-ink">{decision.plan.primaryTitle}</p>
            {decision.plan.alternatives.length > 0 && <div className="mt-3 grid gap-1">{decision.plan.alternatives.map((title) => <p key={title} className="text-[.76rem] leading-relaxed text-soft">بديل · {title}</p>)}</div>}
            <p className="mt-4 text-[.8rem] leading-relaxed text-ink"><strong>الأطروحة:</strong> {decision.plan.thesis}</p>
            <p className="mt-2 text-[.78rem] leading-relaxed text-soft"><strong className="text-ink">القناة:</strong> {decision.plan.channel} · <strong className="text-ink">الطول:</strong> {decision.plan.expectedLength}</p>
            <div className="mt-4 grid gap-2">{decision.plan.outline.map((line, index) => <p key={line} className="text-[.76rem] leading-relaxed text-soft"><span className="me-2 font-semibold text-accent">{index + 1}</span>{line}</p>)}</div>
          </div>
        </details>
      </div>

      {decision.waitingRoom && <div className="mt-5 rounded-xl border border-hair bg-canvas px-4 py-3"><p className="text-[.72rem] font-semibold text-accent">غرفة الانتظار التحريرية</p><p className="mt-1 text-[.8rem] leading-relaxed text-ink">{decision.waitingRoom.reason}</p><p className="mt-2 text-[.74rem] leading-relaxed text-soft">إشارة العودة: {decision.waitingRoom.trigger}</p></div>}
      {!decision.evidenceGate.ready && <div className="mt-5 rounded-xl border border-accent/[.35] bg-canvas px-4 py-3" data-editorial-evidence-gate="needs-evidence"><p className="text-[.72rem] font-semibold text-accent">ملاحظة ترافق المسودة — ولا تعطلها</p><p className="mt-1 text-[.8rem] leading-relaxed text-ink">{decision.evidenceGate.explanation}</p>{decision.evidenceGate.missing.map((item) => <p key={item} className="mt-1 text-[.74rem] leading-relaxed text-soft">{item}</p>)}</div>}

      <div className="mt-6 flex flex-wrap gap-3">
        {canStart && <button type="button" disabled={busy} className={primary} onClick={() => onStart(decision)}>{busy ? 'أكتب المقال…' : decision.evidenceGate.ready ? 'ابدأ المقال' : 'ابدأ المقال وسجّل الملاحظة'}</button>}
        {decision.verdict === 'update_existing' && decision.archiveCourt.nearest.some((item) => item.kind === 'article') && <button type="button" className={primary} onClick={() => onOpenExisting(decision)}>افتح المقال السابق للتحديث</button>}
        {decision.verdict === 'reject' && <span className="text-[.78rem] leading-relaxed text-soft">لم يُنشئ المجلس مسودة؛ الرفض قرار تحريري محفوظ وليس حذفاً للفكرة.</span>}
        {decision.verdict === 'wait' && <span className="text-[.78rem] leading-relaxed text-soft">حُفظت الفكرة تلقائياً في سجل المجلس مع موعد إعادة المراجعة.</span>}
      </div>
    </section>
  )
}

function EvidenceChainCard({ chain }: { chain: ReturnType<typeof buildEvidenceChain> }) {
  const sourceById = new Map(chain.sources.map((source) => [source.id, source]))
  return (
    <details className={`${card} group`} data-evidence-chain="true">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span><span className="block text-[.72rem] font-semibold text-accent">سلسلة الدليل الخاصة</span><span className="mt-1 block text-[.76rem] text-soft">{chain.claims.length ? `تغطية ${chain.coverage}/100 · ${arabicCountPhrase(chain.claims.length, CLAIM_FORMS)}` : 'لا توجد ادعاءات قابلة للربط في النص الحالي'}</span></span>
        <span className="text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-hair pt-4">
        {chain.alerts.map((alert) => <p key={alert} className="rounded-xl border border-accent/30 bg-canvas px-3 py-2 text-[.7rem] leading-relaxed text-accent">{alert}</p>)}
        {chain.claims.map((claim) => <div key={claim.id} className="border-b border-hair pb-3 last:border-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><p className="max-w-3xl text-[.74rem] leading-relaxed text-ink">{claim.text}</p><span className="shrink-0 text-[.64rem] font-semibold text-soft">{claim.support === 'strong' ? 'دعم قوي' : claim.support === 'partial' ? 'دعم جزئي' : 'لا سند مرتبط بعد'}</span></div>{claim.sourceIds.length > 0 && <p className="mt-1 text-[.64rem] leading-relaxed text-soft">{claim.sourceIds.map((id) => sourceById.get(id)?.title || id).join(' · ')}</p>}</div>)}
        {!chain.claims.length && <p className="text-[.72rem] leading-relaxed text-soft">تُبنى السلسلة تلقائياً من النسخة النهائية والمصادر الخاصة والأبحاث المرتبطة، من دون نشر بياناتها للزوار.</p>}
      </div>
    </details>
  )
}

function QualityGateCard({ gate }: { gate: ReturnType<typeof qualityGate> }) {
  if (!gate.evaluated) {
    return (
      <section className={card} data-quality-gate-state="empty">
        <p className="text-[.76rem] font-semibold uppercase text-accent">بوابة جودة قبل النشر</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-ink">لم تُقيّم المسودة بعد.</h2>
        <p className="mt-3 text-[.82rem] leading-relaxed text-soft">اكتب عنواناً ونصاً أولياً؛ تبدأ الأرقام والقرارات بعد ٤٠ كلمة حتى لا تُعرض نتيجة وهمية لمسودة فارغة.</p>
      </section>
    )
  }
  return (
    <section className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">بوابة جودة قبل النشر</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">{gate.ready ? 'جاهز للاعتماد.' : 'يحتاج انتباه قبل النشر.'}</h2>
      <div className="mt-4 grid gap-2">
        {gate.checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-3">
            <span className="text-[.84rem] text-ink">{check.label}</span>
            <span className={`text-[.78rem] font-semibold ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : 'يحتاج ضبط'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/* مقياس البصمة الحيّ: يقيس ما في المحرّر الآن بالمسطرة نفسها التي يقيس بها
   الخادم — فيرى الدكتور أثر كل تعديلٍ يكتبه على مطابقته لأسلوبه لحظةَ كتابته. */
/* غرفة المرشحَين: المرشح الثاني كُتب فعلاً ودُفع ثمنه من الحصة، وكان يُرمى.
   الآن يراه الدكتور بدرجته وبنيته ونموذجه، ويختار. */
function CandidateRoom({ alternates, onAdopt }: {
  alternates: NonNullable<PerfectArticleResponse['alternates']>
  onAdopt: (alternate: NonNullable<PerfectArticleResponse['alternates']>[number]) => void
}) {
  if (!alternates.length) return null
  return (
    <section className={card} data-candidate-room="true">
      <p className="text-[.76rem] font-semibold uppercase text-accent">نسخةٌ ثانية بين يديك</p>
      <p className="mt-2 text-[.8rem] leading-relaxed text-soft">
        كُتبت في اللحظة نفسها ببنيةٍ أخرى ونموذجٍ آخر، ومقيسةٌ بالمسطرة نفسها. اقرأها؛ إن كانت أقرب إليك فاعتمدها.
      </p>
      <div className="mt-4 grid gap-4">
        {alternates.map((alternate, index) => (
          <article key={`${alternate.structure}-${index}`} className="rounded-xl border border-hair bg-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="font-display text-[1rem] leading-relaxed text-ink">{alternate.title}</strong>
              <span className="rounded-full border border-accent/30 bg-accent/[.06] px-3 py-1 font-display text-[.9rem] text-accent">{alternate.score}٪</span>
            </div>
            <p className="mt-1 text-[.7rem] text-soft">{alternate.structure} · {arabicCountPhrase(alternate.words, WORD_PLAIN_FORMS)} · أصالة {alternate.originality}٪ · {alternate.model}</p>
            <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-line text-[.84rem] leading-loose text-soft">{alternate.body}</p>
            <button type="button" className={`${ghost} mt-4`} onClick={() => onAdopt(alternate)}>اعتمد هذه النسخة</button>
          </article>
        ))}
      </div>
    </section>
  )
}

/* أشِر إلى الجملة لا إلى المقياس: «وقفات … ٧ والمعتاد ٢٢» رقمٌ صحيح لا يدلّ
   على موضع. هذه تعرض الجملة نفسها، وتصلح فقرتها وحدها بنداءٍ واحد بدل شراء
   مقالٍ كامل من حصةٍ يومية محدودة. */
function IssueMap({ issues, busy, onRepair }: {
  issues: { sentence: string; reason: string; kind: string }[]
  busy: string
  onRepair: (sentence: string, reason: string) => void
}) {
  if (!issues.length) return null
  const label: Record<string, string> = {
    banned: 'ليست من لغتك', orthography: 'إملاء', evidence: 'بلا سند',
    verbatim: 'منقولة من أرشيفك', repeat: 'مكرّرة', long: 'أطول من عادتك',
  }
  return (
    <section className={card} data-issue-map="true">
      <p className="text-[.76rem] font-semibold uppercase text-accent">أين بالضبط</p>
      <h2 className="mt-1 font-display text-xl font-semibold text-ink">{issues.length} موضعاً يستحق نظرة</h2>
      <p className="mt-2 text-[.78rem] leading-relaxed text-soft">
        لا رقماً يقول «الوقفات قليلة»… بل الجملة نفسها. وإصلاحُ فقرتها وحدها يكلّف نداءً واحداً بدل مقالٍ كامل.
      </p>
      <div className="mt-4 grid gap-2">
        {issues.map((issue, index) => (
          <div key={index} className="rounded-xl border border-hair bg-canvas px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border border-accent/30 px-2.5 py-0.5 text-[.68rem] text-accent">{label[issue.kind] || issue.kind}</span>
              <span className="text-[.72rem] text-soft">{issue.reason}</span>
            </div>
            <p className="mt-2 text-[.84rem] leading-loose text-ink">{issue.sentence}</p>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => onRepair(issue.sentence, issue.reason)}
              className="mt-3 rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy === issue.sentence ? 'يُعاد تحرير فقرتها…' : 'أصلح فقرتها وحدها'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

/* مصحّح الصوت: يقرأ الدكتور فقرةً فيقول «هذه ليست أنا»، فتدخل عباراتُها
   الغريبة عن أرشيفه في قائمة منعٍ دائمة. تعلُّمٌ بلا تدريب ولا اشتراك. */
function VoiceTeacher({ body, memory, onTeach, onForget }: {
  body: string
  memory: string[]
  onTeach: (paragraph: string) => void
  onForget: () => void
}) {
  const paragraphs = body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  if (paragraphs.length < 2) return null
  return (
    <section className={card} data-voice-teacher="true">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">علّمه صوتك</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">أشِر إلى ما ليس منك</h2>
        </div>
        {memory.length > 0 && <span className="text-[.72rem] text-soft">تعلّم {memory.length} عبارة</span>}
      </div>
      <p className="mt-2 text-[.78rem] leading-relaxed text-soft">
        البصمة مقيسةٌ من أرشيفك — وهو ماضيك. هذه تُبنى من حكمك الآن: كل فقرةٍ ترفضها تُستخرج منها العباراتُ الغريبة عن أرشيفك وتُمنع في كل مقالٍ قادم.
      </p>
      <div className="mt-4 grid gap-2">
        {paragraphs.map((paragraph, index) => (
          <div key={index} className="flex items-start gap-3 rounded-xl border border-hair bg-canvas px-4 py-3">
            <p className="min-w-0 flex-1 text-[.82rem] leading-loose text-soft line-clamp-3">{paragraph}</p>
            <button type="button" onClick={() => onTeach(paragraph)} className="shrink-0 rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft transition-colors hover:border-accent hover:text-accent">ليست أنا</button>
          </div>
        ))}
      </div>
      {memory.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer list-none text-[.76rem] text-accent">ما تعلّمه منك ({memory.length}) — اضغط لتراه</summary>
          <p className="mt-2 text-[.78rem] leading-loose text-soft">{memory.map((item) => `«${item}»`).join(' · ')}</p>
          <button type="button" className={`${ghost} mt-3`} onClick={onForget}>امسح ما تعلّمه وابدأ من جديد</button>
        </details>
      )}
    </section>
  )
}

/* بصمتك كما قِيست: ما تعلّمه المحرك عنك من أرشيفك، بالأرقام. ليس زينةً —
   هذه هي المسطرة نفسها التي يُحاكَم بها كل نصٍّ يُكتب باسمه. */
function FingerprintPanel({ dna }: { dna: ReturnType<typeof measureStyleDna> }) {
  if (!dna) return null
  const rows: [string, string][] = [
    ['طول المقال', `${dna.article.p25}–${dna.article.p90} كلمة (وسيطك ${arabicCountPhrase(dna.article.median, WORD_PLAIN_FORMS)})`],
    ['وسيط الجملة', `${arabicCountPhrase(dna.sentence.median, WORD_PLAIN_FORMS)} · ${dna.sentence.shortRate}٪ من جملك تسع فأقل`],
    ['وقفات «…»', `${dna.marks.ellipsisPerArticle} في المقال · في ${dna.moves.articlesWithEllipsis}٪ من مقالاتك`],
    ['الانقلاب «بل»', `في ${dna.moves.articlesWithAntithesis}٪ من مقالاتك`],
    ['الأسئلة', `${dna.marks.questionsPerArticle} في المقال · في ${dna.moves.articlesWithQuestion}٪ منها`],
    ['الفقرة', `وسيط ${arabicCountPhrase(dna.paragraph.median, WORD_PLAIN_FORMS)} · ${dna.paragraph.singleSentenceRate}٪ منها جملة واحدة`],
    ['الخاتمة', `${dna.closings.questionRate}٪ سؤال · ${dna.closings.antithesisRate}٪ انقلاب بـ«بل»`],
    ['أكثر ما تبدأ به', (dna.openers || []).slice(0, 6).map((item) => item.word).join(' · ')],
  ]
  return (
    <details className="mt-4 group" data-fingerprint-panel="true">
      <summary className="cursor-pointer list-none text-[.76rem] text-accent">بصمتك كما قِيست من {arabicCountPhrase(dna.sampleSize, ARTICLE_AFTER_PREPOSITION_FORMS)} — اضغط لتراها</summary>
      <div className="mt-3 grid gap-2">
        {rows.filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 rounded-xl border border-hair bg-canvas px-4 py-2.5">
            <span className="shrink-0 text-[.76rem] font-semibold text-ink">{label}</span>
            <span className="text-end text-[.76rem] leading-relaxed text-soft">{value}</span>
          </div>
        ))}
      </div>
    </details>
  )
}

/* أربعون ثانية من الصمت تجعل الدكتور يظن أن شيئاً تعطّل. هذه تقول له الحقيقة
   وحدها: كم مضى، وماذا يجري فعلاً في الخادم — بلا مراحل مخترعة. */
function GenerationProgress({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - startedAt) / 1_000))
  const stage = seconds < 45
    ? 'نسختان تُكتبان الآن من نموذجين مختلفين وبنيتين مختلفتين…'
    : seconds < 100
      ? 'الحَكَم يقيس النسختين على بصمتك، ويعيد أرقام النقص إلى المحرك…'
      : 'جولة تصحيحٍ موجّهة ثم تدقيقٌ لغويّ أخير…'
  return (
    <div className={`${card} border-accent/30`} data-generation-progress="true">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[.82rem] font-semibold text-ink">{stage}</p>
        <span className="shrink-0 font-display text-[1.1rem] text-accent">{seconds}ث</span>
      </div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-hair">
        <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${Math.min(96, seconds / 1.5)}%` }} />
      </div>
      <p className="mt-3 text-[.76rem] leading-relaxed text-soft">
        لا يُسلَّم نصٌّ باسمك قبل أن يجتاز الأسلوب والإسناد والتكرار والإملاء. وإن عجز المحرك قال لك ذلك، ولم يخترع مقالاً.
      </p>
    </div>
  )
}

function StyleFidelityCard({ verdict, sampleSize, dna }: { verdict: StyleVerdict | null; sampleSize: number; dna: ReturnType<typeof measureStyleDna> }) {
  if (!verdict) return <section className={card} data-style-fidelity="idle">
    <p className="text-[.76rem] font-semibold uppercase text-accent">مطابقة أسلوبك</p>
    <p className="mt-2 text-[.8rem] leading-relaxed text-soft">اكتب مئةً وعشرين كلمة فأكثر، أو ولّد المقال، وستظهر درجة المطابقة هنا لحظةً بلحظة.</p>
    <FingerprintPanel dna={dna} />
  </section>
  const tone = verdict.score >= 88 ? 'text-accent' : verdict.score >= 78 ? 'text-ink' : 'text-soft'
  const weakest = [...verdict.checks].filter((check) => check.grade < .8).sort((left, right) => left.grade - right.grade).slice(0, 3)
  return (
    <section className={card} data-style-fidelity="true">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">مطابقة أسلوبك</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{verdict.ready ? 'داخل مدى مقالاتك' : 'خارج مدى مقالاتك'}</h2>
        </div>
        <span className={`rounded-full border border-accent/30 bg-accent/[.06] px-4 py-2 font-display text-xl ${tone}`}>{verdict.score}٪</span>
      </div>
      <p className="mt-2 text-[.76rem] leading-relaxed text-soft">المسطرة مقيسة على {arabicCountPhrase(sampleSize, PUBLISHED_ARTICLE_AFTER_PREPOSITION_FORMS)} لك؛ وسيط مقالاتك نفسها ٨٧٪.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          ['وقفات «…»', verdict.metrics.ellipsis],
          ['«بل»', verdict.metrics.antithesis],
          ['أسئلة', verdict.metrics.questions],
          ['وسيط الجملة', verdict.metrics.medianSentence],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-hair bg-canvas px-3 py-2 text-center">
            <strong className="block font-display text-lg text-accent">{value}</strong>
            <span className="text-[.68rem] text-soft">{label}</span>
          </div>
        ))}
      </div>
      {verdict.fatal.length > 0 && (
        <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">{verdict.fatal.join(' · ')}</p>
      )}
      {verdict.corrections.length > 0 && (
        /* الحَكَم يكتب أسباب النقص بعربيةٍ واضحة ثم لا تُعرض ولا مرة —
           كان الدكتور يرى الدرجة ولا يرى لماذا. */
        <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[.04] px-4 py-3">
          <p className="text-[.74rem] font-semibold text-accent">ما ينقص هذا النص ليصير نصّك</p>
          <ul className="mt-2 grid gap-1.5">
            {verdict.corrections.slice(0, 4).map((line, index) => (
              <li key={index} className="text-[.8rem] leading-relaxed text-soft">· {line}</li>
            ))}
          </ul>
        </div>
      )}
      <FingerprintPanel dna={dna} />
      {weakest.length > 0 && (
        <div className="mt-4 grid gap-2">
          {weakest.map((check) => (
            <div key={check.key} className="rounded-xl border border-hair bg-canvas px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[.82rem] font-semibold text-ink">{check.label}</span>
                <span className="text-[.74rem] text-soft">{check.actual} · المعتاد {check.wanted}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hair">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(check.grade * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function StyleEditorCard({ review }: { review: ReturnType<typeof styleReview> }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">المحرر الذي يعرفك</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">{review.label}</h2>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/[.06] px-4 py-2 font-display text-xl text-accent">{review.score}٪</span>
      </div>
      <div className="mt-4 grid gap-2">
        {review.checks.map((check) => (
          <div key={check.label} className="rounded-xl border border-hair bg-canvas px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[.84rem] font-semibold text-ink">{check.label}</span>
              <span className={`text-[.78rem] font-semibold ${check.ok ? 'text-accent' : 'text-soft'}`}>{check.ok ? '✓' : 'راجع'}</span>
            </div>
            <p className="mt-1 text-[.76rem] leading-relaxed text-soft">{check.note}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SignalRow({ signal }: { signal: EditorialSignal }) {
  return (
    <div className="rounded-xl border border-hair bg-canvas px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[.82rem] font-semibold leading-relaxed text-ink">{signal.label}</p>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[.66rem] font-semibold ${statusTone[signal.status]}`}>{signalLabel[signal.status]}</span>
      </div>
      <p className="mt-1 text-[.74rem] leading-relaxed text-soft">{signal.detail}</p>
    </div>
  )
}

function withHashtagsOnce(text: string, hashtags: string[]) {
  const cleanText = text.trim()
  const existing = new Set((cleanText.match(/#[\p{L}\p{N}_]+/gu) || []).map((tag) => normalize(tag)))
  const missing = hashtags.filter((tag, index, all) => (
    all.findIndex((candidate) => normalize(candidate) === normalize(tag)) === index
    && !existing.has(normalize(tag))
  ))
  return missing.length ? `${cleanText}\n\n${missing.join(' ')}` : cleanText
}

function EditorialDecisionRoom({ suite }: { suite: ReturnType<typeof buildEditorialDecisionSuite> }) {
  if (!suite.evaluated) {
    return (
      <section className={card} data-editorial-decision-state="empty">
        <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة القرار قبل النشر</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink">لم يبدأ التقييم.</h2>
        <p className="mt-3 max-w-3xl text-[.82rem] leading-relaxed text-soft">تظهر العدسات الأربع ودرجاتها بعد وجود مسودة فعلية من ٤٠ كلمة على الأقل؛ لا حكم ولا نسبة على صفحة فارغة.</p>
      </section>
    )
  }
  const metrics = [
    { label: 'قرار النشر', value: suite.decisionScore, note: suite.decision },
    { label: 'مؤشر الصمت', value: suite.silenceScore, note: suite.silenceSummary },
    { label: 'الحضور الرقمي', value: suite.digitalScore, note: suite.digitalDecision },
    { label: 'الذاكرة الأخلاقية', value: suite.ethicalScore, note: suite.ethicalDecision },
  ]
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">غرفة القرار قبل النشر</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">قرار واحد… وأربع عدسات هادئة.</h2>
          <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">هذه الغرفة لا تنشر ولا تغيّر النص وحدها؛ فقط تكشف ما يحتاج قرارك قبل نقل المقال إلى المكتبة.</p>
        </div>
        <span className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.72rem] text-soft">{arabicCountPhrase(suite.words, WORD_PLAIN_FORMS)}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-hair bg-canvas p-4">
            <span className="text-[.72rem] font-semibold text-soft">{metric.label}</span>
            <strong className="mt-2 block font-display text-3xl font-semibold text-accent">{metric.value}٪</strong>
            <p className="mt-2 text-[.74rem] leading-relaxed text-soft">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <details className="rounded-2xl border border-hair bg-wash p-4" open>
          <summary className="cursor-pointer list-none font-semibold text-ink">محرّك القرار قبل النشر</summary>
          <div className="mt-4 grid gap-2">
            {suite.decisionSignals.map((signal) => <SignalRow key={signal.label} signal={signal} />)}
          </div>
        </details>
        <details className="rounded-2xl border border-hair bg-wash p-4">
          <summary className="cursor-pointer list-none font-semibold text-ink">مؤشر الصمت</summary>
          {suite.silent.length ? (
            <div className="mt-4 grid gap-2">
              {suite.silent.slice(0, 4).map((item) => (
                <div key={item.label} className="rounded-xl border border-hair bg-canvas px-4 py-3">
                  <p className="text-[.82rem] font-semibold text-ink">{item.label}</p>
                  <p className="mt-1 text-[.74rem] leading-relaxed text-soft">{item.prompt}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-soft">لا توجد فجوة صامتة واضحة في المسودة الحالية.</p>
          )}
        </details>
        <details className="rounded-2xl border border-hair bg-wash p-4">
          <summary className="cursor-pointer list-none font-semibold text-ink">غرفة اعتماد الحضور الرقمي</summary>
          <div className="mt-4 grid gap-2">
            {suite.digitalSignals.map((signal) => <SignalRow key={signal.label} signal={signal} />)}
          </div>
        </details>
        <details className="rounded-2xl border border-hair bg-wash p-4">
          <summary className="cursor-pointer list-none font-semibold text-ink">الذاكرة الأخلاقية للموقع</summary>
          <div className="mt-4 grid gap-2">
            {suite.ethicalSignals.map((signal) => <SignalRow key={signal.label} signal={signal} />)}
            <p className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.74rem] leading-relaxed text-soft">ذاكرة الكتب الخاصة: {suite.privateMemory}</p>
          </div>
        </details>
      </div>
    </section>
  )
}

function PrivateBookMemoryCard({ matches }: { matches: ReturnType<typeof privateBookMatches> }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة الكتب الخاصة</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-ink">ربط داخلي لا يظهر للناس.</h2>
        </div>
        <span className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] text-soft">خاص باللوحة فقط</span>
      </div>
      <p className="mt-3 text-[.82rem] leading-relaxed text-soft">
        لا يعرض PDF ولا نصوص الكتب. يظهر لك فقط أن المسودة قريبة من كتاب أو محور خاص حتى تستثمر أرشيفك بأمان.
      </p>
      {matches.length ? (
        <div className="mt-4 grid gap-2">
          {matches.map((book) => (
            <div key={book.title} className="rounded-xl border border-hair bg-canvas px-4 py-3">
              <p className="font-semibold leading-relaxed text-ink">قريب من «{book.title}»</p>
              <p className="mt-1 text-[.76rem] leading-relaxed text-soft">
                {book.section
                  ? `${book.section.label || 'محور خاص'}${book.section.pages ? ` · الصفحات ${book.section.pages}` : book.section.page ? ` · ص ${book.section.page}` : ''}`
                  : 'محور عام من الكتاب'}
                {book.section?.keywords?.length ? ` · ${book.section.keywords.slice(0, 4).join('، ')}` : ''}
              </p>
              {book.linkedPublicBook && (
                <p className="mt-1 text-[.74rem] text-soft">يرتبط أيضاً بالكتاب المنشور: {book.linkedPublicBook.title}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] leading-relaxed text-soft">
          لم أجد رابطاً واثقاً مع الكتب الخاصة لهذه المسودة بعد. زِد وضوح الفكرة أو شغّل ذاكرة الكتب بعد إضافة PDFs جديدة.
        </p>
      )}
    </section>
  )
}

function WeeklyPackCard({
  pack,
  campaign,
  onSave,
  busy,
}: {
  pack: WeeklyPack
  campaign: TransformingCampaign
  onSave: () => void
  busy: boolean
}) {
  const all = [
    ...pack.linkedin.map((text, index) => `LinkedIn ${index + 1}:\n${text}`),
    ...pack.x.map((text, index) => `X ${index + 1}:\n${text}`),
    ...pack.generalX.map((text, index) => `X عام ${index + 1}:\n${text}`),
    `Instagram:\n${pack.instagram}`,
    `سؤال تفاعلي:\n${pack.question}`,
    `اقتباس:\n${pack.quote}`,
    ...(pack.radarComment ? [`تعليق على حدث راهن:\n${pack.radarComment}`] : []),
    ...campaign.stages.map((item) => `اليوم ${item.day} · ${item.platform} · ${item.role}\n${item.goal}\n${item.copy}\n\nالتسليم لليوم التالي: ${item.handoff}`),
  ].join('\n\n---\n\n')
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">مخرج الحملة المتحوّلة</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">فكرة واحدة تسافر سبعة أيام.</h2>
          <p className="mt-2 max-w-2xl text-[.82rem] leading-relaxed text-soft">{campaign.promise} تماسك الرحلة {campaign.continuityScore}٪، ولا يُنشر شيء قبل موافقتك.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={all} label="نسخ الكل" />
          <button type="button" className={primary} disabled={busy} onClick={onSave}>{busy ? 'أحفظ…' : 'حفظ في طابور الموافقة'}</button>
        </div>
      </div>
      <details className="group mt-5 rounded-2xl border border-hair bg-canvas p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-ink"><span>افتح خط الرحلة والترابط بين أيامها</span><span className="text-accent transition-transform group-open:rotate-45">＋</span></summary>
        <ol className="mt-4 grid gap-3">
          {campaign.stages.map((item, index) => (
            <li key={`${item.day}-${item.platform}`} className="grid gap-3 rounded-xl border border-hair bg-wash p-4 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-accent">اليوم {item.day}<span className="mt-1 block text-[.68rem] font-normal text-soft">{item.platform}</span></p>
              </div>
              <div className="min-w-0"><p className="text-[.76rem] font-semibold text-ink">{item.role} · {item.goal}</p>{index > 0 && <p className="mt-1 text-[.7rem] leading-relaxed text-accent">يرث ما قبله: {item.carriesFrom}</p>}<p className="mt-3 whitespace-pre-wrap text-[.82rem] leading-relaxed text-ink">{item.copy}</p><p className="mt-3 border-t border-hair pt-2 text-[.7rem] leading-relaxed text-soft">إشارة القرار: {item.decisionSignal}<br />التسليم: {item.handoff}</p></div>
              <CopyButton value={item.copy} />
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

function PublicationPassportCard({ passport }: { passport: PublicationPassportDraft }) {
  const rows = [
    ['text', 'النص'],
    ['audio', 'الصوت'],
    ['design', 'التصميم'],
    ['social', 'التغريدات'],
    ['sources', 'المصادر'],
  ] as const
  return (
    <details className="group mt-4 rounded-2xl border border-hair bg-canvas p-4" data-publication-passport="preview">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><strong className="block text-[.78rem] text-ink">جواز النشر السيادي</strong><span className="mt-1 block text-[.7rem] leading-relaxed text-soft">بصمة واحدة للنص والصوت والتصميم والتغريدات والمصادر؛ يوقّعها الخادم عند النقل، ويعيد توقيعها قبل أي نشر عام.</span></span><span className={`shrink-0 rounded-full px-3 py-1.5 text-[.68rem] font-bold ${passport.releaseReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{passport.releaseReady ? 'مكتمل' : arabicCountPhrase(passport.blocking.length, PENDING_ITEM_FORMS)}</span></summary>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-hair pt-4 sm:grid-cols-5">{rows.map(([key, label]) => { const state = passport.components[key].status; return <div key={key} className="rounded-xl border border-hair bg-wash px-3 py-2 text-center"><span className={`block text-[.68rem] font-bold ${state === 'verified' ? 'text-emerald-700' : state === 'review' ? 'text-amber-700' : 'text-soft'}`}>{state === 'verified' ? '✓ مثبت' : state === 'review' ? '◐ مراجعة' : '○ معلّق'}</span><span className="mt-1 block text-[.7rem] text-ink">{label}</span></div> })}</div>
      <div className={`mt-3 rounded-xl border px-3 py-3 ${passport.semanticCourt.status === 'passed' ? 'border-emerald-200 bg-emerald-50/70' : passport.semanticCourt.status === 'blocked' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`} data-semantic-court={passport.semanticCourt.status}>
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[.72rem] text-ink">محكمة المعنى متعددة الوسائط</strong><span className={`text-[.68rem] font-bold ${passport.semanticCourt.status === 'passed' ? 'text-emerald-700' : passport.semanticCourt.status === 'blocked' ? 'text-red-700' : 'text-amber-800'}`}>{passport.semanticCourt.score}٪ · {passport.semanticCourt.status === 'passed' ? 'مجتازة' : passport.semanticCourt.status === 'blocked' ? 'أوقفت النشر' : passport.semanticCourt.status === 'review' ? 'مراجعة' : 'بانتظار الطبقات'}</span></div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{Object.values(passport.semanticCourt.chambers).map((chamber) => <span key={chamber.label} className={`text-[.64rem] ${chamber.status === 'passed' ? 'text-emerald-700' : chamber.status === 'blocked' ? 'text-red-700' : 'text-soft'}`}>{chamber.status === 'passed' ? '✓' : chamber.status === 'blocked' ? '✕' : '○'} {chamber.label}</span>)}</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-2" data-adversarial-misunderstanding={passport.semanticCourt.adversarialSimulation.status}>
          <span className="text-[.64rem] font-semibold text-ink">محاكي سوء الفهم العدائي</span>
          <span className={`text-[.64rem] font-bold ${passport.semanticCourt.adversarialSimulation.status === 'passed' ? 'text-emerald-700' : passport.semanticCourt.adversarialSimulation.status === 'blocked' ? 'text-red-700' : 'text-amber-800'}`}>{passport.semanticCourt.adversarialSimulation.score}٪ · {passport.semanticCourt.adversarialSimulation.highRiskCount ? `${passport.semanticCourt.adversarialSimulation.highRiskCount} خطر مرتفع` : passport.semanticCourt.adversarialSimulation.status === 'passed' ? 'محصن' : 'يحتاج تحصين'}</span>
        </div>
        {passport.semanticCourt.adversarialSimulation.scenarios[0] && <p className="mt-1 text-[.62rem] leading-relaxed text-soft">أسوأ اقتطاع محتمل: {passport.semanticCourt.adversarialSimulation.scenarios[0].attack}</p>}
        <p className="mt-2 text-[.64rem] leading-relaxed text-soft">حارس العنوان · عهد التحفّظات · سلسلة نسب الادعاء. الخادم يعيد الحساب قبل التوقيع؛ لا يعتمد على شارة الواجهة.</p>
        {passport.semanticCourt.alerts.length > 0 && <p className="mt-2 text-[.64rem] leading-relaxed text-soft">أول تنبيه: {passport.semanticCourt.alerts[0]}</p>}
      </div>
      {!passport.releaseReady && <p className="mt-3 text-[.7rem] leading-relaxed text-soft">المعلّق: {passport.blocking.join('، ')}. الجواز لا يدّعي اكتمال ما ليس موجوداً؛ يسجل حالته بدقة، والنشر العام يتطلب اكتماله أو تجاوزاً تحريرياً مسبباً وموقعاً.</p>}
    </details>
  )
}

function ImpactMirrorInline({
  mirror,
  busy,
  onSave,
}: {
  mirror: EditorialImpactMirror
  busy: boolean
  onSave: (text: string, source: ImpactObservationSource) => Promise<void>
}) {
  const [text, setText] = useState('')
  const [source, setSource] = useState<ImpactObservationSource>('comment')
  const labels: Record<EditorialImpactMirror['status'], string> = {
    'awaiting-observations': 'بانتظار شاهد فهم',
    preliminary: 'قراءة أولية',
    aligned: 'النية وصلت',
    mixed: 'أثر مختلط',
    drift: 'المعنى انزاح',
  }
  const save = async () => {
    if (text.trim().length < 12) return
    await onSave(text, source)
    setText('')
  }
  return (
    <details className="group mt-2 rounded-lg border border-hair bg-wash px-3 py-2" data-impact-mirror={mirror.status}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-[.68rem] font-semibold text-ink">مرآة الأثر · {labels[mirror.status]}</span>
        <span className={`text-[.64rem] font-bold ${mirror.status === 'aligned' ? 'text-emerald-700' : mirror.status === 'drift' ? 'text-red-700' : 'text-soft'}`}>{mirror.semanticScore == null ? arabicCountPhrase(mirror.counts.total, EVIDENCE_FORMS) : `${mirror.semanticScore}٪ · ${arabicCountPhrase(mirror.counts.total, EVIDENCE_FORMS)}`}</span>
      </summary>
      <div className="mt-3 grid gap-3 border-t border-hair pt-3">
        <p className="text-[.64rem] leading-relaxed text-soft">الانتشار لا يساوي الفهم. الأرقام تقيس الوصول والفعل، ومحاذاة المعنى لا تحسب إلا من صياغة مجهلة تسجلها هنا بلا أسماء أو أرقام أو روابط.</p>
        {(mirror.resonance.metrics.views != null || mirror.resonance.score != null) && <div className="flex flex-wrap gap-x-4 gap-y-1 text-[.62rem] text-soft"><span>وصول: {mirror.resonance.metrics.views ?? '—'}</span><span>مشاركة: {mirror.resonance.metrics.shares ?? '—'}</span><span>انتقال تال: {mirror.resonance.metrics.onwardJourneys ?? '—'}</span><span>اكتمال صوت: {mirror.resonance.listenCompletion ?? '—'}{mirror.resonance.listenCompletion != null ? '٪' : ''}</span></div>}
        {mirror.observations.slice(-3).reverse().map((item) => <div key={item.id} className="rounded-lg border border-hair bg-canvas px-3 py-2"><div className="flex items-center justify-between gap-3"><span className="text-[.62rem] font-semibold text-ink">{item.assessment.status === 'aligned' ? 'المعنى وصل' : item.assessment.status === 'partial' ? 'وصل جزئيا' : 'انزياح يحتاج مراجعة'}</span><span className="text-[.6rem] text-soft">{item.assessment.score}٪</span></div><p className="mt-1 text-[.66rem] leading-relaxed text-soft">{item.text}</p></div>)}
        {mirror.reopenRecommended && <p className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-[.66rem] leading-relaxed text-red-700">تقترح المرآة إعادة فتح المادة في مجلس التحرير لتصحيح ما وصل، لا لمطاردة رقم المشاهدة.</p>}
        <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
          <select className="rounded-lg border border-hair bg-canvas px-3 py-2 text-[.68rem] text-ink" value={source} onChange={(event) => setSource(event.target.value as ImpactObservationSource)}>{IMPACT_SOURCE_LABELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          <input className="rounded-lg border border-hair bg-canvas px-3 py-2 text-[.68rem] text-ink outline-none focus:border-accent" value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب كيف أعاد القارئ الفكرة بكلماته — بلا اسم…" />
          <button type="button" className="rounded-full border border-accent/[.35] px-3 py-2 text-[.66rem] font-semibold text-accent disabled:opacity-50" disabled={busy || text.trim().length < 12} onClick={() => void save()}>{busy ? 'أحفظ…' : 'سجل الشاهد'}</button>
        </div>
      </div>
    </details>
  )
}


function CurrentEventsCard({
  items,
  selected,
  loading,
  onToggle,
  opportunities = [],
}: {
  items: CurrentEvent[]
  selected: string[]
  loading: boolean
  onToggle: (id: string) => void
  opportunities?: OpportunityRadarItem[]
}) {
  const kuwait = items.filter((item) => /kuwait|kuna|times kuwait|الكويت/i.test(`${item.source} ${item.title}`))
  const rest = items.filter((item) => !kuwait.some((local) => local.id === item.id))
  const shown = [...kuwait, ...rest].slice(0, 8)
  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-[.76rem] font-semibold uppercase text-accent">أحداث الساعة</span>
          <span className="mt-1 block font-display text-xl font-semibold text-ink">يربط الحدث فقط عندما يخدم الفكرة.</span>
          <span className="mt-1 block text-[.8rem] leading-relaxed text-soft">{loading ? 'أحدّث المصادر…' : opportunities.length ? arabicCountPhrase(opportunities.length, OPPORTUNITY_FORMS) : selected.length ? arabicCountPhrase(selected.length, EVENT_FORMS) : items.length ? 'لا تطابق أرشيفياً موثقاً الآن' : 'لا توجد إشارة راهنة مناسبة الآن'}</span>
        </span>
        <span className="flex items-center gap-2">
          {selected.length > 0 && <span className="rounded-full border border-hair px-3 py-1 text-[.7rem] text-soft">{selected.length} محدد</span>}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
        </span>
      </summary>
      <div className="mt-5 border-t border-hair pt-5">
        {opportunities.length > 0 && <div className="mb-5 grid gap-3" data-opportunity-radar="verified">{opportunities.map((opportunity) => <article key={opportunity.id} className="rounded-2xl border border-accent/[.35] bg-accent/[.04] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[.72rem] font-bold text-accent">رادار اللحظة المناسبة · ثقة {opportunity.confidence}٪</span><span className="text-[.68rem] text-soft">صلة {opportunity.breakdown.topical} · حداثة {opportunity.breakdown.recency} · دليل {opportunity.breakdown.evidence}</span></div><a href={opportunity.event.url} target="_blank" rel="noreferrer" className="mt-2 block font-display text-[.96rem] font-semibold leading-relaxed text-ink hover:text-accent">{opportunity.event.title}</a><p className="mt-2 text-[.76rem] leading-relaxed text-soft">{opportunity.whyNow}</p><a href={`/articles/${opportunity.article.slug}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-[.76rem] font-semibold text-accent hover:underline">المادة التي استيقظت: {opportunity.article.title} ↗</a></article>)}</div>}
        <p className="mb-4 text-[.78rem] leading-relaxed text-soft">لا يقترح الرادار إحياء مادة إلا برابط مصدر، وتوقيت معلوم، وتطابق دلالي يتجاوز {opportunities[0]?.threshold || 78}٪. ما دون ذلك يظل حدثاً للقراءة فقط.</p>
        {items.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((item) => {
              const active = selected.includes(item.id)
              const local = kuwait.some((candidate) => candidate.id === item.id)
              return (
                <article key={item.id} className={`rounded-2xl border p-4 text-right transition-colors ${active ? 'border-accent bg-accent/[.06]' : 'border-hair bg-canvas hover:border-accent'}`}>
                  <button type="button" onClick={() => onToggle(item.id)} className="block w-full text-right">
                    <span className="flex items-center justify-between gap-2 text-[.7rem] font-semibold text-accent"><span>{local ? `رادار الكويت · ${item.source}` : item.source}</span><span>{item.ageHours != null ? `قبل ${item.ageHours} س` : 'حديث'}</span></span>
                    <span className="mt-2 line-clamp-2 block font-display text-[.96rem] font-semibold leading-[1.55] text-ink">{item.title}</span>
                    <span className="mt-3 block text-[.72rem] text-soft">{active ? 'مثبّت للربط ✓' : 'اضغط لتثبيته'}</span>
                  </button>
                  <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[.7rem] font-semibold text-accent hover:underline">فتح المصدر ↗</a>
                </article>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">{loading ? 'أقرأ المصادر الموثوقة الآن…' : 'لا يوجد حدث راهن مناسب لهذه الفكرة، وهذا أفضل من ربط مصطنع.'}</p>
        )}
      </div>
    </details>
  )
}

function standaloneVisualTemplates(idea: string, purpose: string): SocialVisualTemplate[] {
  const title = idea.trim() || 'الفكرة لا تحتاج مقالاً كي تستحق النشر.'
  const body = purpose.trim() || 'اكتب الجملة، واختر القالب، ثم نزّل الصورة الجاهزة للنشر.'
  const topic = detectVisualTopic(`${title} ${body}`)
  const shared = { platform: 'instagram' as const, width: 1080, height: 1350, topic, title, body, footer: 'dr-alfailakawi.com' }
  // المكتبة الكاملة: التكوينات الستة الموقّعة أولاً، ثم كل تخطيطات المحرك بلا إسقاط.
  const all: { key: string; layout: SocialVisualTemplate['layout']; kicker: string }[] = [
    { key: 'midad', layout: 'question', kicker: 'المداد' },
    { key: 'layl', layout: 'dark', kicker: 'الليل' },
    { key: 'jarida', layout: 'editorial', kicker: 'الجريدة' },
    { key: 'sharit', layout: 'split', kicker: 'الشريط' },
    { key: 'mishkat', layout: 'arch', kicker: 'المشكاة' },
    { key: 'tawqee', layout: 'signature', kicker: 'التوقيع' },
    { key: 'madar', layout: 'orbit', kicker: 'المدار' },
    { key: 'ishara', layout: 'signal', kicker: 'الإشارة' },
    { key: 'nafidha', layout: 'window', kicker: 'النافذة' },
    { key: 'bayan', layout: 'manifesto', kicker: 'البيان' },
    { key: 'hadath', layout: 'event', kicker: 'الحدث' },
    { key: 'zaman', layout: 'timeline', kicker: 'الزمن' },
    { key: 'iqtibas', layout: 'quote', kicker: 'الاقتباس' },
    { key: 'daira', layout: 'circuit', kicker: 'الدارة' },
    { key: 'daftar', layout: 'notebook', kicker: 'الدفتر' },
    { key: 'insan', layout: 'human', kicker: 'الإنسان' },
    { key: 'burhan', layout: 'research', kicker: 'البرهان' },
    { key: 'ufuq', layout: 'horizon', kicker: 'الأفق' },
    { key: 'hiwar', layout: 'dialogue', kicker: 'الحوار' },
    { key: 'masfufa', layout: 'matrix', kicker: 'المصفوفة' },
    { key: 'tabaqat', layout: 'layers', kicker: 'الطبقات' },
    { key: 'buraa', layout: 'focus', kicker: 'البؤرة' },
    { key: 'mawja', layout: 'wave', kicker: 'الموجة' },
    { key: 'mizan', layout: 'balance', kicker: 'الميزان' },
  ]
  const analysis = analyzeSocialCopy(`${title} ${body}`)
  const affinity: Record<string, SocialVisualTemplate['layout'][]> = {
    ai: ['circuit', 'dark', 'signal', 'matrix', 'orbit', 'split'],
    education: ['question', 'arch', 'notebook', 'editorial', 'layers', 'focus'],
    family: ['human', 'arch', 'question', 'window', 'signature', 'layers'],
    research: ['research', 'editorial', 'timeline', 'matrix', 'notebook', 'split'],
    media: ['dialogue', 'wave', 'signal', 'event', 'split', 'quote'],
    future: ['horizon', 'orbit', 'manifesto', 'balance', 'circuit', 'timeline'],
    human: ['human', 'signature', 'focus', 'quote', 'window', 'dialogue'],
    general: ['editorial', 'question', 'signature', 'focus', 'horizon', 'balance'],
  }
  const shapeAffinity: Record<typeof analysis.shape, SocialVisualTemplate['layout'][]> = {
    question: ['question', 'focus', 'window', 'arch', 'dialogue'],
    contrast: ['balance', 'split', 'layers', 'dialogue', 'manifesto'],
    number: ['matrix', 'research', 'signal', 'timeline', 'notebook'],
    sequence: ['timeline', 'layers', 'notebook', 'matrix', 'event'],
    call: ['manifesto', 'signature', 'horizon', 'dark', 'focus'],
    definition: ['editorial', 'notebook', 'research', 'window', 'quote'],
    statement: ['editorial', 'focus', 'signature', 'horizon', 'human'],
  }
  const preferredTopic = affinity[topic] || affinity.general
  const preferredShape = shapeAffinity[analysis.shape]
  const rank = (layout: SocialVisualTemplate['layout']) => {
    const shapeIndex = preferredShape.indexOf(layout)
    const topicIndex = preferredTopic.indexOf(layout)
    const shapeScore = shapeIndex === -1 ? 80 : shapeIndex * 4
    const topicScore = topicIndex === -1 ? 20 : topicIndex
    return shapeScore + topicScore
  }
  return [...all]
    .sort((left, right) => rank(left.layout) - rank(right.layout))
    .map((item) => ({ ...shared, id: `standalone-${item.key}-${title}`, format: 'منشور مستقل 1080×1350', layout: item.layout, kicker: item.kicker }))
}

function VisualTemplateCard({ template }: { template: SocialVisualTemplate }) {
  /* المعاينة هي الصورة الحقيقية المرسومة بمحرك «الطبعة الفاخرة» نفسه —
     ما تراه هنا هو ملف PNG الذي سيُنزَّل حرفياً، لا تقليد CSS تقريبي. */
  const [previewUrl, setPreviewUrl] = useState('')
  const [renderError, setRenderError] = useState('')
  const [renderNonce, setRenderNonce] = useState(0)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setPreviewUrl('')
    setRenderError('')
    void renderSocialPng(template)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((reason) => {
        /* الفشل الصامت («أرسم القالب…» للأبد) حرمنا من معرفة السبب عند الدكتور —
           الآن البطاقة تنطق بالخطأ وتعرض إعادة المحاولة */
        if (active) setRenderError(reason instanceof Error ? reason.message : 'تعذّر رسم القالب في هذا المتصفح')
      })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [template, renderNonce])
  return (
    <div className="overflow-hidden rounded-2xl border border-hair bg-canvas">
      <div className="social-visual-preview relative overflow-hidden bg-wash" style={{ aspectRatio: `${template.width} / ${template.height}` }}>
        {previewUrl
          ? <img src={previewUrl} alt={template.title} draggable={false} className="h-full w-full select-none object-cover" />
          : renderError
            ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-[.72rem] leading-relaxed text-soft">{renderError}</p>
                <button type="button" onClick={() => setRenderNonce((n) => n + 1)} className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-accent transition-colors hover:border-accent">إعادة الرسم</button>
              </div>
            )
            : <div className="flex h-full w-full items-center justify-center text-[.74rem] text-soft">أرسم القالب…</div>}
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <span className="text-[.72rem] text-soft"><span className="font-semibold text-accent">{compositionNameOf(template.layout)}</span> · {template.format}</span>
        <button type="button" onClick={() => void downloadSocialPng(template)} className="rounded-full border border-hair px-3 py-1.5 text-[.72rem] font-semibold text-accent transition-colors hover:border-accent">تنزيل PNG</button>
      </div>
    </div>
  )
}

function ProfessionalStandaloneDesignCard({ plan, rank }: { plan: CompositionPlan; rank: number }) {
  const [draftPlan, setDraftPlan] = useState<CompositionPlan>(plan)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoPct, setVideoPct] = useState(0)
  useEffect(() => setDraftPlan(plan), [plan.id, plan.fingerprint])

  const patchContent = (patch: Partial<CompositionPlan['content']>) => {
    setDraftPlan((current) => ({ ...current, content: { ...current.content, ...patch } }))
  }
  const patchSlide = (index: number, patch: Partial<CompositionPlan['content']['slides'][number]>) => {
    setDraftPlan((current) => ({
      ...current,
      content: {
        ...current.content,
        slides: current.content.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide),
      },
    }))
  }
  const svg = useMemo(() => renderCompositionSvg(draftPlan), [draftPlan])
  const [livingIconOn] = useLivingIconEnabled()
  const preview = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg])
  const release = useMemo(() => professionalReleaseGate(draftPlan), [draftPlan])
  const tier = release.tier === 'masterpiece'
    ? 'Masterpiece'
    : release.tier === 'professional'
      ? 'Professional'
      : release.tier === 'publishable'
        ? 'Publishable'
        : 'Needs direction'
  const fields: { key: keyof Pick<CompositionPlan['content'], 'kicker' | 'title' | 'subtitle' | 'body' | 'quote' | 'heroWord' | 'cta' | 'author' | 'source'>; label: string; rows?: number }[] = [
    { key: 'kicker', label: 'الشارة / نوع المادة' },
    { key: 'title', label: 'العنوان', rows: 2 },
    { key: 'subtitle', label: 'العنوان الفرعي', rows: 2 },
    { key: 'body', label: 'النص / الشرح', rows: 3 },
    { key: 'quote', label: 'الاقتباس', rows: 3 },
    { key: 'heroWord', label: 'الكلمة البطلة' },
    { key: 'cta', label: 'الدعوة — مثل «اقرأ المادة كاملة»' },
    { key: 'author', label: 'الاسم / التوقيع' },
    { key: 'source', label: 'المصدر / الرابط' },
  ]
  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-hair bg-canvas shadow-[0_16px_46px_rgba(15,23,42,.06)]">
      <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: `${draftPlan.format.width} / ${draftPlan.format.height}` }}>
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        {livingIconOn && <LivingMetaphorIcon plan={draftPlan} />}
        <MovableWordsLayer plan={draftPlan} />
        <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/55 px-2.5 py-1 text-[.56rem] font-black uppercase tracking-[.08em] text-white backdrop-blur">{tier}</span>
      </div>
      <div className="p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">{livingIconOn && <LivingIconPicker plan={draftPlan} />}<MoveWordsToggle /></div>
        <div className="flex items-start justify-between gap-3">
          <div><span className="text-[.58rem] font-bold text-accent">رؤية {rank}</span><strong className="mt-1 block text-[.78rem] text-ink">{draftPlan.directionLabel}</strong></div>
          <span className={`rounded-full px-2.5 py-1 text-[.6rem] font-black ${release.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{release.score}٪</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <span className="rounded-lg bg-paper px-2 py-2 text-[.55rem] text-soft"><strong className="block text-[.68rem] text-ink">{release.metrics.craft}</strong>الحرفة</span>
          <span className="rounded-lg bg-paper px-2 py-2 text-[.55rem] text-soft"><strong className="block text-[.68rem] text-ink">{release.metrics.briefFidelity}</strong>فهم العبارة</span>
          <span className="rounded-lg bg-paper px-2 py-2 text-[.55rem] text-soft"><strong className="block text-[.68rem] text-ink">{release.metrics.distinctiveness}</strong>الأصالة</span>
        </div>

        <details className="group mt-3 rounded-xl border border-hair bg-paper" data-standalone-text-editor="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[.66rem] font-semibold text-accent [&::-webkit-details-marker]:hidden">
            <span>تحرير كل الكلمات الظاهرة في هذا التصميم</span><span className="text-soft transition group-open:rotate-45">＋</span>
          </summary>
          <div className="grid gap-2 border-t border-hair p-3">
            <p className="text-[.6rem] leading-relaxed text-soft">أي حقل تتركه فارغاً يختفي من التصميم. التغيير خاص بهذه الرؤية فقط ولا يمس المقال أو الفكرة الأصلية.</p>
            {fields.map(({ key, label, rows = 1 }) => {
              const value = String(draftPlan.content[key] || '')
              const originalValue = String(plan.content[key] || '')
              return (
                <label key={key} className="grid gap-1 rounded-lg border border-hair bg-canvas p-2.5 text-[.6rem] text-soft">
                  <span className="flex items-center justify-between gap-2"><strong className="text-ink">{label}</strong><span className="flex gap-1"><button type="button" onClick={() => patchContent({ [key]: '' } as Partial<CompositionPlan['content']>)} className="rounded-full border border-hair px-2 py-0.5 text-[.54rem] hover:border-red-300 hover:text-red-600">إخفاء</button>{value !== originalValue && <button type="button" onClick={() => patchContent({ [key]: originalValue } as Partial<CompositionPlan['content']>)} className="rounded-full border border-hair px-2 py-0.5 text-[.54rem] hover:border-accent hover:text-accent">استعادة</button>}</span></span>
                  {rows > 1
                    ? <textarea rows={rows} className={`${input} min-h-0 resize-y px-3 py-2 text-[.72rem]`} value={value} onChange={(event) => patchContent({ [key]: event.target.value } as Partial<CompositionPlan['content']>)} />
                    : <input className={`${input} px-3 py-2 text-[.72rem]`} value={value} onChange={(event) => patchContent({ [key]: event.target.value } as Partial<CompositionPlan['content']>)} />}
                </label>
              )
            })}
            {draftPlan.content.points?.length ? <label className="grid gap-1 rounded-lg border border-hair bg-canvas p-2.5 text-[.6rem] text-soft"><strong className="text-ink">نقاط الإنفوجرافيك — سطر لكل نقطة</strong><textarea rows={Math.min(6, Math.max(3, draftPlan.content.points.length))} className={`${input} min-h-0 resize-y px-3 py-2 text-[.72rem]`} value={draftPlan.content.points.join('\n')} onChange={(event) => patchContent({ points: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} /></label> : null}
            {draftPlan.content.slides.length > 1 && <details className="rounded-lg border border-hair bg-canvas"><summary className="cursor-pointer list-none px-3 py-2 text-[.6rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">نصوص شرائح الكاروسيل ({draftPlan.content.slides.length})</summary><div className="grid gap-2 border-t border-hair p-2">{draftPlan.content.slides.map((slide, index) => <div key={slide.id} className="grid gap-1 rounded-lg bg-paper p-2"><span className="text-[.56rem] font-semibold text-accent">شريحة {index + 1}</span><input className={`${input} px-2.5 py-1.5 text-[.68rem]`} value={slide.kicker} onChange={(event) => patchSlide(index, { kicker: event.target.value })} placeholder="الشارة" /><textarea rows={2} className={`${input} min-h-0 resize-y px-2.5 py-1.5 text-[.68rem]`} value={slide.title} onChange={(event) => patchSlide(index, { title: event.target.value })} placeholder="العنوان" /><textarea rows={2} className={`${input} min-h-0 resize-y px-2.5 py-1.5 text-[.68rem]`} value={slide.body} onChange={(event) => patchSlide(index, { body: event.target.value })} placeholder="النص" /></div>)}</div></details>}
            <button type="button" className={`${ghost} justify-self-start text-[.62rem]`} onClick={() => setDraftPlan(plan)}>استعادة نصوص المخرج الأصلية</button>
          </div>
        </details>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => void downloadCompositionRaster(draftPlan, 'png')} disabled={!release.ready} className={`${release.ready ? primary : ghost} flex-1 text-[.7rem]`}>{release.ready ? 'تنزيل PNG (ثابت)' : 'محجوب حتى يجتاز البوابة'}</button>
          {designVideoSupported() && (
            <button
              type="button"
              disabled={!release.ready || videoBusy}
              title={designHasMotion(draftPlan) ? 'يسجّل التصميم بأيقونته المتحركة فيديو MP4/WebM' : 'فعّل الأيقونة الحيّة أولاً كي يظهر فيها حركة'}
              onClick={async () => { setVideoBusy(true); setVideoPct(0); try { await downloadDesignVideo(draftPlan, { onProgress: (r) => setVideoPct(Math.round(r * 100)) }) } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذّر تصدير الفيديو') } finally { setVideoBusy(false) } }}
              className={`${release.ready ? ghost : ghost} flex-1 text-[.7rem]`}
            >{videoBusy ? `يسجّل… ${videoPct}%` : '🎬 فيديو متحرّك'}</button>
          )}
        </div>
      </div>
    </article>
  )
}

function PerfectSocialPackCard({
  pack,
  article,
  busy,
  onRegenerate,
  onSave,
  saveBusy,
}: {
  pack: PerfectSocialPack
  article: { title: string; excerpt: string }
  busy: boolean
  onRegenerate: () => void
  onSave: () => void
  saveBusy: boolean
}) {
  const visuals = buildSocialVisuals(pack, article)
  const standaloneDesigns = useMemo(
    () => standaloneVisualTemplates(article.title, article.excerpt),
    [article.title, article.excerpt],
  )
  return (
    <div className="grid gap-5">
      <section className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">منظومة السوشيال · {visuals.topicLabel}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">كل موضوع يتعرّف على لغته البصرية.</h2>
            <p className="mt-2 text-[.82rem] leading-relaxed text-soft">يقرأ النظام الفكرة أولاً، ثم يختار تكوينات تناسب التعليم أو التكنولوجيا أو الأسرة أو البحث أو الإعلام أو المستقبل — مع تنويع جديد في كل مرة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeof pack.qualityScore === 'number' && <span className={`rounded-full border px-3 py-2 text-[.7rem] font-bold ${pack.qualityScore >= 86 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>بوابة الذكاء والجمال {pack.qualityScore}٪</span>}
            <button type="button" disabled={busy} onClick={onRegenerate} className={ghost}>{busy ? 'أعيد البناء…' : 'تنويع جديد'}</button>
            <button type="button" disabled={saveBusy} onClick={onSave} className={primary}>{saveBusy ? 'أحفظ…' : 'حفظ الحزمة'}</button>
          </div>
        </div>
        {pack.qualityChecks?.length ? <p className="mt-3 text-[.7rem] leading-relaxed text-soft">فحص التسليم: {pack.qualityChecks.slice(0, 4).join(' · ')}</p> : null}
        {pack.event && (
          <a href={pack.event.url} target="_blank" rel="noreferrer" className="mt-5 block rounded-2xl border border-accent/30 bg-accent/[.05] p-4 transition-colors hover:border-accent">
            <span className="text-[.72rem] font-semibold text-accent">ربط راهن موثق · {pack.event.source}</span>
            <span className="mt-2 block font-display text-[1rem] font-semibold text-ink">{pack.event.title}</span>
            {pack.eventHook && <span className="mt-2 block text-[.8rem] leading-relaxed text-soft">{pack.eventHook}</span>}
          </a>
        )}
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">قوالب Instagram الجاهزة</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visuals.instagram.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
        </div>
      </section>

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">Story وLinkedIn وX</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <VisualTemplateCard template={visuals.linkedin} />
          <VisualTemplateCard template={visuals.x} />
          {visuals.stories.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
        </div>
      </section>

      {/* ٢٢ تكويناً كانت مبنيةً كاملةً في standaloneVisualTemplates ولا يستدعيها
          أحد — فبقي الدكتور يرى ثلاثة تصاميم ويظن المكتبة فقيرة. وُصلت هنا:
          المداد · الليل · الجريدة · الشريط · المشكاة · التوقيع · المدار …
          مرتّبةً بحسب شكل الفكرة وموضوعها لا عشوائياً. */}
      {standaloneDesigns.length > 0 && (
        <section className={card}>
          <p className="text-[.76rem] font-semibold uppercase text-accent">مكتبة التكوينات · {standaloneDesigns.length} تصميماً</p>
          <h3 className="mt-1 font-display text-xl font-semibold text-ink">اختر ما يليق بالفكرة — كلها بهويتك.</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {standaloneDesigns.map((template) => <VisualTemplateCard key={template.id} template={template} />)}
          </div>
        </section>
      )}

      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">النصوص حسب المنصة</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pack.x.map((text, index) => <SocialCard key={`x-perfect-${index}`} title={`X · صيغة ${index + 1}`} text={text} />)}
          {pack.linkedin.map((text, index) => <SocialCard key={`li-perfect-${index}`} title={`LinkedIn · صيغة ${index + 1}`} text={text} />)}
          {pack.instagramCaptions.map((text, index) => <SocialCard key={`ig-perfect-${index}`} title={`Instagram · Caption ${index + 1}`} text={withHashtagsOnce(text, pack.hashtags)} />)}
          {(pack.facebook || []).map((text, index) => <SocialCard key={`fb-perfect-${index}`} title={`فيسبوك · صيغة ${index + 1}`} text={text} />)}
          {pack.threads.map((text, index) => <SocialCard key={`th-perfect-${index}`} title={`Threads · صيغة ${index + 1}`} text={text} />)}
          <SocialCard title="Reel · 45–60 ثانية" text={pack.reelScript} />
          <SocialCard title="WhatsApp" text={pack.whatsapp} />
          <SocialCard title="النشرة البريدية" text={pack.newsletter} />
        </div>
      </section>
    </div>
  )
}

export function PublishingStudio({ articles, onTransferToArticles, initialView = 'idea' }: { articles: ArticleRecord[]; onTransferToArticles?: (slug: string) => void | Promise<void>; initialView?: PublishingStudioView }) {
  const { isAdmin, refresh, user } = useAdminAuth()
  const [richArticles, setRichArticles] = useState<ArticleRecord[]>(articles)
  const [radar, setRadar] = useState<RadarItem[]>([])
  const [idea, setIdea] = useState('الذكاء الاصطناعي في التعليم')
  const [audience, setAudience] = useState('المعلمين والقيادات التعليمية')
  const [angle, setAngle] = useState('الأثر الإنساني قبل بريق الأداة')
  const [bundle, setBundle] = useState<Bundle>(() => buildBundle(idea, audience, angle, articles))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [queueBusy, setQueueBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [socialGenerating, setSocialGenerating] = useState(false)
  const [targetWords, setTargetWords] = useState(MIN_ARTICLE_WORDS)
  const [targetWordsInput, setTargetWordsInput] = useState(String(MIN_ARTICLE_WORDS))
  const generationRun = useRef(0)
  const socialVariation = useRef(0)
  const pulseVariation = useRef(0)
  const [skipOriginality, setSkipOriginality] = useState(false)
  const [currentEvents, setCurrentEvents] = useState<CurrentEvent[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  /* تبويب «تغريدات ومنشورات» يفتح الاستوديو على المسار السريع مباشرة بدل أن
     يبحث الدكتور عن خطوةٍ جانبية داخل رحلة المقال. */
  const [view, setView] = useState<PublishingStudioView>(initialView)
  const [proposalMode, setProposalMode] = useState<'self' | 'received'>('self')
  const voicedArticles = useMemo(
    () => richArticles.filter((article) => Boolean((audioCatalog as Record<string, unknown>)[article.slug])),
    [richArticles],
  )
  const snoozeWaitingIdea = async (decisionId: string, days = 7) => {
    const until = new Date(Date.now() + days * 86_400_000).toISOString()
    setEditorialSnoozeById((current) => ({ ...current, [decisionId]: until }))
    try {
      const db = await getDb()
      if (!db) return
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'admin_editorial_board', decisionId), { snoozeUntil: until }, { merge: true })
    } catch { /* التأجيل المحلي قائم؛ الحفظ السحابي يُعاد مع أي جلسة تالية */ }
  }

  const adoptSavedIdea = (decision: EditorialBoardDecision) => {
    setIdea(decision.idea)
    setEditorialDecision(null)
    setNotice(`حُمّلت فكرة «${decision.idea.slice(0, 60)}» من سجل المجلس — اعرضها عليه الآن برادار اليوم.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* مقترحات القراء بنقرة (فكرة المجلس ٢): رسائل صندوق الوارد تدخل «مقترح
     وصلني» بمصدرها وسياقها تلقائياً — قراءة فقط، ولا تُحذف الرسالة. */
  const loadInboxSuggestions = async () => {
    if (inboxSuggestionsBusy) return
    setInboxSuggestionsBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('no-db')
      const { collection, getDocs, limit, query } = await import('firebase/firestore')
      const snapshot = await getDocs(query(collection(db, 'messages'), limit(40)))
      const rows = snapshot.docs.map((item) => {
        const data = item.data() as Record<string, unknown>
        return {
          id: item.id,
          name: String(data.name || data.email || 'قارئ'),
          topic: String(data.topic || ''),
          message: String(data.message || data.body || ''),
          at: Date.parse(String(data.createdAt || data.receivedAt || '')) || 0,
        }
      }).filter((row) => row.message.trim().length >= 12)
        .sort((left, right) => right.at - left.at)
        .slice(0, 12)
      setInboxSuggestions(rows)
    } catch {
      setInboxSuggestions([])
    } finally {
      setInboxSuggestionsBusy(false)
    }
  }

  const adoptInboxSuggestion = (row: { name: string; topic: string; message: string }) => {
    const seed = row.topic.trim() || row.message.split(/(?<=[.!؟?])\s+/)[0] || row.message
    setProposalMode('received')
    setProposalSourceType('reader')
    setProposalSourcePerson(row.name.slice(0, 80))
    setProposalSourceContext(`من صندوق الوارد: ${row.message.slice(0, 220)}`)
    setIdea(seed.slice(0, 300))
    setEditorialDecision(null)
    setInboxSuggestionsOpen(false)
    setNotice('التُقط المقترح من صندوق الوارد بمصدره — اعرضه على المجلس.')
  }
  const [proposalSourcePerson, setProposalSourcePerson] = useState('')
  const [proposalSourceType, setProposalSourceType] = useState<EditorialSourceType>('friend')
  const [proposalSourceContext, setProposalSourceContext] = useState('')
  const [editorialDecision, setEditorialDecision] = useState<EditorialBoardDecision | null>(null)
  const [editorialHistory, setEditorialHistory] = useState<EditorialBoardDecision[]>([])
  const [editorialCalibrationProfile, setEditorialCalibrationProfile] = useState<EditorialCalibrationProfile>({ sampleSize: 0, strengthBias: 0, articlePotentialBias: 0 })
  const [editorialCalibrationByDecision, setEditorialCalibrationByDecision] = useState<Record<string, EditorialCalibrationRecord>>({})
  const [editorialImpactMirrorByDecision, setEditorialImpactMirrorByDecision] = useState<Record<string, EditorialImpactMirror>>({})
  const [impactMirrorBusyId, setImpactMirrorBusyId] = useState('')
  const [editorialProgress, setEditorialProgress] = useState<EditorialProgress>('idle')
  /* أفكار المجلس الخمس (٣١ يوليو): جرس غرفة الانتظار، مقترحات الوارد بنقرة،
     والجلسة الأسبوعية — كلها قراءة محلية فوق السجل المحفوظ، بلا نشر تلقائي. */
  const [editorialSnoozeById, setEditorialSnoozeById] = useState<Record<string, string>>({})
  const [inboxSuggestions, setInboxSuggestions] = useState<Array<{ id: string; name: string; topic: string; message: string }>>([])
  const [inboxSuggestionsBusy, setInboxSuggestionsBusy] = useState(false)
  const [inboxSuggestionsOpen, setInboxSuggestionsOpen] = useState(false)
  const [weeklySessionOpen, setWeeklySessionOpen] = useState(false)
  /* جرس غرفة الانتظار (فكرة المجلس ١): قرارات «انتظر» التي بلغ موعد مراجعتها
     ولم يؤجلها الدكتور بيده — تُعرض عند فتح مرحلة الفكرة بلا أي إيقاظ خفي. */
  const dueWaitingIdeas = useMemo(() => {
    const now = Date.now()
    return editorialHistory.filter((decision) => {
      if (decision.verdict !== 'wait' || !decision.waitingRoom?.reviewAt) return false
      const review = Date.parse(decision.waitingRoom.reviewAt) || 0
      if (!review || review > now) return false
      const snooze = Date.parse(editorialSnoozeById[decision.id] || '') || 0
      return snooze <= now
    }).slice(0, 6)
  }, [editorialHistory, editorialSnoozeById])
  /* الجلسة الأسبوعية (فكرة المجلس ٥): آخر الأفكار المحفوظة دفعةً واحدة —
     مستحقات الانتظار أولاً ثم الأقوى درجةً؛ عرضٌ مرتب لا إعادة حكم خفية. */
  const weeklySessionRows = useMemo(() => {
    const seen = new Set<string>()
    const unique = editorialHistory.filter((decision) => {
      const key = decision.fingerprint || decision.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const dueIds = new Set(dueWaitingIdeas.map((decision) => decision.id))
    return unique
      .slice(0, 14)
      .sort((left, right) => (
        Number(dueIds.has(right.id)) - Number(dueIds.has(left.id))
        || (right.scores.strength ?? 0) - (left.scores.strength ?? 0)
      ))
  }, [editorialHistory, dueWaitingIdeas])
  const [editorialBusy, setEditorialBusy] = useState(false)
  const [personalSources, setPersonalSources] = useState<PersonalSourceRecord[]>([])
  const [intellectualAgenda, setIntellectualAgenda] = useState<IntellectualAgendaItem[]>([])
  const handleEditorialMemoryData = useCallback((data: { sources: PersonalSourceRecord[]; agenda: IntellectualAgendaItem[] }) => {
    setPersonalSources(data.sources)
    setIntellectualAgenda(data.agenda)
  }, [])

  const recordImpactObservation = async (decision: EditorialBoardDecision, observationText: string, source: ImpactObservationSource) => {
    const cleanText = observationText.trim()
    if (cleanText.length < 12 || impactMirrorBusyId) return
    setImpactMirrorBusyId(decision.id)
    setError('')
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثا قبل حفظ شاهد الأثر.')
      const current = editorialImpactMirrorByDecision[decision.id]
      const intent = current?.intent || {
        title: decision.plan.primaryTitle,
        thesis: decision.plan.thesis,
        protectedPoints: [decision.plan.thesis, ...decision.plan.outline.slice(0, 2)],
        caveats: decision.plan.doNotRepeat,
        expectedAction: decision.plan.outline.at(-1) || '',
        audience,
        fingerprintHash: decision.fingerprint,
      }
      const next = buildImpactMirror({
        intent,
        observations: [
          ...(current?.observations || []),
          { id: `impact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: cleanText, source, at: new Date().toISOString() },
        ],
        metrics: current?.resonance.metrics || {},
      })
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'admin_editorial_board', decision.id), { impactMirror: next, updatedAt: serverTimestamp() }, { merge: true })
      setEditorialImpactMirrorByDecision((previous) => ({ ...previous, [decision.id]: next }))
      setNotice(next.reopenRecommended ? 'سجلت المرآة انزياحا يستحق إعادة فتح المادة في مجلس التحرير.' : 'حفظت مرآة الأثر شاهد الفهم وربطته بالنية الأصلية.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذر حفظ شاهد الأثر.')
    } finally {
      setImpactMirrorBusyId('')
    }
  }

  // بذرة «حملة من مقال»: عند وصولها نفتح استوديو التصاميم فوراً، وعند وجودها
  // مخزنة (وصل الحدث قبل تركيب هذا المكوّن) نلتقطها في أول تركيب.
  useEffect(() => {
    /* بأمر الدكتور: أزيل التبويب المكرر — البذرة يوجهها Admin لتبويب الاستوديو المستقل */
    const openDesign = () => {}
    window.addEventListener('studio:campaign-seed', openDesign)
    try { localStorage.getItem('studio-campaign-seed') } catch { /* noop */ }
    return () => window.removeEventListener('studio:campaign-seed', openDesign)
  }, [])
  const [pulseIdea, setPulseIdea] = useState('')
  const [pulsePurpose, setPulsePurpose] = useState('')
  const [pulsePreviewCopy, setPulsePreviewCopy] = useState({ idea: '', purpose: '' })
  const [pulseAudience, setPulseAudience] = useState('الجمهور العام')
  const [pulsePack, setPulsePack] = useState<PerfectSocialPack | null>(null)
  /* عالم التصميم في المنشور المستقل: كسوةٌ للجوّ واللون فقط — وجه الخط العربي
     النظيف يبقى ثابتاً في الرؤى كلها بتوجيه الدكتور. */
  const [pulseWorld, setPulseWorld] = useState<DesignWorld | null>(null)
  const [pulseBusy, setPulseBusy] = useState(false)
  const [pulseQueueBusy, setPulseQueueBusy] = useState(false)
  const [pulseEvents, setPulseEvents] = useState<CurrentEvent[]>([])
  const [pulseSelectedEventIds, setPulseSelectedEventIds] = useState<string[]>([])
  const [pulseEventsLoading, setPulseEventsLoading] = useState(false)

  /* بذرةٌ قادمةٌ من استوديو التغريدات: تغريدةٌ اعتمدها الدكتور تُسلَّم هنا فتفتح
     «منشور مستقل» بنصها جاهزاً للتصميم. تُقرأ من الحدث وقت الوصول، ومن الخزن
     المحلي حين يسبق الحدثُ تركيبَ هذا المكوّن (انتقال تبويب). */
  useEffect(() => {
    const apply = (seed: { idea?: string; purpose?: string } | null) => {
      if (!seed?.idea) return
      setView('pulse')
      setPulseIdea(seed.idea)
      if (seed.purpose) setPulsePurpose(seed.purpose)
      try { localStorage.removeItem('studio-standalone-seed') } catch { /* noop */ }
    }
    const onSeed = (event: Event) => apply((event as CustomEvent).detail || null)
    window.addEventListener('studio:standalone-seed', onSeed)
    try {
      const stored = localStorage.getItem('studio-standalone-seed')
      if (stored) apply(JSON.parse(stored))
    } catch { /* بذرةٌ تالفة لا توقف الاستوديو */ }
    return () => window.removeEventListener('studio:standalone-seed', onSeed)
  }, [])

  /* غرفة د. أحمد لا تنسخ الاستوديو: تسلّمه بذرة المهمة فيفتح المسار القائم
     ومجلسه وذاكرته كما هما. */
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('admin:publishing-room-seed')
      if (!stored) return
      const seed = JSON.parse(stored) as { idea?: string; audience?: string; purpose?: string; openBoard?: boolean }
      if (seed.idea) setIdea(seed.idea)
      if (seed.audience) setAudience(seed.audience)
      if (seed.purpose) setAngle(seed.purpose.slice(0, 180))
      setEditorialDecision(null)
      setView('idea')
      sessionStorage.removeItem('admin:publishing-room-seed')
    } catch { /* بذرة تالفة لا توقف الاستوديو */ }
  }, [])

  /* المخرج الحي يسكن داخل الاستوديو، ويستقبل بذور غرفة د. أحمد وصفحة المقال
     ومجلس التحرير من دون إضافة تبويب رئيسي إلى لوحة التحكم أو الموقع العام. */
  useEffect(() => {
    const openDirector = () => setView('director')
    window.addEventListener('studio:live-director-seed', openDirector)
    try { if (sessionStorage.getItem('admin:live-director-seed')) setView('director') } catch { /* noop */ }
    return () => window.removeEventListener('studio:live-director-seed', openDirector)
  }, [])

  useEffect(() => {
    let active = true
    setRichArticles(articles)
    loadArticleBodies().then((bodies) => {
      if (!active) return
      setRichArticles(articles.map((article) => ({ ...article, body: article.body || bodies[article.slug] })))
    }).catch(() => undefined)
    return () => { active = false }
  }, [articles])

  useEffect(() => {
    if (!user) return
    let active = true
    void (async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { collection, getDocs, limit, orderBy, query } = await import('firebase/firestore')
        const snapshot = await getDocs(query(collection(db, 'admin_editorial_board'), orderBy('generatedAt', 'desc'), limit(100)))
        if (!active) return
        const rows = snapshot.docs.map((item) => item.data() as Record<string, any>)
        setEditorialHistory(rows.map((item) => item.decision).filter(Boolean).slice(0, 24) as EditorialBoardDecision[])
        setEditorialCalibrationProfile(editorialCalibrationProfileFromRows(rows, richArticles))
        /* تأجيلات غرفة الانتظار المحفوظة: يقرؤها الجرس فلا يزعج بما أجّله الدكتور بيده. */
        setEditorialSnoozeById(Object.fromEntries(rows.flatMap((item): Array<[string, string]> => {
          const decisionId = String((item.decision as EditorialBoardDecision | undefined)?.id || item.id || '')
          const snooze = String(item.snoozeUntil || '')
          return decisionId && snooze ? [[decisionId, snooze]] : []
        })))
        const calibrationEntries: Array<[string, EditorialCalibrationRecord]> = rows.flatMap((item): Array<[string, EditorialCalibrationRecord]> => {
          const decisionId = String((item.decision as EditorialBoardDecision | undefined)?.id || item.id || '')
          return decisionId && item.calibration ? [[decisionId, item.calibration as EditorialCalibrationRecord]] : []
        })
        setEditorialCalibrationByDecision(Object.fromEntries(calibrationEntries))
        const mirrorEntries: Array<[string, EditorialImpactMirror]> = rows.flatMap((item): Array<[string, EditorialImpactMirror]> => {
          const decisionId = String((item.decision as EditorialBoardDecision | undefined)?.id || item.id || '')
          return decisionId && item.impactMirror ? [[decisionId, item.impactMirror as EditorialImpactMirror]] : []
        })
        setEditorialImpactMirrorByDecision(Object.fromEntries(mirrorEntries))
      } catch {
        if (active) {
          setEditorialHistory([])
          setEditorialCalibrationProfile({ sampleSize: 0, strengthBias: 0, articlePotentialBias: 0 })
          setEditorialCalibrationByDecision({})
          setEditorialImpactMirrorByDecision({})
        }
      }
    })()
    return () => { active = false }
  }, [user])

  const style = useMemo(() => editorialStyleProfile(richArticles), [richArticles])
  const styleSamples = useMemo(() => representativeStyleSamples(richArticles, 6), [richArticles])
  /* البصمة الرقمية من الأرشيف الحيّ كاملاً: ما يقيسه الحَكَم على الخادم وما
     يُصقل به النص هنا. تُحسب مرة عند تحميل المتون لا في كل توليد. */
  /* نصوص الأرشيف تُجمَع مرةً واحدة وتُشارَك بين البصمة وحارس النقل الحرفي؛
     كانت تُبنى في كل قياس، والقياس نفسه ٢٣٠ مللي ثانية على الخيط الرئيسي. */
  /* التاريخ يُمرَّر مع المتن: البصمة تُرجَّح بالحقبة، فأسلوبه اليوم أثقل من
     أسلوب ٢٠١٧ — وقياسه أثبت أن العلامات انقلبت بينهما. */
  const archiveTexts = useMemo(() => richArticles.map((article) => ({ body: article.body || '', iso: article.iso || article.date || '' })), [richArticles])
  const measuredDna = useMemo(() => measureStyleDna(archiveTexts), [archiveTexts])
  /* ذاكرة الصوت: ما قال عنه الدكتور «هذه ليست أنا». تعيش محلياً فوراً،
     وتُزامَن مع Firestore إن سمحت القاعدة — فلا تتعطّل إن لم تُنشر بعد. */
  const [voiceExclusions, setVoiceExclusions] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dr-voice-exclusions') || '[]').slice(0, 60) } catch { return [] }
  })
  const styleDna = useMemo(() => withVoiceMemory(measuredDna, voiceExclusions), [measuredDna, voiceExclusions])
  /* معجم صوابه: كل صورةٍ كتبها ومرات ورودها — مرجعُ الإملاء بلا قاموسٍ يُنزَّل. */
  const orthography = useMemo(() => buildOrthographyIndex(archiveTexts), [archiveTexts])
  const [alternates, setAlternates] = useState<NonNullable<PerfectArticleResponse['alternates']>>([])
  const [generationStartedAt, setGenerationStartedAt] = useState(0)
  const [repairingSentence, setRepairingSentence] = useState('')
  /* المزامنة بين أجهزته: تُقرأ مرةً عند الفتح، وتُدمج مع المحلي ولا تدهسه. */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'admin_style_memory', 'voice'))
        const remote = snapshot.exists() ? (snapshot.data()?.exclusions as string[] | undefined) : undefined
        if (!alive || !Array.isArray(remote) || !remote.length) return
        setVoiceExclusions((previous) => {
          const merged = [...new Set([...previous, ...remote.filter((item) => typeof item === 'string')])].slice(-60)
          try { localStorage.setItem('dr-voice-exclusions', JSON.stringify(merged)) } catch { /* لا شيء يتعطّل */ }
          return merged
        })
      } catch { /* القاعدة لم تُنشر بعد: المحلي يكفي */ }
    })()
    return () => { alive = false }
  }, [])
  const [styleVerdict, setStyleVerdict] = useState<StyleVerdict | null>(null)
  /* المقياس الحيّ يتبع ما في المحرّر لا ما وُلّد: يكتب الدكتور سطراً فيرى أثره
     على مطابقته لبصمته فوراً. فحص النقل الحرفي يبقى لحظة التوليد وحدها لأنه
     يمسح الأرشيف كله. */
  /* الأرشيف يرافق القياس الحيّ: بدونه كان تحفّظ «نقلٌ حرفي» يُحسب مرةً واحدة
     عند التوليد ثم تحجبه البطاقة الحيّة فلا يراه أحد. ودون العتبة لا تُعرض
     درجةٌ قديمة لنصٍّ لم يعد موجوداً — البطاقة تختفي. */
  /* القياس على نصٍّ مهدَّأ لا على كل ضغطة مفتاح: مسحُ الأرشيف كله (النقل
     الحرفي والإسناد والإملاء) يكلّف ٦٦ مللي ثانية مقابل ٧ بدونه — أي تلعثمٌ
     محسوس أثناء الكتابة. نصف ثانيةٍ من السكون تكفي. */
  const [settledBody, setSettledBody] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setSettledBody(bundle.body), 500)
    return () => clearTimeout(timer)
  }, [bundle.body])
  /* ولا يُقارَن المقال بنفسه: حين يفتح الدكتور مقالاً منشوراً للتحرير، يُستثنى
     من أرشيف المقارنة بمعرّفه قبل أي قياس. */
  const comparisonArchive = useMemo(
    () => richArticles.filter((article) => article.slug !== bundle.slug).map((article) => ({ body: article.body || '', iso: article.iso || '' })),
    [richArticles, bundle.slug],
  )
  const liveStyleVerdict = useMemo(
    () => wordCount(settledBody) >= 120
      ? judgeStyle(settledBody, styleDna, { archive: comparisonArchive, sources: archiveTexts, orthography })
      : null,
    [settledBody, styleDna, archiveTexts, comparisonArchive, orthography],
  )
  const lab = useMemo(() => ideaLab(idea, richArticles, books, papers), [idea, richArticles])
  const privateLinks = (privateBookLinks as { books?: PrivateBookLink[] }).books || []
  /* المبدأ: **يُحاكَم المحرك، ولا يُحاكَم الكاتب.**

     قوائم المنع كلها — العبارات الآلية، وآثار القوالب، والنقل الحرفي، والإملاء
     — وُضعت لتصف ما يُمنع على النموذج. وحين طُبّقت على نصوصه هو حجبت ٢٨٪ من
     مقالاته المنشورة: ٢٣ منها لأنها تتقاطع بستّ كلماتٍ مع مقالٍ آخر له (وهذا
     كاتبٌ يعيد صياغة نفسه)، وتسعةٌ لأن فيها تعداداً أو شرطة، وسبعةٌ لعبارةٍ
     نادرة، وخمسةٌ لأنه قال «أرى أنّ» مرة.

     فالحجب الآن لما ولّده المحرك وحده. وما يكتبه الدكتور بيده يُقاس ويُعرض
     ولا يُمنع أبداً — أسلوبه هو تعريف أسلوبه. */
  const styleBlockers = useMemo(
    () => bundle.generatedBy ? (liveStyleVerdict?.fatal || []) : [],
    [liveStyleVerdict, bundle.generatedBy],
  )
  const gate = useMemo(() => qualityGate(bundle, richArticles, targetWords, skipOriginality, liveStyleVerdict?.score ?? null, styleBlockers), [bundle, richArticles, skipOriginality, targetWords, liveStyleVerdict, styleBlockers])
  const similarity = useMemo(() => articleSimilarityReport(bundle.title, bundle.body, richArticles), [bundle.title, bundle.body, richArticles])
  const editorialEvidenceChain = useMemo(() => buildEvidenceChain({
    slug: bundle.slug,
    title: bundle.title,
    body: bundle.body,
    personalSources,
    papers: papers as any,
    preferredPaperSlugs: bundle.papers.map((paper) => paper.slug),
  }), [bundle.body, bundle.papers, bundle.slug, bundle.title, personalSources])
  const meaningFingerprint = useMemo(() => buildMeaningFingerprint({
    slug: bundle.slug,
    title: bundle.title,
    body: bundle.body,
    excerpt: bundle.excerpt,
    thesis: editorialDecision?.plan.thesis,
    sourceIds: editorialEvidenceChain.sourceIds,
  }), [bundle.body, bundle.excerpt, bundle.slug, bundle.title, editorialDecision?.plan.thesis, editorialEvidenceChain.sourceIds])
  const opportunityRadar = useMemo(
    () => buildOpportunityRadar(currentEvents, richArticles, { threshold: 78, limit: 4 }),
    [currentEvents, richArticles],
  )
  const weeklyPack = useMemo(() => buildWeeklyPack(bundle, richArticles, opportunityRadar[0]), [bundle, opportunityRadar, richArticles])
  const styleInsight = useMemo(() => styleReview(bundle, style), [bundle, style])
  const sevenDayCampaign = useMemo(() => buildTransformingCampaign({ bundle, pack: weeklyPack }), [bundle, weeklyPack])
  const semanticCourtInput = useMemo(() => {
    const pack = bundle.socialPack
    const social: Array<{ id: string; channel: string; text: string }> = []
    const append = (channel: string, values: unknown) => {
      const list = Array.isArray(values) ? values : values ? [values] : []
      list.map(String).filter(Boolean).forEach((text, index) => social.push({ id: `${channel}-${index + 1}`, channel, text }))
    }
    if (pack) {
      append('X', pack.x); append('LinkedIn', pack.linkedin); append('Facebook', pack.facebook)
      append('Threads', pack.threads); append('Instagram', pack.instagramCaptions); append('Stories', pack.stories)
      append('Reel', pack.reelScript); append('WhatsApp', pack.whatsapp); append('Newsletter', pack.newsletter)
    } else Object.entries(bundle.social).forEach(([channel, value]) => append(channel, value))
    const designs = pack ? [
      ...pack.visualDirections.map((item, index) => ({ id: `direction-${index + 1}`, channel: 'اتجاه بصري', text: `${item.headline}\n${item.subline}` })),
      ...pack.carouselSlides.map((item, index) => ({ id: `slide-${index + 1}`, channel: 'شريحة', text: `${item.kicker}\n${item.title}\n${item.body}` })),
    ] : []
    return {
      article: { slug: bundle.slug, title: bundle.title, excerpt: bundle.excerpt, body: bundle.body },
      fingerprint: meaningFingerprint,
      media: { audio: audioProofAssets(bundle.slug), social, designs },
      evidence: {
        sourceIds: editorialEvidenceChain.sourceIds,
        proofs: editorialEvidenceChain.sources,
        alerts: editorialEvidenceChain.alerts,
        claims: editorialEvidenceChain.claims,
      },
    }
  }, [bundle, editorialEvidenceChain, meaningFingerprint])
  const semanticCourt: MultimodalMeaningCourt = useMemo(() => buildMultimodalMeaningCourt(semanticCourtInput), [semanticCourtInput])
  const publicationPassportDraft = useMemo(() => {
    const audioAssets = semanticCourtInput.media.audio
    const socialPack = bundle.socialPack
    const visualDirections = socialPack?.visualDirections || []
    const socialTexts = semanticCourtInput.media.social.map((item) => item.text)
    const platformCount = socialPack
      ? [socialPack.x, socialPack.linkedin, socialPack.facebook, socialPack.threads, socialPack.instagramCaptions, socialPack.stories, socialPack.whatsapp, socialPack.newsletter].filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length
      : Object.values(bundle.social).filter(Boolean).length
    return buildPublicationPassportDraft({
      article: { slug: bundle.slug, title: bundle.title, excerpt: bundle.excerpt, body: bundle.body, meaningFingerprint: meaningFingerprint.hash },
      audio: { assets: audioAssets },
      design: {
        assetCount: visualDirections.length + (socialPack?.carouselSlides?.length || 0),
        qualityScore: socialPack?.qualityScore || 0,
        fingerprints: visualDirections.map((item) => `${item.layout}:${item.headline}:${item.subline}`),
      },
      social: { tweetCount: socialPack?.x?.length || 0, platformCount, campaignId: sevenDayCampaign.id, content: socialTexts.filter(Boolean).join('\n\n') },
      evidence: {
        sourceIds: editorialEvidenceChain.sourceIds,
        paperSlugs: bundle.papers.map((paper) => paper.slug),
        proofs: editorialEvidenceChain.sources.map((source) => JSON.stringify(source)),
        alerts: editorialEvidenceChain.alerts,
      },
      semanticCourt,
      semanticCourtInput,
      releaseDecision: { targetStatus: 'draft', manualOverride: false, overrideReason: '' },
    })
  }, [bundle, editorialEvidenceChain, meaningFingerprint.hash, semanticCourt, semanticCourtInput, sevenDayCampaign.id])
  const privateMemoryMatches = useMemo(() => privateBookMatches(bundle, privateLinks), [bundle, privateLinks])
  const editorialDecisionSuite = useMemo(() => buildEditorialDecisionSuite({
    bundle,
    gate,
    styleInsight,
    weeklyPack,
    privateMatches: privateMemoryMatches,
    similarity,
  }), [bundle, gate, privateMemoryMatches, similarity, styleInsight, weeklyPack])
  const articleSuggestions = useMemo(() => suggestArticleIdeas(richArticles, radar, privateLinks), [privateLinks, radar, richArticles])
  const pulsePreviewReady = pulsePreviewCopy.idea.trim().length >= 3
  const pulseTemplateShowcase = useMemo(() => pulsePreviewReady ? standaloneVisualTemplates(pulsePreviewCopy.idea, pulsePreviewCopy.purpose) : [], [pulsePreviewCopy, pulsePreviewReady])
  const pulseCopyAnalysis = useMemo(() => analyzeSocialCopy(`${pulsePreviewCopy.idea} ${pulsePreviewCopy.purpose}`), [pulsePreviewCopy])
  const pulseCommand = useMemo(() => parseStudioCommand(pulsePreviewCopy.idea), [pulsePreviewCopy.idea])
  const pulseDesignResult = useMemo(() => {
    const content = pulseCommand.content.trim() || pulsePreviewCopy.idea.trim() || 'فكرة قصيرة تستحق أن تُقال الآن'
    const effectiveAudience = pulseCommand.audienceHint || pulseAudience
    const request = {
      text: content,
      context: [pulsePreviewCopy.purpose, effectiveAudience, pulseCommand.contextHint].filter(Boolean).join(' · '),
      author: 'د. أحمد حسين الفيلكاوي',
      tone: pulseCommand.tone || 'auto',
      density: pulseCommand.density || (pulseCommand.noBody ? 'minimal' : 'auto'),
      platform: pulseCommand.platform || 'instagram',
      /* المنشور المستقل وحده يثبت الوجه العربي النظيف في جميع الرؤى؛
         التنويع يبقى في التكوين واللون، لا في تبديل الخط بين نسخة وأخرى. */
      preferTypography: 'studio-clean',
      ...(pulseCommand.format ? { format: pulseCommand.format } : {}),
      ...(pulseCommand.preferLayout ? { preferLayout: pulseCommand.preferLayout } : {}),
      ...(pulseCommand.preferPalette ? { preferPalette: pulseCommand.preferPalette } : {}),
      count: 8,
      seed: `standalone-professional:${pulsePack?.visualSeed || `${content}:${pulsePreviewCopy.purpose}:${effectiveAudience}`}`,
      noveltyThreshold: .48,
    } as const
    const directed = generateSocialDesigns(request)
    // مسار ثانٍ يحرر المخرج من العائلة المطلوبة بعد أن يضمن حضورها في المسار
    // الأول؛ هكذا نحترم الأمر ولا نحول الرؤى الثلاث إلى القالب نفسه.
    const exploratory = generateSocialDesigns({
      ...request,
      density: content.split(/\s+/).length <= 18 ? 'minimal' : request.density,
      preferLayout: undefined,
      // بتوجيه الدكتور: المنشور المستقل وحده يحافظ على الخط العربي نفسه
      // في الرؤى كلها؛ التنويع يبقى في التكوين واللون لا في وجه الخط.
      preferTypography: undefined,
      seed: `${request.seed}:independent-art-direction`,
      noveltyThreshold: .42,
    })
    const plans = [...directed.plans, ...exploratory.plans]
      .filter((plan, index, all) => all.findIndex((candidate) => candidate.fingerprint === plan.fingerprint) === index)
    return { ...directed, plans }
  }, [pulseAudience, pulseCommand, pulsePack?.visualSeed, pulsePreviewCopy.idea, pulsePreviewCopy.purpose])
  const pulseProfessionalPlans = useMemo(() => {
    if (!pulsePreviewReady) return []
    const ranked = pulseDesignResult.plans
      .map((plan) => ({ plan, release: professionalReleaseGate(plan) }))
      .sort((left, right) => Number(right.release.ready) - Number(left.release.ready) || right.release.score - left.release.score)
    const selected: typeof ranked = []
    for (const candidate of ranked) {
      if (selected.every((item) => item.plan.layout !== candidate.plan.layout && designSimilarity(item.plan, candidate.plan) < .74)) selected.push(candidate)
      if (selected.length === 3) break
    }
    if (selected.length < 3) {
      for (const candidate of ranked) {
        if (selected.some((item) => item.plan.id === candidate.plan.id)) continue
        selected.push(candidate)
        if (selected.length === 3) break
      }
    }
    return selected.slice(0, 3)
  }, [pulseDesignResult, pulsePreviewReady])
  /* الكسوة تُطبَّق بعد بوابة المصمم: الترتيب يُحسم على البنية، والعالم يلبس الفائزين. */
  const pulseWorldPlans = useMemo(() => pulseWorld
    ? pulseProfessionalPlans.map((item) => ({ ...item, plan: dressPlanInWorld(item.plan, pulseWorld) }))
    : pulseProfessionalPlans, [pulseProfessionalPlans, pulseWorld])
  const pulseApprovedCount = pulseProfessionalPlans.filter((item) => item.release.ready).length
  const pulseTemplatePages = usePagedList(pulseTemplateShowcase, 8, `${pulsePreviewCopy.idea}|${pulsePreviewCopy.purpose}`)

  useEffect(() => {
    const timer = window.setTimeout(() => setPulsePreviewCopy({ idea: pulseIdea, purpose: pulsePurpose }), 450)
    return () => window.clearTimeout(timer)
  }, [pulseIdea, pulsePurpose])

  useEffect(() => {
    let active = true
    fetchPublishedExtras<RadarItem>('site_radar').then((items) => {
      if (active) setRadar(items.slice(0, 5))
    }).catch(() => undefined)
    return () => { active = false }
  }, [])


  useEffect(() => {
    if (!user || idea.trim().length < 3) return
    let active = true
    const timer = window.setTimeout(() => {
      setEventsLoading(true)
      user.getIdToken().then((token) => adminAiRequest<{ items: CurrentEvent[] }>('/api/ai/current-context', { idea, selectedEventIds }, token))
        .then((result) => {
          if (!active) return
          setCurrentEvents(result.items || [])
          setSelectedEventIds((previous) => previous.filter((id) => (result.items || []).some((item) => item.id === id)))
        })
        .catch(() => { if (active) setCurrentEvents([]) })
        .finally(() => { if (active) setEventsLoading(false) })
    }, 650)
    return () => { active = false; window.clearTimeout(timer) }
  }, [idea, user])

  const runEditorialBoard = async () => {
    const task = beginAdminTask('مجلس التحرير')
    setError('')
    setNotice('')
    setEditorialBusy(true)
    setEditorialProgress('archive')
    try {
      const ok = isAdmin || await refresh()
      if (!ok || !user) throw new Error('جلسة المشرف تحتاج تحديثاً. سجّل خروجك وادخل من جديد.')
      const cleanIdea = idea.trim()
      if (cleanIdea.length < 3) throw new Error('اكتب الفكرة أو العنوان المقترح أولاً.')

      const proposalContext = proposalMode === 'received' ? proposalSourceContext.trim() : ''
      const archive = richArticles.map((article) => ({
        slug: article.slug,
        title: article.title,
        text: `${article.excerpt || ''} ${article.body || ''}`,
        iso: article.iso,
        year: article.year,
      }))
      const dna = createIdeaDna(cleanIdea, { context: proposalContext, audience, archive })
      const similarityReport = articleSimilarityReport(cleanIdea, `${angle} ${proposalContext}`, richArticles, 5)
      const nearestArticles = similarityReport.matches.flatMap((match) => {
        const article = richArticles.find((item) => item.slug === match.slug)
        return article ? [archiveMaterialFromArticle(article, Math.round(match.score * 100))] : []
      })

      setEditorialProgress('graph')
      let graphRows: Array<{ kind: string; slug: string; title: string; score: number; url: string; year?: string }> = []
      try {
        const graph = buildKnowledgeGraph({ articles: richArticles, books: books as any, papers: papers as any })
        graphRows = graphSearch(graph, `${cleanIdea} ${angle} ${proposalContext}`, 10).map(({ node, score }) => ({
          kind: node.kind,
          slug: node.slug,
          title: node.title,
          score,
          url: node.url,
          year: node.year,
        }))
      } catch {
        graphRows = []
      }
      const seenArchive = new Set(nearestArticles.map((item) => `${item.kind}:${item.slug}`))
      const graphMaterials: EditorialArchiveMaterial[] = graphRows.flatMap((row) => {
        if (!['article', 'book', 'paper'].includes(row.kind)) return []
        const key = `${row.kind}:${row.slug}`
        if (seenArchive.has(key)) return []
        seenArchive.add(key)
        if (row.kind === 'article') {
          const article = richArticles.find((item) => item.slug === row.slug)
          return article ? [archiveMaterialFromArticle(article, Math.min(100, row.score * 6))] : []
        }
        if (row.kind === 'book') {
          const item = books.find((book) => book.slug === row.slug)
          return item ? [{ kind: 'book' as const, slug: item.slug, title: item.title, url: `/publications/${item.slug}`, score: Math.min(100, row.score * 6), date: '', excerpt: item.desc || '' }] : []
        }
        const item = papers.find((paper) => paper.slug === row.slug)
        return item ? [{ kind: 'paper' as const, slug: item.slug, title: item.titleAr || item.title, url: `/research/${item.slug}`, score: Math.min(100, row.score * 6), date: item.year || '', excerpt: item.abstractAr || item.meta || '' }] : []
      })
      const archiveMaterials = [...nearestArticles, ...graphMaterials].slice(0, 10)

      setEditorialProgress('current')
      let boardEvents: CurrentEvent[] = []
      let currentContextAvailable = false
      let currentContextError = ''
      try {
        const token = await user.getIdToken()
        const result = await adminAiRequest<{ items: CurrentEvent[] }>('/api/ai/current-context', { idea: cleanIdea, selectedEventIds: [] }, token)
        boardEvents = result.items || []
        currentContextAvailable = true
        setCurrentEvents(boardEvents)
      } catch (reason) {
        currentContextError = reason instanceof Error ? reason.message : 'current-context unavailable'
      }

      setEditorialProgress('portfolio')
      const audienceEvidence = personalAudienceEvidence()
      const portfolioEvidence = buildEditorialPortfolioEvidence(cleanIdea, richArticles, voicedArticles)
      const personalSourceMatches = matchPersonalSources(`${cleanIdea} ${angle} ${proposalContext}`, personalSources, 6)
      const agendaEvidence = buildAgendaAlignment(`${cleanIdea} ${angle}`, intellectualAgenda)

      setEditorialProgress('decision')
      const decision = buildEditorialBoardDecision({
        idea: cleanIdea,
        audience,
        angle,
        sourceMode: proposalMode,
        sourcePerson: proposalSourcePerson,
        sourceType: proposalMode === 'received' ? proposalSourceType : 'self',
        sourceContext: proposalContext,
        dna,
        similarity: similarityReport,
        graphMatches: graphRows,
        archiveMaterials,
        currentEvents: boardEvents,
        currentContextAvailable,
        currentContextError,
        audienceEvidence,
        portfolioEvidence,
        personalSourceMatches,
        agendaEvidence,
        personalMode: true,
        suggestedTitle: suggestStrongTitle(cleanIdea),
        calibrationProfile: editorialCalibrationProfile,
      })
      const previous = editorialHistory.find((item) => item.fingerprint === decision.fingerprint)
      if (previous) decision.why.push(`سبق عرض الفكرة نفسها على المجلس بتاريخ ${new Date(previous.generatedAt).toLocaleDateString('ar-KW')}؛ حُفظ هذا التحليل كتاريخ قرار جديد لا كنسخة تمحو السابق.`)
      setEditorialDecision(decision)
      setEditorialHistory((items) => [decision, ...items.filter((item) => item.id !== decision.id)].slice(0, 24))

      const db = await getDb()
      if (db) {
        const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
        const safeDecision = JSON.parse(JSON.stringify(decision)) as EditorialBoardDecision
        const initialImpactMirror = buildImpactMirror({ intent: {
          title: decision.plan.primaryTitle,
          thesis: decision.plan.thesis,
          protectedPoints: [decision.plan.thesis, ...decision.plan.outline.slice(0, 2)],
          caveats: decision.plan.doNotRepeat,
          expectedAction: decision.plan.outline.at(-1) || '',
          audience,
          fingerprintHash: decision.fingerprint,
        } })
        await setDoc(doc(db, 'admin_editorial_board', decision.id), {
          id: decision.id,
          fingerprint: decision.fingerprint,
          proposal: cleanIdea,
          verdict: decision.verdict,
          lifecycleStatus: decision.verdict === 'wait' ? 'wait' : decision.verdict === 'reject' ? 'rejected' : 'analyzed',
          sourceMode: proposalMode,
          sourcePerson: proposalMode === 'received' ? proposalSourcePerson.trim() : '',
          sourceType: proposalMode === 'received' ? proposalSourceType : 'self',
          sourceContext: proposalContext,
          decision: safeDecision,
          duplicateOf: previous?.id || null,
          linkedArticleId: null,
          publishedAt: null,
          calibration: { mode: 'feedback-loop', status: 'awaiting-article', due7At: null, due30At: null, actual7: null, actual30: null },
          impactMirror: initialImpactMirror,
          generatedAt: decision.generatedAt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        setEditorialImpactMirrorByDecision((items) => ({ ...items, [decision.id]: initialImpactMirror }))
      } else {
        setNotice('اكتمل قرار المجلس، لكن تعذّر حفظ السجل لأن Firestore غير متاح الآن.')
      }
      setEditorialProgress('done')
      task.needsInput(`قرار المجلس: ${decision.verdictLabel}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر تشغيل مجلس التحرير.')
      task.fail(reason, 'تعذّر تشغيل مجلس التحرير')
      setEditorialProgress('idle')
    } finally {
      setEditorialBusy(false)
    }
  }

  const launchEditorialArticle = async (decision: EditorialBoardDecision, evidenceOverride = false) => {
    if (!['write_now', 'change_angle'].includes(decision.verdict)) return
    const handoffAngle = [
      decision.plan.angle,
      `الأطروحة: ${decision.plan.thesis}`,
      decision.plan.doNotRepeat.length ? `لا تكرر: ${decision.plan.doNotRepeat.join(' ')}` : '',
      decision.plan.referencesNeeded.length ? `تحقق قبل الحسم من: ${decision.plan.referencesNeeded.join(' ')}` : '',
      evidenceOverride && decision.evidenceGate.missing.length ? `بوابة الدليل — أكمل قبل النشر: ${decision.evidenceGate.missing.join(' ')}` : '',
    ].filter(Boolean).join('\n')
    const seeded = buildBundle(decision.plan.primaryTitle, audience, handoffAngle, richArticles)
    setBundle({
      ...seeded,
      title: decision.plan.primaryTitle,
      slug: makeSlug(decision.plan.primaryTitle),
      socialPack: null,
    })
    setIdea(decision.plan.primaryTitle)
    setAngle(handoffAngle)
    /* لا نربط فتح المحرر بنجاح الشبكة: القرار والعنوان وملاحظة الدليل تنتقل
       فوراً، ثم يصل النص إلى المحرر نفسه. وكان تأخير الانتقال حتى نهاية الطلب
       يجعل أي بطء أو خطأ يبدو كأنه أعاد الصفحة بلا استجابة. */
    setView('write')
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById('article-writing-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
    const written = await rebuild({ title: decision.plan.primaryTitle, angle: handoffAngle })
    if (!written) return
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      document.getElementById('article-writing-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }))
  }

  const startEditorialArticle = (decision: EditorialBoardDecision) => {
    /* توصيةُ المجلس اتُّخذ بها قرارٌ فعليّ — هذا ما يميّز التوصية النافعة من المهملة. */
    void trackRecommendation('studio', 'قرار مجلس التحرير', true)
    void trackAdminUsage('admin_result_converted', {
      tool: 'studio', taskType: 'قرار مجلس التحرير', convertedTo: 'مسودة مقال', finalAction: 'started',
    })
    void launchEditorialArticle(decision, !decision.evidenceGate.ready)
  }

  const openExistingEditorialArticle = async (decision: EditorialBoardDecision) => {
    const nearest = decision.archiveCourt.nearest.find((item) => item.kind === 'article')
    if (!nearest) return
    await onTransferToArticles?.(nearest.slug)
  }

  const requestSocialPack = async (articleBundle: Bundle, announce = true) => {
    const task = announce ? beginAdminTask('بناء منظومة التوزيع') : null
    setSocialGenerating(true)
    setError('')
    socialVariation.current += 1
    const variation = socialVariation.current
    const selectedEvent = selectedEventIds.length
      ? currentEvents.find((item) => item.id === selectedEventIds[0]) || articleBundle.event || null
      : articleBundle.event || null
    try {
      let socialPack: PerfectSocialPack | null = null
      if (user) {
        try {
          const token = await user.getIdToken()
          socialPack = await adminAiRequest<PerfectSocialPack>('/api/ai/social-pack', {
            title: articleBundle.title,
            excerpt: articleBundle.excerpt,
            body: articleBundle.body,
            audience,
            styleProfile: style,
            /* المنشور يُقرأ باسمه كما يُقرأ المقال: البصمة نفسها ترافقه. */
            styleDna,
            selectedEventIds,
          }, token)
        } catch {
          socialPack = null
        }
      }
      if (!socialPack) {
        // الاحتياط المحلي يعمل بصمت — بطاقة التنبيه أُخفيت بطلب الدكتور (ضجيج بلا قرار)
        socialPack = buildArticleSocialPack(articleBundle, audience, selectedEvent, variation)
      } else {
        const local = buildArticleSocialPack(articleBundle, audience, selectedEvent, variation)
        socialPack = mergeSocialPacks(local, socialPack, variation, selectedEvent)
        setNotice('بُنيت منظومة توزيع جديدة، وتعرّفت القوالب على موضوع المقال ✓')
      }
      setBundle((previous) => previous.slug === articleBundle.slug ? { ...previous, socialPack } : previous)
      task?.needsInput('منظومة التوزيع جاهزة للمراجعة')
      return socialPack
    } catch (reason) {
      task?.fail(reason, 'تعذّر بناء منظومة التوزيع')
      throw reason
    } finally {
      setSocialGenerating(false)
    }
  }

  useEffect(() => {
    /* كان الشرط على العنوان وحده، والعنوان يُقترح من الفكرة قبل كتابة حرف —
       ففتحُ تبويب التوزيع على محرّرٍ فارغ كان يبني حزمةً من منشوراتٍ خاوية
       ويعرضها كأنها جاهزة. */
    if (view !== 'distribution' || bundle.socialPack || wordCount(bundle.body) < MIN_ARTICLE_WORDS) return
    const fallback = buildArticleSocialPack(bundle, audience, bundle.event || null, socialVariation.current)
    setBundle((previous) => previous.slug === bundle.slug && !previous.socialPack ? { ...previous, socialPack: fallback } : previous)
  }, [audience, bundle, view])

  /* «هذه ليست أنا»: نستخرج من الفقرة العباراتِ التي لا أثر لها في أرشيفه —
     فهي ما دخل من عند النموذج — ونمنعها في كل مقالٍ قادم. */
  const teachNotMe = (paragraph: string) => {
    const signature = extractVoiceSignature(paragraph, archiveTexts)
    if (!signature.length) {
      setNotice('هذه الفقرة بمفرداتٍ موجودة في أرشيفك، فلا عبارة غريبة لأمنعها. عدّلها بيدك وسأتعلّم من النتيجة.')
      return
    }
    const next = [...new Set([...voiceExclusions, ...signature])].slice(-60)
    setVoiceExclusions(next)
    try { localStorage.setItem('dr-voice-exclusions', JSON.stringify(next)) } catch { /* التخزين ممتلئ: الذاكرة تبقى للجلسة */ }
    void (async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, setDoc } = await import('firebase/firestore')
        await setDoc(doc(db, 'admin_style_memory', 'voice'), { exclusions: next, updatedAt: new Date().toISOString() }, { merge: true })
      } catch { /* القاعدة لم تُنشر بعد: المحلي يكفي ولا شيء يتعطّل */ }
    })()
    setNotice(`تعلّمت: ${signature.map((item) => `«${item}»`).join(' · ')} — لن تعود في مقالٍ لك.`)
  }

  const adoptAlternate = (alternate: NonNullable<PerfectArticleResponse['alternates']>[number]) => {
    const body = refineToStyle(alternate.body, styleDna)
    setStyleVerdict(judgeStyle(body, styleDna, { archive: archiveTexts, sources: archiveTexts }))
    setBundle((previous) => ({
      ...previous,
      title: alternate.title || previous.title,
      excerpt: alternate.excerpt || previous.excerpt,
      cat: alternate.cat || previous.cat,
      body,
      socialPack: null,
    }))
    setAlternates((previous) => previous.filter((item) => item !== alternate))
    setNotice(`اعتُمدت النسخة الثانية (${alternate.structure} · ${alternate.score}٪). حزمة التوزيع ستُبنى من جديد.`)
  }

  const styleIssues = useMemo(
    () => wordCount(settledBody) >= 60
      ? locateIssues(settledBody, styleDna, {
        archive: bundle.generatedBy ? comparisonArchive : undefined,
        sources: archiveTexts,
        orthography,
        /* نصّه هو: لا تُعرض عليه قواعد النموذج، بل العيب الموضوعي وحده. */
        strict: Boolean(bundle.generatedBy),
      })
      : [],
    [settledBody, styleDna, comparisonArchive, archiveTexts, orthography, bundle.generatedBy],
  )

  /* نداءٌ واحد لفقرةٍ واحدة: يستبدلها في مكانها ولا يمسّ بقية المقال. */
  const repairParagraph = async (sentence: string, note: string) => {
    const paragraphs = bundle.body.split(/\n\s*\n/)
    const index = paragraphs.findIndex((part) => part.includes(sentence.slice(0, 40)))
    if (index < 0) { setError('تعذّر تحديد فقرة هذه الجملة. حرّرها بيدك.'); return }
    setRepairingSentence(sentence)
    setError('')
    try {
      const ok = isAdmin || await refresh()
      if (!ok || !user) throw new Error('جلسة المشرف تحتاج تحديثاً.')
      const token = await user.getIdToken()
      const revised = await adminAiRequest<{ paragraph: string; words: number }>('/api/ai/article-paragraph', {
        paragraph: paragraphs[index],
        before: paragraphs[index - 1] || '',
        after: paragraphs[index + 1] || '',
        title: bundle.title,
        note,
        styleDna,
        voiceExclusions,
      }, token)
      const next = [...paragraphs]
      next[index] = revised.paragraph
      updateBundle({ body: refineToStyle(next.join('\n\n'), styleDna) })
      setNotice(`أُعيد تحرير الفقرة ${index + 1} وحدها (${arabicCountPhrase(revised.words, WORD_PLAIN_FORMS)}). بقية المقال كما هي.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر إصلاح الفقرة. لم يتغيّر شيء في مقالك.')
    } finally {
      setRepairingSentence('')
    }
  }

  const rebuild = async (override?: { title?: string; angle?: string }): Promise<boolean> => {
    const task = beginAdminTask('توليد المقال')
    /* دورة الأداة الدلالية: بدأت ← أنتجت ← تُركت. لا تُسجَّل نقرةٌ عابرة. */
    const usage = beginAdminToolTask('studio', 'توليد المقال')
    setError('')
    setNotice('')
    setGenerating(true)
    setGenerationStartedAt(Date.now())
    try {
      const parsedTarget = Number(fromArabicDigits(targetWordsInput).replace(/[^0-9]/g, ''))
      const requestedTarget = Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : targetWords))
      setTargetWords(requestedTarget)
      setTargetWordsInput(String(requestedTarget))
      generationRun.current += 1
      const ok = isAdmin || await refresh()
      if (!ok || !user) throw new Error('جلسة المشرف تحتاج تحديثاً. سجّل خروجك وادخل من جديد.')
      const token = await user.getIdToken()
      const requestedIdea = override?.title ? `${override.title}. ${override.angle || ''}` : idea
      const rawAngle = override?.angle || angle
      const ideaPreflight = articleSimilarityReport(requestedIdea, rawAngle, richArticles)
      const requestedAngle = !skipOriginality && ideaPreflight.repeated && ideaPreflight.matches[0]
        ? `${rawAngle}. اكتب من زاوية مغايرة بوضوح لمقال «${ideaPreflight.matches[0].title}»، وركّز على ما تغيّر الآن.`
        : rawAngle
      const nearest = relatedForIdea(`${requestedIdea} ${requestedAngle}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 45)
      const seen = new Set(nearest.map((article) => article.slug))
      const archive = [...nearest, ...richArticles.filter((article) => !seen.has(article.slug))].slice(0, 180)
      let generated: PerfectArticleResponse
      try {
        generated = await adminAiRequest<PerfectArticleResponse>('/api/ai/perfect-article', {
          idea: requestedIdea,
          audience,
          angle: requestedAngle,
          targetWords: requestedTarget,
          skipOriginality,
          styleProfile: style,
          styleSamples,
          /* البصمة مقيسةٌ هنا على الأرشيف الحيّ كاملاً بلا بتر: الخادم يحمل
             لقطةً من ١٤٣ مقالاً، والواجهة تحمل ما نُشر بعدها أيضاً. */
          styleDna,
          /* ما قال عنه «هذه ليست أنا»: يمنعه المحرك ويرفضه الحَكَم. */
          voiceExclusions,
          /* رقم الجولة يدوّر بنية المقال فلا يخرج مقالان متتاليان بالشكل نفسه. */
          variation: generationRun.current,
          selectedEventIds,
          /* المتون لا تُرفع: الخادم يقرأ bodies.json من قرصه. تُرسل متونُ
             أقرب خمسة وعشرين فقط — وهي التي قد تكون أحدث من بناء الخادم —
             فتهبط الحمولة من ٦٣٦ كيلوبايت (وحدّ الطلب ١٢٨) إلى نحو تسعين. */
          existing: archive.map((article, position) => ({
            slug: article.slug,
            title: article.title,
            excerpt: (article.excerpt || '').slice(0, 220),
            body: position < 12 ? (article.body || '').slice(0, 1_200) : '',
          })),
        }, token)
      } catch (reason) {
        /* لا مقالَ مُلفَّقاً عند العجز. القالب المحلي القديم كان يسلّم نصاً
           باسمه لم يكتبه أحد — والصدق أن يُقال «لم يُكتب» ويُحفظ ما كتبه هو. */
        const message = reason instanceof Error ? reason.message : ''
        if (/جلسة|صلاحية|Unauthenticated|Admin access/i.test(message)) throw reason
        throw new Error(`لم يُكتب المقال: تعذّر الوصول إلى محرك الكتابة${message ? ` (${message})` : ''}. لم يُحفظ أي نصٍّ ناقص، وفكرتك وزاويتك كما هما. جرّب مرة أخرى بعد قليل.`)
      }
      /* الصقل الحتمي الأخير: طباعةٌ وإيقاعُ فقراتٍ ببصمته. لا تُضاف كلمة. */
      setAlternates(generated.alternates || [])
      const refinedBody = refineToStyle(generated.body, styleDna)
      const verdict = judgeStyle(refinedBody, styleDna, { archive: richArticles.map((article) => ({ body: article.body || '' })) })
      generated = { ...generated, body: refinedBody, exactWords: wordCount(refinedBody) }
      setStyleVerdict(verdict)
      generated = {
        ...generated,
        title: override?.title || distinctEditorialTitle(generated.title, requestedIdea, bundle.title, richArticles, generationRun.current),
      }
      const related = relatedForIdea(`${generated.title} ${generated.excerpt}`, richArticles, (article) => `${article.excerpt || ''} ${article.body || ''}`, 5)
      const relatedBooks = relatedForIdea(`${generated.title} ${generated.excerpt}`, books, (book) => book.desc || '', 3)
      const relatedPapers = relatedForIdea(`${generated.title} ${generated.excerpt}`, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.journal || ''}`, 3)
      const partial = { title: generated.title, excerpt: generated.excerpt, body: generated.body }
      const nextBundle: Bundle = {
        ...partial,
        slug: uniqueArticleSlug(generated.title, richArticles),
        cat: generated.cat,
        social: buildSocial(partial, audience),
        related: related.map(({ slug, title, iso }) => ({ slug, title, iso })),
        books: relatedBooks.map(({ slug, title }) => ({ slug, title })),
        papers: relatedPapers.map(({ slug, title }) => ({ slug, title })),
        quality: [
          `مطابقة الأسلوب لبصمتك: ${verdict.score}٪${generated.style?.structure ? ` · البناء: ${generated.style.structure}` : ''}${verdict.ready ? ' — داخل مدى مقالاتك' : ' — دون العتبة، راجع الملاحظات'}`,
          `وقفات «…» ${verdict.metrics.ellipsis} · انقلابات «بل» ${verdict.metrics.antithesis} · أسئلة ${verdict.metrics.questions} · وسيط الجملة ${arabicCountPhrase(verdict.metrics.medianSentence, WORD_PLAIN_FORMS)}.`,
          `الحد الأدنى ${arabicCountPhrase(350, WORD_PLAIN_FORMS)}؛ النسخة المولّدة الآن ${arabicCountPhrase(generated.exactWords, WORD_PLAIN_FORMS)} ويمكنك زيادتها بحرية.`,
          `درجة الأصالة مقابل الأرشيف: ${generated.originality}٪.`,
          `قيست بصمتك على ${arabicCountPhrase(styleDna?.sampleSize || style.articleCount, PUBLISHED_ARTICLE_AFTER_PREPOSITION_FORMS)}، لا على وصفٍ عام.`,
          generated.event ? `ربط راهن موثّق: ${generated.event.source} — ${generated.event.title}` : 'لم يُفرض حدث راهن لأن الصلة لم تكن عضوية.',
          skipOriginality ? 'استُثني فحص الأصالة بإقرار الكاتب لأن النص أو فكرته أصلية له.' : (generated.originalityNote || 'اجتاز فحص عدم تكرار الزاوية والحجة.'),
          'قوالب السوشيال تُبنى منفصلة لكل منصة لمنع النسخ المتكرر.',
        ],
        exactTarget: requestedTarget,
        originality: generated.originality,
        originalityBypassed: skipOriginality,
        similarity: generated.similarity,
        event: generated.event || null,
        eventConnection: generated.eventConnection || '',
        generatedBy: generated.modelValidated ? 'archive-ai' : 'local-fallback',
        socialPack: null,
      }
      setBundle(nextBundle)
      setIdea(override?.title || idea)
      if (override?.angle) setAngle(override.angle)
      setNotice(`كُتب المقال بأسلوبك بمطابقة ${verdict.score}٪ وطول ${arabicCountPhrase(generated.exactWords, WORD_PLAIN_FORMS)}${generated.style?.structure ? ` · بناء ${generated.style.structure}` : ''}${skipOriginality ? ' · مع تسجيل استثناء الأصالة بإقرارك' : ''} ✓`)
      setView('write')
      task.needsInput('المقال جاهز للمراجعة')
      void usage.generated(`مطابقة ${verdict.score}٪`)
      void requestSocialPack(nextBundle, false).catch(() => undefined)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر بناء المقال الكامل.')
      task.fail(reason, 'تعذّر بناء المقال الكامل')
      void usage.abandoned()
      return false
    } finally {
      setGenerating(false)
    }
  }

  const pickSuggestion = (title: string, suggestion: string) => {
    // الاقتراح يملأ الفكرة فقط. المرور على مجلس التحرير مقصود قبل أي توليد،
    // حتى لا تتحول بطاقات الاقتراح القديمة إلى باب خلفي يتجاوز قرار المجلس.
    setIdea(title)
    setAngle(suggestion)
    setEditorialDecision(null)
    setEditorialProgress('idle')
    setView('idea')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const updateBundle = (patch: Partial<Bundle>) => {
    setBundle((previous) => {
      const next = { ...previous, ...patch }
      if ('title' in patch && patch.title) next.slug = makeSlug(patch.title)
      if ('body' in patch || 'excerpt' in patch || 'title' in patch) {
        next.social = buildSocial({ title: next.title, excerpt: next.excerpt, body: next.body }, audience)
        next.socialPack = null
      }
      return next
    })
  }

  const transferToArticles = async () => {
    const task = beginAdminTask('نقل المقال إلى المكتبة')
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثاً. سجّل خروجك وادخل من جديد.')
      if (wordCount(bundle.body) < MIN_ARTICLE_WORDS) throw new Error(`المقال يجب ألا يقل عن ${arabicCountPhrase(MIN_ARTICLE_WORDS, WORD_PLAIN_FORMS)}. العدد الحالي: ${wordCount(bundle.body)}.`)
      if (!gate.ready) throw new Error(`بوابة الجودة لم تجتز بعد: ${gate.blocking.join('، ')}`)
      if (richArticles.some((article) => article.slug === bundle.slug)) throw new Error('هذا الرابط مستخدم سابقاً. عدّل العنوان أو الرابط.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const date = today()
      const signedPassport = await requestPublicationPassportSignature(publicationPassportDraft)
      const privateBookMemory = privateMemoryMatches.map((book) => ({
        title: book.title,
        pages: book.pages || null,
        score: book.score,
        section: book.section ? {
          label: book.section.label || 'محور خاص',
          page: book.section.page || null,
          pages: book.section.pages || null,
          keywords: (book.section.keywords || []).slice(0, 6),
        } : null,
        linkedPublicBook: book.linkedPublicBook || null,
      }))
      const editorialBoardTrace = editorialDecision ? {
        decisionId: editorialDecision.id,
        fingerprint: editorialDecision.fingerprint,
        verdict: editorialDecision.verdict,
        recommendedTitle: editorialDecision.plan.primaryTitle,
        thesis: editorialDecision.plan.thesis,
        angle: editorialDecision.plan.angle,
        doNotRepeat: editorialDecision.plan.doNotRepeat,
        source: editorialDecision.source,
      } : null
      await setDoc(doc(db, 'site_articles', bundle.slug), {
        slug: bundle.slug,
        title: bundle.title.trim(),
        cat: bundle.cat,
        excerpt: bundle.excerpt.trim(),
        body: bundle.body.trim(),
        iso: date.iso,
        date: date.ar,
        status: 'draft',
        scheduledAt: '',
        publicationPassport: signedPassport,
        // هذه الوثيقة عامة القراءة؛ لا يدخلها كتاب خاص أو مصدر فكرة أو ذاكرة أسلوب.
        // التفاصيل الداخلية تحفظ أدناه في admin_content_intelligence فقط.
        publishingStudio: {
          social: bundle.social,
          relatedArticles: bundle.related,
          relatedBooks: bundle.books,
          relatedPapers: bundle.papers,
          actualWords: wordCount(bundle.body),
          originalityBypassed: skipOriginality,
          currentEvent: bundle.event || null,
          eventConnection: bundle.eventConnection || '',
          socialPack: bundle.socialPack || null,
          generatedBy: bundle.generatedBy || 'local-archive-studio',
          sovereignPublication: {
            passportId: signedPassport.passportId,
            fingerprint: signedPassport.fingerprint,
            releaseReady: signedPassport.manifest.releaseReady,
            blocking: signedPassport.manifest.blocking,
            campaignId: sevenDayCampaign.id,
            opportunityId: opportunityRadar[0]?.id || null,
          },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await setDoc(doc(db, 'admin_content_intelligence', `article:${bundle.slug}`), {
        kind: 'article',
        slug: bundle.slug,
        title: bundle.title.trim(),
        meaningFingerprint,
        evidenceChain: editorialEvidenceChain,
        publicationPassportId: signedPassport.passportId,
        publicationPassportFingerprint: signedPassport.fingerprint,
        sourceIds: editorialEvidenceChain.sourceIds,
        privatePublishingStudio: {
          idea,
          audience,
          angle,
          privateBookMemory,
          quality: bundle.quality,
          requestedGenerationWords: targetWords,
          originality: similarity.originality,
          nearestArchive: similarity.matches,
          styleProfile: style,
          styleSamples: styleSamples.map((sample) => ({ slug: sample.slug, title: sample.title, cat: sample.cat, year: sample.year })),
          editorialBoard: editorialBoardTrace,
        },
        ...(editorialEvidenceChain.alerts.length ? { evidenceAlerts: editorialEvidenceChain.alerts, needsEvidenceReview: true } : {}),
        editorialDecisionId: editorialDecision?.id || null,
        builtFrom: 'publishing-studio',
        updatedAtClient: new Date().toISOString(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      if (editorialDecision) {
        const existingMirror = editorialImpactMirrorByDecision[editorialDecision.id]
        const impactMirror = buildImpactMirror({
          intent: {
            title: bundle.title.trim(),
            thesis: meaningFingerprint.thesis || editorialDecision.plan.thesis,
            protectedPoints: meaningFingerprint.protectedPoints,
            caveats: meaningFingerprint.caveats,
            expectedAction: editorialDecision.plan.outline.at(-1) || '',
            audience,
            fingerprintHash: meaningFingerprint.hash,
          },
          observations: existingMirror?.observations || [],
          metrics: existingMirror?.resonance.metrics || {},
        })
        await setDoc(doc(db, 'admin_editorial_board', editorialDecision.id), {
          lifecycleStatus: 'draft_started',
          linkedArticleId: bundle.slug,
          draftStartedAt: serverTimestamp(),
          calibration: { mode: 'feedback-loop', status: 'awaiting-publication', due7At: null, due30At: null, actual7: null, actual30: null },
          impactMirror,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        setEditorialImpactMirrorByDecision((items) => ({ ...items, [editorialDecision.id]: impactMirror }))
      }
      try {
        await requestContentPublicationSync({ kind: 'article', slug: bundle.slug, status: 'draft', scheduledAt: '' })
      } catch (reason) {
        console.warn('تعذّر تسجيل مسودة الاستوديو في خط النشر التلقائي.', reason)
      }
      setNotice(`نُقل المقال إلى «المقالات» كمسودة بجواز موقّع ${signedPassport.fingerprint.slice(0, 12)}…${signedPassport.manifest.releaseReady ? ' ومكتمل الطبقات' : `؛ وتبقى قبل النشر: ${signedPassport.manifest.blocking.join('، ')}`} ✓`)
      await onTransferToArticles?.(bundle.slug)
      task.complete('تم نقل المقال')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر نقل المقال إلى المقالات.')
      task.fail(reason, 'تعذّر نقل المقال')
    } finally {
      setBusy(false)
    }
  }

  const saveWeeklyQueue = async () => {
    const task = beginAdminTask('حفظ حزمة النشر')
    setError('')
    setNotice('')
    setQueueBusy(true)
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثاً. سجّل خروجك وادخل من جديد.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      const socialText = bundle.socialPack
        ? [bundle.socialPack.linkedin, bundle.socialPack.x, bundle.socialPack.threads, ...(bundle.socialPack.instagramCaptions || []), ...(bundle.socialPack.carouselSlides || []).map((slide) => `${slide.kicker} ${slide.title} ${slide.body}`), ...(bundle.socialPack.stories || []), bundle.socialPack.reelScript, bundle.socialPack.whatsapp, bundle.socialPack.newsletter].filter(Boolean).join(' ')
        : [weeklyPack.linkedin, weeklyPack.x, weeklyPack.generalX, weeklyPack.instagram, weeklyPack.question, weeklyPack.quote, weeklyPack.radarComment].filter(Boolean).join(' ')
      const meaningGuard = reviewMeaningDrift(meaningFingerprint, socialText)
      if (!meaningGuard.ready) throw new Error(`بصمة المعنى أوقفت الحزمة قبل الطابور: ${meaningGuard.explanation}`)
      if (semanticCourt.chambers.social.status === 'blocked'
        || semanticCourt.safeguards.headlineGuard.status === 'blocked'
        || semanticCourt.safeguards.claimLineage.status === 'blocked'
        || semanticCourt.adversarialSimulation.status === 'blocked') {
        throw new Error(`محكمة المعنى أوقفت الحزمة قبل الطابور: ${semanticCourt.alerts[0] || 'نسخة مشتقة لا تحفظ معنى الأصل.'}`)
      }
      await addDoc(collection(db, 'social_queue'), {
        status: 'ready_for_review',
        source: 'publishing_studio',
        articleSlug: bundle.slug,
        articleTitle: bundle.title,
        meaningFingerprintHash: meaningFingerprint.hash,
        meaningGuard,
        semanticCourt,
        idea,
        audience,
        posts: bundle.socialPack ? {
          linkedin: bundle.socialPack.linkedin,
          x: bundle.socialPack.x,
          threads: bundle.socialPack.threads,
          instagramCaptions: bundle.socialPack.instagramCaptions,
          carouselSlides: bundle.socialPack.carouselSlides,
          stories: bundle.socialPack.stories,
          reelScript: bundle.socialPack.reelScript,
          whatsapp: bundle.socialPack.whatsapp,
          newsletter: bundle.socialPack.newsletter,
          hashtags: bundle.socialPack.hashtags,
          eventHook: bundle.socialPack.eventHook || '',
        } : {
          linkedin: weeklyPack.linkedin,
          x: weeklyPack.x,
          generalX: weeklyPack.generalX,
          instagram: weeklyPack.instagram,
          interactiveQuestion: weeklyPack.question,
          archiveQuote: weeklyPack.quote,
          radarComment: weeklyPack.radarComment,
        },
        visualTemplates: bundle.socialPack ? buildSocialVisuals(bundle.socialPack, { title: bundle.title, excerpt: bundle.excerpt }) : null,
        currentEvent: bundle.socialPack?.event || bundle.event || null,
        relatedArticles: bundle.related,
        radar: radar.slice(0, 3),
        transformingCampaign: sevenDayCampaign,
        opportunityRadar: opportunityRadar[0] || null,
        sovereignPassportPreview: {
          releaseReady: publicationPassportDraft.releaseReady,
          blocking: publicationPassportDraft.blocking,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      try {
        localStorage.setItem('studio-campaign-seed', JSON.stringify({
          text: bundle.title,
          context: `${sevenDayCampaign.thesis}\n${sevenDayCampaign.promise}`,
          slug: bundle.slug,
          transformingCampaign: sevenDayCampaign,
          at: Date.now(),
        }))
      } catch { /* طابور Firestore هو الأصل؛ هذا الجسر يختصر فتح استوديو التصاميم فقط. */ }
      setNotice(`حُفظت رحلة الأيام السبعة في طابور الموافقة وشُبكت ببذرة استوديو التصاميم · تماسك ${sevenDayCampaign.continuityScore}٪ ✓`)
      task.complete('حُفظت حزمة النشر')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حفظ حزمة الأسبوع.')
      task.fail(reason, 'تعذّر حفظ حزمة النشر')
    } finally {
      setQueueBusy(false)
    }
  }


  const loadPulseContext = async () => {
    if (!pulseIdea.trim()) return [] as CurrentEvent[]
    setPulseEventsLoading(true)
    try {
      if (!user) return []
      const token = await user.getIdToken()
      const result = await adminAiRequest<{ items: CurrentEvent[] }>('/api/ai/current-context', { idea: pulseIdea, selectedEventIds: pulseSelectedEventIds }, token)
      const items = result.items || []
      setPulseEvents(items)
      setPulseSelectedEventIds((previous) => previous.filter((id) => items.some((item) => item.id === id)))
      return items
    } catch {
      const ideaTokens = new Set(normalize(pulseIdea).split(/\s+/).filter((token) => token.length > 2))
      const fallback = radar
        .filter((item) => /^https:\/\//i.test(item.url || ''))
        .map((item, index) => {
          const textTokens = normalize(`${item.ar || ''} ${item.en || ''} ${item.arNote || ''}`).split(/\s+/)
          const relevance = textTokens.reduce((score, token) => score + (ideaTokens.has(token) ? 1 : 0), 0)
          return {
            id: item.id || `radar-${index}`,
            title: item.ar || item.en || 'حدث راهن',
            summary: item.arNote || '',
            source: item.source || 'الرادار',
            url: item.url || '',
            relevance,
          }
        })
        .sort((left, right) => right.relevance - left.relevance)
        .slice(0, 8)
      setPulseEvents(fallback)
      if (fallback.length) setNotice('تعذّر تحديث المصادر الحية؛ عُرضت بدائل موثوقة من رادار الموقع مع ترتيبها بحسب صلتها بالفكرة.')
      else setError('تعذّر الوصول إلى المصادر الحية، ولا يوجد رابط موثوق بديل في الرادار الآن.')
      return fallback
    } finally {
      setPulseEventsLoading(false)
    }
  }

  const generatePulse = async () => {
    setError('')
    setNotice('')
    if (pulseIdea.trim().length < 3) { setError('اكتب الفكرة التي تريد نشرها أولاً.'); setAdminTaskState('needs-input', 'اكتب فكرة المنشور أولاً'); return }
    const task = beginAdminTask('بناء المنشور المستقل')
    setPulseBusy(true)
    pulseVariation.current += 1
    const variation = pulseVariation.current
    try {
      const parsedCommand = parseStudioCommand(pulseIdea)
      const cleanIdea = parsedCommand.content.trim() || pulseIdea.trim()
      const effectiveAudience = parsedCommand.audienceHint || pulseAudience
      const effectivePurpose = [pulsePurpose.trim(), parsedCommand.contextHint].filter(Boolean).join(' · ')
      const events = pulseEvents.length ? pulseEvents : await loadPulseContext()
      const selectedEvent = pulseSelectedEventIds.length
        ? events.find((item) => item.id === pulseSelectedEventIds[0]) || null
        : null
      let pack: PerfectSocialPack | null = null
      if (user) {
        try {
          const token = await user.getIdToken()
          pack = await adminAiRequest<PerfectSocialPack>('/api/ai/social-pack', {
            title: cleanIdea,
            excerpt: effectivePurpose,
            body: `${cleanIdea}

${effectivePurpose}`,
            purpose: effectivePurpose,
            audience: effectiveAudience,
            styleProfile: style,
            styleDna,
            selectedEventIds: pulseSelectedEventIds,
            standalone: true,
            creativeDirectives: {
              tone: parsedCommand.tone || '',
              density: parsedCommand.density || '',
              format: parsedCommand.format || '',
              platform: parsedCommand.platform || '',
              layout: parsedCommand.preferLayout || '',
              palette: parsedCommand.preferPalette || '',
              styleRoute: parsedCommand.styleRoute || '',
              timeZone: parsedCommand.timeZone || '',
            },
          }, token)
        } catch {
          pack = null
        }
      }
      const local = buildStandaloneSocialPack(cleanIdea, effectivePurpose, effectiveAudience, selectedEvent, variation)
      if (pack) {
        pack = mergeSocialPacks(local, pack, variation, selectedEvent)
      } else pack = local
      setPulsePack(pack)
      const approvedCount = pulseProfessionalPlans.filter((item) => item.release.ready).length
      setNotice(`فهم المخرج العبارة وبنى حزمة مستقلة لموضوع «${visualTopicLabel(detectVisualTopic(`${cleanIdea} ${effectivePurpose}`))}»، ومعها ${arabicCountPhrase(approvedCount, DIRECTION_FORMS)} من أصل 3 ✓`)
      task.needsInput('المنشور جاهز للمراجعة')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر بناء المنشور المستقل.')
      task.fail(reason, 'تعذّر بناء المنشور المستقل')
    } finally {
      setPulseBusy(false)
    }
  }

  const savePulseQueue = async () => {
    if (!pulsePack) return
    const task = beginAdminTask('حفظ المنشور المستقل')
    setPulseQueueBusy(true)
    setError('')
    try {
      const ok = isAdmin || await refresh()
      if (!ok) throw new Error('جلسة المشرف تحتاج تحديثاً.')
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح الآن.')
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore')
      const pulseOrigin = `${pulseIdea.trim()}\n${pulsePurpose.trim()}`.trim()
      const pulseFingerprint = buildMeaningFingerprint({ slug: 'standalone-post', title: pulseIdea.trim(), body: pulseOrigin, excerpt: pulsePurpose.trim(), sourceIds: ['standalone-author-input'] })
      const pulseSocial: Array<{ id: string; channel: string; text: string }> = []
      const append = (channel: string, value: unknown) => {
        const list = Array.isArray(value) ? value : value ? [value] : []
        list.map(String).filter(Boolean).forEach((text, index) => pulseSocial.push({ id: `${channel}-${index + 1}`, channel, text }))
      }
      append('X', pulsePack.x); append('LinkedIn', pulsePack.linkedin); append('Facebook', pulsePack.facebook)
      append('Threads', pulsePack.threads); append('Instagram', pulsePack.instagramCaptions); append('Stories', pulsePack.stories)
      append('Reel', pulsePack.reelScript); append('WhatsApp', pulsePack.whatsapp); append('Newsletter', pulsePack.newsletter)
      const pulseCourt = buildMultimodalMeaningCourt({
        article: { slug: 'standalone-post', title: pulseIdea.trim(), excerpt: pulsePurpose.trim(), body: pulseOrigin },
        fingerprint: pulseFingerprint,
        media: {
          social: pulseSocial,
          designs: [
            ...pulsePack.visualDirections.map((item, index) => ({ id: `direction-${index + 1}`, channel: 'اتجاه بصري', text: `${item.headline}\n${item.subline}` })),
            ...pulsePack.carouselSlides.map((item, index) => ({ id: `slide-${index + 1}`, channel: 'شريحة', text: `${item.kicker}\n${item.title}\n${item.body}` })),
          ],
        },
        evidence: { sourceIds: ['standalone-author-input'], proofs: ['standalone-author-input|author-confirmed'], alerts: [] },
      })
      if (pulseCourt.chambers.social.status === 'blocked' || pulseCourt.chambers.design.status === 'blocked'
        || pulseCourt.safeguards.headlineGuard.status === 'blocked' || pulseCourt.safeguards.claimLineage.status === 'blocked'
        || pulseCourt.adversarialSimulation.status === 'blocked') {
        throw new Error(`محكمة المعنى أوقفت المنشور المستقل: ${pulseCourt.alerts[0] || 'إحدى النسخ لا تحفظ الفكرة الأصلية.'}`)
      }
      await addDoc(collection(db, 'social_queue'), {
        status: 'ready_for_review',
        source: 'standalone_social_studio',
        idea: pulseIdea.trim(),
        purpose: pulsePurpose.trim(),
        audience: pulseAudience,
        posts: pulsePack,
        meaningFingerprintHash: pulseFingerprint.hash,
        semanticCourt: pulseCourt,
        visualTemplates: buildSocialVisuals(pulsePack, { title: pulseIdea.trim(), excerpt: pulsePurpose.trim() }),
        currentEvent: pulsePack.event || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setNotice('حُفظ المنشور المستقل وقوالبه في طابور الموافقة ✓')
      task.complete('حُفظ المنشور المستقل')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر حفظ المنشور المستقل.')
      task.fail(reason, 'تعذّر حفظ المنشور المستقل')
    } finally {
      setPulseQueueBusy(false)
    }
  }

  return (
    <div className="grid gap-5" dir="rtl">
      <section className={card}>
        <p className="text-[.76rem] font-semibold uppercase text-accent">استوديو النشر الذكي</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink md:text-3xl">من فكرة واحدة إلى مقال ومنظومة نشر.</h1>
        <p className="mt-3 max-w-4xl text-[.88rem] leading-loose text-soft">المقال له مساره الكامل، والمنشور المستقل له مساره الخاص؛ بلا خلط أو زحمة.</p>
        <PublishingStudioNavigation view={view} onSelect={setView} />
      </section>

      {view === 'idea' && (
        <>
          <section className={card} data-editorial-board-entry="true">
            <div className="flex flex-wrap items-start justify-between gap-4">
              {dueWaitingIdeas.length > 0 && (
                <div className="mb-5 w-full rounded-2xl border border-accent/30 bg-accent/[.04] p-4" data-waiting-room-bell="true">
                  <p className="text-[.72rem] font-semibold text-accent">جرس غرفة الانتظار — أفكار حان وقتها ({dueWaitingIdeas.length})</p>
                  <div className="mt-3 grid gap-2">
                    {dueWaitingIdeas.map((decision) => (
                      <div key={decision.id} className="grid gap-2 rounded-xl border border-hair bg-canvas px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                        <span className="min-w-0">
                          <strong className="block truncate text-[.8rem] text-ink">{decision.idea}</strong>
                          <span className="mt-1 block text-[.66rem] text-soft">موعد المراجعة حلّ · {decision.waitingRoom?.trigger || ''}</span>
                        </span>
                        <button type="button" className={`${ghost} !px-3 !py-1.5 text-[.7rem]`} onClick={() => adoptSavedIdea(decision)}>اعرضها الآن</button>
                        <button type="button" className="rounded-full border border-hair px-3 py-1.5 text-[.7rem] text-soft hover:border-accent hover:text-accent" onClick={() => void snoozeWaitingIdea(decision.id)}>أجّل أسبوعاً</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[.72rem] font-semibold uppercase text-accent">مجلس التحرير · قبل الكتابة</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">هل تستحق الفكرة مقالاً أصلاً؟</h2>
                <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">يفحص الأرشيف، خريطة المعرفة، اللحظة الحالية وتوازن مشروعك الفكري، ثم يصدر حكماً واحداً لك أنت. لا يعتمد على ردود جمهور ولا يبدأ الكتابة من تلقاء نفسه.</p>
              </div>
              <div className="inline-flex rounded-full border border-hair bg-canvas p-1" aria-label="مصدر الفكرة">
                <button type="button" aria-pressed={proposalMode === 'self'} onClick={() => { setProposalMode('self'); setEditorialDecision(null) }} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold transition-colors ${proposalMode === 'self' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>فكرة مني</button>
                <button type="button" aria-pressed={proposalMode === 'received'} onClick={() => { setProposalMode('received'); setEditorialDecision(null) }} className={`rounded-full px-4 py-2 text-[.76rem] font-semibold transition-colors ${proposalMode === 'received' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>مقترح وصلني</button>
              </div>
            </div>

            {proposalMode === 'received' && <div className="mt-4">
              <button type="button" className="rounded-full border border-hair px-4 py-2 text-[.74rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent" onClick={() => { setInboxSuggestionsOpen((open) => !open); if (!inboxSuggestions.length) void loadInboxSuggestions() }}>
                {inboxSuggestionsBusy ? 'أجلب صندوق الوارد…' : 'التقط مقترحاً من صندوق الوارد'}
              </button>
              {inboxSuggestionsOpen && (
                <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-hair bg-canvas p-2">
                  {inboxSuggestions.map((row) => (
                    <button key={row.id} type="button" onClick={() => adoptInboxSuggestion(row)} className="rounded-lg border border-hair px-3 py-2 text-right transition-colors hover:border-accent">
                      <strong className="block text-[.76rem] text-ink">{row.topic || row.message.slice(0, 60)}</strong>
                      <span className="mt-1 block text-[.66rem] leading-relaxed text-soft">{row.name} · {row.message.slice(0, 110)}</span>
                    </button>
                  ))}
                  {!inboxSuggestions.length && !inboxSuggestionsBusy && <p className="px-3 py-2 text-[.72rem] text-soft">لا رسائل صالحة كمقترح الآن — أو تعذّر جلبها في هذه الجلسة.</p>}
                </div>
              )}
            </div>}
            {proposalMode === 'received' && <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field label="من اقترحها؟ — اختياري"><input className={input} value={proposalSourcePerson} onChange={(event) => { setProposalSourcePerson(event.target.value); setEditorialDecision(null) }} placeholder="اسم داخلي لا يُنشر" /></Field>
              <Field label="نوع المصدر"><select className={input} value={proposalSourceType} onChange={(event) => { setProposalSourceType(event.target.value as EditorialSourceType); setEditorialDecision(null) }}>{EDITORIAL_SOURCE_LABELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
              <Field label="سياق مختصر — اختياري"><input className={input} value={proposalSourceContext} onChange={(event) => { setProposalSourceContext(event.target.value); setEditorialDecision(null) }} placeholder="مثال: نقاش بعد اجتماع" /></Field>
            </div>}

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_13rem_13rem_9rem]">
              <Field label="اكتب الفكرة أو العنوان المقترح"><textarea className={`${input} min-h-28 leading-loose`} value={idea} onChange={(event) => { setIdea(event.target.value); setEditorialDecision(null) }} placeholder="مثال: هل الذكاء الاصطناعي يجعل الطالب أقل استقلالية؟" /></Field>
              <Field label="الجمهور"><select className={input} value={audience} onChange={(event) => { setAudience(event.target.value); setEditorialDecision(null) }}><option>المعلمين والقيادات التعليمية</option><option>أولياء الأمور</option><option>الطلاب والباحثين</option><option>الإعلاميين</option><option>الجمهور العام</option></select></Field>
              <Field label="فرضية الزاوية"><select className={input} value={angle} onChange={(event) => { setAngle(event.target.value); setEditorialDecision(null) }}><option>الأثر الإنساني قبل بريق الأداة</option><option>زاوية تربوية عملية</option><option>سؤال أخلاقي وفكري</option><option>مدخل إعلامي سريع</option><option>امتداد أكاديمي من الأرشيف</option></select></Field>
              <Field label="طول أول مسودة"><input className={input} inputMode="numeric" aria-label="طول التوليد المبدئي" value={targetWordsInput} onChange={(event) => { const raw = fromArabicDigits(event.target.value).replace(/[^0-9]/g, ''); setTargetWordsInput(raw); const value = Number(raw); if (raw && Number.isFinite(value)) setTargetWords(Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, value))) }} onBlur={() => { const value = Number(targetWordsInput); const normalizedValue = Math.max(MIN_ARTICLE_WORDS, Math.min(MAX_GENERATION_WORDS, Number.isFinite(value) && value > 0 ? value : targetWords)); setTargetWords(normalizedValue); setTargetWordsInput(String(normalizedValue)) }} /></Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" disabled={editorialBusy || generating || idea.trim().length < 3} className={primary} onClick={() => void runEditorialBoard()}>{editorialBusy ? 'المجلس يحلل…' : 'اعرض الفكرة على مجلس التحرير'}</button>
              <span className="text-[.74rem] leading-relaxed text-soft">القرار يُحفظ داخلياً، ولا ينشر أو يغيّر أي مادة.</span>
            </div>
            {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
            {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] text-soft">{error}</p>}
          </section>
          <EditorialMemoryPanel idea={`${idea} ${angle}`} articles={richArticles} books={books as any} papers={papers as any} onDataChange={handleEditorialMemoryData} />
          <EditorialBoardPanel decision={editorialDecision} progress={editorialProgress} busy={editorialBusy || generating} historyCount={editorialHistory.length} onStart={startEditorialArticle} onOpenExisting={openExistingEditorialArticle} />
          {editorialDecision && ['write', 'revive'].includes(editorialDecision.verdict) && <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><span><span className="block text-[.7rem] font-semibold text-accent">بعد اعتماد الفكرة</span><span className="mt-1 block text-[.75rem] text-soft">حوّل قرار المجلس إلى مشروع Flow من دون إنشاء مقال تلقائي.</span></span><button type="button" className={ghost} onClick={() => { const seed = { type: 'public_topic_video', topic: editorialDecision.idea, message: editorialDecision.plan.thesis, audience, editorialDecisionId: editorialDecision.id }; try { sessionStorage.setItem('admin:live-director-seed', JSON.stringify(seed)) } catch { /* noop */ } window.dispatchEvent(new CustomEvent('studio:live-director-seed', { detail: seed })); setView('director') }}>افتحها في المخرج الحي</button></div></section>}
          {editorialHistory.length > 0 && <details className={`${card} group`}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4"><span><span className="block text-[.72rem] font-semibold text-accent">سجل قرارات مجلس التحرير</span><span className="mt-1 block text-[.82rem] text-soft">آخر {arabicCountPhrase(editorialHistory.length, LAST_SAVED_DECISION_FORMS)}{(editorialCalibrationProfile.sampleSize ?? 0) >= 1 ? ` · ${arabicCountPhrase(editorialCalibrationProfile.sampleSize ?? 0, CALIBRATION_RESULT_FORMS)}` : ''}{(editorialCalibrationProfile.stubbornWins || 0) > 0 ? ` · ${arabicCountPhrase(editorialCalibrationProfile.stubbornWins ?? 0, STUBBORN_WIN_FORMS)}` : ''}</span></span><span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="rounded-full border border-accent/[.35] px-4 py-2 text-[.74rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white" onClick={() => setWeeklySessionOpen((open) => !open)}>
                {weeklySessionOpen ? 'أغلق الجلسة الأسبوعية' : 'جلسة المجلس الأسبوعية — آخر أفكارك مرتبة'}
              </button>
            </div>
            {weeklySessionOpen && (
              <div className="mt-3 grid gap-2 rounded-xl border border-accent/25 bg-canvas p-3" data-weekly-board-session="true">
                <p className="text-[.7rem] leading-relaxed text-soft">مستحقات غرفة الانتظار أولاً، ثم الأقوى درجةً. اضغط فكرةً لتحميلها وعرضها على المجلس برادار اليوم.</p>
                {weeklySessionRows.map((decision, index) => (
                  <button key={decision.id} type="button" onClick={() => adoptSavedIdea(decision)} className="grid gap-1 rounded-lg border border-hair px-3 py-2 text-right transition-colors hover:border-accent sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <span className="text-[.7rem] font-bold text-accent">{index + 1}</span>
                    <span className="min-w-0"><strong className="block truncate text-[.78rem] text-ink">{decision.idea}</strong><span className="mt-0.5 block text-[.64rem] text-soft">{new Date(decision.generatedAt).toLocaleDateString('ar-KW')}</span></span>
                    <span className="text-[.68rem] font-semibold text-accent">{decision.verdictLabel}{decision.scores.strength != null ? ` · ${decision.scores.strength}/100` : ''}</span>
                  </button>
                ))}
                {!weeklySessionRows.length && <p className="px-2 py-1 text-[.72rem] text-soft">لا قرارات محفوظة بعد.</p>}
              </div>
            )}
            <div className="mt-4 grid gap-2 border-t border-hair pt-4">{editorialHistory.slice(0, 12).map((item) => {
              const calibration = editorialCalibrationByDecision[item.id]
              const actual = calibration?.actual30 || calibration?.actual7
              const windowLabel = calibration?.actual30 ? '30 يوماً' : calibration?.actual7 ? '7 أيام' : ''
              const comparison = actual?.vsSiteAveragePct == null ? '' : `${actual.vsSiteAveragePct >= 0 ? 'أعلى' : 'أقل'} من متوسط الموقع بـ${Math.abs(actual.vsSiteAveragePct)}٪`
              const mirror = editorialImpactMirrorByDecision[item.id] || buildImpactMirror({ intent: {
                title: item.plan.primaryTitle,
                thesis: item.plan.thesis,
                protectedPoints: [item.plan.thesis, ...item.plan.outline.slice(0, 2)],
                caveats: item.plan.doNotRepeat,
                expectedAction: item.plan.outline.at(-1) || '',
                audience,
                fingerprintHash: item.fingerprint,
              } })
              return <div key={item.id} className="rounded-xl border border-hair bg-canvas px-4 py-3"><div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><span className="min-w-0"><strong className="block truncate text-[.8rem] text-ink">{item.idea}</strong><span className="mt-1 block text-[.68rem] text-soft">{new Date(item.generatedAt).toLocaleDateString('ar-KW')}{actual?.performanceScore != null ? ` · توقع ${item.scores.strength ?? '—'}/100 · أداء ${windowLabel} ${actual.performanceScore}/100${comparison ? ` · ${comparison}` : ''}` : ''}</span></span><span className="text-[.72rem] font-semibold text-accent">{item.verdictLabel}</span></div><ImpactMirrorInline mirror={mirror} busy={impactMirrorBusyId === item.id} onSave={(text, source) => recordImpactObservation(item, text, source)} /></div>
            })}</div>
          </details>}
          <CurrentEventsCard items={currentEvents} selected={selectedEventIds} loading={eventsLoading} opportunities={opportunityRadar} onToggle={(id) => setSelectedEventIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id].slice(0, 3))} />
          <IdeaSuggestionsCard suggestions={articleSuggestions} onPick={pickSuggestion} />
          <ArchiveWakeCard articles={richArticles} onPick={pickSuggestion} />
        </>
      )}

      {view === 'write' && (
        <>
        {generating && <section className={`${card} border-accent/30`} aria-live="polite" data-article-generation-state="working">
          <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--c-hair)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div>
          <h2 className="mt-4 font-display text-xl font-semibold text-ink">أكتب المقال الآن داخل المحرر.</h2>
          <p className="mt-2 text-[.8rem] leading-relaxed text-soft">انتقلت الفكرة والعنوان وملاحظات مجلس التحرير. سيظهر النص هنا فور اكتمال الكتابة، من دون نقلك إلى أعلى الصفحة.</p>
        </section>}
        {!generating && error && <section className={`${card} border-red-300/45`} role="alert" data-article-generation-state="error">
          <h2 className="font-display text-xl font-semibold text-ink">تعذّرت الكتابة، وبقيت الفكرة محفوظة.</h2>
          <p className="mt-2 text-[.82rem] leading-relaxed text-soft">{error}</p>
          <button type="button" className={`${ghost} mt-4`} onClick={() => void rebuild({ title: bundle.title, angle })}>أعد محاولة كتابة المقال</button>
        </section>}
        {!generating && notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] leading-relaxed text-accent" aria-live="polite">{notice}</p>}
        <div id="article-writing-workspace" className="scroll-mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
          <section className={card}>
            <div className="grid gap-4">
              <Field label="العنوان"><input className={input} value={bundle.title} onChange={(event) => updateBundle({ title: event.target.value })} /></Field>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                <Field label="الرابط المختصر"><input className={input} dir="ltr" value={bundle.slug} onChange={(event) => updateBundle({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') })} /></Field>
                <Field label="التصنيف"><input className={input} list="publishing-article-categories" value={bundle.cat} onChange={(event) => updateBundle({ cat: event.target.value })} placeholder="اكتب تصنيفاً قائماً أو جديداً" /><datalist id="publishing-article-categories">{articleCats.filter((cat) => cat !== 'الكل').map((cat) => <option key={cat} value={cat} />)}</datalist></Field>
              </div>
              <Field label="المقتطف"><textarea className={`${input} min-h-24 leading-loose`} value={bundle.excerpt} onChange={(event) => updateBundle({ excerpt: event.target.value })} /></Field>
              <Field label={`المقال — ${arabicCountPhrase(wordCount(bundle.body), WORD_PLAIN_FORMS)} ${wordCount(bundle.body) >= MIN_ARTICLE_WORDS ? '✓' : `— بقيت ${arabicCountPhrase(MIN_ARTICLE_WORDS - wordCount(bundle.body), WORD_PLAIN_FORMS)}`}`}><textarea className={`${input} min-h-[500px] leading-loose`} value={bundle.body} onChange={(event) => updateBundle({ body: event.target.value })} /></Field>
            </div>
          </section>
          <aside className="grid content-start gap-5">
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">الحد الأدنى والأصالة</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-xl border p-4 ${wordCount(bundle.body) >= MIN_ARTICLE_WORDS ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{wordCount(bundle.body)}</strong><span className="text-[.72rem] text-soft">الحد الأدنى {MIN_ARTICLE_WORDS} — بلا سقف مقفول</span></div>
                <div className={`rounded-xl border p-4 ${skipOriginality || !similarity.repeated ? 'border-accent/40 bg-accent/[.05]' : 'border-hair bg-canvas'}`}><strong className="block font-display text-2xl text-accent">{similarity.originality}٪</strong><span className="text-[.72rem] text-soft">{skipOriginality ? 'مستثناة بإقرار الكاتب' : 'أصالة مقابل الأرشيف'}</span></div>
              </div>
              {similarity.matches[0] && <p className="mt-3 text-[.78rem] leading-relaxed text-soft">الأقرب موضوعياً: «{similarity.matches[0].title}» — التشابه {Math.round(similarity.matches[0].score * 100)}٪.</p>}
              <button type="button" aria-pressed={skipOriginality} onClick={() => setSkipOriginality((value) => !value)} className={`mt-4 w-full rounded-xl border px-4 py-3 text-start transition-colors ${skipOriginality ? 'border-accent bg-accent/[.07] text-accent' : 'border-hair bg-canvas text-soft hover:border-accent'}`}><strong className="block text-[.84rem]">أنا الكاتب — استثناء فحص الأصالة {skipOriginality ? '✓' : ''}</strong><span className="mt-1 block text-[.74rem] leading-relaxed">يُعطّل منع التشابه لهذه النسخة فقط، ويُسجّل داخل بيانات المقال للمراجعة. لا يعطّل بقية بوابة الجودة.</span></button>
              {(wordCount(bundle.body) < MIN_ARTICLE_WORDS || (similarity.repeated && !skipOriginality)) && <button type="button" disabled={generating} onClick={() => void rebuild()} className={`${ghost} mt-4 w-full`}>{generating ? 'أعيد التحرير…' : 'إعادة بناء واستكمال الحد الأدنى'}</button>}
            </section>
            {bundle.event && <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">صلة راهنة موثقة</p><a href={bundle.event.url} target="_blank" rel="noreferrer" className="mt-3 block font-display text-[1rem] font-semibold leading-relaxed text-ink hover:text-accent">{bundle.event.title}</a><p className="mt-2 text-[.78rem] text-soft">{bundle.event.source}</p>{bundle.eventConnection && <p className="mt-3 text-[.8rem] leading-relaxed text-soft">{bundle.eventConnection}</p>}</section>}
            <section className={card}><p className="text-[.76rem] font-semibold uppercase text-accent">ذاكرة الفكرة</p><p className="mt-2 text-[.86rem] leading-relaxed text-soft">{lab.angle}</p><div className="mt-4 grid gap-3">{bundle.related.map((item) => <a key={item.slug} href={`/articles/${item.slug}`} target="_blank" rel="noreferrer" className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.84rem] text-ink transition-colors hover:border-accent hover:text-accent">{item.title}{item.iso && <span className="ms-2 text-soft">{item.iso.slice(0, 4)}</span>}</a>)}</div></section>
            {generating && generationStartedAt > 0 && <GenerationProgress startedAt={generationStartedAt} />}
            <StyleFidelityCard verdict={liveStyleVerdict} sampleSize={styleDna?.sampleSize || style.articleCount} dna={measuredDna} />
            <IssueMap issues={styleIssues} busy={repairingSentence} onRepair={repairParagraph} />
            <CandidateRoom alternates={alternates} onAdopt={adoptAlternate} />
            <VoiceTeacher
              body={bundle.body}
              memory={voiceExclusions}
              onTeach={teachNotMe}
              onForget={() => { setVoiceExclusions([]); try { localStorage.removeItem('dr-voice-exclusions') } catch { /* لا شيء يتعطّل */ } setNotice('مُسحت ذاكرة الصوت. البصمة المقيسة من أرشيفك باقية كما هي.') }}
            />
            <PrivateBookMemoryCard matches={privateMemoryMatches} />
            <button type="button" onClick={() => setView('review')} className={primary}>انتقل إلى بوابة الجودة</button>
          </aside>
        </div>
        <EditorialForesightPanel title={bundle.title} body={bundle.body} articles={richArticles} onInsertFairAnswer={(paragraph) => updateBundle({ body: `${bundle.body.trim()}\n\n${paragraph}`.trim() })} />
        </>
      )}

      {view === 'review' && (
        <>
          <EditorialForesightPanel title={bundle.title} body={bundle.body} articles={richArticles} onInsertFairAnswer={(paragraph) => { updateBundle({ body: `${bundle.body.trim()}\n\n${paragraph}`.trim() }); setView('write') }} />
          <EditorialDecisionRoom suite={editorialDecisionSuite} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.72fr)]">
            <div className="grid content-start gap-5">
              <QualityGateCard gate={gate} />
              <EvidenceChainCard chain={editorialEvidenceChain} />
            </div>
            <div className="grid content-start gap-5">
              <StyleEditorCard review={styleInsight} />
              <PrivateBookMemoryCard matches={privateMemoryMatches} />
              <section className={card}>
                <p className="text-[.76rem] font-semibold uppercase text-accent">إلى مكتبة المقالات</p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-ink">القرار النهائي يتم من صفحة المقالات.</h2>
                <p className="mt-3 text-[.86rem] leading-relaxed text-soft">هذا الاستوديو يبني النص ويفحصه فقط. الزر التالي ينقل العنوان والمقتطف والنص والتصنيف والروابط والحزمة كاملة إلى «المقالات» كمسودة؛ وهناك تختار الجدولة أو النشر.</p>
                <PublicationPassportCard passport={publicationPassportDraft} />
                <button type="button" disabled={busy || !gate.ready} className={`${primary} mt-6 w-full`} onClick={() => void transferToArticles()}>{busy ? 'أنقل المقال…' : 'نقل المقال كاملاً إلى المقالات'}</button>
                {!gate.ready && <p className="mt-3 text-[.78rem] leading-relaxed text-soft">أكمل البنود غير المجتازة في بوابة الجودة أولاً.</p>}
                {notice && <p className="mt-4 rounded-xl border border-accent/30 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-accent">{notice}</p>}
                {error && <p className="mt-4 rounded-xl border border-red-300/40 bg-canvas px-4 py-3 text-[.84rem] leading-relaxed text-soft">{error}</p>}
              </section>
            </div>
          </div>
        </>
      )}

      {view === 'director' && <LiveDirector articles={richArticles} />}

      {view === 'pulse' && (
        <div className="grid gap-5">

          <section id="standalone-compose" className={card}>
            <p className="text-[.76rem] font-semibold uppercase text-accent">منشور مستقل</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">غرّد أو انشر فكرة… من دون أن تكتب مقالاً.</h2>
            <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">اكتب خاطراً، موقفاً، سؤالاً أو تعليقاً على حدث. الاستوديو يصنع لكل منصة صياغتها وقالبها البصري، ويغيّر الشكل والنبرة في كل مرة.</p>
            <div className="mt-3"><LivingIconToggle /></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_13rem_auto]">
              <Field label="الفكرة أو الجملة"><textarea className={`${input} min-h-28`} value={pulseIdea} onChange={(event) => { setPulseIdea(event.target.value); setPulsePack(null) }} placeholder="مثال: ليست المشكلة أن التكنولوجيا تتقدم… بل أن أسئلتنا التربوية تتأخر." /></Field>
              <Field label="الهدف أو الزاوية"><textarea className={`${input} min-h-28`} value={pulsePurpose} onChange={(event) => { setPulsePurpose(event.target.value); setPulsePack(null) }} placeholder="ماذا تريد أن يبقى في ذهن القارئ؟" /></Field>
              <Field label="الجمهور"><select className={input} value={pulseAudience} onChange={(event) => setPulseAudience(event.target.value)}><option>الجمهور العام</option><option>المعلمون</option><option>أولياء الأمور</option><option>القيادات التعليمية</option><option>الباحثون</option></select></Field>
              <div className="flex items-end"><button type="button" disabled={pulseBusy} className={`${primary} w-full`} onClick={() => void generatePulse()}>{pulseBusy ? 'أبني الحزمة…' : 'ابنِ المنشور'}</button></div>
            </div>
            {pulseCommand.understood.length > 0 && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3" data-standalone-phrase-understanding="true"><div className="flex flex-wrap items-center gap-2"><strong className="text-[.7rem] text-emerald-800">فهمتُ من عبارتك:</strong>{pulseCommand.understood.map((item) => <span key={`${item.label}-${item.value}`} className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[.6rem] text-emerald-800">{item.label}: {item.value}</span>)}<span className="ms-auto text-[.6rem] font-bold text-emerald-700">ثقة {Math.round(pulseCommand.confidence * 100)}٪</span></div>{pulseCommand.assumptions.length > 0 && <p className="mt-2 text-[.62rem] leading-relaxed text-emerald-900/70">{pulseCommand.assumptions.join(' · ')}</p>}</div>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void loadPulseContext()} disabled={pulseEventsLoading || !pulseIdea.trim()} className={ghost}>{pulseEventsLoading ? 'أحدّث الأحداث…' : 'اقترح حدثاً راهناً'}</button>
              <span className="text-[.76rem] text-soft">الربط اختياري؛ لا يُستخدم إلا إذا كان طبيعياً ومفيداً.</span>
            </div>
          </section>

          <section id="standalone-template-library" className={card} aria-labelledby="standalone-templates-title">
            {!pulsePreviewReady ? (
              <div className="rounded-2xl border border-dashed border-hair bg-canvas px-5 py-10 text-center" data-standalone-design-state="empty">
                <p className="text-[.76rem] font-semibold uppercase text-accent">Professional Art Direction</p>
                <h2 id="standalone-templates-title" className="mt-2 font-display text-2xl font-semibold text-ink">المخرج ينتظر فكرتك.</h2>
                <p className="mx-auto mt-3 max-w-2xl text-[.82rem] leading-relaxed text-soft">اكتب الفكرة أولاً؛ بعدها فقط تظهر التحليلات والرؤى القابلة للتنزيل. لا نص افتراضياً ولا تصميم وهمياً في الحالة الفارغة.</p>
              </div>
            ) : (
            <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[.76rem] font-semibold uppercase text-accent">Professional Art Direction</p>
                <h2 id="standalone-templates-title" className="mt-1 font-display text-2xl font-semibold text-ink">{pulseApprovedCount === 3 ? 'ثلاث رؤى اعتمدها المخرج، لا مكتبة ترمي القوالب أمامك.' : `ثلاث رؤى رشّحها المخرج؛ ${pulseApprovedCount} اجتازت البوابة الاحترافية.`}</h2>
                <p className="mt-2 max-w-3xl text-[.82rem] leading-relaxed text-soft">يفهم المحرك القضية والنبرة والجمهور وأوامر اللون والأسلوب من عبارتك، ويبني عشرات الاحتمالات ثم يعرض ثلاث نتائج متباعدة فقط بعد فحص الحرفة، فهم العبارة، القراءة الهاتفية والأصالة.</p>
              </div>
              <div className="flex flex-wrap gap-2"><span className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.72rem] text-soft">{pulseCopyAnalysis.topicLabel}</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[.68rem] font-bold text-emerald-700">بوابة المصمم {pulseApprovedCount}/3</span></div>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-hair bg-canvas p-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="قراءة المخرج البصري للنص">
              <div><span className="block text-[.67rem] text-soft">النبرة</span><strong className="mt-1 block text-[.84rem] text-ink">{pulseCopyAnalysis.tone}</strong></div>
              <div><span className="block text-[.67rem] text-soft">بنية النص</span><strong className="mt-1 block text-[.84rem] text-ink">{{ question: 'سؤال', contrast: 'مقارنة', number: 'أرقام', sequence: 'تسلسل', call: 'دعوة', definition: 'تعريف', statement: 'فكرة مباشرة' }[pulseCopyAnalysis.shape]}</strong></div>
              <div><span className="block text-[.67rem] text-soft">الصيغة الأنسب</span><strong className="mt-1 block text-[.84rem] text-ink">{pulseCopyAnalysis.recommendedFormat}{pulseCopyAnalysis.recommendedSlides > 1 ? ` · ${pulseCopyAnalysis.recommendedSlides} شرائح` : ''}</strong></div>
              <div className="min-w-0"><span className="block text-[.67rem] text-soft">العبارة المحورية</span><strong className="mt-1 line-clamp-2 block text-[.8rem] leading-relaxed text-ink">{pulseCopyAnalysis.keyPhrase || 'اكتب الفكرة ليقرأها المخرج البصري.'}</strong></div>
            </div>

            <DesignWorldsGallery
              compact
              activeWorldId={pulseWorld ? pulseWorld.id : (pulseWorldPlans[0] ? planWorldId(pulseWorldPlans[0].plan) : null)}
              onDress={(world) => setPulseWorld(world)}
              onClear={() => setPulseWorld(null)}
            />
            <div className="mt-5 grid gap-4 md:grid-cols-3" data-professional-standalone-directions="true">
              {pulseWorldPlans.map(({ plan }, index) => <ProfessionalStandaloneDesignCard key={`${plan.id}:${plan.paletteOverride?.label || 'base'}`} plan={plan} rank={index + 1} />)}
            </div>
            <details className="mt-5 rounded-2xl border border-hair bg-canvas">
              <summary className="cursor-pointer list-none px-4 py-3 text-[.7rem] font-semibold text-soft">مختبر التكوينات الكامل — مكتبة القوالب كاملة — 24 تكويناً</summary>
              <div className="border-t border-hair p-4"><p className="mb-4 text-[.68rem] leading-relaxed text-soft">هذه التكوينات تبقى مختبراً اختيارياً للمقارنة اليدوية؛ القرار الاحترافي الأساسي هو الرؤى الثلاث أعلاه.</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{pulseTemplatePages.pageItems.map((template) => <VisualTemplateCard key={template.id} template={template} />)}</div><Pagination page={pulseTemplatePages.page} pageCount={pulseTemplatePages.pageCount} onChange={pulseTemplatePages.setPage} totalItems={pulseTemplateShowcase.length} firstItem={pulseTemplatePages.firstItem} lastItem={pulseTemplatePages.lastItem} scrollTargetId="standalone-template-library" label="صفحات قوالب السوشال ميديا" className="mt-7" /></div>
            </details>
            </>
            )}
          </section>

          {pulseEvents.length > 0 && <CurrentEventsCard items={pulseEvents} selected={pulseSelectedEventIds} loading={pulseEventsLoading} onToggle={(id) => setPulseSelectedEventIds((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [id])} />}
          {pulsePack && <PerfectSocialPackCard pack={pulsePack} article={{ title: pulseIdea.trim(), excerpt: pulsePurpose.trim() }} busy={pulseBusy} onRegenerate={() => void generatePulse()} onSave={() => void savePulseQueue()} saveBusy={pulseQueueBusy} />}
          {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
          {error && <p className="rounded-xl border border-red-300/40 bg-wash px-4 py-3 text-[.84rem] text-soft">{error}</p>}
        </div>
      )}

      {view === 'distribution' && (
        <>
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span><span className="block text-[.7rem] font-semibold text-accent">امتداد بصري للحزمة</span><span className="mt-1 block text-[.75rem] text-soft">ابنِ فيديو المقال من النسخة نفسها؛ المخرج يشرح الجوهر ولا يقرأ المقال كاملاً.</span></span>
              <button type="button" className={ghost} onClick={() => {
                const seed = { type: 'article_video', articleSlug: bundle.slug, article: { slug: bundle.slug, title: bundle.title, excerpt: bundle.excerpt, body: bundle.body, cat: bundle.cat }, title: bundle.title, message: bundle.excerpt }
                try { sessionStorage.setItem('admin:live-director-seed', JSON.stringify(seed)) } catch { /* noop */ }
                window.dispatchEvent(new CustomEvent('studio:live-director-seed', { detail: seed }))
                setView('director')
              }}>افتح فيديو المقال في المخرج الحي</button>
            </div>
          </section>
          {bundle.socialPack ? (
            <PerfectSocialPackCard
              pack={bundle.socialPack}
              article={{ title: bundle.title, excerpt: bundle.excerpt }}
              busy={socialGenerating}
              onRegenerate={() => void requestSocialPack(bundle).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذّر بناء الحزمة.'))}
              onSave={saveWeeklyQueue}
              saveBusy={queueBusy}
            />
          ) : (
            <section className={card}>
              <p className="text-[.76rem] font-semibold uppercase text-accent">منظومة السوشيال</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-ink">القوالب تُبنى من النسخة النهائية للمقال.</h2>
              <p className="mt-3 max-w-3xl text-[.84rem] leading-relaxed text-soft">لكل منصة صياغة مختلفة، مع كاروسيل وStories وReel وقوالب PNG من ثيم الموقع وربط راهن موثق عند وجود صلة حقيقية.</p>
              <button type="button" disabled={socialGenerating || !bundle.title.trim()} onClick={() => void requestSocialPack(bundle).catch((reason) => setError(reason instanceof Error ? reason.message : 'تعذّر بناء الحزمة.'))} className={`${primary} mt-5`}>
                {socialGenerating ? 'أبني النصوص والتصاميم…' : 'ابنِ منظومة السوشيال'}
              </button>
            </section>
          )}

          <WeeklyPackCard pack={weeklyPack} campaign={sevenDayCampaign} onSave={saveWeeklyQueue} busy={queueBusy} />

          <details className={`${card} group`}>
            <summary className="cursor-pointer list-none text-[.82rem] font-semibold text-soft transition-colors hover:text-accent">الحزمة الكلاسيكية الاحتياطية</summary>
            <div className="mt-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><SocialCard title="X" text={bundle.social.x} /><SocialCard title="LinkedIn" text={bundle.social.linkedin} /><SocialCard title="Instagram" text={bundle.social.instagram} /><SocialCard title="Threads" text={bundle.social.threads} /><SocialCard title="WhatsApp / Broadcast" text={bundle.social.whatsapp} /><SocialCard title="النشرة البريدية" text={bundle.social.newsletter} /></div>
            </div>
          </details>

          {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}
          {error && <p className="rounded-xl border border-red-300/40 bg-wash px-4 py-3 text-[.84rem] text-soft">{error}</p>}
        </>
      )}
    </div>
  )

}
