import fs from 'node:fs'
import path from 'node:path'
import { BRIDGE_PORT, BRIDGE_SECRET_MIN_LENGTH, BROADCAST_DEFAULT_INTERVAL_SECONDS, BROADCAST_MIN_INTERVAL_SECONDS, HEARTBEAT_INTERVAL_MS, HEARTBEAT_STALE_MS, MANUAL_TAKEOVER_MINUTES, MAX_CAMPAIGN_TARGETS, MAX_MESSAGE_CHARS, SITE_URL, TIME_ZONE, flags, projectRoot, redactError, redactJid } from './config.mjs'
import { openDatabase } from './db.mjs'
import { syncContentIndex } from './content-index.mjs'
import { handleIncoming, handleIntent, markManualTakeover, setSuppression } from './intent-engine.mjs'
import { MockTransport, createWhatsAppTransport } from './transport.mjs'
import { randomToken } from './crypto.mjs'
import { createReminder } from './reminders.mjs'
import { startLocalBridge } from './bridge.mjs'
import { addContactByPhone, addMembers, absorbContacts, createList, deleteList, ensureAudienceSchema, jidOf, listContacts, listLists, listMembers, personalize, previewFor, removeMember, renameList, resolveAudience, setNickname, vocativeOf } from './audience.mjs'

