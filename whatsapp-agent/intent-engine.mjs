import { contentSummary, findContent, latestContent, normalizeArabic, searchContent } from './content-index.mjs'
import { AUTO_REPLY_ALLOWLIST, AUTO_REPLY_TRIGGERS, MANUAL_TAKEOVER_MINUTES, MAX_MESSAGE_CHARS, TIME_ZONE, flags } from './config.mjs'
import { hashOpaque } from './crypto.mjs'
import { createReminder, parseReminderTime } from './reminders.mjs'

export const INTENTS = Object.freeze({
  LATEST_CONTENT: 'LATEST_CONTENT', LATEST_ARTICLE: 'LATEST_ARTICLE', LATEST_BOOK: 'LATEST_BOOK', LATEST_SELECTION: 'LATEST_SELECTION', LATEST_PODCAST: 'LATEST_PODCAST', MISSED_CONTENT: 'MISSED_CONTENT', SURPRISE_ME: 'SURPRISE_ME', ONE_MINUTE: 'ONE_MINUTE', SUMMARY: 'SUMMARY', SEARCH_TOPIC: 'SEARCH_TOPIC', SIMILAR_CONTENT: 'SIMILAR_CONTENT', READ_ARTICLE: 'READ_ARTICLE', LISTEN_FAHED: 'LISTEN_FAHED', LISTEN_NOURA: 'LISTEN_NOURA', LISTEN_DIALOGUE: 'LISTEN_DIALOGUE', SHOW_OPTIONS: 'SHOW_OPTIONS', HELP: 'HELP', CONTENT_BY_MOOD: 'CONTENT_BY_MOOD', QUOTE: 'QUOTE', QUOTE_CARD: 'QUOTE_CARD', REMIND_ME: 'REMIND_ME', CONTINUE_LISTENING: 'CONTINUE_LISTENING', WEEKLY_DIGEST: 'WEEKLY_DIGEST', STOP_MESSAGES: 'STOP_MESSAGES', RESUME_MESSAGES: 'RESUME_MESSAGES', DELETE_PREFERENCES: 'DELETE_PREFERENCES', HUMAN_RESPONSE_REQUIRED: 'HUMAN_RESPONSE_REQUIRED', UNKNOWN: 'UNKNOWN' })

/* ملاحظة واجبة: النص يمرّ على normalizeArabic قبل المطابقة، وهو يحوّل
   ة→ه و أ/إ/آ→ا و ى→ي ويحذف الترقيم. فكل نمطٍ هنا يُكتب بالصورة المطبَّعة،
   وإلا لم يطابق شيئاً أبداً — وهذا ما كان يعطّل «بطاقة اقتباس» و«النشرة
   الأسبوعية» و«أوقف الرسائل» بصمت. */
