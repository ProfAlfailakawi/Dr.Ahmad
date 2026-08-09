import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { absorbContacts, addContactByPhone } from './audience.mjs'
import {
  containsInboundLink,
  createAgent,
  dispatchDueReminders,
  validateGroundedResponse,
} from './agent.mjs'
import { BOT_SIGNATURE, ensureBotRulesSchema, needsHumanOnly } from './bot-rules.mjs'
import {
  contentSummary,
  findContent,
  latestAudioContent,
  latestContent,
  normalizeArabic,
  searchContent,
  syncContentIndex,
} from './content-index.mjs'
import {
  applyReferenceResolution,
  createConversationContext,
  currentResultId,
  isSiteContentId,
  normalizeContextText,
  parseCompoundRequest,
  parseConversationContext,
  parseDuration,
  parseOrdinal,
  resolveContextReference,
  sanitizeResultIds,
  serializeConversationContext,
  setContextResults,
} from './conversation-context.mjs'
import { AUDIO_PUBLIC_BASE_URL, SITE_URL } from './config.mjs'
import { hashOpaque } from './crypto.mjs'
import {
  extractVerbatimAtSpeed,
  isVerbatimFromItem,
  selectDailyUnsentContent,
} from './daily-experience.mjs'
import { openDatabase } from './db.mjs'
import { toRoot } from './dialect-lexicon.mjs'
import {
  INTENTS,
  chatKindLabel,
  classifyIntent,
  understandMessage,
  handleIncoming,
  handleIntent,
  isPrivateChat,
  markManualTakeover,
  setSuppression,
  shouldRespondToMessage,
} from './intent-engine.mjs'
import { MockTransport } from './transport.mjs'

const FIXED_NOW = new Date('2026-07-21T12:00:00+03:00')

function cleanLink(link) {
  return String(link || '').replace(/[)\]}>،؛,.!?]+$/u, '')
}

function linksIn(text) {
  return [...String(text || '').matchAll(/https?:\/\/[^\s]+/gu)].map((match) => cleanLink(match[0]))
}

function sourceOf(item) {
  return String(item?.excerpt || item?.body || '').replace(/\s+/g, ' ').trim()
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean).length
}

function sortedUnique(values) {
  return [...new Set(values.map(String))].sort()
}

/**
 * اختبار أحمر/أخضر مولّد حتمياً لقواعد الدكتور المطلقة.
 *
 * لا شبكة، لا واتساب حقيقي، ولا قاعدة إنتاج. كل شيء يعمل في ذاكرة مؤقتة،
 * ويُحصى كل صف مولّد بوصفه حالة مستقلة حتى لا يخفي اختبار واحد عشرات الفروع.
 */
