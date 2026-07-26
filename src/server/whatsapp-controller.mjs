import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { buildContentIndex } from '../../whatsapp-agent/content-index.mjs'

const SITE_URL = String(process.env.WHATSAPP_SITE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')
const OWNER_ALERT_FALLBACK = 'وصلت رسالة تحتاج تدخلك البشري. افتح محادثات واتساب من جهازك المرتبط.'
const HUMAN_ACK = 'وصلتني رسالتك، وتحتاج تأكيدًا بشريًا. سيكمل معك الدكتور أو أحد الفريق بأقرب وقت.'
const DUPLICATE_ACK = 'وصلتني الرسالة نفسها وهي عندي بالفعل. إذا احتاجت متابعة بشرية سيكمل معك الفريق.'
const WELCOME = `حياك الله في موقع د. أحمد حسين الفيلكاوي.\n\nالموقع هو المرجع المعتمد للمقالات والكتب والمواد المنشورة:\n${SITE_URL}`
const MANUAL_MINUTES = Math.max(5, Math.min(240, Number(process.env.WHATSAPP_MANUAL_TAKEOVER_MINUTES || 30)))
const BRIDGE_ONLINE_MS = Math.max(30_000, Number(process.env.WHATSAPP_BRIDGE_ONLINE_MS || 90_000))
const MAX_BODY_BYTES = 2 * 1024 * 1024

const COLLECTIONS = Object.freeze({
  bridge: 'whatsapp_bridge_state',
  conversations: 'whatsapp_conversations',
  rules: 'whatsapp_reply_rules',
  ruleVersions: 'whatsapp_rule_versions',
  commands: 'whatsapp_bridge_commands',
  events: 'whatsapp_attention_events',
  settings: 'whatsapp_settings',
})

const GREETINGS = [
  'السلام عليكم ورحمة الله وبركاته', 'السلام عليكم ورحمه الله وبركاته',
  'السلام عليكم', 'سلام عليكم', 'وعليكم السلام', 'هلا والله', 'هلا', 'مرحبا',
  'مرحبا بك', 'صباح الخير', 'مساء الخير', 'شلونك', 'كيف حالك', 'لو سمحت',
]

const NOISE_WORDS = new Set([
  'ابي', 'ابغى', 'اريد', 'ممكن', 'لو', 'سمحت', 'عندك', 'عن', 'حول', 'شي',
  'شيء', 'شنو', 'ماهو', 'ماهي', 'هل', 'في', 'من', 'الى', 'على', 'مع', 'هذا',
  'هذه', 'ذلك', 'اللي', 'الذي', 'التي', 'لي', 'لنا', 'فضلا', 'رجاء',
])

const HUMAN_PATTERNS = [
  /(?:ابي|اريد|ابغى|ممكن)\s+(?:موظف|انسان|شخص|الدكتور|احد)/,
  /(?:حولني|وصلني|كلمني|اكلم)\s+(?:موظف|الدكتور|شخص|انسان)/,
  /(?:تواصل|اتصال)\s+(?:بشري|مع الدكتور|مع موظف)/,
]

const PRICE_PATTERNS = [
  /(?:قائمه|منيو|اسعار|الاسعار|سعر|بكم|كم السعر|التكلفه|تكلفه)/,
]

const ARABIC_DIGITS = Object.freeze({
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
})

function asIso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

function bounded(value, max = 2_000) {
  return String(value ?? '').trim().slice(0, max)
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function conversationId(jid) {
  return hash(`whatsapp:${bounded(jid, 180)}`).slice(0, 40)
}

function maskJid(jid) {
  const value = bounded(jid, 180)
  const number = value.split('@', 1)[0].replace(/\D/g, '')
  return number.length > 4 ? `${'*'.repeat(Math.max(4, number.length - 4))}${number.slice(-4)}` : '****'
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function normalizeArabicMessage(value) {
  return normalizeWhitespace(String(value || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ـ/g, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' '))
}

export function stripArabicGreetings(value) {
  let text = normalizeArabicMessage(value)
  const normalizedGreetings = GREETINGS.map(normalizeArabicMessage).sort((a, b) => b.length - a.length)
  let changed = true
  while (changed && text) {
    changed = false
    for (const greeting of normalizedGreetings) {
      if (text === greeting || text.startsWith(`${greeting} `)) {
        text = text.slice(greeting.length).trim()
        changed = true
        break
      }
    }
  }
  return text
}

function sharedPrefix(left, right) {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left[index] === right[index]) index += 1
  return index
}

function conservativeTokenMatch(inputToken, keywordToken) {
  if (!inputToken || !keywordToken) return false
  if (inputToken === keywordToken) return true
  if (keywordToken.length >= 4 && inputToken.includes(keywordToken)) return true
  if (inputToken.length < 4 || keywordToken.length < 4) return false
  if (Math.abs(inputToken.length - keywordToken.length) > 2) return false
  return sharedPrefix(inputToken, keywordToken) >= 4
}

function keywordMatches(message, keyword) {
  const query = stripArabicGreetings(message)
  const key = normalizeArabicMessage(keyword)
  if (!query || !key) return false
  if (query === key || query.includes(key)) return true
  const queryTokens = query.split(' ')
  const keyTokens = key.split(' ')
  return keyTokens.every((needle) => queryTokens.some((token) => conservativeTokenMatch(token, needle)))
}

export function findRuleMatch(message, rules = []) {
  const enabled = [...rules]
    .filter((rule) => rule && rule.enabled !== false && Array.isArray(rule.keywords) && rule.keywords.length)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  for (const rule of enabled) {
    const results = rule.keywords.map((keyword) => keywordMatches(message, keyword))
    const type = rule.matchType || 'any'
    const matched = type === 'all'
      ? results.every(Boolean)
      : type === 'exact'
        ? rule.keywords.some((keyword) => stripArabicGreetings(message) === normalizeArabicMessage(keyword))
        : results.some(Boolean)
    if (matched) return rule
  }
  return null
}

function isGreetingOnly(text) {
  return Boolean(normalizeArabicMessage(text)) && !stripArabicGreetings(text)
}

function contentTokens(text) {
  return [...new Set(stripArabicGreetings(text).split(' ')
    .filter((token) => token.length >= 3 && !NOISE_WORDS.has(token)))]
}

function scoreContent(item, queryTokens) {
  if (!queryTokens.length) return { score: 0, matched: 0, headingMatches: 0 }
  const title = normalizeArabicMessage(item.title)
  const excerpt = normalizeArabicMessage(item.excerpt)
  const keywords = normalizeArabicMessage(item.keywords)
  const body = normalizeArabicMessage(item.body).slice(0, 20_000)
  let score = 0
  let matched = 0
  let headingMatches = 0
  for (const token of queryTokens) {
    const inTitle = title.includes(token)
    const inKeywords = keywords.includes(token)
    const inExcerpt = excerpt.includes(token)
    const inBody = body.includes(token)
    if (inTitle || inKeywords || inExcerpt || inBody) matched += 1
    if (inTitle || inKeywords) headingMatches += 1
    if (inTitle) score += 8
    else if (inKeywords) score += 5
    else if (inExcerpt) score += 3
    else if (inBody) score += 1
  }
  if (matched === queryTokens.length && queryTokens.length > 1) score += 6
  return { score, matched, headingMatches }
}

let contentIndexCache = null
function siteIndex() {
  if (contentIndexCache) return contentIndexCache
  try {
    contentIndexCache = buildContentIndex(process.cwd(), SITE_URL)
  } catch {
    contentIndexCache = []
  }
  return contentIndexCache
}

function exactSiteResults(query, overrideQuery = '') {
  const tokens = contentTokens(overrideQuery || query).slice(0, 8)
  if (!tokens.length) return []
  const rows = siteIndex()
    .map((item) => ({ item, ...scoreContent(item, tokens) }))
    .filter((row) => {
      if (tokens.length === 1) return row.score >= 8 && row.headingMatches >= 1
      const neededMatches = Math.min(tokens.length, Math.max(2, Math.ceil(tokens.length * .6)))
      return row.score >= 9 && row.matched >= neededMatches && row.headingMatches >= 1
    })
    .sort((a, b) => b.score - a.score || String(b.item.date || '').localeCompare(String(a.item.date || '')))
    .slice(0, 3)
  return rows.map((row) => row.item)
}

function siteResultReply(items) {
  const lines = items.map((item, index) => `${index + 1}) ${item.title}\n${item.url}`)
  return `وجدت في موقع الدكتور مواد منشورة مرتبطة بسؤالك:\n\n${lines.join('\n\n')}\n\nهذه روابط الموقع كما هي، من دون إضافة معلومات من خارجها.`
}

export function decideGroundedResponse({ text, hasMedia = false, rules = [], priorReplyHash = '' } = {}) {
  const clean = normalizeArabicMessage(text)
  if (hasMedia) return { kind: 'escalate', reason: 'media', reply: HUMAN_ACK }
  if (!clean) return { kind: 'escalate', reason: 'empty-after-normalization', reply: HUMAN_ACK }
  if (HUMAN_PATTERNS.some((pattern) => pattern.test(clean))) {
    return { kind: 'escalate', reason: 'human-request', reply: HUMAN_ACK }
  }

  const rule = findRuleMatch(text, rules)
  if (rule) {
    if (rule.actionType === 'transfer') return { kind: 'escalate', reason: `rule:${rule.id}`, reply: bounded(rule.responseText, 1_500) || HUMAN_ACK, rule }
    if (rule.actionType === 'site-content') {
      const found = exactSiteResults(text, rule.contentQuery)
      if (!found.length) return { kind: 'escalate', reason: `rule-no-grounding:${rule.id}`, reply: HUMAN_ACK, rule }
      return { kind: 'reply', reason: `rule:${rule.id}`, reply: siteResultReply(found), rule, evidence: found.map((item) => item.id) }
    }
    const response = bounded(rule.responseText, 2_000)
    if (response) return { kind: 'reply', reason: `rule:${rule.id}`, reply: response, rule }
  }

  if (PRICE_PATTERNS.some((pattern) => pattern.test(clean)) || isGreetingOnly(text)) {
    return { kind: 'reply', reason: isGreetingOnly(text) ? 'greeting' : 'site-is-source', reply: WELCOME }
  }

  const found = exactSiteResults(text)
  if (found.length) return { kind: 'reply', reason: 'site-index', reply: siteResultReply(found), evidence: found.map((item) => item.id) }

  const fallback = { kind: 'escalate', reason: 'no-grounded-answer', reply: HUMAN_ACK }
  if (priorReplyHash && hash(fallback.reply) === priorReplyHash) fallback.reply = 'سؤالك يحتاج تأكيدًا من الدكتور. تم تحويل المحادثة له ولن أضيف جوابًا غير موثّق.'
  return fallback
}

function safeEqualSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''))
  const right = Buffer.from(String(expected || ''))
  if (!left.length || !right.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

async function readJson(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 })
  }
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

