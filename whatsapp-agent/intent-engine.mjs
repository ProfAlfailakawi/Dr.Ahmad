import { contentSummary, findContent, latestContent, normalizeArabic, searchContent } from './content-index.mjs'
import { MAX_MESSAGE_CHARS, TIME_ZONE } from './config.mjs'
import { hashOpaque } from './crypto.mjs'
import { createReminder, parseReminderTime } from './reminders.mjs'

export const INTENTS = Object.freeze({
  LATEST_CONTENT: 'LATEST_CONTENT', LATEST_ARTICLE: 'LATEST_ARTICLE', LATEST_BOOK: 'LATEST_BOOK', LATEST_SELECTION: 'LATEST_SELECTION', LATEST_PODCAST: 'LATEST_PODCAST', MISSED_CONTENT: 'MISSED_CONTENT', SURPRISE_ME: 'SURPRISE_ME', ONE_MINUTE: 'ONE_MINUTE', SUMMARY: 'SUMMARY', SEARCH_TOPIC: 'SEARCH_TOPIC', SIMILAR_CONTENT: 'SIMILAR_CONTENT', READ_ARTICLE: 'READ_ARTICLE', LISTEN_FAHED: 'LISTEN_FAHED', LISTEN_NOURA: 'LISTEN_NOURA', LISTEN_DIALOGUE: 'LISTEN_DIALOGUE', SHOW_OPTIONS: 'SHOW_OPTIONS', HELP: 'HELP', CONTENT_BY_MOOD: 'CONTENT_BY_MOOD', QUOTE: 'QUOTE', QUOTE_CARD: 'QUOTE_CARD', REMIND_ME: 'REMIND_ME', CONTINUE_LISTENING: 'CONTINUE_LISTENING', WEEKLY_DIGEST: 'WEEKLY_DIGEST', STOP_MESSAGES: 'STOP_MESSAGES', RESUME_MESSAGES: 'RESUME_MESSAGES', DELETE_PREFERENCES: 'DELETE_PREFERENCES', HUMAN_RESPONSE_REQUIRED: 'HUMAN_RESPONSE_REQUIRED', UNKNOWN: 'UNKNOWN' })

const patterns = [
  [INTENTS.STOP_MESSAGES, [/^(وقف|إيقاف|لا ترسل|وقف الرسائل|ما أبي تنبيهات|شيلني من القائمة)/, 0.99]],
  [INTENTS.RESUME_MESSAGES, [/^(رجع الرسائل|فعل الجديد|اشترك مرة ثانية)/, 0.99]],
  [INTENTS.DELETE_PREFERENCES, [/(انس تفضيلاتي|امسح اللي تعرفه عني|احذف تفضيلاتي)/, 0.98]],
  [INTENTS.LATEST_ARTICLE, [/(اخر|احدث).*(مقال|مقاله)|مقاله جديده|شنو كتبت/, 0.95]],
  [INTENTS.LATEST_BOOK, [/(اخر|احدث).*(كتاب|الكتب)|الكتب/, 0.94]],
  [INTENTS.LATEST_SELECTION, [/(اخر|احدث).*(مختارات)|مختارات جديده|المختارات/, 0.94]],
  [INTENTS.LATEST_PODCAST, [/(اخر|احدث).*(بودكاست|حلقه)|اخر بودكاست/, 0.96]],
  [INTENTS.MISSED_CONTENT, [/(شنو|ماذا).*(فاتني|فات)/, 0.96], [/(من زمان ما تابعت|ما تابعت من زمان)/, 0.94]],
  [INTENTS.SURPRISE_ME, [/(فاجيني|اختر لي|اختار لي|على ذوقك|شيء من عندك)/, 0.94]],
  [INTENTS.ONE_MINUTE, [/(عندي دقيقه|ما عندي وقت|الزبده|ملخص سريع|اختصرها|الفكره بس)/, 0.96]],
  [INTENTS.SUMMARY, [/(لخص|ملخص|نبذة|الخلاصة)/, 0.84]],
  [INTENTS.LISTEN_DIALOGUE, [/(الحوار|حوار)/, 0.92]],
  [INTENTS.LISTEN_FAHED, [/(فهد|قراءة فهد|صوت الرجل)/, 0.95]],
  [INTENTS.LISTEN_NOURA, [/(نورة|نورا|قراءة نورة|صوت المرأة)/, 0.95]],
  [INTENTS.QUOTE_CARD, [/(بطاقة|صورة اقتباس|بطاقة اقتباس)/, 0.92]],
  [INTENTS.QUOTE, [/(اقتباس|جملة جميلة|عطني اقتباس)/, 0.90]],
  [INTENTS.CONTINUE_LISTENING, [/(كمل|أكمل|من وين وقفت|تابع الاستماع)/, 0.90]],
  [INTENTS.HELP, [/(شنو تقدر|الخيارات|مساعدة|شلون أستخدم|الأوامر|القائمة)/, 0.98]],
  [INTENTS.REMIND_ME, [/(ذكرني|ذكّرني|تذكير)/, 0.90]],
  [INTENTS.WEEKLY_DIGEST, [/(ملخص أسبوعي|النشرة الأسبوعية)/, 0.94]],
  [INTENTS.HUMAN_RESPONSE_REQUIRED, [/(رأيك|شنو رايك|ماذا ترى|هل تعتقد|أبي رأيك)/, 0.82]],
]

const clean = (text) => normalizeArabic(String(text || '').slice(0, MAX_MESSAGE_CHARS))

export function classifyIntent(text) {
  const value = clean(text)
  for (const [intent, ...rules] of patterns) {
    for (const [regex, confidence] of rules) if (regex.test(value)) return { intent, confidence, normalized: value }
  }
  if (value.length >= 3) return { intent: INTENTS.SEARCH_TOPIC, confidence: 0.72, normalized: value }
  return { intent: INTENTS.UNKNOWN, confidence: 0.2, normalized: value }
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

export function markManualTakeover(db, jid, minutes = 30) {
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

export function shouldRespondToMessage({ db, jid, text, isReplyToAgent = false, explicitContentSession = false }) {
  if (!jid || isSuppressed(db, jid)) return { allowed: false, reason: 'suppressed' }
  const session = pendingSession(db, jid)
  if (session?.manual_until && new Date(session.manual_until) > new Date()) return { allowed: false, reason: 'manual-takeover' }
  if (isReplyToAgent || explicitContentSession || session?.mode === 'auto') return { allowed: true, reason: 'content-session' }
  const { intent, confidence } = classifyIntent(text)
  if (intent === INTENTS.STOP_MESSAGES || intent === INTENTS.RESUME_MESSAGES || confidence >= 0.9) return { allowed: true, reason: 'explicit-intent' }
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
