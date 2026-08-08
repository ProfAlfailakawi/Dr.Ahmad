/**
 * فاحص الردود — الحارس الذي كان ناقصاً.
 *
 * الفاحصان القائمان (self-test و nuclear) يفحصان الدوالّ والبوابات، وقد كانا
 * **أخضرَين** بينما عشرون عطباً حيّة تحتهما: دالّةُ تلخيصٍ لا تُستدعى، وبابٌ
 * له معالجٌ ولا نمط، ونمطٌ مكتوبٌ بصيغةٍ لا يُنتجها المُطبِّع أبداً، ووعدٌ
 * يقطعه البوت على نفسه في نصّ ردّه ثم يُخلفه.
 *
 * هذا الفاحص يفحص ما يقرؤه الزائر لا ما يظنّه المبرمج:
 *   ١) تدقيقٌ ساكن: لا بابَ بلا مفتاح، ولا مفتاحَ بلا غرفة.
 *   ٢) كنسٌ حيّ: كل صيغةٍ يكتبها الناس تصل نيّتها وتُجاب جواباً حقيقياً.
 *   ٣) **ملاحقة الوعود**: كل أمرٍ يعرضه الردّ («قل الأولى» · «اكتب زدني» ·
 *      «أرسل الرقم فقط») يُنفَّذ فعلاً ويُتحقَّق أن البوت وفى به.
 *   ٤) جمال المخرَج: لا اقتباسَ مبتور، ولا سطرَ فارغ داخل «»، ولا نجمةَ
 *      مفردة في كلام الدكتور.
 */
import assert from 'node:assert/strict'
import { openDatabase } from '../whatsapp-agent/db.mjs'
import { buildContentIndex, syncContentIndex, findContent } from '../whatsapp-agent/content-index.mjs'
import { classifyIntent, handleIncoming, INTENTS } from '../whatsapp-agent/intent-engine.mjs'
import { isVerbatimFromItem } from '../whatsapp-agent/daily-experience.mjs'
import fs from 'node:fs'

const root = process.cwd()
process.env.WHATSAPP_AGENT_KEY ||= Buffer.alloc(32, 7).toString('base64')

const results = { passed: 0, failed: 0, failures: [] }
function check(category, label, fn) {
  try { fn(); results.passed += 1 } catch (error) {
    results.failed += 1
    results.failures.push({ category, label, message: String(error?.message || error).slice(0, 400) })
  }
}