export async function runNuclearSelfTest(root = process.cwd()) {
  process.env.WHATSAPP_AGENT_KEY ||= Buffer.alloc(32, 19).toString('base64')

  const db = openDatabase(':memory:', { cryptoOptions: { allowEphemeral: true } })
  ensureBotRulesSchema(db)
  const indexed = syncContentIndex(db, root, SITE_URL)
  assert.ok(indexed.count >= 10, 'الفهرس المحلي يجب أن يضم مواد منشورة قبل الاختبار')

  let total = 0
  let passed = 0
  const byCategory = new Map()
  const failures = []

  const check = (category, label, assertion) => {
    total += 1
    const stats = byCategory.get(category) || { total: 0, passed: 0 }
    stats.total += 1
    byCategory.set(category, stats)
    try {
      assertion()
      passed += 1
      stats.passed += 1
    } catch (error) {
      failures.push({ category, label, message: error?.message || String(error) })
    }
  }

  const checkAsync = async (category, label, assertion) => {
    total += 1
    const stats = byCategory.get(category) || { total: 0, passed: 0 }
    stats.total += 1
    byCategory.set(category, stats)
    try {
      await assertion()
      passed += 1
      stats.passed += 1
    } catch (error) {
      failures.push({ category, label, message: error?.message || String(error) })
    }
  }

  const gate = (args) => shouldRespondToMessage({ ...args, db, at: FIXED_NOW })
  const incoming = (args) => handleIncoming({ ...args, db, at: FIXED_NOW })

  try {
    /* ═══ 1) لا يوقظه إلا اسم الموقع المنشور ═══ */
    const wakePhrases = [
      'موقع د. أحمد',
      'موقع د أحمد',
      'مَوْقِع د. أَحْمَد',
      '  موقع   د.   أحمد  ',
      'موقع د. احمد؟',
      'موقع د. الفيلكاوي',
      'موقع د الفيلكاوي',
      'مَوْقِع د. الفيلكاوي',
      '  موقع   د.   الفيلكاوي  ',
      'موقع د. الفيلكاوي؟',
    ]
    const privateSuffixes = ['@s.whatsapp.net', '@c.us', '@lid']
    for (const [phraseIndex, phrase] of wakePhrases.entries()) {
      for (const [suffixIndex, suffix] of privateSuffixes.entries()) {
        check('wake', `${phrase} / ${suffix}`, () => {
          const result = gate({ jid: `710${phraseIndex}${suffixIndex}${suffix}`, text: phrase })
          assert.equal(result.allowed, true)
          assert.equal(result.reason, 'command-opens-door')
          assert.equal(result.opensSession, true)
        })
      }
    }

    const noWakePhrases = [
      'الموقع', 'أبي موقع', 'وين الموقع', 'هذا موقع جميل', 'موقع المقالات',
      'موقع أحمد', 'موقع الفيلكاوي', 'موقع د. محمد', 'موقع الأستاذ أحمد',
      'د. أحمد', 'الدكتور أحمد', 'شلونك دكتور', 'السلام عليكم',
      'مكتبة د. أحمد', 'إصدارات الدكتور', 'المنصة', 'حساب الدكتور',
      'اسأل الدكتور', 'اسأل د. أحمد', 'اسال الدكتور: آخر مقاله',
      'آخر مقالة', 'أحدث مقال', 'آخر مقالاته', 'آخر بودكاست', 'أبحاث الدكتور',
      'كتب الدكتور', 'مقالات د. أحمد', 'شنو جديد الدكتور',
      'شنو أكثر مقالة مشاهدة', 'فاجئني', 'لخص هذا', 'عندي دقيقة',
      'صوت نورة', 'الحوار', 'مقالاتك رائعة', 'أبي رأيك', 'وظيفة',
      'لا تفتح موقع د أحمد', 'لا تشغل موقع د أحمد', 'لا أبي موقع د أحمد',
      'لا ترد موقع د أحمد', 'مو قصدي موقع د أحمد', 'سكر موقع د أحمد',
    ]
    for (const [phraseIndex, phrase] of noWakePhrases.entries()) {
      for (const [suffixIndex, suffix] of privateSuffixes.entries()) {
        check('no-wake', `${phrase} / ${suffix}`, () => {
          const result = gate({ jid: `720${phraseIndex}${suffixIndex}${suffix}`, text: phrase })
          assert.equal(result.allowed, false)
          assert.notEqual(result.reason, 'command-opens-door')
        })
      }
    }
    const quotedWithoutWake = ['آخر مقالة', 'لخص الثاني', 'عندك شي عن التعليم؟', 'زدني']
    for (const [index, text] of quotedWithoutWake.entries()) {
      check('no-wake', `اقتباس بلا جلسة / ${text}`, () => {
        const result = gate({ jid: `725${index}@s.whatsapp.net`, text, isReplyToAgent: true })
        assert.equal(result.allowed, false)
      })
    }

    /* ═══ 2) ما يحتاج إنساناً يأخذ رد حدودٍ آمناً بعد الإيقاظ، بلا وعد متابعة ═══ */
    const humanOnlyPhrases = [
      'أبي استشارة', 'محتاج موعد', 'أبي أقابلك', 'رسالة ماجستير', 'أبي إشراف',
      'ساعدني', 'محتاج مساعدة', 'عندي مشكلة', 'أنا ضايج', 'أنا زعلان',
      'عندي شكوى', 'من صحيفة', 'من جريدة', 'من قناة', 'أنا صحفي',
      'لقاء إعلامي', 'أحتاج توصية', 'أحتاج تزكية', 'شهادة خبرة', 'أبي وظيفة',
      'رفضوني', 'أنا مظلوم', 'راتبي قليل', 'عايش بفقر', 'محتاج شغل',
      'بدون عمل', 'أنا عاطل', 'تعبت', 'مكتئب', 'ادعيلي', 'بالله عليك',
      'please help me', 'I need a job', 'my salary is low', 'living in poverty',
      'I am unemployed', 'they rejected me', 'visa problem', 'residence permit',
      'I need a scholarship', 'PhD supervision', 'recommendation letter',
      'I am tired', 'I am depressed', 'I am struggling', 'I suffer every day',
      'ودي أموت', 'أفكر أنتحر', 'أبي أؤذي نفسي', 'I want to kill myself',
      'I am thinking about suicide', 'I want to hurt myself',
      'أبي تشخيص حالتي', 'أقدر أوقف دوائي؟', 'أبي نصيحة قانونية',
      'أبي أستثمر فلوسي', 'أعطني فتوى', 'call me urgently',
    ]
    for (const [index, phrase] of humanOnlyPhrases.entries()) {
      check('human-only-detection', phrase, () => {
        assert.equal(needsHumanOnly(normalizeArabic(phrase)), true)
      })
      check('human-only-safe-reply', phrase, () => {
        const jid = `730${index}@s.whatsapp.net`
        const result = gate({
          jid,
          text: phrase,
          explicitContentSession: true,
        })
        assert.equal(result.allowed, true)
        const response = incoming({ jid, text: phrase, explicitContentSession: true })
        assert.equal(response.shouldRespond, true)
        assert.ok(String(response.text || '').length > 20)
        assert.equal(response.needsHuman, false)
        assert.doesNotMatch(response.text || '', /متابعه بشريه|سيكمل معك الفريق|سيرد عليك الدكتور/u)
      })
    }

    /* ═══ 3) المجموعات والأنواع غير الفردية والوسائط: منع مطلق ═══ */
    const nonPrivateJids = [
      '120363000000000001@g.us',
      '120363000000000002@g.us',
      'status@broadcast',
      '96500000000@broadcast',
      '120363000000000003@newsletter',
      'channel@newsletter',
      'someone@unknown',
      'plain-value',
    ]
    const blockedEverywhere = [
      'موقع د. أحمد',
      'موقع د. الفيلكاوي',
      'أوقف الرسائل',
      'امسح اللي تعرفه عني',
      'آخر مقالة',
    ]
    for (const jid of nonPrivateJids) {
      check('chat-kind', jid, () => {
        assert.equal(isPrivateChat(jid), false)
        assert.ok(chatKindLabel(jid))
      })
      for (const text of blockedEverywhere) {
        check('non-private-silence', `${jid} / ${text}`, () => {
          const result = gate({ jid, text, explicitContentSession: true })
          assert.equal(result.allowed, false)
          assert.notEqual(result.reason, 'personal-chat-default')
        })
      }
    }

    const mediaTexts = [
      'موقع د. أحمد', 'موقع د. الفيلكاوي', 'آخر مقالة',
      'أوقف الرسائل', 'لخص هذا', 'عندك شي عن التعليم؟',
    ]
    for (const [suffixIndex, suffix] of privateSuffixes.entries()) {
      for (const [textIndex, text] of mediaTexts.entries()) {
        check('media-silence', `${suffix} / ${text}`, () => {
          const result = gate({
            jid: `740${suffixIndex}${textIndex}${suffix}`,
            text,
            hasMedia: true,
            explicitContentSession: true,
          })
          assert.equal(result.allowed, false)
          assert.match(result.reason, /وسائط/u)
        })
      }
    }

    /* ═══ 4) لهجة كويتية وفصحى تلتقيان في الاسترجاع لا في التأليف ═══ */
    const dialectPairs = [
      ['مدارس', 'مدرسه'], ['طلبه', 'طالب'], ['مدرس', 'معلم'], ['مقررات', 'منهج'],
      ['اختبار', 'امتحان'], ['علامه', 'امتحان'], ['فروض', 'واجب'], ['جامعه', 'شهاده'],
      ['تلقين', 'حفظ'], ['استيعاب', 'فهم'], ['تقنيه', 'تكنولوجيا'], ['روبوت', 'ذكاء'],
      ['نت', 'انترنت'], ['جوال', 'هاتف'], ['موبايل', 'هاتف'], ['قيمر', 'العاب'],
      ['عائله', 'اسره'], ['ناس', 'مجتمع'], ['عيال', 'طفل'], ['يهال', 'طفل'],
      ['مراهق', 'شباب'], ['جذور', 'هويه'], ['الكويت', 'كويت'], ['اخلاق', 'قيم'],
      ['قلق', 'خوف'], ['تفوق', 'نجاح'], ['رسوب', 'فشل'], ['فرح', 'سعاده'],
      ['هم', 'حزن'], ['ارهاق', 'ضغط'], ['استقلال', 'حريه'], ['تضليل', 'وهم'],
      ['فلوس', 'ثراء'], ['عوز', 'فقر'], ['اكتئاب', 'صحه'], ['جراه', 'شجاعه'],
      ['مثابره', 'صبر'], ['كتب', 'قراءه'], ['غد', 'مستقبل'], ['ذكري', 'ماضي'],
      ['صحافه', 'اعلام'], ['حكومه', 'سياسه'], ['سوق', 'اقتصاد'], ['ايمان', 'دين'],
      ['مشاعر', 'حب'], ['شغل', 'عمل'], ['فراغ', 'وقت'], ['خصوصي', 'دروس'],
      ['ابتكار', 'ابداع'], ['وايد', 'وايد'], ['شوي', 'شوي'],
    ]
    for (const [dialect, root] of dialectPairs) {
      check('dialect-root', `${dialect} = ${root}`, () => {
        assert.equal(toRoot(dialect), toRoot(root))
      })
    }

    const normalizationPairs = [
      ['أَحْمَد', 'احمد'], ['إختبار', 'اختبار'], ['آراء', 'اراء'], ['مدرسة', 'مدرسه'],
      ['فتى', 'فتي'], ['مـقـال', 'مقال'], ['نُورَة', 'نوره'], ['التَّعْلِيم', 'التعليم'],
      ['موقع!!!', 'موقع'], ['  أكثر   من   فراغ ', 'اكثر من فراغ'],
      ['رؤية', 'رويه'], ['مسؤول', 'مسوول'], ['بيئة', 'بييه'], ['هُوِيَّة', 'هويه'],
      ['د. أحمد', 'د احمد'], ['السؤال؟', 'السوال'], ['الأولى', 'الاولي'],
      ['مقالة، قصيرة', 'مقاله قصيره'], ['إقرأها', 'اقراها'], ['شيء', 'شيء'],
    ]
    for (const [variant, canonical] of normalizationPairs) {
      check('arabic-normalization', `${variant} -> ${canonical}`, () => {
        assert.equal(normalizeArabic(variant), normalizeArabic(canonical))
        assert.equal(normalizeContextText(variant), normalizeContextText(canonical))
      })
    }

    /* ═══ ٤ب) الفهم: أن يُقرأ ما كُتب كما قُصد ═══
       المتابع لا يكتب فصحى مصحَّحة: يمطّ الحرف، ويكتب بالعربيزي، ويسقط منه
       حرف. هذه الحالات كانت تخرج من الفهم إلى «ما لقيت». */
    const elongationPairs = [
      ['شلوووونك', 'شلونك'], ['مررررحبا', 'مرحبا'], ['مقااااال', 'مقال'],
      ['التعلييييم', 'التعليم'], ['ابييييي', 'ابي'], ['شكراااا', 'شكرا'],
    ]
    for (const [stretched, plain] of elongationPairs) {
      check('comprehension-elongation', `${stretched} = ${plain}`, () => {
        assert.equal(normalizeArabic(stretched), normalizeArabic(plain))
      })
    }

    /* علاماتٌ غير مرئية تأتي مع اللصق من التطبيقات: كانت تشطر الكلمة. */
    const invisiblePairs = [
      ['التعليم\u200f', 'التعليم'], ['\u200bمقال', 'مقال'], ['التربية\ufeff', 'التربية'],
      ['الذكاء\u200dالاصطناعي', 'الذكاءالاصطناعي'],
    ]
    for (const [dirty, clean] of invisiblePairs) {
      check('comprehension-invisible', `${JSON.stringify(dirty)} = ${clean}`, () => {
        assert.equal(normalizeArabic(dirty), normalizeArabic(clean))
      })
    }

    /* الهمزة على كرسيّها: من يكتب بسرعةٍ يكتب «سوال» و«مسوول». */
    const hamzaPairs = [
      ['سؤال', 'سوال'], ['مسؤول', 'مسوول'], ['رؤية', 'روية'], ['بيئة', 'بييه'], ['مبادئ', 'مبادي'],
    ]
    for (const [formal, typed] of hamzaPairs) {
      check('comprehension-hamza', `${formal} = ${typed}`, () => {
        assert.equal(normalizeArabic(formal), normalizeArabic(typed))
      })
    }

    /* العربيزي: رسالةٌ بالحروف اللاتينية تُقرأ عربيةً فتُفتح لها نيّة. */
    const arabiziCases = [
      ['3ndk maqal 3an el ta3leem', 'عندك مقال عن التعليم'],
      ['abi maqal 3an alta3leem', 'ابي مقال عن التعليم'],
      ['wain maqalat el doctor', 'وين مقالات الدكتور'],
      ['3ndk kitab 3an altarbiya', 'عندك كتاب عن التربية'],
    ]
    for (const [latin, arabic] of arabiziCases) {
      check('comprehension-arabizi', latin, () => {
        const understood = understandMessage(db, latin)
        assert.equal(understood.changed, true)
        assert.equal(understood.text, normalizeArabic(arabic))
        assert.equal(classifyIntent(understood.text).intent, classifyIntent(arabic).intent)
      })
    }

    /* ولا يُعاد كتابة ما فُهم أصلاً، ولا ما كان لإنسانٍ لا لأرشيف. */
    const untouchedMessages = [
      'ابي مقال عن التعليم',
      'ادعيلي',
      'لخص الأولى',
      'ألغاء الاشتراك',
      'عندي حالة صحية وأبي نصيحة',
    ]
    for (const message of untouchedMessages) {
      check('comprehension-restraint', message, () => {
        assert.equal(understandMessage(db, message).changed, false)
      })
    }

    /* ═══ 5) الطلب المركب: نوع + زمن + طول + صوت + فعل في مرور واحد ═══ */
    const kindWords = [
      ['مقالة', 'article'], ['بحث', 'paper'], ['كتاب', 'book'],
      ['بودكاست', 'podcast'], ['مختارة', 'curated'],
    ]
    const voiceWords = [
      ['', null], ['بصوت نورة', 'noura'], ['بصوت فهد', 'fahed'], ['بصوت الحوار', 'dialogue'],
    ]
    for (const [kindWord, kind] of kindWords) {
      for (const [voiceWord, voice] of voiceWords) {
        const phrase = `أبي أحدث ${kindWord} قصيرة عن التقييم ${voiceWord}`.trim()
        check('compound-request', phrase, () => {
          const parsed = parseCompoundRequest(phrase)
          assert.equal(parsed.kind, kind)
          assert.equal(parsed.latest, true)
          assert.deepEqual(parsed.duration, { seconds: 120, mode: 'max' })
          assert.equal(parsed.voice, voice)
          assert.match(parsed.topic || '', /تقييم/u)
          if (voice) assert.equal(parsed.action, 'listen')
        })
      }
    }

    const durationCases = [
      ['نصف دقيقة', 30, 'exact'], ['نص دقيقه', 30, 'exact'], ['دقيقتين', 120, 'exact'],
      ['ثلاث دقايق', 180, 'exact'], ['5 دقائق', 300, 'exact'], ['١٥ دقيقة', 900, 'exact'],
      ['30 ثانية', 30, 'exact'], ['ساعة', 3600, 'exact'], ['شي قصير', 120, 'max'],
      ['ما عندي وقت', 120, 'max'], ['على السريع', 120, 'max'], ['الزبدة', 120, 'max'],
    ]
    for (const [phrase, seconds, mode] of durationCases) {
      check('duration-parser', phrase, () => {
        assert.deepEqual(parseDuration(phrase), { seconds, mode })
      })
      check('duration-not-reference', phrase, () => {
        assert.equal(parseCompoundRequest(phrase).ordinal, null)
      })
    }

    /* العبارات التي يعرضها الترحيب يجب أن تعمل كما يكتبها الإنسان فعلاً،
       لا بصيغتها المجردة وحدها. والأزمنة هنا مقاطع حرفية، لا تلخيصاً مولداً. */
    const naturalSpeedCases = [
      ['٣٠ ثانية', INTENTS.READ_SPEED, '30s'],
      ['أبي ٣٠ ثانية', INTENTS.READ_SPEED, '30s'],
      ['عطني ٣٠ ثانية', INTENTS.READ_SPEED, '30s'],
      ['دقيقتان', INTENTS.READ_SPEED, '2min'],
      ['أبي دقيقتين', INTENTS.READ_SPEED, '2min'],
      ['خلها دقيقتان', INTENTS.READ_SPEED, '2min'],
      ['تعمّق', INTENTS.READ_SPEED, 'deep'],
      ['أبي التعمق', INTENTS.READ_SPEED, 'deep'],
    ]
    const speedItem = db.all("SELECT * FROM content_items WHERE kind='article' AND words>=300 ORDER BY date DESC LIMIT 1")[0]
    assert.ok(speedItem, 'نحتاج مقالة طويلة لاختبار سرعات القراءة')
    for (const [phrase, expectedIntent, speed] of naturalSpeedCases) {
      check('natural-speed', `تصنيف: ${phrase}`, () => {
        assert.equal(classifyIntent(phrase).intent, expectedIntent)
      })
      check('natural-speed', `تنفيذ على الاختيار الحالي: ${phrase}`, () => {
        const response = handleIntent({
          db,
          jid: `speed-${hashOpaque(phrase)}@s.whatsapp.net`,
          input: phrase,
          session: { content_id: speedItem.id },
          classification: classifyIntent(phrase),
        })
        assert.equal(response.contentId, speedItem.id)
        if (speed !== 'deep') {
          assert.equal(response.evidenceQuotes?.length, 1)
          assert.equal(isVerbatimFromItem(speedItem, response.evidenceQuotes[0]), true)
        }
      })
    }

    const longArticles = db.all(
      "SELECT * FROM content_items WHERE kind='article' AND words>=300 AND trim(coalesce(body,''))<>'' ORDER BY date DESC LIMIT 36",
    )
    assert.ok(longArticles.length >= 12, 'نحتاج عينة كبيرة لقياس السرعات لا مثالاً واحداً')
    for (const item of longArticles) {
      check('extractive-speed-30s', item.id, () => {
        const extract = extractVerbatimAtSpeed(item, '30s')
        assert.ok(extract)
        assert.equal(isVerbatimFromItem(item, extract.text), true)
        assert.equal([item.body, item.excerpt].some((value) => String(value || '').includes(extract.text)), true)
        assert.ok(extract.words >= 40 && extract.words <= 85, `المقطع ${extract.words} كلمة؛ لا يقارب ٣٠ ثانية`)
        assert.equal(extract.words, wordCount(extract.text))
      })
      check('extractive-speed-2min', item.id, () => {
        const extract = extractVerbatimAtSpeed(item, '2min')
        const quick = extractVerbatimAtSpeed(item, '30s')
        assert.ok(extract)
        assert.equal(isVerbatimFromItem(item, extract.text), true)
        assert.equal([item.body, item.excerpt].some((value) => String(value || '').includes(extract.text)), true)
        assert.ok(extract.words >= 180 && extract.words <= 280, `المقطع ${extract.words} كلمة؛ لا يقارب دقيقتين`)
        assert.ok(extract.words > quick.words)
        assert.equal(extract.words, wordCount(extract.text))
      })
    }

    const ordinalWords = [
      ['الأول', 1], ['الثاني', 2], ['الثالث', 3], ['الرابع', 4], ['الخامس', 5],
      ['السادس', 6], ['السابع', 7], ['الثامن', 8], ['التاسع', 9], ['العاشر', 10],
      ['رقم ١', 1], ['رقم ۲', 2], ['الخيار 3', 3], ['المقال ٤', 4], ['5', 5],
      ['رقم ٦', 6], ['الخيار ۷', 7], ['المادة 8', 8], ['رقم ٩', 9], ['رقم 10', 10],
    ]
    for (const [phrase, ordinal] of ordinalWords) {
      check('ordinal-parser', phrase, () => {
        assert.equal(parseOrdinal(phrase), ordinal)
      })
    }

    const actionCases = [
      ['لخص الثاني', 'summary', 'ordinal', 2],
      ['اختصرها', 'summary', 'current', null],
      ['اسمع الثالث بصوت نورة', 'listen', 'ordinal', 3],
      ['اسمعه بصوت الرجل', 'listen', 'current', null],
      ['شغل الحوار', 'listen', 'current', null],
      ['افتح رقم 4', 'read', 'ordinal', 4],
      ['عطني رابط هذا', 'read', 'current', null],
      ['مو هذا اللي بعده', null, 'next', null],
      ['اللي قبله', null, 'previous', null],
      ['المقال اللي قبله', null, 'previous', null],
      ['ارجع واحد', null, 'previous', null],
      ['زدني', null, 'next', null],
      ['نفسه', null, 'current', null],
    ]
    for (const [phrase, action, reference, ordinal] of actionCases) {
      check('compound-reference', phrase, () => {
        const parsed = parseCompoundRequest(phrase)
        assert.equal(parsed.action, action)
        assert.equal(parsed.reference, reference)
        assert.equal(parsed.ordinal, ordinal)
      })
    }

    /* ═══ 6) ذاكرة الإشارة لا تحمل إلا معرّفات حقيقية من الموقع ═══ */
    const contextItems = latestContent(db, 'article', 10)
    assert.equal(contextItems.length, 10, 'نحتاج عشر مواد لاختبار الأرقام البشرية')
    const contextIds = contextItems.map((item) => item.id)
    let context = setContextResults(createConversationContext(), contextIds, {
      currentIndex: 4,
      lastIntent: 'LATEST_ARTICLES',
      lastTopic: 'التعليم',
      lastKind: 'article',
    })
    check('context-current', 'المادة الحالية الخامسة', () => {
      assert.equal(currentResultId(context), contextIds[4])
    })
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) {
      check('context-ordinal', `الخيار ${ordinal}`, () => {
        const resolved = resolveContextReference(context, `لخص الخيار ${ordinal}`)
        assert.equal(resolved?.contentId, contextIds[ordinal - 1])
        assert.equal(resolved?.index, ordinal - 1)
        assert.equal(resolved?.action, 'summary')
        assert.equal(findContent(db, resolved.contentId)?.id, resolved.contentId)
      })
    }

    const relativeCases = [
      ['اللي قبله', 3, 'previous', null],
      ['ارجع واحد', 3, 'previous', null],
      ['مو هذا اللي بعده', 5, 'next', null],
      ['زدني', 5, 'next', null],
      ['لخصه', 4, 'current', 'summary'],
      ['اسمعه بصوت نورة', 4, 'current', 'listen'],
      ['افتح هذا', 4, 'current', 'read'],
    ]
    for (const [phrase, index, relation, action] of relativeCases) {
      check('context-relative', phrase, () => {
        const resolved = resolveContextReference(context, phrase)
        assert.equal(resolved?.contentId, contextIds[index])
        assert.equal(resolved?.relation, relation)
        assert.equal(resolved?.action, action)
        const updated = applyReferenceResolution(context, resolved)
        assert.equal(updated.currentIndex, index)
      })
    }

    const maliciousIds = [
      '', 'article:', ':slug', 'unknown:slug', 'https://evil.example/item',
      'article:../../secret', 'article:slug?x=1', 'article:slug#x', 'article:two words',
      'podcast:/absolute', 'book:\\windows', null, undefined, {}, [],
    ]
    for (const [index, value] of maliciousIds.entries()) {
      check('context-id-firewall', `malicious-${index}`, () => {
        assert.equal(isSiteContentId(value), false)
        assert.deepEqual(sanitizeResultIds([value]), [])
      })
    }
    check('context-id-firewall', 'يزيل التكرار والحقول المحقونة', () => {
      const payload = {
        version: 999,
        resultIds: [contextIds[0], contextIds[0], 'https://evil.example', contextIds[1]],
        currentIndex: 99,
        lastIntent: '<script>alert(1)</script>',
        lastTopic: 'موضوع آمن',
        lastKind: 'not-a-kind',
        rawMessage: 'يجب ألا يُحفظ هذا النص',
        phone: '96550000000',
      }
      const parsed = parseConversationContext(serializeConversationContext(payload))
      assert.deepEqual(parsed.resultIds, [contextIds[0], contextIds[1]])
      assert.equal(parsed.currentIndex, 1)
      assert.equal(parsed.lastIntent, null)
      assert.equal(parsed.lastKind, null)
      assert.equal('rawMessage' in parsed, false)
      assert.equal('phone' in parsed, false)
    })
    check('context-bounds', 'لا يخمّن قبل أول مادة', () => {
      const first = setContextResults(context, contextIds, { currentIndex: 0 })
      assert.equal(resolveContextReference(first, 'اللي قبله'), null)
    })
    check('context-bounds', 'لا يخمّن بعد آخر مادة', () => {
      const last = setContextResults(context, contextIds, { currentIndex: contextIds.length - 1 })
      assert.equal(resolveContextReference(last, 'اللي بعده'), null)
    })

    /* لا يكفي أن تنجح الوحدة منفردة: يجب أن يصل السياق إلى المحرك الفعلي. */
    const contextualJid = '74999@s.whatsapp.net'
    const expectedList = latestContent(db, 'article', 3)
    check('context-integration', 'الإيقاظ يفتح الجلسة السياقية', () => {
      assert.equal(incoming({ jid: contextualJid, text: 'موقع د. أحمد' }).shouldRespond, true)
    })
    check('context-integration', 'قائمة المقالات تُحفظ بالترتيب', () => {
      const response = incoming({ jid: contextualJid, text: 'آخر مقالاته' })
      assert.equal(response.shouldRespond, true)
      const row = db.get('SELECT context_json FROM chat_sessions WHERE jid=?', db.jidKey(contextualJid))
      const saved = parseConversationContext(row?.context_json)
      assert.deepEqual(saved.resultIds.slice(0, 3), expectedList.map((item) => item.id))
    })
    check('context-integration', 'لخص الثاني يختار المادة الثانية نفسها', () => {
      const response = incoming({ jid: contextualJid, text: 'لخص الثاني' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId, expectedList[1].id)
      assert.ok((response.text || '').includes(expectedList[1].title))
    })
    check('context-integration', 'مو هذا اللي بعده ينتقل للثالث', () => {
      const response = incoming({ jid: contextualJid, text: 'مو هذا اللي بعده' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId, expectedList[2].id)
    })
    check('context-integration', 'المقال اللي قبله يعود للثاني', () => {
      const response = incoming({ jid: contextualJid, text: 'المقال اللي قبله' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId, expectedList[1].id)
    })
    check('context-integration', 'ترتيب خارج القائمة لا يعيد المادة الحالية خفية', () => {
      const response = incoming({ jid: contextualJid, text: 'لخص الرابع' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId || null, null)
      assert.match(response.text || '', /لا يوجد اختيار/u)
    })

    /* رفّ المحفوظات رحلةٌ عملية لا مجرد INSERT: يصدق عند التكرار والحذف،
       والقائمة ذات العنصر الواحد تستبدل سياق قائمة المقالات القديمة. */
    const shelfJid = '74997@s.whatsapp.net'
    incoming({ jid: shelfJid, text: 'موقع د. أحمد' })
    incoming({ jid: shelfJid, text: 'آخر مقالاته' })
    const shelfChoice = incoming({ jid: shelfJid, text: '2' })
    const shelfContentId = shelfChoice.contentId
    assert.ok(shelfContentId)
    check('saved-shelf', 'الحفظ الأول يضيف المادة المختارة نفسها', () => {
      const response = incoming({ jid: shelfJid, text: 'احفظها' })
      assert.equal(response.contentId, shelfContentId)
      assert.equal(Number(db.get('SELECT COUNT(*) c FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(shelfJid), shelfContentId)?.c || 0), 1)
      assert.match(response.text || '', /حفظ/u)
    })
    check('saved-shelf', 'الحفظ الثاني لا يدّعي إضافة جديدة', () => {
      const response = incoming({ jid: shelfJid, text: 'احفظها' })
      assert.equal(Number(db.get('SELECT COUNT(*) c FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(shelfJid), shelfContentId)?.c || 0), 1)
      assert.match(response.text || '', /(?:محفوظ.*(?:من قبل|سابق)|سبق.*حفظ)/u)
    })
    check('saved-shelf', 'رفّ من عنصر واحد يعيد ضبط السياق ولا يرث قائمة قديمة', () => {
      const response = incoming({ jid: shelfJid, text: 'محفوظاتي' })
      assert.deepEqual(response.seenContentIds, [shelfContentId])
      const row = db.get('SELECT context_json FROM chat_sessions WHERE jid=?', db.jidKey(shelfJid))
      const saved = parseConversationContext(row?.context_json)
      assert.deepEqual(saved.resultIds, [shelfContentId])
      assert.equal(saved.currentIndex, 0)
    })
    check('saved-shelf', 'الحذف الأول يحذف مادة موجودة فعلاً', () => {
      const response = incoming({ jid: shelfJid, text: 'شيلها من محفوظاتي' })
      assert.equal(Number(db.get('SELECT COUNT(*) c FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(shelfJid), shelfContentId)?.c || 0), 0)
      assert.match(response.text || '', /(?:ازل|شلت|حذف)/u)
    })
    check('saved-shelf', 'الحذف الثاني يصرّح أنها غير محفوظة', () => {
      const response = incoming({ jid: shelfJid, text: 'شيلها من محفوظاتي' })
      assert.equal(Number(db.get('SELECT COUNT(*) c FROM saved_content WHERE jid=? AND content_id=?', db.jidKey(shelfJid), shelfContentId)?.c || 0), 0)
      assert.match(response.text || '', /(?:غير موجود|ليست? محفوظ|مو محفوظ|ما كانت محفوظ)/u)
      assert.equal(/ازلتها من رفك/u.test(normalizeArabic(response.text || '')), false)
    })

    /* التحدّي رحلة متعددة الرسائل؛ تصنيف الرقم منفرداً لا يكفي لاختبارها. */
    const challengeJid = '74998@s.whatsapp.net'
    incoming({ jid: challengeJid, text: 'موقع د. أحمد' })
    let challengeState
    let challengeSeenIds = []
    check('challenge-integration', 'التحدّي يحفظ ثلاثة عناوين وإجابة من الفهرس', () => {
      const response = incoming({ jid: challengeJid, text: 'اختبرني' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.intent, INTENTS.CHALLENGE)
      const row = db.get('SELECT context_json FROM chat_sessions WHERE jid=?', db.jidKey(challengeJid))
      challengeState = parseConversationContext(row?.context_json).challenge
      assert.equal(challengeState?.optionIds.length, 3)
      assert.ok(challengeState.optionIds.includes(challengeState.answerContentId))
      const answer = findContent(db, challengeState.answerContentId)
      assert.ok(answer)
      assert.ok(response.evidenceQuotes?.every((quote) => String(answer.body || answer.excerpt || '').includes(quote)))
      challengeSeenIds = response.seenContentIds || []
      assert.deepEqual(sortedUnique(challengeSeenIds), sortedUnique(challengeState.optionIds))
    })
    check('challenge-integration', 'الرقم أثناء التحدّي يُصحّح الإجابة لا يفتح الخيار', () => {
      const correct = challengeState.optionIds.indexOf(challengeState.answerContentId) + 1
      const response = incoming({ jid: challengeJid, text: String(correct) })
      assert.equal(response.intent, INTENTS.CHALLENGE_ANSWER)
      assert.equal(response.contentId, challengeState.answerContentId)
      assert.match(response.text || '', /إجابة صحيحة/u)
      const row = db.get('SELECT context_json FROM chat_sessions WHERE jid=?', db.jidKey(challengeJid))
      assert.equal(parseConversationContext(row?.context_json).challenge, null)
    })
    check('challenge-integration', 'بعد إغلاق التحدّي يعود الرقم إلى اختيار القوائم', () => {
      incoming({ jid: challengeJid, text: 'آخر مقالاته' })
      const response = incoming({ jid: challengeJid, text: '2' })
      assert.equal(response.intent, INTENTS.CONTEXT_REFERENCE)
      assert.equal(response.contentId, expectedList[1].id)
    })
    check('challenge-no-repeat', 'كل عنوان ظهر في التحدّي يُعدّ مرئياً', () => {
      assert.equal(challengeSeenIds.length, 3)
      const stamp = new Date().toISOString()
      for (const contentId of challengeSeenIds) {
        db.run('INSERT OR REPLACE INTO sent_content(jid,content_id,sent_at) VALUES(?,?,?)', db.jidKey(challengeJid), contentId, stamp)
      }
    })
    check('challenge-no-repeat', 'التحدّي التالي لا يعيد هدفاً ولا عنواناً مكشوفاً', () => {
      const response = incoming({ jid: challengeJid, text: 'اختبرني' })
      const row = db.get('SELECT context_json FROM chat_sessions WHERE jid=?', db.jidKey(challengeJid))
      const next = parseConversationContext(row?.context_json).challenge
      assert.equal(response.shouldRespond, true)
      assert.equal(next?.optionIds.length, 3)
      assert.deepEqual(sortedUnique(response.seenContentIds || []), sortedUnique(next.optionIds))
      assert.equal(next.optionIds.some((id) => challengeSeenIds.includes(id)), false)
    })

    const reservationJid = '74996@s.whatsapp.net'
    check('archive-no-repeat', 'الحجز الجاري يمنع اختيار المادة نفسها بالتزامن', () => {
      const first = selectDailyUnsentContent(db, { jid: reservationJid, at: FIXED_NOW })
      assert.ok(first)
      db.run(
        'INSERT INTO content_reservations(jid,content_id,reserved_at) VALUES(?,?,?)',
        db.jidKey(reservationJid), first.id, new Date().toISOString(),
      )
      const second = selectDailyUnsentContent(db, { jid: reservationJid, at: FIXED_NOW })
      assert.ok(second)
      assert.notEqual(second.id, first.id)
    })

    const exhaustedJid = '74995@s.whatsapp.net'
    const archiveIds = db.all(
      "SELECT id FROM content_items WHERE kind='article' AND (trim(coalesce(body,''))<>'' OR trim(coalesce(excerpt,''))<>'')",
    ).map((row) => row.id)
    const exhaustedAt = new Date().toISOString()
    for (const contentId of archiveIds) {
      db.run('INSERT INTO sent_content(jid,content_id,sent_at) VALUES(?,?,?)', db.jidKey(exhaustedJid), contentId, exhaustedAt)
    }
    check('archive-exhaustion', 'لا يختار بصمت مادة مرئية بعد نفاد الأرشيف', () => {
      assert.equal(selectDailyUnsentContent(db, { jid: exhaustedJid, at: FIXED_NOW }), null)
      const response = incoming({ jid: exhaustedJid, text: 'موقع د. أحمد' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId || null, null)
      assert.equal((response.seenContentIds || []).length, 0)
      assert.match(normalizeArabic(response.text || ''), /(?:مررت.*كل.*الارشيف|نفد.*الارشيف|لن اكرر)/u)
    })

    /* ═══ 7) لا تأليف: المعرّف والرابط والاقتباس كلّها تعود للفهرس ═══ */
    const latestArticles = latestContent(db, 'article', 12)
    for (const item of latestArticles) {
      check('quote-grounding', item.slug, () => {
        const response = handleIntent({
          db,
          jid: `750${item.slug}@s.whatsapp.net`,
          input: 'عطني اقتباس',
          session: { content_id: item.id },
          classification: classifyIntent('عطني اقتباس'),
        })
        assert.equal(response.contentId, item.id)
        assert.ok(response.quote)
        const normalizedQuote = String(response.quote).replace(/\s+/g, ' ').trim()
        const normalizedBody = String(item.body || '').replace(/\s+/g, ' ').trim()
        const normalizedExcerpt = String(item.excerpt || '').replace(/\s+/g, ' ').trim()
        assert.equal(normalizedBody.includes(normalizedQuote) || normalizedExcerpt.includes(normalizedQuote), true)
        assert.equal(response.text.includes(item.title), true)
        assert.equal(response.text.includes(item.url), true)
      })
      check('summary-grounding', item.slug, () => {
        const summary = contentSummary(item, 1)
        assert.ok(summary)
        assert.equal(sourceOf(item).includes(summary.replace(/\s+/g, ' ').trim()), true)
      })
    }

    const groundedRequests = [
      'آخر مقالة', 'آخر مقالاته', 'آخر بحث', 'آخر كتاب', 'آخر بودكاست',
      'عندي دقيقة', 'عندك شي عن التعليم؟', 'عندك شي عن التقييم؟',
      'مختارات', 'شنو جديد الدكتور؟', 'شنو موجود بالموقع؟',
    ]
    for (const [index, text] of groundedRequests.entries()) {
      check('site-only-response', text, () => {
        const response = incoming({
          jid: `760${index}@s.whatsapp.net`,
          text,
          explicitContentSession: true,
        })
        assert.equal(response.shouldRespond, true)
        if (response.contentId) assert.ok(findContent(db, response.contentId), `معرّف غير موجود: ${response.contentId}`)
        for (const link of linksIn(response.text)) {
          assert.equal(link.startsWith(`${SITE_URL}/`) || link === SITE_URL || link.startsWith(`${AUDIO_PUBLIC_BASE_URL}/`), true, `رابط خارجي غير مسموح: ${link}`)
        }
        assert.equal(/openai|gemini|wikipedia|chatgpt/i.test(response.text || ''), false)
      })
    }

    const readOptionalJsonObject = (file) => {
      const raw = fs.readFileSync(file, 'utf8').trim()
      return raw ? JSON.parse(raw) : {}
    }
    const audioManifest = readOptionalJsonObject(path.join(root, 'src', 'data', 'audio.json'))
    const audioMeta = readOptionalJsonObject(path.join(root, 'src', 'data', 'audio-meta.json'))
    /* صفحة المقال وحدها تخفي اسم المؤدي. أمّا واتساب ولوحات التشغيل فتُظهر
       المسارات الحقيقية كي يرى الدكتور بوضوح ما تم توليده: فهد، نورة، والحوار. */
    const internalVoiceCases = [
      ['fahed', '.mp3'],
      ['noura', '.noura.mp3'],
      ['dialogue', '.dialogue.mp3'],
    ]
    for (const [slug, declaration] of Object.entries(audioManifest)) {
      const item = db.get('SELECT * FROM content_items WHERE slug=?', slug)
      assert.ok(item, `بيان الصوت يشير إلى slug غير موجود: ${slug}`)
      const audio = JSON.parse(item.audio_json || 'null')
      assert.ok(audio, `المادة المنشورة بلا audio_json: ${slug}`)

      for (const [voice, suffix] of internalVoiceCases) {
        check('audio-manifest', `${slug} / ${voice}`, () => {
          assert.equal(Boolean(audio[voice]), Boolean(declaration?.[voice]))
          if (!declaration?.[voice]) return
          const key = `${slug}${suffix}`
          const duration = Number(audioMeta[key]?.durationSeconds || audioMeta[key]?.duration || 0)
          assert.ok(duration > 0, `لا مدة موثقة للملف ${key}`)
          assert.equal(Number(audio.durations?.[voice]), duration)
        })
      }

      if (declaration?.noura) {
        check('audio-voice-visibility', `${slug} / صوت نورة`, () => {
          const phrase = 'اسمعها بصوت نورة'
          const expectedUrl = `${AUDIO_PUBLIC_BASE_URL}/${slug}.noura.mp3`
          const response = handleIntent({
            db,
            jid: `audio-noura-${hashOpaque(slug)}@s.whatsapp.net`,
            input: phrase,
            session: { content_id: item.id },
            classification: { intent: INTENTS.LISTEN_NOURA, confidence: 0.99, normalized: normalizeArabic(phrase) },
          })
          const rendered = `${response.text || ''}
${(response.actions || []).join('\n')}`
          assert.ok(rendered.includes(expectedUrl))
          assert.match(rendered, /صوت نورة/u)
        })
      }

      if (declaration?.fahed) {
        check('audio-voice-visibility', `${slug} / صوت فهد`, () => {
          const phrase = 'اسمعها بصوت فهد'
          const expectedUrl = `${AUDIO_PUBLIC_BASE_URL}/${slug}.mp3`
          const response = handleIntent({
            db,
            jid: `audio-fahed-${hashOpaque(slug)}@s.whatsapp.net`,
            input: phrase,
            session: { content_id: item.id },
            classification: { intent: INTENTS.LISTEN_FAHED, confidence: 0.99, normalized: normalizeArabic(phrase) },
          })
          const rendered = `${response.text || ''}
${(response.actions || []).join('\n')}`
          assert.ok(rendered.includes(expectedUrl))
          assert.match(rendered, /صوت فهد/u)
        })
      }

      if (declaration?.dialogue) {
        check('audio-public-privacy', `${slug} / الحوار`, () => {
          const phrase = 'شغل الحوار'
          const expectedUrl = `${AUDIO_PUBLIC_BASE_URL}/${slug}.dialogue.mp3`
          const response = handleIntent({
            db,
            jid: `audio-dialogue-${hashOpaque(slug)}@s.whatsapp.net`,
            input: phrase,
            session: { content_id: item.id },
            classification: { intent: INTENTS.LISTEN_DIALOGUE, confidence: 0.99, normalized: normalizeArabic(phrase) },
          })
          assert.ok((response.text || '').includes(expectedUrl))
          assert.ok((response.actions || []).some((line) => line.startsWith('الحوار:') && line.includes(expectedUrl)))
        })
      }
    }

    for (const [voice] of internalVoiceCases) {
      check('audio-availability', `${voice}: الفهرس لا يخترع ملفات`, () => {
        const expected = Object.values(audioManifest).filter((entry) => Boolean(entry?.[voice])).length
        const actual = db.all('SELECT audio_json FROM content_items WHERE audio_json IS NOT NULL')
          .filter((row) => Boolean(JSON.parse(row.audio_json || 'null')?.[voice])).length
        assert.equal(actual, expected)
        assert.equal(latestAudioContent(db, voice, 10).every((item) => item.audio?.[voice]), true)
      })
    }

    const unavailableReading = db.all('SELECT * FROM content_items WHERE audio_json IS NOT NULL LIMIT 80')
      .find((row) => {
        const audio = JSON.parse(row.audio_json || 'null')
        return !audio?.fahed && !audio?.noura
      })
    if (unavailableReading) {
      check('audio-availability', 'قراءة المقال: الطلب غير المنشور يرفض الرابط', () => {
        const phrase = 'قراءة المقال'
        const response = handleIntent({
          db,
          jid: 'no-audio-reading@s.whatsapp.net',
          input: phrase,
          session: { content_id: unavailableReading.id },
          classification: { intent: INTENTS.LISTEN_FAHED, confidence: 0.99, normalized: normalizeArabic(phrase) },
        })
        assert.equal((response.text || '').includes(`${AUDIO_PUBLIC_BASE_URL}/${unavailableReading.slug}.mp3`), false)
        assert.equal((response.text || '').includes(`${AUDIO_PUBLIC_BASE_URL}/${unavailableReading.slug}.noura.mp3`), false)
        assert.match(normalizeArabic(response.text || ''), /لا توجد النسخه الصوتيه المطلوبه|غير متوفر/u)
      })
    }

    const unavailableDialogue = db.all('SELECT * FROM content_items WHERE audio_json IS NOT NULL LIMIT 80')
      .find((row) => !JSON.parse(row.audio_json || 'null')?.dialogue)
    if (unavailableDialogue) {
      check('audio-availability', 'الحوار: الطلب غير المنشور يرفض الرابط', () => {
        const phrase = 'شغل الحوار'
        const response = handleIntent({
          db,
          jid: 'no-audio-dialogue@s.whatsapp.net',
          input: phrase,
          session: { content_id: unavailableDialogue.id },
          classification: { intent: INTENTS.LISTEN_DIALOGUE, confidence: 0.99, normalized: normalizeArabic(phrase) },
        })
        assert.equal((response.text || '').includes(`${AUDIO_PUBLIC_BASE_URL}/${unavailableDialogue.slug}.dialogue.mp3`), false)
        assert.match(normalizeArabic(response.text || ''), /لا توجد النسخه الصوتيه المطلوبه|غير متوفر/u)
      })
    }

    check('audio-voice-visibility', 'طلبات أسماء الأصوات تعرض المسار الحقيقي خارج صفحة المقال', () => {
      const rows = db.all('SELECT * FROM content_items WHERE audio_json IS NOT NULL LIMIT 120')
      const byVoice = (voice) => rows.find((row) => Boolean(JSON.parse(row.audio_json || 'null')?.[voice]))
      for (const [intent, phrase, voice, label, suffix] of [
        [INTENTS.LISTEN_FAHED, 'اسمعها بصوت فهد', 'fahed', 'صوت فهد', '.mp3'],
        [INTENTS.LISTEN_NOURA, 'اسمعها بصوت نورة', 'noura', 'صوت نورة', '.noura.mp3'],
      ]) {
        const item = byVoice(voice)
        if (!item) continue
        const response = handleIntent({
          db,
          jid: `voice-name-${intent}@s.whatsapp.net`,
          input: phrase,
          session: { content_id: item.id },
          classification: { intent, confidence: 0.99, normalized: normalizeArabic(phrase) },
        })
        const rendered = `${response.text || ''}
${(response.actions || []).join('\n')}`
        assert.ok(rendered.includes(label))
        assert.ok(rendered.includes(`${AUDIO_PUBLIC_BASE_URL}/${item.slug}${suffix}`))
      }
    })

    check('verified-analytics', 'غياب لقطة Firestore لا يُستبدل بترتيب مصنوع', () => {
      db.setSetting('analytics.articleViews', null)
      const response = incoming({
        jid: '76500@s.whatsapp.net',
        text: 'شنو أكثر مقالة مشاهدة؟',
        explicitContentSession: true,
      })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId || null, null)
      assert.match(response.text || '', /(?:لا تتوفر|غير متوفر|لا أملك|لا توجد).*موثق/u)
      assert.equal(/مؤشر المشاهدة الداخلي|تقدير داخلي/u.test(response.text || ''), false)
    })
    check('verified-analytics', 'لقطة بمصدر مزيف تُرفض', () => {
      db.setSetting('analytics.articleViews', {
        source: 'manual:guess',
        period: '2026-07',
        collectedAt: '2026-07-21T09:00:00.000Z',
        items: [{ path: `/articles/${latestArticles[0].slug}`, count: 999999 }],
      })
      const response = incoming({
        jid: '76501@s.whatsapp.net',
        text: 'شنو أكثر مقالة مشاهدة؟',
        explicitContentSession: true,
      })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId || null, null)
      assert.equal((response.text || '').includes(latestArticles[0].title), false)
    })
    check('verified-analytics', 'لقطة Firestore الموثقة وحدها تحدد الأعلى', () => {
      db.setSetting('analytics.articleViews', {
        source: 'firestore:views:monthly',
        period: '2026-07',
        collectedAt: '2026-07-21T09:00:00.000Z',
        items: [
          { path: `/articles/${latestArticles[0].slug}`, count: 7 },
          { path: `/articles/${latestArticles[1].slug}`, count: 81 },
        ],
      })
      const response = incoming({
        jid: '76502@s.whatsapp.net',
        text: 'شنو أكثر مقالة مشاهدة؟',
        explicitContentSession: true,
      })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.contentId, latestArticles[1].id)
      assert.ok((response.text || '').includes(latestArticles[1].title))
      assert.ok((response.text || '').includes(latestArticles[1].url))
      assert.equal(/مؤشر المشاهدة الداخلي|تقدير داخلي/u.test(response.text || ''), false)
    })

    const conversationalChatter = [
      'شكرا', 'شكراً', 'مشكور', 'أنا بخير', 'اني بخير', 'تمام حبيبي',
      'توني وصلت البيت', 'هلا والله', 'صباح الخير', 'شلونك؟', 'مع السلامة',
      'I am fine', 'thanks', 'hello my friend', 'I just arrived home',
    ]
    for (const [index, text] of conversationalChatter.entries()) {
      check('chatter-reply-after-wake', text, () => {
        const result = incoming({
          jid: `766${index}@s.whatsapp.net`,
          text,
          explicitContentSession: true,
        })
        assert.equal(result.shouldRespond, true)
        assert.ok(String(result.text || '').length > 0)
      })
    }

    const genuineTopicPhrases = [
      ['التعليم', 'التعليم'],
      ['الذكاء الاصطناعي', 'الذكاء الاصطناعي'],
      ['أبي التعليم', 'التعليم'],
      ['أبي الذكاء الاصطناعي', 'الذكاء الاصطناعي'],
    ]
    for (const [index, [text, topic]] of genuineTopicPhrases.entries()) {
      check('grounded-topic', text, () => {
        const result = incoming({
          jid: `767${index}@s.whatsapp.net`,
          text,
          explicitContentSession: true,
        })
        assert.equal(result.shouldRespond, true)
        assert.ok(result.contentId)
        const item = findContent(db, result.contentId)
        assert.ok(item)
        const named = normalizeArabic(`${item.title || ''} ${item.keywords || ''}`)
        const topicWords = normalizeArabic(topic).split(/\s+/).filter(Boolean)
        assert.equal(topicWords.every((word) => named.includes(word)), true, `اختيار غير مطابق للموضوع: ${item.title}`)
      })
    }

    const unknownInputs = Array.from({ length: 20 }, (_, index) => `zxqvnositefact${String(index).padStart(2, '0')}qplm`)
    for (const [index, text] of unknownInputs.entries()) {
      check('unknown-clarify-after-wake', text, () => {
        assert.equal(searchContent(db, text, { limit: 1 }).length, 0)
        const response = incoming({
          jid: `770${index}@s.whatsapp.net`,
          text,
          explicitContentSession: true,
        })
        assert.equal(response.shouldRespond, true)
        assert.ok(String(response.text || '').length > 0)
      })
    }

    /* ═══ 8) الخصوصية تعمل بلا إيقاظ وبلا توقيع، ولا تخزّن الرقم مكشوفاً ═══ */
    const privacyClassificationCases = [
      ['أوقف الرسائل', INTENTS.STOP_MESSAGES],
      ['وقف الرسائل', INTENTS.STOP_MESSAGES],
      ['لا ترسل', INTENTS.STOP_MESSAGES],
      ['ما أبي تنبيهات', INTENTS.STOP_MESSAGES],
      ['إلغاء الاشتراك', INTENTS.STOP_MESSAGES],
      ['رجع الرسائل', INTENTS.RESUME_MESSAGES],
      ['فعل الجديد', INTENTS.RESUME_MESSAGES],
      ['اشترك مرة ثانية', INTENTS.RESUME_MESSAGES],
      ['أبي أرجع', INTENTS.RESUME_MESSAGES],
      ['انس تفضيلاتي', INTENTS.DELETE_PREFERENCES],
      ['امسح اللي تعرفه عني', INTENTS.DELETE_PREFERENCES],
      ['احذف تفضيلاتي', INTENTS.DELETE_PREFERENCES],
    ]
    for (const [index, [text, intent]] of privacyClassificationCases.entries()) {
      check('privacy-command', text, () => {
        const jid = `780${index}@s.whatsapp.net`
        markManualTakeover(db, jid, 30)
        const classified = classifyIntent(text)
        assert.equal(classified.intent, intent)
        const result = gate({ jid, text })
        assert.equal(result.allowed, true)
        assert.equal(result.reason, 'privacy-command')
      })
    }

    const privacyJid = '96555500000@s.whatsapp.net'
    check('privacy-flow', 'الإيقاف يطبّق فوراً', () => {
      const response = incoming({ jid: privacyJid, text: 'أوقف الرسائل' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.text.includes(BOT_SIGNATURE), false)
      assert.equal(gate({ jid: privacyJid, text: 'موقع د. أحمد' }).allowed, false)
    })
    check('privacy-flow', 'الاستئناف يظل ممكناً بعد الإيقاف', () => {
      const response = incoming({ jid: privacyJid, text: 'رجع الرسائل' })
      assert.equal(response.shouldRespond, true)
      assert.equal(response.text.includes(BOT_SIGNATURE), false)
      assert.equal(gate({ jid: privacyJid, text: 'موقع د. أحمد' }).allowed, true)
    })
    /* يمنع فشل الاستئناف من تلويث بقية الاختبارات أثناء مرحلة التطوير. */
    setSuppression(db, privacyJid, false)

    const deleteJid = '96555500001@s.whatsapp.net'
    db.run(
      'INSERT INTO user_preferences(jid,payload,updated_at) VALUES(?,?,?)',
      db.jidKey(deleteJid), JSON.stringify({ lastContentCursor: '2026-01-01' }), new Date().toISOString(),
    )
    check('privacy-flow', 'حذف التفضيلات متاح أثناء تدخل الدكتور', () => {
      markManualTakeover(db, deleteJid, 30)
      const response = incoming({ jid: deleteJid, text: 'امسح اللي تعرفه عني' })
      assert.equal(response.shouldRespond, false)
      assert.equal(response.privacyApplied, true)
      assert.equal(response.text, '')
      assert.equal(db.get('SELECT 1 hit FROM user_preferences WHERE jid=?', db.jidKey(deleteJid)), undefined)
    })

    check('privacy-storage', 'المعرّفات المحفوظة معماة أو أحادية الاتجاه', () => {
      const raw = '96555500002@s.whatsapp.net'
      setSuppression(db, raw, true)
      const contact = db.get('SELECT id,jid FROM contacts WHERE id=?', hashOpaque(raw))
      assert.ok(contact)
      assert.equal(contact.id, hashOpaque(raw))
      assert.notEqual(contact.id, raw)
      assert.equal(contact.jid.includes(raw), false)
      assert.match(contact.jid, /^v1:/)
    })

    check('privacy-storage', 'جلسة المحادثة لا تحفظ الرقم مكشوفاً', () => {
      const raw = '96555500003@s.whatsapp.net'
      const response = incoming({ jid: raw, text: 'موقع د. أحمد' })
      assert.equal(response.shouldRespond, true)
      const row = db.get('SELECT jid FROM chat_sessions WHERE jid=?', db.jidKey(raw))
      assert.equal(row?.jid, hashOpaque(raw))
      assert.equal(row?.jid.includes('96555500003'), false)
    })

    /* الاختبار نفسه يجب أن يبقى أكبر من 300 حالة حقيقية، لا رقماً مطبوعاً. */
    check('meta', 'أكثر من 300 حالة مولدة', () => {
      assert.ok(total > 300, `عدد الحالات قبل فحص الميتا ${total} فقط`)
    })
  } finally {
    db.close()
  }

  const categories = Object.fromEntries(
    [...byCategory.entries()].map(([name, stats]) => [name, stats]),
  )
  const result = { ok: failures.length === 0, total, passed, failed: failures.length, indexed, categories }

  if (failures.length) {
    const preview = failures.slice(0, 24)
      .map((failure, index) => `${index + 1}. [${failure.category}] ${failure.label}: ${failure.message}`)
      .join('\n')
    const error = new Error(`فشل الاختبار النووي في ${failures.length}/${total} حالة:\n${preview}`)
    error.result = { ...result, failures }
    throw error
  }

  return result
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNuclearSelfTest(path.resolve(process.argv[2] || process.cwd()))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error?.message || error)
      if (error?.result) console.error(JSON.stringify(error.result, null, 2))
      process.exitCode = 1
    })
}