function serializeDoc(snapshot) {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null
}

function bridgeStatus(data = {}) {
  const heartbeatAt = bounded(data.lastHeartbeatAt || data.updatedAt, 80)
  const heartbeatAgeMs = heartbeatAt ? Math.max(0, Date.now() - Date.parse(heartbeatAt)) : null
  const bridgeOnline = Number.isFinite(heartbeatAgeMs) && heartbeatAgeMs <= BRIDGE_ONLINE_MS
  const connected = bridgeOnline && data.status === 'connected'
  return {
    status: bridgeOnline ? (data.status || 'disconnected') : 'disconnected',
    bridgeOnline,
    lastHeartbeatAt: heartbeatAt || null,
    heartbeatAgeMs,
    last_error: bounded(data.lastError, 600) || null,
    device_name: bounded(data.deviceName, 120) || 'جسر واتساب المركزي',
    updated_at: bounded(data.updatedAt, 80) || null,
    qr: connected ? null : bounded(data.qr, 8_000) || null,
    qrImage: connected ? null : bounded(data.qrImage, 500_000) || null,
    pairing_code: null,
    runtimePaused: Boolean(data.runtimePaused),
    indexed: siteIndex().length,
    timeZone: 'Asia/Kuwait',
    health: {
      code: connected ? 'ready' : data.qr ? 'scan-qr' : bridgeOnline ? 'connecting' : 'offline',
      label: connected ? 'جاهز' : data.qr ? 'امسح رمز QR' : bridgeOnline ? 'يتصل' : 'الجسر غير متصل',
      why: connected ? 'الجلسة محفوظة والجسر يرسل نبضاته.' : 'الاتصال يحتاج إكمالًا أو تشغيل الخدمة.',
      fix: data.qr ? 'امسح الرمز من واتساب ← الأجهزة المرتبطة.' : 'راجع خدمة whatsapp-bridge على السيرفر.',
      ready: connected,
      needsAuthScan: Boolean(data.qr && !connected),
      connected,
      quietNow: Boolean(data.runtimePaused),
      silenced: 0,
      pollFailures: 0,
    },
  }
}

