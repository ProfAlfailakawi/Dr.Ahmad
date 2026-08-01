import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'
import { absentPartyAdvocate, genuineAdditionMeter, timeTest } from './editorial-foresight.ts'
import { relatedForIdea, strongestQuote, suggestStrongTitle } from './intelligence.ts'
import { bestBookConcept, bookKnowledgeAnchor, bookKnowledgeText } from './book-knowledge.ts'

export type DrAhmadTaskType =
  | 'media_preparation'
  | 'lecture'
  | 'idea_review'
  | 'article_or_research'
  | 'social_pack'
  | 'flow_video'
  | 'audience_analysis'
  | 'decision_review'
  | 'archive_retrieval'
  | 'compound'

export type CurrentContextItem = {
  id: string
  title: string
  titleAr?: string
  originalTitle?: string
  summary?: string
  source: string
  url: string
  publishedAt?: string
  ageHours?: number | null
  relevance?: number
}

export type ArchiveDecisionSource = {
  kind: 'مقال' | 'كتاب' | 'بحث' | 'إعلام' | 'اقتباس'
  id: string
  title: string
  url: string
  year: string
  note: string
}

export type DecisionMaterial = {
  id: string
  label: string
  text: string
}

export type DecisionAction = {
  id: 'start_article' | 'open_board' | 'social_pack' | 'flow_video' | 'waiting_room' | 'copy' | 'save'
  label: string
}

export type DrAhmadDecisionPackage = {
  taskType: DrAhmadTaskType
  executiveSummary: string
  archive: ArchiveDecisionSource[]
  current: {
    needed: boolean
    available: boolean
    note: string
    sources: CurrentContextItem[]
    inference: string
  }
  material: DecisionMaterial[]
  strongestObjection: { party: string; objection: string; response: string }
  confidence: {
    archiveEvidence: string
    sourceFreshness: string
    repetitionRisk: string
    sufficiency: string
  }
  nextActions: DecisionAction[]
  diagnostics: {
    addition: ReturnType<typeof genuineAdditionMeter>
    time: ReturnType<typeof timeTest>
    audienceSignals: string[]
    readerSignals: string[]
  }
}

type RoomArchive = {
  articles: ArticleRecord[]
  books: BookRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
}

const TASK_RULES: Array<{ type: Exclude<DrAhmadTaskType, 'compound'>; pattern: RegExp }> = [
  { type: 'media_preparation', pattern: /لقاء تلفزيوني|مقابلة|صحفي|إعلامي|قناة|برنامج تلفزيوني/i },
  { type: 'lecture', pattern: /محاضرة|ندوة|ورشة|عرض تقديمي|كلمة افتتاحية/i },
  { type: 'idea_review', pattern: /هل .*تستحق|افحص .*فكرة|قيّم .*فكرة|فكرة .*مقال/i },
  { type: 'article_or_research', pattern: /اكتب|مقال|بحث|ورقة|دراسة|أطروحة/i },
  { type: 'social_pack', pattern: /منشورات|تغريد|LinkedIn|انستغرام|سوشيال|حزمة/i },
  { type: 'flow_video', pattern: /Flow|فيديو|ومضة|مخرج حي|مقطع/i },
  { type: 'audience_analysis', pattern: /جمهور|يسأل|قرّاء|قراء|رسائل|نبض/i },
  { type: 'decision_review', pattern: /قرار|أختار|تنصح|أولوية|أهم ما يحتاج/i },
  { type: 'archive_retrieval', pattern: /أرشيف|كتبت|قلت|مقال سابق|كتاب|استرجع/i },
]

export function classifyDrAhmadCommand(command: string) {
  const matches = TASK_RULES.filter((rule) => rule.pattern.test(command)).map((rule) => rule.type)
  const unique = [...new Set(matches)]
  const type: DrAhmadTaskType = unique.length > 1 ? 'compound' : unique[0] || 'decision_review'
  const needsCurrentContext = /اليوم|الآن|راهن|أحدث|خبر|حدث|إحصائي|دراسة حديثة|لقاء تلفزيوني|تعليق على/i.test(command)
  return { type, paths: unique.length ? unique : ['decision_review' as const], needsCurrentContext }
}

function clip(value = '', maximum = 240) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return Array.from(clean).slice(0, maximum).join('')
}

