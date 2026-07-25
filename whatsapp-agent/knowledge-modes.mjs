import { findContent, normalizeArabic, searchContent } from './content-index.mjs'

export const KNOWLEDGE_MODES = Object.freeze({
  ARCHIVE: 'archive',
  VERIFIED_RESEARCH: 'verified-research',
  EXPLAIN: 'explain',
  DIALOGUE: 'dialogue',
  HUMAN: 'human-handoff',
})

export const SOURCE_POLICIES = Object.freeze({
  education: ['جهة حكومية تعليمية', 'جامعة', 'دورية محكّمة', 'منظمة تعليمية دولية', 'بحث أصلي'],
  health: ['جهة صحية رسمية', 'دليل إرشادي معتمد', 'دراسة محكّمة'],
  law: ['نص رسمي', 'جهة حكومية', 'تاريخ نفاذ واضح'],
  current: ['مصدر أولي', 'تاريخ الحدث', 'تأكيد مستقل عند الحاجة'],
})

const DEFAULT_PERSONALITY = Object.freeze({
  verbosity: 'layered',
  dialect: 'kuwaiti-light',
  initiative: 'one-question',
  signature: 'always',
  memoryConsent: 'explicit',
})
const PERSONALITY_OPTIONS = Object.freeze({
  verbosity: new Set(['brief', 'layered', 'detailed']),
  dialect: new Set(['formal-arabic', 'kuwaiti-light', 'neutral-arabic']),
  initiative: new Set(['none', 'one-question', 'guided']),
})

const clean = (value = '') => normalizeArabic(String(value || '')).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const tokens = (value = '') => clean(value).split(/\s+/).filter((word) => word.length > 2)
const stripModeWords = (value = '') => String(value || '')
  .replace(/(?:بحث\s+موثوق|مصادر\s+خارجيه|دراسه\s+حديثه|اشرح\s+لي|اشرحها|بالتفصيل|في\s+سطرين|في\s+دقيقه|لطالب|لولي\s+امر|لمعلم|لباحث|حاورني|عارضني|اختبر\s+الفكره|رحله\s+خمس\s+دقائق|من\s+اين\s+جاءت\s+الاجابه)/giu, ' ')
  .replace(/\s+/g, ' ').trim()

function personalityOf(db) {
  let stored = {}
  try { stored = db?.getSetting?.('knowledge.personality', {}) || {} } catch { stored = {} }
  const next = { ...DEFAULT_PERSONALITY }
  for (const key of ['verbosity', 'dialect', 'initiative']) {
    if (PERSONALITY_OPTIONS[key].has(String(stored[key] || ''))) next[key] = String(stored[key])
  }
  return next
}

function followupLine(db, { kind = 'general' } = {}) {
  const personality = personalityOf(db)
  if (personality.initiative === 'none') return ''
  const kuwaiti = personality.dialect === 'kuwaiti-light'
  if (personality.initiative === 'guided') {
    if (kind === 'research') return kuwaiti ? 'أكمل لك من زاوية: قوة الدليل، التطبيق، أو الرأي المعارض؟' : 'يمكن متابعة الإجابة من زاوية قوة الدليل، أو التطبيق، أو الرأي المعارض.'
    if (kind === 'explain') return kuwaiti ? 'نكمل من زاوية الدليل، التطبيق، أو الاعتراض الأقوى؟' : 'يمكن متابعة الشرح من زاوية الدليل، أو التطبيق، أو الاعتراض الأقوى.'
    return kuwaiti ? 'نختبرها، نعارضها، أو نحولها إلى رحلة خمس دقائق؟' : 'يمكن اختبار الفكرة، أو بناء اعتراض موثق، أو تحويلها إلى رحلة خمس دقائق.'
  }
  if (kind === 'research') return kuwaiti ? 'أي زاوية أهم لك الآن: قوة الدليل أم تطبيقه؟' : 'ما الزاوية الأهم الآن: قوة الدليل أم تطبيقه؟'
  if (kind === 'explain') return kuwaiti ? 'أي جزء تبي أفتحه أكثر: الدليل أم التطبيق؟' : 'أي جزء تريد فتحه أكثر: الدليل أم التطبيق؟'
  return kuwaiti ? 'أي جزء تبي نختبره أولًا؟' : 'أي جزء تريد اختباره أولًا؟'
}

