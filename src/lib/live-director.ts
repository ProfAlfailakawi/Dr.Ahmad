import type { ArticleRecord } from './cms'
import { genuineAdditionMeter } from './editorial-foresight.ts'
import { strongestQuote, suggestStrongTitle } from './intelligence.ts'

export type LiveDirectorProjectType = 'article_video' | 'public_topic_video'
export type LiveDirectorProjectStatus = 'draft' | 'analyzing' | 'prompts_ready' | 'day_one' | 'day_two' | 'generating' | 'needs_revision' | 'clips_approved' | 'editing' | 'ready_to_publish' | 'published' | 'archived'
export type LiveDirectorClipStatus = 'not_generated' | 'generated' | 'needs_revision' | 'approved' | 'uploaded'
export type LiveDirectorTone = 'فكرية' | 'تربوية' | 'إنسانية' | 'صادمة' | 'إعلامية' | 'أكاديمية مبسطة' | 'مستقبلية' | 'ساخرة بذكاء'
export type LiveDirectorPlatform = 'Instagram Reels' | 'X' | 'YouTube Shorts' | 'LinkedIn' | 'TikTok' | 'متعدد المنصات'
export type FlowAppearance = 'avatar_direct' | 'avatar_voiceover' | 'visual_only' | 'avatar_with_object'

export type LiveDirectorSegment = {
  id: string
  order: number
  day: number
  duration: 8
  role: string
  purpose: string
  appearance: FlowAppearance
  narration: string
  shotCount: 1 | 2 | 3
  shotPlan: { from: number; to: number; framing: string }[]
  prompt: string
  negativeConstraints: string[]
  continuity: string
  status: LiveDirectorClipStatus
  videoUrl: string
  promptVersions: { prompt: string; reason: string; createdAt: string }[]
}

export type LiveDirectorSocialPack = {
  coverText: string
  caption: string
  x: string
  instagram: string
  linkedin: string
  youtube: string
  audienceQuestion: string
  callToAction: string
  hashtags: string[]
  thumbnailIdea: string
  articleDecision?: 'لا يحتاج مقالاً' | 'اربطه بمقالة موجودة' | 'حدّث مقالة قديمة' | 'حوّله إلى فكرة مقال' | 'أرسله إلى مجلس التحرير'
}

export type LiveDirectorQuality = {
  idea: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  duration: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  clips: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  avatar: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  publishing: 'ممتاز' | 'جيد' | 'يحتاج تبسيطاً' | 'يحتاج مراجعة'
  notes: string[]
}

export type LiveDirectorProject = {
  id: string
  type: LiveDirectorProjectType
  articleId: string
  articleUrl: string
  title: string
  idea: string
  centralMessage: string
  audience: string
  platform: LiveDirectorPlatform
  tone: LiveDirectorTone
  useAvatar: boolean
  series: boolean
  seriesPlan: string[]
  duration: 8 | 24 | 48 | 64
  durationReason: string
  segmentCount: number
  days: number
  narration: string
  identityLock: string
  continuityNotes: string[]
  segments: LiveDirectorSegment[]
  social: LiveDirectorSocialPack
  quality: LiveDirectorQuality
  status: LiveDirectorProjectStatus
  finalVideoUrl: string
  youtubeUrl: string
  coverUrl: string
  source: string
  sourceSessionId: string
  linkedEditorialDecisionId: string
  linkedCampaignId: string
  createdAtClient: string
  updatedAtClient: string
}

export type ArticleVideoInput = {
  article: ArticleRecord
  audience?: string
  platform?: LiveDirectorPlatform
  tone?: LiveDirectorTone
  useAvatar?: boolean
  preferredDuration?: 24 | 48 | 64
  source?: string
  sourceSessionId?: string
  linkedEditorialDecisionId?: string
  linkedCampaignId?: string
}

export type PublicVideoInput = {
  topic: string
  message?: string
  audience?: string
  platform?: LiveDirectorPlatform
  tone?: LiveDirectorTone
  useAvatar?: boolean
  wantsSeries?: boolean
  source?: string
  sourceSessionId?: string
  linkedEditorialDecisionId?: string
  linkedCampaignId?: string
  linkedArticle?: ArticleRecord | null
  archive?: ArticleRecord[]
}

