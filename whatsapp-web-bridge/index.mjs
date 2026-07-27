import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import process from 'node:process'
import qrcode from 'qrcode'
import whatsappWeb from 'whatsapp-web.js'

const { Client, LocalAuth } = whatsappWeb

const deviceId = String(process.env.WHATSAPP_BRIDGE_DEVICE_ID || process.env.WHATSAPP_CLIENT_ID || 'primary')
  .replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'primary'

const config = Object.freeze({
  serverUrl: String(process.env.WHATSAPP_MAIN_SERVER_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, ''),
  secret: String(process.env.WHATSAPP_BRIDGE_SECRET || 'REDACTED'),
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
      if (!response.ok) throw new Error(`server-${response.status}`)
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
  if (message.fromMe || message.from === 'status@broadcast' || !message.from?.endsWith('@c.us')) return
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
      await client.sendMessage(message.from, String(result.reply.text))
    }
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'incoming_message_failed', { from: message.from, error: runtime.lastError })
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
  let ok = true
  let error = ''
  try {
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
      if (jid && text) await client.sendMessage(jid, text)
    }
  } catch (caught) {
    ok = false
    error = caught instanceof Error ? caught.message : String(caught)
    await serverRequest('/api/whatsapp/commands', { body: { commandId: command.id, ok: false, error }, retries: 1 })
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