function safeText(text) { return String(text || '').slice(0, MAX_MESSAGE_CHARS).trim() }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function createAgent({ db = openDatabase(), transport, root = projectRoot, mock = false } = {}) {
  const state = { db, transport: transport || null, root, timers: new Set(), started: false, bridge: null, activeCampaigns: new Set() }
  /* واجهة الوكيل العامة تُعلن هنا وتُملأ عند الإرجاع: الجسر كان يستقبل `state`
     الخام فينهار على `agent.bridgeSecret is not a function` قبل أن يفتح المنفذ،
     فتظهر اللوحة «غير مرتبط» بينما واتساب متصل فعلاً. */
  const api = {}
  ensureAudienceSchema(db)
  const index = () => syncContentIndex(db, root, SITE_URL)

  /* ═══ الجمهور: دفتر الأسماء وقوائم الدكتور ═══
     واتساب لا يصدّر قوائم البث لجهازٍ مرتبط (لا دالة لها في baileys)، لكنه
     يزامن جهات الاتصال بأسمائها — فمنها يبني الدكتور قوائمه، ونرسل رسائل
     فردية مخصّصة بدل بثٍّ أعمى: تصل لمن لم يحفظ رقمه، وتناديه باسمه. */
  const onContacts = (contacts) => absorbContacts(db, contacts)
  const audience = {
    contacts: (options) => listContacts(db, options),
    addContact: (phone, nickname) => addContactByPhone(db, phone, nickname),
    setNickname: (contactId, nickname) => setNickname(db, contactId, nickname),
    lists: () => listLists(db),
    createList: (name, note) => createList(db, name, note),
    renameList: (id, name, note) => renameList(db, id, name, note),
    deleteList: (id) => deleteList(db, id),
    members: (listId) => listMembers(db, listId),
    addMembers: (listId, ids) => addMembers(db, listId, ids),
    removeMember: (listId, id) => removeMember(db, listId, id),
    preview: (listId, text) => previewFor(db, listId, text),
    /* من قائمةٍ إلى مسوّدة حملة: يحوّل الأعضاء إلى جهات، ويترك الاعتماد
       والإرسال بيد الدكتور كما هما — لا تخرج رسالة بغير أمره. */
    draftFromList(listId, name, message) {
      const list = db.get('SELECT * FROM broadcast_lists WHERE id=?', listId)
      if (!list) throw new Error('القائمة غير موجودة')
      const { send } = resolveAudience(db, listId)
      if (!send.length) throw new Error('لا أحد في هذه القائمة (أو كلهم طلبوا الإيقاف).')
      const targets = send.map((member) => {
        const row = db.get('SELECT * FROM contacts WHERE id=?', member.id)
        return { id: member.id, jid: jidOf(db, row), kind: 'contact' }
      }).filter((target) => target.jid)
      const id = queueCampaign({ name: name || `${list.name} — ${new Date().toLocaleDateString('en-GB')}`, message, targets })
      db.addAudit('campaign-from-list', listId, `targets=${targets.length}`)
      return { id, targets: targets.length }
    },
    resolve: (listId) => resolveAudience(db, listId),
    personalize,
  }
  const decryptJidSafe = (value) => {
    try { return value ? db.decryptJid(value) : '' } catch { return String(value || '') }
  }
  const campaignInterval = (seconds) => Math.max(BROADCAST_MIN_INTERVAL_SECONDS, Number(seconds || BROADCAST_DEFAULT_INTERVAL_SECONDS))
  const resolveCampaignTarget = (target) => {
    if (target.kind === 'self' || target.target_id === 'self') return 'self@s.whatsapp.net'
    if (target.encrypted_jid) return decryptJidSafe(target.encrypted_jid)
    return ''
  }
  const campaignTargets = (id) => db.all('SELECT ct.*, c.jid AS encrypted_jid, c.suppressed AS contact_suppressed FROM campaign_targets ct LEFT JOIN contacts c ON c.id=ct.target_id WHERE ct.campaign_id=? ORDER BY ct.target_id', id)
  const heartbeat = () => db.setSetting('bridge.heartbeat', { at: new Date().toISOString(), pid: process.pid })
  const bridgeSecret = () => {
    const configured = String(process.env.WHATSAPP_AGENT_BRIDGE_SECRET || '').trim()
    if (configured && configured.length < BRIDGE_SECRET_MIN_LENGTH) throw new Error(`WHATSAPP_AGENT_BRIDGE_SECRET يجب ألا يقل عن ${BRIDGE_SECRET_MIN_LENGTH} خانة.`)
    if (configured) return configured
    const existing = db.getSetting('bridge.secret', '')
    if (typeof existing === 'string' && existing.length >= BRIDGE_SECRET_MIN_LENGTH) return existing
    const generated = randomToken(48)
    db.setSetting('bridge.secret', generated)
    db.addAudit('bridge-secret-created', 'local', `length=${generated.length}`)
    return generated
  }
  const onMessage = ({ jid, text, message }) => {
    if (message?.media || /https?:\/\/|www\./i.test(String(text || ''))) {
      markManualTakeover(db, jid)
      db.addAudit('needs-human-media-or-link', redactJid(jid), message?.media ? 'media' : 'link')
      return { shouldRespond: false, reason: 'media-or-link-human' }
    }
    const response = handleIncoming({ db, jid, text: safeText(text), isReplyToAgent: Boolean(message?.message?.extendedTextMessage?.contextInfo?.quotedMessage) })
    if (!response.shouldRespond) db.addAudit('auto-reply-skipped', redactJid(jid), response.reason || 'blocked')
    if (!response.shouldRespond || !flags.autoReply || !flags.send) return response
    if (response.text && state.transport?.sendText) {
      void state.transport.sendText(jid, response.text).catch((error) => db.addAudit('auto-reply-failed', redactJid(jid), redactError(error)))
    }
    return response
  }
  const start = async ({ phoneNumber } = {}) => {
    if (!flags.agent) { db.setState({ status: 'paused', last_error: 'WHATSAPP_AGENT_ENABLED=false' }); return { status: 'paused' } }
    if (state.started) return db.state()
    index()
    db.purgeExpired()
    if (!state.transport) state.transport = mock ? new MockTransport() : await createWhatsAppTransport({ db, onMessage, onContacts })
    /* حين يكتب الدكتور بيده، يصمت البوت فوراً في تلك المحادثة ويعود بعد
       المدة المحددة. كان الحدث يُطلَق من واتساب ولا أحد يستمع له — فيتكلم
       البوت فوق كلام الدكتور. هذا هو المستمع الغائب. */
    if (!state.takeoverBound && state.transport?.events?.on) {
      state.transport.events.on('manual-takeover', (jid) => {
        try { manualTakeover(jid) } catch (error) { db.addAudit('manual-takeover-failed', '', redactError(error)) }
      })
      state.takeoverBound = true
    }
    const transportEvents = state.transport.events || state.transport
    transportEvents?.on?.('status', (payload) => db.setState(typeof payload === 'string' ? { status: payload } : payload))
    // QR/pairing secrets are emitted only in-process; never persist them in SQLite or expose them through the web bridge.
    transportEvents?.on?.('qr', () => db.setState({ status: 'pairing', qr: null, pairing_code: null }))
    transportEvents?.on?.('pairing-code', () => db.setState({ status: 'pairing', qr: null, pairing_code: null }))
    transportEvents?.on?.('manual-takeover', (jid) => markManualTakeover(db, jid))
    await state.transport.connect({ phoneNumber })
    state.started = true
    if (process.env.WHATSAPP_AGENT_BRIDGE === 'true' && !state.bridge) state.bridge = startLocalBridge(api)
    heartbeat()
    state.timers.add(setInterval(heartbeat, HEARTBEAT_INTERVAL_MS))
    if (flags.reminders) state.timers.add(setInterval(() => void dispatchDueReminders(state), 30000))
    return db.state()
  }
  const stop = async () => {
    for (const timer of state.timers) clearInterval(timer)
    state.timers.clear(); await state.transport?.disconnect?.(); await new Promise((resolve) => state.bridge ? state.bridge.close(resolve) : resolve()); state.bridge = null; state.started = false
  }
  const sendSelf = async (text) => {
    if (!flags.send) throw new Error('الإرسال معطل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED بعد اختبار Mock واعتمادك الصريح.')
    if (!state.transport) throw new Error('الوكيل غير مشغّل')
    const clean = safeText(text); if (!clean) throw new Error('النص فارغ')
    const result = state.transport.sendSelf ? await state.transport.sendSelf(clean) : await state.transport.sendText('self@s.whatsapp.net', clean)
    db.addAudit('send-self', 'self', `chars=${clean.length}`)
    return result
  }
  const queueCampaign = ({ name, message, targets = [], scheduledAt = null }) => {
    if (!name || !message) throw new Error('اسم الحملة ورسالتها مطلوبان')
    if (targets.length > MAX_CAMPAIGN_TARGETS) throw new Error(`الحد الآمن للحملة ${MAX_CAMPAIGN_TARGETS} جهة.`)
    for (const target of targets) if (typeof target === 'string' && !target.includes('@') && target !== 'self') throw new Error('لا تحفظ رقمًا خامًا؛ استخدم الذات أو جهة معروفة بصيغة jid محليًا.')
    const id = randomToken(10); const now = new Date().toISOString()
    db.run('INSERT INTO campaigns(id,name,state,message,created_at,scheduled_at,updated_at) VALUES(?,?,?,?,?,?,?)', id, name, 'draft', safeText(message), now, scheduledAt, now)
    for (const target of targets) {
      const jid = target?.jid || (typeof target === 'string' && target.includes('@') ? target : null)
      const targetId = String(target?.id || (jid ? db.jidKey(jid) : target))
      const targetKind = ['self', 'contact', 'group'].includes(target?.kind) ? target.kind : (jid?.endsWith('@g.us') ? 'group' : (jid ? 'contact' : 'self'))
      if (jid) {
        const created = now
        db.run('INSERT INTO contacts(id,jid,display_name,phone,suppressed,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at', targetId, db.encryptJid(jid), target?.displayName ? db.encryptText(target.displayName) : null, target?.phone ? db.encryptText(target.phone) : null, target?.suppressed ? 1 : 0, created, created)
      }
      db.run('INSERT OR IGNORE INTO campaign_targets(campaign_id,target_id,kind,suppressed) VALUES(?,?,?,?)', id, targetId, targetKind, target.suppressed ? 1 : 0)
    }
    db.addAudit('campaign-draft', id, `targets=${targets.length}`)
    return id
  }
  const approveCampaign = (id, { confirm = false } = {}) => {
    if (!confirm) throw new Error('يلزم تأكيد صريح لاعتماد الإرسال')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    db.run('UPDATE campaigns SET state=?,approved_at=?,updated_at=? WHERE id=?', 'approved', new Date().toISOString(), new Date().toISOString(), id); db.addAudit('campaign-approved', id); return id
  }
  const stopCampaign = (id) => {
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    db.run("UPDATE campaigns SET state='stopped',updated_at=? WHERE id=? AND state IN ('draft','approved','queued','sending')", new Date().toISOString(), id)
    db.addAudit('campaign-stopped', id)
    return id
  }
  const listCampaigns = () => db.all(`SELECT c.id,c.name,c.state,c.created_at,c.approved_at,c.scheduled_at,c.updated_at,
    (SELECT COUNT(*) FROM campaign_targets ct WHERE ct.campaign_id=c.id) AS target_count
    FROM campaigns c ORDER BY c.created_at DESC LIMIT 50`)
  const listBroadcastGroups = () => db.all('SELECT id,name,jid,member_count,members_readable,discovered_at FROM broadcast_lists ORDER BY name COLLATE NOCASE').map((row) => ({
    id: row.id,
    name: row.name || 'مجموعة واتساب',
    jid: decryptJidSafe(row.jid),
    memberCount: Number(row.member_count || 0),
    membersReadable: Boolean(row.members_readable),
    discoveredAt: row.discovered_at,
  }))
  const discoverGroups = async () => {
    if (!state.transport) throw new Error('الوكيل غير مشغّل')
    if (state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا حتى أستطيع قراءة القروبات من الجلسة المحلية.')
    if (typeof state.transport.discoverGroups !== 'function') return { groups: listBroadcastGroups(), refreshed: false, reason: 'transport-does-not-support-groups' }
    const groups = await state.transport.discoverGroups()
    const now = new Date().toISOString()
    for (const group of groups || []) {
      if (!group?.jid || !String(group.jid).endsWith('@g.us')) continue
      const id = db.jidKey(group.jid)
      db.run(
        `INSERT INTO broadcast_lists(id,name,jid,member_count,members_readable,discovered_at)
         VALUES(?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name,jid=excluded.jid,member_count=excluded.member_count,members_readable=excluded.members_readable,discovered_at=excluded.discovered_at`,
        id,
        String(group.name || 'مجموعة واتساب').slice(0, 120),
        db.encryptJid(group.jid),
        Number(group.memberCount || 0),
        group.membersReadable ? 1 : 0,
        now,
      )
    }
    db.addAudit('groups-discovered', 'local', `count=${groups?.length || 0}`)
    return { groups: listBroadcastGroups(), refreshed: true }
  }
  const manualTakeover = (jid, minutes = MANUAL_TAKEOVER_MINUTES) => {
    markManualTakeover(db, jid, minutes)
    db.addAudit('manual-takeover', db.jidKey(jid), `minutes=${minutes}`)
    return { jid: db.jidKey(jid), manualUntil: db.get('SELECT manual_until FROM chat_sessions WHERE jid=?', db.jidKey(jid))?.manual_until || null }
  }
  const returnToBot = (jid) => {
    const now = new Date().toISOString()
    db.run("UPDATE chat_sessions SET mode='content-session', manual_until=NULL, updated_at=? WHERE jid=?", now, db.jidKey(jid))
    db.addAudit('bot-return', db.jidKey(jid))
    return { jid: db.jidKey(jid), returned: true }
  }
  const listReplyRules = () => db.all('SELECT * FROM reply_rules ORDER BY enabled DESC, priority DESC, updated_at DESC').map((row) => ({
    id: row.id,
    name: row.name,
    keywords: JSON.parse(row.keywords_json || '[]'),
    priority: Number(row.priority || 0),
    matchType: row.match_type,
    actionType: row.action_type,
    responseText: row.response_text || '',
    contentQuery: row.content_query || '',
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at,
  }))
  const saveReplyRule = (payload = {}) => {
    const now = new Date().toISOString()
    const id = String(payload.id || randomToken(8))
    const previous = db.get('SELECT * FROM reply_rules WHERE id=?', id)
    if (previous) db.run('INSERT INTO reply_rule_versions(rule_id,payload_json,created_at) VALUES(?,?,?)', id, JSON.stringify(previous), now)
    const keywords = Array.isArray(payload.keywords)
      ? payload.keywords.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 25)
      : String(payload.keywords || '').split(/[,،\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 25)
    if (!String(payload.name || '').trim()) throw new Error('اسم القاعدة مطلوب.')
    if (!keywords.length) throw new Error('أضف كلمة مفتاحية واحدة على الأقل.')
    const matchType = ['any', 'all', 'exact'].includes(payload.matchType) ? payload.matchType : 'any'
    const actionType = ['text', 'site-content', 'transfer'].includes(payload.actionType) ? payload.actionType : 'text'
    db.run(
      `INSERT INTO reply_rules(id,name,keywords_json,priority,match_type,action_type,response_text,content_query,enabled,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name,keywords_json=excluded.keywords_json,priority=excluded.priority,match_type=excluded.match_type,action_type=excluded.action_type,response_text=excluded.response_text,content_query=excluded.content_query,enabled=excluded.enabled,updated_at=excluded.updated_at`,
      id,
      String(payload.name).trim(),
      JSON.stringify(keywords),
      Number(payload.priority || 0),
      matchType,
      actionType,
      safeText(payload.responseText || ''),
      safeText(payload.contentQuery || ''),
      payload.enabled === false ? 0 : 1,
      previous?.created_at || now,
      now,
    )
    db.addAudit(previous ? 'reply-rule-updated' : 'reply-rule-created', id)
    return listReplyRules().find((rule) => rule.id === id)
  }
  const deleteReplyRule = (id) => {
    const row = db.get('SELECT * FROM reply_rules WHERE id=?', id)
    if (!row) throw new Error('القاعدة غير موجودة.')
    db.run('INSERT INTO reply_rule_versions(rule_id,payload_json,created_at) VALUES(?,?,?)', id, JSON.stringify(row), new Date().toISOString())
    db.run('DELETE FROM reply_rules WHERE id=?', id)
    db.addAudit('reply-rule-deleted', id)
    return { id, deleted: true }
  }
  const replyRuleVersions = (id) => db.all('SELECT id,rule_id,payload_json,created_at FROM reply_rule_versions WHERE rule_id=? ORDER BY id DESC LIMIT 20', id).map((row) => ({
    id: row.id,
    ruleId: row.rule_id,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  }))
  const rollbackReplyRule = (id, versionId) => {
    const version = db.get('SELECT * FROM reply_rule_versions WHERE rule_id=? AND id=?', id, Number(versionId))
    if (!version) throw new Error('النسخة غير موجودة.')
    const payload = JSON.parse(version.payload_json)
    return saveReplyRule({
      id,
      name: payload.name,
      keywords: JSON.parse(payload.keywords_json || '[]'),
      priority: payload.priority,
      matchType: payload.match_type,
      actionType: payload.action_type,
      responseText: payload.response_text,
      contentQuery: payload.content_query,
      enabled: Boolean(payload.enabled),
    })
  }
  const simulateReply = ({ text, jid = 'simulator@s.whatsapp.net' } = {}) => {
    const response = handleIntent({ db, jid, input: safeText(text), session: null })
    return {
      intent: response.intent,
      confidence: response.confidence,
      needsHuman: Boolean(response.needsHuman),
      ruleId: response.ruleId || null,
      ruleName: response.ruleName || null,
      preview: response.text || '',
    }
  }
  const requestRestart = () => {
    const requestedAt = new Date().toISOString()
    db.setSetting('bridge.restartRequestedAt', requestedAt)
    db.setState({ status: 'restarting', last_error: null })
    db.addAudit('bridge-restart-requested', 'local')
    return { restartRequestedAt: requestedAt }
  }
  const sendCampaign = async (id, { confirm = false, confirmAgain = false } = {}) => {
    if (!confirm || !confirmAgain) throw new Error('إرسال الحملة يحتاج تأكيدين صريحين.')
    if (!flags.send) throw new Error('الإرسال معطّل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED محليًا بعد الاختبار.')
    if (!state.transport || state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا وتأكد أن الحالة متصل.')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    if (campaign.state !== 'approved' && campaign.state !== 'queued') throw new Error('الحملة يجب أن تكون معتمدة قبل الإرسال.')
    const targets = campaignTargets(id)
    if (!targets.length) throw new Error('لا توجد جهات معروفة في الحملة.')
    const now = new Date().toISOString(); let sent = 0; let skipped = 0; let failed = 0
    db.run("UPDATE campaigns SET state='sending',updated_at=? WHERE id=?", now, id)
    for (const target of targets) {
      if (target.suppressed || target.contact_suppressed) { skipped++; continue }
      const jid = resolveCampaignTarget(target)
      if (!jid) { skipped++; db.addAudit('campaign-target-skipped', id, 'unknown-target'); continue }
      const jobId = randomToken(10); const created = new Date().toISOString()
      db.run('INSERT INTO message_jobs(id,campaign_id,jid,body,state,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', jobId, id, db.encryptJid(jid), campaign.message, 'sending', 1, created, created, created)
      try {
        await state.transport.sendText(jid, campaign.message)
        db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'sent', new Date().toISOString(), jobId)
        db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'sent', null, new Date().toISOString()); sent++
      } catch (error) {
        db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'failed', new Date().toISOString(), jobId)
        db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'failed', redactError(error), new Date().toISOString()); failed++; db.addAudit('campaign-send-failed', id, redactError(error))
      }
      const current = db.get("SELECT state FROM campaigns WHERE id=?", id); if (current?.state === 'stopped') break
    }
    const stateName = failed || skipped ? (sent ? 'partial' : 'stopped') : 'completed'
    db.run('UPDATE campaigns SET state=?,updated_at=? WHERE id=?', stateName, new Date().toISOString(), id)
    db.addAudit('campaign-sent', id, `sent=${sent};skipped=${skipped};failed=${failed}`)
    return { id, state: stateName, sent, skipped, failed }
  }
  const runQuietCampaign = async (id, { intervalSeconds }) => {
    const intervalMs = campaignInterval(intervalSeconds) * 1000
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id)
    if (!campaign) throw new Error('الحملة غير موجودة')
    const targets = campaignTargets(id)
    let sent = 0; let skipped = 0; let failed = 0
    db.run("UPDATE campaigns SET state='sending',updated_at=? WHERE id=?", new Date().toISOString(), id)
    try {
      for (const [index, target] of targets.entries()) {
        const current = db.get('SELECT state FROM campaigns WHERE id=?', id)
        if (current?.state === 'stopped') { db.addAudit('quiet-broadcast-stopped', id, `sent=${sent}`); break }
        if (target.suppressed || target.contact_suppressed) { skipped++; continue }
        const jid = resolveCampaignTarget(target)
        if (!jid) { skipped++; db.addAudit('quiet-broadcast-target-skipped', id, 'unknown-target'); continue }
        const jobId = randomToken(10)
        const created = new Date().toISOString()
        /* لكلٍّ نصّه: {الاسم} يصير لقبه الذي كتبتَه، و{تحية} تتبع ساعة الإرسال.
           فلا تخرج رسالةٌ واحدة جامدة، بل رسالةٌ لكل إنسانٍ باسمه. */
        const contact = db.get('SELECT * FROM contacts WHERE id=?', target.target_id)
        const body = personalize(campaign.message, { vocative: contact ? vocativeOf(contact) : '' })
        db.run('INSERT INTO message_jobs(id,campaign_id,jid,body,state,attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)', jobId, id, db.encryptJid(jid), db.encryptText(body), 'sending', 1, created, created, created)
        try {
          await state.transport.sendText(jid, body)
          db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'sent', new Date().toISOString(), jobId)
          db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'sent', null, new Date().toISOString())
          sent++
        } catch (error) {
          db.run('UPDATE message_jobs SET state=?,updated_at=? WHERE id=?', 'failed', new Date().toISOString(), jobId)
          db.run('INSERT INTO message_attempts(job_id,state,error,attempted_at) VALUES(?,?,?,?)', jobId, 'failed', redactError(error), new Date().toISOString())
          failed++
          db.addAudit('quiet-broadcast-send-failed', id, redactError(error))
        }
        if (index < targets.length - 1) await sleep(intervalMs)
      }
      const current = db.get('SELECT state FROM campaigns WHERE id=?', id)
      const stateName = current?.state === 'stopped' ? 'stopped' : (failed || skipped ? (sent ? 'partial' : 'stopped') : 'completed')
      db.run('UPDATE campaigns SET state=?,updated_at=? WHERE id=?', stateName, new Date().toISOString(), id)
      db.addAudit('quiet-broadcast-finished', id, `sent=${sent};skipped=${skipped};failed=${failed};interval=${intervalMs}`)
    } finally {
      state.activeCampaigns.delete(id)
    }
  }
  const sendQuietCampaign = (id, { confirm = false, confirmAgain = false, intervalSeconds = BROADCAST_DEFAULT_INTERVAL_SECONDS } = {}) => {
    if (!confirm || !confirmAgain) throw new Error('الإرسال الهادئ يحتاج تأكيدين صريحين.')
    if (!flags.send) throw new Error('الإرسال معطّل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED محليًا بعد الاختبار.')
    if (!state.transport || state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا وتأكد أن الحالة متصل.')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    if (!['approved', 'queued'].includes(campaign.state)) throw new Error('الحملة يجب أن تكون معتمدة قبل الإرسال.')
    const targets = campaignTargets(id)
    if (!targets.length) throw new Error('لا توجد جهات أو قروبات في الحملة.')
    if (state.activeCampaigns.has(id)) return { id, state: 'sending', alreadyRunning: true }
    state.activeCampaigns.add(id)
    db.run("UPDATE campaigns SET state='queued',updated_at=? WHERE id=?", new Date().toISOString(), id)
    void runQuietCampaign(id, { intervalSeconds }).catch((error) => {
      state.activeCampaigns.delete(id)
      db.run("UPDATE campaigns SET state='stopped',updated_at=? WHERE id=?", new Date().toISOString(), id)
      db.addAudit('quiet-broadcast-crashed', id, redactError(error))
    })
    return { id, state: 'queued', intervalSeconds: campaignInterval(intervalSeconds), targets: targets.length }
  }
  const createLocalReminder = ({ jid, contentId = null, originalText, dueAt }) => createReminder(db, { jid, contentId, originalText, dueAt })
  const status = () => {
    const heartbeatState = db.getSetting('bridge.heartbeat', null)
    const lastHeartbeatAt = heartbeatState?.at || null
    const heartbeatAgeMs = lastHeartbeatAt ? Date.now() - new Date(lastHeartbeatAt).getTime() : null
    const bridgeOnline = Boolean(state.started && lastHeartbeatAt && heartbeatAgeMs != null && heartbeatAgeMs <= HEARTBEAT_STALE_MS)
    return { ...db.state(), flags, indexed: Number(db.get('SELECT COUNT(*) AS count FROM content_items')?.count || 0), bridge: Boolean(state.bridge), bridgeOnline, lastHeartbeatAt, heartbeatAgeMs, restartRequestedAt: db.getSetting('bridge.restartRequestedAt', null), port: BRIDGE_PORT, timeZone: TIME_ZONE }
  }
  const setBridge = (server) => { state.bridge = server; return status() }
  return Object.assign(api, { db, state, index, start, stop, status, sendSelf, audience, onContacts, queueCampaign, approveCampaign, sendCampaign, sendQuietCampaign, stopCampaign, listCampaigns, listBroadcastGroups, discoverGroups, createLocalReminder, onMessage, setBridge, bridgeSecret, manualTakeover, returnToBot, listReplyRules, saveReplyRule, deleteReplyRule, replyRuleVersions, rollbackReplyRule, simulateReply, requestRestart })
}