const wordList = (value = '') => value.trim().split(/\s+/).filter(Boolean)
const wordCount = (value = '') => wordList(value).length
const unique = <T,>(items: T[]) => [...new Set(items)]
const now = () => new Date().toISOString()

function clipWords(value: string, maximum: number, fallback = '') {
  const rows = wordList(value.replace(/[\r\n]+/g, ' '))
  const output = rows.slice(0, maximum).join(' ').replace(/[،؛:]$/, '')
  return output || fallback
}

function cleanSentence(value = '') {
  return value.replace(/\s+/g, ' ').replace(/^[\s•\-–—\d.)]+/, '').trim()
}

function meaningfulSentences(value = '') {
  return value
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!؟…])\s+/)
    .map(cleanSentence)
    .filter((item) => wordCount(item) >= 6 && wordCount(item) <= 34)
}

function projectId(type: LiveDirectorProjectType, seed: string) {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  return `live-${type === 'article_video' ? 'article' : 'public'}-${Date.now().toString(36)}-${(hash >>> 0).toString(36)}`
}

export function recommendArticleVideoDuration(article: Pick<ArticleRecord, 'title' | 'excerpt' | 'body'>) {
  const text = article.body || article.excerpt || ''
  const count = wordCount(text)
  const complex = /دراسة|نتيجة|مقارنة|قصة|حكاية|تجربة|من جهة|في المقابل|أولاً|ثانياً/i.test(text)
  if (count <= 260 && !complex) return { duration: 24 as const, segments: 3, days: 1, reason: 'المقالة قصيرة وتدور حول سؤال واحد؛ الإعلان المركز يخدمها أكثر من شرح مطوّل.' }
  if (count >= 600 && complex) return { duration: 64 as const, segments: 8, days: 3, reason: 'المادة تحمل قصة أو مقارنة ودليلاً يحتاجان مقطعين إضافيين؛ 64 ثانية استثناء مبرر لا استهلاك للرصيد.' }
  return { duration: 48 as const, segments: 6, days: 2, reason: count >= 350 && count <= 450 ? 'هذه المدة هي الأنسب لمقالة بين 350 و450 كلمة: تشرح الجوهر ولا تحاول قراءة المقال كاملاً.' : 'الفكرة تحتاج خطافاً ومشكلة ونقطتين ورأي د. أحمد وخاتمة؛ ستة مقاطع تكفي بلا حشو.' }
}

export function recommendPublicVideoDuration(input: Pick<PublicVideoInput, 'topic' | 'message' | 'wantsSeries'>) {
  const text = `${input.topic} ${input.message || ''}`.trim()
  const count = wordCount(text)
  const manyAxes = input.wantsSeries || count > 180 || /سلسلة|محاور|أجزاء|أسباب.*نتائج.*حلول|كل ما يتعلق/i.test(text)
  const complex = count > 55 || /دراسة|إحصائي|مقارنة|مشكلة.*حل|لماذا.*كيف|موقف.*توضيح|أكثر من جانب/i.test(text)
  if (manyAxes) return { duration: 24 as const, segments: 3, days: 1, series: true, reason: 'الموضوع أكبر من فيديو واحد؛ سيُقسّم إلى سلسلة مستقلة بدل حشره في 48 ثانية.' }
  if (count <= 14 && /[؟?]$|اقتباس|ومضة|جملة/i.test(text)) return { duration: 8 as const, segments: 1, days: 1, series: false, reason: 'الفكرة جملة واحدة أو سؤال؛ لقطة واحدة تحافظ على قوتها.' }
  if (complex) return { duration: 48 as const, segments: 6, days: 2, series: false, reason: 'الموضوع يحتاج تفسيراً ومثالاً ورأياً واضحاً؛ ستة مقاطع تمنع الاختزال المخل.' }
  return { duration: 24 as const, segments: 3, days: 1, series: false, reason: 'موضوع عام واحد؛ 24 ثانية تكفي للخطاف والتفسير والخاتمة في رصيد يوم واحد.' }
}

