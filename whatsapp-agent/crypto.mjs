import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { DATA_DIR } from './config.mjs'

const SERVICE = 'dr-ahmad-whatsapp-agent'

function keyFromEnvironment() {
  const value = process.env.WHATSAPP_AGENT_KEY
  if (!value) return null
  const buffer = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64')
  return buffer.length === 32 ? buffer : null
}

function keyFromMacKeychain() {
  if (process.platform !== 'darwin') return null
  try {
    const value = execFileSync('security', ['find-generic-password', '-a', process.env.USER || 'user', '-s', SERVICE, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const buffer = Buffer.from(value, 'base64')
    return buffer.length === 32 ? buffer : null
  } catch { return null }
}

function createMacKeychainKey() {
  if (process.platform !== 'darwin') return null
  const value = crypto.randomBytes(32).toString('base64')
  try {
    execFileSync('security', ['add-generic-password', '-a', process.env.USER || 'user', '-s', SERVICE, '-w', value, '-U'], { stdio: 'ignore' })
    return Buffer.from(value, 'base64')
  } catch { return null }
}

let cachedKey
export function getEncryptionKey({ allowEphemeral = false } = {}) {
  if (cachedKey) return cachedKey
  cachedKey = keyFromEnvironment() || keyFromMacKeychain() || createMacKeychainKey()
  if (!cachedKey && allowEphemeral) cachedKey = crypto.createHash('sha256').update(`self-test:${DATA_DIR}`).digest()
  if (!cachedKey) throw new Error('لا يوجد مفتاح تشفير آمن. شغّل الوكيل على macOS أو عرّف WHATSAPP_AGENT_KEY محلياً.')
  return cachedKey
}

export function encrypt(value, options = {}) {
  if (value == null) return null
  const key = getEncryptionKey(options)
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  return `v1:${nonce.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${body.toString('base64url')}`
}

export function decrypt(value, options = {}) {
  if (!value) return null
  if (!String(value).startsWith('v1:')) return String(value)
  const [, nonceText, tagText, bodyText] = String(value).split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(options), Buffer.from(nonceText, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(bodyText, 'base64url')), decipher.final()]).toString('utf8')
}

export function hashOpaque(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32)
}

export function randomToken(bytes = 12) {
  return crypto.randomBytes(bytes).toString('base64url')
}
