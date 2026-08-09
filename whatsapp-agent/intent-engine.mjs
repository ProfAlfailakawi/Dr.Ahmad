import { arabicCountPhrase, toRoot, ARTICLE_ENTRY_FORMS, AUDIO_EPISODE_FORMS, BOOK_ENTRY_FORMS, CURATED_ENTRY_FORMS, NEW_MATERIAL_FORMS, PAPER_ENTRY_FORMS, RECORDED_VIEW_FORMS } from './dialect-lexicon.mjs'
import { articlesByTopic, contentSummary, findContent, latestAudioContent, latestContent, mostPopularContent, normalizeArabic, searchContent, shortReadableContent, topArticleTopics } from './content-index.mjs'
import { AUDIO_PUBLIC_BASE_URL, AUTO_REPLY_ALLOWLIST, AUTO_REPLY_TRIGGERS, MANUAL_TAKEOVER_MINUTES, MAX_MESSAGE_CHARS, SITE_URL, TIME_ZONE, flags, redactJid } from './config.mjs'
import { conceptDefinition } from './domain-concepts.mjs'
import { hashOpaque } from './crypto.mjs'
import { createReminder, parseReminderTime } from './reminders.mjs'
import { applyBotRules, needsHumanOnly, sign } from './bot-rules.mjs'
import { getBotMessages } from './bot-messages.mjs'
import { spokenReply } from './spoken-index.mjs'
import { bookChaptersReply, bookQuoteReply } from './book-quotes.mjs'
import { answer as scholarAnswer, SCAFFOLD as SCHOLAR_SCAFFOLD, scoreItem as scholarScore, tokens as scholarTokens } from './scholar.mjs'
import {
  dialogueModeReply,
  explainModeReply,
  humanSafeReply,
  KNOWLEDGE_MODES,
  sensitiveDomain,
  verifiedResearchReply,
} from './knowledge-modes.mjs'
import {
  applyReferenceResolution,
  parseCompoundRequest,
  parseConversationContext,
  resolveContextReference,
  serializeConversationContext,
  setContextResults,
} from './conversation-context.mjs'
import {
  buildFifteenSecondChallenge,
  buildQuietIdeaNetwork,
  continueVerbatim,
  distillItem,
  extractVerbatimAtSpeed,
  isVerbatimFromItem,
  selectDailyUnsentContent,
} from './daily-experience.mjs'

/* ما وعد به محرك المكتبة ولم يُسلّمه بعد: السؤال وما رآه السائل منه. */
function readFollowup(session) {
  if (!session?.followup_json) return null
  try {
    const parsed = JSON.parse(session.followup_json)
    return parsed?.question ? parsed : null
  } catch { return null }
}

export const INTENTS = Object.freeze({
  LATEST_CONTENT: 'LATEST_CONTENT', LATEST_ARTICLE: 'LATEST_ARTICLE', LATEST_ARTICLES: 'LATEST_ARTICLES', MOST_VIEWED_ARTICLE: 'MOST_VIEWED_ARTICLE', CONTENT_OVERVIEW: 'CONTENT_OVERVIEW', TOP_ARTICLE_TOPIC: 'TOP_ARTICLE_TOPIC', LATEST_BOOK: 'LATEST_BOOK', BOOK_SEARCH: 'BOOK_SEARCH', BOOK_CHAPTERS: 'BOOK_CHAPTERS', BOOK_INSIGHT: 'BOOK_INSIGHT', BOOK_VIDEOS: 'BOOK_VIDEOS', MEDIA_LIBRARY: 'MEDIA_LIBRARY', RADIO: 'RADIO', DIALOGUE_LIBRARY: 'DIALOGUE_LIBRARY', LATEST_SELECTION: 'LATEST_SELECTION', LATEST_PODCAST: 'LATEST_PODCAST', LATEST_PAPER: 'LATEST_PAPER', WELCOME: 'WELCOME', MORE_LIKE_THIS: 'MORE_LIKE_THIS', COMPARE: 'COMPARE', ABOUT_TOPIC: 'ABOUT_TOPIC', UPCOMING_EVENTS: 'UPCOMING_EVENTS', ABOUT_DOCTOR: 'ABOUT_DOCTOR', CURATED_PICKS: 'CURATED_PICKS', MISSED_CONTENT: 'MISSED_CONTENT', SURPRISE_ME: 'SURPRISE_ME', ONE_MINUTE: 'ONE_MINUTE', SUMMARY: 'SUMMARY', SEARCH_TOPIC: 'SEARCH_TOPIC', SIMILAR_CONTENT: 'SIMILAR_CONTENT', READ_ARTICLE: 'READ_ARTICLE', LISTEN_FAHED: 'LISTEN_FAHED', LISTEN_NOURA: 'LISTEN_NOURA', LISTEN_DIALOGUE: 'LISTEN_DIALOGUE', SHOW_OPTIONS: 'SHOW_OPTIONS', HELP: 'HELP', CONTENT_BY_MOOD: 'CONTENT_BY_MOOD', QUOTE: 'QUOTE', QUOTE_CARD: 'QUOTE_CARD', REMIND_ME: 'REMIND_ME', CONTINUE_LISTENING: 'CONTINUE_LISTENING', WEEKLY_DIGEST: 'WEEKLY_DIGEST', STOP_MESSAGES: 'STOP_MESSAGES', RESUME_MESSAGES: 'RESUME_MESSAGES', DELETE_PREFERENCES: 'DELETE_PREFERENCES', VERIFIED_RESEARCH: 'VERIFIED_RESEARCH', EXPLAIN_MODE: 'EXPLAIN_MODE', DIALOGUE_MODE: 'DIALOGUE_MODE', HUMAN_HANDOFF: 'HUMAN_HANDOFF', HUMAN_RESPONSE_REQUIRED: 'HUMAN_RESPONSE_REQUIRED', COMPOUND_REQUEST: 'COMPOUND_REQUEST', CONTEXT_REFERENCE: 'CONTEXT_REFERENCE', READ_SPEED: 'READ_SPEED', IDEA_NETWORK: 'IDEA_NETWORK', CHALLENGE: 'CHALLENGE', CHALLENGE_ANSWER: 'CHALLENGE_ANSWER', SOURCE_PROOF: 'SOURCE_PROOF', SAVE_CONTENT: 'SAVE_CONTENT', LIST_SAVED: 'LIST_SAVED', REMOVE_SAVED: 'REMOVE_SAVED', CORRECTION: 'CORRECTION', CONTINUE_READING: 'CONTINUE_READING', UNKNOWN: 'UNKNOWN' })

const LEARNABLE_INTENTS = new Set([
  INTENTS.LATEST_CONTENT, INTENTS.LATEST_ARTICLE, INTENTS.LATEST_ARTICLES,
  INTENTS.MOST_VIEWED_ARTICLE, INTENTS.CONTENT_OVERVIEW, INTENTS.TOP_ARTICLE_TOPIC,
  INTENTS.LATEST_BOOK, INTENTS.BOOK_SEARCH, INTENTS.BOOK_CHAPTERS, INTENTS.BOOK_INSIGHT, INTENTS.BOOK_VIDEOS,
  INTENTS.MEDIA_LIBRARY, INTENTS.RADIO, INTENTS.DIALOGUE_LIBRARY,
  INTENTS.LATEST_SELECTION, INTENTS.LATEST_PODCAST,
  INTENTS.LATEST_PAPER, INTENTS.MORE_LIKE_THIS, INTENTS.ABOUT_TOPIC,
  INTENTS.UPCOMING_EVENTS, INTENTS.ABOUT_DOCTOR, INTENTS.CURATED_PICKS,
  INTENTS.MISSED_CONTENT, INTENTS.SURPRISE_ME, INTENTS.ONE_MINUTE,
  INTENTS.SUMMARY, INTENTS.SEARCH_TOPIC, INTENTS.SIMILAR_CONTENT,
  INTENTS.READ_ARTICLE, INTENTS.LISTEN_FAHED, INTENTS.LISTEN_NOURA,
  INTENTS.LISTEN_DIALOGUE, INTENTS.SHOW_OPTIONS, INTENTS.HELP,
  INTENTS.CONTENT_BY_MOOD, INTENTS.QUOTE, INTENTS.QUOTE_CARD,
  INTENTS.CONTINUE_LISTENING, INTENTS.CONTINUE_READING, INTENTS.WEEKLY_DIGEST, INTENTS.READ_SPEED,
  INTENTS.EXPLAIN_MODE, INTENTS.DIALOGUE_MODE, INTENTS.IDEA_NETWORK, INTENTS.CHALLENGE, INTENTS.SOURCE_PROOF,
  INTENTS.SAVE_CONTENT, INTENTS.LIST_SAVED, INTENTS.REMOVE_SAVED,
])


/* ملاحظة واجبة: النص يمرّ على normalizeArabic قبل المطابقة، وهو يحوّل
   ة→ه و أ/إ/آ→ا و ى→ي ويحذف الترقيم. فكل نمطٍ هنا يُكتب بالصورة المطبَّعة،
   وإلا لم يطابق شيئاً أبداً — وهذا ما كان يعطّل «بطاقة اقتباس» و«النشرة
   الأسبوعية» و«أوقف الرسائل» بصمت. */

