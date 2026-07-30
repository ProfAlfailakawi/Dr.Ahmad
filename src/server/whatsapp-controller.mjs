import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { buildContentIndex } from '../../whatsapp-agent/content-index.mjs'
import { LEXICON_SIZE, toRoot } from '../../whatsapp-agent/dialect-lexicon.mjs'
import { classifyIntent, INTENTS } from '../../whatsapp-agent/intent-engine.mjs'
import { DEFAULT_BOT_MESSAGES, getBotMessages, refreshBotMessages } from '../../whatsapp-agent/bot-messages.mjs'

const SITE_URL = String(process.env.WHATSAPP_SITE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')
const OWNER_ALERT_FALLBACK = 'طلب صاحب هذه الرسالة التواصل معك مباشرة. افتح محادثات واتساب من جهازك المرتبط.'
const HUMAN_ACK = 'أفهم أنك تريد التواصل مع الدكتور مباشرة. اكتب رسالتك كاملة هنا؛ لا أستطيع أن أعدك بموعد رد، وبإمكاني الآن مساعدتك في محتوى الموقع أو البحث عن موضوع محدد.'
const MEDIA_CLARIFY = 'وصلتني الصورة أو الملف. حتى ما أخمّن محتواه أو مقصدك، اكتب المطلوب بجملة واحدة: «لخّصها» · «ابحث عن موضوعها» · «أعطني المادة الأصلية».'
/* القوالب حيّة لا مسبوكة: كانت تُبنى مرةً واحدة عند تحميل الملف من البدائل
   المضمّنة، فتحرير الدكتور لها في لوحة «رسائل البوت» يصل Firestore ولا يصل
   الردود أبداً. الآن كلُّ بناءِ ردٍّ يقرأ القوالب الحاضرة (getBotMessages —
   قراءةٌ متزامنة من الذاكرة، والتحديث خلفيٌّ من مدخل الويبهوك)، فتسري تعديلات
   اللوحة خلال دقائق وبلا أي طلبٍ شبكيٍّ في مسار الرد أو في الاختبار الوهمي. */
const KUWAIT_TZ = 'Asia/Kuwait'
function botMessagesNow() {
  return { ...DEFAULT_BOT_MESSAGES, ...getBotMessages() }
}
function kuwaitHour(at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: KUWAIT_TZ }).format(at))
  return Number.isFinite(hour) ? hour % 24 : 12
}
/* التحية نفسها المصرّفة في حملات المكتبة (personalizeAudienceText) حتى يبقى
   صوت البوت واحداً صباحاً ومساءً، مع سطرٍ لطيفٍ لساهر الليل. */
function timeGreeting(at = new Date()) {
  const hour = kuwaitHour(at)
  if (hour < 4) return 'أسعد الله ليلك'
  if (hour < 12) return 'صباح الخير'
  return 'مساء الخير'
}
function botSignature(messages = botMessagesNow()) {
  return messages.signature || 'رد آلي من موقع د. أحمد حسين الفيلكاوي'
}
/* بوابة اليوم: مادةُ يومٍ واحدة تُختار حتمياً من تاريخ الكويت، وتُحفظ في سياق
   المحادثة لحظة الترحيب — فيصير «٣٠ ثانية» و«لخصها» بعد الترحيب مباشرةً
   عملاً على مادةٍ حاضرة لا سؤالاً معلقاً في الفراغ (عطب ٣٠ يوليو ٠٨:٤١). */
function dailyGateItem(at = new Date()) {
  const pool = siteIndex().filter((item) => item.kind === 'article' && normalizeWhitespace(item.excerpt || item.body || '').length >= 40)
  if (!pool.length) return null
  const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: KUWAIT_TZ }).format(at)
  return pool[Number.parseInt(hash(`daily-gate:${dayKey}`).slice(0, 8), 16) % pool.length]
}
function buildWakeWelcome(messages = botMessagesNow(), at = new Date()) {
  const gate = dailyGateItem(at)
  const header = `${timeGreeting(at)} · ${messages.welcomeLine || 'حيّاك الله. فتحت لك مكتبة د. أحمد الفيلكاوي'}.`
  const options = messages.optionsPrompt || 'شنو يناسب وقتك؟ ٣٠ ثانية · دقيقتان · تعمّق · اختبرني'
  if (!gate) return { text: `${header}\n\n${options}`, contextItemIds: [], evidence: [] }
  const quote = normalizeWhitespace(gate.excerpt || gate.body || '').split(/\s+/).slice(0, 26).join(' ')
  const text = `${header}\n\n${messages.dailyGateLabel || 'بوابة اليوم:'}\n*${gate.title}*\n${quote ? `«${quote}…»\n` : ''}${gate.url}\n\n${options}`
  return { text, contextItemIds: [gate.id], evidence: [gate.id], lastTopic: gate.title }
}
function welcomeText(messages = botMessagesNow(), at = new Date()) {
  const line = messages.welcomeLine || 'حيّاك الله. فتحت لك مكتبة د. أحمد الفيلكاوي'
  return `${timeGreeting(at)}. ${line}.\n\nأفهم سؤالك باللهجة الكويتية أو بالعربية الطبيعية، وأبحث لك في مقالات الدكتور وكتبه وأبحاثه والبودكاست.\n\nجرّب مثلاً: «شنو جديد الدكتور؟» · «عندك شي عن الذكاء الاصطناعي؟» · «لخّصها» · «عطني غيرها»\n\n${SITE_URL}`
}
function clarifyText(messages = botMessagesNow(), conversation = {}) {
  const current = currentConversationItem(conversation)
  if (current) {
    return `${messages.clarify || 'لم يتضح المقصود بدقة.'}\n\nإذا كنت تقصد «${current.title}»، اكتب: لخّصها · المصدر · غيرها. وإن كان طلباً جديداً، اكتب الموضوع مباشرة.`
  }
  return `${messages.clarify || 'لم يتضح المقصود بدقة.'}\n\nاكتب الموضوع مباشرة، أو اطلب: آخر مقالة · آخر بحث · آخر كتاب · آخر بودكاست.`
}
function noMatchText(messages = botMessagesNow()) {
  return `${messages.noMatch || 'ما لقيت مادة منشورة مطابقة الآن.'}\n\nجرّب كلمة أقرب للموضوع، أو قل لي: مقالة، كتاب، بحث، أو بودكاست.`
}
function helpText() {
  return `أقدر أبحث لك في كل ما نشره د. أحمد، وأفهم المتابعة الطبيعية من غير أوامر جامدة.\n\n• آخر مقالة / كتاب / بحث / بودكاست\n• عندك شي عن موضوع معيّن؟\n• لخّصها / افتحها / عطني المصدر\n• عطني غيرها / اللي بعدها / الأولى\n• فاجئني / عندي دقيقة / اختبرني\n\n${SITE_URL}`
}
const BRIDGE_ONLINE_MS = Math.max(60_000, Number(process.env.WHATSAPP_BRIDGE_ONLINE_MS || 180_000))
const QR_FRESH_MS = Math.max(30_000, Number(process.env.WHATSAPP_QR_FRESH_MS || 75_000))
const REPAIR_COOLDOWN_MS = Math.max(15 * 60_000, Number(process.env.WHATSAPP_REPAIR_COOLDOWN_MS || 60 * 60_000))
const MAX_BODY_BYTES = 2 * 1024 * 1024
const WAKE_PHRASES = new Set(['موقع د احمد', 'موقع د الفيلكاوي'])
const OWNER_CHAT_ID = String(process.env.WHATSAPP_OWNER_CHAT_ID || '').trim().toLowerCase()

const COLLECTIONS = Object.freeze({
  bridge: 'whatsapp_bridge_state',
  conversations: 'whatsapp_conversations',
  rules: 'whatsapp_reply_rules',
  ruleVersions: 'whatsapp_rule_versions',
  commands: 'whatsapp_bridge_commands',
  events: 'whatsapp_attention_events',
  settings: 'whatsapp_settings',
  audienceContacts: 'whatsapp_audience_contacts',
  audienceLists: 'whatsapp_audience_lists',
  audienceMembers: 'whatsapp_audience_members',
  campaigns: 'whatsapp_broadcast_campaigns',
  learning: 'whatsapp_learning_patterns',
})

const GREETINGS = [
  'السلام عليكم ورحمة الله وبركاته', 'السلام عليكم ورحمه الله وبركاته',
  'السلام عليكم', 'سلام عليكم', 'وعليكم السلام', 'هلا والله', 'هلا', 'مرحبا',
  'مرحبا بك', 'صباح الخير', 'مساء الخير', 'شلونك', 'كيف حالك', 'لو سمحت',
]

const NOISE_WORDS = new Set([
  'ابي', 'ابغى', 'اريد', 'ممكن', 'لو', 'سمحت', 'عندك', 'عن', 'حول', 'شي',
  'شيء', 'شنو', 'ماهو', 'ماهي', 'هل', 'في', 'من', 'الى', 'على', 'مع', 'هذا',
  'هذه', 'ذلك', 'اللي', 'الذي', 'التي', 'لي', 'لنا', 'فضلا', 'رجاء',
])

const HUMAN_PATTERNS = [
  /(?:ابي|اريد|ابغى|ممكن)\s+(?:موظف|انسان|شخص|الدكتور|احد)/,
  /(?:حولني|وصلني|كلمني|اكلم)\s+(?:موظف|الدكتور|شخص|انسان)/,
  /(?:تواصل|اتصال)\s+(?:بشري|مع الدكتور|مع موظف)/,
]

const PRICE_PATTERNS = [
  /(?:قائمه|منيو|اسعار|الاسعار|سعر|بكم|كم السعر|التكلفه|تكلفه)/,
]

const ARABIC_DIGITS = Object.freeze({
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
})

function asIso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

function bounded(value, max = 2_000) {
  return String(value ?? '').trim().slice(0, max)
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function conversationId(jid) {
  return hash(`whatsapp:${bounded(jid, 180)}`).slice(0, 40)
}

function maskJid(jid) {
  const value = bounded(jid, 180)
  const number = value.split('@', 1)[0].replace(/\D/g, '')
  return number.length > 4 ? `${'*'.repeat(Math.max(4, number.length - 4))}${number.slice(-4)}` : '****'
}

function privateRecipientDigits(value) {
  const digits = bounded(value, 180).split('@', 1)[0].replace(/\D/g, '')
  return /^\d{7,15}$/.test(digits) ? digits : ''
}

function outboundRecipientFingerprint(value) {
  const digits = privateRecipientDigits(value)
  return digits ? hash(`wa-recipient:${digits}`) : ''
}

function normalizeConversationJid(value) {
  /* إصدارات Multi-Device الحديثة قد تضيف رقم الجهاز قبل @c.us/@lid،
     أو تستخدم s.whatsapp.net. لا نحوّل LID إلى رقم هاتف؛ نحفظ العنوان الحي
     نفسه، لكن نرفض المجموعات والنشرات وأي محارف غير متوقعة. */
  const jid = bounded(value, 180).toLowerCase()
  return /^\d{5,30}(?::\d{1,8})?@(?:c\.us|lid|s\.whatsapp\.net)$/.test(jid) ? jid : ''
}

function isOwnerPrivateChat(value) {
  const jid = String(value || '').trim().toLowerCase()
  if (!OWNER_CHAT_ID || !jid) return false
  if (jid === OWNER_CHAT_ID) return true
  const jidNumber = jid.split('@', 1)[0].replace(/\D/g, '')
  const ownerNumber = OWNER_CHAT_ID.split('@', 1)[0].replace(/\D/g, '')
  return Boolean(jidNumber && ownerNumber && jidNumber === ownerNumber)
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function normalizeArabicMessage(value) {
  return normalizeWhitespace(String(value || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ـ/g, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' '))
}

export function stripArabicGreetings(value) {
  let text = normalizeArabicMessage(value)
  const normalizedGreetings = GREETINGS.map(normalizeArabicMessage).sort((a, b) => b.length - a.length)
  let changed = true
  while (changed && text) {
    changed = false
    for (const greeting of normalizedGreetings) {
      if (text === greeting || text.startsWith(`${greeting} `)) {
        text = text.slice(greeting.length).trim()
        changed = true
        break
      }
    }
  }
  return text
}

export function isWhatsAppWakePhrase(value) {
  return WAKE_PHRASES.has(normalizeArabicMessage(value))
}

export function isDuplicateInboundDelivery({
  messageIdHash = '',
  recentMessageIds = [],
  incomingHash = '',
  previousIncomingHash = '',
  previousInboundAt = '',
  now = Date.now(),
} = {}) {
  if (messageIdHash) return Array.isArray(recentMessageIds) && recentMessageIds.includes(messageIdHash)
  const previousAt = Date.parse(previousInboundAt || '')
  return Boolean(incomingHash
    && previousIncomingHash === incomingHash
    && Number.isFinite(previousAt)
    && Number(now) - previousAt < 15_000)
}

function sharedPrefix(left, right) {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left[index] === right[index]) index += 1
  return index
}

function conservativeTokenMatch(inputToken, keywordToken) {
  if (!inputToken || !keywordToken) return false
  if (inputToken === keywordToken) return true
  if (keywordToken.length >= 4 && inputToken.includes(keywordToken)) return true
  if (inputToken.length < 4 || keywordToken.length < 4) return false
  if (Math.abs(inputToken.length - keywordToken.length) > 2) return false
  return sharedPrefix(inputToken, keywordToken) >= 4
}

function keywordMatches(message, keyword) {
  const query = stripArabicGreetings(message)
  const key = normalizeArabicMessage(keyword)
  if (!query || !key) return false
  if (query === key || query.includes(key)) return true
  const queryTokens = query.split(' ')
  const keyTokens = key.split(' ')
  return keyTokens.every((needle) => queryTokens.some((token) => conservativeTokenMatch(token, needle)))
}

export function findRuleMatch(message, rules = []) {
  const enabled = [...rules]
    .filter((rule) => rule && rule.enabled !== false && Array.isArray(rule.keywords) && rule.keywords.length)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  for (const rule of enabled) {
    const results = rule.keywords.map((keyword) => keywordMatches(message, keyword))
    const type = rule.matchType || 'any'
    const matched = type === 'all'
      ? results.every(Boolean)
      : type === 'exact'
        ? rule.keywords.some((keyword) => stripArabicGreetings(message) === normalizeArabicMessage(keyword))
        : results.some(Boolean)
    if (matched) return rule
  }
  return null
}

function isGreetingOnly(text) {
  return Boolean(normalizeArabicMessage(text)) && !stripArabicGreetings(text)
}

function signReply(value, messages = botMessagesNow()) {
  const signature = botSignature(messages)
  const text = bounded(value, 2_000)
  if (!text || text.includes(signature)) return text
  const humanBoundary = /تريد التواصل مع الدكتور مباشرة|لا أستطيع أن أعدك بموعد رد/.test(text)
  const alreadyInteractive = /قل لي|جرّب|اكتب|شنو يناسب|وش تحب|إذا تحب|وإن أحببت|وأكمل معك|في أمان الله|وإياك|حيّاك/.test(text)
  const nudge = humanBoundary || alreadyInteractive
    ? ''
    : '\n\nشنو تحب أسوي بعدها: ألخّصها، أعطيك المصدر، أو أطلع لك غيرها؟'
  return `${text}${nudge}\n\n${signature}`
}

function semanticWord(value) {
  const normalized = normalizeArabicMessage(value)
  return toRoot(normalized) || normalized
}

function contentTokens(text) {
  const tokens = stripArabicGreetings(text).split(' ')
    .filter((token) => token.length >= 2 && !NOISE_WORDS.has(token))
  return [...new Set(tokens.flatMap((token) => {
    const root = semanticWord(token)
    return root && root !== token ? [token, root] : [token]
  }))]
}

function scoreContent(item, queryTokens) {
  if (!queryTokens.length) return { score: 0, matched: 0, headingMatches: 0 }
  const semanticText = (value, limit = 20_000) => {
    const normalized = normalizeArabicMessage(value).slice(0, limit)
    const roots = normalized.split(' ').map(semanticWord).filter(Boolean)
    return `${normalized} ${roots.join(' ')}`
  }
  const title = semanticText(item.title, 2_000)
  const excerpt = semanticText(item.excerpt, 6_000)
  const keywords = semanticText(item.keywords, 4_000)
  const body = semanticText(item.body, 20_000)
  let score = 0
  let matched = 0
  let headingMatches = 0
  for (const token of queryTokens) {
    const inTitle = title.includes(token)
    const inKeywords = keywords.includes(token)
    const inExcerpt = excerpt.includes(token)
    const inBody = body.includes(token)
    if (inTitle || inKeywords || inExcerpt || inBody) matched += 1
    if (inTitle || inKeywords) headingMatches += 1
    if (inTitle) score += 8
    else if (inKeywords) score += 5
    else if (inExcerpt) score += 3
    else if (inBody) score += 1
  }
  if (matched === queryTokens.length && queryTokens.length > 1) score += 6
  return { score, matched, headingMatches }
}

let contentIndexCache = null
function siteIndex() {
  if (contentIndexCache) return contentIndexCache
  try {
    contentIndexCache = buildContentIndex(process.cwd(), SITE_URL)
  } catch {
    contentIndexCache = []
  }
  return contentIndexCache
}

function exactSiteResults(query, overrideQuery = '', options = {}) {
  const tokens = contentTokens(overrideQuery || query).slice(0, 8)
  if (!tokens.length) return []
  const excluded = new Set(Array.isArray(options.excludeIds) ? options.excludeIds : [])
  const kinds = new Set(Array.isArray(options.kinds) ? options.kinds : [])
  const rows = siteIndex()
    .filter((item) => !excluded.has(item.id) && (!kinds.size || kinds.has(item.kind)))
    .map((item) => ({ item, ...scoreContent(item, tokens) }))
    .filter((row) => {
      if (tokens.length === 1) return row.score >= 5
      const neededMatches = Math.min(tokens.length, Math.max(1, Math.ceil(tokens.length * .38)))
      return row.score >= 7 && row.matched >= neededMatches
    })
    .sort((a, b) => b.score - a.score || String(b.item.date || '').localeCompare(String(a.item.date || '')))
    .slice(0, Math.max(1, Math.min(5, Number(options.limit || 3))))
  return rows.map((row) => row.item)
}

function itemLabel(item) {
  return ({
    article: 'مقالة',
    book: 'كتاب',
    paper: 'بحث',
    podcast: 'بودكاست',
    curated: 'مختارة',
  })[item?.kind] || 'مادة'
}

const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
function arabicNumber(value) {
  return String(value).replace(/\d/g, (digit) => AR_DIGITS[Number(digit)])
}

/* اختيارٌ حتميّ لا عشوائي: نفس البذرة تعطي نفس الصياغة (قابل للاختبار)،
   وبذرةُ كل دورٍ مختلفة فتتنوّع الصياغات بين الرسائل تنوّعاً طبيعياً. */
function variantOf(seed, options) {
  if (!Array.isArray(options) || !options.length) return ''
  const number = Number.parseInt(hash(String(seed)).slice(0, 8), 16)
  return options[number % options.length]
}

function readingMinutes(item) {
  const words = Number(item?.words || 0)
  return words ? Math.max(1, Math.round(words / 200)) : 0
}

function itemMetaLine(item) {
  const parts = [itemLabel(item)]
  const minutes = readingMinutes(item)
  if (minutes) parts.push(`قراءة ~${arabicNumber(minutes)} ${minutes === 1 ? 'دقيقة' : minutes === 2 ? 'دقيقتين' : 'دقائق'}`)
  const audio = item?.audio || null
  if (audio?.dialogue) parts.push('فيها حوار مسموع')
  else if (audio?.fahed || audio?.noura) parts.push('فيها قراءة صوتية')
  return parts.join(' · ')
}

function siteResultReply(items, intro = 'وجدت لك من موقع الدكتور:') {
  if (items.length === 1) {
    const item = items[0]
    const source = normalizeWhitespace(item.excerpt || item.body || '')
    const preview = source.split(/\s+/).filter(Boolean).slice(0, 30).join(' ')
    return `${intro}\n\n*${item.title}*\n${itemMetaLine(item)}${preview ? `\n\n${preview}${source.split(/\s+/).filter(Boolean).length > 30 ? '…' : ''}` : ''}\n\n${item.url}\n\nماذا تريد بعدها؟ لخّصها · أعطني المصدر · أطلع لي غيرها.`
  }
  const lines = items.map((item, index) => `${arabicNumber(index + 1)}) *${item.title}*\n${itemMetaLine(item)}\n${item.url}`)
  return `${intro}\n\n${lines.join('\n\n')}\n\nاختر رقماً، أو اكتب: لخّص الأولى · أعطني غيرها.`
}

/* حين لا يطابق البحثُ الدقيق شيئاً، لا نكتفي بـ«ما لقيت»: نعرض أقرب المواد
   بعتبةٍ متساهلة، فإن غابت عرضنا أبواب الأرشيف الفعلية (من عناوين المقالات
   المنشورة نفسها) — كله مؤرّضٌ بالموقع، ولا اختلاق. */
function nearestSuggestions(query, excludeIds = [], limit = 3) {
  const tokens = contentTokens(query).slice(0, 8)
  if (!tokens.length) return []
  const excluded = new Set(excludeIds)
  return siteIndex()
    .filter((item) => !excluded.has(item.id))
    .map((item) => ({ item, ...scoreContent(item, tokens) }))
    .filter((row) => row.score >= 3)
    .sort((a, b) => b.score - a.score || String(b.item.date || '').localeCompare(String(a.item.date || '')))
    .slice(0, limit)
    .map((row) => row.item)
}

function archiveDoors(limit = 4) {
  const counts = new Map()
  for (const item of siteIndex()) {
    if (item.kind !== 'article') continue
    for (const token of normalizeArabicMessage(item.title).split(' ')) {
      if (token.length < 4 || NOISE_WORDS.has(token)) continue
      const root = semanticWord(token)
      const row = counts.get(root) || { count: 0, display: token }
      row.count += 1
      if (token.length < row.display.length) row.display = token
      counts.set(root, row)
    }
  }
  return [...counts.values()]
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => `ال${row.display}`.replace(/^الال/, 'ال'))
}