const SENSITIVE = [
  ['health', /(?:دواء|علاج|تشخيص|اعراض|مرض|صحه|طبيب|(?:^|\s)الم(?:\s|$)|جرعه|حمل|نفسي|اكتئاب|قلق|انتحار|ايذاء)/],
  ['law', /(?:قانون|محكمه|قضيه|شكوي|شكوى|بلاغ|عقد|محامي|جريمه|اقامه|جواز|وزارة الداخليه)/],
  ['appointment', /(?:موعد|مقابله|اقابلك|اتواصل مع الدكتور|رقم الدكتور|اشراف|يشرف علي|رساله للدكتور)/],
  ['personal', /(?:مشكلتي|ابني|بنتي|زوجي|زوجتي|مديري|راتبي|وظيفتي|ظروفي|ساعدني شخصيا|رايك الشخصي)/],
]

export function sensitiveDomain(text = '') {
  const value = clean(text)
  for (const [domain, pattern] of SENSITIVE) if (pattern.test(value)) return domain
  return null
}

export function detectKnowledgeMode(text = '') {
  const value = clean(text)
  if (sensitiveDomain(value)) return KNOWLEDGE_MODES.HUMAN
  if (/(?:بحث موثوق|مصادر خارجيه|دراسه حديثه|ما تقوله الدراسات|جهة رسميه|مصدر رسمي)/.test(value)) return KNOWLEDGE_MODES.VERIFIED_RESEARCH
  if (/(?:اشرح لي|اشرحها|بالتفصيل|في سطرين|في دقيقه|لطالب|لولي امر|لمعلم|لباحث)/.test(value)) return KNOWLEDGE_MODES.EXPLAIN
  if (/(?:حاورني|عارضني|اختبر الفكره|رحله خمس دقائق|ناقشني|اسالني)/.test(value)) return KNOWLEDGE_MODES.DIALOGUE
  return KNOWLEDGE_MODES.ARCHIVE
}

export function humanSafeReply(text = '') {
  const domain = sensitiveDomain(text) || 'personal'
  const labels = {
    health: 'صحي أو نفسي', law: 'قانوني', appointment: 'موعد أو تواصل مباشر', personal: 'شخصي',
  }
  const guidance = domain === 'health'
    ? 'أستطيع عرض معلومات عامة موثقة فقط، ولا أشخّص حالة ولا أقترح علاجًا شخصيًا.'
    : domain === 'law'
      ? 'أستطيع عرض النصوص الرسمية العامة بعد تحديد الدولة وتاريخ النفاذ، ولا أقدّم رأيًا قانونيًا شخصيًا.'
      : domain === 'appointment'
        ? 'سأترك الطلب في مسار المتابعة البشرية، من دون أن أعدك بموعد أو رد باسم الدكتور.'
        : 'لن أجيب باسم الدكتور عن موقف شخصي، لكنني أستطيع مساعدتك في مادة منشورة أو معلومة عامة موثقة.'
  return {
    mode: KNOWLEDGE_MODES.HUMAN,
    needsHuman: true,
    sourcePolicy: domain,
    text: `فهمت أن رسالتك ذات طابع ${labels[domain] || 'شخصي'}، ولذلك لن أختلق جوابًا أو أنسب رأيًا للدكتور.\n${guidance}\nوصلت الرسالة إلى مسار المتابعة، ويمكنك في الوقت نفسه أن تطلب مادة من أرشيف الموقع أو بحثًا موثقًا ضمن الحدود الآمنة.`,
  }
}

function authorityRank(value = '') {
  const normalized = clean(value)
  if (/رسمي|حكوم|وزار|قانون/.test(normalized)) return 5
  if (/جامع|محكم|بحث اصلي|دوريه/.test(normalized)) return 4
  if (/منظمه دوليه|مركز بحث/.test(normalized)) return 3
  return 1
}