const patterns = [
  [INTENTS.STOP_MESSAGES,
    [/^(?:اوقف|وقف|ايقاف)(?:\s+(?:الرسائل|الرسايل|رسائل المحتوي|التنبيهات|الارسال|البوت))?$/, 0.99],
    [/^(?:اوقفوا|وقفوا)\s+(?:الرسائل|الرسايل|التنبيهات|الارسال)$/, 0.99],
    [/^(?:لا ترسل(?: لي)?|لا تدز(?:لي| لي)?|ما ابي تنبيهات|بس لا ترسلون لي|شيلني من القائمه|الغاء الاشتراك)$/, 0.99],
    [/^(?:لا اريد|لا ابي|ما ابي)\s+(?:رسائل|رسايل|تنبيهات)$/, 0.99],
    [/^(?:stop|unsubscribe|opt out)$/, 0.99]],
  [INTENTS.RESUME_MESSAGES,
    [/^(?:رجع|فعل|شغل)\s+(?:الرسائل|الرسايل|التنبيهات|المحتوي|الارسال)$/, 0.99],
    [/^(?:فعل الجديد|اشترك مره ثانيه|ابي ارجع|resume|subscribe|opt in)$/, 0.99]],
  [INTENTS.DELETE_PREFERENCES,
    [/^(?:انس تفضيلاتي|امسح اللي تعرفه عني|احذف تفضيلاتي|احذف بياناتي|احذف كل معلوماتي|امسح بياناتي|امسح سجلي|لا تحفظ بياناتي|delete my data|please delete my data|remove my data|forget my data)$/, 0.99]],
  /* كلمة الدخول المنشورة في خانة «المعلومات» بواتساب — فكرة صديق الدكتور.
     تُقرأ في اللحظة الصحيحة: وهم يفتحون محادثته. ولا يقولها صديقٌ مصادفةً،
     ومن قالها فهو يسأل عن الموقع بالضبط — فالردّ صحيحٌ في الحالين. */
  /* حصرها الدكتور بجملتين ينشرهما بنفسه: «موقع د. أحمد» و«موقع د. الفيلكاوي».
     وما عداهما لا يوقظ — حُذفت «مكتبة» و«إصدارات» و«منصة» و«بوت» و«حساب»
     و«مقالات/أبحاث/كتب/أعمال»، فبعضها يمرّ في كلام الناس عرضاً فيفتح الباب
     على من لم يقصد فتحه. والنصّ يصل مطبَّعاً (ة→ه، أ→ا)، فـ«الفيلكاوي» تُكتب
     هنا بصورتها المطبَّعة وإلا لم تطابق شيئاً. */
  [INTENTS.WELCOME, [/^موقع د (?:احمد|الفيلكاوي)$/, 0.99]],
  /* اللغة الطبيعية بعد الإيقاظ: لا نُجبر الزائر على صيغةٍ واحدة. الترتيب مهم:
     «أكثر مقالة مشاهدة» تُلتقط قبل «مقالة»، والجمع قبل المفرد. */
  [INTENTS.MOST_VIEWED_ARTICLE, [/(اكثر|اعلي|اشهر|ابرز).*(مقال|مقاله).*(مشاهده|قراءه|انتشار|تداول)|المقاله?\s*(الاكثر مشاهده|الاكثر قراءه|الاشهر)/, 0.97]],
  /* «قائمة المقالات» و«عطني المقالات» و«وين ألقى المقالات» طلبٌ واحد بثلاث
     صيغ، وكانت كلها تسقط: الأولى إلى «ما لقيت مادة»، والباقيتان إلى استيضاحٍ
     بارد. ومن طلب قائمةً لا يُطلب منه توضيحُ ما طلب. */
  [INTENTS.LATEST_ARTICLES, [/(اخر|احدث|جديد|يديد).*(مقالات|مقالاته|مقالاتك|مقالات الدكتور)|شنو.*(اخر|احدث|يديد).*(مقالات|مقالاته|مقالاتك)|شنو.*كتب.*موخرا|شنو.*(?:عنده|عندك).*مقالات/, 0.96],
    [/^(?:قائمه|قايمه|كل|جميع|عطني|اعطني|ورني|وين|وين القي|وين اشوف|اشوف|ابي)\s*(?:ال)?(?:مقالات|مقالاته|مقالاتك|المقالات)\s*$/, 0.95]],
  [INTENTS.LATEST_ARTICLE, [/(اخر|احدث|جديد).*(مقال|مقاله|مقالته)|مقاله جديده|شنو كتبت|شنو اخر مقالته/, 0.95]],
  [INTENTS.LATEST_CONTENT, [/(شنو|وش|ما|ماذا).*(جديد|يديد|اخر شي|احدث شي|نشر موخرا).*(الدكتور|د احمد|الفيلكاوي)?|(جديد|يديد|اخر شي|احدث شي)\s*(الدكتور|د احمد|الفيلكاوي)|شنو (?:جديده|يديده|يديدك)|(?:عنده|عندك|فيه|في)\s*(?:شي\s*)?يديد/, 0.96],
    /* متابعاتٌ قصيرة بعد بطاقةٍ أُرسلت: «جديده؟» «عنده جديد؟» «فيه جديد؟» — تُفهم
       طلباً للأحدث لا صمتاً (أمر الدكتور: يردّ على كل شيء). */
    [/^\s*جديده?\s*[؟?]?\s*$|(عنده|فيه|في|عندكم|لديه)\s*(شي\s*)?جديد|شي\s*جديد|جديد\s*(الدكتور|عنده)/, 0.92]],
  [INTENTS.TOP_ARTICLE_TOPIC, [/(اكثر|ابرز).*(موضوع|مجال).*(يكتب|كتب|مقالات)|شنو.*اكثر.*مواضيع/, 0.94]],
  /* «وش عندك» سؤالٌ عمّا يقدر عليه، لا موضوعٌ يُبحث عنه. وكان يُقرأ بحثاً
     فيرجع بثلاث مقالاتٍ عن السوشيال ميديا — إجابةٌ عن سؤالٍ لم يُطرح. النمط
     مقيّدٌ بالجملة القصيرة وحدها فلا يخطف «عندك شيء عن التنمر». */
  [INTENTS.CONTENT_OVERVIEW, [/(شنو|وش|ماذا).*(عنده|موجود).*(الموقع|المكتبه)|محتويات\s*(الموقع|المكتبه)|شنو يقدم الموقع/, 0.93],
    [/^(?:طيب\s+|زين\s+)?(?:شنو|وش|ايش|ماذا|شو)\s*(?:عندك|عندكم|فيه|الموجود|موجود|متوفر)(?:\s*(?:هني|هنا|عندك))?[!.؟]*$/, 0.95],
    [/^(?:وش|شنو|ايش|شو)\s*(?:هالموقع|الموقع)[!.؟]*$/, 0.93],
    [/^what (?:do you have|can i find|is here)[!.؟]*$/, 0.93]],
  /* «أبحاث الدكتور» — طلبها الدكتور صراحةً، ولا تُقال مصادفة في محادثة */
  [INTENTS.LATEST_PAPER, [/(ابحاث|بحوث)\s*(الدكتور|د\s*احمد|احمد)?|(اخر|احدث)\s*\S*\s*(بحث|ابحاث)|الابحاث|شنو.*(ابحاث|بحوث|بحث).*(الدكتور|له)?|^(?:عنده|عندك|عندكم|لديه)\s*(?:بحث|ابحاث|بحوث)[!.؟]*$|^(?:عطني|اعطني|ورني|ابي|اريد)\s*(?:بحث|ابحاث|بحوث)(?:\s+الدكتور)?[!.؟]*$/, 0.94]],
  /* بوابات كانت تسقط في البحث العام: هي طلباتُ أداة/قسم، لا موضوعات. يجب أن
     تسبق «كتاب» و«حوار» العامّين كي لا يعود الرد إلى مقالة عشوائية. */
  [INTENTS.BOOK_VIDEOS, [/(?:فيديوهات|فيديو|مقاطع|شروحات)\s*(?:ال)?(?:كتاب|الموسوعه)|(?:شاهد|مشاهده|اشوف|ابي اشوف).*?(?:فيديوهات|فيديو|مقاطع).*?(?:داخل|في)\s*(?:ال)?(?:كتاب|الموسوعه)|(?:فيديوهات|فيديو|مقاطع).*?(?:داخل|في)\s*(?:ال)?(?:كتاب|الموسوعه)/, 0.98]],
  [INTENTS.BOOK_CHAPTERS, [/^(?:(?:ابي|اريد|ممكن|عطني|اعطني|ورني)\s+)?(?:فصول|ابواب|محتويات|فهرس)\s*(?:ال)?كتاب(?:\s+.+)?[!.؟]*$|^(?:فصوله|ابوابه|محتوياته|فهرسه)[!.؟]*$/, 0.99],
    [/^(?:(?:ابي|اريد|ودي|ممكن|خلني)\s+)?(?:اتصفح|تصفح|افتح|ورني)\s*(?:ال)?كتاب(?:\s+.+)?[!.؟]*$/, 0.99]],
  [INTENTS.BOOK_INSIGHT, [/^(?:(?:عطني|اعطني|ابي|اريد|ممكن)\s+)?(?:معلومه|فكره|فائده|اقتباس)\s*(?:مفيده|جميله|مهمه|قويه)?\s*(?:من|داخل)\s*(?:ال)?كتاب(?:\s+.+)?[!.؟]*$/, 0.99]],
  [INTENTS.BOOK_SEARCH, [/^(?:(?:ابي|اريد|ابغي|ابغى|ممكن)\s+)?(?:ابحث|بحث|دور|فتش)\s*(?:لي\s*)?(?:داخل|في)\s*(?:ال)?كتاب(?:\s+.+)?[!.؟]*$/, 0.98],
    [/^(?:(?:ابي|اريد|ممكن)\s+)?(?:اسال|اسأل)\s*(?:ال)?كتاب(?:\s+.+)?[!.؟]*$/, 0.98]],
  [INTENTS.DIALOGUE_LIBRARY, [/^(?:(?:ابي|اريد|ممكن)\s+)?(?:حوار|الحوار)\s*(?:مسموع|مسموعه)[!.؟]*$|^(?:الحوارات|حوارات)\s*(?:المسموعه|الصوتيه)?[!.؟]*$|^(?:كل|قائمه|وين|ورني|عطني|اعطني)\s*(?:ال)?حوارات(?:\s+(?:المسموعه|الصوتيه))?[!.؟]*$|^مجلس الفكره[!.؟]*$/, 0.98]],
  [INTENTS.MEDIA_LIBRARY, [/(?:الظهور|ظهور)\s*(?:ال)?اعلامي|(?:لقاءات|مقابلات|فيديوهات)\s*(?:الدكتور|د\s*احمد|الفيلكاوي)|(?:شاهد|مشاهده|اشوف|ورني|عطني|اعطني).*?(?:لقاءات|مقابلات|الظهور الاعلامي)/, 0.97]],
  [INTENTS.RADIO, [/^(?:(?:ابي|اريد|ممكن|شغل|شغلي|افتح|ودني|وين)\s+)?(?:ال)?(?:راديو|اذاعه|الاذاعه|بث)\s*(?:الدكتور|د\s*احمد|الفيلكاوي|الموقع|المباشر|الصوتي)?[!.؟]*$/, 0.98]],
  [INTENTS.LATEST_BOOK, [/(اخر|احدث|جديد|يديد)\s*\S*\s*(كتاب|الكتب)|شنو.*(كتب|كتاب|مولفات).*(الدكتور|له)?|كتب الدكتور|مولفات الدكتور|^(?:عنده|عندك|عندكم|لديه)\s*(?:كتب|مولفات|مولفاته)[!.؟]*$|^(?:عطني|اعطني|ورني|ابي|اريد)\s*(?:كتب|كتبه|كتاب|مولفات|مولفاته)(?:\s+الدكتور)?[!.؟]*$/, 0.94]],
  [INTENTS.LATEST_SELECTION, [/(اخر|احدث|جديد)\s*\S*\s*(مختارات)/, 0.94]],
  [INTENTS.LATEST_PODCAST, [/(اخر|احدث|جديد|يديد).*(بودكاست|بود كاست|حلقه|حلقات|حوار|الحوار)|اخر بودكاست|شنو.*(بودكاست|بود كاست|حلقات|الحلقه|الحوار).*(الدكتور|له)?|^(?:عنده|عندك|عندكم|لديه)\s*(?:حلقات|بودكاست|حوارات)[!.؟]*$|^(?:عطني|اعطني|ورني|ابي|اريد)\s*(?:حلقه|الحلقه|بودكاست)(?:\s+الدكتور)?[!.؟]*$/, 0.96]],
  /* «فاتني شي» وحدها كانت تسقط إلى البحث: النمط يشترط «شنو» أو «ماذا» قبلها. */
  [INTENTS.MISSED_CONTENT, [/(شنو|ماذا).*(فاتني|فات)/, 0.96], [/^(?:فاتني|فاتتني)(?:\s*(?:شي|شيء|اشياء|مواد|كثير))?[!.؟]*$/, 0.95], [/(من زمان ما تابعت|ما تابعت من زمان)/, 0.94]],
  [INTENTS.SURPRISE_ME, [/(فاجيني|اختر لي|اختار لي|على ذوقك|شيء من عندك)/, 0.94]],
  [INTENTS.ONE_MINUTE, [/(عندي دقيقه|عندي دقيقتين|دقيقه وحده|وقت قصير|شي سريع|ماده قصيره|ما عندي وقت|الزبده|ملخص سريع|اختصرها|الفكره بس)/, 0.96]],
  /* أيّ مدّةٍ يكتبها إنسان، لا الثلاث المعروضة في الترحيب وحدها. كان
     «١٥ ثانية» و«٤٥ ثانية» و«خمس دقائق» تسقط إلى البحث الأعمى فيبحث الأرشيف
     عن مادةٍ عنوانها «١٥ ثانية»، و«دقيقة ونص» و«٣ دقايق» تصلان إلى «ما لقيت».
     المدّة نيّةٌ لا موضوع — والكنترولر هو من يترجمها إلى درجةٍ في السلّم. */
  /* إتمامٌ لنحو المدّة: العشرات بالحروف («ثلاثين ثانية» · «خمسين ثانية»)
     كانت تسقط إلى البحث الأعمى فيُفتَّش الأرشيف عن مادةٍ بهذا العنوان؛
     و«دقيقة» وحدها — أشيع صيغة على الإطلاق — لم يكن لها موضع، فمن كتبها
     وصله «ما لقيت مادة» بعد أن عُرضت عليه النتائج للتوّ. */
  [INTENTS.READ_SPEED, [/^(?:(?:ابي|اريد|ابغي|عطني|اعطني|ممكن|خله|خلها|خلني|اقرا لي|اقرالي|في|خلال|حدود|حوالي|تقريبا)\s+)*(?:(?:[0-9٠-٩۰-۹]{1,3}|نص|نصف|ربع|ثلث|واحده|وحده|اثنتين|ثنتين|ثنتان|ثلاث|ثلاثه|اربع|اربعه|خمس|خمسه|ست|سته|سبع|سبعه|ثمان|ثمانيه|تسع|تسعه|عشر|عشره|احداعش|اثناعش|خمسطعش|عشرين|ثلاثين|اربعين|خمسين|ستين|سبعين|ثمانين|تسعين)\s*(?:ثانيه|ثواني|دقيقه|دقايق|دقيقتين|دقيقتان|ساعه)(?:\s*و\s*(?:نص|نصف|ربع))?|(?:دقيقه|دقيقتين|دقيقتان|ساعه)\s*و\s*(?:نص|نصف|ربع)|قراءه (?:30|٣٠|۳۰) ثانيه|دقيقتين|دقيقتان|قراءه دقيقتين|قراءه دقيقتان|اتعمق|التعمق|تعمق|بالتفصيل|بتوسع|دقيقه|دقايق|ثواني)(?:\s+(?:بس|لو سمحت|فقط|من فضلك))?$/, 0.97]],
  [INTENTS.IDEA_NETWORK, [/(شبكه الافكار|مسارات الفكره|امش مع الفكره|مرتبط فيه|مرتبط به|خذني للشبكه)/, 0.96]],
  [INTENTS.CHALLENGE, [/^(?:اختبرني|تحدي|تحدي 15 ثانيه|سوال اليوم)$/, 0.98]],
  [INTENTS.CHALLENGE_ANSWER, [/^(?:1|2|3|١|٢|٣)$/, 0.98]],
  [INTENTS.SOURCE_PROOF, [/^(?:(?:عطني|ابي|اريد|ممكن)\s+)?(?:المصدر|مصدره)(?:\s+لو سمحت)?$|^وين\s+(?:رابط\s+)?المصدر$|^وين قالها$|^اثبات المصدر$/, 0.98]],
  [INTENTS.SAVE_CONTENT, [/^(?:(?:ابي|ممكن)\s+)?(?:احفظه|احفظها|تحفظه|تحفظها)(?:\s+عندي)?$|^(?:حطه برفي|حطها برفي|خلها عندي|خله عندي)$/, 0.97]],
  [INTENTS.LIST_SAVED, [/^(?:محفوظاتي|المحفوظات|محفوظات|رفي|الرف|شنو حفظت|اعرض(?: لي)? المحفوظات|ورني رفي|ورني محفوظاتي)$/, 0.97]],
  [INTENTS.REMOVE_SAVED, [/^(?:(?:ممكن|ابي)\s+)?(?:شيله|شيلها|احذفه|احذفها)\s+(?:من\s+)?(?:محفوظاتي|رفي)(?:\s+لو سمحت)?$/, 0.97]],
  /* «باختصار» طلبُ زبدةٍ صريح، وكانت تسقط إلى البحث فتصل «ما لقيت مادة». */
  [INTENTS.SUMMARY, [/(لخص|ملخص|تلخيص|نبذه|الخلاصه|باختصار|اختصر(?:ه|ها|لي)?|(?:شنو|وش|عطني|اعطني|ابي|اريد)\s+(?:ال)?زبده)/, 0.90]],
  /* «كمل» وحدها: طلب متابعة المادة الحاضرة لا بحثٌ عن كلمة. كتبها الدكتور
     بعد الملخص (٣١ يوليو) فذهبت بحثاً وعادت «ما لقيت مادة مطابقة». تسبق
     MORE_LIKE_THIS لأن تلك تعطي مادةً أخرى، وهذه تُكمل الحاضرة نفسها.
     «كمل الاستماع/القراءة» تبقى لـCONTINUE_LISTENING بنمطها الأدق. */
  [INTENTS.CONTINUE_READING, [/^(?:كمل|كمله|كملها|كملي|اكمل|اكملها|اكمله|واصل|واصلها|زد)(?:\s+(?:لي|لنا|معي|معنا|ال)?(?:باقي|بقيه|بقيتها|قراءه|قراءة|نص|كلام|شرح|موضوع)?){0,2}\s*[.!؟?]?$/, 0.96]],
  /* الواجهة العامة لا تعرض أسماء الأصوات الداخلية: للمستخدم مساران فقط،
     «قراءة المقال» و«الحوار». الأنماط القديمة تبقى مفهومة للتوافق، بلا أن
     يقترحها البوت أو يعيد أسماءها في الرد. */
  [INTENTS.LISTEN_DIALOGUE, [/(استمع|شغل|سمعني|بصوت)\s*\S*\s*(الحوار|حوار)|^الحوار$|^(?:(?:ابي|اريد|ودي|ممكن|خلني)\s+)?(?:اسمع|اسمعني|سمعني|شغل|شغلي)\s*(?:لي\s*)?(?:ال)?حوار(?:\s+الصوتي)?[!.؟]*$|^(?:ابي|اريد|ودي)\s+(?:ال)?حوار(?:\s+الصوتي)?[!.؟]*$|^(?:ال)?حوار\s*(?:ال)?صوتي[!.؟]*$/, 0.95]],
  /* شكوى الدكتور (١ أغسطس): «قراءة صوتية للمقالة ما يعمل». الجذر أن الصيغة
     كانت تشترط أداة التعريف — «القراءه الصوتيه» تُفهم و«قراءه صوتيه» تسقط إلى
     بحثٍ أعمى، وهي الصيغة التي يكتبها الناس وتظهر في الموقع نفسه. وكذلك
     «اسمعها» و«شغلها» و«اقرا لي المقاله» و«ابي اسمعها» كنّ يسقطن.
     الآن: أداة التعريف اختيارية، والضمير الملتصق مقبول، وفعل الرغبة قبلها. */
  [INTENTS.LISTEN_FAHED, [/^(?:(?:ابي|ابغي|ابغى|اريد|ودي|ممكن)\s+)?(?:اسمعها|اسمعه|اسمعهم|اسمع|سمعني|سمعها|سمعه|شغلها|شغله|شغل|استماع|اقراها لي|اقراه لي|اقرا لي|قراها لي|قراه لي|قرا لي|اقرا|قرا)?\s*(?:ال)?قراءه\s*(?:ال)?صوتيه(?:\s+(?:لي|للمقال|للمقاله|للماده|المقال|المقاله))?$|^(?:(?:ابي|ابغي|ابغى|اريد|ودي|ممكن)\s+)?(?:اسمعها|اسمعه|اسمع|سمعني|سمعها|شغلها|شغله|شغل|استماع|اقراها لي|اقراه لي|اقرا لي|قراها لي|قراه لي|قرا لي)(?:\s+(?:لي|المقال|المقاله|الماده|صوتيا))?$|^(?:(?:ابي|ابغي|ابغى|اريد|ودي|ممكن)\s+)?(?:شغل|شغلي|سمعني|اسمعني|اقرا|قرا)\s+(?:لي\s+)?(?:المقال|المقاله|الماده)$|(?:اسمع|شغل|سمعني|اقراها لي|اقراه لي|قراها لي|قراه لي|قراءه المقال|قراءة المقال|اسمع المقال)(?:\s+لي)?$|(?:اسمع|شغل|سمعني|اقراها لي|اقراه لي|قراها لي|قراه لي|صوت|بصوت|قراءه)\s*(?:لي\s*)?(?:فهد|الرجل|رجل|رجال)|صوت الرجل/, 0.95]],
  /* شكوى الدكتور (٧ أغسطس): «هل الصوت شغال إن طلب أحدٌ تشغيل صوت المقالة؟».
     القياس: «شغّل الصوت» و«الصوت» و«شغّلي الصوت» و«النسخة الصوتية» و«اسمعني
     إياها» كلها كانت تسقط إلى بحثٍ أعمى — فلا صوت. هذا نمطٌ عامّ لطلب الصوت
     بلا صوتٍ مسمّى (يُقابَل بصوت فهد ما لم يُطلب غيره)، ومقيّدٌ بالجملة
     القصيرة وحدها فلا يخطف سؤالاً فيه لفظ «صوت». */
  [INTENTS.LISTEN_FAHED, [/^(?:(?:ابي|ابغي|ابغى|اريد|ودي|ممكن|لو سمحت)\s+)?(?:شغل|شغلي|شغلها|شغله|اسمعني|سمعني|سمعنيها|اسمعنيها|اعطني|عطني)?\s*(?:اياها|اياه)?\s*(?:ال)?(?:نسخه\s*)?(?:ال)?صوت(?:يه)?(?:\s*(?:ال)?(?:مقال|مقاله|ماده))?[\s.!؟]*$|^(?:ال)?نسخه\s*(?:ال)?صوتيه[\s.!؟]*$|^(?:اسمعني|سمعني)\s*(?:اياها|اياه|ياها)[\s.!؟]*$/, 0.95]],
  [INTENTS.LISTEN_NOURA, [/(?:اسمع|شغل|سمعني|اقراها لي|اقراه لي|صوت|بصوت|قراءه)\s*(?:لي\s*)?(?:نوره|نورا|المراه|امراه)|صوت المراه/, 0.95]],
  [INTENTS.QUOTE_CARD, [/(بطاقه اقتباس|صوره اقتباس)/, 0.92]],
  [INTENTS.QUOTE, [/(اقتباس|جمله جميله|عطني اقتباس)/, 0.90]],
  [INTENTS.CONTINUE_LISTENING, [/(من وين وقفت|تابع الاستماع|كمل الاستماع|كمل القراءه)/, 0.90]],
  [INTENTS.READ_ARTICLE, [/(افتح المقال|رابط المقال|ابي اقراه|اقرا المقال)/, 0.94]],
  /* «ساعدني» كانت تسقط إلى بحثٍ فاشل فيعود «ما لقيت مادة» — أي أنّ من طلب
     المساعدة صراحةً هو وحده من لم يجدها. والنمط كان يشترط لفظ «مساعده»
     بالتاء المربوطة، وهي ليست صيغةَ من يستنجد. */
  [INTENTS.HELP, [/(شنو تقدر|الخيارات|مساعده|ساعدني|ساعديني|ساعدوني|تساعدني|شلون استخدم|شلون اسالك|كيف استخدم|كيف اسالك|وش اسوي|شنو اسوي|الاوامر|القائمه|^help$|^menu$|^options$|what can you do)/, 0.98]],
  [INTENTS.REMIND_ME, [/(ذكرني|تذكير)/, 0.90]],
  /* «خلاصة الأسبوع» و«جديد الأسبوع» كانتا تذهبان إلى البحث، فيردّ البوت
     باقتباسٍ فيه لفظ «خلاصة» — جوابٌ عن غير سؤال. */
  /* المزاج كان له معالجٌ ولا نمط له البتّة — بابٌ مبنيّ بلا مفتاح، فمن كتب
     «تعبان» قوبل بـ«هذا الموضوع لم يُنشر عنه». والنمط مقيّدٌ بالجملة القصيرة
     وحدها فلا يخطف «مشكلة التعليم» ولا سؤالاً فيه كلمة مزاج. */
  [INTENTS.CONTENT_BY_MOOD, [/^(?:انا\s+)?(?:تعبان|تعبانه|زعلان|زعلانه|مضايق|متضايق|مليت|ملل|طفشان|مهموم|مبسوط|فرحان|فاضي|محتار|مو طايق|مزاجي\s*\S*)(?:\s*(?:اليوم|شوي|مره|جدا))?[!.؟]*$/, 0.9]],
  [INTENTS.WEEKLY_DIGEST, [/(ملخص اسبوعي|النشره الاسبوعيه|نشره اسبوعيه|خلاصه الاسبوع|ملخص الاسبوع|جديد الاسبوع|حصاد الاسبوع)/, 0.94]],
  [INTENTS.VERIFIED_RESEARCH, [/(بحث موثوق|مصادر خارجيه|دراسه حديثه|ما تقوله الدراسات|مصدر رسمي|جهه رسميه)/, 0.97]],
  [INTENTS.EXPLAIN_MODE, [/(اشرح لي|اشرحها|فهمني|فهمني ببساطه|وضحها لي|وضح لي|بسطها لي|بالتفصيل|في سطرين|في دقيقه|لطالب|لولي امر|لمعلم|لباحث)/, 0.95]],
  [INTENTS.DIALOGUE_MODE, [/(حاورني|عارضني|اختبر الفكره|رحله\s*خمس\s*دقا\S*|ناقشني|اسالني)/, 0.96]],
  [INTENTS.HUMAN_HANDOFF, [/(دواء|علاج|تشخيص|اعراض|مرض|صحتي|نفسي|اكتئاب|انتحار|قانون|محكمه|قضيه|شكوي|شكوى|محامي|موعد|اقابلك|اتواصل مع الدكتور|اشراف|مشكلتي|ابني|بنتي|زوجي|زوجتي|ساعدني شخصيا|ابي احد يرد|ابغي احد يرد|احد يرد علي|ابي انسان|ابي اكلم الدكتور|ابي اتكلم مع الدكتور|ابي رد شخصي|ودي اكلم الدكتور)/, 0.96]],
  [INTENTS.HUMAN_RESPONSE_REQUIRED, [/(رايك|ماذا تري|هل تعتقد|ابي رايك)/, 0.82]],
  /* اللقاءات والسيرة والمختارات: يسأل عنها الناس كما يسألون عن المقالات،
     وكان البوت لا يعرفها إطلاقاً فيردّ ببحثٍ عشوائي أو يصمت. */
  [INTENTS.UPCOMING_EVENTS, [/(لقاءات|محاضرات|فعاليات|مشاركات|ندوات|مؤتمرات)\s*(ال)?(قادمه|القادمه|الجايه)?|(وين|متي)\s*(بتكون|راح تكون)?\s*(محاضرتك|لقاءك|ندوتك)/, 0.93]],
  /* كان كل سؤالٍ يبدأ بـ«منو» يعود بسيرة الدكتور، مهما كان المسؤول عنه:
     «منو نورة» — وهي صوت القراءة المنشورة — تُجاب بالسيرة الذاتية. والسبب أن
     مجموعات النمط كلها اختيارية، فـ«منو» وحدها كانت تكفي. الآن يُشترط أن
     يكون المسؤول عنه هو الدكتور فعلاً، أو أن يُطلب التعريف بلا اسم. */
  [INTENTS.ABOUT_DOCTOR, [/(?:السيره الذاتيه|سيره ذاتيه|سيرتك|سيره الدكتور|نبذه عن (?:الدكتور|د احمد|احمد|الفيلكاوي)|^cv$|^السيره$)/, 0.93],
    [/(?:من هو|مين هو|مين|منو|تعريف|نبذه عن|هويه)\s+(?:(?:ال)?دكتور|د)(?:\s+(?:احمد|الفيلكاوي|احمد الفيلكاوي|حسين الفيلكاوي|احمد حسين الفيلكاوي))?\s*$/, 0.94],
    [/(?:من هو|مين هو|مين|منو|تعريف|نبذه عن|هويه)\s+(?:احمد|الفيلكاوي|احمد الفيلكاوي|حسين الفيلكاوي|احمد حسين الفيلكاوي|صاحب الموقع|صاحب المدونه|كاتب المقالات)\s*$/, 0.94]],
  [INTENTS.CURATED_PICKS, [/(مختارات|المختارات|اختياراتك|ترشيحات|ماذا تقرا|شنو تقرا)/, 0.92]],
  /* داخل الجلسة يريد الناس المزيد والمقارنة والتنقّل — لا أوامر جافّة فقط */
  [INTENTS.MORE_LIKE_THIS, [/^(?:(?:عطني|اعطني|ابي|اريد)\s+)?(?:في\s*)?(غيره|غيرها|زدني|زيدني|كمان|بعد|المزيد|اكثر|شي ثاني|شيء ثاني|في بعد|واحد ثاني|ماده ثانيه)/, 0.93],
    /* «شنو عنده بعد الدكتور؟» «عنده بعد؟» «شنو بعد؟» — طلب المزيد بصياغةٍ سؤالية */
    /* كلمة «المزيد» كانت اختياريةً في آخر النمط، فابتلع كلَّ سؤالٍ عن موضوع:
       «شنو عنده عن الغش» يُقرأ «زدني» فيردّ بمختاراتٍ لا صلة لها بالغش —
       والمقال موجودٌ بعنوانه. الآن لا يُقرأ طلباً للمزيد إلا بلفظٍ صريح،
       و«عن …» تُخرجه صراحةً فيمضي إلى البحث في موضوعه. */
    [/(?!.*\bعن\s)(?:(شنو|وش|ايش)\s*(عنده|عندكم|فيه)\s*(بعد|شي ثاني|ثاني|غيره)|(شنو|وش|ايش)\s*بعد|عنده\s*(شي\s*)?بعد|بعده\s*شي)/, 0.92],
    /* «وين ال٨؟» «وين الباقي؟» «ورني البقية» «وينهم» — بعد أن يقول البوت «عاد
       ٨ مرات» ويعرض الطرفين، يسأل السائل عن البقية. هي «زدني» بصياغةٍ أخرى:
       تُكمِل من الصفّ المحفوظ نفسه لا من بحثٍ جديد. و«وين المصدر» و«وين محاضرتك»
       مُلتقَطتان قبلها في نمطيهما (SOURCE_PROOF/UPCOMING_EVENTS) فلا تتضاربان. */
    [/(?:^|\s)(?:وين|فين|اين)\s*(?:ال)?\s*[\d٠-٩]+|(?:وين|فين|اين|ورني|وريني|عطني|اعرض|شوف|ابي|اريد)\s*(?:لي\s*)?(?:ال)?(?:باقي|بقيه|بقيتها|بقيتهم|باقيها|باقيهم|الباقيات)|^(?:الباقي|الباقيه|البقيه|بقيتها|الباقيات)\s*[؟?]?$|(?:^|\s)(?:وينهم|فينهم)(?:\s|$|[؟?])/, 0.92]],
  [INTENTS.COMPARE, [/(قارن|الفرق بين|ايهما|وش الفرق|مقارنه بين)/, 0.92]],
  [INTENTS.ABOUT_TOPIC, [/(عندك|عندكم|في|لديك)\s*(شي|شيء|مقال|بحث|كتاب|ماده)?\s*(عن|حول|بخصوص)/, 0.90]],
]

