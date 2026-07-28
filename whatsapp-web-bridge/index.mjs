import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import process from 'node:process'
import qrcode from 'qrcode'
import whatsappWeb from 'whatsapp-web.js'

const { Client, LocalAuth } = whatsappWeb

const deviceId = String(process.env.WHATSAPP_BRIDGE_DEVICE_ID || process.env.WHATSAPP_CLIENT_ID || 'primary')
  .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'primary'

const config = Object.freeze({
  serverUrl: String(process.env.WHATSAPP_MAIN_SERVER_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, ''),
  secret: String(process.env.WHATSAPP_BRIDGE_SECRET || ''),
  sessionDir: resolve(String(process.env.WHATSAPP_SESSION_DIR || './session')),
  deviceId,
  clientId: deviceId,
  ownerChatId: String(process.env.WHATSAPP_OWNER_CHAT_ID || '').trim(),
  deviceName: String(process.env.WHATSAPP_BRIDGE_DEVICE_NAME || 'dr-alfailakawi-mac-bridge').slice(0, 100),
  healthPort: Math.max(1024, Math.min(65535, Number(process.env.WHATSAPP_BRIDGE_HEALTH_PORT || 34322))),
  heartbeatMs: Math.max(10_000, Number(process.env.WHATSAPP_HEARTBEAT_MS || 25_000)),
  pollMs: Math.max(2_000, Number(process.env.WHATSAPP_COMMAND_POLL_MS || 5_000)),
  chromePath: String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim(),
})

if (!config.serverUrl || !/^https?:\/\//.test(config.serverUrl)) {
  throw new Error('WHATSAPP_MAIN_SERVER_URL is required and must start with http:// or https://')
}
if (config.secret.length < 24) {
  throw new Error('WHATSAPP_BRIDGE_SECRET must contain at least 24 characters')
}

mkdirSync(config.sessionDir, { recursive: true, mode: 0o700 })
const deliveredCommandsPath = join(config.sessionDir, 'delivered-command-ids.json')
const deliveredCommandIds = new Set((() => {
  try {
    const value = JSON.parse(readFileSync(deliveredCommandsPath, 'utf8'))
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(-500) : []
  } catch {
    return []
  }
})())

function rememberDeliveredCommand(id) {
  deliveredCommandIds.add(String(id))
  const recent = [...deliveredCommandIds].slice(-500)
  deliveredCommandIds.clear()
  recent.forEach((value) => deliveredCommandIds.add(value))
  const temp = `${deliveredCommandsPath}.tmp-${process.pid}`
  writeFileSync(temp, `${JSON.stringify(recent)}\n`, { mode: 0o600 })
  renameSync(temp, deliveredCommandsPath)
}

const runtime = {
  status: 'starting',
  connected: false,
  lastError: '',
  lastWebhookAt: null,
  startedAt: new Date().toISOString(),
  qrAt: null,
  instanceId: randomUUID(),
  stateSeq: 0,
  stateAt: new Date().toISOString(),
  syncPercent: 0,
  lastActivityAt: Date.now(),
}

function stateSnapshot(extra = {}) {
  return {
    status: runtime.status,
    connected: runtime.connected,
    error: runtime.lastError,
    instanceId: runtime.instanceId,
    deviceId: config.deviceId,
    stateSeq: runtime.stateSeq,
    stateAt: runtime.stateAt,
    syncPercent: runtime.syncPercent,
    ...extra,
  }
}

function transitionState(status, connected, error = '', extra = {}) {
  runtime.status = String(status || 'disconnected')
  runtime.connected = Boolean(connected)
  runtime.lastError = String(error || '').slice(0, 400)
  runtime.stateSeq += 1
  runtime.stateAt = new Date().toISOString()
  runtime.lastActivityAt = Date.now()
  return stateSnapshot(extra)
}