const patterns = [
  [INTENTS.STOP_MESSAGES, [/^(اوقف|وقف|ايقاف|لا ترسل|ما ابي تنبيهات|شيلني من القائمه|الغاء الاشتراك)/, 0.99]],
  [INTENTS.RESUME_MESSAGES, [/^(رجع الرسائل|فعل الجديد|اشترك مره ثانيه|ابي ارجع)/, 0.99]],
  [INTENTS.DELETE_PREFERENCES, [/(انس تفضيلاتي|امسح اللي تعرفه عني|احذف تفضيلاتي)/, 0.98]],
  [INTENTS.LATEST_ARTICLE, [/(اخر|احدث).*(مقال|مقاله)|مقاله جديده|شنو كتبت/, 0.95]],
  [INTENTS.LATEST_BOOK, [/(اخر|احدث|جديد)\s*\S*\s*(كتاب|الكتب)/, 0.94]],
  [INTENTS.LATEST_SELECTION, [/(اخر|احدث|جديد)\s*\S*\s*(مختارات)/, 0.94]],
  [INTENTS.LATEST_PODCAST, [/(اخر|احدث).*(بودكاست|حلقه)|اخر بودكاست/, 0.96]],
  [INTENTS.MISSED_CONTENT, [/(شنو|ماذا).*(فاتني|فات)/, 0.96], [/(من زمان ما تابعت|ما تابعت من زمان)/, 0.94]],
  [INTENTS.SURPRISE_ME, [/(فاجيني|اختر لي|اختار لي|على ذوقك|شيء من عندك)/, 0.94]],
  [INTENTS.ONE_MINUTE, [/(عندي دقيقه|ما عندي وقت|الزبده|ملخص سريع|اختصرها|الفكره بس)/, 0.96]],
  [INTENTS.SUMMARY, [/(لخص|ملخص|نبذه|الخلاصه)/, 0.84]],
  /* «فهد» و«نورة» و«حوار» و«كمّل» كلامٌ كويتيٌّ يوميّ وأسماءُ ناس — لا تكفي
     وحدها أبداً، وإلا ردّ البوت على صديقٍ يسأل عن فهد. تطلب الآن طلباً صريحاً. */
  [INTENTS.LISTEN_DIALOGUE, [/(استمع|شغل|سمعني|بصوت)\s*\S*\s*(الحوار|حوار)|^الحوار$/, 0.92]],
  [INTENTS.LISTEN_FAHED, [/(بصوت فهد|قراءه فهد|صوت الرجل)/, 0.95]],
  [INTENTS.LISTEN_NOURA, [/(بصوت نوره|بصوت نورا|قراءه نوره|صوت المراه)/, 0.95]],
  [INTENTS.QUOTE_CARD, [/(بطاقه اقتباس|صوره اقتباس)/, 0.92]],
  [INTENTS.QUOTE, [/(اقتباس|جمله جميله|عطني اقتباس)/, 0.90]],
  [INTENTS.CONTINUE_LISTENING, [/(من وين وقفت|تابع الاستماع|كمل الاستماع|كمل القراءه)/, 0.90]],
  [INTENTS.HELP, [/(شنو تقدر|الخيارات|مساعده|شلون استخدم|الاوامر|القائمه)/, 0.98]],
  [INTENTS.REMIND_ME, [/(ذكرني|تذكير)/, 0.90]],
  [INTENTS.WEEKLY_DIGEST, [/(ملخص اسبوعي|النشره الاسبوعيه|نشره اسبوعيه)/, 0.94]],
  [INTENTS.HUMAN_RESPONSE_REQUIRED, [/(رايك|ماذا تري|هل تعتقد|ابي رايك)/, 0.82]],
]

const clean = (text) => normalizeArabic(String(text || '').slice(0, MAX_MESSAGE_CHARS))
const compactPhone = (value = '') => String(value).replace(/[^\d]/g, '')
const jidAccount = (jid = '') => String(jid).split('@')[0].toLowerCase()

function isAllowlisted(jid = '') {
  if (!AUTO_REPLY_ALLOWLIST.length) return false
  const account = jidAccount(jid)
  const digits = compactPhone(account)
  return AUTO_REPLY_ALLOWLIST.some((item) => item === account || compactPhone(item) === digits)
}

function hasAssistantTrigger(text = '') {
  const raw = String(text || '').trim()
  const normalized = clean(raw)
  return AUTO_REPLY_TRIGGERS.some((trigger) => {
    const value = clean(trigger)
    if (!value) return false
    return normalized.startsWith(value) || normalized.includes(` ${value}`)
  })
}

export function classifyIntent(text) {
  const value = clean(text)
  for (const [intent, ...rules] of patterns) {
    for (const [regex, confidence] of rules) if (regex.test(value)) return { intent, confidence, normalized: value }
  }
  if (value.length >= 3) return { intent: INTENTS.SEARCH_TOPIC, confidence: 0.72, normalized: value }
  return { intent: INTENTS.UNKNOWN, confidence: 0.2, normalized: value }
}

