import { EventEmitter } from 'node:events'
import { redactError } from './config.mjs'

/* مفاتيح الجلسة ثنائية (Buffer/Uint8Array)، و`JSON.stringify` ينادي `toJSON` قبل
   المُبدِّل — فيصل الشكل {type:'Buffer',data} ولا يلتقطه `Buffer.isBuffer` أبداً.
   فكانت المفاتيح تُحفظ وتُقرأ كائناتٍ عادية، فينهار baileys على `routingInfo`
   (byteLength=undefined → NaN) عند أول إقلاع بعد أن يمنحه الخادم التوجيه.
   نلتقط الشكلين هنا، ونُحيي الجلسات القديمة كما هي بلا إعادة اقتران. */
const toBinary = (item) => {
  if (Buffer.isBuffer(item)) return item
  if (item instanceof Uint8Array) return Buffer.from(item)
  if (item && item.type === 'Buffer' && Array.isArray(item.data)) return Buffer.from(item.data)
  return null
}
const encode = (value) => JSON.stringify(value, (_key, item) => {
  const binary = toBinary(item)
  return binary ? { __buffer: binary.toString('base64') } : item
})
const decode = (value) => JSON.parse(value, (_key, item) => {
  if (item && typeof item === 'object' && typeof item.__buffer === 'string') return Buffer.from(item.__buffer, 'base64')
  const legacy = item && typeof item === 'object' && item.type === 'Buffer' && Array.isArray(item.data) ? Buffer.from(item.data) : null
  return legacy || item
})

export class MockTransport extends EventEmitter {
  constructor() { super(); this.status = 'disconnected'; this.sent = []; this.qr = null }
  async connect() { this.status = 'connected'; this.emit('status', this.status); return { status: this.status } }
  async disconnect() { this.status = 'disconnected'; this.emit('status', this.status) }
  getConnectionStatus() { return this.status }
  async sendText(jid, text) { if (this.status !== 'connected') throw new Error('mock transport is disconnected'); this.sent.push({ jid, text }); return { id: `mock-${this.sent.length}` } }
  async sendMedia(jid, media) { this.sent.push({ jid, media }); return { id: `mock-media-${this.sent.length}` } }
  async sendSelf(text) { return this.sendText('self@s.whatsapp.net', text) }
  async syncContacts() { return { count: 0 } }
  async discoverGroups() { return [{ jid: '120363000000000000@g.us', name: 'مجموعة اختبار محلية', memberCount: 3, membersReadable: false }] }
  async discoverBroadcastLists() { return { supported: false, reason: 'mock transport' } }
  async getBroadcastRecipients() { return [] }
  markManualTakeover() {}
  pauseChat() {}
  resumeChat() {}
  async logout() { await this.disconnect() }
}