/* ═══ ١ · تدقيقٌ ساكن: الأبواب والمفاتيح ═══ */
const source = fs.readFileSync('whatsapp-agent/intent-engine.mjs', 'utf8')
const declared = [...source.matchAll(/(\w+): '\1'/g)].map((row) => row[1])
const patterned = new Set([...source.matchAll(/\[INTENTS\.(\w+), \[/g)].map((row) => row[1]))
const handled = new Set([...source.matchAll(/case INTENTS\.(\w+)/g)].map((row) => row[1]))
const assigned = new Set([...source.matchAll(/intent: INTENTS\.(\w+)/g)].map((row) => row[1]))
/* هذه تُبلَغ من غير جدول الأنماط: أوامر الخصوصية تُلتقط قبل التصنيف، و
   SHOW_OPTIONS يشترك مع HELP، و SIMILAR_CONTENT يشترك مع SEARCH_TOPIC. */
const REACHED_ELSEWHERE = new Set(['STOP_MESSAGES', 'RESUME_MESSAGES', 'DELETE_PREFERENCES', 'SHOW_OPTIONS', 'SIMILAR_CONTENT', 'UNKNOWN'])

check('doors', 'لا بابَ بلا مفتاح: كل نيّةٍ لها معالجٌ يمكن بلوغها', () => {
  const orphans = declared.filter((key) => handled.has(key) && !patterned.has(key) && !assigned.has(key) && !REACHED_ELSEWHERE.has(key))
  assert.deepEqual(orphans, [], `نيّاتٌ لها معالجٌ ولا سبيل إليها: ${orphans.join(', ')}`)
})
check('doors', 'لا مفتاحَ بلا غرفة: كل نيّةٍ مُصنَّفة لها فرعٌ يردّ عنها', () => {
  const unreachable = declared.filter((key) => patterned.has(key) && !handled.has(key))
  assert.deepEqual(unreachable, [], `نيّاتٌ تُصنَّف ولا فرع لها: ${unreachable.join(', ')}`)
})

/* ═══ ٢ · الكنس الحيّ ═══ */
const db = openDatabase(':memory:', { cryptoOptions: { allowEphemeral: true } })
syncContentIndex(db, root)
const AT = new Date('2026-08-07T09:00:00Z')
const textOf = (reply) => String(reply?.reply?.text ?? reply?.text ?? '')

let seat = 0
function conversation() {
  seat += 1
  const jid = `9650000${seat}@s.whatsapp.net`
  let tick = 0
  const say = (text) => {
    tick += 1
    return handleIncoming({ db, jid, text, at: new Date(AT.getTime() + seat * 3600000 + tick * 60000), root })
  }
  say('موقع د. أحمد')
  return { jid, say }
}

/* الردّ العامّ الذي يعني «لم أفهم» أو «لا شيء عندي» — وجوده حيث يُنتظر جوابٌ
   حقيقيّ هو بعينه العطب الذي تكرّر اليوم عشرين مرة. */
const FALLBACK = /سؤالك خارج المحتوى المنشور|هذا الموضوع لم يُنشر عنه|أرسل لي اسم الموضوع|لا يوجد اختيار سابق واضح|ما وجدت هذا الموضوع بهذا اللفظ/

const PHRASES = [
  ['موقع د. أحمد', INTENTS.WELCOME], ['آخر مقالاته', INTENTS.LATEST_ARTICLES],
  ['آخر مقالة', INTENTS.LATEST_ARTICLE], ['آخر بحث', INTENTS.LATEST_PAPER],
  ['آخر كتاب', INTENTS.LATEST_BOOK], ['آخر بودكاست', INTENTS.LATEST_PODCAST],
  ['المختارات', INTENTS.CURATED_PICKS], ['وش الجديد', INTENTS.LATEST_CONTENT],
  ['شنو أكثر موضوع يكتب عنه', INTENTS.TOP_ARTICLE_TOPIC], ['مين هو الدكتور', INTENTS.ABOUT_DOCTOR],
  ['من هو الدكتور', INTENTS.ABOUT_DOCTOR], ['اللقاءات القادمة', INTENTS.UPCOMING_EVENTS],
  ['لخص', INTENTS.SUMMARY], ['عطني تلخيص', INTENTS.SUMMARY], ['عطني الزبدة', INTENTS.ONE_MINUTE], ['فهمني ببساطة', INTENTS.EXPLAIN_MODE], ['وضحها لي', INTENTS.EXPLAIN_MODE],
  ['اختصر لي', INTENTS.SUMMARY], ['عندي دقيقة', INTENTS.ONE_MINUTE],
  ['٣٠ ثانية', INTENTS.READ_SPEED], ['تعمق', INTENTS.READ_SPEED],
  ['كمل', INTENTS.CONTINUE_READING], ['كمل القراءة', INTENTS.CONTINUE_READING],
  ['اختبرني', INTENTS.CHALLENGE], ['المصدر', INTENTS.SOURCE_PROOF],
  ['شبكة الأفكار', INTENTS.IDEA_NETWORK], ['اقتباس', INTENTS.QUOTE],
  ['احفظها', INTENTS.SAVE_CONTENT], ['محفوظاتي', INTENTS.LIST_SAVED],
  ['المحفوظات', INTENTS.LIST_SAVED], ['فاتني شي', INTENTS.MISSED_CONTENT],
  ['خلاصة الأسبوع', INTENTS.WEEKLY_DIGEST], ['فاجئني', INTENTS.SURPRISE_ME],
  ['تعبان', INTENTS.CONTENT_BY_MOOD], ['اشرح لي بالتفصيل', INTENTS.EXPLAIN_MODE],
  ['عارضني', INTENTS.DIALOGUE_MODE], ['رحلة خمس دقائق', INTENTS.DIALOGUE_MODE],
  ['ابي احد يرد علي', INTENTS.HUMAN_HANDOFF], ['وش الخيارات', INTENTS.HELP],
  ['شغل الصوت', INTENTS.LISTEN_FAHED], ['الصوت', INTENTS.LISTEN_FAHED],
  ['ابي اسمع المقال', INTENTS.LISTEN_FAHED], ['شغل لي المقال', INTENTS.LISTEN_FAHED], ['قرا لي المقال', INTENTS.LISTEN_FAHED],
  ['قراءة صوتية', INTENTS.LISTEN_FAHED], ['النسخة الصوتية', INTENTS.LISTEN_FAHED],
  ['اسمعني اياها', INTENTS.LISTEN_FAHED], ['شغلي الصوت', INTENTS.LISTEN_FAHED],
  ['صوت فهد', INTENTS.LISTEN_FAHED], ['صوت نورة', INTENTS.LISTEN_NOURA],
  ['اسمعني الحوار', INTENTS.LISTEN_DIALOGUE], ['ابي اسمع الحوار', INTENTS.LISTEN_DIALOGUE],
  ['الحوار الصوتي', INTENTS.LISTEN_DIALOGUE], ['ابي الحوار', INTENTS.LISTEN_DIALOGUE], ['عنده كتب', INTENTS.LATEST_BOOK], ['عندك كتب', INTENTS.LATEST_BOOK],
  ['حوار مسموع', INTENTS.DIALOGUE_LIBRARY], ['ابي ابحث داخل الكتاب', INTENTS.BOOK_SEARCH],
  ['ابحث داخل كتاب المدارس الذكية', INTENTS.BOOK_SEARCH], ['فصول الكتاب', INTENTS.BOOK_CHAPTERS],
  ['فصول كتاب المدارس الذكية', INTENTS.BOOK_CHAPTERS],
  ['فيديوهات داخل الكتاب', INTENTS.BOOK_VIDEOS], ['الظهور الإعلامي', INTENTS.MEDIA_LIBRARY],
  ['لقاءات الدكتور عن التعليم', INTENTS.MEDIA_LIBRARY], ['الراديو', INTENTS.RADIO],
  ['ورني كتبه', INTENTS.LATEST_BOOK], ['عنده مؤلفات', INTENTS.LATEST_BOOK], ['عنده حلقات', INTENTS.LATEST_PODCAST], ['عندك حلقات', INTENTS.LATEST_PODCAST], ['ابي بحث', INTENTS.LATEST_PAPER], ['عندك ابحاث', INTENTS.LATEST_PAPER], ['عطني المقالات', INTENTS.LATEST_ARTICLES], ['ورني مقالاتك', INTENTS.LATEST_ARTICLES], ['شنو يديدك', INTENTS.LATEST_CONTENT], ['عندك شي يديد', INTENTS.LATEST_CONTENT], ['زيدني', INTENTS.MORE_LIKE_THIS],
  ['شنو عنده عن الغش', INTENTS.SEARCH_TOPIC],
  ['قارن بين التلقين والفهم', INTENTS.COMPARE], ['ذكرني بعد ساعتين', INTENTS.REMIND_ME],
]

for (const [phrase, expected] of PHRASES) {
  check('intent', phrase, () => {
    assert.equal(classifyIntent(phrase).intent, expected, `«${phrase}» تُصنَّف ${classifyIntent(phrase).intent} لا ${expected}`)
  })
}

/* كل صيغةٍ تُجاب جواباً حقيقياً — لا الردّ العامّ */
for (const [phrase] of PHRASES) {
  check('answered', phrase, () => {
    const chat = conversation()
    const text = textOf(chat.say(phrase))
    assert.ok(text.trim().length > 0, 'ردٌّ فارغ')
    assert.equal(FALLBACK.test(text), false, `«${phrase}» تُقابَل بالردّ العامّ:\n${text.split('\n')[0]}`)
  })
}

check('navigation', 'بوابات الكتاب والصوت والإعلام لا تعود إلى مقالات عشوائية', () => {
  const chat = conversation()
  const book = textOf(chat.say('ابي ابحث داخل الكتاب'))
  assert.match(book, /\/search\?tab=askbook/)
  assert.equal(/\/articles\//.test(book), false)
  assert.match(textOf(chat.say('فيديوهات داخل الكتاب')), /\/publications\/encyclopedia\?tab=video#encyclopedia-map/)
  assert.match(textOf(chat.say('حوار مسموع')), /\.dialogue\.mp3|\/listen/)
  assert.match(textOf(chat.say('الظهور الإعلامي')), /\/media/)
  assert.match(textOf(chat.say('الراديو')), /\/radio/)
})

/* المجاملة: التحية والشكر لا يُقابلان ببرودٍ ولا بمقالٍ عشوائي */
for (const [phrase, must] of [['السلام عليكم', /وعليكم السلام/], ['صباح الخير', /(صباح|نهارك|مساء)/], ['شكرا', /الله يعافيك/], ['الله يعطيك العافية', /الله يعافيك/]]) {
  check('courtesy', phrase, () => {
    const text = textOf(conversation().say(phrase))
    assert.match(text, must)
    assert.equal(FALLBACK.test(text), false)
  })
}
/* وبوابة السؤال الشخصي تبقى مُحكمة: لا تُفتح بالمجاملة */
check('courtesy', 'السؤال الشخصي يبقى خارج النطاق', () => {
  const text = textOf(conversation().say('كم عمرك'))
  assert.match(text, /خارج المحتوى المنشور/)
})

/* ═══ ٣ · ملاحقة الوعود ═══
   البوت يقطع في نصّ ردّه وعوداً. هنا نُنفّذ كل وعدٍ ونتحقّق أنه يُوفى. */
check('promise', '«اكتب اسم أي مسار وأختار لك أفضل نقطة بداية»', () => {
  const chat = conversation()
  const text = textOf(chat.say('شنو أكثر موضوع يكتب عنه'))
  assert.match(text, /اكتب اسم أي مسار/)
  const topic = text.split('\n').find((line) => /^\d+\.\s/.test(line))?.replace(/^\d+\.\s*/, '').split('—')[0].trim()
  assert.ok(topic, 'لم يُعرض مسارٌ أصلاً')
  const followUp = textOf(chat.say(topic))
  assert.equal(FALLBACK.test(followUp), false, `المسار «${topic}» لا يفتح شيئاً:\n${followUp.split('\n')[0]}`)
  assert.match(followUp, /https?:\/\//)
})

check('promise', '«قل: الأولى أو الثانية» بعد القائمة', () => {
  const chat = conversation()
  assert.match(textOf(chat.say('آخر مقالاته')), /الأولى|الأول/)
  const followUp = textOf(chat.say('الثانية'))
  assert.equal(FALLBACK.test(followUp), false)
  assert.match(followUp, /https?:\/\//)
})

check('promise', '«أرسل الرقم فقط» في التحدّي', () => {
  const chat = conversation()
  const text = textOf(chat.say('اختبرني'))
  assert.match(text, /أرسل الرقم فقط/)
  const followUp = textOf(chat.say('2'))
  assert.match(followUp, /إجابة صحيحة|الإجابة الصحيحة/)
})

check('promise', '«اكتب زدني» بعد سيرة الفكرة', () => {
  const chat = conversation()
  const text = textOf(chat.say('شنو عنده عن الغش'))
  if (!/زدني/.test(text)) return
  const followUp = textOf(chat.say('زدني'))
  assert.equal(FALLBACK.test(followUp), false, 'وعدُ «زدني» غير موفّى')
})

check('promise', '«قل اسم أيّها تريد» حين تغيب النسخة المطلوبة', () => {
  const chat = conversation()
  const text = textOf(chat.say('اسمعني الحوار'))
  if (!/قل اسم أيّها تريد/.test(text)) return
  const voice = /صوت نورة/.test(text) ? 'صوت نورة' : 'صوت فهد'
  const followUp = textOf(chat.say(voice))
  assert.match(followUp, /\.mp3/, 'سمّى المتاح ثم لم يُعطه')
})

check('promise', '«احفظها» ثم «محفوظاتي» يُريان المادة نفسها', () => {
  const chat = conversation()
  const saved = textOf(chat.say('احفظها'))
  const title = saved.split('\n').find((line) => line.trim() && !/^https?:/.test(line) && !/رفّك|حفظت/.test(line))?.replace(/\*/g, '').trim()
  const shelf = textOf(chat.say('محفوظاتي'))
  assert.ok(title, 'لم يُسمِّ ما حفظه')
  assert.ok(shelf.includes(title.slice(0, 18)), 'الرفّ لا يعرض ما حُفظ للتوّ')
})

/* ═══ ٤ · جمال المخرَج ═══ */
const QUOTED = /«([^»]*)»/g
function quotesIn(text) { return [...String(text).matchAll(QUOTED)].map((row) => row[1]) }

for (const phrase of ['موقع د. أحمد', 'لخص', '٣٠ ثانية', 'المصدر', 'اختبرني', 'اقتباس']) {
  check('beauty', `اقتباس «${phrase}» نظيفٌ في العرض`, () => {
    const text = textOf(conversation().say(phrase))
    for (const quote of quotesIn(text)) {
      assert.equal(/\n\s*\n/.test(quote), false, 'سطرٌ فارغ داخل علامتَي التنصيص')
      assert.equal(quote.includes('*'), false, 'نجمة تنسيقٍ داخل كلام الدكتور')
      assert.equal(quote.trim(), quote.trim().replace(/[،,]$/, ''), 'اقتباسٌ ينتهي بفاصلة معلّقة')
    }
    const stars = (text.match(/\*/g) || []).length
    assert.equal(stars % 2, 0, 'نجمة تعريضٍ مفردة تكسر التنسيق')
  })
}

check('beauty', 'اقتباس بوابة اليوم ينتهي عند وقفة لا في وسط الجملة', () => {
  const chat = conversation()
  const text = textOf(chat.say('موقع د. أحمد'))
  const quote = quotesIn(text)[0]
  assert.ok(quote, 'بوابة اليوم بلا اقتباس')
  /* لا نشترط النقطة دائماً (بعض المتون بلا وقفةٍ في المدى)، لكن نمنع الانتهاء
     بحرف عطفٍ أو أداةٍ معلّقة — وهي علامة القطع في وسط الجملة. */
  const lastWord = quote.trim().split(/\s+/).pop()
  assert.equal(['بل', 'أو', 'و', 'ثم', 'لكن', 'لأن', 'في', 'من', 'على', 'إلى', 'عن'].includes(lastWord), false, `الاقتباس ينتهي بـ«${lastWord}» — قطعٌ في وسط الجملة`)
})

/* كل اقتباسٍ منسوبٍ إلى مادةٍ يجب أن يكون منها حرفاً بحرف */
check('grounding', 'الاقتباسات المعروضة منسوخةٌ من المادة نفسها', () => {
  const chat = conversation()
  for (const phrase of ['موقع د. أحمد', '٣٠ ثانية', 'لخص', 'المصدر', 'كمل']) {
    const reply = chat.say(phrase)
    const item = reply?.contentId ? findContent(db, reply.contentId) : null
    if (!item) continue
    for (const quote of (reply.evidenceQuotes || [])) {
      assert.equal(isVerbatimFromItem(item, quote), true, `اقتباسٌ غير منسوخٍ من «${item.title}» في ردّ «${phrase}»`)
    }
  }
})

/* الصوت: كل صيغةٍ لطلب الصوت تُخرج رابطاً حقيقياً بالصوت الصحيح */
for (const [phrase, voice] of [['شغل الصوت', 'صوت فهد'], ['الصوت', 'صوت فهد'], ['قراءة صوتية', 'صوت فهد'], ['صوت نورة', 'صوت نورة'], ['سمعني', 'صوت فهد']]) {
  check('audio', phrase, () => {
    const text = textOf(conversation().say(phrase))
    assert.match(text, /\.mp3/, 'لا رابط صوتي')
    assert.ok(text.includes(voice), `الصوت المُعطى ليس ${voice}`)
  })
}
/* كان هذا الفحص يسأل «اسمعني الحوار» بلا سياق، فيقع على أحدث مقالة ويشترط
   ألّا يُعطى لها رابط. وقد صحّ ذلك يوم كُتب — يوم لم تكن حوارات المقالات قد
   نُشرت. ثم أكملت قافلة الصوت المئة والثلاث والأربعين، فصار الفحص يُدين
   الجوابَ الصحيح: رابطٌ لملفٍّ منشورٍ فعلاً على R2 وموثَّقٍ في سجلّ الصوت.
   فالشرط يُقاس الآن على مادةٍ **لا حوار لها فعلاً** (كتاب أو بحث)، فيبقى
   الحارس حارساً على القاعدة نفسها: لا رابطَ يقود إلى صمت. */
check('audio', 'الطلب غير المنشور لا يُعطى رابطاً البتّة', () => {
  const silent = buildContentIndex(root).find((item) => !item.audio?.dialogue && String(item.title || '').length > 6)
  assert.ok(silent, 'لا توجد مادةٌ بلا حوار منشور ليُقاس عليها الشرط')
  const chat = conversation()
  chat.say(silent.title)
  const text = textOf(chat.say('اسمعني الحوار'))
  if (/\.dialogue\.mp3/.test(text)) throw new Error(`أُعطي رابط حوارٍ غير منشور لـ«${silent.title}»`)
})

/* التذكير: «مساءً» مساءٌ فعلاً */
check('reminder', 'الساعة ٧ مساءً تُحفظ ١٩:٠٠ لا ٠٧:٠٠', async () => {
  const { parseReminderTime } = await import('../whatsapp-agent/reminders.mjs')
  const reference = new Date('2026-08-07T12:00:00+03:00')
  const evening = parseReminderTime('ذكرني الجمعة الساعة 7 مساءً', reference)
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuwait', hour: '2-digit', hourCycle: 'h23' }).format(new Date(evening.dueAt)))
  assert.equal(hour, 19)
})

const summary = {
  ok: results.failed === 0,
  passed: results.passed,
  failed: results.failed,
  failures: results.failures,
}
console.log(JSON.stringify(summary, null, 2))
if (results.failed) process.exit(1)
