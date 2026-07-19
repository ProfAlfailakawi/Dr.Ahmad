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
  const groups = await agent.discoverGroups()
  assert.equal(groups.groups.length, 1)
  assert.equal(groups.groups[0].name, 'مجموعة اختبار محلية')
  assert.ok(db.get('SELECT jid FROM broadcast_lists WHERE id=?', groups.groups[0].id).jid.startsWith('v1:'))
  const blocked = shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'شلونك' })
  assert.equal(blocked.allowed, false)
  const personalContent = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'شنو آخر مقالة؟' })
  assert.equal(personalContent.shouldRespond, false)
  const result = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'سؤال: شنو آخر مقالة؟' })
  assert.equal(result.shouldRespond, true)
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
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'سؤال: شنو آخر مقالة؟' }).allowed, false)
  agent.returnToBot('12345@s.whatsapp.net')
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'سؤال: شنو آخر مقالة؟' }).allowed, true)
  assert.equal(agent.onMessage({ jid: '12345@s.whatsapp.net', text: 'https://example.com', message: {} }).reason, 'media-or-link-human')
  agent.returnToBot('12345@s.whatsapp.net')
  const session = db.get('SELECT * FROM chat_sessions WHERE jid=?', db.jidKey('12345@s.whatsapp.net'))
  assert.ok(session, 'chat session must use an opaque jid key')
  setSuppression(db, '12345@s.whatsapp.net', false)
  assert.equal(db.get('SELECT jid FROM contacts WHERE id=?', hashOpaque('12345@s.whatsapp.net')).jid.startsWith('v1:'), true)
  assert.equal(parseReminderTime('ذكرني بعد ساعتين').source, 'relative')
  assert.equal(parseReminderTime('الجمعة الساعة 7 مساءً').source, 'friday')
  const reminderResult = handleIncoming({ db, jid: '12345@s.whatsapp.net', text: 'ذكرني بعد ساعتين', explicitContentSession: true })
  assert.ok(reminderResult.reminderId)
  assert.equal(db.get('SELECT jid FROM reminders WHERE id=?', reminderResult.reminderId).jid.startsWith('v1:'), true)
  const campaignId = agent.queueCampaign({ name: 'اختبار محلي', message: 'رسالة اختبار', targets: [{ jid: '67890@s.whatsapp.net', kind: 'contact' }] })
  const groupCampaignId = agent.queueCampaign({ name: 'اختبار قروب', message: 'رسالة هادئة', targets: [{ jid: groups.groups[0].jid, kind: 'group', displayName: groups.groups[0].name }] })
  assert.throws(() => agent.queueCampaign({ name: 'مرفوضة', message: 'رسالة', targets: ['96550000000'] }), /رقمًا خامًا/)
  assert.equal(db.get('SELECT state FROM campaigns WHERE id=?', campaignId).state, 'draft')
  assert.equal(db.get('SELECT kind FROM campaign_targets WHERE campaign_id=?', groupCampaignId).kind, 'group')
  assert.equal(db.get('SELECT jid FROM contacts WHERE id=?', hashOpaque('67890@s.whatsapp.net')).jid.startsWith('v1:'), true)
  agent.approveCampaign(campaignId, { confirm: true })
  assert.equal(db.get('SELECT state FROM campaigns WHERE id=?', campaignId).state, 'approved')
  await assert.rejects(() => agent.sendCampaign(campaignId, { confirm: true, confirmAgain: true }), /الإرسال معطّل/)
  await agent.stop()
  setSuppression(db, '12345@s.whatsapp.net', true)
  assert.equal(shouldRespondToMessage({ db, jid: '12345@s.whatsapp.net', text: 'فاجئني' }).allowed, false)
  assert.equal(handleIncoming({ db, jid: '99999@s.whatsapp.net', text: 'اسأل الدكتور: عندك شيء عن التعليم؟' }).shouldRespond, true)
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
