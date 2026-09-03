import { interpretDrAhmadDomain } from './dr-ahmad-domain-glossary'

export type IdeaDnaArchiveItem = {
  slug?: string
  title: string
  text?: string
  iso?: string
  year?: string
}

export type IdeaDna = {
  version: 1
  fingerprint: string
  topic: { label: string; domain: string; confidence: number }
  depth: { score: number; label: 'ومضة' | 'مركزة' | 'عميقة' | 'منظومية' }
  tone: { id: 'formal' | 'institutional' | 'luxury' | 'human' | 'inspiring' | 'deep' | 'bold' | 'calm' | 'academic' | 'media' | 'promotional' | 'intellectual'; label: string; score: number }
  novelty: { score: number; label: 'مألوفة' | 'متجددة' | 'جديدة' | 'نادرة'; nearest?: { title: string; slug?: string; similarity: number } }
  audience: { primary: string; secondary: string[] }
  evidence: { score: number; label: 'رأي/تأمل' | 'معرفية' | 'مبنية على دليل' | 'بحثية' }
  keywords: string[]
  time: { mode: 'evergreen' | 'current' | 'future' | 'retrospective'; label: string; year?: string }
  direction: {
    image: { mode: 'conceptual' | 'documentary' | 'data' | 'human' | 'typographic'; label: string; brief: string }
    typography: { primary: 'display-monumental' | 'editorial-serif' | 'rational-sans' | 'number-led' | 'quotation-signature' | 'academic-index' | 'cinematic-title' | 'conversational'; alternates: string[]; label: string }
    palette: { primary: string; alternates: string[]; label: string }
    audio: { mode: 'reading' | 'dialogue' | 'short-voice'; label: string; pace: 'هادئ' | 'متزن' | 'حيوي' }
    platform: { primary: 'instagram' | 'linkedin' | 'x' | 'story' | 'reel'; secondary: Array<'instagram' | 'linkedin' | 'x' | 'story' | 'reel'>; label: string }
    layout: { primary: string; alternates: string[] }
    density: 'minimal' | 'balanced' | 'rich'
  }
  reasons: string[]
}

const STOP = new Set('من في على الى إلى عن هذا هذه ذلك التي الذي مع او أو ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل عبر حول داخل خارج الى إلى ان أن إن كان تكون يكون جداً جدا'.split(' '))
const normalize = (value = '') => String(value).toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء').replace(/[^\p{L}\p{N}\s%٪]/gu, ' ').replace(/\s+/g, ' ').trim()
const words = (value = '') => normalize(value).split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word))
const uniq = <T,>(items: T[]) => [...new Set(items)]
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))

