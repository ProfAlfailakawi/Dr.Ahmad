/**
 * قوالب رسائل البوت — تحريرٌ من اللوحة بلا لمس الكود (أمر الدكتور).
 *
 * البوت يجلب القوالب من Firestore عبر REST (قراءةٌ عامة بمفتاح الويب العام) كل
 * ~٥ دقائق، ويحتفظ ببدائلَ مضمّنةٍ مطابقةٍ حرفياً للنصوص الأصلية — فلو غاب
 * Firestore أو انقطعت الشبكة أو فشل الجلب بقيت الرسائل كما هي، ولا يصمت البوت أبداً.
 *
 * التحديث خلفيٌّ لا متزامن: كلُّ بناء رسالةٍ يقرأ من الذاكرة الحاضرة (تبدأ
 * بالبدائل)، وتُحدَّث الذاكرة على مهلٍ في الخلفية — فلا يتباطأ ردٌّ واحد بانتظار
 * الشبكة، ولا يمسّ الاختبارَ الوهمي (self-test) طلبٌ شبكيّ إطلاقاً.
 */

/* المشروع والمفتاح عامّان (يُشحنان في عميل الويب أصلاً)؛ يقبلان تجاوزاً بالبيئة. */
const FIRESTORE_PROJECT = process.env.WHATSAPP_FIRESTORE_PROJECT || process.env.VITE_FIREBASE_PROJECT_ID || 'drahmad-8e9e2'
const FIRESTORE_KEY = process.env.WHATSAPP_FIRESTORE_KEY || process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCoQijLO3VLX5gFLSNjDPulsU98CLoXb2M'
const DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT}/databases/(default)/documents/bot_messages/templates?key=${FIRESTORE_KEY}`
const TTL_MS = 5 * 60 * 1000

/* البدائل المضمّنة — نسخةٌ حرفيةٌ من النصوص الأصلية؛ لا تُغيَّر إلا بقصدٍ صريح.
   أيُّ تعديلٍ هنا يجب أن يوازيه تعديلٌ في القالب على Firestore، والعكس ليس لازماً. */
export const DEFAULT_BOT_MESSAGES = Object.freeze({
  welcomeLine: 'حيّاك الله. فتحت لك مكتبة د. أحمد الفيلكاوي',
  dailyGateLabel: 'بوابة اليوم:',
  optionsPrompt: 'شنو يناسب وقتك؟ ٣٠ ثانية · دقيقتان · تعمّق · اختبرني',
  stopHint: 'ولإيقاف الرسائل اكتب: أوقف الرسائل.',
  signature: 'رد آلي من موقع د. أحمد حسين الفيلكاوي',
  doorsPrefix: 'أبواب الأرشيف الحاضرة: ',
  notPublishedReached: 'سؤالك خارج المحتوى المنشور في الموقع. أعطني زاوية أو كلمة أدق، وسأحاول معك من جديد من دون اختلاق جواب.',
  notPublishedReachedCta: 'تقدر أيضاً تكتب «بوابة اليوم» أو تسأل عن أي موضوعٍ من مقالاته.',
  notPublishedNew: 'هذا الموضوع لم يُنشر عنه في الموقع بعد. أقدر أبحث لك عن أقرب فكرة منشورة أو أوضح حدود ما هو متاح.',
  notPublishedNewCta: 'اسأل داخل أي بابٍ منها، أو اكتب «آخر مقالاته».',
  noMatch: 'ما لقيت مادة منشورة مطابقة الآن. اكتب لي الموضوع أو النوع الذي تريده، وأبحث لك من جديد.',
  clarify: 'ما فهمت الطلب بدقة. هل تبحث في المقالات، الكتب، الأبحاث، أم البودكاست؟',
  humanHandoff: 'أفهم أنك تريد التواصل مع الدكتور مباشرة. اكتب رسالتك كاملة هنا؛ لا أستطيع أن أعدك بموعد رد.',
  stopConfirm: 'تم، لن تصلك رسائل محتوى جديدة. إذا رغبت بالعودة اكتب: رجع الرسائل.',
  resumeConfirm: 'عاد الاشتراك في رسائل المحتوى.',
})

/* وصفٌ عربيٌّ لكل قالب — تعرضه اللوحة كي يفهم الدكتور ما يحرّر (مصدرٌ واحد للحقيقة
   يتشاركه البوت واللوحة). المفاتيح هنا هي نفسها حقول وثيقة Firestore. */
export const BOT_MESSAGE_FIELDS = [
  { key: 'welcomeLine', label: 'جملة الترحيب (الإيقاظ)', hint: 'أول ما يقرؤه الزائر عند كتابة «موقع د. أحمد». تسبقها تحية الوقت تلقائياً، ويضيف البوت النقطة في آخرها — فلا تضع نقطة.', multiline: false, group: 'welcome' },
  { key: 'dailyGateLabel', label: 'عنوان بوابة اليوم', hint: 'العنوان فوق مادة اليوم في رسالة الترحيب.', multiline: false, group: 'welcome' },
  { key: 'optionsPrompt', label: 'سطر خيارات الوقت', hint: 'يعرض خيارات القراءة (٣٠ ثانية · دقيقتان · تعمّق · اختبرني).', multiline: false, group: 'welcome' },
  { key: 'stopHint', label: 'تذكير إيقاف الرسائل', hint: 'سطرٌ يذكّر الزائر كيف يوقف الرسائل.', multiline: false, group: 'welcome' },
  { key: 'signature', label: 'توقيع الردّ الآلي', hint: 'يُلحق بكل ردٍّ آليّ (عدا ردود الخصوصية).', multiline: false, group: 'reply' },
  { key: 'doorsPrefix', label: 'تمهيد أبواب الأرشيف', hint: 'يسبق قائمة الأبواب في رسالة «لم يُنشر عنه». احتفظ بالمسافة في آخره.', multiline: false, group: 'reply' },
  { key: 'notPublishedReached', label: 'خارج المحتوى المنشور', hint: 'حين يكون الموضوع خارج المحتوى المنشور؛ يطلب زاوية أدق ولا يدّعي وصول الرسالة إلى شخص.', multiline: true, group: 'reply' },
  { key: 'notPublishedReachedCta', label: 'دعوة تالية (خارج المنشور)', hint: 'سطرٌ يقترح بوابة اليوم أو موضوعاً من المقالات.', multiline: true, group: 'reply' },
  { key: 'notPublishedNew', label: 'لم يُنشر عنه بعد', hint: 'حين لا يوجد محتوى منشور عن الموضوع أصلاً.', multiline: true, group: 'reply' },
  { key: 'notPublishedNewCta', label: 'دعوة تالية (لم يُنشر)', hint: 'سطرٌ يقترح باباً من الأرشيف أو «آخر مقالاته».', multiline: true, group: 'reply' },
  { key: 'noMatch', label: 'لا مادة مطابقة', hint: 'حين لا يجد بحثُ الأرشيف مادةً منشورةً مطابقة.', multiline: true, group: 'reply' },
  { key: 'clarify', label: 'لم أفهم الطلب', hint: 'حين لا يفهم البوت الطلب بثقة كافية، يسأل عن المقصود.', multiline: true, group: 'reply' },
  { key: 'humanHandoff', label: 'طلب التواصل المباشر', hint: 'ردّ صادق بلا وعد بموعد أو ادعاء أن فريقاً سيتابع تلقائياً.', multiline: false, group: 'reply' },
  { key: 'stopConfirm', label: 'تأكيد إيقاف الرسائل', hint: 'يُعرض حين يطلب الزائر إيقاف رسائل المحتوى.', multiline: true, group: 'control' },
  { key: 'resumeConfirm', label: 'تأكيد عودة الرسائل', hint: 'يُعرض حين يعيد الزائر تفعيل الرسائل.', multiline: false, group: 'control' },
]

let current = { ...DEFAULT_BOT_MESSAGES }
let lastFetch = 0
let inFlight = null

/** القوالب الحاضرة — تُقرأ متزامِنةً من كل مسارات بناء الرسائل. */
export function getBotMessages() { return current }

/**
 * يحدّث القوالب من Firestore ضمن حدّ زمنيّ (TTL). آمنٌ عند الفشل: يُبقي الحاضر
 * (البدائل أو آخر جلبٍ ناجح) فلا صمت. لا يُستدعى من مسار الرسائل، بل من مؤقّت
 * الوكيل الحيّ فقط — فلا يمسّ الاختبار الوهمي.
 */
export async function refreshBotMessages({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastFetch < TTL_MS) return current
  if (inFlight) return inFlight
  lastFetch = now
  if (typeof fetch !== 'function') return current
  inFlight = (async () => {
    try {
      const options = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : undefined
      const response = await fetch(DOC_URL, options)
      if (response && response.ok) {
        const document = await response.json()
        const fields = (document && document.fields) || {}
        const next = { ...DEFAULT_BOT_MESSAGES }
        for (const key of Object.keys(DEFAULT_BOT_MESSAGES)) {
          const value = fields[key] && typeof fields[key].stringValue === 'string' ? fields[key].stringValue : ''
          if (value && value.trim()) {
            const legacyPromise = /(?:احتاجت|تحتاج)\s+متابعه\s+بشريه|سيكمل\s+معك\s+الفريق|سيرد\s+عليك\s+الدكتور|وصلت\s+رسالتك\s+للدكتور/i.test(value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/ة/g, 'ه'))
            next[key] = legacyPromise ? DEFAULT_BOT_MESSAGES[key] : value
          }
        }
        current = next
      }
    } catch { /* البدائل المضمّنة تكفي — لا صمت */ }
    finally { inFlight = null }
    return current
  })()
  return inFlight
}
