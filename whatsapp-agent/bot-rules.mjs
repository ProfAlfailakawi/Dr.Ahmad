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
/* ═══ سقف الردود — حارسُ جموحٍ لا حارسُ أدب ═══
 *
 * كان ٥ في اليوم، وكان له معنى يوم كان البوت يستيقظ بعشرات المحفّزات: يمنع
 * حلقةً مفرغة تُغرق شخصاً برسائل. أما اليوم فلا يستيقظ إلا بجملةٍ واحدة
 * يكتبها إنسانٌ بقصد — فصار السقف يعاقب أكثر الناس اهتماماً: من سأل ستّ
 * مرات يُقابَل بصمتٍ بلا تفسير، فيظنّ البوت معطوباً.
 *
 * فيبقى السقف لغرضه الأصلي وحده — إمساك الجموح — بعددٍ لا يبلغه إنسان،
 * ونافذةٍ بالساعة لا باليوم فلا يُقفل الباب إلى الغد. وجملةُ الإيقاظ معفاةٌ
 * منه نهائياً: قاعدة الدكتور مطلقة لا يحدّها عدد. */
export const HOURLY_REPLY_CAP = Number(process.env.WHATSAPP_HOURLY_REPLY_CAP ?? 30)
/* يبقى الاسم القديم مُصدَّراً لمن يستورده — ولا يُستعمل في القرار */
export const DAILY_REPLY_CAP = HOURLY_REPLY_CAP

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
/**
 * كم ردّاً أُرسل فعلاً لهذا الشخص في الساعة الماضية؟
 *
 * كان يعدّ صفوف intent_logs — وهي تُسجَّل عند تصنيف النيّة لا عند إرسال الردّ.
 * فيمتنع البوت ويُحسب عليه امتناعُه ردّاً. وقد وقع ذلك حرفياً: صفر ردٍّ مُرسَل
 * والعدّاد يقول ٦، فتظهر رسالة «تجاوز ٥ ردود اليوم» وهي كاذبة.
 * نعدّ الآن من أثر الإرسال نفسه (auto-reply-sent) — ما أُرسل لا ما نُوي.
 */
export function repliesInWindow(db, jid) {
  const key = db.jidKey(jid)
  const row = db.get(
    "SELECT COUNT(*) c FROM audit_log WHERE action='auto-reply-sent' AND target=? AND created_at >= datetime('now','-1 hour')",
    key,
  )
  return Number(row?.c || 0)
}

/* الاسم القديم يبقى عاملاً لمن يستدعيه */
export const repliesToday = repliesInWindow

/* ═══ ٣) ما لا يجوز أن تقابله آلة ═══ */

/**
 * طلبٌ إنسانيّ: استشارة، موعد، إشراف، شكوى، صحافة.
 * هنا يصمت البوت صمتاً تاماً — بلا اعتذارٍ آليّ وبلا تنبيه — لأن الدكتور
 * يقرأ رسائله بنفسه، ولأن ردّاً آلياً على «أبي أستشيرك» أسوأ من الصمت.
 */
/* ═══ ما لا تردّ عليه آلة ═══
 *
 * كانت القائمة عربيةً بحتة. فكتب إنسانٌ بالإنجليزية أنه رُفض توظيفه لهويّته،
 * وأنه يعيش في فقرٍ وراتبٍ زهيد — فلم يطابق نمطاً واحداً، ومرّ إلى محرك البحث،
 * فقوبل بـ«ما لقيت تطابقاً دقيقاً في أرشيف الموقع».
 *
 * وأُضيفت طبقتان: الإنجليزية، وإشاراتُ الشكوى والضيق بأي لغة. ولا يُشترط أن
 * تكون الرسالة سؤالاً — من بثّ همّه لا يُحال إلى فهرس. */
const HUMAN_ONLY = [
  /استشير|استشاره|مشوره/,
  /موعد|اقابلك|مقابله|القاك|زياره/,
  /اشراف|مشرف|رساله (ماجستير|دكتوراه)|ماجستير|دكتوراه|اطروحه/,
  /ساعدني|محتاج مساعده|مشكله|ضايج|زعلان|اشكي|شكوي/,
  /صحيفه|جريده|قناه|تلفزيون|صحفي|تصريح|لقاء اعلامي/,
  /توصيه|تزكيه|شهاده خبره/,
  /* ألمٌ وضيقٌ ورجاء — بالعربية */
  /وظيفه|توظيف|راتب|فقر|محتاج شغل|بدون عمل|عاطل|رفضوني|ظلم|تعبت|مكتئب|يأس|ادعيلي|بالله عليك/,
  /* والإنجليزية — أكثر ما يصل الدكتور من خارج الخليج */
  /\b(job|salary|poverty|unemploy|rejected|visa|residence permit|scholarship|supervis|recommendation letter|help me|please help|i wish|i am tired|depress|struggl|suffer)\b/i,
  /* نداءٌ شخصيّ صريح مهما كانت اللغة */
  /\b(dear (dr|doctor|prof)|أرجوك|ارجوك|رجاءً|رجاء منك)\b/i,
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
  /* ★ جملة الإيقاظ لا يحدّها عدد. كانت opensDoor تصل إلى هذه الدالة ثم تُرمى
     — توقيعها لا يذكرها أصلاً — فيُقابَل من كتب «موقع د. أحمد» بالصمت لأنه
     راسل قبلها خمس مرات. وهذا نقضٌ لقاعدة الدكتور: الجملة توقظه دائماً. */
  if (opensDoor) return { allowed: true, reason: '' }
  if (repliesInWindow(db, jid) >= HOURLY_REPLY_CAP) return { allowed: false, reason: `تجاوز ${HOURLY_REPLY_CAP} ردّاً في الساعة` }
  return { allowed: true, reason: '' }
}
