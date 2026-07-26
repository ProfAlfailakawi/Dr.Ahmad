import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import qrcode from 'qrcode'
import whatsappWeb from 'whatsapp-web.js'

const { Client, LocalAuth } = whatsappWeb

const config = Object.freeze({
  serverUrl: String(process.env.WHATSAPP_MAIN_SERVER_URL || '').replace(/\/+$/, ''),
  secret: String(process.env.WHATSAPP_BRIDGE_SECRET || ''),
  sessionDir: resolve(String(process.env.WHATSAPP_SESSION_DIR || '/var/lib/whatsapp-bridge/session')),
  clientId: String(process.env.WHATSAPP_CLIENT_ID || 'primary').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'primary',
  ownerChatId: String(process.env.WHATSAPP_OWNER_CHAT_ID || '').trim(),
  deviceName: String(process.env.WHATSAPP_BRIDGE_DEVICE_NAME || 'dr-alfailakawi-bridge').slice(0, 100),
  healthPort: Math.max(1024, Math.min(65535, Number(process.env.WHATSAPP_BRIDGE_HEALTH_PORT || 34322))),
  heartbeatMs: Math.max(15_000, Number(process.env.WHATSAPP_HEARTBEAT_MS || 30_000)),
  pollMs: Math.max(2_000, Number(process.env.WHATSAPP_COMMAND_POLL_MS || 5_000)),
  chromePath: String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim(),
})

