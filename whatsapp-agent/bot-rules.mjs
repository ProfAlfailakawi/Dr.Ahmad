/**
 * قواعد أدب البوت — طبقةٌ فوق البوابة، لا بديلٌ عنها.
 *
 * البوابة (intent-engine) تُقرّر: هل يتكلم؟ وهذه تُقرّر: كيف يتكلم، ومتى
 * يجب أن يسكت رغم أن الباب مفتوح.
 *
 * قاعدةٌ حاكمة بأمر الدكتور: لا تنبيهات. الرقم رقمه الخاص وهو يراه دائماً،
 * فما يحتاج إنساناً يُترك له صامتاً — لا يُرسل له إشعارٌ عن رسالةٍ في يده.
 */
import { TIME_ZONE } from './config.mjs'

/* ═══ ١) توقيع الآلة ═══ */

/* التوقيع باسم الدكتور كاملاً بأمره: من قرأ الردّ يعرف من أين جاء وإلى من
   يعود، فلا يظنّ أن الدكتور كتبه بيده ولا يجهل صاحبه. */
export const BOT_SIGNATURE = 'رد آلي من موقع د. أحمد حسين الفيلكاوي'

/**
 * من يراسل الدكتور يظنّ أنه يكلّمه هو. فإن ردّ البوت بلا توقيع فقد أوهمه.
 * التوقيع يُلحق مرةً واحدة، ولا يُلحق بردود الخصوصية (فهي إقرارٌ إجرائيّ
 * قصير لا حديثٌ منسوب لأحد).
 */
export function sign(text, { skip = false } = {}) {
  const body = String(text || '').trim()
  if (!body || skip) return body
  if (body.includes(BOT_SIGNATURE)) return body
  return `${body}\n\n${BOT_SIGNATURE}`
}

/* ═══ ٢) قواعد الصمت ═══ */

/* ساعات الصمت — أُلغيت بأمر الدكتور: «ليش حظر؟ ماله داعي حظر إطلاقاً».
   وحجّتها كانت أن ردّاً في الثالثة فجراً غريب؛ لكن البوت لا يبتدئ أحداً، ولا
   يردّ إلا على من كتب إليه بنفسه في تلك الساعة — فالمنع كان يُسكته عمّن يطلبه.
   وتُضبط من اللوحة: QUIET_FROM=QUIET_UNTIL يعني «لا حظر». */
export const QUIET_FROM = Number(process.env.WHATSAPP_QUIET_FROM ?? 0)
export const QUIET_UNTIL = Number(process.env.WHATSAPP_QUIET_UNTIL ?? 0)
/* سقف الردود اليومية لكل شخص. كان ٥ — وهو قليلٌ جداً: من أوقظ البوت وسأله
   خمسة أسئلة صُدّ عن السادس بصمتٍ لا يفهمه، وظنّ البوت معطوباً. ورُفع إلى
   عشرين، وجملةُ الإيقاظ نفسها مُعفاة منه دائماً (انظر أدناه). */
export const DAILY_REPLY_CAP = Number(process.env.WHATSAPP_DAILY_REPLY_CAP ?? 20)

/** الساعة بتوقيت الكويت مهما كان توقيت الخادم */
export function kuwaitHour(at = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIME_ZONE || 'Asia/Kuwait' }).format(at))
}

/**
 * هل نحن في ساعة صمت؟ لا صمتَ افتراضاً بأمر الدكتور.
 * وتحتمل النافذة العابرة لمنتصف الليل (٢٣ → ٦) لا الصاعدة وحدها.
 */
export function isQuietHour(at = new Date()) {
  if (QUIET_FROM === QUIET_UNTIL) return false          // لا حظر — وهو الافتراض
  const hour = kuwaitHour(at)
  return QUIET_FROM < QUIET_UNTIL
    ? hour >= QUIET_FROM && hour < QUIET_UNTIL
    : hour >= QUIET_FROM || hour < QUIET_UNTIL
}

