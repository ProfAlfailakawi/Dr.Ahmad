import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = path.resolve(here, '..')

const bool = (value, fallback) => {
  if (value == null || value === '') return fallback
  return /^(1|true|yes|on)$/i.test(String(value))
}

export const flags = Object.freeze({
  agent: bool(process.env.WHATSAPP_AGENT_ENABLED, true),
  send: bool(process.env.WHATSAPP_SEND_ENABLED, false),
  autoReply: bool(process.env.WHATSAPP_AUTO_REPLY_ENABLED, false),
  privateAutoReply: bool(process.env.WHATSAPP_PRIVATE_AUTO_REPLY_ENABLED, false),
  voice: bool(process.env.WHATSAPP_VOICE_ENABLED, false),
  reminders: bool(process.env.WHATSAPP_REMINDERS_ENABLED, false),
  quoteCard: bool(process.env.WHATSAPP_QUOTE_CARD_ENABLED, true),
  remoteAdmin: bool(process.env.WHATSAPP_REMOTE_ADMIN_ENABLED, false),
  zeroCost: bool(process.env.ZERO_COST_MODE, true),
})

export const SITE_URL = (process.env.SITE_URL || process.env.BASE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')
export const TIME_ZONE = process.env.WHATSAPP_TIME_ZONE || 'Asia/Kuwait'
export const DATA_DIR = process.env.WHATSAPP_AGENT_DATA_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'DrAhmadWhatsAppAgent')
export const DB_PATH = process.env.WHATSAPP_AGENT_DB || path.join(DATA_DIR, 'agent.sqlite')
export const LAUNCH_AGENT_LABEL = 'com.dr-alfailakawi.whatsapp-agent'
export const BRIDGE_PORT = Number(process.env.WHATSAPP_AGENT_BRIDGE_PORT || 34321)
export const BRIDGE_SECRET_MIN_LENGTH = 64
export const BRIDGE_TLS_CERT = process.env.WHATSAPP_AGENT_TLS_CERT || ''
export const BRIDGE_TLS_KEY = process.env.WHATSAPP_AGENT_TLS_KEY || ''
export const MANUAL_TAKEOVER_MINUTES = Math.max(1, Number(process.env.WHATSAPP_MANUAL_TAKEOVER_MINUTES || 30))
export const HEARTBEAT_STALE_MS = Math.max(30_000, Number(process.env.WHATSAPP_HEARTBEAT_STALE_MS || 3 * 60 * 1000))
export const HEARTBEAT_INTERVAL_MS = Math.max(10_000, Number(process.env.WHATSAPP_HEARTBEAT_INTERVAL_MS || 30_000))
export const MAX_MESSAGE_CHARS = Math.min(Number(process.env.WHATSAPP_MAX_MESSAGE_CHARS || 4000), 10000)
export const MAX_CAMPAIGN_TARGETS = Math.min(Math.max(Number(process.env.WHATSAPP_MAX_CAMPAIGN_TARGETS || 25), 1), 100)
export const BROADCAST_DEFAULT_INTERVAL_SECONDS = Math.min(Math.max(Number(process.env.WHATSAPP_BROADCAST_INTERVAL_SECONDS || 45), 5), 15 * 60)
export const BROADCAST_MIN_INTERVAL_SECONDS = Math.min(Math.max(Number(process.env.WHATSAPP_BROADCAST_MIN_INTERVAL_SECONDS || 20), 5), 15 * 60)
export const RETENTION_DAYS = Math.max(7, Number(process.env.WHATSAPP_RETENTION_DAYS || 30))
export const AZURE_STT_HARD_STOP_SECONDS = Math.max(60, Number(process.env.WHATSAPP_AZURE_STT_HARD_STOP_SECONDS || 4 * 60 * 60))
export const AZURE_TTS_HARD_STOP_CHARS = Math.max(1000, Number(process.env.WHATSAPP_AZURE_TTS_HARD_STOP_CHARS || 400000))
/* نداءات المساعد الصريحة. حُذفت «د. أحمد» و«@دكتور» لأن المُطبِّع يجرّدهما
   من النقطة والرمز فتصيران «د احمد» و«دكتور» — و«دكتور» وحدها أكثر ما
   يخاطب به الناسُ الدكتورَ، فكانت توقظ البوت على كل مُحيٍّ ومُسلِّم. */
export const AUTO_REPLY_TRIGGERS = String(process.env.WHATSAPP_AUTO_REPLY_TRIGGERS || 'سؤال:,اسأل د. أحمد,اسأل الدكتور,اسال الدكتور')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
export const AUTO_REPLY_ALLOWLIST = String(process.env.WHATSAPP_AUTO_REPLY_ALLOWLIST || '')
  .split(',')
  .map((item) => item.replace(/\s+/g, '').trim().toLowerCase())
  .filter(Boolean)

export function ensureSafeDataDir(fs) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
  try { fs.chmodSync(DATA_DIR, 0o700) } catch { /* Windows/readonly environments */ }
}

export function redactJid(value = '') {
  const raw = String(value)
  if (!raw) return ''
  const at = raw.indexOf('@')
  const number = at >= 0 ? raw.slice(0, at) : raw
  return `${number.slice(0, 2)}••••${number.slice(-2)}${at >= 0 ? raw.slice(at) : ''}`
}

export function redactError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error')
  return message.replace(/\b\d{7,16}\b/g, '••••').replace(/(key|token|secret|password)[=:][^\s]+/gi, '$1=[redacted]')
}