const ARTICLE_ROLES: Record<number, string[]> = {
  3: ['الخطاف', 'جوهر الفكرة', 'الدعوة إلى قراءة المقال'],
  6: ['الخطاف', 'المشكلة', 'الفكرة الأولى', 'الفكرة الثانية أو المثال', 'رأي د. أحمد', 'الخاتمة والدعوة'],
  8: ['الخطاف', 'المشهد أو المشكلة', 'السؤال المركزي', 'الفكرة الأولى', 'المقارنة أو الدليل', 'الفكرة الثانية', 'رأي د. أحمد', 'الخاتمة والدعوة'],
}

const PUBLIC_ROLES: Record<number, string[]> = {
  1: ['الومضة'],
  3: ['الخطاف', 'الفكرة أو التفسير', 'الخاتمة أو السؤال'],
  6: ['الخطاف', 'المشكلة', 'التفسير', 'المثال أو الدليل', 'رأي د. أحمد', 'الخاتمة والدعوة'],
}

function articleNarration(article: ArticleRecord, count: number) {
  const body = article.body || article.excerpt || article.title
  const sentences = meaningfulSentences(body)
  const central = clipWords(article.excerpt || sentences[0] || article.title, 12, article.title)
  const first = clipWords(sentences.find((item) => item !== sentences[0]) || central, 11, central)
  const second = clipWords(sentences.find((item) => item !== sentences[0] && item !== sentences[1]) || strongestQuote(body), 11, central)
  const quote = clipWords(strongestQuote(body), 11, central)
  const six = [
    `ماذا لو كان ${clipWords(article.title, 7, 'هذا السؤال')} أعمق مما نظن؟`,
    `المشكلة ليست في الحدث وحده؛ بل في أثره على الإنسان.`,
    first,
    second,
    `رأيي أن ${clipWords(quote, 9, 'المعنى يجب أن يسبق الأداة')}.`,
    `الفكرة كاملة في المقال؛ اقرأها ثم اختبرها في واقعك.`,
  ]
  if (count === 3) return [six[0], `جوهر المقال: ${clipWords(central, 10, central)}.`, six[5]]
  if (count === 8) return [six[0], six[1], `السؤال المركزي: ${clipWords(central, 9, central)}.`, six[2], `ويظهر الدليل حين ${clipWords(second, 9, second)}.`, six[3], six[4], six[5]]
  return six
}

function publicNarration(topic: string, message: string, count: number) {
  const central = clipWords(message || topic, 12, topic)
  const one = `${clipWords(central, 11, 'فكرة تستحق التأمل')}.`
  const three = [
    `هل فكرنا فعلاً في ${clipWords(topic, 7, 'هذا السؤال')}؟`,
    `الفكرة ببساطة: ${clipWords(central, 10, central)}.`,
    `ما الذي سيتغير لو أخذنا هذا السؤال بجدية؟`,
  ]
  if (count === 1) return [one]
  if (count === 6) return [
    three[0],
    `المشكلة أننا نرى النتيجة، ولا نسأل عن معناها.`,
    three[1],
    `مثال واحد صادق يكشف ما لا تقوله الشعارات.`,
    `رأيي أن القرار الجيد يبدأ من الإنسان قبل الأداة.`,
    three[2],
  ]
  return three
}

function appearanceFor(index: number, count: number, useAvatar: boolean): FlowAppearance {
  if (!useAvatar) return 'visual_only'
  if (count === 1) return 'avatar_direct'
  if (count === 3) return index === 0 ? 'avatar_direct' : index === 2 ? 'avatar_with_object' : 'visual_only'
  const map: FlowAppearance[] = ['avatar_direct', 'visual_only', 'visual_only', 'visual_only', 'avatar_direct', 'avatar_with_object', 'visual_only', 'avatar_direct']
  return map[index] || 'visual_only'
}

function shotsFor(index: number, role: string, appearance: FlowAppearance): 1 | 2 | 3 {
  if (appearance === 'visual_only') return role.includes('الخطاف') || role.includes('الخاتمة') ? 3 : 2
  if (role.includes('الخطاف') || role.includes('الخاتمة')) return 3
  if (role.includes('رأي')) return 1
  return index % 3 === 0 ? 1 : 2
}

