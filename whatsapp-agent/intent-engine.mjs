import { contentSummary, findContent, latestContent, normalizeArabic, searchContent } from './content-index.mjs'
import { AUTO_REPLY_ALLOWLIST, AUTO_REPLY_TRIGGERS, MANUAL_TAKEOVER_MINUTES, MAX_MESSAGE_CHARS, SITE_URL, TIME_ZONE, flags } from './config.mjs'
import { hashOpaque } from './crypto.mjs'
import { createReminder, parseReminderTime } from './reminders.mjs'
import { applyBotRules, rememberSent, sign } from './bot-rules.mjs'
import { answer as scholarAnswer, SCAFFOLD as SCHOLAR_SCAFFOLD } from './scholar.mjs'

/* ما وعد به محرك المكتبة ولم يُسلّمه بعد: السؤال وما رآه السائل منه. */
function readFollowup(session) {
  if (!session?.followup_json) return null
  try {
    const parsed = JSON.parse(session.followup_json)
    return parsed?.question ? parsed : null
  } catch { return null }
}

export const INTENTS = Object.freeze({
  LATEST_CONTENT: 'LATEST_CONTENT', LATEST_ARTICLE: 'LATEST_ARTICLE', LATEST_BOOK: 'LATEST_BOOK', LATEST_SELECTION: 'LATEST_SELECTION', LATEST_PODCAST: 'LATEST_PODCAST', LATEST_PAPER: 'LATEST_PAPER', WELCOME: 'WELCOME', MORE_LIKE_THIS: 'MORE_LIKE_THIS', COMPARE: 'COMPARE', ABOUT_TOPIC: 'ABOUT_TOPIC', UPCOMING_EVENTS: 'UPCOMING_EVENTS', ABOUT_DOCTOR: 'ABOUT_DOCTOR', CURATED_PICKS: 'CURATED_PICKS', MISSED_CONTENT: 'MISSED_CONTENT', SURPRISE_ME: 'SURPRISE_ME', ONE_MINUTE: 'ONE_MINUTE', SUMMARY: 'SUMMARY', SEARCH_TOPIC: 'SEARCH_TOPIC', SIMILAR_CONTENT: 'SIMILAR_CONTENT', READ_ARTICLE: 'READ_ARTICLE', LISTEN_FAHED: 'LISTEN_FAHED', LISTEN_NOURA: 'LISTEN_NOURA', LISTEN_DIALOGUE: 'LISTEN_DIALOGUE', SHOW_OPTIONS: 'SHOW_OPTIONS', HELP: 'HELP', CONTENT_BY_MOOD: 'CONTENT_BY_MOOD', QUOTE: 'QUOTE', QUOTE_CARD: 'QUOTE_CARD', REMIND_ME: 'REMIND_ME', CONTINUE_LISTENING: 'CONTINUE_LISTENING', WEEKLY_DIGEST: 'WEEKLY_DIGEST', STOP_MESSAGES: 'STOP_MESSAGES', RESUME_MESSAGES: 'RESUME_MESSAGES', DELETE_PREFERENCES: 'DELETE_PREFERENCES', HUMAN_RESPONSE_REQUIRED: 'HUMAN_RESPONSE_REQUIRED', UNKNOWN: 'UNKNOWN' })

/* ملاحظة واجبة: النص يمرّ على normalizeArabic قبل المطابقة، وهو يحوّل
   ة→ه و أ/إ/آ→ا و ى→ي ويحذف الترقيم. فكل نمطٍ هنا يُكتب بالصورة المطبَّعة،
   وإلا لم يطابق شيئاً أبداً — وهذا ما كان يعطّل «بطاقة اقتباس» و«النشرة
   الأسبوعية» و«أوقف الرسائل» بصمت. */