export function searchTrustedEvidence(db, query, { limit = 4, domain = '' } = {}) {
  const wanted = tokens(query)
  if (!wanted.length) return []
  let rows = []
  try {
    rows = db.all('SELECT * FROM trusted_evidence WHERE enabled=1 ORDER BY published_at DESC, retrieved_at DESC LIMIT 500')
  } catch { return [] }
  return rows
    .map((row) => {
      const haystack = clean(`${row.title || ''} ${row.claim || ''} ${row.quote || ''} ${row.source_name || ''} ${row.domain || ''}`)
      const matched = wanted.filter((word) => haystack.includes(word)).length
      const domainBonus = domain && clean(row.domain) === clean(domain) ? 2 : 0
      return { ...row, score: matched * 3 + domainBonus + authorityRank(`${row.source_type || ''} ${row.authority || ''}`) }
    })
    .filter((row) => row.score >= Math.max(4, Math.ceil(wanted.length * 1.5)))
    .sort((a, b) => b.score - a.score || String(b.published_at || '').localeCompare(String(a.published_at || '')))
    .slice(0, limit)
}

export function verifiedResearchReply(db, input = '') {
  const personality = personalityOf(db)
  const topic = stripModeWords(input) || input
  const domain = sensitiveDomain(input) === 'law' ? 'law' : /(?:تعليم|مدرس|جامع|طالب|ترب)/.test(clean(input)) ? 'education' : /(?:صحه|مرض|دواء|نفسي)/.test(clean(input)) ? 'health' : 'current'
  const evidenceLimit = personality.verbosity === 'brief' ? 2 : personality.verbosity === 'detailed' ? 6 : 4
  const evidence = searchTrustedEvidence(db, topic, { limit: evidenceLimit, domain })
  if (!evidence.length) {
    return {
      mode: KNOWLEDGE_MODES.VERIFIED_RESEARCH,
      needsHuman: true,
      sourcePolicy: domain,
      text: `فتحت وضع «البحث الموثق»، لكن لا توجد في قاعدة الأدلة الخارجية المعتمدة مادةٌ تكفي للإجابة عن «${topic.trim() || 'هذا السؤال'}».\nلن أملأ الفراغ بتخمين. أستطيع الآن البحث داخل أرشيف د. أحمد، أو تُضاف مادة رسمية/محكّمة إلى قاعدة الأدلة ثم أعيد الإجابة مع تاريخها ومصدرها.`,
    }
  }
  const blocks = evidence.map((item, index) => {
    const date = item.published_at ? ` · ${item.published_at}` : ''
    const quote = item.quote ? `\n«${item.quote}»` : ''
    return `${index + 1}. ${item.claim || item.title}${quote}\n${item.source_name || item.authority || 'مصدر موثق'}${date}\n${item.url}`
  })
  const followup = followupLine(db, { kind: 'research' })
  return {
    mode: KNOWLEDGE_MODES.VERIFIED_RESEARCH,
    sourcePolicy: domain,
    externalEvidence: evidence.map((item) => ({ id: item.id, url: item.url, quote: item.quote || '', claim: item.claim || item.title || '' })),
    text: `هذا جواب «بحث موثّق» منفصل عن رأي د. أحمد:\n\n${blocks.join('\n\n')}\n\nدرجة الحداثة: ${evidence.every((item) => item.published_at) ? 'موثقة بالتواريخ الظاهرة' : 'بعض السجلات بلا تاريخ نشر؛ راجعها قبل الاعتماد النهائي'}.${followup ? `\n\n${followup}` : ''}`,
  }
}

function selectedOrSearch(db, session, input) {
  if (session?.content_id) {
    const selected = findContent(db, session.content_id)
    if (selected) return selected
  }
  const query = stripModeWords(input)
  return searchContent(db, query, { limit: 1 })[0] || null
}

function exactPassages(item, limit = 1) {
  const source = String(item?.body || item?.excerpt || '').replace(/\s+/g, ' ').trim()
  if (!source) return []
  const sentences = source
    .split(/(?<=[.!؟])/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 35 && part.length <= 240)
  if (sentences.length) return sentences.slice(0, Math.max(1, limit))
  return [source.slice(0, 240)]
}

function exactPassage(item) { return exactPassages(item, 1)[0] || '' }