function safeJsonParse(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function normalizeKeyword(value) {
  return clean(value).replace(/\s+/g, ' ').trim()
}

function rowToRule(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    keywords: safeJsonParse(row.keywords_json, []),
    priority: Number(row.priority || 0),
    matchType: row.match_type || 'any',
    actionType: row.action_type || 'text',
    responseText: row.response_text || '',
    contentQuery: row.content_query || '',
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listReplyRules(db, { includeDisabled = true } = {}) {
  const where = includeDisabled ? '' : 'WHERE enabled=1'
  return db.all(`SELECT * FROM reply_rules ${where} ORDER BY enabled DESC, priority DESC, updated_at DESC`).map(rowToRule)
}

export function matchReplyRule(db, text) {
  const value = normalizeKeyword(text)
  if (!value) return null
  const rules = listReplyRules(db, { includeDisabled: false })
  for (const rule of rules) {
    const keywords = rule.keywords.map(normalizeKeyword).filter(Boolean)
    if (!keywords.length) continue
    const matched = rule.matchType === 'exact'
      ? keywords.some((keyword) => value === keyword)
      : rule.matchType === 'all'
        ? keywords.every((keyword) => value.includes(keyword))
        : keywords.some((keyword) => value.includes(keyword))
    if (matched) return { ...rule, matchedKeywords: keywords.filter((keyword) => value.includes(keyword) || value === keyword) }
  }
  return null
}

function customRuleReply(db, rule, input) {
  if (!rule) return null
  if (rule.actionType === 'transfer') {
    return { intent: 'CUSTOM_RULE', confidence: 0.99, needsHuman: true, ruleId: rule.id, ruleName: rule.name, text: rule.responseText || 'وصلت رسالتك. سأتركها للدكتور/الموظف حتى لا أعطيك جوابًا غير دقيق.' }
  }
  if (rule.actionType === 'site-content') {
    const query = rule.contentQuery || input
    const results = searchContent(db, query, { limit: 2 })
    if (!results.length) return { intent: 'CUSTOM_RULE', confidence: 0.72, needsHuman: true, ruleId: rule.id, ruleName: rule.name, text: 'لم أجد في محتوى الموقع ما يجيب بدقة. سأحوّلها لمراجعة بشرية.' }
    return { intent: 'CUSTOM_RULE', confidence: 0.94, ruleId: rule.id, ruleName: rule.name, text: `${rule.responseText ? `${rule.responseText}\n\n` : ''}${results.map((item, index) => `${index + 1}. ${item.title}\n${contentSummary(item, 1)}\n${item.url}`).join('\n\n')}`, contentId: results[0].id }
  }
  return { intent: 'CUSTOM_RULE', confidence: 0.99, ruleId: rule.id, ruleName: rule.name, text: rule.responseText || 'تم.' }
}

const itemLink = (item) => item ? `\n${item.title}\n${item.url}` : ''
const audioLinks = (item) => {
  if (!item?.audio) return []
  const links = []
  const base = item.url.replace(/\/articles\/[^/]+$/, '/audio')
  if (item.audio.fahed) links.push(`فهد: ${base}/${item.slug}.mp3`)
  if (item.audio.noura) links.push(`نورة: ${base}/${item.slug}.noura.mp3`)
  if (item.audio.dialogue) links.push(`الحوار: ${base}/${item.slug}.dialogue.mp3`)
  return links
}

function contentReply(label, item, extra = '') {
  if (!item) return { text: 'ما لقيت مادة منشورة مطابقة الآن. اكتب لي الموضوع أو النوع الذي تريده، وأبحث لك من جديد.' }
  return { text: `${label}:\n${item.title}${item.date ? ` · ${item.date}` : ''}\n${item.excerpt || contentSummary(item, 1)}\n${item.url}${extra}`, contentId: item.id, actions: audioLinks(item) }
}

function latestOf(db, kind, label) { return contentReply(label, latestContent(db, kind, 1)[0]) }

function pendingSession(db, jid) { return jid ? db.get('SELECT * FROM chat_sessions WHERE jid=?', db.jidKey(jid)) : null }

function savePreference(db, jid, patch) {
  if (!jid) return
  const key = db.jidKey(jid); const currentRow = db.get('SELECT payload FROM user_preferences WHERE jid=?', key); let current = {}
  try { current = currentRow ? JSON.parse(currentRow.payload) : {} } catch { current = {} }
  db.run('INSERT INTO user_preferences(jid,payload,updated_at) VALUES(?,?,?) ON CONFLICT(jid) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at', key, JSON.stringify({ ...current, ...patch }), new Date().toISOString())
}

export function isSuppressed(db, jid) { return Boolean(jid && db.get('SELECT suppressed FROM contacts WHERE id=? AND suppressed=1', hashOpaque(jid))) }

export function setSuppression(db, jid, suppressed) {
  if (!jid) return
  const id = hashOpaque(jid); const now = new Date().toISOString();
  db.run('INSERT INTO contacts(id,jid,display_name,phone,suppressed,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET suppressed=excluded.suppressed,updated_at=excluded.updated_at', id, db.encryptJid(jid), null, null, suppressed ? 1 : 0, now, now)
  db.addAudit(suppressed ? 'opt-out' : 'opt-in', id)
}

export function markManualTakeover(db, jid, minutes = MANUAL_TAKEOVER_MINUTES) {
  if (!jid) return
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString(); const now = new Date().toISOString()
  const jidKey = db.jidKey(jid)
  db.run('INSERT INTO chat_sessions(jid,mode,manual_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,manual_until=excluded.manual_until,updated_at=excluded.updated_at', jidKey, 'manual-takeover', until, now)
}

export function clearPreferences(db, jid) {
  if (!jid) return
  db.run('DELETE FROM user_preferences WHERE jid=?', db.jidKey(jid))
  db.addAudit('delete-preferences', hashOpaque(jid))
}

export function handleIntent({ db, jid = '', input, session = pendingSession(db, jid) }) {
  const customRule = matchReplyRule(db, input)
  if (customRule) return customRuleReply(db, customRule, input)
  const classification = classifyIntent(input)
  const { intent, confidence } = classification
  const logId = jid ? hashOpaque(jid) : null
  db.run('INSERT INTO intent_logs(jid,input_hash,intent,confidence,created_at) VALUES(?,?,?,?,?)', logId, hashOpaque(input), intent, confidence, new Date().toISOString())
  if (confidence < 0.7) {
    db.run('INSERT INTO unresolved_messages(jid,input_hash,text_preview,reason,created_at) VALUES(?,?,?,?,?)', logId, hashOpaque(input), db.encryptText(String(input).slice(0, 180)), 'low-confidence', new Date().toISOString())
    return { ...classification, shouldRespond: true, needsHuman: true, text: 'ما فهمت الطلب بدقة. هل تبحث في المقالات، الكتب، الأبحاث، أم البودكاست؟' }
  }

  switch (intent) {
    case INTENTS.STOP_MESSAGES: setSuppression(db, jid, true); return { ...classification, shouldRespond: true, text: 'تم، لن تصلك رسائل محتوى جديدة. إذا رغبت بالعودة اكتب: رجع الرسائل.' }
    case INTENTS.RESUME_MESSAGES: setSuppression(db, jid, false); return { ...classification, shouldRespond: true, text: 'عاد الاشتراك في رسائل المحتوى.' }
    case INTENTS.DELETE_PREFERENCES: clearPreferences(db, jid); return { ...classification, shouldRespond: true, text: 'حذفت تفضيلاتك المحلية. أبقيت فقط ما يلزم لاحترام إيقاف الرسائل إن طلبته.' }
    case INTENTS.LATEST_ARTICLE: return { ...classification, ...latestOf(db, 'article', 'أحدث مقالة') }
    case INTENTS.LATEST_BOOK: return { ...classification, ...latestOf(db, 'book', 'أحدث كتاب') }
    case INTENTS.LATEST_SELECTION: return { ...classification, ...latestOf(db, 'curated', 'أحدث مختارة') }
    case INTENTS.LATEST_PODCAST: return { ...classification, ...latestOf(db, 'podcast', 'أحدث حلقة') }
    case INTENTS.MISSED_CONTENT: {
      const row = jid && db.get('SELECT payload FROM user_preferences WHERE jid=?', db.jidKey(jid)); let cursor = ''
      try { cursor = row ? JSON.parse(row.payload).lastContentCursor || '' : '' } catch { cursor = '' }
      const items = cursor ? db.all('SELECT * FROM content_items WHERE date>? ORDER BY date DESC LIMIT 3', cursor) : latestContent(db, 'article', 3)
      return { ...classification, text: items.length ? `من آخر مرة، ظهر ${items.length} مواد جديدة. أبدأ لك بالأحدث؟\n${items.map((item) => `${item.title}\n${item.url}`).join('\n')}` : 'ما فاتك شيء جديد مسجل عندي حتى الآن.' }
    }
    case INTENTS.SURPRISE_ME: {
      const results = searchContent(db, classification.normalized, { limit: 10 }); const item = results[Math.floor(Math.random() * Math.max(results.length, 1))] || latestContent(db, 'article', 1)[0]
      return { ...classification, ...contentReply('اخترت لك', item, '\nمادة قصيرة من أرشيف الموقع فقط.') }
    }
    case INTENTS.ONE_MINUTE:
    case INTENTS.SUMMARY: {
      const item = session?.content_id ? findContent(db, session.content_id) : latestContent(db, 'article', 1)[0]
      return item ? { ...classification, ...contentReply('الزبدة', item, `\n${contentSummary(item, 3)}`) } : { ...classification, text: 'أرسل عنوان المقالة أو اكتب: آخر مقالة، وأعطيك الزبدة في دقيقة.' }
    }
    case INTENTS.SEARCH_TOPIC:
    case INTENTS.SIMILAR_CONTENT: {
      const results = searchContent(db, classification.normalized, { limit: 3 })
      if (!results.length) return { ...classification, needsHuman: true, text: 'ما لقيت تطابقًا دقيقًا في أرشيف الموقع. اذكر كلمة أخرى أو اختر نوع المادة.' }
      return { ...classification, text: `أقرب المواد لسؤالك:\n${results.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}`, contentId: results[0].id }
    }
    case INTENTS.LISTEN_FAHED:
    case INTENTS.LISTEN_NOURA:
    case INTENTS.LISTEN_DIALOGUE: {
      const item = session?.content_id ? findContent(db, session.content_id) : latestContent(db, 'article', 1)[0]
      const wanted = intent === INTENTS.LISTEN_FAHED ? 'fahed' : intent === INTENTS.LISTEN_NOURA ? 'noura' : 'dialogue'
      if (!item?.audio?.[wanted]) return { ...classification, text: 'هذه النسخة الصوتية غير جاهزة لهذه المادة حاليًا. المتاح فقط ما يظهر في ملف الصوت المنشور.' }
      return { ...classification, text: `${wanted === 'fahed' ? 'قراءة فهد' : wanted === 'noura' ? 'قراءة نورة' : 'الحوار'}:\n${item.title}\n${item.url}`, contentId: item.id, actions: audioLinks(item) }
    }
    case INTENTS.QUOTE:
    case INTENTS.QUOTE_CARD: {
      const item = session?.content_id ? findContent(db, session.content_id) : latestContent(db, 'article', 1)[0]
      const quote = String(item?.body || item?.excerpt || '').split(/(?<=[.!؟])/u).map((part) => part.trim()).find((part) => part.length >= 25 && part.length <= 180) || item?.excerpt
      return item && quote ? { ...classification, text: `«${quote}»\n— ${item.title}\n${item.url}`, contentId: item.id, quote } : { ...classification, text: 'لا أملك اقتباسًا موثقًا مناسبًا بعد.' }
    }
    case INTENTS.HELP: return { ...classification, text: 'أقدر أساعدك في محتوى د. أحمد:\n«شنو فاتني؟» · «فاجئني» · «عندي دقيقة» · «آخر مقالة» · «آخر كتاب» · «آخر بودكاست» · «عندك شيء عن…» · «فهد» · «نورة» · «الحوار».\nاكتب طلبك بطريقتك.' }
    case INTENTS.HUMAN_RESPONSE_REQUIRED: return { ...classification, needsHuman: true, text: 'هذا السؤال يحتاج رد د. أحمد نفسه، لذلك تركته له.' }
    case INTENTS.REMIND_ME: {
      const parsed = parseReminderTime(input)
      if (parsed.ambiguous) return { ...classification, needsHuman: true, text: 'أقدر أذكّرك محليًا، لكن أحتاج وقتًا واضحًا مثل: الجمعة الساعة 7 مساءً.' }
      const id = createReminder(db, { jid, contentId: session?.content_id || null, originalText: input, dueAt: parsed.dueAt })
      return { ...classification, text: `تم حفظ التذكير محليًا (${new Date(parsed.dueAt).toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })}).`, reminderId: id }
    }
    default: return { ...classification, needsHuman: true, text: 'أرسل لي اسم الموضوع أو اكتب: شنو تقدر تسوي؟' }
  }
}

/**
 * الأوامر التي لا تُقال مصادفة — وحدها تفتح الباب من أول رسالة.
 *
 * الفكرة: لا صديقٌ يكتب «آخر مقال» في محادثةٍ عادية. فالأمر نفسه كلمةُ سرّ،
 * ولا نحتاج بادئةً مصطنعة مثل «اسأل الدكتور». أما ما يحتمل الكلام اليومي
 * («لخّص»، «ذكّرني»، «اقتباس»، «شنو فاتني») فلا يعمل إلا بعد أن يُفتح الباب،
 * فيجري الحوار بعدها طبيعياً وحرّاً داخل الجلسة.
 */
const OPENS_DOOR = new Set([
  INTENTS.LATEST_ARTICLE, INTENTS.LATEST_BOOK, INTENTS.LATEST_PODCAST, INTENTS.LATEST_SELECTION,
  INTENTS.QUOTE_CARD, INTENTS.WEEKLY_DIGEST, INTENTS.ONE_MINUTE, INTENTS.SURPRISE_ME, INTENTS.HELP,
])

/** عمر الجلسة: بعد سكوتٍ طويل يُغلق الباب من نفسه فلا يبقى البوت مفتوحاً للأبد */
const SESSION_HOURS = 6

function sessionAlive(session) {
  if (!session) return false
  if (!['content-session', 'auto'].includes(session.mode)) return false
  const last = session.last_user_at || session.opened_at || session.updated_at
  if (!last) return false
  return Date.now() - new Date(last).getTime() < SESSION_HOURS * 3600 * 1000
}

export function shouldRespondToMessage({ db, jid, text, isReplyToAgent = false, explicitContentSession = false }) {
  if (!jid || isSuppressed(db, jid)) return { allowed: false, reason: 'suppressed' }
  const session = pendingSession(db, jid)
  /* كتب الدكتور بيده: صمتٌ فوريّ حتى تنقضي المدة */
  if (session?.manual_until && new Date(session.manual_until) > new Date()) return { allowed: false, reason: 'manual-takeover' }

  const { intent, confidence } = classifyIntent(text)
  /* أوامر الخصوصية تُطاع دائماً وفي كل حال */
  if (intent === INTENTS.STOP_MESSAGES || intent === INTENTS.RESUME_MESSAGES || intent === INTENTS.DELETE_PREFERENCES) return { allowed: true, reason: 'privacy-command' }

  /* الباب مفتوح: حوارٌ طبيعيّ بلا أوامر */
  if (isReplyToAgent || explicitContentSession || sessionAlive(session)) return { allowed: true, reason: 'content-session' }
  if (isAllowlisted(jid)) return { allowed: true, reason: 'allowlisted-contact' }

  /* الباب مغلق: لا يفتحه إلا أمرٌ صريح لا يُقال مصادفة */
  if (OPENS_DOOR.has(intent) && confidence >= 0.9) return { allowed: true, reason: 'command-opens-door', opensSession: true }
  if (hasAssistantTrigger(text) && confidence >= 0.7) return { allowed: true, reason: 'assistant-trigger', opensSession: true }
  if (flags.privateAutoReply && confidence >= 0.9) return { allowed: true, reason: 'explicit-intent' }

  /* وما عدا ذلك صمتٌ تام — «السلام عليكم» لا تُوقظ شيئاً */
  return { allowed: false, reason: 'personal-chat-default' }
}

export function handleIncoming({ db, jid, text, isReplyToAgent = false, explicitContentSession = false }) {
  const gate = shouldRespondToMessage({ db, jid, text, isReplyToAgent, explicitContentSession })
  if (!gate.allowed) return { ...gate, shouldRespond: false }
  const response = handleIntent({ db, jid, input: text })
  if (response.contentId) {
    const now = new Date().toISOString()
    db.run('INSERT INTO chat_sessions(jid,mode,content_id,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,content_id=excluded.content_id,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at', db.jidKey(jid), 'content-session', response.contentId, now, now, now)
    const item = findContent(db, response.contentId)
    if (item?.date) savePreference(db, jid, { lastContentCursor: item.date })
  }
  return { ...gate, ...response, shouldRespond: true }
}

export function describeTimeZone() { return TIME_ZONE }