async function getConversation(db, jid) {
  const ref = db.collection(COLLECTIONS.conversations).doc(conversationId(jid))
  const snapshot = await ref.get()
  return { ref, data: snapshot.exists ? snapshot.data() || {} : {} }
}

async function listRules(db) {
  const snapshot = await db.collection(COLLECTIONS.rules).limit(250).get()
  return snapshot.docs.map(serializeDoc).filter(Boolean)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ar'))
}

async function enqueueCommand(db, type, payload = {}) {
  const id = randomUUID()
  const now = asIso()
  await db.collection(COLLECTIONS.commands).doc(id).set({
    id, type, payload, status: 'pending', attempts: 0, createdAt: now, updatedAt: now,
  })
  return { id, type }
}

async function sweepExpiredManualStates(db) {
  const now = Date.now()
  const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
  const writes = []
  for (const doc of snapshot.docs) {
    const data = doc.data() || {}
    const until = Date.parse(data.manualUntil || data.autoResumeAt || '')
    if (data.mode === 'human' && data.needsHuman !== true && Number.isFinite(until) && until <= now) {
      writes.push(doc.ref.set({
        mode: 'bot', manualUntil: null, autoResumeAt: null, notificationMutedUntil: null,
        updatedAt: asIso(), resumedAutomaticallyAt: asIso(),
      }, { merge: true }))
    }
  }
  await Promise.all(writes)
  return writes.length
}