function log(level, message, fields = {}) {
  const safe = { ...fields }
  for (const key of ['jid', 'from', 'to', 'conversationId']) {
    if (safe[key]) safe[key] = maskAddress(safe[key])
  }
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), level, event: message, deviceId: config.deviceId, ...safe })}\n`)
}

function maskAddress(value) {
  const digits = String(value || '').split('@', 1)[0].replace(/\D/g, '')
  return digits.length > 4 ? `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}` : '****'
}

let shuttingDown = false
let commandBusy = false
let heartbeatTimer = null
let pollTimer = null
let reinjectionPromise = null
const recentAutomatedSends = new Map()
const recentAutomatedBodies = new Map()

function automatedSendKey(jid, text) {
  return `${String(jid || '').trim()}\n${String(text || '').replace(/\s+/g, ' ').trim()}`
}

function rememberAutomatedSend(jid, text) {
  const key = automatedSendKey(jid, text)
  const expiresAt = Date.now() + 45_000
  const bodyKey = String(text || '').replace(/\s+/g, ' ').trim()
  recentAutomatedSends.set(key, expiresAt)
  recentAutomatedBodies.set(bodyKey, expiresAt)
  for (const [candidate, expiresAt] of recentAutomatedSends) {
    if (expiresAt <= Date.now()) recentAutomatedSends.delete(candidate)
  }
  for (const [candidate, bodyExpiresAt] of recentAutomatedBodies) {
    if (bodyExpiresAt <= Date.now()) recentAutomatedBodies.delete(candidate)
  }
  return key
}

function consumeAutomatedSend(jid, text) {
  const key = automatedSendKey(jid, text)
  const expiresAt = recentAutomatedSends.get(key) || 0
  const bodyKey = String(text || '').replace(/\s+/g, ' ').trim()
  const bodyExpiresAt = recentAutomatedBodies.get(bodyKey) || 0
  recentAutomatedSends.delete(key)
  return expiresAt > Date.now() || bodyExpiresAt > Date.now()
}

async function serverRequest(path, { method = 'POST', body, timeoutMs = 15_000, retries = 2 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${config.serverUrl}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-WhatsApp-Bridge-Secret': config.secret,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      if (!response.ok) {
        // Keep the HTTP status and the server's short diagnostic. The bridge
        // logs mask phone addresses, and this detail is what lets the control
        // panel distinguish an invalid modern JID from a paused bot or outage.
        let detail = ''
        try {
          const payload = await response.json()
          detail = String(payload?.error || '').replace(/\s+/g, ' ').slice(0, 240)
        } catch { /* response may not be JSON */ }
        throw new Error(`server-${response.status}${detail ? `:${detail}` : ''}`)
      }
      runtime.lastWebhookAt = new Date().toISOString()
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < retries) await new Promise((resolveWait) => setTimeout(resolveWait, 600 * 2 ** attempt))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

async function emit(event, payload = {}, options = {}) {
  return serverRequest('/api/whatsapp/webhook', { body: { event, deviceName: config.deviceName, deviceId: config.deviceId, version: '1.0.0', ...payload }, ...options })
}

async function safeEmit(event, payload = {}, options = {}) {
  try {
    return await emit(event, payload, options)
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'webhook_failed', { event, error: runtime.lastError })
    return null
  }
}

// Optimization for WhatsApp Web Multi-Device sync:
// 1. DO NOT use --disable-background-networking (it blocks background message syncing and IndexedDB updates!)
// 2. Disable background timer & tab throttling so Chrome doesn't pause sync when headless
// 3. Set realistic macOS User-Agent so WhatsApp MD doesn't flag or pause the headless client
const puppeteer = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',
    '--no-zygote',
    '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    '--disable-features=CalculatePageVisibility',
    '--disable-features=IntensiveWakeUpThrottling',
    '--disable-features=TurnOffStreamingMediaWithBackgroundTab',
    '--disable-features=LogLeastRecentlyUsedLimit',
    '--disable-features=Prerender2',
  ],
  ...(config.chromePath ? { executablePath: config.chromePath } : {}),
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: config.deviceId, dataPath: config.sessionDir }),
  puppeteer,
  deviceName: config.deviceName,
  browserName: 'Dr Ahmad Assistant',
  takeoverOnConflict: true,
  authTimeoutMs: 0, // 0 disables auth timeout during long initial message syncs
  qrMaxRetries: 0,
})

// Event: loading_screen (WhatsApp Web loading chats and sync)
client.on('loading_screen', async (percent, message) => {
  runtime.syncPercent = percent
  runtime.lastActivityAt = Date.now()
  const snapshot = transitionState('syncing', false, '', { percent, message })
  log('info', 'loading_screen', { percent, message, stateSeq: snapshot.stateSeq })
  await safeEmit('status', snapshot)
})

// Event: qr
client.on('qr', async (qr) => {
  const snapshot = transitionState('pairing', false, '')
  runtime.qrAt = snapshot.stateAt
  try {
    const qrImage = await qrcode.toDataURL(qr, { margin: 1, width: 520, errorCorrectionLevel: 'M' })
    await safeEmit('qr', { ...snapshot, qr, qrImage })
  } catch {
    await safeEmit('qr', { ...snapshot, qr, qrImage: null })
  }
  log('info', 'qr_generated', { stateSeq: snapshot.stateSeq })
})

// Event: authenticated
client.on('authenticated', () => {
  const snapshot = transitionState('authenticated', false, '')
  log('info', 'authenticated', { stateSeq: snapshot.stateSeq })
  void safeEmit('status', snapshot)
  
  // Immediately start heartbeat & polling so server knows auth succeeded!
  startHeartbeatAndPolling()
})

// Event: ready
client.on('ready', () => {
  const snapshot = transitionState('connected', true, '')
  log('info', 'ready', { stateSeq: snapshot.stateSeq })
  void safeEmit('status', snapshot)
  
  startHeartbeatAndPolling()

  // Run warmPhoneAliases and contact sync in the BACKGROUND with a non-blocking timeout
  void warmPhoneAliasesAndContactsInBackground()
})

function isIndividualJid(value) {
  return /@(?:c\.us|lid)$/.test(String(value || ''))
}

async function bridgeFunctionsReady() {
  if (!client.pupPage || client.pupPage.isClosed()) return false
  try {
    return await client.pupPage.evaluate(() => Boolean(
      window.WWebJS
      && typeof window.WWebJS.getChat === 'function'
      && typeof window.WWebJS.sendMessage === 'function',
    ))
  } catch {
    return false
  }
}

/*
 * WhatsApp Web may reload its main frame after the QR has already reached
 * "ready". During that narrow window whatsapp-web.js keeps the session green
 * but loses window.WWebJS, so every send fails at getChat and inbound events
 * stop. Re-inject once, serialize concurrent repairs, then prove the helpers
 * are present before allowing a delivery.
 */
async function ensureBridgeFunctions() {
  if (await bridgeFunctionsReady()) return
  if (!reinjectionPromise) {
    reinjectionPromise = (async () => {
      log('warn', 'webjs_helpers_missing_reinjecting')
      await client.inject()
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        if (await bridgeFunctionsReady()) return
        await new Promise((resolveWait) => setTimeout(resolveWait, 400))
      }
      throw new Error('webjs-reinjection-timeout')
    })().finally(() => { reinjectionPromise = null })
  }
  await reinjectionPromise
}

async function resolveSendJid(rawJid) {
  const jid = String(rawJid || '').trim()
  if (!isIndividualJid(jid)) throw new Error('invalid-individual-jid')
  // Do not translate a known @c.us chat through getNumberId(). Current
  // WhatsApp Web may return its private @lid alias; sending to that alias can
  // resolve locally without reaching the phone. Incoming @lid chats already
  // carry the correct live address and are kept as-is.
  return jid
}

async function sendTextWithRecovery(rawJid, rawText) {
  const text = String(rawText || '').trim()
  if (!text) throw new Error('empty-message')
  const jid = await resolveSendJid(rawJid)
  rememberAutomatedSend(jid, text)
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await ensureBridgeFunctions()
      // New WhatsApp Web builds can complete the underlying send but fail to
      // serialize the resulting message model back to whatsapp-web.js. Waiting
      // for the page send action is authoritative; an empty wrapper result is
      // then a compatibility notice, not a false delivery failure.
      const sent = await client.sendMessage(jid, text, {
        sendSeen: false,
        waitUntilMsgSent: true,
      })
      if (!sent) log('warn', 'send_completed_without_serialized_message', { jid })
      return sent
    } catch (error) {
      lastError = error
      const message = String(error?.message || error)
      if (attempt > 0 || !/getChat|Execution context|detached|WWebJS|evaluate|reinjection/i.test(message)) break
      log('warn', 'send_recovering_webjs_helpers', { jid, error: message })
      try { await client.inject() } catch { /* the serialized preflight retries below */ }
      await new Promise((resolveWait) => setTimeout(resolveWait, 900))
    }
  }
  throw lastError || new Error('whatsapp-send-failed')
}

function selfChatJid() {
  const configured = String(config.ownerChatId || '').trim()
  if (configured) return configured
  return String(client.info?.wid?._serialized || '').trim()
}

async function warmPhoneAliasesAndContactsInBackground() {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('warmup-timeout')), 15_000))
    const task = (async () => {
      let contacts = []
      try {
        contacts = await client.getContacts()
      } catch (e) {
        log('warn', 'get_contacts_failed', { error: String(e?.message || e) })
      }
      const compact = contacts.flatMap((contact) => {
        const jid = String(contact?.id?._serialized || '')
        if (!jid.endsWith('@c.us') || !/^\d{7,15}@c\.us$/.test(jid)) return []
        return [{
          jid,
          name: String(contact.name || contact.pushname || contact.shortName || '').slice(0, 120),
        }]
      })
      if (compact.length > 0) {
        let accepted = 0
        for (let offset = 0; offset < compact.length; offset += 350) {
          const response = await safeEmit('contacts-sync', { contacts: compact.slice(offset, offset + 350) })
          accepted += Number(response?.accepted || 0)
        }
        log('info', 'contacts_synced', { accepted })
      }
    })()
    await Promise.race([task, timeout])
  } catch (err) {
    log('warn', 'warmup_background_completed_with_notice', { notice: String(err?.message || err) })
  }
}

// Event: change_state
client.on('change_state', (state) => {
  const value = String(state || '').toUpperCase()
  log('info', 'change_state', { state: value })
  
  if (value === 'CONNECTED' && (!runtime.connected || runtime.status !== 'connected')) {
    const snapshot = transitionState('connected', true, '')
    void safeEmit('status', snapshot)
    return
  }
  if (runtime.connected && ['CONFLICT', 'UNPAIRED_IDLE', 'TIMEOUT'].includes(value)) {
    const snapshot = transitionState('reconnecting', false, value.toLowerCase())
    void safeEmit('status', snapshot)
  }
})

// Event: auth_failure
client.on('auth_failure', async (message) => {
  const snapshot = transitionState('auth_failure', false, String(message || 'authentication_failed'))
  log('error', 'auth_failure', { error: runtime.lastError, stateSeq: snapshot.stateSeq })
  await safeEmit('status', snapshot)
  
  if (!shuttingDown) {
    shuttingDown = true
    await safeGracefulCloseClient()
    process.exit(76)
  }
})

// Event: disconnected
client.on('disconnected', async (reason) => {
  const reasonStr = String(reason || 'disconnected').toUpperCase()
  log('warn', 'disconnected', { reason: reasonStr, stateSeq: runtime.stateSeq })
  
  const isExplicitLogout = ['LOGOUT', 'UNPAIRED', 'LOGGED_OUT'].includes(reasonStr)
  
  if (isExplicitLogout) {
    const snapshot = transitionState('disconnected', false, `explicit_logout:${reasonStr}`)
    await safeEmit('status', snapshot)
    if (!shuttingDown) {
      shuttingDown = true
      await safeGracefulCloseClient()
      process.exit(76) // Exit code 76 = clear session and re-pair
    }
  } else {
    const snapshot = transitionState('reconnecting', false, `temporary_disconnect:${reasonStr}`)
    await safeEmit('status', snapshot)
    if (!shuttingDown) {
      shuttingDown = true
      await safeGracefulCloseClient()
      process.exit(75) // Exit code 75 = soft restart without removing session
    }
  }
})

async function safeGracefulCloseClient() {
  try {
    await client.destroy()
  } catch {
    /* ignore close errors */
  }
  await new Promise((r) => setTimeout(r, 1000))
}

// Inbound message handling
client.on('message', async (message) => {
  runtime.lastActivityAt = Date.now()
  if (message.fromMe || message.from === 'status@broadcast' || !isIndividualJid(message.from)) return
  try {
    const result = await emit('incoming', {
      jid: message.from,
      text: String(message.body || '').slice(0, 12_000),
      hasMedia: Boolean(message.hasMedia),
      mediaType: String(message.type || 'text').slice(0, 80),
      messageId: String(message.id?._serialized || '').slice(0, 240),
      timestamp: Number(message.timestamp || 0),
    })
    if (result?.reply?.text && ['reply', 'reply-and-escalate'].includes(result.action)) {
      await sendTextWithRecovery(message.from, result.reply.text)
      log('info', 'incoming_reply_sent', { from: message.from, action: result.action, reason: result.reason || '' })
    } else {
      log('info', 'incoming_processed_without_reply', { from: message.from, action: result?.action || 'none', reason: result?.reason || '' })
    }
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'incoming_message_failed', { from: message.from, error: runtime.lastError })
  }
})

/* أي رسالة يكتبها الدكتور بيده تغلق جلسة البوت في تلك المحادثة. رسائل
   البوت والحملات تمر من sendTextWithRecovery فتُعلَّم محلياً قبل أن يطلق
   WhatsApp حدث message_create، فلا تُحسب تدخلاً يدوياً ولا تعيد فتح إرسال. */
client.on('message_create', async (message) => {
  if (!message.fromMe) return
  const jid = String(message.to || '').trim()
  const text = String(message.body || '')
  if (!isIndividualJid(jid) || consumeAutomatedSend(jid, text)) return
  try {
    await emit('manual', {
      jid,
      messageId: String(message.id?._serialized || '').slice(0, 240),
      timestamp: Number(message.timestamp || 0),
    })
    log('info', 'manual_message_closed_bot_session', { jid })
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'manual_takeover_signal_failed', { jid, error: runtime.lastError })
  }
})

function startHeartbeatAndPolling() {
  if (heartbeatTimer) return
  heartbeatTimer = setInterval(() => {
    void (async () => {
      await safeEmit('heartbeat', stateSnapshot(), { retries: 0 })
    })()
  }, config.heartbeatMs)
  heartbeatTimer.unref()

  if (!pollTimer) {
    pollTimer = setInterval(() => void pollCommands(), config.pollMs)
    pollTimer.unref()
  }
}

async function pollCommands() {
  if (commandBusy || shuttingDown) return
  commandBusy = true
  try {
    const response = await serverRequest('/api/whatsapp/commands', { method: 'GET', retries: 1 })
    if (response?.command) await executeCommand(response.command)
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
  } finally {
    commandBusy = false
  }
}

async function executeCommand(command) {
  if (!command?.id || !command.type) return
  try {
    if (deliveredCommandIds.has(String(command.id)) && ['send-message', 'send-self-message'].includes(command.type)) {
      await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: true }, retries: 2 })
      log('info', 'duplicate_command_acknowledged_without_resend', { commandId: command.id, commandType: command.type })
      return
    }
    if (command.type === 'restart') {
      shuttingDown = true
      await safeEmit('status', transitionState('restarting', false, 'command_restart'))
      await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: true }, retries: 1 })
      await safeGracefulCloseClient()
      process.exit(75) // Exit code 75 = soft restart
    } else if (command.type === 'repair-session' || command.type === 'repair') {
      shuttingDown = true
      await safeEmit('status', transitionState('pairing', false, 'command_repair'))
      await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: true }, retries: 1 })
      try { await client.logout() } catch { /* ignore if disconnected */ }
      await safeGracefulCloseClient()
      process.exit(76) // Exit code 76 = re-pair
    } else if (command.type === 'send-message') {
      const jid = command.payload?.jid
      const text = String(command.payload?.text || '').trim()
      if (!jid || !text) throw new Error('invalid-send-message-command')
      await sendTextWithRecovery(jid, text)
      rememberDeliveredCommand(command.id)
      await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: true }, retries: 1 })
      log('info', 'command_message_sent', { jid, commandId: command.id })
    } else if (command.type === 'send-self-message') {
      const jid = selfChatJid()
      const text = String(command.payload?.text || '').trim()
      if (!jid) throw new Error('self-chat-unavailable')
      if (!text) throw new Error('invalid-self-message-command')
      await sendTextWithRecovery(jid, text)
      rememberDeliveredCommand(command.id)
      await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: true }, retries: 1 })
      log('info', 'command_self_message_sent', { jid, commandId: command.id })
    } else {
      throw new Error(`unsupported-command:${String(command.type).slice(0, 80)}`)
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught)
    await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: false, error }, retries: 1 })
    log('error', 'command_failed', { commandId: command.id, commandType: command.type, error })
  }
}

const healthServer = createServer((req, res) => {
  if (req.url !== '/healthz' && req.url !== '/health') {
    res.writeHead(404).end()
    return
  }
  const body = Buffer.from(JSON.stringify({
    status: runtime.status,
    connected: runtime.connected,
    deviceId: config.deviceId,
    startedAt: runtime.startedAt,
    lastWebhookAt: runtime.lastWebhookAt,
    syncPercent: runtime.syncPercent,
  }))
  res.writeHead(runtime.status === 'auth_failure' ? 503 : 200, {
    'content-type': 'application/json',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  res.end(body)
})

healthServer.listen(config.healthPort, '127.0.0.1')

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  log('info', 'shutdown_initiated', { signal })
  await safeEmit('status', transitionState('disconnected', false, `signal:${signal}`), { retries: 0 })
  await safeGracefulCloseClient()
  healthServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3_000).unref()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', (error) => {
  log('error', 'uncaught_exception', { error: error?.stack || error?.message || String(error) })
  process.exit(70)
})
process.on('unhandledRejection', (error) => {
  log('error', 'unhandled_rejection', { error: error?.stack || error?.message || String(error) })
  process.exit(71)
})

log('info', 'bridge_starting', { deviceId: config.deviceId, sessionDir: config.sessionDir, instanceId: runtime.instanceId })
await safeEmit('status', transitionState('starting', false, ''), { retries: 0 })
await client.initialize()