function asSource(kind: ArchiveDecisionSource['kind'], item: { slug: string; title: string }, note: string, year = ''): ArchiveDecisionSource {
  const base = kind === 'مقال' ? '/articles/' : kind === 'كتاب' ? '/publications/' : kind === 'بحث' ? '/research/' : '/media/'
  return { kind, id: item.slug, title: item.title, url: `${base}${item.slug}`, year, note: clip(note, 220) }
}

function archiveSources(command: string, archive: RoomArchive) {
  const articles = relatedForIdea(command, archive.articles, (item) => `${item.excerpt || ''} ${item.body || ''} ${item.cat || ''}`, 5)
  const books = relatedForIdea(command, archive.books, (item) => `${item.desc || ''} ${item.longDescription || ''} ${item.toc || ''} ${bookKnowledgeText(item.slug)}`, 3)
  const papers = relatedForIdea(command, archive.papers, (item) => `${item.meta || ''} ${item.abstractAr || ''} ${item.keyFinding || ''} ${item.journal || ''}`, 3)
  const media = relatedForIdea(command, archive.media, (item) => `${item.outlet || ''} ${item.program || ''} ${item.topics || ''} ${item.transcript || ''}`, 3)
  const sources: ArchiveDecisionSource[] = [
    ...articles.map((item) => asSource('مقال', item, item.excerpt || clip(item.body || ''), item.iso?.slice(0, 4) || '')),
    ...books.map((item) => {
      const match = bestBookConcept(command, item.slug)
      const source = asSource('كتاب', item, match && match.score > 0 ? `${match.concept.title} — ص ${match.concept.pageStart}` : item.desc || item.longDescription || '', item.year || '')
      if (match && match.score > 0) source.url = `/publications/${item.slug}#${bookKnowledgeAnchor(match.concept)}`
      return source
    }),
    ...papers.map((item) => asSource('بحث', item, item.abstractAr || item.meta || '', item.year || item.iso?.slice(0, 4) || '')),
    ...media.map((item) => asSource('إعلام', item, `${item.outlet}${item.topics ? ` — ${item.topics}` : ''}`, item.iso?.slice(0, 4) || '')),
  ]
  const quoteArticle = articles.find((item) => (item.body || item.excerpt || '').length > 50)
  if (quoteArticle) {
    sources.push({
      kind: 'اقتباس', id: `quote:${quoteArticle.slug}`, title: strongestQuote(quoteArticle.body || quoteArticle.excerpt),
      url: `/articles/${quoteArticle.slug}`, year: quoteArticle.iso?.slice(0, 4) || '', note: `من «${quoteArticle.title}»`,
    })
  }
  return { sources, articles, books, papers, media }
}

function coreIdea(command: string, nearest?: ArticleRecord) {
  return nearest?.excerpt || `الموضوع يستحق أن يُقرأ من زاوية أثره في الإنسان، لا من زاوية الأداة أو الحدث وحده: ${clip(command, 170)}.`
}

function mediaMaterials(command: string, idea: string, quote: string): DecisionMaterial[] {
  return [
    { id: 'tv-20', label: 'جواب تلفزيوني · 20 ثانية', text: `القضية ليست في ${clip(command, 70)} وحدها؛ القضية في أثرها على الطالب والمعلم. نحتاج معياراً واضحاً: ماذا تضيف إلى الفهم، وما القرار الذي يجب أن يبقى إنسانياً؟` },
    { id: 'tv-45', label: 'جواب تلفزيوني · 45 ثانية', text: `${idea} ما نحتاجه ليس قبول الجديد أو رفضه بالجملة، بل وضعه داخل مسؤولية تربوية واضحة: هدف معلوم، ومعلم يراجع، وطالب يفهم لماذا يستخدم الأداة. ${quote ? `وألخّصها هكذا: «${clip(quote, 150)}»` : ''}` },
    { id: 'tv-120', label: 'جواب موسّع · دقيقتان', text: `${idea}\n\nأبدأ بالسؤال الذي يمس الناس مباشرة: ما الذي سيتغير في تعلم الطالب وعمل المعلم؟ ثم أميّز بين الإمكان التقني والقرار التربوي، وأذكر مثالاً من الواقع، وأختم بمعيار يمكن للمؤسسة والأسرة مراجعته بعد التطبيق.` },
    { id: 'hard-questions', label: 'أسئلة صعبة متوقعة', text: 'هل تحل الأداة مكان المعلم؟ من يتحمل الخطأ؟ ماذا عن الخصوصية والتحيز؟ وهل لدينا دليل على تحسن التعلم لا مجرد زيادة الاستخدام؟' },
  ]
}