function adminPath(url) {
  return url.pathname.slice('/api/admin/whatsapp'.length) || '/'
}

function bridgePath(url) {
  return url.pathname.slice('/api/whatsapp'.length) || '/'
}

export function createWhatsAppController({ getFirestore, verifyAdminRequest } = {}) {
  if (typeof getFirestore !== 'function') throw new Error('getFirestore is required')
  if (typeof verifyAdminRequest !== 'function') throw new Error('verifyAdminRequest is required')

  const bridgeSecret = String(process.env.WHATSAPP_BRIDGE_SECRET || '').trim()

  async function requireAdmin(req, res) {
    try {
      if (await verifyAdminRequest(req)) return true
    } catch {
      // الرد الموحد أدناه لا يكشف سبب فشل التوثيق.
    }
    sendJson(res, 403, { error: 'Admin access required' })
    return false
  }

  function requireBridge(req, res) {
    const supplied = req.headers['x-whatsapp-bridge-secret']
    if (bridgeSecret && safeEqualSecret(supplied, bridgeSecret)) return true
    sendJson(res, 401, { error: 'Invalid bridge secret' })
    return false
  }

  async function handleWebhook(req, res) {
    if (!requireBridge(req, res)) return
    const body = await readJson(req)
    const event = bounded(body.event, 40)
    const { db } = await getFirestore()
    const now = asIso()

    if (event === 'heartbeat' || event === 'status' || event === 'qr') {
      const patch = {
        status: event === 'qr' ? 'pairing' : bounded(body.status, 40) || 'disconnected',
        lastHeartbeatAt: now,
        updatedAt: now,
        deviceName: bounded(body.deviceName, 120),
        version: bounded(body.version, 80),
        lastError: bounded(body.error, 600) || null,
      }
      if (event === 'qr') {
        patch.qr = bounded(body.qr, 8_000)
        patch.qrImage = bounded(body.qrImage, 500_000)
      } else if (body.status === 'connected') {
        patch.qr = null
        patch.qrImage = null
      }
      await db.collection(COLLECTIONS.bridge).doc('primary').set(patch, { merge: true })
      if (event === 'heartbeat') await sweepExpiredManualStates(db)
      sendJson(res, 200, { ok: true })
      return
    }

    const jid = bounded(body.jid, 180)
    if (!jid || !/@(?:c|s)\.us$|@s\.whatsapp\.net$/.test(jid)) {
      sendJson(res, 400, { error: 'Invalid conversation id' })
      return
    }
    const { ref, data } = await getConversation(db, jid)

    if (event === 'manual') {
      const until = asIso(Date.now() + MANUAL_MINUTES * 60_000)
      await ref.set({
        jid,
        masked: maskJid(jid),
        mode: 'human',
        needsHuman: false,
        manualUntil: until,
        autoResumeAt: until,
        notificationMutedUntil: until,
        lastManualAt: now,
        updatedAt: now,
      }, { merge: true })
      sendJson(res, 200, { ok: true, mutedUntil: until })
      return
    }

    if (event === 'delivery-failed') {
      await ref.set({ lastDeliveryError: bounded(body.error, 600), lastDeliveryFailedAt: now, updatedAt: now }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }

    if (event !== 'incoming') {
      sendJson(res, 400, { error: 'Unsupported webhook event' })
      return
    }

    const text = bounded(body.text, 12_000)
    const incomingHash = hash(normalizeArabicMessage(text) || `media:${bounded(body.mediaType, 80)}`)
    const lastInboundAt = Date.parse(data.lastInboundAt || '')
    const duplicate = data.lastIncomingHash === incomingHash && Number.isFinite(lastInboundAt) && Date.now() - lastInboundAt < 10 * 60_000
    const manualUntil = Date.parse(data.manualUntil || data.autoResumeAt || '')
    const manualActive = data.mode === 'human' && (
      data.needsHuman === true || (Number.isFinite(manualUntil) && manualUntil > Date.now())
    )

    const basePatch = {
      jid,
      masked: maskJid(jid),
      lastInboundAt: now,
      lastIncomingHash: incomingHash,
      lastMessageType: bounded(body.mediaType, 80) || 'text',
      updatedAt: now,
    }

    if (manualActive) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'human-takeover' })
      return
    }

    if (duplicate) {
      const replyHash = hash(DUPLICATE_ACK)
      const reply = data.lastReplyHash === replyHash ? 'نعم، رسالتك محفوظة عندي.' : DUPLICATE_ACK
      await ref.set({ ...basePatch, mode: 'bot', lastReplyHash: hash(reply), lastReplyAt: now }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'reply', reply: { text: reply }, reason: 'duplicate' })
      return
    }

    const settingsSnapshot = await db.collection(COLLECTIONS.settings).doc('runtime').get()
    const runtimePaused = Boolean(settingsSnapshot.exists && settingsSnapshot.data()?.paused)
    if (runtimePaused) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'runtime-paused' })
      return
    }

    const rules = await listRules(db)
    const decision = decideGroundedResponse({
      text,
      hasMedia: Boolean(body.hasMedia),
      rules,
      priorReplyHash: bounded(data.lastReplyHash, 80),
    })
    const replyText = bounded(decision.reply, 2_000)
    const replyHash = hash(replyText)
    const safeReply = data.lastReplyHash === replyHash
      ? 'وصلت فكرتك. حتى لا أكرر الرد، سأترك المتابعة للدكتور إذا احتاج السؤال تأكيدًا.'
      : replyText

    if (decision.kind === 'escalate') {
      const eventId = randomUUID()
      await Promise.all([
        ref.set({
          ...basePatch,
          mode: 'human',
          needsHuman: true,
          manualUntil: null,
          autoResumeAt: null,
          notificationMutedUntil: null,
          escalationReason: decision.reason,
          escalatedAt: now,
          lastReplyHash: hash(safeReply),
          lastReplyAt: now,
        }, { merge: true }),
        db.collection(COLLECTIONS.events).doc(eventId).set({
          id: eventId,
          conversationId: ref.id,
          masked: maskJid(jid),
          reason: decision.reason,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        }),
      ])
      sendJson(res, 200, {
        ok: true,
        action: 'reply-and-escalate',
        reason: decision.reason,
        reply: { text: safeReply },
        notifyOwner: {
          text: `${OWNER_ALERT_FALLBACK}\nالمحادثة: ${maskJid(jid)}\nالسبب: ${decision.reason}`,
          conversationId: jid,
        },
      })
      return
    }

    await ref.set({
      ...basePatch,
      mode: 'bot',
      needsHuman: false,
      manualUntil: null,
      autoResumeAt: null,
      lastReplyHash: hash(safeReply),
      lastReplyAt: now,
      lastEvidence: decision.evidence || [],
      lastDecisionReason: decision.reason,
    }, { merge: true })
    sendJson(res, 200, { ok: true, action: 'reply', reason: decision.reason, reply: { text: safeReply } })
  }

  async function handleBridgeCommand(req, res, url, method) {
    if (!requireBridge(req, res)) return
    const { db } = await getFirestore()
    if (method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.commands).limit(100).get()
      const now = Date.now()
      const pending = snapshot.docs.map(serializeDoc).filter((command) => {
        if (command.status === 'pending') return true
        const lease = Date.parse(command.leasedAt || '')
        return command.status === 'leased' && Number.isFinite(lease) && now - lease > 90_000
      }).sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))[0]
      if (!pending) {
        sendJson(res, 200, { command: null })
        return
      }
      await db.collection(COLLECTIONS.commands).doc(pending.id).set({
        status: 'leased', leasedAt: asIso(), updatedAt: asIso(), attempts: Number(pending.attempts || 0) + 1,
      }, { merge: true })
      sendJson(res, 200, { command: pending })
      return
    }
    if (method === 'POST') {
      const body = await readJson(req)
      const id = bounded(body.commandId, 80)
      if (!id) {
        sendJson(res, 400, { error: 'commandId is required' })
        return
      }
      await db.collection(COLLECTIONS.commands).doc(id).set({
        status: body.ok === false ? 'failed' : 'completed',
        error: bounded(body.error, 600) || null,
        completedAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    sendJson(res, 405, { error: 'Method Not Allowed' })
  }

  async function handleAdmin(req, res, url, method) {
    if (!(await requireAdmin(req, res))) return
    const { db } = await getFirestore()
    const path = adminPath(url)

    if (path === '/status' && method === 'GET') {
      await sweepExpiredManualStates(db)
      const [bridgeSnapshot, runtimeSnapshot, conversations] = await Promise.all([
        db.collection(COLLECTIONS.bridge).doc('primary').get(),
        db.collection(COLLECTIONS.settings).doc('runtime').get(),
        db.collection(COLLECTIONS.conversations).limit(250).get(),
      ])
      const data = bridgeSnapshot.exists ? bridgeSnapshot.data() || {} : {}
      const status = bridgeStatus({ ...data, runtimePaused: Boolean(runtimeSnapshot.data()?.paused) })
      const now = Date.now()
      const silenced = conversations.docs.filter((doc) => {
        const row = doc.data() || {}
        const until = Date.parse(row.manualUntil || row.autoResumeAt || '')
        return row.mode === 'human' && (row.needsHuman === true || (Number.isFinite(until) && until > now))
      }).length
      status.health.silenced = silenced
      status.health.quietNow = status.runtimePaused || silenced > 0
      sendJson(res, 200, status)
      return
    }

    if (path === '/silence' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
      const active = snapshot.docs.map((doc) => doc.data() || {}).filter((row) => {
        const until = Date.parse(row.manualUntil || row.autoResumeAt || '')
        return row.mode === 'human' && (row.needsHuman === true || (Number.isFinite(until) && until > Date.now()))
      })
      const timestamps = active.map((row) => Date.parse(row.manualUntil || row.autoResumeAt || '')).filter(Number.isFinite)
      sendJson(res, 200, { silenced: active.length, until: timestamps.length ? asIso(Math.max(...timestamps)) : null })
      return
    }

    if (path === '/rules' && method === 'GET') {
      sendJson(res, 200, await listRules(db))
      return
    }

    if (path === '/rules' && ['POST', 'PATCH'].includes(method)) {
      const body = await readJson(req, 64 * 1024)
      const id = method === 'PATCH' ? bounded(body.id, 100) : randomUUID()
      if (!id || !bounded(body.name, 120) || !Array.isArray(body.keywords) || !body.keywords.length) {
        sendJson(res, 400, { error: 'الاسم وكلمة مطابقة واحدة على الأقل مطلوبان.' })
        return
      }
      const existing = await db.collection(COLLECTIONS.rules).doc(id).get()
      if (existing.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: existing.data(), createdAt: asIso(),
        })
      }
      const rule = {
        id,
        name: bounded(body.name, 120),
        keywords: body.keywords.map((value) => bounded(value, 100)).filter(Boolean).slice(0, 40),
        priority: Math.max(-100, Math.min(1_000, Number(body.priority || 0))),
        matchType: ['any', 'all', 'exact'].includes(body.matchType) ? body.matchType : 'any',
        actionType: ['text', 'site-content', 'transfer'].includes(body.actionType) ? body.actionType : 'text',
        responseText: bounded(body.responseText, 2_000),
        contentQuery: bounded(body.contentQuery, 500),
        enabled: body.enabled !== false,
        updatedAt: asIso(),
      }
      await db.collection(COLLECTIONS.rules).doc(id).set(rule)
      sendJson(res, 200, rule)
      return
    }

    const ruleDelete = /^\/rules\/([^/]+)$/.exec(path)
    if (ruleDelete && method === 'DELETE') {
      const id = decodeURIComponent(ruleDelete[1])
      const ref = db.collection(COLLECTIONS.rules).doc(id)
      const current = await ref.get()
      if (current.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: current.data(), createdAt: asIso(),
        })
        await ref.delete()
      }
      sendJson(res, 200, { ok: true })
      return
    }

    const versionsMatch = /^\/rules\/([^/]+)\/versions$/.exec(path)
    if (versionsMatch && method === 'GET') {
      const id = decodeURIComponent(versionsMatch[1])
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).limit(250).get()
      const versions = snapshot.docs.map(serializeDoc).filter((row) => row.ruleId === id)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .map(({ id: docId, ...row }) => ({ ...row, id: Number(row.id || String(docId).split(':').at(-1)) }))
      sendJson(res, 200, versions)
      return
    }

    const rollbackMatch = /^\/rules\/([^/]+)\/rollback\/(\d+)$/.exec(path)
    if (rollbackMatch && method === 'POST') {
      const id = decodeURIComponent(rollbackMatch[1])
      const versionId = rollbackMatch[2]
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).get()
      if (!snapshot.exists || !snapshot.data()?.snapshot) {
        sendJson(res, 404, { error: 'Version not found' })
        return
      }
      await db.collection(COLLECTIONS.rules).doc(id).set({ ...snapshot.data().snapshot, id, updatedAt: asIso() })
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/restart' && method === 'POST') {
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'restart') })
      return
    }
    if (path === '/repair' && method === 'POST') {
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'repair-session'), message: 'أُرسل طلب إعادة الربط إلى الجسر المركزي.' })
      return
    }
    if (path === '/agent/pause' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: true, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/agent/resume' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: false, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/manual-takeover' && method === 'POST') {
      const body = await readJson(req)
      const jid = bounded(body.jid, 180)
      const minutes = Math.max(5, Math.min(240, Number(body.minutes || MANUAL_MINUTES)))
      const until = asIso(Date.now() + minutes * 60_000)
      const { ref } = await getConversation(db, jid)
      await ref.set({ jid, masked: maskJid(jid), mode: 'human', needsHuman: false, manualUntil: until, autoResumeAt: until, notificationMutedUntil: until, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, until })
      return
    }
    if (path === '/bot-return' && method === 'POST') {
      const body = await readJson(req)
      const { ref } = await getConversation(db, bounded(body.jid, 180))
      await ref.set({ mode: 'bot', needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/bot-return-all' && method === 'POST') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(500).get()
      const rows = snapshot.docs.filter((doc) => doc.data()?.mode === 'human')
      await Promise.all(rows.map((doc) => doc.ref.set({ mode: 'bot', needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })))
      sendJson(res, 200, { returned: rows.length })
      return
    }
    if (path === '/simulate' && method === 'POST') {
      const body = await readJson(req)
      const rules = await listRules(db)
      const decision = decideGroundedResponse({ text: body.text, rules })
      sendJson(res, 200, {
        willReply: true,
        why: decision.reason,
        quietNow: false,
        intent: decision.reason,
        mode: decision.kind === 'escalate' ? 'human' : 'bot',
        confidence: decision.kind === 'escalate' ? 0 : 1,
        needsHuman: decision.kind === 'escalate',
        ruleId: decision.rule?.id || null,
        ruleName: decision.rule?.name || null,
        preview: decision.reply,
      })
      return
    }

    if (path === '/learning' && method === 'GET') {
      sendJson(res, 200, { total: 0, learned: 0, observing: 0, ignored: 0, policy: 'لا يتعلم النظام من محادثات الناس تلقائيًا؛ كل قاعدة تعتمدها أنت صراحة.', items: [] })
      return
    }
    if (path === '/knowledge' && method === 'GET') {
      const index = siteIndex()
      sendJson(res, 200, {
        modes: [
          { id: 'site-only', label: 'الموقع فقط', boundary: 'لا إجابة بلا رابط أو قاعدة معتمدة.' },
          { id: 'human', label: 'تصعيد بشري', boundary: 'الصورة والملف والسؤال غير الموثق تتحول للبشر.' },
        ],
        sourcePolicies: { site: ['المقالات', 'الكتب', 'الأبحاث', 'المواد المنشورة'], customRules: ['قواعد تعتمدها من اللوحة'] },
        evidence: { total: index.length, enabled: index.length, lastUpdatedAt: asIso(), domains: [{ domain: new URL(SITE_URL).hostname, total: index.length, enabled: index.length }] },
        conversations: { active: 0, human: 0, intents: [], gaps: [], answers: [] },
        personality: { verbosity: 'brief', dialect: 'kuwaiti-light', initiative: 'none', signature: 'always', memoryConsent: 'explicit' },
        privacy: 'تُقنّع الأرقام في السجلات، ولا يتعلم البوت من كلام الناس تلقائيًا.',
      })
      return
    }
    if (path.startsWith('/trusted-evidence') && method === 'GET') {
      sendJson(res, 200, [])
      return
    }

    sendJson(res, 404, { error: 'WhatsApp admin endpoint not found' })
  }

  return async function handleWhatsAppRequest(req, res, url, method = req.method || 'GET') {
    try {
      if (url.pathname.startsWith('/api/whatsapp/')) {
        const path = bridgePath(url)
        if (path === '/webhook' && method === 'POST') await handleWebhook(req, res)
        else if (path === '/commands') await handleBridgeCommand(req, res, url, method)
        else sendJson(res, 404, { error: 'WhatsApp bridge endpoint not found' })
        return true
      }
      if (url.pathname.startsWith('/api/admin/whatsapp')) {
        await handleAdmin(req, res, url, method)
        return true
      }
      return false
    } catch (error) {
      sendJson(res, Number(error?.status || 500), {
        error: Number(error?.status || 500) >= 500 ? 'WhatsApp service error' : bounded(error?.message, 300),
      })
      return true
    }
  }
}

export const whatsappPolicy = Object.freeze({
  siteUrl: SITE_URL,
  manualTakeoverMinutes: MANUAL_MINUTES,
  zeroHallucination: true,
  paidAiApis: false,
})