const clean = (text) => normalizeArabic(String(text || '').slice(0, MAX_MESSAGE_CHARS))

/* ذاكرة فهمٍ محلية محافظة: لا تكتب جواباً ولا تخمّن معرفة. تحفظ الصيغة التي
   لم تُفهم بعد الإيقاظ، ثم تتعلم «النية» فقط إذا تكررت الصيغة وتبعها أمر واضح
   من النوع نفسه ثلاث مرات. بعد التعلم تمر العبارة بالمحرك القائم الذي لا يجيب
   إلا من فهرس الموقع. لا تُخزَّن العبارة كنص مكشوف؛ تُشفّر داخل قاعدة الماك. */
/* حدُّ الكلمة `\b` لا يعمل مع العربية في جافاسكربت، فكان الحشو لا يُحذف
   قطّ: «ابي مقالة عن الغش» و«مقالة عن الغش» تُحسبان صيغتين مختلفتين، فلا
   يتجمّع لهما تكرارٌ يبلغ عتبة التعلّم. */
const LEARNING_FILLERS = /(?:^|\s)(?:ابي|اريد|ابغي|ممكن|لو سمحت|تكفه|تكفى|عطني|اعطني|ورني|خلني|بس|عاد|يعني|الحين|اليوم)(?=\s|$)/g
const learningCanonical = (value) => clean(value).replace(LEARNING_FILLERS, ' ').replace(/\s+/g, ' ').trim()
const learningKeys = (value) => {
  const normalized = clean(value).replace(/\s+/g, ' ').trim()
  const canonical = learningCanonical(value) || normalized
  return { normalized, canonical, patternHash: hashOpaque(`learn:exact:${normalized}`), canonicalHash: hashOpaque(`learn:canonical:${canonical}`) }
}

/* موضوعٌ تجميعي آمن للفجوة: لا نخزّن أسماءً أو جملاً مكشوفة. نطابق فقط
   قاموس محاور عام ثابت؛ وما لا يطابقه يبقى «موضوع غير مصنّف». بهذه الطريقة
   تستطيع اللوحة قول «الذكاء الاصطناعي تكرر 38 مرة» من دون عرض سؤال أحد. */
const GAP_TOPICS = [
  ['الذكاء الاصطناعي', /(?:ذكاء اصطناعي|الذكاء|ai|شات جي بي تي|chatgpt|روبوت)/],
  ['التقييم والاختبارات', /(?:تقييم|اختبار|امتحان|درجات|قياس|تحصيل)/],
  ['التعليم والتعلّم', /(?:تعليم|تعلم|تدريس|مدرسه|مدرسة|جامعه|جامعة|صف|مناهج)/],
  ['المعلم ودوره', /(?:معلم|مدرس|استاذ|أستاذ|هيئه تدريسيه|هيئة تدريسية)/],
  ['الطالب والمتعلم', /(?:طالب|طلبه|طلاب|متعلم)/],
  ['التقنية والتحول الرقمي', /(?:تقنيه|تقنية|تكنولوجيا|رقمي|منصه|منصة|تطبيق)/],
  ['التربية والأسرة', /(?:تربيه|تربية|اسره|أسرة|والد|ابن|طفل)/],
  ['البحث العلمي', /(?:بحث|دراسه|دراسة|مصدر|مراجع|جامعات|محكم)/],
  ['الكتب والمقالات', /(?:كتاب|كتب|مقال|مقالات|قراءه|قراءة|مؤلف)/],
  ['الإعلام والمجتمع', /(?:اعلام|إعلام|مجتمع|سوشيال|تواصل اجتماعي|منصات)/],
  ['الصوت والبودكاست', /(?:صوت|بودكاست|استماع|حلقه|حلقة)/],
]
function safeGapTopic(value) {
  const domain = sensitiveDomain(value)
  if (domain === 'health') return 'معلومات صحية عامة'
  if (domain === 'law') return 'معلومات قانونية عامة'
  if (domain === 'appointment') return 'تواصل ومواعيد'
  if (domain === 'personal') return 'طلب شخصي يحتاج تدخلاً بشرياً'
  const normalized = clean(value)
  return GAP_TOPICS.find(([, pattern]) => pattern.test(normalized))?.[0] || 'موضوع غير مصنّف'
}

export function recordUnresolvedLearning(db, jid, input, reason = 'unresolved-after-wake') {
  if (!db || !jid || !String(input || '').trim()) return null
  const keys = learningKeys(input)
  if (keys.normalized.length < 2 || keys.normalized.length > 180) return null
  const existingPattern = db.get('SELECT status FROM learning_patterns WHERE pattern_hash=?', keys.patternHash)
  if (existingPattern?.status === 'ignored') return null
  const now = new Date()
  const stamp = now.toISOString()
  const jidKey = db.jidKey(jid)
  db.run('INSERT INTO unresolved_messages(jid,input_hash,text_preview,reason,topic_label,created_at) VALUES(?,?,?,?,?,?)', jidKey, hashOpaque(input), db.encryptText(String(input).slice(0, 180)), reason, safeGapTopic(input), stamp)
  db.run(`INSERT INTO learning_patterns(pattern_hash,canonical_hash,phrase,hits,status,first_seen_at,last_seen_at)
          VALUES(?,?,?,?,?,?,?)
          ON CONFLICT(pattern_hash) DO UPDATE SET hits=hits+1,last_seen_at=excluded.last_seen_at,canonical_hash=excluded.canonical_hash`,
    keys.patternHash, keys.canonicalHash, db.encryptText(String(input).slice(0, 180)), 1, 'observing', stamp, stamp)
  const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  db.run('INSERT INTO learning_pending(jid,pattern_hash,expires_at,created_at) VALUES(?,?,?,?) ON CONFLICT(jid) DO UPDATE SET pattern_hash=excluded.pattern_hash,expires_at=excluded.expires_at,created_at=excluded.created_at', jidKey, keys.patternHash, expires, stamp)
  return keys.patternHash
}

export function confirmPendingLearning(db, jid, intent, at = new Date(), confidence = 1) {
  if (!db || !jid || !LEARNABLE_INTENTS.has(intent) || Number(confidence || 0) < .88) return null
  const jidKey = db.jidKey(jid)
  const pending = db.get('SELECT * FROM learning_pending WHERE jid=?', jidKey)
  if (!pending) return null
  db.run('DELETE FROM learning_pending WHERE jid=?', jidKey)
  if (!pending.expires_at || new Date(pending.expires_at) <= at) return null

  const stamp = at.toISOString()
  const dayKey = stamp.slice(0, 10)
  const inserted = db.run(`INSERT OR IGNORE INTO learning_evidence(pattern_hash,intent,jid_hash,day_key,confirmed_at)
                           VALUES(?,?,?,?,?)`, pending.pattern_hash, intent, jidKey, dayKey, stamp)
  if (!Number(inserted?.changes || 0)) {
    db.addAudit?.('dialect-learning-duplicate-evidence', pending.pattern_hash, `${intent}:${jidKey.slice(0, 10)}:${dayKey}`)
  }

  const evidence = db.all(`SELECT intent,COUNT(*) AS confirmations,COUNT(DISTINCT jid_hash) AS sources,
                           MIN(confirmed_at) AS first_at,MAX(confirmed_at) AS last_at
                           FROM learning_evidence WHERE pattern_hash=?
                           GROUP BY intent ORDER BY confirmations DESC,intent ASC`, pending.pattern_hash)
  for (const row of evidence) {
    db.run(`INSERT INTO learning_votes(pattern_hash,intent,confirmations,last_seen_at) VALUES(?,?,?,?)
            ON CONFLICT(pattern_hash,intent) DO UPDATE SET confirmations=excluded.confirmations,last_seen_at=excluded.last_seen_at`,
      pending.pattern_hash, row.intent, Number(row.confirmations || 0), row.last_at || stamp)
  }

  const top = evidence[0]
  const second = Number(evidence[1]?.confirmations || 0)
  const confirmations = Number(top?.confirmations || 0)
  const sources = Number(top?.sources || 0)
  const firstAt = top?.first_at ? new Date(top.first_at) : at
  const lastAt = top?.last_at ? new Date(top.last_at) : at
  const spanDays = Math.max(0, Math.floor((lastAt.getTime() - firstAt.getTime()) / 86_400_000))
  /* حماية من تلويث الذاكرة: لا تكفي ثلاث نقرات متتالية من الشخص نفسه.
     تعتمد الصياغة بعد ثلاث قرائن عالية الثقة، ومن مصدرين مستقلين على الأقل،
     أو من المصدر نفسه في ثلاثة أيام مختلفة. */
  const evidenceIsIndependent = sources >= 2 || spanDays >= 2
  const learned = confirmations >= 3 && confirmations - second >= 2 && evidenceIsIndependent && LEARNABLE_INTENTS.has(top?.intent)
  db.run('UPDATE learning_patterns SET candidate_intent=?,confirmations=?,status=?,learned_at=CASE WHEN ?=1 THEN COALESCE(learned_at,?) ELSE learned_at END,last_seen_at=? WHERE pattern_hash=?',
    top?.intent || null, confirmations, learned ? 'learned' : 'observing', learned ? 1 : 0, stamp, stamp, pending.pattern_hash)
  if (learned) db.addAudit?.('dialect-pattern-learned', pending.pattern_hash, `${top.intent}:${confirmations}:${sources}:${spanDays}`)
  return { patternHash: pending.pattern_hash, intent: top?.intent || null, confirmations, sources, spanDays, learned, duplicateEvidence: !Number(inserted?.changes || 0) }
}

export function learnedIntentFor(db, text) {
  if (!db) return null
  const keys = learningKeys(text)
  const row = db.get(`SELECT * FROM learning_patterns
                      WHERE status='learned' AND candidate_intent IS NOT NULL
                        AND (pattern_hash=? OR canonical_hash=?)
                      ORDER BY CASE WHEN pattern_hash=? THEN 0 ELSE 1 END, confirmations DESC LIMIT 1`,
    keys.patternHash, keys.canonicalHash, keys.patternHash)
  if (!row || !LEARNABLE_INTENTS.has(row.candidate_intent)) return null
  return { intent: row.candidate_intent, confidence: Math.min(.94, .82 + Math.min(12, Number(row.confirmations || 0)) * .01), normalized: keys.normalized, learned: true, learningPatternId: row.id }
}
const compactPhone = (value = '') => String(value).replace(/[^\d]/g, '')
const jidAccount = (jid = '') => String(jid).split('@')[0].toLowerCase()

/* منفذ «اكتب المصطلح فقط» مفيد، لكن بحث FTS الواسع ليس دليلاً على القصد:
   «شكراً» و«أنا بخير» تظهران داخل أجسام المقالات أيضاً. نسمح هنا بعبارة اسمية
   قصيرة تطابق العنوان/التصنيف نفسه، ونرفض ضمائر الحديث والمجاملات والأفعال
   اليومية. أما السؤال الصريح «عندك شيء عن…» فله نيّة مستقلة أوسع. */
const CHATTER_OR_PERSONAL = /(?:^|\s)(?:انا|اني|انت|انتي|انتو|احنا|نحن|توني|تو|وصلت|رحت|جيت|شكرا|شكراً|مشكور|تمام|اوكي|حبيبي|حبيبتي|مرحبا|هلا|السلام|وعليكم|صباح|مساء|بخير|شلونك|كيفك|وينك|مع السلامه|عمرك|عمره|تسكن|يسكن|ساكن|متزوج|اطفالك|عيالك|راتبك|رقمك|عنوانك|ايميلك|بريدك)(?:\s|$)|\b(?:i|im|am|my|me|we|you|your|thanks?|hello|hi|okay|fine|home|arrived|love)\b/i

/* ═══ التصحيح: حين يقول السائل «مو صح» أو «مو عن كذا» أو «لا، أقصد كذا» ═══
   كان «هذا» في «هذا مو صح» يخطف الرسالة إلى «اعرض الحالي» فيكرّر ما رُفض. نلتقط
   التصحيح صراحةً قبل مرجع السياق. والالتقاط محصورٌ بعلاماتٍ صريحة كي لا يبتلع
   سؤالاً فيه «مو» عابرة أو «غلط» داخل استفهام. */
const CORRECTION_MARK = /(?:^|\s)(?:مو\s*صح|مب\s*صح|مو\s*صحيح|مو\s*صحيحه|غير\s*صحيح|مو\s*هذا|مو\s*هذي|مو\s*ذا|مو\s*هو|مو\s*هي|مو\s*المقصود|مو\s*قصدي|ما\s*اقصد|ماقصد|لا\s*اقصد|ليس\s*هذا|مب\s*هذا|مو\s*ذي)(?:\s|$)/
const CORRECTION_BARE = /^(?:لا+\s*[،,]?\s*)?(?:غلط|خطا|خطأ|غير صحيح|مو صح|مب صح|مو صحيح|مو مضبوط|مب مضبوط)\s*[،,.!؟?]*\s*$/
const CORRECTION_NOT_ABOUT = /(?:مو|مب|ليس|مش|مهو|ماهو)\s*عن\s+(.+)$/
const CORRECTION_MEANT = /(?:^|\s)(?:اقصد|قصدي|قصدت|بل|انما|ابي|اريد|ابغي|ابغى)\s+(?:عن\s+)?(.+)$/

const cleanTopic = (raw) => clean(raw)
  .replace(/[؟?!.،,]+$/g, '')
  .replace(/^(?:شي|شيء|مقال|مقاله|بحث|كتاب|ماده|مادة|موضوع)\s+(?:عن|حول|بخصوص)?\s*/,'')
  .replace(/\s+/g, ' ')
  .trim()

/* يُرجِع { isCorrection, topic } — topic هو الموضوع الجديد إن ذُكر (يريده السائل)،
   وإلا null (رفضٌ مجرّد ننتقل عنده للمرشّح التالي). «مو عن X» تعني: النتيجة ليست
   عن X وهو ما أراده — فنبحث X. */
function detectCorrection(value) {
  const v = String(value || '')
  const notAbout = CORRECTION_NOT_ABOUT.exec(v)
  if (notAbout) {
    /* «مو عن الامتحانات» نفيٌ لا طلب: الملتقَط هو ما رفضه السائل، وكان يُعاد
       بحثاً عنه — فيردّ البوت بما رُفض للتوّ. فإن ذكر مقصوده صراحةً («مو عن
       كذا، أقصد كذا») أخذنا المقصود؛ وإلا فهو استبعادٌ لا موضوع. */
    const meantToo = CORRECTION_MEANT.exec(v)
    if (meantToo) return { isCorrection: true, topic: cleanTopic(meantToo[1]) || null, notTopic: cleanTopic(notAbout[1]) || null }
    return { isCorrection: true, topic: null, notTopic: cleanTopic(notAbout[1]) || null }
  }
  if (CORRECTION_BARE.test(v)) return { isCorrection: true, topic: null }
  if (CORRECTION_MARK.test(v)) {
    const meant = CORRECTION_MEANT.exec(v)
    return { isCorrection: true, topic: meant ? (cleanTopic(meant[1]) || null) : null }
  }
  const meantOnly = /^لا+\s*[،,]?\s*(?:اقصد|قصدي|بل|انما)\s+(.+)$/.exec(v)
  if (meantOnly) return { isCorrection: true, topic: cleanTopic(meantOnly[1]) || null }
  return { isCorrection: false, topic: null }
}

function stripGroundedTopicRequest(value) {
  /* قشر المحادثة الطبيعية قبل البحث: «هل تكلم الدكتور عن موضوع الطفل؟»
     جوهرها «الطفل». كانت أصداف السؤال (هل/تكلم/الدكتور/عن/موضوع) تُحسب
     كلماتِ موضوعٍ فيفشل التأريض ويصمت البوت داخل جلسة مستيقظة — وهو أصل
     شكوى «يسكت وما يكمل». القشر محصور بألفاظ الصدفة المعجمية وحدها،
     وكل ما بعده يمر بالبوابات القائمة نفسها بلا أي تغيير في القواعد. */
  return clean(value)
    .replace(/[؟?!]+/g, ' ')
    .replace(/^(?:ابي|اريد|ابغي|عطني|اعطني|هات|ممكن)\s+/, '')
    .replace(/^(?:شي|شيء|ماده)\s+(?:عن|حول|بخصوص)\s+/, '')
    .replace(/(?:^|\s)(?:هل|وش|شنو|ايش)(?=\s)/g, ' ')
    .replace(/(?:^|\s)(?:تكلم|يتكلم|تحدث|يتحدث|حكه|حكي|يحكي|كتب|يكتب|قال|يقول|تطرق|يتطرق|ناقش|يناقش|تناول|يتناول|طرح|يطرح|غطه|يغطي)(?=\s)/g, ' ')
    .replace(/(?:^|\s)(?:رايه|رايك|رايكم|موقفه|نظرته|قوله)(?=\s)/g, ' ')
    .replace(/(?:^|\s)(?:الدكتور|دكتور|احمد|الفيلكاوي)(?=\s|$)/g, ' ')
    /* «عن بعد» مركّبٌ اصطلاحي (التعليم عن بعد) — لا يُقشر «عن» قبله */
    .replace(/(?:^|\s)عن(?=\s)(?!\s*بعد)/g, ' ')
    .replace(/(?:^|\s)(?:في|حول|بخصوص)(?=\s)/g, ' ')
    .replace(/(?:^|\s)(?:موضوع|مواضيع|قضيه|قضايا|مساله|مسائل)(?=\s)/g, ' ')
    .replace(/\s+لو سمحت$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/* سؤال تغطية: «هل تكلم/كتب/تطرق … عن …؟» — يستحق جواباً يبدأ بنعم الموثقة. */
function isCoverageQuestion(normalized = '') {
  return /(?:^|\s)هل(?:\s|$)/.test(normalized)
    && /(?:تكلم|يتكلم|تحدث|يتحدث|كتب|يكتب|قال|تطرق|يتطرق|ناقش|تناول|طرح|غطه)/.test(normalized)
}

/* مسح اسمي مباشر: الفهرس صغير (~200 مادة)، فمسحه المطبّع أدقّ من ترتيب FTS
   في المطابقات الاسمية الصريحة — «التعليم عن بعد» يجب أن يجد «الخطط البديلة
   للتعليم عن بعد» ولو تصدّرت المشابهات الدلالية نتائج البحث النصي. */
function namedContentMatches(db, words, limit = 3) {
  if (!words.length || words.length > 4) return []
  const rows = db.all("SELECT * FROM content_items ORDER BY date DESC") || []
  return rows
    .filter((item) => {
      const named = clean(`${item.title || ''} ${item.keywords || ''}`)
      return words.every((word) => named.includes(word))
    })
    .slice(0, limit)
}


/* ═══ «البوت لا يصمت» (أمر الدكتور ٢٠٢٦-٠٧-٢٣) ═══
   كل مسارٍ كان يسكت صار يجيب بصدقٍ مسنَد: «لعلك تقصد…» بمواد حقيقية من
   الفهرس، أو أبواب الأرشيف الفعلية — بلا تأليف حرفٍ واحد. الصمت الوحيد
   الباقي في المنظومة: تدخل الدكتور اليدوي في المحادثة (manual-takeover). */
function archiveDoors(db, limit = 6) {
  const rows = db.all("SELECT keywords, COUNT(*) AS n FROM content_items WHERE keywords IS NOT NULL AND keywords != '' GROUP BY keywords ORDER BY n DESC") || []
  const doors = []
  for (const row of rows) {
    const first = String(row.keywords || '').trim().split(/\s+/)[0]
    if (first && !doors.includes(first)) doors.push(first)
    if (doors.length >= limit) break
  }
  return doors
}

/* التسامح الإملائي (أمر «يفهم كل شيء»): «التعلليم» تجد «التعليم» —
   مسافة تحرير ≤2 على مفردات الفهرس الحقيقية، لا تخمين خارجها */
function editDistance(left, right) {
  if (Math.abs(left.length - right.length) > 2) return 3
  const rows = Array.from({ length: left.length + 1 }, (_, i) => [i, ...Array(right.length).fill(0)])
  for (let j = 1; j <= right.length; j += 1) rows[0][j] = j
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
    }
  }
  return rows[left.length][right.length]
}

function indexVocabulary(db) {
  const rows = db.all("SELECT title, keywords FROM content_items") || []
  const vocabulary = new Set()
  for (const row of rows) {
    for (const word of clean(`${row.title || ''} ${row.keywords || ''}`).split(/\s+/)) {
      if (word.length >= 4) vocabulary.add(word)
    }
  }
  return [...vocabulary]
}