/** كم ردّاً آلياً ذهب لهذا الشخص اليوم؟ */
export function repliesToday(db, jid) {
  const key = db.jidKey(jid)
  const row = db.get(
    "SELECT COUNT(*) c FROM intent_logs WHERE jid=? AND created_at >= datetime('now','start of day')",
    key,
  )
  return Number(row?.c || 0)
}

/* ═══ ٣) ما لا يجوز أن تقابله آلة ═══ */

/**
 * طلبٌ إنسانيّ: استشارة، موعد، إشراف، شكوى، صحافة.
 * هنا يصمت البوت صمتاً تاماً — بلا اعتذارٍ آليّ وبلا تنبيه — لأن الدكتور
 * يقرأ رسائله بنفسه، ولأن ردّاً آلياً على «أبي أستشيرك» أسوأ من الصمت.
 */
const HUMAN_ONLY = [
  /استشير|استشاره|مشوره/,
  /موعد|اقابلك|مقابله|القاك|زياره/,
  /اشراف|مشرف|رساله (ماجستير|دكتوراه)|ماجستير|دكتوراه|اطروحه/,
  /ساعدني|محتاج مساعده|مشكله|ضايج|زعلان|اشكي|شكوي/,
  /صحيفه|جريده|قناه|تلفزيون|صحفي|تصريح|لقاء اعلامي/,
  /توصيه|تزكيه|شهاده خبره/,
]

export function needsHumanOnly(normalizedText = '') {
  const value = String(normalizedText || '')
  return HUMAN_ONLY.some((pattern) => pattern.test(value))
}

/* ═══ ٤) ذاكرة ما أُرسل ═══ */

/**
 * ما سبق أن أُرسل لهذا الشخص، حتى لا يُعاد عليه.
 * تُقرأ من سجلّ الرسائل الصادرة المرتبطة بمحتوى.
 */
export function alreadySent(db, jid, contentId) {
  if (!jid || !contentId) return false
  const row = db.get(
    'SELECT 1 AS hit FROM sent_content WHERE jid=? AND content_id=? LIMIT 1',
    db.jidKey(jid), contentId,
  )
  return Boolean(row)
}

export function rememberSent(db, jid, contentId) {
  if (!jid || !contentId) return
  db.run(
    'INSERT OR IGNORE INTO sent_content(jid, content_id, sent_at) VALUES(?,?,?)',
    db.jidKey(jid), contentId, new Date().toISOString(),
  )
}

export function ensureBotRulesSchema(db) {
  db.run(`CREATE TABLE IF NOT EXISTS sent_content(
    jid TEXT NOT NULL, content_id TEXT NOT NULL, sent_at TEXT NOT NULL,
    PRIMARY KEY(jid, content_id))`)
}

/* ═══ الحَكَم ═══ */

/**
 * القرار النهائيّ بعد أن تأذن البوابة. يُرجع سبباً بالعربية كي تفهمه
 * المحاكاة في اللوحة بلا رطانة.
 */
export function applyBotRules({ db, jid, normalizedText, hasMedia = false, opensDoor = false, at = new Date() }) {
  if (hasMedia) return { allowed: false, reason: 'وسائط — تحتاج عينك أنت' }
  if (needsHumanOnly(normalizedText)) return { allowed: false, reason: 'طلبٌ إنسانيّ — لا تردّ عليه آلة' }
  if (isQuietHour(at)) return { allowed: false, reason: 'ساعات الصمت (منتصف الليل — السابعة)' }
  /* جملةُ الإيقاظ المنشورة مُعفاةٌ من السقف بأمر الدكتور: «ما يردّ إلا إذا شخص
     كتب موقع د. أحمد» — قاعدةٌ مطلقة لا يحدّها عدد. ومن كتبها فقد قصد الموقع
     قصداً، فصدُّه بصمتٍ أسوأُ من الردّ. والسقف يبقى على ما بعدها في الجلسة. */
  if (!opensDoor && repliesToday(db, jid) >= DAILY_REPLY_CAP) return { allowed: false, reason: `تجاوز ${DAILY_REPLY_CAP} ردود اليوم` }
  return { allowed: true, reason: '' }
}