function requestedListCount(cleanText) {
  const match = cleanText.match(/(?:^|\s)(\d{1,2})(?:\s|$)/)
  const count = match ? Number(match[1]) : 0
  return count >= 2 && count <= 5 ? count : 0
}

/* مجاملاتُ الناس ليست موضوع بحث. كانت «شكراً» و«تمام» و«مع السلامة» تسقط
   في محرك البحث فيجيب «ما لقيت مادة» — جفاءٌ في موضع الدفء. */
const THANKS_PATTERN = /^(?:شكرا(?: جزيلا| لك)?|مشكور(?:ين)?(?: وايد)?|تسلم(?:ون)?|يعطيك العافيه|الله يعطيك العافيه|جزاك الله خير(?:ا)?|جزاكم الله خير(?:ا)?|بارك الله فيك(?:م)?|ما قصرت(?:وا)?|يزاك الله خير|شكرا وايد|thanks|thank you)\s*$/
const FAREWELL_PATTERN = /^(?:مع السلامه|في امان الله|الله يحفظك|تصبح على خير|تصبحون على خير|باي|وداعا|الى اللقاء|سلامات|استودعك الله)\s*$/
const ACK_PATTERN = /^(?:تمام|اوكي|اوك|ok|okay|زين|طيب|ممتاز|جميل|رائع|واضح|فهمت|اها|ايه|نعم|ان شاء الله|خلاص|ماشي|تم)\s*$/
const WHO_ARE_YOU_PATTERN = /^(?:من انت|منو انت|انت منو|شنو انت|وش انت|مين انت|هل انت روبوت|هل انت بوت|انت بوت|انت روبوت|انت انسان|معاي انسان او روبوت)\s*$/
const PRAISE_PATTERN = /^(?:ما شاء الله|ماشاء الله|كفو|ابدعت|مبدع|وايد حلو|حلو وايد|روعه|يا سلام|احسنت|برافو|عجيب)\s*$/

const MOOD_MAP = [
  [/(ضايق|متضايق|حزين|مهموم|زعلان|مكتئب|طفران|مقهور)/, 'أحس بثقل كلمتك. اخترت لك من مكتبة الدكتور ما يفتح نافذة:', ['طمانينه سعاده راحه', 'صبر امل', 'حزن تجاوز']],
  [/(خايف|قلقان|متوتر|مرعوب|وسواس|مرتبك)/, 'للقلق دواء من فكرة هادئة. هذه أقرب مواد الدكتور لحالك:', ['خوف قلق طمانينه', 'ثقه نفس', 'هدوء توازن']],
  [/(متحمس|منجز|نشيط|متفائل|مبسوط|فرحان)/, 'حماسك يستاهل فكرة توازيه:', ['نجاح تفوق انجاز', 'ابداع موهبه', 'مستقبل طموح']],
  [/(تعبان|مرهق|مضغوط|مخنوق|ملل|طفشان)/, 'خذ نفساً عميقاً، وهذه مادة تريّح البال:', ['ضغط ارهاق راحه', 'توازن حياه', 'سكينه']],
]

function compareSides(cleanText) {
  /* واو العطف تلتصق بالكلمة عربياً («المعلم والتقنية»)، فالفاصل يقبل الواو
     الملتصقة والمنفصلة و«أو» معاً. */
  const match = cleanText.match(/(?:الفرق بين|قارن(?: لي)?(?: بين)?|مقارنه بين|ايهما افضل)\s+(.+?)\s+(?:او\s+|و\s*)(.+)$/)
  if (!match) return null
  const sides = [match[1], match[2]].map((side) => side.trim()).filter((side) => side.length >= 2)
  return sides.length === 2 ? sides : null
}

/* تحدي ١٥ ثانية: سؤالٌ مبنيّ من اقتباسٍ حرفيّ من مقالٍ منشور وثلاثة عناوين
   حقيقية — لا توليد ولا اختلاق، والإجابة تُحفظ في وثيقة المحادثة. */
function buildChallenge(conversation = {}, seedText = '') {
  const pool = siteIndex().filter((item) => item.kind === 'article'
    && normalizeWhitespace(item.excerpt || item.body || '').split(/\s+/).filter(Boolean).length >= 14)
  if (pool.length < 3) return null
  const seed = Number.parseInt(hash(`challenge:${seedText}:${conversation.lastInboundAt || ''}:${(conversation.seenContentIds || []).length}`).slice(0, 8), 16)
  const correct = pool[seed % pool.length]
  const others = pool.filter((item) => item.id !== correct.id)
  const second = others[seed % others.length]
  const rest = others.filter((item) => item.id !== second.id)
  const third = rest[(seed >>> 3) % rest.length]
  const rotation = seed % 3
  const base = [correct, second, third]
  const arranged = [...base.slice(rotation), ...base.slice(0, rotation)]
  const answerIndex = arranged.findIndex((item) => item.id === correct.id)
  const fragment = normalizeWhitespace(correct.excerpt || correct.body).split(/\s+/).slice(0, 18).join(' ')
  const lines = arranged.map((item, index) => `${arabicNumber(index + 1)}) ${item.title}`)
  return {
    reply: `تحدي ١٥ ثانية — من أي مادة أُخذت هذه العبارة؟\n\n«${fragment}…»\n\n${lines.join('\n')}\n\nاكتب رقم إجابتك: ١ أو ٢ أو ٣.`,
    state: { answerIndex, itemIds: arranged.map((item) => item.id), askedAt: asIso() },
    evidence: [correct.id],
  }
}

function latestSiteItems(kinds = [], limit = 1) {
  const allowed = new Set(kinds)
  return siteIndex()
    .filter((item) => !allowed.size || allowed.has(item.kind))
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')) || String(right.id).localeCompare(String(left.id)))
    .slice(0, limit)
}