function repairTypos(db, words) {
  const vocabulary = indexVocabulary(db)
  let repaired = false
  const output = words.map((word) => {
    if (word.length < 4 || vocabulary.includes(word)) return word
    let best = null
    for (const candidate of vocabulary) {
      const distance = editDistance(word, candidate)
      if (distance <= 2 && (!best || distance < best.distance)) best = { candidate, distance }
      if (best?.distance === 1) break
    }
    if (best) { repaired = true; return best.candidate }
    return word
  })
  return { words: output, repaired }
}

function nearestSuggestions(db, rawText, limit = 3) {
  const normalized = stripGroundedTopicRequest(rawText)
  const words = normalized.split(/\s+/).filter((word) => word.length > 1)
  let found = words.length ? namedContentMatches(db, words.slice(0, 4), limit) : []
  if (!found.length && normalized) found = searchContent(db, normalized, { limit })
  if (!found.length) {
    for (const word of words) {
      const single = namedContentMatches(db, [word], limit)
      if (single.length) { found = single; break }
    }
  }
  /* الملاذ الإملائي: أصلح الكلمات على مفردات الفهرس ثم أعد المحاولة */
  if (!found.length && words.length) {
    const repair = repairTypos(db, words.map((word) => clean(word)))
    if (repair.repaired) {
      found = namedContentMatches(db, repair.words.slice(0, 4), limit)
      if (!found.length) found = searchContent(db, repair.words.join(' '), { limit })
      if (!found.length) {
        for (const word of repair.words) {
          const single = namedContentMatches(db, [word], limit)
          if (single.length) { found = single; break }
        }
      }
    }
  }
  return found.slice(0, limit)
}

/* التحية والشكر بعد الإيقاظ كانتا تُقابلان بـ«سؤالك خارج المحتوى المنشور» —
   وهو أبردُ ما يُقال لمن سلّم أو شكر. هذه مجاملةٌ قصيرة بتوقيت الكويت، لا
   تنسب رأياً ولا تفتح باباً جديداً، ثم تدلّه على ما يقدر عليه. */
const PURE_GREETING = /^(?:يا\s*)?(?:السلام عليكم(?:\s*ورحمه الله(?:\s*وبركاته)?)?|وعليكم السلام|هلا(?:\s*والله)?|هلا فيك|مرحبا|اهلا(?:\s*وسهلا)?|صباح الخير|صباح النور|مساء الخير|مساء النور|حياك الله|سلام)[\s.!؟]*$/
const PURE_THANKS = /^(?:جزاك الله خير(?:ا)?|الله يعطيك العافيه|يعطيك العافيه|تسلم(?:ين)?|شكرا(?:\s*لك|\s*جزيلا)?|مشكور(?:ين)?|ممتاز|تمام|احسنت|الله يوفقك|ما قصرت)[\s.!؟]*$/
function courtesyReply(input, at = new Date()) {
  const value = clean(input)
  if (PURE_GREETING.test(value)) {
    /* ردّ التحية بجنسها: السلام يُردّ سلاماً، وما عداه يُقابل بتحية الوقت. */
    const salam = /سلام/.test(value)
    const head = salam ? 'وعليكم السلام ورحمة الله' : timeGreeting(at)
    return { text: `${head} · أنا وكيل موقع د. أحمد حسين الفيلكاوي، وأفتح لك ما نُشر فيه.\nتقدر تقول: بوابة اليوم · آخر مقالاته · عندك شيء عن أي موضوع؟` }
  }
  if (PURE_THANKS.test(value)) {
    return { text: 'الله يعافيك، وهذا واجبي. متى ما بغيت مادة أو موضوعاً فأنا حاضر — قل: بوابة اليوم، أو اذكر الموضوع بلفظه.' }
  }
  return null
}

function noSilenceReply(db, rawText, { offDomain = false } = {}) {
  if (!offDomain) {
    const near = nearestSuggestions(db, rawText, 3)
    if (near.length) {
      return {
        needsHuman: false,
        text: `ما وجدت هذا الموضوع بهذا اللفظ في الموقع. لعلك تقصد:\n${near.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nتقدر تقول: لخّص الأولى، أو اسمعني الثانية — أو اذكر الموضوع بكلمةٍ أخرى.`,
        contextItems: near.map((item) => item.id),
        seenContentIds: near.map((item) => item.id),
        replaceContextList: true,
      }
    }
  }
  const doors = archiveDoors(db)
  const MSG = getBotMessages()
  const doorsLine = doors.length ? `\n${MSG.doorsPrefix}${doors.join(' · ')}.` : ''
  return {
    needsHuman: false,
    text: offDomain
      ? `${MSG.notPublishedReached}${doorsLine}\n${MSG.notPublishedReachedCta}`
      : `${MSG.notPublishedNew}${doorsLine}\n${MSG.notPublishedNewCta}`,
  }
}

/* إنقاذٌ مسنَد (أمر الدكتور: «خل يحاول يبحث من قاعدة البيانات ويجاوب بدل الصمت»):
   حين يُسقط حارسُ المصدر جواباً طموحاً — استشهادٌ لم يُتحقَّق — لا نصمت في وجه
   سؤالٍ عن موضوعٍ منشور، بل نردّ بأقرب موادّ الدكتور الحقيقية (عناوين وروابط من
   الأرشيف، يستحيل أن تكون مؤلَّفة). ويبقى الصمتُ لِما هو شخصيٌّ أو إنسانيٌّ أو
   خارج النطاق: هناك لا رابطَ يليق، والتحويلُ للدكتور أرحم من ردٍّ بارد.
   يُرجِع null حين لا يليق ردٌّ مسنَد — فيُبقي المتّصلُ صمتَه المقصود. */
export function groundedRescue(db, rawText) {
  const normalized = clean(rawText || '')
  if (!normalized || CHATTER_OR_PERSONAL.test(normalized)) return null
  const query = stripGroundedTopicRequest(normalized)
  const words = query.split(/\s+/).filter((word) => word.length > 2)
  if (!words.length) return null
  const results = searchContent(db, query, { limit: 4 })
  const onDomain = results.filter((item) => {
    const named = clean(`${item.title || ''} ${item.keywords || ''}`)
    return words.some((word) => named.includes(word))
  })
  /* قبل «هذي أقرب موادّه»: هل قالها الدكتور بصوته في حلقة؟ نصوص المجلس موقّتة
     بالثانية، فالجملة نفسها أصدق من قائمة روابط — ورابطُها يفتح الحلقة عند
     اللحظة التي قيلت فيها. ولا يُرسَل صوتٌ في الرسالة: الجملةُ والرابط فقط. */
  const spoken = spokenReply(query)
  if (spoken) {
    const nearest = (onDomain.length ? onDomain : namedContentMatches(db, words, 2)).slice(0, 2)
    const reading = nearest.map((item) => item.title + '\n' + item.url).join('\n\n')
    return {
      text: nearest.length ? spoken.text + '\n\nوللقراءة:\n' + reading : spoken.text,
      contentId: nearest[0]?.id,
      contextItems: nearest.map((item) => item.id),
      seenContentIds: nearest.map((item) => item.id),
    }
  }
  /* ثم كتبه: إن لم يقلها بصوته في حلقة، فقد يكون كتبها في أحد كتبه التسعة.
     جملةٌ من متنه منسوبةً إلى صفحتها أصدق من قائمة روابط — والرابط يفتح
     صفحة الكتاب لا ملفه. */
  const fromBook = bookQuoteReply(query)
  if (fromBook) {
    const nearest = (onDomain.length ? onDomain : namedContentMatches(db, words, 2)).slice(0, 2)
    const reading = nearest.map((item) => item.title + '\n' + item.url).join('\n\n')
    return {
      text: nearest.length ? fromBook.text + '\n\nوللقراءة:\n' + reading : fromBook.text,
      contentId: nearest[0]?.id,
      contextItems: nearest.map((item) => item.id),
      seenContentIds: nearest.map((item) => item.id),
    }
  }

  const chosen = onDomain.length ? onDomain : namedContentMatches(db, words, 3)
  if (!chosen.length) return null
  const choices = chosen.slice(0, 3)
  return {
    text: `ما عندي جوابٌ محرَّرٌ جاهزٌ بهذا، لكن هذي أقربُ موادّ الدكتور المنشورة لسؤالك:\n${choices.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nقل «لخّص الأولى» أو «اسمعني الثانية».`,
    contentId: choices[0].id,
    contextItems: choices.map((item) => item.id),
    seenContentIds: choices.map((item) => item.id),
  }
}

function isGroundedTopicPhrase(db, text) {
  const normalized = stripGroundedTopicRequest(text)
  const words = normalized.split(/\s+/).filter((word) => word.length > 1)
  if (!words.length || words.length > 4 || CHATTER_OR_PERSONAL.test(normalized)) return false
  const candidates = searchContent(db, normalized, { limit: 6 })
  const grounded = candidates.some((item) => {
    const namedFields = clean(`${item.title || ''} ${item.keywords || ''}`)
    return words.every((word) => namedFields.includes(word))
  })
  return grounded || namedContentMatches(db, words, 1).length > 0
}

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
  /* الخصوصية وكلمة الدخول أعلى من أي تحليل سياقي. «أبي أرجع» مثلاً أمر
     استئناف، لا «ارجع إلى النتيجة السابقة». */
  for (const [intent, ...rules] of patterns.slice(0, 4)) {
    for (const [regex, confidence] of rules) if (regex.test(value)) return { intent, confidence, normalized: value }
  }
  /* خيارات الزمن الظاهرة في رسالة الترحيب أفعالٌ على المادة الحالية. نفحصها
     قبل المحلل المركّب لأن كلمات التلطيف مثل «خلها» قد تبدو له موضوعاً. */
  for (const [intent, ...rules] of patterns) {
    if (intent !== INTENTS.READ_SPEED) continue
    for (const [regex, confidence] of rules) if (regex.test(value)) return { intent, confidence, normalized: value }
  }
  /* التصحيح يعلو على مرجع «الحالي»: «هذا مو صح» كان «هذا» فيه يخطفه إلى «اعرض
     الحالي» فيكرّر ما رفضه السائل. لكنه يتنحّى أمام تنقّلٍ صريح: «مو هذا اللي
     بعده» ليست تصحيحاً بل انتقالٌ للتالي — «بعده/قبله/الترتيب» هي الأمر الفعلي. */
  const correction = detectCorrection(value)
  if (correction.isCorrection) {
    const navProbe = parseCompoundRequest(value)
    const isNavigation = navProbe.reference === 'next' || navProbe.reference === 'previous' || navProbe.ordinal !== null
    if (!isNavigation) {
      return { intent: INTENTS.CORRECTION, confidence: 0.9, normalized: value, correction }
    }
  }
  const parsedRequest = parseCompoundRequest(value)
  /* أسماء المالك/النوع ليست موضوع بحث: كان «آخر مقالاته» يبحث عن كلمة
     «مقالاته»، و«كتب الدكتور» عن «الدكتور»، فيضيع الأمر الأساسي. */
  const genericTopic = /^(?:الدكتور|د احمد|احمد|الفيلكاوي|مقالاته|مقالات الدكتور|كتب الدكتور|ابحاث الدكتور)$/
  const voiceOnlyTopic = Boolean(parsedRequest.voice && /^(?:نوره|نورا|فهد|الرجل|رجل|المراه|امراه|الحوار|حوار)$/.test(parsedRequest.topic || ''))
  const topicIsNoise = genericTopic.test(parsedRequest.topic || '') || voiceOnlyTopic
  const request = topicIsNoise
    ? {
        ...parsedRequest,
        topic: null,
        reference: parsedRequest.action && !parsedRequest.kind && !parsedRequest.latest ? 'current' : parsedRequest.reference,
      }
    : parsedRequest
  const STANDALONE_INTENTS = new Set([
    INTENTS.SAVE_CONTENT,
    INTENTS.REMOVE_SAVED,
    INTENTS.LIST_SAVED,
    INTENTS.STOP_MESSAGES,
    INTENTS.RESUME_MESSAGES,
    INTENTS.DELETE_PREFERENCES,
    INTENTS.WELCOME,
    INTENTS.BOOK_SEARCH,
    INTENTS.BOOK_VIDEOS,
    INTENTS.MEDIA_LIBRARY,
    INTENTS.RADIO,
    INTENTS.DIALOGUE_LIBRARY,
  ])

  let directMatch = null
  for (const [intent, ...rules] of patterns.slice(4)) {
    for (const [regex, confidence] of rules) {
      if (regex.test(value)) {
        directMatch = { intent, confidence, normalized: value }
        break
      }
    }
    if (directMatch) break
  }

  if (directMatch && STANDALONE_INTENTS.has(directMatch.intent)) {
    return directMatch
  }

  /* أفعال المتابعة الصريحة أقوى من الضمير السياقي. «لخّصها» فيها مرجع للحالية
     فعلاً، لكن مقصدها التلخيص لا إعادة عرض المادة. تقديم CONTEXT_REFERENCE هنا
     كان يجعل المحادثة تبدو عالقة بعد الرد الأول. */
  const CONTEXT_ACTION_INTENTS = new Set([
    INTENTS.SUMMARY,
    INTENTS.CONTINUE_READING,
    INTENTS.ONE_MINUTE,
    INTENTS.READ_SPEED,
    INTENTS.SOURCE_PROOF,
    INTENTS.READ_ARTICLE,
    INTENTS.LISTEN_FAHED,
    INTENTS.LISTEN_NOURA,
    INTENTS.LISTEN_DIALOGUE,
    INTENTS.MORE_LIKE_THIS,
    INTENTS.SIMILAR_CONTENT,
    INTENTS.EXPLAIN_MODE,
    INTENTS.DIALOGUE_MODE,
    INTENTS.QUOTE,
    INTENTS.QUOTE_CARD,
  ])
  const orderedReference = Number.isInteger(request.ordinal)
    || request.reference === 'next'
    || request.reference === 'previous'
  if (directMatch && CONTEXT_ACTION_INTENTS.has(directMatch.intent) && !orderedReference) return directMatch

  /* «عطني المقالات» و«ورني كتبه» قد يقرأهما المحلل السياقي كإشارةٍ إلى
     «الحالي» بسبب أداة الطلب. أمر النوع الصريح أقوى من هذا الضمير المصطنع،
     إلا إذا ذكر السائل ترتيباً حقيقياً مثل «الثانية». */
  const compoundCapableDirectIntents = new Set([
    INTENTS.LATEST_ARTICLE,
    INTENTS.LATEST_ARTICLES,
    INTENTS.LATEST_BOOK,
    INTENTS.LATEST_PAPER,
    INTENTS.LATEST_PODCAST,
    INTENTS.LATEST_SELECTION,
  ])
  if (directMatch && compoundCapableDirectIntents.has(directMatch.intent) && !orderedReference && !request.duration && !request.voice && !request.topic) return directMatch

  if (request.reference && !request.more) {
    return { intent: INTENTS.CONTEXT_REFERENCE, confidence: 0.97, normalized: value, request }
  }

  if (directMatch) return directMatch
  /* الطلب المركّب يعلو على أمر النوع فقط عندما يضيف قيداً حقيقياً (موضوعاً أو
     مدةً أو صوتاً). أما «الأكثر مشاهدة» و«أبرز موضوع» ونحوها فهي أوامر دقيقة
     بذاتها، فلا يجوز أن يحوّلها وجود كلمة «مقال» إلى بحث مركّب. */
  if (directMatch && !compoundCapableDirectIntents.has(directMatch.intent)) return directMatch
  if ((request.duration || request.voice) && (request.kind || request.topic || request.latest)) {
    return { intent: INTENTS.COMPOUND_REQUEST, confidence: 0.95, normalized: value, request }
  }
  if (request.topic && request.kind) return { intent: INTENTS.COMPOUND_REQUEST, confidence: 0.94, normalized: value, request }
  if (directMatch) return directMatch
  /* المنفذ الأخير: ما لم يطابق نمطاً يُعامَل بحثاً عن موضوع. ويُوسَم `fallback`
     لأنه ليس فهماً بل تخميناً — وداخل الجلسة المفتوحة كان هذا التخمين يبتلع
     كلَّ ما يُكتب، ومنه ما ليس سؤالاً أصلاً. فالبوّابة تعرفه الآن وتردّه. */
  if (value.length >= 3) return { intent: INTENTS.SEARCH_TOPIC, confidence: 0.72, normalized: value, fallback: true }
  return { intent: INTENTS.UNKNOWN, confidence: 0.2, normalized: value }
}

export function classifyIntentWithLearning(db, text) {
  const base = classifyIntent(text)
  if (!base.fallback && base.intent !== INTENTS.UNKNOWN && base.confidence >= .7) return base
  return learnedIntentFor(db, text) || base
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
    if (!results.length) return { intent: 'CUSTOM_RULE', confidence: 0.72, ruleId: rule.id, ruleName: rule.name, ...noSilenceReply(db, query) }
    return {
      intent: 'CUSTOM_RULE',
      confidence: 0.94,
      ruleId: rule.id,
      ruleName: rule.name,
      text: results.map((item, index) => `${index + 1}. ${item.title}\n${contentSummary(item, 1)}\n${item.url}`).join('\n\n'),
      contentId: results[0].id,
      contextItems: results.map((item) => item.id),
      seenContentIds: results.map((item) => item.id),
    }
  }
  /* لا تُرسل القواعد الحرة كلاماً مؤلفاً. التحويل والنص الحر يتركان الرسالة
     للدكتور بصمت؛ أما الرد الآلي فمصدره فهرس الموقع وحده. */
  return { intent: 'CUSTOM_RULE', confidence: 0.99, needsHuman: true, ruleId: rule.id, ruleName: rule.name, text: getBotMessages().humanHandoff }
}

const itemLink = (item) => item ? `\n${item.title}\n${item.url}` : ''
const audioLinks = (item) => {
  if (!item?.audio) return []
  const links = []
  const base = AUDIO_PUBLIC_BASE_URL
  /* خارج صفحة المقال نُظهر هوية المسارات الصوتية صراحةً للإدارة وواتساب.
     الاستثناء الوحيد هو مشغّل المقال العام نفسه، حيث تبقى التسمية «قراءة المقال». */
  if (item.audio.noura) links.push(`صوت نورة: ${base ? `${base}/${item.slug}.noura.mp3` : item.url}`)
  if (item.audio.fahed) links.push(`صوت فهد: ${base ? `${base}/${item.slug}.mp3` : item.url}`)
  if (item.audio.dialogue) links.push(`الحوار: ${base ? `${base}/${item.slug}.dialogue.mp3` : item.url}`)
  return links
}

function contentReply(label, item, extra = '') {
  if (!item) return { text: getBotMessages().noMatch }
  return { text: `${label}:\n${item.title}${item.date ? ` · ${item.date}` : ''}\n${item.excerpt || contentSummary(item, 1)}\n${item.url}${extra}`, contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], actions: audioLinks(item) }
}

function latestOf(db, kind, label) { return contentReply(label, latestContent(db, kind, 1)[0]) }

const KIND_LABEL = Object.freeze({ article: 'مقال', paper: 'بحث', book: 'كتاب', podcast: 'حلقة', curated: 'مختارة' })

function conciseItem(item, prefix = '') {
  if (!item) return ''
  const date = item.date ? ` · ${item.date}` : ''
  return `${prefix}${item.title}${date}
${item.url}`
}

function latestArticlesReply(db, limit = 3) {
  const items = latestContent(db, 'article', limit)
  if (!items.length) return { text: 'لا توجد مقالات منشورة في الفهرس الآن.' }
  return {
    text: `هذه أحدث ${items.length === 1 ? 'مقالة' : 'مقالات'} للدكتور:
${items.map((item, index) => `${index + 1}. ${conciseItem(item)}`).join('\n\n')}

تقدر تقول: لخّص الأولى، أو عندك شيء عن موضوع معيّن؟`,
    contentId: items[0].id,
    contextItems: items.map((item) => item.id),
    seenContentIds: items.map((item) => item.id),
  }
}

function freshContentReply(db) {
  /* نختار جديداً متنوعاً لا قائمةً كلها مقالات: أحدث مقالتين، ثم أحدث مادة
     مختلفة متاحة. كل سطر من فهرس الموقع، ولا توجد معلومة مُنشأة من الخارج. */
  const articles = latestContent(db, 'article', 2)
  const different = ['paper', 'podcast', 'book'].map((kind) => latestContent(db, kind, 1)[0]).filter(Boolean)
  const items = [...articles, ...different].slice(0, 5)
  if (!items.length) return { text: 'لا توجد مواد منشورة في الفهرس الآن.' }
  return {
    text: `الجديد الآن في مكتبة الدكتور:
${items.map((item, index) => `${index + 1}. ${KIND_LABEL[item.kind] || 'مادة'} — ${conciseItem(item)}`).join('\n\n')}

وتقدر تسألني بطريقتك: آخر مقالاته، مادة في دقيقة، أو عنده شيء عن أي موضوع.`,
    contentId: items[0].id,
    contextItems: items.map((item) => item.id),
    seenContentIds: items.map((item) => item.id),
  }
}