async function dispatchDueReminders(state) {
  const now = new Date().toISOString(); const rows = state.db.all("SELECT * FROM reminders WHERE state='pending' AND due_at<=? LIMIT 5", now)
  for (const reminder of rows) {
    try {
      if (!flags.send || !state.transport) continue
      const jid = state.db.decryptJid(reminder.jid)
      await state.transport.sendText(jid, `هذا التذكير الذي طلبته للمادة.\n${reminder.original_text}`)
      state.db.run('UPDATE reminders SET state=?,sent_at=? WHERE id=?', 'sent', now, reminder.id)
    } catch (error) { state.db.addAudit('reminder-failed', 'local', redactError(error)) }
  }
}

export function ensureLock(lockPath) {
  try { fs.writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 }); return true } catch { /* القفل موجود — قد يكون يتيماً */ }
  /* قفلٌ يتيم بعد سقوط مفاجئ كان يمنع الوكيل من الإقلاع للأبد، فتبقى لوحة واتساب
     «غير مرتبطة» بلا سبب ظاهر. نتبنّاه إن لم تعد عمليته حيّة. */
  try {
    const owner = Number(String(fs.readFileSync(lockPath, 'utf8')).trim())
    if (Number.isInteger(owner) && owner > 0) {
      try { process.kill(owner, 0); return false } catch { /* لا عملية بهذا المعرّف */ }
    }
    fs.writeFileSync(lockPath, `${process.pid}\n`, { mode: 0o600 })
    return true
  } catch { return false }
}

export function removeLock(lockPath) { try { fs.unlinkSync(lockPath) } catch { /* noop */ } }
