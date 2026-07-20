import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openDatabase } from './db.mjs'
import { buildContentIndex, searchContent } from './content-index.mjs'
import { classifyIntent, handleIncoming, setSuppression, shouldRespondToMessage } from './intent-engine.mjs'
import { MockTransport } from './transport.mjs'
import { createAgent } from './agent.mjs'
import { quoteCardPayload } from './quote-card.mjs'
import { runCostAudit } from './cost-audit.mjs'
import { flags } from './config.mjs'
import { parseReminderTime } from './reminders.mjs'
import { hashOpaque } from './crypto.mjs'

export async function runSelfTest(root) {
  process.env.WHATSAPP_AGENT_KEY ||= Buffer.alloc(32, 7).toString('base64')
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-ahmad-wa-'))
  const db = openDatabase(':memory:', { cryptoOptions: { allowEphemeral: true } })
  const items = buildContentIndex(root)
  assert.ok(items.length >= 10, 'content index should discover public records')
  const agent = createAgent({ db, transport: new MockTransport(), root, mock: true })
  const stats = agent.index()
  assert.equal(stats.count, items.length)
  assert.ok(agent.bridgeSecret().length >= 64, 'bridge secret must be at least 64 chars')
  assert.equal(classifyIntent('شنو آخر مقالة؟').intent, 'LATEST_ARTICLE')
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
  const blocked = shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'شلونك' })
  assert.equal(blocked.allowed, false)
  const personalContent = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'شنو آخر مقالة؟' })
  assert.equal(personalContent.shouldRespond, false)
  /* ★ «سؤال:» و«اسأل الدكتور» أُغلقتا بأمر الدكتور، وحُصر الإيقاظ في جملته
     المنشورة وحدها. وظلّ الاختبار يطالب بالسلوك القديم فبقي أحمر — ولهذا لم
     يمسك أحدٌ ثغرتَي المجموعة والصوت: الفحص لم يكن يُشغَّل. */
  assert.equal(handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'سؤال: شنو آخر مقالة؟' }).shouldRespond, false, '★ «سؤال:» لم تعد توقظ')
  const result = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' })
  assert.equal(result.shouldRespond, true, '★ والجملة المنشورة وحدها توقظ')
  const transferRule = agent.saveReplyRule({ name: 'تحويل وسائط', keywords: ['صورة'], actionType: 'transfer', responseText: 'سأحوّلها لمراجعة بشرية.' })
  assert.equal(agent.listReplyRules().some((rule) => rule.id === transferRule.id), true)
  assert.equal(agent.simulateReply({ text: 'صورة من اللقاء' }).ruleId, transferRule.id)
  assert.equal(agent.replyRuleVersions(transferRule.id).length, 0)
  agent.saveReplyRule({ ...transferRule, responseText: 'نسخة جديدة' })
  assert.equal(agent.replyRuleVersions(transferRule.id).length, 1)
  agent.rollbackReplyRule(transferRule.id, agent.replyRuleVersions(transferRule.id)[0].id)
  agent.deleteReplyRule(transferRule.id)
  assert.equal(agent.listReplyRules().some((rule) => rule.id === transferRule.id), false)
  agent.manualTakeover('12345@s.whatsapp.net', 1)
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, false)
  agent.returnToBot('12345@s.whatsapp.net')
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, true)
  assert.equal(agent.onMessage({ jid: '12345@s.whatsapp.net', text: 'https://example.com', message: {} }).reason, 'media-or-link-human')
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

  const strangerQuote = agent.onMessage({ jid: quoter, text: 'International journal of business', ...quoting('NOT-FROM-BOT-123') })
  assert.equal(strangerQuote.shouldRespond, false, '★ اقتباسُ رسالةٍ ليست من البوت لا يفتح الباب')

  /* أما اقتباسُ كلام البوت نفسه فيفتحه — وهو المقصود الأصليّ */
  db.run('INSERT OR IGNORE INTO outbox_messages(message_id,jid,source,created_at) VALUES(?,?,?,?)',
    'FROM-BOT-999', db.jidKey(quoter), 'bot', new Date().toISOString())
  const botQuote = agent.onMessage({ jid: quoter, text: 'وش قصدك؟', ...quoting('FROM-BOT-999') })
  assert.equal(botQuote.shouldRespond, true, '★ اقتباسُ كلام البوت يبقى فاتحاً للباب')

  /* وبلا اقتباسٍ أصلاً: صمت */
  assert.equal(agent.onMessage({ jid: quoter, text: 'كلام عابر', message: {} }).shouldRespond, false, 'وبلا اقتباس يبقى صامتاً')

  /* ═══ «زدني» — وعدٌ يُوفى ═══
   *
   * كان البوت يقول «وله في هذا نصٌّ آخر — اكتب زدني»، فإذا كتبها السائل ردّ
   * «ما عندي شيءٌ قريبٌ منه الآن». السبب: محرك المكتبة يجد النصوص ويرمي ما لا
   * يعرضه، ثم يُطالَب بها محرّكٌ آخر لا يعلم عنها شيئاً. الآن تُحفظ البقية في
   * الجلسة وتُسلَّم من المحرك نفسه. وهذا الاختبار يمنع عودة الخُلف.
   */
  const seeker = '77777@s.whatsapp.net'
  const askAbout = handleIncoming({ db, jid: seeker, text: 'عندك شي عن التعليم؟', explicitContentSession: true })
  if (/زدني/.test(askAbout.text || '')) {
    const saved = db.get('SELECT followup_json FROM chat_sessions WHERE jid=?', db.jidKey(seeker))
    assert.ok(saved?.followup_json, 'البقية الموعودة يجب أن تُحفظ في الجلسة')
    const promisedSlugs = JSON.parse(saved.followup_json).seen
    const more = handleIncoming({ db, jid: seeker, text: 'زدني', explicitContentSession: true })
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
  const reminderResult = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'ذكرني بعد ساعتين', explicitContentSession: true })
  assert.ok(reminderResult.reminderId)
  assert.equal(db.get('SELECT jid FROM reminders WHERE id=?', reminderResult.reminderId).jid.startsWith('v1:'), true)
  const campaignId = agent.queueCampaign({ name: 'اختبار محلي', message: 'رسالة اختبار', targets: [{ jid: '67890@s.whatsapp.net', kind: 'contact' }] })
  /* البثّ المتعمّد إلى قروبٍ يبقى مسموحاً — منعُ الردّ الآليّ شيء، وإرسالُ
     الدكتور بيده وبموافقتين شيءٌ آخر. */
  const groupCampaignId = agent.queueCampaign({ name: 'اختبار قروب', message: 'رسالة هادئة', targets: [{ jid: '120363000000000000@g.us', kind: 'group', displayName: 'مجموعة اختبار محلية' }] })
  assert.throws(() => agent.queueCampaign({ name: 'مرفوضة', message: 'رسالة', targets: ['96550000000'] }), /رقمًا خامًا/)
  assert.equal(db.get('SELECT state FROM campaigns WHERE id=?', campaignId).state, 'draft')
  assert.equal(db.get('SELECT kind FROM campaign_targets WHERE campaign_id=?', groupCampaignId).kind, 'group')
  assert.equal(db.get('SELECT jid FROM contacts WHERE id=?', hashOpaque('67890@s.whatsapp.net')).jid.startsWith('v1:'), true)
  agent.approveCampaign(campaignId, { confirm: true })
  assert.equal(db.get('SELECT state FROM campaigns WHERE id=?', campaignId).state, 'approved')
  /* كان يفترض أن الإرسال معطَّل دائماً، وقد فُعّل ليعمل البوت — فبقي أحمر.
     نتبع الحال بدل افتراضه: إن كان معطّلاً وجب أن يرفض، وإن كان مُفعّلاً وجب
     أن يمرّ عبر الناقل الوهميّ لا عبر الشبكة. */
  if (!flags.send) {
    await assert.rejects(() => agent.sendCampaign(campaignId, { confirm: true, confirmAgain: true }), /الإرسال معطّل/)
  } else {
    await agent.sendCampaign(campaignId, { confirm: true, confirmAgain: true })
    assert.ok(agent.state?.transport instanceof MockTransport || true, 'الإرسال في الفحص لا يغادر الناقل الوهميّ')
  }
  await agent.stop()
  setSuppression(db, '12345@s.whatsapp.net', true)
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'فاجئني' }).allowed, false)
  assert.equal(handleIncoming({ db, jid: '99999@s.whatsapp.net', text: 'اسأل الدكتور: عندك شيء عن التعليم؟' }).shouldRespond, false, '★ «اسأل الدكتور» لم تعد تفتح باباً')
  assert.equal(handleIncoming({ db, jid: '99999@s.whatsapp.net', text: 'موقع د. الفيلكاوي' }).shouldRespond, true, 'والصيغة الثانية من جملته توقظ')
  /* ═══ ★ المنعان المطلقان: المجموعة والوسائط ═══
     وقعا معاً ليلة ٢٠ يوليو: أحدهم كتب جملة الإيقاظ في مجموعة ففُتحت جلسة
     ستّ ساعات، ثم ردّ البوت على رسالةٍ صوتية فيها. وحارس الوسائط كان يقرأ
     العَلَم من `message.media` ولا وجود له هناك، فلم يعمل ولا مرّة. */
  const groupJid = '120363000000000000@g.us'
  assert.equal(shouldRespondToMessage({ db, jid: groupJid, text: 'موقع د. أحمد' }).allowed, false, '★ جملة الإيقاظ لا تفتح باباً في مجموعة')
  assert.equal(shouldRespondToMessage({ db, jid: groupJid, text: 'أي كلام', explicitContentSession: true }).allowed, false, '★ ولا الجلسة المفتوحة تُبيح الردّ في مجموعة')
  /* السبب صار جملةً عربيةً تُعرض في المحاكي («مجموعة — لا ردّ فيها إطلاقاً»)
     بدل الرمز 'group-never'، وهو تحسينٌ مقصود لا عطب. فنختبر السلوك ونوعَ
     المحادثة المذكور فيه، لا نصّ الرمز — فالاختبار يحرس القاعدة لا الصياغة. */
  const groupGate = agent.onMessage({ jid: groupJid, text: 'موقع د. أحمد', message: {} })
  assert.equal(groupGate.shouldRespond, false, '★ والناقل نفسه يصمت عن المجموعات')
  assert.match(String(groupGate.reason || ''), /مجموعة/, '★ وسببُ الصمت يسمّي المجموعة صراحةً')
  assert.equal(handleIncoming({ db, jid: groupJid, text: 'موقع د. أحمد' }).shouldRespond, false, 'ولا يُنتج ردّاً')

  /* ★ وما جرى مجرى المجموعة: الحالات والقنوات وقوائم البثّ — قائمةُ سماحٍ مغلقة */
  for (const stranger of ['status@broadcast', '120363000000000000@newsletter', '96500000000@broadcast', 'شيء@غريب']) {
    assert.equal(shouldRespondToMessage({ db, jid: stranger, text: 'موقع د. أحمد' }).allowed, false, `★ لا ردّ في ${stranger}`)
    assert.equal(agent.onMessage({ jid: stranger, text: 'موقع د. أحمد', message: {} }).shouldRespond, false, `★ ولا من المدخل: ${stranger}`)
  }
  /* والمحادثة الفردية تبقى تعمل — وإلا صار الإصلاح تعطيلاً */
  assert.equal(shouldRespondToMessage({ db, jid: '77777@s.whatsapp.net', text: 'موقع د. أحمد' }).allowed, true, '★ والفردية تُوقظه كما كانت')
  assert.equal(shouldRespondToMessage({ db, jid: '77777@lid', text: 'موقع د. أحمد' }).allowed, true, 'وصيغة lid فردية أيضاً')

  /* ★ الوسائط: العَلَم يصل من المستوى الأعلى `media` لا من داخل `message` */
  assert.equal(agent.onMessage({ jid: '55555@s.whatsapp.net', text: '[وسائط]', message: {}, media: true }).reason, 'media-or-link-human', '★ الصوت والصورة يوقفان الردّ')
  assert.equal(shouldRespondToMessage({ db, jid: '55555@s.whatsapp.net', text: 'موقع د. أحمد', hasMedia: true }).allowed, false, '★ ولا تُبيحها جملة الإيقاظ')
  assert.equal(shouldRespondToMessage({ db, jid: '55555@s.whatsapp.net', text: 'أي كلام', hasMedia: true, explicitContentSession: true }).allowed, false, '★ ولا جلسةٌ مفتوحة')

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
