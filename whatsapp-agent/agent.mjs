import fs from 'node:fs'
import path from 'node:path'
import { BRIDGE_PORT, DB_PATH, MAX_CAMPAIGN_TARGETS, MAX_MESSAGE_CHARS, SITE_URL, TIME_ZONE, flags, projectRoot, redactError, redactJid } from './config.mjs'
import { openDatabase } from './db.mjs'
import { syncContentIndex } from './content-index.mjs'
import { handleIncoming, markManualTakeover, setSuppression } from './intent-engine.mjs'
import { MockTransport, createWhatsAppTransport } from './transport.mjs'
import { randomToken } from './crypto.mjs'
import { createReminder } from './reminders.mjs'
import { startLocalBridge } from './bridge.mjs'

function safeText(text) { return String(text || '').slice(0, MAX_MESSAGE_CHARS).trim() }

export function createAgent({ db = openDatabase(), transport, root = projectRoot, mock = false } = {}) {
  const state = { db, transport: transport || null, root, timers: new Set(), started: false, bridge: null }
  const index = () => syncContentIndex(db, root, SITE_URL)
  const onMessage = ({ jid, text, message }) => {
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
    if (!state.transport) state.transport = mock ? new MockTransport() : await createWhatsAppTransport({ db, onMessage })
    const transportEvents = state.transport.events || state.transport
    transportEvents?.on?.('status', (payload) => db.setState(typeof payload === 'string' ? { status: payload } : payload))
    // QR/pairing secrets are emitted only in-process; never persist them in SQLite or expose them through the web bridge.
    transportEvents?.on?.('qr', () => db.setState({ status: 'pairing', qr: null, pairing_code: null }))
    transportEvents?.on?.('pairing-code', () => db.setState({ status: 'pairing', qr: null, pairing_code: null }))
    transportEvents?.on?.('manual-takeover', (jid) => markManualTakeover(db, jid))
    await state.transport.connect({ phoneNumber })
    state.started = true
    if (process.env.WHATSAPP_AGENT_BRIDGE === 'true' && !state.bridge) state.bridge = startLocalBridge(state)
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
      if (jid) {
        const created = now
        db.run('INSERT INTO contacts(id,jid,display_name,phone,suppressed,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at', targetId, db.encryptJid(jid), target?.displayName ? db.encryptText(target.displayName) : null, target?.phone ? db.encryptText(target.phone) : null, target?.suppressed ? 1 : 0, created, created)
      }
      db.run('INSERT OR IGNORE INTO campaign_targets(campaign_id,target_id,kind,suppressed) VALUES(?,?,?,?)', id, targetId, target.kind || (jid ? 'contact' : 'self'), target.suppressed ? 1 : 0)
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
  const listCampaigns = () => db.all('SELECT id,name,state,created_at,approved_at,scheduled_at,updated_at FROM campaigns ORDER BY created_at DESC LIMIT 50')
  const sendCampaign = async (id, { confirm = false, confirmAgain = false } = {}) => {
    if (!confirm || !confirmAgain) throw new Error('إرسال الحملة يحتاج تأكيدين صريحين.')
    if (!flags.send) throw new Error('الإرسال معطّل افتراضيًا. فعّل WHATSAPP_SEND_ENABLED محليًا بعد الاختبار.')
    if (!state.transport || state.transport.getConnectionStatus?.() !== 'connected') throw new Error('اربط واتساب أولًا وتأكد أن الحالة متصل.')
    const campaign = db.get('SELECT * FROM campaigns WHERE id=?', id); if (!campaign) throw new Error('الحملة غير موجودة')
    if (campaign.state !== 'approved' && campaign.state !== 'queued') throw new Error('الحملة يجب أن تكون معتمدة قبل الإرسال.')
    const targets = db.all('SELECT ct.*, c.jid AS encrypted_jid, c.suppressed AS contact_suppressed FROM campaign_targets ct LEFT JOIN contacts c ON c.id=ct.target_id WHERE ct.campaign_id=? ORDER BY ct.target_id', id)
    if (!targets.length) throw new Error('لا توجد جهات معروفة في الحملة.')
    const now = new Date().toISOString(); let sent = 0; let skipped = 0; let failed = 0
    db.run("UPDATE campaigns SET state='sending',updated_at=? WHERE id=?", now, id)
    for (const target of targets) {
      if (target.suppressed || target.contact_suppressed) { skipped++; continue }
      let jid = null
      if (target.kind === 'self' || target.target_id === 'self') jid = 'self@s.whatsapp.net'
      else if (target.encrypted_jid) jid = db.decryptJid(target.encrypted_jid)
      else { skipped++; db.addAudit('campaign-target-skipped', id, 'unknown-target'); continue }
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
  const createLocalReminder = ({ jid, contentId = null, originalText, dueAt }) => createReminder(db, { jid, contentId, originalText, dueAt })
  const status = () => ({ ...db.state(), flags, indexed: Number(db.get('SELECT COUNT(*) AS count FROM content_items')?.count || 0), bridge: Boolean(state.bridge), port: BRIDGE_PORT, timeZone: TIME_ZONE })
  const setBridge = (server) => { state.bridge = server; return status() }
  return { db, state, index, start, stop, status, sendSelf, queueCampaign, approveCampaign, sendCampaign, stopCampaign, listCampaigns, createLocalReminder, onMessage, setBridge }
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
  try { fs.writeFileSync(lockPath, `${process.pid}\n`, { flag: 'wx', mode: 0o600 }); return true } catch { return false }
}

export function removeLock(lockPath) { try { fs.unlinkSync(lockPath) } catch { /* noop */ } }