function lectureMaterials(command: string, idea: string): DecisionMaterial[] {
  return [
    { id: 'opening', label: 'افتتاحية المحاضرة', text: `قبل أن نسأل ماذا تستطيع الأدوات الجديدة أن تفعل، لنسأل سؤالاً أصعب: ماذا نريد أن يبقى في الإنسان بعد أن تنتهي المحاضرة وتغلق الشاشة؟` },
    { id: 'outline', label: 'هيكل المحاضرة', text: `1. لماذا يهم «${clip(command, 90)}» الآن؟\n2. ما الذي تغير فعلاً؟\n3. أثره في الطالب والمعلم.\n4. أقوى اعتراض وحدود الفكرة.\n5. مثال تطبيقي.\n6. قرار واحد يبدأ غداً.` },
    { id: 'thesis', label: 'الأطروحة', text: idea },
    { id: 'closing-question', label: 'سؤال ختامي', text: 'ما القرار الصغير الذي نستطيع تغييره غداً، بحيث تخدم الأداة معنى التعلم بدل أن تستبدله؟' },
  ]
}

function socialMaterials(command: string, idea: string, sourceUrl = ''): DecisionMaterial[] {
  const link = sourceUrl ? `\n${sourceUrl}` : ''
  return [
    { id: 'x', label: 'تغريدة', text: `لسنا أمام سؤال تقني فقط. السؤال الأهم: ماذا سيبقى للطالب والمعلم من ${clip(command, 74)} حين يهدأ الانبهار؟${link}` },
    { id: 'linkedin', label: 'LinkedIn', text: `${idea}\n\nفي المؤسسات التعليمية، لا تكفي كفاءة الأداة؛ نحتاج وضوح الهدف، ومسؤولية القرار، ومؤشراً يثبت أن الفهم تحسن فعلاً. ما المعيار الذي تستخدمونه قبل التوسع؟${link}` },
    { id: 'flow', label: 'ومضة Flow · 8 ثوانٍ', text: `مشهد تعليمي هادئ، ثم أفتار د. أحمد المحفوظ يقول: «الأداة تتقدم… لكن هل يتقدم معها فهمنا؟»` },
  ]
}

function defaultMaterials(type: DrAhmadTaskType, command: string, idea: string, quote: string, sourceUrl = ''): DecisionMaterial[] {
  if (type === 'media_preparation') return mediaMaterials(command, idea, quote)
  if (type === 'lecture') return lectureMaterials(command, idea)
  if (type === 'social_pack' || type === 'flow_video') return socialMaterials(command, idea, sourceUrl)
  if (type === 'audience_analysis') return [
    { id: 'audience-question', label: 'السؤال الذي يحتاج مادة', text: `ما الذي لا يزال الجمهور لا يجده بوضوح حول «${clip(command, 100)}»؟` },
    { id: 'audience-response', label: 'بذرة إجابة', text: idea },
  ]
  return [
    { id: 'title', label: 'عنوان مقترح', text: suggestStrongTitle(command) },
    { id: 'thesis', label: 'أطروحة المقال', text: idea },
    { id: 'opening', label: 'افتتاحية', text: `ليست المسألة في ${clip(command, 90)} بوصفها حدثاً عابراً؛ المسألة في القرار الذي تتركه داخل الإنسان بعد أن ينتهي الحدث.` },
    { id: 'quote', label: 'جملة محورية', text: quote },
  ]
}

function materialsForClassification(classification: ReturnType<typeof classifyDrAhmadCommand>, command: string, idea: string, quote: string, sourceUrl = '') {
  if (classification.type !== 'compound') return defaultMaterials(classification.type, command, idea, quote, sourceUrl)
  const combined = classification.paths.flatMap((path) => defaultMaterials(path, command, idea, quote, sourceUrl).map((item) => ({ ...item, id: `${path}:${item.id}` })))
  return combined.filter((item, index) => combined.findIndex((candidate) => candidate.label === item.label && candidate.text === item.text) === index)
}