const patterns = [
  [INTENTS.STOP_MESSAGES, [/^(اوقف|وقف|ايقاف|لا ترسل|ما ابي تنبيهات|شيلني من القائمه|الغاء الاشتراك)/, 0.99]],
  [INTENTS.RESUME_MESSAGES, [/^(رجع الرسائل|فعل الجديد|اشترك مره ثانيه|ابي ارجع)/, 0.99]],
  [INTENTS.DELETE_PREFERENCES, [/(انس تفضيلاتي|امسح اللي تعرفه عني|احذف تفضيلاتي)/, 0.98]],
  /* كلمة الدخول المنشورة في خانة «المعلومات» بواتساب — فكرة صديق الدكتور.
     تُقرأ في اللحظة الصحيحة: وهم يفتحون محادثته. ولا يقولها صديقٌ مصادفةً،
     ومن قالها فهو يسأل عن الموقع بالضبط — فالردّ صحيحٌ في الحالين. */
  /* حصرها الدكتور بجملتين ينشرهما بنفسه: «موقع د. أحمد» و«موقع د. الفيلكاوي».
     وما عداهما لا يوقظ — حُذفت «مكتبة» و«إصدارات» و«منصة» و«بوت» و«حساب»
     و«مقالات/أبحاث/كتب/أعمال»، فبعضها يمرّ في كلام الناس عرضاً فيفتح الباب
     على من لم يقصد فتحه. والنصّ يصل مطبَّعاً (ة→ه، أ→ا)، فـ«الفيلكاوي» تُكتب
     هنا بصورتها المطبَّعة وإلا لم تطابق شيئاً. */
  [INTENTS.WELCOME, [/موقع\s*(ال)?(د|دكتور)\s*\.?\s*(احمد|الفيلكاوي)/, 0.97]],
  [INTENTS.LATEST_ARTICLE, [/(اخر|احدث).*(مقال|مقاله)|مقاله جديده|شنو كتبت/, 0.95]],
  /* «أبحاث الدكتور» — طلبها الدكتور صراحةً، ولا تُقال مصادفة في محادثة */
  [INTENTS.LATEST_PAPER, [/(ابحاث|بحوث)\s*(الدكتور|د\s*احمد|احمد)?|(اخر|احدث)\s*\S*\s*(بحث|ابحاث)|الابحاث/, 0.94]],
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
  /* اللقاءات والسيرة والمختارات: يسأل عنها الناس كما يسألون عن المقالات،
     وكان البوت لا يعرفها إطلاقاً فيردّ ببحثٍ عشوائي أو يصمت. */
  [INTENTS.UPCOMING_EVENTS, [/(لقاءات|محاضرات|فعاليات|مشاركات|ندوات|مؤتمرات)\s*(ال)?(قادمه|القادمه|الجايه)?|(وين|متي)\s*(بتكون|راح تكون)?\s*(محاضرتك|لقاءك|ندوتك)/, 0.93]],
  [INTENTS.ABOUT_DOCTOR, [/(السيره|سيره ذاتيه|سيرتك|من هو|تعريف|نبذه عن|هويه|cv)\s*(ال)?(د|دكتور)?\s*(احمد)?/, 0.92]],
  [INTENTS.CURATED_PICKS, [/(مختارات|المختارات|اختياراتك|ترشيحات|ماذا تقرا|شنو تقرا)/, 0.92]],
  /* داخل الجلسة يريد الناس المزيد والمقارنة والتنقّل — لا أوامر جافّة فقط */
  [INTENTS.MORE_LIKE_THIS, [/^(غيره|غيرها|زدني|كمان|بعد|المزيد|عطني اكثر|شي ثاني|واحد ثاني)/, 0.93]],
  [INTENTS.COMPARE, [/(قارن|الفرق بين|ايهما|وش الفرق|مقارنه بين)/, 0.92]],
  [INTENTS.ABOUT_TOPIC, [/(عندك|عندكم|في|لديك)\s*(شي|شيء|مقال|بحث|كتاب|ماده)?\s*(عن|حول|بخصوص)/, 0.90]],
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
  /* المنفذ الأخير: ما لم يطابق نمطاً يُعامَل بحثاً عن موضوع. ويُوسَم `fallback`
     لأنه ليس فهماً بل تخميناً — وداخل الجلسة المفتوحة كان هذا التخمين يبتلع
     كلَّ ما يُكتب، ومنه ما ليس سؤالاً أصلاً. فالبوّابة تعرفه الآن وتردّه. */
  if (value.length >= 3) return { intent: INTENTS.SEARCH_TOPIC, confidence: 0.72, normalized: value, fallback: true }
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
  if (rule.actionType === 'site-content') {
    const query = rule.contentQuery || input
    const results = searchContent(db, query, { limit: 2 })
    if (!results.length) return { intent: 'CUSTOM_RULE', confidence: 0.72, needsHuman: true, silent: true, ruleId: rule.id, ruleName: rule.name, text: '' }
    return {
      intent: 'CUSTOM_RULE',
      confidence: 0.94,
      ruleId: rule.id,
      ruleName: rule.name,
      text: results.map((item, index) => `${index + 1}. ${item.title}\n${contentSummary(item, 1)}\n${item.url}`).join('\n\n'),
      contentId: results[0].id,
    }
  }
  /* لا تُرسل القواعد الحرة كلاماً مؤلفاً. التحويل والنص الحر يتركان الرسالة
     للدكتور بصمت؛ أما الرد الآلي فمصدره فهرس الموقع وحده. */
  return { intent: 'CUSTOM_RULE', confidence: 0.99, needsHuman: true, silent: true, ruleId: rule.id, ruleName: rule.name, text: '' }
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
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const jidKey = db.jidKey(jid)
  db.run(
    `INSERT INTO chat_sessions(jid,mode,manual_until,content_id,followup_json,opened_at,last_user_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?)
     ON CONFLICT(jid) DO UPDATE SET
       mode=excluded.mode, manual_until=excluded.manual_until, content_id=NULL,
       followup_json=NULL, opened_at=NULL, last_user_at=NULL, updated_at=excluded.updated_at`,
    jidKey, 'manual-takeover', until, null, null, null, null, now,
  )
}