function latestPodcastReply(db) {
  const publishedEpisode = latestContent(db, 'podcast', 1)[0]
  if (publishedEpisode) return contentReply('أحدث حلقة', publishedEpisode)

  /* لا توجد صفحة بودكاست مستقلة في الموقع الآن، لكن توجد «حلقات حوارية»
     منشورة داخل مشغّل المقالات. سؤال «آخر بودكاست» يجب أن يصل إليها بدل أن
     يسمع الزائر «ما لقيت» وفي الموقع صوت حواري منشور فعلاً. */
  const item = latestAudioContent(db, 'dialogue', 1)[0]
  if (!item) {
    return { text: 'لا توجد حلقة حوارية منشورة في فهرس الموقع الآن. أقدر أعطيك أحدث مقال صوتي أو أحدث مقالة.' }
  }
  const dialogue = audioLinks(item).find((line) => line.startsWith('الحوار:'))
  return {
    text: `أحدث حلقة حوارية منشورة من الموقع:
${item.title}${item.date ? ` · ${item.date}` : ''}
${contentSummary(item, 1)}
${item.url}#article-audio${dialogue ? `

${dialogue}` : ''}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    actions: audioLinks(item),
  }
}

function commandTopic(input, commandPattern) {
  return clean(input)
    .replace(commandPattern, '')
    .replace(/^(?:عن|حول|بخصوص)\s+/, '')
    .replace(/[؟?!.،,]+$/g, '')
    .trim()
}

/* «ابحث داخل الكتاب» بوابةٌ لا موضوع. وإن أكمل السائل سؤاله في الجملة نفسها
   نجيبه من corpus الكتب الموثّق، ثم نفتح له الأداة على الكتاب الذي جاء منه
   الاقتباس. لا يعود هذا الطلب إلى بحث المقالات إطلاقاً. */
function bookNamedInRequest(db, input, current = null) {
  const normalized = clean(input)
  const books = db.all("SELECT * FROM content_items WHERE kind='book'") || []
  const named = books
    .map((book) => ({ book, title: clean(book.title || '') }))
    .filter(({ title }) => title && normalized.includes(title))
    .sort((left, right) => right.title.length - left.title.length)[0]?.book
  return named || (current?.kind === 'book' ? current : null)
}

function bookSearchGatewayReply(db, input, current = null) {
  const book = bookNamedInRequest(db, input, current)
  let topic = commandTopic(input, /^(?:(?:ابي|اريد|ابغي|ابغى|ممكن)\s+)?(?:(?:ابحث|بحث|دور|فتش)\s*(?:لي\s*)?(?:داخل|في)\s*(?:ال)?كتاب|(?:اسال|اسأل)\s*(?:ال)?كتاب)\s*/)
  if (book) topic = clean(topic).replace(clean(book.title || ''), '').replace(/^(?:عن|حول|بخصوص)\s+/, '').trim()
  if (topic) {
    const slug = book?.slug || String(book?.id || '').replace(/^book:/, '')
    const grounded = bookQuoteReply(topic, slug ? { bookSlug: slug } : {})
    if (grounded?.found) {
      const bookUrl = `${SITE_URL}/search?tab=askbook&book=${encodeURIComponent(grounded.found.bookSlug)}`
      return {
        text: `${grounded.text}\n\nوللبحث أكثر في متن الكتاب نفسه:\n${bookUrl}`,
        contextItems: [`book:${grounded.found.bookSlug}`],
        seenContentIds: [`book:${grounded.found.bookSlug}`],
      }
    }
    return {
      text: `لم أجد مقطعاً موثقاً كافياً لهذا السؤال ${book ? `داخل «${book.title}»` : 'داخل متون الكتب'}، لذلك لن أنسب للدكتور جواباً غير موجود.\n\nاكتب سؤالك داخل أداة «اسأل كتاباً»${book ? '' : ' واختر الكتاب'}:\n${SITE_URL}/search?tab=askbook${book ? `&book=${encodeURIComponent(slug)}` : ''}`,
      ...(book ? { contentId: book.id, contextItems: [book.id], seenContentIds: [book.id] } : {}),
    }
  }

  if (book) {
    const slug = book.slug || String(book.id || '').replace(/^book:/, '')
    return {
      text: `أنا داخل كتاب «${book.title}» الآن. اكتب سؤالك بطريقتك — مثلاً: «ماذا يقول عن المعلم؟» — وأبحث لك في متنه الموثّق، لا في المقالات.\n${SITE_URL}/search?tab=askbook&book=${encodeURIComponent(slug)}`,
      contentId: book.id, contextItems: [book.id], seenContentIds: [book.id],
    }
  }

  const books = latestContent(db, 'book', 3)
  return {
    text: `أكيد. هذا بحثٌ داخل متن الكتاب نفسه، لا داخل المقالات.\n\nاختر الكتاب ثم اكتب سؤالك بطريقتك:\n${SITE_URL}/search?tab=askbook${books.length ? `\n\nومن الكتب المتاحة:\n${books.map((item) => `• ${item.title}`).join('\n')}` : ''}`,
    contextItems: books.map((item) => item.id),
    seenContentIds: books.map((item) => item.id),
  }
}

function bookChaptersGatewayReply(db, input, current = null) {
  const book = bookNamedInRequest(db, input, current)
  if (!book) {
    const books = db.all("SELECT * FROM content_items WHERE kind='book'") || []
    return {
      text: `أي كتاب تقصد؟ اكتب اسمه، مثل: «فصول المدارس الذكية».\n\nالكتب المتاحة:\n${books.slice(0, 9).map((item) => `• ${item.title}`).join('\n')}\n\n${SITE_URL}/publications`,
      contextItems: books.map((item) => item.id), seenContentIds: books.map((item) => item.id),
    }
  }
  const slug = book.slug || String(book.id || '').replace(/^book:/, '')
  const chapters = bookChaptersReply(slug)
  if (!chapters) return { text: `لم أجد فهرساً موثقاً لهذا الكتاب الآن، لذلك لن أخمّن فصوله.\n${book.url}`, contentId: book.id, contextItems: [book.id], seenContentIds: [book.id] }
  return { text: chapters.text, contentId: book.id, contextItems: [book.id], seenContentIds: [book.id] }
}

function bookVideosReply(input) {
  const topic = commandTopic(input, /^(?:(?:ابي|اريد|ممكن|شاهد|مشاهده|اشوف)\s+)?(?:فيديوهات|فيديو|مقاطع|شروحات)?\s*(?:داخل|في)?\s*(?:ال)?(?:كتاب|الموسوعه)\s*/)
  const query = topic && !/^(?:فيديوهات|فيديو|مقاطع|شروحات)$/.test(topic)
    ? `?q=${encodeURIComponent(topic)}&tab=video`
    : '?tab=video'
  return {
    text: `فيديوهات الكتاب موجودة داخل الخريطة المرئية للموسوعة؛ تقدر تبحث بالمفهوم، ثم تشاهد المقطع المرتبط به مباشرة:\n${SITE_URL}/publications/encyclopedia${query}#encyclopedia-map`,
  }
}

function mediaMatches(db, topic = '', limit = 3) {
  const rows = db.all("SELECT * FROM content_items WHERE kind='media'") || []
  const tokens = clean(topic).split(/\s+/).filter((token) => token.length > 1)
  return rows
    .map((item) => {
      const named = clean(`${item.title || ''} ${item.excerpt || ''} ${item.keywords || ''}`)
      const body = clean(item.body || '')
      let score = item.date ? 4 : 0
      for (const token of tokens) {
        if (named.includes(token)) score += 20
        else if (body.includes(token)) score += 5
      }
      return { item, score }
    })
    .filter(({ item, score }) => tokens.length ? score > (item.date ? 4 : 0) : Boolean(item.date))
    .sort((left, right) => right.score - left.score || String(right.item.date || '').localeCompare(String(left.item.date || '')))
    .slice(0, limit)
    .map(({ item }) => item)
}

function mediaLibraryReply(db, input) {
  const topicMatch = clean(input).match(/(?:عن|حول|بخصوص)\s+(.+)$/)
  const topic = topicMatch?.[1]?.trim() || ''
  const matches = mediaMatches(db, topic, 3)
  if (!matches.length) {
    return {
      text: topic
        ? `لم أجد لحظةً موثقة مطابقة لـ«${topic}» الآن. افتح الأرشيف الإعلامي وابحث داخل ما قيل:\n${SITE_URL}/media`
        : `الظهور الإعلامي المرئي والمسموع، مع البحث داخل الكلام، هنا:\n${SITE_URL}/media`,
    }
  }
  return {
    text: `${topic ? `هذه أقرب اللقاءات التي ورد فيها «${topic}»` : 'من الظهور الإعلامي للدكتور'}:\n${matches.map((item, index) => `${index + 1}. ${item.title}${item.date ? ` · ${item.date}` : ''}\n${item.url}`).join('\n\n')}\n\nوالأرشيف الكامل والبحث داخل ما قيل:\n${SITE_URL}/media`,
    contentId: matches[0].id,
    contextItems: matches.map((item) => item.id),
    seenContentIds: matches.map((item) => item.id),
  }
}

function dialogueLibraryReply(db) {
  const item = latestAudioContent(db, 'dialogue', 1)[0]
  if (!item) return { text: `مجلس الفكرة والحوارات المسموعة هنا:\n${SITE_URL}/listen` }
  const reply = listenReply(item, 'dialogue')
  return {
    ...reply,
    text: `هذا أحدث حوار مسموع جاهز الآن:\n${item.title}\n${audioLinks(item).find((line) => line.startsWith('الحوار:')) || `${item.url}#article-audio`}\n\nولكل الحوارات و«مجلس الفكرة»:\n${SITE_URL}/listen`,
  }
}

function radioReply(db) {
  const recordings = (db.all("SELECT * FROM content_items WHERE kind='media'") || [])
    .filter((item) => /(?:اذاعه|راديو|تسجيل صوتي)/.test(clean(item.keywords || '')))
    .slice(0, 2)
  return {
    text: `راديو د. أحمد جاهز للاستماع المتواصل من هنا:\n${SITE_URL}/radio${recordings.length ? `\n\nومن اللقاءات الإذاعية المحفوظة:\n${recordings.map((item) => `• ${item.title}\n${item.url}`).join('\n')}` : ''}\n\nأما الحوارات المقالية فهنا:\n${SITE_URL}/listen`,
    contentId: recordings[0]?.id,
    contextItems: recordings.map((item) => item.id),
    seenContentIds: recordings.map((item) => item.id),
  }
}

/* داخل علامتَي التنصيص لا تُعرض الأسطر الفارغة كما هي في المتن — كانت تشقّ
   الاقتباس فقرتين، فتبدو الرسالة مكسورة ويُعرِّض المُجمِّل شطره الأخير وحده.
   النصّ المحفوظ دليلاً يبقى كما نُسخ من المتن؛ والتهذيب للعرض وحده. */
const displayQuote = (value) => String(value || '').replace(/\s*\n+\s*/g, ' ').trim()

function oneMinuteReply(db, session, selectedItem = null) {
  let item = selectedItem || (session?.content_id ? findContent(db, session.content_id) : null)
  let extract = item ? extractVerbatimAtSpeed(item, '30s') : null
  /* «عندي دقيقة» قد تأتي بعد حلقةٍ صوتية لا تحمل متناً حرفياً داخل الفهرس.
     كانت الجلسة تتمسّك بها، فتُرسل خلاصةً بلا evidenceQuotes ويسقط الاختبار.
     إذا لم يكن للمادة الحاضرة نصٌ قابل للاقتباس ننتقل بهدوء إلى أقرب مادة
     مقروءة، من غير تغيير أي صياغة أو ميزة في الرد. */
  if (!extract?.text) {
    item = shortReadableContent(db, 1)[0] || latestContent(db, 'article', 1)[0]
    extract = item ? extractVerbatimAtSpeed(item, '30s') : null
  }
  if (!item) return { text: 'أرسل عنوان المقالة أو اكتب: آخر مقالة، وأعطيك الزبدة في دقيقة.' }
  const summary = extract?.text || contentSummary(item, 1) || item.excerpt || ''
  return {
    text: `قراءة حرفية في أقل من دقيقة من الموقع:
${item.title}${item.date ? ` · ${item.date}` : ''}
«${displayQuote(summary)}»
${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: extract?.text ? [extract.text] : [],
    actions: audioLinks(item),
  }
}

function mostViewedArticleReply(db) {
  const snapshot = mostPopularContent(db, 'article', 1)
  if (!snapshot.verified || !snapshot.items.length) {
    return { text: 'لا أملك الآن لقطةً موثقة من عدّاد الموقع، لذلك لن أختار مقالةً وأسمّيها الأكثر قراءة. أقدر أعطيك أحدث مقالة أو بوابة اليوم من الأرشيف.' }
  }
  const item = snapshot.items[0]
  return {
    text: `الأكثر قراءة في عدّاد الموقع خلال ${snapshot.period}:
${item.title}
${arabicCountPhrase(item.verifiedViews, RECORDED_VIEW_FORMS)}
${item.url}

المصدر: عدّاد الموقع الداخلي، والمدة مذكورة أعلاه.`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
  }
}

function libraryOverviewReply(db) {
  const kinds = [
    ['article', ARTICLE_ENTRY_FORMS],
    ['paper', PAPER_ENTRY_FORMS],
    ['book', BOOK_ENTRY_FORMS],
    ['podcast', AUDIO_EPISODE_FORMS],
    ['curated', CURATED_ENTRY_FORMS],
  ]
  const counts = kinds.map(([kind, forms]) => ({ kind, forms, count: Number(db.get('SELECT COUNT(*) c FROM content_items WHERE kind=?', kind)?.c || 0) }))
  const available = counts.filter((item) => item.count > 0)
  return {
    text: `المكتبة تضم الآن:
${available.map((item) => `• ${arabicCountPhrase(item.count, item.forms)}`).join('\n')}

ما تحتاج تحفظ أوامر. اكتب مثلاً: شنو جديد الدكتور؟ عنده شيء عن التقييم؟ آخر أبحاثه؟ أو فاجئني.`,
  }
}

function topTopicsReply(db) {
  const topics = topArticleTopics(db, 4)
  if (!topics.length) return { text: 'لا توجد موضوعات مصنفة في المقالات الآن.' }
  return {
    text: `أكثر المسارات حضوراً في مقالات الدكتور:
${topics.map((item, index) => `${index + 1}. ${item.topic} — ${arabicCountPhrase(item.count, ARTICLE_ENTRY_FORMS)}`).join('\n')}

اكتب اسم أي مسار منها وأختار لك أفضل نقطة بداية من الموقع.`,
  }
}

/* البوت يحسّ الوقت (أمر الدكتور: «يخليه حيّاً ومنتبهاً»): تحيةٌ بتوقيت الكويت
   الفعلي — صباحاً وظهراً وليلاً — تسبق «حيّاك الله» فيبدو كإنسانٍ منتبهٍ للساعة. */
function timeGreeting(at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuwait', hour: '2-digit', hourCycle: 'h23' }).format(at))
  if (hour >= 5 && hour < 11) return 'صباح الخير 🌅'
  if (hour >= 11 && hour < 17) return 'نهارك سعيد ☀️'
  return 'مساء الخير 🌙'
}

/* كشف مزاج الرسالة (أمر الدكتور «نبرة تتكيّف مع المزاج»): إشاراتٌ لفظية صريحة
   فقط — لا نخمّن المشاعر ولا نؤلّف. المحايد هو الأصل حتى تظهر قرينة واضحة. */
const MOOD_WARM = /(رائع|ممتاز|جميل|حلو|شكرا|شكراً|مشكور|أحسنت|احسنت|مبدع|واو|وااو|يعطيك العافيه|تسلم|فرحت|سعدت|👏|🌹|❤|😍|🔥)/
const MOOD_LOW = /(زعلان|حزين|تعبان|معصب|متضايق|مضايق|للاسف|للأسف|مو راضي|سيّئ|سيئ|ما اشتغل|مو شغال|خربان|مشكله|مشكلة|احبطت|يائس|😢|😞|💔|😡)/
function detectMood(text = '') {
  const value = clean(text)
  if (MOOD_LOW.test(value)) return 'low'
  if (MOOD_WARM.test(value)) return 'warm'
  return 'neutral'
}
function moodPrefix(mood) {
  if (mood === 'warm') return 'سعيدٌ بحماسك 🌟 '
  if (mood === 'low') return 'حيّاك، وأرجو أن يخفّف هذا عنك قليلاً 🌿 '
  return ''
}

/* ذاكرة الاهتمام عبر الأيام: نتذكّر مواضيع كل سائلٍ لا محتوى رسائله — عدّادٌ
   بسيطٌ بالموضوع، يخدم اقتراحاً استباقياً بمادةٍ حقيقية لاحقاً. بلا تأليف. */
function recordInterest(db, jid, topicPhrase) {
  try {
    const topic = clean(topicPhrase).split(/\s+/).filter((word) => word.length > 3).slice(0, 3).join(' ')
    if (!topic) return
    const key = db.jidKey ? db.jidKey(jid) : jid
    db.run(
      `INSERT INTO chat_interests(jid,topic,hits,last_at) VALUES(?,?,1,?)
       ON CONFLICT(jid,topic) DO UPDATE SET hits=hits+1, last_at=excluded.last_at`,
      key, topic, new Date().toISOString(),
    )
  } catch { /* الذاكرة إضافةٌ لا تُعطّل رداً */ }
}
function topInterest(db, jid) {
  try {
    const key = db.jidKey ? db.jidKey(jid) : jid
    const row = db.get('SELECT topic, hits FROM chat_interests WHERE jid=? ORDER BY hits DESC, last_at DESC LIMIT 1', key)
    return row && row.hits >= 2 ? row.topic : ''
  } catch { return '' }
}
/* اقتراحٌ استباقيّ بمادةٍ حقيقية مرتبطة باهتمام السائل — يُرجِع سطراً أو فراغاً،
   ولا يُكرّر ما رآه، ولا يُطلق إلا حين توجد مادةٌ فعلية. */
function proactiveLine(db, jid, seenIds = []) {
  const topic = topInterest(db, jid)
  if (!topic) return ''
  const matches = searchContent(db, topic, { limit: 4 }).filter((item) => !seenIds.includes(item.id))
  if (!matches.length) return ''
  const pick = matches[0]
  return `\n\nوبما أنك كثيراً ما تسأل عن «${topic}» — قد يعجبك أيضاً:\n${pick.title}\n${pick.url}`
}

function welcomeReply(db, jid, at = new Date(), mood = 'neutral') {
  const MSG = getBotMessages()
  const greet = `${moodPrefix(mood)}${timeGreeting(at)}`
  const item = selectDailyUnsentContent(db, { jid })
  if (!item) {
    const hasArchive = Number(db.get('SELECT COUNT(*) AS count FROM content_items')?.count || 0) > 0
    return {
      text: hasArchive
        ? `${greet} · ${MSG.welcomeLine}.\n\nمررتَ على كل مواد الأرشيف المسجلة، لذلك لن أكرر مادةً عليك من غير أن تطلبها. اكتب موضوعاً أو نوعاً وأفتحه لك.`
        : `${greet} · ${MSG.welcomeLine}، لكن لا توجد مواد منشورة في الفهرس الآن.`,
      contextItems: [],
      replaceContextList: true,
    }
  }
  const extract = extractVerbatimAtSpeed(item, '30s')
  const quote = displayQuote(extract?.text || item.excerpt || contentSummary(item, 1))
  return {
    text: `${greet} · ${MSG.welcomeLine}.

${MSG.dailyGateLabel}
${item.title}${item.date ? ` · ${item.date}` : ''}
${quote ? `«${quote}»\n` : ''}${item.url}

${MSG.optionsPrompt}
وقل مقصدك بطريقتك: «ابحث داخل كتاب» · «حوار مسموع» · «ظهور إعلامي» · «الراديو».
${MSG.stopHint}${proactiveLine(db, jid, [item.id])}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: extract?.text ? [extract.text] : [],
  }
}

function contextSelection(db, session, input, request = parseCompoundRequest(input)) {
  const context = parseConversationContext(session?.context_json)
  const resolution = resolveContextReference(context, request)
  /* إذا طلب السائل ترتيباً/اتجاهاً غير موجود فلا نرجعه خفيةً إلى المادة الحالية.
     كان «الرابع» في قائمة من ثلاثة و«اللي بعده» عند النهاية يعيدان الحالي وكأن
     الطلب نُفّذ. المرجع الحالي وحده يستطيع استخدام content_id القديم للتوافق مع
     جلسات ما قبل الذاكرة السياقية. */
  const invalidRelativeReference = Boolean(
    request?.reference
    && request.reference !== 'current'
    && !resolution,
  )
  const contentId = invalidRelativeReference
    ? null
    : resolution?.contentId
      || (context.currentIndex >= 0 ? context.resultIds[context.currentIndex] : null)
      || session?.content_id
      || null
  return { context, request, resolution, item: contentId ? findContent(db, contentId) : null }
}