function hash(value: string) {
  let h = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function keywordScore(input: string) {
  const counts = new Map<string, number>()
  for (const token of words(input)) counts.set(token, (counts.get(token) || 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
}

function similarity(a: string, b: string) {
  const left = new Set(words(a))
  const right = new Set(words(b))
  if (!left.size || !right.size) return 0
  let common = 0
  for (const token of left) if (right.has(token)) common += 1
  const union = new Set([...left, ...right]).size
  const titleBoost = common >= 2 ? Math.min(0.16, common * 0.025) : 0
  return clamp(((common / Math.max(1, union)) + titleBoost) * 100)
}

function toneFor(text: string, moods: string[]): IdeaDna['tone'] {
  const normalized = normalize(text)
  const tests: Array<[RegExp, IdeaDna['tone']['id'], string, number]> = [
    [/(دراسه|بحث|نتيجه|عينة|منهجي|مرجع|دليل|جامعه|تحليل)/, 'academic', 'أكاديمية', 92],
    [/(لماذا|معنى|انسان|ضمير|هويه|وعي|سؤال|نتأمل|نتامل)/, 'intellectual', 'فكرية', 86],
    [/(خطر|ازمه|فشل|يسرق|ينهار|صدمة|صدمه|لن|يجب)/, 'bold', 'حازمة', 82],
    [/(طفل|اسره|والد|ام|اب|مشاعر|حنان|علاقه)/, 'human', 'إنسانية', 84],
    [/(قرار|سياسه|حوكمه|قياده|مؤسسه|استراتيجي)/, 'institutional', 'مؤسسية', 88],
    [/(مستقبل|ابتكار|فرصه|ينمو|امكان|أمل|امل)/, 'inspiring', 'استشرافية', 80],
    [/(عاجل|اليوم|خبر|حدث|اعلان|إعلان)/, 'media', 'إعلامية', 78],
  ]
  for (const [pattern, id, label, score] of tests) if (pattern.test(normalized)) return { id, label, score }
  if (moods.includes('calm')) return { id: 'calm', label: 'هادئة', score: 76 }
  if (moods.includes('human') || moods.includes('warm')) return { id: 'human', label: 'إنسانية', score: 78 }
  if (moods.includes('academic') || moods.includes('precise')) return { id: 'academic', label: 'أكاديمية', score: 80 }
  if (moods.includes('future')) return { id: 'intellectual', label: 'استشرافية فكرية', score: 78 }
  return { id: 'intellectual', label: 'فكرية', score: 72 }
}

function audienceFor(text: string, explicit = '') {
  const normalized = normalize(`${explicit} ${text}`)
  const candidates: Array<[RegExp, string]> = [
    [/(ولي الامر|اولياء|الوالدين|الاباء|الامهات|الاسره)/, 'أولياء الأمور'],
    [/(معلم|معلمين|مدرس|هيئة التدريس|هييه التدريس)/, 'المعلمون وأعضاء هيئة التدريس'],
    [/(قياد|صانع القرار|سياس|اداره|مؤسس)/, 'القيادات وصنّاع القرار'],
    [/(باحث|دراسه|بحث|جامعه|اكاديمي)/, 'الباحثون والأكاديميون'],
    [/(طالب|طلاب|متعلم|متعلمين)/, 'الطلاب والمتعلمون'],
    [/(اعلام|صحاف|مذيع|جمهور)/, 'الجمهور والإعلام'],
  ]
  const found = uniq(candidates.filter(([pattern]) => pattern.test(normalized)).map(([, label]) => label))
  if (explicit.trim()) found.unshift(explicit.trim())
  const clean = uniq(found)
  return { primary: clean[0] || 'الجمهور العام المهتم بالتعليم والتكنولوجيا', secondary: clean.slice(1, 4) }
}

function evidenceFor(text: string): IdeaDna['evidence'] {
  const normalized = normalize(text)
  let score = 24
  if (/(دراسه|بحث|باحث|مرجع|مجله|جامعه|نتائج|عينة|عينا)/.test(normalized)) score += 38
  if (/[0-9٠-٩]+|%|٪/.test(text)) score += 16
  if (/(doi|journal|et al|meta analysis|تحليل تلوي|تجربه|استبيان)/i.test(text)) score += 18
  if (/(اعتقد|ارى|أرى|برأيي|برايي|اخشى|أخشى|اتساءل|أتساءل)/.test(normalized)) score -= 8
  score = clamp(score)
  const label: IdeaDna['evidence']['label'] = score >= 78 ? 'بحثية' : score >= 58 ? 'مبنية على دليل' : score >= 38 ? 'معرفية' : 'رأي/تأمل'
  return { score, label }
}

function depthFor(text: string, evidence: IdeaDna['evidence']): IdeaDna['depth'] {
  const count = words(text).length
  const normalized = normalize(text)
  let score = 20 + Math.min(42, count * 0.48) + evidence.score * 0.22
  if (/(حوكمه|منظوم|اخلاقي|هويه|وعي|استراتيجي|سياسه|مستقبل|معنى|انسان)/.test(normalized)) score += 12
  if (/[؟?]/.test(text)) score += 5
  score = clamp(score)
  const label: IdeaDna['depth']['label'] = score >= 80 ? 'منظومية' : score >= 62 ? 'عميقة' : score >= 42 ? 'مركزة' : 'ومضة'
  return { score: Math.round(score), label }
}

function timeFor(text: string, year?: string): IdeaDna['time'] {
  const normalized = normalize(text)
  if (/(مستقبل|قادمه|القادم|2030|2040|2050|غدا|غداً)/.test(normalized)) return { mode: 'future', label: 'استشرافية', year }
  if (/(اليوم|الان|الآن|هذا الاسبوع|هذا الشهر|عاجل|حديثا|حديثاً)/.test(normalized)) return { mode: 'current', label: 'راهنة', year }
  if (/(سابقا|سابقاً|الماضي|كان|تاريخ|منذ)/.test(normalized) || (year && Number(year) < new Date().getFullYear() - 4)) return { mode: 'retrospective', label: 'استعادية/تاريخية', year }
  return { mode: 'evergreen', label: 'ممتدة الصلاحية', year }
}

function directionFor(input: { text: string; topic: string; tone: IdeaDna['tone']; evidence: IdeaDna['evidence']; depth: IdeaDna['depth']; time: IdeaDna['time']; keywords: string[]; visualScenes: string[]; audience: IdeaDna['audience'] }): IdeaDna['direction'] {
  const normalized = normalize(input.text)
  const isData = input.evidence.score >= 62 || /[0-9٠-٩]+|%|٪/.test(input.text)
  const isHuman = input.tone.id === 'human' || /(طفل|انسان|اسره|مشاعر|معلم|طالب)/.test(normalized)
  const isTech = /(ذكاء|تقنيه|تكنولوجيا|رقمي|افتراضي|بيانات|خوارزم)/.test(normalized)
  const isInstitutional = ['academic', 'institutional', 'formal'].includes(input.tone.id)

  const palette = isTech
    ? { primary: 'silicon-night', alternates: ['electric-cobalt', 'scholar-blue'], label: 'تقني عميق بتباين معرفي' }
    : isHuman
      ? { primary: 'warm-parchment', alternates: ['signal-ivory', 'majlis-teal'], label: 'دافئ إنساني هادئ' }
      : input.tone.id === 'bold'
        ? { primary: 'museum-red', alternates: ['brand-night', 'graphite-gold'], label: 'حازم عالي الحضور' }
        : isInstitutional
          ? { primary: 'scholar-blue', alternates: ['brand-paper', 'quiet-stone'], label: 'رصين مؤسسي' }
          : { primary: 'brand-paper', alternates: ['majlis-teal', 'warm-parchment'], label: 'تحريري متزن' }

  const typography = isData
    ? { primary: 'academic-index' as const, alternates: ['number-led', 'rational-sans'], label: 'فهرس معرفي واضح' }
    : input.depth.score >= 72
      ? { primary: 'editorial-serif' as const, alternates: ['quotation-signature', 'display-monumental'], label: 'تحريري عميق' }
      : input.tone.id === 'bold'
        ? { primary: 'display-monumental' as const, alternates: ['cinematic-title', 'rational-sans'], label: 'عنوان قوي مقتصد' }
        : isHuman
          ? { primary: 'conversational' as const, alternates: ['quotation-signature', 'editorial-serif'], label: 'صوت عربي قريب' }
          : { primary: 'editorial-serif' as const, alternates: ['rational-sans', 'display-monumental'], label: 'تحريري معاصر' }

  const imageMode: IdeaDna['direction']['image']['mode'] = isData ? 'data' : isHuman ? 'human' : input.depth.score < 38 ? 'typographic' : 'conceptual'
  const scene = input.visualScenes[0] || (isTech ? 'مشهد تقني إنساني لا يستخدم كليشيهات الروبوت والشاشات العامة' : isHuman ? 'مشهد بشري طبيعي يحمل المعنى قبل الزخرفة' : 'استعارة بصرية واحدة واضحة مشتقة من الفكرة نفسها')
  const image = {
    mode: imageMode,
    label: imageMode === 'data' ? 'صورة/رسم معرفي' : imageMode === 'human' ? 'إنساني واقعي' : imageMode === 'typographic' ? 'طباعي خالص' : 'مفهومي',
    brief: scene,
  }

  const layouts = isData
    ? ['evidence-ledger', 'infographic', 'knowledge-map']
    : isTech
      ? ['neural-constellation', 'knowledge-map', 'silicon-arabesque']
      : isHuman
        ? ['human-note', 'quote-stage', 'quiet-orbit']
        : input.tone.id === 'bold'
          ? ['hero-word', 'dual-thesis', 'ink-veil']
          : ['editorial-axis', 'knowledge-map', 'quiet-orbit']

  const platformPrimary: IdeaDna['direction']['platform']['primary'] = input.time.mode === 'current' && input.depth.score < 58
    ? 'x'
    : input.evidence.score >= 58 || input.depth.score >= 72
      ? 'linkedin'
      : isHuman
        ? 'instagram'
        : 'instagram'
  const secondary = uniq<IdeaDna['direction']['platform']['secondary'][number]>([
    platformPrimary === 'linkedin' ? 'instagram' : 'linkedin',
    input.time.mode === 'current' ? 'x' : 'story',
    input.depth.score >= 72 ? 'reel' : 'x',
  ]).filter((item) => item !== platformPrimary).slice(0, 3)

  const audio = input.depth.score >= 72 || isHuman
    ? { mode: 'dialogue' as const, label: 'حوار تأملي', pace: 'هادئ' as const }
    : input.evidence.score >= 58
      ? { mode: 'reading' as const, label: 'قراءة معرفية', pace: 'متزن' as const }
      : { mode: 'short-voice' as const, label: 'مقطع صوتي قصير', pace: 'حيوي' as const }

  return {
    image,
    typography,
    palette,
    audio,
    platform: { primary: platformPrimary, secondary, label: platformPrimary === 'linkedin' ? 'LinkedIn أولاً' : platformPrimary === 'x' ? 'X أولاً' : 'Instagram أولاً' },
    layout: { primary: layouts[0], alternates: layouts.slice(1) },
    density: input.depth.score >= 74 || input.evidence.score >= 70 ? 'rich' : input.depth.score <= 38 ? 'minimal' : 'balanced',
  }
}

export function createIdeaDna(text: string, options: { context?: string; audience?: string; archive?: IdeaDnaArchiveItem[]; year?: string } = {}): IdeaDna {
  const source = `${text || ''}\n${options.context || ''}`.trim()
  const understanding = interpretDrAhmadDomain(text, options.context || '')
  const topicLabel = understanding.primary?.canonicalAr || understanding.recognizedTerms[0]?.canonicalAr || keywordScore(source)[0] || 'فكرة عامة'
  const domain = understanding.primary?.domain || 'فكر وتربية وتقنية'
  const evidence = evidenceFor(source)
  const depth = depthFor(source, evidence)
  const tone = toneFor(source, understanding.moods)
  const audience = audienceFor(source, options.audience)
  const keywords = uniq([
    ...understanding.recognizedTerms.slice(0, 5).map((item) => item.canonicalAr),
    ...keywordScore(source),
  ]).filter(Boolean).slice(0, 9)
  const time = timeFor(source, options.year)

  const archive = options.archive || []
  const ranked = archive
    .map((item) => ({ item, similarity: similarity(`${text} ${options.context || ''}`, `${item.title} ${item.text || ''}`) }))
    .filter((row) => row.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
  const nearest = ranked[0]
  const noveltyScore = Math.round(clamp(100 - (nearest?.similarity || 18)))
  const noveltyLabel: IdeaDna['novelty']['label'] = noveltyScore >= 86 ? 'نادرة' : noveltyScore >= 72 ? 'جديدة' : noveltyScore >= 54 ? 'متجددة' : 'مألوفة'
  const novelty: IdeaDna['novelty'] = {
    score: noveltyScore,
    label: noveltyLabel,
    ...(nearest ? { nearest: { title: nearest.item.title, slug: nearest.item.slug, similarity: Math.round(nearest.similarity) } } : {}),
  }

  const direction = directionFor({ text: source, topic: topicLabel, tone, evidence, depth, time, keywords, visualScenes: understanding.visualScenes, audience })
  const reasons = [
    `الموضوع: ${topicLabel}${understanding.confidence ? ` بثقة ${understanding.confidence}٪` : ''}`,
    `العمق ${depth.score}٪ لأن النص ${depth.label === 'ومضة' ? 'مكثف' : 'يحمل أكثر من طبقة معنى'}`,
    `الدليل ${evidence.score}٪ (${evidence.label})`,
    nearest ? `أقرب صدى أرشيفي «${nearest.item.title}»؛ لذلك الجِدة ${noveltyScore}٪` : 'لا يوجد صدى أرشيفي قريب؛ الجِدة مرتفعة',
    `المخرج المقترح: ${direction.image.label} + ${direction.typography.label} + ${direction.palette.label}`,
  ]

  const canonical = [topicLabel, depth.score, tone.id, noveltyScore, audience.primary, evidence.score, keywords.join('|'), time.mode, direction.palette.primary, direction.typography.primary, direction.audio.mode, direction.platform.primary].join('::')
  return {
    version: 1,
    fingerprint: `idea-${hash(normalize(canonical))}`,
    topic: { label: topicLabel, domain, confidence: understanding.confidence || 50 },
    depth,
    tone,
    novelty,
    audience,
    evidence,
    keywords,
    time,
    direction,
    reasons,
  }
}
