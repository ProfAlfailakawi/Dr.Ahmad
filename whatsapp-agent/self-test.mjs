import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from './db.mjs'
import { buildContentIndex, searchContent } from './content-index.mjs'
import { classifyIntent, handleIncoming, setSuppression, shouldRespondToMessage } from './intent-engine.mjs'
import { MockTransport, canonicalChatJid } from './transport.mjs'
import { createAgent } from './agent.mjs'
import { quoteCardPayload } from './quote-card.mjs'
import { runCostAudit } from './cost-audit.mjs'
import { flags } from './config.mjs'
import { isQuietHour, repliesInWindow } from './bot-rules.mjs'
import { parseReminderTime } from './reminders.mjs'
import { hashOpaque } from './crypto.mjs'

export async function runSelfTest(root) {
  process.env.WHATSAPP_AGENT_KEY ||= Buffer.alloc(32, 7).toString('base64')
  const daytime = new Date('2026-07-21T12:00:00+03:00')
  const should = (args) => shouldRespondToMessage({ ...args, at: args?.at || daytime })
  const handle = (args) => handleIncoming({ ...args, at: args?.at || daytime })
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-ahmad-wa-'))
  const db = openDatabase(':memory:', { cryptoOptions: { allowEphemeral: true } })
  const items = buildContentIndex(root)
  assert.ok(items.length >= 10, 'content index should discover public records')
  const agent = createAgent({ db, transport: new MockTransport(), root, mock: true })
  const onMessage = (args) => agent.onMessage({ ...args, at: args?.at || daytime })
  const stats = agent.index()
  assert.equal(stats.count, items.length)
  assert.ok(agent.bridgeSecret().length >= 64, 'bridge secret must be at least 64 chars')
  assert.equal(classifyIntent('شنو آخر مقالة؟').intent, 'LATEST_ARTICLE')
  assert.equal(classifyIntent('شنو آخر مقالاته؟').intent, 'LATEST_ARTICLES')
  assert.equal(classifyIntent('شنو جديد الدكتور؟').intent, 'LATEST_CONTENT')
  assert.equal(classifyIntent('شنو أكثر مقالة مشاهدة؟').intent, 'MOST_VIEWED_ARTICLE')
  assert.equal(classifyIntent('شنو أكثر موضوع يكتب عنه؟').intent, 'TOP_ARTICLE_TOPIC')
  assert.equal(classifyIntent('عندي دقيقة').intent, 'ONE_MINUTE')
  assert.equal(classifyIntent('فاجئني').intent, 'SURPRISE_ME')
  assert.equal(searchContent(db, 'الذكاء الاصطناعي', { limit: 3 }).length >= 0, true)
  const started = await agent.start()
  assert.equal(started.status, 'connected')
  assert.equal((await agent.status()).bridgeOnline, true)
  /* كشفُ المجموعات معطَّلٌ عمداً في الوكيل (group-discovery-disabled)، وظلّ
     الاختبار يتوقّع مجموعةً واحدة فبقي أحمر لا يقرؤه أحد. نُثبّت التعطيل
     المقصود بدل أن نطالب بسلوكٍ أُزيل. */
  const groups = await agent.discoverGroups()
  assert.equal(groups.groups.length, 0, 'كشف المجموعات معطَّل عمداً')
  assert.equal(groups.reason, 'group-discovery-disabled')
  const blocked = should({ db, jid: '12345@s.whatsapp.net', text: 'شلونك' })
  assert.equal(blocked.allowed, false)
  const personalContent = handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو آخر مقالة؟' })
  assert.equal(personalContent.shouldRespond, false)
  assert.equal(handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو جديد الدكتور؟' }).shouldRespond, false, '★ الجديد لا يعمل قبل الإيقاظ')
  assert.equal(handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو أكثر مقالة مشاهدة؟' }).shouldRespond, false, '★ الترتيب لا يعمل قبل الإيقاظ')
  /* ★ «سؤال:» و«اسأل الدكتور» أُغلقتا بأمر الدكتور، وحُصر الإيقاظ في جملته
     المنشورة وحدها. وظلّ الاختبار يطالب بالسلوك القديم فبقي أحمر — ولهذا لم
     يمسك أحدٌ ثغرتَي المجموعة والصوت: الفحص لم يكن يُشغَّل. */
  assert.equal(handle({ db, jid: '12345@s.whatsapp.net', text: 'سؤال: شنو آخر مقالة؟' }).shouldRespond, false, '★ «سؤال:» لم تعد توقظ')
  const result = handle({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' })
  assert.equal(result.shouldRespond, true, '★ والجملة المنشورة وحدها توقظ')
  const naturalNew = handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو جديد الدكتور؟' })
  assert.equal(naturalNew.shouldRespond, true, '★ وبعد الإيقاظ يفهم سؤال الجديد الطبيعي')
  assert.match(naturalNew.text || '', /الجديد الآن|مكتبة الدكتور/, '★ ويرد من فهرس الموقع')
  const naturalArticles = handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو آخر مقالاته؟' })
  assert.equal(naturalArticles.shouldRespond, true, '★ ويفهم جمع المقالات')
  assert.match(naturalArticles.text || '', /أحدث .*مقالات|أحدث مقالة/, '★ ويعرض أكثر من خيار عند طلب الجمع')
  const naturalPopular = handle({ db, jid: '12345@s.whatsapp.net', text: 'شنو أكثر مقالة مشاهدة؟' })
  assert.equal(naturalPopular.shouldRespond, true, '★ ويفهم الأكثر مشاهدة')
  assert.match(naturalPopular.text || '', /مؤشر المشاهدة الداخلي/, '★ ولا يدّعي رقماً خارجياً')
  const transferRule = agent.saveReplyRule({ name: 'تحويل وسائط', keywords: ['صورة'], actionType: 'transfer', responseText: 'سأحوّلها لمراجعة بشرية.' })
  assert.equal(agent.listReplyRules().some((rule) => rule.id === transferRule.id), true)
  const transferSimulation = agent.simulateReply({ text: 'صورة من اللقاء' })
  assert.equal(transferSimulation.ruleId, transferRule.id)
  assert.equal(transferSimulation.preview, '', '★ قاعدة النص الحر لا تُرسل كلاماً مؤلفاً')
  assert.equal(transferSimulation.needsHuman, true, '★ وتتركها للدكتور بصمت')
  assert.equal(agent.replyRuleVersions(transferRule.id).length, 0)
  agent.saveReplyRule({ ...transferRule, responseText: 'نسخة جديدة' })
  assert.equal(agent.replyRuleVersions(transferRule.id).length, 1)
  agent.rollbackReplyRule(transferRule.id, agent.replyRuleVersions(transferRule.id)[0].id)
  agent.deleteReplyRule(transferRule.id)
  assert.equal(agent.listReplyRules().some((rule) => rule.id === transferRule.id), false)
  const groundedRule = agent.saveReplyRule({ name: 'بحث الموقع', keywords: ['التقييم'], actionType: 'site-content', contentQuery: 'التقييم', responseText: 'نص حر لا ينبغي أن يظهر' })
  const grounded = handle({ db, jid: '12345@s.whatsapp.net', text: 'التقييم', explicitContentSession: true })
  assert.equal(grounded.ruleId, groundedRule.id)
  assert.match(grounded.text || '', /https:\/\/dr-alfailakawi\.com\//, '★ الرد الموضوعي يحمل رابطاً من الموقع')
  assert.ok(!(grounded.text || '').includes('نص حر لا ينبغي أن يظهر'), '★ لا يسرّب النص الحر إلى الرد')
  agent.deleteReplyRule(groundedRule.id)
  agent.manualTakeover('12345@s.whatsapp.net', 1)
  /* الرقم شخصي: تدخّل الدكتور أعلى سلطة، حتى جملة الإيقاظ لا تتجاوزه. */
  assert.equal(should({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, false, '★ الجملة لا تتجاوز يد الدكتور')
  assert.equal(should({ db, jid: '12345@s.whatsapp.net', text: 'عندك شي عن التقييم؟' }).allowed, false, '★ وكل ما عداها يبقى صامتاً')
  agent.returnToBot('12345@s.whatsapp.net')
  assert.equal(should({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, true)
  assert.equal(onMessage({ jid: '12345@s.whatsapp.net', text: 'https://example.com', message: {} }).reason, 'media-or-link-human')
  agent.returnToBot('12345@s.whatsapp.net')
  const session = db.get('SELECT * FROM chat_sessions WHERE jid=?', db.jidKey('12345@s.whatsapp.net'))
  assert.ok(session, 'chat session must use an opaque jid key')

  /* ═══ ★ الاقتباس لا يفتح الباب ═══
   *
   * كان الشرط «فيها اقتباسٌ لأيّ رسالة» لا «اقتباسٌ لكلام البوت». فمن اقتبس
   * رسالةَ نفسه — وهو أكثر ما يفعله الناس — ردّ عليه البوت بلا جملة إيقاظ.
   * وقع هذا فعلاً: أرسل صديق الدكتور قائمةَ مجلات مقتبساً رسالته، فردّ البوت.
   */
  const quoter = '88888@s.whatsapp.net'
  /* شكلُ رسالة واتساب متداخل: الغلاف فيه `message` وداخله أنواع المحتوى.
     وهو ما يمرّره الناقل حرفياً (transport.mjs) — فنحاكيه كما هو لا كما نظن. */
  const quoting = (id) => ({ message: { message: { extendedTextMessage: { contextInfo: { stanzaId: id, quotedMessage: { conversation: 'أي كلام' } } } } } })

  const strangerQuote = onMessage({ jid: quoter, text: 'International journal of business', ...quoting('NOT-FROM-BOT-123') })
  assert.equal(strangerQuote.shouldRespond, false, '★ اقتباسُ رسالةٍ ليست من البوت لا يفتح الباب')

  /* أما اقتباسُ كلام البوت نفسه فيفتحه — وهو المقصود الأصليّ */
  db.run('INSERT OR IGNORE INTO outbox_messages(message_id,jid,source,created_at) VALUES(?,?,?,?)',
    'FROM-BOT-999', db.jidKey(quoter), 'bot', new Date().toISOString())
  /* نصٌّ يُنتج جواباً حقيقياً: «وش قصدك؟» لا يطابق شيئاً في الأرشيف، وقد صار
     ما لا جواب له يُقابَل بالصمت — فيختلط علينا سببُ الصمت بسبب الباب. */
  const botQuote = onMessage({ jid: quoter, text: 'آخر مقالة', ...quoting('FROM-BOT-999') })
  assert.equal(botQuote.shouldRespond, true, '★ اقتباسُ كلام البوت يبقى فاتحاً للباب')

  /* وبلا اقتباسٍ أصلاً: صمت */
  assert.equal(onMessage({ jid: quoter, text: 'كلام عابر', message: {} }).shouldRespond, false, 'وبلا اقتباس يبقى صامتاً')

  /* ═══ بلا سقف عددي ولا ساعات صمت ═══ */
  const unlimited = '95555@s.whatsapp.net'
  for (let i = 0; i < 60; i += 1) db.addAudit('auto-reply-sent', db.jidKey(unlimited), 'اختبار')
  assert.ok(repliesInWindow(db, unlimited) >= 60, 'العدّاد التشخيصي يقرأ الردود المُرسلة')
  assert.equal(onMessage({ jid: unlimited, text: 'موقع د. أحمد', message: {} }).shouldRespond, true,
    '★ كثرة الردود لا تمنع جملة الإيقاظ')

  /* والعدّاد لا يخلط المحاولة بالردّ؛ بقي للتشخيص فقط. */
  const tried = '95556@s.whatsapp.net'
  for (let i = 0; i < 20; i += 1) {
    db.run('INSERT INTO intent_logs(jid,input_hash,intent,confidence,created_at) VALUES(?,?,?,?,?)',
      db.jidKey(tried), 'h', 'SEARCH_TOPIC', 0.7, new Date().toISOString())
  }
  assert.equal(repliesInWindow(db, tried), 0, 'محاولاتٌ لم يُردّ عليها لا تُحسب ردوداً')

  assert.equal(isQuietHour(daytime), false, 'يعمل نهاراً')
  assert.equal(isQuietHour(new Date('2026-07-21T03:00:00+03:00')), false, 'ويعمل في الثالثة فجراً بلا نافذة صمت')

  /* ═══ تدخّل الدكتور يمنع أي رد آلي ═══ */
  const handled = '96009@s.whatsapp.net'
  agent.manualTakeover(handled, 30)
  assert.equal(onMessage({ jid: handled, text: 'موقع د. أحمد', message: {} }).shouldRespond, false,
    '★ جملة الإيقاظ لا تعمل أثناء تدخل الدكتور')
  assert.equal(onMessage({ jid: handled, text: 'عندك شي عن التقييم؟', message: {} }).shouldRespond, false,
    '★ وبقية الرسائل تبقى صامتة أيضاً')
  assert.equal(db.get("SELECT COUNT(*) c FROM audit_log WHERE action='wake-overrides-takeover'").c, 0,
    'لا يوجد مسار يتجاوز تدخل الدكتور')
  assert.equal(onMessage({ jid: '120399@g.us', text: 'موقع د. أحمد', message: {} }).shouldRespond, false, '★ ولا تفتح مجموعة')
  assert.equal(onMessage({ jid: handled, text: 'موقع د. أحمد', message: {}, media: true }).shouldRespond, false, '★ ولا تُبيح وسائط')
  agent.returnToBot(handled)
  assert.equal(onMessage({ jid: handled, text: 'عندك شي عن التقييم؟', message: {} }).shouldRespond, false,
    '★ إتاحة الإيقاظ لا تعيد الجلسة القديمة')
  assert.equal(onMessage({ jid: handled, text: 'موقع د. أحمد', message: {} }).shouldRespond, true,
    '★ جملة الإيقاظ وحدها تعيد البوت بعد تدخل الدكتور')

  /* انتهاء مهلة التدخل لا يعيد الجلسة تلقائياً. */
  const cooled = '96010@s.whatsapp.net'
  onMessage({ jid: cooled, text: 'موقع د. أحمد', message: {} })
  agent.manualTakeover(cooled, 1)
  db.run("UPDATE chat_sessions SET manual_until=? WHERE jid=?", new Date(Date.now() - 1000).toISOString(), db.jidKey(cooled))
  assert.equal(onMessage({ jid: cooled, text: 'آخر مقالة', message: {} }).shouldRespond, false,
    '★ بعد انتهاء الحماية يبقى صامتاً بلا إيقاظ')
  assert.equal(onMessage({ jid: cooled, text: 'موقع د. الفيلكاوي', message: {} }).shouldRespond, true,
    '★ وبعدها تفتح جملة الإيقاظ جلسة جديدة')

  /* الجلسة المفتوحة لا تنتهي بمرور الزمن. */
  const persistent = '96011@s.whatsapp.net'
  onMessage({ jid: persistent, text: 'موقع د. أحمد', message: {} })
  db.run("UPDATE chat_sessions SET opened_at=?,last_user_at=?,updated_at=? WHERE jid=?",
    '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', db.jidKey(persistent))
  assert.equal(onMessage({ jid: persistent, text: 'آخر مقالة', message: {} }).shouldRespond, true,
    '★ الجلسة تبقى حيّة بلا مؤقّت حتى يتدخل الدكتور')

  /* ═══ ★ لا يُعلن فشلاً في وجه إنسان ═══
   *
   * داخل جلسةٍ مفتوحة يصل إلى محرك البحث كلُّ ما يُكتب — ومنه ما ليس سؤالاً.
   * كتب رجلٌ بالإنجليزية أنه رُفض توظيفه لهويّته وأنه يعيش في فقر، فردّ عليه
   * البوت: «ما لقيت تطابقًا دقيقًا في أرشيف الموقع». والصمتُ خيرٌ من هذا.
   */
  const griever = '97007@s.whatsapp.net'
  onMessage({ jid: griever, text: 'موقع د. أحمد', message: {} })   // جلسة مفتوحة
  const grief = onMessage({ jid: griever, text: 'I have tried to find a job but they rejected me because of my identity. Im fed up. poverty. my salary is very low.', message: {} })
  assert.equal(grief.shouldRespond, false, '★ شكوى إنسانية لا يردّ عليها البوت')
  assert.ok(!/ما لقيت تطابق/.test(grief.text || ''), '★ ولا يُعلن فشل بحثٍ في وجهها')
  assert.ok(db.get("SELECT COUNT(*) c FROM audit_log WHERE action IN ('needs-human-silent','auto-reply-skipped')").c >= 1, 'ويُحوَّل للدكتور')
  /* والسؤال الحقيقي يبقى مُجاباً */
  agent.returnToBot(griever)
  onMessage({ jid: griever, text: 'موقع د. أحمد', message: {} })
  assert.equal(onMessage({ jid: griever, text: 'عندك شي عن التقييم؟', message: {} }).shouldRespond, true, 'والسؤال عن المحتوى يُجاب')

  /* ═══ «زدني» — وعدٌ يُوفى ═══
   *
   * كان البوت يقول «وله في هذا نصٌّ آخر — اكتب زدني»، فإذا كتبها السائل ردّ
   * «ما عندي شيءٌ قريبٌ منه الآن». السبب: محرك المكتبة يجد النصوص ويرمي ما لا
   * يعرضه، ثم يُطالَب بها محرّكٌ آخر لا يعلم عنها شيئاً. الآن تُحفظ البقية في
   * الجلسة وتُسلَّم من المحرك نفسه. وهذا الاختبار يمنع عودة الخُلف.
   */
  const seeker = '77777@s.whatsapp.net'
  const askAbout = handle({ db, jid: seeker, text: 'عندك شي عن التعليم؟', explicitContentSession: true })
  if (/زدني/.test(askAbout.text || '')) {
    const saved = db.get('SELECT followup_json FROM chat_sessions WHERE jid=?', db.jidKey(seeker))
    assert.ok(saved?.followup_json, 'البقية الموعودة يجب أن تُحفظ في الجلسة')
    const promisedSlugs = JSON.parse(saved.followup_json).seen
    const more = handle({ db, jid: seeker, text: 'زدني', explicitContentSession: true })
    assert.ok(!/ما عندي شيءٌ قريبٌ منه/.test(more.text || ''),
      '★ «زدني» بعد وعدٍ صريح لا يجوز أن تُقابَل بـ«ما عندي شيءٌ قريبٌ منه»')
    for (const slug of promisedSlugs) {
      assert.ok(!(more.text || '').includes(`/articles/${slug}`), '★ «زدني» لا تُعيد ما عُرض')
    }
  }
  setSuppression(db, '12345@s.whatsapp.net', false)
  assert.equal(db.get('SELECT jid FROM contacts WHERE id=?', hashOpaque('12345@s.whatsapp.net')).jid.startsWith('v1:'), true)
  assert.equal(parseReminderTime('ذكرني بعد ساعتين').source, 'relative')
  assert.equal(parseReminderTime('الجمعة الساعة 7 مساءً').source, 'friday')
  const reminderResult = handle({ db, jid: '12345@s.whatsapp.net', text: 'ذكرني بعد ساعتين', explicitContentSession: true })
  assert.ok(reminderResult.reminderId)
  assert.equal(db.get('SELECT jid FROM reminders WHERE id=?', reminderResult.reminderId).jid.startsWith('v1:'), true)
  /* مفتاح طوارئ المالك: يوقف الردود فوراً من اللوحة من دون قطع الربط. */
  const emergencyJid = '96666@s.whatsapp.net'
  agent.pauseAutoReplies()
  assert.equal((await agent.status()).runtimePaused, true, 'حالة الإيقاف الفوري تظهر في اللوحة')
  assert.equal(onMessage({ jid: emergencyJid, text: 'موقع د. أحمد', message: {} }).shouldRespond, false, '★ الإيقاف الفوري يمنع حتى جملة الإيقاظ')
  agent.resumeAutoReplies()
  assert.equal((await agent.status()).runtimePaused, false, 'تشغيل الردود يلغي الإيقاف الفوري')

  if (flags.personalNumberMode) {
    assert.throws(
      () => agent.queueCampaign({ name: 'اختبار محلي', message: 'رسالة اختبار', targets: [{ jid: '67890@s.whatsapp.net', kind: 'contact' }] }),
      /رقم شخصي/,
      'الحملات معطلة بالكامل على الرقم الشخصي',
    )
  } else {
    const campaignId = agent.queueCampaign({ name: 'اختبار محلي', message: 'رسالة اختبار', targets: [{ jid: '67890@s.whatsapp.net', kind: 'contact' }] })
    assert.equal(db.get('SELECT state FROM campaigns WHERE id=?', campaignId).state, 'draft')
    agent.approveCampaign(campaignId, { confirm: true })
    if (!flags.send) await assert.rejects(() => agent.sendCampaign(campaignId, { confirm: true, confirmAgain: true }), /الإرسال معطّل/)
    else await agent.sendCampaign(campaignId, { confirm: true, confirmAgain: true })
  }
  await agent.stop()
  setSuppression(db, '12345@s.whatsapp.net', true)
  assert.equal(should({ db, jid: '12345@s.whatsapp.net', text: 'فاجئني' }).allowed, false)
  assert.equal(handle({ db, jid: '99999@s.whatsapp.net', text: 'اسأل الدكتور: عندك شيء عن التعليم؟' }).shouldRespond, false, '★ «اسأل الدكتور» لم تعد تفتح باباً')
  assert.equal(handle({ db, jid: '99999@s.whatsapp.net', text: 'موقع د. الفيلكاوي' }).shouldRespond, true, 'والصيغة الثانية من جملته توقظ')
  /* ═══ ★ المنعان المطلقان: المجموعة والوسائط ═══
     وقعا معاً ليلة ٢٠ يوليو: أحدهم كتب جملة الإيقاظ في مجموعة ففُتحت جلسة
     ستّ ساعات، ثم ردّ البوت على رسالةٍ صوتية فيها. وحارس الوسائط كان يقرأ
     العَلَم من `message.media` ولا وجود له هناك، فلم يعمل ولا مرّة. */
  const groupJid = '120363000000000000@g.us'
  assert.equal(should({ db, jid: groupJid, text: 'موقع د. أحمد' }).allowed, false, '★ جملة الإيقاظ لا تفتح باباً في مجموعة')
  assert.equal(should({ db, jid: groupJid, text: 'أي كلام', explicitContentSession: true }).allowed, false, '★ ولا الجلسة المفتوحة تُبيح الردّ في مجموعة')
  /* السبب صار جملةً عربيةً تُعرض في المحاكي («مجموعة — لا ردّ فيها إطلاقاً»)
     بدل الرمز 'group-never'، وهو تحسينٌ مقصود لا عطب. فنختبر السلوك ونوعَ
     المحادثة المذكور فيه، لا نصّ الرمز — فالاختبار يحرس القاعدة لا الصياغة. */
  const groupGate = onMessage({ jid: groupJid, text: 'موقع د. أحمد', message: {} })
  assert.equal(groupGate.shouldRespond, false, '★ والناقل نفسه يصمت عن المجموعات')
  assert.match(String(groupGate.reason || ''), /مجموعة/, '★ وسببُ الصمت يسمّي المجموعة صراحةً')
  assert.equal(handle({ db, jid: groupJid, text: 'موقع د. أحمد' }).shouldRespond, false, 'ولا يُنتج ردّاً')

  /* ★ وما جرى مجرى المجموعة: الحالات والقنوات وقوائم البثّ — قائمةُ سماحٍ مغلقة */
  for (const stranger of ['status@broadcast', '120363000000000000@newsletter', '96500000000@broadcast', 'شيء@غريب']) {
    assert.equal(should({ db, jid: stranger, text: 'موقع د. أحمد' }).allowed, false, `★ لا ردّ في ${stranger}`)
    assert.equal(onMessage({ jid: stranger, text: 'موقع د. أحمد', message: {} }).shouldRespond, false, `★ ولا من المدخل: ${stranger}`)
  }
  /* والمحادثة الفردية تبقى تعمل — وإلا صار الإصلاح تعطيلاً */
  assert.equal(should({ db, jid: '77777@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, true, '★ والفردية تُوقظه كما كانت')
  assert.equal(should({ db, jid: '77777@lid', text: 'موقع د. أحمد' }).allowed, true, 'وصيغة lid فردية أيضاً')
  assert.equal(canonicalChatJid({ key: { remoteJid: '77777@lid', remoteJidAlt: '96577777@s.whatsapp.net' } }), '96577777@s.whatsapp.net', '★ LID ورقم الهاتف يصيران جلسة واحدة')
  assert.equal(canonicalChatJid({ key: { remoteJid: '120363000@g.us', remoteJidAlt: '96577777@s.whatsapp.net' } }), '120363000@g.us', '★ المجموعة لا تتحول إلى محادثة فردية')

  /* ★ الوسائط: العَلَم يصل من المستوى الأعلى `media` لا من داخل `message` */
  assert.equal(onMessage({ jid: '55555@s.whatsapp.net', text: '[وسائط]', message: {}, media: true }).reason, 'media-or-link-human', '★ الصوت والصورة يوقفان الردّ')
  assert.equal(should({ db, jid: '55555@s.whatsapp.net', text: 'موقع د. أحمد', hasMedia: true }).allowed, false, '★ ولا تُبيحها جملة الإيقاظ')
  assert.equal(should({ db, jid: '55555@s.whatsapp.net', text: 'أي كلام', hasMedia: true, explicitContentSession: true }).allowed, false, '★ ولا جلسةٌ مفتوحة')

  /* ★ كشف الوسائط في الناقل: «ما ليس نصّاً محضاً فوسائط» — لا قائمةُ منعٍ ناقصة */
  const TEXT_KINDS = new Set(['conversation', 'extendedTextMessage', 'messageContextInfo', 'senderKeyDistributionMessage'])
  const looksLikeMedia = (payload) => Object.keys(payload).filter((k) => payload[k] != null).some((k) => !TEXT_KINDS.has(k))
  assert.equal(looksLikeMedia({ audioMessage: { ptt: true } }), true, '★ البصمة الصوتية وسائط')
  assert.equal(looksLikeMedia({ locationMessage: {} }), true, '★ والموقع وسائط — لم يكن في القائمة القديمة')
  assert.equal(looksLikeMedia({ pollCreationMessage: {} }), true, '★ والاستطلاع كذلك')
  assert.equal(looksLikeMedia({ viewOnceMessage: {} }), true, '★ ورسالة المرّة الواحدة كذلك')
  assert.equal(looksLikeMedia({ conversation: 'موقع د. أحمد' }), false, 'والنصّ المحض يبقى نصّاً')
  assert.equal(looksLikeMedia({ extendedTextMessage: { text: 'مرحبا' }, messageContextInfo: {} }), false, 'والنصّ المقتبس نصٌّ أيضاً')

  const first = db.get('SELECT * FROM content_items LIMIT 1')
  assert.ok(quoteCardPayload(first))
  const cost = runCostAudit(root)
  assert.equal(cost.zeroCostMode, true)
  db.close()
  fs.rmSync(temp, { recursive: true, force: true })
  return { ok: true, indexed: stats, cost }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSelfTest(path.resolve(process.argv[2] || process.cwd())).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error); process.exitCode = 1 })
}