export function clearPreferences(db, jid) {
  if (!jid) return
  db.run('DELETE FROM user_preferences WHERE jid=?', db.jidKey(jid))
  db.addAudit('delete-preferences', hashOpaque(jid))
}

/* متون المقالات لمحرك الاستشهاد. تُقرأ من قاعدة البوت نفسها (لا شبكة، لا نموذج)
   وتُحفظ دقيقتين: الفهرس لا يتغيّر بين رسالتين، وقراءة ١٦٤ متناً مع كل حرفٍ
   يكتبه سائلٌ بذخٌ بلا طائل. */
let corpusCache = { at: 0, items: [] }
const CORPUS_TTL_MS = 120_000

export function articleCorpus(db, now = Date.now()) {
  if (now - corpusCache.at < CORPUS_TTL_MS && corpusCache.items.length) return corpusCache.items
  const rows = db.all("SELECT slug, title, url, date, body FROM content_items WHERE kind='article' AND body IS NOT NULL AND length(body) > 200")
  corpusCache = { at: now, items: rows.map((row) => ({ ...row, kind: 'article' })) }
  return corpusCache.items
}

export function handleIntent({ db, jid = '', input, session = pendingSession(db, jid), classification = classifyIntent(input) }) {
  const customRule = matchReplyRule(db, input)
  if (customRule) return customRuleReply(db, customRule, input)
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
    case INTENTS.LATEST_PAPER: return { ...classification, ...latestOf(db, 'paper', 'أحدث بحث') }
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
    /* الترحيب: أول لقاءٍ بين الناس والخدمة. يعرض المدى كلَّه — لا المقالات
       وحدها — لأن من يكتب كلمة الدخول قد يريد بحثاً أو كتاباً أو مقارنة. */
    case INTENTS.WELCOME: {
      const counts = ['article', 'paper', 'book', 'podcast'].map((kind) => ({
        kind, n: Number(db.get('SELECT COUNT(*) c FROM content_items WHERE kind=?', kind)?.c || 0),
      }))
      const label = { article: 'مقالة', paper: 'بحثاً', book: 'كتاباً', podcast: 'حلقة' }
      const have = counts.filter((c) => c.n).map((c) => `${c.n} ${label[c.kind]}`).join(' · ')
      return {
        ...classification,
        text: `أهلاً بك. هذه مكتبة د. أحمد الفيلكاوي${have ? `\n${have}` : ''}\n\n`
          + 'اكتب ما تريد بلغتك:\n'
          + '• آخر مقال · آخر بحث · آخر كتاب · آخر بودكاست\n'
          + '• عندك شي عن التقييم؟ (أو أي موضوع)\n'
          + '• قارن بين … و…\n'
          + '• لخّص لي · عندي دقيقة · فاجئني\n'
          + '• اقرأ لي · استمع بصوت فهد أو نورة\n'
          + '• بطاقة اقتباس · النشرة الأسبوعية\n\n'
          + 'ولإيقاف الرسائل في أي وقت اكتب: أوقف الرسائل',
      }
    }

    /* «غيره» و«زدني»: يفهمها البشر بلا شرح، ويجب أن يفهمها البوت داخل الجلسة.
     *
     * وكان يفهمها ثم يُخلف: محرك المكتبة يقول «وله في هذا نصّان آخران — اكتب
     * زدني»، فإذا كتبها السائل جاء هذا الفرع فبحث بمحرّكٍ آخر (FTS) عن عنوان
     * المقال الأول، فلم يجد ما يطابقه فقال «ما عندي شيءٌ قريبٌ منه». وعدٌ من
     * محرّكٍ يُطالَب به محرّكٌ لا يعلم عنه شيئاً.
     *
     * فالسؤال المحفوظ يُسأل مرةً أخرى بالمحرك نفسه، مع استثناء ما رآه السائل.
     * والبوابة تمرّ عليه كما مرّت على الأول — فالبقية استشهاداتٌ لا وعود. */
    case INTENTS.MORE_LIKE_THIS: {
      const followup = readFollowup(session)
      if (followup?.question) {
        const more = scholarAnswer(articleCorpus(db), followup.question, {
          skip: followup.seen || [],
          sequential: true,
        })
        if (more.verified && more.citations.length) {
          return {
            ...classification,
            text: more.text,
            contentId: `article:${more.citations[0].slug}`,
            followup: {
              question: followup.question,
              seen: [...(followup.seen || []), ...more.citations.map((citation) => citation.slug)],
            },
          }
        }
        /* نفدت فعلاً: إقرارٌ يليق بوعدٍ سبق، لا نفيٌ عامّ يُشعر السائل بأنه أخطأ */
        return { ...classification, text: SCHOLAR_SCAFFOLD.exhausted, clearFollowup: true }
      }

      const seed = session?.content_id ? findContent(db, session.content_id) : null
      const query = seed ? `${seed.title} ${seed.keywords || ''}` : classification.normalized
      const results = searchContent(db, query, { limit: 4 })
        .filter((item) => !seed || item.id !== seed.id)
        .slice(0, 3)
      if (!results.length) return { ...classification, text: 'ما عندي شيءٌ قريبٌ منه الآن. اذكر موضوعاً وأبحث لك فيه.' }
      return { ...classification, text: `وهذه قريبةٌ منه:\n${results.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}`, contentId: results[0].id }
    }

    /* المقارنة: يفصل الطرفين ثم يعرض ما عنده في كلٍّ منهما */
    case INTENTS.COMPARE: {
      const sides = classification.normalized
        .replace(/^(قارن|مقارنه)\s*(بين)?\s*/, '')
        .replace(/^(الفرق بين|وش الفرق بين|ايهما)\s*/, '')
        .split(/\s+و\s*|\s+وبين\s+/)
        .map((part) => part.trim()).filter((part) => part.length >= 2)
      if (sides.length < 2) return { ...classification, text: 'قارن بين ماذا وماذا؟ اكتب مثلاً: قارن بين التقويم والامتحان.' }
      const blocks = sides.slice(0, 2).map((side) => {
        const found = searchContent(db, side, { limit: 2 })
        return found.length
          ? `في «${side}»:\n${found.map((item) => `• ${item.title}\n  ${item.url}`).join('\n')}`
          : `في «${side}»: ما لقيت مادةً مخصّصة.`
      })
      return {
        ...classification,
        text: `${blocks.join('\n\n')}\n\nوالمقارنة نفسها رأيٌ يخصّ الدكتور — وهو يقرأ رسالتك.`,
        contentId: searchContent(db, sides[0], { limit: 1 })[0]?.id,
      }
    }

    /* اللقاءات: تُقرأ من الموقع لا من رأسي — وإن لم يكن ثمّة معلن، نقولها
       بصراحة ونحيل إلى الصفحة بدل أن نخترع موعداً. */
    case INTENTS.UPCOMING_EVENTS:
      return { ...classification, text: `اللقاءات والمشاركات المعلنة في الموقع:
${SITE_URL}/#events` }

    case INTENTS.ABOUT_DOCTOR:
      return { ...classification, text: `د. أحمد حسين الفيلكاوي.
السيرة المنشورة في الموقع:
${SITE_URL}/cv

والأبحاث المنشورة:
${SITE_URL}/research` }

    case INTENTS.CURATED_PICKS: {
      const picks = latestContent(db, 'curated', 3)
      if (!picks.length) return { ...classification, text: 'المختارات هنا:\nhttps://dr-alfailakawi.com/curated' }
      return { ...classification, text: `من مختارات الدكتور:\n${picks.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}\n\nوالبقية: https://dr-alfailakawi.com/curated`, contentId: picks[0].id }
    }

    case INTENTS.ABOUT_TOPIC:
    case INTENTS.SEARCH_TOPIC:
    case INTENTS.SIMILAR_CONTENT: {
      /* «عندك شي عن التقييم؟» — نحذف حشو السؤال ونبحث في الموضوع نفسه */
      const query = classification.normalized
        .replace(/^(عندك|عندكم|لديك|في)\s*(شي|شيء|مقال|بحث|كتاب|ماده)?\s*(عن|حول|بخصوص)\s*/, '')
        .replace(/[؟?]/g, '').trim() || classification.normalized
      /* المكتبة التي تمشي: نُجيب بكلام الدكتور نفسه لا برابطٍ يُحال إليه.
         وإن لم يجد المحرك شاهداً — أو أسقطته البوابة — رجعنا إلى قائمة الروابط.
         فالتنازل يكون عن الطموح دائماً، لا عن الأمانة. */
      const scholar = scholarAnswer(articleCorpus(db), query)
      if (scholar.verified && scholar.citations.length) {
        return {
          ...classification,
          text: scholar.text,
          contentId: `article:${scholar.citations[0].slug}`,
          /* البقية تُحفظ هنا لا تُرمى — وعليها يقوم وفاءُ «زدني» */
          followup: { question: query, seen: scholar.citations.map((citation) => citation.slug) },
        }
      }

      const results = searchContent(db, query, { limit: 3 })
      if (results.length) {
        return {
          ...classification,
          text: `أقرب المواد من الموقع لسؤالك:
${results.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}

اكتب «غيره» لمزيد، أو «لخّص» للأول.`,
          contentId: results[0].id,
        }
      }
      /* لا جواب موثق في الموقع: صمتٌ وتحويل، لا تخمين ولا إعلان فشل. */
      return { ...classification, needsHuman: true, silent: true, text: '' }
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
/**
 * بابٌ واحد لا غير: «موقع د. أحمد» وما جرى مجراها.
 *
 * كانت أوامرٌ كثيرة تفتحه («آخر مقال» · «أبحاث الدكتور» · «بطاقة اقتباس»…)،
 * وأمر الدكتور أن تُغلق كلها: الجملة المنشورة وحدها توقظه. وما عداها لا
 * يعمل إلا بعد الإيقاظ، داخل الجلسة.
 *
 * وحكمةُ ذلك أن الجملة المنشورة يعرفها من قرأ خانة «المعلومات» قاصداً، أما
 * «آخر مقال» فقد يكتبها صديقٌ يسأله عن مقالته الأخيرة سؤالاً شخصياً.
 */
const OPENS_DOOR = new Set([INTENTS.WELCOME])

/**
 * الجلسة تبقى مفتوحة ما دام صاحبها لم يتدخل بيده. لا عدّاد ولا مؤقّت؛ هذا
 * يجعل الحوار طبيعياً بعد الإيقاظ، بينما يبقى الباب مغلقاً تماماً قبله.
 */
function sessionAlive(session) {
  return Boolean(session && ['content-session', 'auto'].includes(session.mode))
}

/** هل هذه محادثةُ مجموعة؟ */
export const isGroupJid = (jid) => String(jid || '').toLowerCase().endsWith('@g.us')

/**
 * المحادثات الفردية وحدها — قائمةُ سماحٍ مغلقة، لا قائمةَ منع.
 *
 * ومنعُ المجموعات وحدها لا يكفي: واتساب يسوق إلى الوكيل أنواعاً أخرى بالصورة
 * نفسها — الحالات `status@broadcast`، والقنوات `@newsletter`، وقوائم البثّ
 * `@broadcast`. ولم يكن في الكود كلّه سطرٌ واحد يميّز نوع المحادثة، فكان ردٌّ
 * آليّ على حالةِ أحدهم ممكناً تماماً كالردّ في المجموعة.
 *
 * وقائمةُ المنع تُصلح ما عرفناه اليوم وتترك ما يستحدثه واتساب غداً؛ أما قائمة
 * السماح فتصمت عن كل جديدٍ حتى نأذن له. والصمت هو الوضع الآمن هنا.
 */
const PRIVATE_CHAT_SUFFIXES = ['@s.whatsapp.net', '@c.us', '@lid']
export const isPrivateChat = (jid) => {
  const value = String(jid || '').toLowerCase()
  return PRIVATE_CHAT_SUFFIXES.some((suffix) => value.endsWith(suffix))
}

/** وصفٌ عربيّ لنوع المحادثة — ليقرأه الدكتور في السجل بلا رطانة */
export const chatKindLabel = (jid) => {
  const value = String(jid || '').toLowerCase()
  if (value.endsWith('@g.us')) return 'مجموعة'
  if (value.includes('status@broadcast')) return 'حالة'
  if (value.endsWith('@broadcast')) return 'قائمة بثّ'
  if (value.endsWith('@newsletter')) return 'قناة'
  return 'محادثة غير فردية'
}

export function shouldRespondToMessage({ db, jid, text, isReplyToAgent = false, explicitContentSession = false, hasMedia = false, at = new Date(), classification = classifyIntent(text) }) {
  if (!jid || isSuppressed(db, jid)) return { allowed: false, reason: 'suppressed' }

  /* ═══ المنع المطلق: المجموعات ═══
     بأمر الدكتور صراحةً: «ما يصير يرد بالقروب إطلاقاً». وهو قبل كل شيء —
     قبل الجلسة، وقبل جملة الإيقاظ، وقبل أوامر الخصوصية — لأن الجملة تُكتب
     في القروب فتفتح جلسةً، فيصير البوت يردّ على ما يُقال فيه.
     وهذا ما وقع فعلاً: ثمانية ردود في ثلاث دقائق داخل مجموعة.
     ولا يُستثنى شيء: من أراد البوت راسله وحده. */
  if (!isPrivateChat(jid)) return { allowed: false, reason: `${chatKindLabel(jid)} — لا ردّ فيها إطلاقاً` }

  /* ═══ المنع المطلق: الصوت والصورة ═══
     قواعد الأدب أدناه تمنع الوسائط، لكنّها طبقةٌ واحدة اعتمدت على عَلَمٍ لم
     يصل إليها قط. فنمنعها هنا أيضاً صراحةً: ردٌّ آليّ على رسالةٍ صوتية
     يفضح أن البوت لم يسمعها أصلاً. */
  if (hasMedia) return { allowed: false, reason: 'وسائط — لا يردّ البوت على صوتٍ ولا صورة' }
  const session = pendingSession(db, jid)
  const classification0 = classification
  const { intent, confidence } = classification0
  const opensDoor = OPENS_DOOR.has(intent) && confidence >= 0.9

  /* أوامر الخصوصية تُطاع دائماً، حتى أثناء الصمت أو التدخل اليدوي. */
  if (intent === INTENTS.STOP_MESSAGES || intent === INTENTS.RESUME_MESSAGES || intent === INTENTS.DELETE_PREFERENCES) {
    return { allowed: true, reason: 'privacy-command' }
  }

  /* ═══ كتب الدكتور بيده: صمتٌ مطلق حتى تنقضي المدة ═══
   * الرقم شخصي، ولذلك تدخّل الدكتور هو أعلى سلطة. لا تستطيع جملة الإيقاظ
   * ولا جلسة سابقة ولا اقتباسٌ من البوت أن تعيد الرد الآلي أثناء حديثه. */
  if (session?.manual_until && new Date(session.manual_until) > new Date()) {
    return { allowed: false, reason: 'manual-takeover' }
  }

  /* قواعد الأدب: تسكته أحياناً رغم أن الباب مفتوح — الطلب الإنسانيّ
     والوسائط ونحوها. ولا تنبيه في شيءٍ منها بأمر الدكتور. */
  const manners = applyBotRules({ db, jid, normalizedText: classification0.normalized, hasMedia, opensDoor, at })
  if (!manners.allowed) return { allowed: false, reason: manners.reason }

  /* ═══ الباب مفتوح: حوارٌ طبيعيّ بلا أوامر ═══
   *
   * ★ لكن لا يبتلع كلَّ ما يُكتب. بأمر الدكتور: «لا يردّ إلا إذا أُوقظ، وما
   * عدا ذلك ما يصير يردّ». وكانت الجلسة تُبيح الردّ على أي نصّ بلا تحقق، فمرّ
   * منها كلامٌ ليس سؤالاً — شكوى رجلٍ من الفقر ورفضِ توظيفه — إلى محرك البحث.
   *
   * فداخل الجلسة يُشترط أن يكون الكلام أمراً مفهوماً (نيّةً مطابِقة)، لا
   * تخميناً من المنفذ الأخير. «زدني» و«لخّص» و«عندك شي عن…» تعمل كما كانت،
   * وما لم يُفهَم يُترك للدكتور. */
  const activeSession = isReplyToAgent || explicitContentSession || sessionAlive(session)
  const groundedFallback = classification0.fallback && searchContent(db, text, { limit: 1 }).length > 0
  const understood = !classification0.fallback || groundedFallback
  if (activeSession && understood) return { allowed: true, reason: groundedFallback ? 'content-session-grounded-search' : 'content-session' }
  /* قائمةُ السماح لم تعد تفتح الباب بنفسها. كانت تُجيز الردّ على **أيّ** كلمة
     يكتبها صاحبها بلا جملة إيقاظ — وهو نقضٌ لقاعدة الدكتور: «ما يردّ إلا إذا
     شخص كتب موقع د. أحمد». وهي اليوم فارغة، لكنّ يداً تملؤها غداً تفتح باباً
     لا يعلم به أحد. فتبقى تُقرأ ويُسجَّل أثرها، ولا تُجيز شيئاً. */
  if (isAllowlisted(jid)) db.addAudit?.('allowlist-no-longer-opens-door', db.jidKey(jid), 'يلزمها جملة الإيقاظ كغيرها')

  /* الباب مغلق: لا يفتحه إلا أمرٌ صريح لا يُقال مصادفة */
  if (OPENS_DOOR.has(intent) && confidence >= 0.9) return { allowed: true, reason: 'command-opens-door', opensSession: true }
  /* ونداءات «اسأل الدكتور» أُغلقت هي الأخرى: الجملة المنشورة وحدها توقظه.
     (تبقى AUTO_REPLY_TRIGGERS معرَّفةً لمن أراد تخصيصها بمتغيّر بيئة.) */
  /* حُذف منفذٌ قديم كان يسمح بالردّ على أي نيّةٍ واثقة متى فُعّل privateAutoReply
     — ولو فُعّل يوماً لردّ على «الكتب وصلت للمكتبة؟» وأشباهها، وهذا نقضٌ
     لقاعدة الدكتور: صمتٌ كامل ما لم يوقظه أمرٌ صريح. لا استثناء إلا أوامر
     الخصوصية أعلاه، فمن طلب إيقاف الرسائل يُطاع فوراً ولو لم يوقظ شيئاً. */

  /* وما عدا ذلك صمتٌ تام — «السلام عليكم» لا تُوقظ شيئاً */
  return { allowed: false, reason: 'personal-chat-default' }
}

export function handleIncoming({ db, jid, text, isReplyToAgent = false, explicitContentSession = false, hasMedia = false, at = new Date() }) {
  /* التصنيف كان يُنفّذ ثلاث مرات للرسالة نفسها: في البوابة، وفي قواعد الأدب،
     ثم في الرد. نُنشئه مرةً واحدة ونمرّره، فتقلّ كلفة كل تفاعل بلا تغيير المعنى. */
  const classification = classifyIntent(text)
  const gate = shouldRespondToMessage({ db, jid, text, isReplyToAgent, explicitContentSession, hasMedia, at, classification })
  const session = db.get('SELECT * FROM chat_sessions WHERE jid=?', db.jidKey(jid))
  if (!gate.allowed) return { ...gate, shouldRespond: false }
  const response = handleIntent({ db, jid, input: text, session, classification })
  /* الباب انفتح بأمرٍ صريح: تُفتح الجلسة ولو لم يكن في الردّ مادة — وإلا
     رحّبنا بالقادم ثم صمتنا عن سؤاله التالي، وهو أسوأ من ألا نرحّب. */
  if (gate.opensSession && !response.contentId) {
    const stamp = new Date().toISOString()
    db.run('INSERT INTO chat_sessions(jid,mode,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,manual_until=NULL,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at', db.jidKey(jid), 'content-session', stamp, stamp, stamp)
  }
  const persistSession = Boolean(gate.opensSession || explicitContentSession || sessionAlive(session))
  if (response.contentId) {
    const now = new Date().toISOString()
    /* اقتباسُ رسالةٍ آلية يجيز جواباً واحداً، لكنه ليس كلمة الإيقاظ ولا يفتح
       جلسةً دائمة من الخلف. الجلسة المستمرة لا تبدأ إلا بالإيقاظ الصريح أو
       إذا كانت مفتوحة أصلاً. */
    if (persistSession) {
      db.run('INSERT INTO chat_sessions(jid,mode,content_id,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,manual_until=NULL,content_id=excluded.content_id,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at', db.jidKey(jid), 'content-session', response.contentId, now, now, now)
      const item = findContent(db, response.contentId)
      if (item?.date) savePreference(db, jid, { lastContentCursor: item.date })
    }
    rememberSent(db, jid, response.contentId)   // فلا يُعاد عليه ما أُرسل
  }
  /* حفظُ ما وُعد به. يُكتب بعد الجلسة لأن السطر أعلاه قد يُنشئها للتوّ، ويُمحى
     حين تنفد البقية أو حين يسأل السائل عن فكرةٍ أخرى — فلا تُسلَّم له بقيةُ
     سؤالٍ قديم على أنها جوابُ سؤاله الجديد. */
  /* وتُمحى كذلك حين ينتقل الحديث إلى مادةٍ أخرى: من سأل عن «التلقين» ثم طلب
     «آخر مقالة» ثم كتب «زدني»، يريد المزيد من الأخيرة لا بقيّة الأولى. */
  const movedOn = Boolean(response.contentId) && !response.followup
  if (jid && (response.followup || response.clearFollowup || (movedOn && session?.followup_json))) {
    const payload = response.followup ? JSON.stringify(response.followup) : null
    db.run(
      'INSERT INTO chat_sessions(jid,mode,followup_json,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?)'
      + ' ON CONFLICT(jid) DO UPDATE SET followup_json=excluded.followup_json,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at',
      db.jidKey(jid), 'content-session', payload, new Date().toISOString(), new Date().toISOString(), new Date().toISOString(),
    )
  }
  /* التوقيع: من يراسل الدكتور يظنّ أنه يكلّمه هو. أما ردود الخصوصية
     («تم، لن تصلك رسائل») فإقرارٌ إجرائيّ لا يُنسب لأحد، فلا يُوقَّع. */
  const isPrivacyReply = gate.reason === 'privacy-command'
  const signed = sign(response.text || '', { skip: isPrivacyReply })
  return { ...gate, ...response, text: signed, shouldRespond: true }
}

export function describeTimeZone() { return TIME_ZONE }