export async function createWhatsAppTransport({ db, onMessage, onContacts, onQr, onPairingCode, maxReconnects = 4 } = {}) {
  let baileys
  try { baileys = await import('@whiskeysockets/baileys') } catch (error) {
    throw new Error(`Baileys غير مثبت. نفّذ npm install داخل whatsapp-agent. (${redactError(error)})`)
  }
  const makeWASocket = baileys.default || baileys.makeWASocket
  if (typeof makeWASocket !== 'function') throw new Error('إصدار Baileys لا يصدّر makeWASocket المتوقع.')
  const events = new EventEmitter()
  let socket = null
  let status = 'disconnected'
  let reconnects = 0
  let stopping = false
  let qrcodeTerminal = null
  try { qrcodeTerminal = (await import('qrcode-terminal')).default || (await import('qrcode-terminal')) } catch { /* optional terminal renderer */ }

  const authState = {
    creds: db.loadAuth('creds', 'main') ? decode(db.loadAuth('creds', 'main')) : baileys.initAuthCreds(),
    keys: {
      get: async (type, ids) => {
        const result = {}
        for (const id of ids) {
          const value = db.loadAuth(`keys:${type}`, id)
          result[id] = value ? decode(value) : undefined
        }
        return result
      },
      set: async (data) => {
        for (const [type, values] of Object.entries(data)) for (const [id, value] of Object.entries(values)) {
          if (value == null) db.run('DELETE FROM whatsapp_auth WHERE kind=? AND name=?', `keys:${type}`, id)
          else db.saveAuth(`keys:${type}`, id, encode(value))
        }
      },
    },
  }

  const setStatus = (next, extra = {}) => { status = next; db.setState({ status: next, ...extra }); events.emit('status', { status: next, ...extra }) }
  const connect = async ({ phoneNumber } = {}) => {
    stopping = false
    setStatus(reconnects ? 'reconnecting' : 'pairing', { qr: null, pairing_code: null })
    socket = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      browser: ['Dr Ahmad WhatsApp Agent', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
    })
    socket.ev.on('creds.update', () => db.saveAuth('creds', 'main', encode(authState.creds)))
    /* دفتر الأسماء: واتساب لا يسلّم قوائم البث لجهازٍ مرتبط، لكنه يزامن
       جهات الاتصال بأسمائها — ومنها يبني الدكتور قوائمه في اللوحة. */
    const harvest = (contacts, origin) => {
      if (!Array.isArray(contacts) || !contacts.length) return
      try { onContacts?.(contacts, origin) } catch (error) { console.error('تعذّر استيعاب جهات الاتصال:', error?.message || error) }
    }
    socket.ev.on('contacts.upsert', (contacts) => harvest(contacts, 'upsert'))
    socket.ev.on('contacts.update', (contacts) => harvest(contacts, 'update'))
    socket.ev.on('messaging-history.set', ({ contacts }) => harvest(contacts, 'history'))
    socket.ev.on('messages.upsert', ({ messages }) => {
      for (const message of messages || []) {
        const jid = message?.key?.remoteJid
        const messageId = message?.key?.id
        const fromMe = Boolean(message?.key?.fromMe)
        const text = message?.message?.conversation || message?.message?.extendedTextMessage?.text || message?.message?.imageMessage?.caption || ''
        const hasMedia = Boolean(message?.message?.imageMessage || message?.message?.audioMessage || message?.message?.videoMessage || message?.message?.documentMessage || message?.message?.stickerMessage)
        if (!jid || !messageId) continue
        if (fromMe) {
          const isBotEcho = db.get('SELECT message_id FROM outbox_messages WHERE message_id=?', messageId)
          if (!isBotEcho) events.emit('manual-takeover', jid)
          continue
        }
        if (db.get('SELECT message_id FROM processed_messages WHERE message_id=?', messageId)) continue
        db.run('INSERT OR IGNORE INTO processed_messages(message_id,jid,created_at) VALUES(?,?,?)', messageId, db.jidKey(jid), new Date().toISOString())
        if (jid && (text || hasMedia) && onMessage) onMessage({ jid, text: text || '[وسائط]', message, media: hasMedia })
        events.emit('message', { jid, text, message })
      }
    })
    socket.ev.on('connection.update', async (update) => {
      if (update.qr) {
        db.setState({ status: 'pairing', qr: null, pairing_code: null })
        if (qrcodeTerminal?.generate) qrcodeTerminal.generate(update.qr, { small: true })
        else console.log('ظهر QR للاقتران. استخدم --phone=965XXXXXXXX للحصول على رمز اقتران بدلًا من QR.')
        onQr?.(update.qr); events.emit('qr', update.qr)
      }
      if (update.connection === 'open') {
        reconnects = 0
        setStatus('connected', { qr: null, pairing_code: null, device_name: 'WhatsApp Agent – MacBook M2' })
        /* دفتر الأسماء: واتساب يرسله مرةً واحدة عند الاقتران الأول وحده. وجلسة
           الدكتور مرتبطةٌ من قبل، فلم يصل شيء وبقي الدفتر فارغاً. نطلبه هنا
           صراحةً عند كل اتصال — والمجموعة critical_unblock_low هي التي تحمل
           جهات الاتصال في مزامنة حالة التطبيق. */
        void (async () => {
          try {
            if (typeof socket.resyncAppState !== 'function') return
            await socket.resyncAppState(['critical_unblock_low'], true)
            console.log('طُلب دفتر جهات الاتصال من واتساب.')
          } catch (error) {
            console.error('تعذّر طلب دفتر جهات الاتصال:', error?.message || error)
          }
        })()
        return
      }
      if (update.connection === 'close') {
        const code = update.lastDisconnect?.error?.output?.statusCode
        if (stopping || code === baileys.DisconnectReason?.loggedOut) { setStatus('disconnected'); return }
        reconnects += 1
        /* أربع محاولاتٍ ثم استسلامٌ نهائي: أيُّ انقطاعٍ عابر في الإنترنت — أو
           نومُ الشبكة دقيقةً — كان يُسكت البوت حتى يُعيد الدكتور تشغيله بيده،
           فيمرّ يومٌ وهو يظنّه يعمل. الانقطاع العابر ليس تسجيل خروج: نُبطئ
           بعد المحاولات الأولى إلى دقيقتين ونظلّ نحاول ما دام واتساب لم
           يطردنا (وحالةُ loggedOut تُعالَج أعلاه وتوقف كل شيء كما ينبغي). */
        const patient = reconnects > maxReconnects
        if (patient && reconnects === maxReconnects + 1) {
          console.log('⚠ تعذّر الاتصال بعد محاولاتٍ سريعة — نتمهّل ونواصل المحاولة بلا استسلام.')
        }
        setStatus(patient ? 'reconnecting' : 'reconnecting', {
          last_error: patient
            ? 'الاتصال متعذّر مؤقتاً؛ نواصل المحاولة كل دقيقتين.'
            : redactError(update.lastDisconnect?.error),
        })
        const delay = patient ? 120_000 : Math.min(30000, 1200 * 2 ** reconnects)
        setTimeout(() => { void connect({ phoneNumber }) }, delay)
      }
    })
    if (phoneNumber && typeof socket.requestPairingCode === 'function' && !authState.creds.registered) {
      try { const code = await socket.requestPairingCode(String(phoneNumber).replace(/\D/g, '')); db.setState({ status: 'pairing', qr: null, pairing_code: null }); console.log(`رمز اقتران واتساب: ${code}`); onPairingCode?.(code); events.emit('pairing-code', code) } catch (error) { setStatus('error', { last_error: redactError(error) }) }
    }
    return socket
  }
  const transport = {
    events,
    connect,
    async disconnect() { stopping = true; if (socket) socket.end?.(new Error('manual disconnect')); setStatus('disconnected') },
    getConnectionStatus: () => status,
    async sendText(jid, text) {
      if (!socket || status !== 'connected') throw new Error('واتساب غير متصل')
      const result = await socket.sendMessage(jid, { text })
      const messageId = result?.key?.id || result?.id
      if (messageId) db.run('INSERT OR IGNORE INTO outbox_messages(message_id,jid,source,created_at) VALUES(?,?,?,?)', messageId, db.jidKey(jid), 'bot', new Date().toISOString())
      return result
    },
    async sendMedia(jid, media) { if (!socket || status !== 'connected') throw new Error('واتساب غير متصل'); return socket.sendMessage(jid, media) },
    async syncContacts() { return { count: 0, supported: false, reason: 'لا تُحفظ جهات الاتصال إلا عند طلب المزامنة.' } },
    async discoverGroups() {
      if (!socket || status !== 'connected') throw new Error('واتساب غير متصل')
      if (typeof socket.groupFetchAllParticipating !== 'function') return []
      const groups = await socket.groupFetchAllParticipating()
      return Object.entries(groups || {}).map(([jid, info]) => ({
        jid,
        name: String(info?.subject || 'مجموعة واتساب').trim(),
        memberCount: Array.isArray(info?.participants) ? info.participants.length : Number(info?.size || 0),
        membersReadable: false,
      })).filter((group) => group.jid.endsWith('@g.us'))
    },
    async discoverBroadcastLists() { return { supported: false, reason: 'لا يقدّم Baileys واجهة مستقرة لقراءة أعضاء Broadcast دون History Sync؛ لم يتم تعديل أي قائمة.' } },
    async getBroadcastRecipients() { return [] },
    markManualTakeover(jid) { events.emit('manual-takeover', jid) },
    pauseChat(jid) { events.emit('pause-chat', jid) },
    resumeChat(jid) { events.emit('resume-chat', jid) },
    async logout() { stopping = true; await socket?.logout?.(); db.deleteAuth(); setStatus('disconnected') },
  }
  return transport
}