export function explainModeReply(db, session, input = '') {
  const item = selectedOrSearch(db, session, input)
  if (!item) return { mode: KNOWLEDGE_MODES.EXPLAIN, needsHuman: true, text: 'حدد المادة أو الموضوع أولًا، وسأشرح الموجود في المصدر من دون إضافة معلومة غير موثقة.' }
  const personality = personalityOf(db)
  const passageLimit = personality.verbosity === 'detailed' ? 2 : 1
  const passages = exactPassages(item, passageLimit)
  const level = /لباحث/.test(clean(input)) ? 'للباحث' : /لمعلم/.test(clean(input)) ? 'للمعلم' : /لولي امر/.test(clean(input)) ? 'لولي الأمر' : /لطالب/.test(clean(input)) ? 'للطالب' : /في سطرين/.test(clean(input)) ? 'في سطرين' : /في دقيقه/.test(clean(input)) ? 'في دقيقة' : 'بوضوح'
  const framing = level === 'للباحث' ? 'السؤال البحثي هنا هو ما الذي يقوله النص، وما الذي لا يدّعيه.'
    : level === 'للمعلم' ? 'اقرأ الفكرة بوصفها قرارًا في الممارسة: ما الذي يتغير داخل الصف؟'
      : level === 'لولي الأمر' ? 'المعنى العملي: افصل بين الفكرة العامة وبين الحكم على حالة ابنك أو ابنتك.'
        : level === 'لطالب' ? 'الفكرة ببساطة: ابدأ بالمعنى المركزي ثم ارجع إلى المثال في المادة.'
          : 'هذه خلاصة تفسيرية محافظة، والمقاطع بين علامتي الاقتباس من المصدر نفسه.'
  const sourceBlock = passages.map((passage) => `«${passage}»`).join('\n\n')
  const followup = followupLine(db, { kind: 'explain' })
  return {
    mode: KNOWLEDGE_MODES.EXPLAIN,
    text: `شرح ${level}:\n${item.title}\n\n${framing}\n\nمن النص المنشور:\n${sourceBlock}${followup ? `\n\n${followup}` : ''}\n${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: passages,
    preserveContextList: true,
  }
}

export function dialogueModeReply(db, session, input = '') {
  const item = selectedOrSearch(db, session, input)
  if (!item) return { mode: KNOWLEDGE_MODES.DIALOGUE, needsHuman: true, text: 'اختر مادة أو اذكر موضوعًا أولًا، ثم قل: اختبر الفكرة، عارضني، أو رحلة خمس دقائق.' }
  const passage = exactPassage(item)
  const value = clean(input)
  const followup = followupLine(db, { kind: 'dialogue' })
  if (/عارضني|الرأي المعارض/.test(value)) {
    return {
      mode: KNOWLEDGE_MODES.DIALOGUE,
      text: `سأبني أقوى اعتراض كسؤالٍ للاختبار، لا كحقيقة منسوبة إلى المصدر:\n\nإذا كانت الفكرة في «${item.title}» صحيحة، فما الحالة التي قد تفشل فيها؟ وما الدليل الذي سيجعل صاحبها يراجعها؟\n\nابدأ بإجابة قصيرة، ثم أقارنها بما ورد في المادة نفسها.\n${item.url}`,
      contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], preserveContextList: true,
    }
  }
  if (/اختبر الفكره|اختبرني/.test(value)) {
    return {
      mode: KNOWLEDGE_MODES.DIALOGUE,
      text: `اختبر الفكرة في 15 ثانية:\n\nأي خيار أقرب إلى النص؟\n1. نأخذ العنوان وحده كحكم نهائي.\n2. نربط الفكرة بسياقها ودليلها وحدودها.\n\nاكتب 1 أو 2، ثم أفتح لك المقطع الذي يحسمها من المصدر.`,
      contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], preserveContextList: true,
    }
  }
  if (/رحله خمس دقائق/.test(value)) {
    return {
      mode: KNOWLEDGE_MODES.DIALOGUE,
      text: `رحلة خمس دقائق حول «${item.title}»:\n1. الفكرة: ${item.title}\n2. من النص: «${passage}»\n3. السؤال: ما الذي يتغير لو أخذنا هذه العبارة بجدية؟\n4. الاختبار: أين قد يختلف الواقع عن الصياغة؟\n5. العودة إلى الأصل: ${item.url}`,
      contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], evidenceQuotes: passage ? [passage] : [], preserveContextList: true,
    }
  }
  return {
    mode: KNOWLEDGE_MODES.DIALOGUE,
    text: `لن أحول الحوار إلى قائمة أوامر. نبدأ بسؤال واحد له قيمة:\n\nفي «${item.title}»، أي جزء تريد اختباره: الدليل، التطبيق، أم الاعتراض الأقوى؟${followup && !/أي جزء/.test(followup) ? `\n\n${followup}` : ''}\n${item.url}`,
    contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], preserveContextList: true,
  }
}