function conversationContextItems(conversation = {}) {
  const ids = Array.isArray(conversation.contextItemIds) ? conversation.contextItemIds : []
  const byId = new Map(siteIndex().map((item) => [item.id, item]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

function currentConversationItem(conversation = {}) {
  const items = conversationContextItems(conversation)
  const index = Math.max(0, Math.min(items.length - 1, Number(conversation.contextIndex || 0)))
  return items[index] || null
}

function excerptReply(item, short = false) {
  if (!item) return clarifyText()
  const source = normalizeWhitespace(item.excerpt || item.body || '')
  const words = source.split(/\s+/).filter(Boolean)
  const limit = short ? 42 : 85
  const excerpt = words.slice(0, limit).join(' ')
  return `*${item.title}*\n${itemMetaLine(item)}\n\n${excerpt || 'هذه المادة متاحة كاملة في موقع الدكتور.'}${words.length > limit ? '…' : ''}\n\n${item.url}`
}

function intentKinds(intent) {
  if ([INTENTS.LATEST_ARTICLE, INTENTS.LATEST_ARTICLES, INTENTS.MOST_VIEWED_ARTICLE].includes(intent)) return ['article']
  if (intent === INTENTS.LATEST_BOOK) return ['book']
  if (intent === INTENTS.LATEST_PAPER) return ['paper']
  if (intent === INTENTS.LATEST_PODCAST) return ['podcast']
  if (intent === INTENTS.LATEST_SELECTION || intent === INTENTS.CURATED_PICKS) return ['curated']
  return []
}

export function decideGroundedResponse({ text, hasMedia = false, rules = [], priorReplyHash = '', conversation = {} } = {}) {
  const clean = normalizeArabicMessage(text)
  const messages = botMessagesNow()
  if (hasMedia) {
    const now = Date.now()
    const previousMediaReplyAt = Date.parse(conversation.lastMediaReplyAt || '')
    if (Number.isFinite(previousMediaReplyAt) && now - previousMediaReplyAt < 5 * 60_000) {
      return { kind: 'no-reply', reason: 'media-burst-suppressed', patch: { lastMediaSeenAt: asIso(now) } }
    }
    return {
      kind: 'reply',
      reason: 'media-description-needed',
      reply: signReply(MEDIA_CLARIFY, messages),
      patch: { lastMediaReplyAt: asIso(now), lastMediaSeenAt: asIso(now) },
    }
  }
  if (!clean) return { kind: 'reply', reason: 'empty-after-normalization', reply: signReply(clarifyText(messages, conversation), messages) }
  if (HUMAN_PATTERNS.some((pattern) => pattern.test(clean))) {
    return { kind: 'escalate', reason: 'human-request', reply: signReply(HUMAN_ACK, messages) }
  }

  const rule = findRuleMatch(text, rules)
  if (rule) {
    if (rule.actionType === 'transfer') return { kind: 'escalate', reason: `rule:${rule.id}`, reply: signReply(bounded(rule.responseText, 1_500) || HUMAN_ACK, messages), rule }
    if (rule.actionType === 'site-content') {
      const found = exactSiteResults(text, rule.contentQuery)
      if (!found.length) return { kind: 'reply', reason: `rule-no-grounding:${rule.id}`, reply: signReply(noMatchText(messages), messages), rule }
      return { kind: 'reply', reason: `rule:${rule.id}`, reply: signReply(siteResultReply(found), messages), rule, evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0 }
    }
    const response = bounded(rule.responseText, 2_000)
    if (response) return { kind: 'reply', reason: `rule:${rule.id}`, reply: signReply(response, messages), rule }
  }

  const classification = classifyIntent(text)
  const intent = classification.intent
  const current = currentConversationItem(conversation)
  const previousIds = Array.isArray(conversation.seenContentIds) ? conversation.seenContentIds.slice(-40) : []
  const stripped = stripArabicGreetings(text)
  const politeSeed = `${conversation.lastInboundAt || ''}:${clean}`

  /* ─── دفء المجاملة قبل آلة البحث ─── */
  if (THANKS_PATTERN.test(stripped || clean)) {
    return { kind: 'reply', reason: 'thanks', intent, reply: signReply(variantOf(politeSeed, [
      'العفو، حيّاك الله. وإن احتجت مادة أو فكرة من مكتبة الدكتور فأنا حاضر.',
      'وإياك، أسعدني أن أفيدك. اكتب لي أي موضوع يشغلك وأدوّر لك عنه.',
      'على الرحب والسعة. متى ما خطر ببالك سؤال عن مقالات الدكتور فأنا هنا.',
    ]), messages) }
  }
  if (FAREWELL_PATTERN.test(stripped || clean)) {
    return { kind: 'reply', reason: 'farewell', intent, reply: signReply(variantOf(politeSeed, [
      'في أمان الله، وأهلاً بك متى ما رجعت.',
      'الله يحفظك. مكتبة الدكتور تبقى مفتوحة لك في أي وقت.',
    ]), messages) }
  }
  if (WHO_ARE_YOU_PATTERN.test(stripped || clean)) {
    return { kind: 'reply', reason: 'who-are-you', intent, reply: signReply(`أنا المساعد الآلي لمكتبة د. أحمد الفيلكاوي — أجيب من محتوى الموقع المنشور فقط، ولا أدّعي علماً خارجه. اكتب أي موضوع وأبحث لك عنه، أو قل «آخر مقالة».\n\n${SITE_URL}`, messages) }
  }
  if (PRAISE_PATTERN.test(stripped || clean)) {
    return { kind: 'reply', reason: 'praise', intent, reply: signReply(variantOf(politeSeed, [
      'الفضل لمحتوى الدكتور، أنا مجرد دليل عليه. تحب أختار لك مادة تعجبك؟ قل «فاجئني».',
      'كلامك يسرّ، والجمال جمال الفكرة. عندي غيرها كثير — قل «عطني غيرها».',
    ]), messages) }
  }
  if (ACK_PATTERN.test(stripped || clean)) {
    return { kind: 'reply', reason: 'acknowledged', intent, reply: signReply(variantOf(politeSeed, [
      'تمام. إذا حبيت نكمل: «لخّصها» أو «عطني غيرها» أو اكتب موضوعاً جديداً.',
      'زين. أنا حاضر متى ما أردت — موضوع جديد أو «فاجئني».',
    ]), messages) }
  }

  /* «أوقف الرسائل» حُذفت نهائياً بأمر الدكتور (٣٠ يوليو): البوت لا يعرض
     إيقاف الحملات ولا ينفذه؛ من كتبها تُعامل رسالته كأي نصٍّ عادي.
     أما مسح التفضيلات فباقٍ — خصوصية المحادثة شأن آخر. */
  if (intent === INTENTS.DELETE_PREFERENCES) {
    return {
      kind: 'reply', reason: 'delete-preferences', intent,
      reply: signReply('تم. مسحت ما احتفظت به لهذه المحادثة من سياق وتفضيلات ومحفوظات. نبدأ من صفحة بيضاء متى ما أردت.', messages),
      patch: { contextItemIds: [], contextIndex: 0, seenContentIds: [], savedItemIds: [], lastTopic: null, challenge: null },
    }
  }

  if (PRICE_PATTERNS.some((pattern) => pattern.test(clean)) || isGreetingOnly(text) || intent === INTENTS.WELCOME) {
    const welcome = buildWakeWelcome(messages)
    return {
      kind: 'reply', reason: isGreetingOnly(text) ? 'greeting' : 'welcome', intent,
      reply: signReply(welcome.text, messages),
      ...(welcome.contextItemIds.length ? { contextItemIds: welcome.contextItemIds, contextIndex: 0, evidence: welcome.evidence, lastTopic: welcome.lastTopic } : {}),
    }
  }
  if ([INTENTS.HELP, INTENTS.SHOW_OPTIONS, INTENTS.CONTENT_OVERVIEW].includes(intent)) {
    return { kind: 'reply', reason: 'help', intent, reply: signReply(helpText(), messages) }
  }
  if (intent === INTENTS.ABOUT_DOCTOR) {
    return { kind: 'reply', reason: 'about-doctor', intent, reply: signReply(`هذه السيرة الرسمية للدكتور أحمد حسين الفيلكاوي، ومؤلفاته وأبحاثه وخبراته:\n\n${SITE_URL}/about`, messages) }
  }

  /* ─── التصحيح: «مو صح» أو «مو عن هذا» اعتذارٌ وبحثٌ من زاوية أخرى ─── */
  if (intent === INTENTS.CORRECTION) {
    const notAbout = clean.match(/(?:مو|مب|ليس|مهوب)\s+(?:عن|قصدي|اقصد)\s+(.{2,60})$/)?.[1]
      || clean.match(/قصدي\s+(.{2,60})$/)?.[1] || ''
    const retryQuery = bounded(notAbout, 120) || bounded(conversation.lastTopic, 200) || stripped
    const excluded = [...previousIds, ...(current ? [current.id] : [])]
    const found = retryQuery ? exactSiteResults(retryQuery, retryQuery, { excludeIds: excluded, limit: 3 }) : []
    if (found.length) return {
      kind: 'reply', reason: 'correction-retry', intent,
      reply: signReply(siteResultReply(found, 'واضح، فهمي الأول ما أصاب. جربت زاوية ثانية:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: retryQuery,
    }
    return { kind: 'reply', reason: 'correction-clarify', intent, reply: signReply('معك حق، وأعتذر عن سوء الفهم. اكتب المقصود بكلمة أو زاوية أوضح وأبحث من جديد — ولا أدّعي ما لا أجده منشوراً.', messages) }
  }

  /* ─── تحدي المعرفة ───
     رقمُ الإجابة يُحكم من حالة المحادثة لا من تصنيف النية: «٢» قد يصنّفها
     محلل المراجع تنقّلاً بين النتائج، لكن وجود تحدٍّ معلّق يجعلها إجابته. */
  const pureDigitAnswer = /^[1-3]$/.test(clean) ? Number(clean) : 0
  if ((pureDigitAnswer || intent === INTENTS.CHALLENGE_ANSWER) && conversation.challenge && Array.isArray(conversation.challenge.itemIds)) {
    const answer = (pureDigitAnswer || Number(clean.replace(/[^0-9]/g, ''))) - 1
    const stateIds = conversation.challenge.itemIds
    const byId = new Map(siteIndex().map((item) => [item.id, item]))
    const correctItem = byId.get(stateIds[Number(conversation.challenge.answerIndex) || 0])
    const wasRight = answer === Number(conversation.challenge.answerIndex)
    if (correctItem) {
      const opener = wasRight
        ? variantOf(politeSeed, ['أحسنت، إجابة صحيحة!', 'كفو، أصبت!'])
        : `قريبة! الإجابة الصحيحة: ${arabicNumber(Number(conversation.challenge.answerIndex) + 1)}.`
      return {
        kind: 'reply', reason: wasRight ? 'challenge-correct' : 'challenge-missed', intent,
        reply: signReply(`${opener}\n\nالعبارة من:\n*${correctItem.title}*\n${correctItem.url}\n\nتحب تحدياً ثانياً؟ اكتب «اختبرني».`, messages),
        evidence: [correctItem.id], contextItemIds: [correctItem.id], contextIndex: 0,
        patch: { challenge: null }, lastTopic: correctItem.title,
      }
    }
  }
  if (intent === INTENTS.CHALLENGE || (intent === INTENTS.CHALLENGE_ANSWER && !conversation.challenge)) {
    const challenge = buildChallenge(conversation, clean)
    if (challenge) return {
      kind: 'reply', reason: 'challenge-question', intent, reply: signReply(challenge.reply, messages),
      evidence: challenge.evidence, patch: { challenge: challenge.state },
    }
  }

  /* ─── رفّ المحفوظات ─── */
  const savedIds = Array.isArray(conversation.savedItemIds) ? conversation.savedItemIds : []
  if (intent === INTENTS.SAVE_CONTENT) {
    if (!current) return { kind: 'reply', reason: 'save-context-missing', intent, reply: signReply('افتح مادة أولاً — قل «آخر مقالة» أو اكتب موضوعاً — وبعدها قل «احفظها» وأضمها لرفّك.', messages) }
    const nextSaved = [...new Set([...savedIds, current.id])].slice(-20)
    return {
      kind: 'reply', reason: 'saved-to-shelf', intent,
      reply: signReply(`حفظتها لك في رفّك:\n*${current.title}*\n\nرفّك فيه الآن ${arabicNumber(nextSaved.length)} ${nextSaved.length === 1 ? 'مادة' : 'مواد'}. قل «رفي» متى ما أردت استعراضه.`, messages),
      evidence: [current.id], patch: { savedItemIds: nextSaved },
    }
  }
  if (intent === INTENTS.LIST_SAVED) {
    if (!savedIds.length) return { kind: 'reply', reason: 'shelf-empty', intent, reply: signReply('رفّك فاضي حالياً. افتح أي مادة ثم قل «احفظها» وأضمها لك هنا.', messages) }
    const byId = new Map(siteIndex().map((item) => [item.id, item]))
    const items = savedIds.map((id) => byId.get(id)).filter(Boolean)
    const lines = items.map((item, index) => `${arabicNumber(index + 1)}) *${item.title}*\n${item.url}`)
    return {
      kind: 'reply', reason: 'shelf-list', intent,
      reply: signReply(`رفّك المحفوظ (${arabicNumber(items.length)}):\n\n${lines.join('\n\n')}\n\nقل «شيلها من رفي» وأنت واقف على مادة لحذفها.`, messages),
      contextItemIds: items.map((item) => item.id).slice(0, 12), contextIndex: 0,
    }
  }
  if (intent === INTENTS.REMOVE_SAVED) {
    if (!current || !savedIds.includes(current.id)) return { kind: 'reply', reason: 'shelf-remove-missing', intent, reply: signReply('حدد المادة أولاً: قل «رفي» ثم «الأولى» أو «الثانية»، وبعدها «شيلها من رفي».', messages) }
    const nextSaved = savedIds.filter((id) => id !== current.id)
    return {
      kind: 'reply', reason: 'shelf-removed', intent,
      reply: signReply(`شلتها من رفّك:\n*${current.title}*\n\nباقي في الرف ${arabicNumber(nextSaved.length)}.`, messages),
      patch: { savedItemIds: nextSaved },
    }
  }

  /* ─── اقتباس من المختارات المنشورة ─── */
  if ([INTENTS.QUOTE, INTENTS.QUOTE_CARD].includes(intent)) {
    const pool = siteIndex().filter((item) => item.kind === 'curated' && !previousIds.includes(item.id))
    const fallbackPool = pool.length ? pool : siteIndex().filter((item) => item.kind === 'curated')
    if (fallbackPool.length) {
      const pick = fallbackPool[Number.parseInt(hash(`quote:${politeSeed}`).slice(0, 8), 16) % fallbackPool.length]
      const note = normalizeWhitespace(pick.excerpt || '')
      const cardHint = intent === INTENTS.QUOTE_CARD ? '\n\nوبطاقات الاقتباس المصمّمة تجدها في صفحة المختارات نفسها.' : ''
      return {
        kind: 'reply', reason: 'curated-quote', intent,
        reply: signReply(`«${pick.title}»${note ? `\n\n${note}` : ''}${cardHint}\n\n${pick.url}`, messages),
        evidence: [pick.id], contextItemIds: [pick.id], contextIndex: 0,
      }
    }
  }

  /* ─── مقارنة بين فكرتين من المنشور ───
     البنية أصدق من التصنيف هنا: «قارن بين المعلم والتقنية» كان يخطفها نمط
     «لمعلم» في محرك الشرح، فنُحكِم صيغة المقارنة الصريحة قبل النيات الأخرى. */
  if (intent === INTENTS.COMPARE || /(?:قارن|الفرق بين|مقارنه بين|ايهما افضل)/.test(clean)) {
    const sides = compareSides(stripped || clean)
    if (sides) {
      const [leftItems, rightItems] = sides.map((side) => exactSiteResults(side, side, { limit: 2 }))
      if (leftItems.length || rightItems.length) {
        const block = (label, items) => items.length
          ? `*${label}:*\n${items.map((item) => `• ${item.title}\n${item.url}`).join('\n')}`
          : `*${label}:* ما لقيت مادة منشورة مباشرة عنها.`
        const all = [...leftItems, ...rightItems]
        return {
          kind: 'reply', reason: 'compare-topics', intent,
          reply: signReply(`جمعت لك طرفي المقارنة من منشورات الدكتور — والحكم لقراءتك:\n\n${block(sides[0], leftItems)}\n\n${block(sides[1], rightItems)}`, messages),
          evidence: all.map((item) => item.id), contextItemIds: all.map((item) => item.id).slice(0, 12), contextIndex: 0, lastTopic: `${sides[0]} و${sides[1]}`,
        }
      }
    }
  }

  /* ─── مزاج القارئ ─── */
  const mood = MOOD_MAP.find(([pattern]) => pattern.test(clean))
  if (mood && (intent === INTENTS.CONTENT_BY_MOOD || intent === INTENTS.SEARCH_TOPIC || classification.fallback)) {
    const [, intro, seeds] = mood
    for (const seedQuery of seeds) {
      const found = exactSiteResults(seedQuery, seedQuery, { excludeIds: previousIds, limit: 2 })
      if (found.length) return {
        kind: 'reply', reason: 'mood-match', intent, reply: signReply(siteResultReply(found, intro), messages),
        evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0,
      }
    }
  }

  /* ─── شبكة الفكرة: الامتدادات الحقيقية للمادة الحالية ─── */
  if (intent === INTENTS.IDEA_NETWORK) {
    if (current && Array.isArray(current.related) && current.related.length) {
      const byId = new Map(siteIndex().map((item) => [item.id, item]))
      const related = current.related.map((id) => byId.get(id)).filter(Boolean).slice(0, 4)
      if (related.length) {
        const lines = related.map((item, index) => `${arabicNumber(index + 1)}) *${item.title}* (${itemLabel(item)})\n${item.url}`)
        return {
          kind: 'reply', reason: 'idea-network', intent,
          reply: signReply(`خيوط الفكرة الممتدة من *${current.title}*:\n\n${lines.join('\n\n')}`, messages),
          evidence: related.map((item) => item.id), contextItemIds: related.map((item) => item.id), contextIndex: 0,
        }
      }
    }
    return { kind: 'reply', reason: 'idea-network-missing', intent, reply: signReply('افتح مادة أولاً وبعدها قل «شبكة الأفكار» وأمد لك خيوطها من بقية المنشور.', messages) }
  }

  /* ─── شرح وحوار مؤرّضان بالمادة ─── */
  if (intent === INTENTS.EXPLAIN_MODE) {
    const target = current || exactSiteResults(classification.request?.topic || stripped, '', { limit: 1 })[0]
    if (target) {
      const audience = clean.match(/(لطالب|لولي امر|لمعلم|لباحث)/)?.[1] || ''
      const intro = audience ? `على قدر ${audience.replace('ل', '')} — ` : ''
      const source = normalizeWhitespace(target.excerpt || target.body || '')
      const sentences = source.split(/(?<=[.!؟])/u).map((part) => part.trim()).filter(Boolean).slice(0, 3).join(' ')
      return {
        kind: 'reply', reason: 'explain-grounded', intent,
        reply: signReply(`${intro}هذا جوهر المادة بكلام الدكتور نفسه:\n\n*${target.title}*\n\n${sentences || 'التفصيل الكامل في الصفحة.'}\n\nوالسياق الكامل هنا:\n${target.url}`, messages),
        evidence: [target.id], contextItemIds: [target.id], contextIndex: 0, lastTopic: target.title,
      }
    }
    return { kind: 'reply', reason: 'context-missing', intent, reply: signReply(clarifyText(messages, conversation), messages) }
  }
  if (intent === INTENTS.DIALOGUE_MODE) {
    const target = current || latestSiteItems(['article'], 1)[0]
    if (target) {
      const source = normalizeWhitespace(target.excerpt || target.body || '')
      const firstSentence = source.split(/(?<=[.!؟])/u).map((part) => part.trim()).filter(Boolean)[0] || target.title
      return {
        kind: 'reply', reason: 'dialogue-opener', intent,
        reply: signReply(`خذ هذه من *${target.title}*:\n\n«${firstSentence}»\n\nشرايك — توافق الدكتور أم عندك زاوية أخرى؟ اكتب رأيك، وأنا أقابل رأيك بما كتبه في بقية المادة:\n${target.url}`, messages),
        evidence: [target.id], contextItemIds: [target.id], contextIndex: 0, lastTopic: target.title,
      }
    }
  }

  /* ─── الصدق فيما لا نملكه، مع بديلٍ نافع ─── */
  if (intent === INTENTS.REMIND_ME) {
    return { kind: 'reply', reason: 'reminder-honest', intent, reply: signReply('ما عندي جدولة تذكير هنا — أصدقك القول. البديل الأقرب: قل «احفظها» وأضم المادة لرفّك، فترجع لها متى شئت بكلمة «رفي».', messages) }
  }
  if (intent === INTENTS.WEEKLY_DIGEST) {
    const found = latestSiteItems([], 3)
    return {
      kind: 'reply', reason: 'digest-now', intent,
      reply: signReply(siteResultReply(found, 'النشرات تصل حين يبثها فريق المكتبة، وهذه خلاصة الأحدث الآن:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0,
    }
  }
  if (intent === INTENTS.CONTINUE_LISTENING) {
    const target = current || latestSiteItems(['article'], 1)[0]
    if (target) {
      const audioNote = target.audio?.dialogue || target.audio?.fahed || target.audio?.noura
        ? 'التشغيل يكمل من داخل الصفحة نفسها — المشغّل يحفظ موضعك على نفس الجهاز.'
        : 'هذه المادة نصية؛ قراءتها تكمل من حيث وقفت في الصفحة.'
      return {
        kind: 'reply', reason: 'continue-listening', intent,
        reply: signReply(`آخر مادة كنا عندها:\n*${target.title}*\n${itemMetaLine(target)}\n\n${audioNote}\n${target.url}`, messages),
        evidence: [target.id], contextItemIds: [target.id], contextIndex: 0,
      }
    }
  }
  if (intent === INTENTS.UPCOMING_EVENTS) {
    return { kind: 'reply', reason: 'upcoming-events', intent, reply: signReply(`اللقاءات والمشاركات القادمة المعلنة تجدها محدّثة هنا — والصفحة لا تعرض إلا ما أُعلن فعلاً:\n\n${SITE_URL}/upcoming`, messages) }
  }
  if (intent === INTENTS.TOP_ARTICLE_TOPIC) {
    const doors = archiveDoors(3)
    if (doors.length) return { kind: 'reply', reason: 'top-topics', intent, reply: signReply(`أكثر المحاور حضوراً في عناوين مقالات الدكتور: ${doors.join(' · ')}.\n\nاكتب أي محور منها وأفتح لك موادّه.`, messages) }
  }
  if (intent === INTENTS.MOST_VIEWED_ARTICLE) {
    const found = latestSiteItems(['article'], 3)
    return {
      kind: 'reply', reason: 'most-viewed-honest', intent,
      reply: signReply(siteResultReply(found, 'ما أملك عدّاد مشاهدات موثقاً أستند إليه هنا — فلا أخترع ترتيباً. هذه أحدث المقالات، وكلها مما يُقبل عليه القراء:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0,
    }
  }
  if (intent === INTENTS.VERIFIED_RESEARCH) {
    const found = latestSiteItems(['paper'], 3)
    if (found.length) return {
      kind: 'reply', reason: 'verified-research', intent,
      reply: signReply(siteResultReply(found, 'أوثق ما أقدمه لك أبحاث الدكتور المحكّمة المنشورة — لا أستشهد بمصادر خارج الموقع:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0,
    }
  }

  if ([INTENTS.SUMMARY, INTENTS.ONE_MINUTE, INTENTS.READ_SPEED].includes(intent)) {
    return current
      ? { kind: 'reply', reason: 'context-summary', intent, reply: signReply(excerptReply(current, true), messages), evidence: [current.id], contextItemIds: conversation.contextItemIds, contextIndex: conversation.contextIndex || 0 }
      : { kind: 'reply', reason: 'context-missing', intent, reply: signReply('أرسل لك مادة أولاً: قل «آخر مقالة» أو اكتب الموضوع، وبعدها أختصرها لك.', messages) }
  }
  if ([INTENTS.SOURCE_PROOF, INTENTS.READ_ARTICLE, INTENTS.LISTEN_FAHED, INTENTS.LISTEN_NOURA, INTENTS.LISTEN_DIALOGUE].includes(intent)) {
    if (!current) return { kind: 'reply', reason: 'context-missing', intent, reply: signReply(clarifyText(messages, conversation), messages) }
    const listenIntents = [INTENTS.LISTEN_FAHED, INTENTS.LISTEN_NOURA, INTENTS.LISTEN_DIALOGUE]
    const audioLine = listenIntents.includes(intent)
      ? (current.audio?.dialogue || current.audio?.fahed || current.audio?.noura
        ? '\nالاستماع من داخل الصفحة: ستجد المشغّل أعلى المادة.'
        : '\nهذه المادة لم تصدر لها نسخة صوتية بعد؛ النص كامل في الصفحة.')
      : ''
    return { kind: 'reply', reason: 'context-source', intent, reply: signReply(`هذا رابط ${itemLabel(current)} في موقع الدكتور:\n\n*${current.title}*\n${current.url}${audioLine}`, messages), evidence: [current.id], contextItemIds: conversation.contextItemIds, contextIndex: conversation.contextIndex || 0 }
  }
  if ([INTENTS.MORE_LIKE_THIS, INTENTS.SIMILAR_CONTENT].includes(intent)) {
    const topic = bounded(conversation.lastTopic, 500) || current?.title || text
    const found = exactSiteResults(topic, topic, { excludeIds: previousIds, limit: 3 })
    if (found.length) return {
      kind: 'reply', reason: 'more-like-this', intent, reply: signReply(siteResultReply(found, 'أكيد، هذه مواد ثانية قريبة من الفكرة:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: topic,
    }
    return { kind: 'reply', reason: 'no-more-results', intent, reply: signReply('خلصت المواد الأقرب لهذه الفكرة عندي. اكتب موضوعاً جديداً وأفتح لك مساراً مختلفاً.', messages) }
  }
  const contextItems = conversationContextItems(conversation)
  if ((intent === INTENTS.CONTEXT_REFERENCE || (intent === INTENTS.CHALLENGE_ANSWER && contextItems.length)) && contextItems.length) {
    const items = contextItems
    const request = classification.request || {}
    let index = Number(conversation.contextIndex || 0)
    const numericPick = intent === INTENTS.CHALLENGE_ANSWER ? Number(clean.replace(/[^0-9]/g, '')) : 0
    if (Number.isInteger(request.ordinal) && request.ordinal > 0) index = request.ordinal - 1
    else if (numericPick > 0) index = numericPick - 1
    else if (request.reference === 'next') index += 1
    else if (request.reference === 'previous') index -= 1
    index = Math.max(0, Math.min(items.length - 1, index))
    const item = items[index]
    return { kind: 'reply', reason: 'context-reference', intent, reply: signReply(excerptReply(item), messages), evidence: [item.id], contextItemIds: conversation.contextItemIds, contextIndex: index }
  }

  /* «عطني ٤ مقالات» — عددٌ ونوعٌ صريحان يستحقان قائمة، لا استيضاحاً. */
  const countedKind = clean.match(/(?:عطني|اعطني|ابي|اريد|ابغي|ورني|وريني|اعرض|هات)\s+(\d{1,2})\s*(مقالات|مقاله|مقال|ابحاث|بحوث|بحث|كتب|كتاب|بودكاست|حلقات|مختارات)/)
  if (countedKind) {
    const kindMap = { مقالات: 'article', مقاله: 'article', مقال: 'article', ابحاث: 'paper', بحوث: 'paper', بحث: 'paper', كتب: 'book', كتاب: 'book', بودكاست: 'podcast', حلقات: 'podcast', مختارات: 'curated' }
    const count = Math.max(1, Math.min(5, Number(countedKind[1]) || 3))
    const found = latestSiteItems([kindMap[countedKind[2]] || 'article'], count)
    if (found.length) return {
      kind: 'reply', reason: 'latest-content', intent,
      reply: signReply(siteResultReply(found, found.length > 1 ? 'هذه أحدث المواد المنشورة:' : `هذا أحدث ${itemLabel(found[0])} منشور:`), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: found[0].title,
    }
  }

  const latestKinds = intentKinds(intent)
  if (latestKinds.length || [INTENTS.LATEST_CONTENT, INTENTS.MISSED_CONTENT].includes(intent)) {
    const requested = requestedListCount(clean)
    const count = requested || ([INTENTS.LATEST_ARTICLES, INTENTS.MISSED_CONTENT].includes(intent) ? 3 : 1)
    const found = latestSiteItems(latestKinds, count)
    if (found.length) return {
      kind: 'reply', reason: 'latest-content', intent,
      reply: signReply(siteResultReply(found, count > 1 ? 'هذه أحدث المواد المنشورة:' : `هذا أحدث ${itemLabel(found[0])} منشور:`), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: found[0].title,
    }
  }
  if ([INTENTS.SURPRISE_ME, INTENTS.CONTENT_BY_MOOD, INTENTS.CURATED_PICKS].includes(intent)) {
    const pool = siteIndex().filter((item) => !previousIds.includes(item.id) && ['article', 'curated', 'podcast'].includes(item.kind))
    const signature = Number.parseInt(hash(`${conversation.lastInboundAt || ''}:${text}:${previousIds.join('|')}`).slice(0, 8), 16)
    const found = pool.length ? [pool[signature % pool.length]] : latestSiteItems([], 1)
    if (found.length) return {
      kind: 'reply', reason: 'surprise', intent, reply: signReply(siteResultReply(found, 'اخترت لك هذه؛ فيها فكرة تستحق الوقوف عندها:'), messages),
      evidence: found.map((item) => item.id), contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: found[0].title,
    }
  }

  const query = classification.request?.topic || text
  const kinds = classification.request?.kind
    ? [classification.request.kind === 'research' ? 'paper' : classification.request.kind]
    : []
  const found = exactSiteResults(query, '', { kinds, limit: 3 })
  if (found.length) return {
    kind: 'reply', reason: classification.fallback ? 'dialect-semantic-search' : 'site-index', intent,
    reply: signReply(siteResultReply(found), messages), evidence: found.map((item) => item.id),
    contextItemIds: found.map((item) => item.id), contextIndex: 0, lastTopic: query,
  }

  const asksQuestion = /[؟?]\s*$|(?:^|\s)(?:شنو|وش|ايش|كيف|متى|وين|هل|ليش|منو|كم|شلون|عطني|اعطني|ورني|ابي|ابغى|ودي|ممكن)(?:\s|$)/.test(clean)
  if (asksQuestion) {
    return { kind: 'reply', reason: 'active-clarify', intent, reply: signReply(clarifyText(messages, conversation), messages), priorReplyHash }
  }
  /* لا مطابقة دقيقة: نعرض الأقرب بعتبة متساهلة، فإن غاب فأبواب الأرشيف الحقيقية. */
  const near = nearestSuggestions(query, previousIds, 3)
  if (near.length) {
    const lines = near.map((item, index) => `${arabicNumber(index + 1)}) *${item.title}*\n${item.url}`)
    return {
      kind: 'reply', reason: 'near-suggestions', intent,
      reply: signReply(`${messages.noMatch || 'ما لقيت مادة منشورة مطابقة الآن.'}\n\nلكن هذه أقرب المواد المنشورة لفكرتك — جرّب كلمة أقرب للموضوع إن لم تصب:\n\n${lines.join('\n\n')}`, messages),
      evidence: near.map((item) => item.id), contextItemIds: near.map((item) => item.id), contextIndex: 0,
      priorReplyHash,
    }
  }
  const doors = archiveDoors(4)
  const doorsLine = doors.length ? `\n\n${messages.doorsPrefix || 'أبواب الأرشيف الحاضرة: '}${doors.join(' · ')}` : ''
  return {
    kind: 'reply',
    reason: 'no-grounded-answer',
    intent,
    reply: signReply(`${noMatchText(messages)}${doorsLine}`, messages),
    priorReplyHash,
  }
}

function safeEqualSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''))
  const right = Buffer.from(String(expected || ''))
  if (!left.length || !right.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

async function readJson(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 })
  }
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

function serializeDoc(snapshot) {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null
}

function normalizeAudienceDigits(value) {
  let digits = String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .replace(/^00+/, '')
  if (digits.length === 8) digits = `965${digits}`
  return /^\d{10,15}$/.test(digits) ? digits : ''
}

function audienceJid(value) {
  const digits = normalizeAudienceDigits(String(value || '').split('@', 1)[0])
  return digits ? `${digits}@c.us` : ''
}

function audienceContactId(jid) {
  return hash(`audience:${audienceJid(jid)}`).slice(0, 32)
}

function normalizeAudienceSearch(value) {
  return normalizeArabicMessage(value).replace(/\s+/g, ' ').trim()
}

function cleanAudienceName(value = '') {
  const raw = bounded(value, 120).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  // أسماء WhatsApp المزامنة قد تحتوي معرفاً تقنياً أو صفراً أو JID. لا نمسح
  // القيمة الأصلية من Firestore؛ نخفيها فقط من العرض حتى لا تتشوّه القوائم.
  if (/^(?:0+|undefined|null|unknown|none|blank)$/i.test(raw)) return ''
  if (/@(?:c\.us|s\.whatsapp\.net)$/i.test(raw) || /^BLINK@/i.test(raw)) return ''
  if (/^[+\d٠-٩۰-۹ .()_-]{5,}$/.test(raw)) return ''
  return raw
}

function audienceDisplayName(row = {}) {
  return cleanAudienceName(row.nickname)
    || cleanAudienceName(row.waName)
    || cleanAudienceName(row.displayName)
    || `••${bounded(row.tail, 4)}`
}

function audienceVocative(row = {}) {
  const raw = audienceDisplayName(row).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
  if (!raw || /^••\d{4}$/.test(raw)) return ''
  const title = raw.match(/^(?:(?:د|أ|ا|م)\s*\.|الدكتور(?:ة)?|دكتور(?:ة)?|الأستاذ(?:ة)?|استاذ(?:ة)?|الشيخ(?:ة)?)\s*/u)?.[0] || ''
  const rest = raw.slice(title.length).trim()
  const words = rest.split(/\s+/).filter(Boolean)
  const compound = /^(?:عبد|عبدال|أبو|ابو|أبا|ابا|أم|ام|ابن|بن|ذو|أبي|ابي|بو)$/u.test(words[0] || '')
  const first = compound && words[1] ? `${words[0]} ${words[1]}` : words[0] || ''
  return [title.trim(), first].filter(Boolean).join(' ')
}

function personalizeAudienceText(text, contact, at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: 'Asia/Kuwait',
  }).format(at))
  const name = audienceVocative(contact)
  return bounded(text, 4_000)
    .replace(/\{تحية\}/g, hour < 12 ? 'صباح الخير' : 'مساء الخير')
    .replace(/\{ترحيب\}/g, 'أهلاً')
    .replace(/\{الاسم\}/g, name)
    .replace(/[ \t]+([،,.؛:!?؟])/g, '$1')
    .replace(/^[ \t]*[،,؛:]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseAudienceImport(text) {
  const source = String(text || '').slice(0, MAX_BODY_BYTES)
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .replace(/^(PHOTO|LOGO|SOUND|KEY)[^:]*:.*$/gim, '')
  const rows = []
  if (/BEGIN:VCARD/i.test(source)) {
    for (const card of source.split(/BEGIN:VCARD/i).slice(1)) {
      const name = bounded(/^FN(?:;[^:]*)?:(.*)$/im.exec(card)?.[1], 120)
      const numbers = [...card.matchAll(/^TEL(?:;[^:]*)?:(.*)$/gim)]
      for (const match of numbers) rows.push({ name, phone: match[1] })
    }
  } else {
    for (const line of source.split(/\r?\n/).filter((item) => item.trim())) {
      const phoneMatch = line.match(/(?:\+|00)?[\d٠-٩۰-۹][\d٠-٩۰-۹\s().-]{6,}[\d٠-٩۰-۹]/)
      if (!phoneMatch) {
        rows.push({ name: '', phone: '' })
        continue
      }
      const name = bounded(line.replace(phoneMatch[0], '').replace(/^[\s,،;:|\-–—]+|[\s,،;:|\-–—]+$/g, ''), 120)
      rows.push({ name, phone: phoneMatch[0] })
    }
  }
  return rows
}

async function getAudienceContactsByIds(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  const contacts = []
  for (let offset = 0; offset < unique.length; offset += 250) {
    const refs = unique.slice(offset, offset + 250)
      .map((id) => db.collection(COLLECTIONS.audienceContacts).doc(id))
    if (!refs.length) continue
    const snapshots = await db.getAll(...refs)
    contacts.push(...snapshots.map(serializeDoc).filter(Boolean))
  }
  return contacts
}

async function listAudienceMembers(db, listId) {
  const memberships = await db.collection(COLLECTIONS.audienceMembers)
    .where('listId', '==', bounded(listId, 100)).limit(5_000).get()
  const contacts = await getAudienceContactsByIds(db, memberships.docs.map((doc) => doc.data()?.contactId))
  return contacts.sort((left, right) => audienceDisplayName(left).localeCompare(audienceDisplayName(right), 'ar'))
}

export function isStaleBridgeState(current = {}, incomingInstanceId = '', incomingSeq = null) {
  const currentSeq = Number(current?.stateSeq)
  const nextSeq = Number(incomingSeq)
  return Boolean(
    incomingInstanceId
    && current?.instanceId === incomingInstanceId
    && Number.isSafeInteger(currentSeq)
    && Number.isSafeInteger(nextSeq)
    && nextSeq >= 0
    && nextSeq < currentSeq
  )
}

export function isStaleInboundMessage({ timestamp = 0, bridgeReadyAt = '', bridgeStartedAt = '', graceMs = 1_500, now = Date.now() } = {}) {
  const raw = Number(timestamp)
  if (!Number.isFinite(raw) || raw <= 0) return false
  const messageAt = raw < 10_000_000_000 ? raw * 1_000 : raw
  const readyAt = Date.parse(bridgeReadyAt || '')
  const startedAt = Date.parse(bridgeStartedAt || '')
  const boundary = Number.isFinite(readyAt) ? readyAt : startedAt
  if (!Number.isFinite(boundary)) return false
  // cutover حازم: الرسالة التي وصلت قبل جاهزية العملية تخص فترة التوقف ولا
  // يجوز أن توقظ البوت عند استعادة الجسر. السماح فقط بهامش 0–2 ثانية لدقة timestamp.
  const safeGrace = Math.max(0, Math.min(2_000, Number(graceMs) || 0))
  return messageAt < Math.min(boundary - safeGrace, Number(now) + safeGrace)
}

export function isInvalidBridgeRegression(current = {}, incomingInstanceId = '', nextStatus = '') {
  if (!incomingInstanceId || current?.instanceId !== incomingInstanceId) return false
  const currentStatus = bounded(current?.status, 40)
  const incomingStatus = bounded(nextStatus, 40)
  const progressed = current?.connected === true || ['syncing', 'authenticated', 'connected'].includes(currentStatus)
  return progressed && (
    ['starting', 'pairing'].includes(incomingStatus)
    || (current?.connected === true && ['authenticated', 'syncing'].includes(incomingStatus))
  )
}

function bridgeStatus(data = {}) {
  const heartbeatAt = bounded(data.lastHeartbeatAt || data.updatedAt, 80)
  const heartbeatTime = heartbeatAt ? Date.parse(heartbeatAt) : NaN
  const heartbeatAgeMs = Number.isFinite(heartbeatTime) ? Math.max(0, Date.now() - heartbeatTime) : null
  const bridgeOnline = Number.isFinite(heartbeatAgeMs) && heartbeatAgeMs <= BRIDGE_ONLINE_MS
  const rawStatus = bounded(data.status, 40) || 'disconnected'
  const lastError = bounded(data.lastError, 600) || null
  const savedQr = bounded(data.qr, 8_000) || null
  const savedQrImage = bounded(data.qrImage, 500_000) || null
  const qrUpdatedAt = bounded(data.qrUpdatedAt || data.stateAt, 80) || null
  const qrUpdatedTime = qrUpdatedAt ? Date.parse(qrUpdatedAt) : NaN
  const qrAgeMs = Number.isFinite(qrUpdatedTime) ? Math.max(0, Date.now() - qrUpdatedTime) : null
  const qrFresh = qrAgeMs == null || qrAgeMs <= QR_FRESH_MS
  const connected = bridgeOnline && (data.connected === true || rawStatus === 'connected')
  const hasQrPayload = Boolean(savedQr || savedQrImage)
  const hasQr = bridgeOnline && !connected && rawStatus === 'pairing' && hasQrPayload && qrFresh
  const staleQr = bridgeOnline && !connected && rawStatus === 'pairing' && hasQrPayload && !qrFresh
  const normalizedStatus = !bridgeOnline
    ? 'disconnected'
    : connected
      ? 'connected'
      : hasQr
        ? 'pairing'
        : rawStatus
  const syncing = bridgeOnline && !connected && normalizedStatus === 'syncing'
  const finishing = bridgeOnline && !connected && ['authenticated', 'syncing'].includes(normalizedStatus)
  const failed = normalizedStatus === 'error'
  const syncPercent = Number(data.syncPercent || 0)
  const lastRepairRequestedAt = bounded(data.lastRepairRequestedAt, 80) || null
  const lastRepairTime = lastRepairRequestedAt ? Date.parse(lastRepairRequestedAt) : NaN
  const repairBlockedUntil = Number.isFinite(lastRepairTime)
    ? asIso(lastRepairTime + REPAIR_COOLDOWN_MS)
    : null
  const repairCooldownMs = repairBlockedUntil
    ? Math.max(0, Date.parse(repairBlockedUntil) - Date.now())
    : 0
  return {
    status: normalizedStatus,
    bridgeOnline,
    lastHeartbeatAt: heartbeatAt || null,
    heartbeatAgeMs,
    last_error: lastError,
    device_name: bounded(data.deviceName, 120) || 'جسر واتساب المركزي',
    bridgeVersion: bounded(data.version, 80) || null,
    bridgeInstanceId: bounded(data.instanceId, 100) || null,
    bridgeStateAt: bounded(data.stateAt, 80) || null,
    lastCatchupAt: bounded(data.lastCatchupAt, 80) || null,
    lastCatchupRecovered: Math.max(0, Number(data.lastCatchupRecovered || 0)),
    lastCatchupError: bounded(data.lastCatchupError, 300) || null,
    lastRecoveryRequestedAt: bounded(data.lastRecoveryRequestedAt, 80) || null,
    updated_at: bounded(data.updatedAt, 80) || null,
    qr: hasQr ? savedQr : null,
    qrImage: hasQr ? savedQrImage : null,
    qrUpdatedAt: hasQr ? qrUpdatedAt : null,
    qrAgeMs: hasQr ? qrAgeMs : null,
    qrFingerprint: hasQr ? (bounded(data.qrFingerprint, 80) || null) : null,
    lastRepairRequestedAt,
    repairBlockedUntil: repairCooldownMs > 0 ? repairBlockedUntil : null,
    repairCooldownMs,
    repairAllowed: !connected && repairCooldownMs <= 0,
    pairing_code: null,
    runtimePaused: Boolean(data.runtimePaused),
    indexed: siteIndex().length,
    timeZone: 'Asia/Kuwait',
    health: {
      code: connected ? 'ready' : hasQr ? 'scan-qr' : staleQr ? 'refreshing-qr' : syncing ? 'syncing' : finishing ? 'finishing' : failed ? 'error' : bridgeOnline ? 'connecting' : 'offline',
      label: connected ? 'جاهز' : hasQr ? 'امسح رمز QR' : staleQr ? 'يجري إنشاء رمز جديد' : syncing ? `جاري مزامنة المحادثات${syncPercent > 0 ? ` (${syncPercent}%)` : ''}` : finishing ? 'تم المسح — يجري إكمال الاتصال' : failed ? 'يحتاج مراجعة' : bridgeOnline ? 'يجري الاتصال' : 'الجسر غير متصل',
      why: connected
        ? 'جلسة واتساب متصلة والجسر يرسل نبضاته بانتظام.'
        : hasQr
          ? 'هذا هو أحدث رمز وصل من الجسر، واللوحة تتابع تغيّره لحظياً.'
          : staleQr
            ? 'أُخفي الرمز السابق لأنه لم يعد حديثاً؛ سيظهر الرمز الجديد تلقائياً.'
            : syncing
              ? `تم ربط الهاتف بنجاح وجاري مزامنة سجل المحادثات (${syncPercent}%).`
              : finishing
                ? 'استلم واتساب عملية المسح، وينتظر اكتمال تهيئة الجلسة.'
                : failed
                  ? (lastError || 'تعذر إكمال الاتصال بواتساب.')
                  : bridgeOnline
                    ? 'الجسر يعمل، لكن جلسة واتساب لم تصل إلى حالة الجاهزية بعد.'
                    : 'لم تصل نبضة حديثة من خدمة واتساب.',
      fix: hasQr
        ? 'ارفع سطوع الشاشة، وافتح من واتساب: الإعدادات ← الأجهزة المرتبطة ← ربط جهاز، ثم امسح الرمز كاملاً داخل الإطار الأبيض.'
        : staleQr
          ? 'لا تمسح الرمز القديم. انتظر ثوانٍ قليلة حتى يظهر الرمز الجديد.'
          : syncing
            ? 'لا تحتاج لمسح رمز QR جديد. انتظر اكتمال مزامنة المحادثات على الهاتف والجسر تلقائياً.'
            : finishing
              ? 'انتظر لحظات؛ تتحدث اللوحة تلقائياً عند اكتمال الاتصال.'
              : failed
                ? 'راجع سجل خدمة whatsapp-bridge، ثم أعد تشغيلها بعد معالجة الخطأ.'
                : bridgeOnline
                  ? 'انتظر التهيئة، أو أعد تشغيل خدمة واتساب إذا استمرت الحالة أكثر من دقيقتين.'
                  : 'شغّل خدمة whatsapp-bridge على الخادم وتحقق من اتصالها بالإنترنت.',
      ready: connected,
      needsAuthScan: hasQr,
      connected,
      quietNow: Boolean(data.runtimePaused),
      silenced: 0,
      pollFailures: 0,
    },
  }
}

function diagnosticTimestamp(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().getTime()
  const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : null
}

function newestDiagnosticTime(rows, keys) {
  let latest = null
  for (const row of rows) {
    for (const key of keys) {
      const value = diagnosticTimestamp(row?.[key])
      if (value != null && (latest == null || value > latest)) latest = value
    }
  }
  return latest == null ? null : asIso(latest)
}

export function buildWhatsAppDiagnostics({
  status = {},
  conversations = [],
  commands = [],
  now = Date.now(),
} = {}) {
  const rows = Array.isArray(conversations) ? conversations : []
  const queueRows = Array.isArray(commands) ? commands : []
  const silenced = rows.filter((row) => row?.mode === 'human').length
  const pending = queueRows.filter((row) => row?.status === 'pending').length
  const leased = queueRows.filter((row) => row?.status === 'leased').length
  const held = queueRows.filter((row) => row?.status === 'held').length
  const failed = queueRows.filter((row) => row?.status === 'failed').length
  const staleLeased = queueRows.filter((row) => {
    if (row?.status !== 'leased') return false
    const leasedAt = diagnosticTimestamp(row?.leasedAt || row?.updatedAt)
    return leasedAt != null && now - leasedAt > 90_000
  }).length
  const active = pending + leased + held
  const lastInboundAt = newestDiagnosticTime(rows, ['lastInboundAt'])
  const lastReplyAt = newestDiagnosticTime(rows, ['lastReplyAt'])
  const lastManualAt = newestDiagnosticTime(rows, ['lastManualAt'])
  const lastFailed = queueRows
    .filter((row) => row?.status === 'failed')
    .sort((left, right) => (diagnosticTimestamp(right?.updatedAt) || 0) - (diagnosticTimestamp(left?.updatedAt) || 0))[0]
  const connected = status?.health?.ready === true || (status?.bridgeOnline === true && status?.status === 'connected')
  const indexed = Number(status?.indexed || 0)
  const runtimePaused = status?.runtimePaused === true
  const needsAuthScan = status?.health?.needsAuthScan === true
  const bridgeOnline = status?.bridgeOnline === true

  const checks = [
    {
      id: 'control-plane',
      label: 'لوحة التحكم',
      state: 'ok',
      detail: 'الخادم استجاب للفحص وصلاحية المشرف سليمة.',
    },
    {
      id: 'resident-bridge',
      label: 'خدمة الماك المقيمة',
      state: bridgeOnline ? 'ok' : 'error',
      detail: bridgeOnline
        ? `النبض يصل بانتظام${status?.heartbeatAgeMs != null ? `؛ آخر نبضة قبل ${Math.max(1, Math.round(Number(status.heartbeatAgeMs) / 1000))} ثانية` : ''}.`
        : 'لا تصل نبضة من الماك؛ قد يكون الجهاز مطفأً أو نائماً، الإنترنت مقطوعاً، أو خدمة التشغيل متوقفة.',
    },
    {
      id: 'whatsapp-session',
      label: 'جلسة واتساب',
      state: connected ? 'ok' : needsAuthScan ? 'warning' : 'error',
      detail: connected
        ? 'واتساب موثّق ومتصل.'
        : needsAuthScan
          ? 'الخدمة تعمل لكنها تنتظر مسح رمز QR من الهاتف.'
          : (status?.last_error || status?.health?.why || 'جلسة واتساب لم تصل إلى الجاهزية.'),
    },
    {
      id: 'missed-message-recovery',
      label: 'استرجاع الرسائل المتأخرة',
      state: status?.lastCatchupError ? 'warning' : status?.lastCatchupAt ? 'ok' : 'info',
      detail: status?.lastCatchupError
        ? `تعذّر آخر فحص استرجاع: ${bounded(status.lastCatchupError, 180)}`
        : status?.lastCatchupAt
          ? `آخر فحص ${status.lastCatchupAt}؛ استعاد ${Math.max(0, Number(status.lastCatchupRecovered || 0))} رسالة فاتتها الأحداث الحية.`
          : 'يعمل الفحص بعد اكتمال اتصال الجسر ثم كل خمس دقائق.',
    },
    {
      id: 'reply-engine',
      label: 'محرك الرد',
      state: runtimePaused ? 'error' : indexed > 0 ? (silenced > 0 ? 'warning' : 'ok') : 'error',
      detail: runtimePaused
        ? 'الردود الآلية موقوفة من لوحة التحكم.'
        : indexed <= 0
          ? 'فهرس الموقع فارغ؛ لا توجد مادة موثقة يبني عليها الرد.'
          : silenced > 0
            ? `المحرك يعمل، لكن ${silenced} محادثة تحت الاستلام اليدوي ولن تعود إلا بعد إتاحة الإيقاظ.`
            : `المحرك يعمل ومعه ${indexed} مادة موثقة.`,
    },
    {
      id: 'command-queue',
      label: 'طابور الأوامر',
      state: staleLeased > 0 ? 'error' : failed > 0 ? 'warning' : active > 0 ? 'info' : 'ok',
      detail: staleLeased > 0
        ? `${staleLeased} أمر عالق بعد استلامه من الجسر.`
        : failed > 0
          ? `${failed} أمر فشل مؤخراً${lastFailed?.error ? `: ${bounded(lastFailed.error, 180)}` : '.'}`
          : active > 0
            ? `${active} أمر قيد الانتظار أو التنفيذ.`
            : 'لا توجد أوامر عالقة.',
    },
  ]

  let code = 'healthy'
  let level = 'healthy'
  let title = 'كل الأنظمة جاهزة'
  let summary = 'الجسر متصل، جلسة واتساب جاهزة، ومحرك الرد يعمل من فهرس الموقع.'
  let action = 'لا يلزم تدخل. استخدم «فحص شامل» متى أردت التأكد.'

  if (!bridgeOnline) {
    code = 'resident-offline'
    level = 'critical'
    title = 'خدمة الماك لا ترسل نبضاً'
    summary = 'العطل قبل واتساب نفسه: لوحة التحكم لا ترى الجسر المقيم على الماك.'
    action = 'اضغط «إحياء آمن» ليُحفظ طلب التشغيل، وتأكد أن الماك يعمل ومتصل بالإنترنت. خدمة النظام تعيده تلقائياً من دون مسح الجلسة.'
  } else if (needsAuthScan) {
    code = 'scan-qr'
    level = 'warning'
    title = 'واتساب ينتظر ربط الهاتف'
    summary = 'الجسر سليم، لكن جلسة واتساب تحتاج مصادقة من الأجهزة المرتبطة.'
    action = 'امسح رمز QR الظاهر في اللوحة مرة واحدة وانتظر حتى تظهر «جاهز».'
  } else if (!connected) {
    code = 'session-not-ready'
    level = 'critical'
    title = 'الجسر يعمل لكن واتساب غير جاهز'
    summary = status?.last_error || status?.health?.why || 'الاتصال متوقف في مرحلة التهيئة.'
    action = 'اضغط «إحياء آمن». إذا ظهر «فشل التوثيق» فقط، استخدم «إعادة ربط من الصفر».'
  } else if (runtimePaused) {
    code = 'replies-paused'
    level = 'warning'
    title = 'الاتصال سليم والردود موقوفة'
    summary = 'واتساب متصل، لكن مفتاح الإيقاف العام يمنع البوت من الرد.'
    action = 'اضغط «إحياء آمن» أو «تشغيل الردود» لإعادته فوراً.'
  } else if (staleLeased > 0) {
    code = 'queue-stalled'
    level = 'warning'
    title = 'هناك أمر عالق'
    summary = 'الجسر متصل، لكن أمراً بقي مستلماً من دون إكمال.'
    action = 'اضغط «إحياء آمن» لإعادة الأمر إلى الطابور وإعادة تشغيل الجسر مع إبقاء الجلسة.'
  } else if (indexed <= 0) {
    code = 'knowledge-empty'
    level = 'critical'
    title = 'محرك الرد بلا فهرس'
    summary = 'الاتصال سليم، لكن فهرس الموقع الذي يمنع التخمين فارغ.'
    action = 'حدّث الموقع ثم شغّل «فحص شامل». لا تستخدم إعادة ربط واتساب لهذا العطل.'
  } else if (failed > 0) {
    code = 'recent-command-failures'
    level = 'warning'
    title = 'الاتصال سليم مع فشل أوامر سابقة'
    summary = 'البوت جاهز الآن، لكن توجد أوامر فشلت ويظهر سبب آخر فشل في طابور الأوامر.'
    action = 'شغّل «إحياء آمن» إذا استمر الفشل؛ لا تمسح جلسة واتساب.'
  } else if (silenced > 0) {
    code = 'manual-takeover'
    level = 'attention'
    title = 'البوت حي مع محادثات مستلمة يدوياً'
    summary = `الاتصال سليم، لكن ${silenced} محادثة أُغلقت فيها جلسة البوت بعد رد بشري.`
    action = 'استخدم «اسمح بالإيقاظ»؛ بعدها يعود فقط عندما يكتب الشخص جملة الإيقاظ.'
  }

  return {
    code,
    level,
    title,
    summary,
    action,
    checkedAt: asIso(now),
    checks,
    queue: { active, pending, leased, held, failed, staleLeased },
    activity: { lastInboundAt, lastReplyAt, lastManualAt },
    privacy: 'التشخيص يعرض الحالة والتوقيت والعدادات فقط؛ لا يعرض نصوص الناس أو أرقامهم.',
  }
}

async function getConversation(db, jid) {
  const ref = db.collection(COLLECTIONS.conversations).doc(conversationId(jid))
  const snapshot = await ref.get()
  return { ref, data: snapshot.exists ? snapshot.data() || {} : {} }
}

let rulesCache = { expiresAt: 0, rows: [], pending: null }
let runtimeCache = { expiresAt: 0, paused: false, pending: null }

function invalidateRulesCache() {
  rulesCache = { expiresAt: 0, rows: [], pending: null }
}

async function listRules(db) {
  if (rulesCache.expiresAt > Date.now()) return rulesCache.rows
  if (rulesCache.pending) return rulesCache.pending
  rulesCache.pending = db.collection(COLLECTIONS.rules).limit(250).get().then((snapshot) => {
    const rows = snapshot.docs.map(serializeDoc).filter(Boolean)
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ar'))
    rulesCache = { expiresAt: Date.now() + 30_000, rows, pending: null }
    return rows
  }).catch((error) => {
    rulesCache.pending = null
    throw error
  })
  return rulesCache.pending
}

async function runtimePaused(db) {
  if (runtimeCache.expiresAt > Date.now()) return runtimeCache.paused
  if (runtimeCache.pending) return runtimeCache.pending
  runtimeCache.pending = db.collection(COLLECTIONS.settings).doc('runtime').get().then((snapshot) => {
    const paused = Boolean(snapshot.exists && snapshot.data()?.paused)
    runtimeCache = { expiresAt: Date.now() + 10_000, paused, pending: null }
    return paused
  }).catch((error) => {
    runtimeCache.pending = null
    throw error
  })
  return runtimeCache.pending
}

async function enqueueCommand(db, type, payload = {}, metadata = {}) {
  const idempotencyKey = bounded(metadata.idempotencyKey, 240)
  const id = idempotencyKey ? hash(`whatsapp-command:${idempotencyKey}`).slice(0, 40) : randomUUID()
  const ref = db.collection(COLLECTIONS.commands).doc(id)
  if (idempotencyKey) {
    const existing = await ref.get()
    if (existing.exists) return { id, type: bounded(existing.data()?.type, 80) || type, reused: true, status: bounded(existing.data()?.status, 40) || 'pending' }
  }
  const now = asIso()
  await ref.set({
    id, type, payload, status: 'pending', attempts: 0, accountingVersion: 2, createdAt: now, updatedAt: now,
    availableAt: bounded(metadata.availableAt, 80) || now,
    campaignId: bounded(metadata.campaignId, 100) || null,
    campaignIndex: Number.isFinite(Number(metadata.campaignIndex)) ? Number(metadata.campaignIndex) : null,
    recipientFingerprint: bounded(metadata.recipientFingerprint, 80) || bounded(payload.recipientFingerprint, 80) || null,
    idempotencyKey: idempotencyKey || null,
    retryFailure: metadata.retryFailure === true,
  })
  return { id, type, reused: false, status: 'pending' }
}

async function queueNextCampaignMessage(db, campaignId, delayMs = 0) {
  const ref = db.collection(COLLECTIONS.campaigns).doc(bounded(campaignId, 100))
  const snapshot = await ref.get()
  if (!snapshot.exists) return null
  const campaign = snapshot.data() || {}
  if (campaign.state !== 'sending' || campaign.pendingCommandId) return null
  const targets = Array.isArray(campaign.targetIds) ? campaign.targetIds.slice(0, 5_000) : []
  let cursor = Math.max(0, Number(campaign.cursor || 0))
  let contact = null
  while (cursor < targets.length && !contact) {
    const candidate = await db.collection(COLLECTIONS.audienceContacts).doc(bounded(targets[cursor], 100)).get()
    const data = serializeDoc(candidate)
    if (data && !data.suppressed && audienceJid(data.jid)) contact = data
    else cursor += 1
  }
  if (!contact) {
    await ref.set({
      state: Number(campaign.failed || 0) > 0 ? 'partial' : 'completed',
      cursor: targets.length,
      pendingCommandId: null,
      nextAt: null,
      completedAt: asIso(),
      updatedAt: asIso(),
    }, { merge: true })
    return null
  }
  const availableAt = asIso(Date.now() + Math.max(0, Number(delayMs || 0)))
  const recipientFingerprint = outboundRecipientFingerprint(contact.jid)
  if (!recipientFingerprint) {
    await ref.set({ failed: Number(campaign.failed || 0) + 1, cursor: cursor + 1, lastError: 'رقم غير صالح للإرسال.', updatedAt: asIso() }, { merge: true })
    return queueNextCampaignMessage(db, campaignId, delayMs)
  }
  const command = await enqueueCommand(db, 'send-message', {
    jid: contact.jid,
    text: personalizeAudienceText(campaign.message, contact),
    recipientFingerprint,
  }, {
    campaignId: ref.id,
    campaignIndex: cursor,
    availableAt,
    recipientFingerprint,
    idempotencyKey: `broadcast:${ref.id}:${cursor}:${recipientFingerprint}`,
  })
  await ref.set({
    cursor: cursor + 1,
    pendingCommandId: command.id,
    nextAt: availableAt,
    updatedAt: asIso(),
  }, { merge: true })
  return command
}

let lastBroadcastReconcileAt = 0
let broadcastReconcilePending = null

async function settleRetryCampaignState(db, campaignId) {
  const id = bounded(campaignId, 100)
  if (!id) return
  const campaignRef = db.collection(COLLECTIONS.campaigns).doc(id)
  const [campaignSnapshot, commandRows] = await Promise.all([
    campaignRef.get(),
    db.collection(COLLECTIONS.commands).where('campaignId', '==', id).limit(5000).get(),
  ])
  if (!campaignSnapshot.exists) return
  const campaign = campaignSnapshot.data() || {}
  const retryCommands = commandRows.docs.map(serializeDoc).filter((item) => item?.retryFailure === true)
  const pendingRetries = retryCommands.filter((item) => ['pending', 'leased', 'held'].includes(item.status))
  const nextAt = pendingRetries
    .filter((item) => item.status === 'pending')
    .map((item) => bounded(item.availableAt, 80))
    .filter(Boolean)
    .sort()[0] || null

  // إذا أوقف الدكتور الحملة مؤقتاً لا نغيّر قرار الوقف بسبب ACK متأخر.
  if (campaign.state === 'paused') {
    await campaignRef.set({ nextAt: null, updatedAt: asIso() }, { merge: true })
    return
  }
  if (campaign.state !== 'retrying') return
  if (!pendingRetries.length) {
    await campaignRef.set({
      state: Number(campaign.failed || 0) > 0 ? 'partial' : 'completed',
      nextAt: null,
      retryCompletedAt: asIso(),
      updatedAt: asIso(),
    }, { merge: true })
  } else {
    await campaignRef.set({ nextAt, updatedAt: asIso() }, { merge: true })
  }
}

async function accountCampaignCommand(db, commandId) {
  const id = bounded(commandId, 80)
  if (!id) return { accounted: false, reason: 'missing-command-id' }
  const commandRef = db.collection(COLLECTIONS.commands).doc(id)
  let outcome = { accounted: false, reason: 'not-terminal' }

  await db.runTransaction(async (transaction) => {
    const commandSnapshot = await transaction.get(commandRef)
    if (!commandSnapshot.exists) {
      outcome = { accounted: false, reason: 'missing-command' }
      return
    }
    const command = { id: commandSnapshot.id, ...(commandSnapshot.data() || {}) }
    if (!command.campaignId || !['completed', 'failed'].includes(command.status)) {
      outcome = { accounted: false, reason: 'not-terminal', command }
      return
    }
    if (command.campaignAccountedAt) {
      outcome = { accounted: false, alreadyAccounted: true, reason: 'already-accounted', command }
      return
    }

    const campaignRef = db.collection(COLLECTIONS.campaigns).doc(bounded(command.campaignId, 100))
    const campaignSnapshot = await transaction.get(campaignRef)
    if (!campaignSnapshot.exists) {
      transaction.set(commandRef, { campaignAccountedAt: asIso(), campaignAccountingError: 'campaign-missing', updatedAt: asIso() }, { merge: true })
      outcome = { accounted: false, reason: 'campaign-missing', command }
      return
    }

    const campaign = campaignSnapshot.data() || {}
    const retryFailure = command.retryFailure === true
    const accountingVersion = Number(command.accountingVersion || 0)
    if (accountingVersion < 2 && retryFailure) {
      // حملات retry القديمة كانت تعدّل العدادات قبل وجود marker ذري؛ إعادة
      // احتسابها هنا قد تضاعف الأرقام. لا نخاطر بأثر رجعي، وكل retry جديد
      // يُرقّى إلى accountingVersion:2 أدناه.
      transaction.set(commandRef, { legacyAccountingSkippedAt: asIso(), updatedAt: asIso() }, { merge: true })
      outcome = { accounted: false, reason: 'legacy-retry-accounting-unknown', command }
      return
    }
    if (accountingVersion < 2 && !retryFailure) {
      const campaignIndex = Number(command.campaignIndex)
      const alreadyReflected = Number.isFinite(campaignIndex)
        && (Number(campaign.sent || 0) + Number(campaign.failed || 0)) > campaignIndex
      if (alreadyReflected) {
        const inferredAt = asIso()
        transaction.set(commandRef, { campaignAccountedAt: inferredAt, legacyAccountingInferred: true, updatedAt: inferredAt }, { merge: true })
        outcome = { accounted: false, alreadyAccounted: true, reason: 'legacy-accounting-inferred', command }
        return
      }
    }
    const succeeded = command.status === 'completed'
    const sent = Number(campaign.sent || 0) + (succeeded ? 1 : 0)
    const failed = retryFailure
      ? Math.max(0, Number(campaign.failed || 0) - (succeeded ? 1 : 0))
      : Number(campaign.failed || 0) + (succeeded ? 0 : 1)
    const accountedAt = asIso()

    transaction.set(campaignRef, {
      ...(retryFailure ? {} : { pendingCommandId: null }),
      sent,
      failed,
      lastError: succeeded ? null : bounded(command.error, 600) || 'تعذّر تسليم الرسالة.',
      lastDeliveredAt: succeeded ? (bounded(command.deliveredAt, 80) || accountedAt) : campaign.lastDeliveredAt || null,
      updatedAt: accountedAt,
    }, { merge: true })
    transaction.set(commandRef, {
      campaignAccountedAt: accountedAt,
      campaignAccountingError: null,
      updatedAt: accountedAt,
    }, { merge: true })

    outcome = {
      accounted: true,
      campaignId: bounded(command.campaignId, 100),
      retryFailure,
      succeeded,
      sent,
      failed,
      intervalSeconds: Number(campaign.intervalSeconds || 45),
      campaignState: bounded(campaign.state, 40),
    }
  })

  if (!outcome.accounted) return outcome
  if (outcome.retryFailure) {
    await settleRetryCampaignState(db, outcome.campaignId)
  } else if (outcome.campaignState === 'sending') {
    const intervalMs = Math.max(20_000, Math.min(15 * 60_000, Number(outcome.intervalSeconds || 45) * 1_000))
    await queueNextCampaignMessage(db, outcome.campaignId, intervalMs)
  }
  return outcome
}

function broadcastReconcileDelayMs(campaign = {}, command = {}) {
  const intervalMs = Math.max(20_000, Math.min(15 * 60_000, Number(campaign.intervalSeconds || 45) * 1_000))
  const deliveredAt = Date.parse(command.deliveredAt || campaign.lastDeliveredAt || '')
  if (!Number.isFinite(deliveredAt)) return Number(campaign.sent || 0) > 0 ? intervalMs : 0
  return Math.max(0, intervalMs - Math.max(0, Date.now() - deliveredAt))
}

async function reconcileBroadcastState(db, { force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastBroadcastReconcileAt < 30_000) return { skipped: true }
  if (broadcastReconcilePending) return broadcastReconcilePending
  lastBroadcastReconcileAt = now

  broadcastReconcilePending = (async () => {
    const campaignsSnapshot = await db.collection(COLLECTIONS.campaigns).limit(100).get()
    const active = campaignsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((campaign) => ['sending', 'retrying'].includes(campaign.state))

    let repaired = 0
    for (const campaign of active) {
      if (campaign.state === 'sending') {
        const campaignRef = db.collection(COLLECTIONS.campaigns).doc(campaign.id)
        const pendingId = bounded(campaign.pendingCommandId, 80)
        if (!pendingId) {
          await queueNextCampaignMessage(db, campaign.id, broadcastReconcileDelayMs(campaign))
          repaired += 1
          continue
        }
        const commandRef = db.collection(COLLECTIONS.commands).doc(pendingId)
        const commandSnapshot = await commandRef.get()
        if (!commandSnapshot.exists) {
          await campaignRef.set({ pendingCommandId: null, nextAt: null, lastError: 'تم إصلاح مؤشر إرسال مفقود.', updatedAt: asIso() }, { merge: true })
          await queueNextCampaignMessage(db, campaign.id, 0)
          repaired += 1
          continue
        }
        const command = { id: commandSnapshot.id, ...(commandSnapshot.data() || {}) }
        if (['completed', 'failed'].includes(command.status)) {
          if (command.campaignAccountedAt) {
            await campaignRef.set({ pendingCommandId: null, updatedAt: asIso() }, { merge: true })
            await queueNextCampaignMessage(db, campaign.id, broadcastReconcileDelayMs(campaign, command))
          } else {
            await accountCampaignCommand(db, command.id)
          }
          repaired += 1
        }
      } else if (campaign.state === 'retrying') {
        const rows = await db.collection(COLLECTIONS.commands).where('campaignId', '==', campaign.id).limit(5000).get()
        for (const doc of rows.docs) {
          const command = { id: doc.id, ...(doc.data() || {}) }
          if (command.retryFailure === true && Number(command.accountingVersion || 0) >= 2 && ['completed', 'failed'].includes(command.status) && !command.campaignAccountedAt) {
            await accountCampaignCommand(db, command.id)
            repaired += 1
          }
        }
        await settleRetryCampaignState(db, campaign.id)
      }
    }
    return { skipped: false, repaired }
  })().finally(() => { broadcastReconcilePending = null })

  return broadcastReconcilePending
}

function campaignPublicState(snapshot) {
  const row = snapshot?.exists ? (snapshot.data() || {}) : (snapshot || {})
  const id = snapshot?.id || bounded(row.id, 100)
  const total = Math.max(0, Number(row.total || 0))
  const sent = Math.max(0, Number(row.sent || 0))
  const failed = Math.max(0, Number(row.failed || 0))
  const completed = Math.min(total, sent + failed)
  return {
    id,
    name: bounded(row.name, 180) || 'حملة واتساب',
    state: bounded(row.state, 40) || 'draft',
    total,
    sent,
    failed,
    completed,
    remaining: Math.max(0, total - completed),
    cursor: Math.max(0, Number(row.cursor || 0)),
    intervalSeconds: Math.max(0, Number(row.intervalSeconds || 0)),
    nextAt: bounded(row.nextAt, 80) || null,
    lastError: bounded(row.lastError, 260) || null,
    messagePreview: bounded(row.message, 500),
    createdAt: bounded(row.createdAt, 80) || null,
    approvedAt: bounded(row.approvedAt, 80) || null,
    startedAt: bounded(row.startedAt, 80) || null,
    pausedAt: bounded(row.pausedAt, 80) || null,
    completedAt: bounded(row.completedAt, 80) || null,
    updatedAt: bounded(row.updatedAt, 80) || null,
  }
}

function decisionLabel(reason = '') {
  const value = bounded(reason, 180)
  if (!value) return 'غير مصنّف'
  if (value.startsWith('rule-no-grounding:')) return 'قاعدة لم تجد مادة موثقة'
  if (value.startsWith('rule:')) return 'قاعدة معتمدة'
  const labels = {
    'site-index': 'مادة موثقة من الموقع',
    'site-is-source': 'سؤال عن معلومات الموقع',
    greeting: 'تحية',
    'wake-phrase': 'تفعيل المساعد',
    duplicate: 'رسالة مكررة',
    'human-request': 'طلب تدخل بشري',
    'no-grounded-answer': 'لا توجد إجابة موثقة',
    media: 'وسائط تحتاج مراجعة',
    'empty-after-normalization': 'رسالة بلا محتوى قابل للمعالجة',
    'awaiting-wake-phrase': 'بانتظار جملة الإيقاظ',
    'runtime-paused': 'التشغيل متوقف مؤقتاً',
    thanks: 'شكر ومجاملة',
    farewell: 'وداع',
    acknowledged: 'إقرار قصير',
    'who-are-you': 'سؤال عن هوية المساعد',
    praise: 'ثناء',
    'delete-preferences': 'مسح التفضيلات',
    'correction-retry': 'تصحيح وبحث من زاوية ثانية',
    'correction-clarify': 'تصحيح يحتاج توضيحاً',
    'challenge-question': 'تحدي معرفي',
    'challenge-correct': 'إجابة تحدٍ صحيحة',
    'challenge-missed': 'إجابة تحدٍ غير مصيبة',
    'saved-to-shelf': 'حفظ في الرف',
    'shelf-list': 'استعراض الرف',
    'shelf-removed': 'حذف من الرف',
    'curated-quote': 'اقتباس من المختارات',
    'compare-topics': 'مقارنة موضوعين',
    'mood-match': 'مواساة بمادة مناسبة',
    'idea-network': 'شبكة الفكرة',
    'explain-grounded': 'شرح مؤرّض بالمادة',
    'dialogue-opener': 'فتح حوار حول مادة',
    'reminder-honest': 'اعتذار صادق عن التذكير',
    'digest-now': 'خلاصة الأحدث',
    'continue-listening': 'مواصلة الاستماع',
    'upcoming-events': 'اللقاءات القادمة',
    'top-topics': 'أبرز المحاور',
    'most-viewed-honest': 'الأكثر مشاهدة (بصدق الحدود)',
    'verified-research': 'أبحاث محكّمة',
    'near-suggestions': 'أقرب المواد المنشورة',
    'context-reference': 'تنقّل داخل النتائج',
    'context-summary': 'تلخيص المادة الحالية',
    'context-source': 'رابط المصدر',
    'more-like-this': 'المزيد من المشابه',
    'latest-content': 'أحدث المنشور',
    surprise: 'اختيار مفاجئ',
  }
  return labels[value] || value.replace(/[-_:]+/g, ' ')
}

function aggregateCounts(rows, keyOf, valueOf = (key) => key) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, total]) => ({ key, label: valueOf(key), total }))
    .sort((left, right) => right.total - left.total || String(left.label).localeCompare(String(right.label), 'ar'))
}

async function sweepExpiredManualStates(db) {
  /* ترقيةٌ آمنة لحالات النسخ القديمة فقط: انتهاء مؤقت الاستلام اليدوي لا
     يعيد البوت. يحوّل المحادثة إلى الصمت الأساسي، ولا يفتحها بعد ذلك إلا
     أن يكتب الطرف الآخر جملة الإيقاظ الدقيقة. */
  const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
  const writes = []
  for (const doc of snapshot.docs) {
    const data = doc.data() || {}
    if (data.mode === 'human' && data.needsHuman !== true && (data.manualUntil || data.autoResumeAt)) {
      writes.push(doc.ref.set({
        mode: 'human',
        wakeActive: false,
        wakeVersion: 1,
        manualUntil: null,
        autoResumeAt: null,
        notificationMutedUntil: null,
        updatedAt: asIso(),
        automaticResumeDisabledAt: asIso(),
      }, { merge: true }))
    }
  }
  await Promise.all(writes)
  return writes.length
}

function adminPath(url) {
  return url.pathname.slice('/api/admin/whatsapp'.length) || '/'
}

function bridgePath(url) {
  return url.pathname.slice('/api/whatsapp'.length) || '/'
}

export function createWhatsAppController({ getFirestore, verifyAdminRequest } = {}) {
  if (typeof getFirestore !== 'function') throw new Error('getFirestore is required')
  if (typeof verifyAdminRequest !== 'function') throw new Error('verifyAdminRequest is required')

  const bridgeSecret = String(process.env.WHATSAPP_BRIDGE_SECRET || '').trim()

  async function requireAdmin(req, res) {
    try {
      if (await verifyAdminRequest(req)) return true
    } catch {
      // الرد الموحد أدناه لا يكشف سبب فشل التوثيق.
    }
    sendJson(res, 403, { error: 'Admin access required' })
    return false
  }

  function requireBridge(req, res) {
    const supplied = req.headers['x-whatsapp-bridge-secret']
    if (bridgeSecret && safeEqualSecret(supplied, bridgeSecret)) return true
    sendJson(res, 401, { error: 'Invalid bridge secret' })
    return false
  }

  async function stopAllSending(db) {
    const [commands, campaigns] = await Promise.all([
      db.collection(COLLECTIONS.commands).limit(500).get(),
      db.collection(COLLECTIONS.campaigns).limit(500).get(),
    ])
    const activeCommands = commands.docs.filter((doc) => {
      const value = doc.data() || {}
      return ['pending', 'leased', 'held'].includes(value.status)
        && ['send-message', 'send-self-message'].includes(value.type)
    })
    const activeCampaigns = campaigns.docs.filter((doc) =>
      ['approved', 'paused', 'sending', 'retrying'].includes(doc.data()?.state))
    let batch = db.batch()
    let writes = 0
    const commitIfNeeded = async (force = false) => {
      if (!writes || (!force && writes < 400)) return
      await batch.commit()
      batch = db.batch()
      writes = 0
    }
    for (const command of activeCommands) {
      batch.set(command.ref, {
        status: 'cancelled',
        error: 'أوقفها الدكتور من زر الطوارئ قبل التسليم.',
        cancelledAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      writes += 1
      await commitIfNeeded()
    }
    for (const campaign of activeCampaigns) {
      batch.set(campaign.ref, {
        state: 'stopped',
        pendingCommandId: null,
        stoppedAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      writes += 1
      await commitIfNeeded()
    }
    await commitIfNeeded(true)
    return {
      commandsStopped: activeCommands.length,
      campaignsStopped: activeCampaigns.length,
    }
  }

  async function handleWebhook(req, res) {
    if (!requireBridge(req, res)) return
    const body = await readJson(req)
    const event = bounded(body.event, 40)
    const { db } = await getFirestore()
    const now = asIso()

    if (event === 'heartbeat' || event === 'status' || event === 'qr') {
      const ref = db.collection(COLLECTIONS.bridge).doc('primary')
      const incomingInstanceId = bounded(body.instanceId, 100)
      const incomingSeq = Number(body.stateSeq)
      const validIncomingSeq = Number.isSafeInteger(incomingSeq) && incomingSeq >= 0 ? incomingSeq : null
      const incomingStateAt = bounded(body.stateAt, 80) || now
      const nextStatus = event === 'qr'
        ? 'pairing'
        : bounded(body.status, 40) || (body.connected === true ? 'connected' : '')
      const heartbeatPatch = {
        lastHeartbeatAt: now,
        updatedAt: now,
        deviceName: bounded(body.deviceName, 120),
        version: bounded(body.version, 80),
        lastCatchupAt: bounded(body.lastCatchupAt, 80) || null,
        lastCatchupRecovered: Math.max(0, Number(body.lastCatchupRecovered || 0)),
        lastCatchupError: bounded(body.lastCatchupError, 300) || null,
      }

      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref)
        const current = snapshot.exists ? snapshot.data() || {} : {}
        const staleState = isStaleBridgeState(current, incomingInstanceId, validIncomingSeq)
        const invalidRegression = isInvalidBridgeRegression(current, incomingInstanceId, nextStatus)

        /* تبقى النبضة حديثة حتى لو وصل حدث حالة قديم، لكن لا نسمح لرمز QR
           متأخر — حتى لو حمل رقماً تسلسلياً أحدث — بأن يطغى على جلسة قبلها
           الهاتف بالفعل. بدء عملية جديدة له instanceId جديد فيُقبل طبيعياً. */
        if (staleState || invalidRegression) {
          transaction.set(ref, heartbeatPatch, { merge: true })
          return
        }

        const patch = {
          ...heartbeatPatch,
          lastError: bounded(body.error, 600) || null,
          ...(incomingInstanceId ? { instanceId: incomingInstanceId } : {}),
          ...(validIncomingSeq != null ? { stateSeq: validIncomingSeq } : {}),
          stateAt: incomingStateAt,
        }
        if (nextStatus) patch.status = nextStatus
        if (event === 'qr') patch.connected = false
        else if (body.connected === true || nextStatus === 'connected') patch.connected = true
        else if (body.connected === false) patch.connected = false

        if (event === 'qr') {
          patch.qr = bounded(body.qr, 8_000)
          patch.qrImage = bounded(body.qrImage, 500_000)
          patch.qrUpdatedAt = bounded(body.qrGeneratedAt, 80) || incomingStateAt
          patch.qrFingerprint = bounded(body.qrFingerprint, 80) || hash(body.qr).slice(0, 16)
        } else if (['authenticated', 'connected', 'syncing'].includes(nextStatus) || body.connected === true || event === 'loading_screen') {
          patch.qr = null
          patch.qrImage = null
          patch.qrUpdatedAt = null
          patch.qrFingerprint = null
          if (body.percent != null) patch.syncPercent = Number(body.percent)
          else if (body.syncPercent != null) patch.syncPercent = Number(body.syncPercent)
        }
        transaction.set(ref, patch, { merge: true })
      })

      if (event === 'heartbeat') await sweepExpiredManualStates(db)
      sendJson(res, 200, { ok: true })
      return
    }

    if (event === 'contacts-sync') {
      const contacts = Array.isArray(body.contacts) ? body.contacts.slice(0, 5_000) : []
      let accepted = 0
      let batch = db.batch()
      let batchSize = 0
      const flush = async () => {
        if (!batchSize) return
        await batch.commit()
        batch = db.batch()
        batchSize = 0
      }
      for (const item of contacts) {
        const jid = audienceJid(item?.jid || item?.id)
        if (!jid) continue
        const id = audienceContactId(jid)
        const digits = jid.split('@', 1)[0]
        const ref = db.collection(COLLECTIONS.audienceContacts).doc(id)
        const waName = bounded(item?.name || item?.pushname || item?.shortName, 120)
        const displayName = bounded(item?.displayName, 120)
        batch.set(ref, {
          id,
          jid,
          tail: digits.slice(-4),
          ...(waName ? { waName } : {}),
          ...(displayName ? { displayName } : {}),
          source: 'whatsapp-sync',
          lastSeenAt: now,
          updatedAt: now,
        }, { merge: true })
        accepted += 1
        batchSize += 1
        if (batchSize >= 400) await flush()
      }
      await flush()
      sendJson(res, 200, { ok: true, accepted })
      return
    }

    const jid = normalizeConversationJid(body.jid)
    if (!jid) {
      sendJson(res, 400, { error: 'Invalid conversation id' })
      return
    }
    const { ref, data } = await getConversation(db, jid)

    if (event === 'manual') {
      await ref.set({
        jid,
        masked: maskJid(jid),
        mode: 'human',
        wakeActive: false,
        wakeVersion: 1,
        needsHuman: false,
        manualUntil: null,
        autoResumeAt: null,
        notificationMutedUntil: null,
        lastManualAt: now,
        updatedAt: now,
      }, { merge: true })
      sendJson(res, 200, { ok: true, wakeActive: false })
      return
    }

    if (event === 'delivery-failed') {
      await ref.set({ lastDeliveryError: bounded(body.error, 600), lastDeliveryFailedAt: now, updatedAt: now }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }

    if (event !== 'incoming') {
      sendJson(res, 400, { error: 'Unsupported webhook event' })
      return
    }

    if (isOwnerPrivateChat(jid)) {
      await ref.set({ jid, masked: maskJid(jid), mode: 'human', wakeActive: false, lastInboundAt: now, updatedAt: now }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'owner-private-chat' })
      return
    }

    // دفاع ثانٍ خلف الجسر: WhatsApp Web قد يعيد بث تاريخ المحادثة بعد مزامنة
    // جلسة جديدة. الرسالة الأقدم من جاهزية *هذه العملية* لا تفتح بوابة الإيقاظ
    // ولا تغيّر سياق المحادثة ولا تستحق رداً، مهما كان نوعها أو محتواها.
    if (isStaleInboundMessage({
      timestamp: body.timestamp,
      bridgeReadyAt: bounded(body.bridgeReadyAt, 80),
      bridgeStartedAt: bounded(body.bridgeStartedAt, 80),
    })) {
      await ref.set({
        jid,
        masked: maskJid(jid),
        lastIgnoredBackfillAt: now,
        lastIgnoredBackfillType: bounded(body.mediaType, 80) || 'text',
        lastQuarantineReason: 'pre-ready-backfill',
        quarantinedBackfillCount: Math.max(0, Number(data.quarantinedBackfillCount || 0)) + 1,
        updatedAt: now,
      }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'stale-after-bridge-start' })
      return
    }

    const text = bounded(body.text, 12_000)
    const incomingHash = hash(normalizeArabicMessage(text) || `media:${bounded(body.mediaType, 80)}`)
    const incomingMessageId = bounded(body.messageId, 240)
    const incomingMessageIdHash = incomingMessageId ? hash(`message-id:${incomingMessageId}`) : ''
    const recentIncomingMessageIds = Array.isArray(data.recentIncomingMessageIds)
      ? data.recentIncomingMessageIds.filter((value) => typeof value === 'string' && value).slice(-99)
      : []
    const recentInboundResponses = data.recentInboundResponses && typeof data.recentInboundResponses === 'object' && !Array.isArray(data.recentInboundResponses)
      ? data.recentInboundResponses
      : {}
    const deliveryResponsePatch = (action, reason, replyText = '') => {
      if (!incomingMessageIdHash) return {}
      const recentResponses = Object.fromEntries(Object.entries(recentInboundResponses).slice(-23))
      recentResponses[incomingMessageIdHash] = {
        action: bounded(action, 40),
        reason: bounded(reason, 100),
        replyText: bounded(replyText, 2_000),
        createdAt: now,
      }
      return { recentInboundResponses: recentResponses }
    }
    /* التكرار التقني يُعرف من معرّف تسليم واتساب، لا من نص الرسالة. كان
       تكرار «آخر المقالات» برسالة جديدة يُعامَل كإعادة تسليم فيسكت أو يرسل
       fallback بشرياً. كل messageId جديد هو دور حوار جديد ولو كان النص نفسه. */
    const duplicate = isDuplicateInboundDelivery({
      messageIdHash: incomingMessageIdHash,
      recentMessageIds: recentIncomingMessageIds,
      incomingHash,
      previousIncomingHash: data.lastIncomingHash,
      previousInboundAt: data.lastInboundAt,
    })
    /* تحديث قوالب اللوحة خلفيّ لا يؤخر رداً: يجلب bot_messages/templates ضمن
       TTL داخلي، فيسري تحرير الدكتور من لوحة «رسائل البوت» خلال دقائق. */
    void refreshBotMessages().catch(() => {})
    const wakePhrase = isWhatsAppWakePhrase(text)
    const manualTakeoverActive = data.mode === 'human'
      || (data.mode === 'silent' && Boolean(data.lastManualAt) && data.wakeActive !== true)

    const basePatch = {
      jid,
      masked: maskJid(jid),
      lastInboundAt: now,
      lastIncomingHash: incomingHash,
      ...(incomingMessageIdHash ? {
        lastIncomingMessageIdHash: incomingMessageIdHash,
        recentIncomingMessageIds: [...new Set([...recentIncomingMessageIds, incomingMessageIdHash])].slice(-100),
      } : {}),
      lastMessageType: bounded(body.mediaType, 80) || 'text',
      updatedAt: now,
    }

    if (manualTakeoverActive && !wakePhrase) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'human-takeover' })
      return
    }

    /* البوابة المطلقة (أمر الدكتور بعد كارثة ٣٠ يوليو): كل رسالة جديدة في
       الوضع الطبيعي تُقابل بالصمت التام — لا ردّ لأحدٍ إطلاقاً إلا داخل جلسةٍ
       فتحها صاحبها بكتابة «موقع د. أحمد» بنفسه. wakeVersion=2 هي نسخة
       الإيقاظ المعتمدة؛ ما فتحه الوضع القديم تلقائياً (نسخة ١) لاغٍ. */
    if (wakePhrase) {
      const welcome = buildWakeWelcome()
      const signedWelcome = signReply(welcome.text)
      await ref.set({
        ...basePatch,
        mode: 'bot',
        wakeActive: true,
        wakeVersion: 2,
        wakeOpenedAt: now,
        needsHuman: false,
        manualUntil: null,
        autoResumeAt: null,
        lastReplyHash: hash(signedWelcome),
        lastReplyAt: now,
        /* بوابة اليوم تدخل السياق لحظة الإيقاظ: «٣٠ ثانية/لخصها/المصدر» بعد
           الترحيب مباشرة تعمل على مادة البوابة نفسها. */
        ...(welcome.contextItemIds.length ? {
          contextItemIds: welcome.contextItemIds,
          contextIndex: 0,
          lastTopic: bounded(welcome.lastTopic, 500),
          seenContentIds: [...new Set([...(Array.isArray(data.seenContentIds) ? data.seenContentIds : []), ...welcome.evidence])].slice(-40),
        } : {}),
        ...deliveryResponsePatch('reply', 'wake-phrase', signedWelcome),
      }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'reply', reason: 'wake-phrase', reply: { text: signedWelcome } })
      return
    }

    /* ═══ البوابة المقدسة — قبل أي مسارٍ آخر حتى إعادة التسليم ═══
       جلسة غير مفتوحة بنسخة الإيقاظ المعتمدة (٢) = صمتٌ مطبق، ولا يُعاد بثّ
       أي ردٍّ مخزونٍ من حقبة «دائم التفاعل» الملغاة. */
    const wakeGateOpen = data.mode !== 'human'
      && data.wakeActive === true
      && Number(data.wakeVersion || 0) >= 2
    if (!wakeGateOpen) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'awaiting-wake-phrase' })
      return
    }

    if (duplicate) {
      /* إن وصل رد الخادم ثم انقطع الجسر قبل إرسال واتساب، يعيد الاسترجاع
         messageId نفسه. نعيد الرد المخزن حتى لا تضيع الرسالة؛ أما إعادة
         التسليم بعد إرسال ناجح فيوقفها checkpoint المحلي قبل بلوغ الخادم. */
      const cached = incomingMessageIdHash ? recentInboundResponses[incomingMessageIdHash] : null
      await ref.set(basePatch, { merge: true })
      if (cached?.replyText) {
        sendJson(res, 200, {
          ok: true,
          action: ['reply', 'reply-and-escalate'].includes(cached.action) ? cached.action : 'reply',
          reason: 'duplicate-delivery-replay',
          reply: { text: bounded(cached.replyText, 2_000) },
          replayed: true,
        })
        return
      }
      sendJson(res, 200, { ok: true, action: 'none', reason: 'duplicate-delivery' })
      return
    }

    const [paused, rules] = await Promise.all([runtimePaused(db), listRules(db)])
    if (paused) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'runtime-paused' })
      return
    }

    const decision = decideGroundedResponse({
      text,
      hasMedia: Boolean(body.hasMedia),
      rules,
      priorReplyHash: bounded(data.lastReplyHash, 80),
      conversation: data,
    })
    const replyText = bounded(decision.reply, 2_000)
    /* إذا كرر الشخص الطلب في رسالة جديدة نجيبه من جديد. تشابه الرد ليس دليلاً
       على إعادة تسليم، ولا مبرراً لاستبداله برسالة متابعة بشرية أو رد عام. */
    const safeReply = replyText

    if (decision.kind === 'no-reply') {
      await ref.set({
        ...basePatch,
        mode: 'bot',
        wakeActive: true,
        wakeVersion: 2,
        ...(decision.patch && typeof decision.patch === 'object' ? decision.patch : {}),
      }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: decision.reason })
      return
    }

    if (decision.kind === 'silent') {
      const eventId = randomUUID()
      await Promise.all([
        ref.set({
          ...basePatch,
          mode: 'bot',
          wakeActive: true,
          wakeVersion: 2,
          needsHuman: true,
          escalationReason: decision.reason,
          escalatedAt: now,
        }, { merge: true }),
        db.collection(COLLECTIONS.events).doc(eventId).set({
          id: eventId,
          conversationId: ref.id,
          masked: maskJid(jid),
          reason: decision.reason,
          status: 'open',
          silent: true,
          createdAt: now,
          updatedAt: now,
        }),
      ])
      sendJson(res, 200, { ok: true, action: 'none', reason: decision.reason, needsHuman: true })
      return
    }

    if (decision.kind === 'escalate') {
      const eventId = randomUUID()
      await Promise.all([
        ref.set({
          ...basePatch,
          mode: 'bot',
          wakeActive: true,
          wakeVersion: 2,
          needsHuman: true,
          manualUntil: null,
          autoResumeAt: null,
          notificationMutedUntil: null,
          escalationReason: decision.reason,
          escalatedAt: now,
          lastReplyHash: hash(safeReply),
          lastReplyAt: now,
          ...deliveryResponsePatch('reply-and-escalate', decision.reason, safeReply),
        }, { merge: true }),
        db.collection(COLLECTIONS.events).doc(eventId).set({
          id: eventId,
          conversationId: ref.id,
          masked: maskJid(jid),
          reason: decision.reason,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        }),
      ])
      sendJson(res, 200, {
        ok: true,
        action: 'reply-and-escalate',
        reason: decision.reason,
        reply: { text: safeReply },
        notifyOwner: {
          text: `${OWNER_ALERT_FALLBACK}\nالمحادثة: ${maskJid(jid)}\nالسبب: ${decision.reason}`,
          conversationId: jid,
        },
      })
      return
    }

    await ref.set({
      ...basePatch,
      mode: 'bot',
      wakeActive: true,
      wakeVersion: 2,
      needsHuman: false,
      manualUntil: null,
      autoResumeAt: null,
      lastReplyHash: hash(safeReply),
      lastReplyAt: now,
      lastEvidence: decision.evidence || [],
      lastDecisionReason: decision.reason,
      ...(Array.isArray(decision.contextItemIds) ? { contextItemIds: decision.contextItemIds.slice(0, 12) } : {}),
      ...(Number.isInteger(decision.contextIndex) ? { contextIndex: decision.contextIndex } : {}),
      ...(decision.lastTopic ? { lastTopic: bounded(decision.lastTopic, 500) } : {}),
      ...(Array.isArray(decision.evidence) && decision.evidence.length ? {
        seenContentIds: [...new Set([...(Array.isArray(data.seenContentIds) ? data.seenContentIds : []), ...decision.evidence])].slice(-40),
      } : {}),
      ...(decision.patch && typeof decision.patch === 'object' ? decision.patch : {}),
      ...deliveryResponsePatch('reply', decision.reason, safeReply),
    }, { merge: true })
    /* ذاكرة اللهجة الحيّة: الصياغة التي لم تُفهم بثقة تُرصد للمراقبة في اللوحة
       (كما كانت أيام الوكيل المحلي). رصدٌ خلفي لا يؤخر الرد، ولا يتعلم البوت
       منها جواباً — الاعتماد يبقى للدكتور صراحةً. */
    if (['active-clarify', 'no-grounded-answer', 'near-suggestions', 'correction-clarify'].includes(decision.reason)) {
      const phrase = bounded(stripArabicGreetings(text) || normalizeArabicMessage(text), 160)
      if (phrase.length >= 2) {
        const patternId = hash(`learn:${phrase}`).slice(0, 32)
        void (async () => {
          const patternRef = db.collection(COLLECTIONS.learning).doc(patternId)
          const snapshot = await patternRef.get()
          const previous = snapshot.exists ? (snapshot.data() || {}) : {}
          if (previous.status === 'ignored') return
          await patternRef.set({
            id: patternId,
            phrase,
            status: previous.status === 'learned' ? 'learned' : 'observing',
            reason: bounded(decision.reason, 60),
            hits: Number(previous.hits || 0) + 1,
            firstSeenAt: previous.firstSeenAt || now,
            lastSeenAt: now,
            updatedAt: now,
          }, { merge: true })
        })().catch(() => {})
      }
    }
    sendJson(res, 200, { ok: true, action: 'reply', reason: decision.reason, reply: { text: safeReply } })
  }

  async function handleBridgeCommand(req, res, url, method) {
    if (!requireBridge(req, res)) return
    const { db } = await getFirestore()
    if (bridgePath(url) === '/emergency-stop' && method === 'POST') {
      const result = await stopAllSending(db)
      sendJson(res, 200, { ok: true, ...result })
      return
    }
    if (bridgePath(url) === '/runtime-resume' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({
        paused: false,
        resumedAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      runtimeCache = { expiresAt: Date.now() + 10_000, paused: false, pending: null }
      sendJson(res, 200, { ok: true, paused: false })
      return
    }
    if (method === 'GET') {
      // كل poll يصلح أي حالة بث بقيت بين ACK وFirestore بسبب restart/انقطاع شبك.
      // الفحص throttled ولا يلمس القوائم أو جهات الاتصال.
      await reconcileBroadcastState(db).catch(() => {})
      const snapshot = await db.collection(COLLECTIONS.commands).limit(100).get()
      const now = Date.now()
      const pending = snapshot.docs.map(serializeDoc).filter((command) => {
        const availableAt = Date.parse(command.availableAt || command.createdAt || '')
        if (command.status === 'pending') return !Number.isFinite(availableAt) || availableAt <= now
        const lease = Date.parse(command.leasedAt || '')
        return command.status === 'leased' && Number.isFinite(lease) && now - lease > 90_000
      }).sort((a, b) => String(a.availableAt || a.createdAt || '').localeCompare(String(b.availableAt || b.createdAt || '')))[0]
      if (!pending) {
        sendJson(res, 200, { command: null })
        return
      }
      await db.collection(COLLECTIONS.commands).doc(pending.id).set({
        status: 'leased', leasedAt: asIso(), updatedAt: asIso(), attempts: Number(pending.attempts || 0) + 1,
      }, { merge: true })
      sendJson(res, 200, { command: pending })
      return
    }
    if (method === 'POST') {
      const body = await readJson(req)
      const id = bounded(body.commandId, 80)
      if (!id) {
        sendJson(res, 400, { error: 'commandId is required' })
        return
      }
      const commandRef = db.collection(COLLECTIONS.commands).doc(id)
      const commandSnapshot = await commandRef.get()
      const command = serializeDoc(commandSnapshot)
      if (!command) {
        sendJson(res, 404, { error: 'command not found' })
        return
      }

      // إذا وصل ACK ثانٍ بعد أن ثبتنا حالة الأمر، لا نسمح له بقلب النجاح
      // إلى فشل أو العكس. وإن حدث restart بين تثبيت الأمر واحتساب الحملة، نكمل
      // الاحتساب مرة واحدة فقط من الحالة المثبتة.
      if (['completed', 'failed'].includes(command.status)) {
        if (command.campaignId && !command.campaignAccountedAt) await accountCampaignCommand(db, id)
        sendJson(res, 200, { ok: true, duplicateAck: true, status: command.status })
        return
      }

      const rawBridgeError = bounded(body.error, 600)
      const transientBridgeError = /detached\s+frame|execution context (?:was )?destroyed|target closed|session closed|most likely because of a navigation/i.test(rawBridgeError)
      const retryableBridgeFailure = body.retry === true
        || (body.ok === false && transientBridgeError && Number(command?.attempts || 0) < 4)
      if (retryableBridgeFailure) {
        await commandRef.set({
          status: 'pending',
          leasedAt: null,
          completedAt: null,
          availableAt: new Date(Date.now() + 3_500).toISOString(),
          error: 'bridge-session-refresh',
          updatedAt: asIso(),
        }, { merge: true })
        sendJson(res, 200, { ok: true, requeued: true })
        return
      }

      const expectedFingerprint = bounded(command.recipientFingerprint, 80)
        || outboundRecipientFingerprint(command.payload?.jid)
      const deliveredFingerprint = bounded(body.delivery?.recipientFingerprint, 80)
      const isSendCommand = ['send-message', 'send-self-message'].includes(command.type)
      const deliveryMismatch = body.ok !== false && isSendCommand && expectedFingerprint
        && deliveredFingerprint !== expectedFingerprint
      const safeBridgeError = deliveryMismatch
        ? 'recipient-delivery-verification-failed'
        : transientBridgeError
          ? 'أعاد واتساب تهيئة الجلسة ولم يكتمل التسليم بعد عدة محاولات.'
          : rawBridgeError
      const succeeded = body.ok !== false && !deliveryMismatch
      const completedAt = asIso()

      await commandRef.set({
        status: succeeded ? 'completed' : 'failed',
        error: safeBridgeError || null,
        completedAt,
        updatedAt: completedAt,
        ...(isSendCommand ? {
          deliveryVerification: succeeded ? 'verified' : (deliveryMismatch ? 'mismatch' : 'failed'),
          deliveryMessageId: bounded(body.delivery?.messageId, 240) || null,
          deliveryRecipientFingerprint: deliveredFingerprint || null,
          deliveredAt: succeeded ? (bounded(body.delivery?.at, 80) || completedAt) : null,
        } : {}),
      }, { merge: true })

      if (command.campaignId) await accountCampaignCommand(db, id)

      // لا نطلب من الجسر إعادة إرسال رسالة وصلت لرقم غير متطابق. نسجلها فشلاً
      // تشغيلياً واضحاً؛ طبقة الجسر نفسها تمنع هذا قبل sendMessage أيضاً.
      sendJson(res, 200, {
        ok: true,
        accepted: succeeded,
        ...(deliveryMismatch ? { warning: 'recipient-delivery-verification-failed' } : {}),
      })
      return
    }
    sendJson(res, 405, { error: 'Method Not Allowed' })
  }

  async function handleAdmin(req, res, url, method) {
    if (!(await requireAdmin(req, res))) return
    const { db } = await getFirestore()
    const path = adminPath(url)

    if (path === '/status' && method === 'GET') {
      await sweepExpiredManualStates(db)
      const [bridgeSnapshot, runtimeSnapshot, conversations, commands] = await Promise.all([
        db.collection(COLLECTIONS.bridge).doc('primary').get(),
        db.collection(COLLECTIONS.settings).doc('runtime').get(),
        db.collection(COLLECTIONS.conversations).limit(250).get(),
        db.collection(COLLECTIONS.commands).limit(250).get(),
      ])
      const data = bridgeSnapshot.exists ? bridgeSnapshot.data() || {} : {}
      const status = bridgeStatus({ ...data, runtimePaused: Boolean(runtimeSnapshot.data()?.paused) })
      const conversationRows = conversations.docs.map((doc) => doc.data() || {})
      const commandRows = commands.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      const silenced = conversationRows.filter((row) => row.mode === 'human').length
      status.health.silenced = silenced
      status.health.quietNow = status.runtimePaused || silenced > 0
      status.diagnostics = buildWhatsAppDiagnostics({
        status,
        conversations: conversationRows,
        commands: commandRows,
      })
      res.setHeader('Cache-Control', 'no-store, max-age=0')
      sendJson(res, 200, status)
      return
    }

    if (path === '/silence' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
      const active = snapshot.docs.map((doc) => doc.data() || {}).filter((row) => row.mode === 'human')
      sendJson(res, 200, { silenced: active.length, until: null })
      return
    }

    if (path === '/rules' && method === 'GET') {
      sendJson(res, 200, await listRules(db))
      return
    }

    if (path === '/rules' && ['POST', 'PATCH'].includes(method)) {
      const body = await readJson(req, 64 * 1024)
      const id = method === 'PATCH' ? bounded(body.id, 100) : randomUUID()
      if (!id || !bounded(body.name, 120) || !Array.isArray(body.keywords) || !body.keywords.length) {
        sendJson(res, 400, { error: 'الاسم وكلمة مطابقة واحدة على الأقل مطلوبان.' })
        return
      }
      const existing = await db.collection(COLLECTIONS.rules).doc(id).get()
      if (existing.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: existing.data(), createdAt: asIso(),
        })
      }
      const rule = {
        id,
        name: bounded(body.name, 120),
        keywords: body.keywords.map((value) => bounded(value, 100)).filter(Boolean).slice(0, 40),
        priority: Math.max(-100, Math.min(1_000, Number(body.priority || 0))),
        matchType: ['any', 'all', 'exact'].includes(body.matchType) ? body.matchType : 'any',
        actionType: ['text', 'site-content', 'transfer'].includes(body.actionType) ? body.actionType : 'text',
        responseText: bounded(body.responseText, 2_000),
        contentQuery: bounded(body.contentQuery, 500),
        enabled: body.enabled !== false,
        updatedAt: asIso(),
      }
      await db.collection(COLLECTIONS.rules).doc(id).set(rule)
      invalidateRulesCache()
      sendJson(res, 200, rule)
      return
    }

    const ruleDelete = /^\/rules\/([^/]+)$/.exec(path)
    if (ruleDelete && method === 'DELETE') {
      const id = decodeURIComponent(ruleDelete[1])
      const ref = db.collection(COLLECTIONS.rules).doc(id)
      const current = await ref.get()
      if (current.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: current.data(), createdAt: asIso(),
        })
        await ref.delete()
        invalidateRulesCache()
      }
      sendJson(res, 200, { ok: true })
      return
    }

    const versionsMatch = /^\/rules\/([^/]+)\/versions$/.exec(path)
    if (versionsMatch && method === 'GET') {
      const id = decodeURIComponent(versionsMatch[1])
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).limit(250).get()
      const versions = snapshot.docs.map(serializeDoc).filter((row) => row.ruleId === id)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .map(({ id: docId, ...row }) => ({ ...row, id: Number(row.id || String(docId).split(':').at(-1)) }))
      sendJson(res, 200, versions)
      return
    }

    const rollbackMatch = /^\/rules\/([^/]+)\/rollback\/(\d+)$/.exec(path)
    if (rollbackMatch && method === 'POST') {
      const id = decodeURIComponent(rollbackMatch[1])
      const versionId = rollbackMatch[2]
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).get()
      if (!snapshot.exists || !snapshot.data()?.snapshot) {
        sendJson(res, 404, { error: 'Version not found' })
        return
      }
      await db.collection(COLLECTIONS.rules).doc(id).set({ ...snapshot.data().snapshot, id, updatedAt: asIso() })
      invalidateRulesCache()
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/restart' && method === 'POST') {
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'restart') })
      return
    }
    if (path === '/recover' && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true) {
        sendJson(res, 400, { error: 'يلزم تأكيد الإحياء الآمن.' })
        return
      }
      const requestedAt = asIso()
      const commandSnapshot = await db.collection(COLLECTIONS.commands).limit(250).get()
      let requeued = 0
      let batch = db.batch()
      for (const doc of commandSnapshot.docs) {
        const command = doc.data() || {}
        const leasedAt = diagnosticTimestamp(command.leasedAt || command.updatedAt)
        if (command.status !== 'leased' || leasedAt == null || Date.now() - leasedAt <= 90_000) continue
        batch.set(doc.ref, {
          status: 'pending',
          leasedAt: null,
          availableAt: requestedAt,
          updatedAt: requestedAt,
          error: null,
        }, { merge: true })
        requeued += 1
      }
      batch.set(db.collection(COLLECTIONS.settings).doc('runtime'), {
        paused: false,
        lastRecoveryRequestedAt: requestedAt,
        updatedAt: requestedAt,
      }, { merge: true })
      batch.set(db.collection(COLLECTIONS.bridge).doc('primary'), {
        lastRecoveryRequestedAt: requestedAt,
        updatedAt: requestedAt,
      }, { merge: true })
      await batch.commit()
      runtimeCache = { expiresAt: Date.now() + 10_000, paused: false, pending: null }
      const command = await enqueueCommand(db, 'restart', { recovery: true })
      sendJson(res, 200, {
        ok: true,
        requestedAt,
        requeued,
        command,
        message: 'أُعيد تشغيل الردود وحُفظ طلب إعادة تشغيل آمن للجسر من دون مسح جلسة واتساب.',
      })
      return
    }
    if (path === '/repair' && method === 'POST') {
      const bridgeRef = db.collection(COLLECTIONS.bridge).doc('primary')
      const bridgeSnapshot = await bridgeRef.get()
      const bridgeData = bridgeSnapshot.exists ? bridgeSnapshot.data() || {} : {}
      const current = bridgeStatus(bridgeData)
      if (current.health?.ready) {
        sendJson(res, 409, { error: 'الجلسة متصلة وسليمة؛ رفضت اللوحة مسحها.' })
        return
      }
      if (current.repairCooldownMs > 0) {
        sendJson(res, 429, {
          error: 'أوقفت اللوحة تكرار إعادة الربط حتى لا يفرض واتساب حظراً مؤقتاً جديداً.',
          retryAfterMs: current.repairCooldownMs,
          retryAt: current.repairBlockedUntil,
        })
        return
      }
      await bridgeRef.set({ lastRepairRequestedAt: asIso(), updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'repair-session'), message: 'أُرسل طلب إعادة الربط إلى الجسر المركزي.' })
      return
    }
    if (path === '/agent/pause' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: true, updatedAt: asIso() }, { merge: true })
      runtimeCache = { expiresAt: Date.now() + 10_000, paused: true, pending: null }
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/agent/resume' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: false, updatedAt: asIso() }, { merge: true })
      runtimeCache = { expiresAt: Date.now() + 10_000, paused: false, pending: null }
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/manual-takeover' && method === 'POST') {
      const body = await readJson(req)
      const jid = bounded(body.jid, 180)
      const { ref } = await getConversation(db, jid)
      await ref.set({
        jid,
        masked: maskJid(jid),
        mode: 'human',
        wakeActive: false,
        wakeVersion: 1,
        needsHuman: false,
        manualUntil: null,
        autoResumeAt: null,
        notificationMutedUntil: null,
        lastManualAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true, until: null, resumes: 'wake-phrase-only' })
      return
    }
    if (path === '/bot-return' && method === 'POST') {
      const body = await readJson(req)
      const { ref } = await getConversation(db, bounded(body.jid, 180))
      await ref.set({ mode: 'silent', wakeActive: false, wakeVersion: 1, needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, resumes: 'wake-phrase-only' })
      return
    }
    if (path === '/bot-return-all' && method === 'POST') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(500).get()
      const rows = snapshot.docs.filter((doc) => doc.data()?.mode === 'human')
      await Promise.all(rows.map((doc) => doc.ref.set({ mode: 'silent', wakeActive: false, wakeVersion: 1, needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })))
      sendJson(res, 200, { returned: rows.length })
      return
    }

    if (path === '/audience/contacts' && method === 'GET') {
      const term = normalizeAudienceSearch(url.searchParams.get('q') || '')
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)))
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
      const [contactSnapshot, membershipSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.audienceContacts).limit(5_000).get(),
        db.collection(COLLECTIONS.audienceMembers).limit(10_000).get(),
      ])
      const listCounts = new Map()
      for (const membership of membershipSnapshot.docs) {
        const id = bounded(membership.data()?.contactId, 100)
        if (id) listCounts.set(id, Number(listCounts.get(id) || 0) + 1)
      }
      const contacts = contactSnapshot.docs.map(serializeDoc).filter(Boolean)
        .map((contact) => ({
          id: contact.id,
          name: audienceDisplayName(contact),
          nickname: bounded(contact.nickname, 120),
          waName: bounded(contact.waName || contact.displayName, 120),
          tail: bounded(contact.tail, 4),
          suppressed: Boolean(contact.suppressed),
          lists: Number(listCounts.get(contact.id) || 0),
        }))
        .filter((contact) => !term
          || normalizeAudienceSearch(contact.name).includes(term)
          || contact.tail.includes(term))
        .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      sendJson(res, 200, {
        contacts: contacts.slice(offset, offset + limit),
        total: contacts.length,
        offset,
        limit,
      })
      return
    }

    if (path === '/audience/contacts' && method === 'POST') {
      const body = await readJson(req)
      const digits = normalizeAudienceDigits(body.phone)
      if (!digits) {
        sendJson(res, 400, { error: 'الرقم غير مكتمل.' })
        return
      }
      const jid = `${digits}@c.us`
      const id = audienceContactId(jid)
      const nickname = bounded(body.nickname, 120)
      await db.collection(COLLECTIONS.audienceContacts).doc(id).set({
        id,
        jid,
        tail: digits.slice(-4),
        ...(nickname ? { nickname, displayName: nickname } : {}),
        source: 'manual',
        updatedAt: asIso(),
        createdAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true, id })
      return
    }

    if (path === '/audience/import' && method === 'POST') {
      const body = await readJson(req, MAX_BODY_BYTES)
      const parsed = parseAudienceImport(body.text)
      const normalized = new Map()
      const skipped = []
      for (const [index, item] of parsed.entries()) {
        const digits = normalizeAudienceDigits(item.phone)
        if (!digits) {
          skipped.push(index)
          continue
        }
        const jid = `${digits}@c.us`
        const id = audienceContactId(jid)
        if (!normalized.has(id)) normalized.set(id, {
          id, jid, tail: digits.slice(-4), name: bounded(item.name, 120),
        })
      }
      const rows = [...normalized.values()]
      const knownSnapshots = await getAudienceContactsByIds(db, rows.map((row) => row.id))
      const knownIds = new Set(knownSnapshots.map((row) => row.id))
      const newcomers = []
      let batch = db.batch()
      let writes = 0
      const commit = async () => {
        if (!writes) return
        await batch.commit()
        batch = db.batch()
        writes = 0
      }
      for (const row of rows) {
        const isKnown = knownIds.has(row.id)
        const ref = db.collection(COLLECTIONS.audienceContacts).doc(row.id)
        batch.set(ref, {
          id: row.id,
          jid: row.jid,
          tail: row.tail,
          ...(row.name ? { displayName: row.name } : {}),
          source: isKnown ? 'import-refresh' : 'import',
          updatedAt: asIso(),
          ...(!isKnown ? { createdAt: asIso() } : {}),
        }, { merge: true })
        writes += 1
        if (!isKnown) newcomers.push({ id: row.id, name: row.name || `••${row.tail}`, tail: row.tail })
        if (body.listId) {
          const memberId = `${bounded(body.listId, 100)}:${row.id}`
          batch.set(db.collection(COLLECTIONS.audienceMembers).doc(memberId), {
            id: memberId, listId: bounded(body.listId, 100), contactId: row.id, createdAt: asIso(),
          }, { merge: true })
          writes += 1
        }
        if (writes >= 390) await commit()
      }
      await commit()
      sendJson(res, 200, {
        ok: true,
        added: newcomers.length,
        known: rows.length - newcomers.length,
        skipped,
        newcomers: newcomers.slice(0, 60),
      })
      return
    }

    if (path === '/audience/nickname' && method === 'POST') {
      const body = await readJson(req)
      const id = bounded(body.contactId, 100)
      if (!id) {
        sendJson(res, 400, { error: 'جهة الاتصال مطلوبة.' })
        return
      }
      await db.collection(COLLECTIONS.audienceContacts).doc(id).set({
        nickname: bounded(body.nickname, 120) || null,
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/audience/lists' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.audienceLists).limit(500).get()
      const lists = snapshot.docs.map(serializeDoc).filter(Boolean)
        .map((list) => ({
          id: list.id,
          name: bounded(list.name, 120) || 'قائمة بلا اسم',
          note: bounded(list.note, 300),
          kind: bounded(list.kind, 40) || 'manual',
          count: Number(list.count || 0),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      sendJson(res, 200, { lists })
      return
    }

    if (path === '/audience/lists' && method === 'POST') {
      const body = await readJson(req)
      if (body.action === 'delete') {
        const id = bounded(body.id, 100)
        const members = await db.collection(COLLECTIONS.audienceMembers).where('listId', '==', id).limit(5_000).get()
        let batch = db.batch()
        let writes = 0
        for (const member of members.docs) {
          batch.delete(member.ref)
          writes += 1
          if (writes >= 400) {
            await batch.commit()
            batch = db.batch()
            writes = 0
          }
        }
        batch.delete(db.collection(COLLECTIONS.audienceLists).doc(id))
        await batch.commit()
        sendJson(res, 200, { ok: true })
        return
      }
      const name = bounded(body.name, 120)
      if (!name) {
        sendJson(res, 400, { error: 'اسم القائمة مطلوب.' })
        return
      }
      const id = body.action === 'rename' ? bounded(body.id, 100) : randomUUID()
      await db.collection(COLLECTIONS.audienceLists).doc(id).set({
        id,
        name,
        note: bounded(body.note, 300),
        kind: 'manual',
        ...(body.action === 'rename' ? {} : { count: 0, createdAt: asIso() }),
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true, id })
      return
    }

    if (path === '/audience/members' && method === 'GET') {
      const members = await listAudienceMembers(db, url.searchParams.get('list') || '')
      sendJson(res, 200, {
        members: members.map((contact) => ({
          id: contact.id,
          name: audienceDisplayName(contact),
          vocative: audienceVocative(contact),
          nickname: bounded(contact.nickname, 120),
          tail: bounded(contact.tail, 4),
          suppressed: Boolean(contact.suppressed),
        })),
      })
      return
    }

    if (path === '/audience/members' && method === 'POST') {
      const body = await readJson(req)
      const listId = bounded(body.listId, 100)
      if (!listId) {
        sendJson(res, 400, { error: 'القائمة مطلوبة.' })
        return
      }
      if (body.action === 'remove') {
        const contactId = bounded(body.contactId, 100)
        await db.collection(COLLECTIONS.audienceMembers).doc(`${listId}:${contactId}`).delete()
      } else {
        const contactIds = [...new Set((Array.isArray(body.contactIds) ? body.contactIds : [])
          .map((id) => bounded(id, 100)).filter(Boolean))].slice(0, 5_000)
        let batch = db.batch()
        let writes = 0
        for (const contactId of contactIds) {
          const memberId = `${listId}:${contactId}`
          batch.set(db.collection(COLLECTIONS.audienceMembers).doc(memberId), {
            id: memberId, listId, contactId, createdAt: asIso(),
          }, { merge: true })
          writes += 1
          if (writes >= 400) {
            await batch.commit()
            batch = db.batch()
            writes = 0
          }
        }
        if (writes) await batch.commit()
      }
      const countSnapshot = await db.collection(COLLECTIONS.audienceMembers).where('listId', '==', listId).count().get()
      const count = Number(countSnapshot.data()?.count || 0)
      await db.collection(COLLECTIONS.audienceLists).doc(listId).set({ count, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, count })
      return
    }

    if (path === '/audience/preview' && method === 'POST') {
      const body = await readJson(req)
      const members = await listAudienceMembers(db, bounded(body.listId, 100))
      const send = members.filter((contact) => !contact.suppressed)
      sendJson(res, 200, {
        samples: send.slice(0, 3).map((contact) => ({
          name: audienceDisplayName(contact),
          body: personalizeAudienceText(body.text, contact),
        })),
        willSend: send.length,
        suppressed: members.length - send.length,
      })
      return
    }

    if (path === '/send-self-preview' && method === 'POST') {
      const body = await readJson(req)
      const text = bounded(body.message || body.text, 4_000)
      if (!text) {
        sendJson(res, 400, { error: 'نص المعاينة مطلوب.' })
        return
      }
      const command = await enqueueCommand(db, 'send-self-message', { text })
      sendJson(res, 200, { ok: true, queued: true, messageId: command.id })
      return
    }
    if (path === '/emergency-stop' && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true) {
        sendJson(res, 400, { error: 'يلزم تأكيد إيقاف الإرسال.' })
        return
      }
      const result = await stopAllSending(db)
      sendJson(res, 200, {
        ok: true,
        ...result,
      })
      return
    }
    const commandStatus = /^\/commands\/([^/]+)$/.exec(path)
    if (commandStatus && method === 'GET') {
      const id = bounded(decodeURIComponent(commandStatus[1]), 80)
      const snapshot = await db.collection(COLLECTIONS.commands).doc(id).get()
      if (!snapshot.exists) {
        sendJson(res, 404, { error: 'أمر الإرسال غير موجود.' })
        return
      }
      const command = snapshot.data() || {}
      sendJson(res, 200, {
        id,
        type: bounded(command.type, 80),
        status: bounded(command.status, 40) || 'pending',
        error: bounded(command.error, 300) || null,
        updatedAt: bounded(command.updatedAt, 80) || null,
      })
      return
    }

    if (path === '/audience/draft' && method === 'POST') {
      const body = await readJson(req)
      const listId = bounded(body.listId, 100)
      const message = bounded(body.message, 4_000)
      if (!listId || !message) {
        sendJson(res, 400, { error: 'القائمة والرسالة مطلوبتان.' })
        return
      }
      const list = await db.collection(COLLECTIONS.audienceLists).doc(listId).get()
      if (!list.exists) {
        sendJson(res, 404, { error: 'القائمة غير موجودة.' })
        return
      }
      const members = await listAudienceMembers(db, listId)
      const seenRecipients = new Set()
      const targetIds = members.filter((contact) => {
        if (contact.suppressed) return false
        const fingerprint = outboundRecipientFingerprint(contact.jid)
        if (!fingerprint || seenRecipients.has(fingerprint)) return false
        seenRecipients.add(fingerprint)
        return true
      }).map((contact) => contact.id)
      const id = randomUUID()
      await db.collection(COLLECTIONS.campaigns).doc(id).set({
        id,
        listId,
        name: bounded(body.name, 180) || bounded(list.data()?.name, 120) || 'بث واتساب',
        message,
        targetIds,
        total: targetIds.length,
        sent: 0,
        failed: 0,
        cursor: 0,
        state: 'draft',
        createdAt: asIso(),
        updatedAt: asIso(),
      })
      sendJson(res, 200, { id, state: 'draft', total: targetIds.length })
      return
    }

    if (path === '/campaigns' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.campaigns).limit(100).get()
      const campaigns = snapshot.docs
        .map((doc) => campaignPublicState(doc))
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      sendJson(res, 200, { campaigns })
      return
    }

    const campaignDetail = /^\/campaigns\/([^/]+)$/.exec(path)
    if (campaignDetail && method === 'GET') {
      const id = bounded(decodeURIComponent(campaignDetail[1]), 100)
      const snapshot = await db.collection(COLLECTIONS.campaigns).doc(id).get()
      if (!snapshot.exists) {
        sendJson(res, 404, { error: 'الحملة غير موجودة.' })
        return
      }
      const commands = await db.collection(COLLECTIONS.commands).where('campaignId', '==', id).limit(5000).get()
      const failures = commands.docs.map(serializeDoc)
        .filter((item) => item?.status === 'failed' && Number.isFinite(Number(item.campaignIndex)))
        .sort((left, right) => Number(left.campaignIndex) - Number(right.campaignIndex))
        .map((item) => ({
          index: Number(item.campaignIndex),
          recipient: `الجهة ${Number(item.campaignIndex) + 1}`,
          reason: bounded(item.error, 240) || 'تعذّر التسليم من واتساب.',
        }))
      sendJson(res, 200, { ...campaignPublicState(snapshot), failures })
      return
    }

    const campaignPause = /^\/campaigns\/([^/]+)\/pause$/.exec(path)
    if (campaignPause && method === 'POST') {
      const id = bounded(decodeURIComponent(campaignPause[1]), 100)
      const ref = db.collection(COLLECTIONS.campaigns).doc(id)
      const snapshot = await ref.get()
      if (!snapshot.exists) {
        sendJson(res, 404, { error: 'الحملة غير موجودة.' })
        return
      }
      const campaign = snapshot.data() || {}
      if (!['sending', 'retrying', 'approved'].includes(campaign.state)) {
        sendJson(res, 409, { error: 'هذه الحملة ليست في حالة إرسال قابلة للإيقاف المؤقت.' })
        return
      }
      const commands = await db.collection(COLLECTIONS.commands).where('campaignId', '==', id).limit(5000).get()
      const pending = commands.docs.filter((doc) => (doc.data() || {}).status === 'pending')
      let batch = db.batch()
      let writes = 0
      for (const doc of pending) {
        batch.set(doc.ref, { status: 'held', heldAt: asIso(), updatedAt: asIso() }, { merge: true })
        writes += 1
        if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0 }
      }
      if (writes) await batch.commit()
      await ref.set({ state: 'paused', pausedFromState: campaign.state, pausedAt: asIso(), nextAt: null, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { id, state: 'paused' })
      return
    }

    const campaignResume = /^\/campaigns\/([^/]+)\/resume$/.exec(path)
    if (campaignResume && method === 'POST') {
      const id = bounded(decodeURIComponent(campaignResume[1]), 100)
      const ref = db.collection(COLLECTIONS.campaigns).doc(id)
      const snapshot = await ref.get()
      if (!snapshot.exists || snapshot.data()?.state !== 'paused') {
        sendJson(res, 409, { error: 'الحملة ليست متوقفة مؤقتاً.' })
        return
      }
      const campaign = snapshot.data() || {}
      const previous = campaign.pausedFromState === 'retrying' ? 'retrying' : 'sending'
      const commands = await db.collection(COLLECTIONS.commands).where('campaignId', '==', id).limit(5000).get()
      const held = commands.docs.filter((doc) => (doc.data() || {}).status === 'held')
      const intervalMs = Math.max(20_000, Math.min(15 * 60_000, Number(campaign.intervalSeconds || 45) * 1_000))
      let batch = db.batch()
      let writes = 0
      for (let index = 0; index < held.length; index += 1) {
        const doc = held[index]
        batch.set(doc.ref, { status: 'pending', heldAt: null, availableAt: asIso(Date.now() + index * intervalMs), updatedAt: asIso() }, { merge: true })
        writes += 1
        if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0 }
      }
      if (writes) await batch.commit()
      await ref.set({ state: previous, resumedAt: asIso(), nextAt: held.length ? asIso() : null, updatedAt: asIso() }, { merge: true })
      if (previous === 'sending' && !campaign.pendingCommandId) await queueNextCampaignMessage(db, id, 0)
      sendJson(res, 200, { id, state: previous })
      return
    }

    const campaignRetryFailed = /^\/campaigns\/([^/]+)\/retry-failed$/.exec(path)
    if (campaignRetryFailed && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true) {
        sendJson(res, 400, { error: 'يلزم تأكيد إعادة محاولة الفاشل فقط.' })
        return
      }
      const id = bounded(decodeURIComponent(campaignRetryFailed[1]), 100)
      const ref = db.collection(COLLECTIONS.campaigns).doc(id)
      const snapshot = await ref.get()
      if (!snapshot.exists) {
        sendJson(res, 404, { error: 'الحملة غير موجودة.' })
        return
      }
      const campaign = snapshot.data() || {}
      if (['sending', 'retrying', 'paused'].includes(campaign.state)) {
        sendJson(res, 409, { error: 'أوقف الحملة أو انتظر اكتمال الإرسال الحالي أولاً.' })
        return
      }
      const commands = await db.collection(COLLECTIONS.commands).where('campaignId', '==', id).limit(5000).get()
      const failed = commands.docs.filter((doc) => {
        const item = doc.data() || {}
        return item.status === 'failed' && Number.isFinite(Number(item.campaignIndex))
      }).sort((left, right) => Number(left.data()?.campaignIndex || 0) - Number(right.data()?.campaignIndex || 0))
      if (!failed.length) {
        sendJson(res, 409, { error: 'لا توجد رسائل فاشلة لإعادة المحاولة.' })
        return
      }
      const intervalSeconds = Math.max(20, Math.min(15 * 60, Number(campaign.intervalSeconds || body.intervalSeconds || 45)))
      const intervalMs = intervalSeconds * 1000
      let batch = db.batch()
      let writes = 0
      for (let index = 0; index < failed.length; index += 1) {
        const doc = failed[index]
        batch.set(doc.ref, {
          status: 'pending', attempts: 0, retryFailure: true, accountingVersion: 2, leasedAt: null, completedAt: null,
          campaignAccountedAt: null, campaignAccountingError: null, legacyAccountingSkippedAt: null, deliveryVerification: null,
          deliveryMessageId: null, deliveryRecipientFingerprint: null, deliveredAt: null,
          error: null, availableAt: asIso(Date.now() + index * intervalMs), updatedAt: asIso(),
        }, { merge: true })
        writes += 1
        if (writes >= 400) { await batch.commit(); batch = db.batch(); writes = 0 }
      }
      if (writes) await batch.commit()
      await ref.set({
        state: 'retrying', intervalSeconds, retryStartedAt: asIso(), nextAt: asIso(), lastError: null, updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 202, { id, state: 'retrying', retrying: failed.length })
      return
    }

    const campaignApprove = /^\/campaigns\/([^/]+)\/approve$/.exec(path)
    if (campaignApprove && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true) {
        sendJson(res, 400, { error: 'التأكيد مطلوب.' })
        return
      }
      const id = decodeURIComponent(campaignApprove[1])
      await db.collection(COLLECTIONS.campaigns).doc(id).set({
        state: 'approved', approvedAt: asIso(), updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { id, state: 'approved' })
      return
    }

    const campaignSend = /^\/campaigns\/([^/]+)\/send-quiet$/.exec(path)
    if (campaignSend && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true || body.confirmAgain !== true) {
        sendJson(res, 400, { error: 'يلزم التأكيد مرتين قبل البث.' })
        return
      }
      const id = decodeURIComponent(campaignSend[1])
      const ref = db.collection(COLLECTIONS.campaigns).doc(id)
      const snapshot = await ref.get()
      if (!snapshot.exists || !['approved', 'paused'].includes(snapshot.data()?.state)) {
        sendJson(res, 409, { error: 'المسودة غير معتمدة أو بدأ إرسالها بالفعل.' })
        return
      }
      const intervalSeconds = Math.max(20, Math.min(15 * 60, Number(body.intervalSeconds || 45)))
      await ref.set({
        state: 'sending',
        intervalSeconds,
        startedAt: snapshot.data()?.startedAt || asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      const command = await queueNextCampaignMessage(db, id, 0)
      sendJson(res, 202, { id, state: command ? 'sending' : 'completed', total: Number(snapshot.data()?.total || 0) })
      return
    }

    if (path === '/simulate-sequence' && method === 'POST') {
      const body = await readJson(req)
      const messages = Array.isArray(body.messages)
        ? body.messages.slice(0, 8).map((message) => bounded(message, 2_000)).filter(Boolean)
        : []
      if (messages.length < 2) {
        sendJson(res, 400, { error: 'يلزم سؤالان متتاليان على الأقل.' })
        return
      }
      const rules = await listRules(db)
      let conversation = {}
      const turns = messages.map((text, index) => {
        const startedAt = Date.now()
        const decision = decideGroundedResponse({ text, rules, conversation })
        const preview = bounded(decision.reply, 2_000)
        conversation = {
          ...conversation,
          mode: 'bot',
          wakeActive: true,
          lastInboundAt: asIso(),
          lastReplyAt: asIso(),
          lastReplyHash: hash(preview),
          lastDecisionReason: decision.reason,
          ...(Array.isArray(decision.contextItemIds) ? { contextItemIds: decision.contextItemIds.slice(0, 12) } : {}),
          ...(Number.isInteger(decision.contextIndex) ? { contextIndex: decision.contextIndex } : {}),
          ...(decision.lastTopic ? { lastTopic: bounded(decision.lastTopic, 500) } : {}),
          ...(Array.isArray(decision.evidence) ? { seenContentIds: [...new Set([...(conversation.seenContentIds || []), ...decision.evidence])].slice(-40) } : {}),
        }
        return {
          turn: index + 1,
          text,
          willReply: decision.kind !== 'silent' && Boolean(preview),
          action: decision.kind === 'escalate' ? 'reply-and-escalate' : 'reply',
          reason: decision.reason,
          durationMs: Date.now() - startedAt,
          preview,
        }
      })
      sendJson(res, 200, {
        ok: turns.every((turn) => turn.willReply),
        continuous: turns.every((turn) => turn.willReply),
        sentToWhatsApp: false,
        policy: 'كل رسالة جديدة في الوضع الطبيعي تحصل على رد؛ لا تتوقف المحادثة إلا بعد رد يدوي من المالك.',
        turns,
      })
      return
    }

    if (path === '/simulate' && method === 'POST') {
      const body = await readJson(req)
      const rules = await listRules(db)
      const decision = decideGroundedResponse({ text: body.text, rules })
      sendJson(res, 200, {
        willReply: true,
        why: decision.reason,
        quietNow: false,
        intent: decision.reason,
        mode: decision.kind === 'escalate' ? 'human' : 'bot',
        confidence: decision.kind === 'escalate' ? 0 : 1,
        needsHuman: decision.kind === 'escalate',
        ruleId: decision.rule?.id || null,
        ruleName: decision.rule?.name || null,
        preview: decision.reply,
      })
      return
    }
    if (path === '/personality' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.settings).doc('personality').get()
      sendJson(res, 200, snapshot.exists ? snapshot.data() || {} : {
        verbosity: 'layered',
        dialect: 'kuwaiti-light',
        initiative: 'guided',
        signature: 'always',
        memoryConsent: 'explicit',
      })
      return
    }
    if (path === '/personality' && method === 'POST') {
      const body = await readJson(req)
      const personality = {
        verbosity: ['brief', 'layered', 'detailed'].includes(body.verbosity) ? body.verbosity : 'layered',
        dialect: ['formal-arabic', 'kuwaiti-light', 'neutral-arabic'].includes(body.dialect) ? body.dialect : 'kuwaiti-light',
        initiative: ['none', 'one-question', 'guided'].includes(body.initiative) ? body.initiative : 'guided',
        signature: 'always',
        memoryConsent: 'explicit',
        updatedAt: asIso(),
      }
      await db.collection(COLLECTIONS.settings).doc('personality').set(personality, { merge: true })
      sendJson(res, 200, personality)
      return
    }

    if (path === '/learning' && method === 'GET') {
      /* الذاكرة الحيّة تعرض الصياغات المرصودة فعلاً (ما لم يُفهم بثقة) —
         كانت اللوحة تقرأ أصفاراً لأن العقل المركزي لم يكن يرصد شيئاً. */
      const [rules, observedSnapshot] = await Promise.all([
        listRules(db),
        db.collection(COLLECTIONS.learning).orderBy('lastSeenAt', 'desc').limit(120).get().catch(() => ({ docs: [] })),
      ])
      const observed = observedSnapshot.docs.map(serializeDoc).filter(Boolean)
      const observing = observed.filter((row) => row.status === 'observing')
      const ignored = observed.filter((row) => row.status === 'ignored')
      sendJson(res, 200, {
        total: LEXICON_SIZE + rules.length + observed.length,
        learned: LEXICON_SIZE,
        observing: observing.length,
        ignored: ignored.length,
        policy: 'القاموس الكويتي والمصطلحات المعتمدة مفعّلة في الفهم الدلالي. الصياغات غير المفهومة تُرصد هنا للمراقبة فقط، ولا يتعلم البوت منها قاعدة أو جواباً بلا اعتمادك الصريح.',
        items: [
          ...observed.slice(0, 80).map((row) => ({
            id: String(row.id),
            phrase: bounded(row.phrase, 160),
            status: row.status === 'ignored' ? 'ignored' : 'observing',
            kind: 'observed-phrase',
            hits: Number(row.hits || 1),
            lastSeenAt: row.lastSeenAt || null,
          })),
          ...rules.slice(0, 40).map((rule) => ({
            id: String(rule.id),
            phrase: rule.name,
            status: rule.enabled === false ? 'ignored' : 'learned',
            kind: 'approved-rule',
          })),
        ],
      })
      return
    }
    {
      const learningAction = path.match(/^\/learning\/([A-Za-z0-9_-]{4,64})\/(observing|ignored)$/)
      if (learningAction && method === 'POST') {
        await db.collection(COLLECTIONS.learning).doc(learningAction[1])
          .set({ status: learningAction[2], updatedAt: asIso() }, { merge: true })
        return handleAdmin(req, res, new URL('/api/whatsapp/admin/learning', 'http://localhost'), 'GET')
      }
    }
    if (path === '/knowledge' && method === 'GET') {
      const index = siteIndex()
      const [conversationSnapshot, eventSnapshot, personalitySnapshot] = await Promise.all([
        db.collection(COLLECTIONS.conversations).limit(1000).get(),
        db.collection(COLLECTIONS.events).limit(1000).get(),
        db.collection(COLLECTIONS.settings).doc('personality').get(),
      ])
      const conversations = conversationSnapshot.docs.map(serializeDoc).filter(Boolean)
      const events = eventSnapshot.docs.map(serializeDoc).filter(Boolean)
      const active = conversations.filter((row) => row.wakeActive === true || row.needsHuman === true || row.mode === 'human').length
      const human = conversations.filter((row) => row.mode === 'human' || row.needsHuman === true).length
      const intentRows = aggregateCounts(conversations, (row) => bounded(row.lastDecisionReason || row.escalationReason, 180), decisionLabel)
      const answerRows = aggregateCounts(conversations.filter((row) => row.lastReplyAt), (row) => bounded(row.lastDecisionReason || 'reply', 180), decisionLabel)
      const gapRows = aggregateCounts(events.filter((row) => row.status === 'open'), (row) => bounded(row.reason, 180), decisionLabel)
      sendJson(res, 200, {
        modes: [
          { id: 'site-only', label: 'الموقع فقط', boundary: 'لا إجابة بلا رابط أو قاعدة معتمدة.' },
          { id: 'human', label: 'تصعيد بشري', boundary: 'الصورة والملف والسؤال غير الموثق تتحول للبشر.' },
        ],
        sourcePolicies: { site: ['المقالات', 'الكتب', 'الأبحاث', 'المواد المنشورة'], customRules: ['قواعد تعتمدها من اللوحة'] },
        evidence: { total: index.length, enabled: index.length, lastUpdatedAt: asIso(), domains: [{ domain: new URL(SITE_URL).hostname, total: index.length, enabled: index.length }] },
        conversations: {
          active,
          human,
          intents: intentRows.slice(0, 20).map((item) => ({ intent: item.label, total: item.total })),
          gaps: gapRows.slice(0, 20).map((item) => ({ topic: item.label, reason: item.label, total: item.total })),
          answers: answerRows.slice(0, 20).map((item) => ({ intent: item.label, total: item.total })),
        },
        personality: personalitySnapshot.exists ? personalitySnapshot.data() || {} : { verbosity: 'layered', dialect: 'kuwaiti-light', initiative: 'guided', signature: 'always', memoryConsent: 'explicit' },
        privacy: 'هذه المؤشرات مجاميع فعلية من سجلات التشغيل الحالية فقط؛ لا تعرض نصوص الناس أو أرقامهم، ولا يتعلم البوت من كلامهم تلقائياً.',
      })
      return
    }
    if (path.startsWith('/trusted-evidence') && method === 'GET') {
      sendJson(res, 200, [])
      return
    }

    sendJson(res, 404, { error: 'WhatsApp admin endpoint not found' })
  }

  return async function handleWhatsAppRequest(req, res, url, method = req.method || 'GET') {
    try {
      if (url.pathname.startsWith('/api/whatsapp/')) {
        const path = bridgePath(url)
        if (path === '/webhook' && method === 'POST') await handleWebhook(req, res)
        else if (path === '/commands' || path === '/emergency-stop' || path === '/runtime-resume') await handleBridgeCommand(req, res, url, method)
        else sendJson(res, 404, { error: 'WhatsApp bridge endpoint not found' })
        return true
      }
      if (url.pathname.startsWith('/api/admin/whatsapp')) {
        await handleAdmin(req, res, url, method)
        return true
      }
      return false
    } catch (error) {
      sendJson(res, Number(error?.status || 500), {
        error: Number(error?.status || 500) >= 500 ? 'WhatsApp service error' : bounded(error?.message, 300),
      })
      return true
    }
  }
}

export const whatsappPolicy = Object.freeze({
  siteUrl: SITE_URL,
  /* قاعدة الدكتور المطلقة (كارثة ٣٠ يوليو: البوت ردّ على بثٍّ إعلاني لمدرسة):
     لا ردّ على أي رسالة إطلاقاً إلا داخل جلسةٍ فتحها صاحبها بكتابة جملة
     الإيقاظ بنفسه. wakeEpoch=2 يُبطل كل الجلسات التي فتحها وضع «دائم
     التفاعل» القديم دون كتابة الجملة. */
  defaultReplyMode: 'wake-phrase-only',
  wakeEpoch: 2,
  manualTakeoverMinutes: null,
  manualTakeoverAutoResume: false,
  resumeMode: 'manual-takeover-wake-only',
  zeroHallucination: true,
  paidAiApis: false,
})
