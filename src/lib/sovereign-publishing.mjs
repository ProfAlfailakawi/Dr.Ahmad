import { buildMultimodalMeaningCourt } from './semantic-court.mjs'

const ARABIC_MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06edـ]/g

const STOP_WORDS = new Set([
  'الى', 'علي', 'على', 'عن', 'في', 'من', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'هناك', 'هنا',
  'التي', 'الذي', 'الذين', 'كان', 'كانت', 'يكون', 'تكون', 'كما', 'لكن', 'لان', 'أن', 'ان',
  'او', 'أو', 'ثم', 'كل', 'بين', 'بعد', 'قبل', 'حول', 'عند', 'عبر', 'قد', 'لا', 'ما', 'هو',
  'هي', 'هم', 'نحن', 'انت', 'حتى', 'ضمن', 'غير', 'the', 'and', 'for', 'from', 'with', 'into',
  'that', 'this', 'are', 'was', 'were', 'has', 'have', 'will', 'about', 'after', 'before', 'new',
])

function clamp(value, minimum = 0, maximum = 100) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)))
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

export function stableCanonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableCanonicalJson(item)).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableCanonicalJson(value[key])}`).join(',')}}`
}

function normal(value = '') {
  return text(value)
    .toLowerCase()
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function conceptKey(token) {
  let value = normal(token)
  if (/^[\u0600-\u06ff]+$/u.test(value)) {
    if (value.startsWith('ال') && value.length > 5) value = value.slice(2)
    if (value.length > 5) value = value.replace(/(?:يات|ات|ون|ين|يه|ية|ها|هم)$/u, '')
  } else if (value.length > 5) {
    value = value.replace(/(?:ing|ed|es|s)$/u, '')
  }
  return value
}

function concepts(value) {
  return unique(normal(value).split(/\s+/).map(conceptKey).filter((token) => token.length >= 3 && !STOP_WORDS.has(token)))
}

function overlap(left, right) {
  const wanted = new Set(right)
  return unique(left.filter((item) => wanted.has(item)))
}

function wordCount(value = '') {
  return text(value).split(/\s+/).filter(Boolean).length
}

function status(ok, review = false) {
  return ok ? 'verified' : review ? 'review' : 'pending'
}

/**
 * Builds the evidence manifest that is later hashed and signed by the server.
 * It deliberately records missing layers: the signature proves the exact state,
 * while releaseReady is true only when all five layers are present and reviewed.
 */
export function buildPublicationPassportDraft(input = {}) {
  const article = input.article || {}
  const evidence = input.evidence || {}
  const social = input.social || {}
  const design = input.design || {}
  const audio = input.audio || {}
  const sourceIds = unique([...(evidence.sourceIds || []), ...(evidence.paperSlugs || []), text(evidence.articleSource)])
  const sourceProofs = unique(evidence.proofs || [])
  const sourceAlerts = unique(evidence.alerts || [])
  const audioAssets = unique(audio.assets || [])
  const tweetCount = Math.max(0, Number(social.tweetCount || 0))
  const platformCount = Math.max(0, Number(social.platformCount || 0))
  const designCount = Math.max(0, Number(design.assetCount || 0))
  const words = wordCount(article.body || '')
  const semanticCourtInput = input.semanticCourtInput || {}
  const semanticCourt = input.semanticCourt || buildMultimodalMeaningCourt(semanticCourtInput)
  const components = {
    text: {
      status: status(Boolean(text(article.slug) && text(article.title) && words >= 350)),
      wordCount: words,
      title: text(article.title),
      slug: text(article.slug),
      body: text(article.body),
      excerpt: text(article.excerpt),
      meaningFingerprint: text(article.meaningFingerprint),
    },
    audio: {
      status: status(audioAssets.length > 0),
      assets: audioAssets,
      note: audioAssets.length ? 'ملفات الصوت مثبتة في الفهرس.' : 'لا يوجد ملف صوت مثبت لهذه النسخة بعد.',
    },
    design: {
      status: status(designCount > 0 && Number(design.qualityScore || 0) >= 70, designCount > 0),
      assetCount: designCount,
      qualityScore: clamp(Number(design.qualityScore || 0)),
      fingerprints: unique(design.fingerprints || []).slice(0, 40),
    },
    social: {
      status: status(tweetCount > 0 && platformCount >= 2),
      tweetCount,
      platformCount,
      campaignId: text(social.campaignId),
      content: text(social.content),
    },
    sources: {
      status: status(sourceIds.length > 0 && sourceProofs.length > 0 && sourceAlerts.length === 0, sourceIds.length > 0),
      ids: sourceIds.slice(0, 80),
      proofs: sourceProofs.slice(0, 80),
      alerts: sourceAlerts.slice(0, 30),
    },
  }
  const labels = { text: 'النص', audio: 'الصوت', design: 'التصميم', social: 'التغريدات', sources: 'المصادر' }
  const blocking = Object.entries(components)
    .filter(([, component]) => component.status !== 'verified')
    .map(([key]) => labels[key])
  if (!semanticCourt.releaseReady) blocking.push('محكمة المعنى')
  return {
    schemaVersion: 1,
    kind: 'sovereign-publication-passport',
    article: { slug: text(article.slug), title: text(article.title) },
    components,
    semanticCourt,
    // دليل عابر إلى نقطة التوقيع فقط؛ sealPublicationPassportDraft يحذفه،
    // والخادم يعيد بناء الحكم منه ولا يثق بحكم الواجهة المرسل.
    _semanticCourtInput: semanticCourtInput,
    releaseDecision: {
      targetStatus: ['published', 'scheduled'].includes(text(input.releaseDecision?.targetStatus)) ? text(input.releaseDecision.targetStatus) : 'draft',
      manualOverride: input.releaseDecision?.manualOverride === true,
      overrideReason: text(input.releaseDecision?.overrideReason),
    },
    releaseReady: blocking.length === 0,
    blocking,
  }
}

export async function sealPublicationPassportDraft(draft, digest) {
  if (typeof digest !== 'function') throw new Error('A SHA-256 digest function is required')
  const next = JSON.parse(JSON.stringify(draft))
  const textComponent = next.components.text
  const socialComponent = next.components.social
  delete next._semanticCourtInput
  textComponent.bodyHash = await digest(textComponent.body || '')
  textComponent.excerptHash = await digest(textComponent.excerpt || '')
  delete textComponent.body
  delete textComponent.excerpt
  socialComponent.contentHash = await digest(socialComponent.content || '')
  delete socialComponent.content
  if (next.semanticCourt && typeof next.semanticCourt === 'object') {
    const court = next.semanticCourt
    court.alertHashes = await Promise.all((court.alerts || []).map((item) => digest(String(item))))
    delete court.alerts
    for (const groupName of ['chambers', 'safeguards']) {
      const group = court[groupName] || {}
      for (const item of Object.values(group)) {
        item.alertHashes = await Promise.all((item.alerts || []).map((alert) => digest(String(alert))))
        delete item.alerts
        delete item.units
      }
    }
  }
  return next
}

export function buildTransformingCampaign(input = {}) {
  const bundle = input.bundle || {}
  const pack = input.pack || {}
  const quote = text(pack.quote) || text(bundle.excerpt) || text(bundle.title)
  const question = text(pack.question) || `ما الذي تغيّره فكرة «${text(bundle.title)}» في قرارنا اليوم؟`
  const title = text(bundle.title) || 'الفكرة المحورية'
  const excerpt = text(bundle.excerpt)
  const linkedIn = Array.isArray(pack.linkedin) ? pack.linkedin : []
  const x = Array.isArray(pack.x) ? pack.x : []
  const stages = [
    {
      day: 1, platform: 'LinkedIn', role: 'افتح', goal: 'إعلان القضية ووعد الرحلة',
      carriesFrom: '', handoff: 'غداً نحول الفكرة إلى سؤال يختبرها عند الجمهور.',
      copy: text(linkedIn[0]) || `${title}\n\n${excerpt}`,
      decisionSignal: 'التعليقات التي تعيد صياغة المشكلة بكلمات الجمهور.',
    },
    {
      day: 2, platform: 'X', role: 'اختبر', goal: 'تحويل أطروحة الأمس إلى سؤال واحد',
      carriesFrom: 'يأخذ وعد اليوم الأول ولا يعيد مقدمته.', handoff: 'إجابات اليوم تحدد الاعتراض الذي نفككه غداً.',
      copy: `أمس فتحتُ سؤال «${title}». واليوم أختبره مباشرة:\n\n${question}`,
      decisionSignal: 'أكثر اعتراض متكرر أو إجابة تحمل مفارقة حقيقية.',
    },
    {
      day: 3, platform: 'Instagram Carousel', role: 'فكّك', goal: 'الإجابة بصرياً عن اعتراض الجمهور',
      carriesFrom: 'يبني الشرائح على السؤال والاعتراض الأقوى من اليوم الثاني.', handoff: 'غداً نخرج من الرأي إلى الدليل والخبرة.',
      copy: `${title}\n\n١. ما قيل في النقاش.\n٢. أين يقع الالتباس؟\n٣. المعيار الذي يحسمه.\n٤. ماذا يتغير في الممارسة؟`,
      decisionSignal: 'الحفظ والمشاركة؛ لأنهما أدق من الإعجاب في المحتوى التفسيري.',
    },
    {
      day: 4, platform: 'LinkedIn', role: 'أثبت', goal: 'ربط الفكرة بالدليل والأرشيف',
      carriesFrom: 'ينقل خلاصة الكاروسيل إلى حجة موثقة لا إلى منشور جديد.', handoff: 'غداً نكثف الحجة في جملة تحملها الذاكرة.',
      copy: text(linkedIn[1]) || `${quote}\n\nهذه ليست جملة منفصلة؛ إنها خلاصة ما بدأناه قبل ثلاثة أيام حول «${title}».`,
      decisionSignal: 'النقر على المقال والمناقشات التي تستشهد بالمصدر أو الخبرة.',
    },
    {
      day: 5, platform: 'X', role: 'كثّف', goal: 'تثبيت قلب الحملة في عبارة قابلة للحمل',
      carriesFrom: 'يقطّر دليل اليوم الرابع في عبارة واحدة.', handoff: 'غداً نعيد العبارة إلى الناس ونطلب منهم قراراً.',
      copy: `${text(x[0]) || quote}\n\nاليوم الخامس من نقاش «${title}».`,
      decisionSignal: 'الاقتباسات وإعادة النشر مع تعليق، لا إعادة النشر الصامتة فقط.',
    },
    {
      day: 6, platform: 'Instagram Story', role: 'أشرك', goal: 'تحويل المتلقي من قارئ إلى شريك قرار',
      carriesFrom: 'يحوّل عبارة اليوم الخامس إلى مفاضلة عملية.', handoff: 'نتيجة التصويت تصبح افتتاحية الخاتمة غداً.',
      copy: `بعد خمسة أيام من «${title}»:\nما القرار الأقرب إليك الآن؟\n\n[أبدأ به]\n[أراجعه]\n[أختلف معه]`,
      decisionSignal: 'نتيجة التصويت والردود النوعية؛ وتُحفظ كمدخل لخاتمة اليوم السابع.',
    },
    {
      day: 7, platform: 'Newsletter', role: 'أغلق وافتح', goal: 'تلخيص ما تغيّر وفتح الخطوة التالية',
      carriesFrom: 'يبدأ بما كشفه تصويت اليوم السادس، ثم يعيد القارئ إلى الأصل.', handoff: 'يُحفظ السؤال المفتوح كبذرة الحملة التالية، لا كمنشور ثامن.',
      copy: `بدأنا الأسبوع بسؤال «${title}»، واختبرناه وفككناه وربطناه بالدليل.\n\n${excerpt}\n\nالآن لا أسألك ماذا أعجبك؛ أسألك: ما القرار الصغير الذي سيتغير غداً؟`,
      decisionSignal: 'العودة إلى المقال والرد الذي يذكر قراراً قابلاً للتنفيذ.',
    },
  ]
  const linkedStages = stages.filter((stage, index) => index === 0 || (stage.carriesFrom && stage.handoff)).length
  return {
    schemaVersion: 2,
    kind: 'transforming-seven-day-campaign',
    id: `${normal(bundle.slug || title).replace(/\s+/g, '-').slice(0, 80) || 'campaign'}-7d`,
    title,
    thesis: excerpt || quote,
    promise: `رحلة واحدة: من فتح السؤال إلى قرار عملي، وكل يوم يرث ما قبله.`,
    continuityScore: clamp((linkedStages / stages.length) * 100),
    stages,
  }
}

function eventAgeHours(event, now) {
  if (Number.isFinite(Number(event.ageHours)) && Number(event.ageHours) >= 0) return Number(event.ageHours)
  const published = Date.parse(text(event.publishedAt))
  return Number.isFinite(published) ? Math.max(0, (now - published) / 3_600_000) : null
}

/** Returns only documented, fresh archive opportunities above the confidence floor. */
export function buildOpportunityRadar(events = [], articles = [], options = {}) {
  const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now()
  const threshold = clamp(Number(options.threshold || 78), 60, 98)
  const candidates = []
  for (const event of events) {
    const url = text(event.url)
    const source = text(event.source)
    const ageHours = eventAgeHours(event, now)
    if (!/^https:\/\//i.test(url) || !source || ageHours == null || ageHours > 168) continue
    const eventTitleConcepts = concepts(event.title)
    const eventConcepts = concepts(`${event.title || ''} ${event.summary || ''}`)
    if (eventConcepts.length < 2) continue
    for (const article of articles) {
      const archiveConcepts = concepts(`${article.title || ''} ${article.excerpt || ''} ${article.body || ''}`)
      const articleTitleConcepts = concepts(`${article.title || ''} ${article.excerpt || ''}`)
      const shared = overlap(eventConcepts, archiveConcepts)
      const sharedInTitles = overlap(eventTitleConcepts, articleTitleConcepts)
      if (shared.length < 2 || (!sharedInTitles.length && shared.length < 3)) continue
      const topical = clamp(42 + shared.length * 10 + sharedInTitles.length * 10 + Math.min(8, Number(event.relevance || 0) * 2))
      const recency = ageHours <= 24 ? 100 : ageHours <= 72 ? 92 : ageHours <= 120 ? 82 : 72
      const evidence = text(event.publishedAt) || Number.isFinite(Number(event.ageHours)) ? 100 : 0
      const archiveStrength = clamp(55 + Math.min(35, shared.length * 8) + (text(article.iso) ? 10 : 0))
      const confidence = clamp(topical * .52 + recency * .2 + evidence * .18 + archiveStrength * .1)
      if (confidence < threshold) continue
      candidates.push({
        id: `${text(event.id) || normal(event.title).slice(0, 50)}:${text(article.slug)}`,
        confidence,
        threshold,
        event: {
          id: text(event.id), title: text(event.title), summary: text(event.summary), source, url,
          publishedAt: text(event.publishedAt), ageHours: Math.round(ageHours),
        },
        article: { slug: text(article.slug), title: text(article.title), excerpt: text(article.excerpt), iso: text(article.iso) },
        sharedConcepts: shared.slice(0, 8),
        breakdown: { topical, recency, evidence, archiveStrength },
        whyNow: `يلتقي الحدث بالمادة في ${shared.slice(0, 4).join('، ')}؛ المصدر مثبت، وعمر الإشارة ${Math.round(ageHours)} ساعة.`,
        recommendation: `أعد فتح «${text(article.title)}» من زاوية الحدث، ولا تعِد نشر الرابط وحده.`,
      })
    }
  }
  const bestPerArticle = new Map()
  for (const item of candidates.sort((left, right) => right.confidence - left.confidence)) {
    if (!bestPerArticle.has(item.article.slug)) bestPerArticle.set(item.article.slug, item)
  }
  return [...bestPerArticle.values()].slice(0, Math.max(1, Math.min(8, Number(options.limit || 4))))
}