function speedFromRequest(request, input = '') {
  if (/تعمق|عميق|الكامل/.test(clean(input))) return 'deep'
  const seconds = Number(request?.duration?.seconds || 0)
  if (seconds > 0 && seconds <= 45) return '30s'
  if (seconds > 45 && seconds <= 180) return '2min'
  return '30s'
}

function extractiveReadingReply(db, item, speed = '30s') {
  if (!item) return { text: 'اختر مادة أولاً: اكتب آخر مقالاته، ثم قل الأولى أو الثانية.', contentId: null }
  if (speed === 'deep') {
    const doorway = extractVerbatimAtSpeed(item, '2min') || extractVerbatimAtSpeed(item, '30s')
    const network = buildQuietIdeaNetwork(db, item)
    const audio = audioLinks(item)
    return {
      text: `مدخل التعمّق من النص المنشور:
${item.title}${item.date ? ` · ${item.date}` : ''}
${doorway?.text ? `«${doorway.text}»\n` : ''}${item.url}${audio.length ? `\n\nالنسخ الصوتية:\n${audio.join('\n')}` : ''}${network.length ? `\n\nثم امشِ مع الفكرة عبر:\n${network.map((path, index) => `${index + 1}. ${path.title}\n${path.url}`).join('\n')}` : ''}`,
      contentId: item.id,
      contextItems: [item.id, ...network.map((path) => path.contentId)],
      seenContentIds: [item.id, ...network.map((path) => path.contentId)],
      evidenceQuotes: doorway?.text ? [doorway.text] : [],
      actions: audio,
    }
  }
  const extract = extractVerbatimAtSpeed(item, speed)
  if (!extract) return contentReply('المادة المنشورة', item)
  const label = speed === '2min' ? 'قراءة حرفية في نحو دقيقتين' : 'قراءة حرفية في نحو ٣٠ ثانية'
  return {
    text: `${label}:
${item.title}${item.date ? ` · ${item.date}` : ''}
«${speed === '2min' ? extract.text : displayQuote(extract.text)}»
${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: [extract.text],
    actions: audioLinks(item),
  }
}

function listenReply(item, voice = null) {
  if (!item) return { text: 'اختر مادة أولاً، ثم قل: صوت نورة، صوت فهد، أو الحوار.' }
  const available = audioLinks(item)
  const prefix = voice === 'dialogue'
    ? 'الحوار:'
    : voice === 'noura'
      ? 'صوت نورة:'
      : voice === 'fahed'
        ? 'صوت فهد:'
        : ''
  /* بلا صوتٍ مسمّى يُقدَّم صوت فهد (وهو الافتراضي في الموقع)، لا أوّل ما
     يُصادَف في القائمة — «شغّل صوت المقالة» كانت تُجيب بصوت نورة. */
  const chosen = prefix
    ? available.find((line) => line.startsWith(prefix))
    : available.find((line) => line.startsWith('صوت فهد:')) || available[0]
  if (!chosen) {
    /* الطريق المسدود كان يُغلق على السائل: «لا توجد» ثم لا شيء، وأكثر المواد
       لها صوتٌ آخر منشور (الحوار وحده نادر: حلقتان). فنسمّي المتاح **بلا
       رابط** — لأن قاعدة الدار أن الطلب غير المنشور لا يُعطى رابطاً البتّة
       (nuclear: audio-availability)، والدلالةُ باسم الصوت لا تخرقها. */
    const namesAvailable = available
      .map((line) => String(line).split(':')[0].trim())
      .filter(Boolean)
    const hint = namesAvailable.length
      ? `\nوالمنشور من هذه المادة: ${namesAvailable.join(' · ')} — قل اسم أيّها تريد.`
      : ''
    return { text: `لا توجد النسخة الصوتية المطلوبة لهذه المادة في فهرس الموقع الآن.
${item.title}
${item.url}${hint}`, contentId: item.id, contextItems: [item.id], seenContentIds: [item.id] }
  }
  return {
    text: `النسخة الصوتية المنشورة:
${item.title}
${chosen}
${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    actions: available,
  }
}

function sourceProofReply(item) {
  if (!item) return { text: 'اختر مادة أولاً، ثم اكتب: المصدر.' }
  const extract = extractVerbatimAtSpeed(item, '30s')
  return {
    text: `المصدر المنشور:
${item.title}${item.date ? ` · ${item.date}` : ''}
${extract?.text ? `«${displayQuote(extract.text)}»\n` : ''}${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: extract?.text ? [extract.text] : [],
  }
}

function ideaNetworkReply(db, item) {
  if (!item) return { text: 'اختر مادة أولاً، ثم اكتب: شبكة الأفكار.' }
  const paths = buildQuietIdeaNetwork(db, item)
  if (!paths.length) return { text: `هذه المادة لا تملك الآن مسارات تقاطع موثقة أخرى في الفهرس.
${item.title}
${item.url}`, contentId: item.id, contextItems: [item.id], seenContentIds: [item.id] }
  return {
    text: `شبكة أفكار هادئة حول «${item.title}»:
${paths.map((path, index) => `${index + 1}. ${path.title}${path.sharedConcepts?.length ? `\nيتقاطع في الفهرس عبر: ${path.sharedConcepts.join(' · ')}` : ''}\n${path.url}`).join('\n\n')}

اختر مساراً واحداً: الأول أو الثاني أو الثالث.`,
    contentId: paths[0].contentId,
    contextItems: paths.map((path) => path.contentId),
    seenContentIds: paths.map((path) => path.contentId),
  }
}

function challengeReply(db, jid) {
  const challenge = buildFifteenSecondChallenge(db, { jid })
  if (!challenge) return { text: 'لا تتوافر الآن ثلاثة عناوين موثقة لبناء التحدّي.' }
  return {
    text: `تحدّي ١٥ ثانية — من أي مقال هذا النص؟
«${displayQuote(challenge.quote)}»

${challenge.options.map((option, index) => `${index + 1}. ${option.title}`).join('\n')}

أرسل الرقم فقط.`,
    contextItems: challenge.options.map((option) => option.contentId),
    /* العناوين الثلاثة ظهرت فعلاً للزائر؛ كلها تُحسب مشاهدةً حتى لا يعيد
       تحدّي اليوم العناوين نفسها متخفّيةً كخيارات. */
    seenContentIds: challenge.options.map((option) => option.contentId),
    challengeContext: {
      id: challenge.id,
      optionIds: challenge.options.map((option) => option.contentId),
      answerContentId: challenge.answerContentId,
    },
    evidenceQuotes: [challenge.quote],
  }
}

function challengeAnswerReply(db, session, input) {
  const context = parseConversationContext(session?.context_json)
  const challenge = context.challenge
  if (!challenge) return { text: 'لا يوجد تحدٍّ مفتوح. اكتب: اختبرني.' }
  const digit = Number(String(input).replace(/[١۱]/g, '1').replace(/[٢۲]/g, '2').replace(/[٣۳]/g, '3'))
  const selectedId = challenge.optionIds[digit - 1]
  const answer = findContent(db, challenge.answerContentId)
  if (!selectedId || !answer) return { text: 'اختر ١ أو ٢ أو ٣.', clearChallenge: true }
  const correct = selectedId === challenge.answerContentId
  return {
    text: `${correct ? 'إجابة صحيحة.' : 'الإجابة الصحيحة هي:'}
${answer.title}
${answer.url}`,
    contentId: answer.id,
    contextItems: [answer.id],
    seenContentIds: [answer.id],
    clearChallenge: true,
  }
}

function compoundRequestReply(db, request) {
  const base = request.topic
    ? searchContent(db, request.topic, { limit: 80 })
    : request.kind
      ? latestContent(db, request.kind, 10)
      : latestContent(db, 'article', 10)
  const topicMatches = [...base].sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
  const strict = topicMatches.filter((item) => {
    if (request.kind && item.kind !== request.kind) return false
    if (request.voice && !item.audio?.[request.voice]) return false
    if (request.action === 'listen' && !request.voice && !audioLinks(item).length) return false
    if (request.duration) {
      /* «لخّصه في دقيقتين» يحدد طول جوابنا الاستخراجي، لا طول المقال الأصلي.
         أما الاستماع فيُقاس بمدة الملف المنشور فعلاً، لا بعدد كلمات تقديري. */
      if (request.action !== 'summary') {
        const listening = request.action === 'listen' || Boolean(request.voice)
        const actualSeconds = listening
          ? Number((request.voice && item.audio?.durations?.[request.voice]) || item.audio?.duration || 0)
          : Math.ceil(Number(item.words || 0) / 2.2)
        if (!actualSeconds || actualSeconds > Number(request.duration.seconds || 0)) return false
      }
    }
    return true
  })
  if (!strict.length) {
    const alternatives = topicMatches.slice(0, 3)
    if (!alternatives.length) return noSilenceReply(db, String(request.topic || ''))
    return {
      text: `وجدت مواد منشورة في الموضوع، لكن لا توجد مادة تجمع الشروط المطلوبة كلها الآن:
${alternatives.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n\n')}

اختر واحداً منها أو خفّف شرط المدة أو الصوت.`,
      contentId: alternatives[0].id,
      contextItems: alternatives.map((item) => item.id),
      seenContentIds: alternatives.map((item) => item.id),
    }
  }
  const item = strict[0]
  if (request.action === 'listen' || request.voice) return { ...listenReply(item, request.voice), contextItems: strict.map((row) => row.id) }
  if (request.action === 'summary') return { ...extractiveReadingReply(db, item, speedFromRequest(request)), contextItems: strict.map((row) => row.id) }
  return { ...contentReply('وجدت لك مادة تطابق الطلب', item), contextItems: strict.map((row) => row.id) }
}

function weeklyDigestReply(db) {
  const cutoff = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)
  const recent = db.all("SELECT * FROM content_items WHERE date>=? AND kind IN ('article','paper','book','podcast') ORDER BY date DESC LIMIT 5", cutoff)
  const items = recent.length ? recent : latestContent(db, 'article', 3)
  if (!items.length) return { text: 'لا توجد مواد منشورة في الفهرس الآن.' }
  const header = recent.length ? 'المواد المنشورة خلال آخر سبعة أيام:' : 'لا توجد مادة مؤرخة خلال آخر سبعة أيام؛ وهذه آخر المواد المنشورة:'
  return {
    text: `${header}
${items.map((item, index) => `${index + 1}. ${conciseItem(item)}`).join('\n\n')}`,
    contentId: items[0].id,
    contextItems: items.map((item) => item.id),
    seenContentIds: items.map((item) => item.id),
  }
}

function savedShelfReply(db, jid) {
  const items = db.all(`SELECT content_items.* FROM saved_content
    JOIN content_items ON content_items.id=saved_content.content_id
    WHERE saved_content.jid=? ORDER BY saved_content.saved_at DESC LIMIT 10`, db.jidKey(jid))
  if (!items.length) return { text: 'رفّك فارغ الآن. عندما تعجبك مادة اكتب: احفظها.', contextItems: [], replaceContextList: true }
  return {
    text: `رفّك الخاص:
${items.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n\n')}`,
    contentId: items[0].id,
    contextItems: items.map((item) => item.id),
    seenContentIds: items.map((item) => item.id),
    replaceContextList: true,
  }
}

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
  const forgotten = Boolean(db.get('SELECT 1 AS hit FROM privacy_tombstones WHERE jid=?', id))
  if (forgotten) {
    if (suppressed) {
      db.run(
        'INSERT INTO contacts(id,jid,display_name,phone,suppressed,nickname,wa_name,source,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET jid=excluded.jid,display_name=NULL,phone=NULL,suppressed=1,nickname=NULL,wa_name=NULL,source=NULL,last_seen_at=NULL,updated_at=excluded.updated_at',
        id, db.encryptJid(''), null, null, 1, null, null, null, null, now, now,
      )
    } else db.run('DELETE FROM contacts WHERE id=?', id)
    db.addAudit(suppressed ? 'opt-out' : 'opt-in', id, 'privacy-tombstone-retained')
    return
  }
  db.run('INSERT INTO contacts(id,jid,display_name,phone,suppressed,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET jid=excluded.jid,suppressed=excluded.suppressed,updated_at=excluded.updated_at', id, db.encryptJid(jid), null, null, suppressed ? 1 : 0, now, now)
  db.addAudit(suppressed ? 'opt-out' : 'opt-in', id)
}

export function markManualTakeover(db, jid, minutes = MANUAL_TAKEOVER_MINUTES) {
  if (!jid) return
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString()
  const now = new Date().toISOString()
  const jidKey = db.jidKey(jid)
  /* بأمر الدكتور (٢٠٢٦-٠٧-٢٣): تدخله اليدوي يُصمت البوت مدةَ المهلة فقط —
     الجلسة لا تُهدم. كانت تُقلب إلى manual-takeover فيموت الباب للأبد ويحتاج
     الشخص «إيقاظاً» جديداً بعد كل محادثة خاصة، وهذا الإزعاج الذي اشتكاه.
     الآن: الصمت قائم ما دام manual_until في المستقبل (البوابة تفحصه بمعزل عن
     الوضع)، وبعده يستأنف البوت وحده. سياقُ ما قبل الخصوصية يُمسح احتراماً
     لحديث الدكتور — استئنافٌ نظيف لا استكمالُ تنصّت. */
  db.run(
    `INSERT INTO chat_sessions(jid,mode,manual_until,updated_at)
     VALUES(?,?,?,?)
     ON CONFLICT(jid) DO UPDATE SET
       manual_until=excluded.manual_until, content_id=NULL,
       followup_json=NULL, context_json=NULL, updated_at=excluded.updated_at`,
    jidKey, 'suggest-only', until, now,
  )
}

export function clearPreferences(db, jid) {
  if (!jid) return
  const key = db.jidKey(jid)
  const suppressed = Boolean(db.get('SELECT suppressed FROM contacts WHERE id=?', key)?.suppressed)
  const manualUntil = db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', key)?.manual_until || null
  const keepManualTakeover = Boolean(manualUntil && new Date(manualUntil) > new Date())
  const reminderIds = db.all('SELECT id,jid FROM reminders').filter((row) => {
    try { return db.decryptJid(row.jid) === jid } catch { return false }
  }).map((row) => row.id)
  const jobIds = db.all('SELECT id,jid FROM message_jobs').filter((row) => {
    try { return db.decryptJid(row.jid) === jid } catch { return false }
  }).map((row) => row.id)

  db.transaction(() => {
    db.run('INSERT OR REPLACE INTO privacy_tombstones(jid,reason,created_at) VALUES(?,?,?)', key, 'user-delete-request', new Date().toISOString())
    db.run('DELETE FROM user_preferences WHERE jid=?', key)
    db.run('DELETE FROM sent_content WHERE jid=?', key)
    db.run('DELETE FROM content_reservations WHERE jid=?', key)
    db.run('DELETE FROM saved_content WHERE jid=?', key)
    db.run('DELETE FROM answer_evidence WHERE jid=?', key)
    db.run('DELETE FROM intent_logs WHERE jid=?', key)
    db.run('DELETE FROM unresolved_messages WHERE jid=?', key)
    db.run('DELETE FROM processed_messages WHERE jid=?', key)
    db.run('DELETE FROM outbox_messages WHERE jid=?', key)
    db.run('DELETE FROM chat_sessions WHERE jid=?', key)
    db.run('DELETE FROM campaign_targets WHERE target_id=?', key)
    db.run('DELETE FROM broadcast_members WHERE opaque_id=?', key)
    /* السجلات القديمة استخدمت رقماً محجوباً جزئياً؛ الجديدة تستخدم hash فقط.
       نمحو الصورتين حتى لا يبقى أثرٌ قابل للربط بعد أمر الحذف. */
    db.run('DELETE FROM audit_log WHERE target IN (?,?)', key, redactJid(jid))
    for (const id of reminderIds) db.run('DELETE FROM reminders WHERE id=?', id)
    for (const id of jobIds) {
      db.run('DELETE FROM message_attempts WHERE job_id=?', id)
      db.run('DELETE FROM message_jobs WHERE id=?', id)
    }
    if (suppressed) {
      /* نحتفظ فقط ببصمة الإلغاء، لا بالرقم المشفّر ولا الاسم ولا آخر ظهور. وعند
         إعادة الاشتراك يعيد setSuppression كتابة jid الصحيح من الرسالة نفسها. */
      db.run('UPDATE contacts SET jid=?,display_name=NULL,phone=NULL,nickname=NULL,wa_name=NULL,source=NULL,last_seen_at=NULL,updated_at=? WHERE id=?', db.encryptJid(''), new Date().toISOString(), key)
    } else db.run('DELETE FROM contacts WHERE id=?', key)
    /* حذف التخصيص لا يجوز أن يفتح الباب على حديثٍ يتولاه الدكتور. نعيد حالة
       الأمان وحدها (hash + وقت الانتهاء) بلا محتوى ولا تفضيلات شخصية. */
    if (keepManualTakeover) {
      const stamp = new Date().toISOString()
      db.run(
        'INSERT INTO chat_sessions(jid,mode,manual_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,manual_until=excluded.manual_until,content_id=NULL,followup_json=NULL,context_json=NULL,opened_at=NULL,last_user_at=NULL,updated_at=excluded.updated_at',
        key, 'manual-takeover', manualUntil, stamp,
      )
    }
  })
  /* بلا معرّف للشخص: نحفظ أن عملية حذفٍ حدثت لأغراض الصحة، لا لمن حدثت. */
  db.addAudit('delete-local-personalization', '', 'session,sent,saved,reminders,logs')
}

/* متون المقالات لمحرك الاستشهاد. تُقرأ من قاعدة البوت نفسها (لا شبكة، لا نموذج)
   وتُحفظ دقيقتين: الفهرس لا يتغيّر بين رسالتين، وقراءة ١٦٤ متناً مع كل حرفٍ
   يكتبه سائلٌ بذخٌ بلا طائل. */
const corpusCacheByDb = new WeakMap()
const CORPUS_TTL_MS = 120_000

export function articleCorpus(db, now = Date.now()) {
  const version = JSON.stringify(db.getSetting('content.indexVersion', null))
  const cached = corpusCacheByDb.get(db)
  if (cached && cached.version === version && now - cached.at < CORPUS_TTL_MS && cached.items.length) return cached.items
  const rows = db.all("SELECT slug, title, url, date, body FROM content_items WHERE kind='article' AND body IS NOT NULL AND length(body) > 200")
  const next = { at: now, version, items: rows.map((row) => ({ ...row, kind: 'article' })) }
  corpusCacheByDb.set(db, next)
  return next.items
}

/* ═══ بحثٌ في موضوعٍ من مصادر الدكتور وحدها — يُستعمل من «عندك شي عن…» ومن
   التصحيح «مو عن كذا». يستثني ما رُفض فلا يُعاد. التنازل عن الطموح لا الأمانة:
   تطابقٌ اسميّ صريح ← كلامُ الدكتور نفسه عبر البوابة ← قائمةُ روابط ← مصارحة. */
function topicSearchReply(db, jid, query, { exclude = [], coverageQuestion = false, allowDisambiguation = true } = {}) {
  const excludeSet = new Set(exclude)
  const keep = (item) => item && !excludeSet.has(item.id)
  recordInterest(db, jid, query)

  /* سؤال المعنى يُجاب بالمعنى: تعريفٌ من معجم الدكتور نفسه، ثم مادةٌ منشورة
     تفتح الفكرة. وكان يُجاب بأقرب مقالٍ بلا تعريفٍ البتّة. */
  const definition = conceptDefinition(query)
  if (definition) {
    const related = searchContent(db, definition.concept.canonicalAr, { limit: 2 }).filter(keep)
    const tail = related.length
      ? `\n\nوله في هذا من الموقع:\n${related.map((item) => `• ${item.title}\n  ${item.url}`).join('\n')}`
      : ''
    return {
      text: `من معجم الدكتور:\n${definition.text}${tail}`,
      contentId: related[0]?.id || null,
      contextItems: related.map((item) => item.id),
      seenContentIds: related.map((item) => item.id),
      replaceContextList: Boolean(related.length),
    }
  }

  /* المسار أولاً: من كتب اسم مسارٍ عرضناه عليه («التربية») يُعطى نقاط بداية
     من ذلك المسار بعينه — وفاءً بالوعد الذي ينتهي به ردّ المسارات. وما عداه
     يمضي إلى البحث كما كان. */
  const topical = articlesByTopic(db, query, 3).filter(keep)
  if (topical.length >= 2) {
    return {
      text: `من مسار «${topical[0].topicLabel || clean(query)}» — وهذه نقاط بداية من الموقع:\n${topical.map((item, index) => `${index + 1}. ${item.title}${item.date ? ` · ${item.date}` : ''}\n${item.url}`).join('\n\n')}\n\nقل: الأولى أو الثانية، وأفتحها لك.`,
      contentId: topical[0].id,
      contextItems: topical.map((item) => item.id),
      seenContentIds: topical.map((item) => item.id),
      replaceContextList: true,
    }
  }

  const preliminary = searchContent(db, query, { limit: 6 }).filter(keep)
  const meaningfulWords = clean(query).split(/\s+/).filter((word) => word.length > 2)

  if (allowDisambiguation && meaningfulWords.length === 1 && preliminary.length >= 3) {
    /* ما ورد اللفظ في عنوانه يتقدّم: «عندك شي عن الغش» كانت تعرض مقالين لا
       صلة لعنوانهما بالغش ثم «حين يصبح الغش ذكاءً» ثالثاً. */
    const word = meaningfulWords[0]
    const inTitle = (item) => normalizeArabic(item.title || '').includes(normalizeArabic(word))
    const choices = [...preliminary.filter(inTitle), ...preliminary.filter((item) => !inTitle(item))].slice(0, 3)
    return {
      text: `وجدت أكثر من مدخل منشور لهذا المصطلح. أيّها تقصد؟\n${choices.map((item, index) => `${index + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nاكتب الأول أو الثاني أو الثالث.`,
      contentId: choices[0].id, contextItems: choices.map((item) => item.id), seenContentIds: choices.map((item) => item.id),
    }
  }

  const exactNamedFromSearch = preliminary.filter((item) => {
    const named = clean(`${item.title || ''} ${item.keywords || ''}`)
    return meaningfulWords.length > 0 && meaningfulWords.every((word) => named.includes(word))
  })
  const exactNamed = (exactNamedFromSearch.length ? exactNamedFromSearch : namedContentMatches(db, meaningfulWords, 3)).filter(keep)
  if (exactNamed.length) {
    const choices = exactNamed.slice(0, 3)
    return {
      text: `${coverageQuestion ? 'نعم — تناول هذا الموضوع في مواده المنشورة:' : 'أقرب المواد المنشورة لهذا الموضوع:'}\n${choices.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nتقدر تقول: لخّص الأولى، أو اسمعني الثانية.`,
      contentId: choices[0].id, contextItems: choices.map((item) => item.id), seenContentIds: choices.map((item) => item.id),
    }
  }

  const skipSlugs = [...excludeSet].filter((id) => String(id).startsWith('article:')).map((id) => String(id).slice('article:'.length))
  const scholar = scholarAnswer(articleCorpus(db), query, { skip: skipSlugs })
  if (scholar.verified && scholar.citations.length) {
    return {
      text: coverageQuestion ? `نعم — تكلم عنه بلسانه:\n\n${scholar.text}` : scholar.text,
      contentId: `article:${scholar.citations[0].slug}`,
      contextItems: scholar.citations.map((citation) => `article:${citation.slug}`),
      seenContentIds: scholar.citations.map((citation) => `article:${citation.slug}`),
      evidenceQuotes: scholar.citations.map((citation) => citation.quote),
      followup: { question: query, seen: scholar.citations.map((citation) => citation.slug) },
    }
  }

  const results = preliminary.slice(0, 3)
  if (results.length) {
    return {
      text: `أقرب المواد من الموقع لسؤالك:\n${results.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}\n\nاكتب «غيره» لمزيد، أو «لخّص» للأول.`,
      contentId: results[0].id, contextItems: results.map((item) => item.id), seenContentIds: results.map((item) => item.id),
    }
  }
  return noSilenceReply(db, query)
}

/* ═══ التصحيح: «مو صح» أو «مو عن X» أو «أقصد Y». نستبعد ما رُفض، ونبحث الموضوع
   الجديد إن ذُكر، وإلا ننتقل للمرشّح التالي من آخر قائمة، وإلا نصارح. لا نكرّر
   المرفوض ولا نؤلّف من عندنا — فالبوت يفهم أنه أخطأ ويصحّح، لا يعاند. */
function correctionReply(db, jid, session, input, correction = null) {
  const info = correction && typeof correction === 'object' ? correction : detectCorrection(clean(input))
  const context = parseConversationContext(session?.context_json)
  const rejected = (context.resultIds && context.resultIds[context.currentIndex]) || session?.content_id || null
  const exclude = rejected ? [rejected] : []

  if (info.topic) {
    return topicSearchReply(db, jid, info.topic, { exclude, coverageQuestion: false })
  }

  /* استبعادٌ صريح: نُخرج ما رفضه من الصفّ المحفوظ ونعرض ما بقي، فإن لم يبقَ
     شيءٌ سألناه عن مقصوده بلفظه — ولا نعيد عليه ما رفض. */
  if (info.notTopic) {
    /* المطابقة على الجذور: «الامتحانات» ترفض «الامتحان» — والاستبعاد بالحرف
       كان يُبقي ما رفضه لاختلاف الصيغة. */
    const rejectedRoots = new Set(scholarTokens(info.notTopic).map(toRoot))
    const stillFits = (item) => !scholarTokens(`${item.title || ''} ${item.keywords || ''}`).map(toRoot).some((word) => rejectedRoots.has(word))
    const others = (context.resultIds || [])
      .map((id) => findContent(db, id))
      .filter(Boolean)
      .filter((item) => item.id !== rejected && stillFits(item))
      .slice(0, 3)
    if (others.length) {
      return {
        text: `تمام، مو عن «${info.notTopic}». وهذه من غير ذاك الباب:\n${others.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nوإن أردت باباً آخر فاذكره بلفظه.`,
        contentId: others[0].id, contextItems: others.map((item) => item.id), seenContentIds: others.map((item) => item.id),
      }
    }
    return { text: `تمام، أستبعد «${info.notTopic}». اذكر الموضوع الذي تقصده بلفظه وأبحث لك في مصادر الدكتور وحدها.` }
  }

  const remaining = (context.resultIds || [])
    .filter((id, index) => index > context.currentIndex)
    .map((id) => findContent(db, id))
    .filter(Boolean)
    .slice(0, 3)
  if (remaining.length) {
    return {
      text: `تمام، مو هي. ${remaining.length === 1 ? 'لعلّك تقصد هذه:' : 'لعلّك تقصد إحدى هذه:'}\n${remaining.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n\n')}\n\nوإن ما زالت غير مقصودك، اذكر الموضوع بلفظه وأبحث لك من جديد.`,
      contentId: remaining[0].id, contextItems: remaining.map((item) => item.id), seenContentIds: remaining.map((item) => item.id),
    }
  }
  return { text: 'تمام، أستبعدها. اذكر الموضوع بلفظه — مثلاً: «عندك شي عن الذكاء الاصطناعي؟» — وأبحث لك في مصادر الدكتور وحدها.' }
}

/* ═══ التلخيص الحقيقي: «اختصرها» يجب أن يقصّر فعلاً لا أن يُعيد النصّ نفسه —
   حتى المختارات القصيرة. نقطف أكثفَ عبارةٍ دلالةً (مقطوعةً على الشرطة وعلامات
   الوقف) بشرط أن تكون منسوخةً حرفاً بحرف من المتن (isVerbatimFromItem) فلا تحريف. */
/* التطبيق نفسه انتقل إلى daily-experience.mjs ليستورده العقل المركزي أيضاً —
   كان العقل يقصّ رأس المتن فيبدو «لخّص» إعادةً للمادة. تطبيقٌ واحدٌ للاثنين. */
const distilledClause = (item) => distillItem(item)

function summaryReply(db, item) {
  if (!item) return { text: 'اختر مادة أولاً: اكتب آخر مقالاته، ثم قل الأولى أو الثانية.', contentId: null }
  const distilled = distilledClause(item)
  if (!distilled) return contentReply('المادة المنشورة', item)
  const note = distilled.whole ? 'هي مختصرةٌ أصلاً، وهذا لبّها بنصّه:' : 'الزبدة في جملةٍ من نصّه:'
  return {
    text: `${note}\n${item.title}${item.date ? ` · ${item.date}` : ''}\n«${displayQuote(distilled.text)}»\n${item.url}`,
    contentId: item.id,
    contextItems: [item.id],
    seenContentIds: [item.id],
    evidenceQuotes: [distilled.text],
    actions: audioLinks(item),
  }
}

export function handleIntent({ db, jid = '', input, session = pendingSession(db, jid), classification = classifyIntent(input) }) {
  const MSG = getBotMessages()
  /* الرقم المفرد له معنيان بحسب السياق: اختيار نتيجة من قائمة، أو إجابة تحدٍّ.
     التصنيف العام لا يملك الجلسة، لذلك كان «٢» بعد التحدّي يفتح المقالة الثانية
     بدلاً من تصحيح الإجابة. وجود تحدٍّ مفتوح وحده يمنح الرقم معنى الإجابة؛ وبعد
     إغلاقه يعود الرقم فوراً إلى التنقّل العادي بين النتائج. */
  const activeChallenge = parseConversationContext(session?.context_json).challenge
  if (activeChallenge && /^(?:1|2|3|١|٢|٣|۱|۲|۳)$/.test(String(input || '').trim())) {
    classification = { intent: INTENTS.CHALLENGE_ANSWER, confidence: 0.99, normalized: clean(input) }
  }
  /* لا تسمح قاعدة لوحةٍ اسمها «1» مثلاً بأن تسبق جواب التحدّي الحقيقي، ولا
     تسمح لأي قاعدة قابلة للتحرير بأن تعترض أمراً من أوامر الخصوصية. */
  const bypassCustomRules = new Set([
    INTENTS.CHALLENGE_ANSWER,
    INTENTS.STOP_MESSAGES,
    INTENTS.RESUME_MESSAGES,
    INTENTS.DELETE_PREFERENCES,
  ])
  const customRule = bypassCustomRules.has(classification.intent) ? null : matchReplyRule(db, input)
  if (customRule) return customRuleReply(db, customRule, input)
  const { intent, confidence } = classification
  const logId = jid ? hashOpaque(jid) : null
  db.run('INSERT INTO intent_logs(jid,input_hash,intent,confidence,created_at) VALUES(?,?,?,?,?)', logId, hashOpaque(input), intent, confidence, new Date().toISOString())
  if (confidence < 0.7) {
    recordUnresolvedLearning(db, jid, input, 'low-confidence')
    return { ...classification, shouldRespond: true, needsHuman: false, text: MSG.clarify }
  }
  if (!classification.learned) confirmPendingLearning(db, jid, intent, new Date(), confidence)
  const selection = contextSelection(db, session, input, classification.request || parseCompoundRequest(input))

  switch (intent) {
    case INTENTS.STOP_MESSAGES: setSuppression(db, jid, true); return { ...classification, shouldRespond: true, text: MSG.stopConfirm }
    case INTENTS.RESUME_MESSAGES: setSuppression(db, jid, false); return { ...classification, shouldRespond: true, text: MSG.resumeConfirm }
    case INTENTS.DELETE_PREFERENCES: clearPreferences(db, jid); return { ...classification, shouldRespond: true, text: 'حذفت بيانات التخصيص المحلية: المحتوى السابق، المحفوظات، السجل والتذكيرات. أبقيت فقط طلب إيقاف الرسائل وفترة استلام الدكتور إن كانا مفعّلين.' }
    case INTENTS.VERIFIED_RESEARCH:
      return { ...classification, ...verifiedResearchReply(db, input) }
    case INTENTS.EXPLAIN_MODE:
      return { ...classification, ...explainModeReply(db, session, input) }
    case INTENTS.DIALOGUE_MODE:
      return { ...classification, ...dialogueModeReply(db, session, input) }
    case INTENTS.HUMAN_HANDOFF:
      return { ...classification, ...humanSafeReply(input) }
    case INTENTS.COMPOUND_REQUEST:
      return { ...classification, ...compoundRequestReply(db, classification.request || selection.request) }
    case INTENTS.CORRECTION:
      return { ...classification, ...correctionReply(db, jid, session, input, classification.correction) }
    case INTENTS.CONTEXT_REFERENCE: {
      const item = selection.item
      if (!item) return { ...classification, text: 'لا يوجد اختيار سابق واضح. اكتب: آخر مقالاته، ثم اختر الأول أو الثاني.' }
      if (selection.request.action === 'listen') return { ...classification, ...listenReply(item, selection.request.voice), contextResolution: selection.resolution }
      if (selection.request.action === 'summary') return { ...classification, ...summaryReply(db, item), contextResolution: selection.resolution }
      if (selection.request.action === 'read') return { ...classification, ...contentReply('هذه المادة', item), contextResolution: selection.resolution }
      return { ...classification, ...contentReply('هذا اختيارك', item), contextResolution: selection.resolution }
    }
    case INTENTS.READ_SPEED:
      return { ...classification, ...extractiveReadingReply(db, selection.item, speedFromRequest(selection.request, input)), preserveContextList: true }
    case INTENTS.IDEA_NETWORK:
      return { ...classification, ...ideaNetworkReply(db, selection.item) }
    case INTENTS.CHALLENGE:
      return { ...classification, ...challengeReply(db, jid) }
    case INTENTS.CHALLENGE_ANSWER:
      return { ...classification, ...challengeAnswerReply(db, session, input) }
    case INTENTS.SOURCE_PROOF:
      return { ...classification, ...sourceProofReply(selection.item), preserveContextList: true }
    case INTENTS.SAVE_CONTENT: {
      if (!selection.item) return { ...classification, text: 'اختر مادة أولاً، ثم اكتب: احفظها.' }
      const alreadySaved = Boolean(db.get('SELECT 1 AS saved FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(jid), selection.item.id))
      if (alreadySaved) {
        return {
          ...classification,
          text: `هذه المادة محفوظة من قبل في رفّك:\n${selection.item.title}\n${selection.item.url}`,
          contentId: selection.item.id,
          contextItems: [selection.item.id],
          seenContentIds: [selection.item.id],
          preserveContextList: true,
        }
      }
      db.run('INSERT OR IGNORE INTO saved_content(jid,content_id,saved_at) VALUES(?,?,?)', db.jidKey(jid), selection.item.id, new Date().toISOString())
      return { ...classification, text: `حفظتها في رفّك الخاص:\n${selection.item.title}\n${selection.item.url}`, contentId: selection.item.id, contextItems: [selection.item.id], seenContentIds: [selection.item.id], preserveContextList: true }
    }
    case INTENTS.LIST_SAVED:
      return { ...classification, ...savedShelfReply(db, jid) }
    case INTENTS.REMOVE_SAVED: {
      if (!selection.item) return { ...classification, text: 'اختر مادة من محفوظاتك أولاً.' }
      const wasSaved = Boolean(db.get('SELECT 1 AS saved FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(jid), selection.item.id))
      if (!wasSaved) {
        return {
          ...classification,
          text: `هذه المادة غير موجودة في رفّك:\n${selection.item.title}`,
          contentId: selection.item.id,
          contextItems: [selection.item.id],
          seenContentIds: [selection.item.id],
          preserveContextList: true,
        }
      }
      db.run('DELETE FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(jid), selection.item.id)
      return { ...classification, text: `حذفتها من رفّك:\n${selection.item.title}`, contentId: selection.item.id, contextItems: [selection.item.id], seenContentIds: [selection.item.id], preserveContextList: true }
    }
    case INTENTS.LATEST_CONTENT: return { ...classification, ...freshContentReply(db) }
    case INTENTS.LATEST_ARTICLES: return { ...classification, ...latestArticlesReply(db, 3) }
    case INTENTS.MOST_VIEWED_ARTICLE: return { ...classification, ...mostViewedArticleReply(db) }
    case INTENTS.CONTENT_OVERVIEW: return { ...classification, ...libraryOverviewReply(db) }
    case INTENTS.TOP_ARTICLE_TOPIC: return { ...classification, ...topTopicsReply(db) }
    case INTENTS.LATEST_ARTICLE: return { ...classification, ...latestOf(db, 'article', 'أحدث مقالة') }
    case INTENTS.LATEST_BOOK: {
      const book = latestContent(db, 'book', 1)[0]
      return { ...classification, ...contentReply(book?.date ? 'أحدث كتاب منشور' : 'كتاب من مؤلفات الدكتور', book) }
    }
    case INTENTS.BOOK_SEARCH:
      return { ...classification, ...bookSearchGatewayReply(db, input, selection.item) }
    case INTENTS.BOOK_CHAPTERS:
      return { ...classification, ...bookChaptersGatewayReply(db, input, selection.item) }
    case INTENTS.BOOK_VIDEOS:
      return { ...classification, ...bookVideosReply(input) }
    case INTENTS.MEDIA_LIBRARY:
      return { ...classification, ...mediaLibraryReply(db, input) }
    case INTENTS.RADIO:
      return { ...classification, ...radioReply(db) }
    case INTENTS.DIALOGUE_LIBRARY:
      return { ...classification, ...dialogueLibraryReply(db) }
    case INTENTS.LATEST_PAPER: return { ...classification, ...latestOf(db, 'paper', 'أحدث بحث') }
    case INTENTS.LATEST_SELECTION: return { ...classification, ...latestOf(db, 'curated', 'أحدث مختارة') }
    case INTENTS.LATEST_PODCAST: return { ...classification, ...latestPodcastReply(db) }
    case INTENTS.MISSED_CONTENT: {
      const row = jid && db.get('SELECT payload FROM user_preferences WHERE jid=?', db.jidKey(jid)); let cursor = ''
      try { cursor = row ? JSON.parse(row.payload).lastContentCursor || '' : '' } catch { cursor = '' }
      const items = cursor ? db.all('SELECT * FROM content_items WHERE date>? ORDER BY date DESC LIMIT 3', cursor) : latestContent(db, 'article', 3)
      return { ...classification, text: items.length ? `من آخر مرة، ظهرت ${arabicCountPhrase(items.length, NEW_MATERIAL_FORMS)}. أبدأ لك بالأحدث؟\n${items.map((item) => `${item.title}\n${item.url}`).join('\n')}` : 'ما فاتك شيء جديد مسجل عندي حتى الآن.', contentId: items[0]?.id, contextItems: items.map((item) => item.id), seenContentIds: items.map((item) => item.id) }
    }
    case INTENTS.SURPRISE_ME: {
      const unseen = selectDailyUnsentContent(db, { jid })
      if (!unseen) {
        return {
          ...classification,
          text: 'مررتَ على كل مواد الأرشيف المسجلة، ولن أكرر عليك مادةً بصمت. اذكر موضوعاً تريده وأعيد لك منه بطلبك.',
          contextItems: [],
          replaceContextList: true,
        }
      }
      return { ...classification, ...contentReply('اخترت لك من الأرشيف', unseen, '\nهذه مادة لم تُرسل لك من قبل.') }
    }
    case INTENTS.ONE_MINUTE: {
      return { ...classification, ...oneMinuteReply(db, session, selection.item), preserveContextList: Boolean(selection.item) }
    }
    /* «لخّص» كان يُوصل إلى ردّ الدقيقة، وردّ الدقيقة يقصّ رأس المتن — وهو بعينه
       ما فُتحت به بوابة اليوم. فيرى السائل نصّاً يظنّه المادة معادةً لا ملخّصاً،
       ودالّة التلخيص الحقيقي (summaryReply) لا تُستدعى إلا من الطلب المركّب.
       الآن للتلخيص بابه: أكثفُ عبارةٍ من كلام الدكتور، منسوخةً حرفاً بحرف. */
    case INTENTS.SUMMARY: {
      const target = selection.item
        || (session?.content_id ? findContent(db, session.content_id) : null)
        || shortReadableContent(db, 1)[0]
        || latestContent(db, 'article', 1)[0]
      return { ...classification, ...summaryReply(db, target), preserveContextList: Boolean(selection.item) }
    }
    /* الترحيب: أول لقاءٍ بين الناس والخدمة. يعرض المدى كلَّه — لا المقالات
       وحدها — لأن من يكتب كلمة الدخول قد يريد بحثاً أو كتاباً أو مقارنة. */
    case INTENTS.WELCOME:
      return { ...classification, ...welcomeReply(db, jid, new Date(), detectMood(input)) }

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
            contextItems: more.citations.map((citation) => `article:${citation.slug}`),
            seenContentIds: more.citations.map((citation) => `article:${citation.slug}`),
            evidenceQuotes: more.citations.map((citation) => citation.quote),
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
      return { ...classification, text: `وهذه قريبةٌ منه:\n${results.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}`, contentId: results[0].id, contextItems: results.map((item) => item.id), seenContentIds: results.map((item) => item.id) }
    }

    /* المقارنة: يفصل الطرفين ثم يعرض ما عنده في كلٍّ منهما */
    case INTENTS.COMPARE: {
      const sides = classification.normalized
        .replace(/^(قارن|مقارنه)\s*(بين)?\s*/, '')
        .replace(/^(الفرق بين|وش الفرق بين|ايهما)\s*/, '')
        .split(/\s+و\s*|\s+وبين\s+/)
        .map((part) => part.trim()).filter((part) => part.length >= 2)
      if (sides.length < 2) return { ...classification, text: 'قارن بين ماذا وماذا؟ اكتب مثلاً: قارن بين التقويم والامتحان.' }
      const foundAcrossSides = []
      const blocks = sides.slice(0, 2).map((side) => {
        /* البحث وحده كان يرشّح مادةً يتصادف ورودُ اللفظ في حاشيتها (٣ﻻـD
           للتلقين). نرجّح المرشّحين بترجيح العالِم: العنوان أثقل من المتن،
           فيصعد ما كُتب في الطرف نفسه لا ما ذُكر فيه عرضاً. */
        const sideTokens = scholarTokens(side)
        const found = searchContent(db, side, { limit: 8 })
          .map((item) => ({ item, score: scholarScore(item, sideTokens) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 2)
          .map((row) => row.item)
        foundAcrossSides.push(...found)
        return found.length
          ? `في «${side}»:\n${found.map((item) => `• ${item.title}\n  ${item.url}`).join('\n')}`
          : `في «${side}»: ما لقيت مادةً مخصّصة.`
      })
      return {
        ...classification,
        text: `${blocks.join('\n\n')}\n\nوالمقارنة نفسها رأيٌ يخصّ الدكتور — وهو يقرأ رسالتك.`,
        contentId: foundAcrossSides[0]?.id,
        contextItems: foundAcrossSides.map((item) => item.id),
        seenContentIds: foundAcrossSides.map((item) => item.id),
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
      if (!picks.length) return { ...classification, text: `المختارات هنا:\n${SITE_URL}/curated` }
      return { ...classification, text: `من مختارات الدكتور:\n${picks.map((item, i) => `${i + 1}. ${item.title}\n${item.url}`).join('\n')}\n\nوالبقية: ${SITE_URL}/curated`, contentId: picks[0].id, contextItems: picks.map((item) => item.id), seenContentIds: picks.map((item) => item.id) }
    }

    case INTENTS.ABOUT_TOPIC:
    case INTENTS.SEARCH_TOPIC:
    case INTENTS.SIMILAR_CONTENT: {
      /* سؤال شخصي تسلّل إلى البحث («كم عمرك؟ وين تسكن؟»): لا يُجاب بمقالات
         عشوائية — مسار خارج النطاق الصادق نفسه */
      const courtesy = courtesyReply(input)
      if (courtesy) return { ...classification, ...courtesy }
      if (CHATTER_OR_PERSONAL.test(classification.normalized)) {
        return { ...classification, ...noSilenceReply(db, input, { offDomain: true }) }
      }
      /* «عندك شي عن التقييم؟» — نحذف حشو السؤال ونبحث في الموضوع نفسه */
      const query = stripGroundedTopicRequest(classification.normalized
        .replace(/^(عندك|عندكم|لديك|في)\s*(شي|شيء|مقال|بحث|كتاب|ماده)?\s*(عن|حول|بخصوص)\s*/, '')
        .replace(/[؟?]/g, '').trim()) || stripGroundedTopicRequest(classification.normalized)
      /* المنطق نفسه صار مشتركاً مع التصحيح («مو عن كذا») عبر topicSearchReply:
         تطابقٌ اسميّ ← كلامُ الدكتور بالبوابة ← قائمةُ روابط ← مصارحة، مع حفظ
         «زدني». فأيّ تحسينٍ للبحث يسري على المسارين معاً. */
      const coverageQuestion = isCoverageQuestion(classification.normalized)
      return { ...classification, ...topicSearchReply(db, jid, query, { coverageQuestion }) }
    }
    case INTENTS.LISTEN_FAHED:
    case INTENTS.LISTEN_NOURA:
    case INTENTS.LISTEN_DIALOGUE: {
      const item = selection.item || latestContent(db, 'article', 1)[0]
      const wanted = intent === INTENTS.LISTEN_FAHED ? 'fahed' : intent === INTENTS.LISTEN_NOURA ? 'noura' : 'dialogue'
      return { ...classification, ...listenReply(item, wanted), preserveContextList: Boolean(selection.item) }
    }
    case INTENTS.CONTINUE_LISTENING:
      return { ...classification, ...listenReply(selection.item || latestAudioContent(db, 'dialogue', 1)[0]), preserveContextList: Boolean(selection.item) }
    case INTENTS.READ_ARTICLE:
      return { ...classification, ...contentReply('رابط المادة المنشورة', selection.item || latestContent(db, 'article', 1)[0]), preserveContextList: Boolean(selection.item) }
    /* «كمل» كان يُصنَّف CONTINUE_READING ثم لا يجد فرعاً له فيسقط إلى الردّ
       العام «أرسل لي اسم الموضوع» — والمادة بين يديه. */
    case INTENTS.CONTINUE_READING: {
      const item = selection.item || (session?.content_id ? findContent(db, session.content_id) : null)
      if (!item) return { ...classification, text: 'اختر مادة أولاً: اكتب آخر مقالاته، ثم قل الأولى أو الثانية.' }
      const next = continueVerbatim(item, '30s')
      if (!next) {
        return { ...classification, ...extractiveReadingReply(db, item, '2min'), preserveContextList: true }
      }
      return {
        ...classification,
        text: `تكملة النصّ المنشور:\n${item.title}\n«${displayQuote(next.text)}»\n${item.url}`,
        contentId: item.id,
        contextItems: [item.id],
        seenContentIds: [item.id],
        evidenceQuotes: [next.text],
        preserveContextList: true,
      }
    }
    case INTENTS.WEEKLY_DIGEST:
      return { ...classification, ...weeklyDigestReply(db) }
    case INTENTS.CONTENT_BY_MOOD: {
      const item = selectDailyUnsentContent(db, { jid })
      if (!item) return { ...classification, text: 'مررتَ على كل مواد الأرشيف المسجلة. اذكر موضوعاً وأختار لك منه.', contextItems: [], replaceContextList: true }
      /* من أفصح عن حاله يُقابَل باعترافٍ بحاله قبل المادة — لا بمادةٍ صمّاء. */
      const reply = extractiveReadingReply(db, item, '30s')
      const prefix = moodPrefix(detectMood(input))
      return { ...classification, ...reply, text: prefix ? `${prefix.trim()}\n\n${reply.text}` : reply.text }
    }
    case INTENTS.QUOTE:
    case INTENTS.QUOTE_CARD: {
      const item = selection.item || latestContent(db, 'article', 1)[0]
      const quote = String(item?.body || item?.excerpt || '').split(/(?<=[.!؟])/u).map((part) => part.trim()).find((part) => part.length >= 25 && part.length <= 180) || item?.excerpt
      return item && quote ? { ...classification, text: `«${displayQuote(quote)}»\n— ${item.title}\n${item.url}`, contentId: item.id, contextItems: [item.id], seenContentIds: [item.id], evidenceQuotes: [quote], quote, preserveContextList: Boolean(selection.item) } : { ...classification, text: 'لا أملك اقتباساً موثقاً مناسباً بعد.' }
    }
    case INTENTS.HELP:
    case INTENTS.SHOW_OPTIONS:
      return { ...classification, text: 'اسألني بطريقتك الطبيعية داخل محتوى الموقع فقط:\n• بوابة اليوم · اختبرني\n• آخر مقالاته أو أبحاثه أو كتبه\n• ابحث داخل كتاب · فيديوهات الكتاب\n• ظهور إعلامي · الراديو · حوار مسموع\n• عندك شيء عن أي موضوع؟\n• ٣٠ ثانية · دقيقتان · تعمّق\n• شبكة الأفكار · المصدر · احفظها · محفوظاتي\n\nولا تحتاج حفظ صيغة ثابتة.' }
    case INTENTS.HUMAN_RESPONSE_REQUIRED: return { ...classification, ...humanSafeReply(input) }
    case INTENTS.REMIND_ME: {
      const parsed = parseReminderTime(input)
      if (parsed.ambiguous) return { ...classification, needsHuman: false, text: 'أقدر أذكّرك محلياً، لكن أحتاج وقتاً واضحاً مثل: الجمعة الساعة 7 مساءً.' }
      const reminderItem = selection.item
      if (!reminderItem) return { ...classification, text: 'اختر مادةً من الموقع أولاً، ثم اكتب مثلاً: ذكرني بها باجر.' }
      /* المجدول القديم يعرض original_text عند حلول الموعد؛ لذلك لا نخزّن
         كلام المستخدم الحر فيه أصلاً. العبارة الثابتة + عنوان/رابط المادة هما
         وحدهما ما سيخرج من البوت. */
      const id = createReminder(db, { jid, contentId: reminderItem.id, originalText: 'موعد قراءة المادة المنشورة.', dueAt: parsed.dueAt })
      return {
        ...classification,
        text: `تم حفظ التذكير لهذه المادة (${new Date(parsed.dueAt).toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })}):\n${reminderItem.title}\n${reminderItem.url}`,
        reminderId: id,
        contentId: reminderItem.id,
        contextItems: [reminderItem.id],
        seenContentIds: [reminderItem.id],
        preserveContextList: true,
      }
    }
    default: return { ...classification, needsHuman: false, text: 'أرسل لي اسم الموضوع أو اكتب: شنو تقدر تسوي؟' }
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
  /* wake_version=0 يعني جلسةً ورثناها من زمن كانت فيه أوامر كثيرة تفتح الباب.
     لا نستطيع إثبات أنها بدأت بالجملة الحالية، لذلك تُغلق مرةً واحدة بأمان. */
  return Boolean(session && Number(session.wake_version || 0) >= 1 && ['content-session', 'auto'].includes(session.mode))
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

export function shouldRespondToMessage({ db, jid, text, isReplyToAgent = false, explicitContentSession = false, hasMedia = false, at = new Date(), classification = classifyIntentWithLearning(db, text) }) {
  if (!jid) return { allowed: false, reason: 'missing-jid' }

  /* ═══ المنع المطلق: المجموعات ═══
     بأمر الدكتور صراحةً: «ما يصير يرد بالقروب إطلاقاً». وهو قبل كل شيء —
     قبل الجلسة، وقبل جملة الإيقاظ، وقبل أوامر الخصوصية — لأن الجملة تُكتب
     في القروب فتفتح جلسةً، فيصير البوت يردّ على ما يُقال فيه.
     وهذا ما وقع فعلاً: ثمانية ردود في ثلاث دقائق داخل مجموعة.
     ولا يُستثنى شيء: من أراد البوت راسله وحده. */
  if (!isPrivateChat(jid)) return { allowed: false, reason: `${chatKindLabel(jid)} — لا ردّ فيها إطلاقاً` }

  const session = pendingSession(db, jid)
  const classification0 = classification
  const { intent, confidence } = classification0
  const opensDoor = OPENS_DOOR.has(intent) && confidence >= 0.9

  /* الوسائط صامتة بلا استثناء: لا ننفذ حتى أمراً مكتوباً في وصف صورة أو
     صوت، لأن الوكيل لا يستطيع إثبات أن النص هو المقصود المستقل عن الوسيط. */
  if (hasMedia) return { allowed: false, reason: 'وسائط — لا يردّ البوت على صوتٍ ولا صورة' }

  /* أوامر الخصوصية تُنفَّذ دائماً، حتى لمن سبق أن طلب الإيقاف. وإذا كان
     الدكتور يتكلم بيده تُنفّذ بلا ردّ آلي: اليد أعلى سلطة، والخصوصية لا
     تنتظر. فـ«التنفيذ» و«الكلام» قراران منفصلان. */
  if (intent === INTENTS.STOP_MESSAGES || intent === INTENTS.RESUME_MESSAGES || intent === INTENTS.DELETE_PREFERENCES) {
    const manual = Boolean(session?.manual_until && new Date(session.manual_until) > at)
    /* أمر الخصوصية المكتوب في وصف صورة يُنفّذ أيضاً، لكن بلا ردٍّ على الوسيط. */
    return { allowed: true, reason: 'privacy-command', executeSilently: manual || hasMedia }
  }

  /* الإيقاف يحجب المحتوى، لكنه لا يحجب «رجع الرسائل» أعلاه. كان ترتيب هذين
     السطرين يجعل الإلغاء طريقاً بلا عودة. */
  if (isSuppressed(db, jid)) return { allowed: false, reason: 'suppressed' }

  /* ═══ كتب الدكتور بيده: صمتٌ مطلق حتى تنقضي المدة ═══
   * الرقم شخصي، ولذلك تدخّل الدكتور هو أعلى سلطة. لا تستطيع جملة الإيقاظ
   * ولا جلسة سابقة ولا اقتباسٌ من البوت أن تعيد الرد الآلي أثناء حديثه. */
  if (session?.manual_until && new Date(session.manual_until) > at) {
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
  /* اقتباس ردّ البوت لا يفتح الباب من خلف جملة الإيقاظ. إن كانت الجلسة
     مفتوحة فالاقتباس يعمل ضمنها طبيعياً؛ وإن لم تُفتح، يبقى صامتاً. */
  const activeSession = explicitContentSession || sessionAlive(session)
  const sensitive = sensitiveDomain(text)
  const groundedFallback = classification0.fallback && isGroundedTopicPhrase(db, text)
  /* القاعدة المحفوظة من لوحة التحكم أمرٌ مفهوم داخل جلسة مستيقظة، حتى لو كان
     المصنّف العام لا يعرف صياغتها. لا تفتح القاعدة الباب بنفسها؛ هي تعمل فقط
     بعد الإيقاظ أو في المعاينة الصريحة. */
  const configuredRule = activeSession ? matchReplyRule(db, text) : null
  const understood = (intent !== INTENTS.UNKNOWN && confidence >= 0.7 && !classification0.fallback) || groundedFallback || Boolean(configuredRule) || Boolean(sensitive)
  if (activeSession && understood) return { allowed: true, reason: groundedFallback ? 'content-session-grounded-search' : classification0.learned ? 'content-session-learned' : 'content-session' }
  if (activeSession && !understood) {
    recordUnresolvedLearning(db, jid, text, classification0.fallback ? 'ungrounded-fallback' : 'unknown-after-wake')
    /* عقد الجلسة المستيقظة صريح: كل رسالة جديدة تحصل على دور حوار. إذا لم
       يفهمها المحرك يسأل أو يقترح مساراً مفيداً؛ لا يحوّل الغموض إلى صمت
       يبدو للمستخدم كأن البوت فصل. تدخل الدكتور اليدوي وحده يغلق الجلسة. */
    return { allowed: true, reason: 'active-clarify' }
  }
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
  let classification = classifyIntentWithLearning(db, text)
  const sensitive = sensitiveDomain(text)
  const normalizedInput = clean(text)
  const personalSensitive = Boolean(sensitive && /(?:انا|اني|لي|عندي|حالتي|مرضي|صحتي|ابني|بنتي|زوجي|زوجتي|والدي|والدتي|شنو اسوي|ماذا افعل|ساعدني)/.test(normalizedInput))
  /* طلب البحث العام في الصحة أو القانون يبقى ممكناً من سجل أدلة رسمي، لكن
     الحالة الشخصية تُحوّل دائماً إلى الإنسان حتى لو احتوت عبارة «بحث موثق»؛
     فرق الثقة بين النيتين لا يجوز أن يحوّل سؤال علاجٍ فردي إلى جواب آلي. */
  if (needsHumanOnly(text) || (sensitive && (personalSensitive || classification.intent === INTENTS.UNKNOWN || classification.fallback))) {
    classification = { intent: INTENTS.HUMAN_HANDOFF, confidence: 0.99, normalized: normalizedInput, knowledgeMode: KNOWLEDGE_MODES.HUMAN }
  }
  const gate = shouldRespondToMessage({ db, jid, text, isReplyToAgent, explicitContentSession, hasMedia, at, classification })
  const session = db.get('SELECT * FROM chat_sessions WHERE jid=?', db.jidKey(jid))
  if (!gate.allowed) return { ...gate, shouldRespond: false }
  const response = handleIntent({ db, jid, input: text, session, classification })
  response.mode = response.mode || KNOWLEDGE_MODES.ARCHIVE
  if (gate.executeSilently) {
    return { ...gate, ...response, text: '', shouldRespond: false, privacyApplied: true }
  }
  const isPrivacyReply = gate.reason === 'privacy-command'
  /* الباب انفتح بأمرٍ صريح: تُفتح الجلسة ولو لم يكن في الردّ مادة — وإلا
     رحّبنا بالقادم ثم صمتنا عن سؤاله التالي، وهو أسوأ من ألا نرحّب. */
  if (gate.opensSession && !response.contentId) {
    const stamp = new Date().toISOString()
    db.run('INSERT INTO chat_sessions(jid,mode,wake_version,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,wake_version=excluded.wake_version,manual_until=NULL,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at', db.jidKey(jid), 'content-session', 1, stamp, stamp, stamp)
  }
  const persistSession = Boolean(gate.opensSession || explicitContentSession || sessionAlive(session))
  if (response.contentId) {
    const now = new Date().toISOString()
    if (persistSession) {
      db.run('INSERT INTO chat_sessions(jid,mode,content_id,wake_version,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(jid) DO UPDATE SET mode=excluded.mode,wake_version=excluded.wake_version,manual_until=NULL,content_id=excluded.content_id,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at', db.jidKey(jid), 'content-session', response.contentId, 1, now, now, now)
      const item = findContent(db, response.contentId)
      if (item?.date) savePreference(db, jid, { lastContentCursor: item.date })
    }
  }

  /* ذاكرة الإشارة لا تحفظ نصوصاً ولا روابط: معرّفات مواد الموقع وترتيبها
     فقط. الاختيار المفرد داخل قائمةٍ سابقة يغيّر المؤشر ولا يمحو القائمة،
     ولذلك يبقى «اللي قبله/بعده» صحيحاً بعد التلخيص أو الاستماع. */
  if (persistSession && !isPrivacyReply) {
    let nextContext = parseConversationContext(session?.context_json)
    if (response.contextResolution) {
      nextContext = applyReferenceResolution(nextContext, response.contextResolution, { lastIntent: response.intent })
    } else if (Array.isArray(response.contextItems) && (response.contextItems.length || response.replaceContextList)) {
      const currentId = response.contentId || response.contextItems[0]
      const existingIndex = nextContext.resultIds.indexOf(currentId)
      if (response.preserveContextList && response.contextItems.length === 1 && existingIndex >= 0) {
        nextContext = setContextResults(nextContext, nextContext.resultIds, { currentIndex: existingIndex, lastIntent: response.intent })
      } else {
        const selectedIndex = Math.max(0, response.contextItems.indexOf(currentId))
        nextContext = setContextResults(nextContext, response.contextItems, {
          currentIndex: selectedIndex,
          lastIntent: response.intent,
          lastTopic: response.contextTopic,
          lastKind: response.contextKind,
        })
      }
    } else if (response.contentId) {
      const existingIndex = nextContext.resultIds.indexOf(response.contentId)
      nextContext = existingIndex >= 0
        ? setContextResults(nextContext, nextContext.resultIds, { currentIndex: existingIndex, lastIntent: response.intent })
        : setContextResults(nextContext, [response.contentId], { currentIndex: 0, lastIntent: response.intent })
    }
    if (response.challengeContext) nextContext = { ...nextContext, challenge: response.challengeContext }
    if (response.clearChallenge) nextContext = { ...nextContext, challenge: null }
    const contextJson = serializeConversationContext(nextContext)
    const stamp = new Date().toISOString()
    db.run(
      'INSERT INTO chat_sessions(jid,mode,context_json,opened_at,last_user_at,updated_at) VALUES(?,?,?,?,?,?)'
      + ' ON CONFLICT(jid) DO UPDATE SET context_json=excluded.context_json,last_user_at=excluded.last_user_at,updated_at=excluded.updated_at',
      db.jidKey(jid), 'content-session', contextJson, stamp, stamp, stamp,
    )
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
  const signed = sign(response.text || '', { skip: isPrivacyReply })
  const evidenceIds = [...new Set([
    response.contentId,
    ...(Array.isArray(response.contextItems) ? response.contextItems : []),
  ].filter(Boolean))].slice(0, 20)
  if (!isPrivacyReply && signed && evidenceIds.length) {
    db.run(
      'INSERT INTO answer_evidence(jid,intent,content_ids_json,reply_hash,created_at) VALUES(?,?,?,?,?)',
      jid ? db.jidKey(jid) : null,
      String(response.intent || classification.intent || 'UNKNOWN'),
      JSON.stringify(evidenceIds),
      hashOpaque(signed),
      new Date().toISOString(),
    )
  }
  return { ...gate, ...response, text: signed, shouldRespond: true, privacyApplied: isPrivacyReply }
}

export function describeTimeZone() { return TIME_ZONE }