function shotPlan(count: 1 | 2 | 3, appearance: FlowAppearance) {
  const avatar = appearance !== 'visual_only'
  if (count === 1) return [{ from: 0, to: 8, framing: avatar ? 'calm medium close-up, front-facing' : 'single controlled cinematic composition' }]
  if (count === 2) return [
    { from: 0, to: 4.2, framing: avatar ? 'front medium shot' : 'close detail of the symbolic object' },
    { from: 4.2, to: 8, framing: avatar ? 'gentle cut to a three-quarter close-up' : 'wider reveal in the same environment' },
  ]
  return [
    { from: 0, to: 2.5, framing: avatar ? 'brief medium opening shot' : 'close visual hook' },
    { from: 2.5, to: 5.5, framing: avatar ? 'close three-quarter angle, continuous speech' : 'second angle on the same subject' },
    { from: 5.5, to: 8, framing: avatar ? 'return to a slightly wider front shot' : 'clean wider closing shot' },
  ]
}

function constraintsFor(appearance: FlowAppearance, count: number) {
  const common = ['generated text', 'Arabic text inside the scene', 'logos', 'subtitles generated inside Flow', 'multiple locations', 'fast cuts', 'shaky camera', 'visual clutter', 'sudden lighting changes']
  if (appearance === 'visual_only') return [...common, 'extra characters', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
  return [...common, 'face changes', 'identity drift', 'voice changes', 'wardrobe changes', 'age changes', 'lookalike replacement', 'distorted hands', 'extra fingers', 'unnatural mouth movement', 'poor lip synchronization', 'exaggerated gestures', count <= 2 ? 'multiple camera movements' : 'more than three cuts']
}

const AVATAR_LOCK = 'Use Dr. Ahmad’s pre-saved avatar already available in Google Flow. Never create, describe, or substitute a new or similar person. Preserve the approved avatar identity, voice, appearance, wardrobe, realism, and performance continuity across every shot and every clip.'

function buildFlowPrompt(input: {
  segment: Omit<LiveDirectorSegment, 'prompt' | 'promptVersions'>
  title: string
  tone: LiveDirectorTone
  platform: LiveDirectorPlatform
  palette: string
}) {
  const { segment } = input
  const avatar = segment.appearance !== 'visual_only'
  const shotText = segment.shotPlan.map((shot, index) => `Shot ${index + 1} (${shot.from.toFixed(1)}-${shot.to.toFixed(1)}s): ${shot.framing}.`).join(' ')
  const subject = avatar
    ? `${AVATAR_LOCK} Keep body movement simple and natural; no complex hand choreography while speaking.`
    : `Main subject: one clear symbolic object or one human-scale educational moment related to “${input.title}”; no avatar is needed in this clip.`
  const sound = avatar ? 'Natural room ambience under the approved avatar voice; preserve lip synchronization through every angle change.' : 'Subtle natural environmental sound with a restrained Arabic voice-over if narration is used.'
  const dialogue = segment.narration ? `Arabic dialogue or voice-over, exactly one short sentence: "${segment.narration.replace(/"/g, '“')}".` : 'No dialogue.'
  return [
    'Duration: exactly 8 seconds.',
    `Aspect ratio: 9:16 vertical for ${input.platform}.`,
    subject,
    'Location: one calm, premium educational environment; keep the same location, background, time of day and visual moment throughout this clip.',
    `Primary action: ${segment.purpose}. One main action only.`,
    `Shot construction: ${segment.shotCount} ${segment.shotCount === 1 ? 'continuous shot' : 'connected shots'} in the same context. ${shotText}`,
    'Camera movement: one restrained motion per shot, either a slow push-in or a locked camera; no competing movements.',
    'Lighting: soft cinematic daylight with consistent direction and exposure across all cuts.',
    `Visual mood: ${input.tone}, realistic, quiet, refined. Color palette: ${input.palette}.`,
    `Environmental sound: ${sound}`,
    dialogue,
    'Ending: finish on a stable frame with clean negative space for text to be added later during editing, never generated inside Flow.',
    avatar ? `Identity lock: ${AVATAR_LOCK}` : '',
    `Continuity: ${segment.continuity}`,
    `Negative constraints: ${segment.negativeConstraints.join(', ')}.`,
  ].filter(Boolean).join('\n')
}

function buildSegments(input: {
  type: LiveDirectorProjectType
  title: string
  narrations: string[]
  useAvatar: boolean
  tone: LiveDirectorTone
  platform: LiveDirectorPlatform
}) {
  const roles = (input.type === 'article_video' ? ARTICLE_ROLES : PUBLIC_ROLES)[input.narrations.length] || PUBLIC_ROLES[3]
  const palette = 'deep slate blue, warm ivory, restrained muted gold accents'
  return input.narrations.map((narration, index) => {
    const role = roles[index] || `المقطع ${index + 1}`
    const appearance = appearanceFor(index, input.narrations.length, input.useAvatar)
    const shotCount = shotsFor(index, role, appearance)
    const negativeConstraints = constraintsFor(appearance, shotCount)
    const base: Omit<LiveDirectorSegment, 'prompt' | 'promptVersions'> = {
      id: `clip-${index + 1}`,
      order: index + 1,
      day: Math.floor(index / 3) + 1,
      duration: 8,
      role,
      purpose: role.includes('الخطاف') ? 'create an immediate visual question without a greeting' : role.includes('الخاتمة') ? 'resolve the visual idea and leave a memorable final beat' : `communicate ${role} with one visible cause-and-effect action`,
      appearance,
      narration: clipWords(narration, appearance === 'visual_only' ? 14 : 11, narration),
      shotCount,
      shotPlan: shotPlan(shotCount, appearance),
      negativeConstraints,
      continuity: `Same ${palette} palette, soft daylight, 50mm-equivalent realism, consistent background logic, and a visual handoff from clip ${Math.max(1, index)} to clip ${index + 2}.`,
      status: 'not_generated',
      videoUrl: '',
    }
    const prompt = buildFlowPrompt({ segment: base, title: input.title, tone: input.tone, platform: input.platform, palette })
    return { ...base, prompt, promptVersions: [{ prompt, reason: 'النسخة الأولى', createdAt: now() }] }
  })
}

function socialPack(input: { type: LiveDirectorProjectType; title: string; idea: string; articleUrl?: string; linkedArticle?: ArticleRecord | null; archive?: ArticleRecord[] }): LiveDirectorSocialPack {
  const link = input.articleUrl ? `\n${input.articleUrl}` : ''
  const question = input.title.endsWith('؟') ? input.title : `ماذا يتغير لو أخذنا «${clipWords(input.title, 8, input.title)}» بجدية؟`
  let articleDecision: LiveDirectorSocialPack['articleDecision']
  if (input.type === 'public_topic_video') {
    if (input.linkedArticle) articleDecision = 'اربطه بمقالة موجودة'
    else if ((input.archive || []).length) {
      const addition = genuineAdditionMeter(input.title, input.idea, input.archive || [])
      articleDecision = addition.verdict === 'قريب من الأرشيف' ? 'حدّث مقالة قديمة' : addition.verdict === 'إضافة واضحة' ? 'حوّله إلى فكرة مقال' : 'أرسله إلى مجلس التحرير'
    } else articleDecision = 'أرسله إلى مجلس التحرير'
  }
  return {
    coverText: clipWords(input.title, 7, input.title),
    caption: `${question}\n\n${clipWords(input.idea, 34, input.title)}\n\nالفيديو يفتح السؤال؛ والتفصيل يبقى في المادة الأصلية.${link}`,
    x: `${question}\n\nليست الفكرة أن نضيف أداة جديدة، بل أن نعرف ماذا تضيف إلى الإنسان.${link}`,
    instagram: `${question}\n\nقد تبدو المسألة تقنية، لكن أثرها يظهر في قرار صغير داخل الصف أو البيت. احفظ الفكرة وجرّب أن تسأل: من يتعلم أكثر فعلاً؟${link}`,
    linkedin: `${input.title}\n\n${clipWords(input.idea, 44, input.title)}\n\nفي التعليم والقيادة، جودة القرار لا تُقاس بحداثة الأداة، بل بوضوح الهدف ومسؤولية التطبيق. ما المعيار الذي تستخدمونه قبل التوسع؟${link}`,
    youtube: `${clipWords(input.idea, 55, input.title)}\n\n${input.type === 'article_video' ? `اقرأ المقالة كاملة: ${input.articleUrl || ''}` : 'هذا الفيديو جزء من مشروع د. أحمد الفكري والتربوي.'}`,
    audienceQuestion: question,
    callToAction: input.type === 'article_video' ? 'اقرأ المقالة كاملة من الرابط.' : 'اكتب المثال الذي ترى فيه الفكرة بوضوح.',
    hashtags: ['#التعليم', '#تكنولوجيا_التعليم'].slice(0, 2),
    thumbnailIdea: 'لقطة نظيفة عالية التباين من أقوى مشهد، مع مساحة فارغة لإضافة عنوان الغلاف يدوياً خارج Flow.',
    articleDecision,
  }
}

function quality(project: Pick<LiveDirectorProject, 'idea' | 'duration' | 'durationReason' | 'segments' | 'useAvatar' | 'social'>): LiveDirectorQuality {
  const speechTooLong = project.segments.some((segment) => wordCount(segment.narration) > (segment.appearance === 'visual_only' ? 14 : 11))
  const avatarCount = project.segments.filter((segment) => segment.appearance !== 'visual_only').length
  const repeatedAppearances = new Set(project.segments.map((segment) => `${segment.appearance}:${segment.shotCount}`)).size < Math.min(3, project.segments.length)
  const socialDistinct = new Set([project.social.x, project.social.instagram, project.social.linkedin]).size === 3
  const notes: string[] = []
  if (speechTooLong) notes.push('اختصر جملة أحد المقاطع لتبقى طبيعية خلال ثماني ثوانٍ.')
  if (project.useAvatar && avatarCount === project.segments.length && project.segments.length > 1) notes.push('خفّف ظهور الأفتار؛ ليس مطلوباً في كل المقاطع.')
  if (repeatedAppearances) notes.push('نوّع بناء اللقطات أو وظيفة المشهد لمنع الإيقاع المتوقع.')
  if (!socialDistinct) notes.push('أعد تمييز لغة المنصات؛ لا تقبل نسخ النص نفسه.')
  return {
    idea: wordCount(project.idea) >= 5 ? 'ممتاز' : 'يحتاج مراجعة',
    duration: project.durationReason && [8, 24, 48, 64].includes(project.duration) ? 'ممتاز' : 'يحتاج مراجعة',
    clips: speechTooLong ? 'يحتاج تبسيطاً' : repeatedAppearances ? 'جيد' : 'ممتاز',
    avatar: !project.useAvatar || (avatarCount < project.segments.length && avatarCount <= Math.ceil(project.segments.length / 2)) ? 'ممتاز' : 'يحتاج تبسيطاً',
    publishing: socialDistinct ? 'ممتاز' : 'يحتاج مراجعة',
    notes: notes.length ? notes : ['الرسالة والمدة والمقاطع والهوية ومواد النشر متسقة وجاهزة للمراجعة البشرية.'],
  }
}

function seriesPlan(topic: string) {
  return [
    `الجزء الأول: ما المشكلة في ${clipWords(topic, 7, topic)}؟`,
    'الجزء الثاني: لماذا تحدث؟',
    'الجزء الثالث: ماذا نفعل؟',
    'الجزء الرابع: رأي د. أحمد.',
    'الجزء الخامس: سؤال للجمهور.',
  ]
}

export function createArticleVideoProject(input: ArticleVideoInput): LiveDirectorProject {
  const recommended = recommendArticleVideoDuration(input.article)
  const duration = input.preferredDuration || recommended.duration
  const segmentCount = duration / 8
  const recommendation = input.preferredDuration
    ? { duration, segments: segmentCount, days: Math.ceil(segmentCount / 3), reason: `اختيار يدوي: ${duration} ثانية، مع بقاء حد ثلاثة مقاطع يومياً.` }
    : recommended
  const title = input.article.title
  const idea = input.article.excerpt || clipWords(input.article.body || '', 30, title)
  const narrations = articleNarration(input.article, recommendation.segments)
  const segments = buildSegments({ type: 'article_video', title, narrations, useAvatar: input.useAvatar !== false, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات' })
  const social = socialPack({ type: 'article_video', title, idea, articleUrl: `/articles/${input.article.slug}` })
  const base: LiveDirectorProject = {
    id: projectId('article_video', input.article.slug), type: 'article_video', articleId: input.article.slug, articleUrl: `/articles/${input.article.slug}`,
    title, idea, centralMessage: idea, audience: input.audience || 'الجمهور العام والمهتمون بالتعليم', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: input.useAvatar !== false,
    series: false, seriesPlan: [], duration: recommendation.duration, durationReason: recommendation.reason, segmentCount: recommendation.segments, days: recommendation.days,
    narration: narrations.join(' '), identityLock: AVATAR_LOCK, continuityNotes: [
      'استخدم أفتار د. أحمد المحفوظ داخل Flow فقط؛ لا تطلب صورة مرجعية جديدة.',
      'الملابس والصوت والهوية المعتمدة ثابتة في كل ظهور.',
      'إضاءة نهارية ناعمة ولوحة أزرق داكن وعاجي ولمسة ذهبية هادئة.',
      'لا يزيد التوليد اليومي على ثلاثة مقاطع؛ اليوم التالي يكمل المشروع ولا يعيده.',
    ], segments, social, quality: {} as LiveDirectorQuality, status: 'prompts_ready', finalVideoUrl: '', youtubeUrl: '', coverUrl: '', source: input.source || `/articles/${input.article.slug}`, sourceSessionId: input.sourceSessionId || '', linkedEditorialDecisionId: input.linkedEditorialDecisionId || '', linkedCampaignId: input.linkedCampaignId || '', createdAtClient: now(), updatedAtClient: now(),
  }
  base.quality = quality(base)
  return base
}

export function createPublicVideoProject(input: PublicVideoInput): LiveDirectorProject {
  const recommended = recommendPublicVideoDuration(input)
  const title = suggestStrongTitle(input.topic)
  const idea = input.message?.trim() || input.topic.trim()
  const narrations = publicNarration(input.topic, idea, recommended.segments)
  const segments = buildSegments({ type: 'public_topic_video', title, narrations, useAvatar: input.useAvatar !== false, tone: input.tone || 'فكرية', platform: input.platform || 'متعدد المنصات' })
  const social = socialPack({ type: 'public_topic_video', title, idea, linkedArticle: input.linkedArticle, articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '', archive: input.archive })
  const base: LiveDirectorProject = {
    id: projectId('public_topic_video', input.topic), type: 'public_topic_video', articleId: input.linkedArticle?.slug || '', articleUrl: input.linkedArticle ? `/articles/${input.linkedArticle.slug}` : '',
    title, idea, centralMessage: clipWords(idea, 30, title), audience: input.audience || 'الجمهور العام', platform: input.platform || 'متعدد المنصات', tone: input.tone || 'فكرية', useAvatar: input.useAvatar !== false,
    series: recommended.series, seriesPlan: recommended.series ? seriesPlan(input.topic) : [], duration: recommended.duration, durationReason: recommended.reason, segmentCount: recommended.segments, days: recommended.days,
    narration: narrations.join(' '), identityLock: AVATAR_LOCK, continuityNotes: [
      'إذا ظهر الأفتار، استخدم النسخة المحفوظة داخل Flow بلا رفع أو وصف جديد.',
      'المكان واللحظة والإضاءة ثابتة داخل كل مقطع، مع رابط بصري بين المقاطع.',
      'غيّر حجم اللقطة أو الزاوية فقط؛ لا تغيّر الشخصية أو الملابس أو الخلفية.',
      'ثلاثة مقاطع يومياً كحد تخطيطي ثابت.',
    ], segments, social, quality: {} as LiveDirectorQuality, status: 'prompts_ready', finalVideoUrl: '', youtubeUrl: '', coverUrl: '', source: input.source || '', sourceSessionId: input.sourceSessionId || '', linkedEditorialDecisionId: input.linkedEditorialDecisionId || '', linkedCampaignId: input.linkedCampaignId || '', createdAtClient: now(), updatedAtClient: now(),
  }
  base.quality = quality(base)
  return base
}

export const LIVE_DIRECTOR_REPAIR_ISSUES = [
  'تغير الوجه', 'تغيرت الملابس', 'الحركة غير طبيعية', 'الكلام غير واضح', 'مزامنة الفم سيئة', 'المشهد مزدحم', 'الفكرة غير مفهومة', 'الكاميرا غير مناسبة', 'الإضاءة ضعيفة', 'النتيجة غير واقعية', 'المقطع لا يتصل بما قبله', 'المقطع لا يتصل بما بعده',
] as const

const REPAIR_HINTS: Record<(typeof LIVE_DIRECTOR_REPAIR_ISSUES)[number], string> = {
  'تغير الوجه': 'Use only the saved Dr. Ahmad avatar and lock identity more strongly across every shot; prefer one continuous front-facing shot.',
  'تغيرت الملابس': 'Lock the approved saved-avatar wardrobe; do not reinterpret fabric, color, ghutra or agal between shots.',
  'الحركة غير طبيعية': 'Reduce motion to one natural breath, one small head movement and still hands.',
  'الكلام غير واضح': 'Shorten the Arabic line and use one calm continuous shot with natural speaking pace.',
  'مزامنة الفم سيئة': 'Use one continuous close shot; preserve exact Arabic phoneme timing and remove competing gestures.',
  'المشهد مزدحم': 'Remove secondary objects and people; keep one subject, one action and generous negative space.',
  'الفكرة غير مفهومة': 'Replace decoration with one visible cause-and-effect action that directly represents the segment purpose.',
  'الكاميرا غير مناسبة': 'Use a stable 50mm-equivalent medium shot and one slow push-in only.',
  'الإضاءة ضعيفة': 'Use soft directional daylight on the subject with stable exposure and a clean background separation.',
  'النتيجة غير واقعية': 'Increase photorealism, natural skin/material texture and restrained practical lighting; remove stylized effects.',
  'المقطع لا يتصل بما قبله': 'Start with the same object, gaze direction, sound texture and light direction used at the end of the previous clip.',
  'المقطع لا يتصل بما بعده': 'End on a stable visual handoff object and gaze direction that the next clip can inherit.',
}

/** يصلح مقطعاً واحداً ويُبقي مراجع بقية المقاطع بلا تغيير. */
export function repairLiveDirectorSegment(project: LiveDirectorProject, segmentId: string, issue: (typeof LIVE_DIRECTOR_REPAIR_ISSUES)[number]) {
  const index = project.segments.findIndex((segment) => segment.id === segmentId)
  if (index < 0) return project
  const previous = project.segments[index]
  const hint = REPAIR_HINTS[issue]
  const prompt = `${previous.prompt}\n\nTargeted correction for this clip only: ${hint}\nPreserve every approved continuity choice from the other clips. Do not regenerate or reinterpret the project.`
  const nextSegment: LiveDirectorSegment = {
    ...previous,
    prompt,
    status: 'needs_revision',
    promptVersions: [...previous.promptVersions, { prompt, reason: issue, createdAt: now() }],
  }
  const segments = project.segments.map((segment, segmentIndex) => segmentIndex === index ? nextSegment : segment)
  const next = { ...project, segments, status: 'needs_revision' as const, updatedAtClient: now() }
  return { ...next, quality: quality(next) }
}

export function setLiveDirectorSegmentStatus(project: LiveDirectorProject, segmentId: string, status: LiveDirectorClipStatus, videoUrl = '') {
  const segments = project.segments.map((segment) => segment.id === segmentId ? { ...segment, status, videoUrl: videoUrl || segment.videoUrl } : segment)
  const allApproved = segments.every((segment) => ['approved', 'uploaded'].includes(segment.status))
  return { ...project, segments, status: allApproved ? 'clips_approved' as const : project.status, updatedAtClient: now() }
}

export function isValidYouTubeUrl(value: string) {
  try {
    const url = new URL(value)
    return ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'].includes(url.hostname) && Boolean(url.pathname.replace(/\//g, '') || url.searchParams.get('v'))
  } catch { return false }
}

export function liveDirectorDailyPlan(project: LiveDirectorProject) {
  return Array.from({ length: project.days }, (_, dayIndex) => ({
    day: dayIndex + 1,
    clips: project.segments.filter((segment) => segment.day === dayIndex + 1),
  }))
}