export function buildDrAhmadDecisionPackage(input: {
  command: string
  archive: RoomArchive
  current?: CurrentContextItem[]
  currentError?: string
  audienceSignals?: string[]
  readerSignals?: string[]
}): DrAhmadDecisionPackage {
  const command = input.command.trim()
  const classification = classifyDrAhmadCommand(command)
  const related = archiveSources(command, input.archive)
  const seed = related.articles[0]
  const idea = coreIdea(command, seed)
  const quote = strongestQuote(seed?.body || seed?.excerpt || command)
  const addition = genuineAdditionMeter(command, idea, input.archive.articles)
  const time = timeTest(command, `${idea} ${seed?.body || ''}`)
  const advocate = absentPartyAdvocate(command, `${idea} ${seed?.body || ''}`)
  const current = input.current || []
  const sourceUrl = related.sources.find((item) => item.kind === 'مقال')?.url || ''
  const material = materialsForClassification(classification, command, idea, quote, sourceUrl)
  const archiveEvidence = related.sources.length >= 6
    ? 'الأرشيف يغطي الموضوع من أكثر من نوع مادة.'
    : related.sources.length
      ? `التغطية موجودة لكنها محدودة إلى ${related.sources.length} مواد مرتبطة.`
      : 'لا توجد مادة أرشيفية قريبة بما يكفي.'
  const freshness = classification.needsCurrentContext
    ? current.length
      ? 'السياق الراهن جُلب من مصادر خارجية مع روابطه وتاريخه.'
      : 'السياق الراهن غير متاح؛ النتيجة مبنية على الأرشيف فقط.'
    : 'المهمة لا تحتاج معلومة راهنة كي تُنجز بأمان.'
  const sufficiency = related.sources.length >= 3 && (!classification.needsCurrentContext || current.length)
    ? 'المادة كافية للبدء، مع إبقاء المراجعة التحريرية قبل النشر.'
    : related.sources.length
      ? 'المادة تكفي لمسودة أو تحضير أولي، وتحتاج بحثاً إضافياً قبل ادعاء حديث أو رقمي.'
      : 'الأدلة غير كافية؛ استخدم النتيجة كسؤال بحث لا كموقف منسوب.'

  return {
    taskType: classification.type,
    executiveSummary: related.sources.length
      ? `أفضل اتجاه هو الانطلاق من أقرب ما كتبه د. أحمد، ثم إضافة زاوية واضحة بدل تكرار الأرشيف. ${idea}`
      : 'لا توجد مادة أرشيفية كافية لنسبة موقف جاهز إلى د. أحمد؛ الأفضل تحويل الطلب إلى فحص فكرة وبحث موجّه.',
    archive: related.sources,
    current: {
      needed: classification.needsCurrentContext,
      available: current.length > 0,
      note: classification.needsCurrentContext
        ? current.length ? 'هذه مواد خارجية راهنة، وليست أقوالاً لد. أحمد.' : `تعذّر جلب السياق الراهن${input.currentError ? `: ${input.currentError}` : ''}. استمر التحليل بالأرشيف.`
        : 'لا حاجة إلى سياق خارجي لهذا الطلب.',
      sources: current.slice(0, 6),
      inference: current.length
        ? 'الاستنتاج التحليلي: توجد لحظة مناسبة للحديث، لكن اختيار الموقف النهائي يبقى خاضعاً للأرشيف والدليل.'
        : 'لا يوجد استنتاج راهن؛ لم تُستخدم مادة خارجية.',
    },
    material,
    strongestObjection: { party: advocate.party, objection: advocate.strongestObjection, response: advocate.fairAnswer },
    confidence: {
      archiveEvidence,
      sourceFreshness: freshness,
      repetitionRisk: `${addition.verdict}: ${addition.explanation}`,
      sufficiency,
    },
    nextActions: [
      { id: 'start_article', label: 'ابدأ المقال' },
      { id: 'open_board', label: 'افتح مجلس التحرير' },
      { id: 'social_pack', label: 'حوّل إلى حزمة سوشيال' },
      { id: 'flow_video', label: 'أنشئ ومضة Flow' },
      { id: 'waiting_room', label: 'احفظ في غرفة الانتظار' },
      { id: 'copy', label: 'انسخ الإجابة' },
      { id: 'save', label: 'احفظ الجلسة' },
    ],
    diagnostics: {
      addition,
      time,
      audienceSignals: input.audienceSignals || [],
      readerSignals: input.readerSignals || [],
    },
  }
}