if (!config.serverUrl || !/^https?:\/\//.test(config.serverUrl)) throw new Error('WHATSAPP_MAIN_SERVER_URL is required')
if (config.secret.length < 24) throw new Error('WHATSAPP_BRIDGE_SECRET must contain at least 24 characters')
mkdirSync(config.sessionDir, { recursive: true, mode: 0o700 })

const runtime = {
  status: 'starting',
  connected: false,
  lastError: '',
  lastWebhookAt: null,
  startedAt: new Date().toISOString(),
  qrAt: null,
}

const botFingerprints = new Map()
const botMessageIds = new Map()
let shuttingDown = false
let commandBusy = false

function log(level, message, fields = {}) {
  const safe = { ...fields }
  for (const key of ['jid', 'from', 'to', 'conversationId']) {
    if (safe[key]) safe[key] = maskAddress(safe[key])
  }
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), level, message, ...safe })}\n`)
}

function maskAddress(value) {
  const digits = String(value || '').split('@', 1)[0].replace(/\D/g, '')
  return digits.length > 4 ? `${'*'.repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}` : '****'
}

function normalizeChatId(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/@(?:c|s)\.us$/.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  return digits ? `${digits}@c.us` : ''
}

function fingerprint(jid, text) {
  return createHash('sha256').update(`${jid}\n${String(text || '').trim()}`).digest('hex')
}

function pruneEchoGuards() {
  const now = Date.now()
  for (const [key, expires] of botFingerprints) if (expires <= now) botFingerprints.delete(key)
  for (const [key, expires] of botMessageIds) if (expires <= now) botMessageIds.delete(key)
}

function rememberBotSend(jid, text, id = '') {
  pruneEchoGuards()
  botFingerprints.set(fingerprint(jid, text), Date.now() + 45_000)
  if (id) botMessageIds.set(id, Date.now() + 5 * 60_000)
}

function isBotEcho(message) {
  pruneEchoGuards()
  const id = String(message?.id?._serialized || '')
  if (id && botMessageIds.has(id)) {
    botMessageIds.delete(id)
    return true
  }
  const key = fingerprint(message.to || message.from, message.body || '')
  if (botFingerprints.has(key)) {
    botFingerprints.delete(key)
    return true
  }
  return false
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
  return serverRequest('/api/whatsapp/webhook', { body: { event, deviceName: config.deviceName, version: '1.0.0', ...payload }, ...options })
}

async function safeEmit(event, payload = {}, options = {}) {
  try {
    return await emit(event, payload, options)
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'main-server-webhook-failed', { event, error: runtime.lastError })
    return null
  }
}

const puppeteer = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-features=Translate,BackForwardCache,MediaRouter',
  ],
  ...(config.chromePath ? { executablePath: config.chromePath } : {}),
}

const client = new Client({
  authStrategy: new LocalAuth({ clientId: config.clientId, dataPath: config.sessionDir }),
  puppeteer,
  deviceName: config.deviceName,
  browserName: 'Dr Ahmad Assistant',
  takeoverOnConflict: false,
  authTimeoutMs: 120_000,
  qrMaxRetries: 0,
})

client.on('qr', async (qr) => {
  runtime.status = 'pairing'
  runtime.connected = false
  runtime.qrAt = new Date().toISOString()
  const qrImage = await qrcode.toDataURL(qr, { margin: 1, width: 520, errorCorrectionLevel: 'M' })
  await safeEmit('qr', { qr, qrImage, status: 'pairing' })
  log('info', 'qr-ready')
})

client.on('authenticated', () => {
  runtime.status = 'authenticated'
  runtime.lastError = ''
  void safeEmit('status', { status: 'authenticated' })
  log('info', 'authenticated')
})

client.on('ready', () => {
  runtime.status = 'connected'
  runtime.connected = true
  runtime.lastError = ''
  void safeEmit('status', { status: 'connected' })
  void syncContactsToServer()
  log('info', 'connected')
})

client.on('auth_failure', (message) => {
  runtime.status = 'error'
  runtime.connected = false
  runtime.lastError = String(message || 'authentication-failed').slice(0, 400)
  void safeEmit('status', { status: 'error', error: runtime.lastError })
  log('error', 'authentication-failed', { error: runtime.lastError })
})

client.on('disconnected', (reason) => {
  runtime.status = 'disconnected'
  runtime.connected = false
  runtime.lastError = String(reason || 'disconnected').slice(0, 400)
  void safeEmit('status', { status: 'disconnected', error: runtime.lastError })
  log('warn', 'disconnected', { error: runtime.lastError })
  if (!shuttingDown) setTimeout(() => process.exit(72), 1_500)
})

async function sendBotText(jid, text) {
  rememberBotSend(jid, text)
  try {
    const sent = await client.sendMessage(jid, text)
    rememberBotSend(jid, text, sent?.id?._serialized || '')
    return sent
  } catch (error) {
    await safeEmit('delivery-failed', { jid, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

async function syncContactsToServer() {
  try {
    const contacts = await client.getContacts()
    const compact = contacts.flatMap((contact) => {
      const jid = String(contact?.id?._serialized || '')
      if (!jid.endsWith('@c.us') || !/^\d{7,15}@c\.us$/.test(jid)) return []
      return [{
        jid,
        name: String(contact.name || contact.pushname || contact.shortName || '').slice(0, 120),
      }]
    })
    let accepted = 0
    for (let offset = 0; offset < compact.length; offset += 350) {
      const response = await safeEmit('contacts-sync', { contacts: compact.slice(offset, offset + 350) })
      accepted += Number(response?.accepted || 0)
    }
    log('info', 'contacts-synced', { accepted })
  } catch (error) {
    log('warn', 'contacts-sync-failed', { error: error instanceof Error ? error.message : String(error) })
  }
}

client.on('message', async (message) => {
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
      await sendBotText(message.from, String(result.reply.text))
    }
    const owner = normalizeChatId(config.ownerChatId)
    if (owner && result?.notifyOwner?.text) {
      await sendBotText(owner, String(result.notifyOwner.text))
    }
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error)
    log('error', 'incoming-message-failed', { from: message.from, error: runtime.lastError })
  }
})

client.on('message_create', async (message) => {
  if (!message.fromMe || isBotEcho(message)) return
  const jid = String(message.to || message.from || '')
  if (!jid.endsWith('@c.us')) return
  await safeEmit('manual', {
    jid,
    messageId: String(message.id?._serialized || '').slice(0, 240),
    timestamp: Number(message.timestamp || 0),
  })
  log('info', 'manual-takeover-detected', { jid })
})

async function executeCommand(command) {
  if (!command?.id || !command.type) return
  let ok = true
  let error = ''
  try {
    if (command.type === 'restart') {
      // لا يوجد فعل آخر؛ الإقرار أولاً ثم ينهض service-runner بنسخة نظيفة.
    } else if (command.type === 'repair-session') {
      shuttingDown = true
      try { await client.logout() } catch { /* قد تكون الجلسة مفصولة أصلاً */ }
      try { await client.destroy() } catch { /* الإزالة التالية حاسمة */ }
      const sessionTarget = resolve(config.sessionDir, `session-${config.clientId}`)
      if (!sessionTarget.startsWith(`${config.sessionDir}/`)) throw new Error('unsafe-session-target')
      rmSync(sessionTarget, { recursive: true, force: true })
    } else if (command.type === 'send-message') {
      const jid = normalizeChatId(command.payload?.jid)
      const text = String(command.payload?.text || '').trim()
      if (!jid || !text) throw new Error('invalid-send-message-command')
      await sendBotText(jid, text)
    } else if (command.type === 'send-self-message') {
      const jid = normalizeChatId(client.info?.wid?._serialized)
      const text = String(command.payload?.text || '').trim()
      if (!jid || !text) throw new Error('self-chat-unavailable')
      await sendBotText(jid, text)
    } else {
      throw new Error(`unsupported-command:${command.type}`)
    }
  } catch (caught) {
    ok = false
    error = caught instanceof Error ? caught.message : String(caught)
  }

  await serverRequest('/api/whatsapp/commands', {
    body: { commandId: command.id, ok, error },
    retries: 1,
  })
  if (ok && ['restart', 'repair-session'].includes(command.type)) {
    shuttingDown = true
    setTimeout(() => process.exit(command.type === 'repair-session' ? 76 : 75), 500)
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

setInterval(() => {
  void safeEmit('heartbeat', {
    status: runtime.status,
    error: runtime.lastError,
    connected: runtime.connected,
  }, { retries: 0 })
}, config.heartbeatMs).unref()

setInterval(() => void pollCommands(), config.pollMs).unref()

const healthServer = createServer((req, res) => {
  if (req.url !== '/healthz') {
    res.writeHead(404).end()
    return
  }
  const body = Buffer.from(JSON.stringify({
    status: runtime.status,
    connected: runtime.connected,
    startedAt: runtime.startedAt,
    lastWebhookAt: runtime.lastWebhookAt,
  }))
  res.writeHead(runtime.status === 'error' ? 503 : 200, {
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
  log('info', 'shutdown', { signal })
  await safeEmit('status', { status: 'disconnected', error: `service-${signal}` }, { retries: 0 })
  try { await client.destroy() } catch { /* systemd سيُنهي المجموعة */ }
  healthServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5_000).unref()
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('uncaughtException', (error) => {
  log('error', 'uncaught-exception', { error: error?.stack || error?.message || String(error) })
  process.exit(70)
})
process.on('unhandledRejection', (error) => {
  log('error', 'unhandled-rejection', { error: error?.stack || error?.message || String(error) })
  process.exit(71)
})

log('info', 'bridge-starting', { sessionDir: config.sessionDir, deviceName: config.deviceName })
await safeEmit('status', { status: 'starting' }, { retries: 0 })
await client.initialize()
