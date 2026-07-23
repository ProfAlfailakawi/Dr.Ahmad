import { normalizeArabic } from './content-index.mjs'

/**
 * قواعد أدب البوت — طبقةٌ فوق البوابة، لا بديلٌ عنها.
 *
 * البوابة (intent-engine) تُقرّر: هل يتكلم؟ وهذه تُقرّر: كيف يتكلم، ومتى
 * يجب أن يسكت رغم أن الباب مفتوح.
 *
 * قاعدةٌ حاكمة بأمر الدكتور: لا تنبيهات. الرقم رقمه الخاص وهو يراه دائماً،
 * فما يحتاج إنساناً يُترك له صامتاً — لا يُرسل له إشعارٌ عن رسالةٍ في يده.
 */

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

/* ═══ ٢) التشغيل الدائم ═══ */

/* بأمر الدكتور: لا نافذة صمت ولا سقف عددي. الوكيل متاح طوال اليوم، لكن لا
   يتكلم أصلاً إلا بعد جملة الإيقاظ، ويصمت فور تدخل الدكتور. نبقي الصادرات
   القديمة للتوافق مع اللوحة والاختبارات من دون أن تفرض قيداً. */
export const QUIET_FROM = null
export const QUIET_UNTIL = null
export const HOURLY_REPLY_CAP = Number.POSITIVE_INFINITY
export const DAILY_REPLY_CAP = Number.POSITIVE_INFINITY

export function kuwaitHour(at = new Date()) { return at.getHours() }
export function isQuietHour() { return false }

/** عدّاد تشخيصي فقط؛ لا يُستخدم لمنع الردود. */
export function repliesInWindow(db, jid) {
  const key = db.jidKey(jid)
  const row = db.get(
    "SELECT COUNT(*) c FROM audit_log WHERE action='auto-reply-sent' AND target=? AND created_at >= datetime('now','-1 hour')",
    key,
  )
  return Number(row?.c || 0)
}
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
  /استشير|استشاره|مشوره|نصيحه/u,
  /موعد|اقابلك|مقابله|القاك|زياره/u,
  /اشراف|مشرف|رساله (ماجستير|دكتوراه)|ماجستير|دكتوراه|اطروحه/u,
  /ساعدني|محتاج مساعده|مشكله|ضايج|زعلان|اشكي|شكوي/u,
  /صحيفه|جريده|قناه|تلفزيون|صحفي|تصريح|لقاء اعلامي/u,
  /توصيه|تزكيه|شهاده خبره/u,
  /* ألمٌ وضيقٌ ورجاء — بالعربية */
  /وظيفه|توظيف|راتب|فقر|محتاج شغل|بدون عمل|عاطل|رفضوني|ظلم|مظلوم|تعبت|مكت|\u0645\u0643\u062A|مكت[ئءا]|مكتئب|مكتءب|اكتئاب|اكتءاب|ياس|يأس|ادعيلي|بالله عليك/u,
  /* سلامة ودواء وحاجة ملحة وقانون واستثمار وفتوى */
  /اموت|أموت|انتحر|أنتحر|اوذي نفسي|أؤذي نفسي|اذي نفسي|تشخيص|دوايي|دوائي|نصيحه قانونيه|نصيحة قانونية|استثمر|أستثمر|فتوى|فتوه|فتوي|اتصل بي|عاجل/u,
  /* والإنجليزية — أكثر ما يصل الدكتور من خارج الخليج */
  /\b(job|salary|poverty|unemploy|unemployed|rejected|visa|residence permit|scholarship|supervis|supervision|recommendation letter|help me|please help|i wish|i am tired|depress|depressed|struggl|struggling|suffer|kill myself|suicide|hurt myself|diagnosis|medication|legal advice|invest|fatwa|call me)\b/iu,
  /* نداءٌ شخصيّ صريح مهما كانت اللغة */
  /\b(dear (dr|doctor|prof)|أرجوك|ارجوك|رجاءً|رجاء منك)\b/iu,
]

export function needsHumanOnly(text = '') {
  const value = String(text || '')
  const norm = normalizeArabic(value)
  return HUMAN_ONLY.some((pattern) => pattern.test(value) || pattern.test(norm))
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

/* عمر الحجز دقائق لا أيام: الحجز يُحرَّر بعد الإرسال، لكن قتل العملية بين
   الحجز والتحرير (إعادة تشغيل، انهيار) كان يترك صفوفاً يتيمة تخنق كل ردٍّ
   لاحق إلى الأبد. الكنّاس يزيل ما شاخ قبل كل محاولة حجز. */
const RESERVATION_TTL_MS = 10 * 60 * 1000

export function reserveContent(db, jid, contentId) {
  if (!jid || !contentId) return false
  db.run(
    'DELETE FROM content_reservations WHERE reserved_at < ?',
    new Date(Date.now() - RESERVATION_TTL_MS).toISOString(),
  )
  const result = db.run(
    'INSERT OR IGNORE INTO content_reservations(jid, content_id, reserved_at) VALUES(?,?,?)',
    db.jidKey(jid), contentId, new Date().toISOString(),
  )
  /* كانت الدالة لا تُرجع شيئاً فيُقيَّم كل حجزٍ ناجحٍ فاشلاً ويُخنق الرد —
     هذا سبب «كتبتُ ولم يظهر شيء». النجاح هو إدراج صفٍّ جديد فعلاً. */
  return Number(result?.changes ?? 0) > 0
}

export function releaseContentReservation(db, jid, contentId) {
  if (!jid || !contentId) return
  db.run(
    'DELETE FROM content_reservations WHERE jid=? AND content_id=?',
    db.jidKey(jid), contentId,
  )
}

export function ensureBotRulesSchema(db) {
  db.run(`CREATE TABLE IF NOT EXISTS sent_content(
    jid TEXT NOT NULL, content_id TEXT NOT NULL, sent_at TEXT NOT NULL,
    PRIMARY KEY(jid, content_id))`)
  db.run(`CREATE TABLE IF NOT EXISTS content_reservations(
    jid TEXT NOT NULL, content_id TEXT NOT NULL, reserved_at TEXT NOT NULL,
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
  return { allowed: true, reason: '' }
}
